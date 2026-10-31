const assert = require('node:assert');
const { Room, ABILITIES } = require('./bataille/game');

// Flotte de test : chaque navire sur sa ligne, collé à gauche (lignes 0, 2, 4, 6, 8)
const LAYOUT = ['porteavions', 'cuirasse', 'destroyer', 'sousmarin', 'patrouilleur'].map((id, i) => ({ id, r: i * 2, c: 0, dir: 'h' }));
function battle(mode = 'moderne') {
  const r = new Room('TEST');
  r.addPlayer('A');
  r.addPlayer('B');
  r.setMode('A', mode);
  r.start('A');
  return r;
}
const fleet = r => LAYOUT.filter(s => r.rules.fleet.includes(s.id)).map((s, i) => ({ ...s, r: i * 2 }));

// Placement : hors grille, chevauchement, navire manquant ou en double refusés
{
  const r = battle();
  assert.strictEqual(r.phase, 'setup');
  assert.throws(() => r.placeFleet('A', LAYOUT.slice(1)), /Place tous/);
  assert.throws(() => r.placeFleet('A', LAYOUT.map((s, i) => (i === 0 ? { ...s, c: 6 } : s))), /sort de la grille/);
  assert.throws(() => r.placeFleet('A', LAYOUT.map((s, i) => (i === 1 ? { ...s, r: 0, c: 0, dir: 'v' } : s))), /chevauchent/);
  assert.throws(() => r.placeFleet('A', LAYOUT.map((s, i) => (i === 1 ? { ...LAYOUT[0] } : s))), /invalide/);
  assert.throws(() => r.placeFleet('A', LAYOUT.map((s, i) => (i === 1 ? { ...s, dir: 'x' } : s))), /invalide/);
  r.placeFleet('A', LAYOUT);
  assert.throws(() => r.placeFleet('A', LAYOUT), /déjà validée/);
  assert.strictEqual(r.phase, 'setup');
  // B ne voit pas la flotte de A, seulement qu'elle est prête
  assert.deepStrictEqual(r.viewFor('B').boards.A.ships, []);
  assert.strictEqual(r.viewFor('B').boards.A.ready, true);
  r.placeFleet('B', LAYOUT);
  assert.strictEqual(r.phase, 'battle');
  assert.strictEqual(r.turn, 'A');
}

// Tirs : tour par tour, à l'eau / touché / coulé, pas deux fois la même case, pas de double envoi
{
  const r = battle();
  r.placeFleet('A', LAYOUT);
  r.placeFleet('B', LAYOUT);
  assert.throws(() => r.fire('B', 0, 0, 0), /pas ton tour/);
  r.fire('A', 9, 9, 0);
  assert.strictEqual(r.history[0].results[0].res, 'miss');
  assert.throws(() => r.fire('B', 0, 0, 0), /déjà jouée/);
  r.fire('B', 9, 9, 1);
  assert.throws(() => r.fire('A', 9, 9, 2), /déjà tiré/);
  assert.throws(() => r.fire('A', 10, 0, 2), /hors de la grille/);
  r.fire('A', 8, 0, 2);
  assert.strictEqual(r.history.at(-1).results[0].res, 'hit');
  r.fire('B', 9, 8, 3);
  r.fire('A', 8, 1, 4); // patrouilleur (2 cases) coulé
  assert.deepStrictEqual(r.history.at(-1).results[0], { r: 8, c: 1, res: 'sunk', ship: 'patrouilleur', cells: [[8, 0], [8, 1]] });
  // A voit le patrouilleur coulé de B, mais aucun autre navire de B
  const v = r.viewFor('A');
  assert.deepStrictEqual(v.boards.B.ships.map(s => s.id), ['patrouilleur']);
  assert.strictEqual(v.boards.B.marks.filter(m => m[2] === 'sunk').length, 2);
  assert.strictEqual(v.boards.A.ships.length, 5); // sa propre flotte, entière
  assert.ok(v.boards.B.fleet.find(s => s.id === 'patrouilleur').sunk);
  // Un spectateur voit les deux flottes en entier
  r.addSpectator('S');
  const s = r.viewFor('S');
  assert.ok(s.spectator && s.boards.A.ships.length === 5 && s.boards.B.ships.length === 5);
  assert.throws(() => r.fire('S', 0, 0, 5), /pas ton tour/);
}

// Partie complète en mode rapide : victoire, statistiques, flottes révélées, revanche
{
  const r = battle('rapide');
  r.placeFleet('A', fleet(r));
  r.placeFleet('B', fleet(r));
  const size = { cuirasse: 4, destroyer: 3, patrouilleur: 2 };
  const targets = fleet(r).flatMap(s => Array.from({ length: size[s.id] }, (_, i) => [s.r, s.c + i]));
  let bMiss = 0;
  for (const [tr, tc] of targets) {
    r.fire('A', tr, tc, r.history.length);
    if (r.phase === 'over') break;
    r.fire('B', 7, bMiss++, r.history.length); // B tire dans l'eau (ligne 7)
  }
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.winner, 'A');
  const v = r.viewFor('B');
  assert.strictEqual(v.boards.A.shots, 9);
  assert.strictEqual(v.boards.A.hits, 9);
  assert.strictEqual(v.boards.B.hits, 0);
  assert.strictEqual(v.boards.A.ships.length, 3); // fin de partie : tout est révélé
  assert.strictEqual(v.players.find(p => p.name === 'A').wins, 1);
  assert.throws(() => r.ability('A', 'radar', { r: 0, c: 0 }, r.history.length), /pas en cours/);
  r.requestRematch('B');
  r.requestRematch('A');
  assert.strictEqual(r.phase, 'setup');
  assert.strictEqual(r.round, 2);
  r.placeFleet('A', fleet(r));
  r.placeFleet('B', fleet(r));
  assert.strictEqual(r.turn, 'B'); // l'autre joueur ouvre le feu cette fois
}

// Capacités (mode Moderne) : disponibles après quelques tours, en nombre limité, n'en disent pas plus que prévu
{
  const r = battle();
  r.placeFleet('A', LAYOUT);
  r.placeFleet('B', LAYOUT);
  const move = () => r.history.length;
  const pass = () => { const k = r.sides.B.actions; r.fire('B', k < 10 ? 9 : 7, 9 - (k % 10), move()); }; // B tire dans les lignes 9 et 7 (vides)
  assert.throws(() => r.ability('A', 'drone', { r: 0, c: 0 }, move()), /après ton 2ᵉ tour/);
  for (let k = 0; k < 6; k++) { r.fire('A', 1, 9 - k, move()); pass(); } // A tire 6 fois dans l'eau (ligne 1)
  r.ability('A', 'drone', { r: 0, c: 0 }, move());
  assert.deepStrictEqual(r.history.at(-1), { n: 13, by: 'A', kind: 'drone', cells: [[0, 0]], found: true, ship: 'porteavions' });
  assert.strictEqual(r.sides.B.received['0,0'], undefined, 'le drone ne fait pas de dégâts');
  // Le navire repéré est dévoilé en entier à A, et seulement à lui
  assert.deepStrictEqual(r.viewFor('A').boards.B.ships.map(x => [x.id, x.spotted]), [['porteavions', true]]);
  assert.strictEqual(r.viewFor('B').boards.A.ships.length, 0, 'B ne voit rien de plus chez A');
  assert.ok(!r.viewFor('B').boards.B.ships.some(x => x.spotted), 'B voit sa flotte normalement');
  pass();
  r.ability('A', 'radar', { r: 9, c: 9 }, move()); // coin vide : 2 × 2 cases visibles du 3 × 3
  assert.strictEqual(r.history.at(-1).found, false);
  assert.strictEqual(r.history.at(-1).cells.length, 4);
  pass();
  r.ability('A', 'sonar', { r: 6, c: 2 }, move()); // le sous-marin est en ligne 6
  assert.strictEqual(r.history.at(-1).found, true);
  assert.ok(!JSON.stringify(r.history.at(-1)).includes('sousmarin'), 'le sonar ne dit pas où');
  pass();
  assert.throws(() => r.ability('A', 'sonar', { r: 0, c: 0 }, move()), /plus aucune/);
  r.ability('A', 'missiles', { r: 0, c: 3, dir: 'v' }, move()); // (0,3) porte-avions, (1,3) eau, (2,3) cuirassé
  assert.deepStrictEqual(r.history.at(-1).results.map(x => x.res), ['hit', 'miss', 'hit']);
  assert.strictEqual(r.sides.A.shots, 9);
  pass();
  assert.throws(() => r.ability('A', 'missiles', { r: 0, c: 8, dir: 'h' }, move()), /plus aucune/);
  // Brouillage : B ne peut plus utiliser ses capteurs pendant ses 2 prochains tours
  r.ability('A', 'jam', {}, move());
  for (let k = 0; k < 2; k++) {
    assert.throws(() => r.ability('B', 'radar', { r: 0, c: 0 }, move()), /brouillés/);
    pass();
    r.fire('A', 3, 9 - k, move());
  }
  r.ability('B', 'radar', { r: 0, c: 0 }, move()); // brouillage terminé
  assert.strictEqual(r.history.at(-1).found, true);
}

// Les capacités n'existent pas en mode Classique
{
  const r = battle('classique');
  r.placeFleet('A', LAYOUT);
  r.placeFleet('B', LAYOUT);
  r.sides.A.actions = 10;
  assert.throws(() => r.ability('A', 'radar', { r: 0, c: 0 }, 0), /indisponible/);
  assert.strictEqual(r.viewFor('A').boards.A.charges, null);
}

// Départ d'un joueur : retour au salon
{
  const r = battle();
  r.removePlayer('B');
  assert.strictEqual(r.phase, 'lobby');
  assert.match(r.notice, /B a quitté/);
}
assert.ok(Object.values(ABILITIES).every(a => a.charges > 0 && a.from > 0));

console.log('Tests de la Bataille navale : OK');
