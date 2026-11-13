// La Castagne : salon de 2 à 8 combattants (robots compris), choix du personnage, manches au nombre de vies.
// Le serveur fait foi : il reçoit les touches de chaque joueur (numérotées), fait tourner la simulation partagée
// (client/sim.js) 60 fois par seconde, et envoie l'état du combat 30 fois par seconde (« snap ») avec, pour chacun,
// le numéro de la dernière touche prise en compte (le navigateur rejoue les suivantes pour rester réactif).
// Testé par jeux/castagne/castagne.test.js.
const BR = require('../client/sim');
const { PartyRoom } = require('../../../lib/room-base');

const SETTINGS = { rounds: [1, 3, 5], stocks: [1, 3, 5], time: [120, 180, 300], mode: ['ffa', 'duel', 'teams', 'lms'] };
// Modes : mêlée générale, duel (exactement 2), équipes (rouge contre bleu, sans se taper dessus), dernier debout (une vie).
const MODES = { ffa: 'Mêlée générale', duel: 'Duel 1 contre 1', teams: '2 contre 2 (équipes)', lms: 'Dernier debout' };
const COUNTDOWN_MS = 3200, ROUND_END_MS = 6000, TICK_MS = 1000 / BR.FPS, QUEUE_MAX = 4, MAX_STEPS = 5;
const COLORS = ['#ff5a5f', '#3d8bff', '#ffc93c', '#2fd47a', '#a46bff', '#ff8a3d', '#22d3ee', '#f472b6'];
const BOT_NAMES = ['Robot Torgnole', 'Robot Mandale', 'Robot Baffe', 'Robot Gnon', 'Robot Pichenette', 'Robot Taloche', 'Robot Beigne'];
const { IN } = BR;

class Room extends PartyRoom {
  static MAX_PLAYERS = 8;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 3, stocks: 3, time: 180, arena: 'phare', mode: 'ffa' };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), char: extra?.bot ? BR.CHAR_IDS[Math.floor(this.rng() * BR.CHAR_IDS.length)] : 'fenna' }; }
  pick(name, char) {
    if (!BR.CHARS[char]) throw new Error('Personnage inconnu');
    if (this.phase !== 'lobby' && this.phase !== 'over') throw new Error('Attends la fin de la partie pour changer de personnage');
    this.get(name).char = char;
  }
  left(name) { const f = this.fighter(name); if (f) { f.state = 'out'; f.stocks = 0; } }
  fighter(name) { return this.world?.fighters.find(f => f.id === name); }

  start(name) {
    this.hostOnly(name);
    const n = this.players.length, mode = this.settings.mode;
    if (n < 2) throw new Error('Il faut au moins 2 combattants (ajoute des robots !)');
    if (mode === 'duel' && n !== 2) throw new Error('Un duel se joue à 2 exactement');
    if (mode === 'teams' && (n < 4 || n % 2)) throw new Error('En équipes, il faut un nombre pair de combattants, au moins 4');
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  nextRound() {
    this.roundNo++;
    this.phase = 'countdown';
    this.phaseAt = this.clock();
    const order = [...this.players].sort(() => this.rng() - 0.5), teams = this.settings.mode === 'teams';
    this.world = BR.world(this.settings.arena, order.map((p, k) => ({ id: p.name, char: p.char, team: teams ? (k % 2 ? 'bleu' : 'rouge') : null })), this.settings.mode === 'lms' ? 1 : this.settings.stocks);
    this.queues = {}; this.held = {}; this.acks = {};
    this.brains = {};
    this.out = []; // éliminés, dans l'ordre
    this.events = [];
    this.result = null;
    this.stop();
    this.lastTick = this.clock(); this.debt = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  get deadline() {
    if (this.phase === 'countdown') return this.phaseAt + COUNTDOWN_MS;
    if (this.phase === 'fight') return this.phaseAt + this.settings.time * 1000;
    if (this.phase === 'roundEnd') return this.phaseAt + ROUND_END_MS;
    return null;
  }
  timeout() {
    if (!this.deadline || this.clock() < this.deadline) return;
    if (this.phase === 'countdown') { this.phase = 'fight'; this.phaseAt = this.clock(); }
    else if (this.phase === 'fight') this.endRound();
    else if (this.phase === 'roundEnd') { if (this.roundNo < this.settings.rounds) this.nextRound(); else { this.stop(); this.finish(); } }
  }

  // Touches d'un joueur : [[numéro, bits], …], dans l'ordre ; le serveur en consomme une par image.
  input(name, list) {
    if (!Array.isArray(list) || !this.world) return;
    const q = (this.queues[name] ??= []), last = this.acks[name] ?? 0;
    for (const e of list.slice(0, 20)) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]) || e[1] < 0 || e[1] > 1023) continue;
      if (e[0] <= last || (q.length && e[0] <= q.at(-1)[0])) continue;
      q.push([e[0], e[1]]);
    }
    while (q.length > QUEUE_MAX) { const [seq, bits] = q.shift(); this.held[name] = bits; this.acks[name] = seq; } // trop d'avance : on rattrape
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (this.phase !== 'fight' && this.phase !== 'countdown' && this.phase !== 'roundEnd') return;
    const w = this.world, now = this.clock();
    // autant d'images que le temps réellement écoulé (la minuterie peut prendre du retard) ; au plus 5 d'un coup
    this.debt = Math.min(MAX_STEPS * TICK_MS, (this.debt ?? 0) + now - (this.lastTick ?? now));
    this.lastTick = now;
    let steps = 0;
    while (this.debt >= TICK_MS - 0.5 && (this.phase === 'fight' || this.phase === 'roundEnd')) { this.debt -= TICK_MS; steps++; this.stepOnce(); }
    if (this.phase === 'countdown') this.debt = 0;
    if (steps || this.phase === 'countdown') this.emit?.('snap', { f: w.frame, p: w.fighters.map(BR.pack), ...BR.packItems(w), ack: this.acks, ev: this.events.splice(0) });
  }
  stepOnce() {
    const w = this.world, inputs = {};
    {
      for (const f of w.fighters) {
        const p = this.get(f.id);
        if (p?.bot) inputs[f.id] = this.think(f);
        else {
          const q = this.queues[f.id];
          if (q?.length) { const [seq, bits] = q.shift(); this.held[f.id] = bits; this.acks[f.id] = seq; }
          inputs[f.id] = this.held[f.id] ?? 0;
        }
      }
      BR.stepWorld(w, inputs, this.events);
      for (const e of this.events) if (e.t === 'ko' && e.left <= 0 && !this.out.includes(e.id)) this.out.push(e.id);
      const left = BR.alive(w), sides = new Set(left.map(f => f.team ?? f.id));
      if (this.phase === 'fight' && sides.size <= 1) this.endRound();
    }
  }
  // Fin de manche : classement (le dernier debout gagne ; au temps : plus de vies, puis moins de dégâts).
  endRound() {
    const w = this.world;
    const standing = w.fighters.filter(f => !this.out.includes(f.id)).sort((a, b) => b.stocks - a.stocks || a.dmg - b.dmg);
    const ranking = [...standing.map(f => f.id), ...[...this.out].reverse()];
    const n = ranking.length, winTeam = this.settings.mode === 'teams' ? w.fighters.find(f => f.id === ranking[0])?.team : null;
    if (winTeam) for (const f of w.fighters) { const p = this.get(f.id); if (p && f.team === winTeam) p.points += 3; }
    else ranking.forEach((id, k) => { const p = this.get(id); if (p) p.points += n - 1 - k + (k === 0 ? 2 : 0); });
    this.result = { ranking, team: winTeam, kos: Object.fromEntries(w.fighters.map(f => [f.id, f.kos])), falls: Object.fromEntries(w.fighters.map(f => [f.id, f.falls])) };
    this.phase = 'roundEnd';
    this.phaseAt = this.clock();
    this.notify?.();
  }

  /* ---- Robots ---- */
  // Va vers l'ennemi le plus proche, saute vers lui, frappe à portée (fort quand il a beaucoup de dégâts), revient sur l'île.
  think(f) {
    if (f.state === 'out' || f.dead > 0) return 0;
    const b = (this.brains[f.id] ??= { next: 0, hold: 0, bits: 0 }), w = this.world, A = BR.ARENAS[w.arena], S = A.solids[0];
    if (w.frame < b.next) return b.bits & ~(IN.LIGHT | IN.HEAVY | IN.DODGE | (b.release ? IN.JUMP : 0));
    let bits = 0;
    if (f.state === 'ledge') { b.bits = IN.U; b.next = w.frame + 4; return IN.U; } // remonter sur l'île
    const off = f.x < S.x0 - 10 || f.x > S.x1 + 10;
    if (off || f.y > 30) {
      // revenir : vers le centre, sauter, puis coup de remontée
      bits |= f.x < 0 ? IN.R : IN.L;
      if (f.vy > 0 && f.y > -60) bits |= f.jumps > 0 ? IN.JUMP : f.recovery ? IN.HEAVY | IN.U : 0;
      b.bits = bits; b.next = w.frame + 8; b.release = true;
      return bits;
    }
    const item = w.items.find(i => i.ground && Math.abs(i.x - f.x) < 260 && Math.abs(i.y - f.y) < 40 && (i.kind === 'arme' ? !f.weapon : !((i.kind === 'bombe' || i.kind === 'neige') && f.item)));
    if (item) { bits |= item.x > f.x ? IN.R : IN.L; if (item.kind === 'arme' && Math.abs(item.x - f.x) < 40) bits = IN.PICK; b.bits = bits; b.next = w.frame + 4; return bits; }
    const foes = w.fighters.filter(o => o !== f && o.state !== 'out' && o.dead === 0 && !(f.team && o.team === f.team));
    if (!foes.length) return 0;
    const t = foes.reduce((m, o) => (Math.hypot(o.x - f.x, o.y - f.y) < Math.hypot(m.x - f.x, m.y - f.y) ? o : m));
    const dx = t.x - f.x, dy = t.y - f.y, near = Math.abs(dx) < 100 && Math.abs(dy) < 80;
    if (Math.abs(dx) > 50) bits |= dx > 0 ? IN.R : IN.L;
    if (dy < -90 && f.ground) bits |= IN.JUMP;
    if (dy > 90 && f.ground) bits |= IN.D;
    if (near && this.rng() < 0.55) {
      if (dx) bits |= dx > 0 ? IN.R : IN.L;
      const strong = t.dmg > 70 && this.rng() < 0.6;
      if (!f.ground && t.y > f.y + 30) bits |= IN.D;
      bits |= strong ? IN.HEAVY : IN.LIGHT;
      if (this.rng() < 0.35) bits &= ~(IN.L | IN.R);
    } else if (near && t.state === 'attack' && this.rng() < 0.35) bits |= this.rng() < 0.5 ? IN.DODGE : IN.SHIELD;
    if (f.item && Math.abs(dx) < 320 && Math.abs(dx) > 60 && this.rng() < 0.3) bits = (dx > 0 ? IN.R : IN.L) | IN.PICK;
    b.bits = bits; b.release = false;
    b.next = w.frame + 6 + Math.floor(this.rng() * 10);
    return bits;
  }

  viewFor(name) {
    const v = this.baseView(name);
    return { ...v, arena: this.settings.arena, teams: Object.fromEntries((this.world?.fighters ?? []).map(f => [f.id, f.team])), result: this.result, out: this.out ?? [], players: v.players.map(p => ({ ...p, char: this.get(p.name).char })) };
  }
}
module.exports = { Room, SETTINGS, MODES };
