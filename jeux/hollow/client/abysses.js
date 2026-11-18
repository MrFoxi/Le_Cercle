// THE HOLLOW — Strate 04, les Abysses engloutis. Une ville que l'eau a prise d'un coup, et qui n'a jamais cessé d'être
// habitée, mais plus par ceux qui l'ont bâtie. On nage librement (hero.js, mode nage) dans un bassin de 1,3 km sous
// 300 m d'eau : la surface jette une lumière verte qui ondule ; sous 30 m, elle s'éteint, il ne reste que les fenêtres
// rondes qui brillent encore en jaune (personne ne sait ce qui les allume), les méduses-phares et les cloches de nacre.
// Tours rongées couvertes d'Ossatures, arches brisées, escaliers qui montent et s'arrêtent sous la surface, une poutre
// de roche colossale en travers de la vue ; algues-cheveux qui montrent le courant, raies-voiles en formation au-dessus
// des toits, et le Long, si long qu'on n'en voit jamais les deux bouts. Au fond, la Fosse : la suite (fermée au départ).
// Le relief, les tours, la poutre, les fenêtres et les cloches sont de purs calculs, lus aussi par les tests.
import * as THREE from 'three';
import { fbm } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { createGround, sectors } from './sol.js';
import { createStory } from './plongeur.js';
import { abyss } from './sol.js';

/* ---------- Le relief : un bassin, la ville, la Fosse ---------- */
export const SURF = 300, R_BASIN = 1300, DARK = SURF - 40; // sous DARK, plus de jour : le souffle s'use
export const FOSSE = { x: 640, z: -560, R: 48 };
export const gates = { fosse: false }; // la Fosse est fermée par un treillis d'Ossatures ; l'histoire l'ouvre
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function floorAt(x, z) {
  const r = Math.hypot(x, z), dF = Math.hypot(x - FOSSE.x, z - FOSSE.z);
  if (dF < FOSSE.R + (fbm(x * 0.08, z * 0.08) - 0.5) * 8) return -400;
  let h = (fbm(x * 0.002 + 9, z * 0.002) - 0.5) * 50 + (fbm(x * 0.015, z * 0.015) - 0.5) * 8 + (fbm(x * 0.08, z * 0.08) - 0.5) * 1.2;
  h -= sm(FOSSE.R + 140, FOSSE.R, dF) * 30; // le sol penche vers la Fosse
  if (r > R_BASIN - 250) { const d = (r - R_BASIN + 250) / 30; h += d * d * 8; } // la paroi du bassin
  return h;
}
export const LID_Y = floorAt(FOSSE.x + FOSSE.R + 14, FOSSE.z);

// la poutre : une arête de roche de 2,5 km, d'une paroi à l'autre, en diagonale ; des boules pour la heurter
const BEAM = new THREE.CatmullRomCurve3([new THREE.Vector3(-1220, 40, -320), new THREE.Vector3(-40, 230, 90), new THREE.Vector3(1180, 350, 470)]);
export const spheres = Array.from({ length: 150 }, (_, i) => { const p = BEAM.getPointAt(i / 149); return [p.x, p.y, p.z, 32 - (i / 149) * 8]; });
const inBeam = (x, y, z, m = 0) => spheres.some(([cx, cy, cz, r]) => Math.hypot(x - cx, y - cy, z - cz) < r + m);

// les tours : celle du Plongeur (la plus haute, son toit dans la lumière), puis la ville, rongée
export const TOWERS = [];
export const PL = { x: -140, z: 120, r: 16, top: SURF - 36, seed: 1 };
TOWERS.push(PL);
{
  const r = rng(404);
  for (let n = 0; n < 900 && TOWERS.length < 72; n++) {
    const a = r() * TAU, d = 60 + Math.sqrt(r()) * (R_BASIN - 420), x = Math.cos(a) * d, z = Math.sin(a) * d, R = 5 + r() * r() * 18;
    const base = floorAt(x, z), top = Math.min(SURF - 24, base + 30 + r() * r() * 230);
    if (TOWERS.some(T => Math.hypot(T.x - x, T.z - z) < T.r + R + 16) || Math.hypot(x - FOSSE.x, z - FOSSE.z) < FOSSE.R + R + 50) continue;
    TOWERS.push({ x, z, r: R, top, seed: 10 + n });
  }
}
// le mur d'une tour est rongé : son rayon change avec l'angle et la hauteur (les fenêtres s'y posent)
export const wallR = (T, a, y) => T.r * (1 + (fbm(a * 3 + T.seed, y * 0.05) - 0.5) * 0.12 - (fbm(a * 6 + T.seed * 2, y * 0.12) > 0.72 ? 0.12 : 0));
const towerAt = (x, z) => TOWERS.find(T => Math.hypot(x - T.x, z - T.z) < T.r);

// le terrain : le sol, les toits plats des tours, le treillis sur la Fosse tant qu'elle est fermée ; la plus haute
// surface sous « below »
export function terrain(x, z, below = Infinity) {
  let best = -Infinity, f = floorAt(x, z);
  if (f < -100 && !gates.fosse && Math.hypot(x - FOSSE.x, z - FOSSE.z) < FOSSE.R + 10) f = LID_Y;
  if (f > -100 && f <= below) best = f;
  const T = towerAt(x, z);
  if (T && T.top <= below && T.top > best) best = T.top;
  return best === -Infinity ? { h: -1e4, kind: 'void' } : { h: best, kind: 'ground' };
}
export const exitAt = (x, z) => gates.fosse && Math.hypot(x - FOSSE.x, z - FOSSE.z) < FOSSE.R + 4;
const OUT = new THREE.Vector2(1, 0.6).normalize();
export const spawn = () => [PL.x + OUT.x * (PL.r + 10), SURF - 3, PL.z + OUT.y * (PL.r + 10)];

// les trois fenêtres allumées que le Plongeur réclame : au fond, dans le noir, chacune dans une autre direction,
// tournées vers sa tour
export const WINDOWS = [];
{
  const cand = TOWERS.filter(T => T !== PL && T.top < DARK - 80 && T.r > 7).map(T => ({ T, d: Math.hypot(T.x - PL.x, T.z - PL.z), a: Math.atan2(T.z - PL.z, T.x - PL.x) })).filter(c => c.d > 280 && c.d < 850).sort((u, v) => u.d - v.d);
  for (const c of cand) {
    if (WINDOWS.length === 3) break;
    if (WINDOWS.some(W => Math.abs(Math.atan2(Math.sin(W.ang - c.a), Math.cos(W.ang - c.a))) < 1.3)) continue;
    const a = Math.atan2(PL.z - c.T.z, PL.x - c.T.x), y = c.T.top - 12, R = wallR(c.T, a, y) + 0.15;
    if (y < floorAt(c.T.x, c.T.z) + 8 || inBeam(c.T.x + Math.cos(a) * R, y, c.T.z + Math.sin(a) * R, 10)) continue;
    WINDOWS.push({ x: c.T.x + Math.cos(a) * R, y, z: c.T.z + Math.sin(a) * R, a, T: c.T, ang: c.a });
  }
}
// les cloches de nacre : tous les 100 m sur les chemins du Plongeur aux fenêtres et à la Fosse, et d'une fenêtre à
// l'autre (on ne remonte pas forcément entre deux) ; quelques-unes
// ailleurs ; jamais dans une tour, dans la poutre ni sous le sol
export const ROUTES = [...WINDOWS.map(W => [W.x + Math.cos(W.a) * 3, W.y, W.z + Math.sin(W.a) * 3]), [FOSSE.x, LID_Y + 6, FOSSE.z]];
export const BELLS = [], LEGS = [];
{
  const r = rng(4040), from = new THREE.Vector3(PL.x + OUT.x * (PL.r + 10), DARK, PL.z + OUT.y * (PL.r + 10));
  const put = (x, y, z) => {
    for (const T of TOWERS) { const d = Math.hypot(x - T.x, z - T.z); if (d < T.r + 6) { x = T.x + ((x - T.x) / (d || 1)) * (T.r + 6); z = T.z + ((z - T.z) / (d || 1)) * (T.r + 6); } }
    for (let k = 0; k < 20 && inBeam(x, y, z, 6); k++) y += 4;
    y = Math.max(y, floorAt(x, z) + 4);
    if (!BELLS.some(B => Math.hypot(B[0] - x, B[1] - y, B[2] - z) < 30)) BELLS.push([x, y, z]);
  };
  const pts = ROUTES.map(p => new THREE.Vector3(...p));
  pts.forEach((to, i) => { LEGS.push([from, to]); for (let j = i + 1; j < pts.length; j++) LEGS.push([to, pts[j]]); });
  for (const [a, b] of LEGS) { const L = a.distanceTo(b); for (let d = 90; d < L - 30; d += 95) { const p = a.clone().lerp(b, d / L); put(p.x, p.y, p.z); } }
  for (let k = 0; k < 14; k++) { const a = r() * TAU, d = 100 + r() * 800; put(Math.cos(a) * d, 30 + r() * 140, Math.sin(a) * d); }
}

/* ---------- Les formes ---------- */
// une tour : un fût rongé (bleu pétrole, plus clair vers le haut), un toit plat, des corniches, une couronne brisée
function towerGeometry(T, r) {
  const base = floorAt(T.x, T.z) - 4, h = T.top - base, K = [];
  const g = new THREE.CylinderGeometry(1, 1, h, 28, Math.max(4, Math.round(h / 5)), true).translate(0, base + h / 2, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), R = wallR(T, a, y) * (1 + (y < base + 12 ? 0.1 : 0)); p.setXYZ(i, T.x + Math.cos(a) * R, y, T.z + Math.sin(a) * R); }
  g.computeVertexNormals(); K.push(paint(g, '#3f8088', '#10282f', 0.1));
  K.push(paint(new THREE.CircleGeometry(T.r * 1.02, 28).rotateX(-Math.PI / 2).translate(T.x, T.top, T.z), '#2f6a70'));
  for (let y = base + 18; y < T.top - 6; y += 14 + (T.seed % 5)) K.push(paint(new THREE.TorusGeometry(T.r * 1.07, 0.4, 4, 28).rotateX(Math.PI / 2).translate(T.x, y, T.z), '#2a5a62', '#16343c'));
  const n = Math.round(T.r * 1.3);
  const seat = T === PL ? Math.atan2(OUT.y, OUT.x) : null; // le bord où s'assied le Plongeur reste libre
  for (let k = 0; k < n; k++) { if (r() < 0.4) continue; const a = (k / n) * TAU; if (seat !== null && Math.abs(Math.atan2(Math.sin(a - seat), Math.cos(a - seat))) < 0.6) continue; K.push(paint(lump(0.6 + r() * 0.7, { sy: 1 + r() * 1.3, lumpy: 0.35, detail: 1, seed: k + T.seed }).translate(T.x + Math.cos(a) * T.r * 0.95, T.top + 0.6 + r() * 1.5, T.z + Math.sin(a) * T.r * 0.95), '#3f8088', '#1f4a58')); }
  return merge(K);
}
// une fenêtre ronde (posée contre le mur, tournée vers l'extérieur)
const disc = (x, y, z, a, s) => new THREE.CircleGeometry(s, 12).rotateY(Math.PI / 2 - a).translate(x, y, z);
// une méduse-phare : une ombrelle, huit tentacules de 40 m
function phare() {
  const K = [paint(new THREE.LatheGeometry([[0.01, 2.4], [1.8, 2.1], [2.8, 0.9], [2.6, 0], [1.9, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 20), '#f4ffb0', '#9ad85a', 0.03)];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, w = i % 2 ? 1.6 : 2.2; K.push(paint(tube([[Math.cos(a) * w, 0.2, Math.sin(a) * w], [Math.cos(a) * w * 1.2, -12, Math.sin(a) * w * 1.2], [Math.cos(a + 0.4) * w, -26, Math.sin(a + 0.4) * w], [Math.cos(a) * w * 0.6, -40, Math.sin(a) * w * 0.6]], 0.12, 0.03, 4, 16), '#e8ffa0', '#6ab84a')); }
  return merge(K);
}
// une raie-voile : un losange plat, une longue queue
const raie = () => merge([paint(lump(1, { sx: 1.6, sy: 0.14, sz: 1.1, lumpy: 0.08, detail: 1 }), '#2f6a78', '#c8f0e8'), paint(tube([[0, 0, -0.9], [0, 0.05, -2.4], [0, 0.15, -4]], 0.08, 0.02, 4, 6), '#1f4a58')]);

/* ---------- La strate ---------- */
export const LOOK = {
  name: 'Les Abysses engloutis', sun: [0.12, 1, 0.18], sunCol: '#bff8e0', shadowCol: '#0c1820', fog: '#1f5a58', density: 0.006, shadows: false,
  pal: [[0.12, 0.29, 0.35], [0.18, 0.42, 0.45], [0.12, 0.35, 0.27], [0.3, 0.5, 0.52], [0.12, 0.2, 0.25], [0.18, 0.54, 0.52], [0.29, 0.91, 0.88], [1, 0.88, 0.54]],
  skyMid: '#2f8a84', skyTop: '#8ad8c0', abyssY: -1e5, water: SURF,
};
const DEEP = { fog: new THREE.Color('#05121a'), skyMid: new THREE.Color('#0a2a30'), skyTop: new THREE.Color('#3a7a72') };
const SHALLOW = { fog: new THREE.Color('#2a7a74'), skyMid: new THREE.Color(LOOK.skyMid), skyTop: new THREE.Color(LOOK.skyTop) };

export function create(scene, Q, ctx = {}) {
  const live = { colliders: [] }, r = rng(41), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), e3 = new THREE.Euler(), e4 = new THREE.Euler(0, 0, 0, 'YXZ');
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  live.ground = createGround(scene, floorAt, (cx, cz, c) => Math.hypot(cx, cz) - c > R_BASIN + 300);
  { const [x0, , z0] = spawn(); live.ground({ x: x0, z: z0 }, 1e6); } // tout le sol, avant la première image
  // la surface, vue d'en dessous : une grande tache de lumière qui suit le voyageur ; des rais verts qui plongent
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(Math.PI / 2), glowy({ color: '#f4fff8', alpha: 0.5, soft: 1 })); // une tache de lumière au-dessus de lui, qui s'efface vers ses bords (vue de loin, à plat, elle faisait une ligne d'horizon) surf.position.y = SURF; scene.add(surf);
  for (let k = 0; k < 18; k++) { const a = r() * TAU, d = r() * 900, R = 6 + r() * 16, m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R, 170, 16, 1, true), glowy({ color: '#9af0c8', alpha: 0.08, add: true, soft: 1 })); m.position.set(Math.cos(a) * d, SURF - 85, Math.sin(a) * d); m.rotation.set((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25); scene.add(m); }
  // les tours, leurs fenêtres (quelques-unes allumées, toujours en bas), les obstacles
  const lit = [], dark = [];
  scene.add(cast(new THREE.Mesh(merge(TOWERS.map(T => towerGeometry(T, r))), ink({ line: 1 }))));
  for (const T of TOWERS) {
    live.colliders.push([T.x, T.z, T.r * 1.08, T.top]);
    const base = floorAt(T.x, T.z), n = Math.max(4, Math.round(T.r / 2.5));
    for (let y = base + 8, lv = 0; y < T.top - 5; y += 9, lv++) for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + lv * 0.37, R = wallR(T, a, y) + 0.08, x = T.x + Math.cos(a) * R, z = T.z + Math.sin(a) * R;
      if (y < DARK - 30 && r() < 0.13) lit.push(disc(x, y, z, a, 0.85)); else dark.push(disc(x, y, z, a, 0.95));
    }
  }
  scene.add(new THREE.Mesh(merge(dark), ink({ line: 0.4, color: '#0c1820', vertexColors: false })));
  scene.add(new THREE.Mesh(merge(lit), ink({ line: 0.3, glow: 2.4, color: '#ffe08a', vertexColors: false })));
  // la poutre de roche
  scene.add(cast(new THREE.Mesh(paint(tube(BEAM.points.map(v => v.toArray()), 34, 26, 18, 80), '#3a6a70', '#10262e', 0.12), ink({ line: 1 }))));
  // les arches brisées : deux piliers (l'un cassé), un arc qui ne rejoint plus l'autre côté
  {
    const K = [];
    for (let k = 0, n = 0; k < 7 && n < 200; n++) {
      const a = r() * TAU, d = 150 + r() * 800, x = Math.cos(a) * d, z = Math.sin(a) * d, b = r() * TAU, w = 14 + r() * 10, x2 = x + Math.cos(b) * w * 2, z2 = z + Math.sin(b) * w * 2;
      if (TOWERS.some(T => Math.hypot(T.x - x, T.z - z) < T.r + w * 2 + 8 || Math.hypot(T.x - x2, T.z - z2) < T.r + 8) || Math.hypot(x - FOSSE.x, z - FOSSE.z) < 140) continue;
      const y1 = floorAt(x, z), y2 = floorAt(x2, z2), h = 40 + r() * 40;
      K.push(paint(tube([[x, y1 - 3, z], [x, y1 + h, z]], 3.4, 2.8, 10, 6), '#3f8088', '#16343c'), paint(tube([[x2, y2 - 3, z2], [x2, y2 + h * 0.45, z2]], 3.4, 3, 10, 4), '#3f8088', '#16343c'));
      K.push(paint(tube([[x, y1 + h - 2, z], [x + Math.cos(b) * w * 0.7, y1 + h + w * 0.6, z + Math.sin(b) * w * 0.7], [x + Math.cos(b) * w * 1.2, y1 + h + w * 0.45, z + Math.sin(b) * w * 1.2]], 2.6, 2, 8, 14), '#3f8088', '#1f4a58'));
      live.colliders.push([x, z, 3.6, y1 + h], [x2, z2, 3.6, y2 + h * 0.45]); k++;
    }
    // les escaliers qui montent autour d'une colonne, et s'arrêtent sous la surface
    for (let k = 0, n = 0; k < 3 && n < 200; n++) {
      const a = r() * TAU, d = 200 + r() * 700, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (TOWERS.some(T => Math.hypot(T.x - x, T.z - z) < T.r + 20) || Math.hypot(x - FOSSE.x, z - FOSSE.z) < 140) continue;
      const y0 = floorAt(x, z), top = SURF - 8;
      K.push(paint(new THREE.CylinderGeometry(2.4, 2.8, top - y0 + 4, 10, 8).translate(x, (top + y0) / 2 - 2, z), '#3f8088', '#16343c'));
      for (let y = y0, i = 0; y < top; y += 0.9, i++) { const t = i * 0.32; K.push(paint(new THREE.BoxGeometry(3.6, 0.45, 1.5).translate(4.2, 0, 0).rotateY(-t).translate(x, y, z), '#5a9a98', '#2a5a62')); }
      live.colliders.push([x, z, 6.4, top]); k++;
    }
    scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 0.9 }))));
  }
  // les Ossatures : coquilles et coraux calcifiés, sur les murs des tours et au sol
  {
    const list = [];
    for (let k = 0; k < Q.rocks; k++) {
      if (k % 3) { const T = TOWERS[k % TOWERS.length], a = r() * TAU, base = floorAt(T.x, T.z), y = base + r() * (T.top - base), R = wallR(T, a, y); list.push([T.x + Math.cos(a) * R, y, T.z + Math.sin(a) * R, 0.5 + r() * 1.8]); }
      else { const a = r() * TAU, d = r() * (R_BASIN - 280), x = Math.cos(a) * d, z = Math.sin(a) * d, h = floorAt(x, z); if (h > -100) list.push([x, h, z, 1 + r() * 3.5]); }
    }
    const g = merge([paint(lump(1, { sx: 1.3, sy: 0.6, lumpy: 0.5, detail: 1 }), '#e8f0e0', '#4a7a70'), ...[0, 1, 2].map(i => paint(tube([[0, 0, 0], [(i - 1) * 0.5, 0.9, 0.2], [(i - 1) * 0.8, 1.6, (i - 1) * 0.3]], 0.14, 0.05, 4, 5), '#f0d8c8', '#c87a6a'))]);
    sectors(scene, g, ink({ line: 0.6 }), list, ([x, y, z, s], m) => m.compose(p3.set(x, y, z), q.setFromEuler(e3.set(r() * TAU, r() * TAU, r() * TAU)), s3.setScalar(s)));
  }
  // les algues-cheveux : toutes penchées dans le sens du courant, au sol et sur les toits
  {
    const list = [];
    for (let k = 0; k < Q.algae / 8; k++) {
      const T = k % 5 === 0 ? TOWERS[k % TOWERS.length] : null, a = r() * TAU, d = T ? r() * T.r * 0.8 : r() * (R_BASIN - 300), cx = (T ? T.x : 0) + Math.cos(a) * d, cz = (T ? T.z : 0) + Math.sin(a) * d;
      for (let i = 0; i < 8; i++) { const x = cx + (r() - 0.5) * 7, z = cz + (r() - 0.5) * 7, h = T ? (Math.hypot(x - T.x, z - T.z) < T.r ? T.top : floorAt(x, z)) : floorAt(x, z); if (h > -100) list.push([x, h, z, 2 + r() * 8]); }
    }
    const g = paint(new THREE.PlaneGeometry(0.35, 1, 1, 6).translate(0, 0.5, 0), '#5ad8a0', '#0f3a30');
    sectors(scene, g, ink({ line: 0.3, wind: 1.4, side: THREE.DoubleSide }), list, ([x, y, z, s], m) => m.compose(p3.set(x, y, z), q.setFromEuler(e3.set(0, r() * TAU, 0.25)), s3.set(1, s, 1)), false);
  }
  // la Fosse : une lèvre d'Ossatures, et un battement rouge qui monte d'en dessous (on le voit quand elle est ouverte)
  {
    const K = [];
    for (let k = 0; k < 36; k++) { const a = (k / 36) * TAU, x = FOSSE.x + Math.cos(a) * (FOSSE.R + 5), z = FOSSE.z + Math.sin(a) * (FOSSE.R + 5); K.push(paint(lump(3 + r() * 4, { detail: 1, lumpy: 0.45, seed: k }).translate(x, floorAt(x + Math.cos(a) * 6, z + Math.sin(a) * 6), z), '#e8f0e0', '#4a7a70')); }
    scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 1 }))));
    live.heart = new THREE.Mesh(new THREE.CylinderGeometry(FOSSE.R * 0.9, FOSSE.R * 0.4, 300, 32, 1, true), glowy({ color: '#ff5a3a', alpha: 0.3, add: true })); live.heart.position.set(FOSSE.x, LID_Y - 150, FOSSE.z); scene.add(live.heart);
  }
  // les méduses-phares : elles éclairent autour d'elles et dérivent ; leur halo se voit de loin
  const phares = new THREE.InstancedMesh(phare(), ink({ line: 0.4, glow: 1.5, pulse: 1, trans: 0.5, wind: 0.03 }), Q.phares), halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(30, 30), glowy({ color: '#d8ff8a', alpha: 0.2, add: true, soft: 1 }), Q.phares);
  phares.frustumCulled = halos.frustumCulled = false; scene.add(phares, halos);
  const jel = Array.from({ length: Q.phares }, () => { const a = r() * TAU, d = r() * 1000; return { home: new THREE.Vector3(Math.cos(a) * d, 70 + r() * 160, Math.sin(a) * d), ph: r() * TAU, s: 0.8 + r() * 0.8 }; });
  // les raies-voiles : des bancs en V qui tournent au-dessus des toits
  const rays = new THREE.InstancedMesh(raie(), ink({ line: 0.6, glow: 0.15 }), Q.rays); rays.frustumCulled = false; scene.add(rays);
  const banks = Array.from({ length: Math.ceil(Q.rays / 20) }, (_, b) => ({ c: new THREE.Vector3((r() - 0.5) * 1000, 160 + r() * 70, (r() - 0.5) * 1000), R: 160 + r() * 260, ph: r() * TAU, w: (0.03 + r() * 0.03) * (b % 2 ? 1 : -1) }));
  // le Long : 150 anneaux de chair sombre et des points cyan le long des flancs
  const LONG = 150, longM = new THREE.InstancedMesh(paint(lump(1, { sx: 1, sy: 0.85, sz: 1.6, lumpy: 0.12, detail: 2 }), '#1f4a58', '#05121a'), ink({ line: 1 }), LONG);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), ink({ glow: 2.2, color: '#4ae8e0', vertexColors: false, pulse: 1 }), LONG);
  longM.frustumCulled = dots.frustumCulled = false; scene.add(longM, dots);
  // il suit un grand tour du bassin qui se déforme lentement : il ne repasse jamais au même endroit
  const longAt = (s, t, out) => { const R = 820 + Math.sin(s * 1.7 + t * 0.004) * 220; return out.set(Math.cos(s) * R, 120 + Math.sin(s * 2.3 + t * 0.006) * 70, Math.sin(s) * R); };
  live.long = [];
  // la neige des abysses : une poussière pâle qui tombe autour du voyageur
  const snowN = Q.spores, snow = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), glowy({ color: '#e8fff4', alpha: 0.75, soft: 0.2 }), snowN), sn0 = [];
  snow.frustumCulled = false; scene.add(snow);
  for (let k = 0; k < snowN; k++) sn0.push([r() * 120 - 60, r() * 60 - 20, r() * 120 - 60, r() * TAU, 0.5 + r()]);

  const c = new THREE.Color(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  live.update = (t, hero) => {
    live.ground(hero);
    U.uHero.value.copy(hero); U.uReact.value = 0;
    // plus on descend, plus le noir monte : la brume et le ciel s'éteignent
    const k = sm(20, 170, SURF - hero.y);
    U.uFogCol.value.copy(c.copy(SHALLOW.fog).lerp(DEEP.fog, k)); U.uSkyMid.value.copy(c.copy(SHALLOW.skyMid).lerp(DEEP.skyMid, k)); U.uSkyTop.value.copy(c.copy(SHALLOW.skyTop).lerp(DEEP.skyTop, k * 0.8));
    U.uFogDensity.value = 0.006 + k * 0.005;
    surf.position.set(hero.x, SURF, hero.z);
    jel.forEach((j, i) => {
      const p = p3.copy(j.home).add(a3.set(Math.sin(t * 0.05 + j.ph) * 40, Math.sin(t * 0.3 + j.ph) * 5, Math.cos(t * 0.04 + j.ph) * 40));
      phares.setMatrixAt(i, m4.compose(p, q.setFromEuler(e3.set(Math.sin(t * 0.6 + j.ph) * 0.08, t * 0.05 + j.ph, 0)), s3.set(j.s, j.s * (1 + Math.sin(t * 1.4 + j.ph) * 0.1), j.s)));
      halos.setMatrixAt(i, m4.compose(p, q.setFromRotationMatrix(m4.lookAt(p, hero, a3.set(0, 1, 0))), s3.setScalar(j.s)));
    });
    phares.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < Q.rays; i++) {
      const B = banks[(i / 20) | 0], j = i % 20, row = Math.ceil(j / 2), side = j % 2 ? 1 : -1, ang = B.ph + t * B.w;
      const ca = Math.cos(ang), sa = Math.sin(ang), dir = Math.sign(B.w), back = row * 5, lat = side * row * 4;
      const x = B.c.x + ca * B.R - (-sa * dir) * back + ca * lat, z = B.c.z + sa * B.R - (ca * dir) * back + sa * lat;
      rays.setMatrixAt(i, m4.compose(p3.set(x, B.c.y + Math.sin(t * 0.7 + j) * 2 + row * 1.2, z), q.setFromEuler(e4.set(0, Math.atan2(-sa * dir, ca * dir), Math.sin(t * 2.4 + j * 0.7) * 0.25)), s3.setScalar(1.6)));
    }
    rays.instanceMatrix.needsUpdate = true;
    // le Long : la tête avance, le corps suit le même chemin ; épais au milieu, effilé aux deux bouts
    const s0 = t * 0.012;
    for (let i = 0; i < LONG; i++) {
      longAt(s0 - i * 0.0075, t, a3); longAt(s0 - i * 0.0075 + 0.003, t, b3);
      const w = 9 * Math.sin(Math.PI * Math.min(1, (i + 4) / (LONG + 4))) ** 0.6 + 1, und = Math.sin(t * 1.3 - i * 0.25) * 3;
      a3.y += und; b3.y += Math.sin(t * 1.3 - (i - 0.4) * 0.25) * 3;
      m4.lookAt(b3, a3, s3.set(0, 1, 0)); q.setFromRotationMatrix(m4);
      longM.setMatrixAt(i, m4.compose(a3, q, s3.set(w, w, 4.2)));
      dots.setMatrixAt(i, m4.compose(p3.set(i % 2 ? w * 0.7 : -w * 0.7, w * 0.4, 0).applyQuaternion(q).add(a3), q, s3.setScalar(i % 3 ? 0 : 1 + w * 0.06)));
      if (i % 30 === 0) live.long[i / 30] = a3.clone();
    }
    longM.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true;
    sn0.forEach(([x, y, z, ph, s], i) => {
      const X = hero.x + ((x + Math.sin(t * 0.2 + ph) * 3 + 60) % 120 + 120) % 120 - 60, Z = hero.z + ((z + t * 0.6 + 60) % 120 + 120) % 120 - 60, Y = hero.y + ((y - t * 0.5 + 20) % 60 + 60) % 60 - 20;
      snow.setMatrixAt(i, m4.compose(p3.set(X, Y, Z), q.setFromEuler(e3.set(0, t * 0.3 + ph, 0)), s3.setScalar(s)));
    });
    snow.instanceMatrix.needsUpdate = true;
    live.heart.material.uniforms.uAlpha.value = gates.fosse ? 0.22 + Math.max(0, Math.sin(t * 2.6)) ** 6 * 0.3 : 0.04;
  };
  const start = spawn();
  // l'histoire : le Plongeur, ses fenêtres allumées, le souffle et les cloches de nacre, la Fosse
  const story = createStory(scene, { floorAt, PL, windows: WINDOWS, bells: BELLS, fosse: FOSSE, lidY: LID_Y, gates, dark: DARK, surf: SURF, start, long: live.long, ui: ctx.ui, hero: ctx.hero }), base = live.update;
  live.colliders.push(...story.colliders);
  const pit = abyss(scene, { x: FOSSE.x, z: FOSSE.z, R: FOSSE.R + 2, floorAt, depth: 260, wall: ['#2f6a70', '#05121a'], mist: '#ff5a3a' }); // la Fosse : une gorge qui rougeoie
  return Object.assign(live, {
    look: LOOK, terrain, start, spheres, swim: { surface: SURF }, hint: 'Sous l’eau : la souris choisit la direction · Espace remonte · X descend · Maj nage vite',
    camYaw: Math.atan2(start[0] - story.debug.plongeur.position.x, start[2] - story.debug.plongeur.position.z),
    exitAt, killY: () => LID_Y - 10, interact: story.interact, story,
    update(t, p) { base(t, p); story.update(t, p); pit.update(t); },
  });
}
