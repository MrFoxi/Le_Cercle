// Mini-golf, mode Aventure : le dessin de la Tour. Les blocs de la physique deviennent des volumes aux couleurs de leur
// étage (strates qui changent avec l'altitude), habillés de décor : herbe, arbres géants, racines, cristaux, ruines,
// cascades, glaciers, temple. Les blocs qui cachent la balle deviennent transparents ; la balle reste visible en filigrane.
/* global TourPhys, TourLevel */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from '../props.js';

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
// Dessus et flancs de chaque surface
const SURF = {
  grass: ['#86d35c', '#a8744a'], moss: ['#62b35a', '#7d6a4a'], rock: ['#bdb4a6', '#8f857a'], wood: ['#c08a55', '#8a5a35'],
  sand: ['#f2d08c', '#dca86a'], mud: ['#7f6c4a', '#5e4e34'], ice: ['#d6f2ff', '#a6d8f4'], snow: ['#fbfdff', '#c9dcea'],
  crystal: ['#c3b4ff', '#8d78e8'], shroom: ['#ff6f8f', '#fff0e0'], gold: ['#f8ead0', '#e6c890'],
};
// Couleur de la roche des façades selon l'altitude : terre, mousse, améthyste, grès rouge, roche glacée, marbre
const STRATA = [
  [-30, '#8a6f55', '#a3845f'], [9, '#6f7d58', '#869a66'], [19.5, '#6c5fae', '#8576c9'], [27, '#c8754a', '#e3a265'],
  [40.5, '#93aac2', '#bfd2e4'], [50, '#efe4ef', '#fff8f2'],
];
function strataAt(y) {
  let i = 0;
  while (i + 1 < STRATA.length && y > STRATA[i + 1][0] - 1.5) i++;
  const a = STRATA[i], b = STRATA[i + 1];
  const k = b ? smooth(Math.min(1, Math.max(0, (y - (b[0] - 1.5)) / 3))) : 0;
  const ca = new THREE.Color(a[1]), cb = new THREE.Color(a[2]);
  if (b && k > 0) { ca.lerp(new THREE.Color(b[1]), k); cb.lerp(new THREE.Color(b[2]), k); }
  return [ca, cb];
}
// Demi-tailles de la boîte englobante d'un bloc tourné (rampes, tronc couché)
function aabbHalf(b) { const A = TourPhys.axes(b.yaw, b.pitch, b.roll); return [0, 1, 2].map(i => Math.abs(A[0][i]) * b.h[0] + Math.abs(A[1][i]) * b.h[1] + Math.abs(A[2][i]) * b.h[2]); }
const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

/* ---------- Un bloc en volume, couleurs posées sur les sommets ---------- */
function blockGeometry(b) {
  const [w, h, d] = b.h.map(x => x * 2), big = Math.max(w, h, d) > 6;
  const geo = big ? new THREE.BoxGeometry(w, h, d, Math.ceil(w / 2.5), Math.ceil(h / 0.33), Math.ceil(d / 2.5)) : new RoundedBoxGeometry(w, h, d, 2, Math.min(0.35, Math.min(w, h, d) * 0.22));
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.pitch, b.yaw, b.roll, 'YXZ'));
  m.setPosition(...b.c);
  geo.applyMatrix4(m);
  const pos = geo.attributes.position, nor = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const [top, side] = SURF[b.s] || SURF.rock;
  const cTop = new THREE.Color(top), cSide = new THREE.Color(side);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nor.getY(i), n = hash(Math.round(x * 2), Math.round(y * 2), Math.round(z * 2));
    if (ny > 0.6) c.copy(cTop).offsetHSL(0, 0, (n - 0.5) * 0.06);
    else if (b.s === 'rock' || b.s === 'gold' || b.s === 'snow' || b.s === 'crystal') {
      const [a, bb] = strataAt(y), layer = Math.floor((y + Math.sin(x * 0.25 + z * 0.25) * 0.4) / 1.3), band = hash(layer, 1, 7);
      c.copy(a).lerp(bb, band).offsetHSL(0, 0, (n - 0.5) * 0.05);
      if (b.s === 'snow' && y > b.c[1] + b.h[1] - 1.2) c.set('#f4f9ff');
      if (b.s === 'crystal') c.lerp(cSide, 0.5);
    } else { c.copy(cSide).offsetHSL(0, 0, (n - 0.5) * 0.08 - (ny < -0.5 ? 0.1 : 0)); if (y > b.c[1] + b.h[1] - 0.45 && ny < 0.6) c.copy(cTop).offsetHSL(0, 0, -0.08); }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

export function createScene(canvas) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe8dc', 260, 420);
  // Caméra fixe : position, distance et échelle ne changent jamais ; c'est la tour qui tourne et glisse devant elle
  const VIEW = 40, CAM_YAW = 0.62, CAM_EL = 0.5;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);
  const camDir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_EL), Math.sin(CAM_EL), Math.cos(CAM_YAW) * Math.cos(CAM_EL));
  camera.position.copy(camDir).multiplyScalar(300); camera.lookAt(0, 0, 0);
  const fwd = camDir.clone().negate();
  const world = new THREE.Group(), tower = new THREE.Group();
  scene.add(world); world.add(tower);
  const hemi = new THREE.HemisphereLight('#eaf6ff', '#6a6a5a', 1.25);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);

  const L = TourLevel, live = { solid: [], fades: [], dyn: new Map(), hidden: [], falls: [], spins: [], glows: [], pickups: [], flames: [], clouds: [] };
  const mats = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05 }),
  };
  const glossy = s => s === 'ice' || s === 'crystal' || s === 'gold';

  /* ---------- Les blocs ---------- */
  const small = { matte: [], gloss: [] };
  L.blocks.forEach((b, i) => {
    const geo = blockGeometry(b), kind = glossy(b.s) ? 'gloss' : 'matte';
    const big = Math.max(...b.h) * 2 >= 6 && b.look !== 'plateau';
    const special = b.breakAt || b.topple || b.move || b.hidden || b.trigger;
    if (special || big) {
      const m = mats[kind].clone();
      if (b.look === 'pane') Object.assign(m, { transparent: true, opacity: 0.55, emissive: new THREE.Color(b.s === 'ice' ? '#7fd4ff' : '#9b7bff'), emissiveIntensity: 0.4 });
      if (b.trigger) m.emissive = new THREE.Color('#000000');
      // la géométrie est en coordonnées de la tour ; un bloc qui bouge est recentré sur son origine
      if (b.move || b.topple) geo.translate(-b.c[0], -b.c[1], -b.c[2]);
      const mesh = new THREE.Mesh(geo, m);
      if (b.move || b.topple) mesh.position.set(...b.c);
      mesh.castShadow = mesh.receiveShadow = true;
      tower.add(mesh);
      if (special) live.dyn.set(i, mesh);
      if (b.hidden) { mesh.visible = false; live.hidden.push({ b, mesh, k: 0 }); }
      if (big) live.fades.push({ b, mesh, k: 1 });
    } else small[kind].push(geo);
  });
  // Détails des façades : mousses, lianes, éclats de cristal, frises gravées, stalactites, ornements dorés
  const dr = P.rngOf(5);
  for (const f of live.fades) {
    const b = f.b; if (!b.face) continue;
    const parts = [], y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];
    for (const [ax, sgn] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
      const len = b.h[ax === 0 ? 2 : 0] * 2, n = Math.round((len * (y1 - y0)) / 14);
      for (let k = 0; k < n; k++) {
        const u = (dr() * 2 - 1) * (len / 2 - 0.6), out = b.h[ax] + 0.05;
        let y = y0 + 0.5 + dr() * (y1 - y0 - 1);
        const px = ax === 0 ? b.c[0] + sgn * out : b.c[0] + u, pz = ax === 0 ? b.c[2] + u : b.c[2] + sgn * out;
        let g;
        if (y < 10) { g = new THREE.SphereGeometry(0.5 + dr() * 0.6, 7, 5); g.scale(1, 0.6, 0.5); }
        else if (y < 20) { g = new THREE.BoxGeometry(0.16, 1.5 + dr() * 3, 0.16); g.translate(0, -1, 0); }
        else if (y < 32) { g = new THREE.OctahedronGeometry(0.35 + dr() * 0.35, 0); g.scale(0.7, 1.6, 0.7); g.rotateZ((dr() - 0.5) * 1.2); }
        else if (y < 42) { g = new THREE.BoxGeometry(1.2 + dr() * 1.6, 0.35, 0.25); }
        else if (y < 50) { g = new THREE.ConeGeometry(0.16, 0.8 + dr() * 1.2, 5); g.rotateX(Math.PI); y = Math.max(y, y1 - 1.6); } // stalactites sous les rebords
        else { g = new THREE.BoxGeometry(0.3, 1.6, 0.18); }
        g.translate(px, y, pz);
        const col = new THREE.Color(y < 10 ? '#4f7a3a' : y < 20 ? '#4f9a44' : y < 32 ? ['#b49cff', '#7fe6ff'][k % 2] : y < 42 ? '#9a5a3a' : y < 50 ? '#e8f6ff' : '#e0b860');
        const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        parts.push(g.index ? g.toNonIndexed() : g);
      }
    }
    if (!parts.length) continue;
    f.extra = new THREE.Mesh(mergeGeometries(parts.map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; })), mats.matte.clone());
    f.extra.castShadow = true; tower.add(f.extra);
  }
  for (const kind of ['matte', 'gloss']) if (small[kind].length) { const m = new THREE.Mesh(mergeGeometries(small[kind]), mats[kind]); m.castShadow = m.receiveShadow = true; tower.add(m); }

  /* ---------- Herbe, cailloux, fleurs (en instances) ---------- */
  const rand = P.rngOf(42), tufts = [], pebbles = [], flowers = [];
  for (const b of L.blocks) {
    if (b.pitch || b.roll || b.move) continue;
    const top = b.c[1] + b.h[1], area = b.h[0] * b.h[2] * 4;
    const n = Math.min(260, Math.round(area * (b.s === 'grass' ? 0.35 : b.s === 'moss' ? 0.5 : b.s === 'sand' || b.s === 'rock' ? 0.05 : 0)));
    for (let k = 0; k < n; k++) {
      const x = b.c[0] + (rand() * 2 - 1) * (b.h[0] - 0.3), z = b.c[2] + (rand() * 2 - 1) * (b.h[2] - 0.3);
      if (Math.abs(x) < 15.7 && Math.abs(z) < 15.7 && top < 10 && b.look === 'plateau') continue; // pas sous la tour
      ((b.s === 'grass' || b.s === 'moss') ? (rand() < 0.08 ? flowers : tufts) : pebbles).push([x, top, z, rand()]);
    }
  }
  const tuftGeo = mergeGeometries([0, 1, 2].map(k => { const g = new THREE.ConeGeometry(0.07, 0.45, 3); g.translate(Math.cos(k * 2.1) * 0.08, 0.22, Math.sin(k * 2.1) * 0.08); g.rotateZ((k - 1) * 0.25); return g; }));
  const inst = (geo, matl, list, s) => {
    const m = new THREE.InstancedMesh(geo, matl, list.length), o = new THREE.Object3D();
    list.forEach(([x, y, z, r], i) => { o.position.set(x, y, z); o.rotation.y = r * TAU; o.scale.setScalar(s * (0.6 + r * 0.8)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.receiveShadow = true; tower.add(m); return m;
  };
  if (tufts.length) inst(tuftGeo, new THREE.MeshStandardMaterial({ color: '#5fb04a', roughness: 0.9 }), tufts, 1.2);
  if (pebbles.length) inst(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#a89c8a', roughness: 0.9, flatShading: true }), pebbles, 1);
  if (flowers.length) { const fm = inst(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), flowers.map(f => [f[0], f[1] + 0.25, f[2], f[3]]), 1); flowers.forEach((f, i) => fm.setColorAt(i, new THREE.Color(['#ffffff', '#ffe066', '#ff8fb1', '#c9a8ff'][Math.floor(f[3] * 4)]))); }

  /* ---------- Décor ---------- */
  const at = (o, [x, y, z], s = 1, ry = 0) => { o.position.set(x, y, z); o.scale.multiplyScalar(s); o.rotation.y = ry; tower.add(o); return o; };
  const fadeDeco = (o, r) => { o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } }); live.fades.push({ deco: o, r, k: 1 }); return o; };
  const glowMat = (c, k = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3 });
  function fall(x, y, z, h, w = 2.4, face = 'z') {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128;
    const x2 = c.getContext('2d'); x2.fillStyle = '#7fd8f0'; x2.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 30; i++) { x2.fillStyle = 'rgba(255,255,255,.7)'; x2.fillRect(Math.random() * 32, Math.random() * 128, 1.5, 16 + Math.random() * 30); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2, h / 6); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: 0.85, roughness: 0.2, side: THREE.DoubleSide, emissive: '#5fb8d8', emissiveIntensity: 0.25 }));
    m.position.set(x, y - h / 2, z); if (face === 'x') m.rotation.y = Math.PI / 2;
    tower.add(m); live.falls.push(t);
    const foam = new THREE.Mesh(new THREE.SphereGeometry(w * 0.6, 12, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.4 }));
    foam.scale.y = 0.4; foam.position.set(x, y - h, z); tower.add(foam);
  }
  function giantTree(p) {
    const g = new THREE.Group();
    g.add(P.cyl(1.1, 1.6, 9, '#7a5233'));
    for (const [a, r] of [[0, 1], [2.1, 0.8], [4.2, 0.9]]) { const root = P.cyl(0.25, 0.6, 3, '#6b4a2e'); root.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4); root.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(root); }
    for (const [x, y, z, r, c] of [[0, 11, 0, 4.2, '#4fa64a'], [-2.6, 9.5, 1.5, 3, '#63b956'], [2.4, 10, -1.2, 3.2, '#5aae4e'], [0.5, 13.5, 0.5, 2.8, '#72c463']]) g.add(P.ball(r, c, x, y, z, 14));
    return fadeDeco(P.shadows(g), 6);
  }
  function crystalCluster(big) {
    const g = new THREE.Group(), r = P.rngOf(big ? 7 : 3);
    for (let k = 0; k < (big ? 9 : 5); k++) {
      const h = (big ? 2.2 : 1) + r() * (big ? 3 : 1.6), c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 * (big ? 1.6 : 1), 0), glowMat(['#b49cff', '#7fe6ff', '#ff9ce6'][k % 3], 0.9));
      c.scale.set(1, h, 1); c.position.set((r() - 0.5) * 1.8, h * 0.35, (r() - 0.5) * 1.8); c.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6); g.add(c);
    }
    return g;
  }
  function statue() { // un gardien de pierre, tête carrée et yeux de cristal
    const g = new THREE.Group(), st = '#d9b98f';
    g.add(P.box(3.2, 2.4, 2.4, st, 0, 0, 0, 0.3), P.box(2.6, 3.4, 2, st, 0, 2.4, 0, 0.3), P.box(3, 2.6, 2.6, st, 0, 5.8, 0, 0.4), P.box(3.4, 0.6, 2.9, '#c9a77a', 0, 8.2, 0, 0.2));
    for (const s of [-1, 1]) g.add(P.box(0.6, 0.35, 0.2, glowMat('#7fe6ff', 1.2), s * 0.7, 7, 1.32));
    g.add(P.box(1.2, 0.25, 0.2, '#a8875e', 0, 6.3, 1.32));
    return P.shadows(g);
  }
  function lanterns(p) {
    const g = new THREE.Group();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, x = Math.cos(a) * 6.5, z = Math.sin(a) * 6.5; g.add(P.cyl(0.07, 0.07, 2.4, '#5a4a3a', x, 0, z, 6)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glowMat(['#ffcf6a', '#ff9ac0'][k % 2], 1.5)); l.position.set(x, 2.6, z); l.scale.y = 1.3; g.add(l); live.flames.push(l); }
    return g;
  }
  const T = (k, s, o) => P.tree(k, s, o);
  for (const dd of L.deco) {
    const p = dd.p;
    switch (dd.t) {
      case 'roots': for (let k = 0; k < 3; k++) { const pts = [new THREE.Vector3(p[0] + k * 1.6 - 2, p[1], p[2] + 2), new THREE.Vector3(p[0] + k * 1.2 - 1, p[1] + 2.5, p[2] - 0.6), new THREE.Vector3(p[0] + k - 0.5, p[1] + 6 + k, p[2] - 1.9)]; const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.45 - k * 0.08, 8), P.mat('#7a5233')); tube.castShadow = true; tower.add(tube); } break;
      case 'lily': for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.6 + (k % 3) * 0.2, 10, 0.3, TAU - 0.6), P.mat('#4fae5a', { side: THREE.DoubleSide })); l.rotation.x = -Math.PI / 2; l.position.set(p[0] + Math.cos(k * 2.3) * (k * 0.5), p[1] + 0.02, p[2] + Math.sin(k * 2.3) * (k * 0.5)); tower.add(l); if (k % 3 === 0) at(P.ball(0.25, '#ff9ac0'), [l.position.x, p[1] + 0.15, l.position.z]); } break;
      case 'reeds': for (let k = 0; k < 14; k++) at(P.cyl(0.05, 0.08, 1.6 + (k % 4) * 0.5, '#7a9a4a'), [p[0] + Math.cos(k * 1.7) * k * 0.15, p[1], p[2] + Math.sin(k * 1.7) * k * 0.15]); break;
      case 'tee': at(P.box(2.4, 0.12, 2.4, '#6fc25a', 0, 0, 0, 0.05), p); for (const s of [-1, 1]) at(P.ball(0.22, '#ff5a6e'), [p[0] + s * 1.6, p[1] + 0.2, p[2]]); break;
      case 'bigtree': at(giantTree(p), p); break;
      case 'fern': for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), P.mat('#4fa64a')); f.scale.set(1.4, 0.18, 0.4); f.position.set(p[0] + Math.cos(k) * 0.9, p[1] + 0.35, p[2] + Math.sin(k) * 0.9); f.rotation.y = -k; f.rotation.z = -0.4; tower.add(f); } break;
      case 'vines': for (let k = 0; k < 16; k++) { const len = 3 + (k % 5) * 1.3, v = P.cyl(0.07, 0.07, len, '#4f9a44', p[0] - 0.15, p[1] - len, p[2] - 15 + k * 2, 5); tower.add(v); at(P.ball(0.22, '#5fb04a'), [p[0] - 0.2, p[1] - len, p[2] - 15 + k * 2]); } break;
      case 'fall': fall(p[0], p[1], p[2], dd.h, 2.6, 'x'); break;
      case 'waterfall': fall(p[0], p[1], p[2], dd.h, 4, 'x'); break;
      case 'crystal': { const c = crystalCluster(dd.big); at(c, p); live.glows.push(c); break; }
      case 'pool': { const m = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), glowMat('#6fe4ff', 0.6)); m.rotation.x = -Math.PI / 2; m.position.set(...p); tower.add(m); break; }
      case 'ruins': for (let k = 0; k < 4; k++) { const h = 1 + (k * 1.7) % 3; at(P.cyl(0.45, 0.5, h, '#d9b98f', 0, 0, 0, 10), [p[0] + k * 1.8 - 2.5, p[1], p[2] + (k % 2) * 1.2]); } at(P.box(3, 0.6, 1, '#c9a77a', 0, 0, 0, 0.1), [p[0], p[1], p[2] + 2]); break;
      case 'statue': at(statue(), p, 0.75, 0.5); break;
      case 'arch': at(P.arch(40, 34, '#d9b98f', '#c9754a'), p, 0.12, 0.3); break;
      case 'cactus': at(T('cactus', 0.12), p); break;
      case 'mesa': at(P.mesa(P.rngOf(9), ['#e3a265', '#c8754a', '#a35a3a']), p, 0.12); break;
      case 'pine': at(T('snowpine', 0.16, { leaf: '#3f8a6a', trunk: '#7a5a45' }), p); break;
      case 'icespire': at(P.iceSpire(40), p, 0.12); break;
      case 'lanterns': at(lanterns(p), p); break;
      case 'blossom': at(T('round', 0.14, { leaf: '#ffb3d1', leaf2: '#ffd1e3', trunk: '#7a5a45' }), p); break;
      case 'beacon': { const b = crystalCluster(true); at(b, p, 1.4); live.glows.push(b); break; }
    }
  }
  // Le trou, son drapeau et un rayon de lumière qui se voit de loin
  const cup = L.cup;
  at(new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#10140f' })), [cup[0], cup[1] + 0.02, cup[2]]).rotation.x = -Math.PI / 2;
  at(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' })), [cup[0], cup[1] + 0.025, cup[2]]).rotation.x = -Math.PI / 2;
  at(P.cyl(0.05, 0.05, 3.2, '#ffffff', 0, 0, 0, 8), cup);
  const flagGeo = new THREE.PlaneGeometry(1.4, 0.9, 8, 3); flagGeo.translate(0.7, 0, 0);
  const flag = at(new THREE.Mesh(flagGeo, P.mat('#ff4f7b', { side: THREE.DoubleSide })), [cup[0], cup[1] + 2.75, cup[2]]);
  const flagBase = flagGeo.attributes.position.array.slice();
  const beam = at(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })), [cup[0], cup[1] + 30, cup[2]]);

  // Clubs à trouver : le club flotte et tourne dans un halo
  for (const pk of L.pickups) {
    const g = new THREE.Group(), C = TourPhys.CLUBS[pk.club];
    g.add(P.cyl(0.06, 0.06, 1.6, '#e8e8f0', 0, 0, 0, 8), P.box(0.5, 0.2, 0.18, glowMat('#ffd23f', 0.8), 0.18, 0, 0, 0.05));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 32), glowMat('#ffe9a0', 1.4)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.8; g.add(halo);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })));
    g.children.at(-1).position.y = 3;
    at(g, pk.p); live.pickups.push({ pk, g, C });
  }

  // Nuages à différentes hauteurs, et une mer de nuages tout en bas
  const cr = P.rngOf(77);
  for (let k = 0; k < 26; k++) {
    const c = P.cloud(cr, 0.12 + cr() * 0.12), a = cr() * TAU, r = 42 + cr() * 50;
    c.position.set(Math.cos(a) * r, -10 + cr() * 75, Math.sin(a) * r); c.userData.a = a; c.userData.r = r; c.userData.s = 0.01 + cr() * 0.02;
    tower.add(c); live.clouds.push(c);
  }
  for (let k = 0; k < 40; k++) { const c = P.cloud(cr, 0.5 + cr() * 0.4); const a = cr() * TAU, r = 30 + cr() * 90; c.position.set(Math.cos(a) * r, -32 - cr() * 6, Math.sin(a) * r); tower.add(c); }

  /* ---------- La balle ---------- */
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(TourPhys.R, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.6, emissive: '#fff6e0', emissiveIntensity: 0.12 }));
  ballMesh.castShadow = true; tower.add(ballMesh);
  const ghost = new THREE.Mesh(new THREE.SphereGeometry(TourPhys.R * 1.25, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe36a', transparent: true, opacity: 0.55, depthTest: false }));
  ghost.renderOrder = 10; tower.add(ghost);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; tower.add(ring);
  const trailPts = [], trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
  tower.add(trail);
  // Aperçu de la trajectoire et flèche de visée
  const preview = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffe14a', size: 7, sizeAttenuation: false, transparent: true, opacity: 0.95, depthTest: false }));
  preview.renderOrder = 11; tower.add(preview);
  const arrow = new THREE.Group();
  arrow.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false })), new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false })));
  arrow.children.forEach(m => (m.renderOrder = 12));
  arrow.visible = false; tower.add(arrow);
  // Particules (casse, éclaboussures, trou)
  const parts = [], partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  function burst(p, color, n = 18, speed = 4) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: Array.isArray(color) ? color[k % color.length] : color, transparent: true }));
      m.position.set(...p); tower.add(m);
      parts.push({ m, v: [(Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed], life: 1 + Math.random() * 0.6 });
    }
  }

  /* ---------- Rotation et cadrage ---------- */
  const view = { rot: 0, rotGoal: 0, follow: new THREE.Vector3(), k: 0 };
  function rotate(dir) { view.k = (view.k + dir + 4) % 4; view.rotGoal += (dir * Math.PI) / 2; }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { gl.setPixelRatio(dpr); gl.setSize(w, h, false); }
    const a = w / h, vh = a < 0.8 ? VIEW * 1.25 : VIEW; // un peu plus de hauteur sur un téléphone en hauteur
    Object.assign(camera, { left: (-vh * a) / 2, right: (vh * a) / 2, top: vh / 2, bottom: -vh / 2 });
    camera.updateProjectionMatrix();
  }
  const tmp = new THREE.Vector3(), ray = new THREE.Raycaster();
  // Un clic à l'écran -> un point du plan horizontal à la hauteur de la balle, dans le repère de la tour
  function pickGround(clientX, clientY, y) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const wy = tower.localToWorld(tmp.set(0, y, 0)).y, p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -wy), p)) return null;
    return tower.worldToLocal(p);
  }
  // Direction « vers l'écran » et « vers la droite » de l'écran, dans le repère de la tour (pour les touches)
  function screenAxes() {
    const inv = -tower.rotation.y, f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), inv);
    return { away: f, right: new THREE.Vector3(-f.z, 0, f.x) };
  }

  /* ---------- Une image ---------- */
  let ambient = { sky: ['#9fd8e8', '#e8f6e8'], fog: '#cfe8dc', sun: '#fff1d6' };
  function frame(st) {
    resize();
    const { ball, world: W, t, dt } = st;
    // rotation douce par quarts de tour
    const dr = view.rotGoal - view.rot;
    view.rot += Math.abs(dr) < 1e-4 ? dr : dr * (1 - Math.exp(-dt * 7));
    tower.rotation.y = view.rot;
    // la tour glisse pour garder la balle au centre (la caméra, elle, ne bouge pas)
    tower.updateMatrixWorld();
    const bw = tmp.set(...ball.p).applyAxisAngle(new THREE.Vector3(0, 1, 0), view.rot);
    const goal = bw.clone().sub(fwd.clone().multiplyScalar(bw.dot(fwd))).negate();
    goal.y -= 3.5; // la balle un peu sous le centre : on voit ce qui est au-dessus
    view.follow.lerp(goal, 1 - Math.exp(-dt * 3.2));
    world.position.copy(view.follow);
    world.updateMatrixWorld();
    // lumière et ombres qui suivent la balle
    const ballWorld = tower.localToWorld(tmp.set(...ball.p));
    sun.position.copy(ballWorld).add(new THREE.Vector3(-30, 60, 25)); sun.target.position.copy(ballWorld);
    // balle, anneau, traînée
    ballMesh.position.set(...ball.p); ghost.position.copy(ballMesh.position);
    if (ball.v) { const sp = Math.hypot(...ball.v); if (sp > 0.05) ballMesh.rotation.x += (sp * dt) / TourPhys.R; }
    ring.visible = st.ready; ring.position.set(ball.p[0], ball.p[1] - TourPhys.R + 0.03, ball.p[2]); ring.material.opacity = 0.5 + Math.sin(t * 5) * 0.3;
    if (!st.ready) { trailPts.push(ball.p[0], ball.p[1], ball.p[2]); if (trailPts.length > 180) trailPts.splice(0, 3); } else if (trailPts.length) trailPts.splice(0, 3);
    trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPts, 3)); trail.geometry.computeBoundingSphere();
    // blocs qui cachent la balle : transparents ; balle en filigrane derrière
    const camLocal = tower.worldToLocal(ballWorld.clone().sub(fwd.clone().multiplyScalar(200)));
    const dir = new THREE.Vector3(...ball.p).sub(camLocal).normalize(), r3 = new THREE.Ray(camLocal, dir), box3 = new THREE.Box3(), far = camLocal.distanceTo(new THREE.Vector3(...ball.p)) - 0.4;
    let hidden = false;
    for (const f of live.fades) {
      let block = false;
      if (f.b) { const e = f.ext || (f.ext = aabbHalf(f.b)); box3.min.set(f.b.c[0] - e[0], f.b.c[1] - e[1], f.b.c[2] - e[2]); box3.max.set(f.b.c[0] + e[0], f.b.c[1] + e[1], f.b.c[2] + e[2]); }
      else box3.setFromCenterAndSize(f.deco.position.clone().add(new THREE.Vector3(0, f.r, 0)), new THREE.Vector3(f.r * 2, f.r * 2.4, f.r * 2));
      const hit = r3.intersectBox(box3, new THREE.Vector3());
      if (hit && hit.distanceTo(camLocal) < far && !(f.b && W.broken.has(L.blocks.indexOf(f.b)))) block = true;
      if (block) hidden = true;
      f.k += ((block ? 0.05 : 1) - f.k) * (1 - Math.exp(-dt * 8));
      const ms = f.mesh ? [f.mesh.material, ...(f.extra ? [f.extra.material] : [])] : []; if (f.deco) f.deco.traverse(m => m.isMesh && ms.push(m.material));
      for (const m of ms) { const tr = f.k < 0.99; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = f.k; m.depthWrite = f.k > 0.5; } // un matériau opaque est compilé avec alpha = 1
    }
    ghost.visible = hidden;
    // blocs dynamiques
    for (const [i, mesh] of live.dyn) {
      const b = W.blocks[i];
      if (W.broken.has(i)) { if (mesh.visible) { mesh.visible = false; burst(b.c, b.s === 'crystal' ? ['#c3b4ff', '#7fe6ff'] : b.s === 'ice' ? ['#d6f2ff', '#ffffff'] : ['#8a5a35', '#5fb04a'], 26, 5); } continue; }
      if (b.move || b.topple) { mesh.position.set(...b.c); mesh.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ'); }
      if (b.trigger) mesh.material.emissive.set(W.triggered.has(b.trigger) ? '#5fff8a' : '#000000');
    }
    for (const hb of live.hidden) {
      if (!W.triggered.has(hb.b.hidden)) continue;
      hb.mesh.visible = true; hb.k = Math.min(1, hb.k + dt / 1.2);
      hb.mesh.scale.y = smooth(hb.k); hb.mesh.position.y = (1 - smooth(hb.k)) * (hb.b.c[1] - hb.b.h[1]);
    }
    for (const pk of live.pickups) { pk.g.visible = !W.clubs.has(pk.pk.club); pk.g.rotation.y = t * 1.6; pk.g.position.y = pk.pk.p[1] + Math.sin(t * 2) * 0.15; }
    for (const f of live.falls) f.offset.y = (t * 1.2) % 1;
    for (const g of live.glows) g.children.forEach((c, k) => (c.material.emissiveIntensity = 0.7 + Math.sin(t * 2 + k) * 0.3));
    for (const l of live.flames) l.scale.setScalar(1 + Math.sin(t * 3 + l.position.x) * 0.06);
    for (const c of live.clouds) {
      c.userData.a += dt * c.userData.s; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r;
      c.visible = c.getWorldPosition(tmp).sub(world.position).dot(camDir) < 10; // pas de nuage entre la caméra et la tour
    }
    const fp = flagGeo.attributes.position; for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; fp.setZ(i, Math.sin(t * 5 - x * 3) * x * 0.12); } fp.needsUpdate = true;
    beam.material.opacity = 0.12 + Math.sin(t * 1.5) * 0.05;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.v[1] -= 9.8 * dt; p.m.position.x += p.v[0] * dt; p.m.position.y += p.v[1] * dt; p.m.position.z += p.v[2] * dt; p.m.material.opacity = Math.min(1, p.life); if (p.life <= 0) { tower.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    // aperçu de visée
    arrow.visible = !!st.aim;
    if (st.aim) {
      const { yaw, power } = st.aim, len = 0.8 + power * 3;
      arrow.position.set(ball.p[0] + Math.cos(yaw) * (0.5 + len / 2), ball.p[1], ball.p[2] + Math.sin(yaw) * (0.5 + len / 2));
      arrow.rotation.set(0, -yaw, -Math.PI / 2);
      arrow.children[0].scale.y = len; arrow.children[1].position.y = len / 2 + 0.2;
      const col = power < 0.5 ? '#6fe08a' : power < 0.8 ? '#ffd23f' : '#ff6a6a';
      arrow.children.forEach(m => m.material.color.set(col));
    }
    preview.visible = !!st.preview;
    if (st.preview) { preview.geometry.setAttribute('position', new THREE.Float32BufferAttribute(st.preview.flat(), 3)); preview.geometry.computeBoundingSphere(); }
    // ambiance de l'étage : ciel, brume, lumière (fondu selon l'altitude)
    const y = ball.p[1], bs = L.biomes;
    let i = 0; while (i + 1 < bs.length && y > bs[i + 1].y) i++;
    const nb = bs[i + 1], k = nb ? smooth(Math.max(0, Math.min(1, (y - (nb.y - 3)) / 3))) : 0, A = bs[i], B = nb || A;
    const mix = (a, b) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    ambient = { sky: [mix(A.sky[0], B.sky[0]), mix(A.sky[1], B.sky[1])], fog: mix(A.fog, B.fog), sun: mix(A.sun, B.sun), biome: k > 0.5 ? i + 1 : i };
    scene.fog.color.set(ambient.fog); sun.color.set(ambient.sun); hemi.color.set(ambient.sky[1]);
    gl.render(scene, camera);
    return ambient;
  }
  // Position de la balle à l'écran (pour les textes)
  function toScreen(p) { const v = tower.localToWorld(new THREE.Vector3(...p)).project(camera), r = canvas.getBoundingClientRect(); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; }
  return { live, frame, rotate, pickGround, screenAxes, burst, toScreen, get k() { return view.k; }, reset() { trailPts.length = 0; } };
}
