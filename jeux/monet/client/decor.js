// LES EAUX DE MONET — le paysage, peint touche par touche : berges, arbres, saules, roseaux, nymphéas, le pont japonais, le campement.
import * as THREE from 'three';
import { ETANG } from './reglages.js';
import { hauteur, profondeur, sol, bruit, fbm, lisse, hasard, NENUPHARS, ARBRES, SOUCHES, ROCHERS, PONT, hauteurPont, pilesPont, roseauEn } from './etang.js';
import { Toile, SOL, FACE, TIGE, matiereTouches, UNI, pioche, melange, couleur } from './peinture.js';

const HERBE = ['#4f7f48', '#6a9550', '#88a854', '#a6b95c', '#3f7458', '#5f8f6c', '#c0c463'], HERBE_OMBRE = ['#3c6a62', '#46706f', '#5b6f96', '#6a6c9c'], VASE = ['#a89a62', '#8e8a58', '#b5a673', '#7f8460'];
const FEUILLES = ['#3f7048', '#55884c', '#749c50', '#94ae56', '#2f6458', '#b6bd5e'], FEUILLES_OMBRE = ['#2c5560', '#37557a', '#4c5a8c', '#2f5a52'], SAULE = ['#8fae58', '#a9bc5e', '#c2c668', '#6f9a58', '#5e8c62'];
const TRONC = ['#5a4a58', '#6a5848', '#4a4668', '#7a6650'], BOULEAU = ['#e8e2d4', '#cfcfd8', '#b9bccf'], PONT_C = ['#4f8a78', '#5f9c84', '#3f7468', '#79ad8c'], GLYCINE = ['#9a82c8', '#b49ad8', '#7f6cb8', '#c8b4e0'];
const FLEURS = [['#d8483c', '#e8624a'], ['#7f64b8', '#9a82d0'], ['#f0d458', '#f4e27a'], ['#f4efe6', '#e8e0ee'], ['#e88aa8', '#f0a8c0']];

const norm = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return [x / n, y / n, z / n]; };
const normaleSol = (x, z) => norm(hauteur(x - 0.8, z) - hauteur(x + 0.8, z), 1.6, hauteur(x, z - 0.8) - hauteur(x, z + 0.8));

// un trait de matière d'un point à un autre (troncs, branches, rambardes)
function trait(T, a, b, larg, pal, r, pas = 0.32, balance = 0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(L / pas)), ang = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]));
  for (let i = 0; i <= n; i++) { const t = i / n, c = pioche(pal, r); for (let k = 0; k < 2; k++) T.touche(a[0] + (b[0] - a[0]) * t + (r() - 0.5) * larg * 0.5, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + (r() - 0.5) * larg * 0.5, Math.max(pas * 1.7, larg * 1.1), larg * (0.9 + r() * 0.5), ang + (r() - 0.5) * 0.4, FACE, c, norm(r() - 0.5, 0.4, r() - 0.5), balance); }
}
// un volume de feuillage : des touches sur une boule, claires vers le soleil et le haut, bleutées dessous
function masse(T, cx, cy, cz, R, n, r, o = {}) {
  const pal = o.pal ?? FEUILLES, ombre = o.ombre ?? FEUILLES_OMBRE, ey = o.ey ?? 0.82, taille = Math.max(o.taille ?? 0.85, R * Math.sqrt(12.6 / n) * 1.05); // assez large pour que le volume soit plein
  // le cœur sombre du feuillage : on ne voit jamais à travers
  for (let i = 0, c = Math.ceil(n * 0.28); i < c; i++) { const u = r() * 2 - 1, a = r() * 6.28, s = Math.sqrt(1 - u * u), rr = R * 0.62; T.touche(cx + Math.cos(a) * s * rr, cy + u * rr * ey, cz + Math.sin(a) * s * rr, taille * 2.2, taille * 1.7, r() * 6.28, FACE, pioche(ombre, r), [Math.cos(a) * s, u, Math.sin(a) * s], (o.balance ?? 0.09) * 0.4); }
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = R * (0.72 + r() * 0.34), nx = Math.cos(a) * s, ny = u, nz = Math.sin(a) * s;
    const clair = lisse(-0.5, 0.75, ny + nx * 0.25 - nz * 0.15 + (r() - 0.5) * 0.5), c = melange(pioche(ombre, r), pioche(pal, r), clair);
    T.touche(cx + nx * rr, cy + ny * rr * ey, cz + nz * rr, taille * (1.1 + r() * 0.8), taille * (0.62 + r() * 0.5), r() * 6.28, FACE, c, [nx, ny, nz], o.balance ?? 0.09);
  }
}
function arbre(T, A, r, d) {
  const y0 = hauteur(A.x, A.z) - 0.2;
  if (A.genre === 'saule') {
    const haut = y0 + A.h * 0.62, pen = A.geant ? 1.3 : 0.6; trait(T, [A.x, y0, A.z], [A.x + pen * 0.4, y0 + A.h * 0.45, A.z], A.geant ? 0.95 : 0.55, TRONC, r, 0.3);
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + r(); trait(T, [A.x + pen * 0.4, y0 + A.h * 0.42, A.z], [A.x + Math.cos(a) * A.r * 0.5, haut + r() * 1.5, A.z + Math.sin(a) * A.r * 0.5], 0.28, TRONC, r, 0.4); }
    masse(T, A.x, haut + 1.4, A.z, A.r * 0.72, Math.round(420 * d), r, { pal: SAULE, ey: 0.55, taille: 0.8 });
    // les branches qui retombent jusqu'à l'eau, longues et souples
    const brins = Math.round((A.geant ? 150 : 80) * d);
    for (let b = 0; b < brins; b++) {
      const a = r() * Math.PI * 2, R = A.r * (0.45 + r() * 0.62), x = A.x + Math.cos(a) * R, z = A.z + Math.sin(a) * R, top = haut + (1 - R / A.r) * 2.4 + r(), bas = Math.max(hauteur(x, z) + 0.05, 0.08 + r() * 1.6), n = Math.round((top - bas) / 0.5), c0 = pioche(SAULE, r);
      for (let i = 0; i <= n; i++) { const t = i / n; T.touche(x + Math.sin(t * 3 + b) * 0.16, top + (bas - top) * t, z + Math.cos(t * 3 + b) * 0.16, 0.8, 0.13 + r() * 0.1, Math.PI / 2 + (r() - 0.5) * 0.25, FACE, melange(c0, couleur('#5f8a64'), t * 0.5), [Math.cos(a), 0.35, Math.sin(a)], 0.08 + t * 0.34); }
    }
    return;
  }
  if (A.genre === 'peuplier') {
    trait(T, [A.x, y0, A.z], [A.x, y0 + A.h * 0.3, A.z], 0.36, TRONC, r);
    for (let k = 0; k < 7; k++) { const t = k / 6, R = A.r * Math.sin(0.25 + t * 2.7) * (1 - t * 0.35); masse(T, A.x, y0 + A.h * (0.22 + t * 0.72), A.z, Math.max(0.9, R), Math.round(95 * d), r, { pal: ['#58884c', '#739c50', '#3f7a54', '#94ae56'], ey: 1.5, taille: 0.75, balance: 0.14 }); }
    return;
  }
  const bouleau = A.genre === 'bouleau', penche = A.penche ? [(0 - A.x) * 0.05, (10 - A.z) * 0.05] : [0, 0], tete = [A.x + penche[0], y0 + A.h * 0.62, A.z + penche[1]];
  trait(T, [A.x, y0, A.z], tete, bouleau ? 0.28 : A.h * 0.05, bouleau ? BOULEAU : TRONC, r);
  for (let k = 0; k < 5; k++) { const a = k * 1.3 + r(), f = [tete[0] + Math.cos(a) * A.r * 0.55, tete[1] + r() * A.h * 0.2, tete[2] + Math.sin(a) * A.r * 0.55]; trait(T, tete, f, 0.2, bouleau ? BOULEAU : TRONC, r, 0.4); }
  const n = bouleau ? 5 : 7;
  for (let k = 0; k < n; k++) { const a = k * 2.4 + r(), R = k === 0 ? 0 : A.r * 0.56; masse(T, tete[0] + Math.cos(a) * R, tete[1] + A.h * 0.1 + (k === 0 ? A.h * 0.16 : r() * A.h * 0.1), tete[2] + Math.sin(a) * R, A.r * (0.42 + r() * 0.22), Math.round((bouleau ? 110 : 170) * d), r, bouleau ? { pal: ['#a8bc5c', '#c4c868', '#8aaa54'], balance: 0.14, taille: 0.62 } : {}); }
}

export function construireDecor(scene, Q) {
  const r = hasard(1899), d = Q.densite, T = new Toile(), mat = matiereTouches();
  /* --- le fond peint sous les touches : aucune fente ne laisse voir le vide --- */
  {
    const g = new THREE.PlaneGeometry(340, 340, 170, 170).rotateX(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = hauteur(x, z); p.setY(i, h - 0.06); const k = h < 0 ? melange(couleur('#3f5f50'), couleur('#16323c'), lisse(0, 2.5, -h)) : h < 0.5 ? couleur('#7c7c52') : melange(couleur('#3f6a48'), couleur('#55704c'), fbm(x * 0.05, z * 0.05)); col.set(k, i * 3); }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexColors: true, side: THREE.DoubleSide, uniforms: { ...UNI },
      vertexShader: 'varying vec3 vC, vN, vW; void main() { vC = color; vN = normal; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 uDirSoleil, uSoleil, uOmbre, uBrume; uniform float uDensite, uForce, uMiroir; varying vec3 vC, vN, vW; void main() { if (uMiroir > .5 && vW.y < -.04) discard; float e = dot(normalize(vN), uDirSoleil) * .5 + .5; vec3 c = vC * mix(uOmbre, uSoleil, smoothstep(.3, .76, e)) * uForce; gl_FragColor = vec4(mix(c, uBrume, 1. - exp(-length(vW - cameraPosition) * uDensite)), 1.); }' })));
  }
  /* --- la berge et la prairie : l'herbe est une pluie de touches, couchées dans le sens du vent --- */
  const pas = 0.62 / Math.sqrt(d);
  for (let z = -128; z < 128; z += pas) for (let x = -128; x < 128; x += pas) {
    const R = Math.hypot(x, z), loin = R > 76; if (R > 128 || (loin && r() > 0.42)) continue;
    const px = x + (r() - 0.5) * pas * 1.3, pz = z + (r() - 0.5) * pas * 1.3, h = hauteur(px, pz); if (h < -0.22) continue;
    const pli = fbm(px * 0.04, pz * 0.04), tache = bruit(px * 0.11 + 9, pz * 0.11), bord = lisse(0.7, 0.05, h), ombre = lisse(0.58, 0.34, tache) * 0.75, c = melange(melange(pioche(HERBE, r), pioche(HERBE_OMBRE, r), ombre), pioche(VASE, r), bord * 0.85);
    const a = pli * 9 + (r() - 0.5) * 0.9, e = (loin ? 2 : 1) * (0.72 + 0.42 / Math.sqrt(d)); T.touche(px, h + 0.03, pz, (0.8 + r() * 0.6) * e, (0.42 + r() * 0.3) * e, a, SOL, c, normaleSol(px, pz));
    // des bouquets de fleurs, posés en taches comme chez le peintre
    const prairie = bruit(px * 0.07 + 40, pz * 0.07 - 3); if (h > 0.25 && prairie > 0.62 && r() < 0.32) { const f = FLEURS[Math.floor(bruit(px * 0.03, pz * 0.03 + 8) * 5) % 5]; T.touche(px, h + 0.22 + r() * 0.22, pz, 0.2 + r() * 0.15, 0.17, r() * 6, FACE, pioche(f, r), [0, 1, 0], 0.05); }
    if (h > 0.05 && !loin && r() < 0.2) for (let k = 0; k < 3; k++) T.touche(px + (r() - 0.5) * 0.3, h, pz + (r() - 0.5) * 0.3, 0.05 + r() * 0.04, 0.3 + r() * 0.42, r() * 6.28, TIGE, melange(c, couleur('#c2c668'), r() * 0.45), normaleSol(px, pz), 0.28);
  }
  /* --- le fond de l'étang, visible là où l'eau est claire --- */
  for (let i = 0; i < 14000 * d; i++) { const a = r() * 6.28, R = Math.sqrt(r()) * 90, x = Math.cos(a) * R, z = Math.sin(a) * R, p = profondeur(x, z); if (p < 0.12 || p > 3) continue; T.touche(x, -p + 0.03, z, 1.5 + r(), 0.6 + r() * 0.4, r() * 6, SOL, melange(pioche(['#6a7a4c', '#55705a', '#7c8058'], r), couleur('#23484e'), lisse(0.2, 2.4, p)), [0, 1, 0]); }
  /* --- les roseaux et les iris, au bord de l'eau --- */
  for (let i = 0; i < 26000 * d; i++) {
    const a = r() * 6.28, R = 14 + Math.sqrt(r()) * 84, x = Math.cos(a) * R, z = Math.sin(a) * R; if (!roseauEn(x, z)) continue;
    const h = hauteur(x, z), n = 3 + Math.floor(r() * 4), c = pioche(['#6c9650', '#88a854', '#a6b45a', '#4f8460'], r);
    for (let k = 0; k < n; k++) T.touche(x + (r() - 0.5) * 0.55, Math.max(h, -0.05), z + (r() - 0.5) * 0.55, 0.11, 1.1 + r() * 1.1, r() * 6.28, TIGE, melange(c, pioche(['#c2c668', '#3f7458'], r), r() * 0.5), [0, 1, 0.2], 0.3);
    if (r() < 0.2) T.touche(x, Math.max(h, 0) + 1.1 + r() * 0.5, z, 0.3, 0.2, r() * 6, FACE, pioche(r() < 0.5 ? FLEURS[1] : FLEURS[2], r), [0, 1, 0], 0.12);
  }
  /* --- les arbres, et le bois qui ferme l'horizon --- */
  for (const A of ARBRES) arbre(T, A, r, Math.max(0.45, d));
  for (let i = 0; i < 230; i++) { const a = (i / 230) * 6.28 + r() * 0.03, R = 112 + r() * 26, x = Math.cos(a) * R, z = Math.sin(a) * R, y = hauteur(x, z) + 7 + r() * 10; masse(T, x, y, z, 10 + r() * 7, Math.round(190 * Math.max(0.55, d)), r, { taille: 1.7, ey: 1.2, pal: ['#55804c', '#6f9650', '#4a7a60', '#7f9c58'], ombre: ['#4a6a78', '#5a6a92', '#3f6668'], balance: 0.03 }); trait(T, [x, hauteur(x, z), z], [x, y, z], 1, HERBE_OMBRE, r, 1.2); }
  /* --- les nymphéas : des feuilles rondes posées sur l'eau, des fleurs roses et blanches --- */
  for (const L of NENUPHARS) {
    const n = 7, c0 = pioche(['#3f7a58', '#558a58', '#2f6a60', '#6f9c58'], r);
    for (let i = 0; i < n; i++) { const a = L.a + (i / n) * 5.5, R = L.r * 0.52; T.touche(L.x + Math.cos(a) * R, 0.05, L.z + Math.sin(a) * R, L.r * 1, L.r * 0.56, -a, SOL, melange(c0, pioche(['#8fb064', '#2f5f68'], r), r() * 0.55), [0, 1, 0], 0.012); }
    T.touche(L.x, 0.055, L.z, L.r * 0.9, L.r * 0.7, r() * 6, SOL, melange(c0, couleur('#a4bc68'), 0.35), [0, 1, 0], 0.012);
    if (L.fleur) { const P = L.fleur === 'rose' ? ['#f0a0bc', '#e87ea4', '#f8c8d4'] : ['#fbf6ec', '#f0e8ec', '#e8e0f0']; for (let i = 0; i < 16; i++) { const a = r() * 6.28, R = r() * 0.24, y = 0.11 + r() * 0.2; T.touche(L.x + Math.cos(a) * R, y, L.z + Math.sin(a) * R, 0.24, 0.13, a + 1.2, FACE, pioche(P, r), [Math.cos(a), 0.8, Math.sin(a)]); } T.touche(L.x, 0.3, L.z, 0.16, 0.14, 0, FACE, couleur('#f4d040'), [0, 1, 0]); }
  }
  /* --- les souches noyées et les rochers de la crique --- */
  for (const S of SOUCHES) { trait(T, [S.x, -1.2, S.z], [S.x, 0.35 + r() * 0.3, S.z], S.r, TRONC, r, 0.2); for (let k = 0; k < 3; k++) { const a = k * 2.1; trait(T, [S.x, 0.2, S.z], [S.x + Math.cos(a) * 1.1, 0.75, S.z + Math.sin(a) * 1.1], 0.14, TRONC, r); } }
  for (const R of ROCHERS) masse(T, R.x, hauteur(R.x, R.z) + R.r * 0.3, R.z, R.r, Math.round(120 * Math.max(0.5, d)), r, { pal: ['#b9b09a', '#a59c94', '#c8bea4'], ombre: ['#6a6888', '#7a7894', '#5f6478'], ey: 0.7, taille: 0.45, balance: 0 });
  /* --- le pont japonais : une arche verte, une treille de glycine --- */
  {
    const P = PONT, ax = P.axe, n = Math.round(P.longueur / 0.34), lat = [-ax[1], ax[0]], pt = (t, e, dy = 0) => [P.a[0] + ax[0] * P.longueur * t + lat[0] * e, hauteurPont(t) + dy, P.a[1] + ax[1] * P.longueur * t + lat[1] * e];
    for (let i = 0; i <= n; i++) { const t = i / n; for (let k = -2; k <= 2; k++) { const q = pt(t, (k / 2) * P.largeur * 0.46, -0.05); T.touche(q[0], q[1], q[2], P.largeur * 0.36, 0.36, Math.atan2(lat[0], lat[1]), SOL, pioche(PONT_C, r), [0, 1, 0]); } }
    for (const s of [-1, 1]) {
      let prev = pt(0, (s * P.largeur) / 2, 1.05);
      for (let i = 1; i <= 34; i++) { const t = i / 34, q = pt(t, (s * P.largeur) / 2, 1.05); trait(T, prev, q, 0.11, PONT_C, r, 0.2); prev = q; }
      for (let i = 0; i <= 12; i++) { const t = i / 12; trait(T, pt(t, (s * P.largeur) / 2, -0.1), pt(t, (s * P.largeur) / 2, 1.05), 0.09, PONT_C, r, 0.16); }
      for (let i = 0; i <= 10; i += 2) { const t = 0.08 + (i / 10) * 0.84; trait(T, pt(t, (s * P.largeur) / 2, 1), pt(t, (s * P.largeur) / 2, 3), 0.11, PONT_C, r, 0.22); }
      prev = pt(0.08, (s * P.largeur) / 2, 3); for (let i = 1; i <= 20; i++) { const q = pt(0.08 + (i / 20) * 0.84, (s * P.largeur) / 2, 3); trait(T, prev, q, 0.1, PONT_C, r, 0.24); prev = q; }
    }
    for (let i = 0; i < 16; i++) { const t = 0.08 + (i / 15) * 0.84; trait(T, pt(t, -P.largeur / 2, 3), pt(t, P.largeur / 2, 3), 0.08, PONT_C, r, 0.2); }
    for (let i = 0; i < 620 * Math.max(0.6, d); i++) { const t = 0.05 + r() * 0.9, e = (r() - 0.5) * P.largeur * 1.3, chute = r() ** 2 * 1.5, q = pt(t, e, 3.2 - chute); T.touche(q[0], q[1], q[2], 0.34, 0.2 + chute * 0.1, r() * 6, FACE, pioche(r() < 0.82 ? GLYCINE : ['#7f9c58', '#5f8a54'], r), norm(r() - 0.5, 0.6, r() - 0.5), 0.1); }
    for (const p of pilesPont) trait(T, [p.x, -2.4, p.z], [p.x, hauteurPont(p.t), p.z], 0.22, ['#3f6a60', '#4f7a68', '#35595a'], r, 0.3);
  }
  /* --- le campement du pêcheur : la chaise et le carnet, la caisse à leurres, le chevalet et sa carte --- */
  const c = ETANG.camp, bois = ['#8a6a48', '#a07c54', '#745a44'], poser = (x, z) => hauteur(c.x + x, c.z + z), hot = {};
  { // le tabouret, le carnet posé dessus
    const x = c.x + 3.4, z = c.z - 1.6, y = poser(3.4, -1.6) + 0.62; for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) trait(T, [x + a, y - 0.62, z + b], [x + a * 0.8, y, z + b * 0.8], 0.06, bois, r, 0.1);
    for (let i = 0; i < 14; i++) T.touche(x + (r() - 0.5) * 0.46, y, z + (r() - 0.5) * 0.46, 0.28, 0.14, r(), SOL, pioche(bois, r), [0, 1, 0]);
    for (let i = 0; i < 16; i++) T.touche(x + (r() - 0.5) * 0.24, y + 0.06, z + (r() - 0.5) * 0.3, 0.16, 0.1, 0.2, SOL, pioche(['#5a3f30', '#7a4c34', '#4a3430'], r), [0, 1, 0]); hot.carnet = [x, y + 0.08, z];
  }
  { // la caisse à leurres, ouverte
    const x = c.x + 5.6, z = c.z - 3.2, y = poser(5.6, -3.2); for (let i = 0; i < 180; i++) { const f = i % 3, u = (r() - 0.5) * 0.8, v = r() * 0.42; T.touche(x + (f === 0 ? u : (i % 2 ? 0.4 : -0.4)), y + (f === 2 ? 0.44 : v), z + (f === 1 ? u * 0.6 : i % 2 ? 0.26 : -0.26), 0.2, 0.09, r() * 0.3, FACE, pioche(['#6f8a64', '#5f7a60', '#8a6a48', '#7f9a78'], r), norm(0, 0.6, 1)); } for (let i = 0; i < 12; i++) T.touche(x + (r() - 0.5) * 0.6, y + 0.46, z + (r() - 0.5) * 0.36, 0.09, 0.05, r() * 6, FACE, pioche(['#e6e8ee', '#c9803f', '#e2813a', '#a87fb0'], r), [0, 1, 0]); hot.boite = [x, y + 0.45, z];
  }
  { // le chevalet, la carte de la région peinte dessus
    const x = c.x - 1.2, z = c.z - 5, y = poser(-1.2, -5); trait(T, [x - 0.5, y, z + 0.3], [x, y + 2, z], 0.07, bois, r, 0.12); trait(T, [x + 0.5, y, z + 0.3], [x, y + 2, z], 0.07, bois, r, 0.12); trait(T, [x, y, z - 0.5], [x, y + 2, z], 0.07, bois, r, 0.12); trait(T, [x - 0.62, y + 0.86, z + 0.1], [x + 0.62, y + 0.86, z + 0.1], 0.07, bois, r, 0.12);
    for (let i = 0; i < 260; i++) { const u = (r() - 0.5) * 1.15, v = r() * 0.8; T.touche(x + u, y + 0.92 + v, z + 0.08 - v * 0.1, 0.14, 0.07, r() * 3, FACE, pioche(bruit(u * 3 + 3, v * 3) > 0.55 ? ['#7fb6c8', '#5f9cb0'] : ['#e8dfc0', '#d8c88f', '#a8b878', '#c8b070'], r), [0, 0.1, 1]); } hot.carte = [x, y + 1.3, z + 0.1];
  }
  T.poser(scene, mat);
  return { hot, touches: T.total };
}
