// Démineur Rogue : écrans, grille, commandes (souris, doigt), pouvoirs, récompenses, boutique, boss, progression.
import { newRun, nextLevel, open, chord, toggleFlag, armPower, powerCount, pickUpgrade, skipUpgrade, reroll, rerollCost, buy, leaveShop,
  UPGRADES, POWERS, RARITY, EVENTS, UNLOCKS } from './run.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const UP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

/* ---------- Progression permanente (navigateur) ---------- */
const KEY = 'mines-meta';
const blank = () => ({ bestLevel: 0, bestCoins: 0, runs: 0, cleared: 0, mines: 0, bosses: 0, coins: 0, seconds: 0, perfect: 0, trophies: {}, unlocked: [], theme: 'moderne', mute: false });
let meta = blank();
try { meta = { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { /* profil illisible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* navigation privée */ } };

const THEMES = {
  moderne: { name: 'Moderne', need: 0 }, classique: { name: 'Classique 95', need: 0 },
  neon: { name: 'Néon', need: 5 }, ocean: { name: 'Abysses', need: 10 }, lave: { name: 'Lave', need: 15 },
};
const TROPHIES = [
  { id: 'first', name: 'Premier pas', desc: 'Termine une grille.', test: r => r.cleared >= 1 },
  { id: 'boss1', name: 'Tombeur de boss', desc: 'Bats ton premier boss.', test: r => r.bosses >= 1 },
  { id: 'lvl10', name: 'Démineur confirmé', desc: 'Atteins le niveau 10.', test: r => r.level >= 10 },
  { id: 'lvl15', name: 'Expert du terrain', desc: 'Atteins le niveau 15.', test: r => r.level >= 15 },
  { id: 'lvl20', name: 'Légende des mines', desc: 'Atteins le niveau 20.', test: r => r.level >= 20 },
  { id: 'streak5', name: 'Main sûre', desc: '5 grilles sans erreur d’affilée.', test: r => r.bestStreak >= 5 },
  { id: 'rich', name: 'Coffre plein', desc: 'Gagne 400 pièces en une partie.', test: r => r.earned >= 400 },
  { id: 'build', name: 'Collectionneur', desc: '8 améliorations dans une partie.', test: r => Object.values(r.upgrades).reduce((a, b) => a + b, 0) >= 8 },
  { id: 'legend', name: 'Objet légendaire', desc: 'Obtiens une amélioration légendaire.', test: r => Object.keys(r.upgrades).some(id => UP[id].rarity === 'legendary') },
  { id: 'pure', name: 'À mains nues', desc: 'Atteins le niveau 6 sans aucun pouvoir.', test: r => r.level >= 6 && !r.powerUsed },
];

/* ---------- Sons (synthétisés) ---------- */
let ac;
document.addEventListener('pointerdown', () => { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); });
function tone(f, d, { type = 'sine', vol = 0.12, slide, delay = 0 } = {}) {
  if (!ac || meta.mute) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, vol = 0.3, freq = 800) {
  if (!ac || meta.mute) return;
  const n = Math.ceil(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), x = buf.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(ac.destination); s.start();
}
const sfx = {
  click: () => tone(520, 0.05, { type: 'triangle', vol: 0.08 }),
  open: n => { for (let k = 0; k < Math.min(6, Math.ceil(n / 6)); k++) tone(600 + k * 90, 0.06, { type: 'triangle', vol: 0.05, delay: k * 0.03 }); },
  flag: () => { tone(880, 0.05, { type: 'square', vol: 0.04 }); tone(1320, 0.07, { type: 'square', vol: 0.03, delay: 0.04 }); },
  boom: () => { noise(0.8, 0.5, 600); tone(90, 0.6, { vol: 0.3, slide: 30 }); },
  shield: () => { tone(300, 0.3, { type: 'sawtooth', vol: 0.06, slide: 900 }); },
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.15, { type: 'square', vol: 0.05, delay: 0.07 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.08, delay: i * 0.08 })),
  boss: () => { tone(110, 1.2, { type: 'sawtooth', vol: 0.08, slide: 55 }); noise(1.2, 0.15, 200); },
  power: () => tone(400, 0.3, { type: 'sine', vol: 0.1, slide: 1600 }),
  pick: r => [660, 880, 1100, 1320].slice(0, ({ common: 1, rare: 2, epic: 3, legendary: 4 })[r] + 1).forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.08, delay: i * 0.07 })),
  over: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.05, delay: i * 0.18 })),
};

/* ---------- Écrans ---------- */
function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; }
let toastTimer;
function toast(text, kind = '') {
  const t = $('#toast');
  t.textContent = text; t.className = kind; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}
const applyTheme = () => { document.body.dataset.theme = meta.theme; $('#soundBtn').textContent = meta.mute ? '🔇 Son coupé' : '🔊 Son'; };
$('#soundBtn').onclick = () => { meta.mute = !meta.mute; save(); applyTheme(); };

/* ---------- Accueil ---------- */
let tab = 'board';
function renderHome() {
  show('home');
  $('#overlay').hidden = true;
  $('#records').innerHTML = `<div><b>${meta.bestLevel}</b><small>Meilleur niveau</small></div><div><b>${fmt(meta.bestCoins)}</b><small>Record de pièces</small></div><div><b>${meta.runs}</b><small>Parties</small></div>`;
  renderTab();
}
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
    body.innerHTML = `<ul class="trophies">${TROPHIES.map(t => `<li class="${meta.trophies[t.id] ? 'got' : ''}"><span>${meta.trophies[t.id] ? '🏅' : '🔒'}</span><div><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></div></li>`).join('')}</ul>
      <h3>Améliorations à débloquer</h3><ul class="trophies">${UPGRADES.filter(u => u.unlock).map(u => `<li class="${meta.unlocked.includes(u.unlock) ? 'got' : ''}"><span>${u.icon}</span><div><b>${esc(u.name)}</b><small>${meta.unlocked.includes(u.unlock) ? 'Débloquée' : `🔒 ${esc(UNLOCKS[u.unlock])}`}</small></div></li>`).join('')}</ul>`;
  } else if (tab === 'themes') {
    body.innerHTML = `<div class="themes">${Object.entries(THEMES).map(([id, t]) => {
      const ok = meta.bestLevel >= t.need;
      return `<button class="theme-card${meta.theme === id ? ' on' : ''}" data-theme-pick="${id}" ${ok ? '' : 'disabled'} data-preview="${id}"><span class="sw"><i></i><i></i><i></i></span><b>${t.name}</b><small>${ok ? (meta.theme === id ? 'Choisi' : 'Choisir') : `🔒 Niveau ${t.need}`}</small></button>`;
    }).join('')}</div>`;
  } else if (tab === 'stats') {
    body.innerHTML = `<dl class="statlist">${[['Parties', meta.runs], ['Grilles terminées', fmt(meta.cleared)], ['Mines évitées', fmt(meta.mines)], ['Boss battus', meta.bosses], ['Pièces gagnées', fmt(meta.coins)], ['Grilles parfaites', meta.perfect], ['Temps de jeu', `${Math.floor(meta.seconds / 60)} min`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  } else {
    body.innerHTML = '<p class="hint">Chargement…</p>';
    const list = await fetchBoard();
    if (tab === 'board') body.innerHTML = `<p class="hint">Classement mondial · niveau atteint</p>${boardHTML(list)}`;
  }
}
$('#tabBody').addEventListener('click', e => {
  const b = e.target.closest('[data-theme-pick]');
  if (!b || b.disabled) return;
  meta.theme = b.dataset.themePick; save(); applyTheme(); renderTab();
});
async function fetchBoard() { try { const r = await fetch('/api/mines/board'); return r.ok ? r.json() : null; } catch { return null; } }
function boardHTML(list, me) {
  if (!list) return '<p class="hint">Classement indisponible pour le moment.</p>';
  if (!list.length) return '<p class="hint">Personne pour l’instant : à toi de jouer !</p>';
  return `<ol class="board-list">${list.map(e => `<li class="${e.name === me ? 'me' : ''}"><b>${esc(e.name)}</b><span>Niv. ${e.level}</span><small>${fmt(e.coins)} 🪙</small></li>`).join('')}</ol>`;
}

/* ---------- Partie ---------- */
let run = null, cells = [], dispW = 0, transposed = false, flagMode = false, timer = null;
$('#newRun').onclick = startRun;
function startRun() {
  run = newRun(Math.random, { unlocked: meta.unlocked });
  run.bestStreak = 0;
  nextLevel(run);
  show('game');
  levelIntro();
  clearInterval(timer);
  timer = setInterval(tick, 500);
}

// Présentation du niveau : boss (grand écran) ou événement (bandeau)
function levelIntro() {
  const spec = run.lv.spec;
  buildBoard();
  renderAll();
  if (spec.boss) {
    sfx.boss();
    modal(`<div class="boss-intro"><p class="kicker">Niveau ${spec.n} · Boss</p><div class="boss-icon">${spec.boss.icon}</div><h2>${esc(spec.boss.name)}</h2><p>${esc(spec.boss.desc)}</p>
      <p class="hint">${spec.w} × ${spec.h} · ${spec.mines} mines · récompense ×3 et une vie</p><button class="primary big" data-close>Affronter</button></div>`, 'boss');
  } else if (spec.event) toast(`${EVENTS[spec.event].icon} ${EVENTS[spec.event].name}`, 'event');
}

// La grille garde ses proportions ; sur un écran en hauteur, une grille large est affichée tournée.
function buildBoard() {
  const b = run.lv.b, wrap = $('#boardWrap');
  transposed = innerHeight > innerWidth && b.w > b.h;
  dispW = transposed ? b.h : b.w;
  const dispH = transposed ? b.w : b.h;
  const availW = wrap.clientWidth - 8, availH = Math.max(200, innerHeight - (TOUCH ? 230 : 210));
  const size = Math.max(18, Math.min(44, Math.floor(Math.min(availW / dispW, availH / dispH))));
  const el = $('#board');
  el.style.setProperty('--cols', dispW);
  el.style.setProperty('--size', `${size}px`);
  el.className = 'board';
  el.innerHTML = '';
  cells = [];
  for (let k = 0; k < b.n; k++) {
    const dx = k % dispW, dy = Math.floor(k / dispW);
    const i = transposed ? dx * b.w + dy : dy * b.w + dx;
    const c = document.createElement('button');
    c.className = 'c';
    c.dataset.i = i;
    if (run.lv.safe.includes(i)) c.classList.add('safezone');
    el.append(c);
    cells[i] = c;
  }
}

function cellClass(i, now) {
  const lv = run.lv, b = lv.b;
  const c = ['c'];
  if (lv.safe.includes(i)) c.push('safezone');
  if (b.open[i]) {
    if (b.mine[i]) c.push('open', 'mine', b.exploded.includes(i) ? 'boom' : '');
    else {
      c.push('open');
      if (b.silent[i]) c.push('silent');
      else if (lv.fogged[i] > now) c.push('fog');
      else if (b.count[i]) c.push(`n${b.count[i]}`);
    }
  } else {
    if (b.flag[i]) c.push('flag');
    if (lv.detected[i]) c.push(`det-${lv.detected[i]}`);
    if (run.phase === 'over' && b.mine[i]) c.push('mine', 'shown');
  }
  return c.join(' ');
}
function renderCells() {
  const b = run.lv.b, now = Date.now();
  for (let i = 0; i < b.n; i++) {
    const cls = cellClass(i, now), el = cells[i];
    if (el._cls === cls) continue;
    el._cls = cls;
    el.className = cls + (el.classList.contains('pop') ? ' pop' : '');
    el.textContent = b.open[i] && !b.mine[i] && !b.silent[i] && b.count[i] && !(run.lv.fogged[i] > now) ? b.count[i] : b.open[i] && b.silent[i] ? '·' : '';
  }
  // Résultats du scanner et du radar : badge sur la case visée et cadre de la zone
  $('#board').querySelectorAll('.badge').forEach(x => x.remove());
  for (const m of run.lv.markers) {
    const s = document.createElement('span');
    s.className = 'badge';
    s.textContent = m.value;
    s.title = `${m.value} mine${m.value > 1 ? 's' : ''} dans ce carré ${m.r * 2 + 1} × ${m.r * 2 + 1}`;
    cells[m.i].append(s);
  }
}
function renderHud() {
  const lv = run.lv, spec = lv.spec, b = lv.b;
  $('#hLevel').innerHTML = `<b>Niveau ${spec.n}</b>${spec.boss ? `<span class="tag boss">${spec.boss.icon} ${esc(spec.boss.name)}</span>` : ''}${spec.event ? `<span class="tag">${EVENTS[spec.event].icon} ${esc(EVENTS[spec.event].name)}</span>` : ''}`;
  $('#hLives').innerHTML = run.lives > 6 ? `❤️ <b>×${run.lives}</b>` : '❤️'.repeat(run.lives) || '🖤';
  $('#hCoins').textContent = fmt(run.coins);
  const flags = b.flag.reduce((a, c) => a + c, 0);
  $('#hMines').textContent = b.generated ? b.mines - flags - b.exploded.length : spec.mines;
  const ev = spec.event ? EVENTS[spec.event] : spec.boss;
  $('#event').hidden = !ev;
  if (ev) $('#event').innerHTML = `${ev.icon} <b>${esc(ev.name)}</b> — ${esc(ev.desc)}`;
  // Pouvoirs : charges de la grille + objets achetés
  $('#powers').innerHTML = Object.entries(POWERS).map(([id, p]) => {
    const n = powerCount(run, id);
    if (!n) return '';
    return `<button class="power${lv.armed === id ? ' armed' : ''}" data-power="${id}" title="${esc(p.name)} : ${esc(p.desc)}"><span>${p.icon}</span><b>${n}</b><small>${esc(p.name)}</small></button>`;
  }).join('') || '<span class="hint">Aucun pouvoir : gagne-en avec les améliorations ou à la boutique.</span>';
  $('#owned').innerHTML = Object.entries(run.upgrades).map(([id, n]) => `<span class="own r-${UP[id].rarity}" title="${esc(UP[id].name)} : ${esc(UP[id].desc)}">${UP[id].icon}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('') + (lv.shield ? `<span class="own shield" title="Bouclier actif">🛡️<b>${lv.shield}</b></span>` : '');
  $('#board').classList.toggle('arming', !!lv.armed);
}
const renderAll = () => { renderCells(); renderHud(); };

function tick() {
  if (!run || run.phase !== 'play') return;
  const lv = run.lv, t = lv.startedAt ? (Date.now() - lv.startedAt) / 1000 : 0;
  $('#hTime').textContent = lv.spec.time ? `${clock(Math.max(0, lv.spec.time - t))}` : clock(t);
  $('#hTime').parentElement.classList.toggle('urgent', !!lv.spec.time && t > lv.spec.time - 15 && t <= lv.spec.time);
  if (Object.keys(lv.fogged).length) renderCells();
}

/* ---------- Commandes ---------- */
function act(i, how) {
  if (!run || run.phase !== 'play') return;
  const b = run.lv.b;
  let res;
  if (how === 'flag') { if (b.open[i]) res = chord(run, i); else { res = toggleFlag(run, i); if (res) sfx.flag(); } }
  else res = b.open[i] ? chord(run, i) : open(run, i);
  if (!res) return;
  handle(res, i);
}
function handle(res, i) {
  if (res.power) power(res);
  if (res.opened?.length) {
    sfx.open(res.opened.length);
    renderCells();
    for (const o of res.opened) { const el = cells[o.i]; el.style.setProperty('--d', `${Math.min(o.d, 25) * 22}ms`); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  if (res.spared) toast('Coup forcé : la mine a été déplacée, aucune pénalité', 'info');
  if (res.boom) boom(res.boom);
  if (res.needFlags) toast('Le Démineur fou exige un drapeau sur chaque mine !', 'warn');
  renderAll();
  if (res.won) setTimeout(() => levelWon(res.reward), 450);
  if (run.phase === 'over') setTimeout(gameOver, 1300);
}
function power(res) {
  sfx.power();
  const p = POWERS[res.power];
  if (res.power === 'detect') toast(res.value === 'mine' ? '🔍 Danger : il y a une mine ici' : '🔍 Case sûre', res.value === 'mine' ? 'warn' : 'ok');
  else if (res.power === 'scan' || res.power === 'radar') toast(`${p.icon} ${res.value} mine${res.value > 1 ? 's' : ''} dans la zone`, 'info');
  else if (res.power === 'defuse') toast('🧯 Case sécurisée', 'ok');
  else if (res.power === 'shield') toast('🛡️ Protection activée', 'ok');
  else if (res.power === 'reveal') toast('✨ Une case sûre s’ouvre', 'ok');
  if (res.cells) for (const j of res.cells) { cells[j].classList.remove('scan'); void cells[j].offsetWidth; cells[j].classList.add('scan'); }
}
// Explosion : la case saute, des éclats volent, l'écran tremble et rougit
function boom(e) {
  const el = cells[e.i], fx = $('#fx'), r = el.getBoundingClientRect(), base = fx.getBoundingClientRect();
  if (e.kind === 'sixth') { sfx.shield(); toast('🔮 Sixième sens : c’était une mine ! Drapeau posé.', 'ok'); return; }
  if (e.kind === 'shield') { sfx.shield(); toast('🛡️ Le bouclier a absorbé l’explosion !', 'ok'); }
  else {
    sfx.boom();
    navigator.vibrate?.([80, 40, 140]);
    $('#flash').classList.remove('on'); void $('#flash').offsetWidth; $('#flash').classList.add('on');
    if (e.kind === 'second') toast('🪽 Seconde chance ! Il te reste 1 vie', 'ok');
    else if (e.kind !== 'dead') toast(`💥 −${e.cost} vie${e.cost > 1 ? 's' : ''}${e.closed?.length ? ' · des cases se referment' : ''}`, 'warn');
  }
  const wrap = $('#boardWrap');
  wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
  for (let k = 0; k < 18; k++) {
    const s = document.createElement('i');
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    s.style.cssText = `left:${r.left - base.left + r.width / 2}px;top:${r.top - base.top + r.height / 2}px;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`;
    s.className = e.kind === 'shield' ? 'spark blue' : 'spark';
    fx.append(s);
    setTimeout(() => s.remove(), 700);
  }
}

// Souris : gauche ouvre (ou accord sur un chiffre), droit pose un drapeau, milieu fait un accord.
const board = $('#board');
board.addEventListener('contextmenu', e => e.preventDefault());
board.addEventListener('mousedown', e => {
  const c = e.target.closest('.c');
  if (!c || TOUCH) return;
  const i = +c.dataset.i;
  if (e.button === 2) act(i, 'flag');
  else if (e.button === 1) { e.preventDefault(); act(i, 'chord'); }
  else if (e.button === 0) act(i, flagMode ? 'flag' : 'open');
});
// Doigt : toucher ouvre, appui long pose un drapeau
let press = null;
board.addEventListener('touchstart', e => {
  const c = e.target.closest('.c');
  if (!c) return;
  const i = +c.dataset.i;
  press = { i, done: false, t: setTimeout(() => { press.done = true; navigator.vibrate?.(25); act(i, 'flag'); }, 380) };
}, { passive: true });
board.addEventListener('touchmove', () => { if (press) clearTimeout(press.t); press = null; }, { passive: true });
board.addEventListener('touchend', e => {
  if (!press) return;
  clearTimeout(press.t);
  e.preventDefault();
  if (!press.done) act(press.i, flagMode ? 'flag' : 'open');
  press = null;
});
$('#flagMode').onclick = () => { flagMode = !flagMode; $('#flagMode').setAttribute('aria-pressed', flagMode); toast(flagMode ? '🚩 Mode drapeau : un toucher pose un drapeau' : 'Mode normal'); };
$('#powers').onclick = e => {
  const b = e.target.closest('[data-power]');
  if (!b || !run) return;
  const id = b.dataset.power;
  if (POWERS[id].target && !run.lv.b.generated) return toast('Ouvre d’abord une première case', 'info');
  const res = armPower(run, id);
  if (res && typeof res === 'object') handle(res);
  else if (res) toast(run.lv.armed ? `${POWERS[id].icon} ${POWERS[id].name} : choisis une case` : 'Pouvoir rangé', 'info');
  else if (id === 'reveal') toast('Ouvre d’abord une première case', 'info');
  run.powerUsed = run.powerUsed || run.lv.usedPower;
  renderHud();
};
addEventListener('resize', () => { if (run && run.phase === 'play') { buildBoard(); renderAll(); } });
$('#pauseBtn').onclick = () => modal(`<h2>Pause</h2><button class="primary big" data-close>Reprendre</button><button class="ghost" data-abandon>Abandonner la partie</button><button class="ghost" data-home>Menu du démineur</button><a class="ghost btn" href="../">Retour au Cercle</a>`);

/* ---------- Fenêtres : récompense, améliorations, boutique, fin ---------- */
function modal(html, kind = '') {
  $('#modal').className = `modal ${kind}`;
  $('#modal').innerHTML = html;
  $('#overlay').hidden = false;
}
const closeModal = () => { $('#overlay').hidden = true; };
$('#overlay').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-close]')) closeModal();
  if (t.closest('[data-home]')) { clearInterval(timer); run = null; renderHome(); }
  if (t.closest('[data-abandon]')) { run.phase = 'over'; run.endedAt = Date.now(); gameOver(); }
  if (t.closest('[data-again]')) startRun();
  const card = t.closest('[data-pick]');
  if (card) {
    const u = pickUpgrade(run, card.dataset.pick);
    sfx.pick(u.rarity);
    if (u.id === 'heart') renderHud();
    afterPick();
  }
  if (t.closest('[data-skip]')) { skipUpgrade(run); afterPick(); }
  if (t.closest('[data-reroll]') && reroll(run)) { sfx.coin(); rewardScreen(lastReward, true); }
  const it = t.closest('[data-buy]');
  if (it && !it.disabled) { if (buy(run, it.dataset.buy)) { sfx.coin(); shopScreen(); } }
  if (t.closest('[data-leave]')) { leaveShop(run); closeModal(); levelIntro(); }
});
function afterPick() {
  if (run.phase === 'reward') return rewardScreen(lastReward, true);
  if (run.phase === 'shop') return shopScreen();
  closeModal();
  levelIntro();
}

let lastReward = null;
function levelWon(reward) {
  lastReward = reward;
  run.bestStreak = Math.max(run.bestStreak, run.streak);
  if (reward.perfect) meta.perfect++;
  sfx.win();
  setTimeout(sfx.coin, 400);
  rewardScreen(reward);
}
function card(id) {
  const u = UP[id], n = run.upgrades[id] || 0;
  return `<button class="card r-${u.rarity}" data-pick="${id}"><span class="rar">${RARITY[u.rarity].name}</span><span class="ic">${u.icon}</span><b>${esc(u.name)}</b><p>${esc(u.desc)}</p>${n ? `<small>Déjà ×${n}</small>` : ''}</button>`;
}
function rewardScreen(r, again) {
  const boss = r.boss;
  modal(`${boss ? `<div class="victory">🏆</div><p class="kicker">Boss vaincu</p><h2>${esc(boss.name)} est tombé !</h2>` : `<p class="kicker">Niveau ${run.level} terminé</p><h2>${r.perfect ? 'Sans faute !' : 'Grille déminée'}</h2>`}
    ${again ? '' : `<ul class="gains">${r.lines.map(([l, n], k) => `<li style="--d:${k * 120}ms"><span>${esc(l)}</span><b>+${fmt(n)} 🪙</b></li>`).join('')}${r.bonusLife ? `<li style="--d:${r.lines.length * 120}ms"><span>Bonus</span><b>+${r.bonusLife} ❤️</b></li>` : ''}</ul>`}
    <p class="total">🪙 ${fmt(run.coins)} <small>· ❤️ ${run.lives}</small></p>
    <h3>${run.picksLeft > 1 ? 'Choisis 2 améliorations' : 'Choisis une amélioration'}</h3>
    <div class="cards">${run.choices.map(card).join('')}</div>
    <div class="row"><button class="ghost" data-reroll ${run.coins < rerollCost(run) ? 'disabled' : ''}>🎲 Relancer (${rerollCost(run)} 🪙)</button><button class="ghost" data-skip>Passer</button></div>`, boss ? 'reward bossbeat' : 'reward');
}
function shopScreen() {
  const special = run.shop.some(x => x.special);
  modal(`<p class="kicker">${special ? '🧙 Marchand mystérieux' : 'Boutique'}</p><h2>${special ? 'Un objet rare, à prix spécial…' : 'Prépare la suite'}</h2>
    <p class="total">🪙 ${fmt(run.coins)} <small>· ❤️ ${run.lives}</small></p>
    <div class="shop">${run.shop.map(it => `<button class="item${it.special ? ' special' : ''}${it.rarity ? ` r-${it.rarity}` : ''}" data-buy="${it.id}" ${!it.stock || run.coins < it.price ? 'disabled' : ''}>
      <span class="ic">${it.icon}</span><b>${esc(it.name)}</b><small>${esc(it.desc || '')}</small><i>${it.stock ? `${fmt(it.price)} 🪙` : 'Épuisé'}</i></button>`).join('')}</div>
    <button class="primary big" data-leave>Niveau suivant →</button>`, 'shopm');
}

/* ---------- Fin de partie ---------- */
async function gameOver() {
  if (!run || run.finished) return;
  run.finished = true;
  clearInterval(timer);
  sfx.over();
  renderCells(); // montre les mines
  const seconds = Math.round(((run.endedAt || Date.now()) - run.startedAt) / 1000);
  const level = run.level, prevBest = meta.bestLevel, best = level > prevBest;
  Object.assign(meta, {
    bestLevel: Math.max(meta.bestLevel, level), bestCoins: Math.max(meta.bestCoins, run.earned), runs: meta.runs + 1, cleared: meta.cleared + run.cleared,
    mines: meta.mines + run.minesAvoided, bosses: meta.bosses + run.bosses, coins: meta.coins + run.earned, seconds: meta.seconds + seconds,
  });
  // Déblocages permanents : de nouvelles améliorations entrent dans le tirage des parties suivantes
  const unlockedNow = [];
  for (const [k, ok] of [['runs3', meta.runs >= 3], ['boss1', meta.bosses >= 1], ['level10', meta.bestLevel >= 10]]) if (ok && !meta.unlocked.includes(k)) { meta.unlocked.push(k); unlockedNow.push(k); }
  const fresh = TROPHIES.filter(t => !meta.trophies[t.id] && t.test(run));
  for (const t of fresh) meta.trophies[t.id] = Date.now();
  const themes = Object.values(THEMES).filter(t => t.need > prevBest && t.need <= level).map(t => t.name); // seuil franchi cette partie
  save();
  const pseudo = (() => { try { return localStorage.getItem('pseudo') || ''; } catch { return ''; } })();
  setTimeout(async () => {
    modal(`<p class="kicker">Fin de la partie</p><h2>Tu es tombé au niveau ${level}</h2>
      ${best ? '<p class="record">🏆 Nouveau record personnel !</p>' : `<p class="hint">Meilleur niveau : ${meta.bestLevel}</p>`}
      <dl class="statlist">${[['Niveau atteint', level], ['Grilles terminées', run.cleared], ['Mines évitées', run.minesAvoided], ['Pièces gagnées', fmt(run.earned)], ['Boss battus', run.bosses], ['Durée', clock(seconds)]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <h3>Améliorations</h3><div class="owned big">${Object.entries(run.upgrades).map(([id, n]) => `<span class="own r-${UP[id].rarity}" title="${esc(UP[id].name)}">${UP[id].icon}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('') || '<span class="hint">Aucune</span>'}</div>
      ${fresh.length ? `<h3>Nouveaux succès</h3><div class="chips">${fresh.map(t => `<span>🏅 ${esc(t.name)}</span>`).join('')}</div>` : ''}
      ${unlockedNow.length ? `<p class="record">🔓 Nouvelle amélioration dans le tirage : ${UPGRADES.filter(u => unlockedNow.includes(u.unlock)).map(u => `${u.icon} ${esc(u.name)}`).join(', ')}</p>` : ''}
      ${themes.length ? `<p class="record">🎨 Nouveau thème : ${themes.map(esc).join(', ')}</p>` : ''}
      <button class="primary big" data-again>↻ Rejouer tout de suite</button>
      <h3>Classement mondial</h3>
      <form class="row" id="boardForm"><input id="boardName" maxlength="20" placeholder="Ton pseudo" value="${esc(pseudo)}" required><button class="ghost">Envoyer</button></form>
      <p class="hint" id="boardMsg"></p><div id="endBoard"></div>
      <button class="ghost" data-home>Menu</button>`, 'over');
    $('#endBoard').innerHTML = boardHTML(await fetchBoard());
    $('#boardForm').onsubmit = async e => {
      e.preventDefault();
      const name = $('#boardName').value.trim();
      if (!name) return;
      try { localStorage.setItem('pseudo', name); } catch { /* stockage bloqué */ }
      try {
        const r = await fetch('/api/mines/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level, coins: run.earned, seconds }) });
        const res = await r.json();
        if (!r.ok) throw new Error(res.error);
        $('#endBoard').innerHTML = boardHTML(res.board, name);
        $('#boardMsg').textContent = res.place ? `Tu es ${res.place === 1 ? '1er' : `${res.place}e`} du classement !` : 'Pas encore dans le top 10 : la prochaine sera la bonne !';
        e.target.hidden = true;
      } catch (err) { $('#boardMsg').textContent = err.message || 'Envoi impossible.'; }
    };
  }, 200);
}

applyTheme();
renderHome();
// ?debug : donne aux tests automatiques l'état de la partie (aucun effet en jeu normal)
if (new URLSearchParams(location.search).has('debug')) window.__mines = () => run;
