// Les têtes des joueurs de Caboche Cup, dessinées à la main en vectoriel (Canvas), dans un repère où la tête a pour
// rayon 1 (centre en 0,0, y vers le bas, regard vers +x). Silhouettes propres à chacun (courbes de Bézier), peau à
// l'ombrage doux et reflet sur le front, grands yeux en amande (iris en dégradé, deux reflets, ligne de cils),
// bouches expressives, coiffures en volumes avec mèches claires, accessoires. Humeurs : smile, focus, grit, shout, oh,
// ouch, dizzy, joy, sad, evil, cold.
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LINE = '#2b1b24';
export const LOOKS = {
  bouboule: { skin: '#f6c7a1', shade: '#d9946e', iris: '#6b3b1d', hair: '#3a2418', hl: '#7a4f36', w: 1.1, jaw: 0.35, chin: 0.02, boot: '#ffd23f', style: 'banane' },
  lila: { skin: '#a46a43', shade: '#774a2c', iris: '#4a2814', hair: '#24140f', hl: '#5a3424', w: 0.94, jaw: 0, chin: 0.06, boot: '#6dffb0', style: 'chignons', lashes: true },
  givre: { skin: '#ffe3d1', shade: '#efb59b', iris: '#3a9cff', hair: '#e6f6ff', hl: '#ffffff', w: 1.0, jaw: 0.1, chin: 0.03, boot: '#9fe3ff', style: 'bonnet' },
  zoe: { skin: '#f7c49c', shade: '#dc9670', iris: '#2f9a48', hair: '#ff7a24', hl: '#ffbd7a', w: 0.95, jaw: 0, chin: 0.08, boot: '#ff8a3d', style: 'queue', lashes: true, freckles: true },
  tiko: { skin: '#ffd4b2', shade: '#eda27c', iris: '#3d7ce0', hair: '#7a4826', hl: '#b0764a', w: 1.0, jaw: 0.05, chin: -0.04, boot: '#ff4d6a', style: 'casquette', freckles: true, gap: true },
  magnus: { skin: '#6c4129', shade: '#4a2a18', iris: '#2f1a10', hair: '#1a110c', hl: '#3e2c22', w: 0.98, jaw: 0.3, chin: 0.06, boot: '#a46bff', style: 'brosse' },
  roco: { skin: '#eaab84', shade: '#c47f5c', iris: '#4f6b2a', hair: '#4a2f1d', hl: '#7a5236', w: 1.1, jaw: 0.75, chin: 0.05, boot: '#8d97a8', style: 'chauve', gloves: true },
  siroco: { skin: '#dba175', shade: '#b37a50', iris: '#13808f', hair: '#1fb3a2', hl: '#86f2e0', w: 0.92, jaw: 0, chin: 0.14, boot: '#25d8c0', style: 'vent' },
};
const FX = 0.2; // le visage est un peu tourné vers l'avant

function shape(c, L) {
  const w = L.w, j = L.jaw, ch = L.chin;
  c.beginPath(); c.moveTo(0, -1);
  c.bezierCurveTo(0.56 * w, -1, w, -0.62, w, -0.05);
  c.bezierCurveTo(w, 0.42 + j * 0.35, 0.55 * w + j * 0.35, 0.96 + ch, 0.1, 1 + ch);
  c.bezierCurveTo(-0.5 * w - j * 0.35, 1 + ch * 0.6, -w, 0.45 + j * 0.35, -w, -0.05);
  c.bezierCurveTo(-w, -0.62, -0.56 * w, -1, 0, -1);
  c.closePath();
}
function ink(c, w = 0.06) { c.strokeStyle = LINE; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function fillInk(c, fill, w = 0.06) { c.fillStyle = fill; c.fill(); ink(c, w); }
// Remplissage en dégradé vertical (clair en haut) pour les volumes de cheveux et de tissus.
function vol(c, top, base, y0 = -1.4, y1 = 0.4) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, base); return g; }
const lighten = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v + (255 - v) * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const darken = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * (1 - k)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

/* ---------- peau ---------- */
function skin(c, L) {
  shape(c, L); c.fillStyle = L.skin; c.fill();
  c.save(); shape(c, L); c.clip();
  let g = c.createRadialGradient(0.35, -0.4, 0.2, 0.1, 0.05, 1.45); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.62, 'rgba(0,0,0,0)'); g.addColorStop(1, darken(L.shade, 0.05));
  c.fillStyle = g; c.fillRect(-1.6, -1.6, 3.2, 3.2);
  g = c.createRadialGradient(0.15, -0.6, 0, 0.15, -0.6, 0.6); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(-1, -1.3, 2, 1.4);
  // joues
  for (const [x, a] of [[FX + 0.5, 0.55], [FX - 0.52, 0.4]]) { g = c.createRadialGradient(x, 0.42, 0, x, 0.42, 0.24); g.addColorStop(0, `rgba(255,95,110,${a})`); g.addColorStop(1, 'rgba(255,95,110,0)'); c.fillStyle = g; c.fillRect(x - 0.3, 0.12, 0.6, 0.6); }
  c.restore();
  shape(c, L); ink(c, 0.065);
}
function ear(c, L) {
  const x = -L.w * 0.93, y = 0.12;
  c.beginPath(); c.ellipse(x, y, 0.15, 0.2, -0.15, 0, TAU); fillInk(c, L.skin, 0.05);
  c.strokeStyle = L.shade; c.lineWidth = 0.05; c.beginPath(); c.arc(x + 0.02, y + 0.01, 0.08, -1.2, 1.7); c.stroke();
}

/* ---------- yeux ---------- */
function eyes(c, L, mood, lx, ly, blink, t) {
  const spots = [[FX - 0.3, 0.9], [FX + 0.31, 1]], y = 0.06;
  for (const [x, k] of spots) {
    const rx = 0.19 * k, ry = (mood === 'oh' || mood === 'shout' || mood === 'cold' ? 0.27 : 0.25) * k;
    if (mood === 'dizzy') { c.strokeStyle = LINE; c.lineWidth = 0.05; c.beginPath(); for (let a = 0; a < 12; a += 0.3) c.lineTo(x + Math.cos(a + t * 8) * a * 0.014, y + Math.sin(a + t * 8) * a * 0.014); c.stroke(); continue; }
    if (mood === 'joy' || (blink && mood !== 'ouch')) { c.strokeStyle = LINE; c.lineWidth = 0.065; c.beginPath(); mood === 'joy' ? c.arc(x, y + 0.1, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88) : c.arc(x, y - 0.02, rx, 0.3, Math.PI - 0.3); c.stroke(); continue; }
    if (mood === 'ouch' && k === 1) { c.strokeStyle = LINE; c.lineWidth = 0.065; c.beginPath(); c.moveTo(x - rx, y - ry * 0.5); c.lineTo(x + rx * 0.6, y); c.lineTo(x - rx, y + ry * 0.5); c.stroke(); continue; }
    // blanc de l'œil
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
    const gw = c.createLinearGradient(0, y - ry, 0, y + ry); gw.addColorStop(0, '#e3e6f0'); gw.addColorStop(0.35, '#ffffff'); gw.addColorStop(1, '#f4f4f8');
    c.fillStyle = gw; c.fill(); c.clip();
    // iris
    const px = x + lx * rx * 0.38, py = y + 0.03 + ly * ry * 0.3, ir = 0.15 * k * (mood === 'shout' || mood === 'oh' ? 0.85 : 1);
    const gi = c.createRadialGradient(px, py + ir * 0.4, ir * 0.1, px, py, ir); gi.addColorStop(0, lighten(L.iris, 0.45)); gi.addColorStop(0.7, L.iris); gi.addColorStop(1, darken(L.iris, 0.4));
    c.fillStyle = gi; c.beginPath(); c.arc(px, py, ir, 0, TAU); c.fill();
    c.fillStyle = '#120a10'; c.beginPath(); c.arc(px, py, ir * 0.5, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px + ir * 0.35, py - ir * 0.4, ir * 0.32, 0, TAU); c.fill();
    c.globalAlpha = 0.8; c.beginPath(); c.arc(px - ir * 0.35, py + ir * 0.4, ir * 0.15, 0, TAU); c.fill(); c.globalAlpha = 1;
    // paupière haute baissée (concentration, effort, malice)
    const lid = { focus: 0.32, grit: 0.45, evil: 0.4, cold: 0.5, sad: 0.2 }[mood] ?? 0;
    if (lid) { c.fillStyle = L.skin; c.beginPath(); c.rect(x - rx - 0.05, y - ry - 0.05, rx * 2 + 0.1, ry * 2 * lid + 0.05); c.fill(); }
    c.restore();
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.strokeStyle = LINE; c.lineWidth = 0.035; c.stroke();
    // ligne de cils (épaisse en haut), avec un petit trait au coin extérieur
    const top = y - ry + (lid ? ry * 2 * lid : 0);
    c.strokeStyle = LINE; c.lineWidth = 0.07; c.beginPath();
    if (lid) { c.moveTo(x - rx * 0.98, top); c.lineTo(x + rx * 0.98, top); } else c.ellipse(x, y, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
    if (L.lashes) { c.lineWidth = 0.04; c.beginPath(); c.moveTo(x + rx * 0.75, top + 0.05); c.lineTo(x + rx * 1.15, top - 0.06); c.moveTo(x + rx * 0.4, top - 0.01); c.lineTo(x + rx * 0.62, top - 0.12); c.stroke(); }
    if (mood === 'sad') { c.fillStyle = 'rgba(110,200,255,.9)'; c.beginPath(); c.ellipse(x + rx * 0.3, y + ry + 0.05 + ((t * 0.9) % 1) * 0.35, 0.05, 0.08, 0, 0, TAU); c.fill(); }
  }
}
function brows(c, L, mood) {
  const tilt = { grit: 0.3, focus: 0.22, evil: 0.4, sad: -0.35, oh: -0.12, shout: 0.18, ouch: -0.25, cold: -0.25, dizzy: -0.1 }[mood] ?? 0;
  const lift = mood === 'oh' || mood === 'shout' ? -0.07 : mood === 'joy' ? -0.05 : 0;
  c.strokeStyle = L.style === 'bonnet' ? '#a7d8f5' : L.style === 'chauve' ? L.hair : darken(L.hair, 0.1); c.lineCap = 'round';
  c.lineWidth = L.style === 'chauve' || L.style === 'banane' ? 0.12 : 0.085;
  for (const [x, dir] of [[FX - 0.3, 1], [FX + 0.31, -1]]) {
    const y = -0.26 + lift;
    c.beginPath(); c.moveTo(x - 0.15, y + tilt * 0.1 * dir * -1 + 0.02); c.quadraticCurveTo(x, y - 0.06, x + 0.16, y + tilt * 0.1 * dir + 0.02); c.stroke();
  }
}
function nose(c, L) {
  const x = FX + 0.02, y = 0.33, big = L.style === 'chauve' ? 1.35 : L.style === 'banane' ? 1.2 : 1;
  c.fillStyle = darken(L.skin, 0.12); c.beginPath(); c.ellipse(x - 0.02, y + 0.03 * big, 0.1 * big, 0.06 * big, 0, 0, TAU); c.fill();
  c.strokeStyle = darken(L.shade, 0.25); c.lineWidth = 0.04; c.beginPath(); c.arc(x, y, 0.09 * big, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x + 0.03, y - 0.06 * big, 0.04, 0.025, -0.4, 0, TAU); c.fill();
  if (L.style === 'bonnet') { c.fillStyle = 'rgba(255,80,90,.55)'; c.beginPath(); c.arc(x, y + 0.02, 0.07, 0, TAU); c.fill(); } // nez rougi par le froid
}
function mouth(c, L, mood) {
  const x = FX + 0.02, y = 0.62;
  c.lineCap = 'round';
  if (mood === 'shout' || mood === 'ouch') {
    c.beginPath(); c.ellipse(x, y + 0.04, 0.17, mood === 'shout' ? 0.2 : 0.12, 0, 0, TAU); fillInk(c, '#6e1626', 0.05);
    c.save(); c.clip(); c.fillStyle = '#ffffff'; c.fillRect(x - 0.2, y - 0.2, 0.4, 0.09); c.fillStyle = '#ff6f86'; c.beginPath(); c.ellipse(x, y + 0.2, 0.12, 0.08, 0, 0, TAU); c.fill(); c.restore();
  } else if (mood === 'oh' || mood === 'cold') {
    c.beginPath(); c.ellipse(x, y + 0.02, 0.08, 0.1, 0, 0, TAU); fillInk(c, '#6e1626', 0.05);
  } else if (mood === 'joy' || mood === 'evil') {
    c.beginPath(); c.moveTo(x - 0.27, y - 0.05); c.quadraticCurveTo(x, y + (mood === 'joy' ? 0.42 : 0.3), x + 0.27, y - 0.07); c.quadraticCurveTo(x, y + 0.02, x - 0.27, y - 0.05); fillInk(c, '#6e1626', 0.05);
    c.save(); c.clip(); c.fillStyle = '#ffffff'; c.fillRect(x - 0.3, y - 0.1, 0.6, 0.12); c.fillStyle = '#ff6f86'; c.beginPath(); c.ellipse(x, y + 0.25, 0.14, 0.09, 0, 0, TAU); c.fill(); c.restore();
    if (L.gap) { c.fillStyle = '#6e1626'; c.fillRect(x - 0.015, y - 0.04, 0.03, 0.06); }
  } else if (mood === 'grit') {
    c.beginPath(); c.roundRect(x - 0.2, y - 0.07, 0.4, 0.15, 0.06); fillInk(c, '#ffffff', 0.05);
    c.strokeStyle = '#b9b2c2'; c.lineWidth = 0.02; c.beginPath(); c.moveTo(x - 0.2, y); c.lineTo(x + 0.2, y); for (const k of [-0.1, 0, 0.1]) { c.moveTo(x + k, y - 0.07); c.lineTo(x + k, y + 0.08); } c.stroke();
  } else if (mood === 'sad') { c.strokeStyle = LINE; c.lineWidth = 0.055; c.beginPath(); c.moveTo(x - 0.15, y + 0.08); c.quadraticCurveTo(x, y - 0.06, x + 0.15, y + 0.08); c.stroke(); }
  else if (mood === 'dizzy') { c.strokeStyle = LINE; c.lineWidth = 0.05; c.beginPath(); c.moveTo(x - 0.16, y); for (let k = 1; k <= 6; k++) c.lineTo(x - 0.16 + k * 0.055, y + (k % 2 ? 0.05 : -0.03)); c.stroke(); }
  else if (mood === 'focus') { c.strokeStyle = LINE; c.lineWidth = 0.055; c.beginPath(); c.moveTo(x - 0.12, y + 0.02); c.quadraticCurveTo(x + 0.02, y + 0.06, x + 0.15, y - 0.02); c.stroke(); }
  else {
    c.beginPath(); c.moveTo(x - 0.22, y - 0.03); c.quadraticCurveTo(x, y + 0.22, x + 0.22, y - 0.05); c.quadraticCurveTo(x, y + 0.07, x - 0.22, y - 0.03); fillInk(c, '#6e1626', 0.045);
    c.save(); c.clip(); c.fillStyle = '#ffffff'; c.fillRect(x - 0.25, y - 0.06, 0.5, 0.07); c.restore();
    if (L.gap) { c.fillStyle = '#6e1626'; c.fillRect(x - 0.012, y - 0.03, 0.024, 0.05); }
    c.strokeStyle = darken(L.shade, 0.2); c.lineWidth = 0.03; c.beginPath(); c.arc(x + 0.27, y - 0.06, 0.05, -0.6, 1); c.stroke(); // fossette
  }
}
function freckles(c, L) { c.fillStyle = darken(L.shade, 0.15); for (const [x, y] of [[0.42, 0.3], [0.52, 0.36], [0.47, 0.42], [0.6, 0.3], [-0.2, 0.33], [-0.1, 0.38]]) { c.beginPath(); c.arc(FX + x - 0.2, y, 0.022, 0, TAU); c.fill(); } }

/* ---------- coiffures ---------- */
function backHair(c, L, t, swing, speed) {
  if (L.style === 'chignons') for (const [x, y, r] of [[-0.62, -0.88, 0.5], [0.42, -1.02, 0.47]]) puff(c, x, y, r, L);
  if (L.style === 'queue') { // queue de cheval haute qui se balance
    const sw = Math.sin(t * 6) * 0.12 + swing * 0.7;
    c.beginPath(); c.moveTo(-0.45, -0.85); c.bezierCurveTo(-1.35, -1.25 + sw * 0.4, -1.65 - sw * 0.3, -0.1, -1.25 - sw * 0.5, 0.75);
    c.bezierCurveTo(-1.15, 0.2, -1.05, -0.35, -0.2, -0.62); c.closePath(); c.fillStyle = vol(c, L.hl, L.hair, -1.2, 0.8); c.fill(); ink(c, 0.06);
    c.strokeStyle = L.hl; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.7, -0.95); c.bezierCurveTo(-1.2, -1.0, -1.35, -0.3, -1.2 - sw * 0.4, 0.4); c.stroke();
  }
  if (L.style === 'vent') { // longues mèches tirées vers l'arrière par la course
    for (let k = 0; k < 5; k++) {
      const y0 = -0.85 + k * 0.32, len = 0.9 + speed * 0.07 + (k % 2) * 0.2, wv = Math.sin(t * 9 + k * 1.3) * 0.12;
      c.beginPath(); c.moveTo(-0.3, y0 - 0.1); c.bezierCurveTo(-0.9, y0 - 0.3 + wv, -1.0 - len * 0.6, y0 - 0.05 - wv, -1.0 - len, y0 + 0.2 + wv);
      c.bezierCurveTo(-1.0 - len * 0.5, y0 + 0.28, -0.8, y0 + 0.25, -0.2, y0 + 0.2); c.closePath();
      c.fillStyle = k % 2 ? L.hair : darken(L.hair, 0.15); c.fill(); ink(c, 0.05);
      c.strokeStyle = L.hl; c.lineWidth = 0.035; c.beginPath(); c.moveTo(-0.5, y0); c.quadraticCurveTo(-1.0, y0 - 0.1 + wv, -0.9 - len * 0.8, y0 + 0.12 + wv); c.stroke();
    }
  }
}
function puff(c, x, y, r, L) { // chignon afro : un nuage de boucles
  c.beginPath();
  for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU; c.arc(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, r * 0.3, a - 1.3, a + 1.3); }
  c.closePath(); c.fillStyle = vol(c, L.hl, L.hair, y - r, y + r); c.fill(); ink(c, 0.06);
  c.strokeStyle = L.hl; c.lineWidth = 0.035; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x - r * 0.2 + (k % 2) * r * 0.35, y - r * 0.25 + Math.floor(k / 2) * r * 0.35, r * 0.13, 3.6, 5.8); c.stroke(); }
}
function frontHair(c, L, t) {
  const s = L.style;
  if (s === 'banane') { // banane (pompadour) et pattes
    c.beginPath(); c.moveTo(-1.08, 0.2); c.bezierCurveTo(-1.16, -0.65, -0.62, -1.08, 0.1, -1.07); c.bezierCurveTo(0.7, -1.05, 1.06, -0.72, 1.07, -0.36); c.bezierCurveTo(0.8, -0.52, 0.4, -0.6, 0.02, -0.54); c.bezierCurveTo(-0.38, -0.48, -0.62, -0.2, -0.66, 0.2); c.closePath();
    c.fillStyle = vol(c, L.hl, L.hair); c.fill(); ink(c);
    c.beginPath(); c.moveTo(-0.55, -0.82); c.bezierCurveTo(-0.45, -1.55, 0.55, -1.62, 1.0, -1.25); c.bezierCurveTo(1.12, -1.12, 1.0, -0.86, 0.8, -0.82); c.bezierCurveTo(0.95, -1.0, 0.75, -1.05, 0.55, -0.98); c.bezierCurveTo(0.2, -0.78, -0.2, -0.74, -0.55, -0.82); c.closePath();
    c.fillStyle = vol(c, L.hl, L.hair, -1.6, -0.7); c.fill(); ink(c);
    c.strokeStyle = L.hl; c.lineWidth = 0.045; c.beginPath(); c.moveTo(-0.3, -1.05); c.bezierCurveTo(0.0, -1.42, 0.5, -1.42, 0.85, -1.18); c.stroke(); c.beginPath(); c.moveTo(-0.15, -0.92); c.quadraticCurveTo(0.3, -1.15, 0.6, -1.0); c.stroke();
    c.beginPath(); c.roundRect(-0.78, -0.05, 0.14, 0.38, 0.06); c.fillStyle = L.hair; c.fill(); // patte
    // moustache en guidon
    const x = FX + 0.02, y = 0.47;
    c.beginPath(); c.moveTo(x, y - 0.03); c.bezierCurveTo(x - 0.15, y - 0.12, x - 0.32, y - 0.05, x - 0.36, y + 0.05); c.bezierCurveTo(x - 0.3, y + 0.0, x - 0.2, y + 0.06, x, y + 0.03);
    c.bezierCurveTo(x + 0.2, y + 0.06, x + 0.3, y + 0.0, x + 0.36, y + 0.05); c.bezierCurveTo(x + 0.32, y - 0.05, x + 0.15, y - 0.12, x, y - 0.03); c.fillStyle = L.hair; c.fill(); ink(c, 0.04);
  } else if (s === 'chignons') {
    c.beginPath(); c.moveTo(-1.0, 0.25); c.bezierCurveTo(-1.08, -0.55, -0.6, -1.06, 0.05, -1.04); c.bezierCurveTo(0.6, -1.02, 0.95, -0.7, 0.98, -0.32);
    c.bezierCurveTo(0.6, -0.55, 0.2, -0.6, -0.15, -0.5); c.bezierCurveTo(-0.5, -0.4, -0.65, -0.1, -0.68, 0.3); c.closePath(); c.fillStyle = vol(c, L.hl, L.hair); c.fill(); ink(c);
    c.strokeStyle = '#ff5fa2'; c.lineWidth = 0.16; c.beginPath(); c.moveTo(-0.95, -0.38); c.bezierCurveTo(-0.6, -0.86, 0.4, -0.95, 0.92, -0.5); c.stroke();
    c.fillStyle = '#ffffff'; for (const [x, y] of [[-0.6, -0.68], [-0.2, -0.82], [0.2, -0.82], [0.6, -0.68]]) { c.beginPath(); c.arc(x, y, 0.03, 0, TAU); c.fill(); }
    c.strokeStyle = '#ffcf3d'; c.lineWidth = 0.05; c.beginPath(); c.arc(-0.95, 0.42, 0.11, 0, TAU); c.stroke(); // boucle d'oreille
  } else if (s === 'bonnet') {
    for (const [x, y, a] of [[-0.95, -0.15, 2.4], [-0.85, 0.1, 2.0], [0.55, -0.5, -0.4], [0.82, -0.36, -0.7]]) { c.beginPath(); c.ellipse(x, y, 0.16, 0.09, a, 0, TAU); c.fillStyle = L.hair; c.fill(); ink(c, 0.04); }
    c.beginPath(); c.moveTo(-1.02, -0.4); c.bezierCurveTo(-1.08, -1.3, 1.08, -1.3, 1.02, -0.4); c.closePath(); c.fillStyle = vol(c, '#6fb0ff', '#2f6fd2', -1.2, -0.4); c.fill(); ink(c);
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 0.05; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * 0.25, -0.38); c.quadraticCurveTo(k * 0.27, -0.8, k * 0.2, -1.05); c.stroke(); }
    c.beginPath(); c.moveTo(-1.06, -0.36); c.bezierCurveTo(-0.6, -0.6, 0.6, -0.6, 1.06, -0.36); c.lineTo(1.04, -0.56); c.bezierCurveTo(0.6, -0.8, -0.6, -0.8, -1.04, -0.56); c.closePath(); fillInk(c, '#f4f8ff', 0.05);
    c.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; c.arc(0.05 + Math.cos(a) * 0.17, -1.2 + Math.sin(a) * 0.17, 0.09, a - 1.4, a + 1.4); } c.closePath(); fillInk(c, '#ffffff', 0.045); // pompon
  } else if (s === 'queue') {
    c.beginPath(); c.moveTo(-0.98, 0.2); c.bezierCurveTo(-1.08, -0.6, -0.55, -1.06, 0.1, -1.04); c.bezierCurveTo(0.7, -1.0, 1.02, -0.6, 0.98, -0.12);
    c.bezierCurveTo(0.8, -0.38, 0.55, -0.42, 0.3, -0.36); c.bezierCurveTo(0.42, -0.55, 0.15, -0.6, -0.05, -0.5); c.bezierCurveTo(-0.45, -0.38, -0.62, -0.1, -0.66, 0.25); c.closePath();
    c.fillStyle = vol(c, L.hl, L.hair); c.fill(); ink(c);
    c.strokeStyle = L.hl; c.lineWidth = 0.045; c.beginPath(); c.moveTo(-0.5, -0.8); c.quadraticCurveTo(0.1, -1.0, 0.6, -0.75); c.stroke();
    c.strokeStyle = '#2bd28f'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(-0.97, -0.25); c.bezierCurveTo(-0.6, -0.72, 0.5, -0.8, 0.98, -0.4); c.stroke();
    c.beginPath(); c.arc(-0.5, -0.92, 0.1, 0, TAU); fillInk(c, '#2bd28f', 0.04); // élastique
  } else if (s === 'casquette') {
    c.beginPath(); c.moveTo(0.35, -0.62); c.quadraticCurveTo(0.75, -0.62, 0.82, -0.32); c.quadraticCurveTo(0.6, -0.45, 0.5, -0.32); c.quadraticCurveTo(0.42, -0.5, 0.2, -0.45); c.closePath(); c.fillStyle = L.hair; c.fill(); ink(c, 0.045); // mèche
    c.beginPath(); c.ellipse(-1.0, -0.42, 0.55, 0.13, 0.18, 0, TAU); fillInk(c, '#c8213a'); // visière à l'envers
    c.beginPath(); c.moveTo(-1.02, -0.32); c.bezierCurveTo(-1.08, -1.22, 1.08, -1.22, 1.02, -0.32); c.bezierCurveTo(0.5, -0.5, -0.5, -0.5, -1.02, -0.32); c.closePath(); c.fillStyle = vol(c, '#ff7383', '#e5223d', -1.1, -0.3); c.fill(); ink(c);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.1, -0.45); c.quadraticCurveTo(-0.05, -0.85, 0.05, -1.08); c.stroke();
    c.beginPath(); c.arc(0.05, -1.08, 0.08, 0, TAU); fillInk(c, '#e5223d', 0.04);
    c.beginPath(); c.arc(0.45, -0.75, 0.12, 0, TAU); fillInk(c, '#ffffff', 0.03); c.fillStyle = '#e5223d'; c.beginPath(); c.arc(0.45, -0.75, 0.05, 0, TAU); c.fill(); // écusson
  } else if (s === 'brosse') { // coupe en brosse, raie rasée, lunettes posées dessus
    c.beginPath(); c.moveTo(-0.95, -0.15); c.lineTo(-0.88, -1.3); c.quadraticCurveTo(-0.87, -1.46, -0.7, -1.46); c.lineTo(0.72, -1.46); c.quadraticCurveTo(0.88, -1.46, 0.88, -1.3); c.lineTo(0.9, -0.55);
    c.quadraticCurveTo(0.6, -0.62, 0.25, -0.58); c.lineTo(-0.3, -0.55); c.quadraticCurveTo(-0.6, -0.5, -0.66, -0.12); c.closePath(); c.fillStyle = vol(c, L.hl, L.hair, -1.5, -0.2); c.fill(); ink(c);
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 0.03; for (let k = -0.7; k < 0.8; k += 0.14) { c.beginPath(); c.moveTo(k, -1.46); c.lineTo(k, -0.75); c.stroke(); }
    c.strokeStyle = L.skin; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.92, -0.75); c.quadraticCurveTo(-0.6, -0.9, -0.4, -0.85); c.stroke(); // raie rasée
    for (const x of [-0.3, 0.35]) { c.beginPath(); c.roundRect(x - 0.26, -1.3, 0.52, 0.3, 0.12); c.fillStyle = vol(c, '#4b4b6a', '#101018', -1.3, -1.0); c.fill(); ink(c, 0.045); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(x - 0.15, -1.22); c.lineTo(x + 0.02, -1.22); c.stroke(); }
    c.strokeStyle = '#ffd23f'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.04, -1.18); c.lineTo(0.09, -1.18); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-0.9, 0.36, 0.05, 0, TAU); c.fill(); // clou d'oreille
    c.beginPath(); c.ellipse(FX + 0.02, 0.92, 0.1, 0.08, 0, 0, TAU); c.fillStyle = L.hair; c.fill(); // bouc
  } else if (s === 'chauve') {
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(0.1, -0.72, 0.32, 0.1, -0.25, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.52, -0.55, 0.08, 0.05, -0.6, 0, TAU); c.fill();
    c.save(); c.translate(-0.45, -0.72); c.rotate(-0.5); c.beginPath(); c.roundRect(-0.2, -0.07, 0.4, 0.14, 0.05); fillInk(c, '#fff0e0', 0.035); c.fillStyle = '#f2b4a0'; c.fillRect(-0.06, -0.06, 0.12, 0.12); c.restore(); // pansement
  } else if (s === 'vent') {
    c.beginPath(); c.moveTo(-0.98, 0.22); c.bezierCurveTo(-1.08, -0.6, -0.6, -1.06, 0.05, -1.05); c.bezierCurveTo(0.6, -1.04, 1.0, -0.72, 1.04, -0.3);
    c.bezierCurveTo(0.6, -0.62, 0.0, -0.48, -0.3, -0.5); c.bezierCurveTo(-0.55, -0.35, -0.68, -0.05, -0.7, 0.28); c.closePath(); c.fillStyle = vol(c, L.hl, L.hair); c.fill(); ink(c);
    c.strokeStyle = L.hl; c.lineWidth = 0.045; c.beginPath(); c.moveTo(-0.6, -0.85); c.quadraticCurveTo(0.1, -1.05, 0.8, -0.62); c.stroke();
    c.strokeStyle = '#3a2b22'; c.lineWidth = 0.09; c.beginPath(); c.moveTo(-0.98, -0.32); c.bezierCurveTo(-0.6, -0.75, 0.5, -0.82, 1.0, -0.45); c.stroke(); // sangle
    for (const x of [0.02, 0.5]) { c.beginPath(); c.arc(x, -0.62, 0.19, 0, TAU); const g = c.createRadialGradient(x - 0.06, -0.68, 0.02, x, -0.62, 0.19); g.addColorStop(0, '#ffe7a8'); g.addColorStop(1, '#e88a1a'); c.fillStyle = g; c.fill(); c.strokeStyle = '#9aa3b5'; c.lineWidth = 0.06; c.stroke(); ink(c, 0.03); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - 0.06, -0.69, 0.06, 0.035, -0.6, 0, TAU); c.fill(); }
  }
}
function beard(c, L) { // barbe de Roco (sous la bouche)
  const x = FX;
  c.beginPath(); c.moveTo(-0.85, 0.05); c.bezierCurveTo(-0.9, 0.8, -0.35, 1.18, x + 0.05, 1.16); c.bezierCurveTo(0.6, 1.16, 1.0, 0.75, 1.02, 0.12);
  c.lineTo(0.82, 0.25); c.bezierCurveTo(0.7, 0.45, 0.5, 0.48, x + 0.3, 0.5); c.quadraticCurveTo(x, 0.42, x - 0.3, 0.5); c.bezierCurveTo(-0.45, 0.5, -0.62, 0.35, -0.68, 0.1); c.closePath();
  c.fillStyle = vol(c, L.hl, L.hair, 0, 1.2); c.fill(); ink(c);
  c.strokeStyle = L.hl; c.lineWidth = 0.03; for (const [a, b] of [[-0.5, 0.75], [-0.2, 0.9], [0.4, 0.85], [0.7, 0.6]]) { c.beginPath(); c.moveTo(a, b - 0.1); c.lineTo(a + 0.03, b + 0.06); c.stroke(); }
  c.beginPath(); c.moveTo(x - 0.33, 0.52); c.bezierCurveTo(x - 0.15, 0.38, x + 0.15, 0.38, x + 0.36, 0.5); c.bezierCurveTo(x + 0.2, 0.47, x - 0.15, 0.47, x - 0.33, 0.52); c.fillStyle = L.hair; c.fill(); ink(c, 0.04); // moustache
}

/* ---------- accessoires ---------- */
function accessory(c, acc, t, team) {
  if (!acc || acc === 'aucun') return;
  if (acc === 'casquette') { c.beginPath(); c.ellipse(0.98, -0.42, 0.52, 0.12, -0.15, 0, TAU); fillInk(c, darken(team, 0.25)); c.beginPath(); c.moveTo(-1.02, -0.36); c.bezierCurveTo(-1.08, -1.24, 1.08, -1.24, 1.02, -0.36); c.bezierCurveTo(0.5, -0.52, -0.5, -0.52, -1.02, -0.36); c.closePath(); c.fillStyle = vol(c, lighten(team, 0.3), team, -1.1, -0.3); c.fill(); ink(c); }
  if (acc === 'bandana') { c.strokeStyle = '#e8263c'; c.lineWidth = 0.22; c.beginPath(); c.moveTo(-1.0, -0.42); c.bezierCurveTo(-0.6, -0.85, 0.5, -0.9, 1.0, -0.48); c.stroke(); c.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(-0.75 + k * 0.32, -0.68 + Math.abs(k - 2.5) * 0.05, 0.035, 0, TAU); c.fill(); } c.beginPath(); c.moveTo(-0.95, -0.5); c.lineTo(-1.4, -0.3 + Math.sin(t * 8) * 0.06); c.lineTo(-1.3, -0.08); c.closePath(); fillInk(c, '#e8263c', 0.04); }
  if (acc === 'lunettes') { for (const x of [FX - 0.3, FX + 0.31]) { c.beginPath(); c.roundRect(x - 0.24, -0.1, 0.48, 0.32, 0.13); c.fillStyle = vol(c, '#4b4b6a', '#0e0e16', -0.1, 0.22); c.fill(); ink(c, 0.05); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 0.035; c.beginPath(); c.moveTo(x - 0.12, -0.02); c.lineTo(x + 0.04, -0.02); c.stroke(); } c.strokeStyle = LINE; c.lineWidth = 0.05; c.beginPath(); c.moveTo(FX - 0.06, 0.0); c.lineTo(FX + 0.07, 0.0); c.moveTo(FX - 0.54, 0.02); c.lineTo(-0.9, 0.0); c.stroke(); }
  if (acc === 'cornes') for (const x of [-0.5, 0.42]) { c.beginPath(); c.moveTo(x - 0.15, -0.88); c.quadraticCurveTo(x - 0.05, -1.5, x + 0.24, -1.45); c.quadraticCurveTo(x + 0.04, -1.22, x + 0.15, -0.9); c.closePath(); c.fillStyle = vol(c, '#ff6a6a', '#c8102a', -1.5, -0.9); c.fill(); ink(c, 0.05); }
  if (acc === 'aureole') { const y = -1.42 + Math.sin(t * 3) * 0.04; c.strokeStyle = LINE; c.lineWidth = 0.15; c.beginPath(); c.ellipse(0, y, 0.6, 0.16, 0, 0, TAU); c.stroke(); c.strokeStyle = '#ffe14a'; c.lineWidth = 0.09; c.stroke(); }
  if (acc === 'couronne') { c.beginPath(); c.moveTo(-0.52, -0.9); c.lineTo(-0.58, -1.45); c.lineTo(-0.27, -1.18); c.lineTo(0, -1.55); c.lineTo(0.27, -1.18); c.lineTo(0.58, -1.45); c.lineTo(0.52, -0.9); c.quadraticCurveTo(0, -0.98, -0.52, -0.9); c.closePath(); c.fillStyle = vol(c, '#fff3a0', '#e5a800', -1.55, -0.9); c.fill(); ink(c, 0.05); for (const [x, col] of [[-0.3, '#ff3b55'], [0, '#3d8bff'], [0.3, '#2bd28f']]) { c.beginPath(); c.arc(x, -1.04, 0.065, 0, TAU); fillInk(c, col, 0.025); } }
}

// Dessine la tête (rayon R, unités du dessin appelant). mood : humeur ; lx, ly : regard (-1 à 1) ; swing : balancement des
// cheveux ; speed : vitesse de course ; acc : accessoire ; team : couleur de l'équipe.
export function drawHead(c, R, id, mood, lx, ly, blink, t, swing = 0, speed = 0, acc = 'aucun', team = '#ff4d4d') {
  const L = LOOKS[id] ?? LOOKS.bouboule;
  c.save(); c.scale(R, R);
  backHair(c, L, t, clamp(swing, -0.5, 0.5), speed);
  if (!['chignons', 'vent', 'queue'].includes(L.style)) ear(c, L);
  skin(c, L);
  if (['chignons', 'vent', 'queue'].includes(L.style)) ear(c, L);
  if (L.freckles) freckles(c, L);
  if (L.style === 'chauve') beard(c, L);
  eyes(c, L, mood, clamp(lx, -1, 1), clamp(ly, -1, 1), blink, t);
  brows(c, L, mood);
  nose(c, L);
  mouth(c, L, mood);
  frontHair(c, L, t);
  if (mood === 'cold') { c.save(); shape(c, L); c.clip(); c.fillStyle = 'rgba(120,200,255,.25)'; c.fillRect(-1.5, -1.5, 3, 3); c.restore(); }
  accessory(c, acc, t, team);
  c.restore();
}
