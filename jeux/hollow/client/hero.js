// THE HOLLOW — le voyageur : une petite silhouette en long manteau sombre, vue de dos, en troisième personne.
// Il marche (ZQSD, WASD ou flèches), court (Maj), saute (Espace) ; la souris tourne la caméra (clic pour la capturer),
// la molette l'éloigne. Il ne grimpe pas les falaises. S'il tombe dans le vide, il revient à son dernier appui sûr ;
// s'il tombe dans la sortie de la strate (le gouffre), il le signale : la chute vers la strate suivante commence.
// Le voyageur ne connaît pas la strate : on la lui donne (enter), avec son relief, ses obstacles et sa sortie.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ink } from './ink.js';

const STEP_UP = 0.9, GRAV = 22, WALK = 4.2, RUN = 9, JUMP = 7.5, FLY = 40, FLY_FAST = 220;

function part(g, col) { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }
function body() {
  // le manteau qui s'évase, le col clair, la tête, sans visage (on le voit de dos)
  const coat = new THREE.LatheGeometry([[0.0, 0.42], [0.42, 0.42], [0.36, 0.8], [0.27, 1.25], [0.22, 1.42], [0.0, 1.45]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const collar = new THREE.TorusGeometry(0.17, 0.07, 8, 16).rotateX(Math.PI / 2).translate(0, 1.43, 0);
  const head = new THREE.SphereGeometry(0.15, 14, 10).scale(1, 1.12, 1).translate(0, 1.6, 0);
  const hair = new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, 1.6).translate(0, 1.62, -0.01);
  return mergeGeometries([part(coat, '#2b2a38'), part(collar, '#c8ccd8'), part(head, '#d8b8a0'), part(hair, '#1c1a24')]);
}

export function createHero(camera, dom) {
  const mat = ink({ line: 1 }), g = new THREE.Group();
  const torso = new THREE.Mesh(body(), mat);
  const limb = (len, y, x, col) => { const m = new THREE.Mesh(part(new THREE.CapsuleGeometry(0.07, len, 4, 8).translate(0, -len / 2 - 0.05, 0), col), mat); m.position.set(x, y, 0); return m; };
  const L = limb(0.38, 0.46, -0.1, '#1c1a24'), R = limb(0.38, 0.46, 0.1, '#1c1a24');
  // les bras, dans les manches : ils servent surtout aux figures pendant la chute
  const AL = limb(0.42, 1.36, -0.24, '#2b2a38'), AR = limb(0.42, 1.36, 0.24, '#2b2a38');
  AL.rotation.z = -0.12; AR.rotation.z = 0.12;
  g.add(torso, L, R, AL, AR); g.traverse(o => o.layers.enable(1));
  const rig = { g, torso, L, R, AL, AR };

  // fly : le vol libre de l'administrateur (on traverse tout, sans pesanteur)
  const st = { p: new THREE.Vector3(), v: new THREE.Vector3(), yaw: 0, ground: true, safe: new THREE.Vector3(), walk: 0, fade: 0, exit: false, fly: false };
  const cam = { yaw: 0, pitch: 0.16, dist: 14, look: new THREE.Vector3() };
  let world = null;
  const keys = new Set();
  addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  // la caméra : souris capturée (clic), ou glisser
  let drag = null;
  dom.addEventListener('click', () => dom.requestPointerLock?.());
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === dom) { cam.yaw -= e.movementX * 0.0024; cam.pitch += e.movementY * 0.0022; }
    else if (drag) { cam.yaw -= (e.clientX - drag[0]) * 0.005; cam.pitch += (e.clientY - drag[1]) * 0.004; drag = [e.clientX, e.clientY]; }
    cam.pitch = Math.max(-0.35, Math.min(1.2, cam.pitch));
  });
  dom.addEventListener('mousedown', e => (drag = [e.clientX, e.clientY]));
  addEventListener('mouseup', () => (drag = null));
  dom.addEventListener('wheel', e => { cam.dist = Math.max(4, Math.min(160, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

  const has = (...c) => c.some(k => keys.has(k));
  // la hauteur où l'on peut poser le pied (le vide n'en a pas). below : on ne regarde que les surfaces sous cette
  // hauteur (une strate à plusieurs étages, comme la Forêt et ses chapeaux, laisse passer dessous)
  const floorAt = (x, z, below = Infinity) => { const t = world.terrain(x, z, below); return t.kind === 'void' ? -1e9 : t.h; };
  // un obstacle [x, z, rayon, hauteur ?] : au-dessus de sa hauteur (sur un chapeau, par exemple), il ne gêne plus
  const blocked = (x, z) => world.colliders.some(([cx, cz, r, top = Infinity]) => st.p.y < top && (x - cx) ** 2 + (z - cz) ** 2 < (r + 0.3) ** 2);

  // entrer dans une strate : posé à son départ, la caméra regardant où elle le dit. arrive : il tombe du ciel de la
  // strate (après la chute), freine en ouvrant son manteau, se pose genou à terre et se relève (onLand : l'impact)
  const hero = { onLand: null };
  function enter(scene, w, arrive = false) {
    world = w; scene.add(g);
    st.p.set(...w.start); st.safe.copy(st.p); st.v.set(0, 0, 0); st.ground = true; st.exit = false;
    cam.yaw = w.camYaw; cam.look.set(w.start[0], w.start[1] + 1.6, w.start[2]);
    pose();
    st.arrive = arrive ? { phase: 'air', t: 0, shake: 0 } : null;
    if (arrive) { st.p.y += 90; st.v.y = -40; st.ground = false; }
  }
  const ease = k => k * k * (3 - 2 * k), clamp01 = k => Math.max(0, Math.min(1, k));
  function arriveUpdate(dt) {
    const A = st.arrive, h = floorAt(st.p.x, st.p.z, st.p.y + 0.6), above = st.p.y - h;
    A.t += dt;
    if (A.phase === 'air') {
      // il tombe vite, puis le manteau s'ouvre en corolle et le freine
      const open = A.bounce ? 0.3 : clamp01((45 - above) / 25);
      if (A.bounce) g.rotation.x = Math.min(1, A.t / 1.2) * Math.PI * 2;
      st.v.y += ((-40 + open * 30) - st.v.y) * Math.min(1, dt * (1 + open * 3));
      st.p.y += st.v.y * dt;
      g.position.copy(st.p); g.rotation.set(A.bounce ? g.rotation.x : 0, g.rotation.y + dt * (2.5 - open * 2), 0);
      torso.rotation.x = -0.25 * open; torso.scale.set(1 + open * 0.45 + Math.sin(A.t * 20) * 0.04 * open, 1 - open * 0.08, 1 + open * 0.45);
      AL.rotation.set(0, 0, -0.4 - open * 1.5 + Math.sin(A.t * 11) * 0.12); AR.rotation.set(0, 0, 0.4 + open * 1.5 - Math.sin(A.t * 11) * 0.12);
      L.rotation.set(0.3 * open + Math.sin(A.t * 8) * 0.3 * (1 - open), 0, -0.15); R.rotation.set(-0.2 * open - Math.sin(A.t * 8) * 0.3 * (1 - open), 0, 0.15);
      if (st.p.y <= h && world.bounces && (A.bounce ?? 0) < world.bounces.length) {
        const b = A.bounce ?? 0; A.bounce = b + 1; st.p.y = h; st.v.y = world.bounces[b]; A.t = 0; A.shake = 0.5; hero.onLand?.(st.p.clone(), A.bounce); world.onBounce?.(st.p, A.bounce);
      } else if (st.p.y <= h) { st.p.y = h; st.v.set(0, 0, 0); A.phase = 'land'; A.t = 0; A.shake = 1; hero.onLand?.(st.p.clone(), 0); world.onBounce?.(st.p, 0); }
    } else {
      // l'impact : il s'écrase en boule, genou à terre, puis se relève lentement
      const hit = Math.exp(-A.t * 9), up = ease(clamp01((A.t - 0.7) / 0.9));
      g.position.copy(st.p); g.rotation.x = 0; g.rotation.z = 0;
      torso.position.y = -0.38 * (1 - up) - hit * 0.12; torso.rotation.x = 0.45 * (1 - up);
      torso.scale.set(1 + hit * 0.35 + (1 - up) * 0.08, 1 - hit * 0.3, 1 + hit * 0.35 + (1 - up) * 0.08);
      L.rotation.set(-1.3 * (1 - up), 0, 0); R.rotation.set(1.1 * (1 - up), 0, 0); L.position.y = R.position.y = 0.46 - 0.3 * (1 - up);
      AL.rotation.set(0.6 * (1 - up), 0, -0.12 - 1.2 * hit - 0.5 * (1 - up)); AR.rotation.set(-0.9 * (1 - up), 0, 0.12 + 1.2 * hit + 0.3 * (1 - up));
      if (A.t > 1.8) { st.arrive = null; st.safe.copy(st.p); st.ground = true; pose(); L.position.y = R.position.y = 0.46; }
    }
    // la caméra : d'en dessous pendant la descente (le ciel derrière lui), puis tout près au ras du sol ; elle tremble à l'impact
    A.shake *= Math.exp(-dt * 4);
    const air = A.phase === 'air', a = cam.yaw + (air ? A.t * 0.5 : 0.5 + A.t * 0.15), d = air ? 11 : 7 + ease(clamp01(A.t / 1.8)) * 7;
    const look = new THREE.Vector3(st.p.x, st.p.y + (air ? 0.8 : 0.9), st.p.z);
    // d'en dessous seulement tant qu'il est haut dans le ciel ; près du sol ou pendant un rebond, au-dessus de lui
    const low = air && !A.bounce && above > 25;
    camera.position.set(look.x + Math.sin(a) * d, look.y + (low ? -6 : air ? 2.5 : 1.2 + A.t * 0.9), look.z + Math.cos(a) * d);
    camera.position.y = Math.max(camera.position.y, floorAt(camera.position.x, camera.position.z, st.p.y + 1) + (low ? 3 : 0.8)); // pas au ras du sol : le sol vu de trop près se raye
    camera.position.x += (Math.random() - 0.5) * A.shake * 0.8; camera.position.y += (Math.random() - 0.5) * A.shake * 0.8;
    camera.lookAt(look); cam.look.copy(look).setY(st.p.y + 1.6);
  }
  // remettre la silhouette debout (après la chute)
  function pose() { for (const o of [g, torso, L, R, AL, AR]) o.rotation.set(0, 0, 0); L.position.y = R.position.y = 0.46; AL.rotation.z = -0.12; AR.rotation.z = 0.12; torso.position.set(0, 0, 0); torso.scale.set(1, 1, 1); g.scale.set(1, 1, 1); }

  // le vol libre : on va où regarde la caméra (Espace monte, Ctrl descend, Maj : très vite)
  function flyUpdate(dt) {
    const f = (has('KeyW', 'KeyZ', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0), s = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'KeyQ', 'ArrowLeft') ? 1 : 0);
    const u = (has('Space') ? 1 : 0) - (has('ControlLeft', 'ControlRight') ? 1 : 0), speed = has('ShiftLeft', 'ShiftRight') ? FLY_FAST : FLY;
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw) * Math.cos(cam.pitch), -Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const want = fwd.multiplyScalar(f).addScaledVector(right, s).add(new THREE.Vector3(0, u, 0));
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
    st.v.lerp(want, Math.min(1, dt * 6)); st.p.addScaledVector(st.v, dt);
    if (Math.hypot(st.v.x, st.v.z) > 0.5) st.yaw = Math.atan2(st.v.x, st.v.z);
    st.ground = false; st.exit = false;
  }
  function update(dt) {
    if (st.arrive) return arriveUpdate(dt);
    if (st.fly) { flyUpdate(dt); return follow(dt); }
    // déplacement relatif à la caméra
    const f = (has('KeyW', 'KeyZ', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0), s = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'KeyQ', 'ArrowLeft') ? 1 : 0);
    const run = has('ShiftLeft', 'ShiftRight'), speed = run ? RUN : WALK;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); // devant = ce que regarde la caméra ; droite = (cos, -sin)
    let dx = fx * f + Math.cos(cam.yaw) * s, dz = fz * f - Math.sin(cam.yaw) * s; const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; st.yaw = Math.atan2(dx, dz); }
    const k = st.ground ? 1 : 0.35; // en l'air, on se dirige moins bien
    st.v.x += ((dx * speed) - st.v.x) * Math.min(1, dt * 10 * k); st.v.z += ((dz * speed) - st.v.z) * Math.min(1, dt * 10 * k);
    if (st.ground && has('Space')) { st.v.y = JUMP; st.ground = false; }
    // pas à pas : une falaise arrête, une pente se monte ; on glisse le long de l'obstacle
    const tryMove = (nx, nz) => { const h = floorAt(nx, nz, st.p.y + STEP_UP + 0.05); return !(st.ground && h > st.p.y + STEP_UP) && !(!st.ground && h > st.p.y + 0.2) && !blocked(nx, nz); };
    const nx = st.p.x + st.v.x * dt, nz = st.p.z + st.v.z * dt;
    if (tryMove(nx, nz)) { st.p.x = nx; st.p.z = nz; }
    else if (tryMove(nx, st.p.z)) { st.p.x = nx; st.v.z = 0; }
    else if (tryMove(st.p.x, nz)) { st.p.z = nz; st.v.x = 0; }
    else { st.v.x = st.v.z = 0; }
    // gravité, sol
    const h = floorAt(st.p.x, st.p.z, st.p.y + 0.6);
    st.v.y -= GRAV * dt; st.p.y += st.v.y * dt;
    const was = st.ground;
    if (st.p.y <= h) { st.p.y = h; st.v.y = 0; st.ground = true; } else if (st.ground && st.p.y - h < 0.6 && st.v.y <= 0) { st.p.y = h; st.v.y = 0; } else st.ground = false;
    // une chute trop haute (la strate le dit) ramène au dernier appui
    if (was && !st.ground) st.fallFrom = st.p.y;
    if (!was && st.ground && world.maxFall && st.fallFrom - h > world.maxFall) { st.p.copy(st.safe); st.v.set(0, 0, 0); st.fade = 1; }
    if (st.ground && h > -1e8) st.safe.copy(st.p);
    // dans le vide : la sortie de la strate fait tomber plus bas ; ailleurs, retour au dernier appui
    if (st.p.y < world.killY(st.safe)) {
      if (world.exitAt(st.p.x, st.p.z)) st.exit = true;
      else { st.p.copy(st.safe); st.v.set(0, 0, 0); st.fade = 1; }
    }
    st.fade = Math.max(0, st.fade - dt * 0.8);
    // la silhouette : se tourne vers où elle va, balance les jambes et les bras, le manteau ondule
    const sp = Math.hypot(st.v.x, st.v.z);
    st.walk += dt * sp * 2.2;
    g.position.copy(st.p);
    g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 10);
    const sw = Math.sin(st.walk) * Math.min(1, sp / 4) * 0.7;
    L.rotation.x = sw; R.rotation.x = -sw; AL.rotation.x = -sw * 0.5; AR.rotation.x = sw * 0.5;
    torso.position.y = Math.abs(Math.cos(st.walk)) * 0.05 * Math.min(1, sp / 4);
    torso.rotation.x = Math.min(0.25, sp * 0.02) * (st.ground ? 1 : -0.5);
    torso.scale.set(1 + Math.sin(st.walk * 0.5) * 0.03 * Math.min(1, sp / 4), 1, 1);
    follow(dt);
  }
  // la silhouette suit le voyageur ; la caméra suit, au-dessus et derrière, sans passer sous le sol (sauf en vol libre)
  function follow(dt) {
    if (st.fly) { g.position.copy(st.p); g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 6); torso.rotation.x = 0.5; L.rotation.x = R.rotation.x = 0.2; }
    cam.look.lerp(new THREE.Vector3(st.p.x, st.p.y + 1.6, st.p.z), st.fly ? 1 : 1 - Math.exp(-dt * 8));
    const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cy = cam.look.y + Math.sin(cam.pitch) * cam.dist + 1.5;
    if (!st.fly) cy = Math.max(cy, floorAt(cx, cz, cy + 1) + 1.2);
    camera.position.set(cx, cy, cz); camera.lookAt(cam.look.x, cam.look.y + 1.2, cam.look.z);
  }
  function setFly(on) { st.fly = on; st.v.set(0, 0, 0); if (!on) pose(); }
  return Object.assign(hero, { update, enter, pose, setFly, rig, state: st, cam });
}
