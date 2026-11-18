// THE HOLLOW — Strate 05, les Terres organiques. On n'est plus dans un paysage : on est dans un corps. Le sol est tiède,
// tout est arrondi, poli par les Nettoyeurs ; une lueur orangée traverse les parois minces, l'air est laiteux, et le
// « haut » est une membrane pâle veinée de rouge. Aucune autre strate n'a de couleurs chaudes.
// On arrive au fond de la cavité. Le Battement (jamais vu, toujours entendu, plus fort en approchant) vient du dos d'un
// Hôte : une créature immobile, si grande qu'elle fait un plateau de 120 m, couvert d'une forêt de corail. On n'y monte
// qu'en escaladant les parois vivantes (des piliers de chair veinés de rouge, hero.js : mode escalade) reliés par des
// côtes sur lesquelles on marche. Là-haut, la Greffée et le cœur ; à son pied, la Valve : la suite (fermée au départ).
// Côtes géantes, vertèbres, dômes de corail percés comme une éponge, coquilles à moitié enterrées, corail-poumon qui
// respire au rythme du Battement, bouches-fleurs qui se referment au passage, Nettoyeurs en file sur les os.
import * as THREE from 'three';
import { fbm, lidPlane } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { createGround, sectors } from './sol.js';
import { createStory } from './greffee.js';
import { createPopulation } from './population.js';
import { abyss } from './sol.js';

/* ---------- Le relief : un sol tiède, le dos de l'Hôte, les piliers vivants, les côtes-ponts ---------- */
export const R_CAV = 1500;
export const MESA = { x: 240, z: -160, a: 150, b: 115, top: 122 };
const D = new THREE.Vector2(-1, 0.7).normalize(); // de l'Hôte vers l'arrivée
export const HEART = { x: MESA.x + 40, z: MESA.z, r: 20 };
export const VALVE = { x: MESA.x - 55, z: MESA.z + 40, R: 13 };
export const gates = { valve: false };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mesaE = (x, z) => ((x - MESA.x) / MESA.a) ** 2 + ((z - MESA.z) / MESA.b) ** 2 + (fbm(x * 0.03, z * 0.03) - 0.5) * 0.12;
export function floorAt(x, z) {
  if (Math.hypot(x - VALVE.x, z - VALVE.z) < VALVE.R + (fbm(x * 0.2, z * 0.2) - 0.5) * 3) return -400;
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.003 + 2, z * 0.003) - 0.5) * 36 + (fbm(x * 0.02, z * 0.02) - 0.5) * 5 + (fbm(x * 0.1, z * 0.1) - 0.5) * 0.8;
  // le dos de l'Hôte : un plateau bombé, et une falaise de chair tout autour
  const e = mesaE(x, z);
  if (e < 1) h = Math.max(h, MESA.top + (1 - e) * 12); else if (e < 1.06) h = Math.max(h, MESA.top * (1 - (e - 1) / 0.06));
  if (r > R_CAV - 250) { const d = (r - R_CAV + 250) / 30; h += d * d * 8; } // la paroi de la cavité
  return h;
}
// le bord du plateau dans une direction (depuis son centre)
const edge = (dx, dz) => 1 / Math.sqrt((dx / MESA.a) ** 2 + (dz / MESA.b) ** 2);
const rot = (v, a) => new THREE.Vector2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
// les parois vivantes : trois piliers de chair, du plus bas au plus haut, vers le plateau
export const CLIMBS = [];
export const BRIDGES = [];
{
  const tE = edge(D.x, D.y), c3 = new THREE.Vector2(MESA.x, MESA.z).addScaledVector(D, tE + 24);
  const c2 = c3.clone().add(rot(D, 0.7).multiplyScalar(58)), c1 = c2.clone().add(rot(D, -0.6).multiplyScalar(52));
  CLIMBS.push({ x: c1.x, z: c1.y, r: 6.5, top: 46 }, { x: c2.x, z: c2.y, r: 7, top: 88 }, { x: c3.x, z: c3.y, r: 8, top: 130 });
  // une côte-pont part du sommet d'un pilier et s'appuie contre le suivant, à la même hauteur (on y grimpe ensuite)
  for (let i = 0; i < 2; i++) {
    const A = CLIMBS[i], B = CLIMBS[i + 1], u = new THREE.Vector2(B.x - A.x, B.z - A.z).normalize();
    BRIDGES.push({ a: [A.x + u.x * (A.r - 2), A.z + u.y * (A.r - 2)], b: [B.x - u.x * (B.r + 0.2), B.z - u.y * (B.r + 0.2)], ha: A.top, hb: A.top, w: 1.7, arc: 3 });
  }
  // la dernière côte descend du dernier pilier sur le dos de l'Hôte
  const C = CLIMBS[2], to = new THREE.Vector2(MESA.x, MESA.z).addScaledVector(D, tE - 10);
  BRIDGES.push({ a: [C.x - D.x * (C.r - 2), C.z - D.y * (C.r - 2)], b: [to.x, to.y], ha: C.top, hb: floorAt(to.x, to.y), w: 1.7, arc: 2 });
}
function bridgeAt(B, x, z) {
  const [ax, az] = B.a, [bx, bz] = B.b, L2 = (bx - ax) ** 2 + (bz - az) ** 2;
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)), px = ax + (bx - ax) * t, pz = az + (bz - az) * t, d = Math.hypot(x - px, z - pz);
  return d > B.w ? null : B.ha + (B.hb - B.ha) * t + Math.sin(Math.PI * t) * B.arc - (d / B.w) ** 2 * 0.3;
}
export { bridgeAt };
// le terrain à plusieurs étages : le sol, les sommets des piliers, les côtes-ponts, la Valve fermée ; la plus haute
// surface sous « below »
// un passage fermé porte à la hauteur de son bord, du côté d'où l'on arrive (sinon, du côté bas, on passe dessous)
// (un plan ajusté sur le bord : voir lidPlane)
export function terrain(x, z, below = Infinity) {
  let best = -Infinity, f = floorAt(x, z);
  if (f < -100 && !gates.valve && Math.hypot(x - VALVE.x, z - VALVE.z) < VALVE.R + 4) f = valveLid(x, z);
  if (f > -100 && f <= below) best = f;
  for (const C of CLIMBS) if (Math.hypot(x - C.x, z - C.z) < C.r && C.top <= below && C.top > best) best = C.top;
  for (const B of BRIDGES) { const h = bridgeAt(B, x, z); if (h !== null && h <= below && h > best) best = h; }
  return best === -Infinity ? { h: -1e4, kind: 'void' } : { h: best, kind: 'ground' };
}
const valveLid = lidPlane(floorAt, VALVE, 5);
export const exitAt = (x, z) => gates.valve && Math.hypot(x - VALVE.x, z - VALVE.z) < VALVE.R + 3;
export const spawn = () => { const x = MESA.x + D.x * 470, z = MESA.z + D.y * 470; return [x, floorAt(x, z), z]; };
// la sève (l'encre de cette strate) : des grappes rouge vif sur le corail-poumon ; peu au sol, plus en haut des piliers
export const SAP = [];
{
  const [sx, , sz] = spawn(), c1 = CLIMBS[0];
  for (const k of [0.35, 0.6, 0.85]) { const x = sx + (c1.x - sx) * k + (k - 0.6) * 30, z = sz + (c1.z - sz) * k; SAP.push([x, floorAt(x, z), z]); }
  for (const C of CLIMBS) SAP.push([C.x + 1.5, C.top, C.z - 1.5]);
  for (const a of [0.8, 2.6]) { const x = MESA.x + Math.cos(a) * 70, z = MESA.z + Math.sin(a) * 55; SAP.push([x, floorAt(x, z), z]); }
}

/* ---------- Les formes ---------- */
// un pilier vivant : de la chair veinée de rouge, des tendons en anneaux, une vertèbre pour sommet
function climbGeometry(C) {
  const base = floorAt(C.x, C.z) - 3, h = C.top - base, g = new THREE.CylinderGeometry(1, 1.15, h, 26, Math.max(6, Math.round(h / 3)), true).translate(0, base + h / 2, 0), p = g.attributes.position;
  const col = new Float32Array(p.count * 3), a = new THREE.Color('#e89070'), b = new THREE.Color('#8a3a2a'), v = new THREE.Color('#e83a3a'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), an = Math.atan2(z, x), R = C.r * (1 + (fbm(an * 2 + C.top, y * 0.08) - 0.5) * 0.08 + Math.max(0, Math.sin(y * 0.55)) ** 8 * 0.06);
    p.setXYZ(i, C.x + Math.cos(an) * R, y, C.z + Math.sin(an) * R);
    c.copy(b).lerp(a, 0.4 + (fbm(an * 3, y * 0.05) - 0.5)); if (Math.abs(Math.sin(an * 4 + y * 0.09 + Math.sin(y * 0.05) * 2)) < 0.09) c.copy(v);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cap = paint(lump(1, { sx: C.r * 1.15, sy: 1.6, sz: C.r * 1.15, lumpy: 0.12, detail: 3, top: 0.2 }).translate(C.x, C.top - 0.2, C.z), '#fff6e8', '#d8c0a0');
  return merge([g, cap]);
}
// une vertèbre (empilées, elles font des piliers d'os) : un disque, deux apophyses
const vertebra = () => merge([paint(lump(1, { sx: 1, sy: 0.45, sz: 1, lumpy: 0.1, detail: 2 }), '#fff6e8', '#d8c0a0'), paint(tube([[0, 0, 0], [1.5, 0.3, 0], [2.3, -0.2, 0]], 0.35, 0.15, 6, 6), '#fff6e8', '#d8c0a0'), paint(tube([[0, 0, 0], [-1.5, 0.3, 0], [-2.3, -0.2, 0]], 0.35, 0.15, 6, 6), '#fff6e8', '#d8c0a0'), paint(tube([[0, 0, 0], [0, 0.2, -1.4], [0, -0.4, -2.2]], 0.3, 0.12, 6, 6), '#fff6e8', '#d8c0a0')]);
// un dôme de corail percé de trous ronds, comme une éponge
function domeGeometry(x, z, R, seed) {
  const g = new THREE.SphereGeometry(R, 72, 36, 0, TAU, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 0.02 + seed, p.getZ(i) * 0.02 + p.getY(i) * 0.02) - 0.5; p.setXYZ(i, p.getX(i) * (1 + n * 0.1), p.getY(i) * 0.8 * (1 + n * 0.1), p.getZ(i) * (1 + n * 0.1)); }
  g.computeVertexNormals();
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const cx = (p.getX(idx[i]) + p.getX(idx[i + 1]) + p.getX(idx[i + 2])) / 3, cy = (p.getY(idx[i]) + p.getY(idx[i + 1]) + p.getY(idx[i + 2])) / 3, cz = (p.getZ(idx[i]) + p.getZ(idx[i + 1]) + p.getZ(idx[i + 2])) / 3;
    const an = Math.atan2(cz, cx), el = Math.atan2(cy, Math.hypot(cx, cz)), cell = [Math.round(an * 7), Math.round(el * 7)], ca = cell[0] / 7, ce = cell[1] / 7;
    const hole = ((cell[0] * 7 + cell[1] * 13 + seed) % 3 === 0) && Math.hypot((an - ca) * Math.cos(el), el - ce) < 0.05;
    if (!hole) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(keep); g.translate(x, floorAt(x, z) - R * 0.1, z);
  return paint(g, '#f09a70', '#b0442a', 0.1);
}
// une coquille géante à moitié enterrée : une spirale qui s'ouvre
function shellGeometry(x, z, R, a0) {
  const K = [];
  for (let k = 0; k < 14; k++) { const t = k / 13, r = R * (0.25 + t * 0.75), a = a0 + t * 4.2; K.push(paint(new THREE.TorusGeometry(r * 0.55, r * 0.32, 10, 18, Math.PI * 0.9).rotateZ(Math.PI * 0.05).rotateY(a).translate(x + Math.cos(a) * r * 0.3, floorAt(x, z) - R * 0.25 + t * R * 0.2, z + Math.sin(a) * r * 0.3), '#fff6e8', '#e8b090', 0.08)); }
  return merge(K);
}

/* ---------- La strate ---------- */
export const LOOK = {
  name: 'Les Terres organiques', sun: [0.25, 1, 0.1], sunCol: '#ffb070', shadowCol: '#8a3a2a', fog: '#ead8b8', density: 0.0024, shadows: true,
  pal: [[0.92, 0.78, 0.62], [0.96, 0.88, 0.7], [0.91, 0.55, 0.42], [1, 0.96, 0.9], [0.82, 0.62, 0.5], [0.91, 0.44, 0.35], [0.91, 0.23, 0.23], [1, 0.96, 0.9]],
  skyMid: '#f0c8a0', skyTop: '#fff0dc', abyssY: -1e5,
};

export function create(scene, Q, ctx = {}) {
  const live = { colliders: [] }, r = rng(51), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), e3 = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  live.ground = createGround(scene, floorAt, (cx, cz, c) => Math.hypot(cx, cz) - c > R_CAV + 300);
  { const [x0, , z0] = spawn(); live.ground({ x: x0, z: z0 }, 1e6); }
  // le cœur qui bat : bpm, force ; env : l'enveloppe du « poum-poum » (0 à 1) ; onBeat : à chaque coup
  const H = { bpm: 46, amp: 1, phase: 0, env: 0, onBeat: null };
  // la membrane : le « haut », pâle, veinée de rouge, que la lumière traverse
  {
    const g = new THREE.SphereGeometry(R_CAV + 80, 128, 40, 0, TAU, 0, Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#fff0dc'), v = new THREE.Color('#d0503a'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 0.003, z * 0.003); p.setXYZ(i, x, y * 0.36 + 40 + (n - 0.5) * 50, z); c.copy(a); const vein = Math.abs(fbm(x * 0.004 + 9, z * 0.004) - 0.5) < 0.012 || Math.abs(fbm(x * 0.011, z * 0.011 + 4) - 0.5) < 0.008; if (vein) c.lerp(v, 0.8); col.set([c.r, c.g, c.b], i * 3); }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    live.membrane = new THREE.Mesh(g, ink({ line: 0.5, trans: 0.9, glow: 0.35, side: THREE.DoubleSide })); scene.add(live.membrane);
  }
  // les côtes géantes : de grands arcs d'os qui traversent la cavité ; et une cage de côtes au-dessus du chemin
  const ribs = [], K = [];
  for (let k = 0; k < 9; k++) {
    const a = r() * TAU, d = 300 + r() * 700, x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, b = a + Math.PI * (0.6 + r() * 0.5), d2 = 300 + r() * 700, x1 = Math.cos(b) * d2, z1 = Math.sin(b) * d2, h = 250 + r() * 170;
    const pts = [[x0, floorAt(x0, z0) - 6, z0], [(x0 * 2 + x1) / 3, h, (z0 * 2 + z1) / 3], [(x0 + x1 * 2) / 3, h * 0.95, (z0 + z1 * 2) / 3], [x1, floorAt(x1, z1) - 6, z1]];
    if (pts.some(([x, , z]) => mesaE(x, z) < 1.3)) continue;
    K.push(paint(tube(pts, 14 + r() * 6, 9, 14, 60), '#fff6e8', '#e0c8a8', 0.06)); ribs.push(new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v))));
    live.colliders.push([x0, z0, 15], [x1, z1, 15]);
  }
  {
    const [sx, , sz] = spawn(), side = new THREE.Vector2(-D.y, D.x);
    for (let k = 0; k < 7; k++) {
      const cx = sx - D.x * (60 + k * 24), cz = sz - D.y * (60 + k * 24), w = 70 - Math.abs(k - 3) * 6, h = 80 - Math.abs(k - 3) * 8;
      const pts = [[cx + side.x * w, floorAt(cx + side.x * w, cz + side.y * w) - 4, cz + side.y * w], [cx + side.x * w * 0.6, h, cz + side.y * w * 0.6], [cx - side.x * w * 0.5, h * 1.05, cz - side.y * w * 0.5], [cx - side.x * w, floorAt(cx - side.x * w, cz - side.y * w) - 4, cz - side.y * w]];
      K.push(paint(tube(pts, 4.5, 3, 10, 40), '#fff6e8', '#e0c8a8', 0.06)); ribs.push(new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v))));
      live.colliders.push([pts[0][0], pts[0][2], 5], [pts[3][0], pts[3][2], 5]);
    }
  }
  // les piliers d'os (vertèbres empilées), qui ne s'escaladent pas : ils sont lisses
  const vg = vertebra(), vList = [];
  for (let k = 0, n = 0; k < 14 && n < 300; n++) {
    const a = r() * TAU, d = 200 + r() * 1000, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (mesaE(x, z) < 1.4 || CLIMBS.some(C => Math.hypot(C.x - x, C.z - z) < 50)) continue;
    const h = 60 + r() * 160, s = 4 + r() * 3, y0 = floorAt(x, z);
    for (let y = y0; y < y0 + h; y += s * 1.1) vList.push([x, y, z, s, r() * 0.3]);
    live.colliders.push([x, z, s * 1.1, y0 + h]); k++;
  }
  sectors(scene, vg, ink({ line: 0.9 }), vList, ([x, y, z, s, t], m) => m.compose(p3.set(x, y, z), q.setFromEuler(e3.set(0, t * 20, (t - 0.15) * 0.3)), s3.setScalar(s)));
  scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 1, trans: 0.25 }))));
  // les parois vivantes : elles respirent et luisent un peu (on les reconnaît de loin)
  scene.add(cast(new THREE.Mesh(merge(CLIMBS.map(climbGeometry)), ink({ line: 0.9, glow: 0.12, pulse: 1, trans: 0.5 }))));
  for (const C of CLIMBS) live.colliders.push([C.x, C.z, C.r, C.top]);
  // les côtes-ponts du chemin
  scene.add(cast(new THREE.Mesh(merge(BRIDGES.map(B => { const n = 24, pts = []; for (let i = 0; i <= n; i++) { const t = i / n, x = B.a[0] + (B.b[0] - B.a[0]) * t, z = B.a[1] + (B.b[1] - B.a[1]) * t; pts.push([x, bridgeAt(B, x, z) - 1.55, z]); } return paint(tube(pts, 1.6, 1.4, 10, 48).scale(1, 1, 1), '#fff6e8', '#e0c8a8', 0.05); })), ink({ line: 1 }))));
  // les dômes de corail percés, et les coquilles à moitié enterrées
  {
    const G = [];
    const big = MESA.x - D.x * 420, bigz = MESA.z - D.y * 420; G.push(domeGeometry(big, bigz, 240, 3)); live.colliders.push([big, bigz, 230]);
    for (let k = 0, n = 0; k < 8 && n < 300; n++) {
      const a = r() * TAU, d = 250 + r() * 950, x = Math.cos(a) * d, z = Math.sin(a) * d, R = 40 + r() * 70;
      if (mesaE(x, z) < 1.8 || Math.hypot(x - big, z - bigz) < 260 + R || CLIMBS.some(C => Math.hypot(C.x - x, C.z - z) < R + 40) || Math.hypot(x - spawn()[0], z - spawn()[2]) < R + 60) continue;
      G.push(domeGeometry(x, z, R, k + 5)); live.colliders.push([x, z, R * 0.95, floorAt(x, z) + R * 0.7]); k++;
    }
    scene.add(cast(new THREE.Mesh(merge(G), ink({ line: 1, trans: 0.7, side: THREE.DoubleSide }))));
    const S = [];
    for (let k = 0, n = 0; k < 6 && n < 200; n++) {
      const a = r() * TAU, d = 200 + r() * 900, x = Math.cos(a) * d, z = Math.sin(a) * d, R = 18 + r() * 25;
      if (mesaE(x, z) < 1.5 || CLIMBS.some(C => Math.hypot(C.x - x, C.z - z) < R + 30) || Math.hypot(x - spawn()[0], z - spawn()[2]) < R + 40) continue;
      S.push(shellGeometry(x, z, R, r() * TAU)); live.colliders.push([x, z, R * 0.7]); k++;
    }
    scene.add(cast(new THREE.Mesh(merge(S), ink({ line: 1, trans: 0.35 }))));
  }
  // la forêt de corail sur le dos de l'Hôte, et son œil, sur la falaise, du côté de l'arrivée
  {
    const T = [];
    for (let k = 0; k < 90; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.9, x = MESA.x + Math.cos(a) * MESA.a * d, z = MESA.z + Math.sin(a) * MESA.b * d;
      if (Math.hypot(x - HEART.x, z - HEART.z) < HEART.r + 30 || Math.hypot(x - VALVE.x, z - VALVE.z) < 30 || BRIDGES.some(B => bridgeAt({ ...B, w: 14 }, x, z) !== null)) continue;
      const y = floorAt(x, z), h = 6 + r() * 14;
      for (let i = 0; i < 4; i++) { const b = r() * TAU; T.push(paint(tube([[x, y - 0.5, z], [x + Math.cos(b) * h * 0.2, y + h * 0.5, z + Math.sin(b) * h * 0.2], [x + Math.cos(b) * h * 0.45, y + h, z + Math.sin(b) * h * 0.45]], 0.9, 0.25, 6, 8), '#f09a70', '#b0442a')); }
      live.colliders.push([x, z, 1.4]);
    }
    scene.add(cast(new THREE.Mesh(merge(T), ink({ line: 0.8, trans: 0.6, wind: 0.01 }))));
    const tE = edge(-D.y, D.x), ex = MESA.x - D.y * (tE + 7), ez = MESA.z + D.x * (tE + 7);
    const eye = new THREE.Group(); eye.position.set(ex, MESA.top * 0.55, ez); eye.rotation.y = -Math.atan2(D.x, -D.y); // il regarde vers le dehors
    const ball = new THREE.Mesh(paint(lump(1, { sx: 0.4, sy: 7, sz: 7, detail: 3 }), '#fff0a0', '#e8a040'), ink({ glow: 1.2, line: 0.5 }));
    const pupil = new THREE.Mesh(paint(lump(1, { sx: 0.5, sy: 5.5, sz: 1, detail: 2 }).translate(0.4, 0, 0), '#1a0a08'), ink({ line: 0.3 }));
    const lidU = new THREE.Mesh(paint(lump(1, { sx: 1.6, sy: 4.5, sz: 8, detail: 3 }), '#e89070', '#8a3a2a'), ink({ line: 1 })), lidD = lidU.clone();
    eye.add(ball, pupil, lidU, lidD); scene.add(eye); live.eye = { lidU, lidD, open: 0 };
  }
  // le cœur : un organe énorme, des vaisseaux qui montent dans la membrane et plongent dans l'Hôte ; une bouche à son pied
  const heart = new THREE.Group();
  {
    const y = floorAt(HEART.x, HEART.z), G = [paint(lump(HEART.r, { sx: 1, sy: 1.25, sz: 0.9, lumpy: 0.25, detail: 4, seed: 7 }).translate(0, HEART.r * 1.05, 0), '#f07a5a', '#8a2a20', 0.1)];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + 0.3, up2 = k % 2; G.push(paint(tube(up2 ? [[Math.cos(a) * 8, HEART.r * 2, Math.sin(a) * 8], [Math.cos(a) * 20, 160, Math.sin(a) * 20], [Math.cos(a) * 60, 300, Math.sin(a) * 50], [Math.cos(a) * 90, 470, Math.sin(a) * 80]] : [[Math.cos(a) * 12, HEART.r * 0.6, Math.sin(a) * 12], [Math.cos(a) * 30, 2, Math.sin(a) * 30], [Math.cos(a) * 46, -6, Math.sin(a) * 46]], up2 ? 2.6 : 2, up2 ? 1.2 : 0.8, 12, 40), '#d0503a', '#7a2018')); }
    // deux renflements (les oreillettes), et des veines claires
    for (const s of [-1, 1]) G.push(paint(lump(HEART.r * 0.45, { lumpy: 0.25, detail: 3, seed: 8 + s }).translate(s * HEART.r * 0.5, HEART.r * 1.9, -HEART.r * 0.2), '#e8705a', '#a03a2a'));
    heart.add(cast(new THREE.Mesh(merge(G), ink({ line: 1, trans: 0.55, glow: 0.15 }))));
    const mouth = new THREE.Mesh(paint(new THREE.TorusGeometry(4, 1.6, 10, 24).rotateY(Math.PI / 2), '#e8705a', '#8a3a2a'), ink({ line: 0.9 })); mouth.position.set(-HEART.r - 1, 4, 0); heart.add(mouth);
    const throat = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20).rotateY(-Math.PI / 2), ink({ color: '#2a0a08', vertexColors: false, line: 0.2 })); throat.position.set(-HEART.r - 0.6, 4, 0); heart.add(throat);
    heart.position.set(HEART.x, y, HEART.z); scene.add(heart);
    live.colliders.push([HEART.x, HEART.z, HEART.r + 1]);
  }
  // le corail-poumon : des touffes orange qui se gonflent au rythme du Battement
  const lung = [], lungG = merge([0, 1, 2, 3, 4].map(k => paint(lump(0.7, { sy: 1.3, lumpy: 0.3, detail: 1, seed: k }).translate(Math.cos(k * 1.3) * 0.7, 0.8 + (k % 2) * 0.4, Math.sin(k * 1.3) * 0.7), '#ff9a5a', '#c84a2a')));
  for (let k = 0; k < Q.shrooms; k++) { const a = r() * TAU, d = r() * (R_CAV - 260), x = Math.cos(a) * d, z = Math.sin(a) * d, h = floorAt(x, z); if (h > -100) lung.push([x, h, z, 1 + r() * 2.5, r() * TAU]); }
  const lungM = new THREE.InstancedMesh(lungG, ink({ line: 0.5, trans: 0.7, glow: 0.2 }), lung.length); scene.add(cast(lungM));
  // les bouches-fleurs : des ombelles qui se referment quand on approche (et se rouvrent lentement)
  const mouthG = merge([paint(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6).translate(0, 0.6, 0), '#e8b090', '#8a3a2a'), ...[0, 1, 2, 3, 4, 5].map(k => paint(new THREE.SphereGeometry(0.6, 8, 6, 0, 1.1, 0, Math.PI / 2).scale(1, 1.6, 1).rotateY((k / 6) * TAU).translate(0, 1.2, 0), '#fff6e8', '#e83a3a'))]);
  const flowers = [];
  for (let k = 0; k < Q.sensitives; k++) { const a = r() * TAU, d = r() * (R_CAV - 300), x = Math.cos(a) * d, z = Math.sin(a) * d, h = floorAt(x, z); if (h > -100) flowers.push({ x, y: h, z, s: 1 + r() * 1.5, k: 1, ry: r() * TAU }); }
  const flowM = new THREE.InstancedMesh(mouthG, ink({ line: 0.6, glow: 0.15 }), flowers.length); scene.add(flowM);
  flowers.forEach((o, i) => flowM.setMatrixAt(i, m4.compose(p3.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.ry), s3.setScalar(o.s))));
  // les Nettoyeurs : de petits êtres pâles qui parcourent les côtes en file
  const NET = Q.flock, netM = new THREE.InstancedMesh(paint(lump(0.35, { sx: 1.6, sy: 0.7, lumpy: 0.15, detail: 1 }), '#fffaf0', '#d8c8b8'), ink({ line: 0.5 }), NET); netM.frustumCulled = false; scene.add(netM);
  const nets = Array.from({ length: NET }, (_, k) => ({ c: ribs[k % ribs.length], u: ((k / ribs.length) | 0) * 0.004 + r() * 0.0005, sp: 0.004 + (k % 3) * 0.001 }));
  // une poussière laiteuse en suspension autour du voyageur
  const dustN = Q.spores, dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), glowy({ color: '#fff6e8', alpha: 0.7, soft: 0.2 }), dustN), du0 = [];
  dust.frustumCulled = false; scene.add(dust);
  for (let k = 0; k < dustN; k++) du0.push([r() * 140 - 70, r() * 50 - 10, r() * 140 - 70, r() * TAU, 0.5 + r()]);

  let last = 0;
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  live.update = (t, hero) => {
    const dt = Math.min(0.05, last ? t - last : 0.016); last = t;
    live.ground(hero);
    U.uHero.value.copy(hero); U.uReact.value = 0.3;
    // le Battement : un coup double (poum-poum), plus ou moins fort et rapide selon ce qu'on lui a fait
    const before = H.phase; H.phase += (dt * H.bpm) / 60;
    if (Math.floor(H.phase) > Math.floor(before) && H.amp > 0.02) H.onBeat?.();
    const f = H.phase % 1; H.env = (Math.exp(-f * 9) + (f > 0.28 ? 0.6 * Math.exp(-(f - 0.28) * 12) : 0)) * H.amp;
    heart.scale.setScalar(1 + H.env * 0.06); live.membrane.material.uniforms.uGlow.value = 0.3 + H.env * 0.25;
    lung.forEach(([x, y, z, s, ph], i) => lungM.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromAxisAngle(up, ph), s3.setScalar(s * (0.85 + H.env * 0.25 + Math.sin(t * 0.8 + ph) * 0.04)))));
    lungM.instanceMatrix.needsUpdate = true;
    let dirty = false;
    flowers.forEach((o, i) => {
      const near = Math.hypot(o.x - hero.x, o.z - hero.z) < 5 && Math.abs(o.y - hero.y) < 4, want = near ? 0.25 : 1;
      if (Math.abs(o.k - want) < 0.005) return;
      o.k += (want - o.k) * (near ? 0.25 : 0.01); dirty = true;
      flowM.setMatrixAt(i, m4.compose(p3.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.ry), s3.set(o.s * (0.4 + o.k * 0.6), o.s * (0.7 + o.k * 0.3), o.s * (0.4 + o.k * 0.6))));
    });
    if (dirty) flowM.instanceMatrix.needsUpdate = true;
    nets.forEach((N, i) => {
      N.u = (N.u + N.sp * dt) % 1; N.c.getPointAt(N.u, a3); N.c.getPointAt(Math.min(1, N.u + 0.002), b3);
      m4.lookAt(b3, a3, up); q.setFromRotationMatrix(m4);
      netM.setMatrixAt(i, m4.compose(a3.addScaledVector(up, 0.5 + Math.sin(i) * 0.2), q, s3.setScalar(1 + Math.sin(t * 9 + i) * 0.05)));
    });
    netM.instanceMatrix.needsUpdate = true;
    du0.forEach(([x, y, z, ph, s], i) => {
      const X = hero.x + ((x + Math.sin(t * 0.15 + ph) * 4 + 70) % 140 + 140) % 140 - 70, Z = hero.z + ((z + t * 0.3 + 70) % 140 + 140) % 140 - 70, Y = hero.y + ((y + Math.sin(t * 0.2 + ph) * 2 + 10) % 50 + 50) % 50 - 10;
      dust.setMatrixAt(i, m4.compose(p3.set(X, Y, Z), q.setFromEuler(e3.set(0, t * 0.2 + ph, 0)), s3.setScalar(s)));
    });
    dust.instanceMatrix.needsUpdate = true;
    // l'œil de l'Hôte s'ouvre quand on marche sur son dos
    const on = hero.y > MESA.top - 4 && mesaE(hero.x, hero.z) < 1, E = live.eye;
    E.open += ((on ? 1 : 0) - E.open) * Math.min(1, dt * 0.4);
    E.lidU.position.y = 1.4 + E.open * 5.5; E.lidD.position.y = -1.4 - E.open * 5.5;
  };
  const start = spawn();
  // l'histoire : la Greffée, la sève, le Battement à nourrir ou à faire taire, la Valve
  const story = createStory(scene, { floorAt, mesa: MESA, heart: HEART, heartMesh: heart, H, valve: VALVE, gates, sap: SAP, start, look: LOOK, eye: live.eye, climbs: CLIMBS, ui: ctx.ui, hero: ctx.hero }), base = live.update;
  live.colliders.push(...story.colliders);
  // la Valve : une gorge de chair qui s'enfonce dans l'Hôte ; et un seul voyageur, assis, à moitié pris par le sol
  const throat = abyss(scene, { x: VALVE.x, z: VALVE.z, R: VALVE.R + 1, y: valveLid(VALVE.x, VALVE.z) - 2, depth: 110, wall: ['#e8705a', '#3a0a08'], mist: '#ff9a7a' });
  const pop = createPopulation(scene, { people: [{ kind: 'auditeur', home: [start[0] - D.x * 40 + 8, start[2] - D.y * 40], wander: 0, lines: ['C’est tiède… je reste encore un peu.', 'Tu entends ? Il bat. Il bat pour nous.'] }], ground: floorAt, ui: ctx.ui, seed: 51 });
  return Object.assign(live, {
    look: LOOK, terrain, start, climbs: CLIMBS,
    camYaw: Math.atan2(D.x, D.y), // la caméra derrière lui, il regarde vers l'Hôte
    hint: 'Les parois vivantes (veinées de rouge) s’escaladent : avance contre elles · Z/S monter, descendre · Q/D faire le tour · Espace se lâcher',
    exitAt, killY: safe => Math.min(safe.y - 40, -40), maxFall: 30, interact: story.interact, story, leave: story.leave,
    update(t, p) { base(t, p); story.update(t, p); pop.update(t, p); throat.update(t); },
    bounces: [12, 5],
  });
}
