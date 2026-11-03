// Salons de Chute Libre, sur le canal Socket.io « /chute ». Chaque joueur envoie sa position (« pos », 20 fois par seconde) ;
// le serveur renvoie l'état de l'arène à tout le salon (« snap ») depuis game.js.
const rooms = require('../../../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again'],
  onConnection(socket, ctx) {
    let last = 0;
    socket.on('pos', p => {
      const { entry, me } = ctx, now = Date.now();
      if (!entry?.room.get(me) || now - last < 35) return; // 28 positions par seconde au plus
      last = now;
      entry.room.move(me, p);
    });
  },
});
