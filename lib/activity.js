// Activité du site pour le bandeau de l'accueil : derniers exploits (gardés dans la base, ils survivent aux redéploiements)
// et parties ouvertes par jeu (en direct, en mémoire).
const store = require('./store');
let recent = [];
store.load('activity', []).then(v => { recent = [...recent, ...v].slice(0, 20); }); // ce qui est arrivé pendant la lecture passe devant
const tables = {}; // jeu -> () => nombre de parties ouvertes

module.exports = {
  tables,
  log(text) {
    recent.unshift({ text: String(text).slice(0, 140), at: Date.now() });
    recent = recent.slice(0, 20);
    store.save('activity', recent);
  },
  recent: () => recent.filter(e => Date.now() - e.at < 24 * 3600 * 1000),
  openTables: () => Object.fromEntries(Object.entries(tables).map(([k, f]) => [k, f()])),
};
