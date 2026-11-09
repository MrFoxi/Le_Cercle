// Socle des salons (côté serveur), repris par la classe Room de chaque jeu en ligne branché sur lib/rooms.js.
// BaseRoom : joueurs, spectateurs, créateur du salon. PartyRoom : en plus, couleurs, robots, réglages, points et
// classement de fin de partie (jeux à manches : Chute Libre, Sillage Néon, Prop Hunt, Loup-Garou).
class BaseRoom {
  static MAX_SPECTATORS = 30;
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate; // privé : absent de la liste publique, on n'entre qu'avec le code
    this.rng = rng;
    this.clock = clock;
    this.players = [];
    this.spectators = [];
    this.phase = 'lobby';
    this.round = 0;
  }
  get host() { return this.players.find(p => !p.bot)?.name; } // le premier humain arrivé
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= this.constructor.MAX_SPECTATORS) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }
  spectatorNames() { return this.spectators.filter(s => s.connected).map(s => s.name); }
}

// Chaque jeu à manches déclare : static MAX_PLAYERS, COLORS, BOT_NAMES, SETTINGS (valeurs permises par réglage),
// et sa propre méthode stop() s'il a une minuterie. Il écrit ses règles (start, manches…) par-dessus.
class PartyRoom extends BaseRoom {
  constructor(...args) {
    super(...args);
    this.roundNo = 0; // manche dans la partie en cours
    this.wins = {};
  }
  freeColor() { const used = this.players.map(p => p.color); return this.constructor.COLORS.find(c => !used.includes(c)) ?? this.constructor.COLORS[0]; }
  newPlayer(name, extra) { return { name, connected: true, color: this.freeColor(), points: 0, ...extra }; }
  addPlayer(name) {
    const max = this.constructor.MAX_PLAYERS;
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase !== 'lobby') throw new Error('Partie en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= max) throw new Error(`Ce salon est complet (${max} joueurs) : tu peux regarder`);
    this.players.push(this.newPlayer(name));
  }
  // Un joueur s'en va : plus d'humains, le salon ferme (les robots partent aussi) ; sinon le jeu réagit (left).
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (!this.players.some(p => !p.bot)) { this.players = []; this.stop?.(); return; }
    this.left?.(name);
  }
  hostOnly(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
  }
  addBot(name) {
    this.hostOnly(name);
    if (this.players.length >= this.constructor.MAX_PLAYERS) throw new Error('Le salon est complet');
    this.players.push(this.newPlayer(this.constructor.BOT_NAMES.find(n => !this.taken(n)), { bot: true }));
  }
  removeBot(name, bot) {
    this.hostOnly(name);
    if (!this.get(bot)?.bot) throw new Error('Ce joueur n’est pas un robot');
    this.players = this.players.filter(p => p.name !== bot);
  }
  configure(name, key, value) {
    this.hostOnly(name);
    if (!this.constructor.SETTINGS[key]?.includes(value)) throw new Error('Réglage invalide');
    this.settings[key] = value;
  }
  // Fin de partie : classement aux points, une victoire de plus pour le premier.
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
  // Ce que tout le monde reçoit, quel que soit le jeu ; chaque jeu y ajoute le sien.
  baseView(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, roundNo: this.roundNo, me: name, host: this.host, now: this.clock(),
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectatorNames(),
      deadline: this.deadline, ranking: this.phase === 'over' ? this.ranking : null,
      players: this.players.map(p => ({ name: p.name, connected: p.connected, bot: !!p.bot, color: p.color, points: p.points, wins: this.wins[p.name] ?? 0 })),
    };
  }
}

module.exports = { BaseRoom, PartyRoom };
