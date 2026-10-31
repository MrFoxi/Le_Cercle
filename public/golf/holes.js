// Mini-golf : les 10 trous, leurs versions miroir, les parcours, le trou du jour et les modificateurs du mode chaos.
// Partagé par le serveur et le navigateur (window.GolfHoles ou require()). Ajouter un trou = ajouter un objet à HOLES
// (test-golf.js vérifie qu'un joueur automatique arrive à le terminer, ainsi que sa version miroir).
(function (root) {
  const W = 1000, H = 600;
  const box = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h, x, y];

  const HOLES = {
    moulin: {
      name: 'Le Moulin', theme: 'classic', par: 3, tee: [120, 300], cup: [880, 300],
      hint: 'Passe entre les ailes du moulin, ou fais le tour par les allées.',
      walls: [box(0, 0, W, H), [500, 70, 500, 230], [500, 370, 500, 530]],
      bumpers: [{ x: 300, y: 170, r: 18 }, { x: 300, y: 430, r: 18 }, { x: 500, y: 300, r: 14 }],
      windmills: [{ x: 500, y: 300, len: 78, blades: 4, speed: 1.5 }],
      zones: [{ t: 'sand', c: [760, 165, 55] }, { t: 'water', r: [690, 410, 170, 110] }],
      deco: [{ t: 'tunnel', r: [410, 528, 180, 72] }, { t: 'flowers', at: [[60, 60], [940, 560], [180, 560], [880, 40]] }],
    },
    ile: {
      name: 'L’Île aux palmiers', theme: 'tropical', par: 3, tee: [110, 300], cup: [890, 300],
      hint: 'Le pont du milieu apparaît et disparaît : vise juste au bon moment, ou prends le grand pont.',
      walls: [box(0, 0, W, H)],
      bumpers: [{ x: 250, y: 150, r: 16, palm: true }, { x: 700, y: 455, r: 16, palm: true }, { x: 760, y: 200, r: 16, palm: true }],
      zones: [{ t: 'water', r: [430, 0, 140, H] }, { t: 'sand', c: [200, 520, 70] }, { t: 'sand', c: [800, 80, 70] }],
      bridges: [{ r: [430, 55, 140, 80] }, { r: [430, 262, 140, 76], period: 4, on: 2.4 }],
      deco: [{ t: 'shells', at: [[60, 60], [930, 540], [120, 540], [950, 70]] }],
    },
    station: {
      name: 'La Station orbitale', theme: 'space', par: 4, tee: [110, 470], cup: [150, 130],
      hint: 'Le téléporteur est un raccourci… mais attention aux trous noirs et à la glace.',
      walls: [box(0, 0, W, H), [0, 300, 790, 300]],
      gates: [{ x1: 800, y1: 300, x2: 880, y2: 300, dx: 1, dy: 0, amp: 60, period: 3 }],
      bumpers: [{ x: 330, y: 420, r: 22 }, { x: 430, y: 525, r: 18 }, { x: 700, y: 385, r: 20 }, { x: 900, y: 150, r: 20 }],
      zones: [{ t: 'ice', r: [240, 12, 520, 276] }, { t: 'water', c: [420, 85, 30] }, { t: 'water', c: [470, 225, 28] }],
      teleports: [{ from: [570, 470], to: [640, 150], r: 18 }],
      deco: [{ t: 'stars' }, { t: 'planet', at: [[860, 520]] }],
    },
    volcan: {
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
    bonbons: {
      name: 'Le Pays des bonbons', theme: 'candy', par: 3, tee: [110, 500], cup: [880, 120],
      hint: 'Le ressort rose envoie la balle à toute vitesse ; la pente de caramel la fait redescendre.',
      walls: [box(0, 0, W, H), [330, H, 330, 210], [560, 280, W, 280]],
      bumpers: [{ x: 520, y: 140, r: 20, jelly: true }, { x: 640, y: 215, r: 18, jelly: true }, { x: 470, y: 430, r: 22, jelly: true }, { x: 640, y: 470, r: 22, jelly: true }, { x: 800, y: 420, r: 20, jelly: true }],
      zones: [{ t: 'sand', c: [880, 120, 62] }, { t: 'slope', r: [700, 12, 90, 256], dir: [-1, 0], f: 240 }],
      springs: [{ x: 210, y: 130, r: 20, dir: [1, 0], v: 760 }],
      deco: [{ t: 'sprinkles' }],
    },
    manoir: {
      name: 'Le Manoir hanté', theme: 'haunted', par: 4, tee: [100, 500], cup: [130, 110],
      hint: 'Roule sur la dalle pour ouvrir la porte secrète… ou fais le grand tour entre les fantômes.',
      walls: [box(0, 0, W, H), [0, 300, 300, 300], [380, 300, 850, 300]],
      doors: [{ id: 'crypte', seg: [300, 300, 380, 300] }],
      plates: [{ x: 210, y: 390, r: 16, door: 'crypte' }],
      critters: [
        { kind: 'ghost', r: 16, speed: 110, path: [250, 190, 720, 190, 250, 190] },
        { kind: 'ghost', r: 14, speed: 90, path: [868, 300, 982, 300, 868, 300], offset: 40 },
      ],
      pipes: [{ from: [560, 520], to: [720, 70], dir: [1, 0], r: 16 }],
      bumpers: [{ x: 480, y: 420, r: 16, tomb: true }, { x: 700, y: 470, r: 16, tomb: true }, { x: 620, y: 110, r: 16, tomb: true }],
      deco: [{ t: 'webs' }, { t: 'candles', at: [[40, 340], [960, 40], [960, 560], [40, 260]] }],
    },
    banquise: {
      name: 'La Banquise', theme: 'ice', par: 3, tee: [110, 300], cup: [880, 300],
      hint: 'Tout glisse, le blizzard pousse vers le bas, et le pingouin ne s’arrête jamais.',
      walls: [box(0, 0, W, H)],
      wind: [0, 55],
      zones: [{ t: 'ice', r: [180, 0, 620, H] }, { t: 'snow', c: [880, 300, 85] }, { t: 'water', c: [480, 185, 45] }, { t: 'water', c: [520, 420, 48] }, { t: 'snow', r: [0, 0, 180, 60] }],
      critters: [{ kind: 'penguin', r: 14, speed: 120, path: [690, 90, 690, 510, 690, 90] }],
      bumpers: [{ x: 330, y: 300, r: 22, block: true }, { x: 600, y: 300, r: 20, block: true }],
      deco: [{ t: 'snowflakes' }],
    },
    fete: {
      name: 'La Fête foraine', theme: 'fair', par: 4, tee: [100, 90], cup: [860, 420],
      hint: 'Le tapis roulant t’emmène, la rampe fait sauter la haie, et le trou tourne sur le manège !',
      walls: [box(0, 0, W, H), [400, 0, 400, 380], { pts: [650, 150, 650, H], low: true }],
      cupMove: { dx: 0, dy: 1, amp: 70, period: 5 },
      zones: [{ t: 'belt', r: [12, 450, 388, 110], dir: [1, 0], f: 240 }, { t: 'ramp', r: [520, 330, 80, 90], dir: [1, 0] }],
      bumpers: [{ x: 760, y: 300, r: 18, kick: true }, { x: 950, y: 250, r: 18, kick: true }, { x: 230, y: 250, r: 18, kick: true }],
      deco: [{ t: 'balloons', at: [[60, 560], [480, 60], [960, 60], [960, 560]] }],
    },
    fond: {
      name: 'Le Fond marin', theme: 'sea', par: 3, tee: [100, 300], cup: [900, 300], bonus: [520, 110],
      hint: 'Les anémones attirent la balle et le courant la ramène. Un trou bonus (-1 coup) est caché dans l’épave !',
      walls: [box(0, 0, W, H), [460, 170, 460, 60, 580, 60, 580, 170, 545, 170], [460, 170, 495, 170]],
      zones: [{ t: 'belt', r: [280, 360, 440, 110], dir: [-1, 0], f: 180 }, { t: 'water', r: [610, 480, 150, 120] }],
      magnets: [{ x: 700, y: 220, r: 90, f: 420 }, { x: 330, y: 200, r: 70, f: 380 }],
      critters: [{ kind: 'fish', r: 13, speed: 90, path: [250, 530, 560, 530, 250, 530] }, { kind: 'fish', r: 13, speed: 80, path: [800, 100, 800, 470, 800, 100] }],
      bumpers: [{ x: 860, y: 190, r: 16, coral: true }, { x: 860, y: 410, r: 16, coral: true }],
      deco: [{ t: 'seaweed', at: [[40, 60], [40, 540], [960, 560], [300, 40], [620, 300]] }],
    },
    jungle: {
      name: 'La Jungle', theme: 'jungle', par: 4, tee: [100, 480], cup: [900, 130], bonus: [495, 120],
      hint: 'Prends de l’élan sur la rampe pour sauter la rivière. Un trou bonus (-1 coup) attend sur l’îlot !',
      walls: [box(0, 0, W, H)],
      zones: [{ t: 'water', r: [430, 0, 130, H] }, { t: 'ramp', r: [320, 240, 80, 110], dir: [1, 0] }, { t: 'sand', c: [760, 420, 70] }],
      bridges: [{ r: [430, 500, 130, 60], period: 5, on: 2 }, { r: [445, 80, 100, 80] }],
      critters: [{ kind: 'monkey', r: 15, speed: 100, path: [700, 250, 960, 250, 700, 250] }],
      bumpers: [{ x: 220, y: 250, r: 18, palm: true }, { x: 650, y: 380, r: 18, palm: true }],
      deco: [{ t: 'leaves' }],
    },
  };
  const ORDER = Object.keys(HOLES);

  // Version miroir d'un trou (gauche-droite, haut-bas ou les deux) : un nouveau trou sans rien dessiner.
  function mirror(h, fx, fy) {
    const X = x => (fx ? W - x : x), Y = y => (fy ? H - y : y), sx = fx ? -1 : 1, sy = fy ? -1 : 1;
    const P = p => [X(p[0]), Y(p[1])];
    const flat = a => a.map((v, i) => (i % 2 ? Y(v) : X(v)));
    const rect = r => [fx ? W - r[0] - r[2] : r[0], fy ? H - r[1] - r[3] : r[1], r[2], r[3]];
    const dir = d => [d[0] * sx, d[1] * sy];
    const zone = z => ({ ...z, ...(z.r && { r: rect(z.r) }), ...(z.c && { c: [X(z.c[0]), Y(z.c[1]), z.c[2]] }), ...(z.dir && { dir: dir(z.dir) }) });
    const xy = o => ({ ...o, x: X(o.x), y: Y(o.y) });
    return {
      ...h, tee: P(h.tee), cup: P(h.cup), bonus: h.bonus && P(h.bonus),
      walls: h.walls.map(w => (Array.isArray(w) ? flat(w) : { ...w, pts: flat(w.pts) })),
      bumpers: h.bumpers?.map(xy), magnets: h.magnets?.map(xy), plates: h.plates?.map(xy),
      windmills: h.windmills?.map(m => ({ ...xy(m), speed: m.speed * sx * sy })),
      gates: h.gates?.map(g => ({ ...g, x1: X(g.x1), y1: Y(g.y1), x2: X(g.x2), y2: Y(g.y2), dx: g.dx * sx, dy: g.dy * sy })),
      zones: h.zones?.map(zone), bridges: h.bridges?.map(zone),
      teleports: h.teleports?.map(t => ({ ...t, from: P(t.from), to: P(t.to) })),
      pipes: h.pipes?.map(p => ({ ...p, from: P(p.from), to: P(p.to), dir: dir(p.dir) })),
      springs: h.springs?.map(s => ({ ...xy(s), dir: dir(s.dir) })),
      doors: h.doors?.map(d => ({ ...d, seg: flat(d.seg) })),
      critters: h.critters?.map(c => ({ ...c, path: flat(c.path) })),
      cupMove: h.cupMove && { ...h.cupMove, dx: h.cupMove.dx * sx, dy: h.cupMove.dy * sy },
      wind: h.wind && dir(h.wind),
      deco: h.deco?.map(d => ({ ...d, ...(d.r && { r: rect(d.r) }), ...(d.at && { at: d.at.map(P) }) })),
    };
  }
  // « volcan », ou « volcan~x » (miroir gauche-droite), « volcan~y », « volcan~xy »
  function resolve(id) {
    const [base, m = ''] = String(id).split('~'), h = HOLES[base];
    if (!h) return null;
    const out = m ? mirror(h, m.includes('x'), m.includes('y')) : { ...h };
    return { ...out, id, base, name: m ? `${h.name} · miroir` : h.name };
  }
  const MIRRORS = ['', '~x', '~y', '~xy'];
  const ALL = ORDER.flatMap(id => MIRRORS.map(m => id + m));
  const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  const dailyId = day => ALL[hash(`golf-${day}`) % ALL.length];

  const COURSES = {
    decouverte: { name: 'Découverte', desc: 'Les 5 trous d’origine, du moulin aux bonbons', holes: () => ORDER.slice(0, 5) },
    mondes: { name: 'Nouveaux mondes', desc: 'Manoir hanté, banquise, fête foraine, fond marin, jungle', holes: () => ORDER.slice(5) },
    grandtour: { name: 'Grand Tour', desc: 'Les 10 trous à la suite', holes: () => [...ORDER] },
    express: { name: 'Express', desc: '3 trous au hasard, pour une partie rapide', holes: rng => shuffle([...ORDER], rng).slice(0, 3) },
    aleatoire: { name: 'Aléatoire', desc: '9 trous au hasard, parfois retournés en miroir', holes: rng => shuffle([...ORDER], rng).slice(0, 9).map(id => id + MIRRORS[Math.floor(rng() * 4)]) },
    marathon: { name: 'Marathon', desc: '18 trous : les 10, puis 8 en miroir', holes: rng => [...ORDER, ...shuffle([...ORDER], rng).slice(0, 8).map(id => id + MIRRORS[1 + Math.floor(rng() * 3)])] },
    jour: { name: 'Trou du jour', desc: 'Le même trou pour tout le monde aujourd’hui, avec son classement', holes: (rng, day) => [dailyId(day)] },
  };

  // Mode chaos : un modificateur tiré au sort à chaque trou
  const CHAOS = [
    { id: 'glace', name: '⛸ Patinoire', desc: 'Tout le parcours glisse !', opts: { ice: true } },
    { id: 'geante', name: '🏐 Balle géante', desc: 'Les balles sont énormes.', opts: { R: 11 } },
    { id: 'rebond', name: '🏓 Murs élastiques', desc: 'Les murs renvoient la balle sans freiner.', opts: { bouncy: true } },
    { id: 'tempete', name: '🌪 Tempête', desc: 'Un vent violent souffle sur le trou.', opts: { wind: true } },
    { id: 'aimant', name: '🧲 Trou aimanté', desc: 'Le trou attire les balles de loin.', opts: { magnetCup: true } },
    { id: 'turbo', name: '🚀 Turbo', desc: 'Les tirs partent beaucoup plus fort.', opts: { turbo: true } },
    { id: 'lune', name: '🌙 Gravité lunaire', desc: 'Les rampes font sauter plus haut, et tout glisse un peu.', opts: { moon: true, ice: true } },
  ];

  const api = { HOLES, ORDER, ALL, COURSES, CHAOS, resolve, mirror, dailyId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GolfHoles = api;
})(this);
