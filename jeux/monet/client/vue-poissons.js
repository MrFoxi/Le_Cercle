// LES EAUX DE MONET — le corps peint des poissons : une silhouette propre à chaque espèce, sa robe, sa nage. La même robe sert à
// l'illustration du carnet, peinte à la main sur une page.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { UNI, couleur, melange } from './peinture.js';
import { ESPECES } from './reglages.js';

// silhouette : hauteur et épaisseur (en part de la longueur), rondeur du dos, museau
export const FORMES = {
  brochet: { H: 0.135, W: 0.08, a: 0.86, b: 0.62, museau: 0.8, dos: 0.78, queue: 0.11 },
  perche: { H: 0.3, W: 0.13, a: 0.56, b: 0.8, museau: 0.35, dos: 0.36, queue: 0.14 },
  sandre: { H: 0.2, W: 0.11, a: 0.72, b: 0.72, museau: 0.6, dos: 0.4, queue: 0.14 },
  chevesne: { H: 0.22, W: 0.14, a: 0.68, b: 0.68, museau: 0.3, dos: 0.52, queue: 0.14 },
  gardon: { H: 0.3, W: 0.11, a: 0.6, b: 0.76, museau: 0.3, dos: 0.48, queue: 0.15 },
  rotengle: { H: 0.32, W: 0.1, a: 0.58, b: 0.8, museau: 0.2, dos: 0.6, queue: 0.15 },
};
const c = couleur;
// la robe : u de la tête (0) à la queue (1), v du ventre (0) au dos (1)
export function robe(id, u, v, g = 0.5) {
  const ventre = (a, b, k = 0.5) => melange(c(a), c(b), Math.min(1, Math.max(0, (v - 0.22) / k)));
  switch (id) {
    case 'brochet': { let k = ventre('#e4e0c0', '#55703c', 0.45); const t = Math.sin(u * 46 + Math.sin(v * 13) * 2) * Math.sin(v * 24 + u * 20); if (v > 0.25 && t > 0.3) k = melange(k, c('#d8d48c'), 0.8); return v > 0.8 ? melange(k, c('#2f4a30'), 0.6) : k; }
    case 'perche': { let k = ventre('#f0ecd0', '#7f9440', 0.5); if (v > 0.32 && Math.sin(u * 36) > 0.32 && u > 0.14 && u < 0.84) k = melange(k, c('#2c3a28'), 0.72); return k; }
    case 'sandre': { let k = ventre('#ece8e0', '#7c8a84', 0.5); if (v > 0.42 && Math.sin(u * 28 + g) > 0.45) k = melange(k, c('#4a5450'), 0.6); return k; }
    case 'chevesne': { const e = Math.sin(u * 62) * Math.sin(v * 34) > 0.25 ? 0.82 : 1, k = ventre('#f0e6c8', '#6f6a3c', 0.55); return melange(k, c('#c49a50'), 0.3 * (1 - Math.abs(v - 0.5))).map(x => x * e); }
    case 'gardon': { const e = Math.sin(u * 70) * Math.sin(v * 38) > 0.3 ? 0.88 : 1; return ventre('#f4f2ea', '#5f7f88', 0.6).map(x => x * e); }
    default: { const e = Math.sin(u * 64) * Math.sin(v * 36) > 0.28 ? 0.86 : 1; return ventre('#f4e6a8', '#a08838', 0.6).map(x => x * e); }
  }
}
export const NAGEOIRE = { brochet: '#a8703c', perche: '#e0562c', sandre: '#8a8e82', chevesne: '#d87a34', gardon: '#c8603c', rotengle: '#e03a2c' };
const YEUX = { brochet: '#e8c850', perche: '#e8a838', sandre: '#c8d4d0', chevesne: '#d8c070', gardon: '#d03828', rotengle: '#d8a030' };
// le contour du dos et du ventre à la position u
export function profil(F, u) { const t = Math.pow(Math.sin(Math.PI * Math.pow(Math.max(0.0001, u), F.a)), F.b), base = Math.max(t, 0) * (1 - u * 0.25) + (u > 0.8 ? ((u - 0.8) / 0.2) * F.queue * 0.7 : 0.015); return base; }

function corps(id) {
  const F = FORMES[id], R = 44, S = 14, P = [], C = [], U = [], I = [];
  for (let i = 0; i <= R; i++) {
    const u = i / R, h = profil(F, u) * F.H * 0.5, w = profil(F, u) * F.W * 0.5, dec = (u < 0.3 ? (0.3 - u) * F.museau * -0.08 : 0);
    for (let j = 0; j <= S; j++) { const a = (j / S) * Math.PI * 2, s = Math.sin(a), co = Math.cos(a), v = 0.5 + s * 0.5, hh = s > 0 ? h * (0.72 + F.dos * 0.5) : h * (1.2 - F.dos * 0.4); P.push(co * w, s * hh + dec, 0.5 - u); C.push(...robe(id, u, v, j)); U.push(u); }
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
// une nageoire : un voile plat dont les rayons sont peints
function voile(id, pts, u0, u1) {
  const P = [], Co = [], U = [], k = c(NAGEOIRE[id]); pts.forEach(([y, z], i) => { P.push(0, y, z); Co.push(...melange(k, c('#f0e0b8'), i % 2 ? 0.35 : 0)); U.push(u0 + (u1 - u0) * (i / (pts.length - 1))); });
  const I = []; for (let i = 1; i + 1 < pts.length; i++) I.push(0, i, i + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Co, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); g.setIndex(I); g.computeVertexNormals();
  return g.toNonIndexed();
}
function modele(id) {
  const F = FORMES[id], H = F.H * 0.5, g = [corps(id).toNonIndexed()], dos = id === 'brochet' ? [0.74, 0.86] : [0.34, 0.68], ad = u => profil(F, u) * H * (0.72 + F.dos * 0.5);
  const z = u => 0.5 - u;
  g.push(voile(id, [[ad(dos[0]) * 0.8, z(dos[0])], [ad(dos[0]) + H * 0.75, z(dos[0] + 0.03)], [ad(dos[1]) + H * 0.55, z(dos[1] - 0.05)], [ad(dos[1]) * 0.8, z(dos[1])]], dos[0], dos[1]));
  if (id === 'perche' || id === 'sandre') g.push(voile(id, [[ad(0.7) * 0.8, z(0.7)], [ad(0.72) + H * 0.5, z(0.72)], [ad(0.86) + H * 0.3, z(0.84)], [ad(0.86) * 0.6, z(0.86)]], 0.7, 0.86));
  g.push(voile(id, [[0, z(0.94)], [F.queue * 0.75, z(1.1)], [F.queue * 0.18, z(1.03)], [-F.queue * 0.18, z(1.03)], [-F.queue * 0.75, z(1.1)]], 0.94, 1.1));
  for (const [u, l] of [[0.56, 0.1], [0.72, 0.08]]) g.push(voile(id, [[-ad(u) * 1.1, z(u)], [-ad(u) * 1.1 - l * 0.7, z(u + 0.05)], [-ad(u) * 1.1 - l * 0.4, z(u + 0.1)], [-ad(u) * 1.05, z(u + 0.08)]], u, u + 0.1));
  for (const s of [-1, 1]) { const o = new THREE.SphereGeometry(F.H * 0.1, 8, 6).translate(s * profil(F, 0.13) * F.W * 0.42, profil(F, 0.13) * H * 0.42, z(0.13)).toNonIndexed(), n = o.attributes.position.count, co = new Float32Array(n * 3), uu = new Float32Array(n).fill(0.13), yc = c(YEUX[id]); for (let i = 0; i < n; i++) { const dz = o.attributes.position.getZ(i) - z(0.13), dx = Math.abs(o.attributes.position.getX(i)) - profil(F, 0.13) * F.W * 0.42, cen = Math.hypot(dz, o.attributes.position.getY(i) - profil(F, 0.13) * H * 0.42) < F.H * 0.05 && dx * s >= -1e-3; co.set(cen ? [0.05, 0.05, 0.07] : yc, i * 3); } o.setAttribute('color', new THREE.BufferAttribute(co, 3)); o.setAttribute('aU', new THREE.BufferAttribute(uu, 1)); g.push(o); }
  for (const x of g) { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color', 'aU'].includes(k)) x.deleteAttribute(k); x.morphAttributes = {}; }
  return mergeGeometries(g);
}
const GEO = Object.fromEntries(ESPECES.map(e => [e.id, modele(e.id)]));

const matiere = () => new THREE.ShaderMaterial({
  vertexColors: true, side: THREE.DoubleSide, uniforms: { ...UNI, uNage: { value: 0 }, uAmp: { value: 0.07 }, uVoile: { value: 1 }, uAir: { value: 0 } },
  vertexShader: /* glsl */ `attribute float aU; uniform float uNage, uAmp; varying vec3 vC, vN, vW; varying vec2 vP;
    void main() { vec3 p = position; float t = max(aU, .05); p.x += sin(aU * 6. - uNage) * uAmp * t * t * 1.6; vC = color; vN = mat3(modelMatrix) * normal; vP = vec2(aU, position.y); vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `uniform vec3 uDirSoleil, uSoleil, uOmbre, uBrume; uniform float uForce, uDensite, uVoile, uAir; varying vec3 vC, vN, vW; varying vec2 vP;
    float h1(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() { vec2 g = vec2(vP.x * 34., vP.y * 90.), ci = floor(vec2(g.x + mod(floor(g.y), 2.) * .5, g.y)); float d = h1(ci); vec3 N = normalize(vN); float e = abs(dot(N, uDirSoleil)) * .5 + .5; vec3 c = vC * mix(uOmbre * .9, uSoleil * 1.1, smoothstep(.3, .78, e)) * uForce * (.86 + d * .28);
      if (uAir < .5) { float pr = clamp(-vW.y / 3.2, 0., 1.); c = mix(c, vec3(.1, .27, .3) * uForce, pr * .72 + .14); c = mix(vec3(.17, .34, .34) * uForce, c, uVoile); }
      gl_FragColor = vec4(mix(c, uBrume, uAir > .5 ? 0. : 1. - exp(-length(vW - cameraPosition) * uDensite)), 1.); }`,
});
export function creerVuePoisson(id) { const m = new THREE.Mesh(GEO[id], matiere()); m.layers.set(2); m.frustumCulled = false; return m; }

// l'illustration du carnet : la silhouette peinte à la main, touche après touche, sur le papier
export function illustrer(toile, id, esquisse = false) {
  const x = toile.getContext('2d'), W = toile.width, Ha = toile.height, F = FORMES[id], L = W * 0.76, ox = W * 0.11, oy = Ha * 0.52, H = F.H * L * 0.5; let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  x.clearRect(0, 0, W, Ha); const cs = a => `rgb(${a.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
  const coup = (a, b, e, c, al = 0.85) => { x.strokeStyle = c; x.globalAlpha = al; x.lineWidth = e; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo((a[0] + b[0]) / 2 + (r() - 0.5) * e, (a[1] + b[1]) / 2 + (r() - 0.5) * e, b[0], b[1]); x.stroke(); };
  const nag = cs(c(NAGEOIRE[id]));
  if (!esquisse) {
    for (let i = 0; i < 26; i++) { const t = i / 25, u = 0.96 + t * 0.14, e = (t - 0.5) * 2; coup([ox + L * 0.95, oy + e * H * 0.2], [ox + L * u, oy + e * F.queue * L * 0.42], 2.4, nag, 0.75); }
    const dos = id === 'brochet' ? [0.74, 0.86] : [0.34, 0.66]; for (let i = 0; i < 24; i++) { const u = dos[0] + (dos[1] - dos[0]) * (i / 23); coup([ox + L * u, oy - profil(F, u) * H * 0.9], [ox + L * (u + 0.015), oy - profil(F, u) * H * 0.9 - H * (0.55 - (i / 23) * 0.2)], 2.2, nag, 0.8); }
    for (const u of [0.56, 0.72]) for (let i = 0; i < 9; i++) coup([ox + L * (u + i * 0.008), oy + profil(F, u) * H * 0.95], [ox + L * (u + 0.03 + i * 0.009), oy + profil(F, u) * H * 1.5], 2, nag, 0.8);
    for (let i = 0; i < 1500; i++) { const u = r(), e = r() * 2 - 1, hh = profil(F, u) * H * (e > 0 ? 0.72 + F.dos * 0.5 : 1.2 - F.dos * 0.4), v = 0.5 - e * 0.5; const k = robe(id, u, 1 - v), j = (r() - 0.5) * 0.09; coup([ox + L * u, oy + e * hh], [ox + L * (u + 0.022 + r() * 0.012), oy + e * hh + (r() - 0.5) * 2], 3 + r() * 3, cs(k.map(q => q + j))); }
    const u = 0.13; x.globalAlpha = 1; x.fillStyle = cs(c(YEUX[id])); x.beginPath(); x.arc(ox + L * u, oy - profil(F, u) * H * 0.35, F.H * L * 0.05 + 2, 0, 7); x.fill(); x.fillStyle = '#17151c'; x.beginPath(); x.arc(ox + L * u, oy - profil(F, u) * H * 0.35, F.H * L * 0.026 + 1, 0, 7); x.fill();
  }
  x.globalAlpha = esquisse ? 0.75 : 0.5; x.strokeStyle = '#3c3226'; x.lineWidth = esquisse ? 1.6 : 1.1; for (const sg of [-1, 1]) { x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, hh = profil(F, u) * H * (sg < 0 ? 0.72 + F.dos * 0.5 : 1.2 - F.dos * 0.4); x[i ? 'lineTo' : 'moveTo'](ox + L * u + (r() - 0.5) * 1.1, oy + sg * hh); } x.stroke(); } x.globalAlpha = 1;
}
