// THE HOLLOW : le relief des Jardins suspendus doit se descendre à pied, et seulement par les rampes
import test from 'node:test';
import assert from 'node:assert';
import { terrain, heightAt, spawn, rampAngle, R_ABYSS, TERRACE, STEP } from './client/terrain.js';

// pente la plus forte le long d'un rayon, d'une terrasse à la suivante (pas de 0,5 m)
function steepest(a, k) {
  let worst = 0;
  for (let r = R_ABYSS + TERRACE * (k + 0.5); r < R_ABYSS + TERRACE * (k + 1.5); r += 0.5) {
    const h0 = heightAt(Math.cos(a) * r, Math.sin(a) * r), h1 = heightAt(Math.cos(a) * (r + 0.5), Math.sin(a) * (r + 0.5));
    worst = Math.max(worst, Math.abs(h1 - h0) / 0.5);
  }
  return worst;
}

test('chaque terrasse se rejoint par sa rampe, et nulle part ailleurs', () => {
  for (let k = 0; k < 12; k++) {
    assert.ok(steepest(rampAngle(k), k) < 0.75, `la rampe ${k} se descend à pied (pente ${steepest(rampAngle(k), k).toFixed(2)})`);
    assert.ok(steepest(rampAngle(k) + 1.2, k) > 1.5, `loin de la rampe ${k}, une falaise`);
  }
});

test('le gouffre au centre, la paroi au bord, un départ sur le sol', () => {
  assert.strictEqual(terrain(0, 10).kind, 'void');
  assert.ok(heightAt(2400, 0) > heightAt(1900, 0) + 300, 'la paroi monte');
  const [x, y, z] = spawn();
  assert.strictEqual(terrain(x, z).kind, 'ground');
  assert.ok(y > STEP * 5, 'on part de haut');
  assert.strictEqual(heightAt(x, z), heightAt(x, z), 'même relief à chaque appel');
});

// Les Brumes : le chemin d'îles et de ponts se parcourt à pied, sans trou ni marche trop haute, jusqu'au Puits de brume
test('les Brumes se traversent à pied, d’île en île, jusqu’au Puits', async () => {
  const B = await import('./client/brumes.js');
  const path = B.islands.filter(I => I.path !== undefined);
  for (let i = 0; i + 1 < path.length; i++) {
    const A = path[i], C = path[i + 1], L = Math.hypot(C.x - A.x, C.z - A.z);
    let prev = null;
    for (let d = A.exit ? 25 : 0; d <= L - (C.exit ? 25 : 0); d += 0.5) {
      const x = A.x + ((C.x - A.x) * d) / L, z = A.z + ((C.z - A.z) * d) / L, t = B.terrain(x, z);
      assert.notStrictEqual(t.kind, 'void', `un trou entre l’île ${i} et l’île ${i + 1} (à ${d.toFixed(1)} m)`);
      if (prev !== null) assert.ok(Math.abs(t.h - prev) < 0.45, `une marche entre l’île ${i} et l’île ${i + 1} (à ${d.toFixed(1)} m)`);
      prev = t.h;
    }
  }
  const E = path.at(-1), [x, , z] = B.spawn();
  assert.ok(!B.exitAt(E.x, E.z) && B.terrain(E.x, E.z).kind === 'ground', 'fermé, le Puits porte');
  E.open = true;
  assert.ok(B.exitAt(E.x, E.z) && B.terrain(E.x, E.z).kind === 'void', 'le Puits s’ouvre au milieu de la dernière île');
  E.open = false;
  // un pont de côté ne porte qu'une fois encré
  const S = B.bridges.find(b => b.sketch), mx = (S.a[0] + S.b[0]) / 2, mz = (S.a[1] + S.b[1]) / 2;
  assert.strictEqual(B.terrain(mx, mz).kind, 'void'); S.inked = true; assert.strictEqual(B.terrain(mx, mz).kind, 'bridge'); S.inked = false;
  assert.strictEqual(B.terrain(x, z).kind, 'ground');
});

// La Forêt : on descend de chapeau en chapeau (chacun déborde sur le suivant, moins de 30 m plus bas), puis au sol
test('la Forêt se descend de chapeau en chapeau jusqu’au sol, et le gouffre s’ouvre', async () => {
  const F = await import('./client/foret.js');
  const path = F.caps.filter(C => C.path !== undefined);
  assert.ok(path.length > 15, 'un long chemin de chapeaux');
  for (let i = 0; i + 1 < path.length; i++) {
    const A = path[i], B = path[i + 1], d = Math.hypot(A.x - B.x, A.z - B.z);
    assert.ok(d < A.R + B.R - 6, `le chapeau ${i + 1} passe sous le bord du chapeau ${i}`);
    assert.ok(A.y - B.y < 28, `une marche de moins de 30 m entre ${i} et ${i + 1}`);
    // en marchant tout droit vers le suivant, on tombe sur lui (pas au sol)
    const ux = (B.x - A.x) / d, uz = (B.z - A.z) / d, x = A.x + ux * (A.R + 1), z = A.z + uz * (A.R + 1);
    assert.ok(F.terrain(x, z, A.y).h > F.floorAt(x, z) + 1, `au bord du chapeau ${i}, le suivant est dessous`);
  }
  // le pied d'un chapeau ne traverse jamais un chapeau plus bas
  for (const A of path) for (const B of path) if (B.y < A.y - 1) assert.ok(Math.hypot(A.x - B.x, A.z - B.z) > B.R + 3, 'un pied traverse un chapeau');
  const L = path.at(-1);
  assert.ok(L.y - F.floorAt(L.x, L.z) < 28, 'du dernier chapeau, on saute au sol');
  assert.ok(!F.exitAt(F.EXIT.x, F.EXIT.z) && F.terrain(F.EXIT.x, F.EXIT.z).kind === 'ground', 'fermé, le gouffre porte');
  // fermés, on traverse les deux passages à pied de tous les côtés, sans marche ni trou
  for (const G of [F.EXIT, F.ROOTS]) for (let an = 0; an < 6.28; an += 0.3) { let p = null; for (let d = -(G.R + 12); d <= G.R + 12; d += 0.5) { const t = F.terrain(G.x + Math.cos(an) * d, G.z + Math.sin(an) * d, (p ?? 40) + 1); assert.notStrictEqual(t.kind, 'void', 'un trou dans un passage fermé'); if (p !== null) assert.ok(Math.abs(t.h - p) < 0.9, 'une marche sur un passage fermé'); p = t.h; } }
  F.gates.main = true; assert.ok(F.exitAt(F.EXIT.x, F.EXIT.z) && F.terrain(F.EXIT.x, F.EXIT.z).kind === 'void', 'le gouffre s’ouvre'); F.gates.main = false;
  F.gates.roots = true; assert.ok(F.exitAt(F.ROOTS.x, F.ROOTS.z) && F.terrain(F.ROOTS.x, F.ROOTS.z).kind === 'void', 'le chemin des racines s’ouvre'); F.gates.roots = false;
  assert.ok(Math.hypot(F.ROOTS.x, F.ROOTS.z) < F.R_CAVE - 220, 'le chemin des racines est dans la grotte');
  const [x, y, z] = F.spawn();
  assert.ok(Math.abs(F.terrain(x, z, y + 1).h - y) < 0.01, 'on part du haut du premier chapeau');
});

// Les Abysses : on arrive dans l'eau au-dessus du Plongeur ; les trois fenêtres sont au fond, dans le noir, et le
// souffle tient d'une cloche de nacre à la suivante (moins de 130 m, même à 5,5 m/s il en reste) ; la Fosse s'ouvre
test('les Abysses : fenêtres au fond, cloches de nacre assez proches, la Fosse fermée puis ouverte', async () => {
  const A = await import('./client/abysses.js');
  const [x, y, z] = A.spawn();
  assert.ok(y < A.SURF && y > A.PL.top + 10 && A.terrain(x, z, y).h < y - 20, 'on arrive dans l’eau, au-dessus de la ville');
  assert.ok(A.PL.top > A.DARK, 'le toit du Plongeur est dans la lumière');
  assert.strictEqual(A.WINDOWS.length, 3, 'trois fenêtres allumées');
  const inside = (px, py, pz) => A.TOWERS.some(T => Math.hypot(px - T.x, pz - T.z) < T.r && py < T.top) || A.spheres.some(([cx, cy, cz, r]) => Math.hypot(px - cx, py - cy, pz - cz) < r) || py < A.floorAt(px, pz);
  for (const W of A.WINDOWS) {
    assert.ok(W.y < A.DARK - 60, 'une fenêtre au fond, dans le noir');
    assert.ok(!inside(W.x + Math.cos(W.a) * 3, W.y, W.z + Math.sin(W.a) * 3), 'devant la fenêtre, de l’eau libre');
  }
  for (const [bx, by, bz] of A.BELLS) assert.ok(!inside(bx, by, bz), 'une cloche dans de l’eau libre');
  // le long de chaque chemin (du Plongeur à chaque but, d'un but à l'autre), d'un point où l'on respire au suivant : jamais plus de 130 m
  for (const [f, t] of A.LEGS) {
    const from = f.toArray(), to = t.toArray();
    const L = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const along = A.BELLS.map(b => [b, ((b[0] - from[0]) * (to[0] - from[0]) + (b[1] - from[1]) * (to[1] - from[1]) + (b[2] - from[2]) * (to[2] - from[2])) / L]).filter(([b, d]) => d > 0 && d < L && Math.hypot(...b.map((v, i) => v - (from[i] + ((to[i] - from[i]) * d) / L))) < 40).sort((u, v) => u[1] - v[1]);
    let prev = from;
    for (const [b] of along) { assert.ok(Math.hypot(b[0] - prev[0], b[1] - prev[1], b[2] - prev[2]) < 130, 'deux cloches trop loin l’une de l’autre'); prev = b; }
    assert.ok(Math.hypot(to[0] - prev[0], to[1] - prev[1], to[2] - prev[2]) < 130, 'la dernière cloche est trop loin du but');
  }
  for (const T of A.TOWERS) assert.ok(Math.hypot(T.x - A.FOSSE.x, T.z - A.FOSSE.z) > T.r + A.FOSSE.R, 'une tour dans la Fosse');
  assert.ok(!A.exitAt(A.FOSSE.x, A.FOSSE.z) && A.terrain(A.FOSSE.x, A.FOSSE.z).kind === 'ground', 'fermée, la Fosse porte');
  A.gates.fosse = true; assert.ok(A.exitAt(A.FOSSE.x, A.FOSSE.z) && A.terrain(A.FOSSE.x, A.FOSSE.z).kind === 'void', 'la Fosse s’ouvre'); A.gates.fosse = false;
});

// Les Terres organiques : on ne monte sur le dos de l'Hôte qu'en grimpant : un pilier vivant, une côte-pont jusqu'au
// suivant (plus haut, on y grimpe encore), et la dernière côte qui descend sur le plateau ; la falaise ne se monte pas
test('les Terres organiques : piliers vivants et côtes-ponts jusqu’au dos de l’Hôte, la Valve', async () => {
  const T = await import('./client/terres.js');
  const [x, y, z] = T.spawn();
  assert.ok(Math.abs(T.terrain(x, z, y + 1).h - y) < 0.01 && y < 40, 'on part du sol de la cavité');
  // du départ au pied du premier pilier, à pied
  const C1 = T.CLIMBS[0], L = Math.hypot(C1.x - x, C1.z - z); let prev = y;
  for (let d = 0.5; d < L - C1.r - 1; d += 0.5) { const h = T.terrain(x + ((C1.x - x) * d) / L, z + ((C1.z - z) * d) / L, prev + 1).h; assert.ok(Math.abs(h - prev) < 0.45, 'une marche sur le chemin du premier pilier'); prev = h; }
  T.BRIDGES.forEach((B, i) => {
    const n = 200; let p = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, bx = B.a[0] + (B.b[0] - B.a[0]) * t, bz = B.a[1] + (B.b[1] - B.a[1]) * t, h = T.terrain(bx, bz, T.bridgeAt(B, bx, bz) + 0.5).h;
      if (p !== null) assert.ok(Math.abs(h - p) < 0.45, `une marche sur la côte ${i}`);
      p = h;
    }
    const A = T.CLIMBS[i]; assert.ok(Math.hypot(B.a[0] - A.x, B.a[1] - A.z) < A.r, `la côte ${i} part du sommet du pilier ${i}`);
    if (i < 2) { const N = T.CLIMBS[i + 1]; assert.ok(Math.hypot(B.b[0] - N.x, B.b[1] - N.z) < N.r + 0.5 && N.top > B.hb + 20, `la côte ${i} s’appuie contre le pilier suivant, qu’on grimpe`); }
    else assert.ok(Math.abs(B.hb - T.floorAt(...B.b)) < 0.3 && T.floorAt(...B.b) > T.MESA.top, 'la dernière côte arrive sur le dos de l’Hôte');
  });
  // la falaise de l'Hôte : partout, une pente qu'on ne monte pas à pied
  for (let a = 0; a < 6.28; a += 0.5) {
    let worst = 0;
    for (let s = 0.85; s < 1.2; s += 0.002) { const px = T.MESA.x + Math.cos(a) * T.MESA.a * s, pz = T.MESA.z + Math.sin(a) * T.MESA.b * s, h0 = T.floorAt(px, pz), h1 = T.floorAt(px + Math.cos(a) * 0.5, pz + Math.sin(a) * 0.5); worst = Math.max(worst, Math.abs(h1 - h0) / 0.5); }
    assert.ok(worst > 1.5, 'la falaise de l’Hôte se monte à pied');
  }
  for (const C of T.CLIMBS) assert.ok(T.floorAt(C.x, C.z) < 40, 'un pilier hors du plateau');
  assert.ok(!T.exitAt(T.VALVE.x, T.VALVE.z) && T.terrain(T.VALVE.x, T.VALVE.z).kind === 'ground', 'fermée, la Valve porte');
  // fermée, on la traverse à pied de tous les côtés, sans marche ni trou
  for (let a = 0; a < 6.28; a += 0.4) { let p = null; for (let d = -(T.VALVE.R + 10); d <= T.VALVE.R + 10; d += 0.5) { const t = T.terrain(T.VALVE.x + Math.cos(a) * d, T.VALVE.z + Math.sin(a) * d, (p ?? 200) + 1); assert.notStrictEqual(t.kind, 'void', 'un trou dans la Valve fermée'); if (p !== null) assert.ok(Math.abs(t.h - p) < 0.9, 'une marche sur la Valve fermée'); p = t.h; } }
  T.gates.valve = true; assert.ok(T.exitAt(T.VALVE.x, T.VALVE.z) && T.terrain(T.VALVE.x, T.VALVE.z).kind === 'void', 'la Valve s’ouvre'); T.gates.valve = false;
  assert.ok(T.floorAt(T.VALVE.x + T.VALVE.R + 6, T.VALVE.z) > T.MESA.top, 'la Valve est sur le dos de l’Hôte');
});

// La Cité : on ne descend d'une terrasse à l'autre que par les escaliers de lumière, qui ne portent qu'une fois leur
// anneau réveillé ; le pont mène aux Archives, au-dessus du vide ; chaque nœud est sur la terrasse du haut de son escalier
test('la Cité : terrasses, escaliers des anneaux, pont jusqu’aux Archives', async () => {
  const C = await import('./client/cite.js');
  const [x, y, z] = C.spawn();
  assert.strictEqual(C.tierAt(x, z), 0); assert.strictEqual(y, C.tierY(0));
  assert.strictEqual(C.terrain(0, C.R0 - 20 > C.PLAT.R ? C.R0 - 20 : 100).kind, 'void', 'le vide au centre');
  assert.ok(Math.abs(C.terrain(0, 0).h - C.PLAT.y) < 0.01, 'les Archives au-dessus du vide');
  for (const Rp of C.RAMPS) {
    const c = Math.cos(Rp.th), s = Math.sin(Rp.th), mid = (Rp.from + Rp.to) / 2, mx = c * mid, mz = s * mid;
    const N0 = C.NODES[Rp.k]; assert.strictEqual(C.tierAt(N0[0], N0[2]), Rp.k, `le nœud ${Rp.k} est sur la terrasse du haut`);
    // endormi : au milieu de l'escalier, on est sur la terrasse du bas (ou dans le vide pour le pont)
    assert.ok(C.terrain(mx, mz, 200).h < C.rampAt(Rp, mx, mz) - 3, `l’escalier ${Rp.k} ne porte pas tant que son anneau dort`);
    C.gates.awake[Rp.k] = true;
    let p = null;
    for (let al = Rp.from + 20; al >= Rp.to - 15; al -= 0.5) { const t = C.terrain(c * al, s * al, (p ?? 200) + 1); assert.notStrictEqual(t.kind, 'void', `un trou dans l’escalier ${Rp.k}`); if (p !== null) assert.ok(Math.abs(t.h - p) < 0.45, `une marche dans l’escalier ${Rp.k} (à ${al})`); p = t.h; }
    C.gates.awake[Rp.k] = false;
  }
  // partout ailleurs entre deux terrasses, un mur
  for (let k = 0; k < 3; k++) { const B = C.R0 + (3 - k) * C.W, a = C.RAMPS[k].th + 1.1; assert.ok(C.floorAt(Math.cos(a) * (B + 3), Math.sin(a) * (B + 3)) - C.floorAt(Math.cos(a) * (B - 3), Math.sin(a) * (B - 3)) > 15, 'un mur entre deux terrasses'); }
});
