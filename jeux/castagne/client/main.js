// La Castagne : accueil, salon (choix du personnage) et combat. Le navigateur lit les touches 60 fois par seconde,
// les envoie numérotées au serveur (« in ») et fait bouger son combattant tout de suite avec la même simulation ;
// à chaque état reçu (« snap »), il reprend la position du serveur et rejoue les touches que le serveur n'a pas encore vues.
// Les autres combattants sont affichés avec 100 ms de retard, lissés entre deux états.
import { createRenderer, drawPortrait, LOOKS } from './render.js';
import { $, esc, store, audio, sound, blip, fanfare, party } from '/shared/party.js';

const BR = window.BR, { IN } = BR;
const socket = io('/castagne');
const R = createRenderer($('#view'));
R.resize(); addEventListener('resize', () => R.resize());

/* ---------------- Sons ---------------- */
function noise(dur, freq, vol, type = 'bandpass', to) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SFX = {
  hit: heavy => { noise(heavy ? 0.22 : 0.1, heavy ? 700 : 1500, heavy ? 0.5 : 0.3, 'lowpass', 120); blip(heavy ? 140 : 260, 50, heavy ? 0.25 : 0.12, 'sine', heavy ? 0.3 : 0.18); },
  whoosh: () => noise(0.16, 900, 0.12, 'bandpass', 2600),
  jump: () => blip(320, 620, 0.12, 'triangle', 0.06),
  air: () => blip(500, 900, 0.12, 'triangle', 0.05),
  land: () => noise(0.08, 300, 0.12, 'lowpass'),
  dodge: () => noise(0.2, 2400, 0.08, 'highpass'),
  pound: () => { noise(0.35, 400, 0.4, 'lowpass', 60); blip(90, 40, 0.3, 'sine', 0.3); },
  ko: () => { noise(0.9, 1200, 0.6, 'lowpass', 80); blip(220, 40, 0.9, 'sawtooth', 0.12); },
  tick: () => blip(660, 660, 0.12, 'square', 0.07),
  go: () => { blip(523, 1046, 0.4, 'square', 0.09); blip(784, 1568, 0.4, 'triangle', 0.06, 0.05); },
};

/* ---------------- Salon ---------------- */
let myChar = store.get('castagne-char');
if (!BR.CHARS[myChar]) myChar = 'fenna';
const ui = party({
  id: 'castagne', socket, max: 8, bots: 3, busy: '🥊 en combat', onError: t => toast(t),
  onRoom: (s, host) => {
    for (const id of ['stocksSel', 'timeSel', 'modeSel']) $(`#${id}`).disabled = !host;
    $('#stocksSel').value = s.settings.stocks; $('#timeSel').value = s.settings.time; $('#modeSel').value = s.settings.mode;
    $('#stocksSel').disabled = !host || s.settings.mode === 'lms';
    const n = s.players.length, m = s.settings.mode;
    if (host && m === 'duel' && n !== 2) $('#roomHint').textContent = 'Un duel se joue à 2 exactement.';
    if (host && m === 'teams' && (n < 4 || n % 2)) $('#roomHint').textContent = 'En équipes : un nombre pair de combattants, au moins 4 (ajoute des robots).';
    renderPicks(s);
  },
});
const { show, act } = ui;
$('#stocksSel').onchange = e => act('configure', 'stocks', Number(e.target.value));
$('#timeSel').onchange = e => act('configure', 'time', Number(e.target.value));
$('#modeSel').onchange = e => act('configure', 'mode', e.target.value);
// Choix du personnage : une carte par combattant, avec son portrait et ses forces
function charCards(box) {
  box.innerHTML = BR.CHAR_IDS.map(id => { const c = BR.CHARS[id]; return `<button class="char" data-char="${id}" style="--c:${LOOKS[id].fur}"><canvas width="140" height="140"></canvas><b>${c.name}</b><small>${c.title}</small><span class="stats">${Object.entries(c.stats).map(([k, v]) => `<i><em>${k}</em><u style="width:${v * 20}%"></u></i>`).join('')}</span></button>`; }).join('');
  box.querySelectorAll('canvas').forEach((cv, k) => drawPortrait(cv, BR.CHAR_IDS[k]));
}
charCards($('#picks')); charCards($('#homePicks'));
const choose = id => { myChar = id; store.set('castagne-char', id); renderPicks(ui.room); if (ui.room?.phase === 'lobby' || ui.room?.phase === 'over') act('pick', id); blip(500, 800, 0.1, 'triangle', 0.06); };
for (const box of [$('#picks'), $('#homePicks')]) box.onclick = e => { const b = e.target.closest('[data-char]'); if (b) { audio(); choose(b.dataset.char); } };
function renderPicks(s) {
  for (const b of document.querySelectorAll('[data-char]')) b.classList.toggle('on', b.dataset.char === myChar);
  if (!s) return;
  const who = {}; for (const p of s.players) (who[p.char] ??= []).push(p.name);
  for (const b of $('#picks').querySelectorAll('[data-char]')) b.dataset.who = (who[b.dataset.char] ?? []).join(', ');
}
renderPicks(null);

/* ---------------- États reçus ---------------- */
let S = null, phaseKey = '', countAt = 0, lastCount = -1;
const snaps = []; // { at, s }
let pred = null, pending = [], seq = 0, vis = { x: 0, y: 0 };
const inFight = s => s && ['countdown', 'fight', 'roundEnd'].includes(s.phase);
socket.on('state', s => {
  const old = S; S = s;
  const mine = s.players.find(p => p.name === s.me);
  if (mine && mine.char !== myChar && (s.phase === 'lobby' || s.phase === 'over')) act('pick', myChar);
  show(inFight(s) || s.phase === 'over' ? 'game' : 'room');
  ui.renderRoom();
  const key = `${s.round}.${s.roundNo}`;
  if (inFight(s) && key !== phaseKey) { phaseKey = key; pred = null; pending = []; snaps.length = 0; $('#board').hidden = true; buildCards(s); }
  if (s.phase === 'countdown') countAt = performance.now() + Math.max(0, s.deadline - s.now);
  if (s.phase === 'roundEnd' || s.phase === 'over') showBoard(s); else $('#board').hidden = true;
  if (old?.phase === 'countdown' && s.phase === 'fight') { SFX.go(); banner('CASTAGNE !'); }
});
socket.on('snap', snap => {
  const at = performance.now();
  snaps.push({ at, s: snap });
  while (snaps.length > 40) snaps.shift();
  const me = S?.me;
  for (const e of snap.ev) onEvent(e, me);
  // mon combattant : la position du serveur, puis mes touches pas encore vues par lui
  const mine = snap.p.find(p => p.id === me);
  if (mine) {
    const ack = snap.ack[me] ?? 0, before = pred && { x: pred.x, y: pred.y };
    pred = { ...mine, hitIds: [...mine.hitIds] };
    pending = pending.filter(([s]) => s > ack);
    const A = BR.ARENAS[S.arena];
    for (const [, bits] of pending) BR.step(pred, bits, A);
    if (before && Math.hypot(before.x - pred.x, before.y - pred.y) < 120) { vis.x += before.x - pred.x; vis.y += before.y - pred.y; }
  }
});
const TEAM = { rouge: '#ff4a4a', bleu: '#3d8bff' };
const names = () => Object.fromEntries((S?.players ?? []).map(p => [p.name, { ...p, color: TEAM[S.teams?.[p.name]] ?? p.color }]));
function onEvent(e, me) {
  const P = names();
  if (['jump', 'airjump', 'walljump', 'land', 'dodge'].includes(e.t)) {
    if (e.id === me) return; // mes propres sauts sont déjà montrés tout de suite
    sideFx(e);
    return;
  }
  if (e.t === 'pick') { R.fx.ring(e.x, e.y - 20, '#ffe07a', 10, 260); blip(600, 1200, 0.15, 'triangle', 0.07); if (e.id === me) toast(`${BR.WEAPONS[e.weapon].icon} ${BR.WEAPONS[e.weapon].name} ! (E pour la lancer)`); return; }
  if (e.t === 'throw') { SFX.whoosh(); return; }
  if (e.t === 'shot') { blip(900, 300, 0.08, 'square', 0.05); return; }
  if (e.t === 'item') { blip(1200, 1600, 0.2, 'sine', 0.05); return; }
  if (e.t === 'ledge' || e.t === 'climb') { if (e.id !== me) R.fx.dust(e.x, e.y, 4); return; }
  if (e.t === 'pound' || e.t === 'bounce') { R.fx.dust(e.x, e.y, 18, 2); R.fx.ring(e.x, e.y, '#fff4d0', 10, 420); SFX.pound(); return; }
  if (e.t === 'hit') {
    R.fx.hit(e, P[e.a]?.color ?? '#ffffff');
    if (e.combo > 1) R.fx.combo(e.x, e.y, e.combo, P[e.a]?.color ?? '#ffffff');
    if (e.big) { R.fx.focus(e.x, e.y); SFX.ko(); }
    SFX.hit(e.heavy);
    flashes[e.b] = 1;
    const card = cards[e.b]; if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    return;
  }
  if (e.t === 'ko') {
    R.fx.ko(e, P[e.id]?.color ?? '#ffffff');
    SFX.ko();
    banner(e.by ? `${e.by} éjecte ${e.id} !` : `${e.id} tombe !`, e.left <= 0 ? '💀 Éliminé' : `${e.left} vie${e.left > 1 ? 's' : ''} restante${e.left > 1 ? 's' : ''}`);
  }
}
function sideFx(e) {
  if (e.t === 'jump') { R.fx.dust(e.x, e.y, 6); SFX.jump(); }
  if (e.t === 'airjump' || e.t === 'walljump') { R.fx.ring(e.x, e.y - 10, '#ffffff', 6, 160); SFX.air(); }
  if (e.t === 'land') { R.fx.dust(e.x, e.y, 8); SFX.land(); }
  if (e.t === 'dodge') SFX.dodge();
}

/* ---------------- Commandes : clavier, souris, manette ---------------- */
const keys = new Set();
const KEYMAP = { KeyA: IN.L, KeyQ: IN.L, ArrowLeft: IN.L, KeyD: IN.R, ArrowRight: IN.R, KeyW: IN.U | IN.JUMP, KeyZ: IN.U | IN.JUMP, ArrowUp: IN.U | IN.JUMP, KeyS: IN.D, ArrowDown: IN.D, Space: IN.JUMP, KeyJ: IN.LIGHT, KeyX: IN.LIGHT, KeyK: IN.HEAVY, KeyC: IN.HEAVY, KeyL: IN.DODGE, ShiftLeft: IN.DODGE, ShiftRight: IN.DODGE, KeyV: IN.DODGE, KeyE: IN.PICK, KeyH: IN.PICK, KeyB: IN.PICK };
let mouse = 0;
addEventListener('keydown', e => { if (e.target.closest?.('input, select')) return; if (KEYMAP[e.code] !== undefined && document.body.classList.contains('playing')) { e.preventDefault(); keys.add(e.code); audio(); } });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse = 0; });
$('#view').addEventListener('mousedown', e => { audio(); mouse |= e.button === 2 ? IN.HEAVY : IN.LIGHT; });
addEventListener('mouseup', e => { mouse &= e.button === 2 ? ~IN.HEAVY : ~IN.LIGHT; });
$('#view').addEventListener('contextmenu', e => e.preventDefault());
function readInput() {
  let bits = mouse;
  for (const k of keys) bits |= KEYMAP[k];
  for (const g of navigator.getGamepads?.() ?? []) {
    if (!g) continue;
    const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0, b = i => g.buttons[i]?.pressed;
    if (ax < -0.35 || b(14)) bits |= IN.L;
    if (ax > 0.35 || b(15)) bits |= IN.R;
    if (ay < -0.5 || b(12)) bits |= IN.U;
    if (ay > 0.5 || b(13)) bits |= IN.D;
    if (b(0)) bits |= IN.JUMP;
    if (b(3)) bits |= IN.PICK;
    if (b(2)) bits |= IN.LIGHT;
    if (b(1)) bits |= IN.HEAVY;
    if (b(4) || b(5) || b(6) || b(7)) bits |= IN.DODGE;
  }
  if ((bits & IN.L) && (bits & IN.R)) bits &= ~(IN.L | IN.R);
  return bits;
}

/* ---------------- Interface du combat ---------------- */
const cards = {}, flashes = {};
function buildCards(s) {
  const box = $('#cards'); box.innerHTML = '';
  for (const k in cards) delete cards[k];
  for (const p of s.players) {
    const el = document.createElement('div');
    el.className = 'pcard'; el.style.setProperty('--c', TEAM[s.teams?.[p.name]] ?? p.color);
    el.innerHTML = `<canvas width="64" height="64"></canvas><div><b>${esc(p.name)}</b><span class="dmg">0</span><span class="stocks"></span></div>`;
    drawPortrait(el.querySelector('canvas'), p.char, true);
    box.append(el); cards[p.name] = el;
  }
}
const dmgColor = d => (d < 30 ? '#ffffff' : d < 70 ? '#ffe14a' : d < 110 ? '#ff9a3d' : d < 160 ? '#ff4a3a' : '#c0143c');
function hud(list) {
  for (const f of list) {
    const el = cards[f.id]; if (!el) continue;
    const d = el.querySelector('.dmg'), v = Math.round(f.dmg);
    if (d.textContent !== `${v}`) { d.textContent = v; d.style.color = dmgColor(v); }
    const st = f.state === 'out' ? '💀' : '❤️'.repeat(Math.max(0, f.stocks));
    const sEl = el.querySelector('.stocks'); if (sEl.textContent !== st) sEl.textContent = st;
    el.classList.toggle('out', f.state === 'out');
    el.dataset.weapon = f.weapon ? BR.WEAPONS[f.weapon].icon : '';
  }
  const s = S;
  if (s?.phase === 'fight') { const left = Math.max(0, Math.ceil((s.deadline - s.now - (performance.now() - stateAt)) / 1000)); $('#timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }
  else $('#timer').textContent = '';
  if (s?.phase === 'countdown') {
    const n = Math.ceil((countAt - performance.now()) / 1000);
    if (n !== lastCount && n > 0 && n <= 3) { lastCount = n; $('#cd').textContent = n; $('#cd').classList.remove('pop'); void $('#cd').offsetWidth; $('#cd').classList.add('pop'); SFX.tick(); }
    $('#cd').hidden = n <= 0;
  } else { $('#cd').hidden = true; lastCount = -1; }
}
let stateAt = performance.now();
socket.on('state', () => (stateAt = performance.now()));
function banner(title, sub = '') { const b = $('#banner'); b.hidden = true; void b.offsetWidth; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2200); }
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2200); }
function showBoard(s) {
  const over = s.phase === 'over', r = s.result;
  $('#boardTitle').textContent = over ? `🏆 ${s.ranking[0]?.name === s.me ? 'Tu remportes la castagne !' : `${s.ranking[0]?.name} remporte la castagne !`}` : (r?.team ? `🥇 L’équipe ${r.team} gagne la manche !` : `🥇 ${r?.ranking[0] ?? ''} gagne la manche !`);
  const rows = over ? s.ranking.map(p => ({ name: p.name, points: p.points, color: p.color })) : (r?.ranking ?? []).map(n => s.players.find(p => p.name === n)).filter(Boolean);
  $('#boardList').innerHTML = rows.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><i class="dot" style="background:${p.color}"></i><span>${esc(p.name)}</span>${over ? '' : `<em>💥 ${r?.kos[p.name] ?? 0} · 🕳 ${r?.falls[p.name] ?? 0}</em>`}<strong>${p.points} pts</strong></li>`).join('');
  $('#boardHint').textContent = over ? '' : `Manche ${s.roundNo}/${s.settings.rounds}${s.roundNo < s.settings.rounds ? ' · la suivante arrive…' : ''}`;
  ui.endButtons(s, rows);
  if (!over) $('#boardButtons').innerHTML = '';
  $('#board').hidden = false;
}

/* ---------------- Boucle ---------------- */
let last = performance.now(), acc = 0, outbox = [];
const STEP = 1 / BR.FPS;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = S, fighting = s && (s.phase === 'fight' || s.phase === 'roundEnd');
  // mes touches, au rythme de la simulation
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    if (fighting && pred) {
      const bits = readInput();
      pending.push([++seq, bits]); outbox.push([seq, bits]);
      pred.events = [];
      BR.step(pred, bits, BR.ARENAS[s.arena]);
      for (const e of pred.events) sideFx({ t: e, x: pred.x, y: pred.y });
      delete pred.events;
      if (pending.length > 120) pending.shift();
    }
  }
  if (outbox.length) { socket.emit('in', outbox.splice(0)); }
  vis.x *= Math.exp(-dt * 14); vis.y *= Math.exp(-dt * 14);
  // les autres : 100 ms en arrière, entre deux états
  const list = [];
  if (inFight(s) && snaps.length) {
    const rt = now - 100;
    let i = snaps.findIndex(x => x.at > rt); if (i < 0) i = snaps.length - 1;
    const B = snaps[i].s, Aa = snaps[Math.max(0, i - 1)].s, k = snaps[i].at > snaps[Math.max(0, i - 1)].at ? Math.max(0, Math.min(1, (rt - snaps[Math.max(0, i - 1)].at) / (snaps[i].at - snaps[Math.max(0, i - 1)].at))) : 1;
    for (const b of B.p) {
      let f;
      if (b.id === s.me && pred) f = { ...pred, x: pred.x + vis.x, y: pred.y + vis.y };
      else { const a = Aa.p.find(x => x.id === b.id) ?? b; f = { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, mt: b.state === a.state && b.move === a.move ? a.mt + (b.mt - a.mt) * k : b.mt }; }
      const P = names()[b.id];
      f.name = b.id; f.color = P?.color;
      // petits états visuels : foulée, vrille, éclair blanc à l'impact, traînées
      const v = (vfx[b.id] ??= { ph: 0, spin: 0 });
      v.ph += Math.abs(f.vx) * dt * 0.55; v.spin = f.state === 'hitstun' ? v.spin + Math.hypot(f.vx, f.vy) * dt * 0.35 * -f.facing : 0;
      f.runPh = v.ph; f.spinA = v.spin;
      f.flash = flashes[b.id] ?? 0; flashes[b.id] = Math.max(0, (flashes[b.id] ?? 0) - dt * 6);
      if (f.state === 'hitstun' && Math.hypot(f.vx, f.vy) > 12) R.fx.streak(f.x, f.y - 40, f.vx, f.vy, P?.color ?? '#fff');
      if (f.state === 'dodge' && Math.floor(t * 30) % 2) R.fx.trail(f, P?.color);
      list.push(f);
    }
  }
  const colors = Object.fromEntries(Object.values(names()).map(p => [p.name, p.color])), lastSnap = snaps.at(-1)?.s;
  R.draw(list, dt, t, colors, inFight(s) ? lastSnap?.items ?? [] : [], inFight(s) ? lastSnap?.shots ?? [] : []);
  if (inFight(s)) hud(list);
}
const vfx = {};
if (location.hostname === 'localhost') window.cg = { R, state: () => S, pred: () => pred }; // pour les captures de test
requestAnimationFrame(frame);
show('home');
