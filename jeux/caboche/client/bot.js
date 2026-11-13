// Caboche Cup : le robot, partagé par le serveur (salons) et le navigateur (tournoi, survie, défis).
// Script classique : window.CCBot ou require ; il a besoin de la physique (window.CC ou ./sim).
// Il choisit le ballon le plus menaçant, se place derrière lui (en sautant par-dessus le ballon ou l'adversaire),
// simule son tir avant de frapper (si l'adversaire le renverrait, il tente le lob ou attend), anticipe les têtes,
// sprinte quand il est loin, ramasse les bonus proches et sort son pouvoir au bon moment.
// En 2 contre 2, le plus proche du ballon attaque et l'autre garde le but. Le niveau (1 à 3) règle réaction et justesse.
(function (root, factory) {
  const CC = typeof module === 'object' && module.exports ? require('./sim') : root.CC;
  const B = factory(CC);
  if (typeof module === 'object' && module.exports) module.exports = B;
  else root.CCBot = B;
})(this, CC => {
  const { IN, F, LEG } = CC;

  // Où irait ce ballon si p le frappait maintenant (lob ou non) : 'but', 'contre' (renvoyé par un adversaire) ou 'ok'.
  function shot(w, p, ball, lob) {
    const reach = CC.bestReach(p, ball), env = CC.envOf(w.opts);
    const v = CC.kickVel({ ...p, lob }, ball, reach.th, reach.f), b = { ...ball, vx: v.vx, vy: v.vy };
    const foes = w.players.filter(o => o.side !== p.side), ev = [], s = CC.dirOf(p);
    for (let k = 0; k < 360; k++) {
      CC.stepBall(w, b, ev, CC.DT / 2, env);
      for (const o of foes) if (Math.hypot(b.x - o.x, b.y - CC.headY(o)) < CC.headR(o) + env.r + 0.1) return 'contre';
      if (Math.abs(b.x) > F.HL + env.r && b.y < (w.goalH?.[b.x > 0 ? 1 : 0] ?? F.GH)) return Math.sign(b.x) === s ? 'but' : 'contre';
    }
    return 'ok';
  }

  // Touches du robot p pour cette image. br : sa mémoire (créée par l'appelant, un objet vide au départ).
  function think(w, p, lvl, rng, br) {
    if (w.frame < (br.next ?? 0)) return (br.bits ?? 0) & ~(IN.KICK | IN.LOB | IN.JUMP | IN.POWER);
    br.next = w.frame + [9, 6, 3][lvl - 1] + Math.floor(rng() * 4);
    const s = CC.dirOf(p), own = -s * F.HL, foes = w.players.filter(o => o.side !== p.side), mates = w.players.filter(o => o.side === p.side && o !== p);
    // le ballon à surveiller : le plus proche de mon but s'il y file, sinon le plus proche de moi
    const b = [...w.balls].sort((a, c) => {
      const da = Math.abs(a.x - own) - (a.vx * -s > 3 ? 6 : 0), dc = Math.abs(c.x - own) - (c.vx * -s > 3 ? 6 : 0);
      return w.balls.length > 1 ? da - dc + (Math.abs(a.x - p.x) - Math.abs(c.x - p.x)) * 0.5 : 0;
    })[0];
    const o = [...foes].sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
    const keeper = mates.length && mates.some(m => Math.abs(m.x - b.x) < Math.abs(p.x - b.x) - 0.5);
    const look = [0.1, 0.2, 0.3][lvl - 1], bx = b.x + b.vx * look;
    const ahead = (bx - p.x) * s > 0.3; // le ballon est devant moi (vers le but adverse)
    const R = CC.baseR(p);
    let tx = bx - s * (ahead ? R + 0.4 : R + 1.0); // juste au contact : le pied frappe au bout de la jambe
    if (keeper && (b.x - own) * s > 4) tx = own + s * 2.5; // gardien : reste devant son but tant que le ballon est loin
    const item = w.items?.find(it => it.y < 2.5 && Math.abs(it.x - p.x) < 3);
    if (item && !(b.vx * -s > 4 && Math.abs(b.x - own) < 8) && lvl > 1) tx = item.x;
    let bits = 0;
    if (tx > p.x + 0.2) bits |= IN.R; else if (tx < p.x - 0.2) bits |= IN.L;
    if (Math.abs(tx - p.x) > 3.5 && p.sta > 0.4 && lvl > 1) bits |= IN.SPRINT;
    // repasser derrière le ballon : sauter par-dessus plutôt que le pousser vers mon but
    if (!ahead && Math.abs(b.x - p.x) < R + 1.2 && b.y < 1.2 && (p.ground || p.perch)) bits |= IN.JUMP;
    // ballon entre moi et mon but, tout près, à hauteur de tête : ne pas foncer dedans (ma tête le pousserait vers mon but),
    // reculer pour lui laisser la place de retomber
    if (!ahead && b.y > 1 && b.y < 2 * R + CC.NECK + 0.6 && Math.abs(b.x - p.x) < R + 1.4) bits = (bits & ~(IN.L | IN.R | IN.SPRINT)) | (b.vx * s < -2 ? 0 : s > 0 ? IN.R : IN.L);
    // frapper : le ballon est à portée de la jambe ; on essaie le tir, sinon le lob, sinon on attend un peu
    const reach = CC.bestReach(p, b);
    if (ahead && reach.d < LEG.foot + 0.34 + 0.15 && p.kickCd <= 0) {
      const drive = shot(w, p, b, false), lob = drive === 'contre' ? shot(w, p, b, true) : 'ok';
      if (rng() < [0.45, 0.75, 0.95][lvl - 1]) {
        if (drive !== 'contre') bits |= IN.KICK;
        else if (lob !== 'contre') bits |= IN.LOB;
        else if ((br.stuck = (br.stuck ?? 0) + 1) > 6) { br.stuck = 0; bits |= rng() < 0.5 ? IN.LOB : IN.KICK; } // rien ne passe : tenter quand même
      }
    }
    // tête : là où sera le ballon dans un quart de seconde, ou quand il arrivera sur moi
    const top = CC.NECK + 2 * R, hx = b.x + b.vx * 0.25, hy = b.y + b.vy * 0.25 - 0.47;
    const canJump = p.ground || p.perch > 0;
    if (hy > top * 0.8 && hy < top + 2 && (hx - p.x) * s > 0.1 && (hx - p.x) * s < 1.2 && canJump && rng() < [0.3, 0.55, 0.8][lvl - 1]) bits |= IN.JUMP;
    const tt = b.vx ? (p.x - b.x) / b.vx : -1, yt = b.y + b.vy * tt - 7.5 * tt * tt;
    if (tt > 0.05 && tt < 0.4 && yt > top * 0.85 && yt < top + 2.2 && canJump && rng() < [0.35, 0.6, 0.85][lvl - 1]) bits |= IN.JUMP;
    // l'adversaire barre le chemin : lui sauter par-dessus
    const go = bits & IN.R ? 1 : bits & IN.L ? -1 : 0;
    if (go && o && o.y < 0.5 && (o.x - p.x) * go > 0 && (o.x - p.x) * go < R + CC.baseR(o) + 0.4 && canJump) bits |= IN.JUMP;
    // pouvoir, au bon moment selon le personnage
    if (p.gauge >= 1 && rng() < 0.35) {
      const pw = CC.CHARS[p.char]?.power, near = Math.abs(b.x - p.x) < 3;
      const danger = b.vx * -s > 4 && (b.x - own) * s < 7;
      if ({ super: ahead && near, tornade: ahead && near, tete: near && b.y > 1.5, ressort: near && b.y > 2, aimant: near && b.y < 1.2, gel: o && Math.abs(o.x - b.x) < 2.5, mini: o && Math.abs(o.x - b.x) < 3, mur: danger }[pw]) bits |= IN.POWER;
    }
    br.bits = bits;
    return bits;
  }

  return { think, shot };
});
