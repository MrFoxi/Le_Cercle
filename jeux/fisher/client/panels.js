// Little Fisher : les fenêtres. Village (marché, boutique d'appâts et de plongée, chantier naval, habitants), cale, carnet, carte.
import { S, persist, dressBoat } from './state.js';
import * as G from './game.js';
import { FISH, UPGRADES, VILLAGES, ZONE_SHORT, TREASURES, PEOPLE, BAITS, BAIT_SHOPS, GEAR, FIGHTS, WONDERS, RELICS, HUNTS, BOATS, HULL_COLORS, FLAGS, AQUARIUM, RARITY, STORY, MARGOT_STOCK, CONTEST } from './data.js';
import { fishImage } from './fishart.js';
import { SFX } from './audio.js';
import { toast, coins, rarityTag, gain, renderMap, showDialog, DAYS } from './hud.js';
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
  const tabs = [v.market && ['market', '🐟 Marché'], (BAIT_SHOPS[id] || Object.values(GEAR).some(g => g.shop === id)) && ['bait', '🪱 Boutique'], v.shop && ['shop', '🛠️ Chantier naval'], id === 'port' && ['house', '🏠 Maison'], G.margotAt(S.save) === id && ['margot', '🧺 Margot'], ['people', '👋 Habitants']].filter(Boolean);
  if (!tabs.some(([t]) => t === vTab)) vTab = tabs[0][0];
  $('#vTabs').innerHTML = tabs.map(([t, l]) => `<button class="${t === vTab ? 'on' : ''}" data-tab="${t}">${l}</button>`).join('');
  $('#vTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { vTab = b.dataset.tab; openVillage(id); } };
  if (S.panel !== 'village') openPanel('village');
  ({ market: renderMarket, bait: renderBaitShop, shop: renderShop, house: renderHouse, margot: renderMargot, people: renderPeople })[vTab](id);
}
const money = () => `<div class="sum"><span>Ton argent : <b>${coins(S.save.money)}</b></span></div>`;
function renderMarket(id) {
  const s = S.save;
  const rows = s.cargo.map((f, k) => { const d = G.fishById(f.id); return `<li><img src="${fishImage(d)}" alt=""><div class="grow"><b>${esc(d.name)}</b> ${rarityTag(d)}<small>${f.size} cm${G.isFresh(s, f) ? ' · 🧊 très frais (+15 %)' : ''}</small></div><span class="price">${coins(G.priceAt(f, id, s))}</span><button class="small ghost" data-sell="${k}">Vendre</button></li>`; });
  const total = s.cargo.reduce((a, f) => a + G.priceAt(f, id, s), 0);
  const orders = G.ordersOf(s, id), rare = s.cargo.map((f, k) => [f, k]).filter(([f]) => G.collectorPrice(f));
  const ordersHtml = orders.length ? `<h3>📋 Commandes du jour</h3><ul class="list">${orders.map((o, k) => { const f = G.fishById(o.fish), done = G.orderDone(s, o), have = s.cargo.filter(x => x.id === o.fish).length;
    return `<li class="order"><img src="${fishImage(f, !s.catalog[f.id])}" alt=""><div class="grow"><b>${o.count} × ${esc(f.name)}</b><small>${done ? '✓ Livrée, merci !' : `tu en as ${have} · payé ${coins(o.pay)} (le double)`}</small></div>${done ? '' : `<button class="small primary" data-order="${k}" ${have < o.count ? 'disabled' : ''}>Livrer</button>`}</li>`; }).join('')}</ul>` : '';
  const collector = id === 'port' && rare.length ? `<h3>🎩 Edmond, le collectionneur</h3><p class="hint">Il paie le double pour les poissons rares et légendaires.</p><ul class="list">${rare.map(([f, k]) => `<li><img src="${fishImage(G.fishById(f.id))}" alt=""><div class="grow"><b>${esc(G.fishById(f.id).name)}</b><small>${f.size} cm</small></div><button class="small primary" data-collect="${k}">${coins(G.collectorPrice(f))}</button></li>`).join('')}</ul>` : '';
  $('#vBody').innerHTML = `${VILLAGES[id].market > 1 ? `<p class="hint">Ici, on paie ${Math.round((VILLAGES[id].market - 1) * 100)} % de plus qu’à Port-Galet.</p>` : ''}${ordersHtml}${collector}${orders.length || collector ? '<h3>🐟 Marché</h3>' : ''}
    ${rows.length ? `<ul class="list">${rows.join('')}</ul>` : '<p class="empty">Ta cale est vide. Va pêcher !</p>'}
    <div class="sum"><span>Ton argent : <b>${coins(s.money)}</b></span>${rows.length ? `<button class="primary" id="sellAll">Tout vendre · ${coins(total)}</button>` : ''}</div>`;
  $('#vBody').onclick = e => {
    const o = e.target.closest('[data-order]'), c = e.target.closest('[data-collect]');
    if (o) { const err = G.deliverOrder(s, orders[+o.dataset.order]); if (err) return toast(err); gain(orders[+o.dataset.order].pay); toast(`📋 Commande livrée : <b>+${coins(orders[+o.dataset.order].pay)}</b>`); persist(); return renderMarket(id); }
    if (c) { const p = G.sellToCollector(s, +c.dataset.collect); gain(p); toast(`🎩 Edmond : « Splendide ! » <b>+${coins(p)}</b>`); persist(); return renderMarket(id); }
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
let shopTab = 'up';
function renderShop(id) {
  const s = S.save, sub = `<div class="tabs">${[['up', '⚙️ Améliorations'], ['boats', '⛵ Bateaux'], ['paint', '🎨 Peinture']].map(([t, l]) => `<button class="small ${t === shopTab ? 'on' : ''}" data-stab="${t}">${l}</button>`).join('')}</div>`;
  if (shopTab === 'boats') return renderBoats(id, sub);
  if (shopTab === 'paint') return renderPaint(id, sub);
  $('#vBody').innerHTML = `${sub}<p class="hint">Joseph améliore ton bateau. Chaque amélioration se voit dessus !</p><ul class="list">${Object.entries(UPGRADES).map(([key, u]) => {
    const cur = G.lvl(s, key), next = G.nextUpgrade(s, key);
    return `<li class="up"><span style="font-size:1.8rem">${u.icon}</span><div class="grow"><b>${u.name} : ${esc(cur.name)}</b>
      <div class="lv">${u.levels.map((_, k) => `<i class="${k <= s.levels[key] ? 'on' : ''}"></i>`).join('')}</div>
      ${next ? `<small>Ensuite : ${esc(next.name)}${next.desc ? ` · ${esc(next.desc)}` : ''}${next.speed ? ` · ${next.speed} nœuds` : ''}${next.slots ? ` · ${next.slots} places` : ''}</small>` : '<small>Au maximum !</small>'}</div>
      ${next ? `<button class="small primary" data-buy="${key}" ${s.money < next.cost ? 'disabled' : ''}>${coins(next.cost)}</button>` : ''}</li>`;
  }).join('')}</ul>${money()}`;
  $('#vBody').onclick = e => {
    if (subTab(e, id)) return;
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const err = G.buy(s, b.dataset.buy);
    if (err) return toast(err);
    SFX.upgrade(); dressBoat(); persist();
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
    const c = G.chapter(s), listen = c?.goal.type === 'talk' && c.goal.who === p.id ? `<button class="small primary" data-listen="${p.id}">🗨️ Écouter (${esc(c.title)})</button>` : '';
    const carto = p.cartographer ? `<div class="quest">🗺️ Cartes au trésor : ${coins(160)} <button class="small ghost" data-map ${s.money < 160 || Object.keys(HUNTS).every(h => s.hunts[h]) ? 'disabled' : ''}>Acheter</button></div>` : '';
    return `<li class="person"><span class="face">${p.face}</span><div class="grow"><b>${esc(p.name)}</b> <small>${esc(p.role)}</small><q>${esc(p.hello)}</q>${listen}${quest}${carto}</div></li>`;
  });
  if (id === 'port') folks.unshift(`<li class="person"><span class="face">🏆</span><div class="grow"><b>Le concours du dimanche</b> <small>Port-Galet</small><q>Chaque dimanche, ${CONTEST.hours} heures pour pêcher la plus belle prise (la taille compte, et les rares rapportent plus).</q>
    ${G.isSunday(s) ? (s.contest?.day === s.days ? `<div class="quest done">${G.contestOn(s) ? `En cours : ${s.contest.best} points.` : 'Fini pour aujourd’hui.'}</div>` : '<button class="small primary" data-contest>Participer !</button>') : `<div class="quest done">Prochain concours : dimanche (aujourd’hui : ${DAYS[s.days % 7].toLowerCase()}).</div>`}</div></li>`);
  $('#vBody').innerHTML = `<ul class="list">${folks.join('')}</ul>
    <div class="waits"><span class="hint">⏳ Attendre au port jusqu’à :</span>${[['l’aube', 0.25], ['midi', 0.5], ['le soir', 0.78], ['la nuit', 0.95]].map(([l, t]) => `<button class="small ghost" data-wait="${t}">${l}</button>`).join('')}</div>`;
  $('#vBody').onclick = e => {
    const l = e.target.closest('[data-listen]');
    if (l) { const p = PEOPLE.find(x => x.id === l.dataset.listen), c = G.storyTalk(s, p.id); if (c) { persist(); showDialog(p.face, p.name, `Chapitre ${s.story} · ${c.title}`, `${c.say}\n\n+${c.reward} 🪙`); gain(c.reward); } return renderPeople(id); }
    if (e.target.closest('[data-map]')) { const h = G.buyMap(s); if (h) { SFX.treasure(); toast(`🗺️ <b>${esc(HUNTS[h].name)}</b> : « ${esc(HUNTS[h].clue)} »`, 9000); persist(); } return renderPeople(id); }
    if (e.target.closest('[data-contest]')) { const err = G.startContest(s); if (err) return toast(err); SFX.horn(); toast(`🏆 C’est parti ! ${CONTEST.hours} heures pour pêcher ta plus belle prise.`, 6000); persist(); return renderPeople(id); }
    const w = e.target.closest('[data-wait]');
    if (w) { G.waitUntil(s, +w.dataset.wait); toast(`⏳ Il est ${G.clock(s.time)}${s.traps.some(t => G.trapReady(s, t)) ? ' · tes casiers sont pleins !' : ''}.`); persist(); return; }
    const b = e.target.closest('[data-quest]'); if (!b) return;
    const p = PEOPLE.find(x => x.id === b.dataset.quest), q = G.questOf(s, p);
    if (G.completeQuest(s, q)) { SFX.upgrade(); gain(q.reward); persist(); toast(`${p.face} <b>${esc(p.name)}</b> : « ${esc(q.done)} » <b>+${coins(q.reward)}</b>`, 6000); }
    renderPeople(id);
  };
}

const subTab = (e, id) => { const t = e.target.closest('[data-stab]'); if (t) { shopTab = t.dataset.stab; renderShop(id); } return !!t; };
function renderBoats(id, sub) {
  const s = S.save;
  $('#vBody').innerHTML = `${sub}<ul class="list">${Object.entries(BOATS).map(([k, b]) => `<li><span style="font-size:1.8rem">${k === 'voilier' ? '⛵' : k === 'chalutier' ? '🚢' : '🛶'}</span><div class="grow"><b>${esc(b.name)}</b><small>${esc(b.desc)}${b.cargo ? ` · +${b.cargo} places` : ''}</small></div>
    ${s.model === k ? '<small>✓ En service</small>' : s.boats.includes(k) ? `<button class="small ghost" data-use="${k}">Prendre</button>` : `<button class="small primary" data-boat="${k}" ${s.money < b.cost ? 'disabled' : ''}>${coins(b.cost)}</button>`}</li>`).join('')}</ul>
    <p class="hint">Tu gardes tous tes bateaux au chantier : change quand tu veux.${s.gear.sousmarin ? '' : ' Le petit sous-marin pour les grands fonds se trouve à la boutique.'}</p>${money()}`;
  $('#vBody').onclick = e => {
    if (subTab(e, id)) return;
    const u = e.target.closest('[data-use]'), b = e.target.closest('[data-boat]');
    if (u) { G.setBoat(s, u.dataset.use); SFX.click(); }
    if (b) { const err = G.buyBoat(s, b.dataset.boat); if (err) return toast(err); SFX.upgrade(); toast(`⛵ Ton nouveau bateau : <b>${esc(BOATS[b.dataset.boat].name)}</b> !`); }
    if (u || b) { dressBoat(); persist(); renderBoats(id, sub); }
  };
}
function renderPaint(id, sub) {
  const s = S.save, c = s.custom, lock = it => (it.need ? `🔒 ${esc(RELICS[it.need].name)}` : '');
  $('#vBody').innerHTML = `${sub}
    <h3>Nom du bateau</h3><div class="row"><input id="boatName" maxlength="18" value="${esc(c.name)}" style="flex:1;min-width:160px;font:600 1rem var(--font);padding:9px 12px;border-radius:12px;border:2px solid var(--line)"><button class="small primary" id="nameOk">Peindre le nom</button></div>
    <h3>Couleur de la coque</h3><div class="row">${Object.entries(HULL_COLORS).map(([k, h]) => { const ok = G.unlocked(s, h); return `<button class="small ${c.hull === k ? 'primary' : 'ghost'}" data-hull="${k}" ${ok ? '' : 'disabled'} title="${ok ? '' : `Il faut : ${esc(RELICS[h.need].name)}`}"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;background:${h.color ?? 'linear-gradient(90deg,#b9804a,#f2efe8,#27445f)'};border:1px solid #0003"></span> ${esc(h.name)} ${ok ? '' : lock(h)}</button>`; }).join('')}</div>
    <h3>Drapeau</h3><div class="row">${Object.entries(FLAGS).map(([k, f]) => { const ok = G.unlocked(s, f); return `<button class="small ${c.flag === k ? 'primary' : 'ghost'}" data-flag="${k}" ${ok ? '' : 'disabled'}><span style="display:inline-block;width:18px;height:12px;vertical-align:-1px;background:${f.colors[0]};border:2px solid ${f.colors[1] ?? f.colors[0]}"></span> ${esc(f.name)} ${ok ? '' : lock(f)}</button>`; }).join('')}</div>
    <h3>Mascotte sur le toit</h3><div class="row"><button class="small ${c.mascot ? 'ghost' : 'primary'}" data-mascot="">Aucune</button>${s.relics.map(r => `<button class="small ${c.mascot === r ? 'primary' : 'ghost'}" data-mascot="${r}">${RELICS[r].icon} ${esc(RELICS[r].name)}</button>`).join('') || '<span class="hint">Trouve des reliques (épaves, trésors) pour en exposer une.</span>'}</div>`;
  const apply = (k, v) => { if (G.setCustom(s, k, v)) { SFX.click(); dressBoat(); persist(); renderPaint(id, sub); } };
  $('#nameOk').onclick = () => { apply('name', $('#boatName').value); toast(`🖌️ Ton bateau s’appelle « ${esc(s.custom.name)} ».`); };
  $('#vBody').onclick = e => {
    if (subTab(e, id)) return;
    const h = e.target.closest('[data-hull]'), f = e.target.closest('[data-flag]'), m = e.target.closest('[data-mascot]');
    if (h) apply('hull', h.dataset.hull); if (f) apply('flag', f.dataset.flag); if (m) apply('mascot', m.dataset.mascot || null);
  };
}

/* ---------------- Margot, la marchande ambulante ---------------- */
function renderMargot(id) {
  const s = S.save;
  $('#vBody').innerHTML = `<div class="person row" style="align-items:flex-start"><span class="face" style="font-size:2.4rem">🧕</span><div class="grow"><b>Margot</b> <small class="hint">Marchande ambulante</small><q>Bonjour, bonjour ! Demain je serai ailleurs, alors profites-en.</q></div></div>
    <ul class="list">${MARGOT_STOCK.map((it, k) => { const b = it.kind === 'bait' && BAITS[it.id];
      return `<li><span style="font-size:1.8rem">${b ? b.icon : it.kind === 'relic' ? '🏺' : '🗺️'}</span><div class="grow"><b>${b ? esc(b.name) : it.kind === 'relic' ? 'Relique mystère' : 'Carte au trésor'}</b><small>${esc(b ? b.desc : it.desc)}${b ? ` · par ${b.pack}` : ''}</small></div><button class="small primary" data-margot="${k}" ${s.money < it.cost ? 'disabled' : ''}>${coins(it.cost)}</button></li>`; }).join('')}</ul>${money()}`;
  $('#vBody').onclick = e => {
    const b = e.target.closest('[data-margot]'); if (!b) return;
    const r = G.buyFromMargot(s, +b.dataset.margot);
    if (r.error) return toast(r.error);
    SFX.coin(); persist();
    if (r.relic) toast(`🏺 Une relique : <b>${RELICS[r.relic].icon} ${esc(RELICS[r.relic].name)}</b> !`);
    if (r.map) toast(`🗺️ <b>${esc(HUNTS[r.map].name)}</b> : « ${esc(HUNTS[r.map].clue)} »`, 9000);
    renderMargot(id);
  };
}

/* ---------------- Maison : aquarium, trophées, reliques ---------------- */
let aquaFish = [], aquaLoop = 0; // aquaLoop : une seule animation à la fois
function renderHouse(id) {
  const s = S.save, tr = G.trophies(s), legends = tr.filter(t => t.f.rarity === 'legende');
  $('#vBody').innerHTML = `<canvas id="aquaCanvas" width="640" height="250" style="width:100%;border-radius:16px;display:block"></canvas>
    <h3>Aquarium <small class="hint">${s.aquarium.length}/${AQUARIUM}</small></h3>
    ${s.aquarium.length ? `<div class="row">${s.aquarium.map((f, k) => `<button class="small ghost" data-free="${k}" title="Le relâcher">${esc(G.fishById(f.id).name)} · ${f.size} cm ✕</button>`).join('')}</div>` : '<p class="hint">Mets tes plus belles prises dans l’aquarium : elles y nagent pour toujours.</p>'}
    ${s.cargo.length && s.aquarium.length < AQUARIUM ? `<p class="hint">Depuis ta cale :</p><div class="row">${s.cargo.map((f, k) => `<button class="small primary" data-aqua="${k}">+ ${esc(G.fishById(f.id).name)} (${f.size} cm)</button>`).join('')}</div>` : ''}
    <h3>Mur des trophées</h3>
    ${legends.length ? `<p>🏆 Légendaires : ${legends.map(t => `<b>${esc(t.f.name)}</b>`).join(', ')}</p>` : ''}
    ${tr.length ? `<div class="bookGrid">${tr.slice(0, 12).map(t => `<div class="fishCard" style="cursor:default"><img src="${fishImage(t.f)}" alt=""><b>${esc(t.f.name)}</b><small class="hint">record ${t.best} cm · ${t.count} pris</small></div>`).join('')}</div>` : '<p class="empty">Pas encore de trophée.</p>'}
    <h3>Étagère des reliques</h3><div class="row">${Object.entries(RELICS).map(([k, r]) => `<span class="pill" style="${s.relics.includes(k) ? '' : 'filter:grayscale(1);opacity:.35'}" title="${s.relics.includes(k) ? esc(r.desc) : '???'}">${r.icon}</span>`).join('')}</div>`;
  $('#vBody').onclick = e => {
    const a = e.target.closest('[data-aqua]'), f = e.target.closest('[data-free]');
    if (a && G.toAquarium(s, +a.dataset.aqua)) SFX.splash();
    if (f && G.releaseAquarium(s, +f.dataset.free)) SFX.splash();
    if (a || f) { persist(); renderHouse(id); }
  };
  // l'aquarium : les poissons nagent de long en large
  aquaFish = s.aquarium.map((f, k) => { const img = new Image(); img.src = fishImage(G.fishById(f.id)); return { img, x: 80 + k * 70, y: 50 + (k * 37) % 140, v: 25 + (k % 3) * 12, dir: k % 2 ? -1 : 1, ph: k, s: Math.max(0.5, Math.min(1.1, f.size / 60)) }; });
  let last = performance.now();
  const loop = ++aquaLoop;
  const draw = now => {
    const cv = document.getElementById('aquaCanvas'); if (!cv || loop !== aquaLoop) return;
    const g = cv.getContext('2d'), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const gr = g.createLinearGradient(0, 0, 0, 250); gr.addColorStop(0, '#7fd8f0'); gr.addColorStop(1, '#1f6f9a'); g.fillStyle = gr; g.fillRect(0, 0, 640, 250);
    g.fillStyle = '#f1dca2'; g.beginPath(); g.moveTo(0, 230); for (let x = 0; x <= 640; x += 40) g.lineTo(x, 226 + Math.sin(x * 0.05) * 5); g.lineTo(640, 250); g.lineTo(0, 250); g.fill();
    g.strokeStyle = '#3f9a5a'; g.lineWidth = 6; g.lineCap = 'round';
    for (const x of [60, 150, 470, 560]) { g.beginPath(); g.moveTo(x, 232); g.quadraticCurveTo(x + Math.sin(now / 900 + x) * 14, 180, x + Math.sin(now / 700 + x) * 10, 120 + (x % 40)); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 10; k++) { const y = 230 - ((now / 20 + k * 47) % 230); g.beginPath(); g.arc(300 + Math.sin(y / 20 + k) * 8 + (k % 3) * 12, y, 3, 0, 7); g.fill(); }
    for (const f of aquaFish) {
      f.x += f.v * f.dir * dt; if (f.x > 600) f.dir = -1; if (f.x < 40) f.dir = 1;
      const w = 110 * f.s, h = 64 * f.s, y = f.y + Math.sin(now / 600 + f.ph) * 6;
      g.save(); g.translate(f.x, y); g.scale(f.dir, 1); if (f.img.complete) g.drawImage(f.img, -w / 2, -h / 2, w, h); g.restore();
    }
    if (!aquaFish.length) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('Ton aquarium est vide… pour l’instant !', 320, 125); }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
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
    ${s.relics.length ? `<h3>Reliques</h3><div class="row">${s.relics.map(r => `<span class="pill" title="${esc(RELICS[r].desc)}">${RELICS[r].icon} ${esc(RELICS[r].name)}</span>`).join('')}</div>` : ''}
    <h3>Ton bateau</h3><ul class="list">${Object.entries(UPGRADES).filter(([k]) => s.levels[k] || ['moteur', 'cale', 'canne', 'coque'].includes(k)).map(([k, u]) => `<li><span style="font-size:1.4rem">${u.icon}</span><div class="grow"><b>${esc(G.lvl(s, k).name)}</b><small>${u.name}${k === 'casiers' ? ` · ${s.traps.length} posé(s)` : ''}</small></div></li>`).join('')}
    ${Object.entries(GEAR).filter(([k]) => s.gear[k]).map(([k, g]) => `<li><span style="font-size:1.4rem">${g.icon}</span><div class="grow"><b>${esc(g.name)}</b><small>${k === 'harpon' ? 'Plongée : touche H' : 'Fouiller une épave : touche E'}</small></div></li>`).join('')}</ul>`;
  $('#invBody').onclick = e => {
    const b = e.target.closest('[data-release]'), p = e.target.closest('[data-pick]');
    if (b) { s.cargo.splice(+b.dataset.release, 1); SFX.splash(); }
    if (p) { s.bait = p.dataset.pick || null; SFX.click(); }
    if (b || p) { persist(); renderInv(); }
  };
}

/* ---------------- Carnet : merveilles, reliques, cartes au trésor ---------------- */
function renderBookOther(tab) {
  const s = S.save;
  if (tab === 'wonders') $('#bookBody').innerHTML = `<p class="hint">Des lieux à voir, certains seulement à un moment précis.</p><ul class="list">${WONDERS.map(w => s.seen.includes(w.id)
    ? `<li><span style="font-size:1.8rem">${w.icon}</span><div class="grow"><b>${esc(w.name)}</b><small>${esc(w.desc)}</small></div></li>`
    : `<li><span style="font-size:1.8rem;filter:grayscale(1);opacity:.4">${w.icon}</span><div class="grow"><b>???</b><small>${w.when === 'nuit' ? 'Quelque part, une nuit claire…' : w.when === 'soir' ? 'Au large, à un instant précis du soir…' : 'Quelque part dans l’archipel…'}</small></div></li>`).join('')}</ul>`;
  if (tab === 'relics') $('#bookBody').innerHTML = `<p class="hint">Trouvées en fouillant les épaves (grappin) et en creusant les trésors enterrés.</p><ul class="list">${Object.entries(RELICS).map(([k, r]) => s.relics.includes(k)
    ? `<li><span style="font-size:1.8rem">${r.icon}</span><div class="grow"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div></li>`
    : `<li><span style="font-size:1.8rem;filter:grayscale(1);opacity:.35">${r.icon}</span><div class="grow"><b>???</b><small>Pas encore trouvée.</small></div></li>`).join('')}</ul>`;
  if (tab === 'story') {
    const c = G.chapter(s);
    $('#bookBody').innerHTML = `<p class="hint">Le mystère du Léviathan, chapitre par chapitre.</p><ul class="list story">${STORY.map((ch, k) => k < s.story
      ? `<li class="done"><span style="font-size:1.6rem">✅</span><div class="grow"><b>${k + 1}. ${esc(ch.title)}</b><small>${esc(ch.say)}</small></div></li>`
      : k === s.story ? `<li><span style="font-size:1.6rem">📍</span><div class="grow"><b>${k + 1}. ${esc(ch.title)}</b><small>${esc(ch.task)}</small></div></li>`
      : `<li><span style="font-size:1.6rem;opacity:.35">🔒</span><div class="grow"><b>${k + 1}. ???</b></div></li>`).join('')}</ul>${c ? '' : '<p class="empty">🐉 Tu as percé le mystère de l’archipel. Bravo !</p>'}`;
  }
  if (tab === 'maps') { const list = Object.entries(HUNTS).filter(([id]) => s.hunts[id]);
    $('#bookBody').innerHTML = list.length ? `<ul class="list">${list.map(([id, h]) => `<li><span style="font-size:1.8rem">${s.hunts[id] === 'trouve' ? '✅' : '📜'}</span><div class="grow"><b>${esc(h.name)}</b><small>${s.hunts[id] === 'trouve' ? 'Trésor trouvé !' : `« ${esc(h.clue)} » — approche de la plage et appuie sur E quand la croix rouge apparaît.`}</small></div></li>`).join('')}</ul>`
      : '<p class="empty">Aucune carte au trésor pour l’instant. Certaines bouteilles à la mer en cachent…</p>'; }
}

/* ---------------- Carnet ---------------- */
let bookSel = null, bookTab = 'fish';
export function renderBook() {
  const s = S.save;
  const tabs = [['fish', `🐟 Poissons ${G.catalogCount(s)}/${FISH.length}`], ['wonders', `✨ Merveilles ${G.wondersSeen(s).length}/${WONDERS.length}`], ['relics', `🏺 Reliques ${s.relics.length}/${Object.keys(RELICS).length}`], ['maps', `📜 Cartes au trésor`], ['story', `📖 Histoire ${Math.min(S.save.story, STORY.length)}/${STORY.length}`]];
  $('#bookCount').innerHTML = `<span class="tabs" id="bookTabs">${tabs.map(([t, l]) => `<button class="small ${t === bookTab ? 'on' : ''}" data-btab="${t}">${l}</button>`).join('')}</span>`;
  $('#bookTabs').onclick = e => { const b = e.target.closest('[data-btab]'); if (b) { bookTab = b.dataset.btab; renderBook(); } };
  if (bookTab !== 'fish') return renderBookOther(bookTab);
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
