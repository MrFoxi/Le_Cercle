// Classement mondial du flipper : un top 10 par table.
const leaderboard = require('../../../lib/leaderboard');

const TABLE_NAMES = { arcade: 'Arcade', space: 'Espace', casino: 'Casino', jungle: 'Jungle', volcan: 'Volcan' };
const MAX_PER_SECOND = 400000; // plafond de vraisemblance : bien au-dessus d'une partie réelle, même en multiball

// shortcut: le score vient du navigateur (jeu solo) ; on refuse seulement l'impossible.
function check({ table, name, score, seconds }) {
  if (!Object.hasOwn(TABLE_NAMES, table)) return 'Table inconnue';
  if (!name) return 'Pseudo requis';
  if (!Number.isInteger(score) || score <= 0 || score % 10) return 'Score invalide';
  if (!Number.isInteger(seconds) || seconds < 5 || score > seconds * MAX_PER_SECOND) return 'Score invalide';
  return null;
}

module.exports = leaderboard({
  name: 'pinball-board',
  key: q => (Object.hasOwn(TABLE_NAMES, String(q.table)) ? String(q.table) : null),
  read: b => ({ score: b.score, seconds: b.seconds }),
  check: (e, b) => check({ ...e, table: b.table }),
  rank: (a, b) => b.score - a.score || a.at - b.at,
  announce: (e, table) => `${e.name} : ${e.score.toLocaleString('fr-FR')} points au Pinball (table ${TABLE_NAMES[table]})`,
});
module.exports.check = check;
