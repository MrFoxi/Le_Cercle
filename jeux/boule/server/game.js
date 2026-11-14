// Boule de Pute : salon de 2 à 8 joueurs en deux équipes (les robots complètent), en plusieurs manches.
// Le serveur fait foi : il reçoit les touches numérotées et le regard des joueurs, fait tourner la physique partagée
// (client/sim.js) 60 fois par seconde en rattrapant le temps perdu, et envoie l'état 30 fois par seconde (« snap »).
// Étapes : compte à rebours (on bouge, pas de boule), manche, fin de manche ; la première équipe à gagner la majorité
// des manches remporte la partie. Testé par jeux/boule/boule.test.js.
const BD = require('../client/sim');
const { PartyRoom } = require('../../../lib/room-base');

const LOOKS = ['bobby', 'mama', 'tonton', 'zaza', 'robox', 'mamie'];
const SETTINGS = { rounds: [3, 5, 7], teamSize: [1, 2, 3, 4], level: [1, 2, 3] };
const COUNT_MS = 3000, END_MS = 3500, TICK_MS = 1000 / BD.FPS, QUEUE_MAX = 4, MAX_STEPS = 5;
const COLORS = ['#ff7a2f', '#2fc4d6', '#ffb02e', '#3d8bff', '#ff5a7a', '#2bd28f', '#a46bff', '#e8e8e8'];
const BOT_NAMES = ['Robot Patate', 'Robot Gros-Bras', 'Robot Esquive', 'Robot Pif-Paf', 'Robot Badaboum', 'Robot Zigzag', 'Robot Molosse'];
const { IN, B, P } = BD;

class Room extends PartyRoom {
  static MAX_PLAYERS = 8;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 3, teamSize: 2, level: 2 };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), look: extra?.bot ? LOOKS[Math.floor(this.rng() * LOOKS.length)] : 'bobby' }; }
  pick(name, look) {
    if (!LOOKS.includes(look)) throw new Error('Personnage inconnu');
    this.get(name).look = look;
  }
  // Un joueur s'en va en pleine manche : il est simplement éliminé.
  left(name) { const p = this.world?.players.find(x => x.id === name); if (p) { p.alive = false; this.world.players = this.world.players.filter(x => x !== p); } }

  start(name) {
    this.hostOnly(name);
    const need = Math.max(2, this.settings.teamSize * 2);
    if (this.players.length > need) this.settings.teamSize = Math.min(4, Math.ceil(this.players.length / 2));
    while (this.players.length < Math.max(need, 2)) this.addBot(name); // les robots complètent les équipes
    if (this.players.length % 2) this.addBot(name);
    this.round++;
    this.roundNo = 0;
    this.wins = this.wins ?? {};
    this.teamWins = [0, 0];
    for (const p of this.players) p.points = 0;
    this.world = BD.world(this.players.map((p, k) => ({ id: p.name, team: k % 2, look: p.look })), 1 + Math.floor(this.rng() * 1e9));
    this.nextRound();
  }
  nextRound() {
    this.roundNo++;
    BD.reset(this.world);
    this.queues = {}; this.held = {}; this.acks = {}; this.brains = {};
    this.events = []; this.result = null;
    this.phaseTo('count');
    this.stop();
    this.lastTick = this.clock(); this.debt = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  phaseTo(p) { this.phase = p; this.phaseAt = this.clock(); }
  stop() { clearInterval(this.timer); this.timer = null; }
  get deadline() {
    if (this.phase === 'count') return this.phaseAt + COUNT_MS;
    if (this.phase === 'roundEnd') return this.phaseAt + END_MS;
    return null;
  }
  get need() { return Math.ceil(this.settings.rounds / 2); }
  timeout() {
    if (!this.deadline || this.clock() < this.deadline) return;
    if (this.phase === 'count') { this.phaseTo('play'); this.notify?.(); }
    else if (this.phase === 'roundEnd') { if (Math.max(...this.teamWins) >= this.need) { this.stop(); this.finish(); } else this.nextRound(); }
  }

  // Touches d'un joueur : [[numéro, bits, regard], …] ; une consommée par image.
  input(name, list) {
    if (!Array.isArray(list) || !this.world) return;
    const q = (this.queues[name] ??= []), last = this.acks[name] ?? 0;
    for (const e of list.slice(0, 20)) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]) || e[1] < 0 || e[1] > 63 || !Number.isFinite(e[2])) continue;
      if (e[0] <= last || (q.length && e[0] <= q.at(-1)[0])) continue;
      q.push([e[0], e[1], e[2]]);
    }
    while (q.length > QUEUE_MAX) { const [seq, bits, yaw] = q.shift(); this.held[name] = [bits, yaw]; this.acks[name] = seq; }
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (!['count', 'play', 'roundEnd'].includes(this.phase)) return;
    const now = this.clock();
    this.debt = Math.min(MAX_STEPS * TICK_MS, (this.debt ?? 0) + now - (this.lastTick ?? now));
    this.lastTick = now;
    let steps = 0;
    while (this.debt >= TICK_MS - 0.5) { this.debt -= TICK_MS; steps++; this.stepOnce(); }
    this.ticks = (this.ticks ?? 0) + steps;
    if (steps && (this.ticks % 2 === 0 || steps > 1)) this.emit?.('snap', { f: this.world.frame, p: this.world.players.map(BD.pack), b: BD.packBall(this.world.ball), ack: this.acks, ev: this.events.splice(0) });
  }
  stepOnce() {
    const w = this.world, inputs = {};
    for (const p of w.players) {
      if (this.get(p.id)?.bot) inputs[p.id] = this.think(p);
      else {
        const q = this.queues[p.id];
        if (q?.length) { const [seq, bits, yaw] = q.shift(); this.held[p.id] = [bits, yaw]; this.acks[p.id] = seq; }
        inputs[p.id] = this.held[p.id] ?? [0, p.yaw];
      }
    }
    const win = BD.stepWorld(w, inputs, this.events, this.phase === 'play');
    if (win !== null && this.phase === 'play') {
      this.teamWins[win]++;
      for (const p of w.players) { const pl = this.get(p.id); if (pl && p.team === win) pl.points++; }
      this.result = { win, teamWins: [...this.teamWins], over: this.teamWins[win] >= this.need };
      this.events.push({ t: 'round', win, teamWins: [...this.teamWins] });
      w.ball = null;
      this.phaseTo('roundEnd');
      this.notify?.();
    }
  }

  /* ---- Robot ---- */
  // Se promène dans sa moitié, s'écarte de la boule quand elle le vise de loin, et la renvoie au bon moment.
  // Le niveau règle la justesse : plus la boule va vite, plus il rate.
  think(p) {
    const w = this.world, b = w.ball, lvl = this.settings.level, br = (this.brains[p.id] ??= { gx: p.x, gz: p.z, next: 0, armed: true });
    if (!p.alive) return [0, p.yaw];
    if (w.frame >= br.next) { br.next = w.frame + 60 + Math.floor(this.rng() * 120); br.gx = (p.team ? 1 : -1) * (3 + this.rng() * 8); br.gz = (this.rng() * 2 - 1) * 6; }
    let yaw = p.team ? Math.PI : 0, bits = 0;
    const foes = BD.alive(w, 1 - p.team);
    if (foes.length) { const f = foes[(p.saves + p.kills) % foes.length]; yaw = Math.atan2(f.z - p.z, f.x - p.x) + (this.rng() - 0.5) * 0.3; }
    let tx = br.gx, tz = br.gz;
    const mine = b && (b.state === 'fly' || b.state === 'grace') && b.target === p.id;
    if (mine) {
      const d = Math.hypot(b.x - p.x, b.y - p.y - P.chest, b.z - p.z);
      if (d > 7) { tz = p.z + (b.z > p.z ? -3 : 3); tx = p.x; } // s'écarter un peu
      else { tx = p.x; tz = p.z; }
      // renvoyer : la boule arrive dans la portée ; la réussite baisse avec la vitesse
      if (br.armed && d < B.range - Math.min(1.2, b.v * BD.DT * 2)) {
        br.armed = false;
        if (this.rng() < Math.max(0.15, 1.1 - b.v / (30 + lvl * 25))) bits |= IN.HIT;
      }
    } else br.armed = true;
    // déplacement vers le but choisi, exprimé par rapport au regard
    const dx = tx - p.x, dz = tz - p.z;
    if (Math.hypot(dx, dz) > 0.5) {
      const [fx, fz] = BD.fwd(yaw), f = dx * fx + dz * fz, s = -dx * fz + dz * fx;
      if (f > 0.3) bits |= IN.F; else if (f < -0.3) bits |= IN.B;
      if (s > 0.3) bits |= IN.R; else if (s < -0.3) bits |= IN.L;
    }
    if (mine && b.v > 30 && this.rng() < 0.01) bits |= IN.JUMP;
    return [bits, yaw];
  }

  viewFor(name) {
    const v = this.baseView(name), w = this.world;
    return { ...v, teamWins: this.teamWins ?? [0, 0], need: this.need, result: this.result, players: v.players.map(p => ({ ...p, look: this.get(p.name).look, team: w?.players.find(x => x.id === p.name)?.team ?? null })) };
  }
}
module.exports = { Room, SETTINGS, LOOKS };
