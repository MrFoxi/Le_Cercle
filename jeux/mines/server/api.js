// Classement mondial du Démineur Rogue : top 10 du niveau atteint (à égalité : le plus de pièces gagnées),
// tous les temps, et un classement par partie du jour (même graine pour tout le monde).
const leaderboard = require('../../../lib/leaderboard');

// Partie du jour : aujourd'hui ou hier (fuseaux horaires), au format AAAA-MM-JJ. Classements « all » et « jour:AAAA-MM-JJ ».
const dayOk = d => [0, 1].some(k => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10) === d);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// shortcut: la partie se joue dans le navigateur ; on refuse seulement l'impossible (au moins 8 s par niveau, pièces plafonnées).
function check({ name, level, coins, seconds }) {
  if (!name) return 'Pseudo requis';
  if (![level, coins, seconds].every(Number.isInteger) || level < 1 || level > 500 || coins < 0) return 'Score invalide';
  if (coins > level * 3000 || seconds < level * 8) return 'Score invalide';
  return null;
}

module.exports = leaderboard({
  name: 'mines-board',
  key: q => (q.day === undefined ? 'all' : DAY.test(q.day) ? `jour:${q.day}` : null),
  read: b => ({ level: b.level, coins: b.coins, seconds: b.seconds }),
  check: (e, b) => check(e) || (b.day !== undefined && !dayOk(b.day) ? 'Partie du jour terminée' : null),
  rank: (a, b) => b.level - a.level || b.coins - a.coins || a.at - b.at,
  also: b => (b.day !== undefined ? ['all'] : []), // un score du jour compte aussi dans le classement de tous les temps
  prune: boards => { for (const k of Object.keys(boards).filter(k => k.startsWith('jour:')).sort().slice(0, -7)) delete boards[k]; }, // 7 derniers jours
  migrate: v => { const { all = [], days = {}, ...rest } = v; return { ...rest, all, ...Object.fromEntries(Object.entries(days).map(([d, l]) => [`jour:${d}`, l])) }; }, // ancien format { all, days }
  announce: e => { const bosses = Math.floor((e.level - 1) / 5); return `${e.name} a atteint le niveau ${e.level} au Démineur Rogue${bosses ? ` (${bosses} boss battu${bosses > 1 ? 's' : ''})` : ''}`; },
});
