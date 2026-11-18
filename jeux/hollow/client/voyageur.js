// THE HOLLOW — le voyageur : son dessin, son squelette, ses gestes. Une petite silhouette en long manteau d'encre,
// col relevé, capuche baissée, une longue écharpe pâle qui flotte derrière lui, la sacoche du carnet à la hanche et
// l'encrier qui luit à la ceinture, et en travers du dos un pinceau immense (2 m, plus grand que lui) : c'est avec
// lui qu'il encre le monde. On le voit de dos : une nuque, des cheveux, le pinceau.
// Le squelette est une vraie chaîne : bassin → cuisses → genoux → mollets → bottes ; bassin → buste → nuque → tête ;
// buste → épaules → coudes → mains. Chaque pièce est l'enfant de la précédente : rien ne peut se détacher.
// Les pans du manteau suivent les jambes ; l'écharpe est une petite simulation (elle traîne, ondule, retombe).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ink } from './ink.js';

export const HIP = 0.9, THIGH = 0.42, SHIN = 0.42;
const COAT = '#33335a', COAT_LIGHT = '#4a4a78', BOOT = '#1a1820', SCARF = '#ece2c8', SKIN = '#e0c0a8', HAIR = '#1c1a24';

// une pièce peinte d'un dégradé (sombre en bas, comme une ombre douce)
function part(g, top, bottom = top) {
  g = g.index ? g.toNonIndexed() : g; g.computeBoundingBox();
  const { min, max } = g.boundingBox, span = max.y - min.y || 1, p = g.attributes.position, a = new Float32Array(p.count * 3), A = new THREE.Color(top), B = new THREE.Color(bottom), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(B).lerp(A, (p.getY(i) - min.y) / span); a.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const join = gs => mergeGeometries(gs);
const capsule = (r, len, col, col2) => part(new THREE.CapsuleGeometry(r, len, 4, 10).translate(0, -len / 2 - r * 0.4, 0), col, col2);
// un pan de manteau : un quart de cylindre évasé, accroché à la taille
function panel(a0, top, bottom) {
  const n = 7, m = 6, P = [], I = [];
  for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) { const t = j / m, a = a0 + (i / n) * (Math.PI / 2), r = 0.215 + t * 0.15 + Math.sin(i * 1.7 + j) * 0.006; P.push(Math.sin(a) * r, -t * 0.62, Math.cos(a) * r); }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const hem = new THREE.TorusGeometry(0.365, 0.016, 4, 12, Math.PI / 2).rotateX(Math.PI / 2).rotateY(a0).translate(0, -0.6, 0); // le quart de cercle du bas, tourné comme son pan
  return join([part(g, top, bottom), part(hem, '#d8ccb0')]);
}

// le pinceau : long manche de bois cerclé, virole de laiton, touffe claire qui fonce jusqu'à une pointe gorgée d'encre
function brushGeometry() {
  const handle = part(new THREE.CylinderGeometry(0.03, 0.038, 1.45, 10).translate(0, 0.725, 0), '#c99260', '#7a4a28');
  const rings = [0.08, 0.5, 1.0, 1.38].map(y => part(new THREE.TorusGeometry(0.04, 0.012, 5, 12).rotateX(Math.PI / 2).translate(0, y, 0), '#3a2a20'));
  const ferrule = part(new THREE.CylinderGeometry(0.05, 0.042, 0.13, 12).translate(0, 1.51, 0), '#f0c860', '#a87a28');
  const tuft = part(new THREE.LatheGeometry([[0.045, 0], [0.09, 0.08], [0.125, 0.2], [0.115, 0.32], [0.07, 0.43], [0.0, 0.52]].map(([x, y]) => new THREE.Vector2(x, y)), 14).translate(0, 1.56, 0), '#14101e', '#ece2c8');
  return join([handle, ...rings, ferrule, tuft]);
}

export function createVoyageur() {
  const mat = ink({ line: 1, side: THREE.DoubleSide }), glow = ink({ line: 0.4, glow: 1.4, color: '#7a6aff', vertexColors: false });
  const mesh = (g, m = mat) => { const o = new THREE.Mesh(g, m); o.layers.enable(1); return o; };
  const grp = (x = 0, y = 0, z = 0, ...kids) => { const o = new THREE.Group(); o.position.set(x, y, z); if (kids.length) o.add(...kids); return o; };

  // le bassin, et ce qui y pend : ceinture, encrier, sacoche, pans du manteau
  const hips = grp(0, HIP);
  hips.add(mesh(join([part(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 14).translate(0, 0.02, 0), COAT_LIGHT, COAT), part(new THREE.TorusGeometry(0.205, 0.022, 6, 20).rotateX(Math.PI / 2).translate(0, 0.07, 0), '#5a4a3a')])));
  const bottle = mesh(join([part(new THREE.CylinderGeometry(0.035, 0.045, 0.1, 10).translate(0.22, -0.02, 0.04), '#c8c0e0', '#8a80a8'), part(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).translate(0.22, 0.05, 0.04), '#5a4a3a')]));
  const inkGlow = mesh(new THREE.SphereGeometry(0.028, 8, 6).translate(0.22, -0.03, 0.04), glow);
  const satchel = mesh(join([part(new THREE.BoxGeometry(0.06, 0.2, 0.22).translate(-0.24, -0.08, -0.02), '#8a6a48', '#5a4028'), part(new THREE.BoxGeometry(0.065, 0.08, 0.23).translate(-0.245, 0.0, -0.02), '#9a7a58')]));
  hips.add(bottle, inkGlow, satchel);
  const panels = [[0, 'FL'], [Math.PI / 2, 'FR'], [Math.PI, 'BR'], [-Math.PI / 2, 'BL']].map(([a, name]) => { const p = grp(0, 0.03, 0, mesh(panel(a - Math.PI / 4, COAT, '#201e2c'))); p.name = name; hips.add(p); return p; });

  // les jambes : cuisse, genou, mollet, botte
  const leg = side => {
    const boot = mesh(join([part(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8).rotateX(Math.PI / 2).translate(0, -SHIN - 0.02, 0.05), BOOT), capsule(0.066, 0.3, '#24222e', BOOT)]));
    const knee = grp(0, -THIGH, 0, boot);
    const thigh = grp(side * 0.1, -0.02, 0, mesh(capsule(0.078, 0.32, '#2a2836', '#22202c')), knee);
    hips.add(thigh); return [thigh, knee];
  };
  const [L, KL] = leg(-1), [R, KR] = leg(1);

  // le buste : manteau du haut, col relevé, capuche baissée, sangle de la sacoche ; la nuque et la tête
  const spine = grp(0, 0.06);
  spine.add(mesh(join([
    part(new THREE.LatheGeometry([[0.0, -0.02], [0.215, -0.02], [0.235, 0.18], [0.24, 0.38], [0.2, 0.5], [0.12, 0.56], [0.0, 0.57]].map(([x, y]) => new THREE.Vector2(x, y)), 18), COAT_LIGHT, COAT),
    part(new THREE.CylinderGeometry(0.115, 0.13, 0.14, 14, 1, true).translate(0, 0.6, 0), '#d8d0c0', '#a8a090'),                    // le col relevé
    part(new THREE.TorusGeometry(0.16, 0.07, 8, 14, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI).scale(1, 1, 0.8).translate(0, 0.5, -0.05), COAT_LIGHT, COAT), // la capuche baissée
    part(new THREE.TorusGeometry(0.3, 0.012, 4, 24, Math.PI * 0.7).rotateZ(-2.6).scale(0.75, 1, 1.05).translate(-0.02, 0.2, 0), '#5a4028'), // la sangle
  ])));
  const head = grp(0, 0.64, 0.0, mesh(join([
    part(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 1.4, 0.5).translate(-0.05, 0.09, 0.135), '#1a1828'),
    part(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 1.4, 0.5).translate(0.05, 0.09, 0.135), '#1a1828'),
    part(new THREE.SphereGeometry(0.125, 16, 12).scale(1, 1.1, 1).translate(0, 0.07, 0.01), SKIN, '#c8a088'),
    part(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, 1.75).scale(1, 1.08, 1).translate(0, 0.085, -0.012), HAIR),
    part(new THREE.ConeGeometry(0.04, 0.12, 6).rotateX(-0.9).translate(0.02, 0.2, -0.06), HAIR), // une mèche rebelle
  ])));
  head.scale.setScalar(1.22); spine.add(head);
  // l'écharpe autour du cou (le tour), d'où partent les deux pans qui flottent
  spine.add(mesh(part(new THREE.TorusGeometry(0.15, 0.055, 8, 18).rotateX(Math.PI / 2 - 0.15).translate(0, 0.6, -0.01), SCARF, '#c8b890'), ink({ line: 0.7 })));
  // les bras : épaule, coude, main (gantée)
  const arm = side => {
    const hand = mesh(part(new THREE.SphereGeometry(0.052, 10, 8).scale(1, 1.25, 0.9).translate(0, -0.27, 0.01), '#3a3040'));
    const elbow = grp(0, -0.27, 0, mesh(capsule(0.05, 0.2, COAT_LIGHT, COAT)), hand);
    const shoulder = grp(side * 0.25, 0.47, 0, mesh(join([capsule(0.058, 0.2, COAT_LIGHT, COAT), part(new THREE.SphereGeometry(0.075, 10, 8), COAT_LIGHT)])), elbow);
    spine.add(shoulder); return [shoulder, elbow];
  };
  const [AL, EL] = arm(-1), [AR, ER] = arm(1);
  hips.add(spine);
  // le pinceau, en travers du dos (la touffe au-dessus de l'épaule droite), tenu par une seconde sangle ;
  // dans la main droite quand il encre (wield)
  const brush = grp(0, 0, 0, mesh(brushGeometry()), mesh(new THREE.SphereGeometry(0.03, 8, 6).translate(0, 2.07, 0), glow)); brush.scale.setScalar(1.2); // 2,5 m : plus grand que lui
  const onBack = grp(-0.2, -0.73, -0.29); onBack.rotation.set(0.1, 0, -0.55); spine.add(onBack);
  spine.add(mesh(part(new THREE.TorusGeometry(0.3, 0.012, 4, 24, Math.PI * 0.7).rotateZ(-0.6).scale(0.75, 1, 1.05).translate(0.02, 0.2, 0), '#5a4028')));
  const inHand = grp(0, -0.29, 0.02); ER.add(inHand);
  onBack.add(brush);

  // l'écharpe : une bande qui part de la nuque et flotte (simulée dans le monde)
  const N = 9, SEG = 0.14, pts = Array.from({ length: N }, () => new THREE.Vector3()), prev = pts.map(p => p.clone());
  const scarfGeo = new THREE.BufferGeometry(), sp = new Float32Array(N * 2 * 3), sc = new Float32Array(N * 2 * 3), idx = [];
  for (let i = 0; i < N; i++) { const c = new THREE.Color(i % 4 === 2 ? '#3a4a8a' : SCARF).multiplyScalar(1 - i * 0.03); sc.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6); }
  for (let i = 0; i + 1 < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scarfGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3)); scarfGeo.setIndex(idx);
  const scarf = new THREE.Mesh(scarfGeo, ink({ line: 0.6, side: THREE.DoubleSide, wind: 0 })); scarf.frustumCulled = false;
  const g = grp(0, 0, 0, hips);
  // la bande est dans le monde (elle traîne derrière quand il bouge) : on l'ajoute à côté, pas dans le squelette
  const neckWorld = new THREE.Vector3(), tmp = new THREE.Vector3(), side = new THREE.Vector3(), back = new THREE.Vector3(), axis = new THREE.Vector3();
  let started = false;

  const ease = k => k * k * (3 - 2 * k);
  const rig = {
    g, hips, torso: spine, spine, head, L, R, KL, KR, AL, AR, EL, ER, panels, scarf, inkGlow, brush,
    // prendre le pinceau en main (on) ou le remettre dans le dos ; en main, il prolonge l'avant-bras, la pointe devant
    wield(on) {
      (on ? inHand : onBack).add(brush);
      if (on) { brush.position.set(0, 0.55, 0); brush.rotation.set(Math.PI, 0, 0); } else { brush.position.set(0, 0, 0); brush.rotation.set(0, 0, 0); }
    },
    // tout remettre droit
    reset() {
      for (const o of [hips, spine, head, L, R, KL, KR, AL, AR, EL, ER, ...panels]) o.rotation.set(0, 0, 0);
      g.rotation.set(0, g.rotation.y, 0); // il garde son cap
      AL.rotation.z = -0.1; AR.rotation.z = 0.1; EL.rotation.x = -0.15; ER.rotation.x = -0.15;
      hips.position.y = HIP; spine.scale.set(1, 1, 1); spine.position.y = 0.06; g.scale.set(1, 1, 1); // la position de g appartient au voyageur : on ne la touche pas ici
    },
    // s'accroupir (k de 0 à 1) : le bassin descend, les genoux plient juste ce qu'il faut pour que les pieds restent au sol
    crouch(k) {
      const d = Math.min(0.5, k * 0.42), D = THIGH + SHIN - d, th = Math.acos(Math.min(1, D / (THIGH + SHIN)));
      hips.position.y = HIP - d; L.rotation.x = R.rotation.x = -th * 1.05; KL.rotation.x = KR.rotation.x = th * 2.1;
      spine.rotation.x = Math.max(spine.rotation.x, k * 0.35);
    },
    // le manteau s'ouvre en corolle (k de 0 à 1)
    flare(k) { for (const p of panels) { const front = p.name[0] === 'F', left = p.name[1] === 'L'; p.rotation.x = (front ? -1 : 1) * k * 1.1; p.rotation.z = (left ? 1 : -1) * k * 0.5; } },
    // la marche et la course : jambes, genoux, bras opposés, buste qui se penche et tourne, pans du manteau qui suivent
    walk(phase, speed, grounded, t) {
      const k = Math.min(1, speed / 4), run = Math.max(0, Math.min(1, (speed - 5) / 4)), amp = k * (0.5 + run * 0.35), s = Math.sin(phase), c = Math.cos(phase);
      if (grounded) {
        L.rotation.set(-s * amp, 0, -0.02); R.rotation.set(s * amp, 0, 0.02);
        KL.rotation.x = 0.06 + Math.max(0, c) * amp * 1.5; KR.rotation.x = 0.06 + Math.max(0, -c) * amp * 1.5;
        hips.position.y = HIP - 0.015 * k - run * 0.05 + Math.abs(s) * 0.03 * k;
        hips.rotation.z = s * 0.04 * k; hips.rotation.y = -s * 0.06 * k;
        spine.rotation.set(0.04 + speed * 0.018 + run * 0.12, s * 0.14 * k, -s * 0.03 * k);
        AL.rotation.set(s * amp * 0.9, 0, -0.1 - run * 0.1); AR.rotation.set(-s * amp * 0.9, 0, 0.1 + run * 0.1);
        EL.rotation.x = -0.2 - k * 0.3 - run * 0.6 - Math.max(0, -s) * 0.3 * k; ER.rotation.x = -0.2 - k * 0.3 - run * 0.6 - Math.max(0, s) * 0.3 * k;
        // au repos : il respire, les bras pendent
        const idle = 1 - k; spine.scale.set(1, 1 + Math.sin(t * 1.7) * 0.012 * idle, 1 + Math.sin(t * 1.7) * 0.02 * idle);
        head.rotation.set(-0.05 * idle + Math.sin(t * 0.4) * 0.05 * idle, Math.sin(t * 0.3) * 0.25 * idle, 0);
      } else {
        // en l'air : jambes repliées, bras écartés pour l'équilibre
        L.rotation.set(-0.55, 0, -0.08); R.rotation.set(-0.15, 0, 0.08); KL.rotation.x = 0.9; KR.rotation.x = 0.5;
        AL.rotation.set(-0.3, 0, -0.9); AR.rotation.set(-0.3, 0, 0.9); EL.rotation.x = -0.4; ER.rotation.x = -0.4;
        spine.rotation.set(0.1, 0, 0); hips.position.y = HIP;
      }
      // les pans suivent : devant quand la jambe avance, derrière quand elle recule ; un léger battement
      const flap = Math.sin(t * 7) * 0.04 * k;
      for (const p of panels) { const left = p.name[1] === 'L', front = p.name[0] === 'F', th = (left ? L : R).rotation.x; p.rotation.set(front ? Math.min(0, th) * 0.95 - 0.03 + flap : Math.max(0, th) * 0.95 + 0.05 + run * 0.25 + flap, 0, 0); }
    },
    // l'écharpe : elle part de la nuque, traîne derrière, retombe, ondule au vent (à appeler après avoir posé g)
    scarfStep(dt, grav = 9) { // grav : sous l'eau, elle flotte presque
      g.updateMatrixWorld(true);
      spine.localToWorld(neckWorld.set(0.03, 0.58, -0.2));
      if (!started) { pts.forEach((p, i) => { p.copy(neckWorld).add(tmp.set(0, -i * SEG, -i * 0.02)); prev[i].copy(p); }); started = true; }
      pts[0].copy(neckWorld); prev[0].copy(neckWorld);
      const t = performance.now() / 1000, h = Math.min(dt, 0.033);
      for (let i = 1; i < N; i++) {
        const p = pts[i], v = tmp.copy(p).sub(prev[i]).multiplyScalar(0.94); prev[i].copy(p);
        p.add(v); p.y -= grav * h * h; p.x += Math.sin(t * 3 + i) * 0.0015 * i; p.z += Math.cos(t * 2.3 + i) * 0.0015 * i;
      }
      // un souffle qui pousse vers l'arrière du voyageur, et le corps que l'écharpe ne traverse pas (un cylindre autour du buste)
      spine.localToWorld(back.set(0, 0.3, -1)); spine.localToWorld(axis.set(0, 0.3, 0)); back.sub(axis).normalize().multiplyScalar(0.0025);
      for (let i = 1; i < N; i++) pts[i].addScaledVector(back, i * 0.4);
      for (let it = 0; it < 4; it++) for (let i = 1; i < N; i++) {
        const a = pts[i - 1], b = pts[i], d = tmp.copy(b).sub(a), l = d.length() || 1; b.copy(a).addScaledVector(d, SEG / l);
        const q = spine.worldToLocal(tmp.copy(b)), r = Math.hypot(q.x, q.z);
        if (q.y > -0.95 && q.y < 0.7 && r < 0.3) { q.x *= 0.3 / (r || 1); q.z = r ? q.z * 0.3 / r : -0.3; b.copy(spine.localToWorld(q)); }
      }
      // la bande : deux bords, de part et d'autre de la ligne, dans le repère du voyageur
      for (let i = 0; i < N; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
        side.copy(b).sub(a).cross(tmp.set(0, 1, 0.2)).normalize().multiplyScalar(0.075 * (1 - i / N * 0.25));
        const l = g.worldToLocal(tmp.copy(pts[i]).add(side)), r = g.worldToLocal(side.multiplyScalar(-1).add(pts[i]));
        sp.set([l.x, l.y, l.z, r.x, r.y, r.z], i * 6);
      }
      scarfGeo.attributes.position.needsUpdate = true; scarfGeo.computeVertexNormals();
    },
    ease,
  };
  g.add(scarf);
  rig.reset();
  return rig;
}
