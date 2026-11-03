// Tests de Little Fisher : le contenu se tient (chaque poisson peut mordre quelque part, missions et trésors liés),
// et la boucle de jeu marche : pêcher, remplir la cale, vendre, améliorer, rendre des missions, sauvegarder.
import assert from 'node:assert';
import { FISH, SPOTS, PEOPLE, TREASURES, UPGRADES, ZONES } from './client/data.js';
import * as G from './client/game.js';

// Chaque poisson peut mordre avec le meilleur équipement, à une heure et par un temps donnés.
const TIMES = [0.1, 0.27, 0.5, 0.79], WEATHERS = ['clair', 'pluie', 'brume'];
for (const f of FISH) {
  assert(f.zones.every(z => ZONES[z]), `${f.id} : zone inconnue`);
  const ok = f.zones.some(zone => TIMES.some(time => WEATHERS.some(weather => G.canBite(f, { zone, time, weather, rod: 3, lantern: 1 }))));
  assert(ok, `${f.id} ne peut jamais mordre`);
}
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
console.log('Tests de Little Fisher : OK');
