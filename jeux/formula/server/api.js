// Classement mondial du contre-la-montre de Top Formula : les 10 meilleurs tours par circuit, un par pseudo,
// et leurs fantômes (le tour enregistré), que les autres joueurs peuvent choisir d'affronter.
const express = require('express');
const leaderboard = require('../../../lib/leaderboard');
const store = require('../../../lib/store');
const { MIN_LAP } = require('./game');
const admin = require('../../../lib/admin');

const NAMES = { riviera: 'Riviera', lago: 'Autodromo del Lago', marina: 'Marina by Night' };

// shortcut: le temps vient du navigateur ; un tricheur appliqué peut encore envoyer un tour plausible.
function check({ track, name, ms }) {
  if (!Object.hasOwn(MIN_LAP, track)) return 'Circuit inconnu';
  if (!name) return 'Pseudo requis';
  if (!Number.isInteger(ms) || ms < MIN_LAP[track] * 1000 || ms > 10 * 60 * 1000) return 'Temps invalide';
  return null;
}
// Le tour enregistré, point par point [distance, temps, x, y, cap] : il doit finir au temps annoncé, et la voiture ne
// doit jamais aller plus vite que possible (≈ 285 km/h au mieux ; on tolère 330, et quelques sauts pour « remis en piste »).
const VMAX = 92; // m/s
// shortcut: un tricheur appliqué peut encore fabriquer un tour plausible de bout en bout ; il faudrait rejouer le tour sur le serveur.
function checkGhost({ track, name, ms, data }) {
  const err = check({ track, name, ms });
  if (err) return err;
  if (!Array.isArray(data) || data.length < 30 || data.length > 1500) return 'Tour enregistré manquant';
  if (!data.every(p => Array.isArray(p) && p.length === 5 && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5))) return 'Tour enregistré invalide';
  if (Math.abs(data.at(-1)[1] - ms / 1000) > 1.5) return 'Tour enregistré invalide';
  let tooFast = 0;
  for (let k = 1; k < data.length; k++) {
    const dt = data[k][1] - data[k - 1][1];
    if (dt <= 0) return 'Tour enregistré invalide';
    if (Math.hypot(data[k][2] - data[k - 1][2], data[k][3] - data[k - 1][3]) / dt > VMAX) tooFast++;
  }
  return tooFast > 3 ? 'Vitesse impossible' : null;
}

const board = leaderboard({
  name: 'formula-board',
  key: q => (Object.hasOwn(MIN_LAP, String(q.track ?? '')) ? String(q.track) : null),
  read: b => ({ ms: b.ms }),
  check: (e, b) => checkGhost({ ...e, track: b.track, data: b.data }),
  limit: '80kb',
  onDrop: (track, who) => { if (!ghosts[track]) return; ghosts[track] = ghosts[track].filter(g => !same(g.name, who)); store.save(`formula-ghosts-${track}`, ghosts[track]); },
  rank: (a, b) => a.ms - b.ms || a.at - b.at,
  announce: (e, track, place) => place === 1 && `${e.name} bat le record de ${NAMES[track]} à Top Formula (${(e.ms / 1000).toFixed(3)} s)`,
});

// Fantômes : les 10 plus rapides par circuit (un par pseudo), un enregistrement par circuit dans le stockage.
const ghosts = {};
const ready = Promise.all(Object.keys(MIN_LAP).map(k => store.load(`formula-ghosts-${k}`, []).then(v => (ghosts[k] = v))));
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const api = express.Router();
api.use('/ghost', (req, res, next) => ready.then(() => next()));
// GET /ghost?track=x : qui a un fantôme ; avec &name=y : le fantôme de y
api.get('/ghost', (req, res) => {
  const list = ghosts[String(req.query.track)];
  if (!list) return res.status(400).json({ error: 'Circuit inconnu' });
  if (req.query.name == null) return res.json(list.map(g => ({ name: g.name, ms: g.ms })));
  const g = list.find(e => same(e.name, String(req.query.name)));
  return g ? res.json(g) : res.status(404).json({ error: 'Pas de fantôme' });
});
api.post('/ghost', express.json({ limit: '80kb' }), (req, res) => {
  const b = req.body || {}, name = String(b.name ?? '').trim().slice(0, 20), g = { name, ms: b.ms, data: b.data };
  const error = admin.reserved(name, req.headers.cookie) ?? checkGhost({ ...g, track: b.track });
  if (error) return res.status(400).json({ error });
  const list = ghosts[b.track], prev = list.find(e => same(e.name, name));
  if (prev && prev.ms <= g.ms) return res.json({ kept: false });
  ghosts[b.track] = list.filter(e => e !== prev).concat(g).sort((x, y) => x.ms - y.ms).slice(0, 10);
  store.save(`formula-ghosts-${b.track}`, ghosts[b.track]);
  res.json({ kept: ghosts[b.track].includes(g) });
});
api.use(board);

// Ménage au démarrage : un fantôme dont la voiture va plus vite que possible (voiture trafiquée) est retiré,
// avec son temps au classement.
ready.then(() => {
  for (const track of Object.keys(ghosts)) {
    const bad = ghosts[track].filter(g => checkGhost({ ...g, track }));
    if (!bad.length) continue;
    ghosts[track] = ghosts[track].filter(g => !bad.includes(g));
    store.save(`formula-ghosts-${track}`, ghosts[track]);
    board.drop(track, e => bad.some(g => same(g.name, e.name)))
      .then(n => console.log(`Top Formula : ${bad.map(g => g.name).join(', ')} retiré(s) du classement de ${track} (${n} temps, vitesse impossible)`));
  }
});

module.exports = api;
module.exports.check = check;
module.exports.checkGhost = checkGhost;
