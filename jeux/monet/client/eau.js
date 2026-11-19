// LES EAUX DE MONET — la signature du jeu : une eau faite de coups de pinceau horizontaux. Chaque touche prend sa couleur dans le
// vrai reflet du paysage (rendu à part), tremble avec le vent, se brise sous la pluie, s'ouvre sur le fond quand on regarde de haut.
// Le ciel est peint de la même main.
import * as THREE from 'three';
import { UNI } from './peinture.js';
import { profondeur } from './etang.js';

const COMMUN = /* glsl */ `
float h1(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float nz(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
float fb(vec2 p) { return nz(p) * .55 + nz(p * 2.1 + 3.) * .3 + nz(p * 4.3 + 7.) * .15; }
// une touche de brosse dans une rangée de briques : renvoie sa présence (x), son identité (y), et le centre de la touche (zw)
vec4 touche(vec2 p, vec2 t, float g, float derive) {
  float rang = floor(p.y / t.y), dec = h1(vec2(rang, g)) * t.x + derive * (mod(rang, 2.) * 2. - 1.); vec2 q = vec2(p.x + dec, p.y), c = floor(q / t), f = fract(q / t) - .5; float id = h1(c + g);
  f.y += (id - .5) * .4; f.x += (h1(c + g + 4.) - .5) * .35;
  float m = smoothstep(.56, .34, abs(f.x) * (1. + id * .5)) * smoothstep(.5, .22, abs(f.y + sin(f.x * 7. + id * 20.) * .08));
  m *= .72 + .28 * nz(vec2(f.x * 3. + id * 9., f.y * 22. + id * 3.));
  return vec4(smoothstep(.3, .5, m), id, ((c + .5) * t) - vec2(dec, 0.));
}`;

export function creerEau(scene, Q) {
  // la carte des profondeurs de l'étang
  const N = 256, D = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) D[j * N + i] = Math.min(255, profondeur((i / (N - 1)) * 340 - 170, (j / (N - 1)) * 340 - 170) * 36);
  const carte = new THREE.DataTexture(D, N, N, THREE.RedFormat); carte.magFilter = carte.minFilter = THREE.LinearFilter; carte.needsUpdate = true;
  const reflet = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const ronds = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0));
  const uni = { ...UNI, tReflet: { value: reflet.texture }, tProf: { value: carte }, uVP: { value: new THREE.Matrix4() }, uRonds: { value: ronds } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: uni,
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${COMMUN}
      uniform sampler2D tReflet, tProf; uniform mat4 uVP; uniform vec4 uRonds[8]; uniform vec3 uDirSoleil, uSoleil, uOmbre, uBrume, uHorizon, uZenith; uniform float uTemps, uVent, uPluie, uDensite, uForce, uNuit; varying vec3 vW;
      vec3 reflet(vec2 c, float amp, float id) { vec4 q = uVP * vec4(c.x, 0., c.y, 1.); vec2 uv = q.xy / q.w * .5 + .5; uv += vec2(sin(uTemps * .7 + id * 40. + c.y * .6), cos(uTemps * .55 + id * 31. + c.x * .4) * 1.6) * amp; return texture2D(tReflet, clamp(uv, .003, .997)).rgb; }
      // une passe du tableau à une échelle donnée
      vec3 peindre(vec2 p, float e, float amp, vec3 fond, float rides) {
        vec3 col = fond; float dv = uTemps * (.05 + uVent * .22);
        vec2 ca = vec2(cos(.08), sin(.08)); vec2 p1 = vec2(p.x * ca.x + p.y * ca.y, p.y * ca.x - p.x * ca.y);
        vec4 a = touche(p1 + vec2(sin(p1.y * .3 + uTemps * .3) * .3, 0.), vec2(2.6, .62) * e, 1., dv); vec2 c1 = vec2(a.z * ca.x - a.w * ca.y, a.w * ca.x + a.z * ca.y); col = mix(col, reflet(c1, amp, a.y) * (.9 + a.y * .22), a.x * .96);
        vec4 b = touche(p1 * vec2(1., 1.) + 13.7, vec2(1.7, .4) * e, 2., -dv * 1.4); vec2 c2 = vec2((b.z - 13.7) * ca.x - (b.w - 13.7) * ca.y, (b.w - 13.7) * ca.x + (b.z - 13.7) * ca.y); vec3 r2 = reflet(c2, amp * 1.6, b.y); float chaud = step(.5, b.y); r2 = mix(r2 * vec3(.88, .95, 1.12), r2 * vec3(1.14, 1.04, .86), chaud); col = mix(col, r2, b.x * step(.38, b.y) * .9);
        vec4 c = touche(p1 + 31.1, vec2(1.05, .24) * e, 3., dv * 2.); vec2 c3 = vec2((c.z - 31.1) * ca.x - (c.w - 31.1) * ca.y, (c.w - 31.1) * ca.x + (c.z - 31.1) * ca.y); col = mix(col, mix(uHorizon, uZenith, c.y) * (.82 + rides), c.x * step(.8, c.y) * (.32 + uVent * .3));
        return col;
      }
      void main() {
        vec3 V = normalize(cameraPosition - vW); float d = length(cameraPosition - vW), pr = texture2D(tProf, (vW.xz + 170.) / 340.).r * 7.08;
        vec2 p = vW.xz; float rides = 0.;
        for (int i = 0; i < 8; i++) { vec4 R = uRonds[i]; float age = uTemps - R.z; if (age < 0. || age > 5.) continue; float dr = distance(p, R.xy), front = age * 2.1; rides += sin((dr - front) * 6.) * smoothstep(front + .9, front - .2, dr) * smoothstep(front - 2.4, front - .4, dr) * exp(-age * .9) * R.w; p += normalize(p - R.xy + 1e-3) * rides * .1; }
        if (uPluie > .02) { vec2 g = p / 1.5, ci = floor(g), f = fract(g) - .5; float idp = h1(ci), ph = fract(uTemps * (.5 + idp) + idp * 9.), dd = length(f + (vec2(idp, h1(ci + 3.)) - .5) * .5); rides += smoothstep(.07, 0., abs(dd - ph * .46)) * (1. - ph) * step(idp, uPluie * .8) * 1.1; }
        float amp = (.004 + uVent * .03 + abs(rides) * .018) * clamp(14. / d, .2, 1.), niv = max(0., log2(max(1., d / 11.))), l = floor(niv), fr = niv - l;
        vec3 fond = mix(vec3(.32, .42, .32), vec3(.09, .24, .3), smoothstep(.2, 3., pr)) * mix(uOmbre, uSoleil, .55) * uForce;
        vec3 col = mix(peindre(p, pow(2., l), amp, fond, rides), peindre(p, pow(2., l + 1.), amp, fond, rides), smoothstep(.55, 1., fr));
        col += uHorizon * max(rides, 0.) * .32;
        // le soleil (ou la lune) posé sur l'eau en touches claires
        vec4 e = touche(p + 7.3, vec2(.9, .17) * pow(2., l), 5., uTemps * .1); vec3 H = normalize(V + uDirSoleil); float sp = pow(max(H.y, 0.), 260.) * (1. - uPluie * .6); col = mix(col, uSoleil * (1.25 + uNuit * .1), e.x * smoothstep(.16, .7, sp * 2.4 + (e.y - .5) * .3 * sp));
        float fres = pow(1. - max(V.y, 0.), 3.), a = mix(.5, .985, fres) + smoothstep(1.2, 4., pr) * .28; a = clamp(a, 0., .985) * smoothstep(.0, .1, pr + (nz(p * 1.4) - .5) * .08);
        col = mix(col, uBrume, 1. - exp(-d * uDensite));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(340, 340).rotateX(-Math.PI / 2), mat); m.renderOrder = 5; m.layers.set(2); scene.add(m);
  let iR = 0;
  return { reflet, mat,
    // une onde sur l'eau : un leurre, un poisson, une goutte
    rond(x, z, force = 1) { ronds[iR].set(x, z, UNI.uTemps.value, force); iR = (iR + 1) % 8; },
    taille(w, h) { reflet.setSize(Math.max(2, Math.round(w)), Math.max(2, Math.round(h))); },
    maj(cam) { uni.uVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); },
  };
}

export function creerCiel(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, depthWrite: false, uniforms: { ...UNI }, // des deux côtés : le reflet retourne le ciel
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */ `
      ${COMMUN}
      uniform vec3 uHorizon, uZenith, uSoleil, uOmbre, uDirSoleil, uBrume; uniform float uTemps, uCouvert, uNuit, uForce, uDensite; varying vec3 vD;
      vec3 ciel(vec3 d) { return mix(uHorizon, uZenith, smoothstep(.0, .62, d.y)); }
      void main() {
        vec3 d = normalize(vD); float y = max(d.y, .02); vec2 p = d.xz / (y + .22) * 3.6 + vec2(uTemps * .012, 0.);
        vec3 col = ciel(d); float haut = smoothstep(-.02, .1, d.y);
        // le fond du ciel : de larges touches croisées, deux bleus qui se répondent
        vec4 a = touche(mat2(.92, .38, -.38, .92) * p, vec2(1.7, .5), 1., 0.); col = mix(col, ciel(d + vec3(0., (a.y - .5) * .34, 0.)) * (.95 + a.y * .1), a.x * .7);
        vec4 b = touche(mat2(.8, -.6, .6, .8) * p + 9., vec2(1.2, .36), 2., 0.); col = mix(col, mix(uZenith, uHorizon, b.y) * vec3(1.03, 1., .98), b.x * step(.55, b.y) * .34);
        // les nuages : des masses pâles, ombrées de violet, posées à la brosse
        float n = fb(p * .34 + 5.), seuilN = mix(.62, .26, uCouvert), m = smoothstep(seuilN, seuilN + .16, n);
        vec4 c = touche(p * 1.1 + 3., vec2(1.25, .42), 3., 0.); float haut2 = smoothstep(seuilN + .04, seuilN + .34, fb(p * .34 + 5. + vec2(.0, .3)) + (c.y - .5) * .1);
        vec3 nuage = mix(mix(uOmbre, uHorizon, .55) * mix(1., .8, uCouvert), mix(uSoleil, vec3(1.), .4) * (uForce * .96), haut2); col = mix(col, nuage * (.9 + c.y * .2), m * mix(.55, 1., c.x) * haut);
        // le soleil, la lune et les étoiles
        float s = max(dot(d, uDirSoleil), 0.); col += uSoleil * (smoothstep(.994, .998, s) * 1.1 * (1. - m) + pow(s, 26.) * .3 * (1. - uCouvert * .8));
        if (uNuit > .05) { vec2 g = d.xz / (y + .3) * 26.; vec2 ci = floor(g); float e = h1(ci); col += vec3(.95, .93, .8) * step(.985, e) * smoothstep(.34, .1, length(fract(g) - .5)) * uNuit * (1. - uCouvert) * haut; }
        col = mix(col, uBrume, smoothstep(.2, 0., d.y) * .85); col = mix(col, uBrume, clamp(uDensite * 40., 0., 1.) * .9);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), mat); m.frustumCulled = false; m.renderOrder = -10; scene.add(m);
  return m;
}
