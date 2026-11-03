// Les règles de L'Imposteur (words.js + game.js, et le socle lib/room-base.js), emballées en module pour le navigateur :
// le mode « un seul appareil » joue avec exactement le même moteur que le serveur, sans copie à maintenir.
const fs = require('fs');
const path = require('path');

const src = f => fs.readFileSync(path.join(__dirname, `${f}.js`), 'utf8');
const lib = f => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', `${f}.js`), 'utf8');
module.exports = `// Généré par jeux/imposteur/server/engine.js
const mods = {};
const load = (name, fn) => { const module = { exports: {} }; fn(module, n => mods[n.split('/').pop()]); mods[name] = module.exports; }; // require par nom de fichier
load('room-base', (module, require) => {
${lib('room-base')}
});
load('words', (module, require) => {
${src('words')}
});
load('game', (module, require) => {
${src('game')}
});
export const { Room, roleCounts, POINTS, MIN_PLAYERS, MAX_PLAYERS } = mods.game;
export const { CATEGORIES } = mods.words;
`;
