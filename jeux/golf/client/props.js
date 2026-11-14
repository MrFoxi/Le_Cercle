// Mini-golf : les modèles 3D façon maquette (arbres, bâtiments, îlots flottants, nuages) et le décor de chaque univers
// autour du parcours. Unité : celle du parcours (la balle fait 7 de rayon, un mur 16 de haut). Y vers le haut.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const mats = new Map();
// Matériau satiné partagé (une couleur = un matériau)
export function mat(color, o = {}) {
  const key = `${color}|${JSON.stringify(o)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o }));
  return mats.get(key);
}
const glow = (color, k = 1.4) => mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.4 });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const add = (g, ...o) => { g.add(...o); return g; };
export const box = (w, h, d, c, x = 0, y = 0, z = 0, r = 0) => mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? mat(c) : c, x, y + h / 2, z);
export const cyl = (rt, rb, h, c, x = 0, y = 0, z = 0, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? mat(c) : c, x, y + h / 2, z);
export const ball = (r, c, x = 0, y = 0, z = 0, seg = 20) => mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), typeof c === 'string' ? mat(c) : c, x, y, z);
export const cone = (r, h, c, x = 0, y = 0, z = 0, seg = 24) => mesh(new THREE.ConeGeometry(r, h, seg), typeof c === 'string' ? mat(c) : c, x, y + h / 2, z);
export function shadows(g, cast = true) { g.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = true; } }); return g; }
const at = (o, x, y, z, s = 1, ry = 0) => { o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.y = ry; return o; };
export const rngOf = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// Texture à bandes (rayures de chapiteau, sucre d'orge, cheminée)
const stripeTex = new Map();
export function stripes(a, b, n = 8, vertical = true) {
  const key = `${a}${b}${n}${vertical}`;
  if (!stripeTex.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; vertical ? x.fillRect((i * 64) / n, 0, 64 / n + 1, 64) : x.fillRect(0, (i * 64) / n, 64, 64 / n + 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    stripeTex.set(key, t);
  }
  return stripeTex.get(key);
}
const striped = (a, b, n, vertical) => mat('#ffffff', { map: stripes(a, b, n, vertical) });

/* ---------- Végétation ---------- */
export function tree(kind = 'round', s = 1, o = {}) {
  const g = new THREE.Group(), leaf = o.leaf ?? '#5fbf4a', leaf2 = o.leaf2 ?? '#79d466', trunk = o.trunk ?? '#8a5a35';
  switch (kind) {
    case 'round':
      add(g, cyl(2.2, 3, 16, trunk), ball(11, leaf, 0, 24), ball(8, leaf2, -5, 31, 3), ball(7, leaf, 6, 29, -2));
      break;
    case 'topiary': // boules taillées sur une tige
      add(g, cyl(1.6, 2.2, 30, trunk), ball(8, leaf, 0, 12), ball(10, leaf2, 0, 32), cyl(7, 8, 6, '#c9876a'));
      break;
    case 'cypress':
      add(g, cyl(1.8, 2.4, 8, trunk), mesh(new THREE.SphereGeometry(8, 18, 14), mat(leaf), 0, 30, 0));
      g.children[1].scale.set(1, 3.1, 1);
      break;
    case 'pine': case 'snowpine':
      add(g, cyl(2, 2.6, 10, trunk));
      for (let k = 0; k < 3; k++) {
        add(g, cone(15 - k * 4, 16, leaf, 0, 8 + k * 10));
        if (kind === 'snowpine') add(g, cone(9 - k * 2.6, 6, '#ffffff', 0, 18 + k * 10));
      }
      break;
    case 'palm': {
      let y = 0, x = 0;
      for (let k = 0; k < 6; k++) { const seg = cyl(2.6 - k * 0.2, 3 - k * 0.2, 7, k % 2 ? '#b98552' : '#a0703f', x, y); g.add(seg); y += 6.6; x += k * 0.55; }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU, lf = mesh(new THREE.SphereGeometry(1, 12, 8), mat(k % 2 ? '#3fae4a' : '#58c454'), x + Math.cos(a) * 9, y + 1, Math.sin(a) * 9);
        lf.scale.set(11, 1.6, 4); lf.rotation.y = -a; lf.rotation.z = -0.35; g.add(lf);
      }
      add(g, ball(2.4, '#7a4a24', x + 1.5, y - 1, 1.5), ball(2.4, '#7a4a24', x - 1, y - 1.5, -1.5));
      break;
    }
    case 'dead':
      add(g, cyl(1.5, 3.2, 30, '#5a4a5e'));
      for (const [a, y, l] of [[0.6, 18, 14], [-0.8, 22, 12], [2.4, 26, 10], [3.6, 14, 9]]) { const b = cyl(0.6, 1.2, l, '#5a4a5e', 0, 0, 0, 8); b.position.set(Math.cos(a) * 3, y, Math.sin(a) * 3); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(b); }
      break;
    case 'jungle':
      add(g, cyl(3, 4.5, 34, trunk), ball(15, leaf, 0, 40), ball(11, leaf2, -12, 34, 6), ball(11, leaf2, 11, 36, -5), ball(9, leaf, 4, 50, 4));
      break;
    case 'cactus':
      add(g, mesh(new THREE.CapsuleGeometry(4.2, 26, 6, 14), mat('#4fae5a'), 0, 17, 0));
      for (const [sx, h] of [[-1, 12], [1, 17]]) {
        add(g, mesh(new THREE.CapsuleGeometry(2.6, 6, 6, 10), mat('#4fae5a'), sx * 6, h, 0));
        g.children.at(-1).rotation.z = (Math.PI / 2) * sx; add(g, mesh(new THREE.CapsuleGeometry(2.6, 8, 6, 10), mat('#58bb62'), sx * 9, h + 6, 0));
      }
      add(g, ball(2.2, '#ff7aa8', 0, 34, 0));
      break;
    case 'lollipop':
      add(g, cyl(1, 1, 28, '#ffffff'), mesh(new THREE.CylinderGeometry(11, 11, 4, 32), striped(o.c ?? '#ff6fa8', '#ffffff', 10), 0, 36, 0));
      g.children[1].rotation.x = Math.PI / 2;
      break;
    case 'coral':
      for (let k = 0; k < 7; k++) { const a = k * 1.7, h = 10 + (k % 3) * 7, col = ['#ff7f6e', '#ff8fc0', '#ffb35a'][k % 3]; const b = mesh(new THREE.CapsuleGeometry(2.8, h, 6, 12), mat(col, { emissive: col, emissiveIntensity: 0.25, roughness: 0.5 }), Math.cos(a) * 4, h / 2 + 2, Math.sin(a) * 4); b.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); g.add(b); }
      add(g, ball(5, mat('#ff9a8a', { emissive: '#ff7f6e', emissiveIntensity: 0.2 }), 0, 3));
      break;
    case 'kelp':
      for (let k = 0; k < 5; k++) { const b = mesh(new THREE.CapsuleGeometry(1.6, 10, 4, 8), mat('#3fae7a'), Math.sin(k) * 1.5, 6 + k * 9.5, Math.cos(k) * 1.5); b.rotation.z = Math.sin(k * 1.3) * 0.3; g.add(b); }
      break;
    case 'bush':
      add(g, ball(7, leaf, 0, 5), ball(6, leaf2, 6, 4, 2), ball(5, leaf, -5, 4, 3));
      break;
    case 'flowers':
      for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 3 + (k % 3) * 2; add(g, cyl(0.35, 0.35, 5, '#3f9a3a', Math.cos(a) * r, 0, Math.sin(a) * r, 5), ball(1.6, ['#ffffff', '#ffe066', '#ff8fb1', '#b98cff'][k % 4], Math.cos(a) * r, 5.5, Math.sin(a) * r, 8)); }
      break;
  }
  g.scale.setScalar(s);
  return shadows(g);
}

/* ---------- Architecture ---------- */
function gable(w, d, h, c) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 2, 0); s.lineTo(0, h); s.lineTo(w / 2 + 2, 0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d + 4, bevelEnabled: false }); geo.translate(0, 0, -(d + 4) / 2);
  return new THREE.Mesh(geo, mat(c));
}
function windows(g, w, h, d, y0, rows, cols, c = '#3b4a6b', lit) {
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = -w / 2 + ((k + 0.5) * w) / cols, y = y0 + r * (h / rows) + 2;
    g.add(box(w / cols * 0.42, h / rows * 0.5, 0.8, lit && (r + k) % 3 === 0 ? glow('#ffe08a', 0.6) : c, x, y, d / 2 + 0.2));
  }
}
export function house(w = 30, d = 24, h = 22, wall = '#fff4e2', roof = '#e0605e', o = {}) {
  const g = new THREE.Group();
  g.add(box(w, h, d, wall, 0, 0, 0, 1.2));
  const r = gable(w, d, h * 0.6, roof); r.position.y = h; g.add(r);
  windows(g, w, h * 0.7, d, h * 0.2, o.rows ?? 1, o.cols ?? 2, '#4a5a7a', o.lit);
  g.add(box(6, 10, 1, '#8a5a35', o.cols === 1 ? w / 3 : 0, 0, d / 2 + 0.3));
  if (o.chimney) g.add(box(4, 12, 4, '#b96a4a', w / 4, h + 2, -d / 6));
  return shadows(g);
}
export function tower(r = 9, h = 50, wall = '#f2ead8', roof = '#5b7bd6', o = {}) {
  const g = new THREE.Group();
  g.add(cyl(r, r * 1.08, h, o.bands ? striped(o.bands[0], o.bands[1], 6, false) : wall));
  if (o.bands) g.children[0].material.map.repeat?.set(1, 1);
  g.add(cyl(r + 1.8, r + 1.8, 3, o.trim ?? '#ffffff', 0, h));
  if (o.lamp) g.add(cyl(r * 0.7, r * 0.7, 8, glow('#fff3a0', 1.2), 0, h + 3), cone(r * 0.9, 9, roof, 0, h + 11));
  else g.add(cone(r + 2.5, r * 1.6, roof, 0, h + 3));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; const wdw = box(3, 6, 1, '#3b4a6b', Math.cos(a) * r, h * 0.55, Math.sin(a) * r); wdw.lookAt(Math.cos(a) * r * 3, h * 0.55, Math.sin(a) * r * 3); g.add(wdw); }
  return shadows(g);
}
export function dome(r = 16, base = '#ffffff', top = '#9fd8ff', o = {}) {
  const g = new THREE.Group();
  g.add(cyl(r, r, r * 0.45, base));
  const d = mesh(new THREE.SphereGeometry(r * 0.95, 28, 14, 0, TAU, 0, Math.PI / 2), o.glass ? mat(top, { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 }) : mat(top), 0, r * 0.45, 0);
  g.add(d);
  if (o.glass) g.add(ball(r * 0.35, o.inner ?? '#5fbf4a', 0, r * 0.45 + r * 0.3));
  g.add(cyl(r * 1.08, r * 1.08, 2, o.trim ?? '#e8e2d6', 0, r * 0.45 - 1));
  return shadows(g);
}
export function windmill(c = '#f6efe2', roof = '#d65a4e') {
  const g = new THREE.Group();
  g.add(cyl(10, 14, 40, c), cone(12, 14, roof, 0, 40));
  const sails = new THREE.Group(); sails.position.set(0, 42, 13);
  for (let k = 0; k < 4; k++) { const s = new THREE.Group(); s.add(box(3, 34, 1, '#8a5a35', 0, 0, 0), box(8, 24, 0.6, '#fffaf0', 5, 9, 0.3)); s.rotation.z = (k / 4) * TAU; sails.add(s); }
  sails.add(ball(3, '#8a5a35'));
  g.add(sails); g.userData.spin = { obj: sails, axis: 'z', speed: 0.8 };
  g.add(box(6, 10, 1, '#8a5a35', 0, 0, 13));
  return shadows(g);
}
export function gazebo(c = '#ffffff', roof = '#ff9fb4') {
  const g = new THREE.Group();
  g.add(cyl(16, 17, 3, '#e6ddd0'));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.add(cyl(1.3, 1.3, 18, c, Math.cos(a) * 13, 3, Math.sin(a) * 13, 10)); }
  g.add(cyl(16, 16, 2.5, c, 0, 21), mesh(new THREE.SphereGeometry(15, 24, 10, 0, TAU, 0, Math.PI / 2), mat(roof), 0, 23.5, 0), ball(2, '#ffd23f', 0, 39));
  return shadows(g);
}
export function fountain(water = '#6fe0f0') {
  const g = new THREE.Group();
  g.add(cyl(14, 15, 5, '#efe9df'), cyl(12.5, 12.5, 0.6, mat(water, { roughness: 0.15 }), 0, 4.6), cyl(2, 2.5, 12, '#efe9df'), cyl(6, 4, 2.5, '#efe9df', 0, 11), cone(1.4, 6, mat(water, { transparent: true, opacity: 0.7 }), 0, 13));
  return shadows(g);
}
export function lighthouse() { return tower(8, 56, '#fff', '#e0505a', { bands: ['#ffffff', '#e0505a'], lamp: true }); }
export function hut(c = '#e9c98a', roof = '#c49a4a') {
  const g = new THREE.Group();
  for (const [x, z] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) g.add(cyl(1, 1, 8, '#8a5a35', x, 0, z, 8));
  g.add(box(22, 12, 18, c, 0, 8, 0, 1), cone(17, 14, roof, 0, 20, 0, 4));
  g.children.at(-1).rotation.y = Math.PI / 4;
  return shadows(g);
}
export function rocket() {
  const g = new THREE.Group(), pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) * 9 * (t > 0.8 ? (1 - t) * 5 : 1) + 0.01, t * 70)); }
  g.add(mesh(new THREE.LatheGeometry(pts, 24), mat('#eef2f8', { metalness: 0.35, roughness: 0.3 }), 0, 8, 0));
  for (let k = 0; k < 3; k++) { const f = box(1.2, 16, 10, '#ff5a7a', 0, 6, 0); const a = (k / 3) * TAU; f.position.set(Math.cos(a) * 9, 8, Math.sin(a) * 9); f.rotation.y = -a; g.add(f); }
  g.add(ball(3.2, glow('#7be8ff', 0.9), 0, 52, 7.6), cyl(12, 14, 6, '#8c96b8'), cyl(3, 5, 6, glow('#ffb04a', 1.6), 0, 4));
  return shadows(g);
}
export function antenna() {
  const g = new THREE.Group();
  g.add(cyl(1.6, 3, 50, '#c8d0e0'), ball(3, glow('#ff5ad8', 1.6), 0, 52), mesh(new THREE.TorusGeometry(10, 0.9, 8, 32), glow('#5ff0ff', 1.1), 0, 34, 0));
  g.children[2].rotation.x = Math.PI / 2;
  g.userData.spin = { obj: g.children[2], axis: 'z', speed: 1.2 };
  return shadows(g);
}
export function volcano() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(16, 60, 70, 10), mat('#5a463f', { flatShading: true }), 0, 35, 0));
  g.add(cyl(13, 13, 2, glow('#ff6a2a', 1.8), 0, 69.5));
  for (let k = 0; k < 3; k++) g.add(mesh(new THREE.CylinderGeometry(16.6, 60.6, 70, 24, 1, true, k * 2.1, 0.16), glow('#ff7a2a', 1.2), 0, 35, 0)); // coulées de lave
  return shadows(g);
}
export function basalt(n = 6, rand = Math.random) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) { const h = 14 + rand() * 30; g.add(cyl(6, 6, h, k % 2 ? '#4e403b' : '#5d4c46', (rand() - 0.5) * 26, 0, (rand() - 0.5) * 26, 6)); }
  return shadows(g);
}
export function cupcake(c = '#ff9ec7') {
  const g = new THREE.Group();
  g.add(cyl(13, 10, 14, striped('#f6d6a8', '#e8bb7e', 16)), ball(14, c, 0, 18), ball(10, c, 0, 26), ball(6, '#ffffff', 0, 33), ball(3.4, '#e0263c', 0, 39));
  for (const b of g.children.slice(1, 3)) b.scale.y = 0.7;
  return shadows(g);
}
export function candyArch(c = '#ff4f7b') {
  const g = new THREE.Group(), t = mesh(new THREE.TorusGeometry(20, 3, 12, 40, Math.PI), striped(c, '#ffffff', 16), 0, 0, 0);
  g.add(t);
  return shadows(g);
}
export function manor() {
  const g = new THREE.Group();
  g.add(box(46, 30, 26, '#7a7290', 0, 0, 0, 1.5));
  const r = gable(46, 26, 18, '#4a4260'); r.position.y = 30; g.add(r);
  windows(g, 46, 24, 26, 4, 2, 4, '#3b3550', true);
  for (const x of [-26, 26]) { const t = tower(8, 44, '#6e6684', '#3e3654'); t.position.x = x; g.add(t); }
  return shadows(g);
}
export function tomb(c = '#a6a2b8') {
  const g = new THREE.Group();
  g.add(box(10, 13, 4, c, 0, 0, 0, 1.6), box(2, 8, 1, '#7a768c', 0, 5, 2.2), box(6, 1.8, 1, '#7a768c', 0, 8.5, 2.2));
  return shadows(g);
}
export function fence(len = 60, c = '#5a5068') {
  const g = new THREE.Group();
  g.add(box(len, 2, 1.4, c, 0, 9), box(len, 2, 1.4, c, 0, 4));
  for (let x = -len / 2; x <= len / 2; x += 6) g.add(box(1.6, 14, 1.6, c, x, 0, 0), cone(1.4, 3, c, x, 14, 0, 4));
  return shadows(g);
}
export function igloo() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(18, 24, 12, 0, TAU, 0, Math.PI / 2), mat('#f6fbff', { roughness: 0.4 })));
  const tun = mesh(new THREE.CylinderGeometry(7, 7, 12, 16, 1, false, 0, Math.PI), mat('#eef7ff')); tun.rotation.z = Math.PI / 2; tun.rotation.y = Math.PI / 2; tun.position.set(0, 0, 18); g.add(tun);
  g.add(box(9, 7, 1, '#6b8fb0', 0, 0, 23.5));
  return shadows(g);
}
export function iceSpire(h = 50) {
  const g = new THREE.Group(), m = mat('#bfe6ff', { transparent: true, opacity: 0.82, roughness: 0.08 });
  g.add(cone(9, h, m, 0, 0, 0, 6), cone(5, h * 0.6, m, 10, 0, 4, 6), cone(4, h * 0.45, m, -7, 0, -6, 6));
  return shadows(g);
}
export function bigTop() {
  const g = new THREE.Group();
  g.add(cyl(30, 30, 18, striped('#e23b3b', '#ffffff', 16)), cone(34, 26, striped('#e23b3b', '#ffffff', 16), 0, 18), cyl(0.8, 0.8, 10, '#ffffff', 0, 44, 0, 6));
  const f = box(8, 5, 0.4, '#ffd23f', 4, 49, 0); g.add(f);
  g.add(box(10, 12, 1, '#2b1f4a', 0, 0, 30));
  return shadows(g);
}
export function ferris() {
  const g = new THREE.Group(), wheel = new THREE.Group();
  wheel.position.y = 46;
  wheel.add(mesh(new THREE.TorusGeometry(36, 1.4, 8, 48), mat('#ffcf3f')));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU, sp = box(0.9, 36, 0.9, '#ffffff'); sp.position.set(Math.cos(a) * 18, Math.sin(a) * 18, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    wheel.add(box(6, 6, 6, ['#ff3d5a', '#3d8bff', '#43c173', '#ff9a1f', '#b98cff'][k % 5], Math.cos(a) * 36, Math.sin(a) * 36 - 3, 0, 1));
  }
  for (const s of [-1, 1]) { const leg = box(2, 52, 2, '#e2e2ea', s * 14, 0, 0); leg.rotation.z = s * 0.28; leg.position.x = s * 7; g.add(leg); }
  g.add(wheel); g.userData.spin = { obj: wheel, axis: 'z', speed: 0.25 };
  return shadows(g);
}
export function wreck() {
  const g = new THREE.Group(), hull = mesh(new THREE.CylinderGeometry(14, 14, 60, 18, 1, false, 0, Math.PI), mat('#8a6a4a', { side: THREE.DoubleSide }), 0, 12, 0);
  hull.rotation.z = Math.PI / 2; hull.rotation.x = Math.PI; g.add(hull);
  g.add(box(2.4, 34, 2.4, '#6b4e33', 6, 10, 0), box(18, 1.4, 1.4, '#6b4e33', 6, 34, 0));
  g.rotation.z = 0.18;
  return shadows(g);
}
export function temple(c = '#c9b07a', moss = '#6fbf5a') {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) { const s = 56 - k * 12; g.add(box(s, 10, s, k % 2 ? c : '#bca066', 0, k * 10, 0, 1)); g.add(box(s + 1, 1.5, s + 1, moss, 0, k * 10 + 9)); }
  g.add(box(12, 14, 12, '#a8905c', 0, 40), box(6, 8, 1, '#3a2c1a', 0, 40, 6.2));
  for (let k = 0; k < 4; k++) g.add(box(10, 2.5, 3, '#d8c08a', 0, k * 10, 28 - k * 6)); // escalier
  return shadows(g);
}
export function chimney(h = 70, c = '#c96a4a') {
  const g = new THREE.Group();
  g.add(cyl(6, 8, h, striped(c, '#efe6dc', 8, false)), cyl(7, 7, 3, '#5a5a66', 0, h));
  const puffs = [];
  for (let k = 0; k < 4; k++) { const p = ball(5, mat('#ffffff', { transparent: true, opacity: 0.85 }), 0, h + 6 + k * 9); puffs.push(p); g.add(p); }
  g.userData.smoke = { puffs, h };
  return shadows(g);
}
export function tank(c = '#7fc2d6') {
  const g = new THREE.Group();
  g.add(cyl(13, 13, 28, c), mesh(new THREE.SphereGeometry(13, 24, 10, 0, TAU, 0, Math.PI / 2), mat(c), 0, 28, 0));
  for (const y of [8, 18]) g.add(cyl(13.4, 13.4, 1.4, '#5a6c78', 0, y));
  for (let y = 2; y < 30; y += 4) g.add(box(5, 0.8, 0.8, '#ffd23f', 0, y, 13.6));
  return shadows(g);
}
export function gear(r = 14, c = '#ffb627') {
  const g = new THREE.Group(), w = new THREE.Group();
  w.add(cyl(r, r, 5, c, 0, -2.5));
  w.children[0].rotation.x = Math.PI / 2; w.children[0].position.y = 0;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, t = box(5, 5, 5, c, 0, -2.5, 0); t.position.set(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 0); t.rotation.z = a; w.add(t); }
  w.add(cyl(r * 0.35, r * 0.35, 6, '#5a6c78', 0, -3)); w.children.at(-1).rotation.x = Math.PI / 2; w.children.at(-1).position.y = 0;
  g.add(w); g.userData.spin = { obj: w, axis: 'z', speed: 0.9 };
  return shadows(g);
}
export function hall(w = 60, d = 34, c = '#e8edf2', roof = '#7fa0c0') {
  const g = new THREE.Group();
  g.add(box(w, 18, d, c, 0, 0, 0, 1));
  for (let k = 0; k < 4; k++) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w / 4, 0); s.lineTo(w / 4, 10); s.closePath(); const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); geo.translate(-w / 2 + (k * w) / 4, 18, -d / 2); g.add(new THREE.Mesh(geo, mat(k % 2 ? roof : '#9cc3e6'))); }
  windows(g, w, 12, d, 3, 1, 6, '#5a7a9a');
  return shadows(g);
}
export function adobe(w = 30, d = 26, h = 20, c = '#e8b07a', o = {}) {
  const g = new THREE.Group();
  g.add(box(w, h, d, c, 0, 0, 0, 2.5), box(w + 2, 2.5, d + 2, '#f3c894', 0, h - 1, 0, 1));
  if (o.dome) g.add(mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.32, 20, 10, 0, TAU, 0, Math.PI / 2), mat(o.dome), 0, h + 1, 0));
  windows(g, w, h * 0.6, d, h * 0.25, 1, 2, '#6b3f2a');
  g.add(box(6, 11, 1, '#4fb8c8', -w / 5, 0, d / 2 + 0.4));
  return shadows(g);
}
export function mesa(rand = Math.random, cols = ['#e0a868', '#c97f4f', '#a35a3a']) {
  const g = new THREE.Group();
  let y = 0;
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Shape(), n = 7, r0 = 30 - k * 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = r0 * (0.75 + rand() * 0.35); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const h = 14 + rand() * 8, geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    g.add(new THREE.Mesh(geo, mat(cols[k % 3], { flatShading: true })));
    y += h;
  }
  return shadows(g);
}
export function pyramid(s = 50, c = '#e8c27a') {
  const g = new THREE.Group(), p = cone(s * 0.72, s * 0.7, mat(c, { flatShading: true }), 0, 0, 0, 4);
  p.rotation.y = Math.PI / 4; g.add(p);
  for (let k = 1; k < 5; k++) { const r = s * 0.72 * (1 - k / 5) + 0.4, band = cyl(r, r, 1, mat('#d4ac62', { flatShading: true }), 0, (k * s * 0.7) / 5, 0, 4); band.rotation.y = Math.PI / 4; g.add(band); }
  return shadows(g);
}
export function stairs(n = 6, w = 20, step = 6, c = '#efe9df') {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) g.add(box(w, (k + 1) * step, step * 1.4, c, 0, 0, -k * step * 1.4, 0.8));
  return shadows(g);
}
export function arch(w = 40, h = 34, c = '#f2ead8', top = '#ff8fb1') {
  const g = new THREE.Group();
  g.add(box(8, h, 8, c, -w / 2, 0, 0, 1), box(8, h, 8, c, w / 2, 0, 0, 1), box(w + 14, 7, 10, top, 0, h, 0, 1.5));
  return shadows(g);
}
export function rings() {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const t = mesh(new THREE.TorusGeometry(16 + k * 7, 1.1, 8, 48), glow(['#5ff0ff', '#ff5ad8', '#b98cff'][k], 1), 0, 0, 0); t.rotation.x = Math.PI / 2 + k * 0.35; t.rotation.y = k * 0.6; g.add(t); }
  g.userData.spin = { obj: g, axis: 'y', speed: 0.3 };
  return g;
}
export function planet(r = 30, c = '#ffb27a', ring = '#ffe2c0') {
  const g = new THREE.Group();
  g.add(ball(r, c, 0, 0, 0, 32));
  const t = mesh(new THREE.RingGeometry(r * 1.3, r * 1.9, 48), mat(ring, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); t.rotation.x = -1.2; g.add(t);
  return g;
}
export function moon(r = 22) { return ball(r, mat('#fff8dc', { emissive: '#fff3c0', emissiveIntensity: 0.6 }), 0, 0, 0, 32); }
export function balloons(cols = ['#ff3d5a', '#3d8bff', '#ffd23f']) {
  const g = new THREE.Group();
  cols.forEach((c, k) => { const x = (k - 1) * 5; g.add(cyl(0.2, 0.2, 26, '#ffffff', x * 0.4, 0, 0, 4), ball(4.2, mat(c, { roughness: 0.25 }), x, 30 + (k % 2) * 3, 0)); g.children.at(-1).scale.y = 1.2; });
  g.userData.bob = true;
  return shadows(g);
}
export function candle() {
  const g = new THREE.Group();
  g.add(cyl(2.4, 2.6, 10, '#f3ead6'), ball(1.8, glow('#ffcf5a', 2.2), 0, 12.5));
  g.children[1].scale.y = 1.6; g.userData.flame = g.children[1];
  return shadows(g);
}
export function shell() { const g = new THREE.Group(); const s = mesh(new THREE.SphereGeometry(5, 12, 6, 0, Math.PI), mat('#ffd9c2')); s.rotation.x = -Math.PI / 2; g.add(s); return shadows(g); }

/* ---------- Îlots flottants et nuages ---------- */
// Un îlot rond en couches (dessus d'herbe, terre, roche) qui se rétrécit vers le bas ; ses objets se posent à y = 0.
export function islet(r, th, o = {}) {
  const g = new THREE.Group(), top = o.top ?? th.ground, layers = th.strata;
  g.add(mesh(new THREE.CylinderGeometry(r, r, 6, 40), mat(top), 0, -3, 0));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 2, 40), mat(th.lip ?? th.ground2), 0, -6.8, 0));
  let y = -7.8, rr = r;
  layers.forEach((c, k) => { const h = r * (0.22 + k * 0.06); g.add(mesh(new THREE.CylinderGeometry(rr, rr * 0.86, h, 40), mat(c), 0, y - h / 2, 0)); y -= h; rr *= 0.86; });
  g.add(mesh(new THREE.ConeGeometry(rr, r * 0.55, 40), mat(layers.at(-1)), 0, y - r * 0.275, 0));
  g.children.at(-1).rotation.x = Math.PI;
  return shadows(g, true);
}
export function cloud(rand = Math.random, s = 1) {
  const g = new THREE.Group(), m = mat('#ffffff', { roughness: 0.95, transparent: true, opacity: 0.92 });
  const n = 4 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) { const r = 9 + rand() * 9; const b = ball(r, m, (k - n / 2) * 11 + rand() * 4, rand() * 5, (rand() - 0.5) * 12, 16); b.scale.y = 0.75; g.add(b); }
  g.scale.setScalar(s);
  return g;
}

/* ---------- Le décor de chaque univers ---------- */
// Repère : parcours centré, x de -500 à 500, z de -300 à 300 ; la caméra regarde depuis +x, +z.
// Les grandes constructions vont derrière (z < -330) et à gauche (x < -540) ; devant, seulement des îlots plus bas.
export function environment(theme, th, rand) {
  const g = new THREE.Group(), spin = [], smoke = [], bob = [];
  const put = (o, x, y, z, s = 1, ry = 0) => { at(o, x, y, z, s, ry); g.add(o); if (o.userData.spin) spin.push(o.userData.spin); if (o.userData.smoke) smoke.push(o.userData.smoke); if (o.userData.bob) bob.push(o); return o; };
  const S = 1.35; // le décor est plus grand que nature, pour l'effet maquette
  const isle = (x, y, z, r, items = [], top) => { const i = islet(r * S, th, { top }); put(i, x, y, z); for (const [o, dx, dz, s = 1, ry = 0] of items) put(o, x + dx * S, y, z + dz * S, s * S, ry); return i; };
  const T = (k, s, o) => tree(k, s, o ?? th.trees);
  // Partout : îlots de fond, nuages, et petits îlots en contrebas devant
  const lowIsles = [[640, -170, 260, 34], [-180, -230, 470, 30], [380, -260, 520, 22], [700, -120, -120, 26]];
  const lowItem = { classic: () => T('round', 0.8), tropical: () => T('palm', 0.8), space: () => antenna(), volcano: () => basalt(4, rand), candy: () => T('lollipop', 0.8, { c: '#7bd3ff' }), haunted: () => T('dead', 0.8), ice: () => T('snowpine', 0.8), fair: () => balloons(), sea: () => T('coral', 1), jungle: () => T('jungle', 0.6), factory: () => tank(), desert: () => T('cactus', 0.8) }[theme] ?? (() => T('round', 0.8));
  for (const [x, y, z, r] of lowIsles) isle(x, y, z, r, [[lowItem(), 0, 0]]);
  for (let k = 0; k < 9; k++) { const c = cloud(rand, 0.8 + rand() * 1.2); put(c, -800 + rand() * 1600, -80 - rand() * 160, -560 + rand() * 1200); c.userData.drift = 4 + rand() * 6; bob.push(c); }
  // Escalier qui monte du parcours vers l'îlot de derrière
  const stairsUp = (x, c) => put(stairs(7, 24, 6, c ?? th.stone ?? '#efe9df'), x, -6, -326, 1, 0);
  switch (theme) {
    case 'classic': // jardin miniature
      isle(-250, 24, -420, 70, [[windmill(), 0, -10], [T('cypress', 1.1), -45, 20], [T('cypress', 1), 50, 18], [T('flowers', 1.6), 30, 40]]);
      isle(160, 50, -440, 58, [[gazebo(), 0, -6], [T('topiary', 1), -36, 18], [T('topiary', 1), 38, 16]]);
      isle(420, 10, -400, 46, [[fountain(th.water), 0, 0], [T('round', 1), -28, -18], [T('bush', 1.2), 26, 20]]);
      isle(-640, 0, -40, 60, [[house(34, 26, 22, '#fff4e2', '#e0605e', { chimney: true }), 0, -6], [T('round', 1.1), -30, 30], [T('round', 0.9), 34, 26]]);
      isle(-620, 40, 230, 40, [[T('cypress', 1.2), -10, 0], [T('cypress', 1), 14, 6]]);
      stairsUp(-120);
      break;
    case 'tropical':
      isle(-260, 10, -420, 66, [[lighthouse(), 0, -6], [T('palm', 1.1), 40, 20], [hut(), -40, 24, 0.8]]);
      isle(180, 30, -440, 54, [[T('palm', 1.2), -20, 0], [T('palm', 1), 22, 10], [hut('#f0d9a8', '#d4a85a'), 0, -30, 0.8]], th.sand);
      isle(-640, -10, 30, 56, [[T('palm', 1.1), 0, 0], [T('palm', 0.9), 26, 20]], th.sand);
      isle(460, -20, -380, 40, [[T('palm', 1), 0, 0]], th.sand);
      stairsUp(-100, '#f2dca0');
      break;
    case 'space': // futuriste
      isle(-250, 30, -430, 64, [[rocket(), 0, 0], [antenna(), 44, 20]], '#6a5fc4');
      isle(170, 60, -440, 60, [[dome(26, '#e8ecff', '#9fe8ff', { glass: true, inner: '#5fbf4a' }), 0, 0]], '#6a5fc4');
      put(rings(), 430, 90, -420, 1.4);
      put(planet(48, '#ffb27a', '#ffe2c0'), -560, 200, -620);
      put(planet(22, '#7be8ff', '#c8f6ff'), 600, 170, -560);
      isle(-640, 0, 0, 52, [[dome(20, '#e8ecff', '#ff9fe0', { glass: true, inner: '#ffd23f' }), 0, 0]], '#6a5fc4');
      stairsUp(-110, '#c8d0f0');
      break;
    case 'volcano':
      put(volcano(), -260, -10, -470, 2);
      isle(180, 20, -430, 54, [[basalt(7, rand), 0, 0]], '#7a6a66');
      isle(-640, 0, 20, 50, [[basalt(5, rand), 0, 0]], '#7a6a66');
      isle(460, 40, -400, 36, [[basalt(4, rand), 0, 0]], '#7a6a66');
      break;
    case 'candy':
      isle(-250, 30, -420, 64, [[cupcake('#ff9ec7'), 0, 0, 1.4], [T('lollipop', 1.1, { c: '#ff6fa8' }), 44, 18], [T('lollipop', 0.9, { c: '#ffd23f' }), -44, 22]], '#ffe1f0');
      isle(170, 50, -440, 56, [[cupcake('#a8e6ff'), 0, 0, 1.2], [candyArch('#ff4f7b'), 0, 30, 1]], '#ffe1f0');
      isle(-640, 0, 20, 52, [[cupcake('#c9b3ff'), 0, 0], [T('lollipop', 1, { c: '#8ee88e' }), 30, 26]], '#ffe1f0');
      put(candyArch('#7bd3ff'), 440, 0, -360, 1.3);
      stairsUp(-110, '#ffffff');
      break;
    case 'haunted':
      isle(-250, 20, -440, 72, [[manor(), 0, -6], [T('dead', 1.2), 50, 26], [fence(70), 0, 40]], '#6f8f6a');
      isle(200, 40, -430, 50, [[tomb(), -12, 0, 1.2], [tomb(), 14, 6, 1.1], [T('dead', 1), 0, -24]], '#6f8f6a');
      put(moon(26), 520, 220, -600);
      isle(-640, 0, 10, 48, [[T('dead', 1.2), 0, 0], [tomb(), 20, 18]], '#6f8f6a');
      stairsUp(-120, '#9a96b0');
      break;
    case 'ice':
      isle(-250, 20, -430, 66, [[igloo(), 0, 0, 1.2], [T('snowpine', 1.1), 44, 20], [T('snowpine', 0.9), -46, 16]], '#f4fbff');
      isle(180, 40, -440, 56, [[iceSpire(70), 0, 0], [iceSpire(40), 30, 20]], '#f4fbff');
      isle(-640, 0, 10, 52, [[T('snowpine', 1.2), 0, 0], [T('snowpine', 0.9), 26, 22]], '#f4fbff');
      isle(450, 10, -390, 40, [[iceSpire(46), 0, 0]], '#f4fbff');
      stairsUp(-110, '#e6f4fd');
      break;
    case 'fair':
      isle(-240, 20, -440, 74, [[ferris(), 0, 0, 1.1]]);
      isle(180, 30, -430, 62, [[bigTop(), 0, 0, 1.1]]);
      isle(-640, 0, 20, 50, [[balloons(), 0, 0, 1.4], [balloons(['#43c173', '#ff9a1f', '#ff3d8b']), 20, 18, 1.2]]);
      isle(460, 10, -390, 40, [[bigTop(), 0, 0, 0.5]]);
      stairsUp(-110, '#ffcf3f');
      break;
    case 'sea':
      isle(-250, 0, -430, 70, [[wreck(), 0, 0, 1.2], [T('kelp', 1.2), 46, 20], [T('coral', 1.4), -46, 24]], th.ground);
      isle(170, 30, -440, 56, [[T('coral', 2), 0, 0], [T('kelp', 1.4), 26, 18], [T('kelp', 1.1), -24, 14]], th.ground);
      isle(-640, -10, 10, 50, [[T('coral', 1.6), 0, 0], [T('kelp', 1.2), 24, 20]], th.ground);
      break;
    case 'jungle':
      isle(-250, 20, -440, 76, [[temple(), 0, -4, 1.1], [T('jungle', 1), 52, 26], [T('jungle', 0.8), -54, 28]]);
      isle(190, 40, -440, 54, [[T('jungle', 1.3), 0, 0], [T('palm', 1), 30, 22]]);
      isle(-640, 0, 0, 56, [[T('jungle', 1.1), 0, 0], [T('jungle', 0.8), 26, 26]]);
      stairsUp(-110, '#c9b07a');
      break;
    case 'factory': // industriel cartoon
      isle(-250, 10, -430, 72, [[hall(70, 40), 0, 0], [chimney(80, '#e0605e'), 46, -10], [chimney(60, '#5b7bd6'), -46, -8]], '#9aa7b3');
      isle(180, 30, -440, 58, [[tank('#7fc2d6'), -18, 0], [tank('#ffb627'), 22, 10, 0.8]], '#9aa7b3');
      put(gear(22, '#ffb627'), 430, 60, -420); put(gear(14, '#ff6b3d'), 470, 30, -390);
      isle(-640, 0, 20, 52, [[chimney(56, '#43c173'), 0, 0], [tank('#c9b3ff'), 26, 22, 0.6]], '#9aa7b3');
      stairsUp(-110, '#c8d0d8');
      break;
    case 'desert':
      put(mesa(rand), -250, -20, -450, 2.1);
      isle(180, 20, -440, 62, [[adobe(34, 28, 22, '#e8b07a', { dome: '#4fb8c8' }), 0, 0], [T('palm', 1), 40, 22], [T('cactus', 0.9), -40, 20]], th.ground);
      put(pyramid(100, '#ecc57c'), 480, -10, -450);
      isle(-640, 0, 10, 54, [[adobe(28, 22, 18, '#f0c08a'), 0, 0], [T('cactus', 1), 28, 24]], th.ground);
      stairsUp(-110, '#f6d3a6');
      break;
  }
  return { group: g, spin, smoke, bob };
}
