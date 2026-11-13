// Caboche Cup : salon pour un match 1 contre 1 (un robot remplace l'adversaire en solo), plusieurs matchs d'affilée possibles.
// Le serveur fait foi : il reçoit les touches numérotées des joueurs, fait tourner la physique partagée (client/sim.js)
// 60 fois par seconde en rattrapant le temps perdu, et envoie l'état 30 fois par seconde (« snap »).
// Étapes : coup d'envoi (compte à rebours), jeu, but (célébration), fin du match ; égalité au temps : but en or.
// Testé par jeux/caboche/caboche.test.js.
const CC = require('../client/sim');
const { PartyRoom } = require('../../../lib/room-base');

const SETTINGS = { rounds: [1, 3, 5], time: [120, 180], level: [1, 2, 3] };
const KICKOFF_MS = 2200, GOAL_MS = 3200, END_MS = 6000, GOLDEN_MS = 60000, TICK_MS = 1000 / CC.FPS, QUEUE_MAX = 4, MAX_STEPS = 5;
const COLORS = ['#ff4d4d', '#3d8bff'];
const BOT_NAMES = ['Robot Crampon', 'Robot Lucarne', 'Robot Petit-Pont'];
const { IN } = CC;

class Room extends PartyRoom {
  static MAX_PLAYERS = 2;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 1, time: 120, level: 2 };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), char: extra?.bot ? CC.CHAR_IDS[Math.floor(this.rng() * CC.CHAR_IDS.length)] : 'bouboule' }; }
  pick(name, char) {
    if (!CC.CHARS[char]) throw new Error('Personnage inconnu');
    if (this.phase !== 'lobby' && this.phase !== 'over') throw new Error('Attends la fin du match pour changer de personnage');
    this.get(name).char = char;
  }
  // Un joueur s'en va en plein match : il perd par forfait.
  left(name) { const p = this.world?.players.find(x => x.id === name); if (p && ['kickoff', 'play', 'goal'].includes(this.phase)) { this.forfeit = p.side; this.endMatch(); } }

  start(name) {
    this.hostOnly(name);
    if (this.players.length < 2) throw new Error('Il faut un adversaire (ajoute un robot !)');
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  // Nouveau match : les côtés s'échangent d'un match à l'autre.
  nextRound() {
    this.roundNo++;
    const order = this.roundNo % 2 ? this.players : [...this.players].reverse();
    this.world = CC.world(order.map(p => ({ id: p.name, char: p.char })));
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
    else if (this.phase === 'goal') { if (this.golden || this.clockMs <= 0) this.endMatch(); else { CC.kickoff(this.world); this.phaseTo('kickoff'); } }
    else if (this.phase === 'end') { if (this.roundNo < this.settings.rounds) this.nextRound(); else { this.stop(); this.finish(); } }
  }

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
    if (steps && (this.ticks % 2 === 0 || steps > 1)) this.emit?.('snap', { f: this.world.frame, p: this.world.players.map(CC.pack), b: CC.packBall(this.world.ball), ack: this.acks, ev: this.events.splice(0), clock: Math.max(0, Math.round(this.clockMs)), golden: this.golden });
  }
  stepOnce() {
    const w = this.world, inputs = {}, frozen = this.phase === 'kickoff' || this.phase === 'end';
    for (const p of w.players) {
      if (this.get(p.id)?.bot) inputs[p.id] = this.phase === 'play' ? this.think(p) : 0;
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
      const scorer = w.players.find(p => p.side === side);
      scorer.goals++;
      const loser = w.players.find(p => p.side !== side); loser.gauge = Math.min(1, loser.gauge + 0.25); // un coup de pouce à celui qui encaisse
      this.events.push({ t: 'goal', side, by: scorer.id, own: w.touch && w.touch !== scorer.id, score: [...this.score] });
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
    this.result = { score: [s0, s1], forfeit: this.forfeit ?? null, winner: win === null ? null : w.players.find(p => p.side === win).id, sides: w.players.map(p => p.id) };
    this.phaseTo('end');
    this.notify?.();
  }

  /* ---- Robot ---- */
  // Repasse du bon côté du ballon (en sautant par-dessus s'il le faut), le frappe vers le but adverse, le pique par-dessus
  // l'adversaire qui barre la route, saute pour les têtes, sprinte quand il est loin, tacle parfois.
  // Le niveau règle la vitesse de réaction et la justesse.
  think(p) {
    const w = this.world, b = w.ball, lvl = this.settings.level, br = (this.brains[p.id] ??= { next: 0, bits: 0 });
    if (w.frame < br.next) return br.bits & ~(IN.KICK | IN.JUMP | IN.TACKLE | IN.POWER);
    br.next = w.frame + [12, 7, 3][lvl - 1] + Math.floor(this.rng() * 4);
    const s = CC.dirOf(p), o = w.players.find(x => x !== p);
    const look = [0.1, 0.2, 0.3][lvl - 1], bx = b.x + b.vx * look; // ballon anticipé un peu
    const ahead = (bx - p.x) * s > 0.15; // le ballon est devant moi (vers le but adverse)
    const tx = bx - s * (ahead ? 0.55 : 0.9);
    let bits = 0;
    if (tx > p.x + 0.2) bits |= IN.R; else if (tx < p.x - 0.2) bits |= IN.L;
    const far = Math.abs(tx - p.x);
    if (far > 3.5 && p.sta > 0.4 && lvl > 1) bits |= IN.SPRINT;
    const dx = (b.x - p.x) * s, dist = Math.hypot(b.x - p.x - s * 0.5, b.y - p.y - 0.35);
    // repasser derrière le ballon : sauter par-dessus plutôt que le pousser vers mon but
    if (!ahead && Math.abs(b.x - p.x) < 1.6 && b.y < 1.2 && p.ground) bits |= IN.JUMP;
    // ballon à hauteur de tête qui file vers mon but : ne pas le rattraper par-derrière (ma tête le pousserait dedans)
    if (!ahead && b.vx * s < -2 && b.y > 1.0 && b.y < 3.4 && Math.abs(b.x - p.x) < 2.2) bits &= ~(IN.L | IN.R | IN.SPRINT);
    // tirer : le robot essaie le tir dans sa tête ; si l'adversaire le renverrait, il change de geste (piqué, lob)
    if (ahead && dist < 1.3) {
      const now = this.shot(p, o, p.vx), still = this.shot(p, o, 0), back = this.shot(p, o, -s * 3);
      if (dist < 0.95 && now !== 'contre' && this.rng() < [0.45, 0.75, 0.95][lvl - 1]) bits |= IN.KICK;
      else if (now === 'contre' && still === 'contre' && back === 'contre' && dist < 0.95 && (br.stuck = (br.stuck ?? 0) + 1) > 6) { br.stuck = 0; bits = IN.KICK; } // rien ne passe : tenter quand même
      else if (now === 'contre') bits = (bits & ~(IN.L | IN.R | IN.SPRINT)) | (still !== 'contre' ? 0 : back !== 'contre' ? (s > 0 ? IN.L : IN.R) : 0);
    }
    // tête : ballon haut qui redescend juste devant
    // tête : là où sera le ballon dans un quart de seconde, à hauteur de saut
    const hx = b.x + b.vx * 0.25, hy = b.y + b.vy * 0.25 - 0.47;
    if (hy > 1.9 && hy < 4.2 && (hx - p.x) * s > 0.15 && (hx - p.x) * s < 1.3 && p.ground && this.rng() < [0.3, 0.55, 0.8][lvl - 1]) bits |= IN.JUMP;
    // interception : quand le ballon arrivera sur moi, et à quelle hauteur ; s'il passe au-dessus de ma tête, sauter
    const tt = b.vx ? (p.x - b.x) / b.vx : -1, yt = b.y + b.vy * tt - 7.5 * tt * tt;
    if (tt > 0.05 && tt < 0.4 && yt > 1.7 && yt < 3.9 && p.ground && this.rng() < [0.35, 0.6, 0.85][lvl - 1]) bits |= IN.JUMP;
    // l'adversaire barre le chemin : lui sauter par-dessus
    const go = bits & IN.R ? 1 : bits & IN.L ? -1 : 0;
    if (go && o && o.y < 0.5 && (o.x - p.x) * go > 0 && (o.x - p.x) * go < 1.3 && p.ground) bits |= IN.JUMP;
    if (o && o.stun <= 0 && o.y < 0.5 && (o.x - p.x) * s > 0 && (o.x - p.x) * s < 2 && Math.abs(b.x - o.x) < 1.2 && this.rng() < [0.04, 0.1, 0.18][lvl - 1]) bits = IN.TACKLE | (s > 0 ? IN.R : IN.L);
    if (p.gauge >= 1 && Math.abs(b.x - p.x) < 4 && this.rng() < 0.3) bits |= IN.POWER;
    br.bits = bits;
    return bits;
  }

  // Où irait le ballon si p tirait maintenant avec la vitesse vx : 'but', 'contre' (renvoyé par l'adversaire) ou 'ok'.
  shot(p, o, vx) {
    const b = { ...this.world.ball }, s = CC.dirOf(p), [, deg, pw] = CC.kickOf({ ...p, vx, sprint: p.sprint && vx * s > 0 }, b), an = (deg * Math.PI) / 180;
    b.vx = s * Math.cos(an) * pw; b.vy = Math.sin(an) * pw;
    const w = { ball: b }, ev = [];
    for (let k = 0; k < 360; k++) {
      CC.stepBall(w, ev, CC.DT / 2);
      if (o && (Math.hypot(b.x - o.x, b.y - CC.headY(o)) < CC.headR(o) + CC.BALL.r + 0.1 || Math.hypot(b.x - o.x, b.y - o.y - CC.BODY.y) < CC.BODY.r + CC.BALL.r + 0.1)) return 'contre';
      if (Math.abs(b.x) > CC.F.HL + CC.BALL.r && b.y < CC.F.GH) return Math.sign(b.x) === s ? 'but' : 'contre';
    }
    return 'ok';
  }

  viewFor(name) {
    const v = this.baseView(name);
    return { ...v, score: this.score ?? [0, 0], result: this.result, sides: this.world?.players.map(p => p.id) ?? [], golden: !!this.golden, players: v.players.map(p => ({ ...p, char: this.get(p.name).char })) };
  }
}
module.exports = { Room, SETTINGS };
