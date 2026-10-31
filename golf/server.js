// Salons du Mini-golf, sur le canal Socket.io « /golf ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, { Room, actions: ['start', 'shoot', 'toLobby'] });
