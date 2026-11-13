// La Castagne : la simulation du combat, partagée par le serveur (qui fait foi) et le navigateur (qui anticipe son
// propre personnage). Script classique : window.BR ou require. 60 images par seconde, unités en pixels, y vers le bas.
// Un combattant se déplace, saute (un saut au sol, deux en l'air, sauts contre les murs), esquive, attaque ;
// les coups touchent, ajoutent des dégâts et éjectent d'autant plus loin que les dégâts sont hauts ; sortir des limites
// de l'arène coûte une vie. Testé par jeux/castagne/castagne.test.js.
(function (root, factory) {
  const BR = factory();
  if (typeof module === 'object' && module.exports) module.exports = BR;
  else root.BR = BR;
})(this, () => {
  const FPS = 60;
  const IN = { L: 1, R: 2, U: 4, D: 8, JUMP: 16, LIGHT: 32, HEAVY: 64, DODGE: 128 };
  const HW = 22, HH = 86; // demi-largeur et hauteur du corps (pieds en y)

  /* ---------------- Arène ---------------- */
  const ARENAS = {
    phare: {
      name: 'Le Phare des Nuées',
      solids: [{ x0: -430, x1: 430, y0: 0, y1: 240 }], // l'île principale (on ne passe pas au travers)
      plats: [{ x0: -340, x1: -140, y: -175 }, { x0: 140, x1: 340, y: -175 }, { x0: -95, x1: 95, y: -330 }], // planches qu'on traverse par en dessous
      blast: { l: -1180, r: 1180, t: -950, b: 720 },
      spawns: [[-260, 0], [260, 0], [-90, 0], [90, 0], [-370, 0], [370, 0], [-240, -175], [240, -175]],
      respawn: [0, -520],
    },
  };

  /* ---------------- Coups ---------------- */
  // Une attaque : f images en tout ; hits : fenêtres actives (s → e) avec une boîte (x vers l'avant, y depuis les pieds,
  // largeur, hauteur), des dégâts, un recul de base (kb) qui grandit avec les dégâts déjà subis (ks), une direction (dx, dy) ;
  // vel : vitesses imposées à certaines images ; grav : gravité pendant le coup ; land : temps de récupération à l'atterrissage.
  function moveset(k) {
    const T = n => Math.round(n * k.spd), P = n => +(n * k.pow).toFixed(2), R = n => Math.round(n * k.reach);
    const hit = (s, e, x, y, w, h, dmg, kb, ks, dx, dy, o = {}) => ({ s: T(s), e: T(e), x: R(x), y, w: R(w), h, dmg: P(dmg), kb: P(kb), ks, dx, dy, ...o });
    return {
      jab: { f: T(18), hits: [hit(4, 7, 36, -56, 44, 28, 5, 3.2, 0.025, 1, -0.3)] },
      sLight: { f: T(24), vel: [[2, 10.5, null]], hits: [hit(6, 11, 38, -52, 48, 30, 7, 4, 0.045, 1, -0.35)] },
      dLight: { f: T(26), vel: [[2, 9, null]], hits: [hit(5, 12, 30, -14, 54, 24, 6, 4.5, 0.035, 0.45, -1)] },
      nHeavy: { f: T(40), vel: [[T(11), 1.5, -3]], hits: [hit(11, 17, 16, -104, 52, 64, 13, 6, 0.1, 0.15, -1)], heavy: true },
      sHeavy: { f: T(44), vel: [[T(14), 7, null]], hits: [hit(15, 20, 48, -52, 64, 36, 16, 7, 0.13, 1, -0.42)], heavy: true },
      dHeavy: { f: T(42), hits: [hit(14, 19, 0, -22, 150, 32, 14, 6.5, 0.11, 1, -0.6, { both: true })], heavy: true },
      nAir: { f: T(26), air: true, land: 6, hits: [hit(5, 14, 0, -46, 92, 72, 8, 4, 0.05, 0.6, -0.8, { both: true })] },
      sAir: { f: T(26), air: true, land: 7, hits: [hit(6, 12, 42, -46, 52, 32, 9, 5, 0.07, 1, -0.3)] },
      dAir: { f: T(30), air: true, land: 8, hits: [hit(7, 14, 6, 4, 50, 36, 10, 5, 0.07, 0.25, 1, { spike: true })] },
      recovery: { f: T(38), air: true, land: 10, grav: 0.45, once: true, vel: [[3, 3, -15.5]], hits: [hit(4, 14, 14, -82, 58, 84, 11, 6, 0.08, 0.3, -1)], heavy: true },
      pound: { f: T(60), air: true, land: 14, pound: true, vel: [[T(8), 0, 22]], hits: [hit(8, 60, 0, 2, 72, 44, 14, 6.5, 0.1, 0.7, -0.7, { both: true })], heavy: true },
    };
  }
  /* ---------------- Personnages ---------------- */
  const CHARS = {
    fenna: { name: 'Fenna', title: 'la renarde voltigeuse', weight: 90, run: 7.4, accel: 1.15, airSpeed: 6.4, airAccel: 0.55, jump: 15.6, airJump: 13.6, grav: 0.72, fall: 13, fastFall: 19, moves: moveset({ spd: 1, pow: 1, reach: 1 }), stats: { vitesse: 5, force: 2, poids: 2, portée: 3 } },
    gromm: { name: 'Gromm', title: 'l’ours forgeron', weight: 118, run: 5.9, accel: 0.8, airSpeed: 5.3, airAccel: 0.42, jump: 14.6, airJump: 12.6, grav: 0.78, fall: 14.5, fastFall: 20, moves: moveset({ spd: 1.18, pow: 1.28, reach: 1.15 }), stats: { vitesse: 2, force: 5, poids: 5, portée: 4 } },
  };
  const CHAR_IDS = Object.keys(CHARS);
  const MOVE_IDS = Object.keys(CHARS.fenna.moves);
  const STATES = ['idle', 'run', 'air', 'attack', 'lag', 'dodge', 'hitstun', 'dead', 'out'];

  /* ---------------- Un combattant ---------------- */
  function fighter(id, char, [x, y], facing = 1) {
    return { id, char, x, y, vx: 0, vy: 0, facing, state: 'air', move: null, mt: 0, ground: false, jumps: 2, wallJumps: 3, coyote: 0, drop: 0, dmg: 0, stocks: 3, hitstun: 0, hitlag: 0, invuln: 0, dodgeCd: 0, airDodge: false, recovery: true, prevIn: 0, hitIds: [], lag: 0, dead: 0, wall: 0, lastHit: null, kos: 0, falls: 0 };
  }
  const C = f => CHARS[f.char];
  const free = f => f.state === 'idle' || f.state === 'run' || f.state === 'air';

  function startMove(f, id) {
    f.state = 'attack'; f.move = id; f.mt = 0; f.hitIds = [];
    if (C(f).moves[id].once) f.recovery = false;
  }
  // Choisit le coup selon les touches et la situation (au sol ou en l'air).
  function pickMove(f, inp, heavy) {
    const side = (inp & IN.L ? -1 : 0) + (inp & IN.R ? 1 : 0), down = inp & IN.D;
    if (side) f.facing = side;
    if (f.ground) return heavy ? (down ? 'dHeavy' : side ? 'sHeavy' : 'nHeavy') : down ? 'dLight' : side ? 'sLight' : 'jab';
    if (heavy) return down ? 'pound' : f.recovery ? 'recovery' : null;
    return down ? 'dAir' : side ? 'sAir' : 'nAir';
  }

  // Ce qu'il y a sous les pieds (dessus d'une île, ou planche si on ne la traverse pas).
  function support(f, A) {
    for (const s of A.solids) if (f.x > s.x0 - HW * 0.6 && f.x < s.x1 + HW * 0.6 && Math.abs(f.y - s.y0) < 0.5) return true;
    if (f.drop > 0) return false;
    for (const p of A.plats) if (f.x > p.x0 && f.x < p.x1 && Math.abs(f.y - p.y) < 0.5) return true;
    return false;
  }
  function land(f) {
    f.ground = true; f.vy = 0; f.jumps = 2; f.wallJumps = 3; f.airDodge = false; f.recovery = true;
  }

  // Une image pour un combattant, avec ses touches (bits IN). Les coups qui touchent sont réglés par resolve().
  function step(f, inp, A) {
    if (f.state === 'out') return;
    if (f.dead > 0) { if (--f.dead === 0) respawn(f, A); return; }
    if (f.hitlag > 0) { f.hitlag--; f.prevIn = inp; return; } // gel de l'impact
    const c = C(f), pressed = inp & ~f.prevIn;
    f.prevIn = inp;
    const dir = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0);
    if (f.invuln > 0) f.invuln--;
    if (f.dodgeCd > 0) f.dodgeCd--;
    if (f.drop > 0) f.drop--;
    if (f.coyote > 0) f.coyote--;
    let grav = c.grav, maxFall = c.fall;

    if (f.state === 'hitstun') {
      f.vx *= 0.986; f.vx += dir * 0.12; // un peu d'influence sur sa trajectoire
      if (--f.hitstun <= 0) f.state = 'air';
      maxFall = c.fall * 1.6;
    } else if (f.state === 'lag') {
      f.vx *= 0.8;
      if (--f.lag <= 0) f.state = 'idle';
    } else if (f.state === 'dodge') {
      f.mt++;
      if (f.move === 'air') { grav = 0; if (f.mt > 14) { f.state = 'air'; f.vx *= 0.4; f.vy *= 0.4; } }
      else { f.vx *= 0.75; if (f.mt > 22) f.state = f.ground ? 'idle' : 'air'; }
    } else if (f.state === 'attack') {
      const m = c.moves[f.move];
      f.mt++;
      for (const [fr, vx, vy] of m.vel ?? []) if (fr === f.mt) { if (vx !== null) f.vx = vx * f.facing; if (vy !== null) f.vy = vy; }
      if (f.ground && !m.air) f.vx *= 0.9;
      else f.vx += dir * c.airAccel * 0.5, f.vx = Math.max(-c.airSpeed, Math.min(c.airSpeed, f.vx));
      if (m.grav !== undefined && f.mt < m.f * 0.6) grav = c.grav * m.grav;
      if (m.pound) { grav = 0; maxFall = 24; }
      if (f.mt >= m.f && !m.pound) { f.state = f.ground ? 'idle' : 'air'; f.move = null; }
    } else {
      // libre : courir, sauter, tomber vite, traverser une planche, esquiver, attaquer
      if (f.ground) {
        const target = dir * c.run;
        f.vx += Math.sign(target - f.vx) * Math.min(Math.abs(target - f.vx), dir ? c.accel : c.accel * 1.6);
        if (dir) f.facing = dir;
        f.state = dir ? 'run' : 'idle';
      } else {
        f.vx += dir * c.airAccel;
        if (!dir) f.vx *= 0.97;
        f.vx = Math.max(-c.airSpeed * 1.15, Math.min(c.airSpeed * 1.15, f.vx));
        f.state = 'air';
        if (inp & IN.D && f.vy > -2) f.vy = Math.max(f.vy, c.fastFall * 0.8), maxFall = c.fastFall; // chute rapide
      }
      if (pressed & IN.JUMP) {
        if (f.ground || f.coyote > 0) { f.vy = -c.jump; f.ground = false; f.coyote = 0; f.events?.push('jump'); }
        else if (f.wall && f.wallJumps > 0) { f.wallJumps--; f.vy = -c.airJump; f.vx = -f.wall * 7.5; f.facing = -f.wall; f.events?.push('walljump'); }
        else if (f.jumps > 0) { f.jumps--; f.vy = -c.airJump; if (dir) f.vx = dir * c.airSpeed; f.events?.push('airjump'); }
      }
      if (!(inp & IN.JUMP) && f.vy < -4 && !f.ground) f.vy += c.grav * 0.9; // saut court si on relâche tôt
      if (f.ground && pressed & IN.D) { for (const p of A.plats) if (f.x > p.x0 && f.x < p.x1 && Math.abs(f.y - p.y) < 0.5) { f.drop = 12; f.ground = false; f.vy = 2; } }
      if (pressed & IN.DODGE && f.dodgeCd === 0 && (f.ground || !f.airDodge)) {
        f.state = 'dodge'; f.mt = 0; f.dodgeCd = 54;
        const dy = (inp & IN.D ? 1 : 0) - (inp & IN.U ? 1 : 0);
        if (!f.ground && (dir || dy)) { const l = Math.hypot(dir, dy); f.move = 'air'; f.vx = (dir / l) * 11; f.vy = (dy / l) * 11; f.invuln = 14; f.airDodge = true; }
        else { f.move = 'spot'; f.invuln = 20; if (!f.ground) f.airDodge = true; }
        f.events?.push('dodge');
      } else if (pressed & (IN.LIGHT | IN.HEAVY)) {
        const id = pickMove(f, inp, pressed & IN.HEAVY);
        if (id) startMove(f, id);
      }
    }
    if (f.state === 'dodge' && f.move === 'spot' && !f.ground) grav *= 0.4;

    // gravité et déplacement
    if (!f.ground) f.vy = Math.min(f.vy + grav, Math.max(maxFall, f.vy));
    const px = f.x, py = f.y;
    f.x += f.vx; f.y += f.vy;
    f.wall = 0;
    const wasGround = f.ground;
    f.ground = false;
    // planches : on atterrit dessus en descendant, on les traverse en montant
    if (f.vy >= 0 && f.drop === 0 && !(f.state === 'hitstun' && inp & IN.D)) for (const p of A.plats) if (py <= p.y + 0.5 && f.y >= p.y && f.x > p.x0 && f.x < p.x1) { f.y = p.y; f.ground = true; }
    // îles pleines : dessus, côtés (on s'y accroche), dessous
    for (const s of A.solids) {
      if (f.x + HW <= s.x0 || f.x - HW >= s.x1 || f.y <= s.y0 || f.y - HH >= s.y1) continue;
      if (py <= s.y0 + 0.5 && f.vy >= 0) { f.y = s.y0; f.ground = true; }
      else if (py - HH >= s.y1 - 0.5) { f.y = s.y1 + HH; f.vy = Math.max(0, f.vy); }
      else { const left = px < (s.x0 + s.x1) / 2; f.x = left ? s.x0 - HW : s.x1 + HW; f.vx = 0; f.wall = left ? 1 : -1; }
    }
    if (f.wall && f.vy > 2 && !f.ground && f.state === 'air') { f.vy = Math.min(f.vy, 3.5); } // glisse le long du mur
    if (f.ground) {
      if (!wasGround) {
        if (f.state === 'hitstun' && f.vy > 0 && Math.abs(f.vy) + Math.abs(f.vx) > 14) { f.vy = -Math.abs(f.vy) * 0.45; f.ground = false; f.events?.push('bounce'); } // rebond
        else {
          const m = f.state === 'attack' ? c.moves[f.move] : null;
          land(f);
          if (m?.air) { f.state = 'lag'; f.lag = m.land; f.move = m.pound ? 'poundLand' : null; f.events?.push(m.pound ? 'pound' : 'land'); }
          else if (f.state === 'hitstun') { f.state = 'lag'; f.lag = 10; f.hitstun = 0; f.events?.push('land'); }
          else { if (f.state === 'air' || f.state === 'dodge') f.state = f.state === 'dodge' ? 'dodge' : 'idle'; f.events?.push('land'); }
        }
      } else land(f);
    } else if (wasGround) {
      if (support(f, A)) f.ground = true; else f.coyote = 6; // quelques images pour sauter après avoir quitté le bord
    }
    if (!f.ground && (f.state === 'idle' || f.state === 'run')) f.state = 'air';
  }

  // Boîtes de coup actives (en coordonnées du monde) : [x0, y0, x1, y1, données].
  function activeHits(f) {
    if (f.state !== 'attack' && !(f.state === 'lag' && f.move === 'poundLand' && f.lag > C(f).moves.pound.land - 4)) return [];
    const m = C(f).moves[f.state === 'lag' ? 'pound' : f.move], out = [];
    for (const h of m.hits) {
      if (f.state === 'attack' && (f.mt < h.s || f.mt > h.e)) continue;
      const cx = f.x + h.x * f.facing, cy = f.y + h.y;
      out.push([cx - h.w / 2, cy - h.h / 2, cx + h.w / 2, cy + h.h / 2, h]);
    }
    return out;
  }
  // Les coups qui touchent : dégâts, éjection (plus forte avec les dégâts déjà subis), gel des deux combattants.
  function resolve(list, events) {
    for (const a of list) {
      if (a.hitlag > 0) continue;
      for (const [x0, y0, x1, y1, h] of activeHits(a)) {
        for (const b of list) {
          if (b === a || b.state === 'out' || b.dead > 0 || b.invuln > 0 || a.hitIds.includes(b.id) || (a.team && a.team === b.team)) continue;
          if (b.x + HW < x0 || b.x - HW > x1 || b.y < y0 || b.y - HH > y1) continue;
          a.hitIds.push(b.id);
          b.dmg = Math.min(999, b.dmg + h.dmg);
          let dx = h.both ? Math.sign(b.x - a.x || a.facing) * Math.abs(h.dx) : h.dx * a.facing, dy = h.dy;
          if (dy > 0 && b.ground) dy = -dy * 0.7; // un coup vers le bas sur quelqu'un au sol le fait rebondir
          const l = Math.hypot(dx, dy), v = (h.kb + b.dmg * h.ks) * (100 / C(b).weight) * 1.0;
          b.vx = (dx / l) * v; b.vy = (dy / l) * v;
          b.state = 'hitstun'; b.hitstun = Math.round(Math.min(75, 8 + v * 2.3)); b.move = null; b.ground = false; b.lastHit = a.id; b.recovery = true;
          b.y -= 1;
          const lag = Math.round(3 + h.dmg * 0.45);
          a.hitlag = lag; b.hitlag = lag;
          if (b.facing === Math.sign(dx)) b.facing = -b.facing;
          events.push({ t: 'hit', a: a.id, b: b.id, x: Math.round((Math.max(x0, b.x - HW) + Math.min(x1, b.x + HW)) / 2), y: Math.round(b.y - HH / 2), dmg: h.dmg, v: +v.toFixed(1), heavy: !!h.ks && h.ks >= 0.08 });
        }
      }
    }
  }
  function respawn(f, A) {
    if (f.stocks <= 0) { f.state = 'out'; return; }
    Object.assign(f, { x: A.respawn[0], y: A.respawn[1], vx: 0, vy: 0, dmg: 0, state: 'air', move: null, invuln: 120, jumps: 2, recovery: true, airDodge: false, hitstun: 0 });
  }

  /* ---------------- Le monde ---------------- */
  function world(arenaId, entries, stocks = 3) {
    const A = ARENAS[arenaId];
    return { arena: arenaId, frame: 0, fighters: entries.map((e, k) => Object.assign(fighter(e.id, e.char, A.spawns[k % A.spawns.length], A.spawns[k % A.spawns.length][0] > 0 ? -1 : 1), { stocks, team: e.team ?? null })) };
  }
  // Une image pour tout le monde : chacun bouge, les coups touchent, ceux qui sortent de l'arène perdent une vie.
  function stepWorld(w, inputs, events = []) {
    const A = ARENAS[w.arena];
    w.frame++;
    for (const f of w.fighters) { f.events = []; step(f, inputs[f.id] ?? 0, A); for (const e of f.events) events.push({ t: e, id: f.id, x: Math.round(f.x), y: Math.round(f.y) }); delete f.events; }
    resolve(w.fighters, events);
    const B = A.blast;
    for (const f of w.fighters) {
      if (f.state === 'out' || f.dead > 0) continue;
      if (f.x < B.l || f.x > B.r || f.y > B.b || f.y < B.t) {
        f.stocks--; f.falls++; f.dead = 100; f.state = 'dead';
        const killer = w.fighters.find(o => o.id === f.lastHit && o !== f);
        if (killer) killer.kos++;
        events.push({ t: 'ko', id: f.id, by: killer?.id ?? null, x: Math.round(Math.max(B.l, Math.min(B.r, f.x))), y: Math.round(Math.max(B.t, Math.min(B.b, f.y))), left: f.stocks });
      }
    }
    return events;
  }
  const alive = w => w.fighters.filter(f => f.state !== 'out');

  // Combattant envoyé sur le réseau (et rejoué tel quel par le navigateur)
  const KEYS = ['x', 'y', 'vx', 'vy', 'facing', 'state', 'move', 'mt', 'ground', 'jumps', 'wallJumps', 'coyote', 'drop', 'dmg', 'stocks', 'hitstun', 'hitlag', 'invuln', 'dodgeCd', 'airDodge', 'recovery', 'prevIn', 'lag', 'dead', 'wall', 'kos', 'falls'];
  const pack = f => { const o = { id: f.id, char: f.char, team: f.team }; for (const k of KEYS) o[k] = typeof f[k] === 'number' ? Math.round(f[k] * 100) / 100 : f[k]; o.hitIds = f.hitIds; return o; };

  return { FPS, IN, HW, HH, ARENAS, CHARS, CHAR_IDS, MOVE_IDS, STATES, fighter, step, resolve, activeHits, world, stepWorld, alive, pack };
});
