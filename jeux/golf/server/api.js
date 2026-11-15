// Classement mondial du mode Aventure (la Tour) : le moins de coups pour atteindre le trou du sommet, puis le plus rapide.
// Deux classements : normal et hardcore (le mode zen ne compte pas).
const leaderboard = require('../../../lib/leaderboard');

// shortcut: le score est envoyé par le navigateur ; on refuse seulement l'impossible (au moins 12 coups pour 98 m,
// au moins 2 s par coup). À faire vérifier par le serveur (en rejouant les coups) si le classement devient un enjeu.
function check({ shots, seconds, shards }) {
  if (![shots, seconds, shards].every(Number.isInteger) || shots < 12 || shots > 9999 || seconds < shots * 2 || shards < 0 || shards > 9) return 'Score invalide';
  return null;
}

module.exports = leaderboard({
  name: 'golf-tour-board',
  key: q => (q.mode === 'normal' || q.mode === 'hardcore' ? q.mode : null),
  read: b => ({ shots: b.shots, seconds: b.seconds, shards: b.shards }),
  check: e => check(e),
  rank: (a, b) => a.shots - b.shots || a.seconds - b.seconds || a.at - b.at,
  announce: (e, k) => `${e.name} a atteint le sommet de la Tour en ${e.shots} coups${k === 'hardcore' ? ' (hardcore)' : ''} au mini-golf`,
});
