// Rendu 3D de Boule de Pute (Three.js) : le « Gymnase Cosmique », un gymnase chaleureux (parquet, murs pastel, grandes
// fenêtres, poutres, paniers, tableau de score) coupé en deux par une barrière d'énergie. Personnages en blocs façon
// jouet (tête cubique au visage peint qui change d'expression, maillot à numéro, bras et jambes qui balancent),
// impulsion de renvoi (dôme d'énergie), boule lumineuse à traînée qui passe du jaune au rouge puis au violet en
// accélérant, explosions de confettis, caméra à la troisième personne qui tremble aux impacts, halo (bloom).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BD = window.BD, { A, P, B } = BD;
export const TEAM = ['#ff7a2f', '#2fc4d6'], TEAM_NAMES = ['Les Mandarines', 'Les Lagons'];
const TEAM_D = ['#c9501a', '#1a8c9c'], TEAM_L = ['#ffd2a8', '#b4f1f7'];
export const LOOKS = {
  bobby: { name: 'Bobby', skin: '#f3bf93', hair: '#ff6a1f', iris: '#3a2a20', shoe: '#ffffff' },
  mama: { name: 'Mama Gloria', skin: '#8a5634', hair: '#1d1410', iris: '#24140c', shoe: '#ff4fa3' },
  tonton: { name: 'Tonton Raoul', skin: '#d79c6c', hair: '#2a1a12', iris: '#24140c', shoe: '#222222' },
  zaza: { name: 'Zaza', skin: '#ffe0c8', hair: '#4aa8ff', iris: '#1a4f8a', shoe: '#ffe14a' },
  robox: { name: 'Robox', skin: '#aeb8c4', hair: '#5b6675', iris: '#00e5ff', shoe: '#5b6675' },
  mamie: { name: 'Mamie Turbo', skin: '#f6d0b4', hair: '#dcdce4', iris: '#5a6a8a', shoe: '#9b59ff' },
};
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= Visages (texture peinte sur la face avant de la tête) ================= */
// expr : idle, shout, fear, dead, win
function faceCanvas(lookId, expr) {
  const L = LOOKS[lookId], c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = L.skin; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 100, 128, 28);
  const ink = lookId === 'robox' ? L.iris : '#1b1214';
  // yeux : barres verticales (ou X, ou écarquillés)
  for (const x of [40, 88]) {
    if (expr === 'dead') { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 9, 42); g.lineTo(x + 9, 60); g.moveTo(x + 9, 42); g.lineTo(x - 9, 60); g.stroke(); continue; }
    if (expr === 'win') { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(x, 56, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    if (expr === 'fear') { g.fillStyle = '#ffffff'; g.fillRect(x - 10, 36, 20, 26); g.fillStyle = ink; g.fillRect(x - 4, 44, 8, 10); continue; }
    if (lookId === 'robox') { g.fillStyle = L.iris; g.shadowColor = L.iris; g.shadowBlur = 12; g.fillRect(x - 10, 44, 20, 12); g.shadowBlur = 0; continue; }
    g.fillStyle = ink; g.fillRect(x - 4, 38, 9, 22);
  }
  // sourcils
  if (lookId !== 'robox' && expr !== 'dead') {
    g.fillStyle = lookId === 'mamie' ? '#9a9aa4' : '#2a1a14';
    const tilt = expr === 'shout' ? 7 : expr === 'fear' ? -7 : 0;
    for (const [x, s] of [[40, 1], [88, -1]]) { g.save(); g.translate(x, 28); g.rotate((tilt * s * Math.PI) / 180 * 2.2); g.fillRect(-14, -4, 28, 8); g.restore(); }
  }
  // bouche
  if (expr === 'shout' || expr === 'win') { g.fillStyle = '#6e1626'; g.fillRect(40, 78, 48, expr === 'win' ? 26 : 34); g.fillStyle = '#ffffff'; g.fillRect(40, 78, 48, 9); g.fillStyle = '#ff6f86'; g.fillRect(50, expr === 'win' ? 96 : 102, 28, 8); }
  else if (expr === 'fear') { g.fillStyle = '#6e1626'; g.fillRect(56, 80, 16, 20); }
  else if (expr === 'dead') { g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.moveTo(44, 90); for (let k = 1; k <= 6; k++) g.lineTo(44 + k * 7, 90 + (k % 2 ? 6 : -4)); g.stroke(); }
  else if (lookId === 'robox') { g.fillStyle = L.iris; for (let k = 0; k < 5; k++) g.fillRect(40 + k * 10, 84, 6, 8); }
  else { g.fillStyle = '#6e1626'; g.fillRect(46, 84, 36, 8); g.fillStyle = '#ffffff'; g.fillRect(46, 84, 36, 3); }
  // détails du visage
  if (lookId === 'zaza' || lookId === 'mamie') { g.strokeStyle = lookId === 'zaza' ? '#ff4fa3' : '#c9a227'; g.lineWidth = 4; for (const x of [40, 88]) g.strokeRect(x - 15, 34, 30, 30); g.beginPath(); g.moveTo(55, 46); g.lineTo(73, 46); g.stroke(); }
  if (lookId === 'bobby') { g.fillStyle = 'rgba(200,90,40,.45)'; for (const [x, y] of [[30, 70], [36, 74], [92, 70], [98, 74]]) g.fillRect(x, y, 4, 4); }
  if (lookId === 'mamie') { g.strokeStyle = 'rgba(150,90,70,.4)'; g.lineWidth = 2; for (const x of [22, 106]) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x + (x < 64 ? 8 : -8), 78); g.stroke(); } }
  if (lookId !== 'robox') { g.fillStyle = 'rgba(255,90,110,.35)'; g.fillRect(16, 66, 18, 10); g.fillRect(94, 66, 18, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
const faceCache = new Map();
const face = (look, expr) => { const k = `${look}:${expr}`; if (!faceCache.has(k)) faceCache.set(k, faceCanvas(look, expr)); return faceCache.get(k); };
function jerseyTex(team, num) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = TEAM[team]; g.fillRect(0, 0, 64, 64);
  g.fillStyle = TEAM_L[team]; g.fillRect(0, 0, 64, 6); g.beginPath(); g.moveTo(22, 0); g.lineTo(32, 12); g.lineTo(42, 0); g.fill(); // col en V
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
function makeChar(lookId, team, num) {
  const L = LOOKS[lookId] ?? LOOKS.bobby, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = toon(L.skin), jersey = toon(TEAM[team]), shorts = toon(TEAM_D[team]), band = toon(TEAM_L[team]), shoe = toon(L.shoe), hair = toon(L.hair);
  const legs = [-0.14, 0.14].map(x => { const g = new THREE.Group(); g.position.set(x, 0.66, 0); body.add(g); box(0.2, 0.5, 0.22, skin, 0, -0.27, 0, g); box(0.21, 0.08, 0.23, band, 0, -0.47, 0, g); box(0.24, 0.13, 0.38, shoe, 0, -0.6, 0.06, g); return g; });
  box(0.66, 0.2, 0.42, shorts, 0, 0.7, 0, body);
  const jt = jerseyTex(team, num), jm = toon('#ffffff', { map: jt });
  box(0.64, 0.6, 0.4, [jersey, jersey, jersey, jersey, jm, jersey], 0, 1.08, 0, body);
  const arms = [-0.42, 0.42].map(x => { const g = new THREE.Group(); g.position.set(x, 1.3, 0); body.add(g); box(0.18, 0.5, 0.2, skin, 0, -0.24, 0, g); box(0.2, 0.09, 0.22, band, 0, -0.4, 0, g); box(0.2, 0.12, 0.21, jersey, 0, -0.04, 0, g); return g; });
  const head = new THREE.Group(); head.position.set(0, 1.4, 0); body.add(head);
  const fm = toon('#ffffff', { map: face(lookId, 'idle') });
  box(0.66, 0.62, 0.6, [skin, skin, skin, skin, fm, skin], 0, 0.32, 0, head);
  // coiffures et accessoires
  if (lookId === 'bobby') { box(0.18, 0.32, 0.62, hair, 0, 0.78, -0.02, head); box(0.68, 0.1, 0.62, band, 0, 0.5, 0, head); box(0.68, 0.12, 0.2, hair, 0, 0.62, -0.22, head); }
  if (lookId === 'mama') { box(0.92, 0.55, 0.82, hair, 0, 0.82, -0.08, head); for (const [x, y, z] of [[-0.4, 1.05, 0.2], [0.42, 0.95, -0.3], [0, 1.1, -0.35], [-0.35, 0.8, -0.42]]) box(0.3, 0.3, 0.3, hair, x, y, z, head); box(0.7, 0.1, 0.64, toon('#ff4fa3'), 0, 0.55, 0, head); for (const x of [-0.36, 0.36]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), toon('#ffd23f')); r.position.set(x, 0.12, 0.1); head.add(r); } }
  if (lookId === 'tonton') { box(0.42, 0.1, 0.08, hair, 0, 0.22, 0.32, head); box(0.68, 0.06, 0.6, hair, 0, 0.64, -0.02, head); const gl = toon('#111118'); box(0.22, 0.12, 0.04, gl, -0.15, 0.42, 0.31, head); box(0.22, 0.12, 0.04, gl, 0.15, 0.42, 0.31, head); box(0.1, 0.03, 0.04, gl, 0, 0.45, 0.31, head); }
  if (lookId === 'zaza') { box(0.7, 0.16, 0.64, hair, 0, 0.67, 0, head); box(0.7, 0.18, 0.12, hair, 0, 0.58, 0.27, head); for (const s of [-1, 1]) { box(0.16, 0.36, 0.16, hair, s * 0.42, 0.42, -0.1, head); box(0.12, 0.12, 0.12, toon('#ff4fa3'), s * 0.42, 0.62, -0.1, head); } }
  if (lookId === 'robox') { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), hair); an.position.set(0, 0.8, 0); head.add(an); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.4) })); bulb.position.set(0, 1.0, 0); head.add(bulb); for (const s of [-1, 1]) box(0.08, 0.24, 0.24, hair, s * 0.37, 0.32, 0, head); }
  if (lookId === 'mamie') { box(0.7, 0.16, 0.64, hair, 0, 0.66, -0.02, head); box(0.32, 0.26, 0.3, hair, 0, 0.82, -0.15, head); for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI; const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon('#fffaf0')); pearl.position.set(Math.cos(a) * 0.25, 1.36, 0.12 + Math.sin(a) * 0.08); body.add(pearl); } }
  // dôme d'impulsion devant le joueur
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAM_L[team]).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  dome.rotation.x = Math.PI / 2; dome.position.set(0, 1.0, 0.35); root.add(dome);
  return { root, body, legs, arms, head, fm, dome, phase: Math.random() * 6, expr: 'idle', exprT: 0, dead: 0, look: lookId, team };
}
function setExpr(ch, expr) { if (ch.expr === expr) return; ch.expr = expr; ch.fm.map = face(ch.look, expr); ch.fm.needsUpdate = true; }

// Portrait 2D pour les menus (vue de face, même style en blocs).
export function drawPortrait(canvas, lookId, team = 0, t = 0) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, L = LOOKS[lookId];
  g.clearRect(0, 0, W, H);
  const bob = Math.sin(t * 3) * W * 0.01, s = W / 120;
  g.save(); g.translate(W / 2, H * 0.05 + bob); g.scale(s, s);
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); };
  rect(-26, 74, 52, 36, TEAM[team]); g.fillStyle = TEAM_L[team]; g.beginPath(); g.moveTo(-8, 74); g.lineTo(0, 82); g.lineTo(8, 74); g.fill();
  rect(-34, 76, 10, 30, L.skin); rect(24, 76, 10, 30, L.skin);
  if (lookId === 'mama') { rect(-38, -2, 76, 44, L.hair); rect(-46, 6, 20, 20, L.hair); rect(26, 0, 20, 20, L.hair); }
  if (lookId === 'zaza') { rect(-36, 30, 10, 26, L.hair); rect(26, 30, 10, 26, L.hair); }
  g.drawImage(face(lookId, 'idle').image, -27, 22, 54, 52);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.strokeRect(-27, 22, 54, 52);
  if (lookId === 'bobby') { rect(-6, 2, 12, 22, L.hair); rect(-28, 26, 56, 6, TEAM_L[team]); }
  if (lookId === 'mama') rect(-28, 26, 56, 6, '#ff4fa3');
  if (lookId === 'tonton') { rect(-17, 58, 34, 6, L.hair); rect(-20, 36, 17, 9, '#111'); rect(3, 36, 17, 9, '#111'); rect(-28, 18, 56, 5, L.hair); }
  if (lookId === 'zaza') rect(-28, 16, 56, 14, L.hair);
  if (lookId === 'robox') { rect(-2, 4, 4, 18, L.hair); g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(0, 4, 5, 0, TAU); g.fill(); }
  if (lookId === 'mamie') { rect(-28, 16, 56, 10, L.hair); rect(-12, 4, 24, 14, L.hair); }
  g.restore();
}

/* ================= Arène ================= */
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
function floorTex() {
  return canvasTex(2048, 1260, (g, W, H) => {
    // parquet
    const pw = W / 26, ph = H / 6;
    for (let i = 0; i < 26; i++) for (let j = 0; j < 6; j++) { const off = (i % 2) * ph * 0.5, l = 58 + ((i * 7 + j * 13) % 9); g.fillStyle = `hsl(28, 55%, ${l}%)`; g.fillRect(i * pw, j * ph - off, pw - 2, ph - 2); g.fillRect(i * pw, (j + 1) * ph - off, pw - 2, ph - 2); }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(120,70,30,${Math.random() * 0.08})`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 30, 1); }
    // moitiés d'équipe teintées
    g.fillStyle = 'rgba(255,122,47,.16)'; g.fillRect(0, 0, W / 2, H); g.fillStyle = 'rgba(47,196,214,.16)'; g.fillRect(W / 2, 0, W / 2, H);
    // lignes
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 10; const m = 26;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, H - m); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.18, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(W / 2, H / 2, H * 0.05, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * W * 0.5, H / 2, H * 0.32, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke(); }
    g.font = `900 ${H * 0.1}px "Fredoka", Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.18)';
    g.save(); g.translate(W * 0.25, H / 2); g.rotate(-Math.PI / 2); g.fillText('MANDARINES', 0, 0); g.restore();
    g.save(); g.translate(W * 0.75, H / 2); g.rotate(Math.PI / 2); g.fillText('LAGONS', 0, 0); g.restore();
  });
}
function buildArena(scene) {
  const FX = A.X + 1.2, FZ = A.Z + 1.2, RX = A.X + 6, RZ = A.Z + 7, H = 11;
  // sol de jeu et sol du gymnase
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * FX, 2 * FZ), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.55, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ), toon('#d9925a')); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; scene.add(outer);
  // murets rembourrés autour du terrain, aux couleurs des équipes
  for (const s of [-1, 1]) for (const t of [0, 1]) { const m = box(FX, 1.1, 0.35, toon(TEAM[t]), (t ? 1 : -1) * FX / 2, 0.55, s * FZ); scene.add(m); box(FX, 0.12, 0.37, toon('#ffffff'), (t ? 1 : -1) * FX / 2, 1.12, s * FZ, scene); }
  for (const s of [-1, 1]) { const m = box(0.35, 1.1, 2 * FZ, toon(TEAM[s > 0 ? 1 : 0]), s * FX, 0.55, 0); scene.add(m); }
  // murs du gymnase : jaune pâle, plinthe brique, grandes fenêtres lumineuses
  const wallMat = toon('#ffe9b0'), baseMat = toon('#c96a3d');
  const wall = (w, x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); box(w, H, 0.4, wallMat, 0, H / 2, 0, g); box(w, 2.2, 0.45, baseMat, 0, 1.1, 0.02, g); return g; };
  const back = wall(2 * RX, 0, -RZ, 0), front = wall(2 * RX, 0, RZ, Math.PI); wall(2 * RZ, -RX, 0, Math.PI / 2); wall(2 * RZ, RX, 0, -Math.PI / 2);
  front.visible = false; // côté caméra : ouvert
  const sky = canvasTex(256, 256, (g, W, H2) => { const gr = g.createLinearGradient(0, 0, 0, H2); gr.addColorStop(0, '#5ab8ff'); gr.addColorStop(1, '#c9ecff'); g.fillStyle = gr; g.fillRect(0, 0, W, H2); g.fillStyle = '#ffffff'; for (const [x, y, r] of [[60, 70, 26], [90, 64, 30], [120, 74, 22], [190, 150, 24], [215, 144, 28]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.fillStyle = '#7fd36b'; g.beginPath(); g.moveTo(0, H2); g.lineTo(80, 180); g.lineTo(150, 230); g.lineTo(220, 170); g.lineTo(256, 200); g.lineTo(256, H2); g.fill(); });
  for (let k = -2; k <= 2; k++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshBasicMaterial({ map: sky, color: new THREE.Color(1.4, 1.4, 1.4) })); win.position.set(k * 6, 6.5, 0.23); back.add(win); box(4.5, 0.25, 0.3, toon('#8a5a3a'), k * 6, 4.9, 0.25, back); box(4.5, 0.25, 0.3, toon('#8a5a3a'), k * 6, 8.1, 0.25, back); box(0.2, 3.4, 0.3, toon('#8a5a3a'), k * 6, 6.5, 0.25, back); }
  // poutres au plafond
  for (let k = -3; k <= 3; k++) { box(0.35, 0.5, 2 * RZ, toon('#b9845c'), k * 5, H - 0.6, 0, scene); }
  for (let k = -3; k <= 3; k++) for (const z of [-4, 4]) { const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.0) })); lamp.position.set(k * 5, H - 1.1, z); scene.add(lamp); }
  // paniers de basket aux deux bouts
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * (RX - 0.4), 0, 0); g.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(g);
    box(0.25, 5.5, 0.25, toon('#555b66'), 0, 2.75, 0.4, g); box(2.2, 1.4, 0.1, toon('#ffffff'), 0, 5.6, 0.9, g); box(0.9, 0.6, 0.12, toon(TEAM[s > 0 ? 1 : 0]), 0, 5.4, 0.95, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 20), toon('#ff5a2a')); ring.rotation.x = Math.PI / 2; ring.position.set(0, 5.1, 1.3); g.add(ring);
  }
  // bancs
  for (const t of [0, 1]) for (const z of [-1, 1]) { const x = (t ? 1 : -1) * (A.X + 3.2), g = new THREE.Group(); g.position.set(x, 0, z * 4); scene.add(g); box(0.6, 0.12, 3.2, toon('#9a6440'), 0, 0.5, 0, g); for (const zz of [-1.3, 1.3]) box(0.5, 0.5, 0.1, toon('#6b6f78'), 0, 0.25, zz, g); }
  // tableau de score sur le mur du fond
  const score = document.createElement('canvas'); score.width = 1024; score.height = 512;
  const scoreTex = new THREE.CanvasTexture(score); scoreTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: scoreTex, color: new THREE.Color(1.15, 1.15, 1.15) }));
  board.position.set(0, 7, 0.3); back.add(board); box(9.6, 5.1, 0.2, toon('#3a2b26'), 0, 7, 0.18, back);
  // barrière d'énergie au milieu
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(2 * A.Z, 3.2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float s = 0.5 + 0.5 * sin((vUv.y * 18.0 - uT * 3.0)); float hex = 0.5 + 0.5 * sin(vUv.x * 60.0 + uT) * sin(vUv.y * 30.0 - uT * 2.0); float edge = smoothstep(1.0, 0.0, vUv.y); float a = (0.08 + 0.18 * s * hex) * edge + 0.5 * smoothstep(0.03, 0.0, abs(vUv.y - 0.02)); gl_FragColor = vec4(mix(vec3(1.0,0.55,0.2), vec3(0.2,0.9,1.0), vUv.x) * 1.6, a); }',
  }));
  barrier.rotation.y = Math.PI / 2; barrier.position.set(0, 1.6, 0); scene.add(barrier);
  return { scoreCanvas: score, scoreTex, barrier };
}

/* ================= Le tout ================= */
export function createArena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7d9a8');
  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#fff4dd', '#c98a5a', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.4); sun.position.set(-6, 16, -10); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 50 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const arena = buildArena(scene);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 0.95); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // la boule : cœur très lumineux, halo, lumière, traînée
  const ballGroup = new THREE.Group(); scene.add(ballGroup); ballGroup.visible = false;
  const core = new THREE.Mesh(new THREE.SphereGeometry(B.r, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1) })); ballGroup.add(core);
  const glowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffcc55', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(2.4); ballGroup.add(halo);
  const ballLight = new THREE.PointLight('#ffcc55', 6, 9, 1.6); ballGroup.add(ballLight);
  const TRAIL = 40, trailGeo = new THREE.BufferGeometry(), trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.9, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(trail);
  const trailHist = [];
  // repère de la cible : anneau au sol et flèche au-dessus de la tête
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 0.3) })); arrow.rotation.x = Math.PI; scene.add(arrow);

  // particules (étincelles, confettis)
  const MAXP = 1500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), parts = [];
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex })); scene.add(sparks);
  const confettiMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), new THREE.MeshBasicMaterial(), 400); confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); confettiMesh.count = 0; scene.add(confettiMesh);
  const confetti = [];
  function burst(x, y, z, color, n = 40, speed = 8, life = 0.6) { const c = new THREE.Color(color); for (let k = 0; k < n && parts.length < MAXP; k++) { const a = Math.random() * TAU, e = Math.random() * Math.PI - Math.PI / 2, v = speed * (0.3 + Math.random()); parts.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 2, vz: Math.sin(a) * Math.cos(e) * v, life, t: 0, r: c.r * 2, g: c.g * 2, b: c.b * 2 }); } }
  function confettiBurst(x, y, z, colors) { for (let k = 0; k < 120 && confetti.length < 400; k++) { const a = Math.random() * TAU, v = 3 + Math.random() * 7; confetti.push({ x, y, z, vx: Math.cos(a) * v, vy: 4 + Math.random() * 8, vz: Math.sin(a) * v, rx: Math.random() * 6, ry: Math.random() * 6, life: 2 + Math.random() * 1.5, t: 0, c: new THREE.Color(colors[k % colors.length]) }); } }

  const chars = new Map(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  let shake = 0, kick = 0, camYaw = 0, camPos = new THREE.Vector3(-14, 6, 0), camLook = new THREE.Vector3(), lastScore = '';
  function sync(list) {
    const seen = new Set();
    list.forEach((p, k) => { seen.add(p.id); const key = `${p.look}|${p.team}`; const cur = chars.get(p.id); if (cur?.key === key) return; if (cur) scene.remove(cur.ch.root); const ch = makeChar(p.look, p.team, String((k * 7 + 4) % 99)); scene.add(ch.root); chars.set(p.id, { ch, key }); });
    for (const [id, c] of chars) if (!seen.has(id)) { scene.remove(c.ch.root); chars.delete(id); }
  }
  function pose(c, p, dt, t, targeted, winTeam) {
    const ch = c.ch, r = ch.root, sp = Math.hypot(p.vx, p.vz);
    r.position.set(p.x, p.y, p.z);
    r.rotation.y = Math.PI / 2 - p.yaw;
    if (!p.alive) { // éjecté : il vrille, puis explose en confettis
      if (!ch.dead) { ch.dead = 1e-3; setExpr(ch, 'dead'); }
      ch.dead += dt; ch.body.rotation.x += dt * 12; ch.body.rotation.z += dt * 7;
      if (ch.dead > 0.7 && !ch.popped) { ch.popped = true; confettiBurst(p.x, p.y + 1, p.z, [TEAM[p.team], '#ffffff', LOOKS[p.look].skin, '#ffe14a']); burst(p.x, p.y + 1, p.z, '#ffd23f', 60, 10, 0.5); }
      r.visible = ch.dead < 0.72;
      return;
    }
    if (ch.dead) { ch.dead = 0; ch.popped = false; r.visible = true; ch.body.rotation.set(0, 0, 0); }
    ch.phase += sp * dt * 2.4;
    const amp = Math.min(1, sp / P.speed), s = Math.sin(ch.phase);
    ch.legs[0].rotation.x = s * 0.9 * amp; ch.legs[1].rotation.x = -s * 0.9 * amp;
    ch.arms[0].rotation.x = -s * 0.8 * amp; ch.arms[1].rotation.x = s * 0.8 * amp; ch.arms[0].rotation.z = 0.12; ch.arms[1].rotation.z = -0.12;
    ch.body.position.y = Math.abs(Math.cos(ch.phase)) * 0.06 * amp + Math.sin(t * 2.5) * 0.01;
    ch.body.rotation.x = 0.12 * amp; ch.head.rotation.z = targeted ? Math.sin(t * 30) * 0.06 : 0;
    if (!p.ground) { ch.legs[0].rotation.x = -0.7; ch.legs[1].rotation.x = 0.3; ch.arms[0].rotation.z = 1.6; ch.arms[1].rotation.z = -1.6; }
    // impulsion : grand revers du bras droit, dôme d'énergie
    const sw = p.swing / 0.3;
    if (sw > 0) { const u = 1 - sw; ch.arms[1].rotation.x = -2.6 + u * 3.6; ch.arms[1].rotation.z = -0.5; ch.body.rotation.y = -0.6 + u * 1.0; }
    else ch.body.rotation.y = 0;
    ch.dome.material.opacity = sw > 0 ? 0.55 * Math.sin(sw * Math.PI) : 0; ch.dome.scale.setScalar(0.6 + (1 - sw) * 0.6);
    const want = winTeam === p.team ? 'win' : sw > 0 ? 'shout' : targeted ? 'fear' : 'idle';
    if (winTeam === p.team) { ch.arms[0].rotation.z = 2.6 + Math.sin(t * 12) * 0.2; ch.arms[1].rotation.z = -2.6 - Math.sin(t * 12) * 0.2; ch.body.position.y = Math.abs(Math.sin(t * 7)) * 0.4; }
    setExpr(ch, want);
  }

  const fx = {
    reflect(e, color, perfect) { burst(e.x, e.y, e.z, color, perfect ? 120 : 50, perfect ? 14 : 9, 0.5); burst(e.x, e.y, e.z, '#ffffff', perfect ? 60 : 20, perfect ? 18 : 10, 0.35); shake = Math.max(shake, perfect ? 0.6 : 0.3); if (perfect) kick = 1; },
    kill(e) { burst(e.x, e.y, e.z, '#ff6a2a', 140, 14, 0.7); burst(e.x, e.y, e.z, '#ffe680', 60, 9, 0.5); shake = Math.max(shake, 0.8); },
    swing(x, y, z, color) { burst(x, y, z, color, 10, 4, 0.3); },
    shake(a) { shake = Math.max(shake, a); },
  };

  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const project = (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * canvas.clientHeight, ok: tmpV.z < 1 }; };

  // state : { players, ball: { x, y, z, v, target, team, state } | null, me, winTeam, board: { wins, need, speed } }
  function frame(dt, t, state) {
    const players = state?.players ?? [], me = players.find(p => p.id === state?.me), b = state?.ball;
    sync(players);
    for (const p of players) pose(chars.get(p.id), p, dt, t, b && b.state !== 'wait' && b.target === p.id, state?.winTeam);
    // boule
    const live = b && b.state !== 'wait';
    ballGroup.visible = !!live; ring.visible = arrow.visible = !!live;
    if (live) {
      const k = clamp((b.v - B.v0) / 55, 0, 1), col = new THREE.Color().setHSL(k < 0.6 ? 0.14 - k * 0.23 : 1 - (k - 0.6) * 0.42, 1, 0.55);
      ballGroup.position.set(b.x, b.y, b.z); core.material.color.copy(col).multiplyScalar(3 + k * 4).addScalar(0.6); halo.material.color.copy(col); halo.scale.setScalar(2.2 + k * 2.5 + Math.sin(t * 30) * 0.15); ballLight.color.copy(col); ballLight.intensity = 6 + k * 14;
      core.scale.setScalar(1 + k * 0.4);
      trailHist.unshift([b.x, b.y, b.z]); trailHist.length = Math.min(trailHist.length, TRAIL);
      for (let i = 0; i < TRAIL; i++) { const h = trailHist[i] ?? trailHist.at(-1), f = 1 - i / TRAIL; trailPos.set(h, i * 3); trailCol.set([col.r * f * 2, col.g * f * 2, col.b * f * 2], i * 3); }
      trail.material.size = 0.7 + k * 1.2; trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
      if (k > 0.35 && Math.random() < k) burst(b.x, b.y, b.z, col.getStyle(), 2, 3, 0.25);
      const tp = players.find(p => p.id === b.target);
      if (tp) { ring.position.x = tp.x; ring.position.z = tp.z; ring.scale.setScalar(1 + Math.sin(t * 12) * 0.12); arrow.position.set(tp.x, tp.y + 2.55 + Math.sin(t * 8) * 0.1, tp.z); arrow.rotation.y = t * 4; }
    } else { trailHist.length = 0; trailCol.fill(0); trailGeo.attributes.color.needsUpdate = true; }
    // particules
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; } p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = 1 - p.t / p.life; pPos.set([p.x, p.y, p.z], n * 3); pCol.set([p.r * f, p.g * f, p.b * f], n * 3); n++; }
    pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
    let m = 0;
    for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.t += dt; if (c.t > c.life) { confetti.splice(i, 1); continue; } c.vy = Math.max(c.vy - 14 * dt, -2.5); c.vx *= 0.985; c.vz *= 0.985; c.x += c.vx * dt; c.y = Math.max(0.02, c.y + c.vy * dt); c.z += c.vz * dt; c.rx += dt * 8; c.ry += dt * 6; tmpE.set(c.rx, c.ry, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(c.x, c.y, c.z), tmpQ, new THREE.Vector3(1, 1, 1)); confettiMesh.setMatrixAt(m, tmpM); confettiMesh.setColorAt(m, c.c); m++; }
    confettiMesh.count = m; confettiMesh.instanceMatrix.needsUpdate = true; if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    arena.barrier.material.uniforms.uT.value = t;
    // tableau de score
    const bd = state?.board, sig = bd ? `${bd.wins}|${bd.need}|${Math.round(bd.speed)}|${bd.alive}` : 'x';
    if (sig !== lastScore) {
      lastScore = sig; const g = arena.scoreCanvas.getContext('2d'), W = 1024, H = 512;
      g.fillStyle = '#1c1420'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = TEAM[0]; g.fillRect(40, 40, 420, 70); g.fillStyle = TEAM[1]; g.fillRect(564, 40, 420, 70);
      g.font = '800 46px Fredoka, Arial, sans-serif'; g.fillStyle = '#fff'; g.fillText('MANDARINES', 250, 77); g.fillText('LAGONS', 774, 77);
      g.font = '900 200px Fredoka, Arial Black, sans-serif'; g.fillStyle = '#ffd23f';
      g.fillText(String(bd?.wins?.[0] ?? 0), 250, 260); g.fillText(String(bd?.wins?.[1] ?? 0), 774, 260);
      g.font = '800 44px Fredoka, Arial, sans-serif'; g.fillStyle = '#9fe8ff'; g.fillText(bd ? `BOULE : ${Math.round(bd.speed * 3.6)} km/h` : 'BOULE DE PUTE', 512, 430);
      g.fillStyle = '#fff'; g.fillText('–', 512, 260);
      arena.scoreTex.needsUpdate = true;
    }
    // caméra : à la troisième personne derrière soi ; sinon vue d'ensemble qui suit la boule
    shake *= Math.exp(-dt * 7); kick *= Math.exp(-dt * 5);
    if (me && me.alive) {
      camYaw += Math.atan2(Math.sin(me.yaw - camYaw), Math.cos(me.yaw - camYaw)) * Math.min(1, dt * 25);
      const [fx_, fz_] = BD.fwd(camYaw);
      // par-dessus l'épaule droite, assez haut pour voir l'arène et la boule
      camPos.lerp(tmpV.set(me.x - fx_ * 6.2 - fz_ * 1.1, me.y + 3.6, me.z - fz_ * 6.2 + fx_ * 1.1), Math.min(1, dt * 12));
      camLook.set(me.x + fx_ * 8 - fz_ * 0.6, me.y + 0.7, me.z + fz_ * 8 + fx_ * 0.6);
    } else {
      const tx = b && b.state !== 'wait' ? b.x * 0.5 : 0, side = me ? (me.team ? 1 : -1) : -1;
      camPos.lerp(tmpV.set(side * 16, 9, 10), Math.min(1, dt * 2)); camLook.lerp(tmpV.set(tx, 1, 0), Math.min(1, dt * 3));
    }
    camera.position.copy(camPos).add(tmpV.set((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5));
    camera.lookAt(camLook);
    camera.fov = 68 + kick * 12; camera.updateProjectionMatrix();
    composer.render();
  }
  resize();
  return { resize, frame, fx, project, chars };
}
