// Univers de Solar Explorer, sur le canal Socket.io « /solar ».
// Les salons (codes, privé/public, reconnexion) viennent de lib/rooms ; les positions des vaisseaux sont relayées à part,
// en « volatile » : une position perdue est vite remplacée par la suivante, inutile de la renvoyer.
const rooms = require('../lib/rooms');
const { Room, validPos } = require('./game');

const MIN_GAP_MS = 40; // 25 positions par seconde au plus, par pilote

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['setShip'],
  onConnection(socket, ctx) {
    let last = 0;
    socket.on('pos', p => {
      const { entry, me } = ctx;
      const now = Date.now();
      if (!entry?.room.get(me) || !validPos(p) || now - last < MIN_GAP_MS) return;
      last = now;
      for (const [name, s] of entry.sockets) if (name !== me) s.volatile.emit('pos', me, p);
    });
  },
});
