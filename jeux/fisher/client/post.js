// Little Fisher : effets d'image. Halo des lumières (soleil sur l'eau, fenêtres, phare), étalonnage chaud, vignette.
// En qualité « basse », on dessine directement, sans ces effets.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createPost(renderer, scene, camera, low) {
  if (low) return { render: () => renderer.render(scene, camera), setSize: () => {}, setMood: () => {} };
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uWarm: { value: 1 }, uNight: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uWarm, uNight; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.12);                                   // couleurs un peu plus vives
        c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.94), uWarm);          // lumière chaude le jour
        c *= mix(vec3(1.0), vec3(0.9, 0.96, 1.1), uNight);          // bleutée la nuit
        c = mix(c, smoothstep(0.0, 1.0, c), 0.18);                   // un peu de contraste
        c *= 1.0 - 0.28 * smoothstep(0.45, 0.95, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);
  return {
    render: () => composer.render(),
    setSize(w, h) { composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); },
    setMood(night) { grade.uniforms.uNight.value = night; grade.uniforms.uWarm.value = 1 - night; bloom.strength = 0.32 + night * 0.35; },
  };
}
