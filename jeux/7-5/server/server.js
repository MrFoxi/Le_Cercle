// Le Cercle du 7,5 : tables (« lobbys »), reconnexion pendant 60 s, exclusion et bannissement, chat, manches enchaînées.
// Le premier jeu du site : il a sa propre gestion de salons (les autres jeux passent par lib/rooms.js).
const { Table, MAX_PLAYERS } = require('./game');
const activity = require('../../../lib/activity');
const admin = require('../../../lib/admin');

module.exports = io => {
  const ACTIONS = ['start', 'bet', 'draw', 'reveal', 'stand', 'bankerDraw', 'challenge', 'kick', 'ban'];
  const GRACE_MS = 60000, RESULTS_MS = 6000;
  const lobbies = new Map(); // id -> { id, table, sockets: Map(pseudo -> socket), graces: Map(pseudo -> timer), timer, chat, chatSeq }
  activity.tables['7-5'] = () => lobbies.size;

  const list = () => [...lobbies.values()].map(({ id, table }) => ({
    id, name: table.name, max: MAX_PLAYERS, playing: table.phase !== 'waiting',
    players: table.players.filter(p => !p.left).map(p => ({ name: p.name, avatar: p.avatar })),
  }));
  const sendLobbies = () => io.emit('lobbies', list());
  // Page d'administration : voir les tables et en fermer une (tout le monde est renvoyé à l'accueil)
  admin.rooms['7-5'] = {
    list: () => [...lobbies.values()].map(({ id, table, created }) => ({ code: id, private: false, phase: table.phase, created, max: 8, players: table.players.filter(p => !p.left).map(p => ({ name: p.name, connected: p.connected !== false, bot: false })), spectators: [] })),
    close: code => {
      const l = lobbies.get(code); if (!l) return false;
      for (const [, s] of l.sockets) { s.ejected(); s.emit('state', null); s.emit('err', 'Cette table a été fermée par l’administrateur'); }
      clearTimeout(l.timer); clearTimeout(l.turnTimer); l.graces.forEach(clearTimeout);
      lobbies.delete(code); sendLobbies(); return true;
    },
    kick: (code, name) => {
      const l = lobbies.get(code), real = l?.table.players.find(p => !p.left && p.name.toLowerCase() === name.toLowerCase())?.name;
      if (!real) return false;
      const s = l.sockets.get(real);
      eject(l, real, false); l.table.leave(real);
      s?.emit('err', 'Tu as été exclu de la table par l’administrateur');
      update(l); return true;
    },
    say: (code, text) => { const l = lobbies.get(code); if (!l) return false; l.chat.push({ id: ++l.chatSeq, name: '📣 Administrateur', text }); if (l.chat.length > 100) l.chat.shift(); update(l); admin.notify('7-5', l.table.players.filter(p => !p.left).map(p => p.name), text); return true; },
  };

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
      if (admin.reserved(me, socket.handshake.headers.cookie)) { const m = me; me = null; return fail(new Error(admin.reserved(m, socket.handshake.headers.cookie))); }
      socket.emit('lobbies', list());
      // Même pseudo revenu à temps : il retrouve sa place.
      const l = [...lobbies.values()].find(l => l.table.get(me)?.connected === false && !l.table.get(me).left);
      if (l) enter(l);
    });

    socket.on('create', name => {
      name = clean(name, 30);
      if (!me || lobby || !name) return fail(new Error('Nom de lobby requis'));
      const l = { id: Math.random().toString(36).slice(2, 10), table: new Table(name), sockets: new Map(), graces: new Map(), timer: null, chat: [], chatSeq: 0, created: Date.now() };
      admin.event('room', '7-5', `${me} ouvre une table`);
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
};
