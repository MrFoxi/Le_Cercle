// Salons du Puissance 4, sur le canal Socket.io « /p4 ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'play', 'requestRematch', 'declineRematch', 'toLobby'],
  // Colonne survolée par le joueur dont c'est le tour : relayée en direct (volatile, rien à garder) à l'adversaire et aux spectateurs.
  onConnection(socket, ctx) {
    socket.on('hover', col => {
      const { entry, me } = ctx, room = entry?.room;
      if (room?.phase !== 'playing' || room.turn !== me) return;
      col = Number.isInteger(col) && col >= 0 && col < 7 ? col : null;
      for (const [name, s] of entry.sockets) if (name !== me) s.volatile.emit('hover', col);
    });
  },
});
