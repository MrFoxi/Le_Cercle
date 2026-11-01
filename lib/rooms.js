// Salons temps réel communs aux jeux multijoueurs (codes, lobbys publics ou privés, reconnexion, spectateurs, chat).
// Chaque jeu fournit sa classe Room et la liste des actions que ses joueurs peuvent envoyer :
// une action « x » appelle room.x(pseudo, ...arguments), qui lève une erreur si le coup est interdit.
const crypto = require('crypto');
const activity = require('./activity');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I, pour dicter le code sans confusion
const EMPTY_ROOM_MS = 10 * 60 * 1000; // salon gardé 10 min quand plus personne n'est connecté
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

module.exports = function rooms(nsp, { Room, actions, onConnection }) {
  // code -> { room, sockets: Map(pseudo -> socket), tokens: Map(jeton -> pseudo), timer, chat, chatSeq }
  const rooms = new Map();
  activity.tables[nsp.name.slice(1)] = () => [...rooms.values()].filter(e => e.room.players.some(p => p.connected)).length; // pour le bandeau de l'accueil

  const newCode = () => {
    let code;
    do code = Array.from(crypto.randomBytes(5), b => ALPHABET[b % ALPHABET.length]).join('');
    while (rooms.has(code));
    return code;
  };

  // Parties visibles depuis l'accueil, pour les rejoindre ou les regarder.
  const listRooms = () => [...rooms.values()]
    .filter(e => !e.room.private && e.room.players.some(p => p.connected))
    .map(({ room: r }) => ({ code: r.code, players: r.players.map(p => p.name), phase: r.phase, round: r.round, spectators: r.spectators.filter(s => s.connected).length, ...r.summary?.() }));
  const broadcastRooms = () => nsp.emit('rooms', listRooms());

  const update = e => {
    for (const [name, s] of e.sockets) s.emit('state', { ...e.room.viewFor(name), chat: e.chat });
    broadcastRooms();
    // Étape chronométrée (jeux qui ont un room.deadline) : à l'heure dite, room.timeout() fait avancer la partie.
    clearTimeout(e.tick);
    if (e.room.deadline) e.tick = setTimeout(() => { e.room.timeout(); update(e); }, Math.max(0, e.room.deadline - Date.now()) + 50);
  };

  // Plus aucun joueur : le salon ferme, les spectateurs restants sont prévenus.
  const close = e => {
    clearTimeout(e.timer);
    clearTimeout(e.tick);
    for (const s of e.sockets.values()) s.emit('closed', 'Les joueurs ont quitté : la partie est terminée.');
    rooms.delete(e.room.code);
    broadcastRooms();
  };

  nsp.on('connection', socket => {
    let entry = null, me = null, lastChat = 0;
    socket.emit('rooms', listRooms());
    onConnection?.(socket, { get entry() { return entry; }, get me() { return me; } });
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
      e.room.notify = () => rooms.get(e.room.code) === e && update(e); // le salon change tout seul (coup d'un robot)
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
      if (!entry || !actions.includes(type)) return;
      try {
        if (!entry.room.get(me)) throw new Error('Les spectateurs ne peuvent pas jouer');
        entry.room[type](me, ...args);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
      update(entry);
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
