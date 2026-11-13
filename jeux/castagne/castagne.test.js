// Tests de La Castagne : sauts (un au sol, deux en l'air), planches traversables, éjection qui grandit avec les dégâts,
// vie perdue hors de l'arène puis retour, touches mal formées refusées, parties complètes entre robots.
const assert = require('assert');
const BR = require('./client/sim');
const { Room } = require('./server/game');
const { IN } = BR;
const A = BR.ARENAS.phare;

const run = (f, bits, n) => { for (let k = 0; k < n; k++) BR.step(f, typeof bits === 'function' ? bits(k) : bits, A); };
const settle = f => run(f, 0, 90);

// Sauts : un au sol, deux en l'air, pas un de plus ; on retrouve ses sauts en atterrissant.
{
  const f = BR.fighter('a', 'fenna', [0, -10]);
  settle(f);
  assert(f.ground && f.y === 0, 'posé sur l’île');
  run(f, k => (k % 20 < 2 ? IN.JUMP : 0), 50);
  assert(!f.ground && f.jumps === 0, 'les deux sauts en l’air utilisés');
  const before = f.vy; BR.step(f, IN.JUMP, A);
  assert(f.vy > before, 'pas de quatrième saut : on continue de retomber');
  settle(f);
  assert(f.ground && f.jumps === 2, 'sauts retrouvés au sol');
}

// Planche : on la traverse en montant, on s'y pose en descendant, bas pour la traverser.
{
  const p = A.plats[0], f = BR.fighter('a', 'fenna', [(p.x0 + p.x1) / 2, p.y - 200]);
  settle(f);
  assert(f.ground && Math.abs(f.y - p.y) < 0.01, 'posé sur la planche');
  run(f, IN.D, 2); run(f, 0, 60);
  assert(f.ground && f.y === 0, 'retombé sur l’île après avoir traversé la planche');
}

// Éjection : plus forte quand on a déjà beaucoup de dégâts.
function launch(dmg) {
  const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [60, 0]);
  settle(a); settle(b);
  a.facing = 1; b.dmg = dmg;
  const ev = [];
  for (let k = 0; k < 40 && !ev.length; k++) { BR.step(a, k === 0 ? IN.HEAVY | IN.R : IN.R, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert.strictEqual(ev.length, 1, 'le coup touche');
  assert(b.dmg > dmg && b.state === 'hitstun' && b.vx > 0, 'dégâts, recul vers l’avant');
  return Math.hypot(b.vx, b.vy);
}
assert(launch(120) > launch(0) * 2, 'éjection bien plus forte à 120 de dégâts');

// Esquive : invulnérable, le coup ne passe pas.
{
  const a = BR.fighter('a', 'fenna', [0, 0]), b = BR.fighter('b', 'fenna', [50, 0]);
  settle(a); settle(b); a.facing = 1;
  BR.step(b, IN.DODGE, A);
  const ev = [];
  for (let k = 0; k < 12; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert.strictEqual(ev.length, 0, 'esquive réussie');
}

// Hors de l'arène : une vie de moins, retour en haut, invulnérable un moment ; plus de vie : éliminé.
{
  const w = BR.world('phare', [{ id: 'a', char: 'fenna' }, { id: 'b', char: 'gromm' }], 2);
  const [a] = w.fighters;
  a.x = A.blast.r + 10;
  const ev = BR.stepWorld(w, {});
  assert(ev.some(e => e.t === 'ko' && e.id === 'a') && a.stocks === 1);
  for (let k = 0; k < 101; k++) BR.stepWorld(w, {});
  assert(a.state === 'air' && a.invuln > 0 && a.dmg === 0 && a.y < 0, 'de retour');
  a.x = A.blast.l - 10; BR.stepWorld(w, {});
  for (let k = 0; k < 101; k++) BR.stepWorld(w, {});
  assert.strictEqual(a.state, 'out');
  assert.strictEqual(BR.alive(w).length, 1);
}

// Touches : numérotées dans l'ordre, valeurs bornées ; les mal formées sont ignorées.
{
  const r = new Room('ABCDE', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi');
  r.start('Moi'); r.stop();
  r.input('Moi', [[1, 2], [2, 999], ['x', 1], [1, 4], [3, IN.JUMP]]);
  assert.deepStrictEqual(r.queues.Moi, [[1, 2], [3, IN.JUMP]]);
  r.input('Moi', 'n’importe quoi');
  assert.throws(() => r.pick('Moi', 'dragon'), /inconnu/);
}

// Parties complètes entre robots : chaque manche se termine (un seul debout, ou le temps), la partie aussi.
for (let game = 0; game < 6; game++) {
  let now = 0;
  const r = new Room('BOTS1', Math.random, false, () => now);
  r.addPlayer('Moi');
  for (let k = 0; k < 1 + (game % 6); k++) r.addBot('Moi');
  r.configure('Moi', 'rounds', 1); r.configure('Moi', 'stocks', 1);
  r.start('Moi'); r.stop();
  r.emit = () => {};
  now = r.deadline; r.timeout();
  assert.strictEqual(r.phase, 'fight');
  r.left('Moi'); // l'humain s'en va : les robots finissent entre eux
  let frames = 0;
  while (r.phase === 'fight' && frames++ < 60 * 300) { r.tick(); now += 1000 / 60; r.timeout(); }
  r.stop();
  assert.strictEqual(r.phase, 'roundEnd', `partie ${game} : la manche se termine`);
  assert.strictEqual(r.result.ranking.length, r.players.length);
  now = r.deadline; r.timeout(); r.stop();
  assert.strictEqual(r.phase, 'over');
}

console.log('La Castagne : tests OK');
