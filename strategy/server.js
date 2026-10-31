// Salons du Strategy Club, sur le canal Socket.io « /strategy ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, {
  Room,
  actions: ['configure', 'sit', 'addBot', 'removeBot', 'setBotLevel', 'setReady', 'move', 'resign', 'markDead', 'acceptScore', 'resumePlay', 'requestRematch', 'toLobby'],
});
