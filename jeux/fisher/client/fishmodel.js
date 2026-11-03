// Little Fisher : poissons et crustacés en 3D (pour la prise qui saute hors de l'eau et la plongée), d'après look et size.
// Le modèle regarde vers +z ; sa longueur suit la taille moyenne de l'espèce.
import * as THREE from 'three';

const geo = {
  body: new THREE.SphereGeometry(0.5, 14, 10), tail: new THREE.ConeGeometry(0.5, 0.6, 4), fin: new THREE.ConeGeometry(0.3, 0.5, 3),
  eye: new THREE.SphereGeometry(0.06, 8, 6), leg: new THREE.CylinderGeometry(0.03, 0.02, 0.5, 5), seg: new THREE.SphereGeometry(0.5, 10, 8),
};
const mats = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.15, ...o })); return mats.get(k); };
function part(g, geometry, color, [x, y, z], [sx, sy, sz], [rx, ry, rz] = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m;
}

export function fishMesh(f) {
  const L = f.look, g = new THREE.Group(), len = Math.max(0.25, (f.size[0] + f.size[1]) / 200); // en mètres
  const inner = new THREE.Group(); g.add(inner);
  const tail = new THREE.Group(); inner.add(tail);
  switch (L.shape) {
    case 'crabe': case 'homard': {
      const lobster = L.shape === 'homard';
      part(inner, geo.body, L.body, [0, 0, 0], lobster ? [0.35, 0.28, 1] : [0.9, 0.35, 0.7]);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) part(inner, geo.leg, L.accent, [s * (lobster ? 0.2 : 0.45), -0.08, (k - 1) * 0.2], [1, 1, 1], [0, 0, s * 1.1]);
        part(inner, geo.body, L.body, [s * (lobster ? 0.28 : 0.55), 0, lobster ? 0.75 : 0.42], [0.22, 0.14, 0.32]); // pinces
        part(inner, geo.eye, '#111111', [s * 0.12, 0.17, lobster ? 0.5 : 0.3], [1, 1, 1]);
      }
      if (lobster) part(tail, geo.seg, L.body, [0, 0, -0.75], [0.28, 0.2, 0.55]);
      break;
    }
    case 'poulpe': case 'calmar': {
      part(inner, geo.body, L.body, [0, 0, 0.25], [0.55, 0.5, L.shape === 'calmar' ? 1 : 0.6]);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(tail, geo.leg, L.body, [Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.35], [2, 1.6, 2], [Math.PI / 2 + Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3]); }
      for (const s of [-1, 1]) part(inner, geo.eye, '#111111', [s * 0.24, 0.1, 0.1], [1.4, 1.4, 1.4]);
      break;
    }
    case 'raie': {
      part(inner, geo.body, L.body, [0, 0, 0], [1.6, 0.12, 0.9]);
      part(tail, geo.leg, L.body, [0, 0, -0.9], [1.5, 2.5, 1.5], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'anguille': {
      for (let k = 0; k < 6; k++) part(k < 2 ? inner : tail, geo.seg, k % 2 ? L.belly : L.body, [0, 0, 0.5 - k * 0.2], [0.16, 0.18, 0.3]);
      for (const s of [-1, 1]) part(inner, geo.eye, '#111111', [s * 0.07, 0.06, 0.55], [1, 1, 1]);
      break;
    }
    default: {
      const tall = { rond: 0.75, ange: 1.15, plat: 0.3, epee: 0.4, long: 0.45 }[L.shape] ?? 0.45;
      const wide = L.shape === 'plat' ? 0.75 : 0.35;
      part(inner, geo.body, L.body, [0, 0, 0], [wide, tall, 1]);
      part(inner, geo.body, L.belly, [0, -tall * 0.12, 0.02], [wide * 0.92, tall * 0.8, 0.9]);
      part(tail, geo.tail, L.accent, [0, 0, -0.55], [0.12, 0.6 * Math.max(0.6, tall), 0.8], [-Math.PI / 2, 0, 0]);
      part(inner, geo.fin, L.accent, [0, tall * 0.48, -0.05], [0.12, L.shape === 'ange' ? 1.4 : 0.6, 0.8], [-0.4, 0, 0]);
      if (L.shape === 'ange') part(inner, geo.fin, L.accent, [0, -tall * 0.48, -0.05], [0.12, 1.4, 0.8], [Math.PI + 0.4, 0, 0]);
      if (L.shape === 'epee') part(inner, geo.leg, L.accent, [0, 0, 0.8], [1, 1.3, 1], [Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) part(inner, geo.eye, '#111111', [s * wide * 0.45, tall * 0.12, 0.33], [1, 1, 1]);
    }
  }
  if (L.pattern === 'glow' || L.pattern === 'lure') part(inner, geo.eye, L.accent, [0, 0.3, 0.45], [1.6, 1.6, 1.6]).material = new THREE.MeshStandardMaterial({ color: L.accent, emissive: L.accent, emissiveIntensity: 2 });
  g.scale.setScalar(len);
  g.userData = { tail, len, inner };
  return g;
}
// Battement de queue : à appeler à chaque image (vitesse 0 à 1).
export function swim(m, t, speed = 0.5) {
  m.userData.tail.rotation.y = Math.sin(t * (6 + speed * 10)) * (0.25 + speed * 0.35);
}
