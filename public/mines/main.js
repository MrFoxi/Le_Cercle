// Démineur Rogue : écrans, grille, commandes (souris, doigt), pouvoirs, récompenses, boutique, boss, progression.
import { newRun, nextLevel, open, chord, toggleFlag, armPower, powerCount, pickUpgrade, skipUpgrade, reroll, rerollCost, buy, sell, sellPrice, leaveShop,
  choosePath, acceptOffer, tickClock, clockLeft, seeded, seedOf, combosOf, UPGRADES, POWERS, RARITY, EVENTS, UNLOCKS, CHARACTERS, BOSSES, COMBOS, EVOLUTIONS } from './run.js';
import { solvable } from './board.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const UP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

/* ---------- Progression permanente (navigateur) ---------- */
const KEY = 'mines-meta';
const blank = () => ({ bestLevel: 0, bestCoins: 0, runs: 0, cleared: 0, mines: 0, bosses: 0, coins: 0, seconds: 0, perfect: 0, trophies: {}, unlocked: [], theme: 'moderne', mute: false,
  music: true, learn: false, char: 'demineur', seen: { up: {}, boss: {}, event: {}, combo: {} }, history: [], upStats: {}, daily: {} });
let meta = blank();
try { meta = { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { /* profil illisible */ }
meta.seen = { up: {}, boss: {}, event: {}, combo: {}, ...meta.seen };
const today = () => new Date().toISOString().slice(0, 10);
const params = new URLSearchParams(location.search);
let challenge = params.get('seed') ? { seed: +params.get('seed') >>> 0, char: CHARACTERS[params.get('perso')] ? params.get('perso') : 'demineur', level: +params.get('niveau') || 0, from: params.get('de') || '' } : null;
const charOpen = id => !CHARACTERS[id].unlock || meta.unlocked.includes(CHARACTERS[id].unlock);
// Collection : améliorations, boss, événements et combinaisons déjà rencontrés
function collection() {
  const total = UPGRADES.length + BOSSES.length + Object.keys(EVENTS).length + COMBOS.length;
  const got = ['up', 'boss', 'event', 'combo'].reduce((n, k) => n + Object.keys(meta.seen[k]).length, 0);
  return { got, total, pct: Math.round((got / total) * 100) };
}
// Le prochain objectif le plus proche : thème, personnage, amélioration à débloquer
function nextGoal() {
  const goals = [
    ...Object.entries(THEMES).filter(([, t]) => t.need > meta.bestLevel).map(([, t]) => ({ text: `Atteins le niveau ${t.need} pour débloquer le thème ${t.name}`, left: t.need - meta.bestLevel })),
    ...Object.values(CHARACTERS).filter(c => c.unlock && !meta.unlocked.includes(c.unlock)).map(c => ({ text: `${UNLOCKS[c.unlock]} pour jouer ${c.name}`, left: c.unlock === 'level10' ? 10 - meta.bestLevel : c.unlock === 'runs3' ? 3 - meta.runs : 1 })),
    ...UPGRADES.filter(u => u.unlock && !meta.unlocked.includes(u.unlock)).map(u => ({ text: `${UNLOCKS[u.unlock]} pour débloquer ${u.name}`, left: u.unlock === 'level10' ? 10 - meta.bestLevel : u.unlock === 'runs3' ? 3 - meta.runs : 1 })),
  ].sort((a, b) => a.left - b.left);
  return goals[0]?.text;
}
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
  { id: 'combo', name: 'Alchimiste', desc: 'Découvre une combinaison cachée.', test: r => combosOf(r).length > 0 },
  { id: 'daily', name: 'Rendez-vous quotidien', desc: 'Termine une partie du jour.', test: r => !!r.daily },
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

// Musique : basse et arpège ; plus rapide et plus tendue quand il reste peu de vies ou peu de cases.
let musicTimer = null, beat = 0, nextNote = 0;
function intensity() {
  if (!run || run.phase !== 'play' || !run.lv.b.generated) return 0;
  let left = 0;
  for (let i = 0; i < run.lv.b.n; i++) left += !run.lv.b.mine[i] && !run.lv.b.open[i];
  return (run.lives <= 1 ? 1 : 0) + (left < 12 ? 1 : 0) + (run.lv.spec.boss ? 1 : 0);
}
function music(on) {
  clearInterval(musicTimer);
  if (!on || !ac || meta.mute || !meta.music) return;
  nextNote = ac.currentTime + 0.1;
  musicTimer = setInterval(() => {
    const k = intensity(), step = 0.24 - k * 0.04, root = [110, 98, 87.3, 98][Math.floor(beat / 16) % 4];
    while (nextNote < ac.currentTime + 0.3) {
      const d = nextNote - ac.currentTime, i = beat % 8;
      tone(root * (i % 4 === 0 ? 1 : 2), step * 1.2, { type: 'triangle', vol: 0.05, delay: d });
      if (i % 2 === 0) tone(root * [4, 4.8, 6, 4.8][(i / 2) % 4] * (k > 1 ? 1.06 : 1), step * 0.8, { type: 'sine', vol: 0.025 + k * 0.008, delay: d });
      if (k && i % 2 === 1) tone(6000, 0.03, { type: 'square', vol: 0.008 * k, delay: d });
      nextNote += step;
      beat++;
    }
  }, 100);
}

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
$('#soundBtn').onclick = () => { meta.mute = !meta.mute; save(); applyTheme(); if (run && run.phase === 'play') music(!meta.mute); };

/* ---------- Accueil ---------- */
let tab = 'board';
function renderHome() {
  show('home');
  $('#overlay').hidden = true;
  const col = collection();
  $('#records').innerHTML = `<div><b>${meta.bestLevel}</b><small>Meilleur niveau</small></div><div><b>${fmt(meta.bestCoins)}</b><small>Record de pièces</small></div><div><b>${col.pct} %</b><small>Collection (${col.got}/${col.total})</small></div>`;
  $('#chars').innerHTML = Object.entries(CHARACTERS).map(([id, c]) => `<button class="char${meta.char === id ? ' on' : ''}" data-char="${id}" ${charOpen(id) ? '' : 'disabled'} title="${esc(c.desc)}"><span>${c.icon}</span><b>${esc(c.name)}</b><small>${charOpen(id) ? esc(c.desc) : `🔒 ${esc(UNLOCKS[c.unlock])}`}</small></button>`).join('');
  const done = meta.daily[today()];
  $('#dailyBtn').innerHTML = done ? `📅 Partie du jour · ton meilleur : niveau ${done}` : '📅 Partie du jour';
  $('#challenge').hidden = !challenge;
  if (challenge) $('#challenge').innerHTML = `⚔️ <b>Défi reçu</b>${challenge.from ? ` de ${esc(challenge.from)}` : ''} : ${challenge.level ? `fais mieux que le niveau ${challenge.level}` : 'joue exactement la même partie'} avec ${CHARACTERS[challenge.char].icon} ${esc(CHARACTERS[challenge.char].name)}. <button class="primary small" id="takeChallenge">Relever le défi</button>`;
  $('#learn').checked = meta.learn;
  $('#musicOn').checked = meta.music;
  renderTab();
}
$('#chars').onclick = e => { const b = e.target.closest('[data-char]'); if (b && !b.disabled) { meta.char = b.dataset.char; save(); renderHome(); } };
$('#dailyBtn').onclick = () => startRun({ daily: today() });
$('#home').addEventListener('click', e => { if (e.target.id === 'takeChallenge') startRun({ seed: challenge.seed, char: challenge.char }); });
$('#learn').onchange = e => { meta.learn = e.target.checked; save(); };
$('#musicOn').onchange = e => { meta.music = e.target.checked; save(); };
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
  } else if (tab === 'history') {
    body.innerHTML = meta.history.length ? `<ul class="hist">${meta.history.map(h => `<li><b>Niv. ${h.level}</b><span>${CHARACTERS[h.char]?.icon || ''} ${h.daily ? '📅 ' : ''}${esc(h.date)}</span><span class="ups">${h.ups.map(id => UP[id]?.icon || '').join('')}</span><small>${esc(h.cause)}</small></li>`).join('')}</ul>` : '<p class="hint">Aucune partie pour l’instant.</p>';
  } else if (tab === 'stats') {
    const per = Object.entries(meta.upStats).filter(([id]) => UP[id]).map(([id, v]) => [id, v.levels / v.runs, v.runs]).sort((a, b) => b[1] - a[1]);
    body.innerHTML = `<dl class="statlist">${[['Parties', meta.runs], ['Grilles terminées', fmt(meta.cleared)], ['Mines évitées', fmt(meta.mines)], ['Boss battus', meta.bosses], ['Pièces gagnées', fmt(meta.coins)], ['Grilles parfaites', meta.perfect], ['Temps de jeu', `${Math.floor(meta.seconds / 60)} min`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${per.length ? `<h3>Niveau moyen atteint avec chaque amélioration</h3><ul class="upstats">${per.map(([id, avg, n]) => `<li><span>${UP[id].icon} ${esc(UP[id].name)}</span><b>${avg.toFixed(1)}</b><small>${n} partie${n > 1 ? 's' : ''}</small></li>`).join('')}</ul>` : ''}`;
  } else {
    body.innerHTML = '<p class="hint">Chargement…</p>';
    const [list, daily] = await Promise.all([fetchBoard(), fetchBoard(today())]);
    if (tab === 'board') body.innerHTML = `<h3>📅 Partie du jour</h3>${boardHTML(daily)}<h3>🏆 Tous les temps</h3>${boardHTML(list)}`;
  }
}
$('#tabBody').addEventListener('click', e => {
  const b = e.target.closest('[data-theme-pick]');
  if (!b || b.disabled) return;
  meta.theme = b.dataset.themePick; save(); applyTheme(); renderTab();
});
async function fetchBoard(day) { try { const r = await fetch(`/api/mines/board${day ? `?day=${day}` : ''}`); return r.ok ? r.json() : null; } catch { return null; } }
function boardHTML(list, me) {
  if (!list) return '<p class="hint">Classement indisponible pour le moment.</p>';
  if (!list.length) return '<p class="hint">Personne pour l’instant : à toi de jouer !</p>';
  return `<ol class="board-list">${list.map(e => `<li class="${e.name === me ? 'me' : ''}"><b>${esc(e.name)}</b><span>Niv. ${e.level}</span><small>${fmt(e.coins)} 🪙</small></li>`).join('')}</ol>`;
}

/* ---------- Partie ---------- */
let run = null, cells = [], dispW = 0, transposed = false, flagMode = false, timer = null;
$('#newRun').onclick = () => startRun();
// opts : { daily: 'AAAA-MM-JJ' } (même graine pour tout le monde ce jour-là) ou { seed, char } (défi d'un ami)
function startRun(opts = {}) {
  const seed = opts.daily ? seedOf(`mines-${opts.daily}`) : opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const char = opts.daily ? 'demineur' : opts.char || meta.char;
  run = newRun(seeded(seed), { unlocked: meta.unlocked }, { char, seed, daily: opts.daily || null });
  run.assisted = meta.learn;
  nextLevel(run);
  show('game');
  levelIntro();
  clearInterval(timer);
  timer = setInterval(tick, 250);
  music(true);
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
  } else if (run.offer) {
    const card = run.offer.card && UP[run.offer.card];
    modal(`<p class="kicker">🎭 L’inconnu</p><h2>« Une petite affaire ? »</h2><p class="hint">Un inconnu t’arrête avant la grille. Choisis :</p>
      <div class="cards two"><button class="card r-rare" data-offer="coins"><span class="ic">🪙</span><b>${fmt(run.offer.coins)} pièces</b><p>Tout de suite, sans risque.</p></button>
      ${card ? `<button class="card r-${card.rarity}" data-offer="card"><span class="rar">Carte mystère</span><span class="ic">❔</span><b>Une amélioration</b><p>Rare ou mieux… mais tu ne sais pas laquelle.</p></button>` : ''}</div>`, 'reward');
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
    if (b.void[i]) { c.disabled = true; c.tabIndex = -1; }
    el.append(c);
    cells[i] = c;
  }
}

function cellClass(i, now) {
  const lv = run.lv, b = lv.b;
  const c = ['c'];
  if (b.void[i]) return 'c void';
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
    if (hints.has(i)) c.push('hint');
    if (run.phase === 'over' && b.mine[i]) c.push('mine', 'shown');
  }
  return c.join(' ');
}
// Mode apprentissage : les cases que la déduction prouve sûres sont légèrement éclairées.
let hints = new Set();
function renderCells() {
  const b = run.lv.b, now = Date.now();
  hints = meta.learn && b.generated && run.phase === 'play' ? new Set(solvable(b, -1, 'step').safe) : new Set();
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
  $('#hCombo').hidden = lv.combo < 3;
  $('#hCombo').innerHTML = `⚡ <b>×${lv.combo}</b>`;
  $('#hChar').textContent = `${CHARACTERS[run.char].icon}${run.daily ? ' 📅' : ''}${run.assisted ? ' 🎓' : ''}`;
  const ev = spec.event ? EVENTS[spec.event] : spec.boss;
  $('#event').hidden = !ev;
  if (ev) $('#event').innerHTML = `${ev.icon} <b>${esc(ev.name)}</b> — ${esc(ev.desc)}`;
  // Pouvoirs : charges de la grille + objets achetés
  $('#powers').innerHTML = Object.entries(POWERS).map(([id, p]) => {
    const n = powerCount(run, id);
    if (!n) return '';
    return `<button class="power${lv.armed === id ? ' armed' : ''}" data-power="${id}" title="${esc(p.name)} : ${esc(p.desc)}"><span>${p.icon}</span><b>${n}</b><small>${esc(p.name)}</small></button>`;
  }).join('') || '<span class="hint">Aucun pouvoir : gagne-en avec les améliorations ou à la boutique.</span>';
  $('#owned').innerHTML = Object.entries(run.upgrades).map(([id, n]) => `<span class="own r-${UP[id].rarity}${EVOLUTIONS[id] && n >= EVOLUTIONS[id].at ? ' evolved' : ''}" title="${esc(EVOLUTIONS[id] && n >= EVOLUTIONS[id].at ? EVOLUTIONS[id].name : UP[id].name)} : ${esc(UP[id].desc)}">${UP[id].icon}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('')
    + combosOf(run).map(c => `<span class="own combo" title="Combinaison ${esc(c.name)} : ${esc(c.desc)}">${c.icon}</span>`).join('')
    + (lv.shield ? `<span class="own shield" title="Bouclier actif">🛡️<b>${lv.shield}</b></span>` : '');
  $('#board').classList.toggle('arming', !!lv.armed);
}
const renderAll = () => { renderCells(); renderHud(); };

function tick() {
  if (!run || run.phase !== 'play') return;
  const lv = run.lv, t = lv.startedAt ? (Date.now() - lv.startedAt) / 1000 : 0;
  $('#hTime').textContent = lv.spec.time ? `${clock(Math.max(0, lv.spec.time - t))}` : clock(t);
  $('#hTime').parentElement.classList.toggle('urgent', !!lv.spec.time && t > lv.spec.time - 15 && t <= lv.spec.time);
  if (Object.keys(lv.fogged).length) renderCells();
  // La Pendule : sablier affiché, et une vie perdue quand il se vide
  const left = clockLeft(run);
  $('#hClock').hidden = left === null;
  if (left !== null) {
    $('#hClock').innerHTML = `⏳ <b>${Math.ceil(Math.max(0, left))}</b>`;
    $('#hClock').classList.toggle('urgent', left < 6);
    const res = tickClock(run);
    if (res) { toast('⏳ Le sablier s’est vidé !', 'warn'); handle(res); }
  }
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
  for (const l of res.loot || []) {
    sfx.coin();
    floatText(l.i, l.coins ? `+${l.coins} 🪙` : `🎁 ${POWERS[l.item].icon}`);
    if (l.item) toast(`🎁 Coffre : ${POWERS[l.item].name} (usage unique)`, 'ok');
  }
  if (res.boom) boom(res.boom);
  if (res.needFlags) toast('Le Démineur fou exige un drapeau sur chaque mine !', 'warn');
  renderAll();
  if (res.won) { winWave(i); setTimeout(() => levelWon(res.reward), 900); }
  if (run.phase === 'over') { deathCam(res.boom?.i); setTimeout(gameOver, 2300); }
}
// Texte qui s'envole depuis une case (pièces, coffre)
function floatText(i, text) {
  const el = cells[i], fx = $('#fx'), r = el.getBoundingClientRect(), base = fx.getBoundingClientRect();
  const t = document.createElement('b');
  t.className = 'float';
  t.textContent = text;
  t.style.cssText = `left:${r.left - base.left + r.width / 2}px;top:${r.top - base.top}px`;
  fx.append(t);
  setTimeout(() => t.remove(), 1100);
}
// Grille terminée : une vague de lumière part de la dernière case, des confettis jaillissent.
function winWave(from) {
  const b = run.lv.b, fx0 = from ?? Math.floor(b.n / 2), x0 = fx0 % b.w, y0 = Math.floor(fx0 / b.w);
  for (let i = 0; i < b.n; i++) {
    if (b.void[i]) continue;
    const d = Math.max(Math.abs((i % b.w) - x0), Math.abs(Math.floor(i / b.w) - y0));
    cells[i].style.setProperty('--w', `${d * 35}ms`);
    cells[i].classList.add('wave');
  }
  const fx = $('#fx'), w = fx.clientWidth;
  for (let k = 0; k < 40; k++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.cssText = `left:${Math.random() * w}px;--h:${Math.random() * 360};--x:${(Math.random() - 0.5) * 200}px;animation-delay:${Math.random() * 300}ms`;
    fx.append(c);
    setTimeout(() => c.remove(), 1600);
  }
}
// Dernière vie perdue : ralenti et zoom sur l'explosion
function deathCam(i) {
  const wrap = $('#boardWrap');
  if (i !== undefined && i !== null && cells[i]) {
    const r = cells[i].getBoundingClientRect(), base = wrap.getBoundingClientRect();
    wrap.style.setProperty('--ox', `${r.left - base.left + r.width / 2}px`);
    wrap.style.setProperty('--oy', `${r.top - base.top + r.height / 2}px`);
  }
  wrap.classList.add('deathcam');
  music(false);
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
// Clavier : 1 à 6 pouvoirs, F mode drapeau, Échap menu
addEventListener('keydown', e => {
  if (!run || $('#game').hidden || e.target.matches('input')) return;
  const ids = Object.keys(POWERS);
  if (e.key >= '1' && e.key <= '6' && $('#overlay').hidden) { const b = $(`[data-power="${ids[+e.key - 1]}"]`); if (b) b.click(); }
  if (e.key === 'f' || e.key === 'F') $('#flagMode').click();
  if (e.key === 'Escape') { if ($('#overlay').hidden) $('#pauseBtn').click(); else if ($('#modal [data-close]')) $('#overlay').hidden = true; }
});
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
  if (t.closest('[data-home]')) { clearInterval(timer); music(false); run = null; renderHome(); }
  if (t.closest('[data-abandon]')) { run.phase = 'over'; run.endedAt = Date.now(); run.cause = 'abandon'; gameOver(); }
  if (t.closest('[data-again]')) startRun(run?.daily ? { daily: run.daily } : {});
  if (t.closest('[data-dare]')) {
    const who = (() => { try { return localStorage.getItem('pseudo') || ''; } catch { return ''; } })();
    const url = `${location.origin}${location.pathname}?seed=${run.seed}&perso=${run.char}&niveau=${run.level}${who ? `&de=${encodeURIComponent(who)}` : ''}`;
    navigator.clipboard.writeText(url).then(() => toast('Lien du défi copié : envoie-le à un ami !', 'ok'), () => toast(url));
  }
  const card = t.closest('[data-pick]');
  if (card) {
    const id = card.dataset.pick, got = pickUpgrade(run, id);
    sfx.pick(UP[got.id || id].rarity);
    announce(got);
    afterPick();
  }
  const off = t.closest('[data-offer]');
  if (off) { const got = acceptOffer(run, off.dataset.offer); sfx.coin(); if (got && got.id) { toast(`❔ La carte mystère : ${UP[got.id].icon} ${UP[got.id].name}`, 'ok'); announce(got); } closeModal(); renderAll(); }
  const route = t.closest('[data-route]');
  if (route) { choosePath(run, +route.dataset.route); sfx.click(); if (run.phase === 'shop') shopScreen(); else { closeModal(); levelIntro(); } }
  const sold = t.closest('[data-sell]');
  if (sold && sell(run, sold.dataset.sell)) { sfx.coin(); shopScreen(); }
  if (t.closest('[data-skip]')) { skipUpgrade(run); afterPick(); }
  if (t.closest('[data-reroll]') && reroll(run)) { sfx.coin(); rewardScreen(lastReward, true); }
  const it = t.closest('[data-buy]');
  if (it && !it.disabled) { const got = buy(run, it.dataset.buy); if (got) { sfx.coin(); if (got.id) announce(got); shopScreen(); } }
  if (t.closest('[data-leave]')) { leaveShop(run); if (run.phase === 'path') pathScreen(); else { closeModal(); levelIntro(); } }
});
function afterPick() {
  if (run.phase === 'reward') return rewardScreen(lastReward, true);
  if (run.phase === 'shop') return shopScreen();
  if (run.phase === 'path') return pathScreen();
  closeModal();
  levelIntro();
}
// Évolution, combinaison cachée ou pacte : on le fait savoir
function announce(got) {
  if (!got) return;
  if (got.pact) toast(`🩸 Pacte scellé : −1 vie${got.id ? `, ${UP[got.id].icon} ${UP[got.id].name} obtenu` : ''}`, 'warn');
  if (got.evolved) setTimeout(() => toast(`🧬 ÉVOLUTION : ${got.evolved.name} — ${got.evolved.desc}`, 'event'), 300);
  for (const c of got.combos || []) setTimeout(() => { sfx.win(); toast(`✨ Combinaison découverte : ${c.icon} ${c.name} — ${c.desc}`, 'event'); }, 700);
}
// Chemin : la grille normale, ou deux autres routes
function pathScreen() {
  const route = r => r === null ? { icon: '➡️', name: 'Grille normale', desc: 'Pas de surprise.' } : r === 'shop' ? { icon: '🛒', name: 'Boutique d’abord', desc: 'Fais tes achats, puis une grille normale.' } : EVENTS[r];
  modal(`<p class="kicker">Niveau ${run.level + 1}${(run.level + 2) % 5 === 0 ? ' · le boss approche' : ''}</p><h2>Choisis ton chemin</h2>
    <div class="cards">${run.paths.map((r, k) => { const x = route(r); return `<button class="card path${r === 'cursed' || r === 'elite' ? ' r-epic' : r ? ' r-rare' : ' r-common'}" data-route="${k}"><span class="ic">${x.icon}</span><b>${esc(x.name)}</b><p>${esc(x.desc)}</p></button>`; }).join('')}</div>`, 'reward');
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
  const u = UP[id], n = run.upgrades[id] || 0, evo = EVOLUTIONS[id] && n + 1 === EVOLUTIONS[id].at;
  return `<button class="card r-${u.rarity}${id === 'pact' ? ' pact' : ''}" data-pick="${id}">${evo ? `<span class="evo">🧬 Évolue en ${esc(EVOLUTIONS[id].name)}</span>` : ''}<span class="rar">${RARITY[u.rarity].name}</span><span class="ic">${u.icon}</span><b>${esc(u.name)}</b><p>${esc(u.desc)}</p>${n ? `<small>Déjà ×${n}</small>` : ''}</button>`;
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
    ${Object.keys(run.upgrades).filter(id => id !== 'heart').length ? `<h3>Revendre une amélioration</h3><div class="sellrow">${Object.keys(run.upgrades).filter(id => id !== 'heart').map(id => `<button class="own r-${UP[id].rarity}" data-sell="${id}" title="Revendre ${esc(UP[id].name)} pour ${sellPrice(run, id)} pièces">${UP[id].icon}<small>+${sellPrice(run, id)}</small></button>`).join('')}</div>` : ''}
    <button class="primary big" data-leave>Niveau suivant →</button>`, 'shopm');
}

/* ---------- Fin de partie ---------- */
async function gameOver() {
  if (!run || run.finished) return;
  run.finished = true;
  clearInterval(timer);
  music(false);
  $('#boardWrap').classList.remove('deathcam');
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
  for (const k of ['up', 'boss', 'event', 'combo']) Object.assign(meta.seen[k], run.seen[k]);
  if (run.earned >= 400 && !meta.unlocked.includes('rich')) { meta.unlocked.push('rich'); unlockedNow.push('rich'); }
  meta.history.unshift({ date: new Date().toLocaleDateString('fr-FR'), level, char: run.char, daily: run.daily, ups: Object.keys(run.upgrades), cause: run.cause === 'temps' ? '⏳ Sablier vidé' : run.cause === 'abandon' ? '🏳 Abandon' : '💥 Mine' });
  meta.history.length = Math.min(meta.history.length, 20);
  for (const id of Object.keys(run.upgrades)) { const st = meta.upStats[id] ||= { runs: 0, levels: 0 }; st.runs++; st.levels += level; }
  if (run.daily) meta.daily[run.daily] = Math.max(meta.daily[run.daily] || 0, level);
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
      ${nextGoal() ? `<p class="goal">🎯 Prochain objectif : ${esc(nextGoal())}</p>` : ''}
      ${run.assisted ? '<p class="hint">🎓 Partie en mode apprentissage : pas envoyée au classement.</p>' : ''}
      <button class="primary big" data-again>↻ Rejouer tout de suite</button>
      <button class="ghost" data-dare>⚔️ Défier un ami sur cette partie</button>
      <h3>Classement mondial${run.daily ? ' · partie du jour' : ''}</h3>
      <form class="row" id="boardForm" ${run.assisted ? 'hidden' : ''}><input id="boardName" maxlength="20" placeholder="Ton pseudo" value="${esc(pseudo)}" required><button class="ghost">Envoyer</button></form>
      <p class="hint" id="boardMsg"></p><div id="endBoard"></div>
      <button class="ghost" data-home>Menu</button>`, 'over');
    $('#endBoard').innerHTML = boardHTML(await fetchBoard(run.daily));
    $('#boardForm').onsubmit = async e => {
      e.preventDefault();
      const name = $('#boardName').value.trim();
      if (!name) return;
      try { localStorage.setItem('pseudo', name); } catch { /* stockage bloqué */ }
      try {
        const r = await fetch('/api/mines/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level, coins: run.earned, seconds, day: run.daily || undefined }) });
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
