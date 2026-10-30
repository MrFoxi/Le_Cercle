const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Table, MAX_PLAYERS } = require('./game');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

const ACTIONS = ['start', 'bet', 'draw', 'reveal', 'stand', 'bankerDraw', 'challenge'];
const GRACE_MS = 60000, RESULTS_MS = 6000;
const lobbies = new Map(); // id -> { id, table, sockets: Map(pseudo -> socket), graces: Map(pseudo -> timer), timer }

const list = () => [...lobbies.values()].map(({ id, table }) => ({
  id, name: table.name, count: table.players.filter(p => !p.left).length, max: MAX_PLAYERS, playing: table.phase !== 'waiting',
}));
const sendLobbies = () => io.emit('lobbies', list());

// Envoie à chacun son état filtré, enchaîne la manche suivante, supprime le lobby vide.
function update(lobby) {
  const { table } = lobby;
  if (table.players.every(p => p.left)) {
    clearTimeout(lobby.timer);
    lobby.graces.forEach(clearTimeout);
    lobbies.delete(lobby.id);
    return sendLobbies();
  }
  for (const [name, s] of lobby.sockets) s.emit('state', table.viewFor(name));
  if (table.phase === 'results' && !lobby.timer) {
    lobby.timer = setTimeout(() => {
      lobby.timer = null;
      table.newRound();
      update(lobby);
    }, RESULTS_MS);
  }
  sendLobbies();
}

io.on('connection', socket => {
  let me = null, lobby = null;
  const fail = e => socket.emit('err', e.message);
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);

  function enter(l) {
    l.table.addPlayer(me);
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

  socket.on('hello', name => {
    if (lobby) return;
    me = clean(name, 20);
    if (!me) return fail(new Error('Pseudo requis'));
    socket.emit('lobbies', list());
    // Même pseudo revenu à temps : il retrouve sa place.
    const l = [...lobbies.values()].find(l => l.table.get(me)?.connected === false);
    if (l) enter(l);
  });

  socket.on('create', name => {
    name = clean(name, 30);
    if (!me || lobby || !name) return fail(new Error('Nom de lobby requis'));
    const l = { id: Math.random().toString(36).slice(2, 10), table: new Table(name), sockets: new Map(), graces: new Map(), timer: null };
    lobbies.set(l.id, l);
    enter(l);
  });

  socket.on('join', id => {
    const l = lobbies.get(id);
    if (!me || lobby || !l) return fail(new Error('Lobby introuvable'));
    try { enter(l); } catch (e) { fail(e); }
  });

  socket.on('leave', () => {
    exit(true);
    socket.emit('state', null);
  });

  socket.on('disconnect', () => exit(false));

  socket.on('act', (type, arg) => {
    if (!lobby || !ACTIONS.includes(type)) return;
    try { lobby.table[type](me, arg); } catch (e) { fail(e); }
    update(lobby);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`7,5 sur http://localhost:${port}`));
