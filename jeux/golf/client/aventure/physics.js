// Mini-golf, mode Aventure : la physique de la balle en 3D (mètres, secondes). Partagée par le navigateur (window.TourPhys)
// et les tests (require). La balle subit la gravité, la traînée de l'air, l'effet Magnus (l'effet courbe la trajectoire),
// rebondit et roule sur des blocs orientés (OBB) dont chaque surface a son rebond, son adhérence et sa résistance.
// Les blocs peuvent bouger (aller-retour, rotation autour d'un pivot, orbite, bascule, plateaux à cliquet, mobiles qui
// penchent sous le poids, dominos en chaîne, trébuchet) : la balle posée dessus est emportée par la vitesse de la surface.
(function (root) {
  const G = 9.81, R = 0.3, DT = 1 / 240;
  const AIR = 0.0035, MAGNUS = 0.0042, SPIN_AIR = 0.3; // traînée, portance de l'effet, perte d'effet en vol (par seconde)
  // e : rebond, grip : adhérence (l'effet mord sur la surface), roll : résistance au roulement (en g)
  const SURF = {
    grass: { e: 0.3, grip: 0.6, roll: 0.22 }, moss: { e: 0.2, grip: 0.7, roll: 0.35 }, rock: { e: 0.5, grip: 0.4, roll: 0.07 },
    wood: { e: 0.4, grip: 0.45, roll: 0.09 }, sand: { e: 0.05, grip: 0.95, roll: 0.9 }, metal: { e: 0.55, grip: 0.3, roll: 0.05 },
    ice: { e: 0.3, grip: 0.03, roll: 0.012 }, carpet: { e: 0.15, grip: 0.8, roll: 0.4 }, marble: { e: 0.45, grip: 0.35, roll: 0.06 },
    net: { e: 0.12, grip: 0.8, roll: 0.6 }, felt: { e: 0.2, grip: 0.7, roll: 0.3 }, gold: { e: 0.3, grip: 0.55, roll: 0.13 },
  };
  // Les clubs : vitesse maximale (m/s), angle de levée par défaut et ses limites, effet rétro, force de l'effet latéral
  const CLUBS = {
    putter: { name: 'Putter', icon: '🏑', v: 9, loft: 2, min: 0, max: 6, back: 0, side: 10, desc: 'Roule au ras du sol, très précis.' },
    fer: { name: 'Fer 7', icon: '🏌️', v: 16, loft: 30, min: 18, max: 40, back: 45, side: 30, desc: 'Le club à tout faire : ni trop haut, ni trop loin.' },
    wedge: { name: 'Wedge', icon: '⛰️', v: 13.5, loft: 56, min: 46, max: 64, back: 15, side: 25, desc: 'Monte très haut et retombe presque sur place.' },
    driver: { name: 'Driver', icon: '🚀', v: 27, loft: 13, min: 8, max: 20, back: 28, side: 35, desc: 'Le plus long et le plus fort.' },
    lob: { name: 'Grand Lob', icon: '🎈', v: 12.5, loft: 74, min: 66, max: 82, back: 20, side: 15, desc: 'Presque à la verticale : cheminées et puits.' },
    faucille: { name: 'Faucille', icon: '🌙', v: 17, loft: 20, min: 10, max: 32, back: 35, side: 140, desc: 'L’effet latéral est énorme : contourne les obstacles.' },
  };
  const ORDER = ['putter', 'fer', 'wedge', 'driver', 'lob', 'faucille'];

  /* ---------- Blocs ---------- */
  // Rotation R = Ry(yaw) · Rx(pitch) · Rz(roll) ; on garde les colonnes (axes locaux dans le monde)
  function axes(yaw = 0, pitch = 0, roll = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
    const m = [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
    return [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]];
  }
  function prepare(b) {
    b.ax = axes(b.yaw, b.pitch, b.roll);
    const e = [0, 1, 2].map(i => Math.abs(b.ax[0][i]) * b.h[0] + Math.abs(b.ax[1][i]) * b.h[1] + Math.abs(b.ax[2][i]) * b.h[2]);
    b.lo = [b.c[0] - e[0], b.c[1] - e[1], b.c[2] - e[2]];
    b.hi = [b.c[0] + e[0], b.c[1] + e[1], b.c[2] + e[2]];
  }
  // un vecteur tourné d'un angle a autour de l'axe x, y ou z du monde
  function rot(v, axis, a) {
    const c = Math.cos(a), s = Math.sin(a), [x, y, z] = v;
    return axis === 'y' ? [x * c + z * s, y, -x * s + z * c] : axis === 'x' ? [x, y * c - z * s, y * s + z * c] : [x * c - y * s, x * s + y * c, z];
  }
  const EULER = { y: 'yaw', x: 'pitch', z: 'roll' };

  /* ---------- Le monde ---------- */
  const CELL = 6;
  function createWorld(level) {
    const w = {
      level, t: 0, blocks: level.blocks.map((b, i) => ({ ...b, i, c: [...b.c], c0: [...b.c], o0: [b.yaw, b.pitch, b.roll] })),
      broken: new Set(), triggered: new Set(), clubs: new Set(level.startClubs), shards: new Set(), grid: new Map(), kin: [],
      toppled: new Map(), levers: {}, keys: {}, melody: [], treb: { a: 0, mode: 'idle', hold: 0, lvl: 1, sit: 0 }, tags: {},
    };
    for (const b of w.blocks) { prepare(b); if (b.tag) w.tags[b.tag] = b; if (b.kin || b.topple) w.kin.push(b); else addToGrid(w, b); }
    return w;
  }
  const key = (x, y, z) => `${x},${y},${z}`;
  function addToGrid(w, b) {
    for (let x = Math.floor(b.lo[0] / CELL); x <= Math.floor(b.hi[0] / CELL); x++)
      for (let y = Math.floor(b.lo[1] / CELL); y <= Math.floor(b.hi[1] / CELL); y++)
        for (let z = Math.floor(b.lo[2] / CELL); z <= Math.floor(b.hi[2] / CELL); z++) {
          const k = key(x, y, z); if (!w.grid.has(k)) w.grid.set(k, []); w.grid.get(k).push(b);
        }
  }
  const smooth = k => k * k * (3 - 2 * k);
  // La pose d'un bloc qui bouge à l'instant w.t (et selon l'état du monde)
  function pose(w, b, ball) {
    const k = b.kin, t = w.t;
    const around = (pivot, axis, a, turn) => {
      const d = rot([b.c0[0] - pivot[0], b.c0[1] - pivot[1], b.c0[2] - pivot[2]], axis, a);
      b.c = [pivot[0] + d[0], pivot[1] + d[1], pivot[2] + d[2]];
      [b.yaw, b.pitch, b.roll] = b.o0;
      if (turn) b[EULER[axis]] += a;
    };
    if (b.topple) {
      const tp = b.topple, k0 = w.toppled.get(b);
      if (k0 === undefined) return;
      const kk = Math.min(1, k0 + DT / (tp.time || 1.2));
      w.toppled.set(b, kk);
      // dominos : le suivant part quand celui-ci est à mi-chemin
      if (tp.next && kk > 0.55 && !w.toppled.has(w.tags[tp.next])) w.toppled.set(w.tags[tp.next], 0);
      around(tp.pivot, tp.axis, tp.angle * smooth(kk), true);
      return;
    }
    if (!k) return;
    const ph = (a, p) => (2 * Math.PI * t) / p + (a || 0);
    switch (k.type) {
      case 'move': { const s = Math.sin(ph(k.phase, k.period)); b.c = b.c0.map((c, i) => c + k.axis[i] * k.amp * s); break; }
      case 'tilt': b[k.axis] = b.o0[k.axis === 'pitch' ? 1 : 2] + k.angle * Math.sin(ph(k.phase, k.period)); break;
      case 'spin': around(k.pivot, k.axis, k.speed * t + (k.phase || 0), true); break; // tourne autour d'un pivot (aiguilles, disques)
      case 'orbit': { // reste à plat en tournant (godets) ; avec anchor, toutes les pièces suivent ce point ensemble
        if (!k.anchor) { around(k.pivot, k.axis, k.speed * t + (k.phase || 0), false); break; }
        const d = rot(k.anchor.map((v, i) => v - k.pivot[i]), k.axis, k.speed * t + (k.phase || 0));
        b.c = b.c0.map((v, i) => v + k.pivot[i] + d[i] - k.anchor[i]); [b.yaw, b.pitch, b.roll] = b.o0;
        break;
      }
      case 'lever': { const h = w.levers[k.id] || 0; b.c = [b.c0[0], b.c0[1] + (k.role === 'A' ? -1 : 1) * k.amp * smooth(h), b.c0[2]]; break; }
      case 'mobile': { // penche du côté où la balle est posée, revient doucement sinon
        const on = ball && onBase(w, ball, b), lim = k.max || 0.22;
        const tr = on ? Math.max(-lim, Math.min(lim, -(ball.p[0] - b.c0[0]) * 0.07)) : 0, tp2 = on ? Math.max(-lim, Math.min(lim, (ball.p[2] - b.c0[2]) * 0.07)) : 0;
        const sp = 0.2 * DT;
        b.roll += Math.max(-sp, Math.min(sp, tr - b.roll)); b.pitch += Math.max(-sp, Math.min(sp, tp2 - b.pitch));
        break;
      }
      case 'treb': around(k.pivot, k.axis, -w.treb.a, true); break;
    }
  }
  // ce qui porte la balle, avec une petite mémoire (un plateau qui descend sous elle la quitte un instant)
  const onBase = (w, ball, b) => ball.lastBase && w.t - ball.lastBaseT < 0.15 && (!b || ball.lastBase === b);
  function moveBlocks(w, ball) {
    // leviers à cliquet : la balle sur un plateau A fait monter le plateau B (et il reste en haut)
    const lb = onBase(w, ball) ? ball.lastBase : null;
    if (lb?.kin?.type === 'lever' && lb.kin.role === 'A') { const id = lb.kin.id; w.levers[id] = Math.min(1, (w.levers[id] || 0) + DT / 2.5); }
    // trébuchet : la balle posée dans la poche déclenche le bras ; puissance réglée en frappant le contrepoids
    const tb = w.treb;
    if (tb.mode === 'idle') { tb.sit = lb?.trebPocket && Math.hypot(...ball.v) < 1.5 ? tb.sit + DT : 0; if (tb.sit > 0.8) { tb.mode = 'swing'; tb.w = 0; } }
    else if (tb.mode === 'swing') { const T = w.level.treb || {}; tb.w = Math.min((T.base ?? 2.6) + tb.lvl * (T.step ?? 0.9), tb.w + DT * (T.acc ?? 14)); tb.a += tb.w * DT; const stop = w.level.treb?.stop ?? 2.1; if (tb.a >= stop) { tb.a = stop; tb.mode = 'hold'; tb.hold = 0; } }
    else if (tb.mode === 'hold') { tb.hold += DT; if (tb.hold > 2) tb.mode = 'back'; }
    else if (tb.mode === 'back') { tb.a = Math.max(0, tb.a - DT * 0.7); if (!tb.a) tb.mode = 'idle'; }
    for (const b of w.kin) {
      b.pc = [...b.c]; b.pax = b.ax;
      pose(w, b, ball);
      prepare(b);
    }
  }
  function nearBlocks(w, p) {
    const list = w.grid.get(key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL))) || [];
    return w.kin.length ? list.concat(w.kin) : list; // ce qui bouge n'est pas dans la grille
  }
  const inBox = (z, p) => p[0] >= z.lo[0] && p[0] <= z.hi[0] && p[1] >= z.lo[1] && p[1] <= z.hi[1] && p[2] >= z.lo[2] && p[2] <= z.hi[2];
  const solid = (w, b) => !(b.off || w.broken.has(b.i) || (b.hidden && !w.triggered.has(b.hidden)));
  // zones de vent : toujours, par intermittence, ou quand la touche d'orgue liée vient d'être pressée
  function windOn(w, z) {
    if (z.key !== undefined) return w.keys[z.key] !== undefined && w.t - w.keys[z.key] < (z.on || 4);
    return !z.period || ((w.t + (z.phase || 0)) % z.period) < z.on;
  }

  /* ---------- La balle ---------- */
  function newBall(p) { return { p: [...p], v: [0, 0, 0], w: [0, 0, 0], rest: 0, ground: null, surf: null, base: null, baseVel: [0, 0, 0] }; }
  // Frapper : direction (yaw, dans le plan horizontal), puissance 0..1, levée en degrés, point d'impact (ix, iy) dans le disque
  function launch(ball, clubId, yaw, power, loftDeg, ix = 0, iy = 0) {
    const c = CLUBS[clubId], sp = c.v * Math.max(0.02, Math.min(1, power));
    const loft = ((loftDeg + -iy * 6) * Math.PI) / 180, d = [Math.cos(yaw), 0, Math.sin(yaw)], bv = ball.baseVel || [0, 0, 0];
    ball.v = [d[0] * Math.cos(loft) * sp + bv[0], Math.sin(loft) * sp + bv[1], d[2] * Math.cos(loft) * sp + bv[2]];
    const back = (c.back * (0.5 + 0.5 * power) + -iy * 100) * (clubId === 'putter' ? 0.2 : 1), side = -ix * c.side * (0.4 + 0.6 * power);
    ball.w = [-d[2] * back, side, d[0] * back];
    ball.rest = 0; ball.ground = null; ball.base = null;
  }

  // Un pas de calcul. Renvoie la liste des évènements.
  function step(w, ball) {
    const ev = [], p = ball.p, v = ball.v, om = ball.w;
    w.t += DT;
    if (ball.burnt) ball.burnt = Math.max(0, ball.burnt - DT);
    moveBlocks(w, ball);
    let ax = 0, ay = -G, az = 0;
    const sp = Math.hypot(v[0], v[1], v[2]);
    let drag = AIR * sp;
    for (const z of w.level.zones) {
      if (!inBox(z, p)) continue;
      if (z.t === 'water') { drag += 2.6; ay += G * 0.55; if (z.f) { ax += z.f[0]; ay += z.f[1]; az += z.f[2]; } }
      if (z.t === 'wind' && windOn(w, z)) { ax += z.f[0]; ay += z.f[1]; az += z.f[2]; }
    }
    ax -= drag * v[0]; ay -= drag * v[1]; az -= drag * v[2];
    if (!ball.ground) {
      ax += MAGNUS * (om[1] * v[2] - om[2] * v[1]); ay += MAGNUS * (om[2] * v[0] - om[0] * v[2]); az += MAGNUS * (om[0] * v[1] - om[1] * v[0]);
      const k = 1 - SPIN_AIR * DT; om[0] *= k; om[1] *= k; om[2] *= k;
    }
    v[0] += ax * DT; v[1] += ay * DT; v[2] += az * DT;
    p[0] += v[0] * DT; p[1] += v[1] * DT; p[2] += v[2] * DT;
    ball.ground = null;
    let still = true, baseVel = [0, 0, 0], base = null;
    for (const b of nearBlocks(w, p)) {
      if (!solid(w, b)) continue;
      if (p[0] < b.lo[0] - R || p[0] > b.hi[0] + R || p[1] < b.lo[1] - R || p[1] > b.hi[1] + R || p[2] < b.lo[2] - R || p[2] > b.hi[2] + R) continue;
      const d = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]], A = b.ax;
      const l = [0, 1, 2].map(i => d[0] * A[i][0] + d[1] * A[i][1] + d[2] * A[i][2]);
      const q = l.map((x, i) => Math.max(-b.h[i], Math.min(b.h[i], x)));
      const cp = [0, 1, 2].map(j => b.c[j] + A[0][j] * q[0] + A[1][j] * q[1] + A[2][j] * q[2]);
      let n = [p[0] - cp[0], p[1] - cp[1], p[2] - cp[2]], dist = Math.hypot(n[0], n[1], n[2]), pen;
      // dalles et touches réagissent dès qu'on les frôle (elles sont au ras du sol)
      if (dist < R + 0.08 && dist > 1e-9 && n[1] / dist > 0.5) {
        if (b.trigger && !w.triggered.has(b.trigger)) { w.triggered.add(b.trigger); ev.push({ t: 'trigger', id: b.trigger, p: [...p] }); }
        if (b.key !== undefined && !(w.t - (w.keys[b.key] ?? -9) < 0.6)) {
          w.keys[b.key] = w.t; w.melody.push(b.key); if (w.melody.length > 8) w.melody.shift();
          ev.push({ t: 'key', key: b.key, p: [...p] });
          const m = w.level.melody;
          if (m && !w.triggered.has('melodie') && w.melody.slice(-m.length).join() === m.join()) { w.triggered.add('melodie'); ev.push({ t: 'trigger', id: 'melodie', p: [...p] }); }
        }
      }
      if (dist > 1e-9) { if (dist >= R) continue; n = n.map(x => x / dist); pen = R - dist; }
      else {
        let best = 0, bd = Infinity;
        for (let i = 0; i < 3; i++) { const dd = b.h[i] - Math.abs(l[i]); if (dd < bd) { bd = dd; best = i; } }
        const s = l[best] >= 0 ? 1 : -1; n = A[best].map(x => x * s); pen = R + bd;
      }
      // vitesse de la surface au point de contact (blocs qui bougent) : ce point, à l'instant précédent
      let vb = [0, 0, 0];
      if (b.pax) { const pr = [0, 1, 2].map(j => b.pc[j] + b.pax[0][j] * q[0] + b.pax[1][j] * q[1] + b.pax[2][j] * q[2]); vb = cp.map((c, j) => (c - pr[j]) / DT); }
      const vr = [v[0] - vb[0], v[1] - vb[1], v[2] - vb[2]], vn = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2];
      p[0] += n[0] * pen; p[1] += n[1] * pen; p[2] += n[2] * pen;
      if (b.breakAt && -vn > b.breakAt) { w.broken.add(b.i); ev.push({ t: 'break', b: b.i, p: [...p] }); v[0] *= 0.7; v[1] *= 0.7; v[2] *= 0.7; continue; }
      if (b.topple && !w.toppled.has(b) && -vn > b.topple.at) { w.toppled.set(b, 0); ev.push({ t: 'topple', b: b.i, p: [...p] }); }
      if (b.trebWeight && -vn > 3 && w.treb.mode === 'idle' && w.treb.lvl < 3) { w.treb.lvl += 1; ev.push({ t: 'weight', lvl: w.treb.lvl, p: [...p] }); }
      if (b.lava && !ball.burnt) { ball.burnt = 0.6; v[0] = -v[0] * 0.45; v[2] = -v[2] * 0.45; v[1] = 8.5; ev.push({ t: 'lava', p: [...p] }); continue; }
      const s = SURF[b.s] || SURF.rock;
      if (n[1] > 0.45) { ball.ground = n; ball.surf = b.s; base = b; baseVel = vb; }
      if (vn >= 0) continue;
      const impact = -vn, bounce = impact > 1.1;
      if (bounce && impact > 2) ev.push({ t: 'hit', s: b.s, f: Math.min(1, impact / 14), p: [...p] });
      const e = bounce ? s.e : 0;
      for (let i = 0; i < 3; i++) vr[i] -= n[i] * vn * (1 + e);
      const r = [-n[0] * R, -n[1] * R, -n[2] * R];
      const vrn = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2];
      const u = [0, 1, 2].map(i => vr[i] - n[i] * vrn);
      u[0] += om[1] * r[2] - om[2] * r[1]; u[1] += om[2] * r[0] - om[0] * r[2]; u[2] += om[0] * r[1] - om[1] * r[0];
      const k = bounce ? s.grip : Math.min(1, s.grip * 30 * DT + 0.02);
      for (let i = 0; i < 3; i++) vr[i] -= (2 / 7) * k * u[i];
      const cx = n[1] * u[2] - n[2] * u[1], cy = n[2] * u[0] - n[0] * u[2], cz = n[0] * u[1] - n[1] * u[0], f = ((5 / 7) * k) / R;
      om[0] += f * cx; om[1] += f * cy; om[2] += f * cz;
      if (!bounce) {
        const vrn2 = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2], tt = [0, 1, 2].map(i => vr[i] - n[i] * vrn2), ts = Math.hypot(tt[0], tt[1], tt[2]), dec = s.roll * G * DT * Math.max(0.3, n[1]);
        if (ts <= dec) { for (let i = 0; i < 3; i++) vr[i] -= tt[i]; om[0] *= 0.9; om[1] *= 0.9; om[2] *= 0.9; }
        else for (let i = 0; i < 3; i++) vr[i] -= (tt[i] / ts) * dec;
      } else still = false;
      v[0] = vr[0] + vb[0]; v[1] = vr[1] + vb[1]; v[2] = vr[2] + vb[2];
    }
    ball.base = base; ball.baseVel = baseVel;
    if (base) { ball.lastBase = base; ball.lastBaseT = w.t; }
    const rel = Math.hypot(v[0] - baseVel[0], v[1] - baseVel[1], v[2] - baseVel[2]);
    ball.rest = ball.ground && still && rel < 0.15 ? ball.rest + DT : 0;
    for (const s of w.level.shards || []) if (!w.shards.has(s.id) && Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]) < 1.4) { w.shards.add(s.id); ev.push({ t: 'shard', id: s.id, p: [...p] }); }
    for (const c of w.level.pickups) if (!w.clubs.has(c.club) && Math.hypot(p[0] - c.p[0], p[1] - c.p[1], p[2] - c.p[2]) < 1.6) { w.clubs.add(c.club); ev.push({ t: 'club', club: c.club, p: [...p] }); }
    const cup = cupAt(w);
    if (Math.hypot(p[0] - cup[0], p[2] - cup[2]) < 0.5 && p[1] < cup[1] + R + 0.25 && p[1] > cup[1] - 1 && rel < 7) ev.push({ t: 'holed' });
    if (p[1] < w.level.fatal) ev.push({ t: 'lost' });
    return ev;
  }
  // Le trou : fixe, ou posé sur un bloc qui bouge (le disque du sommet)
  function cupAt(w) {
    const c = w.level.cup;
    if (!c.tag) return c;
    const b = w.tags[c.tag], A = b.ax, o = [c.off[0], b.h[1], c.off[1]];
    return [0, 1, 2].map(j => b.c[j] + A[0][j] * o[0] + A[1][j] * o[1] + A[2][j] * o[2]);
  }
  const ready = ball => ball.rest > 0.45;

  // Simuler jusqu'au repos (ou trou, ou chute fatale) ; path : positions tous les k pas.
  function simulate(w, ball, { maxT = 30, every = 8, until, wait = 0 } = {}) {
    const path = [], events = [];
    for (let i = 0; i < maxT / DT; i++) {
      const ev = step(w, ball);
      if (i % every === 0) path.push([...ball.p]);
      for (const e of ev) events.push(e);
      const end = ev.find(e => e.t === 'holed' || e.t === 'lost');
      if (end) return { path, events, end: end.t };
      if (until && until(ball, ev)) return { path, events, end: 'until' };
      if (i > 30 && i * DT > wait && ready(ball)) return { path, events, end: 'rest' };
    }
    return { path, events, end: 'time' };
  }
  // Copie du monde (aperçu de trajectoire, tests) : les blocs qui bougent sont dupliqués, les blocs fixes partagés
  function clone(w) {
    const blocks = w.blocks.map(b => (b.kin || b.topple ? { ...b, c: [...b.c] } : b));
    const c = { ...w, blocks, broken: new Set(w.broken), triggered: new Set(w.triggered), clubs: new Set(w.clubs), shards: new Set(w.shards), levers: { ...w.levers }, keys: { ...w.keys }, melody: [...w.melody], treb: { ...w.treb }, toppled: new Map(), tags: {} };
    c.kin = blocks.filter(b => b.kin || b.topple);
    for (const b of blocks) if (b.tag) c.tags[b.tag] = b;
    for (const [b, k] of w.toppled) c.toppled.set(blocks[b.i], k);
    return c;
  }
  // Le premier sol sous un point (rayon vertical), ou null s'il n'y a que le vide (repère de chute)
  function groundBelow(w, p) {
    let best = null;
    const test = b => {
      if (!solid(w, b) || p[0] < b.lo[0] || p[0] > b.hi[0] || p[2] < b.lo[2] || p[2] > b.hi[2] || b.lo[1] > p[1]) return;
      const A = b.ax, o = [0, 1, 2].map(i => (p[0] - b.c[0]) * A[i][0] + (p[1] - b.c[1]) * A[i][1] + (p[2] - b.c[2]) * A[i][2]), d = [0, 1, 2].map(i => -A[i][1]);
      let t0 = 0, t1 = Infinity;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > b.h[i]) return; continue; }
        let a = (-b.h[i] - o[i]) / d[i], c = (b.h[i] - o[i]) / d[i];
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) return;
      }
      if (best === null || p[1] - t0 > best) best = p[1] - t0;
    };
    for (let y = Math.floor(p[1] / CELL); y >= Math.floor(w.level.fatal / CELL); y--) {
      for (const b of w.grid.get(key(Math.floor(p[0] / CELL), y, Math.floor(p[2] / CELL))) || []) test(b);
      if (best !== null) break;
    }
    for (const b of w.kin) test(b);
    return best;
  }

  const api = { G, R, DT, SURF, CLUBS, ORDER, createWorld, newBall, launch, step, ready, simulate, clone, axes, groundBelow, cupAt, solid, windOn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TourPhys = api;
})(this);
