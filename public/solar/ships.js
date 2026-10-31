// Vaisseaux de Solar Explorer : trois modèles construits en formes simples, à la couleur du pilote,
// avec flammes de réacteur (selon la poussée) et traînée lumineuse.
// Repère : le nez pointe vers -Z, le haut vers +Y ; un vaisseau mesure 6 à 8 unités.
import * as THREE from 'three';

export const MODELS = {
  eclaireur: { name: 'Éclaireur', desc: 'Polyvalent et maniable : le vaisseau des explorateurs.' },
  intercepteur: { name: 'Intercepteur', desc: 'Effilé, ailes inversées et double réacteur.' },
  cargo: { name: 'Cargo', desc: 'Massif et rassurant, avec quatre réacteurs.' },
};
export const COLORS = ['#36d7ff', '#ff5c8a', '#ffb340', '#7cff6b', '#b07cff', '#ff6b3d', '#f5f7fa', '#2f6bff'];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lathe = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24).rotateX(-Math.PI / 2);
// Plaque plate (aile) : points [envergure, avant(-)/arrière(+)]
const plate = (pts, thick) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2).rotateX(Math.PI / 2);
// Dérive verticale : points [arrière, hauteur]
const fin = (pts, thick) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2).rotateY(-Math.PI / 2);
const tube = (r1, r2, len) => new THREE.CylinderGeometry(r1, r2, len, 20).rotateX(Math.PI / 2);
const FLAME = new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);

export function buildShip(model, color) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const hull = new THREE.MeshStandardMaterial({ color: 0xc9d3de, metalness: 0.55, roughness: 0.32 });
  const paint = new THREE.MeshStandardMaterial({ color: c, metalness: 0.35, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.7, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1e33, metalness: 0.9, roughness: 0.08, emissive: c.clone().multiplyScalar(0.25) });
  const light = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5) }); // dépasse 1 : brille avec le halo
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const mirror = (geo, mat, x = 0, y = 0, z = 0) => { add(geo, mat, x, y, z); add(geo, mat, -x, y, z).scale.x = -1; };
  const dot = r => new THREE.SphereGeometry(r, 10, 8);
  let engines;

  if (model === 'intercepteur') {
    add(lathe([[0, 5.2], [0.25, 4.6], [0.55, 3.0], [0.75, 1.0], [0.78, -1.5], [0.6, -3.0], [0, -3.0]]), hull);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.5, -1.8).scale.set(0.45, 0.4, 1.4);
    mirror(plate([[0.6, 1.6], [3.6, -0.6], [4.1, -0.3], [1.0, 2.6]], 0.14), paint);
    mirror(plate([[0.5, -2.6], [1.6, -2.2], [1.6, -1.9], [0.6, -1.6]], 0.1), hull);
    mirror(tube(0.45, 0.52, 2.4), dark, 1.1, 0, 2.3);
    mirror(fin([[1.4, 0.3], [3.0, 0.3], [3.3, 1.7], [2.7, 1.7]], 0.1), paint, 1.1, 0.2, 0);
    mirror(dot(0.14), light, 4.0, 0, -0.4);
    engines = [V(-1.1, 0, 3.5), V(1.1, 0, 3.5)];
  } else if (model === 'cargo') {
    add(new THREE.BoxGeometry(2.6, 1.8, 5.5), hull, 0, 0, 0.3);
    add(new THREE.BoxGeometry(2.64, 0.32, 5.54), paint, 0, 0.35, 0.3);
    add(lathe([[0, 1.0], [0.9, 0.4], [1.05, 0], [1.05, -1.2], [0, -1.2]]), hull, 0, 0, -2.4).scale.set(1.15, 0.85, 1);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.45, -3.0).scale.set(0.8, 0.45, 0.6);
    mirror(new THREE.BoxGeometry(0.9, 1.0, 4.2), paint, 1.85, -0.2, 0.6);
    mirror(plate([[1.3, 0.2], [3.0, 1.2], [3.0, 2.0], [1.3, 2.2]], 0.12), hull);
    for (const [x, y] of [[0.7, 0.5], [-0.7, 0.5], [0.7, -0.5], [-0.7, -0.5]]) add(tube(0.45, 0.55, 1.2), dark, x, y, 3.4);
    add(fin([[1.0, 0.9], [2.8, 0.9], [3.0, 2.0], [2.2, 2.0]], 0.12), paint);
    mirror(dot(0.16), light, 3.0, 0, 1.6);
    engines = [V(0.7, 0.5, 4.0), V(-0.7, 0.5, 4.0), V(0.7, -0.5, 4.0), V(-0.7, -0.5, 4.0)];
  } else {
    add(lathe([[0, 4.4], [0.3, 3.9], [0.7, 2.6], [0.95, 0.8], [1.0, -0.6], [0.85, -2.2], [0.62, -2.9], [0, -2.9]]), hull);
    add(new THREE.CylinderGeometry(1.0, 1.02, 0.7, 24, 1, true).rotateX(-Math.PI / 2), paint, 0, 0, 0.3);
    add(new THREE.SphereGeometry(1, 20, 14), glass, 0, 0.62, -1.2).scale.set(0.55, 0.45, 1.3);
    mirror(plate([[0.7, -0.6], [3.9, 1.0], [4.0, 1.8], [0.8, 1.9]], 0.14), paint);
    add(fin([[0.8, 0.6], [2.6, 0.6], [2.9, 2.0], [2.3, 2.0]], 0.12), hull);
    add(tube(0.62, 0.72, 1.3), dark, 0, 0, 3.2);
    mirror(dot(0.15), light, 4.0, 0, 1.5);
    engines = [V(0, 0, 3.85)];
  }

  // Tuyères : anneau lumineux, flamme extérieure colorée, cœur blanc
  const outer = new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(1.3), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1.1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const nozzle = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.2) }), flames = [];
  for (const e of engines) {
    add(new THREE.CircleGeometry(0.5, 20), nozzle, e.x, e.y, e.z - 0.02);
    const f = add(FLAME, outer, e.x, e.y, e.z), k = add(FLAME, core, e.x, e.y, e.z);
    flames.push([f, k]);
  }
  g.userData = { flames, engines, color: c };
  return g;
}

// Poussée 0..1 (et boost) : longueur et scintillement des flammes.
export function setThrust(ship, thrust, boost) {
  for (const [f, k] of ship.userData.flames) {
    const len = 0.4 + thrust * 3 + (boost ? 5 : 0), flick = 0.85 + Math.random() * 0.3;
    f.scale.set(0.5 + (boost ? 0.12 : 0), 0.5 + (boost ? 0.12 : 0), len * flick);
    k.scale.set(0.24, 0.24, len * 0.6 * flick);
  }
}

// Traînée lumineuse : un ruban toujours tourné vers la caméra, qui s'efface en s'éloignant.
export class Trail {
  constructor(color, n = 44, width = 0.75) {
    this.n = n;
    this.width = width;
    this.pts = [];
    this.pos = new Float32Array(n * 6);
    const col = new Float32Array(n * 6), c = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.2), idx = [];
    for (let i = 0; i < n; i++) {
      const f = (1 - i / (n - 1)) ** 1.6;
      col.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], i * 6);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
  }

  reset() { this.pts.length = 0; }

  update(head, camPos, strength) {
    const p = this.pts.length === this.n ? this.pts.pop() : new THREE.Vector3();
    this.pts.unshift(p.copy(head));
    this.mesh.visible = strength > 0.02 && this.pts.length > 2;
    this.mesh.material.opacity = Math.min(1, strength);
    const dir = new THREE.Vector3(), toCam = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.min(i, this.pts.length - 1)], b = this.pts[Math.min(i + 1, this.pts.length - 1)];
      dir.subVectors(a, b);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      side.crossVectors(dir, toCam.subVectors(camPos, a)).normalize().multiplyScalar(this.width * (1 - i / this.n));
      this.pos.set([a.x + side.x, a.y + side.y, a.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
