// Classement mondial du contre-la-montre de Top Formula : les 10 meilleurs tours par circuit, un par pseudo.
const express = require('express');
const store = require('../lib/store');
const activity = require('../lib/activity');
const { MIN_LAP } = require('./game');

const TOP = 10;
const NAMES = { riviera: 'Riviera', lago: 'Autodromo del Lago', marina: 'Marina by Night' };

// Classement durable (base en ligne, ou fichier en local) : il survit aux redéploiements.
let boards = {};
const ready = store.load('formula-board', {}).then(v => (boards = v));
const save = () => store.save('formula-board', boards);

// shortcut: le temps vient du navigateur ; un tricheur appliqué peut encore envoyer un tour plausible.
function check({ track, name, ms }) {
  if (!Object.hasOwn(MIN_LAP, track)) return 'Circuit inconnu';
  if (!name) return 'Pseudo requis';
  if (!Number.isInteger(ms) || ms < MIN_LAP[track] * 1000 || ms > 10 * 60 * 1000) return 'Temps invalide';
  return null;
}

const router = express.Router();
router.use(express.json({ limit: '1kb' }));
// Les requêtes attendent que le classement soit lu (au démarrage, depuis la base).
router.use((req, res, next) => ready.then(() => next()));

router.get('/board', (req, res) => {
  const track = String(req.query.track ?? '');
  if (!Object.hasOwn(MIN_LAP, track)) return res.status(400).json({ error: 'Circuit inconnu' });
  res.json(boards[track] || []);
});

router.post('/board', (req, res) => {
  const b = req.body || {};
  const entry = { name: String(b.name ?? '').trim().slice(0, 20), ms: b.ms };
  const track = String(b.track ?? '');
  const error = check({ ...entry, track });
  if (error) return res.status(400).json({ error });
  entry.at = Date.now();
  const list = boards[track] || [];
  const prev = list.find(e => e.name.toLowerCase() === entry.name.toLowerCase());
  if (prev && prev.ms <= entry.ms) return res.json({ board: list, place: list.indexOf(prev) + 1, improved: false });
  const next = list.filter(e => e !== prev).concat(entry).sort((x, y) => x.ms - y.ms || x.at - y.at).slice(0, TOP);
  boards[track] = next;
  save();
  const place = next.indexOf(entry) + 1 || null;
  if (place === 1) activity.log(`${entry.name} bat le record de ${NAMES[track]} à Top Formula (${(entry.ms / 1000).toFixed(3)} s)`);
  res.json({ board: next, place, improved: !!place });
});

module.exports = router;
module.exports.check = check;
