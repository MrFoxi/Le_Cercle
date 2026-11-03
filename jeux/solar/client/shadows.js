// Éclipses et ombre des anneaux, calculées dans le shader des astres : pour chaque point éclairé,
// on regarde si une sphère (planète, lune) ou les anneaux de Saturne cachent le Soleil (à l'origine).
// Bien moins cher que de vraies ombres portées sur des distances aussi grandes.
import * as THREE from 'three';

const MAX = 4;
const GLSL = `
uniform vec4 occ[${MAX}];
uniform int occN;
uniform vec3 ringC; uniform vec3 ringN; uniform vec2 ringR; uniform float hasRing; uniform sampler2D ringMap;
varying vec3 vWPos;
float sunShadow(vec3 p) {
  vec3 d = normalize(-p);
  float s = 1.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= occN) break;
    vec3 c = occ[i].xyz; float r = occ[i].w;
    float t = dot(c - p, d);
    if (t > 0.0) s *= smoothstep(r * 0.9, r * 1.08, length(p + d * t - c)); // pénombre douce
  }
  if (hasRing > 0.5) {
    float den = dot(d, ringN);
    if (abs(den) > 1e-4) {
      float t = dot(ringC - p, ringN) / den;
      if (t > 0.0) {
        float rr = length(p + d * t - ringC);
        if (rr > ringR.x && rr < ringR.y) s *= 1.0 - 0.85 * texture2D(ringMap, vec2((rr - ringR.x) / (ringR.y - ringR.x), 0.5)).a;
      }
    }
  }
  return s;
}
`;

// Ajoute les ombres à un matériau MeshStandardMaterial. Renvoie de quoi mettre à jour les occulteurs chaque image.
export function shadowed(material, { ring = null } = {}) {
  const u = {
    occ: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) }, occN: { value: 0 },
    ringC: { value: new THREE.Vector3() }, ringN: { value: new THREE.Vector3(0, 1, 0) }, ringR: { value: new THREE.Vector2() },
    hasRing: { value: ring ? 1 : 0 }, ringMap: { value: ring?.map ?? null },
  };
  if (ring) u.ringR.value.set(ring.inner, ring.outer);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nfloat sunSh = sunShadow(vWPos);\nreflectedLight.directDiffuse *= sunSh;\nreflectedLight.directSpecular *= sunSh;');
  };
  material.customProgramCacheKey = () => `shadow${ring ? 'ring' : ''}`;
  return {
    // occluders : [{ pos, r }] ; ringFrame : { center, normal } si anneaux
    update(occluders, ringFrame) {
      u.occN.value = Math.min(MAX, occluders.length);
      occluders.slice(0, MAX).forEach((o, i) => u.occ.value[i].set(o.pos.x, o.pos.y, o.pos.z, o.r));
      if (ringFrame) { u.ringC.value.copy(ringFrame.center); u.ringN.value.copy(ringFrame.normal); }
    },
  };
}

// Même test côté JavaScript : ce point est-il à l'abri du Soleil derrière une de ces sphères ?
const d = new THREE.Vector3(), q = new THREE.Vector3();
export function inShadow(p, spheres) {
  const dist = p.length();
  if (dist === 0) return false;
  d.copy(p).multiplyScalar(-1 / dist);
  for (const s of spheres) {
    q.subVectors(s.pos, p);
    const t = q.dot(d);
    if (t > 0 && t < dist && q.addScaledVector(d, -t).length() < s.r) return true;
  }
  return false;
}
