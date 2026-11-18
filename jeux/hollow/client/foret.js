// THE HOLLOW — Strate 03, la Forêt des géants. Une forêt qui a perdu le soleil et a appris à s'éclairer elle-même.
// Elle remarque le voyageur : elle s'allume autour de lui quand il marche, s'éteint quand il court.
// Une grotte de 1,6 km sous une voûte percée de puits de lumière violette. On arrive en haut d'un champignon de 260 m
// et l'on descend de chapeau en chapeau (des paliers qui se chevauchent, 11 m plus bas à chaque fois ; tomber de plus
// de 30 m ramène au dernier appui), jusqu'au sol de mousse. Au fond, le gouffre où tombe une cascade : la suite.
// Les dessous des chapeaux luisent en rose et respirent par vagues ; les sensitives se ferment au passage ; les
// méduses d'air broutent les spores dans les rais et fuient ; les Porteurs défilent, un chapeau sur le dos ; l'Endormi,
// un champignon colossal, respire. Le relief est un pur calcul, à plusieurs étages (on passe sous les chapeaux).
import * as THREE from 'three';
import { fbm, noise, lidPlane } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { createGround, sectors } from './sol.js';
import { createStory } from './veilleuse.js';

/* ---------- Le relief : un sol de mousse, des chapeaux à plusieurs étages, le gouffre ---------- */
export const R_CAVE = 1600, EXIT = { x: -760, z: 520, R: 42 };
// le chemin des racines : un second passage, loin, dans le coin le plus noir de la grotte
export const ROOTS = { x: 1040, z: 660, R: 16 };
// les deux passages sont fermés au départ (un treillis de racines sur lequel on marche) ; l'histoire en ouvre un
export const gates = { main: false, roots: false };
export function floorAt(x, z) {
  const r = Math.hypot(x, z);
  if (Math.hypot(x - EXIT.x, z - EXIT.z) < EXIT.R + (fbm(x * 0.05, z * 0.05) - 0.5) * 10) return -400;
  if (Math.hypot(x - ROOTS.x, z - ROOTS.z) < ROOTS.R + (fbm(x * 0.1, z * 0.1) - 0.5) * 4) return -400;
  let h = (fbm(x * 0.003 + 5, z * 0.003) - 0.5) * 60 + (fbm(x * 0.02, z * 0.02) - 0.5) * 6 + (fbm(x * 0.09, z * 0.09) - 0.5) * 1.2;
  if (r > R_CAVE - 200) { const d = (r - R_CAVE + 200) / 30; h += d * d * 8; } // la paroi de la grotte
  return h;
}
// les chapeaux : le chemin (une spirale qui descend autour d'un bouquet de géants), puis les géants inaccessibles
const CAPS = [];
const SPIRAL = { x: 220, z: -260 };
{
  const r = rng(303);
  // chaque chapeau est posé contre le précédent, autour du bouquet : ils se chevauchent d'environ 10 m
  let ang = 0, prev = null;
  for (let i = 0; i < 26; i++) {
    // la spirale s'élargit à chaque chapeau (d'un tour à l'autre, les chapeaux ne s'empilent pas) ; l'angle est celui qui
    // met les deux centres à la bonne distance
    const R = i === 0 ? 40 : 24 + r() * 16, rad = 95 + i * 8;
    if (prev) { const d = prev.R + R - 10 - r() * 3, r1 = prev.rad, c = (r1 * r1 + rad * rad - d * d) / (2 * r1 * rad); ang += Math.acos(Math.max(-1, Math.min(1, c))); }
    const x = SPIRAL.x + Math.cos(ang) * rad, z = SPIRAL.z + Math.sin(ang) * rad, y = 262 - i * 11.4;
    if (y < floorAt(x, z) + 8) break;
    CAPS.push(prev = { x, z, y, R, rad, dome: R * 0.16, path: i, seed: i + 1, hue: r() });
  }
  // des géants, partout dans la grotte, de 80 à 420 m
  for (let k = 0; k < 46; k++) {
    for (let n = 0; n < 40; n++) {
      const a = r() * TAU, d = 120 + r() * (R_CAVE - 360), x = Math.cos(a) * d, z = Math.sin(a) * d, R = 30 + r() * r() * 140;
      if (CAPS.some(C => Math.hypot(C.x - x, C.z - z) < C.R + R + 30) || Math.hypot(x - EXIT.x, z - EXIT.z) < EXIT.R + R + 60 || Math.hypot(x - ROOTS.x, z - ROOTS.z) < ROOTS.R + R + 90 || Math.hypot(x - SPIRAL.x, z - SPIRAL.z) < 330 + R) continue;
      CAPS.push({ x, z, y: floorAt(x, z) + 80 + r() * 340, R, dome: R * (0.12 + r() * 0.1), seed: 100 + k, hue: r() }); break;
    }
  }
}
const capTop = (C, x, z) => { const d = Math.hypot(x - C.x, z - C.z); return d > C.R ? null : C.y + C.dome * (1 - (d / C.R) ** 2); };
// le terrain à plusieurs étages : la plus haute surface sous « below » (le voyageur passe sous les chapeaux)
const lidY = G => floorAt(G.x + G.R + 14, G.z);
// un passage fermé porte à la hauteur de son bord, du côté d'où l'on arrive (sinon, du côté bas, on passe dessous)
// (un plan ajusté sur le bord : voir lidPlane)
const lidMain = lidPlane(floorAt, EXIT, 10), lidRoots = lidPlane(floorAt, ROOTS, 5);
export function terrain(x, z, below = Infinity) {
  let best = -Infinity;
  let f = floorAt(x, z);
  // un passage fermé : on marche sur le treillis
  if (f < -100 && !gates.main && Math.hypot(x - EXIT.x, z - EXIT.z) < EXIT.R + 8) f = lidMain(x, z);
  if (f < -100 && !gates.roots && Math.hypot(x - ROOTS.x, z - ROOTS.z) < ROOTS.R + 4) f = lidRoots(x, z);
  if (f > -100 && f <= below) best = f;
  for (const C of CAPS) { const h = capTop(C, x, z); if (h !== null && h <= below && h > best) best = h; }
  return best === -Infinity ? { h: -1e4, kind: 'void' } : { h: best, kind: 'ground' };
}
export const caps = CAPS;
const PATH = CAPS.filter(C => C.path !== undefined);
export const exitAt = (x, z) => (gates.main && Math.hypot(x - EXIT.x, z - EXIT.z) < EXIT.R + 6) || (gates.roots && Math.hypot(x - ROOTS.x, z - ROOTS.z) < ROOTS.R + 3);
export const spawn = () => [CAPS[0].x, capTop(CAPS[0], CAPS[0].x, CAPS[0].z), CAPS[0].z];

/* ---------- Les formes ---------- */
// un champignon géant : chapeau bombé (violet), lamelles dessous (elles luisent), pied tordu veiné de bleu
function capGeometry(C) {
  const prof = [[0, C.dome], [C.R * 0.25, C.dome * 0.94], [C.R * 0.5, C.dome * 0.78], [C.R * 0.7, C.dome * 0.55], [C.R * 0.85, C.dome * 0.3], [C.R, 0], [C.R * 1.02, -C.R * 0.06], [C.R * 0.9, -C.R * 0.1], [C.R * 0.3, -C.R * 0.12], [0, -C.R * 0.1]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), n = fbm(x * 0.05 + C.seed, z * 0.05) - 0.5; p.setY(i, y + n * C.R * 0.03 * (y < 0 ? 1 : 0.3)); }
  g.computeVertexNormals(); g.translate(C.x, C.y, C.z);
  const top = C.hue < 0.5 ? ['#6a4aa8', '#24184a'] : ['#5a3a90', '#1c1440'];
  paint(g, ...top, 0.14);
  // des taches pâles sur le dessus, comme sur un vrai chapeau (vues de loin, elles disent l'échelle)
  const c = g.attributes.color, q = g.attributes.position, spot = new THREE.Color('#d8c8ff'), k = new THREE.Color();
  for (let i = 0; i < q.count; i++) { if (q.getY(i) < C.y) continue; const n = fbm((q.getX(i) - C.x) / C.R * 9 + C.seed, (q.getZ(i) - C.z) / C.R * 9); if (n > 0.66) { k.fromBufferAttribute(c, i).lerp(spot, Math.min(1, (n - 0.66) * 8)); c.setXYZ(i, k.r, k.g, k.b); } }
  return g;
}
function gillsGeometry(C) {
  const K = [], n = Math.round(24 + C.R);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, g = new THREE.PlaneGeometry(C.R * 0.62, C.R * 0.07, 4, 1);
    g.translate(C.R * 0.55, -C.R * 0.085, 0); g.rotateY(-a); g.translate(C.x, C.y, C.z); K.push(paint(g, '#ff8ae0', '#c84aa8', 0.05));
  }
  return merge(K);
}
function stemGeometry(C, base) {
  const r = rng(C.seed), h = C.y - base, w = C.R * 0.13 + 2, tw = (r() - 0.5) * C.R * 0.5;
  const g = tube([[C.x + tw, base - 4, C.z], [C.x - tw * 0.5, base + h * 0.4, C.z + tw * 0.4], [C.x + tw * 0.3, base + h * 0.8, C.z - tw * 0.2], [C.x, C.y - C.R * 0.08, C.z]], w * 1.35, w * 0.8, 12, 24);
  // des veines bleues qui montent le long du pied (peintes en bandes)
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#c8b8e8'), b = new THREE.Color('#4a3a7a'), v = new THREE.Color('#4a8aff'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ang = Math.atan2(z - C.z, x - C.x), vein = Math.abs(Math.sin(ang * 5 + y * 0.04)) < 0.08; c.copy(b).lerp(a, (y - base) / h); if (vein) c.lerp(v, 0.85); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// un Porteur : long corps fin sur six pattes grêles, un petit chapeau sur le dos
function porter() {
  const body = paint(lump(1, { sx: 2.4, sy: 0.6, sz: 0.7, lumpy: 0.1, detail: 2 }).translate(0, 3.2, 0), '#d8c8f0', '#6a5a98');
  const hat = paint(new THREE.LatheGeometry([[0, 1.2], [1.6, 0.9], [2.4, 0.2], [2.2, 0], [0.2, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 18).translate(0, 3.6, 0), '#ff6ad8', '#8a3aa8');
  const head = paint(lump(0.5, { detail: 1 }).translate(2.6, 3.4, 0), '#e8d8ff', '#8a7ab8');
  return merge([body, hat, head]);
}

/* ---------- La strate ---------- */
export const LOOK = {
  name: 'La Forêt des géants', sun: [0.18, 1, 0.12], sunCol: '#c8a8ff', shadowCol: '#1a1240', fog: '#2a1f4a', density: 0.0026, shadows: true,
  pal: [[0.27, 0.2, 0.44], [0.42, 0.32, 0.62], [0.12, 0.3, 0.42], [0.36, 0.3, 0.46], [0.18, 0.14, 0.3], [0.22, 0.52, 0.62], [1, 0.42, 0.85], [0.3, 0.9, 0.95]],
  skyMid: '#6a4aa8', skyTop: '#f0d8ff', abyssY: -1e5, // le sol de la grotte est vers 0 m : pas de noyade dans la brume
};

export function create(scene, Q, ctx = {}) {
  const live = { colliders: [] }, r = rng(31), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  live.ground = createGround(scene, floorAt, (cx, cz, c) => Math.hypot(cx, cz) - c > R_CAVE + 400);
  { const [x0, , z0] = spawn(); live.ground({ x: x0, z: z0 }, 1e6); } // tout le sol, avant la première image
  // la voûte : une coupole de roche à 700 m, percée de puits par où tombe une lumière violette
  const holes = Array.from({ length: 9 }, (_, k) => { const a = k * 2.4 + 0.5, d = 250 + (k % 3) * 330; return { x: Math.cos(a) * d, z: Math.sin(a) * d, R: 60 + (k % 4) * 30 }; });
  {
    const g = new THREE.SphereGeometry(R_CAVE + 120, 128, 48, 0, TAU, 0, Math.PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 0.004 + 3, z * 0.004 + y * 0.003) - 0.5; p.setXYZ(i, x * (1 + n * 0.06), y * 0.44 + n * 60, z * (1 + n * 0.06)); }
    g.computeVertexNormals();
    const idx = g.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 3) { const cx = (p.getX(idx[i]) + p.getX(idx[i + 1]) + p.getX(idx[i + 2])) / 3, cz = (p.getZ(idx[i]) + p.getZ(idx[i + 1]) + p.getZ(idx[i + 2])) / 3; if (!holes.some(h => Math.hypot(cx - h.x, cz - h.z) < h.R)) keep.push(idx[i], idx[i + 1], idx[i + 2]); }
    g.setIndex(keep);
    scene.add(new THREE.Mesh(paint(g, '#4a3a6a', '#1a1230', 0.12), ink({ line: 0.8, side: THREE.DoubleSide })));
    // les rais de lumière : de grands volumes pâles, du puits jusqu'au sol
    for (const h of holes) { const m = new THREE.Mesh(new THREE.CylinderGeometry(h.R * 0.8, h.R * 1.3, 760, 24, 1, true), glowy({ color: '#b89cff', alpha: 0.12, add: true, soft: 1 })); m.position.set(h.x, 340, h.z); scene.add(m); }
  }
  // les pleureuses : des lianes qui tombent de la voûte, la pointe qui luit
  {
    const K = [], T = [];
    for (let k = 0; k < Q.vines; k++) {
      const a = r() * TAU, d = r() * (R_CAVE - 200), x = Math.cos(a) * d, z = Math.sin(a) * d, top = 640 - (d / R_CAVE) ** 2 * 520, len = 60 + r() * 240;
      K.push(paint(tube([[x, top, z], [x + (r() - 0.5) * 8, top - len * 0.5, z + (r() - 0.5) * 8], [x + (r() - 0.5) * 14, top - len, z + (r() - 0.5) * 14]], 0.5 + r() * 0.8, 0.12, 5, 10), '#6a4a9a', '#2a1a48'));
      T.push(paint(lump(0.9 + r() * 0.8, { detail: 1, seed: k }).translate(x, top - len - 0.5, z), '#4ae8f0', '#2a8ab8'));
    }
    scene.add(new THREE.Mesh(merge(K), ink({ line: 0.6, wind: 0.002 })));
    scene.add(new THREE.Mesh(merge(T), ink({ line: 0.3, glow: 1.2, pulse: 1 })));
  }
  // les champignons : chapeaux (le chemin et les géants), lamelles qui luisent, pieds veinés
  const capMat = ink({ line: 1, side: THREE.DoubleSide }), gillMat = ink({ line: 0.35, glow: 1.4, pulse: 1, side: THREE.DoubleSide }), stemMat = ink({ line: 0.9, glow: 0.25, pulse: 1 });
  live.capMeshes = CAPS.map(C => {
    const base = floorAt(C.x, C.z), grp = new THREE.Group();
    grp.add(cast(new THREE.Mesh(capGeometry(C), capMat)), new THREE.Mesh(gillsGeometry(C), gillMat));
    scene.add(grp); scene.add(cast(new THREE.Mesh(stemGeometry(C, base), stemMat)));
    live.colliders.push([C.x, C.z, C.R * 0.13 + 2.6, C.y - C.R * 0.1]); // le pied gêne seulement sous le chapeau
    return grp;
  });
  // petits champignons lumineux en touffes, partout au sol
  {
    const g = merge([paint(new THREE.CylinderGeometry(0.08, 0.12, 1, 6).translate(0, 0.5, 0), '#e8d8ff', '#8a7ab8'), paint(new THREE.SphereGeometry(0.4, 10, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 1, 0), '#ff6ad8', '#c83ab8')]);
    const list = [];
    for (let k = 0; k < Q.shrooms; k++) { const a = r() * TAU, d = r() * (R_CAVE - 220), cx = Math.cos(a) * d, cz = Math.sin(a) * d; for (let i = 0; i < 6; i++) { const x = cx + (r() - 0.5) * 6, z = cz + (r() - 0.5) * 6, h = floorAt(x, z); if (h > -100) list.push([x, h, z, 0.6 + r() * 2.4, r()]); } }
    sectors(scene, g, ink({ line: 0.5, glow: 0.8, pulse: 1 }), list, ([x, y, z, s], m) => m.compose(p3.set(x, y, z), q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * TAU, (r() - 0.5) * 0.3)), s3.setScalar(s)), false);
  }
  // le gouffre : une lèvre de roche, la cascade qui tombe de la voûte et s'y engouffre, un halo cyan
  {
    const K = [];
    for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU, x = EXIT.x + Math.cos(a) * (EXIT.R + 4), z = EXIT.z + Math.sin(a) * (EXIT.R + 4); K.push(paint(lump(3 + r() * 4, { detail: 1, lumpy: 0.4, seed: k }).translate(x, floorAt(x + Math.cos(a) * 6, z + Math.sin(a) * 6), z), '#5a4a7a', '#2a1a48')); }
    scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 1 }))));
    const w = new THREE.Mesh(new THREE.PlaneGeometry(28, 1000).translate(0, 180, 0), ink({ kind: 'water', line: 0.3, side: THREE.DoubleSide, vertexColors: false })); w.position.set(EXIT.x, 0, EXIT.z); scene.add(w);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(EXIT.R, EXIT.R * 0.6, 300, 32, 1, true), glowy({ color: '#4ae8f0', alpha: 0.25, add: true })); halo.position.set(EXIT.x, -120, EXIT.z); scene.add(halo);
  }
  // les sensitives : buissons qui se ferment quand le voyageur approche, et se rouvrent lentement
  const sens = [], sensMesh = new THREE.InstancedMesh(merge([paint(lump(1, { sy: 0.7, lumpy: 0.35, detail: 2 }), '#4a8aff', '#2a2a6a'), ...[0, 1, 2, 3, 4].map(k => paint(lump(0.22, { detail: 1 }).translate(Math.cos(k * 1.26) * 0.8, 0.5, Math.sin(k * 1.26) * 0.8), '#7af0ff'))]), ink({ line: 0.6, glow: 0.5, pulse: 1 }), Q.sensitives);
  for (let k = 0; k < Q.sensitives; k++) {
    const C = k % 3 === 0 ? PATH[k % PATH.length] : null; // un tiers sur les chapeaux du chemin
    const a = r() * TAU, d = C ? r() * C.R * 0.75 : r() * (R_CAVE - 260), x = (C ? C.x : 0) + Math.cos(a) * d, z = (C ? C.z : 0) + Math.sin(a) * d, h = C ? capTop(C, x, z) : floorAt(x, z);
    if (h === null || h < -100) continue;
    sens.push({ x, y: h, z, s: 1.2 + r() * 1.8, k: 1, ry: r() * TAU });
  }
  sens.forEach((o, i) => sensMesh.setMatrixAt(i, m4.compose(p3.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.ry), s3.setScalar(o.s))));
  sensMesh.count = sens.length; scene.add(sensMesh);
  // les méduses d'air : elles broutent les spores dans les rais de lumière, et s'écartent du voyageur
  const jelly = new THREE.InstancedMesh(merge([paint(new THREE.LatheGeometry([[0.01, 1.6], [1.1, 1.4], [1.6, 0.6], [1.5, 0], [1.1, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 18), '#ffffff', '#c8b8ff', 0.03), ...[0, 1, 2, 3, 4, 5, 6].map(k => { const a = (k / 7) * TAU; return paint(tube([[Math.cos(a), 0.2, Math.sin(a)], [Math.cos(a) * 1.1, -3, Math.sin(a) * 1.1], [Math.cos(a) * 0.7, -6, Math.sin(a) * 0.7]], 0.05, 0.02, 4, 8), '#e8d8ff'); })]).translate(0, 6, 0), ink({ line: 0.4, trans: 0.7, glow: 0.4, wind: 0.05 }), Q.jellies);
  jelly.frustumCulled = false; scene.add(jelly);
  const jellies = Array.from({ length: Q.jellies }, (_, k) => { const h = holes[k % holes.length]; return { home: new THREE.Vector3(h.x + (r() - 0.5) * h.R, 40 + r() * 260, h.z + (r() - 0.5) * h.R), off: new THREE.Vector3(), ph: r() * TAU, s: 1 + r() * 2.5 }; });
  // les spores : une poussière lumineuse qui flotte autour du voyageur
  const sporeN = Q.spores, spore = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.35), glowy({ color: '#ff9ae8', alpha: 0.9, add: true, soft: 0.2 }), sporeN), sp0 = [];
  spore.frustumCulled = false; scene.add(spore);
  for (let k = 0; k < sporeN; k++) sp0.push([r() * 160 - 80, r() * 60 - 10, r() * 160 - 80, r() * TAU, 0.4 + r()]);
  // les Porteurs : une procession, chacun un chapeau sur le dos, sur six pattes grêles
  const porters = [], pg = porter(), legG = paint(tube([[0, 0, 0], [0.3, -1.6, 0], [0.1, -3.3, 0]], 0.09, 0.05, 4, 6), '#c8b8e8', '#6a5a98'), pMat = ink({ line: 0.8, glow: 0.15 });
  const loop = { x: -300, z: -480, R: 230 };
  for (let k = 0; k < Q.porters; k++) {
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(pg, pMat));
    const legs = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(legG, pMat); m.position.set(-1.6 + (i % 3) * 1.6, 3.2, i < 3 ? 0.5 : -0.5); m.rotation.x = i < 3 ? -0.35 : 0.35; grp.add(m); return m; });
    grp.scale.setScalar(1.4); scene.add(grp); porters.push({ grp, legs, u: k * 0.045 });
  }
  // l'Endormi : un champignon colossal qui respire, près du gouffre ; une fente qui luit
  const sleeper = new THREE.Group();
  {
    const C = { x: 0, z: 0, y: 0, R: 130, dome: 34, seed: 999, hue: 0.2 };
    sleeper.add(new THREE.Mesh(capGeometry(C), capMat), new THREE.Mesh(gillsGeometry(C), gillMat));
    const body = new THREE.Mesh(paint(lump(1, { sx: 30, sy: 120, sz: 30, lumpy: 0.15, detail: 3 }).translate(0, -110, 0), '#8a7ab8', '#2a1a48'), ink({ line: 0.9 }));
    const eye = new THREE.Mesh(paint(lump(1, { sx: 0.6, sy: 9, sz: 0.6, detail: 2 }).translate(0, -90, 29), '#fff0a0'), ink({ line: 0.3, glow: 2 }));
    sleeper.add(body, eye); sleeper.userData.eye = eye;
    const sx = EXIT.x + 210, sz = EXIT.z - 120; sleeper.position.set(sx, floorAt(sx, sz) + 225, sz); scene.add(sleeper);
    live.colliders.push([sx, sz, 34]);
  }

  let last = null, react = 0;
  live.update = (t, hero) => {
    live.ground(hero); // le sol se fait plus fin autour du voyageur
    // la forêt répond : elle s'allume autour du voyageur s'il marche, s'éteint s'il court, veille s'il s'arrête
    const v = last ? hero.distanceTo(last) / 0.016 : 0; last = hero.clone();
    react += ((v > 7 ? -0.9 : v > 0.5 ? 1 : 0.35) - react) * 0.03;
    U.uReact.value = react; U.uHero.value.copy(hero);
    // les sensitives proches se ferment (vite), les autres se rouvrent (lentement)
    let dirty = false;
    sens.forEach((o, i) => {
      const near = Math.hypot(o.x - hero.x, o.z - hero.z) < 12 && Math.abs(o.y - hero.y) < 8, want = near ? 0.3 : 1;
      if (Math.abs(o.k - want) < 0.005) return;
      o.k += (want - o.k) * (near ? 0.15 : 0.01); dirty = true;
      sensMesh.setMatrixAt(i, m4.compose(p3.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.ry), s3.set(o.s * (0.6 + o.k * 0.4), o.s * o.k, o.s * (0.6 + o.k * 0.4))));
    });
    if (dirty) sensMesh.instanceMatrix.needsUpdate = true;
    // les méduses d'air dérivent et s'écartent du voyageur
    jellies.forEach((j, i) => {
      const p = p3.copy(j.home).add(j.off).add(new THREE.Vector3(Math.sin(t * 0.2 + j.ph) * 20, Math.sin(t * 0.5 + j.ph) * 6, Math.cos(t * 0.17 + j.ph) * 20));
      const away = p.clone().sub(hero), d = away.length();
      if (d < 30) j.off.addScaledVector(away.normalize(), (30 - d) * 0.02); else j.off.multiplyScalar(0.999);
      jelly.setMatrixAt(i, m4.compose(p, q.setFromEuler(new THREE.Euler(Math.sin(t + j.ph) * 0.1, t * 0.1 + j.ph, 0)), s3.set(j.s, j.s * (1 + Math.sin(t * 2 + j.ph) * 0.08), j.s)));
    });
    jelly.instanceMatrix.needsUpdate = true;
    // les spores : elles flottent dans une boîte qui suit le voyageur
    sp0.forEach(([x, y, z, ph, s], i) => {
      const X = hero.x + ((x + t * 1.5 + 80) % 160 + 160) % 160 - 80, Z = hero.z + ((z + Math.sin(t * 0.3 + ph) * 4 + 80) % 160 + 160) % 160 - 80, Y = hero.y + ((y + t * 0.8 + 10) % 60 + 60) % 60 - 10;
      spore.setMatrixAt(i, m4.compose(p3.set(X, Y, Z), q.setFromEuler(new THREE.Euler(0, t + ph, 0)), s3.setScalar(s * (0.7 + Math.sin(t * 3 + ph) * 0.3))));
    });
    spore.instanceMatrix.needsUpdate = true;
    // les Porteurs défilent en rond, les pattes qui alternent
    for (const P of porters) {
      const a = (P.u + t * 0.012) * TAU, x = loop.x + Math.cos(a) * loop.R, z = loop.z + Math.sin(a) * loop.R;
      P.grp.position.set(x, floorAt(x, z), z); P.grp.rotation.y = -a - Math.PI / 2; // la tête en avant, le long du cercle
      P.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 6 + i * 2.1 + P.u * 40) * 0.35; });
    }
    // l'Endormi respire ; de temps en temps, sa fente s'entrouvre
    sleeper.scale.set(1 + Math.sin(t * 0.4) * 0.03, 1 + Math.sin(t * 0.4) * 0.05, 1 + Math.sin(t * 0.4) * 0.03);
    sleeper.userData.eye.scale.set(1, sleeper.userData.awake ? 1 : Math.max(0.05, Math.sin(t * 0.07) ** 40), 1);
    // le chapeau du départ s'écrase et se regonfle sous un rebond
    if (squash) { squash.k += 0.016; const e = Math.exp(-squash.k * 5) * Math.sin(squash.k * 22) * squash.a; squash.m.scale.set(1 + e * 0.3, 1 - e, 1 + e * 0.3); if (squash.k > 1.5) { squash.m.scale.set(1, 1, 1); squash = null; } }
  };
  let squash = null;
  const start = spawn(), next = CAPS[1];
  // l'histoire : la Veilleuse, l'encre des spores, l'Endormi, le choix (le réveiller, ou le chemin des racines)
  const story = createStory(scene, { floorAt, caps: PATH, exit: EXIT, roots: ROOTS, gates, sleeper, lidY, ui: ctx.ui }), base = live.update;
  live.colliders.push(...story.colliders);
  return Object.assign(live, {
    look: LOOK, terrain, start, camYaw: Math.atan2(start[0] - next.x, start[2] - next.z),
    exitAt, killY: safe => Math.min(safe.y - 60, -60), maxFall: 30, interact: story.interact, story,
    update(t, p) { base(t, p); story.update(t, p); },
    // l'arrivée : il rebondit deux fois sur le chapeau (qui s'écrase comme un trampoline), puis se pose
    bounces: [17, 8],
    onBounce(p, n) {
      const i = CAPS.findIndex(C => Math.hypot(p.x - C.x, p.z - C.z) < C.R);
      if (i >= 0) { const m = live.capMeshes[i]; m.position.set(CAPS[i].x, CAPS[i].y, CAPS[i].z); m.children.forEach(c => c.position.set(-CAPS[i].x, -CAPS[i].y, -CAPS[i].z)); squash = { m, k: 0, a: n ? 0.25 : 0.45 }; }
    },
  });
}
