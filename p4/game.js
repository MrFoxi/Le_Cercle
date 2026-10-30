// Règles du Puissance 4 pour un salon de 2 joueurs (+ spectateurs). Aucune notion de réseau : testé par test-p4.js.
const COLS = 7, ROWS = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontale, verticale, diagonale descendante, diagonale montante

// Cases alignées avec (row, col) pour cette couleur, dans les 4 directions ; renvoie l'alignement gagnant ou null.
function winningLine(board, row, col) {
  const color = board[row][col];
  for (const [dr, dc] of DIRS) {
    const line = [[row, col]];
    for (const s of [1, -1]) {
      let r = row + dr * s, c = col + dc * s;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
        line.push([r, c]);
        r += dr * s;
        c += dc * s;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

class Room {
  constructor(code, rng = Math.random, isPrivate = false) {
    this.code = code;
    this.private = isPrivate;
    this.players = []; // [{ name, connected }] ; le premier est le créateur du salon
    this.spectators = [];
    this.phase = 'lobby'; // lobby | playing | over
    this.round = 0; // numéro de la manche dans ce salon
    this.board = null; // board[ligne][colonne], ligne 0 en haut : null | 'red' | 'yellow'
    this.moves = [];
    this.turn = null; // pseudo du joueur qui doit jouer
    this.colors = {}; // pseudo -> 'red' | 'yellow'
    this.winner = null;
    this.line = null;
    this.rematch = null; // pseudo de celui qui propose de recommencer
    this.stats = { wins: {}, draws: 0, games: 0 };
    this.notice = null;
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  other(name) { return this.players.find(p => p.name !== name)?.name; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.players.length >= 2) throw new Error('Ce salon est déjà complet : tu peux regarder la partie');
    this.players.push({ name, connected: true });
    this.stats.wins[name] ??= 0;
  }

  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }

  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  // Départ définitif d'un joueur : la manche s'arrête, le joueur restant devient créateur.
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    delete this.stats.wins[name];
    this.rematch = null;
    if (this.phase !== 'lobby') {
      this.phase = 'lobby';
      this.notice = `${name} a quitté la partie`;
    }
  }

  start(name) {
    if (this.phase !== 'lobby') throw new Error('La partie est déjà lancée');
    if (name !== this.host) throw new Error('Seul le créateur du salon peut lancer la partie');
    if (this.players.length < 2 || this.players.some(p => !p.connected)) throw new Error('Il faut deux joueurs connectés');
    this.newGame();
  }

  // Nouvelle manche : grille vide, couleurs inversées à chaque manche, le rouge commence.
  newGame() {
    this.round++;
    const [a, b] = this.players.map(p => p.name);
    const redFirst = this.round % 2 === 1;
    this.colors = { [a]: redFirst ? 'red' : 'yellow', [b]: redFirst ? 'yellow' : 'red' };
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.moves = [];
    this.turn = redFirst ? a : b;
    this.winner = this.line = this.rematch = this.notice = null;
    this.phase = 'playing';
  }

  // moveNo : numéro du coup attendu ; un clic envoyé deux fois ou en retard est refusé.
  play(name, col, moveNo) {
    if (this.phase !== 'playing') throw new Error('La partie n’est pas en cours');
    if (moveNo !== this.moves.length) throw new Error('Coup déjà joué');
    if (name !== this.turn) throw new Error('Ce n’est pas ton tour');
    if (!Number.isInteger(col) || col < 0 || col >= COLS) throw new Error('Colonne invalide');
    let row = ROWS - 1;
    while (row >= 0 && this.board[row][col]) row--; // le jeton tombe sur la case libre la plus basse
    if (row < 0) throw new Error('Cette colonne est pleine');
    const color = this.colors[name];
    this.board[row][col] = color;
    this.moves.push({ row, col, color, name });
    this.rematch = null; // une proposition de recommencer en cours de partie tombe dès qu'on joue
    const line = winningLine(this.board, row, col);
    if (line) return this.finish(name, line);
    if (this.moves.length === ROWS * COLS) return this.finish(null, null); // grille pleine : match nul
    this.turn = this.other(name);
  }

  finish(winner, line) {
    this.phase = 'over';
    this.turn = null;
    this.winner = winner;
    this.line = line;
    this.stats.games++;
    if (winner) this.stats.wins[winner]++;
    else this.stats.draws++;
  }

  // Revanche (ou recommencer en cours de partie) : l'un propose, l'autre accepte ou refuse.
  requestRematch(name) {
    if (this.phase === 'lobby') throw new Error('Aucune partie à recommencer');
    if (this.players.length < 2) throw new Error('Ton adversaire est parti');
    if (this.rematch && this.rematch !== name) return this.newGame(); // l'autre avait déjà proposé : c'est accepté
    this.rematch = name;
    this.notice = null;
  }

  declineRematch(name) {
    if (!this.rematch || this.rematch === name) throw new Error('Aucune proposition à refuser');
    this.rematch = null;
    this.notice = `${name} a refusé de recommencer`;
  }

  toLobby() { // appelée avec le pseudo du joueur, inutile ici
    if (this.phase !== 'over') throw new Error('Termine d’abord la partie');
    this.phase = 'lobby';
    this.rematch = null;
  }

  viewFor(name) {
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host,
      players: this.players.map(p => ({ ...p, color: this.colors[p.name] ?? null, wins: this.stats.wins[p.name] ?? 0 })),
      board: this.board, moves: this.moves.length, last: this.moves.at(-1) ?? null, turn: this.turn,
      winner: this.winner, line: this.line, rematch: this.rematch, notice: this.notice,
      draws: this.stats.draws, games: this.stats.games,
      spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
    };
  }
}

module.exports = { Room, winningLine, COLS, ROWS };
