// Boule de Pute : accueil (pseudo, personnage), salon et manches. Le navigateur lit les touches et le regard (souris)
// 60 fois par seconde, les envoie numérotés au serveur (« in ») et fait bouger son joueur tout de suite avec la même
// physique ; à chaque état reçu (« snap »), il reprend la position du serveur et rejoue ce que le serveur n'a pas vu.
// Les autres joueurs sont affichés avec un léger retard, lissé ; la boule est prolongée jusqu'à maintenant.
import { createArena, drawPortrait, LOOKS, TEAM, TEAM_NAMES } from './render.js';
import { $, $$, esc, store, audio, sound, blip, fanfare, party } from '/shared/party.js';

const BD = window.BD, { IN, B } = BD;
const socket = io('/boule');
const V = createArena($('#view'));
addEventListener('resize', () => V.resize());

/* ---------------- Sons ---------------- */
function noise(dur, freq, vol, type = 'bandpass', to, at = 0) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SFX = {
  swing: () => noise(0.18, 1800, 0.12, 'bandpass', 500),
  reflect: (v, perfect) => { const p = 1 + Math.min(1.5, v / 40); blip(140 * p, 50 * p, 0.25, 'sine', 0.35); noise(0.12, 2500, 0.2, 'highpass'); blip(600 * p, 1200 * p, 0.1, 'square', 0.06); if (perfect) { blip(1568, 1568, 0.5, 'triangle', 0.12, 0.02); blip(2093, 2093, 0.6, 'triangle', 0.1, 0.1); } },
  kill: () => { noise(0.8, 300, 0.4, 'lowpass', 60); blip(880, 110, 0.6, 'square', 0.12, 0.05); blip(220, 330, 0.12, 'square', 0.08, 0.45); blip(330, 180, 0.4, 'square', 0.08, 0.57); }, // boum, puis « pouet-pouet »
  jump: () => blip(300, 600, 0.1, 'triangle', 0.05),
  beep: f => blip(f, f, 0.06, 'square', 0.05),
  round: () => fanfare([523, 659, 784, 1046, 1318], 0.1),
};
// le bourdonnement de la boule : plus aigu quand elle va vite, plus fort quand elle est proche
let hum = null;
function humTo(v, near) {
  const ac = sound(); if (!ac) return;
  if (!hum) { const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o2.type = 'sine'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); o.start(); o2.start(); hum = { o, o2, g }; }
  const t = ac.currentTime; hum.o.frequency.setTargetAtTime(70 + v * 5, t, 0.05); hum.o2.frequency.setTargetAtTime(140 + v * 10, t, 0.05); hum.g.gain.setTargetAtTime(v ? 0.015 + near * 0.06 : 0, t, 0.08);
}

/* ---------------- Personnages et salon ---------------- */
let myLook = store.get('boule-look'); if (!LOOKS[myLook]) myLook = 'bobby';
function picks(box) { box.innerHTML = Object.entries(LOOKS).map(([id, L]) => `<button class="char" data-look="${id}"><canvas width="160" height="160"></canvas><b>${esc(L.name)}</b></button>`).join(''); }
picks($('#homePicks')); picks($('#picks'));
function renderPicks() { for (const b of $$('[data-look]')) b.classList.toggle('on', b.dataset.look === myLook); }
for (const box of [$('#homePicks'), $('#picks')]) box.onclick = e => { const b = e.target.closest('[data-look]'); if (!b) return; audio(); myLook = b.dataset.look; store.set('boule-look', myLook); renderPicks(); if (ui.room && ['lobby', 'over'].includes(ui.room.phase)) act('pick', myLook); blip(500, 800, 0.1, 'triangle', 0.06); };
setInterval(() => { if (document.body.classList.contains('playing')) return; const t = performance.now() / 1000; for (const cv of $$('.char canvas')) if (cv.offsetParent) drawPortrait(cv, cv.parentNode.dataset.look, cv.closest('.on') ? 0 : 1, t); }, 60);
renderPicks();

const ui = party({
  id: 'boule', socket, max: 8, bots: 3, busy: '💥 en partie', onError: t => toast(t),
  onShow: sc => { if (sc !== 'game') { humTo(0, 0); document.exitPointerLock?.(); } },
  onRoom: (s, host) => {
    for (const [id, k] of [['teamSel', 'teamSize'], ['levelSel', 'level']]) { const el = $(`#${id}`); el.disabled = !host; el.value = String(s.settings[k]); }
    renderPicks();
  },
});
const { show, act } = ui;
$('#teamSel').onchange = e => act('configure', 'teamSize', Number(e.target.value));
$('#levelSel').onchange = e => act('configure', 'level', Number(e.target.value));

/* ---------------- États reçus ---------------- */
let S = null, matchKey = '';
const snaps = [];
let pred = null, pending = [], seq = 0, vis = { x: 0, z: 0 }, myYaw = 0, winTeam = null;
const inMatch = s => s && ['count', 'play', 'roundEnd'].includes(s.phase);
socket.on('state', s => {
  const old = S; S = s;
  const mine = s.players.find(p => p.name === s.me);
  if (mine && mine.look !== myLook && ['lobby', 'over'].includes(s.phase)) act('pick', myLook);
  show(inMatch(s) || s.phase === 'over' ? 'game' : 'room');
  ui.renderRoom();
  const key = `${s.round}.${s.roundNo}`;
  if (inMatch(s) && key !== matchKey) { matchKey = key; pred = null; pending = []; snaps.length = 0; winTeam = null; $('#board').hidden = true; if (mine) myYaw = mine.team ? Math.PI : 0; }
  if (old?.phase !== s.phase) {
    if (s.phase === 'count') countdown();
    if (s.phase === 'play') { banner('RENVOIE-LUI DANS LA GUEULE !', `Manche ${s.roundNo}`); blip(990, 990, 0.25, 'square', 0.08); }
    if (s.phase === 'roundEnd') humTo(0, 0);
  }
  if (s.phase === 'over') showBoard(s); else $('#board').hidden = true;
});
let countT = null;
function countdown() { let n = 3; clearInterval(countT); const el = $('#cd'); const tick = () => { el.textContent = n > 0 ? n : '💥'; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); blip(n > 0 ? 660 : 990, n > 0 ? 660 : 990, 0.12, 'square', 0.06); if (n-- <= 0) { clearInterval(countT); setTimeout(() => (el.hidden = true), 500); } }; tick(); countT = setInterval(tick, 900); }
socket.on('snap', snap => {
  snaps.push({ at: performance.now(), s: snap });
  while (snaps.length > 30) snaps.shift();
  for (const e of snap.ev) onEvent(e);
  const me = S?.me, mine = snap.p.find(p => p.id === me);
  if (mine) {
    const ack = snap.ack[me] ?? 0, before = pred && { x: pred.x, z: pred.z };
    pred = { ...mine };
    pending = pending.filter(([q]) => q > ack);
    for (const [, bits, yaw] of pending) BD.step(pred, bits, yaw);
    if (before && Math.hypot(before.x - pred.x, before.z - pred.z) < 2) { vis.x += before.x - pred.x; vis.z += before.z - pred.z; }
  }
});
const teamOf = id => snaps.at(-1)?.s.p.find(p => p.id === id)?.team ?? 0;
function onEvent(e) {
  const me = S?.me;
  if (e.t === 'swing') { if (e.id !== me) SFX.swing(); return; }
  if (e.t === 'jump') { if (e.id !== me) SFX.jump(); return; }
  if (e.t === 'reflect') {
    V.fx.reflect(e, TEAM[teamOf(e.id)], e.perfect); SFX.reflect(e.v, e.perfect);
    if (e.perfect) flash(e.id === me ? '⚡ RENVOI PARFAIT !' : `⚡ ${e.id} : PARFAIT !`);
    if (e.target === me) { toast('⚠️ Elle arrive sur toi !'); }
    ui.feed(`${e.perfect ? '⚡' : '🏓'} ${e.id} → ${e.target} · ${Math.round(e.v * 3.6)} km/h`);
    return;
  }
  if (e.t === 'kill') {
    V.fx.kill(e); SFX.kill();
    const killer = e.by && e.by !== e.id ? e.by : null;
    ui.feed(`💥 ${e.id} pulvérisé${killer ? ` par ${killer}` : ''} (${Math.round(e.v * 3.6)} km/h)`);
    if (e.id === me) banner('PULVÉRISÉ !', `${Math.round(e.v * 3.6)} km/h${killer ? ` · merci ${killer}` : ''}`);
    else if (killer === me) flash('🎯 ÉLIMINATION !');
    return;
  }
  if (e.t === 'round') {
    winTeam = e.win; SFX.round();
    banner(`MANCHE POUR ${TEAM_NAMES[e.win].toUpperCase()} !`, `${e.teamWins[0]} - ${e.teamWins[1]}`);
  }
}

/* ---------------- Commandes ---------------- */
const keys = new Set();
const KEYMAP = { KeyW: IN.F, ArrowUp: IN.F, KeyS: IN.B, ArrowDown: IN.B, KeyA: IN.L, KeyD: IN.R, Space: IN.JUMP, KeyJ: IN.HIT, KeyF: IN.HIT, KeyE: IN.HIT };
let mouse = 0;
const playing = () => document.body.classList.contains('playing');
addEventListener('keydown', e => { if (e.target.closest?.('input, select')) return; if ((KEYMAP[e.code] !== undefined || e.code.startsWith('Arrow')) && playing()) { e.preventDefault(); keys.add(e.code); audio(); } });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse = 0; });
$('#view').addEventListener('mousedown', e => { if (!playing()) return; audio(); if (document.pointerLockElement !== $('#view')) $('#view').requestPointerLock?.(); if (e.button === 0) mouse |= IN.HIT; if (e.button === 2) mouse |= IN.JUMP; });
addEventListener('mouseup', e => { if (e.button === 0) mouse &= ~IN.HIT; if (e.button === 2) mouse &= ~IN.JUMP; });
$('#view').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === $('#view')) myYaw += e.movementX * 0.0032 * (+store.get('boule-sens') || 1); });
function readInput(dt) {
  let bits = mouse;
  for (const k of keys) bits |= KEYMAP[k] ?? 0;
  if (keys.has('ArrowLeft')) myYaw -= dt * 2.6; if (keys.has('ArrowRight')) myYaw += dt * 2.6;
  for (const g of navigator.getGamepads?.() ?? []) {
    if (!g) continue;
    const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0, rx = g.axes[2] ?? 0, b = i => g.buttons[i]?.pressed;
    if (ay < -0.35) bits |= IN.F; if (ay > 0.35) bits |= IN.B; if (ax < -0.35) bits |= IN.L; if (ax > 0.35) bits |= IN.R;
    if (Math.abs(rx) > 0.15) myYaw += rx * dt * 3;
    if (b(0)) bits |= IN.JUMP; if (b(2) || b(5) || b(7)) bits |= IN.HIT;
  }
  return bits;
}

/* ---------------- Interface ---------------- */
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2000); }
function banner(title, sub) { const b = $('#banner'); b.hidden = true; void b.offsetWidth; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2600); }
function flash(t) { const el = $('#flash'); el.textContent = t; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => (el.hidden = true), 1100); }
function showBoard(s) {
  const w = s.teamWins[0] > s.teamWins[1] ? 0 : 1, myTeam = s.players.find(p => p.name === s.me)?.team;
  $('#boardTitle').textContent = `🏆 ${TEAM_NAMES[w]} gagnent ${s.teamWins[w]} à ${s.teamWins[1 - w]} !${myTeam === w ? ' Bien joué !' : ''}`;
  $('#boardList').innerHTML = s.ranking.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><span>${esc(p.name)}</span><strong>${p.points} manche${p.points > 1 ? 's' : ''}</strong></li>`).join('');
  $('#boardHint').textContent = '';
  ui.endButtons(s, s.ranking);
  $('#board').hidden = false;
}
const tags = {};
function hud(list, ball, now) {
  const s = S, me = list.find(p => p.id === s.me);
  $('#sL').textContent = s.teamWins?.[0] ?? 0; $('#sR').textContent = s.teamWins?.[1] ?? 0; $('#need').textContent = `premier à ${s.need}`;
  for (const t of [0, 1]) $(`#alive${t}`).innerHTML = list.filter(p => p.team === t).map(p => `<i class="${p.alive ? '' : 'dead'}" title="${esc(p.id)}"></i>`).join('');
  const v = ball && ball.state !== 'wait' ? ball.v : 0;
  $('#speed').textContent = v ? `${Math.round(v * 3.6)} km/h` : '—';
  $('#speed').style.setProperty('--k', Math.min(1, (v - B.v0) / 55));
  const targeted = !!(me?.alive && ball && ball.state !== 'wait' && ball.target === me.id);
  document.body.classList.toggle('targeted', targeted);
  $('#cool').style.setProperty('--c', me ? 1 - me.hitCd / B.cd : 1);
  // bip d'alerte, de plus en plus rapide quand la boule approche
  if (targeted) { const d = Math.hypot(ball.x - me.x, ball.y - me.y - 1, ball.z - me.z), gap = Math.max(70, Math.min(600, d * 45)); if (now - (hud.beep ?? 0) > gap) { hud.beep = now; SFX.beep(d < B.range ? 1400 : 900); } }
  if (ball && ball.state !== 'wait' && me) { const d = Math.hypot(ball.x - me.x, ball.z - me.z); humTo(ball.v, Math.max(0, 1 - d / 14)); } else humTo(0, 0);
  // noms au-dessus des têtes
  for (const p of list) {
    const el = (tags[p.id] ??= Object.assign(document.createElement('div'), { className: 'tag' }));
    if (!el.parentNode) $('#labels').append(el);
    const sc = V.project(p.x, p.y + 2.35, p.z);
    el.hidden = !sc.ok || !p.alive || p.id === s.me;
    el.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -100%)`;
    el.innerHTML = `<b style="--c:${TEAM[p.team]}">${esc(p.id)}</b>`;
  }
  for (const [id, el] of Object.entries(tags)) if (!list.some(p => p.id === id)) { el.remove(); delete tags[id]; }
}

/* ---------------- Boucle ---------------- */
let last = performance.now(), acc = 0, outbox = [];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = S, live = inMatch(s);
  acc += dt;
  while (acc >= BD.DT) {
    acc -= BD.DT;
    if (live && pred) {
      const bits = readInput(BD.DT); pending.push([++seq, bits, myYaw]); outbox.push([seq, bits, +myYaw.toFixed(4)]);
      pred.ev = []; BD.step(pred, bits, myYaw); for (const e of pred.ev) { if (e === 'swing') SFX.swing(); if (e === 'jump') SFX.jump(); } delete pred.ev;
      if (pending.length > 120) pending.shift();
    }
  }
  if (outbox.length) socket.emit('in', outbox.splice(0));
  vis.x *= Math.exp(-dt * 14); vis.z *= Math.exp(-dt * 14);
  let state = null;
  if (live && snaps.length) {
    const rt = now - 80;
    let i = snaps.findIndex(x => x.at > rt); if (i < 0) i = snaps.length - 1;
    const Bs = snaps[i], As = snaps[Math.max(0, i - 1)], k = Bs.at > As.at ? Math.max(0, Math.min(1, (rt - As.at) / (Bs.at - As.at))) : 1;
    const list = Bs.s.p.map(b => {
      if (b.id === s.me && pred) return { ...pred, yaw: myYaw, x: pred.x + vis.x, z: pred.z + vis.z };
      const a = As.s.p.find(x => x.id === b.id) ?? b, dy = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
      return { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k };
    });
    const L = snaps.at(-1), raw = L.s.b;
    let ball = null;
    if (raw) { const age = raw[9] === 'fly' ? Math.min(0.1, (now - L.at) / 1000) : 0; ball = { x: raw[0] + raw[3] * raw[6] * age, y: raw[1] + raw[4] * raw[6] * age, z: raw[2] + raw[5] * raw[6] * age, v: raw[6], target: raw[7], team: raw[8], state: raw[9] }; }
    state = { players: list, ball, me: s.me, winTeam: s.phase === 'roundEnd' ? winTeam : null, board: { wins: s.teamWins, need: s.need, speed: ball?.v ?? 0 } };
    hud(list, ball, now);
  }
  V.frame(dt, t, state);
}
if (location.hostname === 'localhost') window.bd = { V, state: () => S, pred: () => pred };
requestAnimationFrame(frame);
show('home');
