// LES EAUX DE MONET — ce qu'on voit de soi : les mains, la manche de lin, la canne de bambou, le moulinet, la ligne et le leurre,
// peints avec les mêmes touches que le paysage.
import * as THREE from 'three';
import { Toile, FACE, CANNE, matiereTouches, pioche, melange, couleur } from './peinture.js';
import { hasard } from './etang.js';

const PEAU = ['#e6bd98', '#d8a884', '#f0cfae', '#c8967a'], LIN = ['#6f8fac', '#5f7f9f', '#86a2b8', '#54708f'], BAMBOU = ['#c8a860', '#b08f4c', '#d8bc78', '#94743e'], LAITON = ['#c9a050', '#a8803c', '#e0c070'], LONG = 2.6;

// un membre : des touches tout autour d'un cylindre
function membre(T, a, b, ra, rb, pal, r, n = 80) {
  const ax = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), u = new THREE.Vector3(0.3, 1, 0.2).cross(ax).normalize(), v = ax.clone().cross(u);
  for (let i = 0; i < n; i++) { const t = r(), R = ra + (rb - ra) * t, f = r() * 6.28, no = u.clone().multiplyScalar(Math.cos(f)).addScaledVector(v, Math.sin(f)); T.touche(a[0] + (b[0] - a[0]) * t + no.x * R, a[1] + (b[1] - a[1]) * t + no.y * R, a[2] + (b[2] - a[2]) * t + no.z * R, R * 0.95, R * 0.55, r() * 6, FACE, pioche(pal, r, 0.03), [no.x, no.y + 0.3, no.z]); }
}
function poing(T, x, y, z, R, r) { for (let i = 0; i < 60; i++) { const u = r() * 2 - 1, f = r() * 6.28, s = Math.sqrt(1 - u * u); T.touche(x + Math.cos(f) * s * R, y + u * R * 0.8, z + Math.sin(f) * s * R * 1.2, R * 0.62, R * 0.36, r() * 6, FACE, pioche(PEAU, r, 0.03), [Math.cos(f) * s, u + 0.3, Math.sin(f) * s]); } }

export function creerMains(camera, scene) {
  const r = hasard(1840), rig = new THREE.Group(), canne = new THREE.Group(), gauche = new THREE.Group(), manivelle = new THREE.Group(); camera.add(rig); rig.add(canne, gauche); canne.add(manivelle);
  const base = matiereTouches(), matCanne = matiereTouches();
  { // la main droite et son bras, solidaires de la canne
    const T = new Toile(50); membre(T, [0.1, -0.34, 0.62], [0.01, -0.07, 0.1], 0.062, 0.04, LIN, r, 150); membre(T, [0.01, -0.07, 0.1], [0, -0.03, 0.02], 0.038, 0.034, PEAU, r, 40); poing(T, 0, -0.012, 0, 0.05, r);
    for (let i = 0; i < 40; i++) { const a = r() * 6.28; T.touche(Math.cos(a) * 0.016, -0.005 + Math.sin(a) * 0.016, -0.1 - r() * 0.04 + 0.2, 0.03, 0.016, 0, FACE, pioche(['#7a5a3c', '#5f4630'], r), [Math.cos(a), Math.sin(a), 0]); }
    for (let i = 0; i < 70; i++) { const a = r() * 6.28, R = 0.03 + r() * 0.012, z = -0.13 + r() * 0.05; T.touche(Math.cos(a) * R, -0.062 + Math.sin(a) * R, z, 0.03, 0.016, a, FACE, pioche(LAITON, r), [Math.cos(a), Math.sin(a), 0]); } // le moulinet
    T.poser(canne, base, 2);
    const M = new Toile(50); for (let i = 0; i < 16; i++) M.touche((i / 15) * 0.055, 0, 0, 0.02, 0.012, 0, FACE, pioche(LAITON, r), [0, 1, 0]); poing(M, 0.062, 0, 0, 0.016, r); M.poser(manivelle, base, 2); manivelle.position.set(0.04, -0.062, -0.1);
    const B = new Toile(50); // le bambou : des touches le long du scion, de plus en plus fines
    for (let i = 0; i < 340; i++) { const t = i / 339, w = 0.014 - t * 0.0105, noeud = Math.sin(t * 42) > 0.93; B.touche(0, 0, -t * LONG, 0.03, w, Math.atan2(0.6, 1), CANNE, melange(pioche(BAMBOU, r, 0.03), couleur('#5f4630'), noeud ? 0.7 : 0), [0, 1, 0.2], t); }
    B.poser(canne, matCanne, 2);
    const G = new Toile(50); membre(G, [-0.42, -0.55, 0.42], [-0.14, -0.2, 0.08], 0.062, 0.04, LIN, r, 150); membre(G, [-0.14, -0.2, 0.08], [-0.06, -0.13, -0.02], 0.038, 0.033, PEAU, r, 40); poing(G, -0.05, -0.12, -0.03, 0.044, r); G.poser(gauche, base, 2);
  }
  rig.position.set(0.36, -0.36, -0.5); canne.rotation.order = 'YXZ';
  // la ligne et le leurre sont dans le monde
  const NL = 26, geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NL * 3), 3)), ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf2ecdc, transparent: true, opacity: 0.8 })); ligne.frustumCulled = false; ligne.layers.set(2); scene.add(ligne);
  const leurre = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).scale(0.7, 0.7, 1.7), new THREE.MeshBasicMaterial({ color: 0xffffff })); leurre.layers.set(2); scene.add(leurre);
  const cible = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.75, depthWrite: false })); cible.layers.set(2); cible.renderOrder = 8; scene.add(cible);

  let a = 0.34, y = -0.2, kick = 0, cr = 0, hide = 0; const pos = geo.attributes.position, tip = new THREE.Vector3(), tmp = new THREE.Vector3();
  return {
    rig, leurre, cible,
    secousse(k = 0.22) { kick = k; },
    // l'œil de la pose : la canne suit l'état de la pêche
    maj(dt, P, e, cachee) {
      const t = performance.now() / 1000; let cA = 0.34, cY = -0.2, bend = 0.04, bendX = 0, down = 0;
      if (P.etat === 'charge') { cA = 0.5 + P.puissance * 1.15; cY = -0.12; bend = -0.25 * P.puissance; }
      if (P.etat === 'vol') { cA = 0.28; bend = 0.3; }
      if (P.etat === 'eau') { cY = -0.06; cA = 0.36 + (e.moulinet ? Math.sin(t * 11) * 0.012 : 0); if (P.l.accroche) bend = 0.42; else bend = 0.08 + P.l.vit * 0.06; }
      if (P.etat === 'touche') { cA = 0.5 + Math.sin(t * 38) * 0.05; bend = 0.45 + Math.sin(t * 30) * 0.15; }
      if (P.etat === 'combat') { cA = 0.92 + P.tension * 0.3; cY = 0.1 + (e.lateral ?? 0) * 0.48; bend = 0.25 + P.tension * 1; bendX = (P.combat.cote ?? 0) * P.tension * 0.3; cA += Math.sin(t * 26) * P.tension * 0.02; }
      if (P.etat === 'epuisette') { cA = 1.2; bend = 0.3; }
      if (P.etat === 'prise' || cachee) down = 1;
      kick *= Math.exp(-dt * 11); a += (cA + kick - a) * Math.min(1, dt * (P.etat === 'vol' ? 16 : 7)); y += (cY - y) * Math.min(1, dt * 6); hide += (down - hide) * Math.min(1, dt * 6);
      canne.rotation.set(a, y, 0); rig.position.y = -0.36 - hide * 0.9;
      matCanne.uniforms.uCourbe.value += (bend - matCanne.uniforms.uCourbe.value) * Math.min(1, dt * 9); matCanne.uniforms.uCourbeX.value += (bendX - matCanne.uniforms.uCourbeX.value) * Math.min(1, dt * 9);
      if (e.moulinet && P.etat !== 'repos') cr += dt * (7 + P.vitesse * 5); manivelle.rotation.x = cr;
      gauche.position.set(0.04 + 0, Math.sin(cr) * 0.022 + (P.etat === 'repos' ? -0.1 : 0), Math.cos(cr) * 0.022); gauche.rotation.copy(canne.rotation); gauche.rotation.y = y * 0.4;
      // le bout de la canne, et la ligne jusqu'au leurre
      canne.updateWorldMatrix(true, false); tip.set(matCanne.uniforms.uCourbeX.value, -matCanne.uniforms.uCourbe.value, -LONG); canne.localToWorld(tip);
      const aLeau = ['vol', 'eau', 'touche', 'combat', 'epuisette'].includes(P.etat); ligne.visible = aLeau || P.etat === 'charge'; leurre.visible = ligne.visible;
      if (ligne.visible) {
        const L = aLeau ? tmp.set(P.l.x, P.l.y, P.l.z) : tmp.copy(tip).setY(tip.y - 0.35), d = tip.distanceTo(L), mou = (1 - P.tension) * d * 0.045 * (P.etat === 'vol' ? 0.2 : 1);
        for (let i = 0; i < NL; i++) { const s = i / (NL - 1), yy = tip.y + (Math.max(L.y, -0.03) - tip.y) * s - Math.sin(s * Math.PI) * mou; pos.setXYZ(i, tip.x + (L.x - tip.x) * s, Math.max(yy, aLeau ? 0.015 : -9), tip.z + (L.z - tip.z) * s); }
        pos.needsUpdate = true; leurre.position.copy(L); leurre.material.color.set(P.leurreChoisi.couleurs[0]);
      }
      return tip;
    },
  };
}
