// Classement mondial du flipper : un top 10 par table (même principe que le classement de Trouve le pays).
const fs = require('fs');
const path = require('path');
const express = require('express');
const activity = require('../lib/activity');
const TABLE_NAMES = { arcade: 'Arcade', space: 'Espace', casino: 'Casino', jungle: 'Jungle', volcan: 'Volcan' };

const FILE = path.join(__dirname, '..', 'data', 'pinball-board.json');
const TOP = 10;
const TABLES = ['arcade', 'space', 'casino', 'jungle', 'volcan'];
const MAX_PER_SECOND = 400000; // plafond de vraisemblance : bien au-dessus d'une partie réelle, même en multiball

// shortcut: fichier JSON local, effacé à chaque redéploiement sur Render ; passer à une vraie base si le classement doit durer.
let boards = {};
try { boards = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* pas encore de fichier */ }
const save = () => fs.mkdir(path.dirname(FILE), { recursive: true }, () => fs.writeFile(FILE, JSON.stringify(boards), () => {}));

// shortcut: le score vient du navigateur (jeu solo) ; on refuse seulement l'impossible.
function check({ table, name, score, seconds }) {
  if (!TABLES.includes(table)) return 'Table inconnue';
  if (!name) return 'Pseudo requis';
  if (!Number.isInteger(score) || score <= 0 || score % 10) return 'Score invalide';
  if (!Number.isInteger(seconds) || seconds < 5 || score > seconds * MAX_PER_SECOND) return 'Score invalide';
  return null;
}
const rank = (a, b) => b.score - a.score || a.at - b.at;

const router = express.Router();
router.use(express.json({ limit: '1kb' }));
router.get('/board', (req, res) => {
  const table = String(req.query.table ?? '');
  if (!TABLES.includes(table)) return res.status(400).json({ error: 'Table inconnue' });
  res.json(boards[table] || []);
});
// Un seul score par pseudo et par table : on garde le meilleur.
router.post('/board', (req, res) => {
  const b = req.body || {};
  const entry = { name: String(b.name ?? '').trim().slice(0, 20), score: b.score, seconds: b.seconds };
  const error = check({ ...entry, table: String(b.table ?? '') });
  if (error) return res.status(400).json({ error });
  entry.at = Date.now();
  const list = boards[b.table] || [];
  const prev = list.find(e => e.name.toLowerCase() === entry.name.toLowerCase());
  if (prev && rank(entry, prev) >= 0) return res.json({ board: list, place: list.indexOf(prev) + 1 });
  const next = list.filter(e => e !== prev).concat(entry).sort(rank).slice(0, TOP);
  boards[b.table] = next;
  save();
  const place = next.indexOf(entry) + 1 || null;
  if (place) activity.log(`${entry.name} : ${entry.score.toLocaleString('fr-FR')} points au Pinball (table ${TABLE_NAMES[b.table]})`);
  res.json({ board: next, place });
});

module.exports = router;
module.exports.check = check;
