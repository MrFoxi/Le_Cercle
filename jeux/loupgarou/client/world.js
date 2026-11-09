// Le village du Loup-Garou en 3D : « Bourg-la-Lune », un hameau d'automne au bord d'une forêt profonde.
// Place pavée autour d'une fontaine au loup hurlant, sièges en cercle, lanternes et fanions, maisons à colombages
// penchées, auberge « Au Loup qui Dort », chapelle et son clocher, étal du marché, charrette de foin, potirons.
// Le ciel passe du plein jour au coucher de soleil puis à la nuit étoilée (lune, fenêtres allumées, lucioles, yeux
// de loups dans les bois). Tout le décor fixe est fusionné en quelques objets (un par matière) pour rester fluide.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeCharacter, setGhost, animate, play, hitBy, splat, makeItem } from './characters.js';

const LG = window.LG;
const TAU = Math.PI * 2;
let seed = 20261109;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + rnd() * (b - a);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- Textures peintes ---------------- */
const TEX = {};
function paint(key, size, draw, h = size) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = size; c.height = h;
  draw(c.getContext('2d'), size, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (TEX[key] = t);
}
const speckle = (x, n, count, colors, size = 2) => { for (let i = 0; i < count; i++) { x.fillStyle = colors[i % colors.length]; x.fillRect(rnd() * n, rnd() * n, size, size); } };
// Dessine aussi de l'autre côté des bords : la texture se répète sans couture.
const wrap = (n, fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy); };
const T = {
  cobble: () => paint('cobble', 512, (x, n) => {
    x.fillStyle = '#5d554b'; x.fillRect(0, 0, n, n);
    const cells = 10, c = n / cells;
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      const cx = (i + 0.5 + (rnd() - 0.5) * 0.3) * c, cy = (j + 0.5 + (rnd() - 0.5) * 0.3) * c, w = c * between(0.78, 0.9), h = c * between(0.72, 0.88);
      const l = between(58, 72), hue = between(24, 40), sat = between(8, 20);
      wrap(n, (ox, oy) => {
        const X = cx + ox - w / 2, Y = cy + oy - h / 2;
        const g = x.createLinearGradient(X, Y, X + w, Y + h);
        g.addColorStop(0, `hsl(${hue},${sat}%,${l + 10}%)`); g.addColorStop(0.55, `hsl(${hue},${sat}%,${l}%)`); g.addColorStop(1, `hsl(${hue},${sat}%,${l - 16}%)`);
        x.fillStyle = g; x.beginPath(); x.roundRect(X, Y, w, h, w * 0.35); x.fill();
      });
    }
    speckle(x, n, 2500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.07)'], 2);
  }),
  plaster: () => paint('plaster', 256, (x, n) => {
    x.fillStyle = '#f4efe6'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) { const r = between(8, 30), X = rnd() * n, Y = rnd() * n; wrap(n, (ox, oy) => { const g = x.createRadialGradient(X + ox, Y + oy, 0, X + ox, Y + oy, r); g.addColorStop(0, `rgba(${rnd() < 0.5 ? '120,100,80' : '255,255,255'},.07)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X + ox - r, Y + oy - r, r * 2, r * 2); }); }
    x.strokeStyle = 'rgba(90,70,50,.18)'; x.lineWidth = 1;
    for (let i = 0; i < 4; i++) { let X = rnd() * n, Y = rnd() * n; x.beginPath(); x.moveTo(X, Y); for (let k = 0; k < 5; k++) { X += between(-10, 10); Y += between(4, 12); x.lineTo(X, Y); } x.stroke(); }
    speckle(x, n, 900, ['rgba(0,0,0,.05)'], 1);
  }),
  stone: () => paint('stone', 256, (x, n) => {
    x.fillStyle = '#6f675c'; x.fillRect(0, 0, n, n);
    const rows = 8, rh = n / rows;
    for (let r = 0; r < rows; r++) for (let px = r % 2 ? -rh * 0.9 : 0; px < n; px += rh * between(1.3, 1.9)) {
      const w = rh * between(1.2, 1.8), l = between(60, 76);
      x.fillStyle = `hsl(${between(25, 45)},${between(6, 14)}%,${l}%)`; x.beginPath(); x.roundRect(px + 2, r * rh + 2, w - 4, rh - 4, 6); x.fill();
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 4, r * rh + 3, w - 10, 3);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(px + 4, r * rh + rh - 6, w - 10, 3);
    }
    speckle(x, n, 1500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.06)']);
  }),
  tiles: () => paint('tiles', 256, (x, n) => {
    x.fillStyle = '#7d7d7d'; x.fillRect(0, 0, n, n);
    const tw = 32, th = 26;
    for (let r = -1; r < n / th + 1; r++) for (let k = -1; k < n / tw + 1; k++) {
      const X = k * tw + (r % 2 ? tw / 2 : 0), Y = r * th, l = between(70, 88);
      const g = x.createLinearGradient(0, Y, 0, Y + th + 8); g.addColorStop(0, `hsl(0,0%,${l}%)`); g.addColorStop(1, `hsl(0,0%,${l - 30}%)`);
      x.fillStyle = g; x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y + th - 6); x.quadraticCurveTo(X + tw / 2, Y + th + 9, X + tw, Y + th - 6); x.lineTo(X + tw, Y); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.5; x.stroke();
    }
  }),
  thatch: () => paint('thatch', 256, (x, n) => {
    x.fillStyle = '#b8913f'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const X = rnd() * n, Y = rnd() * n, l = between(35, 70); x.strokeStyle = `hsl(${between(36, 46)},${between(45, 65)}%,${l}%)`; x.lineWidth = between(1, 2.2); x.beginPath(); x.moveTo(X, Y); x.lineTo(X + between(-2, 2), Y + between(10, 22)); x.stroke(); }
    for (let r = 0; r < n; r += 32) { x.fillStyle = 'rgba(60,40,10,.25)'; x.fillRect(0, r + 28, n, 4); }
  }),
  wood: () => paint('wood', 256, (x, n) => {
    const pw = n / 6;
    for (let k = 0; k < 6; k++) {
      x.fillStyle = `hsl(${between(24, 32)},${between(30, 42)}%,${between(52, 64)}%)`; x.fillRect(k * pw, 0, pw, n);
      for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(60,35,15,${between(0.08, 0.22)})`; x.lineWidth = 1; x.beginPath(); const X = k * pw + rnd() * pw; x.moveTo(X, 0); x.bezierCurveTo(X + between(-4, 4), n * 0.3, X + between(-4, 4), n * 0.7, X, n); x.stroke(); }
      x.fillStyle = 'rgba(30,15,5,.45)'; x.fillRect(k * pw, 0, 2, n);
    }
  }),
  beam: () => paint('beam', 128, (x, n) => { x.fillStyle = '#6a4a32'; x.fillRect(0, 0, n, n); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(30,15,5,${between(0.1, 0.3)})`; x.beginPath(); const Y = rnd() * n; x.moveTo(0, Y); x.lineTo(n, Y + between(-3, 3)); x.stroke(); } }),
  grass: () => paint('grass', 256, (x, n) => {
    x.fillStyle = '#8fb860'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 5000; i++) { const X = rnd() * n, Y = rnd() * n; x.strokeStyle = rnd() < 0.5 ? `rgba(60,100,30,${between(0.15, 0.4)})` : `rgba(200,230,140,${between(0.12, 0.3)})`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + between(-1.5, 1.5), Y - between(3, 7)); x.stroke(); }
  }),
  dirt: () => paint('dirt', 256, (x, n) => {
    x.fillStyle = '#a88a62'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) { const X = rnd() * n, Y = rnd() * n, r = between(3, 9); x.fillStyle = `hsl(${between(25, 40)},${between(8, 18)}%,${between(52, 72)}%)`; x.beginPath(); x.ellipse(X, Y, r, r * 0.75, rnd() * 3, 0, TAU); x.fill(); }
    speckle(x, n, 3000, ['rgba(60,40,20,.12)', 'rgba(255,240,210,.1)']);
  }),
  bark: () => paint('bark', 128, (x, n) => { x.fillStyle = '#5b3f2c'; x.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(${rnd() < 0.5 ? '25,15,8' : '140,100,70'},${between(0.2, 0.45)})`; x.lineWidth = between(1, 3); x.beginPath(); const X = rnd() * n; x.moveTo(X, 0); x.bezierCurveTo(X + between(-6, 6), n / 3, X + between(-6, 6), (2 * n) / 3, X + between(-3, 3), n); x.stroke(); } }),
  window: () => paint('window', 64, (x, n) => { x.fillStyle = '#9fb3c0'; x.fillRect(0, 0, n, n); const g = x.createLinearGradient(0, 0, n, n); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = '#2b1d14'; x.fillRect(n / 2 - 3, 0, 6, n); x.fillRect(0, n / 2 - 3, n, 6); x.lineWidth = 8; x.strokeStyle = '#2b1d14'; x.strokeRect(0, 0, n, n); }),
  windowGlow: () => paint('windowGlow', 64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n * 0.7); g.addColorStop(0, '#fff'); g.addColorStop(1, '#b07a40'); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = '#000'; x.fillRect(n / 2 - 3, 0, 6, n); x.fillRect(0, n / 2 - 3, n, 6); x.lineWidth = 8; x.strokeStyle = '#000'; x.strokeRect(0, 0, n, n); }),
  stripes: () => paint('stripes', 128, (x, n) => { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#f6ecd6' : '#c8402e'; x.fillRect((k * n) / 8, 0, n / 8, n); } }),
  glass: () => paint('stainedGlass', 256, (x, n) => {
    x.fillStyle = '#1a1020'; x.fillRect(0, 0, n, n);
    const c = n / 2, cols = ['#e04a3a', '#3a7ae0', '#f2c230', '#3ab06a', '#a050d0', '#f08a30'];
    for (let k = 0; k < 12; k++) { x.fillStyle = cols[k % cols.length]; x.beginPath(); x.moveTo(c, c); x.arc(c, c, c - 8, (k / 12) * TAU, ((k + 1) / 12) * TAU); x.fill(); }
    x.fillStyle = '#f6e7a8'; x.beginPath(); x.arc(c, c, c * 0.3, 0, TAU); x.fill();
    x.strokeStyle = '#1a1020'; x.lineWidth = 6; for (let k = 0; k < 12; k++) { x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos((k / 12) * TAU) * c, c + Math.sin((k / 12) * TAU) * c); x.stroke(); }
    x.beginPath(); x.arc(c, c, c * 0.3, 0, TAU); x.stroke(); x.beginPath(); x.arc(c, c, c - 6, 0, TAU); x.stroke();
  }),
  innSign: () => paint('innSign', 512, (x, w, h) => {
    x.fillStyle = '#5a3a22'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(0,0,0,.2)'; x.beginPath(); const Y = rnd() * h; x.moveTo(0, Y); x.lineTo(w, Y + between(-4, 4)); x.stroke(); }
    x.strokeStyle = '#e0b24a'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#f6e3b0'; x.beginPath(); x.arc(78, h / 2, 42, 0, TAU); x.fill(); x.fillStyle = '#5a3a22'; x.beginPath(); x.arc(96, h / 2 - 12, 40, 0, TAU); x.fill();
    x.fillStyle = '#f6e3b0'; x.textAlign = 'center'; x.font = 'bold 40px Georgia, serif'; x.fillText('AUBERGE', w / 2 + 40, h / 2 - 8);
    x.font = 'italic 30px Georgia, serif'; x.fillText('Au Loup qui Dort', w / 2 + 40, h / 2 + 34);
  }, 128),
  poster: () => paint('poster', 256, (x, n) => {
    x.fillStyle = '#efe0bc'; x.fillRect(0, 0, n, n);
    speckle(x, n, 800, ['rgba(120,80,30,.12)'], 3);
    x.fillStyle = '#3a2210'; x.textAlign = 'center'; x.font = 'bold 34px Georgia, serif'; x.fillText('RECHERCHÉ', n / 2, 44);
    // tête de loup
    x.beginPath(); x.moveTo(n / 2, 200); x.lineTo(n / 2 - 52, 120); x.lineTo(n / 2 - 46, 66); x.lineTo(n / 2 - 18, 100); x.lineTo(n / 2 + 18, 100); x.lineTo(n / 2 + 46, 66); x.lineTo(n / 2 + 52, 120); x.closePath(); x.fill();
    x.fillStyle = '#e8b030'; x.beginPath(); x.arc(n / 2 - 20, 132, 7, 0, TAU); x.arc(n / 2 + 20, 132, 7, 0, TAU); x.fill();
    x.fillStyle = '#3a2210'; x.font = 'bold 22px Georgia, serif'; x.fillText('MORT OU VIF', n / 2, 236);
  }),
  ripple: () => paint('ripple', 256, (x, n) => {
    x.fillStyle = '#5a9ab0'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 90; i++) { const X = rnd() * n, Y = rnd() * n, r = between(6, 22); wrap(n, (ox, oy) => { x.strokeStyle = `rgba(220,250,255,${between(0.15, 0.4)})`; x.lineWidth = between(1, 2.5); x.beginPath(); x.ellipse(X + ox, Y + oy, r, r * 0.6, rnd(), 0, TAU); x.stroke(); }); }
  }),
};

/* ---------------- Formes ---------------- */
// Boîte dont la texture garde la même échelle quelle que soit sa taille (tile : mètres par répétition).
function bx(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  return g;
}
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
// Fusionne tout un groupe : un seul objet par matière (positions déjà dans le monde).
function bake(group) {
  group.updateMatrixWorld(true);
  const by = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [m, list] of by) { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = !m.userData.noShadow; mesh.receiveShadow = true; out.add(mesh); }
  return out;
}

/* ---------------- Matières ---------------- */
const MAT = {};
const std = (key, o) => (MAT[key] ??= new THREE.MeshStandardMaterial({ roughness: 0.9, ...o }));
const M = {
  plaster: c => std(`plaster${c}`, { map: T.plaster(), color: c }),
  stone: c => std(`stone${c}`, { map: T.stone(), color: c ?? '#ffffff' }),
  tiles: c => std(`tiles${c}`, { map: T.tiles(), color: c, roughness: 0.75 }),
  thatch: () => std('thatch', { map: T.thatch(), roughness: 1 }),
  wood: c => std(`wood${c}`, { map: T.wood(), color: c ?? '#ffffff' }),
  beam: () => std('beam', { map: T.beam(), color: '#7a5a42' }),
  bark: () => std('bark', { map: T.bark() }),
  iron: () => std('iron', { color: '#2e2a28', metalness: 0.6, roughness: 0.45 }),
  gold: () => std('gold', { color: '#e3b24c', metalness: 0.8, roughness: 0.3 }),
  bronze: () => std('bronze', { color: '#5f9a82', metalness: 0.55, roughness: 0.42 }),
  plain: (c, o) => std(`plain${c}${o ? JSON.stringify(o) : ''}`, { color: c, ...o }),
};
// Fenêtres, lanternes, vitrail : leur lueur suit la nuit (deux sortes de fenêtres, qui s'allument à des moments différents).
const GLOW = [];
const glow = (key, o, curve) => { const m = std(key, { emissiveIntensity: 0, ...o }); if (!GLOW.some(g => g.m === m)) GLOW.push({ m, curve }); m.userData.noShadow = true; return m; };
const WIN = [
  glow('winA', { map: T.window(), emissive: '#ffb257', emissiveMap: T.windowGlow(), roughness: 0.25 }, (k, n) => smooth(0.3, 0.7, k) * 2.4 * n),
  glow('winB', { map: T.window(), emissive: '#ff9d4a', emissiveMap: T.windowGlow(), roughness: 0.25 }, (k, n) => smooth(0.55, 0.95, k) * 2.0 * n),
];
const LAMP = glow('lampGlass', { color: '#ffe6b0', emissive: '#ffb050', roughness: 0.3 }, k => 0.4 + smooth(0.25, 0.8, k) * 4);
const STAINED = glow('stained', { map: T.glass(), emissive: '#ffffff', emissiveMap: T.glass(), roughness: 0.3 }, k => 0.15 + smooth(0.4, 0.9, k) * 1.6);
const PUMPKIN = glow('pumpkinFace', { color: '#2a1408', emissive: '#ffa030' }, k => smooth(0.4, 0.9, k) * 3);

/* ---------------- Bâtiments ---------------- */
// Pans de bois sur une façade (repère local : x en largeur, y en hauteur, z vers l'extérieur).
function timber(face, w, h, beam) {
  const n = Math.max(2, Math.round(w / 1.15));
  for (let k = 0; k <= n; k++) put(face, bx(0.13, h, 0.07), beam, -w / 2 + (k * w) / n, h / 2, 0.03);
  put(face, bx(w + 0.08, 0.13, 0.07), beam, 0, 0.065, 0.03);
  put(face, bx(w + 0.08, 0.13, 0.07), beam, 0, h - 0.065, 0.03);
  for (let k = 0; k < n; k += 2) { const bw = w / n, len = Math.hypot(bw, h * 0.55); put(face, bx(0.1, len, 0.06), beam, -w / 2 + (k + 0.5) * bw, h * 0.32, 0.03, 0, 0, (k % 4 ? 1 : -1) * Math.atan2(bw, h * 0.55)); }
}
function windowAt(face, x, y, o, lit) {
  const win = WIN[lit], beam = M.beam();
  put(face, bx(0.66, 0.84, 0.08), beam, x, y, 0.04);
  put(face, bx(0.52, 0.7, 0.05), win, x, y, 0.07);
  put(face, bx(0.74, 0.08, 0.16), beam, x, y - 0.44, 0.09);
  if (o.shutters) for (const s of [1, -1]) put(face, bx(0.3, 0.74, 0.04, 0.5), M.wood(o.shutters), x + s * 0.5, y, 0.18, 0, s * 0.5);
  if (o.flowers && rnd() < 0.7) {
    put(face, bx(0.6, 0.14, 0.18), M.wood('#8a5a3a'), x, y - 0.55, 0.16);
    for (let k = 0; k < 6; k++) put(face, new THREE.IcosahedronGeometry(0.07, 0), M.plain(['#ff5a6a', '#ffd23f', '#ffffff', '#ff8acb', '#b07aff'][(k + Math.floor(x * 7)) % 5], { flatShading: true }), x - 0.24 + k * 0.096, y - 0.43, 0.17 + (k % 2) * 0.04);
    put(face, bx(0.58, 0.06, 0.14), M.plain('#4f8a3a'), x, y - 0.47, 0.16);
  }
}
// Une façade : groupe placé sur le mur (côté +z, -z, +x, -x d'un volume w × d).
function faces(g, w, d, y) {
  return [
    { f: grp(g, 0, y, d / 2, 0), w }, { f: grp(g, 0, y, -d / 2, Math.PI), w },
    { f: grp(g, w / 2, y, 0, Math.PI / 2), w: d }, { f: grp(g, -w / 2, y, 0, -Math.PI / 2), w: d },
  ];
}
function door(face, o, x = 0) {
  put(face, bx(1.12, 1.9, 0.1), M.stone('#c9bfae'), x, 0.95, 0.03);
  put(face, bx(0.86, 1.55, 0.08), M.wood(o.door), x, 0.78, 0.07);
  put(face, new THREE.CylinderGeometry(0.43, 0.43, 0.08, 18, 1, false, -Math.PI / 2, Math.PI), M.wood(o.door), x, 1.55, 0.07, Math.PI / 2);
  put(face, new THREE.SphereGeometry(0.05, 8, 6), M.gold(), x + 0.28, 0.85, 0.13);
  for (const yy of [0.4, 1.15]) put(face, bx(0.8, 0.05, 0.02), M.iron(), x, yy, 0.12);
  put(face, bx(1.3, 0.14, 0.5), M.stone('#b5ab9a'), x, 0.07, 0.25);
}
const CHIMNEYS = [];
// Maison à colombages : rez-de-chaussée (pierre ou enduit), étages en encorbellement légèrement penchés, toit pentu.
function house(parent, o) {
  const root = grp(parent, o.x, 0, o.z, o.ry);
  const H0 = 1.9, HF = 1.6, beam = M.beam(), wall = M.plaster(o.wall);
  put(root, bx(o.w, H0, o.d, 2), o.stoneBase ? M.stone('#d8cfc0') : wall, 0, H0 / 2, 0);
  const g0 = faces(root, o.w, o.d, 0);
  if (!o.stoneBase) for (const { f, w } of g0) timber(f, w, H0, beam);
  door(g0[0].f, o, o.doorX ?? 0);
  for (const { f, w } of g0) for (let x = -w / 2 + 0.9; x <= w / 2 - 0.7; x += 1.5) if (f !== g0[0].f || Math.abs(x - (o.doorX ?? 0)) > 1) windowAt(f, x, 1.15, o, rnd() < 0.5 ? 0 : 1);
  // étages
  let level = grp(root, 0, H0, 0), w = o.w, d = o.d;
  level.rotation.z = o.tilt ?? 0;
  for (let k = 1; k < o.floors; k++) {
    w += 0.35; d += 0.35;
    put(level, bx(w, 0.18, d), beam, 0, 0.09, 0);
    put(level, bx(w, HF, d, 2), wall, 0, HF / 2 + 0.18, 0);
    for (const { f, w: fw } of faces(level, w, d, 0.18)) { timber(f, fw, HF, beam); for (let x = -fw / 2 + 0.8; x <= fw / 2 - 0.6; x += 1.45) windowAt(f, x, 0.85, o, rnd() < 0.5 ? 0 : 1); }
    level = grp(level, 0, HF + 0.18, 0);
    level.rotation.z = (o.tilt ?? 0) * 0.6;
  }
  // toit
  const over = 0.4, half = d / 2 + over, rh = d * (o.pitch ?? 0.62), slant = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  const roofMat = o.thatch ? M.thatch() : M.tiles(o.roof);
  for (const s of [1, -1]) put(level, bx(w + 0.8, o.thatch ? 0.32 : 0.15, slant + 0.1, 1.6), roofMat, 0, rh / 2, (s * half) / 2, s * ang);
  put(level, new THREE.CylinderGeometry(o.thatch ? 0.2 : 0.11, o.thatch ? 0.2 : 0.11, w + 0.9, 10), o.thatch ? M.thatch() : M.tiles(o.ridge ?? o.roof), 0, rh + 0.02, 0, 0, 0, Math.PI / 2);
  const y0 = (rh * (half - d / 2)) / half; // hauteur du toit au-dessus des murs
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(d / 2, y0), new THREE.Vector2(0, rh - 0.05), new THREE.Vector2(-d / 2, y0)]);
  for (const s of [1, -1]) {
    const gable = put(level, new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), wall, s * (w / 2) - (s > 0 ? 0.1 : 0), 0, 0, 0, Math.PI / 2);
    gable.scale.z = 1;
    const fg = grp(level, s * (w / 2 + 0.02), 0, 0, s * Math.PI / 2);
    put(fg, bx(0.12, rh * 0.9, 0.06), beam, 0, rh * 0.45, 0.02);
    put(fg, bx(d * 0.7, 0.12, 0.06), beam, 0, rh * 0.35, 0.02);
    if (o.atticWindow !== false) windowAt(fg, 0, rh * 0.38 + 0.05, { ...o, flowers: false, shutters: null }, 1);
  }
  if (o.chimney !== false) {
    const cx = w * 0.27 * (o.chimneySide ?? 1), cz = -half * 0.3, ch = put(level, bx(0.6, rh + 0.9, 0.6), M.stone('#bcb2a2'), cx, rh * 0.55, cz, 0, 0, (o.tilt ?? 0) * -2);
    put(level, bx(0.75, 0.14, 0.75), M.stone('#9a9080'), cx, rh * 0.55 + (rh + 0.9) / 2, cz);
    CHIMNEYS.push({ obj: ch, top: (rh + 0.9) / 2 + 0.2 });
  }
  if (o.tower) {
    const tx = -o.w / 2 - 0.55, tz = o.d / 2 - 0.9, th = H0 + HF * (o.floors - 1) + 1.2;
    put(root, new THREE.CylinderGeometry(1.05, 1.15, th, 14), M.stone('#cfc5b4'), tx, th / 2, tz);
    put(root, new THREE.ConeGeometry(1.45, 2.6, 14), M.tiles(o.roof), tx, th + 1.3, tz);
    put(root, new THREE.SphereGeometry(0.12, 10, 8), M.gold(), tx, th + 2.65, tz);
    for (let y = 1.3; y < th - 0.5; y += 1.6) { const tw = grp(root, tx + Math.sin(0.6) * 1.08, y, tz + Math.cos(0.6) * 1.08, 0.6); put(tw, bx(0.36, 0.6, 0.1), WIN[1], 0, 0, 0.02); put(tw, bx(0.46, 0.08, 0.14), M.stone('#a99f8e'), 0, -0.33, 0.04); }
  }
  return root;
}

// Chapelle : nef en pierre, clocher avec sa cloche, flèche d'ardoise et rosace (local +x : vers la place).
function chapel(parent, x, z, ry) {
  const root = grp(parent, x, 0, z, ry);
  const L = 7, W = 4.4, H = 3.6, stone = M.stone('#ddd3c2');
  put(root, bx(L, H, W, 2), stone, 0, H / 2, 0);
  const half = W / 2 + 0.4, rh = 2.6, slant = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  const nave = grp(root, 0, H, 0, Math.PI / 2);
  for (const s of [1, -1]) put(nave, bx(W + 0.2, 0.16, slant), M.tiles('#5d6b80'), 0, rh / 2, (s * half) / 2, s * ang);
  const roof = grp(root, 0, H, 0);
  for (const s of [1, -1]) put(roof, bx(L + 0.6, 0.16, slant + 0.1, 1.6), M.tiles('#5d6b80'), 0, rh / 2, (s * half) / 2, s * ang);
  put(roof, new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rh * (W / 2 / half))]), { depth: 0.1, bevelEnabled: false }), stone, -L / 2, 0, 0, 0, Math.PI / 2);
  for (let k = -1; k <= 1; k++) for (const s of [1, -1]) { const f = grp(root, k * 2, 1.9, s * (W / 2), s > 0 ? 0 : Math.PI); put(f, new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14, 1, false, -Math.PI / 2, Math.PI), STAINED, 0, 0.55, 0.03, Math.PI / 2); put(f, bx(0.64, 1.1, 0.1), STAINED, 0, 0, 0.03); }
  // clocher
  const tx = L / 2 + 0.9, TW = 2.2, TH = 7.2;
  put(root, bx(TW, TH, TW, 2), stone, tx, TH / 2, 0);
  put(root, bx(TW + 0.2, 0.2, TW + 0.2), M.stone('#b8ae9c'), tx, TH, 0);
  for (const a of [0, 1, 2, 3]) { const f = grp(root, tx + Math.sin((a * Math.PI) / 2) * (TW / 2), TH - 1.3, Math.cos((a * Math.PI) / 2) * (TW / 2), (a * Math.PI) / 2); put(f, bx(0.9, 1.2, 0.12), M.plain('#1c1410'), 0, 0, 0.0); }
  const bell = new THREE.LatheGeometry([[0, 0.55], [0.18, 0.52], [0.26, 0.3], [0.3, 0.05], [0.42, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  put(root, bell, M.gold(), tx, TH - 1.75, 0);
  put(root, new THREE.ConeGeometry(TW * 0.82, 4.2, 4), M.tiles('#4f5d72'), tx, TH + 2.2, 0, 0, Math.PI / 4);
  put(root, bx(0.06, 0.9, 0.06), M.iron(), tx, TH + 4.6, 0);
  put(root, bx(0.45, 0.06, 0.06), M.iron(), tx, TH + 4.75, 0);
  const front = grp(root, tx + TW / 2, 0, 0, Math.PI / 2);
  door(front, { door: '#6a3424' });
  put(front, new THREE.CircleGeometry(0.55, 24), STAINED, 0, 3.6, 0.04);
  put(front, new THREE.TorusGeometry(0.58, 0.07, 6, 24), M.stone('#b8ae9c'), 0, 3.6, 0.05);
  return root;
}

// La fontaine : bassin octogonal, vasque, et un loup de bronze qui hurle sous un croissant de lune doré.
function fountain(parent) {
  const g = grp(parent);
  const st = M.stone('#d6ccbb');
  put(g, new THREE.CylinderGeometry(2.75, 2.85, 0.14, 8), M.stone('#b9ae9c'), 0, 0.07, 0);
  put(g, new THREE.LatheGeometry([[0, 0.15], [1.92, 0.15], [1.92, 0.62], [2.08, 0.72], [2.3, 0.64], [2.36, 0.05], [2.45, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 8), st);
  put(g, new THREE.CylinderGeometry(0.32, 0.42, 1.5, 10), st, 0, 0.9, 0);
  put(g, new THREE.LatheGeometry([[0, 1.5], [0.85, 1.55], [1.02, 1.78], [0.96, 1.82], [0.8, 1.66], [0, 1.66]].map(([r, y]) => new THREE.Vector2(r, y)), 16), st);
  put(g, new THREE.CylinderGeometry(0.22, 0.3, 0.5, 10), st, 0, 1.95, 0);
  // le loup
  const w = grp(g, 0, 2.2, 0, Math.PI * 0.15), br = M.bronze();
  put(w, new THREE.SphereGeometry(0.34, 16, 12), br, 0, 0.3, -0.1, 0, 0, 0, 1, 0.8, 1.15);
  put(w, new THREE.SphereGeometry(0.27, 16, 12), br, 0, 0.66, 0.1, -0.35, 0, 0, 0.9, 1.25, 0.9);
  for (const s of [1, -1]) { put(w, new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), br, s * 0.13, 0.3, 0.24, 0.1); put(w, new THREE.SphereGeometry(0.08, 8, 6), br, s * 0.13, 0.02, 0.3, 0, 0, 0, 1, 0.6, 1.3); put(w, new THREE.SphereGeometry(0.15, 10, 8), br, s * 0.22, 0.18, -0.15, 0, 0, 0, 0.7, 1, 1.3); }
  put(w, new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), br, 0.18, 0.08, -0.48, 1.3, 0.6, 0);
  const hd = grp(w, 0, 0.98, 0.22); hd.rotation.x = -0.75;
  put(hd, new THREE.SphereGeometry(0.2, 14, 10), br, 0, 0, 0);
  put(hd, new THREE.ConeGeometry(0.1, 0.34, 10), br, 0, 0.02, 0.26, Math.PI / 2);
  put(hd, new THREE.SphereGeometry(0.06, 8, 6), br, 0, -0.06, 0.18);
  for (const s of [1, -1]) put(hd, new THREE.ConeGeometry(0.07, 0.2, 6), br, s * 0.1, 0.18, -0.06, -0.3, 0, -s * 0.2);
  put(w, new THREE.SphereGeometry(0.16, 10, 8), br, 0, 0.82, 0.18, -0.4, 0, 0, 0.9, 1, 1.1); // cou
  const moon = new THREE.Shape(); moon.absarc(0, 0, 0.42, Math.PI * 0.25, Math.PI * 1.75, false); moon.absarc(0.2, 0, 0.32, Math.PI * 1.6, Math.PI * 0.4, true);
  put(g, new THREE.ExtrudeGeometry(moon, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), M.gold(), -0.2, 3.85, -0.5, 0, Math.PI * 0.15, 0.4);
  put(g, new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M.iron(), -0.12, 3.1, -0.48);
  return g;
}

// Sièges autour de la fontaine (le personnage s'assied face à elle).
function seat(parent, s) {
  const g = grp(parent, s.x, 0, s.z, s.ry), wd = M.wood('#b08560');
  if (s.kind === 'banc') { put(g, bx(1.25, 0.08, 0.42, 0.6), wd, 0, 0.38, 0); for (const x of [-0.5, 0.5]) put(g, bx(0.1, 0.36, 0.36), M.wood('#8a6448'), x, 0.18, 0); }
  if (s.kind === 'chaise') { put(g, bx(0.46, 0.06, 0.44, 0.6), wd, 0, 0.38, 0); for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) put(g, bx(0.06, 0.38, 0.06), M.wood('#8a6448'), x, 0.19, z); for (const x of [-0.19, 0.19]) put(g, bx(0.06, 0.6, 0.06), M.wood('#8a6448'), x, 0.68, -0.2); for (const y of [0.62, 0.86]) put(g, bx(0.44, 0.08, 0.04), wd, 0, y, -0.2); }
  if (s.kind === 'souche') { put(g, new THREE.CylinderGeometry(0.3, 0.36, 0.38, 12), M.bark(), 0, 0.19, 0); put(g, new THREE.CylinderGeometry(0.29, 0.29, 0.02, 12), M.plain('#d8b07a'), 0, 0.385, 0); }
  if (s.kind === 'tonneau') { put(g, new THREE.LatheGeometry([[0.24, 0], [0.29, 0.19], [0.24, 0.38]].map(([r, y]) => new THREE.Vector2(r, y)), 14), M.wood('#9a6a40'), 0, 0, 0); put(g, new THREE.CircleGeometry(0.24, 14), M.wood('#9a6a40'), 0, 0.38, 0, -Math.PI / 2); for (const y of [0.07, 0.31]) put(g, new THREE.TorusGeometry(0.275, 0.015, 4, 16), M.iron(), 0, y, 0, Math.PI / 2); }
  if (s.kind === 'tabouret') { put(g, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), wd, 0, 0.37, 0); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; put(g, bx(0.05, 0.4, 0.05), M.wood('#8a6448'), Math.sin(a) * 0.13, 0.18, Math.cos(a) * 0.13, Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15); } }
}

/* ---------------- Le monde ---------------- */
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c5dde2', 45, 200);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 700);
  const hemi = new THREE.HemisphereLight('#d6ecff', '#7a6a48', 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  /* ---- Terrain : la place est plate, les collines montent vers la forêt ---- */
  const heightAt = (x, z) => { const r = Math.hypot(x, z), s = smooth(24, 60, r); return s * (Math.sin(x * 0.05) * 1.6 + Math.sin(z * 0.043 + 1) * 1.8 + Math.sin((x + z) * 0.031) * 1.4 + (r - 24) * 0.07) + smooth(140, 230, r) * 30; };
  {
    const geo = new THREE.PlaneGeometry(520, 520, 130, 130); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = [], c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z);
      p.setY(i, h);
      const n = Math.sin(x * 0.11) * Math.sin(z * 0.13) * 0.5 + 0.5, au = smooth(0.55, 0.9, Math.sin(x * 0.07 + 2) * Math.cos(z * 0.05) * 0.5 + 0.5);
      c.setHSL(0.24 - au * 0.12, 0.42 + au * 0.1, 0.4 + n * 0.08 - smooth(30, 70, Math.hypot(x, z)) * 0.1); col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const tex = T.grass().clone(); tex.repeat.set(130, 130); tex.needsUpdate = true;
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
    ground.receiveShadow = true; scene.add(ground);
  }

  /* ---- Décor fixe (fusionné à la fin) ---- */
  const deco = new THREE.Group();
  // place pavée, bordure, chemins
  {
    const t = T.cobble().clone(); t.repeat.set(10, 10); t.needsUpdate = true;
    const place = new THREE.Mesh(new THREE.CircleGeometry(13, 80), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
    place.rotation.x = -Math.PI / 2; place.position.y = 0.03; place.receiveShadow = true; scene.add(place);
    for (let k = 0; k < 64; k++) { const a = (k / 64) * TAU; put(deco, bx(1.32, 0.16, 0.38), M.stone('#c8bea9'), Math.sin(a) * 13.15, 0.06, Math.cos(a) * 13.15, 0, a + Math.PI / 2 + between(-0.04, 0.04)); }
    const dirt = T.dirt().clone(); dirt.needsUpdate = true;
    for (const [deg, len, wid] of [[0, 80, 3.2], [30, 16, 2.2], [150, 14, 2.2], [270, 16, 2.4]]) {
      const a = (deg * Math.PI) / 180, geo = new THREE.PlaneGeometry(wid, len, 4, Math.round(len)); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i), lz = p.getZ(i) + len / 2 + 12.8, wob = Math.sin(lz * 0.18 + deg) * 0.9;
        const wx = Math.sin(a) * lz + Math.cos(a) * (lx + wob), wz = Math.cos(a) * lz - Math.sin(a) * (lx + wob);
        p.setXYZ(i, wx, heightAt(wx, wz) + 0.05, wz); uv.setXY(i, uv.getX(i) * (wid / 3), uv.getY(i) * (len / 3));
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
      m.receiveShadow = true; scene.add(m);
    }
  }
  fountain(deco);
  for (const s of LG.SEATS) seat(deco, s);
  // lanternes, et fanions tendus de l'une à l'autre
  const lampPos = [];
  for (const l of LG.LANTERNS) {
    const a = Math.atan2(l.x, l.z), g = grp(deco, l.x, 0, l.z, a);
    put(g, new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8), M.stone('#bdb3a2'), 0, 0.15, 0);
    put(g, bx(0.14, 2.9, 0.14), M.beam(), 0, 1.6, 0);
    put(g, bx(0.08, 0.08, 0.7), M.iron(), 0, 2.95, 0.3);
    put(g, new THREE.TorusGeometry(0.22, 0.025, 4, 12, Math.PI / 2), M.iron(), 0, 2.72, 0.2, 0, Math.PI / 2, Math.PI);
    const lg = grp(g, 0, 2.55, 0.6);
    put(lg, bx(0.26, 0.34, 0.26), LAMP, 0, 0, 0);
    for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) put(lg, bx(0.03, 0.38, 0.03), M.iron(), x, 0, z);
    put(lg, new THREE.ConeGeometry(0.24, 0.2, 4), M.iron(), 0, 0.27, 0, 0, Math.PI / 4);
    put(lg, bx(0.3, 0.04, 0.3), M.iron(), 0, -0.19, 0);
    lampPos.push(new THREE.Vector3(l.x + Math.sin(a) * 0.6, 2.55, l.z + Math.cos(a) * 0.6));
  }
  {
    const flagCols = ['#e8543c', '#f2c230', '#3d8bff', '#2fb36a', '#f6efe0', '#a46bff'];
    for (let k = 0; k < LG.LANTERNS.length; k++) {
      const A = LG.LANTERNS[k], B = LG.LANTERNS[(k + 1) % LG.LANTERNS.length];
      const pts = Array.from({ length: 13 }, (_, i) => { const u = i / 12; return new THREE.Vector3(A.x + (B.x - A.x) * u, 3.05 - Math.sin(u * Math.PI) * 0.75, A.z + (B.z - A.z) * u); });
      put(deco, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), M.plain('#3a2a20'));
      for (let i = 1; i < 12; i++) {
        const p = pts[i], q = pts[i + 1], tri = new THREE.Shape([new THREE.Vector2(-0.14, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0, -0.32)]);
        put(deco, new THREE.ShapeGeometry(tri), M.plain(flagCols[(i + k) % flagCols.length], { side: THREE.DoubleSide, roughness: 0.8 }), p.x, p.y, p.z, 0, Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2, 0);
      }
    }
  }
  // maisons, auberge, chapelle
  const at = (deg, r) => { const a = (deg * Math.PI) / 180, x = Math.sin(a) * r, z = Math.cos(a) * r; return { x, z, ry: Math.atan2(-x, -z) }; };
  house(deco, { ...at(60, 19.5), w: 5, d: 4.2, floors: 2, wall: '#f3e2c0', roof: '#c0563c', door: '#8a3a2a', shutters: '#3f7a5a', flowers: true, tilt: 0.03, chimneySide: 1 });
  house(deco, { ...at(90, 20), w: 4.6, d: 4.4, floors: 2, wall: '#e8d6c8', roof: '#5a6f8f', door: '#3a4f6f', shutters: '#c0563c', flowers: true, stoneBase: true, tower: true });
  house(deco, { ...at(120, 19.5), w: 4.4, d: 4, floors: 1, wall: '#f1d7a8', thatch: true, door: '#7a4a2a', shutters: '#8a5a8a', flowers: true, pitch: 0.75, tilt: -0.02 });
  const inn = house(deco, { ...at(180, 20.5), w: 8.6, d: 5.4, floors: 2, wall: '#f6e7cc', roof: '#a8473a', door: '#6a3424', shutters: '#2f5f7a', flowers: true, stoneBase: true, pitch: 0.55, chimneySide: -1 });
  house(deco, { ...at(210, 19.5), w: 3.6, d: 3.8, floors: 3, wall: '#dfe6ee', roof: '#3f5f8f', door: '#2f4f7f', shutters: '#e0a030', flowers: true, tilt: -0.05, pitch: 0.8 });
  chapel(deco, ...Object.values((({ x, z, ry }) => ({ x, z, ry: ry - Math.PI / 2 }))(at(245, 21.5))));
  house(deco, { ...at(300, 19.5), w: 4.8, d: 4.2, floors: 2, wall: '#f0c9b8', roof: '#5f7a4a', door: '#4a6a3a', shutters: '#7a4a2a', flowers: true, tilt: 0.06, chimneySide: -1 });
  house(deco, { ...at(332, 19), w: 4, d: 3.6, floors: 1, wall: '#f4e8d0', thatch: true, door: '#5a3a6a', shutters: '#c0563c', flowers: true, pitch: 0.78, tilt: 0.02 });
  // l'enseigne et la terrasse de l'auberge
  {
    const f = grp(inn, 0, 0, 2.7 + 0.35);
    put(f, new THREE.PlaneGeometry(2.8, 0.7), std('innSign', { map: T.innSign(), roughness: 0.8, side: THREE.DoubleSide }), 0, 2.5, 1.48);
    put(f, bx(2.95, 0.08, 0.06), M.beam(), 0, 2.88, 1.46);
    put(f, bx(4.4, 0.12, 1.5), M.tiles('#a8473a'), 0, 2.15, 0.7, 0.25);
    for (const s of [1, -1]) put(f, bx(0.14, 2.1, 0.14), M.beam(), s * 2, 1.05, 1.35);
    for (const s of [1, -1]) { const t = grp(f, s * 3.3, 0, 2.6); put(t, new THREE.CylinderGeometry(0.55, 0.55, 0.07, 16), M.wood('#a07650'), 0, 0.78, 0); put(t, new THREE.CylinderGeometry(0.07, 0.12, 0.76, 8), M.wood('#7a5638'), 0, 0.38, 0); for (const [x, z] of [[0.2, 0.1], [-0.15, -0.2]]) { put(t, new THREE.CylinderGeometry(0.07, 0.065, 0.16, 10), M.wood('#c8a070'), x, 0.9, z); put(t, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), M.plain('#fff6e0'), x, 0.985, z); } for (const a of [0.8, 2.6, 4.4]) put(t, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), M.wood('#a07650'), Math.sin(a) * 0.9, 0.45, Math.cos(a) * 0.9); }
    for (const [x, z] of [[-4.6, 0.6], [-4.7, 1.4], [4.7, 0.9]]) { const b = grp(f, x, 0, z); put(b, new THREE.LatheGeometry([[0.3, 0], [0.36, 0.42], [0.3, 0.84]].map(([r, y]) => new THREE.Vector2(r, y)), 14), M.wood('#9a6a40')); for (const y of [0.15, 0.69]) put(b, new THREE.TorusGeometry(0.34, 0.02, 4, 16), M.iron(), 0, y, 0, Math.PI / 2); }
    // potirons sculptés qui s'allument la nuit
    for (const s of [1, -1]) { const p = grp(f, s * 1.35, 0, 0.8, s * 0.3); put(p, new THREE.SphereGeometry(0.28, 14, 10), M.plain('#e8761e', { roughness: 0.6 }), 0, 0.22, 0, 0, 0, 0, 1, 0.78, 1); put(p, new THREE.CylinderGeometry(0.03, 0.05, 0.12, 6), M.plain('#4f6a2a'), 0, 0.46, 0); for (const x of [-0.09, 0.09]) put(p, new THREE.ConeGeometry(0.05, 0.08, 3), PUMPKIN, x, 0.28, 0.255, Math.PI / 2, 0, Math.PI); put(p, bx(0.18, 0.05, 0.03), PUMPKIN, 0, 0.14, 0.26); }
  }
  // étal du marché, charrette de foin, panneau « Recherché », tas de bois, caisses, potirons
  {
    const p = at(348, 15.2), g = grp(deco, p.x, 0, p.z, p.ry);
    put(g, bx(2.6, 0.1, 1.1), M.wood('#a07650'), 0, 0.9, 0);
    for (const [x, z] of [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]]) put(g, bx(0.1, z < 0 ? 2.4 : 2.1, 0.1), M.beam(), x, z < 0 ? 1.2 : 1.05, z);
    put(g, bx(2.9, 0.06, 1.5, 0.5), std('stripes', { map: T.stripes(), side: THREE.DoubleSide }), 0, 2.28, 0.05, -0.22);
    for (let k = 0; k < 14; k++) put(g, new THREE.SphereGeometry(0.075, 8, 6), M.plain(k % 3 ? '#c8282a' : '#e8c030', { roughness: 0.4 }), -1 + (k % 7) * 0.12, 1.0 + Math.floor(k / 7) * 0.08, 0.2 + Math.floor(k / 7) * 0.1);
    put(g, bx(0.7, 0.25, 0.5), M.wood('#c49a6a'), 0.75, 1.07, 0.1);
    for (let k = 0; k < 3; k++) put(g, new THREE.SphereGeometry(0.2, 12, 8), M.plain('#e8761e', { roughness: 0.6 }), -0.7 + k * 0.5, 0.2, 0.8 + (k % 2) * 0.2, 0, 0, 0, 1, 0.75, 1);
  }
  {
    const p = at(100, 15.3), g = grp(deco, p.x, 0, p.z, p.ry + 1.2);
    put(g, bx(2.2, 0.15, 1.3), M.wood('#9a7048'), 0, 0.75, 0);
    for (const s of [1, -1]) put(g, bx(2.2, 0.35, 0.08), M.wood('#9a7048'), 0, 0.95, s * 0.62);
    for (const [x, z] of [[-0.6, 0.72], [-0.6, -0.72]]) { put(g, new THREE.TorusGeometry(0.45, 0.06, 6, 18), M.wood('#6a4a30'), x, 0.45, z); put(g, new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), M.iron(), x, 0.45, z, Math.PI / 2); }
    put(g, bx(0.08, 0.08, 1.6), M.wood('#6a4a30'), 1.6, 0.6, 0.3, 0, 0.3, 0.2);
    for (const [x, y] of [[-0.45, 1.15], [0.45, 1.15], [0, 1.55]]) put(g, bx(0.8, 0.42, 0.55, 0.6), M.thatch(), x, y, 0);
  }
  {
    const p = at(258, 14.6), g = grp(deco, p.x, 0, p.z, p.ry);
    for (const s of [1, -1]) put(g, bx(0.12, 2.1, 0.12), M.beam(), s * 0.75, 1.05, 0);
    put(g, bx(1.7, 1.1, 0.08, 0.7), M.wood('#8a6448'), 0, 1.35, 0);
    put(g, bx(1.9, 0.1, 0.4), M.tiles('#6a5a4a'), 0, 2.05, 0, 0.3);
    put(g, new THREE.PlaneGeometry(0.62, 0.62), std('poster', { map: T.poster(), roughness: 1 }), -0.38, 1.38, 0.05, 0, 0, 0.04);
    put(g, new THREE.PlaneGeometry(0.5, 0.36), M.plain('#f2e6c8'), 0.45, 1.5, 0.05, 0, 0, -0.06);
    put(g, new THREE.PlaneGeometry(0.4, 0.3), M.plain('#e6d0a0'), 0.4, 1.12, 0.05, 0, 0, 0.08);
  }
  {
    const p = at(196, 15.6), g = grp(deco, p.x, 0, p.z, p.ry);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6 - r; k++) put(g, new THREE.CylinderGeometry(0.13, 0.13, 1.1, 8), M.bark(), -0.65 + k * 0.27 + r * 0.135, 0.13 + r * 0.23, 0, 0, 0, Math.PI / 2);
    for (const [x, z, s] of [[1.4, 0.2, 0.55], [1.9, -0.3, 0.45], [1.6, 0.2, 0.45]]) put(g, bx(s, s, s, 0.5), M.wood('#c49a6a'), x, s / 2 + (x === 1.6 ? 0.55 : 0), z, 0, x);
  }
  // clôtures de jardins
  for (const [d0, d1] of [[40, 52], [68, 82], [128, 142], [218, 232], [282, 292], [312, 324]]) {
    const r = 16.6;
    for (let d = d0; d <= d1; d += 1.6) { const a = (d * Math.PI) / 180; put(deco, bx(0.1, 0.8, 0.08), M.wood('#c8b090'), Math.sin(a) * r, 0.4, Math.cos(a) * r, 0, a); put(deco, new THREE.ConeGeometry(0.07, 0.12, 4), M.wood('#c8b090'), Math.sin(a) * r, 0.86, Math.cos(a) * r, 0, a + Math.PI / 4); }
    for (const y of [0.3, 0.6]) { const a0 = (d0 * Math.PI) / 180, a1 = (d1 * Math.PI) / 180; const pts = Array.from({ length: 9 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 8; return new THREE.Vector3(Math.sin(a) * (r - 0.06), y, Math.cos(a) * (r - 0.06)); }); put(deco, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 4), M.wood('#b09a7a')); }
  }
  // grands arbres d'automne dans le village
  const hero = (deg, r, s, cols) => {
    const p = at(deg, r), g = grp(deco, p.x, 0, p.z, rnd() * TAU), bark = M.bark();
    put(g, new THREE.CylinderGeometry(0.28 * s, 0.5 * s, 3.2 * s, 10), bark, 0, 1.6 * s, 0);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; put(g, new THREE.CylinderGeometry(0.1 * s, 0.18 * s, 1.8 * s, 6), bark, Math.sin(a) * 0.5 * s, 3 * s, Math.cos(a) * 0.5 * s, Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7); }
    for (let k = 0; k < 9; k++) { const a = rnd() * TAU, d = between(0.4, 1.8) * s; put(g, new THREE.IcosahedronGeometry(between(1.0, 1.5) * s, 1), M.plain(cols[k % cols.length], { flatShading: true, roughness: 0.85 }), Math.sin(a) * d, between(3.6, 5.2) * s, Math.cos(a) * d); }
    for (let k = 0; k < 5; k++) { const a = rnd() * TAU; put(g, new THREE.SphereGeometry(between(0.25, 0.4), 6, 5), M.plain('#3e2a1c'), Math.sin(a) * 0.5 * s, 0.1, Math.cos(a) * 0.5 * s, 0, 0, 0, 1.6, 0.4, 0.8); }
    return { x: p.x, z: p.z, top: 4.6 * s };
  };
  const heroes = [hero(286, 15.9, 1.15, ['#e8892e', '#d8602a', '#f2b33a']), hero(73, 16.7, 0.95, ['#c8392e', '#e0582e', '#a82a2a']), hero(228, 25, 1.1, ['#e8b43a', '#d89a2a', '#c8c040']), hero(140, 25, 0.9, ['#d8602a', '#e8a13a'])];
  // champignons au pied de la forêt
  for (let k = 0; k < 18; k++) { const a = rnd() * TAU, r = between(26, 31), g = grp(deco, Math.sin(a) * r, heightAt(Math.sin(a) * r, Math.cos(a) * r), Math.cos(a) * r); const s = between(0.6, 1.3); put(g, new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.22 * s, 6), M.plain('#f4ead6'), 0, 0.11 * s, 0); put(g, new THREE.SphereGeometry(0.14 * s, 10, 6, 0, TAU, 0, Math.PI / 2), M.plain('#d8322a', { roughness: 0.5 }), 0, 0.2 * s, 0); for (let i = 0; i < 4; i++) put(g, new THREE.SphereGeometry(0.022 * s, 5, 4), M.plain('#ffffff'), Math.sin(i * 1.7) * 0.08 * s, 0.31 * s, Math.cos(i * 1.7) * 0.08 * s); }
  // rochers
  for (let k = 0; k < 40; k++) { const a = rnd() * TAU, r = between(15, 34), x = Math.sin(a) * r, z = Math.cos(a) * r; if (Math.abs(Math.atan2(x, z)) < 0.15) continue; put(deco, new THREE.IcosahedronGeometry(between(0.2, 0.7), 0), M.plain('#9a958a', { flatShading: true }), x, heightAt(x, z) + 0.05, z, rnd(), rnd(), rnd(), 1, between(0.5, 0.8), 1); }
  // montagnes au loin
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + between(-0.1, 0.1), r = between(190, 240); put(deco, new THREE.ConeGeometry(between(45, 80), between(40, 80), 7), M.plain('#55657e', { flatShading: true, roughness: 1 }), Math.sin(a) * r, 10, Math.cos(a) * r, 0, rnd()); }
  const baked = bake(deco);
  scene.add(baked);
  for (const c of CHIMNEYS) { c.pos = c.obj.localToWorld(new THREE.Vector3(0, c.top, 0)); }

  /* ---- Végétation en grand nombre (instances) ---- */
  const inst = (geo, mat, list, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0); o.scale.set(t.s, t.sy ?? t.s, t.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (t.c) m.setColorAt(i, new THREE.Color(t.c)); });
    m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
  };
  const freeSpot = (x, z) => { const r = Math.hypot(x, z), a = Math.atan2(x, z); return !(r < 75 && Math.abs(a) < 0.1 + 2 / r) && r > 13.6; };
  {
    const pines = [], broad = [];
    for (let k = 0; k < 520; k++) {
      const a = rnd() * TAU, r = 29 + Math.pow(rnd(), 1.4) * 70, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!freeSpot(x, z)) continue;
      const t = { x, z, y: heightAt(x, z), s: between(0.8, 1.6) * (1 + r / 160), ry: rnd() * TAU };
      if (rnd() < 0.62) pines.push({ ...t, c: new THREE.Color().setHSL(between(0.38, 0.45), between(0.3, 0.45), between(0.24, 0.34)) });
      else broad.push({ ...t, c: new THREE.Color().setHSL(between(0.02, 0.13), between(0.6, 0.8), between(0.42, 0.55)) });
    }
    for (let k = 0; k < 30; k++) { const a = rnd() * TAU, r = between(24.5, 29), x = Math.sin(a) * r, z = Math.cos(a) * r; if (freeSpot(x, z) && !(Math.abs(((a * 180) / Math.PI + 360) % 360 - 245) < 14)) broad.push({ x, z, y: heightAt(x, z), s: between(0.7, 1), ry: rnd() * TAU, c: new THREE.Color().setHSL(between(0.03, 0.12), 0.7, 0.5) }); }
    const pineG = mergeGeometries([new THREE.ConeGeometry(1.5, 2.2, 8).translate(0, 2.1, 0), new THREE.ConeGeometry(1.15, 1.9, 8).translate(0, 3.2, 0), new THREE.ConeGeometry(0.75, 1.6, 8).translate(0, 4.2, 0)].map(g => g.toNonIndexed()));
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 1.4, 6).translate(0, 0.7, 0);
    inst(pineG, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }), pines);
    inst(trunkG, M.bark(), [...pines, ...broad].map(t => ({ ...t, c: null, sy: t.s * 1.3 })));
    const crown = mergeGeometries([[0, 2.7, 0, 1.3], [0.7, 2.3, 0.3, 0.9], [-0.6, 2.4, -0.2, 1.0], [0.1, 3.3, -0.3, 0.9]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
    inst(crown, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }), broad);
    // buissons, touffes d'herbe, fleurs, feuilles mortes
    const bushes = [], tufts = [], flowers = [], leaves = [];
    for (let k = 0; k < 140; k++) { const a = rnd() * TAU, r = between(13.8, 30), x = Math.sin(a) * r, z = Math.cos(a) * r; if (freeSpot(x, z) && (r < 17 || r > 23)) bushes.push({ x, z, y: heightAt(x, z) + 0.15, s: between(0.4, 0.85), sy: between(0.3, 0.6), ry: rnd() * TAU, c: new THREE.Color().setHSL(rnd() < 0.3 ? between(0.0, 0.06) : between(0.22, 0.32), 0.5, between(0.3, 0.42)) }); }
    for (let k = 0; k < 3200; k++) { const a = rnd() * TAU, r = 13.6 + Math.pow(rnd(), 1.3) * 40, x = Math.sin(a) * r, z = Math.cos(a) * r; if (freeSpot(x, z)) tufts.push({ x, z, y: heightAt(x, z), s: between(0.6, 1.3), ry: rnd() * TAU, c: new THREE.Color().setHSL(between(0.17, 0.27), 0.45, between(0.3, 0.48)) }); }
    for (let k = 0; k < 70; k++) { const a = rnd() * TAU, r = between(13.8, 17), cx = Math.sin(a) * r, cz = Math.cos(a) * r, col = ['#ff5a6a', '#ffd23f', '#ffffff', '#b07aff', '#ff8a3d', '#ff8acb'][k % 6]; if (!freeSpot(cx, cz)) continue; for (let i = 0; i < 7; i++) { const x = cx + between(-0.6, 0.6), z = cz + between(-0.6, 0.6); flowers.push({ x, z, y: heightAt(x, z) + between(0.12, 0.25), s: between(0.8, 1.2), c: col }); } }
    for (let k = 0; k < 900; k++) { const a = rnd() * TAU, r = between(9, 34), x = Math.sin(a) * r, z = Math.cos(a) * r; leaves.push({ x, z, y: (r < 13 ? 0.04 : heightAt(x, z)) + 0.035, s: between(0.7, 1.3), rx: -Math.PI / 2, rz: rnd() * TAU, c: new THREE.Color().setHSL(between(0.0, 0.12), 0.75, between(0.4, 0.55)) }); }
    inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }), bushes);
    const blade = mergeGeometries([0, 1.05, 2.1].map(a => new THREE.ConeGeometry(0.06, 0.38, 3).translate(Math.sin(a) * 0.05, 0.19, Math.cos(a) * 0.05).rotateZ(Math.sin(a) * 0.25).toNonIndexed()));
    inst(blade, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), tufts, false);
    inst(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.6 }), flowers, false);
    inst(new THREE.CircleGeometry(0.09, 5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), leaves.map(l => ({ ...l, sy: l.s * 0.6 })), false);
  }

  /* ---- Ciel : dégradé, soleil, lune, étoiles, nuages ---- */
  const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 0.4 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bot, sunCol, sunDir; uniform float glow; varying vec3 vP;
      void main(){ vec3 d = normalize(vP); float h = d.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.7)) : mix(mid, bot, pow(clamp(-h * 3.0, 0.0, 1.0), 0.5));
        float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * glow;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry(), starPts = [];
  for (let k = 0; k < 1400; k++) { const a = rnd() * TAU, y = Math.pow(rnd(), 0.6), r = Math.sqrt(1 - y * y); starPts.push(Math.cos(a) * r * 450, y * 450 + 10, Math.sin(a) * r * 450); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff8e8', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  const glowTex = paint('glow', 128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  const moonTex = paint('moon', 128, (x, n) => { x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(n / 2, n / 2, n / 2 - 2, 0, TAU); x.fill(); for (let k = 0; k < 9; k++) { x.fillStyle = 'rgba(190,170,140,.35)'; x.beginPath(); x.arc(between(25, 100), between(25, 100), between(5, 14), 0, TAU); x.fill(); } });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false, color: new THREE.Color(2.2, 2.1, 1.8) }));
  moon.scale.setScalar(26);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, color: '#9fb0ff' }));
  moonHalo.scale.setScalar(120);
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(3, 2.6, 2) }));
  sunDisc.scale.setScalar(70);
  scene.add(moon, moonHalo, sunDisc);
  const clouds = new THREE.Group(), cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, fog: false, emissive: '#5a6aa0', emissiveIntensity: 0.15 });
  for (let k = 0; k < 14; k++) {
    const parts = [];
    for (let i = 0; i < 6; i++) parts.push(new THREE.IcosahedronGeometry(between(5, 9), 1).translate(between(-12, 12), between(-1, 3), between(-5, 5)));
    const c = new THREE.Mesh(mergeGeometries(parts), cloudMat), a = rnd() * TAU, r = between(170, 260);
    c.position.set(Math.sin(a) * r, between(70, 110), Math.cos(a) * r); c.scale.y = 0.55; c.lookAt(0, c.position.y, 0);
    clouds.add(c);
  }
  scene.add(clouds);

  /* ---- Lumières des lanternes ---- */
  const lamps = lampPos.slice(0, 6).map(p => { const l = new THREE.PointLight('#ffb35e', 0, 13, 1.6); l.position.copy(p); scene.add(l); return l; });
  const doorLights = [at(180, 16.6), at(60, 16.8)].map(p => { const l = new THREE.PointLight('#ff9a4a', 0, 9, 1.6); l.position.set(p.x, 1.8, p.z); scene.add(l); return l; });
  const lampHalos = lampPos.map(p => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffb35e', opacity: 0 })); s.position.copy(p); s.scale.setScalar(2.2); scene.add(s); return s; });

  /* ---- Eau de la fontaine ---- */
  const rip = T.ripple().clone(); rip.repeat.set(2, 2); rip.needsUpdate = true;
  const waterMat = new THREE.MeshStandardMaterial({ color: '#7fc8dc', map: rip, roughness: 0.08, metalness: 0.1, emissive: '#0b3c4a', emissiveIntensity: 0.6, transparent: true, opacity: 0.88 });
  put(scene, new THREE.CylinderGeometry(1.93, 1.93, 0.04, 8), waterMat, 0, 0.52, 0);
  put(scene, new THREE.CylinderGeometry(0.82, 0.82, 0.03, 16), waterMat, 0, 1.63, 0);

  /* ---- Particules : une seule nuée pour tout (larmes, fumée, cœurs, étoiles, eau, lucioles, feuilles…) ---- */
  const MAXP = 1400;
  const atlas = paint('atlas', 512, (x, w) => {
    const c = w / 4;
    const cell = (k, fn) => { x.save(); x.translate((k % 4) * c, Math.floor(k / 4) * c); fn(c); x.restore(); };
    cell(0, n => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    cell(1, n => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(n / 2, n * 0.12); x.bezierCurveTo(n * 0.75, n * 0.45, n * 0.8, n * 0.62, n / 2, n * 0.85); x.bezierCurveTo(n * 0.2, n * 0.62, n * 0.25, n * 0.45, n / 2, n * 0.12); x.fill(); });
    cell(2, n => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(n / 2, n * 0.82); x.bezierCurveTo(n * 0.05, n * 0.5, n * 0.2, n * 0.1, n / 2, n * 0.32); x.bezierCurveTo(n * 0.8, n * 0.1, n * 0.95, n * 0.5, n / 2, n * 0.82); x.fill(); });
    cell(3, n => { x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, r = k % 2 ? n * 0.18 : n * 0.44; x.lineTo(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r); } x.fill(); });
    cell(4, n => { for (let k = 0; k < 7; k++) { const X = n * between(0.3, 0.7), Y = n * between(0.35, 0.65), r = n * between(0.14, 0.24), g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } });
    cell(5, n => { x.fillStyle = '#fff'; x.font = `bold ${n * 0.75}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', n / 2, n / 2); });
    cell(6, n => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(n / 2, n / 2, n * 0.4, n * 0.2, 0.6, 0, TAU); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(n * 0.2, n * 0.7); x.lineTo(n * 0.8, n * 0.3); x.stroke(); });
    cell(7, n => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.15, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = '#fff'; x.fillRect(n / 2 - 2, n * 0.1, 4, n * 0.8); x.fillRect(n * 0.1, n / 2 - 2, n * 0.8, 4); });
  }, 256);
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP), pCol = new Float32Array(MAXP * 3), pCell = new Float32Array(MAXP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aCell', new THREE.BufferAttribute(pCell, 1));
  const pU = { map: { value: atlas }, scale: { value: 400 } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize, aAlpha, aCell; attribute vec3 aColor; uniform float scale; varying float vA, vCell; varying vec3 vC;
      void main(){ vA = aAlpha; vC = aColor; vCell = aCell; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA, vCell; varying vec3 vC;
      void main(){ vec2 uv = vec2((mod(vCell, 4.0) + gl_PointCoord.x) / 4.0, 1.0 - (floor(vCell / 4.0) + gl_PointCoord.y) / 2.0); vec4 t = texture2D(map, uv);
        gl_FragColor = vec4(vC * t.rgb, t.a * vA); if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
  const parts = [];
  const CELL = { dot: 0, drop: 1, heart: 2, star: 3, puff: 4, note: 5, leaf: 6, spark: 7 };
  const col = new THREE.Color();
  function emit(cell, pos, o = {}) {
    if (parts.length >= MAXP) return;
    parts.push({ cell: CELL[cell], x: pos.x, y: pos.y, z: pos.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, g: o.g ?? 0, life: o.life ?? 1, max: o.life ?? 1, size: o.size ?? 0.2, grow: o.grow ?? 0, col: col.set(o.color ?? '#ffffff').clone(), alpha: o.alpha ?? 1, wob: o.wob ?? 0, ph: rnd() * TAU, drag: o.drag ?? 0, fadeIn: o.fadeIn ?? 0 });
  }
  // Effets nommés, utilisés par les personnages et les objets lancés.
  function spawn(kind, p, o = {}) {
    const r = (a = 1) => (Math.random() - 0.5) * a;
    if (kind === 'drop') emit('drop', p, { vx: o.vx * 0.6 + r(0.3), vy: 1.2, vz: r(0.3), g: 6, life: 0.7, size: 0.09, color: '#7fd0ff' });
    if (kind === 'puff') emit('puff', p, { vx: r(0.4), vy: 1.1, vz: r(0.4), life: 0.9, size: 0.3, grow: 0.6, color: o.grey ? '#dddddd' : '#ffffff', alpha: 0.8 });
    if (kind === 'heart') emit('heart', p, { vx: r(0.8), vy: 1.2 + (o.k ?? 0) * 0.3, vz: 0.6 + r(0.4), life: 1.4, size: 0.24, color: '#ff4f7a', drag: 0.8 });
    if (kind === 'star') emit('star', p, { vx: Math.cos(o.a) * 0.9, vy: 0.3, vz: Math.sin(o.a) * 0.9, life: 0.6, size: 0.17, color: '#ffe14a' });
    if (kind === 'note') emit('note', p, { vx: r(0.8), vy: 0.9, vz: r(0.8), life: 1.1, size: 0.28, color: o.laugh ? '#ffd23f' : '#ff8acb' });
    if (kind === 'dust') for (let k = 0; k < 10; k++) emit('puff', { x: p.x + r(0.8), y: 0.15, z: p.z + r(0.8) }, { vx: r(2), vy: 0.4, vz: r(2), life: 0.8, size: 0.4, grow: 0.8, color: '#c8b08a', alpha: 0.7, drag: 2 });
    if (kind === 'splash') {
      const c = { tomate: '#d8261a', oeuf: '#ffe070', chou: '#7cc25a', poisson: '#a8e0ff', chaussure: '#ffe14a', rose: '#ff4f7a', fleche: '#ffffff' }[o.item];
      for (let k = 0; k < 16; k++) emit(o.item === 'rose' ? 'heart' : o.item === 'chou' ? 'leaf' : o.item === 'chaussure' ? 'star' : 'drop', p, { vx: r(3), vy: Math.random() * 2.5, vz: r(3), g: o.item === 'rose' ? -0.5 : 7, life: 0.9, size: o.item === 'rose' ? 0.18 : 0.11, color: c });
    }
    if (kind === 'poof') for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU; emit('puff', { x: p.x, y: 0.3 + Math.random() * 1.2, z: p.z }, { vx: Math.cos(a) * 1.6, vy: 0.4 + Math.random(), vz: Math.sin(a) * 1.6, life: 1.4, size: 0.6, grow: 1.2, color: o.color ?? '#e8e4ff', alpha: 0.85, drag: 1.5 }); }
    if (kind === 'sparkle') for (let k = 0; k < 30; k++) emit('spark', { x: p.x + r(1), y: 0.2 + Math.random() * 2, z: p.z + r(1) }, { vy: 0.6 + Math.random(), life: 1.2 + Math.random(), size: 0.22, color: o.color ?? '#bfe0ff' });
    if (kind === 'confetti') for (let k = 0; k < 60; k++) emit('leaf', { x: p.x + r(4), y: 4 + Math.random() * 2, z: p.z + r(4) }, { vx: r(1), vy: -0.5, g: 0.6, wob: 2, life: 3, size: 0.2, color: ['#e8543c', '#f2c230', '#3d8bff', '#2fb36a', '#a46bff'][k % 5] });
  }

  /* ---- Personnages ---- */
  const chars = new Map(); // pseudo -> { ch, key }
  const charGroup = new THREE.Group(); scene.add(charGroup);
  const flights = [], delayed = [];
  function syncPlayers(players) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.name);
      const key = `${p.look?.join(',')}|${p.color}`, cur = chars.get(p.name);
      if (cur?.key === key) continue;
      const ch = makeCharacter(p.look ?? LG.randomLook(), p.color);
      if (cur) { ch.root.position.copy(cur.ch.root.position); ch.root.rotation.y = cur.ch.root.rotation.y; charGroup.remove(cur.ch.root); }
      ch.root.traverse(o => { if (o.isMesh && o.material !== undefined) o.userData.who = p.name; });
      charGroup.add(ch.root);
      chars.set(p.name, { ch, key, state: {} });
    }
    for (const [n, c] of chars) if (!seen.has(n)) { charGroup.remove(c.ch.root); chars.delete(n); }
  }
  // État voulu d'un personnage pour cette image (position déjà lissée par l'appelant)
  function place(name, s) { const c = chars.get(name); if (c) c.state = s; }
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  function emote(name, e, to, t) { const c = chars.get(name); if (c && !c.ch.ghost) play(c.ch, e, t, to); }
  function talk(name, t, sec) { const c = chars.get(name); if (c) c.ch.talkUntil = t + sec; }
  function poof(name, color) { const c = chars.get(name); if (c) { spawn('poof', c.ch.root.position, { color }); spawn('sparkle', c.ch.root.position); } }
  // Un objet lancé : le lanceur arme son bras, l'objet vole en cloche jusqu'à la tête de la cible, puis splash.
  function toss(from, to, item, t, onHit) {
    const a = chars.get(from), b = chars.get(to);
    if (!a || !b) return;
    play(a.ch, 'lancer', t, to);
    delayed.push({ at: t + 0.24, go: () => {
      const start = a.ch.arms[1].a.localToWorld(new THREE.Vector3(0, -0.36, 0)), mesh = makeItem(item);
      mesh.position.copy(start); scene.add(mesh);
      const d = start.distanceTo(b.ch.root.position);
      flights.push({ mesh, start, to: b, item, t0: t, dur: 0.42 + d * 0.035, h: 0.6 + d * 0.12, spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 6), onHit, began: null });
    } });
  }
  function pick(cx, cy) {
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = [...chars.entries()].filter(([, c]) => c.ch.root.visible).map(([n, c]) => ({ n, o: c.ch.hit }));
    const res = ray.intersectObjects(hits.map(h => h.o), false)[0];
    return res ? hits.find(h => h.o === res.object).n : null;
  }
  function mark(name, kind) {
    for (const [n, c] of chars) {
      const k = n === name ? kind : c.mark;
      if (n === name) c.mark = kind;
      const r = c.ch.ring;
      r.material.color.set(k === 'target' ? '#ff3b30' : k === 'hover' ? '#ffffff' : c.key.split('|')[1]);
      r.material.opacity = k ? 0.95 : 0.55;
    }
  }
  const tmp = new THREE.Vector3();
  function headAt(name, out = new THREE.Vector3()) { const c = chars.get(name); if (!c) return null; return c.ch.head.localToWorld(out.set(0, 0.85, 0)); }
  function project(v) { tmp.copy(v).project(camera); return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, ok: tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 }; }

  /* ---- Jour et nuit ---- */
  // k : 0 plein jour, 0.45 soleil couchant, 0.62 crépuscule, 1 nuit noire.
  const PAL = [
    { k: 0, top: '#3f8fd8', mid: '#9dd0ee', bot: '#e8dcc0', fog: '#bcd6df', light: '#fff1da', li: 2.9, hs: '#d8ecff', hg: '#7a6a48', hi: 1.15, exp: 1.0, el: 1.0, az: 0.55, star: 0, lamp: 0, fogN: 45, fogF: 230, bloom: 0.22 },
    { k: 0.45, top: '#4c5aa8', mid: '#f2a07a', bot: '#ffd29a', fog: '#e6a78a', light: '#ffb070', li: 2.4, hs: '#ffd2b0', hg: '#5a4050', hi: 0.9, exp: 1.05, el: 0.25, az: 1.15, star: 0.03, lamp: 0.35, fogN: 35, fogF: 190, bloom: 0.35 },
    { k: 0.62, top: '#1e2560', mid: '#80487e', bot: '#e47c58', fog: '#6a4a72', light: '#ff8a5a', li: 1.1, hs: '#a07ab8', hg: '#2a2030', hi: 0.65, exp: 1.08, el: 0.08, az: 1.3, star: 0.4, lamp: 0.8, fogN: 26, fogF: 150, bloom: 0.5 },
    { k: 1, top: '#040920', mid: '#111b48', bot: '#232a5e', fog: '#131a3c', light: '#a7baff', li: 0.85, hs: '#4a5aa8', hg: '#151524', hi: 0.48, exp: 1.15, el: 0.85, az: -0.7, star: 1, lamp: 1, fogN: 18, fogF: 120, bloom: 0.62 },
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const lerpC = (a, b, f, out) => out.copy(ca.set(a)).lerp(cb.set(b), f);
  const env = { k: 0.3, target: 0.3, speed: 0.25 };
  const night = () => smooth(0.5, 1, env.k);
  function applyTime() {
    const k = env.k;
    let i = 0; while (i < PAL.length - 2 && k > PAL[i + 1].k) i++;
    const A = PAL[i], B = PAL[i + 1], f = Math.max(0, Math.min(1, (k - A.k) / (B.k - A.k))), L = key => A[key] + (B[key] - A[key]) * f;
    lerpC(A.top, B.top, f, skyU.top.value); lerpC(A.mid, B.mid, f, skyU.mid.value); lerpC(A.bot, B.bot, f, skyU.bot.value);
    lerpC(A.fog, B.fog, f, scene.fog.color); scene.fog.near = L('fogN'); scene.fog.far = L('fogF');
    lerpC(A.light, B.light, f, sun.color); sun.intensity = L('li');
    lerpC(A.hs, B.hs, f, hemi.color); lerpC(A.hg, B.hg, f, hemi.groundColor); hemi.intensity = L('hi');
    renderer.toneMappingExposure = L('exp');
    const el = L('el'), az = L('az'), dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sun.position.copy(dir).multiplyScalar(80);
    skyU.sunDir.value.copy(dir); skyU.sunCol.value.copy(sun.color); skyU.glow.value = 1 - night() * 0.6;
    const n = night(), lamp = L('lamp');
    stars.material.opacity = L('star');
    moon.position.copy(dir).multiplyScalar(420); moonHalo.position.copy(moon.position);
    moon.material.opacity = smooth(0.7, 1, k); moonHalo.material.opacity = smooth(0.7, 1, k) * 0.35;
    sunDisc.position.copy(dir).multiplyScalar(430); sunDisc.material.opacity = 1 - smooth(0.5, 0.7, k);
    cloudMat.emissiveIntensity = 0.15 + n * 0.1;
    for (const l of lamps) l.intensity = lamp * 9;
    for (const l of doorLights) l.intensity = lamp * 6;
    for (const h of lampHalos) h.material.opacity = lamp * 0.8;
    for (const g of GLOW) g.m.emissiveIntensity = g.curve(k, 1);
    if (bloom) bloom.strength = L('bloom');
  }

  /* ---- Yeux de loups dans la forêt (la nuit) ---- */
  const eyes = [];
  const eyeMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 0.5), transparent: true, opacity: 0, fog: false });
  for (let k = 0; k < 9; k++) {
    let a; do a = rnd() * TAU; while (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.25);
    const r = between(29, 34), g = new THREE.Group(), m = eyeMat();
    for (const s of [1, -1]) put(g, new THREE.SphereGeometry(0.07, 8, 6), m, s * 0.13, 0, 0, 0, 0, 0, 1.3, 0.8, 0.5);
    g.position.set(Math.sin(a) * r, heightAt(Math.sin(a) * r, Math.cos(a) * r) + between(0.6, 1.1), Math.cos(a) * r);
    g.lookAt(0, g.position.y, 0); scene.add(g);
    eyes.push({ g, m, ph: rnd() * 30, per: between(9, 17) });
  }

  /* ---- Rendu ---- */
  let composer = null, bloom = null, quality = 'high';
  function setQuality(q) {
    quality = q;
    renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'high' ? 1.75 : 1));
    renderer.shadowMap.enabled = q === 'high';
    sun.castShadow = q === 'high';
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    if (q === 'high' && !composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.4, 0.55, 0.82);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer?.setSize(w, h); composer?.setPixelRatio(renderer.getPixelRatio());
    pU.scale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  // Caméra : un point visé, un angle, une distance ; tout se rejoint en douceur.
  const cam = { yaw: 0.4, pitch: 0.35, dist: 16, target: new THREE.Vector3(0, 1, 0), want: new THREE.Vector3(0, 1, 0), wantDist: 16, smooth: 3 };
  const camPos = new THREE.Vector3(0, 8, 20);

  let smokeAt = 0, waterAt = 0, leafAt = 0, flyAt = 0;
  function update(dt, t) {
    env.k += Math.sign(env.target - env.k) * Math.min(Math.abs(env.target - env.k), dt * env.speed);
    applyTime();
    const n = night();
    // personnages
    for (const [, c] of chars) {
      const s = c.state, ch = c.ch, r = ch.root;
      r.visible = s.visible !== false;
      if (!r.visible) continue;
      setGhost(ch, !!s.ghost);
      if (s.x !== undefined) { r.position.x = s.x; r.position.z = s.z; }
      let yaw = s.ry ?? r.rotation.y;
      const target = ch.emote?.target && chars.get(ch.emote.target);
      if (target) yaw = yawTo(r.position, target.ch.root.position);
      let dy = yaw - r.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.rotation.y += dy * (1 - Math.exp(-dt * 12));
      animate(ch, dt, t, s, spawn);
    }
    // objets lancés
    for (const d of delayed.filter(d => t >= d.at)) { delayed.splice(delayed.indexOf(d), 1); d.go(); }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.began ??= t;
      const u = Math.min(1, (t - f.began) / f.dur), end = f.to.ch.head.localToWorld(tmp.set(0, 0.3, 0.15));
      f.mesh.position.lerpVectors(f.start, end, u); f.mesh.position.y += f.h * 4 * u * (1 - u);
      if (f.item === 'fleche') f.mesh.lookAt(end); else { f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt; }
      if (u >= 1) {
        scene.remove(f.mesh);
        hitBy(f.to.ch, f.item, t); splat(f.to.ch, f.item);
        spawn('splash', end, { item: f.item });
        f.onHit?.(f.item);
        flights.splice(i, 1);
      }
    }
    // fumée des cheminées, eau de la fontaine, feuilles qui tombent, lucioles
    if (t > smokeAt) { smokeAt = t + 0.18; for (const c of CHIMNEYS) if (c.pos) emit('puff', c.pos, { vx: 0.25 + rnd() * 0.2, vy: 0.6, vz: (rnd() - 0.5) * 0.2, life: 3.5, size: 0.5, grow: 0.9, color: n > 0.5 ? '#3c4060' : '#e8e4e0', alpha: 0.42 - n * 0.2, drag: 0.1 }); }
    if (t > waterAt) { waterAt = t + 0.03; for (let k = 0; k < 2; k++) { const a = rnd() * TAU; emit('drop', { x: Math.sin(a) * 0.95, y: 1.72, z: Math.cos(a) * 0.95 }, { vx: Math.sin(a) * 0.9, vy: 0.4, vz: Math.cos(a) * 0.9, g: 7, life: 0.5, size: 0.07, color: '#cfefff', alpha: 0.7 }); } }
    if (t > leafAt) { leafAt = t + 0.25; const h = heroes[Math.floor(rnd() * heroes.length)]; emit('leaf', { x: h.x + (rnd() - 0.5) * 4, y: h.top, z: h.z + (rnd() - 0.5) * 4 }, { vx: (rnd() - 0.5) * 0.6, vy: -0.4, g: 0.15, wob: 1.8, life: 7, size: 0.18, color: ['#e8892e', '#d8602a', '#f2b33a', '#c8392e'][Math.floor(rnd() * 4)], drag: 0.3 }); }
    if (n > 0.3 && t > flyAt) { flyAt = t + 0.12 / n; const a = rnd() * TAU, r = 10 + rnd() * 22; emit('dot', { x: Math.sin(a) * r, y: 0.4 + rnd() * 2, z: Math.cos(a) * r }, { vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.2, vz: (rnd() - 0.5) * 0.4, wob: 0.8, life: 5, size: 0.16, color: '#d8ff7a', fadeIn: 1 }); }
    // mise à jour de la nuée
    let w = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy -= p.g * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.x += (p.vx + (p.wob ? Math.sin(t * 2 + p.ph) * p.wob * 0.3 : 0)) * dt; p.y += p.vy * dt; p.z += (p.vz + (p.wob ? Math.cos(t * 1.7 + p.ph) * p.wob * 0.3 : 0)) * dt;
      if (p.y < 0.03 && p.g > 0) { p.y = 0.03; p.vx = p.vz = p.vy = 0; }
      const age = p.max - p.life, a = Math.min(1, p.life / Math.min(0.5, p.max * 0.4)) * (p.fadeIn ? Math.min(1, age / p.fadeIn) : 1);
      pPos[w * 3] = p.x; pPos[w * 3 + 1] = p.y; pPos[w * 3 + 2] = p.z;
      pSize[w] = p.size * (1 + p.grow * age); pAlpha[w] = a * p.alpha * (p.cell === 0 ? 0.6 + 0.4 * Math.sin(t * 6 + p.ph) : 1);
      pCol[w * 3] = p.col.r; pCol[w * 3 + 1] = p.col.g; pCol[w * 3 + 2] = p.col.b; pCell[w] = p.cell;
      w++;
    }
    pGeo.setDrawRange(0, w);
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor', 'aCell']) pGeo.attributes[k].needsUpdate = true;
    // eau, nuages, yeux de loups
    rip.offset.set(t * 0.03, t * 0.02); rip.rotation = t * 0.02;
    clouds.rotation.y = t * 0.004;
    for (const e of eyes) { const c = (t + e.ph) % e.per, on = smooth(0, 0.6, c) * (1 - smooth(3.2, 3.8, c)); const blink = Math.sin((t + e.ph) * 3) > 0.97 ? 0 : 1; e.m.opacity = on * blink * smooth(0.75, 1, env.k); }
    // caméra
    const f = 1 - Math.exp(-dt * cam.smooth);
    cam.target.lerp(cam.want, f);
    cam.dist += (cam.wantDist - cam.dist) * f;
    const cp = cam.pitch, want = new THREE.Vector3(cam.target.x + Math.sin(cam.yaw) * Math.cos(cp) * cam.dist, cam.target.y + Math.sin(cp) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(cp) * cam.dist);
    want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.6);
    camPos.lerp(want, 1 - Math.exp(-dt * 10));
    camera.position.copy(camPos); camera.lookAt(cam.target);
    sun.target.position.set(cam.target.x * 0.5, 0, cam.target.z * 0.5);
    sun.position.copy(skyU.sunDir.value).multiplyScalar(80).add(sun.target.position);
    if (composer && quality === 'high') composer.render(); else renderer.render(scene, camera);
  }

  setQuality('high');
  applyTime();
  return {
    renderer, scene, camera, cam, env, chars, resize, setQuality, update, syncPlayers, place, emote, talk, poof, toss, pick, mark, headAt, project, spawn, heightAt,
    get quality() { return quality; },
    setTime(k, speed = 0.25) { env.target = k; env.speed = speed; },
  };
}
