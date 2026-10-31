// Règles de la Bataille navale « Modern Warfare » pour un salon de 2 joueurs (+ spectateurs). Aucune notion de réseau : testé par test-bataille.js.
// Le serveur garde les flottes : chaque joueur ne reçoit que ce que ses tirs et ses capteurs lui ont appris.
const SHIPS = {
  porteavions: { name: 'Porte-avions', size: 5 },
  cuirasse: { name: 'Cuirassé', size: 4 },
  destroyer: { name: 'Destroyer', size: 3 },
  sousmarin: { name: 'Sous-marin', size: 3 },
  patrouilleur: { name: 'Patrouilleur', size: 2 },
};
const FULL = ['porteavions', 'cuirasse', 'destroyer', 'sousmarin', 'patrouilleur'];
const MODES = {
  classique: { name: 'Classique', size: 10, fleet: FULL, abilities: false, desc: 'La bataille navale traditionnelle : grille 10 × 10, 5 navires, uniquement des tirs.' },
  moderne: { name: 'Moderne', size: 10, fleet: FULL, abilities: true, desc: 'Grille 10 × 10, 5 navires, plus radar, drone, sonar, frappe de missiles et brouillage.' },
  rapide: { name: 'Bataille rapide', size: 8, fleet: ['cuirasse', 'destroyer', 'patrouilleur'], abilities: false, desc: 'Grille 8 × 8 et 3 navires : une partie en quelques minutes.' },
};
// Capacités du mode Moderne : nombre d'utilisations, et disponibles seulement après « from » actions de son camp.
// Utiliser une capacité remplace le tir du tour.
const ABILITIES = {
  drone: { name: 'Drone de reconnaissance', charges: 2, from: 2, desc: 'Survole une case : indique si elle cache un navire. Aucun dégât.' },
  radar: { name: 'Radar', charges: 2, from: 3, desc: 'Balaye une zone de 3 × 3 : indique si au moins un navire s’y trouve, sans dire où.' },
  sonar: { name: 'Sonar', charges: 1, from: 4, desc: 'Écoute une zone de 5 × 5 : indique si le sous-marin ennemi s’y cache.' },
  jam: { name: 'Brouillage', charges: 1, from: 4, turns: 2, desc: 'Brouille les capteurs ennemis : ni radar, ni sonar, ni drone pendant ses 2 prochains tours.' },
  missiles: { name: 'Frappe de missiles', charges: 1, from: 6, desc: 'Trois missiles sur trois cases alignées : chaque case est touchée ou non, indépendamment.' },
};
const SENSORS = ['drone', 'radar', 'sonar']; // ce que le brouillage empêche

const key = (r, c) => `${r},${c}`;
const zone = (r, c, d, n) => {
  const cells = [];
  for (let i = r - d; i <= r + d; i++) for (let j = c - d; j <= c + d; j++) if (i >= 0 && j >= 0 && i < n && j < n) cells.push([i, j]);
  return cells;
};
const shipCells = (s, size) => Array.from({ length: size }, (_, i) => (s.dir === 'v' ? [s.r + i, s.c] : [s.r, s.c + i]));

class Room {
  constructor(code, rng = Math.random, isPrivate = false) {
    this.code = code;
    this.rng = rng;
    this.private = isPrivate;
    this.players = []; // [{ name, connected }] ; le premier est l'hôte
    this.spectators = [];
    this.phase = 'lobby'; // lobby | setup | battle | over
    this.round = 0;
    this.mode = 'moderne';
    this.sides = {}; // pseudo -> flotte, tirs reçus, compteurs
    this.turn = null;
    this.history = []; // toutes les actions de la partie, dans l'ordre (publiques : chaque joueur connaît sa propre flotte)
    this.winner = null;
    this.rematch = null;
    this.stats = { wins: {}, games: 0 };
    this.notice = null;
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  other(name) { return this.players.find(p => p.name !== name)?.name; }
  get rules() { return MODES[this.mode]; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.players.length >= 2) throw new Error('Ce salon est complet : tu peux regarder la bataille');
    this.players.push({ name, connected: true });
    this.stats.wins[name] ??= 0;
  }

  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }

  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    delete this.stats.wins[name];
    this.rematch = null;
    if (this.phase !== 'lobby') {
      this.phase = 'lobby';
      this.notice = `${name} a quitté la bataille`;
    }
  }

  setMode(name, mode) {
    if (name !== this.host) throw new Error('Seul l’hôte choisit le mode');
    if (this.phase !== 'lobby') throw new Error('La bataille est déjà lancée');
    if (!MODES[mode]) throw new Error('Mode inconnu');
    this.mode = mode;
  }

  start(name) {
    if (name !== this.host) throw new Error('Seul l’hôte peut lancer la bataille');
    if (this.phase !== 'lobby') throw new Error('La bataille est déjà lancée');
    if (this.players.length < 2 || this.players.some(p => !p.connected)) throw new Error('Il faut deux joueurs connectés');
    this.newGame();
  }

  // Nouvelle bataille : flottes à placer, chacun de son côté en même temps.
  newGame() {
    this.round++;
    this.sides = {};
    for (const p of this.players) {
      this.sides[p.name] = { ships: null, received: {}, actions: 0, shots: 0, hits: 0, jammed: 0, charges: Object.fromEntries(Object.entries(ABILITIES).map(([k, a]) => [k, a.charges])) };
    }
    this.history = [];
    this.turn = this.winner = this.rematch = this.notice = null;
    this.phase = 'setup';
  }

  // Flotte : [{ id, r, c, dir: 'h' | 'v' }], un navire par type de la flotte du mode, sans chevauchement ni débordement.
  placeFleet(name, layout) {
    if (this.phase !== 'setup') throw new Error('Ce n’est pas le moment de placer la flotte');
    const side = this.sides[name];
    if (side.ships) throw new Error('Ta flotte est déjà validée');
    const { size, fleet } = this.rules;
    if (!Array.isArray(layout) || layout.length !== fleet.length) throw new Error('Place tous tes navires');
    const used = new Set(), ships = [];
    for (const s of layout) {
      if (!fleet.includes(s?.id) || ships.some(x => x.id === s.id)) throw new Error('Flotte invalide');
      if (!Number.isInteger(s.r) || !Number.isInteger(s.c) || !['h', 'v'].includes(s.dir)) throw new Error('Position invalide');
      const cells = shipCells(s, SHIPS[s.id].size);
      for (const [r, c] of cells) {
        if (r < 0 || c < 0 || r >= size || c >= size) throw new Error(`${SHIPS[s.id].name} sort de la grille`);
        if (used.has(key(r, c))) throw new Error('Deux navires se chevauchent');
        used.add(key(r, c));
      }
      ships.push({ id: s.id, r: s.r, c: s.c, dir: s.dir, cells, hits: [] });
    }
    side.ships = ships;
    if (this.players.every(p => this.sides[p.name].ships)) {
      this.phase = 'battle';
      this.turn = this.players[(this.round + 1) % 2].name; // on alterne qui ouvre le feu
    }
  }

  // Vérifs communes aux actions de bataille ; moveNo évite qu'un clic envoyé deux fois joue deux tours.
  act(name, moveNo) {
    if (this.phase !== 'battle') throw new Error('La bataille n’est pas en cours');
    if (moveNo !== this.history.length) throw new Error('Action déjà jouée');
    if (name !== this.turn) throw new Error('Ce n’est pas ton tour');
    return { me: this.sides[name], foe: this.sides[this.other(name)] };
  }

  cell(r, c) {
    const n = this.rules.size;
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= n || c >= n) throw new Error('Case hors de la grille');
  }

  // Un tir sur une case : à l'eau, touché ou coulé.
  shoot(me, foe, r, c) {
    const ship = foe.ships.find(s => s.cells.some(([i, j]) => i === r && j === c));
    me.shots++;
    if (!ship) {
      foe.received[key(r, c)] = 'miss';
      return { r, c, res: 'miss' };
    }
    foe.received[key(r, c)] = 'hit';
    ship.hits.push([r, c]);
    me.hits++;
    if (ship.hits.length < ship.cells.length) return { r, c, res: 'hit' };
    return { r, c, res: 'sunk', ship: ship.id, cells: ship.cells };
  }

  fire(name, r, c, moveNo) {
    const { me, foe } = this.act(name, moveNo);
    this.cell(r, c);
    if (foe.received[key(r, c)]) throw new Error('Tu as déjà tiré sur cette case');
    this.end(name, { kind: 'fire', results: [this.shoot(me, foe, r, c)] });
  }

  // Capacités spéciales (mode Moderne). target : { r, c, dir } selon la capacité.
  ability(name, type, target = {}, moveNo) {
    const { me, foe } = this.act(name, moveNo);
    const a = ABILITIES[type];
    if (!this.rules.abilities || !a) throw new Error('Capacité indisponible dans ce mode');
    if (!me.charges[type]) throw new Error(`${a.name} : plus aucune utilisation`);
    if (me.actions < a.from) throw new Error(`${a.name} disponible après ton ${a.from}ᵉ tour`);
    if (SENSORS.includes(type) && me.jammed) throw new Error('Tes capteurs sont brouillés !');
    const n = this.rules.size, { r, c } = target;
    let entry;
    if (type === 'jam') {
      foe.jammed = a.turns;
      entry = { kind: 'jam' };
    } else {
      this.cell(r, c);
      const occupied = ([i, j]) => foe.ships.some(s => s.cells.some(([x, y]) => x === i && y === j));
      if (type === 'drone') entry = { kind: 'drone', cells: [[r, c]], found: occupied([r, c]) };
      if (type === 'radar') {
        const cells = zone(r, c, 1, n);
        entry = { kind: 'radar', cells, found: cells.some(occupied) };
      }
      if (type === 'sonar') {
        const cells = zone(r, c, 2, n), sub = foe.ships.find(s => s.id === 'sousmarin');
        entry = { kind: 'sonar', cells, found: !!sub && cells.some(([i, j]) => sub.cells.some(([x, y]) => x === i && y === j)) };
      }
      if (type === 'missiles') {
        const dir = target.dir === 'v' ? 'v' : 'h';
        const cells = shipCells({ r, c, dir }, 3);
        if (cells.some(([i, j]) => i >= n || j >= n)) throw new Error('Les trois cases doivent être dans la grille');
        const fresh = cells.filter(([i, j]) => !foe.received[key(i, j)]);
        if (!fresh.length) throw new Error('Ces trois cases ont déjà été visées');
        entry = { kind: 'missiles', cells, results: fresh.map(([i, j]) => this.shoot(me, foe, i, j)) };
      }
    }
    me.charges[type]--;
    this.end(name, entry);
  }

  end(name, entry) {
    const me = this.sides[name];
    this.history.push({ n: this.history.length + 1, by: name, ...entry });
    me.actions++;
    if (me.jammed && entry.kind !== 'jam') me.jammed--; // le brouillage dure un nombre de tours du camp brouillé
    if (this.sides[this.other(name)].ships.every(s => s.hits.length === s.cells.length)) return this.finish(name);
    this.turn = this.other(name);
  }

  finish(winner) {
    this.phase = 'over';
    this.turn = null;
    this.winner = winner;
    this.stats.games++;
    this.stats.wins[winner]++;
  }

  // Revanche : l'un propose, l'autre accepte (ou refuse) ; nouvelle bataille, nouvelles flottes, même mode.
  requestRematch(name) {
    if (this.phase !== 'over') throw new Error('La bataille n’est pas finie');
    if (this.players.length < 2) throw new Error('Ton adversaire est parti');
    if (this.rematch && this.rematch !== name) return this.newGame();
    this.rematch = name;
    this.notice = null;
  }

  declineRematch(name) {
    if (!this.rematch || this.rematch === name) throw new Error('Aucune proposition à refuser');
    this.rematch = null;
    this.notice = `${name} a refusé la revanche`;
  }

  toLobby() {
    if (this.phase !== 'over') throw new Error('Termine d’abord la bataille');
    this.phase = 'lobby';
    this.rematch = null;
  }

  // Ce qu'un joueur voit d'une grille : toute sa flotte chez lui ; chez l'ennemi, seulement ses tirs et les navires coulés.
  board(owner, viewer) {
    const s = this.sides[owner];
    if (!s) return null;
    const sunk = (s.ships ?? []).filter(x => x.hits.length === x.cells.length);
    const reveal = owner === viewer || this.phase === 'over';
    const sunkCells = new Set(sunk.flatMap(x => x.cells.map(([r, c]) => key(r, c))));
    return {
      ready: !!s.ships,
      ships: (reveal ? s.ships ?? [] : sunk).map(x => ({ id: x.id, r: x.r, c: x.c, dir: x.dir, hits: x.hits.length, sunk: x.hits.length === x.cells.length })),
      marks: Object.entries(s.received).map(([k, v]) => [...k.split(',').map(Number), sunkCells.has(k) ? 'sunk' : v]),
      fleet: this.rules.fleet.map(id => ({ id, sunk: sunk.some(x => x.id === id) })), // état public de la flotte : on sait ce qui est coulé
      shots: s.shots, hits: s.hits, actions: s.actions, jammed: s.jammed,
      charges: this.rules.abilities ? s.charges : null,
    };
  }

  viewFor(name) {
    const isPlayer = !!this.get(name);
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host, notice: this.notice,
      mode: this.mode, rules: this.rules, modes: MODES, ships: SHIPS, abilities: ABILITIES,
      players: this.players.map(p => ({ ...p, wins: this.stats.wins[p.name] ?? 0 })), games: this.stats.games,
      spectator: !isPlayer, spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      turn: this.turn, moves: this.history.length, history: this.history, winner: this.winner, rematch: this.rematch,
      boards: Object.fromEntries(this.players.map(p => [p.name, this.board(p.name, isPlayer ? name : null)])),
    };
  }
}

module.exports = { Room, SHIPS, MODES, ABILITIES };
