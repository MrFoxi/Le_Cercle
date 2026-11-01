// Classement mondial du Démineur Rogue : top 10 du niveau atteint (à égalité : le plus de pièces gagnées).
const fs = require('fs');
const path = require('path');
const express = require('express');

const FILE = path.join(__dirname, '..', 'data', 'mines-board.json');
const TOP = 10;

// shortcut: fichier JSON local, effacé à chaque redéploiement sur Render ; passer à une vraie base si le classement doit durer.
let board = [];
try { board = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* pas encore de fichier */ }
const save = () => fs.mkdir(path.dirname(FILE), { recursive: true }, () => fs.writeFile(FILE, JSON.stringify(board), () => {}));

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
router.get('/board', (req, res) => res.json(board));
// Un seul score par pseudo : on garde le meilleur.
router.post('/board', (req, res) => {
  const b = req.body || {};
  const entry = { name: String(b.name ?? '').trim().slice(0, 20), level: b.level, coins: b.coins, seconds: b.seconds };
  const error = check(entry);
  if (error) return res.status(400).json({ error });
  entry.at = Date.now();
  const prev = board.find(e => e.name.toLowerCase() === entry.name.toLowerCase());
  if (prev && rank(entry, prev) >= 0) return res.json({ board, place: board.indexOf(prev) + 1 });
  board = board.filter(e => e !== prev).concat(entry).sort(rank).slice(0, TOP);
  save();
  res.json({ board, place: board.indexOf(entry) + 1 || null });
});

module.exports = router;
