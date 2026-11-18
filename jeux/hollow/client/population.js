// THE HOLLOW — les gens et les bêtes qu'on croise, sans énigme : beaucoup en haut (les Jardins sont la surface), de
// moins en moins en descendant. Des voyageurs en route (d'autres manteaux, d'autres couleurs, qui marchent, se reposent,
// regardent le gouffre), des habitants (cueilleurs de pollen, bergers de Semeurs, enfants qui courent, un conteur et
// ceux qui l'écoutent), et de petites bêtes qui broutent ou s'envolent quand on approche. Chacun dit un mot quand on
// passe tout près. Ils marchent sur le relief de la strate et ne changent jamais d'étage (ni falaise ni vide).
import * as THREE from 'three';
import { createVoyageur } from './voyageur.js';
import { ink } from './ink.js';
import { rng, paint, lump, tube, merge, TAU } from './modelage.js';

const COATS = [['#7a2a2a', '#a84a3a'], ['#2a5a3a', '#4a8a5a'], ['#6a5a2a', '#9a8a4a'], ['#5a2a5a', '#8a4a8a'], ['#2a4a6a', '#4a7aa8'], ['#5a3a2a', '#8a5a3a'], ['#4a4a4a', '#7a7a7a'], ['#2a6a6a', '#4a9a9a']];
const SKINS = ['#e0c0a8', '#c8986a', '#8a5a3a', '#f0d8c0', '#a8785a'], HAIRS = ['#1c1a24', '#5a3a1a', '#c8a040', '#e8e4ec', '#8a2a1a'];
// ce que portent les habitants : une hotte (cueilleur), une houlette (berger)
const basket = () => paint(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 10, 1, true).translate(0, 0.25, -0.3), '#b08850', '#6a4a28');
const crook = () => paint(tube([[0, 0.1, 0], [0, -0.9, 0.05], [0, -1.6, 0.1]], 0.025, 0.025, 5, 6).translate(0, 0, 0), '#7a5a3a');

// people : [{ kind, home: [x, z], wander, lines }] ; ground(x, z) : la hauteur ; critters : combien de petites bêtes, et où
export function createPopulation(scene, { people = [], ground, critters = null, ui, seed = 7 }) {
  const r = rng(seed), list = [];
  for (const P of people) {
    const [coat, light] = COATS[(r() * COATS.length) | 0], child = P.kind === 'enfant';
    const rig = createVoyageur({ coat, coatLight: light, skin: SKINS[(r() * SKINS.length) | 0], hair: HAIRS[(r() * HAIRS.length) | 0], scarf: r() < 0.5 ? '#ece2c8' : COATS[(r() * COATS.length) | 0][1], brush: P.kind === 'voyageur' && r() < 0.4 });
    if (P.kind === 'cueilleur') rig.torso.add(new THREE.Mesh(basket(), ink({ line: 0.8 })));
    if (P.kind === 'berger') rig.ER.add(new THREE.Mesh(crook(), ink({ line: 0.8 })));
    rig.g.scale.setScalar(child ? 0.68 : 0.92 + r() * 0.16);
    const [hx, hz] = P.home, y = ground(hx, hz);
    rig.g.position.set(hx, y, hz); rig.g.rotation.y = r() * TAU; scene.add(rig.g);
    list.push({ ...P, rig, p: new THREE.Vector3(hx, y, hz), y0: y, yaw: rig.g.rotation.y, to: null, wait: r() * 6, phase: 0, said: -99, speed: child ? 3.2 : P.kind === 'voyageur' ? 1.5 : 1.1, sits: P.kind === 'conteur' || P.kind === 'auditeur' || (P.kind === 'voyageur' && r() < 0.3) });
  }
  // les petites bêtes : des oiseaux-graines qui sautillent et s'envolent, des brouteurs ronds qui broutent et s'écartent
  const CN = critters?.count ?? 0, birdG = merge([paint(lump(0.18, { sx: 1.3, sy: 0.9, detail: 1 }), '#f0d8a0', '#c89a50'), paint(new THREE.ConeGeometry(0.05, 0.14, 5).rotateX(Math.PI / 2).translate(0, 0.02, 0.24), '#e89a3a'), paint(lump(0.16, { sx: 0.2, sy: 0.6, sz: 1.2, detail: 0 }).translate(0, 0.1, -0.1), '#c8a060')]);
  const grazerG = merge([paint(lump(0.45, { sx: 1.4, sy: 0.9, lumpy: 0.2, detail: 2 }).translate(0, 0.45, 0), '#d8e8c8', '#8aa878'), paint(lump(0.2, { detail: 1 }).translate(0, 0.55, 0.62), '#e8f0d8', '#9ab888'), ...[-1, 1].map(s => paint(new THREE.ConeGeometry(0.05, 0.25, 5).translate(s * 0.12, 0.8, 0.6), '#6a5a4a'))]);
  const birds = new THREE.InstancedMesh(birdG, ink({ line: 0.5 }), Math.max(1, CN)), grazers = new THREE.InstancedMesh(grazerG, ink({ line: 0.6 }), Math.max(1, CN));
  birds.frustumCulled = grazers.frustumCulled = false; birds.count = grazers.count = 0; scene.add(birds, grazers);
  const cr = [];
  for (let k = 0; k < CN; k++) { const [x, z] = critters.spot(r), y = ground(x, z); if (!(y > -100)) continue; cr.push({ bird: k % 2 === 0, home: new THREE.Vector3(x, y, z), p: new THREE.Vector3(x, y, z), to: null, fly: 0, ph: r() * TAU, yaw: r() * TAU }); }
  const nB = cr.filter(c => c.bird).length; birds.count = nB; grazers.count = cr.length - nB;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), d3 = new THREE.Vector3();
  let last = 0;
  // un pas vers la cible, sans changer d'étage : une marche trop haute (falaise, vide) et l'on choisit ailleurs
  const stepTo = (o, sp, dt) => {
    d3.copy(o.to).sub(o.p).setY(0); const d = d3.length();
    if (d < 0.4) { o.to = null; return 0; }
    d3.multiplyScalar(Math.min(d, sp * dt) / d);
    const nx = o.p.x + d3.x, nz = o.p.z + d3.z, h = ground(nx, nz);
    if (!(h > -100) || Math.abs(h - o.p.y) > 0.8) { o.to = null; return 0; }
    o.p.set(nx, h, nz); o.yaw = Math.atan2(d3.x, d3.z); return sp;
  };
  return {
    update(t, hero) {
      const dt = Math.min(0.05, last ? t - last : 0.016); last = t;
      for (const o of list) {
        const near = o.p.distanceTo(hero), g = o.rig.g;
        if (near > 260) continue; // trop loin : ils ne bougent pas (on ne les voit qu'en tout petit)
        let sp = 0;
        if (near < 5) { // il s'arrête, se tourne vers le voyageur, dit un mot
          o.yaw = Math.atan2(hero.x - o.p.x, hero.z - o.p.z);
          if (t - o.said > 14 && o.lines?.length) { o.said = t; ui?.say(o.lines[(r() * o.lines.length) | 0], o.p.clone().add(new THREE.Vector3(0, 2.4 * g.scale.y, 0)), 3.6); }
        } else if (!o.sits) {
          if (!o.to && (o.wait -= dt) <= 0) { const a = r() * TAU, d = r() * o.wander; o.to = new THREE.Vector3(o.home[0] + Math.cos(a) * d, 0, o.home[1] + Math.sin(a) * d); o.wait = 2 + r() * 8; }
          if (o.to) sp = stepTo(o, o.speed * (o.kind === 'enfant' && Math.sin(t * 0.7 + o.home[0]) > 0.6 ? 1.6 : 1), dt);
        }
        o.phase += dt * sp * 2.3;
        g.position.copy(o.p); g.rotation.y += Math.atan2(Math.sin(o.yaw - g.rotation.y), Math.cos(o.yaw - g.rotation.y)) * Math.min(1, dt * 6);
        if (o.sits) { o.rig.reset(); o.rig.crouch(1); o.rig.head.rotation.x = o.kind === 'auditeur' ? -0.1 : Math.sin(t * 0.8) * 0.1; if (o.kind === 'conteur') { o.rig.AR.rotation.set(-0.9 + Math.sin(t * 1.3) * 0.4, 0, 0.3); } }
        else o.rig.walk(o.phase, sp, true, t);
        if (near < 70) o.rig.scarfStep(dt); // l'écharpe ne flotte que pour ceux qu'on voit de près
      }
      let bi = 0, gi = 0;
      for (const c of cr) {
        const d = Math.hypot(c.p.x - hero.x, c.p.z - hero.z);
        if (c.bird) {
          if (d < 7 && !c.fly) c.fly = 1;
          if (c.fly) { c.fly += dt; const k = c.fly; c.p.set(c.home.x + Math.cos(c.ph) * k * 9, c.home.y + Math.sin(Math.min(1, k / 3) * Math.PI) * 12, c.home.z + Math.sin(c.ph) * k * 9); if (k > 3) { c.fly = 0; c.ph = r() * TAU; c.home.set(c.p.x, ground(c.p.x, c.p.z), c.p.z); if (!(c.home.y > -100)) c.home.copy(c.p).setY(c.p.y - 12); c.p.copy(c.home); } }
          else { c.p.y = c.home.y + Math.abs(Math.sin(t * 6 + c.ph)) * 0.15; c.yaw = Math.sin(t * 0.5 + c.ph) * 2; }
          birds.setMatrixAt(bi++, m4.compose(c.p, q.setFromAxisAngle(up, c.yaw), s3.setScalar(1.4)));
        } else {
          if (d < 10) { c.to = c.p.clone().add(d3.set(c.p.x - hero.x, 0, c.p.z - hero.z).normalize().multiplyScalar(8)); }
          else if (!c.to && r() < dt * 0.1) c.to = c.home.clone().add(d3.set((r() - 0.5) * 16, 0, (r() - 0.5) * 16));
          if (c.to) stepTo(c, d < 10 ? 4 : 0.6, dt);
          grazers.setMatrixAt(gi++, m4.compose(c.p, q.setFromAxisAngle(up, c.yaw), s3.setScalar(1 + Math.sin(t * 3 + c.ph) * 0.02)));
        }
      }
      birds.instanceMatrix.needsUpdate = grazers.instanceMatrix.needsUpdate = true;
    },
  };
}
