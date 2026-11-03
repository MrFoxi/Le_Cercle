// Tests de Chute Libre : arène, chute d'étage en étage, robots, manches complètes, points, positions refusées.
const assert = require('assert');
const C = require('./client/sim');
const { Room } = require('./server/game');

let seed = 9;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Arène : 4 étages de 169 dalles, la case sous un point est la bonne.
assert.strictEqual(C.tiles.length, 4 * 169);
for (const k of [0, 50, 200, 380, 675]) { const t = C.tiles[k]; assert.strictEqual(C.tileAt(t.layer, t.x + 0.3, t.y - 0.2), k); }
assert.strictEqual(C.tileAt(0, 50, 0), -1);

// Sans dalle sous les pieds, on tombe à l'étage du dessous ; sans rien du tout, on est éliminé.
{
  const state = new Uint8Array(C.tiles.length), p = C.newPlayer(0, 0);
  state[C.tileAt(0, 0, 0)] = 2;
  for (let k = 0; k < 90; k++) C.step(p, {}, state, 1 / 60);
  assert.strictEqual(p.z, C.LAYERS[1]); assert(p.ground && p.alive);
  state.fill(2);
  let out = false;
  for (let k = 0; k < 300; k++) if (C.step(p, {}, state, 1 / 60).includes('out')) out = true;
  assert(out && !p.alive, 'sous le dernier étage : éliminé');
}

// Saut par-dessus un trou d'une dalle, ruée qui pousse un autre joueur.
{
  const state = new Uint8Array(C.tiles.length), p = C.newPlayer(-2, 0);
  state[C.tileAt(0, 0, 0)] = 2;
  for (let k = 0; k < 60; k++) C.step(p, { x: 1, jump: k === 8 }, state, 1 / 60);
  assert(p.z === 0 && p.x > 1, `saut au-dessus du trou (x ${p.x.toFixed(1)}, z ${p.z.toFixed(1)})`);
  const a = C.newPlayer(0, 0), b = C.newPlayer(0.85, 0);
  C.step(a, { x: 1, dash: true }, new Uint8Array(C.tiles.length), 1 / 60);
  C.collide(a, b);
  assert(b.vx > 8, 'la ruée envoie valser');
}

// Partie complète : 1 joueur (simulé comme son navigateur) + 5 robots, 2 manches.
{
  let now = 0;
  const r = new Room('ABCDE', rng, false, () => now);
  r.addPlayer('Ana');
  assert.throws(() => r.start('Ana'), /au moins 2/);
  for (let k = 0; k < 5; k++) r.addBot('Ana');
  r.configure('Ana', 'rounds', 3);
  r.configure('Ana', 'rounds', 1); r.configure('Ana', 'rounds', 3);
  r.settings.rounds = 2;
  r.start('Ana');
  r.stop(); // on fait avancer les tics à la main
  assert.strictEqual(r.phase, 'countdown');
  const snaps = [];
  r.emit = (ev, s) => snaps.push(s);
  for (let round = 1; round <= 2; round++) {
    now = r.deadline; r.timeout();
    assert.strictEqual(r.phase, 'play');
    // le « navigateur » d'Ana : il pilote comme un robot et envoie sa position
    const me = C.newPlayer(r.bodies.Ana.x, r.bodies.Ana.y), brain = { aggr: 1 };
    let ticks = 0;
    while (r.phase === 'play' && ticks++ < 30 * 150) {
      const st = r.state;
      if (me.alive) { C.step(me, C.bot(me, brain, st, Object.values(r.bodies), rng), st, 1 / 30); r.move('Ana', { x: me.x, y: me.y, z: me.z }); }
      r.tick();
      now += 1000 / 30;
    }
    r.stop();
    assert.strictEqual(r.phase, 'roundEnd', `manche ${round} terminée`);
    assert.strictEqual(r.order.length, 6, 'tout le monde est classé');
    assert(r.state.filter(s => s === 2).length > 20, 'des dalles sont tombées');
    now = r.deadline; r.timeout(); r.stop();
  }
  assert.strictEqual(r.phase, 'over');
  const total = r.players.reduce((s, p) => s + p.points, 0);
  assert.strictEqual(total, 2 * (0 + 1 + 2 + 3 + 4 + 5), 'points : 0 à 5 par manche');
  assert.strictEqual(r.ranking[0].points, Math.max(...r.players.map(p => p.points)));
  assert(snaps.length > 100 && snaps.at(-1).tiles.length === C.tiles.length);
  r.again('Ana');
  assert.strictEqual(r.phase, 'lobby');
}

// Positions refusées : téléportation, hors de l'arène.
{
  let now = 0;
  const r = new Room('XYZAB', rng, false, () => now);
  r.addPlayer('Bob'); r.addBot('Bob');
  r.start('Bob'); r.stop();
  now = r.deadline; r.timeout();
  const b = r.bodies.Bob, x0 = b.x;
  r.move('Bob', { x: x0 + 10, y: b.y, z: 0 });
  assert.strictEqual(b.x, x0, 'téléportation refusée');
  r.move('Bob', { x: x0 + 0.3, y: b.y, z: -30 });
  assert(!b.alive && r.order.includes('Bob'), 'tombé dans le vide : éliminé');
}

console.log('Chute Libre : tests OK');
