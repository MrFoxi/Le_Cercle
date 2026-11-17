// THE HOLLOW — le relief de la Strate 01, les Jardins suspendus. Pur calcul (aucune dépendance) : le rendu, le
// personnage et les tests lisent la même fonction.
// Le lieu : une cavité ronde de 2 km de rayon, ouverte vers le ciel par un puits de lumière. Le sol descend en
// treize terrasses concentriques de 120 m vers un gouffre central de 380 m (le chemin vers les Brumes). Entre deux
// terrasses, une falaise de 26 m, sauf dans une rampe par marche, placée à un angle différent à chaque niveau : on
// descend en spirale. Autour, la paroi de la cavité monte à plus de 600 m.
export const R_ABYSS = 380, R_WALL = 2000, STEP = 26, TERRACE = 120, RAMP_HALF = 0.06;
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
  const rr = r + (fbm(Math.cos(a) * 5 + 5, Math.sin(a) * 5 + r * 0.0012) - 0.5) * 70;
  if (rr < R_ABYSS) return { h: -400, kind: 'void', level: -1 };
  const u = (rr - R_ABYSS) / TERRACE, k = Math.floor(u), f = u - k;
  // la contremarche : falaise raide, ou rampe douce dans le secteur de la rampe de ce niveau
  const ramp = smoothstep(RAMP_HALF, RAMP_HALF * 0.55, angDist(a, rampAngle(k)));
  const w = 0.12 + ramp * 0.78, rise = smoothstep(1 - w, 1, f);
  let h = STEP * (k + rise);
  // le dessus des terrasses n'est pas plat : légères bosses, les mêmes partout (sinon une marche au bord des terrasses)
  h += (fbm(x * 0.004 + 3, z * 0.004) - 0.5) * 14 + (fbm(x * 0.03, z * 0.03) - 0.5) * 2.5;
  let kind = 'ground';
  if (r > R_WALL) { const d = (r - R_WALL) / 40; h += Math.min(d * d * 30 + d * 30, 700) + (fbm(Math.cos(a) * 14 + 9, Math.sin(a) * 14 + r * 0.004) - 0.5) * 140 * Math.min(1, d); kind = 'wall'; }
  return { h, kind, level: k, ramp };
}
export const heightAt = (x, z) => terrain(x, z).h;

// Le point de départ : sur la terrasse la plus haute, juste avant sa rampe de descente
export function spawn() {
  const k = Math.floor((R_WALL - 60 - R_ABYSS) / TERRACE) - 1, a = rampAngle(k) + 0.1, r = R_ABYSS + TERRACE * (k + 1) + 40;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  return [x, heightAt(x, z), z];
}
