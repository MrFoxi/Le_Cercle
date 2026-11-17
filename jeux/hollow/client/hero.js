// THE HOLLOW — le voyageur : une petite silhouette en long manteau sombre, vue de dos, en troisième personne.
// Il marche (ZQSD, WASD ou flèches), court (Maj), saute (Espace) ; la souris tourne la caméra (clic pour la capturer),
// la molette l'éloigne. Il ne grimpe pas les falaises : seulement les rampes. S'il tombe dans le gouffre, il revient
// à son dernier appui sûr.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrain, heightAt } from './terrain.js';
import { ink } from './ink.js';

const STEP_UP = 0.9, GRAV = 22, WALK = 4.2, RUN = 9, JUMP = 7.5;

function part(g, col) { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function body() {
  // le manteau qui s'évase, le col clair, la tête, sans visage (on le voit de dos)
  const coat = new THREE.LatheGeometry([[0.0, 0.42], [0.42, 0.42], [0.36, 0.8], [0.27, 1.25], [0.22, 1.42], [0.0, 1.45]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const collar = new THREE.TorusGeometry(0.17, 0.07, 8, 16).rotateX(Math.PI / 2).translate(0, 1.43, 0);
  const head = new THREE.SphereGeometry(0.15, 14, 10).scale(1, 1.12, 1).translate(0, 1.6, 0);
  const hair = new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, 1.6).translate(0, 1.62, -0.01);
  return mergeGeometries([part(coat, '#2b2a38'), part(collar, '#c8ccd8'), part(head, '#d8b8a0'), part(hair, '#1c1a24')].map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }));
}

export function createHero(scene, camera, dom, colliders, start) {
  const mat = ink({ line: 1 }), g = new THREE.Group();
  const torso = new THREE.Mesh(body(), mat); torso.layers.enable(1);
  const leg = () => { const m = new THREE.Mesh(part(new THREE.CapsuleGeometry(0.075, 0.38, 4, 8).translate(0, -0.22, 0), '#1c1a24'), mat); m.position.y = 0.46; m.layers.enable(1); return m; };
  const L = leg(), R = leg(); L.position.x = -0.1; R.position.x = 0.1;
  g.add(torso, L, R); scene.add(g);

  const st = { p: new THREE.Vector3(...start), v: new THREE.Vector3(), yaw: 0, ground: true, safe: new THREE.Vector3(...start), walk: 0, fade: 0 };
  // au départ, la caméra est derrière le voyageur et regarde vers le puits (la vue plonge sur les terrasses)
  const cam = { yaw: Math.atan2(start[0], start[2]), pitch: 0.16, dist: 14, look: new THREE.Vector3(...start) };
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
  // la hauteur où l'on peut poser le pied (le gouffre n'en a pas)
  const floorAt = (x, z) => { const t = terrain(x, z); return t.kind === 'void' ? -1e9 : t.h; };
  const blocked = (x, z) => colliders.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < (r + 0.3) ** 2);

  function update(dt) {
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
    const tryMove = (nx, nz) => { const h = floorAt(nx, nz); return !(st.ground && h > st.p.y + STEP_UP) && !(!st.ground && h > st.p.y + 0.2) && !blocked(nx, nz); };
    const nx = st.p.x + st.v.x * dt, nz = st.p.z + st.v.z * dt;
    if (tryMove(nx, nz)) { st.p.x = nx; st.p.z = nz; }
    else if (tryMove(nx, st.p.z)) { st.p.x = nx; st.v.z = 0; }
    else if (tryMove(st.p.x, nz)) { st.p.z = nz; st.v.x = 0; }
    else { st.v.x = st.v.z = 0; }
    // gravité, sol
    const h = floorAt(st.p.x, st.p.z);
    st.v.y -= GRAV * dt; st.p.y += st.v.y * dt;
    if (st.p.y <= h) { st.p.y = h; st.v.y = 0; st.ground = true; } else if (st.ground && st.p.y - h < 0.6 && st.v.y <= 0) { st.p.y = h; st.v.y = 0; } else st.ground = false;
    if (st.ground && h > -1e8) st.safe.copy(st.p);
    if (st.p.y < -120) { st.p.copy(st.safe); st.v.set(0, 0, 0); st.fade = 1; } // le gouffre : retour au dernier appui
    st.fade = Math.max(0, st.fade - dt * 0.8);
    // la silhouette : se tourne vers où elle va, balance les jambes, le manteau ondule
    const sp = Math.hypot(st.v.x, st.v.z);
    st.walk += dt * sp * 2.2;
    g.position.copy(st.p);
    g.rotation.y += Math.atan2(Math.sin(st.yaw - g.rotation.y), Math.cos(st.yaw - g.rotation.y)) * Math.min(1, dt * 10);
    const sw = Math.sin(st.walk) * Math.min(1, sp / 4) * 0.7;
    L.rotation.x = sw; R.rotation.x = -sw;
    torso.position.y = Math.abs(Math.cos(st.walk)) * 0.05 * Math.min(1, sp / 4);
    torso.rotation.x = Math.min(0.25, sp * 0.02) * (st.ground ? 1 : -0.5);
    torso.scale.set(1 + Math.sin(st.walk * 0.5) * 0.03 * Math.min(1, sp / 4), 1, 1);
    // la caméra suit, au-dessus et derrière ; elle ne passe pas sous le sol
    cam.look.lerp(new THREE.Vector3(st.p.x, st.p.y + 1.6, st.p.z), 1 - Math.exp(-dt * 8));
    const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cy = cam.look.y + Math.sin(cam.pitch) * cam.dist + 1.5;
    cy = Math.max(cy, heightAt(cx, cz) + 1.2);
    camera.position.set(cx, cy, cz); camera.lookAt(cam.look.x, cam.look.y + 1.2, cam.look.z);
  }
  return { update, state: st, cam };
}
