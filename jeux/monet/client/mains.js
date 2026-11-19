// LES EAUX DE MONET — ce qu'on voit de soi : les mains et la manche de lin, peintes à la gouache comme le matériel, qui tiennent
// la canne ; la ligne qui descend jusqu'au leurre, lequel pend et se balance tant qu'il n'est pas à l'eau.
import * as THREE from 'three';
import { couleur, melange } from './peinture.js';
import { CANNES, LEURRES } from './reglages.js';
import { creerCanne, creerLeurre, Etabli } from './canne.js';

const PENDANT = 0.42, BAS = -0.14, PEAU = couleur('#e6bd98'), PEAU2 = couleur('#cf9c78'), LIN = couleur('#6f8fac'), LIN2 = couleur('#54708f'), REVERS = couleur('#a9bccb');
const Y = new THREE.Vector3(0, 1, 0), teinte = (a, b) => (x, y, z, f) => melange(a, b, Math.abs(Math.sin(f * 12.9898) * 43758.5453) % 1 * 0.55);

// un membre : un fuseau aux bouts arrondis, de a vers b
function membre(E, a, b, ra, rb, col, n = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
  E.pose(new THREE.CylinderGeometry(rb, ra, d.length(), n, 2, true), m, col); E.pose(new THREE.SphereGeometry(ra, n, 10), new THREE.Matrix4().setPosition(A), col); E.pose(new THREE.SphereGeometry(rb, n, 10), new THREE.Matrix4().setPosition(B), col);
}
// une forme pleine : un œuf orienté (centre, demi-axes, rotation)
const bloc = (E, p, s, r, col) => E.pose(new THREE.SphereGeometry(1, 20, 14), new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)), col);
const NACRE = couleur('#f1d2c0'), JOINT = couleur('#d99a80');
// un doigt : trois phalanges qui s'affinent, les jointures un peu plus rosées, et l'ongle sur la dernière
function doigt(E, p, ra, dehors) {
  const r = [ra, ra * 0.93, ra * 0.85, ra * 0.76], peau = teinte(PEAU, PEAU2);
  for (let i = 0; i < p.length - 1; i++) membre(E, p[i], p[i + 1], r[i], r[i + 1], peau);
  for (let i = 1; i < p.length - 1; i++) E.pose(new THREE.SphereGeometry(r[i] * 1.06, 12, 8), new THREE.Matrix4().setPosition(...p[i]), (x, y, z, f) => melange(JOINT, PEAU, 0.45 + (f % 3) * 0.1));
  const a = new THREE.Vector3(...p.at(-2)), b = new THREE.Vector3(...p.at(-1)), d = b.clone().sub(a).normalize(), o = new THREE.Vector3(...dehors).normalize(), c = b.clone().addScaledVector(d, -r[3] * 0.6).addScaledVector(o, r[3] * 0.72);
  E.pose(new THREE.SphereGeometry(1, 12, 8), new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(o.clone().cross(d).normalize(), o, d)), new THREE.Vector3(r[3] * 0.78, r[3] * 0.32, r[3] * 1.05)), NACRE);
}
const autour = (R, a, z) => [Math.cos(a) * R, Math.sin(a) * R, z];

export function creerMains(camera, scene) {
  const rig = new THREE.Group(), axe = new THREE.Group(), brasD = new THREE.Group(), gauche = new THREE.Group(); camera.add(rig); rig.add(axe, brasD, gauche); const peau = teinte(PEAU, PEAU2), lin = teinte(LIN, LIN2);
  const manche = (E, coude, poignet, s) => { membre(E, coude, poignet, 0.066, 0.042, lin); const q = new THREE.Vector3(...poignet).lerp(new THREE.Vector3(...coude), 0.12); for (let k = 0; k < 2; k++) membre(E, q.toArray(), new THREE.Vector3(...poignet).lerp(new THREE.Vector3(...coude), 0.02 + k * 0.05).toArray(), 0.047 - k * 0.002, 0.046, REVERS, 18); };
  { const E = new Etabli(); manche(E, [0.15, -0.46, 0.66], [0.058, -0.078, 0.118], 1); membre(E, [0.06, -0.08, 0.12], [0.034, -0.016, 0.008], 0.03, 0.024, peau); bloc(E, [0.04, -0.035, 0.05], [0.026, 0.022, 0.03], [0.3, 0, 0], peau); brasD.add(E.maille(1, 1)); }
  { const E = new Etabli(); // la main droite serre le liège : le dos de la main à droite, quatre doigts qui passent dessous, le pouce allongé dessus
    bloc(E, [0.03, 0.004, -0.04], [0.015, 0.027, 0.047], [0, 0, 0.35], peau); bloc(E, [0.022, 0.016, -0.012], [0.015, 0.013, 0.024], [0, 0, 0.6], peau);
    for (let k = 0; k < 4; k++) { const z = -0.077 + k * 0.0228, R = 0.0285 - k * 0.0006, ra = [0.0102, 0.0104, 0.0098, 0.0086][k], A = [0.55, -0.9, -2.0, -2.72].map(v => v + k * 0.06); E.pose(new THREE.SphereGeometry(ra * 0.95, 12, 8), new THREE.Matrix4().setPosition(...autour(R * 1.1, 0.62, z)), (x, y, zz, f) => melange(JOINT, PEAU, 0.5)); doigt(E, A.map((a, i) => autour(R - i * 0.0012, a, z + i * 0.0012 * (k - 1.5))), ra, [-1, 0.2, 0]); }
    doigt(E, [[0.024, 0.02, -0.004], [0.014, 0.028, -0.038], [0.006, 0.0305, -0.066], [0.002, 0.031, -0.086]], 0.0118, [0, 1, 0]); axe.add(E.maille(1, 1)); }
  { const E = new Etabli(); // la main gauche pince le bouton de la manivelle, entre le pouce et deux doigts ; les deux autres se replient
    manche(E, [-0.42, -0.46, 0.4], [-0.102, -0.092, 0.078], -1); membre(E, [-0.1, -0.09, 0.075], [-0.034, -0.032, 0.03], 0.03, 0.024, peau); bloc(E, [-0.014, -0.02, 0.022], [0.026, 0.017, 0.03], [0.5, 0.3, 0], peau);
    const rond = (x, R, a, c = [0, 0]) => [x, c[0] + Math.sin(a) * R, c[1] + Math.cos(a) * R];
    for (const [x, ra] of [[-0.004, 0.0088], [0.009, 0.0086]]) doigt(E, [0.75, 1.75, 2.7, 3.4].map(a => rond(x, 0.0165, a)), ra, [0, 1, 0]);
    for (const [x, ra] of [[0.02, 0.0082], [0.03, 0.0074]]) doigt(E, [0.9, 2.1, 3.2, 3.9].map(a => rond(x, 0.011, a, [-0.018, 0.016])), ra, [0, 0, -1]);
    doigt(E, [[-0.032, -0.012, 0.024], [-0.026, -0.002, 0.012], [-0.019, -0.005, 0.0], [-0.013, -0.009, -0.006]], 0.0098, [-1, 0, 0]); gauche.add(E.maille(1, 1)); }
  rig.position.set(0.24, BAS, -0.58); axe.rotation.order = 'YXZ';
  // une canne pour chaque modèle de la boîte
  const cannes = new Map(CANNES.map(c => { const o = creerCanne(c); o.groupe.visible = false; axe.add(o.groupe); return [c.id, o]; }));
  const leurres = new Map(LEURRES.map(l => { const m = creerLeurre(l); m.scale.setScalar(l.taille / 100 * 1.5); m.visible = false; scene.add(m); return [l.id, m]; }));
  // la ligne et le repère de lancer sont dans le monde
  const NL = 26, geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NL * 3), 3)), ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf2ecdc, transparent: true, opacity: 0.8 })); ligne.frustumCulled = false; ligne.layers.set(2); scene.add(ligne);
  const cible = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.75, depthWrite: false })); cible.layers.set(2); cible.renderOrder = 8; scene.add(cible);

  let ph = 0, tire = 0, a = 0.34, y = -0.24, kick = 0, cr = 0, hide = 0, c = 0, cv = 0, cx = 0, active = null, vu = null; const pos = geo.attributes.position, tip = new THREE.Vector3(), L = new THREE.Vector3(), pend = new THREE.Vector3(NaN), avant = new THREE.Vector3(), v = new THREE.Vector3();
  return {
    rig, cible, get leurre() { return vu; },
    secousse(k = 0.22) { kick = k; cv -= k * 7; tire = 1; },
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
      pos.needsUpdate = true;
      // la tête du leurre suit la ligne : vers le scion quand il pend, vers le pêcheur quand on le ramène
      const vers = aLeau ? v.set(tip.x, L.y, tip.z) : v.copy(tip), s = M.scale.x; M.position.copy(L).addScaledVector(L.clone().sub(vers).normalize(), 0.6 * s); M.lookAt(M.position.clone().multiplyScalar(2).sub(vers));
      // et il nage : la palette tourne, l'ondulante roule, le nageur frétille, la queue du souple bat
      const vit = P.etat === 'vol' ? 1.6 : aLeau ? Math.min(1.6, P.l.vit + tire * 1.2) : 0.05, U = M.userData; ph += dt * (3 + vit * 14); tire *= Math.exp(-dt * 4);
      if (U.lame) U.lame.rotation.z += dt * (1.2 + vit * 34);
      else if (U.id === 'ondulante') U.corps.rotation.z = Math.sin(ph * 1.3) * (0.15 + Math.min(1, vit) * 0.75);
      else if (U.famille === 'nageur') { U.corps.rotation.y = Math.sin(ph * 1.6) * (0.04 + Math.min(1, vit) * 0.22) + tire * Math.sin(ph * 0.7) * 0.5; U.corps.rotation.z = Math.sin(ph * 1.6 + 1) * Math.min(1, vit) * 0.18; }
      if (U.queue) { U.queue.rotation.y = Math.sin(ph * 2.2) * (0.15 + Math.min(1, vit + tire) * 0.85); U.corps.rotation.y = Math.sin(ph * 1.1) * 0.08 * Math.min(1, vit + tire); }
      return tip;
    },
  };
}
