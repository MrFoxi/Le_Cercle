// LES EAUX DE MONET — la géographie de l'étang : un pur calcul, lu par le rendu, les poissons, la pêche et les tests.
// Hauteur 0 = la surface de l'eau. Les lobes de reglages.js se fondent en une seule forme, bordée de bruit.
import { ETANG } from './reglages.js';

export const hasard = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const h2 = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t);
export const lisse = (a, b, x) => sm(Math.max(0, Math.min(1, (x - a) / (b - a))));
export function bruit(x, y) { const X = Math.floor(x), Y = Math.floor(y), u = sm(x - X), v = sm(y - Y), a = h2(X, Y), b = h2(X + 1, Y), c = h2(X, Y + 1), d = h2(X + 1, Y + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export const fbm = (x, y) => bruit(x, y) * 0.55 + bruit(x * 2.1 + 31, y * 2.1) * 0.3 + bruit(x * 4.3 - 7, y * 4.3 + 11) * 0.15;
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + (h * h * k) / 4; };

// le champ de l'eau : positif dans l'eau, négatif sur la berge (en mètres, à peu près)
function champ(x, z) { let f = -1e9; for (const l of ETANG.lobes) f = smax(f, l.r - Math.hypot(x - l.x, z - l.z), 9); return f + (fbm(x * 0.05 + 7, z * 0.05) - 0.5) * 6; }
function profExacte(x, z, f) {
  let s = 0, w = 0; for (const l of ETANG.lobes) { const k = Math.max(0, l.r - Math.hypot(x - l.x, z - l.z) + 7) ** 2; s += k * l.prof; w += k; }
  const F = ETANG.fosse, trou = lisse(F.r, F.r * 0.3, Math.hypot(x - F.x, z - F.z)) * F.prof;
  return ((s / (w || 1)) * (0.85 + fbm(x * 0.09, z * 0.09) * 0.3) + trou) * lisse(0, 9, f);
}
function hauteurExacte(x, z) {
  const f = champ(x, z), r = Math.hypot(x, z);
  if (f > 0) return -profExacte(x, z, f);
  const collines = (fbm(x * 0.022 + 3, z * 0.022) - 0.42) * 7 * lisse(2, 34, -f);
  return Math.min(-f * 0.14, 1.4) + Math.max(collines, -0.4) * lisse(2, 12, -f) + (r > ETANG.limite - 10 ? Math.min(13, ((r - ETANG.limite + 10) / 9) ** 2 * 2.4) : 0); // une colline douce ferme le monde, sans cacher le ciel
}
// une grille de 1 m : bien plus rapide pour les poissons et le promeneur
const N = 340, DEMI = N / 2, G = new Float32Array((N + 1) * (N + 1));
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) G[j * (N + 1) + i] = hauteurExacte(i - DEMI, j - DEMI);
export function hauteur(x, z) {
  const u = Math.max(0, Math.min(N - 1e-3, x + DEMI)), v = Math.max(0, Math.min(N - 1e-3, z + DEMI)), i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * (N + 1) + i;
  return (G[k] * (1 - a) + G[k + 1] * a) * (1 - b) + (G[k + N + 1] * (1 - a) + G[k + N + 2] * a) * b;
}
export const profondeur = (x, z) => Math.max(0, -hauteur(x, z));
export const dansLEau = (x, z) => hauteur(x, z) < -0.02;

/* ---------- Le pont japonais ---------- */
const P = ETANG.pont, PL = Math.hypot(P.b[0] - P.a[0], P.b[1] - P.a[1]), PU = [(P.b[0] - P.a[0]) / PL, (P.b[1] - P.a[1]) / PL];
export const pontBase = [hauteur(...P.a), hauteur(...P.b)];
export const PONT = { ...P, longueur: PL, axe: PU };
// position le long du pont : t de 0 à 1 et écart latéral, ou null en dehors
export function surPont(x, z) { const dx = x - P.a[0], dz = z - P.a[1], l = dx * PU[0] + dz * PU[1], e = -dx * PU[1] + dz * PU[0]; return l < 0 || l > PL || Math.abs(e) > P.largeur / 2 ? null : { t: l / PL, e }; }
export const hauteurPont = t => pontBase[0] + (pontBase[1] - pontBase[0]) * t + Math.sin(t * Math.PI) * P.fleche + 0.12;
// le sol sous les pieds : le tablier du pont si l'on y est monté, sinon le terrain
export function sol(x, z, y = 99) { const h = hauteur(x, z), p = surPont(x, z); if (p) { const d = hauteurPont(p.t); if (y > d - 1.2) return Math.max(h, d); } return h; }
export const pilesPont = [0.3, 0.5, 0.7].flatMap(t => [-1, 1].map(s => ({ x: P.a[0] + PU[0] * PL * t - PU[1] * s * P.largeur * 0.5, z: P.a[1] + PU[1] * PL * t + PU[0] * s * P.largeur * 0.5, t })));

/* ---------- Ce qui pousse et ce qui encombre : positions fixes, les mêmes pour tous ---------- */
const r = hasard(1872);
export const NENUPHARS = [];
for (let n = 0; n < 3000 && NENUPHARS.length < 460; n++) {
  const dense = n % 3 !== 0, a = r() * Math.PI * 2, d = Math.sqrt(r()), x = dense ? 44 + Math.cos(a) * d * 26 : Math.cos(a) * d * 62, z = dense ? -8 + Math.sin(a) * d * 25 : Math.sin(a) * d * 62, pr = profondeur(x, z);
  if (pr < 0.35 || pr > 2.6 || bruit(x * 0.09 + 4, z * 0.09) < (dense ? 0.3 : 0.62) || NENUPHARS.some(l => Math.hypot(l.x - x, l.z - z) < l.r + 0.5) || surPont(x, z)) continue;
  NENUPHARS.push({ x, z, r: 0.5 + r() * 0.9, fleur: r() < 0.3 ? (r() < 0.6 ? 'rose' : 'blanc') : null, a: r() * Math.PI * 2 });
}
export const SOUCHES = [[30, 41], [36, 36], [22, 45], [41, 40], [17, 38], [-37, -19]].map(([x, z]) => ({ x, z, r: 0.6 + r() * 0.5 }));
export const ROCHERS = [[-56, 30], [-52, 44], [-38, 44], [-60, 36], [-30, 42]].map(([x, z]) => ({ x, z, r: 0.8 + r() * 1.1 }));
export const ARBRES = [];
const libre = (x, z, m) => ARBRES.every(a => Math.hypot(a.x - x, a.z - z) > a.r * 0.45 + m) && Math.hypot(x - ETANG.camp.x, z - ETANG.camp.z) > 11 && !surPont(x, z) && Math.hypot(x - ETANG.pont.a[0], z - ETANG.pont.a[1]) > 7 && Math.hypot(x - ETANG.pont.b[0], z - ETANG.pont.b[1]) > 7;
ARBRES.push({ x: -49, z: -42, genre: 'saule', h: 13, r: 9, geant: true }, { x: -25, z: -60, genre: 'saule', h: 9, r: 6 }, { x: 70, z: 12, genre: 'saule', h: 9, r: 6 }, { x: -62, z: 24, genre: 'saule', h: 8, r: 5.5 });
for (const [x, z] of [[27, 54], [37, 52], [46, 46], [16, 58], [53, 37], [31, 63], [43, 60]]) ARBRES.push({ x, z, genre: 'rond', h: 12 + r() * 4, r: 6.5 + r() * 2, penche: true });
for (let n = 0; n < 1200 && ARBRES.length < 96; n++) {
  const a = r() * Math.PI * 2, d = 42 + r() * 62, x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (hauteur(x, z) < 0.6 || !libre(x, z, 6) || ETANG.secteurs.some(s => Math.hypot(s.x - x, s.z - z) < 8)) continue;
  const g = r(); ARBRES.push({ x, z, genre: g < 0.28 ? 'peuplier' : g < 0.42 ? 'bouleau' : 'rond', h: g < 0.28 ? 17 + r() * 7 : 8 + r() * 7, r: g < 0.28 ? 2.6 : 3.6 + r() * 3 });
}
// ce que le promeneur ne traverse pas : troncs et rochers
export const OBSTACLES = [...ARBRES.map(a => [a.x, a.z, a.geant ? 1.3 : 0.55]), ...ROCHERS.map(o => [o.x, o.z, o.r * 0.9])];

// la carte des abris : nénuphars, roseaux, branches au-dessus de l'eau, structures (souches, piles, rochers)
const C = new Float32Array(4 * 171 * 171), cK = (x, z) => { const i = Math.round((x + 170) / 2), j = Math.round((z + 170) / 2); return i < 0 || j < 0 || i > 170 || j > 170 ? -1 : (j * 171 + i) * 4; };
const tache = (x, z, R, c, v) => { for (let dz = -R; dz <= R; dz += 2) for (let dx = -R; dx <= R; dx += 2) { const k = cK(x + dx, z + dz); if (k >= 0) C[k + c] = Math.max(C[k + c], v * lisse(R + 1, R * 0.3, Math.hypot(dx, dz))); } };
NENUPHARS.forEach(l => tache(l.x, l.z, 4, 0, 0.8));
export const roseauEn = (x, z) => { const d = hauteur(x, z); return d < 0.25 && d > -0.75 && bruit(x * 0.13, z * 0.13) > 0.55; };
for (let z = -130; z <= 130; z += 2) for (let x = -130; x <= 130; x += 2) if (roseauEn(x, z)) tache(x, z, 2, 1, 1);
ARBRES.filter(a => a.genre === 'saule' || a.penche).forEach(a => tache(a.x, a.z, Math.round(a.r + 5), 2, 1));
[...SOUCHES, ...pilesPont.map(p => ({ ...p, r: 1 })), ...ROCHERS].forEach(o => tache(o.x, o.z, 6, 3, 1));
export function abri(x, z) { const k = cK(x, z); return k < 0 ? { nenuphar: 0, roseau: 0, arbre: 0, structure: 0 } : { nenuphar: C[k], roseau: C[k + 1], arbre: C[k + 2], structure: C[k + 3] }; }
// à quel point un endroit plaît à une espèce (0 à 1)
export function habitat(H, x, z) {
  const d = profondeur(x, z); if (d < H.profMin * 0.6 || d < 0.35) return 0;
  const a = abri(x, z), ouv = 1 - Math.max(a.nenuphar, a.roseau, a.arbre, a.structure), pr = lisse(H.profMin * 0.6, H.profMin, d) * (1 - lisse(H.profMax, H.profMax * 1.4, d));
  return pr * (0.15 + Math.max(a.nenuphar * H.nenuphar, a.roseau * H.roseau, a.arbre * H.arbre, a.structure * H.structure, ouv * H.ouvert) * 0.85);
}
export const secteurEn = (x, z) => ETANG.secteurs.find(s => Math.hypot(s.x - x, s.z - z) < s.r) ?? null;
export const CASES_EAU = []; for (let z = -96; z <= 96; z += 3) for (let x = -96; x <= 96; x += 3) if (profondeur(x, z) > 0.5) CASES_EAU.push([x, z]);
