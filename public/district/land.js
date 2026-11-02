// Little District : relief des quartiers qui ont leur propre plan (pour l'instant : le quartier moderne).
// Même interface que buildTerrain : { glows, groundMats, meshes, update }.
import * as THREE from 'three';
import { TEX, std, textured, glowMat, box, cyl, sub, makeDecor, lightPool, streak, bake, seeded } from './models.js';
import { WATER_N, GRASS } from './terrain.js';
import { streetLamp, boatModel, WATER } from './styles.js';
import { LAYOUT } from './layouts.js';

const GY = 0.06;

export function buildLand(scene, low) {
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
