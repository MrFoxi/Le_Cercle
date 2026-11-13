// Caboche Cup : la physique du match en 2D (vue de profil), partagée par le serveur (qui fait foi) et le navigateur
// (qui anticipe son joueur et le ballon, et fait tourner seul les modes hors ligne). Script classique : window.CC ou require.
// Mètres et secondes, 60 images par seconde ; x le long du terrain (le côté 0 attaque vers +x), y vers le haut.
// Un joueur, c'est une tête énorme (un cercle solide : on ne traverse pas l'adversaire, on peut se poser sur sa tête)
// et une grosse chaussure qui pivote sous la tête. Tirer fait balayer la jambe en arc de cercle : le ballon part selon
// l'endroit où le pied le touche (dessous : il monte ; au milieu : tendu ; dessus : rasant) ; au bon moment, frappe
// parfaite. Une touche à part pour le lob. Une touche appuyée un peu tôt est gardée en mémoire.
// En plus : sprint et endurance, sauts, têtes, parade près de son but, pouvoirs (huit personnages), bonus qui tombent
// du ciel, modes fous et terrains. Testé par jeux/caboche/caboche.test.js.
(function (root, factory) {
  const CC = factory();
  if (typeof module === 'object' && module.exports) module.exports = CC;
  else root.CC = CC;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { L: 1, R: 2, JUMP: 4, KICK: 8, LOB: 16, POWER: 32, SPRINT: 64 };
  const F = { HL: 10, GD: 1.5, GH: 2.9, CEIL: 9, BAR: 0.12 };
  const WALL = F.HL + F.GD; // murs du stade, derrière les buts
  const BALL = { r: 0.34, g: 15, bounce: 0.72, wall: 0.72, drag: 0.998, roll: 0.985, max: 34 };
  const PG = 26; // gravité des joueurs
  // la tête repose sur la chaussure : NECK = hauteur du bas de la tête ; la jambe pivote sous la tête
  const NECK = 0.42, LEG = { pivot: 0.6, len: 0.62, foot: 0.22, rest: 0.15, from: -0.7, to: 2.3, swing: 0.18 }, SPRINT = 1.4;
  const CHARS = {
    bouboule: { name: 'Bouboule', title: 'le canonnier', run: 6.2, accel: 45, jump: 9.6, kick: 21, head: 0.72, weight: 1.25, power: 'super', price: 0, stats: { vitesse: 3, tir: 5, saut: 3, tête: 4 } },
    lila: { name: 'Lila', title: 'la fusée', run: 7.2, accel: 55, jump: 10.6, kick: 18, head: 0.64, weight: 0.85, power: 'tete', price: 0, stats: { vitesse: 5, tir: 3, saut: 5, tête: 3 } },
    givre: { name: 'Givre', title: 'le glaçon', run: 6.6, accel: 48, jump: 9.8, kick: 19, head: 0.68, weight: 1, power: 'gel', price: 300, stats: { vitesse: 4, tir: 4, saut: 3, tête: 4 } },
    zoe: { name: 'Zoé', title: 'la sauterelle', run: 6.8, accel: 52, jump: 11.2, kick: 18, head: 0.62, weight: 0.8, power: 'ressort', price: 300, stats: { vitesse: 4, tir: 3, saut: 5, tête: 4 } },
    tiko: { name: 'Tiko', title: 'le lutin', run: 7.6, accel: 60, jump: 10, kick: 17, head: 0.58, weight: 0.7, power: 'mini', price: 400, stats: { vitesse: 5, tir: 2, saut: 4, tête: 2 } },
    magnus: { name: 'Magnus', title: 'le dribbleur', run: 6.8, accel: 50, jump: 9.6, kick: 19.5, head: 0.7, weight: 1.05, power: 'aimant', price: 450, stats: { vitesse: 4, tir: 4, saut: 3, tête: 4 } },
    roco: { name: 'Roco', title: 'le mur', run: 5.6, accel: 40, jump: 9, kick: 20, head: 0.8, weight: 1.5, power: 'mur', price: 500, stats: { vitesse: 2, tir: 4, saut: 2, tête: 5 } },
    siroco: { name: 'Siroco', title: 'le vent', run: 7, accel: 55, jump: 10, kick: 20, head: 0.64, weight: 0.9, power: 'tornade', price: 600, stats: { vitesse: 4, tir: 5, saut: 4, tête: 3 } },
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function player(id, char, side) {
    return { id, char, side, x: (side ? 1 : -1) * 4.5, y: 0, vx: 0, vy: 0, ground: true, perch: 0, jumps: 0, kickT: 0, kickCd: 0, kicked: false, lob: false, queued: 0, kind: '', frozen: 0, mini: 0, big: 0, fast: 0, keeper: false, gauge: 0, power: null, powerT: 0, pending: null, sta: 1, tired: false, sprint: false, prevIn: 0, goals: 0, trapAt: -99 };
  }
  const sz = p => (p.mini > 0 ? 0.7 : 1); // taille du corps (rétréci)
  const baseR = p => C(p).head * (p.power === 'tete' ? 2 : 1) * (p.big > 0 ? 1.6 : 1) * (p.mini > 0 ? 0.55 : 1);
  const headR = p => baseR(p) * (p.keeper ? 1.2 : 1);
  const headY = p => p.y + NECK * sz(p) + baseR(p);
  // La jambe : angle (0 : pied sous la tête ; positif : vers l'avant et vers le haut) et position du pied.
  const legAngle = p => (p.kickT > 0 ? LEG.from + (LEG.to - LEG.from) * (1 - p.kickT / LEG.swing) : LEG.rest);
  function footPos(p, th = legAngle(p)) { const s = dirOf(p), k = sz(p); return { x: p.x + s * Math.sin(th) * LEG.len * k, y: p.y + LEG.pivot * k - Math.cos(th) * LEG.len * k }; }

  // Une image pour un joueur (course, sprint, saut, tir, lob, pouvoir). Les contacts sont réglés par stepWorld.
  function step(p, inp, env = ENV0) {
    const c = C(p), pressed = inp & ~p.prevIn;
    p.prevIn = inp;
    p.kickCd = Math.max(0, p.kickCd - DT);
    if (p.kickT > 0) p.kickT = Math.max(0, p.kickT - DT);
    if (p.powerT > 0 && (p.powerT -= DT) <= 0) p.power = null;
    for (const k of ['frozen', 'mini', 'big', 'fast']) if (p[k] > 0) p[k] = Math.max(0, p[k] - DT);
    p.gauge = Math.min(1, p.gauge + DT / GAUGE_S);
    p.sprint = false;
    const canJump = p.ground || p.perch > 0;
    if (p.perch > 0) p.perch--;
    if (p.frozen > 0) { if (p.ground) p.vx *= 0.88; p.queued = 0; } // congelé
    else {
      const mx = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0);
      p.sprint = !!(inp & IN.SPRINT) && mx !== 0 && !p.tired && p.sta > 0;
      const run = c.run * env.run * (p.fast > 0 ? 1.35 : 1) * (p.mini > 0 ? 0.8 : 1) * (p.sprint ? SPRINT : 1);
      const a = c.accel * env.accel * (canJump ? 1 : 0.6) * DT;
      p.vx += clamp(mx * run - p.vx, -a, a);
      if (pressed & IN.JUMP) {
        const j = c.jump * env.jump * (p.power === 'ressort' ? 1.4 : 1);
        if (canJump) { p.vy = j; p.ground = false; p.perch = 0; p.jumps = p.power === 'ressort' ? 1 : 0; p.ev?.push('jump'); }
        else if (p.jumps > 0) { p.jumps--; p.vy = j * 0.85; p.ev?.push('jump'); }
      }
      // tir et lob : une touche appuyée pendant le geste précédent est gardée 150 ms
      if (pressed & (IN.KICK | IN.LOB)) p.queued = (pressed & IN.LOB ? -1 : 1) * 9;
      if (p.queued && p.kickCd <= 0) { p.lob = p.queued < 0; p.queued = 0; p.kickT = LEG.swing; p.kickCd = 0.3; p.kicked = false; p.kind = ''; p.ev?.push('swing'); }
      else if (p.queued) p.queued -= Math.sign(p.queued);
      if (pressed & IN.POWER && p.gauge >= 1) {
        const pw = c.power; p.gauge = 0; p.power = pw; p.powerT = POWERS[pw].dur; p.ev?.push('power');
        if (pw === 'gel' || pw === 'mini' || pw === 'mur') p.pending = pw; // effet sur l'adversaire ou le terrain : stepWorld
      }
    }
    // endurance : le sprint l'use, elle revient sans sprinter ; à zéro, il faut souffler un peu
    if (p.sprint) { p.sta -= DT * 0.55; if (p.sta <= 0) { p.sta = 0; p.tired = true; } }
    else { p.sta = Math.min(1, p.sta + DT * 0.28); if (p.tired && p.sta > 0.35) p.tired = false; }
    p.vy -= env.pg * DT;
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (p.y <= 0) { if (!p.ground && p.vy < -6) p.ev?.push('land'); p.y = 0; p.vy = 0; p.ground = true; p.jumps = 0; }
    else if (p.y > 0.02) p.ground = false;
    const lim = F.HL - 0.25; // on ne rentre pas dans les buts
    if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; p.vx = 0; }
    p.keeper = !p.ground && p.perch <= 0 && Math.abs(p.x + dirOf(p) * F.HL) < 3.2; // en l'air devant son but : parade
  }

  // Rebond du ballon sur un cercle : il repart en tenant compte de la vitesse du cercle. Renvoie la vitesse de choc.
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
      if (w.shrink?.[d] > 0) h *= 0.7;
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

  // Vitesse donnée au ballon par le pied à l'angle th : direction du pied vers le ballon (le point de contact choisit
  // la hauteur), puissance selon la vitesse de la jambe (plus forte au milieu du geste : frappe parfaite) et la course.
  function kickVel(p, b, th, f = footPos(p, th)) {
    const c = C(p), s = dirOf(p);
    let nx = b.x - f.x, ny = b.y - f.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    let ang = Math.atan2(ny, Math.max(0.3, nx * s)) + 0.1; // angle vers l'avant (positif : vers le haut)
    const perfect = !p.lob && th > 1.15 && th < 1.85, q = clamp(1 - Math.abs(th - 1.5) / 1.4, 0, 1), fwd = Math.max(0, p.vx * s);
    let pw = c.kick * (0.7 + 0.3 * q) * (perfect ? 1.12 : 1) + fwd * 0.35, kind = p.ground || p.perch > 0 ? 'frappe' : 'volee';
    ang = clamp(ang, -0.55, 1.1);
    if (p.lob) { ang = 1.0; pw = c.kick * 0.74 + fwd * 0.2; kind = 'lob'; }
    if (p.power === 'super') { pw *= 1.7; ang = Math.min(ang, 0.25); kind = 'feu'; }
    else if (p.power === 'tornade') { pw *= 1.35; kind = 'tornade'; }
    return { vx: s * Math.cos(ang) * pw, vy: Math.sin(ang) * pw, kind, perfect: perfect && kind !== 'lob', pw };
  }
  // Pour le robot : l'angle de jambe qui passerait au plus près de ce ballon, et la distance pied-ballon.
  function bestReach(p, b) {
    let best = null;
    for (let k = 0; k <= 24; k++) { const th = LEG.from + ((LEG.to - LEG.from) * k) / 24, f = footPos(p, th), d = Math.hypot(b.x - f.x, b.y - f.y); if (!best || d < best.d) best = { th, d, f }; }
    return best;
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

  // Les têtes sont solides : on se pousse (le plus lourd tient mieux), on rebondit en l'air, on se pose sur la tête de l'autre.
  function bodies(w, ev) {
    for (let i = 0; i < w.players.length; i++) for (let j = i + 1; j < w.players.length; j++) {
      const a = w.players[i], o = w.players[j], dx = o.x - a.x, dy = headY(o) - headY(a), d = Math.hypot(dx, dy), min = baseR(a) + baseR(o);
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, over = min - d, wa = C(a).weight, wo = C(o).weight, ka = wo / (wa + wo), ko = wa / (wa + wo);
      a.x -= nx * over * ka; o.x += nx * over * ko;
      a.y = Math.max(0, a.y - ny * over * ka); o.y = Math.max(0, o.y + ny * over * ko);
      const rv = (o.vx - a.vx) * nx + (o.vy - a.vy) * ny;
      if (rv < 0) { const jmp = (-(1.25) * rv) / (1 / wa + 1 / wo); a.vx -= (jmp * nx) / wa; a.vy -= (jmp * ny) / wa; o.vx += (jmp * nx) / wo; o.vy += (jmp * ny) / wo; }
      // posé sur la tête de l'autre : on peut ressauter
      for (const [top, under, k] of [[o, a, ny], [a, o, -ny]]) if (k > 0.55) {
        if (top.vy < 0.5) { if (-rv > 4 && w.frame - (w.boingAt ?? 0) > 12) { w.boingAt = w.frame; ev.push({ t: 'boing', id: top.id, on: under.id, x: +top.x.toFixed(2), y: +headY(under).toFixed(2) }); } top.vy = Math.max(top.vy, -rv > 4 ? 3 : 0); top.perch = 3; top.jumps = 0; }
      }
      if (Math.abs(nx) > 0.6 && -rv > 7 && w.frame - (w.bumpAt ?? 0) > 15) { w.bumpAt = w.frame; ev.push({ t: 'bump', x: +((a.x + o.x) / 2).toFixed(2), y: +((headY(a) + headY(o)) / 2).toFixed(2) }); }
    }
  }

  // Une image pour le match : joueurs, pouvoirs, bonus, corps, jambe, têtes, ballons, but.
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
    bodies(w, ev);
    // bonus : un toutes les 10 à 16 s, qui descend en parachute ; on le ramasse en le touchant de la tête
    if (w.opts.bonus) {
      if (--w.itemIn <= 0) { w.itemIn = 600 + Math.floor(rand(w) * 360); if (w.items.length < 2) w.items.push({ id: ++w.itemId, kind: ITEM_IDS[Math.floor(rand(w) * ITEM_IDS.length)], x: +((rand(w) * 2 - 1) * (F.HL - 2.5)).toFixed(2), y: 7.5, life: 11 }); }
      for (const it of w.items) { it.y = Math.max(0.45, it.y - 1.3 * DT); it.life -= DT; }
      for (const it of [...w.items]) {
        const p = w.players.find(p => Math.hypot(p.x - it.x, headY(p) - it.y) < baseR(p) + 0.45 || Math.hypot(footPos(p).x - it.x, footPos(p).y - it.y) < 0.6);
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
      // la jambe balaie son arc : le premier ballon touché part selon le point de contact (trois positions par image)
      let kicked = null;
      if (p.kickT > 0 && !p.kicked && p.frozen <= 0) {
        const th1 = legAngle(p), th0 = Math.max(LEG.from, th1 - ((LEG.to - LEG.from) * DT) / LEG.swing);
        for (let k = 1; k <= 3 && !kicked; k++) {
          const th = th0 + ((th1 - th0) * k) / 3, f = footPos(p, th);
          for (const b of w.balls) if (Math.hypot(b.x - f.x, b.y - f.y) < LEG.foot + env.r) { kicked = b; hit(w, p, b, th, f, env, ev); break; }
        }
      }
      for (const b of w.balls) {
        if (b === kicked) continue;
        // aimant : le ballon proche colle au pied
        if (p.power === 'aimant' && p.ground && b.y < 1.4 && Math.abs(b.x - p.x - s * 0.9) < 1.3 && p.kickT <= 0) { b.x += (p.x + s * 0.95 - b.x) * 0.35; b.y = Math.max(env.r, b.y - 0.1); b.vx = p.vx; b.vy = Math.min(b.vy, 0); w.touch = p.id; }
        // la chaussure au repos : un ballon qui arrive doucement est amorti
        const f = footPos(p), toGoal = b.vx * -s;
        const foot = p.kickT > 0 ? 0 : bounceOff(b, env.r, f.x, f.y, LEG.foot, p.vx, p.vy, 0.3);
        if (foot && foot < 7 && p.ground && b.y < 1.2) { b.vx = p.vx + Math.sign(b.x - p.x || s) * 0.8; b.vy = Math.min(b.vy, 1.2); if (w.frame - p.trapAt > 30) { p.trapAt = w.frame; ev.push({ t: 'trap', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); } }
        // la tête : un gros cercle ; en sautant dedans, elle renvoie plus vite et vers l'avant ; devant son but, parade
        const head = bounceOff(b, env.r, p.x, headY(p), headR(p), p.vx, p.vy + (p.vy > 0 ? 2 : 0), p.vy > 1 ? 0.85 : p.keeper ? 0.45 : 0.6);
        if (head && p.vy > 1) { b.vx += s * 3.5; b.vy += 1.5; }
        // un ballon bas qui arrive doucement contre le bas de la tête est amorti aussi
        else if (head && head < 7 && p.ground && p.kickT <= 0 && b.y < 1.0) { b.vx = p.vx + Math.sign(b.x - p.x || s) * 0.8; b.vy = Math.min(b.vy, 1.2); if (w.frame - p.trapAt > 30) { p.trapAt = w.frame; ev.push({ t: 'trap', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); } }
        if (foot || head) w.touch = p.id;
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
  function hit(w, p, b, th, f, env, ev) {
    const v = kickVel(p, b, th, f), d = Math.hypot(b.x - f.x, b.y - f.y) || 1;
    b.x = f.x + ((b.x - f.x) / d) * (LEG.foot + env.r); b.y = Math.max(env.r, f.y + ((b.y - f.y) / d) * (LEG.foot + env.r));
    b.vx = v.vx; b.vy = v.vy;
    if (b.y <= env.r + 0.01 && b.vy < 0) b.vy = -b.vy * 0.5;
    p.kicked = true; p.kind = v.kind;
    if (v.kind === 'feu') { p.power = null; p.powerT = 0; b.fire = 2.2; }
    if (v.kind === 'tornade') { p.power = null; p.powerT = 0; b.zig = 1.6; b.zph = 0; }
    w.touch = p.id;
    ev.push({ t: 'kick', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), p: +v.pw.toFixed(1), kind: v.kind, perfect: v.perfect, fire: v.kind === 'feu' });
  }

  // entries : [{ id, char, side? }] (sans side : 0 puis 1) ; opts : { mode, stade, bonus, seed }
  function world(entries, opts = {}) {
    const w = { frame: 0, opts: { mode: 'normal', stade: 'nuit', bonus: false, ...opts }, players: entries.map((e, k) => player(e.id, e.char, e.side ?? k)), balls: [], items: [], itemIn: 420, itemId: 0, walls: [0, 0], shrink: [0, 0], ballMod: null, wind: 0, goalH: [F.GH, F.GH], seed: opts.seed || 12345, touch: null };
    kickoff(w);
    return w;
  }
  // Coup d'envoi : chacun dans son camp (le second d'une équipe plus en retrait), les ballons tombent au centre.
  function kickoff(w) {
    for (const side of [0, 1]) w.players.filter(p => p.side === side).forEach((p, k) => Object.assign(p, { x: (side ? 1 : -1) * (k ? 7.5 : 4.5), y: 0, vx: 0, vy: 0, ground: true, perch: 0, kickT: 0, queued: 0, frozen: 0 }));
    const n = w.opts.mode === 'multi' ? 3 : 1;
    w.balls = [[0, 4], [-2.4, 5.5], [2.4, 5.5]].slice(0, n).map(([x, y]) => ({ x, y, vx: 0, vy: 0, fire: 0, zig: 0 }));
    w.touch = null;
  }

  const KEYS = ['x', 'y', 'vx', 'vy', 'ground', 'perch', 'jumps', 'kickT', 'kickCd', 'kicked', 'lob', 'queued', 'kind', 'frozen', 'mini', 'big', 'fast', 'keeper', 'gauge', 'power', 'powerT', 'sta', 'tired', 'sprint', 'prevIn'];
  const pack = p => { const o = { id: p.id, char: p.char, side: p.side }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => [b.x, b.y, b.vx, b.vy].map(v => Math.round(v * 1000) / 1000).concat([b.fire > 0 ? 1 : 0, b.zig > 0 ? 1 : 0]);
  const unpackBall = a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], fire: a[4] ? 1 : 0, zig: a[5] ? 1 : 0 });

  return { FPS, DT, IN, F, WALL, BALL, NECK, LEG, SPRINT, CHARS, CHAR_IDS, POWERS, ITEMS, ITEM_IDS, ACCS, MODES, STADES, envOf, dirOf, player, step, stepBall, stepWorld, world, kickoff, baseR, headR, headY, legAngle, footPos, kickVel, bestReach, goalHeights, pack, packBall, unpackBall };
});
