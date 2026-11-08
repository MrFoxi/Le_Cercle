// Le Cercle : un seul serveur pour tous les jeux. Chaque jeu vit dans jeux/<jeu>/ et y est trouvé tout seul :
//   client/        servi à l'adresse /<jeu>/
//   server/server.js   (s'il existe) branché sur le canal Socket.io « /<jeu> »
//   server/api.js      (s'il existe) servi sur /api/<jeu>
// La page d'accueil est dans site/.
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const activity = require('./lib/activity');
const admin = require('./lib/admin');

const GAMES = fs.readdirSync(path.join(__dirname, 'jeux')).filter(g => fs.existsSync(path.join(__dirname, 'jeux', g, 'client')));
const has = (g, f) => fs.existsSync(path.join(__dirname, 'jeux', g, 'server', f));

const app = express();
app.set('trust proxy', 1); // derrière Render : la vraie adresse du joueur (limite des essais de mot de passe)
// Pingée de l'extérieur pour empêcher Render de mettre le serveur en veille.
app.get('/health', (req, res) => res.send('ok'));
app.use('/api/admin', admin.router);
for (const g of GAMES) if (has(g, 'api.js')) app.use(`/api/${g}`, require(`./jeux/${g}/server/api`));
app.get('/imposteur/engine.js', (req, res) => res.type('js').send(require('./jeux/imposteur/server/engine'))); // règles de L'Imposteur pour le mode un seul appareil
// Three.js, servi depuis node_modules (pas de CDN)
app.use('/vendor/three/build', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/three/addons', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
for (const g of GAMES) app.use(`/${g}`, express.static(path.join(__dirname, 'jeux', g, 'client')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use(express.static(path.join(__dirname, 'site')));

const server = http.createServer(app);
const sockets = new Server(server);
// Chaque jeu multijoueur a son propre canal Socket.io.
const ONLINE = GAMES.filter(g => has(g, 'server.js'));
for (const g of ONLINE) require(`./jeux/${g}/server/server`)(sockets.of(`/${g}`));
// Nombre de personnes connectées à chaque jeu, et bandeau d'activité de l'accueil (parties ouvertes, derniers exploits).
const online = () => Object.fromEntries(ONLINE.map(n => [n, sockets.of('/' + n).sockets.size]));
app.get('/api/online', (req, res) => res.json(online()));
app.get('/api/activity', (req, res) => res.json({ online: online(), tables: activity.openTables(), recent: activity.recent() }));

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Le Cercle sur http://localhost:${port} (${GAMES.length} jeux)`));
