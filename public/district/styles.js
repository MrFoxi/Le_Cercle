// Little District : l'apparence des cinq autres quartiers (villas, village côtier, vieille ville, néo-cité, village blanc).
// Même parcelles, mêmes intérieurs animés que le quartier japonais ; façades, toits, décor et relief changent.
import * as THREE from 'three';
import {
  TEX, canvasTex, std, textured, glowMat, mat, box, cyl, ball, shape, sub, plane, windowRow, plant, table, chair, sign, awning,
  flatRoof, interior, acUnit, LOOK, FLOOR, G, seeded, foliage, PALEWOOD, HOOKS, FONT, makePerson, buildBuilding,
} from './models.js';
import { makeCat } from './animals.js';
import { DISTRICT, T } from './theme.js';

export const THEMED = DISTRICT !== 'japon';
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pickBy = (arr, key) => arr[hash(key) % arr.length];

// ---------- Palettes ----------
const ST = {
  moderne: { walls: ['#e6e3dc', '#dedbd4', '#e9e6df'], trim: '#26282c', roof: 'flat', roofC: '#c9c6bf', sign: ['#16181c', '#f4f2ee'], glassFront: true, lamp: '#fff1d6', parasol: ['#f4f2ee', '#26282c'], floor: '#cfcac0' },
  cotier: { walls: ['#f4efe6', '#f6e3b0', '#cfe3ec', '#f2d0c8', '#dfeccf', '#ffffff'], trim: '#f4f1ea', roof: 'gable', roofC: ['#4a5260', '#a8543a', '#5a6470'], sign: ['#1f3a5a', '#f4efe4'], awn: [['#1f3a5a', '#f4efe4'], ['#c8402e', '#f4efe4'], ['#2f7a8a', '#f4efe4']], shutters: ['#2f6fa8', '#3a8a6a', '#c8402e', '#e0a63a', '#5aa8c8'], lamp: '#ffd9a0', parasol: ['#1f3a5a', '#f4efe4'] },
  europe: { walls: ['stone'], trim: '#3a2a1e', roof: 'steep', roofC: ['#3c424b', '#454b55'], sign: ['#3a2416', '#e8d3a0'], awn: [['#7a1f2a', '#e8d3a0'], ['#1f3a5a', '#e8d3a0'], ['#2f5a3a', '#e8d3a0']], shutters: ['#6a7a5a', '#4a5a7a', '#7a3a2a', '#8a8a7a'], lamp: '#ffc27a', parasol: ['#7a1f2a', '#e8d3a0'], boxes: true },
  futur: { walls: ['#1c2130', '#e6eaf0', '#262040', '#dfe6f0'], trim: '#0d1018', roof: 'flat', roofC: '#3a4050', sign: ['#070a14', null], neon: ['#3ff0ff', '#ff4fd8', '#8aff5a', '#ffb03a', '#7a6bff'], glassFront: true, lamp: '#bff8ff', parasol: ['#1c2130', '#3ff0ff'], floor: '#2a3040' },
  med: { walls: ['#ece9e2'], trim: '#2b5fa8', roof: 'flat', roofC: '#d4d0c8', sign: ['#2b5fa8', '#ffffff'], awn: [['#2b5fa8', '#f4f1ea']], shutters: ['#2b5fa8', '#2f8fb0', '#3a7a4a'], dome: '#2c64b4', lamp: '#ffe2a8', parasol: ['#2b5fa8', '#f4f1ea'], bougain: true },
}[DISTRICT];

// ---------- Textures propres aux quartiers ----------
const GRANITE = () => canvasTex('granite', 256, 256, (x, w, h) => {
  const r = seeded(61);
  x.fillStyle = '#5c5852'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) for (let px = -(r() * 40); px < w;) {
    const sw = 30 + r() * 40;
    x.fillStyle = `hsl(${28 + r() * 15}, ${6 + r() * 8}%, ${44 + r() * 16}%)`;
    x.beginPath(); x.roundRect(px + 2, y + 2, sw - 3, 23, 4); x.fill(); px += sw;
  }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.12})`; x.fillRect(r() * w, r() * h, 2, 2); }
}, { repeat: [1, 1] });
const TIMBER = () => canvasTex('timber', 256, 256, (x, w, h) => {
  x.fillStyle = '#efe4cc'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#4a3020';
  for (let i = 0; i <= 4; i++) x.fillRect(i * 62, 0, 10, h);
  x.fillRect(0, 0, w, 10); x.fillRect(0, h / 2 - 5, w, 10); x.fillRect(0, h - 10, w, 10);
  x.lineWidth = 9; x.strokeStyle = '#4a3020';
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 62 + 5, i % 2 ? 5 : h / 2); x.lineTo(i * 62 + 67, i % 2 ? h / 2 : 5); x.stroke(); }
}, { repeat: [1, 1] });
const wallMat = (key, kind) => {
  if (kind === 'stone') return textured('graniteW', GRANITE(), { roughness: 0.95 });
  if (kind === 'timber') return textured('timberW', TIMBER(), { roughness: 0.9 });
  return std(kind, { roughness: DISTRICT === 'futur' ? 0.35 : 0.92, metalness: DISTRICT === 'futur' ? 0.2 : 0 });
};
const roofM = c => { const m = textured('troof' + c, TEX.roof(c), { roughness: 0.6 }); m.userData.roof = true; return m; };
const trimM = () => std(ST.trim, { roughness: 0.6 });

// ---------- Toits ----------
function pitched(p, w, d, y, color, gable, pitch = 0.55, oh = 0.25) {
  const m = roofM(color), half = d / 2 + oh, len = half / Math.cos(pitch), rise = Math.tan(pitch) * (d / 2);
  for (const s of [-1, 1]) { const slab = box(p, w + oh * 2, 0.07, len, m, 0, 0, 0); slab.position.set(0, y + rise / 2 - Math.tan(pitch) * oh / 2 + 0.03, s * half / 2); slab.rotation.x = s * pitch; }
  box(p, w + oh * 2 + 0.04, 0.08, 0.12, std('#2e3036'), 0, y + rise - 0.02, 0);
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
  for (const s of [-1, 1]) { const g = new THREE.Mesh(geo, gable); g.rotation.y = Math.PI / 2; g.position.set(s * (w / 2) - 0.04, y, 0); p.add(g); }
  return rise;
}
function dome(p, r, x, y, z, color = ST.dome) {
  const m = std(color, { roughness: 0.4 });
  const d = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); d.position.set(x, y + 0.12, z); p.add(d);
  cyl(p, r * 1.02, 0.14, std('#f8f7f3'), x, y, z);
  cyl(p, 0.02, 0.3, std('#e8e2c8'), x, y + r + 0.1, z); box(p, 0.16, 0.025, 0.025, std('#e8e2c8'), x, y + r + 0.32, z); // petite croix
}
function chimney(p, x, y, z, h = 0.6) { box(p, 0.3, h, 0.3, wallMat('ch', DISTRICT === 'europe' ? 'stone' : '#a85a3a'), x, y, z); box(p, 0.36, 0.06, 0.36, std('#3a3a3a'), x, y + h, z); }
function bougainvillea(p, x, y, z, s = 1) {
  shape(p, G.ico, std('#3f7a35', { flatShading: true }), x, y, z, 0.5 * s, 0.4 * s, 0.25 * s);
  const r = seeded(Math.round(x * 97 + z * 13));
  for (let i = 0; i < 9; i++) ball(p, 0.06 * s, std('#e0408a'), x + (r() - 0.5) * 0.45 * s, y + (r() - 0.5) * 0.35 * s, z + 0.1 * s);
}
// Fenêtres, avec volets et jardinières selon le quartier
function wins(p, w, y, z, n, sched, key) {
  windowRow(p, w, y, z, n, sched, false);
  if (!ST.shutters) return;
  const c = std(pickBy(ST.shutters, key)), ww = (w / n) * 0.68;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    for (const k of [-1, 1]) box(p, 0.15, 0.62, 0.03, c, x + k * (ww / 2 + 0.09), y - 0.31, z + 0.02);
    if (ST.boxes) { box(p, ww, 0.1, 0.12, std('#5a3e2a'), x, y - 0.46, z + 0.06); for (let k = 0; k < 4; k++) ball(p, 0.04, std(['#c8323a', '#e8b63a', '#f4f1ea', '#c8323a'][k]), x - ww / 2 + 0.1 + k * (ww - 0.2) / 3, y - 0.33, z + 0.07); }
  }
}
function wallLamp(p, x, y, z, glows) {
  const m = glowMat('wlamp' + DISTRICT, ST.lamp, null, 0.25, 3, 0);
  box(p, 0.03, 0.03, 0.12, std('#222'), x, y, z + 0.06);
  box(p, 0.1, 0.14, 0.1, m, x, y - 0.12, z + 0.12);
  glows.push({ x, y: y - 0.1, z: z + 0.2, color: ST.lamp });
}
function neonFrame(p, w, h, z, color, glows) {
  const nm = glowMat('neon' + color, color, null, 0.7, 3.4, 0);
  box(p, w + 0.04, 0.04, 0.04, nm, 0, FLOOR - 0.04, z + 0.01);
  for (const s of [-1, 1]) box(p, 0.04, h, 0.04, nm, s * (w / 2 + 0.01), 0, z + 0.01);
  box(p, w + 0.04, 0.04, 0.04, nm, 0, h - 0.02, z + 0.01);
  glows.push({ x: 0, y: FLOOR, z: z + 0.2, color, strong: true });
}
function roofOf(p, kind, w, d, y, color, wall, type) {
  if (kind === 'gable') return pitched(p, w, d, y, color, wall, 0.55);
  if (kind === 'steep') { const rise = pitched(p, w, d, y, color, wall, 0.95, 0.18); chimney(p, w / 2 - 0.5, y + rise * 0.4, -0.4, rise * 0.75); return rise; }
  flatRoof(p, w, d, y, ST.roofC);
  if (DISTRICT === 'moderne' && hash(type) % 2) { for (let i = 0; i < 7; i++) box(p, 0.06, 0.05, d * 0.6, std('#8a6a4a'), -w * 0.42 + i * w * 0.08, y + 0.75, 0); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(p, 0.05, 0.62, 0.05, trimM(), -w * 0.18 + sx * w * 0.24, y + 0.12, sz * d * 0.28); }
  if (DISTRICT === 'futur') { cyl(p, 0.02, 1.2, std('#9aa4b4', { metalness: 0.8 }), w / 2 - 0.4, y + 0.1, -d / 2 + 0.4); ball(p, 0.05, glowMat('beacon', '#ff3a5a', null, 1, 4, 0), w / 2 - 0.4, y + 1.32, -d / 2 + 0.4); }
  return 0.2;
}

// ---------- Commerces ----------
const FLOOR_M = () => (ST.floor ? std(ST.floor, { roughness: 0.6 }) : PALEWOOD());
function shop(g, type, level, depth, info, rng) {
  const base = LOOK[type], W = 4, back = -depth / 2, D = 3, front = back + 3, cz = back + D / 2;
  const floors = 1 + (level >= 5) + (level >= 10 && base.tall ? 1 : 0);
  const wallC = pickBy(ST.walls, type + 'w'), wall = wallMat(type, wallC), pitchedRoof = ST.roof !== 'flat';
  const H = FLOOR * floors + 0.42;
  const neon = ST.neon && pickBy(ST.neon, type);
  box(g, W - 0.2, 0.06, D - 0.2, FLOOR_M(), 0, 0.04, cz);
  box(g, W, H, 0.1, wall, 0, 0, back + 0.05);
  for (const s of [-1, 1]) box(g, 0.1, H, D, wall, s * (W / 2 - 0.05), 0, cz);
  box(g, W - 0.2, 0.42 + FLOOR * (floors - 1), 0.1, wall, 0, FLOOR, front - 0.05); // frise et étages au-dessus de l'ouverture
  for (const s of [-1, 1]) box(g, 0.16, H, 0.16, trimM(), s * (W / 2 - 0.07), 0, front - 0.07);
  box(g, W - 0.3, 0.14, 0.12, trimM(), 0, FLOOR - 0.14, front - 0.06);
  if (ST.glassFront || base.glass) {
    const gl = mat('glass', () => new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }));
    plane(g, W - 0.3, FLOOR - 0.3, gl, 0, (FLOOR - 0.3) / 2 + 0.05, front - 0.04);
    for (const x of [-0.7, 0.7]) box(g, 0.05, FLOOR - 0.25, 0.05, trimM(), x, 0, front - 0.04);
  }
  for (let f = 1; f < floors; f++) { box(g, W - 0.2, 0.1, D - 0.2, FLOOR_M(), 0, FLOOR * f - 0.05, cz); wins(g, W - 0.6, FLOOR * f + 0.95, front + 0.01, 3, f % 2 ? 'A' : 'B', type + f); }
  for (const s of [-1, 1]) wins(sub(g, s * (W / 2 + 0.01), 0, cz, s * Math.PI / 2), 1.4, FLOOR * (floors > 1 ? 1.55 : 0.6), 0, 1, 'C', type + 's' + s);
  wins(sub(g, 0, 0, back - 0.01, Math.PI), W - 1, FLOOR * (floors > 1 ? 1.55 : 0.6), 0, 2, 'B', type + 'b');
  // toit
  const r = sub(g, 0, 0, cz);
  roofOf(r, ST.roof, W, D, H, pitchedRoof ? pickBy(ST.roofC, type) : ST.roofC, wall, type);
  if (DISTRICT === 'med' && ['sushi', 'ryotei', 'arcade'].includes(type)) dome(g, 0.9, 0.6, H + 0.18, cz - 0.3);
  if (DISTRICT === 'futur') acUnit(g, W / 2 + 0.11, FLOOR * 0.6, cz + 0.6, Math.PI / 2);
  // devanture : store, enseigne, néons, lampes
  if (ST.awn && !ST.glassFront) awning(g, W - 0.2, FLOOR - 0.18, front, ...pickBy(ST.awn, type));
  const [bg, fg] = ST.sign, fgc = fg || neon;
  sign(g, base && T.b[type] ? signText(type) : type, bg, fgc, 2.3, 0.34, 0, FLOOR + 0.04, front + 0.03, false, neon ? 3 : 1.6);
  if (neon) neonFrame(g, W, H, front, neon, info.glows);
  else for (const s of [-1, 1]) wallLamp(g, s * (W / 2 - 0.3), FLOOR - 0.25, front, info.glows);
  if (ST.bougain) bougainvillea(g, -W / 2 + 0.3, FLOOR * 0.8, front + 0.05, 1.2);
  // lumière intérieure et intérieur animé (le même que dans le quartier japonais)
  box(g, 0.8, 0.03, 0.25, glowMat('ceil', '#ffd9a0', null, 0.4, 2.2, 0), 0, FLOOR - 0.06, cz);
  info.light = { x: 0, y: FLOOR - 0.35, z: cz + 0.4, color: neon || '#ffb56b' };
  info.glows.push({ x: 0, y: 0.6, z: front + 0.3, color: neon || '#ffb56b', pool: true });
  interior(g, base, level, { W, D, back, front, cz, depth }, info, rng);
  // devant : plantes, menu, terrasse
  if (level >= 3) { plant(g, -W / 2 + 0.25, front + 0.3, 1); plant(g, W / 2 - 0.25, front + 0.3, 0.9); }
  if (level >= 4 && base.style !== 'stall') { box(g, 0.32, 0.45, 0.05, std('#2a2420'), W / 2 - 0.55, 0, front + 0.45, -0.3); }
  if (level >= 7 && base.style !== 'stall') {
    for (const s of [-1, 1]) {
      const tx = s * 1.25, tz = Math.min(depth / 2 - 0.45, front + 0.85);
      table(g, tx, tz); chair(g, tx - 0.36, tz, Math.PI / 2); chair(g, tx + 0.36, tz, -Math.PI / 2);
      cyl(g, 0.02, 1, std('#ddd'), tx, 0.3, tz);
      shape(g, G.cone, std(ST.parasol[s < 0 ? 0 : 1], { side: THREE.DoubleSide }), tx, 1.38, tz, 0.9, 0.22, 0.9);
      info.seats.push({ x: tx - 0.36, z: tz, ry: Math.PI / 2, sit: 0.18 }, { x: tx + 0.36, z: tz, ry: -Math.PI / 2, sit: 0.18 });
    }
  }
  if (level >= 10) { // grande enseigne sur le toit
    for (const s of [-1, 1]) box(g, 0.06, 0.5, 0.06, std('#333'), s * 1, H + 0.15, front - 0.25);
    sign(g, signText(type), bg, fgc, 2.6, 0.55, 0, H + 0.62, front - 0.22, false, 3.4);
    info.glows.push({ x: 0, y: H + 0.8, z: front, color: fgc, strong: true });
  }
}
const signText = type => T.b[type][0].replace(/^(Le |La |Les |L’)/, '').toUpperCase().slice(0, 18);

// ---------- Logements ----------
function home(g, type, level, depth, info, rng) {
  const W = 4, back = -depth / 2, D = 3.1, front = back + D, cz = back + D / 2;
  let floors = type === 'appart' ? 2 + (level >= 5) : type === 'immeuble' ? 3 + (level >= 4) + (level >= 7) + (level >= 10) : type === 'hotel' ? 2 + (level >= 6) : 1 + (level >= 5);
  if (DISTRICT === 'moderne') floors = Math.min(floors, type === 'immeuble' ? 3 : 2);
  const wallC = DISTRICT === 'europe' && type === 'maison' ? 'timber' : pickBy(ST.walls, type + 'h'), wall = wallMat(type, wallC);
  const H = FLOOR * floors;
  info.front = front;
  info.light = { x: 0, y: 1, z: front + 0.4, color: '#ffc27a' };
  info.door = { x: -1.2, z: depth / 2 }; info.doorIn = { x: -1.2, z: front + 0.1 };

  if (DISTRICT === 'futur' && type === 'maison') { // dôme de verre
    cyl(g, 1.7, 0.4, std('#e6eaf0', { roughness: 0.3 }), 0, 0, cz);
    const gm = mat('domeGlass', () => new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }));
    const d = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gm); d.position.set(0, 0.4, cz); g.add(d);
    for (let i = 0; i < 4; i++) plant(g, -0.6 + i * 0.4, cz + (i % 2 ? 0.3 : -0.3), 1.2, 'green');
    box(g, 0.9, 0.5, 0.4, glowMat('podLight', '#ffd9a0', null, 0.3, 1.8, 'A'), 0.3, 0.4, cz - 0.4);
    neonFrame(sub(g, 0, 0, 0), 0.8, 1.1, front - 0.35, pickBy(ST.neon, type), info.glows);
    info.glows.push({ x: 0, y: 0.6, z: front + 0.3, color: '#ffc27a', pool: true });
    return;
  }
  // corps du bâtiment (au village blanc, les étages reculent et laissent des terrasses)
  for (let f = 0; f < floors; f++) {
    const setback = DISTRICT === 'med' && f > 0 ? Math.min(f * 0.45, 1.2) : 0, cant = DISTRICT === 'moderne' && f === 1 ? 0.5 : 0;
    const w = W - setback, d = D - setback * 0.6, x = setback / 2 - cant * 0.6, zc = cz - setback * 0.3 + cant * 0.4;
    box(g, w, FLOOR, d, f === 1 && DISTRICT === 'moderne' ? std('#8a6a4a', { roughness: 0.8 }) : wall, x, FLOOR * f, zc);
    const fz = zc + d / 2 + 0.01, sched = ['A', 'B', 'C'][(f + level) % 3];
    if (DISTRICT === 'moderne') { // grandes baies vitrées
      plane(g, w - 0.6, FLOOR * 0.7, glowMat('bigglass' + sched, '#ffffff', TEX.window(), 0.03, 0.8, sched), x + 0.2, FLOOR * f + FLOOR * 0.45, fz);
      box(g, w - 0.5, 0.05, 0.06, trimM(), x + 0.2, FLOOR * f + FLOOR * 0.08, fz);
    } else wins(sub(g, x, 0, fz), w - 0.5, FLOOR * f + 0.8, 0, type === 'immeuble' ? 4 : w > 3.4 ? 3 : 2, sched, type + f);
    wins(sub(g, x + w / 2 + 0.01, 0, zc, Math.PI / 2), d - 0.8, FLOOR * f + 0.8, 0, 2, ['B', 'C', 'A'][(f + level) % 3], type + 'r' + f);
    wins(sub(g, x - w / 2 - 0.01, 0, zc, -Math.PI / 2), d - 1.2, FLOOR * f + 0.8, 0, 1, ['C', 'A', 'B'][(f + level) % 3], type + 'l' + f);
    wins(sub(g, x, 0, zc - d / 2 - 0.01, Math.PI), w - 0.8, FLOOR * f + 0.8, 0, 2, sched, type + 'k' + f);
    if (DISTRICT === 'med' && f > 0) { // terrasse et parapet devant l'étage reculé
      box(g, W, 0.12, D, std('#f3f1ec'), 0, FLOOR * f - 0.06, cz);
      box(g, W, 0.35, 0.08, std('#f8f7f3'), 0, FLOOR * f, cz + D / 2 - 0.04);
    }
    if (f > 0 && DISTRICT !== 'med' && DISTRICT !== 'moderne') box(g, W + 0.06, 0.07, 0.06, trimM(), 0, FLOOR * f - 0.04, cz + D / 2 + 0.02);
  }
  // toit
  const topW = DISTRICT === 'med' ? W - Math.min((floors - 1) * 0.45, 1.2) : W, topD = DISTRICT === 'med' ? D - Math.min((floors - 1) * 0.45, 1.2) * 0.6 : D;
  const topX = DISTRICT === 'med' ? (W - topW) / 2 : DISTRICT === 'moderne' && floors > 1 ? -0.3 : 0;
  const rise = roofOf(sub(g, topX, 0, cz - (D - topD) / 2), ST.roof, topW, topD, H, ST.roof === 'flat' ? ST.roofC : pickBy(ST.roofC, type), wall, type);
  if (DISTRICT === 'europe') { chimney(g, -W / 2 + 0.5, H + rise * 0.3, cz + 0.3, rise * 0.85); if (level >= 3) { const dm = sub(g, 0.6, H, cz + D / 2 - 0.35); box(dm, 0.7, 0.55, 0.5, wall, 0, 0, 0); pitched(sub(dm, 0, 0, 0, Math.PI / 2), 0.5, 0.7, 0.55, ST.roofC[0], wall, 0.7, 0.05); windowRow(dm, 0.6, 0.3, 0.26, 1, 'B'); } }
  if (DISTRICT === 'med' && (type === 'hotel' || type === 'immeuble')) dome(g, 0.75, topX - 0.2, H + 0.06, cz - 0.3);
  if (DISTRICT === 'futur') for (let f = 1; f <= floors; f++) box(g, W + 0.04, 0.05, D + 0.04, glowMat('band' + pickBy(ST.neon, type), pickBy(ST.neon, type), null, 0.6, 3, 0), 0, FLOOR * f - 0.06, cz);
  // porte
  plane(g, 0.7, 0.95, std(DISTRICT === 'med' ? ST.trim : DISTRICT === 'futur' ? '#3a4458' : '#5a3a26'), -1.2, 0.5, front + 0.02);
  box(g, 0.8, 0.05, 0.08, trimM(), -1.2, 1.0, front + 0.03);
  wallLamp(g, -0.65, 1.15, front, info.glows);
  // jardin devant
  const yard = depth / 2 - front;
  if (DISTRICT === 'moderne' && yard > 0.5) { // piscine
    box(g, 2.3, 0.08, Math.min(0.8, yard - 0.2), std('#e8e6e0'), 0.6, 0, front + yard / 2);
    const water = box(g, 2.1, 0.02, Math.min(0.62, yard - 0.35), std('#3fc0d8', { roughness: 0.05, metalness: 0.1, emissive: '#0a4a5a', emissiveIntensity: 0.4 }), 0.6, 0.075, front + yard / 2);
    water.userData.noShadow = true;
    if (level >= 3) { const p = makeDecorOf('cerisier'); p.position.set(-1.6, 0, front + yard / 2); p.scale.setScalar(0.6); g.add(p); }
  } else if (DISTRICT === 'cotier' && yard > 0.5) { // barrière blanche
    for (let i = 0; i < 9; i++) box(g, 0.05, 0.32, 0.03, std('#f4f1ea'), -1.9 + i * 0.475, 0, depth / 2 - 0.1);
    box(g, 4, 0.04, 0.03, std('#f4f1ea'), 0, 0.22, depth / 2 - 0.1);
    for (let i = 0; i < Math.min(4, Math.floor(level / 2) + 1); i++) plant(g, 0.3 + i * 0.45, front + yard / 2, 0.9, 'green');
  } else if (yard > 0.5) for (let i = 0; i < Math.min(4, Math.floor(level / 2) + 1); i++) plant(g, 0.2 + i * 0.5, front + yard / 2, 0.8 + rng() * 0.4, 'green');
  if (ST.bougain) { bougainvillea(g, W / 2 - 0.2, 1.2, front + 0.06, 1.3); if (floors > 1) bougainvillea(g, -0.2, FLOOR + 0.6, front - 0.3, 1); }
  if (DISTRICT === 'med' && type === 'appart') for (let i = 0; i < 8; i++) box(g, 0.5, 0.04, 0.2, std('#f3f1ec'), W / 2 + 0.28, 0.17 * (i + 1) - 0.04, front - 1.6 + i * 0.17); // escalier blanc extérieur
  info.glows.push({ x: -1.2, y: 0.6, z: front + 0.3, color: '#ffc27a', pool: true });
}

function buildThemed(type, level, depth = 4.2) {
  const g = new THREE.Group(), rng = seeded(type.length * 977 + level * 31);
  const info = { seats: [], staff: [], steam: [], glows: [], light: null, screens: [] };
  info.door = { x: 0, z: depth / 2 }; info.front = -depth / 2 + 3;
  box(g, 4.3, 0.04, depth, textured('slabfloor', TEX.slab()), 0, 0, 0);
  if (LOOK[type].style === 'home') home(g, type, level, depth, info, rng);
  else shop(g, type, level, depth, info, rng);
  return { group: g, info };
}

// ---------- Végétation et décorations ----------
const leaf = c => std(c, { roughness: 0.9, flatShading: true });
function palm(g, s = 1) {
  const trunk = std('#8a6a48', { roughness: 0.95 });
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) { cyl(g, (0.065 - i * 0.004) * s, 0.24 * s, trunk, x, y, 0); x += 0.03 * s; y += 0.22 * s; }
  const fr = leaf('#3f8a3a');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, f = box(g, 0.14 * s, 0.02, 0.75 * s, fr, 0, 0, 0);
    f.position.set(x + Math.sin(a) * 0.32 * s, y + 0.02, Math.cos(a) * 0.32 * s); f.rotation.set(0.5, a, 0, 'YXZ');
  }
  for (let i = 0; i < 3; i++) ball(g, 0.05 * s, std('#5a3a1e'), x + Math.cos(i * 2) * 0.07 * s, y - 0.05, Math.sin(i * 2) * 0.07 * s);
}
function roundTree(g, s, colors, trunkC = '#4a3326') {
  const t = cyl(g, 0.07 * s, 0.85 * s, std(trunkC, { roughness: 0.95 }), 0, 0, 0); t.rotation.z = 0.06;
  [[0, 1.05, 0, 0.5], [0.32, 0.95, 0.1, 0.36], [-0.3, 1, -0.1, 0.38], [0.05, 1.3, 0.2, 0.32], [-0.1, 0.9, 0.32, 0.3]].forEach(([x, y, z, r], i) => shape(g, G.ico, colors[i % colors.length], x * s, y * s, z * s, r * 2 * s));
}
function cypress(g, s = 1) { cyl(g, 0.05 * s, 0.3 * s, std('#4a3326'), 0, 0, 0); shape(g, G.ico, leaf('#2f5a2f'), 0, 1.0 * s, 0, 0.42 * s, 1.6 * s, 0.42 * s); }
function pineParasol(g, s = 1) { const t = cyl(g, 0.06 * s, 1.5 * s, std('#5a4232'), 0, 0, 0); t.rotation.z = 0.1; shape(g, G.ico, leaf('#3a5e34'), 0.12 * s, 1.6 * s, 0, 1.3 * s, 0.35 * s, 1.1 * s); }
function neonTree(g, s, color) { cyl(g, 0.04 * s, 0.9 * s, std('#2a3040', { metalness: 0.7 }), 0, 0, 0); const m = glowMat('ntree' + color, color, null, 0.8, 2.6, 0); [[0, 1.1, 0, 0.45], [0.25, 0.95, 0.1, 0.28], [-0.25, 1.0, -0.1, 0.3]].forEach(([x, y, z, r]) => shape(g, new THREE.OctahedronGeometry(0.5, 0), m, x * s, y * s, z * s, r * 2 * s)); g.userData.glows.push({ x: 0, y: 0.6, z: 0, color, pool: true, r: 1 * s }); }
function stoneStatue(g, m, s = 1) { box(g, 0.34, 0.3, 0.34, std('#9a968e'), 0, 0, 0); ball(g, 0.12 * s, m, 0, 0.42, 0, 1.7); ball(g, 0.08 * s, m, 0, 0.7, 0); for (const k of [-1, 1]) { const a = cyl(g, 0.025, 0.25, m, k * 0.13, 0.36, 0); a.rotation.z = k * 0.3; } }
function column(g) { const w = std('#f2efe6', { roughness: 0.6 }); box(g, 0.34, 0.08, 0.34, w, 0, 0, 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl(g, 0.03, 1.3, w, Math.cos(a) * 0.1, 0.08, Math.sin(a) * 0.1); } cyl(g, 0.12, 1.3, w, 0, 0.08, 0); box(g, 0.36, 0.1, 0.36, w, 0, 1.38, 0); }
function amphora(g) { const pts = [[0.02, 0], [0.09, 0.05], [0.16, 0.2], [0.15, 0.35], [0.08, 0.48], [0.06, 0.56], [0.09, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)); const a = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), std('#b8673a', { roughness: 0.8 })); g.add(a); for (const k of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI), std('#b8673a')); h.position.set(k * 0.1, 0.5, 0); h.rotation.z = k * -1.2; g.add(h); } }
function arch(g, color, glowC) { const m = glowC ? glowMat('archG' + glowC, glowC, null, 0.8, 3, 0) : std(color, { roughness: 0.6 }); for (const s of [-1, 1]) box(g, 0.16, 1.3, 0.16, m, s * 0.7, 0, 0); const t = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 18, Math.PI), m); t.position.y = 1.3; g.add(t); }
function pergola(g, vine) { const w = std('#7a5a3a'); for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) box(g, 0.07, 1.2, 0.07, w, x, 0, z); for (let i = 0; i < 6; i++) box(g, 1.4, 0.05, 0.06, w, 0, 1.2, -0.55 + i * 0.22); if (vine) { for (let i = 0; i < 7; i++) shape(g, G.ico, leaf('#4f7a35'), -0.5 + (i % 4) * 0.33, 1.28, -0.4 + Math.floor(i / 4) * 0.6, 0.35, 0.12, 0.35); for (let i = 0; i < 5; i++) ball(g, 0.05, std('#6a2a5a'), -0.4 + i * 0.2, 1.15, 0); } box(g, 0.9, 0.05, 0.4, PALEWOOD(), 0, 0.4, 0); }
function boatModel(g, hull = '#f4f1ea', sail = true, s = 1) {
  const pts = [[-0.7, 0], [-0.55, -0.12], [0.55, -0.12], [0.8, 0.02]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  const sh = new THREE.Shape(pts); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.36 * s, bevelEnabled: false }); geo.translate(0, 0.08 * s, -0.18 * s);
  g.add(new THREE.Mesh(geo, std(hull, { roughness: 0.5 })));
  box(g, 1.3 * s, 0.03, 0.3 * s, PALEWOOD(), 0.05, 0.06 * s, 0);
  if (sail) { cyl(g, 0.015, 1.1 * s, std('#ddd'), 0.1 * s, 0.08, 0); const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.55 * s, 0), new THREE.Vector2(0, 0.95 * s)]); const sl = new THREE.Mesh(new THREE.ShapeGeometry(tri), std('#f8f6f0', { side: THREE.DoubleSide })); sl.position.set(0.12 * s, 0.2, 0); g.add(sl); }
}
function lighthouse(g, s = 1, glows) {
  for (let i = 0; i < 6; i++) cyl(g, (0.32 - i * 0.03) * s, 0.5 * s, std(i % 2 ? '#c8323a' : '#f4f1ea', { roughness: 0.6 }), 0, i * 0.5 * s, 0);
  const lamp = glowMat('lhLamp', '#fff1b8', null, 0.6, 4, 0);
  cyl(g, 0.2 * s, 0.32 * s, lamp, 0, 3 * s, 0);
  shape(g, G.cone, std('#2a2a2e'), 0, 3.48 * s, 0, 0.5 * s, 0.32 * s, 0.5 * s);
  cyl(g, 0.3 * s, 0.05, std('#2a2a2e'), 0, 3 * s, 0);
  glows?.push({ x: 0, y: 3 * s, z: 0, color: '#fff1b8', strong: true, r: 1.5 * s });
}

function makeDecorOf(id) { return HOOKS.decor?.(id) || null; }
function themedDecor(id) {
  const g = new THREE.Group(); g.userData.glows = [];
  const D = DISTRICT, glow = (x, y, z, color, r = 0.8) => g.userData.glows.push({ x, y, z, color, pool: true, r });
  const tree = { moderne: { cerisier: () => palm(g), sakura: () => palm(g, 1.7), erable: () => roundTree(g, 0.9, [leaf('#7d8f62')], '#7a7468') },
    cotier: { cerisier: () => pineParasol(g), sakura: () => pineParasol(g, 1.6), erable: () => roundTree(g, 0.9, [foliage('green'), leaf('#c48aa0')]) },
    europe: { cerisier: () => roundTree(g, 1.05, [foliage('green')]), sakura: () => roundTree(g, 1.8, [foliage('green')]), erable: () => roundTree(g, 1.1, [foliage('green'), foliage('cherry')]) },
    futur: { cerisier: () => neonTree(g, 1, '#ff4fd8'), sakura: () => neonTree(g, 1.8, '#3ff0ff'), erable: () => neonTree(g, 1, '#8aff5a') },
    med: { cerisier: () => roundTree(g, 0.85, [leaf('#7d8f62'), leaf('#8a9a70')], '#6a6458'), sakura: () => roundTree(g, 1.5, [leaf('#7d8f62')], '#6a6458'), erable: () => cypress(g, 1.3) } }[D];
  if (tree[id]) { tree[id](); g.userData.tree = 'green'; return g; }
  const per = {
    moderne: {
      caisses: () => { box(g, 0.32, 0.05, 0.75, std('#f4f2ee'), 0, 0.18, 0); const b = box(g, 0.32, 0.05, 0.35, std('#f4f2ee'), 0, 0.28, -0.4); b.rotation.x = -0.7; for (const z of [-0.3, 0.3]) box(g, 0.3, 0.18, 0.04, trimM(), 0, 0, z); },
      bambou: () => box(g, 0.9, 0.55, 0.35, leaf('#3f6a35'), 0, 0, 0), toro: () => { cyl(g, 0.06, 0.4, std('#26282c'), 0, 0, 0); cyl(g, 0.065, 0.06, glowMat('bollard', '#fff1d6', null, 0.3, 3, 0), 0, 0.34, 0); glow(0, 0.3, 0, '#fff1d6', 0.6); },
      bonsai: () => { box(g, 0.3, 0.3, 0.3, std('#26282c'), 0, 0, 0); const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.15, 0.04, 40, 6), std('#d0d4d8', { metalness: 0.9, roughness: 0.2 })); k.position.y = 0.55; g.add(k); },
      torii: () => arch(g, '#f4f2ee'), puits: () => { cyl(g, 0.45, 0.32, std('#e8e6e0'), 0, 0, 0); cyl(g, 0.38, 0.02, std('#3fc0d8', { roughness: 0.05, emissive: '#0a4a5a', emissiveIntensity: 0.5 }), 0, 0.3, 0); },
      neko: () => stoneStatue(g, std('#d0d4d8', { metalness: 1, roughness: 0.15 })), jizo: () => { box(g, 0.3, 0.3, 0.3, std('#26282c'), 0, 0, 0); for (let i = 0; i < 3; i++) { const b = box(g, 0.2, 0.2, 0.2, std(['#e8432e', '#2a5fa8', '#f2c14e'][i]), 0, 0.3 + i * 0.22, 0, i * 0.6); b.rotation.z = i * 0.4; } },
      kiosque: () => pergola(g, false),
    },
    cotier: {
      caisses: () => { for (let i = 0; i < 3; i++) box(g, 0.32, 0.22, 0.26, std(['#5a6a7a', '#7a5a3a', '#4a6a5a'][i]), (i - 1) * 0.12, i === 2 ? 0.22 : 0, i === 2 ? 0 : (i - 0.5) * 0.3); },
      bambou: () => { for (let i = 0; i < 12; i++) { const b = cyl(g, 0.01, 0.4, leaf('#a8a868'), Math.cos(i) * 0.15, 0, Math.sin(i * 1.7) * 0.15); b.rotation.z = Math.sin(i) * 0.3; } },
      toro: () => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 16), std('#e8432e')); t.rotation.x = Math.PI / 2; t.position.y = 0.4; g.add(t); cyl(g, 0.03, 0.5, std('#7a5a3a'), 0, 0, 0); },
      bonsai: () => { shape(g, G.ico, std('#5a6a5a', { flatShading: true, roughness: 1 }), 0, 0.12, 0, 0.6, 0.25, 0.5); for (let i = 0; i < 4; i++) ball(g, 0.04, std('#e8a03a'), (i - 1.5) * 0.12, 0.25, 0.1); },
      torii: () => { const m = std('#3a3a40', { metalness: 0.6, roughness: 0.5 }); cyl(g, 0.05, 1.1, m, 0, 0, 0); box(g, 0.6, 0.06, 0.06, m, 0, 0.9, 0); const t = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 14, Math.PI), m); t.rotation.z = Math.PI; t.position.y = 0.35; g.add(t); },
      puits: () => { const b = new THREE.Group(); boatModel(b, '#2f6fa8', false, 0.8); b.rotation.z = 0.15; b.position.y = 0.1; g.add(b); },
      neko: () => lighthouse(g, 0.3, g.userData.glows), jizo: () => stoneStatue(g, std('#8d8a83', { roughness: 0.95 })),
      kiosque: () => { box(g, 0.8, 1.1, 0.8, textured('cabin', TEX.stripes('#2f6fa8', '#f4f1ea')), 0, 0, 0); shape(g, G.cone, std('#c8402e'), 0, 1.3, 0, 1.25, 0.35, 1.25); },
    },
    europe: {
      caisses: () => { for (let i = 0; i < 3; i++) { cyl(g, 0.16, 0.42, textured('barrel', TEX.wood('#7a5434')), (i - 1) * 0.34, 0, 0); cyl(g, 0.165, 0.03, std('#333'), (i - 1) * 0.34, 0.08, 0); cyl(g, 0.165, 0.03, std('#333'), (i - 1) * 0.34, 0.32, 0); } },
      lampe: () => { cyl(g, 0.04, 1.5, std('#1c1c1c', { metalness: 0.5 }), 0, 0, 0); box(g, 0.2, 0.26, 0.2, glowMat('ironLamp', '#ffc27a', null, 0.25, 3.5, 0), 0, 1.5, 0); shape(g, G.cone, std('#1c1c1c'), 0, 1.84, 0, 0.32, 0.16, 0.32); glow(0, 1.4, 0, '#ffc27a', 1.4); },
      bambou: () => shape(g, G.ico, foliage('green'), 0, 0.35, 0, 0.8, 0.6, 0.6), toro: () => { cyl(g, 0.14, 0.45, wallMat('b', 'stone'), 0, 0, 0); ball(g, 0.15, wallMat('b', 'stone'), 0, 0.45, 0, 0.6); },
      bonsai: () => { box(g, 0.4, 0.2, 0.2, std('#7a5434'), 0, 0, 0); for (let i = 0; i < 8; i++) cyl(g, 0.012, 0.25, std('#7a5ab0'), -0.15 + (i % 4) * 0.1, 0.2, (i > 3 ? 0.05 : -0.05)); },
      torii: () => { const st = wallMat('c', 'stone'); box(g, 0.5, 0.3, 0.5, st, 0, 0, 0); box(g, 0.12, 1.3, 0.12, st, 0, 0.3, 0); box(g, 0.6, 0.12, 0.12, st, 0, 1.25, 0); },
      neko: () => { const c = makeCat(['#7a7670', '#8d8a83']); c.root.scale.setScalar(2.2); c.root.position.y = 0.45; c.body.rotation.x = -0.35; g.add(c.root); box(g, 0.45, 0.45, 0.45, wallMat('p', 'stone'), 0, 0, 0); },
      jizo: () => stoneStatue(g, std('#8d8a83', { roughness: 0.95 })), puits: () => { const st = wallMat('w', 'stone'); cyl(g, 0.35, 0.4, st, 0, 0, 0); for (const s of [-1, 1]) box(g, 0.06, 0.9, 0.06, std('#5a3e2a'), s * 0.3, 0.4, 0); box(g, 0.7, 0.05, 0.08, std('#5a3e2a'), 0, 1.25, 0); shape(g, G.cone, std('#3c424b'), 0, 1.45, 0, 0.9, 0.35, 0.5); },
      kiosque: () => { const w = std('#2a4a3a'); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl(g, 0.03, 1.1, w, Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6); } cyl(g, 0.7, 0.2, wallMat('k', 'stone'), 0, 0, 0); shape(g, G.cone, std('#2a4a3a'), 0, 1.55, 0, 1.6, 0.5, 1.6); },
    },
    futur: {
      plante: () => { cyl(g, 0.12, 0.2, std('#2a3040', { metalness: 0.7 }), 0, 0, 0); shape(g, new THREE.OctahedronGeometry(0.5, 0), glowMat('gplant', '#8aff5a', null, 0.8, 2.6, 0), 0, 0.38, 0, 0.3); },
      caisses: () => { for (let i = 0; i < 2; i++) box(g, 0.4, 0.3, 0.3, std('#dfe6f0', { metalness: 0.4, roughness: 0.3 }), 0, i * 0.3, 0, i * 0.4); },
      banc: () => { box(g, 0.8, 0.06, 0.26, std('#e6eaf0', { roughness: 0.2 }), 0, 0.3, 0); box(g, 0.8, 0.02, 0.26, glowMat('benchG', '#3ff0ff', null, 0.6, 2.4, 0), 0, 0.27, 0); },
      velo: () => { box(g, 0.6, 0.04, 0.2, std('#ff4fd8', { roughness: 0.3 }), 0, 0.12, 0); box(g, 0.5, 0.01, 0.15, glowMat('hover', '#3ff0ff', null, 1, 3, 0), 0, 0.09, 0); },
      lampe: () => { cyl(g, 0.03, 1.2, glowMat('pylon', '#3ff0ff', null, 0.4, 2, 0), 0, 0, 0); ball(g, 0.12, glowMat('orb', '#e8fdff', null, 0.8, 4, 0), 0, 1.6, 0); glow(0, 1.4, 0, '#bff8ff', 1.4); },
      bambou: () => { for (let i = 0; i < 6; i++) cyl(g, 0.02, 0.8 + (i % 3) * 0.3, glowMat('stem' + (i % 2), i % 2 ? '#3ff0ff' : '#ff4fd8', null, 0.8, 3, 0), Math.cos(i * 2.4) * 0.15, 0, Math.sin(i * 2.4) * 0.15); },
      toro: () => { cyl(g, 0.15, 0.08, std('#2a3040'), 0, 0, 0); const h = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), glowMat('holo', '#3ff0ff', null, 1, 3, 0, { transparent: true, opacity: 0.8 })); h.position.y = 0.5; g.add(h); glow(0, 0.4, 0, '#3ff0ff', 0.7); },
      panneau: () => { cyl(g, 0.02, 0.6, std('#2a3040'), 0, 0, 0); plane(g, 0.5, 0.3, glowMat('holoSign', '#3ff0ff', null, 1, 3, 0, { transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0.85, 0); },
      bonsai: () => { box(g, 0.2, 0.08, 0.2, std('#e6eaf0'), 0, 0.6, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.07, 0.01, glowMat('rotor', '#ff4fd8', null, 0.8, 3, 0), x * 0.15, 0.68, z * 0.15); },
      torii: () => arch(g, null, '#3ff0ff'), puits: () => { box(g, 0.3, 0.8, 0.2, std('#e6eaf0', { roughness: 0.2 }), 0, 0, 0); plane(g, 0.2, 0.25, glowMat('charge', '#8aff5a', null, 1, 3, 0), 0, 0.55, 0.105); glow(0, 0.4, 0.2, '#8aff5a', 0.6); },
      neko: () => { const c = makeCat(['#d0d4d8', '#9aa4b4']); c.root.scale.setScalar(1.6); g.add(c.root); ball(g, 0.02, glowMat('eyes', '#3ff0ff', null, 2, 4, 0), 0, 0.36, 0.33); },
      jizo: () => { cyl(g, 0.2, 0.06, std('#2a3040'), 0, 0, 0); const p = makePerson(seeded(5)); p.root.traverse(o => { if (o.isMesh) o.material = glowMat('holoMan', '#3ff0ff', null, 1, 2.5, 0, { transparent: true, opacity: 0.55 }); }); p.root.position.y = 0.06; g.add(p.root); glow(0, 0.4, 0, '#3ff0ff', 0.8); },
      kiosque: () => { cyl(g, 0.6, 0.1, std('#e6eaf0', { roughness: 0.2 }), 0, 0, 0); const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 30), glowMat('tele', '#7a6bff', null, 1, 3.5, 0)); r.position.y = 1.1; g.add(r); glow(0, 0.4, 0, '#7a6bff', 1.2); },
      fontaine: () => { cyl(g, 0.55, 0.22, std('#e6eaf0', { roughness: 0.2 }), 0, 0, 0); cyl(g, 0.48, 0.02, glowMat('lightWater', '#3ff0ff', null, 1, 3, 0), 0, 0.2, 0); cyl(g, 0.04, 0.9, glowMat('jet', '#bff8ff', null, 1, 3, 0, { transparent: true, opacity: 0.7 }), 0, 0.2, 0); glow(0, 0.3, 0, '#3ff0ff', 1); },
      vending: null,
    },
    med: {
      caisses: () => { for (let i = 0; i < 2; i++) { box(g, 0.34, 0.2, 0.26, PALEWOOD(), 0, i * 0.2, 0); for (let k = 0; k < 5; k++) ball(g, 0.03, std('#4a5a2a'), -0.12 + k * 0.06, i * 0.2 + 0.21, 0); } },
      bambou: () => bougainvillea(g, 0, 0.45, 0, 1.6), toro: () => amphora(g),
      bonsai: () => { cyl(g, 0.13, 0.2, std('#b8673a'), 0, 0, 0); shape(g, G.ico, leaf('#4f8a3a'), 0, 0.32, 0, 0.3); },
      torii: () => arch(g, '#f8f7f3'), puits: () => { cyl(g, 0.35, 0.4, std('#f8f7f3'), 0, 0, 0); cyl(g, 0.36, 0.05, std('#2b5fa8'), 0, 0.4, 0); },
      neko: () => stoneStatue(g, std('#efe9dc', { roughness: 0.7 })), jizo: () => column(g), kiosque: () => pergola(g, true),
      velo: () => { box(g, 0.5, 0.18, 0.14, std('#2f8fb0', { roughness: 0.4 }), 0, 0.12, 0); for (const x of [-0.22, 0.22]) { const w = cyl(g, 0.09, 0.05, std('#222'), x, 0.04, 0); w.rotation.x = Math.PI / 2; } box(g, 0.2, 0.06, 0.12, std('#222'), -0.08, 0.3, 0); },
    },
  }[D];
  const f = per?.[id];
  if (!f) return null;
  f();
  return g;
}

// ---------- Lampadaires de rue ----------
export function streetLamp(parent, x, z, s) {
  const D = DISTRICT, post = std(D === 'med' ? '#f8f7f3' : D === 'futur' ? '#2a3040' : '#1c1c1e', { metalness: D === 'futur' ? 0.7 : 0.4, roughness: 0.4 });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.6, 8), post); p.position.set(x, 1.3, z); p.castShadow = true; parent.add(p);
  if (D === 'futur') { const r = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 20), glowMat('lampRing', '#3ff0ff', null, 0.6, 3, 0)); r.position.set(x, 2.3, z); r.rotation.x = Math.PI / 2; parent.add(r); }
  else if (D === 'moderne') box(parent, 0.5, 0.04, 0.08, post, x, 2.58, z - s * 0.2, 0);
  else { box(parent, 0.06, 0.06, 0.45, post, x, 2.5, z - s * 0.2); shape(parent, G.cone, post, x, 2.82, z - s * 0.42, 0.3, 0.16, 0.3); }
}

// ---------- Relief propre au quartier : sommet de la colline, rive sud ----------
// h : outils du terrain (deco, glowsDef, HILL, CANAL, GY, scene, root, flat, bridge)
export function themeScenery(h) {
  const { deco, root, scene, HILL, CANAL, GY } = h, D = DISTRICT, anims = [];
  const hy = HILL.y;
  const placeBuilding = (type, level, x, z, ry) => { const { group, info } = buildBuilding(type, level, 4.5); group.position.set(x, hy, z); group.rotation.y = ry; root.add(group); info.glows.forEach(gl => { const v = new THREE.Vector3(gl.x, 0, gl.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); h.glowsDef.push({ ...gl, x: x + v.x, z: z + v.z, yb: hy }); }); };
  // sommet
  if (D === 'moderne') {
    placeBuilding('hotel', 8, 0, 18.4, 0);
    box(root, 6, 0.1, 1.1, std('#e8e6e0'), 0, hy, 16.2);
    box(root, 5.6, 0.03, 0.8, std('#3fc0d8', { roughness: 0.05, emissive: '#0a4a5a', emissiveIntensity: 0.5 }), 0, hy + 0.1, 16.2);
    for (const s of [-1, 1]) { deco('sakura', s * 5.5, hy, 18.6, 1); deco('cerisier', s * 9, hy, 19, 1.2); deco('bambou', s * 11, hy, 17, 1.4); deco('erable', s * 7.5, hy, 16.3, 1); deco('toro', s * 1.1, GY, 12.7); }
    deco('torii', 0, hy, HILL.z0 + 0.7, 1.2);
  } else if (D === 'cotier') {
    const lh = sub(root, 4.5, hy, 18.6); lighthouse(lh, 1.4, null);
    h.glowsDef.push({ x: 4.5, y: 4.2, z: 18.6, color: '#fff1b8', strong: true, yb: hy, r: 2 });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.6, 9, 12, 1, true).translate(0, 4.5, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(4.5, hy + 4.4, 18.6); beam.userData.night = 0.18; scene.add(beam);
    anims.push((dt, t, night) => { beam.rotation.y = t * 0.6; beam.material.opacity = night * 0.16; });
    placeBuilding('maison', 3, -1.5, 18.7, 0);
    for (const s of [-1, 1]) { deco('sakura', s * 9, hy, 18.8, 1); deco('bambou', s * 11.5, hy, 17.5, 1.4); deco('toro', s * 1.1, GY, 12.7); deco('banc', s * 6.5, hy, 15.6, 1, Math.PI); }
    deco('cerisier', -6, hy, 19.2, 1.1);
  } else if (D === 'europe') {
    // l'abbaye : nef de granite, toit d'ardoise très pentu, clocher et flèche
    const ab = sub(root, 0, hy, 18.3), st = wallMat('ab', 'stone');
    box(ab, 7, 2.6, 3, st, 0, 0, 0);
    pitched(sub(ab, 0, 0, 0), 7, 3, 2.6, '#3c424b', st, 0.9, 0.15);
    for (let i = 0; i < 5; i++) { const w = plane(ab, 0.35, 1, glowMat('vitrail', '#ffd28a', null, 0.05, 1.4, 0), -2.8 + i * 1.4, 1.3, 1.52); w.material.color.set('#6a8ac8'); }
    box(ab, 1.6, 4.6, 1.6, st, -2.6, 0, 0);
    shape(ab, new THREE.ConeGeometry(1, 1, 4), std('#3c424b'), -2.6, 6.1, 0, 1.15, 3, 1.15).rotation.y = Math.PI / 4;
    ball(ab, 0.12, std('#d8b24a', { metalness: 0.9, roughness: 0.2 }), -2.6, 7.7, 0);
    for (const x of [-1, 0.6, 2.4]) box(ab, 0.3, 1.8, 0.4, st, x, 0, -1.6);
    plane(ab, 0.8, 1.3, std('#3a2416'), 0.8, 0.65, 1.52);
    h.glowsDef.push({ x: 0.8, y: 0.5, z: 19.9, color: '#ffc27a', pool: true, yb: hy, r: 1.4 });
    for (const s of [-1, 1]) { deco('erable', s * 8, hy, 18.6, 1.2); deco('lampe', s * 1.1, GY, 12.7); deco('banc', s * 6, hy, 15.6, 1, Math.PI); }
    // remparts autour de la ville (avec créneaux) et tours d'angle
    const rp = wallMat('rp', 'stone');
    const wall = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), w = box(root, 0.5, 1.5, len, rp, (x0 + x1) / 2, 0, (z0 + z1) / 2, a); for (let k = 0.3; k < len; k += 0.6) { const c = box(root, 0.5, 0.25, 0.3, rp, 0, 1.5, 0, a); c.position.set(x0 + Math.sin(a) * k, 1.5, z0 + Math.cos(a) * k); } return w; };
    for (const s of [-1, 1]) { wall(s * 13.05, -13.2, s * 13.05, 14.6); wall(s * 0.9, CANAL.z1 + 0.2, s * 13.05, CANAL.z1 + 0.2); }
    for (const [x, z] of [[-13, -13.2], [13, -13.2], [-13, 14.4], [13, 14.4], [-13, 0.6], [13, 0.6], [-1.1, CANAL.z1 + 0.2], [1.1, CANAL.z1 + 0.2]]) { cyl(root, 0.7, 2.3, rp, x, 0, z); shape(root, G.cone, std('#3c424b'), x, 2.75, z, 1.6, 0.9, 1.6); }
  } else if (D === 'futur') {
    const sp = sub(root, 0, hy, 18.6), white = std('#e6eaf0', { roughness: 0.2, metalness: 0.3 });
    cyl(sp, 1.4, 0.4, white, 0, 0, 0);
    shape(sp, new THREE.CylinderGeometry(0.15, 0.6, 1, 8), white, 0, 3.6, 0, 1, 6.4, 1);
    const rings = [2.4, 4.2, 5.8].map((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.18, 0.05, 8, 40), glowMat('spireRing' + i, ['#3ff0ff', '#ff4fd8', '#8aff5a'][i], null, 1, 3.5, 0)); r.position.set(0, y, 0); r.rotation.x = Math.PI / 2; sp.add(r); r.userData.dynamic = true; return r; });
    ball(sp, 0.18, glowMat('spireTop', '#ffffff', null, 1, 5, 0), 0, 7, 0);
    anims.push((dt, t) => rings.forEach((r, i) => { r.rotation.z = t * (0.4 + i * 0.3); r.position.y = [2.4, 4.2, 5.8][i] + Math.sin(t + i) * 0.15; }));
    h.glowsDef.push({ x: 0, y: 1, z: 18.6, color: '#3ff0ff', pool: true, yb: hy, r: 2.4, strong: true });
    for (const s of [-1, 1]) { deco('sakura', s * 6.5, hy, 18.6, 1); deco('cerisier', s * 10, hy, 18.4, 1.2); deco('kiosque', s * 3.5, hy, 16.5, 1); deco('toro', s * 1.1, GY, 12.7); }
    deco('torii', 0, hy, HILL.z0 + 0.7, 1.2);
  } else if (D === 'med') {
    // chapelle blanche à coupole bleue et moulin à vent
    const ch = sub(root, -1.5, hy, 18.4), w = std('#f8f7f3', { roughness: 0.85 });
    box(ch, 2.8, 1.8, 2.4, w, 0, 0, 0);
    dome(ch, 1.05, 0, 1.8, 0);
    box(ch, 0.9, 2.6, 0.5, w, 1.3, 0, 1.0); // clocher-mur
    const bell = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI), w); bell.position.set(1.3, 2.4, 1.0); ch.add(bell);
    ball(ch, 0.08, std('#c9a24a', { metalness: 0.8 }), 1.3, 2.28, 1.0);
    plane(ch, 0.6, 1.1, std('#2b5fa8'), 0, 0.55, 1.21);
    h.glowsDef.push({ x: -1.5, y: 0.5, z: 19.8, color: '#ffe2a8', pool: true, yb: hy, r: 1.3 });
    const mill = sub(root, 6, hy, 18.8);
    cyl(mill, 0.75, 2.4, w, 0, 0, 0); shape(mill, G.cone, std('#9a6a3a'), 0, 2.75, 0, 1.6, 0.7, 1.6);
    const sails = sub(mill, 0, 2.4, 0.78); sails.userData.dynamic = true;
    for (let i = 0; i < 4; i++) { const a = sub(sails, 0, 0, 0); a.rotation.z = (i * Math.PI) / 2; box(a, 0.05, 1.5, 0.03, std('#7a5a3a'), 0, 0, 0); box(a, 0.3, 1.2, 0.01, std('#f4efe4', { side: THREE.DoubleSide }), 0.18, 0.3, 0); }
    anims.push((dt, t) => (sails.rotation.z = t * 0.5));
    for (const s of [-1, 1]) { deco('erable', s * 10, hy, 19, 1.2); deco('cerisier', s * 3.5, hy, 19.6, 1); deco('bambou', s * 1.6, hy, 16.4, 1); deco('toro', s * 1.1, GY, 12.7); }
    deco('erable', -10.5, hy, 16.8, 1);
  }
  // rive sud : bateaux, plage
  const boats = [];
  const floatBoat = (x, z, hull, sail, s = 1) => { const b = new THREE.Group(); boatModel(b, hull, sail, s); b.position.set(x, CANAL.water, z); b.rotation.y = Math.random() * 6; scene.add(b); boats.push(b); };
  if (T.sea) {
    floatBoat(-7, -18.5, '#f4f1ea', true, 1.3); floatBoat(8, -19.8, D === 'med' ? '#2b5fa8' : '#c8402e', true, 1.1); floatBoat(4, -17, '#3a8a6a', false, 0.9);
    for (const x of [-10, -5, 5, 10]) { const p = deco('caisses', x, h.BEACH_Y, CANAL.z1 - 1.2, 1); p; }
    for (const [x, c] of [[-8.5, '#c8402e'], [-3, '#f2c14e'], [6.5, '#2f6fa8'], [11, '#3a8a6a']]) { cyl(root, 0.02, 1, std('#ddd'), x, h.BEACH_Y, CANAL.z1 - 1.5); shape(root, G.cone, std(c, { side: THREE.DoubleSide }), x, h.BEACH_Y + 1.02, CANAL.z1 - 1.5, 1, 0.25, 1); box(root, 0.5, 0.01, 0.9, std(c), x + 0.5, h.BEACH_Y + 0.005, CANAL.z1 - 1.3); }
  } else if (D !== 'futur') floatBoat(7, -17.6, D === 'europe' ? '#5a3e2a' : '#f4f1ea', false, 1.1);
  for (const s of [-1, 1]) if (!T.sea) { deco('erable', s * 4, GY, -19.4, 1); deco('cerisier', s * 9, GY, -19.5, 1.1); deco('toro', s * 6, GY, -20.9); }
  return (dt, t, night) => { anims.forEach(f => f(dt, t, night)); boats.forEach((b, i) => { b.position.y = CANAL.water + Math.sin(t * 0.9 + i) * 0.03; b.rotation.z = Math.sin(t * 0.7 + i) * 0.04; }); };
}

// Voiture volante (néo-cité)
export function makeHoverCar(color) {
  const g = new THREE.Group(), body = std(color, { roughness: 0.25, metalness: 0.5 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 10), body); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.75); g.add(b);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#8fd8ff', { roughness: 0.05, transparent: true, opacity: 0.7 })); cab.position.set(0.05, 0.08, 0); g.add(cab);
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), glowMat('underglow' + color, '#3ff0ff', null, 1.5, 4, 0)); under.rotation.x = Math.PI / 2; under.position.y = -0.14; under.scale.set(2, 1, 1); g.add(under);
  for (const k of [-1, 1]) { const l = ball(g, 0.03, glowMat('headlight', '#ffffff', null, 2, 5, 0), 0.46, 0, k * 0.08); l; }
  for (const k of [-1, 1]) ball(g, 0.025, glowMat('taillight', '#ff3a5a', null, 2, 5, 0), -0.46, 0, k * 0.08);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Teintes des sols du quartier
export const GROUND = {
  japon: {}, moderne: { pave: '#e6e2da', gain: 1.9, grass: '#b8d8a0', road: '#c8c8c8' }, cotier: { pave: '#efe2c8', gain: 1.6, grass: '#d8e0b0', road: '#d8d0c0' },
  europe: { pave: '#c8c4bc', gain: 1.2, grass: '#c0d0a8', road: '#d8d0c8', roadPave: true }, futur: { pave: '#6a7488', grass: '#4a6a8a', road: '#5a6070' }, med: { pave: '#fbf6ea', gain: 2.1, grass: '#e0d8a8', road: '#f0e8d8' },
}[DISTRICT];
export const WATER = { japon: ['#1d4a52', 0.78], moderne: ['#2a8f9f', 0.8], cotier: ['#1f9fb0', 0.85], europe: ['#2c4f58', 0.82], futur: ['#0a2a4a', 0.85, '#1fb8ff'], med: ['#1aa0c8', 0.85] }[DISTRICT];

if (THEMED) { HOOKS.building = buildThemed; HOOKS.decor = themedDecor; FONT.sign = T.font; }
