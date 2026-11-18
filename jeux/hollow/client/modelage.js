// THE HOLLOW — les outils de modelage communs à toutes les strates : tout est façonné par le code, aucun modèle importé.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, noise } from './terrain.js';

export const TAU = Math.PI * 2;
export const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ---------- Outils de modelage ---------- */
// peint une forme : dégradé de la base (b) au sommet (a), taches douces
export function paint(g, a, b = a, jit = 0.06) {
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
export const clean = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
export const merge = gs => mergeGeometries(gs.map(clean));
// une boule bosselée (feuillage, rochers) : top coupe le dessus à plat
export function lump(r, { sx = 1, sy = 1, sz = 1, lumpy = 0.25, seed = 1, detail = 3, top = null } = {}) {
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
export function tube(pts, r0, r1 = r0, radial = 8, seg = 16) {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c); const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}
export const cast = o => { o.layers.enable(1); return o; }; // ce qui porte une ombre

