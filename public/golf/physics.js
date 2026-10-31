// Mini-golf : les 5 trous et la physique de la balle, partagés par le serveur (qui calcule chaque tir et fait foi)
// et le navigateur (qui dessine le parcours et rejoue la trajectoire reçue). Script classique : window.Golf ou require().
(function (root) {
  const W = 1000, H = 600; // taille d'un trou (unités du parcours)
  const R = 7, WALL = 5, CUP = 11; // rayon de la balle, demi-épaisseur des murs, rayon du trou
  const DT = 1 / 240, SAMPLE = 8, FPS = 240 / SAMPLE; // pas de calcul, et 30 positions par seconde envoyées
  const MAX_SPEED = 820, MAX_T = 25;
  const TAU = Math.PI * 2;
  const box = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h, x, y];
  const SURF = { grass: { dec: 60, k: 0.55 }, sand: { dec: 320, k: 2.6 }, ice: { dec: 10, k: 0.08 } };

  // t : secondes depuis le début du trou (le même pour tout le monde) ; un obstacle périodique est actif sur [phase, phase + on[ modulo period.
  const active = (o, t) => !o.period || ((t + (o.phase || 0)) % o.period + o.period) % o.period < o.on;

  /* ---------- Les 5 trous ---------- */
  const HOLES = [
    {
      name: 'Le Moulin', theme: 'classic', par: 3, tee: [120, 300], cup: [880, 300],
      hint: 'Passe entre les ailes du moulin, ou fais le tour par les allées.',
      walls: [box(0, 0, W, H), [500, 70, 500, 230], [500, 370, 500, 530]],
      bumpers: [{ x: 300, y: 170, r: 18 }, { x: 300, y: 430, r: 18 }, { x: 500, y: 300, r: 14 }],
      windmills: [{ x: 500, y: 300, len: 78, blades: 4, speed: 1.5 }],
      zones: [{ t: 'sand', c: [760, 165, 55] }, { t: 'water', r: [690, 410, 170, 110] }],
      deco: [{ t: 'tunnel', r: [410, 528, 180, 72] }, { t: 'flowers', at: [[60, 60], [940, 560], [180, 560], [880, 40]] }],
    },
    {
      name: 'L’Île aux palmiers', theme: 'tropical', par: 3, tee: [110, 300], cup: [890, 300],
      hint: 'Le pont du milieu apparaît et disparaît : vise juste au bon moment, ou prends le grand pont.',
      walls: [box(0, 0, W, H)],
      bumpers: [{ x: 250, y: 150, r: 16, palm: true }, { x: 700, y: 455, r: 16, palm: true }, { x: 760, y: 200, r: 16, palm: true }],
      zones: [{ t: 'water', r: [430, 0, 140, H] }, { t: 'sand', c: [200, 520, 70] }, { t: 'sand', c: [800, 80, 70] }],
      bridges: [{ r: [430, 55, 140, 80] }, { r: [430, 262, 140, 76], period: 4, on: 2.4 }],
      deco: [{ t: 'shells', at: [[60, 60], [930, 540], [120, 540], [950, 70]] }],
    },
    {
      name: 'La Station orbitale', theme: 'space', par: 4, tee: [110, 470], cup: [150, 130],
      hint: 'Le téléporteur est un raccourci… mais attention aux trous noirs et à la glace.',
      walls: [box(0, 0, W, H), [0, 300, 790, 300]],
      gates: [{ x1: 800, y1: 300, x2: 880, y2: 300, dx: 1, dy: 0, amp: 60, period: 3 }],
      bumpers: [{ x: 330, y: 420, r: 22 }, { x: 430, y: 525, r: 18 }, { x: 700, y: 385, r: 20 }, { x: 900, y: 150, r: 20 }],
      zones: [{ t: 'ice', r: [240, 12, 520, 276] }, { t: 'water', c: [420, 85, 30] }, { t: 'water', c: [470, 225, 28] }],
      teleports: [{ from: [570, 470], to: [640, 150], r: 18 }],
      deco: [{ t: 'stars' }],
    },
    {
      name: 'Le Volcan', theme: 'volcano', par: 4, tee: [100, 300], cup: [900, 300],
      hint: 'Les ponts au-dessus de la lave clignotent, et les cheminées soufflent la balle vers le haut.',
      walls: [box(0, 0, W, H)],
      bumpers: [{ x: 840, y: 215, r: 18 }, { x: 840, y: 385, r: 18 }, { x: 160, y: 110, r: 20 }],
      zones: [
        { t: 'water', r: [290, 0, 90, H] }, { t: 'water', r: [620, 0, 90, H] },
        { t: 'fan', r: [410, 110, 180, 380], dir: [0, -1], f: 300, period: 4, on: 2 },
      ],
      bridges: [
        { r: [290, 25, 90, 85] }, { r: [290, 258, 90, 84], period: 3.6, on: 2.2 },
        { r: [620, 490, 90, 85] }, { r: [620, 258, 90, 84], period: 3.6, on: 2.2, phase: 1.8 },
      ],
      deco: [{ t: 'cracks' }],
    },
    {
      name: 'Le Pays des bonbons', theme: 'candy', par: 3, tee: [110, 500], cup: [880, 120],
      hint: 'Le ressort rose envoie la balle à toute vitesse ; la pente de caramel la fait redescendre.',
      walls: [box(0, 0, W, H), [330, H, 330, 210], [560, 280, W, 280]],
      bumpers: [{ x: 520, y: 140, r: 20, jelly: true }, { x: 640, y: 215, r: 18, jelly: true }, { x: 470, y: 430, r: 22, jelly: true }, { x: 640, y: 470, r: 22, jelly: true }, { x: 800, y: 420, r: 20, jelly: true }],
      zones: [{ t: 'sand', c: [880, 120, 62] }, { t: 'slope', r: [700, 12, 90, 256], dir: [-1, 0], f: 240 }],
      springs: [{ x: 210, y: 130, r: 20, dir: [1, 0], v: 760 }],
      deco: [{ t: 'sprinkles' }],
    },
  ];

  /* ---------- Géométrie ---------- */
  const inZone = (z, x, y) => z.r ? x >= z.r[0] && x <= z.r[0] + z.r[2] && y >= z.r[1] && y <= z.r[1] + z.r[3] : (x - z.c[0]) ** 2 + (y - z.c[1]) ** 2 <= z.c[2] ** 2;
  // Segments mobiles à l'instant t : ailes des moulins (vitesse de rotation) et portes qui coulissent.
  function movers(hole, t) {
    const out = [];
    for (const m of hole.windmills || []) for (let k = 0; k < m.blades; k++) {
      const a = m.speed * t + (k * TAU) / m.blades;
      out.push({ ax: m.x, ay: m.y, bx: m.x + Math.cos(a) * m.len, by: m.y + Math.sin(a) * m.len, cx: m.x, cy: m.y, w: m.speed });
    }
    for (const g of hole.gates || []) {
      const ph = (TAU * t) / g.period, o = Math.sin(ph) * g.amp, v = Math.cos(ph) * g.amp * (TAU / g.period);
      out.push({ ax: g.x1 + g.dx * o, ay: g.y1 + g.dy * o, bx: g.x2 + g.dx * o, by: g.y2 + g.dy * o, vx: g.dx * v, vy: g.dy * v });
    }
    return out;
  }
  // Choc avec un segment (épaisseur WALL) ; vsx, vsy : vitesse de l'obstacle au point de contact. Renvoie la vitesse d'impact.
  function hitSeg(b, ax, ay, bx, by, e, mv) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / L2));
    const px = ax + dx * u, py = ay + dy * u;
    return hitPoint(b, px, py, R + WALL, e, mv ? (mv.w ? -mv.w * (py - mv.cy) : mv.vx) : 0, mv ? (mv.w ? mv.w * (px - mv.cx) : mv.vy) : 0);
  }
  function hitPoint(b, px, py, rad, e, vsx = 0, vsy = 0) {
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
    if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
    return -vn;
  }
  const bridgeAt = (hole, x, y, t) => (hole.bridges || []).find(br => active(br, t) && inZone(br, x, y));

  /* ---------- Un tir ---------- */
  // Calcule toute la trajectoire d'un tir (angle en radians, puissance de 0 à 1) lancé à l'instant t0 du trou.
  // Renvoie les positions (30 par seconde), les événements (rebond, eau, téléporteur, ressort, trou) et le résultat.
  function simulate(hole, sx, sy, angle, power, t0) {
    const speed = 40 + Math.max(0, Math.min(1, power)) * (MAX_SPEED - 40);
    const b = { x: sx, y: sy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    const r1 = v => Math.round(v * 10) / 10;
    const path = [[r1(sx), r1(sy)]], events = [];
    const ev = (type, x = b.x, y = b.y) => events.push({ i: path.length, type, x: r1(x), y: r1(y) });
    const segs = [];
    for (const w of hole.walls) for (let k = 0; k + 3 < w.length; k += 2) segs.push([w[k], w[k + 1], w[k + 2], w[k + 3]]);
    let result = 'stop', cool = 0, lastBump = -1;
    const steps = MAX_T / DT;
    for (let i = 1; i <= steps; i++) {
      const t = t0 + i * DT;
      cool -= DT;
      // Sol, pentes, ventilateurs
      let surf = SURF.grass, ax = 0, ay = 0;
      for (const z of hole.zones || []) {
        if (!inZone(z, b.x, b.y)) continue;
        if (z.t === 'sand' || z.t === 'ice') surf = SURF[z.t];
        else if ((z.t === 'slope' || z.t === 'fan') && active(z, t)) { ax += z.dir[0] * z.f; ay += z.dir[1] * z.f; }
      }
      // Le trou attire un peu la balle qui passe dessus : trop vite, elle saute par-dessus.
      const cx = hole.cup[0] - b.x, cy = hole.cup[1] - b.y, cd = Math.hypot(cx, cy);
      if (cd < CUP) { ax += (cx / (cd || 1)) * 1500; ay += (cy / (cd || 1)) * 1500; }
      b.vx += ax * DT; b.vy += ay * DT;
      let sp = Math.hypot(b.vx, b.vy);
      const loss = (surf.dec + surf.k * sp) * DT;
      if (sp > loss) { b.vx *= (sp - loss) / sp; b.vy *= (sp - loss) / sp; } else b.vx = b.vy = 0;
      b.x += b.vx * DT; b.y += b.vy * DT;

      let hit = 0;
      for (const s of segs) hit = Math.max(hit, hitSeg(b, s[0], s[1], s[2], s[3], 0.72));
      for (const m of movers(hole, t)) hit = Math.max(hit, hitSeg(b, m.ax, m.ay, m.bx, m.by, 0.8, m) * 1.5);
      for (const p of hole.bumpers || []) hit = Math.max(hit, hitPoint(b, p.x, p.y, p.r + R, p.jelly ? 1.25 : 0.78));
      if (hit > 70 && i - lastBump > 24) { ev(hit > 400 ? 'bump2' : 'bump'); lastBump = i; }

      if (cool <= 0) {
        for (const tp of hole.teleports || []) if (Math.hypot(b.x - tp.from[0], b.y - tp.from[1]) < tp.r) {
          ev('tp'); b.x = tp.to[0]; b.y = tp.to[1]; cool = 0.6; path.push([r1(b.x), r1(b.y)]); ev('tpout');
        }
        for (const s of hole.springs || []) if (Math.hypot(b.x - s.x, b.y - s.y) < s.r + R) {
          b.vx = s.dir[0] * s.v; b.vy = s.dir[1] * s.v; cool = 0.6; ev('spring');
        }
      }
      const wet = (hole.zones || []).some(z => z.t === 'water' && inZone(z, b.x, b.y)), bridge = wet && bridgeAt(hole, b.x, b.y, t);
      if (wet && !bridge) { result = 'water'; break; }
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) { result = 'water'; break; }
      sp = Math.hypot(b.vx, b.vy);
      if (cd < CUP - 2 && sp < 330) { result = 'holed'; b.x = hole.cup[0]; b.y = hole.cup[1]; break; }
      if (i % SAMPLE === 0) path.push([r1(b.x), r1(b.y)]);
      if (sp < 3 && !ax && !ay && !bridge?.period) break; // arrêtée sur un pont qui clignote : elle tombera quand il disparaîtra
    }
    path.push([r1(b.x), r1(b.y)]);
    if (result !== 'stop') ev(result);
    return { path, events, result, x: r1(b.x), y: r1(b.y) };
  }

  const NAMES = { '-4': 'Condor', '-3': 'Albatros', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double Bogey', 3: 'Triple Bogey' };
  const label = (strokes, par) => (strokes === 1 ? 'Trou en un !' : NAMES[Math.max(-4, Math.min(3, strokes - par))]);

  const api = { W, H, R, CUP, WALL, FPS, HOLES, simulate, movers, active, inZone, label, MAX_STROKES: par => par + 3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Golf = api;
})(this);
