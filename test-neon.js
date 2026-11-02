// Tests de Sillage Néon : déplacements, virages interdits, collisions (mur, traînée, face à face), turbo,
// traînée effacée à l'élimination, manches complètes entre robots, points, grille compressée.
const assert = require('assert');
const { Room } = require('./neon/game');

let seed = 4;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const play = r => { r.timeout(); r.stop(); assert.strictEqual(r.phase, 'play'); };
const room = (humans, bots = 0) => {
  let now = 0;
  const r = new Room('ABCDE', rng, false, () => now);
  humans.forEach(h => r.addPlayer(h));
  for (let k = 0; k < bots; k++) r.addBot(humans[0]);
  r.start(humans[0]);
  now = r.deadline; play(r);
  r.setNow = v => (now = v);
  return r;
};
// place une moto à la main
const put = (r, n, x, y, dir) => { const b = r.bikes[n]; r.grid.fill(0); Object.assign(b, { x, y, dir, queue: [] }); };

// Avance tout droit, laisse une traînée ; pas de demi-tour.
{
  const r = room(['Ana', 'Bob']);
  put(r, 'Ana', 10, 10, 0); put(r, 'Bob', 10, 30, 0);
  r.grid[10 * r.size + 10] = r.bikes.Ana.id;
  r.tick();
  assert.deepStrictEqual([r.bikes.Ana.x, r.bikes.Ana.y], [11, 10]);
  assert.strictEqual(r.grid[10 * r.size + 10], r.bikes.Ana.id, 'la traînée reste');
  r.turn('Ana', 2); assert.strictEqual(r.bikes.Ana.queue.length, 0, 'pas de demi-tour');
  r.turn('Ana', 1); r.turn('Ana', 0); // bas puis droite, enchaînés sur deux pas
  r.tick(); r.tick();
  assert.deepStrictEqual([r.bikes.Ana.x, r.bikes.Ana.y], [12, 11]);
}

// Mur : élimination, et la traînée de la moto détruite disparaît ; l'autre gagne la manche.
{
  const r = room(['Ana', 'Bob']);
  put(r, 'Ana', r.size - 1, 5, 0); put(r, 'Bob', 5, 20, 0);
  r.grid[20 * r.size + 4] = r.bikes.Bob.id; r.grid[5 * r.size + r.size - 2] = r.bikes.Ana.id;
  r.tick();
  assert(!r.bikes.Ana.alive);
  assert(!r.grid.includes(r.bikes.Ana.id), 'traînée effacée');
  assert.strictEqual(r.phase, 'roundEnd');
  assert.strictEqual(r.lastWinner, 'Bob');
  assert.deepStrictEqual(r.players.map(p => p.points), [0, 1]);
}

// Face à face sur la même case : les deux sont éliminés. Traînée d'un autre : éliminé.
{
  const r = room(['Ana', 'Bob', 'Cy']);
  put(r, 'Ana', 10, 10, 0); put(r, 'Bob', 12, 10, 2); put(r, 'Cy', 30, 30, 0);
  r.tick();
  assert.deepStrictEqual(r.order, ['Ana', 'Bob', 'Cy']); assert.strictEqual(r.lastWinner, 'Cy'); // les deux sortent, Cy gagne
}
{
  const r = room(['Ana', 'Bob', 'Cy']);
  put(r, 'Ana', 10, 10, 1); put(r, 'Bob', 20, 20, 0); put(r, 'Cy', 30, 30, 0);
  r.grid[11 * r.size + 10] = r.bikes.Bob.id; // traînée de Bob juste devant Ana
  r.tick();
  assert(!r.bikes.Ana.alive && r.bikes.Bob.alive);
}

// Turbo : deux cases par pas, et il coûte de l'énergie.
{
  const r = room(['Ana', 'Bob']);
  put(r, 'Ana', 10, 10, 0); put(r, 'Bob', 10, 30, 0);
  r.boost('Ana');
  r.tick();
  assert.strictEqual(r.bikes.Ana.x, 12);
  assert(r.bikes.Ana.energy < 0.6);
  r.boost('Ana'); assert(r.bikes.Ana.boost < 18, 'pas de second turbo pendant le premier');
}

// Partie complète de 6 robots (et un humain qui ne joue pas) : toutes les manches se terminent.
{
  const r = room(['Ana'], 5);
  r.settings.rounds = 3;
  let ticks = 0;
  for (let round = 1; round <= 3; round++) {
    if (round > 1) { r.setNow(r.deadline); r.timeout(); r.stop(); r.setNow(r.deadline); play(r); }
    r.crash(['Ana']); // l'humain sort tout de suite
    while (r.phase === 'play' && ticks < 12 * 400) { r.tick(); ticks++; }
    assert.strictEqual(r.phase, 'roundEnd', `manche ${round}`);
    assert.strictEqual(r.order.length, 6);
    r.setNow(r.deadline);
  }
  r.timeout();
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.players.reduce((s, p) => s + p.points, 0), 3 * 15);
  assert(ticks > 12 * 10, `les robots tiennent un moment (${(ticks / 12).toFixed(0)} s pour 3 manches)`);
}

// Grille compressée : se décompresse à l'identique.
{
  const r = room(['Ana'], 3);
  for (let k = 0; k < 40; k++) r.tick();
  const d = r.dump(), out = [];
  for (const part of d.grid.split(',').filter(Boolean)) { const [v, n] = part.split(':').map(Number); for (let k = 0; k < n; k++) out.push(v); }
  assert.deepStrictEqual(out, Array.from(r.grid));
}

console.log('Sillage Néon : tests OK');
