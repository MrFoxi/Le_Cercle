// Mini-golf : balle et club dessinés en 2D, pour les petits aperçus des menus (vestiaire). Le parcours, lui, est en 3D
// (world.js).
/* global GolfLooks */
const TAU = Math.PI * 2;

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
