// Salons du Demi-Cercle, sur le canal Socket.io « /cote ».
const rooms = require('../lib/rooms');
const { Room, THEMES } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'giveClue', 'guess', 'next', 'setThemes', 'toLobby'],
  onConnection(socket, ctx) {
    socket.emit('catalog', THEMES);
    // Aiguille du devineur en direct, retransmise aux seuls spectateurs (le donneur d'indice ne la voit qu'à la révélation).
    socket.on('aim', value => {
      const e = ctx.entry, r = e?.room, v = Number(value);
      if (!r || r.phase !== 'guess' || r.current.guesser !== ctx.me || !(v >= 0 && v <= 100)) return;
      for (const s of r.spectators) if (s.connected) e.sockets.get(s.name)?.emit('aim', v);
    });
  },
});
