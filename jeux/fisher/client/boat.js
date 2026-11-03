// Little Fisher : le bateau du joueur (et son petit pêcheur) : barque, voilier ou chalutier. Les améliorations se voient
// (moteur, caisses, canne, renforts de la coque, lanterne), tout comme la personnalisation (peinture, nom, drapeau, mascotte).
// Le bateau regarde vers +z.
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

// Trois modèles : longueur (sz) et largeur (sx) de la coque, cabine, et gréement (voile ou portique)
const MODELS = {
  barque: { sx: 1, sz: 1, cabin: { w: 1.9, h: 1.5, d: 1.6, z: -0.9 } },
  voilier: { sx: 0.88, sz: 1.3, cabin: { w: 1.6, h: 1.0, d: 2.4, z: -1.4 } },
  chalutier: { sx: 1.25, sz: 1.45, cabin: { w: 2.4, h: 2.3, d: 2.4, z: 1.4 } },
};
// Petites images peintes : nom sur la coque, drapeau, mascotte
function textTexture(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d'); g.font = 'italic 700 64px Fredoka, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(text, 256, 50); g.fillStyle = color; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flagTexture(flag) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const g = c.getContext('2d'), [a, b] = flag.colors;
  g.fillStyle = a; g.fillRect(0, 0, 96, 64);
  if (flag.name === 'Marinière') { g.fillStyle = b; for (let y = 8; y < 64; y += 16) g.fillRect(0, y, 96, 8); }
  if (flag.name === 'Damier') { g.fillStyle = b; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16); }
  if (flag.name === 'Poisson') { g.fillStyle = b; g.beginPath(); g.ellipse(44, 32, 22, 12, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(62, 32); g.lineTo(80, 18); g.lineTo(80, 46); g.fill(); }
  if (flag.name === 'Pirate') { g.fillStyle = b; g.beginPath(); g.arc(48, 26, 12, 0, 7); g.fill(); g.fillRect(40, 34, 16, 8); g.lineWidth = 5; g.strokeStyle = b; g.beginPath(); g.moveTo(28, 44); g.lineTo(68, 58); g.moveTo(68, 44); g.lineTo(28, 58); g.stroke(); g.fillStyle = a; g.beginPath(); g.arc(43, 25, 3.5, 0, 7); g.arc(53, 25, 3.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function emojiTexture(e) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.font = '100px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildBoat() {
  const group = new THREE.Group();   // position et cap
  const body = new THREE.Group();    // roulis et tangage
  group.add(body);
  const hullMat = mat('#b9804a', { flatShading: true }), stripeMat = mat('#8a5a32'), deckMat = mat('#d9b27c', { roughness: 0.9 });
  const white = mat('#f5f2ea'), red = mat('#c94a3a'), glass = mat('#1e3346', { roughness: 0.1, metalness: 0.4 }), dark = mat('#3a3a3a');
  const hullG = new THREE.Group(), cabinG = new THREE.Group(), rigG = new THREE.Group(); body.add(hullG, cabinG, rigG);

  // le petit pêcheur : ciré jaune et bonnet rouge
  const fisher = new THREE.Group(); body.add(fisher);
  mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.05, 10), mat('#f2c230'), 0, 0.55, 0, fisher);
  mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#f1c9a5'), 0, 1.32, 0, fisher);
  mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9483b'), 0, 1.4, 0, fisher);
  const arm = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6), mat('#f2c230'), 0.33, 0.85, 0.2, fisher); arm.rotation.x = -0.9;

  const parts = { moteur: new THREE.Group(), cale: new THREE.Group(), canne: new THREE.Group(), coque: new THREE.Group(), lanterne: new THREE.Group() };
  for (const g of Object.values(parts)) body.add(g);
  const rodTip = new THREE.Object3D();
  const lamp = new THREE.PointLight('#ffcf7a', 0, 38, 1.6);
  const lampMat = mat('#fff1c4', { emissive: '#ffc864', emissiveIntensity: 0 });
  const propeller = new THREE.Group();
  let flag = null, sail = null, boom = null, levels = { moteur: 0, cale: 0, canne: 0, coque: 0, lanterne: 0 };
  let style = { model: 'barque', custom: { hull: 'auto', flag: 'jaune', name: 'Petit Galet', mascot: null }, colors: null, flags: null, relics: null };

  function rebuild() {
    const M = MODELS[style.model] ?? MODELS.barque, { sx, sz } = M, C = M.cabin;
    for (const g of [hullG, cabinG, rigG, ...Object.values(parts)]) g.clear();
    // coque, bande et pont, à la taille du modèle
    const hull = mesh(hullGeo(1, 1.5, -0.75, true), hullMat, 0, 0, 0, hullG), stripe = mesh(hullGeo(1.025, 0.22, 0.45, false), stripeMat, 0, 0, 0, hullG);
    const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline(0.93)).rotateX(-Math.PI / 2).rotateY(Math.PI), deckMat); deck.position.y = 0.62; deck.receiveShadow = true; hullG.add(deck);
    hullG.scale.set(sx, 1, sz);
    const h = HULLS[levels.coque], paint = style.colors?.[style.custom.hull];
    hullMat.color.set(paint?.color ?? h.hull); hullMat.metalness = paint?.metal ? 0.35 : 0; hullMat.roughness = paint?.metal ? 0.3 : 0.75; // peu métallique : rien à refléter dans le ciel peint
    stripeMat.color.set(h.stripe); deckMat.color.set(h.deck);
    // le nom, peint de chaque côté de la proue
    const nameTex = textTexture(style.custom.name);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, roughness: 0.6 }));
      p.position.set(s * 1.37 * sx, 0.2, 1.0 * sz); p.rotation.y = s > 0 ? Math.PI / 2 - 0.1 : -Math.PI / 2 + 0.1; cabinG.add(p);
    }
    // cabine
    mesh(new THREE.BoxGeometry(C.w, C.h, C.d), white, 0, 0.62 + C.h / 2, C.z, cabinG);
    mesh(new THREE.BoxGeometry(C.w + 0.3, 0.16, C.d + 0.4), red, 0, 0.62 + C.h + 0.08, C.z, cabinG);
    mesh(new THREE.BoxGeometry(C.w * 0.8, Math.min(0.55, C.h * 0.4), 0.06), glass, 0, 0.62 + C.h * 0.65, C.z + C.d / 2 + 0.02, cabinG);
    const roofY = 0.62 + C.h + 0.16;
    // drapeau sur un petit mât
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat('#5a4030'), C.w / 2 - 0.2, roofY + 0.7, C.z - C.d / 2 + 0.3, cabinG);
    flag = mesh(new THREE.PlaneGeometry(0.9, 0.6).translate(-0.45, 0, 0), new THREE.MeshStandardMaterial({ map: flagTexture(style.flags?.[style.custom.flag] ?? { name: 'Jaune', colors: ['#f2c14e'] }), side: THREE.DoubleSide }), C.w / 2 - 0.2, roofY + 1.15, C.z - C.d / 2 + 0.3, cabinG);
    flag.rotation.y = Math.PI / 2;
    // mascotte : une relique posée sur le toit
    if (style.custom.mascot && style.relics?.[style.custom.mascot]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(style.relics[style.custom.mascot].icon) }));
      sp.position.set(-C.w / 4, roofY + 0.45, C.z); sp.scale.setScalar(0.9); cabinG.add(sp);
    }
    // gréement : voile et bôme (voilier), portique et tambour à filet (chalutier)
    sail = boom = null;
    if (style.model === 'voilier') {
      mesh(new THREE.CylinderGeometry(0.08, 0.11, 10, 6), mat('#e8e0d0'), 0, 5.6, 0.9 * sz, rigG);
      boom = new THREE.Group(); boom.position.set(0, 1.6, 0.9 * sz); rigG.add(boom);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5).rotateX(Math.PI / 2).translate(0, 0, -2.1), mat('#e8e0d0'), 0, 0, 0, boom);
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, 0, 8.6, -0.1, 0, 0, -4.1], 3)); g.computeVertexNormals();
      sail = mesh(g, new THREE.MeshStandardMaterial({ color: '#fbf7ee', side: THREE.DoubleSide, roughness: 0.9 }), 0, 0, 0, boom);
      const jib = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 1.4, 0.9 * sz + 0.2, 0, 9.4, 0.9 * sz + 0.1, 0, 0.9, 3.2 * sz], 3)); jib.computeVertexNormals();
      mesh(jib, sail.material, 0, 0, 0, rigG);
    }
    if (style.model === 'chalutier') {
      for (const s of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 6), mat('#e0a030'), s * 1.1 * sx, 2.5, -3.2 * sz, rigG); p.rotation.z = s * -0.18; p.rotation.x = -0.2; }
      mesh(new THREE.BoxGeometry(2.6 * sx, 0.18, 0.18), mat('#e0a030'), 0, 4.5, -3.55 * sz, rigG);
      mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 12).rotateZ(Math.PI / 2), mat('#4f7f6a'), 0, 1.2, -2.2 * sz, rigG);
    }
    // les pièces des améliorations, placées sur la coque de ce modèle
    const lv = levels;
    if (lv.coque >= 1) for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.12, 5.4 * sz), mat('#c8ccd0', { metalness: 0.7, roughness: 0.3 }), s * 1.38 * sx, 0.66, -0.3 * sz, parts.coque);
    if (lv.coque >= 2) for (const s of [-1, 1]) for (const z of [-1.8, 0.2]) { const t = mesh(new THREE.TorusGeometry(0.28, 0.12, 6, 12), mat('#222')); t.position.set(s * 1.5 * sx, 0.2, z * sz); t.rotation.y = Math.PI / 2; parts.coque.add(t); }
    const engCol = ['#8a9096', '#2b2b30', '#e8e3d8', '#d9342b'][lv.moteur], n = lv.moteur === 3 ? 2 : 1, ez = 0.7 + lv.moteur * 0.18, stern = -3.35 * sz;
    for (let k = 0; k < n; k++) {
      const x = n === 2 ? (k ? 0.55 : -0.55) : 0;
      mesh(new THREE.BoxGeometry(0.6 * ez, 0.9 * ez, 0.7 * ez), mat(engCol, { roughness: 0.4 }), x, 0.9, stern, parts.moteur);
      mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), dark, x, 0.05, stern - 0.05, parts.moteur);
    }
    propeller.clear(); propeller.position.set(0, -0.5, stern - 0.1);
    for (let k = 0; k < 3; k++) { const b = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.1), mat('#b0b4b8', { metalness: 0.8 })); b.rotation.z = k * 2.1; propeller.add(b); }
    parts.moteur.add(propeller);
    const front = style.model === 'chalutier' ? -0.4 : 1.5 * sz;
    const crate = (x, z, y = 0.95, s = 1) => mesh(new THREE.BoxGeometry(0.8 * s, 0.6 * s, 0.6 * s), mat('#a8743f', { flatShading: true }), x, y, z, parts.cale);
    if (lv.cale === 0) mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.5, 10), mat('#c9a35f'), 0.3, 0.9, front + 0.1, parts.cale);
    if (lv.cale >= 1) { crate(-0.45, front); crate(0.45, front); }
    if (lv.cale >= 2) mesh(new THREE.BoxGeometry(1.3, 0.7, 0.8), mat('#e9f1f5'), 0, 1, front - 0.9, parts.cale);
    if (lv.cale >= 3) { crate(-0.45, front, 1.55); crate(0.45, front + 0.7); }
    const rod = new THREE.Group(); rod.position.set(0.9 * sx, 0.9, -2.5 * sz); rod.rotation.set(-0.75, 0.35, -0.25); parts.canne.add(rod);
    const L = 3.4 + lv.canne * 0.35;
    mesh(new THREE.CylinderGeometry(0.03, 0.06, L, 6).translate(0, L / 2, 0), mat(RODS[lv.canne], { roughness: 0.4, metalness: lv.canne >= 2 ? 0.5 : 0 }), 0, 0, 0, rod);
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10).rotateZ(Math.PI / 2), mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }), 0.1, 0.5, 0, rod);
    rodTip.position.set(0, L, 0); rod.add(rodTip);
    if (lv.lanterne) {
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), dark, 0, roofY + 0.5, C.z + C.d / 4, parts.lanterne);
      mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lampMat, 0, roofY + 1.1, C.z + C.d / 4, parts.lanterne);
      lamp.position.set(0, roofY + 1.1, C.z + C.d / 4); parts.lanterne.add(lamp);
    }
    fisher.position.set(-0.6 * sx, 0.62, -2.2 * sz);
  }

  return {
    group, body, fisher, rodTip,
    setLevels(lv) { levels = { ...levels, ...lv }; rebuild(); },
    // modèle et personnalisation (colors, flags, relics : les tables de data.js pour les retrouver)
    setStyle(model, custom, tables) { style = { model, custom: { ...custom }, ...tables }; rebuild(); },
    // la nuit, la lanterne éclaire ; l'hélice tourne avec les gaz ; la voile se tourne vers le vent
    tick(dt, night, throttle, windRel = 0, wind = 0) {
      lamp.intensity = night * 60; lampMat.emissiveIntensity = 0.3 + night * 2.5;
      propeller.rotation.z += dt * (4 + Math.abs(throttle) * 40);
      if (flag) flag.rotation.y = Math.PI / 2 + Math.sin(performance.now() / 300) * 0.25;
      if (boom) { const want = Math.max(-1.2, Math.min(1.2, -Math.sin(windRel) * 1.2)); boom.rotation.y += (want - boom.rotation.y) * Math.min(1, dt * 1.5); }
    },
  };
}

// Sillage en V : de l'écume part des deux côtés de la proue et s'écarte, plus une traînée derrière l'hélice.
export function createWake(scene) {
  const N = 160, geo = new THREE.CircleGeometry(1, 12); geo.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }), N);
  m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
  const items = Array.from({ length: N }, () => ({ x: 0, z: 0, vx: 0, vz: 0, age: 9, s: 1, life: 2 }));
  const o = new THREE.Object3D();
  let next = 0, acc = 0;
  const emit = (x, z, vx, vz, s, life) => { const it = items[next]; next = (next + 1) % N; Object.assign(it, { x, z, vx, vz, s, life, age: 0 }); };
  return {
    update(dt, x, z, heading, speed, waveH) {
      const fx = Math.sin(heading), fz = Math.cos(heading), rx = -fz, rz = fx;
      acc += dt;
      if (speed > 1.2 && acc > 0.06) {
        acc = 0;
        const k = Math.min(1, speed / 20);
        for (const side of [-1, 1]) { // les deux bras du V, poussés vers l'extérieur
          const bx = x + fx * 2.2 + rx * side * 1.2, bz = z + fz * 2.2 + rz * side * 1.2, out = 1.5 + speed * 0.12;
          emit(bx, bz, rx * side * out, rz * side * out, 0.3 + k * 0.25, 2.6);
        }
        emit(x - fx * 3.4, z - fz * 3.4, 0, 0, 0.4 + k * 0.5, 1.8); // remous de l'hélice
      }
      for (let n = 0; n < N; n++) {
        const it = items[n]; it.age += dt;
        const life = Math.max(0, 1 - it.age / it.life);
        it.x += it.vx * dt; it.z += it.vz * dt; it.vx *= Math.exp(-dt * 0.8); it.vz *= Math.exp(-dt * 0.8);
        o.position.set(it.x, waveH(it.x, it.z) + 0.1, it.z);
        o.scale.set(1, 1, 1).multiplyScalar(life > 0 ? it.s * (1 + it.age * 1.1) * Math.min(1, life * 2.2) : 0.0001);
        o.updateMatrix(); m.setMatrixAt(n, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
  };
}
