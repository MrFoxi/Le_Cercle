// THE HOLLOW — le voyageur : une petite silhouette en long manteau sombre, vue de dos, en troisième personne.
// Il marche (ZQSD, WASD ou flèches), court (Maj), saute (Espace) ; la souris tourne la caméra (clic pour la capturer),
// la molette l'éloigne. Il ne grimpe pas les falaises. S'il tombe dans le vide, il revient à son dernier appui sûr ;
// s'il tombe dans la sortie de la strate (le gouffre), il le signale : la chute vers la strate suivante commence.
// Le voyageur ne connaît pas la strate : on la lui donne (enter), avec son relief, ses obstacles et sa sortie.
import * as THREE from 'three';
import { createVoyageur } from './voyageur.js';

const STEP_UP = 0.9, GRAV = 22, WALK = 4.2, RUN = 9, JUMP = 7.5, FLY = 40, FLY_FAST = 220, SWIM = 5.5, SWIM_FAST = 11;


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
    cam.pitch = Math.max(world?.swim ? -1 : -0.35, Math.min(1.2, cam.pitch)); // sous l'eau, on peut regarder la surface
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
  // un obstacle rond (tronc, trompette, pied de champignon, tour) : on est repoussé sur son bord, donc on glisse autour
  const pushOut = (x, z) => {
    for (const [cx, cz, r, top = Infinity] of world.colliders) {
      if (st.p.y >= top) continue;
      const dx = x - cx, dz = z - cz, m = r + 0.32, d2 = dx * dx + dz * dz;
      if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-4; x = cx + (dx / d) * m; z = cz + (dz / d) * m; }
    }
    return [x, z];
  };

  // entrer dans une strate : posé à son départ, la caméra regardant où elle le dit. arrive : il tombe du ciel de la
  // strate (après la chute), freine en ouvrant son manteau, se pose genou à terre et se relève (onLand : l'impact)
  const hero = { onLand: null };
  function enter(scene, w, arrive = false) {
    world = w; scene.add(g); g.rotation.order = 'XYZ';
    st.p.set(...w.start); st.safe.copy(st.p); st.v.set(0, 0, 0); st.ground = true; st.exit = false;
    cam.yaw = w.camYaw; cam.look.set(w.start[0], w.start[1] + 1.6, w.start[2]);
    pose();
    st.arrive = arrive ? { phase: 'air', t: 0, shake: 0 } : null;
    if (arrive && w.swim) { st.arrive = { phase: 'dive', t: 0 }; st.v.set(0, -16, 0); st.ground = false; hero.onLand?.(new THREE.Vector3(st.p.x, w.swim.surface, st.p.z), 0); } // il crève la surface
    else if (arrive) { st.p.y += 90; st.v.y = -40; st.ground = false; }
  }
  const ease = k => k * k * (3 - 2 * k), clamp01 = k => Math.max(0, Math.min(1, k));
  function arriveUpdate(dt) {
    const A = st.arrive, h = floorAt(st.p.x, st.p.z, st.p.y + 0.6), above = st.p.y - h;
    A.t += dt;
    if (A.phase === 'dive') { // sous l'eau : l'élan s'éteint, il se remet d'aplomb, manteau ouvert, puis il nage
      st.v.multiplyScalar(Math.exp(-dt * 1.6)); st.p.addScaledVector(st.v, dt);
      const up = ease(clamp01((A.t - 0.4) / 1.4));
      rig.reset(); g.position.copy(st.p); g.rotation.x = 2.6 * (1 - up) + 0.25 * up; rig.flare(0.9 - up * 0.5);
      AL.rotation.set(-2.6 * (1 - up), 0, -0.3 - up * 0.9); AR.rotation.set(-2.6 * (1 - up), 0, 0.3 + up * 0.9);
      rig.KL.rotation.x = rig.KR.rotation.x = 0.5 * up;
      rig.scarfStep(dt, 1);
      if (A.t > 2.2) { st.arrive = null; st.safe.copy(st.p); }
      return follow(dt);
    }
    if (A.phase === 'air') {
      // il tombe vite, puis le manteau s'ouvre en corolle et le freine
      const open = A.bounce ? 0.3 : clamp01((45 - above) / 25);
      st.v.y += ((-40 + open * 30) - st.v.y) * Math.min(1, dt * (1 + open * 3));
      st.p.y += st.v.y * dt;
      g.position.copy(st.p); g.rotation.set(Math.sin(A.t * 1.3) * 0.05, g.rotation.y, Math.sin(A.t * 1.7) * 0.06); // il se balance un peu sous le manteau ouvert
      torso.rotation.x = -0.2 * open; rig.flare(open * (0.9 + Math.sin(A.t * 20) * 0.08));
      AL.rotation.set(0, 0, -0.4 - open * 1.4 + Math.sin(A.t * 11) * 0.12); AR.rotation.set(0, 0, 0.4 + open * 1.4 - Math.sin(A.t * 11) * 0.12);
      L.rotation.set(-0.2 * open + Math.sin(A.t * 8) * 0.3 * (1 - open), 0, -0.15); R.rotation.set(-0.1 * open - Math.sin(A.t * 8) * 0.3 * (1 - open), 0, 0.15);
      rig.KL.rotation.x = 0.3 + 0.4 * open; rig.KR.rotation.x = 0.5;
      if (A.bounce) { const up = Math.max(0, st.v.y) / 17; L.rotation.x = R.rotation.x = -0.9 * up; rig.KL.rotation.x = rig.KR.rotation.x = 1.6 * up + 0.2; } // le rebond : genoux repliés
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
  // un geste (play) : il s'arrête et le fait. « ink » : il saisit le pinceau dans son dos, trace un grand trait, le range
  function actUpdate(dt) {
    const A = st.act; A.t += dt;
    const k = A.t, ease2 = x => ease(clamp01(x));
    rig.reset(); g.position.copy(st.p);
    if (k > 0.35 && !A.held) { rig.wield(true); A.held = true; }
    if (k > 1.6 && A.held) { rig.wield(false); A.held = false; }
    const reach = ease2(k / 0.35) - ease2((k - 0.35) / 0.25), sweep = ease2((k - 0.5) / 0.7), back = ease2((k - 1.3) / 0.3);
    // la main droite va chercher le manche par-dessus l'épaule, puis le grand geste, de haut en bas et de droite à gauche
    AR.rotation.set(-2.7 * reach + (1 - reach) * (-1.9 + sweep * 2.1) * (1 - back) * (k > 0.35 ? 1 : 0), 0, 0.1 + 0.5 * reach - sweep * 0.9 * (1 - back));
    rig.ER.rotation.x = -0.9 * reach - 0.2;
    torso.rotation.set(0.08 + sweep * 0.25 * (1 - back), 0.5 * (1 - sweep) * (k > 0.35 ? 1 : 0) - 0.35 * sweep * (1 - back), 0);
    AL.rotation.set(-0.4 * sweep * (1 - back), 0, -0.35);
    rig.crouch(0.25 * sweep * (1 - back)); R.rotation.x -= 0.25 * sweep * (1 - back);
    if (k > 1.9) { st.act = null; rig.reset(); }
    rig.scarfStep(dt);
    follow(dt);
  }
  function play(kind) { if (!st.act && !st.arrive && !st.fly) { st.act = { kind, t: 0, held: false }; st.v.set(0, 0, 0); } }
  function update(dt) {
    if (st.arrive) return arriveUpdate(dt);
    if (st.act) return actUpdate(dt);
    if (st.fly) { flyUpdate(dt); return follow(dt); }
    if (world.swim) return swimUpdate(dt);
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
    const [nx, nz] = pushOut(st.p.x + st.v.x * dt, st.p.z + st.v.z * dt);
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
  // la nage (une strate sous l'eau) : on va où regarde la caméra, Espace remonte, X descend (pas Ctrl : Ctrl+Z/W ferme
  // l'onglet dans certains navigateurs), Maj nage vite. L'eau
  // freine et porte : lâcher les touches, c'est dériver. Le fond, les toits et les tours arrêtent ; la surface aussi.
  function swimUpdate(dt) {
    const S = world.swim, t = performance.now() / 1000;
    const f = (has('KeyW', 'KeyZ', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0), s = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'KeyQ', 'ArrowLeft') ? 1 : 0);
    const u = (has('Space') ? 1 : 0) - (has('KeyX') ? 1 : 0), speed = has('ShiftLeft', 'ShiftRight') ? SWIM_FAST : SWIM;
    const pitch = (cam.pitch - 0.16) * 1.3; // caméra à sa hauteur habituelle : on nage à l'horizontale
    const want = new THREE.Vector3(-Math.sin(cam.yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(cam.yaw) * Math.cos(pitch)).multiplyScalar(f)
      .add(new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)).multiplyScalar(s)).add(new THREE.Vector3(0, u, 0));
    const moving = want.lengthSq() > 0;
    if (moving) want.normalize().multiplyScalar(speed);
    st.v.lerp(want, Math.min(1, dt * (moving ? 2.2 : 1.1)));
    if (!moving) st.v.y += Math.sin(t * 0.9) * 0.6 * dt; // il flotte
    let [x, z] = pushOut(st.p.x + st.v.x * dt, st.p.z + st.v.z * dt), y = st.p.y + st.v.y * dt;
    // les obstacles en volume (la grande poutre de roche) : des boules
    for (const [cx, cy, cz, r] of world.spheres || []) { const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.hypot(dx, dy, dz), m = r + 0.5; if (d < m) { const k = m / (d || 1e-4); x = cx + dx * k; y = cy + dy * k; z = cz + dz * k; } }
    const h = floorAt(x, z, y + 1.2);
    if (y < h + 0.4) { y = h + 0.4; st.v.y = Math.max(0, st.v.y); }
    y = Math.min(y, S.surface - 0.7);
    st.p.set(x, y, z);
    if (y < world.killY(st.safe) && world.exitAt(x, z)) st.exit = true;
    st.fade = Math.max(0, st.fade - dt * 0.8);
    // la brasse : le corps s'allonge dans le sens de la nage ; bras qui tirent, jambes qui fouettent ; au repos, il fait du sur-place
    const sp = st.v.length(), hz = Math.hypot(st.v.x, st.v.z), k = Math.min(1, sp / 3);
    if (hz > 0.5) st.yaw = Math.atan2(st.v.x, st.v.z);
    st.walk += dt * (1.3 + sp * 0.45);
    const ph = st.walk * 2, pull = Math.max(0, Math.sin(ph)), kick = Math.max(0, Math.sin(ph + 2.2)), glide = 1 - pull;
    rig.reset(); g.rotation.order = 'YXZ';
    g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 4);
    const tilt = k * (Math.PI / 2 - Math.atan2(st.v.y, hz)) + (1 - k) * 0.25;
    st.tilt = (st.tilt ?? 0) + (tilt - (st.tilt ?? 0)) * Math.min(1, dt * 3);
    g.rotation.x = st.tilt; g.position.copy(st.p); g.position.y += Math.sin(st.tilt) * 0.8;
    AL.rotation.set(k * (-2.9 + pull * 1.7) + (1 - k) * -0.4, (1 - k) * Math.sin(t * 2.2) * 0.5, k * (-0.15 - pull * 1.1) + (1 - k) * -0.95);
    AR.rotation.set(k * (-2.9 + pull * 1.7) + (1 - k) * -0.4, (1 - k) * -Math.sin(t * 2.2) * 0.5, k * (0.15 + pull * 1.1) + (1 - k) * 0.95);
    rig.EL.rotation.x = rig.ER.rotation.x = -0.2 - glide * 0.3 * k - (1 - k) * 0.6;
    const bike = (1 - k) * Math.sin(t * 2.4) * 0.35;
    L.rotation.set(-0.7 * kick * k + bike - (1 - k) * 0.2, 0, -0.45 * kick * k); R.rotation.set(-0.7 * kick * k - bike - (1 - k) * 0.2, 0, 0.45 * kick * k);
    rig.KL.rotation.x = 1.5 * kick * k + (1 - k) * (0.5 + bike); rig.KR.rotation.x = 1.5 * kick * k + (1 - k) * (0.5 - bike);
    rig.head.rotation.x = -0.9 * k * Math.sin(st.tilt);
    rig.flare(0.3 + k * 0.15 + Math.sin(t * 1.3) * 0.06); // le manteau flotte
    rig.scarfStep(dt, 1);
    follow(dt);
  }
  // la silhouette suit le voyageur ; la caméra suit, au-dessus et derrière, sans passer sous le sol (sauf en vol libre)
  function follow(dt) {
    if (st.fly) { // en vol libre : allongé, bras tendus devant, jambes derrière
      g.position.copy(st.p); g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 6);
      rig.reset(); torso.rotation.x = 1.1; L.rotation.x = R.rotation.x = 0.35; AL.rotation.set(-2.6, 0, -0.15); AR.rotation.set(-2.6, 0, 0.15); rig.flare(0.25);
    }
    if (!world?.swim || st.fly) rig.scarfStep(dt);
    cam.look.lerp(new THREE.Vector3(st.p.x, st.p.y + 1.6, st.p.z), st.fly ? 1 : 1 - Math.exp(-dt * 8));
    const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cy = cam.look.y + Math.sin(cam.pitch) * cam.dist + 1.5;
    if (!st.fly) cy = Math.max(cy, floorAt(cx, cz, cy + 1) + 1.2);
    if (world.swim) cy = Math.min(cy, world.swim.surface - 0.6); // la caméra reste sous l'eau
    camera.position.set(cx, cy, cz); camera.lookAt(cam.look.x, cam.look.y + 1.2, cam.look.z);
  }
  function setFly(on) { st.fly = on; st.v.set(0, 0, 0); if (!on) pose(); }
  return Object.assign(hero, { update, enter, pose, setFly, play, rig, state: st, cam });
}
