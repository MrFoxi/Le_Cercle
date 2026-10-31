// Mini-golf de 1 à 8 joueurs (et robots) : salon, réglages, modes de jeu, tours, coups, pénalités, paris, scores.
// Le serveur calcule chaque tir (public/golf/physics.js) et envoie les trajectoires à tout le monde : chacun voit
// les balles rouler au même moment. Testé par test-golf.js.
const Golf = require('../public/golf/physics');
const HO = require('../public/golf/holes');
const { validLook, CATALOG } = require('../public/golf/looks');
const { bestShot } = require('./bot');

const MAX_PLAYERS = 8;
const MODES = ['tour', 'simul', 'course', 'elim', 'equipes'];
const TURN_MODES = ['tour', 'elim', 'equipes']; // chacun son tour, balles qui se cognent ; sinon tout le monde en même temps, balles fantômes
const SETTINGS = { course: Object.keys(HO.COURSES), mode: MODES, chaos: [false, true], aim: [15, 30, 60], max: [2, 3, 5], assist: [0, 1, 2], bets: [true, false] };
const DEFAULTS = { course: 'decouverte', mode: 'tour', chaos: false, aim: 30, max: 3, assist: 1, bets: true };
const HOLE_END_MS = 8000, AWAY_MS = 5000, BOT_MS = [900, 1800];
const RACE_POINTS = [10, 7, 5, 4, 3, 2, 1, 0];
const BET_POINTS = { in: 5, water: 3, miss: 1 };
const TEE = [[0, 0], [-14, -14], [14, 14], [14, -14], [-14, 14], [0, -17], [0, 17], [-17, 0]]; // balles côte à côte au départ
const BOT_NAMES = ['Robot Birdie', 'Robot Putt', 'Robot Caddie', 'Robot Bunker', 'Robot Green', 'Robot Eagle', 'Robot Albatros'];
const daily = new Map(); // jour -> Map(pseudo -> meilleur score) : le classement du trou du jour, en mémoire
const dayKey = now => new Date(now).toISOString().slice(0, 10);

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.rng = rng;
    this.clock = clock;
    this.players = []; // [{ name, connected, look, bot? }]
    this.spectators = [];
    this.phase = 'lobby'; // lobby | playing | over
    this.round = 0;
    this.settings = { ...DEFAULTS };
    this.wins = {}; // victoires dans ce salon
    this.notice = null;
  }

  get host() { return this.players.find(p => !p.bot)?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  get turnMode() { return TURN_MODES.includes(this.settings.mode); }
  get live() { return this.order.filter(n => this.balls[n]); }
  get maxStrokes() { return this.hole.par + this.settings.max; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase !== 'lobby') throw new Error('Partie en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (8 joueurs) : tu peux regarder la partie');
    this.players.push({ name, connected: true, look: validLook({ color: this.freeColor() }) });
  }
  freeColor() {
    const used = new Set(this.players.map(p => p.look.color));
    return (CATALOG.color.slice(0, 8).find(c => !used.has(c.id)) ?? CATALOG.color[0]).id;
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (!this.players.some(p => !p.bot)) this.players = []; // plus d'humains : les robots s'en vont aussi (le salon ferme)
    if (this.phase !== 'playing') return;
    for (const n of [name, ...(this.players.length ? [] : this.order)]) delete this.balls[n];
    this.order = this.order.filter(n => this.get(n));
    this.notice = `${name} a quitté la partie`;
    if (this.turn === name && !this.shots.length) this.nextTurn();
    this.checkHoleEnd();
  }

  /* ---------- Salon ---------- */
  addBot(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut ajouter un robot');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Le salon est complet');
    const bot = BOT_NAMES.find(n => !this.taken(n));
    this.players.push({ name: bot, connected: true, bot: true, look: validLook({ color: this.freeColor(), motif: 'rayures' }) });
  }
  removeBot(name, bot) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut retirer un robot');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
    if (!this.get(bot)?.bot) throw new Error('Ce joueur n’est pas un robot');
    this.players = this.players.filter(p => p.name !== bot);
  }
  configure(name, key, value) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut régler la partie');
    if (this.phase === 'playing') throw new Error('La partie est en cours');
    if (!SETTINGS[key]?.includes(value)) throw new Error('Réglage invalide');
    this.settings[key] = value;
  }
  setLook(name, look) { this.get(name).look = validLook(look); }

  start(name) {
    if (this.phase === 'playing') throw new Error('La partie est déjà lancée');
    if (name !== this.host) throw new Error('Seul le créateur du salon peut lancer la partie');
    if (this.players.some(p => !p.connected)) throw new Error('Attends que tout le monde soit connecté');
    const mode = this.settings.mode;
    if (['elim', 'equipes', 'course'].includes(mode) && this.players.length < 2) throw new Error('Ce mode se joue à 2 au moins (ajoute un robot !)');
    this.round++;
    this.phase = 'playing';
    this.day = dayKey(this.clock());
    this.course = HO.COURSES[this.settings.course].holes(this.rng, this.day);
    this.order = this.players.map(p => p.name);
    this.scores = Object.fromEntries(this.order.map(n => [n, []]));
    this.points = Object.fromEntries(this.order.map(n => [n, 0]));
    this.betPts = Object.fromEntries(this.order.map(n => [n, 0]));
    this.teams = Object.fromEntries(this.order.map((n, i) => [n, mode === 'equipes' ? i % 2 : null]));
    this.outAt = {}; // mort subite : pseudo -> trou où il a été éliminé
    this.notice = this.winners = null;
    this.shotSeq = 0;
    this.startHole(0);
  }

  /* ---------- Un trou ---------- */
  startHole(no) {
    const now = this.clock();
    this.holeNo = no;
    this.hole = HO.resolve(this.course[no]);
    this.chaos = null;
    this.opts = { collide: this.turnMode };
    if (this.settings.chaos) {
      const c = HO.CHAOS[Math.floor(this.rng() * HO.CHAOS.length)], a = this.rng() * Math.PI * 2;
      this.chaos = { id: c.id, name: c.name, desc: c.desc };
      Object.assign(this.opts, c.opts, c.opts.wind && { wind: [Math.cos(a) * 140, Math.sin(a) * 140] });
    }
    this.holeStart = now;
    this.stage = 'play';
    this.shots = [];
    this.open = [];
    this.finished = []; // ordre d'arrivée (mode course)
    this.bets = {};
    this.betResult = null;
    this.eliminated = [];
    this.holeEndAt = null;
    if (no > 0 && this.turnMode) this.order.sort((a, b) => this.standing(a) - this.standing(b));
    const [tx, ty] = this.hole.tee, alive = this.order.filter(n => !(n in this.outAt));
    this.balls = Object.fromEntries(alive.map((n, i) => [n, { x: tx + TEE[i][0], y: ty + TEE[i][1], strokes: 0, n: 0, done: false, rolling: false, aimUntil: null }]));
    this.turn = null;
    if (this.turnMode) this.nextTurn(true);
    else for (const n of alive) this.balls[n].aimUntil = now + this.aimTime(n);
  }
  aimTime(name) {
    const p = this.get(name);
    if (p?.bot) return BOT_MS[0] + this.rng() * (BOT_MS[1] - BOT_MS[0]);
    return p?.connected ? this.settings.aim * 1000 : AWAY_MS; // déconnecté : un robot joue à sa place
  }
  standing(n) { return this.scores[n].reduce((a, b) => a + b, 0); }

  nextTurn(first = false) {
    const live = this.live.filter(n => !this.balls[n].done);
    this.bets = {};
    if (!live.length) { this.turn = null; return this.checkHoleEnd(); }
    const i = first || !this.turn ? -1 : this.order.indexOf(this.turn);
    this.turn = [...this.order.slice(i + 1), ...this.order.slice(0, i + 1)].find(n => this.balls[n] && !this.balls[n].done);
    this.balls[this.turn].aimUntil = this.clock() + this.aimTime(this.turn);
  }

  shoot(name, angle, power, spin, shotNo) {
    const b = this.balls?.[name];
    if (this.phase !== 'playing' || this.stage !== 'play' || !b || b.done) throw new Error('Pas de tir en ce moment');
    if (this.turnMode && (name !== this.turn || this.shots.length)) throw new Error('Ce n’est pas ton tour');
    if (b.rolling) throw new Error('Ta balle roule encore');
    if (shotNo !== b.n) throw new Error('Tir déjà joué');
    if (!Number.isFinite(angle) || !Number.isFinite(power) || power <= 0 || power > 1 || !Number.isFinite(spin) || Math.abs(spin) > 1) throw new Error('Tir invalide');
    this.fire(name, angle, power, spin);
  }

  // Balles prises en compte par un tir : toutes celles au repos (chacun son tour), ou la sienne seule (balles fantômes)
  simBalls(name) {
    const out = {};
    for (const n of this.opts.collide ? this.live : [name]) { const b = this.balls[n]; if (!b.done && (!b.rolling || n === name)) out[n] = { x: b.x, y: b.y }; }
    return out;
  }
  fire(name, angle, power, spin = 0) {
    const now = this.clock(), b = this.balls[name];
    const sim = Golf.simulate(this.hole, { balls: this.simBalls(name), shooter: name, angle, power, spin, t0: (now - this.holeStart) / 1000, open: this.open, opts: this.opts });
    b.strokes++;
    b.n++;
    b.rolling = true;
    b.aimUntil = null;
    this.shots.push({ id: ++this.shotSeq, name, at: now, end: now + (sim.frames / Golf.FPS) * 1000 + 600, paths: sim.paths, events: sim.events, results: sim.results, open: sim.open, bounces: sim.bounces });
  }
  botShot(name) {
    const now = this.clock();
    const s = { balls: this.simBalls(name), shooter: name, t0: (now - this.holeStart) / 1000, open: this.open, opts: this.opts };
    const shot = bestShot(this.hole, s, { angles: 48, skill: this.get(name)?.bot ? 0.85 : 0.7, rng: this.rng });
    this.fire(name, shot.angle, shot.power, 0);
  }

  // Fin du roulement : chaque balle touchée se pose, tombe dans le trou ou revient à sa place si elle tombe à l'eau.
  finishShot(shot) {
    this.shots = this.shots.filter(s => s !== shot);
    for (const d of shot.open) if (!this.open.includes(d)) this.open.push(d);
    for (const [n, r] of Object.entries(shot.results)) {
      const b = this.balls[n];
      if (!b) continue;
      const mine = n === shot.name;
      if (r.result === 'holed') {
        b.done = true;
        b.x = r.x; b.y = r.y;
        if (mine && r.bonus) { b.strokes = Math.max(1, b.strokes - 1); b.bonus = true; }
        if (!mine) b.lucky = true; // poussée dans le trou par une autre balle : sans coup de plus
        this.finished.push(n);
      } else if (r.result === 'water') {
        if (mine) b.strokes++; // pénalité ; une balle poussée à l'eau revient à sa place sans pénalité
      } else { b.x = r.x; b.y = r.y; }
      if (mine) b.last = r.result;
      if (!b.done && b.strokes >= this.maxStrokes) { b.done = true; b.picked = true; b.strokes = this.maxStrokes; }
    }
    const me = this.balls[shot.name];
    if (me) me.rolling = false;
    if (this.turnMode) {
      const r = shot.results[shot.name].result, outcome = r === 'holed' ? 'in' : r === 'water' ? 'water' : 'miss';
      const winners = Object.entries(this.bets).filter(([, c]) => c === outcome).map(([n]) => n);
      for (const n of winners) if (n in this.betPts) this.betPts[n] += BET_POINTS[outcome];
      this.betResult = Object.keys(this.bets).length ? { shooter: shot.name, outcome, winners, points: BET_POINTS[outcome] } : null;
      this.nextTurn();
    } else if (me && !me.done) me.aimUntil = this.clock() + this.aimTime(shot.name);
    this.checkHoleEnd();
  }

  checkHoleEnd() {
    if (this.phase !== 'playing' || this.stage !== 'play' || this.shots.length) return;
    if (this.live.some(n => !this.balls[n].done)) return;
    this.endHole();
  }

  endHole() {
    const live = this.live, par = this.hole.par;
    for (const n of live) this.scores[n][this.holeNo] = this.balls[n].strokes;
    if (this.settings.mode === 'course') this.finished.filter(n => this.balls[n] && !this.balls[n].picked).forEach((n, i) => (this.points[n] += RACE_POINTS[i] ?? 0));
    if (this.settings.mode === 'elim' && live.length > 1) {
      const worst = Math.max(...live.map(n => this.balls[n].strokes));
      const out = live.filter(n => this.balls[n].strokes === worst);
      if (out.length < live.length) { this.eliminated = out; for (const n of out) this.outAt[n] = this.holeNo; }
    }
    if (this.settings.course === 'jour') {
      const board = daily.get(this.day) ?? new Map();
      daily.set(this.day, board);
      for (const n of live) if (!this.get(n)?.bot) board.set(n, Math.min(board.get(n) ?? Infinity, this.balls[n].strokes));
    }
    this.lastPar = par;
    this.stage = 'holeEnd';
    this.turn = null;
    this.holeEndAt = this.clock() + HOLE_END_MS;
  }

  ranking() {
    const n = this.order, total = x => this.standing(x), mode = this.settings.mode;
    if (mode === 'course') return [...n].sort((a, b) => this.points[b] - this.points[a] || total(a) - total(b));
    if (mode === 'elim') return [...n].sort((a, b) => (this.outAt[b] ?? 99) - (this.outAt[a] ?? 99) || total(a) - total(b));
    if (mode === 'equipes') {
      const t = this.teamTotals();
      return [...n].sort((a, b) => t[this.teams[a]] - t[this.teams[b]] || total(a) - total(b));
    }
    return [...n].sort((a, b) => total(a) - total(b));
  }
  // Par équipes : à chaque trou, le meilleur score de l'équipe compte
  teamTotals() {
    const t = [0, 0];
    for (let h = 0; h < this.course.length; h++) for (const team of [0, 1]) {
      const s = this.order.filter(n => this.teams[n] === team).map(n => this.scores[n][h]).filter(v => v !== undefined);
      if (s.length) t[team] += Math.min(...s);
    }
    return t;
  }

  finishGame() {
    this.phase = 'over';
    this.stage = 'over';
    const rank = this.ranking(), mode = this.settings.mode;
    if (mode === 'equipes') { const t = this.teamTotals(), best = Math.min(...t); this.winners = this.order.filter(n => t[this.teams[n]] === best); }
    else this.winners = rank.length ? [rank[0]] : [];
    for (const w of this.winners) this.wins[w] = (this.wins[w] ?? 0) + 1;
  }

  // Étapes chronométrées : fin des roulements, temps de visée écoulé (robot ou pénalité), tableau des scores.
  timeout() {
    if (this.phase !== 'playing') return;
    const now = this.clock();
    for (const shot of [...this.shots].sort((a, b) => a.end - b.end)) if (shot.end <= now) this.finishShot(shot);
    if (this.stage === 'holeEnd') {
      if (this.holeEndAt > now) return;
      const alive = this.order.filter(n => !(n in this.outAt));
      if (this.holeNo + 1 < this.course.length && !(this.settings.mode === 'elim' && alive.length <= 1)) return this.startHole(this.holeNo + 1);
      return this.finishGame();
    }
    for (const n of this.live) {
      const b = this.balls[n];
      if (!b || b.done || b.rolling || !b.aimUntil || b.aimUntil > now) continue;
      if (this.turnMode && (n !== this.turn || this.shots.length)) continue;
      const p = this.get(n);
      if (p?.bot || !p?.connected) { this.botShot(n); continue; }
      // Temps écoulé : le coup compte, la balle ne bouge pas.
      this.notice = `${n} n’a pas tiré à temps : +1 coup`;
      b.strokes++;
      b.n++;
      if (b.strokes >= this.maxStrokes) { b.done = true; b.picked = true; }
      if (this.turnMode) this.nextTurn();
      else if (!b.done) b.aimUntil = now + this.aimTime(n);
      this.checkHoleEnd();
    }
  }
  get deadline() {
    if (this.phase !== 'playing') return null;
    if (this.stage === 'holeEnd') return this.holeEndAt;
    const times = this.shots.map(s => s.end);
    for (const n of this.live) {
      const b = this.balls[n];
      if (b.aimUntil && !b.done && !b.rolling && !(this.turnMode && (n !== this.turn || this.shots.length))) times.push(b.aimUntil);
    }
    return times.length ? Math.min(...times) : null;
  }

  // Paris amicaux sur le tir de celui qui joue (chacun son tour) : dans le trou, à l'eau, ou ni l'un ni l'autre
  bet(name, choice) {
    if (!this.settings.bets || !this.turnMode || this.phase !== 'playing' || this.stage !== 'play') throw new Error('Pas de paris en ce moment');
    if (!(choice in BET_POINTS)) throw new Error('Pari invalide');
    if (name === this.turn || this.shots.length) throw new Error('Trop tard pour parier');
    this.bets[name] = choice;
  }

  toLobby(name) {
    if (this.phase !== 'over') throw new Error('Termine d’abord la partie');
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    this.phase = 'lobby';
  }

  viewFor(name) {
    const playing = this.phase !== 'lobby';
    const board = this.settings.course === 'jour' && daily.get(this.day ?? dayKey(this.clock()));
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host, now: this.clock(), notice: this.notice,
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      players: this.players.map(p => ({
        name: p.name, connected: p.connected, bot: !!p.bot, look: p.look, wins: this.wins[p.name] ?? 0,
        ...(playing && this.scores?.[p.name] && { scores: this.scores[p.name], total: this.standing(p.name), points: this.points[p.name], betPts: this.betPts[p.name], team: this.teams[p.name], outAt: this.outAt[p.name] ?? null }),
      })),
      daily: board ? [...board].sort((a, b) => a[1] - b[1]).slice(0, 10).map(([n, s]) => ({ name: n, strokes: s })) : null,
      ...(playing && {
        course: this.course, holeNo: this.holeNo, holeStart: this.holeStart, stage: this.stage, turn: this.turn, order: this.order,
        balls: this.balls, shots: this.shots, open: this.open, chaos: this.chaos, opts: this.opts, bets: this.bets, betResult: this.betResult,
        eliminated: this.eliminated, holeEndAt: this.holeEndAt, ranking: this.ranking(), winners: this.winners,
        teamTotals: this.settings.mode === 'equipes' ? this.teamTotals() : null, maxStrokes: this.maxStrokes,
      }),
    };
  }
}

module.exports = { Room, MAX_PLAYERS, SETTINGS, DEFAULTS, daily };
