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
let club = 'fer', shots = 0, best = 0, startedAt = 0, over = false, playing = false, biome = -1, won = false;
// Modes : normal ; zen (la chute dans le vide ramène à la dernière position) ; hardcore (une chute de plus de 15 m = retour en bas)
const MODES = { normal: ['🧗 Normal', 'La règle de la Tour : seul le vide fait recommencer.'], zen: ['🌿 Zen', 'Sans chute fatale : la balle revient où elle était.'], hardcore: ['🔥 Hardcore', 'Une chute de plus de 15 m et tu repars d’en bas.'] };
let mode = (() => { try { return localStorage.getItem('tour-mode') || 'normal'; } catch { return 'normal'; } })();
let lastRest = { p: [...L.start], y: L.start[1] }, wasReady = false;
const lofts = Object.fromEntries(P.ORDER.map(id => [id, P.CLUBS[id].loft]));
const aim = { yaw: Math.atan2(5 - L.start[2], 4 - L.start[0]), power: 0.5, ix: 0, iy: 0, drag: null, keys: false };
let preview = null, previewKey = '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = sec => `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')}`;
if (location.search.includes('debug')) window.tour = { get world() { return world; }, get ball() { return ball; }, view, set: (x, y, z) => { ball = P.newBall([x, y, z]); }, give: id => world.clubs.add(id), win: () => finish(true) };

/* ---------- Interface ---------- */
function toast(html, cls = '') {
  const t = document.createElement('div'); t.className = `toast ${cls}`; t.innerHTML = html;
  $('#toasts').append(t); setTimeout(() => t.remove(), 4200);
}
function announce(big, small, cls = '') {
  const a = $('#announce'); a.className = cls; a.innerHTML = `<small>${small}</small><b>${big}</b>`;
  a.style.animation = 'none'; void a.offsetWidth; a.style.animation = '';
}
// La carte du club : icône, nom, description, portée et hauteur, clubs trouvés
const owned = () => P.ORDER.filter(id => world.clubs.has(id));
function renderClub() {
  const c = P.CLUBS[club], l = (lofts[club] * Math.PI) / 180;
  $('#clubIcon').textContent = c.icon; $('#clubName').textContent = c.name; $('#clubKey').textContent = P.ORDER.indexOf(club) + 1; $('#clubDesc').textContent = c.desc;
  $('#barDist').style.width = `${Math.min(100, ((c.v * c.v * Math.sin(2 * l)) / 9.81 / 60) * 100 + 4)}%`;
  $('#barHigh').style.width = `${Math.min(100, ((c.v * c.v * Math.sin(l) ** 2) / 19.6 / 7.5) * 100 + 4)}%`;
  $('#clubDots').innerHTML = P.ORDER.map(id => `<span class="${world.clubs.has(id) ? 'has' : ''} ${id === club ? 'on' : ''}" title="${world.clubs.has(id) ? P.CLUBS[id].name : 'à trouver'}"></span>`).join('');
  drawDial();
}
// Le cadran : anneau de puissance, arc de levée (avec la plage du club), et au centre la balle pour l'effet
function arc(cx, cy, r, a0, a1) { const p = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)], [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`; }
function drawDial() {
  const c = P.CLUBS[club], A0 = (140 * Math.PI) / 180, SW = (260 * Math.PI) / 180, pw = aim.power;
  const col = pw < 0.5 ? '#43c173' : pw < 0.8 ? '#ffc93c' : '#ff5a5f';
  const la = d => Math.PI + (d / 90) * (Math.PI / 2); // levée : 0° à gauche, 90° en haut (repère SVG : y vers le bas)
  const lr = 62, needle = la(lofts[club]);
  $('#dial').innerHTML = `
    <circle cx="100" cy="100" r="96" fill="rgba(255,255,255,.82)" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
    <path d="${arc(100, 100, 84, A0, A0 + SW)}" stroke="rgba(43,37,82,.12)" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="${arc(100, 100, 84, A0, A0 + Math.max(0.02, pw) * SW)}" stroke="${col}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="${arc(100, 100, lr, Math.PI, Math.PI * 1.5)}" stroke="rgba(43,37,82,.1)" stroke-width="7" fill="none"/>
    <path d="${arc(100, 100, lr, la(c.min), la(c.max))}" stroke="#b9a8ff" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${[0, 15, 30, 45, 60, 75, 90].map(d => { const a = la(d); return `<line x1="${100 + 55 * Math.cos(a)}" y1="${100 + 55 * Math.sin(a)}" x2="${100 + 50 * Math.cos(a)}" y2="${100 + 50 * Math.sin(a)}" stroke="rgba(43,37,82,.35)" stroke-width="2"/>`; }).join('')}
    <line x1="100" y1="100" x2="${100 + 70 * Math.cos(needle)}" y2="${100 + 70 * Math.sin(needle)}" stroke="#7b5cff" stroke-width="3.5" stroke-linecap="round"/>
    <text x="100" y="${178}" text-anchor="middle" font-family="Baloo 2, Nunito" font-weight="800" font-size="15" fill="#2b2552">${Math.round(pw * 100)} %</text>
    <text x="44" y="40" text-anchor="middle" font-family="Baloo 2, Nunito" font-weight="800" font-size="14" fill="#7b5cff">${Math.round(lofts[club])}°</text>`;
  drawImpact();
}
function drawImpact() {
  const cv = $('#impact'), x = cv.getContext('2d'), w = cv.width, r = w / 2 - 6;
  x.clearRect(0, 0, w, w);
  const g = x.createRadialGradient(w * 0.38, w * 0.34, 6, w / 2, w / 2, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6dae8');
  x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, r, 0, 7); x.fill();
  x.strokeStyle = 'rgba(43,37,82,.18)'; x.lineWidth = 1.5;
  for (let k = -2; k <= 2; k++) { x.beginPath(); x.ellipse(w / 2, w / 2, r, Math.abs(k) * r * 0.3 + 1, 0, 0, 7); x.stroke(); }
  const px = w / 2 + aim.ix * r * 0.8, py = w / 2 - aim.iy * r * 0.8;
  // flèches d'effet
  x.strokeStyle = '#7b5cff'; x.lineWidth = 3; x.lineCap = 'round';
  if (Math.abs(aim.ix) > 0.1) { x.beginPath(); x.arc(w / 2, w / 2, r * 0.55, aim.ix > 0 ? -0.6 : Math.PI - 0.6, aim.ix > 0 ? 0.6 : Math.PI + 0.6); x.stroke(); }
  if (Math.abs(aim.iy) > 0.1) { x.beginPath(); x.arc(w / 2, w / 2, r * 0.55, aim.iy < 0 ? Math.PI / 2 - 0.6 : -Math.PI / 2 - 0.6, aim.iy < 0 ? Math.PI / 2 + 0.6 : -Math.PI / 2 + 0.6); x.stroke(); }
  x.fillStyle = '#ff4f7b'; x.beginPath(); x.arc(px, py, 8, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
  const fx = aim.ix > 0.15 ? 'courbe à droite' : aim.ix < -0.15 ? 'courbe à gauche' : '', fy = aim.iy < -0.15 ? 'rétro' : aim.iy > 0.15 ? 'lifté' : '';
  $('#spinTxt').textContent = [fy, fx].filter(Boolean).join(' · ') || 'frappe au centre';
}
function setClub(id) { if (!world.clubs.has(id)) return; club = id; renderClub(); previewKey = ''; }
function cycleClub(d) { const o = owned(), i = o.indexOf(club); setClub(o[(i + d + o.length) % o.length]); }
$('#clubPrev').onclick = () => cycleClub(-1); $('#clubNext').onclick = () => cycleClub(1);
$('#loftDown').onclick = () => setLoft(-2); $('#loftUp').onclick = () => setLoft(2);
function setLoft(d) { const c = P.CLUBS[club]; lofts[club] = Math.max(c.min, Math.min(c.max, lofts[club] + d)); renderClub(); previewKey = ''; }
const imp = $('#impact');
const setImpact = e => { const r = imp.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1); const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } aim.ix = Math.abs(x) < 0.12 ? 0 : x; aim.iy = Math.abs(y) < 0.12 ? 0 : y; drawImpact(); previewKey = ''; };
imp.onpointerdown = e => { imp.setPointerCapture(e.pointerId); setImpact(e); imp.onpointermove = setImpact; };
imp.onpointerup = () => (imp.onpointermove = null);
imp.ondblclick = () => { aim.ix = aim.iy = 0; drawImpact(); };
$('#rotL').onclick = () => turn(-1); $('#rotR').onclick = () => turn(1);
function turn(d) { view.rotate(d); sound.cue('rotate'); if (!aim.drag) { aim.yaw = view.awayYaw(); previewKey = ''; } }
$('#sndBtn').onclick = () => { sound.toggle('sound'); $('#sndBtn').classList.toggle('off', !sound.settings.sound); };
$('#musBtn').onclick = () => { sound.toggle('music'); $('#musBtn').classList.toggle('off', !sound.settings.music); };
$('#sndBtn').classList.toggle('off', !sound.settings.sound); $('#musBtn').classList.toggle('off', !sound.settings.music);
$('#helpBtn').onclick = () => ($('#help').hidden = !$('#help').hidden);
$('#help').onclick = e => { if (e.target.matches('#help, [data-close]')) $('#help').hidden = true; };
// la jauge de hauteur : un trait par monde
$('#ticks').innerHTML = L.worlds.slice(1).map(w => `<span style="bottom:${((w.y + 1) / L.top) * 100}%"></span>`).join('');

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
  drawDial();
}
cv.addEventListener('pointermove', e => { if (aim.drag) aimFrom(e); });
cv.addEventListener('pointerup', () => { if (!aim.drag) return; aim.drag = null; shoot(); });
cv.addEventListener('pointercancel', () => { aim.drag = null; });
addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  sound.startAudio();
  const k = e.key.toLowerCase(), fine = e.shiftKey ? 0.2 : 1;
  if (k === 'q') turn(-1);
  else if (k === 'e') turn(1);
  else if (k >= '1' && k <= '6') setClub(P.ORDER[Number(k) - 1]);
  else if (e.key === 'Tab') cycleClub(e.shiftKey ? -1 : 1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { aim.yaw += (e.key === 'ArrowLeft' ? -1 : 1) * 0.026 * fine; aim.keys = true; previewKey = ''; }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { aim.power = Math.max(0.02, Math.min(1, aim.power + (e.key === 'ArrowUp' ? 0.02 : -0.02) * fine)); aim.keys = true; drawDial(); }
  else if (k === 'w' || k === 's') setLoft(k === 'w' ? 1 : -1);
  else if (k === 'i' || k === 'j' || k === 'k' || k === 'l') { aim.ix = Math.max(-1, Math.min(1, aim.ix + (k === 'l' ? 0.2 : k === 'j' ? -0.2 : 0))); aim.iy = Math.max(-1, Math.min(1, aim.iy + (k === 'i' ? 0.2 : k === 'k' ? -0.2 : 0))); drawImpact(); previewKey = ''; }
  else if (e.key === ' ' || e.key === 'Enter') { if (e.target.matches('button')) return; e.preventDefault(); if (aim.keys) shoot(); else { aim.keys = true; previewKey = ''; } }
  else return;
  e.preventDefault();
});
// Aperçu : la même physique, sur une copie du monde, jusqu'au premier rebond
function computePreview() {
  const key = `${aim.yaw.toFixed(3)}|${aim.power.toFixed(3)}|${club}|${lofts[club]}|${aim.ix}|${aim.iy}|${ball.p.map(x => x.toFixed(1))}`;
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
  if (ev.t === 'break') sound.cue('break');
  if (ev.t === 'topple') { sound.cue('topple'); toast('📚 Le grand livre bascule… et entraîne les autres !'); }
  if (ev.t === 'trigger') { sound.cue('trigger'); toast(ev.id === 'melodie' ? '🎶 La mélodie est juste : l’escalier royal se lève !' : '⚙️ Un mécanisme s’est réveillé…'); }
  if (ev.t === 'key') sound.cue('key', ev.key);
  if (ev.t === 'weight') { sound.cue('weight'); toast(`⚖️ Contrepoids : force ${ev.lvl} sur 3`); }
  if (ev.t === 'lava') sound.cue('lava');
  if (ev.t === 'shard') { sound.cue('shard'); view.burst(ev.p, ['#ffe36a', '#ffffff'], 24, 4); renderCounters(); toast(`⭐ Éclat d’étoile trouvé (${world.shards.size} sur ${L.shards.length})`, 'gold'); }
  if (ev.t === 'club') {
    const c = P.CLUBS[ev.club]; sound.cue('club'); setClub(ev.club);
    announce(`${c.icon} ${c.name}`, 'Nouveau club trouvé', 'gold'); toast(`<b>${c.name}</b> : ${c.desc} (touche ${P.ORDER.indexOf(ev.club) + 1})`, 'gold');
  }
  if (ev.t === 'holed') finish(true);
  if (ev.t === 'lost') {
    if (mode === 'zen') { ball = P.newBall(lastRest.p); toast('🌿 Mode zen : ta balle revient où elle était.'); sound.cue('lost'); return; }
    finish(false);
  }
}
function finish(isWin, why) {
  if (over) return;
  over = true; won = isWin; document.body.classList.add('ended');
  sound.cue(isWin ? 'holed' : 'lost');
  const time = Math.round((performance.now() - startedAt) / 1000);
  const stats = `<ul class="stats"><li><b>${shots}</b><small>coups</small></li><li><b>${fmt(time)}</b><small>temps</small></li><li><b>${Math.round(best)} m</b><small>plus haut</small></li><li><b>${world.clubs.size}/${P.ORDER.length}</b><small>clubs</small></li><li><b>${world.shards.size}/${L.shards.length}</b><small>éclats</small></li></ul>`;
  $('#end').hidden = false;
  $('#end').innerHTML = isWin
    ? `<h2>⛳ Au sommet de la Tour !</h2><p>Onze mondes derrière toi. Mode ${MODES[mode][0]}.</p>${stats}${mode === 'zen' ? '<p class="hint">Le mode zen ne compte pas au classement.</p>' : '<div id="board"><p class="hint">Classement mondial…</p></div>'}<div class="row"><button class="primary" id="again">Nouvelle ascension</button><a class="ghost" href="../">Retour au mini-golf</a></div>`
    : `<h2>🌫️ La Tour t’a échappé…</h2><p>${why || 'Ta balle est tombée dans le vide.'} Il faut repartir d’en bas.</p>${stats}<div class="row"><button class="primary" id="again">Recommencer l’ascension</button><a class="ghost" href="../">Retour au mini-golf</a></div>`;
  $('#again').onclick = () => (location.search = '?go');
  if (isWin && mode !== 'zen') board(time);
}
// Classement mondial : le moins de coups (puis le plus rapide), en normal et en hardcore
async function board(seconds) {
  let name = ''; try { name = localStorage.getItem('golf-pseudo') || ''; } catch { /* stockage bloqué */ }
  const box = $('#board'), key = mode === 'hardcore' ? 'hardcore' : 'normal';
  const draw = (list, place) => { box.innerHTML = `<h3>🌍 Classement ${MODES[mode][0]}</h3>${place ? `<p class="goldtxt">Tu es ${place}${place === 1 ? 'er' : 'e'} !</p>` : ''}<ol class="board">${list.map(e => `<li${e.name === name ? ' class="me"' : ''}><span>${esc(e.name)}</span><b>${e.shots} coups</b><small>${fmt(e.seconds)} · ⭐ ${e.shards}</small></li>`).join('') || '<li>Personne encore : sois le premier !</li>'}</ol>`; };
  const send = async () => {
    const out = await fetch('/api/golf/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: key, name, shots, seconds, shards: world.shards.size }) }).then(r => r.json()).catch(() => null);
    if (out?.board) draw(out.board, out.place); else box.innerHTML = `<p class="hint">${esc(out?.error || 'Classement indisponible.')}</p>`;
  };
  if (name) return send();
  const list = await fetch(`/api/golf/board?mode=${key}`).then(r => (r.ok ? r.json() : [])).catch(() => []);
  draw(list);
  box.insertAdjacentHTML('beforeend', '<form class="row" id="nameForm"><input maxlength="20" placeholder="Ton pseudo" required><button class="primary">Inscrire mon score</button></form>');
  $('#nameForm').onsubmit = e => { e.preventDefault(); name = e.target.querySelector('input').value.trim(); if (!name) return; try { localStorage.setItem('golf-pseudo', name); } catch { /* */ } send(); };
}
function renderCounters() { $('#shardCount').textContent = `${world.shards.size}/${L.shards.length}`; $('#shots').textContent = shots; }

/* ---------- Boucle ---------- */
let last = performance.now(), acc = 0, hintText = '';
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
  if (isReady && !wasReady && playing && !over) {
    if (mode === 'hardcore' && lastRest.y - ball.p[1] > 15) finish(false, `Chute de ${Math.round(lastRest.y - ball.p[1])} m : en hardcore, c’est retour en bas.`);
    lastRest = { p: [...ball.p], y: ball.p[1] };
  }
  wasReady = isReady;
  if (isReady && (aim.drag || aim.keys)) computePreview(); else preview = null;
  const amb = view.frame({ ball, world, t: now / 1000, dt, ready: isReady && !over, aim: isReady && !over && (aim.drag || aim.keys) ? aim : null, preview, biome, cinematic: won });
  $('#sky').style.background = `linear-gradient(180deg, ${amb.sky[0]}, ${amb.sky[1]})`;
  if (amb.biome !== biome) {
    biome = amb.biome; sound.setBiome(biome);
    if (playing && !over) { announce(L.biomes[biome].name, `Monde ${biome + 1} sur ${L.biomes.length}`); const v = $('#veil'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on'); }
    $('#biome').textContent = L.biomes[biome].name; 
  }
  // conseil du lieu (quand la balle est posée dans sa zone)
  const h = isReady && playing && !over ? L.hints.find(z => ball.p.every((v, i) => v >= z.lo[i] && v <= z.hi[i])) : null;
  const ht = h ? h.text : isReady ? hintText : '';
  if (ht !== hintText) { hintText = ht; $('#hint').hidden = !ht; $('#hint span').textContent = ht; }
  if (playing) { const s = Math.round((performance.now() - startedAt) / 1000); $('#clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  $("#worldNo").textContent = `Monde ${Math.max(0, biome) + 1}/${L.biomes.length} · ${Math.max(0, Math.round(ball.p[1]))} m`;
  $('#meter i').style.bottom = `${Math.max(0, Math.min(100, (ball.p[1] / L.top) * 100))}%`;
  $('#meter b').style.bottom = `${Math.max(0, Math.min(100, (best / L.top) * 100))}%`;
  document.body.classList.toggle('moving', !isReady);
  $('#state').textContent = over || !playing ? '' : isReady ? (aim.keys || aim.drag ? 'Vise, puis relâche (ou Espace)' : 'À toi : glisse en arrière depuis n’importe où') : ball.ground ? (ball.base?.kin ? 'La balle est emportée…' : 'La balle roule…') : 'La balle vole…';
}

function start() {
  $('#intro').hidden = true; playing = true; startedAt = performance.now();
  sound.startAudio(); renderClub(); renderCounters();
  $('#modeTag').textContent = MODES[mode][0];
  biome = -1;
}
function renderModes() { $('#modes').innerHTML = Object.entries(MODES).map(([id, [n, d]]) => `<button class="mode ${id === mode ? 'on' : ''}" data-mode="${id}"><b>${n}</b><small>${d}</small></button>`).join(''); }
$('#modes').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; try { localStorage.setItem('tour-mode', mode); } catch { /* */ } renderModes(); };
renderModes();
$('#go').onclick = start;
renderClub(); renderCounters();
if (location.search.includes('go')) start();
requestAnimationFrame(frame);
