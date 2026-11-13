// Rendu 2D de Caboche Cup (Canvas), vue de profil et caméra fixe. Cinq stades (Caboche Arena de nuit, orage, plage au
// couchant, montagne enneigée, toit de la ville) avec public animé (chants, ola, sauts aux buts), projecteurs, écran géant,
// panneaux qui défilent, pelouse en perspective, cages aux filets qui ondulent, météo (pluie et éclairs, neige, vent).
// Personnages en cartoon plat : aplats, ombre franche, contours épais, grands yeux brillants, huit silhouettes (crête,
// tresses, bonnet, queue de cheval, casquette, afro, chauve barbu, cheveux au vent), accessoires, humeurs et poses
// (course, sprint, saut, tir, charge, volée, retourné, plongeon, tacle, chute, gel, contrôle, célébration).
// Effets : ballons à motifs, traînées, feu, zigzag, bonus en parachute, murs magiques, confettis, ralenti du replay.
const CC = window.CC, { F, WALL, BALL, HEAD } = CC;
export const TEAM = ['#ff4d4d', '#3d8bff'];
const TEAM_D = ['#c7303c', '#2a63c9'], TEAM_L = ['#ffb3a8', '#a9cbff'], SHORTS = ['#ffffff', '#1d2a5c'], INK = '#1d1530';
export const LOOKS = {
  bouboule: { skin: '#f6c8a0', shade: '#e09f78', hair: '#2b1d16', iris: '#6b3a1f', style: 'crete', wide: 1.1, boot: '#ffd23f', stache: true },
  lila: { skin: '#a8703f', shade: '#83522d', hair: '#2b1a14', iris: '#4a2a14', style: 'tresses', wide: 0.95, boot: '#6dffb0', lashes: true },
  givre: { skin: '#ffe3d2', shade: '#f0bea6', hair: '#d8f2ff', iris: '#3aa0ff', style: 'bonnet', wide: 1, boot: '#9fe3ff' },
  zoe: { skin: '#f3bc90', shade: '#d9946a', hair: '#ff7a1a', iris: '#2f8a3a', style: 'queue', wide: 0.95, boot: '#ff8a3d', lashes: true, freckles: true },
  tiko: { skin: '#ffd5b5', shade: '#eda985', hair: '#7a4a24', iris: '#4b7bd8', style: 'casquette', wide: 1, boot: '#ff4d6a', freckles: true, gap: true },
  magnus: { skin: '#6e432a', shade: '#52301d', hair: '#1e130d', iris: '#3a2214', style: 'afro', wide: 1.02, boot: '#a46bff' },
  roco: { skin: '#e8ad86', shade: '#c98965', hair: '#5a3b22', iris: '#3b5a2a', style: 'chauve', wide: 1.08, boot: '#8d97a8', square: true, gloves: '#3ddc84' },
  siroco: { skin: '#dba67c', shade: '#ba8259', hair: '#25b8a0', iris: '#1d6f8a', style: 'vent', wide: 0.97, boot: '#25d8c0' },
};
export const BALLS = { classique: { name: 'Classique', price: 0 }, plage: { name: 'Ballon de plage', price: 150 }, pixel: { name: 'Pixel', price: 200 }, feu: { name: 'Lave', price: 200 }, disco: { name: 'Disco', price: 250 }, or: { name: 'Ballon d’or', price: 500 } };
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Couleur plus sombre (k < 1) ou plus claire (k > 1).
function tone(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(clamp(k < 1 ? v * k : v + (255 - v) * (k - 1), 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ================= Personnages ================= */
function bone(c, x0, y0, x1, y1, w, color) {
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = w + 0.06; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}
function blob(c, fill, line = 0.05) { c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = line; c.lineJoin = 'round'; c.stroke(); }
function leg(c, hx, hy, a, k, side, look, dk) {
  const kx = hx + Math.sin(a) * 0.19, ky = hy + Math.cos(a) * 0.19, sa = a - k, fx = kx + Math.sin(sa) * 0.19, fy = ky + Math.cos(sa) * 0.19;
  bone(c, hx, hy, kx, ky, 0.17, tone(SHORTS[side] === '#ffffff' ? look.skin : look.skin, dk));
  bone(c, kx, ky, fx, fy, 0.16, tone(TEAM[side], dk));
  c.save(); c.translate(fx, fy); c.rotate(-sa);
  c.beginPath(); c.moveTo(-0.1, -0.05); c.quadraticCurveTo(-0.13, 0.08, 0.0, 0.08); c.lineTo(0.2, 0.08); c.quadraticCurveTo(0.27, 0.07, 0.24, -0.01); c.quadraticCurveTo(0.17, -0.08, 0.04, -0.07); c.closePath();
  blob(c, tone(look.boot, dk), 0.045);
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(0.12, -0.03, 0.06, 0.02, 0, 0, TAU); c.fill();
  c.restore();
}
function arm(c, sx, sy, a, bend, side, look, dk) {
  const ex = sx + Math.sin(a) * 0.17, ey = sy + Math.cos(a) * 0.17, fa = a + bend, hx = ex + Math.sin(fa) * 0.15, hy = ey + Math.cos(fa) * 0.15;
  bone(c, sx, sy, ex, ey, 0.14, tone(TEAM[side], dk));
  bone(c, ex, ey, hx, hy, 0.11, tone(look.skin, dk));
  c.beginPath(); c.arc(hx, hy, look.gloves ? 0.11 : 0.075, 0, TAU); blob(c, tone(look.gloves ?? look.skin, dk), 0.04);
}
function torso(c, side, look, lean, t, speed) {
  c.save(); c.rotate(lean);
  // maillot : un œuf avec une ombre franche du côté du dos
  c.beginPath(); c.roundRect(-0.28, -1.0, 0.56, 0.66, 0.24);
  c.save(); c.fillStyle = TEAM_D[side]; c.fill(); c.clip(); c.fillStyle = TEAM[side]; c.beginPath(); c.roundRect(-0.18, -1.05, 0.56, 0.66, 0.24); c.fill();
  c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0.02, -1.05, 0.08, 0.8); // bande
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(0.12, -0.85, 0.08, 0.04, -0.5, 0, TAU); c.fill();
  c.restore();
  c.beginPath(); c.roundRect(-0.28, -1.0, 0.56, 0.66, 0.24); c.strokeStyle = INK; c.lineWidth = 0.05; c.stroke();
  c.beginPath(); c.roundRect(-0.27, -0.5, 0.54, 0.17, 0.07); blob(c, SHORTS[side], 0.045);
  if (look.style === 'bonnet') { // écharpe qui flotte
    const fl = Math.sin(t * 9) * 0.04 + speed * 0.02;
    c.beginPath(); c.roundRect(-0.25, -1.02, 0.5, 0.12, 0.05); blob(c, '#5fc8ff', 0.04);
    c.beginPath(); c.moveTo(-0.2, -0.95); c.lineTo(-0.45 - speed * 0.04, -0.85 + fl); c.lineTo(-0.42 - speed * 0.04, -0.72 + fl); c.lineTo(-0.12, -0.9); c.closePath(); blob(c, '#5fc8ff', 0.04);
  }
  c.restore();
}

// Tête (centre 0,0, rayon R), tournée vers +x, en trois quarts.
function headPath(c, look, W, R) { c.beginPath(); if (look.square) c.roundRect(-W, -R * 0.96, 2 * W, R * 1.94, R * 0.62); else c.ellipse(0, 0, W, R, 0, 0, TAU); }
function backHair(c, R, W, look, t, swing, speed) {
  const h = look.hair;
  if (look.style === 'tresses') for (const [bx, ph] of [[-0.6, 0], [-0.25, 1.3]]) {
    let x = bx * W, y = 0.2 * R;
    for (let k = 0; k < 6; k++) {
      const a = 0.25 + swing * 0.6 + Math.sin(t * 5 + ph + k * 0.6) * 0.08, nx = x - Math.sin(a) * 0.15 * R, ny = y + Math.cos(a) * 0.17 * R;
      c.beginPath(); c.ellipse(nx, ny, (k % 2 ? 0.08 : 0.12) * R, (k % 2 ? 0.08 : 0.13) * R, a, 0, TAU); blob(c, k % 2 ? '#ff4fa3' : h, 0.035);
      x = nx; y = ny;
    }
  }
  if (look.style === 'queue') { // queue de cheval haute qui se balance
    const sw = Math.sin(t * 6) * 0.15 + swing * 0.8;
    c.beginPath(); c.moveTo(-0.35 * W, -0.85 * R); c.bezierCurveTo(-1.2 * W, -1.0 * R + sw * R * 0.3, -1.25 * W - sw * 0.2, 0.0, -0.95 * W - sw * 0.4, 0.55 * R);
    c.bezierCurveTo(-0.9 * W, 0.1 * R, -0.85 * W, -0.45 * R, -0.15 * W, -0.7 * R); c.closePath(); blob(c, h);
    c.beginPath(); c.arc(-0.42 * W, -0.86 * R, 0.1 * R, 0, TAU); blob(c, '#2bd28f', 0.035);
  }
  if (look.style === 'afro') {
    c.fillStyle = h; c.strokeStyle = INK; c.lineWidth = 0.05;
    c.beginPath(); for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; c.arc(-0.12 * W + Math.cos(a) * 1.08 * R, -0.32 * R + Math.sin(a) * 1.02 * R, 0.3 * R, a - 1.2, a + 1.2); } c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2a20'; c.beginPath(); c.arc(-0.4 * W, -0.9 * R, 0.12 * R, 0, TAU); c.fill();
  }
  if (look.style === 'vent') { // longues mèches tirées vers l'arrière par la course
    for (let k = 0; k < 4; k++) {
      const y0 = (-0.75 + k * 0.28) * R, len = (0.9 + speed * 0.08) * R, wv = Math.sin(t * 10 + k) * 0.12 * R;
      c.beginPath(); c.moveTo(-0.3 * W, y0); c.bezierCurveTo(-0.9 * W, y0 - 0.1 * R + wv, -W - len * 0.6, y0 + 0.2 * R - wv, -W - len, y0 + 0.35 * R + wv); c.bezierCurveTo(-W - len * 0.5, y0 + 0.4 * R, -0.8 * W, y0 + 0.3 * R, -0.2 * W, y0 + 0.25 * R); c.closePath();
      blob(c, k % 2 ? h : tone(h, 0.82), 0.04);
    }
  }
}
function frontHair(c, R, W, look, t) {
  const h = look.hair;
  if (look.style === 'crete') {
    c.beginPath(); c.ellipse(0, 0, W * 1.01, R * 1.01, 0, Math.PI * 0.92, Math.PI * 1.62); c.quadraticCurveTo(-0.05 * W, -0.55 * R, -0.55 * W, 0.05 * R); c.closePath(); blob(c, h);
    c.beginPath(); const n = 7;
    for (let k = 0; k <= n; k++) {
      const a = Math.PI * (1.1 + (k / n) * 0.72), r0 = 0.9, r1 = 1.35 + (k % 2 ? 0 : 0.1) - Math.abs(k - n / 2) * 0.035;
      if (!k) c.moveTo(Math.cos(a) * r0 * W, Math.sin(a) * r0 * R);
      c.lineTo(Math.cos(a + 0.06) * r1 * W, Math.sin(a + 0.06) * r1 * R + Math.sin(t * 8 + k) * 0.01);
      if (k < n) c.lineTo(Math.cos(a + 0.2) * r0 * W, Math.sin(a + 0.2) * r0 * R);
    }
    c.closePath(); blob(c, h);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 0.03; c.beginPath(); c.arc(0, 0, R * 1.08, Math.PI * 1.35, Math.PI * 1.6); c.stroke();
  } else if (look.style === 'tresses') {
    c.beginPath(); c.ellipse(-0.04 * W, -0.06 * R, W * 1.04, R * 0.99, 0, Math.PI * 0.72, Math.PI * 1.8); c.quadraticCurveTo(0.25 * W, -0.74 * R, -0.2 * W, -0.54 * R); c.quadraticCurveTo(-0.5 * W, -0.3 * R, -0.66 * W, 0.42 * R); c.closePath(); blob(c, h);
    c.strokeStyle = '#ff4fa3'; c.lineWidth = 0.11 * R; c.beginPath(); c.ellipse(-0.05 * W, -0.06 * R, W * 0.9, R * 0.86, 0, Math.PI * 1.15, Math.PI * 1.68); c.stroke();
    for (let k = 0; k < 4; k++) { const an = Math.PI * (1.2 + k * 0.14); c.beginPath(); c.arc(Math.cos(an) * W * 1.0, Math.sin(an) * R - 0.04 * R, 0.14 * R, 0, TAU); blob(c, h, 0.035); }
  } else if (look.style === 'bonnet') {
    for (const [x, y] of [[-0.8, -0.2], [-0.95, 0.05], [0.55, -0.42]]) { c.beginPath(); c.moveTo(x * W, y * R); c.lineTo((x + 0.12) * W, (y + 0.22) * R); c.lineTo((x + 0.25) * W, (y - 0.02) * R); c.closePath(); blob(c, h, 0.035); }
    c.beginPath(); c.ellipse(0, -0.05 * R, W * 1.05, R * 1.03, 0, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); blob(c, '#2f7de1');
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.16 * R; c.beginPath(); c.moveTo(-1.02 * W, -0.12 * R); c.quadraticCurveTo(0, -0.28 * R, 1.02 * W, -0.12 * R); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 0.035; c.beginPath(); c.moveTo(-1.02 * W, -0.04 * R); c.quadraticCurveTo(0, -0.2 * R, 1.02 * W, -0.04 * R); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 4; k++) c.fillRect((-0.6 + k * 0.32) * W, -0.85 * R, 0.08 * W, 0.4 * R);
    c.beginPath(); c.arc(0, -1.12 * R, 0.22 * R, 0, TAU); blob(c, '#ffffff', 0.04);
  } else if (look.style === 'queue') {
    c.beginPath(); c.ellipse(0, -0.02 * R, W * 1.03, R * 1.0, 0, Math.PI * 0.78, Math.PI * 1.88);
    for (let k = 0; k < 4; k++) c.lineTo((0.75 - k * 0.3) * W, (-0.32 - (k % 2) * 0.16) * R); // frange en zigzag
    c.quadraticCurveTo(-0.5 * W, -0.25 * R, -0.62 * W, 0.35 * R); c.closePath(); blob(c, h);
    c.strokeStyle = '#2bd28f'; c.lineWidth = 0.1 * R; c.beginPath(); c.ellipse(0, -0.02 * R, W * 0.96, R * 0.94, 0, Math.PI * 1.25, Math.PI * 1.72); c.stroke();
  } else if (look.style === 'casquette') {
    c.beginPath(); c.ellipse(0, 0, W * 1.02, R * 1.0, 0, Math.PI * 0.85, Math.PI * 1.3); c.lineTo(-0.3 * W, -0.3 * R); c.closePath(); blob(c, h);
    c.beginPath(); c.ellipse(-1.0 * W, -0.32 * R, 0.5 * R, 0.12 * R, 0.15, 0, TAU); blob(c, '#b81f3a'); // visière à l'envers
    c.beginPath(); c.ellipse(0, -0.2 * R, W * 1.04, R * 0.98, 0, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); blob(c, '#ff3b55');
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(0.3 * W, -0.8 * R, 0.3 * W, 0.1 * R, -0.3, 0, TAU); c.fill();
    c.beginPath(); c.arc(0, -1.15 * R, 0.08 * R, 0, TAU); blob(c, '#ff3b55', 0.03);
  } else if (look.style === 'afro') {
    c.beginPath(); c.ellipse(0, 0, W * 1.02, R * 1.0, 0, Math.PI * 1.05, Math.PI * 1.75); c.quadraticCurveTo(0.2 * W, -0.62 * R, -0.5 * W, -0.35 * R); c.closePath(); blob(c, h);
    for (const x of [-0.25, 0.25]) { c.beginPath(); c.roundRect((x - 0.2) * W, -1.32 * R, 0.4 * W, 0.24 * R, 0.1 * R); blob(c, '#111', 0.04); } // lunettes posées sur l'afro
    c.strokeStyle = '#ffd23f'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(-0.05 * W, -1.22 * R); c.lineTo(0.05 * W, -1.22 * R); c.stroke();
  } else if (look.style === 'chauve') {
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(0.1 * W, -0.72 * R, 0.3 * W, 0.1 * R, -0.25, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.48 * W, -0.55 * R, 0.08 * W, 0.05 * R, -0.6, 0, TAU); c.fill();
  } else if (look.style === 'vent') {
    c.beginPath(); c.ellipse(0, 0, W * 1.03, R * 1.0, 0, Math.PI * 0.9, Math.PI * 1.85); c.quadraticCurveTo(0.3 * W, -0.5 * R, -0.3 * W, -0.45 * R); c.quadraticCurveTo(-0.6 * W, -0.2 * R, -0.7 * W, 0.3 * R); c.closePath(); blob(c, h);
    c.strokeStyle = INK; c.lineWidth = 0.08 * R; c.beginPath(); c.ellipse(0, -0.05 * R, W * 0.98, R * 0.92, 0, Math.PI * 1.2, Math.PI * 1.85); c.stroke(); // sangle
    for (const x of [0.25, 0.68]) { c.beginPath(); c.arc(x * W, -0.58 * R, 0.17 * R, 0, TAU); blob(c, '#ffb547', 0.045); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x * W + 0.05 * R, -0.63 * R, 0.05 * R, 0, TAU); c.fill(); }
  }
}
function accessory(c, R, W, acc, t, side) {
  if (!acc || acc === 'aucun') return;
  if (acc === 'casquette') { c.beginPath(); c.ellipse(0, -0.22 * R, W * 1.05, R * 0.97, 0, Math.PI, TAU); c.closePath(); blob(c, TEAM[side]); c.beginPath(); c.ellipse(0.95 * W, -0.3 * R, 0.5 * R, 0.11 * R, -0.12, 0, TAU); blob(c, TEAM_D[side]); }
  if (acc === 'bandana') { c.strokeStyle = '#e8263c'; c.lineWidth = 0.2 * R; c.beginPath(); c.ellipse(0, -0.1 * R, W * 0.99, R * 0.9, 0, Math.PI * 1.08, Math.PI * 1.9); c.stroke(); c.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { const a = Math.PI * (1.15 + k * 0.15); c.beginPath(); c.arc(Math.cos(a) * W * 0.99, Math.sin(a) * R * 0.9 - 0.1 * R, 0.035 * R, 0, TAU); c.fill(); } c.beginPath(); c.moveTo(-0.95 * W, -0.25 * R); c.lineTo(-1.35 * W, -0.05 * R + Math.sin(t * 8) * 0.05); c.lineTo(-1.25 * W, 0.15 * R); c.closePath(); blob(c, '#e8263c', 0.035); }
  if (acc === 'lunettes') { for (const x of [0.12, 0.58]) { c.beginPath(); c.roundRect((x - 0.22) * W, -0.2 * R, 0.44 * W, 0.3 * R, 0.1 * R); blob(c, '#14121e', 0.04); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo((x - 0.12) * W, -0.13 * R); c.lineTo((x + 0.02) * W, -0.13 * R); c.stroke(); } c.strokeStyle = INK; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0.34 * W, -0.08 * R); c.lineTo(0.36 * W, -0.08 * R); c.moveTo(-0.1 * W, -0.08 * R); c.lineTo(-0.55 * W, -0.02 * R); c.stroke(); }
  if (acc === 'cornes') for (const x of [-0.45, 0.35]) { c.beginPath(); c.moveTo((x - 0.13) * W, -0.86 * R); c.quadraticCurveTo((x - 0.05) * W, -1.45 * R, (x + 0.2) * W, -1.4 * R); c.quadraticCurveTo((x + 0.05) * W, -1.2 * R, (x + 0.13) * W, -0.88 * R); c.closePath(); blob(c, '#e8263c', 0.04); }
  if (acc === 'aureole') { const y = -1.45 * R + Math.sin(t * 3) * 0.04; c.strokeStyle = INK; c.lineWidth = 0.13 * R; c.beginPath(); c.ellipse(0, y, 0.55 * W, 0.15 * R, 0, 0, TAU); c.stroke(); c.strokeStyle = '#ffe14a'; c.lineWidth = 0.08 * R; c.stroke(); }
  if (acc === 'couronne') { c.beginPath(); c.moveTo(-0.5 * W, -0.88 * R); c.lineTo(-0.55 * W, -1.4 * R); c.lineTo(-0.25 * W, -1.15 * R); c.lineTo(0, -1.5 * R); c.lineTo(0.25 * W, -1.15 * R); c.lineTo(0.55 * W, -1.4 * R); c.lineTo(0.5 * W, -0.88 * R); c.closePath(); blob(c, '#ffd23f', 0.045); for (const [x, col] of [[-0.3, '#ff3b55'], [0, '#3d8bff'], [0.3, '#2bd28f']]) { c.beginPath(); c.arc(x * W, -1.0 * R, 0.06 * R, 0, TAU); blob(c, col, 0.025); } }
}
function head(c, R, look, side, mood, lx, ly, blink, t, swing, speed, acc) {
  const W = R * look.wide;
  backHair(c, R, W, look, t, swing, speed);
  // peau : aplat, ombre franche côté nuque, reflet
  c.save(); headPath(c, look, W, R); c.fillStyle = look.shade; c.fill(); c.clip();
  c.fillStyle = look.skin; c.beginPath(); c.ellipse(0.14 * W, -0.1 * R, W * 0.94, R * 0.93, 0, 0, TAU); c.fill();
  c.restore();
  headPath(c, look, W, R); c.strokeStyle = INK; c.lineWidth = 0.055; c.stroke();
  c.beginPath(); c.ellipse(-0.6 * W, 0.12 * R, 0.14 * R, 0.19 * R, 0, 0, TAU); blob(c, look.skin, 0.045); // oreille
  c.strokeStyle = look.shade; c.lineWidth = 0.035; c.beginPath(); c.arc(-0.6 * W, 0.12 * R, 0.07 * R, -1, 1.6); c.stroke();
  if (look.style === 'chauve') { // barbe (avant la bouche)
    c.beginPath(); c.moveTo(-0.55 * W, 0.0); c.quadraticCurveTo(-0.5 * W, 0.95 * R, 0.25 * W, 0.98 * R); c.quadraticCurveTo(0.85 * W, 0.85 * R, 0.92 * W, 0.25 * R); c.lineTo(0.75 * W, 0.3 * R); c.quadraticCurveTo(0.45 * W, 0.28 * R, 0.25 * W, 0.4 * R); c.quadraticCurveTo(-0.15 * W, 0.3 * R, -0.38 * W, 0.0); c.closePath(); blob(c, look.hair);
  }
  frontHair(c, R, W, look, t);
  // joues, taches de rousseur
  c.fillStyle = 'rgba(255,105,120,.4)'; c.beginPath(); c.ellipse(0.62 * W, 0.32 * R, 0.15 * R, 0.09 * R, 0, 0, TAU); c.fill();
  if (look.freckles) { c.fillStyle = tone(look.shade, 0.75); for (const [x, y] of [[0.5, 0.2], [0.6, 0.25], [0.55, 0.32], [0.08, 0.25]]) { c.beginPath(); c.arc(x * W, y * R, 0.025 * R, 0, TAU); c.fill(); } }
  // yeux : grands, ronds, deux reflets
  const eyes = [[0.12 * W, 0.92], [0.58 * W, 0.82]], ey = -0.04 * R;
  for (const [ex, sq] of eyes) {
    const rx = 0.19 * R * sq, ry = 0.25 * R;
    if (mood === 'dizzy') { c.strokeStyle = INK; c.lineWidth = 0.055; c.beginPath(); c.moveTo(ex - rx, ey - ry * 0.6); c.lineTo(ex + rx, ey + ry * 0.6); c.moveTo(ex - rx, ey + ry * 0.6); c.lineTo(ex + rx, ey - ry * 0.6); c.stroke(); continue; }
    if (blink || mood === 'joy') { c.strokeStyle = INK; c.lineWidth = 0.055; c.lineCap = 'round'; c.beginPath(); mood === 'joy' ? c.arc(ex, ey + ry * 0.35, rx, Math.PI * 1.15, Math.PI * 1.85) : c.arc(ex, ey, rx, 0.25, Math.PI - 0.25); c.stroke(); continue; }
    const open = mood === 'oh' || mood === 'shout' || mood === 'cold' ? 1.1 : mood === 'grit' || mood === 'focus' ? 0.8 : 1;
    c.beginPath(); c.ellipse(ex, ey, rx, ry * open, 0, 0, TAU); blob(c, '#ffffff', 0.04);
    const px = ex + lx * rx * 0.42, py = ey + ly * ry * 0.4 * open;
    c.fillStyle = look.iris; c.beginPath(); c.arc(px, py, 0.135 * R * sq, 0, TAU); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(px, py, 0.075 * R * sq, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px + 0.04 * R, py - 0.05 * R, 0.045 * R, 0, TAU); c.fill(); c.beginPath(); c.arc(px - 0.04 * R, py + 0.04 * R, 0.02 * R, 0, TAU); c.fill();
    if (mood === 'grit' || mood === 'focus' || mood === 'evil') { c.fillStyle = look.skin; c.beginPath(); c.ellipse(ex, ey - ry * 0.98, rx * 1.2, ry * 0.42, 0, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.035; c.beginPath(); c.ellipse(ex, ey - ry * 0.98, rx * 1.05, ry * 0.42, 0, 0.2, Math.PI - 0.2); c.stroke(); }
    if (look.lashes) { c.strokeStyle = INK; c.lineWidth = 0.03; c.beginPath(); c.moveTo(ex + rx * 0.7, ey - ry * 0.7); c.lineTo(ex + rx * 1.05, ey - ry * 0.95); c.stroke(); }
    if (mood === 'sad') { c.fillStyle = 'rgba(110,200,255,.9)'; c.beginPath(); c.ellipse(ex + rx * 0.4, ey + ry * 1.3 + ((t * 0.8) % 1) * 0.3 * R, 0.045 * R, 0.075 * R, 0, 0, TAU); c.fill(); }
  }
  // sourcils
  const tilt = { grit: 0.35, focus: 0.25, evil: 0.45, sad: -0.4, oh: -0.15, shout: 0.2, ouch: -0.3, cold: -0.3 }[mood] ?? 0;
  c.strokeStyle = look.style === 'bonnet' ? '#8fd0f0' : look.style === 'chauve' ? look.hair : tone(look.hair === '#d8f2ff' ? '#6aa' : look.hair, 0.9); c.lineWidth = 0.1 * R; c.lineCap = 'round';
  for (const [ex, sq] of eyes) { const y0 = ey - 0.36 * R - (mood === 'oh' ? 0.06 * R : 0), dir = ex > 0.35 * W ? -1 : 1; c.beginPath(); c.moveTo(ex - 0.14 * R * sq, y0 - tilt * 0.08 * R * dir); c.lineTo(ex + 0.14 * R * sq, y0 + tilt * 0.08 * R * dir); c.stroke(); }
  // nez qui dépasse un peu du profil
  c.beginPath(); c.ellipse(0.86 * W, 0.12 * R, 0.13 * R, 0.11 * R, 0, -1.6, 1.9); blob(c, look.skin, 0.04);
  // bouche
  const mx = 0.5 * W, my = 0.48 * R;
  if (look.stache) { c.beginPath(); c.ellipse(mx + 0.12 * R, my - 0.15 * R, 0.24 * R, 0.08 * R, -0.12, 0, TAU); blob(c, look.hair, 0.035); }
  c.strokeStyle = INK; c.lineWidth = 0.045; c.lineCap = 'round';
  if (mood === 'shout' || mood === 'oh' || mood === 'ouch' || mood === 'cold') {
    const big = mood === 'shout' ? 1 : 0.6;
    c.beginPath(); c.ellipse(mx, my + 0.03 * R, 0.14 * R * big, 0.16 * R * big, 0, 0, TAU); blob(c, '#6a1424', 0.04);
    c.fillStyle = '#ff6d84'; c.beginPath(); c.ellipse(mx, my + 0.1 * R * big, 0.08 * R * big, 0.05 * R * big, 0, 0, TAU); c.fill();
  } else if (mood === 'joy' || mood === 'evil') {
    c.beginPath(); c.moveTo(mx - 0.24 * R, my - 0.04 * R); c.quadraticCurveTo(mx, my + 0.4 * R, mx + 0.22 * R, my - 0.06 * R); c.closePath(); blob(c, '#6a1424', 0.04);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx - 0.2 * R, my - 0.03 * R); c.lineTo(mx + 0.18 * R, my - 0.05 * R); c.lineTo(mx + 0.16 * R, my + 0.05 * R); c.lineTo(mx - 0.18 * R, my + 0.06 * R); c.closePath(); c.fill();
    c.fillStyle = '#ff6d84'; c.beginPath(); c.ellipse(mx, my + 0.2 * R, 0.08 * R, 0.05 * R, 0, 0, TAU); c.fill();
  } else if (mood === 'grit') {
    c.beginPath(); c.roundRect(mx - 0.18 * R, my - 0.06 * R, 0.36 * R, 0.13 * R, 0.05 * R); blob(c, '#fff', 0.04);
    c.lineWidth = 0.02; c.beginPath(); c.moveTo(mx - 0.18 * R, my); c.lineTo(mx + 0.18 * R, my); c.stroke();
  } else if (mood === 'sad') { c.beginPath(); c.arc(mx, my + 0.16 * R, 0.14 * R, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
  else if (mood === 'dizzy') { c.beginPath(); c.moveTo(mx - 0.15 * R, my); for (let k = 1; k <= 6; k++) c.lineTo(mx - 0.15 * R + k * 0.05 * R, my + (k % 2 ? 0.05 : -0.03) * R); c.stroke(); }
  else {
    c.beginPath(); c.arc(mx, my - 0.12 * R, 0.19 * R, Math.PI * 0.18, Math.PI * 0.82); c.stroke();
    if (look.gap) { c.fillStyle = '#fff'; c.fillRect(mx - 0.05 * R, my + 0.02 * R, 0.07 * R, 0.06 * R); c.strokeRect(mx - 0.05 * R, my + 0.02 * R, 0.07 * R, 0.06 * R); }
  }
  if (look.style === 'afro') { c.beginPath(); c.ellipse(mx + 0.02 * R, my + 0.3 * R, 0.08 * R, 0.07 * R, 0, 0, TAU); blob(c, look.hair, 0.03); } // bouc
  accessory(c, R, W, acc, t, side);
}

// Pose selon l'état, puis dessin dans le repère local (pieds en 0,0, y vers le bas, tourné vers +x).
function drawPlayer(c, P, a, t, rel) {
  const look = LOOKS[P.char] ?? LOOKS.bouboule, side = P.side;
  const R0 = CC.CHARS[P.char].head * (P.power === 'tete' ? 2 : 1) * (P.big > 0 ? 1.6 : 1) * (P.mini > 0 ? 0.55 : 1);
  const hy0 = HEAD.y * (P.power === 'tete' ? 1.2 : 1) * (P.big > 0 ? 1.1 : 1) * (P.mini > 0 ? 0.7 : 1);
  const bk = P.mini > 0 ? 0.7 : 1, R = R0 / bk * a.headK, hy = hy0 / bk;
  const fwd = P.vx * (side ? -1 : 1), speed = Math.abs(P.vx);
  let L1 = 0.08, K1 = 0.1, L2 = -0.08, K2 = 0.1, A1 = -0.2, B1 = -0.5, A2 = 0.2, B2 = -0.4, lean = 0, rot = 0, lift = Math.sin(t * 3 + a.seed) * 0.015, mood = 'smile', sq = a.squash;
  if (P.ground && speed > 0.4) { // course
    const amp = Math.min(1, speed / 6) * (P.sprint ? 1.25 : 1), s = Math.sin(a.phase);
    L1 = s * 1.0 * amp; L2 = -L1; K1 = 0.2 + Math.max(0, -s) * 1.3 * amp; K2 = 0.2 + Math.max(0, s) * 1.3 * amp;
    A1 = -s * 1.1 * amp; A2 = s * 1.1 * amp; B1 = B2 = -1.2;
    lean = Math.sign(fwd) * (P.sprint ? 0.26 : 0.1) * amp; lift = Math.abs(Math.cos(a.phase)) * 0.07 * amp;
    if (fwd < 0) { L1 = -L1; L2 = -L2; }
  }
  if (!P.ground) { const up = P.vy > 0; L1 = 0.7; K1 = up ? 1.4 : 0.6; L2 = 0.1; K2 = up ? 1.1 : 0.3; A1 = -2.6; A2 = -2.2; B1 = B2 = 0.3; mood = 'oh'; }
  if (P.charge > 0.05) { const k = P.charge / CC.CHARGE; L1 = -0.7 - k * 0.5; K1 = 1.0 + k * 0.4; A1 = 1.0; A2 = -1.2; lean = -0.1 - k * 0.1; mood = 'grit'; lift += Math.sin(t * 40) * 0.01 * k; }
  if (P.kickT > 0) { // tir : la jambe avant arme puis fouette
    const u = 1 - P.kickT / 0.22, air = !P.ground, top = air ? 2.2 : 1.6;
    L1 = u < 0.3 ? -0.9 * (u / 0.3) : -0.9 + Math.min(1, (u - 0.3) / 0.3) * (0.9 + top); K1 = u < 0.3 ? 1.2 : Math.max(0, 1.2 - (u - 0.3) * 5);
    L2 = -0.15; K2 = 0.2; A1 = -1.3; A2 = 1.4; B1 = -0.3; B2 = -0.6; lean = -0.15; mood = 'shout';
    if (air) { rot = -0.45 * Math.sin(u * Math.PI); L2 = 0.6; K2 = 1.2; }
    if (P.kind === 'retourne') { rot = -Math.PI * 1.1 * Math.min(1, u * 1.4); L1 = 2.6; K1 = 0; L2 = 1.2; K2 = 1.0; }
    if (P.kind === 'plongeon') { rot = 1.25; L1 = -0.3; L2 = -0.5; K1 = K2 = 0.3; A1 = -2.8; A2 = -2.6; }
  }
  if (P.tackleT > 0) { rot = -1.05; L1 = 1.5; K1 = 0; L2 = 0.4; K2 = 1.4; A1 = 2.6; A2 = 2.2; B1 = B2 = 0.2; mood = 'grit'; lift = 0; }
  if (P.stun > 0) { rot = -1.45; L1 = 1.2; K1 = 0.4; L2 = 0.8; K2 = 0.9; A1 = 2.8; A2 = -2.6; B1 = B2 = 0.6; mood = 'dizzy'; lift = 0; }
  // contrôle : le ballon arrive doucement contre le joueur
  if (P.ground && !P.kickT && P.stun <= 0 && P.tackleT <= 0 && !P.charge && rel && Math.hypot(rel.x, rel.y - 0.8) < 1.3 && rel.sp < 6) { A1 = -0.9; A2 = 1.0; B1 = B2 = -0.6; mood = 'focus'; }
  if (P.sprint && P.ground && !P.kickT) mood = 'grit';
  else if (P.power && mood === 'smile') mood = 'evil';
  else if (mood === 'smile' && rel && Math.hypot(rel.x, rel.y) < 3) mood = 'focus';
  if (a.bump > 0 && mood !== 'dizzy') mood = 'ouch';
  if (P.frozen > 0) { mood = 'cold'; L1 = 0.1; L2 = -0.1; K1 = K2 = 0.1; A1 = -0.4; A2 = 0.5; lift = 0; }
  if (a.cele === 'win') { mood = 'joy'; A1 = -2.8 + Math.sin(t * 12) * 0.2; A2 = -2.6 - Math.sin(t * 12) * 0.2; B1 = B2 = 0.2; lift = Math.abs(Math.sin(t * 7)) * 0.5; L1 = 0.3; K1 = 0.9; }
  if (a.cele === 'sad') { mood = 'sad'; A1 = 0.1; A2 = -0.05; B1 = B2 = -0.1; lean = 0.25; }
  c.save();
  c.scale(bk, bk);
  c.translate(0, -lift); c.scale(1 + sq * 0.6, 1 - sq);
  c.translate(0, -0.6); c.rotate(rot); c.translate(0, 0.6);
  arm(c, -0.08, -0.9, A2, B2, side, look, 0.78); leg(c, -0.07, -0.38, L2, K2, side, look, 0.78);
  torso(c, side, look, lean, t, speed);
  leg(c, 0.07, -0.38, L1, K1, side, look, 1);
  c.save(); c.rotate(lean); arm(c, 0.08, -0.88, A1, B1, side, look, 1); c.restore();
  const sad = a.cele === 'sad';
  c.save(); c.translate(Math.sin(lean) * 1.3, -hy + (sad ? 0.1 : 0)); c.rotate(lean * 0.5 + (sad ? 0.35 : 0));
  const dd = rel ? Math.hypot(rel.x, rel.y - 1.5) + 0.5 : 1, lx = clamp(rel ? rel.x / dd : 0.6, -1, 1), ly = clamp(rel ? -(rel.y - 1.5) / dd : 0, -1, 1);
  head(c, R, look, side, mood, lx, ly, a.blink > 0, t, clamp(-fwd * 0.06, -0.4, 0.4), speed, P.acc);
  if (P.stun > 0) for (let k = 0; k < 3; k++) { const an = t * 5 + (k * TAU) / 3; star(c, Math.cos(an) * R * 0.9, -R * 1.05 + Math.sin(an) * R * 0.25, 0.1, '#ffe14a'); }
  c.restore();
  if (P.frozen > 0) { // bloc de glace
    c.fillStyle = 'rgba(170,230,255,.45)'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.05;
    c.beginPath(); c.roundRect(-R * 1.15, -hy - R * 1.2, R * 2.3, hy + R * 1.25, 0.15); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(-R * 0.8, -hy - R * 0.9); c.lineTo(-R * 0.3, -hy - R * 0.4); c.moveTo(R * 0.6, -0.3); c.lineTo(R * 0.9, -0.6); c.stroke();
  }
  c.restore();
}
function star(c, x, y, r, color) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); blob(c, color, 0.025);
}
const newAnim = () => ({ phase: 0, blink: 0, nextBlink: 2 + Math.random() * 3, squash: 0, wasGround: true, bump: 0, cele: null, celeT: 0, headK: 1, seed: Math.random() * 10 });
function tickAnim(a, P, dt) {
  a.phase += Math.abs(P.vx) * dt * 2.6;
  if ((a.nextBlink -= dt) <= 0) { a.blink = 0.13; a.nextBlink = 2 + Math.random() * 3.5; }
  a.blink -= dt;
  if (P.ground && !a.wasGround) a.squash = 0.18;
  a.wasGround = P.ground;
  a.squash *= Math.exp(-dt * 10);
  a.bump = Math.max(0, a.bump - dt);
  if (a.celeT > 0 && (a.celeT -= dt) <= 0) a.cele = null;
}

// Portrait pour les menus : le joueur en pied sous un projecteur, qui suit un ballon imaginaire.
export function drawPortrait(canvas, char, side = 0, t = 0, acc = 'aucun', locked = false) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.45, W * 0.6); g.addColorStop(0, 'rgba(255,240,200,.8)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(W / 2, H * 0.95, W * 0.22, H * 0.035, 0, 0, TAU); c.fill();
  const u = H / 2.7, a = newAnim(); a.seed = 0;
  c.save(); c.translate(W / 2, H * 0.95); c.scale(u, u);
  if (locked) c.filter = 'brightness(0.15) saturate(0)';
  drawPlayer(c, { char, side, acc, vx: 0, vy: 0, ground: true, kickT: 0, tackleT: 0, stun: 0, power: null }, a, t, { x: 1.5 + Math.sin(t) * 0.6, y: 2.4 + Math.cos(t * 1.3) * 0.4, sp: 99 });
  c.restore();
}

/* ================= Ballons ================= */
function drawBallSkin(c, r, ang, skin, t) {
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
  if (skin === 'plage') {
    for (let k = 0; k < 6; k++) { c.fillStyle = ['#ff4d4d', '#ffffff', '#ffd23f', '#ffffff', '#3d8bff', '#ffffff'][k]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, ang + (k * TAU) / 6, ang + ((k + 1) * TAU) / 6); c.closePath(); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(Math.cos(ang) * r * 0.1, Math.sin(ang) * r * 0.1, r * 0.18, 0, TAU); c.fill();
  } else if (skin === 'pixel') {
    c.rotate(ang); const n = 6, s = (2 * r) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 3 === 0 || (i === 2 && j === 3) ? '#1d1530' : '#f4f4f4'; c.fillRect(-r + i * s, -r + j * s, s + 0.5, s + 0.5); }
  } else if (skin === 'disco') {
    c.fillStyle = '#c8d0dc'; c.fillRect(-r, -r, 2 * r, 2 * r); c.rotate(ang * 0.5); const s = r / 3;
    for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) { c.fillStyle = `hsl(${(i * 40 + j * 70 + t * 120) % 360},70%,${55 + ((i * j + Math.floor(t * 6)) % 3) * 12}%)`; c.fillRect(i * s + 1, j * s + 1, s - 2, s - 2); }
  } else {
    const base = skin === 'feu' ? '#ff7a1a' : skin === 'or' ? '#ffd23f' : '#f8f8fb', patch = skin === 'feu' ? '#a31d0e' : skin === 'or' ? '#9a6a0a' : '#1d1530';
    c.fillStyle = base; c.fillRect(-r, -r, 2 * r, 2 * r); c.rotate(ang);
    const pent = (px, py, pr, rot) => { c.beginPath(); for (let k = 0; k < 5; k++) { const a = rot + (k * TAU) / 5; c.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr); } c.closePath(); c.fill(); };
    c.fillStyle = patch; pent(0, 0, r * 0.33, -Math.PI / 2);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * TAU) / 5 + Math.PI / 5; pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.32, a); }
    if (skin === 'feu') { c.fillStyle = 'rgba(255,230,120,.6)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(Math.cos(k * 1.7) * r * 0.5, Math.sin(k * 2.3) * r * 0.5, r * 0.12, 0, TAU); c.fill(); } }
  }
  c.restore();
  c.fillStyle = 'rgba(0,0,30,.22)'; c.beginPath(); c.arc(0, 0, r, 0.2, Math.PI * 1.15); c.arc(-r * 0.12, -r * 0.12, r * 0.9, Math.PI * 1.15, 0.2, true); c.fill(); // ombre franche
  c.strokeStyle = INK; c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.2, r * 0.11, -0.6, 0, TAU); c.fill();
}

/* ================= Stades ================= */
const THEMES = {
  nuit: { sky: ['#070b24', '#1d1a52', '#5a2f6e'], stars: true, moon: true, stand: ['#221a3e', '#3a2c5e'], seats: ['#3d3066', '#45377a'], pitch: ['#3f9e3c', '#4aae46'], line: '#ffffff', lights: true, rows: 16 },
  orage: { sky: ['#04060c', '#151c2a', '#2c3444'], rain: true, stand: ['#151a26', '#232a3a'], seats: ['#2a3246', '#323b52'], pitch: ['#2e7a36', '#368641'], line: '#e8f0ff', lights: true, rows: 16, wet: true },
  plage: { sky: ['#3a6fd8', '#ff8f5a', '#ffd59a'], sun: true, sea: true, stand: ['#8a5a32', '#b07a48'], seats: ['#c48a52', '#d39c62'], pitch: ['#efcf88', '#ecca82'], line: '#ffffff', rows: 9, palms: true, sand: true },
  neige: { sky: ['#7fb2e8', '#cfe6ff', '#f2f9ff'], mountains: true, snow: true, stand: ['#3a4a6a', '#4a5c80'], seats: ['#5a6e96', '#647aa4'], pitch: ['#f0f7ff', '#e2eefb'], line: '#e8394a', rows: 11, pines: true },
  toit: { sky: ['#1a1d48', '#b84c78', '#ffb36b'], city: true, stand: ['#2a2440', '#3a3256'], seats: ['#4a3f6a', '#55497a'], pitch: ['#3c9a5f', '#46a86a'], line: '#ffffff', rows: 7, bulbs: true },
};

export function createPitch(canvas) {
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas'), led = document.createElement('canvas');
  let W = 0, H = 0, dpr = 1, u = 40, cx = 0, gy = 0, yb = 0, topY = 0, standBot = 0, fans = [], screenBox = null, theme = THEMES.nuit, themeId = 'nuit', ballSkin = 'classique';
  const sx = x => cx + x * u, sy = y => gy - y * u;
  const anims = new Map(), parts = [], trails = new Map(), nets = [{ amp: 0, at: 0, y: 1 }, { amp: 0, at: 0, y: 1 }], drops = [];
  const exc = [0.08, 0.08];
  let shake = 0, flash = 0, flashColor = '#ffffff', ballAng = 0, demo = null, clock = 0, thunderAt = 6, olaAt = 30, bolt = 0;
  const api = { onThunder: null };

  let dG = 0.3;
  const sc = d => 1 + (d - dG) * 0.42;
  const P = (xw, d) => [cx + xw * u * sc(d), yb + d * (H - yb)];

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    u = Math.min(W / (2 * WALL + 2.2), H / 13.2);
    cx = W / 2; gy = H - Math.max(2.4 * u, H * 0.17); yb = gy - 1.15 * u; dG = (gy - yb) / (H - yb);
    standBot = yb - 0.8 * u; topY = Math.max(H * 0.1, gy - 11.5 * u);
    if (theme.rows < 12) topY = standBot - (standBot - topY) * (theme.rows / 16);
    buildBg(); buildLed(); buildFans();
    drops.length = 0;
    for (let k = 0; k < (theme.rain ? 260 : theme.snow ? 180 : 0); k++) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.6, s: 1 + Math.random() * 2 });
  }
  function setTheme(id) { if (!THEMES[id] || id === themeId) return; themeId = id; theme = THEMES[id]; resize(); }

  function buildBg() {
    bg.width = canvas.width; bg.height = canvas.height;
    const c = bg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); seed = 11;
    let g = c.createLinearGradient(0, 0, 0, standBot); theme.sky.forEach((col, k) => g.addColorStop(k / (theme.sky.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (theme.stars) for (let k = 0; k < 140; k++) { c.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; c.beginPath(); c.arc(rnd() * W, rnd() * topY, rnd() * 1.3 + 0.2, 0, TAU); c.fill(); }
    if (theme.moon) { c.fillStyle = 'rgba(255,245,220,.12)'; c.beginPath(); c.arc(W * 0.83, topY * 0.4, Math.max(24, u * 1.4), 0, TAU); c.fill(); c.fillStyle = '#fff5dc'; c.beginPath(); c.arc(W * 0.83, topY * 0.4, Math.max(10, u * 0.55), 0, TAU); c.fill(); }
    if (theme.sun) { const sy0 = topY * 0.85; for (const [r, a] of [[3, 0.15], [2, 0.25], [1.2, 1]]) { c.fillStyle = `rgba(255,${a === 1 ? 230 : 200},${a === 1 ? 140 : 120},${a})`; c.beginPath(); c.arc(W * 0.7, sy0, u * r, 0, TAU); c.fill(); } }
    if (theme.sea) { const y0 = topY - u * 0.2; c.fillStyle = '#2f7fd0'; c.fillRect(0, y0 - u * 1.2, W, u * 1.4); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; for (let k = 0; k < 30; k++) { const x = rnd() * W, y = y0 - rnd() * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 4, x + 16, y); c.stroke(); } }
    if (theme.mountains) for (const [col, h, off] of [['#8fb3d8', 5.5, 0], ['#6f93bd', 4, 0.5]]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, topY); for (let x = 0; x <= W + 60; x += u * 2.5) { const y = topY - u * (h * 0.5 + Math.abs(Math.sin(x / (u * 3.7) + off)) * h * 0.5); c.lineTo(x, y); } c.lineTo(W, topY); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; for (let x = 0; x <= W + 60; x += u * 2.5) { const y = topY - u * (h * 0.5 + Math.abs(Math.sin(x / (u * 3.7) + off)) * h * 0.5); c.beginPath(); c.moveTo(x - u * 0.5, y + u * 0.5); c.lineTo(x, y); c.lineTo(x + u * 0.5, y + u * 0.5); c.closePath(); c.fill(); } }
    if (theme.city) for (let x = 0; x < W; ) { const w = u * (1 + rnd() * 1.6), h = u * (2 + rnd() * 5); c.fillStyle = rnd() < 0.5 ? '#1c1838' : '#25204a'; c.fillRect(x, topY - h, w - 3, h); c.fillStyle = 'rgba(255,214,120,.8)'; for (let yy = topY - h + 6; yy < topY - 6; yy += 10) for (let xx = x + 5; xx < x + w - 9; xx += 9) if (rnd() < 0.4) c.fillRect(xx, yy, 4, 5); if (rnd() < 0.3) { c.fillStyle = '#1c1838'; c.fillRect(x + w / 2, topY - h - u * 0.8, 2, u * 0.8); } x += w; }
    if (theme.palms) for (const px of [0.08, 0.92, 0.3]) { const x = W * px, y0 = topY + 4; c.strokeStyle = '#5a3a1e'; c.lineWidth = u * 0.22; c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + u * 0.5, y0 - u * 2, x + u * 0.2, y0 - u * 3.5); c.stroke(); c.fillStyle = '#2e8a3a'; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; c.beginPath(); c.ellipse(x + u * 0.2 + Math.cos(a) * u * 0.9, y0 - u * 3.5 + Math.sin(a) * u * 0.5 + u * 0.3, u * 1.0, u * 0.22, a, 0, TAU); c.fill(); } }
    if (theme.pines) for (let k = 0; k < 9; k++) { const x = rnd() * W, h = u * (1.5 + rnd()); c.fillStyle = '#2b5a3c'; c.beginPath(); c.moveTo(x, topY - h); c.lineTo(x + h * 0.35, topY); c.lineTo(x - h * 0.35, topY); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, topY - h); c.lineTo(x + h * 0.12, topY - h * 0.65); c.lineTo(x - h * 0.12, topY - h * 0.65); c.closePath(); c.fill(); }
    // tribunes
    const rows = theme.rows, rowH = (standBot - topY) / rows;
    g = c.createLinearGradient(0, topY, 0, standBot); g.addColorStop(0, theme.stand[0]); g.addColorStop(1, theme.stand[1]);
    c.fillStyle = g; c.fillRect(0, topY - 4, W, standBot - topY + 4);
    for (let r = 0; r < rows; r++) { const y = standBot - r * rowH; c.fillStyle = theme.seats[r % 2]; c.fillRect(0, y - rowH * 0.42, W, rowH * 0.42); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, y - rowH * 0.42, W, 1.5); }
    for (let k = 1; k < 8; k++) { const x = (k / 8) * W; c.fillStyle = tone(theme.seats[1], 1.25); c.fillRect(x - rowH * 0.35, topY, rowH * 0.7, standBot - topY); }
    if (theme.lights) {
      c.fillStyle = '#14102a'; c.fillRect(0, topY - u * 0.9, W, u * 0.9);
      c.strokeStyle = '#2e2752'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < W + 40; x += u * 0.9) { c.moveTo(x, topY - u * 0.9); c.lineTo(x + u * 0.45, topY); c.lineTo(x + u * 0.9, topY - u * 0.9); } c.stroke();
      c.fillStyle = '#ffd23f'; c.fillRect(0, topY - 3, W, 3);
      for (const fx of [0.1, 0.34, 0.66, 0.9]) { c.fillStyle = '#1a1533'; c.fillRect(fx * W - 3, topY - u * 2.4, 6, u * 1.6); c.fillStyle = '#2b2450'; c.beginPath(); c.roundRect(fx * W - u * 1.3, topY - u * 3.2, u * 2.6, u * 1.05, 6); c.fill(); }
      screenBox = { x: cx - 3 * u, y: topY + 0.15 * u, w: 6 * u, h: 1.8 * u };
    } else screenBox = { x: cx - 2.6 * u, y: topY - 2.3 * u, w: 5.2 * u, h: 1.6 * u };
    if (theme.bulbs) { c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); for (let x = 0; x < W; x += u * 3) { c.moveTo(x, topY - u * 0.4); c.quadraticCurveTo(x + u * 1.5, topY + u * 0.3, x + u * 3, topY - u * 0.4); } c.stroke(); }
    c.fillStyle = tone(theme.stand[0], 0.7); c.fillRect(0, standBot, W, yb - standBot);
    // pelouse (ou sable, ou neige) en bandes, en perspective
    for (let k = -14; k < 14; k++) { const x0 = k * 2.3, x1 = x0 + 2.3, a = P(x0, 0), b = P(x1, 0), cc = P(x1, 1), d = P(x0, 1); c.fillStyle = theme.pitch[k & 1]; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...cc); c.lineTo(...d); c.closePath(); c.fill(); }
    for (let k = 0; k < 4000; k++) { const x = rnd() * W, y = yb + rnd() * (H - yb); c.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 2, y - 2 - rnd() * 3); c.stroke(); }
    if (theme.sand) for (let k = 0; k < 9000; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(160,110,40,.18)' : 'rgba(255,255,255,.25)'; c.fillRect(rnd() * W, yb + rnd() * (H - yb), 1.5, 1.5); }
    if (theme.wet) for (let k = 0; k < 14; k++) { c.fillStyle = 'rgba(160,190,255,.12)'; c.beginPath(); c.ellipse(rnd() * W, yb + rnd() * (H - yb), u * (0.5 + rnd()), u * 0.12, 0, 0, TAU); c.fill(); }
    g = c.createLinearGradient(0, yb, 0, H); g.addColorStop(0, 'rgba(0,25,10,.35)'); g.addColorStop(dG, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,.3)'); c.fillStyle = g; c.fillRect(0, yb, W, H - yb);
    c.strokeStyle = theme.line; c.globalAlpha = 0.88; c.lineCap = 'round';
    const line = (pts, wd = 2.5) => { c.lineWidth = wd; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.stroke(); };
    const dB = 0.06, dF = 0.9, HL = F.HL;
    line([P(-HL, dB), P(HL, dB)]); line([P(-HL, dF), P(HL, dF)], 3.5); line([P(-HL, dB), P(-HL, dF)], 3); line([P(HL, dB), P(HL, dF)], 3); line([P(0, dB), P(0, dF)], 3);
    for (const s of [-1, 1]) { line([P(s * HL, 0.2), P(s * (HL - 3.6), 0.2), P(s * (HL - 3.6), 0.78), P(s * HL, 0.78)], 3); line([P(s * HL, 0.33), P(s * (HL - 1.4), 0.33), P(s * (HL - 1.4), 0.64), P(s * HL, 0.64)], 3); }
    const [ccx, ccy] = P(0, (dB + dF) / 2); c.lineWidth = 3; c.beginPath(); c.ellipse(ccx, ccy, 2.4 * u * sc(0.48), (dF - dB) * (H - yb) * 0.3, 0, 0, TAU); c.stroke();
    c.globalAlpha = 1;
    c.save(); c.translate(ccx, ccy); c.scale(1, 0.28); c.font = `900 ${Math.round(u * 1.1)}px "Baloo 2", Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.14)'; c.fillText('CABOCHE CUP', 0, 0); c.restore();
  }

  function buildLed() {
    const h = Math.max(16, Math.round(0.72 * u * dpr)), ads = [['CABOCHE CUP', '#ffd23f', '#1a1240'], ['⚽ GROSSES TÊTES, GROS BUTS', '#ffffff', '#c8202a'], ['LE CERCLE', '#1a1240', '#3dd8ff'], ['🔥 SUPER TIR', '#ffe14a', '#ff6a1a'], ['TÊTE GÉANTE 🎈', '#ffffff', '#7a3dff']];
    const segW = h * 7.5; led.width = Math.round(segW * ads.length); led.height = h;
    const c = led.getContext('2d');
    ads.forEach(([txt, fg, b], k) => { c.fillStyle = b; c.fillRect(k * segW, 0, segW, h); c.fillStyle = fg; c.font = `900 ${Math.round(h * 0.52)}px "Baloo 2", Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, k * segW + segW / 2, h * 0.54, segW - h * 0.6); });
    for (let y = 0; y < h; y += 3) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, y, led.width, 1); }
  }

  function buildFans() {
    seed = 99; fans = [];
    const rows = theme.rows, rowH = (standBot - topY) / rows, step = rowH * 0.8;
    const skins = ['#f2c49b', '#e0a878', '#b57a4f', '#8a5634', '#5e3a22', '#ffd8b8'], hairs = ['#2a1c14', '#6b3a1f', '#d9a441', '#111111', '#c8323a', '#eeeeee'];
    for (let r = rows - 1; r >= 0; r--) for (let x = step / 2; x < W; x += step) {
      const fr = ((x / W) * 8) % 1, aisle = (rowH * 0.5) / (W / 8);
      if (fr < aisle || fr > 1 - aisle) continue; // escaliers
      const y = standBot - r * rowH;
      if (theme.lights && screenBox && x > screenBox.x - 8 && x < screenBox.x + screenBox.w + 8 && y - rowH < screenBox.y + screenBox.h) continue;
      if (rnd() < 0.06) continue;
      const side = x < cx ? (rnd() < 0.8 ? 0 : 1) : rnd() < 0.8 ? 1 : 0, pick = rnd();
      const shirt = pick < 0.65 ? TEAM[side] : pick < 0.8 ? '#ffffff' : pick < 0.9 ? TEAM_D[side] : ['#ffd23f', '#2bd28f', '#ff8a3d'][Math.floor(rnd() * 3)];
      fans.push({ x: x + (rnd() - 0.5) * step * 0.3, y, h: rowH * (1.05 + rnd() * 0.2), side, shirt, skin: skins[Math.floor(rnd() * skins.length)], hair: hairs[Math.floor(rnd() * hairs.length)], ph: rnd() * TAU, en: rnd(), scarf: rnd() < 0.12, flag: rnd() < 0.004, cap: themeId === 'neige' ? rnd() < 0.6 : rnd() < 0.15 });
    }
  }

  function drawFans(c, t) {
    const olaX = ((t - olaAt) / 4) * (W + 200) - 100, ola = t > olaAt && olaX < W + 100;
    if (t > olaAt + 4.5) olaAt = t + 30 + Math.random() * 20;
    for (const f of fans) {
      const e = exc[f.side], wave = ola ? Math.max(0, 1 - Math.abs(f.x - olaX) / 90) : 0;
      const hop = (e > 0.35 ? Math.abs(Math.sin(t * (7 + f.en * 3) + f.ph)) * f.h * 0.32 * e : 0) + wave * f.h * 0.45;
      const bob = Math.sin(t * (2.5 + f.en * 2) + f.ph) * f.h * 0.03, y = f.y + bob - hop, h = f.h;
      const arms = e > 0.3 || wave > 0.2 || (f.en > 0.85 && Math.sin(t * 2 + f.ph) > 0.6);
      if (arms) { c.strokeStyle = f.shirt; c.lineWidth = h * 0.12; c.lineCap = 'round'; const wv = Math.sin(t * 10 + f.ph) * h * 0.08; c.beginPath(); c.moveTo(f.x - h * 0.14, y - h * 0.5); c.lineTo(f.x - h * 0.3 + wv, y - h * 0.95); c.moveTo(f.x + h * 0.14, y - h * 0.5); c.lineTo(f.x + h * 0.3 + wv, y - h * 0.95); c.stroke(); }
      c.fillStyle = f.shirt; c.beginPath(); c.roundRect(f.x - h * 0.2, y - h * 0.58, h * 0.4, h * 0.58, h * 0.12); c.fill();
      c.fillStyle = f.skin; c.beginPath(); c.arc(f.x, y - h * 0.74, h * 0.19, 0, TAU); c.fill();
      c.fillStyle = f.hair; c.beginPath(); c.arc(f.x, y - h * 0.78, h * 0.19, Math.PI * 1.05, Math.PI * 1.95); c.fill();
      if (f.cap) { c.fillStyle = themeId === 'neige' ? (f.side ? '#3d8bff' : '#ff4d4d') : TEAM[f.side]; c.beginPath(); c.arc(f.x, y - h * 0.8, h * 0.2, Math.PI, TAU); c.fill(); c.fillRect(f.x - h * 0.05, y - h * 0.82, h * 0.3, h * 0.06); }
      if (f.scarf && e > 0.15) { const y2 = y - h * 1.12; c.fillStyle = TEAM[f.side]; c.fillRect(f.x - h * 0.5, y2, h, h * 0.16); c.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) c.fillRect(f.x - h * 0.5 + k * h * 0.27, y2, h * 0.1, h * 0.16); }
      if (f.flag) { const fw = Math.sin(t * 4 + f.ph); c.strokeStyle = '#ddd'; c.lineWidth = 2; c.beginPath(); c.moveTo(f.x + h * 0.25, y - h * 0.4); c.lineTo(f.x + h * 0.25, y - h * 2.2); c.stroke(); c.fillStyle = TEAM[f.side]; c.beginPath(); c.moveTo(f.x + h * 0.25, y - h * 2.2); c.quadraticCurveTo(f.x + h * 0.8, y - h * (2.2 - fw * 0.25), f.x + h * 1.4, y - h * (2.05 + fw * 0.1)); c.lineTo(f.x + h * 1.4, y - h * (1.55 + fw * 0.1)); c.quadraticCurveTo(f.x + h * 0.8, y - h * (1.7 + fw * 0.25), f.x + h * 0.25, y - h * 1.65); c.fill(); c.fillStyle = '#fff'; c.fillRect(f.x + h * 0.25, y - h * 1.98, h * 1.1, h * 0.1); }
    }
    const e = Math.max(...exc);
    for (let k = 0; k < e * 6; k++) if (Math.random() < 0.25) { const f = fans[Math.floor(Math.random() * fans.length)]; if (!f) break; const g = c.createRadialGradient(f.x, f.y - f.h * 0.7, 0, f.x, f.y - f.h * 0.7, f.h * 1.2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(f.x - f.h * 1.2, f.y - f.h * 1.9, f.h * 2.4, f.h * 2.4); }
  }

  function drawLights(c, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    if (theme.lights) for (const fx of [0.1, 0.34, 0.66, 0.9]) {
      const x = fx * W, y = topY - u * 2.67, fl = 0.92 + Math.sin(t * 13 + fx * 40) * 0.04;
      let g = c.createRadialGradient(x, y, 0, x, y, u * 4.5); g.addColorStop(0, `rgba(255,248,220,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.fillRect(x - u * 4.5, y - u * 4.5, u * 9, u * 9);
      g = c.createLinearGradient(x, y, cx, gy); g.addColorStop(0, `rgba(255,250,225,${0.12 * fl})`); g.addColorStop(1, 'rgba(255,250,225,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - u * 1.1, y); c.lineTo(x + u * 1.1, y); c.lineTo(lerp(x, cx, 0.6) + u * 7, gy); c.lineTo(lerp(x, cx, 0.6) - u * 7, gy); c.closePath(); c.fill();
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { c.fillStyle = `rgba(255,252,235,${0.9 * fl})`; c.beginPath(); c.arc(x - u * 1.0 + i * u * 0.4, y - u * 0.22 + j * u * 0.42, u * 0.13, 0, TAU); c.fill(); }
    }
    if (theme.bulbs) for (let x = 0; x < W; x += u * 0.5) { const k = (x / (u * 3)) % 1, y = topY - u * 0.4 + Math.sin(k * Math.PI) * u * 0.55; c.fillStyle = `hsla(${(x * 0.3 + t * 40) % 360},90%,70%,${0.7 + Math.sin(t * 3 + x) * 0.2})`; c.beginPath(); c.arc(x, y, u * 0.09, 0, TAU); c.fill(); }
    c.restore();
  }

  function drawScreen(c, board, t) {
    if (!screenBox || !board) return;
    const { x, y, w, h } = screenBox;
    if (!theme.lights) { c.fillStyle = '#1a1533'; c.fillRect(x + w * 0.2, y + h, 6, standBot - y - h); c.fillRect(x + w * 0.8 - 6, y + h, 6, standBot - y - h); }
    c.fillStyle = '#0b0918'; c.beginPath(); c.roundRect(x - 6, y - 6, w + 12, h + 12, 10); c.fill();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.stroke();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#16224a'); g.addColorStop(1, '#0b1028'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const [n0, n1] = board.names ?? ['', ''], [s0, s1] = board.score ?? [0, 0];
    c.fillStyle = TEAM[0]; c.fillRect(x, y, w * 0.33, h * 0.28); c.fillStyle = TEAM[1]; c.fillRect(x + w * 0.67, y, w * 0.33, h * 0.28);
    c.font = `800 ${Math.round(h * 0.17)}px "Baloo 2", sans-serif`; c.fillStyle = '#fff';
    c.fillText(n0 ?? '', x + w * 0.165, y + h * 0.15, w * 0.3); c.fillText(n1 ?? '', x + w * 0.835, y + h * 0.15, w * 0.3);
    const fl = board.flash && Math.sin(t * 20) > 0;
    c.font = `900 ${Math.round(h * 0.5)}px "Baloo 2", sans-serif`; c.fillStyle = fl ? '#ffffff' : '#ffd23f';
    c.fillText(board.flash ? 'BUT !' : `${s0}  -  ${s1}`, x + w / 2, y + h * 0.6);
    c.font = `800 ${Math.round(h * 0.17)}px "Baloo 2", sans-serif`; c.fillStyle = '#9fe8ff'; c.fillText(board.clock ?? '', x + w / 2, y + h * 0.15);
    for (let yy = y; yy < y + h; yy += 3) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, yy, w, 1); }
  }

  // Cage (côté d : 0 à gauche, 1 à droite) : fond (filet, cadre arrière) avant les joueurs, cadre avant après.
  function goalBack(c, d, gh, t) {
    const s = d ? 1 : -1, n = nets[d], age = t - n.at, amp = n.amp * Math.exp(-age * 2.5), dep = u * 0.45;
    const x0 = sx(s * F.HL), x1 = sx(s * WALL), yT = sy(gh);
    c.fillStyle = 'rgba(10,14,40,.35)'; c.fillRect(Math.min(x0, x1), yT, Math.abs(x1 - x0), gy - yT);
    const off = (xw, yw) => { const dd = Math.hypot(xw - s * WALL, yw - n.y); return s * amp * Math.sin(age * 16 - dd * 4) * Math.exp(-dd * 0.8) * 0.25; };
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1;
    for (let yw = 0; yw <= gh + 0.01; yw += 0.25) { c.beginPath(); for (let xw = F.HL; xw <= WALL + 0.01; xw += 0.2) { const X = sx(s * xw + off(s * xw, yw)), Y = sy(yw) - dep * ((xw - F.HL) / F.GD) * 0.15; xw === F.HL ? c.moveTo(X, Y) : c.lineTo(X, Y); } c.stroke(); }
    for (let xw = F.HL; xw <= WALL + 0.01; xw += 0.2) { c.beginPath(); for (let yw = 0; yw <= gh + 0.01; yw += 0.2) { const X = sx(s * xw + off(s * xw, yw)), Y = sy(yw) - dep * ((xw - F.HL) / F.GD) * 0.15; yw === 0 ? c.moveTo(X, Y) : c.lineTo(X, Y); } c.stroke(); }
    c.strokeStyle = 'rgba(235,240,255,.75)'; c.lineWidth = Math.max(2, u * 0.08); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, gy - dep); c.lineTo(x0, yT - dep); c.lineTo(x1, yT - dep); c.lineTo(x1, gy - dep); c.stroke();
    c.beginPath(); c.moveTo(x1, gy); c.lineTo(x1, gy - dep); c.moveTo(x1, yT); c.lineTo(x1, yT - dep); c.stroke();
  }
  function goalFront(c, d, gh) {
    const s = d ? 1 : -1, x0 = sx(s * F.HL), x1 = sx(s * WALL), yT = sy(gh), w = Math.max(3, u * F.BAR * 2);
    c.lineCap = 'round';
    for (const [col, wd] of [[INK, w + 3], ['#ffffff', w]]) { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x0, yT); c.lineTo(x1, yT); c.lineTo(x1, gy); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x1, gy); c.stroke();
  }
  // Mur magique (pouvoir de Roco) devant un but
  function magicWall(c, d, gh, left, t) {
    if (!(left > 0)) return;
    const s = d ? 1 : -1, x = sx(s * (F.HL - 0.35)), top = sy(gh + 0.4), w = u * 0.36, al = Math.min(1, left * 2);
    c.save(); c.globalAlpha = al;
    c.fillStyle = '#c0583a'; c.fillRect(x - w / 2, top, w, gy - top);
    c.strokeStyle = '#7a2e1c'; c.lineWidth = 1.5;
    for (let y = top, k = 0; y < gy; y += u * 0.22, k++) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.stroke(); c.beginPath(); c.moveTo(x + (k % 2 ? -0.1 : 0.1) * w, y); c.lineTo(x + (k % 2 ? -0.1 : 0.1) * w, y + u * 0.22); c.stroke(); }
    c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,190,90,${0.25 + Math.sin(t * 8) * 0.1})`; c.fillRect(x - w, top - 4, w * 2, gy - top + 4);
    c.restore();
  }
  function drawItem(c, it, t) {
    const x = sx(it[0]), y = sy(it[1]), info = CC.ITEMS[it[2]], r = u * 0.42, falling = it[1] > 0.5;
    if (falling) { // parachute
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - r, y - r * 0.6); c.lineTo(x - r * 1.5, y - r * 2.6); c.moveTo(x + r, y - r * 0.6); c.lineTo(x + r * 1.5, y - r * 2.6); c.stroke();
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ffffff' : '#ff4d6a'; c.beginPath(); c.moveTo(x, y - r * 2.6); c.arc(x, y - r * 2.4, r * 1.6, Math.PI + (k * Math.PI) / 4, Math.PI + ((k + 1) * Math.PI) / 4); c.closePath(); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(x, y - r * 2.4, r * 1.6, Math.PI, TAU); c.stroke();
    }
    const bob = falling ? Math.sin(t * 3) * 3 : Math.sin(t * 5) * 2;
    c.save(); c.translate(x, y + bob);
    c.shadowColor = '#ffe14a'; c.shadowBlur = 12;
    c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.roundRect(-r, -r, r * 2, r * 2, r * 0.4); c.fill(); c.stroke();
    c.shadowBlur = 0; c.font = `${Math.round(r * 1.25)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(info?.icon ?? '?', 0, r * 0.08);
    c.restore();
  }

  function drawBall(c, b, k, t, dt, g) {
    const r = (b.r ?? BALL.r) * u, x = sx(b.x), y = sy(b.y), sp = Math.hypot(b.vx ?? 0, b.vy ?? 0);
    if (!k) ballAng += ((b.vx ?? 0) * dt) / (b.r ?? BALL.r);
    const ang = ballAng + k * 1.7;
    const hk = clamp(1 - b.y / 9, 0.25, 1); c.fillStyle = `rgba(0,0,0,${0.35 * hk})`; c.beginPath(); c.ellipse(x, gy + 2, r * 1.2 * hk, r * 0.3 * hk, 0, 0, TAU); c.fill();
    // repère de retombée pour les ballons hauts
    if (b.y > 2.4 && g) { const vy = b.vy ?? 0, tl = (vy + Math.sqrt(vy * vy + 2 * g * (b.y - (b.r ?? BALL.r)))) / g, lx = clamp(b.x + (b.vx ?? 0) * tl, -WALL, WALL); c.strokeStyle = 'rgba(255,225,74,.7)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.ellipse(sx(lx), gy + 2, r * 1.1, r * 0.3, 0, 0, TAU); c.stroke(); c.setLineDash([]); }
    const tr = trails.get(k) ?? trails.set(k, []).get(k);
    tr.push({ x, y, at: t }); while (tr.length && t - tr[0].at > 0.12) tr.shift();
    if (sp > 12 || b.fire || b.zig) tr.forEach((p, i) => { const al = (i / tr.length) * (b.fire ? 0.55 : 0.3); c.fillStyle = b.fire ? `rgba(255,${120 + i * 8},40,${al})` : b.zig ? `rgba(120,255,220,${al})` : `rgba(255,255,255,${al})`; c.beginPath(); c.arc(p.x, p.y, r * (0.5 + (i / tr.length) * 0.5), 0, TAU); c.fill(); });
    if (b.fire) { c.save(); c.globalCompositeOperation = 'lighter'; const gg = c.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, 'rgba(255,200,80,.9)'); gg.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = gg; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.restore(); emit(b.x + (Math.random() - 0.5) * 0.3, b.y + (Math.random() - 0.5) * 0.3, { vx: -(b.vx ?? 0) * 0.1, vy: 1, life: 0.4, size: 0.18, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a1a', glow: true }); }
    if (b.zig) emit(b.x, b.y, { kind: 'streak', vx: -(b.vx ?? 0) * 0.3, vy: (Math.random() - 0.5) * 6, life: 0.3, size: 0.1, color: '#7fffe0' });
    c.save(); c.translate(x, y); drawBallSkin(c, r, ang, ballSkin, t); c.restore();
  }

  /* ---- Particules (coordonnées du terrain) ---- */
  function emit(x, y, o) { if (parts.length < 900) parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.5, size: 0.1, color: '#fff', ...o, t: 0, rot: Math.random() * TAU }); }
  function drawParts(c, dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.spin ?? 0) * dt;
      if (p.kind === 'confetti') { p.vx *= 0.985; p.vy = Math.max(p.vy, -2.2); }
      const k = 1 - p.t / p.life, X = sx(p.x), Y = sy(p.y), s = p.size * u * (p.grow ? 1 + (p.t / p.life) * p.grow : 1);
      c.globalAlpha = Math.min(1, k * 1.5);
      if (p.kind === 'ring') { c.strokeStyle = p.color; c.lineWidth = 3 * k; c.beginPath(); c.arc(X, Y, s * (1 + (p.t / p.life) * 3), 0, TAU); c.stroke(); }
      else if (p.kind === 'confetti') { c.save(); c.translate(X, Y); c.rotate(p.rot); c.scale(1, Math.cos(p.rot * 2)); c.fillStyle = p.color; c.fillRect(-s, -s * 0.5, s * 2, s); c.restore(); }
      else if (p.kind === 'streak') { c.strokeStyle = p.color; c.lineWidth = s * 0.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - p.vx * u * 0.03, Y + p.vy * u * 0.03); c.stroke(); }
      else if (p.kind === 'star') { c.save(); c.translate(X, Y); c.rotate(p.rot); c.scale(u, u); star(c, 0, 0, p.size, p.color); c.restore(); }
      else if (p.kind === 'text') { c.font = `900 ${Math.round(u * p.size)}px "Baloo 2", sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.text, X, Y); c.fillStyle = p.color; c.fillText(p.text, X, Y); }
      else { if (p.glow) c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.beginPath(); c.arc(X, Y, s, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    }
    c.globalAlpha = 1;
  }

  function weather(c, dt, t, wind) {
    if (theme.rain) {
      c.strokeStyle = 'rgba(180,200,255,.45)'; c.lineWidth = 1.2; c.beginPath();
      for (const d of drops) { d.y += d.v * 900 * dt; d.x += (wind * 30 - 80) * dt; if (d.y > H) { d.y = -10; d.x = Math.random() * W * 1.2; } c.moveTo(d.x, d.y); c.lineTo(d.x - 4, d.y - 16 * d.v); }
      c.stroke();
      if (t > thunderAt) { thunderAt = t + 7 + Math.random() * 9; bolt = 0.35; flash = Math.max(flash, 0.25); flashColor = '#dfe8ff'; api.onThunder?.(); }
      if (bolt > 0) { bolt -= dt; c.strokeStyle = `rgba(255,255,255,${bolt * 2.5})`; c.lineWidth = 3; c.beginPath(); let x = W * 0.3 + Math.sin(thunderAt) * W * 0.3, y = 0; c.moveTo(x, y); while (y < topY) { x += (Math.random() - 0.5) * 40; y += 20 + Math.random() * 20; c.lineTo(x, y); } c.stroke(); }
    }
    if (theme.snow) {
      c.fillStyle = 'rgba(255,255,255,.9)';
      for (const d of drops) { d.y += d.v * 70 * dt; d.x += (Math.sin(t + d.s * 3) * 20 + wind * 25) * dt; if (d.y > H) { d.y = -5; d.x = Math.random() * W; } if (d.x > W) d.x = 0; if (d.x < 0) d.x = W; c.beginPath(); c.arc(d.x, d.y, d.s, 0, TAU); c.fill(); }
    }
    if (Math.abs(wind) > 0.5 && Math.random() < Math.abs(wind) * 0.12) emit((Math.random() - 0.5) * 2 * WALL, 1 + Math.random() * 7, { kind: 'streak', vx: wind * 4, vy: 0, life: 0.6, size: 0.06, color: 'rgba(255,255,255,.6)' });
  }

  const fx = {
    kick(e) {
      const pw = e.p ?? 15;
      emit(e.x, e.y, { kind: 'ring', size: 0.25, life: 0.3, color: e.fire ? '#ffb030' : '#ffffff' });
      for (let k = 0; k < 10 + pw * 0.6; k++) { const a = Math.random() * TAU, v = 3 + Math.random() * pw * 0.4; emit(e.x, e.y, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25, size: 0.12, color: e.fire ? '#ffb030' : '#fff8c8' }); }
      if (e.y < 0.6) fx.dust(e.x, 8);
      fx.shake(pw > 26 ? 0.8 : pw > 21 ? 0.45 : pw > 17 ? 0.25 : 0.1);
    },
    header(e) { emit(e.x, e.y, { kind: 'ring', size: 0.3, life: 0.3, color: '#ffffff' }); for (let k = 0; k < 6; k++) emit(e.x, e.y + 0.2, { kind: 'star', vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, g: 8, life: 0.5, size: 0.08, color: '#ffe14a', spin: 6 }); },
    spark(x, y, color = '#ffffff', n = 14) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = 2 + Math.random() * 6; emit(x, y, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35, size: 0.1, color }); } },
    dust(x, n = 6, color) { const col = color ?? (themeId === 'plage' ? '#e8c47a' : themeId === 'neige' ? '#ffffff' : '#9bd07a'); for (let k = 0; k < n; k++) emit(x + (Math.random() - 0.5) * 0.6, 0.05, { vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.6, g: 3, life: 0.5, size: 0.08 + Math.random() * 0.08, grow: 1.5, color: col }); },
    net(x, y, v = 10) { const n = nets[x > 0 ? 1 : 0]; n.amp = clamp(v / 12, 0.3, 1.6); n.at = clock; n.y = y; },
    pop(x, y, text, color = '#ffe14a', size = 0.55) { emit(x, y, { kind: 'text', text, vy: 1.6, life: 1.1, size, color }); },
    freeze(x, y) { for (let k = 0; k < 18; k++) { const a = Math.random() * TAU; emit(x, y + 1, { kind: 'star', vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0.6, size: 0.07, color: '#bfefff', spin: 5 }); } },
    goal(side) {
      const gx = side === 0 ? F.HL + 0.8 : -F.HL - 0.8;
      exc[side] = 1; exc[1 - side] = 0; flash = 0.55; flashColor = TEAM_L[side];
      fx.net(gx, 1.2, 18);
      for (let k = 0; k < 160; k++) emit((Math.random() - 0.5) * 2 * WALL, F.CEIL + Math.random() * 2, { kind: 'confetti', vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, g: 1.2, life: 4 + Math.random() * 2, size: 0.07 + Math.random() * 0.05, color: [TEAM[side], '#ffd23f', '#ffffff', TEAM_L[side]][k % 4], spin: (Math.random() - 0.5) * 10 });
      for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, v = 4 + Math.random() * 8; emit(gx, 1.3, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, size: 0.14, color: '#ffe680' }); }
      fx.shake(1);
    },
    chance(side) { exc[side] = Math.max(exc[side], 0.6); },
    shake(a) { shake = Math.max(shake, a); },
  };

  /* ---- Démo des menus : un ballon qui rebondit tout seul ---- */
  function stepDemo(dt) {
    demo ??= { opts: {}, balls: [{ x: 0, y: 4, vx: 3, vy: 0, fire: 0 }], k: 0 };
    const b = demo.balls[0];
    for (let n = 0; n < Math.round(dt * 120); n++) CC.stepBall(demo, b, [], CC.DT / 2);
    if (b.y < BALL.r + 0.05 && Math.abs(b.vy) < 0.5 && (demo.k += dt) > 0.6) { demo.k = 0; b.vy = 9 + Math.random() * 5; b.vx = (Math.random() - 0.5) * 16; }
    return b;
  }

  /* ---- Image ---- */
  // scene : { players: [{ id, name, char, acc, side, x, y, vx, vy, …, me }], balls: [{ x, y, vx, vy, fire, zig, r }],
  //           items: [[x, y, kind]], walls: [g, d], goalH: [g, d], wind, g, board: { names, score, clock, flash }, replay }
  function frame(dt, t, scene) {
    clock = t;
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    shake *= Math.exp(-dt * 6); flash = Math.max(0, flash - dt);
    for (const k of [0, 1]) exc[k] = Math.max(0.08, exc[k] - dt * 0.18);
    const players = scene?.players ?? [], balls = scene?.balls ?? [stepDemo(dt)], gh = scene?.goalH ?? [F.GH, F.GH], wind = scene?.wind ?? 0;
    if (scene) for (const b of balls) { const near = Math.abs(b.x) > F.HL - 5 ? (b.x > 0 ? 0 : 1) : -1; if (near >= 0) exc[near] = Math.max(exc[near], 0.32); }
    c.save();
    if (shake > 0.01) c.translate((Math.random() - 0.5) * shake * u * 0.3, (Math.random() - 0.5) * shake * u * 0.3);
    c.drawImage(bg, 0, 0, W, H);
    drawLights(c, t);
    drawFans(c, t);
    drawScreen(c, scene?.board, t);
    const lh = led.height / dpr, lw = led.width / dpr, off = (t * 70) % lw;
    for (let x = -off; x < W; x += lw) c.drawImage(led, x, standBot, lw, lh);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, standBot, W, 1.5);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, standBot + lh, W, yb - standBot - lh);
    for (const d of [0, 1]) goalBack(c, d, gh[d], t);
    for (const it of scene?.items ?? []) drawItem(c, it, t);
    for (const p of players) { const k = clamp(1 - p.y / 4, 0.3, 1); c.fillStyle = `rgba(0,0,0,${0.3 * k})`; c.beginPath(); c.ellipse(sx(p.x), gy + 2, u * 0.55 * k, u * 0.14 * k, 0, 0, TAU); c.fill(); }
    for (const p of players) {
      const a = anims.get(p.id) ?? anims.set(p.id, newAnim()).get(p.id);
      tickAnim(a, p, dt);
      for (const o of players) if (o !== p && Math.abs(o.x - p.x) < 1.0 && Math.abs(o.y - p.y) < 1 && (o.vx - p.vx) * (o.x - p.x) < -4) a.bump = 0.3;
      if (p.sprint && p.ground && Math.random() < 0.5) emit(p.x - Math.sign(p.vx) * 0.3, 0.05, { vx: -p.vx * 0.2, vy: Math.random(), g: 3, life: 0.35, size: 0.07, grow: 1.5, color: 'rgba(255,255,255,.7)' });
      if (p.tackleT > 0 && Math.random() < 0.7) fx.dust(p.x, 1);
      const glow = p.power ? { super: '255,140,40', tornade: '80,255,220', tete: '190,120,255', ressort: '120,255,120', aimant: '255,80,120' }[p.power] : p.fast > 0 ? '255,230,80' : p.charge > 0.3 ? '255,200,60' : p.keeper ? '255,240,160' : null;
      if (glow) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(sx(p.x), sy(p.y + 1.2), 0, sx(p.x), sy(p.y + 1.2), u * 2); g.addColorStop(0, `rgba(${glow},.4)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(sx(p.x) - u * 2, sy(p.y + 1.2) - u * 2, u * 4, u * 4); c.restore(); if (Math.random() < 0.35) emit(p.x + (Math.random() - 0.5), p.y + Math.random() * 2.4, { vy: 1.5, life: 0.5, size: 0.07, glow: true, color: `rgb(${glow})` }); }
      if (p.gauge >= 1 && Math.random() < 0.25) emit(p.x + (Math.random() - 0.5) * 0.9, p.y + Math.random() * 2, { vy: 1.2, life: 0.6, size: 0.05, glow: true, color: '#ffe14a' });
      const s = p.side ? -1 : 1, nb = balls.reduce((m, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(m.x - p.x, m.y - p.y) ? b : m), balls[0]);
      const rel = nb && { x: (nb.x - p.x) * s, y: nb.y - p.y, sp: Math.hypot((nb.vx ?? 0) - p.vx, (nb.vy ?? 0) - p.vy) };
      c.save(); c.translate(sx(p.x), sy(p.y)); c.scale(u * s, u);
      drawPlayer(c, p, a, t, rel);
      c.restore();
    }
    balls.forEach((b, k) => drawBall(c, b, k, t, dt, scene?.g));
    for (const d of [0, 1]) { magicWall(c, d, gh[d], scene?.walls?.[d], t); goalFront(c, d, gh[d]); }
    drawParts(c, dt);
    weather(c, dt, t, wind);
    // noms, endurance, charge
    for (const p of players) {
      const top = sy(CC.headY(p) + CC.headR(p)) - 14, x = sx(p.x);
      c.font = '800 13px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = p.me ? `${p.name} (toi)` : p.name, w = c.measureText(label).width + 16;
      c.fillStyle = TEAM[p.side]; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2, top - 20, w, 18, 9); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillText(label, x, top - 10.5);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x - 22, top + 2, 44, 5); c.fillStyle = p.tired ? '#ff6b6b' : '#7dff9a'; c.fillRect(x - 22, top + 2, 44 * (p.sta ?? 1), 5);
      if (p.charge > 0.05) { const k = p.charge / CC.CHARGE; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - 22, top + 9, 44, 6); c.fillStyle = `hsl(${50 - k * 50},100%,55%)`; c.fillRect(x - 22, top + 9, 44 * k, 6); }
      if (p.me) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x - 6, top - 26); c.lineTo(x + 6, top - 26); c.lineTo(x, top - 20); c.closePath(); c.fill(); }
    }
    c.restore();
    if (flash > 0) { c.fillStyle = flashColor; c.globalAlpha = flash * 0.6; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    const v = c.createRadialGradient(cx, H * 0.55, H * 0.35, cx, H * 0.55, Math.max(W, H) * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,20,.4)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (scene?.replay) { // ralenti du but
      c.fillStyle = 'rgba(0,0,0,.85)'; c.fillRect(0, 0, W, H * 0.07); c.fillRect(0, H * 0.93, W, H * 0.07);
      c.fillStyle = 'rgba(40,20,0,.12)'; c.fillRect(0, 0, W, H);
      c.font = '900 22px "Baloo 2", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.textAlign = 'center'; if (Math.sin(t * 6) > 0) { c.fillStyle = '#ff3b55'; c.beginPath(); c.arc(cx - 110, H * 0.965, 7, 0, TAU); c.fill(); }
      c.fillStyle = '#fff'; c.fillText('REPLAY · RALENTI', cx, H * 0.965);
    }
  }

  const celebrate = (id, kind) => { const a = anims.get(id) ?? anims.set(id, newAnim()).get(id); a.cele = kind; a.celeT = 3; };
  resize();
  return Object.assign(api, { resize, frame, fx, celebrate, setTheme, setBallSkin: s => (ballSkin = BALLS[s] ? s : 'classique') });
}
