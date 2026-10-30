// Salons temps réel du Demi-Cercle, sur le canal Socket.io « /cote » : joueurs, spectateurs et chat.
const crypto = require('crypto');
const { Room, THEMES } = require('./game');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I, pour dicter le code sans confusion
const EMPTY_ROOM_MS = 10 * 60 * 1000; // salon gardé 10 min quand plus personne n'est connecté
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

module.exports = function cote(nsp) {
  // code -> { room, sockets: Map(pseudo -> socket), tokens: Map(jeton -> pseudo), timer, chat, chatSeq }
  const rooms = new Map();

  const newCode = () => {
    let code;
    do code = Array.from(crypto.randomBytes(5), b => ALPHABET[b % ALPHABET.length]).join('');
    while (rooms.has(code));
    return code;
  };

  // Parties visibles depuis l'accueil, pour les rejoindre ou les regarder.
  const listRooms = () => [...rooms.values()]
    .filter(e => !e.room.private && e.room.players.some(p => p.connected))
    .map(({ room: r }) => ({ code: r.code, players: r.players.map(p => p.name), phase: r.phase, round: r.round, spectators: r.spectators.filter(s => s.connected).length }));
  const broadcastRooms = () => nsp.emit('rooms', listRooms());

  const update = e => {
    for (const [name, s] of e.sockets) s.emit('state', { ...e.room.viewFor(name), chat: e.chat });
    broadcastRooms();
  };

  // Plus aucun joueur : le salon ferme, les spectateurs restants sont prévenus.
  const close = e => {
    clearTimeout(e.timer);
    for (const s of e.sockets.values()) s.emit('closed', 'Les joueurs ont quitté : la partie est terminée.');
    rooms.delete(e.room.code);
    broadcastRooms();
  };

  nsp.on('connection', socket => {
    let entry = null, me = null, lastChat = 0;
    socket.emit('catalog', THEMES);
    socket.emit('rooms', listRooms());
    const member = () => entry.room.get(me) ?? entry.room.spectator(me);

    // Associe ce navigateur à sa place ; le jeton secret permet de revenir après une coupure.
    const sit = (e, name, token) => {
      e.sockets.get(name)?.disconnect(); // un ancien onglet de la même personne est remplacé
      e.sockets.set(name, socket);
      clearTimeout(e.timer);
      entry = e;
      me = name;
      member().connected = true;
      socket.emit('session', { code: e.room.code, token });
      update(e);
    };

    const enter = (e, name, spectator) => {
      spectator ? e.room.addSpectator(name) : e.room.addPlayer(name);
      const token = crypto.randomBytes(16).toString('hex');
      e.tokens.set(token, name);
      sit(e, name, token);
    };

    socket.on('create', ({ name, private: isPrivate } = {}, ack) => {
      name = clean(name, 20);
      if (!name) return ack?.({ error: 'Choisis un pseudo' });
      if (entry) return ack?.({ error: 'Tu es déjà dans un salon' });
      const e = { room: new Room(newCode(), Math.random, !!isPrivate), sockets: new Map(), tokens: new Map(), timer: null, chat: [], chatSeq: 0 };
      rooms.set(e.room.code, e);
      enter(e, name, false);
      ack?.({ ok: true });
    });

    // Rejoindre comme joueur, ou comme spectateur (watch: true).
    socket.on('join', ({ code, name, watch } = {}, ack) => {
      name = clean(name, 20);
      const e = rooms.get(clean(code, 8).toUpperCase());
      if (!name) return ack?.({ error: 'Choisis un pseudo' });
      if (!e) return ack?.({ error: 'Aucun salon avec ce code' });
      if (entry) return ack?.({ error: 'Tu es déjà dans un salon' });
      try {
        enter(e, name, !!watch);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('resume', ({ code, token } = {}, ack) => {
      const e = rooms.get(clean(code, 8).toUpperCase());
      const name = e?.tokens.get(token);
      if (!name || !e.room.taken(name)) return ack?.({ error: 'Ce salon n’existe plus' });
      sit(e, name, token);
      ack?.({ ok: true });
    });

    socket.on('act', (type, ...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.pop() : null;
      if (!entry || !['start', 'giveClue', 'guess', 'next', 'setThemes', 'toLobby'].includes(type)) return;
      try {
        if (!entry.room.get(me)) throw new Error('Les spectateurs ne peuvent pas jouer');
        if (type === 'start') entry.room.start(me);
        else if (type === 'next') entry.room.next(args[0]);
        else if (type === 'toLobby') entry.room.toLobby();
        else entry.room[type](me, ...args);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
      update(entry);
    });

    // Aiguille du devineur en direct, retransmise aux seuls spectateurs (le donneur d'indice ne la voit qu'à la révélation).
    socket.on('aim', value => {
      const r = entry?.room, v = Number(value);
      if (!r || r.phase !== 'guess' || r.current.guesser !== me || !(v >= 0 && v <= 100)) return;
      for (const s of r.spectators) if (s.connected) entry.sockets.get(s.name)?.emit('aim', v);
    });

    socket.on('chat', text => {
      text = clean(text, 200);
      if (!entry || !text || Date.now() - lastChat < 500) return; // anti-spam : 2 messages par seconde
      lastChat = Date.now();
      entry.chat.push({ id: ++entry.chatSeq, name: me, text, spectator: !entry.room.get(me) });
      if (entry.chat.length > 100) entry.chat.shift();
      update(entry);
    });

    socket.on('leave', () => {
      if (!entry) return;
      const e = entry;
      e.sockets.delete(me);
      for (const [t, n] of e.tokens) if (n === me) e.tokens.delete(t);
      if (e.room.get(me)) e.room.removePlayer(me);
      else e.room.removeSpectator(me);
      entry = me = null;
      if (!e.room.players.length) close(e);
      else update(e);
    });

    socket.on('disconnect', () => {
      if (!entry || entry.sockets.get(me) !== socket) return; // remplacé par un autre onglet
      const e = entry;
      e.sockets.delete(me);
      member().connected = false;
      update(e);
      if (!e.sockets.size) e.timer = setTimeout(() => close(e), EMPTY_ROOM_MS);
    });
  });
};
