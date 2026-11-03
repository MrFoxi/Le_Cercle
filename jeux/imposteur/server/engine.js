// Les règles de L'Imposteur (words.js + game.js), emballées en module pour le navigateur :
// le mode « un seul appareil » joue avec exactement le même moteur que le serveur, sans copie à maintenir.
const fs = require('fs');
const path = require('path');

const src = f => fs.readFileSync(path.join(__dirname, `${f}.js`), 'utf8');
module.exports = `// Généré par imposteur/engine.js
const mods = {};
const load = (name, fn) => { const module = { exports: {} }; fn(module, n => mods[n.replace('./', '')]); mods[name] = module.exports; };
load('words', (module, require) => {
${src('words')}
});
load('game', (module, require) => {
${src('game')}
});
export const { Room, roleCounts, POINTS, MIN_PLAYERS, MAX_PLAYERS } = mods.game;
export const { CATEGORIES } = mods.words;
`;
