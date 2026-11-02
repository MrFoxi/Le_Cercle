// Rendu 3D de Sillage Néon : grille lumineuse, murs de lumière (avec leur reflet au sol), motos, explosions, halo (bloom).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MAX = 100 * 100 + 200; // une traînée par case au plus
const ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // direction -> rotation de la moto (droite, bas, gauche, haut)

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04050d');
  scene.fog = new THREE.Fog('#04050d', 120, 260);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 600);
  scene.add(new THREE.HemisphereLight('#6d7cff', '#05060f', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 0.8); key.position.set(30, 80, 40); scene.add(key);

  // Sol : grille fine dans l'arène, grande grille qui s'estompe autour, lueur à l'horizon.
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 60 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uSize, uTime; varying vec3 vW;
      float line(float v, float w){ float d = abs(fract(v) - 0.5); return smoothstep(w, 0.0, 0.5 - d); }
      void main(){
        vec2 p = vW.xz + 0.5;
        bool inside = p.x > 0.0 && p.y > 0.0 && p.x < uSize && p.y < uSize;
        float fine = max(line(p.x, 0.04), line(p.y, 0.04));
        float big = max(line(p.x / 8.0, 0.012), line(p.y / 8.0, 0.012));
        vec3 base = inside ? vec3(0.025, 0.03, 0.075) : vec3(0.012, 0.012, 0.03);
        vec3 c = base + (inside ? vec3(0.05, 0.25, 0.4) * fine * 0.28 + vec3(0.1, 0.5, 0.8) * big * 0.3 : vec3(0.3, 0.05, 0.4) * big * 0.25);
        float pulse = 0.5 + 0.5 * sin(uTime * 1.5 - length(vW.xz - uSize * 0.5) * 0.08);
        if (inside) c += vec3(0.0, 0.02, 0.05) * pulse;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // Bordure de l'arène
  const borderMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#22d3ee').multiplyScalar(1.3), toneMapped: false });
  const border = new THREE.Group(); scene.add(border);

  // Murs de lumière : un pavé fin par case, et leur reflet au sol (plus large, transparent).
  const wallMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.92 });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.1, 0.2), wallMat, MAX);
  const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowGeo = new THREE.PlaneGeometry(1, 1.4); glowGeo.rotateX(-Math.PI / 2);
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, MAX);
  for (const m of [walls, glows]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
  const segs = []; // { x0, y0, x1, y1, name, len, fade }
  const byName = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
  const draw = k => {
    const s = segs[k], len = s.cube ? 0.5 : Math.max(0.001, s.len), h = s.fade == null ? 1 : Math.max(0.001, 1 - s.fade);
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    // le segment part du centre de la case de départ et avance de « len » vers la suivante
    pos.set(s.x0 + dx * len / 2, 0.55 * h, s.y0 + dy * len / 2);
    q.setFromAxisAngle(Y, dy ? Math.PI / 2 : 0);
    walls.setMatrixAt(k, m4.compose(pos, q, scl.set(s.cube ? 0.5 : len + 0.2, h, s.cube ? 2.5 : 1)));
    pos.y = 0.02;
    glows.setMatrixAt(k, m4.compose(pos, q, scl.set(s.cube ? 0.6 : len + 0.2, 1, h)));
  };

  // Motos
  const bikes = new Map();
  function bike(name, color) {
    const g = new THREE.Group(), c = new THREE.Color(color);
    const neon = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.4), toneMapped: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.32, 0.4), new THREE.MeshStandardMaterial({ color: '#0b0f1e', roughness: 0.3, metalness: 0.8 }));
    body.position.y = 0.45; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.27, 0.06, 0.42), neon); stripe.position.y = 0.5; g.add(stripe);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.5 }));
    canopy.scale.set(1.6, 0.8, 0.9); canopy.position.set(0.1, 0.65, 0); g.add(canopy);
    for (const x of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 8, 24), neon); w.position.set(x, 0.3, 0); g.add(w); }
    const lamp = new THREE.PointLight(color, 6, 7, 2); lamp.position.set(0.3, 0.8, 0); g.add(lamp);
    scene.add(g);
    const b = { g, rot: 0, color };
    bikes.set(name, b);
    return b;
  }

  // Explosions : étincelles + anneau qui s'étend
  const bursts = [];
  function explode(x, y, color) {
    const n = 90, P = new Float32Array(n * 3), V = [];
    for (let k = 0; k < n; k++) { P.set([x, 0.6, y], k * 3); const a = Math.random() * 6.28, e = Math.random() * 1.2, v = 4 + Math.random() * 10; V.push([Math.cos(a) * v * Math.cos(e), Math.sin(e) * v, Math.sin(a) * v * Math.cos(e)]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(2), size: 0.35, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.1, y);
    scene.add(pts, ring);
    bursts.push({ pts, ring, V, t: 0 });
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.45, 0.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let size = 60, shake = 0;
  function frameCamera() {
    const c = (size - 1) / 2, w = canvas.clientWidth, h = canvas.clientHeight, portrait = w < h;
    camera.fov = portrait ? 60 : 42;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const d = size * (portrait ? 1.45 : 0.95);
    camera.position.set(c, d, c + size * (portrait ? 0.35 : 0.6));
    camera.lookAt(c, 0, c + size * 0.04);
  }

  return {
    resize() { renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); composer.setSize(canvas.clientWidth, canvas.clientHeight); bloom.resolution.set(canvas.clientWidth / 2, canvas.clientHeight / 2); frameCamera(); },
    // Nouvelle manche : grille de cette taille, plus aucune traînée.
    setArena(S) {
      size = S; floorMat.uniforms.uSize.value = S;
      segs.length = 0; walls.count = glows.count = 0; byName.clear();
      border.clear();
      for (const [x, y, w, d] of [[(S - 1) / 2, -0.75, S + 1, 0.5], [(S - 1) / 2, S - 0.25, S + 1, 0.5], [-0.75, (S - 1) / 2, 0.5, S + 1], [S - 0.25, (S - 1) / 2, 0.5, S + 1]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), borderMat); m.position.set(x, 0.3, y); border.add(m);
      }
      frameCamera();
    },
    // Segment de traînée d'une case vers sa voisine (ou petit cube si les deux sont égales).
    addSeg(name, color, x0, y0, x1, y1, len = 1) {
      if (segs.length >= MAX) return -1;
      const k = segs.length;
      segs.push({ x0, y0, x1, y1, name, len, cube: x0 === x1 && y0 === y1 });
      walls.count = glows.count = segs.length;
      col.set(color).multiplyScalar(2.2); walls.setColorAt(k, col);
      col.set(color).multiplyScalar(1.4); glows.setColorAt(k, col);
      walls.instanceColor.needsUpdate = glows.instanceColor.needsUpdate = true;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(k);
      draw(k);
      walls.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true;
      return k;
    },
    setLen(k, len) { if (segs[k] && segs[k].len !== len) { segs[k].len = len; draw(k); walls.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true; } },
    // Moto détruite : sa traînée s'affaisse et disparaît.
    clear(name) { for (const k of byName.get(name) ?? []) segs[k].fade = 0; },
    explode(x, y, color) { explode(x, y, color); shake = 1; },
    segs, // pour les tests
    // list : [{ name, color, x, y, dir, alive, boost }]
    update(list, dt, time) {
      floorMat.uniforms.uTime.value = time;
      let moved = false;
      segs.forEach((s, k) => { if (s.fade != null && s.fade < 1) { s.fade = Math.min(1, s.fade + dt * 2); draw(k); moved = true; } });
      if (moved) walls.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true;
      const seen = new Set();
      for (const o of list) {
        seen.add(o.name);
        const b = bikes.get(o.name) ?? bike(o.name, o.color);
        b.g.visible = o.alive;
        let d = ROT[o.dir] - b.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
        b.rot += d * Math.min(1, dt * 18);
        b.g.position.set(o.x, o.boost ? 0.05 + Math.sin(time * 40) * 0.03 : 0, o.y);
        b.g.rotation.y = b.rot;
      }
      for (const [n, b] of bikes) if (!seen.has(n)) { scene.remove(b.g); bikes.delete(n); }
      for (let k = bursts.length - 1; k >= 0; k--) {
        const B = bursts[k]; B.t += dt;
        const P = B.pts.geometry.attributes.position.array;
        B.V.forEach((v, j) => { v[1] -= 14 * dt; P[j * 3] += v[0] * dt; P[j * 3 + 1] = Math.max(0.05, P[j * 3 + 1] + v[1] * dt); P[j * 3 + 2] += v[2] * dt; });
        B.pts.geometry.attributes.position.needsUpdate = true;
        B.pts.material.opacity = Math.max(0, 1 - B.t / 1.2);
        B.ring.scale.setScalar(1 + B.t * 14); B.ring.material.opacity = Math.max(0, 1 - B.t * 2);
        if (B.t > 1.2) { scene.remove(B.pts, B.ring); bursts.splice(k, 1); }
      }
      shake *= Math.exp(-dt * 8);
      frameCamera();
      camera.position.x += (Math.random() - 0.5) * shake; camera.position.z += (Math.random() - 0.5) * shake;
      composer.render();
    },
    project(x, y, z) {
      pos.set(x, z, y).project(camera);
      return [(pos.x + 1) / 2 * canvas.clientWidth, (1 - pos.y) / 2 * canvas.clientHeight, pos.z < 1];
    },
  };
}
