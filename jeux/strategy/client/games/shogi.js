// Shogi : règles traditionnelles (parachutages, promotion facultative ou forcée, nifu, uchifuzume,
// sennichite avec échec perpétuel perdant, mat = victoire, plus aucun coup = défaite).
(function (root, factory) {
  const game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  else (root.StrategyGames = root.StrategyGames || {})[game.id] = game;
})(this, function () {
  // Case = ligne * 9 + colonne, ligne 0 en haut (camp gote). Colonne 0 = colonne 9 de la notation.
  // Pièces : majuscule = sente (en bas, joue en premier), minuscule = gote ; « + » devant = promue.
  const N = 9, RANKS = 'abcdefghi';
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const GOLD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]];
  const MOVES = { // vu de sente (avancer = ligne - 1)
    P: { steps: [[-1, 0]] }, L: { slides: [[-1, 0]] }, N: { steps: [[-2, -1], [-2, 1]] },
    S: { steps: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]] }, G: { steps: GOLD },
    K: { steps: ORTH.concat(DIAG) }, B: { slides: DIAG }, R: { slides: ORTH },
    '+P': { steps: GOLD }, '+L': { steps: GOLD }, '+N': { steps: GOLD }, '+S': { steps: GOLD },
    '+B': { slides: DIAG, steps: ORTH }, '+R': { slides: ORTH, steps: DIAG },
  };
  const HAND = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  const VALUE = { P: 100, L: 300, N: 350, S: 450, G: 500, B: 800, R: 1000, K: 0, '+P': 420, '+L': 450, '+N': 450, '+S': 500, '+B': 1100, '+R': 1300 };
  const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const sideOf = p => (p ? (p === p.toUpperCase() ? 0 : 1) : -1);
  const kind = p => p.toUpperCase(); // « +p » -> « +P »
  const base = p => p.replace('+', '').toUpperCase();
  const own = (side, k) => (side === 0 ? k : k.toLowerCase());
  const sqName = sq => `${N - (sq % N)}${RANKS[Math.floor(sq / N)]}`;
  const lastRows = (side, n) => r => (side === 0 ? r < n : r > N - 1 - n);
  const inZone = (side, sq) => lastRows(side, 3)(Math.floor(sq / N));

  function init() {
    const b = Array(N * N).fill('');
    'lnsgkgsnl'.split('').forEach((p, c) => { b[c] = p; b[8 * N + c] = p.toUpperCase(); });
    for (let c = 0; c < N; c++) { b[2 * N + c] = 'p'; b[6 * N + c] = 'P'; }
    b[N + 1] = 'r'; b[N + 7] = 'b'; b[7 * N + 1] = 'B'; b[7 * N + 7] = 'R';
    const s = { b, hands: [{}, {}], turn: 0, hist: null };
    s.hist = { k: posKey(s), t: 0, chk: false, prev: null };
    return s;
  }
  const posKey = s => `${s.b.join(',')}|${JSON.stringify(s.hands)}|${s.turn}`;

  // La pièce en « from » attaque-t-elle « to » ?
  function hits(b, from, to) {
    const p = b[from], side = sideOf(p), f = side === 0 ? 1 : -1, mv = MOVES[kind(p)];
    const dr = Math.floor(to / N) - Math.floor(from / N), dc = (to % N) - (from % N);
    for (const [r, c] of mv.steps || []) if (r * f === dr && c === dc) return true;
    for (const [r, c] of mv.slides || []) {
      const sr = r * f;
      const k = sr ? dr / sr : dc / c;
      if (!(k >= 1) || k !== Math.floor(k) || sr * k !== dr || c * k !== dc) continue;
      let clear = true;
      for (let i = 1; i < k && clear; i++) if (b[from + (sr * i) * N + c * i]) clear = false;
      if (clear) return true;
    }
    return false;
  }
  function attacked(b, sq, by) {
    for (let i = 0; i < N * N; i++) if (b[i] && sideOf(b[i]) === by && hits(b, i, sq)) return true;
    return false;
  }
  const inCheck = (s, side = s.turn) => attacked(s.b, s.b.indexOf(own(side, 'K')), 1 - side);

  function pseudo(s, capturesOnly) {
    const { b, turn } = s, out = [], f = turn === 0 ? 1 : -1;
    const dead = (t, sq) => { const r = Math.floor(sq / N); return ((t === 'P' || t === 'L') && lastRows(turn, 1)(r)) || (t === 'N' && lastRows(turn, 2)(r)); };
    const add = (from, to) => {
      const p = b[from], t = kind(p), can = t.length === 1 && 'PLNSBR'.includes(t) && (inZone(turn, from) || inZone(turn, to));
      const m = { from, to, piece: p, cap: b[to] || null };
      if (can) out.push({ ...m, promo: true });
      if (!can || !dead(t, to)) out.push(m); // pion, lance, cavalier sans coup possible ensuite : promotion forcée
    };
    for (let sq = 0; sq < N * N; sq++) {
      const p = b[sq];
      if (sideOf(p) !== turn) continue;
      const r = Math.floor(sq / N), c = sq % N, mv = MOVES[kind(p)];
      for (const [dr, dc] of mv.steps || []) {
        const rr = r + dr * f, cc = c + dc;
        if (inside(rr, cc) && sideOf(b[rr * N + cc]) !== turn) add(sq, rr * N + cc);
      }
      for (const [dr, dc] of mv.slides || []) {
        let rr = r + dr * f, cc = c + dc;
        while (inside(rr, cc) && sideOf(b[rr * N + cc]) !== turn) {
          add(sq, rr * N + cc);
          if (b[rr * N + cc]) break;
          rr += dr * f; cc += dc;
        }
      }
    }
    const hand = capturesOnly ? {} : s.hands[turn];
    for (const t of HAND) {
      if (!hand[t]) continue;
      for (let to = 0; to < N * N; to++) {
        if (b[to] || dead(t, to)) continue;
        if (t === 'P') { // nifu : pas deux pions non promus du même camp sur une colonne
          let twin = false;
          for (let r = 0; r < N; r++) if (b[r * N + (to % N)] === own(turn, 'P')) twin = true;
          if (twin) continue;
        }
        out.push({ drop: t, to, piece: own(turn, t), cap: null });
      }
    }
    for (const m of out) m.key = m.drop ? `${m.drop}*${sqName(m.to)}` : `${sqName(m.from)}${sqName(m.to)}${m.promo ? '+' : ''}`;
    return out;
  }

  function play(s, m) {
    const b = s.b.slice(), hands = [{ ...s.hands[0] }, { ...s.hands[1] }], turn = s.turn;
    if (m.drop) {
      hands[turn][m.drop]--;
      if (!hands[turn][m.drop]) delete hands[turn][m.drop];
      b[m.to] = m.piece;
    } else {
      if (m.cap) { const t = base(m.cap); hands[turn][t] = (hands[turn][t] || 0) + 1; }
      b[m.to] = m.promo ? '+' + m.piece : m.piece;
      b[m.from] = '';
    }
    const n = { b, hands, turn: 1 - turn, hist: null };
    n.hist = { k: posKey(n), t: n.turn, chk: null, prev: s.hist };
    return n;
  }

  // nested : appel interne pour savoir s'il reste un coup (on n'y vérifie pas l'uchifuzume).
  function moves(s, nested) {
    return pseudo(s).filter(m => {
      const n = play(s, m);
      if (inCheck(n, s.turn)) return false;
      // uchifuzume : parachuter un pion qui fait mat est interdit
      if (!nested && m.drop === 'P' && inCheck(n) && !moves(n, true).length) return false;
      return true;
    });
  }

  function repetitionResult(s) {
    let count = 0;
    const span = [];
    for (let h = s.hist; h; h = h.prev) {
      span.push(h);
      if (h.k === s.hist.k && ++count === 4) break;
    }
    if (count < 4) return null;
    // Échec perpétuel : si un camp a été en échec à chaque fois qu'il devait jouer, celui qui donnait l'échec perd.
    for (const side of [0, 1]) {
      const mine = span.filter(h => h.t === side);
      if (mine.length && mine.every(h => h.chk)) return { winner: side, reason: 'Échec perpétuel (sennichite)' };
    }
    return { winner: null, reason: 'Sennichite (quadruple répétition)' };
  }

  function over(s, legal = moves(s)) {
    if (s.hist.chk === null) s.hist.chk = inCheck(s);
    if (!legal.length) return { winner: 1 - s.turn, reason: inCheck(s) ? 'Tsumi (échec et mat)' : 'Plus aucun coup possible' };
    return repetitionResult(s);
  }

  const LETTER = p => (p[0] === '+' ? '+' : '') + base(p);
  function notation(s, m) {
    if (m.drop) return `${m.drop}*${sqName(m.to)}`;
    const twins = moves(s).filter(o => !o.drop && o.piece === m.piece && o.to === m.to && o.from !== m.from);
    const promoChoice = moves(s).some(o => o.from === m.from && o.to === m.to && !!o.promo !== !!m.promo);
    return `${LETTER(m.piece)}${twins.length ? sqName(m.from) : ''}${m.cap ? 'x' : '-'}${sqName(m.to)}${m.promo ? '+' : promoChoice ? '=' : ''}`;
  }

  function evaluate(s) {
    let score = 0;
    for (let sq = 0; sq < N * N; sq++) {
      const p = s.b[sq];
      if (!p) continue;
      const side = sideOf(p), t = kind(p), r = Math.floor(sq / N);
      let v = VALUE[t];
      if (t === 'P' || t === 'S' || t === 'N') v += (side === 0 ? 8 - r : r) * 3; // avancer
      score += side === 0 ? v : -v;
    }
    for (const side of [0, 1]) for (const [t, n] of Object.entries(s.hands[side])) score += (side === 0 ? 1 : -1) * n * VALUE[t] * 1.15;
    return s.turn === 0 ? score : -score;
  }

  // Pour les robots : la position est-elle déjà apparue récemment ? (elle mène alors à la nulle)
  function repeated(s) {
    let n = 0;
    for (let h = s.hist?.prev; h && n < 16; h = h.prev, n++) if (h.k === s.hist.k) return true;
    return false;
  }

  return {
    repeated,
    id: 'shogi', name: 'Shogi', sides: ['Sente ☗', 'Gote ☖'], size: N,
    init, moves, play, over, notation, evaluate, inCheck, sqName, HAND, VALUE,
    captures: s => pseudo(s, true).filter(m => (m.cap || m.promo) && !inCheck(play(s, m), s.turn)),
    order: m => (m.cap ? 10 * VALUE[kind(m.cap)] - VALUE[kind(m.piece)] : 0) + (m.promo ? 300 : 0) - (m.drop ? 5 : 0),
    terminal: () => -1, // sans coup légal : perdu
    isCapture: m => !!m.cap || !!m.promo,
  };
});
