// Classement en ligne de Trouve le pays : un top 10 par combinaison de réglages (zone|chrono|erreurs).
const leaderboard = require('../../../lib/leaderboard');

const TOP = 10;
const TIMES = [0, 60, 180, 300, 600], LIVES = [0, 1, 3, 5, 10];

// Nombre de pays à trouver par zone, tiré de la même carte que le jeu.
const COUNT = { Monde: 0 };
for (const g of require('../client/countries.json').objects.countries.geometries) {
  if (!g.properties.q) continue;
  COUNT.Monde++;
  COUNT[g.properties.c] = (COUNT[g.properties.c] || 0) + 1;
}

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

module.exports = leaderboard({
  name: 'pays-board',
  key: q => (validKey(String(q.key ?? '')) ? String(q.key) : null),
  read: b => ({ points: b.points, found: b.found, total: b.total, seconds: b.seconds }),
  check: (e, b) => check({ ...e, key: String(b.key) }),
  rank,
  announce: e => `${e.name} : ${e.points} points à Trouve le pays (${e.found}/${e.total} pays)`,
});
module.exports.check = check;
module.exports.COUNT = COUNT;
