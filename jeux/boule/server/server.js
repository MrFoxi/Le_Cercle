// Salons de Boule de Pute, sur le canal Socket.io « /boule ». Les touches (« in ») passent hors des actions pour aller
// vite ; le serveur renvoie l'état de la manche 30 fois par seconde (« snap ») depuis game.js.
const rooms = require('../../../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again', 'pick'],
  onConnection(socket, ctx) {
    socket.on('in', list => { const r = ctx.entry?.room; if (r?.get(ctx.me)) r.input(ctx.me, list); });
  },
});
