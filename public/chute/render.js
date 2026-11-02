// Rendu 3D de Chute Libre : 4 étages de dalles hexagonales (qui tremblent, craquent, tombent), personnages en forme
// de haricot avec des yeux, ombres, poussière, et un vide lumineux tout en bas. Caméra qui descend avec la partie.
import * as THREE from 'three';

const C = window.Chute;
const LAYER_COLORS = ['#5eead4', '#f472b6', '#fbbf24', '#a78bfa'];

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#2a1b4d', 40, 95);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 300);
  scene.add(new THREE.HemisphereLight('#ffe9ff', '#3b2a6b', 1.3));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
  sun.position.set(-12, 30, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // Dalles : une instance par case, couleur selon l'étage.
  const geo = new THREE.CylinderGeometry(0.93, 0.93, 0.45, 6);
  geo.translate(0, -0.225, 0);
  // Un maillage par étage : ceux au-dessus du joueur deviennent transparents pour ne pas boucher la vue.
  const PER = C.tiles.length / C.LAYERS.length;
  const meshes = C.LAYERS.map(() => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, flatShading: true, transparent: true }), PER);
    m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  });
  const base = C.tiles.map(t => new THREE.Color(LAYER_COLORS[t.layer]).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.08));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const anim = C.tiles.map(() => ({ state: 0, at: 0, rx: 0, rz: 0 }));
  const place = (k, time) => {
    const t = C.tiles[k], a = anim[k];
    let y = t.h, sc = 1;
    e.set(0, 0, 0);
    if (a.state === 1) { y += Math.sin(time * 60 + k) * 0.04; e.set(Math.sin(time * 50 + k) * 0.03, 0, Math.cos(time * 47 + k) * 0.03); }
    if (a.state === 2) {
      const dt = time - a.at;
      y -= 0.5 * 20 * dt * dt; e.set(a.rx * dt, 0, a.rz * dt);
      sc = Math.max(0, 1 - dt / 1.1);
    }
    m4.compose(v.set(t.x, y, t.y), q.setFromEuler(e), s.set(sc, sc, sc));
    const mesh = meshes[t.layer], i = k - t.layer * PER;
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, a.state === 1 ? col.copy(base[k]).lerp(new THREE.Color('#ffffff'), 0.35 + 0.35 * Math.sin(time * 25)) : base[k]);
  };
  C.tiles.forEach((_, k) => place(k, 0));

  // Le vide : une nappe lumineuse qui ondule, des étoiles, des nuages au loin.
  const voidMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vP;
      void main(){
        float w = sin(vP.x * 0.15 + uTime * 0.8) * cos(vP.y * 0.13 - uTime * 0.6) + sin(length(vP) * 0.25 - uTime * 1.5) * 0.5;
        vec3 c = mix(vec3(0.42, 0.08, 0.55), vec3(1.0, 0.35, 0.65), 0.5 + 0.5 * w);
        c *= 1.0 - smoothstep(20.0, 70.0, length(vP)) * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), voidMat);
  voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.y = C.DEATH - 4; scene.add(voidPlane);
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let k = 0; k < 600; k++) { const a = Math.random() * 6.28, r = 40 + Math.random() * 80; sp.push(Math.cos(a) * r, -30 + Math.random() * 70, Math.sin(a) * r); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff', size: 0.35, transparent: true, opacity: 0.8 })));
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffd6f5', roughness: 1, transparent: true, opacity: 0.85 });
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group(), a = k / 14 * 6.28, r = 32 + Math.random() * 14;
    for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2, 12, 10), cloudMat); b.position.set(j * 2.4 - 3.6, Math.random(), Math.random() * 2); g.add(b); }
    g.position.set(Math.cos(a) * r, -8 + Math.random() * 14, Math.sin(a) * r); g.lookAt(0, g.position.y, 0);
    scene.add(g);
  }

  // Personnages
  const people = new Map();
  const eyeW = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), eyeB = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.2 });
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function person(name, color) {
    const g = new THREE.Group(), body = new THREE.Group();
    const bean = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.45, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.35, transparent: true }));
    bean.position.y = 0.66; bean.castShadow = true; body.add(bean);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.5), roughness: 0.4 }));
    belly.scale.set(0.5, 0.9, 0.9); belly.position.set(0.28, 0.55, 0); body.add(belly);
    for (const z of [-0.15, 0.15]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), eyeW); w.position.set(0.34, 0.92, z); body.add(w);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), eyeB); b.position.set(0.45, 0.93, z); body.add(b);
    }
    g.add(body);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; scene.add(sh);
    scene.add(g);
    const p = { g, body, sh, bean, eyes: body.children.slice(2), squash: 0, lastZ: 0, vz: 0 };
    people.set(name, p);
    return p;
  }

  // Poussière quand une dalle tombe, traînée pendant la ruée
  const puffs = [], puffGeo = new THREE.SphereGeometry(0.25, 8, 6);
  const puff = (x, y, z, color) => {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.set(x, z, y); scene.add(m);
    puffs.push({ m, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, life: 0.6 });
  };

  const cam = { y: 0, x: 0, z: 0 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 45;
    camera.updateProjectionMatrix();
  }

  return {
    // tiles : chaîne d'états venue du serveur
    setTiles(str, time) {
      if (!str) return;
      for (let k = 0; k < anim.length; k++) {
        const st = +str[k];
        if (st !== anim[k].state) {
          if (st === 2) { anim[k].at = time; anim[k].rx = (Math.random() - 0.5) * 3; anim[k].rz = (Math.random() - 0.5) * 3; const t = C.tiles[k]; for (let j = 0; j < 3; j++) puff(t.x + (Math.random() - 0.5), t.y + (Math.random() - 0.5), t.h, LAYER_COLORS[t.layer]); }
          anim[k].state = st;
        }
      }
    },
    reset() { anim.forEach(a => Object.assign(a, { state: 0, at: 0 })); },
    // list : [{ name, color, x, y, z, alive, dash, dx, dy, ground }] ; focus : { x, y, z } suivi par la caméra
    update(list, focus, dt, time, state) {
      voidMat.uniforms.uTime.value = time;
      for (let k = 0; k < anim.length; k++) if (anim[k].state || time - anim[k].at < 1.2) place(k, time);
      meshes.forEach((m, l) => {
        m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
        const above = focus && C.LAYERS[l] > focus.z + 1;
        m.material.opacity += ((above ? 0.07 : 1) - m.material.opacity) * Math.min(1, dt * 5);
        m.material.depthWrite = m.material.opacity > 0.9; m.castShadow = !above;
      });
      const seen = new Set();
      for (const o of list) {
        seen.add(o.name);
        const p = people.get(o.name) ?? person(o.name, o.color);
        p.g.visible = o.z > C.DEATH - 3;
        // Au-dessus du joueur suivi : translucide, pour ne pas cacher l'action en dessous.
        const above = focus && o.z > focus.z + 3;
        p.bean.material.opacity = above ? 0.3 : 1; p.bean.material.depthWrite = !above;
        for (const e of p.eyes) e.visible = !above; p.body.children[1].visible = !above;
        // écrasement à l'atterrissage, étirement en l'air
        const vz = (o.z - p.lastZ) / Math.max(dt, 1e-3); p.lastZ = o.z;
        if (p.vz < -6 && Math.abs(vz) < 0.5) p.squash = 0.35;
        p.vz = vz;
        p.squash *= Math.exp(-dt * 10);
        const stretch = Math.min(0.25, Math.abs(vz) * 0.02);
        p.body.scale.set(1 + p.squash * 0.6 - stretch * 0.3, 1 - p.squash + stretch, 1 + p.squash * 0.6 - stretch * 0.3);
        p.g.position.set(o.x, o.z, o.y);
        const target = -Math.atan2(o.dy, o.dx);
        let d = target - p.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.g.rotation.y += d * Math.min(1, dt * 12);
        p.body.rotation.z = o.dash ? -0.5 : Math.sin(time * 14 + o.x) * 0.06 * Math.min(1, Math.hypot(o.vx || 0, o.vy || 0));
        if (o.dash && Math.random() < 0.6) puff(o.x, o.y, o.z + 0.4, o.color);
        // ombre sur la dalle en dessous
        let sh = null;
        for (let l = 0; l < C.LAYERS.length; l++) if (C.LAYERS[l] <= o.z + 0.01 && C.solid(state, l, o.x, o.y) >= 0) { sh = C.LAYERS[l]; break; }
        p.sh.visible = sh !== null && p.g.visible;
        if (sh !== null) { p.sh.position.set(o.x, sh + 0.02, o.y); const f = Math.max(0.3, 1 - (o.z - sh) * 0.12); p.sh.scale.set(f, f, f); }
      }
      for (const [n, p] of people) if (!seen.has(n)) { scene.remove(p.g, p.sh); people.delete(n); }
      for (let k = puffs.length - 1; k >= 0; k--) {
        const f = puffs[k]; f.life -= dt;
        f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
        f.m.material.opacity = Math.max(0, f.life); f.m.scale.setScalar(1 + (0.6 - f.life) * 2);
        if (f.life <= 0) { scene.remove(f.m); f.m.material.dispose(); puffs.splice(k, 1); }
      }
      // Caméra : suit le joueur (ou les survivants) et descend avec les étages.
      if (focus) {
        const k = Math.min(1, dt * 2.5);
        cam.x += (focus.x * 0.45 - cam.x) * k; cam.z += (focus.y * 0.45 - cam.z) * k;
        cam.y += (Math.max(C.LAYERS.at(-1), focus.z) - cam.y) * Math.min(1, dt * 2);
      }
      camera.position.set(cam.x, cam.y + 19, cam.z + 15);
      camera.lookAt(cam.x, cam.y - 1, cam.z);
      sun.target.position.set(cam.x, cam.y, cam.z); sun.position.set(cam.x - 12, cam.y + 30, cam.z + 10);
      renderer.render(scene, camera);
    },
    // Position à l'écran (pour les pseudos au-dessus des têtes)
    project(x, y, z) { v.set(x, z, y).project(camera); return [(v.x + 1) / 2 * canvas.clientWidth, (1 - v.y) / 2 * canvas.clientHeight, v.z < 1]; },
    resize,
  };
}
