// THE HOLLOW — l'histoire des Terres organiques. La Greffée est à moitié fondue dans le dos de l'Hôte, au pied du cœur :
// venue d'en haut comme le voyageur, elle s'est assise une minute, le sol était tiède. Elle parle au nom du Battement.
// Elle dit ce que personne n'a dit : le Hollow est vivant, et ceux qui descendent le nourrissent.
// La sève (l'encre de cette strate, sur le corail-poumon, surtout en haut des piliers) sert aux deux choix :
// — nourrir le Battement (4 gouttes dans sa bouche) : il bat plus fort, la Valve s'ouvre, la Greffée s'y fond tout à fait ;
// — le faire taire au pinceau (4 gouttes) : il ralentit et s'arrête, tout refroidit, la Valve se déchire ; la Greffée
//   entend le silence pour la première fois.
// Le Battement s'entend (un son grave, de plus en plus fort en approchant) : c'est le seul son du jeu pour l'instant.
// Retenu dans localStorage (« hollow-terres »). Chaque moment fort devient une page du carnet.
import * as THREE from 'three';
import { ink } from './ink.js';
import { U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { save } from './ui.js';

const SAP_MAX = 8, COST = 4;

// la Greffée : un buste qui sort d'un renflement de chair, les bras et les cheveux devenus racines
function greffeeGeometry() {
  const K = [
    paint(lump(1, { sx: 2.2, sy: 0.9, sz: 2, lumpy: 0.2, detail: 2 }).translate(0, 0.1, 0), '#e89070', '#8a3a2a'),
    paint(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.36, 0.35], [0.3, 0.7], [0.36, 0.9], [0.14, 1.05], [0, 1.06]].map(([x, y]) => new THREE.Vector2(x, y)), 14).translate(0, 0.6, 0), '#f0d8c8', '#c89080'),
    paint(new THREE.SphereGeometry(0.2, 14, 12).scale(0.9, 1.1, 0.95).translate(0, 1.86, 0.02), '#f0dccc', '#c8a898'),
  ];
  for (const s of [-1, 1]) K.push(paint(tube([[s * 0.36, 1.5, 0], [s * 0.7, 1.1, 0.35], [s * 1.1, 0.5, 0.6], [s * 1.6, 0.1, 0.9]], 0.09, 0.14, 6, 12), '#f0d8c8', '#c84a3a'));
  for (let k = 0; k < 9; k++) { const a = Math.PI * (0.6 + (k / 8) * 0.8); K.push(paint(tube([[Math.cos(a) * 0.12, 1.95, Math.sin(a) * 0.15 - 0.05], [Math.cos(a) * 0.4, 1.4, -0.4 + Math.sin(a) * 0.2], [Math.cos(a) * 0.9, 0.5, -0.9], [Math.cos(a) * 1.6, 0, -1.4 - (k % 3) * 0.4]], 0.04, 0.09, 4, 12), '#8a3a2a', '#e83a3a')); }
  return merge(K);
}

export function createStory(scene, { floorAt, mesa, heart, heartMesh, H, valve, gates, sap, start, look, eye, ui, hero }) {
  const st = Object.assign({ met: false, told: false, ink: 0, taken: [], choice: null, host: false }, save.load('hollow-terres', {}));
  const persist = () => save.keep('hollow-terres', st);
  const r = rng(5505);
  gates.valve = !!st.choice;

  // la Greffée, face au cœur, entre lui et la Valve
  const gx = heart.x - heart.r - 16, gz = heart.z + 6, gy = floorAt(gx, gz);
  const gMat = ink({ line: 0.9, trans: 0.4 }), greffee = cast(new THREE.Mesh(greffeeGeometry(), gMat));
  greffee.position.set(gx, gy, gz); greffee.rotation.y = Math.atan2(heart.x - gx, heart.z - gz); scene.add(greffee);
  const head = () => greffee.position.clone().add(new THREE.Vector3(0, 2.6, 0));
  if (st.choice === 'nourrir') greffee.position.y = gy - 2.6;
  // la bouche du cœur (nourrir) et son flanc opposé (faire taire)
  const mouthP = new THREE.Vector3(heart.x - heart.r - 2, floorAt(heart.x - heart.r - 2, heart.z), heart.z);
  const flankP = new THREE.Vector3(heart.x + heart.r + 2, floorAt(heart.x + heart.r + 2, heart.z), heart.z);
  // la sève : des grappes rouge vif qui luisent
  const sapMat = ink({ line: 0.4, glow: 1.6, pulse: 1, color: '#ff4a3a', vertexColors: false });
  const sapG = merge(Array.from({ length: 8 }, (_, k) => lump(0.2 + r() * 0.15, { detail: 1, seed: k }).translate((r() - 0.5) * 0.9, r() * 0.9, (r() - 0.5) * 0.9)));
  const drops = sap.map((p, i) => { const m = new THREE.Mesh(sapG, sapMat); m.position.set(p[0], p[1] + 0.5, p[2]); m.visible = !st.taken.includes(i); scene.add(m); return { m, i }; });
  // la Valve : un sphincter de chair fermé, qui s'écarte
  const lid = new THREE.Group();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, m = new THREE.Mesh(paint(lump(1, { sx: valve.R * 0.55, sy: 2.2, sz: 3.2, lumpy: 0.2, detail: 2, seed: k }).translate(valve.R * 0.5, 0, 0), '#e89070', '#8a3a2a'), ink({ line: 0.9 })); m.rotation.y = -a; lid.add(m); }
  const lidY = floorAt(valve.x + valve.R + 6, valve.z); lid.position.set(valve.x, lidY, valve.z); scene.add(lid);
  let opened = st.choice ? 1 : 0; lid.visible = !st.choice;

  const LINES = {
    first: ['Tu l’entends ? … Moi, je n’entends plus que lui.', 'Je suis venue d’en haut, comme toi. Je me suis assise une minute. Le sol était tiède.', 'Ça fait longtemps, une minute, ici.'],
    reveal: ['Tout ce qui tombe d’en haut finit ici. Les Jardins, les Brumes, la Forêt, l’eau : tout repose sur lui.', 'Le Hollow est vivant. Et ceux qui descendent le nourrissent.', 'Donne-lui de la sève, par sa bouche : il t’ouvrira la Valve.', 'Ou fais-le taire, avec ton pinceau, sur son flanc. Quatre gouttes, d’un côté comme de l’autre.'],
    nourrir: ['Oui… oui. Écoute-le.', 'Il t’ouvre la Valve. Il se souviendra de toi.', 'Moi, je reste. Je fais partie de lui, maintenant.'],
    taire: ['Non… Qu’est-ce que tu…', '…', 'C’est la première fois que j’entends le silence.', 'La Valve s’est déchirée. Va. Je vais rester un peu… pour écouter.'],
    after: { nourrir: ['… (on n’entend plus qu’un souffle, sous la chair)'], taire: ['Écoute. Rien. C’est beau, rien.'] },
  };
  let queue = [], qT = 0, last = 0, near = null, change = st.choice ? 1 : 0;
  const talk = (lines, pages = {}) => { if (!queue.length) qT = 0; queue.push(...lines.map((l, k) => [l, pages[k]])); };
  ui?.ink(st.ink, SAP_MAX);
  // l'allure : chaude au départ, froide et grise si on l'a fait taire
  const warm = { fog: new THREE.Color(look.fog), sun: new THREE.Color(look.sunCol), mid: new THREE.Color(look.skyMid), top: new THREE.Color(look.skyTop) };
  const warmPal = look.pal.map(c => new THREE.Vector3(...c)), grey = v => new THREE.Vector3().setScalar(v.x * 0.3 + v.y * 0.59 + v.z * 0.11).lerp(new THREE.Vector3(0.72, 0.74, 0.78), 0.35);
  const cold = { fog: new THREE.Color('#b8b4b0'), sun: new THREE.Color('#d8dce8'), mid: new THREE.Color('#b0aca8'), top: new THREE.Color('#e8e8ec') };
  const rate = () => (st.choice === 'nourrir' ? { bpm: 46 + change * 30, amp: 1 + change * 0.5 } : st.choice === 'taire' ? { bpm: 46 * (1 - change) + 4, amp: Math.max(0, 1 - change * 1.05) } : { bpm: 46, amp: 1 });

  // le son du Battement : un coup double très grave, plus fort près du cœur (le navigateur l'autorise après un geste)
  let ac = null;
  const wake = () => { if (!ac) { try { ac = new AudioContext(); } catch { /* pas de son */ } } else if (ac.state === 'suspended') ac.resume(); };
  addEventListener('keydown', wake); addEventListener('pointerdown', wake);
  const thump = (vol, at, f0) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, at + 0.25);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    o.connect(g).connect(ac.destination); o.start(at); o.stop(at + 0.45);
  };
  let heroP = new THREE.Vector3(...start);
  H.onBeat = () => {
    if (!ac || ac.state !== 'running') return;
    const d = Math.hypot(heroP.x - heart.x, heroP.z - heart.z), v = Math.min(0.9, 0.06 + 0.84 * Math.max(0, 1 - d / 1300) ** 2) * Math.min(1, H.amp);
    if (v < 0.01) return;
    const at = ac.currentTime + 0.02; thump(v, at, 62); thump(v * 0.6, at + (0.28 * 60) / H.bpm, 55);
  };

  function nearest(p) {
    const c = [];
    if (st.met && p.distanceTo(greffee.position) < 6) c.push(['parler', 'girl', p.distanceTo(greffee.position)]);
    if (st.told && !st.choice && p.distanceTo(mouthP) < 7) c.push([`nourrir le Battement (${COST} gouttes de sève)`, 'feed', p.distanceTo(mouthP) - 1]);
    if (st.told && !st.choice && p.distanceTo(flankP) < 7) c.push([`faire taire le Battement au pinceau (${COST} gouttes)`, 'hush', p.distanceTo(flankP) - 1]);
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  return {
    colliders: [[gx, gz, 2.2]],
    debug: { greffee, drops, st, gates, H, mouthP, flankP, lid },
    interact() {
      if (!near) return;
      const [, what] = near;
      if (what === 'girl') { if (queue.length) return; if (st.choice) talk(LINES.after[st.choice]); else if (!st.told) { st.told = true; persist(); talk(LINES.reveal, { 1: 'Le Hollow est vivant' }); } else talk(LINES.reveal.slice(2)); return; }
      if (st.ink < COST) { ui?.say('Il manque de la sève… (en haut des parois vivantes, sur le corail-poumon)', (what === 'feed' ? mouthP : flankP).clone().add(new THREE.Vector3(0, 4, 0)), 3); return; }
      st.ink -= COST; ui?.ink(st.ink, SAP_MAX);
      st.choice = what === 'feed' ? 'nourrir' : 'taire'; persist();
      talk(LINES[st.choice], { 1: st.choice === 'nourrir' ? 'Le Battement mange' : 'Le silence' });
      return what === 'hush' ? 'encre' : undefined; // le faire taire, c'est un geste de pinceau
    },
    leave() { removeEventListener('keydown', wake); removeEventListener('pointerdown', wake); H.onBeat = null; ac?.close(); },
    update(t, p) {
      const dt = Math.min(0.05, last ? t - last : 0.016); last = t; heroP.copy(p);
      if (!st.met && p.distanceTo(greffee.position) < 16) { st.met = true; persist(); talk(LINES.first, { 0: 'La Greffée' }); }
      if (queue.length && p.distanceTo(greffee.position) < 45) { qT -= dt; if (qT <= 0) { const [l, page] = queue.shift(); ui?.say(l, head(), 5); qT = 4.8; if (page) setTimeout(() => ui?.page(page), 1500); } }
      greffee.rotation.z = Math.sin(t * 0.5) * 0.02 * H.amp; greffee.scale.y = 1 + H.env * 0.02;
      // la sève : passer dans une grappe
      for (const d of drops) if (d.m.visible && st.ink < SAP_MAX && p.distanceTo(d.m.position) < 2.6) { d.m.visible = false; st.taken.push(d.i); st.ink++; persist(); ui?.ink(st.ink, SAP_MAX); ui?.say('+1 goutte de sève', d.m.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 1.6); }
      for (const d of drops) if (d.m.visible) d.m.scale.setScalar(1 + H.env * 0.15);
      // le choix fait son œuvre en 8 s : le rythme, la couleur, la Greffée, la Valve
      if (st.choice && change < 1) change = Math.min(1, change + dt / 8);
      const R = rate(); H.bpm = R.bpm; H.amp = R.amp;
      if (st.choice === 'nourrir') greffee.position.y = gy - 2.6 * change * change;
      if (st.choice === 'taire') { const k = change; U.uFogCol.value.lerpColors(warm.fog, cold.fog, k); U.uSunCol.value.lerpColors(warm.sun, cold.sun, k); U.uSkyMid.value.lerpColors(warm.mid, cold.mid, k); U.uSkyTop.value.lerpColors(warm.top, cold.top, k); heartMesh.children[0].material.uniforms.uFade.value = k * 0.5; warmPal.forEach((c, i) => U.uPal.value[i].copy(c).lerp(grey(c), k)); } // tout refroidit, jusqu'au sol
      if (st.choice && change > 0.7 && !gates.valve) gates.valve = true;
      if (gates.valve && opened < 1) { opened = Math.min(1, opened + dt / 4); lid.children.forEach(m => m.scale.set(1 - opened * 0.7, 1, 1)); lid.position.y = lidY - opened * 3; if (opened >= 1) lid.visible = false; }
      // l'œil de l'Hôte : la première fois qu'il s'ouvre, c'est une page
      if (!st.host && eye.open > 0.6) { st.host = true; persist(); ui?.page('On marchait sur un Hôte'); }
      near = nearest(p); ui?.prompt(near ? near[0] : null);
    },
  };
}
