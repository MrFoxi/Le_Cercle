// Caboche Cup : salon pour un match 1 contre 1 ou 2 contre 2 (les robots complètent les équipes), plusieurs matchs
// d'affilée possibles. Le serveur fait foi : il reçoit les touches numérotées des joueurs, fait tourner la physique
// partagée (client/sim.js) 60 fois par seconde en rattrapant le temps perdu, et envoie l'état 30 fois par seconde
// (« snap »). Les robots jouent avec client/bot.js (le même que le tournoi hors ligne).
// Étapes : coup d'envoi (compte à rebours), jeu, but (célébration et ralenti), fin du match ; égalité au temps : but en or.
// Réglages : durée, premier à N buts, mode fou, terrain, bonus, format, niveau des robots.
// Testé par jeux/caboche/caboche.test.js.
const CC = require('../client/sim');
const Bot = require('../client/bot');
const { PartyRoom } = require('../../../lib/room-base');

const SETTINGS = { rounds: [1, 3, 5], time: [60, 120, 180], goals: [0, 3, 5], level: [1, 2, 3], mode: Object.keys(CC.MODES), stade: Object.keys(CC.STADES), bonus: [1, 0], format: ['1v1', '2v2'] };
const KICKOFF_MS = 2200, GOAL_MS = 5200, END_MS = 6000, GOLDEN_MS = 60000, TICK_MS = 1000 / CC.FPS, QUEUE_MAX = 4, MAX_STEPS = 5;
const COLORS = ['#ff4d4d', '#3d8bff', '#ffb02e', '#2bd28f'];
const BOT_NAMES = ['Robot Crampon', 'Robot Lucarne', 'Robot Petit-Pont', 'Robot Gazon'];

class Room extends PartyRoom {
  static MAX_PLAYERS = 4;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 1, time: 120, goals: 0, level: 2, mode: 'normal', stade: 'nuit', bonus: 1, format: '1v1' };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), char: extra?.bot ? CC.CHAR_IDS[Math.floor(this.rng() * CC.CHAR_IDS.length)] : 'bouboule', acc: 'aucun' }; }
  pick(name, char, acc = 'aucun') {
    if (!CC.CHARS[char]) throw new Error('Personnage inconnu');
    if (!CC.ACCS[acc]) throw new Error('Accessoire inconnu');
    if (this.phase !== 'lobby' && this.phase !== 'over') throw new Error('Attends la fin du match pour changer de personnage');
    Object.assign(this.get(name), { char, acc });
  }
  // Un joueur s'en va en plein match : son équipe perd par forfait.
  left(name) { const p = this.world?.players.find(x => x.id === name); if (p && ['kickoff', 'play', 'goal'].includes(this.phase)) { this.forfeit = p.side; this.endMatch(); } }

  get size() { return this.settings.format === '2v2' ? 4 : 2; }
  start(name) {
    this.hostOnly(name);
    if (this.players.length > this.size) throw new Error(`Trop de joueurs pour un ${this.settings.format === '2v2' ? '2 contre 2' : '1 contre 1'}`);
    if (this.players.length < 2) throw new Error('Il faut un adversaire (ajoute un robot !)');
    while (this.players.length < this.size) this.addBot(name); // les robots complètent les équipes
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  // Nouveau match : équipes en alternance dans l'ordre du salon ; les côtés s'échangent d'un match à l'autre.
  nextRound() {
    this.roundNo++;
    const swap = this.roundNo % 2 === 0;
    this.world = CC.world(this.players.map((p, k) => ({ id: p.name, char: p.char, side: (k % 2) ^ (swap ? 1 : 0) })), { mode: this.settings.mode, stade: this.settings.stade, bonus: !!this.settings.bonus, seed: 1 + Math.floor(this.rng() * 1e9) });
    this.score = [0, 0];
    this.clockMs = this.settings.time * 1000;
    this.golden = false;
    this.forfeit = null;
    this.queues = {}; this.held = {}; this.acks = {}; this.brains = {};
    this.events = [];
    this.result = null;
    this.phaseTo('kickoff');
    this.stop();
    this.lastTick = this.clock(); this.debt = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  phaseTo(p) { this.phase = p; this.phaseAt = this.clock(); }
  stop() { clearInterval(this.timer); this.timer = null; }
  get deadline() {
    if (this.phase === 'kickoff') return this.phaseAt + KICKOFF_MS;
    if (this.phase === 'goal') return this.phaseAt + GOAL_MS;
    if (this.phase === 'end') return this.phaseAt + END_MS;
    return null;
  }
  timeout() {
    if (!this.deadline || this.clock() < this.deadline) return;
    if (this.phase === 'kickoff') this.phaseTo('play');
    else if (this.phase === 'goal') { if (this.golden || this.clockMs <= 0 || this.reached()) this.endMatch(); else { CC.kickoff(this.world); this.phaseTo('kickoff'); } }
    else if (this.phase === 'end') { if (this.roundNo < this.settings.rounds) this.nextRound(); else { this.stop(); this.finish(); } }
  }
  reached() { return this.settings.goals > 0 && Math.max(...this.score) >= this.settings.goals; }

  // Touches d'un joueur : [[numéro, bits], …] ; une consommée par image.
  input(name, list) {
    if (!Array.isArray(list) || !this.world) return;
    const q = (this.queues[name] ??= []), last = this.acks[name] ?? 0;
    for (const e of list.slice(0, 20)) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]) || e[1] < 0 || e[1] > 127) continue;
      if (e[0] <= last || (q.length && e[0] <= q.at(-1)[0])) continue;
      q.push([e[0], e[1]]);
    }
    while (q.length > QUEUE_MAX) { const [seq, bits] = q.shift(); this.held[name] = bits; this.acks[name] = seq; }
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (!['kickoff', 'play', 'goal', 'end'].includes(this.phase)) return;
    const now = this.clock();
    this.debt = Math.min(MAX_STEPS * TICK_MS, (this.debt ?? 0) + now - (this.lastTick ?? now));
    this.lastTick = now;
    let steps = 0;
    while (this.debt >= TICK_MS - 0.5) { this.debt -= TICK_MS; steps++; this.stepOnce(); }
    this.ticks = (this.ticks ?? 0) + steps;
    if (steps && (this.ticks % 2 === 0 || steps > 1)) this.emit?.('snap', this.snap());
  }
  snap() {
    const w = this.world;
    return { f: w.frame, p: w.players.map(CC.pack), b: w.balls.map(CC.packBall), it: w.items.map(i => [i.x, +i.y.toFixed(2), i.kind]), wl: w.walls.map(v => +v.toFixed(2)), gh: w.goalH.map(v => +v.toFixed(3)), bm: w.ballMod?.t > 0 ? w.ballMod.kind : null, wd: +w.wind.toFixed(2), ack: this.acks, ev: this.events.splice(0), clock: Math.max(0, Math.round(this.clockMs)), golden: this.golden };
  }
  stepOnce() {
    const w = this.world, inputs = {}, frozen = this.phase === 'kickoff' || this.phase === 'end';
    for (const p of w.players) {
      if (this.get(p.id)?.bot) inputs[p.id] = this.phase === 'play' ? Bot.think(w, p, this.settings.level, this.rng, (this.brains[p.id] ??= {})) : 0;
      else {
        const q = this.queues[p.id];
        if (q?.length) { const [seq, bits] = q.shift(); this.held[p.id] = bits; this.acks[p.id] = seq; }
        inputs[p.id] = this.held[p.id] ?? 0;
      }
      if (frozen) inputs[p.id] = 0;
    }
    if (frozen) return;
    const side = CC.stepWorld(w, inputs, this.events);
    if (this.phase !== 'play') return;
    this.clockMs -= TICK_MS;
    if (side !== null) {
      this.score[side]++;
      const team = w.players.filter(p => p.side === side), scorer = team.find(p => p.id === w.touch) ?? team[0];
      scorer.goals++;
      for (const p of w.players) if (p.side !== side) p.gauge = Math.min(1, p.gauge + 0.25); // un coup de pouce à ceux qui encaissent
      this.events.push({ t: 'goal', side, by: scorer.id, touch: w.touch, own: !!w.touch && !team.some(p => p.id === w.touch), score: [...this.score] });
      this.phaseTo('goal');
      this.notify?.();
    } else if (this.clockMs <= 0) {
      if (this.score[0] === this.score[1] && !this.golden) { this.golden = true; this.clockMs = GOLDEN_MS; this.events.push({ t: 'golden' }); this.notify?.(); }
      else this.endMatch();
    }
  }
  // Fin du match : victoire 3 points, nul 1 point chacun.
  endMatch() {
    const w = this.world, [s0, s1] = this.score;
    const win = this.forfeit !== null && this.forfeit !== undefined ? 1 - this.forfeit : s0 === s1 ? null : s0 > s1 ? 0 : 1;
    for (const p of w.players) { const pl = this.get(p.id); if (pl) pl.points += win === null ? 1 : p.side === win ? 3 : 0; }
    const sides = this.sides();
    this.result = { score: [s0, s1], forfeit: this.forfeit ?? null, win, winner: win === null ? null : sides[win].join(' & '), sides };
    this.phaseTo('end');
    this.notify?.();
  }
  sides() { return [0, 1].map(s => this.world?.players.filter(p => p.side === s).map(p => p.id) ?? []); }

  viewFor(name) {
    const v = this.baseView(name);
    return { ...v, score: this.score ?? [0, 0], result: this.result, sides: this.sides(), golden: !!this.golden, players: v.players.map(p => ({ ...p, char: this.get(p.name).char, acc: this.get(p.name).acc })) };
  }
}
module.exports = { Room, SETTINGS };
