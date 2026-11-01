// Tests du flipper : la bille ne sort jamais de la table, les flippers tirent, les rampes se montent,
// les règles (missions, multiball, tilt, protection, fin de partie) s'enchaînent.
import assert from 'node:assert';
import { createWorld, addBall, step, launch, R } from './public/pinball/physics.js';
import { createGame, update, setFlipper, plunge, shake, PACE } from './public/pinball/game.js';
// Les tests avancent en temps de table : 1/60 s de jeu par image, quel que soit le ralenti d'affichage.
import { TABLES } from './public/pinball/tables.js';

const table = TABLES[0];
let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const inside = b => b.x > -0.5 && b.x < 52.5 && b.y < 111 && !Number.isNaN(b.x);

// Lancement : la bille remonte le couloir et entre dans l'aire de jeu.
{
  const w = createWorld(table);
  addBall(w, ...table.lane.start);
  for (let i = 0; i < 30; i++) step(w, 1 / 60);
  assert(launch(w, 1));
  let enteredPlayfield = false;
  for (let i = 0; i < 240; i++) { step(w, 1 / 60); if (w.balls[0]?.x < 44) enteredPlayfield = true; }
  assert(enteredPlayfield, 'la bille lancée doit entrer dans l’aire de jeu');
}

// Tir du flipper gauche : une bille posée dessus part haut vers l'autre côté.
{
  const w = createWorld(table);
  const f = w.flippers[0];
  // Bille posée sur le flipper au repos, à 4 cm du pivot, et on appuie aussitôt.
  const d = 4, nx = Math.sin(-f.rest), ny = Math.cos(f.rest);
  const b = addBall(w, f.x + d * Math.cos(f.rest) + nx * 2.2, f.y + d * Math.sin(f.rest) + ny * 2.2, 0, 0);
  f.pressed = true;
  let top = 0, fast = 0;
  for (let i = 0; i < 90; i++) { step(w, 1 / 60); top = Math.max(top, b.y); fast = Math.max(fast, Math.hypot(b.vx, b.vy)); }
  assert(top > 45 && fast > 300 && fast <= 540, `tir du flipper : ${fast.toFixed(0)} cm/s, jusqu’à ${top.toFixed(1)} cm`);
}

// Une bille qui roule contre un bord ne doit pas s'y freiner : sur la pente du tablier, elle accélère.
{
  const w = createWorld(table);
  const b = addBall(w, 3, 26.5, 0, 0);
  for (let i = 0; i < 18; i++) step(w, 1 / 60);
  assert(Math.hypot(b.vx, b.vy) > 50, `bille freinée contre le tablier : ${Math.hypot(b.vx, b.vy).toFixed(0)} cm/s`);
}

// Rampe : une bille rapide dans l'embouchure fait tout le tour ; une bille lente redescend.
for (const [speed, done] of [[420, true], [120, false]]) {
  const w = createWorld(table);
  addBall(w, 4.4, 62, 0, speed);
  const ev = [];
  for (let i = 0; i < 300; i++) { step(w, 1 / 60); ev.push(...w.events.map(e => e.type)); w.events.length = 0; }
  assert.strictEqual(ev.includes('ramp'), done, `rampe à ${speed} cm/s`);
  if (!done) assert(ev.includes('rampFail'));
}

// Longue partie automatique sur chaque table : un robot appuie sur les flippers quand une bille arrive dessus.
for (const t of TABLES) {
  const g = createGame(t, rng);
  const counts = {};
  let maxBalls = 0, stuck = 0;
  for (let frame = 0; frame < 60 * 240 && !g.over; frame++) {
    if (frame % 90 === 0) plunge(g, 0.75 + rng() * 0.25);
    for (const f of g.w.flippers) setFlipper(g, f.id, g.w.balls.some(b => !b.ramp && Math.hypot(b.x - f.x, b.y - f.y) < 9 && b.vy < -15));
    update(g, 1 / 60 / PACE);
    for (const fx of g.fx) counts[fx.kind] = (counts[fx.kind] || 0) + 1;
    g.fx.length = 0;
    maxBalls = Math.max(maxBalls, g.w.balls.length);
    for (const b of g.w.balls) assert(inside(b), `${t.id} : bille hors de la table en (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
    stuck += g.messages.some(m => m.t === 0 && m.text.startsWith('Recherche'));
  }
  console.log(`  ${t.id.padEnd(7)} score ${g.score.toLocaleString('fr-FR').padStart(11)} · missions ${Object.entries(g.missions).filter(m => m[1]).map(m => m[0]).join(', ') || 'aucune'} · billes max ${maxBalls} · décoinçages ${stuck}`);
  assert(counts.bumper > 3, `${t.id} : les bumpers doivent être touchés`);
  assert(counts.ramp > 0, `${t.id} : au moins une rampe réussie`);
  assert(g.score > 10000);
  assert(stuck < 15, `${t.id} : la bille se coince trop souvent (${stuck})`);
}

// Règles : drop targets -> porte ouverte -> 2 captures -> multiball (3 billes), puis super jackpot.
{
  const g = createGame(table, rng);
  const fire = (type, obj, extra = {}) => { g.w.events.push({ type, obj, ball: g.w.balls[0], speed: 100, x: 0, y: 0, ...extra }); update(g, 1 / 60 / PACE); };
  for (const id of ['D1', 'D2', 'D3']) fire('hit', g.w.walls.find(s => s.id === id));
  assert(g.missions.drops && g.open.door && g.w.saucers[0].active);
  // Deux captures dans le trou : la bille entre dans la poche, elle est capturée puis rendue, la porte se referme
  let maxB = 0;
  for (let k = 0; k < 2; k++) {
    const b0 = g.w.balls[0];
    assert(g.open.door, 'porte ouverte avant la capture');
    Object.assign(b0, { x: 23, y: 60.5, vx: 0, vy: 40, held: false });
    for (let i = 0; i < 6; i++) update(g, 1 / 60 / PACE);
    assert(k === 1 || b0.held, 'bille capturée');
    for (let i = 0; i < 130; i++) { update(g, 1 / 60 / PACE); maxB = Math.max(maxB, g.w.balls.length); }
    assert(!b0.held && !(b0.x > 20 && b0.x < 26 && b0.y > 58 && b0.y < 65), 'bille rendue hors de la poche');
    if (k === 0) { assert(!g.open.door, 'porte refermée'); for (let i = 0; i < 120; i++) update(g, 1 / 60 / PACE); for (const id of ['D1', 'D2', 'D3']) fire('hit', g.w.walls.find(s => s.id === id)); }
  }
  assert(g.multiball && g.missions.multiball);
  assert(maxB >= 3, `multiball : ${maxB} billes`);
  for (let k = 0; k < 3; k++) { g.w.events.push({ type: 'ramp', ramp: k % 2 ? 'left' : 'right', ball: g.w.balls[0] }); update(g, 1 / 60 / PACE); }
  assert(g.missions.ramps && g.open.door, 'super jackpot allumé : porte rouverte');
  fire('saucer', g.w.saucers[0]);
  assert(g.missions.super && g.jackpots === 1);
  // A-R-C dans l'ordre (2 coups chacune) ; une cible hors de son tour ne s'allume pas
  const target = id => g.w.walls.find(s => s.id === id);
  fire('hit', target('C')); fire('hit', target('C'));
  assert.strictEqual(g.groups.arc.step, 0);
  for (const id of ['A', 'A', 'R', 'R', 'C', 'C']) fire('hit', target(id));
  assert(g.missions.arc);
}

// Mécanismes propres aux autres tables
const byId = id => TABLES.find(t => t.id === id);
const fireOn = g => (type, obj, extra = {}) => { g.w.events.push({ type, obj, ball: g.w.balls[0], speed: 100, x: 0, y: 0, ...extra }); update(g, 1 / 60 / PACE); };
{
  // Espace : un portail téléporte la bille ; le trou noir l'aspire et la capture (2 fois = multiball).
  const g = createGame(byId('space'), rng);
  const b = g.w.balls[0];
  const p = g.w.portals[0];
  Object.assign(b, { x: p.x, y: p.y - 3, vx: 0, vy: 200 }); // tirée vers le haut
  for (let i = 0; i < 4; i++) update(g, 1 / 60 / PACE);
  assert(b.y > 88 && g.counts.portal === 1, `portail : bille en (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
  for (let k = 0; k < 2; k++) {
    const ball = g.w.balls.find(x => !x.held);
    Object.assign(ball, { x: 33, y: 52, vx: 0, vy: 0, escape: false });
    let caught = false;
    for (let i = 0; i < 90 && !caught; i++) { update(g, 1 / 60 / PACE); caught = ball.held; }
    assert(caught, 'le trou noir aspire la bille');
    for (let i = 0; i < 100; i++) update(g, 1 / 60 / PACE);
  }
  assert(g.missions.multiball, 'multiball cosmique');
}
{
  // Casino : la machine à sous finit par aligner 3 symboles ; la roulette donne un prix.
  const g = createGame(byId('casino'), rng);
  const fire = fireOn(g), slot = g.w.walls.find(s => s.id === 'slot');
  for (let i = 0; i < 6 && !g.missions.slots; i++) fire('hit', slot);
  assert(g.missions.slots, 'machine à sous gagnante au plus tard au 5e essai');
  const before = g.score;
  Object.assign(g.w.balls[0], { x: 23, y: 61, vx: 0, vy: 0 });
  for (let i = 0; i < 200; i++) update(g, 1 / 60 / PACE);
  assert(g.score > before && g.messages.length + 1, 'roulette');
}
{
  // Jungle : T-I-K-I ouvre le passage secret, qui fait surgir le trésor ; le piège coûte le multiplicateur.
  const g = createGame(byId('jungle'), rng);
  const fire = fireOn(g), w = id => g.w.walls.find(s => s.id === id);
  for (const id of ['T1', 'T2', 'T3', 'T4']) fire('hit', w(id));
  assert(g.missions.tiki && g.open.secret && !w('secret').active, 'passage secret ouvert');
  fire('trigger', g.w.triggers.find(t => t.id === 'secretPass'), { forward: true });
  assert(g.missions.secret && w('treasure').active, 'trésor sorti');
  fire('hit', w('treasure'));
  assert(g.missions.treasure && !w('treasure').active && !g.open.secret, 'trésor pris, passage refermé');
  g.mult = 3;
  const trap = g.w.saucers.find(s => s.role === 'trap'), b = g.w.balls[0];
  Object.assign(b, { x: trap.x, y: trap.y + 0.5, vx: 0, vy: -20, escape: false });
  for (let i = 0; i < 5; i++) update(g, 1 / 60 / PACE);
  assert.strictEqual(g.mult, 1, 'le piège fait perdre le multiplicateur');
}
{
  // Volcan : un jet de vapeur propulse la bille vers le haut ; la lave la repousse.
  const g = createGame(byId('volcan'), rng);
  const jet = g.w.fields.find(f => f.id === 'jet1'), b = g.w.balls[0];
  g.w.time = 0.1; // jet allumé
  Object.assign(b, { x: jet.x, y: jet.y, vx: 0, vy: 0 });
  let up = 0;
  for (let i = 0; i < 10; i++) { update(g, 1 / 60 / PACE); up = Math.max(up, b.vy); }
  assert(up > 220 && g.counts.jet >= 1, `jet de vapeur : ${up.toFixed(0)} cm/s`);
  const lava = g.w.fields.find(f => f.kind === 'repel');
  Object.assign(b, { x: lava.x + 1, y: lava.y, vx: 0, vy: 0 });
  for (let i = 0; i < 6; i++) update(g, 1 / 60 / PACE);
  assert(b.x > lava.x + 1.5 && g.counts.burn >= 1, 'la lave repousse la bille');
}

// Tilt : trop de secousses bloquent les flippers ; protection : la bille perdue tôt est rendue.
{
  const g = createGame(table, rng);
  for (let i = 0; i < 5; i++) shake(g);
  assert(g.tilted && g.w.flippersDead);
  const g2 = createGame(table, rng);
  plunge(g2, 1);
  for (let i = 0; i < 30; i++) update(g2, 1 / 60 / PACE);
  g2.w.balls[0].y = -5; // perdue tout de suite
  update(g2, 1 / 60 / PACE);
  assert.strictEqual(g2.ball, 1);
  assert.strictEqual(g2.w.balls.length, 1, 'bille sauvée');
  // Trois billes perdues hors protection : fin de partie
  g2.saveTimer = 99;
  for (let k = 0; k < 3; k++) { g2.saveTimer = 99; g2.w.balls.forEach(b => (b.y = -5)); update(g2, 1 / 60 / PACE); }
  assert(g2.over);
}
console.log('Tests du flipper : OK');
