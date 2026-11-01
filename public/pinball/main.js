// 3D Pinball : menu, partie, commandes (clavier, souris, tactile), interface, progression, classement.
import { TABLES, tableById } from './tables.js';
import { createGame, update, setFlipper, plunge, shake, ballReady, lights } from './game.js';
import { createView, SKINS, LOW } from './render.js';
import { startAudio, play, rolling, music, volume, setVolume } from './audio.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const TOUCH = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile'); // ?mobile force le mode tactile
document.body.classList.toggle('touch', TOUCH);

/* ---------- Profil (navigateur) ---------- */
const KEY = 'pinball-profile';
const blank = () => ({ best: {}, games: 0, total: 0, bestCombo: 0, seconds: 0, bumpers: 0, ramps: 0, missions: 0, jackpots: 0, trophies: {}, skin: 'chrome', sound: { sfx: 0.8, music: 0.45 } });
let profile = blank();
try { profile = { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { /* profil illisible : on repart de zéro */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* navigation privée */ } };
Object.assign(volume, profile.sound);

const TROPHIES = [
  { id: 'premiere', name: 'Première partie', desc: 'Termine une partie.', test: (g, p) => p.games >= 1 },
  { id: 'cent', name: 'Échauffement', desc: '100 000 points en une partie.', test: g => g.score >= 100000 },
  { id: 'million', name: 'Millionnaire', desc: '1 000 000 de points en une partie.', test: g => g.score >= 1000000 },
  { id: 'cinq', name: 'Légende de l’arcade', desc: '5 000 000 de points en une partie.', test: g => g.score >= 5000000 },
  { id: 'multiball', name: 'Multiball !', desc: 'Déclenche le multiball.', test: g => g.missions.multiball },
  { id: 'jackpot', name: 'Super Jackpot', desc: 'Remporte le super jackpot.', test: g => g.missions.super },
  { id: 'combo10', name: 'Enchaînement', desc: 'Réussis un combo ×10.', test: g => g.bestCombo >= 10 },
  { id: 'toutes', name: 'Perfectionniste', desc: 'Toutes les missions (hors finale) en une partie.', test: g => g.table.missions.filter(m => !m.final).every(m => g.missions[m.id]) },
  { id: 'rampes', name: 'Pilote de rampes', desc: '50 rampes au total.', test: (g, p) => p.ramps >= 50 },
  { id: 'fidele', name: 'Habitué', desc: 'Joue 10 parties.', test: (g, p) => p.games >= 10 },
];
// Billes à débloquer : chacune liée à un succès.
const SKIN_UNLOCK = { chrome: null, or: 'million', neon: 'multiball', feu: 'jackpot' };
const skinOpen = id => !SKIN_UNLOCK[id] || profile.trophies[SKIN_UNLOCK[id]];

/* ---------- Écrans ---------- */
function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; }
let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ---------- Menu ---------- */
let selected = 'arcade', tab = 'board';
function renderMenu() {
  show('menu');
  $('#tables').innerHTML = TABLES.map(t => `<button class="tcard ${t.id}${t.soon ? ' soon' : ''}${t.id === selected ? ' on' : ''}" data-table="${t.id}" ${t.soon ? 'aria-disabled="true"' : ''}>
    <span class="tart"></span><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small>
    ${t.soon ? '<i>Bientôt</i>' : `<i>Record : ${fmt(profile.best[t.id] || 0)}</i>`}</button>`).join('');
  const t = tableById(selected);
  $('#tableInfo').innerHTML = `<p class="kicker">Table 1</p><h2>${esc(t.name)}</h2><p class="hint">${esc(t.tagline)}</p>
    <h3>Missions</h3><ol class="mlist">${t.missions.map(m => `<li class="${m.final ? 'boss' : ''}"><b>${esc(m.name)}</b> <small>+${fmt(m.bonus)}</small><p>${esc(m.desc)}</p></li>`).join('')}</ol>
    <p class="record">Ton record : <b>${fmt(profile.best[t.id] || 0)}</b></p>
    <button class="primary big" id="playBtn">▶ Jouer (3 billes)</button>
    <p class="hint">${TOUCH ? 'Touche la moitié gauche ou droite de l’écran pour les flippers ; boutons Lancer et Secouer.' : '<kbd>←</kbd>/<kbd>A</kbd> et <kbd>→</kbd>/<kbd>D</kbd> : flippers · <kbd>↓</kbd>/<kbd>Entrée</kbd> ou clic : lancer (maintenir pour charger) · <kbd>Espace</kbd> : secouer'}</p>`;
  renderTab();
}
$('#tables').onclick = e => {
  const b = e.target.closest('[data-table]');
  if (!b) return;
  if (b.classList.contains('soon')) return toast('Cette table arrive bientôt !');
  selected = b.dataset.table;
  renderMenu();
};
$('#tableInfo').addEventListener('click', e => { if (e.target.id === 'playBtn') startGame(selected); });
$('#tabs').onclick = e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  for (const x of $$('#tabs button')) x.classList.toggle('on', x === b);
  renderTab();
};
async function renderTab() {
  const body = $('#tabBody');
  if (tab === 'trophies') {
    body.innerHTML = `<ul class="trophies">${TROPHIES.map(t => `<li class="${profile.trophies[t.id] ? 'got' : ''}"><span>${profile.trophies[t.id] ? '🏅' : '🔒'}</span><div><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></div></li>`).join('')}</ul>`;
  } else if (tab === 'skins') {
    body.innerHTML = `<div class="skins">${Object.entries(SKINS).map(([id, s]) => {
      const open = skinOpen(id), tr = TROPHIES.find(t => t.id === SKIN_UNLOCK[id]);
      return `<button class="skin${profile.skin === id ? ' on' : ''}" data-skin="${id}" ${open ? '' : 'disabled'}><i style="--c:${s.color};--e:${s.emissive || 'transparent'}"></i><b>${esc(s.name)}</b><small>${open ? (profile.skin === id ? 'Choisie' : 'Choisir') : `🔒 ${esc(tr.name)}`}</small></button>`;
    }).join('')}</div>`;
  } else if (tab === 'stats') {
    const p = profile;
    body.innerHTML = `<dl class="stats">${[['Parties', p.games], ['Points au total', fmt(p.total)], ['Meilleur combo', p.bestCombo], ['Temps de jeu', `${Math.floor(p.seconds / 60)} min`], ['Bumpers touchés', fmt(p.bumpers)], ['Rampes réussies', fmt(p.ramps)], ['Missions réussies', p.missions], ['Super jackpots', p.jackpots]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  } else {
    body.innerHTML = '<p class="hint">Chargement du classement…</p>';
    const list = await fetchBoard(selected);
    if (tab === 'board') body.innerHTML = `<p class="hint">Classement mondial · ${esc(tableById(selected).name)}</p>${boardHTML(list)}`;
  }
}
$('#tabBody').addEventListener('click', e => {
  const b = e.target.closest('[data-skin]');
  if (!b || b.disabled) return;
  profile.skin = b.dataset.skin;
  save();
  renderTab();
});

/* ---------- Classement mondial ---------- */
const pseudo = () => { try { return localStorage.getItem('pseudo') || ''; } catch { return ''; } };
async function fetchBoard(table) {
  try { const r = await fetch(`/api/pinball/board?table=${encodeURIComponent(table)}`); return r.ok ? r.json() : null; } catch { return null; }
}
function boardHTML(list, me) {
  if (!list) return '<p class="hint">Classement indisponible pour le moment.</p>';
  if (!list.length) return '<p class="hint">Personne pour l’instant : à toi de jouer !</p>';
  return `<ol class="board">${list.map(e => `<li class="${e.name === me ? 'me' : ''}"><b>${esc(e.name)}</b><span>${fmt(e.score)}</span></li>`).join('')}</ol>`;
}

/* ---------- Son ---------- */
function soundHTML() {
  return `<label>Effets <input type="range" min="0" max="1" step="0.05" data-vol="sfx" value="${volume.sfx}"></label>
    <label>Musique <input type="range" min="0" max="1" step="0.05" data-vol="music" value="${volume.music}"></label>`;
}
document.addEventListener('input', e => {
  const k = e.target.dataset?.vol;
  if (!k) return;
  volume[k] = +e.target.value;
  profile.sound = { ...volume };
  save();
  setVolume();
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-open="settings"]')) { $('#menuSound').innerHTML = soundHTML(); $('#settingsDlg').showModal(); }
});

/* ---------- Partie ---------- */
let g = null, view = null, viewTable = null, paused = false, last = 0, charge = 0, chargeFrom = 0, ended = false;
const held = { L: new Set(), R: new Set() }; // sources qui tiennent chaque flipper (clavier, doigts)

function startGame(id) {
  const table = tableById(id);
  startAudio();
  show('game');
  if (viewTable !== id) { view = createView($('#view'), table); viewTable = id; }
  view.resize();
  view.setSkin(skinOpen(profile.skin) ? profile.skin : 'chrome');
  g = createGame(table);
  paused = ended = false;
  $('#pause').hidden = $('#end').hidden = true;
  $('#hBest').textContent = fmt(profile.best[id] || 0);
  music(true);
  last = performance.now();
}

function flip(side, source, down) {
  if (!g || paused) return;
  const set = held[side];
  down ? set.add(source) : set.delete(source);
  setFlipper(g, side, set.size > 0);
}
function chargeStart() {
  if (!g || paused || !ballReady(g) || chargeFrom) return;
  chargeFrom = performance.now();
}
function chargeEnd() {
  if (!chargeFrom || !g) return;
  const p = charge < 0.12 ? 0.9 : charge; // un simple clic lance avec une bonne puissance
  chargeFrom = 0;
  charge = 0;
  plunge(g, p);
}
function nudge() { if (g && !paused) shake(g); }

function setPaused(on) {
  if (!g || ended) return;
  paused = on;
  $('#pause').hidden = !on;
  $('#pauseSound').innerHTML = soundHTML();
  music(!on);
  rolling(0);
  for (const side of ['L', 'R']) { held[side].clear(); setFlipper(g, side, false); }
  last = performance.now();
}

// Clavier
const FLIP_KEYS = { ArrowLeft: 'L', KeyA: 'L', ShiftLeft: 'L', ArrowRight: 'R', KeyD: 'R', ShiftRight: 'R' };
addEventListener('keydown', e => {
  if ($('#game').hidden) return;
  if (FLIP_KEYS[e.code]) { e.preventDefault(); if (!e.repeat) flip(FLIP_KEYS[e.code], e.code, true); return; }
  if (['ArrowDown', 'Enter', 'KeyS'].includes(e.code)) { e.preventDefault(); if (!e.repeat) chargeStart(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) nudge(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
});
addEventListener('keyup', e => {
  if (FLIP_KEYS[e.code]) flip(FLIP_KEYS[e.code], e.code, false);
  if (['ArrowDown', 'Enter', 'KeyS'].includes(e.code)) chargeEnd();
});
// Souris : clic (maintenu) pour lancer
$('#view').addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') chargeStart(); });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') chargeEnd(); });
// Tactile : moitiés d'écran pour les flippers, boutons Lancer et Secouer
for (const z of $$('[data-flip]')) {
  z.addEventListener('pointerdown', e => { e.preventDefault(); z.setPointerCapture(e.pointerId); flip(z.dataset.flip, `t${e.pointerId}`, true); startAudio(); });
  for (const ev of ['pointerup', 'pointercancel']) z.addEventListener(ev, e => flip(z.dataset.flip, `t${e.pointerId}`, false));
}
$('#tLaunch').addEventListener('pointerdown', e => { e.preventDefault(); chargeStart(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#tLaunch').addEventListener(ev, chargeEnd);
$('#tNudge').addEventListener('pointerdown', e => { e.preventDefault(); nudge(); });
$('#pauseBtn').onclick = () => setPaused(true);
addEventListener('blur', () => { if (g && !paused && !ended) setPaused(true); });
document.addEventListener('contextmenu', e => { if (!$('#game').hidden) e.preventDefault(); });
$('#pause').addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a === 'resume') setPaused(false);
  if (a === 'restart') startGame(viewTable);
  if (a === 'menu') { music(false); g = null; $('#pause').hidden = true; renderMenu(); }
});

/* ---------- Interface pendant la partie ---------- */
let lastMissions = '', lastMsg = null;
function progress(id) {
  if (id === 'arc') return ['A', 'R', 'C'].map((l, i) => (i < g.arc.step ? `<b>${l}</b>` : l)).join(' ');
  if (id === 'ramps') return `${+g.rampsDone.left + +g.rampsDone.right}/2`;
  if (id === 'drops') return `${Object.values(g.drops).filter(Boolean).length}/3`;
  if (id === 'combo') return `meilleur ×${g.bestCombo}`;
  if (id === 'multiball') return g.multiball ? 'en cours !' : `${g.locks}/2 ${g.doorOpen ? '· trou ouvert' : ''}`;
  if (id === 'million') return `${Math.min(100, Math.floor(g.score / 10000))} %`;
  if (id === 'super') return g.multiball ? `${Math.min(3, g.jackpotRamps)}/3 rampes` : 'en multiball';
  return '';
}
function hud() {
  $('#hScore').textContent = fmt(g.score);
  $('#hBalls').textContent = `${g.balls - g.ball + 1}`;
  $('#hMult').textContent = g.mult;
  $('#hCombo').hidden = g.combo < 2;
  $('#hCombo b').textContent = `×${g.combo}`;
  const html = g.table.missions.map(m => `<li class="${g.missions[m.id] ? 'done' : ''}${m.final ? ' boss' : ''}"><span>${g.missions[m.id] ? '✔' : '○'}</span><b>${esc(m.name)}</b><small>${progress(m.id)}</small></li>`).join('');
  if (html !== lastMissions) { $('#missions').innerHTML = `<h3>Missions</h3><ul>${html}</ul>`; lastMissions = html; }
  const msg = g.messages.at(-1);
  if (msg && msg !== lastMsg) {
    lastMsg = msg;
    const c = $('#callout');
    c.className = `callout ${msg.kind}`;
    c.textContent = msg.text;
    void c.offsetWidth;
    c.classList.add('show');
    if (msg.kind === 'tilt') play({ kind: 'tilt' });
  }
  const ready = ballReady(g);
  $('#launchHint').hidden = !ready || TOUCH || chargeFrom > 0;
  $('#power').hidden = !chargeFrom;
  $('#power i').style.height = `${charge * 100}%`;
  $('#tLaunch').classList.toggle('ready', ready);
  $('#tiltMeter i').style.width = `${Math.min(100, (g.tilt / 3.2) * 100)}%`;
  $('#tiltMeter').classList.toggle('hot', g.tilt > 2 || g.tilted);
}

/* ---------- Boucle ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  if (!g || $('#game').hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (paused || ended) return;
  if (chargeFrom) charge = Math.min(1, (now - chargeFrom) / 1100);
  update(g, dt);
  for (const e of g.fx) { play(e); view.fx(e); }
  g.fx.length = 0;
  rolling(Math.max(0, ...g.w.balls.filter(b => !b.held).map(b => Math.hypot(b.vx, b.vy))));
  g.lightsState = lights(g);
  view.update(g, dt, charge);
  hud();
  if (g.over) endGame();
}
requestAnimationFrame(frame);

/* ---------- Fin de partie ---------- */
async function endGame() {
  ended = true;
  music(false);
  rolling(0);
  play({ kind: 'gameover' });
  const id = viewTable, seconds = Math.round((g.endedAt - g.startedAt) / 1000);
  const record = g.score > (profile.best[id] || 0);
  if (record) profile.best[id] = g.score;
  Object.assign(profile, {
    games: profile.games + 1, total: profile.total + g.score, bestCombo: Math.max(profile.bestCombo, g.bestCombo), seconds: profile.seconds + seconds,
    bumpers: profile.bumpers + g.stats.bumpers, ramps: profile.ramps + g.stats.ramps,
    missions: profile.missions + Object.values(g.missions).filter(Boolean).length, jackpots: profile.jackpots + g.jackpots,
  });
  const fresh = TROPHIES.filter(t => !profile.trophies[t.id] && t.test(g, profile));
  for (const t of fresh) profile.trophies[t.id] = Date.now();
  save();
  const unlockedSkins = Object.entries(SKIN_UNLOCK).filter(([, tr]) => fresh.some(t => t.id === tr)).map(([s]) => SKINS[s].name);
  $('#end').hidden = false;
  $('#endBody').innerHTML = `<p class="kicker">${esc(g.table.name)} · fin de partie</p>
    <div class="final">${fmt(g.score)}<small>points</small></div>
    ${record ? '<p class="record-new">🏆 Nouveau record personnel !</p>' : `<p class="hint">Record personnel : ${fmt(profile.best[id])}</p>`}
    <dl class="stats"><div><dt>Meilleur combo</dt><dd>×${g.bestCombo}</dd></div><div><dt>Durée</dt><dd>${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s</dd></div>
      <div><dt>Rampes</dt><dd>${g.stats.ramps}</dd></div><div><dt>Bumpers</dt><dd>${g.stats.bumpers}</dd></div></dl>
    <h3>Missions</h3><ul class="mdone">${g.table.missions.map(m => `<li class="${g.missions[m.id] ? 'done' : ''}">${g.missions[m.id] ? '✔' : '✗'} ${esc(m.name)}</li>`).join('')}</ul>
    ${fresh.length ? `<h3>Nouveaux succès</h3><ul class="mdone">${fresh.map(t => `<li class="done">🏅 ${esc(t.name)}</li>`).join('')}</ul>` : ''}
    ${unlockedSkins.length ? `<p class="record-new">Nouvelle bille débloquée : ${unlockedSkins.map(esc).join(', ')}</p>` : ''}
    <h3>Classement mondial</h3>
    <form id="boardForm" class="row"><input id="boardName" maxlength="20" placeholder="Ton pseudo" required value="${esc(pseudo())}"><button class="primary">Envoyer mon score</button></form>
    <p class="hint" id="boardMsg"></p><div id="endBoard"></div>
    <div class="row"><button class="primary" data-end="again">↻ Rejouer</button><button class="ghost" data-end="menu">Changer de table</button></div>`;
  $('#endBoard').innerHTML = boardHTML(await fetchBoard(id));
}
$('#end').addEventListener('click', e => {
  const a = e.target.closest('[data-end]')?.dataset.end;
  if (a === 'again') startGame(viewTable);
  if (a === 'menu') { g = null; $('#end').hidden = true; renderMenu(); }
});
$('#end').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#boardName').value.trim();
  if (!name) return;
  try { localStorage.setItem('pseudo', name); } catch { /* stockage bloqué */ }
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const r = await fetch('/api/pinball/board', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: viewTable, name, score: g.score, seconds: Math.round((g.endedAt - g.startedAt) / 1000) }),
    });
    const res = await r.json();
    if (!r.ok) throw new Error(res.error);
    $('#endBoard').innerHTML = boardHTML(res.board, name);
    $('#boardMsg').textContent = res.place ? `Tu es ${res.place === 1 ? '1er' : `${res.place}e`} du classement !` : 'Pas assez pour entrer dans le top 10, retente ta chance !';
    e.target.hidden = true;
  } catch (err) {
    $('#boardMsg').textContent = err.message || 'Envoi impossible, réessaie.';
    btn.disabled = false;
  }
});

if (LOW) document.body.classList.add('low');
renderMenu();
