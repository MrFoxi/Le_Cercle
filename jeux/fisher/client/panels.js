// Little Fisher : les fenêtres. Village (marché, boutique d'appâts et de plongée, chantier naval, habitants), cale, carnet, carte.
import { S, persist } from './state.js';
import * as G from './game.js';
import { FISH, UPGRADES, VILLAGES, ZONE_SHORT, TREASURES, PEOPLE, BAITS, BAIT_SHOPS, GEAR, FIGHTS } from './data.js';
import { fishImage } from './fishart.js';
import { SFX } from './audio.js';
import { toast, coins, rarityTag, gain, renderMap } from './hud.js';
import { $, $$, esc } from '/shared/party.js';

const WHEN = { jour: 'le jour', nuit: 'la nuit (lanterne ou appât lumineux)', crepuscule: 'à l’aube et au crépuscule', toujours: 'à toute heure' };

export function openPanel(id) {
  for (const o of ['village', 'inv', 'book', 'map']) $(`#${o}`).hidden = o !== id;
  S.panel = id; S.keys.clear(); SFX.open();
  ({ inv: renderInv, book: renderBook, map: renderMap })[id]?.();
}
export function closePanel() {
  if (!S.panel) return;
  $(`#${S.panel}`).hidden = true;
  if (S.panel === 'village') S.B.docked = null;
  S.panel = null; persist();
}
export const togglePanel = id => (S.panel === id ? closePanel() : S.panel === 'village' ? null : openPanel(id));
$$('[data-close]').forEach(b => (b.onclick = closePanel));
$$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o && o.id !== 'catch') closePanel(); }));

/* ---------------- Village ---------------- */
let vTab = 'market';
export function openVillage(id) {
  const v = VILLAGES[id];
  $('#vName').textContent = `⚓ ${v.name}`;
  const tabs = [v.market && ['market', '🐟 Marché'], (BAIT_SHOPS[id] || Object.values(GEAR).some(g => g.shop === id)) && ['bait', '🪱 Boutique'], v.shop && ['shop', '🛠️ Chantier naval'], ['people', '👋 Habitants']].filter(Boolean);
  if (!tabs.some(([t]) => t === vTab)) vTab = tabs[0][0];
  $('#vTabs').innerHTML = tabs.map(([t, l]) => `<button class="${t === vTab ? 'on' : ''}" data-tab="${t}">${l}</button>`).join('');
  $('#vTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { vTab = b.dataset.tab; openVillage(id); } };
  if (S.panel !== 'village') openPanel('village');
  ({ market: renderMarket, bait: renderBaitShop, shop: renderShop, people: renderPeople })[vTab](id);
}
const money = () => `<div class="sum"><span>Ton argent : <b>${coins(S.save.money)}</b></span></div>`;
function renderMarket(id) {
  const s = S.save;
  const rows = s.cargo.map((f, k) => { const d = G.fishById(f.id); return `<li><img src="${fishImage(d)}" alt=""><div class="grow"><b>${esc(d.name)}</b> ${rarityTag(d)}<small>${f.size} cm</small></div><span class="price">${coins(G.priceAt(f, id))}</span><button class="small ghost" data-sell="${k}">Vendre</button></li>`; });
  const total = s.cargo.reduce((a, f) => a + G.priceAt(f, id), 0);
  $('#vBody').innerHTML = `${VILLAGES[id].market > 1 ? '<p class="hint">Ici, on paie 10 % de plus qu’à Port-Galet.</p>' : ''}
    ${rows.length ? `<ul class="list">${rows.join('')}</ul>` : '<p class="empty">Ta cale est vide. Va pêcher !</p>'}
    <div class="sum"><span>Ton argent : <b>${coins(s.money)}</b></span>${rows.length ? `<button class="primary" id="sellAll">Tout vendre · ${coins(total)}</button>` : ''}</div>`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-sell]');
    if (b) gain(G.sell(s, id, +b.dataset.sell));
    if (e.target.id === 'sellAll') gain(G.sell(s, id));
    if (b || e.target.id === 'sellAll') { persist(); renderMarket(id); }
  };
}
function renderBaitShop(id) {
  const s = S.save, baits = BAIT_SHOPS[id] ?? [], gear = Object.entries(GEAR).filter(([, g]) => g.shop === id);
  $('#vBody').innerHTML = `<p class="hint">Chaque poisson a son appât préféré (voir le carnet) : avec lui, il mord trois fois plus souvent. Change d’appât avec la touche <b>B</b>.</p>
    <ul class="list">${baits.map(b => { const d = BAITS[b], owned = s.baits[b] ?? 0, done = d.forever && owned;
      return `<li><span style="font-size:1.8rem">${d.icon}</span><div class="grow"><b>${esc(d.name)}</b> ${d.forever ? '' : `<small>par ${d.pack} · tu en as ${owned}</small>`}<small>${esc(d.desc)}</small></div>
      ${done ? '<small>✓ À toi</small>' : `<button class="small primary" data-bait="${b}" ${s.money < d.cost ? 'disabled' : ''}>${coins(d.cost)}</button>`}</li>`; }).join('')}
    ${gear.map(([k, g]) => `<li><span style="font-size:1.8rem">${g.icon}</span><div class="grow"><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></div>
      ${s.gear[k] ? '<small>✓ À toi</small>' : `<button class="small primary" data-gear="${k}" ${s.money < g.cost ? 'disabled' : ''}>${coins(g.cost)}</button>`}</li>`).join('')}</ul>${money()}`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-bait]'), g = e.target.closest('[data-gear]');
    if (!b && !g) return;
    const err = b ? G.buyBait(s, b.dataset.bait, id) : G.buyGear(s, g.dataset.gear, id);
    if (err) return toast(err);
    SFX.coin(); persist();
    if (g) toast(`${GEAR[g.dataset.gear].icon} ${esc(GEAR[g.dataset.gear].desc)}`, 6000);
    renderBaitShop(id);
  };
}
function renderShop() {
  const s = S.save;
  $('#vBody').innerHTML = `<p class="hint">Joseph améliore ton bateau. Chaque amélioration se voit dessus !</p><ul class="list">${Object.entries(UPGRADES).map(([key, u]) => {
    const cur = G.lvl(s, key), next = G.nextUpgrade(s, key);
    return `<li class="up"><span style="font-size:1.8rem">${u.icon}</span><div class="grow"><b>${u.name} : ${esc(cur.name)}</b>
      <div class="lv">${u.levels.map((_, k) => `<i class="${k <= s.levels[key] ? 'on' : ''}"></i>`).join('')}</div>
      ${next ? `<small>Ensuite : ${esc(next.name)}${next.desc ? ` · ${esc(next.desc)}` : ''}${next.speed ? ` · ${next.speed} nœuds` : ''}${next.slots ? ` · ${next.slots} places` : ''}</small>` : '<small>Au maximum !</small>'}</div>
      ${next ? `<button class="small primary" data-buy="${key}" ${s.money < next.cost ? 'disabled' : ''}>${coins(next.cost)}</button>` : ''}</li>`;
  }).join('')}</ul>${money()}`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const err = G.buy(s, b.dataset.buy);
    if (err) return toast(err);
    SFX.upgrade(); S.boat.setLevels(s.levels); persist();
    toast(`✨ ${UPGRADES[b.dataset.buy].name} : ${esc(G.lvl(s, b.dataset.buy).name)} !`);
    renderShop();
  };
}
function renderPeople(id) {
  const s = S.save;
  const folks = G.peopleOf(id).map(p => {
    const q = G.questOf(s, p), done = p.quests.filter(x => s.quests[x.id]).length;
    const quest = q ? `<div class="quest">📜 ${esc(q.text)} <b>(+${coins(q.reward)})</b><br>${G.questReady(s, q) ? `<button class="small primary" data-quest="${p.id}">${q.type === 'catch' ? 'Donner le poisson' : q.type === 'find' ? 'Rendre l’objet' : 'C’est fait !'}</button>` : `<small>${q.type === 'sell' ? `Vendus : ${Math.min(s.sold, q.count)}/${q.count}` : 'En cours…'}</small>`}</div>`
      : `<div class="quest done">Merci pour tout, l’ami ! (${done}/${p.quests.length} missions)</div>`;
    return `<li class="person"><span class="face">${p.face}</span><div class="grow"><b>${esc(p.name)}</b> <small>${esc(p.role)}</small><q>${esc(p.hello)}</q>${quest}</div></li>`;
  });
  $('#vBody').innerHTML = `<ul class="list">${folks.join('')}</ul>
    <div class="waits"><span class="hint">⏳ Attendre au port jusqu’à :</span>${[['l’aube', 0.25], ['midi', 0.5], ['le soir', 0.78], ['la nuit', 0.95]].map(([l, t]) => `<button class="small ghost" data-wait="${t}">${l}</button>`).join('')}</div>`;
  $('#vBody').onclick = e => {
    const w = e.target.closest('[data-wait]');
    if (w) { G.waitUntil(s, +w.dataset.wait); toast(`⏳ Il est ${G.clock(s.time)}${s.traps.some(t => G.trapReady(s, t)) ? ' · tes casiers sont pleins !' : ''}.`); persist(); return; }
    const b = e.target.closest('[data-quest]'); if (!b) return;
    const p = PEOPLE.find(x => x.id === b.dataset.quest), q = G.questOf(s, p);
    if (G.completeQuest(s, q)) { SFX.upgrade(); gain(q.reward); persist(); toast(`${p.face} <b>${esc(p.name)}</b> : « ${esc(q.done)} » <b>+${coins(q.reward)}</b>`, 6000); }
    renderPeople(id);
  };
}

/* ---------------- Cale ---------------- */
export function renderInv() {
  const s = S.save, items = s.items.map(id => TREASURES.find(t => t.item === id)).filter(Boolean);
  const baits = G.baitsOwned(s);
  $('#invBody').innerHTML = `<p>Argent : <b>${coins(s.money)}</b> · Cale : <b>${s.cargo.length}/${G.slots(s)}</b> · Espèces : <b>${G.catalogCount(s)}/${FISH.length}</b> · Jour ${s.days + 1}</p>
    ${s.cargo.length ? `<ul class="list">${s.cargo.map((f, k) => { const d = G.fishById(f.id); return `<li><img src="${fishImage(d)}" alt=""><div class="grow"><b>${esc(d.name)}</b> ${rarityTag(d)}<small>${f.size} cm · environ ${coins(f.price)}</small></div><button class="small ghost" data-release="${k}" title="Le relâcher">🌊 Relâcher</button></li>`; }).join('')}</ul>` : '<p class="empty">Rien dans la cale pour l’instant.</p>'}
    <h3>Appâts <small class="hint">(touche B pour changer)</small></h3>
    <div class="row">${[...baits, null].map(b => `<button class="small ${s.bait === b ? 'primary' : 'ghost'}" data-pick="${b ?? ''}">${b ? `${BAITS[b].icon} ${esc(BAITS[b].name)} ${BAITS[b].forever ? '' : `×${s.baits[b]}`}` : '🚫 Sans appât'}</button>`).join('')}</div>
    ${items.length ? `<h3>Objets trouvés</h3><ul class="list">${items.map(t => `<li><span style="font-size:1.6rem">${t.kind === 'bouteille' ? '🍾' : '📦'}</span><div class="grow"><b>${esc(t.name)}</b><small>${esc(t.note)}</small></div></li>`).join('')}</ul>` : ''}
    <h3>Ton bateau</h3><ul class="list">${Object.entries(UPGRADES).filter(([k]) => s.levels[k] || ['moteur', 'cale', 'canne', 'coque'].includes(k)).map(([k, u]) => `<li><span style="font-size:1.4rem">${u.icon}</span><div class="grow"><b>${esc(G.lvl(s, k).name)}</b><small>${u.name}${k === 'casiers' ? ` · ${s.traps.length} posé(s)` : ''}</small></div></li>`).join('')}
    ${Object.entries(GEAR).filter(([k]) => s.gear[k]).map(([, g]) => `<li><span style="font-size:1.4rem">${g.icon}</span><div class="grow"><b>${esc(g.name)}</b><small>Plongée : touche H</small></div></li>`).join('')}</ul>`;
  $('#invBody').onclick = e => {
    const b = e.target.closest('[data-release]'), p = e.target.closest('[data-pick]');
    if (b) { s.cargo.splice(+b.dataset.release, 1); SFX.splash(); }
    if (p) { s.bait = p.dataset.pick || null; SFX.click(); }
    if (b || p) { persist(); renderInv(); }
  };
}

/* ---------------- Carnet ---------------- */
let bookSel = null;
export function renderBook() {
  const s = S.save;
  $('#bookCount').textContent = `${G.catalogCount(s)}/${FISH.length} espèces`;
  const sel = bookSel && G.fishById(bookSel), c = sel && s.catalog[sel.id];
  const how = f => [f.zones.length && `à la canne : ${f.zones.map(z => ZONE_SHORT[z]).join(', ')}`, f.trap && `au casier : ${f.trap.map(z => ZONE_SHORT[z]).join(', ')}`, f.dive && `en plongée : ${f.dive.map(z => ZONE_SHORT[z]).join(', ')}`].filter(Boolean).join(' · ');
  const detail = sel ? `<div class="detail"><img src="${fishImage(sel, !c)}" alt=""><div><h3>${c ? esc(sel.name) : '???'} ${rarityTag(sel)}</h3>
    <p class="hint">${c ? esc(sel.desc) : 'Pas encore attrapé. Voici où chercher…'}</p>
    <dl><dt>Où</dt><dd>${esc(how(sel))}</dd>${sel.zones.length ? `<dt>Quand</dt><dd>${WHEN[sel.when]}${sel.weather ? `, par temps de ${sel.weather}` : ''}</dd>` : ''}
    ${sel.bait ? `<dt>Appât</dt><dd>${BAITS[sel.bait].icon} ${esc(BAITS[sel.bait].name)}</dd>` : ''}
    ${sel.zones.length && FIGHTS[sel.fight] ? `<dt>Combat</dt><dd>${esc(FIGHTS[sel.fight])}</dd>` : ''}
    ${sel.minRod ? `<dt>Canne</dt><dd>${esc(UPGRADES.canne.levels[sel.minRod].name)} au moins</dd>` : ''}
    <dt>Valeur</dt><dd>environ ${coins(sel.price)}</dd>${c ? `<dt>Attrapés</dt><dd>${c.count} · record ${c.best} cm</dd>` : ''}</dl></div></div>` : '<p class="hint">Touche une espèce pour voir où, quand et avec quel appât la pêcher.</p>';
  $('#bookBody').innerHTML = detail + `<div class="bookGrid">${FISH.map(f => { const k = s.catalog[f.id]; return `<button class="fishCard ${k ? '' : 'unknown'}" data-fish="${f.id}"><img src="${fishImage(f, !k)}" alt=""><b>${k ? esc(f.name) : '???'}</b>${rarityTag(f)}</button>`; }).join('')}</div>`;
  $('#bookBody').onclick = e => { const b = e.target.closest('[data-fish]'); if (b) { bookSel = b.dataset.fish; renderBook(); $('#book .panel').scrollTop = 0; } };
}
