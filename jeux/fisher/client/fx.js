// Little Fisher : petits effets passagers : ronds dans l'eau, poisson qui saute vers le bateau, bulles.
import * as THREE from 'three';
import { S } from './state.js';
import { fishMesh, swim } from './fishmodel.js';

const fx = [];
const ringGeo = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
export function splashAt(p, size = 1) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  m.position.set(p.x, (p.y ?? 0) + 0.05, p.z); S.scene.add(m);
  fx.push({ t: 0, life: 1.1, update: k => { m.scale.setScalar(0.5 + k * 4 * size); m.material.opacity = 0.8 * (1 - k); }, done: () => { S.scene.remove(m); m.material.dispose(); } });
}
// La prise saute de l'eau et retombe dans le bateau.
export function jumpFish(f, from) {
  const g = fishMesh(f); g.scale.multiplyScalar(1.6); S.scene.add(g);
  splashAt(from, 1.4);
  fx.push({ t: 0, life: 0.9, update: k => {
    const B = S.B;
    g.position.set(from.x + (B.x - from.x) * k, from.y + Math.sin(k * Math.PI) * 4 + k * 1.2, from.z + (B.z - from.z) * k);
    g.rotation.set(-0.6 + k * 1.2, Math.atan2(B.x - from.x, B.z - from.z), Math.sin(k * 30) * 0.4);
    swim(g, S.time, 1);
  }, done: () => S.scene.remove(g) });
}
const bubbleGeo = new THREE.SphereGeometry(0.06, 6, 4), bubbleMat = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.7 });
export function bubbles(p, n = 6) {
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(bubbleGeo, bubbleMat), ox = (Math.random() - 0.5) * 0.4, oz = (Math.random() - 0.5) * 0.4, s = 0.6 + Math.random();
    m.scale.setScalar(s); S.scene.add(m);
    fx.push({ t: -k * 0.05, life: 1.6, update: kk => m.position.set(p.x + ox + Math.sin(kk * 9 + k) * 0.08, p.y + kk * 2.5, p.z + oz), done: () => S.scene.remove(m) });
  }
}
export function updateFx(dt) {
  for (let k = fx.length - 1; k >= 0; k--) { const e = fx[k]; e.t += dt; if (e.t < 0) continue; e.update(Math.min(1, e.t / e.life)); if (e.t >= e.life) { e.done(); fx.splice(k, 1); } }
}
