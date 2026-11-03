// Little Fisher : illustration de chaque poisson pour le carnet (dessinée au canvas d'après look : forme, couleurs, motif).
const cache = new Map();

// Renvoie une image (dataURL). silhouette : pour les espèces pas encore pêchées.
export function fishImage(f, silhouette = false) {
  const key = f.id + silhouette;
  if (cache.has(key)) return cache.get(key);
  const W = 240, H = 140, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), L = f.look;
  g.translate(W / 2, H / 2);
  const body = silhouette ? '#24384a' : L.body, belly = silhouette ? '#24384a' : L.belly, acc = silhouette ? '#1c2c3a' : L.accent;
  const grad = () => { const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, shade(body, -0.18)); gr.addColorStop(0.5, body); gr.addColorStop(1, belly); return gr; };

  // contour du corps selon la forme ; a : demi-longueur, b : demi-hauteur
  const dims = { long: [78, 22], rond: [62, 38], plat: [70, 34], anguille: [100, 13], calmar: [70, 20], raie: [60, 46], epee: [70, 20] }[L.shape];
  const [a, b] = dims;
  g.save();
  g.lineJoin = 'round';
  g.strokeStyle = silhouette ? '#122230' : shade(body, -0.45); g.lineWidth = 3;
  if (L.shape === 'raie') {
    g.beginPath(); g.moveTo(-a, 0); g.quadraticCurveTo(0, -b * 1.4, a * 0.9, -b * 0.2); g.lineTo(a, 0); g.lineTo(a * 0.9, b * 0.2); g.quadraticCurveTo(0, b * 1.4, -a, 0); g.closePath();
    g.fillStyle = grad(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-a, 0); g.lineTo(-a - 40, 4); g.stroke();
  } else if (L.shape === 'calmar') {
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-a * 0.6, (k - 2.5) * 4); g.bezierCurveTo(-a - 10, (k - 2.5) * 9, -a - 20, (k - 2.5) * 14 + 8, -a - 34, (k - 2.5) * 10); g.strokeStyle = silhouette ? '#24384a' : body; g.lineWidth = 4; g.stroke(); }
    g.strokeStyle = silhouette ? '#122230' : shade(body, -0.45); g.lineWidth = 3;
    g.beginPath(); g.moveTo(-a * 0.6, -b); g.quadraticCurveTo(a * 0.7, -b * 1.1, a, 0); g.quadraticCurveTo(a * 0.7, b * 1.1, -a * 0.6, b); g.closePath();
    g.fillStyle = grad(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(a * 0.5, -b * 0.8); g.lineTo(a + 8, -b * 1.3); g.lineTo(a * 0.9, -2); g.fill();
  } else {
    // nageoire caudale
    g.beginPath();
    if (L.shape === 'anguille') { g.moveTo(-a + 6, 0); g.lineTo(-a - 14, -8); g.lineTo(-a - 14, 8); }
    else { g.moveTo(-a + 10, 0); g.lineTo(-a - 26, -b * 0.95); g.quadraticCurveTo(-a - 12, 0, -a - 26, b * 0.95); }
    g.closePath(); g.fillStyle = silhouette ? '#1c2c3a' : acc; g.fill(); g.stroke();
    // nageoire dorsale
    g.beginPath(); g.moveTo(-a * 0.35, -b * 0.85); g.quadraticCurveTo(0, -b * 1.75, a * 0.3, -b * 0.85); g.closePath(); g.fillStyle = silhouette ? '#1c2c3a' : acc; g.fill(); g.stroke();
    // corps
    g.beginPath(); g.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); g.fillStyle = grad(); g.fill();
    if (L.shape === 'epee') { g.beginPath(); g.moveTo(a - 6, -4); g.lineTo(a + 52, 0); g.lineTo(a - 6, 5); g.fillStyle = silhouette ? '#24384a' : shade(body, -0.2); g.fill(); }
    g.save(); g.beginPath(); g.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); g.clip();
    if (!silhouette) pattern(g, L, a, b);
    g.restore();
    g.beginPath(); g.ellipse(0, 0, a, b, 0, 0, Math.PI * 2); g.stroke();
    // nageoire pectorale
    g.beginPath(); g.moveTo(a * 0.25, b * 0.2); g.quadraticCurveTo(a * 0.05, b * 0.75, -a * 0.12, b * 0.55); g.closePath(); g.fillStyle = silhouette ? '#1c2c3a' : shade(acc, 0.1); g.fill(); g.stroke();
  }
  // œil
  if (L.shape !== 'raie') {
    const ex = L.shape === 'calmar' ? a * 0.45 : a * 0.62, ey = L.shape === 'anguille' ? -3 : -b * 0.22;
    g.beginPath(); g.arc(ex, ey, L.shape === 'anguille' ? 4 : 7, 0, 7); g.fillStyle = silhouette ? '#3a5266' : '#fff'; g.fill();
    if (!silhouette) { g.beginPath(); g.arc(ex + 1.5, ey, L.shape === 'anguille' ? 2.2 : 4, 0, 7); g.fillStyle = '#111'; g.fill(); }
    if (L.pattern === 'lure' && !silhouette) { g.strokeStyle = shade(body, -0.3); g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 4, ey - 6); g.quadraticCurveTo(ex + 10, -b - 26, ex + 26, -b - 10); g.stroke(); glow(g, ex + 26, -b - 8, L.accent, 10); }
  }
  if (L.pattern === 'crown' && !silhouette) { g.fillStyle = L.accent; g.beginPath(); const cx = a * 0.5, cy = -b - 4; g.moveTo(cx - 14, cy); for (let k = 0; k < 5; k++) g.lineTo(cx - 14 + k * 7, cy - (k % 2 ? 4 : 13)); g.lineTo(cx + 14, cy); g.closePath(); g.fill(); }
  g.restore();
  if (silhouette) { g.font = '700 34px Fredoka, sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2); }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function pattern(g, L, a, b) {
  const acc = L.accent;
  switch (L.pattern) {
    case 'stripes': g.fillStyle = acc; g.globalAlpha = 0.55; for (let x = -a; x < a; x += 16) { g.beginPath(); g.moveTo(x, -b); g.quadraticCurveTo(x + 8, 0, x, b * 0.2); g.lineTo(x + 5, b * 0.2); g.quadraticCurveTo(x + 13, 0, x + 5, -b); g.fill(); } break;
    case 'spots': g.fillStyle = acc; g.globalAlpha = 0.6; for (let k = 0; k < 22; k++) { const x = ((k * 37) % (2 * a)) - a, y = ((k * 53) % (b * 1.4)) - b * 0.9; g.beginPath(); g.arc(x, y, 2.5 + (k % 3), 0, 7); g.fill(); } break;
    case 'rainbow': ['#ff5a5a', '#ffb340', '#ffe34a', '#5fd36a', '#3fa7ff', '#9b6cf0'].forEach((c, k) => { g.fillStyle = c; g.globalAlpha = 0.5; g.fillRect(-a + k * (a / 3), -b, a / 3, b * 2); }); break;
    case 'band': g.fillStyle = acc; g.globalAlpha = 0.9; g.fillRect(a * 0.42, -b, 8, b * 0.9); break;
    case 'spines': g.strokeStyle = acc; g.lineWidth = 2; for (let x = -a; x < a; x += 9) { g.beginPath(); g.moveTo(x, -b); g.lineTo(x + 4, -b + 10); g.stroke(); } g.fillStyle = acc; g.globalAlpha = 0.35; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(((k * 29) % (2 * a)) - a, ((k * 41) % b) - b / 2, 5, 0, 7); g.fill(); } break;
    case 'finlets': g.fillStyle = acc; for (let x = -a * 0.7; x < -a * 0.1; x += 9) { g.beginPath(); g.moveTo(x, b * 0.75); g.lineTo(x + 4, b + 2); g.lineTo(x + 7, b * 0.75); g.fill(); } g.fillStyle = '#ffffff'; g.globalAlpha = 0.25; g.fillRect(-a, b * 0.15, 2 * a, b); break;
    case 'glow': for (let k = 0; k < 16; k++) glow(g, ((k * 31) % (2 * a)) - a, ((k * 47) % (b * 1.6)) - b * 0.8, acc, 4); break;
    case 'stars': for (let k = 0; k < 30; k++) glow(g, ((k * 31) % (2 * a)) - a, ((k * 47) % (b * 2)) - b, '#ffffff', 2); break;
    case 'scales': g.strokeStyle = L.accent; g.globalAlpha = 0.5; g.lineWidth = 1.5; for (let x = -a; x < a; x += 10) for (let y = -b; y < b; y += 8) { g.beginPath(); g.arc(x + (y / 8 % 2 ? 5 : 0), y, 5, 0, Math.PI); g.stroke(); } break;
    case 'crown': g.fillStyle = L.accent; g.globalAlpha = 0.35; for (let x = -a; x < a; x += 12) { g.beginPath(); g.arc(x, -b * 0.3, 4, 0, 7); g.fill(); } break;
    default: g.fillStyle = '#ffffff'; g.globalAlpha = 0.18; g.fillRect(-a, -b * 0.15, 2 * a, 5);
  }
  g.globalAlpha = 1;
}
function glow(g, x, y, color, r) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.globalAlpha = 1; g.beginPath(); g.arc(x, y, r * 2.5, 0, 7); g.fill();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(Math.min(255, Math.max(0, k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
