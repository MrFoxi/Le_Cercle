// THE HOLLOW — Strate 01, les Jardins suspendus. Tout est modelé ici par le code : aucun modèle, aucune texture importés.
// Arbres courbés vers le puits, ombrelles de verre qui colorent le sol, arches de roche, îles suspendues à leurs
// racines, cascades, touffes d'herbe, Semeurs qui dérivent, et le Jardinier, debout sur la crête, qui regarde.
import * as THREE from 'three';
import { terrain, heightAt, fbm, noise, rampAngle, spawn, R_ABYSS, R_WALL, TERRACE } from './terrain.js';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast } from './modelage.js';
import { createGround, sectors } from './sol.js';

const TAU = Math.PI * 2;

// la lèvre du gouffre : une falaise qui plonge dans la brume
function abyssWall() {
  const n = 480, P = [], I = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let r = R_ABYSS - 45; while (r < R_ABYSS + 45 && terrain(Math.cos(a) * r, Math.sin(a) * r).kind === 'void') r += 1;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
    for (const [k, dy] of [[1, 0], [0.99, -120], [0.96, -380], [0.9, -800]]) { const w = (noise(i * 0.3, dy) - 0.5) * 20; P.push(x * k + Math.cos(a) * w, h + dy, z * k + Math.sin(a) * w); }
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
function umbrella(seed, giant = false) {
  const r = rng(seed), H = (9 + r() * 16) * (giant ? 3.5 : 1), bend = (r() - 0.5) * 5, R = 4 + H * 0.28, col = PETAL[seed % PETAL.length];
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
  const live = { colliders: [], islands: [] };
  const r = rng(2026), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  const [sx0, , sz0] = spawn(), clear = (x, z, d) => (x - sx0) ** 2 + (z - sz0) ** 2 > d * d; // le départ reste dégagé : on y voit loin
  // un point au hasard sur le sol (pas dans une rampe, pas trop en pente)
  const spot = (minD = 4, maxSlope = 1.2) => {
    for (let n = 0; n < 60; n++) {
      const a = r() * TAU, d = Math.sqrt(R_ABYSS ** 2 + r() * (R_WALL ** 2 - R_ABYSS ** 2)), x = Math.cos(a) * d, z = Math.sin(a) * d, t = terrain(x, z);
      if (t.kind !== 'ground' || t.ramp > 0.2 || !clear(x, z, minD)) continue;
      if (Math.abs(heightAt(x + 2, z) - t.h) + Math.abs(heightAt(x, z + 2) - t.h) > maxSlope) continue;
      return [x, t.h, z, a];
    }
    return null;
  };
  // le ciel du puits
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky); live.sky = sky;
  // le sol, la lèvre du gouffre
  live.ground = createGround(scene, heightAt, (cx, cz, c) => Math.hypot(cx, cz) + c * 0.71 < R_ABYSS - 40); // pas de morceau tout entier dans le gouffre
  scene.add(cast(new THREE.Mesh(abyssWall(), ink({ line: 1 }))));
  // l'anneau du puits : la voûte de roche autour de l'ouverture, très haut au-dessus de la paroi
  {
    const g = new THREE.TorusGeometry(2250, 420, 20, 220); g.rotateX(Math.PI / 2); g.scale(1, 0.55, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 0.002 + 4, z * 0.002 + y * 0.004); p.setXYZ(i, x * (1 + (n - 0.5) * 0.1), y + (n - 0.5) * 220, z * (1 + (n - 0.5) * 0.1)); }
    g.computeVertexNormals(); g.translate(0, 1250, 0);
    scene.add(new THREE.Mesh(paint(g, '#8a9aa8', '#3a4458', 0.15), ink({ line: 0.9 })));
  }
  // arbres : sept modèles (deux géants), tous penchés vers le puits
  {
    const kinds = Array.from({ length: 7 }, (_, k) => tree(k * 31 + 7, k >= 5)), lists = kinds.map(() => []), mat = ink({ line: 0.85, wind: 0.004 });
    for (let k = 0; k < Q.trees; k++) {
      const s = spot(40); if (!s) continue;
      const [x, h, z, a] = s, kind = k % 4 === 3 ? 5 + (k % 2) : k % 5, sc = 0.7 + r() * 0.7;
      lists[kind].push([x, h, z, a + Math.PI, sc]); live.colliders.push([x, z, (kind >= 5 ? 3 : 1.4) * sc]);
    }
    kinds.forEach((g, k) => sectors(scene, g, mat, lists[k], ([x, y, z, ry, sc], m4) => m4.compose(p3.set(x, y, z), q.setFromAxisAngle(up, -ry), s3.setScalar(sc))));
  }
  // ombrelles de verre (une sur cinq est immense), et la tache de couleur que leur lumière pose au sol
  {
    const kinds = Array.from({ length: 10 }, (_, k) => umbrella(k * 13 + 5, k >= 8)), stem = ink({ line: 0.8, wind: 0.002 }), petal = ink({ line: 0.55, trans: 0.9, side: THREE.DoubleSide, wind: 0.002 }), heart = ink({ line: 0.4, glow: 0.6 });
    const lists = kinds.map(() => []), patches = new Map();
    for (let k = 0; k < Q.umbrellas; k++) {
      const s = spot(30); if (!s) continue;
      const kind = k % 5 === 4 ? 8 + (k % 2) : k % 8, ry = r() * TAU, u = kinds[kind];
      lists[kind].push([s[0], s[1], s[2], ry]); live.colliders.push([s[0], s[2], kind >= 8 ? 2 : 0.8]);
      const off = new THREE.Vector3(u.top[0], 0, u.top[2]).applyAxisAngle(up, ry).addScaledVector(U.uSunDir.value, -u.top[1] / U.uSunDir.value.y);
      const px = s[0] + off.x, pz = s[2] + off.z;
      if (!patches.has(u.col)) patches.set(u.col, []);
      patches.get(u.col).push([px, heightAt(px, pz) + 0.2, pz, u.R * 1.3]);
    }
    const place = ([x, y, z, ry], m4) => m4.compose(p3.set(x, y, z), q.setFromAxisAngle(up, ry), s3.setScalar(1));
    kinds.forEach((u, k) => { sectors(scene, u.stem, stem, lists[k], place); sectors(scene, u.petals, petal, lists[k], place); sectors(scene, u.heart, heart, lists[k], place, false); });
    const disc = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    for (const [col, list] of patches) sectors(scene, disc, glowy({ color: col, alpha: 0.32, add: true }), list, ([x, y, z, s], m4) => m4.compose(p3.set(x, y, z), q.identity(), s3.set(s, 1, s)), false);
  }
  // rochers et blocs
  {
    const g = paint(lump(1, { lumpy: 0.35, detail: 2, seed: 4 }), '#c8ccd0', '#6a7280', 0.12), list = [];
    for (let k = 0; k < Q.rocks; k++) { const s = spot(16, 9); if (s) { const sc = 0.6 + r() * r() * (k % 9 ? 5 : 18); list.push([s[0], s[1], s[2], sc, r() * TAU]); if (sc > 1.5) live.colliders.push([s[0], s[2], sc * 0.8]); } }
    sectors(scene, g, ink({ line: 1 }), list, ([x, y, z, sc, a], m4) => m4.compose(p3.set(x, y + sc * 0.2, z), q.setFromEuler(new THREE.Euler(a * 0.3, a, a * 0.2)), s3.set(sc, sc * 0.7, sc)));
  }
  // arches de roche jetées par-dessus les falaises, d'une terrasse à l'autre
  for (let k = 0; k < Q.arches; k++) {
    const lvl = k % 12, a = rampAngle(lvl) + 0.4 + r() * 5, d0 = R_ABYSS + TERRACE * (lvl + 0.55), d1 = d0 + TERRACE * (1.2 + r() * 0.8), a1 = a + (r() - 0.5) * 0.08;
    const A = [Math.cos(a) * d0, 0, Math.sin(a) * d0], B = [Math.cos(a1) * d1, 0, Math.sin(a1) * d1];
    A[1] = heightAt(A[0], A[2]) - 4; B[1] = heightAt(B[0], B[2]) - 4;
    if (A[1] < -100 || B[1] < -100) continue;
    const rise = 50 + r() * 90, thick = 8 + r() * 10, pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * rise, A[2] + (B[2] - A[2]) * t]); }
    const g = tube(pts, thick, thick * 0.7, 14, 56), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = fbm(p.getX(i) * 0.04, p.getZ(i) * 0.04 + p.getY(i) * 0.04) - 0.5; p.setXYZ(i, p.getX(i) + n * thick * 0.6, p.getY(i) + n * thick * 0.5, p.getZ(i) + n * thick * 0.6); }
    g.computeVertexNormals();
    scene.add(cast(new THREE.Mesh(paint(g, '#b8c0c4', '#6a7484', 0.14), ink({ line: 1 }))));
    const V = [];
    for (let i = 2; i < 13; i++) { const c = pts[i]; if (r() < 0.7) V.push(paint(tube([[c[0], c[1] - thick * 0.6, c[2]], [c[0] + 1, c[1] - thick - 10 - r() * 15, c[2]], [c[0], c[1] - thick - 25 - r() * 30, c[2] + 1]], 0.6, 0.15, 5, 8), '#7fc89a', '#3f8a5a')); }
    if (V.length) scene.add(new THREE.Mesh(merge(V), ink({ line: 0.5, wind: 0.01 })));
  }
  // îles suspendues : au-dessus du gouffre, et partout dans le puits, très haut, chacune avec ses racines et son arbre
  for (let k = 0; k < Q.islands; k++) {
    const over = k < 8, a = r() * TAU, d = over ? 60 + r() * (R_ABYSS - 120) : R_ABYSS + r() * (R_WALL - R_ABYSS - 100);
    const s = (over ? 18 : 10) + r() * (over ? 30 : 26), y = over ? 120 + r() * 300 : heightAt(Math.cos(a) * d, Math.sin(a) * d) + 120 + r() * 600;
    const K = [paint(lump(1, { sx: s, sy: s * 1.6, sz: s, top: 0.05, lumpy: 0.3, seed: k + 50, detail: 3 }), '#a8b0b8', '#4a5468', 0.12)];
    K.push(paint(lump(1, { sx: s * 1.05, sy: s * 0.08, sz: s * 1.05, lumpy: 0.15, seed: k + 90, detail: 3 }), '#7fd090', '#4a9a5a'));
    for (let i = 0; i < 8; i++) { const b = r() * TAU, rr = s * 0.6 * r(); K.push(paint(tube([[Math.cos(b) * rr, -s * 0.8, Math.sin(b) * rr], [Math.cos(b) * rr * 1.2, -s * 1.7 - r() * s, Math.sin(b) * rr * 1.2], [Math.cos(b) * rr * 0.8, -s * 2.6 - r() * s * 2, Math.sin(b) * rr * 0.8]], s * 0.05, s * 0.01, 5, 10), '#8a7a6a', '#5a4a42')); }
    K.push(tree(k * 7 + 3).scale(s / 22, s / 22, s / 22).translate(0, 0.3, 0));
    const isl = cast(new THREE.Mesh(merge(K), ink({ line: 0.9 })));
    isl.position.set(Math.cos(a) * d, y, Math.sin(a) * d); isl.rotation.y = r() * TAU; scene.add(isl);
    live.islands.push([isl, y, r() * TAU]);
  }
  // cascades : elles sortent haut dans la paroi et tombent sur la terrasse du bord ; brume au pied
  for (let k = 0; k < Q.falls; k++) {
    const a = (k / Q.falls) * TAU + r() * 0.1, r0 = R_WALL + 14, x = Math.cos(a) * r0, z = Math.sin(a) * r0, y0 = heightAt(Math.cos(a) * (R_WALL - 20), Math.sin(a) * (R_WALL - 20));
    const top = y0 + 200 + r() * 350, w = 18 + r() * 40, g = new THREE.PlaneGeometry(w, top - y0, 1, 1);
    g.translate(0, (top + y0) / 2, 0);
    const m = new THREE.Mesh(g, ink({ kind: 'water', line: 0.35, side: THREE.DoubleSide, vertexColors: false })); m.position.set(x, 0, z); m.rotation.y = -a + Math.PI / 2; scene.add(m);
    for (let i = 0; i < 4; i++) { const mist = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, w * 2), glowy({ color: '#ffffff', alpha: 0.5 })); mist.position.set(Math.cos(a) * (r0 - 14 - i * 8), y0 + 6 + i * 9, Math.sin(a) * (r0 - 14 - i * 8)); mist.rotation.y = -a + Math.PI / 2 + (i - 1.5) * 0.4; scene.add(mist); }
  }
  // l'herbe : seulement autour du voyageur (une grille de cases de 12 m, chacune toujours la même), et elle le suit
  {
    const P = [], C = [], tip = new THREE.Color('#d8f8b0'), root = new THREE.Color('#2f7a4a');
    for (let s = 0; s <= 4; s++) { const t = s / 4, w = 0.07 * (1 - t); P.push(-w, t, t * t * 0.25, w, t, t * t * 0.25); const c = root.clone().lerp(tip, t); C.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    const I = []; for (let s = 0; s < 4; s++) I.push(s * 2, s * 2 + 1, s * 2 + 2, s * 2 + 1, s * 2 + 3, s * 2 + 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(10 * 2), 2));
    const im = new THREE.InstancedMesh(g, ink({ line: 0.12, wind: 0.22, side: THREE.DoubleSide }), Q.grass), tint = new THREE.Color(), m4 = new THREE.Matrix4();
    im.frustumCulled = false; scene.add(im); live.grass = im;
    const CELL = 12, RAD = Math.ceil(Q.grassRadius / CELL); let last = '';
    live.updateGrass = p => {
      const ci = Math.floor(p.x / CELL), cj = Math.floor(p.z / CELL), key = ci + ',' + cj;
      if (key === last) return; last = key;
      let n = 0;
      for (let j = cj - RAD; j <= cj + RAD; j++) for (let i = ci - RAD; i <= ci + RAD; i++) {
        if ((i - ci) ** 2 + (j - cj) ** 2 > RAD * RAD) continue;
        const rc = rng(i * 73856093 ^ j * 19349663), tufts = 1 + Math.floor(rc() * 4);
        for (let t = 0; t < tufts; t++) {
          const cx = (i + rc()) * CELL, cz = (j + rc()) * CELL, tt = terrain(cx, cz), big = 0.7 + rc() * 1.2, hue = rc();
          if (tt.kind !== 'ground' || Math.abs(heightAt(cx + 1, cz) - tt.h) > 0.6) continue;
          for (let k = 0; k < 34 && n < im.instanceMatrix.count; k++, n++) {
            const x = cx + (rc() - 0.5) * 3.4, z = cz + (rc() - 0.5) * 3.4;
            q.setFromEuler(new THREE.Euler((rc() - 0.5) * 0.4, rc() * TAU, (rc() - 0.5) * 0.4));
            im.setMatrixAt(n, m4.compose(p3.set(x, heightAt(x, z) - 0.05, z), q, s3.set(1 + rc(), (0.5 + rc() * 0.9) * big, 1)));
            im.setColorAt(n, tint.setHSL(0.36 + hue * 0.1, 0.38, 0.3 + rc() * 0.12).multiplyScalar(1.7));
          }
        }
      }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
  }
  // les Semeurs : ils dérivent lentement d'une terrasse à l'autre, sans se soucier du joueur
  const seeds = [];
  {
    const im = new THREE.InstancedMesh(seeder(), ink({ line: 0.4, trans: 0.6, glow: 0.25, wind: 0.08 }), Q.seeders);
    im.frustumCulled = false; scene.add(im); live.seedMesh = im;
    for (let k = 0; k < Q.seeders; k++) seeds.push({ a: r() * TAU, d: R_ABYSS + 30 + r() * (R_WALL - R_ABYSS - 60), h: 3 + r() * 14, sp: (r() - 0.5) * 0.004, ph: r() * TAU, s: 0.8 + r() * 1.6 });
  }
  // le Jardinier, debout sur la crête de la paroi, face au puits : 250 m de haut
  {
    const a = Math.PI * 0.85, d = R_WALL + 260, x = Math.cos(a) * d, z = Math.sin(a) * d, m = new THREE.Mesh(gardener(), ink({ line: 0.7 }));
    m.scale.setScalar(4); m.position.set(x, heightAt(x, z) - 20, z); m.rotation.y = -a - Math.PI / 2; scene.add(m); live.gardener = m;
  }
  // animer : îles qui flottent, Semeurs qui dérivent, le Jardinier qui tourne la tête vers le joueur (lentement)
  const m4 = new THREE.Matrix4();
  live.update = (t, hero) => {
    for (const [isl, y, ph] of live.islands) { isl.position.y = y + Math.sin(t * 0.2 + ph) * 4; isl.rotation.z = Math.sin(t * 0.15 + ph) * 0.015; }
    seeds.forEach((s, i) => {
      const a = s.a + t * s.sp, x = Math.cos(a) * s.d + Math.sin(t * 0.3 + s.ph) * 8, z = Math.sin(a) * s.d + Math.cos(t * 0.27 + s.ph) * 8;
      live.seedMesh.setMatrixAt(i, m4.compose(p3.set(x, Math.max(heightAt(x, z), -60) + s.h + Math.sin(t * 0.9 + s.ph) * 0.8, z), q.setFromAxisAngle(up, t * 0.2 + s.ph), s3.setScalar(s.s)));
    });
    live.seedMesh.instanceMatrix.needsUpdate = true;
    const g = live.gardener, want = Math.atan2(hero.x - g.position.x, hero.z - g.position.z);
    g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.002;
    live.ground(hero);
    live.updateGrass(hero);
  };
  live.ground({ x: sx0, z: sz0 }, 1e6); // tout le sol, avant la première image
  live.updateGrass({ x: sx0, z: sz0 });
  return live;
}

// La strate telle que le jeu la voit : son allure, son relief, son départ, sa sortie (le gouffre)
export const LOOK = {
  name: 'Les Jardins suspendus', sun: [0.3, 1, 0.2], sunCol: '#fff4dc', shadowCol: '#4f6fa8', fog: '#cdeee6', density: 0.00085, shadows: true,
  pal: [[0.16, 0.42, 0.3], [0.36, 0.64, 0.36], [0.24, 0.6, 0.56], [0.64, 0.68, 0.7], [0.44, 0.48, 0.56], [0.2, 0.48, 0.34], [1, 0.55, 0.72], [1, 0.9, 0.4]],
  skyMid: '#9edbfa', skyTop: '#fffdf5',
};
export function create(scene, Q) {
  const w = buildJardins(scene, Q), start = spawn();
  return Object.assign(w, {
    look: LOOK, terrain, start, camYaw: Math.atan2(start[0], start[2]),
    exitAt: (x, z) => terrain(x, z).kind === 'void', killY: () => -150,
  });
}
