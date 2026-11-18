// THE HOLLOW — le voyageur : une petite silhouette en long manteau sombre, vue de dos, en troisième personne.
// Il marche (ZQSD, WASD ou flèches), court (Maj), saute (Espace) ; la souris tourne la caméra (clic pour la capturer),
// la molette l'éloigne. Il ne grimpe pas les falaises. S'il tombe dans le vide, il revient à son dernier appui sûr ;
// s'il tombe dans la sortie de la strate (le gouffre), il le signale : la chute vers la strate suivante commence.
// Le voyageur ne connaît pas la strate : on la lui donne (enter), avec son relief, ses obstacles et sa sortie.
import * as THREE from 'three';
import { createVoyageur } from './voyageur.js';

const STEP_UP = 0.9, GRAV = 22, WALK = 4.2, RUN = 9, JUMP = 7.5, FLY = 40, FLY_FAST = 220;


export function createHero(camera, dom) {
  // le dessin et le squelette (voyageur.js) : chaque membre est rattaché à son articulation
  const rig = createVoyageur(), { g, torso, L, R, AL, AR } = rig;

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
      torso.rotation.x = -0.2 * open; rig.flare(open * (0.9 + Math.sin(A.t * 20) * 0.08));
      AL.rotation.set(0, 0, -0.4 - open * 1.4 + Math.sin(A.t * 11) * 0.12); AR.rotation.set(0, 0, 0.4 + open * 1.4 - Math.sin(A.t * 11) * 0.12);
      L.rotation.set(-0.2 * open + Math.sin(A.t * 8) * 0.3 * (1 - open), 0, -0.15); R.rotation.set(-0.1 * open - Math.sin(A.t * 8) * 0.3 * (1 - open), 0, 0.15);
      rig.KL.rotation.x = 0.3 + 0.4 * open; rig.KR.rotation.x = 0.5;
      if (st.p.y <= h && world.bounces && (A.bounce ?? 0) < world.bounces.length) {
        const b = A.bounce ?? 0; A.bounce = b + 1; st.p.y = h; st.v.y = world.bounces[b]; A.t = 0; A.shake = 0.5; hero.onLand?.(st.p.clone(), A.bounce); world.onBounce?.(st.p, A.bounce);
      } else if (st.p.y <= h) { st.p.y = h; st.v.set(0, 0, 0); A.phase = 'land'; A.t = 0; A.shake = 1; hero.onLand?.(st.p.clone(), 0); world.onBounce?.(st.p, 0); }
    } else {
      // l'impact : il s'écrase en boule, genou à terre, puis se relève lentement
      const hit = Math.exp(-A.t * 9), up = ease(clamp01((A.t - 0.7) / 0.9));
      g.position.copy(st.p); g.rotation.x = 0; g.rotation.z = 0;
      rig.reset(); torso.rotation.x = 0.45 * (1 - up) + hit * 0.2;
      rig.crouch(Math.min(1, (1 - up) * 0.9 + hit * 0.3)); // genou à terre : le bassin descend, les genoux plient, les pieds restent au sol
      R.rotation.x += 0.5 * (1 - up); rig.KR.rotation.x += 0.4 * (1 - up); // une jambe en avant, l'autre en arrière
      rig.flare(hit * 0.8);
      AL.rotation.set(-0.6 * (1 - up), 0, -0.12 - 1.2 * hit - 0.4 * (1 - up)); AR.rotation.set(-0.9 * (1 - up), 0, 0.12 + 1.2 * hit + 0.3 * (1 - up));
      rig.EL.rotation.x = rig.ER.rotation.x = -0.4 * (1 - up);
      if (A.t > 1.8) { st.arrive = null; st.safe.copy(st.p); st.ground = true; pose(); }
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
    rig.scarfStep(dt);
  }
  // remettre la silhouette debout (après la chute)
  function pose() { rig.reset(); }

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
    st.walk += dt * sp * 2.3; // un pas complet (deux foulées) tous les 2,7 m environ
    g.position.copy(st.p);
    g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 10);
    rig.walk(st.walk, sp, st.ground, performance.now() / 1000);
    follow(dt);
  }
  // la silhouette suit le voyageur ; la caméra suit, au-dessus et derrière, sans passer sous le sol (sauf en vol libre)
  function follow(dt) {
    if (st.fly) { // en vol libre : allongé, bras tendus devant, jambes derrière
      g.position.copy(st.p); g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 6);
      rig.reset(); torso.rotation.x = 1.1; L.rotation.x = R.rotation.x = 0.35; AL.rotation.set(-2.6, 0, -0.15); AR.rotation.set(-2.6, 0, 0.15); rig.flare(0.25);
    }
    rig.scarfStep(dt);
    cam.look.lerp(new THREE.Vector3(st.p.x, st.p.y + 1.6, st.p.z), st.fly ? 1 : 1 - Math.exp(-dt * 8));
    const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cy = cam.look.y + Math.sin(cam.pitch) * cam.dist + 1.5;
    if (!st.fly) cy = Math.max(cy, floorAt(cx, cz, cy + 1) + 1.2);
    camera.position.set(cx, cy, cz); camera.lookAt(cam.look.x, cam.look.y + 1.2, cam.look.z);
  }
  function setFly(on) { st.fly = on; st.v.set(0, 0, 0); if (!on) pose(); }
  return Object.assign(hero, { update, enter, pose, setFly, rig, state: st, cam });
}
