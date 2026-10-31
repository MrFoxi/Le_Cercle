const assert = require('node:assert');
const { Room, COLORS, CATALOG, MAX_PILOTS, EVENTS, validPos, validPing } = require('./solar/game');

(async () => {
  // Pilotes : couleurs par défaut différentes, pseudo unique, univers limité, pas de spectateurs
  {
    const r = new Room('SOL');
    r.addPlayer('A');
    r.addPlayer('B');
    assert.notStrictEqual(r.get('A').ship.color, r.get('B').ship.color);
    assert.throws(() => r.addPlayer('A'), /déjà pris/);
    assert.throws(() => r.addSpectator('S'), /tout le monde pilote/);
    for (let i = 2; i < MAX_PILOTS; i++) r.addPlayer(`P${i}`);
    assert.throws(() => r.addPlayer('Z'), /complet/);
    r.removePlayer('B');
    assert.strictEqual(r.players.length, MAX_PILOTS - 1);
  }

  // Personnalisation : seulement les éléments du catalogue ; les champs absents prennent la valeur par défaut
  {
    const r = new Room('SOL');
    r.addPlayer('A');
    r.setShip('A', { model: 'soucoupe', color: COLORS[3], paint: 'chrome', trail: 'arcenciel', boost: 'eclair', title: 'confins' });
    assert.deepStrictEqual(r.viewFor('A').players[0].ship, { model: 'soucoupe', color: COLORS[3], paint: 'chrome', trail: 'arcenciel', boost: 'eclair', title: 'confins' });
    r.setShip('A', { model: 'cargo', color: COLORS[1] });
    assert.strictEqual(r.get('A').ship.paint, 'uni');
    for (const bad of [{ model: 'cargo', color: 'red' }, { model: 'ovni', color: COLORS[0] }, { model: 'cargo', color: COLORS[0], trail: 'laser' }, { model: 'cargo', color: COLORS[0], title: 'roi' }, null]) {
      assert.throws(() => r.setShip('A', bad), /inconnu/);
    }
  }

  // Événements en direct : calme, puis tempête (alerte 2 min, puis active), puis retour au calme
  {
    let now = 1e12;
    const seq = [0.99, 0.7, 0.1, 0.3]; // gap, type (storm = 3e sur 3), cible, graine
    const r = new Room('SOL', () => seq.shift() ?? 0.5, false, () => now);
    assert.strictEqual(r.event, null);
    assert.ok(r.deadline > now && r.deadline <= now + 8 * 60000);
    now = r.deadline;
    r.timeout();
    assert.strictEqual(r.event.type, 'storm');
    assert.strictEqual(r.event.phase, 'warning');
    assert.strictEqual(r.deadline, now + EVENTS.storm.warning);
    now = r.deadline;
    r.timeout();
    assert.strictEqual(r.event.phase, 'active');
    assert.strictEqual(r.event.end, now + EVENTS.storm.active);
    assert.strictEqual(r.viewFor('x').event.type, 'storm');
    assert.strictEqual(r.viewFor('x').time, now);
    now = r.deadline;
    r.timeout();
    assert.strictEqual(r.event, null);
    assert.ok(r.deadline >= now + 4 * 60000);
    // Une pluie de météorites commence directement, autour d'un astre connu
    const m = new Room('SOL', () => 0, false, () => now);
    m.timeout();
    assert.strictEqual(m.event.type, 'meteors');
    assert.strictEqual(m.event.phase, 'active');
    assert.strictEqual(m.event.target, 'terre');
  }

  // Messages relayés : positions et pings bien formés, rien d'autre
  assert.ok(validPos([1, 2, 3, 0, 0, 0, 1, 50, 0]));
  assert.ok(!validPos([1, 2, 3]));
  assert.ok(!validPos([1, 2, 3, 0, 0, 0, 1, 50, NaN]));
  assert.ok(!validPos([1, 2, '3', 0, 0, 0, 1, 50, 0]));
  assert.ok(!validPos([1e9, 2, 3, 0, 0, 0, 1, 50, 0]));
  assert.ok(validPing({ host: 'mars', at: [1, 2, 3] }));
  assert.ok(validPing({ host: '', at: [1, 2, 3] }));
  assert.ok(!validPing({ host: '<script>', at: [1, 2, 3] }));
  assert.ok(!validPing({ host: 'mars', at: [1, 2] }));
  assert.ok(!validPing(null));

  // Progression (module du navigateur) : découvertes, points, déblocages, titres ; mêmes identifiants que le serveur
  const { createProgress, CATALOG: CLIENT, TITLES } = await import('./public/solar/progress.js');
  for (const k of ['model', 'paint', 'trail', 'boost']) assert.deepStrictEqual(Object.keys(CLIENT[k]), CATALOG[k], `catalogue ${k} identique`);
  assert.deepStrictEqual(Object.keys(TITLES), CATALOG.title);
  const mem = {};
  const store = { get: k => mem[k] ?? null, set: (k, v) => (mem[k] = v) };
  const places = [{ id: 'saturne', kind: 'planet' }, { id: 'titan', kind: 'moon' }, { id: 'horizon', kind: 'station' }, { id: 'halley', kind: 'comet' }];
  const p = createProgress(places, store);
  assert.strictEqual(p.points(), 0);
  let res = p.discover('saturne');
  assert.strictEqual(res.gained, 100);
  assert.ok(res.unlocks.some(u => u.kind === 'paint' && u.id === 'bandes'), 'bandes débloquées à 100 points');
  assert.strictEqual(p.discover('saturne'), null, 'pas deux fois');
  res = p.discover('titan');
  assert.deepStrictEqual(res.titles, ['Explorateur de Saturne']);
  assert.strictEqual(p.percent(), 50);
  assert.strictEqual(p.discover('inconnu'), null);
  assert.strictEqual(p.discover('visiteuse-1', 150).gained, 150, 'bonus de la comète de passage');
  assert.strictEqual(p.travel(4e6), null);
  assert.strictEqual(p.travel(2e6).gained, 10, '10 points tous les 5 millions de km');
  // Sauvegardée : une nouvelle session retrouve tout
  const again = createProgress(places, store);
  assert.strictEqual(again.points(), 100 + 60 + 150 + 10);
  assert.ok(again.titles().includes('explorateur-saturne'));

  console.log('Tests de Solar Explorer : OK');
})().catch(e => { console.error(e); process.exit(1); });
