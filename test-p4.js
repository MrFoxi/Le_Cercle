const assert = require('node:assert');
const { Room, COLS, ROWS } = require('./p4/game');

const room = () => {
  const r = new Room('ABCDE');
  r.addPlayer('Ana');
  r.addPlayer('Ben');
  r.start('Ana');
  return r;
};
// Joue une suite de colonnes en alternant, en donnant le bon numéro de coup.
const playAll = (r, cols) => cols.forEach(c => r.play(r.turn, c, r.moves.length));

// Salon : 2 joueurs maximum, la 3e personne ne peut pas prendre une place ; seul le créateur lance
{
  const r = new Room('X');
  r.addPlayer('Ana');
  assert.throws(() => r.start('Ana'), /deux joueurs/);
  r.addPlayer('Ben');
  assert.throws(() => r.addPlayer('Cléo'), /complet/);
  r.addSpectator('Cléo');
  assert.throws(() => r.addSpectator('Ana'), /déjà pris/);
  assert.throws(() => r.start('Ben'), /créateur/);
  r.start('Ana');
  assert.deepStrictEqual([r.phase, r.colors.Ana, r.colors.Ben, r.turn], ['playing', 'red', 'yellow', 'Ana']);
}

// Gravité, tour par tour, coups interdits
{
  const r = room();
  r.play('Ana', 3, 0);
  assert.strictEqual(r.board[ROWS - 1][3], 'red'); // tombe tout en bas
  assert.throws(() => r.play('Ana', 3, 1), /pas ton tour/); // pas deux fois de suite
  assert.throws(() => r.play('Ben', 3, 0), /déjà joué/); // clic en double / en retard
  assert.throws(() => r.play('Ben', 7, 1), /invalide/);
  assert.throws(() => r.play('Ben', 1.5, 1), /invalide/);
  r.play('Ben', 3, 1);
  assert.strictEqual(r.board[ROWS - 2][3], 'yellow'); // empilé au-dessus
  playAll(r, [3, 3, 3, 3]);
  assert.throws(() => r.play(r.turn, 3, r.moves.length), /pleine/);
}

// Victoires dans les 4 directions, avec l'alignement gagnant
for (const [label, cols, winner] of [
  ['horizontale', [0, 0, 1, 1, 2, 2, 3], 'Ana'],
  ['verticale', [0, 1, 0, 1, 0, 1, 0], 'Ana'],
  ['diagonale /', [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3], 'Ana'],
  ['diagonale \\', [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3], 'Ana'],
  ['victoire du jaune', [0, 1, 0, 1, 0, 1, 6, 1], 'Ben'],
]) {
  const r = room();
  playAll(r, cols);
  assert.strictEqual(r.phase, 'over', label);
  assert.strictEqual(r.winner, winner, label);
  assert.ok(r.line.length >= 4 && r.line.every(([row, c]) => r.board[row][c] === r.colors[winner]), label);
  assert.throws(() => r.play(r.other(winner) ?? 'Ana', 5, r.moves.length), /pas en cours/); // plus de coup après la victoire
}

// Grille pleine sans alignement : match nul
{
  const r = room();
  // Colonnes remplies par paires décalées : aucun alignement de 4 possible.
  const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
  playAll(r, order);
  assert.deepStrictEqual([r.phase, r.winner, r.moves.length, r.stats.draws], ['over', null, ROWS * COLS, 1]);
}

// Revanche : proposée, refusée, puis acceptée ; couleurs inversées ; statistiques du salon
{
  const r = room();
  playAll(r, [0, 0, 1, 1, 2, 2, 3]); // Ana (rouge) gagne
  assert.throws(() => r.declineRematch('Ben'), /Aucune proposition/);
  r.requestRematch('Ben');
  assert.throws(() => r.declineRematch('Ben'), /Aucune proposition/); // on ne refuse pas sa propre proposition
  r.declineRematch('Ana');
  assert.deepStrictEqual([r.rematch, r.notice, r.phase], [null, 'Ana a refusé de recommencer', 'over']);
  r.requestRematch('Ana');
  r.requestRematch('Ben'); // accepte
  assert.deepStrictEqual([r.phase, r.round, r.colors.Ana, r.colors.Ben, r.turn, r.moves.length], ['playing', 2, 'yellow', 'red', 'Ben', 0]);
  const v = r.viewFor('Ben');
  assert.deepStrictEqual([v.games, v.draws, v.players.map(p => p.wins)], [1, 0, [1, 0]]);
  // Recommencer en pleine partie : la proposition tombe si l'on rejoue entre-temps
  r.requestRematch('Ana');
  r.play('Ben', 0, 0);
  assert.strictEqual(r.rematch, null);
  r.requestRematch('Ana');
  r.requestRematch('Ben');
  assert.deepStrictEqual([r.round, r.moves.length], [3, 0]); // manche abandonnée : pas comptée
  assert.strictEqual(r.stats.games, 1);
}

// Retour au lobby et départ d'un joueur
{
  const r = room();
  assert.throws(() => r.toLobby('Ana'), /Termine/);
  playAll(r, [0, 0, 1, 1, 2, 2, 3]);
  r.toLobby('Ana');
  assert.strictEqual(r.phase, 'lobby');
  r.start('Ana');
  r.removePlayer('Ben');
  assert.deepStrictEqual([r.phase, r.notice, r.players.length], ['lobby', 'Ben a quitté la partie', 1]);
}

console.log('Tests du Puissance 4 : OK');
