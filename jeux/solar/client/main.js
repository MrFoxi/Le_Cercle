// Solar Explorer : menus, hangar, vol en 3D à la troisième personne, autres pilotes en temps réel,
// chat, pings, émotes, téléportation, journal d'exploration, événements en direct, interface et cartes.
/* global io */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, BODIES, byId, STATION, BELT, KUIPER_RING, KM, EPOCH, nearest, collide, zoneName, hostOf, PLACES, visited, blocksSun, setEvent, shown, groundRadius, orbits, hiddenFrom } from './world.js';
import { LOW } from './textures.js';
import { buildShip, setThrust, setNavLights, Trail, envFor } from './ships.js';
import { createProgress, CATALOG, COLORS, TITLES } from './progress.js';
import { FACTS } from './facts.js';
import { initFx, updateFx, firework, shockwave, lightning, warpFlash } from './fx.js';
import { startAudio, setAudio, audioSettings, engineSound, sfx, speak, setMood, music } from './audio.js';

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
const params = new URLSearchParams(location.search);
document.body.classList.toggle('touch', LOW);
if (LOW) $('#chatForm').msg.placeholder = 'Message aux pilotes…';
const urlCode = params.get('salon')?.toUpperCase();
const DEPART = params.get('depart'); // lu avant que l'adresse devienne ?salon=CODE
const fmtKm = u => { const km = Math.max(0, u) * KM; return km >= 1e6 ? `${(km / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M km` : `${Math.round(km).toLocaleString('fr-FR')} km`; };
const fmtTime = s => (s < 60 ? `${Math.ceil(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`);
const KIND = { star: 'Étoile', planet: 'Planète', dwarf: 'Planète naine', moon: 'Lune', station: 'Station spatiale', zone: 'Zone', comet: 'Comète' };
const QUICK = ['Rejoins-moi !', 'Regarde ça !', 'Suivez-moi !', 'On fait la course ?'];
const TP_COOLDOWN = 60000;
let state = null, launched = false, toastTimer;
const shipKey = s => ['model', 'color', 'paint', 'trail', 'boost', 'title'].map(k => s?.[k]).join('|');

// Heure commune (celle du serveur) : toutes les orbites en dépendent.
let clockOffset = 0;
const worldT = () => (Date.now() + clockOffset - EPOCH) / 1000;

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
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}
function act(...args) { socket.emit('act', ...args, res => res?.error && toast(res.error)); }

// Message radio de la station (bandeau + voix)
let radioTimer;
function radio(text, voice = true) {
  const r = $('#radio');
  r.innerHTML = `📻 ${esc(text)}`;
  r.hidden = false;
  clearTimeout(radioTimer);
  radioTimer = setTimeout(() => (r.hidden = true), 8000);
  sfx.radio();
  if (voice) setTimeout(() => speak(text), 450);
}

/* ---------- Progression (journal, points, déblocages) ---------- */
const progress = createProgress(PLACES.map(b => ({ id: b.id, kind: b.kind })), store);
function celebrate(res, what) {
  if (!res) return;
  if (what) { radio(`${what} · +${res.gained} points`, false); sfx.chime(); }
  for (const u of res.unlocks) setTimeout(() => toast(`🔓 Débloqué au hangar : ${u.name}`, true), 1500);
  for (const t of res.titles) setTimeout(() => toast(`🏅 Nouveau titre : ${t}`, true), 3000);
  renderJournal();
}

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
  lastChat = -1;
  for (const name of [...remotes.keys()]) dropRemote(name);
  pings.clear();
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

let lastEvent = '';
socket.on('state', s => {
  const before = state;
  state = s;
  clockOffset = s.time - Date.now();
  setEvent(s.event);
  syncRemotes(s.players);
  renderPilots();
  readChat(s.chat ?? [], !before);
  const mine = s.players.find(p => p.name === s.me);
  if (shipKey(myShip.cfg) !== shipKey(mine.ship)) setMyShip(mine.ship);
  // Nouveaux pilotes et événements annoncés par la station
  if (before && launched) for (const p of s.players) if (!before.players.some(q => q.name === p.name)) radio(`Station Horizon : nouveau pilote dans le secteur, ${p.name}.`);
  const evKey = s.event ? `${s.event.type}${s.event.phase}${s.event.start}` : '';
  if (evKey !== lastEvent && before) announce(s.event, lastEvent);
  lastEvent = evKey;
  if (!launched) openHangar();
});
function announce(ev, was) {
  if (!ev) return was.startsWith('storm') ? radio('Station Horizon : fin de la tempête solaire. Bon vol !') : null;
  const target = byId(ev.target)?.name ?? 'la Terre';
  if (ev.type === 'storm') radio(ev.phase === 'warning' ? 'Alerte : tempête solaire dans 2 minutes ! Abritez-vous derrière une planète, une lune ou à la station.' : 'Tempête solaire en cours ! Restez à l’abri du Soleil.');
  if (ev.type === 'meteors') radio(`Alerte : pluie de météorites près de ${target} ! Attention aux impacts.`);
  if (ev.type === 'comet') radio(`Une comète visiteuse frôle ${target} ! Elle est sur votre carte : approchez-la vite.`);
}

/* ---------- Hangar ---------- */
let choice = null, preview = null;
try { choice = JSON.parse(store.get('se-ship')); } catch { /* choix illisible */ }
const KINDS = [['model', 'Modèle'], ['paint', 'Peinture'], ['trail', 'Traînée'], ['boost', 'Effet de boost']];
function validChoice(base) {
  const pts = progress.points(), c = { ...base, ...choice };
  for (const [k] of KINDS) if (!CATALOG[k][c[k]] || CATALOG[k][c[k]].need > pts) c[k] = Object.keys(CATALOG[k])[0];
  if (!COLORS.includes(c.color)) c.color = base.color;
  if (!progress.titles().includes(c.title)) c.title = 'pilote';
  return c;
}
function openHangar() {
  show('hangar');
  ensureWorld();
  choice = validChoice(state.players.find(p => p.name === state.me).ship);
  renderHangar();
  startPreview();
}
function renderHangar() {
  const pts = progress.points(), owned = progress.titles();
  $('#hangarPts').textContent = `${pts.toLocaleString('fr-FR')} points d’exploration · ${progress.percent()} % du système découvert`;
  $('#models').innerHTML = Object.entries(CATALOG.model).map(([k, m]) => {
    const lock = m.need > pts;
    return `<button class="${choice.model === k ? 'on' : ''}" data-pick="model" data-id="${k}" ${lock ? 'disabled' : ''}><b>${lock ? '🔒 ' : ''}${esc(m.name)}</b><small>${lock ? `${m.need} points` : esc(m.desc)}</small></button>`;
  }).join('');
  for (const k of ['paint', 'trail', 'boost']) {
    $(`#pick-${k}`).innerHTML = Object.entries(CATALOG[k]).map(([id, it]) => {
      const lock = it.need > pts;
      return `<button class="chip ${choice[k] === id ? 'on' : ''}" data-pick="${k}" data-id="${id}" ${lock ? 'disabled' : ''} title="${lock ? `Débloqué à ${it.need} points` : ''}">${lock ? '🔒 ' : ''}${esc(it.name)}</button>`;
    }).join('');
  }
  $('#pick-title').innerHTML = Object.entries(TITLES).map(([id, t]) => {
    const has = owned.includes(id);
    return `<button class="chip ${choice.title === id ? 'on' : ''}" data-pick="title" data-id="${id}" ${has ? '' : 'disabled'} title="${has ? '' : esc(t.hint)}">${has ? '' : '🔒 '}${esc(t.name)}</button>`;
  }).join('');
  $('#swatches').innerHTML = COLORS.map(c => `<button class="${choice.color === c ? 'on' : ''}" data-pick="color" data-id="${c}" style="--c:${c}" aria-label="Couleur ${c}"></button>`).join('');
  $('#hangarCode').textContent = state.code;
  $('#hangarPilots').textContent = `${state.players.length} pilote${state.players.length > 1 ? 's' : ''} : ${state.players.map(p => p.name).join(', ')}`;
  $('#hangarWhere').textContent = launched ? 'Hangar de la station Horizon' : 'Hangar';
  if (world) $('#launchBtn').textContent = launched ? '✓ Repartir' : '🚀 Décoller';
  preview?.set(choice);
}
$('#hangar').addEventListener('click', e => {
  const b = e.target.closest('[data-pick]');
  if (!b || b.disabled) return;
  choice[b.dataset.pick] = b.dataset.id;
  renderHangar();
});
$('#launchBtn').onclick = () => {
  store.set('se-ship', JSON.stringify(choice));
  act('setShip', choice);
  setMyShip(choice);
  const first = !launched;
  launched = true;
  show('space');
  startAudio();
  if (first) {
    world.update(worldT(), camera.position);
    spawn();
    $('#help').hidden = false;
    setTimeout(() => ($('#help').hidden = true), 10000);
    nearStation = true; // pas de second message d'accueil juste après le décollage
    radio(`Station Horizon : décollage autorisé, pilote ${state.me}. Bon vol !`);
  }
  lockPointer();
  if (LOW) fullscreen(true);
};
function openStationHangar() {
  if (!me.docked) { toast('Le hangar est à la station Horizon : rejoins-la pour changer de vaisseau'); setDest({ body: 'horizon' }); return; }
  document.exitPointerLock?.();
  show('hangar');
  choice = validChoice(myShip.cfg);
  renderHangar();
  startPreview();
}
$('#hangarBtn').onclick = openStationHangar;
$('#prompt').onclick = openStationHangar;

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
        ship = buildShip(c, envFor(r));
        scene.add(ship);
      },
      loop(t) {
        if ($('#hangar').hidden) return void (preview.running = false);
        requestAnimationFrame(preview.loop);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const dpr = Math.min(devicePixelRatio, 2);
        if (canvas.width !== Math.round(w * dpr)) { r.setPixelRatio(dpr); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
        ship.rotation.y = t / 2600;
        ship.position.y = Math.sin(t / 900) * 0.25;
        setThrust(ship, 0.5, Math.sin(t / 1200) > 0.6);
        r.render(scene, cam);
      },
    };
  }
  preview.set(choice);
  if (!preview.running) { preview.running = true; requestAnimationFrame(preview.loop); }
}

/* ---------- Rendu de l'espace ---------- */
const view = $('#view');
const lockPointer = () => LOW || view.requestPointerLock?.()?.catch?.(() => {}); // refusé sans clic récent : sans gravité
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 1.5)); // téléphone : la carte graphique est le point faible
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 2e6);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.9));
composer.addPass(new OutputPass());
initFx(scene);
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
    orbits(worldT());
    renderer.compile(scene, camera);
    $('#launchBtn').disabled = false;
    $('#launchBtn').textContent = launched ? '✓ Repartir' : '🚀 Décoller';
  });
  return worldPromise;
}

/* ---------- Mon vaisseau ---------- */
const me = {
  pos: new V3(), vel: new V3(), quat: new THREE.Quaternion(), yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, roll: 0,
  fwd: 0, lat: 0, vert: 0, boost: 1, boosting: false, lastBoost: 0, hull: 100, cruise: 1, heat: false, docked: false, exposed: false,
  barrel: 0, lightsUntil: 0, tpReady: 0, lastWave: 0,
};
if (params.has('debug')) window.__se = { me, remotes: () => remotes, BODIES }; // ?debug : pour les tests automatiques
const myShip = { cfg: null, mesh: null, trail: null, bolt: null, light: new THREE.PointLight(0xffffff, 40, 40, 2) };
function setMyShip(cfg) {
  if (myShip.mesh) scene.remove(myShip.mesh);
  if (myShip.trail) scene.remove(myShip.trail.group);
  const mesh = buildShip(cfg, envFor(renderer));
  Object.assign(myShip, { cfg: { ...cfg }, mesh, trail: new Trail(cfg.color, cfg.trail), bolt: lightning(mesh) });
  mesh.add(myShip.light);
  myShip.light.color.set(cfg.color);
  myShip.light.position.set(0, 1, 6);
  scene.add(mesh, myShip.trail.group);
}

// Départ (et retour) à la station Horizon : un peu à l'écart de l'anneau, face à elle, la Terre derrière.
function spawn() {
  const earth = byId('terre'), away = STATION.pos.clone().sub(earth.pos).normalize();
  const side = new V3().crossVectors(away, new V3(0, 1, 0)).normalize();
  me.pos.copy(STATION.pos).addScaledVector(away, 330).addScaledVector(side, (Math.random() - 0.5) * 90).add(new V3(0, 40 + Math.random() * 30, 0));
  // ?depart=saturne : départ près d'un astre, côté éclairé (pratique pour tester ou montrer un lieu)
  const start = byId(DEPART);
  if (start && start !== STATION) me.pos.copy(start.pos).addScaledVector(start.pos.clone().normalize().applyAxisAngle(new V3(0, 1, 0), 2.6), Math.max(500, (start.ringOut ?? start.r) * 2.2)).add(new V3(0, (start.ringOut ?? start.r) * 0.25, 0));
  face((start ?? STATION).pos.clone().sub(me.pos).normalize());
  me.vel.set(0, 0, 0);
  me.fwd = me.lat = me.vert = 0;
  me.hull = 100;
  me.boost = 1;
  myShip.trail?.reset();
  camOffset.set(0, 0, 0);
}
function face(f) {
  me.yaw = me.tYaw = Math.atan2(-f.x, -f.z);
  me.pitch = me.tPitch = Math.asin(clamp(f.y, -0.97, 0.97));
}

/* ---------- Commandes ---------- */
const keys = new Set();
const flying = () => launched && !$('#space').hidden;
const typing = () => document.activeElement?.matches?.('input');
const GAME_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ControlLeft', 'ControlRight', 'KeyC', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyM', 'KeyH', 'KeyJ', 'KeyP', 'KeyE', 'KeyT', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']);
addEventListener('keydown', e => {
  if (!flying() || typing()) return;
  if (GAME_KEYS.has(e.code) || e.ctrlKey) e.preventDefault(); // Ctrl sert à descendre : pas de raccourcis du navigateur
  if (e.code === 'Escape') { if (mapOpen) toggleMap(false); if (!$('#journal').hidden) $('#journal').hidden = true; return; }
  if (e.repeat) return;
  keys.add(e.code);
  press(e.code);
});
// Une touche (ou un bouton tactile du même nom) : les actions instantanées
function press(k) {
  if (k === 'KeyX') { me.tYaw += Math.PI; toast('Demi-tour', true); }
  if (k === 'KeyM') toggleMap();
  if (k === 'KeyH') $('#help').hidden = !$('#help').hidden;
  if (k === 'KeyJ') toggleJournal();
  if (k === 'KeyP') ping();
  if (k === 'KeyE' && me.docked) openStationHangar();
  if (k === 'Enter' || k === 'KeyT') openChat();
  if (k.startsWith('Digit')) {
    const n = +k.slice(5);
    if (n >= 1 && n <= 4) say(QUICK[n - 1]);
    if (n === 5) emote('tonneau');
    if (n === 6) emote('feux');
    if (n === 7) emote('artifice');
  }
}
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let locked = false;
const lock = () => { if (!mapOpen && $('#journal').hidden) lockPointer(); };
view.addEventListener('click', lock);
$('#lockHint').onclick = lock;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === view;
  if (locked) keys.clear();
  $('#lockHint').hidden = locked || mapOpen || !$('#journal').hidden || !$('#chatForm').hidden;
});
document.addEventListener('mousemove', e => {
  if (!locked) return;
  me.tYaw -= e.movementX * 0.0022;
  me.tPitch = clamp(me.tPitch - e.movementY * 0.0022, -1.35, 1.35);
});
addEventListener('pointerdown', () => startAudio());

/* ---------- Commandes tactiles : joystick à gauche, visée au pouce droit, boutons ---------- */
const fullscreen = on => (on ? document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')) : document.exitFullscreen?.())?.catch?.(() => {});
if (LOW) {
  const stick = $('#stick'), knob = stick.firstElementChild, R = 55;
  let stickId = null, aimId = null, ox = 0, oy = 0, ax = 0, ay = 0;
  const setDir = (dx, dy) => { for (const [code, on] of [['KeyW', dy < -0.35], ['KeyS', dy > 0.35], ['KeyA', dx < -0.45], ['KeyD', dx > 0.45]]) on ? keys.add(code) : keys.delete(code); };
  view.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    view.setPointerCapture(e.pointerId);
    $('#moreMenu').hidden = true;
    if (e.clientX < innerWidth * 0.45 && stickId === null) {
      stickId = e.pointerId; ox = e.clientX; oy = e.clientY;
      Object.assign(stick.style, { left: `${ox}px`, top: `${oy}px` });
      stick.classList.add('on');
    } else if (aimId === null) { aimId = e.pointerId; ax = e.clientX; ay = e.clientY; }
  });
  view.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      setDir(dx / R, dy / R);
    } else if (e.pointerId === aimId) {
      me.tYaw -= (e.clientX - ax) * 0.005;
      me.tPitch = clamp(me.tPitch - (e.clientY - ay) * 0.005, -1.35, 1.35);
      ax = e.clientX; ay = e.clientY;
    }
  });
  const end = e => {
    if (e.pointerId === stickId) { stickId = null; setDir(0, 0); knob.style.transform = ''; stick.classList.remove('on'); stick.style.left = stick.style.top = ''; }
    if (e.pointerId === aimId) aimId = null;
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  for (const b of document.querySelectorAll('[data-hold]')) {
    b.onpointerdown = e => { b.setPointerCapture(e.pointerId); keys.add(b.dataset.hold); b.classList.add('on'); };
    b.onpointerup = b.onpointercancel = () => { keys.delete(b.dataset.hold); b.classList.remove('on'); };
  }
  for (const b of document.querySelectorAll('[data-key]')) b.onclick = () => { $('#moreMenu').hidden = true; press(b.dataset.key); };
  $('#moreBtn').onclick = () => ($('#moreMenu').hidden = !$('#moreMenu').hidden);
  $('#fullBtn').hidden = !document.documentElement.requestFullscreen; // iPhone : pas de plein écran, mais « Ajouter à l'écran d'accueil »
  $('#fullBtn').onclick = () => { $('#moreMenu').hidden = true; fullscreen(!document.fullscreenElement); };
  $('#space').addEventListener('contextmenu', e => e.preventDefault()); // appui long : pas de menu du navigateur
}

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
  const wasBoosting = me.boosting;
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
  const travel = progress.travel(me.vel.length() * dt * KM);
  if (travel) celebrate(travel);

  // Collisions : astres (et relief), rochers, station, autres vaisseaux, météorites
  let impact = collide(me.pos, me.vel, 3);
  for (const r of remotes.values()) if (r.group.visible) impact = Math.max(impact, push(me.pos, me.vel, r.pos, 8));
  if (impact > 0) me.fwd = Math.min(me.fwd, Math.max(0, me.vel.dot(FWD)));
  if (impact > 20) {
    me.hull = Math.max(0, me.hull - Math.min(35, impact * 0.05));
    shake = Math.min(0.7, shake + impact / 500);
    sfx.bump(Math.min(1, impact / 300));
  }
  for (const h of world.meteorHeads()) {
    if (h.p.distanceTo(me.pos) < h.r + 5 && now - (me.lastMeteor ?? 0) > 600) { me.lastMeteor = now; me.hull -= 12; shake = 0.7; sfx.bump(1); toast('💥 Touché par une météorite !'); }
  }
  // Coque : réparée à la station, abîmée par les chocs, la chaleur du Soleil et les tempêtes solaires
  const sunDist = me.pos.length() - byId('soleil').r;
  me.heat = sunDist < 1500;
  me.docked = me.pos.distanceTo(STATION.pos) < 260;
  const storm = state?.event?.type === 'storm' && state.event.phase === 'active';
  me.exposed = storm && !me.docked && !blocksSun(me.pos);
  if (me.heat) me.hull -= dt * 7 * (1 - sunDist / 1500);
  if (me.exposed) { me.hull -= dt * 5; shake = Math.max(shake, 0.12); }
  me.hull = Math.min(100, me.hull + dt * (me.docked ? 10 : 0.4));
  if (me.hull <= 0) { toast('Vaisseau hors service : remorquage jusqu’à la station Horizon'); spawn(); }

  // Boost : effets à la carte (onde de choc, éclairs, plasma)
  if (me.boosting && myShip.cfg.boost === 'onde' && (!wasBoosting || now - me.lastWave > 1500)) { me.lastWave = now; shockwave(me.pos.clone().addScaledVector(FWD, -5), me.quat, myShip.cfg.color); }
  myShip.bolt.set(me.boosting && myShip.cfg.boost === 'eclair');

  // Tonneau (émote) : un tour complet sur l'axe du vaisseau, ajouté au roulis
  me.barrel = Math.max(0, me.barrel - dt);
  const spin = me.barrel > 0 ? (1 - me.barrel) ** 2 * (3 - 2 * (1 - me.barrel)) * Math.PI * 2 : 0;
  me.roll = damp(me.roll, clamp(-yawRate * 0.35 - (me.lat / slide) * 0.35, -0.9, 0.9), 5, dt);
  myShip.mesh.position.copy(me.pos);
  myShip.mesh.quaternion.copy(me.quat).multiply(rollQ.setFromAxisAngle(Z, me.roll + spin));
  setNavLights(myShip.mesh, now > me.lightsUntil || Math.floor(now / 120) % 2 === 0);
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
const camOffset = new V3(), camWant = new V3(), camUp = new V3(0, 1, 0), look = new V3(), camDir = new V3();
function updateCamera(dt) {
  const speed = me.vel.length(), extra = Math.min(6, speed / 400) + (me.boosting ? 2.5 : 0);
  camWant.set(0, 4.2 + extra * 0.25, 15 + extra).applyQuaternion(me.quat);
  if (camOffset.lengthSq() === 0) camOffset.copy(camWant);
  camOffset.set(damp(camOffset.x, camWant.x, 7, dt), damp(camOffset.y, camWant.y, 7, dt), damp(camOffset.z, camWant.z, 7, dt));
  camera.position.copy(me.pos).add(camOffset);
  // Au ras d'un sol en relief, la caméra reste au-dessus du terrain
  const n = nearest(camera.position).body;
  if (n?.amp) {
    const g = groundRadius(n, camera.position) + 1.5, d = camera.position.distanceTo(n.pos);
    if (d < g) camera.position.sub(n.pos).multiplyScalar(g / d).add(n.pos);
  }
  shake = damp(shake, 0, 5, dt);
  if (shake > 0.01) camera.position.add(new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake));
  camUp.lerp(UP, 1 - Math.exp(-6 * dt)).normalize();
  camera.up.copy(camUp);
  camera.lookAt(look.copy(me.pos).addScaledVector(FWD, 30).addScaledVector(UP, 2));
  camera.fov = damp(camera.fov, 68 + Math.min(12, speed / 250) + (me.boosting ? 6 : 0), 3, dt);
  camera.updateProjectionMatrix();
  camera.getWorldDirection(camDir);
}

// Traits de vitesse : poussière qui défile autour de la caméra quand on va vite.
// Pendant une tempête solaire, ils deviennent orange et soufflent depuis le Soleil.
const DUST = 220, dust = Array.from({ length: DUST }, () => new V3(1e9, 0, 0));
const dustGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 6), 3));
const dustMat = new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const dustLines = new THREE.LineSegments(dustGeo, dustMat);
dustLines.frustumCulled = false;
scene.add(dustLines);
const rel = new V3(), dir = new V3();
function updateDust(storm) {
  const speed = me.vel.length();
  dustMat.color.set(storm > 0.5 ? 0xffa040 : 0xa8dcff);
  dustMat.opacity = Math.max(clamp((speed - 100) / 900, 0, 0.55), storm * 0.5);
  dustLines.visible = dustMat.opacity > 0;
  if (!dustLines.visible) return;
  if (storm > 0.5 && speed < 600) dir.copy(me.pos).normalize().multiplyScalar(-1); else dir.copy(me.vel).normalize();
  const len = storm > 0.5 && speed < 600 ? 25 : Math.min(speed * 0.02, 40), a = dustGeo.attributes.position.array;
  dust.forEach((p, i) => {
    if (storm > 0.5 && speed < 600) p.addScaledVector(dir, -900 * 0.016); // le vent solaire passe sur le vaisseau
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
    if (r && shipKey(r.cfg) !== shipKey(p.ship)) { dropRemote(p.name); r = null; }
    if (!r) {
      const group = buildShip(p.ship, envFor(renderer));
      r = { name: p.name, cfg: { ...p.ship }, color: p.ship.color, group, trail: new Trail(p.ship.color, p.ship.trail), bolt: lightning(group), snaps: [], pos: new V3(), quat: new THREE.Quaternion(), speed: 0, boost: false, lightsUntil: 0, bubble: null, lastWave: 0 };
      group.visible = false;
      r.label = Object.assign(document.createElement('div'), { className: 'lbl pilot' });
      r.label.style.setProperty('--c', p.ship.color);
      $('#labels').append(r.label);
      scene.add(group, r.trail.group);
      remotes.set(p.name, r);
    }
    r.online = p.connected;
  }
}
function dropRemote(name) {
  const r = remotes.get(name);
  if (!r) return;
  scene.remove(r.group, r.trail.group);
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
socket.on('emote', (name, type) => {
  const r = remotes.get(name);
  if (!r) return;
  if (type === 'feux') r.lightsUntil = performance.now() + 2000;
  if (type === 'artifice' && r.group.visible) { firework(r.pos); if (r.pos.distanceTo(me.pos) < 2000) sfx.firework(); }
  if (type === 'warp') { if (r.group.visible) warpFlash(r.pos, r.color); r.snaps.length = 0; }
});
function updateRemotes(now, dt) {
  const t = now - INTERP;
  for (const r of remotes.values()) {
    const s = r.snaps, last = s.at(-1);
    if (!r.online || !last || now - last.t > 6000) { r.group.visible = false; r.trail.group.visible = false; continue; }
    r.trail.group.visible = true;
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
    const wasBoost = r.boost;
    r.speed = (b ?? a).s;
    r.boost = (b ?? a).b;
    r.group.visible = true;
    r.group.position.copy(r.pos);
    r.group.quaternion.copy(r.quat);
    setThrust(r.group, clamp(r.speed / 250, 0.15, 1), r.boost);
    setNavLights(r.group, now > r.lightsUntil || Math.floor(now / 120) % 2 === 0);
    if (r.boost && r.cfg.boost === 'onde' && (!wasBoost || now - r.lastWave > 1500)) { r.lastWave = now; shockwave(r.pos.clone().addScaledVector(new V3(0, 0, 5).applyQuaternion(r.quat), 1), r.quat, r.color); }
    r.bolt.set(r.boost && r.cfg.boost === 'eclair');
    r.trail.update(rel.set(0, 0, 3.5).applyQuaternion(r.quat).add(r.pos), camera.position, clamp((r.speed - 20) / 120, 0, 1), dt);
  }
}
let lastSend = 0;
function sendPos(now) {
  if (now - lastSend < 66) return;
  lastSend = now;
  const p = me.pos, q = myShip.mesh.quaternion, r1 = v => Math.round(v * 10) / 10, r4 = v => Math.round(v * 1e4) / 1e4;
  socket.volatile.emit('pos', [r1(p.x), r1(p.y), r1(p.z), r4(q.x), r4(q.y), r4(q.z), r4(q.w), Math.round(me.vel.length()), me.boosting ? 1 : 0]);
}

/* ---------- Émotes, téléportation ---------- */
let lastEmote = 0;
function emote(type) {
  const now = performance.now();
  if (now - lastEmote < 900) return;
  lastEmote = now;
  if (type === 'tonneau') me.barrel = 1; // visible des autres par l'orientation envoyée
  if (type === 'feux') { me.lightsUntil = now + 2000; socket.emit('emote', 'feux'); }
  if (type === 'artifice') { firework(me.pos); sfx.firework(); socket.emit('emote', 'artifice'); }
}
function teleportTo(name) {
  const r = remotes.get(name), now = Date.now();
  if (!r?.group.visible) return toast('Ce pilote n’est pas visible pour l’instant');
  if (now < me.tpReady) return toast(`Téléporteur en recharge : encore ${Math.ceil((me.tpReady - now) / 1000)} s`);
  me.tpReady = now + TP_COOLDOWN;
  warpFlash(me.pos, myShip.cfg.color);
  socket.emit('emote', 'warp');
  const f = new V3(0, 0, -1).applyQuaternion(r.quat);
  me.pos.copy(r.pos).addScaledVector(f, -24).add(new V3(0, 6, 0));
  face(f);
  me.vel.set(0, 0, 0);
  me.fwd = 0;
  myShip.trail.reset();
  camOffset.set(0, 0, 0);
  warpFlash(me.pos, myShip.cfg.color);
  sfx.warp();
  toast(`Téléporté auprès de ${name}`, true);
}

/* ---------- Chat ---------- */
let lastChat = -1;
function readChat(list, first) {
  for (const m of list) {
    if (m.id <= lastChat) continue;
    lastChat = m.id;
    if (first) continue; // l'historique d'avant notre arrivée n'apparaît pas en bulles
    const li = document.createElement('li');
    li.innerHTML = `<b style="--c:${state.players.find(p => p.name === m.name)?.ship.color ?? '#fff'}">${esc(m.name)}</b> ${esc(m.text)}`;
    $('#chatLog').append(li);
    setTimeout(() => li.classList.add('old'), 20000);
    while ($('#chatLog').children.length > 7) $('#chatLog').firstChild.remove();
    const r = remotes.get(m.name);
    if (r) { r.bubble = { text: m.text, until: performance.now() + 6000 }; sfx.message(); }
  }
}
function say(text) { socket.emit('chat', text); }
function openChat() {
  $('#chatForm').hidden = false;
  keys.clear();
  document.exitPointerLock?.();
  $('#chatForm').msg.focus();
}
function closeChat() { $('#chatForm').hidden = true; $('#chatForm').msg.blur(); lockPointer(); }
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const text = e.target.msg.value.trim();
  if (text) say(text);
  e.target.msg.value = '';
  closeChat();
};
$('#chatClose').onclick = () => { $('#chatForm').msg.value = ''; closeChat(); };
$('#chatForm').msg.onkeydown = e => { if (e.key === 'Escape') { e.target.value = ''; closeChat(); } };
$('#quick').onclick = e => { const b = e.target.closest('[data-quick]'); if (b) say(QUICK[b.dataset.quick]); };
$('#quick').innerHTML = QUICK.map((q, i) => `<button type="button" class="chip" data-quick="${i}"><kbd>${i + 1}</kbd> ${esc(q)}</button>`).join('');

/* ---------- Pings ---------- */
// Un ping vise ce qui est au centre de l'écran (astre, pilote) ou un point devant ; il est attaché à un astre pour suivre son orbite.
const pings = new Map(); // pilote -> { host, at, until, label, el }
function ping() {
  let best = null, bestAng = Infinity;
  const consider = (pos, r, label) => {
    const to = rel.subVectors(pos, camera.position), d = to.length(), ang = to.angleTo(camDir);
    if (ang < Math.max(0.035, Math.atan(r / d)) && ang < bestAng) { bestAng = ang; best = { pos: pos.clone(), label }; }
  };
  for (const b of BODIES) if (shown(b) && !b.ring) consider(b.pos, b.ringOut ?? b.r, b.name);
  for (const r of remotes.values()) if (r.group.visible) consider(r.pos, 15, r.name);
  const point = best?.pos ?? camera.position.clone().addScaledVector(camDir, 600), host = hostOf(point);
  const at = host ? point.clone().sub(host.pos) : point;
  addPing(state.me, { host: host?.id ?? '', at: [at.x, at.y, at.z] }, best?.label);
  socket.emit('ping', { host: host?.id ?? '', at: [at.x, at.y, at.z].map(v => Math.round(v * 10) / 10) });
  sfx.ping();
}
function addPing(name, data, label) {
  const old = pings.get(name);
  const el = old?.el ?? Object.assign(document.createElement('div'), { className: 'mark ping' });
  if (!old) $('#labels').append(el);
  const color = state.players.find(p => p.name === name)?.ship.color ?? '#7cf3ff';
  el.style.setProperty('--c', color);
  pings.set(name, { host: data.host, at: new V3(...data.at), until: performance.now() + 30000, label: label ?? '', el, color });
}
socket.on('ping', (name, data) => {
  addPing(name, data);
  sfx.ping();
  const li = document.createElement('li');
  li.innerHTML = `📍 <b>${esc(name)}</b> a placé un repère : « Viens ici ! »`;
  $('#chatLog').append(li);
  setTimeout(() => li.classList.add('old'), 20000);
});
const pingPos = p => (p.host ? byId(p.host)?.pos.clone().add(p.at) : p.at.clone()) ?? p.at.clone();

/* ---------- Destination ---------- */
let dest = null; // { body } ou { pilot }
function destInfo() {
  if (dest?.body) { const b = byId(dest.body); return shown(b) ? { name: b.name, pos: b.pos, reach: b.kind === 'zone' ? b.r : b.kind === 'comet' ? 900 : (b.ringOut ?? b.r) * 2.5, color: b.color } : null; }
  if (dest?.pilot) { const r = remotes.get(dest.pilot); return r?.group.visible ? { name: dest.pilot, pos: r.pos, reach: 40, color: r.color, pilot: true } : null; }
  return null;
}
function setDest(d) {
  dest = d;
  renderPilots();
  if (d) toast(`Destination : ${destInfo()?.name ?? d.pilot ?? ''}`, true);
}
$('#pilots').onclick = e => {
  const tp = e.target.closest('[data-tp]');
  if (tp) return teleportTo(tp.dataset.tp);
  const b = e.target.closest('[data-pilot]');
  if (b) setDest(dest?.pilot === b.dataset.pilot ? null : { pilot: b.dataset.pilot });
};
const titleOf = p => (p.ship.title && p.ship.title !== 'pilote' ? TITLES[p.ship.title]?.name : '');
function renderPilots() {
  if (!state) return;
  $('#pilotCount').textContent = `· ${state.players.filter(p => p.connected).length}`;
  $('#pilots').innerHTML = state.players.map(p => p.name === state.me
    ? `<li><button disabled style="--c:${p.ship.color}"><i></i><span>${esc(p.name)} (toi)<em>${esc(titleOf(p))}</em></span></button></li>`
    : `<li><button class="${p.connected ? '' : 'off'} ${dest?.pilot === p.name ? 'on' : ''}" data-pilot="${esc(p.name)}" style="--c:${p.ship.color}"><i></i><span>${esc(p.name)}<em>${esc(titleOf(p))}</em></span><small data-dist="${esc(p.name)}">${p.connected ? '' : 'hors ligne'}</small></button>
       <button class="tp" data-tp="${esc(p.name)}" title="Se téléporter auprès de ${esc(p.name)} (une fois par minute)">⤴</button></li>`).join('');
}
$('#inviteBtn').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast(`Lien copié ! Code de l’univers : ${state.code}`, true), () => toast(`Code de l’univers : ${state.code}`, true));

/* ---------- Journal d'exploration ---------- */
function toggleJournal(open = $('#journal').hidden) {
  $('#journal').hidden = !open;
  if (open) { document.exitPointerLock?.(); keys.clear(); renderJournal(); }
  $('#lockHint').hidden = locked || open || mapOpen;
}
$('#journalBtn').onclick = () => toggleJournal();
function renderJournal() {
  if ($('#journal').hidden) return;
  const pts = progress.points(), next = Object.values(CATALOG).flatMap(Object.values).filter(i => i.need > pts).sort((a, b) => a.need - b.need)[0];
  $('#journalHead').innerHTML = `<b>${progress.percent()} %</b> du système découvert · <b>${pts.toLocaleString('fr-FR')}</b> points${next ? ` · prochain déblocage : ${esc(next.name)} à ${next.need} points` : ' · tout est débloqué !'}`;
  $('#journalList').innerHTML = PLACES.map(b => {
    if (!progress.has(b.id)) {
      const order = BODIES.filter(x => x.kind === 'planet').indexOf(b) + 1;
      const near = { star: 'au centre du système', planet: `la ${order === 1 ? '1re' : `${order}ᵉ`} planète en partant du Soleil`, dwarf: 'au-delà de Neptune', comet: 'sur une orbite très allongée : elle passe parfois près du Soleil', zone: b.ring ? 'au-delà de Neptune' : 'dans la ceinture d’astéroïdes, entre Mars et Jupiter' }[b.kind] ?? `près de ${byId(b.parent)?.name}`;
      return `<li class="locked"><h4>??? <small>${KIND[b.kind]}</small></h4><p>Pas encore découvert : ${esc(near)}.</p></li>`;
    }
    return `<li style="--c:${b.color}"><h4>${esc(b.name)} <small>${KIND[b.kind]}</small></h4><ul>${(FACTS[b.id] ?? []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <button class="ghost small" data-goto="${b.id}">➜ Y aller</button></li>`;
  }).join('');
}
$('#journalList').onclick = e => { const b = e.target.closest('[data-goto]'); if (b) { setDest({ body: b.dataset.goto }); toggleJournal(false); } };
$('#journalClose').onclick = () => toggleJournal(false);

/* ---------- Interface ---------- */
const proj = new V3();
// Coordonnées écran d'un point ; null s'il est derrière la caméra.
function screen(p) {
  proj.copy(p).project(camera);
  if (proj.z > 1) return null;
  return [(proj.x + 1) / 2 * innerWidth, (1 - proj.y) / 2 * innerHeight, Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05];
}
// Repère sur la cible, ou flèche au bord de l'écran si elle est hors champ.
function placeMarker(el, pos) {
  proj.copy(pos).project(camera);
  let x = proj.x, y = proj.y;
  const behind = proj.z > 1;
  if (behind) { x = -x; y = -y; }
  const edge = behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.9;
  el.classList.toggle('edge', edge);
  let sx = (x + 1) / 2 * innerWidth, sy = (1 - y) / 2 * innerHeight;
  if (edge) {
    const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((cx - 70) / Math.abs(Math.cos(ang) || 1e-6), (cy - 70) / Math.abs(Math.sin(ang) || 1e-6));
    sx = cx + Math.cos(ang) * k;
    sy = cy + Math.sin(ang) * k;
    el.style.setProperty('--a', `${ang + Math.PI / 2}rad`);
  }
  el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
}
const bodyLabels = BODIES.map(b => {
  const el = Object.assign(document.createElement('div'), { className: 'lbl body' });
  el.style.setProperty('--c', b.color);
  $('#labels').append(el);
  return { b, el };
});
const place = (el, x, y) => (el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`);
let slowTick = 0, nearStation = false, lastAlarm = 0, lastRadio = 0, lastFlush = 0;
function hud(now) {
  const slow = now - slowTick > 250;
  if (slow) slowTick = now;
  // Noms (et titres, bulles de chat) au-dessus des vaisseaux
  for (const r of remotes.values()) {
    const sc = r.group.visible && screen(rel.copy(r.pos).addScaledVector(camera.up, 4));
    r.label.hidden = !sc || !sc[2];
    if (r.label.hidden) continue;
    place(r.label, sc[0], sc[1]);
    if (slow) {
      const d = r.pos.distanceTo(me.pos), p = state.players.find(x => x.name === r.name), bubble = r.bubble && now < r.bubble.until ? r.bubble.text : '';
      r.label.innerHTML = `${bubble ? `<q>${esc(bubble)}</q>` : ''}<b>${esc(r.name)}</b>${p && titleOf(p) ? `<em>${esc(titleOf(p))}</em>` : ''}${d > 300 ? `<small>${fmtKm(d)}</small>` : ''}`;
    }
  }
  // Noms des astres visibles de loin
  for (const lb of bodyLabels) {
    const { b, el } = lb;
    if (slow) lb.behind = hiddenFrom(camera.position, b.pos, b);
    const d = b.pos.distanceTo(me.pos), far = !lb.behind && (b.kind === 'moon' ? d < 6000 : b.kind === 'station' ? d < 60000 : true);
    const sc = shown(b) && far && d > (b.ringOut ?? b.r) * 4 && screen(rel.copy(b.pos).addScaledVector(camera.up, b.kind === 'zone' ? 0 : b.r * 1.15));
    el.hidden = !sc || !sc[2];
    if (el.hidden) continue;
    place(el, sc[0], sc[1]);
    if (slow) el.innerHTML = `${esc(b.name)}<small>${fmtKm(d - (b.kind === 'zone' ? 0 : b.r))}</small>`;
  }
  // Pings des pilotes
  for (const [name, p] of pings) {
    if (now > p.until) { p.el.remove(); pings.delete(name); continue; }
    const pos = pingPos(p);
    placeMarker(p.el, pos);
    if (slow) p.el.innerHTML = `<i></i><b>📍 ${esc(name === state.me ? 'Ton repère' : name)}${p.label ? ` · ${esc(p.label)}` : ''}</b><small>Viens ici ! · ${fmtKm(pos.distanceTo(me.pos))}</small>`;
  }
  // Destination
  const di = destInfo(), mark = $('#destMark');
  mark.hidden = !di;
  if (di) {
    const d = di.pos.distanceTo(me.pos);
    if (!di.pilot && d < di.reach) { toast(`Arrivée : ${di.name}`, true); dest = null; renderPilots(); }
    placeMarker(mark, di.pos);
    if (slow) {
      mark.querySelector('b').textContent = di.name;
      mark.querySelector('small').textContent = fmtKm(d);
      const spd = me.vel.length();
      $('#hudDest').textContent = `➜ ${di.name} · ${fmtKm(d)}${spd > 20 ? ` · arrivée ~${fmtTime(d / spd)}` : ''}`;
    }
  } else if (slow) $('#hudDest').textContent = '';
  if (!slow) return;

  // Découvertes (journal)
  for (const b of PLACES) if (!progress.has(b.id) && visited(b, me.pos)) celebrate(progress.discover(b.id), `✦ Découverte : ${b.name}`);
  const v = byId('visiteuse');
  if (shown(v) && visited(v, me.pos) && state.event) celebrate(progress.discover(`visiteuse-${state.event.start}`, 150), '✦ Comète visiteuse approchée');
  if (now - lastFlush > 5000) { lastFlush = now; progress.flush(); }

  // Station : accueil radio, grésillements, hangar
  const ds = me.pos.distanceTo(STATION.pos);
  if (ds < 1500 && !nearStation) { nearStation = true; radio(`Station Horizon : bienvenue, pilote ${state.me}. Amarrage autorisé${me.hull < 90 ? ', réparations en cours' : ''}.`); }
  if (ds > 3000) nearStation = false;
  if (ds < 1500 && now - lastRadio > 5000 + Math.random() * 4000) { lastRadio = now; sfx.radio(); }
  $('#prompt').hidden = !me.docked;
  if (me.hull < 30 && now - lastAlarm > 1500) { lastAlarm = now; sfx.alarm(); }

  // Tableau de bord
  const speed = me.vel.length(), nb = nearest(me.pos).body;
  $('#spd').textContent = Math.round(speed * KM).toLocaleString('fr-FR');
  $('#boostBar').style.width = `${me.boost * 100}%`;
  $('#hullBar').style.width = `${Math.max(0, me.hull)}%`;
  $('#hullBar').parentElement.classList.toggle('low', me.hull < 35);
  const alt = nb && !['station', 'zone', 'comet', 'star'].includes(nb.kind) && me.pos.distanceTo(nb.pos) < nb.r * 2 ? me.pos.distanceTo(nb.pos) - groundRadius(nb, me.pos) : null;
  $('#alt').textContent = alt === null ? '' : `Altitude ${fmtKm(alt)} · ${nb.name}`;
  const storm = state?.event?.type === 'storm' ? state.event : null;
  $('#shipState').textContent = me.docked ? '⚓ À la station · réparations' : me.exposed ? '☀ Tempête solaire : à découvert !' : storm?.phase === 'active' ? '🛡 À l’abri de la tempête'
    : me.heat ? '🔥 Surchauffe : éloigne-toi du Soleil !' : me.hull < 35 ? '⚠ Coque endommagée' : me.boosting ? '⚡ Boost' : me.cruise > 4 && speed > 300 ? '✦ Croisière' : '● Systèmes nominaux';
  $('#hudName').textContent = state?.me ?? '';
  $('#hudZone').textContent = zoneName(me.pos);
  const ev = state?.event, left = ev ? Math.max(0, (ev.end - (Date.now() + clockOffset)) / 1000) : 0;
  $('#hudEvent').textContent = !ev ? '' : ev.type === 'storm' ? (ev.phase === 'warning' ? `⚠ Tempête solaire dans ${fmtTime(left)}` : `☀ Tempête solaire · encore ${fmtTime(left)}`)
    : ev.type === 'meteors' ? `☄ Pluie de météorites près de ${byId(ev.target)?.name} · ${fmtTime(left)}` : `✧ Comète visiteuse · encore ${fmtTime(left)}`;
  for (const el of document.querySelectorAll('[data-dist]')) {
    const r = remotes.get(el.dataset.dist);
    if (r?.group.visible) el.textContent = fmtKm(r.pos.distanceTo(me.pos));
  }
  const cool = Math.max(0, me.tpReady - Date.now());
  for (const b of document.querySelectorAll('[data-tp]')) { b.disabled = cool > 0; b.textContent = cool > 0 ? `${Math.ceil(cool / 1000)}` : '⤴'; }
  // Musique selon la zone
  const sun = me.pos.length(), near = id => me.pos.distanceTo(byId(id).pos);
  setMood(sun < 9000 ? 'soleil' : near('terre') < 6000 ? 'terre' : near('mars') < 6000 ? 'mars' : nearest(me.pos).inBelt ? 'ceinture' : sun > 85000 ? 'confins' : sun > 45000 ? 'geantes' : 'terre');
}

/* ---------- Mini-carte (cap vers le haut) ---------- */
const mm = $('#minimap'), mctx = mm.getContext('2d');
let mmRange = 3000;
function drawMinimap(dt) {
  const S = mm.width, R = S / 2 - 8, speed = me.vel.length();
  mmRange = damp(mmRange, clamp(speed * 7, 3000, 60000), 1.5, dt);
  const k = R / mmRange, cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
  // Repère horizontal du vaisseau : droite = (cos, 0, -sin), avant = (-sin, 0, -cos)
  const toMap = p => { const x = p.x - me.pos.x, z = p.z - me.pos.z; return [(x * cy - z * sy) * k, (x * sy + z * cy) * k]; };
  const clampEdge = (x, y, m = 4) => { const d = Math.hypot(x, y); return d > R ? [x * (R - m) / d, y * (R - m) / d, true] : [x, y, false]; };
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
  // Ceintures (astéroïdes, Kuiper)
  const [bx, by] = toMap(new V3());
  for (const ring of [BELT, KUIPER_RING]) {
    mctx.strokeStyle = 'rgba(199,179,154,.18)';
    mctx.lineWidth = Math.max(1, (ring.outer - ring.inner) * k);
    mctx.beginPath(); mctx.arc(bx, by, ((ring.inner + ring.outer) / 2) * k, 0, Math.PI * 2); mctx.stroke();
  }
  for (const b of BODIES) {
    if (!shown(b) || b.ring) continue;
    if (b.kind === 'zone') {
      const [x, y] = toMap(b.pos);
      mctx.setLineDash([3, 3]); mctx.strokeStyle = 'rgba(199,179,154,.6)'; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(x, y, b.r * k, 0, Math.PI * 2); mctx.stroke(); mctx.setLineDash([]);
      continue;
    }
    let [x, y] = toMap(b.pos), r = Math.max(b.kind === 'moon' ? 1.5 : 2.5, b.r * k), out;
    [x, y, out] = clampEdge(x, y, 3);
    if (out && b.kind === 'moon') continue;
    if (out) r = Math.min(r, 3);
    mctx.fillStyle = b.color;
    mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
  }
  // Pilotes (triangles orientés selon leur cap), pings et destination
  const tri = (x, y, ang, color, s = 5) => {
    mctx.save(); mctx.translate(x, y); mctx.rotate(ang); mctx.fillStyle = color;
    mctx.beginPath(); mctx.moveTo(0, -s * 1.3); mctx.lineTo(s, s); mctx.lineTo(-s, s); mctx.closePath(); mctx.fill(); mctx.restore();
  };
  for (const r of remotes.values()) {
    if (!r.group.visible) continue;
    const [x, y] = clampEdge(...toMap(r.pos)), f = new V3(0, 0, -1).applyQuaternion(r.quat), [fx, fy] = toMap(rel.copy(me.pos).add(f));
    tri(x, y, Math.atan2(fx, -fy), r.color);
  }
  for (const p of pings.values()) {
    const [x, y] = clampEdge(...toMap(pingPos(p)));
    mctx.strokeStyle = p.color; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(x, y, 4 + 2 * Math.sin(performance.now() / 150), 0, Math.PI * 2); mctx.stroke();
  }
  const di = destInfo();
  if (di) {
    const [x, y] = clampEdge(...toMap(di.pos));
    mctx.save(); mctx.translate(x, y); mctx.rotate(Math.PI / 4); mctx.strokeStyle = '#ffc94d'; mctx.lineWidth = 2; mctx.strokeRect(-4, -4, 8, 8); mctx.restore();
  }
  tri(0, 0, 0, '#ffffff', 6);
  mctx.restore();
  $('#mmRange').textContent = `Rayon ${fmtKm(mmRange)}`;
}

/* ---------- Carte du système ---------- */
let mapOpen = false, mapHover = null, mapSel = null;
const mapCanvas = $('#mapCanvas'), mapCtx = mapCanvas.getContext('2d');
const MAP_MAX = 175000;
function toggleMap(open = !mapOpen) {
  mapOpen = open;
  $('#map').hidden = !open;
  if (open) { document.exitPointerLock?.(); keys.clear(); mapSel = null; $('#mapInfo').hidden = true; }
  $('#lockHint').hidden = locked || open;
}
$('#mapBtn').onclick = () => toggleMap();
$('#mapClose').onclick = () => toggleMap(false);
// Échelle en racine carrée : les planètes proches du Soleil restent lisibles, Pluton tient dans l'écran.
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
  const host = BODIES.find(b => (b.kind === 'planet' || b.kind === 'dwarf') && b.pos !== p && p.distanceTo(b.pos) < 8000);
  if (!host) return mapXY(p, g);
  const [hx, hy] = mapXY(host.pos, g), dx = p.x - host.pos.x, dz = p.z - host.pos.z, d = Math.hypot(dx, dz) || 1, off = clamp(10 + d / 220, 12, 42);
  return [hx + (dx / d) * off, hy + (dz / d) * off];
}
function mapItems(g) {
  const items = BODIES.filter(b => shown(b) && !b.ring).map(b => ({ b, xy: ['planet', 'star', 'dwarf'].includes(b.kind) ? mapXY(b.pos, g) : mapPoint(b.pos, g) }));
  for (const r of remotes.values()) if (r.group.visible) items.push({ pilot: r, xy: mapPoint(r.pos, g) });
  return items;
}
function drawMap() {
  const dpr = Math.min(devicePixelRatio, 2), g = mapGeom();
  if (mapCanvas.width !== Math.round(g.w * dpr)) { mapCanvas.width = g.w * dpr; mapCanvas.height = g.h * dpr; }
  const c = mapCtx, now = performance.now();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, g.w, g.h);
  const ring = d => Math.sqrt(d / MAP_MAX) * g.R;
  for (const [R, col] of [[BELT, 'rgba(199,179,154,.12)'], [KUIPER_RING, 'rgba(159,179,200,.1)']]) {
    c.strokeStyle = col;
    c.lineWidth = ring(R.outer) - ring(R.inner);
    c.beginPath(); c.arc(g.cx, g.cy, (ring(R.outer) + ring(R.inner)) / 2, 0, Math.PI * 2); c.stroke();
  }
  c.lineWidth = 1;
  for (const b of BODIES) if (b.kind === 'planet' || b.kind === 'dwarf') { c.strokeStyle = 'rgba(140,170,255,.13)'; c.beginPath(); c.arc(g.cx, g.cy, ring(Math.hypot(b.pos.x, b.pos.z)), 0, Math.PI * 2); c.stroke(); }
  const sun = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, 40);
  sun.addColorStop(0, 'rgba(255,220,140,.9)'); sun.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = sun; c.beginPath(); c.arc(g.cx, g.cy, 40, 0, Math.PI * 2); c.fill();
  const items = mapItems(g), ev = state?.event;
  c.textAlign = 'center';
  for (const it of items) {
    const [x, y] = it.xy, hot = it === mapHover || (it.b && it.b === mapSel?.b) || (it.pilot && it.pilot === mapSel?.pilot);
    if (it.b) {
      const b = it.b;
      if (b.kind === 'zone') { c.setLineDash([3, 3]); c.strokeStyle = b.color; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      else if (b.kind === 'station') { c.fillStyle = b.color; c.fillRect(x - 3.5, y - 3.5, 7, 7); }
      else if (b.kind === 'comet') {
        const a = Math.atan2(y - g.cy, x - g.cx); // queue à l'opposé du Soleil
        const tl = c.createLinearGradient(x, y, x + Math.cos(a) * 26, y + Math.sin(a) * 26);
        tl.addColorStop(0, b.color); tl.addColorStop(1, 'rgba(190,240,255,0)');
        c.strokeStyle = tl; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); c.stroke(); c.lineWidth = 1;
        c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
      } else {
        const r = b.kind === 'star' ? 9 : b.kind === 'moon' ? 2.5 : b.kind === 'dwarf' ? 3 : Math.max(4, Math.sqrt(b.r) / 4.5);
        c.fillStyle = b.color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        if (b.ringIn) { c.strokeStyle = 'rgba(229,207,152,.7)'; c.beginPath(); c.ellipse(x, y, r * 2.1, r * 0.8, -0.4, 0, Math.PI * 2); c.stroke(); }
        if (ev?.type === 'meteors' && ev.phase === 'active' && ev.target === b.id) { c.strokeStyle = `rgba(255,140,60,${0.5 + 0.5 * Math.sin(now / 150)})`; c.beginPath(); c.arc(x, y, r + 10, 0, Math.PI * 2); c.stroke(); }
      }
      if (b.kind !== 'moon' || hot) {
        c.fillStyle = hot ? '#fff' : b.kind === 'moon' ? '#8b97b8' : '#cfd8ff';
        c.font = `${['planet', 'star', 'dwarf'].includes(b.kind) ? 700 : 500} 12px Oxanium, monospace`;
        c.fillText(b.name, x, y + (b.kind === 'star' ? 26 : 20));
      }
    } else {
      c.fillStyle = it.pilot.color; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 5, y + 5); c.lineTo(x - 5, y + 5); c.closePath(); c.fill();
      c.font = '700 11px Oxanium, monospace'; c.fillText(it.pilot.name, x, y - 11);
    }
    if (hot) { c.strokeStyle = '#ffc94d'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; }
  }
  for (const [name, p] of pings) {
    const [x, y] = mapPoint(pingPos(p), g);
    c.strokeStyle = p.color; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6 + 3 * Math.sin(now / 150), 0, Math.PI * 2); c.stroke(); c.lineWidth = 1;
    c.fillStyle = p.color; c.font = '600 10px Oxanium, monospace'; c.fillText(`📍 ${name}`, x, y + 18);
  }
  const [mx, my] = mapPoint(me.pos, g);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(mx, my, 4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.beginPath(); c.arc(mx, my, 8 + 3 * Math.sin(now / 200), 0, Math.PI * 2); c.stroke();
  c.font = '700 11px Oxanium, monospace'; c.fillText('Toi', mx, my - 12);
  const di = destInfo();
  if (di) {
    const [dx, dy] = di.pilot ? mapPoint(di.pos, g) : items.find(i => i.b?.name === di.name)?.xy ?? mapXY(di.pos, g);
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
  info.style.setProperty('--c', b.color);
  info.innerHTML = `<h3>${esc(b.name)}</h3><p class="facts">${KIND[b.kind]} · à ${fmtKm(b.pos.distanceTo(me.pos) - (['zone', 'comet'].includes(b.kind) ? 0 : b.r))}${progress.has(b.id) ? ' · ✓ découvert' : ''}</p>
    <p>${esc(b.desc)}</p><p>${near.length ? `👥 Pilotes à proximité : ${near.map(esc).join(', ')}` : 'Aucun pilote à proximité.'}</p>
    <p>✓ Destination choisie : suis le repère jaune.</p>${b.kind === 'station' ? '<button class="ghost small" id="warpHome">⟲ Revenir directement à la station</button>' : ''}`;
};
$('#mapInfo').onclick = e => { if (e.target.id === 'warpHome') { spawn(); setDest(null); toggleMap(false); toast('Retour à la station Horizon', true); } };

/* ---------- Réglages du son ---------- */
const settings = { sound: store.get('se-muted') !== '1', music: store.get('se-music') !== '0' };
setAudio(settings);
const renderSound = () => { const s = audioSettings(); $('#soundBtn').textContent = s.sound ? '🔊' : '🔇'; $('#musicBtn').textContent = s.music ? '🎵' : '🎵̸'; $('#musicBtn').classList.toggle('off', !s.music); };
$('#soundBtn').onclick = () => { const s = !audioSettings().sound; setAudio({ sound: s }); store.set('se-muted', s ? '0' : '1'); renderSound(); };
$('#musicBtn').onclick = () => { const m = !audioSettings().music; setAudio({ music: m }); store.set('se-music', m ? '1' : '0'); renderSound(); };
renderSound();

/* ---------- Boucle ---------- */
let last = performance.now(), stormLevel = 0;
const hostPrev = new V3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!launched || !world || !myShip.mesh) return engineSound(false, 0, false);
  // Les astres avancent sur leur orbite ; tout près d'un astre, le vaisseau est entraîné avec lui.
  const host = hostOf(me.pos);
  if (host) hostPrev.copy(host.pos);
  const ev = state?.event;
  stormLevel = damp(stormLevel, ev?.type === 'storm' ? (ev.phase === 'active' ? 1 : 0.25) : 0, 1, dt);
  world.update(worldT(), camera.position, stormLevel);
  if (host) me.pos.add(rel.subVectors(host.pos, hostPrev));
  if (!flying()) return engineSound(false, 0, false);
  if (mapOpen || !$('#journal').hidden || !$('#chatForm').hidden) keys.clear();
  const thrust = fly(dt, now);
  updateCamera(dt);
  updateRemotes(now, dt);
  updateDust(stormLevel);
  updateFx(dt);
  myShip.trail.update(rel.set(0, 0, 3.5).applyQuaternion(myShip.mesh.quaternion).add(me.pos), camera.position, clamp((me.vel.length() - 20) / 120, 0, 1), dt);
  $('#stormFx').style.opacity = me.exposed ? 0.55 : stormLevel * 0.25;
  composer.render();
  hud(now);
  drawMinimap(dt);
  if (mapOpen) drawMap();
  sendPos(now);
  engineSound(true, thrust, me.boosting);
  music();
}
requestAnimationFrame(frame);
