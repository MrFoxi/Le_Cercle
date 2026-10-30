// Salons temps réel du Surcoté / Sous-coté, sur le canal Socket.io « /cote ».
const crypto = require('crypto');
const { Room } = require('./game');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I, pour dicter le code sans confusion
const EMPTY_ROOM_MS = 10 * 60 * 1000; // salon gardé 10 min quand plus personne n'est connecté
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

module.exports = function cote(nsp) {
  const rooms = new Map(); // code -> { room, sockets: Map(pseudo -> socket), tokens: Map(jeton -> pseudo), timer }

  const newCode = () => {
    let code;
    do code = Array.from(crypto.randomBytes(5), b => ALPHABET[b % ALPHABET.length]).join('');
    while (rooms.has(code));
    return code;
  };

  const update = entry => {
    for (const [name, s] of entry.sockets) s.emit('state', entry.room.viewFor(name));
  };

  nsp.on('connection', socket => {
    let entry = null, me = null;

    // Associe ce navigateur au joueur ; le jeton secret permet de revenir après une coupure.
    const sit = (e, name, token) => {
      e.sockets.get(name)?.disconnect(); // un ancien onglet du même joueur est remplacé
      e.sockets.set(name, socket);
      clearTimeout(e.timer);
      e.room.get(name).connected = true;
      entry = e;
      me = name;
      socket.emit('session', { code: e.room.code, token });
      update(e);
    };

    const join = (e, name) => {
      e.room.addPlayer(name);
      const token = crypto.randomBytes(16).toString('hex');
      e.tokens.set(token, name);
      sit(e, name, token);
    };

    socket.on('create', (name, ack) => {
      name = clean(name, 20);
      if (!name) return ack?.({ error: 'Choisis un pseudo' });
      if (entry) return ack?.({ error: 'Tu es déjà dans un salon' });
      const e = { room: new Room(newCode()), sockets: new Map(), tokens: new Map(), timer: null };
      rooms.set(e.room.code, e);
      join(e, name);
      ack?.({ ok: true });
    });

    socket.on('join', ({ code, name } = {}, ack) => {
      name = clean(name, 20);
      const e = rooms.get(clean(code, 8).toUpperCase());
      if (!name) return ack?.({ error: 'Choisis un pseudo' });
      if (!e) return ack?.({ error: 'Aucun salon avec ce code' });
      if (entry) return ack?.({ error: 'Tu es déjà dans un salon' });
      try {
        join(e, name);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('resume', ({ code, token } = {}, ack) => {
      const e = rooms.get(clean(code, 8).toUpperCase());
      const name = e?.tokens.get(token);
      if (!name || !e.room.get(name)) return ack?.({ error: 'Ce salon n’existe plus' });
      sit(e, name, token);
      ack?.({ ok: true });
    });

    socket.on('act', (type, ...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.pop() : null;
      if (!entry || !['start', 'giveClue', 'guess', 'next'].includes(type)) return;
      try {
        if (type === 'start') entry.room.start(me);
        else if (type === 'next') entry.room.next(args[0]);
        else entry.room[type](me, ...args);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
      update(entry);
    });

    socket.on('leave', () => {
      if (!entry) return;
      const e = entry;
      e.sockets.delete(me);
      for (const [t, n] of e.tokens) if (n === me) e.tokens.delete(t);
      e.room.removePlayer(me);
      entry = me = null;
      if (!e.room.players.length) rooms.delete(e.room.code);
      else update(e);
    });

    socket.on('disconnect', () => {
      if (!entry || entry.sockets.get(me) !== socket) return; // remplacé par un autre onglet
      const e = entry;
      e.sockets.delete(me);
      e.room.get(me).connected = false;
      update(e);
      if (!e.sockets.size) e.timer = setTimeout(() => rooms.delete(e.room.code), EMPTY_ROOM_MS);
    });
  });
};
