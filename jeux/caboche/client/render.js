// Rendu 2D de Caboche Cup (Canvas), vue de profil et caméra fixe : le « Caboche Arena » de nuit. Ciel étoilé, tribunes
// pleines d'un public qui chante et saute aux buts, projecteurs, écran géant, panneaux lumineux qui défilent, pelouse
// tondue en perspective avec ses lignes, cages avec filets qui ondulent, parois vitrées. Personnages dessinés à la main :
// petit corps articulé (jambes, bras, crampons), grosse tête expressive (yeux qui suivent le ballon, sourcils, bouche
// selon l'humeur, clignements), poses de course, sprint, saut, tir, reprise, tacle, chute, contrôle, célébration.
// Effets : traînée et feu du ballon, impacts, poussière, confettis, éclair de but, tremblement.
const CC = window.CC, { F, WALL, BALL, HEAD } = CC;
export const TEAM = ['#ff4d4d', '#3d8bff'];
const TEAM_D = ['#b4202c', '#1f4fb4'], TEAM_L = ['#ffb3a8', '#a9cbff'], SHORTS = ['#ffffff', '#18204a'], INK = '#1b1530';
const LOOKS = {
  bouboule: { skin: '#f2c49b', skinD: '#cf8f66', hair: '#2a1c14', style: 'crete', wide: 1.1, nose: 1.3, stache: true, boot: '#ffd23f' },
  lila: { skin: '#9a6440', skinD: '#6e4026', hair: '#2b1a14', style: 'tresses', wide: 0.95, nose: 0.85, stache: false, boot: '#6dffb0' },
};
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ================= Personnages ================= */
// Membre en capsule avec contour : deux traits ronds superposés.
function bone(c, x0, y0, x1, y1, w, color) {
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = w + 0.05; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}
function leg(c, hx, hy, a, k, side, look) {
  const kx = hx + Math.sin(a) * 0.26, ky = hy + Math.cos(a) * 0.26, sa = a - k, fx = kx + Math.sin(sa) * 0.25, fy = ky + Math.cos(sa) * 0.25;
  bone(c, hx, hy, kx, ky, 0.15, look.skin);
  bone(c, kx, ky, fx, fy, 0.14, TEAM[side]);
  bone(c, kx + Math.sin(sa) * 0.05, ky + Math.cos(sa) * 0.05, kx + Math.sin(sa) * 0.09, ky + Math.cos(sa) * 0.09, 0.14, '#ffffff'); // bande de la chaussette
  // crampon : une chaussure arrondie qui pointe vers l'avant de la jambe
  c.save(); c.translate(fx, fy); c.rotate(-sa);
  c.fillStyle = INK; c.beginPath(); c.roundRect(-0.09, -0.06, 0.29, 0.13, 0.06); c.fill();
  c.fillStyle = look.boot; c.beginPath(); c.roundRect(-0.065, -0.035, 0.24, 0.08, 0.04); c.fill();
  c.fillStyle = INK; c.fillRect(0.0, 0.0, 0.1, 0.018);
  c.restore();
  return [fx, fy];
}
function arm(c, sx, sy, a, bend, side, look) {
  const ex = sx + Math.sin(a) * 0.2, ey = sy + Math.cos(a) * 0.2, fa = a + bend, hx = ex + Math.sin(fa) * 0.19, hy = ey + Math.cos(fa) * 0.19;
  bone(c, sx, sy, ex, ey, 0.13, TEAM[side]);
  bone(c, ex, ey, hx, hy, 0.1, look.skin);
  c.fillStyle = look.skin; c.strokeStyle = INK; c.lineWidth = 0.035; c.beginPath(); c.arc(hx, hy, 0.065, 0, TAU); c.fill(); c.stroke();
}
function torso(c, side, lean) {
  c.save(); c.rotate(lean);
  c.beginPath(); c.moveTo(-0.2, -0.5); c.lineTo(-0.24, -0.9); c.quadraticCurveTo(0, -1.02, 0.24, -0.9); c.lineTo(0.2, -0.5); c.closePath();
  const g = c.createLinearGradient(-0.24, 0, 0.24, 0); g.addColorStop(0, TEAM_D[side]); g.addColorStop(0.55, TEAM[side]); g.addColorStop(1, TEAM_L[side]);
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.045; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(-0.05, -0.97); c.lineTo(0.05, -0.97); c.lineTo(0.14, -0.5); c.lineTo(0.04, -0.5); c.closePath(); c.fill(); // bande
  c.fillStyle = '#ffd23f'; c.strokeStyle = INK; c.lineWidth = 0.02; c.beginPath(); c.arc(0.1, -0.8, 0.045, 0, TAU); c.fill(); c.stroke(); // écusson
  c.fillStyle = SHORTS[side]; c.beginPath(); c.roundRect(-0.21, -0.58, 0.42, 0.17, 0.05); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.04; c.stroke();
  c.restore();
}
// Tête (centre 0,0, rayon R), tournée vers +x, en trois quarts. mood : humeur ; lx, ly : où regarder ; blink : yeux fermés.
function head(c, R, look, side, mood, lx, ly, blink, t, swing) {
  const W = R * look.wide;
  // tresses derrière la tête, qui se balancent
  if (look.style === 'tresses') for (const [bx, ph] of [[-0.55, 0], [-0.2, 1.3]]) {
    let x = bx * R, y = 0.15 * R;
    for (let k = 0; k < 6; k++) {
      const a = 0.25 + swing * 0.5 + Math.sin(t * 5 + ph + k * 0.6) * 0.08, nx = x - Math.sin(a) * 0.15 * R, ny = y + Math.cos(a) * 0.17 * R;
      c.fillStyle = k % 2 ? '#ff4fa3' : look.hair; c.strokeStyle = INK; c.lineWidth = 0.03; c.beginPath(); c.ellipse(nx, ny, (k % 2 ? 0.08 : 0.11) * R, (k % 2 ? 0.08 : 0.13) * R, a, 0, TAU); c.fill(); c.stroke();
      x = nx; y = ny;
    }
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, y + 0.08 * R, 0.07 * R, 0, TAU); c.fill(); c.stroke();
  }
  // crâne
  const g = c.createRadialGradient(0.25 * R, -0.35 * R, 0.1 * R, 0, 0, R * 1.05); g.addColorStop(0, '#ffffff'); g.addColorStop(0.08, look.skin); g.addColorStop(0.85, look.skin); g.addColorStop(1, look.skinD);
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 0.05; c.beginPath(); c.ellipse(0, 0, W, R, 0, 0, TAU); c.fill(); c.stroke();
  // oreille (côté nuque)
  c.fillStyle = look.skin; c.beginPath(); c.ellipse(-0.5 * W, 0.08 * R, 0.13 * R, 0.18 * R, 0, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = look.skinD; c.lineWidth = 0.025; c.beginPath(); c.arc(-0.5 * W, 0.08 * R, 0.07 * R, -1, 1.6); c.stroke();
  // cheveux
  c.fillStyle = look.hair; c.strokeStyle = INK; c.lineWidth = 0.045;
  if (look.style === 'crete') {
    c.beginPath(); c.ellipse(-0.1 * W, -0.05 * R, W * 0.92, R * 0.93, 0, Math.PI * 1.05, Math.PI * 1.75); c.lineTo(-0.2 * W, -0.2 * R); c.closePath(); c.fill(); c.stroke(); // cheveux ras sur le côté
    c.beginPath();
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const a = Math.PI * (1.08 + (k / n) * 0.72), r0 = R * 0.92, r1 = R * (1.32 + (k % 2 ? 0 : 0.12) - Math.abs(k - n / 2) * 0.03), ax = Math.cos(a), ay = Math.sin(a);
      if (!k) c.moveTo(ax * r0 * look.wide, ay * r0);
      const am = a + (0.36 / n) * Math.PI;
      c.lineTo(Math.cos(a + 0.05) * r1 * look.wide, Math.sin(a + 0.05) * r1 - Math.sin(t * 9 + k) * 0.01);
      if (k < n) c.lineTo(Math.cos(am + 0.2) * r0 * look.wide, Math.sin(am + 0.2) * r0);
    }
    c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.03; c.beginPath(); c.arc(0, 0, R * 1.05, Math.PI * 1.3, Math.PI * 1.6); c.stroke();
  } else {
    c.beginPath(); c.ellipse(-0.04 * W, -0.06 * R, W * 1.03, R * 0.98, 0, Math.PI * 0.72, Math.PI * 1.8); c.quadraticCurveTo(0.25 * W, -0.72 * R, -0.2 * W, -0.52 * R); c.quadraticCurveTo(-0.5 * W, -0.3 * R, -0.66 * W, 0.42 * R); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#ff4fa3'; c.lineWidth = 0.1 * R; c.beginPath(); c.ellipse(-0.05 * W, -0.06 * R, W * 0.9, R * 0.86, 0, Math.PI * 1.15, Math.PI * 1.68); c.stroke(); // bandeau rose
    for (let k = 0; k < 4; k++) { const an = Math.PI * (1.2 + k * 0.14); c.fillStyle = '#3d2519'; c.beginPath(); c.arc(Math.cos(an) * W * 1.0, Math.sin(an) * R * 1.0 - 0.04 * R, 0.13 * R, 0, TAU); c.fill(); } // boucles du dessus
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 0.03; c.beginPath(); c.arc(-0.1 * R, -0.1 * R, R * 0.8, Math.PI * 1.25, Math.PI * 1.55); c.stroke();
  }
  // joues
  c.fillStyle = 'rgba(255,110,120,.35)'; c.beginPath(); c.ellipse(0.5 * W, 0.32 * R, 0.16 * R, 0.1 * R, 0, 0, TAU); c.fill();
  // yeux : l'œil lointain plus étroit (trois quarts)
  const eyes = [[0.2 * W, 0.8], [0.66 * W, 0.62]], ey = -0.02 * R;
  for (const [ex, sq] of eyes) {
    const rx = 0.17 * R * sq, ry = 0.23 * R;
    if (mood === 'dizzy') { c.strokeStyle = INK; c.lineWidth = 0.05; c.beginPath(); c.moveTo(ex - rx, ey - ry * 0.6); c.lineTo(ex + rx, ey + ry * 0.6); c.moveTo(ex - rx, ey + ry * 0.6); c.lineTo(ex + rx, ey - ry * 0.6); c.stroke(); continue; }
    if (blink || mood === 'joy') { c.strokeStyle = INK; c.lineWidth = 0.05; c.beginPath(); mood === 'joy' ? c.arc(ex, ey + ry * 0.3, rx, Math.PI * 1.1, Math.PI * 1.9) : c.arc(ex, ey, rx, 0.2, Math.PI - 0.2); c.stroke(); continue; }
    const open = mood === 'oh' || mood === 'shout' ? 1.12 : mood === 'grit' || mood === 'focus' ? 0.78 : 1;
    c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 0.035; c.beginPath(); c.ellipse(ex, ey, rx, ry * open, 0, 0, TAU); c.fill(); c.stroke();
    const px = ex + lx * rx * 0.45, py = ey + ly * ry * 0.4 * open;
    c.fillStyle = side ? '#2a4fa0' : '#6b3a1f'; c.beginPath(); c.arc(px, py, 0.105 * R * sq, 0, TAU); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(px, py, 0.06 * R * sq, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px + 0.03 * R, py - 0.04 * R, 0.03 * R, 0, TAU); c.fill();
    if (mood === 'grit' || mood === 'focus' || mood === 'evil') { c.fillStyle = look.skin; c.beginPath(); c.ellipse(ex, ey - ry * 0.95, rx * 1.15, ry * 0.45, 0, 0, TAU); c.fill(); } // paupière
    if (mood === 'sad') { c.fillStyle = 'rgba(120,200,255,.85)'; c.beginPath(); c.ellipse(ex + rx * 0.4, ey + ry * 1.3 + ((t * 0.8) % 1) * 0.3 * R, 0.04 * R, 0.07 * R, 0, 0, TAU); c.fill(); }
  }
  // sourcils
  const tilt = { grit: 0.35, focus: 0.25, evil: 0.45, sad: -0.4, oh: -0.15, shout: 0.2, ouch: -0.3, dizzy: 0 }[mood] ?? 0;
  c.strokeStyle = look.hair; c.lineWidth = 0.075 * R * 1.4; c.lineCap = 'round';
  for (const [ex, sq] of eyes) { const y0 = ey - 0.33 * R - (mood === 'oh' ? 0.06 * R : 0); c.beginPath(); c.moveTo(ex - 0.15 * R * sq, y0 - tilt * 0.06 * R * (ex > 0.4 * W ? -1 : 1) - tilt * 0.04 * R); c.lineTo(ex + 0.15 * R * sq, y0 + tilt * 0.06 * R * (ex > 0.4 * W ? -1 : 1) + tilt * 0.04 * R); c.stroke(); }
  // nez
  const nx = 0.5 * W, ny = 0.16 * R, nr = 0.1 * R * look.nose;
  c.fillStyle = look.skin; c.strokeStyle = INK; c.lineWidth = 0.03; c.beginPath(); c.ellipse(nx + nr * 0.4, ny, nr * 1.05, nr * 0.9, 0, -1.9, 2.4); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(nx + nr * 0.6, ny - nr * 0.35, nr * 0.25, 0, TAU); c.fill();
  // bouche
  const mx = 0.44 * W, my = 0.5 * R;
  c.strokeStyle = INK; c.lineWidth = 0.04;
  if (look.stache) { c.fillStyle = look.hair; c.beginPath(); c.ellipse(mx + 0.06 * R, my - 0.13 * R, 0.2 * R, 0.07 * R, -0.1, 0, TAU); c.fill(); }
  if (mood === 'shout' || mood === 'oh' || mood === 'ouch') {
    const big = mood === 'shout' ? 1 : 0.6;
    c.fillStyle = '#5a1020'; c.beginPath(); c.ellipse(mx, my + 0.03 * R, 0.13 * R * big, 0.15 * R * big, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#ff6d84'; c.beginPath(); c.ellipse(mx, my + 0.1 * R * big, 0.08 * R * big, 0.05 * R * big, 0, 0, TAU); c.fill();
  } else if (mood === 'joy' || mood === 'evil') {
    c.fillStyle = '#5a1020'; c.beginPath(); c.moveTo(mx - 0.22 * R, my - 0.04 * R); c.quadraticCurveTo(mx, my + 0.36 * R, mx + 0.2 * R, my - 0.06 * R); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(mx - 0.19 * R, my - 0.03 * R); c.lineTo(mx + 0.17 * R, my - 0.05 * R); c.lineTo(mx + 0.15 * R, my + 0.04 * R); c.lineTo(mx - 0.17 * R, my + 0.05 * R); c.closePath(); c.fill();
  } else if (mood === 'grit') {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(mx - 0.17 * R, my - 0.05 * R, 0.34 * R, 0.12 * R, 0.04 * R); c.fill(); c.stroke();
    c.lineWidth = 0.02; c.beginPath(); c.moveTo(mx - 0.17 * R, my + 0.01 * R); c.lineTo(mx + 0.17 * R, my + 0.01 * R); for (let k = -1; k <= 1; k++) { c.moveTo(mx + k * 0.08 * R, my - 0.05 * R); c.lineTo(mx + k * 0.08 * R, my + 0.07 * R); } c.stroke();
  } else if (mood === 'sad') { c.beginPath(); c.arc(mx, my + 0.15 * R, 0.13 * R, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
  else if (mood === 'dizzy') { c.beginPath(); c.moveTo(mx - 0.15 * R, my); for (let k = 1; k <= 6; k++) c.lineTo(mx - 0.15 * R + k * 0.05 * R, my + (k % 2 ? 0.05 : -0.03) * R); c.stroke(); }
  else { c.beginPath(); c.arc(mx, my - 0.1 * R, 0.17 * R, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
}

// Pose du joueur selon son état, puis dessin dans le repère local (pieds en 0,0, y vers le bas, tourné vers +x).
function drawPlayer(c, P, a, t, ballRel) {
  const look = LOOKS[P.char] ?? LOOKS.bouboule, side = P.side, R = CC.CHARS[P.char].head * (P.power === 'tete' ? 2 : 1) * a.headK;
  const fwd = P.vx * (side ? -1 : 1), speed = Math.abs(P.vx);
  let L1 = 0.05, K1 = 0.1, L2 = -0.05, K2 = 0.1, A1 = -0.15, B1 = -0.5, A2 = 0.15, B2 = -0.4, lean = 0, bodyRot = 0, lift = Math.sin(t * 3 + a.seed) * 0.012, mood = 'smile';
  if (P.ground && speed > 0.4) { // course
    const amp = Math.min(1, speed / 6) * (P.sprint ? 1.25 : 1), s = Math.sin(a.phase);
    L1 = s * 0.9 * amp; L2 = -L1; K1 = 0.25 + Math.max(0, -s) * 1.2 * amp; K2 = 0.25 + Math.max(0, s) * 1.2 * amp;
    A1 = -s * 0.9 * amp; A2 = s * 0.9 * amp; B1 = B2 = -1.1;
    lean = Math.sign(fwd) * (P.sprint ? 0.28 : 0.12) * amp; lift = Math.abs(Math.cos(a.phase)) * 0.06 * amp;
    if (fwd < 0) { L1 = -L1; L2 = -L2; }
  }
  if (!P.ground) { // saut : jambes repliées, bras levés
    const up = P.vy > 0; L1 = 0.6; K1 = up ? 1.3 : 0.6; L2 = 0.1; K2 = up ? 1.0 : 0.3; A1 = -2.5; A2 = -2.1; B1 = B2 = 0.3; mood = 'oh';
  }
  if (P.kickT > 0) { // tir : la jambe avant arme puis fouette
    const u = 1 - P.kickT / 0.22, air = !P.ground, top = air ? 2.1 : 1.55;
    L1 = u < 0.3 ? -0.9 * (u / 0.3) : -0.9 + Math.min(1, (u - 0.3) / 0.3) * (0.9 + top); K1 = u < 0.3 ? 1.2 : Math.max(0, 1.2 - (u - 0.3) * 5);
    L2 = -0.15; K2 = 0.2; A1 = -1.2; A2 = 1.3; B1 = -0.3; B2 = -0.6; lean = -0.15; mood = 'shout';
    if (air) { bodyRot = -0.45 * Math.sin(u * Math.PI); L2 = 0.6; K2 = 1.2; }
  }
  if (P.tackleT > 0) { bodyRot = -1.05; L1 = 1.5; K1 = 0; L2 = 0.4; K2 = 1.4; A1 = 2.6; A2 = 2.2; B1 = B2 = 0.2; mood = 'grit'; lift = 0; }
  if (P.stun > 0) { bodyRot = -1.45; L1 = 1.2; K1 = 0.4; L2 = 0.8; K2 = 0.9; A1 = 2.8; A2 = -2.6; B1 = B2 = 0.6; mood = 'dizzy'; lift = 0; }
  // contrôle : le ballon arrive doucement contre le joueur
  if (P.ground && !P.kickT && P.stun <= 0 && P.tackleT <= 0 && ballRel && Math.hypot(ballRel.x, ballRel.y - 0.8) < 1.3 && ballRel.sp < 6) { A1 = -0.8; A2 = 0.9; B1 = B2 = -0.6; mood = 'focus'; }
  if (P.sprint && P.ground && !P.kickT) mood = 'grit';
  else if (P.power && mood === 'smile') mood = 'evil';
  else if (mood === 'smile' && ballRel && Math.hypot(ballRel.x, ballRel.y) < 3) mood = 'focus';
  if (a.bump > 0 && mood !== 'dizzy') mood = 'ouch';
  if (a.cele === 'win') { mood = 'joy'; A1 = -2.7 + Math.sin(t * 12) * 0.2; A2 = -2.5 - Math.sin(t * 12) * 0.2; B1 = B2 = 0.2; lift = Math.abs(Math.sin(t * 7)) * 0.45; L1 = 0.3; K1 = 0.8; }
  if (a.cele === 'sad') { mood = 'sad'; A1 = 0.1; A2 = -0.05; B1 = B2 = -0.1; lean = 0.25; }
  // squash à la réception
  const sq = a.squash;
  c.save();
  c.translate(0, -lift); c.scale(1 + sq * 0.6, 1 - sq);
  c.translate(0, -0.5); c.rotate(bodyRot); c.translate(0, 0.5);
  // derrière : bras et jambe du fond
  c.globalAlpha = 1;
  c.save(); c.filter = 'brightness(0.8)'; arm(c, -0.05, -0.9, A2, B2, side, look); leg(c, -0.05, -0.52, L2, K2, side, look); c.restore();
  torso(c, side, lean);
  leg(c, 0.05, -0.52, L1, K1, side, look);
  c.save(); c.rotate(lean); arm(c, 0.06, -0.88, A1, B1, side, look); c.restore();
  // tête
  const hy = -HEAD.y * (P.power === 'tete' ? 1.2 : 1) + (a.cele === 'sad' ? 0.12 : 0);
  c.save(); c.translate(Math.sin(lean) * 1.3, hy + (a.cele === 'sad' ? 0.05 : 0)); c.rotate(lean * 0.5 + (a.cele === 'sad' ? 0.35 : 0));
  const lx = clamp(ballRel ? ballRel.x / (Math.hypot(ballRel.x, ballRel.y - 1.5) + 0.5) : 0.6, -1, 1), ly = clamp(ballRel ? -(ballRel.y - 1.5) / (Math.hypot(ballRel.x, ballRel.y - 1.5) + 0.5) : 0, -1, 1);
  head(c, R, look, side, mood, lx, ly, a.blink > 0, t, clamp(-P.vx * (side ? -1 : 1) * 0.06, -0.4, 0.4));
  if (P.stun > 0) for (let k = 0; k < 3; k++) { const an = t * 5 + (k * TAU) / 3; star(c, Math.cos(an) * R * 0.9, -R * 1.05 + Math.sin(an) * R * 0.25, 0.09, '#ffe14a'); }
  c.restore();
  c.restore();
}
function star(c, x, y, r, color) {
  c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 0.02; c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.stroke();
}
const newAnim = () => ({ phase: 0, blink: 0, nextBlink: 2 + Math.random() * 3, squash: 0, wasGround: true, bump: 0, cele: null, celeT: 0, headK: 1, seed: Math.random() * 10 });
function tickAnim(a, P, dt) {
  a.phase += Math.abs(P.vx) * dt * 2.3;
  if ((a.nextBlink -= dt) <= 0) { a.blink = 0.13; a.nextBlink = 2 + Math.random() * 3.5; }
  a.blink -= dt;
  if (P.ground && !a.wasGround) a.squash = 0.16;
  a.wasGround = P.ground;
  a.squash *= Math.exp(-dt * 10);
  a.bump = Math.max(0, a.bump - dt);
  if (a.celeT > 0 && (a.celeT -= dt) <= 0) a.cele = null;
}

// Portrait pour les menus : le joueur en pied sous un projecteur, qui suit un ballon imaginaire.
export function drawPortrait(canvas, char, side = 0, t = 0) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.4, W * 0.6); g.addColorStop(0, 'rgba(255,240,200,.75)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(W / 2, H * 0.97, W * 0.24, H * 0.035, 0, 0, TAU); c.fill();
  const u = H / 2.45, a = newAnim(); a.seed = 0;
  c.save(); c.translate(W / 2, H * 0.97); c.scale(u, u);
  drawPlayer(c, { char, side, vx: 0, vy: 0, ground: true, kickT: 0, tackleT: 0, stun: 0, power: null }, a, t, { x: 1.5 + Math.sin(t) * 0.5, y: 2.2, sp: 99 });
  c.restore();
}

/* ================= Stade ================= */
export function createPitch(canvas) {
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas'), led = document.createElement('canvas');
  let W = 0, H = 0, dpr = 1, u = 40, cx = 0, gy = 0, yb = 0, topY = 0, standBot = 0, fans = [], screenBox = null;
  const sx = x => cx + x * u, sy = y => gy - y * u;
  const anims = new Map(), parts = [], trail = [], nets = [{ amp: 0, at: 0, y: 1 }, { amp: 0, at: 0, y: 1 }];
  const exc = [0.08, 0.08];
  let shake = 0, flash = 0, flashColor = '#ffffff', ballAng = 0, demo = null, clock = 0;

  // perspective de la pelouse : profondeur d (0 au fond, 1 devant), les joueurs sont à la profondeur dG
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
    buildBg(); buildLed(); buildFans();
  }

  function buildBg() {
    bg.width = canvas.width; bg.height = canvas.height;
    const c = bg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); seed = 11;
    // ciel de nuit
    let g = c.createLinearGradient(0, 0, 0, standBot); g.addColorStop(0, '#070b24'); g.addColorStop(0.5, '#1d1a52'); g.addColorStop(1, '#5a2f6e');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 140; k++) { c.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; c.beginPath(); c.arc(rnd() * W, rnd() * topY, rnd() * 1.3 + 0.2, 0, TAU); c.fill(); }
    // lune
    c.fillStyle = 'rgba(255,245,220,.9)'; c.beginPath(); c.arc(W * 0.83, topY * 0.4, Math.max(10, u * 0.55), 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,245,220,.12)'; c.beginPath(); c.arc(W * 0.83, topY * 0.4, Math.max(24, u * 1.4), 0, TAU); c.fill();
    // structure des tribunes : gradins du fond, toit
    const rows = 16, rowH = (standBot - topY) / rows;
    g = c.createLinearGradient(0, topY, 0, standBot); g.addColorStop(0, '#221a3e'); g.addColorStop(1, '#3a2c5e');
    c.fillStyle = g; c.fillRect(0, topY - 4, W, standBot - topY + 4);
    for (let r = 0; r < rows; r++) {
      const y = standBot - r * rowH;
      c.fillStyle = r % 2 ? '#3d3066' : '#45377a'; c.fillRect(0, y - rowH * 0.42, W, rowH * 0.42); // sièges
      c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, y - rowH * 0.42, W, 1.5);
    }
    // escaliers
    for (let k = 1; k < 8; k++) { const x = (k / 8) * W; c.fillStyle = '#5a4c88'; c.fillRect(x - rowH * 0.35, topY, rowH * 0.7, standBot - topY); for (let r = 0; r < rows * 2; r++) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x - rowH * 0.35, standBot - r * rowH * 0.5, rowH * 0.7, 1.5); } }
    // toit et poutres
    c.fillStyle = '#14102a'; c.fillRect(0, topY - u * 0.9, W, u * 0.9);
    c.strokeStyle = '#2e2752'; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x < W + 40; x += u * 0.9) { c.moveTo(x, topY - u * 0.9); c.lineTo(x + u * 0.45, topY); c.lineTo(x + u * 0.9, topY - u * 0.9); }
    c.stroke();
    c.fillStyle = '#ffd23f'; c.fillRect(0, topY - 3, W, 3);
    // mâts des projecteurs
    for (const fx of [0.1, 0.34, 0.66, 0.9]) { c.fillStyle = '#1a1533'; c.fillRect(fx * W - 3, topY - u * 2.4, 6, u * 1.6); c.fillStyle = '#2b2450'; c.beginPath(); c.roundRect(fx * W - u * 1.3, topY - u * 3.2, u * 2.6, u * 1.05, 6); c.fill(); }
    // panneau d'écran géant accroché au toit
    screenBox = { x: cx - 3 * u, y: topY + 0.15 * u, w: 6 * u, h: 1.8 * u };
    // muret derrière la pelouse (sous les panneaux)
    c.fillStyle = '#18122e'; c.fillRect(0, standBot, W, yb - standBot);
    // pelouse tondue en bandes, en perspective
    for (let k = -14; k < 14; k++) {
      const x0 = k * 2.3, x1 = x0 + 2.3, a = P(x0, 0), b = P(x1, 0), cc = P(x1, 1), d = P(x0, 1);
      c.fillStyle = k % 2 ? '#3f9e3c' : '#4aae46'; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...cc); c.lineTo(...d); c.closePath(); c.fill();
    }
    for (let k = 0; k < 4000; k++) { const x = rnd() * W, y = yb + rnd() * (H - yb); c.strokeStyle = rnd() < 0.5 ? 'rgba(20,70,20,.22)' : 'rgba(170,240,140,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 2, y - 2 - rnd() * 3); c.stroke(); }
    g = c.createLinearGradient(0, yb, 0, H); g.addColorStop(0, 'rgba(0,25,10,.45)'); g.addColorStop(dG, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,.35)');
    c.fillStyle = g; c.fillRect(0, yb, W, H - yb);
    // lignes
    c.strokeStyle = 'rgba(255,255,255,.88)'; c.lineCap = 'round';
    const line = (pts, wd = 2.5) => { c.lineWidth = wd; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.stroke(); };
    const dB = 0.06, dF = 0.9, HL = F.HL;
    line([P(-HL, dB), P(HL, dB)]); line([P(-HL, dF), P(HL, dF)], 3.5);
    line([P(-HL, dB), P(-HL, dF)], 3); line([P(HL, dB), P(HL, dF)], 3); line([P(0, dB), P(0, dF)], 3);
    for (const s of [-1, 1]) {
      line([P(s * HL, 0.2), P(s * (HL - 4.2), 0.2), P(s * (HL - 4.2), 0.78), P(s * HL, 0.78)], 3);
      line([P(s * HL, 0.33), P(s * (HL - 1.6), 0.33), P(s * (HL - 1.6), 0.64), P(s * HL, 0.64)], 3);
      const [px, py] = P(s * (HL - 3), 0.5); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(px, py, 3, 2, 0, 0, TAU); c.fill();
    }
    const [ccx, ccy] = P(0, (dB + dF) / 2); c.lineWidth = 3; c.beginPath(); c.ellipse(ccx, ccy, 2.8 * u * sc(0.48), (dF - dB) * (H - yb) * 0.3, 0, 0, TAU); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ccx, ccy, 4, 2.5, 0, 0, TAU); c.fill();
    c.save(); c.translate(ccx, ccy); c.scale(1, 0.28); c.font = `900 ${Math.round(u * 1.1)}px "Baloo 2", Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.13)'; c.fillText('CABOCHE CUP', 0, 0); c.restore();
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
    const rows = 16, rowH = (standBot - topY) / rows, step = rowH * 0.8;
    const skins = ['#f2c49b', '#e0a878', '#b57a4f', '#8a5634', '#5e3a22', '#ffd8b8'], hairs = ['#2a1c14', '#6b3a1f', '#d9a441', '#111111', '#c8323a', '#eeeeee'];
    for (let r = rows - 1; r >= 0; r--) for (let x = step / 2; x < W; x += step) {
      if (((x / W) * 8) % 1 < (rowH * 0.5) / (W / 8) || ((x / W) * 8) % 1 > 1 - (rowH * 0.5) / (W / 8)) continue; // escaliers
      const y = standBot - r * rowH;
      if (screenBox && x > screenBox.x - 8 && x < screenBox.x + screenBox.w + 8 && y - rowH < screenBox.y + screenBox.h) continue;
      if (rnd() < 0.06) continue;
      const side = x < cx ? (rnd() < 0.8 ? 0 : 1) : rnd() < 0.8 ? 1 : 0, pick = rnd();
      const shirt = pick < 0.65 ? TEAM[side] : pick < 0.8 ? '#ffffff' : pick < 0.9 ? TEAM_D[side] : ['#ffd23f', '#2bd28f', '#ff8a3d'][Math.floor(rnd() * 3)];
      fans.push({ x: x + (rnd() - 0.5) * step * 0.3, y, h: rowH * (1.05 + rnd() * 0.2), side, shirt, skin: skins[Math.floor(rnd() * skins.length)], hair: hairs[Math.floor(rnd() * hairs.length)], ph: rnd() * TAU, en: rnd(), scarf: rnd() < 0.12, flag: rnd() < 0.004, cap: rnd() < 0.15 });
    }
  }

  function drawFans(c, t) {
    for (const f of fans) {
      const e = exc[f.side], hop = e > 0.35 ? Math.abs(Math.sin(t * (7 + f.en * 3) + f.ph)) * f.h * 0.32 * e : 0;
      const bob = Math.sin(t * (2.5 + f.en * 2) + f.ph) * f.h * 0.03, y = f.y + bob - hop, h = f.h;
      const arms = e > 0.3 || (f.en > 0.85 && Math.sin(t * 2 + f.ph) > 0.6);
      if (arms) { c.strokeStyle = f.shirt; c.lineWidth = h * 0.12; c.lineCap = 'round'; const wv = Math.sin(t * 10 + f.ph) * h * 0.08; c.beginPath(); c.moveTo(f.x - h * 0.14, y - h * 0.5); c.lineTo(f.x - h * 0.3 + wv, y - h * 0.95); c.moveTo(f.x + h * 0.14, y - h * 0.5); c.lineTo(f.x + h * 0.3 + wv, y - h * 0.95); c.stroke(); }
      c.fillStyle = f.shirt; c.beginPath(); c.roundRect(f.x - h * 0.2, y - h * 0.58, h * 0.4, h * 0.58, h * 0.12); c.fill();
      c.fillStyle = f.skin; c.beginPath(); c.arc(f.x, y - h * 0.74, h * 0.19, 0, TAU); c.fill();
      c.fillStyle = f.hair; c.beginPath(); c.arc(f.x, y - h * 0.78, h * 0.19, Math.PI * 1.05, Math.PI * 1.95); c.fill();
      if (f.cap) { c.fillStyle = TEAM[f.side]; c.beginPath(); c.arc(f.x, y - h * 0.8, h * 0.2, Math.PI, TAU); c.fill(); c.fillRect(f.x - h * 0.05, y - h * 0.82, h * 0.3, h * 0.06); }
      if (f.scarf && e > 0.15) { const sy2 = y - h * 1.12; c.fillStyle = TEAM[f.side]; c.fillRect(f.x - h * 0.5, sy2, h, h * 0.16); c.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) c.fillRect(f.x - h * 0.5 + k * h * 0.27, sy2, h * 0.1, h * 0.16); }
      if (f.flag) { const fw = Math.sin(t * 4 + f.ph); c.strokeStyle = '#ddd'; c.lineWidth = 2; c.beginPath(); c.moveTo(f.x + h * 0.25, y - h * 0.4); c.lineTo(f.x + h * 0.25, y - h * 2.2); c.stroke(); c.fillStyle = TEAM[f.side]; c.beginPath(); c.moveTo(f.x + h * 0.25, y - h * 2.2); c.quadraticCurveTo(f.x + h * 0.8, y - h * (2.2 - fw * 0.25), f.x + h * 1.4, y - h * (2.05 + fw * 0.1)); c.lineTo(f.x + h * 1.4, y - h * (1.55 + fw * 0.1)); c.quadraticCurveTo(f.x + h * 0.8, y - h * (1.7 + fw * 0.25), f.x + h * 0.25, y - h * 1.65); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(f.x + h * 0.25, y - h * 1.98, h * 1.1, h * 0.1); }
    }
    // flashs d'appareils photo quand ça chauffe
    const e = Math.max(...exc);
    for (let k = 0; k < e * 6; k++) if (Math.random() < 0.25) { const f = fans[Math.floor(Math.random() * fans.length)]; if (!f) break; const g = c.createRadialGradient(f.x, f.y - f.h * 0.7, 0, f.x, f.y - f.h * 0.7, f.h * 1.2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(f.x - f.h * 1.2, f.y - f.h * 1.9, f.h * 2.4, f.h * 2.4); }
  }

  function drawLights(c, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const fx of [0.1, 0.34, 0.66, 0.9]) {
      const x = fx * W, y = topY - u * 2.67, fl = 0.92 + Math.sin(t * 13 + fx * 40) * 0.04;
      let g = c.createRadialGradient(x, y, 0, x, y, u * 4.5); g.addColorStop(0, `rgba(255,248,220,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.fillRect(x - u * 4.5, y - u * 4.5, u * 9, u * 9);
      g = c.createLinearGradient(x, y, cx, gy); g.addColorStop(0, `rgba(255,250,225,${0.13 * fl})`); g.addColorStop(1, 'rgba(255,250,225,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - u * 1.1, y); c.lineTo(x + u * 1.1, y); c.lineTo(lerp(x, cx, 0.6) + u * 7, gy); c.lineTo(lerp(x, cx, 0.6) - u * 7, gy); c.closePath(); c.fill();
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { c.fillStyle = `rgba(255,252,235,${0.9 * fl})`; c.beginPath(); c.arc(x - u * 1.0 + i * u * 0.4, y - u * 0.22 + j * u * 0.42, u * 0.13, 0, TAU); c.fill(); }
    }
    c.restore();
  }

  function drawScreen(c, board, t) {
    if (!screenBox || !board) return;
    const { x, y, w, h } = screenBox;
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
    c.fillText(board.flash ? 'BUT !' : `${s0}  -  ${s1}`, x + w / 2, y + h * 0.58);
    c.font = `800 ${Math.round(h * 0.17)}px "Baloo 2", sans-serif`; c.fillStyle = '#9fe8ff'; c.fillText(board.clock ?? '', x + w / 2, y + h * 0.15);
    for (let yy = y; yy < y + h; yy += 3) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, yy, w, 1); }
  }

  // Cage : fond (filet, cadre arrière) avant les joueurs, cadre avant après.
  function goalBack(c, s, t) {
    const n = nets[s > 0 ? 1 : 0], age = t - n.at, amp = n.amp * Math.exp(-age * 2.5), dep = u * 0.45;
    const x0 = sx(s * F.HL), x1 = sx(s * WALL), yT = sy(F.GH);
    c.fillStyle = 'rgba(10,14,40,.35)'; c.fillRect(Math.min(x0, x1), yT, Math.abs(x1 - x0), gy - yT);
    // filet : grille déformée par l'impact
    const off = (xw, yw) => { const d = Math.hypot(xw - s * WALL, yw - n.y); return s * amp * Math.sin(age * 16 - d * 4) * Math.exp(-d * 0.8) * 0.25; };
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1;
    for (let yw = 0; yw <= F.GH + 0.01; yw += 0.25) { c.beginPath(); for (let xw = F.HL; xw <= WALL + 0.01; xw += 0.2) { const X = sx(s * xw + off(s * xw, yw)) - dep * 0.5 * ((xw - F.HL) / F.GD) * 0, Y = sy(yw) - dep * ((xw - F.HL) / F.GD) * 0.15; xw === F.HL ? c.moveTo(X, Y) : c.lineTo(X, Y); } c.stroke(); }
    for (let xw = F.HL; xw <= WALL + 0.01; xw += 0.2) { c.beginPath(); for (let yw = 0; yw <= F.GH + 0.01; yw += 0.2) { const X = sx(s * xw + off(s * xw, yw)), Y = sy(yw) - dep * ((xw - F.HL) / F.GD) * 0.15; yw === 0 ? c.moveTo(X, Y) : c.lineTo(X, Y); } c.stroke(); }
    // cadre du fond (profondeur)
    c.strokeStyle = 'rgba(235,240,255,.75)'; c.lineWidth = Math.max(2, u * 0.08); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, gy - dep); c.lineTo(x0, yT - dep); c.lineTo(x1, yT - dep); c.lineTo(x1, gy - dep); c.stroke();
    c.beginPath(); c.moveTo(x1, gy); c.lineTo(x1, gy - dep); c.moveTo(x1, yT); c.lineTo(x1, yT - dep); c.stroke();
  }
  function goalFront(c, s) {
    const x0 = sx(s * F.HL), x1 = sx(s * WALL), yT = sy(F.GH), w = Math.max(3, u * F.BAR * 2);
    c.lineCap = 'round';
    for (const [col, wd] of [[INK, w + 3], ['#ffffff', w]]) { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x0, yT); c.lineTo(x1, yT); c.lineTo(x1, gy); c.stroke(); }
    c.strokeStyle = 'rgba(160,170,200,.7)'; c.lineWidth = w * 0.35; c.beginPath(); c.moveTo(x0 + s * w * 0.2, gy); c.lineTo(x0 + s * w * 0.2, yT + w * 0.3); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x1, gy); c.stroke();
  }
  function glassWalls(c) {
    for (const s of [-1, 1]) {
      const x = sx(s * WALL) + s * u * 0.15, top = sy(F.CEIL);
      const g = c.createLinearGradient(x - s * u * 0.6, 0, x, 0); g.addColorStop(0, 'rgba(160,220,255,0)'); g.addColorStop(1, 'rgba(160,220,255,.16)');
      c.fillStyle = g; c.fillRect(Math.min(x, x - s * u * 0.6), top, u * 0.6, gy - top);
      c.strokeStyle = 'rgba(200,235,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, top); c.lineTo(x, gy); c.stroke();
    }
  }

  function drawBall(c, b, t, dt) {
    const r = BALL.r * u, x = sx(b.x), y = sy(b.y), sp = Math.hypot(b.vx ?? 0, b.vy ?? 0);
    ballAng += ((b.vx ?? 0) * dt) / BALL.r;
    // ombre au sol
    const hk = clamp(1 - b.y / 9, 0.25, 1); c.fillStyle = `rgba(0,0,0,${0.35 * hk})`; c.beginPath(); c.ellipse(x, gy + 2, r * 1.2 * hk, r * 0.3 * hk, 0, 0, TAU); c.fill();
    // traînée
    trail.push({ x, y, at: t }); while (trail.length && t - trail[0].at > 0.12) trail.shift();
    if (sp > 12 || b.fire) trail.forEach((p, k) => { const al = (k / trail.length) * (b.fire ? 0.55 : 0.3); c.fillStyle = b.fire ? `rgba(255,${120 + k * 8},40,${al})` : `rgba(255,255,255,${al})`; c.beginPath(); c.arc(p.x, p.y, r * (0.5 + (k / trail.length) * 0.5), 0, TAU); c.fill(); });
    if (b.fire) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.restore(); emit(b.x + (Math.random() - 0.5) * 0.3, b.y + (Math.random() - 0.5) * 0.3, { vx: -(b.vx ?? 0) * 0.1, vy: 1, life: 0.4, size: 0.18, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a1a', glow: true }); }
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e8ecf2'); g.addColorStop(1, '#a9b3c4');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.save(); c.clip(); c.rotate(ballAng);
    const pent = (px, py, pr, rot) => { c.beginPath(); for (let k = 0; k < 5; k++) { const a = rot + (k * TAU) / 5; c.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr); } c.closePath(); c.fill(); };
    c.fillStyle = '#1c1c2a'; pent(0, 0, r * 0.32, -Math.PI / 2);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * TAU) / 5 + Math.PI / 5; pent(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.3, a); }
    c.strokeStyle = 'rgba(30,30,50,.35)'; c.lineWidth = 1; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * TAU) / 5; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); c.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.stroke(); }
    c.restore();
    const sh = c.createRadialGradient(r * 0.3, r * 0.35, r * 0.2, 0, 0, r * 1.05); sh.addColorStop(0, 'rgba(0,0,30,0)'); sh.addColorStop(1, 'rgba(0,0,30,.35)'); c.fillStyle = sh; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = Math.max(1.5, u * 0.04); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.18, r * 0.11, -0.6, 0, TAU); c.fill();
    c.restore();
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
      else { if (p.glow) c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.beginPath(); c.arc(X, Y, s, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    }
    c.globalAlpha = 1;
  }

  const fx = {
    kick(e) {
      const pw = e.p ?? 15;
      emit(e.x, e.y, { kind: 'ring', size: 0.25, life: 0.3, color: e.fire ? '#ffb030' : '#ffffff' });
      for (let k = 0; k < 10 + pw * 0.6; k++) { const a = Math.random() * TAU, v = 3 + Math.random() * pw * 0.4; emit(e.x, e.y, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25, size: 0.12, color: e.fire ? '#ffb030' : '#fff8c8' }); }
      if (e.y < 0.6) fx.dust(e.x, 8);
      fx.shake(pw > 22 ? 0.6 : pw > 17 ? 0.3 : 0.12);
    },
    header(e) { emit(e.x, e.y, { kind: 'ring', size: 0.3, life: 0.3, color: '#ffffff' }); for (let k = 0; k < 6; k++) emit(e.x, e.y + 0.2, { kind: 'star', vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, g: 8, life: 0.5, size: 0.08, color: '#ffe14a', spin: 6 }); },
    spark(x, y, color = '#ffffff', n = 14) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = 2 + Math.random() * 6; emit(x, y, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35, size: 0.1, color }); } },
    dust(x, n = 6, color = '#9bd07a') { for (let k = 0; k < n; k++) emit(x + (Math.random() - 0.5) * 0.6, 0.05, { vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.6, g: 3, life: 0.5, size: 0.08 + Math.random() * 0.08, grow: 1.5, color }); },
    net(x, y, v = 10) { const n = nets[x > 0 ? 1 : 0]; n.amp = clamp(v / 12, 0.3, 1.6); n.at = clock; n.y = y; },
    goal(side) {
      const gx = side === 0 ? F.HL + 0.8 : -F.HL - 0.8;
      exc[side] = 1; exc[1 - side] = 0; flash = 0.55; flashColor = TEAM_L[side];
      fx.net(gx, 1.2, 18);
      for (let k = 0; k < 160; k++) emit((Math.random() - 0.5) * 2 * WALL, F.CEIL + Math.random() * 2, { kind: 'confetti', vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, g: 1.2, life: 4 + Math.random() * 2, size: 0.07 + Math.random() * 0.05, color: [TEAM[side], '#ffd23f', '#ffffff', TEAM_L[side]][k % 4], spin: (Math.random() - 0.5) * 10 });
      for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, v = 4 + Math.random() * 8; emit(gx, 1.3, { kind: 'streak', vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, size: 0.14, color: '#ffe680' }); }
      fx.shake(1);
    },
    shake(a) { shake = Math.max(shake, a); },
    tackle(x, dir) { fx.dust(x, 10, '#7fbf5f'); },
  };

  /* ---- Démo des menus : un ballon qui rebondit tout seul ---- */
  function stepDemo(dt) {
    demo ??= { ball: { x: 0, y: 4, vx: 3, vy: 0, fire: 0 }, k: 0 };
    for (let n = 0; n < Math.round(dt * 120); n++) CC.stepBall(demo, [], CC.DT / 2);
    const b = demo.ball;
    if (b.y < BALL.r + 0.05 && Math.abs(b.vy) < 0.5 && (demo.k += dt) > 0.6) { demo.k = 0; b.vy = 9 + Math.random() * 5; b.vx = (Math.random() - 0.5) * 16; }
    return b;
  }

  /* ---- Image ---- */
  // scene : { players: [{ id, name, char, side, x, y, vx, vy, …, me }], ball: { x, y, vx, vy, fire }, board: { names, score, clock, flash } }
  function frame(dt, t, scene) {
    clock = t;
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    shake *= Math.exp(-dt * 6); flash = Math.max(0, flash - dt);
    for (const k of [0, 1]) exc[k] = Math.max(0.08, exc[k] - dt * 0.18);
    const players = scene?.players ?? [], ball = scene?.ball ?? stepDemo(dt);
    // le public s'enflamme quand le ballon approche d'un but
    if (scene?.ball) { const near = Math.abs(ball.x) > F.HL - 5 ? (ball.x > 0 ? 0 : 1) : -1; if (near >= 0) exc[near] = Math.max(exc[near], 0.32); }
    c.save();
    if (shake > 0.01) c.translate((Math.random() - 0.5) * shake * u * 0.3, (Math.random() - 0.5) * shake * u * 0.3);
    c.drawImage(bg, 0, 0, W, H);
    drawLights(c, t);
    drawFans(c, t);
    drawScreen(c, scene?.board, t);
    // panneaux lumineux qui défilent
    const lh = led.height / dpr, lw = led.width / dpr, off = (t * 70) % lw;
    for (let x = -off; x < W; x += lw) c.drawImage(led, x, standBot, lw, lh);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, standBot, W, 1.5);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, standBot + lh, W, yb - standBot - lh);
    glassWalls(c);
    for (const s of [-1, 1]) goalBack(c, s, t);
    // ombres des joueurs
    for (const p of players) { const k = clamp(1 - p.y / 4, 0.3, 1); c.fillStyle = `rgba(0,0,0,${0.3 * k})`; c.beginPath(); c.ellipse(sx(p.x), gy + 2, u * 0.55 * k, u * 0.14 * k, 0, 0, TAU); c.fill(); }
    // joueurs
    for (const p of players) {
      const a = anims.get(p.id) ?? anims.set(p.id, newAnim()).get(p.id);
      tickAnim(a, p, dt);
      const o = players.find(q => q !== p);
      if (o && Math.abs(o.x - p.x) < 1.0 && Math.abs(o.y - p.y) < 1 && (o.vx - p.vx) * (o.x - p.x) < -4) a.bump = 0.3;
      if (p.sprint && p.ground && Math.random() < 0.5) emit(p.x - Math.sign(p.vx) * 0.3, 0.05, { vx: -p.vx * 0.2, vy: Math.random(), g: 3, life: 0.35, size: 0.07, grow: 1.5, color: '#b9e39a' });
      if (p.tackleT > 0 && Math.random() < 0.7) fx.dust(p.x, 1, '#7fbf5f');
      if (p.power) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(sx(p.x), sy(p.y + 1.2), 0, sx(p.x), sy(p.y + 1.2), u * 2); g.addColorStop(0, p.power === 'super' ? 'rgba(255,140,40,.45)' : 'rgba(190,120,255,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(sx(p.x) - u * 2, sy(p.y + 1.2) - u * 2, u * 4, u * 4); c.restore(); if (Math.random() < 0.4) emit(p.x + (Math.random() - 0.5), p.y + Math.random() * 2.4, { vy: 1.5, life: 0.5, size: 0.08, glow: true, color: p.power === 'super' ? '#ff8a2a' : '#c08aff' }); }
      if (p.gauge >= 1 && Math.random() < 0.25) emit(p.x + (Math.random() - 0.5) * 0.9, p.y + Math.random() * 2, { vy: 1.2, life: 0.6, size: 0.05, glow: true, color: '#ffe14a' });
      const s = p.side ? -1 : 1, rel = { x: (ball.x - p.x) * s, y: ball.y - p.y, sp: Math.hypot((ball.vx ?? 0) - p.vx, (ball.vy ?? 0) - p.vy) };
      c.save(); c.translate(sx(p.x), sy(p.y)); c.scale(u * s, u);
      drawPlayer(c, p, a, t, rel);
      c.restore();
    }
    drawBall(c, ball, t, dt);
    for (const s of [-1, 1]) goalFront(c, s);
    drawParts(c, dt);
    // noms au-dessus des têtes, avec l'endurance
    for (const p of players) {
      const top = sy(CC.headY(p) + CC.headR(p)) - 14, x = sx(p.x);
      c.font = '800 13px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = p.me ? `${p.name} (toi)` : p.name, w = c.measureText(label).width + 16;
      c.fillStyle = TEAM[p.side]; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2, top - 20, w, 18, 9); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillText(label, x, top - 10.5);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x - 22, top + 2, 44, 5); c.fillStyle = p.tired ? '#ff6b6b' : '#7dff9a'; c.fillRect(x - 22, top + 2, 44 * (p.sta ?? 1), 5);
      if (p.me) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x - 6, top - 26); c.lineTo(x + 6, top - 26); c.lineTo(x, top - 20); c.closePath(); c.fill(); }
    }
    c.restore();
    if (flash > 0) { c.fillStyle = flashColor; c.globalAlpha = flash * 0.6; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    const v = c.createRadialGradient(cx, H * 0.55, H * 0.35, cx, H * 0.55, Math.max(W, H) * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,20,.45)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  const celebrate = (id, kind) => { const a = anims.get(id) ?? anims.set(id, newAnim()).get(id); a.cele = kind; a.celeT = 3; };
  resize();
  return { resize, frame, fx, celebrate, toWorldX: px => (px - cx) / u };
}
