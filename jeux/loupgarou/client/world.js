// Le village du Loup-Garou en 3D, vu à la première personne : « Bourg-la-Lune », un hameau d'automne au bord d'une forêt.
// Tout est modelé pièce par pièce : pavés posés en cercles autour d'une rosace, pierres des soubassements, tuiles des toits,
// briques des cheminées, colombages chevillés, portes cloutées, vitraux sertis de plomb, brins d'herbe qui ondulent au vent,
// arbres aux milliers de feuilles. Auberge « Au Loup qui Dort » et sa terrasse, chapelle et son cimetière (les morts de la
// partie y ont leur tombe), étal, charrette, linge qui sèche. Ciel physique (nuages, coucher de soleil, nuit étoilée, lune),
// ombres fines, occlusion ambiante, halo des lumières, étalonnage et anticrénelage.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeCharacter, setGhost, animate, play, hitBy, splat, makeItem } from './characters.js';

const LG = window.LG;
const TAU = Math.PI * 2;
let seed = 20261110;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + rnd() * (b - a);
const pickOf = list => list[Math.floor(rnd() * list.length)];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const simplex = new SimplexNoise({ random: rnd });
const fbm = (x, z) => simplex.noise(x, z) * 0.6 + simplex.noise(x * 2.3, z * 2.3) * 0.28 + simplex.noise(x * 5.1, z * 5.1) * 0.12;
const at = (deg, r) => { const a = (deg * Math.PI) / 180, x = Math.sin(a) * r, z = Math.cos(a) * r; return { x, z, ry: Math.atan2(-x, -z) }; };

/* =====================================================================================================================
   Textures peintes (couleur + relief)
   ===================================================================================================================== */
const TEXC = {};
// draw(c, n, h) : c dessine la couleur, h (si relief) la hauteur en gris.
function paint(key, size, draw, { bump = false, repeat = true } = {}) {
  if (TEXC[key]) return TEXC[key];
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const cc = mk(), hc = bump ? mk() : null;
  const c = cc.getContext('2d'), h = hc?.getContext('2d');
  if (h) { h.fillStyle = '#808080'; h.fillRect(0, 0, size, size); }
  draw(c, size, h);
  const fin = t => { if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t; };
  const map = fin(new THREE.CanvasTexture(cc)); map.colorSpace = THREE.SRGBColorSpace;
  return (TEXC[key] = { map, bump: hc ? fin(new THREE.CanvasTexture(hc)) : null });
}
const both = (c, h, fn) => { fn(c, false); if (h) fn(h, true); };
const wrap = (n, fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy); };
const grain = (c, n, count, cols, s = 1) => { for (let i = 0; i < count; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(rnd() * n, rnd() * n, s, s); } };
const TX = {
  plaster: () => paint('plaster', 1024, (c, n, h) => {
    c.fillStyle = '#f2ece2'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) {
      const X = rnd() * n, Y = rnd() * n, r = between(15, 70), dark = rnd() < 0.55;
      wrap(n, (ox, oy) => {
        const g = c.createRadialGradient(X + ox, Y + oy, 0, X + ox, Y + oy, r); g.addColorStop(0, dark ? 'rgba(130,105,80,.07)' : 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(X + ox - r, Y + oy - r, r * 2, r * 2);
        const k = h.createRadialGradient(X + ox, Y + oy, 0, X + ox, Y + oy, r); k.addColorStop(0, dark ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)'); k.addColorStop(1, 'rgba(128,128,128,0)'); h.fillStyle = k; h.fillRect(X + ox - r, Y + oy - r, r * 2, r * 2);
      });
    }
    for (let i = 0; i < 900; i++) { const X = rnd() * n, Y = rnd() * n, l = between(10, 40), a = between(-0.4, 0.4); h.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},.12)`; h.lineWidth = between(2, 6); h.beginPath(); h.moveTo(X, Y); h.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); h.stroke(); }
    for (let i = 0; i < 10; i++) { let X = rnd() * n, Y = rnd() * n; c.strokeStyle = 'rgba(80,60,40,.35)'; h.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = h.lineWidth = 1.2; c.beginPath(); h.beginPath(); c.moveTo(X, Y); h.moveTo(X, Y); for (let k = 0; k < 9; k++) { X += between(-12, 12); Y += between(6, 18); c.lineTo(X, Y); h.lineTo(X, Y); } c.stroke(); h.stroke(); }
    grain(c, n, 9000, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.06)']); grain(h, n, 9000, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.25)'], 2);
  }, { bump: true }),
  oak: () => paint('oak', 512, (c, n, h) => {
    c.fillStyle = '#6b4a33'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) { const Y = rnd() * n, w = between(1, 4), dark = rnd() < 0.5, a = dark ? between(0.15, 0.4) : between(0.1, 0.25); both(c, h, (x, isH) => { x.strokeStyle = isH ? (dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.3)') : dark ? `rgba(35,20,10,${a})` : `rgba(150,110,80,${a})`; x.lineWidth = w; x.beginPath(); x.moveTo(0, Y); for (let X = 0; X <= n; X += 32) x.lineTo(X, Y + Math.sin(X * 0.02 + i) * 3); x.stroke(); }); }
    for (let i = 0; i < 7; i++) { const X = rnd() * n, Y = rnd() * n; both(c, h, (x, isH) => { x.fillStyle = isH ? '#202020' : '#2e1c10'; x.beginPath(); x.ellipse(X, Y, 10, 5, 0, 0, TAU); x.fill(); }); }
  }, { bump: true }),
  planks: () => paint('planks', 1024, (c, n, h) => {
    const pw = n / 8;
    for (let k = 0; k < 8; k++) {
      c.fillStyle = `hsl(${between(22, 32)},${between(28, 40)}%,${between(42, 56)}%)`; c.fillRect(k * pw, 0, pw, n);
      for (let i = 0; i < 40; i++) { const X = k * pw + rnd() * pw, a = between(0.1, 0.3); both(c, h, (x, isH) => { x.strokeStyle = isH ? 'rgba(0,0,0,.35)' : `rgba(50,30,15,${a})`; x.lineWidth = between(1, 2.5); x.beginPath(); x.moveTo(X, 0); x.bezierCurveTo(X + between(-8, 8), n * 0.3, X + between(-8, 8), n * 0.7, X, n); x.stroke(); }); }
      both(c, h, (x, isH) => { x.fillStyle = isH ? '#000' : 'rgba(25,12,5,.65)'; x.fillRect(k * pw, 0, 3, n); });
    }
  }, { bump: true }),
  stone: () => paint('stone', 512, (c, n, h) => {
    c.fillStyle = '#9a9288'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 400; i++) { const X = rnd() * n, Y = rnd() * n, r = between(4, 30), d = rnd() < 0.5, a = between(0.04, 0.12), b = between(0.08, 0.2); wrap(n, (ox, oy) => { c.fillStyle = `rgba(${d ? '60,55,50' : '200,195,185'},${a})`; c.beginPath(); c.arc(X + ox, Y + oy, r, 0, TAU); c.fill(); h.fillStyle = `rgba(${d ? '0,0,0' : '255,255,255'},${b})`; h.beginPath(); h.arc(X + ox, Y + oy, r, 0, TAU); h.fill(); }); }
    grain(c, n, 14000, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.12)', 'rgba(120,90,60,.1)']); grain(h, n, 14000, ['rgba(0,0,0,.4)', 'rgba(255,255,255,.4)'], 2);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(90,120,50,${between(0.05, 0.18)})`; c.beginPath(); c.arc(rnd() * n, rnd() * n, between(8, 30), 0, TAU); c.fill(); }
  }, { bump: true }),
  clay: () => paint('clay', 256, (c, n, h) => { c.fillStyle = '#d8d0c8'; c.fillRect(0, 0, n, n); grain(c, n, 5000, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.1)'], 2); grain(h, n, 5000, ['rgba(0,0,0,.4)', 'rgba(255,255,255,.4)'], 2); for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(70,90,40,${between(0.05, 0.2)})`; c.beginPath(); c.arc(rnd() * n, rnd() * n, between(4, 18), 0, TAU); c.fill(); } }, { bump: true }),
  thatch: () => paint('thatch', 1024, (c, n, h) => {
    c.fillStyle = '#9a7a3a'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 16000; i++) { const X = rnd() * n, Y = rnd() * n, l = between(25, 60), w = between(1.2, 3), li = between(30, 66); c.strokeStyle = `hsl(${between(34, 46)},${between(40, 62)}%,${li}%)`; c.lineWidth = w; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + between(-3, 3), Y + l); c.stroke(); h.strokeStyle = `rgba(${li > 48 ? '255,255,255' : '0,0,0'},.5)`; h.lineWidth = w; h.beginPath(); h.moveTo(X, Y); h.lineTo(X, Y + l); h.stroke(); }
    for (let r = 0; r < n; r += 64) { c.fillStyle = 'rgba(50,30,5,.35)'; c.fillRect(0, r + 56, n, 8); h.fillStyle = 'rgba(0,0,0,.6)'; h.fillRect(0, r + 56, n, 8); }
  }, { bump: true }),
  bark: () => paint('bark', 512, (c, n, h) => {
    c.fillStyle = '#4e3626'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) { const X = rnd() * n, w = between(2, 9), light = rnd() < 0.4, a = between(0.2, 0.6), p = [between(-14, 14), between(-14, 14), between(-6, 6)]; both(c, h, (x, isH) => { x.strokeStyle = isH ? (light ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.6)') : light ? `rgba(130,100,75,${a})` : `rgba(20,12,6,${a})`; x.lineWidth = w; x.beginPath(); x.moveTo(X, 0); x.bezierCurveTo(X + p[0], n / 3, X + p[1], (2 * n) / 3, X + p[2], n); x.stroke(); }); }
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(90,120,60,${between(0.1, 0.3)})`; c.beginPath(); c.ellipse(rnd() * n, rnd() * n, between(5, 20), between(10, 40), 0, 0, TAU); c.fill(); }
  }, { bump: true }),
  grass: () => paint('grassGround', 1024, (c, n, h) => {
    c.fillStyle = '#6f9444'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 300; i++) { const X = rnd() * n, Y = rnd() * n, r = between(20, 80), q = rnd(), col = q < 0.3 ? 'rgba(160,140,60,.18)' : q < 0.65 ? 'rgba(40,80,20,.18)' : 'rgba(130,170,70,.15)'; wrap(n, (ox, oy) => { const g = c.createRadialGradient(X + ox, Y + oy, 0, X + ox, Y + oy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(X + ox - r, Y + oy - r, r * 2, r * 2); }); }
    for (let i = 0; i < 60000; i++) { const X = rnd() * n, Y = rnd() * n, li = between(22, 50); c.strokeStyle = `hsl(${between(70, 105)},${between(35, 55)}%,${li}%)`; c.lineWidth = 1.3; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + between(-2, 2), Y - between(4, 10)); c.stroke(); h.strokeStyle = `rgba(${li > 36 ? '255,255,255' : '0,0,0'},.4)`; h.beginPath(); h.moveTo(X, Y); h.lineTo(X, Y - 6); h.stroke(); }
  }, { bump: true }),
  dirt: () => paint('dirt', 1024, (c, n, h) => {
    c.fillStyle = '#8a6f50'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 1600; i++) { const X = rnd() * n, Y = rnd() * n, r = between(2, 8), li = between(38, 70); c.fillStyle = `hsl(${between(25, 40)},${between(10, 22)}%,${li}%)`; c.beginPath(); c.ellipse(X, Y, r, r * 0.75, rnd() * 3, 0, TAU); c.fill(); h.fillStyle = 'rgba(255,255,255,.55)'; h.beginPath(); h.ellipse(X, Y, r, r * 0.75, 0, 0, TAU); h.fill(); }
    grain(c, n, 30000, ['rgba(40,25,10,.18)', 'rgba(255,240,210,.12)'], 2); grain(h, n, 30000, ['rgba(0,0,0,.4)', 'rgba(255,255,255,.3)'], 2);
  }, { bump: true }),
  leaded: lit => paint(lit ? 'leadedGlow' : 'leaded', 256, (c, n) => {
    if (!lit) { c.fillStyle = '#5d7380'; c.fillRect(0, 0, n, n); const g = c.createLinearGradient(0, 0, n, n); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(180,220,255,.15)'); c.fillStyle = g; c.fillRect(0, 0, n, n); for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,255,${between(0, 0.08)})`; c.fillRect(rnd() * n, rnd() * n, 30, 30); } }
    else { const g = c.createRadialGradient(n / 2, n * 0.6, 10, n / 2, n * 0.6, n * 0.8); g.addColorStop(0, '#fff2c8'); g.addColorStop(1, '#c47a30'); c.fillStyle = g; c.fillRect(0, 0, n, n); }
    c.strokeStyle = lit ? '#000' : '#26201a'; c.lineWidth = 5;
    for (let k = -n; k < n * 2; k += n / 4) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + n, n); c.stroke(); c.beginPath(); c.moveTo(k, n); c.lineTo(k + n, 0); c.stroke(); }
    c.lineWidth = 14; c.strokeRect(0, 0, n, n);
  }),
  leaf: () => paint('leafCluster', 512, (c, n) => {
    for (let i = 0; i < 22; i++) {
      const X = between(0.15, 0.85) * n, Y = between(0.15, 0.85) * n, s = between(0.09, 0.15) * n, li = between(55, 95);
      c.save(); c.translate(X, Y); c.rotate(rnd() * TAU);
      c.fillStyle = `hsl(0,0%,${li}%)`; c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * 0.7, -s * 0.6, s * 0.6, s * 0.5, 0, s); c.bezierCurveTo(-s * 0.6, s * 0.5, -s * 0.7, -s * 0.6, 0, -s); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -s * 0.9); c.lineTo(0, s * 1.2); c.stroke();
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(0, k * s * 0.3); c.lineTo(s * 0.4, k * s * 0.3 - s * 0.25); c.moveTo(0, k * s * 0.3); c.lineTo(-s * 0.4, k * s * 0.3 - s * 0.25); c.stroke(); }
      c.restore();
    }
  }, { repeat: false }),
  oneLeaf: () => paint('oneLeaf', 128, (c, n) => {
    c.translate(n / 2, n / 2);
    c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; c.lineTo(Math.cos(a) * n * 0.45, Math.sin(a) * n * 0.45); c.lineTo(Math.cos(a + 0.6) * n * 0.2, Math.sin(a + 0.6) * n * 0.2); } c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * n * 0.4, Math.sin(a) * n * 0.4); c.stroke(); }
  }, { repeat: false }),
  fern: () => paint('fern', 256, (c, n) => { c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(n / 2, n); c.lineTo(n / 2, 4); c.stroke(); for (let y = 10; y < n - 6; y += 9) { const w = (1 - Math.abs(y / n - 0.45) * 1.6) * n * 0.45; for (const s of [1, -1]) { c.beginPath(); c.ellipse(n / 2 + (s * w) / 2, y + 4, Math.max(1, w / 2), 3.5, s * -0.25, 0, TAU); c.fill(); } } }, { repeat: false }),
  weave: () => paint('weave', 256, (c, n, h) => { c.fillStyle = '#c8a46a'; c.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 16) for (let x = 0; x < n; x += 16) { const o = ((x + y) / 16) % 2; both(c, h, (g, isH) => { g.fillStyle = isH ? (o ? '#fff' : '#555') : o ? '#d8b47a' : '#a8844a'; g.fillRect(x + 1, y + 1, 14, 14); }); } }, { bump: true }),
  rings: () => paint('rings', 256, (c, n) => { c.fillStyle = '#c89c68'; c.fillRect(0, 0, n, n); for (let r = 4; r < n / 2; r += between(4, 9)) { c.strokeStyle = `rgba(110,70,35,${between(0.3, 0.6)})`; c.lineWidth = between(1, 2.5); c.beginPath(); c.arc(n / 2 + between(-2, 2), n / 2, r, 0, TAU); c.stroke(); } c.strokeStyle = 'rgba(60,35,15,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(n / 2, n / 2); c.lineTo(n * 0.85, n * 0.3); c.stroke(); c.strokeStyle = '#4e3626'; c.lineWidth = 14; c.beginPath(); c.arc(n / 2, n / 2, n / 2 - 7, 0, TAU); c.stroke(); }),
  stripes: () => paint('stripes', 512, (c, n, h) => { for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? '#f2e6cf' : '#b8362a'; c.fillRect((k * n) / 10, 0, n / 10, n); } grain(c, n, 20000, ['rgba(0,0,0,.06)', 'rgba(255,255,255,.06)']); for (let y = 0; y < n; y += 4) { h.fillStyle = y % 8 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)'; h.fillRect(0, y, n, 2); } }, { bump: true }),
  stained: () => paint('stained', 512, (c, n) => {
    c.fillStyle = '#120a18'; c.fillRect(0, 0, n, n);
    const cols = ['#e0402e', '#2e62d8', '#f2c230', '#2fa860', '#9a40d0', '#f08a30', '#40c0d8'];
    for (let i = 0; i < 90; i++) { const X = rnd() * n, Y = rnd() * n, r = between(20, 60); c.fillStyle = pickOf(cols); c.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + rnd(); c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); } c.fill(); }
    c.fillStyle = '#f6e7a8'; c.beginPath(); c.arc(n / 2, n * 0.35, n * 0.12, 0, TAU); c.fill();
    c.strokeStyle = '#120a18'; c.lineWidth = 7; for (let i = 0; i < 40; i++) { c.beginPath(); c.moveTo(rnd() * n, rnd() * n); c.lineTo(rnd() * n, rnd() * n); c.stroke(); }
    c.lineWidth = 18; c.strokeRect(0, 0, n, n);
  }),
  innSign: () => paint('innSign', 1024, (c, n) => {
    c.fillStyle = '#5a3a22'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 80; i++) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = between(1, 3); c.beginPath(); const Y = rnd() * n; c.moveTo(0, Y); c.lineTo(n, Y + between(-6, 6)); c.stroke(); }
    c.strokeStyle = '#e0b24a'; c.lineWidth = 16; c.strokeRect(24, 24, n - 48, n - 48);
    c.fillStyle = '#f6e3b0'; c.textAlign = 'center'; c.font = 'bold 150px Georgia, serif'; c.fillText('AUBERGE', n / 2 + 90, n * 0.45);
    c.font = 'italic 110px Georgia, serif'; c.fillText('Au Loup qui Dort', n / 2 + 60, n * 0.75);
    c.beginPath(); c.arc(150, n * 0.38, 90, 0, TAU); c.fill(); c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(190, n * 0.34, 86, 0, TAU); c.fill();
  }),
  poster: () => paint('poster', 512, (c, n) => {
    c.fillStyle = '#ead8b0'; c.fillRect(0, 0, n, n); grain(c, n, 6000, ['rgba(120,80,30,.15)'], 3);
    c.fillStyle = '#3a2210'; c.textAlign = 'center'; c.font = 'bold 68px Georgia, serif'; c.fillText('RECHERCHÉ', n / 2, 86);
    c.beginPath(); c.moveTo(n / 2, 400); c.lineTo(n / 2 - 104, 240); c.lineTo(n / 2 - 92, 132); c.lineTo(n / 2 - 36, 200); c.lineTo(n / 2 + 36, 200); c.lineTo(n / 2 + 92, 132); c.lineTo(n / 2 + 104, 240); c.closePath(); c.fill();
    c.fillStyle = '#e8b030'; c.beginPath(); c.arc(n / 2 - 40, 264, 13, 0, TAU); c.arc(n / 2 + 40, 264, 13, 0, TAU); c.fill();
    c.fillStyle = '#3a2210'; c.font = 'bold 44px Georgia, serif'; c.fillText('MORT OU VIF', n / 2, 470);
  }),
  tomb: (name, sub) => paint(`tomb:${name}:${sub}`, 256, (c, n) => {
    c.fillStyle = '#8e8a84'; c.fillRect(0, 0, n, n); grain(c, n, 4000, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.1)'], 2);
    c.fillStyle = 'rgba(30,25,20,.85)'; c.textAlign = 'center'; c.font = 'bold 30px Georgia, serif'; c.fillText('✝', n / 2, 50);
    c.font = `bold ${name.length > 10 ? 26 : 34}px Georgia, serif`; c.fillText(name, n / 2, 120); c.font = 'italic 22px Georgia, serif'; c.fillText(sub, n / 2, 160);
    for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(80,110,50,${between(0.1, 0.3)})`; c.beginPath(); c.arc(rnd() * n, n - rnd() * 60, between(5, 20), 0, TAU); c.fill(); }
  }, { repeat: false }),
  moon: () => paint('moon', 512, (c, n) => {
    const g = c.createRadialGradient(n * 0.45, n * 0.45, 0, n / 2, n / 2, n / 2); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.9, '#e8dcc0'); g.addColorStop(1, 'rgba(232,220,192,0)'); c.fillStyle = g; c.beginPath(); c.arc(n / 2, n / 2, n / 2 - 4, 0, TAU); c.fill();
    for (let i = 0; i < 40; i++) { const r = between(6, 40), X = n / 2 + between(-0.33, 0.33) * n, Y = n / 2 + between(-0.33, 0.33) * n; c.fillStyle = `rgba(150,135,110,${between(0.12, 0.3)})`; c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill(); }
  }, { repeat: false }),
};

/* =====================================================================================================================
   Matières
   ===================================================================================================================== */
const MATC = {};
const std = (key, o) => (MATC[key] ??= new THREE.MeshStandardMaterial({ roughness: 0.88, ...o }));
const tex = (t, r = 1) => { if (r === 1) return t; const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
const M = {
  plaster: c => std(`plaster${c}`, { map: TX.plaster().map, bumpMap: TX.plaster().bump, bumpScale: 2.2, color: c, roughness: 0.95 }),
  oak: () => std('oak', { map: TX.oak().map, bumpMap: TX.oak().bump, bumpScale: 3, roughness: 0.82 }),
  planks: c => std(`planks${c}`, { map: TX.planks().map, bumpMap: TX.planks().bump, bumpScale: 3, color: c ?? '#ffffff', roughness: 0.85 }),
  stone: () => std('stone', { map: TX.stone().map, bumpMap: TX.stone().bump, bumpScale: 3.5, roughness: 0.92 }),
  mortar: () => std('mortar', { color: '#5c544a', roughness: 1, map: TX.stone().map }),
  clay: () => std('clay', { map: TX.clay().map, bumpMap: TX.clay().bump, bumpScale: 2, roughness: 0.78 }),
  thatch: () => std('thatch', { map: TX.thatch().map, bumpMap: TX.thatch().bump, bumpScale: 6, roughness: 1 }),
  bark: () => std('bark', { map: TX.bark().map, bumpMap: TX.bark().bump, bumpScale: 6, roughness: 0.95 }),
  iron: () => std('iron', { color: '#25221f', metalness: 0.75, roughness: 0.48 }),
  rust: () => std('rust', { color: '#4a3326', metalness: 0.4, roughness: 0.7 }),
  gold: () => std('gold', { color: '#d8a640', metalness: 0.9, roughness: 0.28 }),
  brass: () => std('brass', { color: '#b88a3a', metalness: 0.85, roughness: 0.35 }),
  plain: (c, o) => std(`plain${c}${o ? JSON.stringify(o) : ''}`, { color: c, ...o }),
  white: () => std('whiteInst', { color: '#ffffff' }),
  rings: () => std('ringsMat', { map: TX.rings().map, roughness: 0.9 }),
};
// Ce qui s'allume la nuit
const GLOW = [];
const glow = (key, o, curve) => { const m = std(key, { emissiveIntensity: 0, ...o }); m.userData.noShadow = true; if (!GLOW.some(g => g.m === m)) GLOW.push({ m, curve }); return m; };
const GLASS = [
  glow('glassA', { map: TX.leaded(false).map, emissive: '#ffffff', emissiveMap: TX.leaded(true).map, roughness: 0.12, metalness: 0.2 }, k => smooth(0.3, 0.7, k) * 2.6),
  glow('glassB', { map: TX.leaded(false).map, emissive: '#ffffff', emissiveMap: TX.leaded(true).map, roughness: 0.12, metalness: 0.2 }, k => smooth(0.5, 0.95, k) * 2.2),
];
const FLAME = glow('flame', { color: '#ffcf70', emissive: '#ffb040' }, k => 2 + smooth(0.2, 0.8, k) * 9);
const LAMPGLASS = glow('lampGlass', { color: '#fff1d0', emissive: '#ffb050', transparent: true, opacity: 0.55, roughness: 0.1 }, k => 0.3 + smooth(0.2, 0.8, k) * 2.4);
const STAINED = glow('stained', { map: TX.stained().map, emissive: '#ffffff', emissiveMap: TX.stained().map, roughness: 0.2 }, k => 0.1 + smooth(0.4, 0.9, k) * 1.8);
const BULB = glow('bulb', { color: '#fff0c8', emissive: '#ffc070' }, k => 0.4 + smooth(0.3, 0.8, k) * 6);
const PUMPKIN = glow('pumpkinFace', { color: '#1a0c04', emissive: '#ff9a30' }, k => smooth(0.4, 0.9, k) * 5);

/* =====================================================================================================================
   Formes de base
   ===================================================================================================================== */
const GEO = {};
const geo = (key, make) => (GEO[key] ??= make());
// Bloc arrondi de 1 m (mis à l'échelle) ; « bumpy » : un peu cabossé, pour les pierres.
const unitBox = (r = 0.06, bumpy = 0) => geo(`ub${r}${bumpy}`, () => {
  const g = new RoundedBoxGeometry(1, 1, 1, 2, r);
  if (bumpy) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = simplex.noise3d(x * 3.1, y * 3.1, z * 3.1) * bumpy; p.setXYZ(i, x * (1 + n), y * (1 + n), z * (1 + n)); } g.computeVertexNormals(); }
  return g;
});
function put(parent, g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const beam = (parent, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, mat = M.oak()) => put(parent, unitBox(0.08), mat, x, y, z, rx, ry, rz, w, h, d);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };

// Lots d'instances : on pose des repères ; ils deviennent un seul objet par sorte à la fin.
const BATCH = {};
const batchOf = (name, make, mat, { shadow = true, receive = true } = {}) => (BATCH[name] ??= { make, mat, list: [], shadow, receive });
function inst(name, parent, x, y, z, rx, ry, rz, sx, sy, sz, color) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz);
  parent.add(o);
  BATCH[name].list.push({ o, color });
}

// Fusionne tout un groupe en quelques objets par matière (positions du monde).
function bake(group) {
  group.updateMatrixWorld(true);
  const by = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [m, list] of by) for (let i = 0; i < list.length; i += 3000) {
    const mesh = new THREE.Mesh(mergeGeometries(list.slice(i, i + 3000)), m);
    mesh.castShadow = !m.userData.noShadow && !m.transparent; mesh.receiveShadow = true; out.add(mesh);
  }
  return out;
}

/* =====================================================================================================================
   Le monde
   ===================================================================================================================== */
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#c8d6dc', 0.006);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 4000);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight('#cfe4ff', '#6a5a3c', 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1da', 3);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 });
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
  sun.userData.dir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
  scene.add(sun, sun.target);
  const uTime = { value: 0 };

  /* ---------------- Terrain ---------------- */
  const heightAt = (x, z) => { const r = Math.hypot(x, z), s = smooth(23, 60, r); return s * (fbm(x * 0.018, z * 0.018) * 5 + (r - 23) * 0.07) + smooth(150, 260, r) * 40 + (r > 13.4 && r < 23 ? fbm(x * 0.1, z * 0.1) * 0.12 * smooth(13.4, 16, r) : 0); };
  {
    const g = new THREE.PlaneGeometry(700, 700, 300, 300); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [], c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); p.setY(i, heightAt(x, z));
      const n = fbm(x * 0.04, z * 0.04) * 0.5 + 0.5, au = smooth(0.55, 0.85, fbm(x * 0.015 + 9, z * 0.015) * 0.5 + 0.5), far = smooth(40, 120, Math.hypot(x, z));
      c.setHSL(0.22 - au * 0.12 + far * 0.03, 0.4 + au * 0.15 - far * 0.1, 0.42 + n * 0.12 - far * 0.08); col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const t = TX.grass();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex(t.map, 220), bumpMap: tex(t.bump, 220), bumpScale: 2, vertexColors: true, roughness: 1 }));
    ground.receiveShadow = true; scene.add(ground);
  }

  const deco = new THREE.Group(); // tout le décor fixe, fusionné à la fin
  const blockers = []; // zones sans herbe : { x, z, r }
  const lights = []; // lumières : { group, local }
  const chimneys = [];
  const clothes = [];

  /* ---------------- Sortes d'instances ---------------- */
  const pebbleGeo = k => geo(`pebble${k}`, () => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + simplex.noise3d(x * 1.7 + k * 9, y * 1.7, z * 1.7) * 0.18; p.setXYZ(i, x * n, Math.max(y, -0.2) * n, z * n); } g.computeVertexNormals(); return g; });
  const stoneMat = std('stoneInst', { map: TX.stone().map, bumpMap: TX.stone().bump, bumpScale: 2.5, roughness: 0.9, color: '#ffffff' });
  for (const k of [0, 1, 2]) batchOf(`cobble${k}`, () => pebbleGeo(k), stoneMat);
  batchOf('stone', () => unitBox(0.18, 0.06), stoneMat);
  batchOf('brick', () => unitBox(0.12), std('brick', { map: TX.clay().map, bumpMap: TX.clay().bump, bumpScale: 2, color: '#ffffff', roughness: 0.9 }));
  batchOf('tile', () => { const s = new THREE.Shape(); s.moveTo(-0.1, 0.06); s.absarc(0, 0.06, 0.1, Math.PI, TAU, false); s.lineTo(0.1, 0.36); s.lineTo(-0.1, 0.36); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; }, std('tileMat', { map: TX.clay().map, bumpMap: TX.clay().bump, bumpScale: 2, color: '#ffffff', roughness: 0.78 }));
  batchOf('slate', () => { const g = new RoundedBoxGeometry(0.22, 0.018, 0.32, 1, 0.006); g.translate(0, 0, -0.16); return g; }, std('slate', { color: '#ffffff', map: TX.stone().map, roughness: 0.6, metalness: 0.1 }));
  batchOf('ridge', () => { const g = new THREE.CylinderGeometry(0.13, 0.14, 0.38, 10, 1, true, 0, Math.PI); g.rotateZ(Math.PI / 2); return g; }, std('ridgeMat', { map: TX.clay().map, color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }));
  batchOf('stud', () => new THREE.SphereGeometry(0.018, 6, 4), M.iron(), { shadow: false });
  batchOf('peg', () => new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6).rotateX(Math.PI / 2), M.plain('#4a3020'), { shadow: false });
  const leafMat = key => std(key, { map: TX.leaf().map, alphaTest: 0.45, side: THREE.DoubleSide, color: '#ffffff', roughness: 0.75 });
  batchOf('ivy', () => new THREE.PlaneGeometry(0.32, 0.32), leafMat('ivyMat'));
  batchOf('leafCard', () => new THREE.PlaneGeometry(0.55, 0.55), leafMat('leafMat'));
  batchOf('flower', () => { const parts = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; parts.push(new THREE.SphereGeometry(0.035, 6, 4).scale(1, 0.35, 0.6).translate(Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04).toNonIndexed()); } return mergeGeometries(parts); }, M.white(), { shadow: false });
  batchOf('flowerHeart', () => new THREE.SphereGeometry(0.022, 6, 4), M.plain('#f2c230'), { shadow: false });
  batchOf('fruit', () => new THREE.SphereGeometry(0.05, 10, 8), std('fruit', { color: '#ffffff', roughness: 0.35 }));
  batchOf('ironBar', () => new THREE.CylinderGeometry(0.014, 0.014, 1, 6), M.iron());
  batchOf('spike', () => new THREE.ConeGeometry(0.03, 0.1, 4), M.iron());
  batchOf('stave', () => new RoundedBoxGeometry(1, 1, 1, 1, 0.1), M.planks('#ffffff'));
  batchOf('bulbs', () => new THREE.SphereGeometry(0.045, 8, 6), BULB, { shadow: false });
  batchOf('flag', () => { const g = new THREE.PlaneGeometry(0.3, 0.38, 2, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), t = (0.19 - y) / 0.38; p.setXYZ(i, x * (1 - t), y - 0.19, Math.sin(t * 2) * 0.03); } g.computeVertexNormals(); return g; }, std('flagMat', { color: '#ffffff', side: THREE.DoubleSide, roughness: 0.9, bumpMap: TX.weave().bump, bumpScale: 1 }));

  /* ---------------- Murs de pierre (chaque pierre posée) ---------------- */
  // Face locale : x de -w/2 à w/2, y de y0 à y1, extérieur vers +z (un noyau de mortier est posé derrière).
  function stoneFace(face, w, y0, y1, tint = 0) {
    let y = y0;
    while (y < y1 - 0.05) {
      const rh = Math.min(between(0.2, 0.3), y1 - y);
      let x = -w / 2 - rnd() * 0.3;
      while (x < w / 2) {
        const l = between(0.28, 0.55), x0 = Math.max(x, -w / 2), x1 = Math.min(x + l, w / 2);
        if (x1 - x0 > 0.08) inst('stone', face, (x0 + x1) / 2, y + rh / 2, between(0.03, 0.06), between(-0.03, 0.03), between(-0.03, 0.03), between(-0.04, 0.04), x1 - x0 - 0.03, rh - 0.03, 0.14, new THREE.Color().setHSL(between(0.06, 0.1), between(0.05, 0.16), between(0.62, 0.8) + tint));
        x += l;
      }
      y += rh;
    }
  }
  const faces = (g, w, d, y = 0) => [
    { f: grp(g, 0, y, d / 2, 0), w, front: true }, { f: grp(g, 0, y, -d / 2, Math.PI), w },
    { f: grp(g, w / 2, y, 0, Math.PI / 2), w: d }, { f: grp(g, -w / 2, y, 0, -Math.PI / 2), w: d },
  ];

  /* ---------------- Fenêtres, portes, lanternes ---------------- */
  function windowAt(face, x, y, o) {
    const w = o.ww ?? 0.72, h = o.wh ?? 0.95, glass = GLASS[rnd() < 0.55 ? 0 : 1];
    beam(face, w + 0.16, 0.1, 0.12, x, y + h / 2 + 0.05, 0.06); beam(face, 0.1, h, 0.12, x - w / 2 - 0.03, y, 0.06); beam(face, 0.1, h, 0.12, x + w / 2 + 0.03, y, 0.06);
    put(face, unitBox(0.04), M.stone(), x, y - h / 2 - 0.05, 0.1, 0, 0, 0, w + 0.3, 0.09, 0.24);
    put(face, new THREE.PlaneGeometry(w, h), glass, x, y, 0.03);
    beam(face, 0.04, h, 0.05, x, y, 0.05); beam(face, w, 0.04, 0.05, x, y + h * 0.1, 0.05);
    if (o.shutters) for (const s of [1, -1]) {
      const sh = grp(face, x + s * (w / 2 + 0.06), y, 0.08, s * between(0.9, 1.4));
      for (let k = 0; k < 3; k++) put(sh, unitBox(0.05), M.planks(o.shutters), s * (w / 6) * (k + 0.5), 0, 0, 0, 0, 0, w / 6 - 0.01, h, 0.035);
      for (const yy of [h * 0.3, -h * 0.3]) put(sh, unitBox(0.05), M.planks(o.shutters), (s * w) / 4, yy, 0.025, 0, 0, 0, w / 2, 0.07, 0.025);
      put(sh, unitBox(0.05), M.planks(o.shutters), (s * w) / 4, 0, 0.025, 0, 0, s * 0.95, h * 0.62, 0.06, 0.02);
      for (const yy of [h * 0.3, -h * 0.3]) put(face, unitBox(0.01), M.iron(), x + s * (w / 2 + 0.02), y + yy, 0.1, 0, 0, 0, 0.14, 0.025, 0.02);
    }
    if (o.flowers && rnd() < 0.75) {
      const by = y - h / 2 - 0.2;
      put(face, unitBox(0.03), M.planks('#8a5a3a'), x, by, 0.22, 0, 0, 0, w + 0.1, 0.18, 0.2);
      put(face, unitBox(0.02), M.plain('#3a2a1a', { roughness: 1 }), x, by + 0.085, 0.22, 0, 0, 0, w, 0.02, 0.16);
      const cols = pickOf([['#ff4a5a', '#ffd23f'], ['#ffffff', '#ffd23f'], ['#b07aff', '#ffe0a0'], ['#ff8a3d', '#ffd23f'], ['#ff7ac8', '#ffffff']]);
      for (let k = 0; k < 14; k++) { const fx = x - w / 2 + 0.05 + rnd() * (w - 0.1), fz = 0.17 + rnd() * 0.1, fy = by + 0.12 + rnd() * 0.12; inst('flower', face, fx, fy, fz, between(-0.4, 0.4), rnd() * TAU, between(-0.4, 0.4), 1, 1, 1, new THREE.Color(pickOf(cols))); inst('flowerHeart', face, fx, fy + 0.012, fz, 0, 0, 0, 1, 1, 1); }
      for (let k = 0; k < 12; k++) inst('ivy', face, x - w / 2 + rnd() * w, by + between(-0.25, 0.12), 0.32 + rnd() * 0.04, between(-0.4, 0.4), between(-0.5, 0.5), rnd() * TAU, between(0.45, 0.8), between(0.45, 0.8), 1, new THREE.Color().setHSL(between(0.25, 0.32), 0.5, between(0.3, 0.42)));
    }
  }
  function door(face, o, x = 0, stoneArch = false) {
    const w = 1.0, h = 1.9;
    put(face, new THREE.PlaneGeometry(w + 0.1, h + 0.1), M.plain('#120c08'), x, h / 2, 0.005);
    for (let k = 0; k < 6; k++) put(face, unitBox(0.02), M.planks(o.door), x - w / 2 + (k + 0.5) * (w / 6), h / 2 - 0.02, 0.05, 0, 0, between(-0.004, 0.004), w / 6 - 0.008, h - 0.05, 0.06);
    for (const yy of [0.35, 1.0, 1.6]) { put(face, unitBox(0.01), M.iron(), x - 0.08, yy, 0.09, 0, 0, 0, w * 0.82, 0.06, 0.014); for (let k = 0; k < 7; k++) inst('stud', face, x - w / 2 + 0.1 + k * 0.12, yy, 0.098, 0, 0, 0, 1, 1, 1); }
    put(face, new THREE.TorusGeometry(0.06, 0.012, 6, 16), M.brass(), x + 0.3, 1.0, 0.11);
    put(face, new THREE.SphereGeometry(0.025, 8, 6), M.brass(), x + 0.3, 1.06, 0.1);
    const sc = () => new THREE.Color().setHSL(0.08, 0.1, between(0.55, 0.68));
    if (stoneArch) {
      const n = 11, R = w / 2 + 0.12;
      for (let k = 0; k <= n; k++) { const a = Math.PI - (k / n) * Math.PI; inst('stone', face, x + Math.cos(a) * R, h - 0.15 + Math.sin(a) * R * 0.6, 0.08, 0, 0, a - Math.PI / 2, 0.18, 0.28, 0.2, sc()); }
      for (const s of [1, -1]) for (let y = 0.15; y < h - 0.2; y += 0.3) inst('stone', face, x + s * (w / 2 + 0.12), y, 0.08, 0, 0, 0, 0.24, 0.27, 0.2, sc());
    } else { beam(face, w + 0.36, 0.16, 0.16, x, h + 0.05, 0.07); for (const s of [1, -1]) beam(face, 0.16, h, 0.16, x + s * (w / 2 + 0.08), h / 2, 0.07); }
    put(face, unitBox(0.05, 0.03), M.stone(), x, 0.06, 0.32, 0, 0, 0, w + 0.5, 0.14, 0.55);
  }
  // Lanterne : cage de fer, verre, bougie et flamme ; une vraie lumière pour les plus importantes.
  function lantern(parent, x, y, z, ry, withLight) {
    const g = grp(parent, x, y, z, ry);
    put(g, new THREE.CylinderGeometry(0.13, 0.15, 0.03, 8), M.iron(), 0, -0.2, 0);
    put(g, new THREE.CylinderGeometry(0.115, 0.115, 0.36, 8, 1, true), LAMPGLASS, 0, 0, 0);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; put(g, unitBox(0.003), M.iron(), Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12, 0, a, 0, 0.018, 0.38, 0.018); }
    put(g, new THREE.ConeGeometry(0.17, 0.16, 8), M.iron(), 0, 0.26, 0);
    put(g, new THREE.SphereGeometry(0.03, 8, 6), M.iron(), 0, 0.36, 0);
    put(g, new THREE.TorusGeometry(0.04, 0.008, 6, 12), M.iron(), 0, 0.4, 0);
    put(g, new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), M.plain('#f2ead8'), 0, -0.13, 0);
    put(g, new THREE.SphereGeometry(0.022, 8, 6), FLAME, 0, -0.06, 0, 0, 0, 0, 1, 2, 1);
    if (withLight) lights.push({ group: g, local: new THREE.Vector3(0, -0.05, 0) });
    return g;
  }

  /* ---------------- Maison à colombages ---------------- */
  function timberFace(f, w, y0, y1, n, open, doorBay) {
    const h = y1 - y0, bw = w / n;
    for (let k = 0; k <= n; k++) { beam(f, 0.15, h, 0.13, -w / 2 + k * bw, y0 + h / 2, 0.035); inst('peg', f, -w / 2 + k * bw, y0 + 0.12, 0.11, 0, 0, 0, 1, 1, 1); inst('peg', f, -w / 2 + k * bw, y1 - 0.12, 0.11, 0, 0, 0, 1, 1, 1); }
    beam(f, w + 0.1, 0.16, 0.14, 0, y0 + 0.08, 0.04); beam(f, w + 0.1, 0.16, 0.14, 0, y1 - 0.08, 0.04);
    for (let k = 0; k < n; k++) {
      const cx = -w / 2 + (k + 0.5) * bw;
      if (k === doorBay) continue;
      if (open(k)) { beam(f, bw, 0.12, 0.11, cx, y0 + h * 0.3, 0.03); continue; }
      const len = Math.hypot(bw, h - 0.3), a = Math.atan2(bw, h - 0.3);
      beam(f, 0.11, len, 0.1, cx, y0 + h / 2, 0.03, 0, 0, a); beam(f, 0.11, len, 0.1, cx, y0 + h / 2, 0.028, 0, 0, -a);
    }
  }
  function ivy(f, w) {
    const x0 = between(-w / 2 + 0.3, w / 2 - 0.3);
    for (let k = 0; k < 160; k++) { const y = Math.pow(rnd(), 0.8) * between(1.2, 3), spread = 0.2 + y * 0.35; inst('ivy', f, x0 + between(-spread, spread), y, 0.1 + rnd() * 0.05, between(-0.3, 0.3), between(-0.4, 0.4), rnd() * TAU, between(0.6, 1), between(0.6, 1), 1, new THREE.Color().setHSL(between(0.22, 0.33) - (rnd() < 0.25 ? 0.2 : 0), 0.5, between(0.25, 0.4))); }
  }
  function house(o) {
    const root = grp(deco, o.x, 0, o.z, o.ry);
    blockers.push({ x: o.x, z: o.z, r: Math.hypot(o.w, o.d) / 2 + 1.2 });
    const H0 = 2.15, HF = 1.85, wall = M.plaster(o.wall), base = o.stoneBase ? H0 : 0.55;
    put(root, unitBox(0.02), M.mortar(), 0, base / 2, 0, 0, 0, 0, o.w - 0.06, base, o.d - 0.06);
    for (const { f, w } of faces(root, o.w, o.d)) stoneFace(f, w + 0.12, 0, base);
    if (!o.stoneBase) put(root, unitBox(0.01), wall, 0, (base + H0) / 2, 0, 0, 0, 0, o.w, H0 - base, o.d);
    for (const { f, w, front } of faces(root, o.w, o.d)) {
      const n = Math.max(2, Math.floor(w / 1.15)), bw = w / n, doorBay = front ? Math.floor(n / 2) : -1;
      if (!o.stoneBase) timberFace(f, w, base, H0, n, k => k % 2 === 1 || k === doorBay, doorBay);
      for (let k = 0; k < n; k++) {
        const cx = -w / 2 + (k + 0.5) * bw;
        if (k === doorBay) door(f, o, cx, o.stoneBase);
        else if (k % 2 === 1) windowAt(f, cx, 1.3, { ...o, ww: Math.min(0.72, bw - 0.3) });
      }
      if (front && o.doorLamp) lantern(f, -w / 2 + (doorBay + 1.05) * bw, 2.0, 0.3, 0, true);
      if (!front && o.ivy && rnd() < 0.6) ivy(f, w);
    }
    let level = grp(root, 0, H0, 0), w = o.w, d = o.d;
    level.rotation.z = o.tilt ?? 0;
    for (let k = 1; k < o.floors; k++) {
      for (const s of [1, -1]) for (let x = -w / 2 + 0.25; x < w / 2; x += 0.5) beam(level, 0.14, 0.16, 0.34, x, 0.08, s * (d / 2 + 0.12));
      for (const s of [1, -1]) for (let z = -d / 2 + 0.25; z < d / 2; z += 0.5) beam(level, 0.34, 0.16, 0.14, s * (w / 2 + 0.12), 0.08, z);
      w += 0.36; d += 0.36;
      beam(level, w + 0.06, 0.2, d + 0.06, 0, 0.26, 0);
      put(level, unitBox(0.01), wall, 0, 0.36 + HF / 2, 0, 0, 0, 0, w, HF, d);
      for (const { f, w: fw } of faces(level, w, d, 0.36)) {
        const n = Math.max(2, Math.floor(fw / 1.05)), bw = fw / n;
        timberFace(f, fw, 0, HF, n, i => i % 2 === 1, -1);
        for (let i = 1; i < n; i += 2) windowAt(f, -fw / 2 + (i + 0.5) * bw, 0.95, { ...o, ww: Math.min(0.66, bw - 0.28), wh: 0.85 });
      }
      level = grp(level, 0, HF + 0.36, 0);
      level.rotation.z = (o.tilt ?? 0) * 0.5;
    }
    roof(level, w, d, o);
    if (o.tower) tower(root, -o.w / 2 - 0.6, o.d / 2 - 1, H0 + HF * (o.floors - 1) + 1.6, o);
    return root;
  }
  // Toit : chaque tuile (ou ardoise) posée, ou chaume épais ; voliges, chevrons, faîtage, pignons charpentés, cheminée.
  function roof(level, w, d, o) {
    const over = 0.45, half = d / 2 + over, rh = d * (o.pitch ?? 0.62), slant = Math.hypot(half, rh), ang = Math.atan2(rh, half), L = w + 0.9;
    const base = new THREE.Color(o.roof ?? '#b8573c');
    for (const s of [1, -1]) {
      const side = grp(level, 0, 0, 0, s > 0 ? 0 : Math.PI);
      const slope = grp(side, 0, 0, half); slope.rotation.x = ang;
      put(slope, unitBox(0.01), M.planks('#6a4a30'), 0, 0.03, -slant / 2, 0, 0, 0, L, 0.06, slant + 0.05);
      beam(slope, L, 0.18, 0.05, 0, 0, 0, 0, 0, 0, M.planks('#5a3a24'));
      for (let x = -L / 2 + 0.2; x < L / 2; x += 0.6) beam(side, 0.1, 0.12, 0.5, x, -0.06, d / 2 + 0.2, -ang * 0.3);
      if (o.thatch) put(slope, unitBox(0.15, 0.04), M.thatch(), 0, 0.2, -slant / 2, 0, 0, 0, L + 0.25, 0.38, slant + 0.2);
      else if (o.slate) { for (let v = 0, row = 0; v < slant + 0.1; v += 0.2, row++) for (let u = -L / 2 + (row % 2) * 0.11; u < L / 2; u += 0.225) inst('slate', slope, u, 0.065, -v + 0.05, -0.06, between(-0.03, 0.03), 0, 1, 1, 1, new THREE.Color().setHSL(0.6, between(0.06, 0.14), between(0.22, 0.34))); }
      else for (let v = -0.05, row = 0; v < slant; v += 0.24, row++) for (let u = -L / 2 + 0.1 + (row % 2) * 0.1; u < L / 2; u += 0.205) {
        const c = base.clone().offsetHSL(between(-0.02, 0.02), between(-0.08, 0.04), between(-0.09, 0.07)); if (rnd() < 0.07) c.lerp(new THREE.Color('#5a6a3a'), 0.5);
        inst('tile', slope, u + between(-0.01, 0.01), 0.065, -v, -0.09, between(-0.04, 0.04), between(-0.02, 0.02), 1, 1, 1, c);
      }
    }
    if (o.thatch) put(level, new THREE.CylinderGeometry(0.32, 0.32, L + 0.3, 16), M.thatch(), 0, rh + 0.05, 0, 0, 0, Math.PI / 2);
    else for (let u = -L / 2; u < L / 2; u += 0.35) inst('ridge', level, u + 0.17, rh + 0.06, 0, 0, 0, 0, 1, 1, 1, (o.slate ? new THREE.Color('#3a4252') : base.clone()).offsetHSL(0, 0, between(-0.1, 0)));
    const y0 = (rh * (half - d / 2)) / half;
    const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(d / 2, y0), new THREE.Vector2(0, rh - 0.06), new THREE.Vector2(-d / 2, y0)]);
    const wallMat = o.slate ? M.stone() : M.plaster(o.wall);
    for (const s of [1, -1]) {
      const g = put(level, new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), wallMat, s * (w / 2) - (s > 0 ? 0.12 : 0), 0, 0, 0, Math.PI / 2);
      const uv = g.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
      const f = grp(level, s * (w / 2 + 0.02), 0, 0, (s * Math.PI) / 2);
      for (const k of [1, -1]) beam(f, 0.08, slant + 0.4, 0.2, (k * half) / 2, rh / 2 - 0.05, 0.14, 0, 0, k * (Math.PI / 2 - ang));
      if (o.slate) continue;
      beam(f, 0.15, rh * 0.9, 0.12, 0, rh * 0.45, 0.04);
      beam(f, d * 0.75, 0.15, 0.12, 0, rh * 0.32, 0.04);
      for (const k of [1, -1]) beam(f, 0.12, rh * 0.62, 0.1, (k * d) / 5, rh * 0.32, 0.035, 0, 0, k * 0.6);
      windowAt(f, d * 0.22, rh * 0.15 + 0.35, { ww: 0.42, wh: 0.5 });
    }
    if (o.chimney !== false) {
      const cx = w * 0.28 * (o.chimneySide ?? 1), cz = -half * 0.28, hh = rh + 1.2, cg = grp(level, cx, rh * 0.45, cz);
      cg.rotation.z = (o.tilt ?? 0) * -2;
      put(cg, unitBox(0.02), M.mortar(), 0, hh / 2, 0, 0, 0, 0, 0.6, hh, 0.6);
      for (let y = 0.04, row = 0; y < hh; y += 0.085, row++) for (const [fx, fz, ry] of [[0, 0.31, 0], [0, -0.31, 0], [0.31, 0, Math.PI / 2], [-0.31, 0, Math.PI / 2]]) for (let k = -1; k <= 1; k++) {
        const off = (row % 2 ? 0.1 : 0) + k * 0.21; if (Math.abs(off) > 0.31) continue;
        inst('brick', cg, fx + (ry ? 0 : off), y, fz + (ry ? off : 0), 0, ry, 0, 0.2, 0.07, 0.1, new THREE.Color().setHSL(between(0.02, 0.05), between(0.4, 0.6), between(0.3, 0.45)));
      }
      put(cg, unitBox(0.03), M.stone(), 0, hh + 0.05, 0, 0, 0, 0, 0.78, 0.12, 0.78);
      for (const k of [-0.12, 0.12]) put(cg, new THREE.CylinderGeometry(0.08, 0.1, 0.32, 10), M.clay(), k, hh + 0.27, 0);
      chimneys.push({ group: cg, local: new THREE.Vector3(0.12, hh + 0.5, 0) });
    }
  }
  function tower(root, tx, tz, th, o) {
    const g = grp(root, tx, 0, tz), n = 26;
    put(g, new THREE.CylinderGeometry(1.0, 1.08, th, 24), M.mortar(), 0, th / 2, 0);
    for (let y = 0, row = 0; y < th; y += 0.26, row++) for (let k = 0; k < n; k++) { const a = ((k + (row % 2) * 0.5) / n) * TAU; inst('stone', g, Math.sin(a) * 1.07, y + 0.13, Math.cos(a) * 1.07, 0, a, 0, 0.25, 0.23, 0.14, new THREE.Color().setHSL(0.08, 0.1, between(0.5, 0.68))); }
    const cone = grp(g, 0, th, 0), CH = 2.8, CR = 1.45, tilt = Math.atan2(CH, CR) - 0.09;
    put(cone, new THREE.ConeGeometry(CR - 0.05, CH, 24), M.planks('#4a3020'), 0, CH / 2 - 0.04, 0);
    for (let row = 0; row < 15; row++) { const t = row / 15, r = CR * (1 - t), y = t * CH, m = Math.max(4, Math.floor((TAU * r) / 0.19)); for (let k = 0; k < m; k++) { const a = ((k + (row % 2) * 0.5) / m) * TAU; inst('tile', cone, Math.sin(a) * r, y, Math.cos(a) * r, tilt, a, 0, 1, 1, 0.85, new THREE.Color(o.roof).offsetHSL(0, 0, between(-0.08, 0.06))); } }
    put(cone, new THREE.SphereGeometry(0.1, 10, 8), M.gold(), 0, CH + 0.1, 0); put(cone, unitBox(0.005), M.iron(), 0, CH + 0.45, 0, 0, 0, 0, 0.03, 0.6, 0.03);
    for (let y = 1.5; y < th - 0.6; y += 1.7) windowAt(grp(g, Math.sin(0.5) * 1.1, y, Math.cos(0.5) * 1.1, 0.5), 0, 0, { ww: 0.38, wh: 0.62 });
  }

  /* ---------------- Chapelle et cimetière ---------------- */
  // Local +x : vers la place. Nef en pierre, contreforts, vitraux, clocher, flèche d'ardoises, cloche.
  function chapel(x, z, ry) {
    const root = grp(deco, x, 0, z, ry);
    blockers.push({ x, z, r: 6.5 });
    const L = 7.2, W = 4.6, H = 4;
    put(root, unitBox(0.02), M.mortar(), 0, H / 2, 0, 0, 0, 0, L - 0.1, H, W - 0.1);
    for (const { f, w } of faces(root, L, W)) stoneFace(f, w + 0.12, 0, H, 0.04);
    const sc = () => new THREE.Color().setHSL(0.08, 0.1, between(0.6, 0.7));
    for (const s of [1, -1]) for (const k of [-2.4, 0, 2.4]) {
      const f = grp(root, k, 0, s * (W / 2), s > 0 ? 0 : Math.PI);
      if (k !== 0) { put(f, unitBox(0.04, 0.03), M.stone(), 0, 1.3, 0.3, 0, 0, 0, 0.5, 2.6, 0.6); put(f, unitBox(0.04, 0.03), M.stone(), 0, 2.9, 0.18, -0.4, 0, 0, 0.45, 1.2, 0.4); }
      else { put(f, new THREE.PlaneGeometry(0.7, 1.6), STAINED, 0, 2.1, 0.17); put(f, new THREE.CircleGeometry(0.35, 20, 0, Math.PI), STAINED, 0, 2.9, 0.17); for (let i = 0; i <= 8; i++) { const a = Math.PI - (i / 8) * Math.PI; inst('stone', f, Math.cos(a) * 0.48, 2.9 + Math.sin(a) * 0.48, 0.17, 0, 0, a - Math.PI / 2, 0.16, 0.22, 0.16, sc()); } for (const xx of [-0.42, 0.42]) for (let yy = 1.4; yy < 2.9; yy += 0.3) inst('stone', f, xx, yy, 0.17, 0, 0, 0, 0.16, 0.28, 0.16, sc()); }
    }
    roof(grp(root, 0, H, 0), L, W, { slate: true, roof: '#4f5d72', pitch: 0.45, chimney: false });
    const tx = L / 2 + 1, TW = 2.4, TH = 8, t = grp(root, tx, 0, 0);
    put(t, unitBox(0.02), M.mortar(), 0, TH / 2, 0, 0, 0, 0, TW - 0.1, TH, TW - 0.1);
    for (const { f, w } of faces(t, TW, TW)) stoneFace(f, w + 0.12, 0, TH - 1.9, 0.05);
    for (const { f } of faces(t, TW, TW, TH - 1.9)) {
      for (const s of [1, -1]) put(f, unitBox(0.03, 0.03), M.stone(), s * 0.95, 0.75, 0, 0, 0, 0, 0.5, 1.5, 0.3);
      put(f, unitBox(0.03), M.stone(), 0, 1.6, 0, 0, 0, 0, TW + 0.1, 0.5, 0.3);
      for (let i = 0; i <= 7; i++) { const a = Math.PI - (i / 7) * Math.PI; inst('stone', f, Math.cos(a) * 0.65, 1.1 + Math.sin(a) * 0.4, 0.05, 0, 0, a - Math.PI / 2, 0.18, 0.22, 0.25, sc()); }
    }
    put(t, new THREE.LatheGeometry([[0, 0.62], [0.2, 0.58], [0.28, 0.34], [0.33, 0.06], [0.46, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 24), M.brass(), 0, TH - 1.4, 0);
    put(t, unitBox(0.02), M.oak(), 0, TH - 0.65, 0, 0, 0, 0, 1.6, 0.16, 0.16);
    const spire = grp(t, 0, TH, 0), SH = 5, SR = TW / 2 + 0.15, slantH = Math.hypot(SH, SR);
    put(spire, unitBox(0.03), M.stone(), 0, 0.08, 0, 0, 0, 0, TW + 0.3, 0.18, TW + 0.3);
    put(spire, new THREE.ConeGeometry(SR * Math.SQRT2 - 0.06, SH, 4), M.planks('#3a2a20'), 0, SH / 2 + 0.12, 0, 0, Math.PI / 4);
    for (let fs = 0; fs < 4; fs++) {
      const face = grp(grp(spire, 0, 0.15, 0, (fs * Math.PI) / 2), 0, 0, SR); face.rotation.x = Math.atan2(SH, SR);
      for (let v = 0, row = 0; v < slantH - 0.15; v += 0.2, row++) { const wv = SR * 2 * (1 - v / slantH); for (let u = -wv / 2 + (row % 2) * 0.1; u < wv / 2; u += 0.22) inst('slate', face, u, 0.03, -v, -0.06, 0, 0, 1, 1, 1, new THREE.Color().setHSL(0.6, 0.1, between(0.2, 0.32))); }
    }
    put(spire, unitBox(0.01), M.iron(), 0, SH + 0.6, 0, 0, 0, 0, 0.06, 1.2, 0.06); put(spire, unitBox(0.01), M.iron(), 0, SH + 0.8, 0, 0, 0, 0, 0.5, 0.06, 0.06);
    put(spire, new THREE.SphereGeometry(0.1, 10, 8), M.gold(), 0, SH + 0.15, 0);
    const front = grp(t, TW / 2, 0, 0, Math.PI / 2);
    door(front, { door: '#5a2a1c' }, 0, true);
    put(front, new THREE.CircleGeometry(0.6, 32), STAINED, 0, 4.2, 0.06);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; inst('stone', front, Math.cos(a) * 0.72, 4.2 + Math.sin(a) * 0.72, 0.1, 0, 0, a, 0.2, 0.26, 0.2, sc()); }
    lantern(front, 0.85, 2.1, 0.25, 0, true);
  }
  const graveSlots = [];
  function cemetery(cx, cz, ry) {
    const g = grp(deco, cx, 0, cz, ry), W = 6.4, D = 4.6;
    blockers.push({ x: cx, z: cz, r: 3.8 });
    put(g, new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), std('graveDirt', { map: tex(TX.dirt().map, 2), color: '#7a7060', roughness: 1 }), 0, heightAt(cx, cz) + 0.03, 0);
    const fence = (x0, z0, x1, z1, gap) => {
      const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      for (let t = 0; t <= len; t += 0.13) { if (gap && Math.abs(t - len / 2) < 0.6) continue; const x = x0 + Math.sin(a) * t, z = z0 + Math.cos(a) * t; inst('ironBar', g, x, 0.6, z, 0, 0, 0, 1, 1.2, 1); inst('spike', g, x, 1.25, z, 0, 0, 0, 1, 1, 1); }
      for (const y of [0.15, 1.05]) put(g, unitBox(0.005), M.iron(), (x0 + x1) / 2, y, (z0 + z1) / 2, 0, a, 0, 0.03, 0.04, len);
      for (const t of [0, len]) put(g, unitBox(0.03, 0.03), M.stone(), x0 + Math.sin(a) * t, 0.7, z0 + Math.cos(a) * t, 0, 0, 0, 0.24, 1.4, 0.24);
    };
    fence(-W / 2, -D / 2, W / 2, -D / 2); fence(-W / 2, D / 2, W / 2, D / 2, true); fence(-W / 2, -D / 2, -W / 2, D / 2); fence(W / 2, -D / 2, W / 2, D / 2);
    const mound = std('mound', { map: TX.grass().map, color: '#6a7a48', roughness: 1 });
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) {
      const s = grp(g, -W / 2 + 0.9 + k * 1.55, 0, -D / 2 + 0.75 + row * 1.35, between(-0.06, 0.06));
      s.rotation.z = between(-0.04, 0.04);
      graveSlots.push(s);
      if (row === 2 || (row === 1 && k > 1)) continue; // places libres pour les morts de la partie
      const kind = rnd();
      if (kind < 0.4) { put(s, unitBox(0.12, 0.04), M.stone(), 0, 0.42, -0.25, 0, 0, 0, 0.55, 0.85, 0.14); put(s, new THREE.CylinderGeometry(0.275, 0.275, 0.14, 20, 1, false, -Math.PI / 2, Math.PI), M.stone(), 0, 0.85, -0.25, Math.PI / 2); }
      else if (kind < 0.75) { put(s, unitBox(0.03, 0.03), M.stone(), 0, 0.55, -0.25, 0, 0, 0, 0.12, 1.1, 0.12); put(s, unitBox(0.03, 0.03), M.stone(), 0, 0.78, -0.25, 0, 0, 0, 0.52, 0.12, 0.12); }
      else { put(s, unitBox(0.01), M.iron(), 0, 0.5, -0.25, 0, 0, 0, 0.05, 1, 0.05); put(s, unitBox(0.01), M.iron(), 0, 0.72, -0.25, 0, 0, 0, 0.42, 0.05, 0.05); put(s, new THREE.TorusGeometry(0.12, 0.012, 6, 20), M.iron(), 0, 0.72, -0.25); }
      put(s, unitBox(0.2, 0.08), mound, 0, 0.05, 0.3, 0, 0, 0, 0.6, 0.18, 1.3);
    }
  }

  /* ---------------- Place pavée et rosace, chemins ---------------- */
  {
    put(scene, new THREE.CircleGeometry(13.3, 96).rotateX(-Math.PI / 2), std('placeBed', { map: tex(TX.dirt().map, 6), color: '#7a6e5e', roughness: 1 }), 0, 0.005, 0).receiveShadow = true;
    // Anneaux de pavés autour d'une rosace (étoile à 8 branches dorée, lune au centre, cercle d'ardoise).
    for (let r = 0.12; r < 12.95; r += 0.165) {
      const n = Math.max(6, Math.floor((TAU * r) / 0.19)), off = rnd() * TAU, size = (TAU * r) / n;
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU, x = Math.sin(a) * r, z = Math.cos(a) * r, star = Math.abs(Math.cos(Math.atan2(x, z) * 4));
        let c;
        if (r < 0.55) c = new THREE.Color().setHSL(0.12, 0.25, between(0.72, 0.8));
        else if (r < 2.6 && r > 2.35) c = new THREE.Color().setHSL(0.62, 0.12, between(0.2, 0.28));
        else if (r < 2.35) c = r < 0.6 + star * star * 1.7 ? new THREE.Color().setHSL(0.11, 0.45, between(0.6, 0.7)) : new THREE.Color().setHSL(0.6, 0.18, between(0.3, 0.4));
        else if (Math.abs(r - 6.6) < 0.25 || r > 12.6) c = new THREE.Color().setHSL(0.07, 0.12, between(0.45, 0.55));
        else c = new THREE.Color().setHSL(between(0.05, 0.1), between(0.06, 0.18), between(0.6, 0.8) * (0.92 + fbm(x * 0.25, z * 0.25) * 0.18));
        if (rnd() < 0.04) c.offsetHSL(0, 0.05, -0.08);
        inst(`cobble${k % 3}`, deco, x, between(0.01, 0.025), z, between(-0.06, 0.06), a + Math.PI / 2 + between(-0.12, 0.12), between(-0.06, 0.06), size * 0.46, between(0.035, 0.055), 0.075, c);
      }
    }
    for (let k = 0; k < 110; k++) { const a = (k / 110) * TAU; inst('stone', deco, Math.sin(a) * 13.25, 0.05, Math.cos(a) * 13.25, 0, a + Math.PI / 2, 0, 0.7, 0.16, 0.34, new THREE.Color().setHSL(0.08, 0.1, between(0.5, 0.65))); }
    const dirt = TX.dirt();
    for (const [deg, len, wid] of [[0, 90, 3.4], [30, 18, 2.3], [150, 16, 2.3], [270, 18, 2.5]]) {
      const a = (deg * Math.PI) / 180, g = new THREE.PlaneGeometry(wid, len, 8, Math.round(len * 2)); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, uv = g.attributes.uv, edge = [];
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i), lz = p.getZ(i) + len / 2 + 12.9, wob = Math.sin(lz * 0.18 + deg) * 0.9;
        const wx = Math.sin(a) * lz + Math.cos(a) * (lx + wob), wz = Math.cos(a) * lz - Math.sin(a) * (lx + wob);
        p.setXYZ(i, wx, heightAt(wx, wz) + 0.04, wz); uv.setXY(i, uv.getX(i) * (wid / 3), uv.getY(i) * (len / 3));
        if (Math.abs(Math.abs(lx) - wid / 2) < 0.01) edge.push([wx, wz]);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: dirt.map, bumpMap: dirt.bump, bumpScale: 3, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.receiveShadow = true; scene.add(m);
      for (let s = 0; s <= len; s += 0.6) { const lz = s + 12.9; blockers.push({ x: Math.sin(a) * lz, z: Math.cos(a) * lz, r: wid / 2 + 0.3 }); }
      for (const [x, z] of edge) for (let k = 0; k < 2; k++) inst(`cobble${k}`, deco, x + between(-0.2, 0.2), heightAt(x, z) + 0.02, z + between(-0.2, 0.2), 0, rnd() * TAU, 0, between(0.05, 0.12), between(0.04, 0.08), between(0.05, 0.1), new THREE.Color().setHSL(0.08, 0.06, between(0.4, 0.6)));
    }
  }

  /* ---------------- Sièges, tonneaux ---------------- */
  function barrel(parent, x, z, h, r, ry = 0) {
    const g = grp(parent, x, 0, z, ry), n = 16;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; inst('stave', g, Math.sin(a) * r * 0.97, h / 2, Math.cos(a) * r * 0.97, 0, a, 0, (TAU * r) / n + 0.008, h, 0.03, new THREE.Color().setHSL(0.07, between(0.35, 0.5), between(0.36, 0.48))); }
    for (const y of [h * 0.12, h * 0.38, h * 0.62, h * 0.88]) put(g, new THREE.TorusGeometry(r + 0.012, 0.012, 4, 28), M.rust(), 0, y, 0, Math.PI / 2);
    put(g, new THREE.CircleGeometry(r * 0.93, 24).rotateX(-Math.PI / 2), M.planks('#9a6e48'), 0, h - 0.02, 0);
    return g;
  }
  for (const s of LG.SEATS) {
    const g = grp(deco, s.x, 0, s.z, s.ry), wd = M.planks('#b48a62'), dk = M.planks('#7a5a40');
    if (s.kind === 'banc') { for (let k = 0; k < 3; k++) put(g, unitBox(0.15), wd, 0, 0.4, -0.14 + k * 0.14, 0, 0, 0, 1.3, 0.05, 0.12); for (const x of [-0.52, 0.52]) { put(g, unitBox(0.1), dk, x, 0.19, 0, 0, 0, 0, 0.08, 0.38, 0.38); put(g, unitBox(0.1), dk, x, 0.06, 0, 0, 0, 0, 0.1, 0.06, 0.46); } put(g, unitBox(0.1), dk, 0, 0.16, 0, 0, 0, 0, 1.0, 0.05, 0.05); }
    if (s.kind === 'chaise') {
      put(g, unitBox(0.05), std('weaveMat', { map: TX.weave().map, bumpMap: TX.weave().bump, bumpScale: 3, roughness: 1 }), 0, 0.39, 0, 0, 0, 0, 0.44, 0.04, 0.42);
      for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) put(g, new THREE.CylinderGeometry(0.025, 0.03, 0.4, 8), dk, x, 0.2, z);
      for (const x of [-0.2, 0.2]) put(g, new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8), dk, x, 0.7, -0.21, -0.08);
      for (const y of [0.62, 0.78, 0.94]) put(g, unitBox(0.2), wd, 0, y, -0.225 - (y - 0.6) * 0.08, -0.08, 0, 0, 0.42, 0.07, 0.03);
    }
    if (s.kind === 'souche') { put(g, new THREE.CylinderGeometry(0.3, 0.36, 0.4, 18, 3), M.bark(), 0, 0.2, 0); put(g, new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2), M.rings(), 0, 0.401, 0); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; put(g, new THREE.CylinderGeometry(0.03, 0.08, 0.5, 6), M.bark(), Math.sin(a) * 0.38, 0.05, Math.cos(a) * 0.38, Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2); } }
    if (s.kind === 'tonneau') barrel(g, 0, 0, 0.4, 0.27);
    if (s.kind === 'tabouret') { put(g, new THREE.CylinderGeometry(0.21, 0.21, 0.06, 20), wd, 0, 0.38, 0); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; put(g, new THREE.CylinderGeometry(0.022, 0.03, 0.42, 8), dk, Math.sin(a) * 0.13, 0.18, Math.cos(a) * 0.13, Math.cos(a) * 0.16, 0, -Math.sin(a) * 0.16); } }
  }

  /* ---------------- Lanternes de la place et fanions ---------------- */
  for (const l of LG.LANTERNS) {
    const g = grp(deco, l.x, 0, l.z, Math.atan2(l.x, l.z));
    put(g, unitBox(0.05, 0.04), M.stone(), 0, 0.2, 0, 0, 0, 0, 0.5, 0.4, 0.5);
    put(g, unitBox(0.04), M.stone(), 0, 0.45, 0, 0, 0, 0, 0.38, 0.1, 0.38);
    put(g, new THREE.CylinderGeometry(0.07, 0.09, 2.8, 10), M.iron(), 0, 1.85, 0);
    for (const y of [0.7, 1.4, 3.1]) put(g, new THREE.TorusGeometry(0.09, 0.015, 6, 16), M.iron(), 0, y, 0, Math.PI / 2);
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.9, 0), new THREE.Vector3(0, 3.2, 0.25), new THREE.Vector3(0, 3.15, 0.55), new THREE.Vector3(0, 2.95, 0.68)]), 20, 0.022, 6), M.iron());
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.75, 0.05), new THREE.Vector3(0, 2.75, 0.3), new THREE.Vector3(0, 2.95, 0.42), new THREE.Vector3(0, 3.1, 0.3)]), 16, 0.012, 5), M.iron());
    put(g, new THREE.SphereGeometry(0.06, 10, 8), M.iron(), 0, 3.28, 0);
    lantern(g, 0, 2.62, 0.68, 0, true);
  }
  {
    const cols = ['#c8402e', '#e8b030', '#2f5f9a', '#3a8a4a', '#f2e8d4', '#7a4a8f'];
    for (let k = 0; k < LG.LANTERNS.length; k++) {
      const A = LG.LANTERNS[k], B = LG.LANTERNS[(k + 1) % LG.LANTERNS.length];
      const pts = Array.from({ length: 17 }, (_, i) => { const u = i / 16; return new THREE.Vector3(A.x + (B.x - A.x) * u, 3.2 - Math.sin(u * Math.PI) * 0.8, A.z + (B.z - A.z) * u); });
      put(deco, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.01, 4), M.plain('#3a2a20'));
      for (let i = 1; i < 16; i++) { const p = pts[i], q = pts[i + 1]; inst('flag', deco, p.x, p.y, p.z, between(-0.15, 0.15), Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2, 0, 1, 1, 1, new THREE.Color(cols[(i + k) % cols.length])); }
    }
  }

  /* ---------------- Les bâtiments ---------------- */
  house({ ...at(60, 20), w: 5.2, d: 4.4, floors: 2, wall: '#f3e2c0', roof: '#b8573c', door: '#8a3a2a', shutters: '#3f7a5a', flowers: true, tilt: 0.025, ivy: true, doorLamp: true });
  house({ ...at(90, 21), w: 4.8, d: 4.6, floors: 2, wall: '#e8d6c8', roof: '#5a6f8f', door: '#3a4f6f', shutters: '#b8573c', flowers: true, stoneBase: true, tower: true });
  house({ ...at(120, 20), w: 4.6, d: 4.2, floors: 1, wall: '#f1d7a8', thatch: true, door: '#7a4a2a', shutters: '#8a5a8a', flowers: true, pitch: 0.78, tilt: -0.02, ivy: true });
  const inn = house({ ...at(180, 21.4), w: 9, d: 5.6, floors: 2, wall: '#f6e7cc', roof: '#a8473a', door: '#6a3424', shutters: '#2f5f7a', flowers: true, stoneBase: true, pitch: 0.55, chimneySide: -1, doorLamp: true });
  house({ ...at(210, 20.2), w: 3.8, d: 4, floors: 3, wall: '#dfe6ee', roof: '#3f5f8f', door: '#2f4f7f', shutters: '#e0a030', flowers: true, tilt: -0.045, pitch: 0.8 });
  { const p = at(248, 22.5); chapel(p.x, p.z, p.ry - Math.PI / 2); }
  { const p = at(226, 18.2); cemetery(p.x, p.z, p.ry); }
  house({ ...at(300, 20), w: 5, d: 4.4, floors: 2, wall: '#f0c9b8', roof: '#6a7a4a', door: '#4a6a3a', shutters: '#7a4a2a', flowers: true, tilt: 0.05, chimneySide: -1, ivy: true });
  house({ ...at(334, 19.6), w: 4.2, d: 3.8, floors: 1, wall: '#f4e8d0', thatch: true, door: '#5a3a6a', shutters: '#b8573c', flowers: true, pitch: 0.8, tilt: 0.02, doorLamp: true });

  // L'auberge : enseigne, auvent de tuiles, terrasse (tables, chopes, bougies), tonneaux, ampoules, citrouilles sculptées
  {
    const f = grp(inn, 0, 0, 2.8 + 0.36);
    put(f, unitBox(0.02), M.planks('#5a3a22'), 0, 2.85, 1.55, 0, 0, 0, 2.2, 1.0, 0.08);
    put(f, new THREE.PlaneGeometry(2.1, 0.9), std('innSign', { map: TX.innSign().map, roughness: 0.75 }), 0, 2.85, 1.6);
    for (const s of [1, -1]) { beam(f, 0.16, 2.3, 0.16, s * 2.1, 1.15, 1.5); put(f, unitBox(0.04, 0.03), M.stone(), s * 2.1, 0.08, 1.5, 0, 0, 0, 0.3, 0.16, 0.3); }
    const awning = grp(f, 0, 2.35, 0.05); awning.rotation.x = 0.32;
    put(awning, unitBox(0.01), M.planks('#6a4a30'), 0, 0.02, 0.85, 0, 0, 0, 4.7, 0.05, 1.7);
    for (let v = 0, row = 0; v < 1.5; v += 0.24, row++) for (let u = -2.3 + (row % 2) * 0.1; u < 2.3; u += 0.205) inst('tile', awning, u, 0.06, v + 0.36, -0.09, 0, 0, 1, 1, 1, new THREE.Color('#a8473a').offsetHSL(0, 0, between(-0.08, 0.06)));
    for (const s of [1, -1]) {
      const t = grp(f, s * 3.4, 0, 2.8);
      for (let k = 0; k < 5; k++) put(t, unitBox(0.1), M.planks('#a07650'), -0.4 + k * 0.2, 0.78, 0, 0, 0, 0, 0.19, 0.05, 1.1);
      for (const x of [-0.4, 0.4]) put(t, unitBox(0.1), M.planks('#7a5638'), x, 0.38, 0, 0, 0, 0, 0.08, 0.76, 0.9);
      for (const z of [-0.85, 0.85]) { for (let k = 0; k < 2; k++) put(t, unitBox(0.1), M.planks('#a07650'), 0, 0.45, z + (k - 0.5) * 0.14, 0, 0, 0, 1.0, 0.05, 0.12); for (const x of [-0.42, 0.42]) put(t, unitBox(0.1), M.planks('#7a5638'), x, 0.22, z, 0, 0, 0, 0.07, 0.44, 0.26); }
      for (const [x, z] of [[0.2, 0.15], [-0.25, -0.2], [0.05, -0.35]]) { put(t, new THREE.CylinderGeometry(0.065, 0.06, 0.16, 14), M.planks('#c8a070'), x, 0.89, z); put(t, new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI), M.planks('#c8a070'), x + 0.07, 0.89, z, 0, 0, -Math.PI / 2); put(t, new THREE.CylinderGeometry(0.058, 0.058, 0.02, 14), M.plain('#fff6e0', { roughness: 0.4 }), x, 0.975, z); }
      put(t, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12, 1, true), LAMPGLASS, 0, 0.86, 0.2); put(t, new THREE.SphereGeometry(0.013, 6, 4), FLAME, 0, 0.87, 0.2, 0, 0, 0, 1, 1.8, 1);
    }
    for (const [x, z] of [[-4.8, 0.6], [-4.95, 1.45], [4.9, 0.9], [-4.6, 1.05]]) barrel(f, x, z, 0.9, 0.34, rnd());
    for (const s of [1, -1]) {
      const p = grp(f, s * 1.45, 0, 0.75, s * 0.3), pg = new THREE.SphereGeometry(0.3, 24, 16), pp = pg.attributes.position;
      for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), r = 1 - Math.abs(Math.sin(Math.atan2(x, z) * 5)) * 0.08; pp.setX(i, x * r); pp.setZ(i, z * r); }
      pg.computeVertexNormals();
      put(p, pg, M.plain('#e06a1a', { roughness: 0.6 }), 0, 0.24, 0, 0, 0, 0, 1, 0.8, 1); put(p, new THREE.CylinderGeometry(0.025, 0.04, 0.14, 6), M.plain('#4f6a2a'), 0, 0.5, 0, 0, 0, 0.3);
      for (const x of [-0.1, 0.1]) put(p, new THREE.ConeGeometry(0.05, 0.08, 3), PUMPKIN, x, 0.3, 0.255, Math.PI / 2, 0, Math.PI);
      put(p, unitBox(0.01), PUMPKIN, 0, 0.16, 0.26, 0, 0, 0, 0.2, 0.05, 0.03);
    }
    for (const s of [1, -1]) beam(f, 0.12, 2.8, 0.12, s * 4.6, 1.4, 3.9);
    for (const [A, B] of [[[-2.1, 2.35, 1.5], [-4.6, 2.75, 3.9]], [[2.1, 2.35, 1.5], [4.6, 2.75, 3.9]], [[-4.6, 2.75, 3.9], [4.6, 2.75, 3.9]]]) {
      const pts = Array.from({ length: 21 }, (_, i) => { const u = i / 20; return new THREE.Vector3(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u - Math.sin(u * Math.PI) * 0.45, A[2] + (B[2] - A[2]) * u); });
      put(f, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 4), M.plain('#1a1410'));
      for (let i = 1; i < 20; i += 2) inst('bulbs', f, pts[i].x, pts[i].y - 0.06, pts[i].z, 0, 0, 0, 1, 1.2, 1);
    }
    lights.push({ group: f, local: new THREE.Vector3(0, 2.2, 3.0), color: '#ffb868', power: 1.3 });
  }

  /* ---------------- Étal, charrette, panneau, tas de bois, linge ---------------- */
  {
    const p = at(348, 15.6), g = grp(deco, p.x, 0, p.z, p.ry);
    blockers.push({ x: p.x, z: p.z, r: 2 });
    for (let k = 0; k < 6; k++) put(g, unitBox(0.1), M.planks('#a07650'), -1.25 + k * 0.5, 0.92, 0, 0, 0, 0, 0.48, 0.06, 1.15);
    for (const [x, z] of [[-1.25, -0.5], [1.25, -0.5], [-1.25, 0.5], [1.25, 0.5]]) beam(g, 0.12, z < 0 ? 2.5 : 2.15, 0.12, x, z < 0 ? 1.25 : 1.08, z);
    const cg = new THREE.PlaneGeometry(3.1, 1.7, 30, 14), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i); cp.setZ(i, -Math.sin(((x + 1.55) / 3.1) * Math.PI * 5) * 0.03 - (1 - (2 * Math.abs(x)) / 3.1) * 0.06 + (y < -0.75 ? Math.abs(Math.sin(x * 8)) * 0.08 : 0)); }
    cg.computeVertexNormals();
    put(g, cg, std('canopy', { map: TX.stripes().map, bumpMap: TX.stripes().bump, bumpScale: 1, side: THREE.DoubleSide, roughness: 0.95 }), 0, 2.32, 0.05, -Math.PI / 2 + 0.24);
    for (let c = 0; c < 4; c++) { const cx = -1.0 + c * 0.66; put(g, unitBox(0.02), M.planks('#c49a6a'), cx, 1.05, 0.05, 0, 0, 0, 0.55, 0.22, 0.42); const col = ['#c8202a', '#e8c030', '#7ab82a', '#e86a1a'][c]; for (let k = 0; k < 18; k++) inst('fruit', g, cx + between(-0.22, 0.22), 1.18 + rnd() * 0.06, 0.05 + between(-0.16, 0.16), 0, 0, 0, 1, 1, 1, new THREE.Color(col).offsetHSL(0, 0, between(-0.08, 0.08))); }
    put(g, new THREE.CylinderGeometry(0.22, 0.18, 0.28, 20, 1, true), std('basket', { map: TX.weave().map, bumpMap: TX.weave().bump, bumpScale: 3, side: THREE.DoubleSide }), 0.9, 0.14, 0.9);
    for (let k = 0; k < 4; k++) put(g, new THREE.SphereGeometry(between(0.17, 0.26), 20, 12), M.plain(['#e06a1a', '#d8902a', '#e8b850', '#c85a1a'][k], { roughness: 0.6 }), -0.9 + k * 0.45, 0.18, 0.95 + (k % 2) * 0.25, 0, rnd(), 0, 1, 0.75, 1);
    for (let k = 0; k < 3; k++) put(g, unitBox(0.15, 0.06), std('sack', { map: TX.weave().map, color: '#d8c8a0', roughness: 1 }), -1.6 - k * 0.1, 0.3, -0.3 + k * 0.4, 0, rnd(), 0.1, 0.42, 0.6, 0.35);
  }
  {
    const p = at(102, 15.8), g = grp(deco, p.x, 0, p.z, p.ry + 1.2);
    blockers.push({ x: p.x, z: p.z, r: 2 });
    for (let k = 0; k < 7; k++) put(g, unitBox(0.05), M.planks('#9a7048'), -1.1 + k * 0.37, 0.78, 0, 0, 0, 0, 0.35, 0.06, 1.35);
    for (const s of [1, -1]) for (let k = 0; k < 3; k++) put(g, unitBox(0.05), M.planks('#8a6038'), 0, 0.9 + k * 0.15, s * 0.65, 0, 0, 0, 2.5, 0.13, 0.05);
    for (const z of [0.78, -0.78]) {
      const w = grp(g, -0.55, 0.52, z);
      put(w, new THREE.TorusGeometry(0.5, 0.05, 8, 28), M.planks('#6a4a30'));
      put(w, new THREE.TorusGeometry(0.52, 0.02, 6, 28), M.rust());
      for (let k = 0; k < 10; k++) put(w, unitBox(0.01), M.planks('#6a4a30'), 0, 0, 0, 0, 0, (k / 10) * Math.PI, 0.04, 0.96, 0.04);
      put(w, new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), M.planks('#5a3a22'), 0, 0, 0, Math.PI / 2);
    }
    beam(g, 1.8, 0.07, 0.07, 1.9, 0.62, 0.3, 0, 0.25, 0.2); beam(g, 1.8, 0.07, 0.07, 1.9, 0.62, -0.3, 0, -0.25, 0.2);
    for (const [x, y] of [[-0.55, 1.15], [0.45, 1.15], [-0.05, 1.58]]) { put(g, unitBox(0.14, 0.05), M.thatch(), x, y, 0, 0, 0, 0, 0.9, 0.44, 0.6); for (const xx of [-0.25, 0.25]) put(g, new THREE.TorusGeometry(0.25, 0.012, 4, 20), M.plain('#6a4a20'), x + xx, y, 0, 0, Math.PI / 2, 0, 1, 1, 1.4); }
    const fork = grp(g, 0.9, 1.3, 0.4); fork.rotation.z = -0.6; put(fork, new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), M.planks('#b08a5a')); for (const x of [-0.06, 0, 0.06]) put(fork, new THREE.CylinderGeometry(0.008, 0.004, 0.3, 6), M.iron(), x, 0.92, 0);
  }
  {
    const p = at(260, 14.8), g = grp(deco, p.x, 0, p.z, p.ry);
    for (const s of [1, -1]) beam(g, 0.14, 2.2, 0.14, s * 0.8, 1.1, 0);
    for (let k = 0; k < 6; k++) put(g, unitBox(0.02), M.planks('#8a6448'), 0, 0.85 + k * 0.2, 0, 0, 0, 0, 1.6, 0.19, 0.05);
    for (const s of [1, -1]) put(grp(g, 0, 2.15, 0, s > 0 ? 0 : Math.PI), unitBox(0.01), M.planks('#5a4030'), 0, 0.1, 0.18, 0.5, 0, 0, 2, 0.05, 0.45);
    put(g, new THREE.PlaneGeometry(0.66, 0.66), std('poster', { map: TX.poster().map, roughness: 1 }), -0.38, 1.4, 0.035, 0, 0, 0.04);
    put(g, new THREE.PlaneGeometry(0.46, 0.34), M.plain('#f2e6c8'), 0.42, 1.55, 0.035, 0, 0, -0.06);
    put(g, new THREE.PlaneGeometry(0.4, 0.3), M.plain('#e6d0a0'), 0.38, 1.12, 0.035, 0, 0, 0.08);
  }
  {
    const p = at(195, 16), g = grp(deco, p.x, 0, p.z, p.ry);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 7 - r; k++) { const lg = grp(g, -0.8 + k * 0.27 + r * 0.135, 0.13 + r * 0.235, 0); lg.rotation.z = Math.PI / 2; lg.rotation.x = between(-0.05, 0.05); put(lg, new THREE.CylinderGeometry(0.125, 0.13, 1.1, 12, 1, true), M.bark()); for (const s of [1, -1]) put(lg, new THREE.CircleGeometry(0.125, 14), M.rings(), 0, s * 0.55, 0, -s * Math.PI / 2); }
    const axe = grp(g, 1.2, 0.5, 0.4); axe.rotation.z = 0.3; put(axe, new THREE.CylinderGeometry(0.02, 0.025, 0.8, 8), M.planks('#b08a5a')); put(axe, unitBox(0.01), M.iron(), 0.06, 0.38, 0, 0, 0, 0, 0.16, 0.12, 0.03);
    put(g, new THREE.CylinderGeometry(0.32, 0.36, 0.45, 18), M.bark(), 1.2, 0.22, 0.4); put(g, new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), M.rings(), 1.2, 0.451, 0.4);
    for (const [x, z, s] of [[1.9, -0.3, 0.55], [2.3, 0.3, 0.45]]) { const c = grp(g, x, 0, z, rnd()); for (let k = 0; k < 4; k++) put(c, unitBox(0.01), M.planks('#c49a6a'), 0, s / 2, ((k - 1.5) * s) / 4.2, 0, 0, 0, s, s, s / 4.4); for (const yy of [0.04, s - 0.04]) for (const zz of [-1, 1]) put(c, unitBox(0.01), M.planks('#8a6a4a'), 0, yy, (zz * s) / 2, 0, 0, 0, s + 0.02, 0.06, 0.03); }
  }
  {
    const A = at(311, 17.4), B = at(323, 17.2), g = grp(deco);
    for (const P of [A, B]) beam(g, 0.12, 2.2, 0.12, P.x, 1.1, P.z, 0, 0, 0, M.planks('#8a6448'));
    const pts = Array.from({ length: 13 }, (_, i) => { const u = i / 12; return new THREE.Vector3(A.x + (B.x - A.x) * u, 2.05 - Math.sin(u * Math.PI) * 0.22, A.z + (B.z - A.z) * u); });
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4), M.plain('#d8c8a0'));
    for (const [u, w, h, c] of [[0.18, 0.7, 0.9, '#f4efe2'], [0.4, 0.5, 0.6, '#7a9ac8'], [0.58, 0.8, 1.0, '#f2e6d0'], [0.8, 0.45, 0.55, '#c85a4a']]) {
      const p = pts[Math.round(u * 12)], cg = new THREE.PlaneGeometry(w, h, 8, 8); cg.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(cg, std(`cloth${c}`, { color: c, side: THREE.DoubleSide, roughness: 1, bumpMap: TX.weave().bump, bumpScale: 0.6 }));
      m.position.copy(p); m.rotation.y = Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2; m.castShadow = m.receiveShadow = true; scene.add(m);
      clothes.push({ m, base: cg.attributes.position.array.slice(), ph: rnd() * TAU });
    }
  }

  /* ---------------- Arbres détaillés ---------------- */
  const heroTops = [];
  function tree(x, z, s, hues) {
    const g = grp(deco, x, heightAt(x, z), z, rnd() * TAU), leaves = [];
    blockers.push({ x, z, r: 0.9 * s });
    function branch(p0, dir, len, rad, depth) {
      const p1 = p0.clone().add(dir.clone().multiplyScalar(len)), mid = p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(between(-0.1, 0.1), 0, between(-0.1, 0.1)).multiplyScalar(len));
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1), tg = new THREE.TubeGeometry(curve, 6, rad, 8), pos = tg.attributes.position;
      for (let i = 0; i < pos.count; i++) { const seg = Math.floor(i / 9) / 6, c = curve.getPoint(Math.min(1, seg)), k = 1 - seg * 0.35; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k); }
      tg.computeVertexNormals();
      put(g, tg, M.bark());
      if (depth === 0 || rad < 0.03) { for (let k = 0; k < 70; k++) leaves.push(p1.clone().add(new THREE.Vector3(between(-1, 1), between(-0.6, 0.8), between(-1, 1)).multiplyScalar(0.9 * s))); return; }
      const n = depth > 2 ? 3 : 2 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) branch(p1, dir.clone().add(new THREE.Vector3(between(-0.9, 0.9), between(0.1, 0.6), between(-0.9, 0.9))).normalize(), len * between(0.62, 0.78), rad * 0.62, depth - 1);
    }
    put(g, new THREE.CylinderGeometry(0.35 * s, 0.6 * s, 0.6, 12), M.bark(), 0, 0.15, 0);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; put(g, new THREE.CylinderGeometry(0.05 * s, 0.16 * s, 1.1 * s, 6), M.bark(), Math.sin(a) * 0.45 * s, 0.05, Math.cos(a) * 0.45 * s, Math.cos(a) * 1.25, 0, -Math.sin(a) * 1.25); }
    branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 2.6 * s, 0.32 * s, 4);
    for (const p of leaves) inst('leafCard', g, p.x, p.y, p.z, rnd() * TAU, rnd() * TAU, rnd() * TAU, between(0.8, 1.3) * s, between(0.8, 1.3) * s, 1, new THREE.Color().setHSL(pickOf(hues) + between(-0.02, 0.02), between(0.6, 0.85), between(0.38, 0.55)));
    heroTops.push({ x, z, top: heightAt(x, z) + 5.5 * s });
  }
  for (const [deg, r, s, hues] of [[287, 16.4, 1.15, [0.07, 0.09, 0.11]], [73, 17.2, 1, [0, 0.02, 0.04]], [140, 24.5, 1.05, [0.1, 0.12, 0.08]], [222, 25, 1.1, [0.13, 0.1, 0.15]], [18, 24, 1.2, [0.05, 0.08, 0.1]], [342, 25.5, 0.95, [0.25, 0.08, 0.06]], [160, 30, 1.3, [0.07, 0.11]], [40, 31, 1.25, [0.02, 0.05]]]) { const p = at(deg, r); tree(p.x, p.z, s, hues); }

  // Rochers moussus, fougères, champignons
  batchOf('rock', () => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3)); const p = g.attributes.position, col = []; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + fbm(x * 1.2, z * 1.2 + y) * 0.35; p.setXYZ(i, x * n, y * n * 0.7, z * n); } g.computeVertexNormals(); const nr = g.attributes.normal; for (let i = 0; i < p.count; i++) { const moss = smooth(0.4, 0.8, nr.getY(i)); col.push(0.55 - moss * 0.25, 0.53 - moss * 0.1, 0.5 - moss * 0.3); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }, std('rockMat', { map: TX.stone().map, bumpMap: TX.stone().bump, bumpScale: 4, vertexColors: true, roughness: 0.95 }));
  const blocked = (x, z, pad = 0) => blockers.some(b => Math.hypot(b.x - x, b.z - z) < b.r + pad);
  for (let k = 0; k < 90; k++) { const a = rnd() * TAU, r = between(14.5, 45), x = Math.sin(a) * r, z = Math.cos(a) * r; if (blocked(x, z)) continue; const s = between(0.15, r > 26 ? 1.1 : 0.5); inst('rock', deco, x, heightAt(x, z) + s * 0.1, z, 0, rnd() * TAU, 0, s, s, s, null); blockers.push({ x, z, r: s }); }
  batchOf('fern', () => { const parts = []; for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(0.28, 0.9, 1, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.45; p.setY(i, y); p.setZ(i, y * y * 0.35); } g.rotateX(-0.9); g.rotateY((k / 7) * TAU); parts.push(g); } return mergeGeometries(parts); }, std('fernMat', { map: TX.fern().map, alphaTest: 0.5, side: THREE.DoubleSide, color: '#ffffff', roughness: 0.8 }));
  for (let k = 0; k < 300; k++) { const a = rnd() * TAU, r = between(24, 40), x = Math.sin(a) * r, z = Math.cos(a) * r; if (blocked(x, z)) continue; const s = between(0.6, 1.3); inst('fern', deco, x, heightAt(x, z), z, 0, rnd() * TAU, 0, s, s, s, new THREE.Color().setHSL(between(0.2, 0.3) - (rnd() < 0.3 ? 0.15 : 0), 0.5, between(0.25, 0.38))); }
  for (let k = 0; k < 30; k++) { const a = rnd() * TAU, r = between(24, 32), x = Math.sin(a) * r, z = Math.cos(a) * r, g = grp(deco, x, heightAt(x, z), z); for (let i = 0; i < 4; i++) { const s = between(0.5, 1.2), ox = between(-0.3, 0.3), oz = between(-0.3, 0.3); put(g, new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.22 * s, 8), M.plain('#f0e6d2'), ox, 0.11 * s, oz); put(g, new THREE.SphereGeometry(0.14 * s, 14, 8, 0, TAU, 0, Math.PI / 2), M.plain(k % 3 ? '#c8302a' : '#a8723a', { roughness: 0.45 }), ox, 0.2 * s, oz, 0, 0, 0, 1, 0.75, 1); if (k % 3) for (let j = 0; j < 5; j++) put(g, new THREE.SphereGeometry(0.018 * s, 6, 4), M.plain('#ffffff'), ox + Math.sin(j * 1.7) * 0.08 * s, 0.29 * s, oz + Math.cos(j * 1.7) * 0.08 * s); } }

  // La forêt : sapins aux branches retombantes et feuillus d'automne
  {
    const pines = [], broad = [];
    for (let k = 0; k < 900; k++) {
      const a = rnd() * TAU, r = 30 + Math.pow(rnd(), 1.3) * 90, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if ((r < 75 && Math.abs(Math.atan2(x, z)) < 0.1 + 2 / r) || blocked(x, z, 1)) continue;
      const t = { x, z, y: heightAt(x, z), s: between(0.85, 1.6) * (1 + r / 150), ry: rnd() * TAU };
      (rnd() < 0.58 ? pines : broad).push(t);
    }
    const pineG = (() => {
      const parts = [];
      for (let k = 0; k < 9; k++) {
        const t = k / 9, r = 1.9 * (1 - t) + 0.25, y = 1.2 + t * 6.5, c = new THREE.ConeGeometry(r, 1.4, 16, 2, true), p = c.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), yy = p.getY(i), a = Math.atan2(x, z), low = yy < 0, jag = 1 + Math.sin(a * 16) * 0.12 * (low ? 1 : 0); p.setXYZ(i, x * jag, yy - (low ? Math.abs(Math.sin(a * 8)) * 0.25 : 0), z * jag); }
        c.translate(0, y, 0); c.computeVertexNormals();
        const col = []; for (let i = 0; i < p.count; i++) { const cc = new THREE.Color().setHSL(0.38, 0.35, 0.14 + t * 0.1 + (p.getY(i) - y < 0 ? -0.03 : 0.03)); col.push(cc.r, cc.g, cc.b); }
        c.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); parts.push(c.toNonIndexed());
      }
      return mergeGeometries(parts);
    })();
    const forest = (g, mat, list, colorFn, sy = 1) => {
      const m = new THREE.InstancedMesh(g, mat, list.length), o = new THREE.Object3D();
      list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.ry, 0); o.scale.set(t.s, t.s * sy, t.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (colorFn) m.setColorAt(i, colorFn()); });
      m.castShadow = m.receiveShadow = true; scene.add(m);
    };
    forest(pineG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), pines, () => new THREE.Color().setHSL(0, 0, between(0.8, 1.15)));
    forest(new THREE.CylinderGeometry(0.15, 0.3, 2, 8).translate(0, 1, 0), M.bark(), [...pines, ...broad], null, 1.3);
    const crownG = (() => { const parts = []; for (const [x, y, z, r] of [[0, 3.2, 0, 1.7], [1, 2.7, 0.4, 1.2], [-0.9, 2.9, -0.3, 1.3], [0.2, 4.1, -0.4, 1.2], [-0.3, 2.5, 1, 1.1]]) { const g = mergeVertices(new THREE.IcosahedronGeometry(r, 2)); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + fbm(p.getX(i) * 1.5 + x, p.getZ(i) * 1.5 + p.getY(i)) * 0.25; p.setXYZ(i, p.getX(i) * n + x, p.getY(i) * n + y, p.getZ(i) * n + z); } g.computeVertexNormals(); parts.push(g.toNonIndexed()); } return mergeGeometries(parts); })();
    forest(crownG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), broad, () => new THREE.Color().setHSL(between(0.01, 0.13), between(0.55, 0.8), between(0.35, 0.5)));
  }

  /* ---------------- Herbe : des brins un à un, qui ondulent au vent ---------------- */
  {
    const blade = new THREE.PlaneGeometry(0.045, 0.42, 1, 5), bp = blade.attributes.position, col = [];
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i) + 0.21, t = y / 0.42; bp.setXYZ(i, bp.getX(i) * (1 - t * 0.85), y, t * t * 0.09); col.push(0.45 + t * 0.55, 0.45 + t * 0.55, 0.45 + t * 0.55); }
    blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const bn = blade.attributes.normal; for (let i = 0; i < bn.count; i++) bn.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float t = position.y / 0.42;
        float w = sin(uTime * 1.6 + wp.x * 0.32 + wp.z * 0.21) * 0.6 + sin(uTime * 3.7 + wp.x * 1.3 - wp.z * 0.7) * 0.25;
        transformed.x += w * t * t * 0.11; transformed.z += (w * 0.5 + 0.3) * t * t * 0.08;`);
    };
    const free = (x, z) => !blockers.some(b => (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) < b.r * b.r);
    const list = [];
    for (let k = 0; k < 240000; k++) { const a = rnd() * TAU, r = 13.45 + Math.pow(rnd(), 1.5) * 34, x = Math.sin(a) * r, z = Math.cos(a) * r; if (free(x, z)) list.push([x, z]); }
    const m = new THREE.InstancedMesh(blade, mat, list.length), o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach(([x, z], i) => {
      const s = between(0.6, 1.35) * (1 + fbm(x * 0.08, z * 0.08) * 0.4);
      o.position.set(x, heightAt(x, z), z); o.rotation.set(between(-0.25, 0.25), rnd() * TAU, between(-0.25, 0.25)); o.scale.set(s, s * between(0.7, 1.4), s); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      const au = smooth(0.15, 0.55, fbm(x * 0.05 + 7, z * 0.05)); c.setHSL(0.24 - au * 0.12 + between(-0.02, 0.02), 0.5 + au * 0.1, between(0.26, 0.4)); m.setColorAt(i, c);
    });
    m.receiveShadow = true; scene.add(m);
    const fl = [], lv = [];
    for (let k = 0; k < 2500; k++) { const a = rnd() * TAU, r = between(13.6, 30), x = Math.sin(a) * r, z = Math.cos(a) * r; if (free(x, z) && fbm(x * 0.15, z * 0.15) > 0.15) fl.push([x, z]); }
    for (let k = 0; k < 9000; k++) { const a = rnd() * TAU, r = between(5, 34), x = Math.sin(a) * r, z = Math.cos(a) * r; if (r < 13.3 || free(x, z)) lv.push([x, z, r]); }
    const fm = new THREE.InstancedMesh(BATCH.flower.make(), M.white(), fl.length);
    fl.forEach(([x, z], i) => { o.position.set(x, heightAt(x, z) + between(0.15, 0.35), z); o.rotation.set(between(-0.3, 0.3), rnd() * TAU, 0); o.scale.setScalar(between(0.7, 1.2)); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); fm.setColorAt(i, new THREE.Color(pickOf(['#ffffff', '#ffd23f', '#b07aff', '#ff6a8a', '#7ab8ff']))); });
    scene.add(fm);
    const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2), std('deadLeaf', { map: TX.oneLeaf().map, alphaTest: 0.5, side: THREE.DoubleSide, color: '#ffffff', roughness: 0.8 }), lv.length);
    lv.forEach(([x, z, r], i) => { o.position.set(x, (r < 13.3 ? 0.065 : heightAt(x, z)) + 0.02 + rnd() * 0.01, z); o.rotation.set(between(-0.2, 0.2), rnd() * TAU, between(-0.2, 0.2)); o.scale.setScalar(between(0.7, 1.4)); o.updateMatrix(); lm.setMatrixAt(i, o.matrix); lm.setColorAt(i, new THREE.Color().setHSL(between(0, 0.12), between(0.6, 0.85), between(0.3, 0.5))); });
    lm.receiveShadow = true; scene.add(lm);
  }

  /* ---------------- Fusion du décor et des lots ---------------- */
  deco.updateMatrixWorld(true);
  scene.add(bake(deco));
  for (const [name, b] of Object.entries(BATCH)) {
    if (!b.list.length) continue;
    const m = new THREE.InstancedMesh(b.make(), b.mat, b.list.length), colored = b.list.some(x => x.color);
    b.list.forEach(({ o, color }, i) => { m.setMatrixAt(i, o.matrixWorld); if (colored) m.setColorAt(i, color ?? new THREE.Color('#ffffff')); });
    m.castShadow = b.shadow; m.receiveShadow = b.receive; scene.add(m);
    if (name === 'leafCard' || name === 'ivy') m.material.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float f = sin(uTime * 2.3 + wp.x * 1.7 + wp.y * 1.3 + wp.z) * 0.06; transformed.x += f * (position.y + 0.3); transformed.z += f * 0.5;`); };
  }
  for (const c of chimneys) c.pos = c.group.localToWorld(c.local.clone());
  const lampLights = lights.map(l => { const p = l.group.localToWorld(l.local.clone()), pl = new THREE.PointLight(l.color ?? '#ffb35e', 0, 12, 1.5); pl.position.copy(p); scene.add(pl); return { pl, power: l.power ?? 1, ph: rnd() * 10, on: 0 }; });

  /* ---------------- Ciel : atmosphère et nuages, nuit étoilée, lune ---------------- */
  const sky = new Sky(); sky.scale.setScalar(3000); scene.add(sky);
  const SU = sky.material.uniforms;
  // le ciel physique est très lumineux : on l'atténue pour garder une scène bien exposée sans brume de halo
  SU.skyGain = { value: 0.32 };
  sky.material.fragmentShader = 'uniform float skyGain;' + String.fromCharCode(10) + sky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyGain, 1.0 );');
  SU.turbidity.value = 4; SU.rayleigh.value = 1.6; SU.mieCoefficient.value = 0.006; SU.mieDirectionalG.value = 0.82;
  if (SU.cloudCoverage) { SU.cloudCoverage.value = 0.42; SU.cloudDensity.value = 0.5; SU.cloudScale.value = 0.00022; SU.cloudSpeed.value = 0.00003; }
  const nightU = { k: { value: 0 }, time: uTime, moonDir: { value: new THREE.Vector3() } };
  const night = new THREE.Mesh(new THREE.SphereGeometry(2800, 48, 24), new THREE.ShaderMaterial({
    uniforms: nightU, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float k, time; uniform vec3 moonDir; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vD); float up = max(d.y, 0.0);
        vec3 c = mix(vec3(0.06, 0.08, 0.2), vec3(0.008, 0.012, 0.04), pow(up, 0.5));
        float s = h(floor(d * 300.0)); float st = smoothstep(0.996, 1.0, s) * (0.6 + 0.4 * sin(time * (2.0 + s * 5.0) + s * 40.0));
        st += smoothstep(0.9985, 1.0, h(floor(d * 900.0))) * 0.5;
        float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, -0.74))) * 4.0, 2.0)); float neb = h(floor(d * 60.0)) * 0.5 + h(floor(d * 140.0)) * 0.5;
        c += vec3(0.25, 0.22, 0.35) * band * neb * 0.35 * up;
        c += vec3(1.0, 0.97, 0.9) * st * smoothstep(0.0, 0.15, d.y) * 1.6;
        float m = max(dot(d, normalize(moonDir)), 0.0); c += vec3(0.5, 0.55, 0.8) * (pow(m, 30.0) * 0.4 + pow(m, 6.0) * 0.08);
        gl_FragColor = vec4(c, k);
        #include <colorspace_fragment>
      }`,
  }));
  night.renderOrder = 1; scene.add(night);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.moon().map, color: new THREE.Color(2.6, 2.5, 2.2), transparent: true, fog: false, depthWrite: false }));
  moon.scale.setScalar(110); moon.renderOrder = 2; scene.add(moon);

  /* ---------------- Yeux de loups dans la forêt ---------------- */
  const wolfEyes = [];
  for (let k = 0; k < 10; k++) {
    let a; do a = rnd() * TAU; while (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3);
    const r = between(30, 36), g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.8, 0.6), transparent: true, opacity: 0, fog: false });
    for (const s of [1, -1]) put(g, new THREE.SphereGeometry(0.05, 10, 8), m, s * 0.12, 0, 0, 0, 0, 0, 1.4, 0.8, 0.4);
    g.position.set(Math.sin(a) * r, heightAt(Math.sin(a) * r, Math.cos(a) * r) + between(0.55, 1), Math.cos(a) * r);
    g.lookAt(0, g.position.y, 0); scene.add(g);
    wolfEyes.push({ m, ph: rnd() * 40, per: between(10, 19) });
  }

  /* ---------------- Particules (une seule nuée) ---------------- */
  const MAXP = 3000;
  const atlas = paint('atlas', 512, (x, w) => {
    const c = w / 4, cell = (k, fn) => { x.save(); x.translate((k % 4) * c, Math.floor(k / 4) * c); fn(c); x.restore(); };
    cell(0, n => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    cell(1, n => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(n / 2, n * 0.12); x.bezierCurveTo(n * 0.75, n * 0.45, n * 0.8, n * 0.62, n / 2, n * 0.85); x.bezierCurveTo(n * 0.2, n * 0.62, n * 0.25, n * 0.45, n / 2, n * 0.12); x.fill(); });
    cell(2, n => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(n / 2, n * 0.82); x.bezierCurveTo(n * 0.05, n * 0.5, n * 0.2, n * 0.1, n / 2, n * 0.32); x.bezierCurveTo(n * 0.8, n * 0.1, n * 0.95, n * 0.5, n / 2, n * 0.82); x.fill(); });
    cell(3, n => { x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, r = k % 2 ? n * 0.18 : n * 0.44; x.lineTo(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r); } x.fill(); });
    cell(4, n => { for (let k = 0; k < 9; k++) { const X = n * between(0.28, 0.72), Y = n * between(0.3, 0.7), r = n * between(0.14, 0.26), g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } });
    cell(5, n => { x.fillStyle = '#fff'; x.font = `bold ${n * 0.75}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', n / 2, n / 2); });
    cell(6, n => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(n / 2, n / 2, n * 0.4, n * 0.2, 0.6, 0, TAU); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(n * 0.2, n * 0.7); x.lineTo(n * 0.8, n * 0.3); x.stroke(); });
    cell(7, n => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.12, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = '#fff'; x.fillRect(n / 2 - 1.5, n * 0.12, 3, n * 0.76); x.fillRect(n * 0.12, n / 2 - 1.5, n * 0.76, 3); });
  }, { repeat: false }).map;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP), pCol = new Float32Array(MAXP * 3), pCell = new Float32Array(MAXP);
  for (const [k, a, n] of [['position', pPos, 3], ['aSize', pSize, 1], ['aAlpha', pAlpha, 1], ['aColor', pCol, 3], ['aCell', pCell, 1]]) pGeo.setAttribute(k, new THREE.BufferAttribute(a, n));
  const pU = { map: { value: atlas }, scale: { value: 400 } };
  const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize, aAlpha, aCell; attribute vec3 aColor; uniform float scale; varying float vA, vCell; varying vec3 vC;
      void main(){ vA = aAlpha; vC = aColor; vCell = aCell; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA, vCell; varying vec3 vC;
      void main(){ vec2 uv = vec2((mod(vCell, 4.0) + gl_PointCoord.x) / 4.0, 1.0 - (floor(vCell / 4.0) + gl_PointCoord.y) / 2.0); vec4 t = texture2D(map, uv);
        gl_FragColor = vec4(vC * t.rgb, t.a * vA); if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
      }`,
  }));
  points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
  const parts = [], CELL = { dot: 0, drop: 1, heart: 2, star: 3, puff: 4, note: 5, leaf: 6, spark: 7 };
  function emit(cell, pos, o = {}) {
    if (parts.length >= MAXP) return;
    parts.push({ cell: CELL[cell], x: pos.x, y: pos.y, z: pos.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, g: o.g ?? 0, life: o.life ?? 1, max: o.life ?? 1, size: o.size ?? 0.2, grow: o.grow ?? 0, col: new THREE.Color(o.color ?? '#ffffff'), alpha: o.alpha ?? 1, wob: o.wob ?? 0, ph: rnd() * TAU, drag: o.drag ?? 0, fadeIn: o.fadeIn ?? 0, hdr: o.hdr ?? 1 });
  }
  function spawn(kind, p, o = {}) {
    const r = (a = 1) => (Math.random() - 0.5) * a;
    if (kind === 'drop') emit('drop', p, { vx: o.vx * 0.6 + r(0.3), vy: 1.2, vz: r(0.3), g: 6, life: 0.7, size: 0.05, color: '#7fd0ff' });
    if (kind === 'puff') emit('puff', p, { vx: r(0.4), vy: 1.1, vz: r(0.4), life: 0.9, size: 0.2, grow: 0.6, color: o.grey ? '#dddddd' : '#ffffff', alpha: 0.8 });
    if (kind === 'heart') emit('heart', p, { vx: r(0.8), vy: 1.2 + (o.k ?? 0) * 0.3, vz: 0.6 + r(0.4), life: 1.4, size: 0.15, color: '#ff4f7a', drag: 0.8 });
    if (kind === 'star') emit('star', p, { vx: Math.cos(o.a) * 0.9, vy: 0.3, vz: Math.sin(o.a) * 0.9, life: 0.6, size: 0.1, color: '#ffe14a' });
    if (kind === 'note') emit('note', p, { vx: r(0.8), vy: 0.9, vz: r(0.8), life: 1.1, size: 0.18, color: o.laugh ? '#ffd23f' : '#ff8acb' });
    if (kind === 'dust') for (let k = 0; k < 14; k++) emit('puff', { x: p.x + r(0.8), y: 0.15, z: p.z + r(0.8) }, { vx: r(2), vy: 0.4, vz: r(2), life: 0.9, size: 0.3, grow: 0.8, color: '#b8a080', alpha: 0.6, drag: 2 });
    if (kind === 'splash') {
      const c = { tomate: '#c8160a', oeuf: '#ffd84a', chou: '#6cb24a', poisson: '#a8e0ff', chaussure: '#ffe14a', rose: '#ff4f7a', fleche: '#ffffff' }[o.item];
      for (let k = 0; k < 24; k++) emit(o.item === 'rose' ? 'heart' : o.item === 'chou' ? 'leaf' : o.item === 'chaussure' ? 'star' : 'drop', p, { vx: r(3), vy: Math.random() * 2.5, vz: r(3), g: o.item === 'rose' ? -0.5 : 7, life: 0.9, size: o.item === 'rose' ? 0.12 : 0.07, color: c });
    }
    if (kind === 'poof') for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; emit('puff', { x: p.x, y: 0.3 + Math.random() * 1.2, z: p.z }, { vx: Math.cos(a) * 1.6, vy: 0.4 + Math.random(), vz: Math.sin(a) * 1.6, life: 1.6, size: 0.45, grow: 1.2, color: o.color ?? '#e8e4ff', alpha: 0.8, drag: 1.5 }); }
    if (kind === 'sparkle') for (let k = 0; k < 50; k++) emit('spark', { x: p.x + r(1), y: 0.2 + Math.random() * 2, z: p.z + r(1) }, { vy: 0.6 + Math.random(), life: 1.2 + Math.random(), size: 0.14, color: o.color ?? '#bfe0ff', hdr: 3 });
    if (kind === 'confetti') for (let k = 0; k < 160; k++) emit('leaf', { x: p.x + r(10), y: 4 + Math.random() * 3, z: p.z + r(10) }, { vx: r(1), vy: -0.5, g: 0.6, wob: 2, life: 4, size: 0.12, color: ['#e8543c', '#f2c230', '#3d8bff', '#2fb36a', '#a46bff'][k % 5] });
  }

  /* ---------------- Personnages ---------------- */
  const chars = new Map(), charGroup = new THREE.Group(); scene.add(charGroup);
  const flights = [], delayed = [];
  function syncPlayers(players) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.name);
      const key = `${p.look?.join(',')}|${p.color}`, cur = chars.get(p.name);
      if (cur?.key === key) continue;
      const ch = makeCharacter(p.look ?? LG.randomLook(), p.color);
      if (cur) { ch.root.position.copy(cur.ch.root.position); ch.root.rotation.y = cur.ch.root.rotation.y; charGroup.remove(cur.ch.root); }
      charGroup.add(ch.root);
      chars.set(p.name, { ch, key, state: {} });
    }
    for (const [n, c] of chars) if (!seen.has(n)) { charGroup.remove(c.ch.root); chars.delete(n); }
  }
  const place = (name, s) => { const c = chars.get(name); if (c) c.state = s; };
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const emote = (name, e, to, t) => { const c = chars.get(name); if (c && !c.ch.ghost) play(c.ch, e, t, to); };
  const talk = (name, t, sec) => { const c = chars.get(name); if (c) c.ch.talkUntil = t + sec; };
  const poof = (name, color) => { const c = chars.get(name); if (c) { spawn('poof', c.ch.root.position, { color }); spawn('sparkle', c.ch.root.position); } };
  // Objet lancé : de la main du lanceur (ou de devant ma caméra si c'est moi), en cloche jusqu'à la tête de la cible.
  function toss(from, to, item, t, onHit, fromEye = false) {
    const a = chars.get(from), b = chars.get(to);
    if (!b || (!a && !fromEye)) return;
    if (!fromEye) play(a.ch, 'lancer', t, to);
    delayed.push({ at: t + (fromEye ? 0.05 : 0.24), go: () => {
      const start = fromEye ? camera.localToWorld(new THREE.Vector3(0.25, -0.25, -0.5)) : a.ch.arms[1].a.localToWorld(new THREE.Vector3(0, -0.36, 0));
      const mesh = makeItem(item); mesh.position.copy(start); scene.add(mesh);
      const d = start.distanceTo(b.ch.root.position);
      flights.push({ mesh, start, to: b, item, dur: 0.42 + d * 0.035, h: 0.5 + d * 0.1, spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 6), onHit, began: null });
    } });
  }
  const ray = new THREE.Raycaster();
  function pick(cx, cy) {
    ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
    const hits = [...chars.entries()].filter(([, c]) => c.ch.root.visible).map(([n, c]) => ({ n, o: c.ch.hit }));
    const res = ray.intersectObjects(hits.map(h => h.o), false)[0];
    return res && res.distance < 40 ? hits.find(h => h.o === res.object).n : null;
  }
  function mark(name, kind) {
    const c = chars.get(name); if (c) c.mark = kind;
    for (const [, x] of chars) { x.ch.ring.material.color.set(x.mark === 'target' ? '#ff3b30' : x.mark === 'hover' ? '#ffffff' : x.key.split('|')[1]); x.ch.ring.material.opacity = x.mark ? 0.95 : 0.5; }
  }
  const tmp = new THREE.Vector3();
  const headAt = (name, out = new THREE.Vector3()) => { const c = chars.get(name); return c ? c.ch.head.localToWorld(out.set(0, 0.85, 0)) : null; };
  const project = v => { tmp.copy(v).project(camera); return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, ok: tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 }; };

  /* ---------------- Tombes des morts de la partie ---------------- */
  let graveSig = '';
  const freeSlots = graveSlots.filter((_, i) => i >= 6), dynGraves = [];
  function setGraves(list) {
    const sig = list.map(g => g.name).join('|');
    if (sig === graveSig) return;
    graveSig = sig;
    for (const g of dynGraves) g.parent.remove(g);
    dynGraves.length = 0;
    list.slice(0, freeSlots.length).forEach((d, i) => {
      const slot = freeSlots[i], g = new THREE.Group();
      slot.add(g);
      const add = (...a) => { const m = put(g, ...a); m.castShadow = m.receiveShadow = true; return m; };
      add(unitBox(0.12, 0.03), M.stone(), 0, 0.42, -0.25, 0, 0, 0, 0.56, 0.85, 0.14);
      add(new THREE.PlaneGeometry(0.5, 0.5), std(`tombFace:${d.name}:${d.sub}`, { map: TX.tomb(d.name, d.sub).map, roughness: 0.9 }), 0, 0.5, -0.176);
      add(unitBox(0.25, 0.1), std('freshDirt', { map: TX.dirt().map, color: '#6a5038', roughness: 1 }), 0, 0.07, 0.3, 0, 0, 0, 0.62, 0.22, 1.25);
      for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.04, 6, 4), M.plain(['#ff4a5a', '#ffd23f', '#ffffff'][k % 3]), between(-0.2, 0.2), 0.2, 0.1 + k * 0.15);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), M.plain('#f2ead8'), 0.22, 0.24, -0.1); add(new THREE.SphereGeometry(0.015, 6, 4), FLAME, 0.22, 0.32, -0.1, 0, 0, 0, 1, 1.8, 1);
      dynGraves.push(g);
    });
  }

  /* ---------------- Jour et nuit ---------------- */
  // k : 0 plein jour, 0.45 soleil couchant, 0.62 crépuscule, 1 nuit noire.
  const PAL = [
    { k: 0, el: 48, light: '#fff3e0', li: 3.4, hs: '#cfe4ff', hg: '#6a5a3c', hi: 0.85, exp: 1.0, fog: '#b8cad6', fd: 0.0032, lamp: 0, bloom: 0.15, sat: 1.1 },
    { k: 0.45, el: 7, light: '#ffb878', li: 3.0, hs: '#ffd2b0', hg: '#5a4050', hi: 0.65, exp: 1.05, fog: '#d8a080', fd: 0.0045, lamp: 0.3, bloom: 0.3, sat: 1.15 },
    { k: 0.62, el: -1.5, light: '#ff8a5a', li: 1.1, hs: '#8a6aa8', hg: '#2a2030', hi: 0.5, exp: 1.25, fog: '#4a3a5a', fd: 0.007, lamp: 0.8, bloom: 0.5, sat: 1.05 },
    { k: 1, el: -14, light: '#9fb2ff', li: 0.8, hs: '#3a4a90', hg: '#141420', hi: 0.42, exp: 1.5, fog: '#0c1228', fd: 0.01, lamp: 1, bloom: 0.75, sat: 0.95 },
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const lerpC = (a, b, f, out) => out.copy(ca.set(a)).lerp(cb.set(b), f);
  const env = { k: 0.3, target: 0.3, speed: 0.25 };
  const nightF = () => smooth(0.55, 0.95, env.k);
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(-0.55, 0.6, 0.55).normalize();
  let composer, bloom, grade;
  function applyTime() {
    const k = env.k;
    let i = 0; while (i < PAL.length - 2 && k > PAL[i + 1].k) i++;
    const A = PAL[i], B = PAL[i + 1], f = Math.max(0, Math.min(1, (k - A.k) / (B.k - A.k))), L = key => A[key] + (B[key] - A[key]) * f;
    const el = (L('el') * Math.PI) / 180, az = (35 * Math.PI) / 180;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    SU.sunPosition.value.copy(sunDir);
    nightU.k.value = nightF(); nightU.moonDir.value.copy(moonDir);
    const lightDir = sunDir.clone().lerp(moonDir, smooth(0.55, 0.8, k));
    if (lightDir.y < 0.08) lightDir.y = 0.08;
    sun.userData.dir = lightDir.normalize();
    lerpC(A.light, B.light, f, sun.color); sun.intensity = L('li');
    lerpC(A.hs, B.hs, f, hemi.color); lerpC(A.hg, B.hg, f, hemi.groundColor); hemi.intensity = L('hi');
    lerpC(A.fog, B.fog, f, scene.fog.color); scene.fog.density = L('fd');
    renderer.toneMappingExposure = L('exp');
    moon.position.copy(moonDir).multiplyScalar(2500); moon.material.opacity = smooth(0.6, 0.95, k);
    for (const l of lampLights) l.on = L('lamp') * 7 * l.power;
    for (const g of GLOW) g.m.emissiveIntensity = g.curve(k);
    if (bloom) bloom.strength = L('bloom');
    if (grade) grade.uniforms.sat.value = L('sat');
  }

  /* ---------------- Rendu : occlusion ambiante, halo, étalonnage, anticrénelage ---------------- */
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 16 });
  gtao.blendIntensity = 0.7;
  composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 1.6);
  composer.addPass(bloom);
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, sat: { value: 1.08 }, vig: { value: 0.32 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, sat, vig; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb = mix(vec3(l), c.rgb, sat);
        c.rgb *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.94), smoothstep(0.0, 1.2, l));
        float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vig * smoothstep(0.32, 0.85, d);
        float g = fract(sin(dot(vUv * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453); c.rgb *= 1.0 + (g - 0.5) * 0.03;
        gl_FragColor = c; }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass());
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    pU.scale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  // Caméra : à la première personne (œil, cap, inclinaison), ou vitrine autour d'un point (accueil).
  const cam = { mode: 'show', yaw: 0, pitch: 0, eye: new THREE.Vector3(0, 1.5, 6), target: new THREE.Vector3(0, 1, 0), want: new THREE.Vector3(0, 1, 0), dist: 6, wantDist: 6, showYaw: 0, showPitch: 0.15, fov: 72 };
  const camPos = new THREE.Vector3(0, 1.6, 10);

  let smokeAt = 0, leafAt = 0, flyAt = 0, moteAt = 0;
  function update(dt, t) {
    uTime.value = t;
    env.k += Math.sign(env.target - env.k) * Math.min(Math.abs(env.target - env.k), dt * env.speed);
    applyTime();
    const n = nightF();
    for (const [, c] of chars) {
      const s = c.state, ch = c.ch, r = ch.root;
      r.visible = s.visible !== false;
      if (!r.visible) continue;
      setGhost(ch, !!s.ghost);
      if (s.x !== undefined) { r.position.x = s.x; r.position.z = s.z; }
      let yaw = s.ry ?? r.rotation.y;
      const target = ch.emote?.target && chars.get(ch.emote.target);
      if (target) yaw = yawTo(r.position, target.ch.root.position);
      let dy = yaw - r.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.rotation.y += dy * (1 - Math.exp(-dt * 12));
      animate(ch, dt, t, s, spawn);
    }
    for (const d of delayed.filter(d => t >= d.at)) { delayed.splice(delayed.indexOf(d), 1); d.go(); }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.began ??= t;
      const u = Math.min(1, (t - f.began) / f.dur), end = f.to.ch.head.localToWorld(tmp.set(0, 0.3, 0.15));
      f.mesh.position.lerpVectors(f.start, end, u); f.mesh.position.y += f.h * 4 * u * (1 - u);
      if (f.item === 'fleche') f.mesh.lookAt(end); else { f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt; }
      if (u >= 1) { scene.remove(f.mesh); hitBy(f.to.ch, f.item, t); splat(f.to.ch, f.item); spawn('splash', end, { item: f.item }); f.onHit?.(f.item); flights.splice(i, 1); }
    }
    for (const c of clothes) { const p = c.m.geometry.attributes.position, b = c.base; for (let i = 0; i < p.count; i++) { const y = -b[i * 3 + 1], x = b[i * 3]; p.setZ(i, Math.sin(t * 2.2 + c.ph + x * 3 + y * 2) * 0.06 * y + Math.sin(t * 0.9 + c.ph) * 0.12 * y); } p.needsUpdate = true; c.m.geometry.computeVertexNormals(); }
    for (const l of lampLights) l.pl.intensity = l.on * (0.88 + Math.sin(t * 9 + l.ph) * 0.05 + Math.sin(t * 23 + l.ph * 3) * 0.04);
    if (t > smokeAt) { smokeAt = t + 0.12; for (const c of chimneys) emit('puff', c.pos, { vx: 0.3 + rnd() * 0.2, vy: 0.7, vz: (rnd() - 0.5) * 0.2, life: 5, size: 0.5, grow: 1, color: n > 0.5 ? '#2c3048' : '#d8d4d0', alpha: 0.35 - n * 0.15, drag: 0.1 }); }
    if (t > leafAt) { leafAt = t + 0.15; const h = heroTops[Math.floor(rnd() * heroTops.length)]; emit('leaf', { x: h.x + (rnd() - 0.5) * 5, y: h.top - rnd() * 2, z: h.z + (rnd() - 0.5) * 5 }, { vx: (rnd() - 0.5) * 0.6, vy: -0.35, g: 0.12, wob: 1.8, life: 9, size: 0.1, color: ['#e8892e', '#d8602a', '#f2b33a', '#c8392e'][Math.floor(rnd() * 4)], drag: 0.3 }); }
    if (n < 0.4 && t > moteAt) { moteAt = t + 0.05; emit('dot', { x: camera.position.x + (rnd() - 0.5) * 10, y: 0.5 + rnd() * 3, z: camera.position.z + (rnd() - 0.5) * 10 }, { vx: (rnd() - 0.5) * 0.1, vy: 0.03, vz: (rnd() - 0.5) * 0.1, wob: 0.2, life: 6, size: 0.025, color: '#fff4d8', fadeIn: 2, alpha: 0.6 }); }
    if (n > 0.3 && t > flyAt) { flyAt = t + 0.06 / n; const a = rnd() * TAU, r = 8 + rnd() * 26; emit('dot', { x: Math.sin(a) * r, y: 0.3 + rnd() * 2.2, z: Math.cos(a) * r }, { vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.2, vz: (rnd() - 0.5) * 0.4, wob: 0.8, life: 6, size: 0.09, color: '#d8ff7a', fadeIn: 1, hdr: 4 }); }
    let w = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy -= p.g * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.x += (p.vx + (p.wob ? Math.sin(t * 2 + p.ph) * p.wob * 0.3 : 0)) * dt; p.y += p.vy * dt; p.z += (p.vz + (p.wob ? Math.cos(t * 1.7 + p.ph) * p.wob * 0.3 : 0)) * dt;
      if (p.y < 0.05 && p.g > 0) { p.y = 0.05; p.vx = p.vz = p.vy = 0; }
      const age = p.max - p.life, a = Math.min(1, p.life / Math.min(0.5, p.max * 0.4)) * (p.fadeIn ? Math.min(1, age / p.fadeIn) : 1);
      pPos[w * 3] = p.x; pPos[w * 3 + 1] = p.y; pPos[w * 3 + 2] = p.z;
      pSize[w] = p.size * (1 + p.grow * age); pAlpha[w] = a * p.alpha * (p.cell === 0 && p.hdr > 1 ? 0.5 + 0.5 * Math.sin(t * 6 + p.ph) : 1);
      pCol[w * 3] = p.col.r * p.hdr; pCol[w * 3 + 1] = p.col.g * p.hdr; pCol[w * 3 + 2] = p.col.b * p.hdr; pCell[w] = p.cell;
      w++;
    }
    pGeo.setDrawRange(0, w);
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor', 'aCell']) pGeo.attributes[k].needsUpdate = true;
    for (const e of wolfEyes) { const c = (t + e.ph) % e.per, on = smooth(0, 0.6, c) * (1 - smooth(3.2, 3.8, c)), blink = Math.sin((t + e.ph) * 3) > 0.97 ? 0 : 1; e.m.opacity = on * blink * smooth(0.8, 1, env.k); }
    if (SU.time) SU.time.value = t;
    if (cam.mode === 'fp') {
      camPos.lerp(cam.eye, 1 - Math.exp(-dt * 14));
      camera.position.copy(camPos);
      camera.rotation.set(cam.pitch, cam.yaw, 0);
    } else {
      const f = 1 - Math.exp(-dt * 3);
      cam.target.lerp(cam.want, f); cam.dist += (cam.wantDist - cam.dist) * f;
      const want = new THREE.Vector3(cam.target.x + Math.sin(cam.showYaw) * Math.cos(cam.showPitch) * cam.dist, cam.target.y + Math.sin(cam.showPitch) * cam.dist, cam.target.z + Math.cos(cam.showYaw) * Math.cos(cam.showPitch) * cam.dist);
      camPos.lerp(want, 1 - Math.exp(-dt * 8));
      camera.position.copy(camPos); camera.lookAt(cam.target);
      cam.yaw = Math.atan2(camera.position.x - cam.target.x, camera.position.z - cam.target.z);
    }
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov += (cam.fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    sun.target.position.set(camera.position.x - Math.sin(cam.yaw) * 10, 0, camera.position.z - Math.cos(cam.yaw) * 10);
    sun.position.copy(sun.userData.dir).multiplyScalar(90).add(sun.target.position);
    grade.uniforms.time.value = t % 100;
    composer.render();
  }

  resize();
  applyTime();
  return {
    renderer, scene, camera, cam, env, chars, resize, update, syncPlayers, place, emote, talk, poof, toss, pick, mark, headAt, project, spawn, heightAt, setGraves,
    setTime(k, speed = 0.25) { env.target = k; env.speed = speed; },
  };
}
