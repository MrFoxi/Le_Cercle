// Salons de Caboche Cup, sur le canal Socket.io « /caboche ». Les touches (« in ») passent hors des actions pour aller
// vite ; le serveur renvoie l'état du match 30 fois par seconde (« snap ») depuis game.js.
const rooms = require('../../../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again', 'pick'],
  onConnection(socket, ctx) {
    socket.on('in', list => { const r = ctx.entry?.room; if (r?.get(ctx.me)) r.input(ctx.me, list); });
  },
});
