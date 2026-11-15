// Mini-golf, mode Aventure : la Tour. Onze mondes empilés tous les 12 m, chacun bâti autour d'une idée :
// le Jardin (apprendre), l'Horloge (aiguilles-ponts), les Balances (plateaux à cliquet), la Bibliothèque (livres-dominos),
// la Roue à godets, le Grand Huit (rails), la Ville perchée (de toit en toit), le Mobile, l'Orgue des vents, le Trébuchet, et le Sommet
// (un trou qui tourne). Partagé par le navigateur (window.TourLevel) et les tests (require).
// Repère : mètres, y vers le haut ; la tour occupe x et z de -16 à 16 ; face avant = +z, droite = +x.
// Règle de construction : aucun bloc n'en chevauche un autre (des faces confondues font scintiller l'image).
(function (root) {
  const blocks = [], zones = [], deco = [], hints = [], TAU = Math.PI * 2;
  const box = (x0, y0, z0, x1, y1, z1, s, o = {}) => {
    const b = { c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], s, yaw: 0, pitch: 0, roll: 0, ...o };
    blocks.push(b);
    return b;
  };
  // Rampe : emprise [x0,x1]×[z0,z1], le dessus va de yA (côté x0 ou z0) à yB (côté x1 ou z1) ; dir donne l'axe ('x…' ou 'z…')
  function ramp(x0, z0, x1, z1, yA, yB, dir, s, o = {}, th = 1) {
    const alongX = dir[0] === 'x', run = alongX ? x1 - x0 : z1 - z0, rise = yB - yA, a = Math.atan2(rise, run), L = Math.hypot(run, rise);
    const sign = 1, ym = (yA + yB) / 2 - (th / 2) * Math.cos(a);
    const b = { c: [(x0 + x1) / 2, ym, (z0 + z1) / 2], h: alongX ? [L / 2, th / 2, (z1 - z0) / 2] : [(x1 - x0) / 2, th / 2, L / 2], s, yaw: 0, pitch: alongX ? 0 : -sign * a, roll: alongX ? sign * a : 0, ramp: dir, ...o };
    blocks.push(b);
    return b;
  }
  // Plancher d'un monde (dessus à Y, épaisseur 1,2) percé de trappes [x0, z0, x1, z1] : découpé en rectangles sans recouvrement
  function slab(Y, holes, s, o = {}, area = [-16, -16, 16, 16]) {
    const xs = [...new Set([area[0], area[2], ...holes.flatMap(h => [h[0], h[2]])])].filter(x => x >= area[0] && x <= area[2]).sort((a, b) => a - b);
    const zs = [...new Set([area[1], area[3], ...holes.flatMap(h => [h[1], h[3]])])].filter(z => z >= area[1] && z <= area[3]).sort((a, b) => a - b);
    const inHole = (x, z) => holes.some(h => x > h[0] && x < h[2] && z > h[1] && z < h[3]);
    for (let j = 0; j + 1 < zs.length; j++) {
      let start = null;
      for (let i = 0; i < xs.length; i++) {
        const full = i + 1 < xs.length && !inHole((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2);
        if (full && start === null) start = xs[i];
        if (!full && start !== null) { box(start, Y - 1.2, zs[j], xs[i], Y, zs[j + 1], s, { floor: true, ...o }); start = null; }
      }
    }
  }
  // Murs d'une salle (de Y à top) avec des ouvertures : côté 's' (avant, +z), 'n' (arrière), 'e' (droite), 'w' (gauche) ;
  // chaque ouverture [début, fin, hauteur] le long du mur
  function walls(Y, top, s, doors = {}, o = {}) {
    const side = (k, a0, a1, mk) => {
      const ds = (doors[k] || []).slice().sort((a, b) => a[0] - b[0]);
      let a = a0;
      for (const [d0, d1, h] of ds) { if (d0 > a) mk(a, d0, Y, top); if (Y + h < top) mk(d0, d1, Y + h, top); a = d1; }
      if (a < a1) mk(a, a1, Y, top);
    };
    side('s', -16, 16, (a, b, y0, y1) => box(a, y0, 15, b, y1, 16, s, { face: 's', ...o }));
    side('n', -16, 16, (a, b, y0, y1) => box(a, y0, -16, b, y1, -15, s, { face: 'n', ...o }));
    side('e', -15, 15, (a, b, y0, y1) => box(15, y0, a, 16, y1, b, s, { face: 'e', ...o }));
    side('w', -15, 15, (a, b, y0, y1) => box(-16, y0, a, -15, y1, b, s, { face: 'w', ...o }));
  }
  const d = (t, p, o = {}) => deco.push({ t, p, ...o });
  const hint = (lo, hi, text) => hints.push({ lo, hi, text });
  const world = [];
  const W = (name, Y) => world.push({ name, y: Y });

  /* ===== 1. Le Jardin des Premiers Pas (0 m) : on apprend, impossible de tomber ===== */
  W('Le Jardin des Premiers Pas', -40);
  box(-22, -2, -22, 22, 0, 22, 'grass', { look: 'lawn' });
  box(-22, 0, 21, 22, 1.4, 22, 'moss', { look: 'hedge' });
  box(-22, 0, -22, 22, 4.4, -21, 'moss', { look: 'hedge' });
  box(-22, 0, -21, -21, 8.4, 21, 'moss', { look: 'hedge' });
  box(21, 0, -21, 22, 4.4, -10, 'moss', { look: 'hedge' });
  box(21, 0, -10, 22, 1.4, 21, 'moss', { look: 'hedge' });
  box(-14, 0, 8, 21, 1.6, 9, 'rock', { look: 'drystone' }); // le muret : il faut lever la balle
  ramp(-2, -10, 8, -2, 3, 0, 'z+', 'grass', { look: 'slope' });
  box(-21, 0, -21, 21, 3, -10, 'grass', { look: 'terrace' });
  box(-12, 3, -19, -4, 7, -13, 'rock', { look: 'pavilion' }); // le pavillon cache le chemin
  ramp(-21, -10, -17, 4, 3, 7, 'z+', 'grass', { look: 'slope' });
  box(-21, 0, 4, -14, 7, 21, 'grass', { look: 'terrace' });
  ramp(-14, 17, 4, 21, 7, 12, 'x+', 'wood', { look: 'boardwalk' });
  box(4, 10.8, 16, 10, 12, 21, 'wood', { look: 'boardwalk' });
  d('tee', [12, 0, 17]); d('flowerbed', [16, 0, 12]); d('flowerbed', [-6, 0, 15]); d('tree', [17, 0, -5]); d('tree', [-17, 7, 14]); d('tree', [15, 3, -16]);
  d('fountain', [-14, 0, -3]); d('stele', [9, 0, 14]); d('stele', [6, 0, 6.5]); d('stele', [4, 0, -1]); d('stele', [0, 3, -12]); d('stele', [-17, 7, 8]);
  hint([2, 0, 10], [21, 2, 21], 'Glisse en arrière depuis n’importe où, puis relâche : la balle part à l’opposé. Plus tu tires loin, plus c’est fort.');
  hint([-14, 0, 9.01], [21, 2, 10.5], 'Un muret ! Prends le Fer (touche 2) : il lève la balle. Les points jaunes montrent où elle va retomber.');
  hint([-14, 0, -2], [21, 2, 8], 'Les flèches au sol indiquent les pentes : elles montrent le sens de la descente. Pour monter, frappe plus fort.');
  hint([-21, 2.5, -21], [21, 5, -10], 'Le chemin semble s’arrêter… Tourne la tour avec Q / E (ou ⟲ ⟳) : il continue derrière le pavillon.');
  hint([-21, 6.5, 4], [-14, 9, 21], 'Le disque en bas règle l’effet : frappée sur le côté, la balle courbe ; frappée en bas, elle s’arrête vite.');
  hint([4, 11.5, 16], [10, 13, 21], 'Bienvenue dans la Tour. Chaque monde a son mécanisme : observe-le avant de frapper.');

  /* ===== 2. La Grande Horloge (12 m) : les aiguilles sont des ponts ===== */
  W('La Grande Horloge', 11);
  slab(12, [[-10, -10, 10, 10], [-16, -16, -11, -11]], 'marble', { look: 'clockfloor' });
  walls(12, 22.8, 'metal', { s: [[4, 10, 4]] }, { look: 'brass' });
  box(-1.5, 0, -1.5, 1.5, 12, 1.5, 'metal', { look: 'pivot' }); // l'axe de l'horloge, planté dans le jardin
  box(-1.2, 11.4, 1.5, 1.2, 12, 10, 'moss', { look: 'hand', kin: { type: 'spin', pivot: [0, 12, 0], axis: 'y', speed: TAU / 20 } });
  box(-0.7, 13.6, 1.5, 0.7, 14, 6.5, 'metal', { look: 'hourhand', kin: { type: 'spin', pivot: [0, 14, 0], axis: 'y', speed: TAU / 90, phase: 2 } });
  box(-15.8, 17.2, -15.8, -11.2, 18, -11.2, 'metal', { look: 'lift', kin: { type: 'move', axis: [0, 1, 0], amp: 6, period: 12, phase: -Math.PI / 2 } });
  d('clockface', [0, 12, 0]); d('gearwall', [0, 17, -15]); d('gearwall', [-15, 17, 2], { side: 'w' }); d('pendulum', [10, 21, -14.5]);
  hint([-16, 11.5, 10], [16, 13, 16], 'Les aiguilles sont des ponts. Pose la balle sur la grande aiguille quand elle touche le bord : elle t’emmène de l’autre côté.');
  hint([-16, 11.5, -16], [16, 13, -10], 'Le monte-charge (au fond à gauche) descend puis remonte : roule dessus quand il est en bas.');

  /* ===== 3. Les Balances (24 m) : un plateau qui descend fait monter l'autre… et un cliquet le bloque en haut ===== */
  W('Les Balances', 23);
  const shafts = [[6, -14, 12, -8], [-12, 6, -6, 12], [8, 0, 14, 6], [8, 6, 14, 12]];
  slab(24, [[-16, -16, -11, -11], [8, 12, 15, 15], ...shafts], 'marble', { look: 'checker' });
  walls(24, 34.8, 'marble', {}, { look: 'marblewall' });
  // puits sous les plateaux qui descendent (la balle ne peut pas filer sous le plancher) ; vw : dessinés avec les Balances
  for (const [x0, z0, x1, z1] of shafts.slice(0, 2)) {
    box(x0 - 0.3, 20.5, z0 - 0.3, x1 + 0.3, 22.8, z0, 'marble', { look: 'pit', vw: 2 }); box(x0 - 0.3, 20.5, z1, x1 + 0.3, 22.8, z1 + 0.3, 'marble', { look: 'pit', vw: 2 });
    box(x0 - 0.3, 20.5, z0, x0, 22.8, z1, 'marble', { look: 'pit', vw: 2 }); box(x1, 20.5, z0, x1 + 0.3, 22.8, z1, 'marble', { look: 'pit', vw: 2 });
  }
  box(6.1, 22.8, -13.9, 11.9, 24, -8.1, 'metal', { look: 'plateA', kin: { type: 'lever', id: 1, role: 'A', amp: 2.5 } });
  box(8.1, 22.8, 0.1, 13.9, 24, 5.9, 'metal', { look: 'plateB', kin: { type: 'lever', id: 1, role: 'B', amp: 3 } });
  box(-11.9, 22.8, 6.1, -6.1, 24, 11.9, 'metal', { look: 'plateA', kin: { type: 'lever', id: 2, role: 'A', amp: 2.5 } });
  box(8.1, 22.8, 6.1, 13.9, 24, 11.9, 'metal', { look: 'plateB', kin: { type: 'lever', id: 2, role: 'B', amp: 6 } });
  box(8, 22.8, 12, 15, 33, 15, 'marble', { look: 'column' }); // la colonne de sortie (trappe au-dessus)
  d('levers', [0, 34.8, 0]); d('statue', [-12, 24, -12]);
  hint([-16, 23.5, -16], [16, 25, 16], 'Pose la balle sur un plateau : il descend, et son jumeau de la même couleur (la chaîne passe par le plafond) monte… puis reste bloqué en haut. Il devient une marche.');

  /* ===== 4. La Bibliothèque engloutie (36 m) : des livres-dominos font un pont au-dessus du gouffre ===== */
  W('La Bibliothèque engloutie', 35);
  slab(36, [[8, 12, 15, 15], [-16, -6, 16, 4]], 'wood', { look: 'parquet' });
  walls(36, 46.8, 'wood', {}, { look: 'shelves' });
  box(-2, 24, -3, 2, 36, -1, 'marble', { look: 'column' }); // l'îlot au milieu du gouffre (une colonne depuis l'étage des balances)
  box(-1.5, 36, 4, 1.5, 42, 4.2, 'wood', { look: 'book', tag: 'livre1', topple: { at: 2, pivot: [0, 36, 4], axis: 'x', angle: -Math.PI / 2, time: 1.4, next: 'livre2' } });
  box(-1.5, 36, -3.2, 1.5, 42, -3, 'wood', { look: 'book', tag: 'livre2', topple: { at: 99, pivot: [0, 36, -3.2], axis: 'x', angle: -Math.PI / 2, time: 1.4 } });
  // le mur de la salle de lecture, percé d'une arche basse : il faut rouler, pas voler
  box(-15, 36, -11, -2, 46.8, -10, 'wood', { look: 'shelves' }); box(2, 36, -11, 15, 46.8, -10, 'wood', { look: 'shelves' }); box(-2, 37.4, -11, 2, 46.8, -10, 'wood', { look: 'shelves' });
  // derrière l'arche, un palier libre ; à droite, les piles montent vers la trappe ; à gauche, des piles pour le décor
  box(4, 36, -15, 7, 38.5, -11, 'wood', { look: 'bookstack' });
  box(7, 36, -15, 10, 41, -11, 'wood', { look: 'bookstack' });
  box(-10, 36, -15, -4, 38.5, -11, 'wood', { look: 'bookstack' });
  box(-15, 36, -15, -10, 41, -11, 'wood', { look: 'bookstack' });
  box(10, 36, -15, 15, 45, -11, 'wood', { look: 'bookstack' }); // sous la trappe vers la roue
  d('bookpile', [-12, 36, 12]); d('bookpile', [12, 36, 8]); d('lamp', [-6, 36, 10]); d('lamp', [6, 36, -8]); d('chandelier', [0, 45, 0]);
  hint([-16, 35.5, 4], [16, 37, 16], 'Un gouffre… Pousse le grand livre debout au bord : en tombant, il fait tomber les autres et forme un pont.');
  hint([-16, 35.5, -16], [16, 47, -10], 'Grimpe les piles de livres jusqu’à la trappe, au fond à droite.');

  /* ===== 5. La Roue à godets (48 m) : une roue géante te remonte, accrochée à la façade ===== */
  W('La Roue à godets', 47);
  slab(48, [[10, -15, 15, -11], [-16, -16, -10, -10]], 'rock', { look: 'millfloor' });
  walls(48, 58.8, 'rock', { e: [[-1.5, 1.5, 3.2]] }, { look: 'millwall' });
  ramp(12, -1.5, 15, 1.5, 48, 49.15, 'x+', 'wood', { look: 'boardwalk' });
  box(16, 47, -1.5, 18.8, 49.15, 1.5, 'wood', { look: 'dock' }); // quai du bas, où l'on monte dans un godet
  box(16, 58, -1.5, 18.8, 60.15, 1.5, 'wood', { look: 'dock' }); // quai du haut, devant la porte du Grand Huit
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, pv = [20, 54.5, 0], c = [20, 54.5 - 5.5 * Math.cos(a), -5.5 * Math.sin(a)];
    const kin = { type: 'orbit', pivot: pv, axis: 'x', speed: TAU / 20 }, by = c[1], bz = c[2];
    // le godet : un fond et trois rebords (ouvert côté tour)
    box(18.9, by - 0.3, bz - 1.1, 21.1, by, bz + 1.1, 'wood', { look: 'bucket', kin });
    box(21.1, by - 0.3, bz - 1.1, 21.4, by + 0.7, bz + 1.1, 'wood', { look: 'bucketlip', kin });
    box(18.9, by - 0.3, bz - 1.4, 21.4, by + 0.7, bz - 1.1, 'wood', { look: 'bucketlip', kin });
    box(18.9, by - 0.3, bz + 1.1, 21.4, by + 0.7, bz + 1.4, 'wood', { look: 'bucketlip', kin });
  }
  zones.push({ t: 'water', lo: [-15, 47.6, -5], hi: [15, 48.4, -2] }); // le bief qui traverse le moulin
  d('wheel', [20, 54.5, 0]); d('millstone', [-8, 48, 6]); d('waterfall', [22.6, 62.3, 3.2], { h: 14.5, w: 0.9 }); d('sacks', [8, 48, 10]);
  hint([-16, 47.5, -16], [16, 50, 16], 'La roue tourne dehors, à droite : roule dans un godet quand il passe tout en bas, il te monte. En haut, sors-en d’un petit coup.');

  /* ===== 6. Le Grand Huit (60 m) : des rails, des bosses, et il faut la bonne vitesse ===== */
  W('Le Grand Huit', 59);
  slab(60, [[-15, -15, -6, -10]], 'metal', { look: 'plank' });
  walls(60, 70.8, 'metal', { e: [[-1.5, 1.5, 3]] }, { look: 'fairwall' });
  const rail = (x0, x1, yA, yB) => {
    ramp(x0, -14, x1, -11, yA, yB, 'x-', 'metal', { look: 'rail' });
    ramp(x0, -14.3, x1, -14, yA + 0.6, yB + 0.6, 'x-', 'metal', { look: 'railside' }, 1.6);
    ramp(x0, -11, x1, -10.7, yA + 0.6, yB + 0.6, 'x-', 'metal', { look: 'railside' }, 1.6);
  };
  rail(2, 12, 62.5, 60); rail(-2, 2, 61.5, 62.5); rail(-10, -2, 66, 61.5);
  box(-15, 60, -15, -10, 66, -10, 'marble', { look: 'station' });
  box(-10, 60, -15, -6, 69, -12, 'marble', { look: 'station' });
  d('loop', [4, 60, 6]); d('bunting', [0, 69, -14]); d('lights', [0, 70, 0]);
  hint([-16, 59.5, -16], [16, 62, 16], 'Le Grand Huit : lance la balle dans les rails (fond de la salle). Trop doux, elle redescend ; assez fort, elle passe les bosses.');
  hint([-15, 65.5, -15], [-6, 70, -10], 'Plus haut ! Le Grand Lob monte presque à la verticale ; sinon, passe par la petite station.');

  /* ===== 7. La Ville perchée (72 m) : des maisons posées chacune sur son rocher volant, on saute de toit en toit ===== */
  W('La Ville perchée', 71);
  slab(72, [[-15, -15, -6, -10]], 'rock', { look: 'cobble' }, [-16, -16, -4, -4]);
  // chaque maison est un vrai bloc (son toit-terrasse est le chemin), avec sa cheminée collée au flanc
  const house = (x0, y0, z0, x1, y1, z1, look, ch) => { box(x0, y0, z0, x1, y1, z1, 'rock', { look }); box(...ch, 'rock', { look: 'chimney' }); d('house', [(x0 + x1) / 2, y1, (z0 + z1) / 2], { lo: [x0, y0, z0], hi: [x1, y1, z1], look }); };
  house(-2, 70, -14, 4, 74, -8, 'houseA', [4, 70, -12, 4.8, 75.2, -11.2]);
  house(6, 72, -8, 14, 76.5, -2, 'houseB', [12, 72, -8.8, 12.8, 77.7, -8]);
  house(6, 74.5, 2, 14, 79, 8, 'houseC', [5.2, 74.5, 6, 6, 80.2, 6.8]);
  house(-6, 77, 8, 2, 81.5, 14, 'houseD', [-1, 77, 14, -0.2, 82.7, 14.8]);
  d('town', [0, 72, 0]);
  hint([-16, 71.5, -16], [-4, 74, -4], 'La Ville perchée : chaque maison flotte sur son rocher. Saute de toit en toit, et garde la balle basse.');

  /* ===== 8. Le Mobile (84 m) : des plateaux suspendus qui penchent sous ton poids ===== */
  W('Le Mobile', 83);
  slab(84, [[-13, 5, -7, 11]], 'wood', { look: 'deck' }, [-16, 0, -2, 16]);
  const mobile = (x, y, z, s = 2.5) => box(x - s, y - 0.6, z - s, x + s, y, z + s, 'moss', { look: 'mobile', kin: { type: 'mobile', max: 0.2 } });
  mobile(3, 86, 6); mobile(9.5, 88.5, -1); mobile(3, 91, -8); mobile(-7, 93.5, -7);
  d('wires', [3, 95, 6]); d('wires', [9.5, 95, -1]); d('wires', [3, 95, -8]); d('wires', [-7, 95, -7]);
  hint([-16, 83.5, 0], [-2, 86, 16], 'Le mobile penche du côté où la balle se pose : vise bien le centre de chaque plateau.');

  /* ===== 9. L'Orgue des vents (96 m) : chaque touche fait souffler son tuyau ===== */
  W('L’Orgue des vents', 95);
  slab(96, [[-12, -11, -4, -3], [6, -15, 12, -10], [-6, 8, 6, 11]], 'marble', { look: 'organfloor' });
  walls(96, 106.8, 'gold', { s: [[-8, 8, 4]] }, { look: 'organwall' });
  for (let k = 0; k < 4; k++) box(-6 + k * 3 + 0.05, 95.7, 8, -3 + k * 3 - 0.05, 96, 11, 'felt', { look: 'key', key: k + 1 });
  // tuyaux : derrière chaque touche, une colonne d'air qui monte vers la tribune
  for (let k = 0; k < 4; k++) zones.push({ t: 'wind', key: k + 1, on: 4, lo: [-6 + k * 3, 96, 2], hi: [-3 + k * 3, 102.6, 7.5], f: [0, 16, -3.2] });
  box(-6, 96, -2, 6, 102, 2, 'gold', { look: 'organledge' }); // la tribune, où les tuyaux déposent la balle
  box(-6, 96, -6, 6, 104.5, -2, 'gold', { look: 'organledge' });
  box(6, 96, -15, 12, 106, -10, 'gold', { look: 'organledge', hidden: 'melodie' }); // l'escalier royal (après la mélodie)
  box(-12, 96, 12, -2, 98.5, 15, 'marble', { look: 'organbench' });
  d('pipes', [0, 96, 3]); d('score', [-10, 96, -14]);
  hint([-16, 95.5, 3], [16, 98, 16], 'Chaque touche fait souffler son tuyau quatre secondes : roule sur une touche, puis dans le souffle.');
  hint([-12, 95.5, -16], [6, 99, 3], 'La partition au mur : 1, 3, 2, 4. Joue-la sur les touches et l’orgue ouvre son escalier royal.');

  /* ===== 10. Le Trébuchet (108 m) : il lance la balle vers le sommet ===== */
  W('Le Trébuchet', 107);
  slab(108, [[-6, -6, 2, -2]], 'wood', { look: 'deck' }); // trappe au-dessus de la tribune haute de l'orgue
  box(-6.6, 108, -1.6, -5.4, 111.4, 1.6, 'wood', { look: 'trebframe' }); // le chevalet (le bras tourne autour de son sommet)
  // la poche : construite dans son repère (fond, rebord du côté de la pente, deux joues) puis tournée de -45° :
  // son fond regarde l'axe du bras, son côté ouvert est celui du lancer
  const tk = { type: 'treb', pivot: [-6, 112, 0], axis: 'z' }, pc = [-8.8, 109.2, 0], rr = -Math.PI / 4;
  const part = (lx, ly, lz, hx, hy, hz, s, o) => {
    const c = [pc[0] + lx * Math.cos(rr) - ly * Math.sin(rr), pc[1] + lx * Math.sin(rr) + ly * Math.cos(rr), pc[2] + lz];
    blocks.push({ c, h: [hx, hy, hz], s, yaw: 0, pitch: 0, roll: rr, kin: tk, ...o });
  };
  part(0, 0, 0, 0.8, 0.15, 0.8, 'net', { look: 'pocket', trebPocket: true });
  part(0.95, 0.35, 0, 0.15, 0.5, 0.8, 'wood', { look: 'pocketlip', trebPocket: true });
  part(0, 0.3, 0.95, 0.8, 0.45, 0.15, 'wood', { look: 'pocketlip', trebPocket: true });
  part(0, 0.3, -0.95, 0.8, 0.45, 0.15, 'wood', { look: 'pocketlip', trebPocket: true });
  box(-3.5, 108, 2.5, -1.5, 109.6, 4.5, 'metal', { look: 'counterweight', trebWeight: true });
  d('trebuchet', [-6, 112, 0]); d('banners', [0, 108, -15]);
  hint([-16, 107.5, -16], [16, 110, 16], 'Pose la balle dans la poche du trébuchet : il la lance vers le sommet. Mais il faut toute sa force : frappe d’abord le contrepoids (chaque coup ajoute un cran, 3 au maximum).');

  /* ===== 11. Le Sommet (120 m) : le trou tourne avec son disque ===== */
  W('Le Sommet', 119);
  box(4, 119.2, -6, 16, 120, 6, 'gold', { look: 'summit', tag: 'sommet', show: true, kin: { type: 'spin', pivot: [10, 120, 0], axis: 'y', speed: TAU / 30 } });
  d('beacon', [10, 120, 0]); d('stars', [0, 120, 0]);
  hint([4, 119.5, -6], [16, 122, 6], 'Le dernier trou tourne avec le disque : vise un peu en avance.');

  const level = {
    blocks, zones, deco, hints, worlds: world,
    pickups: [
      { club: 'wedge', p: [6, 12.5, -13] }, { club: 'driver', p: [-13, 36.5, 13] }, { club: 'lob', p: [-13, 48.5, 12] }, { club: 'faucille', p: [12, 79.5, 6.5] },
    ],
    shards: [[-8, 3.6, -20], [0, 12.6, 0], [-14, 24.6, 14], [12.5, 45.6, -13], [-14, 48.6, -13], [-12.5, 66.6, -12.5], [11, 76.8, -6.5], [-7, 94.1, -7], [9, 106.6, -12.5], [-14, 108.6, 14], [14, 120.6, 4]].map((p, id) => ({ id, p })),
    melody: [1, 3, 2, 4], treb: { stop: 1.13, base: 3.8, step: 0.9, acc: 20 }, // le bras s'arrête à 65° (départ à ~70°) ; seule la force 3 atteint le sommet
    // un point d'arrivée par monde (téléport de l'administrateur), pris sur l'ascension du test
    spawns: [[12, 0.3, 17], [9.1, 12.3, 18.5], [-2.3, 24.3, -3], [-13.8, 36.3, 13.3], [0.5, 48.3, -11], [17.1, 60.5, 0.2], [-8.7, 72.3, -7.7], [-8.3, 84.3, 12.1], [-7.6, 96.3, 0.7], [6, 108.3, -2.3], [9.1, 120.3, 1]],
    start: [12, 0.3, 17], cup: { tag: 'sommet', off: [3, 3] }, fatal: -25, top: 122, startClubs: ['putter', 'fer'],
    // les mondes : nom, hauteur où commence leur ambiance, ciel haut et bas, brume, lumière
    biomes: [
      ['#9fdcff', '#e8fbe8', '#d6f0dc', '#fff6e0'], ['#b9c8ff', '#fff3e0', '#e6e0f0', '#fff0d8'], ['#ffd6c8', '#fff8f0', '#f6e6e0', '#fff4ea'],
      ['#7f6a9a', '#e8d8c8', '#c8b8c8', '#ffe8c8'], ['#8fd8e8', '#e8fff8', '#cdeee8', '#ffffff'], ['#ff9fc0', '#ffe8b8', '#ffd0d8', '#fff0e0'],
      ['#6f8ad8', '#d8e0ff', '#b8c4f0', '#f0f0ff'], ['#9fe0d0', '#f8fff0', '#d8f4ea', '#ffffff'], ['#c89a6a', '#fff0c8', '#f0d8b0', '#fff2d8'],
      ['#ff8a6a', '#ffd8a8', '#f8c0a0', '#ffe0c0'], ['#3a3590', '#cdb8ff', '#a89ad8', '#f0e8ff'],
    ].map(([a, b, f, s], i) => ({ name: world[i].name, y: world[i].y, sky: [a, b], fog: f, sun: s })),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = level;
  else root.TourLevel = level;
})(this);
