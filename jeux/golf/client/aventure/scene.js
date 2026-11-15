// Mini-golf, mode Aventure : le dessin de la Tour. Chaque bloc est un volume net, cerné d'un trait, avec le motif de sa
// surface (herbe tondue, lattes, damier, tôle…) ; les pentes portent des flèches qui montrent la descente.
// Lisibilité : vue « maison de poupée » (les murs tournés vers la caméra et tout ce qui est au-dessus de la balle
// s'effacent), balle en filigrane si elle est cachée, repère sous la balle en vol, point d'arrivée du coup.
/* global TourPhys, TourLevel */
import * as THREE from 'three';
import * as P from '../props.js';

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
export const LIGHT = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || innerWidth < 700; // téléphone : allégé

// Apparence de chaque « look » : couleur du dessus, couleur des flancs, motif
const LOOK = {
  lawn: ['#8fd86a', '#a2724a', 'grass'], hedge: ['#4fae4a', '#3f923c', 'leaf'], drystone: ['#d6cdbd', '#aca290', 'stone'], slope: ['#a6e278', '#a2724a', 'grass'],
  terrace: ['#86d35c', '#a8744a', 'grass'], pavilion: ['#f4eee2', '#d8cfc0', 'stone'], boardwalk: ['#e0ac72', '#a8744a', 'plank'],
  clockfloor: ['#f6ecd8', '#cfae70', 'tile'], brass: ['#e8c068', '#b8893a', 'metal'], pivot: ['#d4a840', '#a07820', 'metal'], hand: ['#2f2a48', '#221e38', 'metal'],
  hourhand: ['#6a5530', '#4a3a1a', 'metal'], lift: ['#d0d6e2', '#8a90a0', 'grid'],
  checker: ['#f4f0ea', '#cfc8d8', 'checker'], marblewall: ['#efe9f3', '#d4ccdf', 'stone'], pit: ['#c2b9d0', '#a49ab6', 'stone'], plateA: ['#e0a65e', '#a8743a', 'metal'],
  plateB: ['#e8b870', '#b0803e', 'metal'], column: ['#f6f2fa', '#dad2e6', 'stone'],
  parquet: ['#c99260', '#8a5a35', 'plank'], shelves: ['#8f5d38', '#6b4426', 'books'], book: ['#c0503e', '#f4ead6', 'cover'], bookstack: ['#d8744e', '#f2e6ca', 'books'],
  millfloor: ['#c6bba6', '#8f8270', 'stone'], millwall: ['#ae9f8a', '#8a7c68', 'stone'], dock: ['#c99260', '#8a5a35', 'plank'], bucket: ['#c99260', '#8a5a35', 'plank'], bucketlip: ['#946238', '#6b4426', 'plank'],
  plank: ['#f8dcae', '#c89a6a', 'plank'], fairwall: ['#ff9abb', '#e06a90', 'stripes'], rail: ['#ff6476', '#c83a50', 'rail'], railside: ['#ffd84a', '#e0a020', 'metal'], station: ['#fff3da', '#e8c8a0', 'stone'],
  cobble: ['#bfb8d0', '#8a82a0', 'cobble'], foundation: ['#ddceb4', '#a8987c', 'brick'], spire: ['#7464b4', '#4a3a88', 'stone'],
  deck: ['#e6b886', '#a87a50', 'plank'], mobile: ['#a6e8c0', '#5aa880', 'leaf'],
  organfloor: ['#f4ead6', '#c8a870', 'tile'], organwall: ['#ecc464', '#b88a30', 'metal'], key: ['#ffffff', '#d8d8e0', 'key'], organledge: ['#f6d880', '#c89a3a', 'metal'], organbench: ['#946238', '#6b4426', 'plank'],
  trebframe: ['#b07a40', '#7a4a24', 'plank'], pocket: ['#efe6cc', '#a89878', 'net'], pocketlip: ['#946238', '#6b4426', 'plank'], counterweight: ['#6a6a7c', '#3a3a48', 'metal'],
  summit: ['#ffeaa8', '#e0b860', 'tile'],
};
// Motifs (tuilés en mètres) : dessinés une fois dans un canevas
const PAT = new Map();
function pattern(kind) {
  if (PAT.has(kind)) return PAT.get(kind);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), r = P.rngOf(kind.length * 97);
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  const ink = a => `rgba(40,30,60,${a})`;
  switch (kind) {
    case 'grass': x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 260; i++) { x.fillStyle = ink(0.05 + r() * 0.05); x.fillRect(r() * 128, r() * 128, 1.5, 4); } break;
    case 'leaf': for (let i = 0; i < 90; i++) { x.fillStyle = ink(0.06 + r() * 0.1); x.beginPath(); x.ellipse(r() * 128, r() * 128, 5, 3, r() * 3, 0, TAU); x.fill(); } break;
    case 'stone': x.strokeStyle = ink(0.16); x.lineWidth = 2; for (let y = 0; y < 128; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); for (let k = 0; k < 3; k++) { const xx = ((y / 32) % 2 ? 21 : 0) + k * 43; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 32); x.stroke(); } } break;
    case 'plank': x.strokeStyle = ink(0.2); x.lineWidth = 2; for (let y = 0; y <= 128; y += 21) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); } for (let i = 0; i < 40; i++) { x.fillStyle = ink(0.06); x.fillRect(r() * 128, r() * 128, 14, 1); } break;
    case 'tile': x.strokeStyle = ink(0.14); x.lineWidth = 2; for (let k = 0; k <= 128; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 128); x.moveTo(0, k); x.lineTo(128, k); x.stroke(); } break;
    case 'checker': for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) { x.fillStyle = ink(0.12); x.fillRect(i * 32, j * 32, 32, 32); } break;
    case 'metal': for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = ink(0.18); x.beginPath(); x.arc(i * 32 + 16, j * 32 + 16, 2.5, 0, TAU); x.fill(); } x.strokeStyle = ink(0.1); x.strokeRect(1, 1, 126, 126); break;
    case 'grid': x.strokeStyle = ink(0.22); x.lineWidth = 3; for (let k = 0; k <= 128; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 128); x.moveTo(0, k); x.lineTo(128, k); x.stroke(); } break;
    case 'books': for (let k = 0; k < 128; k += 9) { x.fillStyle = ['#c0503e', '#4a7ab8', '#e0a040', '#5aa070', '#8a5ab0'][Math.floor(r() * 5)]; x.globalAlpha = 0.55; x.fillRect(k, 10 + r() * 10, 8, 108); } x.globalAlpha = 1; break;
    case 'cover': x.strokeStyle = 'rgba(255,230,160,.9)'; x.lineWidth = 4; x.strokeRect(12, 12, 104, 104); x.strokeRect(24, 24, 80, 80); break;
    case 'stripes': for (let k = 0; k < 128; k += 32) { x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(k, 0, 16, 128); } break;
    case 'rail': x.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 128; k += 32) x.fillRect(k, 0, 6, 128); break;
    case 'cobble': for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { x.strokeStyle = ink(0.18); x.lineWidth = 2; x.beginPath(); x.ellipse(i * 22 + 11 + (j % 2) * 5, j * 22 + 11, 9, 8, 0, 0, TAU); x.stroke(); } break;
    case 'brick': x.strokeStyle = ink(0.2); x.lineWidth = 2; for (let y = 0; y < 128; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); for (let k = ((y / 16) % 2) * 16; k < 128; k += 32) { x.beginPath(); x.moveTo(k, y); x.lineTo(k, y + 16); x.stroke(); } } break;
    case 'key': x.fillStyle = ink(0.15); x.fillRect(0, 0, 4, 128); break;
    case 'net': x.strokeStyle = ink(0.35); x.lineWidth = 2; for (let k = -128; k < 256; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); } break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  PAT.set(kind, t);
  return t;
}
// Le monde (0 à 10) auquel appartient une hauteur : un monde tous les 12 m
const worldOf = y => Math.max(0, Math.min(10, Math.floor((y + 1.3) / 12)));
const SCALE = { grass: 4, leaf: 2, stone: 3, plank: 2.4, tile: 2, checker: 4, metal: 2, grid: 1.5, books: 3, cover: 6, stripes: 3, rail: 1.5, cobble: 2, brick: 2, key: 3, net: 1.2 };

/* ---------- Un bloc : boîte avec couleurs (dessus / flancs dégradés), motif en coordonnées du monde ---------- */
function blockGeometry(b, local) {
  const [w, h, d] = b.h.map(x => x * 2);
  const geo = new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.round(h / 2)), 1).toNonIndexed();
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.pitch, b.yaw, b.roll, 'YXZ'));
  if (!local) m.setPosition(...b.c);
  geo.applyMatrix4(m);
  const [top, side, pat] = LOOK[b.look] || ['#d8d0c4', '#a89e8e', 'stone'], sc = SCALE[pat] || 3;
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const cT = new THREE.Color(top), cS = new THREE.Color(side), c = new THREE.Color(), off = local ? b.c : [0, 0, 0];
  const yLo = b.c[1] - b.h[1], ySpan = Math.max(0.5, b.h[1] * 2);
  const slope = b.ramp ? TourPhys.axes(b.yaw, b.pitch, b.roll)[1] : null; // la normale du dessus : on assombrit le bas de la pente
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i) + off[0], y = pos.getY(i) + off[1], z = pos.getZ(i) + off[2], ny = nor.getY(i);
    if (ny > 0.5) {
      c.copy(cT);
      if (slope) c.offsetHSL(0, 0, Math.max(-0.16, Math.min(0.12, -(x * slope[0] + z * slope[2]) * 0.06 - 0.02)));
      uv[i * 2] = x / sc; uv[i * 2 + 1] = z / sc;
    } else {
      const k = Math.max(0, Math.min(1, (y - yLo) / ySpan));
      c.copy(cS).offsetHSL(0, 0, -0.12 + k * 0.12 - (ny < -0.5 ? 0.12 : 0));
      if (k > 0.97 && ny > -0.5 && pat === 'grass') c.copy(cT).offsetHSL(0, 0, -0.08);
      uv[i * 2] = (x + z) / sc; uv[i * 2 + 1] = y / sc;
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
// Les arêtes du bloc (trait de contour)
function edgeGeometry(b, local) {
  const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(...b.h.map(x => x * 2)));
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.pitch, b.yaw, b.roll, 'YXZ'));
  if (!local) m.setPosition(...b.c);
  return g.applyMatrix4(m);
}

export function createScene(canvas) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d6f0dc', 330, 520);
  // Caméra fixe ; c'est la tour qui tourne (quarts de tour) et glisse devant elle
  const VIEW = 44, CAM_YAW = 0.62, CAM_EL = 0.6;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1200);
  const camDir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_EL), Math.sin(CAM_EL), Math.cos(CAM_YAW) * Math.cos(CAM_EL));
  camera.position.copy(camDir).multiplyScalar(400); camera.lookAt(0, 0, 0);
  const fwd = camDir.clone().negate();
  const world = new THREE.Group(), tower = new THREE.Group();
  scene.add(world); world.add(tower);
  const hemi = new THREE.HemisphereLight('#f4fbff', '#8a8478', 1.5);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.1);
  sun.castShadow = true; sun.shadow.mapSize.set(LIGHT ? 1024 : 2048, LIGHT ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);
  const L = TourLevel;
  const live = { blocks: [], deco: [], falls: [], spins: [], glows: [], pickups: [], shards: [], clouds: [], wheel: null, treb: null, pend: null, pipes: [], beacon: null };

  /* ---------- Les blocs ---------- */
  const mats = new Map();
  const matFor = b => {
    const pat = (LOOK[b.look] || [])[2] || 'stone', gloss = ['metal', 'tile', 'checker', 'key', 'rail'].includes(pat), k = pat + gloss;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, map: pattern(pat), roughness: gloss ? 0.45 : 0.85, metalness: pat === 'metal' ? 0.15 : 0 }));
    return mats.get(k);
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: '#2b2552', transparent: true, opacity: 0.32 });
  L.blocks.forEach((b, i) => {
    const moving = !!(b.kin || b.topple);
    const mesh = new THREE.Mesh(blockGeometry(b, moving), matFor(b).clone());
    mesh.castShadow = mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(edgeGeometry(b, moving), edgeMat.clone());
    if (moving) mesh.add(edges); else tower.add(edges);
    tower.add(mesh);
    live.blocks.push({ b, i, mesh, edges, k: 1, moving, w: worldOf(b.c[1] - b.h[1]) });
    if (b.ramp) arrows(b);
  });
  // Flèches peintes sur les pentes : elles pointent vers le bas de la pente
  function arrows(b) {
    const A = TourPhys.axes(b.yaw, b.pitch, b.roll), up = A[1], alongX = b.ramp[0] === 'x';
    const len = alongX ? b.h[0] : b.h[2], dirL = alongX ? A[0] : A[2];
    const sgn = dirL[1] > 0 ? -1 : 1, down = dirL.map(v => v * sgn);
    const shape = new THREE.Shape(); shape.moveTo(0, 0.55); shape.lineTo(0.5, -0.1); shape.lineTo(0.2, -0.1); shape.lineTo(0.2, -0.55); shape.lineTo(-0.2, -0.55); shape.lineTo(-0.2, -0.1); shape.lineTo(-0.5, -0.1); shape.closePath();
    const g = new THREE.ShapeGeometry(shape), m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (let s = -len + 1.2; s <= len - 1; s += 2.4) {
      const a = new THREE.Mesh(g, m), p = b.c.map((c, j) => c + dirL[j] * s + up[j] * (b.h[1] + 0.02));
      a.position.set(...p);
      const z = new THREE.Vector3(...up), yv = new THREE.Vector3(...down), xv = new THREE.Vector3().crossVectors(yv, z);
      a.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xv, yv, z));
      a.scale.setScalar(Math.min(1.2, (alongX ? b.h[2] : b.h[0]) * 0.6));
      tower.add(a); live.deco.push({ obj: a, y: p[1], w: worldOf(p[1]) });
    }
  }

  /* ---------- Décor ---------- */
  const glowMat = (c, k = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3 });
  let decoW = 0; // le monde du décor en cours de pose
  const put = (o, [x, y, z], s = 1, ry = 0) => { o.position.set(x, y, z); o.scale.multiplyScalar(s); o.rotation.y = ry; tower.add(o); live.deco.push({ obj: o, y, w: decoW }); return o; };
  function fall(x, y, z, h, w = 2.4) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128;
    const x2 = c.getContext('2d'); x2.fillStyle = '#7fd8f0'; x2.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 30; i++) { x2.fillStyle = 'rgba(255,255,255,.7)'; x2.fillRect(Math.random() * 32, Math.random() * 128, 1.5, 16 + Math.random() * 30); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2, h / 6); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: 0.85, roughness: 0.2, side: THREE.DoubleSide, emissive: '#5fb8d8', emissiveIntensity: 0.25 }));
    put(m, [x, y - h / 2, z], 1, Math.PI / 2); live.falls.push(t);
  }
  const text = (str, size = 64, color = '#2b2552') => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = color; x.font = `900 ${size}px "Baloo 2", Nunito, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, 128, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  for (const dd of L.deco) {
    const p = dd.p;
    decoW = worldOf(dd.t === 'upsidehouse' ? p[1] - 2 : dd.t === 'wheel' ? p[1] - 6 : dd.t === 'trebuchet' ? p[1] - 4 : p[1]);
    switch (dd.t) {
      case 'tee': put(P.box(2.4, 0.06, 2.4, '#6fc25a', 0, 0.01, 0), p); for (const s of [-1, 1]) put(P.ball(0.22, '#ff5a6e'), [p[0] + s * 1.6, p[1] + 0.2, p[2]]); break;
      case 'flowerbed': for (let k = 0; k < 4; k++) put(P.tree('flowers', 0.16), [p[0] + (k % 2) * 1.4, p[1], p[2] + Math.floor(k / 2) * 1.4]); break;
      case 'tree': put(P.tree('round', 0.13), p); break;
      case 'fountain': put(P.fountain('#6fe0f0'), p, 0.13); break;
      case 'stele': { const g = new THREE.Group(); g.add(P.box(0.9, 1.6, 0.3, '#e8e0d0', 0, 0, 0)); const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), glowMat('#7fe6ff', 1)); glyph.position.set(0, 1.1, 0.16); g.add(glyph); put(P.shadows(g), p, 1, 0.6); break; }
      case 'clockface':
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, r = 12.6, m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: text(['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][k], 70, '#5a4020'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = -a; put(m, [Math.sin(a) * r, p[1] + 0.02, Math.cos(a) * r]).rotation.order = 'YXZ'; }
        break;
      case 'gearwall': { const g = P.gear(4, '#d8a840'); put(g, p, 0.35, dd.side === 'w' ? Math.PI / 2 : 0); live.spins.push({ obj: g.children[0], axis: 'z', speed: 0.4 }); break; }
      case 'pendulum': { const g = new THREE.Group(); g.add(P.cyl(0.08, 0.08, 6, '#b8893a', 0, -6, 0, 6), P.ball(1, '#e8c068', 0, -6.5, 0)); put(g, p); live.pend = g; break; }
      case 'chain': { const a = new THREE.Vector3(...p), b = new THREE.Vector3(...dd.to), n = Math.round(a.distanceTo(b) / 0.5); for (let k = 0; k <= n; k++) { const q = a.clone().lerp(b, k / n); const l = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 10), P.mat('#c9a040', { metalness: 0.5 })); l.rotation.set(k % 2 ? Math.PI / 2 : 0, Math.atan2(b.x - a.x, b.z - a.z), 0); put(l, [q.x, q.y + 0.25, q.z]); } break; }
      case 'statue': { const g = new THREE.Group(); g.add(P.box(2, 1, 2, '#efe8f2'), P.box(1, 3, 1, '#f6f2fa', 0, 1, 0), P.ball(0.7, '#f6f2fa', 0, 4.7, 0)); put(P.shadows(g), p); break; }
      case 'bookpile': for (let k = 0; k < 5; k++) put(P.box(2.2 - k * 0.15, 0.4, 1.6, ['#c0503e', '#4a7ab8', '#e0a040', '#5aa070', '#8a5ab0'][k], 0, 0, 0, 0.05), [p[0], p[1] + k * 0.4, p[2]], 1, k * 0.3); break;
      case 'lamp': { const g = new THREE.Group(); g.add(P.cyl(0.08, 0.12, 2.6, '#3a3550'), P.cone(0.6, 0.6, '#2f8a5a', 0, 2.4)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glowMat('#ffe08a', 2)); l.position.y = 2.4; g.add(l); put(g, p); break; }
      case 'chandelier': { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.1, 8, 32), P.mat('#c9a040'))); g.children[0].rotation.x = Math.PI / 2; for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat('#ffe08a', 2)); l.position.set(Math.cos(k * 0.785) * 2.5, 0.2, Math.sin(k * 0.785) * 2.5); g.add(l); } put(g, p); break; }
      case 'wheel': { const g = new THREE.Group(); const rim = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.25, 8, 48), P.mat('#8a5a35')); rim.rotation.y = Math.PI / 2; g.add(rim); for (let k = 0; k < 6; k++) { const piv = new THREE.Group(); piv.add(P.box(0.3, 5.5, 0.3, '#946238', 0, -5.5, 0)); piv.rotation.x = (k / 6) * TAU; g.add(piv); } const hub = P.cyl(0.8, 0.8, 1.2, '#5a3a20'); hub.rotation.z = Math.PI / 2; g.add(hub); put(P.shadows(g), [p[0] + 1.6, p[1], p[2]]); live.wheel = g; break; }
      case 'millstone': { const m = P.cyl(2.2, 2.2, 0.8, '#b8ae9c'); put(m, p); live.spins.push({ obj: m, axis: 'y', speed: 0.5 }); break; }
      case 'waterfall': fall(p[0], p[1], p[2], dd.h, 3.5); break;
      case 'sacks': for (let k = 0; k < 4; k++) put(P.ball(0.7, '#e8d4a8'), [p[0] + k * 0.9, p[1] + 0.5, p[2] + (k % 2) * 0.6]).scale.y = 0.7; break;
      case 'loop': { const t = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.25, 8, 40), P.mat('#ff6476')); t.position.y = 3.6; const g = new THREE.Group(); g.add(t); put(g, p); break; }
      case 'bunting': for (let k = 0; k < 14; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 3), P.mat(['#ff6476', '#ffd84a', '#5ab4ff', '#7ae08a'][k % 4])); f.rotation.x = Math.PI; put(f, [p[0] - 13 + k * 2, p[1], p[2]]); } break;
      case 'lights': for (let k = 0; k < 16; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat(['#ffe08a', '#ff9ac0', '#9fe8ff'][k % 3], 2)); put(l, [Math.cos(k * 0.39) * 13, p[1], Math.sin(k * 0.39) * 13]); live.glows.push(l); } break;
      case 'upsidehouse': { const h = P.house(30, 24, 22, '#fff1e0', ['#e0605e', '#5b7bd6', '#5aa070'][Math.abs(Math.round(p[0])) % 3], { cols: 2 }); h.rotation.x = Math.PI; put(h, p, 0.16); break; }
      case 'wires': for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(P.cyl(0.03, 0.03, 0.01, '#5a5a6a'), [p[0] + dx, p[1], p[2] + dz]); break;
      case 'pipes': for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.add(P.cyl(1, 1, 0.6, glowMat('#e8c060', 0)), P.cyl(1.15, 1.15, 0.3, '#b88a30', 0, 0.6, 0)); put(P.shadows(g), [-4.5 + k * 3, p[1], p[2] + 1.8]); live.pipes.push(g); } break;
      case 'score': { const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: text('♪ 1 · 3 · 2 · 4', 52, '#3a2a10'), color: '#fff8e0' })); put(m, [p[0], p[1] + 3, p[2] - 0.98]); break; }
      case 'trebuchet': { const arm = new THREE.Group(); const beam = P.box(7.8, 0.35, 0.35, '#a8743a', 0, -0.175, 0); beam.rotation.z = Math.PI / 4; arm.add(beam); arm.add(P.box(1.4, 1.4, 1.4, '#5a5a6a', 2.3, 1.6, 0)); put(P.shadows(arm), p); live.treb = arm; break; }
      case 'banners': for (let k = 0; k < 5; k++) put(P.box(1.2, 3, 0.1, ['#c0503e', '#e0a040', '#4a7ab8'][k % 3], 0, 0, 0), [p[0] - 8 + k * 4, p[1] + 3, p[2] + 0.6]); break;
      case 'beacon': { const b = new THREE.Group(); for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), glowMat(['#b49cff', '#7fe6ff', '#ff9ce6'][k % 3], 1)); c.scale.set(1, 2.5 + (k % 3), 1); c.position.set(Math.cos(k) * 0.8, 1.4, Math.sin(k) * 0.8); b.add(c); } live.glows.push(b); live.beacon = b; tower.add(b); break; }
      case 'stars': { const n = 400, pos = new Float32Array(n * 3), r = P.rngOf(13); for (let k = 0; k < n; k++) { const a = r() * TAU, rad = 80 + r() * 80; pos.set([Math.cos(a) * rad, 90 + r() * 90, Math.sin(a) * rad], k * 3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tower.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false }))); break; }
    }
  }
  // Le trou du sommet (il tourne avec son disque), drapeau, rayon de lumière visible de loin
  const cupG = new THREE.Group();
  cupG.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#10140f', polygonOffset: true, polygonOffsetFactor: -3 })));
  cupG.add(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -3 })));
  cupG.children.forEach(m => (m.rotation.x = -Math.PI / 2));
  cupG.add(P.cyl(0.05, 0.05, 3.2, '#ffffff', 0, 0, 0, 8));
  const flagGeo = new THREE.PlaneGeometry(1.4, 0.9, 8, 3); flagGeo.translate(0.7, 0, 0);
  const flag = new THREE.Mesh(flagGeo, P.mat('#ff4f7b', { side: THREE.DoubleSide })); flag.position.y = 2.75; cupG.add(flag);
  const flagBase = flagGeo.attributes.position.array.slice();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 40; cupG.add(beam);
  tower.add(cupG);

  // Clubs à trouver, éclats d'étoile
  for (const pk of L.pickups) {
    const g = new THREE.Group();
    g.add(P.cyl(0.06, 0.06, 1.6, '#e8e8f0', 0, 0, 0, 8), P.box(0.5, 0.2, 0.18, glowMat('#ffd23f', 0.8), 0.18, 0, 0, 0.05));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 32), glowMat('#ffe9a0', 1.4)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.8; g.add(halo);
    g.position.set(...pk.p); tower.add(g); live.pickups.push({ pk, g });
  }
  for (const sh of L.shards || []) {
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glowMat('#ffe36a', 1.8));
    m.scale.set(1, 1.5, 1); g.add(m);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.25, depthWrite: false })));
    g.position.set(...sh.p); tower.add(g); live.shards.push({ sh, g });
  }
  // Nuages autour de la tour, à toutes les hauteurs, et une mer de nuages en bas
  const cr = P.rngOf(77);
  for (let k = 0; k < 34; k++) {
    const c = P.cloud(cr, 0.12 + cr() * 0.14), a = cr() * TAU, r = 46 + cr() * 50;
    c.position.set(Math.cos(a) * r, -10 + cr() * 140, Math.sin(a) * r); c.userData = { a, r, s: 0.01 + cr() * 0.02 };
    tower.add(c); live.clouds.push(c);
  }
  for (let k = 0; k < 40; k++) { const c = P.cloud(cr, 0.5 + cr() * 0.4), a = cr() * TAU, r = 34 + cr() * 90; c.position.set(Math.cos(a) * r, -30 - cr() * 6, Math.sin(a) * r); tower.add(c); }

  /* ---------- La balle, la visée ---------- */
  const R = TourPhys.R;
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.7, emissive: '#fff6e0', emissiveIntensity: 0.18 }));
  ballMesh.castShadow = true; tower.add(ballMesh);
  const ghost = new THREE.Mesh(new THREE.SphereGeometry(R * 1.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe36a', transparent: true, opacity: 0.6, depthTest: false }));
  ghost.renderOrder = 20; tower.add(ghost);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; tower.add(ring);
  const trailPts = [], trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  tower.add(trail);
  const preview = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffe14a', size: 7, sizeAttenuation: false, transparent: true, opacity: 0.95, depthTest: false }));
  preview.renderOrder = 21; tower.add(preview);
  const landing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 32), new THREE.MeshBasicMaterial({ color: '#ffe14a', transparent: true, opacity: 0.95, depthTest: false }));
  landing.rotation.x = -Math.PI / 2; landing.renderOrder = 22; tower.add(landing);
  const drop = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }));
  drop.rotation.x = -Math.PI / 2; drop.renderOrder = 19; tower.add(drop);
  const dropLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.7 }));
  tower.add(dropLine);
  // anneau de puissance autour de la balle, et flèche de direction
  const powerRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 48), new THREE.MeshBasicMaterial({ color: '#6fe08a', transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
  powerRing.rotation.x = -Math.PI / 2; powerRing.renderOrder = 23; tower.add(powerRing);
  const powerBack = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 48), new THREE.MeshBasicMaterial({ color: '#2b2552', transparent: true, opacity: 0.35, depthTest: false }));
  powerBack.rotation.x = -Math.PI / 2; powerBack.renderOrder = 22; tower.add(powerBack);
  const arrow = new THREE.Group();
  arrow.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false })), new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false })));
  arrow.children.forEach(m => (m.renderOrder = 24));
  arrow.visible = false; tower.add(arrow);
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
  function awayYaw() { const f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -view.rotGoal); return Math.atan2(f.z, f.x); }
  let cine = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, LIGHT ? 1.5 : 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { gl.setPixelRatio(dpr); gl.setSize(w, h, false); }
    const a = w / h, vh = lerp(a < 0.8 ? VIEW * 1.35 : VIEW, 160, smooth(cine));
    Object.assign(camera, { left: (-vh * a) / 2, right: (vh * a) / 2, top: vh / 2, bottom: -vh / 2 });
    camera.updateProjectionMatrix();
  }
  const tmp = new THREE.Vector3(), ray = new THREE.Raycaster();
  function pickGround(clientX, clientY, y) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const wy = tower.localToWorld(tmp.set(0, y, 0)).y, p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -wy), p)) return null;
    return tower.worldToLocal(p);
  }
  // Les faces de la tour tournées vers la caméra (dans le repère de la tour) : on les voit en transparence
  function cameraFaces() {
    const f = new THREE.Vector3(-fwd.x, 0, -fwd.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -view.rot);
    return { s: f.z > 0.3, n: f.z < -0.3, e: f.x > 0.3, w: f.x < -0.3 };
  }

  /* ---------- Une image ---------- */
  function frame(st) {
    resize();
    const { ball, world: W, t, dt } = st, by = ball.p[1];
    const dr = view.rotGoal - view.rot;
    view.rot += Math.abs(dr) < 1e-4 ? dr : dr * (1 - Math.exp(-dt * 7));
    tower.rotation.y = view.rot;
    tower.updateMatrixWorld();
    const bw = tmp.set(...ball.p).applyAxisAngle(new THREE.Vector3(0, 1, 0), view.rot);
    const goal = bw.clone().sub(fwd.clone().multiplyScalar(bw.dot(fwd))).negate();
    goal.y -= 4;
    if (st.cinematic) { cine = Math.min(1, cine + dt / 3); view.rotGoal += dt * 0.25; const c = tmp.set(0, 55, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), view.rot); goal.lerp(c.clone().sub(fwd.clone().multiplyScalar(c.dot(fwd))).negate(), smooth(cine)); }
    view.follow.lerp(goal, 1 - Math.exp(-dt * 3.2));
    world.position.copy(view.follow);
    world.updateMatrixWorld();
    const ballWorld = tower.localToWorld(new THREE.Vector3(...ball.p));
    sun.position.copy(ballWorld).add(new THREE.Vector3(-35, 70, 30)); sun.target.position.copy(ballWorld);
    ballMesh.position.set(...ball.p); ghost.position.copy(ballMesh.position);
    const sp = Math.hypot(...ball.v); if (sp > 0.05) ballMesh.rotation.x += (sp * dt) / R;
    ring.visible = st.ready && !st.aim; ring.position.set(ball.p[0], by - R + 0.03, ball.p[2]); ring.material.opacity = 0.5 + Math.sin(t * 5) * 0.3;
    if (!st.ready) { trailPts.push(...ball.p); if (trailPts.length > 180) trailPts.splice(0, 3); } else if (trailPts.length) trailPts.splice(0, 3);
    trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPts, 3)); trail.geometry.computeBoundingSphere();
    // Maison de poupée : au-dessus de la balle, on efface ; murs tournés vers la caméra, en transparence ; ce qui cache la balle aussi
    const faces = cameraFaces(), bp = new THREE.Vector3(...ball.p), camLocal = tower.worldToLocal(ballWorld.clone().sub(fwd.clone().multiplyScalar(300)));
    const r3 = new THREE.Ray(camLocal, bp.clone().sub(camLocal).normalize()), box3 = new THREE.Box3(), hitP = new THREE.Vector3(), farD = camLocal.distanceTo(bp) - 0.4;
    let hidden = false;
    const cw = worldOf(by - 0.6); // le monde où se trouve la balle
    for (const L2 of live.blocks) {
      const b = W.blocks[L2.i];
      if (L2.moving) { L2.mesh.position.set(...b.c); L2.mesh.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ'); }
      let target = 1;
      if (!TourPhys.solid(W, b)) target = 0;
      else if (st.cinematic) target = 1;
      else if (L2.w > cw && !b.show) target = 0; // les mondes du dessus (et leur plancher, notre plafond)
      else if (b.face && faces[b.face] && L2.w === cw) target = 0.12; // murs côté caméra
      else if (b.floor && b.lo[1] > by + 2.4) target = 0;
      else {
        box3.min.set(...b.lo); box3.max.set(...b.hi);
        const hit = r3.intersectBox(box3, hitP);
        if (hit && hit.distanceTo(camLocal) < farD && b.hi[1] > by + 0.2) { target = 0.1; hidden = true; }
      }
      if (b.hidden && TourPhys.solid(W, b)) { L2.rise = Math.min(1, (L2.rise || 0) + dt / 1.2); L2.mesh.scale.y = Math.max(0.01, smooth(L2.rise)); }
      L2.k += (target - L2.k) * (1 - Math.exp(-dt * 9));
      const vis = L2.k > 0.02;
      L2.mesh.visible = vis; if (!L2.moving) L2.edges.visible = vis && L2.k > 0.5;
      const m = L2.mesh.material, tr = L2.k < 0.99;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } // un matériau opaque est compilé avec alpha = 1
      m.opacity = L2.k; m.depthWrite = L2.k > 0.5;
      L2.edges.material.opacity = 0.32 * L2.k;
      if (W.broken.has(L2.i) && !L2.burst) { L2.burst = true; burst(b.c, ['#c0503e', '#f4ead6'], 20, 5); }
    }
    ghost.visible = hidden;
    for (const d2 of live.deco) d2.obj.visible = st.cinematic || (d2.w === cw) || (d2.w < cw && d2.y < 12 * cw - 4);
    // repère sous la balle en vol, point d'arrivée
    const gy = !st.ready && !ball.ground ? TourPhys.groundBelow(W, ball.p) : null;
    drop.visible = dropLine.visible = gy !== null && by - gy > 1.2;
    if (drop.visible) { drop.position.set(ball.p[0], gy + 0.04, ball.p[2]); dropLine.geometry.setFromPoints([bp, new THREE.Vector3(ball.p[0], gy, ball.p[2])]); dropLine.computeLineDistances(); }
    landing.visible = !!st.preview?.length;
    if (landing.visible) { const e = st.preview.at(-1); landing.position.set(e[0], e[1] - R + 0.05, e[2]); landing.scale.setScalar(1 + Math.sin(t * 6) * 0.1); }
    // visée : flèche et anneau de puissance au sol
    arrow.visible = powerRing.visible = powerBack.visible = !!st.aim;
    if (st.aim) {
      const { yaw, power } = st.aim, len = 1 + power * 3.2, col = power < 0.5 ? '#6fe08a' : power < 0.8 ? '#ffd23f' : '#ff6a6a';
      arrow.position.set(ball.p[0] + Math.cos(yaw) * (0.9 + len / 2), by, ball.p[2] + Math.sin(yaw) * (0.9 + len / 2));
      arrow.rotation.set(0, -yaw, -Math.PI / 2);
      arrow.children[0].scale.y = len; arrow.children[1].position.y = len / 2 + 0.25;
      arrow.children.forEach(m => m.material.color.set(col));
      powerRing.geometry.dispose(); powerRing.geometry = new THREE.RingGeometry(0.75, 1.0, 48, 1, Math.PI / 2, Math.max(0.01, power) * TAU);
      powerRing.material.color.set(col);
      for (const r2 of [powerRing, powerBack]) r2.position.set(ball.p[0], by - R + 0.05, ball.p[2]);
    }
    preview.visible = !!st.preview;
    if (st.preview) { preview.geometry.setAttribute('position', new THREE.Float32BufferAttribute(st.preview.flat(), 3)); preview.geometry.computeBoundingSphere(); }
    // animations du décor
    for (const pk of live.pickups) { pk.g.visible = !W.clubs.has(pk.pk.club) && worldOf(pk.pk.p[1]) <= cw; pk.g.rotation.y = t * 1.6; }
    for (const s of live.shards) { s.g.visible = !W.shards.has(s.sh.id) && worldOf(s.sh.p[1]) <= cw; s.g.rotation.y = t * 2; s.g.position.y = s.sh.p[1] + Math.sin(t * 2.5 + s.sh.id) * 0.15; }
    for (const f of live.falls) f.offset.y = (t * 1.2) % 1;
    for (const s of live.spins) s.obj.rotation[s.axis] += dt * s.speed;
    for (const g of live.glows) (g.children.length ? g.children : [g]).forEach((c, k) => c.material && (c.material.emissiveIntensity = 0.8 + Math.sin(t * 2 + k) * 0.4));
    if (live.wheel) live.wheel.rotation.x = (TAU / 20) * W.t;
    if (live.pend) live.pend.rotation.z = Math.sin(t * 1.6) * 0.35;
    if (live.treb) live.treb.rotation.z = -W.treb.a;
    live.pipes.forEach((g, i) => { const on = TourPhys.windOn(W, { key: i + 1, on: 4 }); g.children[0].material.emissiveIntensity = on ? 1.2 + Math.sin(t * 20) * 0.3 : 0; });
    for (const c of live.clouds) { c.userData.a += dt * c.userData.s; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; c.visible = c.getWorldPosition(tmp).sub(world.position).dot(camDir) < 10; }
    const cup = TourPhys.cupAt(W); cupG.position.set(...cup); cupG.visible = cw >= 9 || st.cinematic;
    const fp = flagGeo.attributes.position; for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; fp.setZ(i, Math.sin(t * 5 - x * 3) * x * 0.12); } fp.needsUpdate = true;
    if (live.beacon) live.beacon.position.set(cup[0] - 2.5, cup[1], cup[2] - 2.5);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.v[1] -= 9.8 * dt; p.m.position.x += p.v[0] * dt; p.m.position.y += p.v[1] * dt; p.m.position.z += p.v[2] * dt; p.m.material.opacity = Math.min(1, p.life); if (p.life <= 0) { tower.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    // ambiance du monde
    const bs = L.biomes; let i = 0; while (i + 1 < bs.length && by > bs[i + 1].y) i++;
    const nb = bs[i + 1], k = nb ? smooth(Math.max(0, Math.min(1, (by - (nb.y - 3)) / 3))) : 0, A = bs[i], B = nb || A;
    const mix = (a, b) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const ambient = { sky: [mix(A.sky[0], B.sky[0]), mix(A.sky[1], B.sky[1])], fog: mix(A.fog, B.fog), sun: mix(A.sun, B.sun), biome: k > 0.5 ? i + 1 : i };
    scene.fog.color.set(ambient.fog); sun.color.set(ambient.sun); hemi.color.set(ambient.sky[1]);
    gl.render(scene, camera);
    return ambient;
  }
  function toScreen(p) { const v = tower.localToWorld(new THREE.Vector3(...p)).project(camera), r = canvas.getBoundingClientRect(); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; }
  return { live, frame, rotate, awayYaw, pickGround, burst, toScreen, get k() { return view.k; } };
}
