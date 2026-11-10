// Personnages du Loup-Garou : villageois sculptés pièce par pièce, habillés selon leur apparence (LG.LOOK).
// Squelette complet : bassin, buste qui se plie, cou, épaules, coudes, poignets, mains à cinq doigts articulés (on peut
// pointer, serrer le poing… ou faire un doigt d'honneur), hanches, genoux, chevilles. Visage : crâne modelé, yeux avec iris
// et pupille qui regardent autour, paupières qui clignent, cils, sourcils, nez, oreilles, lèvres, dents et langue.
// Cheveux en mèches, vêtements à plis, bottes lacées ; matières tissu (reflet doux), peau, cuir ciré, cheveux brillants.
// Animations : marche, assis, respiration, regard, parole, 10 emotes, lancer, réactions aux objets reçus, fantôme.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LG = window.LG;
const TAU = Math.PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + rnd() * (b - a);

/* ---------------- Textures (une fois pour tous) ---------------- */
function canvasTex(n, draw, srgb = true, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8;
  return t;
}
const noiseDots = (x, n, count, a, s) => { for (let i = 0; i < count; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${a})`; x.fillRect(Math.random() * n, Math.random() * n, s, s); } };
const TX = {
  weave: canvasTex(256, (x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 4) for (let k = 0; k < n; k += 4) { x.fillStyle = (y + k) % 8 ? '#a8a8a8' : '#585858'; x.fillRect(k, y, 3, 3); } noiseDots(x, n, 3000, 0.15, 1); }, false, 8),
  knit: canvasTex(128, (x, n) => { x.fillStyle = '#606060'; x.fillRect(0, 0, n, n); for (let k = 0; k < n; k += 8) for (let y = 0; y < n; y += 8) { x.fillStyle = '#c0c0c0'; x.beginPath(); x.ellipse(k + 2, y + 4, 2, 4, 0.5, 0, TAU); x.ellipse(k + 6, y + 4, 2, 4, -0.5, 0, TAU); x.fill(); } }, false, 6),
  leather: canvasTex(256, (x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.12)`; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 1 + Math.random() * 5, 0, TAU); x.fill(); } for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); const X = Math.random() * n, Y = Math.random() * n; x.moveTo(X, Y); x.lineTo(X + Math.random() * 40 - 20, Y + Math.random() * 40 - 20); x.stroke(); } }, false, 3),
  skin: canvasTex(256, (x, n) => { x.fillStyle = '#808080'; x.fillRect(0, 0, n, n); noiseDots(x, n, 9000, 0.08, 1); }, false, 4),
  hair: canvasTex(256, (x, n) => { x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, n, n); for (let i = 0; i < 1400; i++) { const X = Math.random() * n, l = Math.random(); x.strokeStyle = `rgba(${l < 0.5 ? '40,40,40' : '255,255,255'},${0.15 + Math.random() * 0.35})`; x.lineWidth = 0.8 + Math.random() * 1.4; x.beginPath(); x.moveTo(X, 0); x.lineTo(X + Math.random() * 6 - 3, n); x.stroke(); } }, true, 1),
  straw: canvasTex(256, (x, n) => { x.fillStyle = '#d8b860'; x.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 10) for (let k = 0; k < n; k += 20) { x.fillStyle = (y / 10 + k / 20) % 2 ? '#e8cc78' : '#b8964a'; x.fillRect(k + ((y / 10) % 2) * 10, y, 18, 8); } for (let i = 0; i < 600; i++) { x.strokeStyle = 'rgba(120,90,30,.35)'; x.beginPath(); const X = Math.random() * n, Y = Math.random() * n; x.moveTo(X, Y); x.lineTo(X + 12, Y); x.stroke(); } }, true, 4),
  iris: canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 6, n / 2, n / 2, n / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#d8d8d8'); g.addColorStop(0.9, '#7a7a7a'); g.addColorStop(1, '#202020'); x.fillStyle = g; x.fillRect(0, 0, n, n); for (let k = 0; k < 90; k++) { const a = (k / 90) * TAU; x.strokeStyle = `rgba(${Math.random() < 0.4 ? '255,255,255' : '0,0,0'},${0.12 + Math.random() * 0.22})`; x.lineWidth = 1 + Math.random(); x.beginPath(); x.moveTo(n / 2 + Math.cos(a) * 14, n / 2 + Math.sin(a) * 14); x.lineTo(n / 2 + Math.cos(a) * 60, n / 2 + Math.sin(a) * 60); x.stroke(); } }),
  feather: canvasTex(256, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath(); x.moveTo(n / 2, n); x.lineTo(n / 2, 0); x.stroke(); for (let y = 6; y < n; y += 3) { const w = Math.sin((y / n) * Math.PI) * n * 0.45; x.lineWidth = 1.3; x.strokeStyle = `rgba(255,255,255,${0.7 + Math.random() * 0.3})`; for (const s of [1, -1]) { x.beginPath(); x.moveTo(n / 2, y); x.quadraticCurveTo(n / 2 + (s * w) / 2, y - 8, n / 2 + s * w, y - 18); x.stroke(); } } }),
};
const EYE_COLORS = ['#4a7ac0', '#6a4428', '#3f8a52', '#8a6a3a', '#2f5fa0', '#6f7484', '#7a5a2a'];
const PANTS = ['#5b4636', '#3f4250', '#6a5440', '#4a3a2e', '#55604a'];

/* ---------------- Formes ---------------- */
const G = {
  sphere: (r, w = 24, h = 18, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest),
  capsule: (r, l, s = 14) => new THREE.CapsuleGeometry(r, l, 6, s),
  cyl: (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
  torus: (R, r, arc = TAU, rs = 10, ts = 40) => new THREE.TorusGeometry(R, r, rs, ts, arc),
  rbox: (w, h, d, r = 0.01) => new RoundedBoxGeometry(w, h, d, 3, r),
};
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const live = m => ((m.userData.live = true), m);
// Membre effilé (capsule dont le rayon passe de r1 en haut à r2 en bas), pendu sous son pivot.
function limb(r1, r2, len, seg = 28) {
  const p = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); p.push(V2(Math.max(1e-4, Math.cos(a) * r2), -len + Math.sin(a) * r2)); }
  for (let i = 1; i <= 8; i++) { const t = i / 9; p.push(V2(r2 + (r1 - r2) * t + Math.sin(t * Math.PI) * 0.006, -len + len * t)); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); p.push(V2(Math.max(1e-4, Math.cos(a) * r1), Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(p, seg);
}
// Tissu tourné (profil r, y) avec des plis qui se creusent vers l'ourlet ; aplati devant-derrière.
function cloth(profile, { folds = 0, freq = 9, flat = 0.8, seg = 48, phi0 = 0, phiL = TAU } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => V2(r, y)), seg, phi0, phiL), p = g.attributes.position;
  const y0 = Math.max(...profile.map(q => q[1])), y1 = Math.min(...profile.map(q => q[1]));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), r = Math.hypot(x, z), t = (y0 - y) / (y0 - y1 || 1);
    const k = r > 1e-3 ? 1 + (Math.sin(a * freq + Math.sin(a * 3) * 1.5) * folds * t * t) / Math.max(r, 0.05) : 1;
    p.setXYZ(i, x * k, y, z * k * flat);
  }
  g.computeVertexNormals();
  return g;
}
// Mèche : un tube qui suit des points et s'affine vers la pointe.
function strand(points, r0, r1 = r0 * 0.25, radial = 7, segs = 12) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, segs, r0, radial, false), p = g.attributes.position;
  for (let j = 0; j <= segs; j++) { const c = curve.getPointAt(j / segs), k = 1 + (r1 / r0 - 1) * Math.pow(j / segs, 1.3); for (let i = 0; i <= radial; i++) { const n = j * (radial + 1) + i; p.setXYZ(n, c.x + (p.getX(n) - c.x) * k, c.y + (p.getY(n) - c.y) * k, c.z + (p.getZ(n) - c.z) * k); } }
  g.computeVertexNormals();
  return g;
}
// Fusionne les pièces fixes d'un même pivot (une par matière) : beaucoup moins d'objets à dessiner.
function merge(pivot) {
  const by = new Map();
  for (const m of [...pivot.children]) {
    if (!m.isMesh || m.userData.live) continue;
    m.updateMatrix();
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!by.has(m.material)) by.set(m.material, []);
    by.get(m.material).push(g);
    pivot.remove(m);
  }
  for (const [mat, list] of by) { const mesh = new THREE.Mesh(mergeGeometries(list), mat); mesh.castShadow = !mat.transparent; mesh.receiveShadow = true; pivot.add(mesh); }
}

/* ---------------- Matières d'un villageois ---------------- */
function materials(look, color) {
  const [skin, , hairC, , outfitC] = look;
  const phys = o => new THREE.MeshPhysicalMaterial({ roughness: 0.8, ...o });
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const cloth = LG.LOOK.outfitColor[outfitC], hair = LG.LOOK.hairColor[hairC], sk = LG.LOOK.skin[skin];
  const fabric = (c, k = 1) => phys({ color: shade(c, k), roughness: 0.88, sheen: 1, sheenColor: shade(c, 1.6), sheenRoughness: 0.55, bumpMap: TX.weave, bumpScale: 0.5, side: THREE.DoubleSide });
  return {
    skin: phys({ color: sk, roughness: 0.5, sheen: 0.35, sheenColor: '#ff9080', sheenRoughness: 0.45, bumpMap: TX.skin, bumpScale: 0.12, clearcoat: 0.08 }),
    skinDark: phys({ color: shade(sk, 0.72).lerp(new THREE.Color('#a04a40'), 0.15), roughness: 0.6 }),
    lip: phys({ color: new THREE.Color(sk).lerp(new THREE.Color('#b8444a'), 0.45), roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    nail: phys({ color: new THREE.Color(sk).lerp(new THREE.Color('#ffd8d0'), 0.5), roughness: 0.2, clearcoat: 0.6 }),
    cloth: fabric(cloth), trim: fabric(cloth, 0.55), shirt: fabric('#efe6d4'), pants: fabric(PANTS[(skin + outfitC) % PANTS.length]),
    leather: phys({ color: '#4e3220', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, bumpMap: TX.leather, bumpScale: 0.6 }),
    sole: phys({ color: '#24180f', roughness: 0.7 }),
    lace: phys({ color: '#c8b088', roughness: 0.9 }),
    hair: phys({ color: hair, roughness: 0.36, map: TX.hair, bumpMap: TX.hair, bumpScale: 0.6, sheen: 0.7, sheenColor: shade(hair, 2).lerp(new THREE.Color('#ffffff'), 0.2), sheenRoughness: 0.35, side: THREE.DoubleSide }),
    brow: phys({ color: shade(hair, 0.7), roughness: 0.6, bumpMap: TX.hair, bumpScale: 0.4 }),
    lash: phys({ color: '#140c08', roughness: 0.5 }),
    eye: phys({ color: '#fbf9f4', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
    iris: phys({ color: EYE_COLORS[(skin * 3 + hairC * 5 + outfitC) % EYE_COLORS.length], map: TX.iris, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 }),
    pupil: phys({ color: '#040404', roughness: 0.05, clearcoat: 1 }),
    glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    mouth: phys({ color: '#3a0e12', roughness: 0.7 }),
    teeth: phys({ color: '#f8f4e8', roughness: 0.22, clearcoat: 0.6 }),
    tongue: phys({ color: '#d8656c', roughness: 0.35, clearcoat: 0.3 }),
    cheek: new THREE.MeshBasicMaterial({ color: '#ff8a80', transparent: true, opacity: 0.28, depthWrite: false }),
    metal: phys({ color: '#b8bec8', metalness: 1, roughness: 0.26, clearcoat: 0.4 }),
    gold: phys({ color: '#e0b050', metalness: 1, roughness: 0.22 }),
    accent: phys({ color, roughness: 0.55, sheen: 0.8, sheenColor: shade(color, 1.5), bumpMap: TX.weave, bumpScale: 0.4 }),
    knit: phys({ color, roughness: 0.95, sheen: 1, sheenColor: shade(color, 1.6), bumpMap: TX.knit, bumpScale: 1.6 }),
    straw: phys({ map: TX.straw, bumpMap: TX.straw, bumpScale: 1.2, roughness: 0.9, side: THREE.DoubleSide }),
    leaf: phys({ color: '#4f8f3a', roughness: 0.6, sheen: 0.5 }),
    glass: phys({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.18, clearcoat: 1 }),
    feather: phys({ color, map: TX.feather, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, sheen: 1, sheenColor: '#ffffff' }),
    white: phys({ color: '#f6f1e6', roughness: 0.9, sheen: 0.6, bumpMap: TX.weave, bumpScale: 0.4, side: THREE.DoubleSide }),
  };
}

/* ---------------- Mains, bras, jambes ---------------- */
// Main au bout du poignet : paume tournée vers le corps (côté -side·x), pouce vers l'avant, doigts en deux phalanges.
function hand(wrist, side, M) {
  put(wrist, G.rbox(0.03, 0.082, 0.074, 0.013), M.skin, 0, -0.044, 0);
  for (const z of [0.026, 0.009, -0.009, -0.026]) put(wrist, G.sphere(0.012, 10, 8), M.skin, side * 0.004, -0.083, z);
  const fingers = [[0.026, 0.03, 0.025], [0.009, 0.034, 0.028], [-0.009, 0.032, 0.027], [-0.026, 0.025, 0.021]].map(([z, l1, l2], k) => {
    const b = grp(wrist, 0, -0.086, z), r = k === 3 ? 0.009 : 0.0105;
    put(b, G.capsule(r, l1, 10), M.skin, 0, -l1 / 2 - 0.004, 0);
    const m = grp(b, 0, -l1 - 0.01, 0);
    put(m, G.capsule(r * 0.94, l2, 10), M.skin, 0, -l2 / 2 - 0.004, 0);
    put(m, G.sphere(0.007, 8, 6), M.nail, side * 0.007, -l2 - 0.004, 0, 0, 0, 0, 0.35, 1, 0.9);
    merge(b); merge(m);
    return { b, m };
  });
  const tb = grp(wrist, -side * 0.01, -0.028, 0.034);
  put(tb, G.capsule(0.012, 0.028, 10), M.skin, 0, -0.018, 0);
  const tm = grp(tb, 0, -0.04, 0);
  put(tm, G.capsule(0.011, 0.022, 10), M.skin, 0, -0.014, 0);
  put(tm, G.sphere(0.0075, 8, 6), M.nail, 0, -0.028, 0.006, 0, 0, 0, 0.9, 1, 0.35);
  merge(tb); merge(tm);
  return { fingers, thumb: { b: tb, m: tm } };
}
// Bras : épaule (manche bouffante), coude, avant-bras et poignet de manche, main.
function arm(parent, side, M, sleeve, x = 0.19, y = 0.27) {
  const sh = grp(parent, side * x, y, 0);
  put(sh, G.sphere(0.07, 24, 18), sleeve, side * 0.006, -0.025, 0, 0, 0, 0, 1, 0.95, 1);
  put(sh, limb(0.058, 0.049, 0.25), sleeve);
  const el = grp(sh, 0, -0.25, 0);
  put(el, G.sphere(0.05, 18, 12), sleeve);
  put(el, limb(0.049, 0.043, 0.17), sleeve);
  put(el, G.torus(0.046, 0.012, TAU, 8, 32), M.trim, 0, -0.165, 0, Math.PI / 2);
  put(el, limb(0.034, 0.03, 0.06), M.skin, 0, -0.16, 0);
  merge(sh); merge(el);
  const wr = grp(el, 0, -0.215, 0);
  const h = hand(wr, side, M);
  const anchor = new THREE.Object3D(); anchor.position.set(-side * 0.035, -0.07, 0.02); wr.add(anchor);
  return { sh, el, wr, side, ...h, anchor };
}
function leg(body, side, M) {
  const hip = grp(body, side * 0.095, 0, 0);
  put(hip, limb(0.09, 0.068, 0.33), M.pants);
  const knee = grp(hip, 0, -0.33, 0);
  put(knee, G.sphere(0.066, 18, 12), M.pants);
  put(knee, limb(0.066, 0.052, 0.29), M.pants);
  const ank = grp(knee, 0, -0.3, 0);
  put(ank, G.cyl(0.063, 0.059, 0.2, 28, true), M.leather, 0, 0.085, 0);
  put(ank, G.torus(0.064, 0.013, TAU, 8, 32), M.leather, 0, 0.185, 0, Math.PI / 2);
  put(ank, G.sphere(0.064, 28, 18), M.leather, 0, -0.035, 0.055, 0, 0, 0, 1.06, 0.72, 1.85);
  put(ank, G.sphere(0.06, 20, 14), M.leather, 0, -0.02, -0.01, 0, 0, 0, 1, 0.9, 1.1);
  put(ank, G.rbox(0.108, 0.026, 0.27, 0.011), M.sole, 0, -0.074, 0.055);
  put(ank, G.rbox(0.092, 0.035, 0.075, 0.01), M.sole, 0, -0.07, -0.045);
  for (let k = 0; k < 4; k++) for (const s of [1, -1]) put(ank, G.capsule(0.0035, 0.045, 6), M.lace, 0, 0.02 + k * 0.035, 0.062, 0, 0, Math.PI / 2 + s * 0.45);
  merge(hip); merge(knee); merge(ank);
  return { hip, knee, ank };
}

/* ---------------- Tête ---------------- */
const C = V3(0, 0.22, 0); // centre du crâne (repère de la tête)
// Point sur le crâne (θ depuis le sommet, φ autour, 0 = devant), un peu au-dessus de la peau (r).
const scalp = (th, ph, r = 1.07) => V3(C.x + Math.sin(th) * Math.sin(ph) * 0.19 * r, C.y + Math.cos(th) * 0.218 * r, C.z + Math.sin(th) * Math.cos(ph) * 0.2 * r * (Math.cos(ph) < 0 ? 1.06 : 1));
function skull() {
  const g = new THREE.SphereGeometry(1, 64, 48), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { x *= 1 - 0.2 * y * y; z *= 1 - 0.05 * -y; }
    if (z > 0 && y < 0.15 && y > -0.65) x *= 1 + 0.05 * Math.cos((y + 0.25) * 4) * z;
    if (z < 0) z *= 1.06;
    if (y > 0.25 && z > 0.4) z *= 1.02;
    if (y < -0.55 && z > 0.3) z += 0.07 * (-0.55 - y);
    if (y > 0.05 && y < 0.3 && z > 0.6) z += 0.025 * Math.sin(((y - 0.05) / 0.25) * Math.PI); // arcade sourcilière
    p.setXYZ(i, x * 0.19, y * 0.218 + C.y, z * 0.2);
  }
  g.computeVertexNormals();
  return g;
}
function head(neck, look, M) {
  const [, hairStyle, , , , hat, extra] = look;
  const h = grp(neck, 0, 0, 0);
  put(h, skull(), M.skin);
  // oreilles
  for (const s of [1, -1]) { put(h, G.sphere(0.046, 24, 18), M.skin, s * 0.188, 0.222, -0.008, 0, s * 0.3, 0, 0.36, 1, 0.72); put(h, G.sphere(0.03, 18, 12), M.skinDark, s * 0.2, 0.22, 0.0, 0, s * 0.3, 0, 0.18, 0.72, 0.5); put(h, G.sphere(0.018, 12, 8), M.skin, s * 0.19, 0.18, 0.004); }
  // nez
  put(h, G.capsule(0.016, 0.05, 14), M.skin, 0, 0.238, 0.194, 0.3);
  put(h, G.sphere(0.024, 22, 16), M.skin, 0, 0.207, 0.212, 0, 0, 0, 1.08, 0.88, 1);
  for (const s of [1, -1]) { put(h, G.sphere(0.017, 16, 12), M.skin, s * 0.021, 0.198, 0.2); put(h, G.sphere(0.008, 10, 8), M.mouth, s * 0.011, 0.188, 0.212, 0, 0, 0, 0.7, 0.35, 0.6); }
  // joues roses
  for (const s of [1, -1]) put(h, new THREE.CircleGeometry(0.04, 24), M.cheek, s * 0.11, 0.185, 0.168, 0, s * 0.62, 0);
  // yeux : globe brillant, iris et pupille qui regardent autour, reflets ; paupières et cils
  const eyes = [], lids = [];
  for (const s of [1, -1]) {
    const e = grp(h, s * 0.068, 0.246, 0.15);
    if (extra === 5 && s === -1) { put(e, G.sphere(0.052, 24, 16), M.lash, 0, 0, 0.005, 0, 0, 0, 1.15, 1, 0.55); continue; } // cache-œil
    put(e, G.sphere(0.045, 32, 24), M.eye);
    const gaze = live(grp(e)); gaze.userData.live = true;
    const iris = new THREE.SphereGeometry(0.0458, 32, 10, 0, TAU, 0, 0.62); iris.rotateX(Math.PI / 2);
    const uv = iris.attributes.uv, ip = iris.attributes.position, R = 0.0458 * Math.sin(0.62);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (ip.getX(i) / R) * 0.5 + 0.5, (ip.getY(i) / R) * 0.5 + 0.5);
    put(gaze, iris, M.iris);
    const pup = new THREE.SphereGeometry(0.0462, 24, 6, 0, TAU, 0, 0.26); pup.rotateX(Math.PI / 2);
    put(gaze, pup, M.pupil);
    put(e, G.sphere(0.0065, 10, 8), M.glint, -0.012, 0.014, 0.043);
    put(e, G.sphere(0.003, 8, 6), M.glint, 0.01, -0.01, 0.045);
    const up = live(grp(e)); const lo = live(grp(e));
    put(up, G.sphere(0.0485, 32, 16, 0, TAU, 0, Math.PI / 2), M.skin);
    put(up, G.torus(0.0485, 0.0035, Math.PI, 6, 24), M.lash, 0, 0, 0, Math.PI / 2, 0, 0, 1.02, 1.02, 1.02);
    for (let k = 0; k < 3; k++) put(up, G.capsule(0.0018, 0.012, 4), M.lash, s * (0.03 + k * 0.008), 0.004, 0.036 - k * 0.012, -0.6, 0, -s * (0.9 + k * 0.2));
    put(lo, G.sphere(0.0475, 32, 10, 0, TAU, Math.PI / 2, Math.PI / 2), M.skin);
    merge(up); merge(lo);
    eyes.push({ e, gaze }); lids.push({ up, lo, s });
  }
  // sourcils (épais, en arc)
  const brows = [1, -1].map(s => { const b = live(grp(h, s * 0.07, 0.302, 0.176)); put(b, strand([V3(-s * 0.04, -0.008, 0.012), V3(-s * 0.012, 0.004, 0.006), V3(s * 0.018, 0.006, -0.002), V3(s * 0.045, -0.006, -0.016)], 0.011, 0.006, 8, 10), M.brow); return b; });
  // bouche : lèvres (sourire ou moue), intérieur, dents, langue ; un « o » pour les bisous
  const mouth = live(grp(h, 0, 0.152, 0.19));
  const lipU = grp(mouth), lipL = grp(mouth), ring = grp(mouth);
  const arc = (R, r, a) => { const g = new THREE.TorusGeometry(R, r, 10, 32, a); g.rotateZ(-Math.PI / 2 - a / 2); g.translate(0, R, 0); return g; };
  put(lipU, arc(0.05, 0.008, 2.3), M.lip);
  put(lipL, arc(0.043, 0.0098, 2.1), M.lip);
  put(ring, G.torus(0.016, 0.0085, TAU, 10, 24), M.lip);
  const inside = put(mouth, G.sphere(0.036, 24, 16), M.mouth, 0, -0.01, -0.012, 0, 0, 0, 1.25, 0.6, 0.45);
  const teeth = put(mouth, G.rbox(0.046, 0.013, 0.012, 0.005), M.teeth, 0, 0.002, 0.001);
  const tongue = put(mouth, G.sphere(0.02, 16, 10), M.tongue, 0, -0.02, -0.008, 0, 0, 0, 1.2, 0.45, 0.8);
  for (const m of [inside, teeth, tongue]) live(m);
  merge(lipU); merge(lipL); merge(ring);

  hairOn(h, hairStyle, M, hat);
  hatOn(h, hat, M);
  extraOn(h, extra, M);
  merge(h);
  return { h, eyes, lids, brows, mouth, lipU, lipL, ring, inside, teeth, tongue };
}
// Coiffures : une calotte et des dizaines de mèches qui suivent la forme du crâne.
function hairOn(h, style, M, hat) {
  if (style === 6) { // chauve : couronne de cheveux courts sur les côtés et derrière
    const band = new THREE.SphereGeometry(1, 48, 10, Math.PI * 0.85, Math.PI * 1.3, 1.25, 0.45);
    band.scale(0.195, 0.222, 0.21).translate(0, C.y, 0); put(h, band, M.hair);
    return;
  }
  const cap = new THREE.SphereGeometry(1, 56, 30, 0, TAU, 0, style === 4 ? 1.15 : 1.22);
  cap.scale(0.198, 0.224, 0.21); cap.rotateX(style === 2 ? -0.5 : -0.42); cap.translate(0, C.y + 0.004, -0.004);
  put(h, cap, M.hair);
  const clump = (ph, th0, th1, r0 = 0.017, lift = 1.07, drop = 0, spread = 0.15) => {
    const pts = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(scalp(th0 + (th1 - th0) * t, ph + Math.sin(t * 2) * spread * 0.3, lift + Math.sin(t * Math.PI) * 0.04)); }
    if (drop) { const e = pts.at(-1), out = V3(Math.sin(ph), 0, Math.cos(ph)).multiplyScalar(0.02); pts.push(e.clone().add(out).add(V3(0, -drop * 0.5, 0)), e.clone().add(out.multiplyScalar(1.5)).add(V3(0, -drop, -0.01))); }
    put(h, strand(pts, r0, r0 * 0.25), M.hair);
  };
  if (style === 0 || style === 1) for (let k = 0; k < 64; k++) { const ph = (k / 64) * TAU + between(-0.05, 0.05); clump(ph, between(0.05, 0.3), 1.0 + (1 - Math.cos(ph)) * 0.32 + between(-0.05, 0.05), 0.016, 1.06); }
  if (style === 1) for (let k = 0; k < 12; k++) { const ph = between(-0.6, 0.4); const pts = [scalp(0.25, ph + 0.2), scalp(0.6, ph + 0.35, 1.13), scalp(0.95, 0.55 + k * 0.03, 1.15), scalp(1.18, 0.75 + k * 0.025, 1.12)]; put(h, strand(pts, 0.021, 0.005), M.hair); }
  if (style === 2) for (let k = 0; k < 90; k++) { const ph = (k / 90) * TAU; if (Math.cos(ph) > 0.82) continue; const side = Math.sign(Math.sin(ph)) || 1, ph1 = Math.cos(ph) > 0.3 ? ph + side * 0.5 : ph; const pts = []; for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(scalp(0.12 + 1.35 * t, side * 0.05 + (ph1 - side * 0.05) * t, 1.07 + Math.sin(t * Math.PI) * 0.05)); } const e = pts.at(-1), out = V3(Math.sin(ph1), 0, Math.cos(ph1) * 0.6); pts.push(e.clone().add(out.clone().multiplyScalar(0.03)).add(V3(0, -0.14, 0)), e.clone().add(out.clone().multiplyScalar(0.05)).add(V3(0, -0.3 - between(0, 0.06), -0.02))); put(h, strand(pts, 0.027, 0.006, 8, 16), M.hair); }
  if (style === 3) { const bun = V3(0, 0.37, -0.13); for (let k = 0; k < 48; k++) { const ph = (k / 48) * TAU, s0 = scalp(1.25 - Math.cos(ph) * 0.25, ph, 1.05); put(h, strand([s0, s0.clone().lerp(bun, 0.4).add(V3(0, 0.02, 0)).multiplyScalar(1), scalp(0.6, Math.PI, 1.1), bun], 0.014, 0.006), M.hair); } put(h, G.sphere(0.065, 24, 18), M.hair, bun.x, bun.y, bun.z); for (let k = 0; k < 10; k++) put(h, G.torus(0.05, 0.016, TAU, 8, 24), M.hair, bun.x, bun.y + between(-0.02, 0.02), bun.z, between(0, Math.PI), between(0, Math.PI), 0); put(h, G.cyl(0.005, 0.005, 0.2, 8), M.gold, bun.x, bun.y + 0.02, bun.z, 0, 0, 1.2); put(h, G.sphere(0.012, 10, 8), M.accent, bun.x + 0.09, bun.y + 0.06, bun.z); }
  if (style === 4) for (let k = 0; k < 28; k++) { const th = hat ? between(0.95, 1.25) : between(0.05, 1.0), ph = rnd() * TAU, a = scalp(th, ph, 1.0), n = a.clone().sub(C).normalize(); put(h, strand([a, a.clone().add(n.clone().multiplyScalar(0.06)).add(V3(0, 0.02, 0)), a.clone().add(n.clone().multiplyScalar(0.13)).add(V3(0, 0.05, -0.02))], 0.022, 0.002, 7, 8), M.hair); }
  if (style === 5) {
    for (let k = 0; k < 56; k++) { const ph = (k / 56) * TAU; if (Math.cos(ph) > 0.85) continue; clump(ph, 0.1, 1.35 + (1 - Math.cos(ph)) * 0.12, 0.015, 1.06); }
    for (const s of [1, -1]) {
      for (let k = 0; k < 9; k++) { const t = k / 8; put(h, G.sphere(0.03 - t * 0.008, 16, 12), M.hair, s * (0.17 + t * 0.02), 0.15 - t * 0.34, -0.05 + t * 0.06, (k % 2 ? 0.5 : -0.5), 0, s * 0.2, 1, 1.35, 1); }
      const tip = V3(s * 0.19, -0.2, 0.01);
      for (const k of [1, -1]) put(h, G.sphere(0.022, 14, 10), M.accent, tip.x + k * 0.025, tip.y, tip.z, 0, 0, k * 0.6, 1.4, 0.7, 0.6);
      put(h, G.sphere(0.012, 10, 8), M.accent, tip.x, tip.y, tip.z);
    }
  }
}
function hatOn(h, hat, M) {
  if (hat === 1) { // chapeau de paille
    const g = grp(h, 0, 0.39, -0.01); g.rotation.x = -0.12;
    put(g, new THREE.LatheGeometry([[0.12, 0.004], [0.24, 0.0], [0.33, -0.018], [0.36, -0.035], [0.355, -0.042], [0.32, -0.026], [0.24, -0.012], [0.12, -0.008]].map(([r, y]) => V2(r, y)), 64), M.straw);
    put(g, new THREE.LatheGeometry([[0.165, 0], [0.162, 0.08], [0.15, 0.13], [0.11, 0.155], [0, 0.16]].map(([r, y]) => V2(r, y)), 48), M.straw);
    put(g, G.cyl(0.167, 0.168, 0.035, 48, true), M.accent, 0, 0.022, 0);
    return;
  }
  if (hat === 2) { // capuche
    const hood = new THREE.SphereGeometry(1, 48, 32, Math.PI / 2 + 0.95, TAU - 1.9, 0, 2.25); hood.scale(0.235, 0.255, 0.245); hood.translate(0, C.y + 0.01, -0.01);
    put(h, hood, M.trim); put(h, strand([scalp(1.6, Math.PI, 1.25), V3(0, 0.12, -0.3), V3(0, 0.0, -0.36)], 0.05, 0.005, 10, 10), M.trim);
    return;
  }
  if (hat === 3) { // couronne de fleurs
    const g = grp(h, 0, 0.37, -0.01); g.rotation.x = -0.18;
    put(g, G.torus(0.19, 0.012, TAU, 8, 64), M.leaf, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k < 22; k++) { const a = (k / 22) * TAU; put(g, G.sphere(0.024, 10, 8), M.leaf, Math.sin(a) * 0.195, 0.005, Math.cos(a) * 0.195, 0.4, a, 0.6, 0.45, 0.2, 1); }
    const cols = ['#ff6f91', '#ffd23f', '#ffffff', '#9b7bff', '#ff8a3d', '#ff6f91', '#ffffff', '#ffd23f'];
    cols.forEach((c, k) => { const a = (k / cols.length) * TAU + 0.2, f = grp(g, Math.sin(a) * 0.2, 0.015, Math.cos(a) * 0.2), pm = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 1 }); f.rotation.set(-0.6, a, 0); for (let i = 0; i < 5; i++) { const b = (i / 5) * TAU; put(f, G.sphere(0.017, 10, 8), pm, Math.sin(b) * 0.017, 0, Math.cos(b) * 0.017, 0, b, 0, 0.75, 0.3, 1); } put(f, G.sphere(0.008, 8, 6), M.gold, 0, 0.004, 0); });
    return;
  }
  if (hat === 4) { // bonnet tricoté à pompon
    const dome = new THREE.LatheGeometry([[0.218, 0], [0.22, 0.05], [0.2, 0.12], [0.15, 0.19], [0.08, 0.22], [0, 0.23]].map(([r, y]) => V2(r, y)), 64), p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + Math.sin(a * 32) * 0.012; p.setX(i, x * k); p.setZ(i, z * k); }
    dome.computeVertexNormals();
    const g = grp(h, 0, 0.29, -0.012); g.rotation.x = -0.18;
    put(g, dome, M.knit); put(g, G.torus(0.215, 0.034, TAU, 12, 64), M.knit, 0, 0.01, 0, Math.PI / 2);
    const pom = new THREE.SphereGeometry(0.065, 40, 30), pp = pom.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), k = 1 + Math.sin(x * 160) * Math.sin(y * 170) * Math.sin(z * 150) * 0.07; pp.setXYZ(i, x * k, y * k, z * k); } pom.computeVertexNormals();
    put(g, pom, M.white, 0, 0.26, 0);
    return;
  }
  if (hat === 5) { // chapeau à plume
    const g = grp(h, 0, 0.39, -0.01); g.rotation.set(-0.1, 0, 0.12);
    const brim = new THREE.CylinderGeometry(0.34, 0.34, 0.012, 64, 1), bp = brim.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setY(i, bp.getY(i) + Math.max(0, x - 0.1) * 0.5); } brim.computeVertexNormals();
    put(g, brim, M.trim);
    put(g, new THREE.LatheGeometry([[0.17, 0], [0.165, 0.09], [0.15, 0.14], [0.08, 0.17], [0, 0.175]].map(([r, y]) => V2(r, y)), 48), M.trim);
    put(g, G.cyl(0.172, 0.172, 0.03, 48, true), M.gold, 0, 0.025, 0);
    const fg = new THREE.PlaneGeometry(0.1, 0.42, 1, 10), fp = fg.attributes.position; for (let i = 0; i < fp.count; i++) { const y = fp.getY(i) + 0.21; fp.setY(i, y); fp.setZ(i, -y * y * 0.6); } fg.computeVertexNormals();
    put(g, fg, M.feather, -0.12, 0.08, -0.08, 0.3, 0.6, 0.9);
    return;
  }
  if (hat === 6) { // casque
    const g = grp(h, 0, 0.27, 0);
    put(g, new THREE.LatheGeometry([[0.225, 0], [0.228, 0.06], [0.21, 0.13], [0.15, 0.2], [0.07, 0.235], [0, 0.24]].map(([r, y]) => V2(r, y)), 64), M.metal);
    put(g, new THREE.LatheGeometry([[0.222, 0.005], [0.33, -0.03], [0.335, -0.04], [0.225, -0.008]].map(([r, y]) => V2(r, y)), 64), M.metal);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; put(g, G.sphere(0.008, 8, 6), M.metal, Math.sin(a) * 0.228, 0.03, Math.cos(a) * 0.228); }
    put(g, G.torus(0.2, 0.006, Math.PI, 6, 32), M.leather, 0, -0.12, 0.02, 0, Math.PI / 2, Math.PI);
  }
}
function extraOn(h, extra, M) {
  if (extra === 1) { // lunettes
    for (const s of [1, -1]) { put(h, G.torus(0.035, 0.0035, TAU, 8, 40), M.gold, s * 0.068, 0.246, 0.205); put(h, new THREE.CircleGeometry(0.034, 32), M.glass, s * 0.068, 0.246, 0.204); put(h, strand([V3(s * 0.103, 0.25, 0.2), V3(s * 0.17, 0.252, 0.12), V3(s * 0.19, 0.24, 0.0)], 0.003, 0.003, 5, 6), M.gold); }
    put(h, strand([V3(-0.034, 0.25, 0.207), V3(0, 0.258, 0.214), V3(0.034, 0.25, 0.207)], 0.003, 0.003, 5, 6), M.gold);
  }
  if (extra === 2 || extra === 3) for (const s of [1, -1]) put(h, strand([V3(s * 0.006, 0.18, 0.212), V3(s * 0.035, 0.172, 0.206), V3(s * 0.07, 0.172, 0.185), V3(s * 0.088, 0.195, 0.17)], 0.013, 0.003, 8, 12), M.hair);
  if (extra === 3) { // barbe
    const b = new THREE.SphereGeometry(1, 48, 20, Math.PI / 2 - 1.5, 3.0, 1.95, 1.0); b.scale(0.2, 0.235, 0.215); b.translate(0, C.y, 0.008); put(h, b, M.hair);
    for (let k = 0; k < 46; k++) { const a = between(-1.35, 1.35), base = V3(Math.sin(a) * 0.165, 0.07 + Math.abs(a) * 0.06 + between(-0.02, 0.02), Math.cos(a) * 0.155); put(h, strand([base, base.clone().add(V3(Math.sin(a) * 0.01, -0.035, 0.018)), base.clone().add(V3(Math.sin(a) * 0.015, -0.06 - between(0, 0.03) * (1 - Math.abs(a) / 1.4), 0.012))], 0.03, 0.008, 8, 8), M.hair); }
  }
  if (extra === 5) put(h, G.torus(0.21, 0.004, TAU, 6, 48), M.lash, 0, 0.25, 0, Math.PI / 2 - 0.3, 0, -0.25);
}

/* ---------------- Un villageois entier ---------------- */
export function makeCharacter(look, color) {
  seed = 1 + look.reduce((a, v, k) => a * 7 + v * (k + 3), 11) % 100000;
  const [, , , outfit] = look, M = materials(look, color);
  const sleeve = outfit === 4 ? M.shirt : M.cloth;
  const root = new THREE.Group();
  const body = grp(root, 0, 0.72, 0); // pivot aux hanches
  const pelvis = grp(body);
  const legs = [1, -1].map(s => leg(pelvis, s, M));
  // bassin, jupe de la tunique (ou robe longue), ceinture, bourse
  put(pelvis, G.sphere(0.17, 32, 20), M.pants, 0, -0.03, 0, 0, 0, 0, 1, 0.7, 0.8);
  const robe = outfit === 1;
  put(pelvis, cloth(robe ? [[0.32, -0.66], [0.29, -0.45], [0.24, -0.2], [0.2, 0], [0.175, 0.1], [0.172, 0.22]] : [[0.215, -0.24], [0.205, -0.12], [0.186, 0], [0.172, 0.1], [0.172, 0.22]], { folds: robe ? 0.02 : 0.01, freq: robe ? 11 : 9 }), M.cloth);
  put(pelvis, G.torus(robe ? 0.3 : 0.205, 0.012, TAU, 8, 64), M.trim, 0, robe ? -0.655 : -0.235, 0, Math.PI / 2, 0, 0, 1, robe ? 0.82 : 0.8, 1);
  put(pelvis, G.torus(0.176, 0.024, TAU, 10, 64), M.leather, 0, 0.07, 0, Math.PI / 2, 0, 0, 1, 0.8, 0.7);
  put(pelvis, G.rbox(0.06, 0.05, 0.02, 0.006), M.gold, 0, 0.07, 0.146);
  put(pelvis, G.rbox(0.03, 0.03, 0.024, 0.004), M.leather, 0, 0.07, 0.15);
  put(pelvis, G.rbox(0.07, 0.08, 0.04, 0.015), M.leather, 0.15, 0.0, 0.07, 0, 0.6, 0.05);
  put(pelvis, G.rbox(0.072, 0.035, 0.044, 0.012), M.leather, 0.15, 0.035, 0.07, 0.2, 0.6, 0.05);
  if (outfit === 3) { // tablier
    const ap = new THREE.PlaneGeometry(0.3, 0.4, 8, 12), ap2 = ap.attributes.position; for (let i = 0; i < ap2.count; i++) { const x = ap2.getX(i), y = ap2.getY(i); ap2.setZ(i, Math.cos(x * 5) * 0.03 + Math.sin(x * 30 + y * 4) * 0.004); } ap.computeVertexNormals();
    put(pelvis, ap, M.white, 0, -0.1, 0.17, -0.06);
    put(pelvis, G.rbox(0.14, 0.08, 0.01, 0.004), M.white, 0, -0.14, 0.2, -0.06);
  }
  // buste
  const chest = grp(pelvis, 0, 0.18, 0);
  put(chest, cloth([[0.17, -0.06], [0.186, 0.06], [0.196, 0.17], [0.19, 0.25], [0.165, 0.3], [0.11, 0.335], [0.06, 0.348]], { folds: 0.004, freq: 7, flat: 0.78 }), outfit === 4 ? M.shirt : M.cloth);
  put(chest, G.torus(0.06, 0.016, TAU, 10, 40), M.trim, 0, 0.345, 0, Math.PI / 2, 0, 0, 1, 0.8, 1);
  put(chest, strand([V3(-0.022, 0.33, 0.135), V3(0.02, 0.3, 0.145), V3(-0.02, 0.27, 0.152), V3(0.02, 0.24, 0.155), V3(-0.015, 0.2, 0.155)], 0.0035, 0.003, 5, 30), M.lace);
  if (outfit === 4) { // gilet ouvert avec boutons
    put(chest, cloth([[0.2, -0.04], [0.205, 0.08], [0.205, 0.18], [0.19, 0.26], [0.16, 0.31]], { flat: 0.8, phi0: 0.5, phiL: TAU - 1.0 }), M.cloth);
    for (let k = 0; k < 4; k++) put(chest, G.sphere(0.011, 10, 8), M.gold, 0.062, 0.02 + k * 0.065, 0.152);
  } else for (let k = 0; k < 3; k++) put(chest, G.sphere(0.01, 10, 8), M.gold, 0, 0.04 + k * 0.05, 0.157);
  if (outfit === 2) { // cape
    const cp = new THREE.CylinderGeometry(0.22, 0.34, 0.85, 48, 12, true, Math.PI * 0.6, Math.PI * 0.8), pp = cp.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), y = pp.getY(i), a = Math.atan2(x, z), t = (0.425 - y) / 0.85, k = 1 + Math.sin(a * 10) * 0.05 * t; pp.setXYZ(i, x * k, y, z * k * 0.85); }
    cp.computeVertexNormals();
    put(chest, cp, M.trim, 0, -0.1, -0.01);
    put(chest, G.torus(0.2, 0.025, Math.PI * 0.8, 8, 32), M.trim, 0, 0.32, -0.02, Math.PI / 2, 0, Math.PI * 0.1);
    put(chest, G.sphere(0.022, 16, 12), M.gold, 0, 0.32, 0.14, 0, 0, 0, 1, 1, 0.5);
  }
  if (look[5] === 2) put(chest, cloth([[0.25, 0.2], [0.2, 0.28], [0.12, 0.34], [0.07, 0.37]], { flat: 0.85, folds: 0.006 }), M.trim); // col de la capuche
  if (look[6] === 4) { put(chest, G.torus(0.075, 0.03, TAU, 10, 40), M.accent, 0, 0.345, 0.01, Math.PI / 2 - 0.15); put(chest, G.cyl(0.002, 0.07, 0.14, 3), M.accent, 0, 0.27, 0.12, 0.25, 0, 0, 1, 1, 0.3); put(chest, G.sphere(0.024, 12, 10), M.accent, 0, 0.33, 0.1); }
  put(chest, G.cyl(0.062, 0.07, 0.12, 32), M.skin, 0, 0.36, 0);
  merge(pelvis); merge(chest);
  const arms = [1, -1].map(s => arm(chest, s, M, sleeve));
  const neck = grp(chest, 0, 0.37, 0);
  const H = head(neck, look, M);
  // anneau à sa couleur, cylindre invisible pour viser, repères (au-dessus de la tête, visage, main droite)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.47, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.085; root.add(ring);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9; root.add(hit);
  const top = new THREE.Object3D(); top.position.set(0, 0.62, 0); H.h.add(top);
  const face = new THREE.Object3D(); face.position.set(0, 0.2, 0.19); H.h.add(face);
  const mats = new Set();
  root.traverse(o => { if (o.isMesh && o !== ring && o !== hit) mats.add(o.material); });
  for (const m of mats) m.userData.opacity = m.opacity;
  return {
    root, body, pelvis, chest, neck, head: H.h, H, arms, legs, M, mats, ring, hit, anchors: { top, face, handR: arms[1].anchor },
    cur: {}, curF: [[], []], walkPh: rnd() * 10, emote: null, hitAt: -9, hitItem: null, blinkAt: 1 + rnd() * 3, lookAt: 0, look: [0, 0], talkUntil: 0, ghost: false, splats: [], fxAt: 0, starAt: 0, gest: 0,
  };
}

// Bras droit vu à la première personne (pour lancer) : mêmes matières que mon villageois.
export function makeFPArm(look, color) {
  const M = materials(look, color), g = new THREE.Group();
  const a = arm(g, -1, M, look[3] === 4 ? M.shirt : M.cloth, 0, 0);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return { group: g, arm: a };
}

// Fantôme (mort) : translucide, bleuté, sans ombre.
export function setGhost(ch, on) {
  if (ch.ghost === on) return;
  ch.ghost = on;
  for (const m of ch.mats) {
    m.transparent = on || m.userData.opacity < 1;
    m.opacity = on ? 0.36 * (m.userData.opacity ?? 1) : m.userData.opacity;
    m.depthWrite = !on && m.userData.opacity === 1;
    if (m.emissive) { m.emissive.set(on ? '#7fa8ff' : '#000000'); m.emissiveIntensity = on ? 0.6 : 1; }
    m.needsUpdate = true;
  }
  ch.root.traverse(o => { if (o.isMesh) o.castShadow = !on && !o.material.transparent; });
  ch.ring.visible = !on;
}

/* ---------------- Poses ---------------- */
// Doigts : [pouce, index, majeur, annulaire, auriculaire], 0 tendu, 1 replié.
const HANDS = { relax: [0.3, 0.3, 0.35, 0.4, 0.45], open: [0.05, 0.02, 0.02, 0.04, 0.06], fist: [0.9, 1, 1, 1, 1], point: [0.7, 0, 1, 1, 1], bird: [1, 1, 0, 1, 1], pinch: [0.5, 0.45, 0.5, 0.6, 0.7] };
const S = Math.sin, A = Math.abs;
const EMO = {
  rire(P, u) { const k = A(S(u * 15)); P.cx = -0.22 - 0.06 * k; P.hx = -0.32; P.by += 0.02 * k; P.sLx = P.sRx = -0.4; P.sLz = -0.3; P.sRz = 0.3; P.eL = P.eR = 1.75; P.fL = P.fR = HANDS.relax; P.smile = 1; P.open = 0.65 + 0.25 * k; P.lid = 0.25; P.low = 0.7; P.browL = P.browR = 0.3; },
  applaudir(P, u) { const s = A(S(u * 13)); P.sLx = P.sRx = -1.0; P.eL = P.eR = 1.05; P.sLz = -0.3 - 0.28 * s; P.sRz = 0.3 + 0.28 * s; P.fL = P.fR = HANDS.open; P.smile = 0.9; P.open = 0.45; P.browL = P.browR = 0.35; P.low = 0.3; },
  pleurer(P, u) { P.hx = 0.38; P.sLx = P.sRx = -1.25; P.eL = P.eR = 2.25; P.sLz = -0.32; P.sRz = 0.32; P.fL = P.fR = HANDS.relax; P.smile = -0.9; P.open = 0.45; P.lid = 0.12; P.browA = -0.8; P.brz = 0.03 * S(u * 32); },
  pointer(P, u) { P.sRx = -1.55; P.sRz = 0.04; P.eR = 0.05; P.fR = HANDS.point; P.sLx = 0.25; P.sLz = 0.6; P.eL = 1.8; P.fL = HANDS.fist; P.browA = 0.8; P.smile = -0.3; P.open = S(u * 10) > 0 ? 0.5 : 0.15; P.cx = 0.1; P.lid = 0.85; },
  danser(P, u, seated) { const b = S(u * 8); P.by += A(b) * 0.06; P.brz = S(u * 4) * 0.12; P.bry = S(u * 2) * 0.35; P.sLx = -2.3 + b * 0.4; P.sRx = -2.3 - b * 0.4; P.sLz = 0.5; P.sRz = -0.5; P.eL = P.eR = 0.8 + 0.4 * b; P.fL = P.fR = HANDS.open; P.hz = S(u * 4) * 0.18; P.smile = 1; P.open = 0.5; P.low = 0.4; if (!seated) { P.kL = Math.max(0, b) * 0.9; P.lLx = -Math.max(0, b) * 0.6; P.kR = Math.max(0, -b) * 0.9; P.lRx = -Math.max(0, -b) * 0.6; } },
  doigt(P, u) {
    const pump = u > 0.25 && u < 1.4 ? Math.max(0, S((u - 0.25) * 9)) : 0;
    P.sRx = -1.05 - pump * 0.2; P.sRz = 0.05; P.sRy = 0; P.eR = 1.95; P.wRy = -1.3; P.wRx = 0.25; P.fR = HANDS.bird;
    if (u > 0.7) { P.sLx = -1.05 - pump * 0.2; P.sLz = -0.05; P.eL = 1.95; P.wLy = 1.3; P.wLx = 0.25; P.fL = HANDS.bird; }
    P.cx = -0.12; P.hz = 0.14; P.hx = -0.08; P.smile = 0.8; P.open = 0.1; P.browL = 0.65; P.browR = -0.25; P.lid = 0.55; P.low = 0.3;
  },
  tomber(P, u, seated, dur) {
    const f = Math.min(1, u / 0.35) * Math.min(1, Math.max(0, (dur - u) / 0.7));
    P.brx = -1.45 * f; P.by -= (seated ? 0.1 : 0.4) * f; P.lLx = P.lRx = -1.4 * f + S(u * 14) * 0.4 * f; P.kL = P.kR = 0.3 * f;
    P.sLz = 1.3 * f; P.sRz = -1.3 * f; P.eL = P.eR = 0.5; P.fL = P.fR = HANDS.open; P.smile = -0.3; P.open = 0.8 * f; P.browL = P.browR = 0.6 * f; P.lid = u > 0.3 && u < 1.2 ? 0.1 : 1;
  },
  coucou(P, u) { P.sRz = -2.45 + 0.3 * S(u * 12); P.sRx = -0.2; P.eR = 0.5 + 0.35 * S(u * 12 + 1); P.wRy = -0.6; P.fR = HANDS.open; P.smile = 1; P.open = 0.4; P.hz = 0.12; P.browL = P.browR = 0.45; },
  colere(P, u, seated) { const k = Math.max(0, S(u * 11)); P.browA = 1; P.smile = -0.7; P.open = 0.5; P.sLz = 0.3; P.sRz = -0.3; P.sLx = P.sRx = 0.35; P.eL = P.eR = 0.7; P.fL = P.fR = HANDS.fist; P.cx = 0.15; P.by += 0.02 * k; P.lid = 0.8; if (!seated) { P.lLx = -0.5 * k; P.kL = 0.9 * k; } },
  bisou(P, u) { P.cx = 0.12; if (u < 0.6) { P.sRx = -1.15; P.sRz = 0.18; P.eR = 2.35; P.fR = HANDS.pinch; } else { P.sRx = -1.5; P.sRz = -0.2; P.eR = 0.3; P.fR = HANDS.open; } P.pucker = u < 0.85 ? 1 : 0; P.lid = 0.15; P.browL = P.browR = 0.35; },
  lancer(P, u) { if (u < 0.22) { P.sRx = 1.0; P.sRz = -0.35; P.eR = 1.5; P.cy = 0.35; } else { P.sRx = -1.9; P.sRz = -0.1; P.eR = 0.25; P.cy = -0.3; } P.fR = u < 0.25 ? HANDS.fist : HANDS.open; P.open = 0.45; P.browA = 0.35; P.lid = 0.85; },
};
export const EMOTE_MS = { ...Object.fromEntries(Object.entries(LG.EMOTES).map(([k, e]) => [k, e.ms])), lancer: 700 };
export function play(ch, name, t, target = null) { ch.emote = { name, t0: t, dur: EMOTE_MS[name] / 1000, target }; ch.fxAt = 0; }
export function hitBy(ch, item, t) { ch.hitAt = t; ch.hitItem = item; }

/* ---------------- Animation, à chaque image ---------------- */
// s : { moving (vitesse), seated } ; spawn(kind, pos, opts) : effets (larmes, vapeur, cœurs…).
const v3 = new THREE.Vector3();
export function animate(ch, dt, t, s, spawn) {
  const P = { by: 0, brx: 0, bry: 0, brz: 0, px: 0, cx: 0, cy: 0, cz: 0, hx: 0, hy: 0, hz: 0, sLx: 0.05, sLy: 0, sLz: 0.1, eL: 0.18, wLx: 0, wLy: 0, sRx: 0.05, sRy: 0, sRz: -0.1, eR: 0.18, wRx: 0, wRy: 0, lLx: 0, lLz: 0.02, kL: 0, aL: 0, lRx: 0, lRz: -0.02, kR: 0, aR: 0, fL: HANDS.relax, fR: HANDS.relax, lid: 1, low: 0, browL: 0, browR: 0, browA: 0, smile: 0.35, open: 0.02, pucker: 0 };
  const ph = ch.walkPh;
  if (ch.ghost) {
    P.by = 0.3 + S(t * 2 + ph) * 0.08; P.sLx = P.sRx = -1.2; P.sLz = -0.08; P.sRz = 0.08; P.eL = P.eR = 0.5; P.wLx = P.wRx = 0.6; P.fL = P.fR = HANDS.open; P.lLx = P.lRx = -0.3; P.kL = P.kR = 0.7; P.aL = P.aR = 0.6; P.smile = -0.4; P.open = 0.5; P.browA = -0.4; P.hz = S(t * 1.3) * 0.12; P.lid = 0.7;
  } else if (s.seated) {
    P.by = -0.28; P.lLx = P.lRx = -1.5; P.kL = P.kR = 1.5; P.lLz = 0.06; P.lRz = -0.06;
    P.sLx = P.sRx = -0.5; P.eL = P.eR = 0.9; P.sLz = 0.12; P.sRz = -0.12; P.fL = P.fR = HANDS.relax;
    P.hy = S(t * 0.4 + ph) * 0.3; P.cx = 0.06 + S(t * 1.7) * 0.012; P.hx = 0.05;
  } else if (s.moving > 0.2) {
    ch.walkPh += dt * (4 + s.moving * 1.6);
    const w = S(ch.walkPh), k = Math.min(1, s.moving / 3);
    P.lLx = -w * 0.7 * k; P.lRx = w * 0.7 * k; P.kL = Math.max(0, w) * 1.05 * k + 0.1; P.kR = Math.max(0, -w) * 1.05 * k + 0.1; P.aL = -Math.max(0, -w) * 0.3 * k; P.aR = -Math.max(0, w) * 0.3 * k;
    P.sLx = w * 0.55 * k; P.sRx = -w * 0.55 * k; P.eL = 0.35 + Math.max(0, -w) * 0.4 * k; P.eR = 0.35 + Math.max(0, w) * 0.4 * k;
    P.by = A(Math.cos(ch.walkPh)) * 0.045 * k; P.cy = w * 0.12 * k; P.px = -w * 0.05 * k; P.cx = 0.06 * k; P.hy = -w * 0.06 * k;
  } else {
    const br = S(t * 1.8 + ph); P.cx = br * 0.018; P.by = br * 0.004; P.px = S(t * 0.4 + ph) * 0.02; P.hy = S(t * 0.45 + ph) * 0.25; P.hz = S(t * 0.7) * 0.04;
    P.lLz = 0.03 + S(t * 0.4 + ph) * 0.02; P.kL = 0.05 + Math.max(0, S(t * 0.4 + ph)) * 0.08;
  }
  // regard qui se promène
  if (t > ch.lookAt) { ch.lookAt = t + 0.8 + rnd() * 2.6; ch.look = [between(-0.6, 0.6), between(-0.3, 0.3)]; }
  // gestes en parlant
  if (t < ch.talkUntil && !ch.emote && !s.seated) { P.sRx = -0.6 + S(t * 3) * 0.25; P.eR = 1.1 + S(t * 4.2) * 0.4; P.fR = HANDS.open; P.wRy = -0.6; }
  // emote en cours
  const e = ch.emote;
  if (e) {
    const u = t - e.t0;
    if (u > e.dur) ch.emote = null;
    else if (!ch.ghost) {
      EMO[e.name]?.(P, u, s.seated, e.dur);
      if (u > ch.fxAt) {
        const at = (x, y, z) => ch.head.localToWorld(v3.set(x, y, z));
        if (e.name === 'pleurer') { ch.fxAt = u + 0.07; for (const sd of [1, -1]) spawn('drop', at(sd * 0.075, 0.22, 0.19), { vx: sd * 1.0 }); }
        else if (e.name === 'colere') { ch.fxAt = u + 0.13; spawn('puff', at((Math.random() - 0.5) * 0.2, 0.48, 0), { grey: true }); }
        else if (e.name === 'bisou' && u > 0.6) { ch.fxAt = 99; for (let k = 0; k < 3; k++) spawn('heart', at(0, 0.15, 0.3), { k }); }
        else if (e.name === 'rire' || e.name === 'danser') { ch.fxAt = u + 0.5; spawn('note', at(0, 0.58, 0), { laugh: e.name === 'rire' }); }
        else if (e.name === 'tomber' && u > 0.35) { ch.fxAt = 99; spawn('dust', ch.root.position, {}); }
        else ch.fxAt = 99;
      }
    }
  }
  // touché par un objet
  const h = t - ch.hitAt;
  if (h < 0.7 && !ch.ghost) { const k = 1 - h / 0.7; P.hx -= 0.6 * k; P.brx -= 0.2 * k; P.open = 0.7; P.smile = -0.2; P.browL = P.browR = 0.7; if (h < 0.3) P.lid = 0; }
  if (ch.hitItem === 'chaussure' && h < 2.2 && !ch.ghost && t > ch.starAt) { ch.starAt = t + 0.18; spawn('star', ch.head.localToWorld(v3.set(0, 0.5, 0)), { a: t * 6 }); }
  if (ch.hitItem === 'rose' && h < 1.5 && !ch.ghost) { P.smile = 1; P.lid = 0.3; P.low = 0.6; P.browA = -0.3; }
  // parler, cligner
  if (t < ch.talkUntil && !e && h > 0.7) { P.open = 0.12 + 0.3 * A(S(t * 13)); P.smile = 0.3; }
  if (t > ch.blinkAt) { if (t > ch.blinkAt + 0.12) ch.blinkAt = t + 2 + rnd() * 3.5; else P.lid = 0; }

  // lissage vers la pose voulue
  const f = 1 - Math.exp(-dt * 14), c = ch.cur;
  for (const k in P) if (typeof P[k] === 'number') c[k] = c[k] === undefined ? P[k] : c[k] + (P[k] - c[k]) * f;
  ch.curF = [P.fL, P.fR].map((target, k) => target.map((v, i) => (ch.curF[k][i] ?? v) + (v - (ch.curF[k][i] ?? v)) * Math.min(1, f * 1.4)));
  ch.body.position.y = 0.72 + c.by; ch.body.rotation.set(c.brx, c.bry, c.brz);
  ch.pelvis.rotation.x = c.px; ch.chest.rotation.set(c.cx, c.cy, c.cz); ch.neck.rotation.set(c.hx, c.hy, c.hz);
  const [L, R] = ch.arms;
  L.sh.rotation.set(c.sLx, c.sLy, c.sLz); L.el.rotation.x = -c.eL; L.wr.rotation.set(c.wLx, c.wLy, 0);
  R.sh.rotation.set(c.sRx, c.sRy, c.sRz); R.el.rotation.x = -c.eR; R.wr.rotation.set(c.wRx, c.wRy, 0);
  ch.arms.forEach((a, k) => pose(a, ch.curF[k]));
  const [lL, lR] = ch.legs;
  lL.hip.rotation.set(c.lLx, 0, c.lLz); lL.knee.rotation.x = c.kL; lL.ank.rotation.x = c.aL;
  lR.hip.rotation.set(c.lRx, 0, c.lRz); lR.knee.rotation.x = c.kR; lR.ank.rotation.x = c.aR;
  // visage
  const H = ch.H;
  for (const { up, lo } of H.lids) { up.rotation.x = -1.3 + (1 - c.lid) * 1.48; lo.rotation.x = 1.3 - c.low * 0.65 - (1 - c.lid) * 0.25; }
  for (const { gaze } of H.eyes) { gaze.rotation.y += (ch.look[0] * 0.45 - gaze.rotation.y) * Math.min(1, dt * 18); gaze.rotation.x += (-ch.look[1] * 0.3 - gaze.rotation.x) * Math.min(1, dt * 18); }
  H.brows.forEach((b, k) => { const sd = k ? -1 : 1, raise = k ? c.browR : c.browL; b.position.y = 0.302 + raise * 0.014 - Math.abs(c.browA) * 0.004; b.rotation.z = sd * c.browA * 0.32; });
  const sm = c.smile, op = Math.max(0, c.open), pk = c.pucker > 0.5;
  H.lipU.scale.set(1 + sm * 0.12, Math.max(0.1, A(sm) * 0.9), 1); H.lipU.rotation.z = sm < 0 ? Math.PI : 0; H.lipU.position.y = 0.002;
  H.lipL.scale.set(1 + sm * 0.1, Math.max(0.15, A(sm) * 0.8 + op * 0.4), 1); H.lipL.rotation.z = sm < 0 ? Math.PI : 0; H.lipL.position.y = -0.006 - op * 0.04;
  H.lipU.visible = H.lipL.visible = !pk; H.ring.visible = pk;
  H.inside.visible = op > 0.06 && !pk; H.inside.scale.set(1.25 + sm * 0.2, 0.1 + op * 1.0, 0.45); H.inside.position.y = -0.005 - op * 0.02;
  H.teeth.visible = op > 0.15 && !pk; H.tongue.visible = op > 0.3 && !pk; H.tongue.position.y = -0.012 - op * 0.03;
  // colère : le visage rougit
  if (!ch.ghost) { ch.M.skin.emissive.set('#ff2a1a'); ch.M.skin.emissiveIntensity = e?.name === 'colere' ? 0.22 : 0; }
  // taches sur le visage
  for (const sp of ch.splats) { sp.life -= dt; sp.mesh.material.opacity = Math.min(1, sp.life); }
  while (ch.splats.length && ch.splats[0].life <= 0) { const sp = ch.splats.shift(); ch.head.remove(sp.mesh); sp.mesh.material.dispose(); }
}
// Plie les doigts d'un bras (valeurs 0 tendu → 1 replié).
export function pose(a, f) {
  const sd = a.side;
  a.thumb.b.rotation.set(-0.45 + f[0] * 0.5, 0, -sd * (0.35 + f[0] * 0.7)); a.thumb.m.rotation.set(0, 0, -sd * f[0] * 0.9);
  a.fingers.forEach((g, i) => { const k = f[i + 1]; g.b.rotation.z = -sd * k * 1.45; g.m.rotation.z = -sd * k * 1.6; });
}
export { HANDS };

/* ---------------- Objets lancés ---------------- */
const splatTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 34, 0, TAU); x.fill();
  for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU + Math.random() * 0.3, d = 34 + Math.random() * 22, r = 6 + Math.random() * 11; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); x.fill(); x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, d, a - 0.12, a + 0.12); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export function splat(ch, item) {
  if (item !== 'tomate' && item !== 'oeuf') return;
  const mat = new THREE.MeshPhysicalMaterial({ map: splatTex, color: item === 'tomate' ? '#c81e12' : '#ffd23a', transparent: true, roughness: 0.15, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), mat);
  const a = (Math.random() - 0.5) * 0.9, y = 0.16 + Math.random() * 0.14;
  m.position.set(Math.sin(a) * 0.205, y, Math.cos(a) * 0.205); m.rotation.y = a; m.rotation.z = Math.random() * TAU;
  ch.head.add(m);
  ch.splats.push({ mesh: m, life: 4.5 });
}
export function makeItem(item) {
  const g = new THREE.Group(), std = (c, o) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, ...o });
  if (item === 'tomate') { put(g, G.sphere(0.07, 28, 20), std('#d8261a', { roughness: 0.2, clearcoat: 1 }), 0, 0, 0, 0, 0, 0, 1, 0.82, 1); for (let k = 0; k < 5; k++) put(g, G.capsule(0.006, 0.04, 6), std('#3f8f2f'), Math.sin(k * 1.26) * 0.025, 0.055, Math.cos(k * 1.26) * 0.025, Math.cos(k * 1.26) * 1.3, 0, -Math.sin(k * 1.26) * 1.3); put(g, G.cyl(0.004, 0.006, 0.03, 6), std('#2f6f22'), 0, 0.07, 0); }
  if (item === 'oeuf') put(g, G.sphere(0.05, 24, 18), std('#f6ecd8', { roughness: 0.4 }), 0, 0, 0, 0, 0, 0, 1, 1.3, 1);
  if (item === 'chaussure') { put(g, G.sphere(0.06, 20, 14), std('#5a3a22', { clearcoat: 0.4 }), 0, 0, 0.03, 0, 0, 0, 1, 0.7, 1.9); put(g, G.cyl(0.055, 0.055, 0.12, 20, true), std('#5a3a22', { side: THREE.DoubleSide }), 0, 0.07, -0.05); put(g, G.rbox(0.1, 0.022, 0.25, 0.01), std('#24180f'), 0, -0.04, 0.03); }
  if (item === 'poisson') { put(g, G.sphere(0.05, 24, 16), std('#8fb6c8', { metalness: 0.6, roughness: 0.25, clearcoat: 1 }), 0, 0, 0, 0, 0, 0, 0.7, 1, 2.6); put(g, G.cyl(0.0, 0.06, 0.08, 4), std('#6f97aa'), 0, 0, -0.16, -Math.PI / 2, 0, 0, 1, 1, 0.25); for (const s of [1, -1]) put(g, G.sphere(0.009, 10, 8), std('#111', { clearcoat: 1 }), s * 0.03, 0.015, 0.08); }
  if (item === 'chou') { for (let k = 0; k < 8; k++) put(g, G.sphere(0.08 - k * 0.004, 16, 12, 0, TAU, 0, 1.6), std(k % 2 ? '#8ccf6a' : '#6cb24a', { side: THREE.DoubleSide, sheen: 0.6 }), 0, 0, 0, k * 0.8, k * 1.3, 0); }
  if (item === 'rose') { put(g, G.cyl(0.006, 0.006, 0.26, 8), std('#2f7a2f'), 0, -0.11, 0); for (let k = 0; k < 7; k++) put(g, G.sphere(0.03 - k * 0.002, 14, 10, 0, TAU, 0, 1.9), std('#c8102e', { side: THREE.DoubleSide, sheen: 1, sheenColor: '#ff6080' }), 0, 0.04, 0, 0.3, k * 0.9, 0); put(g, G.sphere(0.02, 8, 6), std('#3f9a3f'), 0.025, -0.08, 0, 0, 0, 0, 1.6, 0.3, 0.8); }
  if (item === 'fleche') { const s = new THREE.Group(); s.rotation.x = Math.PI / 2; g.add(s); put(s, G.cyl(0.008, 0.008, 0.7, 8), std('#8a6a48'), 0, 0, 0); put(s, G.cyl(0, 0.022, 0.07, 8), std('#c8ccd4', { metalness: 1, roughness: 0.3 }), 0, 0.385, 0); for (let k = 0; k < 3; k++) put(s, G.rbox(0.003, 0.11, 0.04, 0.001), std('#e8543c'), Math.sin(k * 2.1) * 0.015, -0.3, Math.cos(k * 2.1) * 0.015, 0, k * 2.1, 0); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
