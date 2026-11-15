// Mini-golf, mode Aventure : la Tour. Les blocs (collisions + dessin), les zones (eau, vent), les clubs cachés, le trou
// tout en haut et la limite fatale. Partagé par le navigateur (window.TourLevel) et les tests (require).
// Repère : mètres, y vers le haut, la tour occupe x et z de -16 à 16 ; face avant = +z, droite = +x, arrière = -z, gauche = -x.
(function (root) {
  const blocks = [], zones = [], deco = [];
  // Un bloc par ses deux coins ; s : surface ; o : options (face de façade, casse, bascule, mouvement, déclencheur…)
  function box(x0, y0, z0, x1, y1, z1, s, o = {}) {
    const b = { c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], s, yaw: 0, pitch: 0, roll: 0, ...o };
    blocks.push(b);
    return b;
  }
  // Rampe : emprise [x0,x1]×[z0,z1], le dessus monte de yA à yB dans le sens dir ('x+', 'x-', 'z+', 'z-'), épaisseur th
  function ramp(x0, z0, x1, z1, yA, yB, dir, s, o = {}, th = 1.2) {
    const alongX = dir[0] === 'x', run = alongX ? x1 - x0 : z1 - z0, rise = yB - yA, a = Math.atan2(rise, run), L = Math.hypot(run, rise);
    const sign = dir[1] === '+' ? 1 : -1, ym = (yA + yB) / 2 - (th / 2) * Math.cos(a);
    const b = { c: [(x0 + x1) / 2, ym, (z0 + z1) / 2], h: alongX ? [L / 2, th / 2, (z1 - z0) / 2] : [(x1 - x0) / 2, th / 2, L / 2], s, yaw: 0, pitch: alongX ? 0 : -sign * a, roll: alongX ? sign * a : 0, ramp: true, ...o };
    blocks.push(b);
    return b;
  }
  const d = (t, p, o = {}) => deco.push({ t, p, ...o });

  /* ===== 0. Le Marais des Racines (0 à 10 m) : le plateau du départ ===== */
  box(-30, -3, -30, 30, 0, 30, 'grass', { look: 'plateau' });
  zones.push({ t: 'water', lo: [-29, -0.2, 18], hi: [-18, 0.5, 29] }, { t: 'water', lo: [18, -0.2, -29], hi: [29, 0.5, -16] }, { t: 'water', lo: [20, -0.2, 6], hi: [29, 0.5, 16] });
  box(-29, -0.4, 18, -18, 0, 29, 'mud', { look: 'marsh' });
  box(20, -0.4, 6, 29, 0, 16, 'mud', { look: 'marsh' });
  box(18, -0.4, -29, 29, 0, -16, 'mud', { look: 'marsh' });
  // le socle de la tour, percé d'un terrier secret (fermé par des racines qu'on peut casser)
  box(-16, 0, -16, 7, 10, 16, 'rock', { face: true });
  box(11, 0, -16, 16, 10, 16, 'rock', { face: true });
  box(7, 3.2, -16, 11, 10, 16, 'rock', { face: true });
  box(6.8, 0, 15.4, 11.2, 3.2, 16.2, 'wood', { breakAt: 4, look: 'roots' });
  // terrasses en escalier contre la façade avant, puis le coin gauche
  box(-6, 0, 16, 5, 2.5, 23, 'grass', { look: 'terrace' });
  box(-15, 0, 16, -6, 5, 23, 'grass', { look: 'terrace' });
  box(-23, 0, 8, -15, 7.5, 21, 'moss', { look: 'terrace' });
  // le long chemin : deux rampes douces par l'arrière
  ramp(-14, -22, 14, -17, 5, 0, 'x+', 'grass', { look: 'path' });
  box(-28, 0, -24, -14, 5, -16, 'rock', { look: 'terrace' });
  ramp(-28, -16, -23, 2, 5, 10, 'z+', 'grass', { look: 'path' });
  box(-28, 0, 2, -23, 10, 8, 'grass', { look: 'terrace' });
  d('roots', [-10, 0, 23]); d('roots', [15, 0, 17]); d('lily', [-24, 0.5, 24]); d('lily', [24, 0.5, 10]); d('reeds', [-20, 0, 27]); d('reeds', [26, 0, -20]);
  d('tee', [6, 0, 26]);

  /* ===== 1. La Forêt des Géants (10 à 20 m) : terrasse gauche, sous le surplomb de la tour ===== */
  box(-8, 10, -16, 16, 20, 16, 'rock', { face: true });
  box(-23, 0, -14, -16, 10, 8, 'grass', { look: 'terrace' });
  box(-16, 9.6, -16, -8, 10, 16, 'grass', { look: 'floor' });
  ramp(-15, -12, -11, 6, 15, 10, 'z+', 'wood', { look: 'trunk' }); // un arbre géant couché, en pente
  box(-16, 10, -16, -8, 15, -12, 'rock', { look: 'ruin' });
  box(-22, 10, -3, -19, 11.3, 0, 'shroom', { look: 'shroom' });
  box(-12, 10, 10, -9, 11.1, 13, 'shroom', { look: 'shroom' });
  zones.push({ t: 'water', lo: [-16, 9.6, 11], hi: [-11, 10.5, 16] });
  d('bigtree', [-19, 10, 4]); d('bigtree', [-12, 10, 14]); d('bigtree', [-20, 10, -11]); d('fern', [-17, 10, -6]); d('fern', [-10, 10, 2]);
  d('vines', [-8, 20, 0], { face: 'x-' }); d('fall', [-16.1, 10, 13], { h: 10 });

  /* ===== 2. Les Grottes de Cristal (20 à 32 m) : dans la tour ===== */
  // parois (on les voit par transparence quand la balle est dedans) et plafond
  box(-8, 20, -6, -7, 32, 10, 'crystal', { face: true, look: 'cave' });
  box(-8, 20, -16, 0, 32, -15, 'crystal', { face: true, look: 'cave' });
  box(8, 20, -16, 16, 32, -15, 'crystal', { face: true, look: 'cave' });
  box(0, 20, -16, 8, 29, -15, 'crystal', { face: true, look: 'cave' });
  box(15, 20, -15, 16, 32, 10, 'crystal', { face: true, look: 'cave' });
  box(-8, 20, 9, 16, 32, 10, 'crystal', { face: true, look: 'cave' });
  box(-8, 31, -16, 16, 32, 10, 'rock', { face: true, look: 'cave' });
  // lacets intérieurs
  ramp(-1, -15, 10, -10, 20, 23.5, 'x+', 'crystal', { look: 'cave' });
  box(10, 20, -15, 15, 23.5, -4, 'rock', { look: 'cave' });
  ramp(10, -4, 15, 6, 23.5, 26.5, 'z+', 'crystal', { look: 'cave' });
  box(-2, 20, 6, 15, 26.5, 9, 'rock', { look: 'cave' });
  box(0, 28, -15, 8, 29, -9, 'rock', { look: 'cave' }); // corniche de sortie, au-dessus du premier lacet
  ramp(-2, -9, 3, 6, 29, 26.5, 'z+', 'crystal', { look: 'cave' }); // dernier lacet, vers la sortie
  // salle secrète derrière une vitre de cristal
  box(-7, 20, 2.5, -2, 24, 3, 'crystal', { breakAt: 4.5, look: 'pane' });
  d('crystal', [3, 20, -3]); d('crystal', [12, 23.5, -12]); d('crystal', [-5, 20, -12]); d('crystal', [6, 26.5, 7.5]); d('crystal', [-4, 20, 6], { big: true });
  d('pool', [5, 20.05, 0]);

  /* ===== 3. Le Canyon des Anciens (29 à 40 m) ===== */
  // balcon arrière (sortie de la grotte), coupé par une faille ; un obélisque peut tomber en travers
  box(-16, 26, -24, -6, 29, -16, 'sand', { look: 'ruinfloor' });
  box(-3, 26, -24, 6, 29, -16, 'sand', { look: 'ruinfloor' });
  box(-3, 29, -21, -2, 37, -20, 'rock', { look: 'obelisk', topple: { at: 3, pivot: [-3, 29, -20.5], axis: 'z', angle: Math.PI / 2 } });
  // ascenseur des anciens (va et vient entre le balcon et le haut du canyon)
  box(6, 31.8, -24, 10, 32.6, -16, 'rock', { look: 'lift', move: { axis: [0, 1, 0], amp: 3.6, period: 9, phase: -Math.PI / 2 } });
  // la mesa, de l'autre côté du gouffre
  box(16, 26, -21, 27, 32, 14, 'sand', { look: 'mesa' });
  zones.push({ t: 'wind', lo: [16.6, 32, 8], hi: [20, 43.5, 12], f: [-2.6, 15.5, 0] });
  // les quatre colonnes du sommet, en colimaçon
  box(0, 32, -16, 16, 36, 0, 'sand', { face: true, look: 'canyon' });
  box(0, 32, 0, 16, 40, 16, 'rock', { face: true, look: 'col' });
  box(-16, 32, 0, 0, 44, 16, 'snow', { face: true, look: 'glacier' });
  // colonne arrière gauche, creusée d'une grotte de glace (entrée par la face gauche, derrière une paroi fragile)
  box(-16, 32, -16, 0, 44, 0, 'snow', { face: true, look: 'glacier' });
  box(-16, 47, -16, 0, 48, 0, 'snow', { face: true, look: 'glacier' });
  box(-16, 44, -16, -1, 47, -12, 'snow', { face: true, look: 'glacier' });
  box(-16, 44, -4, 0, 47, 0, 'snow', { face: true, look: 'glacier' });
  box(-1, 44, -12, 0, 47, -4, 'snow', { face: true, look: 'glacier' });
  box(-16, 20, -16, -8, 32, -15, 'rock', { face: true });
  box(-16, 31, -15, -8, 32, 16, 'rock', { face: true });
  box(-8, 20, 10, 16, 32, 16, 'rock', { face: true });
  // ruines du canyon (des colonnes qui arrêtent la balle)
  for (const [x, z] of [[3, -13], [7, -13], [11, -13], [13, -4], [13, -9]]) box(x - 0.6, 36, z - 0.6, x + 0.6, 39.5, z + 0.6, 'rock', { look: 'column' });
  box(2, 35.6, -9, 7, 36, -3, 'sand', { look: 'bunker' });
  d('ruins', [-12, 29, -20]); d('ruins', [5, 29, -22]); d('statue', [-14, 29, -18]); d('arch', [8, 36, -6]); d('cactus', [24, 32, 2]); d('cactus', [19, 32, -3]); d('mesa', [23, 32, 10]);

  /* ===== 4. Le Col des Vents et le Glacier (40 à 48 m) ===== */
  ramp(0, 12, 14, 16, 44, 40, 'x+', 'ice', { look: 'iceramp' });
  box(9, 39.7, 1, 12, 40, 4, 'rock', { look: 'plate', trigger: 'marches' }); // une dalle : des marches sortent du sol
  box(2, 40, 1, 4, 42, 5, 'rock', { look: 'steps', hidden: 'marches' });
  box(0, 40, 1, 2, 43.2, 5, 'rock', { look: 'steps', hidden: 'marches' });
  box(-8, 43.6, 3, -1, 44, 12, 'ice', { look: 'icefield' });
  ramp(-16, 0, -10, 12, 48, 44, 'z+', 'snow', { look: 'snowramp' }, 1.6);
  // grotte de glace secrète, creusée dans la colonne arrière gauche (entrée par la face gauche)
  box(-17, 44, -12, -16, 47, -4, 'ice', { look: 'pane', breakAt: 5 });
  box(-23, 40, -14, -16, 44, 4, 'snow', { look: 'ledge' });
  d('waterfall', [16.1, 40, 6], { h: 8 }); d('pine', [-13, 44, 13]); d('pine', [-6, 44, 13]); d('pine', [-13, 48, -13]); d('icespire', [-3, 48, -3]); d('icespire', [-14, 44, 5]);

  /* ===== 5. Le Sanctuaire Céleste (48 m et plus) : le seul trou ===== */
  box(-14, 40, -14, -10, 51, -10, 'rock', { look: 'pillar' });
  box(-12, 40, -8, -8, 54, -3, 'rock', { look: 'pillar' });
  box(-8, 32, -8, 8, 56, 8, 'gold', { face: true, look: 'temple' });
  for (const [x, z] of [[-7, 7], [7, 7], [7, -7], [-7, -7], [0, 7], [7, 0]]) box(x - 0.7, 56, z - 0.7, x + 0.7, 59, z + 0.7, 'rock', { look: 'templecolumn' });
  d('lanterns', [0, 56, 0]); d('blossom', [-12, 51, -12]); d('blossom', [12, 40, 12]); d('beacon', [0, 59, 0]);

  // Clubs cachés dans la tour
  const pickups = [
    { club: 'wedge', p: [-20.5, 10.5, -10] },
    { club: 'lob', p: [-4.5, 20.5, 6] },
    { club: 'driver', p: [-12, 29.5, -20] },
    { club: 'faucille', p: [-14, 44.5, -8] },
  ];

  const level = {
    blocks, zones, deco, pickups,
    start: [6, 0.3, 26], cup: [2, 56, 2], fatal: -25, top: 60, startClubs: ['putter', 'fer'],
    // les étages : nom, hauteur de départ, ambiance (ciel haut, ciel bas, brume, lumière)
    biomes: [
      { name: 'Le Marais des Racines', y: -30, sky: ['#9fd8e8', '#e8f6e8'], fog: '#cfe8dc', sun: '#fff1d6' },
      { name: 'La Forêt des Géants', y: 9, sky: ['#8fd6a8', '#effbe6'], fog: '#cdeccf', sun: '#fff6d0' },
      { name: 'Les Grottes de Cristal', y: 19.5, sky: ['#7d74d8', '#d6c8ff'], fog: '#b9b0ee', sun: '#e8e0ff' },
      { name: 'Le Canyon des Anciens', y: 27, sky: ['#ffb37a', '#ffe8c8'], fog: '#f6d2a8', sun: '#ffe2b8' },
      { name: 'Le Glacier', y: 40.5, sky: ['#9fd4ff', '#f2fbff'], fog: '#dbeefa', sun: '#ffffff' },
      { name: 'Le Sanctuaire Céleste', y: 50, sky: ['#ffb8d8', '#fff2c8'], fog: '#ffe0ea', sun: '#fff0dc' },
    ],
  };
  const api = level;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TourLevel = api;
})(this);
