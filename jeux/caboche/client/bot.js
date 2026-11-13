// Caboche Cup : le robot, partagé par le serveur (salons) et le navigateur (tournoi, survie, défis).
// Script classique : window.CCBot ou require ; il a besoin de la physique (window.CC ou ./sim).
// Il choisit le ballon le plus menaçant, repasse du bon côté (en sautant par-dessus le ballon ou l'adversaire),
// simule son tir avant de frapper (si l'adversaire le renverrait, il change de geste), anticipe les têtes,
// sprinte quand il est loin, tacle parfois, ramasse les bonus proches et sort son pouvoir au bon moment.
// En 2 contre 2, le plus proche du ballon attaque et l'autre garde le but. Le niveau (1 à 3) règle réaction et justesse.
(function (root, factory) {
  const CC = typeof module === 'object' && module.exports ? require('./sim') : root.CC;
  const B = factory(CC);
  if (typeof module === 'object' && module.exports) module.exports = B;
  else root.CCBot = B;
})(this, CC => {
  const { IN, F } = CC;

  // Où irait ce ballon si p tirait maintenant avec la vitesse vx : 'but', 'contre' (renvoyé par un adversaire) ou 'ok'.
  function shot(w, p, ball, vx) {
    const b = { ...ball }, s = CC.dirOf(p), [, deg, pw] = CC.kickOf({ ...p, vx, sprint: p.sprint && vx * s > 0 }, b), an = (deg * Math.PI) / 180, env = CC.envOf(w.opts);
    b.vx = s * Math.cos(an) * pw; b.vy = Math.sin(an) * pw;
    const foes = w.players.filter(o => o.side !== p.side), ev = [];
    for (let k = 0; k < 360; k++) {
      CC.stepBall(w, b, ev, CC.DT / 2, env);
      for (const o of foes) if (Math.hypot(b.x - o.x, b.y - CC.headY(o)) < CC.headR(o) + env.r + 0.1 || Math.hypot(b.x - o.x, b.y - CC.bodyY(o)) < CC.bodyR(o) + env.r + 0.1) return 'contre';
      if (Math.abs(b.x) > F.HL + env.r && b.y < (w.goalH?.[b.x > 0 ? 1 : 0] ?? F.GH)) return Math.sign(b.x) === s ? 'but' : 'contre';
    }
    return 'ok';
  }

  // Touches du robot p pour cette image. br : sa mémoire (créée par l'appelant, un objet vide au départ).
  function think(w, p, lvl, rng, br) {
    if (w.frame < (br.next ?? 0)) return (br.bits ?? 0) & ~(IN.KICK | IN.JUMP | IN.TACKLE | IN.POWER);
    br.next = w.frame + [12, 7, 3][lvl - 1] + Math.floor(rng() * 4);
    const s = CC.dirOf(p), own = -s * F.HL, foes = w.players.filter(o => o.side !== p.side), mates = w.players.filter(o => o.side === p.side && o !== p);
    // le ballon à surveiller : le plus proche de mon but s'il y file, sinon le plus proche de moi
    const b = [...w.balls].sort((a, c) => {
      const da = Math.abs(a.x - own) - (a.vx * -s > 3 ? 6 : 0), dc = Math.abs(c.x - own) - (c.vx * -s > 3 ? 6 : 0);
      return w.balls.length > 1 ? da - dc + (Math.abs(a.x - p.x) - Math.abs(c.x - p.x)) * 0.5 : 0;
    })[0];
    const o = foes.sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
    // en équipe : le plus proche du ballon attaque, l'autre garde le but
    const keeper = mates.length && mates.some(m => Math.abs(m.x - b.x) < Math.abs(p.x - b.x) - 0.5);
    const look = [0.1, 0.2, 0.3][lvl - 1], bx = b.x + b.vx * look;
    const ahead = (bx - p.x) * s > 0.15; // le ballon est devant moi (vers le but adverse)
    let tx = bx - s * (ahead ? 0.55 : 0.9);
    if (keeper && (b.x - own) * s > 4) tx = own + s * 2.5; // gardien : reste devant son but tant que le ballon est loin
    // un bonus tout près, et pas de danger : on va le chercher
    const item = w.items?.find(it => it.y < 2.5 && Math.abs(it.x - p.x) < 3);
    if (item && !(b.vx * -s > 4 && Math.abs(b.x - own) < 8) && lvl > 1) tx = item.x;
    let bits = 0;
    if (tx > p.x + 0.2) bits |= IN.R; else if (tx < p.x - 0.2) bits |= IN.L;
    if (Math.abs(tx - p.x) > 3.5 && p.sta > 0.4 && lvl > 1) bits |= IN.SPRINT;
    const dist = Math.hypot(b.x - p.x - s * 0.5, b.y - p.y - 0.35);
    // repasser derrière le ballon : sauter par-dessus plutôt que le pousser vers mon but
    if (!ahead && Math.abs(b.x - p.x) < 1.6 && b.y < 1.2 && p.ground) bits |= IN.JUMP;
    // ballon à hauteur de tête qui file vers mon but : ne pas le rattraper par-derrière
    if (!ahead && b.vx * s < -2 && b.y > 1 && b.y < 3.4 && Math.abs(b.x - p.x) < 2.2) bits &= ~(IN.L | IN.R | IN.SPRINT);
    // tirer : le robot essaie le tir dans sa tête ; si l'adversaire le renverrait, il change de geste (piqué, lob)
    if (ahead && dist < 1.3) {
      const now = shot(w, p, b, p.vx), still = shot(w, p, b, 0), back = shot(w, p, b, -s * 3);
      if (dist < 0.95 && now !== 'contre' && rng() < [0.45, 0.75, 0.95][lvl - 1]) bits |= IN.KICK;
      else if (now === 'contre' && still === 'contre' && back === 'contre' && dist < 0.95 && (br.stuck = (br.stuck ?? 0) + 1) > 6) { br.stuck = 0; bits = IN.KICK; } // rien ne passe : tenter quand même
      else if (now === 'contre') bits = (bits & ~(IN.L | IN.R | IN.SPRINT)) | (still !== 'contre' ? 0 : back !== 'contre' ? (s > 0 ? IN.L : IN.R) : 0);
    }
    // tête : là où sera le ballon dans un quart de seconde, ou quand il arrivera sur moi
    const hx = b.x + b.vx * 0.25, hy = b.y + b.vy * 0.25 - 0.47;
    if (hy > 1.9 && hy < 4.2 && (hx - p.x) * s > 0.15 && (hx - p.x) * s < 1.3 && p.ground && rng() < [0.3, 0.55, 0.8][lvl - 1]) bits |= IN.JUMP;
    const tt = b.vx ? (p.x - b.x) / b.vx : -1, yt = b.y + b.vy * tt - 7.5 * tt * tt;
    if (tt > 0.05 && tt < 0.4 && yt > 1.7 && yt < 3.9 && p.ground && rng() < [0.35, 0.6, 0.85][lvl - 1]) bits |= IN.JUMP;
    // l'adversaire barre le chemin : lui sauter par-dessus
    const go = bits & IN.R ? 1 : bits & IN.L ? -1 : 0;
    if (go && o && o.y < 0.5 && (o.x - p.x) * go > 0 && (o.x - p.x) * go < 1.3 && p.ground) bits |= IN.JUMP;
    if (o && o.stun <= 0 && o.y < 0.5 && (o.x - p.x) * s > 0 && (o.x - p.x) * s < 2 && Math.abs(b.x - o.x) < 1.2 && rng() < [0.04, 0.1, 0.18][lvl - 1]) bits = IN.TACKLE | (s > 0 ? IN.R : IN.L);
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
