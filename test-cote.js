const assert = require('node:assert');
const { Room, pointsFor, ROUNDS, THEMES } = require('./cote/game');

// Barème, aux limites de chaque tranche
for (const [diff, pts] of [[0, 5], [5, 5], [6, 4], [10, 4], [11, 3], [20, 3], [21, 2], [30, 2], [31, 1], [40, 1], [41, 0], [100, 0]]) {
  assert.strictEqual(pointsFor(diff), pts, `écart ${diff}`);
}

// Thèmes : 68 thèmes en 5 catégories, chacun avec assez de sujets distincts pour 10 manches
assert.strictEqual(THEMES.length, 68);
assert.strictEqual(new Set(THEMES.map(t => t.category)).size, 5);
assert.strictEqual(new Set(THEMES.map(t => t.id)).size, 68);
for (const t of THEMES) {
  assert.ok(t.subjects.length >= ROUNDS, `${t.name} : ${t.subjects.length} sujets`);
  assert.strictEqual(new Set(t.subjects).size, t.subjects.length, `doublon dans ${t.name}`);
  assert.ok(t.subjects.every(x => x.trim() === x && x), `sujet vide dans ${t.name}`);
}

const room = () => {
  const r = new Room('ABCDE');
  r.addPlayer('Ana');
  r.addPlayer('Ben');
  return r;
};

// Salon : 2 joueurs maximum, pseudos différents, seul le créateur lance
{
  const r = new Room('X');
  r.addPlayer('Ana');
  assert.throws(() => r.addPlayer('Ana'), /déjà pris/);
  assert.throws(() => r.start('Ana'), /deux joueurs/);
  r.addPlayer('Ben');
  assert.throws(() => r.addPlayer('Cléo'), /complet/);
  assert.throws(() => r.start('Ben'), /créateur/);
  r.get('Ben').connected = false;
  assert.throws(() => r.start('Ana'), /connectés/);
}

// Une partie complète : rôles alternés, position secrète cachée, scores, 10 manches, sujets sans répétition
{
  const r = room();
  r.start('Ana');
  const seen = new Set(), scores = { Ana: 0, Ben: 0 };
  for (let i = 1; i <= ROUNDS; i++) {
    const c = r.current;
    assert.strictEqual(r.round, i);
    assert.strictEqual(c.giver, i % 2 ? 'Ana' : 'Ben');
    assert.ok(!seen.has(c.subject));
    seen.add(c.subject);
    // Seul le donneur d'indice voit la position secrète
    assert.strictEqual(r.viewFor(c.giver).current.target, c.target);
    assert.strictEqual(r.viewFor(c.guesser).current.target, null);
    assert.throws(() => r.giveClue(c.guesser, i, 'triche'), /pas à toi/);
    assert.throws(() => r.giveClue(c.giver, i, '   '), /indice/);
    r.giveClue(c.giver, i, '  Un   indice  ');
    assert.strictEqual(c.clue, 'Un indice');
    assert.strictEqual(r.viewFor(c.guesser).current.target, null); // toujours caché pendant la réponse
    assert.throws(() => r.giveClue(c.giver, i, 'encore'), /déjà/); // envoyé deux fois
    const value = (c.target + 12) % 101;
    r.guess(c.guesser, i, value);
    assert.throws(() => r.guess(c.guesser, i, value), /déjà/); // double validation refusée
    scores[c.guesser] += pointsFor(Math.abs(value - c.target));
    assert.strictEqual(r.viewFor(c.guesser).current.target, c.target); // révélé
    r.next(i);
    assert.throws(() => r.next(i), /déjà/); // les deux joueurs cliquent « suivante » : une seule fois
  }
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.history.length, ROUNDS);
  assert.deepStrictEqual(r.players.map(p => p.score), [scores.Ana, scores.Ben]);
  const v = r.viewFor('Ana');
  assert.strictEqual(v.winner, scores.Ana === scores.Ben ? null : scores.Ana > scores.Ben ? 'Ana' : 'Ben');
  // Revanche : tout repart de zéro
  r.start('Ben');
  assert.deepStrictEqual([r.round, r.players[0].score, r.players[1].score, r.history.length], [1, 0, 0, 0]);
}

// Thèmes : seul le créateur choisit, au moins un thème, et seuls ses sujets sortent ; retour au lobby après la partie
{
  const r = room();
  assert.strictEqual(r.viewFor('Ben').themes.length, 68); // tous par défaut
  assert.throws(() => r.setThemes('Ben', ['films']), /créateur/);
  r.setThemes('Ana', ['inconnu']); // thème inconnu ignoré
  r.setThemes('Ana', []); // « tout désélectionner » est permis…
  assert.throws(() => r.start('Ana'), /au moins un/); // …mais pas de partie sans thème
  r.setThemes('Ana', ['films', 'debats-absurdes', 'films']);
  assert.deepStrictEqual(r.viewFor('Ben').themes, ['films', 'debats-absurdes']);
  r.start('Ana');
  assert.throws(() => r.setThemes('Ana', ['films']), /pleine partie/);
  const allowed = new Set(THEMES.filter(t => ['films', 'debats-absurdes'].includes(t.id)).flatMap(t => t.subjects));
  for (let i = 1; i <= ROUNDS; i++) {
    const c = r.current;
    assert.ok(allowed.has(c.subject) && ['Films', 'Débats absurdes'].includes(c.theme), c.subject);
    r.giveClue(c.giver, i, 'x');
    r.guess(c.guesser, i, 50);
    r.next(i);
  }
  r.toLobby();
  assert.throws(() => r.toLobby(), /déjà/);
  assert.strictEqual(r.phase, 'lobby');
  r.setThemes('Ana', ['espace']); // un seul thème suffit pour 10 manches
  r.start('Ana');
  assert.strictEqual(r.current.theme, 'Espace');
}

// Égalité : pas de vainqueur
{
  const r = room();
  r.start('Ana');
  for (let i = 1; i <= ROUNDS; i++) {
    const c = r.current;
    r.giveClue(c.giver, i, 'x');
    r.guess(c.guesser, i, c.target); // 5 points chacun à chaque fois
    r.next(i);
  }
  assert.deepStrictEqual(r.players.map(p => p.score), [25, 25]);
  assert.strictEqual(r.viewFor('Ana').winner, null);
}

// Valeurs invalides et départ d'un joueur
{
  const r = room();
  r.start('Ana');
  r.giveClue('Ana', 1, 'x');
  assert.throws(() => r.guess('Ben', 1, 140), /invalide/);
  assert.throws(() => r.guess('Ben', 1, 'abc'), /invalide/);
  r.removePlayer('Ben');
  assert.deepStrictEqual([r.phase, r.host, r.notice], ['lobby', 'Ana', 'Ben a quitté la partie']);
}

console.log('Tests du Demi-Cercle : OK');
