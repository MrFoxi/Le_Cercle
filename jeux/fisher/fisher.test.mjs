// Tests de Little Fisher : le contenu se tient (chaque poisson peut mordre quelque part, missions et trésors liés),
// et la boucle de jeu marche : pêcher, remplir la cale, vendre, améliorer, rendre des missions, sauvegarder.
import assert from 'node:assert';
import { FISH, SPOTS, PEOPLE, TREASURES, UPGRADES, ZONES, BAITS, FIGHTS, ISLANDS, WONDERS, WRECKS, HUNTS, RELICS, CAVE, VILLAGES, STORY, MARGOT_ROUTE } from './client/data.js';
import * as G from './client/game.js';

// Chaque espèce s'attrape d'une façon : à la canne (meilleur équipement, à une heure et par un temps donnés), au casier ou en plongée.
const TIMES = [0.1, 0.27, 0.5, 0.79], WEATHERS = ['clair', 'pluie', 'brume'];
for (const f of FISH) {
  assert([...f.zones, ...(f.trap ?? []), ...(f.dive ?? [])].every(z => ZONES[z]), `${f.id} : zone inconnue`);
  const rod = f.zones.some(zone => TIMES.some(time => WEATHERS.some(weather => G.canBite(f, { zone, time, weather, rod: 3, lantern: 1 }))));
  assert(rod || f.trap?.length || f.dive?.length, `${f.id} ne s'attrape jamais`);
  assert(!f.bait || BAITS[f.bait], `${f.id} : appât inconnu`);
  assert(FIGHTS[f.fight] !== undefined, `${f.id} : combat inconnu`);
}
// Appâts : le préféré fait mordre bien plus souvent ; l'appât lumineux remplace la lanterne la nuit.
const count = (bait, id) => { let n = 0, s = 1; for (let k = 0; k < 3000; k++) if (G.pickFish({ zone: 'cote', time: 0.5, weather: 'clair', rod: 0, lantern: 0, bait }, () => (s = (s * 16807) % 2147483647) / 2147483647)?.id === id) n++; return n; };
assert(count('ver', 'rouget') > count('crevette', 'rouget') * 2);
assert(G.canBite(G.fishById('calmar'), { zone: 'phare', time: 0.05, weather: 'clair', rod: 0, lantern: 0, bait: 'lumineux' }));
const bs = G.newSave();
assert.strictEqual(G.useBait(bs), 'ver'); assert.strictEqual(bs.baits.ver, 4);
assert.match(G.buyBait(bs, 'crevette', 'port'), /Pas vendu/);
bs.money = 200; assert.strictEqual(G.buyBait(bs, 'leurre', 'port'), null);
for (let k = 0; k < 10; k++) { bs.bait = 'leurre'; assert.strictEqual(G.useBait(bs), 'leurre'); } // le leurre ne s'use pas
assert.strictEqual(bs.baits.leurre, 1);
assert.deepStrictEqual([G.nextBait(bs), G.nextBait(bs), G.nextBait(bs)], [null, 'ver', 'leurre']); // on part du leurre
// Casiers : posés sur un fond peu profond, pleins après 3 heures, ce qui ne tient pas dans la cale est relâché.
const ts = G.newSave(); ts.levels.casiers = 1;
assert(G.trapSpot(8, 'roche') && !G.trapSpot(40, 'roche') && !G.trapSpot(8, 'large'));
assert.strictEqual(G.placeTrap(ts, 10, 10, 'roche'), null); G.placeTrap(ts, 20, 10, 'roche');
assert.match(G.placeTrap(ts, 30, 10, 'roche'), /déjà posés/);
assert.strictEqual(G.collectTrap(ts, 0), null);       // pas encore plein
G.tick(ts, 600 * 3.1 / 24);                           // un peu plus de 3 heures de jeu
const got = G.collectTrap(ts, 0, () => 0.99);
assert(got.length >= 1 && got.every(g => g.f.trap.includes('roche')) && ts.traps.length === 1);
ts.cargo = Array(6).fill({ id: 'sardine', size: 20, price: 4 });
assert.deepStrictEqual(G.collectTrap(ts, 0), []);    // cale pleine : tout est relâché
// Filet : seulement des petits poissons communs des eaux traversées ; plongée : il faut le harpon et une eau claire.
for (let k = 0; k < 50; k++) assert.strictEqual(G.netCatch('recif').rarity, 'commun');
const ds = G.newSave();
assert(!G.canDive(ds, 'recif', 8)); ds.gear.harpon = true;
assert(G.canDive(ds, 'recif', 8) && !G.canDive(ds, 'recif', 60) && !G.canDive(ds, 'large', 8));
for (let k = 0; k < 50; k++) assert(G.diveFish('recif').dive.includes('recif'));
assert.match(G.buyGear(ds, 'harpon', 'corail'), /déjà/);
// Le temps : minuit passe au jour suivant ; attendre jusqu'à l'aube quand il est midi, c'est le lendemain.
const tt = G.newSave(); tt.time = 0.95;
assert(G.tick(tt, 60) && tt.days === 1);
tt.time = 0.5; G.waitUntil(tt, 0.25); assert.deepStrictEqual([tt.days, tt.time], [2, 0.25]);
// Au départ (canne en bambou, pas de lanterne), on prend quelque chose de jour dans les premières zones.
for (const zone of ['cote', 'recif', 'roche']) assert(G.pickFish({ zone, time: 0.5, weather: 'clair', rod: 0, lantern: 0 }), `rien à pêcher en ${zone}`);
// La nuit sans lanterne : seuls les poissons qui ne sont pas « nuit » mordent.
for (let k = 0; k < 200; k++) assert.notStrictEqual(G.pickFish({ zone: 'roche', time: 0.05, weather: 'clair', rod: 3, lantern: 0 })?.when, 'nuit');
// Les légendaires demandent une bonne canne.
assert(!G.canBite(G.fishById('roi'), { zone: 'cote', time: 0.27, weather: 'clair', rod: 0, lantern: 0 }));
assert(G.canBite(G.fishById('roi'), { zone: 'cote', time: 0.27, weather: 'clair', rod: 2, lantern: 0 }));

// Les remous sont bien dans les eaux annoncées, et les zones d'accès sont cohérentes.
for (const s of SPOTS) assert.strictEqual(G.zoneAt(s.x, s.z), s.zone, `remous (${s.x}, ${s.z})`);
assert.strictEqual(G.hullNeeded(0, 120), 0);
assert.strictEqual(G.hullNeeded(-130, 700), 1); // le phare
assert.strictEqual(G.hullNeeded(830, 440), 2);  // la Fosse
assert.strictEqual(G.hullNeeded(2000, 0), Infinity);

// Missions et trésors liés : poissons et objets existent, chaque objet de mission se trouve en mer.
for (const p of PEOPLE) for (const q of p.quests) {
  if (q.type === 'catch') assert(G.fishById(q.fish), q.id);
  if (q.type === 'find') assert(TREASURES.some(t => t.item === q.item), q.id);
}
// Les niveaux d'amélioration coûtent de plus en plus cher.
for (const u of Object.values(UPGRADES)) u.levels.forEach((l, k) => assert(k === 0 ? l.cost === 0 : l.cost > u.levels[k - 1].cost));

// La boucle : pêcher jusqu'à remplir la cale, vendre, acheter, rendre une mission.
const save = G.newSave();
let rng = 0.3; const R = () => (rng = (rng * 9301 + 49297) % 233280 / 233280);
while (!G.cargoFull(save)) G.landFish(save, G.pickFish({ zone: 'cote', time: 0.5, weather: 'clair', rod: 0, lantern: 0 }, R), R);
assert.strictEqual(save.cargo.length, 6);
const r = G.landFish(G.newSave(), G.fishById('sardine'), () => 1);
assert.deepStrictEqual([r.fish.size, r.first], [22, true]);
const joseph = PEOPLE.find(p => p.id === 'joseph');
assert.strictEqual(G.questOf(save, joseph).id, 'debut');
assert(!G.completeQuest(save, G.questOf(save, joseph)));
const before = save.money, total = G.sell(save, 'port');
assert(total > 0 && save.money === before + total && save.cargo.length === 0 && save.sold === 6);
assert(G.completeQuest(save, G.questOf(save, joseph)));
assert.strictEqual(G.questOf(save, joseph).id, 'palmes');
save.money = 150;
assert.strictEqual(G.buy(save, 'moteur'), null);
assert.strictEqual(save.levels.moteur, 1);
assert.match(G.buy(save, 'moteur'), /manque/);
// Un trésor ne se ramasse qu'une fois ; l'objet de mission se rend.
const box = TREASURES.find(t => t.item === 'alliance');
assert(G.takeTreasure(save, box) && !G.takeTreasure(save, box));
assert(G.completeQuest(save, PEOPLE.find(p => p.id === 'gustave').quests[0]) && !save.items.length);
// Sauvegarde relue à l'identique ; une sauvegarde abîmée donne une partie neuve.
assert.deepStrictEqual(G.loadSave(JSON.stringify(save)), save);
assert.strictEqual(G.newSave().boat, null); // première partie : le jeu place le bateau au ponton
assert.strictEqual(G.loadSave('{oups').money, 20);
// Heure : 7 h 12 est encore l'aube, midi le jour, 19 h le crépuscule, minuit la nuit.
assert.deepStrictEqual([G.clock(0.3), G.period(0.3), G.period(0.5), G.period(19 / 24), G.period(0)], ['07:12', 'crepuscule', 'jour', 'crepuscule', 'nuit']);
// Exploration : la grotte a sa zone, le nord demande la coque de haute mer, missions « voir » et villages renvoient à de vrais lieux.
assert.strictEqual(G.zoneAt(CAVE.x, CAVE.z), 'grotte');
assert.strictEqual(G.hullNeeded(120, -860), 2);
for (const p of PEOPLE) for (const q of p.quests) if (q.type === 'see') assert(ISLANDS.some(i => i.id === q.place) || WONDERS.some(w => w.id === q.place) || q.place === 'fosse', q.id);
for (const v of Object.values(VILLAGES)) assert(ISLANDS.some(i => i.id === v.island && i.dock), v.name);
for (const w of WRECKS) assert(RELICS[w.relic], w.id);
for (const h of Object.values(HUNTS)) assert(RELICS[h.relic] && ISLANDS.some(i => i.id === h.island), h.name);
assert(TREASURES.filter(t => t.map).every(t => HUNTS[t.map]));
// Épave : il faut le grappin ; la première fouille donne sa relique ; une seule fouille par jour.
const ws = G.newSave(), wreck = WRECKS[0];
assert(G.searchWreck(ws, wreck).error); ws.gear.grappin = true;
const first = G.searchWreck(ws, wreck, () => 0.5);
assert(first.relic === wreck.relic && ws.relics.includes(wreck.relic));
assert(G.searchWreck(ws, wreck).error); ws.days++;
assert(!G.searchWreck(ws, wreck, () => 0.5).error);
assert.strictEqual(G.wreckNear(wreck.x + 5, wreck.z), wreck);
// Carte au trésor : la bouteille lance la chasse, on creuse une seule fois.
const bottle = TREASURES.find(t => t.map === 'h1');
G.takeTreasure(ws, bottle); assert.deepStrictEqual(G.activeHunts(ws), ['h1']);
const before2 = ws.money; assert(G.digHunt(ws, 'h1') && ws.money > before2 && !G.digHunt(ws, 'h1') && ws.relics.includes(HUNTS.h1.relic));
// Merveilles : les aurores seulement la nuit par temps clair ; le rayon vert au large au coucher du soleil.
const aurore = WONDERS.find(w => w.id === 'aurore');
assert.strictEqual(G.wonderHere(ws, aurore.x, aurore.z, { time: 0.5, weather: 'clair' }), null);
assert.strictEqual(G.wonderHere(ws, aurore.x, aurore.z, { time: 0.02, weather: 'clair' })?.id, 'aurore');
assert.strictEqual(G.wonderHere(ws, 300, 300, { time: 18.6 / 24, weather: 'clair' })?.id, 'rayonvert');
// Brouillard de la carte : on découvre autour du bateau, pas ailleurs.
const fs = G.newSave();
assert(G.reveal(fs, 0, 0) && !G.reveal(fs, 0, 0));
assert(G.explored(fs) > 0 && G.explored(fs) < 0.05);
// Bateaux : le chalutier agrandit la cale et donne 2 casiers de plus ; le voilier va vite vent de travers, lentement face au vent.
const bt = G.newSave(); bt.money = 5000; bt.levels.casiers = 1;
assert.strictEqual(G.slots(bt), 6);
assert.strictEqual(G.buyBoat(bt, 'chalutier'), null);
assert.deepStrictEqual([G.slots(bt), G.trapsMax(bt), bt.model], [14, 4, 'chalutier']);
assert(G.setBoat(bt, 'barque') && !G.setBoat(bt, 'voilier'));
assert(G.sailFactor(Math.PI / 2, 1) > G.sailFactor(0, 1) && G.sailFactor(0, 1) > 1 && G.sailFactor(Math.PI, 1) < 0.6 && G.sailFactor(Math.PI, 0) === 1);
// Personnalisation : une couleur ou un drapeau à relique reste fermé tant qu'on ne l'a pas ; le nom est nettoyé.
assert(!G.setCustom(bt, 'hull', 'or')); bt.relics.push('couronne'); assert(G.setCustom(bt, 'hull', 'or'));
assert(!G.setCustom(bt, 'mascot', 'jade')); assert(G.setCustom(bt, 'mascot', 'couronne'));
G.setCustom(bt, 'name', '  <Mon bateau> qui a un nom très très long  '); assert.strictEqual(bt.custom.name, 'Mon bateau qui a u');
// Fraîcheur : +15 % juste après la prise, plus après 3 heures (12 avec la cale réfrigérée).
const fr = G.newSave(), caught = G.landFish(fr, G.fishById('thon'), () => 0.5).fish;
const fresh = G.priceAt(caught, 'port', fr); G.tick(fr, 600 * 4 / 24);
assert(fresh > G.priceAt(caught, 'port', fr) && G.priceAt(caught, 'port', fr) === caught.price);
fr.levels.cale = 2; assert(G.isFresh(fr, caught));
// Aquarium : on y met un poisson de la cale (8 au plus), on peut le relâcher.
assert(G.toAquarium(fr, 0) && fr.aquarium.length === 1 && fr.cargo.length === 0 && G.releaseAquarium(fr, 0));
assert(G.trophies(fr)[0].f.id === 'thon');
// Sous-marin : seulement en eau profonde, au large ou dans la Fosse.
fr.gear.sousmarin = true;
assert(G.canSub(fr, 'fosse', 60) && !G.canSub(fr, 'cote', 60) && !G.canSub(fr, 'large', 10));
// L'histoire : chaque chapitre renvoie à des choses qui existent ; on la déroule jusqu'au bout.
for (const c of STORY) {
  const g = c.goal;
  if (g.type === 'talk') assert(PEOPLE.some(p => p.id === g.who), c.id);
  if (g.type === 'wreck') assert(WRECKS.some(w => w.id === g.wreck), c.id);
  if (g.type === 'relic') assert(RELICS[g.relic], c.id);
  if (g.type === 'catch') assert(G.fishById(g.fish), c.id);
}
const st = G.newSave();
assert(!G.storyTalk(st, 'lena') && G.storyTalk(st, 'gustave')?.id === 'c1');
assert(!G.chapterReady(st)); st.wrecks.neptune = 0; assert(G.chapterReady(st) && G.finishChapter(st).id === 'c2');
st.relics.push('carte'); G.finishChapter(st); G.storyTalk(st, 'lena'); st.levels.canne = 3; G.finishChapter(st);
st.flags.leviathan = true; assert(G.chapterReady(st)); G.finishChapter(st);
st.catalog.leviathan = { count: 1, best: 500 }; assert(G.finishChapter(st).end && st.relics.includes('statue') && G.chapter(st) === null);
// Commandes du jour : toujours les mêmes pour un jour donné, payées double, livrées une seule fois.
const os = G.newSave(), orders = G.ordersOf(os, 'port');
assert.deepStrictEqual(G.ordersOf(os, 'port'), orders); assert.strictEqual(G.ordersOf(os, 'phare').length, 0);
const o = orders[0]; assert.match(G.deliverOrder(os, o), /Il t’en faut/);
for (let k = 0; k < o.count; k++) G.landFish(os, G.fishById(o.fish));
const m0 = os.money; assert.strictEqual(G.deliverOrder(os, o), null); assert(os.money === m0 + o.pay && G.orderDone(os, o) && G.deliverOrder(os, o));
os.days++; assert.notDeepStrictEqual(G.ordersOf(os, 'port').map(x => x.id), orders.map(x => x.id));
// Margot change de village chaque jour ; le collectionneur paie le double des rares seulement ; le cartographe vend des cartes.
assert.deepStrictEqual([0, 1, 2].map(d => { os.days = d; return G.margotAt(os); }), MARGOT_ROUTE.slice(0, 3));
G.landFish(os, G.fishById('sardine')); G.landFish(os, G.fishById('thon'));
assert.strictEqual(G.sellToCollector(os, os.cargo.findIndex(f => f.id === 'sardine')), 0);
assert(G.sellToCollector(os, os.cargo.findIndex(f => f.id === 'thon')) > 0);
os.money = 5000; const h = G.buyMap(os); assert(h && os.hunts[h] === 'actif');
assert(G.buyFromMargot(os, 0).bait === 'dore' && os.baits.dore === 3);
// Le concours du dimanche : meilleur score gardé, prix et coupe à la première place.
const cs = G.newSave();
assert.match(G.startContest(cs), /dimanche/); cs.days = 6;
assert.strictEqual(G.startContest(cs, () => 0), null);
assert(G.contestCatch(cs, G.fishById('thon'), 200) && !G.contestCatch(cs, G.fishById('sardine'), 10));
const res = G.endContest(cs); assert(res.place === 1 && res.prize === 300 && cs.relics.includes('coupe'));
console.log('Tests de Little Fisher : OK');
