// Monoplace de Top Formula : coque vue de dessus peinte avec une livrée (dégradés, motif, sponsors inventés, numéro),
// vernis brillant, pontons et prises d'air, halo, ailerons, roues qui tournent et braquent, ombre douce au sol.
import * as THREE from 'three';
import { canvasTex, contact } from './textures.js';

const SPONSORS = ['NEBULA', 'VELOCE', 'KAIZEN', 'AURORA', 'ORBITAL', 'HELIX', 'MISTRAL'];
const L0 = -2.6, L1 = 2.7, W = 0.95; // emprise de la coque (m) couverte par la livrée
const ink = hex => { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.55 ? '#111' : '#fff'; };

function livery(look) {
  const key = JSON.stringify(look);
  return canvasTex(1024, 384, (g, w, h) => {
    const U = x => (x - L0) / (L1 - L0) * w, V = y => (1 - (y + W) / (2 * W)) * h; // mètres -> pixels
    // fond : couleur, plus sombre sur les bords
    const gr = g.createLinearGradient(0, 0, 0, h);
    const base = new THREE.Color(look.color), dark = base.clone().multiplyScalar(0.62).getStyle(), light = base.clone().lerp(new THREE.Color('#fff'), 0.12).getStyle();
    gr.addColorStop(0, dark); gr.addColorStop(0.5, light); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = look.accent;
    if (look.motif === 'stripe') { g.fillRect(0, V(0.13), w, V(-0.13) - V(0.13)); g.fillStyle = ink(look.accent) === '#fff' ? '#ffffff55' : '#00000033'; g.fillRect(0, V(0.17), w, 4); g.fillRect(0, V(-0.17) - 4, w, 4); }
    if (look.motif === 'arrow') for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
      const x = U(-0.9 + k * 0.45);
      g.beginPath(); g.moveTo(x, V(0.3 * s)); g.lineTo(x + 40, V(0.55 * s)); g.lineTo(x, V(0.8 * s)); g.lineTo(x - 22, V(0.8 * s)); g.lineTo(x + 18, V(0.55 * s)); g.lineTo(x - 22, V(0.3 * s)); g.fill();
    }
    if (look.motif === 'split') { g.beginPath(); g.moveTo(0, 0); g.lineTo(U(-0.2), 0); g.lineTo(U(0.25), h); g.lineTo(0, h); g.fill(); }
    if (look.motif === 'plain') { g.globalAlpha = 0.7; g.fillRect(U(-0.4), V(0.85), U(0.3) - U(-0.4), 10); g.fillRect(U(-0.4), V(-0.85) - 10, U(0.3) - U(-0.4), 10); g.globalAlpha = 1; }
    // pointe du nez à la couleur secondaire
    g.fillStyle = look.accent; g.fillRect(U(2.15), 0, w, h);
    // sponsors sur les pontons
    g.fillStyle = ink(look.color); g.font = 'italic 900 38px Titillium Web, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const sp = SPONSORS[(look.number ?? 1) % SPONSORS.length], sp2 = SPONSORS[((look.number ?? 1) + 3) % SPONSORS.length];
    for (const s of [1, -1]) {
      g.save(); g.translate(U(-0.45), V(0.6 * s)); g.rotate(s > 0 ? 0 : Math.PI); g.fillText(sp, 0, 0); g.restore();
    }
    g.font = 'italic 900 26px Titillium Web, Inter, sans-serif';
    g.fillText(sp2, U(1.3), V(0) + 1);
    // numéro dans un rond blanc, sur le nez
    g.fillStyle = '#fff'; g.beginPath(); g.arc(U(1.85), V(0), 34, 0, 7); g.fill();
    g.fillStyle = look.color; g.font = '900 46px Titillium Web, Inter, sans-serif'; g.fillText(look.number ?? 1, U(1.85), V(0) + 3);
    // petits reflets et salissures de course
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, V(0.05), w, 6);
  }, { repeat: false, key: 'livery' + key });
}

export function buildCar(look, { ghost = false } = {}) {
  const grp = new THREE.Group();
  const paint = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });
  const tex = livery(look);
  tex.repeat.set(1 / (L1 - L0), 1 / (2 * W)); tex.offset.set(-L0 / (L1 - L0), W / (2 * W));
  const liveryMat = paint('#ffffff', { map: tex }), body = paint(look.color), accent = paint(look.accent);
  const dark = new THREE.MeshStandardMaterial({ color: '#141619', roughness: 0.5, metalness: 0.4 });
  const carbon = new THREE.MeshStandardMaterial({ color: '#25282e', roughness: 0.35, metalness: 0.6 });
  // Coque vue de dessus : nez fin, pontons larges, arrière effilé.
  const s = new THREE.Shape();
  const P = [[2.55, 0], [1.7, 0.17], [0.75, 0.32], [0.38, 0.76], [-0.25, 0.82], [-1.2, 0.7], [-1.85, 0.36], [-2.25, 0.2]];
  s.moveTo(...P[0]);
  for (const p of P.slice(1)) s.lineTo(p[0], p[1]);
  for (const p of [...P].reverse()) s.lineTo(p[0], -p[1]);
  const shell = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 3, curveSegments: 2 });
  shell.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(shell, [liveryMat, body]); hull.position.y = 0.2; grp.add(hull);
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); return m; };
  // Fond plat en carbone qui dépasse de la coque, diffuseur
  add(new THREE.BoxGeometry(3.4, 0.05, 1.78), carbon, -0.35, 0.17, 0);
  add(new THREE.BoxGeometry(0.5, 0.18, 1.0), carbon, -2.3, 0.25, 0);
  // Capot moteur bombé, aileron de requin, boîte à air et caméra embarquée
  const cover = add(new THREE.CapsuleGeometry(0.3, 1.5, 4, 12), look.motif === 'split' ? accent : body, -0.75, 0.62, 0);
  cover.rotation.z = Math.PI / 2; cover.scale.set(1, 1, 0.85);
  add(new THREE.BoxGeometry(1.2, 0.3, 0.05), accent, -1.45, 0.78, 0);
  add(new THREE.BoxGeometry(0.32, 0.26, 0.3), body, -0.08, 0.86, 0);
  add(new THREE.BoxGeometry(0.06, 0.12, 0.2), dark, 0.07, 0.9, 0);
  add(new THREE.BoxGeometry(0.16, 0.05, 0.08), accent, -0.12, 1.02, 0);
  // Prises d'air des pontons, rétroviseurs
  for (const z of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.22, 0.32), dark, 0.42, 0.42, z * 0.62);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.2), body, 0.62, 0.78, z * 0.52);
    add(new THREE.BoxGeometry(0.03, 0.14, 0.03), carbon, 0.62, 0.7, z * 0.46);
  }
  // Cockpit, halo, casque
  const cock = add(new THREE.CircleGeometry(0.3, 18), dark, 0.4, 0.67, 0); cock.rotation.x = -Math.PI / 2; cock.scale.set(1.7, 1, 1);
  add(new THREE.SphereGeometry(0.2, 16, 12), paint(look.helmet ?? look.accent), 0.35, 0.72, 0);
  add(new THREE.BoxGeometry(0.08, 0.07, 0.26), dark, 0.52, 0.76, 0);
  const halo = add(new THREE.TorusGeometry(0.34, 0.045, 6, 18, Math.PI), carbon, 0.48, 0.9, 0); halo.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  add(new THREE.BoxGeometry(0.06, 0.25, 0.06), carbon, 0.82, 0.78, 0);
  // Ailerons
  add(new THREE.BoxGeometry(0.55, 0.05, 2.05), accent, 2.3, 0.22, 0);
  add(new THREE.BoxGeometry(0.25, 0.05, 1.9), body, 2.05, 0.3, 0);
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.6, 0.22, 0.04), carbon, 2.25, 0.3, z * 1.03);
  add(new THREE.BoxGeometry(0.42, 0.05, 1.55), body, -2.2, 0.98, 0);
  const flap = add(new THREE.BoxGeometry(0.28, 0.04, 1.5), accent, -2.0, 1.05, 0);
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.7, 0.6, 0.04), carbon, -2.15, 0.78, z * 0.78);
  add(new THREE.BoxGeometry(0.2, 0.45, 0.06), carbon, -2.1, 0.72, 0);
  // Feu arrière (pluie, nuit)
  const rain = add(new THREE.BoxGeometry(0.06, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a2a', emissiveIntensity: 0 }), -2.4, 0.45, 0);
  // Roues
  const tyre = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.85 });
  const wall = new THREE.MeshStandardMaterial({ color: look.accent, roughness: 0.6 });
  const rimM = new THREE.MeshStandardMaterial({ color: look.rim ?? '#c9ccd2', roughness: 0.25, metalness: 0.85 });
  const wheels = [], pivots = [];
  for (const [x, z, w, front] of [[1.55, 0.95, 0.36, true], [1.55, -0.95, 0.36, true], [-1.5, 0.93, 0.44, false], [-1.5, -0.93, 0.44, false]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.37, z);
    const wheel = new THREE.Group();
    const tg = new THREE.CylinderGeometry(0.37, 0.37, w, 20); tg.rotateX(Math.PI / 2);
    wheel.add(new THREE.Mesh(tg, tyre));
    const side = Math.sign(z) * (w / 2 + 0.004);
    const band = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.31, 20), wall); band.position.z = side; band.rotation.y = z > 0 ? 0 : Math.PI; wheel.add(band);
    const rim = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), rimM); rim.position.z = side * 1.01; rim.rotation.y = z > 0 ? 0 : Math.PI; wheel.add(rim);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.01), tyre); spoke.position.z = side * 1.03; wheel.add(spoke);
    piv.add(wheel); grp.add(piv);
    wheels.push(wheel); if (front) pivots.push(piv);
    add(new THREE.BoxGeometry(0.05, 0.04, Math.abs(z) - 0.25), carbon, x, 0.42, z / 2 + Math.sign(z) * 0.1);
  }
  grp.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = !ghost;
    if (ghost) {
      o.material = [].concat(o.material).map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.35; c.depthWrite = false; return c; });
      if (o.material.length === 1) o.material = o.material[0];
    }
  });
  // Ombre douce au sol (toujours là, même sans ombres portées)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3), new THREE.MeshBasicMaterial({ map: contact(), transparent: true, depthWrite: false, opacity: ghost ? 0.25 : 0.85 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; shadow.renderOrder = 2;
  grp.add(shadow);
  return { group: grp, wheels, pivots, flap, rain };
}
