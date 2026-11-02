// Tests des quartiers à plan propre (quartier moderne) : parcelles réservées, tailles, hauteurs du terrain, chemins.
import assert from 'node:assert';
globalThis.location = { search: '?quartier=moderne' }; // la logique lit le quartier dans l'adresse
const S = await import('./public/district/sim.js');
const { LAYOUT } = await import('./public/district/layouts.js');

assert.strictEqual(S.PLOTS.length, LAYOUT.plots.length);
assert.strictEqual(S.SAVE_KEY, 'district-save-moderne-v1');
const villa = S.PLOTS.findIndex(p => p.kind === 'villa'), shop = S.START_PLOT;
assert.strictEqual(S.PLOTS[shop].kind, 'shop');
// villas sur les grandes parcelles, commerces sur le quai
assert(S.allowed('maison', villa) && !S.allowed('cafe', villa) && S.allowed('cafe', shop) && !S.allowed('maison', shop));
const s = S.newState(0); s.money = 1e9; s.earned = 1e9; s.sectors = [true, true, true, true];
assert(!S.build(s, 'cafe', villa), 'pas de café sur une parcelle de villa');
const m = s.money;
assert(S.build(s, 'maison', villa) && m - s.money === Math.round(S.BUILDINGS.maison.cost * S.PLOTS[villa].size), 'prix × taille');
assert(Math.abs(S.incomeOf(s, villa) - S.levelIncome('maison', 1) * S.PLOTS[villa].size * S.multiplier(s)) < 1e-9, 'revenus × taille');
assert(!S.move(s, villa, shop), 'une villa ne va pas sur le quai');
// objectifs toujours atteignables
for (const o of S.OBJECTIVES) assert(o.goal <= (o.id === 'types12' ? 8 : Infinity), o.id);
// relief : chaque terrasse à sa hauteur, rampes continues, marina sous l'eau
for (let k = 0; k < 4; k++) assert.strictEqual(LAYOUT.height(0, (LAYOUT.BAND[k][0] + LAYOUT.BAND[k][1]) / 2), LAYOUT.T[k]);
for (const r of LAYOUT.RAMPS) { assert.strictEqual(LAYOUT.height(r.x, r.z0), r.y0); assert(Math.abs(LAYOUT.height(r.x, r.z1) - r.y1) < 1e-9); }
assert(LAYOUT.height(0, 14) < 0);
// chaque parcelle est sur son terrain, et aucune déco possible sur la route
for (const p of S.PLOTS) assert.strictEqual(LAYOUT.height(p.x, p.z), p.y);
for (const z of LAYOUT.ROAD) assert(!LAYOUT.decorOK(0, z));
// chemins : un seul réseau relié (de n'importe quel point, on atteint tous les autres)
const key = ([x, z]) => `${x},${z}`, adj = new Map();
for (const path of LAYOUT.paths) for (let i = 1; i < path.length; i++) for (const [a, b] of [[path[i - 1], path[i]], [path[i], path[i - 1]]]) { if (!adj.has(key(a))) adj.set(key(a), []); adj.get(key(a)).push(key(b)); }
const seen = new Set([key(LAYOUT.paths[0][0])]), todo = [...seen];
while (todo.length) for (const n of adj.get(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
assert.strictEqual(seen.size, adj.size, 'tous les chemins sont reliés');
for (const e of LAYOUT.edges) assert(adj.has(key(e)), 'les arrivées sont sur un chemin');
console.log('Tests des plans de quartier : OK');
