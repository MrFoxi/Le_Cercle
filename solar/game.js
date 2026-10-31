// Solar Explorer : un salon = un univers partagé, ouvert, sans manche ni fin.
// Le salon ne connaît que les pilotes et leur vaisseau ; les positions passent par un canal rapide à part (voir server.js).
const MODELS = ['eclaireur', 'intercepteur', 'cargo'];
const COLORS = ['#36d7ff', '#ff5c8a', '#ffb340', '#7cff6b', '#b07cff', '#ff6b3d', '#f5f7fa', '#2f6bff'];
const MAX_PILOTS = 16;

// Position envoyée par un pilote : x, y, z, quaternion (4), vitesse, boost (0/1).
const validPos = p => Array.isArray(p) && p.length === 9 && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7);

class Room {
  constructor(code, rng = Math.random, isPrivate = false) {
    this.code = code;
    this.rng = rng;
    this.private = isPrivate;
    this.players = []; // [{ name, connected, ship: { model, color } }] ; le premier est l'hôte
    this.spectators = [];
    this.phase = 'space';
    this.round = 1;
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator() { return undefined; }
  taken(name) { return !!this.get(name); }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans cet univers');
    if (this.players.length >= MAX_PILOTS) throw new Error(`Univers complet (${MAX_PILOTS} pilotes)`);
    // Couleur par défaut : la première pas encore prise, pour se reconnaître tout de suite.
    const color = COLORS.find(c => !this.players.some(p => p.ship.color === c)) ?? COLORS[0];
    this.players.push({ name, connected: true, ship: { model: 'eclaireur', color } });
  }

  addSpectator() { throw new Error('Ici, tout le monde pilote : rejoins avec « Jouer »'); }
  removeSpectator() {}
  removePlayer(name) { this.players = this.players.filter(p => p.name !== name); }

  setShip(name, ship) {
    if (!MODELS.includes(ship?.model) || !COLORS.includes(ship?.color)) throw new Error('Vaisseau inconnu');
    this.get(name).ship = { model: ship.model, color: ship.color };
  }

  viewFor(name) {
    return { code: this.code, private: this.private, phase: this.phase, me: name, host: this.host, players: this.players.map(p => ({ ...p, ship: { ...p.ship } })) };
  }
}

module.exports = { Room, MODELS, COLORS, MAX_PILOTS, validPos };
