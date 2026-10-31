// Salons du Mini-golf, sur le canal Socket.io « /golf ». Les émotes passent à part, en « volatile » (rien à garder).
const rooms = require('../lib/rooms');
const { Room } = require('./game');

const EMOTES = ['👏', '😂', '😱', '🔥', '😎', '🙏', '💩', '❤️'];

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['start', 'shoot', 'toLobby', 'configure', 'addBot', 'removeBot', 'setLook', 'bet'],
  onConnection(socket, ctx) {
    let last = 0;
    socket.on('emote', e => {
      const { entry, me } = ctx, now = Date.now();
      if (!entry?.room.taken(me) || !EMOTES.includes(e) || now - last < 700) return;
      last = now;
      for (const s of entry.sockets.values()) s.volatile.emit('emote', me, e);
    });
  },
});
module.exports.EMOTES = EMOTES;
