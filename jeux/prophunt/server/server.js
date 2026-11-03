// Salons de Prop Hunt, sur le canal Socket.io « /prophunt ». Positions (« pos ») et tirs (« tag ») passent hors des actions
// pour aller vite, comme les moqueries (« taunt ») et les gadgets (« radar », « grenade ») ; le serveur renvoie les positions
// (« snap ») et les effets (« fx » : trouvé, raté, moquerie, radar, confettis).
const rooms = require('../../../lib/rooms');
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
    socket.on('taunt', kind => typeof kind === 'string' && mine()?.taunt(ctx.me, kind));
    socket.on('radar', ack => { const pings = mine()?.radar(ctx.me); if (typeof ack === 'function') ack(pings ?? null); }); // la réponse ne va qu'au chasseur
    socket.on('grenade', p => p && mine()?.grenade(ctx.me, p.x, p.z));
  },
});
