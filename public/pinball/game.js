// Règles d'une partie, communes à toutes les tables : score, multiplicateur, combos, missions, multiball, jackpots,
// tilt, billes, et les mécanismes propres à chaque table (portails, machine à sous, roulette, piège, passage secret…).
// Reçoit les événements de la physique ; ne dessine rien (testée par test-pinball.mjs).
import { createWorld, addBall, step, launch, nudge, releaseHeld, unstick, inLane } from './physics.js';

const COMBO_WINDOW = 3; // secondes pour enchaîner deux actions
const BALL_SAVE = 10; // secondes de protection au début de chaque bille
const TILT_LIMIT = 3.2;
export const SLOT_SYMBOLS = ['🍒', '🔔', '💎', '7'];
const ROULETTE = [
  { text: '+50 000', points: 50000 },
  { text: 'Multiplicateur +1', mult: 1 },
  { text: 'Bille capturée !', lock: true },
  { text: 'Protection 15 s', save: true },
  { text: 'Jackpot +100 000', points: 100000 },
  { text: 'Bille capturée !', lock: true },
];

export function createGame(table, rng = Math.random) {
  const w = createWorld(table);
  const g = {
    table, w, rng,
    score: 0, ball: 1, balls: 3, mult: 1,
    combo: 0, comboTimer: 0, bestCombo: 0,
    lanes: [false, false, false],
    groups: Object.fromEntries(table.groups.map(gr => [gr.id, { hits: {}, step: 0 }])),
    banks: Object.fromEntries(table.banks.map(bk => [bk.id, {}])), // cibles tombées
    rampsDone: Object.fromEntries(table.ramps.map(r => [r.id, false])),
    counts: {}, open: {}, slot: null, slotMiss: 0,
    locks: 0, multiball: false, jackpotRamps: 0, jackpots: 0,
    missions: Object.fromEntries(table.missions.map(m => [m.id, false])),
    tilt: 0, tilted: false, saveTimer: 0, over: false,
    spin: 0, // tours de spinner à afficher
    messages: [], // { text, kind, t } pour l'écran
    fx: [], // effets visuels et sonores demandés : { kind, x, y, obj }
    ballScore: 0, stats: { bumpers: 0, ramps: 0, targets: 0, spins: 0 },
    startedAt: Date.now(), heldTimers: [], later: [], // actions différées, en temps de jeu (figées pendant la pause)
  };
  serveBall(g);
  return g;
}

const say = (g, text, kind = 'info') => g.messages.push({ text, kind, t: 0 });
const later = (g, s, fn) => g.later.push({ at: g.w.time + s, fn });
const wall = (g, id) => g.w.walls.find(s => s.id === id);
const fmt = n => n.toLocaleString('fr-FR');

function serveBall(g) {
  const [x, y] = g.table.lane.start;
  addBall(g.w, x, y);
  g.saveTimer = 0; // la protection démarre au lancement
}

// Points gagnés : multipliés par le multiplicateur courant ; « action » compte pour les combos
// (seulement les tirs voulus : les rebonds sur bumpers et slingshots n'en sont pas).
function points(g, n, action = true) {
  const won = n * g.mult;
  g.score += won;
  g.ballScore += won;
  if (action) {
    g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
    g.comboTimer = COMBO_WINDOW;
    if (g.combo > g.bestCombo) g.bestCombo = g.combo;
    if (g.combo >= 3) say(g, `Combo ×${g.combo}`, 'combo');
    for (const m of g.table.missions) if (m.type === 'combo' && g.combo >= m.n) complete(g, m);
  }
  for (const m of g.table.missions) if (m.type === 'score' && g.score >= m.n) complete(g, m);
  return won;
}

function complete(g, m) {
  if (g.missions[m.id]) return;
  g.missions[m.id] = true;
  g.score += m.bonus * g.mult;
  say(g, `Mission réussie : ${m.name} (+${fmt(m.bonus * g.mult)})`, 'mission');
  g.fx.push({ kind: 'mission' });
  if (!m.final) g.mult = Math.min(5, g.mult + 1); // chaque mission fait monter le multiplicateur
}
const completeType = (g, type, ref) => { for (const m of g.table.missions) if (m.type === type && (ref === undefined || m.ref === ref)) complete(g, m); };
function count(g, ref) {
  g.counts[ref] = (g.counts[ref] || 0) + 1;
  for (const m of g.table.missions) if (m.type === 'count' && m.ref === ref && g.counts[ref] >= m.n) complete(g, m);
}

// Ouvre (ou referme) des murs : porte d'un trou, dalle d'un passage secret.
function openWalls(g, ids = [], open = true) {
  for (const id of ids) {
    wall(g, id).active = !open;
    g.open[id] = open;
    for (const s of g.w.saucers) if (s.door === id) s.active = open;
  }
}

/* ---------- Cibles ---------- */
const groupOf = (g, id) => g.table.groups.find(gr => gr.ids.includes(id));
const bankOf = (g, id) => g.table.banks.find(bk => bk.ids.includes(id));

// Série de cibles (A-R-C, étoiles, cartes, totems…) : n coups par cible, dans l'ordre ou non.
function hitGroup(g, gr, id) {
  const st = g.groups[gr.id], n = gr.hits || 1, before = st.hits[id] || 0;
  st.hits[id] = Math.min(n, before + 1);
  g.stats.targets++;
  points(g, st.hits[id] === n ? 5000 : 1500);
  if (st.hits[id] !== n || before === n) return;
  if (gr.ordered) {
    // L'ordre compte : une cible touchée hors de son tour ne s'allume pas.
    if (gr.ids[st.step] === id) st.step++;
    else if (gr.ids.indexOf(id) > st.step) { st.hits[id] = n - 1; return; }
  }
  const lit = gr.ordered ? st.step : gr.ids.filter(x => st.hits[x] === n).length;
  if (lit < gr.ids.length) return say(g, `${lit}/${gr.ids.length}`, 'info');
  completeType(g, 'group', gr.id);
  if (gr.opens) { openWalls(g, gr.opens); say(g, 'Un passage s’ouvre !', 'big'); }
  g.groups[gr.id] = { hits: {}, step: 0 };
}

function hitDrop(g, bk, id) {
  const down = g.banks[bk.id];
  if (down[id]) return;
  down[id] = true;
  wall(g, id).active = false;
  g.stats.targets++;
  points(g, 3000);
  if (!bk.ids.every(x => down[x])) return;
  completeType(g, 'bank', bk.id);
  if (bk.opens) { openWalls(g, bk.opens); say(g, 'Cibles abattues : la porte s’ouvre !', 'big'); } else points(g, 20000, false);
  // Les cibles se relèvent un peu plus tard pour la suite.
  later(g, 2.5, () => { for (const x of bk.ids) { down[x] = false; wall(g, x).active = true; } });
}

// Machine à sous : 3 rouleaux ; après 4 essais ratés, le suivant gagne.
function spinSlot(g) {
  const pick = () => SLOT_SYMBOLS[Math.floor(g.rng() * SLOT_SYMBOLS.length)];
  let reels = [pick(), pick(), pick()];
  if (g.slotMiss >= 4) { reels = [reels[0], reels[0], reels[0]]; }
  g.slot = { reels, t: g.w.time };
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    g.slotMiss = 0;
    const won = points(g, reels[0] === '7' ? 250000 : 100000, false);
    say(g, `${reels.join(' ')}  JACKPOT +${fmt(won)}`, 'jackpot');
    g.fx.push({ kind: 'jackpot' });
    count(g, 'slotWin');
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    g.slotMiss++;
    say(g, `${reels.join(' ')}  +${fmt(points(g, 15000, false))}`, 'big');
  } else {
    g.slotMiss++;
    points(g, 3000);
    say(g, reels.join(' '), 'info');
  }
  g.fx.push({ kind: 'slot' });
}

function hitTarget(g, id) {
  const gr = groupOf(g, id);
  if (gr) return hitGroup(g, gr, id);
  if (id === 'slot') return spinSlot(g);
  if (id === 'treasure') {
    count(g, 'treasure');
    const won = points(g, 150000, false);
    say(g, `TRÉSOR ! +${fmt(won)}`, 'jackpot');
    g.fx.push({ kind: 'jackpot' });
    wall(g, 'treasure').active = false;
    openWalls(g, ['secret'], false);
    return;
  }
  points(g, 2000);
}

function rollover(g, id) {
  const i = +id[1] - 1;
  points(g, 1000, false);
  if (g.lanes[i]) return;
  g.lanes[i] = true;
  if (g.lanes.every(Boolean)) {
    g.lanes = [false, false, false];
    if (g.mult < 5) { g.mult++; say(g, `Multiplicateur ×${g.mult}`, 'big'); } else points(g, 25000, false);
  }
}

function ramp(g, id) {
  g.stats.ramps++;
  points(g, 10000);
  g.fx.push({ kind: 'ramp', ramp: id });
  if (!g.rampsDone[id]) {
    g.rampsDone[id] = true;
    if (Object.values(g.rampsDone).every(Boolean)) completeType(g, 'ramps');
  }
  if (g.multiball) {
    g.jackpotRamps++;
    if (g.jackpotRamps === 3) {
      say(g, 'SUPER JACKPOT allumé : vise le trou !', 'big');
      const main = mainSaucer(g);
      if (main.door) openWalls(g, [main.door]);
    } else if (g.jackpotRamps < 3) say(g, `Jackpot : rampe ${g.jackpotRamps}/3`, 'info');
  }
}

/* ---------- Trous : capture (multiball), roulette, piège ---------- */
const mainSaucer = g => g.w.saucers.find(s => s.role === 'lock' || s.role === 'roulette');

function addLock(g) {
  g.locks++;
  if (g.locks < 2) return say(g, 'Bille capturée : encore 1 pour le multiball', 'big');
  g.locks = 0;
  g.multiball = true;
  g.jackpotRamps = 0;
  say(g, 'MULTIBALL !', 'jackpot');
  g.fx.push({ kind: 'multiball' });
  completeType(g, 'multiball');
  points(g, 50000, false);
  // Deux billes de plus, lancées automatiquement depuis le couloir.
  for (let k = 0; k < 2; k++) later(g, 0.4 + k * 0.7, () => { const [x, y] = g.table.lane.start; addBall(g.w, x, y, 0, 470 + k * 20); });
  g.saveTimer = -6; // protection de 6 s en début de multiball
}

function saucer(g, b, s) {
  let hold = 1.2;
  if (s.role === 'trap') {
    hold = 0.9;
    if (g.mult > 1) say(g, 'PIÈGE ! Multiplicateur perdu', 'warn'); else say(g, 'Piège !', 'warn');
    g.mult = 1;
    g.fx.push({ kind: 'trap' });
  } else if (g.multiball && g.jackpotRamps >= 3) {
    g.jackpots++;
    const won = points(g, 250000, false);
    say(g, `SUPER JACKPOT +${fmt(won)}`, 'jackpot');
    g.fx.push({ kind: 'jackpot' });
    completeType(g, 'super');
    g.jackpotRamps = 0;
  } else if (s.role === 'roulette') {
    points(g, 10000);
    hold = 2;
    const prize = ROULETTE[Math.floor(g.rng() * ROULETTE.length)];
    g.fx.push({ kind: 'roulette' });
    later(g, 1.6, () => {
      say(g, `Roulette : ${prize.text}`, 'big');
      if (prize.points) points(g, prize.points, false);
      if (prize.mult) g.mult = Math.min(5, g.mult + 1);
      if (prize.save) g.saveTimer = -5;
      if (prize.lock && !g.multiball) addLock(g);
    });
  } else {
    points(g, 15000);
    if (!g.multiball) addLock(g);
  }
  g.heldTimers.push({ b, s, at: g.w.time + hold });
}

// Direction d'éjection : vers l'intérieur de la table selon la position du trou, jamais droit entre les flippers.
function eject(g, s) {
  const dir = g.rng() < 0.5 ? -1 : 1;
  if (s.x > 30) return [-110 - g.rng() * 40, -60];
  if (s.x < 16) return [90 + g.rng() * 30, 70];
  return [dir * 95, -110];
}

/* ---------- Commandes du joueur ---------- */
export function setFlipper(g, side, down) {
  const f = g.w.flippers.find(x => x.id === side);
  if (down && !f.pressed && !g.tilted) {
    // Les flippers font tourner les couloirs allumés du haut (on vise les couloirs éteints).
    g.lanes = side === 'L' ? [...g.lanes.slice(1), g.lanes[0]] : [g.lanes[2], ...g.lanes.slice(0, 2)];
    g.fx.push({ kind: 'flip', side });
  }
  f.pressed = down;
}
export const plunge = (g, power) => launch(g.w, power);
export function shake(g) {
  if (g.tilted || g.over) return;
  nudge(g.w, g.rng() < 0.5 ? -1 : 1, g.rng);
  g.tilt += 1;
  g.fx.push({ kind: 'shake' });
  if (g.tilt > TILT_LIMIT) {
    g.tilted = true;
    g.w.flippersDead = true;
    say(g, 'TILT !', 'tilt');
  } else if (g.tilt > TILT_LIMIT - 1.2) say(g, 'Attention !', 'warn');
}
export const ballReady = g => g.w.balls.some(b => inLane(g.w, b) && Math.hypot(b.vx, b.vy) < 30);

/* ---------- Une image ---------- */
// Rythme de la table : tout le temps de jeu (bille, flippers, gravité, minuteries) tourne à 72 % du temps réel.
// Les trajectoires restent les mêmes, la bille va juste moins vite à l'écran.
export const PACE = 0.72;
export function update(g, dt) {
  if (g.over) return;
  dt *= PACE;
  step(g.w, dt);
  g.comboTimer = Math.max(0, g.comboTimer - dt);
  if (!g.comboTimer) g.combo = 0;
  g.tilt = Math.max(0, g.tilt - dt * 0.35);
  g.spin = Math.max(0, g.spin - dt * 6);
  for (const m of g.messages) m.t += dt;
  g.messages = g.messages.filter(m => m.t < 2.6);
  // Protection : le compte démarre quand la bille quitte le couloir.
  if (g.w.balls.some(b => !inLane(g.w, b))) g.saveTimer += dt;
  for (const h of g.heldTimers) {
    if (g.w.time < h.at) continue;
    releaseHeld(g.w, h.b, ...eject(g, h.s));
    h.done = true;
    // La porte se referme une fois la bille sortie de la poche (sinon elle resterait enfermée).
    if (h.s.door) later(g, 0.7, () => { if (!g.heldTimers.length && !(g.multiball && g.jackpotRamps >= 3)) openWalls(g, [h.s.door], false); });
  }
  g.heldTimers = g.heldTimers.filter(h => !h.done);
  const due = g.later.filter(x => g.w.time >= x.at);
  g.later = g.later.filter(x => g.w.time < x.at);
  for (const x of due) x.fn();
  for (const b of g.w.balls) if (b.still > 3) { unstick(g.w, b, g.rng); say(g, 'Recherche de bille…', 'info'); }

  for (const e of g.w.events) handle(g, e);
  g.w.events.length = 0;
}

function handle(g, e) {
  const o = e.obj;
  if (e.type === 'hit') {
    if (o.kind === 'bumper') { g.stats.bumpers++; points(g, 1000, false); g.fx.push({ kind: 'bumper', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'sling') { points(g, 500, false); g.fx.push({ kind: 'sling', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'drop') { hitDrop(g, bankOf(g, o.id), o.id); g.fx.push({ kind: 'drop', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'target') { hitTarget(g, o.id); g.fx.push({ kind: 'target', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'mover') { points(g, 2500); g.fx.push({ kind: 'mover', obj: o, x: e.x, y: e.y }); }
    else if (e.speed > 60) g.fx.push({ kind: 'spark', x: e.x, y: e.y, speed: e.speed, metal: !o.id || o.kind === 'door' });
    if ((o.kind === 'door' || o.kind === 'secret') && e.speed > 20) g.fx.push({ kind: 'thud', x: e.x, y: e.y });
  } else if (e.type === 'clack') g.fx.push({ kind: 'spark', x: e.x, y: e.y, speed: e.speed, metal: true });
  else if (e.type === 'trigger') {
    if (o.kind === 'rollover') { rollover(g, o.id); g.fx.push({ kind: 'rollover', obj: o }); }
    if (o.kind === 'spinner') {
      const turns = Math.round(Math.min(30, e.speed / 18));
      g.spin += turns;
      g.stats.spins += turns;
      points(g, 200 * turns, turns >= 4);
      g.fx.push({ kind: 'spinner', turns });
    }
    if (o.kind === 'orbit' && e.forward) { points(g, 5000); g.fx.push({ kind: 'orbit' }); }
    if (o.kind === 'secret' && e.forward && g.open.secret) {
      count(g, 'secret');
      points(g, 50000, false);
      say(g, 'Passage secret ! Un trésor apparaît…', 'big');
      wall(g, 'treasure').active = true;
      g.fx.push({ kind: 'secret' });
    }
  } else if (e.type === 'portal') { count(g, 'portal'); points(g, 7500); g.fx.push({ kind: 'portal', obj: o, x: e.x, y: e.y }); }
  else if (e.type === 'field') {
    if (o.kind === 'jet') { count(g, 'jet'); points(g, 2500); g.fx.push({ kind: 'jet', obj: o, x: e.x, y: e.y }); }
    if (o.kind === 'repel') { count(g, 'burn'); g.combo = 0; g.comboTimer = 0; g.fx.push({ kind: 'burn', obj: o, x: e.x, y: e.y }); }
  } else if (e.type === 'rampIn') g.fx.push({ kind: 'rampIn', ramp: e.ramp });
  else if (e.type === 'ramp') ramp(g, e.ramp);
  else if (e.type === 'rampFail') g.fx.push({ kind: 'rampFail' });
  else if (e.type === 'saucer') { saucer(g, e.ball, o); g.fx.push({ kind: 'saucer', obj: o }); }
  else if (e.type === 'launch') g.fx.push({ kind: 'launch', power: e.power });
  else if (e.type === 'drain') drain(g);
}

function drain(g) {
  g.fx.push({ kind: 'drain' });
  if (g.w.balls.length) {
    if (g.multiball && g.w.balls.filter(b => !b.held).length <= 1 && !g.heldTimers.length) { g.multiball = false; say(g, 'Fin du multiball', 'info'); }
    return;
  }
  // Protection de début de bille : on la rend.
  if (!g.tilted && g.saveTimer < BALL_SAVE) {
    say(g, 'Bille sauvée !', 'big');
    serveBall(g);
    g.saveTimer = BALL_SAVE; // une seule fois
    return;
  }
  // Fin de bille : décompte du bonus, puis bille suivante ou fin de partie.
  const bonus = g.tilted ? 0 : Math.round(g.ballScore * 0.05 / 10) * 10;
  if (bonus) { g.score += bonus; say(g, `Bonus de fin de bille +${fmt(bonus)}`, 'mission'); }
  g.multiball = false;
  g.mult = 1;
  g.tilted = false;
  g.w.flippersDead = false;
  g.tilt = 0;
  g.ballScore = 0;
  g.combo = 0;
  if (g.ball >= g.balls) {
    g.over = true;
    g.endedAt = Date.now();
    return;
  }
  g.ball++;
  say(g, `Bille ${g.ball}`, 'big');
  serveBall(g);
}

// Progression d'une mission, affichée pendant la partie.
export function progress(g, m) {
  if (m.type === 'group') {
    const gr = g.table.groups.find(x => x.id === m.ref), st = g.groups[gr.id];
    const lit = gr.ordered ? st.step : gr.ids.filter(x => st.hits[x] === (gr.hits || 1)).length;
    return `${lit}/${gr.ids.length}`;
  }
  if (m.type === 'bank') { const bk = g.table.banks.find(x => x.id === m.ref); return `${bk.ids.filter(x => g.banks[bk.id][x]).length}/${bk.ids.length}`; }
  if (m.type === 'ramps') return `${Object.values(g.rampsDone).filter(Boolean).length}/${g.table.ramps.length}`;
  if (m.type === 'combo') return `meilleur ×${g.bestCombo}`;
  if (m.type === 'multiball') return g.multiball ? 'en cours !' : `${g.locks}/2`;
  if (m.type === 'score') return `${Math.min(100, Math.floor((g.score / m.n) * 100))} %`;
  if (m.type === 'count') return `${Math.min(m.n, g.counts[m.ref] || 0)}/${m.n}`;
  if (m.type === 'super') return g.multiball ? `${Math.min(3, g.jackpotRamps)}/3 rampes` : 'en multiball';
  return '';
}

// État des lumières de la table : 0 éteinte, 1 allumée, 2 clignotante.
export function lights(g) {
  const L = {};
  ['L1', 'L2', 'L3'].forEach((id, i) => (L[id] = g.lanes[i] ? 1 : 0));
  for (const gr of g.table.groups) {
    const st = g.groups[gr.id], n = gr.hits || 1;
    gr.ids.forEach((id, i) => {
      const h = st.hits[id] || 0;
      L[id] = gr.ordered ? (i < st.step ? 1 : i === st.step && h ? 2 : 0) : h === n ? 1 : h ? 2 : 0;
    });
  }
  for (const bk of g.table.banks) for (const id of bk.ids) L[id] = g.banks[bk.id][id] ? 0 : 1;
  const needRamps = !g.missions.ramps || g.multiball;
  for (const r of g.table.ramps) L[`ramp:${r.id}`] = g.multiball ? 2 : needRamps && !g.rampsDone[r.id] ? 1 : 0;
  L.door = g.open.door ? 2 : 0;
  L.lock = g.multiball ? (g.jackpotRamps >= 3 ? 2 : 0) : g.locks ? 2 : 1;
  L.secret = g.open.secret ? 2 : 0;
  L.trap = 1;
  L.slot = g.slot && g.w.time - g.slot.t < 1.5 ? 2 : 1;
  for (let k = 2; k <= 5; k++) L[`x${k}`] = g.mult >= k ? 1 : 0;
  L.jackpot = g.multiball ? (g.jackpotRamps >= 3 ? 2 : 1) : 0;
  L.save = g.saveTimer < BALL_SAVE && !g.over ? (g.saveTimer > BALL_SAVE - 3 ? 2 : 1) : 0;
  return L;
}
