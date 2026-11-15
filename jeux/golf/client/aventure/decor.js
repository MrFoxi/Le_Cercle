// Mini-golf, mode Aventure : le décor de la Tour, modelé ici à la main (aucun modèle repris d'ailleurs).
// Une seule identité : un monde en pâte à modeler peinte. Tout est un peu bosselé, rien n'est tout à fait droit ;
// chaque volume porte son dégradé (plus sombre en bas, comme une ombre douce) et ses taches de couleur.
// Les pièces d'un même objet sont fondues en un seul maillage (rapide, même avec beaucoup de décor).
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

/* ---------- Hasard reproductible et bruit doux (même valeur pour une même position : les voisins se raccordent) ---------- */
export const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (x, y, z) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440670441)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t), mix = (a, b, k) => a + (b - a) * k;
export function noise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = sm(x - X), v = sm(y - Y), w = sm(z - Z), c = (i, j, k) => hash(X + i, Y + j, Z + k);
  return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v), mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export const fbm = (x, y, z) => noise(x, y, z) * 0.62 + noise(x * 2.3 + 17, y * 2.3, z * 2.3) * 0.38;

/* ---------- Matières : la couleur est peinte dans les sommets ---------- */
export const MAT = {
  clay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
  shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45 }),
  stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  cloud: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 }),
  water: new THREE.MeshStandardMaterial({ color: '#8fe0f4', roughness: 0.08, emissive: '#4fb8d8', emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ color: '#e8f8ff', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
};
export const glow = (c, k = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 });

/* ---------- Formes de base ---------- */
// Peint une forme : dégradé du bas (b) vers le haut (a), et taches douces
export function paint(g, [a, b = a], jit = 0.05) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox, span = max.y - min.y || 1, p = g.attributes.position, col = new Float32Array(p.count * 3);
  const A = new THREE.Color(a), B = new THREE.Color(b), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    c.copy(B).lerp(A, Math.pow((y - min.y) / span, 0.8)).offsetHSL(0, 0, (fbm(x * 2.2, y * 2.2, z * 2.2) - 0.5) * jit * 2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Une pièce : tournée, posée, puis peinte
const pc = (g, cols, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, jit) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  return paint(g.translate(x, y, z), cols, jit);
};
// Boule bosselée (feuillage, pierres, nuages, sacs) : sx, sy, sz l'étirent ; top coupe le dessus à plat
export function blob(r, { lump = 0.2, sx = 1, sy = 1, sz = 1, seed = 1, detail = 3, freq = 1.6, top = null } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = r * (1 + (fbm(x * freq + seed * 7.13, y * freq + seed, z * freq) - 0.5) * 2 * lump);
    p.setXYZ(i, x * n * sx, top !== null ? Math.min(top, y * n * sy) : y * n * sy, z * n * sz);
  }
  g.computeVertexNormals();
  return g;
}
// Tige qui s'affine le long d'une courbe (troncs, branches, cordes, lianes)
export function stem(pts, r0, r1 = r0, radial = 7, seg = 12) {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c); const r = mix(r0, r1, i / seg);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}
// Pièce tournée (vases, socles, lampes, tuyaux) : profil [rayon, hauteur]
export const turned = (prof, seg = 22) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg);
// Pavé aux arêtes douces (livres, maisons, poutres)
export function soft(w, h, d, b = 0.08) {
  b = Math.min(b, w / 3, h / 3, d / 3);
  const s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b, r = Math.min(x, y) * 0.5;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
  return g.translate(0, 0, -(d - 2 * b) / 2);
}
// Roue dentée découpée, avec ses jours
export function gearGeo(R, n, depth) {
  const s = new THREE.Shape(), ri = R * 0.82, st = TAU / n;
  for (let k = 0; k < n; k++) {
    const a = k * st;
    for (const [rr, f] of [[ri, 0], [R, 0.2], [R, 0.5], [ri, 0.7]]) { const q = [Math.cos(a + f * st) * rr, Math.sin(a + f * st) * rr]; k || f ? s.lineTo(...q) : s.moveTo(...q); }
  }
  const hole = (x, y, r) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, TAU, true); s.holes.push(h); };
  hole(0, 0, R * 0.14);
  for (let k = 0; k < 5; k++) hole(Math.cos(k * TAU / 5) * R * 0.5, Math.sin(k * TAU / 5) * R * 0.5, R * 0.16);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -depth / 2);
}
// Fond les pièces en un seul maillage
export function fuse(parts) {
  const gs = parts.map(g => {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    return g;
  });
  return mergeGeometries(gs);
}
export const mesh = (g, m = MAT.clay, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const group = (...o) => { const g = new THREE.Group(); g.add(...o); return g; };

/* ---------- Le vivant : arbres, buissons, fleurs, champignons, rochers ---------- */
const LEAF = ['#a8e27c', '#3f9a4a'], BARK = ['#9a6a42', '#5a3a22'];
const PETALS = ['#ff8fb0', '#ffd84a', '#ffffff', '#b89cff', '#ff9a5a', '#7fc8ff'];
function treeParts(seed, { h = 3.4, leaf = LEAF, bark = BARK, blossom = null, s = 1 } = {}) {
  const r = rng(seed), K = [], lean = (r() - 0.5) * 0.8 * s, tw = (r() - 0.5) * 0.5 * s, tip = [lean, h * s, tw];
  K.push(pc(stem([[0, -0.3, 0], [lean * 0.15, h * s * 0.35, 0], [lean * 0.6, h * s * 0.72, tw * 0.5], tip], 0.3 * s, 0.13 * s), bark));
  for (let k = 0; k < 2; k++) {
    const a = r() * TAU, y0 = h * s * (0.5 + r() * 0.2), x0 = lean * y0 / (h * s);
    K.push(pc(stem([[x0, y0, 0], [x0 + Math.cos(a) * 0.6 * s, y0 + 0.45 * s, Math.sin(a) * 0.6 * s], [x0 + Math.cos(a) * 1.1 * s, y0 + 1.1 * s, Math.sin(a) * 1.1 * s]], 0.1 * s, 0.05 * s, 5, 6), bark));
  }
  const n = 4 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + r(), d = k ? (0.9 + r() * 0.5) * s : 0, rr = (k ? 0.85 + r() * 0.5 : 1.45) * s;
    K.push(pc(blob(rr, { seed: seed * 13 + k, lump: 0.22 }), leaf, tip[0] + Math.cos(a) * d, tip[1] + (k ? -0.25 + r() * 0.8 : 0.55) * s, tip[2] + Math.sin(a) * d));
  }
  if (blossom) for (let k = 0; k < 14; k++) { const a = r() * TAU, e = r() * 1.2; K.push(pc(blob(0.16 * s, { detail: 1, seed: k }), [blossom, blossom], tip[0] + Math.cos(a) * Math.cos(e) * 1.7 * s, tip[1] + 0.4 * s + Math.sin(e) * 1.4 * s, tip[2] + Math.sin(a) * Math.cos(e) * 1.7 * s)); }
  return K;
}
export const tree = (seed, o) => mesh(fuse(treeParts(seed, o)));
function bushParts(seed, s = 1, leaf = LEAF, flowers = null) {
  const r = rng(seed), K = [], n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const a = r() * TAU, d = k ? 0.5 * s : 0; K.push(pc(blob((0.55 + r() * 0.35) * s, { seed: seed + k * 3, lump: 0.25, sy: 0.8 }), leaf, Math.cos(a) * d, 0.35 * s, Math.sin(a) * d)); }
  if (flowers) for (let k = 0; k < 7; k++) { const a = r() * TAU; K.push(pc(blob(0.09 * s, { detail: 1 }), [flowers], Math.cos(a) * 0.75 * s, (0.5 + r() * 0.5) * s, Math.sin(a) * 0.75 * s)); }
  return K;
}
function flowerParts(seed, x, z, color) {
  const r = rng(seed), K = [], h = 0.35 + r() * 0.35, bx = x + (r() - 0.5) * 0.15, bz = z + (r() - 0.5) * 0.15;
  K.push(pc(stem([[x, 0, z], [mix(x, bx, 0.5), h * 0.6, mix(z, bz, 0.5)], [bx, h, bz]], 0.025, 0.018, 4, 4), ['#5aa848', '#3c7a34']));
  K.push(pc(blob(0.12, { sy: 0.35, sx: 1.4, detail: 1, seed }), ['#6fbf58', '#3c7a34'], x + 0.1, 0.12, z, 0, r() * TAU, 0));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; K.push(pc(blob(0.075, { sy: 0.35, detail: 1, seed: k }), [color, color], bx + Math.cos(a) * 0.09, h, bz + Math.sin(a) * 0.09)); }
  K.push(pc(blob(0.05, { detail: 1 }), ['#ffe066', '#e0a020'], bx, h + 0.03, bz));
  return K;
}
function mushroomParts(seed, x, z, s = 1) {
  const r = rng(seed), K = [], h = (0.35 + r() * 0.3) * s, tilt = (r() - 0.5) * 0.4;
  K.push(pc(turned([[0.08 * s, 0], [0.1 * s, 0.05], [0.07 * s, h * 0.6], [0.08 * s, h]], 10), ['#fff8ec', '#e8dcc8'], x, 0, z, 0, 0, tilt));
  K.push(pc(blob(0.24 * s, { sy: 0.6, top: null, lump: 0.1, seed, detail: 2 }), ['#ff6a5a', '#c83a3a'], x + Math.sin(-tilt) * h, h, z));
  for (let k = 0; k < 4; k++) { const a = r() * TAU; K.push(pc(blob(0.035 * s, { detail: 1 }), ['#ffffff'], x + Math.sin(-tilt) * h + Math.cos(a) * 0.14 * s, h + 0.1 * s, z + Math.sin(a) * 0.14 * s)); }
  return K;
}
export const rock = (r, seed, cols = ['#d8d0c4', '#9a9080'], o = {}) => mesh(paint(blob(r, { detail: 1, lump: 0.35, seed, ...o }), cols, 0.1), MAT.stone);

/* ---------- Nuages, îles volantes ---------- */
export function cloud(seed, s = 1) {
  const r = rng(seed), K = [], n = 5 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) { const rr = 1.3 + r() * 1.3 - Math.abs(k - n / 2) * 0.2; K.push(pc(blob(rr, { seed: seed * 7 + k, lump: 0.14, sy: 0.75, detail: 2 }), ['#ffffff', '#c6cff0'], (k - n / 2) * 1.35 + r() * 0.6, rr * 0.25, (r() - 0.5) * 1.6)); }
  const m = mesh(fuse(K), MAT.cloud, false); m.scale.setScalar(s); return m;
}
export function island(seed, s = 1) {
  const r = rng(seed), K = [];
  K.push(pc(blob(1, { sx: 2.2, sy: 2.6, sz: 2.2, top: 0, lump: 0.3, seed, detail: 2 }), ['#b08060', '#6a5070'], 0, 0, 0));
  K.push(pc(blob(1, { sx: 2.35, sy: 0.35, sz: 2.35, lump: 0.12, seed: seed + 1, detail: 2 }), ['#9be07a', '#5aa848'], 0, 0.05, 0));
  if (r() < 0.75) K.push(...treeParts(seed + 5, { s: 0.45, blossom: r() < 0.4 ? '#ffb0d0' : null }).map(g => g.translate(r() - 0.5, 0.1, r() - 0.5)));
  else K.push(...mushroomParts(seed, 0.4, 0.2, 1.6), ...mushroomParts(seed + 2, -0.5, -0.3, 1.1));
  const m = mesh(fuse(K)); m.scale.setScalar(s); return m;
}

/* ---------- Petites choses semées au sol (instanciées) ---------- */
function tuftGeo() {
  const P = [], C = [], r = rng(5), base = new THREE.Color('#3f8a3a'), tip = new THREE.Color('#d8f0a0');
  for (let k = 0; k < 7; k++) {
    const a = r() * TAU, d = r() * 0.12, h = 0.22 + r() * 0.22, w = 0.035, bend = 0.08 + r() * 0.1, x = Math.cos(a) * d, z = Math.sin(a) * d, ca = Math.cos(a + 1.57), sa = Math.sin(a + 1.57);
    P.push(x - ca * w, 0, z - sa * w, x + ca * w, 0, z + sa * w, x + Math.cos(a) * bend, h, z + Math.sin(a) * bend);
    C.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
  return g;
}
const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
function instanced(geo, mat, items, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)), o = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => { o.position.set(...it.p); o.rotation.set(it.rx || 0, it.ry || 0, 0); o.scale.setScalar(it.s || 1); if (it.sy) o.scale.y *= it.sy; o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(it.c || '#ffffff')); });
  m.count = items.length; m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

/* ---------- Le décor de chaque monde ---------- */
// ctx : { L, put(o, p, s, ry), world(w), live, text(str, size, color), fall(x, y, z, h, w), LIGHT, worldOf }
export function decorate(ctx) {
  const { L, put, live, text, fall, LIGHT, worldOf } = ctx;
  for (const dd of L.deco) {
    const p = dd.p;
    ctx.world(worldOf(dd.t === 'upsidehouse' ? p[1] - 2 : dd.t === 'wheel' ? p[1] - 6 : dd.t === 'trebuchet' ? p[1] - 4 : p[1]));
    const seed = Math.round(p[0] * 31 + p[1] * 17 + p[2] * 7) + 1000;
    switch (dd.t) {
      case 'tee': {
        const K = [pc(soft(2.6, 0.12, 2.6, 0.05), ['#7fd062', '#5aa848'], 0, 0, 0)];
        for (const s of [-1, 1]) K.push(pc(turned([[0.06, 0], [0.06, 0.2], [0.24, 0.26], [0.22, 0.38], [0, 0.42]], 14), ['#ff7a8a', '#d8405a'], s * 1.6, 0, 0));
        put(mesh(fuse(K)), p); break;
      }
      case 'flowerbed': {
        const r = rng(seed), K = [pc(blob(1.6, { sy: 0.18, sz: 0.75, top: 0.12, lump: 0.1, seed }), ['#8a5a3a', '#5a3a22'], 0, 0, 0)];
        const c1 = PETALS[seed % 6], c2 = PETALS[(seed + 3) % 6];
        for (let k = 0; k < 11; k++) { const a = r() * TAU, d = Math.sqrt(r()); K.push(...flowerParts(seed + k, Math.cos(a) * d * 1.3, Math.sin(a) * d * 0.6, k % 3 ? c1 : c2).map(g => g.scale(1.7, 1.7, 1.7).translate(0, 0.08, 0))); }
        put(mesh(fuse(K)), [p[0] + 0.7, p[1], p[2] + 0.7], 1, r() * TAU); break;
      }
      case 'tree': put(tree(seed, { h: 3.6, blossom: seed % 2 ? '#ffb8d8' : null }), p); break;
      case 'fountain': {
        const K = [
          pc(turned([[0, 0], [2.3, 0], [2.4, 0.15], [2.3, 0.7], [2.05, 0.75], [1.95, 0.35], [0, 0.35]], 32), ['#f2ece0', '#b8ae9c']),
          pc(turned([[0.35, 0], [0.25, 0.8], [0.22, 1.6], [0.9, 1.75], [0.95, 1.95], [0.8, 2.0], [0.2, 1.9], [0.15, 2.4], [0.25, 2.6], [0, 2.75]], 20), ['#f6f0e6', '#c8bca8']),
        ];
        const water = mesh(new THREE.CircleGeometry(2.0, 32).rotateX(-Math.PI / 2).translate(0, 0.6, 0), MAT.water, false);
        const top = mesh(new THREE.CircleGeometry(0.8, 20).rotateX(-Math.PI / 2).translate(0, 1.92, 0), MAT.water, false);
        const jet = mesh(paint(blob(0.3, { sy: 1.6, lump: 0.25, detail: 2 }).translate(0, 2.9, 0), ['#ffffff', '#9fe8ff']), MAT.water, false);
        const g = group(mesh(fuse(K)), water, top, jet); put(g, p);
        live.anim.push(t => { jet.scale.set(1 + Math.sin(t * 6) * 0.08, 1 + Math.sin(t * 4.3) * 0.15, 1 + Math.cos(t * 5) * 0.08); });
        break;
      }
      case 'stele': {
        const st = rock(0.55, seed, ['#f2ece0', '#b0a690'], { sx: 0.85, sy: 1.7, sz: 0.5, lump: 0.18 }); st.position.y = 0.75;
        const moss = mesh(paint(blob(0.35, { sx: 1.2, sy: 0.3, lump: 0.3, seed }), ['#9be07a', '#5aa848']), MAT.clay); moss.position.set(0.05, 1.62, 0);
        const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.2, 5), glow('#7fe6ff', 1.2)); glyph.position.set(0, 1.0, 0.31);
        put(group(st, moss, glyph), p, 1, 0.6); break;
      }
      case 'clockface':
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU, r = 12.6, m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: text(['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][k], 70, '#5a4020'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.rotation.z = -a; put(m, [Math.sin(a) * r, p[1] + 0.02, Math.cos(a) * r]).rotation.order = 'YXZ';
        }
        break;
      case 'gearwall': {
        const big = mesh(paint(gearGeo(2.6, 14, 0.35), ['#f0c860', '#b8862e']), MAT.shiny), small = mesh(paint(gearGeo(1.5, 9, 0.3), ['#e0a86a', '#a0703a']), MAT.shiny);
        small.position.set(3.75, -1.6, 0.05);
        const hubs = mesh(fuse([pc(turned([[0.5, 0], [0.5, 0.5], [0.2, 0.6], [0, 0.6]], 16), ['#7a5a30', '#5a3a1a'], 0, 0, 0, Math.PI / 2), pc(turned([[0.35, 0], [0.35, 0.5], [0, 0.55]], 12), ['#7a5a30', '#5a3a1a'], 3.75, -1.6, 0, Math.PI / 2)]));
        const w = dd.side === 'w', g = group(big, small, hubs);
        put(g, [p[0] + (w ? 0.3 : 0), p[1], p[2] + (w ? 0 : 0.3)], 1, w ? Math.PI / 2 : 0); live.deco.at(-1).face = w ? 'w' : 'n';
        live.spins.push({ obj: big, axis: 'z', speed: 0.35 }, { obj: small, axis: 'z', speed: -0.35 * 14 / 9 });
        break;
      }
      case 'pendulum': {
        const g = group(mesh(fuse([
          pc(stem([[0, 0, 0], [0, -3, 0], [0, -6, 0]], 0.07, 0.07, 6, 4), ['#c8984a', '#9a6a2a']),
          pc(blob(1, { sy: 1, sz: 0.3, lump: 0.04, detail: 3 }), ['#ffe08a', '#c8902e'], 0, -6.6, 0),
          pc(turned([[0, -0.2], [0.25, -0.1], [0.25, 0.1], [0, 0.2]], 12), ['#9a6a2a'], 0, 0, 0, Math.PI / 2),
        ]), MAT.shiny));
        put(g, p); live.deco.at(-1).face = 'n'; live.pend = g; break;
      }
      case 'chain': {
        const a = new THREE.Vector3(...p), b = new THREE.Vector3(...dd.to), n = Math.round(a.distanceTo(b) / 0.42), K = [], ry = Math.atan2(b.x - a.x, b.z - a.z);
        for (let k = 0; k <= n; k++) { const q = a.clone().lerp(b, k / n), sag = Math.sin((k / n) * Math.PI) * 0.15; K.push(pc(new THREE.TorusGeometry(0.17, 0.05, 6, 12).scale(1, 1.35, 1), ['#e8c068', '#a07828'], q.x - a.x, q.y - a.y + 0.22 - sag, q.z - a.z, 0, ry + (k % 2 ? Math.PI / 2 : 0), 0)); }
        put(mesh(fuse(K), MAT.shiny), p); break;
      }
      case 'statue': {
        // des galets en équilibre, sur un socle tourné : l'esprit des Balances
        const r = rng(seed), K = [pc(turned([[1.1, 0], [1.15, 0.15], [0.9, 0.3], [0.8, 0.9], [1.0, 1.0], [0.95, 1.1], [0, 1.1]], 24), ['#f6f2fa', '#c8bed8'])];
        let y = 1.1;
        for (let k = 0; k < 5; k++) { const rr = 0.75 - k * 0.11, sy = 0.55; K.push(pc(blob(rr, { sy, lump: 0.1, seed: seed + k, detail: 3 }), ['#ffffff', '#d4ccdf'], (r() - 0.5) * 0.25, y + rr * sy, (r() - 0.5) * 0.25, 0, 0, (r() - 0.5) * 0.4)); y += rr * sy * 1.9; }
        put(mesh(fuse(K)), p); break;
      }
      case 'bookpile': {
        const r = rng(seed), K = [];
        let y = 0;
        for (let k = 0; k < 6; k++) {
          const w = 1.9 - k * 0.12 + r() * 0.2, d = 1.4 + r() * 0.2, h = 0.3 + r() * 0.15, ry = (r() - 0.5) * 0.6, col = ['#c0503e', '#4a7ab8', '#e0a040', '#5aa070', '#8a5ab0', '#d87aa0'][k];
          K.push(pc(soft(w, h, d, 0.05), [col, new THREE.Color(col).multiplyScalar(0.7).getStyle()], 0, y + h / 2, 0, 0, ry, 0));
          K.push(pc(new THREE.BoxGeometry(w - 0.06, h * 0.8, d - 0.12), ['#fff8e8', '#e8dcc0'], 0.06 * Math.cos(ry), y + h / 2, -0.06 * Math.sin(ry), 0, ry, 0));
          y += h;
        }
        put(mesh(fuse(K)), p); break;
      }
      case 'lamp': {
        const K = [
          pc(turned([[0.45, 0], [0.4, 0.12], [0.1, 0.18], [0, 0.2]], 18), ['#3a3550', '#2a2540']),
          pc(stem([[0, 0.1, 0], [0.1, 1.2, 0], [0.05, 2.2, 0], [0.3, 2.5, 0]], 0.06, 0.05, 6, 8), ['#4a4560', '#2a2540']),
          pc(turned([[0.7, 0], [0.55, 0.15], [0.3, 0.45], [0.12, 0.55]], 20), ['#3fa070', '#1f6a48'], 0.3, 2.15, 0),
        ];
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glow('#ffe08a', 2)); bulb.position.set(0.3, 2.2, 0);
        const g = group(mesh(fuse(K)), bulb); put(g, p, 1, seed % 7); break;
      }
      case 'chandelier': {
        const K = [pc(new THREE.TorusGeometry(2.5, 0.09, 8, 40).rotateX(Math.PI / 2), ['#e8c068', '#a07828'])], flames = [];
        for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; K.push(pc(stem([[Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5], [Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3]], 0.03, 0.03, 4, 2), ['#c89a3a'])); }
        K.push(pc(stem([[0, 1.0, 0], [0, 1.8, 0]], 0.05, 0.05, 5, 2), ['#c89a3a']));
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU, x = Math.cos(a) * 2.5, z = Math.sin(a) * 2.5;
          K.push(pc(turned([[0.14, 0], [0.1, 0.1], [0.08, 0.5], [0, 0.5]], 10), ['#fff6e0', '#e8dcc0'], x, 0.05, z));
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.8, 1), glow('#ffcf6a', 2.2)); f.position.set(x, 0.68, z); flames.push(f);
        }
        const g = group(mesh(fuse(K), MAT.shiny), ...flames); put(g, p); live.glows.push(...flames); break;
      }
      case 'wheel': {
        const K = [];
        for (const x of [-0.7, 0.7]) {
          K.push(pc(new THREE.TorusGeometry(5.5, 0.22, 8, 56).rotateY(Math.PI / 2), ['#a8743a', '#6a4426'], x, 0, 0));
          K.push(pc(new THREE.TorusGeometry(3.2, 0.12, 6, 40).rotateY(Math.PI / 2), ['#a8743a', '#6a4426'], x, 0, 0));
          for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; K.push(pc(soft(0.25, 5.4, 0.3, 0.06), ['#b07a42', '#7a4a24'], x, Math.cos(a) * 2.75, Math.sin(a) * 2.75, a, 0, 0)); }
        }
        for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; K.push(pc(soft(1.7, 0.12, 0.6, 0.04), ['#8a5a35', '#5a3a1a'], 0, Math.cos(a) * 5.5, Math.sin(a) * 5.5, a, 0, 0)); }
        K.push(pc(turned([[0.9, -0.9], [1, -0.7], [1, 0.7], [0.9, 0.9]], 18), ['#6a4426', '#4a2a16'], 0, 0, 0, 0, 0, Math.PI / 2));
        const g = mesh(fuse(K)); put(g, [p[0] + 1.6, p[1], p[2]]); live.wheel = g; break;
      }
      case 'millstone': {
        const m = mesh(fuse([pc(turned([[0, 0], [2.1, 0], [2.25, 0.15], [2.25, 0.65], [2.1, 0.8], [0.5, 0.8], [0.45, 0.7], [0, 0.7]], 32), ['#cfc4b0', '#9a8e78'], 0, 0, 0, 0, 0, 0, 0.14),
          pc(turned([[0.18, 0], [0.18, 1.6], [0, 1.7]], 10), ['#7a5a30'])]), MAT.stone);
        put(m, p); live.spins.push({ obj: m, axis: 'y', speed: 0.5 }); break;
      }
      case 'waterfall': {
        fall(p[0], p[1], p[2], dd.h, 3.5);
        const r = rng(seed), K = [];
        for (let k = 0; k < 7; k++) K.push(pc(blob(0.5 + r() * 0.5, { seed: k, sy: 0.6, detail: 2 }), ['#ffffff', '#cfefff'], (r() - 0.5) * 1.2, 0.2, (r() - 0.5) * 3.2));
        const foam = mesh(fuse(K), MAT.cloud, false); put(foam, [p[0], p[1] - dd.h, p[2]]);
        live.anim.push(t => foam.scale.set(1, 1 + Math.sin(t * 3) * 0.12, 1));
        break;
      }
      case 'sacks': {
        const r = rng(seed), K = [];
        for (let k = 0; k < 5; k++) {
          const x = (k % 3) * 0.95 + (k > 2 ? 0.45 : 0), y = k > 2 ? 0.95 : 0.5, z = (r() - 0.5) * 0.4, tilt = (r() - 0.5) * 0.5;
          K.push(pc(blob(0.62, { sy: 0.85, lump: 0.18, seed: seed + k, freq: 2.4 }), ['#f0dcb0', '#b89a68'], x, y, z, 0, r() * TAU, tilt));
          K.push(pc(stem([[x, y + 0.45, z], [x + Math.sin(-tilt) * 0.2, y + 0.75, z]], 0.13, 0.06, 6, 3), ['#d8bc88', '#a88a58']));
        }
        put(mesh(fuse(K)), p); break;
      }
      case 'loop': {
        // une boucle de montagnes russes : deux rails, des traverses, des pieds
        const pts = k => { const a = (k / 64) * TAU; return [Math.sin(a) * 3.5, 3.6 - Math.cos(a) * 3.5, (k / 64 - 0.5) * 1.6]; }, K = [];
        for (const off of [-0.45, 0.45]) K.push(pc(stem(Array.from({ length: 65 }, (_, k) => { const q = pts(k); return [q[0], q[1], q[2] + off]; }), 0.1, 0.1, 6, 96), ['#ff7a8a', '#d8405a']));
        for (let k = 0; k < 64; k += 3) { const q = pts(k), a = (k / 64) * TAU; K.push(pc(soft(0.18, 0.12, 1.1, 0.03), ['#ffd84a', '#e0a020'], q[0], q[1], q[2], 0, 0, -a)); }
        for (const s of [-1, 1]) K.push(pc(stem([[s * 3.6, 0, 0], [s * 3.4, 1.8, 0], [s * 3.1, 3.2, 0]], 0.12, 0.08, 6, 4), ['#e8e0f0', '#a8a0b8']));
        put(mesh(fuse(K)), p); break;
      }
      case 'bunting': {
        const K = [], n = 16, sagAt = s => -Math.sin(s * Math.PI) * 1.3;
        K.push(pc(stem(Array.from({ length: 9 }, (_, k) => [-14 + k * 3.5, sagAt(k / 8), 0]), 0.03, 0.03, 4, 32), ['#6a5a7a']));
        for (let k = 1; k < n; k++) {
          const s = k / n, x = -14 + s * 28, y = sagAt(s), c = ['#ff6476', '#ffd84a', '#5ab4ff', '#7ae08a', '#c89cff'][k % 5];
          const f = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.4, 0, 0, 0.4, 0, 0, 0.05, -0.8, 0.12], 3)); f.computeVertexNormals();
          K.push(pc(f, [c, new THREE.Color(c).multiplyScalar(0.75).getStyle()], x, y, 0, 0, (k % 2 - 0.5) * 0.3, 0));
        }
        put(mesh(fuse(K), MAT.cloth), p); break;
      }
      case 'lights': {
        const K = [];
        K.push(pc(stem(Array.from({ length: 33 }, (_, k) => { const a = (k / 32) * TAU; return [Math.cos(a) * 13, -Math.abs(Math.sin(a * 8)) * 0.6, Math.sin(a) * 13]; }), 0.03, 0.03, 4, 160), ['#4a4060']));
        put(mesh(fuse(K)), [0, p[1], 0]);
        for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + TAU / 32, l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glow(['#ffe08a', '#ff9ac0', '#9fe8ff'][k % 3], 2)); put(l, [Math.cos(a) * 13, p[1] - 0.8, Math.sin(a) * 13]); live.glows.push(l); }
        break;
      }
      case 'upsidehouse': {
        const h = house(seed, ['#e0605e', '#5b7bd6', '#5aa070', '#e0a040'][Math.abs(Math.round(p[0] + p[2])) % 4]); h.rotation.x = Math.PI;
        put(group(h), p); break;
      }
      case 'wires': {
        // le crochet au plafond ; les fils suivent le plateau qui penche (mis à jour à chaque image)
        const i = L.blocks.findIndex(b => b.kin?.type === 'mobile' && Math.abs(b.c[0] - p[0]) < 0.1 && Math.abs(b.c[2] - p[2]) < 0.1);
        const hook = mesh(fuse([pc(turned([[0, 0], [0.4, 0.05], [0.25, 0.3], [0, 0.35]], 12), ['#ffe08a', '#c8902e']), pc(new THREE.TorusGeometry(0.18, 0.05, 6, 12), ['#c8902e'], 0, -0.15, 0)]), MAT.shiny);
        put(hook, p);
        const line = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3)), new THREE.LineBasicMaterial({ color: '#5a5070', transparent: true, opacity: 0.8 }));
        line.frustumCulled = false; put(line, [0, 0, 0]); live.deco.at(-1).y = p[1];
        if (i >= 0) live.wires.push({ line, i, hook: [p[0], p[1] - 0.2, p[2]] });
        break;
      }
      case 'pipes':
        for (let k = 0; k < 4; k++) {
          const vent = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24).rotateX(-Math.PI / 2).translate(0, 0.2, 0), glow('#ffe7a0', 0));
          const ring = mesh(fuse([pc(turned([[1.15, 0], [1.2, 0.08], [1.05, 0.28], [0.9, 0.28], [0.85, 0.15]], 28), ['#f0c860', '#a87a28'])]), MAT.shiny);
          const g = group(vent, ring); put(g, [-4.5 + k * 3, p[1], p[2] + 1.8]); live.pipes.push(g);
        }
        break;
      case 'score': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: text('♪ 1 · 3 · 2 · 4', 52, '#3a2a10'), color: '#fff8e0' }));
        const frame = mesh(fuse([pc(soft(5.5, 3, 0.15, 0.05), ['#a8743a', '#6a4426'], 0, 0, -0.1)]));
        put(group(frame, m), [p[0], p[1] + 3, p[2] - 0.9]); live.deco.at(-1).face = 'n'; break;
      }
      case 'trebuchet': {
        const K = [
          pc(soft(7.8, 0.42, 0.42, 0.08), ['#b88048', '#7a4a24'], 0, 0, 0, 0, 0, Math.PI / 4),
          pc(turned([[0.32, -0.8], [0.32, 0.8]], 12), ['#5a5a6a', '#3a3a48'], 0, 0, 0, Math.PI / 2),
        ];
        for (const f of [-0.35, 0.05, 0.4]) { const d = f * 7.8; K.push(pc(soft(0.12, 0.5, 0.5, 0.03), ['#6a6a7c', '#3a3a48'], d * Math.SQRT1_2, d * Math.SQRT1_2, 0, 0, 0, Math.PI / 4)); }
        K.push(pc(stem([[2.5, 2.5, 0], [2.4, 2.15, 0], [2.3, 2.0, 0]], 0.05, 0.05, 5, 3), ['#c8b088']));
        K.push(pc(soft(1.4, 1.2, 1.4, 0.12), ['#7a7a8c', '#4a4a58'], 2.3, 1.45, 0));
        const r = rng(seed); for (let k = 0; k < 5; k++) K.push(pc(blob(0.25 + r() * 0.12, { detail: 1, lump: 0.3, seed: k }), ['#a8a090', '#6a6458'], 2.3 + (r() - 0.5) * 0.8, 2.15, (r() - 0.5) * 0.8));
        const arm = group(mesh(fuse(K))); put(arm, p); live.treb = arm; break;
      }
      case 'banners':
        for (let k = 0; k < 5; k++) {
          const c = ['#c0503e', '#e0a040', '#4a7ab8'][k % 3], g = new THREE.PlaneGeometry(1.3, 3, 4, 10), q = g.attributes.position;
          for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i); q.setY(i, y < -1.45 ? y + 0.5 - Math.abs(x) * 0.8 : y); q.setZ(i, Math.sin(y * 2 + k) * 0.12 * (1.5 - y) / 3); }
          g.computeVertexNormals();
          const K = [pc(g, [c, new THREE.Color(c).multiplyScalar(0.7).getStyle()], 0, 0, 0.05), pc(blob(0.3, { sz: 0.15, detail: 2 }), ['#ffe08a'], 0, 0.6, 0.15)];
          const pole = [pc(stem([[0, -3, -0.1], [0, 1.9, -0.1]], 0.07, 0.06, 6, 3), ['#8a5a35', '#5a3a1a']), pc(stem([[-0.85, 1.55, 0], [0.85, 1.55, 0]], 0.05, 0.05, 5, 2), ['#8a5a35']), pc(blob(0.14, { detail: 1 }), ['#ffd84a'], 0, 2.0, -0.1)];
          put(group(mesh(fuse(K), MAT.cloth), mesh(fuse(pole))), [p[0] - 8 + k * 4, p[1] + 3, p[2] + 0.6]);
        }
        break;
      case 'beacon': {
        const b = new THREE.Group(), r = rng(seed);
        for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), glow(['#b49cff', '#7fe6ff', '#ff9ce6'][k % 3], 1)); c.scale.set(0.8, 2.2 + r() * 1.6, 0.8); c.position.set(Math.cos(k) * 0.8, 1.2, Math.sin(k) * 0.8); c.rotation.set((r() - 0.5) * 0.6, r() * TAU, (r() - 0.5) * 0.6); b.add(c); }
        b.add(rock(1.2, seed, ['#8a80b8', '#4a4078'], { sy: 0.5 }));
        live.glows.push(b); live.beacon = b; ctx.tower.add(b); break;
      }
      case 'stars': {
        const n = 400, pos = new Float32Array(n * 3), r = rng(13);
        for (let k = 0; k < n; k++) { const a = r() * TAU, rad = 80 + r() * 80; pos.set([Math.cos(a) * rad, 90 + r() * 90, Math.sin(a) * rad], k * 3); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        ctx.tower.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false })));
        break;
      }
    }
  }
  extras(ctx);
  scatter(ctx);
}

// Une maison (qu'on suspendra la tête en bas) : murs, toit à deux pans, cheminée, fenêtres, porte
function house(seed, roof) {
  const r = rng(seed), w = 4 + r() * 0.8, h = 2.8 + r() * 0.6, d = 3.4, wall = ['#fff4e4', '#e8d4b8'], K = [];
  K.push(pc(soft(w, h, d, 0.12), wall, 0, h / 2, 0));
  const tri = new THREE.Shape(); tri.moveTo(-w / 2 - 0.4, 0); tri.lineTo(w / 2 + 0.4, 0); tri.lineTo(0, 2); tri.closePath();
  K.push(pc(new THREE.ExtrudeGeometry(tri, { depth: d + 0.6, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }).translate(0, 0, -(d + 0.6) / 2), [roof, new THREE.Color(roof).multiplyScalar(0.65).getStyle()], 0, h - 0.05, 0));
  K.push(pc(soft(0.6, 1.4, 0.6, 0.06), ['#c0705a', '#8a4a3a'], w * 0.22, h + 1.1, -0.6));
  for (const x of [-w * 0.27, w * 0.27]) for (const z of [d / 2, -d / 2]) {
    K.push(pc(soft(0.85, 0.95, 0.12, 0.03), ['#ffffff'], x, h * 0.62, z));
    K.push(pc(new THREE.BoxGeometry(0.62, 0.72, 0.14), ['#4a5a98', '#2a3468'], x, h * 0.62, z * 1.01));
  }
  K.push(pc(soft(0.8, 1.4, 0.14, 0.05), ['#8a5a35', '#5a3a1a'], 0, 0.7, d / 2 + 0.02));
  return mesh(fuse(K));
}

// Décor en plus, pensé monde par monde (toujours contre les murs ou dans les coins, jamais sur le chemin)
function extras(ctx) {
  const { put, live, LIGHT } = ctx;
  const W = (w, fn) => { ctx.world(w); fn(); };
  // l'île du Jardin : un gros rocher qui pend sous la pelouse, des racines, de petits rochers volants
  W(0, () => {
    const K = [pc(blob(1, { sx: 21.2, sy: 13, sz: 21.2, top: 0, lump: 0.22, seed: 3, detail: 4, freq: 1.3 }), ['#a8805a', '#5e4a6e'], 0, -2, 0, 0, 0, 0, 0.1)];
    const r = rng(9);
    for (let k = 0; k < 12; k++) { const a = r() * TAU, d = 12 + r() * 8; K.push(pc(stem([[Math.cos(a) * d, -2.5, Math.sin(a) * d], [Math.cos(a) * d * 0.95, -5 - r() * 2, Math.sin(a) * d * 0.95], [Math.cos(a) * d * 0.9 + r() - 0.5, -8 - r() * 4, Math.sin(a) * d * 0.9]], 0.25, 0.04, 5, 8), ['#8a6040', '#5a3a28'])); }
    put(mesh(fuse(K), MAT.stone), [0, 0, 0]);
    for (const [x, y, z, s] of [[-28, -6, 8, 1.4], [26, -9, -12, 1.1], [8, -14, 28, 1.6], [-14, -11, -27, 1.0]]) put(island(Math.round(x * y), 1), [x, y, z], s);
    const bush = (x, y, z, s, fl) => put(mesh(fuse(bushParts(Math.round(x * 13 + z * 7), s, LEAF, fl))), [x, y, z]);
    bush(-10, 0, 20.1, 1, '#ff8fb0'); bush(1, 0, 20.2, 0.8, null); bush(-20.2, 0, 1, 1.1, '#ffffff'); bush(20.2, 3, -18, 0.9, '#ffd84a'); bush(-20, 7, 19.8, 0.9, '#b89cff');
    put(mesh(fuse([...mushroomParts(1, 0, 0), ...mushroomParts(2, 0.45, 0.3, 0.7), ...mushroomParts(3, -0.3, 0.4, 0.55)])), [19.6, 0, 1]);
    put(mesh(fuse([...mushroomParts(4, 0, 0, 1.2), ...mushroomParts(5, 0.5, -0.2, 0.8)])), [-19.6, 3, -19.4]);
    for (const [x, z, s] of [[-11.5, -0.5, 0.5], [-16.3, -5.5, 0.35], [-11.8, -5.8, 0.3]]) put(rock(s, x * 3, ['#e0d8c8', '#9a9080']), [x, s * 0.4, z]);
    // papillons autour des massifs
    for (const [x, z, c] of [[16.5, 12.5, '#ffb0d0'], [-5.5, 15.5, '#ffe066'], [12, 4, '#9fd8ff']]) {
      const wing = new THREE.CircleGeometry(0.22, 8).scale(1, 0.7, 1), m = new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.3 });
      const l = new THREE.Mesh(wing, m), rr = new THREE.Mesh(wing, m); l.position.x = -0.18; rr.position.x = 0.18;
      const bf = group(group(l), group(rr)); put(bf, [x, 1.2, z]);
      const ph = x * 0.7;
      live.anim.push(t => { const a = t * 0.6 + ph; bf.position.set(x + Math.cos(a) * 1.6, 1.1 + Math.sin(t * 2.3 + ph) * 0.35, z + Math.sin(a * 1.3) * 1.2); bf.rotation.y = -a; const f = Math.sin(t * 18 + ph) * 1.1; bf.children[0].rotation.y = f; bf.children[1].rotation.y = -f; });
    }
  });
  // l'Horloge : un sablier, des engrenages tombés au sol
  W(1, () => {
    const K = [pc(turned([[0.95, 0], [0.95, 0.18], [0.85, 0.22], [0.85, 2.1], [0.95, 2.14], [0.95, 2.32], [0, 2.32]], 24), ['#b8863e', '#7a5020'])];
    for (const a of [0, 2.1, 4.2]) K.push(pc(stem([[Math.cos(a) * 0.75, 0.2, Math.sin(a) * 0.75], [Math.cos(a) * 0.75, 2.1, Math.sin(a) * 0.75]], 0.06, 0.06, 5, 2), ['#c8984a']));
    const glass = mesh(turned([[0.02, 0.2], [0.6, 0.4], [0.65, 0.8], [0.1, 1.2], [0.65, 1.6], [0.6, 1.95], [0.02, 2.14]], 20), MAT.glass, false);
    const sand = mesh(paint(turned([[0, 0.22], [0.55, 0.3], [0.35, 0.55], [0, 0.7]], 16), ['#ffe0a0', '#e0b060']));
    put(group(mesh(fuse(K), MAT.shiny), sand, glass), [13.3, 12, -13.3]);
    const G = [pc(gearGeo(0.8, 8, 0.15), ['#e8b860', '#a87a28'], 0, 0.1, 0, Math.PI / 2), pc(gearGeo(0.55, 7, 0.15), ['#d0a0e0', '#9070a8'], 0.9, 0.1, 0.5, Math.PI / 2 - 0.1), pc(gearGeo(0.45, 6, 0.12), ['#e8b860', '#a87a28'], 0.3, 0.3, 0.2, Math.PI / 2 + 0.25)];
    put(mesh(fuse(G), MAT.shiny), [-13.5, 12, 13.2]);
  });
  // les Balances : des plantes en pot de marbre
  W(2, () => { for (const [x, z, s] of [[-14, -6, 1], [-5, -14.1, 0.9], [14.1, -4, 0.8]]) put(potted(Math.round(x * z), s), [x, 24, z]); });
  // la Bibliothèque : un globe sur son pied
  W(3, () => {
    const K = [pc(turned([[0.6, 0], [0.55, 0.1], [0.12, 0.3], [0.1, 1.2], [0, 1.25]], 16), ['#8a5a35', '#5a3a1a']), pc(new THREE.TorusGeometry(0.85, 0.05, 6, 32, Math.PI * 1.3), ['#e8c068'], 0, 1.95, 0, 0, Math.PI / 2, 0.4)];
    const globe = mesh(paint(blob(0.75, { lump: 0.02, detail: 4 }), ['#7fc8f0', '#4a8ac0']), MAT.clay);
    const land = mesh(paint(blob(0.77, { lump: 0.0, detail: 3, seed: 2 }), ['#9be07a', '#5aa848']), MAT.clay);
    { const q = land.geometry.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i); if (fbm(x * 2.2, y * 2.2, z * 2.2) < 0.52) q.setXYZ(i, x * 0.9, y * 0.9, z * 0.9); } land.geometry.computeVertexNormals(); }
    const ball = group(globe, land); ball.position.y = 1.95; ball.rotation.z = 0.4;
    put(group(mesh(fuse(K)), ball), [12.6, 36, -8.2]); live.spins.push({ obj: ball, axis: 'y', speed: 0.3 });
  });
  // le Moulin : des tonneaux
  W(4, () => { const K = []; for (const [x, z, y] of [[0, 0, 0], [1.3, 0.5, 0], [0.65, 0.25, 1.3]]) K.push(...barrel(x, y, z)); put(mesh(fuse(K)), [12.4, 48, 12.8]); });
  // le Grand Huit : des ballons qui flottent
  W(5, () => {
    for (const [x, z] of [[12.5, 12.5], [-12.5, 8]]) {
      const r = rng(Math.round(x * 3 + z)), K = [], tops = [];
      for (let k = 0; k < 5; k++) { const top = [(r() - 0.5) * 2, 5 + r() * 2.5, (r() - 0.5) * 2]; tops.push(top); K.push(pc(stem([[0, 0.3, 0], [top[0] * 0.5, top[1] * 0.5, top[2] * 0.5], [top[0], top[1] - 0.7, top[2]]], 0.012, 0.012, 3, 6), ['#ffffff'])); }
      K.push(pc(soft(0.5, 0.4, 0.5, 0.08), ['#8a80a8', '#5a5078']));
      const balloons = tops.map((tp, k) => { const c = ['#ff6476', '#ffd84a', '#5ab4ff', '#7ae08a', '#c89cff'][k], b = mesh(fuse([pc(blob(0.6, { sy: 1.2, lump: 0.03, detail: 3 }), [new THREE.Color(c).offsetHSL(0, 0, 0.12).getStyle(), c]), pc(turned([[0, 0], [0.1, 0.1], [0, 0.14]], 8), [c], 0, -0.82, 0)]), MAT.shiny); b.position.set(...tp); return b; });
      const g = group(mesh(fuse(K)), ...balloons); put(g, [x, 60, z]);
      live.anim.push(t => balloons.forEach((b, k) => { b.position.y = tops[k][1] + Math.sin(t * 1.3 + k) * 0.15; b.rotation.z = Math.sin(t * 0.9 + k) * 0.08; }));
    }
  });
  // la Ville à l'envers : des arbres qui pendent du ciel
  W(6, () => { for (const [x, z, s] of [[14, -14, 0.8], [-14.5, -2, 0.7], [5.5, 14.5, 0.75]]) { const t = tree(Math.round(x * 7 + z), { h: 3, s, blossom: '#ffd0e8' }); t.rotation.x = Math.PI; put(group(t), [x, 82.8 + 0.2, z]); } });
  // le Mobile : des étoiles et des lunes en papier, au bout de leur fil
  W(7, () => {
    for (const [x, z, len, moon] of [[13.5, 13.5, 4, 0], [-12.5, -12.5, 3, 1], [14, -12, 5, 1], [-4, 2, 3.5, 0], [-13.5, 14, 2.5, 0]]) {
      let g;
      if (moon) { const s = new THREE.Shape(); s.absarc(0, 0, 0.7, 0.4, TAU - 0.4, false); s.absarc(0.35, 0, 0.55, TAU - 0.9, 0.9, true); g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); }
      else { const s = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + Math.PI / 2, rr = k % 2 ? 0.32 : 0.75; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }); }
      const charm = mesh(fuse([pc(g.translate(0, 0, -0.06), moon ? ['#fff4c0', '#e8c060'] : ['#ffe08a', '#f0a830'])]), MAT.shiny); charm.position.y = -len - 0.7;
      const string = mesh(fuse([pc(stem([[0, 0, 0], [0, -len, 0]], 0.015, 0.015, 3, 2), ['#ffffff'])]), MAT.clay, false);
      const hang = group(string, charm); put(hang, [x, 95, z]);
      const ph = x + z; live.anim.push(t => { charm.rotation.y = Math.sin(t * 0.7 + ph) * 1.2; hang.rotation.z = Math.sin(t * 0.8 + ph) * 0.04; });
    }
  });
  // l'Orgue : une façade de grands tuyaux au mur du fond, au-dessus de la partition
  W(8, () => {
    const K = [];
    for (let k = 0; k < 15; k++) {
      const x = -14.4 + k * 1.3, h = 4.5 - Math.abs(k - 7) * 0.35 + (k % 2) * 0.4, r = 0.42 - Math.abs(k - 7) * 0.012;
      K.push(pc(turned([[0, 0], [0.12, 0.05], [r, 0.7], [r, h], [r * 0.85, h + 0.05], [r * 0.85, h - 0.1]], 16), ['#ffe8a0', '#c89a3a'], x, 100.6, -14.45));
      K.push(pc(soft(r * 1.1, 0.25, 0.08, 0.02), ['#3a2a10'], x, 101.6, -14.45 + r * 0.95));
    }
    K.push(pc(soft(20, 0.4, 1, 0.1), ['#a8743a', '#6a4426'], -5.3, 100.4, -14.5));
    put(mesh(fuse(K), MAT.shiny), [0, 0, 0]); Object.assign(live.deco.at(-1), { y: 100, face: 'n' });
  });
  // le Trébuchet : des boulets empilés, une botte de foin
  W(9, () => {
    const K = []; let k = 0;
    for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - l; i++) for (let j = 0; j < 3 - l; j++) K.push(pc(blob(0.38, { lump: 0.04, detail: 2, seed: k++ }), ['#7a7a8c', '#3a3a48'], (i - (2 - l) / 2) * 0.78, 0.38 + l * 0.62, (j - (2 - l) / 2) * 0.78));
    put(mesh(fuse(K), MAT.shiny), [12.5, 108, -12.5]);
    const hay = [pc(blob(1, { sx: 1.4, sy: 0.8, sz: 0.9, lump: 0.12, freq: 4, detail: 3 }), ['#ffe08a', '#c8a040'], 0, 0.75, 0)];
    for (const x of [-0.6, 0.6]) hay.push(pc(new THREE.TorusGeometry(0.82, 0.04, 5, 24).scale(1, 0.95, 1.12), ['#8a5a35'], x, 0.75, 0, 0, Math.PI / 2, 0));
    put(mesh(fuse(hay)), [13, 108, 9]);
    put(mesh(fuse(barrel(0, 0, 0))), [11.2, 108, 11]);
  });
  // autour de la tour : des îles volantes, à toutes les hauteurs
  const r = rng(41);
  for (let k = 0; k < (LIGHT ? 6 : 12); k++) {
    const a = r() * TAU, d = 34 + r() * 22, o = island(k * 17 + 3, 1.2 + r() * 1.6);
    o.position.set(Math.cos(a) * d, 4 + k * 10 + r() * 6, Math.sin(a) * d); o.userData = { y: o.position.y, ph: r() * TAU };
    ctx.tower.add(o); live.floaters.push(o);
  }
  // nuages
  for (let k = 0; k < (LIGHT ? 18 : 30); k++) {
    const c = cloud(k + 77, 1.2 + r() * 1.6), a = r() * TAU, rr = 46 + r() * 50;
    c.position.set(Math.cos(a) * rr, -10 + r() * 140, Math.sin(a) * rr); c.userData = { a, r: rr, s: 0.01 + r() * 0.02 };
    ctx.tower.add(c); live.clouds.push(c);
  }
  for (let k = 0; k < (LIGHT ? 16 : 34); k++) { const c = cloud(k + 300, 3.5 + r() * 3), a = r() * TAU, rr = 30 + r() * 90; c.position.set(Math.cos(a) * rr, -32 - r() * 6, Math.sin(a) * rr); ctx.tower.add(c); }
}
function potted(seed, s) {
  const K = [pc(turned([[0.45, 0], [0.55, 0.1], [0.62, 0.7], [0.7, 0.78], [0.66, 0.86], [0, 0.82]], 20), ['#f6f2fa', '#c8bed8'])];
  K.push(...bushParts(seed, 0.75, ['#8fd86a', '#3f8a3a'], seed % 2 ? '#ff8fb0' : '#ffffff').map(g => g.translate(0, 0.75, 0)));
  const m = mesh(fuse(K)); m.scale.setScalar(s); return m;
}
function barrel(x, y, z) {
  const K = [pc(turned([[0, 0], [0.48, 0], [0.56, 0.55], [0.48, 1.1], [0, 1.1]], 18), ['#b07a42', '#7a4a24'], x, y, z)];
  for (const h of [0.15, 0.95]) K.push(pc(new THREE.TorusGeometry(0.505, 0.03, 4, 24).rotateX(Math.PI / 2), ['#4a4a58'], x, y + h, z));
  return K;
}

// Semis : touffes d'herbe, fleurs et cailloux au pied des murs et au bord des pelouses ; mousse au pied des murs de pierre
function scatter(ctx) {
  const { L, put, LIGHT, worldOf } = ctx;
  const stat = L.blocks.filter(b => !b.kin && !b.topple && !b.pitch && !b.roll && !b.yaw && !b.hidden).map(b => ({ b, lo: b.c.map((c, k) => c - b.h[k]), hi: b.c.map((c, k) => c + b.h[k]) }));
  const GRASS = { lawn: 1, terrace: 1 }, STONE = { millfloor: 1, cobble: 1 };
  const byW = new Map(), add = (w, k, it) => { if (!byW.has(w)) byW.set(w, { tuft: [], flower: [], pebble: [], moss: [] }); byW.get(w)[k].push(it); };
  const r = rng(2024), dens = LIGHT ? 0.5 : 1;
  for (const s of stat) {
    const look = s.b.look, grass = GRASS[look], stone = STONE[look];
    if (!grass && !stone) continue;
    const y = s.hi[1], area = (s.hi[0] - s.lo[0]) * (s.hi[2] - s.lo[2]), w = worldOf(y), tint = new THREE.Color((grass ? '#c8f0a0' : '#ffffff'));
    const n = Math.min(4000, area * (grass ? 3 : 1.2) * dens);
    const near0 = stat.filter(o => o !== s && o.lo[1] <= y + 0.05 && o.hi[1] > y + 0.05 && o.lo[0] < s.hi[0] + 2 && o.hi[0] > s.lo[0] - 2 && o.lo[2] < s.hi[2] + 2 && o.hi[2] > s.lo[2] - 2);
    for (let k = 0; k < n; k++) {
      const x = mix(s.lo[0], s.hi[0], r()), z = mix(s.lo[2], s.hi[2], r());
      if (near0.some(o => x > o.lo[0] - 0.05 && x < o.hi[0] + 0.05 && z > o.lo[2] - 0.05 && z < o.hi[2] + 0.05 && o.lo[1] <= y + 0.05 && o.hi[1] > y + 0.05)) continue;
      const edge = Math.min(x - s.lo[0], s.hi[0] - x, z - s.lo[2], s.hi[2] - z);
      const wallD = Math.min(edge + (grass ? 0 : 99), ...near0.filter(o => o.hi[1] > y + 0.5).map(o => Math.hypot(Math.max(o.lo[0] - x, 0, x - o.hi[0]), Math.max(o.lo[2] - z, 0, z - o.hi[2]))));
      const near = Math.exp(-wallD * 1.6);
      if (r() > near * 0.9 + (grass ? 0.04 : 0)) continue;
      const q = r();
      if (grass) {
        if (q < 0.72) add(w, 'tuft', { p: [x, y, z], ry: r() * TAU, s: 0.7 + r() * 0.9 + near * 0.5, c: tint.clone().offsetHSL((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.15) });
        else if (q < 0.9) add(w, 'flower', { p: [x, y, z], ry: r() * TAU, s: 1.2 + r() * 0.7, c: PETALS[Math.floor(r() * PETALS.length)] });
        else add(w, 'pebble', { p: [x, y + 0.02, z], ry: r() * TAU, s: 0.08 + r() * 0.14, sy: 0.6, c: new THREE.Color('#e8e0d0').offsetHSL(0, 0, (r() - 0.5) * 0.2) });
      } else if (wallD < 0.9) {
        if (q < 0.45) add(w, 'moss', { p: [x, y, z], ry: r() * TAU, s: 0.08 + r() * 0.16, sy: 0.5, c: new THREE.Color('#6aa850').offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.15) });
        else if (q < 0.8) add(w, 'tuft', { p: [x, y, z], ry: r() * TAU, s: 0.5 + r() * 0.4, c: '#d8f0b0' });
        else add(w, 'pebble', { p: [x, y + 0.02, z], ry: r() * TAU, s: 0.06 + r() * 0.1, sy: 0.6, c: new THREE.Color('#d0c8b8').offsetHSL(0, 0, (r() - 0.5) * 0.2) });
      }
    }
  }
  const tuft = tuftGeo(), pebble = paint(blob(1, { detail: 1, lump: 0.3 }), ['#ffffff', '#c8c8c8']), moss = paint(blob(1, { detail: 2, lump: 0.35, top: 0.6 }), ['#ffffff', '#b0b0b0']);
  const head = fuse([...Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * TAU; return pc(blob(0.075, { sy: 0.35, detail: 1, seed: k }), ['#ffffff', '#eeeeee'], Math.cos(a) * 0.09, 0.4, Math.sin(a) * 0.09); }), pc(blob(0.05, { detail: 1 }), ['#ffe066', '#e0a020'], 0, 0.43, 0)]);
  const stalk = fuse([pc(stem([[0, 0, 0], [0.03, 0.2, 0], [0, 0.4, 0]], 0.022, 0.016, 4, 3), ['#5aa848', '#3c7a34']), pc(blob(0.1, { sy: 0.3, sx: 1.5, detail: 1 }), ['#6fbf58', '#3c7a34'], 0.09, 0.1, 0)]);
  for (const [w, s] of byW) {
    ctx.world(w);
    const at = o => { put(o, [0, 0, 0]); ctx.live.deco.at(-1).y = w * 12; }; // positions absolues ; y sert à la visibilité
    if (s.tuft.length) at(instanced(tuft, bladeMat, s.tuft));
    if (s.flower.length) { at(instanced(head, MAT.clay, s.flower)); at(instanced(stalk, MAT.clay, s.flower.map(f => ({ ...f, c: '#ffffff' })))); }
    if (s.pebble.length) at(instanced(pebble, MAT.stone, s.pebble, true));
    if (s.moss.length) at(instanced(moss, MAT.clay, s.moss));
  }
}

/* ---------- L'habillage des murs et des planchers (attaché au bloc : il s'efface avec lui) ---------- */
const winGlow = glow('#ffe2a0', 0.9);
function arch(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath(); return s; }
// b : le bloc ; cols : [dessus, flancs] de son apparence
export function dress(b, [top = '#ffffff', side = '#cccccc'] = []) {
  const K = [], G = [], r = rng(Math.round(b.c[0] * 31 + b.c[1] * 7 + b.c[2] * 13) + 99);
  const light = new THREE.Color(side).offsetHSL(0, -0.05, 0.12).getStyle(), dark = new THREE.Color(side).offsetHSL(0, 0, -0.1).getStyle();
  // Murs : fenêtres en arc des deux côtés, lierre qui pend dehors
  if (b.face) {
    const nx = b.face === 'e' ? 1 : b.face === 'w' ? -1 : 0, nz = b.face === 's' ? 1 : b.face === 'n' ? -1 : 0, alongX = !nx;
    const a0 = alongX ? b.c[0] - b.h[0] : b.c[2] - b.h[2], a1 = alongX ? b.c[0] + b.h[0] : b.c[2] + b.h[2], y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];
    const spot = (t, y, s, out = 0) => alongX ? [t, y, b.c[2] + s * nz * (b.h[2] + out)] : [b.c[0] + s * nx * (b.h[0] + out), y, t];
    const n = Math.floor((a1 - a0 - 1.6) / 5);
    if (y1 - y0 > 5 && n >= 1 && b.look !== 'shelves') for (let k = 0; k < n; k++) {
      if (r() < 0.2) continue;
      const t = a0 + ((k + 0.5) * (a1 - a0)) / n, y = y0 + (y1 - y0) * 0.38;
      for (const s of [1, -1]) {
        const ry = Math.atan2(s * nx, s * nz), [x, yy, z] = spot(t, y, s), frame = arch(1.7, 3.1); frame.holes.push(arch(1.2, 2.7));
        K.push(pc(new THREE.ExtrudeGeometry(frame, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 8 }).translate(0, -0.2, -0.1), [light, side], x, yy, z, 0, ry, 0));
        K.push(pc(soft(0.07, 2.5, 0.1, 0.02), [dark], x, yy + 1.15, z, 0, ry, 0), pc(soft(1.2, 0.07, 0.1, 0.02), [dark], x, yy + 1.5, z, 0, ry, 0));
        G.push(paint(new THREE.ShapeGeometry(arch(1.2, 2.7), 6).translate(0, -0.2, -0.02).applyMatrix4(new THREE.Matrix4().makeRotationY(ry)).translate(x, yy, z), ['#ffffff']));
      }
    }
    // lierre : des lianes qui tombent du haut du mur, côté dehors
    if (a1 - a0 > 3) for (let k = 0; k < 2; k++) {
      if (r() < 0.35) continue;
      const t0 = mix(a0 + 0.8, a1 - 0.8, r()), len = 2 + r() * 5, pts = [], ry = Math.atan2(nx, nz);
      for (let i = 0; i <= 6; i++) pts.push(spot(t0 + Math.sin(i * 1.3 + k) * 0.35, y1 - 0.1 - (len * i) / 6, 1, 0.08));
      K.push(pc(stem(pts, 0.05, 0.03, 4, 18), ['#5a7a3a', '#3a5a28']));
      for (let i = 0; i < len / 0.3; i++) {
        const q = pts[Math.min(6, Math.floor((i * 0.3 / len) * 6))], sd = i % 2 ? 1 : -1, d = 0.12 + r() * 0.1;
        const [lx, ly, lz] = alongX ? [q[0] + sd * d, q[1] - (i * 0.3) % (len / 6), q[2] + nz * 0.06] : [q[0] + nx * 0.06, q[1] - (i * 0.3) % (len / 6), q[2] + sd * d];
        K.push(pc(blob(0.17 + r() * 0.06, { sz: 0.25, detail: 1, lump: 0.2, seed: i }), ['#7ac85a', '#3f8a3a'], lx, ly, lz, 0, ry + (r() - 0.5) * 0.6, (r() - 0.5) * 1.2));
      }
    }
  }
  // Planchers : une moulure arrondie sur le bord extérieur de la tour, perlée aux jonctions
  if (b.floor) for (const [k, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
    const edge = b.c[k] + sg * b.h[k];
    if (Math.abs(edge) < 15.99) continue;
    const o = k ? 2 : 0, a0 = b.c[o] - b.h[o], a1 = b.c[o] + b.h[o], yt = b.c[1] + b.h[1] - 0.18, yb = b.c[1] - b.h[1] + 0.12;
    const P = (t, y, out) => (k ? [t, y, edge + sg * out] : [edge + sg * out, y, t]);
    K.push(pc(stem([P(a0, yt, 0.06), P(a1, yt, 0.06)], 0.24, 0.24, 8, 2), [light, side]), pc(stem([P(a0, yb, 0.02), P(a1, yb, 0.02)], 0.13, 0.13, 6, 2), [side, dark]));
    for (const t of [a0, a1]) K.push(pc(blob(0.3, { detail: 2, lump: 0.05 }), [light, side], ...P(t, yt, 0.06)));
  }
  if (!K.length && !G.length) return null;
  const g = new THREE.Group();
  if (K.length) g.add(mesh(fuse(K), MAT.clay, false));
  if (G.length) g.add(new THREE.Mesh(fuse(G), winGlow));
  return g;
}
