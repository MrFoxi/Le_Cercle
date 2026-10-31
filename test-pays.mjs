import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { Quiz, CONTINENTS } from './public/pays/quiz.js';

const seq = () => 0; // mélange déterministe
const C = [
  { id: 'FRA', continent: 'Europe' }, { id: 'ESP', continent: 'Europe' },
  { id: 'PER', continent: 'Amérique du Sud' }, { id: 'JPN', continent: 'Asie' },
];

// Bonne réponse, mauvaise réponse, score et pourcentage
{
  const q = new Quiz(C, {}, seq);
  assert.strictEqual(q.total, 4);
  const first = q.current;
  const other = C.find(c => c.id !== first).id;
  assert.strictEqual(q.answer(other), 'wrong');
  assert.strictEqual(q.current, first); // la question reste posée
  assert.strictEqual(q.answer(first), 'correct');
  assert.strictEqual(q.answer(first), 'ignored'); // déjà trouvé : pas de double validation
  assert.strictEqual(q.points, 50); // trouvé après une erreur
  assert.strictEqual(q.answer(q.current), 'correct');
  assert.strictEqual(q.points, 150); // trouvé du premier coup : +100
  assert.deepStrictEqual([q.correct, q.wrong, q.accuracy], [2, 1, 67]);
  assert.strictEqual(q.misses[first], 1);
}

// Passer une question, fin quand tout est répondu
{
  const q = new Quiz(C, {}, seq);
  const skipped = q.skip();
  assert.deepStrictEqual(q.skipped, [skipped]);
  while (q.current) q.answer(q.current);
  assert.strictEqual(q.over, true);
  assert.strictEqual(q.reason, 'done');
  assert.strictEqual(q.answered, 4);
  assert.strictEqual(q.answer('FRA'), 'ignored');
}

// Mode continent : seuls ses pays sont demandés, les autres sont ignorés
{
  const q = new Quiz(C, { scope: 'Europe' }, seq);
  assert.strictEqual(q.total, 2);
  assert.strictEqual(q.answer('JPN'), 'ignored');
  assert.strictEqual(q.wrong, 0);
}

// Mode défi : la partie s'arrête au nombre d'erreurs permis
{
  const q = new Quiz(C, { lives: 2 }, seq);
  const wrongId = C.find(c => c.id !== q.current).id;
  q.answer(wrongId);
  assert.strictEqual(q.livesLeft, 1);
  q.answer(wrongId);
  assert.deepStrictEqual([q.over, q.reason, q.livesLeft], [true, 'lives', 0]);
}

// Mode chronométré : fin au temps limite
{
  const q = new Quiz(C, { time: 60 }, seq);
  q.tick(59.5);
  assert.strictEqual(q.timeLeft, 0.5);
  q.tick(60);
  assert.deepStrictEqual([q.over, q.reason, q.current], [true, 'time', null]);
}

// Données de la carte : 197 pays, chacun avec noms, continent et identifiant unique
{
  const topo = JSON.parse(readFileSync(new URL('./public/pays/countries.json', import.meta.url)));
  const quiz = topo.objects.countries.geometries.filter(g => g.properties.q);
  assert.strictEqual(quiz.length, 197);
  assert.ok(quiz.every(g => g.id && g.properties.iso && g.properties.fr && g.properties.en && CONTINENTS.includes(g.properties.c)));
  // Identifiants uniques sur toute la carte, territoires compris (sinon deux zones se confondent).
  const all = topo.objects.countries.geometries;
  assert.strictEqual(new Set(all.map(g => g.id)).size, all.length);
  for (const iso of ['FRA', 'AUS', 'VAT', 'MCO', 'NRU', 'TUV', 'KIR', 'FJI', 'IDN', 'PHL', 'SOM', 'CYP']) assert.ok(quiz.some(g => g.properties.iso === iso), iso);
}

console.log('Tests du quiz des pays : OK');

// Classement en ligne : scores plausibles acceptés, scores impossibles refusés
{
  const { check, COUNT } = (await import('module')).createRequire(import.meta.url)('./pays/api.js');
  const ok = { key: 'Monde|0|0', name: 'Léa', points: 1500, found: 20, total: COUNT.Monde, seconds: 120 };
  assert.strictEqual(check(ok), null);
  assert.ok(check({ ...ok, points: 2100 })); // plus de 100 pts par pays
  assert.ok(check({ ...ok, seconds: 5 })); // trop rapide
  assert.ok(check({ ...ok, total: 3 }));
  assert.ok(check({ ...ok, key: 'Lune|0|0' }));
  assert.ok(check({ ...ok, key: 'Monde|180|0', seconds: 400 })); // dépasse le chrono
  assert.ok(check({ ...ok, name: '' }));
}
