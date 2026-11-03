// Little Fisher : l'interface en mer. Messages, nom des lieux, argent, cale, heure, appât, carte de la prise, mini-carte et carte.
import { S } from './state.js';
import * as G from './game.js';
import { RARITY, ISLANDS, SPOTS, FOSSE, OPEN_SEA, BAITS, WRECKS, WONDERS, HUNTS, FISH, TREASURES } from './data.js';
import { fishImage } from './fishart.js';
import { SFX } from './audio.js';
import { $, esc } from '/shared/party.js';

export const coins = n => `${n.toLocaleString('fr-FR')} 🪙`;
export const rarityTag = f => `<span class="rar" style="background:${RARITY[f.rarity].color}">${RARITY[f.rarity].name}</span>`;
export const WEATHER = { clair: 'Beau temps', nuageux: 'Nuageux', pluie: 'Pluie', brume: 'Brume' };

export function toast(html, ms = 3800) {
  const li = document.createElement('li'); li.innerHTML = html; $('#toasts').prepend(li);
  while ($('#toasts').children.length > 4) $('#toasts').lastChild.remove();
  setTimeout(() => li.remove(), ms);
}
let placeTimer = 0;
export function banner(title, sub = '') {
  $('#place b').textContent = title; $('#place small').textContent = sub;
  $('#place').classList.add('on'); clearTimeout(placeTimer); placeTimer = setTimeout(() => $('#place').classList.remove('on'), 3200);
}
// L'argent bouge : petit bond du compteur et tintement
export function gain(n) {
  if (!n) return;
  SFX.coin(); $('#hMoney').classList.remove('bump'); void $('#hMoney').offsetWidth; $('#hMoney').classList.add('bump');
}
export const baitLabel = () => { const b = S.save.bait; return b ? `${BAITS[b].icon} ${BAITS[b].forever ? '∞' : S.save.baits[b]}` : '🚫 sans appât'; };

// La carte de la prise : image, taille, prix, nouvelle espèce ou record
export function showCatch(f, res, how = '') {
  $('#cTag').textContent = res.first ? '✨ Nouvelle espèce !' : res.record ? '🏆 Nouveau record de taille !' : how;
  $('#cImg').src = fishImage(f);
  $('#cName').textContent = f.name;
  $('#cInfo').innerHTML = `${rarityTag(f)} · <b>${res.fish.size} cm</b> · environ <span class="price">${coins(res.fish.price)}</span>`;
  $('#cDesc').textContent = f.desc;
  $('#catch').hidden = false;
  if (G.cargoFull(S.save)) setTimeout(() => toast('Ta cale est pleine : direction le marché !'), 600);
}
export const catchOpen = () => !$('#catch').hidden || !$('#dialog').hidden;
// Une bulle de dialogue (histoire, concours) ; onClose quand on la ferme
let dialogDone = null;
export function showDialog(face, name, role, text, onClose = null) {
  $('#dFace').textContent = face; $('#dName').textContent = name; $('#dRole').textContent = role; $('#dText').textContent = text;
  $('#dialog').hidden = false; dialogDone = onClose;
}
export function closeDialog() { $('#dialog').hidden = true; const f = dialogDone; dialogDone = null; f?.(); }
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function closeCatch() { if (!$('#dialog').hidden) return closeDialog(); $('#catch').hidden = true; }

export function updateHud(hint) {
  const s = S.save;
  $('#hMoney').textContent = `🪙 ${s.money.toLocaleString('fr-FR')}`;
  $('#hCargo').textContent = `🐟 ${s.cargo.length}/${G.slots(s)}`;
  $('#hBait').textContent = baitLabel();
  const p = G.period(s.time), w = S.W.kind;
  const icon = w === 'pluie' ? '🌧️' : w === 'brume' ? '🌫️' : p === 'nuit' ? '🌙' : p === 'crepuscule' ? '🌅' : w === 'nuageux' ? '⛅' : '☀️';
  $('#hClock').textContent = `${icon} ${G.clock(s.time)}`; $('#hClock').title = `${WEATHER[w]} · ${DAYS[s.days % 7]} (jour ${s.days + 1})`;
  const on = G.contestOn(s);
  $('#hContest').hidden = !on;
  if (on) { const left = Math.max(0, (s.contest.until - G.now(s)) * 24 * 60); $('#hContest').textContent = `🏆 ${Math.floor(left / 60)} h ${String(Math.floor(left % 60)).padStart(2, '0')} · ${s.contest.best} pts`; }
  if ($('#hint').innerHTML !== hint) $('#hint').innerHTML = hint;
}

/* ---------------- Cartes ---------------- */
const MAP_SPAN = 2300, mapLand = document.createElement('canvas');
export function buildMapLand() {
  const N = 260; mapLand.width = mapLand.height = N;
  const g = mapLand.getContext('2d'), img = g.createImageData(N, N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const h = S.world.heightAt((c + 0.5) / N * MAP_SPAN - MAP_SPAN / 2, (r + 0.5) / N * MAP_SPAN - MAP_SPAN / 2);
    const col = h > 14 ? [70, 128, 72] : h > 1.5 ? [112, 178, 92] : h > -0.5 ? [242, 224, 168] : h > -6 ? [96, 212, 204] : h > -30 ? [52, 148, 190] : [28, 70, 128];
    img.data.set([...col, 255], (r * N + c) * 4);
  }
  g.putImageData(img, 0, 0);
}
const toMap = (x, z, S2) => [(x / MAP_SPAN + 0.5) * S2, (z / MAP_SPAN + 0.5) * S2];
function arrow(g, x, y, h, s) {
  g.save(); g.translate(x, y); g.rotate(-h + Math.PI);
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.65, s * 0.7); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.65, s * 0.7); g.closePath();
  g.fillStyle = '#ff7a59'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.fill(); g.restore();
}
function trapDot(g, x, y, ready, r = 6) {
  g.fillStyle = ready ? '#5fe08a' : '#ff9a3c'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
}
export function renderMap() {
  const cv = $('#mapCanvas'), g = cv.getContext('2d'), N = cv.width, s = S.save;
  g.imageSmoothingEnabled = true; g.drawImage(mapLand, 0, 0, N, N);
  g.setLineDash([10, 8]); g.lineWidth = 2;
  g.strokeStyle = 'rgba(242,193,78,.9)'; g.beginPath(); g.arc(...toMap(0, 0, N), OPEN_SEA / MAP_SPAN * N, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(155,108,240,.9)'; g.beginPath(); g.arc(...toMap(FOSSE.x, FOSSE.z, N), (FOSSE.r + 40) / MAP_SPAN * N, 0, 7); g.stroke();
  g.setLineDash([]);
  g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'center';
  const label = (t, x, y, col = '#1d3b4f') => { g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y); };
  for (const p of SPOTS) { const [x, y] = toMap(p.x, p.z, N); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); }
  for (const i of ISLANDS.filter(i => i.name)) { const [x, y] = toMap(i.x, i.z, N); label(s.seen.includes(i.id) ? i.name : '? ? ?', x, y - i.r / MAP_SPAN * N - 8); }
  label(s.seen.includes('fosse') ? 'La Fosse' : '? ? ?', ...toMap(FOSSE.x, FOSSE.z + 10, N), '#4b2a8a');
  for (const d of S.world.docks) { const [x, y] = toMap(d.x, d.z, N); g.font = '20px sans-serif'; g.fillText('⚓', x, y + 7); g.font = '600 18px Fredoka, sans-serif'; }
  for (const t of s.traps) trapDot(g, ...toMap(t.x, t.z, N), G.trapReady(s, t), 5);
  const open = (x, z) => { const c = Math.floor((x / G.FOG_SPAN + 0.5) * G.FOG_N), r = Math.floor((z / G.FOG_SPAN + 0.5) * G.FOG_N); return s.fog[r * G.FOG_N + c] === '1'; };
  g.font = '18px sans-serif';
  for (const w of WRECKS) if (open(w.x, w.z)) { const [x, y] = toMap(w.x, w.z, N); g.fillText('🪝', x, y + 6); }
  for (const w of WONDERS) if (w.x != null && s.seen.includes(w.id)) { const [x, y] = toMap(w.x, w.z, N); g.fillText(w.icon, x, y + 6); }
  for (const id of G.activeHunts(s)) { // zone approximative du trésor
    const p = S.world.huntSpots[id].land, [x, y] = toMap(p.x + 25, p.z - 20, N);
    g.strokeStyle = '#d23b32'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(x, y, 70 / MAP_SPAN * N, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#d23b32'; g.font = '700 16px Fredoka, sans-serif'; g.fillText('✕ ?', x, y + 5); g.font = '18px sans-serif';
  }
  // brouillard : ce qu'on n'a jamais vu reste blanc comme une carte vierge
  if (s.fog.length === G.FOG_N * G.FOG_N) {
    const f = document.createElement('canvas'); f.width = f.height = G.FOG_N;
    const fg = f.getContext('2d'), img = fg.createImageData(G.FOG_N, G.FOG_N);
    for (let k = 0; k < s.fog.length; k++) if (s.fog[k] === '0') img.data.set([238, 226, 200, 245], k * 4);
    fg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(f, 0, 0, N, N);
  }
  arrow(g, ...toMap(S.B.x, S.B.z, N), S.B.heading, 14);
  $('#mapHint').innerHTML = `Exploré : <b>${Math.round(G.explored(s) * 100)} %</b> de la carte · Pointillés jaunes : la haute mer (il faut la <b>coque renforcée</b>) · violets : <b>la Fosse</b> et le grand nord (coque de haute mer) · 🪝 épaves · ✕ trésors enterrés · cercles blancs : des remous où les poissons rares mordent plus${s.traps.length ? ' · ronds orange : tes casiers (verts quand ils sont pleins)' : ''}. ${G.treasuresLeft(s).length} trésors flottent encore quelque part…`;
}
// Sonar : pour chaque remous à portée, la couleur du poisson le plus rare qui mord là maintenant (recalculé toutes les 2 s)
const RANK = ['commun', 'peu', 'rare', 'legende'];
let sonarAt = -9, sonarCache = [];
function sonarBlips(range) {
  if (S.time - sonarAt < 2) return sonarCache;
  sonarAt = S.time;
  const s = S.save, ctx = { time: s.time, weather: S.W.kind, rod: s.levels.canne, lantern: s.levels.lanterne, bait: s.bait };
  sonarCache = SPOTS.filter(p => Math.hypot(p.x - S.B.x, p.z - S.B.z) < range).map(p => {
    const best = FISH.filter(f => G.canBite(f, { ...ctx, zone: p.zone })).reduce((a, f) => Math.max(a, RANK.indexOf(f.rarity)), -1);
    return { p, color: best >= 0 ? RARITY[RANK[best]].color : '#888888' };
  });
  return sonarCache;
}
export function drawMinimap() {
  const cv = $('#minimap'), g = cv.getContext('2d'), N = cv.width, R = 320, B = S.B; // R : mètres visibles de chaque côté
  const M = mapLand.width, px = (B.x / MAP_SPAN + 0.5) * M, pz = (B.z / MAP_SPAN + 0.5) * M, half = R / MAP_SPAN * M;
  g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, 7); g.clip();
  g.fillStyle = '#1c528c'; g.fillRect(0, 0, N, N);
  g.drawImage(mapLand, px - half, pz - half, half * 2, half * 2, 0, 0, N, N);
  const to = (x, z) => [N / 2 + (x - B.x) / R * N / 2, N / 2 + (z - B.z) / R * N / 2];
  for (const p of SPOTS) { const [x, y] = to(p.x, p.z); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke(); }
  for (const d of S.world.docks) { const [x, y] = to(d.x, d.z); g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillText('⚓', x, y + 9); }
  for (const t of S.save.traps) trapDot(g, ...to(t.x, t.z), G.trapReady(S.save, t), 8);
  const sonar = G.lvl(S.save, 'sonar');
  if (sonar.range) { // balayage, bancs de poissons, et au loin épaves et trésors qui flottent
    const a = S.time * 2;
    g.strokeStyle = 'rgba(120,255,180,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(N / 2, N / 2); g.lineTo(N / 2 + Math.cos(a) * N / 2, N / 2 + Math.sin(a) * N / 2); g.stroke();
    for (const b of sonarBlips(sonar.range)) { const [x, y] = to(b.p.x, b.p.z), r = 9 + Math.sin(S.time * 4 + b.p.x) * 2; g.fillStyle = b.color; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (S.save.levels.sonar >= 2) {
      g.font = '22px sans-serif'; g.textAlign = 'center';
      for (const w of WRECKS) if (Math.hypot(w.x - B.x, w.z - B.z) < sonar.range) g.fillText('🪝', ...to(w.x, w.z + 4));
      for (const t of G.treasuresLeft(S.save)) if (Math.hypot(t.x - B.x, t.z - B.z) < sonar.range) g.fillText('✨', ...to(t.x, t.z + 4));
    }
  }
  arrow(g, N / 2, N / 2, B.heading, 16);
  g.restore();
  // le vent : une flèche en haut de la mini-carte (plus longue quand il souffle fort)
  const W = S.W, L = 14 + W.wind * 22, cx = N / 2, cy = 26, dx = Math.sin(W.windDir), dz = Math.cos(W.windDir);
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - dx * L / 2, cy - dz * L / 2); g.lineTo(cx + dx * L / 2, cy + dz * L / 2); g.stroke();
  g.beginPath(); g.arc(cx + dx * L / 2, cy + dz * L / 2, 5, 0, 7); g.fillStyle = '#ffffff'; g.fill();
}
export { esc };
