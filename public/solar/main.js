// Solar Explorer : menus, hangar, vol en 3D à la troisième personne, autres pilotes en temps réel,
// interface (vitesse, boost, coque, mini-carte, pilotes, destination) et carte du système solaire.
/* global io */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, BODIES, STATION, KEPLER, BELT, KM, nearest, collide, zoneName } from './world.js';
import { buildShip, setThrust, Trail, MODELS, COLORS } from './ships.js';

const socket = io('/solar');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt); // lissage indépendant du nombre d'images par seconde
const V3 = THREE.Vector3;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();
const DEPART = new URLSearchParams(location.search).get('depart'); // lu avant que l'adresse devienne ?salon=CODE
const fmtKm = u => { const km = Math.max(0, u) * KM; return km >= 1e6 ? `${(km / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M km` : `${Math.round(km).toLocaleString('fr-FR')} km`; };
const fmtTime = s => (s < 60 ? `${Math.ceil(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`);
const byId = id => BODIES.find(b => b.id === id);
let state = null, launched = false, toastTimer;

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  $('#space').hidden = id !== 'space';
  if (id === 'space') resize();
}
function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}
function act(...args) { socket.emit('act', ...args, res => res?.error && toast(res.error)); }

/* ---------- Pseudo, accueil, univers ---------- */
let pseudo = store.get('se-pseudo') || store.get('bn-pseudo') || store.get('p4-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  store.set('se-pseudo', pseudo);
  entry();
};
$('#changeName').onclick = e => { e.preventDefault(); show('name'); $('#nameForm').pseudo.focus(); };
function enter(event, payload, button) {
  if (button) button.disabled = true;
  socket.emit(event, payload, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}
$('#createForm').onsubmit = e => { e.preventDefault(); enter('create', { name: pseudo, private: e.target.vis.value === 'private' }, e.submitter); };
$('#joinForm').onsubmit = e => { e.preventDefault(); enter('join', { code: e.target.code.value, name: pseudo }, e.submitter); };
$('#joinForm').code.oninput = e => (e.target.value = e.target.value.toUpperCase());
function reset() {
  store.set('se-session', null);
  state = null;
  launched = false;
  for (const name of [...remotes.keys()]) dropRemote(name);
  document.exitPointerLock?.();
  history.replaceState(null, '', location.pathname);
  entry();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-leave]')) { socket.emit('leave'); reset(); }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo }, b);
});
socket.on('closed', msg => { toast(msg); reset(); });
socket.on('session', s => { store.set('se-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('se-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('se-session', null);
      if (!state) entry();
    });
  } else if (urlCode) $('#joinForm').code.value = urlCode;
});
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><div><b>${r.players.map(esc).join(', ')}</b><small>${r.players.length} pilote${r.players.length > 1 ? 's' : ''} en vol</small></div>
    <button class="primary small" data-room="${r.code}">Rejoindre</button></li>`).join('')
    : '<li class="empty">Aucun univers public pour l’instant. Crée le tien !</li>';
});
entry();

socket.on('state', s => {
  state = s;
  syncRemotes(s.players);
  renderPilots();
  const mine = s.players.find(p => p.name === s.me);
  if (myShip.model !== mine.ship.model || myShip.color !== mine.ship.color) setMyShip(mine.ship);
  if (!launched) openHangar();
});

/* ---------- Hangar ---------- */
let choice = null, preview = null;
try { choice = JSON.parse(store.get('se-ship')); } catch { /* choix illisible */ }
function openHangar() {
  show('hangar');
  ensureWorld();
  const mine = state.players.find(p => p.name === state.me);
  if (!MODELS[choice?.model] || !COLORS.includes(choice?.color)) choice = { ...mine.ship };
  renderHangar();
  startPreview();
}
function renderHangar() {
  $('#models').innerHTML = Object.entries(MODELS).map(([k, m]) => `<button class="${choice.model === k ? 'on' : ''}" data-model="${k}"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></button>`).join('');
  $('#swatches').innerHTML = COLORS.map(c => `<button class="${choice.color === c ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Couleur ${c}"></button>`).join('');
  $('#hangarCode').textContent = state.code;
  $('#hangarPilots').textContent = `${state.players.length} pilote${state.players.length > 1 ? 's' : ''} : ${state.players.map(p => p.name).join(', ')}`;
  preview?.set(choice);
}
$('#models').onclick = e => { const b = e.target.closest('[data-model]'); if (b) { choice.model = b.dataset.model; renderHangar(); } };
$('#swatches').onclick = e => { const b = e.target.closest('[data-color]'); if (b) { choice.color = b.dataset.color; renderHangar(); } };
$('#launchBtn').onclick = () => {
  store.set('se-ship', JSON.stringify(choice));
  act('setShip', choice);
  setMyShip(choice);
  const first = !launched;
  launched = true;
  show('space');
  if (first) { spawn(); $('#help').hidden = false; setTimeout(() => ($('#help').hidden = true), 9000); }
  $('#view').requestPointerLock?.();
};
$('#hangarBtn').onclick = () => { document.exitPointerLock?.(); show('hangar'); renderHangar(); startPreview(); };

function startPreview() {
  if (!preview) {
    const canvas = $('#preview'), r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.1, 100);
    scene.add(new THREE.AmbientLight(0x9fb4ff, 0.8));
    const key = new THREE.DirectionalLight(0xfff1df, 3.2);
    key.position.set(5, 8, 4);
    const rim = new THREE.DirectionalLight(0x7cf3ff, 2.5);
    rim.position.set(-6, 2, -6);
    scene.add(key, rim);
    cam.position.set(9, 5, 14);
    cam.lookAt(0, 0, 0);
    let ship = null;
    preview = {
      set(c) {
        if (ship) scene.remove(ship);
        ship = buildShip(c.model, c.color);
        setThrust(ship, 0.5, false);
        scene.add(ship);
      },
      loop(t) {
        if ($('#hangar').hidden) return void (preview.running = false);
        requestAnimationFrame(preview.loop);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * devicePixelRatio)) { r.setPixelRatio(devicePixelRatio); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
        ship.rotation.y = t / 2600;
        ship.position.y = Math.sin(t / 900) * 0.25;
        setThrust(ship, 0.5, false);
        r.render(scene, cam);
      },
    };
  }
  preview.set(choice);
  if (!preview.running) { preview.running = true; requestAnimationFrame(preview.loop); }
}

/* ---------- Rendu de l'espace ---------- */
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 2e6);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

let world = null, worldPromise = null;
function ensureWorld() {
  worldPromise ??= buildWorld(scene, p => {
    $('#loadBar').style.width = `${Math.round(p * 100)}%`;
    $('#launchBtn').textContent = `Préparation du système solaire… ${Math.round(p * 100)} %`;
  }).then(w => {
    world = w;
    renderer.compile(scene, camera);
    $('#launchBtn').disabled = false;
    $('#launchBtn').textContent = '🚀 Décoller';
  });
  return worldPromise;
}

/* ---------- Mon vaisseau ---------- */
const me = {
  pos: new V3(), vel: new V3(), quat: new THREE.Quaternion(), yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, roll: 0,
  fwd: 0, lat: 0, vert: 0, boost: 1, boosting: false, lastBoost: 0, hull: 100, cruise: 1, heat: false, docked: false,
};
const myShip = { model: null, color: null, mesh: null, trail: null, light: new THREE.PointLight(0xffffff, 40, 40, 2) };
function setMyShip({ model, color }) {
  if (myShip.mesh) scene.remove(myShip.mesh);
  if (myShip.trail) scene.remove(myShip.trail.mesh);
  Object.assign(myShip, { model, color, mesh: buildShip(model, color), trail: new Trail(color) });
  myShip.mesh.add(myShip.light);
  myShip.light.color.set(color);
  myShip.light.position.set(0, 1, 6);
  scene.add(myShip.mesh, myShip.trail.mesh);
}

// Départ (et retour) à la station Horizon : un peu à l'écart de l'anneau, face à elle, la Terre derrière.
function spawn() {
  const earth = byId('terre'), away = STATION.pos.clone().sub(earth.pos).normalize();
  const side = new V3().crossVectors(away, new V3(0, 1, 0)).normalize();
  me.pos.copy(STATION.pos).addScaledVector(away, 330).addScaledVector(side, (Math.random() - 0.5) * 90).add(new V3(0, 40 + Math.random() * 30, 0));
  // ?depart=saturne : départ près d'un astre, côté éclairé (pratique pour tester ou montrer un lieu)
  const start = byId(DEPART);
  if (start && start !== STATION) me.pos.copy(start.pos).addScaledVector(start.pos.clone().normalize().applyAxisAngle(new V3(0, 1, 0), 2.6), (start.ringOut ?? start.r) * 2.2).add(new V3(0, (start.ringOut ?? start.r) * 0.25, 0));
  const f = (start ?? STATION).pos.clone().sub(me.pos).normalize();
  me.yaw = me.tYaw = Math.atan2(-f.x, -f.z);
  me.pitch = me.tPitch = Math.asin(f.y);
  me.vel.set(0, 0, 0);
  me.fwd = me.lat = me.vert = 0;
  me.hull = 100;
  me.boost = 1;
  myShip.trail?.reset();
  camOffset.set(0, 0, 0);
}

/* ---------- Commandes ---------- */
const keys = new Set();
const flying = () => launched && !$('#space').hidden;
const GAME_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ControlLeft', 'ControlRight', 'KeyC', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyM', 'KeyH']);
addEventListener('keydown', e => {
  if (!flying() || e.target.matches?.('input')) return;
  if (GAME_KEYS.has(e.code) || e.ctrlKey) e.preventDefault(); // Ctrl sert à descendre : pas de raccourcis du navigateur
  if (e.code === 'Escape' && mapOpen) return toggleMap(false);
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyX') { me.tYaw += Math.PI; toast('Demi-tour', true); }
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyH') $('#help').hidden = !$('#help').hidden;
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let locked = false;
const lock = () => { if (!mapOpen) view.requestPointerLock?.(); };
view.addEventListener('click', lock);
$('#lockHint').onclick = lock;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === view;
  $('#lockHint').hidden = locked || mapOpen;
});
document.addEventListener('mousemove', e => {
  if (!locked) return;
  me.tYaw -= e.movementX * 0.0022;
  me.tPitch = clamp(me.tPitch - e.movementY * 0.0022, -1.35, 1.35);
});

/* ---------- Vol ---------- */
const FWD = new V3(), RIGHT = new V3(), UP = new V3(), euler = new THREE.Euler(0, 0, 0, 'YXZ'), want = new V3(), rollQ = new THREE.Quaternion(), Z = new V3(0, 0, 1);
const BASE = 70; // vitesse de base près des astres (unités/s) ; la croisière la multiplie jusqu'à ×40 dans le vide
let shake = 0;
function fly(dt, now) {
  const k = c => keys.has(c);
  // Orientation : la souris (ou les flèches) donne un cap, le vaisseau le rejoint en douceur.
  if (k('ArrowLeft')) me.tYaw += 1.6 * dt;
  if (k('ArrowRight')) me.tYaw -= 1.6 * dt;
  if (k('ArrowUp')) me.tPitch = clamp(me.tPitch + 1.1 * dt, -1.35, 1.35);
  if (k('ArrowDown')) me.tPitch = clamp(me.tPitch - 1.1 * dt, -1.35, 1.35);
  const prevYaw = me.yaw;
  me.yaw = damp(me.yaw, me.tYaw, 6, dt);
  me.pitch = damp(me.pitch, me.tPitch, 6, dt);
  const yawRate = (me.yaw - prevYaw) / dt;
  me.quat.setFromEuler(euler.set(me.pitch, me.yaw, 0));
  FWD.set(0, 0, -1).applyQuaternion(me.quat);
  RIGHT.set(1, 0, 0).applyQuaternion(me.quat);
  UP.set(0, 1, 0).applyQuaternion(me.quat);

  // Croisière : plus on est loin de tout, plus on va vite ; on ralentit tout seul en approchant d'un astre.
  const near = nearest(me.pos);
  me.cruise = damp(me.cruise, clamp(near.dist / 150, 1, 40), 1.5, dt);
  me.boosting = (k('ShiftLeft') || k('ShiftRight')) && me.boost > 0.02 && (k('KeyW') || me.fwd > 30);
  if (me.boosting) { me.boost = Math.max(0, me.boost - dt / 4); me.lastBoost = now; } else if (now - me.lastBoost > 1200) me.boost = Math.min(1, me.boost + dt / 7);
  const max = BASE * me.cruise * (me.boosting ? 2.6 : 1);
  let target = 0, rate = 0.15; // roue libre : on garde longtemps son élan
  if (k('KeyW')) { target = max; rate = me.boosting ? 2.2 : 0.9; } else if (k('KeyS')) { target = -20; rate = 2.5; }
  if (me.fwd > max) { target = Math.min(target, max); rate = Math.max(rate, 1.2); }
  me.fwd = damp(me.fwd, target, rate, dt);
  const side = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), up = (k('Space') ? 1 : 0) - (k('ControlLeft') || k('ControlRight') || k('KeyC') ? 1 : 0);
  const slide = 45 * Math.sqrt(me.cruise);
  me.lat = damp(me.lat, side * slide, 3, dt);
  me.vert = damp(me.vert, up * slide, 3, dt);
  want.copy(FWD).multiplyScalar(me.fwd).addScaledVector(RIGHT, me.lat).addScaledVector(UP, me.vert);
  me.vel.x = damp(me.vel.x, want.x, 5, dt); // légère inertie : la trajectoire rattrape le nez
  me.vel.y = damp(me.vel.y, want.y, 5, dt);
  me.vel.z = damp(me.vel.z, want.z, 5, dt);
  me.pos.addScaledVector(me.vel, dt);

  // Collisions : astres, rochers, station, autres vaisseaux
  let impact = collide(me.pos, me.vel, 3);
  for (const r of remotes.values()) if (r.group.visible) impact = Math.max(impact, push(me.pos, me.vel, r.pos, 8));
  if (impact > 0) me.fwd = Math.min(me.fwd, Math.max(0, me.vel.dot(FWD)));
  if (impact > 20) {
    me.hull = Math.max(0, me.hull - Math.min(35, impact * 0.05));
    shake = Math.min(0.7, shake + impact / 500);
    sfx.bump(Math.min(1, impact / 300));
  }
  // Coque : réparée à la station, abîmée par les chocs et la chaleur du Soleil
  const sunDist = me.pos.length() - byId('soleil').r;
  me.heat = sunDist < 1500;
  me.docked = me.pos.distanceTo(STATION.pos) < 260;
  if (me.heat) me.hull -= dt * 7 * (1 - sunDist / 1500);
  me.hull = Math.min(100, me.hull + dt * (me.docked ? 10 : 0.4));
  if (me.hull <= 0) { toast('Vaisseau hors service : remorquage jusqu’à la station Horizon'); spawn(); }

  me.roll = damp(me.roll, clamp(-yawRate * 0.35 - (me.lat / slide) * 0.35, -0.9, 0.9), 5, dt);
  myShip.mesh.position.copy(me.pos);
  myShip.mesh.quaternion.copy(me.quat).multiply(rollQ.setFromAxisAngle(Z, me.roll));
  const thrust = clamp(me.fwd / max, 0, 1) * (k('KeyW') ? 1 : 0.4);
  setThrust(myShip.mesh, thrust, me.boosting);
  myShip.light.intensity = 25 + thrust * 40 + (me.boosting ? 60 : 0);
  return thrust;
}
const pn = new V3();
function push(p, v, c, min) {
  pn.subVectors(p, c);
  const d = pn.length();
  if (d >= min || d === 0) return 0;
  pn.multiplyScalar(1 / d);
  p.copy(c).addScaledVector(pn, min);
  const vn = v.dot(pn);
  if (vn >= 0) return 0;
  v.addScaledVector(pn, -vn * 1.5);
  return -vn;
}

/* ---------- Caméra ---------- */
// Derrière et un peu au-dessus. Le décalage est lissé dans le repère du vaisseau : pas de retard même à très grande vitesse.
const camOffset = new V3(), camWant = new V3(), camUp = new V3(0, 1, 0), look = new V3();
function updateCamera(dt) {
  const speed = me.vel.length(), extra = Math.min(6, speed / 400) + (me.boosting ? 2.5 : 0);
  camWant.set(0, 4.2 + extra * 0.25, 15 + extra).applyQuaternion(me.quat);
  if (camOffset.lengthSq() === 0) camOffset.copy(camWant);
  camOffset.set(damp(camOffset.x, camWant.x, 7, dt), damp(camOffset.y, camWant.y, 7, dt), damp(camOffset.z, camWant.z, 7, dt));
  camera.position.copy(me.pos).add(camOffset);
  shake = damp(shake, 0, 5, dt);
  if (shake > 0.01) camera.position.add(new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake));
  camUp.lerp(UP, 1 - Math.exp(-6 * dt)).normalize();
  camera.up.copy(camUp);
  camera.lookAt(look.copy(me.pos).addScaledVector(FWD, 30).addScaledVector(UP, 2));
  const fov = 68 + Math.min(12, speed / 250) + (me.boosting ? 6 : 0);
  camera.fov = damp(camera.fov, fov, 3, dt);
  camera.updateProjectionMatrix();
}

// Traits de vitesse : poussière qui défile autour de la caméra quand on va vite (sinon l'espace vide ne donne aucune sensation).
const DUST = 220, dust = Array.from({ length: DUST }, () => new V3(1e9, 0, 0));
const dustGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 6), 3));
const dustMat = new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const dustLines = new THREE.LineSegments(dustGeo, dustMat);
dustLines.frustumCulled = false;
scene.add(dustLines);
const rel = new V3(), dir = new V3();
function updateDust() {
  const speed = me.vel.length();
  dustMat.opacity = clamp((speed - 100) / 900, 0, 0.55);
  dustLines.visible = dustMat.opacity > 0;
  if (!dustLines.visible) return;
  dir.copy(me.vel).normalize();
  const len = Math.min(speed * 0.02, 40), a = dustGeo.attributes.position.array;
  dust.forEach((p, i) => {
    rel.subVectors(p, camera.position);
    if (rel.length() > 110 || rel.dot(dir) < -30) {
      p.copy(camera.position).addScaledVector(dir, 30 + Math.random() * 80).add(new V3((Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140));
    }
    a.set([p.x, p.y, p.z, p.x - dir.x * len, p.y - dir.y * len, p.z - dir.z * len], i * 6);
  });
  dustGeo.attributes.position.needsUpdate = true;
}

/* ---------- Les autres pilotes ---------- */
// Positions reçues ~15 fois par seconde ; on les affiche avec 120 ms de retard pour toujours interpoler entre deux positions connues.
const remotes = new Map();
const INTERP = 120;
function syncRemotes(players) {
  const others = players.filter(p => p.name !== state.me);
  for (const name of [...remotes.keys()]) if (!others.some(p => p.name === name)) dropRemote(name);
  for (const p of others) {
    let r = remotes.get(p.name);
    if (r && (r.model !== p.ship.model || r.color !== p.ship.color)) { dropRemote(p.name); r = null; }
    if (!r) {
      r = { name: p.name, model: p.ship.model, color: p.ship.color, group: buildShip(p.ship.model, p.ship.color), trail: new Trail(p.ship.color), snaps: [], pos: new V3(), quat: new THREE.Quaternion(), speed: 0, boost: false };
      r.group.visible = false;
      r.label = Object.assign(document.createElement('div'), { className: 'lbl pilot' });
      r.label.style.setProperty('--c', p.ship.color);
      $('#labels').append(r.label);
      scene.add(r.group, r.trail.mesh);
      remotes.set(p.name, r);
    }
    r.online = p.connected;
  }
}
function dropRemote(name) {
  const r = remotes.get(name);
  if (!r) return;
  scene.remove(r.group, r.trail.mesh);
  r.label.remove();
  remotes.delete(name);
  if (dest?.pilot === name) setDest(null);
}
socket.on('pos', (name, a) => {
  const r = remotes.get(name);
  if (!r) return;
  r.snaps.push({ t: performance.now(), p: new V3(a[0], a[1], a[2]), q: new THREE.Quaternion(a[3], a[4], a[5], a[6]), s: a[7], b: !!a[8] });
  if (r.snaps.length > 30) r.snaps.shift();
});
function updateRemotes(now) {
  const t = now - INTERP;
  for (const r of remotes.values()) {
    const s = r.snaps, last = s.at(-1);
    if (!r.online || !last || now - last.t > 6000) { r.group.visible = r.trail.mesh.visible = false; continue; }
    let i = s.length - 1;
    while (i > 0 && s[i].t > t) i--;
    const a = s[i], b = s[i + 1];
    if (b) {
      const k = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
      r.pos.lerpVectors(a.p, b.p, k);
      r.quat.slerpQuaternions(a.q, b.q, k);
    } else if (s.length > 1 && t > a.t) { // paquet en retard : on prolonge un peu le mouvement
      const p = s.at(-2), k = Math.min(t - a.t, 300) / (a.t - p.t || 1);
      r.pos.copy(a.p).addScaledVector(rel.subVectors(a.p, p.p), k);
      r.quat.copy(a.q);
    } else { r.pos.copy(a.p); r.quat.copy(a.q); }
    r.speed = (b ?? a).s;
    r.boost = (b ?? a).b;
    r.group.visible = true;
    r.group.position.copy(r.pos);
    r.group.quaternion.copy(r.quat);
    setThrust(r.group, clamp(r.speed / 250, 0.15, 1), r.boost);
  }
}
let lastSend = 0;
function sendPos(now) {
  if (now - lastSend < 66) return;
  lastSend = now;
  const p = me.pos, q = myShip.mesh.quaternion, r1 = v => Math.round(v * 10) / 10, r4 = v => Math.round(v * 1e4) / 1e4;
  socket.volatile.emit('pos', [r1(p.x), r1(p.y), r1(p.z), r4(q.x), r4(q.y), r4(q.z), r4(q.w), Math.round(me.vel.length()), me.boosting ? 1 : 0]);
}

/* ---------- Destination ---------- */
let dest = null; // { body } ou { pilot }
function destInfo() {
  if (dest?.body) { const b = byId(dest.body); return { name: b.name, pos: b.pos, reach: (b.ringOut ?? b.r) * (b.kind === 'zone' ? 1 : 2.5), color: b.color }; }
  if (dest?.pilot) { const r = remotes.get(dest.pilot); return r?.group.visible ? { name: dest.pilot, pos: r.pos, reach: 40, color: r.color, pilot: true } : null; }
  return null;
}
function setDest(d) {
  dest = d;
  renderPilots();
  if (d) toast(`Destination : ${destInfo()?.name ?? d.pilot}`, true);
}
$('#pilots').onclick = e => {
  const b = e.target.closest('[data-pilot]');
  if (!b) return;
  setDest(dest?.pilot === b.dataset.pilot ? null : { pilot: b.dataset.pilot });
};
function renderPilots() {
  if (!state) return;
  $('#pilotCount').textContent = `· ${state.players.filter(p => p.connected).length}`;
  $('#pilots').innerHTML = state.players.map(p => p.name === state.me
    ? `<li><button disabled style="--c:${p.ship.color}"><i></i><span>${esc(p.name)} (toi)</span></button></li>`
    : `<li><button class="${p.connected ? '' : 'off'} ${dest?.pilot === p.name ? 'on' : ''}" data-pilot="${esc(p.name)}" style="--c:${p.ship.color}"><i></i><span>${esc(p.name)}</span><small data-dist="${esc(p.name)}">${p.connected ? '' : 'hors ligne'}</small></button></li>`).join('');
}
$('#inviteBtn').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast(`Lien copié ! Code de l’univers : ${state.code}`, true), () => toast(`Code de l’univers : ${state.code}`, true));

/* ---------- Interface ---------- */
const proj = new V3();
// Coordonnées écran d'un point ; null s'il est derrière la caméra.
function screen(p) {
  proj.copy(p).project(camera);
  if (proj.z > 1) return null;
  return [(proj.x + 1) / 2 * innerWidth, (1 - proj.y) / 2 * innerHeight, Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05];
}
const bodyLabels = BODIES.map(b => {
  const el = Object.assign(document.createElement('div'), { className: 'lbl body' });
  el.style.setProperty('--c', b.color);
  $('#labels').append(el);
  return { b, el };
});
const place = (el, x, y) => (el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`);
let slowTick = 0;
function hud(now, dt) {
  const slow = now - slowTick > 250;
  if (slow) slowTick = now;
  // Noms des pilotes au-dessus de leur vaisseau
  for (const r of remotes.values()) {
    const sc = r.group.visible && screen(rel.copy(r.pos).addScaledVector(camera.up, 4));
    r.label.hidden = !sc || !sc[2];
    if (r.label.hidden) continue;
    place(r.label, sc[0], sc[1]);
    if (slow) {
      const d = r.pos.distanceTo(me.pos);
      r.label.innerHTML = `<b>${esc(r.name)}</b>${d > 300 ? `<small>${fmtKm(d)}</small>` : ''}`;
    }
  }
  // Noms des astres visibles de loin
  for (const { b, el } of bodyLabels) {
    const d = b.pos.distanceTo(me.pos), far = b.kind === 'moon' ? d < 6000 : b.kind === 'station' ? d < 60000 : true;
    const sc = far && d > (b.ringOut ?? b.r) * 4 && screen(rel.copy(b.pos).addScaledVector(camera.up, b.kind === 'zone' ? 0 : b.r * 1.15));
    el.hidden = !sc || !sc[2];
    if (el.hidden) continue;
    place(el, sc[0], sc[1]);
    if (slow) el.innerHTML = `${esc(b.name)}<small>${fmtKm(d - (b.kind === 'zone' ? 0 : b.r))}</small>`;
  }
  // Destination : losange sur la cible, ou flèche au bord de l'écran
  const di = destInfo(), mark = $('#destMark');
  mark.hidden = !di;
  if (di) {
    const d = di.pos.distanceTo(me.pos);
    if (!di.pilot && d < di.reach) { toast(`Arrivée : ${di.name}`, true); dest = null; renderPilots(); }
    proj.copy(di.pos).project(camera);
    let x = proj.x, y = proj.y;
    const behind = proj.z > 1;
    if (behind) { x = -x; y = -y; }
    const edge = behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.9;
    mark.classList.toggle('edge', edge);
    let sx = (x + 1) / 2 * innerWidth, sy = (1 - y) / 2 * innerHeight;
    if (edge) {
      const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((cx - 70) / Math.abs(Math.cos(ang) || 1e-6), (cy - 70) / Math.abs(Math.sin(ang) || 1e-6));
      sx = cx + Math.cos(ang) * k;
      sy = cy + Math.sin(ang) * k;
      mark.style.setProperty('--a', `${ang + Math.PI / 2}rad`);
    }
    mark.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
    if (slow) {
      mark.querySelector('b').textContent = di.name;
      mark.querySelector('small').textContent = fmtKm(d);
      const spd = me.vel.length();
      $('#hudDest').textContent = `➜ ${di.name} · ${fmtKm(d)}${spd > 20 ? ` · arrivée ~${fmtTime(d / spd)}` : ''}`;
    }
  } else if (slow) $('#hudDest').textContent = '';
  if (!slow) return;
  const speed = me.vel.length();
  $('#spd').textContent = Math.round(speed * KM).toLocaleString('fr-FR');
  $('#boostBar').style.width = `${me.boost * 100}%`;
  $('#hullBar').style.width = `${me.hull}%`;
  $('#hullBar').parentElement.classList.toggle('low', me.hull < 35);
  $('#shipState').textContent = me.docked ? '⚓ À la station · réparations' : me.heat ? '🔥 Surchauffe : éloigne-toi du Soleil !'
    : me.hull < 35 ? '⚠ Coque endommagée' : me.boosting ? '⚡ Boost' : me.cruise > 4 && speed > 300 ? '✦ Croisière' : '● Systèmes nominaux';
  $('#hudName').textContent = state?.me ?? '';
  $('#hudZone').textContent = zoneName(me.pos);
  for (const el of document.querySelectorAll('[data-dist]')) {
    const r = remotes.get(el.dataset.dist);
    if (r?.group.visible) el.textContent = fmtKm(r.pos.distanceTo(me.pos));
  }
}

/* ---------- Mini-carte (cap vers le haut) ---------- */
const mm = $('#minimap'), mctx = mm.getContext('2d');
let mmRange = 3000;
function drawMinimap(dt) {
  const S = mm.width, R = S / 2 - 8, speed = me.vel.length();
  mmRange = damp(mmRange, clamp(speed * 7, 3000, 60000), 1.5, dt);
  const k = R / mmRange, cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
  // Repère horizontal du vaisseau : droite = (cos, 0, -sin), avant = (-sin, 0, -cos)
  const toMap = p => { const x = p.x - me.pos.x, z = p.z - me.pos.z; return [x * cy - z * sy, -(-x * sy - z * cy)]; };
  mctx.clearRect(0, 0, S, S);
  mctx.save();
  mctx.translate(S / 2, S / 2);
  mctx.beginPath();
  mctx.arc(0, 0, R + 6, 0, Math.PI * 2);
  mctx.clip();
  mctx.strokeStyle = 'rgba(124,243,255,.15)';
  mctx.lineWidth = 1;
  for (const f of [0.5, 1]) { mctx.beginPath(); mctx.arc(0, 0, R * f, 0, Math.PI * 2); mctx.stroke(); }
  mctx.beginPath(); mctx.moveTo(-R, 0); mctx.lineTo(R, 0); mctx.moveTo(0, -R); mctx.lineTo(0, R); mctx.stroke();
  // Ceinture d'astéroïdes
  const [bx, by] = toMap(new V3());
  mctx.strokeStyle = 'rgba(199,179,154,.18)';
  mctx.lineWidth = Math.max(1, (BELT.outer - BELT.inner) * k);
  mctx.beginPath(); mctx.arc(bx * k, by * k, ((BELT.inner + BELT.outer) / 2) * k, 0, Math.PI * 2); mctx.stroke();
  const dot = (p, color, r, edge) => {
    let [x, y] = toMap(p);
    x *= k; y *= k;
    const d = Math.hypot(x, y);
    if (d > R) { if (!edge) return; x *= (R - 3) / d; y *= (R - 3) / d; r = Math.min(r, 3); }
    mctx.fillStyle = color;
    mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
  };
  for (const b of BODIES) {
    if (b.kind === 'zone') {
      const [x, y] = toMap(b.pos);
      mctx.setLineDash([3, 3]); mctx.strokeStyle = 'rgba(199,179,154,.6)'; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(x * k, y * k, b.r * k, 0, Math.PI * 2); mctx.stroke(); mctx.setLineDash([]);
    } else dot(b.pos, b.color, Math.max(b.kind === 'moon' ? 1.5 : 2.5, b.r * k), b.kind !== 'moon');
  }
  // Pilotes (triangles orientés selon leur cap) et destination
  const tri = (x, y, ang, color, s = 5) => {
    mctx.save(); mctx.translate(x, y); mctx.rotate(ang); mctx.fillStyle = color;
    mctx.beginPath(); mctx.moveTo(0, -s * 1.3); mctx.lineTo(s, s); mctx.lineTo(-s, s); mctx.closePath(); mctx.fill(); mctx.restore();
  };
  for (const r of remotes.values()) {
    if (!r.group.visible) continue;
    let [x, y] = toMap(r.pos);
    x *= k; y *= k;
    const d = Math.hypot(x, y);
    if (d > R) { x *= (R - 4) / d; y *= (R - 4) / d; }
    const f = new V3(0, 0, -1).applyQuaternion(r.quat), [fx, fy] = toMap(rel.copy(me.pos).add(f));
    tri(x, y, Math.atan2(fx, -fy), r.color);
  }
  const di = destInfo();
  if (di) {
    let [x, y] = toMap(di.pos);
    x *= k; y *= k;
    const d = Math.hypot(x, y);
    if (d > R) { x *= (R - 4) / d; y *= (R - 4) / d; }
    mctx.save(); mctx.translate(x, y); mctx.rotate(Math.PI / 4); mctx.strokeStyle = '#ffc94d'; mctx.lineWidth = 2; mctx.strokeRect(-4, -4, 8, 8); mctx.restore();
  }
  tri(0, 0, 0, '#ffffff', 6);
  mctx.restore();
  $('#mmRange').textContent = `Rayon ${fmtKm(mmRange)}`;
}

/* ---------- Carte du système ---------- */
let mapOpen = false, mapHover = null, mapSel = null;
const mapCanvas = $('#mapCanvas'), mapCtx = mapCanvas.getContext('2d');
const MAP_MAX = 118000;
function toggleMap(open = !mapOpen) {
  mapOpen = open;
  $('#map').hidden = !open;
  if (open) { document.exitPointerLock?.(); keys.clear(); mapSel = null; $('#mapInfo').hidden = true; }
  $('#lockHint').hidden = locked || open;
}
$('#mapBtn').onclick = () => toggleMap();
// Échelle en racine carrée : les planètes proches du Soleil restent lisibles, Neptune tient dans l'écran.
// Ce qui est près d'une planète (lunes, station, pilotes) est dessiné autour d'elle.
function mapGeom() {
  const w = mapCanvas.clientWidth, h = mapCanvas.clientHeight;
  return { w, h, cx: w * 0.46, cy: h * 0.53, R: Math.min(w * 0.42, h * 0.44) };
}
function mapXY(p, g) {
  const d = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x), rs = Math.sqrt(d / MAP_MAX) * g.R;
  return [g.cx + Math.cos(a) * rs, g.cy + Math.sin(a) * rs];
}
function mapPoint(p, g) {
  const host = BODIES.find(b => b.kind === 'planet' && b.pos !== p && p.distanceTo(b.pos) < 8000);
  if (!host) return mapXY(p, g);
  const [hx, hy] = mapXY(host.pos, g), dx = p.x - host.pos.x, dz = p.z - host.pos.z, d = Math.hypot(dx, dz) || 1, off = clamp(10 + d / 220, 12, 42);
  return [hx + (dx / d) * off, hy + (dz / d) * off];
}
function mapItems(g) {
  const items = BODIES.map(b => ({ b, xy: b.kind === 'planet' || b.kind === 'star' ? mapXY(b.pos, g) : mapPoint(b.pos, g) }));
  for (const r of remotes.values()) if (r.group.visible) items.push({ pilot: r, xy: mapPoint(r.pos, g) });
  return items;
}
function drawMap() {
  const dpr = Math.min(devicePixelRatio, 2), g = mapGeom();
  if (mapCanvas.width !== Math.round(g.w * dpr)) { mapCanvas.width = g.w * dpr; mapCanvas.height = g.h * dpr; }
  const c = mapCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, g.w, g.h);
  const ring = d => Math.sqrt(d / MAP_MAX) * g.R;
  c.strokeStyle = 'rgba(199,179,154,.12)';
  c.lineWidth = ring(BELT.outer) - ring(BELT.inner);
  c.beginPath(); c.arc(g.cx, g.cy, (ring(BELT.outer) + ring(BELT.inner)) / 2, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1;
  for (const b of BODIES) if (b.kind === 'planet') { c.strokeStyle = 'rgba(140,170,255,.13)'; c.beginPath(); c.arc(g.cx, g.cy, ring(Math.hypot(b.pos.x, b.pos.z)), 0, Math.PI * 2); c.stroke(); }
  const sun = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, 40);
  sun.addColorStop(0, 'rgba(255,220,140,.9)'); sun.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = sun; c.beginPath(); c.arc(g.cx, g.cy, 40, 0, Math.PI * 2); c.fill();
  const items = mapItems(g);
  c.textAlign = 'center';
  for (const it of items) {
    const [x, y] = it.xy, hot = it === mapHover || (it.b && it.b === mapSel?.b) || (it.pilot && it.pilot === mapSel?.pilot);
    if (it.b) {
      const b = it.b;
      if (b.kind === 'zone') { c.setLineDash([3, 3]); c.strokeStyle = b.color; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      else if (b.kind === 'station') { c.fillStyle = b.color; c.fillRect(x - 3.5, y - 3.5, 7, 7); }
      else {
        const r = b.kind === 'star' ? 9 : b.kind === 'moon' ? 2.5 : Math.max(4, Math.sqrt(b.r) / 4.5);
        c.fillStyle = b.color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        if (b.ringIn) { c.strokeStyle = 'rgba(229,207,152,.7)'; c.beginPath(); c.ellipse(x, y, r * 2.1, r * 0.8, -0.4, 0, Math.PI * 2); c.stroke(); }
      }
      if (b.kind !== 'moon' || hot) {
        c.fillStyle = hot ? '#fff' : b.kind === 'moon' ? '#8b97b8' : '#cfd8ff';
        c.font = `${b.kind === 'planet' || b.kind === 'star' ? 700 : 500} 12px Oxanium, monospace`;
        c.fillText(b.name, x, y + (b.kind === 'star' ? 26 : 20));
      }
    } else {
      c.fillStyle = it.pilot.color; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 5, y + 5); c.lineTo(x - 5, y + 5); c.closePath(); c.fill();
      c.fillStyle = it.pilot.color; c.font = '700 11px Oxanium, monospace'; c.fillText(it.pilot.name, x, y - 11);
    }
    if (hot) { c.strokeStyle = '#ffc94d'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; }
  }
  const [mx, my] = mapPoint(me.pos, g);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(mx, my, 4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.beginPath(); c.arc(mx, my, 8 + 3 * Math.sin(performance.now() / 200), 0, Math.PI * 2); c.stroke();
  c.font = '700 11px Oxanium, monospace'; c.fillText('Toi', mx, my - 12);
  const di = destInfo();
  if (di) {
    const [dx, dy] = di.pilot ? mapPoint(di.pos, g) : mapItems(g).find(i => i.b?.name === di.name)?.xy ?? mapXY(di.pos, g);
    c.setLineDash([6, 5]); c.strokeStyle = 'rgba(255,201,77,.8)'; c.beginPath(); c.moveTo(mx, my); c.lineTo(dx, dy); c.stroke(); c.setLineDash([]);
  }
}
function pickMap(e) {
  const rect = mapCanvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bd = 18;
  for (const it of mapItems(mapGeom())) { const d = Math.hypot(it.xy[0] - x, it.xy[1] - y); if (d < bd) { bd = d; best = it; } }
  return best;
}
mapCanvas.onmousemove = e => { mapHover = pickMap(e); mapCanvas.style.cursor = mapHover ? 'pointer' : 'crosshair'; };
mapCanvas.onclick = e => {
  const it = pickMap(e);
  if (!it) return;
  mapSel = it;
  const info = $('#mapInfo');
  info.hidden = false;
  if (it.pilot) {
    setDest({ pilot: it.pilot.name });
    info.style.setProperty('--c', it.pilot.color);
    info.innerHTML = `<h3>${esc(it.pilot.name)}</h3><p class="facts">À ${fmtKm(it.pilot.pos.distanceTo(me.pos))} · ${esc(zoneName(it.pilot.pos))}</p><p>✓ Pilote suivi : un repère t’indique sa position.</p>`;
    return;
  }
  const b = it.b, near = [...remotes.values()].filter(r => r.group.visible && r.pos.distanceTo(b.pos) < (b.ringOut ?? b.r) + 6000).map(r => r.name);
  setDest({ body: b.id });
  const KIND = { star: 'Étoile', planet: 'Planète', moon: 'Lune', station: 'Station spatiale', zone: 'Champ d’astéroïdes' };
  info.style.setProperty('--c', b.color);
  info.innerHTML = `<h3>${esc(b.name)}</h3><p class="facts">${KIND[b.kind]} · à ${fmtKm(b.pos.distanceTo(me.pos) - (b.kind === 'zone' ? 0 : b.r))}</p>
    <p>${esc(b.desc)}</p><p>${near.length ? `👥 Pilotes à proximité : ${near.map(esc).join(', ')}` : 'Aucun pilote à proximité.'}</p>
    <p>✓ Destination choisie : suis le repère jaune.</p>${b.kind === 'station' ? '<button class="ghost small" id="warpHome">⟲ Revenir directement à la station</button>' : ''}`;
};
$('#mapInfo').onclick = e => { if (e.target.id === 'warpHome') { spawn(); setDest(null); toggleMap(false); toast('Retour à la station Horizon', true); } };

/* ---------- Sons : ronronnement du réacteur, chocs ---------- */
let muted = store.get('se-muted') === '1', ac = null, engine = null;
function audio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // bruit brun
  const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
  src.buffer = buf; src.loop = true;
  filter.type = 'lowpass';
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  engine = { filter, gain };
}
addEventListener('pointerdown', () => { audio(); ac.resume(); });
const sfx = {
  bump(v) {
    if (!ac || muted) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.5);
  },
};
const renderSound = () => ($('#soundBtn').textContent = muted ? '🔇' : '🔊');
$('#soundBtn').onclick = () => { muted = !muted; store.set('se-muted', muted ? '1' : '0'); renderSound(); };
renderSound();
function updateSound(thrust) {
  if (!engine) return;
  const t = ac.currentTime, on = flying() && !muted;
  engine.gain.gain.setTargetAtTime(on ? 0.05 + thrust * 0.12 + (me.boosting ? 0.08 : 0) : 0, t, 0.15);
  engine.filter.frequency.setTargetAtTime(180 + thrust * 500 + (me.boosting ? 700 : 0), t, 0.2);
}

/* ---------- Boucle ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!flying() || !world || !myShip.mesh) { updateSound(0); return; }
  const thrust = mapOpen ? (keys.clear(), fly(dt, now)) : fly(dt, now);
  updateRemotes(now);
  updateCamera(dt);
  world.update(dt, now / 1000, camera.position);
  updateDust();
  myShip.trail.update(rel.set(0, 0, 3.5).applyQuaternion(myShip.mesh.quaternion).add(me.pos), camera.position, clamp((me.vel.length() - 20) / 120, 0, 1));
  for (const r of remotes.values()) if (r.group.visible) r.trail.update(rel.set(0, 0, 3.5).applyQuaternion(r.quat).add(r.pos), camera.position, clamp((r.speed - 20) / 120, 0, 1));
  composer.render();
  hud(now, dt);
  drawMinimap(dt);
  if (mapOpen) drawMap();
  sendPos(now);
  updateSound(thrust);
}
requestAnimationFrame(frame);
