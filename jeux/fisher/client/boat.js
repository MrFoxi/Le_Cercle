// Little Fisher : le bateau du joueur (et son petit pêcheur). Les améliorations se voient : moteur, caisses de la cale,
// canne, peinture et renforts de la coque, lanterne. Le bateau regarde vers +z.
import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
function mesh(geo, m, x = 0, y = 0, z = 0, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent?.add(o); return o; }

// Contour de la coque vu de dessus (x : largeur, y : avant)
function outline(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(-1.35 * s, -3.1 * s);
  sh.lineTo(1.35 * s, -3.1 * s);
  sh.bezierCurveTo(1.6 * s, -0.8 * s, 1.45 * s, 1.6 * s, 0, 3.7 * s);
  sh.bezierCurveTo(-1.45 * s, 1.6 * s, -1.6 * s, -0.8 * s, -1.35 * s, -3.1 * s);
  return sh;
}
// Extrusion verticale du contour (de y0 à y0 + h), le fond resserré pour une carène.
function hullGeo(s, h, y0, taper) {
  const g = new THREE.ExtrudeGeometry(outline(s), { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2).rotateY(Math.PI);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const y = p.getY(k), f = taper ? 0.55 + 0.45 * (y / h) : 1;
    p.setX(k, p.getX(k) * f);
    p.setY(k, y + y0 + (taper && p.getZ(k) > 2 ? (p.getZ(k) - 2) * 0.25 * (y / h) : 0)); // la proue se relève un peu
  }
  g.computeVertexNormals();
  return g;
}

const HULLS = [
  { hull: '#b9804a', stripe: '#8a5a32', deck: '#d9b27c' },   // bois
  { hull: '#f2efe8', stripe: '#2f6bb0', deck: '#cfa46d' },   // renforcée : blanche à bande bleue
  { hull: '#27445f', stripe: '#f08a3c', deck: '#b8916a' },   // haute mer : bleu nuit à bande orange
];
const RODS = ['#c9a86a', '#3f8fd6', '#2b2b30', '#e0b23c'];

export function buildBoat() {
  const group = new THREE.Group();   // position et cap
  const body = new THREE.Group();    // roulis et tangage
  group.add(body);
  const hullMat = mat('#b9804a', { flatShading: true }), stripeMat = mat('#8a5a32'), deckMat = mat('#d9b27c', { roughness: 0.9 });
  mesh(hullGeo(1, 1.5, -0.75, true), hullMat, 0, 0, 0, body);
  mesh(hullGeo(1.025, 0.22, 0.45, false), stripeMat, 0, 0, 0, body);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline(0.93)).rotateX(-Math.PI / 2).rotateY(Math.PI), deckMat);
  deck.position.y = 0.62; deck.receiveShadow = true; body.add(deck);
  // cabine
  const white = mat('#f5f2ea'), red = mat('#c94a3a');
  mesh(new THREE.BoxGeometry(1.9, 1.5, 1.6), white, 0, 1.38, -0.9, body);
  mesh(new THREE.BoxGeometry(2.2, 0.16, 2), red, 0, 2.2, -0.9, body);
  mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), mat('#1e3346', { roughness: 0.1, metalness: 0.4 }), 0, 1.65, -0.08, body);
  const flag = mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.6, 0, 0, 0.3, -0.9], 3)), mat('#f2c14e', { side: THREE.DoubleSide }), 0.7, 2.9, -1.6, body);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat('#5a4030'), 0.7, 2.6, -1.6, body);

  // le petit pêcheur : ciré jaune et bonnet rouge
  const fisher = new THREE.Group(); fisher.position.set(-0.6, 0.62, -2.2); body.add(fisher);
  mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.05, 10), mat('#f2c230'), 0, 0.55, 0, fisher);
  mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#f1c9a5'), 0, 1.32, 0, fisher);
  mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9483b'), 0, 1.4, 0, fisher);
  const arm = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6), mat('#f2c230'), 0.33, 0.85, 0.2, fisher); arm.rotation.x = -0.9;

  // pièces qui changent avec les améliorations
  const parts = { moteur: new THREE.Group(), cale: new THREE.Group(), canne: new THREE.Group(), coque: new THREE.Group(), lanterne: new THREE.Group() };
  for (const g of Object.values(parts)) body.add(g);
  const rodTip = new THREE.Object3D();
  const lamp = new THREE.PointLight('#ffcf7a', 0, 38, 1.6); lamp.position.set(0, 3.4, -0.4);
  const lampMat = mat('#fff1c4', { emissive: '#ffc864', emissiveIntensity: 0 });
  const propeller = new THREE.Group();

  function setLevels(lv) {
    for (const g of Object.values(parts)) g.clear();
    // coque
    const h = HULLS[lv.coque];
    hullMat.color.set(h.hull); stripeMat.color.set(h.stripe); deckMat.color.set(h.deck);
    if (lv.coque >= 1) for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.12, 5.4), mat('#c8ccd0', { metalness: 0.7, roughness: 0.3 }), s * 1.38, 0.66, -0.3, parts.coque); // main courante
    if (lv.coque >= 2) for (const s of [-1, 1]) for (const z of [-1.8, 0.2]) { const t = mesh(new THREE.TorusGeometry(0.28, 0.12, 6, 12), mat('#222')); t.position.set(s * 1.5, 0.2, z); t.rotation.y = Math.PI / 2; parts.coque.add(t); }
    // moteur (à la poupe)
    const engCol = ['#8a9096', '#2b2b30', '#e8e3d8', '#d9342b'][lv.moteur], n = lv.moteur === 3 ? 2 : 1, sz = 0.7 + lv.moteur * 0.18;
    for (let k = 0; k < n; k++) {
      const x = n === 2 ? (k ? 0.55 : -0.55) : 0;
      mesh(new THREE.BoxGeometry(0.6 * sz, 0.9 * sz, 0.7 * sz), mat(engCol, { roughness: 0.4 }), x, 0.9, -3.35, parts.moteur);
      mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), mat('#3a3a3a'), x, 0.05, -3.4, parts.moteur);
    }
    propeller.clear(); propeller.position.set(0, -0.5, -3.45);
    for (let k = 0; k < 3; k++) { const b = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.1), mat('#b0b4b8', { metalness: 0.8 })); b.rotation.z = k * 2.1; b.position.y = 0; propeller.add(b); }
    parts.moteur.add(propeller);
    // cale : panier, caisses, glacière
    const crate = (x, z, y = 0.95, s = 1) => mesh(new THREE.BoxGeometry(0.8 * s, 0.6 * s, 0.6 * s), mat('#a8743f', { flatShading: true }), x, y, z, parts.cale);
    if (lv.cale === 0) mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.5, 10), mat('#c9a35f'), 0.3, 0.9, 1.6, parts.cale);
    if (lv.cale >= 1) { crate(-0.45, 1.5); crate(0.45, 1.5); }
    if (lv.cale >= 2) mesh(new THREE.BoxGeometry(1.3, 0.7, 0.8), mat('#e9f1f5'), 0, 1, 0.6, parts.cale);
    if (lv.cale >= 3) { crate(-0.45, 1.5, 1.55); crate(0.45, 2.2); mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#4f7f6a', { flatShading: true }), -0.4, 0.62, 2.3, parts.cale); }
    // canne, à tribord arrière
    const rod = new THREE.Group(); rod.position.set(0.9, 0.9, -2.5); rod.rotation.set(-0.75, 0.35, -0.25); parts.canne.add(rod);
    const L = 3.4 + lv.canne * 0.35;
    mesh(new THREE.CylinderGeometry(0.03, 0.06, L, 6).translate(0, L / 2, 0), mat(RODS[lv.canne], { roughness: 0.4, metalness: lv.canne >= 2 ? 0.5 : 0 }), 0, 0, 0, rod);
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10).rotateZ(Math.PI / 2), mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }), 0.1, 0.5, 0, rod);
    rodTip.position.set(0, L, 0); rod.add(rodTip);
    // lanterne sur le toit
    if (lv.lanterne) {
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), mat('#3a3a3a'), 0, 2.75, -0.4, parts.lanterne);
      mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lampMat, 0, 3.4, -0.4, parts.lanterne);
      parts.lanterne.add(lamp);
    }
  }

  return {
    group, body, fisher, rodTip, setLevels,
    // la nuit, la lanterne éclaire ; l'hélice tourne avec les gaz
    tick(dt, night, throttle) {
      lamp.intensity = night * 60; lampMat.emissiveIntensity = 0.3 + night * 2.5;
      propeller.rotation.z += dt * (4 + Math.abs(throttle) * 40);
      flag.rotation.y = Math.sin(performance.now() / 300) * 0.25;
    },
  };
}

// Sillage : des taches d'écume laissées derrière le bateau, qui s'élargissent et s'effacent.
export function createWake(scene) {
  const N = 90, geo = new THREE.CircleGeometry(1, 14); geo.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }), N);
  m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
  const items = Array.from({ length: N }, () => ({ x: 0, z: 0, age: 9, s: 1 }));
  const o = new THREE.Object3D();
  let next = 0, acc = 0;
  return {
    update(dt, x, z, heading, speed, waveH) {
      acc += dt * Math.min(1, speed / 4);
      if (speed > 1.2 && acc > 0.09) {
        acc = 0;
        for (const side of [-1, 1]) {
          const it = items[next]; next = (next + 1) % N;
          it.x = x - Math.sin(heading) * 3.3 + Math.cos(heading) * side * 0.8; it.z = z - Math.cos(heading) * 3.3 - Math.sin(heading) * side * 0.8;
          it.age = 0; it.s = 0.35 + speed * 0.015;
        }
      }
      for (let k = 0; k < N; k++) {
        const it = items[k]; it.age += dt;
        const life = Math.max(0, 1 - it.age / 2.4);
        o.position.set(it.x, waveH(it.x, it.z) + 0.12, it.z); o.scale.setScalar(life > 0 ? it.s * (1 + it.age * 0.9) * Math.min(1, life * 2.5) : 0.0001);
        o.updateMatrix(); m.setMatrixAt(k, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
  };
}
