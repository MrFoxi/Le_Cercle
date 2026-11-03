// Little District : les animaux (modèles et petites animations). Chats, chiens, pigeons, oiseaux, carpes koï.
import * as THREE from 'three';
import { std } from './models.js';

const G = {
  sphere: new THREE.SphereGeometry(0.5, 12, 9),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  leg: new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0),
  tail: new THREE.CylinderGeometry(0.35, 0.5, 1, 6).translate(0, 0.5, 0),
  wing: new THREE.BoxGeometry(1, 0.08, 0.5).translate(0.5, 0, 0),
};
function part(parent, geo, m, x, y, z, sx, sy = sx, sz = sx) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true;
  parent.add(o);
  return o;
}

export const CAT_COLORS = [['#d9893a', '#f3d2a8'], ['#222226', '#2e2e33'], ['#efeae2', '#ffffff'], ['#8a8580', '#b5b0aa'], ['#5a4030', '#e9dccb']];
// Chat (ou chien, plus grand et oreilles tombantes). Face vers +z.
export function makeCat(colors = CAT_COLORS[0], { dog = false, gold = false } = {}) {
  const s = dog ? 1.35 : 1;
  const fur = gold ? std('#ffcf4a', { metalness: 0.9, roughness: 0.25, emissive: '#7a5200' }) : std(colors[0], { roughness: 0.95 });
  const belly = gold ? fur : std(colors[1], { roughness: 0.95 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = part(body, G.sphere, fur, 0, 0.13 * s, 0, 0.16 * s, 0.13 * s, 0.32 * s);
  part(body, G.sphere, belly, 0, 0.11 * s, 0.03 * s, 0.12 * s, 0.1 * s, 0.24 * s);
  const head = new THREE.Group(); head.position.set(0, 0.21 * s, 0.15 * s); body.add(head);
  part(head, G.sphere, fur, 0, 0, 0, 0.13 * s, 0.11 * s, 0.12 * s);
  part(head, G.sphere, belly, 0, -0.02 * s, 0.05 * s, 0.06 * s, 0.05 * s, 0.05 * s);
  for (const k of [-1, 1]) {
    const ear = part(head, G.cone, fur, k * 0.04 * s, 0.06 * s, 0, 0.045 * s, 0.07 * s, 0.03 * s);
    if (dog) { ear.rotation.z = k * 2.6; ear.position.y = 0.02 * s; ear.position.x = k * 0.065 * s; }
    part(head, G.sphere, std('#111'), k * 0.03 * s, 0.01 * s, 0.055 * s, 0.015 * s);
  }
  const legs = [];
  for (const [x, z] of [[-0.05, 0.1], [0.05, 0.1], [-0.05, -0.1], [0.05, -0.1]]) legs.push(part(body, G.leg, fur, x * s, 0.1 * s, z * s, 0.035 * s, 0.1 * s, 0.035 * s));
  const tail = part(body, G.tail, fur, 0, 0.15 * s, -0.15 * s, 0.035 * s, dog ? 0.12 : 0.22 * s, 0.035 * s);
  tail.rotation.x = dog ? -0.8 : -0.5;
  return { root, body, head, legs, tail, torso, s, ph: Math.random() * 6 };
}
// Animation : 'walk', 'sit', 'sleep', 'groom', 'idle'
export function animateCat(c, dt, mode) {
  c.ph += dt * (mode === 'walk' ? 9 : 2);
  const w = mode === 'walk' ? Math.sin(c.ph) * 0.6 : 0;
  c.legs.forEach((l, i) => { l.visible = mode !== 'sleep'; l.rotation.x = (i === 0 || i === 3 ? w : -w); });
  c.body.position.y = mode === 'sleep' ? -0.07 * c.s : mode === 'sit' ? -0.02 * c.s : 0;
  c.body.rotation.x = mode === 'sit' ? -0.35 : 0;
  c.head.rotation.set(mode === 'groom' ? 0.5 + Math.sin(c.ph * 3) * 0.2 : mode === 'sleep' ? 0.3 : Math.sin(c.ph * 0.3) * 0.1, mode === 'sleep' ? 0.9 : 0, 0);
  c.tail.rotation.z = Math.sin(c.ph * (mode === 'walk' ? 0.5 : 0.8)) * 0.4;
  c.torso.scale.y = 0.13 * c.s * (1 + Math.sin(c.ph * (mode === 'sleep' ? 0.6 : 1)) * 0.03); // respiration
}

export function makePigeon() {
  const root = new THREE.Group(), grey = std('#7d8088'), dark = std('#4a4d55');
  const body = part(root, G.sphere, grey, 0, 0.06, 0, 0.08, 0.07, 0.13);
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.06); root.add(head);
  part(head, G.sphere, std('#5c6f6a', { metalness: 0.3, roughness: 0.4 }), 0, 0, 0, 0.055);
  part(head, G.cone, std('#d8a23a'), 0, 0, 0.035, 0.015, 0.03, 0.015).rotation.x = Math.PI / 2;
  const wings = [-1, 1].map(k => { const w = part(root, G.wing, dark, k * 0.03, 0.08, -0.01, 0.1, 1, 0.12); w.rotation.y = k > 0 ? 0 : Math.PI; return w; });
  return { root, body, head, wings, ph: Math.random() * 6 };
}
export function makeBird() {
  const root = new THREE.Group(), m = std('#2a2a30');
  part(root, G.sphere, m, 0, 0, 0, 0.07, 0.06, 0.16);
  const wings = [-1, 1].map(k => { const w = part(root, G.wing, m, 0, 0, 0, 0.24, 1, 0.12); w.rotation.y = k > 0 ? 0 : Math.PI; return w; });
  return { root, wings, ph: Math.random() * 6 };
}
export function flap(b, dt, speed = 14, amp = 0.8) {
  b.ph += dt * speed;
  b.wings.forEach((w, k) => (w.rotation.z = Math.sin(b.ph) * amp * (k ? 1 : -1)));
}

export function makeKoi(i) {
  const root = new THREE.Group();
  const main = std(['#ff7a2a', '#f4f1ea', '#e8422a', '#ffb347', '#f4f1ea', '#ff7a2a', '#222'][i % 7], { roughness: 0.4 });
  part(root, G.sphere, main, 0, 0, 0, 0.1, 0.06, 0.3);
  if (i % 2) part(root, G.sphere, std('#e8422a'), 0, 0.02, 0.04, 0.07, 0.04, 0.12);
  const tail = part(root, G.cone, main, 0, 0, -0.17, 0.09, 0.12, 0.02);
  tail.rotation.x = -Math.PI / 2;
  return { root, tail, ph: Math.random() * 6 };
}
