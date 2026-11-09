// Salons du Loup-Garou, sur le canal Socket.io « /loupgarou ». Positions (« pos »), emotes (« emote ») et objets lancés
// (« toss ») passent hors des actions pour aller vite ; le serveur renvoie les positions (« snap ») et les effets (« fx »).
const rooms = require('../../../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again', 'dress', 'wolf', 'see', 'potion', 'shoot', 'vote', 'rush', 'whisper'],
  onConnection(socket, ctx) {
    let last = 0;
    const mine = () => ctx.entry?.room.get(ctx.me) && ctx.entry.room;
    socket.on('pos', p => { const now = Date.now(); if (now - last < 40) return; last = now; mine()?.move(ctx.me, p); });
    socket.on('emote', (e, to) => typeof e === 'string' && mine()?.emote(ctx.me, e, typeof to === 'string' ? to : null));
    socket.on('toss', (item, to) => typeof item === 'string' && typeof to === 'string' && mine()?.toss(ctx.me, item, to));
  },
});
