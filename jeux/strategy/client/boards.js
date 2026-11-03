// Dessin des plateaux du Strategy Club : grilles à cases (échecs, dames, shogi) et goban (go),
// pièces, cases jouables, déplacements animés et animation d'apparition propre à chaque jeu.
const G = window.StrategyGames;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const VS = '︎'; // force le dessin « texte » des symboles d'échecs (pas d'émoji)

const CHESS = {
  classique: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  contour: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  lettres: { k: 'R', q: 'D', r: 'T', b: 'F', n: 'C', p: 'p' },
};
const KANJI = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩', '+R': '龍', '+B': '馬', '+S': '全', '+N': '圭', '+L': '杏', '+P': 'と' };
const KANJI_NUM = '一二三四五六七八九';
export const kanji = (t, side) => (t === 'K' && side === 1 ? '王' : KANJI[t]);

const sizeOf = (gameId, st) => (gameId === 'go' ? st.n : G[gameId].size);
const sideOfPiece = (gameId, p) => {
  if (!p) return -1;
  if (gameId === 'draughts') return p.toLowerCase() === 'w' ? 0 : 1;
  return p === p.toUpperCase() ? 0 : 1;
};

// Pièce dessinée à la case (r, c) affichée ; extra : classes en plus, d : délai d'animation.
function pieceHTML(gameId, p, r, c, { extra = '', d = 0, look, bottom } = {}) {
  const side = sideOfPiece(gameId, p), pos = `style="--r:${r};--c:${c};--d:${d}ms"`;
  if (gameId === 'chess') {
    const t = p.toLowerCase();
    return `<div class="pc chess ${side ? 'b' : 'w'} ${extra}" ${pos}><span>${CHESS[look.pieces]?.[t] ?? CHESS.classique[t]}${VS}</span></div>`;
  }
  if (gameId === 'draughts') {
    const king = p === 'W' || p === 'B';
    return `<div class="pc dr ${side ? 'b' : 'w'}${king ? ' king' : ''} ${extra}" ${pos}><i></i></div>`;
  }
  const t = p.toUpperCase(), promoted = t[0] === '+';
  // La forme et le sens de la pièce sont sur l'enfant : le parent garde son transform libre pour l'animation du coup.
  return `<div class="pc sg${side !== bottom ? ' up' : ''}${promoted ? ' pro' : ''} ${extra}" ${pos}><span>${kanji(t, side)}</span></div>`;
}

/* ---------- Grilles à cases ---------- */
function gridBoard(el, gameId, handlers) {
  const n = G[gameId].size;
  el.className = `board grid ${gameId}`;
  el.style.setProperty('--n', n);
  el.innerHTML = `<div class="squares"></div><div class="pieces"></div>`;
  const squares = el.querySelector('.squares'), pieces = el.querySelector('.pieces');
  let flip = false;
  const disp = i => { const r = Math.floor(i / n), c = i % n; return flip ? [n - 1 - r, n - 1 - c] : [r, c]; };
  squares.onclick = e => { const sq = e.target.closest('[data-i]'); if (sq) handlers.onSquare?.(+sq.dataset.i); };

  function render(st, ui) {
    flip = !!ui.flip;
    let html = '';
    for (let dr = 0; dr < n; dr++) for (let dc = 0; dc < n; dc++) {
      const r = flip ? n - 1 - dr : dr, c = flip ? n - 1 - dc : dc, i = r * n + c;
      const dark = gameId === 'shogi' ? false : (r + c) % 2 === 1;
      const cls = [dark ? 'dark' : 'light', ui.last?.includes(i) && 'last', ui.selected === i && 'sel', ui.check === i && 'check',
        ui.targets?.get(i), ui.marked?.includes(i) && 'marked'].filter(Boolean).join(' ');
      let label = '';
      if (gameId === 'chess') {
        if (dr === n - 1) label += `<b class="file">${'abcdefgh'[c]}</b>`;
        if (dc === 0) label += `<b class="rank">${8 - r}</b>`;
      }
      if (gameId === 'draughts' && dark) label = `<b class="num">${G.draughts.num(i)}</b>`;
      if (gameId === 'shogi') {
        if (dr === 0) label += `<b class="file">${9 - c}</b>`;
        if (dc === n - 1) label += `<b class="rank">${KANJI_NUM[r]}</b>`;
      }
      html += `<div class="sq ${cls}" data-i="${i}" style="--d:${(dr + dc) * 22}ms">${label}</div>`;
    }
    squares.innerHTML = html;
    if (gameId === 'shogi') squares.insertAdjacentHTML('beforeend', [[3, 3], [3, 6], [6, 3], [6, 6]].map(([r, c]) => `<i class="star" style="--r:${r};--c:${c}"></i>`).join(''));

    let ph = '', k = 0;
    const anim = ui.anim;
    for (let i = 0; i < n * n; i++) {
      const p = st.b[i];
      if (!p) continue;
      const [r, c] = disp(i);
      // Ordre d'arrivée à l'animation d'ouverture : par rangée, depuis chaque camp.
      ph += pieceHTML(gameId, p, r, c, { d: 600 + (k++) * 18, look: ui.look, bottom: ui.bottom, extra: anim && anim.to === i ? 'moved' : '' });
    }
    // Pièces prises : elles s'effacent pendant que le coup arrive.
    for (const i of anim?.caps || []) {
      const p = anim.prev?.b?.[i];
      if (!p) continue;
      const [r, c] = disp(i);
      ph += pieceHTML(gameId, p, r, c, { extra: 'gone', look: ui.look, bottom: ui.bottom });
    }
    pieces.innerHTML = ph;
    // Coup animé : la pièce part de sa case d'origine (ou de la réserve pour un parachutage).
    const moved = pieces.querySelector('.moved');
    if (moved && anim) {
      let dx = 0, dy = 0;
      const [tr, tc] = disp(anim.to);
      if (anim.from !== undefined && anim.from !== null) { const [fr, fc] = disp(anim.from); dx = fc - tc; dy = fr - tr; } else dy = (anim.side === ui.bottom ? 1 : -1) * 1.5;
      moved.style.transform = `translate(${dx * 100}%, ${dy * 100}%)${anim.from == null ? ' scale(1.3)' : ''}`;
      moved.style.opacity = anim.from == null ? '0' : '1';
      requestAnimationFrame(() => requestAnimationFrame(() => { moved.style.transform = ''; moved.style.opacity = ''; }));
    }
  }
  return { render };
}

/* ---------- Goban ---------- */
let goUid = 0;
function goBoard(el, handlers) {
  el.className = 'board goban';
  const uid = ++goUid; // dégradés propres à ce plateau (un même id dans un écran caché ne s'afficherait pas)
  let n = 19, last = null, ghostAt = null;
  const svgPoint = e => {
    const svg = el.querySelector('svg'), r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * (n + 1) - 1, y = ((e.clientY - r.top) / r.height) * (n + 1) - 1;
    const c = Math.round(x), rr = Math.round(y);
    return c >= 0 && rr >= 0 && c < n && rr < n && Math.hypot(x - c, y - rr) < 0.48 ? rr * n + c : null;
  };
  el.onclick = e => { const p = svgPoint(e); if (p !== null) handlers.onSquare?.(p); };
  el.onpointermove = e => {
    if (e.pointerType !== 'mouse' || !last?.interactive) return;
    const p = svgPoint(e);
    if (p === ghostAt) return;
    ghostAt = p;
    drawGhost();
  };
  el.onpointerleave = () => { ghostAt = null; drawGhost(); };
  function drawGhost() {
    const g = el.querySelector('.ghost');
    if (!g) return;
    const ok = ghostAt !== null && last?.legal?.has(ghostAt);
    g.setAttribute('visibility', ok ? 'visible' : 'hidden');
    if (ok) { g.setAttribute('cx', (ghostAt % n) + 1); g.setAttribute('cy', Math.floor(ghostAt / n) + 1); }
  }

  function render(st, ui) {
    n = st.n;
    last = ui;
    const L = 'ABCDEFGHJKLMNOPQRST', hoshi = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : [2, 4, 6];
    let lines = '';
    for (let i = 0; i < n; i++) {
      lines += `<line class="ln" pathLength="1" x1="1" y1="${i + 1}" x2="${n}" y2="${i + 1}" style="--d:${i * 40}ms"/>`;
      lines += `<line class="ln" pathLength="1" x1="${i + 1}" y1="1" x2="${i + 1}" y2="${n}" style="--d:${i * 40 + 120}ms"/>`;
    }
    const stars = hoshi.flatMap(r => hoshi.map(c => (n === 9 && (r === 4) !== (c === 4) ? '' : `<circle class="hoshi" cx="${c + 1}" cy="${r + 1}" r=".11"/>`))).join('');
    const labels = Array.from({ length: n }, (_, i) => `<text x="${i + 1}" y=".42">${L[i]}</text><text x=".38" y="${i + 1.13}">${n - i}</text>`).join('');
    let stones = '', k = 0;
    for (let p = 0; p < n * n; p++) {
      const v = st.b[p];
      const r = Math.floor(p / n), c = p % n;
      if (ui.owner && !v && ui.owner[p] >= 0) stones += `<rect class="terr t${ui.owner[p]}" x="${c + 0.82}" y="${r + 0.82}" width=".36" height=".36"/>`;
      if (!v) continue;
      const dead = ui.dead?.includes(p);
      const fresh = ui.anim?.to === p;
      stones += `<circle class="stone s${v}${dead ? ' dead' : ''}${fresh ? ' fresh' : ''}" cx="${c + 1}" cy="${r + 1}" r=".47" style="--d:${900 + (k++) * 30}ms"/>`;
      if (dead && ui.owner) stones += `<path class="x" d="M${c + 0.8} ${r + 0.8}l.4 .4m0 -.4l-.4 .4"/>`;
      if (ui.lastPoint === p) stones += `<circle class="lastmark s${v}" cx="${c + 1}" cy="${r + 1}" r=".18"/>`;
    }
    // Pierres prises au dernier coup : elles s'envolent.
    for (const p of ui.anim?.caps || []) {
      const v = ui.anim.prev?.b?.[p];
      if (v) stones += `<circle class="stone s${v} gone" cx="${(p % n) + 1}" cy="${Math.floor(p / n) + 1}" r=".47"/>`;
    }
    if (ui.selected !== undefined && ui.selected !== null) stones += `<circle class="stone s${st.turn + 1} pending" cx="${(ui.selected % n) + 1}" cy="${Math.floor(ui.selected / n) + 1}" r=".47"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${n + 1} ${n + 1}" style="--n:${n};--gB:url(#gB${uid});--gW:url(#gW${uid})">
      <defs>
        <radialGradient id="gB${uid}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#6b6b6b"/><stop offset=".5" stop-color="#1c1c1c"/><stop offset="1" stop-color="#000"/></radialGradient>
        <radialGradient id="gW${uid}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e6e2d8"/><stop offset="1" stop-color="#b9b3a5"/></radialGradient>
      </defs>
      <g class="lab">${labels}</g><g class="grid">${lines}${stars}</g><g class="stones">${stones}</g>
      <circle class="ghost stone s${st.turn + 1}" r=".47" visibility="hidden"/>
    </svg>`;
    drawGhost();
  }
  return { render };
}

// Plateau prêt à dessiner ; intro() rejoue l'animation d'apparition propre au jeu.
export function createBoard(el, gameId, handlers = {}) {
  const b = gameId === 'go' ? goBoard(el, handlers) : gridBoard(el, gameId, handlers);
  let timer;
  return {
    render: b.render,
    intro() {
      el.classList.remove('intro');
      void el.offsetWidth;
      el.classList.add('intro');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('intro'), 3200);
    },
  };
}

// Position de démonstration (écran d'accueil du jeu) : départ réel, ou quelques pierres pour le go.
export function demoState(gameId) {
  if (gameId !== 'go') return G[gameId].init({});
  const s = G.go.init({ goSize: 9 });
  const b = s.b.slice();
  for (const [p, v] of [[20, 1], [24, 2], [56, 1], [60, 2], [30, 1], [31, 2], [40, 1], [49, 2], [22, 1], [42, 2], [38, 1]]) b[p] = v;
  return { ...s, b };
}

export { sizeOf, sideOfPiece, esc };
