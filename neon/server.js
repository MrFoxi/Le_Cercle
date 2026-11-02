// Salons de Sillage Néon, sur le canal Socket.io « /neon ». Les virages et le turbo passent hors des actions
// (« turn », « boost ») pour aller vite ; « sync » renvoie la grille complète à qui arrive en cours de manche.
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again'],
  onConnection(socket, ctx) {
    let last = 0;
    const mine = () => ctx.entry?.room.get(ctx.me) && ctx.entry.room;
    socket.on('turn', d => { const now = Date.now(); if (now - last < 15) return; last = now; mine()?.turn(ctx.me, d); });
    socket.on('boost', () => mine()?.boost(ctx.me));
    socket.on('sync', ack => typeof ack === 'function' && ctx.entry && ack(ctx.entry.room.dump()));
  },
});
