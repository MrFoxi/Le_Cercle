// Textures dessinées au canvas : asphalte (grain, raccords, taches d'huile), gomme, lignes usées, vibreurs, herbe tondue,
// graviers, pavés, façades, toits. Une texture ne se dessine qu'une fois par page.
import * as THREE from 'three';

const cache = new Map();
export function canvasTex(w, h, draw, { repeat = true, key = null } = {}) {
  if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (key) cache.set(key, t);
  return t;
}
const R = Math.random;
export function speckle(g, w, h, n, size, alpha, light = 0.5) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = R() < light ? `rgba(255,255,255,${R() * alpha})` : `rgba(0,0,0,${R() * alpha})`;
    g.fillRect(R() * w, R() * h, size * (0.5 + R()), size * (0.5 + R()));
  }
}
const blob = (g, x, y, r, color) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
};

// Asphalte : u en travers de la piste, v le long (14 m par motif).
export const asphalt = night => canvasTex(512, 1024, (g, w, h) => {
  g.fillStyle = night ? '#34373e' : '#45484e'; g.fillRect(0, 0, w, h);
  // rapiéçages d'un autre gris
  for (let k = 0; k < 2; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.022)`; g.fillRect(R() * w * 0.7, R() * h, 60 + R() * 160, 80 + R() * 260); }
  speckle(g, w, h, 60000, 1.2, 0.22);
  speckle(g, w, h, 5000, 2.2, 0.16, 0.7); // granulats clairs
  // taches d'huile et marques au centre de la voie
  for (let k = 0; k < 4; k++) blob(g, w * (0.35 + R() * 0.3), R() * h, 8 + R() * 16, 'rgba(10,10,14,.14)');
  // joint longitudinal à peine visible
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(w * 0.5 - 1, 0, 2, h);
  g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 1) if (R() < 0.6) g.fillRect(w * 0.5 - 2 + R() * 4, y, 1, 1);
}, { key: 'asphalt' + night });

// Gomme : longues traînées sombres (l'opacité vient de la géométrie : plus forte aux freinages).
export const rubber = () => canvasTex(128, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let k = 0; k < 90; k++) {
    const x = w * (0.15 + R() * 0.7), len = 40 + R() * 300, y = R() * h;
    g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.35})`; g.fillRect(x, y, 1 + R() * 3, len);
    if (y + len > h) g.fillRect(x, y - h, 1 + R() * 3, len);
  }
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { key: 'rubber' });

// Ligne blanche usée : du blanc avec des manques.
export const paint = () => canvasTex(32, 256, (g, w, h) => {
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 900; k++) { g.clearRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
  for (let k = 0; k < 6; k++) { g.clearRect(R() * w, R() * h, 3 + R() * 8, 2 + R() * 6); }
}, { key: 'paint' });

// Vibreurs rouge et blanc, avec un léger relief dessiné sur les bords de chaque bande.
export const kerb = () => canvasTex(32, 128, (g, w, h) => {
  for (let k = 0; k < 2; k++) {
    g.fillStyle = k ? '#f1f1ee' : '#dd2e26'; g.fillRect(0, k * h / 2, w, h / 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, k * h / 2 + h / 2 - 5, w, 5);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, k * h / 2, w, 3);
  }
  speckle(g, w, h, 600, 1, 0.15);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 3, h);
}, { key: 'kerb' });

// Herbe : brins + bandes de tonte franches (25 m par motif, coordonnées du monde).
export const grass = (base = '#4c8c37') => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 2; k++) { g.fillStyle = k ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; g.fillRect(0, k * h / 2, w, h / 2); }
  for (let k = 0; k < 26000; k++) {
    const x = R() * w, y = R() * h, l = 2 + R() * 4;
    g.strokeStyle = R() < 0.5 ? `rgba(20,60,10,${0.15 + R() * 0.2})` : `rgba(190,230,120,${0.08 + R() * 0.12})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 2, y - l); g.stroke();
  }
  for (let k = 0; k < 14; k++) blob(g, R() * w, R() * h, 30 + R() * 60, 'rgba(0,0,0,.05)');
}, { key: 'grass' + base });

// Pavés de béton (quartiers urbains), joints en grille.
export const pavement = night => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = night ? '#24272e' : '#9a9b9c'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 30000, 1.2, night ? 0.12 : 0.18);
  g.fillStyle = night ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.16)';
  for (let k = 0; k <= 8; k++) { g.fillRect(k * w / 8, 0, 2, h); g.fillRect(0, k * h / 8, w, 2); }
  for (let k = 0; k < 10; k++) blob(g, R() * w, R() * h, 20 + R() * 50, 'rgba(0,0,0,.06)');
}, { key: 'pavement' + night });

// Graviers : petits cailloux beiges et gris.
export const gravel = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c4ad82'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 9000; k++) {
    const c = 150 + R() * 90;
    g.fillStyle = `rgb(${c},${c * 0.9},${c * 0.72})`;
    g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.6, 0, 7); g.fill();
    if (R() < 0.3) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(R() * w, R() * h, 1, 1); }
  }
}, { key: 'gravel' });

// Dégagement asphalté peint (bandes bleues et rouges des circuits modernes).
export const runoffPaint = night => canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = night ? '#2b3039' : '#5d6168'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 4000, 1, 0.15);
  g.fillStyle = night ? 'rgba(45,107,255,.35)' : 'rgba(40,90,200,.45)'; g.fillRect(w * 0.15, 0, w * 0.12, h);
  g.fillStyle = night ? 'rgba(255,60,60,.25)' : 'rgba(200,40,40,.35)'; g.fillRect(w * 0.32, 0, w * 0.06, h);
}, { key: 'runoff' + night });

// Dessus des murs : rayures aux couleurs du circuit.
export const wallTop = (a, b) => canvasTex(16, 64, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h / 2); g.fillStyle = b; g.fillRect(0, h / 2, w, h / 2);
  speckle(g, w, h, 200, 1, 0.15);
}, { key: 'wall' + a + b });

// Toits-jardins, béton de tunnel.
export const garden = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f8a48'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 40; k++) blob(g, R() * w, R() * h, 10 + R() * 22, `rgba(${R() < 0.5 ? '30,70,20' : '120,170,70'},.6)`);
  g.fillStyle = '#d8d0bc'; g.fillRect(0, h * 0.45, w, 10);
  for (let k = 0; k < 12; k++) { g.fillStyle = ['#e85d75', '#f2c14e', '#ffffff'][k % 3]; g.beginPath(); g.arc(R() * w, R() * h, 3, 0, 7); g.fill(); }
}, { key: 'garden' });

export const sprite = () => canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
}, { repeat: false, key: 'sprite' });

// Ombre douce sous les voitures.
export const contact = () => canvasTex(128, 64, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(0.55, 'rgba(0,0,0,.4)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.scale(1, h / w * 1.9); g.fillStyle = r; g.fillRect(0, 0, w, w); g.restore();
}, { repeat: false, key: 'contact' });

// Bannière publicitaire (marques inventées).
export const BRANDS = ['NEBULA OIL', 'VELOCE', 'KAIZEN TYRES', 'AURORA', 'ORBITAL', 'MISTRAL', 'TOP FORMULA', 'HELIX', 'SOLENNE'];
export const banner = (text, bg = '#111', fg = '#fff') => canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = 'italic 900 40px Titillium Web, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
}, { repeat: false, key: 'banner' + text + bg + fg });
