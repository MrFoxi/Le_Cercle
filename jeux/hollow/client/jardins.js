// THE HOLLOW — Strate 01, les Jardins suspendus. Tout est modelé ici par le code : aucun modèle, aucune texture importés.
// Arbres courbés vers le puits, ombrelles de verre qui colorent le sol, arches de roche, îles suspendues à leurs
// racines, cascades, touffes d'herbe, Semeurs qui dérivent, et le Jardinier, debout sur la crête, qui regarde.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrain, heightAt, fbm, noise, rampAngle, spawn, R_ABYSS, R_WALL, TERRACE } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';

const TAU = Math.PI * 2;
export const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ---------- Outils de modelage ---------- */
// peint une forme : dégradé de la base (b) au sommet (a), taches douces
function paint(g, a, b = a, jit = 0.06) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox, span = max.y - min.y || 1, p = g.attributes.position, col = new Float32Array(p.count * 3);
  const A = new THREE.Color(a), B = new THREE.Color(b), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(B).lerp(A, (p.getY(i) - min.y) / span).offsetHSL(0, 0, (noise(p.getX(i) * 0.9 + 3, p.getZ(i) * 0.9 + p.getY(i) * 0.7) - 0.5) * jit * 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const clean = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
const merge = gs => mergeGeometries(gs.map(clean));
// une boule bosselée (feuillage, rochers) : top coupe le dessus à plat
function lump(r, { sx = 1, sy = 1, sz = 1, lumpy = 0.25, seed = 1, detail = 3, top = null } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = r * (1 + (fbm(x * 1.7 + seed * 7.3, y * 1.7 + z * 1.3 + seed) - 0.5) * 2 * lumpy);
    p.setXYZ(i, x * n * sx, top !== null ? Math.min(top, y * n * sy) : y * n * sy, z * n * sz);
  }
  g.computeVertexNormals();
  return g;
}
// une tige qui s'affine le long d'une courbe (troncs, branches, racines, tentacules)
function tube(pts, r0, r1 = r0, radial = 8, seg = 16) {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c); const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}
const cast = o => { o.layers.enable(1); return o; }; // ce qui porte une ombre

/* ---------- Le sol ---------- */
function ground(seg) {
  const S = 920, g = new THREE.PlaneGeometry(S, S, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, idx = g.index.array, keep = [];
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  // on retire les triangles du gouffre
  for (let i = 0; i < idx.length; i += 3) if (p.getY(idx[i]) > -100 && p.getY(idx[i + 1]) > -100 && p.getY(idx[i + 2]) > -100) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep); g.computeVertexNormals();
  return g;
}
// la lèvre du gouffre : une falaise qui plonge dans la brume
function abyssWall() {
  const n = 160, P = [], I = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let r = R_ABYSS - 1; while (r < R_ABYSS + 20 && terrain(Math.cos(a) * r, Math.sin(a) * r).kind === 'void') r += 0.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
    for (const [k, dy] of [[0, 0], [1, -40], [0.96, -120], [0.9, -260]]) { const w = (noise(i * 0.3, dy) - 0.5) * 6; P.push(x * (k || 1) + Math.cos(a) * w, h + dy, z * (k || 1) + Math.sin(a) * w); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j, b = (i + 1) * 4 + j; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  return paint(g, '#a8aeb8', '#5a6478', 0.1);
}

/* ---------- Les êtres et les choses ---------- */
const LEAVES = [['#5fbf86', '#2f7a5a'], ['#7fd6b8', '#3a8a78'], ['#9be08a', '#4a9a5a'], ['#6ac8c8', '#2f7a88']];
// un arbre au tronc courbé : il penche vers +x (on le tourne vers le puits à la pose)
function tree(seed, giant = false) {
  const r = rng(seed), H = (16 + r() * 22) * (giant ? 2.6 : 1), lean = (4 + r() * 10) * (giant ? 2 : 1), K = [], leaf = LEAVES[seed % LEAVES.length];
  const top = [lean, H, (r() - 0.5) * 4];
  K.push(paint(tube([[0, -1, 0], [lean * 0.05, H * 0.3, 0], [lean * 0.45, H * 0.7, top[2] * 0.3], top], 1.0 + H * 0.03, 0.35, 9, 22), '#c8b8a0', '#6a5a52', 0.12));
  // racines qui s'agrippent au sol
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + r(); K.push(paint(tube([[0, 1.5, 0], [Math.cos(a) * 1.8, 0.4, Math.sin(a) * 1.8], [Math.cos(a) * 3.2, -0.6, Math.sin(a) * 3.2]], 0.45, 0.1, 6, 6), '#a89a88', '#6a5a52')); }
  const n = 3 + Math.floor(r() * 4), ends = [top];
  for (let k = 0; k < n; k++) {
    const t = 0.45 + r() * 0.45, a = r() * TAU, len = (4 + r() * 7) * (giant ? 2 : 1), sx = lean * t * t, sy = H * t;
    const e = [sx + Math.cos(a) * len, sy + len * (0.35 + r() * 0.5), Math.sin(a) * len];
    K.push(paint(tube([[sx, sy, 0], [sx + Math.cos(a) * len * 0.5, sy + len * 0.15, Math.sin(a) * len * 0.5], e], 0.45, 0.15, 6, 8), '#b8a890', '#7a6a5a'));
    ends.push(e);
  }
  for (const [i, e] of ends.entries()) {
    const big = i === 0 ? 1.4 : 1;
    for (let k = 0; k < 3; k++) K.push(paint(lump((3 + r() * 3) * big * (giant ? 2 : 1), { sy: 0.7, lumpy: 0.3, seed: seed * 11 + i * 3 + k, detail: 3 }).translate(e[0] + (r() - 0.5) * 4, e[1] + r() * 2, e[2] + (r() - 0.5) * 4), ...leaf, 0.1));
  }
  return merge(K);
}
// une ombrelle de verre : tige, pétales translucides, cœur qui luit
const PETAL = ['#ffd6e8', '#d8f6ff', '#fff2c0', '#e8dcff', '#c8ffe8'];
function umbrella(seed) {
  const r = rng(seed), H = 9 + r() * 16, bend = (r() - 0.5) * 5, R = 4 + H * 0.28, col = PETAL[seed % PETAL.length];
  const stem = paint(tube([[0, -0.5, 0], [bend * 0.3, H * 0.4, 0], [bend, H * 0.85, bend * 0.2], [bend, H, 0]], 0.5 + H * 0.02, 0.3, 8, 18), '#8fd6a0', '#3f8a5a');
  const P = [];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.PlaneGeometry(R * 0.75, R, 6, 10), q = g.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i) + R / 2, t = y / R; q.setXYZ(i, x * Math.sin(Math.PI * Math.min(1, t * 1.1)) * 1.1, Math.sin(t * Math.PI) * R * 0.25 - t * t * R * 0.35, y); }
    g.rotateY((k / 6) * TAU + r() * 0.2); g.translate(bend, H, 0); g.computeVertexNormals();
    P.push(paint(g, col, new THREE.Color(col).offsetHSL(0.02, 0.1, -0.12).getStyle(), 0.05));
  }
  const heart = paint(lump(0.9 + H * 0.03, { detail: 2, lumpy: 0.2, seed }).translate(bend, H + 0.6, 0), '#fff8c0', '#ffd860');
  return { stem, petals: merge(P), heart, top: [bend, H, 0], R, col };
}
// un Semeur : petit Flottant (cloche pâle, filaments)
function seeder() {
  const bell = new THREE.LatheGeometry([[0.01, 0.5], [0.35, 0.45], [0.5, 0.2], [0.48, 0], [0.3, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const K = [paint(bell, '#ffffff', '#cfefff', 0.02)];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; K.push(paint(tube([[Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3], [Math.cos(a) * 0.35, -0.8, Math.sin(a) * 0.35], [Math.cos(a) * 0.2, -1.8, Math.sin(a) * 0.2]], 0.03, 0.01, 4, 6), '#e8f8ff')); }
  return merge(K).translate(0, 1.8, 0); // les filaments ondulent (le vent souffle plus en haut : on les met en haut)
}
// le Jardinier : une silhouette immense et maigre, debout sur la crête ; on ne le voit que de loin
function gardener() {
  const K = [paint(tube([[0, 0, 0], [0.5, 22, 0], [-0.5, 46, 0.5], [0, 60, 0]], 2.4, 1.4, 8, 20), '#2a2838', '#1a1828')];
  K.push(paint(lump(3.2, { sy: 1.4, lumpy: 0.1, detail: 2 }).translate(0, 64, 0), '#2a2838', '#1a1828'));
  for (const s of [-1, 1]) K.push(paint(tube([[s * 1.8, 56, 0], [s * 6, 40, 2], [s * 7, 22, 4], [s * 6.5, 10, 6]], 0.9, 0.4, 6, 14), '#2a2838', '#1a1828'));
  K.push(paint(tube([[-7, 10, 6], [-8, 2, 9], [-7.5, -6, 12]], 0.3, 0.1, 5, 6), '#5a5868')); // l'outil : une lame fine, trop longue
  return merge(K);
}

/* ---------- La strate ---------- */
export function buildJardins(scene, Q) {
  const live = { anim: [], colliders: [], seeders: [], islands: [] };
  const r = rng(2026);
  // le ciel du puits
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  // le sol, la lèvre du gouffre
  scene.add(cast(new THREE.Mesh(ground(Q.terrain), ink({ kind: 'terrain', vertexColors: false }))));
  scene.add(cast(new THREE.Mesh(abyssWall(), ink({ line: 1 }))));
  // l'anneau du puits : la voûte de roche autour de l'ouverture, très haut
  {
    const g = new THREE.TorusGeometry(330, 70, 18, 120); g.rotateX(Math.PI / 2); g.scale(1.25, 0.6, 1.25);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 0.01 + 4, z * 0.01 + y * 0.02); p.setXYZ(i, x * (1 + (n - 0.5) * 0.12), y + (n - 0.5) * 40, z * (1 + (n - 0.5) * 0.12)); }
    g.computeVertexNormals(); g.translate(0, 330, 0);
    scene.add(new THREE.Mesh(paint(g, '#8a9aa8', '#3a4458', 0.15), ink({ line: 0.9 })));
  }
  // arbres : quelques modèles, beaucoup d'exemplaires, tous penchés vers le puits
  const kinds = Array.from({ length: 7 }, (_, k) => tree(k * 31 + 7, k >= 5)), spots = kinds.map(() => []);
  const [sx0, , sz0] = spawn(), clear = (x, z, d) => (x - sx0) ** 2 + (z - sz0) ** 2 > d * d; // le départ reste dégagé : on y voit loin
  for (let tries = 0; tries < 4000 && spots.flat().length < Q.trees; tries++) {
    const a = r() * TAU, d = R_ABYSS + 8 + r() * (R_WALL - R_ABYSS - 12), x = Math.cos(a) * d, z = Math.sin(a) * d, t = terrain(x, z);
    if (t.kind !== 'ground' || t.ramp > 0.2 || !clear(x, z, 30)) continue;
    const slope = Math.abs(heightAt(x + 2, z) - t.h) + Math.abs(heightAt(x, z + 2) - t.h);
    if (slope > 1.2) continue;
    spots[spots.flat().length % 4 === 3 ? 5 + (tries % 2) : tries % 5].push([x, t.h, z, a + Math.PI, 0.7 + r() * 0.6]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  kinds.forEach((g, k) => {
    if (!spots[k].length) return;
    const im = new THREE.InstancedMesh(g, ink({ line: 0.85, wind: 0.004 }), spots[k].length);
    spots[k].forEach(([x, y, z, ry, s], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ry); im.setMatrixAt(i, m4.compose(p3.set(x, y, z), q, s3.setScalar(s))); live.colliders.push([x, z, 1.4 * s]); });
    scene.add(cast(im));
  });
  // ombrelles de verre, et la tache de couleur que leur lumière pose au sol
  for (let k = 0; k < Q.umbrellas; k++) {
    let x, z, t;
    for (let n = 0; n < 50; n++) { const a = r() * TAU, d = R_ABYSS + 10 + r() * 240; x = Math.cos(a) * d; z = Math.sin(a) * d; t = terrain(x, z); if (t.kind === 'ground' && t.ramp < 0.2 && clear(x, z, 20)) break; }
    const u = umbrella(k * 13 + 5), g = new THREE.Group();
    g.add(cast(new THREE.Mesh(u.stem, ink({ line: 0.8, wind: 0.002 }))));
    g.add(cast(new THREE.Mesh(u.petals, ink({ line: 0.55, trans: 0.9, side: THREE.DoubleSide, wind: 0.003 }))));
    g.add(new THREE.Mesh(u.heart, ink({ line: 0.4, glow: 0.6 })));
    const ry = r() * TAU; g.position.set(x, t.h, z); g.rotation.y = ry; scene.add(g);
    live.colliders.push([x, z, 0.8]);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(u.R * 1.3, 32).rotateX(-Math.PI / 2), glowy({ color: u.col, alpha: 0.32, add: true }));
    const off = new THREE.Vector3(u.top[0], 0, u.top[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).addScaledVector(U.uSunDir.value, -u.top[1] / U.uSunDir.value.y).setY(0);
    patch.position.set(x + off.x, heightAt(x + off.x, z + off.z) + 0.15, z + off.z); scene.add(patch);
  }
  // rochers et blocs au pied des falaises
  {
    const g = paint(lump(1, { lumpy: 0.35, detail: 2, seed: 4 }), '#c8ccd0', '#6a7280', 0.12), list = [];
    for (let tries = 0; tries < 3000 && list.length < Q.rocks; tries++) {
      const a = r() * TAU, d = R_ABYSS + 4 + r() * (R_WALL - R_ABYSS), x = Math.cos(a) * d, z = Math.sin(a) * d, t = terrain(x, z);
      if (t.kind !== 'void' && clear(x, z, 16)) list.push([x, t.h, z, 0.6 + r() * r() * 5]);
    }
    const im = new THREE.InstancedMesh(g, ink({ line: 1 }), list.length);
    list.forEach(([x, y, z, s], i) => { q.setFromEuler(new THREE.Euler(r(), r() * TAU, r())); im.setMatrixAt(i, m4.compose(p3.set(x, y + s * 0.2, z), q, s3.set(s, s * 0.7, s))); if (s > 1.5) live.colliders.push([x, z, s * 0.8]); });
    scene.add(cast(im));
  }
  // arches de roche jetées au-dessus des terrasses
  for (let k = 0; k < 5; k++) {
    const a = rampAngle(k) + 1.1 + r(), d0 = R_ABYSS + TERRACE * (k + 0.5), d1 = d0 + TERRACE * 1.6, a1 = a + 0.25;
    const A = [Math.cos(a) * d0, 0, Math.sin(a) * d0], B = [Math.cos(a1) * d1, 0, Math.sin(a1) * d1];
    A[1] = heightAt(A[0], A[2]) - 2; B[1] = heightAt(B[0], B[2]) - 2;
    const top = Math.max(A[1], B[1]) + 26 + r() * 20, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * (top - Math.max(A[1], B[1])), A[2] + (B[2] - A[2]) * t]); }
    const g = tube(pts, 6, 4.5, 12, 48), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 0.08, p.getZ(i) * 0.08 + p.getY(i) * 0.08) - 0.5; p.setXYZ(i, p.getX(i) + n * 3, p.getY(i) + n * 3, p.getZ(i) + n * 3); }
    g.computeVertexNormals();
    scene.add(cast(new THREE.Mesh(paint(g, '#b8c0c4', '#6a7484', 0.14), ink({ line: 1 }))));
    // de la mousse et des lianes qui pendent de l'arche
    const V = [];
    for (let i = 2; i < 11; i++) { const c = pts[i]; if (r() < 0.6) V.push(paint(tube([[c[0], c[1] - 4, c[2]], [c[0] + 0.5, c[1] - 9 - r() * 6, c[2]], [c[0], c[1] - 14 - r() * 12, c[2] + 0.5]], 0.25, 0.08, 5, 8), '#7fc89a', '#3f8a5a')); }
    if (V.length) scene.add(new THREE.Mesh(merge(V), ink({ line: 0.5, wind: 0.02 })));
  }
  // îles suspendues au-dessus du gouffre et dans le puits, chacune avec ses racines et son arbre
  for (let k = 0; k < Q.islands; k++) {
    const a = r() * TAU, d = k < 4 ? 20 + r() * 40 : 140 + r() * 160, y = k < 4 ? 20 + r() * 50 : 110 + r() * 150, s = 4 + r() * 8;
    const K = [paint(lump(1, { sx: s, sy: s * 1.6, sz: s, top: 0.05, lumpy: 0.3, seed: k + 50, detail: 3 }), '#a8b0b8', '#4a5468', 0.12)];
    K.push(paint(lump(1, { sx: s * 1.05, sy: 0.6, sz: s * 1.05, lumpy: 0.15, seed: k + 90, detail: 3 }), '#7fd090', '#4a9a5a'));
    for (let i = 0; i < 6; i++) { const b = r() * TAU, rr = s * 0.6 * r(); K.push(paint(tube([[Math.cos(b) * rr, -s * 0.8, Math.sin(b) * rr], [Math.cos(b) * rr * 1.2, -s * 1.6 - r() * 6, Math.sin(b) * rr * 1.2], [Math.cos(b) * rr * 0.8, -s * 2.4 - r() * 14, Math.sin(b) * rr * 0.8]], 0.4, 0.06, 5, 10), '#8a7a6a', '#5a4a42')); }
    K.push(tree(k * 7 + 3).scale(0.35, 0.35, 0.35).translate(0, 0.3, 0));
    const isl = cast(new THREE.Mesh(merge(K), ink({ line: 0.9 })));
    isl.position.set(Math.cos(a) * d, y, Math.sin(a) * d); isl.rotation.y = r() * TAU; scene.add(isl);
    live.islands.push([isl, y, r() * TAU]);
  }
  // cascades : elles sortent de la paroi et tombent sur les terrasses ; brume au pied
  for (let k = 0; k < Q.falls; k++) {
    const a = (k / Q.falls) * TAU + r() * 0.4, r0 = R_WALL + 2, x = Math.cos(a) * r0, z = Math.sin(a) * r0, y0 = heightAt(Math.cos(a) * (R_WALL - 6), Math.sin(a) * (R_WALL - 6));
    const top = y0 + 60 + r() * 60, w = 5 + r() * 9, g = new THREE.PlaneGeometry(w, top - y0, 1, 1);
    g.translate(0, (top + y0) / 2, 0);
    const m = new THREE.Mesh(g, ink({ kind: 'water', line: 0.35, side: THREE.DoubleSide, vertexColors: false })); m.position.set(x, 0, z); m.rotation.y = -a + Math.PI / 2; scene.add(m);
    for (let i = 0; i < 4; i++) { const mist = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, w * 2), glowy({ color: '#ffffff', alpha: 0.5 })); mist.position.set(Math.cos(a) * (r0 - 4 - i * 2), y0 + 2 + i * 2.5, Math.sin(a) * (r0 - 4 - i * 2)); mist.rotation.y = -a + Math.PI / 2 + (i - 1.5) * 0.4; scene.add(mist); }
  }
  // l'herbe : des touffes, chacune faite de brins instanciés (le vent les fait onduler)
  {
    const P = [], C = [], tip = new THREE.Color('#d8f8b0'), root = new THREE.Color('#2f7a4a');
    for (let s = 0; s <= 4; s++) { const t = s / 4, w = 0.07 * (1 - t); P.push(-w, t, t * t * 0.25, w, t, t * t * 0.25); const c = root.clone().lerp(tip, t); C.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    const I = []; for (let s = 0; s < 4; s++) I.push(s * 2, s * 2 + 1, s * 2 + 2, s * 2 + 1, s * 2 + 3, s * 2 + 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(10 * 2), 2));
    const im = new THREE.InstancedMesh(g, ink({ line: 0.12, wind: 0.22, side: THREE.DoubleSide }), Q.grass), tint = new THREE.Color();
    let n = 0;
    while (n < Q.grass) {
      const a = r() * TAU, d = R_ABYSS + 3 + r() * (R_WALL - R_ABYSS), cx = Math.cos(a) * d, cz = Math.sin(a) * d, t = terrain(cx, cz);
      if (t.kind !== 'ground' || Math.abs(heightAt(cx + 1, cz) - t.h) > 0.5) continue;
      const big = 0.7 + r() * 1.1, hue = r();
      for (let k = 0; k < 40 && n < Q.grass; k++, n++) {
        const x = cx + (r() - 0.5) * 3, z = cz + (r() - 0.5) * 3, h = (0.5 + r() * 0.9) * big;
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.4));
        im.setMatrixAt(n, m4.compose(p3.set(x, heightAt(x, z) - 0.05, z), q, s3.set(1 + r(), h, 1)));
        im.setColorAt(n, tint.setHSL(0.36 + hue * 0.1, 0.38, 0.3 + r() * 0.12).multiplyScalar(1.7));
      }
    }
    scene.add(im); live.grass = im;
  }
  // les Semeurs : ils dérivent lentement d'une terrasse à l'autre, sans se soucier du joueur
  {
    const g = seeder(), mat = ink({ line: 0.4, trans: 0.6, glow: 0.25, wind: 0.08 });
    for (let k = 0; k < Q.seeders; k++) {
      const m = new THREE.Mesh(g, mat), a = r() * TAU, d = R_ABYSS + 20 + r() * 230;
      m.scale.setScalar(0.8 + r() * 1.4); scene.add(m);
      live.seeders.push({ m, a, d, h: 3 + r() * 10, sp: (r() - 0.5) * 0.02, ph: r() * TAU });
    }
  }
  // le Jardinier, sur la crête, face au puits
  {
    const a = Math.PI * 0.85, d = R_WALL + 34, x = Math.cos(a) * d, z = Math.sin(a) * d, m = new THREE.Mesh(gardener(), ink({ line: 0.7 }));
    m.position.set(x, heightAt(x, z) - 4, z); m.rotation.y = -a - Math.PI / 2; scene.add(m); live.gardener = m;
  }
  // animer : îles qui flottent, Semeurs qui dérivent, le Jardinier qui tourne la tête vers le joueur (lentement)
  live.update = (t, hero) => {
    for (const [isl, y, ph] of live.islands) { isl.position.y = y + Math.sin(t * 0.25 + ph) * 1.6; isl.rotation.z = Math.sin(t * 0.2 + ph) * 0.02; }
    for (const s of live.seeders) {
      s.a += s.sp * 0.016; const x = Math.cos(s.a) * s.d + Math.sin(t * 0.3 + s.ph) * 6, z = Math.sin(s.a) * s.d + Math.cos(t * 0.27 + s.ph) * 6;
      s.m.position.set(x, Math.max(heightAt(x, z), -20) + s.h + Math.sin(t * 0.9 + s.ph) * 0.8, z); s.m.rotation.y = t * 0.2 + s.ph;
    }
    const g = live.gardener, want = Math.atan2(hero.x - g.position.x, hero.z - g.position.z);
    g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.002;
  };
  return live;
}
