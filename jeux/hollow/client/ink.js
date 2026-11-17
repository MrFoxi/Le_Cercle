// THE HOLLOW — « l'encre vivante » : le rendu maison, sans aucun modèle ni texture importés.
// 1. Chaque objet est ombré par paliers (deux à trois valeurs), hachuré dans l'ombre (des traits fixés dans le monde,
//    qui collent aux formes), lavé par la perspective aérienne. Il écrit aussi, dans une seconde image, sa normale,
//    sa profondeur et l'épaisseur de son trait.
// 2. Une passe dessine le trait d'encre à l'écran à partir de ces profondeurs et normales : plus fin au loin, effacé
//    dans la brume, et qui « bouillonne » : il tremble et se redessine 8 fois par seconde, comme un dessin animé à la main.
// 3. Une dernière passe ajoute les rayons du puits de lumière, le grain du papier et le vignettage.
// La révélation : tant que le joueur ne s'est pas approché d'un lieu, il reste une esquisse au crayon sur papier ;
// la couleur s'y répand comme une aquarelle quand on arrive.
import * as THREE from 'three';

// réglages partagés par toutes les matières (une seule copie : les changer change tout le monde)
export const U = {
  uTime: { value: 0 }, uBoil: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 1, 0.2).normalize() },
  uSunCol: { value: new THREE.Color('#fff4dc') }, uShadowCol: { value: new THREE.Color('#4f6fa8') },
  uFogCol: { value: new THREE.Color('#cdeee6') }, uFogDensity: { value: 0.0042 },
  uReveal: { value: null }, uRevealRect: { value: new THREE.Vector4(-420, -420, 840, 840) }, uRevealAll: { value: 0 },
  uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 },
};

const COMMON = /* glsl */ `
uniform float uTime, uBoil, uFogDensity, uShadowOn, uRevealAll;
uniform vec3 uSunDir, uSunCol, uShadowCol, uFogCol;
uniform sampler2D uReveal, uShadowMap; uniform vec4 uRevealRect; uniform mat4 uShadowMatrix;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
`;

const VERT = /* glsl */ `
${COMMON}
uniform float uWind;
varying vec3 vW, vN, vC; varying float vDepth; varying vec2 vUv;
void main() {
  #ifdef USE_INSTANCING
    mat4 M = modelMatrix * instanceMatrix;
  #else
    mat4 M = modelMatrix;
  #endif
  vec4 w = M * vec4(position, 1.);
  // le vent : plus fort en haut de la forme (herbe, feuillage, tentacules)
  float sway = uWind * max(position.y, 0.);
  w.x += sin(uTime * 1.6 + w.x * .12 + w.z * .09) * sway; w.z += cos(uTime * 1.25 + w.x * .08) * sway * .6;
  vW = w.xyz; vN = normalize(mat3(M) * normal); vUv = uv;
  vC = vec3(1.);
  #ifdef USE_COLOR
    vC = color.rgb;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vC *= instanceColor;
  #endif
  vec4 mv = viewMatrix * w; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
${COMMON}
layout(location = 0) out highp vec4 oColor;
layout(location = 1) out highp vec4 gInfo;
uniform vec3 uTint; uniform float uLine, uTrans, uKind, uGlow;
varying vec3 vW, vN, vC; varying float vDepth; varying vec2 vUv;

float shadowAt(vec3 w) {
  if (uShadowOn < .5) return 1.;
  vec4 s = uShadowMatrix * vec4(w, 1.); s.xyz = s.xyz / s.w * .5 + .5;
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  float k = 0.; vec2 t = vec2(1. / 2048.);
  for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i % 2) - .5, float(i / 2) - .5) * 2.2 * t; k += s.z - .002 > texture(uShadowMap, s.xy + o).r ? 0. : 1.; }
  return k / 4.;
}
// hachures fixées dans le monde (projection sur le plan le plus en face), qui se redessinent avec le trait
float hatch(vec3 w, vec3 N, float dens) {
  vec3 a = abs(N);
  vec2 p = a.y > max(a.x, a.z) ? w.xz : (a.x > a.z ? w.zy : w.xy);
  float b = floor(uBoil);
  p += vec2(hash12(vec2(b, 1.)), hash12(vec2(b, 2.))) * .25;
  float d = dot(p, vec2(.7071, .7071)) * dens + vnoise(p * 1.7) * .6;
  return smoothstep(.22, .08, abs(fract(d) - .5) - .12) * smoothstep(90., 20., vDepth);
}
// un coup de pinceau court par case, orienté au hasard : l'herbe est peinte, pas texturée
float strokes(vec2 p, float size) {
  vec2 c = floor(p / size), f = fract(p / size) - .5;
  float a = hash12(c) * 6.283; vec2 d = vec2(cos(a), sin(a));
  return smoothstep(.09, .03, abs(dot(f, vec2(-d.y, d.x)))) * smoothstep(.42, .25, abs(dot(f, d))) * (hash12(c + 17.) * 2. - 1.);
}
// les Jardins : herbe peinte (émeraude, nappes turquoise, fleurs en points), falaises à strates ondulées, coulures,
// mousse accrochée, et quelques entailles parfaitement droites (quelque chose taille ces falaises)
vec3 terrainColor(vec3 w, vec3 N) {
  float big = vnoise(w.xz * .02), mid = vnoise(w.xz * .09 + 3.);
  vec3 grass = mix(vec3(.16, .42, .3), vec3(.36, .64, .36), big);
  grass = mix(grass, vec3(.24, .6, .56), smoothstep(.6, .85, vnoise(w.xz * .008 + 7.)) * .6);
  grass *= (.86 + mid * .26) * (1. + strokes(w.xz, .7) * .16 + strokes(w.xz + 9.3, 1.9) * .12);
  vec2 fc = floor(w.xz / .9);
  if (hash12(fc + 3.1) > .985 && length(fract(w.xz / .9) - .5) < .16) grass = mix(vec3(1., .55, .72), vec3(1., .9, .4), hash12(fc));
  vec3 rock = mix(vec3(.64, .68, .7), vec3(.44, .48, .56), vnoise(w.xz * .07 + w.y * .11));
  float sb = vnoise(vec2(w.y * .25, (w.x + w.z) * .02));
  rock *= 1. - smoothstep(.5, .55, fract(w.y * .12 + vnoise(w.xz * .03) * 1.4)) * (.05 + sb * .08);
  rock *= 1. - smoothstep(.75, 1., vnoise(vec2((w.x + w.z) * .35, w.y * .02))) * .18;
  rock *= 1. - step(.97, fract(w.y * .21)) * .3 * step(.62, vnoise(w.xz * .02 + 3.));
  float moss = smoothstep(.62, .78, vnoise(w.xz * .05 + w.y * .04) + vnoise(vec2((w.x - w.z) * .5, w.y * .05)) * .35);
  rock = mix(rock, vec3(.2, .48, .34) * (.8 + mid * .4), moss * .85);
  float g = smoothstep(.62, .8, N.y + (vnoise(w.xz * .3) - .5) * .2);
  vec3 c = mix(rock, grass, g);
  return mix(c, grass * .62, smoothstep(.5, .62, N.y) * (1. - g) * .8);
}
void main() {
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 base = vC * uTint;
  if (uKind > .5 && uKind < 1.5) base = terrainColor(vW, N);
  if (uKind > 1.5 && uKind < 2.5) { // l'eau des cascades : des filets qui tombent, et des trous
    float s = vnoise(vec2(vUv.x * 26., vUv.y * 2.2 + uTime * 2.6)) + vnoise(vec2(vUv.x * 60., vUv.y * 5. + uTime * 4.)) * .5;
    if (s < .62 - vUv.y * .15) discard;
    base = mix(vec3(.75, .95, .98), vec3(1.), smoothstep(.9, 1.2, s));
  }
  float ndl = dot(N, uSunDir), sh = shadowAt(vW + N * .45); // décalé le long de la normale : pas de dents d'ombre sur les parois
  float l = (ndl * .5 + .5) * mix(.32, 1., sh);
  float wob = (vnoise(vW.xz * .6 + vW.y * .4) - .5) * .07;
  float b1 = smoothstep(.43 + wob, .45 + wob, l), b2 = smoothstep(.74 + wob, .76 + wob, l);
  vec3 shade = base * mix(vec3(1.), uShadowCol, .5) * .58;
  vec3 col = mix(shade, base * .9, b1); col = mix(col, base * 1.07 + uSunCol * .05, b2);
  col *= 1. - hatch(vW, N, 2.6) * (1. - b1) * .42;
  col += base * uSunCol * uTrans * (pow(max(0., -ndl), 1.5) * .9 + .3); // les pétales de verre : le soleil passe au travers
  col = mix(col, base * (1. + uGlow), step(.01, uGlow)); // ce qui luit ne prend pas l'ombre
  // perspective aérienne : par lavis (paliers), et une brume plus épaisse vers le gouffre
  float fog = 1. - exp(-vDepth * uFogDensity);
  fog = max(fog, smoothstep(5., -60., vW.y) * .85);
  fog = floor(fog * 7. + vnoise(vW.xz * .05) * .6) / 7.;
  col = mix(col, uFogCol, clamp(fog, 0., 1.));
  // la révélation : esquisse au crayon tant qu'on n'y est pas allé, la couleur s'y répand comme une aquarelle
  vec2 ruv = (vW.xz - uRevealRect.xy) / uRevealRect.zw;
  float rv = max(texture(uReveal, ruv).r, uRevealAll) + (vnoise(vW.xz * .12) - .5) * .4 + (vnoise(vW.xz * .9) - .5) * .12;
  float shown = smoothstep(.42, .5, rv);
  float lum = dot(col, vec3(.3, .59, .11));
  vec3 paper = vec3(.94, .91, .85), lead = vec3(.27, .26, .31);
  vec3 sketch = mix(paper, lead, clamp((1. - lum) * .75 - .1, 0., 1.));
  sketch = mix(sketch, lead, hatch(vW, N, 1.6) * (1. - b1) * .55);
  sketch = mix(sketch, paper, fog * .8);
  col = mix(sketch, col, shown);
  // bord mouillé de l'aquarelle qui avance
  col *= 1. - smoothstep(.0, .05, shown) * smoothstep(.2, .05, shown) * .25;
  oColor = vec4(col, 1.);
  vec3 vn = normalize((viewMatrix * vec4(N, 0.)).xyz);
  gInfo = vec4(vn.xy * .5 + .5, mix(1.25, uLine, shown) * (1. - fog * .9), vDepth);
}`;

// Une matière de l'encre vivante. o : { color (teinte), line (épaisseur du trait 0..1), trans, wind, kind, glow, side }
export function ink(o = {}) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, vertexColors: o.vertexColors !== false, side: o.side ?? THREE.FrontSide,
    uniforms: {
      ...U, uTint: { value: new THREE.Color(o.color ?? '#ffffff') }, uLine: { value: o.line ?? 1 }, uTrans: { value: o.trans ?? 0 },
      uWind: { value: o.wind ?? 0 }, uKind: { value: { terrain: 1, water: 2 }[o.kind] ?? 0 }, uGlow: { value: o.glow ?? 0 },
    },
  });
  return m;
}

// Ce qui est translucide ou lumineux (brume, taches de lumière) : dessiné par-dessus, sans trait.
// Sa seconde sortie vaut zéro, alpha compris : le mélange laisse intacts normales et profondeurs.
export function glowy(o = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
    uniforms: { ...U, uTint: { value: new THREE.Color(o.color ?? '#ffffff') }, uAlpha: { value: o.alpha ?? 0.5 }, uSoft: { value: o.soft ?? 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main() { vUv = uv;
      #ifdef USE_INSTANCING
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
      #else
        vec4 w = modelMatrix * vec4(position, 1.);
      #endif
      vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${COMMON}
      layout(location = 0) out highp vec4 oColor;
layout(location = 1) out highp vec4 gInfo;
      uniform vec3 uTint; uniform float uAlpha, uSoft; varying vec2 vUv; varying vec3 vW;
      void main() {
        float r = length(vUv - .5) * 2.; float n = vnoise(vW.xz * .25 + vW.y * .3 + uTime * .1);
        float a = smoothstep(1., .55 - uSoft * .3, r + (n - .5) * .5) * uAlpha;
        a = floor(a * 5. + .5) / 5.; // par paliers, comme un lavis
        if (a < .01) discard;
        oColor = vec4(uTint, a); gInfo = vec4(0.);
      }`,
  });
}

// Le ciel du puits : blanc éblouissant au zénith, turquoise vers les parois ; il n'a pas de trait.
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false, uniforms: { ...U },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `${COMMON}
      layout(location = 0) out highp vec4 oColor;
layout(location = 1) out highp vec4 gInfo; varying vec3 vDir;
      void main() {
        float y = vDir.y, sun = max(0., dot(vDir, uSunDir));
        vec3 c = mix(uFogCol, vec3(.62, .86, .98), smoothstep(.0, .6, y));
        c = mix(c, vec3(1., .99, .96), smoothstep(.82, .97, y) * .9);
        c += uSunCol * (pow(sun, 40.) * .8 + pow(sun, 6.) * .15);
        c = floor(c * 18.) / 18.; // le ciel aussi est peint par aplats
        oColor = vec4(c, 1.); gInfo = vec4(.5, .5, 0., 9000.);
      }`,
  });
}

/* ---------- La chaîne de rendu ---------- */
const FULL = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULL, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { m, s };
}
const INK = /* glsl */ `${COMMON}
layout(location = 0) out highp vec4 oColor;
uniform sampler2D tColor, tInfo; uniform vec2 uRes; varying vec2 vUv;
vec3 nrm(vec4 i) { vec2 n = i.xy * 2. - 1.; return vec3(n, sqrt(max(0., 1. - dot(n, n)))); }
void main() {
  vec4 c0 = texture(tColor, vUv), i0 = texture(tInfo, vUv);
  float d0 = i0.w, b = floor(uBoil);
  // le trait tremble : décalage tiré d'un bruit, retiré 8 fois par seconde
  vec2 j = vec2(vnoise(vUv * uRes / 38. + b * 13.1), vnoise(vUv * uRes / 38. + 71. + b * 7.7)) - .5;
  float px = mix(1.7, .85, smoothstep(12., 160., d0));
  float edgeD = 0., edgeN = 0., lw = 0.; vec3 n0 = nrm(i0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * .785398;
    vec2 o = (vec2(cos(a), sin(a)) * px + j * 1.1) / uRes;
    vec4 i1 = texture(tInfo, vUv + o);
    edgeD = max(edgeD, abs(i1.w - d0) / max(min(i1.w, d0), .1));
    edgeN = max(edgeN, 1. - dot(nrm(i1), n0));
    lw = max(lw, i1.w < d0 ? i1.z : i0.z);
  }
  float line = max(smoothstep(.03, .07, edgeD), smoothstep(.2, .45, edgeN) * .8) * clamp(lw, 0., 1.25);
  line *= .75 + vnoise(vUv * uRes / 6. + b * 3.) * .35; // la pression de la plume varie
  vec3 inkC = mix(vec3(.09, .08, .16), c0.rgb * .3, .4);
  oColor = vec4(mix(c0.rgb, inkC, clamp(line, 0., 1.) * .92), 1.);
}`;
const FINAL = /* glsl */ `${COMMON}
layout(location = 0) out highp vec4 oColor;
uniform sampler2D tColor, tInfo; uniform vec2 uRes, uSun; uniform float uRays; varying vec2 vUv;
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  // rayons du puits : on remonte vers le soleil et on compte le ciel qu'on traverse
  if (uRays > 0.) {
    vec2 dir = (vUv - uSun) / 48. * .85, p = vUv; float acc = 0., dec = 1.;
    for (int i = 0; i < 48; i++) { p -= dir; float s = texture(tInfo, clamp(p, 0., 1.)).w > 5000. ? 1. : 0.; acc += s * dec; dec *= .965; }
    float r = acc / 48. * uRays;
    r = floor(r * 6.) / 6.; // les rayons aussi sont posés en aplats
    c += vec3(1., .98, .9) * r * .55;
  }
  // papier : fibres, grain, et un vignettage à l'encre
  float fib = vnoise(vUv * uRes / vec2(2.5, 14.)) * .6 + vnoise(vUv * uRes / 1.3) * .4;
  c *= .955 + fib * .07;
  c += (hash12(vUv * uRes + floor(uBoil) * 17.) - .5) * .03;
  vec2 q = vUv - .5; c *= 1. - smoothstep(.45, .85, length(q * vec2(1.1, 1.))) * .35;
  oColor = vec4(c, 1.);
}`;

export function createPipeline(renderer) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { count: 2, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4) });
  const rtInk = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const inkP = pass(INK, { ...U, tColor: { value: rt.textures[0] }, tInfo: { value: rt.textures[1] }, uRes: { value: new THREE.Vector2() } });
  const finP = pass(FINAL, { ...U, tColor: { value: rtInk.texture }, tInfo: { value: rt.textures[1] }, uRes: inkP.m.uniforms.uRes, uSun: { value: new THREE.Vector2() }, uRays: { value: 1 } });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // ombres maison : une caméra au soleil qui suit le joueur, une carte de profondeur
  const shadowRT = new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048) });
  const shadowCam = new THREE.OrthographicCamera(-90, 90, 90, -90, 1, 700);
  shadowCam.layers.set(1);
  const depthMat = new THREE.MeshDepthMaterial();
  U.uShadowMap.value = shadowRT.depthTexture;
  const v = new THREE.Vector3();
  return {
    setSize(w, h, dpr) { const W = Math.round(w * dpr), H = Math.round(h * dpr); rt.setSize(W, H); rtInk.setSize(W, H); inkP.m.uniforms.uRes.value.set(W, H); },
    render(scene, camera, focus, shadows) {
      if (shadows) {
        shadowCam.position.copy(focus).addScaledVector(U.uSunDir.value, 350); shadowCam.lookAt(focus); shadowCam.updateMatrixWorld();
        U.uShadowMatrix.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
        const bg = scene.background; scene.overrideMaterial = depthMat;
        renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(scene, shadowCam);
        scene.overrideMaterial = null; scene.background = bg;
      }
      U.uShadowOn.value = shadows ? 1 : 0;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(rtInk); renderer.render(inkP.s, cam);
      // où est le soleil à l'écran (il peut être hors de l'image : les rayons tombent quand même d'en haut)
      v.copy(camera.position).addScaledVector(U.uSunDir.value, 1000).project(camera);
      finP.m.uniforms.uSun.value.set(v.x * .5 + .5, v.y * .5 + .5); finP.m.uniforms.uRays.value = v.z < 1 ? 1.2 : 0;
      renderer.setRenderTarget(null); renderer.render(finP.s, cam);
    },
  };
}
