const assert = require('node:assert');
const { Room, COLORS, MAX_PILOTS, validPos } = require('./solar/game');

// Pilotes : couleurs par défaut différentes, pseudo unique, univers limité, pas de spectateurs
{
  const r = new Room('SOL');
  r.addPlayer('A');
  r.addPlayer('B');
  assert.notStrictEqual(r.get('A').ship.color, r.get('B').ship.color);
  assert.throws(() => r.addPlayer('A'), /déjà pris/);
  assert.throws(() => r.addSpectator('S'), /tout le monde pilote/);
  for (let i = 2; i < MAX_PILOTS; i++) r.addPlayer(`P${i}`);
  assert.throws(() => r.addPlayer('Z'), /complet/);
  r.removePlayer('B');
  assert.strictEqual(r.players.length, MAX_PILOTS - 1);
}

// Personnalisation : seulement les modèles et couleurs prévus
{
  const r = new Room('SOL');
  r.addPlayer('A');
  r.setShip('A', { model: 'cargo', color: COLORS[3] });
  assert.deepStrictEqual(r.viewFor('A').players[0].ship, { model: 'cargo', color: COLORS[3] });
  assert.throws(() => r.setShip('A', { model: 'cargo', color: 'red' }), /inconnu/);
  assert.throws(() => r.setShip('A', { model: 'ovni', color: COLORS[0] }), /inconnu/);
  assert.throws(() => r.setShip('A', null), /inconnu/);
}

// Positions relayées : 9 nombres finis, rien d'autre
assert.ok(validPos([1, 2, 3, 0, 0, 0, 1, 50, 0]));
assert.ok(!validPos([1, 2, 3]));
assert.ok(!validPos([1, 2, 3, 0, 0, 0, 1, 50, NaN]));
assert.ok(!validPos([1, 2, '3', 0, 0, 0, 1, 50, 0]));
assert.ok(!validPos([1e9, 2, 3, 0, 0, 0, 1, 50, 0]));
assert.ok(!validPos('x'));

console.log('Tests de Solar Explorer : OK');
