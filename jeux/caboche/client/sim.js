// Caboche Cup : la physique du match en 2D (vue de profil), partagée par le serveur (qui fait foi) et le navigateur
// (qui anticipe son joueur, et fait tourner seul les modes hors ligne). Script classique : window.CC ou require.
// Mètres et secondes, 60 images par seconde ; x le long du terrain (le côté 0 attaque vers +x), y vers le haut.
// Joueurs à grosse tête (1 contre 1 ou 2 contre 2), toujours tournés vers le but adverse : courir, sprinter (endurance),
// sauter, tirer (le geste dépend de la course : piqué, frappe, boulet, lob ; en l'air : volée, tête plongeante,
// retourné ; touche maintenue : tir chargé), amortir, tacler, parer près de son but, pouvoir spécial (huit personnages).
// Ballons (un ou trois), bonus qui tombent du ciel, modes fous (lune, patinoire, ballon géant, vent, cages folles)
// et terrains (sable, neige, pluie, vent des toits). Testé par jeux/caboche/caboche.test.js.
(function (root, factory) {
  const CC = factory();
  if (typeof module === 'object' && module.exports) module.exports = CC;
  else root.CC = CC;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { L: 1, R: 2, JUMP: 4, KICK: 8, TACKLE: 16, POWER: 32, SPRINT: 64 };
  const F = { HL: 10, GD: 1.5, GH: 2.9, CEIL: 9, BAR: 0.12 };
  const WALL = F.HL + F.GD; // murs du stade, derrière les buts
  const BALL = { r: 0.34, g: 15, bounce: 0.72, wall: 0.72, drag: 0.998, roll: 0.985, max: 32 };
  const PG = 26; // gravité des joueurs
  const BODY = { y: 0.6, r: 0.42 }, HEAD = { y: 1.55 }, SPRINT = 1.4, CHARGE = 0.8;
  const CHARS = {
    bouboule: { name: 'Bouboule', title: 'le canonnier', run: 6.2, accel: 45, jump: 9.6, kick: 19, head: 0.7, weight: 1.25, power: 'super', price: 0, stats: { vitesse: 3, tir: 5, saut: 3, tête: 4 } },
    lila: { name: 'Lila', title: 'la fusée', run: 7.2, accel: 55, jump: 10.6, kick: 16, head: 0.62, weight: 0.85, power: 'tete', price: 0, stats: { vitesse: 5, tir: 3, saut: 5, tête: 3 } },
    givre: { name: 'Givre', title: 'le glaçon', run: 6.6, accel: 48, jump: 9.8, kick: 17, head: 0.66, weight: 1, power: 'gel', price: 300, stats: { vitesse: 4, tir: 4, saut: 3, tête: 4 } },
    zoe: { name: 'Zoé', title: 'la sauterelle', run: 6.8, accel: 52, jump: 11.2, kick: 16, head: 0.6, weight: 0.8, power: 'ressort', price: 300, stats: { vitesse: 4, tir: 3, saut: 5, tête: 4 } },
    tiko: { name: 'Tiko', title: 'le lutin', run: 7.6, accel: 60, jump: 10, kick: 15, head: 0.56, weight: 0.7, power: 'mini', price: 400, stats: { vitesse: 5, tir: 2, saut: 4, tête: 2 } },
    magnus: { name: 'Magnus', title: 'le dribbleur', run: 6.8, accel: 50, jump: 9.6, kick: 17.5, head: 0.68, weight: 1.05, power: 'aimant', price: 450, stats: { vitesse: 4, tir: 4, saut: 3, tête: 4 } },
    roco: { name: 'Roco', title: 'le mur', run: 5.6, accel: 40, jump: 9, kick: 18, head: 0.78, weight: 1.5, power: 'mur', price: 500, stats: { vitesse: 2, tir: 4, saut: 2, tête: 5 } },
    siroco: { name: 'Siroco', title: 'le vent', run: 7, accel: 55, jump: 10, kick: 18, head: 0.62, weight: 0.9, power: 'tornade', price: 600, stats: { vitesse: 4, tir: 5, saut: 4, tête: 3 } },
  };
  const CHAR_IDS = Object.keys(CHARS);
  const POWERS = {
    super: { name: 'Super Tir', icon: '🔥', text: 'Ton prochain tir part comme un boulet enflammé', dur: 6 },
    tete: { name: 'Tête Géante', icon: '🎈', text: 'Ta tête double de volume pendant 6 s', dur: 6 },
    gel: { name: 'Coup de froid', icon: '❄️', text: 'L’adversaire est congelé 2 s', dur: 1 },
    ressort: { name: 'Super Ressort', icon: '🦘', text: 'Sauts énormes et double saut pendant 6 s', dur: 6 },
    mini: { name: 'Rétrécisseur', icon: '🔬', text: 'L’adversaire rapetisse pendant 6 s', dur: 1 },
    aimant: { name: 'Aimant', icon: '🧲', text: 'Le ballon colle à ton pied pendant 6 s', dur: 6 },
    mur: { name: 'Mur', icon: '🧱', text: 'Un mur ferme ton but pendant 5 s', dur: 1 },
    tornade: { name: 'Tornade', icon: '🌪️', text: 'Ton prochain tir zigzague, et plus fort', dur: 6 },
  };
  const ITEMS = {
    grosse: { icon: '🎈', name: 'Grosse tête' }, vite: { icon: '⚡', name: 'Turbo' }, gel: { icon: '❄️', name: 'Gel' }, cage: { icon: '🥅', name: 'Petite cage' },
    lourd: { icon: '🏋️', name: 'Ballon lourd' }, leger: { icon: '🪶', name: 'Ballon plume' }, jauge: { icon: '🔋', name: 'Jauge pleine' },
  };
  const ITEM_IDS = Object.keys(ITEMS);
  const ACCS = { aucun: { name: 'Rien', price: 0 }, casquette: { name: 'Casquette', price: 100 }, bandana: { name: 'Bandana', price: 120 }, lunettes: { name: 'Lunettes de star', price: 150 }, cornes: { name: 'Cornes', price: 250 }, aureole: { name: 'Auréole', price: 300 }, couronne: { name: 'Couronne', price: 400 } };
  const MODES = { normal: 'Normal', lune: '🌙 Sur la Lune', glace: '⛸️ Patinoire', geant: '🏐 Ballon géant', multi: '⚽ Multi-ballons', vent: '🌬️ Grand vent', cages: '🥅 Cages folles' };
  const STADES = { nuit: '🌃 Caboche Arena', orage: '⛈️ Arena sous l’orage', plage: '🏖️ Plage', neige: '🏔️ Montagne', toit: '🏙️ Toit de la ville' };
  const GAUGE_S = 26; // secondes pour remplir la jauge

  // Réglages physiques selon le mode et le terrain.
  function envOf(o = {}) {
    const e = { bg: BALL.g, pg: PG, jump: 1, bounce: BALL.bounce, roll: BALL.roll, r: BALL.r, accel: 1, run: 1 };
    if (o.mode === 'lune') { e.bg *= 0.45; e.pg *= 0.5; e.jump = 0.78; }
    if (o.mode === 'glace') { e.accel = 0.28; e.roll = 0.997; }
    if (o.mode === 'geant') { e.r = 0.62; e.bounce = 0.62; }
    if (o.stade === 'plage') { e.bounce *= 0.75; e.roll = 0.965; e.run = 0.93; }
    if (o.stade === 'neige') { e.bounce *= 0.85; e.roll = 0.99; e.accel *= 0.75; }
    if (o.stade === 'orage') { e.roll = 0.993; e.accel *= 0.8; }
    return e;
  }
  const ENV0 = envOf();

  const dirOf = p => (p.side ? -1 : 1); // sens d'attaque
  const C = p => CHARS[p.char] ?? CHARS.bouboule;
  function player(id, char, side) {
    return { id, char, side, x: (side ? 1 : -1) * 4.5, y: 0, vx: 0, vy: 0, ground: true, jumps: 0, kickT: 0, kickCd: 0, kicked: false, kind: '', charge: 0, chargeK: 0, tackleT: 0, tackleCd: 0, tackled: false, tdir: 0, stun: 0, frozen: 0, mini: 0, big: 0, fast: 0, keeper: false, gauge: 0, power: null, powerT: 0, pending: null, sta: 1, tired: false, sprint: false, prevIn: 0, goals: 0, trapAt: -99 };
  }
  const headR = p => C(p).head * (p.power === 'tete' ? 2 : 1) * (p.big > 0 ? 1.6 : 1) * (p.mini > 0 ? 0.55 : 1) * (p.keeper ? 1.2 : 1);
  const headY = p => p.y + HEAD.y * (p.power === 'tete' ? 1.2 : 1) * (p.big > 0 ? 1.1 : 1) * (p.mini > 0 ? 0.7 : 1);
  const bodyY = p => p.y + BODY.y * (p.mini > 0 ? 0.7 : 1), bodyR = p => BODY.r * (p.mini > 0 ? 0.75 : 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Une image pour un joueur (course, sprint, saut, tir, charge, tacle, pouvoir). Les contacts sont réglés par stepWorld.
  function step(p, inp, env = ENV0) {
    const c = C(p), pressed = inp & ~p.prevIn, released = p.prevIn & ~inp, s = dirOf(p);
    p.prevIn = inp;
    p.kickCd = Math.max(0, p.kickCd - DT); p.tackleCd = Math.max(0, p.tackleCd - DT);
    if (p.kickT > 0 && (p.kickT -= DT) <= 0) p.chargeK = 0;
    if (p.powerT > 0 && (p.powerT -= DT) <= 0) p.power = null;
    for (const k of ['frozen', 'mini', 'big', 'fast']) if (p[k] > 0) p[k] = Math.max(0, p[k] - DT);
    p.gauge = Math.min(1, p.gauge + DT / GAUGE_S);
    p.sprint = false;
    if (p.stun > 0 || p.frozen > 0) { // à terre après un tacle, ou congelé
      if (p.stun > 0) p.stun -= DT;
      if (p.ground) p.vx *= 0.88;
      p.charge = 0;
    } else if (p.tackleT > 0) { // glissade
      p.tackleT -= DT; p.vx *= 0.975; p.charge = 0;
    } else {
      const mx = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0);
      p.sprint = !!(inp & IN.SPRINT) && mx !== 0 && !p.tired && p.sta > 0;
      const run = c.run * env.run * (p.fast > 0 ? 1.35 : 1) * (p.mini > 0 ? 0.8 : 1) * (p.sprint ? SPRINT : 1);
      const a = c.accel * env.accel * (p.ground ? 1 : 0.6) * DT;
      p.vx += clamp(mx * run - p.vx, -a, a);
      if (pressed & IN.JUMP) {
        const j = c.jump * env.jump * (p.power === 'ressort' ? 1.4 : 1);
        if (p.ground) { p.vy = j; p.ground = false; p.jumps = p.power === 'ressort' ? 1 : 0; p.ev?.push('jump'); }
        else if (p.jumps > 0) { p.jumps--; p.vy = j * 0.85; p.ev?.push('jump'); }
      }
      if (pressed & IN.KICK && p.kickCd <= 0) { p.kickT = 0.22; p.kickCd = 0.32; p.kicked = false; p.kind = ''; p.chargeK = 0; p.ev?.push('swing'); }
      // touche de tir maintenue après le geste : on charge ; au relâché, tir chargé
      if (inp & IN.KICK) { if (p.kickT <= 0) p.charge = Math.min(CHARGE, p.charge + DT); }
      else if (released & IN.KICK) {
        if (p.charge > 0.18) { p.kickT = 0.24; p.kickCd = 0.32; p.kicked = false; p.kind = ''; p.chargeK = Math.min(1, p.charge / CHARGE); p.ev?.push('swing'); }
        p.charge = 0;
      }
      if (pressed & IN.TACKLE && p.tackleCd <= 0 && p.ground) { p.tdir = mx || s; p.tackleT = 0.45; p.tackleCd = 1.4; p.tackled = false; p.vx = p.tdir * 12.5; p.ev?.push('tackle'); }
      if (pressed & IN.POWER && p.gauge >= 1) {
        const pw = c.power; p.gauge = 0; p.power = pw; p.powerT = POWERS[pw].dur; p.ev?.push('power');
        if (pw === 'gel' || pw === 'mini' || pw === 'mur') p.pending = pw; // effet sur l'adversaire ou le terrain : stepWorld
      }
    }
    if (!(inp & IN.KICK)) p.charge = 0;
    // endurance : le sprint l'use, elle revient sans sprinter ; à zéro, il faut souffler un peu
    if (p.sprint) { p.sta -= DT * 0.55; if (p.sta <= 0) { p.sta = 0; p.tired = true; } }
    else { p.sta = Math.min(1, p.sta + DT * 0.28); if (p.tired && p.sta > 0.35) p.tired = false; }
    p.vy -= env.pg * DT;
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (p.y <= 0) { if (!p.ground && p.vy < -6) p.ev?.push('land'); p.y = 0; p.vy = 0; p.ground = true; p.jumps = 0; }
    const lim = F.HL - 0.25; // on ne rentre pas dans les buts
    if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; p.vx = 0; }
    p.keeper = !p.ground && Math.abs(p.x + s * F.HL) < 3.2; // en l'air devant son but : parade
  }

  // Rebond du ballon sur un cercle (corps ou tête) : il repart en tenant compte de la vitesse du joueur.
  // Renvoie la vitesse de choc (0 s'il n'y a pas contact).
  function bounceOff(b, r0, cx, cy, r, vx, vy, e) {
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), min = r + r0;
    if (d >= min || d < 1e-6) return 0;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * min; b.y = cy + ny * min;
    const rv = (b.vx - vx) * nx + (b.vy - vy) * ny;
    if (rv < 0) { b.vx -= (1 + e) * rv * nx; b.vy -= (1 + e) * rv * ny; }
    b.vx += vx * 0.2; b.vy += Math.max(0, vy) * 0.2;
    return Math.max(0.001, -rv);
  }

  // Hauteur des deux buts (index = côté qui le défend : 0 à gauche, 1 à droite) : cages folles, bonus « petite cage ».
  function goalHeights(w) {
    return [0, 1].map(d => {
      let h = F.GH;
      if (w.opts.mode === 'cages') h += Math.sin(w.frame / 150 + d * Math.PI) * 0.75;
      if (w.shrink[d] > 0) h *= 0.7;
      return h;
    });
  }

  // Un ballon sur un pas de temps h : sol, plafond, murs, filets, barres, murs magiques (pouvoir « mur »).
  function stepBall(w, b, ev, h = DT, env = ENV0) {
    const r = env.r, mod = w.ballMod?.t > 0 ? w.ballMod.kind : null;
    const g = env.bg * (mod === 'lourd' ? 1.6 : mod === 'leger' ? 0.55 : 1), bounce = env.bounce * (mod === 'lourd' ? 0.7 : mod === 'leger' ? 1.15 : 1);
    b.vy -= g * h;
    b.vx += (w.wind ?? 0) * h * 0.6;
    if (b.zig > 0) { b.zig -= h; b.zph = (b.zph ?? 0) + h * 13; b.vy += Math.cos(b.zph) * 34 * h; }
    const k = Math.pow(BALL.drag, h * FPS); b.vx *= k; b.vy *= k;
    const max = BALL.max * (mod === 'lourd' ? 0.75 : 1), sp = Math.hypot(b.vx, b.vy); if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.fire > 0) b.fire -= h;
    if (b.y < r) { b.y = r; if (b.vy < 0) { if (b.vy < -3.5) ev.push({ t: 'bounce', x: +b.x.toFixed(2), y: 0, v: +(-b.vy).toFixed(1) }); b.vy = -b.vy * Math.min(0.92, bounce); if (b.vy < 1) b.vy = 0; } }
    if (b.y <= r + 1e-3) b.vx *= Math.pow(env.roll, h * FPS);
    if (b.y > F.CEIL - r) { b.y = F.CEIL - r; b.vy = -Math.abs(b.vy) * BALL.wall; }
    if (Math.abs(b.x) > WALL - r) { b.x = Math.sign(b.x) * (WALL - r); b.vx = -b.vx * BALL.wall; if (Math.abs(b.vx) > 4) ev.push({ t: 'wall', x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); }
    const gh = w.goalH ?? [F.GH, F.GH];
    // dans un but : le filet freine
    if (Math.abs(b.x) > F.HL && b.y < gh[b.x > 0 ? 1 : 0]) b.vx *= Math.pow(0.95, h * FPS);
    for (const d of [0, 1]) {
      const s = d ? 1 : -1, H = gh[d];
      // mur magique devant le but
      if (w.walls?.[d] > 0 && b.x * s > F.HL - 0.35 - r && b.x * s < F.HL + 0.3 && b.y < H + 0.4) {
        if (b.vx * s > 0) { if (Math.abs(b.vx) > 3) ev.push({ t: 'block', x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); b.vx = -b.vx * 0.8; }
        b.x = s * (F.HL - 0.35 - r);
      }
      // barre transversale : un segment épais de la ligne de but au fond ; son bout avant fait « poteau »
      const x0 = s * F.HL, cx = s * clamp(b.x * s, F.HL, WALL), dx = b.x - cx, dy = b.y - H, dd = Math.hypot(dx, dy), min = r + F.BAR;
      if (dd < min && dd > 1e-6) {
        const nx = dx / dd, ny = dy / dd, rv = b.vx * nx + b.vy * ny;
        b.x = cx + nx * min; b.y = H + ny * min;
        if (rv < 0) { b.vx -= 1.75 * rv * nx; b.vy -= 1.75 * rv * ny; if (-rv > 4) ev.push({ t: Math.abs(cx - x0) < 0.05 ? 'post' : 'bounce', x: +b.x.toFixed(2), y: +b.y.toFixed(2), v: +(-rv).toFixed(1) }); }
      }
    }
  }

  // Tir : le geste dépend de la situation (pouvoir, en l'air, sprint, course, recul, arrêt) et de la charge.
  // Renvoie [nom, angle en degrés, puissance].
  function kickOf(p, b) {
    const c = C(p), ck = p.chargeK || 0, k = 1 + 0.6 * ck, low = ck * 8;
    if (p.power === 'super') return ['feu', 6, c.kick * 1.7 * k];
    if (p.power === 'tornade') return ['tornade', 10, c.kick * 1.35 * k];
    if (!p.ground) {
      const rel = b.y - p.y;
      if (rel > 1.45) return ['retourne', -12, c.kick * 1.3 * k];
      if (rel > 0.6) return ['plongeon', 4, c.kick * 1.15 * k];
      return ['volee', 8, c.kick * 1.05 * k];
    }
    const fwd = p.vx * dirOf(p);
    if (p.sprint && fwd > 0) return ['boulet', 13 - low, (c.kick * 1.2 + fwd * 0.3) * k];
    if (fwd > 1.5) return ['frappe', 22 - low, (c.kick + fwd * 0.3) * k];
    if (fwd < -1.5) return ['lob', 58, c.kick * 0.78 * k];
    return ck > 0.3 ? ['canon', 18 - low, c.kick * 0.85 * k] : ['pique', 40, c.kick * 0.85];
  }
  // Le ballon est-il à portée du geste (pied au sol, tout le corps en l'air) ?
  function inReach(p, b) {
    const s = dirOf(p), dx = (b.x - p.x) * s;
    if (p.ground) return Math.hypot(b.x - p.x - s * 0.5, b.y - p.y - 0.35) < 0.95 && dx > -0.3;
    const rel = b.y - p.y;
    return dx > -0.4 && dx < 1.3 && rel > -0.3 && rel < 2.3;
  }

  const rand = w => (w.seed = (w.seed * 16807) % 2147483647) / 2147483647;
  function applyItem(w, p, kind) {
    const foes = w.players.filter(o => o.side !== p.side);
    if (kind === 'grosse') p.big = 7;
    else if (kind === 'vite') p.fast = 7;
    else if (kind === 'gel') for (const o of foes) o.frozen = 1.5;
    else if (kind === 'cage') w.shrink[p.side] = 8;
    else if (kind === 'lourd' || kind === 'leger') w.ballMod = { kind, t: 8 };
    else if (kind === 'jauge') p.gauge = 1;
  }

  // Une image pour le match : joueurs, pouvoirs, bonus, contacts (pied, corps, tête), tacles, ballons, but.
  // Renvoie le côté qui marque (0 : celui de gauche, qui attaque vers +x ; 1 : celui de droite), ou null.
  function stepWorld(w, inputs, ev = []) {
    const env = envOf(w.opts);
    w.frame++;
    w.wind = w.opts.mode === 'vent' ? Math.sin(w.frame / 200) * 5 : w.opts.stade === 'toit' ? Math.sin(w.frame / 260) * 2 : 0;
    for (const d of [0, 1]) { if (w.walls[d] > 0) w.walls[d] = Math.max(0, w.walls[d] - DT); if (w.shrink[d] > 0) w.shrink[d] = Math.max(0, w.shrink[d] - DT); }
    if (w.ballMod?.t > 0) w.ballMod.t -= DT;
    w.goalH = goalHeights(w);
    for (const p of w.players) {
      p.ev = []; step(p, inputs[p.id] ?? 0, env);
      for (const t of p.ev) ev.push({ t, id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), ...(t === 'power' ? { power: p.power } : {}) });
      delete p.ev;
      if (p.pending) { // pouvoirs qui touchent l'adversaire ou le terrain
        for (const o of w.players) if (o.side !== p.side) { if (p.pending === 'gel') o.frozen = 2; if (p.pending === 'mini') o.mini = 6; }
        if (p.pending === 'mur') w.walls[p.side] = 5;
        p.pending = null;
      }
    }
    // les joueurs se bousculent ; le tacle fait tomber l'adversaire
    for (let i = 0; i < w.players.length; i++) for (let j = i + 1; j < w.players.length; j++) {
      const a = w.players[i], o = w.players[j];
      if (Math.abs(a.y - o.y) >= 1.6) continue;
      const dx = o.x - a.x, d = Math.abs(dx);
      if (d >= 0.95) continue;
      const push = 0.95 - d, n = Math.sign(dx) || 1, wa = C(a).weight, wo = C(o).weight;
      a.x -= n * push * (wo / (wa + wo)); o.x += n * push * (wa / (wa + wo));
      if (a.vx * n > 0) a.vx *= 0.6; if (o.vx * n < 0) o.vx *= 0.6;
      if (a.side !== o.side) for (const [t, v] of [[a, o], [o, a]]) if (t.tackleT > 0 && !t.tackled && v.stun <= 0 && v.tackleT <= 0 && v.y < 1) {
        t.tackled = true; v.stun = 1.1; v.vx = t.tdir * 4 / C(v).weight; v.vy = 4.5; v.ground = false; v.kickT = 0;
        ev.push({ t: 'fall', id: v.id, by: t.id, x: +v.x.toFixed(2), y: +v.y.toFixed(2) });
      }
    }
    // bonus : un toutes les 10 à 16 s, qui descend en parachute ; on le ramasse en le touchant
    if (w.opts.bonus) {
      if (--w.itemIn <= 0) { w.itemIn = 600 + Math.floor(rand(w) * 360); if (w.items.length < 2) w.items.push({ id: ++w.itemId, kind: ITEM_IDS[Math.floor(rand(w) * ITEM_IDS.length)], x: +((rand(w) * 2 - 1) * (F.HL - 2.5)).toFixed(2), y: 7.5, life: 11 }); }
      for (const it of w.items) { it.y = Math.max(0.45, it.y - 1.3 * DT); it.life -= DT; }
      for (const it of [...w.items]) {
        const p = w.players.find(p => p.stun <= 0 && Math.abs(p.x - it.x) < 0.9 && it.y > p.y - 0.3 && it.y < headY(p) + headR(p));
        if (p) { applyItem(w, p, it.kind); ev.push({ t: 'item', id: p.id, kind: it.kind, x: it.x, y: +it.y.toFixed(2) }); }
        if (p || it.life <= 0) w.items.splice(w.items.indexOf(it), 1);
      }
    }
    for (const b of w.balls) for (let k = 0; k < 2; k++) stepBall(w, b, ev, DT / 2, env); // deux demi-pas : pas de ballon qui traverse la barre
    // ballons entre eux (multi-ballons)
    for (let i = 0; i < w.balls.length; i++) for (let j = i + 1; j < w.balls.length; j++) {
      const a = w.balls[i], o = w.balls[j], dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy), min = env.r * 2;
      if (d < min && d > 1e-6) { const nx = dx / d, ny = dy / d, push = (min - d) / 2, rv = (o.vx - a.vx) * nx + (o.vy - a.vy) * ny; a.x -= nx * push; a.y -= ny * push; o.x += nx * push; o.y += ny * push; if (rv < 0) { a.vx += rv * nx; a.vy += rv * ny; o.vx -= rv * nx; o.vy -= rv * ny; } }
    }
    for (const p of w.players) {
      const s = dirOf(p);
      // le geste : le ballon le plus proche à portée part selon le geste choisi
      if (p.kickT > 0 && !p.kicked && p.stun <= 0 && p.frozen <= 0) {
        const b = w.balls.filter(b => inReach(p, b)).sort((a, c) => Math.abs(a.x - p.x) - Math.abs(c.x - p.x))[0];
        if (b) {
          const [kind, deg, pw] = kickOf(p, b), an = (deg * Math.PI) / 180;
          p.kicked = true; p.kind = kind;
          b.vx = s * Math.cos(an) * pw; b.vy = Math.sin(an) * pw;
          if (b.y < env.r + 0.02 && b.vy < 0) b.vy = -b.vy * 0.6;
          if (kind === 'feu') { p.power = null; p.powerT = 0; b.fire = 2.2; }
          if (kind === 'tornade') { p.power = null; p.powerT = 0; b.zig = 1.6; b.zph = 0; }
          w.touch = p.id;
          ev.push({ t: 'kick', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), p: +pw.toFixed(1), kind, fire: kind === 'feu', charged: p.chargeK > 0.3 });
          continue;
        }
      }
      for (const b of w.balls) {
        // aimant : le ballon proche colle au pied
        if (p.power === 'aimant' && p.ground && p.stun <= 0 && b.y < 1.4 && Math.abs(b.x - p.x - s * 0.55) < 1.3 && p.kickT <= 0) { b.x += (p.x + s * 0.6 - b.x) * 0.35; b.y = Math.max(env.r, b.y - 0.1); b.vx = p.vx; b.vy = Math.min(b.vy, 0); w.touch = p.id; }
        // la glissade emporte le ballon au ras du sol
        if (p.tackleT > 0 && b.y < 0.9 && Math.abs(b.x - (p.x + p.tdir * 0.55)) < 0.75) { b.vx = p.tdir * 11; b.vy = 3; w.touch = p.id; }
        // le corps (amorti des ballons qui arrivent doucement) et la tête (gros cercle ; en sautant, plus vive)
        const toGoal = b.vx * -s;
        const body = bounceOff(b, env.r, p.x, bodyY(p), bodyR(p), p.vx, p.vy, 0.3);
        if (body && body < 6.5 && p.ground && p.kickT <= 0 && b.y < 1.4) { b.vx = p.vx + Math.sign(b.x - p.x || s) * 0.8; b.vy = Math.min(b.vy, 1.2); if (w.frame - p.trapAt > 30) { p.trapAt = w.frame; ev.push({ t: 'trap', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); } }
        const head = bounceOff(b, env.r, p.x, headY(p), headR(p), p.vx, p.vy + (p.vy > 0 ? 2 : 0), p.vy > 1 ? 0.8 : p.keeper ? 0.45 : 0.6);
        if (head && p.vy > 1) { b.vx += s * 3; b.vy += 1.5; }
        if (body || head) w.touch = p.id;
        if (head && p.keeper && toGoal > 8) ev.push({ t: 'save', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) });
        else if (head) { const sp = Math.hypot(b.vx, b.vy); if (sp > 6 && w.frame - (w.headAt ?? 0) > 10) { w.headAt = w.frame; ev.push({ t: 'header', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); } }
      }
    }
    // but : un ballon a entièrement franchi la ligne, sous la barre
    for (const b of w.balls) {
      const d = b.x > 0 ? 1 : 0;
      if (Math.abs(b.x) > F.HL + env.r && b.y < w.goalH[d]) return 1 - d;
    }
    return null;
  }

  // entries : [{ id, char, side? }] (sans side : 0 puis 1) ; opts : { mode, stade, bonus, seed }
  function world(entries, opts = {}) {
    const w = { frame: 0, opts: { mode: 'normal', stade: 'nuit', bonus: false, ...opts }, players: entries.map((e, k) => player(e.id, e.char, e.side ?? k)), balls: [], items: [], itemIn: 420, itemId: 0, walls: [0, 0], shrink: [0, 0], ballMod: null, wind: 0, goalH: [F.GH, F.GH], seed: opts.seed || 12345, touch: null };
    kickoff(w);
    return w;
  }
  // Coup d'envoi : chacun dans son camp (le second d'une équipe plus en retrait), les ballons tombent au centre.
  function kickoff(w) {
    for (const side of [0, 1]) w.players.filter(p => p.side === side).forEach((p, k) => Object.assign(p, { x: (side ? 1 : -1) * (k ? 7.5 : 4.5), y: 0, vx: 0, vy: 0, ground: true, kickT: 0, tackleT: 0, stun: 0, frozen: 0, charge: 0 }));
    const n = w.opts.mode === 'multi' ? 3 : 1;
    w.balls = [[0, 4], [-2.4, 5.5], [2.4, 5.5]].slice(0, n).map(([x, y]) => ({ x, y, vx: 0, vy: 0, fire: 0, zig: 0 }));
    w.touch = null;
  }

  const KEYS = ['x', 'y', 'vx', 'vy', 'ground', 'jumps', 'kickT', 'kickCd', 'kicked', 'kind', 'charge', 'chargeK', 'tackleT', 'tackleCd', 'tackled', 'tdir', 'stun', 'frozen', 'mini', 'big', 'fast', 'keeper', 'gauge', 'power', 'powerT', 'sta', 'tired', 'sprint', 'prevIn'];
  const pack = p => { const o = { id: p.id, char: p.char, side: p.side }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => [b.x, b.y, b.vx, b.vy].map(v => Math.round(v * 1000) / 1000).concat([b.fire > 0 ? 1 : 0, b.zig > 0 ? 1 : 0]);
  const unpackBall = a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], fire: a[4], zig: a[5] });

  return { FPS, DT, IN, F, WALL, BALL, BODY, HEAD, SPRINT, CHARGE, CHARS, CHAR_IDS, POWERS, ITEMS, ITEM_IDS, ACCS, MODES, STADES, envOf, dirOf, kickOf, inReach, player, step, stepBall, stepWorld, world, kickoff, headR, headY, bodyY, bodyR, goalHeights, pack, packBall, unpackBall };
});
