// Caboche Cup : accueil (choix du joueur), salon et match. Le navigateur lit les touches 60 fois par seconde, les envoie
// numérotées au serveur (« in ») et fait bouger son joueur tout de suite avec la même physique ; à chaque état reçu
// (« snap »), il reprend la position du serveur et rejoue les touches que le serveur n'a pas encore vues.
// L'adversaire est affiché avec un léger retard, lissé ; le ballon est prolongé jusqu'à maintenant (vitesse et gravité).
import { createStadium, TEAM } from './render.js';
import { $, esc, store, audio, sound, blip, fanfare, party } from '/shared/party.js';

const CC = window.CC, { IN } = CC;
const socket = io('/caboche');
const V = createStadium($('#view'));
addEventListener('resize', () => V.resize());

/* ---------------- Sons ---------------- */
function noise(dur, freq, vol, type = 'bandpass', to, at = 0) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SFX = {
  kick: p => { blip(160, 60, 0.12, 'sine', 0.3); noise(0.06, 900, 0.25, 'lowpass'); if (p > 21) blip(90, 40, 0.2, 'sine', 0.25); },
  head: () => { blip(320, 140, 0.1, 'sine', 0.25); noise(0.05, 1200, 0.15); },
  bounce: v => blip(140, 70, 0.08, 'sine', Math.min(0.2, v * 0.02)),
  post: () => { blip(1400, 1300, 0.6, 'triangle', 0.12); blip(2100, 2000, 0.4, 'sine', 0.06); },
  wall: () => noise(0.08, 2400, 0.12, 'highpass'),
  whistle: (n = 1) => { for (let k = 0; k < n; k++) blip(2600, 2500, 0.28, 'sine', 0.08, k * 0.36); },
  goal: () => { noise(3, 900, 0.55, 'bandpass', 600); noise(2.5, 400, 0.4, 'lowpass', 200, 0.1); fanfare([523, 659, 784, 1046], 0.1); },
  ooh: () => noise(1.2, 700, 0.25, 'bandpass', 450),
  tackle: () => noise(0.25, 300, 0.3, 'lowpass', 120),
  fall: () => { blip(200, 60, 0.3, 'sine', 0.2); noise(0.2, 500, 0.2, 'lowpass'); },
  power: () => { blip(300, 1200, 0.5, 'sawtooth', 0.07); blip(600, 2400, 0.4, 'sine', 0.05, 0.1); },
  jump: () => blip(300, 600, 0.1, 'triangle', 0.05),
};
// rumeur du public en continu
let crowdNode = null;
function crowd(level) {
  const ac = sound(); if (!ac) return;
  if (!crowdNode) {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; s.loop = true; f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6; g.gain.value = 0;
    s.connect(f).connect(g).connect(ac.destination); s.start(); crowdNode = g;
  }
  crowdNode.gain.setTargetAtTime(level, ac.currentTime, 0.4);
}

/* ---------------- Salon ---------------- */
let myChar = store.get('caboche-char'); if (!CC.CHARS[myChar]) myChar = 'bouboule';
const ui = party({
  id: 'caboche', socket, max: 2, bots: 1, busy: '⚽ en match', onError: t => toast(t),
  onShow: sc => { if (sc !== 'game') crowd(0); },
  onRoom: (s, host) => {
    for (const id of ['timeSel', 'levelSel']) $(`#${id}`).disabled = !host;
    $('#timeSel').value = s.settings.time; $('#levelSel').value = s.settings.level;
    renderPicks();
  },
});
const { show, act } = ui;
$('#timeSel').onchange = e => act('configure', 'time', Number(e.target.value));
$('#levelSel').onchange = e => act('configure', 'level', Number(e.target.value));
function charCards(box) {
  box.innerHTML = CC.CHAR_IDS.map(id => { const c = CC.CHARS[id], pw = CC.POWERS[c.power]; return `<button class="char" data-char="${id}"><b>${c.name}</b><small>${c.title}</small><span class="pw">${pw.icon} ${pw.name}</span><span class="stats">${Object.entries(c.stats).map(([k, v]) => `<i><em>${k}</em><u style="width:${v * 20}%"></u></i>`).join('')}</span></button>`; }).join('');
}
charCards($('#homePicks')); charCards($('#picks'));
for (const box of [$('#picks'), $('#homePicks')]) box.onclick = e => { const b = e.target.closest('[data-char]'); if (!b) return; audio(); myChar = b.dataset.char; store.set('caboche-char', myChar); renderPicks(); if (ui.room && ['lobby', 'over'].includes(ui.room.phase)) act('pick', myChar); blip(500, 800, 0.1, 'triangle', 0.06); };
function renderPicks() { for (const b of document.querySelectorAll('[data-char]')) b.classList.toggle('on', b.dataset.char === myChar); }
renderPicks();
// Match rapide : un salon public qui attend un adversaire, sinon on en ouvre un
let rooms = [];
socket.on('rooms', l => (rooms = l));
$('#quickBtn').onclick = async () => {
  audio();
  const open = rooms.find(r => r.phase === 'lobby' && r.players.length === 1);
  if (open) ui.enter('join', { code: open.code }); else { await ui.enter('create', { private: false }); toast('En attente d’un adversaire… (ou ajoute un robot)'); }
};

/* ---------------- États reçus ---------------- */
let S = null, matchKey = '';
const snaps = [];
let pred = null, pending = [], seq = 0, vis = { x: 0, z: 0 };
const inMatch = s => s && ['kickoff', 'play', 'goal', 'end'].includes(s.phase);
socket.on('state', s => {
  const old = S; S = s;
  const mine = s.players.find(p => p.name === s.me);
  if (mine && mine.char !== myChar && ['lobby', 'over'].includes(s.phase)) act('pick', myChar);
  show(inMatch(s) || s.phase === 'over' ? 'game' : 'room');
  ui.renderRoom();
  const key = `${s.round}.${s.roundNo}`;
  if (inMatch(s) && key !== matchKey) { matchKey = key; pred = null; pending = []; snaps.length = 0; $('#board').hidden = true; }
  if (old?.phase !== s.phase) onPhase(s, old);
  if (s.phase === 'end' || s.phase === 'over') showBoard(s); else $('#board').hidden = true;
});
function onPhase(s, old) {
  if (s.phase === 'kickoff') { V.cam.focus = null; countdown(); }
  if (s.phase === 'play' && old?.phase === 'kickoff') { SFX.whistle(); banner('C’EST PARTI !', ''); }
  if (s.phase === 'end') { SFX.whistle(3); crowd(0.15); V.cam.focus = null; }
}
let countT = null;
function countdown() { let n = 2; clearInterval(countT); const el = $('#cd'); const tick = () => { el.textContent = n > 0 ? n : '⚽'; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); blip(n > 0 ? 660 : 990, n > 0 ? 660 : 990, 0.12, 'square', 0.06); if (n-- <= 0) { clearInterval(countT); setTimeout(() => (el.hidden = true), 500); } }; tick(); countT = setInterval(tick, 700); }
socket.on('snap', snap => {
  snaps.push({ at: performance.now(), s: snap });
  while (snaps.length > 30) snaps.shift();
  const me = S?.me;
  for (const e of snap.ev) onEvent(e, me);
  const mine = snap.p.find(p => p.id === me);
  if (mine) {
    const ack = snap.ack[me] ?? 0, before = pred && { x: pred.x, z: pred.z };
    pred = { ...mine };
    pending = pending.filter(([q]) => q > ack);
    if (S?.phase === 'play' || S?.phase === 'goal') for (const [, bits] of pending) CC.step(pred, bits);
    if (before && Math.hypot(before.x - pred.x, before.z - pred.z) < 2) { vis.x += before.x - pred.x; vis.z += before.z - pred.z; }
  }
});
const nameOf = id => S?.players.find(p => p.name === id)?.name ?? id;
function onEvent(e, me) {
  if (e.t === 'kick') { V.fx.kick(e); SFX.kick(e.p); if (e.fire) { banner('🔥 SUPER TIR !', ''); SFX.power(); } return; }
  if (e.t === 'header') { V.fx.spark(e.x, e.y, e.z, '#ffffff', 12); SFX.head(); return; }
  if (e.t === 'bounce') { SFX.bounce(e.v); return; }
  if (e.t === 'post') { V.fx.spark(e.x, 1.5, e.z, '#ffffff', 30); SFX.post(); SFX.ooh(); flash('POTEAU !'); return; }
  if (e.t === 'wall') { SFX.wall(); return; }
  if (e.t === 'tackle') { SFX.tackle(); return; }
  if (e.t === 'fall') { V.fx.dust(e.x, e.z, 20, '#8aa870'); SFX.fall(); V.fx.shake(0.3); if (e.id === me) toast('Taclé ! 🤕'); return; }
  if (e.t === 'jump') { if (e.id !== me) SFX.jump(); return; }
  if (e.t === 'land') { V.fx.dust(e.x, e.z, 6); return; }
  if (e.t === 'power') { const p = S?.players.find(x => x.name === e.id), pw = CC.POWERS[CC.CHARS[p?.char ?? 'bouboule'].power]; banner(`${pw.icon} ${pw.name.toUpperCase()} !`, nameOf(e.id)); SFX.power(); return; }
  if (e.t === 'golden') { banner('BUT EN OR !', 'Le prochain but gagne le match'); SFX.whistle(2); return; }
  if (e.t === 'goal') {
    V.fx.goal(e.side); SFX.goal(); crowd(0.6); setTimeout(() => crowd(0.18), 3500);
    const mine = S?.sides?.[e.side] === me;
    banner(e.own ? 'CONTRE SON CAMP !' : 'BUUUT !', `${nameOf(e.by)} · ${e.score[0]} - ${e.score[1]}`);
    V.cam.focus = { x: (e.side === 0 ? 1 : -1) * CC.F.HL * 0.75 };
    V.celebrate(e.by, 'danser'); const other = S?.sides?.[1 - e.side]; if (other) V.celebrate(other, 'pleurer');
    goalFlash = performance.now() + 2500;
    if (mine) blip(784, 1568, 0.4, 'square', 0.06, 0.3);
  }
}

/* ---------------- Commandes ---------------- */
const keys = new Set();
const KEYMAP = { KeyA: IN.L, KeyQ: IN.L, ArrowLeft: IN.L, KeyD: IN.R, ArrowRight: IN.R, KeyW: IN.U, KeyZ: IN.U, ArrowUp: IN.U, KeyS: IN.D, ArrowDown: IN.D, Space: IN.JUMP, KeyJ: IN.KICK, KeyK: IN.TACKLE, KeyE: IN.POWER, KeyF: IN.POWER, ShiftLeft: IN.TACKLE };
let mouse = 0;
addEventListener('keydown', e => { if (e.target.closest?.('input, select')) return; if (KEYMAP[e.code] !== undefined && document.body.classList.contains('playing')) { e.preventDefault(); keys.add(e.code); audio(); } });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse = 0; });
$('#view').addEventListener('mousedown', e => { audio(); mouse |= e.button === 2 ? IN.TACKLE : IN.KICK; });
addEventListener('mouseup', e => { mouse &= e.button === 2 ? ~IN.TACKLE : ~IN.KICK; });
$('#view').addEventListener('contextmenu', e => e.preventDefault());
function readInput() {
  let bits = mouse;
  for (const k of keys) bits |= KEYMAP[k];
  for (const g of navigator.getGamepads?.() ?? []) {
    if (!g) continue;
    const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0, b = i => g.buttons[i]?.pressed;
    if (ax < -0.35) bits |= IN.L; if (ax > 0.35) bits |= IN.R; if (ay < -0.35) bits |= IN.U; if (ay > 0.35) bits |= IN.D;
    if (b(0)) bits |= IN.JUMP; if (b(2) || b(7)) bits |= IN.KICK; if (b(1) || b(6)) bits |= IN.TACKLE; if (b(3)) bits |= IN.POWER;
  }
  return bits;
}

/* ---------------- Interface ---------------- */
let toastT = 0, goalFlash = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2400); }
function banner(title, sub) { const b = $('#banner'); b.hidden = true; void b.offsetWidth; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2600); }
function flash(t) { const el = $('#flash'); el.textContent = t; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => (el.hidden = true), 1200); }
function showBoard(s) {
  const over = s.phase === 'over', r = s.result;
  if (over) {
    $('#boardTitle').textContent = `🏆 ${s.ranking[0]?.name === s.me ? 'Tu gagnes la Caboche Cup !' : `${s.ranking[0]?.name} gagne la Caboche Cup !`}`;
    $('#boardList').innerHTML = s.ranking.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><span>${esc(p.name)}</span><strong>${p.points} pts</strong></li>`).join('');
    $('#boardHint').textContent = '';
  } else if (r) {
    $('#boardTitle').textContent = r.winner ? (r.winner === s.me ? '🎉 Victoire !' : `${r.winner} gagne le match`) : '🤝 Match nul';
    $('#boardList').innerHTML = r.sides.map((n, k) => `<li class="${n === s.me ? 'me' : ''}"><i class="dot" style="background:${TEAM[k]}"></i><span>${esc(n)}</span><strong>${r.score[k]}</strong></li>`).join('');
    $('#boardHint').textContent = r.forfeit !== null ? 'Victoire par forfait' : s.roundNo < s.settings.rounds ? `Match ${s.roundNo}/${s.settings.rounds} · le suivant arrive…` : '';
  }
  ui.endButtons(s, over ? s.ranking : []);
  if (!over) $('#boardButtons').innerHTML = '';
  $('#board').hidden = false;
}
let lastBoard = '';
function hud(list, snap) {
  const s = S;
  const names = s?.sides ?? [], score = s?.score ?? [0, 0];
  const secs = Math.ceil((snap?.clock ?? 0) / 1000), clock = snap?.golden ? 'BUT EN OR' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('#sbL').textContent = names[0] ?? ''; $('#sbR').textContent = names[1] ?? '';
  $('#sbScore').textContent = `${score[0]} - ${score[1]}`; $('#sbClock').textContent = clock;
  $('#sbClock').classList.toggle('hurry', !snap?.golden && secs <= 10 && s?.phase === 'play');
  const flashOn = performance.now() < goalFlash, sig = `${names}|${score}|${clock}|${flashOn}`;
  if (sig !== lastBoard) { lastBoard = sig; V.drawBoard(names, score, clock, flashOn); }
  for (const p of list) {
    const el = $(p.side ? '#gR' : '#gL'), pw = CC.POWERS[CC.CHARS[p.char].power];
    el.style.setProperty('--g', `${Math.round(p.gauge * 100)}%`);
    el.classList.toggle('full', p.gauge >= 1); el.classList.toggle('active', !!p.power);
    el.querySelector('span').textContent = p.power ? `${pw.icon} ${pw.name} !` : p.gauge >= 1 ? `${pw.icon} ${p.id === s?.me ? 'E : ' : ''}${pw.name}` : `${pw.icon} ${Math.round(p.gauge * 100)} %`;
  }
}

/* ---------------- Boucle ---------------- */
let last = performance.now(), acc = 0, outbox = [];
const tags = {};
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = S, live = s && (s.phase === 'play' || s.phase === 'goal');
  acc += dt;
  while (acc >= CC.DT) {
    acc -= CC.DT;
    if (live && pred) { const bits = readInput(); pending.push([++seq, bits]); outbox.push([seq, bits]); pred.ev = []; CC.step(pred, bits); for (const e of pred.ev) if (e === 'jump') SFX.jump(); delete pred.ev; if (pending.length > 120) pending.shift(); }
  }
  if (outbox.length) socket.emit('in', outbox.splice(0));
  vis.x *= Math.exp(-dt * 14); vis.z *= Math.exp(-dt * 14);
  let list = [], ballNow = null;
  const snap = snaps.at(-1)?.s;
  if (inMatch(s) && snaps.length) {
    V.syncPlayers(snap.p.map(p => ({ name: p.id, char: p.char, side: p.side })));
    const rt = now - 66;
    let i = snaps.findIndex(x => x.at > rt); if (i < 0) i = snaps.length - 1;
    const B = snaps[i], A = snaps[Math.max(0, i - 1)], k = B.at > A.at ? Math.max(0, Math.min(1, (rt - A.at) / (B.at - A.at))) : 1;
    for (const b of B.s.p) {
      let p;
      if (b.id === s.me && pred) p = { ...pred, x: pred.x + vis.x, z: pred.z + vis.z };
      else { const a = A.s.p.find(x => x.id === b.id) ?? b; p = { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; }
      list.push(p); V.posePlayer(p.id, p, dt, t);
    }
    // ballon : dernier état connu, prolongé jusqu'à maintenant
    const L = snaps.at(-1), age = Math.min(0.12, (now - L.at) / 1000), [bx, by, bz, bvx, bvy, bvz, fire] = L.s.b;
    ballNow = { x: bx + bvx * age, y: Math.max(CC.BALL.r, by + bvy * age - 0.5 * CC.BALL.g * age * age), z: bz + bvz * age, fire };
    hud(list, snap);
  } else V.syncPlayers([]);
  V.update(dt, t, ballNow ?? { x: 0, y: CC.BALL.r, z: 0, fire: 0 });
  // noms au-dessus des têtes
  for (const p of list) {
    const el = (tags[p.id] ??= Object.assign(document.createElement('div'), { className: 'tag' }));
    if (!el.parentNode) $('#labels').append(el);
    const hp = V.headPos(p.id); if (!hp) continue;
    const sc = V.project(hp);
    el.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -100%)`;
    el.innerHTML = `<b style="--c:${TEAM[p.side]}">${esc(p.id)}${p.id === s.me ? ' (toi)' : ''}</b>`;
  }
  for (const [id, el] of Object.entries(tags)) if (!list.some(p => p.id === id)) { el.remove(); delete tags[id]; }
  if (live && sound()) crowd(0.16);
}
if (location.hostname === 'localhost') window.cb = { V, state: () => S, pred: () => pred };
requestAnimationFrame(frame);
show('home');
