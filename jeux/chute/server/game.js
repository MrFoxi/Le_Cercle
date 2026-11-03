// Chute Libre : salon de 2 à 12 joueurs (et robots), manches, dalles, éliminations et points.
// Chaque navigateur déplace son propre personnage et envoie sa position ; le serveur fait tomber les dalles,
// déplace les robots, décide qui est éliminé et envoie l'état de l'arène 20 fois par seconde. Testé par jeux/chute/chute.test.js.
const C = require('../client/sim');
const { PartyRoom } = require('../../../lib/room-base');

const MAX_PLAYERS = 12;
const SETTINGS = { rounds: [1, 3, 5] };
const COUNTDOWN_MS = 3500, ROUND_END_MS = 5000, MAX_ROUND_MS = 150000, TICK = 1 / 30;
const COLORS = ['#ff5a5f', '#3d8bff', '#ffc93c', '#2fd47a', '#a46bff', '#ff8a3d', '#22d3ee', '#f472b6', '#84cc16', '#f8fafc', '#94a3b8', '#e11d48'];
const BOT_NAMES = ['Robot Patate', 'Robot Gélatine', 'Robot Ressort', 'Robot Pirouette', 'Robot Culbute', 'Robot Bulle', 'Robot Plouf', 'Robot Zigzag', 'Robot Toupie', 'Robot Guimauve', 'Robot Flan'];
const num = v => typeof v === 'number' && Number.isFinite(v);

class Room extends PartyRoom {
  static MAX_PLAYERS = MAX_PLAYERS;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 3 };
    this.timer = null;
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), aggr: 0.5 + this.rng() }; } // robots plus ou moins bagarreurs
  left(name) { if (this.bodies?.[name]) this.eliminate(name); }

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
  viewFor(name) {
    return {
      ...this.baseView(name), order: this.order ?? [], lastWinner: this.lastWinner ?? null,
      spawn: this.bodies?.[name] && this.phase === 'countdown' ? { x: this.bodies[name].x, y: this.bodies[name].y } : null,
    };
  }
}

module.exports = { Room, SETTINGS, MAX_PLAYERS };
