// THE HOLLOW — l'histoire des Abysses engloutis. Le Plongeur, dans un vieux scaphandre noir, est assis au bord du toit
// de la plus haute tour, juste sous la lumière : il n'est jamais remonté. Il collectionne les fenêtres allumées.
// Sous 40 m, le jour s'éteint et le souffle s'use (la bande « souffle ») ; les cloches de nacre s'ouvrent pour respirer :
// en passer une ouverte rend tout le souffle (et c'est là qu'on se réveille si on en manque). En haut, on respire.
// Le Plongeur veut les trois fenêtres allumées du fond : au pinceau, on en détoure une, elle se décroche et remonte
// seule jusqu'à lui. À la première, il voit le manteau : c'était le sien (premier vrai indice) ; il donne son souffle
// (le souffle dure deux fois plus). À la troisième, la Fosse voit assez clair pour s'ouvrir : la suite.
// Retenu dans localStorage (« hollow-abysses »). Chaque moment fort devient une page du carnet.
import * as THREE from 'three';
import { ink, glowy } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { save } from './ui.js';
import { beacon } from './sol.js';

const AIR0 = 40, AIR_LONG = 85; // secondes de souffle dans le noir, avant et après le cadeau du Plongeur

// le Plongeur, assis, jambes pendantes dans le vide (il regarde vers +z) : scaphandre noir, casque de laiton
function diverGeometry() {
  const suit = (g, a = '#3a4650', b = '#141a20') => paint(g, a, b);
  const K = [
    suit(lump(0.5, { sx: 1, sy: 1.2, sz: 0.85, lumpy: 0.08, detail: 2 }).translate(0, 0.72, 0)),
    paint(new THREE.CylinderGeometry(0.42, 0.5, 0.16, 16).translate(0, 1.26, 0), '#8a7a4a', '#4a3a20'),
    paint(new THREE.SphereGeometry(0.4, 18, 14).translate(0, 1.6, 0), '#9a8a5a', '#4a3a20'),
    paint(lump(0.22, { sx: 1.4, sy: 1, sz: 0.8, detail: 1 }).translate(0, 1.0, -0.42), '#5a5a50', '#2a2a26'), // la bouteille dans le dos
  ];
  for (const s of [-1, 1]) {
    K.push(suit(tube([[s * 0.46, 1.08, 0], [s * 0.55, 0.78, 0.2], [s * 0.34, 0.52, 0.48]], 0.15, 0.13, 8, 6)));
    K.push(paint(lump(0.13, { detail: 1 }).translate(s * 0.33, 0.5, 0.52), '#8a7a4a'));
    K.push(suit(tube([[s * 0.22, 0.42, 0], [s * 0.24, 0.42, 0.55]], 0.17, 0.15, 8, 4)), suit(tube([[s * 0.24, 0.42, 0.55], [s * 0.26, -0.1, 0.6], [s * 0.27, -0.42, 0.62]], 0.15, 0.13, 8, 6)));
    K.push(paint(lump(0.2, { sx: 1, sy: 0.7, sz: 1.5, detail: 1 }).translate(s * 0.27, -0.55, 0.7), '#2a2e30', '#101214')); // semelles de plomb
  }
  return merge(K);
}
// une grande fenêtre ronde : un cadre de laiton (la vitre est à part : elle luit)
const frame = s => paint(new THREE.TorusGeometry(s, s * 0.12, 6, 24), '#9a8a5a', '#4a3a20');
// une cloche de nacre : une ombrelle fermée, sur une tige
const bellGeometry = () => paint(new THREE.LatheGeometry([[0.01, 2.2], [1, 2.05], [1.7, 1.3], [1.9, 0.3], [1.5, 0], [1.2, 0.5], [0.4, 0.8]].map(([x, y]) => new THREE.Vector2(x * 1.8, y * 1.8)), 22), '#fff4f8', '#c8a8e8', 0.05);

export function createStory(scene, { floorAt, PL, windows, bells, fosse, lidY, gates, dark, surf, start, long, ui, hero }) {
  const st = Object.assign({ met: false, windows: [], long: false }, save.load('hollow-abysses', {}));
  const persist = () => save.keep('hollow-abysses', st);
  const r = rng(4404);
  gates.fosse = st.windows.length >= 3;

  // le Plongeur, au bord du toit, tourné vers le large ; son tuyau d'air coupé flotte vers la surface
  const out = new THREE.Vector2(start[0] - PL.x, start[2] - PL.z).normalize();
  const px = PL.x + out.x * (PL.r - 0.7), pz = PL.z + out.y * (PL.r - 0.7);
  const diver = new THREE.Group();
  diver.add(cast(new THREE.Mesh(diverGeometry(), ink({ line: 1 }))));
  const ports = new THREE.Mesh(merge([0, 1, 2].map(k => { const a = (k - 1) * 1.3; return new THREE.CircleGeometry(0.12, 14).translate(0, 0, 0.405).rotateY(a).translate(0, 1.6, 0); })), ink({ glow: 2, color: '#ffe08a', vertexColors: false, side: THREE.DoubleSide }));
  diver.add(ports, new THREE.Mesh(paint(tube([[0, 1.75, -0.3], [0.6, 4, -1.2], [-0.8, 9, -1], [0.5, 15, -2.2], [0, 19, -1.5]], 0.07, 0.07, 6, 30), '#3a3a34', '#1a1a18'), ink({ line: 0.5, wind: 0.04 })));
  diver.position.set(px, PL.top, pz); diver.rotation.y = Math.atan2(out.x, out.y); scene.add(diver);
  const head = () => diver.position.clone().add(new THREE.Vector3(0, 2.6, 0));
  // sa collection : de petites fenêtres allumées posées contre la couronne du toit, et trois grands cadres vides
  {
    const K = [], G = [];
    for (let k = 0; k < 14; k++) { const a = Math.atan2(out.y, out.x) + Math.PI + (k / 13 - 0.5) * 2.6, R = PL.r - 1.6, x = PL.x + Math.cos(a) * R, z = PL.z + Math.sin(a) * R, s = 0.35 + r() * 0.3; const t = new THREE.Matrix4().compose(new THREE.Vector3(x, PL.top + s + 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, Math.PI / 2 - a + Math.PI, 0)), new THREE.Vector3(1, 1, 1)); K.push(frame(s).applyMatrix4(t)); G.push(new THREE.CircleGeometry(s * 0.92, 14).applyMatrix4(t)); }
    scene.add(new THREE.Mesh(merge(K), ink({ line: 0.6 })), new THREE.Mesh(merge(G), ink({ glow: 2.2, color: '#ffe08a', vertexColors: false, side: THREE.DoubleSide })));
  }
  const slots = [-1, 0, 1].map(k => { const a = Math.atan2(out.y, out.x) + Math.PI + k * 0.5, R = PL.r * 0.55; return { p: new THREE.Vector3(PL.x + Math.cos(a) * R, PL.top + 1.7, PL.z + Math.sin(a) * R), ry: Math.PI / 2 - a + Math.PI }; });
  for (const S of slots) { const f = new THREE.Mesh(frame(1.4), ink({ line: 0.8 })); f.position.copy(S.p); f.rotation.y = S.ry; scene.add(f); scene.add(new THREE.Mesh(paint(new THREE.CylinderGeometry(0.1, 0.14, 1.7, 6).translate(0, -0.85, 0), '#9a8a5a', '#4a3a20'), ink({ line: 0.6 })).translateX(S.p.x).translateY(S.p.y - 1.3).translateZ(S.p.z)); }

  // les trois fenêtres allumées du fond : un cadre, une vitre qui luit, un halo qu'on voit de loin dans le noir
  const glassMat = () => ink({ glow: 2.6, pulse: 1, color: '#ffe08a', vertexColors: false, side: THREE.DoubleSide });
  const wins = windows.map((W, i) => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(frame(1.4), ink({ line: 0.8 })), new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), glassMat()));
    g.position.set(W.x, W.y, W.z); g.rotation.y = Math.PI / 2 - W.a; scene.add(g);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), glowy({ color: '#ffd860', alpha: 0.28, add: true, soft: 1 })); halo.position.copy(g.position); scene.add(halo);
    const done = st.windows.includes(i);
    if (done) { g.position.copy(slots[st.windows.indexOf(i)].p); g.rotation.y = slots[st.windows.indexOf(i)].ry; halo.visible = false; }
    return { W, g, halo, i, fly: null, done };
  });

  // les cloches de nacre : elles s'ouvrent et se ferment ; ouvertes, elles lâchent une bulle et rendent le souffle
  const bellG = bellGeometry(), bellMat = ink({ line: 0.5, glow: 0.7, pulse: 1, trans: 0.4 });
  const B = bells.map(([x, y, z], i) => {
    const m = new THREE.Mesh(bellG, bellMat); m.position.set(x, y, z); scene.add(m);
    scene.add(new THREE.Mesh(paint(tube([[x, floorAt(x, z) - 1, z], [x + Math.sin(i) * 1.5, (y + floorAt(x, z)) / 2, z + Math.cos(i) * 1.5], [x, y + 0.3, z]], 0.25, 0.12, 5, 12), '#c8a8e8', '#2a4a50'), ink({ line: 0.4, wind: 0.01 })));
    const bub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), ink({ line: 0.4, trans: 0.8, glow: 0.6, color: '#e8fff8', vertexColors: false })); bub.visible = false; scene.add(bub);
    return { m, bub, p: new THREE.Vector3(x, y, z), c: new THREE.Vector3(x, y + 2, z), ph: r() * TAU, open: 0, by: 0 };
  });
  // le treillis d'Ossatures sur la Fosse, tant qu'elle est fermée
  const lid = cast(new THREE.Mesh(merge(Array.from({ length: 26 }, (_, k) => { const a = (k / 26) * TAU; return paint(tube([[fosse.x + Math.cos(a) * (fosse.R + 10), lidY + 3, fosse.z + Math.sin(a) * (fosse.R + 10)], [fosse.x + Math.cos(a + 0.5) * fosse.R * 0.5, lidY - 0.5, fosse.z + Math.sin(a + 0.5) * fosse.R * 0.5], [fosse.x + Math.cos(a + 1.1) * 3, lidY - 1, fosse.z + Math.sin(a + 1.1) * 3]], 2.4, 1, 6, 12), '#f0f4e8', '#6a9a90'); })), ink({ line: 0.9 })));
  lid.visible = !gates.fosse; scene.add(lid);

  const LINES = {
    first: ['… Tu respires encore ? Alors tu viens d’en haut.', 'Moi, je ne suis jamais remonté. Je collectionne les fenêtres allumées.', 'Plus bas, le noir te prend le souffle. Les cloches de nacre en rendent, quand elles s’ouvrent.', 'Rapporte-moi les fenêtres allumées du fond. Détoure-les au pinceau : elles remonteront seules.'],
    hint: ['Les fenêtres allumées sont en bas, dans le noir. Suis leur lueur.'],
    one: ['Oh… celle-là, je la cherchais.', 'Attends. Tourne-toi.', '… Ce manteau. C’était le mien.', 'Je l’ai laissé en haut, il y a longtemps. Et c’est toi qui le portes.', 'Garde-le. Et prends mon souffle : il ne me sert plus.'],
    two: ['Encore une. Elle brûle comme au premier jour.', 'Une dernière, et la Fosse verra assez clair pour s’ouvrir.'],
    three: ['Trois. Regarde comme elles éclairent le fond.', 'La Fosse ne s’ouvre qu’à la lumière. Elle est ouverte.', 'Va. Et si le Long passe… ne l’attends pas deux fois.'],
    after: ['Elles brûlent. Je n’ai plus besoin de remonter.'],
  };
  let queue = [], qT = 0, last = 0, near = null, air = st.windows.length ? AIR_LONG : AIR0, spawnAt = new THREE.Vector3(...start), opened = gates.fosse ? 1 : 0;
  const prev = new THREE.Vector3(...start), maxAir = () => (st.windows.length ? AIR_LONG : AIR0);
  // les répliques s'ajoutent à la suite : des fenêtres arrivées pendant qu'on était loin ne s'effacent pas l'une l'autre
  const talk = (lines, pages = {}) => { if (!queue.length) qT = 0; queue.push(...lines.map((l, k) => [l, pages[k]])); };
  function delivered(w) {
    w.done = true; w.fly = null; st.windows.push(w.i); persist();
    const n = st.windows.length;
    if (n === 1) { air = AIR_LONG; talk(LINES.one, { 2: 'Le manteau du Plongeur' }); }
    else if (n === 2) talk(LINES.two);
    else { gates.fosse = true; talk(LINES.three, { 1: 'La Fosse s’ouvre' }); ui?.say('Au fond, quelque chose s’ouvre.', hero.state.p.clone().add(new THREE.Vector3(0, 2.4, 0)), 4); }
  }
  // ce qu'il faut faire maintenant ; la balise dorée sur le Plongeur tant qu'il lui manque des fenêtres
  const mark = beacon(scene);
  function goal(p) {
    if (!st.met) return ['Nage jusqu’au Plongeur, assis au bord du toit de la plus haute tour', diver.position];
    if (st.windows.length >= 3) return ['La Fosse est ouverte : plonge tout au fond, dans la lueur rouge', new THREE.Vector3(fosse.x, lidY, fosse.z)];
    const w = wins.filter(w => !w.done && !w.fly).sort((u, v) => u.g.position.distanceTo(p) - v.g.position.distanceTo(p))[0];
    if (!w) return ['La fenêtre remonte vers le Plongeur…', diver.position];
    return [`Descends dans le noir et détoure au pinceau une fenêtre allumée (E) · ${st.windows.length}/3 · les cloches de nacre ouvertes rendent le souffle`, w.g.position];
  }
  function nearest(p) {
    const c = [];
    if (st.met && p.distanceTo(diver.position) < 7) c.push(['parler', 'diver', 0]);
    for (const w of wins) if (!w.done && !w.fly && p.distanceTo(w.g.position) < 5.5) c.push(['détourer la fenêtre au pinceau', w, p.distanceTo(w.g.position)]);
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  ui?.air(null);
  return {
    colliders: [],
    debug: { plongeur: diver, wins, bells: B, st, gates, get air() { return air; }, set air(v) { air = v; } },
    interact() {
      if (!near) return;
      const [, what] = near;
      if (what === 'diver') { if (!queue.length) talk(st.windows.length >= 3 ? LINES.after : LINES.hint); return; }
      // la fenêtre : le pinceau la détoure, elle se décroche, puis remonte seule jusqu'au Plongeur
      what.fly = { t: -1.6, from: what.g.position.clone(), to: slots[st.windows.length + wins.filter(w => w.fly && w !== what).length].p, ry: slots[st.windows.length + wins.filter(w => w.fly && w !== what).length].ry };
      ui?.say('Elle se décroche… et remonte vers le Plongeur.', what.g.position.clone().add(new THREE.Vector3(0, 2.5, 0)), 4);
      setTimeout(() => ui?.page('Une fenêtre allumée'), 1800);
      return 'encre';
    },
    update(t, p) {
      const dt = Math.min(0.05, last ? t - last : 0.016); last = t; // le même pas que le voyageur (main.js) : sur une machine lente, le souffle ne fond pas plus vite qu'il ne nage
      const v = p.distanceTo(prev) / Math.max(dt, 1e-3); prev.copy(p);
      if (!st.met && p.distanceTo(diver.position) < 20) { st.met = true; persist(); talk(LINES.first, { 1: 'Le Plongeur' }); }
      // ses répliques attendent qu'on soit près de lui
      if (queue.length && p.distanceTo(diver.position) < 40) { qT -= dt; if (qT <= 0) { const [l, page] = queue.shift(); ui?.say(l, head(), 5); qT = 4.8; if (page) setTimeout(() => ui?.page(page), 1200); } }
      diver.rotation.x = Math.sin(t * 0.5) * 0.03; ports.material.uniforms.uGlow.value = 1.6 + Math.sin(t * 0.8) * 0.4;
      // les fenêtres : le halo regarde le voyageur ; une fenêtre décrochée remonte en spirale jusqu'à son cadre
      for (const w of wins) {
        w.halo.lookAt(p);
        if (!w.fly) continue;
        w.fly.t += dt; const k = Math.max(0, w.fly.t / 10), e = k * k * (3 - 2 * k);
        if (w.fly.t < 0) { w.g.rotation.z = Math.sin(t * 30) * 0.05; continue; } // le pinceau la détoure
        w.g.position.lerpVectors(w.fly.from, w.fly.to, e).add(new THREE.Vector3(Math.sin(k * 9) * 6 * (1 - e), Math.sin(k * Math.PI) * 30, Math.cos(k * 9) * 6 * (1 - e)));
        w.g.rotation.y += dt * 2 * (1 - e); w.halo.position.copy(w.g.position); w.halo.scale.setScalar(1 - e * 0.8);
        if (k >= 1) { w.g.position.copy(w.fly.to); w.g.rotation.set(0, w.fly.ry, 0); w.halo.visible = false; delivered(w); }
      }
      // le souffle : il s'use dans le noir (plus vite en nageant vite), revient en haut et aux cloches ouvertes
      const max = maxAir();
      if (p.y > dark) air = Math.min(max, air + dt * 12);
      else air -= dt * (v > 8 ? 1.6 : 1);
      for (const b of B) {
        const c = (Math.sin(t * 1.05 + b.ph) + 1) / 2, open = c > 0.5;
        b.open += ((open ? 1 : 0) - b.open) * Math.min(1, dt * 3);
        b.m.scale.set(0.75 + b.open * 0.35, 1.15 - b.open * 0.3, 0.75 + b.open * 0.35);
        if (open && !b.bub.visible) { b.bub.visible = true; b.by = 0; }
        if (b.bub.visible) { b.by += dt * 3; b.bub.position.copy(b.p).add(new THREE.Vector3(Math.sin(t * 3 + b.ph) * 0.4, 4.6 + b.by, 0)); b.bub.scale.setScalar(1 + b.by * 0.04); if (b.by > 14) b.bub.visible = false; }
        if (b.open > 0.6 && p.distanceTo(b.c) < 7 && air < max - 0.5) { air = max; spawnAt.copy(b.p).add(new THREE.Vector3(0, 3.5, 0)); ui?.say('Une bulle d’air. Le souffle revient.', b.p.clone().add(new THREE.Vector3(0, 4, 0)), 2); }
      }
      if (air <= 0 && hero) { // plus de souffle : le noir, puis on se réveille à la dernière cloche
        hero.state.p.copy(spawnAt); hero.state.v.set(0, 0, 0); hero.state.fade = 1; air = max; prev.copy(spawnAt);
        ui?.say('Le souffle t’a manqué… Tu reviens à toi près de la dernière cloche.', spawnAt.clone().add(new THREE.Vector3(0, 2.5, 0)), 4);
      }
      ui?.air(p.y > dark && air >= max - 0.01 ? null : Math.max(0, air / max));
      // le Long : le voir de près, c'est une page
      if (!st.long && long.some(q => q && q.distanceTo(p) < 160)) { st.long = true; persist(); ui?.page('Le Long'); }
      // la Fosse s'ouvre : le treillis s'enfonce
      if (gates.fosse && opened < 1) { opened = Math.min(1, opened + dt / 5); lid.position.y = -opened * 30; if (opened >= 1) lid.visible = false; }
      { const [txt, at] = goal(p); ui?.goal(txt, at); mark.set(st.windows.length >= 3 ? null : diver.position, 2.6); mark.update(t, p); }
      near = nearest(p); ui?.prompt(near ? near[0] : null);
    },
  };
}
