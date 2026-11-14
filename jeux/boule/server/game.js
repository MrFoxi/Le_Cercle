// Boule de Pute : salon de 1 à 8 joueurs (les robots complètent), plusieurs modes :
//   equipes : deux équipes, chacune dans sa moitié ; la première à gagner la majorité des manches l'emporte.
//   chacun  : chacun pour soi, tout le monde partout ; dernier debout gagne la manche.
//   patate  : en équipes, mais la boule explose au bout de 10 s sur celui qu'elle vise.
//   survie  : les humains contre des vagues de robots de plus en plus nombreuses et vives ; une manche perdue et c'est fini.
//   entrainement : face à un lanceur automatique qui renvoie tout ; personne n'est éliminé, on compte les échanges.
//   coupe   : tournoi à quatre équipes (demi-finales puis finale, chaque match au meilleur des 3 manches).
// Le serveur fait foi : il reçoit les touches numérotées et le regard des joueurs, fait tourner la physique partagée
// (client/sim.js) 60 fois par seconde en rattrapant le temps perdu, et envoie l'état 30 fois par seconde (« snap »).
// Testé par jeux/boule/boule.test.js.
const BD = require('../client/sim');
const { PartyRoom } = require('../../../lib/room-base');

const LOOKS = ['bobby', 'mama', 'tonton', 'zaza', 'robox', 'mamie', 'chef', 'catcheur', 'astro', 'vampire', 'pigeon'];
const ACCS = ['aucun', 'moustache', 'frites', 'helice', 'banane', 'noeud'];
const TRAILS = ['classique', 'arcenciel', 'flammes', 'coeurs', 'eclairs'];
const EMOTES = ['danse', 'moque', 'pleure', 'bravo'];
const MODES = ['equipes', 'chacun', 'patate', 'survie', 'entrainement', 'coupe'];
const SETTINGS = { rounds: [3, 5, 7], teamSize: [1, 2, 3, 4], level: [1, 2, 3], mode: MODES, arena: [...BD.ARENA_IDS, 'hasard'] };
const COUNT_MS = 3000, END_MS = 4500, TICK_MS = 1000 / BD.FPS, QUEUE_MAX = 4, MAX_STEPS = 5;
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
    this.settings = { rounds: 3, teamSize: 2, level: 2, mode: 'equipes', arena: 'gym' };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), look: extra?.bot ? LOOKS[Math.floor(this.rng() * LOOKS.length)] : 'bobby', acc: 'aucun', trail: 'classique' }; }
  pick(name, look, acc = 'aucun', trail = 'classique') {
    if (!LOOKS.includes(look)) throw new Error('Personnage inconnu');
    if (!ACCS.includes(acc) || !TRAILS.includes(trail)) throw new Error('Objet inconnu');
    Object.assign(this.get(name), { look, acc, trail });
  }
  emote(name, e) {
    const p = this.world?.players.find(x => x.id === name);
    if (!EMOTES.includes(e) || !p || p.emoteT > 0) return;
    p.emote = e; p.emoteT = 2.5; this.events.push({ t: 'emote', id: name, e, alive: p.alive });
  }
  // Un joueur s'en va en pleine manche : il disparaît de l'arène.
  left(name) { if (this.world) this.world.players = this.world.players.filter(x => x.id !== name); }

  start(name) {
    this.hostOnly(name);
    const s = this.settings, mode = s.mode;
    if (mode === 'coupe') s.teamSize = Math.min(2, s.teamSize);
    const want = mode === 'coupe' ? 4 * s.teamSize : mode === 'survie' || mode === 'entrainement' ? 0 : mode === 'chacun' ? Math.max(3, s.teamSize * 2) : s.teamSize * 2;
    if (['equipes', 'patate'].includes(mode) && this.players.length > want) s.teamSize = Math.min(4, Math.ceil(this.players.length / 2));
    while (this.players.length < Math.min(8, Math.max(want, ['equipes', 'patate'].includes(mode) ? s.teamSize * 2 : want))) this.addBot(name); // les robots complètent
    if (['equipes', 'patate'].includes(mode) && this.players.length % 2) this.addBot(name);
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.stats = {};
    this.ffaWins = {};
    this.wave = 1;
    this.cup = null;
    if (mode === 'coupe') { const list = [...this.players]; this.cup = { teams: [0, 1, 2, 3].map(k => list.slice(k * s.teamSize, (k + 1) * s.teamSize).map(p => p.name)), matches: [[0, 1], [2, 3]], idx: 0, winners: [] }; }
    this.newMatch();
  }
  // Composition d'un match (les deux équipes qui jouent, ou tout le monde) ; teamWins remis à zéro.
  newMatch() {
    const s = this.settings, mode = s.mode, humans = this.players.filter(p => !p.bot);
    let entries;
    if (mode === 'coupe') { const [a, b] = this.cup.matches[this.cup.idx]; entries = [...this.cup.teams[a].map(n => ({ n, team: 0 })), ...this.cup.teams[b].map(n => ({ n, team: 1 }))].map(({ n, team }) => ({ id: n, team, look: this.get(n).look, bot: !!this.get(n).bot })); }
    else if (mode === 'chacun') entries = this.players.map((p, k) => ({ id: p.name, team: k, look: p.look, bot: !!p.bot }));
    else if (mode === 'survie') entries = humans.map(p => ({ id: p.name, team: 0, look: p.look }));
    else if (mode === 'entrainement') entries = [...humans.map(p => ({ id: p.name, team: 0, look: p.look, immortal: true })), { id: '🤖 Lanceur', team: 1, look: 'robox', bot: true, immortal: true, launcher: true }];
    else entries = this.players.map((p, k) => ({ id: p.name, team: k % 2, look: p.look, bot: !!p.bot }));
    this.entries = entries;
    this.teamWins = [0, 0];
    this.nextRound();
  }
  nextRound() {
    this.roundNo++;
    const s = this.settings;
    let entries = this.entries;
    if (s.mode === 'survie') { // une vague de robots de plus à chaque manche gagnée
      const names = ['Robot Patate', 'Robot Gros-Bras', 'Robot Esquive', 'Robot Pif-Paf', 'Robot Badaboum', 'Robot Zigzag', 'Robot Molosse'];
      entries = [...entries, ...names.slice(0, Math.min(7, this.wave)).map((n, k) => ({ id: `${n} ${this.wave > 7 ? this.wave : ''}`.trim(), team: 1, look: LOOKS[(k + this.wave) % LOOKS.length], bot: true }))];
    }
    const arena = s.arena === 'hasard' ? BD.ARENA_IDS[Math.floor(this.rng() * BD.ARENA_IDS.length)] : s.arena;
    this.world = BD.world(entries, { arena, mode: s.mode, seed: 1 + Math.floor(this.rng() * 1e9) });
    for (const p of this.world.players) p.bot = !!entries.find(e => e.id === p.id)?.bot;
    this.queues = {}; this.held = {}; this.acks = {}; this.brains = {};
    this.events = []; this.result = null;
    this.phaseTo(s.mode === 'entrainement' ? 'play' : 'count');
    this.stop();
    this.lastTick = this.clock(); this.debt = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
    this.notify?.();
  }
  phaseTo(p) { this.phase = p; this.phaseAt = this.clock(); }
  stop() { clearInterval(this.timer); this.timer = null; }
  get deadline() {
    if (this.phase === 'count') return this.phaseAt + COUNT_MS;
    if (this.phase === 'roundEnd') return this.phaseAt + END_MS;
    return null;
  }
  get need() { return this.settings.mode === 'coupe' ? 2 : Math.ceil(this.settings.rounds / 2); }
  timeout() {
    if (!this.deadline || this.clock() < this.deadline) return;
    if (this.phase === 'count') { this.phaseTo('play'); this.notify?.(); return; }
    if (this.phase !== 'roundEnd') return;
    const mode = this.settings.mode, r = this.result;
    if (mode === 'survie') { if (r.win === 0) { this.wave++; this.nextRound(); } else { this.stop(); this.finish(); } return; }
    if (mode === 'chacun') { if (Math.max(0, ...Object.values(this.ffaWins ?? {})) >= this.need) { this.stop(); this.finish(); } else this.nextRound(); return; }
    if (Math.max(...this.teamWins) < this.need) return this.nextRound();
    if (mode === 'coupe') { // match fini : demi-finale suivante, finale, ou fin du tournoi
      const c = this.cup, [a, b] = c.matches[c.idx], w = this.teamWins[0] > this.teamWins[1] ? a : b;
      c.winners.push(w); c.idx++;
      if (c.idx === 2) c.matches.push([c.winners[0], c.winners[1]]);
      if (c.idx < c.matches.length) { this.events.push({ t: 'cup', next: c.matches[c.idx], winner: w }); return this.newMatch(); }
      for (const n of c.teams[w]) { const p = this.get(n); if (p) p.points += 10; }
      c.champion = w;
    }
    this.stop(); this.finish();
  }

  // Touches d'un joueur : [[numéro, bits, regard], …] ; une consommée par image.
  input(name, list) {
    if (!Array.isArray(list) || !this.world) return;
    const q = (this.queues[name] ??= []), last = this.acks[name] ?? 0;
    for (const e of list.slice(0, 20)) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]) || e[1] < 0 || e[1] > 127 || !Number.isFinite(e[2])) continue;
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
      if (p.bot) inputs[p.id] = this.think(p);
      else {
        const q = this.queues[p.id];
        if (q?.length) { const [seq, bits, yaw] = q.shift(); this.held[p.id] = [bits, yaw]; this.acks[p.id] = seq; }
        inputs[p.id] = this.held[p.id] ?? [0, p.yaw];
      }
    }
    const ev0 = this.events.length;
    const win = BD.stepWorld(w, inputs, this.events, this.phase === 'play');
    for (const e of this.events.slice(ev0)) this.count(e);
    if (win !== null && this.phase === 'play') this.endRound(win);
  }
  // Statistiques de la partie, pour l'écran de fin.
  count(e) {
    const st = id => (this.stats[id] ??= { reflects: 0, perfect: 0, kills: 0, best: 0, rally: 0 });
    if (e.t === 'reflect') { const s = st(e.id); s.reflects++; if (e.perfect) s.perfect++; s.best = Math.max(s.best, e.v); s.rally = Math.max(s.rally, e.hits); }
    if (e.t === 'kill' && e.by && e.by !== e.id) st(e.by).kills++;
  }
  endRound(win) {
    const w = this.world, mode = this.settings.mode;
    if (mode === 'chacun') { const id = w.players.find(p => p.team === win)?.id; this.ffaWins = this.ffaWins ?? {}; if (id) { this.ffaWins[id] = (this.ffaWins[id] ?? 0) + 1; const pl = this.get(id); if (pl) pl.points++; } }
    else if (win >= 0) { this.teamWins[win]++; for (const p of w.players) { const pl = this.get(p.id); if (pl && p.team === win) pl.points++; } }
    // récompenses de la manche
    const top = key => { const p = [...w.players].sort((a, b) => b.rs[key] - a.rs[key])[0]; return p && p.rs[key] > 0 ? { id: p.id, n: p.rs[key] } : null; };
    const awards = [['🏓 Meilleur renvoyeur', top('reflects')], ['⚡ Roi du timing', top('perfect')], ['🙈 Pire timing', top('whiffs')], ['🎯 Victime préférée de la boule', top('targeted')]].filter(([, a]) => a).map(([label, a]) => ({ label, ...a }));
    this.result = { win, teamWins: [...this.teamWins], wave: this.wave, awards };
    this.events.push({ t: 'round', win, teamWins: [...this.teamWins], winner: mode === 'chacun' ? w.players.find(p => p.team === win)?.id : null, awards, wave: this.wave });
    w.ball = null;
    this.phaseTo('roundEnd');
    this.notify?.();
  }
  finish() {
    super.finish();
    if (this.settings.mode === 'survie') this.ranking = this.ranking.filter(p => !p.bot);
  }

  /* ---- Robot ---- */
  // Se promène (sur la terre ferme), s'écarte de la boule quand elle le vise de loin, et la renvoie au bon moment.
  // Le niveau règle la justesse : plus la boule va vite, plus il rate. Le lanceur de l'entraînement ne rate jamais.
  think(p) {
    const w = this.world, b = w.ball, lvl = this.settings.mode === 'survie' ? Math.min(3, 1 + Math.floor((this.wave - 1) / 2)) : this.settings.level, br = (this.brains[p.id] ??= { gx: p.x, gz: p.z, next: 0, armed: true });
    if (!p.alive) return [0, p.yaw];
    const islands = BD.ARENAS[w.arena].islands, side = w.halves ? (p.team ? 1 : -1) : 0;
    if (w.frame >= br.next) {
      br.next = w.frame + 60 + Math.floor(this.rng() * 120);
      for (let k = 0; k < 10; k++) { // un point sûr (sur une île dans le ciel), dans sa moitié en équipes
        const gx = side ? side * (3 + this.rng() * 12) : (this.rng() * 2 - 1) * 14, gz = (this.rng() * 2 - 1) * 8;
        if (!islands || islands.some(r => BD.inRect(gx, gz, [r[0] + 1, r[1] - 1, r[2] + 1, r[3] - 1]))) { br.gx = gx; br.gz = gz; break; }
      }
      if (p.launcher) { br.gx = 13; br.gz = 0; }
    }
    let yaw = p.yaw, bits = 0;
    const foes = BD.foes(w, p);
    if (foes.length) { const f = foes[(p.saves + p.kills) % foes.length]; yaw = Math.atan2(f.z - p.z, f.x - p.x) + (p.launcher ? 0 : (this.rng() - 0.5) * 0.3); }
    let tx = br.gx, tz = br.gz;
    const mine = b && (b.state === 'fly' || b.state === 'grace') && b.target === p.id && !(b.launch > 0);
    if (mine) {
      const d = Math.hypot(b.x - p.x, b.y - p.y - P.chest, b.z - p.z);
      if (d > 7 && !islands) { tz = p.z + (b.z > p.z ? -3 : 3); tx = p.x; } // s'écarter un peu
      else { tx = p.x; tz = p.z; }
      if (br.armed && d < B.range - Math.min(1.2, b.v * BD.DT * 2)) {
        br.armed = false;
        if (p.launcher || this.rng() < Math.max(0.15, 1.1 - b.v / (30 + lvl * 25))) bits |= IN.HIT;
      }
    } else br.armed = true;
    const dx = tx - p.x, dz = tz - p.z;
    // dans le ciel : sauter quand le sol manque juste devant
    if (islands && p.ground && Math.hypot(dx, dz) > 0.5) { const l = Math.hypot(dx, dz); if (!BD.onGround(w, p.x + (dx / l) * 1.1, p.z + (dz / l) * 1.1)) bits |= IN.JUMP; }
    if (Math.hypot(dx, dz) > 0.5) {
      const [fx, fz] = BD.fwd(yaw), f = dx * fx + dz * fz, s = -dx * fz + dz * fx;
      if (f > 0.3) bits |= IN.F; else if (f < -0.3) bits |= IN.B;
      if (s > 0.3) bits |= IN.R; else if (s < -0.3) bits |= IN.L;
    }
    return [bits, yaw];
  }

  viewFor(name) {
    const v = this.baseView(name), w = this.world, c = this.cup;
    return {
      ...v, teamWins: this.teamWins ?? [0, 0], need: this.need, result: this.result, wave: this.wave ?? 1, arena: w?.arena ?? 'gym', stats: this.phase === 'over' ? this.stats : null,
      ffaWins: this.ffaWins ?? {}, cup: c && { teams: c.teams, matches: c.matches, idx: c.idx, winners: c.winners, champion: c.champion ?? null },
      inWorld: w?.players.map(p => ({ id: p.id, team: p.team, look: p.look, acc: this.get(p.id)?.acc ?? 'aucun', trail: this.get(p.id)?.trail ?? 'classique', bot: !!p.bot })) ?? [],
      players: v.players.map(p => ({ ...p, look: this.get(p.name).look })),
    };
  }
}
module.exports = { Room, SETTINGS, LOOKS, ACCS, TRAILS, EMOTES };
