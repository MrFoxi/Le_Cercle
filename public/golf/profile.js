// Mini-golf : profil du joueur gardé dans ce navigateur (points, statistiques, succès, tenue choisie).
// shortcut: tout est dans localStorage (décoratif, donc sans enjeu de triche) ; à mettre côté serveur s'il y a des comptes un jour.
/* global GolfLooks */
const { CATALOG, ACHIEVEMENTS, DEFAULT, validLook } = GolfLooks;
const KEY = 'golf-profile';
const blank = () => ({ points: 0, look: { ...DEFAULT }, stats: { games: 0, wins: 0, holes: 0, aces: 0, birdies: 0, waters: 0, betPts: 0 }, best: {}, ach: {} });

export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch { /* illisible */ }
  const b = blank();
  p = { ...b, ...p, stats: { ...b.stats, ...p?.stats }, best: { ...p?.best }, ach: { ...p?.ach } };
  p.look = validLook(p.look);
  return p;
}
export const saveProfile = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* stockage bloqué */ } };
export const unlocked = (p, kind, id) => (CATALOG[kind].find(i => i.id === id)?.need ?? 0) <= p.points;

// Ajoute un succès s'il est nouveau ; renvoie sa fiche (pour l'afficher) ou null
function grant(p, id, out) {
  if (p.ach[id]) return;
  p.ach[id] = Date.now();
  p.points += 40;
  out.push(ACHIEVEMENTS.find(a => a.id === id));
}

// Fin d'un trou pour moi. h = { id, base, par, strokes, bonus, picked, lucky, bounces, used (raccourcis), jumped, watersThisHole }
// game = mémoire de la partie en cours (série de birdies, eau)
export function onHole(p, h, game) {
  const gained = [], earned = 10 + Math.max(0, h.par - h.strokes) * 15 + (h.strokes === 1 && !h.picked ? 50 : 0);
  p.points += earned;
  p.stats.holes++;
  p.stats.waters += h.waters;
  game.waters += h.waters;
  if (!h.picked) {
    p.best[h.id] = Math.min(p.best[h.id] ?? 99, h.strokes);
    grant(p, 'premier', gained);
    if (h.strokes === 1) { p.stats.aces++; grant(p, 'trouenun', gained); }
    if (h.strokes < h.par) { p.stats.birdies++; game.streak++; } else game.streak = 0;
    if (game.streak >= 3) grant(p, 'birdie3', gained);
    if (h.bonus) grant(p, 'bonus', gained);
    if (h.lucky) grant(p, 'chanceux', gained);
    if (h.holedShot?.bounces >= 4) grant(p, 'ricochet', gained);
    if (h.holedShot?.shortcut) grant(p, 'teleport', gained);
    if (h.holedShot?.jumped) grant(p, 'saut', gained);
    if (h.base === 'volcan' && !h.waters) grant(p, 'lave', gained);
  } else game.streak = 0;
  if (p.stats.holes >= 100) grant(p, 'centenaire', gained);
  saveProfile(p);
  return { earned, gained };
}
// Fin de la partie pour moi
export function onGame(p, g) {
  const gained = [];
  p.stats.games++;
  p.points += 25;
  if (g.won && g.players > 1) { p.stats.wins++; p.points += 60; grant(p, 'gagnant', gained); }
  if (g.holes >= 5 && !g.waters) grant(p, 'sec', gained);
  if (p.stats.games >= 10) grant(p, 'habitue', gained);
  if (g.course === 'marathon') grant(p, 'marathon', gained);
  if (g.course === 'jour') grant(p, 'jour', gained);
  if (g.chaos) grant(p, 'chaos', gained);
  p.stats.betPts = Math.max(p.stats.betPts, 0) + (g.betPts ?? 0);
  if (p.stats.betPts >= 20) grant(p, 'parieur', gained);
  saveProfile(p);
  return gained;
}
export function onEvent(p, id) { const gained = []; grant(p, id, gained); saveProfile(p); return gained; }
