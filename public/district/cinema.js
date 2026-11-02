// Little District : mode cinéma. Des plans lents qui s'enchaînent en fondu : vue d'ensemble, travelling dans la rue,
// comptoir, sanctuaire, canal, un passant qu'on suit, vue du dessus, feux d'artifice.
import * as THREE from 'three';
import { PLOTS, BUILDINGS } from './sim.js';
import { HILL, CANAL } from './terrain.js';
import { T } from './theme.js';
import { LAYOUT } from './layouts.js';
import { DISTRICT } from './theme.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const deg2 = a => (a * Math.PI) / 180;
const ease = t => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);
const sign = () => (Math.random() < 0.5 ? -1 : 1);

export function createCinema(world, { fade, label }) {
  const { camera, controls } = world;
  let active = false, shot = null, t = 0, saved = null, last = '', fading = false;

  // Chaque plan : nom, durée, et position/regard à l'instant t (0 → 1)
  const SHOTS = {
    ensemble: () => { const a0 = rnd(0, 6.28), d = sign(); return { name: 'Le quartier', dur: 18, at: t => ({ pos: V(Math.cos(a0 + d * t * 0.4) * 42, 26, -0.5 + Math.sin(a0 + d * t * 0.4) * 42), look: V(0, 0, -0.5), blur: 0.8 }) }; },
    rue: () => { const s = sign(), d = sign(); return { name: 'La grand-rue', dur: 16, at: t => { const x = lerp(-11 * d, 4 * d, t); return { pos: V(x, 1.05, s * 0.9), look: V(x + d * 6, 0.75, s * 0.3), blur: 1.3 }; } }; },
    comptoir: state => {
      const shops = state.plots.map((p, i) => [p, i]).filter(([p, i]) => p && BUILDINGS[p.type].cat !== 'home' && PLOTS[i].depth < 4.4).sort((a, b) => b[0].level - a[0].level); // grand-rue : la caméra a de la place
      if (!shops.length) return null;
      const [p, i] = shops[Math.floor(Math.random() * Math.min(2, shops.length))], P = PLOTS[i], f = Math.cos(P.ry), s = sign();
      return { name: BUILDINGS[p.type].name, dur: 15, at: t => ({ pos: V(P.x + s * lerp(1.6, 0.6, t), lerp(1.7, 1.3, t), P.z + f * (P.depth / 2 + lerp(3.2, 1.9, t))), look: V(P.x, 0.6, P.z + f * 0.4), blur: 1.4 }) };
    },
    colline: () => {
      // hauteur des bâtiments de la rangée du fond, de chaque côté de la ruelle : on passe du côté le plus bas, au-dessus du plus haut
      const top = side => Math.max(0, ...world.plots.map((P, i) => (P.model && PLOTS[i].z > 8 && Math.sign(PLOTS[i].x) === side ? new THREE.Box3().setFromObject(P.model).max.y : 0)));
      const s = top(1) < top(-1) ? 1 : top(1) > top(-1) ? -1 : sign(), y = Math.max(HILL.y + 6.5, top(s) + 3);
      return { name: T.hillView, dur: 16, at: t => ({ pos: V(s * lerp(3.4, 1.2, t), y, 20.3), look: V(s * lerp(0.8, -0.6, t), 0, 1), blur: 0.8 }) };
    },
    sanctuaire: () => { const s = sign(); return { name: T.hill, dur: 14, at: t => { const a = s * lerp(0.9, 0.3, t); return { pos: V(Math.sin(a) * 6, HILL.y + 2.4, 18.7 - Math.cos(a) * 6), look: V(0, HILL.y + 1.2, 18.6), blur: 0.7 }; } }; },
    canal: () => { const d = sign(); return { name: T.south, dur: 16, at: t => { const x = lerp(-12 * d, -2.5 * d, t); return { pos: V(x, CANAL.water + 0.75, (CANAL.z0 + CANAL.z1) / 2), look: V(x + d * 6, CANAL.water + 0.35, (CANAL.z0 + CANAL.z1) / 2), blur: 1.5 }; } }; },
    dessus: () => { const a0 = rnd(0, 6.28); return { name: 'Vu du ciel', dur: 14, at: t => ({ pos: V(Math.sin(a0 + t * 0.3) * 4, 48, -0.5 + Math.cos(a0 + t * 0.3) * 4), look: V(0, 0, -0.5), blur: 0.4 }) }; },
    suivre: () => {
      const p = world.people.sample(), c = world.life.followables();
      const obj = p ? p.m.root : c.length ? c[Math.floor(Math.random() * c.length)].obj : null;
      if (!obj) return null;
      const cam = obj.position.clone().add(V(0, 2, -2.5)), look = obj.position.clone();
      return { name: p ? 'Un habitant' : 'Un chat du quartier', dur: 18, lost: () => !obj.parent || !obj.visible || Math.abs(obj.position.x) > (LAYOUT ? 16 : 11.5), at: (t, dt) => {
        const back = V(-Math.sin(obj.rotation.y), 0, -Math.cos(obj.rotation.y));
        cam.lerp(obj.position.clone().addScaledVector(back, 3.2).add(V(0, 2.4, 0)), Math.min(1, dt * 1.2));
        look.lerp(obj.position.clone().add(V(0, 0.35, 0)), Math.min(1, dt * 3));
        return { pos: cam, look, blur: 1.1 };
      } };
    },
    feux: (state, ctx) => (ctx.festival && ctx.night > 0.5 ? { name: 'Feux d’artifice', dur: 18, at: t => ({ pos: V(lerp(-0.7, 0.7, t), 1.2, 7.4), look: V(0, 4, -6), blur: 0.6 }) } : null),
  };

  // Quartier avec son propre plan : ses propres plans de cinéma
  if (LAYOUT) {
    for (const k of ['rue', 'colline', 'sanctuaire', 'canal', 'feux']) delete SHOTS[k];
    const C = LAYOUT.view, M = LAYOUT.MARINA, TT = LAYOUT.T;
    Object.assign(SHOTS, {
      ensemble: () => { const a0 = rnd(0.3, 2.8), d = sign(); return { name: 'Le quartier', dur: 18, at: t => ({ pos: V(C.x + Math.cos(a0 + d * t * 0.35) * C.dist, 30, C.z + Math.sin(a0 + d * t * 0.35) * C.dist), look: V(C.x, 2, C.z), blur: 0.7 }) }; },
      dessus: () => { const a0 = rnd(0, 6.28); return { name: 'Vu du ciel', dur: 14, at: t => ({ pos: V(Math.sin(a0 + t * 0.3) * 4, 56, C.z + Math.cos(a0 + t * 0.3) * 4), look: V(0, 0, C.z), blur: 0.4 }) }; },
    });
    if (DISTRICT === 'moderne') Object.assign(SHOTS, {
      marina: () => { const d = sign(); return { name: T.south, dur: 16, at: t => { const x = lerp(-13 * d, 3 * d, t); return { pos: V(x, 4.6, M.z0 + 4.5), look: V(x + d * 3, 2.4, -4), blur: 0.9 }; } }; },
      lacets: () => ({ name: 'Les lacets', dur: 18, at: t => ({ pos: V(lerp(12, -4, t), lerp(2.2, 15, t), lerp(15, -2, t)), look: V(0, lerp(1.5, TT[3], t), lerp(2, -16, t)), blur: 0.8 }) }),
      belvedere: () => ({ name: T.hillView, dur: 16, at: t => ({ pos: V(lerp(-15, -11, t), TT[3] + 2.6, -14.2), look: V(lerp(-4, 4, t), 0.5, 10), blur: 0.7 }) }),
      villa: state => {
        const best = state.plots.map((p, i) => [p, i]).filter(([p, i]) => p && PLOTS[i].kind === 'villa').sort((a, b) => b[0].level - a[0].level || PLOTS[b[1]].size - PLOTS[a[1]].size)[0];
        if (!best) return null;
        const P = PLOTS[best[1]], s = sign();
        return { name: BUILDINGS[best[0].type].name, dur: 15, at: t => ({ pos: V(P.x + s * lerp(P.w * 0.6, P.w * 0.25, t), P.y + lerp(3.4, 2.4, t), P.z + P.depth / 2 + 2.6), look: V(P.x, P.y + 1, P.z), blur: 1.1 }) };
      },
    });
    if (DISTRICT === 'europe') Object.assign(SHOTS, {
      chaussee: () => ({ name: T.south, dur: 16, at: t => ({ pos: V(lerp(-1.5, 0.5, t), lerp(1.6, 2.4, t), lerp(31, 22, t)), look: V(0, 4, 0), blur: 0.8 }) }),
      remparts: () => { const a0 = rnd(0, 6.28), d = sign(); return { name: 'Les remparts', dur: 18, at: t => { const a = a0 + d * t * 0.9; return { pos: V(Math.cos(a) * 25, 6.5, Math.sin(a) * 25), look: V(0, 2.4, 0), blur: 0.8 }; } }; },
      grandrue: () => { const d = sign(); return { name: 'La Grand’Rue', dur: 16, at: t => { const a = deg2(lerp(110, 60, t) * d + (d < 0 ? 180 : 0)); return { pos: V(Math.cos(a) * 15, 1.5, Math.sin(a) * 15), look: V(Math.cos(a - d * 0.5) * 13.5, 1.2, Math.sin(a - d * 0.5) * 13.5), blur: 1.1 }; } }; },
      abbaye: () => { const a0 = rnd(0, 6.28); return { name: T.hill, dur: 15, at: t => { const a = a0 + t * 0.8; return { pos: V(Math.cos(a) * 17, 14, Math.sin(a) * 17), look: V(1.5, 6.5, 0), blur: 0.6 }; } }; },
    });
    if (DISTRICT === 'cotier') Object.assign(SHOTS, {
      front: () => { const d = sign(); return { name: 'Le front de mer', dur: 18, at: t => { const x = lerp(-17 * d, 17 * d, t); return { pos: V(x, 1.5, 6.2), look: V(x + d * 6, 0.9, 1.2), blur: 1 }; } }; },
      mer: () => ({ name: 'Vu de la mer', dur: 18, at: t => ({ pos: V(lerp(-12, 12, t), 3.2, 19), look: V(lerp(-8, 8, t), 0.8, -1), blur: 0.7 }) }),
      port: () => ({ name: 'Le port', dur: 15, at: t => ({ pos: V(24, lerp(1.4, 2.4, t), 14.8), look: V(lerp(14, 4, t), 1, 0), blur: 0.9 }) }),
      phare: () => { const s0 = sign(); return { name: T.hill, dur: 15, at: t => { const a = s0 * lerp(0.4, 1.4, t); return { pos: V(-24.3 + Math.sin(a) * 10, 9.5, 2 + Math.cos(a) * 10), look: V(-24.3, 6.2, 2), blur: 0.7 }; } }; },
    });
  }

  function next(ctx) {
    const keys = Object.keys(SHOTS).filter(k => k !== last);
    // les feux d'artifice passent en priorité quand il y en a
    if (SHOTS.feux?.(ctx.state, ctx) && last !== 'feux' && Math.random() < 0.5) keys.unshift('feux');
    else keys.sort(() => Math.random() - 0.5);
    for (const k of keys) {
      const s = SHOTS[k](ctx.state, ctx);
      if (!s) continue;
      shot = s; last = k; t = 0;
      label.textContent = s.name;
      label.classList.remove('show'); void label.offsetWidth; label.classList.add('show');
      return;
    }
  }

  return {
    get active() { return active; },
    play(key, ctx, at = 0) { const s = SHOTS[key](ctx.state, ctx); if (s) { shot = s; last = key; t = s.dur * at; fading = false; fade.classList.remove('on'); } return !!s; },
    start(ctx) {
      if (active) return;
      active = true;
      saved = { pos: camera.position.clone(), target: controls.target.clone() };
      controls.enabled = false;
      document.body.classList.add('cinema');
      fade.classList.add('on');
      setTimeout(() => { if (active) { next(ctx); fade.classList.remove('on'); } }, 800);
    },
    stop() {
      if (!active) return;
      active = false; shot = null; world.cam = null;
      document.body.classList.remove('cinema');
      camera.position.copy(saved.pos); controls.target.copy(saved.target);
      controls.enabled = true; controls.update();
      fade.classList.remove('on'); label.classList.remove('show');
    },
    update(dt, ctx) {
      if (!active || !shot) return;
      t += dt;
      const k = Math.min(1, t / shot.dur);
      const v = shot.at(shot.name === 'Un habitant' || shot.name === 'Un chat du quartier' ? k : ease(k * 0.9 + 0.05), dt);
      world.cam = { pos: v.pos, look: v.look, blur: v.blur };
      if (shot.lost?.() && !fading) t = Math.max(t, shot.dur - 0.8); // le sujet est parti : on passe au plan suivant
      if (t > shot.dur - 0.8 && !fading) { fading = true; fade.classList.add('on'); }
      if (t >= shot.dur) { fading = false; next(ctx); fade.classList.remove('on'); }
    },
  };
}
