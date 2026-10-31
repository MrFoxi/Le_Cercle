const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Table, MAX_PLAYERS } = require('./game');

const app = express();
// Pingée de l'extérieur pour empêcher Render de mettre le serveur en veille.
app.get('/health', (req, res) => res.send('ok'));
app.use('/api/size', require('./size/api')); // Size It Up : les vraies tailles restent côté serveur
app.get('/imposteur/engine.js', (req, res) => res.type('js').send(require('./imposteur/engine'))); // règles de L'Imposteur pour le mode un seul appareil
// Three.js pour Solar Explorer, servi depuis node_modules (pas de CDN)
app.use('/vendor/three/build', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/three/addons', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const sockets = new Server(server);
const io = sockets.of('/7-5'); // chaque projet du site a son propre canal Socket.io
require('./cote/server')(sockets.of('/cote')); // Le Demi-Cercle
require('./p4/server')(sockets.of('/p4')); // Puissance 4
require('./imposteur/server')(sockets.of('/imposteur')); // L'Imposteur
require('./bataille/server')(sockets.of('/bataille')); // Bataille navale
require('./solar/server')(sockets.of('/solar')); // Solar Explorer
require('./golf/server')(sockets.of('/golf')); // Mini-golf

const ACTIONS = ['start', 'bet', 'draw', 'reveal', 'stand', 'bankerDraw', 'challenge', 'kick', 'ban'];
const GRACE_MS = 60000, RESULTS_MS = 6000;
const lobbies = new Map(); // id -> { id, table, sockets: Map(pseudo -> socket), graces: Map(pseudo -> timer), timer, chat, chatSeq }

const list = () => [...lobbies.values()].map(({ id, table }) => ({
  id, name: table.name, max: MAX_PLAYERS, playing: table.phase !== 'waiting',
  players: table.players.filter(p => !p.left).map(p => ({ name: p.name, avatar: p.avatar })),
}));
const sendLobbies = () => io.emit('lobbies', list());

// Envoie à chacun son état filtré, enchaîne la manche suivante, supprime le lobby vide.
function update(lobby) {
  const { table } = lobby;
  if (table.players.every(p => p.left)) {
    clearTimeout(lobby.timer);
    clearTimeout(lobby.turnTimer);
    lobby.graces.forEach(clearTimeout);
    lobbies.delete(lobby.id);
    return sendLobbies();
  }
  for (const [name, s] of lobby.sockets) s.emit('state', { ...table.viewFor(name), id: lobby.id, chat: lobby.chat });
  clearTimeout(lobby.turnTimer);
  if (table.deadline) {
    lobby.turnTimer = setTimeout(() => {
      table.timeout();
      update(lobby);
    }, Math.max(0, table.deadline - Date.now()) + 50);
  }
  if (table.phase === 'results' && !lobby.timer) {
    lobby.timer = setTimeout(() => {
      lobby.timer = null;
      table.newRound();
      update(lobby);
    }, RESULTS_MS);
  }
  sendLobbies();
}

// Sort de la table le socket d'un joueur exclu ou banni.
function eject(lobby, name, banned) {
  clearTimeout(lobby.graces.get(name));
  lobby.graces.delete(name);
  const s = lobby.sockets.get(name);
  if (!s) return;
  lobby.sockets.delete(name);
  s.ejected();
  s.emit('state', null);
  s.emit('err', banned ? 'Tu as été banni de cette table' : 'Tu as été exclu de la table');
}

io.on('connection', socket => {
  let me = null, avatar = '', lobby = null, lastChat = 0;
  socket.ejected = () => (lobby = null);
  const fail = e => socket.emit('err', e.message);
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);

  function enter(l) {
    l.table.addPlayer(me, avatar);
    clearTimeout(l.graces.get(me));
    l.graces.delete(me);
    l.sockets.set(me, socket);
    lobby = l;
    update(l);
  }

  function exit(leaving) {
    if (!lobby) return;
    const l = lobby, name = me;
    lobby = null;
    l.sockets.delete(name);
    if (leaving) l.table.leave(name);
    else {
      l.table.disconnect(name);
      l.graces.set(name, setTimeout(() => {
        l.graces.delete(name);
        l.table.leave(name);
        update(l);
      }, GRACE_MS));
    }
    update(l);
  }

  socket.on('hello', (name, av) => {
    if (lobby) return;
    me = clean(name, 20);
    avatar = clean(av, 8); // un emoji peut faire plusieurs caractères
    if (!me) return fail(new Error('Pseudo requis'));
    socket.emit('lobbies', list());
    // Même pseudo revenu à temps : il retrouve sa place.
    const l = [...lobbies.values()].find(l => l.table.get(me)?.connected === false && !l.table.get(me).left);
    if (l) enter(l);
  });

  socket.on('create', name => {
    name = clean(name, 30);
    if (!me || lobby || !name) return fail(new Error('Nom de lobby requis'));
    const l = { id: Math.random().toString(36).slice(2, 10), table: new Table(name), sockets: new Map(), graces: new Map(), timer: null, chat: [], chatSeq: 0 };
    lobbies.set(l.id, l);
    enter(l);
  });

  socket.on('join', id => {
    const l = lobbies.get(id);
    if (lobby) return; // déjà assis (ex. lien d'invitation après une reconnexion)
    if (!me || !l) return fail(new Error('Lobby introuvable'));
    try { enter(l); } catch (e) { fail(e); }
  });

  socket.on('leave', () => {
    exit(true);
    socket.emit('state', null);
  });

  socket.on('disconnect', () => exit(false));

  socket.on('act', (type, arg) => {
    if (!lobby || !ACTIONS.includes(type)) return;
    const l = lobby;
    try {
      l.table[type](me, arg);
      if (type === 'kick' || type === 'ban') eject(l, arg, type === 'ban');
    } catch (e) { fail(e); }
    update(l);
  });

  socket.on('chat', text => {
    text = clean(text, 200);
    if (!lobby || !text || Date.now() - lastChat < 500) return; // anti-spam : 2 messages par seconde
    lastChat = Date.now();
    lobby.chat.push({ id: ++lobby.chatSeq, name: me, text });
    if (lobby.chat.length > 100) lobby.chat.shift();
    update(lobby);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`7,5 sur http://localhost:${port}`));
