// Classement mondial de Boule de Pute, mode Survie : le plus de vagues de robots repoussées (à égalité : le plus de renvois).
const leaderboard = require('../../../lib/leaderboard');

// shortcut: le score est envoyé par le navigateur ; on refuse seulement l'impossible (au moins 6 s par vague et un
// renvoi par vague). À faire inscrire par le serveur de jeu si le classement devient un enjeu.
function check({ waves, reflects, seconds }) {
  if (![waves, reflects, seconds].every(Number.isInteger) || waves < 1 || waves > 300 || reflects < waves || reflects > waves * 400 || seconds < waves * 6) return 'Score invalide';
  return null;
}

module.exports = leaderboard({
  name: 'boule-board',
  key: q => (q.mode === 'survie' ? 'survie' : null),
  read: b => ({ waves: b.waves, reflects: b.reflects, seconds: b.seconds }),
  check: e => check(e),
  rank: (a, b) => b.waves - a.waves || b.reflects - a.reflects || a.at - b.at,
  announce: e => `${e.name} a repoussé ${e.waves} vague${e.waves > 1 ? 's' : ''} de robots en Survie à Boule de Pute`,
});
