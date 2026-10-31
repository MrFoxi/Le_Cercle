// Mini-golf : dessin du parcours en 2D vu du dessus. Décor autour du plateau, plateau en relief, murs en volume,
// eau / lave / trous noirs animés, animaux, balles à motifs qui roulent, clubs, traînées, particules, météo,
// caméra qui suit la balle, et parcours tourné d'un quart de tour sur un téléphone tenu à la verticale.
/* global Golf, GolfLooks */
const { W, H, CUP, WALL } = Golf;
const TAU = Math.PI * 2, M = 60; // M : marge de décor autour du plateau
const VW = W + 2 * M, VH = H + 2 * M;
const rngOf = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hashStr = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const THEMES = {
  classic: { scene: '#3f9446', scene2: '#367f3c', ground: '#5ec462', stripe: 'rgba(255,255,255,.07)', rim: '#9a6431', rimHi: '#c98b4f', wall: '#c07a40', top: '#e7b276', side: '#6e4220', water: '#3aa6e6', deep: '#1c69b0', sand: '#f0dca2', bridge: '#b98149', flag: '#ff4d5a', amb: 'butterflies' },
  tropical: { scene: '#16b3c9', scene2: '#0e93b4', ground: '#6ad46b', stripe: 'rgba(255,255,255,.07)', rim: '#f2dca0', rimHi: '#fff1c8', wall: '#c9a15c', top: '#f0d596', side: '#7a5a2a', water: '#2fd3df', deep: '#0b86ab', sand: '#f6e2a8', bridge: '#c8935a', flag: '#ff7a3d', amb: 'butterflies' },
  space: { scene: '#0a0820', scene2: '#160f3a', ground: '#2b2558', stripe: 'rgba(120,140,255,.05)', rim: '#59647c', rimHi: '#a8b4c8', wall: '#4fe3ff', top: '#d6fbff', side: '#1b4f7a', water: '#000', deep: '#000', sand: '#6c6890', bridge: '#6b6f8a', flag: '#ff4fd8', neon: true, amb: 'twinkle' },
  volcano: { scene: '#1b0f0b', scene2: '#2a1510', ground: '#5c4840', stripe: 'rgba(0,0,0,.06)', rim: '#2a1d19', rimHi: '#5a3f35', wall: '#3f302a', top: '#86655a', side: '#1a120f', water: '#ff5a1f', deep: '#b42400', sand: '#3a2f2a', bridge: '#6e5a50', flag: '#ffd23f', lava: true, amb: 'embers' },
  candy: { scene: '#ffc3de', scene2: '#c8e9ff', ground: '#ffdcee', stripe: 'rgba(255,255,255,.25)', rim: '#ff8fc0', rimHi: '#ffd0e6', wall: '#ffffff', top: '#ffffff', side: '#d04a74', stripes: '#ff4f7b', water: '#7bd3ff', deep: '#3fa4e0', sand: '#8a5434', slope: '#eab05c', bridge: '#ffffff', flag: '#7b3fe4', amb: 'sparkles' },
  haunted: { scene: '#1a1430', scene2: '#251b44', ground: '#3d4b3b', stripe: 'rgba(0,0,0,.08)', rim: '#2b2236', rimHi: '#4d4161', wall: '#6d6a80', top: '#aeabc3', side: '#33303f', water: '#3a2f5c', deep: '#140f24', sand: '#5a4f3c', bridge: '#5b4a3a', flag: '#9cff6b', amb: 'fireflies', dark: true },
  ice: { scene: '#e9f4fb', scene2: '#d5e9f6', ground: '#eef8ff', stripe: 'rgba(160,200,230,.12)', rim: '#9fc6e0', rimHi: '#d8ecf8', wall: '#bfe3f7', top: '#ffffff', side: '#7fb2d1', water: '#2b6fa8', deep: '#0f3b69', sand: '#ffffff', bridge: '#c8d8e4', flag: '#ff3d5a', amb: 'snow' },
  fair: { scene: '#2b1f4a', scene2: '#3d2a66', ground: '#7fd36e', stripe: 'rgba(255,255,255,.08)', rim: '#e23b3b', rimHi: '#ffffff', wall: '#ffcf3f', top: '#fff1a8', side: '#c48a00', water: '#3fa4e0', deep: '#1d5f9c', sand: '#f0d9a0', bridge: '#ffcf3f', flag: '#ff3d8b', amb: 'confetti', lights: true },
  sea: { scene: '#073a63', scene2: '#0a5285', ground: '#e8d6a0', stripe: 'rgba(255,255,255,.08)', rim: '#ff8a7a', rimHi: '#ffc2b8', wall: '#5f7c8a', top: '#a8c0cc', side: '#2f4651', water: '#06223d', deep: '#01070f', sand: '#d8c084', bridge: '#8a6a4a', flag: '#ffd23f', amb: 'bubbles', abyss: true },
  jungle: { scene: '#1d5a2a', scene2: '#164a22', ground: '#58b35a', stripe: 'rgba(255,255,255,.06)', rim: '#6b4a2a', rimHi: '#9a6d40', wall: '#8b5a2b', top: '#c58e55', side: '#4e3017', water: '#3fb0a6', deep: '#16706a', sand: '#7b5a35', bridge: '#9a6d40', flag: '#ff9a1f', amb: 'leaves' },
};

/* ---------- Balles ---------- */
function star(c, x, y, r, n = 5) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function heart(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35); c.fill();
}
// roll : distance parcourue (x, y) pour faire défiler le motif comme si la balle roulait
export function drawBall(c, x, y, r, look, t = 0, roll = [0, 0], z = 0) {
  const hex = GolfLooks.hexOf(look.color), gold = look.finish === 'or', base = gold ? '#f0c419' : hex;
  const lift = z * 0.55, rr = r * (1 + z / 140), yy = y - lift;
  c.save();
  c.globalAlpha = 0.32 * (1 - Math.min(0.6, z / 120)); c.fillStyle = '#000';
  c.beginPath(); c.ellipse(x + 2.5 + z * 0.15, y + 3.5 + z * 0.2, r * 0.95, r * 0.75, 0, 0, TAU); c.fill();
  c.restore();
  c.save();
  if (look.finish === 'fluo') { c.shadowColor = base; c.shadowBlur = 12 + Math.sin(t * 6) * 6; }
  c.beginPath(); c.arc(x, yy, rr, 0, TAU); c.fillStyle = base; c.fill();
  c.shadowBlur = 0;
  c.clip();
  const T = rr * 2, ox = ((roll[0] % T) + T) % T, oy = ((roll[1] % T) + T) % T, dir = Math.atan2(roll[1], roll[0]);
  const tiles = fn => { for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) fn(x + i * T + ox, yy + j * T + oy); };
  switch (look.motif) {
    case 'rayures': c.fillStyle = 'rgba(255,255,255,.85)'; tiles((px, py) => c.fillRect(px - T, py - rr * 0.28, T * 2, rr * 0.56)); break;
    case 'etoiles': c.fillStyle = '#fff'; tiles((px, py) => { star(c, px, py, rr * 0.38); star(c, px + rr, py + rr, rr * 0.28); }); break;
    case 'damier': c.fillStyle = 'rgba(255,255,255,.9)'; tiles((px, py) => { c.fillRect(px, py, rr, rr); c.fillRect(px + rr, py + rr, rr, rr); }); break;
    case 'pasteque':
      c.fillStyle = '#2f8f3a'; c.fillRect(x - rr, yy - rr, T, T);
      c.fillStyle = '#ff5a6a'; c.beginPath(); c.arc(x + (ox - rr) * 0.15, yy + (oy - rr) * 0.15, rr * 0.75, 0, TAU); c.fill();
      c.fillStyle = '#222'; for (let k = 0; k < 5; k++) { const a = k * 1.3 + dir; c.beginPath(); c.ellipse(x + Math.cos(a) * rr * 0.4, yy + Math.sin(a) * rr * 0.4, rr * 0.08, rr * 0.14, a, 0, TAU); c.fill(); }
      break;
    case 'huit':
      c.fillStyle = '#16161c'; c.fillRect(x - rr, yy - rr, T, T);
      tiles((px, py) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, rr * 0.45, 0, TAU); c.fill(); c.fillStyle = '#111'; c.font = `900 ${rr * 0.7}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('8', px, py + rr * 0.04); });
      break;
    case 'smiley':
      c.fillStyle = '#2a1a00'; c.save(); c.translate(x, yy); c.rotate(dir + Math.PI / 2);
      c.beginPath(); c.arc(-rr * 0.32, -rr * 0.22, rr * 0.12, 0, TAU); c.arc(rr * 0.32, -rr * 0.22, rr * 0.12, 0, TAU); c.fill();
      c.lineWidth = rr * 0.14; c.strokeStyle = '#2a1a00'; c.beginPath(); c.arc(0, rr * 0.02, rr * 0.5, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); c.restore();
      break;
    case 'planete': c.fillStyle = 'rgba(0,0,0,.18)'; tiles((px, py) => { c.fillRect(px - T, py - rr * 0.5, T * 2, rr * 0.22); c.fillRect(px - T, py + rr * 0.25, T * 2, rr * 0.3); }); break;
    case 'arcenciel': ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'].forEach((col, k) => { c.fillStyle = col; tiles((px, py) => c.fillRect(px - T, py - rr + (k * T) / 6, T * 2, T / 6 + 0.5)); }); break;
  }
  // Volume : reflet en haut à gauche, ombre propre en bas à droite
  const g = c.createRadialGradient(x - rr * 0.35, yy - rr * 0.4, rr * 0.1, x, yy, rr * 1.05);
  g.addColorStop(0, `rgba(255,255,255,${gold ? 0.75 : 0.5})`); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
  c.fillStyle = g; c.fillRect(x - rr, yy - rr, T, T);
  c.restore();
  if (look.motif === 'planete') { c.strokeStyle = 'rgba(255,240,200,.85)'; c.lineWidth = rr * 0.22; c.beginPath(); c.ellipse(x, yy, rr * 1.6, rr * 0.45, -0.4, 0.15 * Math.PI, 0.85 * Math.PI, true); c.stroke(); }
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.8; c.beginPath(); c.arc(x, yy, rr, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(x - rr * 0.38, yy - rr * 0.42, rr * 0.22, rr * 0.14, -0.6, 0, TAU); c.fill();
  if (look.finish === 'brillant' || gold) {
    const tw = (Math.sin(t * 4 + x) + 1) / 2;
    c.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`; star(c, x + rr * 0.45, yy - rr * 0.5, rr * (0.25 + tw * 0.25), 4);
  }
}
// Club pendant la visée : la tête derrière la balle, le manche vers le doigt / la souris
export function drawClub(c, bx, by, angle, pull, look, t) {
  const back = angle + Math.PI, d = 9 + pull * 0.25, hx = bx + Math.cos(back) * d, hy = by + Math.sin(back) * d;
  const L = 70, sx = hx + Math.cos(back + 0.25) * L, sy = hy + Math.sin(back + 0.25) * L;
  const col = { bois: ['#8b5a2b', '#c08a52'], sucre: ['#fff', '#ff3d5a'], neon: ['#4fe3ff', '#c8faff'], or: ['#d4a017', '#ffe27a'], laser: [GolfLooks.hexOf(look.color), '#fff'] }[look.club] ?? ['#888', '#ccc'];
  c.save();
  c.lineCap = 'round';
  if (look.club === 'neon' || look.club === 'laser') { c.shadowColor = col[0]; c.shadowBlur = 14; }
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 4; c.beginPath(); c.moveTo(hx + 3, hy + 4); c.lineTo(sx + 3, sy + 4); c.stroke();
  c.strokeStyle = col[0]; c.lineWidth = look.club === 'laser' ? 5 : 3.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(sx, sy); c.stroke();
  if (look.club === 'sucre') { c.strokeStyle = col[1]; c.setLineDash([5, 5]); c.lineDashOffset = -t * 20; c.beginPath(); c.moveTo(hx, hy); c.lineTo(sx, sy); c.stroke(); c.setLineDash([]); }
  if (look.club === 'laser') { c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx, hy); c.lineTo(sx, sy); c.stroke(); }
  // tête du club, perpendiculaire au tir
  const px = Math.cos(angle + Math.PI / 2), py = Math.sin(angle + Math.PI / 2);
  c.strokeStyle = col[1]; c.lineWidth = 6;
  c.beginPath(); c.moveTo(hx - px * 8, hy - py * 8); c.lineTo(hx + px * 8, hy + py * 8); c.stroke();
  c.restore();
}

/* ---------- Le renderer ---------- */
export function createRenderer(cv) {
  const ctx = cv.getContext('2d');
  let hole = null, th = THEMES.classic, cache = null, cacheKey = '', portrait = false, base = 1, dpr = 1;
  const cam = { cx: W / 2, cy: H / 2, zoom: 1, goal: { cx: W / 2, cy: H / 2, zoom: 1 }, shake: 0 };
  let m = [1, 0, 0, 1, 0, 0];
  const parts = [], floats = [], trails = new Map(), ambient = [];

  function setHole(h) {
    hole = h;
    th = THEMES[h.theme] ?? THEMES.classic;
    cacheKey = '';
    trails.clear();
    parts.length = floats.length = ambient.length = 0;
    const rand = rngOf(hashStr(h.id));
    for (let i = 0; i < 46; i++) ambient.push({ x: rand() * VW - M, y: rand() * VH - M, s: 0.5 + rand(), p: rand() * TAU });
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (w && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    portrait = cv.height > cv.width * 1.05;
    base = portrait ? Math.min(cv.width / VH, cv.height / VW) : Math.min(cv.width / VW, cv.height / VH);
  }
  // Matrice monde -> pixels du canvas (avec la caméra et, à la verticale, un quart de tour)
  function matrix() {
    const s = base * cam.zoom, sh = cam.shake * base * 6, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    m = portrait
      ? [0, s, -s, 0, cv.width / 2 + s * cam.cy + jx, cv.height / 2 - s * cam.cx + jy]
      : [s, 0, 0, s, cv.width / 2 - s * cam.cx + jx, cv.height / 2 - s * cam.cy + jy];
    return m;
  }
  const toScreen = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function toWorld(clientX, clientY) {
    const r = cv.getBoundingClientRect(), px = (clientX - r.left) * (cv.width / r.width), py = (clientY - r.top) * (cv.height / r.height);
    const det = m[0] * m[3] - m[1] * m[2], dx = px - m[4], dy = py - m[5];
    return { x: (m[3] * dx - m[2] * dy) / det, y: (-m[1] * dx + m[0] * dy) / det };
  }
  // Caméra : vue d'ensemble, ou zoom sur un point (gardé dans le décor)
  function focus(cx, cy, zoom) { cam.goal = { cx, cy, zoom }; }
  function overview() { cam.goal = { cx: W / 2, cy: H / 2, zoom: 1 }; }
  function snap() { Object.assign(cam, cam.goal); }
  function moveCamera(dt) {
    const k = 1 - Math.exp(-dt * 3.2);
    cam.zoom += (cam.goal.zoom - cam.zoom) * k;
    const hw = VW / 2 / cam.zoom, hh = VH / 2 / cam.zoom;
    const gx = clamp(cam.goal.cx, -M + hw, W + M - hw), gy = clamp(cam.goal.cy, -M + hh, H + M - hh);
    cam.cx += (gx - cam.cx) * k; cam.cy += (gy - cam.cy) * k;
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
  }

  /* ---------- Décor fixe (dessiné une fois par trou) ---------- */
  function buildCache() {
    const k = Math.min(2.8, base * 1.4); // un peu plus fin que l'écran, pour rester net quand la caméra zoome
    cache = Object.assign(document.createElement('canvas'), { width: Math.round(VW * k), height: Math.round(VH * k) });
    const c = cache.getContext('2d');
    c.setTransform(k, 0, 0, k, M * k, M * k);
    const rand = rngOf(hashStr(hole.id));
    scenery(c, rand);
    board(c, rand);
  }

  function scenery(c, rand) {
    const g = c.createLinearGradient(0, -M, 0, H + M);
    g.addColorStop(0, th.scene); g.addColorStop(1, th.scene2);
    c.fillStyle = g; c.fillRect(-M, -M, VW, VH);
    const around = (n, fn) => { for (let i = 0; i < n; i++) { let x, y; do { x = rand() * VW - M; y = rand() * VH - M; } while (x > -8 && x < W + 8 && y > -8 && y < H + 8); fn(x, y, rand()); } };
    switch (hole.theme) {
      case 'classic': case 'jungle':
        around(hole.theme === 'jungle' ? 70 : 34, (x, y, r) => tree(c, x, y, 14 + r * 16, hole.theme === 'jungle'));
        break;
      case 'tropical':
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
        for (let i = 0; i < 40; i++) { const x = rand() * VW - M, y = rand() * VH - M; c.beginPath(); c.arc(x, y, 10, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        break;
      case 'space': case 'haunted':
        for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.7})`; c.beginPath(); c.arc(rand() * VW - M, rand() * VH - M, rand() * 1.4 + 0.3, 0, TAU); c.fill(); }
        if (hole.theme === 'space') for (const [col, x, y] of [['rgba(160,80,255,.25)', 80, 40], ['rgba(40,180,255,.2)', 900, 560]]) { const n = c.createRadialGradient(x, y, 0, x, y, 300); n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = n; c.fillRect(-M, -M, VW, VH); }
        else { const n = c.createRadialGradient(W - 40, -20, 0, W - 40, -20, 260); n.addColorStop(0, 'rgba(255,250,210,.5)'); n.addColorStop(0.15, 'rgba(255,250,210,.25)'); n.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = n; c.fillRect(-M, -M, VW, VH); around(26, (x, y, r) => tomb(c, x, y, 10 + r * 6)); }
        break;
      case 'volcano':
        c.strokeStyle = 'rgba(255,90,20,.55)'; c.lineWidth = 6; c.shadowColor = '#ff5a1f'; c.shadowBlur = 14;
        for (let i = 0; i < 9; i++) { let x = rand() * VW - M, y = rand() < 0.5 ? -M + rand() * 50 : H + 10 + rand() * 40; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += 20 + rand() * 30; y += (rand() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); }
        c.shadowBlur = 0;
        break;
      case 'candy':
        around(30, (x, y, r) => { const col = ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e', '#c49bff'][Math.floor(r * 5)]; c.fillStyle = '#fff'; c.fillRect(x - 1.5, y, 3, 22); c.fillStyle = col; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 7, 0, 4.5); c.stroke(); });
        break;
      case 'ice':
        around(40, (x, y, r) => { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(x, y, 20 + r * 20, 10 + r * 8, 0, 0, TAU); c.fill(); });
        around(20, (x, y, r) => pine(c, x, y, 12 + r * 10));
        break;
      case 'fair':
        for (let x = -M; x < W + M; x += 40) { c.fillStyle = (x / 40) % 2 ? '#e23b3b' : '#fff'; c.fillRect(x, -M, 40, 26); c.fillRect(x, H + M - 26, 40, 26); }
        break;
      case 'sea':
        for (let i = 0; i < 6; i++) { const x = rand() * VW; const g2 = c.createLinearGradient(x, -M, x + 120, H + M); g2.addColorStop(0, 'rgba(255,255,255,.12)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.beginPath(); c.moveTo(x - 30, -M); c.lineTo(x + 40, -M); c.lineTo(x + 200, H + M); c.lineTo(x + 90, H + M); c.fill(); }
        around(30, (x, y, r) => seaweed(c, x, y, 18 + r * 20, r));
        break;
    }
  }
  function tree(c, x, y, r, dense) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x + r * 0.3, y + r * 0.4, r, 0, TAU); c.fill();
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, dense ? '#5fbf4a' : '#79d266'); g.addColorStop(1, dense ? '#1f6a24' : '#2f8a35');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function pine(c, x, y, r) {
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(x + 4, y + 5, r, 0, TAU); c.fill();
    c.fillStyle = '#2f6b4f'; star(c, x, y, r, 7); c.fillStyle = '#fff'; star(c, x, y, r * 0.5, 7);
  }
  function tomb(c, x, y, r) {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - r * 0.5 + 3, y - r * 0.6 + 4, r, r * 1.3);
    c.fillStyle = '#7d7a90'; c.beginPath(); c.roundRect(x - r * 0.5, y - r * 0.6, r, r * 1.3, [r * 0.5, r * 0.5, 2, 2]); c.fill();
    c.fillStyle = '#5a5770'; c.fillRect(x - 1, y - r * 0.3, 2, r * 0.6); c.fillRect(x - r * 0.25, y - r * 0.15, r * 0.5, 2);
  }
  function seaweed(c, x, y, h, r) {
    c.strokeStyle = r < 0.5 ? '#2f9e6a' : '#5cc97a'; c.lineWidth = 4; c.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * 5, y); c.quadraticCurveTo(x + k * 5 + 10, y - h / 2, x + k * 5 - 4, y - h); c.stroke(); }
  }

  const shapePath = (c, z) => { c.beginPath(); if (z.r) c.rect(...z.r); else c.arc(z.c[0], z.c[1], z.c[2], 0, TAU); };
  function grain(c, x0, y0, w, h, col, n, rand, size = 2) { c.fillStyle = col; for (let i = 0; i < n; i++) c.fillRect(x0 + rand() * w, y0 + rand() * h, size, size); }
  const zoneBox = z => z.r ?? [z.c[0] - z.c[2], z.c[1] - z.c[2], z.c[2] * 2, z.c[2] * 2];

  function board(c, rand) {
    // Ombre portée et bord du plateau
    c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
    c.fillStyle = th.rim; c.beginPath(); c.roundRect(-16, -16, W + 32, H + 32, 22); c.fill(); c.restore();
    const rg = c.createLinearGradient(0, -16, 0, H + 16); rg.addColorStop(0, th.rimHi); rg.addColorStop(0.08, th.rim); rg.addColorStop(1, th.rim);
    c.fillStyle = rg; c.beginPath(); c.roundRect(-16, -16, W + 32, H + 32, 22); c.fill();
    if (hole.theme === 'fair') { for (let i = 0; i < 60; i++) { const a = (i / 60) * (2 * (W + H)); const [x, y] = a < W ? [a, -9] : a < W + H ? [W + 9, a - W] : a < 2 * W + H ? [2 * W + H - a, H + 9] : [-9, 2 * (W + H) - a]; c.fillStyle = i % 2 ? '#fff' : '#ffd23f'; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill(); } }
    if (hole.theme === 'space') { c.fillStyle = '#c8d2e4'; for (let x = 10; x < W; x += 60) for (const y of [-9, H + 9]) { c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill(); } }
    // Sol
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    c.fillStyle = th.ground; c.fillRect(0, 0, W, H);
    if (['classic', 'tropical', 'jungle', 'fair'].includes(hole.theme)) { c.fillStyle = th.stripe; for (let x = 0; x < W; x += 100) c.fillRect(x, 0, 50, H); }
    if (hole.theme === 'candy') { c.fillStyle = th.stripe; for (let x = -H; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, 0); c.lineTo(x + 30 + H, H); c.lineTo(x + H, H); c.fill(); } }
    if (hole.theme === 'sea') { c.strokeStyle = 'rgba(160,130,70,.25)'; c.lineWidth = 2; for (let y = 10; y < H; y += 22) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x / 40 + y) * 4); c.stroke(); } }
    grain(c, 0, 0, W, H, th.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)', 2600, rand, 2);
    grain(c, 0, 0, W, H, 'rgba(255,255,255,.06)', 1200, rand, 1.5);
    for (const d of hole.deco || []) decoBelow(c, d, rand);
    for (const z of hole.zones || []) zone(c, z, rand);
    // Lumière douce venue du haut à gauche
    const lg = c.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,255,255,.10)'); lg.addColorStop(1, 'rgba(0,0,0,.10)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    // Ombre des murs sur le sol
    c.save(); c.filter = 'blur(6px)'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = WALL * 2 + 6; c.lineJoin = c.lineCap = 'round';
    for (const w of hole.walls) { const p = Golf.wallPts(w); c.beginPath(); c.moveTo(p[0] + 4, p[1] + 6); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k] + 4, p[k + 1] + 6); c.stroke(); }
    c.restore();
    c.restore();
    // Départ, sorties de téléporteur, tuyaux, ressorts, plaques, trous fixes
    c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.roundRect(hole.tee[0] - 26, hole.tee[1] - 26, 52, 52, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
    for (const t of hole.teleports || []) { c.strokeStyle = 'rgba(190,140,255,.7)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(t.to[0], t.to[1], t.r, 0, TAU); c.stroke(); c.setLineDash([]); }
    for (const p of hole.pipes || []) {
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 14; c.setLineDash([2, 18]); c.lineCap = 'round'; c.beginPath(); c.moveTo(...p.from); c.lineTo(...p.to); c.stroke(); c.setLineDash([]);
      for (const [x, y] of [p.from, p.to]) { c.fillStyle = '#1f8a3a'; c.beginPath(); c.arc(x, y, p.r + 5, 0, TAU); c.fill(); c.fillStyle = '#3fc25e'; c.beginPath(); c.arc(x, y, p.r + 2, 0, TAU); c.fill(); c.fillStyle = '#0b2412'; c.beginPath(); c.arc(x, y, p.r - 2, 0, TAU); c.fill(); }
    }
    for (const s of hole.springs || []) {
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(s.x + 2, s.y + 3, s.r, 0, TAU); c.fill();
      c.fillStyle = '#ff4f9a'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; chevron(c, s.x - 4, s.y, s.dir, 7); chevron(c, s.x + 5, s.y, s.dir, 7);
    }
    for (const p of hole.plates || []) { c.fillStyle = '#8a8698'; c.beginPath(); c.roundRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, 4); c.fill(); c.strokeStyle = '#5a5668'; c.lineWidth = 2; c.stroke(); }
    if (!hole.cupMove) cupHole(c, hole.cup);
    if (hole.cupMove) { const mv = hole.cupMove; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 30; c.lineCap = 'round'; c.beginPath(); c.moveTo(hole.cup[0] - mv.dx * mv.amp, hole.cup[1] - mv.dy * mv.amp); c.lineTo(hole.cup[0] + mv.dx * mv.amp, hole.cup[1] + mv.dy * mv.amp); c.stroke(); }
    if (hole.bonus) cupHole(c, hole.bonus, true);
    for (const w of hole.walls) wall(c, w);
    for (const b of hole.bumpers || []) bumper(c, b);
    for (const mg of hole.magnets || []) { const g = c.createRadialGradient(mg.x, mg.y, 0, mg.x, mg.y, mg.r); g.addColorStop(0, 'rgba(255,120,200,.35)'); g.addColorStop(1, 'rgba(255,120,200,0)'); c.fillStyle = g; c.beginPath(); c.arc(mg.x, mg.y, mg.r, 0, TAU); c.fill(); }
  }
  function cupHole(c, [x, y], bonus) {
    const g = c.createRadialGradient(x, y, CUP * 0.2, x, y, CUP + 8);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(0.62, bonus ? 'rgba(255,215,64,.9)' : 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, CUP + 8, 0, TAU); c.fill();
    const d = c.createRadialGradient(x - 3, y - 3, 1, x, y, CUP);
    d.addColorStop(0, '#000'); d.addColorStop(0.7, '#0d1510'); d.addColorStop(1, '#2b3a30');
    c.fillStyle = d; c.beginPath(); c.arc(x, y, CUP, 0, TAU); c.fill();
  }
  function chevron(c, x, y, [dx, dy], s) {
    const px = -dy, py = dx;
    c.beginPath(); c.moveTo(x - dx * s + px * s, y - dy * s + py * s); c.lineTo(x, y); c.lineTo(x - dx * s - px * s, y - dy * s - py * s); c.stroke();
  }
  function zone(c, z, rand) {
    c.save(); shapePath(c, z);
    const [x0, y0, w, h] = zoneBox(z);
    if (z.t === 'sand' || z.t === 'snow') {
      c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 8; c.fillStyle = th.sand; if (z.t === 'snow') c.fillStyle = '#ffffff'; c.fill(); c.shadowBlur = 0; c.clip();
      grain(c, x0, y0, w, h, z.t === 'snow' ? 'rgba(160,200,230,.35)' : hole.theme === 'candy' ? 'rgba(60,30,10,.4)' : 'rgba(150,120,60,.35)', (w * h) / 60, rand, 2);
      if (hole.theme === 'candy') grain(c, x0, y0, w, h, 'rgba(255,255,255,.35)', (w * h) / 300, rand, 3);
    } else if (z.t === 'ice') {
      c.fillStyle = hole.theme === 'space' ? 'rgba(160,215,255,.25)' : 'rgba(170,220,255,.55)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
      for (let i = 0; i < (w * h) / 9000; i++) { const x = x0 + rand() * w, y = y0 + rand() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 34, y - 14); c.stroke(); }
    } else if (z.t === 'water') {
      if (th.neon) { const g = c.createRadialGradient(z.c[0], z.c[1], 0, z.c[0], z.c[1], z.c[2]); g.addColorStop(0, '#000'); g.addColorStop(0.6, '#07020f'); g.addColorStop(0.85, '#5b2bb5'); g.addColorStop(1, 'rgba(160,110,255,0)'); c.fillStyle = g; c.fill(); }
      else {
        const g = z.r ? c.createLinearGradient(x0, y0, x0 + w, y0) : c.createRadialGradient(z.c[0], z.c[1], 0, z.c[0], z.c[1], z.c[2]);
        if (z.r) { g.addColorStop(0, th.water); g.addColorStop(0.5, th.deep); g.addColorStop(1, th.water); } else { g.addColorStop(0, th.deep); g.addColorStop(1, th.water); }
        c.fillStyle = g; c.fill();
        c.lineWidth = 5; c.strokeStyle = th.lava ? 'rgba(255,210,90,.6)' : 'rgba(255,255,255,.35)'; c.stroke();
      }
    } else if (z.t === 'slope') {
      c.fillStyle = th.slope ?? 'rgba(0,0,0,.12)'; c.fill(); c.clip();
      const g = c.createLinearGradient(x0 + (z.dir[0] < 0 ? w : 0), 0, x0 + (z.dir[0] < 0 ? 0 : w), 0); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = g; c.fillRect(x0, y0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 4;
      for (let y = y0 + 22; y < y0 + h; y += 44) for (let x = x0 + 22; x < x0 + w; x += 40) chevron(c, x, y, z.dir, 9);
    } else if (z.t === 'fan') {
      c.fillStyle = 'rgba(0,0,0,.22)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,140,60,.3)'; c.lineWidth = 2;
      for (let x = x0; x < x0 + w; x += 14) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke(); }
    } else if (z.t === 'belt') {
      c.fillStyle = hole.theme === 'sea' ? 'rgba(80,160,255,.18)' : '#3a3a46'; c.fill();
      if (hole.theme !== 'sea') { c.strokeStyle = '#22222a'; c.lineWidth = 3; c.stroke(); }
    } else if (z.t === 'ramp') {
      c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 10; c.shadowOffsetX = z.dir[0] * 6; c.shadowOffsetY = z.dir[1] * 6;
      c.fillStyle = '#c08a52'; c.fill(); c.restore(); c.clip();
      const g = c.createLinearGradient(x0 + (z.dir[0] < 0 ? w : 0), y0 + (z.dir[1] < 0 ? h : 0), x0 + (z.dir[0] > 0 ? w : z.dir[0] < 0 ? 0 : 0), y0 + (z.dir[1] > 0 ? h : 0));
      g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(255,255,255,.35)'); c.fillStyle = g; c.fillRect(x0, y0, w, h);
      c.strokeStyle = 'rgba(80,45,15,.5)'; c.lineWidth = 2;
      if (z.dir[0]) for (let x = x0 + 10; x < x0 + w; x += 12) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke(); }
      else for (let y = y0 + 10; y < y0 + h; y += 12) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke(); }
      c.strokeStyle = '#ffd23f'; c.lineWidth = 5; chevron(c, x0 + w / 2 + z.dir[0] * 12, y0 + h / 2 + z.dir[1] * 12, z.dir, 12);
    }
    c.restore();
  }
  function wall(c, w) {
    const p = Golf.wallPts(w), trace = (dx = 0, dy = 0) => { c.beginPath(); c.moveTo(p[0] + dx, p[1] + dy); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k] + dx, p[k + 1] + dy); };
    c.lineCap = c.lineJoin = 'round';
    if (w.low) { // haie basse : on peut la sauter
      trace(0, 3); c.strokeStyle = '#2f6a2a'; c.lineWidth = WALL * 2 + 4; c.stroke();
      trace(); c.strokeStyle = '#4fae46'; c.lineWidth = WALL * 2; c.stroke();
      c.fillStyle = '#7cd66c'; const L = Math.hypot(p[2] - p[0], p[3] - p[1]); for (let s = 0; s < L; s += 9) { const u = s / L; c.beginPath(); c.arc(p[0] + (p[2] - p[0]) * u, p[1] + (p[3] - p[1]) * u, 3, 0, TAU); c.fill(); }
      return;
    }
    c.save();
    if (th.neon) { c.shadowColor = th.wall; c.shadowBlur = 16; }
    trace(0, 4); c.strokeStyle = th.side; c.lineWidth = WALL * 2 + 2; c.stroke(); // côté du mur (volume)
    trace(); c.strokeStyle = th.wall; c.lineWidth = WALL * 2; c.stroke();
    c.restore();
    if (th.stripes) { trace(); c.strokeStyle = th.stripes; c.lineWidth = WALL * 2; c.lineCap = 'butt'; c.setLineDash([9, 9]); c.stroke(); c.setLineDash([]); c.lineCap = 'round'; }
    if (hole.theme === 'jungle' || hole.theme === 'classic') { trace(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.setLineDash([14, 10]); c.stroke(); c.setLineDash([]); }
    trace(-1, -2); c.strokeStyle = th.top; c.globalAlpha = 0.75; c.lineWidth = 2.5; c.stroke(); c.globalAlpha = 1;
  }
  function bumper(c, b) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(b.x + 3, b.y + 5, b.r, 0, TAU); c.fill();
    if (b.tomb) { tomb(c, b.x, b.y, b.r * 1.5); return; }
    const g = c.createRadialGradient(b.x - b.r * 0.4, b.y - b.r * 0.4, 1, b.x, b.y, b.r);
    let col = th.neon ? '#8c86ac' : hole.theme === 'volcano' ? '#8a6a5c' : '#9aa3a8';
    if (b.jelly) col = ['#ff5fa2', '#59c8ff', '#ffd23f', '#8be37a', '#b98cff'][Math.round(b.x + b.y) % 5];
    if (b.kick) col = '#ff3d5a';
    if (b.block) col = '#bfe6ff';
    if (b.coral) col = '#ff7f6e';
    if (b.palm) { g.addColorStop(0, '#b07a45'); g.addColorStop(1, '#6b4422'); } else { g.addColorStop(0, '#fff'); g.addColorStop(0.18, col); g.addColorStop(1, shade(col, -60)); }
    c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    if (b.kick) { c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.arc(b.x, b.y, b.r - 2, 0, TAU); c.stroke(); c.fillStyle = '#fff'; star(c, b.x, b.y, b.r * 0.45); }
    if (b.block) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x - b.r * 0.5, b.y - b.r * 0.2); c.lineTo(b.x + b.r * 0.2, b.y - b.r * 0.6); c.stroke(); }
    if (th.neon && !b.palm) { c.fillStyle = 'rgba(0,0,0,.25)'; for (const [ox, oy, rr] of [[-0.3, 0.2, 0.25], [0.35, -0.1, 0.18]]) { c.beginPath(); c.arc(b.x + ox * b.r, b.y + oy * b.r, rr * b.r, 0, TAU); c.fill(); } }
  }
  function decoBelow(c, d, rand) {
    if (d.t === 'flowers') for (const [x, y] of d.at) for (let k = 0; k < 6; k++) { c.fillStyle = ['#fff', '#ffe066', '#ff8fb1'][k % 3]; c.beginPath(); c.arc(x + Math.cos(k * 1.1) * 13, y + Math.sin(k * 1.1) * 13, 5, 0, TAU); c.fill(); }
    if (d.t === 'shells') for (const [x, y] of d.at) { c.fillStyle = '#ffd9c2'; c.beginPath(); c.arc(x, y, 10, Math.PI, 0); c.fill(); c.strokeStyle = '#e8a98a'; c.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + k * 4, y - 9); c.stroke(); } }
    if (d.t === 'cracks') { c.strokeStyle = 'rgba(255,110,40,.4)'; c.lineWidth = 2; for (let i = 0; i < 30; i++) { let x = rand() * W, y = rand() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); } }
    if (d.t === 'sprinkles') for (let i = 0; i < 260; i++) { c.fillStyle = ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e', '#c49bff'][i % 5]; c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * 3); c.beginPath(); c.roundRect(-4, -1.4, 8, 2.8, 1.4); c.fill(); c.restore(); }
    if (d.t === 'stars') for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.5})`; c.beginPath(); c.arc(rand() * W, rand() * H, rand() * 1.3 + 0.3, 0, TAU); c.fill(); }
    if (d.t === 'planet') for (const [x, y] of d.at) { const g = c.createRadialGradient(x - 10, y - 10, 2, x, y, 34); g.addColorStop(0, '#ffb27a'); g.addColorStop(1, '#a8452a'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,220,180,.6)'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, 56, 14, -0.3, 0, TAU); c.stroke(); }
    if (d.t === 'webs') for (const [x, y, a] of [[0, 0, 0], [W, 0, Math.PI / 2], [W, H, Math.PI], [0, H, -Math.PI / 2]]) { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(k * 0.39) * 90, Math.sin(k * 0.39) * 90); c.stroke(); } for (let r = 20; r < 90; r += 18) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke(); } c.restore(); }
    if (d.t === 'snowflakes') for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,.8)'; star(c, rand() * W, rand() * H, 3 + rand() * 3, 6); }
    if (d.t === 'leaves') for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(30,${110 + rand() * 60},40,.45)`; c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * TAU); c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, TAU); c.fill(); c.restore(); }
    if (d.t === 'seaweed') for (const [x, y] of d.at) seaweed(c, x, y + 10, 26, rand());
    if (d.t === 'balloons' || d.t === 'candles') for (const [x, y] of d.at) { c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.arc(x + 3, y + 4, 9, 0, TAU); c.fill(); }
  }

  /* ---------- Éléments animés ---------- */
  function animated(c, t, open, cup) {
    for (const z of hole.zones || []) {
      if (z.t === 'water') {
        c.save(); shapePath(c, z); c.clip();
        const [x0, y0, w, h] = zoneBox(z);
        if (th.lava) {
          for (let i = 0; i < (w * h) / 2500; i++) { const px = x0 + ((i * 97.3) % w), py = y0 + ((i * 53.7 + t * 12) % h), p = (Math.sin(t * 2 + i) + 1) / 2; c.fillStyle = `rgba(255,${180 + p * 60},80,${0.25 + p * 0.35})`; c.beginPath(); c.arc(px, py, 4 + p * 8, 0, TAU); c.fill(); }
          c.fillStyle = `rgba(255,220,120,${0.08 + Math.sin(t * 3) * 0.05})`; c.fillRect(x0, y0, w, h);
        } else if (th.neon) {
          c.translate(z.c[0], z.c[1]); c.rotate(t * 1.5);
          for (let k = 0; k < 3; k++) { c.strokeStyle = `rgba(180,120,255,${0.5 - k * 0.12})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, z.c[2] * (0.55 + k * 0.15), k, k + 2.4); c.stroke(); }
        } else {
          c.strokeStyle = th.abyss ? 'rgba(80,140,255,.15)' : 'rgba(255,255,255,.45)'; c.lineWidth = 2;
          for (let i = 0; i < (w * h) / 1800; i++) { const px = x0 + ((i * 71.3 + t * 18) % (w + 20)) - 10, py = y0 + ((i * 37.9) % h), a = Math.sin(t * 2 + i) * 0.5 + 0.5; c.globalAlpha = a; c.beginPath(); c.arc(px, py, 7, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
          c.globalAlpha = 1;
        }
        c.restore();
      } else if (z.t === 'belt') {
        c.save(); shapePath(c, z); c.clip();
        const [x0, y0, w, h] = zoneBox(z), off = (t * z.f * 0.25) % 40;
        c.strokeStyle = hole.theme === 'sea' ? 'rgba(200,240,255,.45)' : 'rgba(255,210,60,.8)'; c.lineWidth = 4;
        for (let y = y0 + 20; y < y0 + h; y += 36) for (let x = x0 - 40; x < x0 + w + 40; x += 40) chevron(c, x + off * z.dir[0], y + off * z.dir[1], z.dir, 8);
        c.restore();
      } else if (z.t === 'fan' && Golf.active(z, t)) {
        c.save(); c.beginPath(); c.rect(...z.r); c.clip();
        c.strokeStyle = 'rgba(255,190,120,.65)'; c.lineWidth = 4;
        const off = (t * 120) % 60;
        for (let x = z.r[0] + 30; x < z.r[0] + z.r[2]; x += 60) for (let y = z.r[1] + z.r[3] + 60 - off; y > z.r[1] - 20; y -= 60) chevron(c, x, y, z.dir, 10);
        c.restore();
      }
    }
    for (const br of hole.bridges || []) {
      const on = Golf.active(br, t), left = br.period ? br.on - ((((t + (br.phase || 0)) % br.period) + br.period) % br.period) : 9;
      c.save();
      if (!on) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(...br.r); c.restore(); continue; }
      c.globalAlpha = left < 0.8 ? 0.45 + 0.45 * Math.round((Math.sin(t * 30) + 1) / 2) : 1;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(br.r[0] + 4, br.r[1] + 6, br.r[2], br.r[3]);
      c.fillStyle = th.bridge; c.fillRect(...br.r);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
      const vertical = br.r[2] > br.r[3];
      if (vertical) for (let x = br.r[0] + 13; x < br.r[0] + br.r[2]; x += 13) { c.beginPath(); c.moveTo(x, br.r[1]); c.lineTo(x, br.r[1] + br.r[3]); c.stroke(); }
      else for (let y = br.r[1] + 13; y < br.r[1] + br.r[3]; y += 13) { c.beginPath(); c.moveTo(br.r[0], y); c.lineTo(br.r[0] + br.r[2], y); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(br.r[0], br.r[1], br.r[2], 3);
      c.restore();
    }
    for (const tp of hole.teleports || []) {
      const g = c.createRadialGradient(tp.from[0], tp.from[1], 0, tp.from[0], tp.from[1], tp.r + 8); g.addColorStop(0, 'rgba(120,60,255,.9)'); g.addColorStop(1, 'rgba(120,60,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(tp.from[0], tp.from[1], tp.r + 8, 0, TAU); c.fill();
      for (let k = 0; k < 3; k++) { c.strokeStyle = ['#c49bff', '#7bd3ff', '#fff'][k]; c.lineWidth = 3; c.beginPath(); c.arc(tp.from[0], tp.from[1], tp.r - k * 5, t * (3 + k) + k, t * (3 + k) + k + 3.5); c.stroke(); }
    }
    for (const p of hole.plates || []) if (open.includes(p.door)) { c.fillStyle = `rgba(140,255,120,${0.5 + Math.sin(t * 4) * 0.3})`; star(c, p.x, p.y, p.r * 0.7, 5); }
    for (const mg of hole.magnets || []) {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.sin(t * 2 + k) * 0.2, L = 14 + Math.sin(t * 3 + k * 2) * 4; c.strokeStyle = '#ff7ac4'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(mg.x, mg.y); c.quadraticCurveTo(mg.x + Math.cos(a + 0.4) * L * 0.6, mg.y + Math.sin(a + 0.4) * L * 0.6, mg.x + Math.cos(a) * L, mg.y + Math.sin(a) * L); c.stroke(); }
      c.fillStyle = '#ffd1ec'; c.beginPath(); c.arc(mg.x, mg.y, 6, 0, TAU); c.fill();
    }
    // Moulins, portes coulissantes, portes de la crypte
    for (const mv of Golf.movers(hole, t, open)) {
      c.lineCap = 'round';
      if (mv.kind === 'blade') {
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = WALL * 2 + 4; c.beginPath(); c.moveTo(mv.ax + 4, mv.ay + 6); c.lineTo(mv.bx + 4, mv.by + 6); c.stroke();
        c.strokeStyle = '#7a4a24'; c.lineWidth = WALL * 2 + 2; c.beginPath(); c.moveTo(mv.ax, mv.ay); c.lineTo(mv.bx, mv.by); c.stroke();
        c.strokeStyle = '#fff6e6'; c.lineWidth = WALL * 2 - 2; c.beginPath(); c.moveTo(mv.ax + (mv.bx - mv.ax) * 0.25, mv.ay + (mv.by - mv.ay) * 0.25); c.lineTo(mv.bx, mv.by); c.stroke();
        c.strokeStyle = 'rgba(200,60,50,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(mv.ax + (mv.bx - mv.ax) * 0.4, mv.ay + (mv.by - mv.ay) * 0.4); c.lineTo(mv.bx, mv.by); c.stroke();
      } else if (mv.kind === 'gate') {
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = WALL * 2 + 3; c.beginPath(); c.moveTo(mv.ax + 3, mv.ay + 5); c.lineTo(mv.bx + 3, mv.by + 5); c.stroke();
        c.strokeStyle = '#ffd23f'; c.lineWidth = WALL * 2; c.beginPath(); c.moveTo(mv.ax, mv.ay); c.lineTo(mv.bx, mv.by); c.stroke();
        c.strokeStyle = '#222'; c.setLineDash([8, 8]); c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
      } else {
        c.strokeStyle = '#2b2733'; c.lineWidth = WALL * 2 + 2; c.beginPath(); c.moveTo(mv.ax, mv.ay); c.lineTo(mv.bx, mv.by); c.stroke();
        c.strokeStyle = '#8f8aa6'; c.lineWidth = 2;
        const L = Math.hypot(mv.bx - mv.ax, mv.by - mv.ay);
        for (let s = 4; s < L; s += 9) { const u = s / L, x = mv.ax + (mv.bx - mv.ax) * u, y = mv.ay + (mv.by - mv.ay) * u; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); }
      }
    }
    for (const d of hole.doors || []) if (open.includes(d.id)) { c.strokeStyle = 'rgba(140,255,120,.35)'; c.setLineDash([4, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(d.seg[0], d.seg[1]); c.lineTo(d.seg[2], d.seg[3]); c.stroke(); c.setLineDash([]); }
    for (const w of hole.windmills || []) { c.fillStyle = '#c0392b'; c.beginPath(); c.arc(w.x, w.y, 15, 0, TAU); c.fill(); c.fillStyle = '#ffe0b0'; c.beginPath(); c.arc(w.x, w.y, 6, 0, TAU); c.fill(); }
    for (const cr of hole.critters || []) critter(c, cr, Golf.critterAt(cr, t), t);
    if (hole.cupMove) {
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(cup[0], cup[1], CUP + 14, 0, TAU); c.fill();
      for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#ff3d5a' : '#ffd23f'; c.beginPath(); c.moveTo(cup[0], cup[1]); c.arc(cup[0], cup[1], CUP + 12, (k / 8) * TAU + t, ((k + 1) / 8) * TAU + t); c.fill(); }
      cupHole(c, cup);
    }
  }
  function critter(c, cr, q, t) {
    const a = Math.atan2(q.vy, q.vx), r = cr.r;
    c.save(); c.translate(q.x, q.y);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(4, 6, r, r * 0.8, 0, 0, TAU); c.fill();
    if (cr.kind === 'ghost') {
      const bob = Math.sin(t * 4) * 2; c.globalAlpha = 0.85;
      c.fillStyle = '#f4f2ff'; c.beginPath(); c.arc(0, bob - 2, r, Math.PI, 0); c.lineTo(r, r + bob);
      for (let k = 0; k < 4; k++) c.quadraticCurveTo(r - (k + 0.5) * (r / 2), r + bob - 6 * (k % 2 ? -1 : 1) + Math.sin(t * 8 + k) * 2, r - (k + 1) * (r / 2), r + bob);
      c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(-r * 0.35, bob - 4, 2.6, 0, TAU); c.arc(r * 0.35, bob - 4, 2.6, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0, bob + 3, 3, 4, 0, 0, TAU); c.fill();
    } else if (cr.kind === 'penguin') {
      c.rotate(a + Math.PI / 2 + Math.sin(t * 10) * 0.12);
      c.fillStyle = '#1f2430'; c.beginPath(); c.ellipse(0, 0, r * 0.85, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, 2, r * 0.55, r * 0.75, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(-3, -r * 0.8); c.lineTo(3, -r * 0.8); c.lineTo(0, -r - 5); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.arc(-3.5, -r * 0.5, 1.6, 0, TAU); c.arc(3.5, -r * 0.5, 1.6, 0, TAU); c.fill();
    } else if (cr.kind === 'fish') {
      c.rotate(a);
      c.fillStyle = '#ff9a1f'; c.beginPath(); c.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(-r * 1.5, -r * 0.6 + Math.sin(t * 12) * 3); c.lineTo(-r * 1.5, r * 0.6 + Math.sin(t * 12) * 3); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-2, -r * 0.6, 3, r * 1.2);
      c.fillStyle = '#000'; c.beginPath(); c.arc(r * 0.5, -2, 1.8, 0, TAU); c.fill();
    } else if (cr.kind === 'monkey') {
      c.fillStyle = '#7a4a24'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.beginPath(); c.arc(-r, -2, r * 0.38, 0, TAU); c.arc(r, -2, r * 0.38, 0, TAU); c.fill();
      c.fillStyle = '#e8b98a'; c.beginPath(); c.ellipse(0, 3, r * 0.65, r * 0.55, 0, 0, TAU); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.arc(-4, -3, 1.8, 0, TAU); c.arc(4, -3, 1.8, 0, TAU); c.fill();
    } else { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }
    c.restore();
  }
  // Au-dessus des balles : tunnels, palmes, bougies, ballons, drapeaux
  function above(c, t, cup, ballsNear) {
    for (const d of hole.deco || []) {
      if (d.t === 'tunnel') {
        const [x, y, w, h] = d.r;
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 5, y + 8, w, h);
        c.fillStyle = '#8a5530'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
        c.fillStyle = '#a86c38'; for (let k = 0; k < w - 4; k += 20) c.fillRect(x + k + 4, y + 4, 16, h - 8);
        c.fillStyle = '#4a2c14'; c.fillRect(x, y, 8, h); c.fillRect(x + w - 8, y, 8, h);
      }
      if (d.t === 'candles') for (const [x, y] of d.at) { c.fillStyle = '#efe6d0'; c.fillRect(x - 4, y - 8, 8, 14); const f = 1 + Math.sin(t * 12 + x) * 0.2; const g = c.createRadialGradient(x, y - 12, 0, x, y - 12, 26); g.addColorStop(0, 'rgba(255,200,90,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y - 12, 26, 0, TAU); c.fill(); c.fillStyle = '#ffcf5a'; c.beginPath(); c.ellipse(x, y - 13, 3 * f, 6 * f, 0, 0, TAU); c.fill(); }
      if (d.t === 'balloons') for (const [x, y] of d.at) for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 12, by = y - 10 + Math.sin(t * 2 + k + x) * 3; c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(bx, by); c.stroke(); c.fillStyle = ['#ff3d5a', '#3d8bff', '#ffd23f'][k]; c.beginPath(); c.ellipse(bx, by - 8, 7, 9, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(bx - 2, by - 11, 2, 0, TAU); c.fill(); }
    }
    for (const b of hole.bumpers || []) if (b.palm) {
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + Math.sin(t * 1.2 + k) * 0.06;
        c.fillStyle = k % 2 ? 'rgba(46,140,60,.88)' : 'rgba(70,175,74,.88)';
        c.save(); c.translate(b.x, b.y); c.rotate(a); c.beginPath(); c.ellipse(28, 0, 30, 8, 0, 0, TAU); c.fill(); c.restore();
      }
      c.fillStyle = '#8a5a2b'; c.beginPath(); c.arc(b.x, b.y, 7, 0, TAU); c.fill();
    }
    flag(c, cup, t, th.flag, ballsNear(cup));
    if (hole.bonus) flag(c, hole.bonus, t, '#ffd23f', ballsNear(hole.bonus), true);
  }
  function flag(c, [x, y], t, col, near, bonus) {
    c.save(); c.globalAlpha = near ? 0.35 : 1;
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + 18, y - 30); c.stroke();
    c.strokeStyle = '#f2f2f2'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - 50); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(x + 4, y - 50);
    c.quadraticCurveTo(x + 18, y - 48 + Math.sin(t * 4) * 3, x + 32, y - 42 + Math.sin(t * 4 + 1) * 2.5);
    c.quadraticCurveTo(x + 18, y - 38 + Math.sin(t * 4 + 2) * 2, x + 4, y - 33); c.fill();
    if (bonus) { c.fillStyle = '#fff'; star(c, x + 15, y - 42, 5); }
    c.restore();
  }

  /* ---------- Particules, textes, traînées ---------- */
  function burst(x, y, n, colors, { speed = 120, life = 0.8, grav = 0, size = 3, shape = 'sq', drag = 2 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), age: 0, c: colors[i % colors.length], s: size * (0.6 + Math.random() * 0.8), grav, shape, drag, rot: Math.random() * TAU });
    }
  }
  function sink(x, y, kind, color) {
    const rainbow = ['#ff5a5f', '#ffc93c', '#3d8bff', '#43c173', '#f15bb5', '#fff'];
    if (kind === 'etoiles') burst(x, y, 40, ['#fff6a8', '#ffd23f', '#fff'], { speed: 200, life: 1.4, grav: 60, size: 6, shape: 'star' });
    else if (kind === 'feu') for (let k = 0; k < 4; k++) setTimeout(() => burst(x + (Math.random() - 0.5) * 80, y - 30 - Math.random() * 60, 40, [rainbow[k], '#fff'], { speed: 160, life: 1.2, grav: 40, size: 3 }), k * 220);
    else if (kind === 'bonbons') burst(x, y, 36, ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e'], { speed: 220, life: 1.6, grav: 260, size: 7, shape: 'candy' });
    else if (kind === 'coeurs') burst(x, y, 30, ['#ff4f7b', '#ff8fb1', color], { speed: 150, life: 1.5, grav: -40, size: 7, shape: 'heart' });
    else burst(x, y, 70, rainbow, { speed: 240, life: 1.5, grav: 180, size: 4, shape: 'conf' });
    burst(x, y, 1, ['rgba(255,255,255,.8)'], { speed: 0, life: 0.6, size: 1, shape: 'ring' });
  }
  function splash(x, y) {
    const cols = th.lava ? ['#ff5a1f', '#ffd25a', '#333'] : th.neon ? ['#a37bff', '#5b2bb5', '#fff'] : [th.water, '#fff', '#bfe9ff'];
    burst(x, y, 34, cols, { speed: 140, life: 0.9, size: 3.5, shape: 'circle' });
    for (let k = 0; k < 3; k++) setTimeout(() => burst(x, y, 1, [th.lava ? 'rgba(255,200,80,.8)' : 'rgba(255,255,255,.8)'], { speed: 0, life: 0.8, size: 1, shape: 'ring' }), k * 160);
  }
  function float(x, y, text, { color = '#fff', size = 20, life = 1.6, screen = false } = {}) { floats.push({ x, y, text, color, size, life, age: 0, screen }); }
  function trail(name, x, y, z, look, moving) {
    let tr = trails.get(name);
    if (!tr) trails.set(name, (tr = { pts: [], look }));
    tr.look = look;
    if (moving) {
      tr.pts.push({ x, y: y - z * 0.55, a: 0 });
      const col = GolfLooks.hexOf(look.color);
      if (look.trail === 'etincelles' && Math.random() < 0.7) burst(x, y, 1, ['#fff6a8', '#ffd23f', col], { speed: 40, life: 0.5, size: 2.5, shape: 'star' });
      if (look.trail === 'bulles' && Math.random() < 0.35) burst(x, y, 1, ['rgba(200,240,255,.9)'], { speed: 15, life: 1.1, size: 4, shape: 'bubble', grav: -30 });
      if (look.trail === 'coeurs' && Math.random() < 0.3) burst(x, y, 1, ['#ff4f7b', '#ff8fb1'], { speed: 20, life: 0.9, size: 5, shape: 'heart', grav: -20 });
      if (look.trail === 'flammes') burst(x, y, 2, ['#ffd23f', '#ff7a1f', '#ff3d1f'], { speed: 30, life: 0.45, size: 4, shape: 'circle', grav: -40 });
    }
    if (tr.pts.length > (moving ? 18 : 0)) tr.pts.shift();
  }

  /* ---------- Une image ---------- */
  // v = { t, dt, open, balls: [{ name, x, y, z, look, roll, ring, label, title }], aim, preview, ballsNear }
  function frame(v) {
    resize();
    if (!hole) return;
    const key = `${hole.id}:${cv.width}x${cv.height}`;
    if (key !== cacheKey) { cacheKey = key; buildCache(); }
    moveCamera(v.dt);
    const c = ctx, t = v.t, cup = Golf.cupAt(hole, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = th.scene2; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(...matrix());
    c.drawImage(cache, -M, -M, VW, VH);
    animated(c, t, v.open, cup);
    // Traînées
    for (const tr of trails.values()) {
      if (tr.look.trail === 'aucune' || tr.pts.length < 2) continue;
      const col = GolfLooks.hexOf(tr.look.color);
      c.lineCap = 'round';
      for (let i = 1; i < tr.pts.length; i++) {
        const p0 = tr.pts[i - 1], p1 = tr.pts[i];
        if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 60) continue;
        const f = i / tr.pts.length;
        c.globalAlpha = f * (tr.look.trail === 'classique' ? 0.45 : 0.7);
        c.strokeStyle = tr.look.trail === 'arcenciel' ? `hsl(${(t * 300 + i * 25) % 360},90%,60%)` : tr.look.trail === 'flammes' ? '#ff9a1f' : col;
        c.lineWidth = 9 * f;
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      }
      c.globalAlpha = 1;
    }
    // Aperçu de la trajectoire (aide à la visée)
    if (v.preview?.length > 1) {
      c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.setLineDash([1, 9]); c.lineCap = 'round';
      c.beginPath(); c.moveTo(v.preview[0][0], v.preview[0][1]); for (const p of v.preview) c.lineTo(p[0], p[1]); c.stroke(); c.restore();
      const e = v.preview.at(-1); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(e[0], e[1], 6, 0, TAU); c.stroke();
    }
    // Balles (celle qui joue par-dessus)
    const R = v.R ?? Golf.R;
    for (const b of v.balls) {
      if (b.ring) {
        const p = (Math.sin(t * 5) + 1) / 2;
        c.strokeStyle = GolfLooks.hexOf(b.look.color); c.globalAlpha = 0.35 + p * 0.4; c.lineWidth = 2.5;
        c.beginPath(); c.arc(b.x, b.y, R + 7 + p * 3, 0, TAU); c.stroke(); c.globalAlpha = 1;
      }
      drawBall(c, b.x, b.y, R, b.look, t, b.roll, b.z || 0);
    }
    // Visée : club, flèche de direction, jauge de puissance autour de la balle
    if (v.aim) {
      const { x, y, angle, power, pull, look } = v.aim, len = 26 + power * 150;
      const col = power < 0.5 ? '#43c173' : power < 0.8 ? '#ffc93c' : '#ff5a5f';
      drawClub(c, x, y, angle, pull, look, t);
      c.save(); c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([2, 10]);
      c.beginPath(); c.moveTo(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12); c.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len); c.stroke(); c.setLineDash([]);
      c.fillStyle = col; c.translate(x + Math.cos(angle) * len, y + Math.sin(angle) * len); c.rotate(angle);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -9); c.lineTo(-6, 9); c.fill(); c.restore();
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 5; c.beginPath(); c.arc(x, y, R + 12, 0, TAU); c.stroke();
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(x, y, R + 12, -Math.PI / 2, -Math.PI / 2 + power * TAU); c.stroke();
    }
    // Particules
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += v.dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.vx *= 1 - v.dt * p.drag; p.vy = p.vy * (1 - v.dt * p.drag) + p.grav * v.dt; p.x += p.vx * v.dt; p.y += p.vy * v.dt; p.rot += v.dt * 5;
      const f = 1 - p.age / p.life;
      c.globalAlpha = Math.min(1, f * 1.5); c.fillStyle = p.c; c.strokeStyle = p.c;
      if (p.shape === 'ring') { c.lineWidth = 3 * f; c.beginPath(); c.arc(p.x, p.y, 8 + (1 - f) * 40, 0, TAU); c.stroke(); }
      else if (p.shape === 'star') star(c, p.x, p.y, p.s);
      else if (p.shape === 'heart') heart(c, p.x, p.y, p.s);
      else if (p.shape === 'circle') { c.beginPath(); c.arc(p.x, p.y, p.s, 0, TAU); c.fill(); }
      else if (p.shape === 'bubble') { c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, p.s, 0, TAU); c.stroke(); }
      else if (p.shape === 'candy') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.roundRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9, p.s * 0.45); c.fill(); c.restore(); }
      else if (p.shape === 'conf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.s, -p.s * 0.4, p.s * 2, p.s * 0.8); c.restore(); }
      else c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    c.globalAlpha = 1;
    above(c, t, cup, v.ballsNear);
    // Météo d'ambiance
    for (const a of ambient) {
      const kind = th.amb;
      let x = a.x, y = a.y;
      if (kind === 'snow') { y = ((a.y + t * 30 * a.s + M) % VH) - M; x = a.x + Math.sin(t + a.p) * 12; c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x, y, 2 * a.s, 0, TAU); c.fill(); }
      else if (kind === 'bubbles') { y = ((a.y - t * 25 * a.s + M * 3 + VH * 10) % VH) - M; x = a.x + Math.sin(t * 2 + a.p) * 6; c.strokeStyle = 'rgba(200,240,255,.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 3 * a.s, 0, TAU); c.stroke(); }
      else if (kind === 'embers') { y = ((a.y - t * 40 * a.s + VH * 10) % VH) - M; x = a.x + Math.sin(t * 3 + a.p) * 10; c.fillStyle = `rgba(255,${120 + a.s * 80},40,${0.4 + Math.sin(t * 5 + a.p) * 0.3})`; c.beginPath(); c.arc(x, y, 1.6 * a.s, 0, TAU); c.fill(); }
      else if (kind === 'leaves') { y = ((a.y + t * 22 * a.s + M) % VH) - M; x = a.x + Math.sin(t + a.p) * 25; c.fillStyle = 'rgba(90,170,60,.6)'; c.save(); c.translate(x, y); c.rotate(t + a.p); c.beginPath(); c.ellipse(0, 0, 5, 2.4, 0, 0, TAU); c.fill(); c.restore(); }
      else if (kind === 'fireflies') { x = a.x + Math.sin(t * 0.7 + a.p) * 30; y = a.y + Math.cos(t * 0.5 + a.p) * 20; c.fillStyle = `rgba(200,255,120,${0.3 + Math.sin(t * 3 + a.p) * 0.3})`; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill(); }
      else if (kind === 'sparkles' || kind === 'twinkle') { const tw = (Math.sin(t * 3 + a.p * 5) + 1) / 2; if (tw > 0.7) { c.fillStyle = `rgba(255,255,255,${(tw - 0.7) * 3})`; star(c, x, y, 3 * a.s, 4); } }
      else if (kind === 'confetti') { y = ((a.y + t * 18 * a.s + M) % VH) - M; c.fillStyle = ['#ff3d5a', '#ffd23f', '#3d8bff', '#43c173'][Math.floor(a.p * 4) % 4]; c.save(); c.translate(x + Math.sin(t + a.p) * 15, y); c.rotate(t * 2 + a.p); c.fillRect(-3, -1.5, 6, 3); c.restore(); }
      else if (kind === 'butterflies' && a.s > 1.2) { x = a.x + Math.sin(t * 0.4 + a.p) * 60; y = a.y + Math.sin(t * 0.7 + a.p) * 30; const f = Math.abs(Math.sin(t * 12 + a.p)); c.fillStyle = a.p > 3 ? '#ffd23f' : '#ff8fb1'; c.beginPath(); c.ellipse(x - 3 * f, y, 3 * f + 0.5, 4, 0, 0, TAU); c.ellipse(x + 3 * f, y, 3 * f + 0.5, 4, 0, 0, TAU); c.fill(); }
    }
    // Noms, titres, émotes, textes : à l'écran (toujours droits, même parcours tourné)
    c.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(11, 12 * dpr);
    c.textAlign = 'center'; c.lineJoin = 'round';
    for (const b of v.balls) {
      if (!b.label) continue;
      const [sx, sy] = toScreen(b.x, b.y - (b.z || 0) * 0.55);
      c.font = `800 ${fs}px Nunito, sans-serif`; c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(0,0,0,.55)';
      const ly = sy - (R + 9) * base * cam.zoom;
      c.strokeText(b.label, sx, ly); c.fillStyle = '#fff'; c.fillText(b.label, sx, ly);
      if (b.title) { c.font = `700 ${fs * 0.75}px Nunito, sans-serif`; c.lineWidth = 3 * dpr; c.strokeText(b.title, sx, ly - fs); c.fillStyle = '#ffe27a'; c.fillText(b.title, sx, ly - fs); }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.age += v.dt;
      if (f.age > f.life) { floats.splice(i, 1); continue; }
      const k = f.age / f.life, [sx, sy] = f.screen ? [f.x * cv.width, f.y * cv.height] : toScreen(f.x, f.y);
      const pop = Math.min(1, f.age * 8), size = f.size * dpr * (0.6 + 0.4 * pop) * (f.screen ? 1 : 1);
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `900 ${size}px "Baloo 2", Nunito, sans-serif`;
      c.lineWidth = 5 * dpr; c.strokeStyle = 'rgba(0,0,0,.45)';
      c.strokeText(f.text, sx, sy - k * 40 * dpr); c.fillStyle = f.color; c.fillText(f.text, sx, sy - k * 40 * dpr);
    }
    c.globalAlpha = 1;
    // Vignette
    const vg = c.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, th.dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.28)');
    c.fillStyle = vg; c.fillRect(0, 0, cv.width, cv.height);
  }

  return {
    setHole, frame, focus, overview, snap, toWorld, burst, sink, splash, float, trail,
    shake: a => (cam.shake = Math.max(cam.shake, a)),
    get theme() { return th; },
    get portrait() { return portrait; },
    clearTrail: name => trails.delete(name),
  };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = v => clamp(v + amt, 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
