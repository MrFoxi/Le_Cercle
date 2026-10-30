const assert = require('node:assert');
const { total, isNatural, outcome, payout, Table, newDeck } = require('./game');

const c = r => ({ rank: r, suit: '♠' });
// Le paquet est dépilé par la fin : on l'écrit dans l'ordre de tirage.
const rig = (t, ranks) => (t.round.deck = ranks.map(c).reverse());
const tableOf = (...names) => {
  const t = new Table('test');
  names.forEach(n => t.addPlayer(n));
  t.start(names[0]);
  return t;
};

// Valeurs et paquet
assert.strictEqual(total(['A', '7', '8', 'R'].map(c)), 8.5);
assert.strictEqual(newDeck().length, 44);
assert.ok(isNatural(['7', 'D'].map(c)));
assert.ok(!isNatural(['4', '3', 'V'].map(c))); // 7,5 en 3 cartes : pas naturel

// Paiements : mise 100 gagnée → joueur +100, banquier −50 seulement
assert.deepStrictEqual(payout(100, 'win', false), { player: 100, banker: -50 });
assert.deepStrictEqual(payout(100, 'win', true), { player: 150, banker: -75 });
assert.deepStrictEqual(payout(100, 'lose', false), { player: -100, banker: 100 });
assert.deepStrictEqual(payout(15, 'win', true), { player: 22, banker: -11 }); // arrondis à l'unité inférieure

// Égalité → le banquier gagne
assert.strictEqual(outcome(['7', 'V'].map(c), 7.5), 'lose');
assert.strictEqual(outcome(['5'].map(c), 4), 'win');
assert.strictEqual(outcome(['5', '4'].map(c), 4), 'lose'); // au-dessus de 7,5

// Partie : un joueur au-dessus de 7,5 gagne quand le banquier saute
{
  const t = tableOf('A', 'B', 'C');
  assert.strictEqual(t.round.banker, 'A');
  assert.deepStrictEqual(t.round.order, ['B', 'C']);
  rig(t, ['7', '5', '2', '6', 'R', '3']);
  t.bet('B', 100);
  t.bet('C', 100);
  assert.strictEqual(t.round.hands.C.cards.length, 0); // C n'a rien tant que B joue
  t.draw('B', false); // 12 : dépasse, peut continuer
  t.stand('B');
  t.stand('C');
  assert.throws(() => t.challenge('A', 'B')); // doit tirer d'abord
  t.bankerDraw('A');
  t.bankerDraw('A');
  t.bankerDraw('A'); // 9,5 : saute
  assert.strictEqual(t.phase, 'results');
  assert.strictEqual(t.get('B').chips, 1100);
  assert.strictEqual(t.get('C').chips, 1100);
  assert.strictEqual(t.get('A').chips, 900);
  t.newRound();
  assert.strictEqual(t.round.banker, 'B'); // rotation
  assert.deepStrictEqual(t.round.order, ['C', 'A']);
}

// Partie : égalité à 7,5 gagnée par le banquier, même contre un naturel
{
  const t = tableOf('A', 'B');
  rig(t, ['7', 'R', '7', 'D']);
  t.bet('B', 100);
  t.draw('B', false);
  t.stand('B');
  t.bankerDraw('A');
  t.bankerDraw('A');
  assert.throws(() => t.bankerDraw('A')); // à 7,5 il ne peut plus que défier
  t.challenge('A', 'B');
  assert.strictEqual(t.get('B').chips, 900);
  assert.strictEqual(t.get('A').chips, 1100);
}

// Une seule carte cachée par main ; les autres ne voient jamais la carte cachée
{
  const t = tableOf('A', 'B');
  rig(t, ['3', '4', '5']);
  t.bet('B', 50);
  assert.throws(() => t.draw('B', true), /Une seule carte cachée/);
  assert.deepStrictEqual(t.viewFor('A').players[1].cards, [{ hidden: true }]);
  assert.strictEqual(t.viewFor('A').players[1].total, null);
  assert.strictEqual(t.viewFor('B').players[1].total, 3);
  t.reveal('B');
  t.draw('B', true); // plus aucune carte cachée : autorisé
  assert.throws(() => t.draw('B', true));
}

// Le banquier se déconnecte : manche annulée, mises rendues
{
  const t = tableOf('A', 'B', 'C');
  rig(t, ['2', '3', '5', 'A']);
  t.bet('B', 100);
  t.bet('C', 100);
  t.stand('B');
  t.stand('C');
  t.bankerDraw('A');
  t.challenge('A', 'B'); // B (2) perd contre 5
  assert.strictEqual(t.get('B').chips, 900);
  t.disconnect('A');
  assert.ok(t.round.cancelled);
  assert.deepStrictEqual(t.players.map(p => p.chips), [1000, 1000, 1000]);
}

// Un joueur part en pleine manche : il reste, puis la table repasse en attente à un seul joueur
{
  const t = tableOf('A', 'B');
  rig(t, ['4', '6']);
  t.bet('B', 100);
  t.leave('B'); // c'était son tour : il reste avec son 4
  assert.strictEqual(t.phase, 'banker');
  t.bankerDraw('A');
  t.challenge('A', 'B');
  assert.strictEqual(t.phase, 'results');
  t.newRound();
  assert.strictEqual(t.phase, 'waiting');
  assert.deepStrictEqual(t.players.map(p => p.name), ['A']);
}

// Le chef du lobby exclut ou bannit ; les autres ne peuvent pas
{
  const t = new Table('test');
  ['A', 'B', 'C'].forEach(n => t.addPlayer(n));
  assert.throws(() => t.kick('B', 'C'), /chef du lobby/);
  assert.throws(() => t.kick('A', 'A'));
  t.kick('A', 'B');
  assert.deepStrictEqual(t.players.map(p => p.name), ['A', 'C']);
  t.addPlayer('B'); // un exclu peut revenir
  t.ban('A', 'B');
  assert.throws(() => t.addPlayer('B'), /banni/);
}

// Temps écoulé : mise oubliée, joueur ou banquier inactif
{
  const t = tableOf('A', 'B', 'C');
  rig(t, ['4', '6', '2']);
  t.bet('B', 100);
  t.timeout(); // délai pas encore écoulé : rien ne se passe
  assert.strictEqual(t.phase, 'betting');
  t.deadline = Date.now() - 1;
  t.timeout(); // C n'a pas misé : il ne joue pas cette manche
  assert.deepStrictEqual(t.round.order, ['B']);
  assert.strictEqual(t.round.turn, 0);
  t.deadline = Date.now() - 1;
  t.timeout(); // B ne joue pas : il reste
  assert.strictEqual(t.phase, 'banker');
  t.deadline = Date.now() - 1;
  t.timeout(); // le banquier tire sa première carte
  assert.strictEqual(t.round.bankerCards.length, 1);
  t.deadline = Date.now() - 1;
  t.timeout(); // puis défie B
  assert.strictEqual(t.phase, 'results');
  assert.strictEqual(t.deadline, null);
}

console.log('Tous les tests passent.');
