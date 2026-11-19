// LES EAUX DE MONET — le chevalet : on le pose où l'on veut, et la vue se peint sous nos yeux, des grandes masses aux
// dernières touches. Chaque coup de brosse suit la forme du paysage ; l'eau, calme, se peint à l'horizontale.
import { alea } from './instruments.js';

const DUREE = 15; // secondes pour peindre un tableau
// les coups de brosse d'un tableau, des plus larges aux plus fins. px : l'image source (RGBA, w × h) ; W × H : la toile
export function esquisse(px, w, h, W, H, r = alea(7)) {
  const s = W / w, L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  const at = (x, y) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const pente = (x, y) => [(at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) / 4, (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) / 4];
  const teinte = (x, y, R) => { const c = [0, 0, 0]; let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = Math.min(w - 1, Math.max(0, Math.round(x + i * R))), Y = Math.min(h - 1, Math.max(0, Math.round(y + j * R))), k = (Y * w + X) * 4; c[0] += px[k]; c[1] += px[k + 1]; c[2] += px[k + 2]; n++; } return c.map(v => Math.round(v / n)); };
  const traits = [];
  for (const [rayon, seuil, garde] of [[W / 34, 0, 1], [W / 62, 0.035, 0.45], [W / 118, 0.07, 0.2], [W / 220, 0.11, 0.08]]) {
    const pas = rayon * 0.85, couche = [];
    for (let y = pas / 2; y < H; y += pas) for (let x = pas / 2; x < W; x += pas) {
      const X = x + (r() - 0.5) * pas, Y = y + (r() - 0.5) * pas, sx = Math.round(X / s), sy = Math.round(Y / s), [gx, gy] = pente(sx, sy), m = Math.hypot(gx, gy);
      if (m < seuil && r() > garde) continue;
      const a = m < 0.02 ? (r() - 0.5) * 0.25 : Math.atan2(gy, gx) + Math.PI / 2; // le long des contours ; à plat, une touche horizontale
      couche.push({ x: X, y: Y, a, l: rayon * (1.5 + r() * 2.3), r: rayon, c: teinte(sx, sy, Math.max(0.5, rayon / s / 2)), g: r() });
    }
    for (let i = couche.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [couche[i], couche[j]] = [couche[j], couche[i]]; }
    traits.push(...couche);
  }
  return traits;
}
// un coup de brosse : quelques poils côte à côte, chacun de son ton
function brosse(x, t) {
  const n = Math.max(2, Math.round(t.r / 3)), e = (t.r * 2) / n, c = Math.cos(t.a), s = Math.sin(t.a), courbe = (t.g - 0.5) * t.l * 0.25;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * e * 0.9, v = ((t.g * 97 + i * 31) % 22) - 11, px = -s * o, py = c * o;
    x.strokeStyle = `rgb(${t.c[0] + v},${t.c[1] + v},${t.c[2] + v * 0.8})`; x.lineWidth = e * (0.85 + ((i * 13) % 5) / 10); x.globalAlpha = 0.8;
    x.beginPath(); x.moveTo(t.x - c * t.l / 2 + px, t.y - s * t.l / 2 + py); x.quadraticCurveTo(t.x + px - s * courbe, t.y + py + c * courbe, t.x + c * t.l / 2 * (0.8 + (i % 3) * 0.1) + px, t.y + s * t.l / 2 + py); x.stroke();
  }
}

export function creerChevalet(el) {
  el.innerHTML = '<div class="cadre"><canvas></canvas></div><p class="ecrit"></p>'; const toile = el.querySelector('canvas'), x = toile.getContext('2d'), mot = el.querySelector('p');
  const C = { actif: false, fini: false, titre: '', traits: [], i: 0, k: 0 };
  C.commencer = (src, titre) => {
    const W = 960, H = Math.round(W * src.height / src.width), d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; toile.width = W; toile.height = H;
    let m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; } m = m.map(v => Math.round((v / (d.length / 4)) * 0.75));
    x.globalAlpha = 1; x.fillStyle = `rgb(${m})`; x.fillRect(0, 0, W, H); x.lineCap = 'round';
    Object.assign(C, { actif: true, fini: false, titre, traits: esquisse(d, src.width, src.height, W, H, alea(Date.now() % 100000)), i: 0, k: 0 }); el.hidden = false; mot.textContent = 'Le tableau se peint… · Échap : tout effacer';
  };
  // rend vrai si la brosse a touché la toile
  C.maj = dt => {
    if (!C.actif || C.fini) return false; C.k = Math.min(1, C.k + dt / DUREE); const fin = Math.floor(C.k * C.traits.length), avant = C.i;
    while (C.i < fin) brosse(x, C.traits[C.i++]);
    if (C.k >= 1) { C.fini = true; x.globalAlpha = 0.9; x.fillStyle = '#efe2c2'; x.shadowColor = 'rgba(30, 20, 10, .7)'; x.shadowBlur = 4; x.font = `${Math.round(toile.width / 34)}px "La Belle Aurore", cursive`; x.textAlign = 'right'; x.fillText(C.titre, toile.width - 22, toile.height - 20); x.shadowBlur = 0; mot.textContent = 'E : signer et ranger le tableau dans ton carnet · Échap : l’effacer'; }
    return C.i > avant;
  };
  C.signer = () => { const img = toile.toDataURL('image/jpeg', 0.74); C.fermer(); return img; };
  C.fermer = () => { C.actif = C.fini = false; C.traits = []; el.hidden = true; };
  return C;
}
