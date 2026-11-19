// LES EAUX DE MONET : l'étang se parcourt, les poissons vivent selon leur espèce, et une partie de pêche va du lancer à la prise
import test from 'node:test';
import assert from 'node:assert';
import { ETANG, ESPECES, LEURRES, CANNES, LIEUX, TEMPS, LEGENDES, espece } from './client/reglages.js';
import { parler, DEFIS } from './client/jardinier.js';
import { esquisse } from './client/chevalet.js';
import { hauteur, profondeur, dansLEau, sol, surPont, hauteurPont, secteurEn, habitat, NENUPHARS, ARBRES, abri, hasard } from './client/etang.js';
import { creerPoissons, majPoissons, activite, poidsDe } from './client/poissons.js';
import { creerPeche } from './client/peche.js';
import { creerCarnet } from './client/carnet.js';
import { creerTemps, momentDe } from './client/temps.js';
import { MORCEAUX, composer, lireMesure, lireAccord } from './client/partition.js';
import { INSTRUMENTS, SR, rendre, boucleEau, boucleVent, bouclePluie, boucleGrillons, reponse } from './client/instruments.js';

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
    const P = creerPoissons(3).filter(f => f.sp === e && !f.legende); assert.strictEqual(P.length, e.nombre);
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
function partie(leurreId, canneId, espId, seed, { heure = 19, meteo = 'couvert', legende = null } = {}) {
  let n = seed; const rnd = hasard(n), L = creerPoissons(seed), P = creerPeche(rnd), cible = L.find(f => (legende ? f.legende?.id === legende : f.sp.id === espId && !f.legende));
  P.choisir(CANNES.find(c => c.id === canneId), LEURRES.find(l => l.id === leurreId));
  let a = Math.atan2(cible.x, cible.z), recul = 14;
  // pour une légende, on se poste sur la berge, face à elle, à une portée de lancer : le leurre tombe juste derrière
  if (legende) { recul = P.canne.portee * (0.25 + 0.62 * 0.75) - 5.5; for (let k = 0; k < 48; k++) { const b = k * Math.PI / 24, x = cible.x - Math.sin(b) * recul, z = cible.z - Math.cos(b) * recul; if (hauteur(x, z) > 0.1 && Math.hypot(x, z) < ETANG.limite - 4) { a = b; break; } } }
  const bord = { x: cible.x - Math.sin(a) * recul, y: 1.4, z: cible.z - Math.cos(a) * recul }, dir = { x: Math.sin(a), z: Math.cos(a) };
  const hist = new Set(); let t = 0, tir = 0, lat = 0;
  for (let i = 0; i < 30 * 60 * 20 && P.etat !== 'prise'; i++) {
    const dt = 1 / 20; t += dt; tir -= dt; const fam = P.leurreChoisi.famille; hist.add(P.etat);
    const e = { pos: bord, dir, heure, meteo, charge: false, moulinet: false, tiree: false, ferrer: false, prendre: false, lateral: 0 };
    if (P.etat === 'repos') e.charge = true; if (P.etat === 'charge') e.charge = P.puissance < 0.62;
    if (P.etat === 'eau') { if (P.l.accroche) e.tiree = tir <= 0; else if (fam === 'tournant') e.moulinet = true; else { P.vitesse = 0; e.moulinet = fam === 'souple' ? (t % 3) < 0.5 : false; if (tir <= 0) { e.tiree = true; tir = fam === 'nageur' ? 1.4 : 1.8; } } if (P.l.accroche && tir <= 0) tir = 0.5; }
    if (P.etat === 'touche') e.ferrer = true;
    if (P.etat === 'combat') { e.moulinet = P.tension < 0.68; e.lateral = -P.combat.cote; }
    if (P.etat === 'epuisette') e.prendre = true;
    P.maj(dt, e);
    const ev = majPoissons(L, dt, { t, heure, meteo, pluie: 0, brume: 0, force: 0.9, joueur: { x: bord.x, z: bord.z, vitesse: 0 }, leurre: P.vueLeurre() });
    for (const x of ev) if (x.type === 'touche') P.touche(x.f);
  }
  return { P, hist, cible };
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
  assert.deepStrictEqual(C.prise(r), { nouvelle: true, record: false, legende: false }); assert.deepStrictEqual(C.prise({ ...r, longueur: 35 }), { nouvelle: false, record: true, legende: false });
  const F = C.fiche('perche'); assert.strictEqual(F.record.longueur, 35); assert.deepStrictEqual(F.leurres, ['cuiller']); assert.deepStrictEqual(F.moments, ['matin']);
  assert.ok(!C.debloque(L)); for (const s of ETANG.secteurs) C.secteur(s.id); C.observer('rotengle'); C.observer('brochet'); C.geste('banc'); assert.deepStrictEqual(C.verifierLieux(), []); C.geste('suit');
  assert.strictEqual(C.verifierLieux()[0].id, 'peupliers'); assert.ok(creerCarnet(stock).fiche('perche'), 'le carnet est retenu');
});

test('le temps : quatre moments, la météo change lentement et change la lumière', () => {
  assert.deepStrictEqual([3, 8, 13, 19, 22, 23.9].map(h => momentDe(h).id), ['nuit', 'matin', 'jour', 'soir', 'nuit', 'nuit']);
  const T = creerTemps(hasard(3), { heure: 12 }), midi = T.lumiere.force; T.changer('pluie'); for (let i = 0; i < 40; i++) T.maj(0.05); assert.ok(T.pluie < 0.4, 'le changement est progressif');
  for (let i = 0; i < 4000; i++) T.maj(0.05); assert.ok(T.pluie > 0.5 || T.meteo !== 'pluie'); assert.ok(TEMPS.dureeJour > 600);
  // les réglages : une météo imposée tout de suite, le temps arrêté
  const U = creerTemps(hasard(4), { heure: 10 }); U.imposer('pluie'); assert.strictEqual(U.pluie, 1); assert.strictEqual(U.meteo, 'pluie'); U.fige = true; U.heure = 19; for (let i = 0; i < 4000; i++) U.maj(0.05); assert.strictEqual(U.heure, 19); assert.strictEqual(U.meteo, 'pluie');
  const N = creerTemps(hasard(1), { heure: 2 }); assert.ok(N.lumiere.force < midi * 0.6, 'la nuit est sombre'); assert.ok(N.lumiere.nuit > 0.8);
});

test('la bande originale : chaque mesure est juste, le chant ne frotte pas contre son accord, chaque moment a sa pièce', () => {
  assert.deepStrictEqual(MORCEAUX.map(m => m.id).sort(), ['jour', 'matin', 'nuit', 'pluie', 'soir']);
  for (const P of MORCEAUX) for (const nom of ['A', 'B']) {
    const S = P[nom]; assert.strictEqual(S.accords.length, S.chant.length, P.id);
    S.chant.forEach((c, i) => {
      const notes = lireMesure(c), total = notes.reduce((s, n) => s + n.dur, 0); assert.strictEqual(total, P.mesure, P.id + nom + (i + 1) + ' : ' + total + ' temps');
      const accord = lireAccord(S.accords[i]).map(m => m % 12);
      for (const n of notes) if (n.note !== null && n.dur >= 1) for (const a of accord) assert.notStrictEqual((n.note - a + 12) % 12, 1, P.id + nom + (i + 1) + ' : neuvième mineure contre l accord (' + c + ')'); // la septième majeure, elle, est la couleur recherchée
    });
  }
  for (const P of MORCEAUX) { const a = composer(P, 1), b = composer(P, 2); assert.ok(a.duree > 75 && a.duree < 240, P.id + ' dure ' + a.duree); assert.ok(a.notes.every(n => INSTRUMENTS.includes(n.inst) && n.m >= 24 && n.m <= 100 && n.t >= 0 && n.t < a.duree && n.v > 0 && n.v <= 1)); assert.notDeepStrictEqual(a.notes.map(n => n.t), b.notes.map(n => n.t), 'deux écoutes diffèrent'); }
});
test('la lutherie : chaque instrument sonne, sans saturer ni claquer, et les nappes bouclent sans couture', () => {
  const sain = (d, nom) => { let m = 0; for (const x of d) { assert.ok(Number.isFinite(x), nom); m = Math.max(m, Math.abs(x)); } assert.ok(m > 0.3 && m <= 1, nom + ' : crête ' + m); };
  for (const inst of INSTRUMENTS) for (const m of [43, 67, 86]) { const d = rendre(inst, m, 1.5); sain(d, inst + m); assert.ok(Math.abs(d[d.length - 1]) < 0.02, inst + m + ' finit net'); assert.ok(Math.abs(d[0]) < 0.02, inst + m + ' commence net'); }
  for (const [nom, f] of Object.entries({ boucleEau, boucleVent, bouclePluie, boucleGrillons })) for (const c of f()) { sain(c, nom); let e = 0; for (let i = 1; i < c.length; i++) e = Math.max(e, Math.abs(c[i] - c[i - 1])); assert.ok(Math.abs(c[0] - c[c.length - 1]) <= e, nom + ' : la boucle saute'); }
  assert.strictEqual(reponse(SR).length, 2);
});

test('les légendes : une par coin, dans l’eau, qui ne mordent qu’au bon moment, par le bon temps, au bon leurre', () => {
  assert.strictEqual(LEGENDES.length, ETANG.secteurs.length); assert.deepStrictEqual(new Set(LEGENDES.map(g => g.secteur)), new Set(ETANG.secteurs.map(s => s.id)));
  const L = creerPoissons(3);
  for (const g of LEGENDES) {
    const f = L.find(x => x.legende === g), s = ETANG.secteurs.find(x => x.id === g.secteur), sp = espece(g.espece);
    assert.ok(f && profondeur(f.x, f.z) > sp.habitat.profMin, g.id + ' : dans une eau assez profonde'); assert.ok(Math.hypot(f.x - s.x, f.z - s.z) < 30, g.id + ' : près de son coin');
    assert.ok(g.longueur > sp.longueur[1], g.id + ' : plus grande que toutes les autres'); assert.ok(g.leurres.every(id => LEURRES.some(l => l.id === id)) && g.rumeur.length > 60);
  }
  const heureDe = { matin: 8, jour: 13, soir: 19, nuit: 23 };
  for (const g of LEGENDES) {
    const l = LEURRES.find(x => x.id === g.leurres[0]), c = g.espece === 'brochet' ? 'forte' : 'legere', bon = { heure: heureDe[g.moments[0]], meteo: g.meteos[0], legende: g.id };
    let prises = 0; for (let s = 1; s <= 8 && !prises; s++) { const { P } = partie(l.id, c, g.espece, s * 7, bon); if (P.etat === 'prise' && P.resultat.legende === g.id) { prises++; assert.strictEqual(P.resultat.longueur, g.longueur); } }
    assert.ok(prises, g.id + ' : jamais prise dans ses bonnes conditions');
    // à la mauvaise heure, elle ne mord pas : on en prend peut-être un autre, jamais elle
    const mauvaise = Object.keys(heureDe).find(m => !g.moments.includes(m));
    for (let s = 1; s <= 3; s++) { const { P, cible } = partie(l.id, c, g.espece, s * 7, { ...bon, heure: heureDe[mauvaise] }); assert.ok(P.poisson !== cible && P.resultat?.legende !== g.id, g.id + ' : a mordu hors de ses heures'); }
  }
});

test('le père Anselme : il se présente, donne ses défis dans l’ordre, et chaque défi relevé livre une rumeur', () => {
  const mem = new Map(), stock = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }, C = creerCarnet(stock), D = C.donnees;
  const a = parler(C); assert.ok(a.length >= 2 && a.at(-1).includes('trois pages'), 'il se présente et donne le premier défi');
  assert.ok(parler(C).some(l => l.includes('Trois pages')), 'tant que ce n’est pas fait, il le rappelle'); assert.deepStrictEqual(D.rumeurs, []);
  ['gardon', 'perche', 'brochet'].forEach(id => C.observer(id));
  const b = parler(C); assert.deepStrictEqual(D.rumeurs, ['reine']); assert.ok(b.join(' ').includes('La Reine rayée') && b.at(-1).includes('chevalet'));
  C.tableau({ img: 'x', titre: 't', date: 1 }); parler(C); assert.deepStrictEqual(D.rumeurs, ['reine', 'bronze']);
  C.prise({ espece: 'perche', longueur: 40, poids: 0.8, secteur: 'crique', leurre: 'cuiller', canne: 'legere', heure: 8, meteo: 'soleil', legende: null }); for (let i = 0; i < 3; i++) C.relacher('perche');
  const c = parler(C); assert.ok(c[0].includes('40 centimètres'), 'il réagit à la dernière prise'); assert.strictEqual(D.rumeurs.length, 3);
  C.photo({ img: 'x', legende: 'l', date: 1, meteo: 'pluie' }); parler(C); ETANG.secteurs.forEach(s => C.secteur(s.id)); parler(C);
  assert.deepStrictEqual(D.rumeurs, DEFIS.map(d => d.legende)); assert.strictEqual(new Set(D.rumeurs).size, LEGENDES.length, 'les cinq rumeurs');
  C.prise({ espece: 'brochet', longueur: 128, poids: 9, secteur: 'pont', leurre: 'jerk', canne: 'forte', heure: 19, meteo: 'couvert', legende: 'dame' });
  assert.ok(parler(C)[0].includes('La Vieille Dame du pont'), 'il salue la légende prise'); assert.ok(creerCarnet(stock).donnees.legendes.dame.prises === 1, 'retenu au carnet');
});

test('le chevalet : la vue devient des milliers de coups de brosse, larges puis fins, aux couleurs de la vue', () => {
  const w = 60, h = 34, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, ciel = y < h / 2; px[k] = ciel ? 200 : 40; px[k + 1] = ciel ? 220 : 90; px[k + 2] = ciel ? 240 : 120; px[k + 3] = 255; }
  const T = esquisse(px, w, h, 960, 544); assert.ok(T.length > 800 && T.length < 30000, T.length + ' coups');
  assert.ok(T[0].r > T.at(-1).r, 'des grandes masses aux dernières touches'); assert.ok(T.every(t => t.x >= -40 && t.x <= 1000 && t.y >= -40 && t.y <= 590 && t.c.every(v => v >= 0 && v <= 255)));
  const haut = T.filter(t => t.y < 200), bas = T.filter(t => t.y > 340); assert.ok(haut.every(t => t.c[2] > 200) && bas.every(t => t.c[0] < 80), 'chaque touche prend la couleur de son endroit');
  const bord = T.filter(t => Math.abs(t.y - 272) < 6 && t.r < 20); assert.ok(bord.length > 0 && bord.filter(t => Math.abs(Math.cos(t.a)) > 0.9).length / bord.length > 0.6, 'au bord de l’horizon, les touches le suivent');
});
