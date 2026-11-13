// Classement mondial de Caboche Cup, mode Survie : la plus longue série de robots battus (à égalité : le plus de buts).
const leaderboard = require('../../../lib/leaderboard');

// shortcut: la survie se joue dans le navigateur ; on refuse seulement l'impossible (au moins 5 s par robot battu,
// des buts au moins égaux à la série). À sécuriser côté serveur si le classement devient un enjeu.
function check({ streak, goals, seconds }) {
  if (![streak, goals, seconds].every(Number.isInteger) || streak < 1 || streak > 500 || goals < streak || goals > streak * 10) return 'Score invalide';
  if (seconds < streak * 5) return 'Score invalide';
  return null;
}

module.exports = leaderboard({
  name: 'caboche-board',
  key: q => (q.mode === 'survie' ? 'survie' : null),
  read: b => ({ streak: b.streak, goals: b.goals, seconds: b.seconds }),
  check: e => check(e),
  rank: (a, b) => b.streak - a.streak || b.goals - a.goals || a.at - b.at,
  announce: e => `${e.name} a battu ${e.streak} robot${e.streak > 1 ? 's' : ''} d’affilée en Survie à la Caboche Cup`,
});
