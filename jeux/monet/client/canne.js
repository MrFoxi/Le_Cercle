// LES EAUX DE MONET — le matériel du pêcheur de 1900 : canne de bambou refendu (six lamelles), poignée de liège, ligatures de soie,
// anneaux de laiton, moulinet de noyer, et les leurres. De vrais objets, éclairés comme le tableau : à la gouache, par aplats.
import * as THREE from 'three';
import { UNI, couleur, melange } from './peinture.js';

const VERT = /* glsl */ `
attribute vec3 aCol; attribute float aT; uniform float uC, uCX, uL, uDensite; varying vec3 vCol, vN, vV, vP; varying float vFog;
void main() {
  vec3 p = position; float t = aT; p.y -= uC * t * t; p.x += uCX * t * t; p.z += (uC * uC + uCX * uCX) * 2. / (3. * uL) * t * t * t; // la canne plie sans s'allonger
  vec4 w = modelMatrix * vec4(p, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; vP = position; vCol = aCol; vFog = 1. - exp(-length(vV) * uDensite);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
uniform vec3 uDirSoleil, uSoleil, uOmbre, uBrume; uniform float uForce, uDoux; varying vec3 vCol, vN, vV, vP; varying float vFog;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 N = normalize(vN), V = normalize(vV); float a = atan(vP.y, vP.x), s = h(floor(vec2(vP.z * 46., a * 3.))), poil = h(floor(vec2(vP.z * 14., a * 9.)));
  float bandes = mix(4., 9., uDoux), e = dot(N, uDirSoleil) * .5 + .5 + (s - .5) * .16 * (1. - uDoux * .6); e = floor(e * bandes + .5) / bandes; // des aplats de lumière, posés au pinceau
  vec3 ombre = mix(uOmbre * .78, uOmbre * vec3(1.18, .82, .78) * .9, uDoux); // la peau garde du sang dans ses ombres
  vec3 c = vCol * mix(ombre, uSoleil * 1.04, smoothstep(.25, .8, e)) * uForce * (.86 + poil * .26 * (1. - uDoux * .7)) + vCol * uOmbre * .12;
  c = mix(c, c * vec3(.5, .34, .32), pow(1. - abs(dot(N, V)), 2.5) * (.75 - uDoux * .35)); // le bord foncé qui détache l'objet du paysage
  c += uSoleil * pow(max(dot(N, normalize(uDirSoleil + V)), 0.), 26.) * .35 * uForce * step(.35, s);
  gl_FragColor = vec4(mix(c, uBrume, vFog), 1.);
}`;
const matiere = L => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uDirSoleil: UNI.uDirSoleil, uSoleil: UNI.uSoleil, uOmbre: UNI.uOmbre, uForce: UNI.uForce, uBrume: UNI.uBrume, uDensite: UNI.uDensite, uC: { value: 0 }, uCX: { value: 0 }, uL: { value: L }, uDoux: { value: 0 } } });

// l'établi : on y assemble des pièces, chacune avec sa couleur et sa place le long de la canne (aT : 0 au talon, 1 au scion)
export class Etabli {
  constructor(tDe = () => 0) { this.tDe = tDe; this.p = []; this.n = []; this.c = []; this.t = []; }
  pose(geo, m, col, t) {
    const g = geo.index ? geo.toNonIndexed() : geo; if (m) g.applyMatrix4(m); const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); this.p.push(x, y, z); this.n.push(N.getX(i), N.getY(i), N.getZ(i)); this.c.push(...(typeof col === 'function' ? col(x, y, z, Math.floor(i / 3)) : col)); this.t.push(t ?? this.tDe(z)); }
  }
  // un tronçon rond (ou à facettes) le long de l'axe de la canne
  tube(z1, z2, r1, r2, n, col, { plat = false, ferme = false, x = 0, y = 0 } = {}) {
    const [zh, rh, zb, rb] = z1 > z2 ? [z1, r1, z2, r2] : [z2, r2, z1, r1]; let g = new THREE.CylinderGeometry(rh, rb, zh - zb, n, 1, !ferme).toNonIndexed(); if (plat) g.computeVertexNormals();
    this.pose(g, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y, (zh + zb) / 2), col);
  }
  maille(L, doux = 0) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(this.t, 1));
    const m = new THREE.Mesh(g, matiere(L)); m.material.uniforms.uDoux.value = doux; m.layers.set(2); m.frustumCulled = false; return m;
  }
}
const graine = (a, b) => { const s = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return s - Math.floor(s); };
const LAITON = couleur('#c79a48'), LAITON2 = couleur('#8f6a2c'), NOYER = couleur('#5c3820'), NOYER2 = couleur('#3f2616'), IVOIRE = couleur('#ece0c4'), LIN = couleur('#e9e1cc'), LIEGE = [couleur('#c79f6c'), couleur('#a97f50'), couleur('#dcb988'), couleur('#7c5a38')];
const DEPART = 0.17; // le bambou sort de la poignée ici

export function creerCanne(cfg) {
  const { long: L, rayon: R, moulinet: RM } = cfg.allure, A = cfg.allure, tDe = z => Math.max(0, Math.min(1, (-z - DEPART) / (L - DEPART))), rayon = t => R * (1 - t * 0.76);
  const E = new Etabli(tDe), clair = couleur(A.bambou[0]), fonce = couleur(A.bambou[1]), soie = couleur(A.soie);
  // le bambou : six lamelles collées, chacune de son ton
  for (let i = 0, N = Math.ceil((L - DEPART) / 0.05); i < N; i++) { const z1 = -DEPART - (L - DEPART) * i / N, z2 = -DEPART - (L - DEPART) * (i + 1) / N; E.tube(z1, z2, rayon(tDe(z1)), rayon(tDe(z2)), 6, (x, y, z, f) => melange(clair, fonce, graine(Math.floor(f / 2) % 6, 3) * 0.75), { plat: true }); }
  for (let z = -DEPART - 0.16; z > -L + 0.06; z -= 0.31) { const r = rayon(tDe(z)); E.tube(z + 0.006, z - 0.006, r * 1.2, r * 1.2, 6, melange(fonce, NOYER2, 0.6), { plat: true }); } // les nœuds
  const ligature = (z, l = 0.02) => { const r = rayon(tDe(z)) * 1.2; E.tube(z + l / 2, z - l / 2, r, r, 8, (x, y, zz) => (Math.floor(zz * 500) % 3 ? soie : melange(soie, LIN, 0.5))); };
  // la virole de laiton, au milieu
  const zv = -L * 0.52, rv = rayon(tDe(zv)); E.tube(zv + 0.045, zv - 0.045, rv * 1.5, rv * 1.5, 12, LAITON); E.tube(zv + 0.05, zv + 0.04, rv * 1.75, rv * 1.75, 12, LAITON2); E.tube(zv - 0.04, zv - 0.05, rv * 1.75, rv * 1.75, 12, LAITON2); ligature(zv + 0.07, 0.035); ligature(zv - 0.07, 0.035);
  // les anneaux, où passe la ligne
  const anneaux = [];
  for (let i = 0; i < A.anneaux; i++) {
    const t = 0.2 + 0.74 * (i / (A.anneaux - 1)) ** 1.15, z = -DEPART - t * (L - DEPART), g = 0.019 + (0.0062 - 0.019) * t, r = rayon(t), y = -(r + g + 0.006);
    E.pose(new THREE.TorusGeometry(g, 0.0017, 6, 16), new THREE.Matrix4().makeTranslation(0, y, z), LAITON, t);
    E.pose(new THREE.CylinderGeometry(0.0016, 0.0022, 0.009, 5), new THREE.Matrix4().makeTranslation(0, -(r + 0.004), z), LAITON2, t);
    ligature(z + 0.018); ligature(z - 0.018); anneaux.push({ y, z, t });
  }
  E.pose(new THREE.TorusGeometry(0.0055, 0.0015, 6, 14), new THREE.Matrix4().makeTranslation(0, -0.0075, -L), LAITON, 1); ligature(-L + 0.015, 0.03); anneaux.push({ y: -0.0075, z: -L, t: 1 });
  // la poignée de liège, bague après bague
  const rP = z => 0.0155 + 0.0045 * Math.sin(Math.PI * Math.max(0, Math.min(1, (z + DEPART) / 0.2)));
  for (let i = 0; i < 16; i++) { const z1 = -DEPART + i * 0.0125, z2 = z1 + 0.0125, bague = LIEGE[Math.floor(graine(i, 7) * 3)]; E.tube(z1, z2, rP(z1), rP(z2), 14, (x, y, z, f) => (graine(f, i) > 0.82 ? LIEGE[3] : melange(bague, LIEGE[2], graine(f, i + 3) * 0.3))); }
  E.tube(-DEPART + 0.008, -DEPART - 0.02, 0.0165, rayon(0) * 1.3, 12, soie); // la pointe de la poignée, ligaturée
  // le porte-moulinet de noyer, les bagues et le talon de laiton
  E.tube(0.03, 0.16, 0.0158, 0.0158, 14, NOYER); E.tube(0.038, 0.024, 0.018, 0.018, 14, LAITON); E.tube(0.166, 0.152, 0.018, 0.018, 14, LAITON); E.tube(0.166, 0.195, 0.019, 0.017, 14, LAITON2, { ferme: true });
  // le moulinet : le pied et le bâti, fixes
  const zM = 0.095, cy = -(0.03 + RM), l = RM * 0.72, axe = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  E.pose(new THREE.BoxGeometry(0.018, 0.005, 0.075), new THREE.Matrix4().makeTranslation(0, -0.0178, zM), LAITON); E.pose(new THREE.BoxGeometry(0.012, 0.016 + RM * 0.3, 0.02), new THREE.Matrix4().makeTranslation(l / 2 + 0.002, -0.024 - RM * 0.15, zM), LAITON2);
  E.pose(new THREE.CylinderGeometry(RM * 1.03, RM * 1.03, 0.005, 28), axe.clone().setPosition(l / 2 + 0.003, cy, zM), NOYER2); E.pose(new THREE.TorusGeometry(RM * 1.03, 0.0022, 6, 30).rotateY(Math.PI / 2), new THREE.Matrix4().makeTranslation(l / 2 + 0.005, cy, zM), LAITON);
  const groupe = new THREE.Group(), maille = E.maille(L); groupe.add(maille);
  // la bobine qui tourne, avec sa manivelle
  const B = new Etabli(), disque = (x, r, e, c) => B.pose(new THREE.CylinderGeometry(r, r, e, 30), axe.clone().setPosition(x, 0, 0), c);
  disque(-l / 2, RM, 0.006, (x, y, z, f) => melange(NOYER, NOYER2, graine(Math.floor(Math.atan2(z, y) * 5), 2) * 0.7)); disque(l / 2 - 0.002, RM * 0.98, 0.004, NOYER2); disque(0, RM * 0.56, l, LAITON2);
  disque(0, RM * 0.8, l * 0.86, (x, y, z) => (Math.floor(x * 900) % 2 ? LIN : melange(LIN, couleur('#b9ad90'), 0.5))); // la ligne enroulée
  B.pose(new THREE.TorusGeometry(RM, 0.0026, 6, 30).rotateY(Math.PI / 2), new THREE.Matrix4().makeTranslation(-l / 2 - 0.003, 0, 0), LAITON);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; B.pose(new THREE.SphereGeometry(0.0034, 6, 5), new THREE.Matrix4().makeTranslation(-l / 2 - 0.0035, Math.cos(a) * RM * 0.62, Math.sin(a) * RM * 0.62), LAITON); }
  const rK = RM * 0.76, xK = -l / 2 - 0.009;
  B.pose(new THREE.BoxGeometry(0.004, rK + 0.012, 0.011), new THREE.Matrix4().makeTranslation(xK + 0.003, rK / 2, 0), LAITON); B.pose(new THREE.CylinderGeometry(0.009, 0.009, 0.005, 12), axe.clone().setPosition(xK + 0.003, 0, 0), LAITON2);
  B.pose(new THREE.CylinderGeometry(0.0068, 0.0058, 0.03, 12), axe.clone().setPosition(xK - 0.014, rK, 0), IVOIRE); B.pose(new THREE.SphereGeometry(0.0062, 8, 6), new THREE.Matrix4().makeTranslation(xK - 0.029, rK, 0), LAITON);
  const bobine = B.maille(L); bobine.position.set(0, cy, zM); groupe.add(bobine);
  // la ligne, du moulinet au bout de la canne, d'anneau en anneau
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((anneaux.length + 1) * 3), 3)), fil = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf2ecdc, transparent: true, opacity: 0.75 })); fil.frustumCulled = false; fil.layers.set(2); groupe.add(fil);
  const U = maille.material.uniforms, plie = (v, y, z, t) => v.set(U.uCX.value * t * t, y - U.uC.value * t * t, z + (U.uC.value ** 2 + U.uCX.value ** 2) * 2 / (3 * L) * t ** 3);
  const v = new THREE.Vector3();
  return {
    groupe, bobine, L, poignee: new THREE.Vector3(xK - 0.02, rK, 0),
    // plier la canne et y faire courir la ligne ; rend le bout du scion, dans le repère de la canne
    plier(c, cx, tourne, pointe) {
      U.uC.value = c; U.uCX.value = cx; bobine.rotation.x = tourne; const P = geo.attributes.position; P.setXYZ(0, 0, cy + RM * 0.8, zM);
      anneaux.forEach((a, i) => { plie(v, a.y, a.z, a.t); P.setXYZ(i + 1, v.x, v.y, v.z); }); P.needsUpdate = true; return pointe.copy(v);
    },
  };
}

// les leurres, longueur 1, la tête vers -z (là où la ligne s'attache) ; mis à l'échelle et animés par mains.js.
// userData : la palette qui tourne (cuiller), le corps qui ondule (ondulante, nageur), la queue qui bat (souple)
export function creerLeurre(l) {
  const [a, b] = l.couleurs.map(couleur), M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(sx, sy, sz)), ACIER = couleur('#6a6c72'), PLOMB = couleur('#8c8e94'), ROUGE = couleur('#b8423a');
  const groupe = new THREE.Group(), corps = new THREE.Group(), E = new Etabli(); groupe.add(corps); groupe.userData = { famille: l.famille, id: l.id, corps };
  const hamecon = (E, z, y = -0.07) => { E.pose(new THREE.TorusGeometry(0.075, 0.012, 5, 10, 4.2), M(0, y, z), ACIER); E.pose(new THREE.TorusGeometry(0.075, 0.012, 5, 10, 4.2).rotateY(2.1), M(0, y, z), ACIER); E.pose(new THREE.TorusGeometry(0.075, 0.012, 5, 10, 4.2).rotateY(-2.1), M(0, y, z), ACIER); };
  const anneau = (E, z) => E.pose(new THREE.TorusGeometry(0.05, 0.012, 5, 10).rotateY(Math.PI / 2), M(0, 0, z), ACIER);
  const oeil = (E, z, y, ecart) => { for (const s of [-1, 1]) { E.pose(new THREE.SphereGeometry(0.036, 8, 6), M(s * ecart, y, z), IVOIRE); E.pose(new THREE.SphereGeometry(0.02, 6, 4), M(s * (ecart + 0.022), y, z), NOYER2); } };
  if (l.id === 'cuiller') {
    // la cuiller tournante : un axe d'acier, un corps de perles, et la palette montée sur son étrier, qui tourne autour de l'axe
    E.tube(0.5, -0.68, 0.012, 0.012, 6, ACIER); anneau(E, -0.7); for (let i = 0; i < 4; i++) E.pose(new THREE.SphereGeometry(0.06 - i * 0.004, 10, 8), M(0, 0, 0.02 + i * 0.1, 1, 1, 1.25), i === 0 ? ROUGE : b); hamecon(E, 0.56, -0.05);
    const P = new Etabli(); P.pose(new THREE.SphereGeometry(1, 16, 10), M(0.17, 0, -0.2, 0.17, 0.022, 0.36, 0, 0.3), (x, y) => (y > 0 ? a : melange(a, couleur('#9aa0a8'), 0.4))); P.pose(new THREE.SphereGeometry(1, 10, 6), M(0.17, 0.02, -0.17, 0.07, 0.01, 0.14, 0, 0.3), ROUGE); P.tube(-0.44, -0.47, 0.03, 0.03, 6, ACIER, { x: 0.02 });
    const lame = P.maille(1); corps.add(lame); groupe.userData.lame = lame;
  } else if (l.id === 'ondulante') {
    // l'ondulante : une cuiller creuse, de cuivre martelé, qui roule d'un flanc sur l'autre
    E.pose(new THREE.SphereGeometry(1, 18, 10), M(0, 0, 0, 0.3, 0.06, 0.62), (x, y, z, f) => melange(a, couleur('#e8a868'), (f % 7) / 9)); E.pose(new THREE.SphereGeometry(1, 14, 8), M(0, 0.035, 0.02, 0.22, 0.03, 0.5), b); anneau(E, -0.66); hamecon(E, 0.7, -0.02);
  } else if (l.famille === 'nageur') {
    // le poisson nageur : un petit poisson de bois peint, sa bavette qui le fait plonger et frétiller
    E.pose(new THREE.SphereGeometry(0.5, 18, 12), M(0, 0, 0, 0.3, 0.36, 1), (x, y) => (y > 0.06 ? a : y > -0.02 ? melange(a, b, 0.5) : b)); for (let i = 0; i < 6; i++) E.pose(new THREE.SphereGeometry(0.5, 8, 6), M(0, 0.13, -0.25 + i * 0.1, 0.02, 0.06, 0.05), melange(a, couleur('#2a3028'), 0.5));
    E.pose(new THREE.BoxGeometry(0.22, 0.016, 0.26), new THREE.Matrix4().makeRotationX(0.5).setPosition(0, -0.08, -0.58), IVOIRE); E.pose(new THREE.SphereGeometry(0.5, 8, 6), M(0, 0, 0.5, 0.04, 0.2, 0.14), a); oeil(E, -0.32, 0.05, 0.1); anneau(E, -0.62); hamecon(E, 0.12, -0.2); hamecon(E, 0.46, -0.16);
  } else {
    // le souple : une tête plombée, un corps qui se tortille, et la queue qui bat (une palette pour le shad, une pointe fine pour le ver)
    E.pose(new THREE.SphereGeometry(0.15, 12, 10), M(0, 0, -0.48), PLOMB); oeil(E, -0.52, 0.04, 0.1); anneau(E, -0.64); E.tube(-0.46, 0.05, 0.012, 0.012, 5, ACIER); hamecon(E, 0.08, 0.05);
    const n = l.id === 'ver' ? 9 : 6; for (let i = 0; i < n; i++) { const k = i / (n - 1), z = -0.36 + k * 0.62, r = 0.17 * (1 - k * 0.5); E.pose(new THREE.SphereGeometry(r, 12, 8), M(0, 0, z, 0.85, 1.1, 1.3), (x, y) => (y > 0.03 ? b : a)); }
    const Q = new Etabli(); if (l.id === 'ver') for (let i = 0; i < 5; i++) Q.pose(new THREE.SphereGeometry(0.07 - i * 0.012, 8, 6), M(0, 0, 0.04 + i * 0.07), a); else { Q.pose(new THREE.CylinderGeometry(0.035, 0.07, 0.14, 10).rotateX(Math.PI / 2), M(0, 0, 0.05), a); Q.pose(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16), new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0, 0, 0.14), b); }
    const queue = new THREE.Group(); queue.add(Q.maille(1)); queue.position.z = 0.27; corps.add(queue); groupe.userData.queue = queue;
  }
  corps.add(E.maille(1)); return groupe;
}
