// Logique du quiz : questions, réponses, score, fin de partie. Aucune dépendance à la carte ni au DOM.
export const CONTINENTS = ['Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Asie', 'Europe', 'Océanie'];

// Modes prêts à l'emploi ; chaque option (zone, temps, erreurs) reste réglable indépendamment.
export const MODES = {
  classic: { label: 'Classique', desc: 'Tous les pays du monde, sans limite de temps.', scope: 'Monde', time: 0, lives: 0 },
  chrono: { label: 'Chronométré', desc: 'Un maximum de pays en 3 minutes.', scope: 'Monde', time: 180, lives: 0 },
  continent: { label: 'Continent', desc: 'Seulement les pays d’un continent.', scope: 'Europe', time: 0, lives: 0 },
  defi: { label: 'Défi', desc: 'Tout le monde, mais 3 erreurs maximum.', scope: 'Monde', time: 0, lives: 3 },
};

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Quiz {
  // countries : [{ id, continent }] ; options : { scope: 'Monde' | continent, time: secondes (0 = sans), lives: erreurs max (0 = sans) }
  constructor(countries, { scope = 'Monde', time = 0, lives = 0 } = {}, rng = Math.random) {
    this.options = { scope, time, lives };
    this.pool = new Set(countries.filter(c => scope === 'Monde' || c.continent === scope).map(c => c.id));
    this.queue = shuffle([...this.pool], rng);
    this.found = new Set();
    this.skipped = [];
    this.misses = {}; // pays demandé -> nombre de mauvais clics
    this.correct = 0;
    this.wrong = 0;
    this.points = 0;
    this.tries = 0; // erreurs sur la question en cours
    this.elapsed = 0;
    this.over = false;
    this.reason = null; // 'done' | 'time' | 'lives' | 'quit'
  }

  get current() { return this.over ? null : this.queue[0] ?? null; }
  get total() { return this.pool.size; }
  get answered() { return this.found.size + this.skipped.length; }
  get accuracy() { return this.correct + this.wrong ? Math.round((this.correct / (this.correct + this.wrong)) * 100) : 0; }
  get timeLeft() { return this.options.time ? Math.max(0, this.options.time - this.elapsed) : null; }
  get livesLeft() { return this.options.lives ? Math.max(0, this.options.lives - this.wrong) : null; }

  // Renvoie 'correct', 'wrong' ou 'ignored' (pays hors zone, déjà trouvé, partie finie).
  answer(id) {
    const target = this.current;
    if (!target || !this.pool.has(id) || this.found.has(id)) return 'ignored';
    if (id === target) {
      this.correct++;
      this.found.add(id);
      this.points += this.tries ? 50 : 100; // trouvé du premier coup : 100 points, sinon 50
      this.next();
      return 'correct';
    }
    this.wrong++;
    this.tries++;
    this.misses[target] = (this.misses[target] || 0) + 1;
    if (this.options.lives && this.wrong >= this.options.lives) this.finish('lives');
    return 'wrong';
  }

  // Passe la question ; renvoie le pays qu'il fallait trouver.
  skip() {
    const target = this.current;
    if (!target) return null;
    this.skipped.push(target);
    this.next();
    return target;
  }

  next() {
    this.queue.shift();
    this.tries = 0;
    if (!this.queue.length) this.finish('done');
  }

  tick(seconds) {
    if (this.over) return;
    this.elapsed = seconds;
    if (this.options.time && seconds >= this.options.time) this.finish('time');
  }

  finish(reason) {
    if (this.over) return;
    this.over = true;
    this.reason = reason;
  }
}
