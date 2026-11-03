// Tests du stockage durable : base en ligne simulée, protection contre l'écrasement, mode fichier local.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

(async () => {
  // Base en ligne simulée (même format de requêtes qu'Upstash)
  const db = new Map(), calls = [];
  let down = 0;
  global.fetch = async (url, { body }) => {
    const [cmd, key, val] = JSON.parse(body);
    calls.push(cmd);
    if (down-- > 0) return { ok: false, status: 503, json: async () => ({ error: 'indisponible' }) };
    if (cmd === 'GET') return { ok: true, json: async () => ({ result: db.has(key) ? db.get(key) : null }) };
    db.set(key, val); return { ok: true, json: async () => ({ result: 'OK' }) };
  };
  process.env.UPSTASH_REDIS_REST_URL = 'https://exemple'; process.env.UPSTASH_REDIS_REST_TOKEN = 'x';
  const store = require('./store');
  assert(store.online());
  // jamais d'écriture avant d'avoir lu : on n'écrase pas le vrai classement par un vide
  await store.save('board', { vide: true });
  assert(!calls.includes('SET'), 'aucune écriture avant lecture');
  db.set('board', JSON.stringify({ arcade: [{ name: 'Zoé', score: 10 }] }));
  down = 1; // la base ne répond pas la première fois : on réessaie
  const errors = console.error; console.error = () => {};
  const v = await store.load('board', {});
  console.error = errors;
  assert.deepStrictEqual(v, { arcade: [{ name: 'Zoé', score: 10 }] }, 'lecture après une panne');
  v.arcade.push({ name: 'Léo', score: 5 });
  await store.save('board', v);
  assert.strictEqual(JSON.parse(db.get('board')).arcade.length, 2, 'écriture dans la base');
  assert.deepStrictEqual(await store.load('vide', []), [], 'donnée absente : valeur par défaut');

  // Mode local (sans variables) : un fichier dans data/
  delete process.env.UPSTASH_REDIS_REST_URL;
  assert(!store.online());
  const f = path.join(__dirname, '..', 'data', 'test-store.json');
  fs.rmSync(f, { force: true });
  assert.deepStrictEqual(await store.load('test-store', { n: 0 }), { n: 0 });
  await store.save('test-store', { n: 3 });
  assert.deepStrictEqual(await store.load('test-store', {}), { n: 3 });
  fs.rmSync(f, { force: true });
  console.log('Tests du stockage : OK');
})().catch(e => { console.error(e); process.exit(1); });
