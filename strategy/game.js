// Strategy Club : un salon = un jeu (échecs, dames, shogi, go), deux places (humain ou robot), des spectateurs.
// Règles dans public/strategy/games (communes au navigateur) ; les robots réfléchissent dans un thread à part.
const path = require('path');
const { Worker } = require('worker_threads');
const AI = require('../public/strategy/ai');

// Pour ajouter un jeu : un fichier de règles dans public/strategy/games, une ligne ici et une carte dans le client.
const GAMES = {
  chess: require('../public/strategy/games/chess'),
  draughts: require('../public/strategy/games/draughts'),
  shogi: require('../public/strategy/games/shogi'),
  go: require('../public/strategy/games/go'),
};
const TIMES = [0, 5, 10, 15, 30]; // minutes par joueur, 0 = sans limite
const LEVELS = Object.keys(AI.LEVELS);
const BOT_MIN_MS = 700; // un robot ne répond jamais instantanément : on voit le coup arriver
const SETTINGS = { game: Object.keys(GAMES), time: TIMES, goSize: [9, 13, 19], goRules: ['chinese', 'japanese'] };

const botName = level => `Robot ${AI.LEVELS[level].label}`;
const strip = s => (s && 'hist' in s ? { ...s, hist: null } : s); // l'historique interne des positions reste sur le serveur

// Le robot cherche son coup dans un thread : le serveur continue de répondre aux autres salons pendant ce temps.
function think(gameId, state, level) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'bot-worker.js'), { workerData: { gameId, state, level } }); // avec l'historique : le robot évite les répétitions
    w.once('message', resolve);
    w.once('error', reject);
  });
}

class Room {
  constructor(code, rng = Math.random, isPrivate = false) {
    this.code = code;
    this.rng = rng;
    this.private = isPrivate;
    this.players = []; // humains [{ name, connected }] ; le premier est l'hôte
    this.spectators = [];
    this.settings = { game: 'chess', time: 0, goSize: 19, goRules: 'chinese' };
    this.seats = [null, null]; // camp 0 (joue en premier) et camp 1 : { name } ou { name, bot: niveau }
    this.ready = new Set();
    this.phase = 'lobby'; // lobby | playing | scoring (go : pierres mortes) | over
    this.round = 0;
    this.state = null;
    this.history = []; // [{ san, side, key }]
    this.clocks = [0, 0];
    this.turnStart = 0;
    this.result = null;
    this.rematch = new Set();
    this.dead = new Set(); // go : pierres déclarées mortes
    this.accepts = new Set();
    this.notice = null;
    this.thinking = 0; // jeton de la réflexion en cours d'un robot (change = réflexion périmée)
    this.wins = {};
    this.notify = () => {};
  }

  get game() { return GAMES[this.settings.game]; }
  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name) || this.seats.some(s => s?.name === name); }
  sideOf(name) { return this.seats.findIndex(s => s && !s.bot && s.name === name); }
  humansSeated() { return this.seats.filter(s => s && !s.bot); }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.players.length >= 2) throw new Error('Les deux places sont prises : tu peux regarder la partie');
    this.players.push({ name, connected: true });
    this.wins[name] ??= 0;
    const free = this.seats.findIndex(s => !s);
    if (this.phase === 'lobby' && free >= 0) this.seats[free] = { name };
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 50) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  removePlayer(name) {
    const side = this.sideOf(name);
    this.players = this.players.filter(p => p.name !== name);
    this.ready.delete(name);
    if (side >= 0) this.seats[side] = null;
    if (this.phase === 'playing' || this.phase === 'scoring') {
      this.thinking++;
      this.phase = 'lobby';
      this.notice = `${name} a quitté la partie`;
    }
    if (!this.players.length) this.seats = [null, null]; // plus d'humains : les robots partent, le salon ferme
  }

  /* ---------- Salon ---------- */
  lobbyOnly(name, hostOnly) {
    if (this.phase !== 'lobby') throw new Error('La partie est en cours');
    if (hostOnly && name !== this.host) throw new Error('Seul l’hôte peut changer ce réglage');
  }
  configure(name, key, value) {
    this.lobbyOnly(name, true);
    if (!SETTINGS[key]?.includes(value)) throw new Error('Réglage inconnu');
    this.settings[key] = value;
    this.ready.clear();
    this.notice = null;
  }
  sit(name, side) {
    this.lobbyOnly(name);
    if (![0, 1].includes(side)) throw new Error('Place inconnue');
    if (this.seats[side]) throw new Error('Cette place est prise');
    const from = this.sideOf(name);
    if (from >= 0) this.seats[from] = null;
    this.seats[side] = { name };
    this.ready.clear();
  }
  addBot(name, side, level) {
    this.lobbyOnly(name, true);
    if (![0, 1].includes(side) || this.seats[side]) throw new Error('Cette place est prise');
    if (!LEVELS.includes(level)) throw new Error('Niveau inconnu');
    this.seats[side] = { name: botName(level), bot: level };
    this.ready.clear();
  }
  removeBot(name, side) {
    this.lobbyOnly(name, true);
    if (!this.seats[side]?.bot) throw new Error('Pas de robot à cette place');
    this.seats[side] = null;
    this.ready.clear();
  }
  // Changer le niveau d'un robot : dans le salon, ou à la fin d'une partie avant la revanche.
  setBotLevel(name, level) {
    if (!['lobby', 'over'].includes(this.phase)) throw new Error('La partie est en cours');
    if (name !== this.host) throw new Error('Seul l’hôte peut changer le niveau');
    if (!LEVELS.includes(level)) throw new Error('Niveau inconnu');
    for (const s of this.seats) if (s?.bot) Object.assign(s, { bot: level, name: botName(level) });
  }
  // Prêt : la partie démarre dès que les deux places sont occupées et que tous les humains assis sont prêts.
  setReady(name, on) {
    this.lobbyOnly(name);
    if (this.sideOf(name) < 0) throw new Error('Assieds-toi d’abord à une place');
    if (on) this.ready.add(name); else this.ready.delete(name);
    const humans = this.humansSeated();
    if (this.seats.every(Boolean) && humans.every(s => this.ready.has(s.name) && this.get(s.name)?.connected)) this.start();
  }

  /* ---------- Partie ---------- */
  start() {
    this.round++;
    this.thinking++;
    this.state = this.game.init(this.settings);
    this.history = [];
    this.clocks = [this.settings.time * 60000, this.settings.time * 60000];
    this.turnStart = this.startedAt = Date.now();
    this.endedAt = null;
    this.result = this.notice = null;
    this.rematch.clear();
    this.ready.clear();
    this.dead.clear();
    this.accepts.clear();
    this.phase = 'playing';
    this.kickBot();
  }

  // moveNo : numéro du coup attendu ; un clic en double ou en retard est refusé.
  move(name, key, moveNo) {
    if (this.phase !== 'playing') throw new Error('La partie n’est pas en cours');
    if (moveNo !== this.history.length) throw new Error('Coup déjà joué');
    if (this.sideOf(name) !== this.state.turn) throw new Error('Ce n’est pas ton tour');
    const m = this.game.moves(this.state).find(x => x.key === key);
    if (!m) throw new Error('Coup interdit');
    this.apply(m);
  }

  apply(m) {
    const side = this.state.turn, now = Date.now();
    if (this.settings.time) this.clocks[side] = Math.max(0, this.clocks[side] - (now - this.turnStart));
    this.history.push({ san: this.game.notation(this.state, m), side, key: m.key, from: m.from ?? null, to: m.to ?? m.at ?? null });
    this.state = this.game.play(this.state, m);
    this.turnStart = now;
    // Go : deux passes de suite, on passe au marquage des pierres mortes.
    if (this.game.scoring && this.state.passes >= 2) {
      this.phase = 'scoring';
      this.dead.clear();
      this.accepts.clear();
      return;
    }
    const res = this.game.over(this.state);
    if (res) return this.finish(res.winner, res.reason);
    this.kickBot();
  }

  finish(winner, reason) {
    this.thinking++;
    this.phase = 'over';
    this.endedAt = Date.now();
    this.result = { winner, reason };
    const w = this.seats[winner]?.name;
    if (winner !== null && this.wins[w] !== undefined) this.wins[w]++;
  }

  resign(name) {
    const side = this.sideOf(name);
    if (!['playing', 'scoring'].includes(this.phase)) throw new Error('La partie n’est pas en cours');
    if (side < 0) throw new Error('Tu ne joues pas cette partie');
    this.finish(1 - side, `${name} abandonne`);
  }

  // Le robot du camp qui doit jouer réfléchit dans un thread, puis joue (via notify, le salon prévient tout le monde).
  kickBot() {
    if (this.phase !== 'playing') return;
    const seat = this.seats[this.state.turn];
    if (!seat?.bot) return;
    const token = ++this.thinking, moveNo = this.history.length, t0 = Date.now();
    const still = () => token === this.thinking && this.phase === 'playing' && this.history.length === moveNo;
    think(this.settings.game, this.state, seat.bot).then(key => {
      setTimeout(() => {
        if (!still()) return;
        const m = this.game.moves(this.state).find(x => x.key === key);
        if (!m) return;
        this.apply(m);
        this.notify();
      }, Math.max(0, BOT_MIN_MS - (Date.now() - t0)));
    }).catch(err => console.error('Robot Strategy Club :', err));
  }

  // Pendule : à zéro, la partie est perdue au temps.
  get deadline() {
    return this.phase === 'playing' && this.settings.time ? this.turnStart + this.clocks[this.state.turn] : null;
  }
  timeout() {
    if (this.phase !== 'playing' || Date.now() < this.deadline - 20) return;
    const side = this.state.turn;
    this.clocks[side] = 0;
    this.finish(1 - side, `Temps écoulé pour ${this.seats[side].name}`);
  }

  /* ---------- Go : pierres mortes et compte ---------- */
  markDead(name, at) {
    if (this.phase !== 'scoring') throw new Error('Pas de compte en cours');
    if (this.sideOf(name) < 0) throw new Error('Tu ne joues pas cette partie');
    const s = this.state;
    if (!Number.isInteger(at) || !s.b[at]) throw new Error('Touche une pierre');
    const { stones } = this.game.group(s.b, s.n, at);
    const dead = !this.dead.has(at);
    for (const p of stones) dead ? this.dead.add(p) : this.dead.delete(p);
    this.accepts.clear();
  }
  acceptScore(name) {
    if (this.phase !== 'scoring') throw new Error('Pas de compte en cours');
    if (this.sideOf(name) < 0) throw new Error('Tu ne joues pas cette partie');
    this.accepts.add(name);
    if (this.humansSeated().every(s => this.accepts.has(s.name))) { // les robots acceptent toujours
      const sc = this.game.score(this.state, [...this.dead]);
      this.finish(sc.winner, `${this.seats[sc.winner].name} gagne ${Math.max(...sc.total)} à ${Math.min(...sc.total)} (${sc.rules === 'chinese' ? 'compte chinois' : 'compte japonais'})`);
    }
  }
  resumePlay(name) {
    if (this.phase !== 'scoring') throw new Error('Pas de compte en cours');
    if (this.sideOf(name) < 0) throw new Error('Tu ne joues pas cette partie');
    this.state = { ...this.state, passes: 0 };
    this.dead.clear();
    this.accepts.clear();
    this.phase = 'playing';
    this.turnStart = Date.now();
    this.kickBot();
  }

  /* ---------- Après la partie ---------- */
  // Revanche : camps échangés ; elle part quand tous les humains assis l'ont demandée (contre un robot : tout de suite).
  requestRematch(name) {
    if (this.phase !== 'over') throw new Error('La partie n’est pas finie');
    if (this.sideOf(name) < 0) throw new Error('Tu ne joues pas cette partie');
    if (!this.seats.every(Boolean)) throw new Error('Ton adversaire est parti');
    this.rematch.add(name);
    if (this.humansSeated().every(s => this.rematch.has(s.name))) {
      this.seats.reverse();
      this.start();
    }
  }
  toLobby() {
    if (this.phase !== 'over') throw new Error('Termine d’abord la partie');
    this.phase = 'lobby';
    this.rematch.clear();
    this.ready.clear();
  }

  summary() {
    return { game: this.settings.game, seats: this.seats.map(s => s && { name: s.name, bot: s.bot || null }) };
  }

  viewFor(name) {
    const scoring = this.phase === 'scoring' ? this.game.score(this.state, [...this.dead]) : null;
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host,
      spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      players: this.players.map(p => ({ name: p.name, connected: p.connected, wins: this.wins[p.name] ?? 0 })),
      settings: this.settings, seats: this.seats, mySide: this.sideOf(name), ready: [...this.ready],
      state: strip(this.state), history: this.history, clocks: this.clocks, turnStart: this.turnStart, now: Date.now(),
      startedAt: this.startedAt, endedAt: this.endedAt, result: this.result, notice: this.notice,
      rematch: [...this.rematch], dead: [...this.dead], accepts: [...this.accepts],
      score: scoring && { total: scoring.total, owner: scoring.owner, rules: scoring.rules },
    };
  }
}

module.exports = { Room, GAMES, TIMES, LEVELS, SETTINGS };
