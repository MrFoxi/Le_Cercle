// Activité du site pour le bandeau de l'accueil : derniers exploits (en mémoire) et parties ouvertes par jeu.
// shortcut: tout est en mémoire et repart de zéro à chaque redémarrage du serveur ; suffisant pour un bandeau « en direct ».
const recent = [];
const tables = {}; // jeu -> () => nombre de parties ouvertes

module.exports = {
  tables,
  log(text) {
    recent.unshift({ text: String(text).slice(0, 140), at: Date.now() });
    recent.length = Math.min(recent.length, 20);
  },
  recent: () => recent.filter(e => Date.now() - e.at < 24 * 3600 * 1000),
  openTables: () => Object.fromEntries(Object.entries(tables).map(([k, f]) => [k, f()])),
};
