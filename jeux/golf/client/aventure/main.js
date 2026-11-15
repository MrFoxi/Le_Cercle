// Mini-golf, mode Aventure : la partie. Une seule balle, une seule tour, un seul trou tout en haut. La physique tourne en
// continu (240 pas par seconde) ; quand la balle est posée, on peut frapper : glisser en arrière (direction et puissance),
// ou au clavier (←/→ direction, ↑/↓ puissance, W/S levée, I/J/K/L point d'impact, Espace pour frapper).
// Q/E (ou les boutons) font tourner la tour d'un quart de tour, à tout moment. Aucune sauvegarde : chaque partie est une ascension.
/* global TourPhys, TourLevel */
import { createScene } from './scene.js';
import * as sound from './audio.js';

const P = TourPhys, L = TourLevel;
const $ = s => document.querySelector(s);
const view = createScene($('#view'));
let world = P.createWorld(L), ball = P.newBall(L.start);
let club = 'fer', shots = 0, best = 0, startedAt = 0, over = false, playing = false, biome = -1;
const lofts = Object.fromEntries(P.ORDER.map(id => [id, P.CLUBS[id].loft]));
const aim = { yaw: Math.atan2(19 - L.start[2], 0 - L.start[0]), power: 0.5, ix: 0, iy: 0, drag: null, keys: false };
let preview = null, previewKey = '';
if (location.search.includes('debug')) window.tour = { get world() { return world; }, get ball() { return ball; }, view, set: (x, y, z) => { ball = P.newBall([x, y, z]); }, give: id => world.clubs.add(id), bare: () => view.live.fades.forEach(f => { if (f.mesh) f.mesh.visible = false; if (f.extra) f.extra.visible = false; }), faded: () => view.live.fades.filter(f => f.b && f.k < 0.9).map(f => `${f.b.c.map(Math.round).join('/')}:${f.k.toFixed(2)}:${f.mesh.material.opacity.toFixed(2)}`).join(' ') };

/* ---------- Interface ---------- */
function toast(html, cls = '') {
  const t = document.createElement('div'); t.className = `toast ${cls}`; t.innerHTML = html;
  $('#toasts').append(t); setTimeout(() => t.remove(), 4200);
}
function announce(big, small, cls = '') {
  const a = $('#announce'); a.className = cls; a.innerHTML = `<small>${small}</small><b>${big}</b>`;
  a.style.animation = 'none'; void a.offsetWidth; a.style.animation = '';
}
function renderClubs() {
  $('#clubs').innerHTML = P.ORDER.map((id, i) => {
    const c = P.CLUBS[id], has = world.clubs.has(id);
    return `<button class="club ${id === club ? 'on' : ''} ${has ? '' : 'locked'}" data-club="${id}" ${has ? '' : 'disabled'} title="${has ? `${c.name} : ${c.desc}` : 'Club pas encore trouvé'}"><i>${has ? c.icon : '?'}</i><span>${has ? c.name : '???'}</span><kbd>${i + 1}</kbd></button>`;
  }).join('');
}
function renderShot() {
  const c = P.CLUBS[club];
  $('#loft').textContent = `${Math.round(lofts[club])}°`;
  $('#power i').style.width = `${Math.round(aim.power * 100)}%`;
  $('#power i').style.background = aim.power < 0.5 ? '#6fe08a' : aim.power < 0.8 ? '#ffd23f' : '#ff6a6a';
  $('#powerPct').textContent = `${Math.round(aim.power * 100)} %`;
  $('#clubName').textContent = c.name;
  drawImpact();
}
function drawImpact() {
  const cv = $('#impact'), c = cv.getContext('2d'), w = cv.width, r = w / 2 - 6;
  c.clearRect(0, 0, w, w);
  const g = c.createRadialGradient(w * 0.4, w * 0.38, 4, w / 2, w / 2, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dce8');
  c.fillStyle = g; c.beginPath(); c.arc(w / 2, w / 2, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(40,40,80,.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2, 6); c.lineTo(w / 2, w - 6); c.moveTo(6, w / 2); c.lineTo(w - 6, w / 2); c.stroke();
  c.fillStyle = '#ff4f7b'; c.beginPath(); c.arc(w / 2 + aim.ix * r * 0.8, w / 2 - aim.iy * r * 0.8, 6, 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  const fx = aim.ix > 0.15 ? 'courbe à droite' : aim.ix < -0.15 ? 'courbe à gauche' : '', fy = aim.iy < -0.15 ? 'rétro' : aim.iy > 0.15 ? 'lifté' : '';
  $('#spinTxt').textContent = [fy, fx].filter(Boolean).join(' · ') || 'au centre';
}
function setClub(id) { if (!world.clubs.has(id)) return; club = id; renderClubs(); renderShot(); previewKey = ''; }
$('#clubs').onclick = e => { const b = e.target.closest('[data-club]'); if (b) setClub(b.dataset.club); };
$('#loftDown').onclick = () => setLoft(-2); $('#loftUp').onclick = () => setLoft(2);
function setLoft(d) { const c = P.CLUBS[club]; lofts[club] = Math.max(c.min, Math.min(c.max, lofts[club] + d)); renderShot(); previewKey = ''; }
// point d'impact : on clique (ou glisse) dans le disque
const imp = $('#impact');
const setImpact = e => { const r = imp.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1); const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } aim.ix = Math.abs(x) < 0.08 ? 0 : x; aim.iy = Math.abs(y) < 0.08 ? 0 : y; renderShot(); previewKey = ''; };
imp.onpointerdown = e => { imp.setPointerCapture(e.pointerId); setImpact(e); imp.onpointermove = setImpact; };
imp.onpointerup = () => (imp.onpointermove = null);
imp.ondblclick = () => { aim.ix = aim.iy = 0; renderShot(); };
$('#rotL').onclick = () => turn(-1); $('#rotR').onclick = () => turn(1);
function turn(d) { view.rotate(d); sound.cue('rotate'); }
$('#sndBtn').onclick = () => { sound.toggle('sound'); $('#sndBtn').classList.toggle('off', !sound.settings.sound); };
$('#musBtn').onclick = () => { sound.toggle('music'); $('#musBtn').classList.toggle('off', !sound.settings.music); };
$('#sndBtn').classList.toggle('off', !sound.settings.sound); $('#musBtn').classList.toggle('off', !sound.settings.music);
$('#helpBtn').onclick = () => ($('#help').hidden = !$('#help').hidden);
$('#help').onclick = e => { if (e.target.matches('#help, [data-close]')) $('#help').hidden = true; };

/* ---------- Frapper ---------- */
const ready = () => playing && !over && P.ready(ball);
function shoot() {
  if (!ready() || aim.power < 0.03) return;
  P.launch(ball, club, aim.yaw, aim.power, lofts[club], aim.ix, aim.iy);
  shots++; aim.keys = false; preview = null;
  sound.swing(aim.power);
  $('#shots').textContent = shots;
}
const cv = $('#view');
cv.addEventListener('pointerdown', e => {
  sound.startAudio();
  if (!ready()) return;
  cv.setPointerCapture(e.pointerId);
  aim.drag = { x: e.clientX, y: e.clientY };
  aimFrom(e);
});
// Lance-pierre : la balle part à l'opposé du point visé ; la puissance dépend de la longueur tirée (à l'écran)
function aimFrom(e) {
  const p = view.pickGround(e.clientX, e.clientY, ball.p[1]);
  if (!p) return;
  const dx = ball.p[0] - p.x, dz = ball.p[2] - p.z;
  if (Math.hypot(dx, dz) > 0.2) aim.yaw = Math.atan2(dz, dx);
  const scr = Math.hypot(e.clientX - aim.drag.x, e.clientY - aim.drag.y), slow = e.shiftKey ? 0.4 : 1;
  aim.power = Math.min(1, (scr / Math.min(innerWidth, 900)) * 3.2 * slow);
  renderShot();
}
cv.addEventListener('pointermove', e => { if (aim.drag) aimFrom(e); });
cv.addEventListener('pointerup', () => { if (!aim.drag) return; aim.drag = null; shoot(); });
cv.addEventListener('pointercancel', () => { aim.drag = null; });
addEventListener('keydown', e => {
  if (e.target.matches('input, button') && e.key === ' ') return;
  sound.startAudio();
  const k = e.key.toLowerCase(), fine = e.shiftKey ? 0.2 : 1;
  if (k === 'q') turn(-1);
  else if (k === 'e') turn(1);
  else if (k >= '1' && k <= '6') setClub(P.ORDER[Number(k) - 1]);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { aim.yaw += (e.key === 'ArrowLeft' ? -1 : 1) * 0.026 * fine; aim.keys = true; previewKey = ''; }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { aim.power = Math.max(0.02, Math.min(1, aim.power + (e.key === 'ArrowUp' ? 0.02 : -0.02) * fine)); aim.keys = true; renderShot(); }
  else if (k === 'w' || k === 's') setLoft(k === 'w' ? 1 : -1);
  else if ('ijkl'.includes(k) && k) { aim.ix = Math.max(-1, Math.min(1, aim.ix + (k === 'l' ? 0.2 : k === 'j' ? -0.2 : 0))); aim.iy = Math.max(-1, Math.min(1, aim.iy + (k === 'i' ? 0.2 : k === 'k' ? -0.2 : 0))); renderShot(); previewKey = ''; }
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (aim.keys) shoot(); else { aim.keys = true; previewKey = ''; } }
  else return;
  e.preventDefault();
});
// Aperçu : la même physique, sur une copie du monde, jusqu'au premier rebond
function computePreview() {
  const key = `${aim.yaw.toFixed(3)}|${aim.power.toFixed(3)}|${club}|${lofts[club]}|${aim.ix}|${aim.iy}|${ball.p.map(x => x.toFixed(2))}`;
  if (key === previewKey) return;
  previewKey = key;
  const w = P.clone(world), b = { ...ball, p: [...ball.p], v: [0, 0, 0], w: [0, 0, 0] };
  P.launch(b, club, aim.yaw, aim.power, lofts[club], aim.ix, aim.iy);
  let n = 0;
  preview = P.simulate(w, b, { maxT: 3, every: 6, until: (bb, ev) => ev.some(x => x.t === 'hit') || ++n > 720 }).path;
}

/* ---------- Évènements du monde ---------- */
function onEvent(ev) {
  if (ev.t === 'hit') sound.hit(ev.s, ev.f);
  if (ev.t === 'break') { sound.cue('break'); toast('💥 Quelque chose a cédé…'); }
  if (ev.t === 'topple') { sound.cue('topple'); toast('🗿 L’obélisque bascule et forme un pont !'); }
  if (ev.t === 'trigger') { sound.cue('trigger'); toast('⚙️ Un mécanisme ancien s’est réveillé…'); }
  if (ev.t === 'club') {
    const c = P.CLUBS[ev.club]; sound.cue('club'); setClub(ev.club);
    announce(`${c.icon} ${c.name}`, 'Nouveau club trouvé', 'gold'); toast(`<b>${c.name}</b> : ${c.desc} (touche ${P.ORDER.indexOf(ev.club) + 1})`, 'gold');
  }
  if (ev.t === 'holed') finish(true);
  if (ev.t === 'lost') finish(false);
}
function finish(won) {
  if (over) return;
  over = true;
  sound.cue(won ? 'holed' : 'lost');
  const time = Math.round((performance.now() - startedAt) / 1000), mm = `${Math.floor(time / 60)} min ${String(time % 60).padStart(2, '0')}`;
  $('#end').hidden = false;
  $('#end').innerHTML = won
    ? `<h2>⛳ Dans le trou, au sommet de la Tour !</h2><p>Tu as gravi les six étages en <b>${shots}</b> coups et <b>${mm}</b>.</p><p>Clubs trouvés : <b>${world.clubs.size}</b> sur ${P.ORDER.length}.</p><div class="row"><button class="primary" id="again">Nouvelle ascension</button><a class="ghost" href="../">Retour au mini-golf</a></div>`
    : `<h2>🌫️ La Tour t’a échappé…</h2><p>Ta balle est tombée dans le vide. Plus haut atteint : <b>${Math.round(best)} m</b>, en ${shots} coups.</p><p>Il faut repartir d’en bas.</p><div class="row"><button class="primary" id="again">Recommencer l’ascension</button><a class="ghost" href="../">Retour au mini-golf</a></div>`;
  $('#again').onclick = () => (location.search = '?go');
}

/* ---------- Boucle ---------- */
let last = performance.now(), acc = 0, inWater = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing && !over) {
    acc += dt;
    while (acc >= P.DT) { acc -= P.DT; for (const ev of P.step(world, ball)) onEvent(ev); if (over) break; }
  }
  const isReady = ready();
  best = Math.max(best, ball.p[1]);
  const wet = L.zones.some(z => z.t === 'water' && ball.p.every((v, i) => v >= z.lo[i] && v <= z.hi[i]));
  if (wet && !inWater) sound.cue('water');
  inWater = wet;
  if (isReady && (aim.drag || aim.keys)) computePreview(); else preview = null;
  const amb = view.frame({ ball, world, t: now / 1000, dt, ready: isReady, aim: isReady && (aim.drag || aim.keys) ? aim : null, preview });
  $('#sky').style.background = `linear-gradient(180deg, ${amb.sky[0]}, ${amb.sky[1]})`;
  if (amb.biome !== biome) {
    biome = amb.biome; sound.setBiome(biome);
    if (playing) announce(L.biomes[biome].name, `Étage ${biome + 1} sur ${L.biomes.length}`);
    $('#biome').textContent = L.biomes[biome].name;
  }
  $('#alt').textContent = `${Math.max(0, Math.round(ball.p[1]))} m · record ${Math.max(0, Math.round(best))} m`;
  $('#meter i').style.bottom = `${Math.max(0, Math.min(100, (ball.p[1] / L.top) * 100))}%`;
  $('#meter b').style.bottom = `${Math.max(0, Math.min(100, (best / L.top) * 100))}%`;
  document.body.classList.toggle('moving', !isReady);
  $('#state').textContent = over || !playing ? '' : isReady ? (aim.keys || aim.drag ? 'Vise, puis relâche (ou Espace)' : 'À toi : glisse en arrière depuis n’importe où') : ball.ground ? 'La balle roule…' : 'La balle vole…';
}

function start() {
  $('#intro').hidden = true; playing = true; startedAt = performance.now();
  sound.startAudio(); renderClubs(); renderShot();
  biome = -1;
}
$('#go').onclick = start;
renderClubs(); renderShot();
if (location.search.includes('go')) start();
requestAnimationFrame(frame);
