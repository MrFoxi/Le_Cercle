// Classement en ligne de Trouve le pays : un top 10 par combinaison de réglages (zone|chrono|erreurs).
const fs = require('fs');
const path = require('path');
const express = require('express');
const activity = require('../lib/activity');

const FILE = path.join(__dirname, '..', 'data', 'pays-board.json');
const TOP = 10;
const TIMES = [0, 60, 180, 300, 600], LIVES = [0, 1, 3, 5, 10];

// Nombre de pays à trouver par zone, tiré de la même carte que le jeu.
const COUNT = { Monde: 0 };
for (const g of require('../public/pays/countries.json').objects.countries.geometries) {
  if (!g.properties.q) continue;
  COUNT.Monde++;
  COUNT[g.properties.c] = (COUNT[g.properties.c] || 0) + 1;
}

// shortcut: fichier JSON local, effacé à chaque redéploiement sur Render ; passer à une vraie base si le classement doit durer.
let boards = {};
try { boards = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* pas encore de fichier */ }
const save = () => fs.mkdir(path.dirname(FILE), { recursive: true }, () => fs.writeFile(FILE, JSON.stringify(boards), () => {}));

const validKey = key => {
  const [scope, time, lives] = String(key).split('|');
  return key.split('|').length === 3 && Object.hasOwn(COUNT, scope) && TIMES.includes(Number(time)) && LIVES.includes(Number(lives));
};

// Refuse les scores impossibles à obtenir en jouant (100 pts max par pays, au moins 0,5 s par pays trouvé).
// shortcut: le score vient du navigateur, un tricheur appliqué peut encore envoyer un score plausible.
function check({ key, name, points, found, total, seconds }) {
  if (!validKey(key)) return 'Réglages inconnus';
  const time = Number(key.split('|')[1]);
  if (!name) return 'Pseudo requis';
  if (total !== COUNT[key.split('|')[0]]) return 'Nombre de pays incorrect';
  if (![points, found, seconds].every(Number.isInteger) || found < 1 || found > total) return 'Score invalide';
  if (points % 50 || points < found * 50 || points > found * 100) return 'Score invalide';
  if (seconds < found / 2 || (time && seconds > time + 2)) return 'Temps invalide';
  return null;
}

const rank = (a, b) => b.points - a.points || a.seconds - b.seconds || a.at - b.at;

const router = express.Router();
router.use(express.json({ limit: '1kb' }));

router.get('/board', (req, res) => {
  const key = String(req.query.key ?? '');
  if (!validKey(key)) return res.status(400).json({ error: 'Réglages inconnus' });
  res.json(boards[key] || []);
});

// Renvoie le classement à jour et la place du joueur (null s'il n'y entre pas).
router.post('/board', (req, res) => {
  const b = req.body || {};
  const entry = { name: String(b.name ?? '').trim().slice(0, 20), points: b.points, found: b.found, total: b.total, seconds: b.seconds };
  const error = check({ ...entry, key: String(b.key ?? '') });
  if (error) return res.status(400).json({ error });
  entry.at = Date.now();
  const list = boards[b.key] || [];
  // Un seul score par pseudo : on ne garde que le meilleur.
  const prev = list.find(e => e.name.toLowerCase() === entry.name.toLowerCase());
  if (prev && rank(entry, prev) >= 0) return res.json({ board: list, place: list.indexOf(prev) + 1, improved: false });
  const next = list.filter(e => e !== prev).concat(entry).sort(rank).slice(0, TOP);
  boards[b.key] = next;
  save();
  const place = next.indexOf(entry) + 1 || null;
  if (place) activity.log(`${entry.name} : ${entry.points} points à Trouve le pays (${entry.found}/${entry.total} pays)`);
  res.json({ board: next, place, improved: !!place });
});

module.exports = router;
module.exports.check = check;
module.exports.COUNT = COUNT;
