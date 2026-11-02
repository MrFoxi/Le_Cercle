// Tests des quartiers à plan propre : parcelles réservées, tailles, hauteurs du terrain, chemins. Usage : node test-district-plans.mjs <quartier>
import assert from 'node:assert';
const Q = process.argv[2] || 'moderne';
globalThis.location = { search: `?quartier=${Q}` }; // la logique lit le quartier dans l'adresse
const S = await import('./public/district/sim.js');
const { LAYOUT } = await import('./public/district/layouts.js');

assert.strictEqual(S.PLOTS.length, LAYOUT.plots.length);
assert.strictEqual(S.SAVE_KEY, `district-save-${Q}-v1`);
if (Q === 'moderne') {
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
for (const o of S.OBJECTIVES) assert(o.goal <= (o.id === 'types12' ? 8 : Infinity), o.id);
// relief : chaque terrasse à sa hauteur, rampes continues, marina sous l'eau
for (let k = 0; k < 4; k++) assert.strictEqual(LAYOUT.height(0, (LAYOUT.BAND[k][0] + LAYOUT.BAND[k][1]) / 2), LAYOUT.T[k]);
for (const r of LAYOUT.RAMPS) { assert.strictEqual(LAYOUT.height(r.x, r.z0), r.y0); assert(Math.abs(LAYOUT.height(r.x, r.z1) - r.y1) < 1e-9); }
assert(LAYOUT.height(0, 14) < 0);
for (const z of LAYOUT.ROAD) assert(!LAYOUT.decorOK(0, z));
}
// objectifs toujours atteignables
for (const o of S.OBJECTIVES) if (o.id === 'rue1' || o.id === 'types12') assert(o.goal <= S.PLOTS.length, o.id);
const st = S.newState(0);
assert(st.plots[S.START_PLOT]?.type === 'ramen' && S.allowed('ramen', S.START_PLOT), 'le premier commerce est bien placé');
// chaque parcelle est sur son terrain, et aucune déco possible sur la route
// coin d'une parcelle (fx, fz entre -0,5 et 0,5) dans le monde, parcelle tournée de ry
const corner = (p, fx, fz) => { const lx = fx * p.w, lz = fz * p.depth, c = Math.cos(p.ry), s = Math.sin(p.ry); return [p.x + lx * c + lz * s, p.z - lx * s + lz * c]; };
for (const p of S.PLOTS) for (const [fx, fz] of [[0, 0], [-0.45, -0.45], [0.45, 0.45], [-0.45, 0.45], [0.45, -0.45]]) assert.strictEqual(LAYOUT.height(...corner(p, fx, fz)), p.y, `parcelle à plat sur son terrain (${p.x}, ${p.z})`);
// les parcelles ne se chevauchent pas
for (const a of S.PLOTS) for (const b of S.PLOTS) if (a !== b) for (const [fx, fz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]]) { const [x, z] = corner(a, fx * 0.98, fz * 0.98); assert(!S.inPlot({ x, z }, S.PLOTS.indexOf(b)), 'parcelles séparées'); }
// chaque chemin passe sur la terre ferme (pas dans la mer)
for (const path of LAYOUT.paths) for (const [x, z, y] of path) assert(y != null || LAYOUT.height(x, z) > -0.3, `chemin dans l'eau en ${x},${z}`);
// chemins : un seul réseau relié (de n'importe quel point, on atteint tous les autres)
const key = ([x, z]) => `${x},${z}`, adj = new Map();
for (const path of LAYOUT.paths) for (let i = 1; i < path.length; i++) for (const [a, b] of [[path[i - 1], path[i]], [path[i], path[i - 1]]]) { if (!adj.has(key(a))) adj.set(key(a), []); adj.get(key(a)).push(key(b)); }
const seen = new Set([key(LAYOUT.paths[0][0])]), todo = [...seen];
while (todo.length) for (const n of adj.get(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
assert.strictEqual(seen.size, adj.size, 'tous les chemins sont reliés');
for (const e of LAYOUT.edges) assert(adj.has(key(e)), 'les arrivées sont sur un chemin');
console.log(`Tests du plan « ${Q} » : OK`);
