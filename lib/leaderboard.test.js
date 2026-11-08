// Tests des classements communs : meilleur score gardé par pseudo, top 10 trié, scores refusés, classements en plus
// (partie du jour), ancien format converti, annonce seulement quand on entre au classement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const leaderboard = require('./leaderboard');
const activity = require('./activity');

const FILE = path.join(__dirname, '..', 'data', 'test-leaderboard.json');
fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, JSON.stringify({ all: [{ name: 'Ancien', score: 5, at: 1 }], days: { '2026-01-01': [] } })); // ancien format

(async () => {
  const logs = [];
  const log = activity.log; activity.log = t => logs.push(t);
  const lb = leaderboard({
    name: 'test-leaderboard',
    key: q => (['all', 'x'].includes(q.k) ? q.k : null),
    read: b => ({ score: b.score }),
    check: e => (Number.isInteger(e.score) && e.score > 0 ? null : 'Score invalide'),
    rank: (a, b) => b.score - a.score || a.at - b.at,
    also: b => (b.k === 'x' ? ['all'] : []),
    migrate: v => { const { days = {}, ...rest } = v; return { ...rest, ...Object.fromEntries(Object.keys(days).map(d => [`jour:${d}`, days[d]])) }; },
    announce: (e, k, place) => `${e.name} ${e.score} (${k}, ${place}e)`,
  });
  const app = express().use('/api/t', lb);
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/api/t/board`;
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, ...(await r.json()) }));

  // ancien format lu et converti
  assert.deepStrictEqual((await (await fetch(`${url}?k=all`)).json()).map(e => e.name), ['Ancien']);
  assert.strictEqual((await fetch(`${url}?k=zzz`)).status, 400);
  // refus : classement inconnu, pseudo vide, score impossible
  assert.strictEqual((await post({ k: 'zzz', name: 'A', score: 1 })).status, 400);
  assert.strictEqual((await post({ k: 'all', name: ' ', score: 1 })).error, 'Pseudo requis');
  assert.strictEqual((await post({ k: 'all', name: 'A', score: -3 })).error, 'Score invalide');
  // meilleur score gardé, un seul par pseudo (sans tenir compte des majuscules)
  let r = await post({ k: 'all', name: 'Ana', score: 50 });
  assert.deepStrictEqual([r.place, r.improved], [1, true]);
  r = await post({ k: 'all', name: 'ana', score: 20 });
  assert.deepStrictEqual([r.place, r.improved, r.board.length], [1, false, 2]);
  assert.strictEqual(r.board[0].score, 50);
  // top 10 seulement
  for (let k = 0; k < 12; k++) await post({ k: 'all', name: `J${k}`, score: 100 + k });
  r = await post({ k: 'all', name: 'Petit', score: 1 });
  assert.deepStrictEqual([r.board.length, r.place, r.improved], [10, null, false]);
  assert.strictEqual(r.board[0].name, 'J11');
  // classement en plus : un score « x » compte aussi dans « all »
  r = await post({ k: 'x', name: 'Zoé', score: 999 });
  assert.strictEqual(r.place, 1);
  assert.strictEqual((await (await fetch(`${url}?k=all`)).json())[0].name, 'Zoé');
  // annonces : seulement quand on améliore et qu'on est dans le classement
  assert(logs.includes('Ana 50 (all, 1e)') && !logs.some(t => t.startsWith('ana 20') || t.startsWith('Petit')));
  // tout est gardé dans le fichier (mode local)
  const saved = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).x?.length === 1; } catch { return false; } };
  for (let k = 0; k < 40 && !saved(); k++) await new Promise(res => setTimeout(res, 50)); // l'écriture est asynchrone (lente si la machine est chargée)
  assert(saved());

  // modération : on retire un pseudo d'un classement
  assert.strictEqual((await lb.drop('all', e => e.name === 'Zoé')).length, 1);
  assert(!(await (await fetch(`${url}?k=all`)).json()).some(e => e.name === 'Zoé'));
  activity.log = log;
  server.close();
  fs.unlinkSync(FILE);
  console.log('Tests des classements : OK');
})();
