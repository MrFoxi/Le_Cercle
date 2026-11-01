// Tests de Little District : économie, construction, déplacement, décorations, objectifs, hors ligne, sauvegarde,
// et un joueur robot pour vérifier le rythme de la progression.
import assert from 'node:assert';
import * as S from './public/district/sim.js';

const { BUILDINGS, PLOTS, START_PLOT } = S;
assert.strictEqual(PLOTS.length, 16);
assert.strictEqual(S.newState().plots[START_PLOT].type, 'ramen');

// Revenus, amélioration, construction
{
  const s = S.newState(0);
  const inc = S.totalIncome(s);
  assert(inc > 0);
  S.tick(s, 10);
  assert(Math.abs(s.money - (60 + inc * 10)) < 1e-6 && s.clients > 0);
  assert(!S.upgrade(s, START_PLOT) || s.plots[START_PLOT].level === 2);
  s.money = 1e6; s.earned = 1e6;
  assert(S.upgrade(s, START_PLOT) && S.totalIncome(s) > inc);
  const lot = PLOTS.findIndex((p, i) => p.sector === 0 && !s.plots[i]);
  assert(S.build(s, 'appart', lot));
  assert(!S.build(s, 'cafe', lot), 'parcelle déjà prise');
  const sale = PLOTS.findIndex(p => p.sector === 1);
  assert(!S.build(s, 'cafe', sale), 'parcelle pas encore achetée');
  assert(S.buySector(s, 1) && S.build(s, 'cafe', sale));
  S.tick(s, 120);
  assert(s.residents > 0 && s.residents <= S.capacity(s), 'des habitants emménagent');
  // Déplacer : échange de deux bâtiments
  assert(S.move(s, START_PLOT, lot));
  assert.strictEqual(s.plots[lot].type, 'ramen'); assert.strictEqual(s.plots[START_PLOT].type, 'appart');
  // Bâtiment verrouillé tant qu'on n'a pas assez gagné
  const t = S.newState(0); t.money = 1e9;
  assert(!S.build(t, 'ryotei', PLOTS.findIndex((p, i) => p.sector === 0 && !t.plots[i])));
}
// Décorations : pas sur la route ni sur un bâtiment, remboursement de moitié, rares débloquées par objectif
{
  const s = S.newState(0); s.money = 1000;
  const p = PLOTS[START_PLOT];
  assert(!S.placeDecor(s, 'banc', 3, 0), 'pas sur la chaussée');
  assert(!S.placeDecor(s, 'banc', p.x, p.z), 'pas sur un bâtiment');
  assert(S.placeDecor(s, 'banc', 0, 3));
  assert(!S.placeDecor(s, 'plante', 0.2, 3.1), 'pas collé à une autre');
  assert(!S.placeDecor(s, 'torii', 0, 5), 'décoration rare verrouillée');
  const m = s.money;
  assert(S.removeDecor(s, 0) && s.money === m + 15);
  for (let k = 0; k < 3; k++) S.placeDecor(s, 'plante', -0.6 + k * 0.6, 4);
  assert(S.claim(s, 'deco3') && s.rare.includes('puits') && !S.claim(s, 'deco3'));
  assert(S.placeDecor(s, 'puits', 0, 6));
  // Construire sur une parcelle rend les décorations qui s'y trouvaient
  const lot = PLOTS.findIndex((q, i) => q.sector === 0 && !s.plots[i]);
  s.decor.push({ id: 'banc', x: PLOTS[lot].x, z: PLOTS[lot].z, r: 0 });
  s.money = 500; s.earned = 500;
  assert(S.build(s, 'street', lot) && !s.decor.some(d => S.inPlot(d, lot)));
}
// Hors ligne : gains proportionnels, récap, pas de pénalité
{
  const s = S.newState(0);
  assert.strictEqual(S.offline(s, 30000), null, 'moins d’une minute : rien');
  const r = S.offline(s, 3600 * 1000, () => 0.9);
  assert(Math.abs(r.money - S.totalIncome(S.newState(0)) * 3600 * 0.7) < 1, 'une heure à 70 %');
  assert(r.clients > 0 && r.events.length >= 1);
  const t = S.newState(0), long = S.offline(t, 72 * 3600 * 1000, () => 0.9);
  assert(long.money > r.money * 20, 'aucun plafond');
}
// Sauvegarde : relue telle quelle, données invalides refusées
{
  const s = S.newState(0); s.money = 1234; s.decor.push({ id: 'banc', x: 0, z: 3, r: 0 });
  const back = S.load(JSON.stringify(s));
  assert.strictEqual(back.money, 1234); assert.strictEqual(back.decor.length, 1);
  assert.strictEqual(S.load('{"v":1,"plots":[]}'), null);
  assert.strictEqual(S.load('pas du json'), null);
  const bad = JSON.parse(JSON.stringify(s)); bad.plots[0] = { type: 'inconnu', level: 99 }; bad.decor.push({ id: 'x', x: 1, z: 1 });
  const fixed = S.load(JSON.stringify(bad));
  assert(fixed.plots[0] === null && fixed.decor.length === 1);
}
// Rythme : un joueur robot qui fait toujours le meilleur achat (retour sur investissement le plus court)
{
  const s = S.newState(0);
  const marks = {};
  let t = 0;
  for (; t < 40 * 3600; t += 5) {
    S.tick(s, 5);
    for (let guard = 0; guard < 20; guard++) {
      const opts = [];
      s.plots.forEach((p, i) => { if (p && p.level < S.MAX_LEVEL) opts.push({ c: S.upgradeCost(p.type, p.level), g: S.levelIncome(p.type, p.level + 1) - S.levelIncome(p.type, p.level), go: () => S.upgrade(s, i) }); });
      const lot = PLOTS.findIndex((p, i) => s.sectors[p.sector] && !s.plots[i]);
      if (lot >= 0) for (const b of Object.values(BUILDINGS)) if (b.cost && S.unlocked(s, b.id) && !s.plots.some(p => p?.type === b.id)) opts.push({ c: b.cost, g: S.levelIncome(b.id, 1), go: () => S.build(s, b.id, lot) });
      const k = s.sectors.indexOf(false);
      if (lot < 0 && k > 0) opts.push({ c: S.SECTORS[k].cost, g: S.totalIncome(s) / s.plots.filter(Boolean).length, go: () => S.buySector(s, k) });
      const best = opts.sort((a, b) => a.c / a.g - b.c / b.g)[0];
      if (!best || s.money < best.c || !best.go()) break;
    }
    for (const [k, ok] of [['rue', s.sectors[1]], ['haut', s.sectors[2]], ['jardins', s.sectors[3]], ['ryotei', s.plots.some(p => p?.type === 'ryotei')]]) if (ok && !marks[k]) marks[k] = t;
  }
  const h = x => (x / 3600).toFixed(1) + ' h';
  console.log(`  rythme du robot : Rue des lanternes ${h(marks.rue ?? Infinity)}, Haut quartier ${h(marks.haut ?? Infinity)}, Jardins ${h(marks.jardins ?? Infinity)}, ryōtei ${h(marks.ryotei ?? Infinity)}`);
  assert(marks.rue < 1800, 'la deuxième rue arrive dans la première demi-heure');
  assert(marks.jardins > 3 * 3600, 'le quartier complet demande plusieurs heures');
}
console.log('Tests de Little District : OK');
