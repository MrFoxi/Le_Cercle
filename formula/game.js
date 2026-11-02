// Salons de Top Formula : réglages (circuit, tours), pilotes prêts / pas prêts, départ synchronisé, arrivées, classement.
// La conduite tourne dans chaque navigateur ; le serveur relaie les positions (server.js) et tient le classement final.
// Testé par test-formula.mjs.
const MAX_PLAYERS = 10;
// Tour le plus rapide plausible par circuit (s) : sous ce temps, une arrivée est refusée. Vérifié contre tracks.js par les tests.
const MIN_LAP = { riviera: 28, lago: 32, marina: 34 };
const SETTINGS = { track: Object.keys(MIN_LAP), laps: [1, 2, 3, 5, 8, 10] };
const LIGHTS_MS = 6000; // 5 feux + 1 s avant l'extinction (comme côté navigateur)
const END_AFTER_FIRST_MS = 45000; // après la première arrivée, les autres ont 45 s pour finir
const MAX_RACE_MS = 20 * 60 * 1000;
const COLOR = /^#[0-9a-f]{6}$/i;
const MOTIFS = ['plain', 'stripe', 'arrow', 'split'];
const PALETTE = ['#e10600', '#2d7dff', '#ff8700', '#2fd47a', '#ffd400', '#a46bff', '#00d2be', '#f596c8', '#ffffff', '#1b1b1b'];

function validLook(l = {}) {
  const c = (v, d) => (typeof v === 'string' && COLOR.test(v) ? v : d);
  return { color: c(l.color, '#e10600'), accent: c(l.accent, '#ffffff'), helmet: c(l.helmet, '#ffd400'), rim: c(l.rim, '#c9ccd2'), motif: MOTIFS.includes(l.motif) ? l.motif : 'stripe', number: Math.max(1, Math.min(99, Math.round(Number(l.number)) || 7)) };
}

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.rng = rng;
    this.clock = clock;
    this.players = []; // { name, connected, look, ready }
    this.spectators = [];
    this.phase = 'lobby'; // lobby | race | results
    this.round = 0;
    this.settings = { track: 'riviera', laps: 3 };
    this.wins = {};
    this.arrivals = {};
  }
  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase === 'race') throw new Error('Course en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (10 pilotes) : tu peux regarder la course');
    this.players.push({ name, connected: true, look: validLook(), ready: false });
    this.setLook(name, {});
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (this.phase === 'race') this.checkEnd();
  }

  configure(name, key, value) {
    if (name !== this.host) throw new Error('Seul le créateur du salon choisit le circuit');
    if (this.phase === 'race') throw new Error('La course est en cours');
    if (!SETTINGS[key]?.includes(value)) throw new Error('Réglage invalide');
    this.settings[key] = value;
  }
  // Livrée choisie au garage ; si sa couleur est déjà prise dans le salon, on lui en donne une libre.
  setLook(name, look) {
    const l = validLook(look), used = this.players.filter(p => p.name !== name).map(p => p.look.color);
    if (used.includes(l.color)) l.color = PALETTE.find(c => !used.includes(c) && c !== l.accent) ?? l.color;
    this.get(name).look = l;
  }
  ready(name, on) {
    if (this.phase === 'race') throw new Error('La course est en cours');
    this.get(name).ready = !!on;
  }

  start(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon lance la course');
    if (this.phase === 'race') throw new Error('La course est déjà lancée');
    const waiting = this.players.filter(p => p.name !== this.host && (!p.ready || !p.connected));
    if (waiting.length) throw new Error(`Pas encore prêt : ${waiting.map(p => p.name).join(', ')}`);
    this.round++;
    this.phase = 'race';
    this.startAt = this.clock() + LIGHTS_MS;
    // Grille tirée au sort, sauf le vainqueur de la course précédente qui part dernier.
    const names = this.players.map(p => p.name);
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const last = this.results?.[0]?.name;
    if (last && names.includes(last) && names.length > 1) names.push(names.splice(names.indexOf(last), 1)[0]);
    this.grid = names;
    this.progress = {}; // pseudo -> distance parcourue (m), d'après ses positions
    this.arrivals = {}; // pseudo -> { ms, best }
    this.firstAt = null;
    this.results = null;
  }
  // Appelé par server.js à chaque position reçue (ce n'est pas une action).
  track(name, s) { if (this.phase === 'race' && Number.isFinite(s)) this.progress[name] = s; }

  // Arrivée d'un pilote : temps de course et meilleur tour en millisecondes, refusés s'ils sont impossibles.
  finish(name, ms, best) {
    if (this.phase !== 'race' || !this.grid.includes(name)) throw new Error('Pas de course en cours');
    if (this.arrivals[name]) throw new Error('Arrivée déjà enregistrée');
    const min = MIN_LAP[this.settings.track] * 1000;
    if (!Number.isInteger(ms) || ms < min * this.settings.laps || ms > MAX_RACE_MS) throw new Error('Temps invalide');
    if (!Number.isInteger(best) || best < min || best > ms) throw new Error('Meilleur tour invalide');
    if (this.clock() < this.startAt + ms - 5000) throw new Error('Temps invalide'); // on ne finit pas avant d'avoir roulé
    this.arrivals[name] = { ms, best };
    this.firstAt ??= this.clock();
    this.checkEnd();
  }
  get deadline() {
    if (this.phase !== 'race') return null;
    return this.firstAt ? this.firstAt + END_AFTER_FIRST_MS : this.startAt + MAX_RACE_MS;
  }
  timeout() { if (this.phase === 'race' && this.clock() >= this.deadline) this.end(); }
  checkEnd() {
    const racing = this.players.filter(p => p.connected && this.grid.includes(p.name));
    if (racing.every(p => this.arrivals[p.name])) this.end();
  }
  end() {
    const rank = (a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity) || (this.progress[b.name] ?? 0) - (this.progress[a.name] ?? 0);
    this.results = this.grid.map(name => ({ name, ms: this.arrivals[name]?.ms ?? null, best: this.arrivals[name]?.best ?? null })).sort(rank);
    if (this.results[0]?.ms != null) this.wins[this.results[0].name] = (this.wins[this.results[0].name] ?? 0) + 1;
    this.phase = 'results';
    for (const p of this.players) p.ready = false;
  }

  summary() { return { track: this.settings.track }; }
  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host, now: this.clock(),
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      players: this.players.map(p => ({ name: p.name, connected: p.connected, look: p.look, ready: p.ready, wins: this.wins[p.name] ?? 0, finished: !!this.arrivals[p.name] })),
      ...(this.phase !== 'lobby' && { grid: this.grid, startAt: this.startAt, results: this.results }),
    };
  }
}

module.exports = { Room, MIN_LAP, SETTINGS, validLook, MAX_PLAYERS };
