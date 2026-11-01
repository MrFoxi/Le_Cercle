// Little District : la vie du quartier. Passants, clients assis aux comptoirs, personnel, habitants qui rentrent chez eux.
import * as THREE from 'three';
import { makePerson, seeded, std } from './models.js';
import { makeCat, animateCat } from './animals.js';
import { PLOTS, BUILDINGS } from './sim.js';

const Y = 0.06, IN_Y = 0.16, HY = 1.66; // trottoir, plancher des commerces, haut de la colline
// Horaires d'ouverture (au-delà de 24 : après minuit)
const OPEN = { ramen: [11, 26], street: [11, 23], cafe: [7, 19], konbini: [0, 24], fleurs: [8, 19], pain: [6.5, 18], livres: [9, 21], sushi: [11.5, 23], bar: [17, 27], karaoke: [12, 28], mode: [10, 20], arcade: [10, 24], ryotei: [17, 23] };
export const isOpen = (type, h) => { const o = OPEN[type]; return !!o && ((h >= o[0] && h < o[1]) || (h + 24 >= o[0] && h + 24 < o[1])); };

// Réseau de chemins : trottoirs, ruelle, sentiers, passages piétons, escalier de la colline, promenade et pont du canal
const XS = [-12.6, -9.3, -6.8, -4.3, 0, 4.3, 6.8, 9.3, 12.6];
const nodes = [], index = new Map(), adj = [];
const node = (x, z, y = Y) => { const k = `${x},${z}`; if (!index.has(k)) { index.set(k, nodes.length); nodes.push({ x, z, y, edge: Math.abs(x) > 12 }); adj.push([]); } return index.get(k); };
const link = (a, b) => { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z, nodes[a].y - nodes[b].y); adj[a].push([b, d]); adj[b].push([a, d]); };
for (const z of [-20.2, -14.3, -7.4, -2, 2, 7.4]) for (let i = 1; i < XS.length; i++) link(node(XS[i - 1], z), node(XS[i], z));
const ZS = [-14.3, -12.6, -10.15, -7.4, -4.8, -2, 2, 4.8, 7.4, 10.15, 12.6];
for (let i = 1; i < ZS.length; i++) link(node(0, ZS[i - 1]), node(0, ZS[i]));
for (const x of [-9.3, 9.3]) link(node(x, -2), node(x, 2));
const chain = pts => pts.reduce((a, [x, z, y]) => { const b = node(x, z, y); if (a != null) link(a, b); return b; }, null);
chain([[0, 12.6], [0, 14.95, HY], [0, 16.5, HY], [0, 17.3, HY]]); // escalier puis sanctuaire
const HXS = [-10.5, -5.5, 0, 5.5, 10.5];
for (let i = 1; i < HXS.length; i++) link(node(HXS[i - 1], 16.5, HY), node(HXS[i], 16.5, HY));
chain([[0, -14.3], [0, -15.4, 0.14], [0, -17.05, 0.66], [0, -18.7, 0.14], [0, -20.2]]); // pont
const SHRINE = index.get('0,17.3');
export const NAV = { nodes, adj, index };
const EDGES = nodes.map((n, i) => (n.edge ? i : -1)).filter(i => i >= 0);
const doorNode = i => index.get(`${PLOTS[i].x},${Math.abs(PLOTS[i].z) > 8 ? Math.sign(PLOTS[i].z) * 7.4 : Math.sign(PLOTS[i].z) * 2}`);

function route(a, b) {
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set();
  dist[a] = 0;
  while (true) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === b) break;
    done.add(u);
    for (const [v, d] of adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const out = [];
  for (let u = b; u >= 0; u = prev[u]) out.unshift(u);
  return out[0] === a ? out : [a];
}
const nearestNode = (x, z) => nodes.reduce((best, n, i) => (Math.hypot(n.x - x, n.z - z) < Math.hypot(nodes[best].x - x, nodes[best].z - z) ? i : best), 0);

export function createPeople({ scene, plots, low, emitCoin, onFlash }) {
  const rng = seeded(1234);
  const crowd = [], seats = plots.map(() => []), staff = plots.map(() => []);
  const root = new THREE.Group(); scene.add(root);
  let spawnT = 0, chatT = 0, lastResidents = -1, state = null, hour = 12, wet = false;
  const v3 = new THREE.Vector3();

  const toWorld = (i, x, z, y = 0) => v3.set(x, y, z).applyMatrix4(plots[i].holder.matrixWorld).clone();
  const yawOf = i => plots[i].holder.rotation.y;
  // La porte d'une parcelle : sur le trottoir, devant la façade
  const doorOf = i => { const d = plots[i].info?.door || { x: 0, z: PLOTS[i].depth / 2 }; return toWorld(i, d.x, d.z + 0.15); };

  function spawn(kind, at, opts = {}) {
    const m = makePerson(rng);
    m.root.position.set(at.x, Y, at.z);
    m.root.scale.multiplyScalar(0.01);
    root.add(m.root);
    const p = { m, kind, x: at.x, z: at.z, y: Y, dir: rng() * 6, path: [], state: 'idle', t: 0, ph: rng() * 6, speed: 0.5 + rng() * 0.22, lane: (rng() - 0.5) * 0.45, umbrella: rng() < 0.85, grow: 0, size: m.root.scale.x * 100, trips: 0, chatCd: 3 + rng() * 6, ...opts };
    if (!opts.follow && !opts.tour && kind === 'visitor' && rng() < 0.13) { // promène son chien
      p.dog = makeCat([['#c8a26a', '#efe0c4'], ['#3a2a20', '#6a5040'], ['#f2efe8', '#ffffff']][Math.floor(rng() * 3)], { dog: true });
      p.dog.root.position.set(0.34, 0, 0.18);
      const leash = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.14, 0.36, 0.04), new THREE.Vector3(0.34, 0.25, 0.36)]), new THREE.LineBasicMaterial({ color: '#c0392b' }));
      m.root.add(p.dog.root, leash);
    }
    crowd.push(p);
    return p;
  }
  // Groupe de touristes : un guide avec son fanion, les autres le suivent en grappe
  function tourists() {
    const id = pick(EDGES), guide = spawn('visitor', nodes[id], { node: id, tour: true, speed: 0.42, umbrella: true });
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), std('#dddddd')); pole.position.y = 0.6;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), std('#ffcf3a', { side: THREE.DoubleSide }));
    cloth.position.set(0.1, 1.03, 0);
    flag.add(pole, cloth); flag.position.set(0.16, 0, 0.06);
    guide.m.root.add(flag);
    for (let k = 0; k < 6; k++) spawn('visitor', nodes[id], { follow: guide, off: { x: ((k % 3) - 1) * 0.32 + (rng() - 0.5) * 0.1, z: -0.45 - Math.floor(k / 3) * 0.35 }, speed: 0.9 });
    decide(guide);
    return guide;
  }
  function stepFollower(p, dt) {
    const g = p.follow;
    if (g.dead || !crowd.includes(g)) { p.follow = null; p.state = 'gone'; p.t = 0.4; return; }
    if (p.grow < 1) { p.grow = Math.min(1, p.grow + dt * 2); p.m.root.scale.setScalar(p.size * p.grow); }
    const c = Math.cos(g.dir), s = Math.sin(g.dir);
    const tx = g.x + p.off.x * c + p.off.z * s, tz = g.z - p.off.x * s + p.off.z * c;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), moving = d > 0.05;
    if (moving) { const sp = Math.min(d, p.speed * dt * (d > 0.6 ? 1.6 : 1)); p.x += (dx / d) * sp; p.z += (dz / d) * sp; turn(p, Math.atan2(dx, dz), dt); }
    else turn(p, g.state === 'look' ? g.dir : p.dir, dt);
    p.y += (g.y - p.y) * Math.min(1, dt * 4);
    p.anim = !moving && g.state === 'look' && p.off.x > 0 ? 'photo' : null;
    if (p.anim === 'photo' && rng() < dt * 0.3) onFlash?.({ x: p.x, y: p.y + 0.62, z: p.z });
    animate(p, dt, moving);
    p.m.root.position.set(p.x, p.y, p.z);
    p.m.root.rotation.y = p.dir;
  }
  function remove(p) { root.remove(p.m.root); crowd.splice(crowd.indexOf(p), 1); if (p.seat) p.seat.taken = null; }

  // Chemin : points intermédiaires du réseau, avec un décalage latéral pour ne pas marcher en file indienne.
  function walkTo(p, target, nodeTo, then, inside = []) {
    const from = p.node ?? nearestNode(p.x, p.z);
    const ids = route(from, nodeTo);
    const pts = [...(p.exitPts || [])];
    p.exitPts = null;
    ids.forEach((id, k) => {
      const n = nodes[id], nx = ids[k + 1] != null ? nodes[ids[k + 1]] : n, pv = k ? nodes[ids[k - 1]] : n;
      const dx = nx.x - pv.x, dz = nx.z - pv.z, l = Math.hypot(dx, dz) || 1;
      const lane = Math.abs(n.x) < 0.1 && (n.z < -14 || n.z > 12.5) ? p.lane * 0.3 : p.lane; // étroit sur le pont et l'escalier
      pts.push({ x: n.x - (dz / l) * lane, z: n.z + (dx / l) * lane, y: n.y });
    });
    if (target) pts.push({ x: target.x, z: target.z, y: target.y ?? Y });
    pts.push(...inside);
    p.path = pts; p.state = 'walk'; p.then = then; p.node = nodeTo;
  }

  const shops = () => plots.map((P, i) => i).filter(i => plots[i].type && BUILDINGS[plots[i].type].cat !== 'home' && isOpen(plots[i].type, hour));
  const homes = () => plots.map((P, i) => i).filter(i => plots[i].type && BUILDINGS[plots[i].type].cat === 'home');
  const pick = a => a[Math.floor(rng() * a.length)];

  // Que faire ensuite ? Manger, regarder une vitrine, s'asseoir sur un banc, rentrer, ou quitter le quartier.
  function decide(p) {
    p.trips++;
    const r = rng(), open = shops();
    if (p.trips > 4 && p.kind === 'visitor') return leave(p);
    if (r < 0.55 && open.length && !p.tour) {
      const weights = open.map(i => 1 + state.plots[i].level * 0.6), total = weights.reduce((a, b) => a + b, 0);
      let x = rng() * total, i = open[0];
      for (let k = 0; k < open.length; k++) if ((x -= weights[k]) < 0) { i = open[k]; break; }
      return walkTo(p, doorOf(i), doorNode(i), () => arriveShop(p, i));
    }
    if (r < 0.7 && open.length) {
      const i = pick(open), spot = toWorld(i, (rng() - 0.5) * 2.6, PLOTS[i].depth / 2 - 0.1);
      return walkTo(p, spot, doorNode(i), () => { p.state = 'look'; p.t = 3 + rng() * 4; p.face = yawOf(i) + Math.PI; p.exitPts = []; });
    }
    if (r < 0.77) { // prier au sanctuaire de la colline
      const spot = { x: (rng() - 0.5) * 1.2, z: 17.25 + rng() * 0.2, y: HY };
      return walkTo(p, spot, SHRINE, () => { p.state = 'look'; p.anim = 'bow'; p.t = 4 + rng() * 3; p.face = 0; p.exitPts = []; });
    }
    if (r < 0.84) { // regarder l'eau du canal, d'une rive ou de l'autre
      const far = rng() < 0.4, z = far ? -20.2 : -14.3, nx = pick(XS.slice(1, -1));
      return walkTo(p, { x: nx + (rng() - 0.5) * 1.5, z: far ? -19.15 : -15, y: Y }, index.get(`${nx},${z}`), () => { p.state = 'look'; p.t = 5 + rng() * 6; p.face = far ? 0 : Math.PI; p.exitPts = []; });
    }
    if (p.tour) return leave(p);
    if (r < 0.9 && p.home != null && plots[p.home].type) {
      const i = p.home, d = doorOf(i), info = plots[i].info, inn = toWorld(i, info.doorIn?.x ?? 0, info.doorIn?.z ?? 0);
      return walkTo(p, d, doorNode(i), () => { p.state = 'home'; p.t = 25 + rng() * 50; p.m.root.visible = false; p.m.carry.visible = false; p.exitPts = [{ x: d.x, z: d.z, y: Y }]; }, [{ x: inn.x, z: inn.z, y: Y }]);
    }
    if (r < 0.95) {
      const benches = (state.decor || []).map((d, k) => ({ ...d, k })).filter(d => d.id === 'banc' && !crowd.some(o => o.bench === d.k));
      if (benches.length) {
        const b = pick(benches), seat = { x: b.x + Math.sin(b.r || 0) * 0.04, z: b.z + Math.cos(b.r || 0) * 0.04 };
        p.bench = b.k;
        return walkTo(p, seat, nearestNode(b.x, b.z), () => { p.state = 'sit'; p.sitH = 0.25; p.t = 8 + rng() * 10; p.face = b.r || 0; p.exitPts = []; });
      }
    }
    if (p.kind === 'visitor') return leave(p);
    walkTo(p, null, pick(nodes.map((n, i) => i).filter(i => !nodes[i].edge)), () => decide(p));
  }
  function leave(p) { p.leaving = true; walkTo(p, null, pick(EDGES), () => { p.state = 'gone'; p.t = 0.5; }); }

  function arriveShop(p, i) {
    if (!plots[i].type || !isOpen(plots[i].type, hour)) return decide(p);
    const seat = seats[i].find(s => !s.taken);
    if (!seat) {
      const k = crowd.filter(o => o.queue === i).length;
      if (k >= 3) return decide(p);
      const side = toWorld(i, -1.6 + k * 0.38, PLOTS[i].depth / 2 + 0.25);
      p.queue = i; p.state = 'walk'; p.path = [{ x: side.x, z: side.z, y: Y }]; p.then = () => { p.state = 'queue'; p.t = 14; p.face = yawOf(i) + Math.PI; };
      return;
    }
    takeSeat(p, i, seat);
  }
  function takeSeat(p, i, seat) {
    p.queue = null; seat.taken = p; p.seat = seat; p.shop = i;
    const front = toWorld(i, seat.x, seat.z + 0.45, IN_Y - Y), at = toWorld(i, seat.x, seat.z, IN_Y - Y);
    p.state = 'walk';
    p.path = [{ x: front.x, z: front.z, y: IN_Y }, { x: at.x, z: at.z, y: IN_Y }];
    p.then = () => { p.state = 'sit'; p.sitH = seat.sit; p.anim = seat.eat ? 'eat' : seat.sing ? 'sing' : seat.play ? 'play' : 'browse'; p.t = 10 + rng() * 14; p.face = seat.ry + yawOf(i); p.exitPts = [{ x: front.x, z: front.z, y: IN_Y }, (({ x, z }) => ({ x, z, y: Y }))(doorOf(i))]; };
  }
  function standUp(p) {
    if (p.seat) {
      p.seat.taken = null; p.seat = null;
      if (p.shop != null && plots[p.shop].type) emitCoin(p.shop, toWorld(p.shop, 0, PLOTS[p.shop].depth / 2 - 0.4, 1.4));
      p.node = p.shop != null ? doorNode(p.shop) : p.node;
      p.shop = null;
    }
    p.bench = null; p.sitH = 0; p.anim = null;
    decide(p);
  }

  // Le personnel : va et vient derrière le comptoir, entre les tables, cuisine.
  function plotChanged(i) {
    for (const s of staff[i]) s.m.root.parent?.remove(s.m.root);
    staff[i] = [];
    for (const s of seats[i]) if (s.taken) { const p = s.taken; p.seat = null; p.shop = null; p.sitH = 0; p.anim = null; p.exitPts = [doorOf(i)]; decide(p); }
    seats[i] = (plots[i].info?.seats || []).map(s => ({ ...s, taken: null }));
    for (const p of crowd) if (p.queue === i) { p.queue = null; decide(p); }
    for (const def of plots[i].info?.staff || []) {
      const m = makePerson(rng, def.uniform);
      const [x, z] = def.path[0];
      m.root.position.set(x, IN_Y - Y, z);
      plots[i].holder.add(m.root);
      staff[i].push({ m, def, k: 0, t: rng() * 2, x, z, ph: rng() * 6, dir: Math.PI });
    }
  }

  function animate(p, dt, moving) {
    const m = p.m;
    p.ph += dt * (moving ? p.speed * 13 : 3);
    const s = Math.sin(p.ph);
    const sitting = p.sitH > 0;
    m.legL.rotation.x = sitting ? -1.45 : moving ? s * 0.55 : 0;
    m.legR.rotation.x = sitting ? -1.45 : moving ? -s * 0.55 : 0;
    m.body.position.y = sitting ? p.sitH - 0.27 : moving ? Math.abs(s) * 0.018 : 0;
    m.armL.rotation.x = moving ? -s * 0.4 : 0;
    m.armR.rotation.x = moving ? s * 0.4 : 0;
    m.armR.rotation.z = m.armL.rotation.z = 0;
    m.head.rotation.set(0, 0, 0);
    m.body.rotation.z = 0; m.body.rotation.x = 0;
    if (p.dog) animateCat(p.dog, dt, moving ? 'walk' : 'sit');
    const a = p.anim || (p.state === 'chat' ? 'chat' : p.state === 'look' ? 'look' : null);
    if (a === 'eat') { m.armR.rotation.x = -1.3 + Math.sin(p.ph * 1.6) * 0.3; m.armL.rotation.x = -0.9; m.head.rotation.x = 0.15 + Math.sin(p.ph * 1.6) * 0.08; }
    else if (a === 'sing') { m.armR.rotation.x = -2.4; m.body.rotation.z = Math.sin(p.ph) * 0.12; m.armL.rotation.x = -0.6 + Math.sin(p.ph * 2) * 0.3; }
    else if (a === 'play') { m.armR.rotation.x = -1.1 + Math.sin(p.ph * 7) * 0.08; m.armL.rotation.x = -1.1 + Math.cos(p.ph * 6) * 0.08; }
    else if (a === 'browse') { m.head.rotation.y = Math.sin(p.ph * 0.4) * 0.5; m.armR.rotation.x = -0.5 + Math.sin(p.ph * 0.5) * 0.3; }
    else if (a === 'chat') { m.armR.rotation.x = -0.6 + Math.sin(p.ph * 2.2) * 0.35; m.head.rotation.x = Math.sin(p.ph * 1.7) * 0.12; }
    else if (a === 'look') { m.head.rotation.y = Math.sin(p.ph * 0.5) * 0.4; m.head.rotation.x = 0.1; }
    else if (a === 'bow') { const k = Math.max(0, Math.sin(p.ph * 0.5)); m.body.rotation.x = k * 0.45; m.armL.rotation.x = m.armR.rotation.x = -0.4 * k; }
    else if (a === 'photo') { m.armR.rotation.x = m.armL.rotation.x = -1.9; m.head.rotation.x = -0.1; }
    else if (a === 'cook') { m.armR.rotation.x = -0.9 + Math.sin(p.ph * 4) * 0.25; m.armL.rotation.x = -0.9 + Math.cos(p.ph * 4) * 0.25; m.head.rotation.x = 0.25; }
    const umb = p.umbrella && wet && !p.seat;
    m.umbrella.visible = umb;
    if (umb) m.armR.rotation.x = -0.75, m.armR.rotation.z = 0.15;
  }

  const turn = (p, target, dt) => { let d = target - p.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); p.dir += d * Math.min(1, dt * 9); };

  function step(p, dt) {
    if (p.follow) return stepFollower(p, dt);
    if (p.grow < 1) { p.grow = Math.min(1, p.grow + dt * 2); p.m.root.scale.setScalar(p.size * p.grow); }
    if (p.state === 'walk') {
      const tgt = p.path[0];
      if (!tgt) { p.state = 'idle'; return p.then ? p.then() : decide(p); }
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz), sp = p.speed * dt * (p.m.carry.visible ? 0.8 : 1);
      p.y += (tgt.y - p.y) * Math.min(1, sp / Math.max(d, 1e-6)); // monte les marches au même rythme qu'il avance
      if (d <= sp) { p.x = tgt.x; p.z = tgt.z; p.path.shift(); }
      else { p.x += (dx / d) * sp; p.z += (dz / d) * sp; turn(p, Math.atan2(dx, dz), dt); }
      animate(p, dt, true);
    } else {
      if (p.face != null) turn(p, p.face, dt);
      animate(p, dt, false);
      if ((p.t -= dt) <= 0) {
        if (p.state === 'gone') { p.dead = true; return; }
        if (p.state === 'home') { p.m.root.visible = true; p.trips = 0; p.node = doorNode(p.home); return decide(p); }
        if (p.state === 'queue') { p.queue = null; p.exitPts = []; return decide(p); }
        if (p.state === 'chat') { p.state = 'walk'; return; }
        standUp(p);
      }
      if (p.state === 'queue') { const seat = seats[p.queue]?.find(s => !s.taken); if (seat) takeSeat(p, p.queue, seat); }
      if (p.state === 'gone') p.m.root.scale.setScalar(Math.max(0.01, p.size * p.t * 2));
    }
    p.m.root.position.set(p.x, p.y, p.z);
    p.m.root.rotation.y = p.dir;
  }

  function stepStaff(i, s, dt) {
    const open = isOpen(plots[i].type, hour);
    s.m.root.visible = open;
    if (!open) return;
    const pts = s.def.path, tgt = pts[s.k];
    const dx = tgt[0] - s.x, dz = tgt[1] - s.z, d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const sp = dt * 0.45;
      if (d <= sp) { s.x = tgt[0]; s.z = tgt[1]; } else { s.x += (dx / d) * sp; s.z += (dz / d) * sp; }
      turn(s, Math.atan2(dx, dz), dt);
      s.anim = null;
      animate(s, dt, true);
    } else {
      if ((s.t -= dt) <= 0) { s.k = (s.k + 1) % pts.length; s.t = 1.5 + rng() * 3; }
      turn(s, pts.length === 1 || s.def.cook ? 0 : s.dir, dt);
      s.anim = s.def.cook ? 'cook' : pts.length === 1 ? 'browse' : null;
      s.speed = 0.4; s.sitH = 0;
      animate(s, dt, false);
    }
    s.m.root.position.set(s.x, IN_Y - Y, s.z);
    s.m.root.rotation.y = s.dir;
  }

  return {
    isOpen, plotChanged,
    get count() { return crowd.length; },
    tourists,
    near: (x, z, r) => crowd.some(p => p.m.root.visible && Math.hypot(p.x - x, p.z - z) < r),
    // un passant qui marche, pour la caméra cinéma
    sample: () => pick(crowd.filter(p => p.state === 'walk' && !p.follow && !p.leaving && p.path.length > 2)) || null,
    update(dt, ctx) {
      state = ctx.state; hour = ctx.hour; wet = ctx.wet;
      dt = Math.min(dt, 0.1);
      // Combien de monde dans les rues ? Selon l'heure, la pluie, la taille du quartier.
      const builtN = state.plots.filter(Boolean).length;
      const hf = hour < 5 ? 0.2 : hour < 8 ? 0.55 : hour < 11 ? 0.8 : hour < 14 ? 1 : hour < 17 ? 0.9 : hour < 21.5 ? 1.1 : 0.55;
      const target = Math.min(low ? 18 : 44, Math.round((6 + builtN * 1.8 + Math.min(state.residents, 40) * 0.25) * hf * (wet ? 0.75 : 1) * (ctx.crowd || 1)));
      const hs = homes();
      // Les nouveaux habitants arrivent avec leurs cartons
      const res = Math.floor(state.residents);
      if (lastResidents >= 0 && res > lastResidents && hs.length) {
        const h = pick(hs), e = nodes[pick(EDGES)], p = spawn('resident', e, { home: h, node: index.get(`${e.x},${e.z}`) });
        p.m.carry.visible = true; p.umbrella = false;
        walkTo(p, doorOf(h), doorNode(h), () => { p.state = 'home'; p.t = 20; p.m.root.visible = false; p.m.carry.visible = false; p.exitPts = [doorOf(h)]; });
      }
      lastResidents = res;
      if ((spawnT -= dt) < 0) {
        spawnT = 0.8 + rng() * 0.8;
        if (crowd.length < target) {
          const fromHome = hs.length && rng() < Math.min(0.6, state.residents / 30);
          if (fromHome) {
            const h = pick(hs), d = doorOf(h);
            const p = spawn('resident', d, { home: h, node: doorNode(h) });
            decide(p);
          } else {
            const id = pick(EDGES), p = spawn('visitor', nodes[id], { node: id, home: hs.length && rng() < 0.3 ? pick(hs) : null });
            decide(p);
          }
        }
      }
      // Deux passants qui se croisent s'arrêtent parfois pour discuter
      if ((chatT -= dt) < 0) {
        chatT = 0.5;
        const walkers = crowd.filter(p => p.state === 'walk' && !p.seat && !p.follow && !p.tour && (p.chatCd -= 0.5) < 0);
        for (let a = 0; a < walkers.length; a++) for (let b = a + 1; b < walkers.length; b++) {
          const A = walkers[a], B = walkers[b];
          if (Math.hypot(A.x - B.x, A.z - B.z) < 0.55 && rng() < 0.35) {
            for (const [P, O] of [[A, B], [B, A]]) { P.state = 'chat'; P.t = 3 + rng() * 4; P.face = Math.atan2(O.x - P.x, O.z - P.z); P.chatCd = 25; }
          }
        }
      }
      for (const p of [...crowd]) { step(p, dt); if (p.dead) remove(p); }
      plots.forEach((P, i) => staff[i].forEach(s => stepStaff(i, s, dt)));
    },
  };
}
