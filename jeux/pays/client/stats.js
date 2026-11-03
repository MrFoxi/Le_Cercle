// Statistiques, meilleurs scores et paramètres, gardés dans le navigateur (localStorage).
const STATS = 'pays-stats', SETTINGS = 'pays-settings';

const read = (key, fallback) => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* navigation privée : rien n'est gardé */ }
};

const emptyStats = () => ({ games: 0, correct: 0, wrong: 0, found: 0, seconds: 0, best: {}, misses: {} });
export const loadStats = () => read(STATS, emptyStats());
export const resetStats = () => write(STATS, emptyStats());

// Un meilleur score par combinaison de réglages : on ne compare que des parties comparables.
export const modeKey = o => `${o.scope}|${o.time}|${o.lives}`;

// Enregistre une partie terminée ; renvoie true si c'est un nouveau record.
export function recordGame(quiz) {
  const s = loadStats();
  s.games++;
  s.correct += quiz.correct;
  s.wrong += quiz.wrong;
  s.found += quiz.found.size;
  s.seconds += Math.round(quiz.elapsed);
  for (const [id, n] of Object.entries(quiz.misses)) s.misses[id] = (s.misses[id] || 0) + n;
  for (const id of quiz.skipped) s.misses[id] = (s.misses[id] || 0) + 1;
  const key = modeKey(quiz.options), prev = s.best[key];
  const record = quiz.points > 0 && (!prev || quiz.points > prev.points || (quiz.points === prev.points && quiz.elapsed < prev.seconds));
  if (record) s.best[key] = { points: quiz.points, accuracy: quiz.accuracy, found: quiz.found.size, total: quiz.total, seconds: Math.round(quiz.elapsed) };
  write(STATS, s);
  return record;
}

export const bestFor = options => loadStats().best[modeKey(options)] ?? null;

export const loadSettings = () => read(SETTINGS, { lang: 'fr', labels: true, autoZoom: true });
export const saveSettings = s => write(SETTINGS, s);
