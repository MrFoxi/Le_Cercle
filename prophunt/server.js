// Salons de Prop Hunt, sur le canal Socket.io « /prophunt ». Positions (« pos ») et tirs (« tag ») passent hors des actions
// pour aller vite ; le serveur renvoie les positions (« snap ») et les effets (« fx » : trouvé, raté, sifflet).
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'addBot', 'removeBot', 'again', 'disguise'],
  onConnection(socket, ctx) {
    let last = 0;
    const mine = () => ctx.entry?.room.get(ctx.me) && ctx.entry.room;
    socket.on('pos', p => { const now = Date.now(); if (now - last < 40) return; last = now; mine()?.move(ctx.me, p); });
    socket.on('tag', t => { const r = mine(); if (!r || !t) return; r.tag(ctx.me, typeof t.player === 'string' ? { player: t.player } : Number.isInteger(t.decor) ? { decor: t.decor } : null); });
    socket.on('whistle', () => mine()?.whistle(ctx.me));
  },
});
