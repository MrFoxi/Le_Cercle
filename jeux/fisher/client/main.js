// Little Fisher : la partie. Navigation du bateau, caméra, pêche (lancer, touche, moulinet), villages (marché, chantier,
// habitants), cale, carnet, carte, trésors, heure et météo, sauvegarde dans le navigateur.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildBoat, createWake } from './boat.js';
import { fishImage } from './fishart.js';
import { startAudio, ambience, SFX, toggleMute, isMuted } from './audio.js';
import { ISLANDS, FISH, RARITY, UPGRADES, VILLAGES, ZONES, SPOTS, TREASURES, FOSSE, OPEN_SEA, PEOPLE } from './data.js';
import * as G from './game.js';
import { $, $$, esc, store } from '/shared/party.js';

const params = new URLSearchParams(location.search);

/* ---------------- Rendu ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 6000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let world, boat, wake;
let save = G.loadSave(store.get('fisher-save'));
const B = { x: 0, z: 0, heading: 0, speed: 0, turn: 0, docked: null, dockAnim: 0, camHeading: 0 };
const W = { kind: 'clair', left: 160 };            // météo en cours et temps restant (s)
const F = { phase: 'idle' };                         // la pêche en cours
let mode = 'title', panel = null, time = 0;
const persist = () => { save.boat = { x: B.x, z: B.z, heading: B.heading }; store.set('fisher-save', JSON.stringify(save)); };

/* ---------------- Petits outils d'interface ---------------- */
function toast(html, ms = 3800) {
  const li = document.createElement('li'); li.innerHTML = html; $('#toasts').prepend(li);
  while ($('#toasts').children.length > 4) $('#toasts').lastChild.remove();
  setTimeout(() => li.remove(), ms);
}
let placeTimer = 0;
function banner(title, sub = '') {
  $('#place b').textContent = title; $('#place small').textContent = sub;
  $('#place').classList.add('on'); clearTimeout(placeTimer); placeTimer = setTimeout(() => $('#place').classList.remove('on'), 3200);
}
const coins = n => `${n.toLocaleString('fr-FR')} 🪙`;
const rarityTag = f => `<span class="rar" style="background:${RARITY[f.rarity].color}">${RARITY[f.rarity].name}</span>`;
const WHEN = { jour: 'le jour', nuit: 'la nuit (avec une lanterne)', crepuscule: 'à l’aube et au crépuscule', toujours: 'à toute heure' };
const WEATHER = { clair: 'Beau temps', nuageux: 'Nuageux', pluie: 'Pluie', brume: 'Brume' };
const right = h => ({ x: -Math.cos(h), z: Math.sin(h) });
const fwd = h => ({ x: Math.sin(h), z: Math.cos(h) });

/* ---------------- Clavier, souris, tactile ---------------- */
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea')) return;
  if (mode !== 'sail') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') { if (panel) closePanel(); return; }
  if ($('#catch').hidden === false) { if (['Space', 'Enter', 'KeyE'].includes(e.code)) closeCatch(); return; }
  if (e.code === 'KeyI') return togglePanel('inv');
  if (e.code === 'KeyC') return togglePanel('book');
  if (e.code === 'KeyM' || e.code === 'Semicolon') return togglePanel('map');
  if (panel) return;
  keys.add(e.code);
  if (e.code === 'Space') fishAction();
  if (e.code === 'KeyE') interact();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const touch = { x: 0, y: 0 };
const coarse = matchMedia('(pointer: coarse)').matches;
{
  const stick = $('#stick'), knob = stick.querySelector('i');
  let id = null;
  const move = e => {
    const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), m = r.width / 2, l = Math.hypot(dx, dy), k = l > m ? m / l : 1;
    touch.x = dx * k / m; touch.y = dy * k / m; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); move(e); });
  stick.addEventListener('pointermove', e => e.pointerId === id && move(e));
  const end = () => { id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  $('#tFish').onclick = () => fishAction();
  $('#tAct').onclick = () => interact();
}
function input() {
  const k = c => keys.has(c);
  let throttle = (k('KeyW') || k('KeyZ') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 0.45 : 0) - touch.y;
  let steer = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('KeyQ') || k('ArrowLeft') ? 1 : 0) + touch.x;
  const gp = navigator.getGamepads?.()[0];
  if (gp) { if (Math.abs(gp.axes[0]) > 0.15) steer = gp.axes[0]; const t = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0) * 0.45; if (Math.abs(t) > 0.05) throttle = t; }
  return { throttle: Math.max(-0.45, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)) };
}
// Caméra : glisser pour tourner autour du bateau, molette pour zoomer
const cam = { dist: 24, yawOff: 0, pitch: 0.4, drag: null };
$('#view').addEventListener('pointerdown', e => { if (mode === 'sail' && e.pointerType === 'mouse') cam.drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!cam.drag) return; cam.yawOff -= (e.clientX - cam.drag.x) * 0.006; cam.pitch = Math.max(0.12, Math.min(1.1, cam.pitch + (e.clientY - cam.drag.y) * 0.004)); cam.drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => (cam.drag = null));
$('#view').addEventListener('wheel', e => { cam.dist = Math.max(10, Math.min(60, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

/* ---------------- Fenêtres ---------------- */
function openPanel(id) {
  for (const o of ['village', 'inv', 'book', 'map']) $(`#${o}`).hidden = o !== id;
  panel = id; keys.clear(); SFX.open();
  ({ inv: renderInv, book: renderBook, map: renderMap })[id]?.();
}
function closePanel() {
  if (!panel) return;
  $(`#${panel}`).hidden = true;
  if (panel === 'village') undock();
  panel = null; persist();
}
const togglePanel = id => (panel === id ? closePanel() : panel === 'village' ? null : openPanel(id));
$$('[data-close]').forEach(b => (b.onclick = closePanel));
$$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o && o.id !== 'catch') closePanel(); }));
$('#bInv').onclick = () => togglePanel('inv');
$('#bBook').onclick = () => togglePanel('book');
$('#bMap').onclick = () => togglePanel('map');
$('#minimap').onclick = () => togglePanel('map');
$('#bMute').onclick = () => { $('#bMute').textContent = toggleMute() ? '🔇' : '🔊'; };
$('#bMute').textContent = isMuted() ? '🔇' : '🔊';

/* ---------------- Village : accoster, marché, chantier, habitants ---------------- */
const nearDock = () => world.docks.find(d => Math.hypot(d.x - B.x, d.z - B.z) < 18);
function interact() {
  if (mode !== 'sail' || panel || F.phase === 'reel') return;
  const d = nearDock();
  if (!d) return;
  if (Math.abs(B.speed) > 6) return toast('Ralentis pour accoster');
  stopFishing();
  B.docked = d; B.dockAnim = 0; B.speed = 0;
  SFX.horn();
  setTimeout(() => openVillage(d.village), 450);
}
function undock() { B.docked = null; }
let vTab = 'market';
function openVillage(id) {
  const v = VILLAGES[id];
  $('#vName').textContent = `⚓ ${v.name}`;
  const tabs = [v.market && ['market', '🐟 Marché'], v.shop && ['shop', '🛠️ Chantier naval'], ['people', '👋 Habitants']].filter(Boolean);
  if (!tabs.some(([t]) => t === vTab)) vTab = tabs[0][0];
  $('#vTabs').innerHTML = tabs.map(([t, l]) => `<button class="${t === vTab ? 'on' : ''}" data-tab="${t}">${l}</button>`).join('');
  $('#vTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { vTab = b.dataset.tab; openVillage(id); } };
  $('#village').dataset.v = id;
  if (panel !== 'village') openPanel('village');
  ({ market: renderMarket, shop: renderShop, people: renderPeople })[vTab](id);
}
function renderMarket(id) {
  const rows = save.cargo.map((f, k) => { const d = G.fishById(f.id); return `<li><img src="${fishImage(d)}" alt=""><div class="grow"><b>${esc(d.name)}</b> ${rarityTag(d)}<small>${f.size} cm</small></div><span class="price">${coins(G.priceAt(f, id))}</span><button class="small ghost" data-sell="${k}">Vendre</button></li>`; });
  const total = save.cargo.reduce((a, f) => a + G.priceAt(f, id), 0);
  $('#vBody').innerHTML = `${VILLAGES[id].market > 1 ? '<p class="hint">Ici, on paie 10 % de plus qu’à Port-Galet.</p>' : ''}
    ${rows.length ? `<ul class="list">${rows.join('')}</ul>` : '<p class="empty">Ta cale est vide. Va pêcher !</p>'}
    <div class="sum"><span>Ton argent : <b>${coins(save.money)}</b></span>${rows.length ? `<button class="primary" id="sellAll">Tout vendre · ${coins(total)}</button>` : ''}</div>`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-sell]');
    if (b) gain(G.sell(save, id, +b.dataset.sell));
    if (e.target.id === 'sellAll') gain(G.sell(save, id));
    if (b || e.target.id === 'sellAll') renderMarket(id);
  };
}
function gain(n) { if (!n) return; SFX.coin(); $('#hMoney').classList.remove('bump'); void $('#hMoney').offsetWidth; $('#hMoney').classList.add('bump'); persist(); }
function renderShop() {
  $('#vBody').innerHTML = `<p class="hint">Joseph améliore ton bateau. Chaque amélioration se voit dessus !</p><ul class="list">${Object.entries(UPGRADES).map(([key, u]) => {
    const cur = G.lvl(save, key), next = G.nextUpgrade(save, key);
    return `<li class="up"><span style="font-size:1.8rem">${u.icon}</span><div class="grow"><b>${u.name} : ${esc(cur.name)}</b>
      <div class="lv">${u.levels.map((_, k) => `<i class="${k <= save.levels[key] ? 'on' : ''}"></i>`).join('')}</div>
      ${next ? `<small>Ensuite : ${esc(next.name)}${next.desc ? ` · ${esc(next.desc)}` : ''}${next.speed ? ` · ${next.speed} nœuds` : ''}${next.slots ? ` · ${next.slots} places` : ''}</small>` : '<small>Au maximum !</small>'}</div>
      ${next ? `<button class="small primary" data-buy="${key}" ${save.money < next.cost ? 'disabled' : ''}>${coins(next.cost)}</button>` : ''}</li>`;
  }).join('')}</ul><div class="sum"><span>Ton argent : <b>${coins(save.money)}</b></span></div>`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const err = G.buy(save, b.dataset.buy);
    if (err) return toast(err);
    SFX.upgrade(); boat.setLevels(save.levels); persist();
    toast(`✨ ${UPGRADES[b.dataset.buy].name} : ${esc(G.lvl(save, b.dataset.buy).name)} !`);
    renderShop();
  };
}
function renderPeople(id) {
  const folks = G.peopleOf(id).map(p => {
    const q = G.questOf(save, p), done = p.quests.filter(x => save.quests[x.id]).length;
    const quest = q ? `<div class="quest">📜 ${esc(q.text)} <b>(+${coins(q.reward)})</b><br>${G.questReady(save, q) ? `<button class="small primary" data-quest="${p.id}">${q.type === 'catch' ? 'Donner le poisson' : q.type === 'find' ? 'Rendre l’objet' : 'C’est fait !'}</button>` : `<small>${q.type === 'sell' ? `Vendus : ${Math.min(save.sold, q.count)}/${q.count}` : 'En cours…'}</small>`}</div>`
      : `<div class="quest done">Merci pour tout, l’ami ! (${done}/${p.quests.length} missions)</div>`;
    return `<li class="person"><span class="face">${p.face}</span><div class="grow"><b>${esc(p.name)}</b> <small>${esc(p.role)}</small><q>${esc(p.hello)}</q>${quest}</div></li>`;
  });
  $('#vBody').innerHTML = `<ul class="list">${folks.join('')}</ul>
    <div class="waits"><span class="hint">⏳ Attendre au port :</span>${[['aube', 0.25], ['midi', 0.5], ['soir', 0.78], ['nuit', 0.95]].map(([l, t]) => `<button class="small ghost" data-wait="${t}">${l}</button>`).join('')}</div>`;
  $('#vBody').onclick = e => {
    const w = e.target.closest('[data-wait]');
    if (w) { save.time = +w.dataset.wait; toast(`⏳ Il est ${G.clock(save.time)}.`); persist(); return; }
    const b = e.target.closest('[data-quest]'); if (!b) return;
    const p = PEOPLE.find(x => x.id === b.dataset.quest), q = G.questOf(save, p);
    if (G.completeQuest(save, q)) { SFX.upgrade(); gain(1); toast(`${p.face} <b>${esc(p.name)}</b> : « ${esc(q.done)} » <b>+${coins(q.reward)}</b>`, 6000); }
    renderPeople(id);
  };
}

/* ---------------- Cale, carnet, carte ---------------- */
function renderInv() {
  const items = save.items.map(id => TREASURES.find(t => t.item === id)).filter(Boolean);
  $('#invBody').innerHTML = `<p>Argent : <b>${coins(save.money)}</b> · Cale : <b>${save.cargo.length}/${G.slots(save)}</b> · Espèces : <b>${G.catalogCount(save)}/${FISH.length}</b></p>
    ${save.cargo.length ? `<ul class="list">${save.cargo.map((f, k) => { const d = G.fishById(f.id); return `<li><img src="${fishImage(d)}" alt=""><div class="grow"><b>${esc(d.name)}</b> ${rarityTag(d)}<small>${f.size} cm · environ ${coins(f.price)}</small></div><button class="small ghost" data-release="${k}" title="Le relâcher">🌊 Relâcher</button></li>`; }).join('')}</ul>` : '<p class="empty">Rien dans la cale pour l’instant.</p>'}
    ${items.length ? `<h3>Objets trouvés</h3><ul class="list">${items.map(t => `<li><span style="font-size:1.6rem">${t.kind === 'bouteille' ? '🍾' : '📦'}</span><div class="grow"><b>${esc(t.name)}</b><small>${esc(t.note)}</small></div></li>`).join('')}</ul>` : ''}
    <h3>Ton bateau</h3><ul class="list">${Object.entries(UPGRADES).map(([k, u]) => `<li><span style="font-size:1.4rem">${u.icon}</span><div class="grow"><b>${esc(G.lvl(save, k).name)}</b><small>${u.name}</small></div></li>`).join('')}</ul>`;
  $('#invBody').onclick = e => { const b = e.target.closest('[data-release]'); if (b) { save.cargo.splice(+b.dataset.release, 1); SFX.splash(); persist(); renderInv(); } };
}
let bookSel = null;
function renderBook() {
  $('#bookCount').textContent = `${G.catalogCount(save)}/${FISH.length} espèces`;
  const sel = bookSel && G.fishById(bookSel), c = sel && save.catalog[sel.id];
  const detail = sel ? `<div class="detail"><img src="${fishImage(sel, !c)}" alt=""><div><h3>${c ? esc(sel.name) : '???'} ${rarityTag(sel)}</h3>
    <p class="hint">${c ? esc(sel.desc) : 'Pas encore pêché. Voici où chercher…'}</p>
    <dl><dt>Où</dt><dd>${sel.zones.map(z => ZONES[z]).join(', ')}</dd><dt>Quand</dt><dd>${WHEN[sel.when]}${sel.weather ? `, par temps de ${sel.weather}` : ''}</dd>
    ${sel.minRod ? `<dt>Canne</dt><dd>${esc(UPGRADES.canne.levels[sel.minRod].name)} au moins</dd>` : ''}
    <dt>Valeur</dt><dd>environ ${coins(sel.price)}</dd>${c ? `<dt>Pêchés</dt><dd>${c.count} · record ${c.best} cm</dd>` : ''}</dl></div></div>` : '<p class="hint">Touche une espèce pour voir où et quand la pêcher.</p>';
  $('#bookBody').innerHTML = detail + `<div class="bookGrid">${FISH.map(f => { const k = save.catalog[f.id]; return `<button class="fishCard ${k ? '' : 'unknown'}" data-fish="${f.id}"><img src="${fishImage(f, !k)}" alt=""><b>${k ? esc(f.name) : '???'}</b>${rarityTag(f)}</button>`; }).join('')}</div>`;
  $('#bookBody').onclick = e => { const b = e.target.closest('[data-fish]'); if (b) { bookSel = b.dataset.fish; renderBook(); $('#book .panel').scrollTop = 0; } };
}
// Carte : le relief échantillonné une fois, puis les noms, les ports, les remous et le bateau.
const MAP_SPAN = 2300, mapLand = document.createElement('canvas');
function buildMapLand() {
  const N = 260; mapLand.width = mapLand.height = N;
  const g = mapLand.getContext('2d'), img = g.createImageData(N, N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const h = world.heightAt((c + 0.5) / N * MAP_SPAN - MAP_SPAN / 2, (r + 0.5) / N * MAP_SPAN - MAP_SPAN / 2);
    const col = h > 14 ? [70, 128, 72] : h > 1.5 ? [112, 178, 92] : h > -0.5 ? [242, 224, 168] : h > -6 ? [96, 212, 204] : h > -30 ? [52, 148, 190] : [28, 70, 128];
    img.data.set([...col, 255], (r * N + c) * 4);
  }
  g.putImageData(img, 0, 0);
}
const toMap = (x, z, S) => [(x / MAP_SPAN + 0.5) * S, (z / MAP_SPAN + 0.5) * S];
function renderMap() {
  const cv = $('#mapCanvas'), g = cv.getContext('2d'), S = cv.width;
  g.imageSmoothingEnabled = true; g.drawImage(mapLand, 0, 0, S, S);
  g.setLineDash([10, 8]); g.lineWidth = 2;
  g.strokeStyle = 'rgba(242,193,78,.9)'; g.beginPath(); g.arc(...toMap(0, 0, S), OPEN_SEA / MAP_SPAN * S, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(155,108,240,.9)'; g.beginPath(); g.arc(...toMap(FOSSE.x, FOSSE.z, S), (FOSSE.r + 40) / MAP_SPAN * S, 0, 7); g.stroke();
  g.setLineDash([]);
  g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'center';
  const label = (t, x, y, col = '#1d3b4f') => { g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y); };
  for (const s of SPOTS) { const [x, y] = toMap(s.x, s.z, S); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); }
  for (const i of ISLANDS.filter(i => i.name)) { const [x, y] = toMap(i.x, i.z, S); label(save.seen.includes(i.id) ? i.name : '? ? ?', x, y - i.r / MAP_SPAN * S - 8); }
  label(save.seen.includes('fosse') ? 'La Fosse' : '? ? ?', ...toMap(FOSSE.x, FOSSE.z + 10, S), '#4b2a8a');
  for (const d of world.docks) { const [x, y] = toMap(d.x, d.z, S); g.font = '20px sans-serif'; g.fillText('⚓', x, y + 7); g.font = '600 18px Fredoka, sans-serif'; }
  arrow(g, ...toMap(B.x, B.z, S), B.heading, 14);
  $('#mapHint').innerHTML = `Pointillés jaunes : la haute mer (il faut la <b>coque renforcée</b>) · violets : <b>la Fosse</b> (coque de haute mer) · cercles blancs : des remous où les poissons rares mordent plus. ${G.treasuresLeft(save).length} trésors flottent encore quelque part…`;
}
function arrow(g, x, y, h, s) {
  g.save(); g.translate(x, y); g.rotate(-h + Math.PI);
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.65, s * 0.7); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.65, s * 0.7); g.closePath();
  g.fillStyle = '#ff7a59'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.fill(); g.restore();
}
function drawMinimap() {
  const cv = $('#minimap'), g = cv.getContext('2d'), S = cv.width, R = 320; // mètres visibles de chaque côté
  const N = mapLand.width, px = (B.x / MAP_SPAN + 0.5) * N, pz = (B.z / MAP_SPAN + 0.5) * N, half = R / MAP_SPAN * N;
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
  g.fillStyle = '#1c528c'; g.fillRect(0, 0, S, S);
  g.drawImage(mapLand, px - half, pz - half, half * 2, half * 2, 0, 0, S, S);
  const to = (x, z) => [S / 2 + (x - B.x) / R * S / 2, S / 2 + (z - B.z) / R * S / 2];
  for (const s of SPOTS) { const [x, y] = to(s.x, s.z); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke(); }
  for (const d of world.docks) { const [x, y] = to(d.x, d.z); g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillText('⚓', x, y + 9); }
  arrow(g, S / 2, S / 2, B.heading, 16);
  g.restore();
}

/* ---------------- Pêche ---------------- */
const bobber = new THREE.Group();
{
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8402f' }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), new THREE.MeshStandardMaterial({ color: '#e8402f' })); stick.position.y = 0.35;
  bobber.add(top, bot, stick); bobber.visible = false; scene.add(bobber);
}
const LINE_N = 18, lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.85 }));
line.frustumCulled = false; line.visible = false; scene.add(line);
const tipPos = new THREE.Vector3();

function fishCtx(x, z) { return { zone: G.zoneAt(x, z), time: save.time, weather: W.kind, rod: save.levels.canne, lantern: save.levels.lanterne }; }
const spotNear = (x, z) => SPOTS.some(s => Math.hypot(s.x - x, s.z - z) < 15);
function fishAction() {
  if (mode !== 'sail' || panel || B.docked) return;
  if (F.phase === 'idle') return cast();
  if (F.phase === 'bite') return startReel();
  if (F.phase === 'reel') return reelPress();
  if (F.phase === 'wait' || F.phase === 'cast') { stopFishing(); toast('Tu remontes ta ligne.'); }
}
function cast() {
  if (Math.abs(B.speed) > 2.5) return toast('Arrête le bateau pour pêcher');
  if (G.cargoFull(save)) return toast('Ta cale est pleine ! Va vendre tes poissons (ou relâches-en un).');
  const r = right(B.heading), f = fwd(B.heading), tx = B.x + r.x * 9 + f.x * 2, tz = B.z + r.z * 9 + f.z * 2;
  if (world.heightAt(tx, tz) > -0.6) return toast('Trop près du bord : éloigne-toi un peu de la côte');
  startAudio(); SFX.cast();
  boat.rodTip.getWorldPosition(tipPos);
  Object.assign(F, { phase: 'cast', t: 0, from: tipPos.clone(), tx, tz, spot: spotNear(tx, tz), fish: null, nibble: 0 });
  bobber.visible = line.visible = true;
}
function startWaiting() {
  F.phase = 'wait'; F.t = 0;
  F.fish = G.pickFish(fishCtx(F.tx, F.tz), Math.random, F.spot);
  F.delay = F.fish ? G.biteDelay(F.fish, Math.random, F.spot) : Infinity;
}
function startReel() {
  const s = G.reelSpec(F.fish, save.levels.canne);
  Object.assign(F, { phase: 'reel', spec: s, hits: 0, misses: 0, needle: Math.random() * Math.PI * 2, dir: 1, arcAt: Math.random() * Math.PI * 2, flash: 0 });
  $('#bite').classList.remove('on'); $('#reel').hidden = false;
  SFX.splash();
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function reelPress() {
  const s = F.spec;
  if (angDiff(F.needle, F.arcAt) <= s.arc / 2) {
    F.hits++; F.flash = 1; F.flashOk = true; SFX.hit(); splashAt(bobber.position, 0.8);
    if (F.hits >= s.hits) return landed();
    F.arcAt = F.needle + Math.PI * (0.6 + Math.random() * 0.8);
    if (F.fish.difficulty >= 3) F.dir *= -1;
  } else {
    F.misses++; F.flash = 1; F.flashOk = false; SFX.miss();
    if (F.misses > s.misses) { SFX.escape(); toast(`Oh non… le poisson s’est échappé !`); stopFishing(); }
  }
}
function landed() {
  const f = F.fish, res = G.landFish(save, f);
  jumpFish(f, bobber.position.clone());
  SFX.catch(f.rarity === 'rare' || f.rarity === 'legende');
  stopFishing();
  $('#cTag').textContent = res.first ? '✨ Nouvelle espèce !' : res.record ? '🏆 Nouveau record de taille !' : '';
  $('#cImg').src = fishImage(f);
  $('#cName').innerHTML = `${esc(f.name)}`;
  $('#cInfo').innerHTML = `${rarityTag(f)} · <b>${res.fish.size} cm</b> · environ <span class="price">${coins(res.fish.price)}</span>`;
  $('#cDesc').textContent = f.desc;
  $('#catch').hidden = false;
  persist();
  if (G.cargoFull(save)) setTimeout(() => toast('Ta cale est pleine : direction le marché !'), 600);
}
function closeCatch() { $('#catch').hidden = true; }
$('#cOk').onclick = closeCatch;
function stopFishing() {
  F.phase = 'idle'; bobber.visible = line.visible = false;
  $('#bite').classList.remove('on'); $('#reel').hidden = true;
}
function updateFishing(dt, amp) {
  if (F.phase === 'idle') return;
  F.t += dt;
  boat.rodTip.getWorldPosition(tipPos);
  const wv = world.waveAt(F.tx, F.tz, time, amp).h;
  if (F.phase === 'cast') {
    const k = Math.min(1, F.t / 0.7);
    bobber.position.set(F.from.x + (F.tx - F.from.x) * k, F.from.y + (wv - F.from.y) * k + Math.sin(k * Math.PI) * 5, F.from.z + (F.tz - F.from.z) * k);
    if (k >= 1) { SFX.plop(); splashAt(bobber.position, 1); startWaiting(); }
  } else if (F.phase === 'wait') {
    F.nibble = Math.max(0, F.nibble - dt * 4);
    if (F.fish && Math.random() < dt * 0.35 && F.t < F.delay - 1) F.nibble = 1; // le poisson goûte l'appât
    bobber.position.set(F.tx, wv - F.nibble * 0.15, F.tz);
    if (F.t > F.delay) { F.phase = 'bite'; F.t = 0; SFX.bite(); splashAt(bobber.position, 0.7); $('#bite').classList.add('on'); }
  } else if (F.phase === 'bite') {
    bobber.position.set(F.tx + Math.sin(F.t * 40) * 0.08, wv - 0.45 + Math.sin(F.t * 25) * 0.12, F.tz);
    if (F.t > 1.35 - F.fish.difficulty * 0.09) { $('#bite').classList.remove('on'); toast('Trop tard, il a filé…'); startWaiting(); }
  } else if (F.phase === 'reel') {
    const s = F.spec;
    F.needle += F.dir * s.speed * Math.PI * 2 * dt;
    F.flash = Math.max(0, F.flash - dt * 3);
    const k = F.hits / s.hits, bx = F.tx + (B.x - F.tx) * k * 0.6, bz = F.tz + (B.z - F.tz) * k * 0.6;
    bobber.position.set(bx + Math.sin(F.t * 9) * 0.3, wv - 0.3, bz + Math.cos(F.t * 7) * 0.3);
    drawReel();
  }
  // la ligne : du bout de la canne au bouchon, avec un peu de mou
  const p = lineGeo.attributes.position, sag = F.phase === 'reel' ? 0.2 : F.phase === 'cast' ? 0 : 1.2;
  for (let k = 0; k < LINE_N; k++) {
    const t = k / (LINE_N - 1);
    p.setXYZ(k, tipPos.x + (bobber.position.x - tipPos.x) * t, tipPos.y + (bobber.position.y + 0.3 - tipPos.y) * t - Math.sin(t * Math.PI) * sag, tipPos.z + (bobber.position.z - tipPos.z) * t);
  }
  p.needsUpdate = true;
}
function drawReel() {
  const cv = $('#reelCanvas'), g = cv.getContext('2d'), S = cv.width, c = S / 2, R = S * 0.38, s = F.spec;
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  g.lineWidth = 22; g.strokeStyle = 'rgba(29,59,79,.55)'; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
  g.strokeStyle = F.flash && !F.flashOk ? '#ff7a59' : '#5fe08a'; g.beginPath(); g.arc(c, c, R, F.arcAt - s.arc / 2, F.arcAt + s.arc / 2); g.stroke();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(F.needle) * (R + 14), c + Math.sin(F.needle) * (R + 14)); g.stroke();
  g.fillStyle = '#fbf5e9'; g.beginPath(); g.arc(c, c, 34, 0, 7); g.fill();
  g.fillStyle = '#1d3b4f'; g.font = '700 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`${F.hits}/${s.hits}`, c, c - 2);
  g.font = '600 15px Fredoka, sans-serif'; g.fillStyle = '#ff7a59';
  g.fillText('✕'.repeat(F.misses) + '·'.repeat(s.misses + 1 - F.misses), c, c + 22);
  if (F.flash) { g.globalAlpha = F.flash * 0.5; g.fillStyle = F.flashOk ? '#5fe08a' : '#ff7a59'; g.beginPath(); g.arc(c, c, R + 18, 0, 7); g.fill(); g.globalAlpha = 1; }
}

/* ---------------- Petits effets : éclaboussures, poisson qui saute ---------------- */
const fx = [];
const ringGeo = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
function splashAt(p, size = 1) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  m.position.set(p.x, p.y + 0.05, p.z); scene.add(m);
  fx.push({ t: 0, life: 1.1, update: (k) => { m.scale.setScalar(0.5 + k * 4 * size); m.material.opacity = 0.8 * (1 - k); }, done: () => { scene.remove(m); m.material.dispose(); } });
}
function jumpFish(f, from) {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: f.look.body, roughness: 0.4, metalness: 0.2 }));
  body.scale.set(0.45, 0.6, 1.3); const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 4), new THREE.MeshStandardMaterial({ color: f.look.accent }));
  tail.rotation.x = -Math.PI / 2; tail.position.z = -0.85; g.add(body, tail); scene.add(g);
  splashAt(from, 1.4);
  fx.push({ t: 0, life: 0.9, update: (k) => {
    g.position.set(from.x + (B.x - from.x) * k, from.y + Math.sin(k * Math.PI) * 4 + k * 1.2, from.z + (B.z - from.z) * k);
    g.rotation.set(k * 6, Math.atan2(B.x - from.x, B.z - from.z), Math.sin(k * 30) * 0.4);
  }, done: () => scene.remove(g) });
}

/* ---------------- Navigation ---------------- */
let bumpAt = 0, gateAt = 0;
function blocked(x, z) {
  const f = fwd(B.heading);
  for (const k of [3.3, 0, -2.9]) if (world.heightAt(x + f.x * k, z + f.z * k) > -0.9) return true;
  for (const o of world.obstacles) {
    const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
    for (const k of [2.8, -2.4]) {
      const px = x + f.x * k, pz = z + f.z * k, t = l2 ? Math.max(0, Math.min(1, ((px - o.ax) * dx + (pz - o.az) * dz) / l2)) : 0;
      if (Math.hypot(px - (o.ax + dx * t), pz - (o.az + dz * t)) < o.w + 1.2) return true;
    }
  }
  return false;
}
function sail(dt) {
  if (B.docked) { // glisse jusqu'au ponton
    const d = B.docked; B.dockAnim = Math.min(1, B.dockAnim + dt * 1.2);
    const k = 1 - Math.pow(1 - B.dockAnim, 3), dh = Math.atan2(Math.sin(d.heading - B.heading), Math.cos(d.heading - B.heading));
    B.x += (d.x - B.x) * k * 0.2; B.z += (d.z - B.z) * k * 0.2; B.heading += dh * k * 0.2; B.speed = 0; B.turn = 0;
    return { throttle: 0 };
  }
  const reel = F.phase === 'reel';
  const inp = panel || reel || !$('#catch').hidden ? { throttle: 0, steer: 0 } : input();
  if (Math.abs(inp.throttle) > 0.2 && (F.phase === 'wait' || F.phase === 'bite')) { stopFishing(); toast('Tu remontes ta ligne.'); }
  const max = G.lvl(save, 'moteur').speed, target = inp.throttle * max;
  B.speed += (target - B.speed) * Math.min(1, dt * (Math.abs(target) > Math.abs(B.speed) ? 0.6 : 0.45));
  const rate = (0.35 + 0.6 * Math.min(1, Math.abs(B.speed) / 7)) * (B.speed < -0.3 ? -1 : 1);
  B.turn += (-inp.steer * rate - B.turn) * Math.min(1, dt * 3);
  const oldH = B.heading; B.heading += B.turn * dt;
  const f = fwd(B.heading); let nx = B.x + f.x * B.speed * dt, nz = B.z + f.z * B.speed * dt;
  if (blocked(nx, nz)) {
    B.heading = oldH;
    if (blocked(B.x, B.z)) { // coincé : on s'écarte de la côte
      const h = world.heightAt, gx = h(B.x + 2, B.z) - h(B.x - 2, B.z), gz = h(B.x, B.z + 2) - h(B.x, B.z - 2), l = Math.hypot(gx, gz) || 1;
      nx = B.x - gx / l * 3 * dt * 4; nz = B.z - gz / l * 3 * dt * 4;
    } else { nx = B.x; nz = B.z; }
    if (Math.abs(B.speed) > 3 && time - bumpAt > 0.6) { bumpAt = time; SFX.bump(); splashAt({ x: B.x + f.x * 3.5, y: 0, z: B.z + f.z * 3.5 }, 1.5); }
    B.speed *= -0.25;
  }
  const need = G.hullNeeded(nx, nz);
  if (need > save.levels.coque) {
    nx = B.x; nz = B.z; B.speed *= -0.3;
    if (time - gateAt > 5) { gateAt = time; SFX.splash(); toast(need === Infinity ? '🌫️ Une brume épaisse : impossible d’aller plus loin.' : `🌊 Les vagues sont trop fortes pour ta coque ! Il faut la <b>${esc(UPGRADES.coque.levels[need].name)}</b> (chantier de Port-Galet).`, 5000); }
  }
  B.x = nx; B.z = nz;
  return inp;
}

/* ---------------- Découvertes : îles, zones, trésors ---------------- */
let zoneNow = null, zoneSince = 0, nightWarned = false;
function explore() {
  for (const i of ISLANDS) if (i.name && Math.hypot(i.x - B.x, i.z - B.z) < i.r + 95 && G.see(save, i.id)) { banner(i.name, 'Nouvelle île découverte !'); toast(`🗺️ ${esc(i.desc)}`, 6000); questHint(i.id); persist(); }
  if (Math.hypot(FOSSE.x - B.x, FOSSE.z - B.z) < FOSSE.r && G.see(save, 'fosse')) { banner('La Fosse', 'Des eaux sans fond…'); questHint('fosse'); persist(); }
  const z = G.zoneAt(B.x, B.z);
  if (z !== zoneNow) { zoneNow = z; zoneSince = time; }
  else if (zoneSince && time - zoneSince > 2.5) { zoneSince = 0; if (!$('#place').classList.contains('on')) banner(ZONES[z], z === 'large' ? 'Loin des côtes' : ''); }
  for (const t of G.treasuresLeft(save)) {
    if (Math.hypot(t.x - B.x, t.z - B.z) > 7) continue;
    G.takeTreasure(save, t); world.hideTreasure(t.id); SFX.treasure();
    toast(`${t.kind === 'bouteille' ? '🍾' : '📦'} <b>${t.name ? esc(t.name) : t.kind === 'bouteille' ? 'Une bouteille à la mer !' : 'Un coffre !'}</b> ${esc(t.note)}${t.money ? ` <b>+${coins(t.money)}</b>` : ''}`, 7000);
    if (t.money) gain(t.money);
    persist();
  }
  if (G.period(save.time) === 'nuit' && !save.levels.lanterne && !nightWarned) { nightWarned = true; toast('🌙 La nuit tombe. Avec une <b>lanterne</b> (chantier de Port-Galet), les poissons de nuit viendraient mordre…', 6000); }
}
function questHint(place) {
  const p = PEOPLE.find(x => x.quests.some(q => q.type === 'see' && q.place === place && G.questOf(save, x) === q));
  if (p) toast(`📜 Mission accomplie : retourne voir <b>${esc(p.name)}</b> (${esc(VILLAGES[p.village].name)}).`, 5000);
}

/* ---------------- Interface en mer ---------------- */
function hud() {
  $('#hMoney').textContent = `🪙 ${save.money.toLocaleString('fr-FR')}`;
  $('#hCargo').textContent = `🐟 ${save.cargo.length}/${G.slots(save)}`;
  const p = G.period(save.time), icon = W.kind === 'pluie' ? '🌧️' : W.kind === 'brume' ? '🌫️' : p === 'nuit' ? '🌙' : p === 'crepuscule' ? '🌅' : W.kind === 'nuageux' ? '⛅' : '☀️';
  $('#hClock').textContent = `${icon} ${G.clock(save.time)}`; $('#hClock').title = WEATHER[W.kind];
  let h = '';
  if (F.phase === 'wait') h = F.fish ? `Patience… <b>Espace</b> : remonter la ligne` : 'Rien ne mord ici pour l’instant… essaie ailleurs, ou à une autre heure';
  else if (F.phase === 'bite') h = '<b>Espace</b> : ferrer !';
  else if (F.phase === 'reel') h = '<b>Espace</b> quand l’aiguille est dans le vert';
  else if (!B.docked && nearDock()) h = `<b>E</b> : accoster à ${esc(nearDock().name)}`;
  else if (!B.docked && Math.abs(B.speed) < 2.5) h = `<b>Espace</b> : lancer la ligne${spotNear(B.x + right(B.heading).x * 9, B.z + right(B.heading).z * 9) ? ' · <b>un remous</b> : les rares mordent ici !' : ` · ${ZONES[G.zoneAt(B.x, B.z)]}`}`;
  else if (save.cargo.length === 0 && save.sold === 0) h = 'Arrête-toi et pêche avec <b>Espace</b> · les cercles blancs sur l’eau sont des remous';
  if ($('#hint').innerHTML !== h) $('#hint').innerHTML = h;
}

/* ---------------- Boucle ---------------- */
let last = performance.now(), hudAt = 0, mapAt = 0, exploreAt = 0;
const look = new THREE.Vector3(), want = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  const sailing = mode === 'sail' && !panel && $('#catch').hidden;
  if (sailing || mode === 'title') {
    save.time = G.advance(save.time, dt);
    if ((W.left -= dt) < 0) {
      const night = G.period(save.time) === 'nuit', r = Math.random();
      W.kind = r < 0.42 ? 'clair' : r < 0.66 ? 'nuageux' : r < (night ? 0.78 : 0.86) ? 'pluie' : 'brume';
      W.left = 110 + Math.random() * 150;
      if (mode === 'sail' && W.kind !== 'clair') toast({ nuageux: '⛅ Les nuages arrivent.', pluie: '🌧️ Il se met à pleuvoir… certains poissons adorent ça.', brume: '🌫️ La brume se lève sur l’archipel.' }[W.kind]);
    }
  }
  const amp = 1 + (W.kind === 'pluie' ? 0.9 : 0);
  const inp = mode === 'sail' ? sail(dt) : { throttle: 0 };
  // le bateau sur les vagues
  const w = world.waveAt(B.x, B.z, time, amp), f = fwd(B.heading), r = right(B.heading);
  boat.group.position.set(B.x, w.h + 0.05, B.z);
  boat.group.rotation.y = B.heading;
  const max = G.lvl(save, 'moteur').speed;
  boat.body.rotation.x = -Math.atan((w.dx * f.x + w.dz * f.z) * 1.4) - Math.max(0, B.speed) / max * 0.07;
  boat.body.rotation.z = -Math.atan((w.dx * r.x + w.dz * r.z) * 1.4) + B.turn * Math.abs(B.speed) / max * 0.12;
  boat.fisher.rotation.y = F.phase === 'idle' ? Math.sin(time * 0.3) * 0.4 : -Math.PI / 2 + 0.3;
  boat.tick(dt, world.state.night, inp.throttle ?? 0);
  wake.update(dt, B.x, B.z, B.heading, Math.abs(B.speed), (x, z) => world.waveAt(x, z, time, amp).h);
  updateFishing(dt, amp);
  for (let k = fx.length - 1; k >= 0; k--) { const e = fx[k]; e.t += dt; e.update(Math.min(1, e.t / e.life)); if (e.t >= e.life) { e.done(); fx.splice(k, 1); } }
  // caméra
  if (mode === 'title') {
    const a = time * 0.05;
    want.set(Math.sin(a) * 120 + 10, 45, Math.cos(a) * 120 + 60); look.set(0, 8, 40);
    camera.position.lerp(want, 1 - Math.exp(-dt * 2));
  } else {
    B.camHeading += Math.atan2(Math.sin(B.heading - B.camHeading), Math.cos(B.heading - B.camHeading)) * Math.min(1, dt * 2.2);
    if (!cam.drag && Math.abs(B.speed) > 3) cam.yawOff *= Math.exp(-dt * 0.8);
    const yaw = B.camHeading + Math.PI + cam.yawOff, dist = cam.dist * (F.phase !== 'idle' ? 0.9 : 1);
    want.set(B.x + Math.sin(yaw) * Math.cos(cam.pitch) * dist, Math.sin(cam.pitch) * dist + 3, B.z + Math.cos(yaw) * Math.cos(cam.pitch) * dist);
    const ground = world.heightAt(want.x, want.z) + 4; if (want.y < ground) want.y = ground;
    camera.position.lerp(want, 1 - Math.exp(-dt * 5));
    const tx = F.phase !== 'idle' ? (B.x + bobber.position.x) / 2 : B.x + f.x * 5, tz = F.phase !== 'idle' ? (B.z + bobber.position.z) / 2 : B.z + f.z * 5;
    look.lerp(want.set(tx, 2.2, tz), 1 - Math.exp(-dt * 6));
  }
  camera.lookAt(look);
  world.update(dt, time, save.time, W.kind, boat.group.position, camera);
  if (mode === 'sail') {
    if (now - hudAt > 150) { hudAt = now; hud(); }
    if (now - mapAt > 100) { mapAt = now; drawMinimap(); }
    if (now - exploreAt > 400) { exploreAt = now; if (!panel) explore(); }
    const near = Math.max(0, 1 - Math.min(...ISLANDS.map(i => Math.hypot(i.x - B.x, i.z - B.z) - i.r)) / 120);
    ambience(dt, { speed: Math.abs(B.speed), throttle: inp.throttle ?? 0, weather: W.kind, night: world.state.night > 0.5, nearLand: near, docked: !!B.docked });
  }
  renderer.render(scene, camera);
}

/* ---------------- Démarrage ---------------- */
function applySave() {
  const at = save.boat ?? world.docks.find(d => d.village === 'port'); // première partie : au ponton de Port-Galet
  Object.assign(B, { x: at.x, z: at.z, heading: at.heading, speed: 0, turn: 0, docked: null, camHeading: at.heading });
  boat.setLevels(save.levels);
  for (const g of world.treasures.values()) g.visible = true;
  for (const id of save.treasures) world.hideTreasure(id);
}
function play() {
  startAudio();
  mode = 'sail';
  $('#title').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !coarse;
  camera.position.set(B.x - Math.sin(B.heading) * 30, 14, B.z - Math.cos(B.heading) * 30);
  look.set(B.x, 2, B.z);
  zoneNow = G.zoneAt(B.x, B.z); zoneSince = 0;
  banner(save.sold || save.cargo.length ? 'Bon retour en mer !' : 'Port-Galet', save.sold || save.cargo.length ? G.clock(save.time) : 'Ton petit port, ton petit bateau. L’archipel t’attend.');
  if (!save.sold && !save.cargo.length) setTimeout(() => toast('🧔 Joseph : « Va pêcher un peu, puis reviens au ponton (<b>E</b>) vendre tes prises ! »', 7000), 1500);
}
$('#playBtn').onclick = play;
$('#newBtn').onclick = () => { if (!confirm('Recommencer une nouvelle partie ? Ta progression sera effacée.')) return; save = G.newSave(); persist(); applySave(); play(); };

setTimeout(() => {
  world = createWorld(renderer, scene);
  boat = buildBoat(); scene.add(boat.group);
  boat.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  wake = createWake(scene);
  buildMapLand();
  applySave();
  camera.position.set(140, 50, 160); look.set(0, 8, 40);
  $('#loading').hidden = true; $('#title').hidden = false;
  $('#newBtn').hidden = !(save.sold || save.cargo.length || save.earned);
  $('#playBtn').textContent = save.sold || save.cargo.length ? '⛵ Reprendre la mer' : '⛵ Prendre la mer';
  requestAnimationFrame(frame);
  if (params.has('debug')) window.lf = { get save() { return save; }, B, F, W, world, boat, cam, camera, play, openPanel, setTime: t => (save.time = t), fishAction, interact };
  if (params.has('play')) play();
}, 30);
addEventListener('beforeunload', () => mode === 'sail' && persist());
