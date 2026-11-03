// Sillage Néon : accueil, salons, boucle de jeu. Le serveur fait avancer toutes les motos (12 pas par seconde) et envoie
// chaque pas (« snap ») ; ici on dessine les traînées, on lisse le mouvement entre deux pas et on envoie les virages.
import { createView } from './render.js';
import { $, $$, esc, audio, sound, blip, party } from '/shared/party.js';

const params = new URLSearchParams(location.search);
const socket = io('/neon');
const TICK = 1 / 12;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/* ---------------- Sons (synthétisés) ---------------- */
let hum = null;
function boom(vol = 0.35) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length) ** 2;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SFX = {
  turn: () => blip(700, 900, 0.05, 'square', 0.03),
  boost: () => blip(200, 900, 0.4, 'sawtooth', 0.06),
  tick: () => blip(440, 440, 0.12, 'square', 0.06),
  go: () => blip(880, 1760, 0.4, 'square', 0.07),
};
// Ronronnement du moteur de sa moto, créé au premier besoin une fois le son permis
function setHum(on, boost) {
  const ac = sound(); if (!ac) return;
  if (!hum) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 55; o2.frequency.value = 27.5; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); o.start(); o2.start();
    hum = { o, o2, f, g };
  }
  const t = ac.currentTime; hum.g.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.1); hum.o.frequency.setTargetAtTime(boost ? 95 : 55, t, 0.1); hum.o2.frequency.setTargetAtTime(boost ? 47 : 27.5, t, 0.1); hum.f.frequency.setTargetAtTime(boost ? 1400 : 400, t, 0.1);
}

/* ---------------- Salon ---------------- */
const ui = party({ id: 'neon', socket, max: 8, bots: 3, busy: '🏍️ en jeu', onShow: screen => screen !== 'game' && setHum(false) });
const { show, feed } = ui;
let offset = 0, roundKey = '', seenOrder = 0, lastCount = null;
const colorOf = n => ui.room?.players.find(p => p.name === n)?.color ?? '#ffffff';
socket.on('state', s => {
  if (!s) return;
  offset = s.now - Date.now();
  const inGame = ['countdown', 'play', 'roundEnd', 'over'].includes(s.phase);
  if (inGame) show('game'); else { show('room'); $('#board').hidden = true; }
  const key = `${s.round}.${s.roundNo}`;
  if (inGame && key !== roundKey && s.bikes) {
    roundKey = key; seenOrder = 0; lastCount = null; lastK = s.tick;
    view.setArena(s.size);
    heads.clear();
    for (const [n, b] of Object.entries(s.bikes)) {
      heads.set(n, { x: b.x, y: b.y, px: b.x, py: b.y, dir: b.dir, alive: b.alive, boost: 0, segs: [] });
      if (b.alive) view.addSeg(n, colorOf(n), b.x, b.y, b.x, b.y);
    }
    pending = [];
    tip = s.bikes[s.me]?.alive ? view.addSeg(s.me, colorOf(s.me), s.bikes[s.me].x, s.bikes[s.me].y, s.bikes[s.me].x + 1, s.bikes[s.me].y, 0) : -1;
    if (s.tick > 0) sync(); // arrivé en cours de manche
    $('#feed').innerHTML = ''; $('#board').hidden = true; $('#spectating').hidden = true;
  }
  for (const n of s.order.slice(seenOrder)) {
    if (s.phase === 'roundEnd' && n === s.lastWinner) continue;
    feed(n === s.me ? 'Ta moto est détruite !' : `${n} est éliminé !`);
    if (n === s.me) $('#spectating').hidden = false;
  }
  seenOrder = s.order.length;
  if (s.phase === 'roundEnd' || s.phase === 'over') showBoard(s);
  ui.renderRoom();
});
function showBoard(s) {
  const over = s.phase === 'over';
  const rows = over ? s.ranking : [...s.players].sort((a, b) => b.points - a.points);
  const gained = n => Math.max(0, s.order.indexOf(n));
  $('#boardTitle').textContent = over ? `🏆 ${rows[0]?.name === s.me ? 'Tu gagnes la partie !' : `${rows[0]?.name} gagne la partie !`}` : `⚡ ${s.lastWinner === s.me ? 'Tu gagnes la manche !' : s.lastWinner ? `${s.lastWinner} gagne la manche` : 'Égalité : tout le monde est sorti'}`;
  $('#boardList').innerHTML = rows.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><i style="width:12px;height:12px;border-radius:3px;background:${p.color};box-shadow:0 0 8px ${p.color}"></i><span>${esc(p.name)}</span>${over ? '' : `<em>+${gained(p.name)}</em>`}<strong>${p.points} pts</strong></li>`).join('');
  $('#boardHint').textContent = over ? '' : `Manche ${s.roundNo}/${s.settings.rounds} terminée · la suite arrive…`;
  ui.endButtons(s, rows);
  $('#board').hidden = false;
}

/* ---------------- Pas de jeu reçus ---------------- */
const view = createView($('#view'));
if (params.has('debug')) Object.assign(window, { view, heads: null });
view.resize(); addEventListener('resize', () => view.resize());
const heads = new Map(); if (params.has('debug')) window.heads = heads; // pseudo -> { x, y, px, py, dir, alive, boost, segs }
let lastK = 0, snapAt = 0, myEnergy = 100;
// Prédiction de sa propre moto : on affiche tout de suite le virage demandé, sans attendre l'aller-retour avec le serveur.
let pending = [], tip = -1; // virages envoyés pas encore vus appliqués ; bout de traînée prédit
socket.on('snap', snap => {
  if (lastK && snap.k !== lastK + 1) { sync(); return; } // un pas perdu : on redemande la grille entière
  lastK = snap.k; snapAt = performance.now() / 1000;
  for (const [n, x, y, dir, alive, boost, energy] of snap.p) {
    const h = heads.get(n); if (!h) continue;
    for (const k of h.segs) view.setLen(k, 1); // les segments du pas précédent sont finis
    h.segs = [];
    if (alive && (x !== h.x || y !== h.y)) {
      // les cases parcourues pendant ce pas (1, ou 2 avec le turbo), en ligne droite
      const steps = Math.abs(x - h.x) + Math.abs(y - h.y), dx = Math.sign(x - h.x), dy = Math.sign(y - h.y);
      // sa propre moto est affichée en avance : ses cases sont déjà parcourues à l'écran
      for (let j = 0; j < steps; j++) { const k = view.addSeg(n, colorOf(n), h.x + dx * j, h.y + dy * j, h.x + dx * (j + 1), h.y + dy * (j + 1), n === ui.room?.me ? 1 : 0); if (n !== ui.room?.me) h.segs.push(k); }
    }
    Object.assign(h, { px: h.x, py: h.y, x, y, dir, boost });
    if (n === ui.room?.me) {
      if (boost && !h.wasBoost) SFX.boost(); h.wasBoost = boost; myEnergy = energy;
      const now = performance.now() / 1000;
      if (pending[0] && dir === pending[0].d) pending.shift(); // virage appliqué par le serveur
      pending = pending.filter(p => now - p.at < 0.6);
    }
    if (!alive && h.alive) { view.explode(x, y, colorOf(n)); view.clear(n); boom(n === ui.room?.me ? 0.45 : 0.2); if (n === ui.room?.me) tip = -1; }
    h.alive = !!alive;
  }
});
function sync() {
  if (params.has('debug')) window.syncs = (window.syncs ?? 0) + 1; // pour les tests
  socket.emit('sync', d => {
    if (!d?.size) return;
    view.setArena(d.size);
    const S = d.size, g = [];
    for (const part of d.grid.split(',').filter(Boolean)) { const [v, n] = part.split(':').map(Number); for (let j = 0; j < n; j++) g.push(v); }
    // On relie chaque case à ses voisines de la même moto : les traînées redeviennent des lignes continues.
    g.forEach((v, c) => {
      if (!v) return;
      const x = c % S, y = (c - x) / S, name = d.ids[v];
      let linked = false;
      if (x + 1 < S && g[c + 1] === v) { view.addSeg(name, colorOf(name), x, y, x + 1, y); linked = true; }
      if (y + 1 < S && g[c + S] === v) { view.addSeg(name, colorOf(name), x, y, x, y + 1); linked = true; }
      if (!linked && !(x > 0 && g[c - 1] === v) && !(y > 0 && g[c - S] === v)) view.addSeg(name, colorOf(name), x, y, x, y);
    });
    for (const h of heads.values()) h.segs = [];
    const me = heads.get(ui.room?.me);
    tip = me?.alive ? view.addSeg(ui.room.me, colorOf(ui.room.me), me.x, me.y, me.x + 1, me.y, 0) : -1;
    lastK = d.k;
  });
}

/* ---------------- Commandes ---------------- */
const KEYDIR = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 };
const turn = d => {
  const me = heads.get(ui.room?.me);
  if (me?.alive && ui.room.phase !== 'roundEnd') {
    const lastDir = pending.length ? pending.at(-1).d : me.dir;
    if (d === lastDir || (d + 2) % 4 === lastDir || pending.length >= 3) return; // même règle que le serveur
    pending.push({ d, at: performance.now() / 1000 });
  }
  socket.emit('turn', d); SFX.turn();
};
const boostNow = () => socket.emit('boost');
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select') || !document.body.classList.contains('playing')) return;
  if (e.code in KEYDIR) { e.preventDefault(); if (!e.repeat) turn(KEYDIR[e.code]); }
  if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code)) { e.preventDefault(); boostNow(); }
});
// Glisser le doigt (ou la souris) dans une direction pour tourner
{
  let sx = null, sy = null;
  const canvas = $('#view');
  addEventListener('pointerdown', e => { if (e.target.closest('button') || !document.body.classList.contains('playing')) return; sx = e.clientX; sy = e.clientY; audio(); });
  addEventListener('pointermove', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 28) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
    sx = e.clientX; sy = e.clientY;
  });
  addEventListener('pointerup', () => (sx = null));
  canvas.style.touchAction = 'none';
}
$('#touch').hidden = !matchMedia('(pointer: coarse)').matches;
for (const b of $$('#touch [data-dir]')) b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); turn(Number(b.dataset.dir)); });
$('#boostBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); boostNow(); });

/* ---------------- Boucle d'affichage ---------------- */
let last = performance.now();
const labelEls = new Map();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = ui.room;
  const list = [];
  if (s && ['countdown', 'play', 'roundEnd', 'over'].includes(s.phase)) {
    // entre deux pas : les motos glissent de leur ancienne case à la nouvelle, et les traînées poussent avec elles
    const f = s.phase === 'play' ? Math.min(1, (t - snapAt) / TICK) : 1;
    for (const [n, h] of heads) {
      if (n === s.me && h.alive && s.phase === 'play') {
        // ma moto : à sa case + la fraction du pas suivant, déjà dans la direction demandée
        const d = pending[0]?.d ?? h.dir, steps = h.boost ? 2 : 1, len = f * steps;
        const x = h.x + DIRS[d][0] * len, y = h.y + DIRS[d][1] * len;
        if (tip >= 0) view.setSeg(tip, h.x, h.y, h.x + DIRS[d][0], h.y + DIRS[d][1], len);
        list.push({ name: n, color: colorOf(n), x, y, dir: d, alive: true, boost: h.boost });
        continue;
      }
      const x = h.px + (h.x - h.px) * f, y = h.py + (h.y - h.py) * f;
      h.segs.forEach((k, j) => view.setLen(k, Math.max(0, Math.min(1, f * h.segs.length - j))));
      list.push({ name: n, color: colorOf(n), x, y, dir: h.dir, alive: h.alive, boost: h.boost });
    }
    const me = heads.get(s.me);
    setHum(s.phase === 'play' && !!me?.alive, me?.boost);
    if (s.phase === 'countdown') {
      const n = Math.ceil((s.deadline - (Date.now() + offset)) / 1000);
      if (n !== lastCount && n > 0 && n <= 3) { lastCount = n; $('#count3').textContent = n; $('#count3').hidden = false; restartAnim($('#count3')); SFX.tick(); }
    } else if (s.phase === 'play' && lastCount !== 0) { lastCount = 0; $('#count3').textContent = 'GO'; restartAnim($('#count3')); SFX.go(); setTimeout(() => ($('#count3').hidden = true), 700); }
    $('#hRound').textContent = `Manche ${s.roundNo}/${s.settings.rounds}`;
    $('#hAlive').textContent = `${list.filter(o => o.alive).length} en piste`;
    $('#energy').hidden = !me;
    $('#energy i').style.width = `${myEnergy}%`;
  }
  view.update(list, dt, t);
  // pseudos au-dessus des motos
  const box = $('#labels'), seen = new Set();
  for (const o of list) {
    if (!o.alive) continue;
    seen.add(o.name);
    let el = labelEls.get(o.name);
    if (!el) { el = document.createElement('span'); el.textContent = o.name; box.append(el); labelEls.set(o.name, el); }
    el.className = o.name === s.me ? 'me' : '';
    const [x, y, ok] = view.project(o.x, o.y, 1.6);
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.hidden = !ok;
  }
  for (const [n, el] of labelEls) if (!seen.has(n)) { el.remove(); labelEls.delete(n); }
}
function restartAnim(el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
view.setArena(60);
requestAnimationFrame(frame);
show('home');
