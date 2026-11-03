// Chute Libre : accueil, salons, boucle de jeu. Le navigateur déplace son personnage (sim.js) et envoie sa position ;
// le serveur fait tomber les dalles, déplace les robots et envoie l'état de l'arène (« snap »).
import { createView } from './render.js';

const C = window.Chute;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const params = new URLSearchParams(location.search);
const socket = io('/chute');

/* ---------------- Sons (synthétisés) ---------------- */
let ac = null;
const audio = () => { if (!ac) try { ac = new AudioContext(); } catch { /* pas de son */ } if (ac?.state === 'suspended') ac.resume(); return ac; };
function blip(f0, f1, dur, type = 'sine', vol = 0.15) {
  const a = ac; if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  jump: () => blip(320, 640, 0.18, 'sine', 0.12),
  dash: () => blip(900, 200, 0.2, 'sawtooth', 0.06),
  land: () => blip(140, 70, 0.1, 'triangle', 0.15),
  fall: () => blip(900, 90, 1.1, 'sine', 0.12),
  out: () => blip(500, 120, 0.3, 'square', 0.06),
  tick: () => blip(520, 520, 0.12, 'square', 0.06),
  go: () => blip(880, 1320, 0.35, 'square', 0.07),
  win: () => [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => blip(f, f, 0.25, 'triangle', 0.12), k * 120)),
};

/* ---------------- Écrans ---------------- */
let pseudo = store.get('chute-pseudo') || store.get('pseudo') || '';
$('#nameForm').pseudo.value = pseudo;
$('#nameForm').pseudo.oninput = e => { pseudo = e.target.value.trim().slice(0, 20); store.set('chute-pseudo', pseudo); };
$('#nameForm').onsubmit = e => e.preventDefault();
function show(id) {
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  const playing = id === 'game';
  $('#hud').hidden = !playing;
  document.body.classList.toggle('playing', playing);
}
const needName = () => { if (pseudo) return false; $('#nameForm').pseudo.focus(); alert('Choisis d’abord un pseudo'); return true; };
const ask = (ev, payload) => new Promise(res => socket.emit(ev, payload, r => res(r)));
const act = (...a) => new Promise(res => socket.emit('act', ...a, r => { if (r?.error) alert(r.error); res(r); }));
async function enter(ev, payload) {
  if (needName()) return null;
  const r = await ask(ev, { ...payload, name: pseudo });
  if (r?.error) alert(r.error);
  return r?.ok ? r : null;
}
$('#soloBtn').onclick = async () => {
  audio();
  if (!(await enter('create', { private: true }))) return;
  for (let k = 0; k < 5; k++) await act('addBot');
  act('start');
};
$('#createForm').onsubmit = e => { e.preventDefault(); audio(); enter('create', { private: e.target.vis.value === 'private' }); };
$('#joinForm').onsubmit = e => { e.preventDefault(); audio(); enter('join', { code: e.target.code.value, watch: e.submitter?.value === 'watch' }); };
$('#rooms').onclick = e => { const b = e.target.closest('[data-room]'); if (b) { audio(); enter('join', { code: b.dataset.room, watch: b.dataset.mode === 'watch' }); } };
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><span><b class="code">${r.code}</b> · ${r.players.map(esc).join(', ')} ${r.phase !== 'lobby' ? '· 🎮 en jeu' : ''}</span>
    ${r.phase === 'lobby' ? `<button class="small primary" data-room="${r.code}">Rejoindre</button>` : ''}<button class="small ghost" data-room="${r.code}" data-mode="watch">👁</button></li>`).join('') : '<li class="hint">Aucun salon public : crée le tien !</li>';
});
const leave = () => { socket.emit('leave'); store.set('chute-session', null); room = null; history.replaceState(null, '', location.pathname); $('#board').hidden = true; show('home'); };
$('#leave').onclick = leave;
$('#quitGame').onclick = leave;
$('#copyLink').onclick = () => { navigator.clipboard?.writeText(`${location.origin}/chute/?salon=${room.code}`); $('#copyLink').textContent = '✓ Copié'; setTimeout(() => ($('#copyLink').textContent = '🔗 Copier le lien'), 1500); };
$('#addBot').onclick = () => act('addBot');
$('#startBtn').onclick = () => { audio(); act('start'); };
$('#rounds').onchange = e => act('configure', 'rounds', Number(e.target.value));
$('#players').onclick = e => { const b = e.target.closest('[data-bot]'); if (b) act('removeBot', b.dataset.bot); };
socket.on('session', s => { store.set('chute-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
socket.on('closed', msg => { alert(msg); leave(); });
socket.on('connect', () => {
  let s = null; try { s = JSON.parse(store.get('chute-session')); } catch { /* illisible */ }
  const code = params.get('salon');
  if (s && (!code || s.code === code)) socket.emit('resume', s, r => { if (r?.error) { store.set('chute-session', null); if (code && pseudo) enter('join', { code }); } });
  else if (code && pseudo) enter('join', { code });
});

/* ---------------- État du salon ---------------- */
let room = null, offset = 0, roundKey = '', seenOrder = 0, lastCount = null;
socket.on('state', s => {
  room = s;
  if (!s) return;
  offset = s.now - Date.now();
  const inGame = ['countdown', 'play', 'roundEnd', 'over'].includes(s.phase);
  if (inGame) show('game'); else { show('room'); $('#board').hidden = true; }
  // Nouvelle manche : arène neuve, on se place sur sa case de départ.
  const key = `${s.round}.${s.roundNo}`;
  if (s.phase === 'countdown' && key !== roundKey) {
    roundKey = key; seenOrder = 0; lastCount = null;
    view.reset(); state.fill(0); remotes.clear(); tilesStr = '';
    me = s.spawn && !s.spectator ? C.newPlayer(s.spawn.x, s.spawn.y) : null;
    $('#feed').innerHTML = ''; $('#board').hidden = true; $('#spectating').hidden = true;
  }
  // Éliminations
  for (const n of s.order.slice(seenOrder)) {
    if (s.phase === 'roundEnd' && n === s.lastWinner) continue;
    feed(n === s.me ? 'Tu es tombé !' : `${n} est tombé !`);
    if (n !== s.me) SFX.out();
  }
  seenOrder = s.order.length;
  if (s.phase === 'roundEnd' || s.phase === 'over') showBoard(s);
  renderRoom();
});
function renderRoom() {
  const s = room, host = s.host === s.me;
  $('#roomCode').textContent = s.code;
  $('#count').textContent = `(${s.players.length}/12)`;
  $('#players').innerHTML = s.players.map(p => `<li class="${p.connected ? '' : 'off'}"><i class="dot" style="background:${p.color}"></i><span>${esc(p.name)}${p.name === s.host ? ' 👑' : ''}${p.wins ? ` · 🏆 ${p.wins}` : ''}</span>${p.bot && host ? `<button class="small ghost" data-bot="${esc(p.name)}" aria-label="Retirer ${esc(p.name)}">✕</button>` : ''}</li>`).join('');
  $('#spect').textContent = s.spectators.length ? `👁 ${s.spectators.join(', ')}` : '';
  $('#addBot').hidden = !host; $('#rounds').disabled = !host; $('#rounds').value = s.settings.rounds;
  $('#startBtn').hidden = !host; $('#startBtn').disabled = s.players.length < 2;
  $('#roomHint').textContent = host ? (s.players.length < 2 ? 'Ajoute des robots ou invite des amis (lien ci-dessus).' : 'Tout le monde est là ? Lance la partie !') : 'Le créateur du salon lance la partie.';
}
function feed(text) {
  const li = document.createElement('li'); li.textContent = text; $('#feed').prepend(li);
  setTimeout(() => li.remove(), 4000);
}
function showBoard(s) {
  const over = s.phase === 'over', host = s.host === s.me;
  const rows = over ? s.ranking : [...s.players].sort((a, b) => b.points - a.points);
  const gained = n => { const k = s.order.indexOf(n); return k >= 0 ? k : 0; };
  $('#boardTitle').textContent = over ? `🏆 ${rows[0]?.name === s.me ? 'Tu gagnes la partie !' : `${rows[0]?.name} gagne la partie !`}` : `⭐ ${s.lastWinner === s.me ? 'Tu gagnes la manche !' : `${s.lastWinner ?? 'Personne'} gagne la manche`}`;
  $('#boardList').innerHTML = rows.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><i class="dot" style="width:14px;height:14px;border-radius:50%;background:${p.color}"></i><span>${esc(p.name)}</span>${over ? '' : `<em>+${gained(p.name)}</em>`}<strong>${p.points} pts</strong></li>`).join('');
  $('#boardHint').textContent = over ? '' : `Manche ${s.roundNo}/${s.settings.rounds} terminée · la suite arrive…`;
  const btns = $('#boardButtons'); btns.innerHTML = '';
  if (over) {
    if (host) { const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Rejouer'; b.onclick = async () => { await act('again'); act('start'); }; btns.append(b); }
    const b2 = document.createElement('button'); b2.className = 'ghost'; b2.textContent = host ? 'Retour au salon' : 'Quitter'; b2.onclick = () => (host ? act('again') : leave()); btns.append(b2);
    if (rows[0]?.name === s.me) SFX.win();
  }
  $('#board').hidden = false;
}

/* ---------------- Commandes ---------------- */
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select')) return;
  if (document.body.classList.contains('playing') && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const touch = { x: 0, y: 0, jump: false, dash: false };
$('#touch').hidden = !matchMedia('(pointer: coarse)').matches;
{
  const stick = $('#stick'), knob = stick.querySelector('i');
  let id = null;
  const move = e => {
    const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy), m = r.width / 2;
    const k = l > m ? m / l : 1;
    touch.x = dx * k / m; touch.y = dy * k / m;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); move(e); audio(); });
  stick.addEventListener('pointermove', e => e.pointerId === id && move(e));
  const end = () => { id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const b of $$('#touch [data-key]')) {
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch[b.dataset.key] = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => (touch[b.dataset.key] = false));
  }
}
function input() {
  const k = c => keys.has(c);
  let x = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.x;
  let y = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0) + touch.y;
  const gp = navigator.getGamepads?.()[0];
  if (gp && Math.hypot(gp.axes[0], gp.axes[1]) > 0.15) { x = gp.axes[0]; y = gp.axes[1]; }
  return { x, y, jump: k('Space') || touch.jump || !!gp?.buttons[0]?.pressed, dash: k('ShiftLeft') || k('ShiftRight') || k('KeyE') || touch.dash || !!gp?.buttons[2]?.pressed };
}

/* ---------------- Boucle de jeu ---------------- */
const view = createView($('#view'));
view.resize(); addEventListener('resize', () => view.resize());
const state = new Uint8Array(C.tiles.length);
const remotes = new Map(); // pseudo -> [{ at, x, y, z, alive, dash, dx, dy }]
let me = null, acc = 0, lastSend = 0, last = performance.now(), tilesStr = '';
socket.on('snap', snap => {
  if (snap.tiles !== tilesStr) { tilesStr = snap.tiles; for (let k = 0; k < state.length; k++) state[k] = +snap.tiles[k]; view.setTiles(snap.tiles, performance.now() / 1000); }
  const at = performance.now() / 1000;
  for (const [n, x, y, z, alive, dash, dx, dy] of snap.p) {
    if (!remotes.has(n)) remotes.set(n, []);
    const b = remotes.get(n); b.push({ at, x, y, z, alive, dash, dx, dy });
    if (b.length > 12) b.shift();
  }
});
function remoteAt(n, t) {
  const b = remotes.get(n); if (!b?.length) return null;
  let k = b.findIndex(s => s.at > t); if (k < 0) k = b.length - 1;
  const B = b[k], A = b[Math.max(0, k - 1)], f = B.at > A.at ? Math.max(0, Math.min(1, (t - A.at) / (B.at - A.at))) : 1;
  return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, z: A.z + (B.z - A.z) * f, alive: B.alive, dash: B.dash, dx: B.dx, dy: B.dy, vx: (B.x - A.x) / Math.max(0.01, B.at - A.at), vy: (B.y - A.y) / Math.max(0.01, B.at - A.at) };
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = room;
  const list = [];
  if (s && ['countdown', 'play', 'roundEnd', 'over'].includes(s.phase)) {
    // Les autres, affichés avec 100 ms de retard pour être fluides
    const others = [];
    for (const p of s.players) {
      if (p.name === s.me && me) continue;
      const r = remoteAt(p.name, t - 0.1);
      if (r) { const o = { name: p.name, color: p.color, ...r }; others.push(o); list.push(o); }
    }
    // Mon personnage : simulé ici, à pas fixes
    if (me && s.phase === 'play' && me.alive) {
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const ev = C.step(me, input(), state, 1 / 60);
        for (const o of others) if (o.alive) C.collide(me, { ...o, R: C.R, dashT: o.dash ? 0.1 : 0 }, true);
        for (const e of ev) {
          if (e === 'out') { SFX.fall(); $('#spectating').hidden = false; socket.emit('pos', { x: me.x, y: me.y, z: me.z }); } // dernière position : le serveur m'élimine
          else SFX[e]?.();
        }
      }
      if (now - lastSend > 50 || !me.alive) {
        lastSend = now;
        socket.volatile.emit('pos', { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), vx: +me.vx.toFixed(1), vy: +me.vy.toFixed(1), d: me.dashT > 0 ? 1 : 0, dx: +me.dx.toFixed(2), dy: +me.dy.toFixed(2) });
      }
    } else acc = 0;
    const mine = s.players.find(p => p.name === s.me);
    if (me && mine) list.push({ name: s.me, color: mine.color, x: me.x, y: me.y, z: me.z, alive: me.alive, dash: me.dashT > 0, dx: me.dx, dy: me.dy, vx: me.vx, vy: me.vy });
    // Compte à rebours
    if (s.phase === 'countdown') {
      const n = Math.ceil((s.deadline - (Date.now() + offset)) / 1000);
      if (n !== lastCount && n > 0 && n <= 3) { lastCount = n; $('#count3').textContent = n; $('#count3').hidden = false; restartAnim($('#count3')); SFX.tick(); }
    } else if (s.phase === 'play' && lastCount !== 0) { lastCount = 0; $('#count3').textContent = 'GO !'; restartAnim($('#count3')); SFX.go(); setTimeout(() => ($('#count3').hidden = true), 700); }
    const alive = list.filter(o => o.alive);
    $('#hRound').textContent = `Manche ${s.roundNo}/${s.settings.rounds}`;
    $('#hAlive').textContent = `${alive.length} en vie`;
    $('#dashMeter i').style.width = `${me ? (1 - me.dashCd / C.DASH_CD) * 100 : 0}%`;
    $('#dashMeter').hidden = !me;
    // La caméra suit mon personnage, sinon la moyenne des survivants
    const focus = me?.alive ? me : alive.length ? { x: alive.reduce((a, o) => a + o.x, 0) / alive.length, y: alive.reduce((a, o) => a + o.y, 0) / alive.length, z: Math.min(...alive.map(o => o.z)) } : null;
    view.update(list, focus, dt, t, state);
    labels(list, s.me);
  } else view.update([], { x: Math.cos(t * 0.1) * 3, y: Math.sin(t * 0.1) * 3, z: 0 }, dt, t, state);
}
function restartAnim(el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
const labelEls = new Map();
function labels(list, mine) {
  const box = $('#labels'), seen = new Set();
  for (const o of list) {
    if (!o.alive && o.z < C.DEATH) continue;
    seen.add(o.name);
    let el = labelEls.get(o.name);
    if (!el) { el = document.createElement('span'); el.textContent = o.name; box.append(el); labelEls.set(o.name, el); }
    el.className = o.name === mine ? 'me' : '';
    const [x, y, ok] = view.project(o.x, o.y, o.z + 1.6);
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.hidden = !ok;
  }
  for (const [n, el] of labelEls) if (!seen.has(n)) { el.remove(); labelEls.delete(n); }
}
requestAnimationFrame(frame);
show('home');
