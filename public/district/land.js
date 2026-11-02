// Little District : relief des quartiers qui ont leur propre plan (quartier moderne, village côtier).
// Même interface que buildTerrain : { glows, groundMats, meshes, update }.
import * as THREE from 'three';
import { TEX, std, textured, glowMat, box, cyl, sub, makeDecor, lightPool, streak, bake, seeded } from './models.js';
import { WATER_N, GRASS } from './terrain.js';
import { streetLamp, boatModel, lighthouse, WATER } from './styles.js';
import { DISTRICT } from './theme.js';
import { LAYOUT } from './layouts.js';

const GY = 0.06;

function landModerne(scene, low) {
  const L = LAYOUT, { T, BAND, ROAD, RAMPS, MARINA, BOARD } = L;
  const root = new THREE.Group(), glowsDef = [], groundMats = [], meshes = [];
  const W = BOARD.x * 2;
  const strataT = TEX.strata().clone(); strataT.needsUpdate = true; strataT.repeat.set(4, 1);
  const strata = new THREE.MeshStandardMaterial({ map: strataT, roughness: 0.95 });
  const render = std('#e4e1da', { roughness: 0.9 }), cap = std('#c9c4b8', { roughness: 0.8 }), top = std('#3d3a36');
  const grassT = GRASS().clone(); grassT.needsUpdate = true; grassT.repeat.set(10, 3);
  const grass = new THREE.MeshStandardMaterial({ map: grassT, roughness: 0.95, color: '#b8d8a0' });
  const roadT = TEX.asphalt().clone(); roadT.needsUpdate = true; roadT.repeat.set(9, 0.8);
  const road = new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.85 }); road.userData.tint = new THREE.Color('#9a9a9a');
  const paveT = TEX.slab().clone(); paveT.needsUpdate = true; paveT.repeat.set(30, 1.4);
  const pave = new THREE.MeshStandardMaterial({ map: paveT, roughness: 0.85 }); pave.userData.tint = new THREE.Color('#e6e2da').multiplyScalar(1.9);
  groundMats.push(road, pave);

  const block = (z0, z1, y1, front) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, y1 + 1.4, z1 - z0), [strata, strata, top, top, front || strata, strata]);
    m.position.set(0, (y1 - 1.4) / 2, (z0 + z1) / 2); m.receiveShadow = m.castShadow = true; scene.add(m);
  };
  const flat = (w, d, mat, x, y, z, pick = true) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; scene.add(o); if (pick) meshes.push(o); return o; };

  // Terrasses : chaque bande a un mur de soutènement blanc côté mer, une pelouse et sa route
  for (let k = 0; k < 4; k++) {
    block(BAND[k][0], BAND[k][1], T[k], k ? render : std('#d8d2c4'));
    flat(W, BAND[k][1] - BAND[k][0], grass, 0, T[k] + 0.005, (BAND[k][0] + BAND[k][1]) / 2);
    flat(W - 0.2, 2.4, road, 0, T[k] + 0.02, ROAD[k]);
    for (const s of [-1, 1]) box(scene, W - 0.2, 0.05, 0.12, cap, 0, T[k] + 0.005, ROAD[k] + s * 1.26); // bordures
    if (k) { // couronnement du mur et garde-corps en verre (ouvert là où la rampe arrive)
      const z = BAND[k][1], rampX = RAMPS[k - 1].x;
      box(scene, W, 0.12, 0.3, cap, 0, T[k] - 0.02, z - 0.12);
      const glass = new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
      const span = (x0, x1) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.42), glass); g.position.set((x0 + x1) / 2, T[k] + 0.31, z - 0.05); scene.add(g); box(scene, x1 - x0, 0.03, 0.05, std('#c8ccd0', { metalness: 0.7, roughness: 0.3 }), (x0 + x1) / 2, T[k] + 0.52, z - 0.05); };
      if (rampX > 0) span(-BOARD.x, rampX - 1.1); else span(rampX + 1.1, BOARD.x);
    }
  }
  // Promenade du quai et marina
  flat(W, MARINA.z0 - MARINA.quay, pave, 0, T[0] + 0.012, (MARINA.quay + MARINA.z0) / 2);
  block(MARINA.z0, BOARD.z1, -0.75, strata);
  const nTex = WATER_N().clone(); nTex.needsUpdate = true; nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping; nTex.repeat.set(10, 2.5);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, BOARD.z1 - MARINA.z0), new THREE.MeshStandardMaterial({ color: WATER[0], roughness: 0.06, metalness: 0.15, normalMap: nTex, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: WATER[1], envMapIntensity: 1.6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, (MARINA.z0 + BOARD.z1) / 2); water.renderOrder = 1; scene.add(water);
  box(scene, W, 0.1, 0.25, cap, 0, -0.04, MARINA.z0 + 0.1); // bord du quai
  // Rampes de la route en lacets : une pente et le talus en dessous
  for (const r of RAMPS) {
    const len = r.z0 - r.z1, rise = r.y1 - r.y0, shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, rise)]);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }), render);
    wedge.rotation.y = Math.PI / 2; wedge.position.set(r.x - 1, r.y0, r.z0); wedge.castShadow = wedge.receiveShadow = true; scene.add(wedge);
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(1.9, Math.hypot(len, rise)), road);
    slab.rotation.x = -Math.PI / 2 + Math.atan2(rise, len); slab.position.set(r.x, (r.y0 + r.y1) / 2 + 0.03, (r.z0 + r.z1) / 2); slab.receiveShadow = true; scene.add(slab); meshes.push(slab);
    for (const s of [-1, 1]) { const rail = box(root, 0.05, 0.05, Math.hypot(len, rise), std('#c8ccd0', { metalness: 0.7 }), r.x + s * 0.98, 0, 0); rail.position.set(r.x + s * 0.98, (r.y0 + r.y1) / 2 + 0.5, (r.z0 + r.z1) / 2); rail.rotation.x = Math.atan2(rise, len); }
  }

  // Décor : lampadaires le long des routes, palmiers, haies, belvédère, pontons et bateaux
  const deco = (id, x, z, sc = 1, ry = 0) => { const y = L.height(x, z) + GY, d = makeDecor(id); d.position.set(x, y, z); d.scale.setScalar(sc); d.rotation.y = ry; root.add(d); (d.userData.glows || []).forEach(gl => glowsDef.push({ ...gl, x: x + gl.x * sc, z: z + gl.z * sc, yb: y })); return d; };
  const lamps = sub(scene, 0, 0, 0);
  const GAPS = [[-12, -6, 0, 6, 12], [-14, -4.75, 4.75], [-14, -4.75, 4.75], [-13.5, 0, 13.5]]; // entre les parcelles, côté montagne
  for (let k = 0; k < 4; k++) for (const x of GAPS[k]) {
    const z = ROAD[k] - 1.45, y = T[k];
    const h = sub(lamps, 0, y, 0); streetLamp(h, x, z, -1);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('streetbulb', '#ffe1b0', null, 0.1, 4, 0)); bulb.position.set(x, 2.55, z + 0.42); h.add(bulb);
    glowsDef.push({ x, y: 2.5, z: z + 0.9, color: '#ffcf96', pool: true, yb: y + GY, r: 1.2 });
  }
  for (let x = -14; x <= 14; x += 4) deco('cerisier', x, MARINA.quay + 0.65, 0.9, x); // palmiers sur le quai
  for (let k = 1; k < 4; k++) for (const x of [-15.6, 15.6]) if (Math.abs(x - RAMPS[k - 1].x) > 2 && (k === 3 || Math.abs(x - RAMPS[k]?.x) > 2)) deco('sakura', x, (BAND[k][0] + BAND[k][1]) / 2 - 1, 0.8, x);
  deco('banc', -13.5, -15.6, 1, 0); deco('torii', -13.5, -16.4, 1.1); deco('erable', -15.6, -19.5, 1.1); // belvédère du sommet
  for (const x of [-12, 12]) deco('banc', x, 10.6, 1, Math.PI);
  // pontons et yachts
  const wood = textured('pierwood', TEX.wood('#8a6a48'));
  box(root, 1.4, 0.08, 6, wood, 0, 0.06, MARINA.z0 + 3);
  for (const x of [-8, 8]) box(root, 1.2, 0.08, 4.2, wood, x, 0.04, MARINA.z0 + 2.2);
  box(root, 18, 0.08, 1.1, wood, 0, 0.04, MARINA.z0 + 4.9);
  const boats = [];
  for (const [x, z, c, sail, s] of [[-4.5, 13.6, '#f4f1ea', false, 1.6], [4.5, 13.4, '#26282c', false, 1.4], [-11.5, 13.2, '#f4f1ea', true, 1.3], [11.5, 13, '#2a5fa8', true, 1.2], [-4.5, 16.8, '#f4f1ea', true, 1.4], [5, 16.9, '#c8402e', false, 1.1]]) {
    const b = new THREE.Group(); boatModel(b, c, sail, s * 1.4); b.position.set(x, -0.4, z); b.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
    b.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(b); boats.push(b);
  }
  scene.add(bake(root));
  const glows = [];
  for (const gl of glowsDef) { const h = sub(scene, 0, gl.yb ?? GY, 0); if (gl.pool !== false) glows.push(lightPool(h, gl.x, gl.z, gl.r || 1, gl.color, 0.7)); glows.push(streak(h, gl.x, gl.z + 0.2, 0.4, gl.color, 1)); }
  for (const x of [-10, -3, 3, 10]) { const h = sub(scene, 0, -0.39, 0); const s = streak(h, x, MARINA.z0 + 1, 0.5, '#ffcf96', 2.2); s.userData.water = true; glows.push(s); }

  let t = 0;
  return {
    glows, groundMats, meshes, water,
    update(dt) {
      t += dt;
      nTex.offset.set(t * 0.012, t * 0.02);
      boats.forEach((b, i) => { b.position.y = -0.4 + Math.sin(t * 0.9 + i) * 0.03; b.rotation.z = Math.sin(t * 0.7 + i) * 0.03; });
    },
  };
}

// ---------- Village côtier : la mer à perte de vue, la plage, la promenade, la rangée de maisons, le haut du village ----------
function landCotier(scene, low) {
  const L = LAYOUT, C = L.C, B = L.BOARD;
  const root = new THREE.Group(), glowsDef = [], groundMats = [], meshes = [];
  const strataT = TEX.strata().clone(); strataT.needsUpdate = true; strataT.repeat.set(4, 1);
  const strata = new THREE.MeshStandardMaterial({ map: strataT, roughness: 0.95 });
  const rock = std('#7a7368', { roughness: 1, flatShading: true }), top = std('#3d3a36'), stoneWall = std('#a8a196', { roughness: 0.95 });
  const sand = std('#d6bf8e', { roughness: 1 }), wetSand = std('#b8a476', { roughness: 0.6 }); // pas trop clair : sinon le sable éblouit au soleil
  const tex = (t, r, tint) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(...r); const m = new THREE.MeshStandardMaterial({ map: c, roughness: 0.9 }); if (tint) m.userData.tint = tint; groundMats.push(m); return m; };
  const grassT = GRASS().clone(); grassT.needsUpdate = true; grassT.repeat.set(14, 3);
  const grass = new THREE.MeshStandardMaterial({ map: grassT, roughness: 0.95, color: '#c8dca0' });
  const boards = tex(TEX.wood('#a88a62'), [40, 1]), pave = tex(TEX.pave(), [14, 1], new THREE.Color('#efe2c8').multiplyScalar(1.5)), quay = tex(TEX.slab(), [5, 8], new THREE.Color('#d8d2c4').multiplyScalar(1.6));
  const block = (x0, x1, z0, z1, y1, faces) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 + 1.4, z1 - z0), faces || [strata, strata, top, top, strata, strata]);
    m.position.set((x0 + x1) / 2, (y1 - 1.4) / 2, (z0 + z1) / 2); m.receiveShadow = m.castShadow = true; scene.add(m); return m;
  };
  const flat = (x0, x1, z0, z1, mat, y, pick = true) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); o.rotation.x = -Math.PI / 2; o.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); o.receiveShadow = true; scene.add(o); if (pick) meshes.push(o); return o; };

  // Le terrain : bas du village, haut du village (mur de pierre côté mer), falaise du phare, fond marin
  block(C.cliffX, B.x1, -4, C.beach[0], 0, [strata, rock, top, top, stoneWall, strata]);
  block(C.cliffX, B.x1, B.z0, -4, C.up, [strata, rock, top, top, stoneWall, strata]);
  block(B.x0, C.cliffX, B.z0, C.beach[1] + 0.6, C.cliff, [rock, rock, top, top, rock, rock]);
  block(B.x0, B.x1, C.beach[0], B.z1, -0.8, [strata, strata, std('#c9b489'), top, strata, strata]);
  flat(C.cliffX, B.x1, B.z0, -4, grass, C.up + 0.005);
  flat(B.x0, C.cliffX, B.z0, C.beach[1] + 0.6, grass, C.cliff + 0.005);
  flat(C.cliffX, B.x1, C.upSt - 0.8, C.upSt + 0.8, pave, C.up + 0.015);
  flat(C.cliffX, C.portX, 1.5, C.beach[0], boards, 0.02); // la promenade en planches
  flat(C.cliffX, C.portX, -4, 1.5, pave, 0.01);
  flat(C.portX, B.x1, -4, C.beach[0], quay, 0.015);
  // la plage : du sable en pente douce jusqu'à l'eau
  const run = C.beach[1] - C.beach[0] + 0.8, beachLen = Math.hypot(run, 0.42);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(C.portX - C.cliffX, beachLen), sand);
  beach.rotation.x = -Math.PI / 2 - Math.atan2(0.42, run); beach.position.set((C.portX + C.cliffX) / 2, -0.2, C.beach[0] + run / 2);
  beach.receiveShadow = true; scene.add(beach); meshes.push(beach);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(C.portX - C.cliffX, 1.2), wetSand); wet.rotation.x = beach.rotation.x; wet.position.set(beach.position.x, -0.37, C.beach[1] + 0.2); scene.add(wet);
  box(scene, C.portX - C.cliffX, 0.32, 0.18, stoneWall, (C.portX + C.cliffX) / 2, -0.3, C.beach[0] + 0.05); // muret de la promenade
  box(scene, 0.3, 0.9, B.z1 - C.beach[0], stoneWall, C.portX, -0.9, (C.beach[0] + B.z1) / 2); // quai du port
  // la mer jusqu'à l'horizon
  const nTex = WATER_N().clone(); nTex.needsUpdate = true; nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping; nTex.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: WATER[0], roughness: 0.06, metalness: 0.15, normalMap: nTex, normalScale: new THREE.Vector2(0.4, 0.4), transparent: true, opacity: 0.9, envMapIntensity: 1.6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, C.sea, 100); water.renderOrder = 1; scene.add(water);
  // écume des vagues qui montent sur le sable
  const foams = [0, 1, 2].map(() => { const f = new THREE.Mesh(new THREE.PlaneGeometry(C.portX - C.cliffX, 0.35), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); f.rotation.x = -Math.PI / 2; scene.add(f); return f; });
  // escaliers vers le haut du village
  const step = std('#c8c0b2', { roughness: 0.9 });
  for (const sx of C.stairs) {
    for (let i = 0; i < 11; i++) box(scene, 1.6, (C.up * (i + 1)) / 11, 0.5, step, sx, 0, 1.25 - i * 0.5);
    for (const k of [-1, 1]) { const w = box(root, 0.1, 0.5, 5.8, std('#f4f1ea'), sx + k * 0.85, 0, 0); w.position.set(sx + k * 0.85, C.up / 2 + 0.3, -1.25); w.rotation.x = Math.atan2(C.up, 5.5); }
  }
  // garde-corps blanc au bord du haut du village (ouvert aux escaliers)
  for (let x = C.cliffX + 0.3; x < B.x1; x += 0.7) if (!C.stairs.some(sx => Math.abs(x - sx) < 1)) box(root, 0.05, 0.4, 0.05, std('#f4f1ea'), x, C.up, -4.15);
  for (const [x0, x1] of [[C.cliffX, -21.2], [-19.4, 19.4], [21.2, B.x1]]) box(root, x1 - x0, 0.04, 0.05, std('#f4f1ea'), (x0 + x1) / 2, C.up + 0.38, -4.15);

  const deco = (id, x, z, sc = 1, ry = 0) => { const y = L.height(x, z) + GY, d = makeDecor(id); d.position.set(x, y, z); d.scale.setScalar(sc); d.rotation.y = ry; root.add(d); (d.userData.glows || []).forEach(gl => glowsDef.push({ ...gl, x: x + gl.x * sc, z: z + gl.z * sc, yb: y })); return d; };
  // promenade : réverbères et bancs face à la mer
  const lamps = sub(scene, 0, 0, 0);
  for (let x = -19; x <= 19; x += 6.4) {
    streetLamp(lamps, x, 4.2, 1);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('streetbulb', '#ffe1b0', null, 0.1, 4, 0)); bulb.position.set(x, 2.55, 3.78); lamps.add(bulb);
    glowsDef.push({ x, y: 2.5, z: 3.5, color: '#ffcf96', pool: true, yb: GY, r: 1.3 });
    deco('banc', x + 3.2, 4.1, 1, Math.PI);
  }
  // la plage : parasols, serviettes, cabines, poste de secours, châteaux de sable
  const r = seeded(17);
  const stripes = ['#c8402e', '#1f3a5a', '#2f7a8a', '#f2c14e', '#e86a8a'];
  for (let i = 0; i < 9; i++) {
    const x = -18 + i * 4.3 + (r() - 0.5) * 1.5, z = 6.4 + r() * 1.6, y = L.height(x, z), c = stripes[i % stripes.length];
    cyl(root, 0.02, 1.05, std('#dddddd'), x, y, z);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.24, 10, 1, true), textured('parasol' + c, TEX.stripes(c, '#f4f1ea'), { side: THREE.DoubleSide })); umb.position.set(x, y + 1.08, z); root.add(umb);
    box(root, 0.5, 0.01, 0.95, std(stripes[(i + 2) % stripes.length]), x + 0.55, y + 0.01, z + 0.25, r() - 0.5);
  }
  for (let i = 0; i < 7; i++) { const cab = sub(root, -19.5 + i * 1.3, 0, 5.05); box(cab, 1, 1.1, 0.8, textured('cabin' + (i % 3), TEX.stripes(['#2f6fa8', '#c8402e', '#2f7a8a'][i % 3], '#f4f1ea')), 0, -0.04, 0); const roof = box(cab, 1.1, 0.08, 0.95, std('#f4f1ea'), 0, 1.06, 0); roof.rotation.x = 0.15; }
  { const lx = 9.8, lz = 8.1, y = L.height(lx, lz), wood = std('#f4f1ea'); for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(root, 0.07, 1.3, 0.07, wood, lx + dx, y, lz + dz); box(root, 1, 0.08, 1, wood, lx, y + 1.3, lz); box(root, 0.9, 0.55, 0.9, std('#c8402e'), lx, y + 1.38, lz); box(root, 1.1, 0.06, 1.1, wood, lx, y + 1.93, lz); }
  for (const [x, z] of [[-5, 8.4], [15.5, 8.6], [-14.5, 8.2]]) { const y = L.height(x, z); cyl(root, 0.22, 0.18, sand, x, y, z); cyl(root, 0.14, 0.14, sand, x, y + 0.18, z); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; cyl(root, 0.05, 0.12, sand, x + Math.cos(a) * 0.22, y + 0.18, z + Math.sin(a) * 0.22); } }
  // le port : jetée, caisses et casiers, bateaux de pêche
  const wood2 = textured('pierwood', TEX.wood('#8a6a48'));
  box(root, 1.4, 0.08, B.z1 - C.beach[0] - 1.5, wood2, 24, 0.06, (C.beach[0] + B.z1 - 1.5) / 2);
  for (let z = C.beach[0] + 0.5; z < B.z1 - 1.6; z += 1.2) for (const sx of [-0.62, 0.62]) cyl(root, 0.06, 1, std('#5a4232'), 24 + sx, -0.9, z);
  for (const [x, z] of [[22.5, 2], [23.2, 2.4], [25.6, -2], [26, 1]]) deco('caisses', x, z, 1, r() * 3);
  deco('bonsai', 25.4, 3.6, 1.3); deco('toro', 22.4, 4, 1.2);
  const boats = [];
  const boat = (x, z, hull, sail, s, ry) => { const b = new THREE.Group(); boatModel(b, hull, sail, s); b.position.set(x, C.sea, z); b.rotation.y = ry; b.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(b); boats.push(b); };
  boat(22.6, 8, '#2f6fa8', false, 1.5, Math.PI / 2); boat(25.4, 10.5, '#c8402e', false, 1.4, Math.PI / 2 + 0.1); boat(22.7, 13, '#3a8a6a', true, 1.4, Math.PI / 2);
  boat(-6, 14, '#f4f1ea', true, 1.8, 0.3); boat(8, 20, '#c8402e', true, 1.6, -0.4); boat(-16, 24, '#f4f1ea', true, 2, 0.8); boat(30, 30, '#1f3a5a', true, 2.2, 1.2);
  // le haut du village : pins au fond ; la falaise : le phare et la maison du gardien
  for (let x = -20; x <= 26; x += 3.2) deco(r() < 0.6 ? 'cerisier' : 'erable', x + r(), -13 + r() * 0.6, 1 + r() * 0.3, r() * 6);
  const lh = sub(root, -24.3, C.cliff, 2); lighthouse(lh, 1.6, null);
  glowsDef.push({ x: -24.3, y: 4.9, z: 2, color: '#fff1b8', strong: true, yb: C.cliff, r: 2 });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.7, 14, 12, 1, true).translate(0, 7, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(-24.3, C.cliff + 5, 2); scene.add(beam);
  for (const [x, z, id, sc] of [[-25, -6, 'sakura', 1.2], [-23, -10, 'cerisier', 1.1], [-25.5, 6.5, 'bambou', 1.4], [-22.5, 7.5, 'bambou', 1.2], [-25, -2, 'banc', 1]]) deco(id, x, z, sc, x);
  { const h = sub(root, -24.6, C.cliff, -3); box(h, 2.4, 1.3, 2, std('#f4f1ea'), 0, 0, 0); for (const s of [-1, 1]) { const sl = box(h, 2.7, 0.07, 1.25, std('#4a5260'), 0, 0, 0); sl.position.set(0, 1.55, s * 0.52); sl.rotation.x = s * 0.6; } const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), std('#2f6fa8')); door.position.set(0.4, 0.42, 1.01); h.add(door); }
  for (let i = 0; i < 14; i++) { const o = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), rock), s = 0.3 + r() * 0.4; o.position.set(B.x0 + 0.5 + r() * 5, C.cliff + 0.05, B.z0 + r() * 22); o.scale.set(s, s * 0.6, s); root.add(o); }
  scene.add(bake(root));
  const glows = [];
  for (const gl of glowsDef) { const h = sub(scene, 0, gl.yb ?? GY, 0); if (gl.pool !== false) glows.push(lightPool(h, gl.x, gl.z, gl.r || 1, gl.color, 0.7)); glows.push(streak(h, gl.x, gl.z + 0.2, 0.4, gl.color, 1)); }
  for (const x of [-19, -6, 6, 19]) { const h = sub(scene, 0, C.sea + 0.01, 0); const s = streak(h, x, C.beach[1] + 1, 0.6, '#ffcf96', 2.4); s.userData.water = true; glows.push(s); }

  let t = 0;
  return {
    glows, groundMats, meshes, water,
    update(dt, night = 0) {
      t += dt;
      nTex.offset.set(t * 0.01, t * 0.018);
      foams.forEach((f, k) => { const p = (t * 0.18 + k / 3) % 1; f.position.set((C.portX + C.cliffX) / 2, C.sea + 0.03 + p * 0.1, C.beach[1] + 0.9 - p * 1.6); f.material.opacity = Math.sin(p * Math.PI) * 0.55; });
      boats.forEach((b, i) => { b.position.y = C.sea + Math.sin(t * 0.9 + i) * 0.04; b.rotation.z = Math.sin(t * 0.7 + i) * 0.04; });
      beam.rotation.y = t * 0.5; beam.material.opacity = night * 0.16;
    },
  };
}

export const buildLand = (scene, low) => (DISTRICT === 'cotier' ? landCotier : landModerne)(scene, low);
