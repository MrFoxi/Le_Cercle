// Classement mondial de Little Fisher : pour chaque espèce, les 10 plus grosses prises (une par pseudo).
const leaderboard = require('../../../lib/leaderboard');
const SIZES = require('./sizes');

// shortcut: la taille vient du navigateur (jeu solo) ; on refuse seulement l'impossible (hors des tailles de l'espèce).
function check({ fish, size }) {
  const s = SIZES[fish];
  if (!s) return 'Espèce inconnue';
  if (!Number.isInteger(size) || size < s[0] || size > s[1]) return 'Taille impossible';
  return null;
}

module.exports = leaderboard({
  name: 'fisher-board',
  key: q => (Object.hasOwn(SIZES, String(q.fish)) ? String(q.fish) : null),
  read: b => ({ size: b.size }),
  check: (e, b) => check({ fish: b.fish, size: e.size }),
  rank: (a, b) => b.size - a.size || a.at - b.at,
  announce: (e, fish, place) => (place === 1 ? `${e.name} : record du monde de ${SIZES[fish][2]} (${e.size} cm) à Little Fisher` : null),
});
module.exports.check = check;
