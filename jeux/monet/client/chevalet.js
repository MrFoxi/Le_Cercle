// LES EAUX DE MONET — le chevalet : on le pose où l'on veut, et la vue se peint sous nos yeux. Comme un impressionniste :
// une ébauche floue, puis des touches de plus en plus fines, en couleurs franches (lumières chaudes, ombres violettes, jamais
// de noir), des virgules dans les feuillages, de longues touches couchées sur l'eau, des hachures dans le ciel, et pour
// finir quelques touches de couleur pure dans la lumière. Un peu de pâte en relief, le grain de la toile, une signature.
import { alea } from './instruments.js';

const DUREE = 16; // secondes pour peindre un tableau
const borne = v => Math.max(0, Math.min(255, Math.round(v))), lum = c => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
// l'œil du peintre : plus de couleur, plus de contraste, la lumière réchauffée, l'ombre refroidie
export function regard([r, g, b], force = 1.3) {
  const m = (r + g + b) / 3, l = lum([r, g, b]), chaud = Math.max(0, l - 0.55) * 1.6, froid = Math.max(0, 0.45 - l) * 1.6;
  const c = [r, g, b].map(v => 128 + (m + (v - m) * force - 128) * 1.08), leve = Math.max(0, 0.34 - l) * 150; // les ombres remontent : de la couleur sombre, pas du noir
  return [c[0] + 20 * chaud - 4 * froid + leve * 0.75, c[1] + 14 * chaud - 6 * froid + leve * 0.8, c[2] - 18 * chaud + 20 * froid + leve * 1.05].map(v => borne(Math.max(v, 30)));
}
// ce que représente une touche, d'après sa couleur et sa place : la façon de la poser en dépend
const motif = (c, y, H) => (c[1] > c[0] * 1.05 && c[1] >= c[2] * 0.92 && lum(c) < 0.8 ? 'feuille' : y > H * 0.42 ? 'eau' : 'ciel');

// les coups de brosse d'un tableau, des plus larges aux plus fins. px : l'image source (RGBA, w × h) ; W × H : la toile
export function esquisse(px, w, h, W, H, r = alea(7)) {
  const s = W / w, L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  const at = (x, y) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const pente = (x, y) => [(at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) / 4, (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) / 4];
  const teinte = (x, y, R) => { const c = [0, 0, 0]; let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = Math.min(w - 1, Math.max(0, Math.round(x + i * R))), Y = Math.min(h - 1, Math.max(0, Math.round(y + j * R))), k = (Y * w + X) * 4; c[0] += px[k]; c[1] += px[k + 1]; c[2] += px[k + 2]; n++; } return regard(c.map(v => v / n)); };
  const traits = [];
  for (const [rayon, seuil, garde] of [[W / 20, 0, 1], [W / 36, 0.03, 0.55], [W / 64, 0.05, 0.25], [W / 115, 0.07, 0.1], [W / 200, 0.09, 0.03]]) {
    const pas = rayon * 0.8, couche = [];
    for (let y = pas / 2; y < H; y += pas) for (let x = pas / 2; x < W; x += pas) {
      const X = x + (r() - 0.5) * pas, Y = y + (r() - 0.5) * pas, sx = Math.round(X / s), sy = Math.round(Y / s), [gx, gy] = pente(sx, sy), m = Math.hypot(gx, gy);
      const c = teinte(sx, sy, Math.max(0.5, rayon / s / 4)), autour = teinte(sx, sy, rayon / s), ecart = (Math.abs(c[0] - autour[0]) + Math.abs(c[1] - autour[1]) + Math.abs(c[2] - autour[2])) / 765;
      if (m < seuil && ecart < seuil * 0.9 && r() > garde) continue;
      const k = motif(c, Y, H); let a, l;
      if (m > 0.05) { a = Math.atan2(gy, gx) + Math.PI / 2; l = rayon * (1.2 + r() * 2.2); } // le long des contours
      else if (k === 'feuille') { a = r() * Math.PI; l = rayon * (0.9 + r() * 1.1); } // des virgules en tous sens
      else if (k === 'eau') { a = (r() - 0.5) * 0.12; l = rayon * (2.4 + r() * 2.6); } // couchées, comme le reflet
      else { a = (r() < 0.5 ? 0.38 : -0.38) + (r() - 0.5) * 0.5; l = rayon * (1.8 + r() * 1.6); } // des hachures croisées
      couche.push({ x: X, y: Y, a, l, r: rayon, c, g: r(), k });
    }
    for (let i = couche.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [couche[i], couche[j]] = [couche[j], couche[i]]; }
    traits.push(...couche);
  }
  // les touches de couleur pure, là où la lumière frappe et où la couleur chante
  const pas = W / 90, rayon = W / 160;
  for (let y = pas / 2; y < H; y += pas) for (let x = pas / 2; x < W; x += pas) {
    const sx = Math.round(x / s), sy = Math.round(y / s), c = teinte(sx, sy, 0.5), vif = Math.max(...c) - Math.min(...c);
    if ((lum(c) > 0.74 || vif > 130) && r() < 0.16) traits.push({ x: x + (r() - 0.5) * pas, y: y + (r() - 0.5) * pas, a: r() * Math.PI, l: rayon * (1.6 + r() * 1.4), r: rayon * 0.7, c: regard(c, 1.1), g: r(), k: 'pur' });
  }
  return traits;
}
// un coup de brosse : des poils côte à côte, chacun de son ton (plus chaud, plus froid), et un liseré de pâte en relief
const NUANCES = [[0, 0, 0], [14, 5, -12], [-9, -2, 13]];
function brosse(x, t) {
  const n = Math.max(3, Math.round(t.r / 2)), e = (t.r * 2) / n, c = Math.cos(t.a), s = Math.sin(t.a), courbe = (t.g - 0.5) * t.l * 0.3;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * e * 0.85, j = (Math.floor(t.g * 97) + i * 31) % 3, d = NUANCES[j], v = ((t.g * 131 + i * 17) % 18) - 9, px = -s * o, py = c * o, lo = t.l / 2 * (0.72 + ((i * 7 + Math.floor(t.g * 10)) % 4) * 0.09);
    x.strokeStyle = `rgb(${borne(t.c[0] + d[0] + v)},${borne(t.c[1] + d[1] + v)},${borne(t.c[2] + d[2] + v * 0.8)})`; x.lineWidth = e * (0.9 + ((i * 13) % 5) / 12); x.globalAlpha = 0.72 + ((i * 5 + Math.floor(t.g * 20)) % 5) * 0.06;
    x.beginPath(); x.moveTo(t.x - c * lo + px, t.y - s * lo + py); x.quadraticCurveTo(t.x + px - s * courbe, t.y + py + c * courbe, t.x + c * lo + px, t.y + s * lo + py); x.stroke();
  }
  if (t.r > 22 && t.g < 0.4) { // la pâte : un filet de lumière sur le bord de quelques grandes touches
    for (const [k, col, al] of [[-0.45, 'rgba(255,248,230,1)', 0.13]]) { x.strokeStyle = col; x.globalAlpha = al; x.lineWidth = Math.max(1, e * 0.4); const ox = -s * t.r * k, oy = c * t.r * k; x.beginPath(); x.moveTo(t.x - c * t.l * 0.4 + ox, t.y - s * t.l * 0.4 + oy); x.quadraticCurveTo(t.x + ox - s * courbe, t.y + oy + c * courbe, t.x + c * t.l * 0.4 + ox, t.y + s * t.l * 0.4 + oy); x.stroke(); }
  }
}
// la toile tissée et le bord du tableau un peu assombri, posés par-dessus la peinture
function finir(x, W, H) {
  const m = document.createElement('canvas'); m.width = m.height = 6; const q = m.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, 6, 6); q.fillStyle = '#c8bca8'; q.fillRect(0, 0, 6, 1); q.fillRect(0, 3, 6, 1); q.fillRect(0, 0, 1, 6); q.fillRect(3, 0, 1, 6);
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.16; x.fillStyle = x.createPattern(m, 'repeat'); x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8a890'); x.globalAlpha = 0.5; x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
}

export function creerChevalet(el) {
  el.innerHTML = '<div class="cadre"><canvas></canvas></div><p class="ecrit"></p>'; const toile = el.querySelector('canvas'), x = toile.getContext('2d'), mot = el.querySelector('p');
  const C = { actif: false, fini: false, titre: '', traits: [], i: 0, k: 0 };
  C.commencer = (src, titre) => {
    const W = 1200, H = Math.round(W * src.height / src.width), d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; toile.width = W; toile.height = H;
    // la toile apprêtée, puis l'ébauche : la vue à grands traits flous, que les touches viendront couvrir
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, W, H); x.filter = 'blur(16px)'; x.globalAlpha = 0.55; x.drawImage(src, 0, 0, W, H); x.filter = 'none'; x.lineCap = 'round';
    Object.assign(C, { actif: true, fini: false, titre, traits: esquisse(d, src.width, src.height, W, H, alea(Date.now() % 100000)), i: 0, k: 0 }); el.hidden = false; mot.textContent = 'Le tableau se peint… · Échap : tout effacer';
  };
  // rend vrai si la brosse a touché la toile
  C.maj = dt => {
    if (!C.actif || C.fini) return false; C.k = Math.min(1, C.k + dt / DUREE); const fin = Math.floor(C.k * C.traits.length), avant = C.i;
    while (C.i < fin) brosse(x, C.traits[C.i++]);
    if (C.k >= 1) {
      C.fini = true; finir(x, toile.width, toile.height); x.globalAlpha = 0.9; x.fillStyle = '#efe2c2'; x.shadowColor = 'rgba(30, 20, 10, .7)'; x.shadowBlur = 4; x.font = `${Math.round(toile.width / 34)}px "La Belle Aurore", cursive`; x.textAlign = 'right'; x.fillText(C.titre, toile.width - 26, toile.height - 24); x.shadowBlur = 0;
      mot.textContent = 'E : signer et ranger le tableau dans ton carnet · Échap : l’effacer';
    }
    return C.i > avant;
  };
  C.signer = () => { const img = toile.toDataURL('image/jpeg', 0.72); C.fermer(); return img; };
  C.fermer = () => { C.actif = C.fini = false; C.traits = []; el.hidden = true; };
  return C;
}
