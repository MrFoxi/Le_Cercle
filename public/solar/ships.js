// Vaisseaux de Solar Explorer : 7 modèles construits en formes simples, à la couleur du pilote, avec peinture,
// flammes de réacteur (selon la poussée), traînée lumineuse (6 styles) et effets de boost.
// Repère : le nez pointe vers -Z, le haut vers +Y ; un vaisseau mesure 6 à 8 unités.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lathe = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateX(-Math.PI / 2);
// Plaque plate (aile) : points [envergure, avant(-)/arrière(+)]
const plate = (pts, thick) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2).rotateX(Math.PI / 2);
// Dérive verticale : points [arrière, hauteur]
const fin = (pts, thick) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2).rotateY(-Math.PI / 2);
const tube = (r1, r2, len) => new THREE.CylinderGeometry(r1, r2, len, 20).rotateX(Math.PI / 2);
const FLAME = new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);

// Reflets des métaux (chromé, métallisé) : un studio lumineux générique, appliqué aux vaisseaux seulement.
// Un par moteur de rendu (l'espace et l'aperçu du hangar ont chacun le leur).
const envs = new WeakMap();
export function envFor(renderer) {
  if (!envs.has(renderer)) envs.set(renderer, new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture);
  return envs.get(renderer);
}

// Motifs de peinture (une couleur sur fond clair), en texture répétée.
const patterns = new Map();
function pattern(kind, color) {
  const key = kind + color;
  if (patterns.has(key)) return patterns.get(key);
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), x = c.getContext('2d');
  x.fillStyle = '#d5dde6';
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = color;
  if (kind === 'bandes') for (let i = 0; i < 256; i += 64) x.fillRect(i, 0, 22, 256);
  if (kind === 'damier') for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32);
  if (kind === 'flammes') {
    for (let k = 0; k < 5; k++) {
      x.beginPath();
      x.moveTo(k * 52, 256);
      for (let y = 256; y >= 0; y -= 16) x.lineTo(k * 52 + 26 + Math.sin(y / 18 + k) * 14 * (y / 256), y);
      x.lineTo(k * 52 + 52, 256);
      x.fill();
    }
  }
  if (kind === 'camo') {
    const shades = [color, '#4b5560', '#87929e'];
    for (let i = 0; i < 70; i++) {
      x.fillStyle = shades[i % 3];
      x.beginPath();
      x.ellipse((i * 97) % 256, (i * 57) % 256, 12 + (i * 7) % 26, 8 + (i * 13) % 18, i, 0, Math.PI * 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  patterns.set(key, t);
  return t;
}

// ship : { model, color, paint, trail, boost } ; envMap : envFor(renderer)
export function buildShip(ship, envMap = null) {
  const { model, color, paint: finish = 'uni' } = ship;
  const g = new THREE.Group(), c = new THREE.Color(color);
  const chrome = finish === 'chrome', metal = finish === 'metal' || chrome;
  const hull = new THREE.MeshStandardMaterial({ color: chrome ? 0xeef3f8 : 0xc9d3de, metalness: chrome ? 1 : metal ? 0.85 : 0.55, roughness: chrome ? 0.06 : metal ? 0.22 : 0.32, envMap, envMapIntensity: chrome ? 1.2 : 0.5 });
  if (['bandes', 'damier', 'flammes', 'camo'].includes(finish)) { hull.map = pattern(finish, color); hull.color.set(0xffffff); }
  const paint = new THREE.MeshStandardMaterial({ color: c, metalness: metal ? 0.9 : 0.35, roughness: metal ? 0.2 : 0.38, envMap, envMapIntensity: metal ? 1 : 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.7, roughness: 0.45, envMap, envMapIntensity: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1e33, metalness: 0.9, roughness: 0.08, emissive: c.clone().multiplyScalar(0.25), envMap, envMapIntensity: 1 });
  const light = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5) }); // dépasse 1 : brille avec le halo
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const mirror = (geo, mat, x = 0, y = 0, z = 0) => { add(geo, mat, x, y, z); add(geo, mat, -x, y, z).scale.x = -1; };
  const dot = r => new THREE.SphereGeometry(r, 10, 8);
  const navs = [];
  const nav = (x, y, z, r = 0.15) => { mirror(dot(r), light, x, y, z); navs.push(g.children.at(-1), g.children.at(-2)); };
  let engines, size = 0.5;

  if (model === 'intercepteur') {
    add(lathe([[0, 5.2], [0.25, 4.6], [0.55, 3.0], [0.75, 1.0], [0.78, -1.5], [0.6, -3.0], [0, -3.0]]), hull);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.5, -1.8).scale.set(0.45, 0.4, 1.4);
    mirror(plate([[0.6, 1.6], [3.6, -0.6], [4.1, -0.3], [1.0, 2.6]], 0.14), paint);
    mirror(plate([[0.5, -2.6], [1.6, -2.2], [1.6, -1.9], [0.6, -1.6]], 0.1), hull);
    mirror(tube(0.45, 0.52, 2.4), dark, 1.1, 0, 2.3);
    mirror(fin([[1.4, 0.3], [3.0, 0.3], [3.3, 1.7], [2.7, 1.7]], 0.1), paint, 1.1, 0.2, 0);
    nav(4.0, 0, -0.4);
    engines = [V(-1.1, 0, 3.5), V(1.1, 0, 3.5)];
    size = 0.42;
  } else if (model === 'cargo') {
    add(new THREE.BoxGeometry(2.6, 1.8, 5.5), hull, 0, 0, 0.3);
    add(new THREE.BoxGeometry(2.64, 0.32, 5.54), paint, 0, 0.35, 0.3);
    add(lathe([[0, 1.0], [0.9, 0.4], [1.05, 0], [1.05, -1.2], [0, -1.2]]), hull, 0, 0, -2.4).scale.set(1.15, 0.85, 1);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.45, -3.0).scale.set(0.8, 0.45, 0.6);
    mirror(new THREE.BoxGeometry(0.9, 1.0, 4.2), paint, 1.85, -0.2, 0.6);
    mirror(plate([[1.3, 0.2], [3.0, 1.2], [3.0, 2.0], [1.3, 2.2]], 0.12), hull);
    for (const [x, y] of [[0.7, 0.5], [-0.7, 0.5], [0.7, -0.5], [-0.7, -0.5]]) add(tube(0.45, 0.55, 1.2), dark, x, y, 3.4);
    add(fin([[1.0, 0.9], [2.8, 0.9], [3.0, 2.0], [2.2, 2.0]], 0.12), paint);
    nav(3.0, 0, 1.6, 0.16);
    engines = [V(0.7, 0.5, 4.0), V(-0.7, 0.5, 4.0), V(0.7, -0.5, 4.0), V(-0.7, -0.5, 4.0)];
    size = 0.45;
  } else if (model === 'chasseur') {
    add(lathe([[0, 4.6], [0.4, 3.8], [0.95, 2.2], [1.25, 0.4], [1.3, -1.8], [1.1, -3.0], [0, -3.0]]), hull).scale.set(1.15, 0.8, 1);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.75, -1.4).scale.set(0.6, 0.45, 1.2);
    mirror(plate([[1.0, -1.2], [4.2, 0.6], [4.4, 2.2], [1.0, 2.4]], 0.3), paint);
    mirror(tube(0.75, 0.85, 3.4), dark, 1.6, -0.1, 1.4);
    mirror(tube(0.22, 0.22, 2.6), dark, 3.7, -0.35, -0.2); // nacelles
    mirror(fin([[1.2, 0.5], [3.0, 0.5], [3.4, 1.9], [2.8, 1.9]], 0.14), hull, 1.0, 0.2, 0);
    add(new THREE.BoxGeometry(2.2, 0.25, 3.2), paint, 0, 0.75, 0.9);
    nav(4.4, 0, 1.3, 0.18);
    engines = [V(-1.6, -0.1, 3.15), V(1.6, -0.1, 3.15)];
    size = 0.68;
  } else if (model === 'course') {
    add(lathe([[0, 6.4], [0.18, 5.6], [0.42, 3.4], [0.58, 0.6], [0.6, -2.4], [0.5, -3.2], [0, -3.2]]), paint);
    add(lathe([[0, 6.42], [0.19, 5.6], [0.3, 4.6], [0, 4.6]]), hull);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.38, -1.2).scale.set(0.34, 0.3, 1.5);
    mirror(plate([[0.5, 0.6], [2.6, 2.4], [2.6, 2.9], [0.5, 2.6]], 0.08), hull);
    mirror(plate([[0.4, -3.6], [1.2, -3.2], [1.2, -3.0], [0.4, -3.0]], 0.06), hull);
    add(fin([[1.0, 0.4], [3.0, 0.4], [3.4, 2.2], [3.0, 2.2]], 0.08), paint);
    add(tube(0.7, 0.9, 1.6), dark, 0, 0, 3.6);
    nav(2.6, 0, 2.7, 0.12);
    engines = [V(0, 0, 4.4)];
    size = 0.78;
  } else if (model === 'soucoupe') {
    add(lathe([[0, 0.5], [2.4, 0.35], [3.8, 0.05], [4.0, -0.05], [3.6, -0.35], [1.8, -0.7], [0, -0.75]]).rotateX(Math.PI / 2), hull);
    add(new THREE.TorusGeometry(3.85, 0.12, 8, 64).rotateX(Math.PI / 2), paint);
    add(new THREE.SphereGeometry(1.35, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.45, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(dot(0.16), light, Math.cos(a) * 3.3, -0.25, Math.sin(a) * 3.3); navs.push(g.children.at(-1)); }
    engines = [V(-1.2, -0.2, 3.3), V(0, -0.2, 3.6), V(1.2, -0.2, 3.3)];
    size = 0.32;
  } else if (model === 'navette') {
    add(lathe([[0, 4.8], [0.5, 4.0], [1.1, 2.4], [1.35, 0.6], [1.3, -1.4], [0.95, -2.6], [0.75, -3.0], [0, -3.0]]), hull);
    add(new THREE.CylinderGeometry(1.36, 1.36, 0.5, 28, 1, true).rotateX(-Math.PI / 2), paint, 0, 0, -1.6);
    add(lathe([[0, 4.82], [0.5, 4.0], [0.62, 3.6], [0, 3.6]]), paint);
    add(new THREE.CircleGeometry(0.45, 24), glass, 0, 0.62, -1.2).rotation.x = -1.2;
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(fin([[0.6, 0.9], [2.8, 0.9], [3.4, 2.5], [2.6, 2.5]], 0.12), paint);
      f.rotation.z = (i / 3) * Math.PI * 2;
      g.add(f);
    }
    add(tube(0.6, 0.8, 0.8), dark, 0, 0, 3.3);
    nav(1.4, 0, 0.6, 0.14);
    engines = [V(0, 0, 3.7)];
    size = 0.66;
  } else {
    add(lathe([[0, 4.4], [0.3, 3.9], [0.7, 2.6], [0.95, 0.8], [1.0, -0.6], [0.85, -2.2], [0.62, -2.9], [0, -2.9]]), hull);
    add(new THREE.CylinderGeometry(1.0, 1.02, 0.7, 24, 1, true).rotateX(-Math.PI / 2), paint, 0, 0, 0.3);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.62, -1.2).scale.set(0.55, 0.45, 1.3);
    mirror(plate([[0.7, -0.6], [3.9, 1.0], [4.0, 1.8], [0.8, 1.9]], 0.14), paint);
    add(fin([[0.8, 0.6], [2.6, 0.6], [2.9, 2.0], [2.3, 2.0]], 0.12), hull);
    add(tube(0.62, 0.72, 1.3), dark, 0, 0, 3.2);
    nav(4.0, 0, 1.5);
    engines = [V(0, 0, 3.85)];
    size = 0.55;
  }

  // Tuyères : anneau lumineux, flamme extérieure colorée, cœur blanc
  const outer = new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(1.3), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1.1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const nozzle = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.2) }), flames = [];
  for (const e of engines) {
    add(new THREE.CircleGeometry(size, 20), nozzle, e.x, e.y, e.z - 0.02);
    flames.push([add(FLAME, outer, e.x, e.y, e.z), add(FLAME, core, e.x, e.y, e.z)]);
  }
  g.userData = { flames, engines, size, navs, color: c, outer, base: outer.color.clone(), ship };
  return g;
}

// Poussée 0..1 (et boost) : longueur et scintillement des flammes. Le boost « plasma » vire au violet.
const PLASMA = new THREE.Color(1.6, 0.5, 2.2);
export function setThrust(ship, thrust, boost) {
  const u = ship.userData, s = u.size;
  u.outer.color.copy(boost && u.ship.boost === 'plasma' ? PLASMA : u.base);
  for (const [f, k] of u.flames) {
    const len = 0.4 + thrust * 3 + (boost ? 5 : 0), flick = 0.85 + Math.random() * 0.3;
    f.scale.set(s + (boost ? 0.12 : 0), s + (boost ? 0.12 : 0), len * flick);
    k.scale.set(s * 0.48, s * 0.48, len * 0.6 * flick);
  }
}

// Feux de position (le salut les fait clignoter)
export function setNavLights(ship, on) { for (const m of ship.userData.navs) m.visible = on; }

// Traînée : un ruban toujours tourné vers la caméra, qui s'efface en s'éloignant.
// Styles : standard, fumee, flammes, etincelles, arcenciel, glitch. À ajouter à la scène : trail.group.
export class Trail {
  constructor(color, style = 'standard', n = 44) {
    this.n = n;
    this.style = style;
    this.width = style === 'fumee' ? 0.5 : style === 'flammes' ? 1 : 0.75;
    this.pts = [];
    this.base = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.2);
    this.pos = new Float32Array(n * 6);
    this.col = new Float32Array(n * 6);
    const idx = [];
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setIndex(idx);
    const smoke = style === 'fumee';
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    if (style === 'etincelles') {
      this.sparks = Array.from({ length: 90 }, () => ({ p: V(0, 0, 0), v: V(0, 0, 0), life: 0 }));
      this.sparkPos = new Float32Array(90 * 3);
      const sg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
      this.sparkPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(2, 1.6, 0.8), size: 0.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.sparkPts.frustumCulled = false;
      this.group.add(this.sparkPts);
    }
    this.t = 0;
  }

  reset() { this.pts.length = 0; }

  colorAt(i, f) {
    const s = this.style;
    if (s === 'arcenciel') { const h = new THREE.Color().setHSL((i / this.n + this.t * 0.25) % 1, 1, 0.55); return [h.r * f * 1.4, h.g * f * 1.4, h.b * f * 1.4]; }
    if (s === 'flammes') { const k = i / this.n; return [1.6 * f, (1.1 - k) * f, 0.2 * (1 - k) * f]; }
    if (s === 'glitch') return Math.floor(i / 3 + this.t * 8) % 2 ? [0.2 * f, 1.4 * f, 1.5 * f] : [1.5 * f, 0.2 * f, 1.3 * f];
    if (s === 'fumee') { const g = 0.6 * f + 0.2; return [g, g, g * 1.05]; }
    return [this.base.r * f, this.base.g * f, this.base.b * f];
  }

  update(head, camPos, strength, dt = 0.016) {
    this.t += dt;
    const p = this.pts.length === this.n ? this.pts.pop() : V(0, 0, 0);
    this.pts.unshift(p.copy(head));
    this.mesh.visible = strength > 0.02 && this.pts.length > 2;
    this.mesh.material.opacity = Math.min(1, strength) * (this.style === 'fumee' ? 0.35 : 1);
    const dir = V(0, 0, 0), toCam = V(0, 0, 0), side = V(0, 0, 0);
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.min(i, this.pts.length - 1)], b = this.pts[Math.min(i + 1, this.pts.length - 1)];
      dir.subVectors(a, b);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      const k = i / this.n;
      let w = this.width * (1 - k);
      if (this.style === 'fumee') w = this.width * (0.4 + 3 * k); // la fumée s'élargit en se dissipant
      if (this.style === 'flammes') w *= 0.7 + Math.random() * 0.6;
      side.crossVectors(dir, toCam.subVectors(camPos, a)).normalize().multiplyScalar(w);
      let jx = 0, jy = 0, jz = 0;
      if (this.style === 'glitch' && Math.random() < 0.25) { jx = (Math.random() - 0.5) * 1.5; jy = (Math.random() - 0.5) * 1.5; jz = (Math.random() - 0.5) * 1.5; }
      this.pos.set([a.x + side.x + jx, a.y + side.y + jy, a.z + side.z + jz, a.x - side.x + jx, a.y - side.y + jy, a.z - side.z + jz], i * 6);
      const c = this.colorAt(i, this.style === 'fumee' ? 1 - k : (1 - k) ** 1.6);
      this.col.set([...c, ...c], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    if (this.sparks) {
      this.sparks.forEach((s, i) => {
        if (s.life <= 0 && strength > 0.1 && Math.random() < 0.35) { s.p.copy(head); s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(12); s.life = 0.4 + Math.random() * 0.6; }
        s.life -= dt;
        s.p.addScaledVector(s.v, dt);
        this.sparkPos.set(s.life > 0 ? [s.p.x, s.p.y, s.p.z] : [1e9, 1e9, 1e9], i * 3);
      });
      this.sparkPts.geometry.attributes.position.needsUpdate = true;
    }
  }
}
