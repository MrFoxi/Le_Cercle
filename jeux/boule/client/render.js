// Rendu 3D de Boule de Pute (Three.js). Six arènes : Gymnase Cosmique, Néon City, Cantine scolaire, Piscine municipale,
// Usine énergétique (tapis roulants, pistons), Arène dans le ciel (îles flottantes). Personnages en blocs façon jouet
// (tête cubique au visage peint qui change d'expression, maillot à numéro, bras et jambes qui balancent), accessoires
// ridicules, emotes, impulsion de renvoi (dôme d'énergie), boule lumineuse (sans éblouir) dont la traînée dépend de qui
// l'a renvoyée, cercle de timing, marqueur de visée, onde de choc et zoom des renvois parfaits, confettis, caméra à la
// troisième personne (ou imposée, pour le replay).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BD = window.BD, { A, P, B, ARENAS } = BD;
export const TEAM = ['#ff7a2f', '#2fc4d6', '#ffd23f', '#a46bff', '#ff4f8b', '#2bd28f', '#3d8bff', '#e8e8e8'], TEAM_NAMES = ['Les Mandarines', 'Les Lagons'];
const TEAM_D = ['#c9501a', '#1a8c9c', '#c9a227', '#6f3fc9', '#c42a5f', '#1a9a63', '#2a5fc9', '#9a9aa4'], TEAM_L = ['#ffd2a8', '#b4f1f7', '#fff1b0', '#dcc8ff', '#ffc2d6', '#b8f5d8', '#c2d8ff', '#ffffff'];
export const LOOKS = {
  bobby: { name: 'Bobby', skin: '#f3bf93', hair: '#ff6a1f', shoe: '#ffffff', price: 0 },
  mama: { name: 'Mama Gloria', skin: '#8a5634', hair: '#1d1410', shoe: '#ff4fa3', price: 0 },
  tonton: { name: 'Tonton Raoul', skin: '#d79c6c', hair: '#2a1a12', shoe: '#222222', price: 0 },
  zaza: { name: 'Zaza', skin: '#ffe0c8', hair: '#4aa8ff', shoe: '#ffe14a', price: 0 },
  robox: { name: 'Robox', skin: '#aeb8c4', hair: '#5b6675', shoe: '#5b6675', price: 0 },
  mamie: { name: 'Mamie Turbo', skin: '#f6d0b4', hair: '#dcdce4', shoe: '#9b59ff', price: 0 },
  chef: { name: 'Chef Bistouille', skin: '#f2c49b', hair: '#3a2418', shoe: '#222222', price: 250 },
  catcheur: { name: 'El Gigoto', skin: '#c98a5e', hair: '#e5223d', shoe: '#ffd23f', price: 300 },
  astro: { name: 'Cosmo', skin: '#ffd9c0', hair: '#f4f6fa', shoe: '#f4f6fa', price: 350 },
  vampire: { name: 'Comte Dracoolos', skin: '#dfe4ea', hair: '#141018', shoe: '#141018', price: 400 },
  pigeon: { name: 'Roucoulos', skin: '#8f98a8', hair: '#5d6778', shoe: '#ff9a3c', price: 500 },
};
export const ACC_NAMES = { aucun: 'Rien', moustache: 'Moustache géante', frites: 'Couronne de frites', helice: 'Bonnet à hélice', banane: 'Banane', noeud: 'Nœud papillon' };
export const ACC_PRICES = { aucun: 0, moustache: 100, frites: 200, helice: 150, banane: 120, noeud: 80 };
export const TRAIL_NAMES = { classique: 'Classique', arcenciel: 'Arc-en-ciel', flammes: 'Flammes', coeurs: 'Cœurs', eclairs: 'Éclairs' };
export const TRAIL_PRICES = { classique: 0, arcenciel: 300, flammes: 200, coeurs: 250, eclairs: 250 };
export const EMOTE_ICONS = { danse: '🕺', moque: '😜', pleure: '😭', bravo: '👏' };
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= Visages ================= */
// expr : idle, shout, fear, dead, win, sad
function faceCanvas(lookId, expr) {
  const L = LOOKS[lookId], c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = L.skin; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 100, 128, 28);
  if (lookId === 'catcheur') { g.fillStyle = '#e5223d'; g.fillRect(0, 0, 128, 76); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(64, 4); g.lineTo(76, 30); g.lineTo(64, 24); g.lineTo(52, 30); g.fill(); for (const x of [40, 88]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, 50, 18, 13, 0, 0, TAU); g.fill(); } }
  const robot = lookId === 'robox', ink = robot ? '#00e5ff' : lookId === 'vampire' && expr !== 'dead' ? '#d0102a' : lookId === 'pigeon' ? '#ff8a1a' : '#1b1214';
  for (const x of [40, 88]) {
    if (expr === 'dead') { g.strokeStyle = '#1b1214'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 9, 42); g.lineTo(x + 9, 60); g.moveTo(x + 9, 42); g.lineTo(x - 9, 60); g.stroke(); continue; }
    if (expr === 'win') { g.strokeStyle = '#1b1214'; g.lineWidth = 7; g.beginPath(); g.arc(x, 56, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    if (expr === 'sad') { g.strokeStyle = '#1b1214'; g.lineWidth = 6; g.beginPath(); g.arc(x, 46, 10, 0.2, Math.PI - 0.2); g.stroke(); g.fillStyle = '#5ab8ff'; g.fillRect(x - 3, 54, 6, 30); continue; }
    if (expr === 'fear') { g.fillStyle = '#ffffff'; g.fillRect(x - 10, 36, 20, 26); g.fillStyle = ink; g.fillRect(x - 4, 44, 8, 10); continue; }
    if (robot) { g.fillStyle = ink; g.shadowColor = ink; g.shadowBlur = 8; g.fillRect(x - 10, 44, 20, 12); g.shadowBlur = 0; continue; }
    if (lookId === 'pigeon') { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, 48, 11, 0, TAU); g.fill(); g.fillStyle = ink; g.beginPath(); g.arc(x, 48, 7, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(x, 48, 3.5, 0, TAU); g.fill(); continue; }
    g.fillStyle = ink; g.fillRect(x - 4, 38, 9, 22);
  }
  if (!robot && lookId !== 'pigeon' && expr !== 'dead') {
    g.fillStyle = lookId === 'mamie' ? '#9a9aa4' : lookId === 'catcheur' ? '#1b1214' : '#2a1a14';
    const tilt = expr === 'shout' ? 7 : expr === 'fear' || expr === 'sad' ? -7 : 0;
    for (const [x, s] of [[40, 1], [88, -1]]) { g.save(); g.translate(x, 28); g.rotate((tilt * s * Math.PI) / 180 * 2.2); g.fillRect(-14, -4, 28, 8); g.restore(); }
  }
  // bouche (le pigeon a un bec en volume)
  if (lookId !== 'pigeon') {
    if (expr === 'shout' || expr === 'win') { g.fillStyle = '#6e1626'; g.fillRect(40, 78, 48, expr === 'win' ? 26 : 34); g.fillStyle = '#ffffff'; g.fillRect(40, 78, 48, 9); g.fillStyle = '#ff6f86'; g.fillRect(50, expr === 'win' ? 96 : 102, 28, 8); }
    else if (expr === 'fear') { g.fillStyle = '#6e1626'; g.fillRect(56, 80, 16, 20); }
    else if (expr === 'sad') { g.strokeStyle = '#6e1626'; g.lineWidth = 6; g.beginPath(); g.arc(64, 100, 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else if (expr === 'dead') { g.strokeStyle = '#1b1214'; g.lineWidth = 5; g.beginPath(); g.moveTo(44, 90); for (let k = 1; k <= 6; k++) g.lineTo(44 + k * 7, 90 + (k % 2 ? 6 : -4)); g.stroke(); }
    else if (robot) { g.fillStyle = ink; for (let k = 0; k < 5; k++) g.fillRect(40 + k * 10, 84, 6, 8); }
    else { g.fillStyle = '#6e1626'; g.fillRect(46, 84, 36, 8); g.fillStyle = '#ffffff'; g.fillRect(46, 84, 36, 3); }
    if (lookId === 'vampire' && expr !== 'dead') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(50, 84); g.lineTo(56, 84); g.lineTo(53, 96); g.fill(); g.beginPath(); g.moveTo(72, 84); g.lineTo(78, 84); g.lineTo(75, 96); g.fill(); }
  }
  if (lookId === 'zaza' || lookId === 'mamie') { g.strokeStyle = lookId === 'zaza' ? '#ff4fa3' : '#c9a227'; g.lineWidth = 4; for (const x of [40, 88]) g.strokeRect(x - 15, 34, 30, 30); g.beginPath(); g.moveTo(55, 46); g.lineTo(73, 46); g.stroke(); }
  if (lookId === 'bobby') { g.fillStyle = 'rgba(200,90,40,.45)'; for (const [x, y] of [[30, 70], [36, 74], [92, 70], [98, 74]]) g.fillRect(x, y, 4, 4); }
  if (!robot && lookId !== 'pigeon' && lookId !== 'vampire') { g.fillStyle = 'rgba(255,90,110,.35)'; g.fillRect(16, 66, 18, 10); g.fillRect(94, 66, 18, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
const faceCache = new Map();
const face = (look, expr) => { const k = `${look}:${expr}`; if (!faceCache.has(k)) faceCache.set(k, faceCanvas(look, expr)); return faceCache.get(k); };
function jerseyTex(team, num) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = TEAM[team % 8]; g.fillRect(0, 0, 64, 64);
  g.fillStyle = TEAM_L[team % 8]; g.fillRect(0, 0, 64, 6); g.beginPath(); g.moveTo(22, 0); g.lineTo(32, 12); g.lineTo(42, 0); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'bold 30px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 32, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ================= Personnage en blocs ================= */
let gradient = null;
function toon(color, extra = {}) {
  if (!gradient) { gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat); gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; }
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
}
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m; }
function accessory(head, body, acc) {
  if (acc === 'moustache') { const m = toon('#2a1a12'); box(0.62, 0.1, 0.08, m, 0, 0.24, 0.33, head); box(0.12, 0.16, 0.08, m, -0.32, 0.18, 0.33, head); box(0.12, 0.16, 0.08, m, 0.32, 0.18, 0.33, head); }
  if (acc === 'frites') { const y = toon('#ffd23f'), r = toon('#e5223d'); box(0.5, 0.14, 0.5, r, 0, 0.7, 0, head); for (let k = 0; k < 9; k++) box(0.06, 0.26 + (k % 3) * 0.06, 0.06, y, -0.2 + (k % 3) * 0.2, 0.86, -0.2 + Math.floor(k / 3) * 0.2, head); }
  let prop = null;
  if (acc === 'helice') { box(0.66, 0.16, 0.62, toon('#ff4f8b'), 0, 0.7, 0, head); box(0.06, 0.16, 0.06, toon('#ffd23f'), 0, 0.86, 0, head); prop = new THREE.Group(); prop.position.set(0, 0.95, 0); head.add(prop); box(0.6, 0.03, 0.1, toon('#3d8bff'), 0, 0, 0, prop); box(0.1, 0.03, 0.6, toon('#2bd28f'), 0, 0, 0, prop); }
  if (acc === 'banane') { const y = toon('#ffe14a'); for (let k = 0; k < 5; k++) box(0.12, 0.12, 0.14, y, -0.24 + k * 0.12, 0.72 + Math.sin((k / 4) * Math.PI) * 0.14, 0, head); box(0.05, 0.08, 0.05, toon('#5a3a1e'), -0.3, 0.78, 0, head); }
  if (acc === 'noeud') { const r = toon('#e5223d'); box(0.16, 0.14, 0.06, r, -0.1, 1.36, 0.21, body); box(0.16, 0.14, 0.06, r, 0.1, 1.36, 0.21, body); box(0.07, 0.07, 0.07, toon('#9a1020'), 0, 1.36, 0.22, body); }
  return prop;
}
function makeChar(lookId, team, num, acc = 'aucun') {
  const L = LOOKS[lookId] ?? LOOKS.bobby, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const tc = TEAM[team % 8], skin = toon(L.skin), jersey = toon(tc), shorts = toon(TEAM_D[team % 8]), band = toon(TEAM_L[team % 8]), shoe = toon(L.shoe), hair = toon(L.hair);
  const legSkin = lookId === 'astro' ? toon('#f4f6fa') : lookId === 'pigeon' ? toon('#ff9a3c') : skin;
  const legs = [-0.14, 0.14].map(x => { const g = new THREE.Group(); g.position.set(x, 0.66, 0); body.add(g); box(0.2, 0.5, 0.22, legSkin, 0, -0.27, 0, g); box(0.21, 0.08, 0.23, band, 0, -0.47, 0, g); box(0.24, 0.13, 0.38, shoe, 0, -0.6, 0.06, g); return g; });
  box(0.66, 0.2, 0.42, shorts, 0, 0.7, 0, body);
  const jm = toon('#ffffff', { map: jerseyTex(team, num) });
  box(0.64, 0.6, 0.4, [jersey, jersey, jersey, jersey, jm, jersey], 0, 1.08, 0, body);
  const armSkin = lookId === 'astro' ? toon('#f4f6fa') : skin;
  const arms = [-0.42, 0.42].map(x => { const g = new THREE.Group(); g.position.set(x, 1.3, 0); body.add(g); box(lookId === 'pigeon' ? 0.1 : 0.18, 0.5, lookId === 'pigeon' ? 0.42 : 0.2, lookId === 'pigeon' ? hair : armSkin, 0, -0.24, 0, g); box(0.2, 0.09, 0.22, band, 0, -0.4, 0, g); box(0.2, 0.12, 0.21, jersey, 0, -0.04, 0, g); return g; });
  const head = new THREE.Group(); head.position.set(0, 1.4, 0); body.add(head);
  const fm = toon('#ffffff', { map: face(lookId, 'idle') });
  box(0.66, 0.62, 0.6, [skin, skin, skin, skin, fm, skin], 0, 0.32, 0, head);
  if (lookId === 'bobby') { box(0.18, 0.32, 0.62, hair, 0, 0.78, -0.02, head); box(0.68, 0.1, 0.62, band, 0, 0.5, 0, head); box(0.68, 0.12, 0.2, hair, 0, 0.62, -0.22, head); }
  if (lookId === 'mama') { box(0.92, 0.55, 0.82, hair, 0, 0.82, -0.08, head); for (const [x, y, z] of [[-0.4, 1.05, 0.2], [0.42, 0.95, -0.3], [0, 1.1, -0.35], [-0.35, 0.8, -0.42]]) box(0.3, 0.3, 0.3, hair, x, y, z, head); box(0.7, 0.1, 0.64, toon('#ff4fa3'), 0, 0.55, 0, head); }
  if (lookId === 'tonton') { box(0.42, 0.1, 0.08, hair, 0, 0.22, 0.32, head); box(0.68, 0.06, 0.6, hair, 0, 0.64, -0.02, head); const gl = toon('#111118'); box(0.22, 0.12, 0.04, gl, -0.15, 0.42, 0.31, head); box(0.22, 0.12, 0.04, gl, 0.15, 0.42, 0.31, head); box(0.1, 0.03, 0.04, gl, 0, 0.45, 0.31, head); }
  if (lookId === 'zaza') { box(0.7, 0.16, 0.64, hair, 0, 0.67, 0, head); box(0.7, 0.18, 0.12, hair, 0, 0.58, 0.27, head); for (const s of [-1, 1]) { box(0.16, 0.36, 0.16, hair, s * 0.42, 0.42, -0.1, head); box(0.12, 0.12, 0.12, toon('#ff4fa3'), s * 0.42, 0.62, -0.1, head); } }
  if (lookId === 'robox') { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), hair); an.position.set(0, 0.8, 0); head.add(an); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5a5a' })); bulb.position.set(0, 1.0, 0); head.add(bulb); for (const s of [-1, 1]) box(0.08, 0.24, 0.24, hair, s * 0.37, 0.32, 0, head); }
  if (lookId === 'mamie') { box(0.7, 0.16, 0.64, hair, 0, 0.66, -0.02, head); box(0.32, 0.26, 0.3, hair, 0, 0.82, -0.15, head); for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI; const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon('#fffaf0')); pearl.position.set(Math.cos(a) * 0.25, 1.36, 0.12 + Math.sin(a) * 0.08); body.add(pearl); } }
  if (lookId === 'chef') { const w = toon('#ffffff'); box(0.6, 0.12, 0.56, w, 0, 0.68, 0, head); box(0.5, 0.42, 0.48, w, 0, 0.95, 0, head); for (const [x, z] of [[-0.18, 0.12], [0.18, 0.12], [0, -0.16]]) box(0.26, 0.2, 0.26, w, x, 1.18, z, head); box(0.42, 0.1, 0.08, hair, 0, 0.22, 0.32, head); box(0.68, 0.14, 0.42, w, 0, 1.1, 0.02, body); }
  if (lookId === 'catcheur') { box(0.67, 0.2, 0.61, hair, 0, 0.56, 0, head); box(0.08, 0.3, 0.3, toon('#ffd23f'), 0, 0.42, -0.2, head); }
  if (lookId === 'astro') { const glass = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, transmission: 0 })); glass.position.set(0, 0.34, 0); head.add(glass); box(0.7, 0.14, 0.64, toon('#c8ced8'), 0, 0.0, 0, head); box(0.4, 0.3, 0.16, toon('#c8ced8'), 0, 1.1, -0.28, body); }
  if (lookId === 'vampire') { box(0.7, 0.14, 0.64, hair, 0, 0.66, -0.02, head); box(0.1, 0.12, 0.08, hair, 0, 0.56, 0.3, head); const cape = toon('#7a0f1f'); box(0.9, 1.0, 0.08, cape, 0, 1.0, -0.26, body); for (const s of [-1, 1]) box(0.16, 0.4, 0.3, cape, s * 0.38, 1.42, -0.12, body); }
  if (lookId === 'pigeon') { box(0.3, 0.12, 0.3, toon('#ff9a3c'), 0, 0.25, 0.42, head); box(0.22, 0.08, 0.2, toon('#e07a20'), 0, 0.18, 0.38, head); box(0.68, 0.24, 0.62, toon('#5bb07a'), 0, 0.02, 0, head); box(0.2, 0.22, 0.2, hair, 0, 0.72, -0.1, head); }
  const prop = accessory(head, body, acc);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: TEAM_L[team % 8], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  dome.rotation.x = Math.PI / 2; dome.position.set(0, 1.0, 0.35); root.add(dome);
  return { root, body, legs, arms, head, fm, dome, prop, phase: Math.random() * 6, expr: 'idle', dead: 0, look: lookId, team };
}
function setExpr(ch, expr) { if (ch.expr === expr) return; ch.expr = expr; ch.fm.map = face(ch.look, expr); ch.fm.needsUpdate = true; }

// Portrait 2D pour les menus (vue de face, même style en blocs).
export function drawPortrait(canvas, lookId, team = 0, t = 0, acc = 'aucun') {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, L = LOOKS[lookId] ?? LOOKS.bobby;
  g.clearRect(0, 0, W, H);
  const bob = Math.sin(t * 3) * W * 0.01, s = W / 120;
  g.save(); g.translate(W / 2, H * 0.08 + bob); g.scale(s, s);
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); };
  rect(-26, 74, 52, 34, TEAM[team]); g.fillStyle = TEAM_L[team]; g.beginPath(); g.moveTo(-8, 74); g.lineTo(0, 82); g.lineTo(8, 74); g.fill();
  rect(-34, 76, 10, 30, lookId === 'pigeon' ? L.hair : L.skin); rect(24, 76, 10, 30, lookId === 'pigeon' ? L.hair : L.skin);
  if (lookId === 'vampire') { rect(-40, 70, 12, 38, '#7a0f1f'); rect(28, 70, 12, 38, '#7a0f1f'); }
  if (lookId === 'mama') { rect(-38, -2, 76, 44, L.hair); rect(-46, 6, 20, 20, L.hair); rect(26, 0, 20, 20, L.hair); }
  if (lookId === 'zaza') { rect(-36, 30, 10, 26, L.hair); rect(26, 30, 10, 26, L.hair); }
  g.drawImage(face(lookId, 'idle').image, -27, 22, 54, 52); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.strokeRect(-27, 22, 54, 52);
  if (lookId === 'bobby') { rect(-6, 2, 12, 22, L.hair); rect(-28, 26, 56, 6, TEAM_L[team]); }
  if (lookId === 'mama') rect(-28, 26, 56, 6, '#ff4fa3');
  if (lookId === 'tonton') { rect(-17, 58, 34, 6, L.hair); rect(-20, 36, 17, 9, '#111'); rect(3, 36, 17, 9, '#111'); rect(-28, 18, 56, 5, L.hair); }
  if (lookId === 'zaza') rect(-28, 16, 56, 14, L.hair);
  if (lookId === 'robox') { rect(-2, 4, 4, 18, L.hair); g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(0, 4, 5, 0, TAU); g.fill(); }
  if (lookId === 'mamie') { rect(-28, 16, 56, 10, L.hair); rect(-12, 4, 24, 14, L.hair); }
  if (lookId === 'chef') { rect(-24, 8, 48, 14, '#fff'); rect(-20, -16, 40, 26, '#fff'); rect(-17, 58, 34, 6, L.hair); }
  if (lookId === 'catcheur') rect(-28, 18, 56, 8, L.hair);
  if (lookId === 'astro') { g.strokeStyle = 'rgba(150,210,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 47, 38, 0, TAU); g.stroke(); g.fillStyle = 'rgba(190,230,255,.25)'; g.fill(); }
  if (lookId === 'vampire') { rect(-28, 18, 56, 8, L.hair); rect(-4, 24, 8, 6, L.hair); }
  if (lookId === 'pigeon') { rect(-10, 52, 20, 10, '#ff9a3c'); rect(-28, 70, 56, 8, '#5bb07a'); }
  if (acc === 'moustache') rect(-24, 56, 48, 7, '#2a1a12');
  if (acc === 'frites') { rect(-16, 12, 32, 8, '#e5223d'); for (let k = 0; k < 5; k++) rect(-14 + k * 7, -2, 4, 14, '#ffd23f'); }
  if (acc === 'helice') { rect(-28, 14, 56, 10, '#ff4f8b'); rect(-2, 4, 4, 10, '#ffd23f'); rect(-20 * Math.cos(t * 12), 2, 40 * Math.cos(t * 12) || 1, 3, '#3d8bff'); }
  if (acc === 'banane') { for (let k = 0; k < 5; k++) rect(-16 + k * 7, 10 - Math.sin((k / 4) * Math.PI) * 6, 7, 7, '#ffe14a'); }
  if (acc === 'noeud') { rect(-12, 76, 10, 8, '#e5223d'); rect(2, 76, 10, 8, '#e5223d'); }
  g.restore();
}

/* ================= Arènes ================= */
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
// Sol du terrain : motif de l'arène, moitiés teintées, lignes.
function floorTex(id) {
  return canvasTex(2048, 1260, (g, W, H) => {
    if (id === 'neon') { g.fillStyle = '#100a24'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,220,255,.35)'; g.lineWidth = 3; for (let x = 0; x <= W; x += W / 36) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += H / 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    else if (id === 'cantine') { const s = W / 36; for (let i = 0; i < 36; i++) for (let j = 0; j < 23; j++) { g.fillStyle = (i + j) % 2 ? '#e9e3d0' : '#c7d9c2'; g.fillRect(i * s, j * s, s, s); } }
    else if (id === 'piscine') { const s = W / 60; for (let i = 0; i < 60; i++) for (let j = 0; j < 38; j++) { g.fillStyle = (i + j) % 7 ? '#e9f6fb' : '#bfe4f0'; g.fillRect(i * s, j * s, s - 2, s - 2); } }
    else if (id === 'usine') { g.fillStyle = '#5c636e'; g.fillRect(0, 0, W, H); for (let i = 0; i < 24; i++) for (let j = 0; j < 14; j++) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(i * W / 24, j * H / 14, W / 24, H / 14); g.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 6; k++) g.fillRect(i * W / 24 + 10 + k * 12, j * H / 14 + 10 + (k % 2) * 12, 8, 3); } }
    else if (id === 'ciel') { g.fillStyle = '#6cc04a'; g.fillRect(0, 0, W, H); for (let k = 0; k < 3000; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,30,.25)' : 'rgba(170,240,120,.25)'; g.fillRect(Math.random() * W, Math.random() * H, 3, 6); } }
    else { const pw = W / 26, ph = H / 6; for (let i = 0; i < 26; i++) for (let j = 0; j < 6; j++) { const off = (i % 2) * ph * 0.5, l = 58 + ((i * 7 + j * 13) % 9); g.fillStyle = `hsl(28, 55%, ${l}%)`; g.fillRect(i * pw, j * ph - off, pw - 2, ph - 2); g.fillRect(i * pw, (j + 1) * ph - off, pw - 2, ph - 2); } }
    g.fillStyle = id === 'neon' ? 'rgba(255,122,47,.10)' : 'rgba(255,122,47,.14)'; g.fillRect(0, 0, W / 2, H); g.fillStyle = id === 'neon' ? 'rgba(47,196,214,.10)' : 'rgba(47,196,214,.14)'; g.fillRect(W / 2, 0, W / 2, H);
    g.strokeStyle = id === 'neon' ? 'rgba(255,90,200,.9)' : 'rgba(255,255,255,.9)'; g.lineWidth = 10; const m = 26;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m); g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, H - m); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, H * 0.16, 0, TAU); g.stroke();
  });
}
function buildArena(id) {
  const root = new THREE.Group(), AR = ARENAS[id] ?? ARENAS.gym, FX = A.X + 1.2, FZ = A.Z + 1.2, RX = A.X + 7, RZ = A.Z + 8, H = 13;
  const looks = { gym: { bg: '#f7d9a8', wall: '#ffe9b0', base: '#c96a3d', outer: '#d9925a', hemi: ['#fff4dd', '#c98a5a', 1.25], sun: 2.4 }, neon: { bg: '#07051a', wall: '#1a1236', base: '#2a1a4a', outer: '#0d0a20', hemi: ['#7a6aff', '#20103a', 0.7], sun: 0.6 }, cantine: { bg: '#e8f0d8', wall: '#d6ead0', base: '#7a9a6a', outer: '#b9c9a8', hemi: ['#fffaf0', '#a0b090', 1.2], sun: 2 }, piscine: { bg: '#cfeeff', wall: '#e9f7ff', base: '#4aa8d8', outer: '#d8eef8', hemi: ['#ffffff', '#8ac8e8', 1.25], sun: 2.2 }, usine: { bg: '#3a3f48', wall: '#4a505a', base: '#2b2f36', outer: '#3a3f48', hemi: ['#ffe2c0', '#30343c', 1.0], sun: 1.6 }, ciel: { bg: '#8fd0ff', wall: null, base: null, outer: null, hemi: ['#ffffff', '#7ab8e8', 1.3], sun: 2.4 } }[id] ?? {};
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(id), roughness: id === 'neon' ? 0.3 : 0.6, emissive: id === 'neon' ? '#ffffff' : '#000000', emissiveMap: id === 'neon' ? floorTex('neon') : null, emissiveIntensity: id === 'neon' ? 0.35 : 0 });
  if (AR.islands) { // îles flottantes : herbe dessus, terre dessous
    for (const [x0, x1, z0, z1] of AR.islands) { const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(w, 0.3, d, toon('#6cc04a'), cx, -0.15, cz, root); const dirt = box(w * 0.92, 2.2, d * 0.92, toon('#8a5a32'), cx, -1.4, cz, root); dirt.scale.set(1, 1, 1); box(w * 0.6, 1.4, d * 0.6, toon('#6e4526'), cx, -3.1, cz, root); }
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    for (let k = 0; k < 40; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 10, 8), cloudMat); c.position.set((Math.random() - 0.5) * 90, -12 - Math.random() * 10, (Math.random() - 0.5) * 70); c.scale.y = 0.45; root.add(c); }
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * FX, 2 * FZ), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ), toon(looks.outer)); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; root.add(outer);
    for (const s of [-1, 1]) for (const t of [0, 1]) { box(FX, 1.1, 0.35, toon(TEAM[t]), (t ? 1 : -1) * FX / 2, 0.55, s * FZ, root); box(FX, 0.12, 0.37, toon(id === 'neon' ? '#ff5ac8' : '#ffffff'), (t ? 1 : -1) * FX / 2, 1.12, s * FZ, root); }
    for (const s of [-1, 1]) box(0.35, 1.1, 2 * FZ, toon(TEAM[s > 0 ? 1 : 0]), s * FX, 0.55, 0, root);
    const wallMat = toon(looks.wall), baseMat = toon(looks.base);
    const wall = (w, x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); box(w, H, 0.4, wallMat, 0, H / 2, 0, g); box(w, 2.2, 0.45, baseMat, 0, 1.1, 0.02, g); return g; };
    const back = wall(2 * RX, 0, -RZ, 0); wall(2 * RZ, -RX, 0, Math.PI / 2); wall(2 * RZ, RX, 0, -Math.PI / 2);
    for (let k = -3; k <= 3; k++) box(0.35, 0.5, 2 * RZ, toon(id === 'usine' ? '#c9a227' : id === 'neon' ? '#2a1a4a' : '#b9845c'), k * 6, H - 0.6, 0, root);
    if (id === 'gym' || id === 'cantine' || id === 'piscine') {
      const sky = canvasTex(256, 256, (g, W, H2) => { const gr = g.createLinearGradient(0, 0, 0, H2); gr.addColorStop(0, '#5ab8ff'); gr.addColorStop(1, '#c9ecff'); g.fillStyle = gr; g.fillRect(0, 0, W, H2); g.fillStyle = '#ffffff'; for (const [x, y, r] of [[60, 70, 26], [90, 64, 30], [120, 74, 22], [190, 150, 24], [215, 144, 28]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.fillStyle = '#7fd36b'; g.beginPath(); g.moveTo(0, H2); g.lineTo(80, 180); g.lineTo(150, 230); g.lineTo(220, 170); g.lineTo(256, 200); g.lineTo(256, H2); g.fill(); });
      for (let k = -3; k <= 3; k++) { if (k === 0) continue; const win = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.4), new THREE.MeshBasicMaterial({ map: sky })); win.position.set(k * 7, 7.5, 0.23); back.add(win); box(4.5, 0.25, 0.3, toon('#8a5a3a'), k * 7, 5.8, 0.25, back); box(4.5, 0.25, 0.3, toon('#8a5a3a'), k * 7, 9.2, 0.25, back); }
      for (let k = -3; k <= 3; k++) for (const z of [-5, 5]) { const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 16), new THREE.MeshBasicMaterial({ color: '#fff6e0' })); lamp.position.set(k * 6, H - 1.1, z); root.add(lamp); }
    }
    if (id === 'neon') { // bandes de néon sur les murs et le plafond
      for (const [y, col] of [[2.6, '#ff5ac8'], [5.5, '#5af0ff'], [8.4, '#b06aff']]) { const m = new THREE.MeshBasicMaterial({ color: col }); box(2 * RX, 0.12, 0.1, m, 0, y, -RZ + 0.3, root); box(0.1, 0.12, 2 * RZ, m, -RX + 0.3, y, 0, root); box(0.1, 0.12, 2 * RZ, m, RX - 0.3, y, 0, root); }
      for (let k = -2; k <= 2; k++) { const l = new THREE.PointLight(k % 2 ? '#ff5ac8' : '#5af0ff', 18, 22, 1.8); l.position.set(k * 8, 6, 0); root.add(l); }
    }
    if (id === 'cantine') { // tables avec plateaux, comptoir, affiches
      const tableM = toon('#e8eef4'), legM = toon('#8a93a2'), tray = toon('#ff8a3d'), plate = toon('#ffffff');
      for (const [x, z, w, d, h] of AR.boxes) { box(w, 0.1, d, tableM, x, h, z, root); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, h, 0.1, legM, x + sx * (w / 2 - 0.15), h / 2, z + sz * (d / 2 - 0.15), root); for (let k = 0; k < 2; k++) { box(0.6, 0.04, 0.4, tray, x + (k - 0.5) * w * 0.45, h + 0.07, z, root); const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), plate); pl.position.set(x + (k - 0.5) * w * 0.45, h + 0.1, z); root.add(pl); } }
      box(10, 1.2, 1.2, toon('#9aa3b2'), 0, 0.6, -RZ + 1.2, root); box(10, 0.1, 1.3, toon('#c9d2e0'), 0, 1.25, -RZ + 1.2, root);
      for (const [x, col] of [[-12, '#ff5a7a'], [12, '#3d8bff']]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), toon(col)); p.position.set(x, 6, 0.23); back.add(p); }
    }
    if (id === 'piscine' && AR.water) { // bassin au milieu, lignes d'eau, chaise de maître-nageur
      const [w0, w1] = AR.water;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w1 - w0, 2 * FZ, 30, 30), new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: { value: 0 } }, vertexShader: 'uniform float uT; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 2.0 + uT * 2.0) * 0.05 + cos(p.y * 1.5 + uT * 1.6) * 0.05; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }', fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float c = 0.5 + 0.5 * sin(vUv.x * 40.0 + uT * 2.0) * sin(vUv.y * 30.0 - uT * 1.5); gl_FragColor = vec4(mix(vec3(0.15,0.55,0.85), vec3(0.6,0.9,1.0), c * 0.5), 0.85); }' }));
      water.rotation.x = -Math.PI / 2; water.position.set((w0 + w1) / 2, 0.02, 0); root.add(water); root.userData.water = water;
      for (let k = -2; k <= 2; k++) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, w1 - w0, 8), toon(k % 2 ? '#ff4f8b' : '#ffffff')); rope.rotation.z = Math.PI / 2; rope.position.set(0, 0.1, k * 4); root.add(rope); }
      const chair = new THREE.Group(); chair.position.set(0, 0, -FZ - 2); root.add(chair); for (const s of [-1, 1]) box(0.12, 3, 0.12, toon('#ffffff'), s * 0.6, 1.5, 0, chair); box(1.4, 0.15, 1.0, toon('#ff4f4f'), 0, 3, 0, chair); box(1.4, 1.0, 0.12, toon('#ff4f4f'), 0, 3.5, -0.45, chair);
    }
    if (id === 'usine') { // tapis roulants, pistons, tuyaux
      const beltTex = canvasTex(64, 64, (g) => { g.fillStyle = '#23262c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ffd23f'; for (let k = 0; k < 4; k++) g.fillRect(0, k * 16, 64, 5); }, [1, 4]);
      root.userData.belts = AR.belts.map(([x0, x1, z0, z1, , vz]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), new THREE.MeshStandardMaterial({ map: beltTex.clone(), roughness: 0.8 })); m.material.map.needsUpdate = true; m.material.map.repeat.set(4, 1); m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2); m.receiveShadow = true; root.add(m); return { m, vz }; });
      root.userData.pistons = AR.pistons.map(pi => { const head = new THREE.Mesh(new THREE.CylinderGeometry(pi[2], pi[2], 0.4, 24), toon('#ff6a2a')); head.position.set(pi[0], 0, pi[1]); head.castShadow = true; root.add(head); const ring = new THREE.Mesh(new THREE.RingGeometry(pi[2], pi[2] + 0.25, 32), toon('#ffd23f')); ring.rotation.x = -Math.PI / 2; ring.position.set(pi[0], 0.02, pi[1]); root.add(ring); return { head, pi }; });
      for (let k = 0; k < 6; k++) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2 * RX, 12), toon(k % 2 ? '#8a5a3a' : '#5a6b82')); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 4 + k * 1.3, -RZ + 1); root.add(pipe); }
    }
    if (id === 'gym') { // paniers et bancs
      for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * (RX - 0.4), 0, 0); g.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(g); box(0.25, 5.5, 0.25, toon('#555b66'), 0, 2.75, 0.4, g); box(2.2, 1.4, 0.1, toon('#ffffff'), 0, 5.6, 0.9, g); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 20), toon('#ff5a2a')); ring.rotation.x = Math.PI / 2; ring.position.set(0, 5.1, 1.3); g.add(ring); }
      for (const t of [0, 1]) for (const z of [-1, 1]) { const g = new THREE.Group(); g.position.set((t ? 1 : -1) * (A.X + 3.2), 0, z * 5); root.add(g); box(0.6, 0.12, 3.2, toon('#9a6440'), 0, 0.5, 0, g); }
    }
  }
  // barrière d'énergie au milieu (en équipes)
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(2 * A.Z, 3.2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float s = 0.5 + 0.5 * sin((vUv.y * 18.0 - uT * 3.0)); float hex = 0.5 + 0.5 * sin(vUv.x * 60.0 + uT) * sin(vUv.y * 30.0 - uT * 2.0); float edge = smoothstep(1.0, 0.0, vUv.y); float a = (0.06 + 0.14 * s * hex) * edge + 0.35 * smoothstep(0.03, 0.0, abs(vUv.y - 0.02)); gl_FragColor = vec4(mix(vec3(1.0,0.55,0.2), vec3(0.2,0.9,1.0), vUv.x), a); }',
  }));
  barrier.rotation.y = Math.PI / 2; barrier.position.set(0, 1.6, 0); root.add(barrier); root.userData.barrier = barrier;
  // tableau de score suspendu
  const score = document.createElement('canvas'); score.width = 1024; score.height = 512;
  const scoreTex = new THREE.CanvasTexture(score); scoreTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: scoreTex })); board.position.set(0, 8.5, -A.Z - 6.5); root.add(board);
  box(10.6, 5.6, 0.2, toon('#3a2b26'), 0, 8.5, -A.Z - 6.62, root);
  root.userData.score = { canvas: score, tex: scoreTex };
  return { root, looks };
}

/* ================= Le tout ================= */
export function createArena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 300);
  const hemi = new THREE.HemisphereLight('#fff4dd', '#c98a5a', 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d0', 2.4); sun.position.set(-8, 20, -12); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 18, bottom: -18, near: 1, far: 70 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  let arena = null, arenaId = null;
  function setArena(id) {
    if (id === arenaId) return; arenaId = id;
    if (arena) scene.remove(arena.root);
    arena = buildArena(id); scene.add(arena.root);
    const L = arena.looks; scene.background = new THREE.Color(L.bg ?? '#f7d9a8'); hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; sun.intensity = L.sun;
    scene.fog = id === 'ciel' ? new THREE.Fog('#8fd0ff', 40, 120) : null;
    lastScore = '';
  }
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.35, 0.97); composer.addPass(bloom); // halo discret
  composer.addPass(new OutputPass());

  // la boule : cœur coloré (pas blanc), petit halo, lumière douce, traînée
  const ballGroup = new THREE.Group(); scene.add(ballGroup); ballGroup.visible = false;
  const core = new THREE.Mesh(new THREE.SphereGeometry(B.r, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffb02e' })); ballGroup.add(core);
  const glowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb02e', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); halo.scale.setScalar(1.6); ballGroup.add(halo);
  const ballLight = new THREE.PointLight('#ffb02e', 3, 8, 1.8); ballGroup.add(ballLight);
  const TRAIL = 40, trailGeo = new THREE.BufferGeometry(), trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.8, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(trail);
  const trailHist = [];
  // cercle de timing autour de la boule (il se resserre ; vert quand c'est le moment parfait)
  const timing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })); timing.renderOrder = 10; scene.add(timing);
  // repères : cible de la boule (anneau, flèche), adversaire visé (mire)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32), new THREE.MeshBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), new THREE.MeshBasicMaterial({ color: '#ff4a3a' })); arrow.rotation.x = Math.PI; scene.add(arrow);
  const aimTex = canvasTex(128, 128, (g) => { g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 44, 0, TAU); g.stroke(); g.lineWidth = 8; for (const a of [0, 1, 2, 3]) { g.save(); g.translate(64, 64); g.rotate((a * Math.PI) / 2); g.beginPath(); g.moveTo(0, -60); g.lineTo(0, -30); g.stroke(); g.restore(); } });
  const aim = new THREE.Sprite(new THREE.SpriteMaterial({ map: aimTex, color: '#ffe14a', depthTest: false, transparent: true })); aim.scale.setScalar(1.1); aim.renderOrder = 11; scene.add(aim);
  // onde de choc (renvoi parfait)
  const waves = [];
  const waveGeo = new THREE.RingGeometry(0.9, 1.0, 64);
  // particules (étincelles) et confettis
  const MAXP = 1600, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), parts = [];
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex })); scene.add(sparks);
  const confettiMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), new THREE.MeshBasicMaterial(), 500); confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); confettiMesh.count = 0; scene.add(confettiMesh);
  const confetti = [], one = new THREE.Vector3(1, 1, 1);
  function burst(x, y, z, color, n = 40, speed = 8, life = 0.6) { const c = new THREE.Color(color); for (let k = 0; k < n && parts.length < MAXP; k++) { const a = Math.random() * TAU, e = Math.random() * Math.PI - Math.PI / 2, v = speed * (0.3 + Math.random()); parts.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 2, vz: Math.sin(a) * Math.cos(e) * v, life, t: 0, r: c.r, g: c.g, b: c.b }); } }
  function confettiBurst(x, y, z, colors) { for (let k = 0; k < 120 && confetti.length < 500; k++) { const a = Math.random() * TAU, v = 3 + Math.random() * 7; confetti.push({ x, y, z, vx: Math.cos(a) * v, vy: 4 + Math.random() * 8, vz: Math.sin(a) * v, rx: Math.random() * 6, ry: Math.random() * 6, life: 2 + Math.random() * 1.5, t: 0, c: new THREE.Color(colors[k % colors.length]) }); } }

  const chars = new Map(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  let shake = 0, kick = 0, camYaw = 0, camPos = new THREE.Vector3(-20, 8, 0), camLook = new THREE.Vector3(), lastScore = '', focus = null;
  function sync(list) {
    const seen = new Set();
    list.forEach((p, k) => { seen.add(p.id); const key = `${p.look}|${p.team}|${p.acc}`; const cur = chars.get(p.id); if (cur?.key === key) return; if (cur) scene.remove(cur.ch.root); const ch = makeChar(p.look, p.team, String((k * 7 + 4) % 99), p.acc); scene.add(ch.root); chars.set(p.id, { ch, key }); });
    for (const [id, c] of chars) if (!seen.has(id)) { scene.remove(c.ch.root); chars.delete(id); }
  }
  function pose(c, p, dt, t, targeted, winTeam) {
    const ch = c.ch, r = ch.root, sp = Math.hypot(p.vx, p.vz);
    r.position.set(p.x, p.y, p.z); r.rotation.y = Math.PI / 2 - p.yaw;
    if (ch.prop) ch.prop.rotation.y += dt * 20;
    if (!p.alive) {
      if (!ch.dead) { ch.dead = 1e-3; setExpr(ch, 'dead'); }
      ch.dead += dt; ch.body.rotation.x += dt * 12; ch.body.rotation.z += dt * 7;
      if (ch.dead > 0.7 && !ch.popped) { ch.popped = true; confettiBurst(p.x, Math.max(0, p.y) + 1, p.z, [TEAM[p.team % 8], '#ffffff', LOOKS[p.look]?.skin ?? '#ffcc99', '#ffe14a']); burst(p.x, Math.max(0, p.y) + 1, p.z, '#ffb030', 50, 9, 0.5); }
      r.visible = ch.dead < 0.72;
      return;
    }
    if (ch.dead) { ch.dead = 0; ch.popped = false; r.visible = true; ch.body.rotation.set(0, 0, 0); }
    ch.phase += sp * dt * 2.4;
    const amp = Math.min(1, sp / P.speed), s = Math.sin(ch.phase);
    ch.legs[0].rotation.x = s * 0.9 * amp; ch.legs[1].rotation.x = -s * 0.9 * amp;
    ch.arms[0].rotation.x = -s * 0.8 * amp; ch.arms[1].rotation.x = s * 0.8 * amp; ch.arms[0].rotation.z = 0.12; ch.arms[1].rotation.z = -0.12;
    ch.body.position.y = Math.abs(Math.cos(ch.phase)) * 0.06 * amp + Math.sin(t * 2.5) * 0.01;
    ch.body.rotation.set(0.12 * amp, 0, 0); ch.head.rotation.z = targeted ? Math.sin(t * 30) * 0.06 : 0; ch.head.rotation.x = 0;
    if (!p.ground) { ch.legs[0].rotation.x = -0.7; ch.legs[1].rotation.x = 0.3; ch.arms[0].rotation.z = 1.6; ch.arms[1].rotation.z = -1.6; }
    let want = targeted ? 'fear' : 'idle';
    // emotes
    if (p.emoteT > 0) {
      const e = p.emote, k = t * 10;
      if (e === 'danse') { ch.body.rotation.y = Math.sin(t * 6) * 0.6; ch.arms[0].rotation.z = 2.4 + Math.sin(k) * 0.4; ch.arms[1].rotation.z = -2.4 + Math.sin(k) * 0.4; ch.legs[0].rotation.x = Math.sin(k) * 0.5; ch.legs[1].rotation.x = -Math.sin(k) * 0.5; ch.body.position.y = Math.abs(Math.sin(k)) * 0.15; want = 'win'; }
      if (e === 'moque') { ch.arms[0].rotation.x = -1.6; ch.arms[1].rotation.x = -2.6; ch.arms[1].rotation.z = -0.4; ch.body.rotation.x = -0.15 + Math.sin(t * 16) * 0.05; want = 'win'; }
      if (e === 'pleure') { ch.head.rotation.x = 0.35; ch.arms[0].rotation.x = -2.4; ch.arms[1].rotation.x = -2.4; ch.arms[0].rotation.z = -0.4; ch.arms[1].rotation.z = 0.4; ch.body.position.y = Math.sin(t * 20) * 0.02; want = 'sad'; }
      if (e === 'bravo') { const c2 = Math.abs(Math.sin(t * 14)); ch.arms[0].rotation.x = -1.4; ch.arms[1].rotation.x = -1.4; ch.arms[0].rotation.z = -0.3 - c2 * 0.4; ch.arms[1].rotation.z = 0.3 + c2 * 0.4; want = 'win'; }
    }
    const sw = p.swing / 0.3;
    if (sw > 0) { const u = 1 - sw; ch.arms[1].rotation.x = -2.6 + u * 3.6; ch.arms[1].rotation.z = -0.5; ch.body.rotation.y = -0.6 + u * 1.0; want = 'shout'; }
    ch.dome.material.opacity = sw > 0 ? 0.45 * Math.sin(sw * Math.PI) : 0; ch.dome.scale.setScalar(0.6 + (1 - sw) * 0.6);
    if (winTeam === p.team) { ch.arms[0].rotation.z = 2.6 + Math.sin(t * 12) * 0.2; ch.arms[1].rotation.z = -2.6 - Math.sin(t * 12) * 0.2; ch.body.position.y = Math.abs(Math.sin(t * 7)) * 0.4; want = 'win'; }
    setExpr(ch, want);
  }
  // couleur de traînée selon le style de celui qui a renvoyé la boule
  function trailColor(style, i, t, base) {
    const f = 1 - i / TRAIL, c = new THREE.Color();
    if (style === 'arcenciel') c.setHSL(((i / TRAIL) + t * 0.5) % 1, 1, 0.55);
    else if (style === 'flammes') c.setHSL(0.02 + Math.random() * 0.08, 1, 0.45 + Math.random() * 0.15);
    else if (style === 'coeurs') c.setHSL(0.93, 0.9, 0.65);
    else if (style === 'eclairs') c.setHSL(0.52, 1, 0.6 + (Math.random() < 0.3 ? 0.3 : 0));
    else c.copy(base);
    return c.multiplyScalar(f * 1.2);
  }

  const fx = {
    reflect(e, color, perfect, power) { burst(e.x, e.y, e.z, color, perfect ? 90 : 40, perfect ? 12 : 8, 0.45); burst(e.x, e.y, e.z, '#ffffff', perfect ? 30 : 10, perfect ? 14 : 9, 0.3); shake = Math.max(shake, perfect ? 0.4 + power * 0.5 : 0.25); if (perfect) { kick = 0.6 + power * 0.8; fx.shockwave(e.x, e.y, e.z, color, power); focus = { x: e.x, y: e.y, z: e.z, t: 0.45 }; } },
    shockwave(x, y, z, color, power = 0.5) { for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x, k ? y : 0.08, z); if (!k) m.rotation.x = -Math.PI / 2; else m.lookAt(camera.position); scene.add(m); waves.push({ m, t: 0, life: 0.7, size: 14 + power * 26 }); } },
    kill(e) { burst(e.x, Math.max(0, e.y), e.z, '#ff6a2a', 110, 13, 0.6); burst(e.x, Math.max(0, e.y), e.z, '#ffe680', 40, 9, 0.5); shake = Math.max(shake, 0.6); },
    splash(x, z) { burst(x, 0.3, z, '#9fd8ff', 14, 4, 0.5); },
    thud(x, y, z) { burst(x, y, z, '#ffffff', 10, 5, 0.3); shake = Math.max(shake, 0.12); },
    shake(a) { shake = Math.max(shake, a); },
  };

  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const project = (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * canvas.clientHeight, ok: tmpV.z < 1 }; };

  // state : { arena, halves, players, ball, me, aim (id visé), timing (0..1 ou null), trails { id: style }, winTeam,
  //           board: { wins, need, speed, label }, cam: { pos, look } (caméra imposée), fov }
  function frame(dt, t, state) {
    setArena(state?.arena ?? 'gym');
    const players = state?.players ?? [], me = players.find(p => p.id === state?.me), b = state?.ball;
    arena.root.userData.barrier.visible = !!state?.halves;
    arena.root.userData.barrier.material.uniforms.uT.value = t;
    if (arena.root.userData.water) arena.root.userData.water.material.uniforms.uT.value = t;
    for (const bt of arena.root.userData.belts ?? []) bt.m.material.map.offset.y -= bt.vz * dt * 0.25;
    for (const ps of arena.root.userData.pistons ?? []) { const up = BD.pistonUp(ps.pi, (state?.frame ?? 0) * BD.DT); ps.head.position.y += ((up ? 0.9 : 0.05) - ps.head.position.y) * Math.min(1, dt * 25); }
    sync(players);
    for (const p of players) { const c = chars.get(p.id); pose(c, p, dt, t, b && b.state !== 'wait' && b.target === p.id, state?.winTeam); if (p.id !== state?.me && p.alive && camera.position.distanceTo(c.ch.root.position) < 3.2) c.ch.root.visible = false; } // un coéquipier collé à la caméra ne bouche pas la vue
    // boule
    const live = b && b.state !== 'wait';
    ballGroup.visible = !!live; ring.visible = arrow.visible = !!live;
    if (live) {
      const k = clamp((b.v - B.v0) / 60, 0, 1), col = new THREE.Color().setHSL(k < 0.6 ? 0.12 - k * 0.2 : 1 - (k - 0.6) * 0.42, 1, 0.5);
      ballGroup.position.set(b.x, b.y, b.z); core.material.color.copy(col).multiplyScalar(1.1 + k * 0.6); halo.material.color.copy(col); halo.scale.setScalar(1.4 + k * 1.2); ballLight.color.copy(col); ballLight.intensity = 2.5 + k * 4;
      core.scale.setScalar(1 + k * 0.35);
      if (state.potato) { core.material.color.setHSL(0.02, 1, 0.45 + 0.15 * Math.sin(t * (6 + (10 - b.fuse) * 3))); }
      trailHist.unshift([b.x, b.y, b.z]); trailHist.length = Math.min(trailHist.length, TRAIL);
      const style = state.trails?.[b.last] ?? 'classique';
      for (let i = 0; i < TRAIL; i++) { const h = trailHist[i] ?? trailHist.at(-1), c = trailColor(style, i, t, col); trailPos.set(h, i * 3); trailCol.set([c.r, c.g, c.b], i * 3); }
      trail.material.size = (style === 'coeurs' ? 1.1 : 0.6) + k * 0.8; trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
      if ((style === 'flammes' || style === 'eclairs') && Math.random() < 0.5) burst(b.x, b.y, b.z, style === 'flammes' ? '#ff6a1a' : '#9ff0ff', 2, 3, 0.25);
      else if (k > 0.4 && Math.random() < k * 0.6) burst(b.x, b.y, b.z, col.getStyle(), 1, 3, 0.25);
      const tp = players.find(p => p.id === b.target);
      if (tp) { ring.position.x = tp.x; ring.position.z = tp.z; ring.position.y = Math.max(0, tp.y) + 0.04; ring.scale.setScalar(1 + Math.sin(t * 12) * 0.12); arrow.position.set(tp.x, tp.y + 2.55 + Math.sin(t * 8) * 0.1, tp.z); arrow.rotation.y = t * 4; }
    } else { trailHist.length = 0; trailCol.fill(0); trailGeo.attributes.color.needsUpdate = true; }
    // cercle de timing : il se resserre jusqu'à la boule au moment parfait
    timing.visible = live && state.timing != null;
    if (timing.visible) { const s = B.r * (1.3 + state.timing * 5); timing.position.set(b.x, b.y, b.z); timing.scale.setScalar(s); timing.lookAt(camera.position); timing.material.color.set(state.timing < 0.12 ? '#5dff7a' : state.timing < 0.5 ? '#ffe14a' : '#ffffff'); }
    // mire sur l'adversaire visé
    const ap = state?.aim && players.find(p => p.id === state.aim);
    aim.visible = !!ap; if (ap) { aim.position.set(ap.x, ap.y + 1.1, ap.z); aim.scale.setScalar(1.1 + Math.sin(t * 8) * 0.06); }
    // ondes de choc
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.t += dt; const u = w.t / w.life; if (u >= 1) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); continue; } w.m.scale.setScalar(0.5 + u * w.size); w.m.material.opacity = 0.8 * (1 - u); }
    // particules
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; } p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = 1 - p.t / p.life; pPos.set([p.x, p.y, p.z], n * 3); pCol.set([p.r * f, p.g * f, p.b * f], n * 3); n++; }
    pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
    let m = 0;
    for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.t += dt; if (c.t > c.life) { confetti.splice(i, 1); continue; } c.vy = Math.max(c.vy - 14 * dt, -2.5); c.vx *= 0.985; c.vz *= 0.985; c.x += c.vx * dt; c.y = Math.max(0.02, c.y + c.vy * dt); c.z += c.vz * dt; c.rx += dt * 8; c.ry += dt * 6; tmpE.set(c.rx, c.ry, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(c.x, c.y, c.z), tmpQ, one); confettiMesh.setMatrixAt(m, tmpM); confettiMesh.setColorAt(m, c.c); m++; }
    confettiMesh.count = m; confettiMesh.instanceMatrix.needsUpdate = true; if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    // tableau de score
    const bd = state?.board, sig = bd ? `${bd.wins}|${Math.round(bd.speed)}|${bd.label}|${arenaId}` : `x${arenaId}`;
    if (sig !== lastScore) {
      lastScore = sig; const sc = arena.root.userData.score, g = sc.canvas.getContext('2d'), W = 1024, H = 512;
      g.fillStyle = '#1c1420'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
      if (bd?.wins) { g.fillStyle = TEAM[0]; g.fillRect(40, 40, 420, 70); g.fillStyle = TEAM[1]; g.fillRect(564, 40, 420, 70); g.font = '700 46px Fredoka, Arial, sans-serif'; g.fillStyle = '#fff'; g.fillText('MANDARINES', 250, 77); g.fillText('LAGONS', 774, 77); g.font = '700 200px Fredoka, Arial Black, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(String(bd.wins[0]), 250, 260); g.fillText(String(bd.wins[1]), 774, 260); g.fillStyle = '#fff'; g.fillText('–', 512, 260); }
      else { g.font = '700 90px Fredoka, Arial Black, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(bd?.label ?? 'BOULE DE PUTE', 512, 230); }
      g.font = '700 44px Fredoka, Arial, sans-serif'; g.fillStyle = '#9fe8ff'; g.fillText(bd ? `BOULE : ${Math.round(bd.speed * 3.6)} km/h` : ARENAS[arenaId]?.name ?? '', 512, 430);
      sc.tex.needsUpdate = true;
    }
    // caméra : imposée (replay), à la troisième personne derrière soi, ou vue d'ensemble qui suit la boule
    shake *= Math.exp(-dt * 7); kick *= Math.exp(-dt * 4);
    if (focus) focus.t -= dt;
    if (state?.cam) { camPos.copy(state.cam.pos); camLook.copy(state.cam.look); }
    else if (me && me.alive) {
      camYaw += Math.atan2(Math.sin(me.yaw - camYaw), Math.cos(me.yaw - camYaw)) * Math.min(1, dt * 25);
      const [fx_, fz_] = BD.fwd(camYaw);
      camPos.lerp(tmpV.set(me.x - fx_ * 6.2 - fz_ * 1.1, me.y + 3.6, me.z - fz_ * 6.2 + fx_ * 1.1), Math.min(1, dt * 12));
      camLook.set(me.x + fx_ * 8 - fz_ * 0.6, me.y + 0.7, me.z + fz_ * 8 + fx_ * 0.6);
    } else {
      const tx = b && b.state !== 'wait' ? b.x * 0.5 : 0, side = me ? (me.team % 2 ? 1 : -1) : -1;
      camPos.lerp(tmpV.set(side * 22, 12, 14), Math.min(1, dt * 2)); camLook.lerp(tmpV.set(tx, 1, 0), Math.min(1, dt * 3));
    }
    // zoom sur le renvoi parfait : la caméra se rapproche un instant du point d'impact
    const look = camLook.clone(); let pos = camPos.clone();
    if (focus && focus.t > 0 && !state?.cam) { const u = Math.sin((focus.t / 0.45) * Math.PI); look.lerp(tmpV.set(focus.x, focus.y, focus.z), u * 0.6); pos = pos.lerp(tmpV.set(focus.x, focus.y + 1, focus.z), u * 0.25); }
    camera.position.copy(pos).add(tmpV.set((Math.random() - 0.5) * shake * 0.4, (Math.random() - 0.5) * shake * 0.4, (Math.random() - 0.5) * shake * 0.4));
    camera.lookAt(look);
    camera.fov = (state?.fov ?? 68) - kick * 10; camera.updateProjectionMatrix();
    composer.render();
  }
  resize();
  return { resize, frame, fx, project, chars };
}
