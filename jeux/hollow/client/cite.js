// THE HOLLOW — Strate 06, la Cité oubliée : la seule strate où l'on comprend que quelqu'un a construit le Hollow, ou
// a essayé de le contenir. On n'aurait pas dû arriver jusqu'ici. Le règne de la ligne droite : quatre terrasses à douze
// pans, en gradins vers un centre vide, chacune tournée d'un rien (une symétrie légèrement fausse) ; des colonnes de
// plusieurs centaines de mètres qui ne portent rien, des anneaux de pierre suspendus sans appui, des arches qui ne
// mènent nulle part. Lumière froide de rares puits ; inscriptions cyan qui s'allument au passage du voyageur ; silence.
// Les anneaux dorment. Réveiller au pinceau le nœud d'un anneau fait paraître un escalier de lumière vers la terrasse
// du dessous ; le dernier, un pont jusqu'aux Archives, au centre, où l'Archiviste attend (archiviste.js).
import * as THREE from 'three';
import { fbm } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { createGround, sectors } from './sol.js';
import { createStory } from './archiviste.js';
import { abyss } from './sol.js';

/* ---------- Le relief : quatre terrasses à douze pans, le vide au centre, les Archives ---------- */
export const N = 12, SIDE = TAU / N, R0 = 150, W = 110, DROP = 22, PLAT = { R: 34, y: 4 };
const rotOf = k => 0.07 * k + 0.02; // chaque terrasse tournée d'un rien
export const tierY = k => (3 - k) * DROP; // terrasse 0 (dehors, en haut) … terrasse 3 (au bord du vide, en bas)
// la distance « à pans » : la projection sur la normale du pan le plus proche (un polygone régulier, pas un cercle)
export const polyD = (x, z, rot) => { const a = Math.atan2(z, x) - rot; return Math.hypot(x, z) * Math.cos((((a % SIDE) + SIDE) % SIDE) - SIDE / 2); };
export const OUTER = R0 + 4 * W;
export function tierAt(x, z) { for (let k = 3; k >= 0; k--) if (polyD(x, z, rotOf(k)) < R0 + (4 - k) * W) return k; return -1; }
export function floorAt(x, z) {
  if (Math.hypot(x, z) < PLAT.R) return PLAT.y; // les Archives, une dalle au-dessus du vide
  if (polyD(x, z, rotOf(3)) < R0) return -400;
  const k = tierAt(x, z);
  if (k >= 0) return tierY(k);
  const d = polyD(x, z, rotOf(0)) - OUTER; return tierY(0) + Math.min(400, (d / 6) ** 2 * 6 + d * 0.3); // le mur de la Cité
}
// les escaliers de lumière (k = 0..2 : de la terrasse k à k+1) et le pont (k = 3 : jusqu'aux Archives), sur la normale
// d'un pan, un peu plus loin à chaque fois autour de la Cité
const awake = [false, false, false, false];
export const gates = { awake };
export const RAMPS = [0, 1, 2, 3].map(k => {
  const th = rotOf(Math.min(3, k + 1)) + SIDE / 2 + (k * 2 + 1) * SIDE, Rb = R0 + (3 - k) * W;
  // un escalier est tout entier au-dessus de la terrasse du dessous (sinon il passerait sous celle du haut)
  return k < 3 ? { k, th, from: Rb, to: Rb - 44, hFrom: tierY(k), hTo: tierY(k + 1), w: 4 } : { k, th, from: R0 + 6, to: PLAT.R - 6, hFrom: 0, hTo: PLAT.y, w: 3.5 };
});
export function rampAt(Rp, x, z) {
  const c = Math.cos(Rp.th), s = Math.sin(Rp.th), along = x * c + z * s, lat = Math.abs(-x * s + z * c);
  if (lat > Rp.w || along > Rp.from || along < Rp.to) return null;
  return Rp.hTo + ((along - Rp.to) / (Rp.from - Rp.to)) * (Rp.hFrom - Rp.hTo);
}
export function terrain(x, z, below = Infinity) {
  let best = -Infinity; const f = floorAt(x, z);
  if (f > -100 && f <= below) best = f;
  for (const Rp of RAMPS) if (awake[Rp.k]) { const h = rampAt(Rp, x, z); if (h !== null && h <= below && h > best) best = h; }
  return best === -Infinity ? { h: -1e4, kind: 'void' } : { h: best, kind: 'ground' };
}
// les nœuds des anneaux : sur la terrasse du haut de chaque escalier, à côté de son départ
export const NODES = RAMPS.map(Rp => { const c = Math.cos(Rp.th), s = Math.sin(Rp.th), a = Rp.k < 3 ? Rp.from + 14 : Rp.from + 16; return [c * a - s * 12, tierY(Rp.k), s * a + c * 12]; });
export const spawn = () => { const th = RAMPS[0].th - 0.45, d = OUTER - 60; return [Math.cos(th) * d, tierY(0), Math.sin(th) * d]; };

/* ---------- Les formes ---------- */
const box = (w, h, d, x, y, z, a = '#3a3a7a', b = '#1c2440') => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), a, b, 0.04);
// une colonne : un fût à arêtes nettes, des bagues, un chapiteau qui ne porte rien
function column(x, z, w, h, y0, a) {
  const K = [box(w, h, w, 0, y0 + h / 2, 0, '#4a4a8a', '#1c2440')];
  for (let y = y0 + 30; y < y0 + h - 10; y += 47) K.push(box(w * 1.25, 2.2, w * 1.25, 0, y, 0, '#6a7088', '#3a3a7a'));
  K.push(box(w * 1.6, 4, w * 1.6, 0, y0 + h + 2, 0, '#6a7088', '#3a3a7a'));
  return merge(K).rotateY(a).translate(x, 0, z);
}
// un anneau de pierre : un tore à facettes, des nœuds cyan sur son pourtour
const ringGeometry = R => merge([paint(new THREE.TorusGeometry(R, R * 0.09, 6, 48), '#6a7088', '#2a2e50', 0.05), ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; return paint(new THREE.BoxGeometry(R * 0.16, R * 0.16, R * 0.24).rotateZ(a).translate(Math.cos(a) * R, Math.sin(a) * R, 0), '#8a90a8', '#4a4a8a'); })]);
// des inscriptions : des traits droits, à angles nets, en colonnes (personne ne sait les lire)
function glyphs(r, n) {
  const K = [];
  for (let i = 0; i < n; i++) { const x = (i % 3) * 0.7, y = -Math.floor(i / 3) * 0.9, v = r() < 0.5; K.push(new THREE.BoxGeometry(v ? 0.12 : 0.55, v ? 0.65 : 0.12, 0.06).translate(x + (v ? r() * 0.4 : 0.2), y + (v ? 0 : r() * 0.5), 0)); }
  return merge(K);
}

/* ---------- La strate ---------- */
export const LOOK = {
  name: 'La Cité oubliée', sun: [0.12, 1, 0.06], sunCol: '#e8eef8', shadowCol: '#1c2440', fog: '#161c34', density: 0.0022, shadows: true,
  pal: [[0.16, 0.18, 0.32], [0.24, 0.24, 0.46], [0.3, 0.32, 0.5], [0.42, 0.44, 0.53], [0.14, 0.16, 0.28], [0.62, 0.68, 0.76], [0.35, 0.91, 1], [0.78, 0.66, 1]],
  skyMid: '#1c2440', skyTop: '#6a7088', abyssY: -30,
};

export function create(scene, Q, ctx = {}) {
  const live = { colliders: [] }, r = rng(61), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), e3 = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  live.ground = createGround(scene, floorAt, (cx, cz, c) => Math.hypot(cx, cz) - c > OUTER + 400);
  { const [x0, , z0] = spawn(); live.ground({ x: x0, z: z0 }, 1e6); }
  const nearPath = (x, z, m) => RAMPS.some(Rp => { const c = Math.cos(Rp.th), s = Math.sin(Rp.th), al = x * c + z * s; return Math.abs(-x * s + z * c) < m && al > Rp.to - 30 && al < Rp.from + 40; }) || NODES.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < m + 6);
  // les colonnes : aux angles et au milieu des pans de chaque terrasse, trop hautes pour porter quoi que ce soit
  const C = [];
  for (let k = 0; k < 4; k++) {
    const B = R0 + (4 - k) * W - 14, rot = rotOf(k);
    for (let j = 0; j < N * 2; j++) {
      const a = rot + (j / (N * 2)) * TAU, R = j % 2 ? B : B / Math.cos(SIDE / 2), x = Math.cos(a) * R * 0.98, z = Math.sin(a) * R * 0.98, w = 7 + (j % 3) * 2;
      if (nearPath(x, z, 14) || (j + k) % 3 === 1) continue;
      const h = 180 + ((j * 7 + k * 13) % 9) * 40;
      C.push(column(x, z, w, h, tierY(k) - 2, a)); live.colliders.push([x, z, w * 0.75]);
    }
  }
  scene.add(cast(new THREE.Mesh(merge(C), ink({ line: 1 }))));
  // les racines-joints : des filaments pâles qui ont rempli les fissures et tiennent les colonnes debout
  // les arches qui ne mènent nulle part
  {
    const K = [];
    for (let n = 0, k = 0; k < 12 && n < 300; n++) {
      const a = r() * TAU, t = (r() * 4) | 0, d = R0 + (3.3 - t + r() * 0.4) * W, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (tierAt(x, z) !== 3 - t || nearPath(x, z, 30)) continue;
      const w = 16 + r() * 10, h = 24 + r() * 18, y = tierY(3 - t), g = merge([box(3, h, 3, -w / 2, y + h / 2, 0), box(3, h, 3, w / 2, y + h / 2, 0), box(w + 5, 3.5, 3.6, 0, y + h + 1.7, 0, '#6a7088', '#3a3a7a')]).rotateY(a + Math.PI / 2).translate(x, 0, z);
      K.push(g); live.colliders.push([x + Math.cos(a + Math.PI / 2) * w / 2, z + Math.sin(a + Math.PI / 2) * w / 2, 2.4], [x - Math.cos(a + Math.PI / 2) * w / 2, z - Math.sin(a + Math.PI / 2) * w / 2, 2.4]); k++;
    }
    for (let k = 0; k < 160; k++) { const a = r() * TAU, d = R0 + r() * 4 * W, x = Math.cos(a) * d, z = Math.sin(a) * d, y = floorAt(x, z); if (y < -100) continue; K.push(paint(tube([[x, y - 0.2, z], [x + (r() - 0.5) * 4, y + 0.1, z + (r() - 0.5) * 4], [x + (r() - 0.5) * 9, y - 0.1, z + (r() - 0.5) * 9]], 0.25, 0.08, 4, 8), '#a8b8c8', '#6a7088')); }
    scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 0.9 }))));
  }
  // les anneaux qui attendent : quatre gardent un escalier (ils s'éveillent), les autres dorment pour toujours
  const ringMat = () => ink({ line: 0.9, glow: 0.05, pulse: 1 });
  const rings = NODES.map(([x, y, z], k) => { const m = new THREE.Mesh(ringGeometry(k === 3 ? 30 : 20), ringMat()); m.position.set(x, y + 46, z); m.rotation.set(0.3, RAMPS[k].th, 0.1); scene.add(cast(m)); return m; });
  const sleepers = [];
  for (let n = 0, k = 0; k < 9 && n < 200; n++) {
    const a = r() * TAU, d = R0 + 40 + r() * 3.6 * W, x = Math.cos(a) * d, z = Math.sin(a) * d, t = tierAt(x, z);
    if (t < 0 || nearPath(x, z, 40)) continue;
    const m = new THREE.Mesh(ringGeometry(18 + r() * 30), ringMat()); m.position.set(x, tierY(t) + 70 + r() * 160, z); m.rotation.set(r() * 0.8, r() * TAU, r() * 0.5); scene.add(cast(m)); sleepers.push(m); k++;
  }
  // l'anneau des Archives, immense, au-dessus du vide
  const archRing = new THREE.Mesh(ringGeometry(70), ringMat()); archRing.position.set(0, 90, 0); archRing.rotation.x = Math.PI / 2 - 0.15; scene.add(cast(archRing));
  // les nœuds : des pierres taillées qui luisent faiblement, comme une machine en veille
  const nodes = NODES.map(([x, y, z], k) => { const g = new THREE.Group(); g.add(cast(new THREE.Mesh(merge([box(3, 3, 3, 0, 1.5, 0, '#6a7088', '#3a3a7a'), box(1.2, 1.2, 1.2, 0, 3.6, 0, '#5ae8ff', '#2a8ab8')]), ink({ line: 0.8, glow: 0.3, pulse: 1 })))); g.position.set(x, y, z); g.rotation.y = RAMPS[k].th; scene.add(g); live.colliders.push([x, z, 2.2]); return g; });
  // les escaliers de lumière et le pont : des marches nettes, en esquisse tant que leur anneau dort
  const stairs = RAMPS.map(Rp => {
    const K = [], c = Math.cos(Rp.th), s = Math.sin(Rp.th), n = Rp.k < 3 ? 30 : 60;
    for (let i = 0; i < n; i++) { const al = Rp.from + ((Rp.to - Rp.from) * (i + 0.5)) / n, h = rampAt(Rp, c * al, s * al); K.push(new THREE.BoxGeometry(Math.abs(Rp.from - Rp.to) / n + 0.05, Rp.k < 3 ? 0.8 : 0.5, Rp.w * 2).translate(al, h - (Rp.k < 3 ? 0.4 : 0.25), 0)); }
    const m = new THREE.Mesh(paint(merge(K).rotateY(-Rp.th), '#e8eef8', '#5ae8ff'), ink({ line: 0.6, glow: 0.6, fade: 1 })); scene.add(m); return m;
  });
  // les inscriptions sur les murs entre deux terrasses, et sur le bord du vide : elles s'allument au passage
  {
    const G = [];
    for (let k = 0; k < 3; k++) {
      const B = R0 + (3 - k) * W, rot = rotOf(k + 1), lowY = tierY(k + 1);
      for (let j = 0; j < N; j++) {
        const na = rot + SIDE / 2 + j * SIDE, L = 2 * B * Math.tan(SIDE / 2), tx = -Math.sin(na), tz = Math.cos(na);
        for (let u = -L / 2 + 8; u < L / 2 - 8; u += 11) {
          if (r() < 0.35) continue;
          const x = Math.cos(na) * (B - 0.25) + tx * u, z = Math.sin(na) * (B - 0.25) + tz * u, y = lowY + 5 + r() * 12;
          G.push(glyphs(r, 6 + ((r() * 9) | 0)).rotateY(-na - Math.PI / 2).translate(x, y, z));
        }
      }
    }
    scene.add(new THREE.Mesh(paint(merge(G), '#5ae8ff'), ink({ line: 0.2, glow: 0.7, pulse: 1 })));
  }
  // les Archives : la dalle, des pupitres, des rayonnages de pages debout, des pages qui tournent dans l'air
  {
    const K = [];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU, x = Math.cos(a) * 27, z = Math.sin(a) * 27; if (Math.abs(Math.atan2(Math.sin(a - RAMPS[3].th), Math.cos(a - RAMPS[3].th))) < 0.35) continue; K.push(merge([box(6, 8, 1.2, 0, PLAT.y + 4, 0, '#3a3a7a', '#1c2440'), ...[0, 1, 2].map(i => box(5.4, 0.15, 1, 0, PLAT.y + 1.5 + i * 2.5, 0, '#6a7088'))]).rotateY(-a + Math.PI / 2).translate(x, 0, z)); live.colliders.push([x, z, 3.2]); }
    K.push(paint(new THREE.CylinderGeometry(PLAT.R, PLAT.R - 4, 8, 12).translate(0, PLAT.y - 4.1, 0), '#3a3a7a', '#1c2440'));
    scene.add(cast(new THREE.Mesh(merge(K), ink({ line: 1 }))));
  }
  const pages = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.5), ink({ line: 0.4, color: '#f4efe4', vertexColors: false, side: THREE.DoubleSide, glow: 0.2 }), 70); pages.frustumCulled = false; scene.add(pages);
  // les puits de lumière, rares
  for (let k = 0; k < 6; k++) { const a = k * 1.9 + 0.4, d = 120 + (k % 3) * 160, m = new THREE.Mesh(new THREE.CylinderGeometry(14, 22, 700, 16, 1, true), glowy({ color: '#c8d8ff', alpha: 0.09, add: true, soft: 1 })); m.position.set(Math.cos(a) * d, 330, Math.sin(a) * d); scene.add(m); }
  // les fleurs de veille : pâles, seulement à côté des pierres lumineuses
  {
    const list = [];
    for (const [x, y, z] of NODES) for (let i = 0; i < 26; i++) { const a = r() * TAU, d = 2.5 + r() * 7; list.push([x + Math.cos(a) * d, y, z + Math.sin(a) * d, 0.6 + r() * 0.8]); }
    for (let i = 0; i < Q.sensitives / 2; i++) { const k = (r() * 4) | 0, B = R0 + (3 - k) * W, na = rotOf(Math.min(3, k + 1)) + SIDE / 2 + ((r() * N) | 0) * SIDE, u = (r() - 0.5) * 2 * B * Math.tan(SIDE / 2) * 0.8, x = Math.cos(na) * (B - 1.5) - Math.sin(na) * u, z = Math.sin(na) * (B - 1.5) + Math.cos(na) * u, y = floorAt(x, z); if (y > -100) list.push([x, y, z, 0.5 + r() * 0.7]); }
    const g = merge([paint(new THREE.CylinderGeometry(0.05, 0.08, 1, 5).translate(0, 0.5, 0), '#a8b8c8'), paint(new THREE.SphereGeometry(0.4, 10, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 1, 0), '#e8e0ff', '#c8a8ff')]);
    sectors(scene, g, ink({ line: 0.4, glow: 0.6, pulse: 1 }), list, ([x, y, z, s], m) => m.compose(p3.set(x, y, z), q.setFromAxisAngle(up, r() * TAU), s3.setScalar(s)), false);
  }
  // les méduses de veille : de petits Flottants bleus qui tournent lentement autour des anneaux
  const allRings = [...rings, ...sleepers, archRing], JN = allRings.length * 5;
  const jel = new THREE.InstancedMesh(merge([paint(new THREE.LatheGeometry([[0.01, 0.8], [0.6, 0.7], [0.8, 0.3], [0.7, 0], [0.5, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 12), '#c8e8ff', '#4a7ad8'), ...[0, 1, 2, 3].map(i => { const a = (i / 4) * TAU; return paint(tube([[Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5], [Math.cos(a) * 0.6, -1.4, Math.sin(a) * 0.6], [Math.cos(a) * 0.4, -2.8, Math.sin(a) * 0.4]], 0.04, 0.015, 3, 6), '#a8d8ff'); })]), ink({ line: 0.4, trans: 0.6, glow: 0.9, pulse: 1 }), JN);
  jel.frustumCulled = false; scene.add(jel);
  // les habitants des corniches : plats, de la couleur de la pierre, collés aux colonnes ; ils glissent très lentement
  const HN = Q.porters * 4, hab = new THREE.InstancedMesh(paint(lump(1, { sx: 1.4, sy: 1.8, sz: 0.25, lumpy: 0.2, detail: 1 }), '#4a4a8a', '#2a2e50'), ink({ line: 0.7 }), HN); hab.frustumCulled = false; scene.add(hab);
  const habs = Array.from({ length: HN }, (_, i) => { const c = live.colliders[(i * 7) % Math.max(1, live.colliders.length)], a = r() * TAU; return { x: c[0] + Math.cos(a) * (c[2] / 0.75 / 2 + 0.3), z: c[1] + Math.sin(a) * (c[2] / 0.75 / 2 + 0.3), y: 20 + r() * 140, a, ph: r() * TAU }; });

  let last = 0;
  live.update = (t, hero) => {
    const dt = Math.min(0.05, last ? t - last : 0.016); last = t;
    live.ground(hero);
    U.uHero.value.copy(hero); U.uReact.value = 1; // les inscriptions et les nœuds s'allument près du voyageur
    rings.forEach((m, k) => { if (awake[k]) { m.rotation.z += dt * 0.25; m.material.uniforms.uGlow.value = Math.min(1.2, m.material.uniforms.uGlow.value + dt * 0.4); } });
    archRing.rotation.z += dt * (awake[3] ? 0.08 : 0.004);
    stairs.forEach((m, k) => { const u = m.material.uniforms.uFade; u.value = awake[k] ? Math.max(0, u.value - dt / 3) : 1; });
    allRings.forEach((R, i) => { for (let j = 0; j < 5; j++) { const a = t * 0.08 * (j % 2 ? 1 : -1) + j * 1.25 + i, rad = (R.geometry.boundingSphere?.radius ?? 30) * 0.9; p3.set(Math.cos(a) * rad, Math.sin(a) * rad, Math.sin(t * 0.5 + j) * 3).applyEuler(R.rotation).add(R.position); jel.setMatrixAt(i * 5 + j, m4.compose(p3, q.setFromEuler(e3.set(Math.sin(t + j) * 0.2, t * 0.2, 0)), s3.setScalar(1.6 + (j % 2)))); } });
    jel.instanceMatrix.needsUpdate = true;
    habs.forEach((H, i) => { const y = H.y + Math.sin(t * 0.03 + H.ph) * 20; hab.setMatrixAt(i, m4.compose(p3.set(H.x, y, H.z), q.setFromEuler(e3.set(0, -H.a + Math.PI / 2, 0)), s3.setScalar(1.5))); });
    hab.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 70; i++) { const a = t * 0.05 + (i / 70) * TAU * 3, rad = 10 + (i % 7) * 3; pages.setMatrixAt(i, m4.compose(p3.set(Math.cos(a) * rad, PLAT.y + 6 + (i % 5) * 3 + Math.sin(t * 0.4 + i) * 1.5, Math.sin(a) * rad), q.setFromEuler(e3.set(Math.sin(t * 0.7 + i) * 0.5, -a, Math.sin(t * 0.5 + i) * 0.3)), s3.setScalar(1))); }
    pages.instanceMatrix.needsUpdate = true;
  };
  const voidFx = abyss(scene, { x: 0, z: 0, R: R0 * 1.03, floorAt, depth: 420, wall: ['#3a3a7a', '#05060e'], mist: '#3a6a9a' }); // le vide du centre : la paroi taillée s'enfonce, une brume cyan
  const start = spawn();
  // l'histoire : les nœuds à réveiller, l'Archiviste, le dessin inachevé, la fin
  const story = createStory(scene, { nodes: NODES, nodeMeshes: nodes, rings, awake, plat: PLAT, ramps: RAMPS, start, ui: ctx.ui, hero: ctx.hero }), base = live.update;
  live.colliders.push(...story.colliders);
  return Object.assign(live, {
    look: LOOK, terrain, start, camYaw: Math.atan2(start[0] - NODES[0][0], start[2] - NODES[0][2]),
    hint: 'Les anneaux dorment. Leur nœud lumineux se réveille au pinceau (E).',
    // une fois la fin choisie, le vide du centre ramène tout en haut (next : la strate où l'on tombe)
    exitAt: (x, z) => story.finished && polyD(x, z, rotOf(3)) < R0 && Math.hypot(x, z) > PLAT.R, next: () => 1, exitDrop: 12,
    killY: safe => safe.y - 50, maxFall: 15, interact: story.interact, story, leave: story.leave,
    update(t, p) { base(t, p); story.update(t, p); voidFx.update(t); },
  });
}
