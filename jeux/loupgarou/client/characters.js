// Personnages du Loup-Garou : villageois cartoon (grosse tête, grands yeux, contour encré), habillés selon leur apparence
// (LG.LOOK : peau, coiffure, tenue, chapeau, accessoire), et animés : marche, assis, clignement, bouche qui parle,
// 10 emotes, lancer, réaction quand un objet les touche (tomate écrasée, étoiles après une chaussure…), fantôme une fois mort.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LG = window.LG;
const TAU = Math.PI * 2;

/* ---------------- Petites briques ---------------- */
const G = {
  sphere: (r, w = 20, h = 14, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest),
  capsule: (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14),
  cyl: (rt, rb, h, s = 18, open = false, t0 = 0, tl = TAU) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, t0, tl),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s),
  torus: (R, r, arc = TAU) => new THREE.TorusGeometry(R, r, 8, 28, arc),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
};
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const live = m => ((m.userData.live = true), m);

// Contour encré : la même forme, gonflée le long des normales, vue de l'intérieur.
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#2a170f', side: THREE.BackSide });
OUTLINE.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.011;'); };

// Fusionne les pièces fixes d'un membre (une seule pièce par matière) : beaucoup moins d'objets à dessiner.
function merge(pivot, outlined, outlines) {
  const by = new Map();
  for (const m of [...pivot.children]) {
    if (!m.isMesh || m.userData.live) continue;
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!by.has(m.material)) by.set(m.material, []);
    by.get(m.material).push(g);
    pivot.remove(m);
  }
  for (const [mat, list] of by) {
    const geo = mergeGeometries(list), mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !mat.transparent;
    pivot.add(mesh);
    if (outlined.has(mat)) { const o = new THREE.Mesh(geo, OUTLINE); outlines.push(o); pivot.add(o); }
  }
}

// Tissu tissé (relief) et iris des yeux, peints une fois
const canvasTex = (n, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const WEAVE = canvasTex(128, (x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 4) for (let k = 0; k < n; k += 4) { x.fillStyle = (y + k) % 8 ? '#a0a0a0' : '#606060'; x.fillRect(k, y, 3, 3); } }, false);
WEAVE.repeat.set(6, 6);
const IRIS = canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#c8c8c8'); g.addColorStop(0.95, '#606060'); g.addColorStop(1, '#202020'); x.fillStyle = g; x.fillRect(0, 0, n, n); for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; x.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`; x.beginPath(); x.moveTo(n / 2 + Math.cos(a) * 14, n / 2 + Math.sin(a) * 14); x.lineTo(n / 2 + Math.cos(a) * 58, n / 2 + Math.sin(a) * 58); x.stroke(); } });
const EYE_COLORS = ['#5a8ac8', '#6a4a2a', '#4a8a5a', '#8a6a3a', '#3a6aa8', '#7a7a8a'];

/* ---------------- Un villageois ---------------- */
export function makeCharacter(look, color) {
  const [skin, hair, hairC, outfit, outfitC, hat, extra] = look;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, ...o });
  const dark = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const cloth = LG.LOOK.outfitColor[outfitC], hairCol = LG.LOOK.hairColor[hairC];
  const M = {
    skin: std(LG.LOOK.skin[skin], { roughness: 0.62 }), hair: std(hairCol, { roughness: 0.5 }), cloth: std(cloth, { roughness: 0.92, bumpMap: WEAVE, bumpScale: 1.5 }),
    trim: std(dark(cloth, 0.55), { bumpMap: WEAVE, bumpScale: 1.2 }), pants: std('#5b4636', { roughness: 0.95, bumpMap: WEAVE, bumpScale: 1.5 }), boots: std('#3b2a20', { roughness: 0.7 }),
    white: std('#ffffff', { roughness: 0.25 }), pupil: std('#1b1311', { roughness: 0.15 }), mouth: std('#6e2320', { roughness: 0.5 }),
    cheek: new THREE.MeshBasicMaterial({ color: '#ff8f8a', transparent: true, opacity: 0.4, depthWrite: false }),
    brow: std(dark(hair === 6 ? '#6b3e22' : hairCol, 0.7)), metal: std('#b9bec7', { metalness: 0.75, roughness: 0.3 }),
    straw: std('#e2c069', { roughness: 1 }), accent: std(color, { roughness: 0.6 }), gold: std('#e0b24a', { metalness: 0.7, roughness: 0.3 }),
    leaf: std('#5f9e45'), white2: std('#f6f1e6', { roughness: 0.95, bumpMap: WEAVE, bumpScale: 1 }),
    iris: std(EYE_COLORS[(skin * 3 + hairC * 5 + outfitC) % EYE_COLORS.length], { map: IRIS, roughness: 0.15 }), button: std('#d8c8a0', { roughness: 0.5 }),
  };
  const outlined = new Set([M.skin, M.hair, M.cloth, M.trim, M.pants, M.boots, M.straw, M.metal, M.accent]);
  const outlines = [];
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.46; root.add(body); // pivot aux hanches

  // Jambes (cuisse, puis genou)
  const legs = [1, -1].map(side => {
    const thigh = new THREE.Group(); thigh.position.x = side * 0.1; body.add(thigh);
    put(thigh, G.capsule(0.085, 0.13), M.pants, 0, -0.12, 0);
    const knee = new THREE.Group(); knee.position.y = -0.23; thigh.add(knee);
    put(knee, G.capsule(0.078, 0.1), M.pants, 0, -0.08, 0);
    put(knee, G.sphere(0.1, 14, 10), M.boots, 0, -0.17, 0.04, 0, 0, 0, 1, 0.68, 1.4);
    merge(thigh, outlined, outlines); merge(knee, outlined, outlines);
    return { thigh, knee };
  });

  // Buste et tenue
  const torso = new THREE.Group(); body.add(torso);
  const lathe = (pts, mat, phi0 = 0, phiL = TAU) => put(torso, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 22, phi0, phiL), mat);
  const robe = outfit === 1;
  lathe(robe ? [[0, -0.38], [0.36, -0.36], [0.31, -0.1], [0.24, 0.16], [0.2, 0.42], [0.12, 0.5], [0, 0.52]] : [[0, -0.07], [0.25, -0.05], [0.27, 0.06], [0.23, 0.26], [0.2, 0.42], [0.12, 0.5], [0, 0.52]], M.cloth);
  put(torso, G.torus(0.225, 0.026), M.trim, 0, robe ? 0.18 : 0.12, 0, Math.PI / 2);
  put(torso, G.box(0.07, 0.06, 0.03), M.gold, 0, robe ? 0.18 : 0.12, 0.235);
  put(torso, G.torus(0.12, 0.03), M.trim, 0, 0.48, 0, Math.PI / 2);
  if (outfit !== 1) for (const y of [0.22, 0.32, 0.42]) put(torso, G.sphere(0.018, 8, 6), M.button, 0, y, 0.235 - (y - 0.22) * 0.12);
  if (outfit === 2) { // cape
    put(torso, G.cyl(0.25, 0.36, 0.66, 18, true, Math.PI * 0.62, Math.PI * 0.76), M.trim, 0, 0.16, -0.01);
    put(torso, G.sphere(0.04), M.gold, 0, 0.47, 0.13);
  }
  if (outfit === 3) { // tablier
    put(torso, G.box(0.3, 0.34, 0.025), M.white2, 0, 0.08, 0.245, -0.12);
    put(torso, G.box(0.03, 0.2, 0.02), M.white2, 0.09, 0.33, 0.2, -0.35);
    put(torso, G.box(0.03, 0.2, 0.02), M.white2, -0.09, 0.33, 0.2, -0.35);
  }
  if (outfit === 4) lathe([[0.265, 0.02], [0.245, 0.24], [0.215, 0.42], [0.14, 0.49]], M.trim, 0.45, TAU - 0.9); // gilet ouvert devant
  merge(torso, outlined, outlines);

  // Bras (manche, main, et un doigt tendu pour accuser… ou pire)
  const arms = [1, -1].map(side => {
    const a = new THREE.Group(); a.position.set(side * 0.235, 0.4, 0); torso.add(a);
    put(a, G.capsule(0.07, 0.19), M.cloth, 0, -0.13, 0);
    put(a, G.torus(0.068, 0.018), M.trim, 0, -0.25, 0, Math.PI / 2);
    put(a, G.sphere(0.084, 18, 14), M.skin, 0, -0.32, 0);
    put(a, G.capsule(0.028, 0.05), M.skin, -side * 0.055, -0.3, 0.05, 0.4, 0, side * 0.6);
    const finger = live(put(a, G.capsule(0.022, 0.08), M.skin, 0, -0.42, 0));
    finger.visible = false;
    merge(a, outlined, outlines);
    return { a, finger };
  });

  // Tête : grands yeux, sourcils et bouche qui changent selon l'humeur
  const head = new THREE.Group(); head.position.y = 0.5; torso.add(head);
  put(head, G.sphere(0.3, 40, 30), M.skin, 0, 0.27, 0, 0, 0, 0, 1.04, 0.96, 0.98);
  put(head, G.sphere(0.055), M.skin, 0, 0.22, 0.29);
  for (const s of [1, -1]) put(head, G.sphere(0.065), M.skin, s * 0.295, 0.26, 0, 0, 0, 0, 0.55, 1, 0.9);
  for (const s of [1, -1]) put(head, new THREE.CircleGeometry(0.05, 18), M.cheek, s * 0.17, 0.19, 0.24, 0, s * 0.6, 0);
  const eyes = new THREE.Group(); head.add(eyes); live(eyes);
  const pupils = [];
  for (const s of [1, -1]) {
    if (extra === 5 && s === -1) { put(head, G.sphere(0.07, 16, 10), M.pupil, s * 0.105, 0.31, 0.25, 0, 0, 0, 1, 1, 0.45); continue; } // cache-œil
    put(eyes, G.sphere(0.078, 24, 18), M.white, s * 0.105, 0.31, 0.26, 0, 0, 0, 1, 1.18, 0.6);
    put(eyes, G.sphere(0.048, 20, 14), M.iris, s * 0.1, 0.3, 0.287, 0, 0, 0, 1, 1.22, 0.5);
    pupils.push(put(eyes, G.sphere(0.024, 14, 10), M.pupil, s * 0.1, 0.3, 0.305, 0, 0, 0, 1, 1.22, 0.45));
    put(eyes, G.sphere(0.013, 8, 6), M.white, s * 0.088, 0.325, 0.318);
    put(eyes, G.sphere(0.006, 6, 4), M.white, s * 0.112, 0.285, 0.318);
  }
  const closed = live(new THREE.Group()); head.add(closed); closed.visible = false;
  for (const s of [1, -1]) if (!(extra === 5 && s === -1)) put(closed, G.torus(0.05, 0.013, Math.PI), M.pupil, s * 0.105, 0.29, 0.285);
  const brows = [1, -1].map(s => live(put(head, G.box(0.11, 0.028, 0.03), M.brow, s * 0.105, 0.42, 0.245)));
  const mouth = live(new THREE.Group()); mouth.position.set(0, 0.13, 0.27); head.add(mouth);
  const mouths = {
    smile: put(mouth, G.torus(0.068, 0.015, Math.PI), M.mouth, 0, 0.03, 0, 0, 0, Math.PI),
    sad: put(mouth, G.torus(0.06, 0.015, Math.PI), M.mouth, 0, -0.03, 0),
    open: put(mouth, G.sphere(0.06, 14, 10), M.mouth, 0, 0, 0, 0, 0, 0, 1.15, 0.8, 0.35),
    o: put(mouth, G.sphere(0.034, 12, 8), M.mouth, 0, 0, 0.005, 0, 0, 0, 1, 1.25, 0.5),
    laugh: put(mouth, new THREE.CircleGeometry(0.075, 18, Math.PI, Math.PI), M.mouth, 0, 0.02, 0.012),
  };
  put(mouths.laugh, G.box(0.1, 0.018, 0.01), M.white, 0, -0.012, 0.003);

  // Coiffure
  const cap = () => put(head, G.sphere(0.316, 26, 14, 0, TAU, 0, Math.PI * 0.43), M.hair, 0, 0.275, -0.01, -0.38, 0, 0, 1.06, 1, 1.04);
  if (hair !== 6) cap();
  if (hair === 1) put(head, G.sphere(0.13, 14, 10), M.hair, 0.07, 0.48, 0.19, 0.2, 0, -0.5, 1.6, 0.45, 0.8);
  if (hair === 2) put(head, G.capsule(0.2, 0.22), M.hair, 0, 0.12, -0.14, 0.1, 0, 0, 1.4, 1, 0.62);
  if (hair === 3) { put(head, G.sphere(0.13), M.hair, 0, 0.56, -0.13); put(head, G.torus(0.09, 0.02), M.accent, 0, 0.5, -0.11, 1.1); }
  if (hair === 4) for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; put(head, G.cone(0.065, 0.2, 8), M.hair, Math.sin(a) * 0.17, 0.52, Math.cos(a) * 0.17 - 0.04, Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7); }
  if (hair === 5) for (const s of [1, -1]) { for (let k = 0; k < 4; k++) put(head, G.sphere(0.058, 10, 8), M.hair, s * (0.27 - k * 0.012), 0.18 - k * 0.1, -0.06); put(head, G.sphere(0.04, 8, 6), M.accent, s * 0.23, -0.2, -0.06); }

  // Chapeau
  if (hat === 1) { put(head, G.cyl(0.5, 0.52, 0.025, 28), M.straw, 0, 0.47, -0.02, -0.08); put(head, G.cyl(0.24, 0.28, 0.2, 22), M.straw, 0, 0.57, -0.03, -0.08); put(head, G.cyl(0.285, 0.285, 0.05, 22), M.accent, 0, 0.5, -0.025, -0.08); }
  if (hat === 2) { put(head, G.sphere(0.36, 22, 14, Math.PI * 0.6, Math.PI * 1.8, 0, Math.PI * 0.62), M.trim, 0, 0.27, -0.02); put(head, G.cone(0.12, 0.3, 10), M.trim, 0, 0.38, -0.36, -1.9); }
  if (hat === 3) { put(head, G.torus(0.29, 0.03), M.leaf, 0, 0.47, 0, Math.PI / 2 - 0.15); ['#ff6f91', '#ffd23f', '#ffffff', '#9b7bff', '#ff8a3d', '#ff6f91', '#ffd23f'].forEach((c, k) => { const a = (k / 7) * TAU; put(head, G.sphere(0.055, 10, 8), std(c), Math.sin(a) * 0.29, 0.47 + Math.cos(a) * 0.04, Math.cos(a) * 0.29); }); }
  if (hat === 4) { put(head, G.sphere(0.325, 22, 12, 0, TAU, 0, Math.PI * 0.5), M.accent, 0, 0.3, -0.02, -0.15); put(head, G.torus(0.3, 0.045), M.white2, 0, 0.32, -0.01, Math.PI / 2 - 0.15); put(head, G.sphere(0.08), M.white2, 0, 0.66, -0.08); }
  if (hat === 5) { put(head, G.cyl(0.44, 0.46, 0.03, 26), M.trim, 0, 0.5, 0, -0.1, 0, 0.12); put(head, G.cyl(0.22, 0.27, 0.22, 20), M.trim, 0, 0.61, -0.02, -0.1, 0, 0.12); put(head, G.sphere(0.07, 12, 10), M.accent, 0.12, 0.72, -0.2, 0.9, 0, -0.5, 0.5, 2.6, 0.6); }
  if (hat === 6) { put(head, G.sphere(0.33, 22, 12, 0, TAU, 0, Math.PI * 0.5), M.metal, 0, 0.3, 0, -0.1); put(head, G.torus(0.33, 0.03), M.metal, 0, 0.3, 0.02, Math.PI / 2 - 0.1); put(head, G.box(0.045, 0.2, 0.04), M.metal, 0, 0.3, 0.33); }

  // Accessoire
  if (extra === 1) { for (const s of [1, -1]) put(head, G.torus(0.07, 0.012), M.pupil, s * 0.105, 0.31, 0.3); put(head, G.box(0.06, 0.012, 0.012), M.pupil, 0, 0.32, 0.31); }
  if (extra === 2) for (const s of [1, -1]) put(head, G.sphere(0.06, 12, 8), M.hair, s * 0.06, 0.17, 0.28, 0, 0, s * 0.35, 1.5, 0.55, 0.6);
  if (extra === 3) put(head, G.sphere(0.24, 20, 12, 0, TAU, Math.PI * 0.55, Math.PI * 0.45), M.hair, 0, 0.21, 0.04, 0.25, 0, 0, 1, 1.15, 1.02);
  if (extra === 4) { put(head, G.torus(0.15, 0.05), M.accent, 0, -0.01, 0, Math.PI / 2); put(head, G.cone(0.07, 0.16, 8), M.accent, 0.05, -0.08, 0.15, 0.4, 0, 0.3); }
  if (extra === 5) put(head, G.torus(0.3, 0.008), M.pupil, 0, 0.36, 0, Math.PI / 2 - 0.25, 0, -0.25);
  merge(head, outlined, outlines);

  // Anneau à sa couleur sous les pieds, et cylindre invisible pour viser le personnage
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.085; root.add(ring);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9; root.add(hit);

  const mats = new Set();
  root.traverse(o => { if (o.isMesh && o.material !== OUTLINE && o !== ring && o !== hit) mats.add(o.material); });
  for (const m of mats) m.userData.opacity = m.opacity;
  return {
    root, body, torso, head, legs, arms, eyes, closed, pupils, brows, mouths, M, mats, ring, hit, outlines,
    cur: {}, walkPh: 0, emote: null, hitAt: -9, hitItem: null, blinkAt: 1 + Math.random() * 3, talkUntil: 0, ghost: false, splats: [], fxAt: 0, starAt: 0,
  };
}

// Fantôme (mort) : translucide, bleuté, sans contour ni ombre.
export function setGhost(ch, on) {
  if (ch.ghost === on) return;
  ch.ghost = on;
  for (const m of ch.mats) {
    m.transparent = on || m.userData.opacity < 1;
    m.opacity = on ? 0.38 * (m.userData.opacity ?? 1) : m.userData.opacity;
    m.depthWrite = !on && m.userData.opacity === 1;
    if (m.emissive) { m.emissive.set(on ? '#7fa8ff' : '#000000'); m.emissiveIntensity = on ? 0.5 : 1; }
    m.needsUpdate = true;
  }
  for (const o of ch.outlines) o.visible = !on;
  ch.root.traverse(o => { if (o.isMesh) o.castShadow = !on && !o.material.transparent; });
  ch.ring.visible = !on;
}

/* ---------------- Emotes ---------------- */
// Chaque emote modifie la pose P selon le temps u (secondes) depuis son début.
const S = Math.sin, A = Math.abs;
const EMO = {
  rire(P, u) { P.trx = -0.22 - 0.08 * A(S(u * 15)); P.hrx = -0.4; P.by += 0.035 * A(S(u * 15)); P.aLx = P.aRx = -0.5; P.aLz = -0.4; P.aRz = 0.4; P.mouth = 'laugh'; P.eyes = 'closed'; P.brow = -0.15; },
  applaudir(P, u) { const s = A(S(u * 13)); P.aLx = P.aRx = -1.25; P.aLz = -0.45 - 0.4 * s; P.aRz = 0.45 + 0.4 * s; P.mouth = 'laugh'; P.hrx = -0.12; },
  pleurer(P, u) { P.hrx = 0.35; P.aLx = P.aRx = -2.45; P.aLz = -0.6; P.aRz = 0.6; P.mouth = 'sad'; P.eyes = 'closed'; P.brow = -0.4; P.brz = 0.035 * S(u * 32); },
  pointer(P, u) { P.aRx = -1.55; P.aRz = 0.08; P.fR = true; P.aLx = 0.25; P.aLz = 0.6; P.brow = 0.38; P.trx = 0.12; P.mouth = S(u * 10) > 0 ? 'open' : 'smile'; },
  danser(P, u, seated) { const b = S(u * 8); P.by += A(b) * 0.1; P.brz = S(u * 4) * 0.15; P.aLx = -2.6 + b * 0.5; P.aRx = -2.6 - b * 0.5; P.aLz = 0.45; P.aRz = -0.45; P.hrz = S(u * 4) * 0.2; P.mouth = 'laugh'; if (!seated) { P.lLx = Math.max(0, b) * -0.7; P.lRx = Math.max(0, -b) * -0.7; } },
  doigt(P) { P.aRx = -2.75; P.aRz = -0.12; P.fR = true; P.trx = -0.12; P.aLx = 0.2; P.aLz = 0.6; P.mouth = 'smile'; P.brow = 0.25; P.hrz = 0.12; },
  tomber(P, u, seated, dur) {
    const f = Math.min(1, u / 0.35) * Math.min(1, Math.max(0, (dur - u) / 0.7));
    P.brx = -1.45 * f; P.by -= (seated ? 0.12 : 0.3) * f; P.lLx = P.lRx = -1.5 * f + S(u * 14) * 0.4 * f; P.kL = P.kR = 0.3 * f;
    P.aLz = 1.4 * f; P.aRz = -1.4 * f; P.mouth = 'o'; P.brow = -0.3 * f; P.eyes = u > 0.3 && u < 1.2 ? 'closed' : 'open';
  },
  coucou(P, u) { P.aRz = -2.55 + 0.4 * S(u * 12); P.aRx = -0.15; P.mouth = 'laugh'; P.hrz = 0.15; },
  colere(P, u, seated) { P.brow = 0.5; P.mouth = 'open'; P.aLz = 0.35; P.aRz = -0.35; P.aLx = P.aRx = 0.4; P.trx = 0.15; P.by += 0.025 * A(S(u * 11)); if (!seated) P.lLx = -0.5 * Math.max(0, S(u * 11)); },
  bisou(P, u) { P.trx = 0.15; P.aRx = u < 0.6 ? -2.4 : -1.3; P.aRz = 0.25; P.mouth = 'o'; P.eyes = 'closed'; },
  lancer(P, u) { if (u < 0.22) { P.aRx = 1.0; P.try_ = 0.35; } else { P.aRx = -2.1; P.try_ = -0.25; } P.mouth = 'open'; P.brow = 0.2; },
};
export const EMOTE_MS = { ...Object.fromEntries(Object.entries(LG.EMOTES).map(([k, e]) => [k, e.ms])), lancer: 700 };

export function play(ch, name, t, target = null) { ch.emote = { name, t0: t, dur: EMOTE_MS[name] / 1000, target }; ch.fxAt = 0; }
export function hitBy(ch, item, t) { ch.hitAt = t; ch.hitItem = item; }

/* ---------------- Animation, à chaque image ---------------- */
// s : { moving (vitesse), seated, talking, aim (angle vers la cible pendant une emote) } ; spawn(kind, pos, opts) : effets.
const v3 = new THREE.Vector3();
export function animate(ch, dt, t, s, spawn) {
  const P = { by: 0, brx: 0, brz: 0, trx: 0, try_: 0, hrx: 0, hry: 0, hrz: 0, aLx: 0, aLz: 0.12, aRx: 0, aRz: -0.12, lLx: 0, lRx: 0, kL: 0, kR: 0, fL: false, fR: false, mouth: 'smile', brow: 0, eyes: 'open' };
  if (ch.ghost) {
    P.by = 0.28 + S(t * 2 + ch.walkPh) * 0.08; P.aLx = P.aRx = -1.1; P.aLz = -0.1; P.aRz = 0.1; P.lLx = P.lRx = -0.3; P.kL = P.kR = 0.6; P.mouth = 'o'; P.brow = -0.25; P.hrz = S(t * 1.3) * 0.12;
  } else if (s.seated) {
    P.by = -0.08; P.lLx = P.lRx = -1.45; P.kL = P.kR = 1.45; P.aLx = P.aRx = -0.35; P.aLz = 0.05; P.aRz = -0.05;
    P.hry = S(t * 0.4 + ch.walkPh) * 0.25; P.trx = 0.05 + S(t * 1.7) * 0.015;
  } else if (s.moving > 0.2) {
    ch.walkPh += dt * (4 + s.moving * 1.6);
    const w = S(ch.walkPh), k = Math.min(1, s.moving / 3);
    P.lLx = -w * 0.75 * k; P.lRx = w * 0.75 * k; P.kL = Math.max(0, w) * 1.0 * k; P.kR = Math.max(0, -w) * 1.0 * k;
    P.aLx = w * 0.6 * k; P.aRx = -w * 0.6 * k; P.by = A(Math.cos(ch.walkPh)) * 0.06 * k; P.try_ = w * 0.12 * k; P.trx = 0.08 * k;
  } else {
    P.trx = S(t * 1.8 + ch.walkPh) * 0.02; P.hry = S(t * 0.5 + ch.walkPh) * 0.3; P.hrz = S(t * 0.7) * 0.04;
  }
  // Emote en cours
  const e = ch.emote;
  if (e) {
    const u = t - e.t0;
    if (u > e.dur) ch.emote = null;
    else if (!ch.ghost) {
      EMO[e.name]?.(P, u, s.seated, e.dur);
      // effets qui accompagnent l'emote
      if (u > ch.fxAt) {
        if (e.name === 'pleurer') { ch.fxAt = u + 0.07; for (const sd of [1, -1]) spawn('drop', ch.head.localToWorld(v3.set(sd * 0.12, 0.28, 0.28)), { vx: sd * 1.2 }); }
        else if (e.name === 'colere') { ch.fxAt = u + 0.13; spawn('puff', ch.head.localToWorld(v3.set((Math.random() - 0.5) * 0.3, 0.6, 0)), { grey: true }); }
        else if (e.name === 'bisou' && u > 0.6) { ch.fxAt = 99; for (let k = 0; k < 3; k++) spawn('heart', ch.head.localToWorld(v3.set(0, 0.15, 0.4)), { k }); }
        else if (e.name === 'rire' || e.name === 'danser') { ch.fxAt = u + 0.5; spawn('note', ch.head.localToWorld(v3.set(0, 0.7, 0)), { laugh: e.name === 'rire' }); }
        else if (e.name === 'tomber' && u > 0.35) { ch.fxAt = 99; spawn('dust', ch.root.position, {}); }
        else ch.fxAt = 99;
      }
    }
  }
  // Touché par un objet : la tête part en arrière, les yeux se ferment
  const h = t - ch.hitAt;
  if (h < 0.7 && !ch.ghost) {
    const k = 1 - h / 0.7;
    P.hrx -= 0.6 * k; P.brx -= 0.25 * k; P.mouth = 'o'; P.brow = -0.35; if (h < 0.3) P.eyes = 'closed';
  }
  if (ch.hitItem === 'chaussure' && h < 2.2 && !ch.ghost && t > ch.starAt) { ch.starAt = t + 0.18; spawn('star', ch.head.localToWorld(v3.set(0, 0.68, 0)), { a: t * 6 }); }
  if (ch.hitItem === 'rose' && h < 1.5 && !ch.ghost) { P.mouth = 'smile'; P.eyes = 'closed'; P.brow = -0.2; }
  // Parler : la bouche s'ouvre et se ferme
  if (t < ch.talkUntil && !e && h > 0.7) P.mouth = S(t * 22) > 0 ? 'open' : 'smile';
  // Clignement
  if (t > ch.blinkAt) { if (t > ch.blinkAt + 0.13) ch.blinkAt = t + 2 + Math.random() * 3.5; else P.eyes = 'closed'; }

  // Lissage vers la pose voulue
  const f = 1 - Math.exp(-dt * 14), c = ch.cur;
  for (const k in P) if (typeof P[k] === 'number') c[k] = c[k] === undefined ? P[k] : c[k] + (P[k] - c[k]) * f;
  ch.body.position.y = 0.46 + c.by; ch.body.rotation.set(c.brx, 0, c.brz);
  ch.torso.rotation.set(c.trx, c.try_, 0); ch.head.rotation.set(c.hrx, c.hry, c.hrz);
  ch.arms[0].a.rotation.set(c.aLx, 0, c.aLz); ch.arms[1].a.rotation.set(c.aRx, 0, c.aRz);
  ch.legs[0].thigh.rotation.x = c.lLx; ch.legs[1].thigh.rotation.x = c.lRx; ch.legs[0].knee.rotation.x = c.kL; ch.legs[1].knee.rotation.x = c.kR;
  ch.arms[0].finger.visible = P.fL; ch.arms[1].finger.visible = P.fR;
  for (const [k, m] of Object.entries(ch.mouths)) m.visible = k === P.mouth;
  ch.eyes.visible = P.eyes === 'open'; ch.closed.visible = P.eyes !== 'open';
  ch.brows[0].rotation.z = c.brow; ch.brows[1].rotation.z = -c.brow; ch.brows[0].position.y = ch.brows[1].position.y = 0.42 + (c.brow < 0 ? -c.brow * 0.06 : -c.brow * 0.03);
  // Colère : le visage rougit
  if (ch.M.skin.emissive && !ch.ghost) { ch.M.skin.emissive.set('#ff2a1a'); ch.M.skin.emissiveIntensity = e?.name === 'colere' ? 0.25 : 0; }
  // Taches de tomate ou d'œuf sur le visage, qui s'effacent
  for (const sp of ch.splats) { sp.life -= dt; sp.mesh.material.opacity = Math.min(1, sp.life); }
  while (ch.splats.length && ch.splats[0].life <= 0) { const sp = ch.splats.shift(); ch.head.remove(sp.mesh); sp.mesh.material.dispose(); }
}

/* ---------------- Objets lancés ---------------- */
const splatTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.beginPath(); x.arc(64, 64, 34, 0, TAU); x.fill();
  for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU + Math.random() * 0.3, d = 34 + Math.random() * 22, r = 6 + Math.random() * 11; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); x.fill(); x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, d, a - 0.12, a + 0.12); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export function splat(ch, item) {
  if (item !== 'tomate' && item !== 'oeuf') return;
  const mat = new THREE.MeshStandardMaterial({ map: splatTex, color: item === 'tomate' ? '#d8261a' : '#ffd23a', transparent: true, roughness: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), mat);
  const a = (Math.random() - 0.5) * 0.9, y = 0.22 + Math.random() * 0.18;
  m.position.set(Math.sin(a) * 0.31, y, Math.cos(a) * 0.31); m.rotation.y = a; m.rotation.z = Math.random() * TAU;
  ch.head.add(m);
  ch.splats.push({ mesh: m, life: 4.5 });
}

export function makeItem(item) {
  const g = new THREE.Group(), std = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  if (item === 'tomate') { put(g, G.sphere(0.1), std('#e0301e', { roughness: 0.3 }), 0, 0, 0, 0, 0, 0, 1, 0.85, 1); for (let k = 0; k < 5; k++) put(g, G.cone(0.025, 0.09, 4), std('#3f8f2f'), Math.sin(k * 1.26) * 0.04, 0.085, Math.cos(k * 1.26) * 0.04, Math.cos(k * 1.26) * 1.3, 0, -Math.sin(k * 1.26) * 1.3); }
  if (item === 'oeuf') put(g, G.sphere(0.07), std('#fbf4e4', { roughness: 0.4 }), 0, 0, 0, 0, 0, 0, 1, 1.3, 1);
  if (item === 'chaussure') { put(g, G.box(0.11, 0.08, 0.24), std('#6a3f22'), 0, 0, 0.02); put(g, G.box(0.1, 0.12, 0.1), std('#6a3f22'), 0, 0.08, -0.06); put(g, G.box(0.12, 0.025, 0.26), std('#2a1a12'), 0, -0.05, 0.02); }
  if (item === 'poisson') { put(g, G.sphere(0.07), std('#8fb6c8', { metalness: 0.5, roughness: 0.3 }), 0, 0, 0, 0, 0, 0, 0.7, 1, 2.3); put(g, G.cone(0.07, 0.1, 4), std('#6f97aa'), 0, 0, -0.19, -Math.PI / 2, 0, 0, 1, 1, 0.3); put(g, G.sphere(0.014), std('#111'), 0.04, 0.02, 0.1); }
  if (item === 'chou') { put(g, G.sphere(0.12, 10, 8), std('#7cc25a', { flatShading: true }), 0, 0, 0); put(g, G.sphere(0.13, 8, 6, 0, TAU, 0, 1.3), std('#a8dc7a', { flatShading: true, side: THREE.DoubleSide }), 0, -0.02, 0, 0.4); }
  if (item === 'rose') { put(g, G.cyl(0.01, 0.01, 0.3, 6), std('#2f7a2f'), 0, -0.12, 0); put(g, G.sphere(0.05, 10, 8), std('#d81b3a'), 0, 0.05, 0, 0, 0, 0, 1, 1.2, 1); put(g, G.sphere(0.03, 6, 4), std('#3f9a3f'), 0.03, -0.1, 0, 0, 0, 0, 1.6, 0.4, 0.8); }
  if (item === 'fleche') { const s = new THREE.Group(); s.rotation.x = Math.PI / 2; g.add(s); put(s, G.cyl(0.012, 0.012, 0.7, 6), std('#8a6a48'), 0, 0, 0); put(s, G.cone(0.035, 0.1, 6), std('#c8ccd4', { metalness: 0.8, roughness: 0.3 }), 0, 0.39, 0); for (let k = 0; k < 3; k++) put(s, G.box(0.005, 0.12, 0.05), std('#e8543c'), Math.sin(k * 2.1) * 0.02, -0.3, Math.cos(k * 2.1) * 0.02, 0, k * 2.1, 0); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
