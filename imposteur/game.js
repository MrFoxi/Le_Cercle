// Règles de L'Imposteur (Civils, Imposteurs, Mr. White) pour un salon de 3 à 12 joueurs. Aucune notion de réseau : testé par test-imposteur.js.
// Une manche : cartes → tours d'indices → discussion → vote (→ revote en cas d'égalité) → élimination (→ Mr. White devine) → … jusqu'à une victoire.
const { CATEGORIES } = require('./words');

const MIN_PLAYERS = 3, MAX_PLAYERS = 12;
const REVEAL_MS = 30000, CLUE_MS = 60000, VOTE_MS = 60000, GUESS_MS = 45000, ELIM_MS = 6500;
const POINTS = { civil: 2, imposteur: 10, white: 6 }; // les rôles les plus durs rapportent le plus
const DISCUSSIONS = [0, 30, 60, 90, 120, 180]; // secondes ; 0 = vote direct après les indices
const MAX_CLUE = 30, MAX_GUESS = 40;

// Comparaison de mots tolérante : accents, majuscules, ponctuation, articles et pluriel ignorés.
const ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd']);
const tokens = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(t => t && !ARTICLES.has(t)).map(t => (t.length > 3 ? t.replace(/[sx]$/, '') : t));
// Un indice qui contient tous les mots du mot secret le dévoile (« thé vert » pour Thé, mais pas « athlète »).
const revealsWord = (clue, word) => { const c = new Set(tokens(clue)); const w = tokens(word); return w.length > 0 && w.every(t => c.has(t)); };
const sameWord = (a, b) => { const x = tokens(a).join(' '); return x !== '' && x === tokens(b).join(' '); };

// Répartition des rôles : au moins un intrus, jamais moins de civils que d'intrus, toujours plus de civils que d'imposteurs.
// À 4 joueurs, on autorise 1 imposteur + 1 Mr. White (sinon Mr. White n'apparaîtrait qu'à partir de 5).
function roleCounts(n, s) {
  const max = n === 4 ? 2 : Math.max(1, Math.floor((n - 1) / 2));
  let impostors = Math.min(s.impostors, max, Math.floor((n - 1) / 2));
  const whites = Math.min(s.whites, max - impostors);
  if (impostors + whites === 0) impostors = 1;
  return { civils: n - impostors - whites, impostors, whites };
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const int = (v, min, max, name) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} invalide`);
  return v;
};

class Room {
  constructor(code, rng = Math.random, isPrivate = false, now = Date.now) {
    this.code = code;
    this.rng = rng;
    this.now = now;
    this.private = isPrivate;
    this.players = []; // [{ name, connected }] ; le premier est l'hôte
    this.spectators = [];
    this.phase = 'lobby'; // lobby | reveal | clues | discussion | vote | guess | elim | over
    this.round = 0; // numéro de la manche dans la partie
    this.settings = { rounds: 3, impostors: 1, whites: 1, discussion: 60, categories: CATEGORIES.map(c => c.id) };
    this.scores = {};
    this.used = new Set(); // paires déjà jouées dans ce salon
    this.deadline = null; // fin de l'étape en cours (ms) ; le serveur appelle timeout() à cette heure
    this.notice = null;
    this.game = null;
  }

  get host() { return this.players[0]?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.players.length >= MAX_PLAYERS) throw new Error(`Salon complet (${MAX_PLAYERS} joueurs) : tu peux regarder la partie`);
    this.players.push({ name, connected: true });
    this.scores[name] ??= 0;
  }

  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }

  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }

  // Un joueur de la manche qui part pour de bon l'annule : sans lui, les rôles ne tiennent plus.
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    delete this.scores[name];
    if (this.game?.roles[name] && this.phase !== 'over') {
      this.phase = 'lobby';
      this.game = null;
      this.deadline = null;
      this.notice = `${name} a quitté : manche annulée`;
    }
  }

  hostOnly(name) { if (name !== this.host) throw new Error('Seul l’hôte du salon peut faire ça'); }

  setSettings(name, s = {}) {
    this.hostOnly(name);
    if (this.phase !== 'lobby' && this.phase !== 'over') throw new Error('Attends la fin de la manche');
    const categories = Array.isArray(s.categories) ? CATEGORIES.map(c => c.id).filter(id => s.categories.includes(id)) : [];
    if (!categories.length) throw new Error('Choisis au moins une catégorie');
    if (!DISCUSSIONS.includes(s.discussion)) throw new Error('Durée de discussion invalide');
    this.settings = {
      rounds: int(s.rounds, 1, 10, 'Nombre de manches'),
      impostors: int(s.impostors, 0, 4, 'Nombre d’imposteurs'),
      whites: int(s.whites, 0, 3, 'Nombre de Mr. White'),
      discussion: s.discussion,
      categories,
    };
  }

  ready() {
    if (this.players.length < MIN_PLAYERS) throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs`);
    if (this.players.some(p => !p.connected)) throw new Error('Un joueur est déconnecté');
  }

  start(name) {
    this.hostOnly(name);
    if (this.phase !== 'lobby') throw new Error('La partie est déjà lancée');
    this.ready();
    this.round = 0;
    for (const p of this.players) this.scores[p.name] = 0;
    this.startRound();
  }

  // Manche suivante, ou nouvelle partie si toutes les manches sont jouées.
  next(name) {
    this.hostOnly(name);
    if (this.phase !== 'over') throw new Error('La manche n’est pas finie');
    this.ready();
    if (this.round >= this.settings.rounds) {
      this.round = 0;
      for (const p of this.players) this.scores[p.name] = 0;
    }
    this.startRound();
  }

  toLobby(name) {
    this.hostOnly(name);
    if (this.phase !== 'over') throw new Error('La manche n’est pas finie');
    this.phase = 'lobby';
    this.game = null;
    this.round = 0;
  }

  pickPair() {
    const pool = CATEGORIES.filter(c => this.settings.categories.includes(c.id))
      .flatMap(c => c.pairs.map((pair, i) => ({ c, pair, key: `${c.id}:${i}` })));
    let fresh = pool.filter(p => !this.used.has(p.key));
    if (!fresh.length) { // tout a été joué : on recommence le paquet
      for (const p of pool) this.used.delete(p.key);
      fresh = pool;
    }
    const pick = fresh[Math.floor(this.rng() * fresh.length)];
    this.used.add(pick.key);
    const [civil, imposteur] = this.rng() < 0.5 ? pick.pair : [pick.pair[1], pick.pair[0]];
    return { category: pick.c.name, words: { civil, imposteur } };
  }

  startRound() {
    const names = this.players.map(p => p.name);
    const counts = roleCounts(names.length, this.settings);
    const roles = {};
    shuffle(names, this.rng).forEach((n, i) => (roles[n] = i < counts.impostors ? 'imposteur' : i < counts.impostors + counts.whites ? 'white' : 'civil'));
    // Ordre de parole tiré au sort ; Mr. White ne parle jamais en premier (il n'aurait aucun indice à écouter).
    const order = shuffle(names, this.rng);
    if (roles[order[0]] === 'white') {
      const i = order.findIndex(n => roles[n] !== 'white');
      [order[0], order[i]] = [order[i], order[0]];
    }
    this.round++;
    this.game = {
      ...this.pickPair(), roles, counts, order, alive: [...order], seen: [],
      tour: 0, speaker: null, clues: [], ready: [], votes: {}, candidates: [], revote: false,
      lastVote: null, elims: [], out: null, winner: null,
    };
    this.notice = null;
    this.phase = 'reveal';
    this.deadline = this.now() + REVEAL_MS;
  }

  // ---------- Étapes ----------
  inGame(name) {
    if (!this.game?.alive.includes(name)) throw new Error(this.game?.roles[name] ? 'Tu es éliminé : tu peux suivre la partie et discuter' : 'Tu joueras à la prochaine manche');
  }

  seenCard(name) {
    if (this.phase !== 'reveal') throw new Error('Les cartes sont déjà distribuées');
    this.inGame(name);
    const g = this.game;
    if (!g.seen.includes(name)) g.seen.push(name);
    if (g.alive.every(n => g.seen.includes(n))) this.startClues();
  }

  startClues() {
    const g = this.game;
    g.tour++;
    g.speaker = g.order.find(n => g.alive.includes(n));
    this.phase = 'clues';
    this.deadline = this.now() + CLUE_MS;
  }

  giveClue(name, text) {
    const g = this.game;
    if (this.phase !== 'clues') throw new Error('Ce n’est pas le moment des indices');
    if (name !== g.speaker) throw new Error('Ce n’est pas ton tour de parler');
    text = String(text ?? '').trim().replace(/\s+/g, ' ');
    if (!text) throw new Error('Écris un indice');
    if (text.length > MAX_CLUE) throw new Error(`Un indice court : ${MAX_CLUE} caractères maximum`);
    const word = g.words[g.roles[name]];
    if (word && revealsWord(text, word)) throw new Error('Interdit de dire ton mot !');
    g.clues.push({ tour: g.tour, name, text });
    this.nextSpeaker();
  }

  nextSpeaker() {
    const g = this.game;
    const next = g.order.slice(g.order.indexOf(g.speaker) + 1).find(n => g.alive.includes(n));
    if (next) {
      g.speaker = next;
      this.deadline = this.now() + CLUE_MS;
      return;
    }
    g.speaker = null;
    if (!this.settings.discussion) return this.startVote(g.alive, false);
    g.ready = [];
    this.phase = 'discussion';
    this.deadline = this.now() + this.settings.discussion * 1000;
  }

  // Chacun peut écourter la discussion ; le vote commence quand tous les joueurs en vie sont prêts.
  readyVote(name) {
    if (this.phase !== 'discussion') throw new Error('Ce n’est pas le moment de la discussion');
    this.inGame(name);
    const g = this.game;
    g.ready = g.ready.includes(name) ? g.ready.filter(n => n !== name) : [...g.ready, name];
    if (g.alive.every(n => g.ready.includes(n))) this.startVote(g.alive, false);
  }

  startVote(candidates, revote) {
    const g = this.game;
    g.votes = {};
    g.candidates = [...candidates];
    g.revote = revote;
    this.phase = 'vote';
    this.deadline = this.now() + VOTE_MS;
  }

  // Vote secret : rien n'est révélé tant que tout le monde n'a pas voté (on peut changer d'avis d'ici là).
  vote(name, target) {
    if (this.phase !== 'vote') throw new Error('Ce n’est pas le moment de voter');
    this.inGame(name);
    const g = this.game;
    if (target === name) throw new Error('Impossible de voter contre toi-même');
    if (!g.candidates.includes(target)) throw new Error('Ce joueur ne peut pas être éliminé');
    g.votes[name] = target;
    if (g.alive.every(n => g.votes[n])) this.resolveVote();
  }

  resolveVote() {
    const g = this.game, tally = {};
    for (const t of Object.values(g.votes)) tally[t] = (tally[t] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(n => tally[n] === max);
    g.lastVote = { votes: { ...g.votes }, tally, top, revote: g.revote };
    if (top.length === 1) return this.eliminate(top[0], max);
    if (top.length > 1 && !g.revote) return this.startVote(top, true); // égalité : on revote entre les ex æquo
    // Égalité persistante, ou personne n'a voté : personne n'est éliminé, on repart pour un tour d'indices.
    g.out = null;
    this.phase = 'elim';
    this.deadline = this.now() + ELIM_MS;
  }

  eliminate(name, votes) {
    const g = this.game;
    g.alive = g.alive.filter(n => n !== name);
    g.out = { name, role: g.roles[name], tour: g.tour, votes };
    g.elims.push(g.out);
    if (g.out.role === 'white') {
      this.phase = 'guess'; // dernière chance de Mr. White
      this.deadline = this.now() + GUESS_MS;
    } else {
      this.phase = 'elim';
      this.deadline = this.now() + ELIM_MS;
    }
  }

  guess(name, word) {
    const g = this.game;
    if (this.phase !== 'guess' || name !== g.out?.name) throw new Error('Seul Mr. White éliminé peut deviner le mot');
    word = String(word ?? '').trim();
    if (!word) throw new Error('Écris le mot que tu penses être celui des civils');
    if (word.length > MAX_GUESS) throw new Error('Mot trop long');
    g.out.guess = word;
    g.out.found = sameWord(word, g.words.civil);
    if (g.out.found) return this.finish('white', [name]);
    this.phase = 'elim';
    this.deadline = this.now() + ELIM_MS;
  }

  // Après une élimination : victoire éventuelle, sinon nouveau tour d'indices.
  winnerNow() {
    const g = this.game, count = r => g.alive.filter(n => g.roles[n] === r).length;
    const civ = count('civil'), imp = count('imposteur'), wh = count('white');
    if (!imp && !wh) return ['civil', null];
    if (imp && imp >= civ) return ['imposteur', null];
    if (!imp && civ <= 1) return ['white', g.alive.filter(n => g.roles[n] === 'white')]; // Mr. White a survécu jusqu'au bout
    return null;
  }

  afterElim() {
    const w = this.winnerNow();
    if (w) this.finish(...w);
    else this.startClues();
  }

  finish(team, names) {
    const g = this.game;
    names ??= Object.keys(g.roles).filter(n => g.roles[n] === team);
    for (const n of names) if (n in this.scores) this.scores[n] += POINTS[team];
    g.winner = { team, names, points: POINTS[team] };
    g.speaker = null;
    this.phase = 'over';
    this.deadline = null;
  }

  // Appelée par le serveur quand le temps de l'étape est écoulé.
  timeout() {
    const g = this.game;
    if (this.phase === 'reveal') this.startClues();
    else if (this.phase === 'clues') {
      g.clues.push({ tour: g.tour, name: g.speaker, text: null }); // temps écoulé : pas d'indice
      this.nextSpeaker();
    } else if (this.phase === 'discussion') this.startVote(g.alive, false);
    else if (this.phase === 'vote') this.resolveVote();
    else if (this.phase === 'guess') {
      g.out.guess = null;
      g.out.found = false;
      this.phase = 'elim';
      this.deadline = this.now() + ELIM_MS;
    } else if (this.phase === 'elim') this.afterElim();
  }

  // Chacun ne voit que sa propre carte (son mot, jamais son camp) ; tout est dévoilé en fin de manche.
  viewFor(name) {
    const g = this.game, role = g?.roles[name];
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, me: name, host: this.host, notice: this.notice,
      now: this.now(), deadline: this.deadline, settings: this.settings, counts: roleCounts(Math.max(this.players.length, MIN_PLAYERS), this.settings),
      min: MIN_PLAYERS, max: MAX_PLAYERS, points: POINTS, discussions: DISCUSSIONS,
      categories: CATEGORIES.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, count: c.pairs.length })),
      players: this.players.map(p => ({ ...p, score: this.scores[p.name] ?? 0 })),
      spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      game: g && {
        counts: g.counts, order: g.order, alive: g.alive, seen: g.seen, tour: g.tour, speaker: g.speaker, clues: g.clues, ready: g.ready,
        voted: Object.keys(g.votes), candidates: g.candidates, revote: g.revote, lastVote: g.lastVote, elims: g.elims, out: g.out,
        // Civils et imposteurs ne savent pas dans quel camp ils sont : ils reçoivent seulement leur mot. Mr. White, lui, le sait.
        me: role ? (role === 'white' ? { role, word: null } : { role: 'word', word: g.words[role] }) : null,
        myVote: this.phase === 'vote' ? g.votes[name] ?? null : null,
        reveal: this.phase === 'over' ? { roles: g.roles, words: g.words, category: g.category, winner: g.winner } : null,
      },
    };
  }
}

module.exports = { Room, roleCounts, revealsWord, sameWord, POINTS, MIN_PLAYERS, MAX_PLAYERS };
