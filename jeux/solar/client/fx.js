// Effets passagers : feu d'artifice, onde de choc et éclairs du boost, éclair de téléportation.
// Chaque effet vit quelques secondes ; fx.update(dt) les anime puis les retire de la scène.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const live = [];
// Point rond et doux pour les particules
const dot = (() => {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
let scene = null;
export const initFx = s => (scene = s);

function add(obj, life, step) {
  scene.add(obj);
  live.push({ obj, life, age: 0, step });
}

export function updateFx(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const e = live[i];
    e.age += dt;
    if (e.age >= e.life) { scene.remove(e.obj); e.obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); live.splice(i, 1); continue; }
    e.step(e.age / e.life, dt, e.obj);
  }
}

// Feu d'artifice : plusieurs bouquets de particules colorées qui s'ouvrent puis retombent en s'éteignant.
export function firework(at) {
  for (let k = 0; k < 3; k++) {
    const n = 160, pos = new Float32Array(n * 3), vel = [], center = at.clone().add(V((Math.random() - 0.5) * 30, 8 + Math.random() * 20, (Math.random() - 0.5) * 30));
    for (let i = 0; i < n; i++) { pos.set([center.x, center.y, center.z], i * 3); vel.push(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(18 + Math.random() * 10)); }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = new THREE.Color().setHSL(Math.random(), 1, 0.6).multiplyScalar(2.2);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 2.2, map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    const delay = k * 0.35;
    add(pts, 2.4 + delay, (f, dt) => {
      const t = f * (2.4 + delay);
      pts.visible = t > delay;
      if (!pts.visible) return;
      for (let i = 0; i < n; i++) {
        vel[i].multiplyScalar(1 - dt * 1.4);
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt - dt * 3; pos[i * 3 + 2] += vel[i].z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = 1 - (t - delay) / 2.4;
    });
  }
}

// Onde de choc : un anneau lumineux qui s'élargit derrière le vaisseau.
export function shockwave(at, quat, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.copy(at);
  ring.quaternion.copy(quat);
  add(ring, 0.7, f => { ring.scale.setScalar(2 + f * 26); ring.material.opacity = 1 - f; });
}

// Éclairs autour du vaisseau pendant le boost : redessinés à chaque image.
export function lightning(ship) {
  const n = 3, seg = 8, pos = new Float32Array(n * seg * 6);
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 1.8, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false;
  ship.add(lines);
  return {
    set(on) {
      lines.visible = on;
      if (!on) return;
      let o = 0;
      for (let k = 0; k < n; k++) {
        let p = V((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, -3 + Math.random() * 2);
        for (let s = 0; s < seg; s++) {
          const q = p.clone().add(V((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0.9 + Math.random() * 0.6));
          pos.set([p.x, p.y, p.z, q.x, q.y, q.z], o);
          o += 6;
          p = q;
        }
      }
      lines.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// Téléportation : une sphère de lumière qui grandit et s'efface.
export function warpFlash(at, color) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.copy(at);
  add(s, 0.8, f => { s.scale.setScalar(2 + f * 30); s.material.opacity = 1 - f; });
}
