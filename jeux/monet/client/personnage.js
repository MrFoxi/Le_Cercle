// LES EAUX DE MONET — la silhouette du père Anselme : blouse bleue, chapeau de paille, barbe blanche, son râteau à la main.
// Peint à la gouache comme le matériel ; il ratisse la berge, se tourne vers toi quand tu approches.
import * as THREE from 'three';
import { Etabli } from './canne.js';
import { couleur, melange } from './peinture.js';
import { hauteur, OBSTACLES } from './etang.js';
import { ETANG } from './reglages.js';

const C = h => couleur(h), BLOUSE = C('#4f6f9c'), BLOUSE2 = C('#3f5a84'), PANTALON = C('#6b5a48'), PEAU = C('#dba98a'), BARBE = C('#eeeae0'), PAILLE = C('#d9bf78'), PAILLE2 = C('#b89a58'), RUBAN = C('#3a3430'), BOIS = C('#8a6a48'), CUIR = C('#4a3428');
const Y = new THREE.Vector3(0, 1, 0), M = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
const plis = (a, b) => (x, y, z, f) => melange(a, b, Math.abs(Math.sin(f * 7.31)) * 0.6);
function baton(E, a, b, r, col) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); E.pose(new THREE.CylinderGeometry(r, r, d.length(), 8), new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), new THREE.Vector3(1, 1, 1)), col); }

// un coin de berge sèche près d'un poste, à l'écart des arbres
export function endroit(id) {
  const p = id === 'camp' ? { x: ETANG.camp.x + 3, z: ETANG.camp.z + 2 } : ETANG.secteurs.find(s => s.id === id);
  for (let d = 3; d < 14; d += 1) for (let a = 0; a < 6.28; a += 0.4) { const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (hauteur(x, z) > 0.2 && OBSTACLES.every(([ox, oz, r]) => Math.hypot(x - ox, z - oz) > r + 0.8)) return [x, z]; }
  return [p.x, p.z];
}

export function creerJardinier(scene) {
  const groupe = new THREE.Group(), corps = new THREE.Group(), bras = new THREE.Group(), tete = new THREE.Group(); groupe.add(corps); corps.add(bras, tete);
  { const E = new Etabli(); // jambes, blouse, bras gauche
    for (const s of [-1, 1]) { baton(E, [s * 0.1, 0.08, 0], [s * 0.11, 0.78, 0], 0.07, PANTALON); E.pose(new THREE.BoxGeometry(0.12, 0.08, 0.24), M(s * 0.1, 0.04, 0.04), CUIR); }
    E.pose(new THREE.CylinderGeometry(0.2, 0.31, 0.74, 12), M(0, 1.06, 0), plis(BLOUSE, BLOUSE2)); E.pose(new THREE.SphereGeometry(1, 12, 8), M(0, 1.4, 0, 0.24, 0.1, 0.17), plis(BLOUSE, BLOUSE2));
    baton(E, [-0.22, 1.38, 0], [-0.3, 1.08, 0.04], 0.055, plis(BLOUSE, BLOUSE2)); baton(E, [-0.3, 1.08, 0.04], [-0.27, 0.86, 0.1], 0.048, plis(BLOUSE, BLOUSE2)); E.pose(new THREE.SphereGeometry(0.045, 8, 6), M(-0.27, 0.82, 0.11), PEAU);
    corps.add(E.maille(1)); }
  { const E = new Etabli(); // la tête : barbe, moustache, chapeau de paille
    E.pose(new THREE.SphereGeometry(0.105, 12, 9), M(0, 0, 0, 1, 1.1, 1), PEAU); E.pose(new THREE.SphereGeometry(0.025, 6, 5), M(0, 0, 0.105), C('#c98f72'));
    E.pose(new THREE.SphereGeometry(1, 10, 8), M(0, -0.07, 0.05, 0.09, 0.11, 0.07), BARBE); E.pose(new THREE.SphereGeometry(1, 8, 6), M(0, -0.025, 0.1, 0.05, 0.016, 0.02), BARBE);
    for (const s of [-1, 1]) E.pose(new THREE.SphereGeometry(0.012, 6, 4), M(s * 0.04, 0.02, 0.095), C('#2a2420'));
    E.pose(new THREE.CylinderGeometry(0.28, 0.28, 0.015, 24), M(0, 0.08, 0), (x, y, z, f) => melange(PAILLE, PAILLE2, (f % 5) / 6)); E.pose(new THREE.CylinderGeometry(0.115, 0.125, 0.11, 16), M(0, 0.14, 0), PAILLE); E.pose(new THREE.CylinderGeometry(0.127, 0.127, 0.03, 16), M(0, 0.1, 0), RUBAN);
    tete.add(E.maille(1)); tete.position.set(0, 1.58, 0); }
  { const E = new Etabli(); // le bras droit et le râteau, qui ratissent ensemble
    baton(E, [0, 0, 0], [0.08, -0.3, 0.1], 0.055, plis(BLOUSE, BLOUSE2)); baton(E, [0.08, -0.3, 0.1], [0.05, -0.48, 0.24], 0.048, plis(BLOUSE, BLOUSE2)); E.pose(new THREE.SphereGeometry(0.045, 8, 6), M(0.05, -0.5, 0.26), PEAU);
    baton(E, [0.05, -0.1, 0.0], [0.05, -1.3, 0.95], 0.016, BOIS); baton(E, [-0.2, -1.34, 0.98], [0.3, -1.34, 0.98], 0.02, BOIS); for (let i = 0; i < 9; i++) baton(E, [-0.18 + i * 0.045, -1.34, 0.98], [-0.18 + i * 0.045, -1.42, 1.0], 0.006, C('#5a5048'));
    bras.add(E.maille(1)); bras.position.set(0.22, 1.38, 0); }
  groupe.traverse(o => o.layers?.set(0)); scene.add(groupe);
  let cap = 0, t = 0;
  return {
    groupe,
    poser(x, z) { groupe.position.set(x, hauteur(x, z), z); },
    // regarde : le promeneur s'approche-t-il ? parle : une conversation est en cours
    maj(dt, J, parle) {
      t += dt; const dx = J.x - groupe.position.x, dz = J.z - groupe.position.z, d = Math.hypot(dx, dz), vers = Math.atan2(dx, dz), proche = d < 9 || parle;
      const voulu = proche ? vers : Math.sin(t * 0.07) * 1.4 + 0.6; let dc = Math.atan2(Math.sin(voulu - cap), Math.cos(voulu - cap)); cap += dc * Math.min(1, dt * 2.2); groupe.rotation.y = cap;
      bras.rotation.x = proche ? bras.rotation.x * (1 - Math.min(1, dt * 4)) : Math.sin(t * 1.6) * 0.32 - 0.05; corps.position.y = Math.sin(t * 1.3) * 0.006 + (proche ? 0 : Math.max(0, Math.sin(t * 1.6)) * 0.012);
      tete.rotation.x = parle ? Math.sin(t * 5.5) * 0.06 : proche ? -0.08 : 0.15; return d;
    },
  };
}
