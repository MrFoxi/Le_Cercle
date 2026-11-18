// THE HOLLOW — Strate 02, les Brumes éternelles. La brume n'y cache pas le paysage : elle est le paysage.
// On avance d'île en île, sur des ponts de lichen-cordage, sans jamais voir le fond ni le bord. Les îles pendent à des
// faisceaux de racines qui tombent d'un plafond qu'on ne voit pas. Un monde en valeurs de gris où seuls les rouges
// vivent : les trompettes qui soufflent des anneaux de brume, le lichen. Les Lanternes dérivent le long du chemin et
// guident ; les Guetteurs, immenses, sortent de la brume, regardent, et ne sont plus au même endroit quand elle revient ;
// les Mangeurs de brume passent en nuée et l'éclaircissent un instant. Tout en bas du chemin, le Puits de brume.
// Le relief (îles et ponts) est un pur calcul, lu par le voyageur, le rendu et les tests.
import * as THREE from 'three';
import { fbm } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { createStory } from './passeur.js';

/* ---------- Le relief : des îles, des ponts ---------- */
const ISLANDS = [], BRIDGES = [], HOLE = 18;
{
  const r = rng(202);
  // le chemin : une spirale d'îles qui descend vers le centre, une île tous les 170 à 230 m
  let a = 0.4, R = 1550, y = 900;
  for (let i = 0; i < 30; i++) {
    const rad = i === 0 ? 55 : i === 29 ? 85 : 24 + r() * 38;
    ISLANDS.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, y, R: rad, seed: i + 1, path: i, exit: i === 29 });
    const step = 170 + r() * 60; a += step / R; R -= 30; y -= 18 + r() * 12;
  }
  // des îles de côté, reliées par un pont : détours, cachettes
  for (let k = 0; k < 12; k++) {
    const P = ISLANDS[2 + Math.floor(r() * 25)], out = Math.atan2(P.z, P.x) + (r() < 0.5 ? 0 : Math.PI), d = P.R + 120 + r() * 80;
    ISLANDS.push({ x: P.x + Math.cos(out) * d, z: P.z + Math.sin(out) * d, y: P.y + (r() - 0.5) * 20, R: 22 + r() * 26, seed: 40 + k, side: true, from: ISLANDS.indexOf(P) });
  }
  // les ponts : du bord d'une île au bord de la suivante, en pente douce, avec un léger ventre
  const link = (A, B) => {
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    // le pont part exactement du bord de chaque île (son bord ondule : on le lit dans la direction du pont)
    const ra = radiusAt(A, Math.atan2(uz, ux)) * 0.995, rb = radiusAt(B, Math.atan2(-uz, -ux)) * 0.995;
    const a0 = [A.x + ux * ra, A.z + uz * ra], b0 = [B.x - ux * rb, B.z - uz * rb];
    BRIDGES.push({ a: a0, b: b0, ya: topAt(A, ...a0) ?? A.y, yb: topAt(B, ...b0) ?? B.y, w: 3.4, len: Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) });
  };
  for (let i = 0; i + 1 < 30; i++) link(ISLANDS[i], ISLANDS[i + 1]);
  // les ponts vers les îles de côté ne sont qu'une esquisse : il faut les encrer pour qu'ils portent
  for (const I of ISLANDS) if (I.side) { link(ISLANDS[I.from], I); BRIDGES.at(-1).sketch = true; BRIDGES.at(-1).to = I; }
}
// le dessus d'une île en (x, z), ou null si on est hors de l'île (son bord ondule)
function topAt(I, x, z) {
  const dx = x - I.x, dz = z - I.z, d = Math.hypot(dx, dz);
  if (d > I.R * 1.25) return null;
  const th = Math.atan2(dz, dx), Rt = I.R * (1 + (fbm(Math.cos(th) * 2 + I.seed * 3.1, Math.sin(th) * 2) - 0.5) * 0.35);
  if (d > Rt) return null;
  if (I.exit && d < HOLE && I.open) return null; // fermé, le Puits est un bouchon de brume sur lequel on marche
  return I.y + (1 - (d / Rt) ** 2) * I.R * 0.06 + (fbm(x * 0.05 + I.seed, z * 0.05) - 0.5) * 1.6;
}
function radiusAt(I, th) { return I.R * (1 + (fbm(Math.cos(th) * 2 + I.seed * 3.1, Math.sin(th) * 2) - 0.5) * 0.35); }
// la grille de recherche : chaque case de 250 m connaît les îles et les ponts qui la touchent
const CELL = 250, GRID = new Map();
const addTo = (x0, z0, x1, z1, it) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = i + ',' + j; if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(it); } };
for (const I of ISLANDS) addTo(I.x - I.R * 1.3, I.z - I.R * 1.3, I.x + I.R * 1.3, I.z + I.R * 1.3, { I });
for (const B of BRIDGES) addTo(Math.min(B.a[0], B.b[0]) - 5, Math.min(B.a[1], B.b[1]) - 5, Math.max(B.a[0], B.b[0]) + 5, Math.max(B.a[1], B.b[1]) + 5, { B });
// le dessus d'un pont en (x, z), ou null
function deckAt(B, x, z) {
  const dx = B.b[0] - B.a[0], dz = B.b[1] - B.a[1], L2 = dx * dx + dz * dz, t = ((x - B.a[0]) * dx + (z - B.a[1]) * dz) / L2;
  if (t < 0 || t > 1) return null;
  const px = B.a[0] + dx * t, pz = B.a[1] + dz * t;
  if (Math.hypot(x - px, z - pz) > B.w / 2) return null;
  return B.ya + (B.yb - B.ya) * t - Math.sin(t * Math.PI) * B.len * 0.03;
}
export function terrain(x, z) {
  let h = -Infinity, kind = 'void';
  for (const it of GRID.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || []) {
    if (it.B?.sketch && !it.B.inked) continue; // un pont en esquisse ne porte pas
    const v = it.I ? topAt(it.I, x, z) : deckAt(it.B, x, z);
    if (v !== null && v > h) { h = v; kind = it.I ? 'ground' : 'bridge'; }
  }
  return kind === 'void' ? { h: -1e4, kind } : { h, kind };
}
export const islands = ISLANDS, bridges = BRIDGES;
const EXIT = ISLANDS[29];
export const exitAt = (x, z) => EXIT.open && Math.hypot(x - EXIT.x, z - EXIT.z) < HOLE;
export { EXIT, HOLE };
export const spawn = () => [ISLANDS[0].x, topAt(ISLANDS[0], ISLANDS[0].x, ISLANDS[0].z), ISLANDS[0].z];

/* ---------- Les formes ---------- */
// une île : son dessus (lichen, roche) et son dessous qui pend en pointe, d'un seul tenant (le bord est commun)
function islandGeometry(I) {
  const ns = Math.round(48 + I.R), nr = Math.round(8 + I.R / 3), down = 9, depth = I.R * (1.4 + (I.seed % 5) * 0.15);
  const P = [], idx = [], ring = (j, rad, y, th) => P.push(I.x + Math.cos(th) * rad, y, I.z + Math.sin(th) * rad);
  const r0 = I.exit ? HOLE : 0;
  for (let j = 0; j <= nr; j++) for (let i = 0; i < ns; i++) {
    const th = (i / ns) * TAU, Rt = radiusAt(I, th), rad = r0 + (Rt - r0) * (j / nr), x = I.x + Math.cos(th) * rad, z = I.z + Math.sin(th) * rad;
    ring(j, rad, j === nr ? (topAt(I, I.x + Math.cos(th) * Rt * 0.99, I.z + Math.sin(th) * Rt * 0.99) ?? I.y) - 0.8 : (topAt(I, x, z) ?? I.y), th);
  }
  // le dessous : on referme vers une pointe, en anneaux de plus en plus serrés et bosselés
  for (let j = 1; j <= down; j++) for (let i = 0; i < ns; i++) {
    const th = (i / ns) * TAU, k = j / down, Rt = radiusAt(I, th) * (1 - k ** 1.3) * (0.85 + fbm(Math.cos(th) * 3 + j, Math.sin(th) * 3 + I.seed) * 0.35);
    ring(0, Math.max(0.5, Rt), I.y - 1 - depth * k ** 0.8, th);
  }
  const rows = nr + 1 + down;
  for (let j = 0; j + 1 < rows; j++) for (let i = 0; i < ns; i++) { const a = j * ns + i, b = j * ns + (i + 1) % ns, c = a + ns, d = b + ns; idx.push(a, c, b, b, c, d); }
  if (!I.exit) { const c0 = P.length / 3; P.push(I.x, topAt(I, I.x, I.z) ?? I.y, I.z); for (let i = 0; i < ns; i++) idx.push(c0, i, (i + 1) % ns); }
  // le puits de brume : la paroi intérieure du trou plonge
  if (I.exit) { const b0 = P.length / 3; for (let i = 0; i < ns; i++) { const th = (i / ns) * TAU; P.push(I.x + Math.cos(th) * HOLE * 0.95, I.y - 40, I.z + Math.sin(th) * HOLE * 0.95); } for (let i = 0; i < ns; i++) { const a = i, b = (i + 1) % ns; idx.push(a, b, b0 + i, b, b0 + (i + 1) % ns, b0 + i); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// un pont de lichen-cordage : un tablier tressé, deux cordes à hauteur de main, des suspentes
function bridgeGeometry(B) {
  const n = Math.max(12, Math.round(B.len / 3)), dx = B.b[0] - B.a[0], dz = B.b[1] - B.a[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
  const at = (t, side, dy = 0) => { const y = B.ya + (B.yb - B.ya) * t - Math.sin(t * Math.PI) * B.len * 0.03; return [B.a[0] + dx * t + px * side, y + dy, B.a[1] + dz * t + pz * side]; };
  const K = [];
  for (const s of [-1.1, 0, 1.1]) K.push(paint(tube(Array.from({ length: n + 1 }, (_, i) => at(i / n, s, -0.35)), 0.55, 0.55, 6, n * 2), '#b8b0a4', '#7a7068', 0.12));
  for (const s of [-1, 1]) {
    K.push(paint(tube(Array.from({ length: n + 1 }, (_, i) => at(i / n, s * 1.75, 1.1 + Math.sin((i / n) * Math.PI) * 0.4)), 0.07, 0.07, 5, n * 2), '#c8c0b4', '#8a8078'));
    for (let i = 0; i <= n; i += 2) { const p = at(i / n, s * 1.75, -0.2), q = at(i / n, s * 1.75, 1.1 + Math.sin((i / n) * Math.PI) * 0.4); K.push(paint(tube([p, q], 0.05, 0.04, 4, 2), '#a89c90')); }
  }
  // du lichen rouge, par touffes, le long des cordes
  const r = rng(Math.round(B.a[0] * 7 + B.a[1]));
  for (let i = 0; i < n * 1.5; i++) { const p = at(r(), (r() - 0.5) * 3.6, 0.1 + r() * 0.6); K.push(paint(lump(0.18 + r() * 0.25, { detail: 1, lumpy: 0.4, seed: i }).translate(...p), '#d84a5a', '#8a2a38')); }
  return merge(K);
}
// une trompette rouge : une Ombelle creuse qui respire la brume et la souffle en anneaux
function trumpet(seed) {
  const r = rng(seed), H = 1, bell = 0.45 + r() * 0.2, bend = (r() - 0.5) * 0.3;
  const prof = [[0.05, 0], [0.06, 0.4], [0.07, 0.65], [0.12, 0.82], [bell * 0.6, 0.95], [bell, 1.02], [bell * 0.92, 1.05], [0.1, 0.9]].map(([x, y]) => new THREE.Vector2(x, y * H));
  const g = new THREE.LatheGeometry(prof, 18); g.translate(0, 0, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + bend * y * y); }
  g.computeVertexNormals();
  return paint(g, '#ff4a5a', '#7a1f2c', 0.08);
}
// une Lanterne : grand Flottant pâle, une lueur dans le ventre, de longs filaments
function lantern(seed) {
  const r = rng(seed), K = [paint(new THREE.LatheGeometry([[0.01, 2.6], [1.6, 2.4], [2.6, 1.4], [2.7, 0.3], [2.2, 0.1], [1.4, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)), 24), '#ffffff', '#c8d4e8', 0.03)];
  for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; K.push(paint(tube([[Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4], [Math.cos(a) * 1.6, -4, Math.sin(a) * 1.6], [Math.cos(a) * 1.1, -9 - r() * 6, Math.sin(a) * 1.1]], 0.06, 0.02, 4, 10), '#e8f0ff')); }
  return merge(K).translate(0, 10, 0); // les filaments ondulent (on remonte la forme : le vent souffle plus fort en haut)
}
// un Guetteur : un cou immense qui sort de la brume, une petite tête
function watcher() {
  const K = [paint(tube([[0, -700, 0], [10, -300, 6], [-20, 0, 18], [0, 160, 40], [30, 230, 70]], 22, 7, 10, 40), '#5a5e70', '#2a2e3c', 0.08)];
  K.push(paint(lump(12, { sx: 1.6, sy: 0.8, lumpy: 0.15, detail: 2 }).translate(40, 238, 82), '#5a5e70', '#3a3e4c'));
  return merge(K);
}

/* ---------- La strate ---------- */
export const LOOK = {
  name: 'Les Brumes éternelles', sun: [0.12, 1, 0.06], sunCol: '#f2f4fa', shadowCol: '#8a84a8', fog: '#dfe4ec', density: 0.0028, shadows: false,
  pal: [[0.52, 0.56, 0.6], [0.74, 0.77, 0.8], [0.62, 0.6, 0.7], [0.72, 0.74, 0.79], [0.42, 0.45, 0.54], [0.66, 0.18, 0.25], [0.86, 0.22, 0.3], [1, 0.62, 0.7]],
  skyMid: '#d6dce8', skyTop: '#f4f6fa',
};

export function create(scene, Q, ctx = {}) {
  const live = { colliders: [], islands: [] }, r = rng(77), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  const groundMat = ink({ kind: 'terrain', vertexColors: false, side: THREE.DoubleSide });
  // les îles du chemin et des détours
  for (const I of ISLANDS) scene.add(cast(new THREE.Mesh(islandGeometry(I), groundMat)));
  // chaque pont garde sa matière : celle d'un pont en esquisse s'efface jusqu'à ce qu'on l'encre
  for (const B of BRIDGES) { B.mat = ink({ line: 0.8, fade: B.sketch && !B.inked ? 1 : 0 }); scene.add(cast(new THREE.Mesh(bridgeGeometry(B), B.mat))); }
  // les îles lointaines, inaccessibles : à toutes les hauteurs, partout
  const far = [];
  for (let k = 0; k < Q.islands * 1.4; k++) {
    for (let n = 0; n < 30; n++) {
      const a = r() * TAU, d = 300 + r() * 2600, x = Math.cos(a) * d, z = Math.sin(a) * d, R = 20 + r() * r() * 160;
      if (ISLANDS.some(I => Math.hypot(I.x - x, I.z - z) < I.R + R + 120)) continue;
      const I = { x, z, y: -300 + r() * 1700, R, seed: 100 + k };
      scene.add(new THREE.Mesh(islandGeometry(I), groundMat)); far.push(I); break;
    }
  }
  // les racines : chaque île pend à un faisceau qui monte dans le blanc (le plafond, on ne le voit jamais)
  {
    const K = [];
    for (const I of [...ISLANDS, ...far]) {
      const n = 3 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        const a = r() * TAU, d = radiusAt(I, a) * 1.03, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, top = 1900 + r() * 300, th = 0.25 + I.R * 0.012 + r() * 0.4;
        const lean = d * 0.25;
        K.push(paint(tube([[x - Math.cos(a) * 2, I.y - I.R * 0.4, z - Math.sin(a) * 2], [x, I.y + 2, z], [x + Math.cos(a) * lean * 0.3, I.y + 60, z + Math.sin(a) * lean * 0.3], [x + Math.cos(a) * lean + (r() - 0.5) * 40, top, z + Math.sin(a) * lean + (r() - 0.5) * 40]], th, th * 0.5, 6, 14), '#c8c0b8', '#8a8088', 0.08));
      }
    }
    scene.add(new THREE.Mesh(merge(K), ink({ line: 0.7 })));
  }
  // des piliers colossaux qui montent et se perdent dans le blanc
  for (let k = 0; k < 8; k++) {
    for (let n = 0; n < 40; n++) {
      const a = r() * TAU, d = 500 + r() * 2200, x = Math.cos(a) * d, z = Math.sin(a) * d, R = 50 + r() * 130;
      if (ISLANDS.some(I => Math.hypot(I.x - x, I.z - z) < I.R + R + 80)) continue;
      const g = tube([[x, -1200, z], [x + (r() - 0.5) * 80, 300, z + (r() - 0.5) * 80], [x + (r() - 0.5) * 120, 2400, z + (r() - 0.5) * 120]], R, R * 0.7, 18, 30), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const nn = fbm(p.getX(i) * 0.01, p.getZ(i) * 0.01 + p.getY(i) * 0.004) - 0.5; p.setXYZ(i, p.getX(i) + nn * R * 0.5, p.getY(i), p.getZ(i) + nn * R * 0.5); }
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(paint(g, '#9ca2b0', '#5a6070', 0.12), ink({ line: 0.8 }))); break;
    }
  }
  // la mer de brume, tout en bas (on y disparaît si l'on tombe)
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), glowy({ color: '#ffffff', alpha: 0.55, soft: 1 })); m.rotation.x = -Math.PI / 2; m.position.y = 0 - k * 60; scene.add(m); }
  // trompettes rouges et anneaux de brume ; perles de rosée sous les îles ; touffes de lichen pâle
  const horns = [];
  {
    const kinds = Array.from({ length: 4 }, (_, k) => trumpet(k * 9 + 2)), lists = kinds.map(() => []), mat = ink({ line: 0.8, wind: 0.01 });
    for (const I of ISLANDS) for (let k = 0; k < 2 + Math.floor(I.R / 10); k++) {
      const a = r() * TAU, d = I.R * (0.25 + r() * 0.55), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = topAt(I, x, z);
      if (h === null) continue;
      const s = 2 + r() * r() * 14; lists[k % 4].push([x, h, z, s, r() * TAU]); horns.push([x, h + s, z, s]); live.colliders.push([x, z, 0.12 * s + 0.3]);
    }
    kinds.forEach((g, k) => { const im = new THREE.InstancedMesh(g, mat, Math.max(1, lists[k].length)); lists[k].forEach(([x, y, z, s, a], i) => im.setMatrixAt(i, m4.compose(p3.set(x, y - 0.2, z), q.setFromAxisAngle(up, a), s3.setScalar(s)))); im.count = lists[k].length; scene.add(cast(im)); });
    const pearls = [], pg = new THREE.IcosahedronGeometry(1, 2);
    for (const I of ISLANDS) for (let k = 0; k < 14; k++) { const a = r() * TAU, d = I.R * r() * 0.7; pearls.push([I.x + Math.cos(a) * d, I.y - I.R * (0.3 + r() * 0.6) - r() * 6, I.z + Math.sin(a) * d, 0.3 + r() * 0.9]); }
    const pm = new THREE.InstancedMesh(paint(pg, '#f4fbff', '#b8d4f0'), ink({ line: 0.3, trans: 0.8, glow: 0.35 }), pearls.length);
    pearls.forEach(([x, y, z, s], i) => pm.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.identity(), s3.setScalar(s)))); scene.add(pm);
  }
  const rings = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 8, 32).rotateX(Math.PI / 2), glowy({ color: '#ffffff', alpha: 0.7, soft: 0.6 })); m.visible = false; scene.add(m); return { m, t: 9, h: null }; });
  // les Lanternes, le long du chemin
  const path = ISLANDS.filter(I => I.path !== undefined), lanterns = [];
  {
    const g = lantern(5), mat = ink({ line: 0.45, trans: 0.75, wind: 0.04 }), belly = ink({ line: 0.2, glow: 1.2 });
    for (let k = 0; k < Q.lanterns; k++) {
      const grp = new THREE.Group(), s = 0.8 + r() * 1.2;
      grp.add(new THREE.Mesh(g, mat)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10).translate(0, 11.2, 0), belly); grp.add(b);
      grp.scale.setScalar(s); scene.add(grp); lanterns.push({ grp, u: (k / Q.lanterns) * (path.length - 1), sp: 0.006 + r() * 0.01, h: 14 + r() * 26, off: (r() - 0.5) * 60, ph: r() * TAU });
    }
  }
  // les Guetteurs, très loin
  const watchers = Array.from({ length: 6 }, (_, k) => { const m = new THREE.Mesh(watcher(), ink({ line: 0.6 })); scene.add(m); return { m, a: (k / 6) * TAU + r(), d: 700 + r() * 900, rise: r() * TAU, s: 0.6 + r() * 0.8 }; });
  // les Mangeurs de brume : une nuée qui tourne près du voyageur
  const flock = new THREE.InstancedMesh((() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -0.9, 0.15, -0.3, 0, 0, -0.1, 0, 0, 0.5, 0.9, 0.15, -0.3, 0, 0, -0.1], 3)); g.computeVertexNormals(); return paint(g, '#3a3848'); })(), ink({ line: 0.5, side: THREE.DoubleSide }), Q.flock);
  flock.frustumCulled = false; scene.add(flock);
  const birds = Array.from({ length: Q.flock }, () => ({ a: r() * TAU, rr: 4 + r() * 14, h: (r() - 0.5) * 10, sp: 0.8 + r() * 0.6, ph: r() * TAU }));
  let clear = 0;
  // le Puits de brume : des anneaux d'encre qui tournent en s'enfonçant, des voiles qui spiralent vers le bas
  const vortex = new THREE.Group(); vortex.position.set(EXIT.x, EXIT.y, EXIT.z); scene.add(vortex);
  const vRings = Array.from({ length: 9 }, (_, k) => { const m = new THREE.Mesh(paint(new THREE.TorusGeometry(HOLE * (1 - k * 0.07), 0.5, 8, 48).rotateX(Math.PI / 2), k % 2 ? '#ffffff' : '#c8c0e0', '#8a84a8'), ink({ line: 0.9 })); vortex.add(m); return m; });
  const veils = Array.from({ length: 6 }, (_, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(HOLE * 1.6, HOLE * 0.6), glowy({ color: k % 2 ? '#ffffff' : '#e0dcf0', alpha: 0.6 })); vortex.add(m); return m; });

  live.update = (t, hero) => {
    vRings.forEach((m, k) => { const f = (k / 9 + t * 0.05) % 1; m.position.y = -f * 60; m.scale.setScalar(1 - f * 0.7); m.rotation.z = Math.sin(t + k) * 0.08; m.rotation.y = t * (0.3 + k * 0.05); });
    veils.forEach((m, k) => { const a = t * 0.6 + (k / 6) * TAU, f = (k / 6 + t * 0.08) % 1; m.position.set(Math.cos(a) * HOLE * 0.6 * (1 - f), -f * 50, Math.sin(a) * HOLE * 0.6 * (1 - f)); m.rotation.set(-1.2, -a, 0); });
    // la brume monte par vagues : de 250 m de vue à quelques dizaines ; la nuée l'éclaircit autour d'elle
    const wave = Math.max(0, Math.sin(t * TAU / 55)) ** 6;
    const fc = new THREE.Vector3(hero.x + Math.cos(t * 0.11) * 90, hero.y + 12 + Math.sin(t * 0.3) * 8, hero.z + Math.sin(t * 0.13) * 90);
    clear += ((fc.distanceTo(hero) < 70 ? 1 : 0) - clear) * 0.02;
    U.uFogDensity.value = (LOOK.density + wave * 0.016) * (1 - clear * 0.55);
    // les Guetteurs : ils montent et descendent lentement ; quand la brume est épaisse, ils changent de place
    for (const w of watchers) {
      if (wave > 0.9 && !w.moved) { w.a += 1 + r() * 2; w.moved = true; } else if (wave < 0.1) w.moved = false;
      const x = hero.x + Math.cos(w.a) * w.d, z = hero.z + Math.sin(w.a) * w.d;
      w.m.position.set(x, hero.y - 260 + Math.sin(t * 0.03 + w.rise) * 120, z); w.m.scale.setScalar(w.s);
      w.m.rotation.y = Math.atan2(hero.x - x, hero.z - z) - 1.2 + Math.sin(t * 0.05 + w.rise) * 0.3;
    }
    // les Lanternes glissent le long du chemin, au-dessus des ponts
    for (const L of lanterns) {
      L.u = (L.u + L.sp * 0.016) % (path.length - 1);
      const i = Math.floor(L.u), f = L.u - i, A = path[i], B = path[i + 1];
      L.grp.position.set(A.x + (B.x - A.x) * f + Math.sin(L.ph) * L.off, A.y + (B.y - A.y) * f + L.h + Math.sin(t * 0.6 + L.ph) * 2, A.z + (B.z - A.z) * f + Math.cos(L.ph) * L.off);
      L.grp.rotation.y = t * 0.1 + L.ph;
    }
    // la nuée
    birds.forEach((b, i) => {
      const a = b.a + t * b.sp, x = fc.x + Math.cos(a) * b.rr, z = fc.z + Math.sin(a) * b.rr, y = fc.y + b.h + Math.sin(t * 3 + b.ph) * 0.8;
      flock.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromEuler(new THREE.Euler(Math.sin(t * 12 + b.ph) * 0.5, -a, 0)), s3.setScalar(0.7)));
    });
    flock.instanceMatrix.needsUpdate = true;
    // une trompette proche souffle un anneau de temps en temps
    for (const g of rings) {
      if (g.t > 6) { if (r() < 0.01) { const near = horns.filter(h => Math.hypot(h[0] - hero.x, h[2] - hero.z) < 160); if (near.length) { g.h = near[Math.floor(r() * near.length)]; g.t = 0; } } g.m.visible = false; continue; }
      g.t += 0.016; const k = g.t / 6, [x, y, z, s] = g.h;
      g.m.visible = true; g.m.position.set(x, y + k * s * 2.5, z); g.m.scale.setScalar(s * (0.4 + k * 1.6)); g.m.material.uniforms.uAlpha.value = 0.7 * (1 - k);
    }
  };
  const start = spawn(), next = ISLANDS[1];
  // l'histoire : le Passeur, l'encre rouge des trompettes, les ponts à encrer, les trois Lanternes, le Puits
  const story = createStory(scene, { islands: ISLANDS, bridges: BRIDGES, exit: EXIT, hole: HOLE, horns, topAt, ui: ctx.ui }), base = live.update;
  live.colliders.push(...story.colliders);
  return Object.assign(live, {
    look: LOOK, terrain, start, camYaw: Math.atan2(start[0] - next.x, start[2] - next.z),
    exitAt, killY: safe => safe.y - 160, interact: story.interact, story,
    update(t, p) { base(t, p); story.update(t, p); },
  });
}
