// Robots du Strategy Club : une seule recherche (négamax alpha-bêta, approfondissement progressif, prises en fin de ligne)
// pour tous les jeux qui exposent moves / play / evaluate ; le go passe par ses coups candidats.
(function (root, factory) {
  const ai = factory();
  if (typeof module === 'object' && module.exports) module.exports = ai;
  else root.StrategyAI = ai;
})(this, function () {
  // noise : bruit ajouté au score de chaque coup ; blunder : part de coups joués au hasard.
  const LEVELS = {
    debutant: { label: 'Débutant', depth: 1, qs: false, noise: 220, blunder: 0.35, time: 400, cand: 24, goDepth: 1 },
    facile: { label: 'Facile', depth: 1, qs: true, noise: 70, blunder: 0.08, time: 800, cand: 8, goDepth: 1 },
    intermediaire: { label: 'Intermédiaire', depth: 2, qs: true, noise: 25, blunder: 0, time: 1500, cand: 10, goDepth: 1 },
    difficile: { label: 'Difficile', depth: 3, qs: true, noise: 8, blunder: 0, time: 2500, cand: 12, goDepth: 2, mc: 1500 },
    expert: { label: 'Expert', depth: 12, qs: true, noise: 0, blunder: 0, time: 4000, cand: 16, goDepth: 2, mc: 3500 },
  };
  const MATE = 1e6, TIMEOUT = {};

  function choose(game, state, levelId, rng = Math.random) {
    const level = LEVELS[levelId] || LEVELS.intermediaire;
    if (game.candidates) return chooseGo(game, state, level, rng);
    const legal = game.moves(state);
    if (legal.length <= 1) return legal[0];
    if (rng() < level.blunder) return legal[Math.floor(rng() * legal.length)];

    const deadline = Date.now() + level.time;
    let nodes = 0;
    const tick = () => { if ((++nodes & 1023) === 0 && Date.now() > deadline) throw TIMEOUT; };
    const sorted = list => list.sort((a, b) => (game.order ? game.order(b) - game.order(a) : 0));

    function quiesce(s, alpha, beta, qd) {
      tick();
      // En échec : toutes les parades sont examinées (et le mat est vu). Sinon, les prises seules.
      const check = qd < 4 && game.inCheck?.(s);
      const list = check || !game.captures ? game.moves(s) : game.captures(s);
      if (!list.length && (check || !game.captures)) return game.terminal(s) * MATE;
      const caps = check ? list : game.captures ? list : list.filter(game.isCapture);
      const forced = check || (game.forcedCaptures && caps.length); // en échec, ou prise disponible aux dames : pas d'attente possible
      let best = forced ? -Infinity : game.evaluate(s);
      if (!forced) {
        if (best >= beta || qd >= 6 || !caps.length) return best;
        alpha = Math.max(alpha, best);
      } else if (qd >= 8) return game.evaluate(s);
      for (const m of sorted(caps)) {
        const v = -quiesce(game.play(s, m), -beta, -alpha, qd + 1);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }
    function negamax(s, depth, alpha, beta, ply) {
      tick();
      if (game.repeated?.(s)) return 0; // tourner en rond = nulle : à éviter quand on gagne, à chercher quand on perd
      if (depth <= 0) return level.qs ? quiesce(s, alpha, beta, 0) : game.evaluate(s);
      const list = game.moves(s);
      if (!list.length) { const t = game.terminal(s); return t ? t * (MATE - ply) : 0; }
      let best = -Infinity;
      for (const m of sorted(list)) {
        const v = -negamax(game.play(s, m), depth - 1, -beta, -alpha, ply + 1);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    // Approfondissement progressif : on garde le résultat de la dernière profondeur terminée à temps.
    let root = sorted(legal.slice()), choice = root[0];
    try {
      for (let depth = 1; depth <= level.depth; depth++) {
        const scored = [];
        let alpha = -Infinity;
        for (const m of root) {
          // Avec du bruit, chaque coup doit avoir un vrai score (fenêtre complète) ; sinon l'alpha-bêta suffit.
          const v = -negamax(game.play(state, m), depth - 1, -Infinity, level.noise ? Infinity : -alpha, 1);
          scored.push({ m, v: v + (rng() * 2 - 1) * level.noise });
          if (v > alpha) alpha = v;
        }
        scored.sort((a, b) => b.v - a.v);
        choice = scored[0].m;
        root = scored.map(x => x.m); // le meilleur coup est cherché en premier à la profondeur suivante
        if (scored[0].v > MATE / 2) break; // mat trouvé
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
    }
    return choice;
  }

  // Go : on ne regarde que les meilleurs candidats, évalués par l'influence (1 ou 2 coups d'avance).
  function chooseGo(game, s, level, rng) {
    const pass = game.moves(s).at(-1);
    // L'adversaire a passé et on mène : on passe aussi pour finir la partie.
    if (s.passes > 0 && game.score(s).winner === s.turn) return pass;
    if (s.count > s.n * s.n * 1.3) return pass;
    const cands = game.candidates(s, level.cand);
    if (!cands.length) return pass;
    if (level.mc) return monteCarlo(game, s, cands, pass, level, rng);
    const look = (st, depth) => {
      if (depth <= 1) return game.evaluate(st);
      let best = -Infinity;
      for (const c of game.candidates(st, 6)) best = Math.max(best, -game.evaluate(game.play(st, c)));
      return best === -Infinity ? game.evaluate(st) : best;
    };
    let best = null;
    for (const c of cands) {
      const v = -look(game.play(s, c), level.goDepth) + c.h * 4 + (rng() * 2 - 1) * level.noise;
      if (!best || v > best.v) best = { c, v };
    }
    if (rng() < level.blunder) best = { c: cands[Math.floor(rng() * cands.length)] };
    // Plus rien d'utile à jouer (aucune prise, aucun gain) en fin de partie : passer.
    const passValue = -game.evaluate(game.play(s, pass));
    if (s.count > s.n * s.n * 0.5 && best.v !== undefined && best.v - best.c.h * 4 <= passValue && best.c.h <= 0) return pass;
    return best.c;
  }

  // Monte-Carlo à plat : chaque candidat (et la passe en fin de partie) reçoit des parties aléatoires,
  // réparties par UCB1 vers les plus prometteurs ; on joue celui qui a été le plus exploré.
  function monteCarlo(game, s, cands, pass, level, rng) {
    const options = cands.slice();
    if (s.count > s.n * s.n * 0.4) options.push({ ...pass, h: -5 });
    const stats = options.map(c => ({ c, next: game.play(s, c), w: 0, n: 0 }));
    const end = Date.now() + level.mc;
    let total = 0;
    while (Date.now() < end) {
      for (let k = 0; k < 16; k++) {
        let pick = stats[0], bestV = -Infinity;
        for (const st of stats) {
          const v = st.n ? st.w / st.n + 0.8 * Math.sqrt(Math.log(total + 1) / st.n) : 100 + st.c.h;
          if (v > bestV) { bestV = v; pick = st; }
        }
        pick.w += 1 - game.playout(pick.next, rng); // la partie aléatoire est gagnée par l'adversaire, ou par nous
        pick.n++;
        total++;
      }
    }
    stats.sort((a, b) => b.n - a.n);
    return stats[0].c;
  }

  return { LEVELS, choose };
});
