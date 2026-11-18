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
  F.gates.main = true; assert.ok(F.exitAt(F.EXIT.x, F.EXIT.z) && F.terrain(F.EXIT.x, F.EXIT.z).kind === 'void', 'le gouffre s’ouvre'); F.gates.main = false;
  F.gates.roots = true; assert.ok(F.exitAt(F.ROOTS.x, F.ROOTS.z) && F.terrain(F.ROOTS.x, F.ROOTS.z).kind === 'void', 'le chemin des racines s’ouvre'); F.gates.roots = false;
  assert.ok(Math.hypot(F.ROOTS.x, F.ROOTS.z) < F.R_CAVE - 220, 'le chemin des racines est dans la grotte');
  const [x, y, z] = F.spawn();
  assert.ok(Math.abs(F.terrain(x, z, y + 1).h - y) < 0.01, 'on part du haut du premier chapeau');
});
