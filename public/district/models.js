// Little District : tout ce qui se dessine. Textures peintes au canvas, bâtiments selon leur niveau,
// décorations, arbres de saison et habitants. Repère local d'un bâtiment : façade vers +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const KANJI = '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS Mincho", serif';
export const FLOOR = 1.45; // hauteur d'un étage

export const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- Textures ----------
const texCache = new Map();
export function canvasTex(key, w, h, paint, { repeat, color = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  texCache.set(key, t);
  return t;
}
const noise = (x, w, h, n, a, rng) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${a * rng()})`; x.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3); } };

export const TEX = {
  wood: (base = '#6b4a32') => canvasTex('wood' + base, 256, 256, (x, w, h) => {
    const r = seeded(7);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.14})`; x.fillRect(i * 32, 0, 32, h);
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(i * 32, 0, 2, h);
      for (let k = 0; k < 9; k++) { x.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.1})`; x.beginPath(); const gx = i * 32 + 4 + r() * 24; x.moveTo(gx, 0); x.bezierCurveTo(gx + 6 * r() - 3, h / 3, gx + 6 * r() - 3, h * 0.6, gx + 4 * r() - 2, h); x.stroke(); }
    }
    noise(x, w, h, 900, 0.08, r);
  }, { repeat: [1, 1] }),
  roof: (base = '#2f3440') => canvasTex('roof' + base, 256, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const g = x.createLinearGradient(col * 32, 0, col * 32 + 32, 0);
      g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
      x.fillStyle = g; x.fillRect(col * 32, row * 32, 32, 32);
    }
    for (let row = 0; row < 8; row++) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, row * 32 + 28, w, 4); x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(0, row * 32, w, 2); }
  }, { repeat: [1, 1] }),
  pave: () => canvasTex('pave', 512, 512, (x, w, h) => {
    const r = seeded(11);
    x.fillStyle = '#4a4744'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let i = -1; i < w / 48 + 1; i++) {
      const ox = (y / 32) % 2 ? 24 : 0, l = 50 + r() * 30;
      x.fillStyle = `hsl(30, ${4 + r() * 6}%, ${l * 0.5}%)`;
      x.beginPath(); x.roundRect(i * 48 + ox + 2, y + 2, 44, 28, 6); x.fill();
    }
    noise(x, w, h, 4000, 0.12, r);
  }, { repeat: [1, 1] }),
  asphalt: () => canvasTex('asphalt', 512, 512, (x, w, h) => {
    const r = seeded(5);
    x.fillStyle = '#2c2d31'; x.fillRect(0, 0, w, h);
    noise(x, w, h, 14000, 0.18, r);
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 5; k++) x.lineTo(px += r() * 60 - 30, py += r() * 60 - 30); x.stroke(); }
  }, { repeat: [1, 1] }),
  slab: () => canvasTex('slab', 256, 256, (x, w, h) => {
    const r = seeded(9);
    x.fillStyle = '#7a7670'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { x.fillStyle = `hsl(32, 6%, ${30 + r() * 9}%)`; x.fillRect(i * 64 + 2, k * 64 + 2, 60, 60); }
    noise(x, w, h, 3000, 0.1, r);
  }, { repeat: [1, 1] }),
  dirt: () => canvasTex('dirt', 256, 256, (x, w, h) => {
    const r = seeded(13);
    x.fillStyle = '#5a4634'; x.fillRect(0, 0, w, h);
    noise(x, w, h, 6000, 0.25, r);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${150 + r() * 60},${140 + r() * 50},${120 + r() * 40},.5)`; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 2.5, 0, 7); x.fill(); }
  }, { repeat: [1, 1] }),
  strata: () => canvasTex('strata', 512, 128, (x, w, h) => {
    const r = seeded(17);
    const layers = [['#3d3a36', 0.12], ['#6e6a63', 0.18], ['#4a3424', 0.3], ['#7a4b2e', 0.4]];
    let y = 0;
    for (const [c, f] of layers) {
      x.fillStyle = c; x.beginPath(); x.moveTo(0, y);
      for (let i = 0; i <= 32; i++) x.lineTo(i * w / 32, y + h * f + Math.sin(i * 1.7) * 3 + r() * 3);
      x.lineTo(w, h); x.lineTo(0, h); x.fill(); y += h * f;
    }
    noise(x, w, h, 5000, 0.2, r);
  }, { repeat: [1, 1] }),
  shoji: () => canvasTex('shoji', 128, 128, (x, w, h) => {
    x.fillStyle = '#fff3d6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#4a3020';
    for (let i = 0; i <= 4; i++) { x.fillRect(i * 31, 0, 4, h); x.fillRect(0, i * 31, w, 4); }
  }),
  window: () => canvasTex('window', 128, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffd89a'); g.addColorStop(1, '#f6a95b');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(120,60,40,.55)'; x.fillRect(0, 0, 34, h); x.fillRect(w - 26, 0, 26, h);
    x.fillStyle = '#2b2622'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8); x.fillRect(0, 0, 8, h); x.fillRect(w - 8, 0, 8, h); x.fillRect(w / 2 - 3, 0, 6, h);
  }),
  glow: () => canvasTex('glow', 128, 128, (x, w, h) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }),
  streak: () => canvasTex('streak', 64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.15, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const m = x.createLinearGradient(0, 0, w, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = m; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 9) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y, w, 3); } // reflet brisé par l'eau
  }),
  sign: (text, bg, fg, vertical = false, border = fg) => canvasTex(`sign${text}${bg}${fg}${vertical}`, vertical ? 128 : 512, vertical ? 512 : 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = border; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (vertical) {
      const chars = [...text], size = Math.min(100, 440 / chars.length);
      x.font = `800 ${size}px ${KANJI}`;
      chars.forEach((c, i) => x.fillText(c, w / 2, h / 2 + (i - (chars.length - 1) / 2) * size * 1.02));
    } else {
      x.font = `800 ${Math.min(90, 900 / [...text].length)}px ${KANJI}`;
      x.fillText(text, w / 2, h / 2 + 4);
    }
  }),
  noren: (text, color) => canvasTex(`noren${text}${color}`, 256, 128, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    const chars = [...text];
    x.fillStyle = '#f7efe0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 64px ${KANJI}`;
    chars.forEach((c, i) => x.fillText(c, (w / chars.length) * (i + 0.5), h / 2));
    x.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < 3; i++) x.fillRect((w / 3) * i - 2, 30, 4, h);
  }),
  lantern: (color, char) => canvasTex(`lantern${color}${char}`, 128, 128, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 6; y < h; y += 12) x.fillRect(0, y, w, 3);
    x.fillStyle = '#1b1210'; x.fillRect(0, 0, w, 12); x.fillRect(0, h - 12, w, 12);
    if (char) { x.fillStyle = '#1b1210'; x.font = `800 58px ${KANJI}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(char, 32, h / 2); x.fillText(char, 96, h / 2); }
  }),
  stripes: (a, b) => canvasTex(`stripes${a}${b}`, 128, 64, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 16, 0, 16, h); }
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, h - 10, w, 10);
  }),
  books: () => canvasTex('books', 128, 128, (x, w, h) => {
    const r = seeded(21);
    x.fillStyle = '#3a2618'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let px = 2; px < w - 4;) {
      const bw = 4 + r() * 6;
      x.fillStyle = `hsl(${r() * 360}, ${35 + r() * 30}%, ${30 + r() * 35}%)`;
      x.fillRect(px, row * 32 + 4 + r() * 6, bw - 1, 26); px += bw;
    }
  }),
  goods: () => canvasTex('goods', 128, 128, (x, w, h) => {
    const r = seeded(23);
    x.fillStyle = '#e8e8ea'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) { x.fillStyle = '#9aa0a8'; x.fillRect(0, row * 32 + 28, w, 4); for (let px = 2; px < w - 6; px += 9) { x.fillStyle = `hsl(${r() * 360}, 70%, ${45 + r() * 20}%)`; x.fillRect(px, row * 32 + 8 + r() * 6, 7, 20); } }
  }),
  vending: () => canvasTex('vending', 64, 128, (x, w, h) => {
    const r = seeded(29);
    x.fillStyle = '#f2f4f8'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 5; i++) { x.fillStyle = `hsl(${r() * 360}, 75%, 55%)`; x.fillRect(4 + i * 12, 8 + row * 20, 8, 14); }
    x.fillStyle = '#1b2a44'; x.fillRect(4, 92, w - 8, 30);
  }),
  screen: () => canvasTex('screen', 64, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5ef'); g.addColorStop(0.5, '#a5f'); g.addColorStop(1, '#f5a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(8, 40, 48, 4); x.fillRect(14, 48, 36, 4);
  }),
  ripple: () => canvasTex('ripple', 64, 64, (x, w, h) => {
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.stroke();
  }),
  flake: () => canvasTex('flake', 32, 32, (x, w, h) => {
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }),
};

// ---------- Matériaux partagés ----------
// glow : { day, night, sched } -> intensité émissive pilotée par l'heure (voir world.js)
export const MATS = new Map();
export function mat(key, make) {
  if (!MATS.has(key)) { const m = make(); m.userData.key = key; MATS.set(key, m); }
  return MATS.get(key);
}
export const std = (color, o = {}) => mat(`std${color}${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
export const textured = (key, map, o = {}) => mat(key, () => new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...o }));
export function glowMat(key, color, map, day = 0.15, night = 2, sched = 0, o = {}) {
  return mat(key, () => {
    const m = new THREE.MeshStandardMaterial({ color: map ? '#fff' : color, map, emissive: color, emissiveMap: map, emissiveIntensity: day, roughness: 0.6, ...o });
    m.userData.glow = { day, night, sched };
    return m;
  });
}
export const foliage = kind => mat('leaf' + kind, () => { const m = new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.9, flatShading: true }); m.userData.leaf = kind; return m; });
export const SEASON_LEAVES = {
  printemps: { cherry: '#f4b6c8', green: '#7fae4f' },
  ete: { cherry: '#4f8a3a', green: '#3f7a35' },
  automne: { cherry: '#d9622b', green: '#d9962f' },
  hiver: { cherry: '#e9eef5', green: '#dfe7ee' },
};

// ---------- Petits outils de construction ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
};
export function box(parent, w, h, d, material, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(G.box, material);
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.rotation.y = ry;
  parent.add(m);
  return m;
}
export function shape(parent, geo, material, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.scale.set(sx, sy ?? sx, sz ?? sx);
  parent.add(m);
  return m;
}
export const cyl = (p, r, h, m, x, y, z, seg) => shape(p, seg === 6 ? G.cyl6 : G.cyl, m, x, y + h / 2, z, r * 2, h, r * 2);
export const ball = (p, r, m, x, y, z, sy = 1) => shape(p, G.sphere, m, x, y, z, r * 2, r * 2 * sy, r * 2);
export const sub = (parent, x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };
function plane(parent, w, h, material, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(G.plane, material);
  m.scale.set(w, h, 1); m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
  parent.add(m);
  return m;
}

// Fusionne tout ce qui est statique par matériau : quelques appels de dessin par bâtiment au lieu de centaines.
export function bake(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), byMat = new Map(), keep = [];
  group.traverse(o => {
    if (!o.isMesh || o.userData.dynamic) return;
    if (o.material.transparent && !o.material.userData.glow) { keep.push(o); return; }
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [m, list] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.castShadow = !m.userData.noShadow; mesh.receiveShadow = true;
    out.add(mesh);
    list.forEach(g => g.dispose());
  }
  const dynamic = [];
  group.traverse(o => { if (o.userData.dynamic && o !== group) dynamic.push(o); });
  for (const o of [...keep, ...dynamic]) { const p = o.parent; o.applyMatrix4(p.matrixWorld.clone().premultiply(inv)); out.add(o); }
  return out;
}

// Taches de lumière au sol et reflets sur sol mouillé (faux, mais très bon marché).
export function lightPool(parent, x, z, r, color, k = 1) {
  const m = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TEX.glow(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.scale.set(r * 2, r * 2, 1);
  m.userData = { dynamic: true, pool: k };
  m.renderOrder = 2;
  parent.add(m);
  return m;
}
export function streak(parent, x, z, w, color, k = 1) {
  const m = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TEX.streak(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z); m.scale.set(w, 2.6, 1);
  m.userData = { dynamic: true, streak: k };
  m.renderOrder = 2;
  parent.add(m);
  return m;
}

// ---------- Éléments de façade ----------
const WOOD = () => textured('wood', TEX.wood('#5e3f2a'));
const DARKWOOD = () => textured('darkwood', TEX.wood('#3a281d'));
const PALEWOOD = () => textured('palewood', TEX.wood('#a37a52'));
const roofMat = c => { const m = textured('roof' + c, TEX.roof(c), { roughness: 0.55, metalness: 0.15 }); m.userData.roof = true; return m; };

// Toit japonais à deux pans, avec faîtage et pignons.
export function gableRoof(p, w, d, y, color, pitch = 0.5) {
  const m = roofMat(color), oh = 0.32, half = d / 2 + oh, len = half / Math.cos(pitch), rise = Math.tan(pitch) * (d / 2);
  for (const s of [-1, 1]) {
    const slab = box(p, w + oh * 2, 0.08, len, m, 0, 0, 0);
    slab.position.set(0, y + rise / 2 + 0.04 - Math.tan(pitch) * oh / 2, s * half / 2);
    slab.rotation.x = s * pitch;
    const eave = box(p, w + oh * 2 + 0.06, 0.1, 0.1, std('#1c1d22'), 0, 0, 0);
    eave.position.set(0, y - Math.tan(pitch) * oh + 0.02, s * half);
  }
  box(p, w + oh * 2 + 0.1, 0.14, 0.2, std('#1c1d22'), 0, y + rise - 0.02, 0);
  for (const s of [-1, 1]) box(p, 0.16, 0.28, 0.12, std('#1c1d22'), s * (w / 2 + oh + 0.05), y + rise - 0.06, 0); // onigawara
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const g = new THREE.Mesh(geo, DARKWOOD());
    g.rotation.y = Math.PI / 2; g.position.set(s * (w / 2) - 0.04, y, 0);
    p.add(g);
  }
  return rise;
}
// Auvent de tuiles au-dessus de l'entrée (hisashi)
function hisashi(p, w, y, z, color) {
  const s = box(p, w, 0.06, 0.7, roofMat(color), 0, 0, 0);
  s.position.set(0, y + 0.12, z + 0.3); s.rotation.x = 0.38;
  box(p, w + 0.04, 0.07, 0.07, std('#1c1d22'), 0, y - 0.03, z + 0.62);
}
function awning(p, w, y, z, a, b) {
  const s = box(p, w, 0.03, 0.8, textured(`awn${a}${b}`, TEX.stripes(a, b)), 0, 0, 0);
  s.position.set(0, y, z + 0.36); s.rotation.x = 0.45;
}
function flatRoof(p, w, d, y, color = '#8a8d92') {
  box(p, w + 0.1, 0.12, d + 0.1, std(color), 0, y, 0);
  for (const s of [-1, 1]) { box(p, w + 0.1, 0.18, 0.08, std(color), 0, y + 0.12, s * (d / 2)); box(p, 0.08, 0.18, d, std(color), s * (w / 2), y + 0.12, 0); }
}
export function lantern(p, x, y, z, color = '#d8342c', char = '', s = 1, glows) {
  const m = glowMat(`lan${color}${char}`, color, TEX.lantern(color, char), 0.25, 2.4, 1);
  const l = shape(p, G.cyl, m, x, y, z, 0.2 * s, 0.3 * s, 0.2 * s);
  ball(p, 0.11 * s, m, x, y + 0.13 * s, z, 0.4); ball(p, 0.11 * s, m, x, y - 0.13 * s, z, 0.4);
  box(p, 0.01, 0.14 * s, 0.01, std('#111'), x, y + 0.15 * s, z);
  if (glows) glows.push({ x, y, z, color });
  return l;
}
function sign(p, text, bg, fg, w, h, x, y, z, vertical = false, night = 1.6) {
  const map = TEX.sign(text, bg, fg, vertical);
  const m = glowMat(`sign${text}${bg}${fg}${vertical}`, '#ffffff', map, 0.3, night * 0.55, 1);
  box(p, w + 0.06, h + 0.06, 0.06, DARKWOOD(), x, y - 0.03, z - 0.02);
  plane(p, w, h, m, x, y + h / 2, z + 0.015);
}
function noren(p, text, color, w, y, z) {
  const m = mat(`noren${text}${color}`, () => new THREE.MeshStandardMaterial({ map: TEX.noren(text, color), roughness: 0.95, side: THREE.DoubleSide }));
  plane(p, w, 0.42, m, 0, y - 0.21, z);
}
function windowRow(p, w, y, z, n, schedKey = 'A', shoji = false) {
  const m = glowMat(`win${shoji}${schedKey}`, '#ffffff', shoji ? TEX.shoji() : TEX.window(), 0.02, 0.75, schedKey);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    plane(p, (w / n) * 0.68, 0.62, m, x, y, z);
    box(p, (w / n) * 0.74, 0.04, 0.08, DARKWOOD(), x, y - 0.35, z);
  }
}
function plant(p, x, z, s = 1, kind = 'green') {
  cyl(p, 0.12 * s, 0.18 * s, std('#6b5b4f'), x, 0, z);
  shape(p, G.ico, foliage(kind), x, 0.3 * s, z, 0.32 * s);
}
function stool(p, x, z) {
  cyl(p, 0.09, 0.2, DARKWOOD(), x, 0, z);
  cyl(p, 0.12, 0.03, std('#7a2a22'), x, 0.2, z);
}
function table(p, x, z, r = 0.22) {
  cyl(p, 0.03, 0.3, std('#222'), x, 0, z);
  cyl(p, r, 0.04, PALEWOOD(), x, 0.3, z);
}
function chair(p, x, z, ry) {
  box(p, 0.2, 0.04, 0.2, PALEWOOD(), x, 0.18, z, ry);
  const b = box(p, 0.2, 0.25, 0.03, PALEWOOD(), x, 0.2, z, ry);
  b.position.x -= Math.sin(ry) * 0.1; b.position.z -= Math.cos(ry) * 0.1;
  for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) box(p, 0.025, 0.18, 0.025, std('#333'), x + dx, 0, z + dz);
}
function bowl(p, x, y, z) { ball(p, 0.06, std('#f1ece2', { roughness: 0.3 }), x, y + 0.03, z, 0.5); }
function acUnit(p, x, y, z, ry = 0) {
  const g = box(p, 0.42, 0.3, 0.2, std('#d6d8d5', { roughness: 0.5 }), x, y, z, ry);
  const f = cyl(p, 0.1, 0.02, std('#555'), x + Math.sin(ry) * 0.11, y + 0.15, z + Math.cos(ry) * 0.11);
  f.rotation.x = Math.PI / 2; f.rotation.z = ry;
  return g;
}

// ---------- Les bâtiments ----------
// Chaque type : style d'intérieur, palette, enseigne. 'tall' : il prend un étage de plus au niveau 10.
export const LOOK = {
  ramen:    { style: 'counter', wall: '#6a4630', roof: '#2d3440', sign: '麺処 龍', noren: '拉麺', norenC: '#7a1f1f', lantern: '#e0472f', lchar: '麺', bg: '#f6e3b4', fg: '#2a160c' },
  street:   { style: 'stall',   wall: '#7a5434', roof: '#3a3030', sign: 'たこ焼き', lantern: '#e6542e', lchar: '焼', bg: '#e64a2e', fg: '#fff4d6', awn: ['#e64a2e', '#fff4d6'] },
  cafe:     { style: 'tables',  wall: '#efe6d6', roof: '#4a3b34', sign: '珈琲', bg: '#2f4a3a', fg: '#f5ead2', awn: ['#2f6b4f', '#f5ead2'], lantern: '#f5d79a' },
  konbini:  { style: 'shelves', wall: '#e9edf0', roof: 'flat', sign: 'コンビニ', bg: '#ffffff', fg: '#1a62c9', band: '#2fb36a', glass: true, goods: 'goods' },
  fleurs:   { style: 'shelves', wall: '#d9e3d0', roof: '#3d4a3c', sign: '花屋', bg: '#fff7e8', fg: '#2f6b3f', awn: ['#5c8f4a', '#fff7e8'], flowers: true, lantern: '#ffd9a0' },
  pain:     { style: 'tables',  wall: '#f2dcc0', roof: '#5a3a2a', sign: 'パン屋', bg: '#7a3e1d', fg: '#ffe9c4', awn: ['#c87a3a', '#fff1d8'], bread: true, lantern: '#ffcf7a' },
  livres:   { style: 'shelves', wall: '#5a4030', roof: '#2e2a2a', sign: '本屋', bg: '#203a2a', fg: '#efe2c0', goods: 'books', lantern: '#ffe0a0' },
  sushi:    { style: 'counter', wall: '#d8c3a0', roof: '#24303c', sign: '寿司', noren: '寿司', norenC: '#1f3550', lantern: '#f1efe6', lchar: '寿', bg: '#f4efe4', fg: '#16233a' },
  bar:      { style: 'counter', wall: '#4a3024', roof: '#262a30', sign: '居酒屋', noren: '酒処', norenC: '#3a1a14', lantern: '#e33b2b', lchar: '酒', bg: '#d8342c', fg: '#fff1d6', bigLanterns: true },
  karaoke:  { style: 'fun',     wall: '#2a2238', roof: 'flat', sign: 'カラオケ', bg: '#1a0f2a', fg: '#ff4fa3', neon: '#ff4fa3', tall: true },
  mode:     { style: 'shelves', wall: '#efeae4', roof: 'flat', sign: '洋服', bg: '#111', fg: '#f0e6d8', glass: true, clothes: true },
  arcade:   { style: 'fun',     wall: '#1d2030', roof: 'flat', sign: 'ゲーム', bg: '#101030', fg: '#3ff0ff', neon: '#3ff0ff', arcade: true, tall: true },
  ryotei:   { style: 'tables',  wall: '#3a2a20', roof: '#22262c', sign: '料亭', noren: '料亭', norenC: '#4a2a5a', lantern: '#f6efe0', lchar: '料', bg: '#2a1a12', fg: '#f3e2b8', shoji: true },
  appart:   { style: 'home', home: 'appart', wall: '#c9b79c', roof: '#5b3a2e', plate: 'さくら荘' },
  maison:   { style: 'home', home: 'maison', wall: '#4a3324', roof: '#2a2e36', lantern: '#f2e6c9' },
  immeuble: { style: 'home', home: 'immeuble', wall: '#b9b2a8', roof: 'flat', plate: 'マンション' },
  hotel:    { style: 'home', home: 'hotel', wall: '#4d3426', roof: '#272b33', sign: '旅館', noren: '旅館', norenC: '#2f4a6a', lantern: '#f6efe0', lchar: '宿', bg: '#f3ead8', fg: '#2a1a12' },
};

// Construit le modèle d'un bâtiment. Retourne aussi les places assises, le personnel, la porte, la vapeur…
export function buildBuilding(type, level, depth = 4.2) {
  const L = LOOK[type], g = new THREE.Group(), rng = seeded(type.length * 977 + level * 31);
  const info = { seats: [], staff: [], steam: [], glows: [], light: null, screens: [] };
  const W = 4, back = -depth / 2, front = back + 3, D = 3, cz = back + D / 2;
  info.door = { x: 0, z: depth / 2 };
  info.front = front;
  const floors = L.style === 'home' ? 0 : 1 + (level >= 5) + (level >= 10 && L.tall ? 1 : 0);
  const wallMat = parseInt(L.wall.slice(1, 3), 16) > 0xa0 ? std(L.wall, { roughness: 0.92 }) : textured('wood' + L.wall, TEX.wood(L.wall)); // clair : enduit, sombre : bois

  // Sol de la parcelle : pavés devant, plancher dedans
  box(g, W + 0.3, 0.04, depth, textured('slabfloor', TEX.slab()), 0, 0, 0);
  if (L.style === 'home') buildHome(g, L, level, depth, info, rng);
  else {
    box(g, W, 0.06, D, PALEWOOD(), 0, 0.04, cz);
    const frieze = floors === 1 && L.roof !== 'flat', H = FLOOR * floors + (frieze ? 0.45 : 0);
    box(g, W, H, 0.1, wallMat, 0, 0, back + 0.05);
    for (const s of [-1, 1]) box(g, 0.1, H, D, wallMat, s * (W / 2 - 0.05), 0, cz);
    if (frieze) box(g, W, 0.45, 0.1, wallMat, 0, FLOOR, front - 0.05);
    // Façade : poteaux et linteau ; au rez-de-chaussée, ouverte ou vitrée
    for (const s of [-1, 1]) box(g, 0.14, H, 0.14, DARKWOOD(), s * (W / 2 - 0.07), 0, front - 0.07);
    box(g, W, 0.22, 0.12, DARKWOOD(), 0, FLOOR - 0.22, front - 0.06);
    if (L.glass) {
      const gl = mat('glass', () => new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }));
      plane(g, W - 0.3, FLOOR - 0.3, gl, 0, (FLOOR - 0.3) / 2 + 0.05, front - 0.04);
      box(g, 0.05, FLOOR - 0.25, 0.05, std('#c8ccd0', { metalness: 0.6, roughness: 0.3 }), -0.5, 0, front - 0.04);
      box(g, 0.05, FLOOR - 0.25, 0.05, std('#c8ccd0', { metalness: 0.6, roughness: 0.3 }), 0.5, 0, front - 0.04);
    }
    // Étages
    for (let f = 1; f < floors; f++) {
      box(g, W, 0.1, D, DARKWOOD(), 0, FLOOR * f - 0.05, cz);
      box(g, W, FLOOR, 0.1, wallMat, 0, FLOOR * f, front - 0.05);
      windowRow(g, W - 0.6, FLOOR * f + 0.95, front + 0.01, 3, f % 2 ? 'A' : 'B', !!L.shoji || L.roof !== 'flat');
      acUnit(g, W / 2 + 0.11, FLOOR * f + 0.2, cz + 0.6, Math.PI / 2);
    }
    // Fenêtres latérales et arrière (vues quand on tourne autour)
    for (const s of [-1, 1]) windowRow(sub(g, s * (W / 2 + 0.01), 0, cz, s * Math.PI / 2), 1.2, FLOOR * (floors > 1 ? 1.55 : 0.6), 0, 1, 'C', false);
    windowRow(sub(g, 0, 0, back - 0.01, Math.PI), W - 1, FLOOR * (floors > 1 ? 1.55 : 0.6), 0, 2, 'B', false);
    cyl(g, 0.04, H, std('#6d6f72', { metalness: 0.5, roughness: 0.4 }), -W / 2 + 0.25, 0, back - 0.06);
    // Toit
    if (L.roof === 'flat') {
      flatRoof(g, W, D, H, '#7d8086');
      box(g, 0.6, 0.35, 0.5, std('#a9acb0'), 1.1, H + 0.12, cz - 0.6); // machines sur le toit
      cyl(g, 0.25, 0.5, std('#c6c1b8'), -1.2, H + 0.12, cz - 0.5);
    } else gableRoof(sub(g, 0, 0, cz), W, D, H, L.roof, L.style === 'stall' ? 0.42 : 0.5);
    if (L.roof !== 'flat' && floors > 1) hisashi(g, W + 0.2, FLOOR, front, L.roof);
    if (L.awn) awning(g, W - 0.2, FLOOR - 0.18, front, ...L.awn);
    if (L.band) box(g, W + 0.02, 0.12, 0.13, std(L.band), 0, FLOOR - 0.36, front - 0.04);

    // Enseigne (au-dessus de l'entrée, ou sur l'auvent)
    if (L.roof === 'flat') sign(g, L.sign, L.bg, L.fg, 2.2, 0.42, 0, FLOOR + 0.05, front + 0.02);
    else if (floors > 1) sign(g, L.sign, L.bg, L.fg, 2, 0.36, 0, FLOOR + 0.24, front + 0.06);
    else { // grande enseigne posée sur le toit, lisible d'en haut
      for (const s of [-1, 1]) box(g, 0.05, 0.3, 0.05, DARKWOOD(), s * 0.9, H - 0.1, front + 0.1);
      sign(g, L.sign, L.bg, L.fg, 2.3, 0.5, 0, H + 0.12, front + 0.14);
    }
    if (L.noren && level >= 3) noren(g, L.noren, L.norenC, 1.6, FLOOR - 0.22, front + 0.02);
    if (L.neon) {
      const nm = glowMat('neon' + L.neon, L.neon, null, 0.6, 3.2, 0);
      box(g, W + 0.04, 0.04, 0.04, nm, 0, FLOOR - 0.04, front + 0.01);
      for (const s of [-1, 1]) box(g, 0.04, H, 0.04, nm, s * (W / 2 + 0.01), 0, front + 0.01);
      info.glows.push({ x: 0, y: FLOOR, z: front + 0.2, color: L.neon, strong: true });
    }

    // Lanternes : plus nombreuses avec le niveau
    if (L.lantern) {
      const n = level >= 8 ? 3 : level >= 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? W / 2 - 0.35 : -W / 2 + 0.35 + (i * (W - 0.7)) / (n - 1);
        lantern(g, x, FLOOR - 0.45, front + 0.25, L.lantern, L.lchar, L.bigLanterns ? 1.5 : 1, info.glows);
      }
    }
    // Lumière intérieure
    glowMat('ceil', '#ffd9a0', null, 0.4, 2.2, 0);
    box(g, 0.8, 0.03, 0.25, MATS.get('ceil'), 0, FLOOR - 0.06, cz);
    info.light = { x: 0, y: FLOOR - 0.35, z: cz + 0.4, color: L.neon || '#ffb56b' };
    info.glows.push({ x: 0, y: 0.6, z: front + 0.3, color: '#ffb56b', pool: true });
    interior(g, L, level, { W, D, back, front, cz, depth }, info, rng);

    // Devant : plantes, menu, terrasse
    if (level >= 3) { plant(g, -W / 2 + 0.25, front + 0.3, 1); plant(g, W / 2 - 0.25, front + 0.3, 0.9); }
    if (level >= 4 && L.style !== 'stall') { box(g, 0.32, 0.45, 0.05, std('#2a2420'), W / 2 - 0.55, 0, front + 0.45, -0.3); plane(g, 0.26, 0.3, textured('menuboard', TEX.sign('お品書き', '#1c2a22', '#f0ead8', true)), W / 2 - 0.54, 0.27, front + 0.48, -0.25, -0.3); }
    if (level >= 7 && L.style !== 'stall') {
      for (const s of [-1, 1]) {
        const tx = s * 1.25, tz = Math.min(depth / 2 - 0.45, front + 0.85);
        table(g, tx, tz); chair(g, tx - 0.36, tz, Math.PI / 2); chair(g, tx + 0.36, tz, -Math.PI / 2);
        cyl(g, 0.02, 1, std('#ddd'), tx, 0.3, tz);
        const um = shape(g, G.cone, std(s < 0 ? '#c8402e' : '#efe6d2', { side: THREE.DoubleSide }), tx, 1.38, tz, 0.9, 0.22, 0.9);
        um.userData.noShadow = false;
        info.seats.push({ x: tx - 0.36, z: tz, ry: Math.PI / 2, sit: 0.18 }, { x: tx + 0.36, z: tz, ry: -Math.PI / 2, sit: 0.18 });
      }
    }
    // Niveau 10 : grande enseigne verticale lumineuse
    if (level >= 10) {
      const top = H + 0.4;
      box(g, 0.08, 0.5, 0.08, std('#333'), W / 2 + 0.05, FLOOR + 0.2, front - 0.1);
      sign(sub(g, W / 2 + 0.36, 0, front - 0.3, Math.PI / 2), L.sign.replace(' ', ''), L.bg, L.fg, 0.55, Math.min(top - 0.6, 2.4), 0, FLOOR + 0.05, 0, true, 3);
      info.glows.push({ x: W / 2 + 0.4, y: FLOOR + 1, z: front - 0.1, color: L.fg === '#fff4d6' ? L.bg : L.fg, strong: true });
    }
  }
  return { group: g, info };
}

function interior(g, L, level, { W, back, front, cz }, info, rng) {
  if (L.style === 'counter') {
    // Comptoir sur la rue (façon yatai) : clients assis dehors, cuisinier juste derrière, bien visibles
    const cZ = front - 0.25;
    box(g, W - 1, 0.36, 0.3, PALEWOOD(), 0, 0, cZ);
    box(g, W - 0.9, 0.04, 0.4, DARKWOOD(), 0, 0.36, cZ);
    box(g, W - 0.6, 0.34, 0.4, std('#8f9396', { metalness: 0.6, roughness: 0.35 }), 0, 0, back + 0.35); // plan de travail
    box(g, W - 0.6, 0.06, 0.25, DARKWOOD(), 0, 0.85, back + 0.2); // étagère
    for (let i = 0; i < 7; i++) bowl(g, -1.5 + i * 0.3 + rng() * 0.1, 0.91, back + 0.2);
    for (let i = 0; i < 6; i++) box(g, 0.14, 0.32, 0.01, std('#efe2c4'), -1.3 + i * 0.22, 1.05, back + 0.11); // menus en bois au mur
    for (let i = 0; i < 2 + (level >= 5); i++) { // marmites fumantes
      const x = -1 + i * 1;
      cyl(g, 0.2, 0.26, std('#b7bcc0', { metalness: 0.8, roughness: 0.3 }), x, 0.34, back + 0.38);
      info.steam.push({ x, y: 0.62, z: back + 0.38 });
    }
    cyl(g, 0.16, 0.2, std('#b7bcc0', { metalness: 0.8, roughness: 0.3 }), -1.2, 0.4, cZ - 0.02);
    info.steam.push({ x: -1.2, y: 0.62, z: cZ });
    if (L === LOOK.sushi) box(g, W - 1.2, 0.12, 0.22, glowMat('fishcase', '#cfefff', null, 0.3, 0.8, 0), 0, 0.4, cZ);
    if (L === LOOK.bar) for (let i = 0; i < 6; i++) cyl(g, 0.05, 0.18, std(['#4a7a3a', '#7a3a2a', '#2a4a7a'][i % 3], { roughness: 0.2 }), -1.4 + i * 0.25, 0.91, back + 0.18);
    const n = Math.min(6, 2 + level);
    for (let i = 0; i < n; i++) {
      const x = -1.3 + (i * 2.6) / 5;
      stool(g, x, cZ + 0.48);
      info.seats.push({ x, z: cZ + 0.48, ry: Math.PI, sit: 0.23, eat: true });
      bowl(g, x, 0.4, cZ + 0.05);
    }
    const cooks = 1 + (level >= 4) + (level >= 8);
    for (let i = 0; i < cooks; i++) info.staff.push({ path: [[-1.1 + i * 0.8, cZ - 0.45], [-0.3 + i * 0.8, cZ - 0.45], [-0.7 + i * 0.8, back + 0.75]], cook: true, uniform: '#f4f1ea' });
    if (level >= 5) info.staff.push({ path: [[W / 2 - 0.3, back + 0.8], [W / 2 - 0.3, cZ + 0.75], [-1.2, cZ + 0.75], [W / 2 - 0.3, cZ + 0.75]], uniform: '#2a2a2a' });
  } else if (L.style === 'tables') {
    box(g, W - 0.8, 0.38, 0.32, PALEWOOD(), 0, 0, back + 0.5);
    if (L.bread) { box(g, W - 1, 0.18, 0.3, glowMat('breadcase', '#fff1d0', null, 0.3, 0.9, 0), 0, 0.38, back + 0.5); for (let i = 0; i < 10; i++) ball(g, 0.06, std('#c8853e'), -1.3 + i * 0.29, 0.6, back + 0.5, 0.6); }
    else for (let i = 0; i < 3; i++) cyl(g, 0.07, 0.16, std('#333', { metalness: 0.6 }), -0.8 + i * 0.5, 0.38, back + 0.5);
    box(g, W - 0.6, 0.06, 0.22, DARKWOOD(), 0, 0.95, back + 0.16);
    const spots = [[-1.1, front - 0.75], [0.9, front - 0.75], [-1.1, front - 1.65], [0.9, front - 1.65]];
    const n = Math.min(4, 1 + Math.ceil(level / 3));
    for (let i = 0; i < n; i++) {
      const [x, z] = spots[i];
      if (L.shoji) { box(g, 0.6, 0.12, 0.45, DARKWOOD(), x, 0.06, z); for (const s of [-1, 1]) { box(g, 0.24, 0.03, 0.24, std('#7a2f3a'), x + s * 0.45, 0.06, z); info.seats.push({ x: x + s * 0.45, z, ry: -s * Math.PI / 2, sit: 0.08, eat: true }); } }
      else { table(g, x, z); for (const s of [-1, 1]) { chair(g, x + s * 0.36, z, -s * Math.PI / 2); info.seats.push({ x: x + s * 0.36, z, ry: -s * Math.PI / 2, sit: 0.2, eat: true }); } }
    }
    if (L.shoji) for (const s of [-1, 1]) { const m = glowMat('shojiwall', '#ffffff', TEX.shoji(), 0.15, 1, 0); plane(g, 2.6, 1.1, m, s * (W / 2 - 0.11), 0.65, cz, 0, -s * Math.PI / 2); }
    info.staff.push({ path: [[-0.6, back + 0.9], [0.6, back + 0.9]], uniform: L.shoji ? '#6a3a7a' : '#efe6d6' });
    if (level >= 5) info.staff.push({ path: [[1.6, back + 1.0], [1.6, front - 1.2], [-0.2, front - 1.2], [1.6, front - 1.2]], uniform: '#2a2a2a' });
  } else if (L.style === 'shelves') {
    const goods = L.goods === 'books' ? textured('booksT', TEX.books()) : textured('goodsT', TEX.goods());
    if (L.flowers) {
      const cols = ['#e84a6f', '#f2c14e', '#f7f2ec', '#b14ae8', '#ff8a3d', '#e83a3a'];
      for (let i = 0; i < 4 + level; i++) { const x = -1.6 + (i % 7) * 0.52, z = i < 7 ? front + 0.3 : back + 0.5; cyl(g, 0.12, 0.16, std('#4b5a63', { metalness: 0.5 }), x, 0, z); for (let k = 0; k < 5; k++) ball(g, 0.05, std(cols[(i + k) % cols.length]), x + rng() * 0.16 - 0.08, 0.2 + rng() * 0.12, z + rng() * 0.16 - 0.08); }
      box(g, W - 0.6, 0.9, 0.3, PALEWOOD(), 0, 0, back + 0.2);
    } else if (L.clothes) {
      for (const z of [cz - 0.4, cz + 0.4]) { box(g, 2.4, 0.03, 0.03, std('#bbb', { metalness: 0.7 }), 0, 0.8, z); for (let i = 0; i < 9; i++) box(g, 0.18, 0.4, 0.06, std(['#c8b49a', '#2a3a5a', '#a33', '#eee', '#556b4a'][i % 5]), -1.05 + i * 0.26, 0.38, z); }
    } else {
      for (const s of [-1, 1]) box(g, 0.3, 1.15, D_(back, front), goods, s * (W / 2 - 0.25), 0, (back + front) / 2 - 0.2);
      box(g, 0.5, 0.9, 1.5, goods, 0, 0, cz - 0.2);
    }
    box(g, 0.9, 0.4, 0.35, std('#d8d3c8'), -1.2, 0, front - 0.5); // caisse
    if (L.glass) box(g, 0.25, 0.05, 0.2, glowMat('register', '#7cf', null, 0.4, 1, 0), -1.2, 0.4, front - 0.5);
    const spots = [[1.35, cz - 0.4, -Math.PI / 2], [1.35, cz + 0.5, -Math.PI / 2], [-0.5, cz + 0.6, Math.PI], [0.45, cz - 1, Math.PI / 2], [-0.5, cz - 1.1, 0], [0.5, cz + 0.6, Math.PI]];
    for (let i = 0; i < Math.min(6, 2 + Math.floor(level / 2)); i++) info.seats.push({ x: spots[i][0], z: spots[i][1], ry: spots[i][2], sit: 0 });
    info.staff.push({ path: [[-1.2, front - 0.9]], uniform: L.glass ? '#3a7ad8' : '#5a6a4a' });
    if (level >= 5) info.staff.push({ path: [[-1.4, back + 0.6], [-1.4, front - 1.4], [1.0, back + 0.5]], uniform: L.glass ? '#3a7ad8' : '#5a6a4a' });
  } else if (L.style === 'stall') {
    box(g, W - 0.6, 0.42, 0.35, PALEWOOD(), 0, 0, front - 0.3);
    box(g, W - 0.8, 0.05, 0.3, std('#222', { metalness: 0.7, roughness: 0.35 }), 0, 0.42, front - 0.3);
    for (let i = 0; i < 8; i++) ball(g, 0.035, std('#d08a3a'), -1 + i * 0.12, 0.49, front - 0.3);
    info.steam.push({ x: -0.6, y: 0.55, z: front - 0.3 }, { x: 0.5, y: 0.55, z: front - 0.3 });
    const n = Math.min(5, 2 + Math.floor(level / 2));
    for (let i = 0; i < n; i++) info.seats.push({ x: -1.4 + i * 0.7, z: front + 0.35, ry: Math.PI, sit: 0, eat: true });
    if (level >= 3) { box(g, 1.4, 0.2, 0.3, PALEWOOD(), 0, 0, front + 1.3); info.seats.push({ x: -0.4, z: front + 1.3, ry: 0, sit: 0.2, eat: true }, { x: 0.4, z: front + 1.3, ry: 0, sit: 0.2, eat: true }); }
    info.staff.push({ path: [[-0.8, front - 0.75], [0.8, front - 0.75]], cook: true, uniform: '#f4f1ea' });
    if (level >= 5) info.staff.push({ path: [[1.2, front - 0.75]], uniform: '#e64a2e' });
  } else if (L.style === 'fun') {
    if (L.arcade) {
      const n = Math.min(6, 2 + Math.floor(level / 2));
      for (let i = 0; i < n; i++) {
        const x = -1.5 + (i % 3) * 1.5, z = i < 3 ? back + 0.4 : cz + 0.35, ry = 0;
        box(g, 0.45, 0.9, 0.4, std(['#d8342c', '#2a6ad8', '#e8c13a'][i % 3], { roughness: 0.4 }), x, 0, z);
        const scr = plane(g, 0.34, 0.26, mat('arcScreen' + (i % 3), () => new THREE.MeshBasicMaterial({ map: TEX.screen(), color: '#fff' })), x, 0.66, z + 0.205, -0.25);
        scr.userData.dynamic = true; info.screens.push(scr);
        info.seats.push({ x, z: z + 0.45, ry: Math.PI, sit: 0, play: true });
      }
    } else {
      const scr = plane(g, 1.6, 0.8, mat('karaScreen', () => new THREE.MeshBasicMaterial({ map: TEX.screen(), color: '#fff' })), 0, 0.85, back + 0.12);
      scr.userData.dynamic = true; info.screens.push(scr);
      box(g, 3, 0.25, 0.4, std('#5a2a6a'), 0, 0, cz + 0.6); box(g, 3, 0.35, 0.1, std('#5a2a6a'), 0, 0.2, cz + 0.8);
      box(g, 1.4, 0.22, 0.5, std('#2a2a33'), 0, 0, cz - 0.1);
      const n = Math.min(6, 2 + Math.floor(level / 2));
      for (let i = 0; i < n; i++) info.seats.push({ x: -1.25 + i * 0.5, z: cz + 0.6, ry: Math.PI, sit: 0.25, sing: true });
    }
    info.staff.push({ path: [[1.5, front - 0.5]], uniform: '#222' });
  }
}
const D_ = (back, front) => front - back - 0.6;

// Logements : appartements à coursives, maison, immeuble, ryokan
function buildHome(g, L, level, depth, info, rng) {
  const W = 4, back = -depth / 2, D = 3.1, front = back + D, cz = back + D / 2;
  info.front = front;
  const floors = L.home === 'appart' ? 2 + (level >= 5) : L.home === 'immeuble' ? 3 + (level >= 4) + (level >= 7) + (level >= 10) : L.home === 'hotel' ? 2 + (level >= 6) : 1 + (level >= 5);
  const H = FLOOR * floors;
  const wallMat = L.home === 'immeuble' || L.home === 'appart' ? std(L.wall, { roughness: 0.92 }) : textured('wood' + L.wall, TEX.wood(L.wall));
  box(g, W, H, D, wallMat, 0, 0, cz);
  info.light = { x: 0, y: 1, z: front + 0.4, color: '#ffc27a' };
  for (let f = 0; f < floors; f++) {
    const sched = ['A', 'B', 'C'][(f + level) % 3], shoji = L.home === 'maison' || L.home === 'hotel';
    windowRow(g, W - 0.4, FLOOR * f + 0.8, front + 0.01, L.home === 'immeuble' ? 4 : 3, sched, shoji);
    windowRow(sub(g, W / 2 + 0.01, 0, cz, Math.PI / 2), D - 0.6, FLOOR * f + 0.8, 0, 2, sched, shoji);
    if (f > 0) {
      box(g, W + 0.1, 0.08, 0.1, DARKWOOD(), 0, FLOOR * f - 0.04, front + 0.05);
      if (L.home === 'appart' || L.home === 'immeuble') { // coursive ou balcons
        box(g, W, 0.06, 0.5, std('#8b8d90'), 0, FLOOR * f, front + 0.25);
        box(g, W, 0.3, 0.04, std(L.home === 'appart' ? '#d9d2c4' : '#9aa0a6'), 0, FLOOR * f + 0.06, front + 0.5);
        if (rng() < 0.7) for (let k = 0; k < 3; k++) box(g, 0.14, 0.2, 0.02, std(['#f2f2f2', '#9bc4e2', '#e8a3a3', '#f0d58a'][k]), -1 + k * 0.25 + rng(), FLOOR * f + 0.36, front + 0.46); // linge
        if (rng() < 0.6) plant(g, 1.6, front + 0.3, 0.6);
      }
    }
    if (L.home === 'immeuble' || f === floors - 1) acUnit(g, -W / 2 - 0.11, FLOOR * f + 0.3, cz, -Math.PI / 2);
  }
  // porte
  const door = L.home === 'maison' || L.home === 'hotel' ? glowMat('doorShoji', '#ffffff', TEX.shoji(), 0.1, 1.2, 0) : std('#3a2a20');
  plane(g, 0.7, 0.95, door, -1.2, 0.5, front + 0.02);
  info.door = { x: -1.2, z: depth / 2 };
  info.doorIn = { x: -1.2, z: front + 0.1 };
  if (L.home === 'appart') { // escalier extérieur
    for (let i = 0; i < 9; i++) box(g, 0.5, 0.06, 0.18, std('#6d7075', { metalness: 0.4 }), W / 2 + 0.3, i * 0.16, front - 0.2 - i * 0.17);
    box(g, 0.04, 1.6, 0.04, std('#6d7075'), W / 2 + 0.55, 0, front - 0.2);
    box(g, 0.8, 0.12, 0.05, std('#f2eee4'), 1.1, 0.95, front + 0.04);
    plane(g, 0.7, 0.18, textured('plate' + L.plate, TEX.sign(L.plate, '#f2eee4', '#2a2a2a')), 1.1, 1.01, front + 0.07);
  }
  if (L.home === 'immeuble') { cyl(g, 0.4, 0.7, std('#c8c2b6'), 1.1, H + 0.12, cz - 0.4); plane(g, 0.9, 0.22, textured('plate' + L.plate, TEX.sign(L.plate, '#2a2a2a', '#f2eee4')), 1, 1.2, front + 0.02); }
  if (L.home === 'maison' || L.home === 'hotel') {
    box(g, W + 0.3, 0.12, 0.6, PALEWOOD(), 0, 0.12, front + 0.3); // engawa
    if (L.sign) { sign(g, L.sign, L.bg, L.fg, 1.4, 0.36, 0.6, FLOOR + 0.3, front + 0.62); noren(sub(g, -1.2), L.noren, L.norenC, 0.9, FLOOR - 0.3, front + 0.05); }
    lantern(g, -1.85, FLOOR - 0.5, front + 0.6, L.lantern, L.lchar || '', 1, info.glows);
    if (level >= 3) lantern(g, -0.5, FLOOR - 0.5, front + 0.6, L.lantern, L.lchar || '', 1, info.glows);
  }
  if (L.flat || L.roof === 'flat') flatRoof(g, W, D, H, '#8a8d92');
  else { gableRoof(sub(g, 0, 0, cz), W, D, H, L.roof, 0.48); hisashi(g, W + 0.2, FLOOR, front, L.roof); }
  // jardin devant selon le niveau
  const yard = depth / 2 - front;
  if (yard > 0.6) {
    for (let i = 0; i < Math.min(4, Math.floor(level / 2) + 1); i++) plant(g, 0.2 + i * 0.5, front + yard / 2, 0.8 + rng() * 0.4, i % 2 ? 'green' : 'cherry');
    if (level >= 6) { const t = makeDecor('toro'); t.position.set(1.7, 0, front + yard / 2); g.add(t); }
    if (level >= 8) { const t = makeDecor('erable'); t.position.set(-1.7, 0, front + yard / 2 + 0.1); t.scale.setScalar(0.7); g.add(t); }
  }
  info.glows.push({ x: -1.2, y: 0.6, z: front + 0.3, color: '#ffc27a', pool: true });
}

// ---------- Décorations ----------
export function makeDecor(id) {
  const g = new THREE.Group(), glows = [];
  switch (id) {
    case 'plante': plant(g, 0, 0, 1.2); break;
    case 'caisses': box(g, 0.32, 0.22, 0.26, PALEWOOD(), 0, 0, 0); box(g, 0.26, 0.2, 0.22, PALEWOOD(), 0.05, 0.22, 0, 0.3); for (let i = 0; i < 5; i++) ball(g, 0.04, std(['#e8562e', '#f2c14e', '#7ab648'][i % 3]), -0.1 + i * 0.05, 0.42, 0); break;
    case 'banc': box(g, 0.8, 0.05, 0.26, PALEWOOD(), 0, 0.22, 0); box(g, 0.8, 0.18, 0.04, PALEWOOD(), 0, 0.3, -0.12); for (const s of [-1, 1]) box(g, 0.05, 0.22, 0.24, std('#333'), s * 0.33, 0, 0); break;
    case 'velo': {
      const t = new THREE.TorusGeometry(0.13, 0.015, 6, 20);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(t, std('#222')); w.position.set(s * 0.22, 0.13, 0); g.add(w); }
      box(g, 0.44, 0.025, 0.025, std('#2a6ad8'), 0, 0.22, 0); box(g, 0.025, 0.2, 0.025, std('#2a6ad8'), -0.08, 0.13, 0); box(g, 0.025, 0.25, 0.025, std('#2a6ad8'), 0.18, 0.13, 0);
      box(g, 0.14, 0.1, 0.12, std('#ddd'), 0.24, 0.36, 0); box(g, 0.1, 0.02, 0.05, std('#333'), -0.08, 0.34, 0); break;
    }
    case 'lampe': {
      cyl(g, 0.035, 1.5, std('#2a2c30', { metalness: 0.6, roughness: 0.4 }), 0, 0, 0);
      box(g, 0.3, 0.03, 0.03, std('#2a2c30'), 0.12, 1.48, 0);
      const b = ball(g, 0.07, glowMat('lampbulb', '#ffd28a', null, 0.2, 4, 0), 0.25, 1.42, 0, 0.7);
      glows.push({ x: 0.25, y: 1.4, z: 0, color: '#ffc27a', pool: true, r: 1.4 });
      break;
    }
    case 'bambou': for (let i = 0; i < 7; i++) { const x = Math.cos(i * 2.4) * 0.15, z = Math.sin(i * 2.4) * 0.15; cyl(g, 0.025, 1.1 + (i % 3) * 0.3, std('#7aa04a', { roughness: 0.5 }), x, 0, z); shape(g, G.ico, foliage('green'), x, 1.1 + (i % 3) * 0.3, z, 0.2, 0.3, 0.2); } break;
    case 'toro': {
      const st = std('#8d8a83', { roughness: 0.95 });
      cyl(g, 0.16, 0.08, st, 0, 0, 0, 6); cyl(g, 0.06, 0.4, st, 0, 0.08, 0, 6); box(g, 0.26, 0.06, 0.26, st, 0, 0.48, 0);
      box(g, 0.2, 0.18, 0.2, glowMat('toroLight', '#ffcf86', TEX.shoji(), 0.05, 1.6, 0), 0, 0.54, 0);
      shape(g, G.cone, st, 0, 0.82, 0, 0.42, 0.14, 0.42); ball(g, 0.04, st, 0, 0.9, 0);
      glows.push({ x: 0, y: 0.6, z: 0, color: '#ffcf86', pool: true, r: 0.8 });
      break;
    }
    case 'panneau': box(g, 0.3, 0.5, 0.04, std('#2a2420'), 0, 0, 0, 0); plane(g, 0.24, 0.32, textured('menuboard', TEX.sign('お品書き', '#1c2a22', '#f0ead8', true)), 0, 0.3, 0.025); break;
    case 'bonsai': box(g, 0.34, 0.1, 0.22, std('#3a4a5a'), 0, 0, 0); cyl(g, 0.025, 0.25, std('#5a3e2a'), 0, 0.1, 0); shape(g, G.ico, foliage('green'), 0.08, 0.36, 0, 0.3, 0.14, 0.22); shape(g, G.ico, foliage('green'), -0.08, 0.3, 0, 0.2, 0.1, 0.16); break;
    case 'vending': box(g, 0.42, 0.85, 0.32, std('#d23a3a', { roughness: 0.4 }), 0, 0, 0); plane(g, 0.36, 0.72, glowMat('vendingFace', '#ffffff', TEX.vending(), 0.5, 1.8, 0), 0, 0.45, 0.165); glows.push({ x: 0, y: 0.4, z: 0.3, color: '#cfe6ff', pool: true, r: 0.7 }); break;
    case 'cerisier': case 'erable': case 'sakura': {
      const s = id === 'sakura' ? 2 : 1, kind = id === 'erable' ? 'green' : 'cherry';
      const trunk = std('#4a3326', { roughness: 0.95 });
      const t = cyl(g, 0.07 * s, 0.9 * s, trunk, 0, 0, 0); t.rotation.z = 0.08;
      for (const [x, y, z, r] of [[0, 1.05, 0, 0.5], [0.35, 0.95, 0.1, 0.36], [-0.3, 1, -0.1, 0.38], [0.05, 1.3, 0.2, 0.34], [-0.1, 0.9, 0.35, 0.3]]) shape(g, G.ico, foliage(kind), x * s, y * s, z * s, r * 2 * s);
      g.userData.tree = kind;
      break;
    }
    case 'torii': { const red = std('#c8321f', { roughness: 0.6 }); for (const s of [-1, 1]) cyl(g, 0.07, 1.6, red, s * 0.6, 0, 0); box(g, 1.7, 0.1, 0.16, std('#1c1c1c'), 0, 1.62, 0); box(g, 1.5, 0.08, 0.1, red, 0, 1.52, 0); box(g, 1.4, 0.07, 0.08, red, 0, 1.25, 0); break; }
    case 'puits': { const st = std('#8d8a83'); cyl(g, 0.32, 0.3, st, 0, 0, 0); cyl(g, 0.26, 0.02, std('#2a3a4a', { roughness: 0.05, metalness: 0.3 }), 0, 0.28, 0); cyl(g, 0.04, 0.6, std('#3a6a8a', { metalness: 0.5 }), 0.2, 0.28, 0); box(g, 0.3, 0.04, 0.04, std('#3a6a8a', { metalness: 0.5 }), 0.32, 0.86, 0); break; }
    case 'neko': { const w = std('#f4f1ea', { roughness: 0.4 }); ball(g, 0.3, w, 0, 0.3, 0, 1.1); ball(g, 0.24, w, 0, 0.78, 0); for (const s of [-1, 1]) shape(g, G.cone, w, s * 0.13, 1, 0, 0.12, 0.16); box(g, 0.4, 0.06, 0.3, std('#c8321f'), 0, 0.55, 0.02); ball(g, 0.06, std('#e8c13a', { metalness: 0.8, roughness: 0.3 }), 0, 0.5, 0.25); const paw = ball(g, 0.09, w, 0.28, 0.85, 0.05, 1.6); paw.rotation.z = -0.3; break; }
    case 'jizo': { const st = std('#8d8a83', { roughness: 0.95 }); cyl(g, 0.18, 0.1, st, 0, 0, 0); ball(g, 0.17, st, 0, 0.32, 0, 1.4); ball(g, 0.11, st, 0, 0.6, 0); const bib = box(g, 0.24, 0.16, 0.05, std('#c8321f'), 0, 0.36, 0.13); bib.rotation.x = 0.3; break; }
    case 'kiosque': { for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(g, 0.08, 1.2, 0.08, DARKWOOD(), x, 0, z); box(g, 1.3, 0.06, 1.3, PALEWOOD(), 0, 0.12, 0); gableRoof(g, 1.3, 1.3, 1.2, '#2d3440', 0.55); box(g, 0.9, 0.05, 0.3, PALEWOOD(), 0, 0.35, -0.3); break; }
    case 'fontaine': { const st = std('#9a978f'); cyl(g, 0.55, 0.22, st, 0, 0, 0); cyl(g, 0.48, 0.02, std('#3a6a8a', { roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 }), 0, 0.2, 0); cyl(g, 0.08, 0.6, st, 0, 0.2, 0); cyl(g, 0.22, 0.06, st, 0, 0.78, 0); glows.push({ x: 0, y: 0.3, z: 0, color: '#9fd4ff', pool: true, r: 0.9 }); break; }
  }
  g.userData.glows = glows;
  return g;
}

// ---------- Habitants ----------
const SKIN = ['#f1c9a5', '#e0ac85', '#c98e64', '#8d5a3b', '#f6d6bd'];
const HAIR = ['#1b1512', '#2b1d14', '#4a2f1d', '#8a8a8a', '#b07a3a', '#151518'];
const CLOTH = ['#2f4a6a', '#a33b2e', '#e8e2d6', '#3a5a3a', '#6a4a7a', '#d8a23a', '#2a2a2a', '#7a8a9a', '#c86a8a', '#4a6a8a'];
const PG = {
  leg: new THREE.BoxGeometry(0.075, 0.26, 0.08).translate(0, -0.13, 0),
  arm: new THREE.BoxGeometry(0.055, 0.22, 0.06).translate(0, -0.1, 0),
  body: new THREE.CylinderGeometry(0.1, 0.12, 0.26, 8),
  head: new THREE.SphereGeometry(0.085, 12, 10),
  hair: new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  umbrella: new THREE.ConeGeometry(0.34, 0.14, 10, 1, true),
  stick: new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4),
  hat: new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10),
  box: new THREE.BoxGeometry(0.2, 0.16, 0.16),
};
const UMB = ['#2a3a5a', '#c8402e', '#e8e2d6', '#3a6a5a', '#6a4a7a', '#d8a23a'];
export function makePerson(rng, uniform) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const cloth = std(uniform || pick(CLOTH), { roughness: 0.9 }), pants = std(pick(['#2a2a33', '#3a3a44', '#4a3a2a', '#1f2a3a', '#7a6a5a'])), skin = std(pick(SKIN));
  const mk = (geo, m, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const legL = mk(PG.leg, pants, -0.045, 0.27, 0), legR = mk(PG.leg, pants, 0.045, 0.27, 0);
  const torso = mk(PG.body, cloth, 0, 0.4, 0);
  const armL = mk(PG.arm, cloth, -0.13, 0.51, 0), armR = mk(PG.arm, cloth, 0.13, 0.51, 0);
  const head = mk(PG.head, skin, 0, 0.62, 0);
  mk(uniform ? PG.hat : PG.hair, uniform ? std(uniform === '#f4f1ea' ? '#ffffff' : uniform) : std(pick(HAIR)), 0, uniform ? 0.7 : 0.64, -0.005).rotation.x = uniform ? 0 : -0.25;
  const umbrella = new THREE.Group();
  const canopy = new THREE.Mesh(PG.umbrella, std(pick(UMB), { side: THREE.DoubleSide, roughness: 0.5 }));
  canopy.position.y = 0.95; canopy.castShadow = true;
  const stick = new THREE.Mesh(PG.stick, std('#222'));
  stick.position.y = 0.7;
  umbrella.add(canopy, stick); umbrella.position.set(0.1, 0, 0); umbrella.visible = false;
  body.add(umbrella);
  const carry = mk(PG.box, std('#c8a26a'), 0, 0.42, 0.14); carry.visible = false; // carton de déménagement
  const s = 0.92 + rng() * 0.16;
  root.scale.setScalar(s);
  return { root, body, legL, legR, armL, armR, head, torso, umbrella, carry };
}
