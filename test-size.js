const assert = require('node:assert');
const { OBJECTS, PAIRS, ROUNDS, pickRounds, score, verdict } = require('./size/game');

// Banque d'objets : identifiants uniques, dimensions positives
assert.strictEqual(new Set(OBJECTS.map(o => o.id)).size, OBJECTS.length);
assert.ok(OBJECTS.every(o => o.h > 0 && o.w > 0 && o.name && o.emoji));
assert.ok(PAIRS.length > 100, `${PAIRS.length} paires`);
assert.ok(PAIRS.every(p => p.ref !== p.target && p.target.h / p.ref.h >= 0.2 && p.target.h / p.ref.h <= 5));

// Score : 100 pour une estimation juste, symétrique trop grand / trop petit, 0 à partir d'un facteur 2
assert.strictEqual(score(2, 2), 100);
assert.strictEqual(score(2.03, 2), 100); // à moins de 2 % près
assert.strictEqual(score(4, 2), 0);
assert.strictEqual(score(1, 2), 0);
assert.strictEqual(score(2.2, 2), score(2 / 1.1, 2)); // 10 % trop grand = 10 % trop petit
assert.ok(score(2.2, 2) > score(2.6, 2) && score(2.6, 2) > score(3.4, 2));
assert.strictEqual(score(2.2, 2), 86);
assert.deepStrictEqual([verdict(100), verdict(85), verdict(65), verdict(40), verdict(5)], ['Parfait !', 'Très proche !', 'Pas loin', 'Bof…', 'Loin du compte']);

// Une partie : 10 manches, jamais deux fois le même objet rouge, jamais la même référence d'affilée
for (let k = 0; k < 200; k++) {
  const rounds = pickRounds();
  assert.strictEqual(rounds.length, ROUNDS);
  assert.strictEqual(new Set(rounds.map(r => r.target.id)).size, ROUNDS);
  assert.ok(rounds.every((r, i) => i === 0 || r.ref !== rounds[i - 1].ref));
}

// Dessins : un par objet, aux proportions réelles (sinon la silhouette serait déformée)
import('./public/size/art.js').then(({ ART }) => {
  for (const o of OBJECTS) {
    const a = ART[o.id];
    assert.ok(a, `dessin manquant : ${o.id}`);
    assert.ok(Math.abs(a.vb[0] / a.vb[1] / (o.w / o.h) - 1) < 0.03, `proportions du dessin ${o.id}`);
    assert.ok(!/NaN|undefined/.test(a.svg), `dessin cassé : ${o.id}`);
  }
  console.log('Tests de Size It Up : OK');
});
