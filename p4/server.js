// Salons du Puissance 4, sur le canal Socket.io « /p4 ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, { Room, actions: ['start', 'play', 'requestRematch', 'declineRematch', 'toLobby'] });
