// Règles du Surcoté / Sous-coté pour un salon de 2 joueurs. Aucune notion de réseau : testé par test-cote.js.
const SUBJECTS = require('./subjects');

const ROUNDS = 10, MAX_CLUE = 140;

// Barème : plus la réponse est proche de la position secrète, plus elle rapporte.
function pointsFor(diff) {
  if (diff <= 5) return 5;
  if (diff <= 10) return 4;
  if (diff <= 20) return 3;
  if (diff <= 30) return 2;
  if (diff <= 40) return 1;
  return 0;
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Room {
  constructor(code, rng = Math.random) {
    this.code = code;
    this.rng = rng;
    this.players = []; // [{ name, score, connected }] ; le premier est le créateur du salon
    this.phase = 'lobby'; // lobby | clue | guess | reveal | over
    this.round = 0;
    this.current = null; // { subject, category, target, clue, guess, diff, points, giver, guesser }
    this.history = [];
    this.notice = null; // dernier événement à afficher (départ d'un joueur…)
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }

  addPlayer(name) {
    if (this.get(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.players.length >= 2) throw new Error('Ce salon est déjà complet');
    this.players.push({ name, score: 0, connected: true });
  }

  // Départ définitif : la partie en cours s'arrête, le joueur restant devient créateur.
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (this.phase !== 'lobby') {
      this.phase = 'lobby';
      this.current = null;
      this.notice = `${name} a quitté la partie`;
    }
  }

  start(name) {
    if (!['lobby', 'over'].includes(this.phase)) throw new Error('La partie est déjà en cours');
    if (this.players.length < 2 || this.players.some(p => !p.connected)) throw new Error('Il faut deux joueurs connectés');
    if (this.phase === 'lobby' && name !== this.host) throw new Error('Seul le créateur du salon peut lancer la partie');
    for (const p of this.players) p.score = 0;
    this.deck = shuffle(SUBJECTS, this.rng); // pas de sujet en double dans une partie
    this.round = 0;
    this.history = [];
    this.notice = null;
    this.nextRound();
  }

  nextRound() {
    if (this.round >= ROUNDS) {
      this.phase = 'over';
      this.current = null;
      return;
    }
    this.round++;
    // Les rôles s'inversent à chaque manche : le créateur donne l'indice aux manches impaires.
    const giver = this.players[(this.round - 1) % 2].name, guesser = this.players[this.round % 2].name;
    const { text, category } = this.deck.pop();
    this.current = { subject: text, category, target: Math.floor(this.rng() * 101), clue: null, guess: null, diff: null, points: null, giver, guesser };
    this.phase = 'clue';
  }

  // Chaque action porte le numéro de manche : un clic envoyé deux fois ou en retard est refusé.
  check(round, phase, name, role) {
    if (round !== this.round || this.phase !== phase) throw new Error('Action déjà prise en compte');
    if (this.current[role] !== name) throw new Error('Ce n’est pas à toi de jouer');
  }

  giveClue(name, round, text) {
    this.check(round, 'clue', name, 'giver');
    const clue = String(text ?? '').trim().replace(/\s+/g, ' ');
    if (!clue) throw new Error('Écris un indice');
    if (clue.length > MAX_CLUE) throw new Error(`L’indice fait au maximum ${MAX_CLUE} caractères`);
    this.current.clue = clue;
    this.phase = 'guess';
  }

  guess(name, round, value) {
    this.check(round, 'guess', name, 'guesser');
    const v = Math.round(Number(value));
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error('Réponse invalide');
    const c = this.current;
    c.guess = v;
    c.diff = Math.abs(v - c.target);
    c.points = pointsFor(c.diff);
    this.get(name).score += c.points; // les points vont au devineur
    this.history.push({ ...c, round: this.round });
    this.phase = 'reveal';
  }

  next(round) {
    if (round !== this.round || this.phase !== 'reveal') throw new Error('Action déjà prise en compte');
    this.nextRound();
  }

  // État envoyé à un joueur : la position secrète n'est jamais transmise au devineur avant la révélation.
  viewFor(name) {
    const c = this.current, secret = c && (c.giver === name || this.phase === 'reveal');
    const [a, b] = this.players;
    return {
      code: this.code, phase: this.phase, round: this.round, rounds: ROUNDS, me: name, host: this.host, notice: this.notice,
      players: this.players.map(p => ({ ...p, role: c ? (c.giver === p.name ? 'giver' : 'guesser') : null })),
      current: c && { ...c, target: secret ? c.target : null },
      history: this.history,
      winner: this.phase !== 'over' ? null : a.score === b.score ? null : (a.score > b.score ? a : b).name,
      maxClue: MAX_CLUE,
    };
  }
}

module.exports = { Room, pointsFor, ROUNDS, SUBJECTS };
