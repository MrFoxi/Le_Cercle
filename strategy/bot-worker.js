// Thread d'un robot du Strategy Club : reçoit une position, renvoie la clé du coup choisi.
const { parentPort, workerData } = require('worker_threads');
const AI = require('../public/strategy/ai');

const { gameId, state, level } = workerData;
const game = require(`../public/strategy/games/${gameId}`);
parentPort.postMessage(AI.choose(game, state, level).key);
