// Top Formula : menus, garage, modes de jeu (course rapide, contre-la-montre, multijoueur), boucle de course, HUD, résultats.
import * as THREE from 'three';
import { TRACKS, trackById, buildTrack, gridSlot, locate } from './tracks.js';
import { createCar, stepCar, collideCars, aero, KMH, CAR, env } from './physics.js';
import { LEVELS, createBrain, drive } from './ai.js';
import { createView, buildCar } from './render.js';
import * as SND from './audio.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
  json: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = sec => sec == null || !Number.isFinite(sec) ? '—' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${String(Math.floor((sec * 1000) % 1000)).padStart(3, '0')}`;
const params = new URLSearchParams(location.search);

const STEP = 1 / 120;
const COLORS = ['#e10600', '#ff8700', '#ffd400', '#2fd47a', '#00d2be', '#2d7dff', '#0600ef', '#a46bff', '#f596c8', '#ffffff', '#b6babd', '#1b1b1b', '#7a1f2b', '#006f62'];
const RIMS = ['#c9ccd2', '#d4af37', '#1b1b1b', '#ffffff', '#e10600', '#2d7dff'];
const MOTIFS = [{ id: 'plain', name: 'Uni', cost: 0 }, { id: 'stripe', name: 'Bande', cost: 0 }, { id: 'arrow', name: 'Flèches', cost: 300 }, { id: 'split', name: 'Bicolore', cost: 600 }];
// Écuries et pilotes inventés
const RIVALS = [
  { name: 'Varga', color: '#00d2be', accent: '#1b1b1b', number: 44 }, { name: 'Okafor', color: '#ff8700', accent: '#0a2a5c', number: 4 },
  { name: 'Lindqvist', color: '#0600ef', accent: '#ff1e1e', number: 1 }, { name: 'Moreau', color: '#2b4562', accent: '#ff5fb0', number: 10 },
  { name: 'Takeda', color: '#ffffff', accent: '#e10600', number: 22 }, { name: 'Romano', color: '#c00000', accent: '#ffd400', number: 16 },
  { name: 'Silva', color: '#006f62', accent: '#d4ff00', number: 14 }, { name: 'Novak', color: '#b6babd', accent: '#e10600', number: 27 },
  { name: 'Haddad', color: '#52e252', accent: '#111111', number: 77 }, { name: 'Kowalski', color: '#a46bff', accent: '#ffffff', number: 31 },
];
const PLACE_CREDITS = [100, 70, 50, 40, 30, 20, 15, 10, 5, 5];

const profile = Object.assign({ look: { color: '#e10600', accent: '#ffffff', helmet: '#ffd400', rim: '#c9ccd2', motif: 'stripe', number: 7 }, credits: 0, records: {}, owned: ['plain', 'stripe'] }, store.json('formula-profile') || {});
const saveProfile = () => store.set('formula-profile', JSON.stringify(profile));
const settings = Object.assign({ quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'high' }, store.json('formula-settings') || {});
let pseudo = store.get('formula-pseudo') || store.get('golf-pseudo') || store.get('pseudo') || '';

/* ---------------- Écrans ---------------- */
let screen = 'menu';
function show(id) {
  screen = id;
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  $('#hud').hidden = id !== 'race';
  document.body.classList.toggle('racing', id === 'race');
  $$('.creditsVal').forEach(e => (e.textContent = profile.credits));
  if (id !== 'race') window.scrollTo(0, 0);
}
function go(id) {
  if (id === 'menu' && race && race.cfg.mode !== 'demo') { stopRace(); startDemo(); }
  show(id);
  garageLoop(id === 'garage');
  if (id === 'tt') loadBoard();
  if (id === 'setup' || id === 'tt') renderTracks();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { SND.startAudio(); go(b.dataset.go); } });

/* ---------------- Cartes des circuits ---------------- */
const sel = { quick: store.get('formula-track') || 'riviera', tt: store.get('formula-tt-track') || 'riviera' };
function drawMini(c, t, opts = {}) {
  const W = c.width = c.clientWidth * devicePixelRatio || 300, H = c.height = c.clientHeight * devicePixelRatio || 190, g = c.getContext('2d');
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < t.N; i++) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); y0 = Math.min(y0, t.y[i]); y1 = Math.max(y1, t.y[i]); }
  const pad = opts.pad ?? 0.1, sc = Math.min(W * (1 - 2 * pad) / (x1 - x0), H * (1 - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
  const P = (x, y) => [ox + x * sc, oy + y * sc];
  g.clearRect(0, 0, W, H);
  g.lineJoin = g.lineCap = 'round';
  const path = () => { g.beginPath(); for (let i = 0; i <= t.N; i += 2) { const [a, b] = P(t.x[i % t.N], t.y[i % t.N]); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.closePath(); };
  path(); g.strokeStyle = opts.edge ?? '#3b4252'; g.lineWidth = Math.max(5, t.def.width * sc * 1.6); g.stroke();
  path(); g.strokeStyle = opts.color ?? '#e9ecf1'; g.lineWidth = Math.max(2, t.def.width * sc * 0.6); g.stroke();
  // zones DRS
  g.strokeStyle = '#2d7dff';
  for (const z of t.drs) { g.beginPath(); for (let k = z.from, n = 0; k !== z.to; k = (k + 1) % t.N, n++) { const [a, b] = P(t.x[k], t.y[k]); n ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke(); }
  const [sa, sb] = P(t.x[0], t.y[0]); g.fillStyle = '#e10600'; g.fillRect(sa - 3 * devicePixelRatio, sb - 3 * devicePixelRatio, 6 * devicePixelRatio, 6 * devicePixelRatio);
  return P;
}
function renderTracks() {
  for (const box of $$('[data-tracks]')) {
    const kind = box.dataset.tracks, cur = kind === 'room' ? room?.settings.track : sel[kind];
    box.innerHTML = TRACKS.map(d => `<button class="track ${d.id === cur ? 'on' : ''}" data-track="${d.id}" ${kind === 'room' && room?.host !== room?.me ? 'disabled' : ''}>
      <canvas></canvas><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>
      <span class="rec">${profile.records[d.id] ? `⏱ Ton record : ${fmt(profile.records[d.id])}` : ' '}</span></button>`).join('');
    box.querySelectorAll('.track').forEach(b => drawMini(b.querySelector('canvas'), buildTrack(trackById(b.dataset.track))));
  }
  $('#ttTrackName').textContent = trackById(sel.tt).name;
  $('#ttMine').textContent = fmt(profile.records[sel.tt]);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-track]'); if (!b || b.disabled) return;
  const kind = b.closest('[data-tracks]').dataset.tracks;
  if (kind === 'room') return act('configure', 'track', b.dataset.track);
  sel[kind] = b.dataset.track;
  store.set(kind === 'tt' ? 'formula-tt-track' : 'formula-track', sel[kind]);
  renderTracks();
  if (kind === 'tt') loadBoard();
});

/* ---------------- Course rapide : réglages ---------------- */
const quick = Object.assign({ laps: 3, opponents: 7, level: 2 }, store.json('formula-quick') || {});
$('#qLaps').innerHTML = [1, 2, 3, 5, 8, 10].map(n => `<option value="${n}">${n} tour${n > 1 ? 's' : ''}</option>`).join('');
$('#rLaps').innerHTML = $('#qLaps').innerHTML;
$('#qLaps').value = quick.laps;
$('#qOpp').value = quick.opponents; $('#qOppOut').textContent = quick.opponents;
const levelChips = () => ($('#qLevel').innerHTML = LEVELS.map((l, k) => `<button data-level="${k}" class="${k === quick.level ? 'on' : ''}">${l.name}</button>`).join(''));
levelChips();
$('#qLevel').onclick = e => { const b = e.target.closest('[data-level]'); if (b) { quick.level = Number(b.dataset.level); levelChips(); } };
$('#qOpp').oninput = () => ($('#qOppOut').textContent = $('#qOpp').value);
$('#qGo').onclick = () => {
  Object.assign(quick, { laps: Number($('#qLaps').value), opponents: Number($('#qOpp').value) });
  store.set('formula-quick', JSON.stringify(quick));
  SND.startAudio();
  startRace({ mode: 'quick', track: sel.quick, ...quick, ...cond });
};
$('#ttGo').onclick = () => { SND.startAudio(); startRace({ mode: 'tt', track: sel.tt, ...cond }); };

/* ---------------- Conditions : météo et moment de la journée ---------------- */
const cond = Object.assign({ weather: 'dry', time: 'day' }, store.json('formula-cond') || {});
const COND = [['weather', 'dry', '☀️ Sec'], ['weather', 'rain', '🌧️ Pluie'], ['time', 'day', '🕛 Jour'], ['time', 'sunset', '🌇 Coucher de soleil']];
function renderCond() {
  for (const box of $$('[data-cond]')) {
    const isRoom = box.dataset.cond === 'room', src = isRoom ? room?.settings : cond, off = isRoom && room?.host !== room?.me;
    box.innerHTML = COND.map(([k, v, l]) => `<button data-ck="${k}" data-cv="${v}" class="${src?.[k] === v ? 'on' : ''}" ${off ? 'disabled' : ''}>${l}</button>`).join('');
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ck]'); if (!b || b.disabled) return;
  if (b.closest('[data-cond]').dataset.cond === 'room') return act('configure', b.dataset.ck, b.dataset.cv);
  cond[b.dataset.ck] = b.dataset.cv; store.set('formula-cond', JSON.stringify(cond)); renderCond();
});

/* ---------------- Classement mondial du contre-la-montre ---------------- */
async function loadBoard() {
  const ol = $('#ttBoard');
  try {
    const list = await (await fetch(`/api/formula/board?track=${sel.tt}`)).json();
    ol.innerHTML = list.length ? list.map(e => `<li class="${e.name === pseudo ? 'me' : ''}">${esc(e.name)} <b>${fmt(e.ms / 1000)}</b></li>`).join('') : '<li class="hint">Personne encore : sois le premier !</li>';
  } catch { ol.innerHTML = '<li class="hint">Classement indisponible.</li>'; }
}
async function submitLap(track, sec) {
  if (!pseudo) return null;
  try {
    const r = await (await fetch('/api/formula/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track, name: pseudo, ms: Math.round(sec * 1000) }) })).json();
    return r.place ?? null;
  } catch { return null; }
}

/* ---------------- Réglages ---------------- */
$('#volume').value = SND.getVolume();
$('#volume').oninput = e => SND.setVolume(Number(e.target.value));
$('#quality').value = settings.quality;
$('#quality').onchange = e => { settings.quality = e.target.value; store.set('formula-settings', JSON.stringify(settings)); if (race?.cfg.mode === 'demo') startDemo(); };

/* ---------------- Garage ---------------- */
let garage = null;
function garageLoop(on) {
  if (!on) { if (garage) { cancelAnimationFrame(garage.raf); garage.renderer.dispose(); garage = null; } return; }
  const canvas = $('#garageView');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.1, 100);
  cam.position.set(6, 5.5, 7); cam.lookAt(0, 0.3, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#30384a', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(4, 8, 3); key.castShadow = true; scene.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.6, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  garage = { renderer, scene, cam, car: null, raf: 0 };
  garageCar();
  const loop = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (garage.car) garage.car.rotation.y += 0.008;
    renderer.render(scene, cam);
    garage.raf = requestAnimationFrame(loop);
  };
  loop();
  renderGarage();
}
function garageCar() {
  if (!garage) return;
  const rot = garage.car?.rotation.y ?? 0.6;
  if (garage.car) garage.scene.remove(garage.car);
  garage.car = buildCar(profile.look).group;
  garage.car.rotation.y = rot;
  garage.scene.add(garage.car);
}
function renderGarage() {
  for (const box of $$('[data-look]')) {
    const key = box.dataset.look, list = key === 'rim' ? RIMS : COLORS;
    box.innerHTML = list.map(c => `<button style="background:${c}" data-c="${c}" class="${profile.look[key] === c ? 'on' : ''}" aria-label="${c}"></button>`).join('');
  }
  $('#motifs').innerHTML = MOTIFS.map(m => `<button data-motif="${m.id}" class="${profile.look.motif === m.id ? 'on' : ''} ${profile.owned.includes(m.id) ? '' : 'lock'}">${m.name}${profile.owned.includes(m.id) ? '' : ` · 🪙 ${m.cost}`}</button>`).join('');
  $('#number').value = profile.look.number;
  $$('.creditsVal').forEach(e => (e.textContent = profile.credits));
}
$('#garage').addEventListener('click', e => {
  const c = e.target.closest('[data-c]');
  if (c) { profile.look[c.closest('[data-look]').dataset.look] = c.dataset.c; }
  const m = e.target.closest('[data-motif]');
  if (m) {
    const def = MOTIFS.find(x => x.id === m.dataset.motif);
    if (!profile.owned.includes(def.id)) {
      if (profile.credits < def.cost) return toast(`Il te faut ${def.cost} crédits (gagne-les en course)`, 'warn', true);
      profile.credits -= def.cost; profile.owned.push(def.id);
    }
    profile.look.motif = def.id;
  }
  if (!c && !m) return;
  saveProfile(); renderGarage(); garageCar();
});
$('#number').onchange = e => { profile.look.number = Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 7))); saveProfile(); renderGarage(); garageCar(); };

/* ---------------- Commandes ---------------- */
const keys = new Set();
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (screen === 'race' && GAME_KEYS.includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (screen !== 'race' || !race) return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && !e.repeat) respawn(race.player);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// Boutons tactiles
const touchUI = matchMedia('(pointer: coarse)').matches;
$('#touch').hidden = !touchUI;
for (const b of $$('#touch [data-key]')) {
  const down = e => { e.preventDefault(); keys.add(b.dataset.key); b.classList.add('held'); SND.startAudio(); };
  const up = () => { keys.delete(b.dataset.key); b.classList.remove('held'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
function readInput() {
  const k = c => keys.has(c);
  const inp = {
    steer: (k('ArrowLeft') || k('KeyA') ? 1 : 0) - (k('ArrowRight') || k('KeyD') ? 1 : 0),
    throttle: k('ArrowUp') || k('KeyW') ? 1 : 0, brake: k('ArrowDown') || k('KeyS') ? 1 : 0,
    handbrake: k('Space'), drs: k('KeyE') || k('ShiftLeft') || k('ShiftRight'),
  };
  const gp = navigator.getGamepads?.()[0];
  if (gp) {
    if (Math.abs(gp.axes[0]) > 0.12) inp.steer = -gp.axes[0];
    inp.throttle = Math.max(inp.throttle, gp.buttons[7]?.value ?? 0);
    inp.brake = Math.max(inp.brake, gp.buttons[6]?.value ?? 0);
    inp.handbrake ||= !!gp.buttons[0]?.pressed;
    inp.drs ||= !!gp.buttons[5]?.pressed;
  }
  return inp;
}

/* ---------------- Course ---------------- */
let race = null, view = null, raf = 0, last = 0;
function stopRace() {
  cancelAnimationFrame(raf);
  $('#pause').hidden = true;
  if (view) { view.dispose(); view = null; }
  race = null;
  SND.updateAudio(null, null, 0, { on: false });
  SND.setRain(false);
}
function startDemo() {
  startRace({ mode: 'demo', track: TRACKS[Math.floor(Math.random() * TRACKS.length)].id, weather: Math.random() < 0.25 ? 'rain' : 'dry', time: Math.random() < 0.35 ? 'sunset' : 'day' });
}

function startRace(cfg) {
  stopRace();
  const def = trackById(cfg.track), t = buildTrack(def);
  // Nouveau canvas : un contexte WebGL neuf par course.
  const old = $('#view'), canvas = old.cloneNode(false); old.replaceWith(canvas);
  env.wet = cfg.weather === 'rain'; // avant tout calcul des robots : ils freinent plus tôt sous la pluie
  view = createView(canvas, t, { quality: settings.quality, weather: cfg.weather, time: cfg.time });
  SND.setRain(env.wet && cfg.mode !== 'demo');
  view.resize();
  const cars = [];
  const laps = cfg.mode === 'tt' ? Infinity : cfg.laps ?? def.laps;
  const add = (slot, extra) => { const c = createCar(t, gridSlot(t, slot), extra); cars.push(c); view.addCar(c.id, c.look, { ghost: c.ghost }); return c; };
  let player = null;
  const rivals = RIVALS.filter(r => r.color !== profile.look.color);
  if (cfg.mode === 'quick' || cfg.mode === 'demo') {
    const n = cfg.mode === 'demo' ? 8 : cfg.opponents + 1, mySlot = cfg.mode === 'demo' ? -1 : Math.min(n - 1, Math.round((n - 1) * 0.6));
    const level = LEVELS[cfg.mode === 'demo' ? 3 : cfg.level];
    for (let k = 0, r = 0; k < n; k++) {
      if (k === mySlot) player = add(k, { id: 'me', name: pseudo || 'Toi', look: profile.look, brain: createBrain(LEVELS[2]), me: true });
      else { const R = rivals[r++ % rivals.length]; add(k, { id: 'bot' + k, name: R.name, look: { color: R.color, accent: R.accent, helmet: R.accent, motif: ['stripe', 'arrow', 'split', 'plain'][k % 4], number: R.number }, brain: createBrain(level), perf: level.perf }); }
    }
  }
  if (cfg.mode === 'tt') {
    player = add(0, { id: 'me', name: pseudo || 'Toi', look: profile.look, brain: createBrain(LEVELS[2]), me: true, flying: true });
    const data = store.json(`formula-ghost-${def.id}`);
    if (data?.length) add(0, { id: 'ghost', ghost: true, name: 'Fantôme', look: { ...profile.look, color: '#bfe3ff', accent: '#ffffff' }, data });
  }
  if (cfg.mode === 'multi') {
    cfg.grid.forEach((name, k) => {
      const p = cfg.players.find(x => x.name === name), look = p?.look ?? { color: '#888', accent: '#fff', number: k + 1 };
      if (name === cfg.me && !cfg.spectator) player = add(k, { id: 'me', name, netName: name, look: p?.look ?? profile.look, brain: createBrain(LEVELS[2]), me: true });
      else add(k, { id: 'p:' + name, name, netName: name, look, remote: true, snaps: [], hidden: true });
    });
  }
  race = {
    cfg, t, cars, player, laps, clock: 0, goAt: 5 + (cfg.mode === 'multi' ? 1 : 0.4 + Math.random() * 1.2), acc: 0, paused: false,
    overtakes: 0, lastPos: 0, rec: [], recAt: 0, lastSend: -Infinity, done: false, results: null, follow: player, followSwitch: 0, msgUntil: 0, towerAt: 0, lastLap: 0,
  };
  if (params.has('debug')) Object.assign(window, { race, view }); // pour les tests
  if (cfg.mode === 'demo') race.clock = race.goAt + 0.01;
  if (cfg.mode === 'multi') race.clock = clockTarget();
  race.lastPos = player ? standings().indexOf(player) + 1 : 0;
  setupHud();
  $('#pause').hidden = true;
  if (cfg.mode !== 'demo') show('race');
  last = performance.now();
  raf = requestAnimationFrame(frame);
}
const clockTarget = () => race.goAt + (Date.now() + serverOffset - race.cfg.startAt) / 1000;
const standings = () => race.cars.filter(c => !c.ghost).sort((a, b) => (a.finished ?? Infinity) - (b.finished ?? Infinity) || b.s - a.s);
const raceTime = () => race.clock - race.goAt;

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!race) return;
  // Avance la simulation par pas fixes ; en multijoueur on suit l'horloge du serveur.
  if (race.cfg.mode === 'multi') { const target = clockTarget(); if (target - race.clock > 2) race.clock = target - STEP; race.acc = target - race.clock; }
  else if (!race.paused) race.acc += dt;
  // Rattrapage jusqu'à 1 s de retard (onglet ralenti), au-delà on saute.
  let n = 0;
  while (race.acc >= STEP && n++ < 120) { tick(STEP); race.acc -= STEP; }
  if (n > 120) race.acc = 0;
  if (race.cfg.mode === 'multi') interpolateRemotes(now / 1000);
  // Caméra : le joueur, sinon le leader (démo, spectateur), en changeant de voiture de temps en temps en démo.
  if (!race.player) {
    race.followSwitch -= dt;
    if (race.followSwitch <= 0 || !race.follow || race.follow.hidden) { const st = standings().filter(c => !c.hidden); race.follow = race.cfg.mode === 'demo' ? st[Math.floor(Math.random() * Math.min(5, st.length))] : st[0]; race.followSwitch = 9; }
  }
  view.update(race.cars, race.follow, race.paused ? 0 : dt, raceTime());
  view.render();
  if (race.cfg.mode !== 'demo') hud(dt);
}

function tick(h) {
  const { t, cars, player } = race;
  race.clock += h;
  const time = raceTime(), go = time >= 0;
  const active = cars.filter(c => !c.ghost && !c.hidden);
  const leaderLap = Math.max(...active.map(c => c.lap));
  aero(active, t, race.cfg.mode === 'tt' || leaderLap >= 2);
  for (const car of cars) {
    if (car.remote || car.ghost) continue;
    if (!go) { car.vx = car.vy = car.speed = 0; car.input = {}; continue; } // immobile sur la grille
    let input;
    if (car === player && car.finished == null && !race.auto) input = race.paused ? { brake: 1 } : readInput();
    else input = drive(car, car.brain, t, active, h);
    stepCar(car, input, t, h, time);
    if (car.noclip > 0) car.noclip -= h;
    car.input = input;
    // Robot coincé hors piste depuis longtemps : on le remet en piste.
    if (car !== player && go && Math.abs(car.speed) < 1) { car.idle = (car.idle || 0) + h; if (car.idle > 5) respawn(car); } else car.idle = 0;
  }
  collideCars(active);
  // Fantôme du contre-la-montre
  const ghost = cars.find(c => c.ghost);
  if (ghost) placeGhost(ghost, player, time);
  for (const car of cars) {
    for (const e of car.events) onEvent(car, e, time);
    car.events.length = 0;
    if (!car.remote && car.finished == null && car.lap > race.laps) {
      car.finished = time;
      if (car === player) playerFinished(time);
    }
  }
  if (player && race.cfg.mode === 'tt' && player.lap >= 1 && time - race.recAt >= 0.05) {
    race.recAt = time;
    race.rec.push([+(player.s - (player.lap - 1) * t.length).toFixed(1), +(time - player.lapStart).toFixed(3), +player.x.toFixed(2), +player.y.toFixed(2), +player.a.toFixed(3)]);
  }
  // Dépassements du joueur
  if (player && go && time > 3 && player.finished == null) {
    const pos = standings().indexOf(player) + 1;
    if (pos < race.lastPos) { race.overtakes += race.lastPos - pos; if (time > 4) toast(`Dépassement · P${pos}`, 'blue'); }
    race.lastPos = pos;
  }
  if (race.cfg.mode === 'multi' && player) sendPos(time);
}

function respawn(car) {
  if (!car || car.finished != null || raceTime() < 0) return;
  const t = race.t, i = car.i;
  Object.assign(car, { x: t.x[i] + t.nx[i] * t.line[i] * 0.5, y: t.y[i] + t.ny[i] * t.line[i] * 0.5, a: Math.atan2(t.ty[i], t.tx[i]), vx: 0, vy: 0, steer: 0, noclip: 2, idle: 0 });
  if (car === race.player) toast('Remis en piste', 'warn');
}

function onEvent(car, e, time) {
  const near = race.follow && Math.hypot(car.x - race.follow.x, car.y - race.follow.y) < 90;
  if ((e.type === 'wall' || e.type === 'car') && near) {
    view.impact(e.x, e.y, e.power, car.look.color);
    if (car === race.player) { view.shake(Math.min(1.5, e.power * 0.06)); SND.bang(e.power); }
    else if (race.cfg.mode !== 'demo' && e.power > 6) SND.bang(e.power * 0.4);
  }
  if (e.type === 'lap' && car === race.player) {
    const best = car.best === e.time, t = race.t;
    SND.lapChime(best);
    if (race.cfg.mode === 'tt') {
      const rec = profile.records[t.def.id];
      if (best && (rec == null || e.time < rec)) {
        profile.records[t.def.id] = e.time; profile.credits += 50; saveProfile();
        store.set(`formula-ghost-${t.def.id}`, JSON.stringify(race.rec));
        const g = race.cars.find(c => c.ghost);
        if (g) g.data = race.rec; else { const c = createCar(t, gridSlot(t, 0), { id: 'ghost', ghost: true, name: 'Fantôme', look: { ...profile.look, color: '#bfe3ff', accent: '#ffffff' }, data: race.rec }); race.cars.push(c); view.addCar(c.id, c.look, { ghost: true }); }
        toast(`Record personnel · ${fmt(e.time)}`, 'purple');
        submitLap(t.def.id, e.time).then(place => place && toast(`${place}ᵉ du classement mondial !`, 'purple'));
      } else toast(`Tour ${fmt(e.time)}`, best ? 'purple' : '');
      profile.credits += 10; saveProfile();
      race.rec = [];
    } else {
      if (best && car.lapTimes.length > 1) toast(`Meilleur tour · ${fmt(e.time)}`, 'purple');
      if (car.lap === race.laps && race.laps > 1) banner('Dernier tour');
      if (profile.records[t.def.id] == null || e.time < profile.records[t.def.id]) { profile.records[t.def.id] = e.time; saveProfile(); }
    }
  }
}

// Fantôme : rejoue l'enregistrement du meilleur tour au même temps du tour que le joueur.
function placeGhost(g, player, time) {
  const d = g.data;
  if (!player || player.lap < 1 || !d?.length) { g.hidden = true; return; }
  const lt = time - player.lapStart;
  let lo = 0, hi = d.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (d[m][1] < lt) lo = m + 1; else hi = m; }
  const b = d[lo], a = d[Math.max(0, lo - 1)], f = b[1] > a[1] ? Math.max(0, Math.min(1, (lt - a[1]) / (b[1] - a[1]))) : 0;
  let da = b[4] - a[4]; da = Math.atan2(Math.sin(da), Math.cos(da));
  Object.assign(g, { x: a[2] + (b[2] - a[2]) * f, y: a[3] + (b[3] - a[3]) * f, a: a[4] + da * f, hidden: lt > d.at(-1)[1] + 2, speed: Math.hypot(b[2] - a[2], b[3] - a[3]) / Math.max(0.01, b[1] - a[1]) });
}
// Écart avec le fantôme, à la même distance parcourue dans le tour.
function ghostDelta() {
  const g = race.cars.find(c => c.ghost), p = race.player;
  if (!g?.data?.length || p.lap < 1) return null;
  const dist = p.s - (p.lap - 1) * race.t.length, d = g.data;
  let lo = 0, hi = d.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (d[m][0] < dist) lo = m + 1; else hi = m; }
  if (d[lo][0] < dist) return null;
  return raceTime() - p.lapStart - d[lo][1];
}

function playerFinished(time) {
  race.auto = true;
  const pos = standings().indexOf(race.player) + 1;
  banner(pos === 1 ? 'Victoire !' : `Arrivée · P${pos}`, pos === 1 ? 'go' : '');
  SND.fanfare(pos === 1);
  if (race.cfg.mode === 'multi') return act('finish', Math.round(time * 1000), Math.round((race.player.best ?? time) * 1000));
  setTimeout(() => race?.player && race.cfg.mode === 'quick' && soloResults(), 3500);
}

/* ---------------- Résultats ---------------- */
function soloResults() {
  const t = race.t, time = raceTime(), total = race.laps * t.length;
  const rows = standings().map(c => {
    let fin = c.finished;
    if (fin == null) fin = time + Math.max(0, total - c.s) / Math.max(20, c.s > 0 ? c.s / Math.max(1, time) : 30); // temps estimé
    return { name: c.name, look: c.look, time: fin, best: c.best, me: c === race.player };
  }).sort((a, b) => a.time - b.time);
  const fastest = Math.min(...rows.map(r => r.best ?? Infinity));
  const pos = rows.findIndex(r => r.me) + 1, me = rows[pos - 1];
  const mul = [0.5, 0.75, 1, 1.3, 1.6][race.cfg.level] * Math.max(0.34, race.laps / 3);
  const gain = Math.round(((PLACE_CREDITS[pos - 1] ?? 0) * (race.cfg.opponents ? 1 : 0.2) + (me.best === fastest ? 25 : 0)) * mul + race.overtakes * 5);
  profile.credits += gain; saveProfile();
  showResults({
    title: pos === 1 ? 'Victoire !' : `${pos}ᵉ place`, rows, fastest,
    stats: [['Position', `P${pos} / ${rows.length}`], ['Temps total', fmt(me.time)], ['Meilleur tour', fmt(me.best)], ['Dépassements', race.overtakes], ['Crédits gagnés', `+${gain} 🪙`, 'gain']],
    buttons: [['Rejouer', () => startRace(race.cfg), 'primary'], ['Changer de circuit', () => go('setup')], ['Menu', () => go('menu')]],
  });
}
function ttResults() {
  const p = race.player;
  showResults({
    title: 'Contre-la-montre', rows: [], fastest: null,
    stats: [['Tours bouclés', p.lapTimes.length], ['Meilleur tour', fmt(p.best)], ['Record personnel', fmt(profile.records[race.t.def.id])]],
    buttons: [['Rejouer', () => startRace(race.cfg), 'primary'], ['Changer de circuit', () => go('tt')], ['Menu', () => go('menu')]],
  });
}
function showResults({ title, rows, fastest, stats, buttons }) {
  show('results');
  $('#resTitle').textContent = title;
  const top = rows.slice(0, 3);
  $('#podium').innerHTML = rows.length ? [1, 0, 2].filter(k => top[k]).map(k => `<div class="p${k + 1}"><span class="who">${esc(top[k].name)}</span><i class="car" style="background:${top[k].look?.color ?? '#888'}"></i><div class="step">${k + 1}</div></div>`).join('') : '';
  $('#podium').hidden = !rows.length;
  const lead = rows[0]?.time;
  $('#resTable').innerHTML = rows.map((r, k) => `<tr class="${r.me ? 'me' : ''}"><td>${k + 1}</td><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${r.look?.color ?? '#888'}"></i> ${esc(r.name)}</td>
    <td>${r.dnf ? 'Abandon' : k === 0 ? fmt(r.time) : `+${(r.time - lead).toFixed(3)}`}</td><td class="${r.best != null && r.best === fastest ? 'fast' : ''}">${fmt(r.best)}</td></tr>`).join('');
  $('#resTable').closest('.panel').hidden = !rows.length;
  $('#resStats').innerHTML = stats.map(([k, v, cls]) => `<div class="${cls ?? ''}"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#resButtons').innerHTML = '';
  for (const [label, fn, cls] of buttons) { const b = document.createElement('button'); b.textContent = label; b.className = cls ?? 'ghost'; b.onclick = fn; $('#resButtons').append(b); }
}

/* ---------------- HUD ---------------- */
let mini = null;
function setupHud() {
  if (race.cfg.mode === 'demo') return;
  const tt = race.cfg.mode === 'tt';
  $('#hLapOf').textContent = tt ? '' : `/${race.laps}`;
  $('#hDeltaRow').hidden = !tt;
  $('#tower').hidden = tt;
  $('.pos').hidden = tt;
  $('#lights').hidden = race.cfg.mode === 'multi' && raceTime() > 0;
  $('#banner').hidden = true;
  const c = $('#minimap');
  mini = { P: drawMini(c, race.t, { pad: 0.08, color: '#cfd5df', edge: 'rgba(255,255,255,.08)' }), img: null };
  mini.img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
}
let toastTimer = 0;
function toast(text, cls = '', outside = false) {
  const el = $('#toast');
  if (outside) { alert(text); return; }
  el.textContent = text; el.className = `toast ${cls}`; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 1800);
}
let bannerTimer = 0;
function banner(text, cls = '') {
  const el = $('#banner');
  el.textContent = text; el.className = `banner ${cls}`; el.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (el.hidden = true), 2200);
}
let lightsShown = -1;
function hud(dt) {
  const { player, t } = race, time = raceTime(), follow = race.follow;
  // Feux de départ : un feu par seconde, puis extinction = départ.
  const lit = time >= 0 ? 0 : Math.max(0, Math.min(5, Math.floor(race.clock)));
  if (lit !== lightsShown) {
    if (time < 0 && lit > lightsShown && lit > 0) SND.beep(false);
    if (time >= 0 && lightsShown > 0) { SND.beep(true); banner('Go !', 'go'); setTimeout(() => ($('#lights').hidden = true), 600); }
    lightsShown = lit;
    $$('#lights i').forEach((l, k) => l.classList.toggle('on', k < lit));
    if (time < 0) $('#lights').hidden = false;
    view.setLights(lit);
  }
  if (!follow) return;
  const st = standings(), me = follow;
  $('#hPos').textContent = `P${st.indexOf(me) + 1}`; $('#hPosOf').textContent = `/${st.length}`;
  $('#hLap').textContent = race.cfg.mode === 'tt' ? Math.max(1, me.lap) : Math.min(race.laps, Math.max(1, me.lap));
  const cur = me.lap >= 1 || race.cfg.mode !== 'tt' ? Math.max(0, time - me.lapStart) : 0;
  $('#hCur').textContent = me.finished != null ? fmt(me.finished) : fmt(cur);
  $('#hBest').textContent = fmt(me.best);
  if (race.cfg.mode === 'tt') {
    const d = ghostDelta(), el = $('#hDelta');
    el.textContent = d == null ? '—' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(3)}`;
    el.className = d == null ? '' : d > 0 ? 'bad' : 'good';
  }
  const v = Math.abs(me.speed) * KMH;
  $('#hSpeed').textContent = Math.round(v);
  $('#hGear').textContent = time < 0 ? 'N' : me.speed < -0.5 ? 'R' : SND.gearOf(me.speed, CAR.vmax).gear;
  $('#hDrs').className = `drs ${me.drsOpen ? 'open' : me.drsAvail ? 'avail' : ''}`;
  $('#hSlip').className = `slip ${me.slipstream > 0.3 ? 'on' : ''}`;
  const dmg = $('#hDamage'); dmg.style.width = `${100 - me.damage}%`; dmg.style.background = me.damage > 60 ? '#ff3b30' : me.damage > 30 ? '#ffd400' : '#2fd47a';
  // Mauvais sens
  if (player && time > 1 && player.finished == null && Math.cos(player.a - Math.atan2(t.ty[player.i], t.tx[player.i])) < -0.4 && Math.abs(player.speed) > 3 && performance.now() > race.msgUntil) { toast('Mauvais sens', 'warn'); race.msgUntil = performance.now() + 2000; }
  // Tour de classement (4 fois par seconde)
  race.towerAt -= dt;
  if (race.towerAt <= 0 && race.cfg.mode !== 'tt') {
    race.towerAt = 0.25;
    const lead = st[0];
    $('#tower').innerHTML = st.slice(0, 12).map((c, k) => {
      const gap = k === 0 ? 'Leader' : c.finished != null && lead.finished != null ? `+${(c.finished - lead.finished).toFixed(1)}` : `+${((lead.s - c.s) / Math.max(25, Math.abs(c.speed) || 25)).toFixed(1)}`;
      return `<li class="${c === me ? 'me' : ''}"><b>${k + 1}</b><i style="background:${c.look.color}"></i><span>${esc(c.name)}</span><em>${c.finished != null ? '🏁' : gap}</em></li>`;
    }).join('');
  }
  // Mini-carte
  const c = $('#minimap'), g = c.getContext('2d');
  g.putImageData(mini.img, 0, 0);
  for (const car of race.cars) {
    if (car.hidden) continue;
    const [x, y] = mini.P(car.x, car.y), r = (car === me ? 5 : 3.5) * devicePixelRatio;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = car.ghost ? 'rgba(191,227,255,.6)' : car.look.color; g.fill();
    if (car === me) { g.lineWidth = 2 * devicePixelRatio; g.strokeStyle = '#fff'; g.stroke(); }
  }
  // Son
  let near = null, nd = Infinity;
  for (const c2 of race.cars) { if (c2 === me || c2.ghost || c2.hidden) continue; const d = Math.hypot(c2.x - me.x, c2.y - me.y); if (d < nd) { nd = d; near = c2; } }
  SND.updateAudio(me, near, nd, { throttle: me.input?.throttle ?? (me.remote ? 0.7 : 0), on: !race.paused && screen === 'race', crowdLevel: t.def.theme === 'park' ? 0.05 : 0.03 });
}

/* ---------------- Pause ---------------- */
function togglePause(force) {
  if (!race || race.cfg.mode === 'demo') return;
  const on = force ?? $('#pause').hidden;
  $('#pause').hidden = !on;
  if (race.cfg.mode !== 'multi') race.paused = on;
  if (on) SND.updateAudio(null, null, 0, { on: false });
}
$('#pauseBtn').onclick = () => togglePause(true);
$('#resume').onclick = () => togglePause(false);
$('#restart').onclick = () => { if (race.cfg.mode === 'multi') return togglePause(false); startRace(race.cfg); };
$('#quit').onclick = () => {
  if (race.cfg.mode === 'multi') { socket.emit('leave'); store.set('formula-session', null); stopRace(); startDemo(); return go('online'); }
  if (race.cfg.mode === 'tt' && race.player.lapTimes.length) { togglePause(false); race.paused = true; return ttResults(); }
  go('menu');
};
document.addEventListener('visibilitychange', () => { if (document.hidden && race && screen === 'race' && race.cfg.mode !== 'multi') togglePause(true); });
addEventListener('resize', () => view?.resize());

/* ---------------- Multijoueur ---------------- */
const socket = io('/formula');
let room = null, serverOffset = 0;
const act = (...args) => socket.emit('act', ...args, res => res?.error && alert(res.error));
$('#nameForm').pseudo.value = pseudo;
$('#nameForm').pseudo.oninput = e => { pseudo = e.target.value.trim().slice(0, 20); store.set('formula-pseudo', pseudo); };
$('#nameForm').onsubmit = e => e.preventDefault();
function enter(event, payload) {
  if (!pseudo) { $('#nameForm').pseudo.focus(); return alert('Choisis d’abord un pseudo'); }
  socket.emit(event, { ...payload, name: pseudo }, res => { if (res?.error) alert(res.error); else socket.emit('act', 'setLook', profile.look); });
}
$('#createForm').onsubmit = e => { e.preventDefault(); enter('create', { private: e.target.vis.value === 'private' }); };
$('#joinForm').onsubmit = e => { e.preventDefault(); enter('join', { code: e.target.code.value, watch: e.submitter?.value === 'watch' }); };
$('#rooms').onclick = e => { const b = e.target.closest('[data-room]'); if (b) enter('join', { code: b.dataset.room, watch: b.dataset.mode === 'watch' }); };
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><span><b class="code">${r.code}</b> · ${r.players.map(esc).join(', ')} · ${esc(trackById(r.track).name)} ${r.phase === 'race' ? '· 🏁 en course' : ''}</span>
    ${r.phase === 'race' ? '' : `<button class="small primary" data-room="${r.code}">Rejoindre</button>`}<button class="small ghost" data-room="${r.code}" data-mode="watch">👁</button></li>`).join('') : '<li class="hint">Aucun salon public pour l’instant : crée le tien !</li>';
});
socket.on('session', s => { store.set('formula-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
socket.on('closed', msg => { alert(msg); room = null; store.set('formula-session', null); if (race?.cfg.mode === 'multi') { stopRace(); startDemo(); } go('online'); });
socket.on('connect', () => {
  const s = store.json('formula-session'), code = params.get('salon');
  if (s && (!code || s.code === code)) socket.emit('resume', s, res => { if (res?.error) { store.set('formula-session', null); if (code && pseudo) enter('join', { code }); } });
  else if (code) { go('online'); if (pseudo) enter('join', { code }); }
});
$('#leaveRoom').onclick = () => { socket.emit('leave'); store.set('formula-session', null); room = null; history.replaceState(null, '', location.pathname); go('online'); };
$('#copyLink').onclick = () => { navigator.clipboard?.writeText(`${location.origin}/formula/?salon=${room.code}`); $('#copyLink').textContent = '✓ Lien copié'; setTimeout(() => ($('#copyLink').textContent = '🔗 Copier le lien'), 1500); };
$('#readyBtn').onclick = () => act('ready', !room.players.find(p => p.name === room.me)?.ready);
$('#startBtn').onclick = () => act('start');
$('#rLaps').onchange = e => act('configure', 'laps', Number(e.target.value));

socket.on('state', s => {
  const before = room;
  room = s;
  if (!s) return;
  serverOffset = s.now - Date.now();
  if (s.phase === 'race' && (race?.cfg.mode !== 'multi' || race.cfg.round !== s.round)) {
    startRace({ mode: 'multi', track: s.settings.track, laps: s.settings.laps, weather: s.settings.weather, time: s.settings.time, round: s.round, grid: s.grid, players: s.players, me: s.me, spectator: s.spectator, startAt: s.startAt });
  } else if (s.phase === 'results' && race?.cfg.mode === 'multi' && !race.results) {
    race.results = s.results;
    netResults(s);
  } else if (s.phase === 'lobby' && race?.cfg.mode === 'multi') { stopRace(); startDemo(); }
  if (s.phase !== 'race' && (screen !== 'results' || before?.phase === 'results' && s.phase === 'lobby')) { if (screen !== 'results') show('room'); }
  renderRoom();
});
function renderRoom() {
  if (!room) return;
  const meP = room.players.find(p => p.name === room.me), host = room.host === room.me;
  $('#roomCode').textContent = room.code;
  $('#roomPlayers').innerHTML = room.players.map(p => `<li class="${p.connected ? '' : 'off'}"><i class="dot" style="background:${p.look?.color ?? '#888'}"></i><span>${esc(p.name)}${p.name === room.host ? ' 👑' : ''}${p.wins ? ` · 🏆 ${p.wins}` : ''}</span>${p.name === room.host ? '' : p.ready ? '<b class="ok">PRÊT</b>' : '<em class="hint">en attente</em>'}</li>`).join('');
  $('#roomSpect').textContent = room.spectators.length ? `👁 Spectateurs : ${room.spectators.join(', ')}` : '';
  $('#rLaps').value = room.settings.laps; $('#rLaps').disabled = !host;
  renderCond();
  $('#readyBtn').hidden = host || !meP; $('#readyBtn').textContent = meP?.ready ? '✓ Prêt (annuler)' : 'Je suis prêt';
  $('#readyBtn').classList.toggle('on', !!meP?.ready);
  $('#startBtn').hidden = !host;
  const waiting = room.players.filter(p => p.name !== room.host && !p.ready).length;
  $('#startBtn').disabled = waiting > 0;
  $('#roomHint').textContent = room.spectator ? 'Tu regardes ce salon : la course s’affichera en direct.' : host ? (waiting ? `En attente de ${waiting} pilote${waiting > 1 ? 's' : ''} pas encore prêt${waiting > 1 ? 's' : ''}.` : 'Tout le monde est prêt : lance la course !') : 'Le créateur du salon choisit le circuit et lance la course.';
  renderTracks();
}
function netResults(s) {
  const rows = s.results.map(r => ({ name: r.name, look: s.players.find(p => p.name === r.name)?.look, time: r.ms / 1000, best: r.best != null ? r.best / 1000 : null, dnf: r.ms == null, me: r.name === s.me }));
  const fastest = Math.min(...rows.map(r => r.best ?? Infinity));
  const pos = rows.findIndex(r => r.me) + 1, me = rows[pos - 1];
  let gain = 0;
  if (me && !me.dnf) { gain = pos === 1 && rows.length > 1 ? 120 : 40; profile.credits += gain; saveProfile(); }
  const back = () => { stopRace(); startDemo(); show('room'); renderRoom(); };
  showResults({
    title: !me ? 'Résultats' : pos === 1 ? 'Victoire !' : `${pos}ᵉ place`, rows, fastest,
    stats: me ? [['Position', `P${pos} / ${rows.length}`], ['Temps total', me.dnf ? 'Abandon' : fmt(me.time)], ['Meilleur tour', fmt(me.best)], ['Dépassements', race?.overtakes ?? 0], ['Crédits gagnés', `+${gain} 🪙`, 'gain']] : [['Vainqueur', rows[0]?.name ?? '—']],
    buttons: [['Retour au salon', back, 'primary']],
  });
}
// Positions des autres pilotes : envoyées 15 fois par seconde, affichées avec 120 ms de retard pour être fluides.
function sendPos(time) {
  if (time - race.lastSend < 0.066) return;
  race.lastSend = time;
  const p = race.player;
  socket.volatile.emit('pos', { x: +p.x.toFixed(2), y: +p.y.toFixed(2), a: +p.a.toFixed(3), v: +p.speed.toFixed(1), s: +p.s.toFixed(1), l: p.lap, st: +p.steer.toFixed(2), d: p.drsOpen ? 1 : 0, f: p.finished, b: p.best, k: p.skid > 2.2 ? +p.skid.toFixed(1) : 0 });
}
socket.on('pos', (name, p) => {
  const c = race?.cfg.mode === 'multi' && race.cars.find(c => c.netName === name && c.remote);
  if (!c) return;
  c.snaps.push({ at: performance.now() / 1000, ...p });
  if (c.snaps.length > 20) c.snaps.shift();
});
function interpolateRemotes(now) {
  const at = now - 0.12;
  for (const c of race.cars) {
    if (!c.remote) continue;
    const s = c.snaps;
    if (!s.length || now - s.at(-1).at > 2.5) { c.hidden = true; continue; }
    c.hidden = false;
    let k = s.findIndex(x => x.at > at);
    if (k < 0) k = s.length - 1;
    const b = s[k], a = s[Math.max(0, k - 1)], f = b.at > a.at ? Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at))) : 1;
    let da = b.a - a.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    const nx = a.x + (b.x - a.x) * f, ny = a.y + (b.y - a.y) * f, dt = Math.max(0.01, b.at - a.at);
    Object.assign(c, { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, x: nx, y: ny, a: a.a + da * f, speed: b.v, steer: b.st, s: a.s + (b.s - a.s) * f, lap: b.l, drsOpen: !!b.d, finished: b.f ?? null, best: b.b ?? null, skid: b.k });
    // où elle est sur la piste : sert à la poser à la bonne hauteur (relief) et à l'incliner dans les pentes
    const loc = locate(race.t, nx, ny, c.i); c.i = loc.i; c.along = loc.along; c.lat = loc.lat;
  }
}

/* ---------------- Démarrage ---------------- */
renderCond();
startDemo();
show('menu');
if (params.get('salon')) go('online');
