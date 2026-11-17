// THE HOLLOW — le relief de la Strate 01, les Jardins suspendus. Pur calcul (aucune dépendance) : le rendu, le
// personnage et les tests lisent la même fonction.
// Le lieu : une cavité ronde de 330 m de rayon, ouverte vers le ciel par un puits de lumière. Le sol descend en
// terrasses concentriques vers un gouffre central (le chemin vers les Brumes). Entre deux terrasses, une falaise de
// 9 m, sauf dans une rampe par marche, placée à un angle différent à chaque niveau : on descend en spirale.
export const R_ABYSS = 70, R_WALL = 330, STEP = 9, TERRACE = 34, RAMP_HALF = 0.11;
const GOLDEN = 2.399963;

/* bruit de valeur doux, reproductible */
function hash(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const sm = t => t * t * (3 - 2 * t);
export function noise(x, y) {
  const X = Math.floor(x), Y = Math.floor(y), u = sm(x - X), v = sm(y - Y);
  const a = hash(X, Y), b = hash(X + 1, Y), c = hash(X, Y + 1), d = hash(X + 1, Y + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1 + 31, y * 2.1) * 0.3 + noise(x * 4.3 - 7, y * 4.3 + 11) * 0.15;
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// écart d'angle, ramené dans [-π, π]
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// angle de la rampe qui relie la terrasse k à la terrasse k+1 (vers l'extérieur)
export const rampAngle = k => k * GOLDEN + 0.6;

// Hauteur du sol en (x, z) ; kind : 'void' (le gouffre), 'wall' (la paroi de la cavité), 'ground'
export function terrain(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  // bords des terrasses ondulés : on ne trace pas au compas
  const rr = r + (fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + r * 0.004) - 0.5) * 16;
  if (rr < R_ABYSS) return { h: -400, kind: 'void', level: -1 };
  const u = (rr - R_ABYSS) / TERRACE, k = Math.floor(u), f = u - k;
  // la contremarche : falaise raide, ou rampe douce dans le secteur de la rampe de ce niveau
  const ramp = smoothstep(RAMP_HALF, RAMP_HALF * 0.55, angDist(a, rampAngle(k)));
  const w = 0.12 + ramp * 0.78, rise = smoothstep(1 - w, 1, f);
  let h = STEP * (k + rise);
  // le dessus des terrasses n'est pas plat : légères bosses, les mêmes partout (sinon une marche au bord des terrasses)
  h += (fbm(x * 0.018 + 3, z * 0.018) - 0.5) * 3.2;
  let kind = 'ground';
  if (r > R_WALL) { const d = (r - R_WALL) / 10; h += Math.min(d * d * 6 + d * 8, 240) + (fbm(Math.cos(a) * 6 + 9, Math.sin(a) * 6 + r * 0.02) - 0.5) * 30 * Math.min(1, d); kind = 'wall'; }
  return { h, kind, level: k, ramp };
}
export const heightAt = (x, z) => terrain(x, z).h;

// Le point de départ : sur la terrasse la plus haute, juste avant sa rampe de descente
export function spawn() {
  const k = Math.floor((R_WALL - 20 - R_ABYSS) / TERRACE) - 1, a = rampAngle(k) + 0.32, r = R_ABYSS + TERRACE * (k + 1) + 12;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  return [x, heightAt(x, z), z];
}
