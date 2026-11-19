// LES EAUX DE MONET — la matière picturale. Le monde n'est pas de la 3D filtrée : chaque feuille, chaque motte d'herbe est un
// coup de pinceau posé dans l'espace (une « touche »), avec sa forme de brosse, ses poils, sa couleur et sa lumière.
import * as THREE from 'three';

// réglages partagés par toutes les matières (une seule copie : les changer change tout le tableau)
export const UNI = {
  uTemps: { value: 0 }, uVent: { value: 0.25 }, uDirSoleil: { value: new THREE.Vector3(0.4, 0.8, -0.3).normalize() },
  uSoleil: { value: new THREE.Color(1, 0.95, 0.8) }, uOmbre: { value: new THREE.Color(0.4, 0.5, 0.65) }, uBrume: { value: new THREE.Color(0.9, 0.9, 0.85) },
  uHorizon: { value: new THREE.Color(0.9, 0.9, 0.8) }, uZenith: { value: new THREE.Color(0.5, 0.7, 0.9) },
  uDensite: { value: 0.002 }, uForce: { value: 1 }, uMiroir: { value: 0 }, uLod: { value: 130 }, uNuit: { value: 0 }, uCouvert: { value: 0 }, uPluie: { value: 0 },
};
export const couleur = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
// une couleur prise au hasard dans une palette, un peu déplacée : deux touches ne sont jamais identiques
export const pioche = (pal, r, j = 0.05) => { const a = couleur(pal[Math.floor(r() * pal.length)]), d = (r() - 0.5) * j * 2; return [a[0] + d + (r() - 0.5) * j, a[1] + d + (r() - 0.5) * j, a[2] + d + (r() - 0.5) * j]; };
export const melange = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* ---------- La brosse : quatre coups de pinceau peints par le code (forme déchirée, sillons des poils) ---------- */
function texturePinceau() {
  const N = 512, C = N / 2, d = new Uint8Array(N * N * 4);
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let c = 0; c < 4; c++) {
    const ox = (c % 2) * C, oy = (c >> 1) * C, poils = 26 + c * 7;
    for (let y = 0; y < C; y++) {
      const v = y / C, p = Math.floor(v * poils), debut = 0.05 + h(p, c) * 0.2, fin = 0.8 + h(p + 9, c) * 0.17, bord = Math.abs(v - 0.5) * 2, valeur = 0.55 + h(p + 3, c + 2) * 0.45;
      for (let x = 0; x < C; x++) {
        const u = x / C, serre = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 0.96 + 0.02))), 0.42) * (1 - u * 0.16), dedans = bord < serre * (0.9 + Math.sin(u * 9 + c * 2) * 0.06) && u > debut * 0.5 && u < fin + 0.03 - h(Math.floor(u * 30), p) * 0.05 && h(p, Math.floor(u * 14) + c) > 0.1 * u; // une touche arrondie, qui s'effiloche au bout
        const k = ((oy + y) * N + ox + x) * 4, sillon = valeur * (0.78 + 0.22 * Math.sin(v * poils * 6.28));
        d[k] = d[k + 1] = d[k + 2] = Math.round(255 * sillon); d[k + 3] = dedans ? 255 : 0;
      }
    }
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
const PINCEAU = texturePinceau();

const VERT = /* glsl */ `
attribute vec3 aPos; attribute vec4 aDim; attribute vec3 aCol; attribute vec3 aNor; attribute vec2 aVar;
uniform float uTemps, uVent, uDensite, uForce, uLod, uCourbe, uCourbeX; uniform vec3 uDirSoleil, uSoleil, uOmbre;
varying vec2 vUv; varying vec3 vCol; varying float vFog, vY;
void main() {
  vec2 q = position.xy; float graine = aVar.x, mode = aDim.w, c = cos(aDim.z), s = sin(aDim.z);
  mat3 M = mat3(modelMatrix); vec3 base = aPos;
  if (mode > 2.5) { base.y -= uCourbe * aVar.y * aVar.y; base.x += uCourbeX * aVar.y * aVar.y; } // la canne plie
  vec3 w = (modelMatrix * vec4(base, 1.)).xyz; float d = distance(w, cameraPosition), k = smoothstep(uLod * .45, uLod, d);
  vec2 taille = aDim.xy * (1. + k * .95);
  vec3 D = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), H = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), N = normalize(M * aNor), p;
  if (mode < .5) { vec3 t = normalize(cross(N, M * vec3(s, .02, c))), b = cross(N, t); p = w + t * q.x * taille.x + b * q.y * taille.y + N * .02; }
  else if (mode < 1.5 || mode > 2.5) { vec3 x = D * c + H * s, y = H * c - D * s; p = w + x * q.x * taille.x + y * q.y * taille.y; }
  else { vec3 x = normalize(cross(vec3(0., 1., 0.), cameraPosition - w)); p = w + x * q.x * taille.x + vec3(0., 1., 0.) * (q.y + .5) * taille.y; p.xz += vec2(s, c) * (q.y + .5) * (q.y + .5) * taille.y * .22; }
  float souple = mode > 1.5 && mode < 2.5 ? (q.y + .5) * (q.y + .5) : 1., balance = mode > 2.5 ? 0. : aVar.y * souple;
  p.x += sin(uTemps * 1.5 + graine * 40. + w.x * .18) * uVent * balance; p.z += cos(uTemps * 1.15 + graine * 31. + w.z * .16) * uVent * balance * .65; p.y += sin(uTemps * 1.9 + graine * 20.) * uVent * balance * .2;
  float i = floor(graine * 4.); vUv = (q + .5 + vec2(mod(i, 2.), floor(i / 2.))) * .5;
  // la lumière : les ombres sont colorées, jamais noires
  float e = dot(N, uDirSoleil) * .5 + .5; vec3 l = mix(uOmbre * .78, uSoleil * 1.04, smoothstep(.3, .76, e)) * uForce;
  vCol = aCol * l + aCol * uOmbre * .12; vFog = 1. - exp(-d * uDensite); vY = w.y;
  gl_Position = graine < k * .6 ? vec4(2., 2., 2., 1.) : projectionMatrix * viewMatrix * vec4(p, 1.); // au loin, moins de touches mais plus larges
}`;
const FRAG = /* glsl */ `
uniform sampler2D tPinceau; uniform float uMiroir; uniform vec3 uBrume; varying vec2 vUv; varying vec3 vCol; varying float vFog, vY;
void main() {
  vec4 t = texture2D(tPinceau, vUv); if (t.a < .45) discard; if (uMiroir > .5 && vY < -.04) discard;
  gl_FragColor = vec4(mix(vCol * (.8 + t.r * .36), uBrume, vFog), 1.);
}`;
export function matiereTouches(extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { ...UNI, tPinceau: { value: PINCEAU }, uCourbe: { value: 0 }, uCourbeX: { value: 0 }, ...extra } });
}

/* ---------- La toile : on y pose des touches, elle les range par cases pour ne dessiner que ce qui est dans le champ ---------- */
export const SOL = 0, FACE = 1, TIGE = 2, CANNE = 3;
const QUAD = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), IDX = [0, 1, 2, 0, 2, 3];
export class Toile {
  constructor(cote = 36) { this.cote = cote; this.cases = new Map(); this.total = 0; }
  // position, largeur, hauteur, rotation, mode, couleur, normale, balancement
  touche(x, y, z, l, h, rot, mode, col, nor, balance = 0, graine = Math.random()) {
    const k = Math.floor(x / this.cote) + ',' + Math.floor(z / this.cote); let c = this.cases.get(k); if (!c) this.cases.set(k, (c = { p: [], d: [], c: [], n: [], v: [] }));
    c.p.push(x, y, z); c.d.push(l, h, rot, mode); c.c.push(col[0], col[1], col[2]); c.n.push(nor[0], nor[1], nor[2]); c.v.push(graine, balance); this.total++;
  }
  poser(parent, matiere, calque = 0) {
    for (const c of this.cases.values()) {
      const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(QUAD, 3)); g.setIndex(IDX);
      g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(c.p), 3)); g.setAttribute('aDim', new THREE.InstancedBufferAttribute(new Float32Array(c.d), 4));
      g.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(c.c), 3)); g.setAttribute('aNor', new THREE.InstancedBufferAttribute(new Float32Array(c.n), 3)); g.setAttribute('aVar', new THREE.InstancedBufferAttribute(new Float32Array(c.v), 2));
      g.instanceCount = c.p.length / 3;
      const b = new THREE.Box3(); for (let i = 0; i < c.p.length; i += 3) b.expandByPoint(new THREE.Vector3(c.p[i], c.p[i + 1], c.p[i + 2]));
      g.boundingSphere = b.getBoundingSphere(new THREE.Sphere()); g.boundingSphere.radius += 9;
      const m = new THREE.Mesh(g, matiere); m.layers.set(calque); parent.add(m);
    }
    this.cases.clear();
  }
}
