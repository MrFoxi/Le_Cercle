// Mini-golf à 1-8 joueurs : salon, tours, coups, pénalités, scores. Le serveur calcule chaque tir (public/golf/physics.js)
// et envoie la trajectoire à tout le monde : chacun voit la même balle rouler, au même moment. Testé par test-golf.js.
const Golf = require('../public/golf/physics');

const MAX_PLAYERS = 8;
const AIM_MS = 30000; // temps pour tirer ; au-delà, le coup est compté et on passe au suivant
const HOLE_END_MS = 7000; // tableau des scores entre deux trous
const TEE = [[0, 0], [-14, -14], [14, 14], [14, -14], [-14, 14], [0, -17], [0, 17], [-17, 0]]; // balles côte à côte sur le tapis de départ
const COLORS = ['#ff5a5f', '#3d8bff', '#ffc93c', '#9b5de5', '#00c2a8', '#ff8c42', '#f15bb5', '#ffffff'];

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.clock = clock;
    this.players = []; // [{ name, connected, color }]
    this.spectators = [];
    this.phase = 'lobby'; // lobby | playing | over
    this.round = 0; // nombre de parties lancées dans ce salon
    this.notice = null;
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  get hole() { return Golf.HOLES[this.holeNo]; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase !== 'lobby') throw new Error('Partie en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (8 joueurs) : tu peux regarder la partie');
    const used = new Set(this.players.map(p => p.color));
    this.players.push({ name, connected: true, color: COLORS.find(c => !used.has(c)) });
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (this.phase !== 'playing') return;
    delete this.balls[name];
    this.order = this.order.filter(n => n !== name);
    this.notice = `${name} a quitté la partie`;
    if (this.stage === 'aim' && this.turn === name) this.nextTurn();
  }

  start(name) {
    if (this.phase === 'playing') throw new Error('La partie est déjà lancée');
    if (name !== this.host) throw new Error('Seul le créateur du salon peut lancer la partie');
    if (this.players.some(p => !p.connected)) throw new Error('Attends que tout le monde soit connecté');
    this.round++;
    this.phase = 'playing';
    this.scores = Object.fromEntries(this.players.map(p => [p.name, []]));
    this.order = this.players.map(p => p.name);
    this.notice = null;
    this.startHole(0);
  }

  // Nouveau trou : toutes les balles au départ ; on joue dans l'ordre du classement (le meilleur d'abord).
  startHole(no) {
    this.holeNo = no;
    this.holeStart = this.clock();
    this.stage = 'aim';
    this.shot = null;
    this.shotNo = 0;
    const [tx, ty] = this.hole.tee;
    this.balls = Object.fromEntries(this.order.map((n, i) => [n, { x: tx + TEE[i][0], y: ty + TEE[i][1], strokes: 0, done: false }]));
    if (no > 0) this.order.sort((a, b) => this.total(a) - this.total(b));
    this.turn = null;
    this.nextTurn(true);
  }

  total(name) { return this.scores[name].reduce((a, b) => a + b, 0); }

  // Joueur suivant qui n'a pas fini le trou ; s'il n'y en a plus, tableau des scores.
  nextTurn(first = false) {
    const live = this.order.filter(n => !this.balls[n].done);
    if (!live.length) return this.endHole();
    const i = first || !this.turn ? -1 : this.order.indexOf(this.turn);
    this.turn = [...this.order.slice(i + 1), ...this.order.slice(0, i + 1)].find(n => !this.balls[n].done);
    this.stage = 'aim';
    this.deadline = this.clock() + (this.get(this.turn)?.connected ? AIM_MS : 5000);
  }

  shoot(name, angle, power, shotNo) {
    if (this.phase !== 'playing' || this.stage !== 'aim') throw new Error('Pas de tir en ce moment');
    if (name !== this.turn) throw new Error('Ce n’est pas ton tour');
    if (shotNo !== this.shotNo) throw new Error('Tir déjà joué');
    if (!Number.isFinite(angle) || !Number.isFinite(power) || power <= 0 || power > 1) throw new Error('Tir invalide');
    const ball = this.balls[name], now = this.clock();
    const sim = Golf.simulate(this.hole, ball.x, ball.y, angle, power, (now - this.holeStart) / 1000);
    this.shotNo++;
    ball.strokes++;
    this.shot = { no: this.shotNo, name, at: now, from: [ball.x, ball.y], path: sim.path, events: sim.events, result: sim.result };
    this.pending = sim;
    this.stage = 'roll';
    this.deadline = now + (sim.path.length / Golf.FPS) * 1000 + 700; // le temps que tout le monde voie la balle rouler
  }

  // Fin du roulement : la balle se pose, tombe dans le trou, ou revient à son point de départ (+1 coup) si elle tombe à l'eau.
  finishShot() {
    const { name } = this.shot, sim = this.pending, ball = this.balls[name];
    this.pending = null;
    if (ball) {
      const max = Golf.MAX_STROKES(this.hole.par);
      if (sim.result === 'holed') ball.done = true;
      else if (sim.result === 'water') ball.strokes++;
      else { ball.x = sim.x; ball.y = sim.y; }
      if (!ball.done && ball.strokes >= max) { ball.done = true; ball.strokes = max; ball.picked = true; }
      ball.last = sim.result;
    }
    this.nextTurn();
  }

  endHole() {
    for (const n of this.order) this.scores[n][this.holeNo] = this.balls[n].strokes;
    this.stage = 'holeEnd';
    this.turn = null;
    this.deadline = this.clock() + HOLE_END_MS;
  }

  timeout() {
    if (this.phase !== 'playing') return;
    if (this.stage === 'roll') return this.finishShot();
    if (this.stage === 'holeEnd') {
      if (this.holeNo + 1 < Golf.HOLES.length) return this.startHole(this.holeNo + 1);
      this.phase = 'over';
      this.deadline = null;
      return;
    }
    // Temps écoulé : le coup compte, la balle ne bouge pas.
    const ball = this.balls[this.turn];
    this.notice = `${this.turn} n’a pas tiré à temps : +1 coup`;
    this.shotNo++;
    ball.strokes++;
    if (ball.strokes >= Golf.MAX_STROKES(this.hole.par)) { ball.done = true; ball.picked = true; }
    this.nextTurn();
  }

  toLobby(name) {
    if (this.phase !== 'over') throw new Error('Termine d’abord la partie');
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    this.phase = 'lobby';
    this.deadline = null;
  }

  viewFor(name) {
    const playing = this.phase !== 'lobby';
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host, now: this.clock(), notice: this.notice,
      spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      players: this.players.map(p => ({ ...p, scores: this.scores?.[p.name] ?? [], total: playing && this.scores?.[p.name] ? this.total(p.name) : 0 })),
      ...(playing && {
        holeNo: this.holeNo, holeStart: this.holeStart, stage: this.stage, turn: this.turn, deadline: this.deadline, order: this.order, shotNo: this.shotNo,
        balls: this.balls, shot: this.stage === 'roll' ? this.shot : null,
      }),
    };
  }
}

module.exports = { Room, MAX_PLAYERS, AIM_MS };
