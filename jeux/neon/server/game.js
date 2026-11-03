// Sillage Néon : motos de lumière sur une grille. Chacune laisse une traînée ; toucher un mur, une traînée
// ou une autre moto élimine. Le serveur fait avancer tout le monde au même rythme (12 pas par seconde) : les collisions
// sont les mêmes pour tous. De 2 à 8 joueurs, robots compris. Testé par jeux/neon/neon.test.js.
const MAX_PLAYERS = 8;
const SETTINGS = { rounds: [3, 5, 7] };
const TICK_MS = 1000 / 12, COUNTDOWN_MS = 3500, ROUND_END_MS = 4000, MAX_ROUND_MS = 120000;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // droite, bas, gauche, haut
const BOOST_TICKS = 18, BOOST_COST = 0.5, RECHARGE = 1 / (12 * 6); // turbo : 1,5 s à double vitesse, se recharge en 6 s
const COLORS = ['#22d3ee', '#ff3fa4', '#facc15', '#4ade80', '#a78bfa', '#fb923c', '#f87171', '#e2e8f0'];
const BOT_NAMES = ['Robot Néon', 'Robot Laser', 'Robot Pixel', 'Robot Turbo', 'Robot Voltage', 'Robot Photon', 'Robot Disco'];

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.rng = rng;
    this.clock = clock;
    this.players = []; // { name, connected, bot?, color, points }
    this.spectators = [];
    this.phase = 'lobby'; // lobby | countdown | play | roundEnd | over
    this.round = 0;
    this.roundNo = 0;
    this.settings = { rounds: 5 };
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
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (8 joueurs) : tu peux regarder');
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
    if (!this.players.some(p => !p.bot)) { this.players = []; this.stop(); return; }
    if (this.bikes?.[name]?.alive) { this.crash([name]); this.checkEnd(); }
  }
  hostOnly(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
  }
  addBot(name) {
    this.hostOnly(name);
    if (this.players.length >= MAX_PLAYERS) throw new Error('Le salon est complet');
    this.players.push({ name: BOT_NAMES.find(n => !this.taken(n)), connected: true, bot: true, color: this.freeColor(), points: 0 });
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

  start(name) {
    this.hostOnly(name);
    if (this.players.length < 2) throw new Error('Il faut au moins 2 joueurs (ajoute des robots !)');
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  // Nouvelle manche : grille vide (plus grande s'il y a du monde), motos en cercle tournées vers le centre.
  nextRound() {
    this.roundNo++;
    this.phase = 'countdown';
    this.phaseAt = this.clock();
    const n = this.players.length;
    this.size = Math.min(96, 44 + n * 6);
    this.grid = new Uint8Array(this.size * this.size);
    this.order = [];
    this.tickNo = 0;
    this.bikes = {};
    const order = this.players.map(p => p.name).sort(() => this.rng() - 0.5);
    order.forEach((name, k) => {
      const a = k / n * Math.PI * 2 + Math.PI / 4, c = (this.size - 1) / 2, r = this.size * 0.36;
      const x = Math.round(c + Math.cos(a) * r), y = Math.round(c + Math.sin(a) * r);
      // direction vers le centre, sur l'axe le plus éloigné
      const dx = c - x, dy = c - y, dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      this.bikes[name] = { id: k + 1, x, y, dir, alive: true, queue: [], boost: 0, energy: 1 };
      this.grid[y * this.size + x] = k + 1;
    });
    this.stop();
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  run() {
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  get deadline() {
    if (this.phase === 'countdown') return this.phaseAt + COUNTDOWN_MS;
    if (this.phase === 'roundEnd') return this.phaseAt + ROUND_END_MS;
    if (this.phase === 'play') return this.phaseAt + MAX_ROUND_MS;
    return null;
  }
  timeout() {
    const now = this.clock();
    if (now < this.deadline) return;
    if (this.phase === 'countdown') { this.phase = 'play'; this.phaseAt = now; this.run(); }
    else if (this.phase === 'play') this.endRound();
    else if (this.phase === 'roundEnd') { if (this.roundNo < this.settings.rounds) this.nextRound(); else this.finish(); }
  }

  /* ---- Commandes des joueurs ---- */
  turn(name, d) {
    const b = this.bikes?.[name];
    if (!b?.alive || !Number.isInteger(d) || d < 0 || d > 3 || this.phase === 'lobby' || this.phase === 'over') return;
    const last = b.queue.length ? b.queue.at(-1) : b.dir;
    if (d === last || (d + 2) % 4 === last || b.queue.length >= 3) return; // pas de demi-tour, pas de doublon
    b.queue.push(d);
  }
  boost(name) {
    const b = this.bikes?.[name];
    if (!b?.alive || this.phase !== 'play' || b.boost > 0 || b.energy < BOOST_COST) return;
    b.boost = BOOST_TICKS; b.energy -= BOOST_COST;
  }

  /* ---- Un pas de jeu ---- */
  tick() {
    if (this.phase !== 'play') return this.stop();
    this.tickNo++;
    const S = this.size, live = Object.entries(this.bikes).filter(([, b]) => b.alive);
    for (const [name, b] of live) {
      const p = this.get(name);
      if (p?.bot) this.think(name, b);
      if (b.queue.length) b.dir = b.queue.shift();
      b.steps = b.boost > 0 ? 2 : 1;
      if (b.boost > 0) b.boost--; else b.energy = Math.min(1, b.energy + RECHARGE);
    }
    const dead = new Set();
    for (let sub = 0; sub < 2; sub++) {
      const movers = live.filter(([n, b]) => !dead.has(n) && b.steps > sub);
      const target = new Map();
      for (const [n, b] of movers) {
        const [dx, dy] = DIRS[b.dir], x = b.x + dx, y = b.y + dy;
        if (x < 0 || y < 0 || x >= S || y >= S || this.grid[y * S + x]) { dead.add(n); continue; }
        const k = y * S + x;
        if (target.has(k)) { dead.add(n); dead.add(target.get(k)); } else target.set(k, n); // face à face : les deux
        b.nx = x; b.ny = y;
      }
      for (const [n, b] of movers) if (!dead.has(n)) { b.x = b.nx; b.y = b.ny; this.grid[b.y * S + b.x] = b.id; }
    }
    if (dead.size) this.crash([...dead]);
    this.send?.('snap', { k: this.tickNo, p: Object.entries(this.bikes).map(([n, b]) => [n, b.x, b.y, b.dir, b.alive ? 1 : 0, b.boost > 0 ? 1 : 0, Math.round(b.energy * 100)]), d: [...dead] });
    this.checkEnd();
  }
  // Moto détruite : sa traînée disparaît (ça libère de la place).
  crash(names) {
    for (const n of names) {
      const b = this.bikes[n];
      if (!b || !b.alive) continue;
      b.alive = false;
      for (let k = 0; k < this.grid.length; k++) if (this.grid[k] === b.id) this.grid[k] = 0;
      this.order.push(n);
    }
    this.notify?.();
  }
  checkEnd() {
    if (this.phase !== 'play') return;
    const alive = Object.values(this.bikes).filter(b => b.alive).length;
    if (alive <= 1) this.endRound();
  }
  // Chacun marque autant de points que de motos détruites avant la sienne ; le survivant en marque le plus.
  endRound() {
    if (this.phase !== 'play') return;
    const survivors = Object.entries(this.bikes).filter(([, b]) => b.alive).map(([n]) => n);
    for (const n of survivors) { this.bikes[n].alive = false; this.order.push(n); }
    this.order.forEach((n, k) => { const p = this.get(n); if (p) p.points += k; });
    this.lastWinner = survivors.length === 1 ? survivors[0] : null;
    this.phase = 'roundEnd';
    this.phaseAt = this.clock();
    this.stop();
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

  /* ---- Robots : vont là où il reste le plus de place, et coupent parfois la route ---- */
  think(name, b) {
    const S = this.size, opts = [];
    for (const d of [b.dir, (b.dir + 1) % 4, (b.dir + 3) % 4]) {
      const x = b.x + DIRS[d][0], y = b.y + DIRS[d][1];
      if (x < 0 || y < 0 || x >= S || y >= S || this.grid[y * S + x]) continue;
      let run = 0; // ligne droite libre devant
      for (let k = 1; k < 12; k++) { const xx = b.x + DIRS[d][0] * k, yy = b.y + DIRS[d][1] * k; if (xx < 0 || yy < 0 || xx >= S || yy >= S || this.grid[yy * S + xx]) break; run++; }
      opts.push({ d, room: this.space(x, y, 500), run });
    }
    if (!opts.length) return;
    // le rival le plus proche : on vise un peu devant lui pour lui couper la route
    let foe = null, fd = Infinity;
    for (const o of Object.values(this.bikes)) { if (o === b || !o.alive) continue; const dd = Math.abs(o.x - b.x) + Math.abs(o.y - b.y); if (dd < fd) { fd = dd; foe = o; } }
    for (const o of opts) {
      o.score = Math.min(o.room, 400) + o.run * 2 + (o.d === b.dir ? 3 : 0) + this.rng() * 4;
      if (foe && fd < 18 && o.room > 120) {
        const tx = foe.x + DIRS[foe.dir][0] * 5, ty = foe.y + DIRS[foe.dir][1] * 5;
        const nx = b.x + DIRS[o.d][0], ny = b.y + DIRS[o.d][1];
        o.score += (Math.abs(tx - b.x) + Math.abs(ty - b.y) - Math.abs(tx - nx) - Math.abs(ty - ny)) * 6;
      }
    }
    opts.sort((a, c) => c.score - a.score);
    b.queue = [opts[0].d];
    if (opts[0].run >= 10 && b.energy > 0.9 && this.rng() < 0.05) this.boost(name);
  }
  // Nombre de cases libres accessibles depuis (x, y), plafonné.
  space(x, y, cap) {
    const S = this.size, seen = this.seen ?? (this.seen = new Int32Array(S * S)), stack = [y * S + x];
    if (seen.length !== S * S) { this.seen = new Int32Array(S * S); return this.space(x, y, cap); }
    const stamp = (this.stamp = (this.stamp ?? 0) + 1);
    seen[y * S + x] = stamp;
    let n = 0;
    while (stack.length && n < cap) {
      const k = stack.pop(); n++;
      const cx = k % S, cy = (k - cx) / S;
      for (const [dx, dy] of DIRS) {
        const xx = cx + dx, yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
        const j = yy * S + xx;
        if (this.grid[j] || seen[j] === stamp) continue;
        seen[j] = stamp; stack.push(j);
      }
    }
    return n;
  }

  // Grille complète (compressée) pour un navigateur qui arrive en cours de manche.
  dump() {
    let s = '', run = 0, cur = this.grid[0];
    for (let k = 0; k <= this.grid.length; k++) {
      const v = this.grid[k];
      if (k < this.grid.length && v === cur) { run++; continue; }
      s += `${cur}:${run},`; cur = v; run = 1;
    }
    const ids = Object.fromEntries(Object.entries(this.bikes ?? {}).map(([n, b]) => [b.id, n]));
    return { k: this.tickNo, size: this.size, grid: s, ids };
  }

  summary() { return { rounds: this.settings.rounds }; }
  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, roundNo: this.roundNo, me: name, host: this.host, now: this.clock(),
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      deadline: this.deadline, order: this.order ?? [], lastWinner: this.lastWinner ?? null, ranking: this.phase === 'over' ? this.ranking : null,
      size: this.size ?? 0, tick: this.tickNo ?? 0,
      players: this.players.map(p => ({ name: p.name, connected: p.connected, bot: !!p.bot, color: p.color, points: p.points, wins: this.wins[p.name] ?? 0 })),
      bikes: this.bikes && this.phase !== 'lobby' ? Object.fromEntries(Object.entries(this.bikes).map(([n, b]) => [n, { id: b.id, x: b.x, y: b.y, dir: b.dir, alive: b.alive }])) : null,
    };
  }
}

module.exports = { Room, SETTINGS, MAX_PLAYERS, DIRS };
