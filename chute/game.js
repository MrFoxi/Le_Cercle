// Chute Libre : salon de 2 à 12 joueurs (et robots), manches, dalles, éliminations et points.
// Chaque navigateur déplace son propre personnage et envoie sa position ; le serveur fait tomber les dalles,
// déplace les robots, décide qui est éliminé et envoie l'état de l'arène 20 fois par seconde. Testé par test-chute.js.
const C = require('../public/chute/sim');

const MAX_PLAYERS = 12;
const SETTINGS = { rounds: [1, 3, 5] };
const COUNTDOWN_MS = 3500, ROUND_END_MS = 5000, MAX_ROUND_MS = 150000, TICK = 1 / 30;
const COLORS = ['#ff5a5f', '#3d8bff', '#ffc93c', '#2fd47a', '#a46bff', '#ff8a3d', '#22d3ee', '#f472b6', '#84cc16', '#f8fafc', '#94a3b8', '#e11d48'];
const BOT_NAMES = ['Robot Patate', 'Robot Gélatine', 'Robot Ressort', 'Robot Pirouette', 'Robot Culbute', 'Robot Bulle', 'Robot Plouf', 'Robot Zigzag', 'Robot Toupie', 'Robot Guimauve', 'Robot Flan'];
const num = v => typeof v === 'number' && Number.isFinite(v);

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.rng = rng;
    this.clock = clock;
    this.players = []; // { name, connected, bot?, color, points }
    this.spectators = [];
    this.phase = 'lobby'; // lobby | countdown | play | roundEnd | over
    this.round = 0; // numéro de partie (pour la liste des salons)
    this.roundNo = 0; // manche dans la partie
    this.settings = { rounds: 3 };
    this.wins = {};
    this.timer = null;
  }
  get host() { return this.players.find(p => !p.bot)?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  freeColor() { const used = this.players.map(p => p.color); return COLORS.find(c => !used.includes(c)) ?? COLORS[0]; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase !== 'lobby') throw new Error('Partie en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (12 joueurs) : tu peux regarder');
    this.players.push({ name, connected: true, color: this.freeColor(), points: 0 });
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (!this.players.some(p => !p.bot)) { this.players = []; this.stop(); return; } // plus d'humains : le salon ferme
    if (this.bodies?.[name]) this.eliminate(name);
  }

  addBot(name) {
    this.hostOnly(name);
    if (this.players.length >= MAX_PLAYERS) throw new Error('Le salon est complet');
    const bot = BOT_NAMES.find(n => !this.taken(n));
    this.players.push({ name: bot, connected: true, bot: true, color: this.freeColor(), points: 0, aggr: 0.5 + this.rng() });
  }
  removeBot(name, bot) {
    this.hostOnly(name);
    if (!this.get(bot)?.bot) throw new Error('Ce joueur n’est pas un robot');
    this.players = this.players.filter(p => p.name !== bot);
  }
  configure(name, key, value) {
    this.hostOnly(name);
    if (!SETTINGS[key]?.includes(value)) throw new Error('Réglage invalide');
    this.settings[key] = value;
  }
  hostOnly(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
  }

  start(name) {
    this.hostOnly(name);
    if (this.players.length < 2) throw new Error('Il faut au moins 2 joueurs (ajoute des robots !)');
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  // Nouvelle manche : arène neuve, joueurs en cercle sur l'étage du haut.
  nextRound() {
    this.roundNo++;
    this.phase = 'countdown';
    this.phaseAt = this.clock();
    this.state = new Uint8Array(C.tiles.length);
    this.crack = new Float32Array(C.tiles.length);
    this.order = []; // éliminés, dans l'ordre
    this.bodies = {};
    this.brains = {};
    const names = this.players.map(p => p.name).sort(() => this.rng() - 0.5);
    names.forEach((n, k) => {
      const a = k / names.length * Math.PI * 2, r = 4.5;
      this.bodies[n] = C.newPlayer(Math.cos(a) * r, Math.sin(a) * r);
      this.brains[n] = { aggr: this.get(n).aggr ?? 1 };
    });
    this.seq = 0;
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK * 1000);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); this.timer = null; }

  get deadline() {
    if (this.phase === 'countdown') return this.phaseAt + COUNTDOWN_MS;
    if (this.phase === 'roundEnd') return this.phaseAt + ROUND_END_MS;
    if (this.phase === 'play') return this.phaseAt + MAX_ROUND_MS;
    return null;
  }
  timeout() {
    const now = this.clock();
    if (now < this.deadline) return;
    if (this.phase === 'countdown') { this.phase = 'play'; this.phaseAt = now; }
    else if (this.phase === 'play') this.endRound();
    else if (this.phase === 'roundEnd') {
      if (this.roundNo < this.settings.rounds) this.nextRound();
      else this.finish();
    }
  }

  // Position envoyée par le navigateur d'un joueur (contrôlée : pas de téléportation).
  move(name, p) {
    const b = this.bodies?.[name];
    if (!b || !b.alive || this.phase !== 'play' || !p || ![p.x, p.y, p.z].every(num)) return;
    if (Math.abs(p.x) > 30 || Math.abs(p.y) > 30 || p.z > 4) return;
    if (Math.hypot(p.x - b.x, p.y - b.y) > 4 || p.z > b.z + 3) return;
    b.heard = this.clock();
    Object.assign(b, { x: p.x, y: p.y, z: p.z, dashT: p.d ? 0.1 : 0, dx: num(p.dx) ? p.dx : b.dx, dy: num(p.dy) ? p.dy : b.dy, vx: num(p.vx) ? p.vx : 0, vy: num(p.vy) ? p.vy : 0 });
    if (p.z < C.DEATH) this.eliminate(name);
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (this.phase === 'play') {
      const list = Object.entries(this.bodies);
      for (const [n, b] of list) {
        if (!b.alive) continue;
        const pl = this.get(n);
        if (pl?.bot) {
          const ev = C.step(b, C.bot(b, this.brains[n], this.state, Object.values(this.bodies), this.rng), this.state, TICK);
          if (ev.includes('out')) this.eliminate(n);
        } else if (!pl?.connected || this.clock() - (b.heard ?? this.phaseAt) > 4000) this.eliminate(n); // parti, ou muet depuis 4 s
      }
      // Les robots se bousculent entre eux et sont bousculés par les joueurs.
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const [na, a] = list[i], [nb, b] = list[j], ba = this.get(na)?.bot, bb = this.get(nb)?.bot;
        if (ba && bb) C.collide(a, b);
        else if (ba) C.collide(a, b, true);
        else if (bb) C.collide(b, a, true);
      }
      // Dalles : celles qu'on touche craquent, puis tombent.
      for (const b of Object.values(this.bodies)) {
        if (!b.alive) continue;
        const layer = C.LAYERS.findIndex(h => Math.abs(b.z - h) < 0.08);
        if (layer < 0) continue;
        const k = C.tileAt(layer, b.x, b.y);
        if (k >= 0 && this.state[k] === 0) { this.state[k] = 1; this.crack[k] = C.CRACK; }
      }
      for (let k = 0; k < this.state.length; k++) if (this.state[k] === 1 && (this.crack[k] -= TICK) <= 0) this.state[k] = 2;
      const alive = Object.values(this.bodies).filter(b => b.alive).length;
      if (alive <= 1) this.endRound();
    }
    this.emit?.('snap', this.snapshot());
  }
  snapshot() {
    const r = v => Math.round(v * 100) / 100;
    return {
      n: ++this.seq, phase: this.phase, tiles: Array.from(this.state).join(''),
      p: Object.entries(this.bodies).map(([n, b]) => [n, r(b.x), r(b.y), r(b.z), b.alive ? 1 : 0, b.dashT > 0 ? 1 : 0, r(b.dx), r(b.dy)]),
    };
  }

  eliminate(name) {
    const b = this.bodies[name];
    if (!b || this.order.includes(name)) return;
    b.alive = false;
    this.order.push(name);
    this.notify?.();
  }
  // Fin de manche : chacun marque autant de points que de joueurs tombés avant lui.
  endRound() {
    if (this.phase !== 'play') return;
    for (const [n, b] of Object.entries(this.bodies)) if (b.alive) { this.order.push(n); b.alive = false; }
    this.order.forEach((n, k) => { const p = this.get(n); if (p) p.points += k; });
    this.lastWinner = this.order.at(-1);
    this.phase = 'roundEnd';
    this.phaseAt = this.clock();
    this.stop();
    this.emit?.('snap', this.snapshot());
    this.notify?.();
  }
  finish() {
    this.phase = 'over';
    this.ranking = [...this.players].sort((a, b) => b.points - a.points).map(p => ({ name: p.name, points: p.points, color: p.color }));
    const w = this.ranking[0]?.name;
    if (w) this.wins[w] = (this.wins[w] ?? 0) + 1;
  }
  again(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'over') throw new Error('La partie n’est pas finie');
    this.phase = 'lobby';
  }

  summary() { return { rounds: this.settings.rounds }; }
  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, roundNo: this.roundNo, me: name, host: this.host, now: this.clock(),
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      deadline: this.deadline, order: this.order ?? [], lastWinner: this.lastWinner ?? null, ranking: this.phase === 'over' ? this.ranking : null,
      players: this.players.map(p => ({ name: p.name, connected: p.connected, bot: !!p.bot, color: p.color, points: p.points, wins: this.wins[p.name] ?? 0 })),
      spawn: this.bodies?.[name] && this.phase === 'countdown' ? { x: this.bodies[name].x, y: this.bodies[name].y } : null,
    };
  }
}

module.exports = { Room, SETTINGS, MAX_PLAYERS };
