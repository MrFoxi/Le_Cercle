// Grille de démineur : génération (premier clic sûr, grille résoluble sans deviner), ouverture, drapeaux, accords,
// et un solveur de déduction qui vérifie qu'une grille se termine sans tirer à pile ou face.
// radius : portée des chiffres (1 = classique ; 2 pour le boss « L'Écho », qui compte les mines à 2 cases).
export function makeBoard(w, h, radius = 1) {
  const n = w * h;
  const nb = Array.from({ length: n }, (_, i) => {
    const x = i % w, y = Math.floor(i / w), out = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) out.push((y + dy) * w + x + dx);
    }
    return out;
  });
  return {
    w, h, n, nb,
    mine: new Uint8Array(n), open: new Uint8Array(n), flag: new Uint8Array(n), count: new Int8Array(n),
    silent: new Uint8Array(n), // cases « muettes » : ouvertes sans afficher de chiffre (boss)
    void: new Uint8Array(n), // trous de la grille (formes en losange, grilles trouées) : ni case ni mine
    loot: new Uint8Array(n), // 1 = pièces cachées, 2 = coffre (objet)
    mines: 0, generated: false, exploded: [],
  };
}

export const area = (b, i, r) => {
  const x = i % b.w, y = Math.floor(i / b.w), out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (x + dx >= 0 && x + dx < b.w && y + dy >= 0 && y + dy < b.h) out.push((y + dy) * b.w + x + dx);
  }
  return out;
};
// Trous : une case vide compte comme ouverte et muette (aucune information, aucune mine).
export function carve(b, cells) {
  for (const i of cells) { b.void[i] = 1; b.open[i] = 1; b.silent[i] = 1; }
}

export const recount = b => { for (let i = 0; i < b.n; i++) b.count[i] = b.nb[i].reduce((s, j) => s + b.mine[j], 0); };

// Place les mines après le premier clic : jamais autour de lui ni dans la zone sûre, et la grille doit se résoudre
// par déduction depuis ce clic (jusqu'à `tries` essais ; sinon on garde le dernier tirage).
export function generate(b, first, { mines, safe = [], silent = 0, rng = Math.random, tries = 300 }) {
  const banned = new Set([first, ...b.nb[first], ...safe]);
  for (let i = 0; i < b.n; i++) if (b.void[i]) banned.add(i);
  const pool = [];
  for (let i = 0; i < b.n; i++) if (!banned.has(i)) pool.push(i);
  mines = Math.min(mines, pool.length);
  let ok = false;
  for (let t = 0; t < tries && !ok; t++) {
    b.mine.fill(0);
    for (let i = 0; i < b.n; i++) b.silent[i] = b.void[i];
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    for (let k = 0; k < mines; k++) b.mine[pool[k]] = 1;
    recount(b);
    ok = solvable(b, first);
  }
  // Cases muettes : ajoutées une à une, en gardant seulement celles qui laissent la grille résoluble.
  if (silent && ok) {
    const want = Math.round(b.n * silent), cand = pool.filter(i => !b.mine[i]);
    for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
    let made = 0;
    for (const i of cand) {
      if (made >= want) break;
      b.silent[i] = 1;
      if (solvable(b, first)) made++; else b.silent[i] = 0;
    }
  }
  b.mines = mines;
  b.generated = true;
  b.fair = ok;
  return ok;
}

// Ouvre une case : flot automatique sur les zéros. Renvoie les cases ouvertes avec leur distance (animation en vague).
export function reveal(b, start) {
  if (b.open[start] || b.flag[start]) return [];
  if (b.mine[start]) return [{ i: start, d: 0, mine: true }];
  const out = [], queue = [[start, 0]];
  b.open[start] = 1;
  while (queue.length) {
    const [i, d] = queue.shift();
    out.push({ i, d });
    if (b.count[i] || b.silent[i]) continue;
    for (const j of b.nb[i]) {
      if (b.open[j] || b.flag[j] || b.mine[j]) continue;
      b.open[j] = 1;
      queue.push([j, d + 1]);
    }
  }
  return out;
}

// Accord : sur un chiffre entouré d'autant de drapeaux, ouvre tous les autres voisins.
export function chordTargets(b, i) {
  if (!b.open[i] || b.silent[i] || !b.count[i]) return [];
  const flags = b.nb[i].filter(j => b.flag[j] || (b.open[j] && b.mine[j])).length;
  return flags === b.count[i] ? b.nb[i].filter(j => !b.open[j] && !b.flag[j]) : [];
}

// Déplace la mine de la case i vers une case fermée loin de la zone ouverte (coup forcé : on ne punit pas).
export function moveMine(b, i, rng = Math.random) {
  const far = [], any = [];
  for (let j = 0; j < b.n; j++) {
    if (j === i || b.mine[j] || b.open[j] || b.flag[j]) continue;
    any.push(j);
    if (!b.nb[j].some(k => b.open[k])) far.push(j);
  }
  const list = far.length ? far : any;
  if (!list.length) return false;
  b.mine[i] = 0;
  b.mine[list[Math.floor(rng() * list.length)]] = 1;
  recount(b);
  return true;
}

export const cleared = b => { for (let i = 0; i < b.n; i++) if (!b.mine[i] && !b.open[i]) return false; return true; };
export const safeLeft = b => { let s = 0; for (let i = 0; i < b.n; i++) if (!b.mine[i] && !b.open[i]) s++; return s; };

// Solveur de déduction (règles simples + inclusion entre deux contraintes) : la grille se finit-elle sans deviner ?
// Renvoie aussi, si demandé, une case sûre déductible depuis l'état réel de la partie (indice).
export function solvable(b, first, fromState = false) {
  const known = new Int8Array(b.n).fill(-1); // -1 inconnue, 0 sûre (ouverte), 1 mine
  const open = i => {
    const st = [i];
    while (st.length) {
      const k = st.pop();
      if (known[k] === 0) continue;
      known[k] = 0;
      if (!b.count[k] && !b.silent[k]) for (const j of b.nb[k]) if (known[j] === -1 && !b.mine[j]) st.push(j);
    }
  };
  for (let i = 0; i < b.n; i++) if (b.void[i]) known[i] = 0;
  if (fromState) for (let i = 0; i < b.n; i++) { if (b.open[i]) known[i] = b.mine[i] ? 1 : 0; }
  else open(first);
  let total = 0;
  for (let i = 0; i < b.n; i++) total += b.mine[i];
  for (let guard = 0; guard < b.n * 4; guard++) {
    let progress = false;
    const cons = [];
    for (let i = 0; i < b.n; i++) {
      if (known[i] !== 0 || b.mine[i] || b.silent[i]) continue;
      const unk = [];
      let rem = b.count[i];
      for (const j of b.nb[i]) { if (known[j] === 1) rem--; else if (known[j] === -1) unk.push(j); }
      if (!unk.length) continue;
      if (rem === 0) { for (const j of unk) open(j); progress = true; }
      else if (rem === unk.length) { for (const j of unk) known[j] = 1; progress = true; }
      else cons.push({ unk, rem, set: new Set(unk) });
    }
    if (!progress) {
      // Inclusion : si les inconnues de A sont toutes dans B, la différence porte (remB - remA) mines.
      for (let a = 0; a < cons.length && !progress; a++) for (let c = 0; c < cons.length && !progress; c++) {
        const A = cons[a], B = cons[c];
        if (a === c || A.unk.length >= B.unk.length || !A.unk.every(j => B.set.has(j))) continue;
        const diff = B.unk.filter(j => !A.set.has(j)), r = B.rem - A.rem;
        if (r === 0) { for (const j of diff) open(j); progress = true; }
        else if (r === diff.length) { for (const j of diff) known[j] = 1; progress = true; }
      }
    }
    if (!progress) {
      // Compte global : toutes les mines restantes sont dans les inconnues restantes.
      let unknown = 0, found = 0;
      for (let i = 0; i < b.n; i++) { if (known[i] === -1) unknown++; else if (known[i] === 1) found++; }
      if (unknown && (total - found === 0 || total - found === unknown)) {
        for (let i = 0; i < b.n; i++) if (known[i] === -1) { if (total - found) known[i] = 1; else open(i); }
        progress = true;
      }
    }
    if (fromState === true) {
      for (let i = 0; i < b.n; i++) if (known[i] === 0 && !b.open[i]) return i; // case sûre trouvée
      if (!progress) return -1;
    }
    if (!progress || fromState === 'step') break; // 'step' : une seule passe (ce qui se déduit tout de suite)
  }
  if (fromState === true) return -1;
  // fromState = 'all' : toutes les cases que la déduction prouve, sûres ou minées (mode apprentissage)
  if (fromState === 'all' || fromState === 'step') {
    const safe = [], mines = [];
    for (let i = 0; i < b.n; i++) if (!b.open[i]) { if (known[i] === 0) safe.push(i); else if (known[i] === 1) mines.push(i); }
    return { safe, mines };
  }
  for (let i = 0; i < b.n; i++) if (!b.mine[i] && known[i] !== 0) return false;
  return true;
}
