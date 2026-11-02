// Salons de Top Formula, sur le canal Socket.io « /formula ». Les positions des voitures passent à part,
// en « volatile » (une position perdue est remplacée par la suivante), relayées aux autres membres du salon.
const rooms = require('../lib/rooms');
const { Room } = require('./game');

const num = v => typeof v === 'number' && Number.isFinite(v);

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'configure', 'setLook', 'ready', 'finish'],
  onConnection(socket, ctx) {
    let last = 0;
    socket.on('pos', p => {
      const { entry, me } = ctx, now = Date.now();
      if (!entry?.room.get(me) || entry.room.phase !== 'race' || now - last < 40) return; // 25 positions par seconde au plus
      if (!p || ![p.x, p.y, p.a, p.v, p.s, p.l].every(num)) return;
      last = now;
      const clean = { x: p.x, y: p.y, a: p.a, v: p.v, s: p.s, l: p.l, st: num(p.st) ? p.st : 0, d: p.d ? 1 : 0, f: num(p.f) ? p.f : null, b: num(p.b) ? p.b : null, k: num(p.k) ? p.k : 0 };
      entry.room.track(me, p.s);
      for (const [name, s] of entry.sockets) if (name !== me) s.volatile.emit('pos', me, clean);
    });
  },
});
