// Règles d'une partie : score, multiplicateur, combos, missions, multiball, jackpots, tilt, billes.
// Reçoit les événements de la physique ; ne dessine rien (testée par test-pinball.mjs).
import { createWorld, addBall, step, launch, nudge, releaseHeld, unstick, inLane } from './physics.js';

const COMBO_WINDOW = 3; // secondes pour enchaîner deux actions
const BALL_SAVE = 10; // secondes de protection au début de chaque bille
const TILT_LIMIT = 3.2;

export function createGame(table, rng = Math.random) {
  const w = createWorld(table);
  const g = {
    table, w, rng,
    score: 0, ball: 1, balls: 3, mult: 1,
    combo: 0, comboTimer: 0, bestCombo: 0,
    lanes: [false, false, false],
    arc: { step: 0, hits: { A: 0, R: 0, C: 0 } },
    drops: { D1: false, D2: false, D3: false },
    rampsDone: { left: false, right: false },
    locks: 0, multiball: false, jackpotRamps: 0, jackpots: 0,
    missions: Object.fromEntries(table.missions.map(m => [m.id, false])),
    tilt: 0, tilted: false, saveTimer: 0, over: false,
    spin: 0, // tours de spinner à afficher
    messages: [], // { text, kind, t } pour l'écran
    fx: [], // effets visuels demandés au rendu : { kind, x, y, obj }
    ballScore: 0, stats: { bumpers: 0, ramps: 0, targets: 0, spins: 0 },
    startedAt: Date.now(), heldTimers: [], later: [], // actions différées, en temps de jeu (figées pendant la pause)
  };
  serveBall(g);
  return g;
}

const say = (g, text, kind = 'info') => g.messages.push({ text, kind, t: 0 });
const later = (g, s, fn) => g.later.push({ at: g.w.time + s, fn });

function serveBall(g) {
  const [x, y] = g.table.lane.start;
  addBall(g.w, x, y);
  g.saveTimer = 0; // la protection démarre au lancement
}

// Points gagnés : multipliés par le multiplicateur courant ; « action » compte pour les combos.
function points(g, n, action = true) {
  const won = n * g.mult;
  g.score += won;
  g.ballScore += won;
  if (action) {
    g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
    g.comboTimer = COMBO_WINDOW;
    if (g.combo > g.bestCombo) g.bestCombo = g.combo;
    if (g.combo >= 3) say(g, `Combo ×${g.combo}`, 'combo');
    if (g.combo >= 5) completeMission(g, 'combo');
  }
  if (g.score >= 1000000) completeMission(g, 'million');
  return won;
}

function completeMission(g, id) {
  if (g.missions[id] === undefined || g.missions[id]) return;
  g.missions[id] = true;
  const m = g.table.missions.find(x => x.id === id);
  g.score += m.bonus * g.mult;
  say(g, `Mission réussie : ${m.name} (+${(m.bonus * g.mult).toLocaleString('fr-FR')})`, 'mission');
  g.fx.push({ kind: 'mission' });
  if (!m.final) g.mult = Math.min(5, g.mult + 1); // chaque mission fait monter le multiplicateur
}

function lightDrop(g, id) {
  if (g.drops[id]) return;
  g.drops[id] = true;
  const obj = g.w.walls.find(s => s.id === id);
  obj.active = false;
  g.stats.targets++;
  points(g, 3000);
  if (Object.values(g.drops).every(Boolean)) {
    say(g, 'Cibles abattues : la porte s’ouvre !', 'big');
    completeMission(g, 'drops');
    openDoor(g, true);
    // Les cibles se relèvent un peu plus tard pour la suite.
    later(g, 2.5, () => {
      for (const k of Object.keys(g.drops)) { g.drops[k] = false; g.w.walls.find(s => s.id === k).active = true; }
    });
  }
}
function openDoor(g, open) {
  g.w.walls.find(s => s.id === 'door').active = !open;
  g.w.saucers[0].active = open;
  g.doorOpen = open;
}

function hitTarget(g, id) {
  const h = g.arc.hits;
  h[id] = Math.min(2, h[id] + 1);
  g.stats.targets++;
  points(g, h[id] === 2 ? 5000 : 1500);
  const order = ['A', 'R', 'C'];
  // L'ordre compte : une cible allumée hors de son tour est remise à un coup.
  if (h[id] === 2) {
    if (order[g.arc.step] === id) {
      g.arc.step++;
      say(g, `${order.slice(0, g.arc.step).join('-')} allumé`, 'info');
      if (g.arc.step === 3) {
        completeMission(g, 'arc');
        g.arc = { step: 0, hits: { A: 0, R: 0, C: 0 } };
      }
    } else if (order.indexOf(id) > g.arc.step) h[id] = 1;
  }
}

function rollover(g, id) {
  const i = +id[1] - 1;
  points(g, 1000);
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
    if (g.rampsDone.left && g.rampsDone.right) completeMission(g, 'ramps');
  }
  if (g.multiball) {
    g.jackpotRamps++;
    if (g.jackpotRamps === 3) { say(g, 'SUPER JACKPOT allumé : vise le trou !', 'big'); openDoor(g, true); }
    else if (g.jackpotRamps < 3) say(g, `Jackpot : rampe ${g.jackpotRamps}/3`, 'info');
  }
}

function saucer(g, b) {
  points(g, 15000);
  const t0 = g.w.time;
  if (g.multiball && g.jackpotRamps >= 3) {
    g.jackpots++;
    const won = points(g, 250000, false);
    say(g, `SUPER JACKPOT +${won.toLocaleString('fr-FR')}`, 'jackpot');
    g.fx.push({ kind: 'jackpot' });
    completeMission(g, 'super');
    g.jackpotRamps = 0;
  } else if (!g.multiball) {
    g.locks++;
    if (g.locks >= 2) {
      g.locks = 0;
      g.multiball = true;
      g.jackpotRamps = 0;
      say(g, 'MULTIBALL !', 'jackpot');
      g.fx.push({ kind: 'multiball' });
      completeMission(g, 'multiball');
      points(g, 50000, false);
      // Deux billes de plus, lancées automatiquement depuis le couloir.
      for (let k = 0; k < 2; k++) {
        later(g, 0.4 + k * 0.7, () => { const [x, y] = g.table.lane.start; addBall(g.w, x, y, 0, 470 + k * 20); });
      }
      g.saveTimer = -6; // protection de 6 s en début de multiball
    } else say(g, 'Bille capturée : encore 1 pour le multiball', 'big');
  }
  // Le trou rend la bille vers un flipper, un peu plus tard.
  g.heldTimers.push({ b, at: t0 + 1.2 });
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
export function update(g, dt) {
  if (g.over) return;
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
    if (g.w.time >= h.at) {
      const dir = g.rng() < 0.5 ? -1 : 1;
      releaseHeld(g.w, h.b, dir * 95, -110); // éjectée vers un côté, pas droit entre les flippers
      h.done = true;
      // La porte se referme une fois la bille sortie de la poche (sinon elle resterait enfermée).
      later(g, 0.7, () => { if (!g.heldTimers.length && !(g.multiball && g.jackpotRamps >= 3)) openDoor(g, false); });
    }
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
    if (o.kind === 'bumper') { g.stats.bumpers++; points(g, 1000); g.fx.push({ kind: 'bumper', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'sling') { points(g, 500); g.fx.push({ kind: 'sling', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'drop') { lightDrop(g, o.id); g.fx.push({ kind: 'drop', obj: o, x: e.x, y: e.y }); }
    else if (o.kind === 'target') { hitTarget(g, o.id); g.fx.push({ kind: 'target', obj: o, x: e.x, y: e.y }); }
    else if (e.speed > 60) g.fx.push({ kind: 'spark', x: e.x, y: e.y, speed: e.speed, metal: !o.id || o.kind === 'door' });
    if (o.kind === 'door' && e.speed > 20) g.fx.push({ kind: 'thud', x: e.x, y: e.y });
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
  } else if (e.type === 'rampIn') g.fx.push({ kind: 'rampIn', ramp: e.ramp });
  else if (e.type === 'ramp') ramp(g, e.ramp);
  else if (e.type === 'rampFail') g.fx.push({ kind: 'rampFail' });
  else if (e.type === 'saucer') { saucer(g, e.ball); g.fx.push({ kind: 'saucer' }); }
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
  if (bonus) { g.score += bonus; say(g, `Bonus de fin de bille +${bonus.toLocaleString('fr-FR')}`, 'mission'); }
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

// État des lumières de la table : 0 éteinte, 1 allumée, 2 clignotante.
export function lights(g) {
  const L = {};
  ['L1', 'L2', 'L3'].forEach((id, i) => (L[id] = g.lanes[i] ? 1 : 0));
  const order = ['A', 'R', 'C'];
  for (const [i, id] of order.entries()) L[id] = i < g.arc.step ? 1 : i === g.arc.step ? (g.arc.hits[id] ? 2 : 0) : 0;
  for (const id of ['D1', 'D2', 'D3']) L[id] = g.drops[id] ? 0 : 1;
  const needRamps = !g.missions.ramps || g.multiball;
  L.rampL = g.multiball ? 2 : needRamps && !g.rampsDone.left ? 1 : 0;
  L.rampR = g.multiball ? 2 : needRamps && !g.rampsDone.right ? 1 : 0;
  L.door = g.doorOpen ? 2 : 0;
  for (let k = 2; k <= 5; k++) L[`x${k}`] = g.mult >= k ? 1 : 0;
  L.jackpot = g.multiball ? (g.jackpotRamps >= 3 ? 2 : 1) : 0;
  L.save = g.saveTimer < BALL_SAVE && !g.over ? (g.saveTimer > BALL_SAVE - 3 ? 2 : 1) : 0;
  return L;
}
