// Salons de L'Imposteur, sur le canal Socket.io « /imposteur ».
const rooms = require('../lib/rooms');
const { Room } = require('./game');

module.exports = nsp => rooms(nsp, { Room, actions: ['setSettings', 'start', 'seenCard', 'giveClue', 'readyVote', 'vote', 'guess', 'next', 'toLobby'] });
