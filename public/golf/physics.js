// Mini-golf : physique des balles, partagée par le serveur (qui calcule chaque tir et fait foi) et le navigateur
// (aperçu de visée, dessin des obstacles mobiles). Script classique : window.Golf ou require().
// Un tir fait rouler la balle du tireur ; elle peut pousser les autres balles, sauter sur les rampes, être déviée
// par l'effet, le vent, les aimants, les tapis roulants, les ventilateurs, et ouvrir des portes avec les plaques.
(function (root) {
  const W = 1000, H = 600; // taille d'un trou (unités du parcours)
  const R0 = 7, WALL = 5, CUP = 11; // rayon de la balle, demi-épaisseur des murs, rayon du trou
  const DT = 1 / 240, SAMPLE = 8, FPS = 240 / SAMPLE; // pas de calcul, et 30 positions par seconde envoyées
  const MAX_SPEED = 820, MAX_T = 25, GRAV = 1400;
  const TAU = Math.PI * 2;
  const SURF = { grass: { dec: 60, k: 0.55 }, sand: { dec: 320, k: 2.6 }, snow: { dec: 210, k: 1.9 }, ice: { dec: 10, k: 0.08 }, chaosIce: { dec: 16, k: 0.14 } };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // t : secondes depuis le début du trou (le même pour tout le monde) ; un obstacle périodique est actif sur [phase, phase + on[ modulo period.
  const active = (o, t) => !o.period || ((t + (o.phase || 0)) % o.period + o.period) % o.period < o.on;
  const inZone = (z, x, y) => (z.r ? x >= z.r[0] && x <= z.r[0] + z.r[2] && y >= z.r[1] && y <= z.r[1] + z.r[3] : (x - z.c[0]) ** 2 + (y - z.c[1]) ** 2 <= z.c[2] ** 2);
  const wallPts = w => (Array.isArray(w) ? w : w.pts);

  // Trou mobile (manège) : position du trou à l'instant t
  function cupAt(hole, t) {
    const m = hole.cupMove;
    if (!m) return hole.cup;
    const o = Math.sin((TAU * t) / m.period) * m.amp;
    return [hole.cup[0] + m.dx * o, hole.cup[1] + m.dy * o];
  }
  // Animaux et fantômes : ils parcourent une boucle à vitesse constante (position et vitesse à l'instant t)
  function critterAt(c, t) {
    const p = c.path;
    let L = 0;
    for (let k = 0; k + 3 < p.length; k += 2) L += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
    let d = (((c.speed * t + (c.offset || 0)) % L) + L) % L;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const sl = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
      if (d <= sl) {
        const ux = (p[k + 2] - p[k]) / sl, uy = (p[k + 3] - p[k + 1]) / sl;
        return { x: p[k] + ux * d, y: p[k + 1] + uy * d, vx: ux * c.speed, vy: uy * c.speed };
      }
      d -= sl;
    }
    return { x: p[0], y: p[1], vx: 0, vy: 0 };
  }
  // Segments mobiles à l'instant t : ailes des moulins, portes qui coulissent, portes fermées (plaques).
  function movers(hole, t, open = []) {
    const out = [];
    for (const m of hole.windmills || []) for (let k = 0; k < m.blades; k++) {
      const a = m.speed * t + (k * TAU) / m.blades;
      out.push({ kind: 'blade', ax: m.x, ay: m.y, bx: m.x + Math.cos(a) * m.len, by: m.y + Math.sin(a) * m.len, cx: m.x, cy: m.y, w: m.speed });
    }
    for (const g of hole.gates || []) {
      const ph = (TAU * t) / g.period, o = Math.sin(ph) * g.amp, v = Math.cos(ph) * g.amp * (TAU / g.period);
      out.push({ kind: 'gate', ax: g.x1 + g.dx * o, ay: g.y1 + g.dy * o, bx: g.x2 + g.dx * o, by: g.y2 + g.dy * o, vx: g.dx * v, vy: g.dy * v });
    }
    for (const d of hole.doors || []) if (!open.includes(d.id)) out.push({ kind: 'door', id: d.id, ax: d.seg[0], ay: d.seg[1], bx: d.seg[2], by: d.seg[3], vx: 0, vy: 0 });
    return out;
  }

  /* ---------- Chocs ---------- */
  function hitPoint(b, px, py, rad, e, vsx = 0, vsy = 0, maxSp = MAX_SPEED) {
    let nx = b.x - px, ny = b.y - py;
    const d = Math.hypot(nx, ny);
    if (d >= rad || d === 0) return 0;
    nx /= d; ny /= d;
    b.x = px + nx * rad; b.y = py + ny * rad;
    let rx = b.vx - vsx, ry = b.vy - vsy;
    const vn = rx * nx + ry * ny;
    if (vn >= 0) return 0.001;
    rx -= (1 + e) * vn * nx; ry -= (1 + e) * vn * ny;
    b.vx = rx + vsx; b.vy = ry + vsy;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > maxSp) { b.vx *= maxSp / sp; b.vy *= maxSp / sp; }
    return -vn;
  }
  // Choc avec un segment ; m : obstacle mobile (aile qui tourne autour de cx, cy à w rad/s, ou porte qui glisse à vx, vy)
  function hitSeg(b, ax, ay, bx, by, rad, e, m, maxSp) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const u = clamp(((b.x - ax) * dx + (b.y - ay) * dy) / L2);
    const px = ax + dx * u, py = ay + dy * u;
    const vsx = m ? (m.w ? -m.w * (py - m.cy) : m.vx) : 0, vsy = m ? (m.w ? m.w * (px - m.cx) : m.vy) : 0;
    return hitPoint(b, px, py, rad, e, vsx, vsy, maxSp);
  }

  /* ---------- Un tir ---------- */
  // s = { balls: { nom: { x, y } }, shooter, angle (rad), power (0-1), spin (-1 à 1), t0 (s depuis le début du trou),
  //       open: portes déjà ouvertes, opts: modificateurs (chaos, balles fantômes), preview: arrêt au premier rebond }
  // Renvoie les trajectoires des balles qui ont bougé ({ s: image de départ, p: positions }), les événements, les résultats.
  function simulate(hole, s) {
    const o = s.opts || {}, R = o.R || R0, eWall = o.bouncy ? 1.02 : 0.72, maxSp = MAX_SPEED * (o.turbo ? 1.35 : 1);
    const r1 = v => Math.round(v * 10) / 10;
    const open = [...(s.open || [])];
    const segs = [];
    for (const w of hole.walls) { const p = wallPts(w); for (let k = 0; k + 3 < p.length; k += 2) segs.push([p[k], p[k + 1], p[k + 2], p[k + 3], !!w.low]); }
    const wind = [(hole.wind?.[0] || 0) + (o.wind?.[0] || 0), (hole.wind?.[1] || 0) + (o.wind?.[1] || 0)];
    const balls = Object.entries(s.balls).map(([name, p]) => ({ name, x: p.x, y: p.y, vx: 0, vy: 0, z: 0, vz: 0, moving: false, result: null, cool: 0, path: null, age: 0, spin: 0, minCup: 1e9 }));
    const me = balls.find(b => b.name === s.shooter);
    const speed = (40 + clamp(s.power) * (MAX_SPEED - 40)) * (o.turbo ? 1.35 : 1);
    me.vx = Math.cos(s.angle) * speed; me.vy = Math.sin(s.angle) * speed;
    me.spin = clamp(s.spin || 0, -1, 1);
    let k = 0; // nombre d'images enregistrées
    const pt = b => (b.z > 0.5 ? [r1(b.x), r1(b.y), r1(b.z)] : [r1(b.x), r1(b.y)]);
    const startMoving = b => { if (!b.path) b.path = { s: k, p: [pt(b)] }; b.moving = true; };
    startMoving(me);
    const events = [];
    const ev = (b, type, x = b.x, y = b.y) => events.push({ i: k, n: b.name, type, x: r1(x), y: r1(y) });
    let bounces = 0, lastBump = -99;
    const steps = (s.preview ? 4 : MAX_T) / DT;
    for (let i = 1; i <= steps; i++) {
      const t = s.t0 + i * DT;
      const mv = movers(hole, t, open), cup = cupAt(hole, t);
      let anyMoving = false;
      for (const b of balls) {
        if (!b.moving || b.result) continue;
        anyMoving = true;
        b.age += DT; b.cool -= DT;
        const ground = b.z <= 0;
        let surf = o.ice ? SURF.chaosIce : SURF.grass, ax = 0, ay = 0, pushed = false;
        if (ground) for (const z of hole.zones || []) {
          if (!inZone(z, b.x, b.y)) continue;
          if (SURF[z.t]) surf = SURF[z.t];
          else if ((z.t === 'slope' || z.t === 'fan' || z.t === 'belt') && active(z, t)) { ax += z.dir[0] * z.f; ay += z.dir[1] * z.f; pushed = true; }
        }
        let sp = Math.hypot(b.vx, b.vy);
        if (sp > 1) { ax += wind[0]; ay += wind[1]; }
        for (const m of hole.magnets || []) {
          const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy);
          if (d < m.r && d > 1) { const f = m.f * (1 - d / m.r); ax += (dx / d) * f; ay += (dy / d) * f; pushed = true; }
        }
        // Le trou (et le trou bonus) attire un peu la balle qui passe dessus : trop vite, elle saute par-dessus.
        const pull = o.magnetCup ? 2.4 : 1;
        for (const c of hole.bonus ? [cup, hole.bonus] : [cup]) {
          const cx = c[0] - b.x, cy = c[1] - b.y, cd = Math.hypot(cx, cy);
          if (c === cup) b.minCup = Math.min(b.minCup, cd);
          if (ground && cd < CUP * pull && cd > 0.01) { ax += (cx / cd) * 1500; ay += (cy / cd) * 1500; }
        }
        // Effet : la balle tourne d'un côté, de moins en moins
        if (b.spin && sp > 20) { const f = b.spin * 330 * Math.exp(-b.age / 1.1); ax += (-b.vy / sp) * f; ay += (b.vx / sp) * f; }
        b.vx += ax * DT; b.vy += ay * DT;
        sp = Math.hypot(b.vx, b.vy);
        if (ground) {
          const loss = (surf.dec + surf.k * sp) * DT;
          if (sp > loss) { b.vx *= (sp - loss) / sp; b.vy *= (sp - loss) / sp; } else b.vx = b.vy = 0;
        }
        b.x += b.vx * DT; b.y += b.vy * DT;
        // En l'air (rampe) : elle retombe ; à l'atterrissage elle perd un peu de vitesse
        if (!ground || b.vz > 0) {
          b.z += b.vz * DT; b.vz -= GRAV * DT;
          if (b.z <= 0) { b.z = 0; b.vz = 0; b.vx *= 0.82; b.vy *= 0.82; ev(b, 'land'); }
        }
        if (b.z <= 0) for (const z of hole.zones || []) {
          if (z.t !== 'ramp' || !inZone(z, b.x, b.y)) continue;
          const along = b.vx * z.dir[0] + b.vy * z.dir[1];
          if (along > 220) { b.vz = Math.min(430, along * 0.6) * (o.moon ? 1.4 : 1); b.z = 0.01; ev(b, 'jump'); }
        }
        const air = b.z > 4;

        let hit = 0;
        for (const g of segs) if (!(g[4] && air)) hit = Math.max(hit, hitSeg(b, g[0], g[1], g[2], g[3], R + WALL, eWall, null, maxSp));
        if (b.z < 14) {
          for (const m of mv) { const h = hitSeg(b, m.ax, m.ay, m.bx, m.by, R + WALL, 0.8, m, maxSp); hit = Math.max(hit, h * (m.kind === 'blade' ? 1.5 : 1)); }
          for (const p of hole.bumpers || []) {
            const h = hitPoint(b, p.x, p.y, p.r + R, p.jelly ? 1.25 : p.kick ? 1.1 : 0.78, 0, 0, maxSp);
            if (h > 0.01 && p.kick) { const v = Math.hypot(b.vx, b.vy); if (v < 560) { b.vx *= 560 / (v || 1); b.vy *= 560 / (v || 1); } ev(b, 'kick'); }
            hit = Math.max(hit, h);
          }
          for (const c of hole.critters || []) { const q = critterAt(c, t); hit = Math.max(hit, hitPoint(b, q.x, q.y, c.r + R, 0.9, q.vx, q.vy, maxSp)); }
        }
        if (hit > 70 && i - lastBump > 24) { ev(b, hit > 400 ? 'bump2' : 'bump'); lastBump = i; bounces++; }
        if (s.preview && hit > 20 && b === me) { b.moving = false; continue; } // aperçu de visée : jusqu'au premier rebond

        if (!air && b.cool <= 0) {
          for (const tp of hole.teleports || []) if (Math.hypot(b.x - tp.from[0], b.y - tp.from[1]) < tp.r) { ev(b, 'tp'); b.x = tp.to[0]; b.y = tp.to[1]; b.cool = 0.6; ev(b, 'tpout'); }
          for (const pp of hole.pipes || []) if (Math.hypot(b.x - pp.from[0], b.y - pp.from[1]) < pp.r) {
            ev(b, 'pipe'); const v = Math.max(260, Math.hypot(b.vx, b.vy) * 0.9);
            b.x = pp.to[0]; b.y = pp.to[1]; b.vx = pp.dir[0] * v; b.vy = pp.dir[1] * v; b.cool = 0.6; ev(b, 'pipeout');
          }
          for (const sg of hole.springs || []) if (Math.hypot(b.x - sg.x, b.y - sg.y) < sg.r + R) { b.vx = sg.dir[0] * sg.v; b.vy = sg.dir[1] * sg.v; b.cool = 0.6; ev(b, 'spring'); }
        }
        if (!air) for (const pl of hole.plates || []) if (!open.includes(pl.door) && Math.hypot(b.x - pl.x, b.y - pl.y) < pl.r) { open.push(pl.door); ev(b, 'plate'); }

        // Eau (sauf sur un pont présent), sortie du parcours, trou
        let bridge = null;
        if (!air) {
          const wet = (hole.zones || []).some(z => z.t === 'water' && inZone(z, b.x, b.y));
          bridge = wet && (hole.bridges || []).find(br => active(br, t) && inZone(br, b.x, b.y));
          if (wet && !bridge) { b.result = 'water'; ev(b, 'water'); continue; }
        }
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) { b.result = 'water'; ev(b, 'water'); continue; }
        sp = Math.hypot(b.vx, b.vy);
        if (!air) {
          for (const c of hole.bonus ? [cup, hole.bonus] : [cup]) {
            if (Math.hypot(c[0] - b.x, c[1] - b.y) < CUP * (o.magnetCup ? 1.5 : 1) - 2 && sp < 330 * (o.magnetCup ? 1.4 : 1)) {
              b.result = 'holed'; b.bonus = c !== cup; b.x = c[0]; b.y = c[1]; ev(b, b.bonus ? 'bonus' : 'holed'); break;
            }
          }
          if (b.result) continue;
        }
        if (sp < 3 && !pushed && b.z <= 0 && !bridge?.period) b.moving = false; // arrêtée sur un pont qui clignote : elle tombera quand il disparaîtra
      }
      // Les balles se cognent (sauf en mode fantôme)
      if (o.collide !== false) for (let a = 0; a < balls.length; a++) for (let c = a + 1; c < balls.length; c++) {
        const A = balls[a], B = balls[c];
        if (A.result || B.result || (!A.moving && !B.moving) || A.z > 4 || B.z > 4) continue;
        let nx = B.x - A.x, ny = B.y - A.y;
        const d = Math.hypot(nx, ny);
        if (d >= 2 * R || d === 0) continue;
        nx /= d; ny /= d;
        const push = (2 * R - d) / 2;
        A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
        const vn = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (vn <= 0) continue;
        const j = vn * 0.96; // choc presque élastique, balles de même masse
        A.vx -= j * nx; A.vy -= j * ny; B.vx += j * nx; B.vy += j * ny;
        for (const X of [A, B]) if (!X.moving) startMoving(X);
        ev(A, 'clack', (A.x + B.x) / 2, (A.y + B.y) / 2);
      }
      if (i % SAMPLE === 0) { k++; for (const b of balls) if (b.path && !b.result) b.path.p.push(pt(b)); }
      if (!anyMoving) break;
    }
    k++;
    const paths = {}, results = {};
    for (const b of balls) {
      if (!b.path) continue;
      if (!b.result) { b.path.p.push(pt(b)); b.result = 'stop'; } else b.path.p.push([r1(b.x), r1(b.y)]);
      paths[b.name] = b.path;
      results[b.name] = { result: b.result, x: r1(b.x), y: r1(b.y), bonus: !!b.bonus };
    }
    if (me.result !== 'holed' && me.minCup < CUP + 14) ev(me, 'ooh');
    return { paths, events, results, open, frames: k, bounces };
  }
  // Raccourci pour une balle seule (tests, robots, aperçu de visée)
  function shot1(hole, x, y, angle, power, t0, extra = {}) {
    const r = simulate(hole, { balls: { me: { x, y } }, shooter: 'me', angle, power, t0, ...extra });
    return { ...r.results.me, path: r.paths.me.p, events: r.events, open: r.open, bounces: r.bounces };
  }

  const NAMES = { '-4': 'Condor', '-3': 'Albatros', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double Bogey', 3: 'Triple Bogey' };
  const label = (strokes, par) => (strokes === 1 ? 'Trou en un !' : strokes - par > 3 ? `+${strokes - par}` : NAMES[Math.max(-4, strokes - par)]);

  const api = { W, H, R: R0, CUP, WALL, FPS, simulate, shot1, movers, critterAt, cupAt, active, inZone, wallPts, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Golf = api;
})(this);
