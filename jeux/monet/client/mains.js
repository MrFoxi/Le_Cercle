// LES EAUX DE MONET — ce qu'on voit de soi : les mains et la manche de lin, peintes à la gouache comme le matériel, qui tiennent
// la canne ; la ligne qui descend jusqu'au leurre, lequel pend et se balance tant qu'il n'est pas à l'eau.
import * as THREE from 'three';
import { couleur, melange } from './peinture.js';
import { CANNES, LEURRES } from './reglages.js';
import { creerCanne, creerLeurre, Etabli } from './canne.js';

const PENDANT = 0.42, BAS = -0.14, PEAU = couleur('#e6bd98'), PEAU2 = couleur('#cf9c78'), LIN = couleur('#6f8fac'), LIN2 = couleur('#54708f'), REVERS = couleur('#a9bccb');
const Y = new THREE.Vector3(0, 1, 0), teinte = (a, b) => (x, y, z, f) => melange(a, b, Math.abs(Math.sin(f * 12.9898) * 43758.5453) % 1 * 0.55);

// un membre : un fuseau aux bouts arrondis, de a vers b
function membre(E, a, b, ra, rb, col) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
  E.pose(new THREE.CylinderGeometry(rb, ra, d.length(), 10, 1, true), m, col); E.pose(new THREE.SphereGeometry(ra, 10, 7), new THREE.Matrix4().setPosition(A), col); E.pose(new THREE.SphereGeometry(rb, 10, 7), new THREE.Matrix4().setPosition(B), col);
}
const bloc = (E, x, y, z, sx, sy, sz, col) => E.pose(new THREE.SphereGeometry(1, 14, 10), new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)), col);
// un doigt qui s'enroule autour d'un axe, phalange après phalange
function doigt(E, p, ra) { for (let i = 0; i < p.length - 1; i++) membre(E, p[i], p[i + 1], ra * (1 - i * 0.07), ra * (1 - (i + 1) * 0.07), teinte(PEAU, PEAU2)); }

export function creerMains(camera, scene) {
  const rig = new THREE.Group(), axe = new THREE.Group(), brasD = new THREE.Group(), gauche = new THREE.Group(); camera.add(rig); rig.add(axe, brasD, gauche); const peau = teinte(PEAU, PEAU2), lin = teinte(LIN, LIN2);
  { const E = new Etabli(); membre(E, [0.15, -0.46, 0.66], [0.056, -0.075, 0.115], 0.066, 0.04, lin); membre(E, [0.06, -0.09, 0.135], [0.054, -0.07, 0.108], 0.043, 0.043, REVERS); membre(E, [0.054, -0.07, 0.108], [0.03, -0.012, 0.0], 0.03, 0.025, peau); brasD.add(E.maille(1)); }
  { const E = new Etabli(); bloc(E, 0.027, -0.004, -0.04, 0.024, 0.031, 0.05, peau); // la paume, et quatre doigts refermés sur le liège
    for (let k = 0; k < 4; k++) { const z = -0.075 + k * 0.0235, R = 0.0285, p = []; for (let i = 0; i < 4; i++) { const a = 0.15 - i * 1.05; p.push([Math.cos(a) * R, Math.sin(a) * R, z]); } doigt(E, p, 0.0108 - k * 0.0007); }
    doigt(E, [[0.026, 0.018, -0.008], [0.014, 0.0285, -0.05], [0.004, 0.029, -0.09]], 0.0115); axe.add(E.maille(1)); }
  { const E = new Etabli(); membre(E, [-0.42, -0.46, 0.4], [-0.1, -0.09, 0.075], 0.066, 0.04, lin); membre(E, [-0.122, -0.115, 0.095], [-0.096, -0.085, 0.07], 0.043, 0.043, REVERS); membre(E, [-0.096, -0.085, 0.07], [-0.03, -0.03, 0.02], 0.03, 0.025, peau); bloc(E, -0.022, -0.022, 0.014, 0.03, 0.026, 0.03, peau);
    for (let k = 0; k < 4; k++) { const x = -0.021 + k * 0.0135, R = 0.016, p = []; for (let i = 0; i < 4; i++) { const a = 2.5 - i * 1.25; p.push([x, Math.sin(a) * R, Math.cos(a) * R]); } doigt(E, p, 0.0078); }
    doigt(E, [[-0.03, 0.006, 0.02], [-0.014, 0.019, 0.006], [0.006, 0.019, -0.002]], 0.0088); gauche.add(E.maille(1)); }
  rig.position.set(0.24, BAS, -0.58); axe.rotation.order = 'YXZ';
  // une canne pour chaque modèle de la boîte
  const cannes = new Map(CANNES.map(c => { const o = creerCanne(c); o.groupe.visible = false; axe.add(o.groupe); return [c.id, o]; }));
  const leurres = new Map(LEURRES.map(l => { const m = creerLeurre(l); m.scale.setScalar(l.taille / 100 * 1.5); m.visible = false; scene.add(m); return [l.id, m]; }));
  // la ligne et le repère de lancer sont dans le monde
  const NL = 26, geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NL * 3), 3)), ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf2ecdc, transparent: true, opacity: 0.8 })); ligne.frustumCulled = false; ligne.layers.set(2); scene.add(ligne);
  const cible = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.75, depthWrite: false })); cible.layers.set(2); cible.renderOrder = 8; scene.add(cible);

  let a = 0.34, y = -0.24, kick = 0, cr = 0, hide = 0, c = 0, cv = 0, cx = 0, active = null, vu = null; const pos = geo.attributes.position, tip = new THREE.Vector3(), L = new THREE.Vector3(), pend = new THREE.Vector3(NaN), avant = new THREE.Vector3(), v = new THREE.Vector3();
  return {
    rig, cible,
    secousse(k = 0.22) { kick = k; cv -= k * 7; },
    // la pose suit l'état de la pêche ; cachee === 'net' : rien de soi à l'image, tout de suite (le chevalet peint la vue)
    maj(dt, P, e, cachee) {
      rig.visible = cachee !== 'net'; if (!rig.visible) { ligne.visible = false; if (vu) vu.visible = false; return tip; }
      const t = performance.now() / 1000, h = Math.min(dt, 0.033); let cA = 0.34, cY = -0.24, bend = 0.03, bendX = 0, down = 0;
      if (P.etat === 'charge') { cA = 0.5 + P.puissance * 1.15; cY = -0.14; bend = -0.25 * P.puissance; }
      if (P.etat === 'vol') { cA = 0.28; bend = 0.2; }
      if (P.etat === 'eau') { cY = -0.1; cA = 0.36 + (e.moulinet ? Math.sin(t * 11) * 0.012 : 0); bend = P.l.accroche ? 0.42 : 0.07 + P.l.vit * 0.06; }
      if (P.etat === 'touche') { cA = 0.5 + Math.sin(t * 38) * 0.05; bend = 0.45 + Math.sin(t * 30) * 0.15; }
      if (P.etat === 'combat') { cA = 0.92 + P.tension * 0.3; cY = 0.08 + (e.lateral ?? 0) * 0.48; bend = 0.25 + P.tension; bendX = (P.combat.cote ?? 0) * P.tension * 0.3; cA += Math.sin(t * 26) * P.tension * 0.02; }
      if (P.etat === 'epuisette') { cA = 1.2; bend = 0.3; }
      if (P.etat === 'prise' || cachee) down = 1;
      kick *= Math.exp(-dt * 11); a += (cA + kick - a) * Math.min(1, dt * (P.etat === 'vol' ? 16 : 7)); y += (cY - y) * Math.min(1, dt * 6); hide += (down - hide) * Math.min(1, dt * 6);
      axe.rotation.set(a, y, 0); rig.position.y = BAS - hide * 0.9;
      // le scion est un ressort : il vibre après chaque geste, plus ou moins selon la canne
      const raide = P.canne.allure.raideur; cv += (240 * raide * (bend / raide - c) - 10 * cv) * h; c += cv * h; cx += (bendX - cx) * Math.min(1, dt * 9);
      if (e.moulinet && P.etat !== 'repos') cr += dt * (7 + P.vitesse * 5);
      const C = cannes.get(P.canne.id); if (C !== active) { if (active) active.groupe.visible = false; C.groupe.visible = true; active = C; pend.set(NaN, 0, 0); }
      C.plier(c, cx, cr, tip); rig.updateWorldMatrix(true, true); C.groupe.localToWorld(tip);
      // la main gauche tient la manivelle
      C.bobine.updateWorldMatrix(true, false); rig.worldToLocal(C.bobine.localToWorld(v.copy(C.poignee))); gauche.position.copy(v);
      // le leurre : au bout de la ligne, il pend et se balance ; à l'eau, il suit la pêche
      const aLeau = ['vol', 'eau', 'touche', 'combat', 'epuisette'].includes(P.etat), montre = !cachee && P.etat !== 'prise', M = leurres.get(P.leurreChoisi.id); if (vu !== M) { if (vu) vu.visible = false; vu = M; }
      ligne.visible = M.visible = montre;
      if (!montre) return tip;
      if (aLeau) { L.set(P.l.x, P.l.y, P.l.z); pend.set(NaN, 0, 0); }
      else {
        if (Number.isNaN(pend.x)) { pend.copy(tip).setY(tip.y - PENDANT); avant.copy(pend); }
        v.copy(pend); pend.addScaledVector(v.clone().sub(avant), 0.985); pend.y -= 9.8 * h * h; avant.copy(v);
        v.subVectors(pend, tip).setLength(PENDANT); pend.copy(tip).add(v); L.copy(pend);
      }
      const d = tip.distanceTo(L), mou = aLeau ? (1 - P.tension) * d * 0.045 * (P.etat === 'vol' ? 0.2 : 1) : 0;
      for (let i = 0; i < NL; i++) { const s = i / (NL - 1), yy = tip.y + (Math.max(L.y, aLeau ? -0.03 : L.y) - tip.y) * s - Math.sin(s * Math.PI) * mou; pos.setXYZ(i, tip.x + (L.x - tip.x) * s, Math.max(yy, aLeau ? 0.015 : -9), tip.z + (L.z - tip.z) * s); }
      pos.needsUpdate = true; M.position.copy(L); M.lookAt(tip);
      return tip;
    },
  };
}
