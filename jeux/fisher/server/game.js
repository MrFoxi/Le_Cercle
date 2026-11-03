// Little Fisher à plusieurs : un salon = un archipel partagé. Chacun garde sa partie (sauvegardée dans son navigateur) ;
// le salon partage l'heure du jour, la météo, la liste des pêcheurs et l'allure de leur bateau.
const { BaseRoom } = require('../../../lib/room-base');
const SIZES = require('./sizes');

const MAX_FISHERS = 8;
const DAY_MS = 600 * 1000;                                // une journée de jeu : 10 minutes, comme en solo
const WEATHERS = ['clair', 'clair', 'nuageux', 'pluie', 'orage', 'brume'];
const GAP = [110 * 1000, 260 * 1000];                     // durée d'une météo
const MODELS = ['barque', 'voilier', 'chalutier'];
const DEFAULT_BOAT = { model: 'barque', hull: 'auto', flag: 'jaune', name: 'Petit Galet', coque: 0, moteur: 0, lanterne: 0 };
const word = (v, max) => typeof v === 'string' && v.length <= max && /^[\p{L}\p{N} '’-]*$/u.test(v);

// Position : x, z, cap, vitesse, en train de pêcher (0/1)
const validPos = p => Array.isArray(p) && p.length === 5 && p.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(p[0]) < 1500 && Math.abs(p[1]) < 1500 && Math.abs(p[3]) < 60;
// Prise annoncée aux autres : une espèce qui existe et une taille possible
const validCatch = c => !!c && Object.hasOwn(SIZES, c.fish) && Number.isInteger(c.size) && c.size >= SIZES[c.fish][0] && c.size <= SIZES[c.fish][1];

class Room extends BaseRoom {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    super(code, rng, isPrivate, clock);
    this.phase = 'mer';
    this.round = 1;
    this.start = this.clock();
    this.day0 = 0.3;                                       // on commence à 7 h du matin
    this.weather = 'clair';
    this.deadline = this.clock() + this.gap();
  }
  gap() { return GAP[0] + this.rng() * (GAP[1] - GAP[0]); }
  spectator() { return undefined; }
  taken(name) { return !!this.get(name); }
  addSpectator() { throw new Error('Ici, tout le monde pêche : rejoins avec « Rejoindre »'); }
  removeSpectator() {}
  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans cet archipel');
    if (this.players.length >= MAX_FISHERS) throw new Error(`Archipel complet (${MAX_FISHERS} pêcheurs)`);
    this.players.push({ name, connected: true, boat: { ...DEFAULT_BOAT } });
  }
  removePlayer(name) { this.players = this.players.filter(p => p.name !== name); }
  // L'allure de son bateau, pour que les autres le voient comme il est
  setBoat(name, b) {
    const next = { ...DEFAULT_BOAT };
    if (!b || !MODELS.includes(b.model)) throw new Error('Bateau inconnu');
    next.model = b.model;
    for (const k of ['hull', 'flag']) if (word(b[k], 12)) next[k] = b[k];
    if (word(b.name, 18) && b.name.trim()) next.name = b.name.trim();
    for (const [k, max] of [['coque', 2], ['moteur', 3], ['lanterne', 1]]) if (Number.isInteger(b[k]) && b[k] >= 0 && b[k] <= max) next[k] = b[k];
    this.get(name).boat = next;
  }
  // Heure du jour commune (0 à 1)
  timeOfDay(now = this.clock()) { return (this.day0 + (now - this.start) / DAY_MS) % 1; }
  // Appelé par lib/rooms à l'heure de this.deadline : la météo change
  timeout() {
    const now = this.clock();
    let next; do next = WEATHERS[Math.floor(this.rng() * WEATHERS.length)]; while (next === this.weather);
    this.weather = next;
    this.deadline = now + this.gap();
  }
  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, me: name, host: this.host, time: this.clock(),
      start: this.start, day0: this.day0, dayMs: DAY_MS, weather: this.weather,
      players: this.players.map(p => ({ name: p.name, connected: p.connected, boat: { ...p.boat } })),
    };
  }
}

module.exports = { Room, MAX_FISHERS, validPos, validCatch, DEFAULT_BOAT };
