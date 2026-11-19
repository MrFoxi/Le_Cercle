// LES EAUX DE MONET : l'étang se parcourt, les poissons vivent selon leur espèce, et une partie de pêche va du lancer à la prise
import test from 'node:test';
import assert from 'node:assert';
import { ETANG, ESPECES, LEURRES, CANNES, LIEUX, TEMPS, espece } from './client/reglages.js';
import { hauteur, profondeur, dansLEau, sol, surPont, hauteurPont, secteurEn, habitat, NENUPHARS, ARBRES, abri, hasard } from './client/etang.js';
import { creerPoissons, majPoissons, activite, poidsDe } from './client/poissons.js';
import { creerPeche } from './client/peche.js';
import { creerCarnet } from './client/carnet.js';
import { creerTemps, momentDe } from './client/temps.js';

test('l’étang : cinq secteurs au bord de l’eau, chacun différent, tous accessibles à pied', () => {
  assert.strictEqual(ETANG.secteurs.length, 5);
  const { x, z } = ETANG.depart; assert.ok(hauteur(x, z) > 0, 'on part sur la berge');
  // à pied depuis le départ : on inonde la berge, le gué et le pont
  const vu = new Set(), file = [[Math.round(x), Math.round(z)]], ok = (a, b) => (hauteur(a, b) > -ETANG.gue || surPont(a, b)) && Math.hypot(a, b) < ETANG.limite;
  while (file.length) { const [a, b] = file.pop(), k = a + ',' + b; if (vu.has(k) || !ok(a, b)) continue; vu.add(k); file.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
  for (const s of ETANG.secteurs) {
    assert.ok(hauteur(s.x, s.z) > -ETANG.gue, `${s.id} : le poste est à pied sec`);
    assert.ok(vu.has(Math.round(s.x) + ',' + Math.round(s.z)), `${s.id} : on y arrive à pied`);
    let eau = false; for (let a = 0; a < 6.28; a += 0.2) if (dansLEau(s.x + Math.cos(a) * 22, s.z + Math.sin(a) * 22)) eau = true; assert.ok(eau, `${s.id} : l’eau est à portée de lancer`);
  }
  assert.ok(profondeur(-33, -33) > 4, 'le trou du vieux saule est profond'); assert.ok(profondeur(44, -8) < 2.2, 'les nénuphars sont en eau basse');
  assert.ok(NENUPHARS.length > 150, 'beaucoup de nénuphars'); assert.ok(ARBRES.filter(a => a.genre === 'saule').length >= 3);
  assert.ok(sol(6, -40, 5) > 1.5, 'le pont passe au-dessus de l’eau'); assert.ok(sol(6, -40, -1) < 0, 'on peut passer dessous');
  const P = ETANG.pont; let y = sol(...P.a); for (let t = 0; t <= 1; t += 0.01) { const h = sol(P.a[0] + (P.b[0] - P.a[0]) * t, P.a[1], 9); assert.ok(Math.abs(h - y) < 0.5, 'une marche sur le pont'); y = h; }
});

test('chaque espèce a son habitat, ses heures, et une fiche complète', () => {
  assert.strictEqual(ESPECES.length, 6);
  for (const e of ESPECES) {
    for (const k of ['nom', 'latin', 'description', 'habitatTxt', 'comportement']) assert.ok(e[k], `${e.id} : ${k}`);
    assert.ok(poidsDe(e, e.longueur[1]) > poidsDe(e, e.longueur[0]));
    const P = creerPoissons(3).filter(f => f.sp === e); assert.strictEqual(P.length, e.nombre);
    for (const f of P) assert.ok(profondeur(f.x, f.z) > 0.3, `${e.id} : dans l’eau`);
  }
  const s = espece('sandre'), L = creerPoissons(5);
  assert.ok(L.filter(f => f.sp === s).every(f => profondeur(...f.home) > 1.2), 'le sandre vit dans le profond');
  assert.ok(activite(s, 20, 'couvert') > activite(s, 13, 'soleil') * 4, 'le sandre chasse à la lumière basse');
  assert.ok(L.filter(f => f.sp.id === 'rotengle').every(f => abri(...f.home).nenuphar + abri(...f.home).roseau > 0.1), 'le rotengle reste sous les feuilles');
  assert.ok(!espece('gardon').appat && !espece('rotengle').appat, 'gardons et rotengles ne se pêchent pas aux leurres');
  assert.ok(habitat(espece('brochet').habitat, 44, -8) > habitat(espece('brochet').habitat, 0, 0), 'le brochet préfère les nénuphars');
});

test('les poissons restent dans l’eau, se tiennent à leur profondeur et fuient les pas lourds', () => {
  const L = creerPoissons(11), m = { heure: 9, meteo: 'couvert', pluie: 0, brume: 0, force: 1, joueur: { x: 200, z: 200, vitesse: 0 }, leurre: null };
  for (let i = 0; i < 2400; i++) { m.t = i / 20; majPoissons(L, 0.05, m); }
  for (const f of L) { assert.ok(profondeur(f.x, f.z) > 0.25, `${f.sp.id} au sec`); assert.ok(f.y < 0 && f.y > -profondeur(f.x, f.z) - 0.05, `${f.sp.id} hors de l’eau`); }
  const c = L.find(f => f.sp.id === 'chevesne'); majPoissons(L, 0.05, { ...m, joueur: { x: c.x + 2, z: c.z, vitesse: 4.5 } }); assert.strictEqual(c.etat, 'fuit', 'un pas lourd effraie le chevesne');
});

// un pêcheur patient : il lance vers les poissons, anime bien, ferre, tient la tension
function partie(leurreId, canneId, espId, seed) {
  let n = seed; const rnd = hasard(n), L = creerPoissons(seed), P = creerPeche(rnd), cible = L.find(f => f.sp.id === espId);
  P.choisir(CANNES.find(c => c.id === canneId), LEURRES.find(l => l.id === leurreId));
  const a = Math.atan2(cible.x, cible.z), bord = { x: cible.x - Math.sin(a) * 14, y: 1.4, z: cible.z - Math.cos(a) * 14 }, dir = { x: Math.sin(a), z: Math.cos(a) };
  const hist = new Set(); let t = 0, tir = 0, lat = 0;
  for (let i = 0; i < 30 * 60 * 20 && P.etat !== 'prise'; i++) {
    const dt = 1 / 20; t += dt; tir -= dt; const fam = P.leurreChoisi.famille; hist.add(P.etat);
    const e = { pos: bord, dir, heure: 19, meteo: 'couvert', charge: false, moulinet: false, tiree: false, ferrer: false, prendre: false, lateral: 0 };
    if (P.etat === 'repos') e.charge = true; if (P.etat === 'charge') e.charge = P.puissance < 0.62;
    if (P.etat === 'eau') { if (P.l.accroche) e.tiree = tir <= 0; else if (fam === 'tournant') e.moulinet = true; else { P.vitesse = 0; e.moulinet = fam === 'souple' ? (t % 3) < 0.5 : false; if (tir <= 0) { e.tiree = true; tir = fam === 'nageur' ? 1.4 : 1.8; } } if (P.l.accroche && tir <= 0) tir = 0.5; }
    if (P.etat === 'touche') e.ferrer = true;
    if (P.etat === 'combat') { e.moulinet = P.tension < 0.68; e.lateral = -P.combat.cote; }
    if (P.etat === 'epuisette') e.prendre = true;
    P.maj(dt, e);
    const ev = majPoissons(L, dt, { t, heure: 19, meteo: 'couvert', pluie: 0, brume: 0, force: 0.9, joueur: { x: bord.x, z: bord.z, vitesse: 0 }, leurre: P.vueLeurre() });
    for (const x of ev) if (x.type === 'touche') P.touche(x.f);
  }
  return { P, hist };
}

test('une partie complète : lancer, animer, touche, ferrage, combat, prise', () => {
  for (const [l, c, e] of [['jerk', 'forte', 'brochet'], ['cuiller', 'legere', 'perche'], ['shad', 'forte', 'sandre'], ['vairon', 'legere', 'chevesne']]) {
    let pris = 0, espece = new Set(), etats = new Set();
    for (let s = 1; s <= 8; s++) { const { P, hist } = partie(l, c, e, s * 13); hist.forEach(h => etats.add(h)); if (P.etat === 'prise') { pris++; espece.add(P.resultat.espece); assert.ok(P.resultat.longueur > 0 && P.resultat.poids > 0); } }
    assert.ok(pris >= 3, `${e} au ${l} : seulement ${pris} prises sur 8`);
    for (const h of ['repos', 'charge', 'vol', 'eau', 'touche', 'combat', 'epuisette']) assert.ok(etats.has(h), `${e} : l’étape ${h} n’a pas eu lieu`);
    assert.ok(espece.has(e), `${e} au ${l} : ne prend jamais l’espèce visée (${[...espece]})`);
  }
});

test('la pêche n’est pas gratuite : sans animer on ne prend rien, trop tirer casse, trop tard c’est raté', () => {
  // leurre lancé puis abandonné : aucune touche
  const L = creerPoissons(21), P = creerPeche(hasard(4)); P.choisir(CANNES[0], LEURRES[2]); const f = L.find(x => x.sp.id === 'perche'), dir = { x: 0, z: 1 }, pos = { x: f.x, y: 1.4, z: f.z - 12 };
  let t = 0; while (P.etat !== 'eau' && t < 10) { t += 0.05; P.maj(0.05, { pos, dir, charge: P.etat === 'repos' || (P.etat === 'charge' && P.puissance < 0.4) }); }
  assert.strictEqual(P.etat, 'eau'); let touches = 0;
  for (let i = 0; i < 2400; i++) { P.maj(0.05, { pos, dir }); for (const e of majPoissons(L, 0.05, { heure: 9, meteo: 'couvert', pluie: 0, brume: 0, force: 1, joueur: { x: pos.x, z: pos.z, vitesse: 0 }, leurre: P.vueLeurre() })) if (e.type === 'touche') touches++; }
  assert.strictEqual(touches, 0, 'un leurre immobile n’intéresse personne');
  // combat : mouliner sans relâche avec la canne légère sur un gros brochet casse la ligne
  const B = creerPoissons(9).find(x => x.sp.id === 'brochet'); B.longueur = 104; const Q = creerPeche(hasard(8)); Q.choisir(CANNES[0], LEURRES[3]); Q.etat = 'eau'; Object.assign(Q.l, { x: 0, y: -1, z: 20 }); Q.touche(B); Q.maj(0.05, { pos: { x: 0, y: 1, z: 0 }, dir, ferrer: true }); assert.strictEqual(Q.etat, 'combat');
  let i = 0; for (; i < 2000 && Q.etat === 'combat'; i++) Q.maj(0.05, { pos: { x: 0, y: 1, z: 0 }, dir, moulinet: true, lateral: Q.combat.cote }); assert.strictEqual(Q.etat, 'repos', 'la ligne a cassé');
  // touche : sans ferrer, le poisson repart
  const G = creerPoissons(9).find(x => x.sp.id === 'perche'), R = creerPeche(hasard(2)); R.etat = 'eau'; Object.assign(R.l, { x: 0, y: -1, z: 20 }); R.touche(G); for (let k = 0; k < 40; k++) R.maj(0.05, { pos: { x: 0, y: 1, z: 0 }, dir }); assert.strictEqual(R.etat, 'eau'); assert.strictEqual(G.etat, 'fuit');
});

test('le carnet : observer ouvre la fiche, pêcher la complète, la progression ouvre un lieu', () => {
  const mem = new Map(), stock = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }, C = creerCarnet(stock), L = LIEUX.find(l => l.condition);
  assert.strictEqual(C.observer('gardon'), true); assert.strictEqual(C.observer('gardon'), false);
  const r = { espece: 'perche', longueur: 30, poids: 0.5, secteur: 'pont', leurre: 'cuiller', canne: 'legere', heure: 9, meteo: 'soleil' };
  assert.deepStrictEqual(C.prise(r), { nouvelle: true, record: false }); assert.deepStrictEqual(C.prise({ ...r, longueur: 35 }), { nouvelle: false, record: true });
  const F = C.fiche('perche'); assert.strictEqual(F.record.longueur, 35); assert.deepStrictEqual(F.leurres, ['cuiller']); assert.deepStrictEqual(F.moments, ['matin']);
  assert.ok(!C.debloque(L)); for (const s of ETANG.secteurs) C.secteur(s.id); C.observer('rotengle'); C.observer('brochet'); C.geste('banc'); assert.deepStrictEqual(C.verifierLieux(), []); C.geste('suit');
  assert.strictEqual(C.verifierLieux()[0].id, 'peupliers'); assert.ok(creerCarnet(stock).fiche('perche'), 'le carnet est retenu');
});

test('le temps : quatre moments, la météo change lentement et change la lumière', () => {
  assert.deepStrictEqual([3, 8, 13, 19].map(h => momentDe(h).id), ['nuit', 'matin', 'jour', 'soir']);
  const T = creerTemps(hasard(3), { heure: 12 }), midi = T.lumiere.force; T.changer('pluie'); for (let i = 0; i < 40; i++) T.maj(0.05); assert.ok(T.pluie < 0.4, 'le changement est progressif');
  for (let i = 0; i < 4000; i++) T.maj(0.05); assert.ok(T.pluie > 0.5 || T.meteo !== 'pluie'); assert.ok(TEMPS.dureeJour > 600);
  const N = creerTemps(hasard(1), { heure: 2 }); assert.ok(N.lumiere.force < midi * 0.6, 'la nuit est sombre'); assert.ok(N.lumiere.nuit > 0.8);
});
