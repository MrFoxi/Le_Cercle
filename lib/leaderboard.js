// Classements mondiaux (GET et POST /board) : un top 10 par classement (table, circuit, réglages, jour…),
// un seul score par pseudo (le meilleur), gardés dans lib/store.js : ils survivent aux redéploiements.
// Chaque jeu donne :
//   name               : nom de la donnée stockée
//   key(src)           : le classement visé d'après la requête (query pour lire, body pour écrire), ou null si inconnu
//   read(body)         : les champs du score
//   check(entry, body) : message d'erreur si le score est impossible, sinon null
//   rank(a, b)         : tri, le meilleur d'abord (à égalité : le plus ancien)
//   also(body)         : autres classements où inscrire le même score (facultatif)
//   announce(entry, key, place) : texte du bandeau de l'accueil quand le score entre au classement (facultatif)
//   prune(boards)      : ménage après un ajout (facultatif) ; migrate(stocké) : ancien format -> nouveau (facultatif)
//   limit              : taille maximale d'un envoi (1 ko par défaut)
const express = require('express');
const store = require('./store');
const activity = require('./activity');

const TOP = 10;
const sameName = (a, b) => a.name.toLowerCase() === b.name.toLowerCase();

module.exports = function leaderboard({ name, key, read, check, rank, also = () => [], announce, prune, migrate = v => v, limit = '1kb' }) {
  let boards = {};
  const ready = store.load(name, {}).then(v => (boards = migrate(v)));
  const router = express.Router();
  router.use(express.json({ limit }));
  router.use((req, res, next) => ready.then(() => next())); // on attend que le classement soit lu (au démarrage)

  router.get('/board', (req, res) => {
    const k = key(req.query);
    if (k == null) return res.status(400).json({ error: 'Classement inconnu' });
    res.json(boards[k] || []);
  });

  // Renvoie le classement à jour, la place du joueur (null s'il n'y entre pas) et s'il a battu son record.
  router.post('/board', (req, res) => {
    const b = req.body || {}, k = key(b);
    const entry = { name: String(b.name ?? '').trim().slice(0, 20), ...read(b) };
    const error = k == null ? 'Classement inconnu' : !entry.name ? 'Pseudo requis' : check(entry, b);
    if (error) return res.status(400).json({ error });
    entry.at = Date.now();
    const insert = into => {
      const list = boards[into] || [], prev = list.find(e => sameName(e, entry));
      if (prev && rank(entry, prev) >= 0) return false;
      boards[into] = list.filter(e => e !== prev).concat({ ...entry }).sort(rank).slice(0, TOP);
      return true;
    };
    const improved = insert(k);
    const more = also(b).map(insert).some(Boolean);
    if (improved || more) { prune?.(boards); store.save(name, boards); }
    const list = boards[k] || [], place = list.findIndex(e => sameName(e, entry)) + 1 || null;
    const text = improved && place && announce?.(entry, k, place);
    if (text) activity.log(text);
    res.json({ board: list, place, improved: improved && !!place });
  });
  return router;
};
