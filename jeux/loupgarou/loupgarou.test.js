// Tests du Loup-Garou : composition, nuit (loups, voyante, sorcière), aube, vote et égalité, chasseur, fin de partie,
// déplacements contrôlés, emotes et objets lancés, fil muet la nuit, et parties complètes entre robots.
const assert = require('assert');
const LG = require('./client/rules');
const { Room, T } = require('./server/game');

let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Composition
assert.deepStrictEqual(LG.composition(4), ['loup', 'voyante', 'villageois', 'villageois']);
assert.strictEqual(LG.composition(8).filter(r => r === 'loup').length, 2);
assert.strictEqual(LG.composition(12).filter(r => r === 'loup').length, 3);
for (let n = 4; n <= 12; n++) assert.strictEqual(LG.composition(n).length, n);
assert(LG.validLook(LG.randomLook(rng)));
assert(!LG.validLook([0, 0, 0, 0, 0, 0, 99]) && !LG.validLook('x'));
// Sièges sur la place, hors de la fontaine
for (const s of LG.SEATS) { const p = LG.collide({ x: s.x, z: s.z }); assert(Math.hypot(p.x - s.x, p.z - s.z) < 1e-9, 'siège libre'); }

// Un salon de n joueurs humains, horloge à la main ; les rôles sont imposés pour les tests.
function setup(roles) {
  let now = 1000;
  const r = new Room('ABCDE', rng, false, () => now);
  const names = Object.keys(roles);
  for (const n of names) r.addPlayer(n);
  const fx = [];
  r.send = (ev, f) => fx.push(f);
  r.start(names[0]); r.stop();
  r.roles = { ...roles };
  r.at = v => (now = v); r.now = () => now; r.fx = fx;
  r.skip = () => { now = r.deadline; r.timeout(); r.stop(); };
  return r;
}

{
  const r = setup({ Ana: 'loup', Bob: 'voyante', Cid: 'sorciere', Dan: 'chasseur', Eve: 'villageois', Fox: 'villageois', Gus: 'loup' });
  assert.strictEqual(r.phase, 'reveal');
  // Ce que chacun sait : son rôle, et les loups se reconnaissent
  assert.deepStrictEqual(r.viewFor('Eve').roles, { Eve: 'villageois' });
  assert.deepStrictEqual(r.viewFor('Ana').roles, { Ana: 'loup', Gus: 'loup' });
  r.skip();
  assert.strictEqual(r.phase, 'night'); assert.strictEqual(r.step, 'wolves');
  // personne ne parle la nuit dans le fil commun ; la meute chuchote
  assert(!r.canChat('Eve'));
  r.whisper('Ana', 'On prend Eve ?');
  assert.throws(() => r.whisper('Eve', 'coucou'), /meute/);
  assert.strictEqual(r.viewFor('Gus').wolfChat.length, 1); assert.strictEqual(r.viewFor('Eve').wolfChat.length, 0);
  // choix interdits
  assert.throws(() => r.wolf('Eve', 'Bob'), /loups/);
  assert.throws(() => r.wolf('Ana', 'Gus'), /villageois/);
  assert.throws(() => r.potion('Cid', 'heal'), /moment/);
  // voyante : une carte par nuit
  r.see('Bob', 'Gus');
  assert.throws(() => r.see('Bob', 'Ana'), /déjà/);
  assert.strictEqual(r.viewFor('Bob').roles.Gus, 'loup');
  // les loups se mettent d'accord : la nuit s'accélère
  r.wolf('Ana', 'Eve'); const before = r.deadline; r.wolf('Gus', 'Eve');
  assert(r.deadline < before);
  r.skip();
  assert.strictEqual(r.step, 'witch');
  assert.strictEqual(r.viewFor('Cid').victim, 'Eve'); assert.strictEqual(r.viewFor('Bob').victim, null);
  r.potion('Cid', 'heal');
  assert.throws(() => r.potion('Cid', 'heal'), /Pas de potion/);
  r.potion('Cid', 'done');
  r.skip();
  assert.strictEqual(r.phase, 'dawn'); assert.strictEqual(r.deaths.length, 0, 'sauvée par la sorcière');
  r.skip();
  assert.strictEqual(r.phase, 'day'); assert(r.canChat('Eve'));
  // déplacements : contrôlés, pas de téléportation, on s'assied sur un siège libre
  const b = r.bodies.Eve, s = LG.SEATS[r.seats.Eve];
  r.at(r.now() + 500); r.move('Eve', { x: s.x + 1, z: s.z, ry: 0, s: -1 });
  assert(Math.abs(b.x - (s.x + 1)) < 0.5 && b.sit === -1);
  r.at(r.now() + 100); r.move('Eve', { x: s.x + 30, z: s.z, ry: 0 }); assert(b.x < s.x + 2, 'téléportation refusée');
  const l = LG.LANTERNS[0];
  r.at(r.now() + 3000); r.move('Eve', { x: l.x, z: l.z, ry: 0 }); assert(Math.hypot(b.x - l.x, b.z - l.z) >= 0.6, 'pas dans une lanterne');
  const other = LG.SEATS[r.seats.Fox];
  r.at(r.now() + 3000); r.move('Eve', { x: other.x, z: other.z, ry: 0, s: r.seats.Fox }); assert.strictEqual(b.sit, -1, 'siège déjà pris');
  // emotes et objets lancés : relayés, avec une attente entre deux
  r.emote('Eve', 'rire'); r.emote('Eve', 'danser'); r.emote('Eve', 'inventé');
  assert.strictEqual(r.fx.filter(f => f.kind === 'emote').length, 1);
  r.toss('Eve', 'tomate', 'Ana'); r.toss('Eve', 'tomate', 'Ana');
  assert.strictEqual(r.fx.filter(f => f.kind === 'toss').length, 1); assert.strictEqual(r.hits.Ana, 1);
  r.toss('Fox', 'tomate', 'Fox'); r.toss('Fox', 'enclume', 'Ana');
  assert.strictEqual(r.fx.filter(f => f.kind === 'toss').length, 1, 'ni sur soi, ni objet inconnu');
  // tout le monde est prêt : on passe au vote
  for (const n of r.alive()) r.rush(n);
  r.skip();
  assert.strictEqual(r.phase, 'vote');
  assert.strictEqual(b.sit, r.seats.Eve, 'retour à son siège pour voter');
  // égalité : personne n'est chassé
  r.vote('Ana', 'Bob'); r.vote('Gus', 'Bob'); r.vote('Bob', 'Gus'); r.vote('Cid', 'Gus');
  assert.throws(() => r.vote('Eve', 'Eve'), /autre/);
  r.skip();
  assert.strictEqual(r.phase, 'verdict'); assert(r.verdict.tie); assert(r.alive().length === 7);
  r.skip();
  // nuit 2 : les loups tuent le chasseur, la sorcière empoisonne Gus ; à l'aube le chasseur tire
  assert.strictEqual(r.phase, 'night'); assert.strictEqual(r.dayNo, 2);
  r.wolf('Ana', 'Dan'); r.wolf('Gus', 'Dan'); r.skip();
  r.potion('Cid', 'kill', 'Gus'); r.skip();
  assert.deepStrictEqual(r.deaths.map(d => d.name).sort(), ['Dan', 'Gus']);
  assert.strictEqual(r.viewFor('Eve').roles.Gus, 'loup', 'le rôle des morts est révélé');
  r.skip();
  assert.strictEqual(r.phase, 'hunter'); assert.strictEqual(r.viewFor('Eve').hunter, 'Dan');
  assert.throws(() => r.shoot('Eve', 'Ana'), /pas à toi/);
  r.shoot('Dan', 'Ana');
  assert(!r.life.Ana);
  r.skip();
  // plus de loups : le village gagne, gagnants vivants +2, morts +1, loups 0
  assert.strictEqual(r.phase, 'roundEnd'); assert.strictEqual(r.winner, 'village');
  assert.strictEqual(r.get('Eve').points, 2); assert.strictEqual(r.get('Dan').points, 1); assert.strictEqual(r.get('Ana').points, 0);
  assert(r.canChat('Gus'), 'fin de partie : tout le monde parle');
  r.skip();
  assert.strictEqual(r.phase, 'over'); assert.strictEqual(r.ranking[0].points, 2);
}

// Les loups gagnent dès qu'ils sont aussi nombreux que les autres ; un joueur qui part meurt.
{
  const r = setup({ Ana: 'loup', Bob: 'villageois', Cid: 'villageois', Dan: 'villageois' });
  r.skip(); r.wolf('Ana', 'Bob'); r.skip();
  assert.strictEqual(r.phase, 'dawn'); r.skip();
  assert.strictEqual(r.phase, 'day');
  r.removePlayer('Cid');
  assert.strictEqual(r.phase, 'roundEnd'); assert.strictEqual(r.winner, 'loups');
}

// Un chasseur robot tué la nuit tire sa flèche sans attendre la fin du temps.
{
  let now = 0;
  const r = new Room('HUNT1', rng, false, () => now);
  r.addPlayer('Moi'); for (let k = 0; k < 6; k++) r.addBot('Moi');
  r.send = () => {};
  r.start('Moi'); r.stop();
  const names = r.names(), bot = names[1];
  r.roles = Object.fromEntries(names.map((n, k) => [n, k === 0 ? 'loup' : k === 1 ? 'chasseur' : k === 2 ? 'loup' : 'villageois']));
  now = r.deadline; r.timeout(); r.stop();
  r.wolf('Moi', bot); r.wolf(names[2], bot);
  now = r.deadline; r.timeout(); r.stop(); // pas de sorcière : l'aube
  now = r.deadline; r.timeout(); r.stop();
  assert.strictEqual(r.phase, 'hunter');
  const end = r.deadline;
  for (let t = 0; t < 100 && !r.shot; t++) { now += 100; r.tick(); }
  assert(r.shot && now < end, 'le chasseur robot a tiré');
}

// Parties complètes entre robots (un humain spectateur dans son rôle) : elles se terminent toutes.
for (let game = 0; game < 30; game++) {
  let now = 0;
  const r = new Room('BOTS1', rng, false, () => now);
  r.addPlayer('Moi');
  const n = 4 + (game % 9);
  for (let k = 1; k < n; k++) r.addBot('Moi');
  r.configure('Moi', 'day', 60); r.configure('Moi', 'rounds', 2);
  r.send = () => {};
  r.start('Moi'); r.stop();
  let guard = 0;
  while (r.phase !== 'over' && guard++ < 20000) {
    now += 100; r.tick();
    if (r.phase === 'vote' && r.life.Moi && !r.votes.Moi) r.vote('Moi', r.alive().find(x => x !== 'Moi'));
    r.timeout(); r.stop();
  }
  assert.strictEqual(r.phase, 'over', `partie ${game} (${n} joueurs) terminée`);
  assert.strictEqual(r.ranking.length, n);
  assert(r.log.some(l => l.includes('ont gagné') || l.includes('a gagné')));
}

console.log('Loup-Garou : tests OK');
