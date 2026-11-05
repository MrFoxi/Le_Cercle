// Tests de Top Formula : circuits bien formés, robots qui bouclent la course, tours de contre-la-montre,
// salon multijoueur (prêts, départ, arrivées, classement) et classement mondial.
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { TRACKS, buildTrack, gridSlot, flyingSlot } from './client/tracks.js';
import { createCar, stepCar, collideCars, aero, CAR } from './client/physics.js';
import { LEVELS, createBrain, drive } from './client/ai.js';

const require = createRequire(import.meta.url);
const { Room, MIN_LAP } = require('./server/game.js');
const api = require('./server/api.js');

let seed = 5;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Les circuits du jeu et ceux du serveur sont les mêmes.
assert.deepStrictEqual(Object.keys(MIN_LAP).sort(), TRACKS.map(t => t.id).sort());

for (const def of TRACKS) {
  const t = buildTrack(def);
  // Les couloirs (murs compris) de deux parties éloignées du tracé ne se chevauchent pas.
  const wide = k => Math.max(t.wl[k], t.wr[k]);
  for (let i = 0; i < t.N; i += 3) for (let j = i + 3; j < t.N; j += 3) {
    if (Math.min(j - i, t.N - j + i) * t.ds < 80) continue;
    assert(Math.hypot(t.x[i] - t.x[j], t.y[i] - t.y[j]) > wide(i) + wide(j) + 2, `${def.id} : couloirs qui se chevauchent vers ${i} / ${j}`);
  }
  assert(t.drs.length >= 1, `${def.id} : au moins une zone DRS`);
  // Grille : toutes les places sur la piste, derrière la ligne, sans se toucher.
  const slots = Array.from({ length: 10 }, (_, k) => gridSlot(t, k));
  for (const [k, s] of slots.entries()) {
    assert(createCar(t, s).s < 0, 'place derrière la ligne');
    for (const o of slots.slice(k + 1)) assert(Math.hypot(s.x - o.x, s.y - o.y) > 5, 'places de grille séparées');
  }

  // Course de 8 robots experts sur 2 tours : tout le monde finit, sans tour impossible.
  const cars = slots.slice(0, 8).map((s, k) => createCar(t, s, { brain: createBrain(LEVELS[4], rng), id: k }));
  let time = 0;
  while (time < 300 && cars.some(c => c.finished == null)) {
    aero(cars, t, true);
    for (const c of cars) stepCar(c, drive(c, c.brain, t, cars, 1 / 120), t, 1 / 120, time);
    collideCars(cars);
    for (const c of cars) { c.events.length = 0; if (c.finished == null && c.lap > 2) c.finished = time; }
    time += 1 / 120;
  }
  for (const c of cars) {
    assert(c.finished != null, `${def.id} : le robot ${c.id} doit finir`);
    assert(c.best > MIN_LAP[def.id] * 1.15, `${def.id} : tour de ${c.best.toFixed(1)} s trop proche du minimum serveur`);
  }
}

// Conduite : la voiture accélère, plafonne à sa vitesse de pointe, tourne sans pivoter sur place.
{
  const t = buildTrack(TRACKS[1]), c = createCar(t, gridSlot(t, 0));
  let top = 0; // ligne droite du départ, puis le mur de la chicane
  for (let k = 0; k < 120 * 12; k++) { stepCar(c, { throttle: 1 }, t, 1 / 120, k / 120); c.events.length = 0; top = Math.max(top, c.speed); }
  assert(top > CAR.vmax * 0.8 && top < CAR.vmax * 1.01, `vitesse de pointe ${top.toFixed(1)}`);
  assert(c.speed < top * 0.5, 'le mur arrête la voiture');
  const still = createCar(t, gridSlot(t, 0)), a0 = still.a;
  for (let k = 0; k < 120; k++) stepCar(still, { steer: 1 }, t, 1 / 120, 0);
  assert.strictEqual(still.a, a0, 'à l’arrêt, braquer ne fait pas tourner la voiture');
}

// Contre-la-montre : le chrono du tour part sur la ligne (tour lancé).
{
  const t = buildTrack(TRACKS[0]), c = createCar(t, gridSlot(t, 0), { flying: true, brain: createBrain(LEVELS[4], rng) });
  let time = 0;
  while (c.lapTimes.length < 2 && time < 200) { stepCar(c, drive(c, c.brain, t, [c], 1 / 120), t, 1 / 120, time); c.events.length = 0; time += 1 / 120; }
  assert(c.lapTimes[0] < 60 && Math.abs(c.lapTimes[0] - c.lapTimes[1]) < 4, `tours lancés ${c.lapTimes.map(x => x.toFixed(1))}`);
}

// Salon : prêts, départ, arrivées vérifiées, classement, victoire comptée.
{
  let now = 1000;
  const r = new Room('ABCDE', rng, false, () => now);
  r.addPlayer('Ana'); r.addPlayer('Bob'); r.addPlayer('Cy');
  assert.throws(() => r.start('Bob'), /créateur/);
  assert.throws(() => r.start('Ana'), /Pas encore prêt/);
  r.ready('Bob', true); r.ready('Cy', true);
  r.configure('Ana', 'laps', 2);
  assert.throws(() => r.configure('Ana', 'laps', 4), /invalide/);
  r.start('Ana');
  assert.strictEqual(r.phase, 'race');
  assert.deepStrictEqual([...r.grid].sort(), ['Ana', 'Bob', 'Cy']);
  assert.throws(() => r.addPlayer('Dan'), /Course en cours/);
  now = r.startAt + 100000;
  assert.throws(() => r.finish('Ana', 20000, 10000), /invalide/); // trop rapide pour 2 tours
  r.finish('Ana', 95000, 46000);
  assert.throws(() => r.finish('Ana', 95000, 46000), /déjà/);
  r.track('Cy', 1500);
  r.track('Bob', 2000);
  assert.strictEqual(r.phase, 'race');
  now += 46000; r.timeout(); // 45 s après la première arrivée
  assert.strictEqual(r.phase, 'results');
  assert.deepStrictEqual(r.results.map(x => x.name), ['Ana', 'Bob', 'Cy']);
  assert.strictEqual(r.viewFor('Bob').players.find(p => p.name === 'Ana').wins, 1);
  // Revanche : le vainqueur part dernier.
  r.ready('Bob', true); r.ready('Cy', true);
  r.start('Ana');
  assert.strictEqual(r.grid.at(-1), 'Ana');
  // Tout le monde arrivé : fin immédiate.
  now = r.startAt + 120000;
  for (const n of ['Ana', 'Bob', 'Cy']) r.finish(n, 100000 + n.length, 48000);
  assert.strictEqual(r.phase, 'results');
}

// Classement mondial : temps refusés sous le minimum du circuit.
assert(api.check({ track: 'riviera', name: 'A', ms: 24000 }));
assert(api.check({ track: 'nulle-part', name: 'A', ms: 50000 }));
assert.strictEqual(api.check({ track: 'riviera', name: 'A', ms: 45000 }), null);
// Fantômes : le tour doit finir au temps annoncé, avec des points bien formés.
const lap = Array.from({ length: 100 }, (_, k) => [k * 15, k * 0.45, k, k, 0]); // finit à 44,55 s
assert.strictEqual(api.checkGhost({ track: 'riviera', name: 'A', ms: 45000, data: lap }), null);
assert(api.checkGhost({ track: 'riviera', name: 'A', ms: 60000, data: lap }));
assert(api.checkGhost({ track: 'riviera', name: 'A', ms: 45000, data: lap.slice(0, 10) }));
assert(api.checkGhost({ track: 'riviera', name: 'A', ms: 45000, data: [...lap.slice(0, -1), [1, 44.5, 'x', 0, 0]] }));

// Marche arrière : l'accélérateur ramène la voiture en marche avant.
{
  const t = buildTrack(TRACKS[0]), car = createCar(t, gridSlot(t, 0));
  for (let k = 0; k < 120; k++) stepCar(car, { brake: 1 }, t, 1 / 60, 10);
  const back = car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a);
  for (let k = 0; k < 120; k++) stepCar(car, { throttle: 1 }, t, 1 / 60, 10);
  assert(back < -2 && car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a) > 2, 'la voiture doit repartir en avant');
}
// Départ lancé : avant la ligne, sur la piste, à plus de 300 m.
for (const d of TRACKS) { const t = buildTrack(d), s = flyingSlot(t); assert((t.N - s.i) * t.ds > 300, d.id); }

console.log('Top Formula : tests OK');
