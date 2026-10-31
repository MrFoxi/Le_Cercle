// Solar Explorer : un salon = un univers partagé, ouvert, sans manche ni fin.
// Le salon connaît les pilotes, leur vaisseau, l'heure commune (orbites) et les événements en direct.
// Les positions, pings et émotes passent par un canal rapide à part (voir server.js).

// Éléments de personnalisation acceptés (les déblocages sont gérés dans le navigateur : c'est purement esthétique).
const CATALOG = {
  model: ['eclaireur', 'intercepteur', 'cargo', 'chasseur', 'course', 'soucoupe', 'navette'],
  color: ['#36d7ff', '#ff5c8a', '#ffb340', '#7cff6b', '#b07cff', '#ff6b3d', '#f5f7fa', '#2f6bff'],
  paint: ['uni', 'bandes', 'metal', 'damier', 'flammes', 'camo', 'chrome'],
  trail: ['standard', 'fumee', 'flammes', 'etincelles', 'arcenciel', 'glitch'],
  boost: ['standard', 'plasma', 'onde', 'eclair'],
  title: ['pilote', 'icare', 'rouge', 'as-kepler', 'jovien', 'explorateur-saturne', 'confins', 'chasseur-comete', 'cartographe'],
};
const MODELS = CATALOG.model, COLORS = CATALOG.color;
const DEFAULT_SHIP = { model: 'eclaireur', paint: 'uni', trail: 'standard', boost: 'standard', title: 'pilote' };
const MAX_PILOTS = 16;
const EMOTES = ['feux', 'artifice', 'warp'];

// Événements en direct, choisis par le serveur pour que tous les pilotes vivent les mêmes.
const EVENT_TARGETS = ['terre', 'lune', 'mars', 'venus', 'jupiter', 'saturne'];
const MIN = 60 * 1000;
const EVENTS = {
  meteors: { active: 90 * 1000 },
  comet: { active: 150 * 1000 },
  storm: { warning: 2 * MIN, active: 60 * 1000 },
};
// calme entre deux événements (SOLAR_FAST_EVENTS=1 : quelques secondes, pour tester)
const GAP = process.env.SOLAR_FAST_EVENTS ? [5000, 6000] : [4 * MIN, 8 * MIN];

// Position : x, y, z, quaternion (4), vitesse, boost (0/1).
const validPos = p => Array.isArray(p) && p.length === 9 && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7);
// Ping : un point relatif à un astre (ou absolu si host est vide).
const validPing = p => !!p && typeof p.host === 'string' && /^[a-z]{0,16}$/.test(p.host) && Array.isArray(p.at) && p.at.length === 3
  && p.at.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7);

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.rng = rng;
    this.clock = clock;
    this.private = isPrivate;
    this.players = []; // [{ name, connected, ship }] ; le premier est l'hôte
    this.spectators = [];
    this.phase = 'space';
    this.round = 1;
    this.event = null; // { type, phase: 'warning' | 'active', start, end, target, seed }
    this.deadline = this.clock() + this.gap();
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator() { return undefined; }
  taken(name) { return !!this.get(name); }
  gap() { return GAP[0] + this.rng() * (GAP[1] - GAP[0]); }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans cet univers');
    if (this.players.length >= MAX_PILOTS) throw new Error(`Univers complet (${MAX_PILOTS} pilotes)`);
    // Couleur par défaut : la première pas encore prise, pour se reconnaître tout de suite.
    const color = COLORS.find(c => !this.players.some(p => p.ship.color === c)) ?? COLORS[0];
    this.players.push({ name, connected: true, ship: { ...DEFAULT_SHIP, color } });
  }

  addSpectator() { throw new Error('Ici, tout le monde pilote : rejoins avec « Rejoindre »'); }
  removeSpectator() {}
  removePlayer(name) { this.players = this.players.filter(p => p.name !== name); }

  setShip(name, ship) {
    const next = {};
    for (const k of Object.keys(CATALOG)) {
      const v = ship?.[k] ?? (k === 'color' ? undefined : DEFAULT_SHIP[k]);
      if (!CATALOG[k].includes(v)) throw new Error('Vaisseau inconnu');
      next[k] = v;
    }
    this.get(name).ship = next;
  }

  // Appelé par lib/rooms à l'heure de this.deadline : l'événement avance d'une étape.
  timeout() {
    const now = this.clock(), ev = this.event;
    if (ev?.phase === 'warning') {
      Object.assign(ev, { phase: 'active', start: now, end: now + EVENTS[ev.type].active });
    } else if (ev) {
      this.event = null;
    } else {
      const types = Object.keys(EVENTS), type = types[Math.floor(this.rng() * types.length)], rules = EVENTS[type];
      const first = rules.warning ? 'warning' : 'active';
      this.event = {
        type, phase: first, start: now, end: now + (rules.warning ?? rules.active),
        target: EVENT_TARGETS[Math.floor(this.rng() * EVENT_TARGETS.length)], seed: Math.floor(this.rng() * 1e9),
      };
    }
    this.deadline = this.event ? this.event.end : now + this.gap();
  }

  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, me: name, host: this.host, time: this.clock(),
      event: this.event && { ...this.event }, players: this.players.map(p => ({ ...p, ship: { ...p.ship } })),
    };
  }
}

module.exports = { Room, CATALOG, MODELS, COLORS, MAX_PILOTS, EMOTES, EVENTS, validPos, validPing };
