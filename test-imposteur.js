const assert = require('node:assert');
const { Room, roleCounts, revealsWord, sameWord, POINTS } = require('./imposteur/game');
const { CATEGORIES } = require('./imposteur/words');

// Paires : 16 catégories, deux mots différents par paire, aucune paire en double
assert.strictEqual(CATEGORIES.length, 16);
for (const c of CATEGORIES) {
  assert.ok(c.pairs.length >= 10, c.id);
  for (const [a, b] of c.pairs) assert.ok(a && b && !sameWord(a, b), `${c.id} : ${a} / ${b}`);
  assert.strictEqual(new Set(c.pairs.map(p => p.join('|'))).size, c.pairs.length);
}

// Mots : tolérance aux accents, articles et pluriels ; un indice ne doit pas contenir le mot
assert.ok(sameWord('le café', 'Café') && sameWord('CAFE', 'café') && sameWord('chats', 'Chat') && sameWord('roi lion', 'Le Roi lion'));
assert.ok(!sameWord('thé', 'Café') && !sameWord('', 'Café'));
assert.ok(revealsWord('thé vert', 'Thé') && revealsWord('Les chats', 'Chat') && revealsWord('roi lion', 'Le Roi lion'));
assert.ok(!revealsWord('athlète', 'Thé') && !revealsWord('chocolat', 'Pain au chocolat') && !revealsWord('ronronnement', 'Chat'));

// Rôles : au moins un intrus, toujours plus de civils que d'intrus au départ, réglages de l'hôte respectés si possible
const s = (impostors, whites) => ({ impostors, whites });
assert.deepStrictEqual(roleCounts(3, s(2, 2)), { civils: 2, impostors: 1, whites: 0 });
assert.deepStrictEqual(roleCounts(3, s(0, 1)), { civils: 2, impostors: 0, whites: 1 });
assert.deepStrictEqual(roleCounts(5, s(1, 1)), { civils: 3, impostors: 1, whites: 1 });
assert.deepStrictEqual(roleCounts(4, s(0, 0)), { civils: 3, impostors: 1, whites: 0 });
assert.deepStrictEqual(roleCounts(4, s(1, 1)), { civils: 2, impostors: 1, whites: 1 });
assert.deepStrictEqual(roleCounts(4, s(2, 0)), { civils: 3, impostors: 1, whites: 0 });
assert.deepStrictEqual(roleCounts(12, s(4, 3)), { civils: 7, impostors: 4, whites: 1 });
for (let n = 3; n <= 12; n++) for (let i = 0; i <= 4; i++) for (let w = 0; w <= 3; w++) {
  const c = roleCounts(n, s(i, w));
  assert.ok(c.impostors + c.whites >= 1 && c.civils >= c.impostors + c.whites && c.civils > c.impostors && c.civils + c.impostors + c.whites === n);
}

// Outils : salon de test avec horloge et hasard maîtrisés
let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function room(n, settings = {}) {
  const r = new Room('TEST', rng, false, () => 1000);
  for (let i = 0; i < n; i++) r.addPlayer(`J${i}`);
  r.setSettings('J0', { ...r.settings, ...settings });
  r.start('J0');
  return r;
}
const byRole = (r, role) => Object.keys(r.game.roles).filter(n => r.game.roles[n] === role);
const allSee = r => r.game.alive.forEach(n => r.seenCard(n));
const allClue = r => { while (r.phase === 'clues') r.giveClue(r.game.speaker, 'indice'); };
const voteOut = (r, target) => {
  for (const n of r.game.alive) r.vote(n, n === target ? r.game.alive.find(x => x !== target) : target);
};

// Distribution : chacun ne voit que sa carte, Mr. White n'a aucun mot, il ne parle pas en premier
for (let k = 0; k < 50; k++) {
  const r = room(6, { impostors: 1, whites: 1 });
  const [imp] = byRole(r, 'imposteur'), [white] = byRole(r, 'white'), civ = byRole(r, 'civil')[0];
  const { civil, imposteur } = r.game.words;
  assert.notStrictEqual(civil, imposteur);
  assert.strictEqual(byRole(r, 'civil').length, 4);
  assert.notStrictEqual(r.game.roles[r.game.order[0]], 'white');
  assert.deepStrictEqual(r.viewFor(civ).game.me, { role: 'word', word: civil });
  assert.deepStrictEqual(r.viewFor(imp).game.me, { role: 'word', word: imposteur }); // l'imposteur ne sait pas qu'il l'est
  assert.ok(!/"(civil|imposteur)"/.test(JSON.stringify(r.viewFor(imp).game)), 'un joueur voit son camp');
  assert.deepStrictEqual(r.viewFor(white).game.me, { role: 'white', word: null });
  const leak = v => JSON.stringify(v.game);
  assert.ok(!leak(r.viewFor(civ)).includes(`"${imposteur}"`), 'un civil voit le mot des imposteurs');
  assert.ok(!leak(r.viewFor(imp)).includes(`"${civil}"`), 'un imposteur voit le mot des civils');
  assert.ok(![civil, imposteur].some(w => leak(r.viewFor(white)).includes(`"${w}"`)), 'Mr. White voit un mot');
  assert.strictEqual(r.viewFor(civ).game.reveal, null);
}

// Une manche complète : cartes, indices dans l'ordre, mot interdit, discussion, vote secret, victoire des civils
{
  const r = room(5, { impostors: 1, whites: 0, discussion: 30 });
  assert.strictEqual(r.phase, 'reveal');
  assert.throws(() => r.giveClue(r.game.order[0], 'x'), /pas le moment/);
  allSee(r);
  assert.strictEqual(r.phase, 'clues');
  const first = r.game.speaker;
  assert.strictEqual(first, r.game.order[0]);
  assert.throws(() => r.giveClue(r.game.order[1], 'x'), /pas ton tour/);
  assert.throws(() => r.giveClue(first, r.game.words[r.game.roles[first]]), /Interdit de dire ton mot/);
  assert.throws(() => r.giveClue(first, 'x'.repeat(31)), /30 caractères/);
  r.giveClue(first, 'Indice un');
  r.timeout(); // le 2e joueur ne répond pas : pas d'indice pour lui
  assert.deepStrictEqual(r.game.clues[1], { tour: 1, name: r.game.order[1], text: null });
  allClue(r);
  assert.strictEqual(r.phase, 'discussion');
  r.game.alive.forEach(n => r.readyVote(n)); // tout le monde est prêt : vote sans attendre la fin du chrono
  assert.strictEqual(r.phase, 'vote');
  const [imp] = byRole(r, 'imposteur');
  const voter = r.game.alive.find(n => n !== imp);
  assert.throws(() => r.vote(voter, voter), /toi-même/);
  r.vote(voter, imp);
  assert.strictEqual(r.viewFor(imp).game.lastVote, null, 'un vote est révélé avant la fin');
  assert.deepStrictEqual(r.viewFor(imp).game.voted, [voter]);
  voteOut(r, imp);
  assert.strictEqual(r.phase, 'elim');
  assert.deepStrictEqual(r.game.out, { name: imp, role: 'imposteur', tour: 1, votes: 4 });
  r.timeout();
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.game.winner.team, 'civil');
  for (const n of byRole(r, 'civil')) assert.strictEqual(r.scores[n], POINTS.civil);
  assert.strictEqual(r.scores[imp], 0);
  const end = r.viewFor(imp).game.reveal;
  assert.ok(end.roles && end.words.civil && end.words.imposteur && end.category);
}

// Égalité : revote entre les ex æquo, puis personne n'est éliminé si l'égalité persiste
{
  const r = room(4, { impostors: 1, whites: 0, discussion: 0 });
  allSee(r);
  allClue(r);
  assert.strictEqual(r.phase, 'vote'); // discussion à 0 s : vote direct
  const [a, b, c, d] = r.game.alive;
  r.vote(a, b); r.vote(b, a); r.vote(c, a); r.vote(d, b);
  assert.strictEqual(r.phase, 'vote');
  assert.ok(r.game.revote);
  assert.deepStrictEqual([...r.game.candidates].sort(), [a, b].sort());
  assert.throws(() => r.vote(c, d), /ne peut pas être éliminé/);
  r.vote(a, b); r.vote(b, a); r.vote(c, a); r.vote(d, b);
  assert.strictEqual(r.phase, 'elim');
  assert.strictEqual(r.game.out, null);
  assert.strictEqual(r.game.alive.length, 4);
  r.timeout();
  assert.strictEqual(r.phase, 'clues');
  assert.strictEqual(r.game.tour, 2);
}

// Mr. White éliminé : il devine le mot des civils et gagne, même avec une faute d'accent ou de majuscule
{
  const r = room(5, { impostors: 1, whites: 1, discussion: 0 });
  allSee(r);
  allClue(r);
  const [white] = byRole(r, 'white');
  voteOut(r, white);
  assert.strictEqual(r.phase, 'guess');
  assert.throws(() => r.guess(r.game.alive[0], 'x'), /Seul Mr. White/);
  r.guess(white, r.game.words.civil.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  assert.strictEqual(r.phase, 'over');
  assert.deepStrictEqual(r.game.winner, { team: 'white', names: [white], points: POINTS.white });
  assert.strictEqual(r.scores[white], POINTS.white);
}

// Mr. White se trompe : la partie continue ; puis les imposteurs gagnent dès qu'ils sont aussi nombreux que les civils
{
  const r = room(5, { impostors: 1, whites: 1, discussion: 0 });
  allSee(r);
  allClue(r);
  const [white] = byRole(r, 'white'), [imp] = byRole(r, 'imposteur'), civs = byRole(r, 'civil');
  voteOut(r, white);
  r.guess(white, 'mauvaise réponse');
  assert.strictEqual(r.phase, 'elim');
  assert.strictEqual(r.game.out.found, false);
  assert.throws(() => r.vote(white, imp), /pas le moment|éliminé/);
  r.timeout();
  assert.strictEqual(r.phase, 'clues');
  allClue(r);
  voteOut(r, civs[0]);
  r.timeout(); // 2 civils, 1 imposteur : on continue
  assert.strictEqual(r.phase, 'clues');
  allClue(r);
  voteOut(r, civs[1]);
  r.timeout(); // 1 civil, 1 imposteur
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.game.winner.team, 'imposteur');
  assert.strictEqual(r.scores[imp], POINTS.imposteur);
  assert.throws(() => r.next('J1'), /hôte/);

  // Manches suivantes, puis nouvelle partie : scores remis à zéro après la dernière manche
  r.setSettings('J0', { ...r.settings, rounds: 2 });
  r.next('J0');
  assert.strictEqual(r.round, 2);
  assert.strictEqual(r.phase, 'reveal');
  assert.notDeepStrictEqual(r.game.words, undefined);
  r.phase = 'over';
  r.next('J0');
  assert.strictEqual(r.round, 1);
  assert.ok(Object.values(r.scores).every(v => v === 0));
}

// Mr. White seul intrus qui survit jusqu'au duel final : il gagne
{
  const r = room(3, { impostors: 0, whites: 1, discussion: 0 });
  allSee(r);
  allClue(r);
  const [white] = byRole(r, 'white'), [c1] = byRole(r, 'civil');
  voteOut(r, c1);
  r.timeout();
  assert.strictEqual(r.phase, 'over');
  assert.deepStrictEqual(r.game.winner.names, [white]);
}

// Départ d'un joueur de la manche : manche annulée ; les retardataires attendent la manche suivante
{
  const r = room(4);
  r.addPlayer('Tard');
  assert.strictEqual(r.viewFor('Tard').game.me, null);
  assert.throws(() => r.seenCard('Tard'), /prochaine manche/);
  r.removePlayer('Tard'); // pas dans la manche : rien ne change
  assert.strictEqual(r.phase, 'reveal');
  r.removePlayer('J2');
  assert.strictEqual(r.phase, 'lobby');
  assert.match(r.notice, /J2 a quitté/);
}

// Réglages : hôte seulement, valeurs contrôlées
{
  const r = new Room('X', rng);
  ['A', 'B', 'C'].forEach(n => r.addPlayer(n));
  assert.throws(() => r.setSettings('B', r.settings), /hôte/);
  assert.throws(() => r.setSettings('A', { ...r.settings, categories: [] }), /catégorie/);
  assert.throws(() => r.setSettings('A', { ...r.settings, rounds: 0 }), /manches/);
  assert.throws(() => r.setSettings('A', { ...r.settings, discussion: 45 }), /discussion/);
  r.setSettings('A', { ...r.settings, categories: ['animaux', 'inconnue'] });
  assert.deepStrictEqual(r.settings.categories, ['animaux']);
  r.start('A');
  assert.ok(CATEGORIES[0].pairs.some(p => p.includes(r.game.words.civil) && p.includes(r.game.words.imposteur)));
}

console.log('Tests de L’Imposteur : OK');

// Le moteur servi au navigateur (mode un seul appareil) se charge et joue comme celui du serveur
import('data:text/javascript,' + encodeURIComponent(require('./imposteur/engine'))).then(({ Room: R, CATEGORIES: C }) => {
  assert.strictEqual(C.length, 16);
  const r = new R('SOLO');
  ['A', 'B', 'C', 'D'].forEach(n => r.addPlayer(n));
  r.start('A');
  r.game.alive.forEach(n => r.seenCard(n));
  assert.strictEqual(r.phase, 'clues');
  console.log('Moteur du mode un seul appareil : OK');
});
