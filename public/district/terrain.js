// Little District : le relief autour des rues. Colline du sanctuaire au nord (mur de pierres, escalier, torii),
// canal au sud (eau qui miroite, pont rouge, carpes), rive d'en face avec saules et lanternes.
import * as THREE from 'three';
import { TEX, canvasTex, std, textured, glowMat, box, cyl, ball, shape, sub, gableRoof, makeDecor, makePerson, lightPool, streak, foliage, bake, seeded } from './models.js';

export const HILL = { z0: 14.8, z1: 20.5, y: 1.6 };
export const CANAL = { z0: -18.8, z1: -15.3, water: -0.42 };
export const BASE = { x: 13.3, z0: -21.5, z1: 20.5 };
const GY = 0.06;

const STONE = () => canvasTex('stonewall', 256, 128, (x, w, h) => {
  const r = seeded(31);
  x.fillStyle = '#3c3a36'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 22) for (let px = -(r() * 30); px < w; ) {
    const sw = 26 + r() * 30;
    x.fillStyle = `hsl(35, ${4 + r() * 6}%, ${30 + r() * 16}%)`;
    x.beginPath(); x.roundRect(px + 2, y + 2, sw - 3, 19, 5); x.fill();
    px += sw;
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(70,100,50,.35)'; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 7); x.fill(); } // mousse
}, { repeat: [1, 1] });
const GRASS = () => canvasTex('grass', 256, 256, (x, w, h) => {
  const r = seeded(37);
  x.fillStyle = '#41552e'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `hsl(${80 + r() * 30}, ${30 + r() * 25}%, ${18 + r() * 22}%)`; x.fillRect(r() * w, r() * h, 1.5, 3 + r() * 3); }
}, { repeat: [1, 1] });
// Carte de reliefs pour l'eau : vaguelettes qui défilent
const WATER_N = () => canvasTex('waterN', 256, 256, (x, w, h) => {
  const hgt = new Float32Array(w * h), r = seeded(43);
  const waves = Array.from({ length: 14 }, () => [r() * 6.28, (1 + r() * 4) * 2 * Math.PI / w, (1 + r() * 4) * 2 * Math.PI / h, r()]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = 0;
    for (const [ph, kx, ky, a] of waves) v += Math.sin(i * Math.round(kx * w / 6.28) * 6.28 / w + j * Math.round(ky * h / 6.28) * 6.28 / h + ph) * a;
    hgt[j * w + i] = v;
  }
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = hgt[j * w + (i + 1) % w] - hgt[j * w + (i + w - 1) % w], dy = hgt[((j + 1) % h) * w + i] - hgt[((j + h - 1) % h) * w + i];
    const k = (j * w + i) * 4, nx = -dx * 0.6, ny = -dy * 0.6, l = Math.hypot(nx, ny, 1);
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}, { repeat: [6, 1], color: false });

// Saule pleureur : couronne et longues branches qui tombent
function willow(p, x, z, s = 1) {
  const g = sub(p, x, GY, z, x);
  const trunk = cyl(g, 0.1 * s, 1.4 * s, std('#4a3829'), 0, 0, 0); trunk.rotation.z = 0.12;
  const leaf = foliage('green');
  shape(g, new THREE.IcosahedronGeometry(0.5, 1), leaf, 0.1, 1.55 * s, 0, 1.6 * s, 0.7 * s, 1.6 * s);
  const r = seeded(Math.round(x * 100 + z));
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.28, d = (0.3 + r() * 0.5) * s, len = (0.6 + r() * 0.6) * s;
    box(g, 0.07, len, 0.07, leaf, Math.cos(a) * d + 0.1, 1.55 * s - len, Math.sin(a) * d);
  }
  return g;
}
// Petit pont rouge en arc (taikobashi)
function bridge(p) {
  const g = sub(p, 0, 0, 0), red = std('#c0392b', { roughness: 0.55 }), wood = textured('bridgewood', TEX.wood('#6b4a32'));
  const n = 14, z0 = CANAL.z1 + 0.3, z1 = CANAL.z0 - 0.3, arc = t => GY + Math.sin(Math.PI * t) * 0.55;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ya = arc(t0), yb = arc(t1);
    const s = box(g, 1.3, 0.08, Math.hypot(zb - za, yb - ya) + 0.02, wood, 0, 0, 0);
    s.position.set(0, (ya + yb) / 2, (za + zb) / 2); s.rotation.x = Math.atan2(yb - ya, za - zb);
  }
  for (const sx of [-0.68, 0.68]) {
    const pts = Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3(sx, arc(i / n) + 0.42, z0 + ((z1 - z0) * i) / n));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 6), red));
    for (let i = 0; i <= n; i += 2) cyl(g, 0.035, 0.44, red, sx, arc(i / n) - 0.02, z0 + ((z1 - z0) * i) / n);
    for (const z of [z0, z1]) { cyl(g, 0.06, 0.55, red, sx, GY, z); ball(g, 0.07, std('#c9a24a', { metalness: 0.7, roughness: 0.3 }), sx, GY + 0.62, z, 1.3); } // giboshi
  }
  // piliers dans l'eau
  for (const z of [z0 + 0.6, z1 - 0.6]) for (const sx of [-0.5, 0.5]) cyl(g, 0.06, 0.9, red, sx, CANAL.water - 0.4, z);
  return { path: arc, z0, z1 };
}
// Sanctuaire shintō sur la colline
function shrine(p, glows) {
  const g = sub(p, 0, HILL.y, 18.7), red = std('#b8321f', { roughness: 0.6 }), dark = textured('shrinewood', TEX.wood('#3a281d'));
  box(g, 3.4, 0.32, 2.6, std('#8d8a83', { roughness: 0.95 }), 0, 0, 0);
  for (let i = 0; i < 3; i++) box(g, 1.2, 0.1, 0.25, std('#8d8a83'), 0, i * 0.1, -1.45 + i * 0.12);
  for (const [x, z] of [[-1.4, -1.05], [1.4, -1.05], [-1.4, 1.05], [1.4, 1.05], [-0.5, -1.05], [0.5, -1.05]]) cyl(g, 0.08, 1.5, red, x, 0.32, z);
  box(g, 2.9, 1.4, 0.1, dark, 0, 0.32, 1.05);
  for (const s of [-1, 1]) box(g, 0.1, 1.4, 2.1, dark, s * 1.42, 0.32, 0);
  box(g, 3.1, 0.12, 0.14, red, 0, 1.62, -1.05);
  const shoji = glowMat('shrineShoji', '#ffffff', TEX.shoji(), 0.08, 1.2, 0);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.05), shoji); sh.position.set(0, 0.85, -0.6); g.add(sh);
  const roof = sub(g, 0, 0, 0); gableRoof(roof, 3.2, 2.4, 1.82, '#2b3a3a', 0.62);
  box(g, 0.9, 0.35, 0.45, dark, 0, 0.32, -1.6); // boîte à offrandes
  const rope = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 6, 24, Math.PI), std('#d8c9a0'));
  rope.rotation.set(0, 0, Math.PI); rope.scale.set(1, 0.25, 1); rope.position.set(0, 1.55, -1.1); g.add(rope);
  ball(g, 0.11, std('#c9a24a', { metalness: 0.8, roughness: 0.3 }), 0, 1.15, -1.12); // cloche
  for (const s of [-1, 1]) { // komainu
    const st = std('#8d8a83', { roughness: 0.95 });
    box(g, 0.35, 0.3, 0.35, st, s * 1.9, -HILL.y + HILL.y, -1.7);
    ball(g, 0.16, st, s * 1.9, 0.45, -1.7, 1.1); ball(g, 0.11, st, s * 1.9, 0.68, -1.78);
  }
  glows.push({ x: 0, y: 1, z: 18.1, color: '#ffcf86', pool: true, r: 1.8, yb: HILL.y });
}

export function buildTerrain(scene, low) {
  const root = new THREE.Group(), glowsDef = [];
  const sideTex = TEX.strata().clone(); sideTex.needsUpdate = true; sideTex.repeat.set(3, 1);
  const strata = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95 });
  const stoneTex = STONE().clone(); stoneTex.needsUpdate = true; stoneTex.repeat.set(14, 1.2);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 });
  const top = std('#3d3a36');
  const block = (z0, z1, y0, y1, faces) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(BASE.x * 2, y1 - y0, z1 - z0), faces);
    m.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = m.castShadow = true; scene.add(m);
    return m;
  };
  // ordre des faces : +x, -x, +y, -y, +z, -z
  block(CANAL.z1, HILL.z0, -1.4, 0, [strata, strata, top, top, strata, stone]);
  block(CANAL.z0, CANAL.z1, -1.4, CANAL.water - 0.18, [strata, strata, std('#1f2a22'), top, strata, strata]);
  block(BASE.z0, CANAL.z0, -1.4, 0, [strata, strata, top, top, stone, strata]);
  block(HILL.z0, BASE.z1, -1.4, HILL.y, [strata, strata, top, top, strata, stone]);
  // Socle en bois sous toute la maquette
  const rim = std('#2a1c14', { roughness: 0.45 });
  for (const s of [-1, 1]) {
    box(scene, BASE.x * 2 + 0.5, 0.25, 0.25, rim, 0, -1.55, s < 0 ? BASE.z0 - 0.12 : BASE.z1 + 0.12);
    box(scene, 0.25, 0.25, BASE.z1 - BASE.z0 + 0.5, rim, s * (BASE.x + 0.12), -1.55, (BASE.z0 + BASE.z1) / 2);
  }

  // Sols
  const grassMat = n => { const t = GRASS().clone(); t.needsUpdate = true; t.repeat.set(...n); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); };
  const flat = (w, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; scene.add(o); return o; };
  const paveT = TEX.pave().clone(); paveT.needsUpdate = true; paveT.repeat.set(9, 0.6);
  const paveM = new THREE.MeshStandardMaterial({ map: paveT, roughness: 0.9 });
  flat(BASE.x * 2, HILL.z0 - 13.3, paveM, 0, GY, (13.3 + HILL.z0) / 2);
  flat(BASE.x * 2, -13.3 - CANAL.z1, paveM, 0, GY, (-13.3 + CANAL.z1) / 2);
  flat(BASE.x * 2, CANAL.z0 - BASE.z0, grassMat([8, 1]), 0, GY, (BASE.z0 + CANAL.z0) / 2);
  flat(BASE.x * 2, BASE.z1 - HILL.z0, grassMat([8, 2]), 0, HILL.y + 0.01, (HILL.z0 + BASE.z1) / 2);
  const gravel = textured('gravel', TEX.dirt());
  flat(1.5, 3.4, gravel, 0, HILL.y + 0.02, HILL.z0 + 1.7);
  flat(BASE.x * 2 - 2, 1, gravel, 0, HILL.y + 0.02, 16.5);
  flat(BASE.x * 2, 0.9, gravel, 0, GY + 0.005, -20.2);
  const groundMats = [paveM];

  // Escalier vers la colline
  const st = std('#8d8a83', { roughness: 0.95 });
  for (let k = 0; k < 8; k++) { const s = box(root, 1.6, (k + 1) * 0.2 + 0.02, 0.32, st, 0, 0, 12.55 + k * 0.3 + 0.15); s.receiveShadow = true; }
  for (const s of [-1, 1]) box(root, 0.25, HILL.y + 0.3, 2.4, stone, s * 0.92, 0, 13.6);
  // Barrière en bois au bord de la colline
  const fence = std('#5a3e2a');
  for (const s of [-1, 1]) {
    for (let x = 1.2; x <= 13; x += 0.9) box(root, 0.06, 0.45, 0.06, fence, s * x, HILL.y, HILL.z0 + 0.12);
    box(root, 12, 0.05, 0.05, fence, s * 7.1, HILL.y + 0.38, HILL.z0 + 0.12);
  }
  const deco = (id, x, y, z, sc = 1, r = 0) => { const d = makeDecor(id); d.position.set(x, y, z); d.scale.setScalar(sc); d.rotation.y = r; root.add(d); (d.userData.glows || []).forEach(gl => glowsDef.push({ ...gl, x: x + gl.x * sc, z: z + gl.z * sc, yb: y })); return d; };
  deco('torii', 0, HILL.y, HILL.z0 + 0.7, 1.25);
  shrine(root, glowsDef);
  for (const s of [-1, 1]) {
    deco('sakura', s * 6, HILL.y, 18.3, 1.15, s);
    deco('toro', s * 1.1, HILL.y, 16.5); deco('toro', s * 1.1, HILL.y, 17.6);
    deco('bambou', s * 11.5, HILL.y, 19.2, 1.4); deco('bambou', s * 12.2, HILL.y, 17.8, 1.2);
    deco('erable', s * 9.5, HILL.y, 19.4, 1.3, s * 2);
    deco('banc', s * 3.5, HILL.y, 15.6, 1, Math.PI);
    deco('toro', s * 1.3, GY, 12.7);
  }
  for (let i = 0; i < 9; i++) { const r = seeded(50 + i); const rock = shape(root, new THREE.DodecahedronGeometry(0.5, 0), std('#6f6c66', { flatShading: true }), (r() - 0.5) * 24, HILL.y + 0.1, 19 + r() * 1.3, 0.4 + r() * 0.5, 0.3 + r() * 0.3, 0.4 + r() * 0.5); rock.rotation.y = r() * 6; }

  // Canal : promenade avec garde-corps, pont, bateau, rive d'en face
  const rail = std('#2c2c30', { metalness: 0.5, roughness: 0.4 });
  for (const s of [-1, 1]) {
    for (let x = 1; x <= 13; x += 1) box(root, 0.05, 0.4, 0.05, rail, s * x, GY, CANAL.z1 + 0.1);
    box(root, 12, 0.04, 0.04, rail, s * 7, GY + 0.36, CANAL.z1 + 0.1);
  }
  const br = bridge(root);
  for (const s of [-1, 1]) {
    for (const x of [5, 11]) deco('lampe', s * x, GY, -13.6, 1, Math.PI / 2);
    deco('banc', s * 3, GY, -14.9, 1, Math.PI);
    for (const x of [3.2, 8.5]) willow(root, s * x, -19.4, 1.15);
    deco('toro', s * 6, GY, -20.9); deco('toro', s * 11.5, GY, -20.9);
    deco('cerisier', s * 12.4, GY, -14.4, 1.1, s);
  }
  // Pêcheur assis au bord de l'eau
  const fisher = makePerson(seeded(77));
  fisher.root.position.set(-6.5, GY, CANAL.z0 - 0.25); fisher.root.rotation.y = Math.PI;
  fisher.legL.rotation.x = fisher.legR.rotation.x = -1.45; fisher.body.position.y = -0.24;
  fisher.armR.rotation.x = fisher.armL.rotation.x = -1.1;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 1.4, 4), std('#3a2a1a'));
  rod.position.set(-6.5, 0.55, CANAL.z0 + 0.35); rod.rotation.x = -1.05; scene.add(rod);
  scene.add(fisher.root);
  // Bateau amarré (yakatabune) avec fenêtres éclairées
  const boat = new THREE.Group();
  box(boat, 2.4, 0.25, 0.8, textured('hull', TEX.wood('#5a3e2a')), 0, -0.1, 0);
  box(boat, 1.5, 0.45, 0.62, std('#e9e1cf'), 0, 0.15, 0);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.25), glowMat('boatWin', '#ffffff', TEX.window(), 0.05, 1.1, 'A')); w.position.set(0, 0.38, s * 0.32); w.rotation.y = s > 0 ? 0 : Math.PI; boat.add(w); }
  gableRoof(sub(boat, 0, 0, 0), 1.6, 0.7, 0.6, '#2d3440', 0.4);
  boat.position.set(7, CANAL.water, -17.6);
  boat.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(boat);
  glowsDef.push({ x: 7, y: 0.4, z: -17.2, color: '#ffc27a', pool: false, yb: CANAL.water });

  // Eau : vaguelettes qui défilent, légèrement transparente pour voir les carpes
  const nTex = WATER_N().clone(); nTex.needsUpdate = true; nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping; nTex.repeat.set(10, 1.4);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(BASE.x * 2, CANAL.z1 - CANAL.z0), new THREE.MeshStandardMaterial({ color: '#1d4a52', roughness: 0.06, metalness: 0.15, normalMap: nTex, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.78, envMapIntensity: 1.6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, CANAL.water, (CANAL.z0 + CANAL.z1) / 2); water.receiveShadow = true; water.renderOrder = 1;
  scene.add(water);
  for (let i = 0; i < 9; i++) { const r = seeded(90 + i); const pad = new THREE.Mesh(new THREE.CircleGeometry(0.16 + r() * 0.1, 10, 0.3, 5.9), std('#3f6a35')); pad.rotation.x = -Math.PI / 2; pad.position.set((r() - 0.5) * 24, CANAL.water + 0.01, CANAL.z0 + 0.3 + r() * 0.6 + (i % 2) * 2.4); scene.add(pad); }

  const baked = bake(root);
  scene.add(baked);
  // taches de lumière des lanternes du relief
  const glowMeshes = [];
  for (const gl of glowsDef) {
    const holder = sub(scene, 0, gl.yb ?? GY, 0);
    if (gl.pool !== false) glowMeshes.push(lightPool(holder, gl.x, gl.z, gl.r || 1, gl.color, 0.7));
    glowMeshes.push(streak(holder, gl.x, gl.z + 0.2, 0.4, gl.color, gl.yb === CANAL.water ? 1.6 : 1));
  }
  // reflets sur le canal (même la nuit sans pluie)
  for (const x of [-11, -5, 5, 11]) { const h = sub(scene, 0, CANAL.water + 0.01, 0); const s = streak(h, x, CANAL.z1 - 0.6, 0.5, '#ffcf96', 2.2); s.userData.water = true; glowMeshes.push(s); }

  let t = 0;
  return {
    glows: glowMeshes, water, boat, groundMats, bridgeArc: br,
    update(dt) {
      t += dt;
      nTex.offset.set(t * 0.012, t * 0.02);
      boat.position.y = CANAL.water + Math.sin(t * 0.9) * 0.025; boat.rotation.z = Math.sin(t * 0.7) * 0.02;
      fisher.armR.rotation.x = -1.1 + Math.sin(t * 0.5) * 0.05;
    },
  };
}

// Hauteur du sol à un endroit (pluie, éclaboussures, neige)
export function groundY(x, z) {
  if (z > HILL.z0) return HILL.y + 0.01;
  if (z < CANAL.z1 && z > CANAL.z0) return Math.abs(x) < 0.65 ? null : CANAL.water + 0.01;
  return Math.abs(z) < 1.4 ? 0.012 : GY + 0.01;
}
