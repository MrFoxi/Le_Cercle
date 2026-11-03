// Classement mondial du contre-la-montre de Top Formula : les 10 meilleurs tours par circuit, un par pseudo.
const leaderboard = require('../../../lib/leaderboard');
const { MIN_LAP } = require('./game');

const NAMES = { riviera: 'Riviera', lago: 'Autodromo del Lago', marina: 'Marina by Night' };

// shortcut: le temps vient du navigateur ; un tricheur appliqué peut encore envoyer un tour plausible.
function check({ track, name, ms }) {
  if (!Object.hasOwn(MIN_LAP, track)) return 'Circuit inconnu';
  if (!name) return 'Pseudo requis';
  if (!Number.isInteger(ms) || ms < MIN_LAP[track] * 1000 || ms > 10 * 60 * 1000) return 'Temps invalide';
  return null;
}

module.exports = leaderboard({
  name: 'formula-board',
  key: q => (Object.hasOwn(MIN_LAP, String(q.track ?? '')) ? String(q.track) : null),
  read: b => ({ ms: b.ms }),
  check: (e, b) => check({ ...e, track: b.track }),
  rank: (a, b) => a.ms - b.ms || a.at - b.at,
  announce: (e, track, place) => place === 1 && `${e.name} bat le record de ${NAMES[track]} à Top Formula (${(e.ms / 1000).toFixed(3)} s)`,
});
module.exports.check = check;
