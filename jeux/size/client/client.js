// Size It Up : grille zoomable, objet rouge à déplacer et redimensionner, révélation de la vraie taille.
// Unités du monde : la hauteur de l'objet bleu vaut 1 ; le sol est en y = 0 et les objets montent vers les y négatifs.
import { ART } from './art.js';

const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const svg = $('#stage');
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const fmtM = m => (m < 1 ? `${Math.round(m * 100)} cm` : `${m < 20 ? m.toFixed(1).replace('.', ',').replace(',0', '') : Math.round(m)} m`);
const pct = (est, truth) => { const p = Math.round((est / truth - 1) * 100); return p === 0 ? 'pile la bonne taille' : `${Math.abs(p)} % trop ${p > 0 ? 'grand' : 'petit'}`; };

let game = null, n = 0, total = 0, results = [], locked = false;
let ref, red, truth = null; // ref : { x, w, h: 1 } ; red : { x, bottom, h, a } ; truth : hauteur révélée
const cam = { cx: 0, cy: -0.5, k: 100 };

/* ---------- Scène SVG ---------- */
svg.innerHTML = `
  <defs><pattern id="grid" patternUnits="userSpaceOnUse"><path class="gridline"/></pattern></defs>
  <rect id="gridbg" fill="url(#grid)"/>
  <line id="refline"/>
  <line id="ground"/>
  <g id="refG"><rect class="hit"/><svg class="art" preserveAspectRatio="none"/></g>
  <g id="redG"><rect class="hit"/><svg class="art" preserveAspectRatio="none"/>
    ${['tl', 'tr', 'bl', 'br'].map(h => `<circle class="handle" data-handle="${h}"/>`).join('')}</g>
  <g id="truthG" class="truth" style="display:none"><rect class="obj truthbox"/><svg class="art" preserveAspectRatio="none"/><text class="truth-label">vraie taille</text></g>`;
const el = id => svg.querySelector(id);
const set = (node, attrs) => { for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); };

function size() { const r = svg.getBoundingClientRect(); return { W: r.width || 1, H: r.height || 1, r }; }
function toWorld(clientX, clientY) {
  const { W, H, r } = size();
  return { x: cam.cx + (clientX - r.left - W / 2) / cam.k, y: cam.cy + (clientY - r.top - H / 2) / cam.k };
}

function draw() {
  const { W, H } = size(), vw = W / cam.k, vh = H / cam.k, vx = cam.cx - vw / 2, vy = cam.cy - vh / 2;
  svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  // Quadrillage dont le pas s'adapte au zoom (environ 40 px à l'écran).
  const raw = 40 / cam.k, p10 = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map(m => m * p10).find(s => s >= raw);
  set(el('#grid'), { width: step, height: step, x: 0, y: 0 });
  set(el('.gridline'), { d: `M ${step} 0 L 0 0 0 ${step}` });
  set(el('#gridbg'), { x: vx, y: vy, width: vw, height: vh });
  set(el('#ground'), { x1: vx, x2: vx + vw, y1: 0, y2: 0 });
  set(el('#refline'), { x1: vx, x2: vx + vw, y1: -1, y2: -1 }); // repère : le haut de l'objet bleu
  const box = (g, x, y, width, height) => { for (const n of g.querySelectorAll(':scope > rect, :scope > .art')) set(n, { x, y, width, height }); };
  box(el('#refG'), ref.x, -1, ref.w, 1);
  const rw = red.h * red.a, top = red.bottom - red.h;
  box(el('#redG'), red.x, top, rw, red.h);
  const r = 7 / cam.k;
  for (const c of svg.querySelectorAll('.handle')) {
    const h = c.dataset.handle;
    set(c, { cx: h.includes('l') ? red.x : red.x + rw, cy: h.includes('t') ? top : red.bottom, r });
  }
  if (truth !== null) {
    const th = truth.shown, tw = th * red.a;
    box(el('#truthG'), red.x, red.bottom - th, tw, th);
    set(el('.truth-label'), { x: red.x + tw / 2, y: red.bottom - th - 10 / cam.k, 'font-size': 13 / cam.k });
  }
}

// Cadre la vue sur les objets (et la vraie taille si elle est révélée).
function fitTarget(extra = 0) {
  const { W, H } = size();
  const right = Math.max(ref.x + ref.w, red.x + Math.max(red.h, extra) * red.a);
  const left = Math.min(ref.x, red.x), top = Math.min(-1, red.bottom - red.h, red.bottom - extra);
  const bottom = Math.max(0, red.bottom);
  const w = right - left, h = bottom - top;
  const k = Math.min(W / (w * 1.3), H / (h * 1.35));
  return { cx: (left + right) / 2, cy: (top + bottom) / 2 + h * 0.05, k };
}
function animate(ms, step, done) {
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
    step(e);
    draw();
    if (t < 1) requestAnimationFrame(tick);
    else done?.();
  };
  requestAnimationFrame(tick);
}
function moveCam(to, ms = 450) {
  const from = { ...cam };
  animate(ms, e => {
    cam.cx = from.cx + (to.cx - from.cx) * e;
    cam.cy = from.cy + (to.cy - from.cy) * e;
    cam.k = from.k * (to.k / from.k) ** e;
  });
}
function zoomAt(f, clientX, clientY) {
  const before = toWorld(clientX, clientY);
  cam.k = Math.min(5000, Math.max(2, cam.k * f));
  const after = toWorld(clientX, clientY);
  cam.cx += before.x - after.x;
  cam.cy += before.y - after.y;
  draw();
}
new ResizeObserver(() => ref && draw()).observe(svg);

/* ---------- Manipulation : souris, doigt, deux doigts ---------- */
const pointers = new Map();
let mode = null, grab = null;
const hideCoach = () => $('#coach').classList.add('gone');

svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  hideCoach();
  if (pointers.size === 2 && !locked) {
    // Deux doigts : on redimensionne le rouge autour de son centre.
    const [a, b] = [...pointers.values()];
    mode = 'pinch';
    grab = { d: Math.hypot(a.x - b.x, a.y - b.y), h: red.h, cx: red.x + red.h * red.a / 2, cy: red.bottom - red.h / 2 };
    return;
  }
  const w = toWorld(e.clientX, e.clientY), handle = e.target.dataset?.handle;
  if (handle && !locked) {
    const rw = red.h * red.a, top = red.bottom - red.h;
    mode = 'resize';
    grab = { handle, ax: handle.includes('l') ? red.x + rw : red.x, ay: handle.includes('t') ? red.bottom : top };
  } else if (e.target.closest('#redG') && !locked) {
    mode = 'move';
    grab = { dx: w.x - red.x, dy: w.y - red.bottom };
  } else {
    mode = 'pan';
    grab = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy };
  }
  svg.classList.toggle('dragging', mode !== 'pan');
});

svg.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const w = toWorld(e.clientX, e.clientY);
  if (mode === 'move') {
    red.x = w.x - grab.dx;
    red.bottom = w.y - grab.dy;
    if (Math.abs(red.bottom) < 12 / cam.k) red.bottom = 0; // aimanté au sol pour comparer facilement
  } else if (mode === 'resize') {
    const h = Math.max(0.02, Math.abs(w.y - grab.ay), Math.abs(w.x - grab.ax) / red.a);
    red.h = h;
    red.x = grab.handle.includes('l') ? grab.ax - h * red.a : grab.ax;
    red.bottom = grab.handle.includes('t') ? grab.ay : grab.ay + h;
  } else if (mode === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const h = Math.max(0.02, grab.h * Math.hypot(a.x - b.x, a.y - b.y) / grab.d);
    red.h = h;
    red.x = grab.cx - h * red.a / 2;
    red.bottom = grab.cy + h / 2;
  } else if (mode === 'pan') {
    cam.cx = grab.cx - (e.clientX - grab.x) / cam.k;
    cam.cy = grab.cy - (e.clientY - grab.y) / cam.k;
  } else return;
  draw();
});
const release = e => {
  pointers.delete(e.pointerId);
  if (!pointers.size || mode === 'pinch') mode = null; // après un pincement, on attend un nouveau geste
  svg.classList.remove('dragging');
};
svg.addEventListener('pointerup', release);
svg.addEventListener('pointercancel', release);
svg.addEventListener('wheel', e => {
  e.preventDefault();
  hideCoach();
  zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
}, { passive: false });
$('.zoom').onclick = e => {
  const z = e.target.closest('[data-zoom]')?.dataset.zoom;
  const { W, H, r } = size();
  if (z === 'in') zoomAt(1.4, r.left + W / 2, r.top + H / 2);
  if (z === 'out') zoomAt(1 / 1.4, r.left + W / 2, r.top + H / 2);
  if (z === 'fit') moveCam(fitTarget(truth?.value ?? 0));
};

/* ---------- Déroulement ---------- */
function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}
const best = () => Number(store.get('size-best')) || 0;
const renderBest = () => {
  $('#best').textContent = best() ? `Record : ${best()} / 1000` : '';
  $('#hudBest').textContent = best() ? `Record ${best()}` : '';
};
renderBest();

async function start() {
  $('#play').disabled = $('#again').disabled = true;
  try {
    const res = await fetch('../api/size/games', { method: 'POST' });
    if (!res.ok) throw new Error();
    game = await res.json();
  } catch {
    toast('Impossible de lancer une partie : le serveur ne répond pas');
    return;
  } finally {
    $('#play').disabled = $('#again').disabled = false;
  }
  n = 0;
  total = 0;
  results = [];
  show('game');
  round();
}

function round() {
  const r = game.rounds[n];
  locked = false;
  truth = null;
  el('#truthG').style.display = 'none';
  $('#reveal').hidden = true;
  $('#reveal').innerHTML = '';
  $('#validate').hidden = false;
  $('#validate').disabled = false;
  $('#roundNo').textContent = `${n + 1} / ${game.total}`;
  $('#total').textContent = total;
  $('#refName').textContent = `${r.ref.emoji} ${r.ref.name}`;
  $('#targetName').textContent = `${r.target.emoji} ${r.target.name}`;
  const paint = (g, o) => { const a = ART[o.id], s = el(`${g} .art`); s.setAttribute('viewBox', `0 0 ${a.vb[0]} ${a.vb[1]}`); s.innerHTML = a.svg; };
  paint('#refG', r.ref);
  paint('#redG', r.target);
  paint('#truthG', r.target);
  if (n > 0) hideCoach();
  // Le rouge démarre à la même hauteur que le bleu, posé à côté sur le sol.
  ref = { x: 0, w: r.ref.aspect, h: 1 };
  red = { x: ref.w + 0.5, bottom: 0, h: 1, a: r.target.aspect };
  svg.classList.remove('locked');
  Object.assign(cam, fitTarget());
  draw();
}

$('#validate').onclick = async () => {
  if (locked) return;
  locked = true;
  $('#validate').disabled = true;
  svg.classList.add('locked');
  const estimate = red.h;
  let res;
  try {
    const r = await fetch(`../api/size/games/${game.id}/rounds/${n}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimate }),
    });
    res = await r.json();
    if (!r.ok) throw new Error(res.error);
  } catch (err) {
    toast(err.message || 'Le serveur ne répond pas, réessaie');
    locked = false;
    $('#validate').disabled = false;
    svg.classList.remove('locked');
    return;
  }
  reveal(estimate, res);
};

// Révélation : la vraie silhouette grandit (ou rétrécit) depuis ton estimation, la vue se recadre, le score défile.
function reveal(estimate, res) {
  truth = { value: res.truth, shown: estimate };
  el('#truthG').style.display = '';
  $('#validate').hidden = true;
  const to = fitTarget(res.truth), from = { ...cam };
  animate(1100, e => {
    truth.shown = estimate + (res.truth - estimate) * e;
    cam.cx = from.cx + (to.cx - from.cx) * e;
    cam.cy = from.cy + (to.cy - from.cy) * e;
    cam.k = from.k * (to.k / from.k) ** e;
  }, () => {
    total += res.points;
    results.push({ ...res, estimate, ref: game.rounds[n].ref, target: game.rounds[n].target });
    const tier = res.points >= 80 ? 'great' : res.points >= 60 ? 'good' : res.points >= 30 ? 'meh' : 'bad';
    const last = n === game.total - 1;
    $('#reveal').className = `reveal ${tier}`;
    $('#reveal').innerHTML = `
      <div class="verdict">${res.verdict}</div>
      <div class="points"><b id="pts">0</b><small>points</small></div>
      <p class="facts">
        <span class="blue-t">${res.ref.name} : ${fmtM(res.ref.h)}</span> ·
        <span class="red-t">${res.target.name} : ${fmtM(res.target.h)}</span><br>
        Ton estimation : ${fmtM(estimate * res.ref.h)}, soit <b>${pct(estimate, res.truth)}</b>
      </p>
      <div class="meter"><i style="--p:${res.points}%"></i></div>
      <button class="primary" id="next">${last ? 'Voir mon score' : 'Manche suivante →'}</button>`;
    $('#reveal').hidden = false;
    const pts = $('#pts'); // référence gardée : le panneau peut être vidé si l'on passe vite à la manche suivante
    animate(700, e => (pts.textContent = Math.round(res.points * e)));
    $('#total').textContent = total;
    $('#next').onclick = () => (last ? end() : (n++, round()));
    $('#next').focus();
  });
}

function end() {
  const record = total > best();
  if (record) store.set('size-best', total);
  renderBest();
  $('#endTotal').textContent = total;
  $('#record').hidden = !record;
  $('#recap').innerHTML = results.map(r => `<li>
      <span>${r.ref.emoji} → ${r.target.emoji}</span>
      <span class="name">${r.target.name}</span>
      <small>${pct(r.estimate, r.truth)}</small>
      <b class="${r.points >= 80 ? 'great' : r.points >= 60 ? 'good' : r.points >= 30 ? 'meh' : 'bad'}">${r.points}</b></li>`).join('');
  show('end');
}

$('#play').onclick = $('#again').onclick = start;
$('#quit').onclick = () => {
  if (results.length < game.total && !confirm('Quitter la partie en cours ?')) return;
  show('menu');
};
$('#toMenu').onclick = $('#endBack').onclick = () => show('menu');
