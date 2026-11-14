// Mini-golf : le parcours en 3D façon maquette miniature. Une île flottante en strates (les bassins et les rivières sont
// creusés dedans, les rivières qui traversent tout le trou la coupent en plusieurs îles), murs, obstacles et décor en
// volumes, univers autour (îlots, bâtiments), lumière douce et ombres, caméra isométrique fixe qui suit doucement la balle.
// Par-dessus, un calque 2D : visée, trajectoire, traînées, particules, noms et textes.
// Même interface que l'ancien rendu : setHole, frame, focus, overview, snap, toWorld, burst, sink, splash, float, trail…
/* global Golf, GolfLooks */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as P from './props.js';

const { W, H, CUP, WALL } = Golf;
const TAU = Math.PI * 2;
const M = 28; // herbe autour des murs extérieurs
const TOP = 34; // épaisseur de la couche du dessus : les bassins sont creusés dedans
const WATER_Y = -12, WALL_H = 15, BS = 1.3; // BS : la balle est dessinée un peu plus grosse, pour bien la voir
const hashStr = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const V = (x, y, z = 0) => new THREE.Vector3(x - W / 2, z, y - H / 2); // parcours (x, y, hauteur) -> scène

// Palettes : chaque univers a son ciel, son sol, ses strates, ses murs, son eau
const T = (o) => ({ trees: { leaf: '#5fbf4a', leaf2: '#7fd466', trunk: '#8a5a35' }, sun: '#fff3e0', sunI: 2.3, hemi: ['#dff4ff', '#7a8a6a'], stone: '#efe9df', ...o });
export const THEMES = {
  classic: T({ sky: ['#86d3ff', '#e9f8ff'], ground: '#7fd35a', ground2: '#74c852', lip: '#5fae45', strata: ['#d39a62', '#b46e45', '#8a4a3a'], wall: '#fbf1e2', wallTop: '#ffffff', accent: '#ff8fb1', water: '#4fd0e0', sand: '#f5d98e', bridge: '#d9a46b', flag: '#ff5a6e', amb: 'petals', hedge: true }),
  tropical: T({ sky: ['#64dcec', '#e4fbff'], ground: '#8be36a', ground2: '#80d860', lip: '#f2d38f', strata: ['#f2d38f', '#e4b76a', '#c98b4f'], wall: '#f6e3b4', wallTop: '#fff6dc', accent: '#ff9a6a', water: '#3fe0e6', sand: '#f8e4ae', bridge: '#c8935a', flag: '#ff7a3d', amb: 'sparkles', hedge: true, trees: { leaf: '#3fae4a', leaf2: '#58c454', trunk: '#a0703f' } }),
  space: T({ sky: ['#2e2a7e', '#b4a2ff'], ground: '#6b60c8', ground2: '#6257bc', lip: '#4f46a0', strata: ['#3a3f7a', '#2e3266', '#232650'], wall: '#d6f8ff', wallTop: '#ffffff', neon: '#5ff0ff', accent: '#ff8ae0', water: '#120a2c', sand: '#9a94c8', bridge: '#9aa4c8', flag: '#ff4fd8', amb: 'stars', sun: '#e8e0ff', sunI: 2.1, hemi: ['#c8c0ff', '#3a3570'], blackHole: true }),
  volcano: T({ sky: ['#ff9a76', '#ffe2c8'], ground: '#a08a82', ground2: '#96807a', lip: '#7a645c', strata: ['#6e5650', '#57433e', '#43332f'], wall: '#62514b', wallTop: '#b8a296', accent: '#c9a08a', water: '#ff8a2a', sand: '#7a665e', bridge: '#8a7466', flag: '#ffd23f', amb: 'embers', sun: '#ffd8b8', hemi: ['#ffd0b8', '#5a3a30'], lava: true }),
  candy: T({ sky: ['#ffbfe0', '#d6efff'], ground: '#ffe0ef', ground2: '#ffd3e8', lip: '#ffb3d4', strata: ['#fff2dc', '#ff9ec7', '#8a5434'], wall: '#ffffff', wallTop: '#ffffff', stripes: '#ff4f7b', accent: '#ff5fa2', water: '#8fdcff', sand: '#9a6440', slope: '#eab05c', bridge: '#ffffff', flag: '#7b3fe4', amb: 'sparkles', stone: '#ffffff' }),
  haunted: T({ sky: ['#8576c0', '#ddd4f0'], ground: '#7a9a72', ground2: '#719068', lip: '#5d7a56', strata: ['#5a5068', '#463e55', '#352f42'], wall: '#a8a4bd', wallTop: '#d4d0e2', accent: '#b9b4cc', water: '#5d4a96', sand: '#6e6250', bridge: '#6b5a48', flag: '#a6ff6b', amb: 'fireflies', sun: '#e8e0ff', sunI: 1.9, hemi: ['#d8d0f0', '#4a4058'], trees: { leaf: '#5a7a52', leaf2: '#6a8a60', trunk: '#5a4a5e' } }),
  ice: T({ sky: ['#a8dcff', '#f3fbff'], ground: '#f4fbff', ground2: '#e8f4fd', lip: '#d6ecf9', strata: ['#cfeaf8', '#a6d3ee', '#7fb2d1'], wall: '#cdeafa', wallTop: '#ffffff', accent: '#bfe6ff', water: '#2f86c8', sand: '#ffffff', bridge: '#c8d8e4', flag: '#ff3d5a', amb: 'snow', sunI: 2.0, trees: { leaf: '#3f8a6a', leaf2: '#4f9a78', trunk: '#7a5a45' } }),
  fair: T({ sky: ['#ffc896', '#fff1d8'], ground: '#8fdc6e', ground2: '#84d062', lip: '#6fb350', strata: ['#d39a62', '#b46e45', '#8a4a3a'], wall: '#ffcf3f', wallTop: '#fff1a8', stripes: '#e23b3b', accent: '#ff3d5a', water: '#4fb4ff', sand: '#f3dca2', bridge: '#ffcf3f', flag: '#ff3d8b', amb: 'confetti', sun: '#ffe8c8', hedge: true }),
  sea: T({ sky: ['#22a8c0', '#a6eeee'], ground: '#f2dea8', ground2: '#ead49a', lip: '#d8c084', strata: ['#d8c084', '#7fbfb0', '#3f8f8a'], wall: '#7a9aa6', wallTop: '#b4ccd4', accent: '#ff7f6e', water: '#0d4a70', sand: '#dcc488', bridge: '#8a6a4a', flag: '#ffd23f', amb: 'bubbles', sun: '#e0fff8', sunI: 2.0, hemi: ['#c8fff4', '#2a6a70'] }),
  jungle: T({ sky: ['#9fe8bc', '#effff3'], ground: '#63c65c', ground2: '#5aba53', lip: '#4e9e48', strata: ['#8a6a3a', '#6b4a2a', '#4e3017'], wall: '#a87a48', wallTop: '#d4a870', accent: '#ffb35a', water: '#3fc4b4', sand: '#9a7a50', bridge: '#9a6d40', flag: '#ff9a1f', amb: 'leaves', hedge: true, stone: '#c9b07a', trees: { leaf: '#3f9e3a', leaf2: '#5ab84e', trunk: '#6b4a2a' } }),
  factory: T({ sky: ['#b0cce6', '#eef5fb'], ground: '#a9b5c1', ground2: '#a0acb8', lip: '#8794a0', strata: ['#6f7c88', '#5a6570', '#46505a'], wall: '#ffb627', wallTop: '#ffd36e', stripes: '#33333b', accent: '#ff6b3d', water: '#3fbfa0', sand: '#c9b48a', bridge: '#8a96a2', flag: '#ff6b3d', amb: 'dust', stone: '#c8d0d8' }),
  desert: T({ sky: ['#ffcf90', '#fff5e0'], ground: '#f2cf8a', ground2: '#ebc67e', lip: '#e0b06a', strata: ['#e0a868', '#c97f4f', '#a35a3a'], wall: '#e8b07a', wallTop: '#f8d8ac', accent: '#4fb8c8', water: '#3fd6d0', sand: '#e9ad60', bridge: '#c8935a', flag: '#ff5a3d', amb: 'dust', sun: '#fff0d8', hemi: ['#fff0d8', '#a87a50'], stone: '#f6d3a6' }),
};

/* ---------- Textures peintes ---------- */
const canvasTex = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const mk = (w, h) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); return [c, c.getContext('2d')]; };
function star2d(c, x, y, r, n = 5) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
function chevron(c, x, y, [dx, dy], s) { const px = -dy, py = dx; c.beginPath(); c.moveTo(x - dx * s + px * s, y - dy * s + py * s); c.lineTo(x, y); c.lineTo(x - dx * s - px * s, y - dy * s - py * s); c.stroke(); }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

// Bandes de la tranche : liseré d'herbe en haut, puis la terre, avec des cailloux
function strataTex(th, top) {
  const [c, x] = mk(128, 128);
  x.fillStyle = th.strata[0]; x.fillRect(0, 0, 128, 128);
  if (top) { x.fillStyle = th.lip; x.beginPath(); x.moveTo(0, 0); x.lineTo(128, 0); for (let i = 128; i >= 0; i -= 8) x.lineTo(i, 26 + Math.sin(i * 0.3) * 3); x.fill(); }
  const r = P.rngOf(7);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`; x.beginPath(); x.ellipse(r() * 128, (top ? 36 : 0) + r() * 92, 2 + r() * 4, 1.5 + r() * 2, 0, 0, TAU); x.fill(); }
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return canvasTex(c, true);
}
// Dégradé d'opacité : plein en haut, transparent en bas (cascades)
function fadeDown() {
  const [c, x] = mk(4, 64), g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#bbb'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}
function waterTex(th) {
  const [c, x] = mk(256, 256), r = P.rngOf(3);
  x.fillStyle = th.water; x.fillRect(0, 0, 256, 256);
  if (th.lava) {
    for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,220,120,.7)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.save(); x.translate(r() * 256, r() * 256); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); x.restore(); }
    x.strokeStyle = 'rgba(90,20,0,.35)'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { x.beginPath(); let px = r() * 256, py = r() * 256; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
  } else if (th.blackHole) {
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(200,180,255,${r() * 0.5})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
  } else {
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2.2; x.lineCap = 'round';
    for (let i = 0; i < 46; i++) { const px = r() * 256, py = r() * 256, w = 10 + r() * 16; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + w / 2, py - 4, px + w, py); x.stroke(); }
  }
  return canvasTex(c, true);
}
// Cascade : filets clairs qui tombent, de plus en plus transparents vers le bas
function fallTex(th) {
  const [c, x] = mk(64, 128), r = P.rngOf(5);
  x.fillStyle = th.water; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 26; i++) { x.fillStyle = th.lava ? 'rgba(255,220,120,.6)' : 'rgba(255,255,255,.55)'; x.fillRect(r() * 64, r() * 128, 1.5 + r() * 2.5, 20 + r() * 40); }
  const t = canvasTex(c, true);
  return t;
}
function beltTex(dark, arrow) {
  const [c, x] = mk(64, 64);
  x.fillStyle = dark; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 3);
  x.strokeStyle = arrow; x.lineWidth = 6; x.lineCap = 'round'; chevron(x, 40, 32, [1, 0], 12);
  return canvasTex(c, true);
}
// Ciel : dégradé doux (et étoiles pour l'espace)
function skyTex(th) {
  const [c, x] = mk(16, 512), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); x.fillStyle = g; x.fillRect(0, 0, 16, 512);
  if (th.blackHole) { const [c2, y] = mk(512, 512); y.drawImage(c, 0, 0, 512, 512); const r = P.rngOf(11); for (let i = 0; i < 260; i++) { y.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; y.beginPath(); y.arc(r() * 512, r() * 380, r() * 1.4 + 0.3, 0, TAU); y.fill(); } return canvasTex(c2); }
  return canvasTex(c);
}
const ballTexCache = new Map();
// Balle : texture « tour du monde » (le motif s'enroule autour de la sphère)
function ballTex(look) {
  const key = `${look.color}|${look.motif}|${look.finish}`;
  if (ballTexCache.has(key)) return ballTexCache.get(key);
  const [c, x] = mk(256, 128), hex = look.finish === 'or' ? '#f0c419' : GolfLooks.hexOf(look.color);
  x.fillStyle = hex; x.fillRect(0, 0, 256, 128);
  const r = P.rngOf(hashStr(key));
  switch (look.motif) {
    case 'rayures': x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 46, 256, 36); break;
    case 'etoiles': x.fillStyle = '#fff'; for (let i = 0; i < 14; i++) star2d(x, r() * 256, 20 + r() * 88, 8 + r() * 6); break;
    case 'damier': x.fillStyle = 'rgba(255,255,255,.92)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32); break;
    case 'pasteque': x.fillStyle = '#2f8f3a'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#1d6a28'; for (let i = 0; i < 8; i++) { x.beginPath(); for (let y = 0; y <= 128; y += 8) x.lineTo(i * 32 + 8 + Math.sin(y * 0.3) * 4, y); for (let y = 128; y >= 0; y -= 8) x.lineTo(i * 32 + 16 + Math.sin(y * 0.3) * 4, y); x.fill(); } break;
    case 'huit': x.fillStyle = '#16161c'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(64, 64, 24, 30, 0, 0, TAU); x.fill(); x.fillStyle = '#111'; x.font = '900 40px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('8', 64, 66); break;
    case 'smiley': x.fillStyle = '#2a1a00'; x.beginPath(); x.ellipse(52, 50, 6, 9, 0, 0, TAU); x.ellipse(76, 50, 6, 9, 0, 0, TAU); x.fill(); x.lineWidth = 6; x.strokeStyle = '#2a1a00'; x.beginPath(); x.arc(64, 64, 22, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); break;
    case 'planete': x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, 30, 256, 14); x.fillRect(0, 70, 256, 20); x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(0, 52, 256, 8); break;
    case 'arcenciel': ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'].forEach((col, k) => { x.fillStyle = col; x.fillRect(0, (k * 128) / 6, 256, 128 / 6 + 1); }); break;
  }
  const t = canvasTex(c);
  ballTexCache.set(key, t);
  return t;
}
const ballMats = new Map();
function ballMat(look) {
  const key = `${look.color}|${look.motif}|${look.finish}`;
  if (!ballMats.has(key)) {
    const f = look.finish, col = GolfLooks.hexOf(look.color);
    ballMats.set(key, new THREE.MeshPhysicalMaterial({
      map: ballTex(look), roughness: f === 'brillant' ? 0.12 : f === 'or' ? 0.22 : 0.38, metalness: f === 'or' ? 0.75 : 0.02, clearcoat: f === 'brillant' ? 1 : 0.4, clearcoatRoughness: 0.2,
      emissive: f === 'fluo' ? col : '#000000', emissiveIntensity: f === 'fluo' ? 0.55 : 0,
    }));
  }
  return ballMats.get(key);
}

/* ---------- Le renderer ---------- */
// cv : le canvas 2D du calque (il reçoit les clics) ; le canvas 3D est glissé juste dessous.
// transparent : sans ciel (l'île flotte sur le fond de la page, pour l'accueil).
export function createRenderer(cv, { transparent = false } = {}) {
  const ctx = cv.getContext('2d');
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, powerPreference: 'high-performance' });
  gl.domElement.className = 'gl';
  gl.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;pointer-events:none;display:block';
  cv.before(gl.domElement);
  cv.style.position = 'relative';
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = 1.02;
  gl.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000);
  const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.15);
  const sun = new THREE.DirectionalLight('#ffffff', 2.3);
  sun.position.set(-420, 760, 360);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -720, right: 720, top: 520, bottom: -520, near: 200, far: 2200 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.8;
  scene.add(hemi, sun, sun.target);

  let hole = null, th = THEMES.classic, root = null, live = null, portrait = false, dpr = 1, ppu = 1;
  const cam = { cx: W / 2, cy: H / 2, zoom: 1, goal: { cx: W / 2, cy: H / 2, zoom: 1 }, shake: 0 };
  const view = { l: -1, r: 1, t: 1, b: -1, yaw: 0 };
  const trash = [], parts = [], floats = [], trails = new Map(), balls = new Map(), raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  /* ----- Construction d'un trou ----- */
  function setHole(h) {
    hole = h;
    th = THEMES[h.theme] ?? THEMES.classic;
    if (root) { scene.remove(root); root.traverse(o => o.geometry?.dispose()); }
    for (const x of new Set(trash)) x.dispose();
    trash.length = 0;
    for (const b of balls.values()) { scene.remove(b.obj); b.obj.traverse(o => o.geometry?.dispose()); }
    balls.clear(); trails.clear();
    parts.length = floats.length = 0;
    root = new THREE.Group();
    scene.add(root);
    const rand = P.rngOf(hashStr(h.id));
    scene.background = transparent ? null : keep(skyTex(th));
    hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]);
    sun.color.set(th.sun); sun.intensity = th.sunI;
    live = { water: [], falls: [], belts: [], fans: [], bridges: [], blades: [], gates: [], doors: [], critters: [], plates: [], spins: [], flags: [], fades: [], magnets: [], candles: [], env: null, cup: null, ambient: null };
    buildIsland(rand);
    buildWalls();
    buildObstacles(rand);
    buildCups();
    buildDeco(rand);
    const env = P.environment(h.theme, th, rand);
    root.add(env.group);
    live.env = env;
    live.ambient = ambient(rand);
    fit();
  }
  // ce qui appartient au trou (matériaux, textures) est libéré au trou suivant
  const keep = x => { trash.push(x); if (x.map) trash.push(x.map); return x; };
  const add = (o, ...fl) => { root.add(o); return o; };
  const ownMat = (o) => { o.traverse(m => { if (m.isMesh) { m.material = keep(m.material.clone()); m.material.transparent = true; } }); return o; };
  // Objet qui s'efface quand une balle passe dessous (palmiers, tunnel, tuyaux, drapeau)
  function fadeable(o, pts, r) { ownMat(o); const ms = []; o.traverse(m => m.isMesh && ms.push(m.material)); live.fades.push({ pts, r, ms, k: 1 }); return o; }

  // L'île : couche du dessus percée par l'eau et coupée par les rivières, puis les strates qui se resserrent vers le bas
  function buildIsland(rand) {
    const splits = (hole.zones || []).filter(z => z.t === 'water' && z.r && z.r[1] <= 0 && z.r[1] + z.r[3] >= H).map(z => [z.r[0], z.r[0] + z.r[2]]).sort((a, b) => a[0] - b[0]);
    const xs = [-M]; for (const [a, b] of splits) xs.push(a, b); xs.push(W + M);
    const pieces = []; for (let i = 0; i < xs.length; i += 2) pieces.push([xs[i], xs[i + 1]]);
    // texture du dessus
    const k = Math.min(1.9, 2048 / (W + 2 * M)), [tc, tx] = mk(Math.round((W + 2 * M) * k), Math.round((H + 2 * M) * k));
    tx.setTransform(k, 0, 0, k, M * k, M * k);
    paintTop(tx, rand);
    const topTex = canvasTex(tc);
    topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
    topTex.repeat.set(1 / (W + 2 * M), -1 / (H + 2 * M));
    topTex.offset.set(M / (W + 2 * M), 1 - M / (H + 2 * M));
    const sideTex = strataTex(th, true);
    sideTex.repeat.set(1 / 90, 1 / TOP); sideTex.offset.set(0, (TOP - 1) / TOP);
    const topMat = keep(new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.78 }));
    const sideMat = keep(new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 }));
    const pools = (hole.zones || []).filter(z => z.t === 'water' && !(z.r && z.r[1] <= 0 && z.r[1] + z.r[3] >= H));
    for (const [a, b] of pieces) {
      const first = a === -M, last = b === W + M;
      const s = roundRect(a, -M, b, H + M, first ? 34 : 0, last ? 34 : 0);
      const inside = (x, y) => x > a + 4 && x < b - 4;
      for (const z of pools) {
        const p = new THREE.Path();
        if (z.c) { if (!inside(z.c[0], z.c[1])) continue; p.absarc(z.c[0], z.c[1], z.c[2], 0, TAU, true); }
        else {
          const x0 = clamp(z.r[0], a + 3, b - 3), x1 = clamp(z.r[0] + z.r[2], a + 3, b - 3), y0 = clamp(z.r[1], -M + 3, H + M - 3), y1 = clamp(z.r[1] + z.r[3], -M + 3, H + M - 3);
          if (x1 - x0 < 4 || !inside((x0 + x1) / 2, 0)) continue;
          p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath();
        }
        s.holes.push(p);
      }
      for (const c of [hole.cupMove ? null : hole.cup, hole.bonus].filter(Boolean)) if (inside(c[0], c[1])) { const p = new THREE.Path(); p.absarc(c[0], c[1], CUP, 0, TAU, true); s.holes.push(p); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: TOP, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.6, bevelSegments: 2, curveSegments: 28 });
      geo.rotateX(Math.PI / 2);
      geo.translate(-W / 2, -1.6, -H / 2);
      const m = new THREE.Mesh(geo, [topMat, sideMat]);
      m.receiveShadow = true; m.castShadow = true;
      add(m);
    }
    // Strates du socle (continues sous les rivières : le fond du canyon)
    let y = -TOP, inset = 0;
    th.strata.forEach((c, i) => {
      const hgt = [44, 30, 34][i], sm = new THREE.MeshStandardMaterial({ map: strataTex({ ...th, strata: [c] }, false), roughness: 0.92 });
      sm.map.repeat.set(1 / 90, 1 / hgt); sm.map.offset.set(0, (hgt - 1) / hgt);
      const s = roundRect(-M + inset, -M + inset, W + M - inset, H + M - inset, 34, 34);
      const geo = new THREE.ExtrudeGeometry(s, { depth: hgt, bevelEnabled: false, curveSegments: 20 });
      geo.rotateX(Math.PI / 2); geo.translate(-W / 2, y, -H / 2);
      const m = new THREE.Mesh(geo, [P.mat(shade(c, -10)), keep(sm)]);
      m.receiveShadow = true; add(m);
      y -= hgt; inset += 7 + i * 5;
    });
    // Dessous rocheux de l'île flottante
    const under = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.35, 1, 7), P.mat(th.strata[2], { flatShading: true }));
    under.scale.set((W - 2 * inset) / 2, 70, (H - 2 * inset) / 2); under.position.y = y - 35; add(under);
    for (let i = 0; i < 7; i++) { const r = 20 + rand() * 30, c = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 6), P.mat(th.strata[2 - (i % 2)], { flatShading: true })); c.rotation.x = Math.PI; c.position.set((rand() - 0.5) * (W - 300), y - 40 - r, (rand() - 0.5) * (H - 200)); add(c); }
    // Eau : une nappe sous la couche du dessus, visible dans les bassins et les rivières ; cascades au bord des rivières
    const wt = waterTex(th);
    wt.repeat.set((W + 2 * M) / 160, (H + 2 * M) / 160);
    const wm = keep(new THREE.MeshStandardMaterial({ map: wt, roughness: th.lava ? 0.6 : 0.12, metalness: 0.05, emissive: th.lava ? '#ff7a1a' : th.blackHole ? '#2a1060' : '#000000', emissiveIntensity: th.lava ? 1.3 : 0.4, emissiveMap: th.lava || th.blackHole ? wt : null, transparent: !th.lava, opacity: 0.93 }));
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * M - 6, H + 2 * M - 6), wm);
    sheet.rotation.x = -Math.PI / 2; sheet.position.y = WATER_Y; sheet.receiveShadow = true;
    // les coordonnées de texture suivent le parcours pour que l'eau glisse doucement
    add(sheet); live.water.push(wt);
    for (const [a, b] of splits) for (const zEdge of [-M, H + M]) {
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 150), keep(new THREE.MeshStandardMaterial({ map: fallTex(th), alphaMap: fadeDown(), transparent: true, opacity: 0.92, depthWrite: false, emissive: th.lava ? '#ff5a1f' : '#000000', emissiveIntensity: th.lava ? 0.8 : 0, roughness: 0.2, side: THREE.DoubleSide })));
      fall.material.map.repeat.set((b - a) / 40, 1.5); live.falls.push(fall.material.map); trash.push(fall.material.alphaMap);
      fall.position.set((a + b) / 2 - W / 2, WATER_Y - 75, zEdge - H / 2 + (zEdge > 0 ? 1.5 : -1.5)); // la cascade coule le long de la falaise
      add(fall);
    }
  }
  function roundRect(x0, y0, x1, y1, rl, rr) {
    const s = new THREE.Shape();
    s.moveTo(x0 + rl, y0); s.lineTo(x1 - rr, y0);
    rr ? s.quadraticCurveTo(x1, y0, x1, y0 + rr) : 0; s.lineTo(x1, y1 - rr);
    rr ? s.quadraticCurveTo(x1, y1, x1 - rr, y1) : 0; s.lineTo(x0 + rl, y1);
    rl ? s.quadraticCurveTo(x0, y1, x0, y1 - rl) : 0; s.lineTo(x0, y0 + rl);
    rl ? s.quadraticCurveTo(x0, y0, x0 + rl, y0) : 0;
    return s;
  }

  // Le dessus de l'île : gazon tondu en damier, bordure, zones (sable, glace, pentes…), départ, marquages
  function paintTop(c, rand) {
    const th2 = th, t = hole.theme;
    c.fillStyle = th2.ground; c.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    // motif du sol, différent selon l'univers
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    if (t === 'space' || t === 'factory') { // dalles
      for (let x = 0; x < W; x += 50) for (let y = 0; y < H; y += 50) { c.fillStyle = (x / 50 + y / 50) % 2 ? th2.ground2 : th2.ground; c.fillRect(x, y, 50, 50); }
      c.strokeStyle = t === 'space' ? 'rgba(160,240,255,.28)' : 'rgba(0,0,0,.08)'; c.lineWidth = 1.5;
      for (let x = 0; x <= W; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y <= H; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      if (t === 'factory') { c.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x <= W; x += 50) for (let y = 0; y <= H; y += 50) c.fillRect(x - 1.5, y - 1.5, 3, 3); }
    } else if (t === 'candy') {
      c.fillStyle = th2.ground2; for (let x = -H; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, 0); c.lineTo(x + 30 + H, H); c.lineTo(x + H, H); c.fill(); }
    } else if (t === 'desert' || t === 'sea') { // rides du sable
      c.strokeStyle = 'rgba(160,110,50,.18)'; c.lineWidth = 3;
      for (let y = 8; y < H; y += 20) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x / 50 + y * 0.7) * 5); c.stroke(); }
    } else { // gazon tondu en damier, avec quelques plaques plus claires
      for (let x = 0; x < W; x += 100) for (let y = 0; y < H; y += 100) if ((x / 100 + y / 100) % 2) { c.fillStyle = th2.ground2; c.fillRect(x, y, 100, 100); }
      for (let i = 0; i < 18; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 90); g.addColorStop(0, `rgba(255,255,${t === 'ice' ? 255 : 160},.10)`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); c.translate(rand() * W, rand() * H); c.fillStyle = g; c.fillRect(-90, -90, 180, 180); c.restore(); }
    }
    // grain fin
    for (let i = 0; i < 5000; i++) { c.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; c.fillRect(rand() * W, rand() * H, 1.6, 1.6); }
    decoFlat(c, rand);
    for (const z of hole.zones || []) zone(c, z, rand);
    // ombre douce au pied des murs
    c.save(); c.filter = 'blur(5px)'; c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = WALL * 2 + 10; c.lineJoin = c.lineCap = 'round';
    for (const w of hole.walls) { const p = Golf.wallPts(w); c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
    c.restore();
    c.restore();
    // bordure hors du parcours : herbe plus foncée et liseré
    c.save(); c.beginPath(); c.rect(-M, -M, W + 2 * M, H + 2 * M); c.rect(W + 0.01, -0.01, -W, H + 0.02); c.clip('evenodd');
    c.fillStyle = shade(th2.ground2, -14); c.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    for (let i = 0; i < 160; i++) { c.fillStyle = ['#ffffff', '#ffe066', '#ff8fb1'][i % 3]; const a = rand(); const [x, y] = a < 0.5 ? [rand() * W, a < 0.25 ? -M / 2 + (rand() - 0.5) * 12 : H + M / 2 + (rand() - 0.5) * 12] : [a < 0.75 ? -M / 2 + (rand() - 0.5) * 12 : W + M / 2 + (rand() - 0.5) * 12, rand() * H]; if (t !== 'space' && t !== 'factory' && t !== 'volcano') { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); } }
    c.restore();
    // bord des bassins (margelle claire)
    for (const z of hole.zones || []) if (z.t === 'water') {
      c.save(); c.lineWidth = 7; c.strokeStyle = th2.lava ? '#3a2a25' : th2.blackHole ? 'rgba(180,140,255,.7)' : 'rgba(255,255,255,.75)';
      c.beginPath(); if (z.r) c.rect(...z.r); else c.arc(z.c[0], z.c[1], z.c[2] + 2, 0, TAU); c.stroke(); c.restore();
    }
    // départ
    const [tx0, ty0] = hole.tee;
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.roundRect(tx0 - 28, ty0 - 28, 56, 56, 12); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5; c.setLineDash([7, 6]); c.stroke(); c.setLineDash([]);
    for (const tp of hole.teleports || []) { c.strokeStyle = 'rgba(190,140,255,.9)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(tp.to[0], tp.to[1], tp.r + 4, 0, TAU); c.stroke(); c.setLineDash([]); }
    // cercle blanc autour du trou
    for (const cup of [hole.cupMove ? null : hole.cup, hole.bonus].filter(Boolean)) { c.strokeStyle = cup === hole.bonus ? 'rgba(255,215,64,.95)' : 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.arc(cup[0], cup[1], CUP + 7, 0, TAU); c.stroke(); }
    if (hole.cupMove) { const mv = hole.cupMove; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(hole.cup[0] - mv.dx * mv.amp, hole.cup[1] - mv.dy * mv.amp); c.lineTo(hole.cup[0] + mv.dx * mv.amp, hole.cup[1] + mv.dy * mv.amp); c.stroke(); }
  }
  function zone(c, z, rand) {
    const box2 = z.r ?? [z.c[0] - z.c[2], z.c[1] - z.c[2], z.c[2] * 2, z.c[2] * 2], [x0, y0, w, h] = box2;
    c.save(); c.beginPath(); if (z.r) c.roundRect(...z.r, z.t === 'sand' || z.t === 'snow' ? 18 : 3); else c.arc(z.c[0], z.c[1], z.c[2], 0, TAU);
    if (z.t === 'sand' || z.t === 'snow') {
      c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 10; c.fillStyle = z.t === 'snow' ? '#ffffff' : th.sand; c.fill(); c.shadowBlur = 0; c.clip();
      c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.08)'; c.stroke();
      for (let i = 0; i < (w * h) / 40; i++) { c.fillStyle = z.t === 'snow' ? 'rgba(150,200,235,.35)' : 'rgba(140,100,50,.22)'; c.fillRect(x0 + rand() * w, y0 + rand() * h, 2, 2); }
      if (hole.theme === 'candy') for (let i = 0; i < (w * h) / 200; i++) { c.fillStyle = ['#ff6fa8', '#7bd3ff', '#ffe066', '#ffffff'][i % 4]; c.fillRect(x0 + rand() * w, y0 + rand() * h, 4, 2); }
      c.strokeStyle = z.t === 'snow' ? 'rgba(150,200,235,.3)' : 'rgba(150,110,60,.25)'; c.lineWidth = 2; // râteau
      for (let y = y0 + 10; y < y0 + h; y += 12) { c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + w / 2, y + 6, x0 + w, y); c.stroke(); }
    } else if (z.t === 'ice') {
      c.fillStyle = hole.theme === 'space' ? 'rgba(170,230,255,.32)' : 'rgba(175,225,255,.75)'; c.fill(); c.clip();
      const g = c.createLinearGradient(x0, y0, x0 + w, y0 + h); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.25)'); c.fillStyle = g; c.fillRect(x0, y0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (let i = 0; i < (w * h) / 7000; i++) { const x = x0 + rand() * w, y = y0 + rand() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y - 12); c.stroke(); }
    } else if (z.t === 'slope') {
      c.fillStyle = th.slope ?? shade(th.ground, -18); c.fill(); c.clip();
      const g = c.createLinearGradient(x0 + (z.dir[0] < 0 ? w : 0), y0 + (z.dir[1] < 0 ? h : 0), x0 + (z.dir[0] > 0 ? w : 0), y0 + (z.dir[1] > 0 ? h : 0)); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g; c.fillRect(x0, y0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.lineCap = 'round'; for (let y = y0 + 22; y < y0 + h; y += 40) for (let x = x0 + 22; x < x0 + w; x += 40) chevron(c, x, y, z.dir, 9);
    } else if (z.t === 'fan') {
      c.fillStyle = 'rgba(40,40,60,.28)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2;
      if (z.dir[0]) for (let y = y0; y < y0 + h; y += 12) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke(); }
      else for (let x = x0; x < x0 + w; x += 12) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke(); }
    } else if (z.t === 'belt' || z.t === 'ramp') { c.fillStyle = 'rgba(0,0,0,.2)'; c.fill(); }
    c.restore();
  }
  function decoFlat(c, rand) {
    for (const d of hole.deco || []) {
      if (d.t === 'cracks') { c.strokeStyle = 'rgba(255,110,40,.45)'; c.lineWidth = 2.5; for (let i = 0; i < 34; i++) { let x = rand() * W, y = rand() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); } }
      if (d.t === 'sprinkles') for (let i = 0; i < 300; i++) { c.fillStyle = ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e', '#c49bff'][i % 5]; c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * 3); c.beginPath(); c.roundRect(-4, -1.4, 8, 2.8, 1.4); c.fill(); c.restore(); }
      if (d.t === 'stars') for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(220,240,255,${0.2 + rand() * 0.5})`; star2d(c, rand() * W, rand() * H, 1.5 + rand() * 2.5, 4); }
      if (d.t === 'snowflakes') for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(180,215,240,.55)'; star2d(c, rand() * W, rand() * H, 3 + rand() * 3, 6); }
      if (d.t === 'leaves') for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(30,${110 + rand() * 60},40,.35)`; c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * TAU); c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, TAU); c.fill(); c.restore(); }
      if (d.t === 'webs') for (const [x, y, a] of [[0, 0, 0], [W, 0, Math.PI / 2], [W, H, Math.PI], [0, H, -Math.PI / 2]]) { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(k * 0.39) * 90, Math.sin(k * 0.39) * 90); c.stroke(); } for (let r = 20; r < 90; r += 18) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke(); } c.restore(); }
    }
  }

  // Murs : blocs aux joints arrondis, dessus plus clair ; haies basses ; rayures selon l'univers
  function buildWalls() {
    const side = th.stripes ? P.mat('#ffffff', { map: P.stripes(th.wall, th.stripes, 2, true) }) : P.mat(th.wall);
    const top = th.neon ? P.mat(th.wallTop, { emissive: th.neon, emissiveIntensity: 0.9 }) : P.mat(th.wallTop);
    for (const w of hole.walls) {
      const p = Golf.wallPts(w), low = !Array.isArray(w) && w.low, h = low ? 8 : WALL_H;
      const sideM = low ? P.mat(th.hedge ? '#4fae46' : shade(th.wall, -12)) : side, topM = low ? P.mat(th.hedge ? '#6fcc5f' : th.wallTop) : top;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3], L = Math.hypot(bx - ax, by - ay);
        if (L < 0.5) continue;
        const geo = new THREE.BoxGeometry(L, h, WALL * 2 + 1);
        if (th.stripes && !low) { const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * L / 18); }
        const m = new THREE.Mesh(geo, [sideM, sideM, topM, sideM, sideM, sideM]);
        m.position.copy(V((ax + bx) / 2, (ay + by) / 2, h / 2)); m.rotation.y = -Math.atan2(by - ay, bx - ax);
        m.castShadow = m.receiveShadow = true; add(m);
      }
      for (let i = 0; i < p.length; i += 2) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(WALL + 1.6, WALL + 1.6, h + 2, 18), [sideM, topM, topM]);
        post.position.copy(V(p[i], p[i + 1], h / 2 + 1)); post.castShadow = true; add(post);
        if (!low && th.neon) add(P.ball(1.8, P.mat(th.neon, { emissive: th.neon, emissiveIntensity: 2 }), ...V(p[i], p[i + 1], h + 3).toArray()));
      }
      if (low && th.hedge) { const L = Math.hypot(p[2] - p[0], p[3] - p[1]); for (let s = 0; s <= L; s += 10) { const u = s / L; add(P.ball(5.5, P.mat('#5fbf52'), ...V(p[0] + (p[2] - p[0]) * u, p[1] + (p[3] - p[1]) * u, 8).toArray(), 10)); } }
    }
  }

  // Obstacles : plots, palmiers, gélatines, rampes, tapis, ventilateurs, ponts, moulins, portes, téléporteurs, tuyaux…
  function buildObstacles(rand) {
    (hole.bumpers || []).forEach((b, i) => add(bumper(b, i)));
    for (const z of hole.zones || []) {
      if (z.t === 'ramp') add(ramp(z));
      if (z.t === 'belt') {
        const tex = beltTex(hole.theme === 'sea' ? '#3a8ab8' : '#3a3d4a', hole.theme === 'sea' ? 'rgba(220,250,255,.75)' : '#ffd23f');
        const along = z.dir[0] ? [z.r[2], z.r[3]] : [z.r[3], z.r[2]];
        tex.repeat.set(along[0] / 40, along[1] / 40);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(...along), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, transparent: hole.theme === 'sea', opacity: 0.75 })));
        m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z.dir[1], z.dir[0]); m.position.copy(V(z.r[0] + z.r[2] / 2, z.r[1] + z.r[3] / 2, 0.5)); m.receiveShadow = true;
        add(m); live.belts.push({ tex, f: z.f });
        if (hole.theme !== 'sea') for (const s of [-1, 1]) { const along = z.dir[0] ? [z.r[2], 4] : [4, z.r[3]]; const rail = P.box(along[0], 4, along[1], '#5a6070', ...V(z.r[0] + z.r[2] / 2 + (z.dir[0] ? 0 : s * (z.r[2] / 2 + 2)), z.r[1] + z.r[3] / 2 + (z.dir[0] ? s * (z.r[3] / 2 + 2) : 0)).toArray()); add(rail); }
      }
      if (z.t === 'fan') {
        const g = new THREE.Group(), [x0, y0, w, h] = z.r, ux = x0 + w / 2 - z.dir[0] * (w / 2), uy = y0 + h / 2 - z.dir[1] * (h / 2);
        const hub = new THREE.Group(); hub.add(P.cyl(12, 12, 4, '#5a6070', 0, -2), P.ball(4, '#ffb04a'));
        for (let k = 0; k < 3; k++) { const bl = P.box(20, 1, 6, '#e8edf2', 10, -0.5, 0); const piv = new THREE.Group(); piv.add(bl); piv.rotation.y = (k / 3) * TAU; hub.add(piv); }
        hub.rotation.x = Math.PI / 2; hub.position.copy(V(ux, uy, 13)); hub.lookAt(V(ux + z.dir[0] * 100, uy + z.dir[1] * 100, 13)); hub.rotateX(Math.PI / 2);
        g.add(P.box(z.dir[0] ? 8 : w, 22, z.dir[0] ? h : 8, '#7a8496', ...V(ux, uy).toArray(), 2), hub);
        const tex = beltTex('rgba(0,0,0,0)', 'rgba(255,255,255,.9)'); tex.repeat.set(1, 1);
        const air = new THREE.Mesh(new THREE.PlaneGeometry(z.dir[0] ? w : h, z.dir[0] ? h : w), keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false })));
        tex.repeat.set((z.dir[0] ? w : h) / 50, (z.dir[0] ? h : w) / 50);
        air.rotation.x = -Math.PI / 2; air.rotation.z = -Math.atan2(z.dir[1], z.dir[0]); air.position.copy(V(x0 + w / 2, y0 + h / 2, 1));
        g.add(air); add(P.shadows(g));
        live.fans.push({ z, hub, air, tex });
      }
    }
    for (const br of hole.bridges || []) {
      const [x0, y0, w, h] = br.r, across = w <= h ? 'x' : 'z';
      const tex = P.stripes(th.bridge, shade(th.bridge, -26), 2, across === 'z');
      const m = new THREE.Mesh(new RoundedBoxGeometry(w + 6, 5, h, 2, 1.5), keep(new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.7, transparent: true })));
      m.material.map.repeat.set(across === 'z' ? w / 13 : 1, across === 'z' ? 1 : h / 13); m.material.map.needsUpdate = true;
      m.position.copy(V(x0 + w / 2, y0 + h / 2, -2.4)); m.castShadow = m.receiveShadow = true;
      add(m);
      const posts = new THREE.Group(); for (const [px, py] of [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]]) posts.add(P.cyl(2, 2.4, 9, '#8a5a35', ...V(px, py).toArray(), 8)); add(P.shadows(posts));
      live.bridges.push({ br, m, posts });
    }
    for (const wm of hole.windmills || []) {
      const hub = new THREE.Group(); hub.position.copy(V(wm.x, wm.y));
      hub.add(P.cyl(14, 16, 16, '#d65a4e'), P.cone(15, 10, '#fff4e2', 0, 16), P.ball(4, '#ffd23f', 0, 27));
      const blades = [];
      for (let k = 0; k < wm.blades; k++) { const piv = new THREE.Group(); piv.add(P.box(wm.len, 11, WALL * 2, '#8a5a35', wm.len / 2, 1), P.box(wm.len * 0.72, 8, WALL * 2 + 0.6, '#fffaf0', wm.len * 0.62, 2.5)); hub.add(piv); blades.push(piv); }
      add(P.shadows(hub)); live.blades.push({ wm, blades });
    }
    for (const g of hole.gates || []) {
      const L = Math.hypot(g.x2 - g.x1, g.y2 - g.y1), geo = new THREE.BoxGeometry(L, 13, WALL * 2);
      const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * L / 16);
      const m = new THREE.Mesh(geo, P.mat('#ffffff', { map: P.stripes('#ffd23f', '#2b2b33', 2, true) })); m.castShadow = true; add(m);
      live.gates.push({ m });
    }
    for (const d of hole.doors || []) {
      const [ax, ay, bx, by] = d.seg, L = Math.hypot(bx - ax, by - ay), g = new THREE.Group();
      g.add(P.box(L, 3, WALL * 2, '#3a3448', 0, 0), P.box(L, 3, WALL * 2, '#3a3448', 0, 13));
      for (let s = -L / 2 + 4; s <= L / 2 - 4; s += 8) g.add(P.cyl(1.4, 1.4, 16, '#6e6684', s, 0, 0, 8), P.cone(1.6, 4, '#a6ff6b', s, 16, 0, 6));
      g.position.copy(V((ax + bx) / 2, (ay + by) / 2)); g.rotation.y = -Math.atan2(by - ay, bx - ax);
      add(P.shadows(g)); live.doors.push({ d, g });
    }
    for (const tp of hole.teleports || []) {
      const g = new THREE.Group(); g.position.copy(V(...tp.from));
      g.add(new THREE.Mesh(new THREE.CircleGeometry(tp.r + 2, 32), P.mat('#2a1060', { emissive: '#6a3cff', emissiveIntensity: 1.2 })));
      g.children[0].rotation.x = -Math.PI / 2; g.children[0].position.y = 0.6;
      const rings = [];
      for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(tp.r + 2 - k * 4, 1.2, 8, 40, 4.2), P.mat(['#c49bff', '#7bd3ff', '#ffffff'][k], { emissive: ['#a070ff', '#5fc8ff', '#ffffff'][k], emissiveIntensity: 1.2 })); r.rotation.x = -Math.PI / 2; r.position.y = 2 + k * 3; g.add(r); rings.push(r); }
      add(g); live.spins.push(...rings.map((r, k) => ({ obj: r, axis: 'z', speed: 2 + k })));
      const out = new THREE.Mesh(new THREE.TorusGeometry(tp.r + 4, 1.4, 8, 40), P.mat('#c49bff', { emissive: '#a070ff', emissiveIntensity: 0.9 })); out.rotation.x = -Math.PI / 2; out.position.copy(V(...tp.to, 1)); add(out);
    }
    for (const p of hole.pipes || []) {
      for (const [x, y] of [p.from, p.to]) {
        const g = new THREE.Group(); g.position.copy(V(x, y));
        g.add(P.cyl(p.r + 6, p.r + 6, 6, '#2f9e4a', 0, 0, 0, 28), P.cyl(p.r + 1, p.r + 1, 6.4, '#0b2412', 0, 0, 0, 28));
        const lip = new THREE.Mesh(new THREE.TorusGeometry(p.r + 5, 2.4, 10, 32), P.mat('#4fd06a')); lip.rotation.x = -Math.PI / 2; lip.position.y = 6.5; g.add(lip);
        add(P.shadows(g));
      }
      const a = V(...p.from, 6), b = V(...p.to, 6), mid = a.clone().lerp(b, 0.5); mid.y = 46;
      const curve = new THREE.CatmullRomCurve3([a, a.clone().setY(30), mid, b.clone().setY(30), b]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 6, 12), P.mat('#3fbf5a')); tube.castShadow = true;
      const pts = []; for (let i = 0; i <= 10; i++) { const q = curve.getPoint(i / 10); pts.push([q.x + W / 2, q.z + H / 2]); }
      add(fadeable(tube, pts, 40));
    }
    for (const s of hole.springs || []) {
      const g = new THREE.Group(); g.position.copy(V(s.x, s.y));
      g.add(P.cyl(s.r, s.r + 2, 4, '#ff4f9a'), P.cyl(s.r - 4, s.r - 4, 1, '#ffffff', 0, 4));
      for (let k = 0; k < 3; k++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(s.r - 6, 1, 6, 24), P.mat('#c8d0e0', { metalness: 0.6, roughness: 0.3 })); coil.rotation.x = -Math.PI / 2; coil.position.y = 5.5 + k * 2.2; g.add(coil); }
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 3), P.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 })); arrow.rotation.set(0, 0, -Math.PI / 2); arrow.position.set(0, 13, 0);
      const pv = new THREE.Group(); pv.add(arrow); pv.rotation.y = -Math.atan2(s.dir[1], s.dir[0]); g.add(pv);
      add(P.shadows(g));
    }
    for (const p of hole.plates || []) {
      const m = P.box(p.r * 2, 3, p.r * 2, P.mat('#8a8698', { roughness: 0.4 }), ...V(p.x, p.y).toArray(), 1); ownMat(m); add(m); live.plates.push({ p, m });
    }
    for (const mg of hole.magnets || []) {
      const g = new THREE.Group(); g.position.copy(V(mg.x, mg.y));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(mg.r, 40), keep(new THREE.MeshBasicMaterial({ color: '#ff7ac4', transparent: true, opacity: 0.16, depthWrite: false }))); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.4; g.add(disc);
      g.add(P.ball(6, '#ffd1ec', 0, 3));
      const arms = [];
      for (let k = 0; k < 9; k++) { const piv = new THREE.Group(); piv.rotation.y = (k / 9) * TAU; const arm = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 12, 4, 8), P.mat('#ff7ac4')); arm.position.set(4, 8, 0); arm.rotation.z = -0.5; piv.add(arm); g.add(piv); arms.push(arm); }
      add(P.shadows(g)); live.magnets.push({ arms });
    }
    for (const cr of hole.critters || []) { const o = critter(cr.kind, cr.r); add(o); live.critters.push({ cr, o }); }
  }
  function bumper(b, i) {
    const g = new THREE.Group(); g.position.copy(V(b.x, b.y));
    const r = b.r;
    if (b.palm) { g.add(P.cyl(r, r + 1.5, 6, th.stone), P.cyl(r - 2, r - 2, 1, P.mat(th.ground), 0, 6)); const t = P.tree('palm', 1.05, th.trees); t.position.y = 5; g.add(t); return fadeable(P.shadows(g), [[b.x, b.y]], 52); }
    if (b.cactus) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, r * 1.5, 12), P.mat('#4fae5a', { flatShading: true })); c.position.y = r * 0.75; g.add(c, P.ball(r * 0.92, P.mat('#58bb62', { flatShading: true }), 0, r * 1.5, 0, 12), P.ball(3.4, '#ff7aa8', 0, r * 2.4)); return P.shadows(g); }
    if (b.jelly) { const col = ['#ff5fa2', '#59c8ff', '#ffd23f', '#8be37a', '#b98cff'][i % 5]; const m = P.mat(col, { roughness: 0.2, transparent: true, opacity: 0.92 }); g.add(P.cyl(r, r, 6, m), P.ball(r, m, 0, 6)); g.children[1].scale.y = 0.85; g.add(P.ball(r * 0.25, '#ffffff', -r * 0.35, 6 + r * 0.6, -r * 0.2)); return P.shadows(g); }
    if (b.kick) { g.add(P.cyl(r, r + 1, 12, '#ff3d5a'), new THREE.Mesh(new THREE.TorusGeometry(r - 1, 1.6, 8, 32), P.mat('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.5 }))); g.children[1].rotation.x = -Math.PI / 2; g.children[1].position.y = 12; const st = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(r * 0.5), { depth: 1, bevelEnabled: false }), P.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 })); st.rotation.x = -Math.PI / 2; st.position.y = 12.2; g.add(st); return P.shadows(g); }
    if (b.block) { g.add(new THREE.Mesh(new RoundedBoxGeometry(r * 1.6, r * 1.3, r * 1.6, 2, 2.5), P.mat('#cfeeff', { transparent: true, opacity: 0.85, roughness: 0.05 }))); g.children[0].position.y = r * 0.65; g.children[0].rotation.y = b.x * 0.01; return P.shadows(g); }
    if (b.coral) { g.add(P.cyl(r, r + 2, 4, '#e8d6a0')); const t = P.tree('coral', r / 9); g.add(t); return P.shadows(g); }
    if (b.tomb) { const t = P.tomb(); t.scale.setScalar(r / 6); g.add(t); return P.shadows(g); }
    if (b.bolt) { g.add(P.cyl(r, r, 10, P.mat('#c8d0d8', { metalness: 0.5, roughness: 0.35, flatShading: true }), 0, 0, 0, 6), P.cyl(r * 0.55, r * 0.55, 4, P.mat('#ffb627', { metalness: 0.3, roughness: 0.4 }), 0, 10, 0, 6)); return P.shadows(g); }
    // plot : borne ronde avec bague blanche
    g.add(P.cyl(r, r + 1, 11, th.accent), P.cyl(r + 0.4, r + 0.4, 2.4, '#ffffff', 0, 6), P.ball(r, th.accent, 0, 11));
    g.children[2].scale.y = 0.45;
    return P.shadows(g);
  }
  function starShape(r) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return s; }
  function ramp(z) {
    const [x0, y0, w, h] = z.r, alongX = !!z.dir[0], sgn = alongX ? z.dir[0] : z.dir[1];
    const geo = new THREE.BoxGeometry(w, 12, h, 1, 1, 1), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0 && (alongX ? pos.getX(i) : pos.getZ(i)) * sgn < 0) pos.setY(i, -5.6);
    geo.computeVertexNormals();
    const tex = P.stripes('#d99a5a', '#c0844a', 2, alongX).clone(); tex.repeat.set(alongX ? w / 12 : 1, alongX ? 1 : h / 12); tex.needsUpdate = true;
    const m = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })));
    m.position.copy(V(x0 + w / 2, y0 + h / 2, 6)); m.castShadow = m.receiveShadow = true;
    const g = new THREE.Group(); g.add(m);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 3), P.mat('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.4 }));
    arrow.rotation.z = -Math.PI / 2; // la pointe dans le sens du saut
    const pv = new THREE.Group(); pv.position.copy(V(x0 + w / 2 + (alongX ? sgn * w * 0.2 : 0), y0 + h / 2 + (alongX ? 0 : sgn * h * 0.2), 14)); pv.add(arrow); pv.rotation.y = -Math.atan2(z.dir[1], z.dir[0]); g.add(pv);
    return g;
  }
  function critter(kind, r) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const eyes = (y, z, s = 1.6) => { for (const sz of [-1, 1]) body.add(P.ball(s, '#1a1a22', r * 0.55, y, sz * z, 10)); };
    if (kind === 'ghost') {
      const m = P.mat('#f6f4ff', { transparent: true, opacity: 0.88, emissive: '#e8e4ff', emissiveIntensity: 0.25 });
      body.add(P.ball(r, m, 0, r * 1.7), P.cone(r, r * 1.6, m, 0, 0)); body.children[1].rotation.x = Math.PI; body.children[1].position.y = r * 0.9;
      eyes(r * 1.9, r * 0.35, 2.4);
    } else if (kind === 'penguin') {
      body.add(P.ball(r * 0.85, '#1f2430', 0, r), P.ball(r * 0.62, '#ffffff', r * 0.3, r * 0.95), P.cone(2.4, 6, '#ff9a1f', r * 0.9, r * 1.35)); body.children[0].scale.y = 1.3; body.children[2].rotation.z = -Math.PI / 2;
      eyes(r * 1.55, r * 0.3);
    } else if (kind === 'fish') {
      body.add(P.ball(r, '#ff9a1f', 0, r), P.cone(r * 0.7, r, '#ff7a1f', -r * 1.3, r * 0.5)); body.children[0].scale.set(1.3, 0.75, 0.7); body.children[1].rotation.z = Math.PI / 2;
      body.add(P.box(1, r * 1.3, r * 1.3, '#ffffff', -r * 0.1, r * 0.35)); eyes(r * 1.15, r * 0.35);
    } else if (kind === 'monkey') {
      body.add(P.ball(r, '#7a4a24', 0, r), P.ball(r * 0.4, '#7a4a24', 0, r * 1.5, -r), P.ball(r * 0.4, '#7a4a24', 0, r * 1.5, r), P.ball(r * 0.6, '#e8b98a', r * 0.55, r * 0.9));
      eyes(r * 1.3, r * 0.3);
    } else body.add(P.ball(r, '#ffd23f', 0, r));
    return P.shadows(g);
  }

  // Trou : fourreau sombre, drapeau qui ondule ; trou bonus doré ; manège (trou qui bouge)
  function buildCups() {
    const liner = (x, y) => { const g = new THREE.Group(); g.position.copy(V(x, y)); g.add(new THREE.Mesh(new THREE.CylinderGeometry(CUP, CUP, 22, 32, 1, true), P.mat('#1a221c', { side: THREE.BackSide }))); g.children[0].position.y = -11; const bottom = new THREE.Mesh(new THREE.CircleGeometry(CUP, 32), P.mat('#0b0f0c')); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -18; g.add(bottom); return g; };
    const flag = (col, bonus) => {
      const g = new THREE.Group();
      g.add(P.cyl(0.9, 0.9, 58, '#ffffff', 0, 0, 0, 8), P.ball(1.6, '#ffd23f', 0, 58.5, 0, 10));
      const geo = new THREE.PlaneGeometry(24, 15, 10, 4); geo.translate(12, 0, 0);
      const cloth = new THREE.Mesh(geo, P.mat(col, { side: THREE.DoubleSide, roughness: 0.8 })); cloth.position.y = 49; cloth.castShadow = true; g.add(cloth);
      if (bonus) { const st = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(4.5), { depth: 0.6, bevelEnabled: false }), P.mat('#ffffff')); st.position.set(12, 49, 0.4); st.rotation.z = Math.PI; g.add(st); }
      live.flags.push({ geo, base: geo.attributes.position.array.slice() });
      return P.shadows(g);
    };
    if (!hole.cupMove) { add(liner(...hole.cup)); const f = flag(th.flag); f.position.copy(V(...hole.cup)); add(fadeable(f, [hole.cup], 46)); }
    else {
      const g = new THREE.Group(), tex = P.stripes('#ff3d5a', '#ffd23f', 8, true);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(CUP + 14, CUP + 15, 3, 40), [P.mat('#ffffff', { map: tex }), P.mat('#ffffff', { map: tex }), P.mat('#ffffff')]);
      disc.position.y = 1.5; g.add(disc);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(CUP, 32), P.mat('#0b0f0c')); hl.rotation.x = -Math.PI / 2; hl.position.y = 3.1; g.add(hl);
      const f = flag(th.flag); g.add(f);
      add(P.shadows(g)); live.cup = { g, disc };
    }
    if (hole.bonus) { add(liner(...hole.bonus)); const f = flag('#ffd23f', true); f.position.copy(V(...hole.bonus)); f.scale.setScalar(0.85); add(fadeable(f, [hole.bonus], 40)); }
    // départ : deux bornes
    const [tx, ty] = hole.tee;
    for (const s of [-1, 1]) add(P.shadows(Object.assign(P.ball(3.2, th.flag, ...V(tx, ty + s * 34, 3).toArray(), 14))));
  }
  function buildDeco(rand) {
    for (const d of hole.deco || []) {
      if (d.t === 'tunnel') {
        const [x, y, w, h] = d.r, g = new THREE.Group(), r = h / 2 + 4;
        const vault = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28, 1, true, 0, Math.PI), P.mat('#d98a5a', { side: THREE.DoubleSide }));
        vault.rotation.z = Math.PI / 2; // demi-cylindre couché : axe le long de x, voûte vers le haut
        g.add(vault);
        for (const s of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 1, 3, 8, 28, Math.PI), P.mat('#f2ead8')); ring.rotation.y = Math.PI / 2; ring.position.x = s * w / 2; g.add(ring); }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 5, h * 0.5), P.mat('#e0605e')); roof.position.y = r + 2; g.add(roof);
        g.add(P.tree('flowers', 1.2)); g.children.at(-1).position.set(-w * 0.3, r + 4, 0);
        g.position.copy(V(x + w / 2, y + h / 2, 0));
        add(fadeable(P.shadows(g), [[x, y + h / 2], [x + w / 2, y + h / 2], [x + w, y + h / 2]], h * 0.9));
      }
      if (d.t === 'flowers') for (const [x, y] of d.at) { const f = P.tree('flowers', 1.4); f.position.copy(V(x, y)); add(f); }
      if (d.t === 'shells') for (const [x, y] of d.at) { const s = P.shell(); s.position.copy(V(x, y)); s.rotation.y = rand() * TAU; add(s); }
      if (d.t === 'seaweed') for (const [x, y] of d.at) { const s = P.tree('kelp', 0.9); s.position.copy(V(x, y)); add(s); }
      if (d.t === 'candles') for (const [x, y] of d.at) { const s = P.candle(); s.position.copy(V(x, y)); add(s); live.candles.push(s.userData.flame); }
      if (d.t === 'balloons') for (const [x, y] of d.at) { const s = P.balloons(); s.position.copy(V(x, y)); add(fadeable(s, [[x, y]], 30)); }
    }
  }

  // Ambiance : particules (pétales, neige, braises, bulles, confettis, lucioles, poussière…)
  function ambient(rand) {
    const kind = th.amb, n = kind === 'stars' ? 60 : transparent ? 50 : 130, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = [];
    const palette = { petals: ['#ffffff', '#ffc4d6', '#ffe4ee'], sparkles: ['#ffffff', '#fff6c8'], stars: ['#ffffff', '#c8f6ff'], embers: ['#ffb04a', '#ff6a2a'], snow: ['#ffffff'], fireflies: ['#d8ff8a', '#fff6a0'], confetti: ['#ff3d5a', '#ffd23f', '#3d8bff', '#43c173', '#ff8ae0'], bubbles: ['#e0fbff'], leaves: ['#5ab84e', '#8bd16a'], dust: ['#fff2d8', '#f0d8b0'] }[kind] ?? ['#ffffff'];
    for (let i = 0; i < n; i++) {
      pos.set([(rand() - 0.5) * 1400, rand() * 320 - 40, (rand() - 0.5) * 900], i * 3);
      const c = new THREE.Color(palette[i % palette.length]); col.set([c.r, c.g, c.b], i * 3);
      seed.push({ p: rand() * TAU, s: 0.5 + rand() });
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const [c, x] = mk(32, 32), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    const glowy = kind === 'embers' || kind === 'fireflies' || kind === 'sparkles' || kind === 'stars';
    const m = new THREE.PointsMaterial({ size: { bubbles: 7, snow: 5, petals: 6, confetti: 5, leaves: 6, embers: 4, fireflies: 5, dust: 3, stars: 4, sparkles: 4 }[kind] ?? 4, map: canvasTex(c), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: glowy ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0.9 });
    keep(m); const pts = new THREE.Points(geo, m); root.add(pts); pts.userData.size = m.size;
    return { pts, seed, kind, n };
  }
  function moveAmbient(a, t, dt) {
    const p = a.pts.geometry.attributes.position, arr = p.array;
    for (let i = 0; i < a.n; i++) {
      const s = a.seed[i], k = i * 3;
      let vy = 0, vx = 0, vz = 0;
      switch (a.kind) {
        case 'snow': vy = -18 * s.s; vx = Math.sin(t + s.p) * 8; break;
        case 'petals': case 'leaves': case 'confetti': vy = -12 * s.s; vx = Math.sin(t * 0.8 + s.p) * 14; vz = Math.cos(t * 0.6 + s.p) * 6; break;
        case 'embers': vy = 26 * s.s; vx = Math.sin(t * 2 + s.p) * 8; break;
        case 'bubbles': vy = 22 * s.s; vx = Math.sin(t * 2 + s.p) * 5; break;
        case 'fireflies': vx = Math.sin(t * 0.7 + s.p) * 16; vy = Math.cos(t * 0.9 + s.p) * 8; vz = Math.cos(t * 0.5 + s.p * 2) * 16; break;
        case 'dust': vx = 20 * s.s; vy = Math.sin(t + s.p) * 3; break;
        case 'sparkles': vy = 6 * s.s; break;
      }
      arr[k] += vx * dt; arr[k + 1] += vy * dt; arr[k + 2] += vz * dt;
      if (arr[k + 1] < -60) arr[k + 1] = 280; if (arr[k + 1] > 280) arr[k + 1] = -60;
      if (arr[k] > 700) arr[k] = -700;
    }
    p.needsUpdate = true;
    if (a.kind === 'stars' || a.kind === 'sparkles' || a.kind === 'fireflies') a.pts.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
  }

  /* ----- Caméra isométrique fixe ----- */
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return false;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      gl.setPixelRatio(dpr); gl.setSize(w, h, false);
      fit();
    }
    return true;
  }
  const ELEV = 0.68; // ~39° au-dessus de l'horizon : on voit le dessus et la tranche
  function dirVec() { const yaw = portrait ? 1.38 : 0.5; return new THREE.Vector3(Math.sin(yaw) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(yaw) * Math.cos(ELEV)); }
  // Cadre : tout le plateau (et un peu de sa tranche) tient dans l'image, quelle que soit sa forme
  function fit() {
    if (!cv.width) return;
    portrait = cv.height > cv.width * 1.05;
    camera.position.copy(dirVec().multiplyScalar(1600)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [-W / 2 - M, W / 2 + M]) for (const z of [-H / 2 - M, H / 2 + M]) for (const y of [45, -140]) {
      v.set(x, y, z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const pad = portrait ? 1.04 : 1.13;
    let w = (x1 - x0) * pad, h = (y1 - y0) * pad;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + h * 0.01, aspect = cv.width / cv.height;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    Object.assign(view, { l: cx - w / 2, r: cx + w / 2, t: cy + h / 2, b: cy - h / 2 });
  }
  function focus(cx, cy, zoom) { cam.goal = { cx, cy, zoom: 1 + (zoom - 1) * 0.42 }; }
  function overview() { cam.goal = { cx: W / 2, cy: H / 2, zoom: 1 }; }
  function snap() { Object.assign(cam, cam.goal); }
  function placeCamera(dt) {
    const k = 1 - Math.exp(-dt * 2.6);
    cam.zoom += (cam.goal.zoom - cam.zoom) * k;
    const f = 1 - 1 / cam.zoom, gx = W / 2 + (cam.goal.cx - W / 2) * f, gy = H / 2 + (cam.goal.cy - H / 2) * f;
    cam.cx += (gx - cam.cx) * k; cam.cy += (gy - cam.cy) * k;
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    const sh = cam.shake * 7, target = V(cam.cx + (Math.random() - 0.5) * sh, cam.cy + (Math.random() - 0.5) * sh);
    camera.position.copy(dirVec().multiplyScalar(1600).add(target)); camera.lookAt(target);
    Object.assign(camera, { left: view.l, right: view.r, top: view.t, bottom: view.b, zoom: cam.zoom });
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    ppu = (cv.width / (view.r - view.l)) * cam.zoom;
  }
  const pv = new THREE.Vector3();
  const toScreen = (x, y, z = 0) => { pv.copy(V(x, y, z)).project(camera); return [(pv.x + 1) / 2 * cv.width, (1 - pv.y) / 2 * cv.height]; };
  function toWorld(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(ground, p)) return { x: W / 2, y: H / 2 };
    return { x: p.x + W / 2, y: p.z + H / 2 };
  }

  /* ----- Balles et club en 3D ----- */
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
  function ballObj(name, look) {
    let b = balls.get(name);
    const key = `${look.color}|${look.motif}|${look.finish}`;
    if (!b || b.key !== key) {
      if (b) scene.remove(b.obj);
      const obj = new THREE.Group(), sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), ballMat(look));
      sphere.castShadow = true; obj.add(sphere);
      if (look.motif === 'planete') { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 6, 40), P.mat('#fff0c8')); ring.rotation.x = 1.2; obj.add(ring); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 48), ringMat.clone()); ring.rotation.x = -Math.PI / 2; obj.add(ring);
      scene.add(obj);
      b = { obj, sphere, ring, key, roll: null };
      balls.set(name, b);
    }
    return b;
  }
  let club = null, clubKey = '';
  function clubObj(look) {
    if (club && clubKey === look.club + look.color) return club;
    if (club) scene.remove(club);
    const col = { bois: ['#8b5a2b', '#c08a52'], sucre: ['#ffffff', '#ff3d5a'], neon: ['#4fe3ff', '#c8faff'], or: ['#d4a017', '#ffe27a'], laser: [GolfLooks.hexOf(look.color), '#ffffff'] }[look.club] ?? ['#8a8f98', '#d8dce2'];
    const glowy = look.club === 'neon' || look.club === 'laser';
    club = new THREE.Group();
    const shaftDir = new THREE.Vector3(-0.42, 1, 0).normalize();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 62, 10), look.club === 'sucre' ? P.mat('#ffffff', { map: P.stripes('#ffffff', '#ff3d5a', 10, false) }) : P.mat(col[0], glowy ? { emissive: col[0], emissiveIntensity: 1 } : { metalness: 0.4, roughness: 0.3 }));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shaftDir); shaft.position.copy(shaftDir.clone().multiplyScalar(33)).add(new THREE.Vector3(0, 2, 0));
    const head = new THREE.Mesh(new RoundedBoxGeometry(5, 5, 15, 2, 1.4), P.mat(col[1], { metalness: look.club === 'or' ? 0.7 : 0.3, roughness: 0.3, ...(glowy && { emissive: col[1], emissiveIntensity: 0.6 }) }));
    head.position.y = 3; head.castShadow = true; shaft.castShadow = true;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 10), P.mat('#2b2b33')); grip.quaternion.copy(shaft.quaternion); grip.position.copy(shaftDir.clone().multiplyScalar(60)).add(new THREE.Vector3(0, 2, 0));
    club.add(shaft, head, grip);
    clubKey = look.club + look.color;
    scene.add(club);
    return club;
  }

  /* ----- Particules, textes, traînées (calque 2D, projetés) ----- */
  function burst(x, y, n, colors, { speed = 120, life = 0.8, grav = 0, size = 3, shape = 'sq', drag = 2, z = 3 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random());
      parts.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 30 + Math.random() * speed * 0.7, az: grav < 0 ? -grav : -(220 + grav), life: life * (0.6 + Math.random() * 0.6), age: 0, c: colors[i % colors.length], s: size * (0.6 + Math.random() * 0.8), shape, drag, rot: Math.random() * TAU });
    }
  }
  function sink(x, y, kind, color) {
    const rainbow = ['#ff5a5f', '#ffc93c', '#3d8bff', '#43c173', '#f15bb5', '#fff'];
    if (kind === 'etoiles') burst(x, y, 40, ['#fff6a8', '#ffd23f', '#fff'], { speed: 200, life: 1.4, grav: -40, size: 6, shape: 'star' });
    else if (kind === 'feu') for (let k = 0; k < 4; k++) setTimeout(() => burst(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 60, 40, [rainbow[k], '#fff'], { speed: 160, life: 1.2, grav: -20, size: 3, z: 70 + Math.random() * 50 }), k * 220);
    else if (kind === 'bonbons') burst(x, y, 36, ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e'], { speed: 220, life: 1.6, grav: 120, size: 7, shape: 'candy' });
    else if (kind === 'coeurs') burst(x, y, 30, ['#ff4f7b', '#ff8fb1', color], { speed: 150, life: 1.5, grav: -40, size: 7, shape: 'heart' });
    else burst(x, y, 70, rainbow, { speed: 240, life: 1.5, grav: 60, size: 4, shape: 'conf' });
    burst(x, y, 1, ['rgba(255,255,255,.85)'], { speed: 0, life: 0.6, size: 1, shape: 'ring', z: 0.5 });
  }
  function splash(x, y) {
    const cols = th.lava ? ['#ff5a1f', '#ffd25a', '#333'] : th.blackHole ? ['#a37bff', '#5b2bb5', '#fff'] : [th.water, '#fff', '#bfe9ff'];
    burst(x, y, 34, cols, { speed: 140, life: 0.9, size: 3.5, shape: 'circle', z: WATER_Y + 4 });
    for (let k = 0; k < 3; k++) setTimeout(() => burst(x, y, 1, [th.lava ? 'rgba(255,200,80,.8)' : 'rgba(255,255,255,.8)'], { speed: 0, life: 0.8, size: 1, shape: 'ring', z: WATER_Y + 1 }), k * 160);
  }
  function float(x, y, text, { color = '#fff', size = 20, life = 1.6, screen = false } = {}) { floats.push({ x, y, text, color, size, life, age: 0, screen }); }
  function trail(name, x, y, z, look, moving) {
    let tr = trails.get(name);
    if (!tr) trails.set(name, (tr = { pts: [], look }));
    tr.look = look;
    const h = 7 * BS + z;
    if (moving) {
      tr.pts.push({ x, y, z: h });
      const col = GolfLooks.hexOf(look.color);
      if (look.trail === 'etincelles' && Math.random() < 0.7) burst(x, y, 1, ['#fff6a8', '#ffd23f', col], { speed: 40, life: 0.5, size: 2.5, shape: 'star', z: h });
      if (look.trail === 'bulles' && Math.random() < 0.35) burst(x, y, 1, ['rgba(200,240,255,.9)'], { speed: 15, life: 1.1, size: 4, shape: 'bubble', grav: -30, z: h });
      if (look.trail === 'coeurs' && Math.random() < 0.3) burst(x, y, 1, ['#ff4f7b', '#ff8fb1'], { speed: 20, life: 0.9, size: 5, shape: 'heart', grav: -20, z: h });
      if (look.trail === 'flammes') burst(x, y, 2, ['#ffd23f', '#ff7a1f', '#ff3d1f'], { speed: 30, life: 0.45, size: 4, shape: 'circle', grav: -40, z: h });
    }
    if (tr.pts.length > (moving ? 18 : 0)) tr.pts.shift();
  }
  function groundPath(c, x, y, r, a0 = 0, a1 = TAU, z = 0.5) { c.beginPath(); const n = Math.max(12, Math.round(((a1 - a0) / TAU) * 48)); for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; c.lineTo(...toScreen(x + Math.cos(a) * r, y + Math.sin(a) * r, z)); } }

  /* ----- Une image ----- */
  // v = { t, dt, open, balls: [{ name, x, y, z, look, roll, ring, label, title }], aim, preview, ballsNear, R }
  function frame(v) {
    if (!hole || !resize()) return;
    const t = v.t, dt = v.dt, cup = Golf.cupAt(hole, t), R = (v.R ?? Golf.R) * BS;
    placeCamera(dt);
    // éléments animés
    for (const w of live.water) { w.offset.x = (t * 0.04) % 1; w.offset.y = (t * 0.025) % 1; }
    for (const w of live.falls) w.offset.y = (t * 1.4) % 1;
    for (const b of live.belts) b.tex.offset.x = (-t * b.f / 160) % 1;
    for (const f of live.fans) { const on = Golf.active(f.z, t); f.air.visible = on; f.tex.offset.x = (-t * 2.2) % 1; f.hub.children.slice(2).forEach(p => (p.rotation.y += dt * (on ? 14 : 1.2))); }
    for (const { br, m, posts } of live.bridges) {
      const on = Golf.active(br, t), left = br.period ? br.on - ((((t + (br.phase || 0)) % br.period) + br.period) % br.period) : 9;
      m.material.opacity = on ? (left < 0.8 ? 0.45 + 0.5 * Math.round((Math.sin(t * 30) + 1) / 2) : 1) : 0.16;
      m.position.y = on ? -2.4 : -6; posts.visible = on;
    }
    for (const { wm, blades } of live.blades) blades.forEach((b, k) => (b.rotation.y = -(wm.speed * t + (k * TAU) / wm.blades)));
    const movers = Golf.movers(hole, t, v.open);
    let gi = 0;
    for (const mv of movers) if (mv.kind === 'gate') { const g = live.gates[gi++]; if (g) { g.m.position.copy(V((mv.ax + mv.bx) / 2, (mv.ay + mv.by) / 2, 6.5)); g.m.rotation.y = -Math.atan2(mv.by - mv.ay, mv.bx - mv.ax); } }
    for (const { d, g } of live.doors) { const open = v.open.includes(d.id); g.position.y += ((open ? -22 : 0) - g.position.y) * Math.min(1, dt * 4); }
    for (const { p, m } of live.plates) { const open = v.open.includes(p.door); m.position.y = open ? 0.4 : 1.5; m.material.emissive.set(open ? '#5fff7a' : '#000000'); m.material.emissiveIntensity = open ? 0.6 + Math.sin(t * 4) * 0.3 : 0; }
    for (const { cr, o } of live.critters) { const q = Golf.critterAt(cr, t); o.position.copy(V(q.x, q.y)); o.rotation.y = -Math.atan2(q.vy, q.vx); o.children[0].position.y = cr.kind === 'ghost' ? Math.sin(t * 4) * 2 + 2 : cr.kind === 'fish' ? Math.sin(t * 3) * 1.5 : Math.abs(Math.sin(t * 8)) * 1.5; }
    for (const s of live.spins) s.obj.rotation[s.axis] += dt * s.speed;
    for (const m of live.magnets) m.arms.forEach((a, k) => (a.rotation.z = -0.5 + Math.sin(t * 2 + k) * 0.25));
    for (const f of live.candles) f.scale.set(1 + Math.sin(t * 13 + f.id) * 0.15, 1.6 + Math.sin(t * 17) * 0.2, 1);
    for (const fl of live.flags) { const p = fl.geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = fl.base[i * 3]; p.setZ(i, Math.sin(t * 5 - x * 0.35) * x * 0.12); } p.needsUpdate = true; }
    if (live.cup) { live.cup.g.position.copy(V(cup[0], cup[1])); live.cup.disc.rotation.y = t * 1.2; }
    const env = live.env;
    for (const s of env.spin) s.obj.rotation[s.axis] += dt * s.speed;
    for (const s of env.smoke) s.puffs.forEach((p, k) => { const u = (t * 0.25 + k / s.puffs.length) % 1; p.position.y = s.h + 4 + u * 40; p.position.x = u * 14; p.scale.setScalar(0.6 + u * 1.4); p.material.opacity = 0.85 * (1 - u); });
    for (const o of env.bob) { if (o.userData.drift) { o.position.x += dt * o.userData.drift; if (o.position.x > 900) o.position.x = -900; } else o.position.y += Math.sin(t * 2) * 0.03; }
    moveAmbient(live.ambient, t, dt);
    live.ambient.pts.material.size = live.ambient.pts.userData.size * clamp(ppu / dpr, 0.45, 1.1); // plus petites sur un petit écran
    // ce qui s'efface au-dessus des balles
    for (const f of live.fades) {
      const near = v.balls.some(b => f.pts.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < f.r)) || (v.aim && f.pts.some(([px, py]) => Math.hypot(v.aim.x - px, v.aim.y - py) < f.r));
      f.k += ((near ? 0.28 : 1) - f.k) * Math.min(1, dt * 6);
      for (const m of f.ms) { m.opacity = f.k; m.depthWrite = f.k > 0.9; }
    }
    // balles
    const seen = new Set();
    for (const b of v.balls) {
      const o = ballObj(b.name, b.look); seen.add(b.name);
      o.obj.visible = true;
      o.obj.position.copy(V(b.x, b.y, R + (b.z || 0)));
      o.sphere.scale.setScalar(R); o.obj.children[1] !== o.ring && o.obj.children[1].scale.setScalar(R);
      const roll = b.roll ?? [0, 0];
      if (o.roll) { const dx = roll[0] - o.roll[0], dz = roll[1] - o.roll[1], d = Math.hypot(dx, dz); if (d > 0.01 && d < 60) o.sphere.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz / d, 0, -dx / d), d / R)); }
      o.roll = [roll[0], roll[1]];
      o.ring.visible = !!b.ring;
      if (b.ring) { const p = (Math.sin(t * 5) + 1) / 2; o.ring.scale.setScalar(R + 6 + p * 3); o.ring.position.y = -R + 0.6 - (b.z || 0); o.ring.material.color.set(GolfLooks.hexOf(b.look.color)); o.ring.material.opacity = 0.45 + p * 0.45; }
    }
    for (const [n, o] of balls) if (!seen.has(n)) o.obj.visible = false;
    // club
    if (v.aim) {
      const c = clubObj(v.aim.look), back = 9 + R + v.aim.pull * 0.14;
      c.visible = true; c.position.copy(V(v.aim.x - Math.cos(v.aim.angle) * back, v.aim.y - Math.sin(v.aim.angle) * back, 0)); c.rotation.y = -v.aim.angle;
    } else if (club) club.visible = false;
    gl.render(scene, camera);
    overlay(v, t, dt, R);
  }
  function overlay(v, t, dt, R) {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.lineCap = c.lineJoin = 'round';
    // traînées
    for (const tr of trails.values()) {
      if (tr.look.trail === 'aucune' || tr.pts.length < 2) continue;
      const col = GolfLooks.hexOf(tr.look.color);
      for (let i = 1; i < tr.pts.length; i++) {
        const p0 = tr.pts[i - 1], p1 = tr.pts[i];
        if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 60) continue;
        const f = i / tr.pts.length;
        c.globalAlpha = f * (tr.look.trail === 'classique' ? 0.45 : 0.7);
        c.strokeStyle = tr.look.trail === 'arcenciel' ? `hsl(${(t * 300 + i * 25) % 360},90%,60%)` : tr.look.trail === 'flammes' ? '#ff9a1f' : col;
        c.lineWidth = 2 * R * f * ppu * 0.8;
        c.beginPath(); c.moveTo(...toScreen(p0.x, p0.y, p0.z)); c.lineTo(...toScreen(p1.x, p1.y, p1.z)); c.stroke();
      }
    }
    c.globalAlpha = 1;
    // aide à la visée
    if (v.preview?.length > 1) {
      c.save(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(2, 2.4 * ppu); c.setLineDash([1, 9 * ppu]); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 4;
      c.beginPath(); for (const p of v.preview) c.lineTo(...toScreen(p[0], p[1], (p[2] || 0) + 2)); c.stroke(); c.restore();
      const e = v.preview.at(-1); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2 * ppu; groundPath(c, e[0], e[1], 7); c.stroke();
    }
    // visée : flèche et jauge de puissance au sol
    if (v.aim) {
      const { x, y, angle, power } = v.aim, len = 30 + power * 150, col = power < 0.5 ? '#43c173' : power < 0.8 ? '#ffc93c' : '#ff5a5f';
      const ca = Math.cos(angle), sa = Math.sin(angle);
      c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 6;
      c.strokeStyle = col; c.lineWidth = 5 * ppu; c.setLineDash([3 * ppu, 9 * ppu]);
      c.beginPath(); c.moveTo(...toScreen(x + ca * (R + 6), y + sa * (R + 6), 1)); c.lineTo(...toScreen(x + ca * len, y + sa * len, 1)); c.stroke(); c.setLineDash([]);
      const hx = x + ca * len, hy = y + sa * len, px = -sa, py = ca;
      c.fillStyle = col; c.beginPath(); c.moveTo(...toScreen(hx + ca * 16, hy + sa * 16, 1)); c.lineTo(...toScreen(hx + px * 10, hy + py * 10, 1)); c.lineTo(...toScreen(hx - px * 10, hy - py * 10, 1)); c.fill();
      c.lineWidth = 5 * ppu; c.strokeStyle = 'rgba(0,0,0,.25)'; groundPath(c, x, y, R + 13); c.stroke();
      c.strokeStyle = col; c.lineWidth = 4 * ppu; groundPath(c, x, y, R + 13, -Math.PI / 2, -Math.PI / 2 + power * TAU); c.stroke();
      c.restore();
    }
    // particules
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.vx *= 1 - dt * p.drag; p.vy *= 1 - dt * p.drag; p.vz += p.az * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0.5, p.z + p.vz * dt); p.rot += dt * 5;
      const f = 1 - p.age / p.life, [sx, sy] = toScreen(p.x, p.y, p.z), s = p.s * ppu * 1.4;
      c.globalAlpha = Math.min(1, f * 1.5); c.fillStyle = p.c; c.strokeStyle = p.c;
      if (p.shape === 'ring') { c.lineWidth = 3 * f * ppu; groundPath(c, p.x, p.y, 8 + (1 - f) * 40, 0, TAU, p.z); c.stroke(); }
      else if (p.shape === 'star') star2d(c, sx, sy, s);
      else if (p.shape === 'heart') { c.beginPath(); c.moveTo(sx, sy + s * 0.35); c.bezierCurveTo(sx - s, sy - s * 0.4, sx - s * 0.4, sy - s, sx, sy - s * 0.35); c.bezierCurveTo(sx + s * 0.4, sy - s, sx + s, sy - s * 0.4, sx, sy + s * 0.35); c.fill(); }
      else if (p.shape === 'circle') { c.beginPath(); c.arc(sx, sy, s, 0, TAU); c.fill(); }
      else if (p.shape === 'bubble') { c.lineWidth = 1.2 * dpr; c.beginPath(); c.arc(sx, sy, s, 0, TAU); c.stroke(); }
      else if (p.shape === 'candy') { c.save(); c.translate(sx, sy); c.rotate(p.rot); c.beginPath(); c.roundRect(-s, -s * 0.45, s * 2, s * 0.9, s * 0.45); c.fill(); c.restore(); }
      else if (p.shape === 'conf') { c.save(); c.translate(sx, sy); c.rotate(p.rot); c.fillRect(-s, -s * 0.4, s * 2, s * 0.8); c.restore(); }
      else c.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    c.globalAlpha = 1;
    // noms, titres, textes : toujours droits
    const fs = Math.max(11, 12 * dpr);
    c.textAlign = 'center';
    for (const b of v.balls) {
      if (!b.label) continue;
      const [sx, sy] = toScreen(b.x, b.y, (b.z || 0) + R * 2 + 6);
      c.font = `800 ${fs}px Nunito, sans-serif`; c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(30,40,60,.55)';
      c.strokeText(b.label, sx, sy); c.fillStyle = '#fff'; c.fillText(b.label, sx, sy);
      if (b.title) { c.font = `700 ${fs * 0.75}px Nunito, sans-serif`; c.lineWidth = 3 * dpr; c.strokeText(b.title, sx, sy - fs); c.fillStyle = '#ffe27a'; c.fillText(b.title, sx, sy - fs); }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.age += dt;
      if (f.age > f.life) { floats.splice(i, 1); continue; }
      const k = f.age / f.life, [sx, sy] = f.screen ? [f.x * cv.width, f.y * cv.height] : toScreen(f.x, f.y, 24), size = f.size * dpr * (0.6 + 0.4 * Math.min(1, f.age * 8));
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `900 ${size}px "Baloo 2", Nunito, sans-serif`;
      c.lineWidth = 5 * dpr; c.strokeStyle = 'rgba(40,30,70,.45)';
      c.strokeText(f.text, sx, sy - k * 40 * dpr); c.fillStyle = f.color; c.fillText(f.text, sx, sy - k * 40 * dpr);
    }
    c.globalAlpha = 1;
  }

  return {
    setHole, frame, focus, overview, snap, toWorld, burst, sink, splash, float, trail,
    shake: a => (cam.shake = Math.max(cam.shake, a)),
    get theme() { return th; },
    get portrait() { return portrait; },
    clearTrail: name => trails.delete(name),
  };
}
