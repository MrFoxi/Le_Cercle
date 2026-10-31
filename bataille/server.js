// Salons de la Bataille navale, sur le canal Socket.io « /bataille ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, { Room, actions: ['setMode', 'start', 'placeFleet','draft', 'fire', 'ability', 'requestRematch', 'declineRematch', 'toLobby'] });
