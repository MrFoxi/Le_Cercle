// Little Fisher à plusieurs, sur le canal Socket.io « /fisher ». Les salons viennent de lib/rooms ;
// positions des bateaux et annonces de prises sont relayées à part (les positions en « volatile » : la suivante remplace la perdue).
const rooms = require('../../../lib/rooms');
const { Room, validPos, validCatch } = require('./game');

const GAPS = { pos: 60, catch: 1500 }; // délai minimal entre deux messages d'un même pêcheur (ms)

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['setBoat'],
  onConnection(socket, ctx) {
    const last = { pos: 0, catch: 0 };
    const relay = (type, valid, volatile) => socket.on(type, data => {
      const { entry, me } = ctx, now = Date.now();
      if (!entry?.room.get(me) || !valid(data) || now - last[type] < GAPS[type]) return;
      last[type] = now;
      for (const [name, s] of entry.sockets) if (name !== me) (volatile ? s.volatile : s).emit(type, me, data);
    });
    relay('pos', validPos, true);
    relay('catch', validCatch, false);
  },
});
