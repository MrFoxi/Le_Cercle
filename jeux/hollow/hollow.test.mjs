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
  assert.ok(B.exitAt(E.x, E.z) && B.terrain(E.x, E.z).kind === 'void', 'le Puits s’ouvre au milieu de la dernière île');
  assert.strictEqual(B.terrain(x, z).kind, 'ground');
});
