// Classement mondial du Démineur Rogue : top 10 du niveau atteint (à égalité : le plus de pièces gagnées),
// tous les temps, et un classement par partie du jour (même graine pour tout le monde).
const fs = require('fs');
const path = require('path');
const express = require('express');
const activity = require('../lib/activity');

const FILE = path.join(__dirname, '..', 'data', 'mines-board.json');
const TOP = 10;

// shortcut: fichier JSON local, effacé à chaque redéploiement sur Render ; passer à une vraie base si le classement doit durer.
let boards = { all: [], days: {} };
try { boards = { all: [], days: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { /* pas encore de fichier */ }
const save = () => fs.mkdir(path.dirname(FILE), { recursive: true }, () => fs.writeFile(FILE, JSON.stringify(boards), () => {}));

// Partie du jour : aujourd'hui ou hier (fuseaux horaires), au format AAAA-MM-JJ.
const dayOk = d => [0, 1].some(k => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10) === d);

// shortcut: la partie se joue dans le navigateur ; on refuse seulement l'impossible (au moins 8 s par niveau, pièces plafonnées).
function check({ name, level, coins, seconds }) {
  if (!name) return 'Pseudo requis';
  if (![level, coins, seconds].every(Number.isInteger) || level < 1 || level > 500 || coins < 0) return 'Score invalide';
  if (coins > level * 3000 || seconds < level * 8) return 'Score invalide';
  return null;
}
const rank = (a, b) => b.level - a.level || b.coins - a.coins || a.at - b.at;

const router = express.Router();
router.use(express.json({ limit: '1kb' }));
router.get('/board', (req, res) => {
  const day = req.query.day;
  if (day !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Jour invalide' });
  res.json(day ? boards.days[day] || [] : boards.all);
});
// Un seul score par pseudo et par classement : on garde le meilleur.
router.post('/board', (req, res) => {
  const b = req.body || {};
  const entry = { name: String(b.name ?? '').trim().slice(0, 20), level: b.level, coins: b.coins, seconds: b.seconds };
  const error = check(entry) || (b.day !== undefined && !dayOk(b.day) ? 'Partie du jour terminée' : null);
  if (error) return res.status(400).json({ error });
  entry.at = Date.now();
  const insert = list => {
    const prev = list.find(e => e.name.toLowerCase() === entry.name.toLowerCase());
    if (prev && rank(entry, prev) >= 0) return list;
    return list.filter(e => e !== prev).concat({ ...entry }).sort(rank).slice(0, TOP);
  };
  boards.all = insert(boards.all);
  if (b.day) {
    boards.days[b.day] = insert(boards.days[b.day] || []);
    for (const d of Object.keys(boards.days).sort().slice(0, -7)) delete boards.days[d]; // 7 derniers jours seulement
  }
  save();
  const list = b.day ? boards.days[b.day] : boards.all;
  const place = list.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase()) + 1;
  const bosses = Math.floor((entry.level - 1) / 5);
  if (place) activity.log(`${entry.name} a atteint le niveau ${entry.level} au Démineur Rogue${bosses ? ` (${bosses} boss battu${bosses > 1 ? 's' : ''})` : ''}`);
  res.json({ board: list, place: place || null });
});

module.exports = router;
