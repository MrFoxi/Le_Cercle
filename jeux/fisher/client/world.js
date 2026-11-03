// Little Fisher : le monde en 3D. Relief des îles, océan (vagues, écume, reflets), ciel, nuages, jour et nuit, météo,
// villages, phare, bouées, remous de pêche, trésors et mouettes. Le relief sert aussi aux collisions du bateau.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLANDS, SPOTS, TREASURES, FOSSE, OPEN_SEA, WORLD, VILLAGES, CAVE } from './data.js';
import { buildDecor } from './decor.js';

/* ---------------- Bruit et relief ---------------- */
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.5 + noise(x * 2.1 + 5.3, z * 2.1 + 9.1) * 0.3 + noise(x * 4.3 + 11.7, z * 4.3 + 3.2) * 0.2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Hauteur d'une île (q : 1 au centre, 0 sur le rivage, négatif au large), selon son genre.
function islandHeight(i, x, z) {
  const dx = x - i.x, dz = z - i.z, d = Math.hypot(dx, dz);
  if (d > i.r * 2.3) return -Infinity;
  const a = Math.atan2(dz, dx);
  const wob = 1 + 0.42 * (fbm(Math.cos(a) * 1.7 + i.x * 0.013, Math.sin(a) * 1.7 + i.z * 0.013) - 0.5);
  const q = 1 - d / (i.r * wob), n = fbm(x * 0.035 + 7, z * 0.035 + 3);
  if (q < 0) return -2.5 + q * 34;
  switch (i.kind) {
    case 'foret': return -2.5 + 5.5 * sstep(0, 0.13, q) + 30 * sstep(0.12, 0.85, q) * (0.55 + 0.9 * n);
    case 'tropical': return -2.5 + 4.2 * sstep(0, 0.22, q) + 11 * sstep(0.4, 0.95, q) * (0.4 + n);
    case 'roche': return -4 + 38 * sstep(0.02, 0.13, q) + 26 * sstep(0.25, 1, q) * n;
    case 'phare': return -3 + 11 * sstep(0, 0.28, q) + 5 * n * q;
    case 'volcan': return -3 + 4 * sstep(0, 0.08, q) + 62 * Math.pow(sstep(0.05, 1, q), 1.4) - (q > 0.86 ? (q - 0.86) / 0.14 * 24 : 0) + 5 * n * q; // cône et cratère
    case 'glace': return -4 + 14 * sstep(0.02, 0.12, q) + 22 * sstep(0.3, 1, q) * (0.6 + 0.6 * n);
    case 'banc': return -2.5 + 3.4 * sstep(0, 0.5, q) + 1.2 * n * q;                                    // banc de sable à fleur d'eau
    case 'mangrove': { // îlots plats découpés par des chenaux
      const ch = 1 - sstep(0.03, 0.1, Math.abs(noise(x * 0.018 + 3, z * 0.018 + 7) - 0.5));
      return -2.2 + 3.4 * sstep(0.04, 0.35, q) - ch * 4 * sstep(0, 0.2, q);
    }
    default: return -3 + 11 * sstep(0, 0.5, q) * (0.5 + 0.9 * n);
  }
}
const seabed = (x, z) => {
  const f = 1 - sstep(FOSSE.r * 0.4, FOSSE.r * 1.1, Math.hypot(x - FOSSE.x, z - FOSSE.z));
  return -16 - 10 * fbm(x * 0.004, z * 0.004) - 55 * f;
};
export function heightAt(x, z) {
  let h = seabed(x, z);
  for (const i of ISLANDS) { const v = islandHeight(i, x, z); if (v > h) h = v; }
  return h;
}

// Vagues : la même formule dans le shader de l'eau et ici (le bateau tangue dessus).
const WAVES = [[0.26, 0.075, 0.9, 0.42], [0.18, 0.12, 1.25, -0.8], [0.1, 0.23, 1.9, 1.9], [0.05, 0.47, 2.6, 2.7]]; // amplitude, nombre d'onde, vitesse, direction
export function waveAt(x, z, t, amp = 1) {
  let h = 0, dx = 0, dz = 0;
  for (const [A, k, w, ang] of WAVES) {
    const cx = Math.cos(ang), cz = Math.sin(ang), ph = (cx * x + cz * z) * k + t * w, c = Math.cos(ph) * A * k * amp;
    h += Math.sin(ph) * A * amp; dx += c * cx; dz += c * cz;
  }
  return { h, dx, dz };
}

// Petit générateur pseudo-aléatoire : le décor est le même à chaque partie.
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PAL = {
  sand: new THREE.Color('#f1dca2'), wetSand: new THREE.Color('#d8bf86'), grass: new THREE.Color('#7fbf5a'), grass2: new THREE.Color('#5d9d48'),
  forest: new THREE.Color('#3f7d43'), rock: new THREE.Color('#9a9488'), rock2: new THREE.Color('#78736a'), cliff: new THREE.Color('#b9b1a3'),
  tropic: new THREE.Color('#9bd06a'), seabed: new THREE.Color('#3f8f8a'), lagoon: new THREE.Color('#f4e6b8'),
  ash: new THREE.Color('#2e2a28'), basalt: new THREE.Color('#4a403a'), ember: new THREE.Color('#7a3a26'),
  snow: new THREE.Color('#f4f8fc'), ice: new THREE.Color('#bfe0f0'), mud: new THREE.Color('#6a6248'), mangrove: new THREE.Color('#4f7a3a'),
};
const CORALS = ['#ff8a8a', '#ffb35c', '#c27be0', '#ff6fa8', '#ffd36b'].map(c => new THREE.Color(c));

/* ---------------- Le monde ---------------- */
export function createWorld(renderer, scene, { low = false } = {}) {
  const rng = mulberry(20261103);
  const uTime = { value: 0 }; // horloge partagée par l'eau, les reflets du fond et la végétation
  let under = false;          // la caméra est sous l'eau (plongée)
  const root = new THREE.Group(); scene.add(root);
  const anim = []; // fonctions (dt, t, night) appelées à chaque image

  // Lumières
  const hemi = new THREE.HemisphereLight('#cfe9ff', '#5d7d5a', 0.9);
  const sun = new THREE.DirectionalLight('#fff3df', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 600 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2('#bfe6f5', 0.0011);

  /* ----- Relief des îles ----- */
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  // sous l'eau : le fond prend une teinte bleu-vert et des reflets de lumière dansent dessus
  groundMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'varying vec3 vWorld;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTime; varying vec3 vWorld;
      float caustic(vec2 p, float t) {
        vec2 i = p; float c = 1.0;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - 3.5 / float(n + 1));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
        }
        c = 1.17 - pow(c / 4.0, 1.4);
        return pow(abs(c), 8.0);
      }\n` + sh.fragmentShader.replace('#include <fog_fragment>', `
      float under = smoothstep(0.1, -1.2, vWorld.y);
      float c = caustic(mod(vWorld.xz * 0.22, 6.2831), uTime * 0.6);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.62, 0.9, 0.95), under * 0.55);
      gl_FragColor.rgb += vec3(0.75, 0.95, 1.0) * clamp(c, 0.0, 1.4) * under * smoothstep(-14.0, -1.5, vWorld.y) * 0.32;
      #include <fog_fragment>`);
  };
  const tmp = new THREE.Color();
  function colorAt(i, x, z, h, slope) {
    const n = noise(x * 0.15, z * 0.15);
    if (h < -0.3) { // fond : sable clair près du bord, plus sombre au large, coraux dans le lagon
      tmp.copy(PAL.seabed).lerp(i.kind === 'tropical' ? PAL.lagoon : PAL.wetSand, sstep(-11, -0.5, h));
      if (i.kind === 'tropical' && h > -7 && h < -1 && n > 0.6) tmp.lerp(CORALS[Math.floor(hash(x * 0.3, z * 0.3) * CORALS.length)], 0.75);
      return tmp;
    }
    if (i.kind === 'volcan') return tmp.copy(h < 2.5 ? PAL.ash : PAL.basalt).lerp(PAL.ember, h > 40 ? 0.6 * n : 0.15 * n);
    if (i.kind === 'glace') return h < 1.4 ? tmp.copy(PAL.rock).lerp(PAL.ice, 0.4) : slope > 1.3 ? tmp.copy(PAL.ice).lerp(PAL.snow, n * 0.4) : tmp.copy(PAL.snow).lerp(PAL.ice, n * 0.25);
    if (i.kind === 'mangrove') return tmp.copy(h < 0.6 ? PAL.mud : PAL.mangrove).lerp(PAL.grass2, n * 0.4);
    if (h < 1.6 || (i.kind === 'tropical' && h < 3.2) || i.kind === 'banc') return tmp.copy(PAL.sand).lerp(PAL.wetSand, 0.3 * n);
    if (i.kind === 'roche' || slope > 1.1) return tmp.copy(h > 12 ? PAL.cliff : PAL.rock).lerp(PAL.rock2, n * 0.6);
    if (i.kind === 'tropical') return tmp.copy(PAL.tropic).lerp(PAL.grass2, n * 0.5);
    if (i.kind === 'foret') return tmp.copy(h > 14 ? PAL.forest : PAL.grass).lerp(PAL.grass2, n * 0.6);
    return tmp.copy(PAL.grass).lerp(PAL.rock, 0.3 + n * 0.4);
  }
  for (const i of ISLANDS) {
    const size = i.r * 3.2, seg = Math.min(130, Math.round(size / 2.2)); // assez large pour que le fond visible sous l'eau ne s'arrête pas net
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + i.x, z = pos.getZ(k) + i.z;
      pos.setXYZ(k, x, Math.max(-14, heightAt(x, z)), z);
    }
    const flat = geo.toNonIndexed(); geo.dispose();
    const p = flat.attributes.position, colors = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k += 3) {
      let cx = 0, cy = 0, cz = 0, lo = Infinity, hi = -Infinity;
      for (let j = 0; j < 3; j++) { const y = p.getY(k + j); cx += p.getX(k + j); cy += y; cz += p.getZ(k + j); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      const c = colorAt(i, cx / 3, cz / 3, cy / 3, (hi - lo) / 2.2);
      for (let j = 0; j < 3; j++) colors.set([c.r, c.g, c.b], (k + j) * 3);
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    flat.computeVertexNormals();
    const mesh = new THREE.Mesh(flat, groundMat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  /* ----- Profondeur de l'eau (pour sa couleur et l'écume) ----- */
  const DN = 512, SPAN = 2600;
  const depthData = new Uint8Array(DN * DN * 4);
  for (let r = 0; r < DN; r++) for (let c = 0; c < DN; c++) {
    const x = (c + 0.5) / DN * SPAN - SPAN / 2, z = (r + 0.5) / DN * SPAN - SPAN / 2;
    const v = Math.round(Math.min(1, Math.max(0, (heightAt(x, z) + 60) / 70)) * 255);
    depthData.set([v, v, v, 255], (r * DN + c) * 4);
  }
  const depthTex = new THREE.DataTexture(depthData, DN, DN, THREE.RGBAFormat);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;

  /* ----- L'océan ----- */
  const U = {
    uTime, uDepth: { value: depthTex }, uSpan: { value: SPAN }, uSkyTop: { value: new THREE.Color() },
    uWarm: { value: new THREE.Vector3(-760, -600, 260) }, uCold: { value: new THREE.Vector3(120, -930, 380) }, uCave: { value: new THREE.Vector3(CAVE.x, CAVE.z, CAVE.r + 3) },
    uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.0011 }, uNight: { value: 0 }, uGlint: { value: 1 }, uAmp: { value: 1 },
  };
  const WAVE_GLSL = WAVES.map(([A, k, w, a]) => `wave(p, t, ${A.toFixed(3)} * uAmp, ${k.toFixed(3)}, ${w.toFixed(3)}, vec2(${Math.cos(a).toFixed(4)}, ${Math.sin(a).toFixed(4)}), h, g);`).join('\n    ');
  const waterMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      uniform float uTime, uAmp;
      varying vec3 vPos; varying vec3 vNormal;
      void wave(vec2 p, float t, float A, float k, float w, vec2 d, inout float h, inout vec2 g) {
        float ph = dot(d, p) * k + t * w;
        h += sin(ph) * A; g += cos(ph) * A * k * d;
      }
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 p = wp.xz; float t = uTime, h = 0.0; vec2 g = vec2(0.0);
        ${WAVE_GLSL}
        wp.y += h;
        vPos = wp.xyz; vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uDepth; uniform float uSpan, uTime, uFogDensity, uNight, uGlint, uAmp;
      uniform vec3 uDeep, uShallow, uSky, uSkyTop, uSunDir, uSunColor, uFogColor;
      uniform vec3 uWarm, uCold, uCave; // (x, z, rayon) : eaux tièdes du volcan, eaux froides du nord, grotte (à l'ombre)
      varying vec3 vPos; varying vec3 vNormal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        if (!gl_FrontFacing) { // vue d'en dessous, en plongée : une surface lumineuse et ondulante
          vec3 vd = normalize(vPos - cameraPosition);
          float spot = pow(max(dot(vd, uSunDir), 0.0), 8.0), rip = noise(vPos.xz * 0.6 + uTime * 0.5);
          vec3 c = mix(uShallow * (0.85 + rip * 0.35), vec3(0.9, 0.98, 1.0), spot * (1.0 - uNight * 0.7));
          float dd = length(cameraPosition - vPos);
          c = mix(c, uFogColor, 1.0 - exp(-uFogDensity * uFogDensity * dd * dd));
          gl_FragColor = vec4(c, 0.95);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        float ground = texture2D(uDepth, vPos.xz / uSpan + 0.5).r * 70.0 - 60.0;
        float depth = max(0.0, -ground);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.3, 20.0, depth));
        col = mix(col, uDeep * vec3(0.4, 0.42, 0.62), smoothstep(25.0, 60.0, depth)); // la Fosse, bleu nuit
        col = mix(col, vec3(0.42, 0.78, 0.64) * (1.0 - uNight * 0.7), (1.0 - smoothstep(uWarm.z * 0.5, uWarm.z, distance(vPos.xz, uWarm.xy))) * 0.45);
        col = mix(col, vec3(0.16, 0.38, 0.52) * (1.0 - uNight * 0.7), (1.0 - smoothstep(uCold.z * 0.4, uCold.z, distance(vPos.xz, uCold.xy))) * 0.5);
        // petites rides qui bougent
        vec2 q = vPos.xz * 0.35;
        float r1 = noise(q + uTime * 0.35) - 0.5, r2 = noise(q * 1.9 - uTime * 0.28 + 7.0) - 0.5;
        vec3 n = normalize(vNormal + vec3(r1, 0.0, r2) * 0.22);
        vec3 v = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 rsky = mix(uSky, uSkyTop, pow(max(reflect(-v, n).y, 0.0), 0.6)); // le ciel qui se reflète
        col = mix(col, rsky, clamp(fres * 0.85, 0.0, 0.85));
        // soleil (ou lune) : un reflet net et des paillettes
        vec3 rf = reflect(-v, n);
        float s = max(dot(rf, uSunDir), 0.0);
        float spark = step(0.93, noise(vPos.xz * 2.6 + uTime * 0.8)) * pow(s, 24.0);
        col += uSunColor * (pow(s, 220.0) * 3.0 + spark * 1.1) * uGlint;
        // écume : sur le rivage, et en vaguelettes qui viennent mourir sur la plage
        float shore = 1.0 - smoothstep(0.0, 1.1 + noise(vPos.xz * 0.2 + uTime * 0.2) * 1.2, depth);
        float lines = smoothstep(0.82, 0.9, sin(depth * 2.4 - uTime * 1.5 + noise(vPos.xz * 0.15) * 6.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.5, 4.5, depth));
        float crest = smoothstep(0.74, 0.8, noise(vPos.xz * 0.7 + uTime * 0.4)) * smoothstep(0.32, 0.48, vPos.y) * 0.35 * clamp(uAmp - 1.0, 0.0, 1.0); // moutons d'écume quand le vent souffle
        col = mix(col, vec3(0.96, 0.98, 1.0) * (1.0 - uNight * 0.65), clamp(max(shore, lines * 0.75) + crest, 0.0, 1.0) * 0.9);
        float cave = 1.0 - smoothstep(uCave.z * 0.85, uCave.z * 1.15, distance(vPos.xz, uCave.xy)); // dans la grotte : eau sombre, reflets turquoise des lucioles
        col = mix(col, col * 0.05 + vec3(0.004, 0.05, 0.06) * (0.7 + 0.6 * noise(vPos.xz * 0.8 + uTime)), cave);
        float dist = length(cameraPosition - vPos), fogK = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, fogK);
        // eau claire : on voit le fond là où c'est peu profond
        float alpha = mix(0.16, 1.0, smoothstep(0.0, 9.0, depth));
        alpha = max(alpha, max(clamp(max(shore, lines * 0.75), 0.0, 1.0) * 0.9, fres * 0.55));
        gl_FragColor = vec4(col, mix(mix(alpha, 1.0, cave), 1.0, fogK)); // dans la grotte, pas de fond éclairé visible
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const waterGeo = new THREE.PlaneGeometry(SPAN, SPAN, 300, 300); waterGeo.rotateX(-Math.PI / 2);
  waterMat.transparent = true; waterMat.side = THREE.DoubleSide;
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.frustumCulled = false; water.renderOrder = -1; // dessinée avant les autres objets transparents (écume, remous)
  root.add(water);

  /* ----- Ciel, étoiles, nuages ----- */
  const skyU = { uTime, uAurora: { value: 0 }, uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uSunDir, uSunColor; uniform float uNight, uCloud, uTime, uAurora; varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uTop, pow(max(d.y, 0.0), 0.55));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * (1.0 - uCloud * 0.8);
        float m = max(dot(d, -uSunDir), 0.0); // la lune, en face du soleil
        col += vec3(0.9, 0.95, 1.0) * smoothstep(0.9993, 0.9996, m) * uNight;
        vec3 c = floor(d * 260.0);
        float star = step(0.9975, hash(c)) * smoothstep(0.0, 0.25, d.y) * uNight * (1.0 - uCloud);
        col += vec3(star);
        if (uAurora > 0.01) { // aurores : des voiles verts et violets qui ondulent vers le nord
          float a = atan(d.x, -d.z), band = sin(a * 5.0 + uTime * 0.25 + sin(a * 2.3 - uTime * 0.17) * 2.4) * 0.5 + 0.5;
          float h = smoothstep(0.06, 0.3, d.y) * (1.0 - smoothstep(0.45, 0.85, d.y)) * smoothstep(-0.2, 0.6, -d.z);
          col += mix(vec3(0.15, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.2, 0.6, d.y)) * pow(band, 3.0) * h * uAurora * 0.9;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clouds = [];
  for (let k = 0; k < 46; k++) {
    const g = new THREE.Group(), n = 4 + Math.floor(rng() * 5);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(puff, cloudMat), s = 14 + rng() * 22;
      m.scale.set(s * 1.3, s * 0.75, s);
      m.position.set((j - n / 2) * 18 + rng() * 10, rng() * 8, rng() * 18 - 9);
      g.add(m);
    }
    g.position.set(rng() * 2400 - 1200, 170 + rng() * 110, rng() * 2400 - 1200);
    g.rotation.y = rng() * Math.PI;
    root.add(g); clouds.push(g);
  }

  /* ----- Décor : arbres, rochers ----- */
  const slopeAt = (x, z) => Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) + Math.abs(heightAt(x, z + 1.5) - heightAt(x, z - 1.5));
  const villageZone = [];   // emplacements réservés aux maisons (pas d'arbres dessus)
  const free = (x, z, r) => villageZone.every(v => Math.hypot(x - v.x, z - v.z) > v.r + r);
  function instanced(geo, mat, list, shadow = true) {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((it, k) => { o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); o.scale.setScalar(it.s); o.updateMatrix(); m.setMatrixAt(k, o.matrix); if (it.c) m.setColorAt(k, it.c); });
    m.castShadow = shadow; m.receiveShadow = true;
    root.add(m); return m;
  }
  const vcolor = (geo, hex) => { const c = new THREE.Color(hex), a = new Float32Array(geo.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) a.set([c.r, c.g, c.b], k); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  // Végétation qui ondule au vent : le haut des plantes bouge, le pied reste fixe.
  function sway(mat, amp, from) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
        #endif
        float sw = max(0.0, position.y - ${from.toFixed(2)}); sw *= sw;
        transformed.x += sin(uTime * 1.4 + ip.x * 0.13 + ip.z * 0.07) * ${amp.toFixed(4)} * sw;
        transformed.z += cos(uTime * 1.1 + ip.x * 0.05 + ip.z * 0.11) * ${(amp * 0.7).toFixed(4)} * sw;`);
    };
    mat.customProgramCacheKey = () => `sway${amp}${from}`;
    return mat;
  }
  const plantMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), 0.0028, 1);
  // pin : un tronc et trois étages
  const pineGeo = mergeGeometries([
    vcolor(new THREE.CylinderGeometry(0.35, 0.5, 3, 6).translate(0, 1.5, 0), '#6b4a2f'),
    vcolor(new THREE.ConeGeometry(3, 4.5, 7).translate(0, 4.2, 0), '#2f6d3a'),
    vcolor(new THREE.ConeGeometry(2.4, 3.8, 7).translate(0, 6.2, 0), '#3a8044'),
    vcolor(new THREE.ConeGeometry(1.6, 3, 7).translate(0, 8, 0), '#4a9150'),
  ]);
  // cocotier : un tronc penché et des palmes
  const palmParts = [vcolor(new THREE.CylinderGeometry(0.28, 0.42, 8, 6).translate(0, 4, 0).rotateZ(0.12), '#9b7a4f')];
  for (let k = 0; k < 7; k++) {
    const leaf = new THREE.BoxGeometry(5.2, 0.12, 1.1).translate(2.6, 0, 0);
    leaf.rotateZ(-0.38).rotateY(k / 7 * Math.PI * 2).translate(-0.95, 7.9, 0);
    palmParts.push(vcolor(leaf, k % 2 ? '#3f9a45' : '#58b04e'));
  }
  palmParts.push(vcolor(new THREE.SphereGeometry(0.45, 6, 4).translate(-0.6, 7.6, 0.3), '#6b4a2f'));
  const palmGeo = mergeGeometries(palmParts);
  const bushGeo = vcolor(new THREE.IcosahedronGeometry(1.4, 0).translate(0, 0.8, 0), '#4f9a4a');
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }); // teinte donnée par rocher

  /* ----- Villages ----- */
  const docks = [], obstacles = [], people = new Map(); // people : id d'habitant -> figurine
  const winMat = new THREE.MeshStandardMaterial({ color: '#3a3020', emissive: '#ffcf7a', emissiveIntensity: 0 });
  const bulbs = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd27a', emissiveIntensity: 0 });
  const wood = new THREE.MeshStandardMaterial({ color: '#a77b4f', roughness: 0.9, flatShading: true });
  const darkWood = new THREE.MeshStandardMaterial({ color: '#6e4d31', roughness: 0.9 });
  const lights = []; // lampes de village (allumées la nuit)
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const cyl = (r1, r2, h, mat, x, y, z, seg = 8, parent = root) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // Le rivage dans une direction : on part du centre de l'île et on avance jusqu'à l'eau.
  function shoreFrom(i, dx, dz) {
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    let d = 0; while (heightAt(i.x + dx * d, i.z + dz * d) > 0.2 && d < i.r * 2) d += 1;
    return { x: i.x + dx * d, z: i.z + dz * d, d, dx, dz };
  }
  // Ponton : des planches sur des pieux, du rivage vers le large ; renvoie le bout.
  function pier(s, len, width = 4) {
    const g = new THREE.Group(), ry = Math.atan2(s.dx, s.dz);
    g.position.set(s.x - s.dx * 6, 0, s.z - s.dz * 6); g.rotation.y = ry;
    const L = len + 6;
    box(width, 0.35, L, wood, 0, 1.5, L / 2, 0, g);
    for (let k = 0; k <= L; k += 4) for (const sx of [-1, 1]) cyl(0.25, 0.25, 5, darkWood, sx * (width / 2 - 0.2), -1, k, 6, g);
    for (let k = 8; k <= L; k += 10) { cyl(0.08, 0.08, 2.4, darkWood, width / 2 - 0.3, 2.9, k, 5, g); const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bulbs); b.position.set(width / 2 - 0.3, 4.2, k); g.add(b); }
    root.add(g);
    const end = { x: s.x + s.dx * len, z: s.z + s.dz * len };
    obstacles.push({ ax: s.x - s.dx * 6, az: s.z - s.dz * 6, bx: end.x, bz: end.z, w: width / 2 + 0.6 });
    return { ...end, g, ry };
  }
  function figure(color, hat, x, z, face) {
    const g = new THREE.Group();
    cyl(0.45, 0.55, 1.5, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), 0, 0.75, 0, 8, g);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: '#f1c9a5' })); head.position.y = 1.85; g.add(head);
    cyl(0.5, 0.5, 0.18, new THREE.MeshStandardMaterial({ color: hat }), 0, 2.2, 0, 10, g);
    cyl(0.32, 0.38, 0.35, new THREE.MeshStandardMaterial({ color: hat }), 0, 2.4, 0, 10, g);
    g.position.set(x, 1.7, z); g.rotation.y = face;
    g.traverse(o => (o.castShadow = true));
    root.add(g); return g;
  }
  function house(x, z, ry, rnd, style) {
    const y = heightAt(x, z), g = new THREE.Group();
    g.position.set(x, y - 0.4, z); g.rotation.y = ry;
    const w = 6 + rnd() * 3, d = 5 + rnd() * 2, h = 4 + rnd() * 2.5;
    const wall = new THREE.MeshStandardMaterial({ color: style.walls[Math.floor(rnd() * style.walls.length)], roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: style.roofs[Math.floor(rnd() * style.roofs.length)], roughness: 0.8, flatShading: true });
    if (style.stilts) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.25, 0.25, 4, darkWood, sx * (w / 2 - 0.4), 1, sz * (d / 2 - 0.4), 6, g); g.position.y = Math.max(y, 0) + 1.2; }
    box(w, h, d, wall, 0, h / 2, 0, 0, g);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.6, style.stilts ? 3.5 : 2.6, 4), roofMat);
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w); roof.position.y = h + (style.stilts ? 1.75 : 1.3); roof.castShadow = true; g.add(roof);
    box(1.3, 2.2, 0.15, darkWood, 0, 1.1, d / 2 + 0.05, 0, g);
    for (const sx of [-1, 1]) box(1.1, 1, 0.12, winMat, sx * w * 0.28, h * 0.62, d / 2 + 0.05, 0, g);
    if (!style.stilts && rnd() < 0.6) box(0.8, 2.2, 0.8, wall, w * 0.3, h + 1, -d * 0.15, 0, g);
    root.add(g);
    villageZone.push({ x, z, r: Math.max(w, d) * 0.75 });
  }
  const STYLES = {
    port: { walls: ['#f4efe4', '#f6e3b8', '#cfe4ef', '#f2c7a8', '#e8eedd'], roofs: ['#c4553b', '#a8452f', '#5c6b7a', '#d06a3f'] },
    corail: { walls: ['#e9d3a8', '#d9c08f', '#f1e4c4'], roofs: ['#c99a4a', '#b8873e', '#d7ad5c'], stilts: true },
    station: { walls: ['#c8423a', '#e8e8e8', '#f2c14e'], roofs: ['#5c6b7a', '#7a8a96'] },
    heron: { walls: ['#8a6a4a', '#a8845a', '#b8946a'], roofs: ['#9a8a4a', '#b8a050'], stilts: true },
  };
  for (const i of ISLANDS.filter(i => i.dock)) {
    const v = VILLAGES[i.village], s = shoreFrom(i, i.dock[0], i.dock[1]);
    const end = pier(s, i.village === 'phare' ? 16 : 26);
    // le bateau accoste sur le côté du bout du ponton
    const side = { x: -s.dz, z: s.dx };
    docks.push({ village: i.village, name: v.name, island: i.id, x: end.x + side.x * 7 - s.dx * 3, z: end.z + side.z * 7 - s.dz * 3, heading: Math.atan2(s.dx, s.dz) }); // proue vers le large : on repart tout droit
    const r = mulberry(i.x * 7 + i.z);
    if (STYLES[i.village]) {
      const n = i.village === 'port' ? 11 : i.village === 'station' ? 4 : 6;
      for (let k = 0; k < n; k++) {
        const a = Math.atan2(s.dz, s.dx) + (k / (n - 1) - 0.5) * (i.village === 'port' ? 1.5 : 1.1) + (r() - 0.5) * 0.12;
        const inland = 9 + (k % 2) * 9 + r() * 4, cx = i.x + Math.cos(a) * (s.d - inland), cz = i.z + Math.sin(a) * (s.d - inland);
        if (heightAt(cx, cz) < 1 || !free(cx, cz, 4)) continue;
        house(cx, cz, Math.atan2(s.x - cx, s.z - cz) + (r() - 0.5) * 0.5, r, STYLES[i.village]);
      }
    }
    if (i.village === 'port') {
      // chantier naval : un hangar ouvert, une coque sur cales ; et l'étal du marché
      const a = Math.atan2(s.dz, s.dx) + 0.55, hx = i.x + Math.cos(a) * (s.d - 4), hz = i.z + Math.sin(a) * (s.d - 4), hy = Math.max(0.8, heightAt(hx, hz));
      const shed = new THREE.Group(); shed.position.set(hx, hy, hz); shed.rotation.y = Math.atan2(s.dx, s.dz);
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) cyl(0.3, 0.3, 7, darkWood, sx * 5, 3.5, sz * 5, 6, shed);
      const roof = box(12, 0.4, 12, new THREE.MeshStandardMaterial({ color: '#7a8a96', roughness: 0.6 }), 0, 7.2, 0, 0, shed); roof.rotation.z = 0.08;
      const hull = box(3, 2, 8, new THREE.MeshStandardMaterial({ color: '#e6e1d4' }), 0, 2, 0, 0, shed); hull.rotation.z = 0.1;
      root.add(shed); villageZone.push({ x: hx, z: hz, r: 9 });
      const b = shoreFrom(i, Math.cos(a - 1.1), Math.sin(a - 1.1)), mx = i.x + (b.x - i.x) * 0.9, mz = i.z + (b.z - i.z) * 0.9;
      const stall = new THREE.Group(); stall.position.set(mx, Math.max(0.6, heightAt(mx, mz)), mz); stall.rotation.y = Math.atan2(b.dx, b.dz);
      box(5, 1.1, 2, wood, 0, 0.55, 0, 0, stall);
      for (const sx of [-1, 1]) cyl(0.12, 0.12, 3.2, darkWood, sx * 2.4, 1.6, -0.9, 6, stall);
      for (let k = 0; k < 5; k++) box(1, 0.12, 2.4, new THREE.MeshStandardMaterial({ color: k % 2 ? '#ffffff' : '#e8513a' }), -2 + k, 3.2, -0.2, 0, stall).rotation.x = -0.25;
      root.add(stall); villageZone.push({ x: mx, z: mz, r: 4 });
      // bateaux amarrés
      for (const k of [1, -1]) { const m = box(2.2, 1.1, 6, new THREE.MeshStandardMaterial({ color: k > 0 ? '#2f6bb0' : '#d9483b' }), end.x - side.x * 5 * k - s.dx * (12 + k * 4), 0.3, end.z - side.z * 5 * k - s.dz * (12 + k * 4), Math.atan2(s.dx, s.dz)); anim.push((dt, t) => { m.position.y = 0.3 + waveAt(m.position.x, m.position.z, t).h; m.rotation.z = Math.sin(t * 0.9 + k) * 0.05; }); }
    }
    if (i.village === 'phare') {
      // le phare, en haut du rocher
      const top = { x: i.x - i.dock[0] * 6, z: i.z - i.dock[1] * 6 }, ty = heightAt(top.x, top.z);
      const tower = new THREE.Group(); tower.position.set(top.x, ty - 0.5, top.z);
      const red = new THREE.MeshStandardMaterial({ color: '#d23b32', roughness: 0.6 }), white = new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.6 });
      for (let k = 0; k < 6; k++) cyl(3.2 - k * 0.22, 3.2 - (k + 1) * 0.22, 3.2, k % 2 ? red : white, 0, 1.6 + k * 3.2, 0, 16, tower);
      cyl(2.5, 2.5, 0.4, darkWood, 0, 19.5, 0, 16, tower);
      const lamp = cyl(1.4, 1.4, 2.4, new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffd36b', emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }), 0, 21, 0, 12, tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2, 12), red); cap.position.y = 23.2; tower.add(cap);
      // les faisceaux qui tournent la nuit
      const fadeTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
      const beamMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', alphaMap: fadeTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); // s'estompe vers le bout
      const beams = new THREE.Group(); beams.position.y = 21;
      for (const k of [0, Math.PI]) { const c = new THREE.Mesh(new THREE.ConeGeometry(9, 160, 20, 1, true).translate(0, -80, 0), beamMat); c.rotation.set(0, k, Math.PI / 2 - 0.04); beams.add(c); }
      tower.add(beams); root.add(tower);
      const keeper = new THREE.Group(); keeper.position.set(top.x + i.dock[0] * 9 + 4, Math.max(ty - 3, heightAt(top.x + i.dock[0] * 9 + 4, top.z + i.dock[1] * 9)), top.z + i.dock[1] * 9);
      box(6, 3.6, 5, white, 0, 1.8, 0, 0, keeper); const rf = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.2, 4), red); rf.rotation.y = Math.PI / 4; rf.position.y = 4.7; keeper.add(rf);
      box(1, 1, 0.12, winMat, 1.5, 2.2, 2.55, 0, keeper); root.add(keeper);
      villageZone.push({ x: top.x, z: top.z, r: 12 });
      const pl = new THREE.PointLight('#ffd27a', 0, 90, 1.5); pl.position.set(top.x, ty + 21, top.z); root.add(pl);
      anim.push((dt, t, night) => { beams.rotation.y = t * 0.8; beamMat.opacity = night * 0.16; lamp.material.emissiveIntensity = 0.4 + night * 2.6; pl.intensity = night * 120; });
    }
    // les habitants, au bout du ponton
    const folks = { port: [['joseph', '#2f5d8a', '#3b3b3b'], ['lucie', '#e8e2d0', '#d9483b'], ['gustave', '#3f5a3c', '#2b2b2b']], corail: [['ines', '#2fa7a0', '#f2c14e'], ['kai', '#f28c38', '#3f7d43']], phare: [['anselme', '#1f2a44', '#1f2a44']], station: [['lena', '#e8e8f0', '#c8423a']], heron: [['tibo', '#4f7a3a', '#c99a4a']] }[i.village] ?? [];
    folks.forEach(([id, color, hat], k) => {
      const t = 6 + k * 5, px = s.x + s.dx * t + side.x * 1.1, pz = s.z + s.dz * t + side.z * 1.1;
      const f = figure(color, hat, px, pz, Math.atan2(side.x, side.z) + Math.PI);
      people.set(id, f);
      anim.push((dt, tt) => { f.position.y = 1.7 + Math.abs(Math.sin(tt * 1.6 + k)) * 0.06; f.rotation.y = Math.atan2(side.x, side.z) + Math.PI + Math.sin(tt * 0.4 + k * 2) * 0.5; });
    });
    const lamp = new THREE.PointLight('#ffcf7a', 0, 70, 1.4); lamp.position.set(s.x - s.dx * 4, 6, s.z - s.dz * 4); root.add(lamp); lights.push(lamp);
  }

  // Arbres et rochers, une fois les villages posés
  const pines = [], palms = [], bushes = [], rocks = [], snowPines = [], mangroves = [];
  for (const i of ISLANDS) {
    const n = Math.round(i.r * i.r * (i.kind === 'foret' ? 0.05 : i.kind === 'tropical' ? 0.03 : i.kind === 'mangrove' ? 0.04 : 0.012));
    for (let k = 0; k < n * 3 && (pines.length + palms.length) < 2000; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * i.r * 1.05, x = i.x + Math.cos(a) * d, z = i.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h < (i.kind === 'mangrove' ? -0.8 : 1.2) || !free(x, z, 2.5)) continue;
      const sl = slopeAt(x, z), s = 0.75 + rng() * 0.6, c = new THREE.Color().setHSL(0.28 + rng() * 0.08, 0.45, 0.42 + rng() * 0.12);
      if (i.kind === 'foret' && h > 2.2 && sl < 3) pines.push({ x, y: h - 0.3, z, s, ry: rng() * 6, c });
      else if (i.kind === 'tropical' && sl < 2) (h < 6 || rng() < 0.4 ? palms : bushes).push({ x, y: h - 0.2, z, s, ry: rng() * 6, c });
      else if (i.kind === 'roche' && h > 25 && sl < 4 && rng() < 0.4) pines.push({ x, y: h - 0.3, z, s: s * 0.8, ry: rng() * 6, c });
      else if ((i.kind === 'rocher' || i.kind === 'phare') && rng() < 0.3) bushes.push({ x, y: h - 0.2, z, s: s * 0.8, ry: rng() * 6, c });
      else if (i.kind === 'glace' && h > 6 && sl < 2.5 && rng() < 0.35) snowPines.push({ x, y: h - 0.3, z, s: s * 0.9, ry: rng() * 6 });
      else if (i.kind === 'mangrove' && rng() < 0.7) mangroves.push({ x, y: Math.max(h, -0.4) - 0.2, z, s: 0.8 + rng() * 0.6, ry: rng() * 6 });
      if ((i.kind === 'roche' || i.kind === 'rocher' || i.kind === 'volcan' || sl > 3) && i.kind !== 'glace' && rng() < (i.kind === 'volcan' ? 0.2 : 0.35)) rocks.push({ x, y: h - 0.4, z, s: 1 + rng() * 2.5, rx: rng() * 3, ry: rng() * 3, c: new THREE.Color().setHSL(0.1, 0.07, 0.6 + rng() * 0.15) });
    }
    // rochers à fleur d'eau autour des îles rocheuses
    if (i.kind === 'roche' || i.kind === 'rocher') for (let k = 0; k < i.r * 0.4; k++) {
      const a = rng() * Math.PI * 2, s = shoreFrom(i, Math.cos(a), Math.sin(a)), d = 2 + rng() * 10;
      rocks.push({ x: s.x + s.dx * d, y: -0.8, z: s.z + s.dz * d, s: 1.2 + rng() * 2.2, rx: rng() * 3, ry: rng() * 3, c: new THREE.Color().setHSL(0.1, 0.07, 0.55 + rng() * 0.15) });
    }
  }
  instanced(pineGeo, plantMat, pines.map(p => ({ ...p, c: undefined })));
  instanced(palmGeo, plantMat, palms.map(p => ({ ...p, c: undefined })));
  instanced(bushGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9, vertexColors: false }), bushes.map(b => ({ ...b })));
  instanced(rockGeo, rockMat, rocks);
  // sapins enneigés des Glaciers ; palétuviers sur leurs racines dans la mangrove
  instanced(mergeGeometries([
    vcolor(new THREE.CylinderGeometry(0.35, 0.5, 3, 6).translate(0, 1.5, 0), '#5a4a3a'),
    vcolor(new THREE.ConeGeometry(2.8, 4.5, 7).translate(0, 4.2, 0), '#2f5a48'), vcolor(new THREE.ConeGeometry(2.9, 1.6, 7).translate(0, 5.6, 0), '#f4f8fc'),
    vcolor(new THREE.ConeGeometry(2, 3.6, 7).translate(0, 6.6, 0), '#3a6a55'), vcolor(new THREE.ConeGeometry(1.4, 2, 7).translate(0, 8.4, 0), '#f4f8fc'),
  ]), plantMat, snowPines);
  {
    const parts = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push(vcolor(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 5).translate(0, 1.3, 0).rotateZ(0.55).rotateY(a).translate(Math.cos(a) * 0.9, -0.2, Math.sin(a) * 0.9), '#6a5238')); }
    parts.push(vcolor(new THREE.CylinderGeometry(0.22, 0.3, 3, 6).translate(0, 3, 0), '#6a5238'));
    parts.push(vcolor(new THREE.IcosahedronGeometry(2.4, 0).scale(1.2, 0.75, 1.2).translate(0, 5.2, 0), '#3f7a3a'), vcolor(new THREE.IcosahedronGeometry(1.7, 0).translate(1.2, 5.9, 0.6), '#4f8a44'));
    instanced(mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g))), plantMat, mangroves); // même format pour toutes les pièces
  }
  // Herbes hautes et fleurs dans les prés
  {
    const blades = [];
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, lean = 0.18 + (k % 3) * 0.08, h = 0.55 + (k % 2) * 0.3;
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, lean, h, 0], 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute([0.22, 0.42, 0.18, 0.22, 0.42, 0.18, 0.62, 0.82, 0.38], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      blades.push(g.rotateY(a).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08));
    }
    const grassMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 0.35, 0);
    const grass = [], flowers = [], FLOWER = ['#ffffff', '#ffe066', '#ff8fb1', '#b48cff', '#ff6b5a'].map(c => new THREE.Color(c));
    const max = low ? 2500 : 9000;
    for (const i of ISLANDS) {
      if (!['foret', 'tropical', 'phare', 'rocher'].includes(i.kind)) continue;
      const n = Math.min(max - grass.length, Math.round(i.r * i.r * (i.kind === 'foret' ? 0.5 : 0.3)));
      for (let k = 0; k < n * 2 && grass.length < max; k++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * i.r * 1.05, x = i.x + Math.cos(a) * d, z = i.z + Math.sin(a) * d, h = heightAt(x, z);
        if (h < (i.kind === 'tropical' ? 3.4 : 1.8) || h > 18 || slopeAt(x, z) > 2.2 || !free(x, z, 1)) continue;
        grass.push({ x, y: h - 0.1, z, s: 0.8 + rng() * 0.8, ry: rng() * 6, c: new THREE.Color().setHSL(0.24 + rng() * 0.08, 0.5, 0.75 + rng() * 0.25) });
        if (i.kind === 'foret' && h < 13 && rng() < 0.12) flowers.push({ x: x + 0.2, y: h + 0.45, z, s: 0.8 + rng() * 0.6, c: FLOWER[Math.floor(rng() * FLOWER.length)] });
      }
    }
    instanced(mergeGeometries(blades), grassMat, grass, false);
    instanced(new THREE.IcosahedronGeometry(0.13, 0), sway(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#222222' }), 0.35, -0.6), flowers, false);
  }
  // les rochers à fleur d'eau bloquent le bateau
  for (const r of rocks) if (r.y < 0) obstacles.push({ ax: r.x, az: r.z, bx: r.x, bz: r.z, w: r.s * 0.9 });

  /* ----- Bouées : jaunes à la limite de la haute mer, violettes autour de la Fosse ----- */
  const buoyGeo = mergeGeometries([new THREE.CylinderGeometry(0.9, 1.2, 1.6, 10), new THREE.ConeGeometry(0.6, 1.6, 10).translate(0, 1.6, 0)]);
  function buoys(cx, cz, r, count, color, skip) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), lampMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 1 });
    for (let k = 0; k < count; k++) {
      const a = k / count * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (skip?.(x, z) || heightAt(x, z) > -2) continue;
      const g = new THREE.Group(), b = new THREE.Mesh(buoyGeo, mat), l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lampMat);
      b.castShadow = true; l.position.y = 2.6; g.add(b, l); g.position.set(x, 0, z); root.add(g);
      anim.push((dt, t) => { const w = waveAt(x, z, t); g.position.y = w.h - 0.2; g.rotation.set(w.dz * 3, 0, -w.dx * 3); l.visible = Math.sin(t * 3 + k) > 0; });
    }
  }
  buoys(0, 0, OPEN_SEA, 64, '#f2c14e', (x, z) => Math.hypot(x - FOSSE.x, z - FOSSE.z) < FOSSE.r + 40);
  buoys(FOSSE.x, FOSSE.z, FOSSE.r + 40, 30, '#9b6cf0');

  /* ----- Remous de pêche ----- */
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const bubbleGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const spotMeshes = SPOTS.map((s, k) => {
    const g = new THREE.Group(); g.position.set(s.x, 0.08, s.z);
    const rings = [0, 1, 2].map(j => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })); g.add(m); return m; });
    const bub = new THREE.InstancedMesh(bubbleGeo, new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.8 }), 14);
    const seeds = Array.from({ length: 14 }, () => [rng() * 6.3, rng() * 3.5, rng()]);
    g.add(bub); root.add(g);
    const o = new THREE.Object3D();
    anim.push((dt, t) => {
      g.position.y = waveAt(s.x, s.z, t).h + 0.08;
      rings.forEach((m, j) => { const p = ((t * 0.35 + j / 3 + k * 0.17) % 1); m.scale.setScalar(1 + p * 6); m.material.opacity = 0.55 * (1 - p); });
      seeds.forEach(([a, r, ph], j) => { const p = (t * 0.8 + ph) % 1; o.position.set(Math.cos(a) * r, p * 0.5, Math.sin(a) * r); o.scale.setScalar(p < 0.9 ? 1 : (1 - p) * 10); o.updateMatrix(); bub.setMatrixAt(j, o.matrix); });
      bub.instanceMatrix.needsUpdate = true;
    });
    return g;
  });

  /* ----- Trésors qui flottent ----- */
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,180,.8)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4); return new THREE.CanvasTexture(c); })();
  const treasures = new Map();
  for (const t of TREASURES) {
    const g = new THREE.Group();
    if (t.kind === 'bouteille') {
      const glass = new THREE.MeshStandardMaterial({ color: '#7fd1a0', transparent: true, opacity: 0.75, roughness: 0.1 });
      const b = cyl(0.35, 0.35, 1.4, glass, 0, 0, 0, 10, g); b.rotation.z = Math.PI / 2 - 0.2;
      const neck = cyl(0.15, 0.2, 0.6, glass, 0.95, 0.15, 0, 8, g); neck.rotation.z = Math.PI / 2 - 0.2;
      const paper = cyl(0.22, 0.22, 0.9, new THREE.MeshStandardMaterial({ color: '#f3e6c4' }), 0, 0, 0, 8, g); paper.rotation.z = Math.PI / 2 - 0.2;
    } else {
      const big = t.kind === 'coffre';
      box(big ? 1.8 : 1, big ? 1 : 0.6, big ? 1.2 : 0.8, new THREE.MeshStandardMaterial({ color: big ? '#7a4b2a' : '#8a9096', roughness: 0.7 }), 0, 0, 0, 0, g);
      box(big ? 1.9 : 1.05, 0.15, big ? 1.3 : 0.85, new THREE.MeshStandardMaterial({ color: '#e0b23c', metalness: 0.8, roughness: 0.3 }), 0, big ? 0.45 : 0.3, 0, 0, g);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: '#fff3c0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.setScalar(5); sp.position.y = 1.4; g.add(sp);
    g.position.set(t.x, 0, t.z); root.add(g); treasures.set(t.id, g);
    anim.push((dt, tt) => { if (!g.visible) return; const w = waveAt(t.x, t.z, tt); g.position.y = w.h + 0.1; g.rotation.y = tt * 0.3; sp.material.opacity = 0.55 + Math.sin(tt * 4 + t.x) * 0.35; sp.scale.setScalar(4 + Math.sin(tt * 3) * 1); });
  }

  const decor = buildDecor({ root, scene, heightAt, waveAt, shoreFrom, rng, obstacles, anim, box, cyl, uTime, low, sparkTex: () => sparkTex });

  /* ----- Mouettes ----- */
  const gullMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, flatShading: true });
  const wingGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.3, 0, 0, 0.4, 1.6, 0.1, 0], 3)); wingGeo.computeVertexNormals();
  const gulls = [];
  for (let k = 0; k < 16; k++) {
    const isl = ISLANDS[k % 4], g = new THREE.Group(), body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6).rotateX(Math.PI / 2), gullMat);
    const l = new THREE.Mesh(wingGeo, gullMat), r = new THREE.Mesh(wingGeo, gullMat); r.scale.x = -1;
    g.add(body, l, r); root.add(g);
    gulls.push({ g, l, r, isl, rad: isl.r * (0.8 + rng() * 0.9), h: 22 + rng() * 25, sp: (0.08 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1), ph: rng() * 6.3 });
  }

  /* ----- Pluie ----- */
  const RAIN = 2200, rainPos = new Float32Array(RAIN * 6);
  for (let k = 0; k < RAIN; k++) { const x = rng() * 160 - 80, y = rng() * 70, z = rng() * 160 - 80; rainPos.set([x, y, z, x - 0.15, y - 1.6, z], k * 6); }
  const rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe0ee', transparent: true, opacity: 0.5, fog: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  /* ----- Couleurs du jour ----- */
  const C = hex => new THREE.Color(hex);
  const KEYS = { // nuit, crépuscule, jour
    top: [C('#0f1f45'), C('#3d5797'), C('#3b8fe2')], horizon: [C('#2a3d70'), C('#ff9e6e'), C('#bfe8f7')],
    sun: [C('#8fa6d6'), C('#ffad6b'), C('#fff1d8')], deep: [C('#0c3050'), C('#1c4f7a'), C('#0f6390')],
    shallow: [C('#21697a'), C('#5fb9b0'), C('#45d6c5')], hemi: [C('#4a5f95'), C('#ffc9a3'), C('#d7efff')],
  };
  const blend = (key, night, dusk, out) => out.copy(KEYS[key][2]).lerp(KEYS[key][1], dusk).lerp(KEYS[key][0], night);
  const GREY = C('#8d98a3'), MIST = C('#c9d3da');
  const sunDir = new THREE.Vector3();
  const state = { night: 0, fog: 0.0011 };

  // t : heure du jour (0 à 1) ; weather : clair, nuageux, pluie, brume ; focus : le bateau (ombres, pluie autour de lui)
  function update(dt, time, t, weather, focus, camera) {
    const ang = (t - 0.27) * Math.PI * 2, e = Math.sin(ang); // lever vers 6 h 30, coucher vers 18 h 30
    sunDir.set(Math.cos(ang) * 0.8, e, 0.45).normalize();
    const night = 1 - sstep(-0.32, 0.0, e), dusk = (1 - sstep(0.05, 0.4, Math.abs(e))) * (1 - night * 0.6);
    state.night = night;
    const wet = weather === 'pluie' ? 1 : weather === 'nuageux' ? 0.45 : 0, mist = weather === 'brume' ? 1 : 0;
    const fade = c => c.lerp(GREY.clone().multiplyScalar(1 - night * 0.8), wet * 0.55).lerp(MIST.clone().multiplyScalar(1 - night * 0.75), mist * 0.6);
    fade(blend('top', night, dusk, skyU.uTop.value)); fade(blend('horizon', night, dusk, skyU.uHorizon.value));
    blend('sun', night, dusk, skyU.uSunColor.value);
    const light = night > 0.5 ? sunDir.clone().negate() : sunDir; // la nuit, la lune éclaire à l'opposé
    skyU.uSunDir.value.copy(sunDir); skyU.uNight.value = night; skyU.uCloud.value = Math.max(wet, mist);
    U.uSunDir.value.copy(light); U.uSunColor.value.copy(skyU.uSunColor.value).multiplyScalar(night > 0.5 ? 0.7 : 1); // reflet de lune
    U.uGlint.value = 1 - wet * 0.7 - mist * 0.6;
    blend('deep', night, dusk, U.uDeep.value); blend('shallow', night, dusk, U.uShallow.value);
    U.uDeep.value.lerp(GREY.clone().multiplyScalar(0.35), wet * 0.35); U.uShallow.value.lerp(GREY.clone().multiplyScalar(0.6), wet * 0.3);
    U.uSky.value.copy(skyU.uHorizon.value); U.uSkyTop.value.copy(skyU.uTop.value);
    U.uNight.value = night; U.uAmp.value = 1 + wet * 0.9; uTime.value = time;
    // brouillard : plus épais sous la pluie, dans la brume et près de la limite du monde
    const edge = sstep(WORLD - 220, WORLD + 40, Math.max(Math.abs(focus.x), Math.abs(focus.z)));
    const fog = 0.0011 + wet * 0.0012 + mist * 0.0075 + edge * 0.012;
    state.fog += (fog - state.fog) * Math.min(1, dt * 0.8);
    scene.fog.density = U.uFogDensity.value = state.fog;
    scene.fog.color.copy(skyU.uHorizon.value); U.uFogColor.value.copy(skyU.uHorizon.value);
    if (under) { // sous l'eau : un brouillard bleu-vert, on ne voit pas loin
      const c = U.uShallow.value.clone().multiplyScalar(0.5);
      scene.fog.color.copy(c); U.uFogColor.value.copy(c); scene.fog.density = U.uFogDensity.value = 0.042;
    }
    scene.background = under ? scene.fog.color : null; // le lointain se fond dans l'eau
    sky.visible = !under;
    // lumières
    sun.color.copy(skyU.uSunColor.value);
    sun.intensity = (night > 0.5 ? 0.6 : 2.6 * (1 - dusk * 0.35)) * (1 - wet * 0.55 - mist * 0.4);
    sun.position.copy(focus).addScaledVector(light, 260); sun.target.position.copy(focus);
    blend('hemi', night, dusk, hemi.color); hemi.intensity = (0.95 - night * 0.4) * (1 - wet * 0.2);
    hemi.groundColor.set(night > 0.5 ? '#18233a' : '#5d7d5a');
    winMat.emissiveIntensity = bulbs.emissiveIntensity = night * 2.2 + dusk * 0.4;
    for (const l of lights) l.intensity = night * 90;
    cloudMat.color.set(wet ? '#9aa4ae' : '#ffffff').multiplyScalar(1 - night * 0.88); cloudMat.emissiveIntensity = (0.25 + dusk * 0.2) * (1 - night);
    // ciel et pluie suivent la caméra
    sky.position.copy(camera.position);
    for (const c of clouds) { c.position.x += dt * 4; if (c.position.x > 1300) c.position.x -= 2600; }
    rain.visible = wet > 0.9 && !under;
    if (rain.visible) {
      rain.position.set(camera.position.x, camera.position.y - 30, camera.position.z);
      const p = rainGeo.attributes.position;
      for (let k = 0; k < RAIN; k++) { let y = p.getY(k * 2) - dt * 55; if (y < 0) y += 70; p.setY(k * 2, y); p.setY(k * 2 + 1, y - 1.6); }
      p.needsUpdate = true;
    }
    for (const gl of gulls) {
      const a = time * gl.sp + gl.ph, x = gl.isl.x + Math.cos(a) * gl.rad, z = gl.isl.z + Math.sin(a) * gl.rad;
      gl.g.position.set(x, gl.h + Math.sin(time + gl.ph) * 2, z);
      gl.g.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(gl.sp), Math.cos(a) * Math.sign(gl.sp));
      const f = Math.sin(time * 6 + gl.ph) * 0.5; gl.l.rotation.z = f; gl.r.rotation.z = -f;
    }
    for (const f of anim) f(dt, time, night);
    skyU.uAurora.value = night * (1 - sstep(350, 700, Math.hypot(focus.x - 120, focus.z + 930))) * (weather === 'clair' ? 1 : 0.25) * (under ? 0 : 1);
    decor.update(dt, time, night, focus, camera, under);
  }

  return {
    heightAt, waveAt, docks, obstacles, people, treasures, spots: spotMeshes, update, state, sunDir,
    hideTreasure: id => { const g = treasures.get(id); if (g) g.visible = false; },
    setUnder: on => { under = on; },
    huntSpots: decor.huntSpots, setHunt: decor.setHunt,
  };
}
