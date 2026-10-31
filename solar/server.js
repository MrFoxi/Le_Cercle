// Univers de Solar Explorer, sur le canal Socket.io « /solar ».
// Les salons (codes, privé/public, reconnexion, chat, événements chronométrés) viennent de lib/rooms ;
// positions, pings et émotes sont relayés à part, en « volatile » : un message perdu est vite remplacé par le suivant.
const rooms = require('../lib/rooms');
const { Room, EMOTES, validPos, validPing } = require('./game');

const GAPS = { pos: 40, ping: 1000, emote: 800 }; // délai minimal entre deux messages d'un même pilote (ms)

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['setShip'],
  onConnection(socket, ctx) {
    const last = { pos: 0, ping: 0, emote: 0 };
    const relay = (type, valid) => socket.on(type, data => {
      const { entry, me } = ctx;
      const now = Date.now();
      if (!entry?.room.get(me) || !valid(data) || now - last[type] < GAPS[type]) return;
      last[type] = now;
      for (const [name, s] of entry.sockets) if (name !== me) s.volatile.emit(type, me, data);
    });
    relay('pos', validPos);
    relay('ping', validPing);
    relay('emote', e => EMOTES.includes(e));
  },
});
