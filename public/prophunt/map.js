// Prop Hunt : les cartes et les collisions, partagées par le serveur (robots, contrôles) et le navigateur (affichage,
// déplacements). Script classique : window.PH ou require().
// Trois lieux faits avec les modèles de Little District (même échelle : un passant mesure ~0,6) :
// la place japonaise, une villa moderne avec piscine, un port de pêche.
(function (root) {
  const SPEED = 1.7, RUN = 2.6, R = 0.16; // vitesse de marche, de course, rayon d'un joueur sous forme humaine
  const BW = 4.3, BD = 4.2; // emprise d'un bâtiment ordinaire
  const MAPS = ['place', 'villa', 'port'];
  const NAMES = { place: 'Place japonaise', villa: 'Villa avec piscine', port: 'Port de pêche' };
  const STYLE = { place: 'japon', villa: 'moderne', port: 'cotier' }; // quartier de Little District utilisé pour l'apparence

  // Objets en lesquels on peut se transformer, par carte : rayon de collision, hauteur (pour viser), nom affiché.
  const P = (r, h, name) => ({ r, h, name });
  const PROPS = {
    place: {
      plante: P(0.2, 0.5, 'Plante'), caisses: P(0.2, 0.45, 'Caisses'), banc: P(0.38, 0.35, 'Banc'), velo: P(0.25, 0.42, 'Vélo'),
      lampe: P(0.12, 1.5, 'Lampadaire'), bambou: P(0.25, 1.4, 'Bambous'), toro: P(0.18, 0.9, 'Lanterne'), panneau: P(0.17, 0.55, 'Panneau'),
      bonsai: P(0.2, 0.45, 'Bonsaï'), vending: P(0.26, 0.85, 'Distributeur'), jizo: P(0.18, 0.7, 'Statue'), neko: P(0.3, 1.1, 'Chat porte-bonheur'), puits: P(0.33, 0.9, 'Pompe à eau'),
    },
    villa: {
      plante: P(0.2, 0.5, 'Plante'), caisses: P(0.3, 0.35, 'Transat'), parasol: P(0.22, 1.25, 'Parasol'), banc: P(0.38, 0.35, 'Banc'), velo: P(0.25, 0.42, 'Vélo'),
      bambou: P(0.4, 0.55, 'Haie taillée'), toro: P(0.1, 0.45, 'Borne lumineuse'), bonsai: P(0.18, 0.75, 'Sculpture'), jizo: P(0.17, 0.95, 'Cubes colorés'),
      neko: P(0.22, 0.95, 'Statue chromée'), lampe: P(0.12, 1.5, 'Lampadaire'), ballon: P(0.14, 0.28, 'Ballon de plage'),
    },
    port: {
      caisses: P(0.28, 0.45, 'Caisses de pêche'), filet: P(0.32, 0.3, 'Filet de pêche'), toro: P(0.2, 0.55, 'Bouée'), bambou: P(0.2, 0.4, 'Roseaux'),
      bonsai: P(0.3, 0.3, 'Rocher'), puits: P(0.45, 0.45, 'Barque'), neko: P(0.26, 1.1, 'Petit phare'), tonneau: P(0.18, 0.42, 'Tonneau'),
      banc: P(0.38, 0.35, 'Banc'), velo: P(0.25, 0.42, 'Vélo'), lampe: P(0.12, 1.5, 'Lampadaire'), plante: P(0.2, 0.5, 'Plante'), kiosque: P(0.5, 1.6, 'Cabane de pêcheur'),
    },
  };

  function build(id) {
    let s = { place: 20260, villa: 4242, port: 777 }[id];
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const m = { id, name: NAMES[id], style: STYLE[id], HALF: 15, buildings: [], decor: [], blocks: [], circles: [], water: [], ground: [], boats: [], PROPS: PROPS[id] };
    m.TYPES = Object.keys(m.PROPS);
    const HALF = m.HALF;
    // Bâtiment (tourné d'un quart de tour au plus) : rectangle bloquant
    const building = (type, x, z, ry, w = BW, d = BD) => {
      const turned = Math.abs(Math.sin(ry)) > 0.5, hw = (turned ? d : w) / 2, hd = (turned ? w : d) / 2;
      m.buildings.push({ type, x, z, ry, w, d, hw, hd });
      m.blocks.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
    };
    const rect = (x0, x1, z0, z1) => m.blocks.push({ x0, x1, z0, z1 });
    const blocked = (x, z, r) => Math.abs(x) > HALF - 0.6 || Math.abs(z) > HALF - 0.6 ||
      m.blocks.some(b => x > b.x0 - r - 0.05 && x < b.x1 + r + 0.05 && z > b.z0 - r - 0.05 && z < b.z1 + r + 0.05) ||
      m.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r + 0.6) ||
      m.decor.some(d => Math.hypot(d.x - x, d.z - z) < d.r + r + 0.35);
    // Objet du décor ; « scenery » : décor qui bloque mais dont on ne peut pas prendre la forme (arbres…)
    const put = (type, x, z, ry, scenery = false) => {
      const r = m.PROPS[type]?.r ?? 0.4;
      if (blocked(x, z, r)) return false;
      m.decor.push({ id: m.decor.length, type, x, z, ry, r, scenery });
      return true;
    };
    const around = (cx, cz, n, list, d0 = 0.9, d1 = 1.5) => { for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d = d0 + rnd() * (d1 - d0); put(list[Math.floor(rnd() * list.length)], cx + Math.cos(a) * d, cz + Math.sin(a) * d, rnd() * Math.PI * 2); } };
    const fill = (n, list, area = HALF - 3) => { for (let k = 0; k < 600 && m.decor.length < n; k++) put(list[Math.floor(rnd() * list.length)], (rnd() * 2 - 1) * area, (rnd() * 2 - 1) * area, rnd() * Math.PI * 2); };
    // Devant chaque façade : quelques objets
    const fronts = list => {
      for (const b of m.buildings) {
        const fx = Math.sin(b.ry), fz = Math.cos(b.ry), sx = Math.cos(b.ry), sz = -Math.sin(b.ry), front = b.d / 2 + 0.45;
        for (const side of [-1.6, 1.6, 0.2]) { if (side === 0.2 && rnd() < 0.5) continue; const t = list[Math.floor(rnd() * list.length)]; put(t, b.x + fx * front + sx * side, b.z + fz * front + sz * side, b.ry + (t === 'velo' || t === 'banc' ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.3); }
      }
    };

    if (id === 'place') {
      const LOOKS = ['ramen', 'cafe', 'konbini', 'fleurs', 'pain', 'livres', 'sushi', 'bar', 'karaoke', 'mode', 'arcade', 'ryotei', 'street', 'appart', 'maison', 'immeuble'];
      const edge = HALF - BD / 2 - 0.3;
      [-9.6, -4.8, 0, 4.8, 9.6].forEach((x, k) => { building(LOOKS[k], x, -edge, 0); building(LOOKS[k + 5], -x, edge, Math.PI); });
      [-4.8, 0, 4.8].forEach((z, k) => { building(LOOKS[10 + k], -edge, z, Math.PI / 2); building(LOOKS[13 + k], edge, -z, -Math.PI / 2); });
      m.circles.push({ x: 0, z: 0, r: 0.75, kind: 'fontaine', scale: 1.35 });
      fronts(['plante', 'panneau', 'caisses', 'vending', 'velo', 'bonsai', 'toro']);
      for (const [cx, cz] of [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, -6.5], [0, 6.5], [-7, 0], [7, 0], [-3, -2.5], [3, 2.5], [3, -2.5], [-3, 2.5]]) {
        put('banc', cx, cz, rnd() * Math.PI);
        around(cx, cz, 4, ['lampe', 'plante', 'toro', 'bonsai', 'bambou', 'jizo', 'caisses', 'velo', 'neko', 'puits']);
      }
      fill(95, m.TYPES);
      m.spawns = { hunter: [[1.6, 0], [-0.8, 1.4], [-0.8, -1.4]], center: [0, 0] };
      m.ground.push({ kind: 'slab', x0: -HALF - 3, x1: HALF + 3, z0: -HALF - 3, z1: HALF + 3 });
    }

    if (id === 'villa') {
      // La grande villa au nord, la piscine au milieu, des maisons au sud, pool-house et studio sur les côtés.
      building('maison', 0, -10.8, 0, 11, 6.4);
      building('cafe', 11.3, -1.5, -Math.PI / 2);
      building('konbini', -11.3, -1.5, Math.PI / 2);
      [-8.5, 0, 8.5].forEach((x, k) => building(['appart', 'immeuble', 'pain'][k], x, 11.5, Math.PI));
      m.water.push({ x0: -5, x1: 5, z0: -3.2, z1: 0.8, kind: 'piscine' });
      rect(-5, 5, -3.2, 0.8);
      m.ground.push({ kind: 'lawn', x0: -HALF - 3, x1: HALF + 3, z0: -HALF - 3, z1: HALF + 3 }, { kind: 'deck', x0: -7.5, x1: 7.5, z0: -5.6, z1: 3.2 }, { kind: 'deck', x0: -1.2, x1: 1.2, z0: -8, z1: -5.6 });
      // Plage de la piscine : transats en rang, parasols entre eux, bornes aux coins
      for (const z of [-4.6, 2.2]) for (let k = 0; k < 5; k++) { const x = -5.6 + k * 2.8; put('caisses', x, z, z < 0 ? 0 : Math.PI); put('parasol', x + 1.3, z + (z < 0 ? -0.2 : 0.2), 0); }
      for (const [x, z] of [[-7, -5.2], [7, -5.2], [-7, 2.8], [7, 2.8]]) put('toro', x, z, 0);
      put('ballon', 2.4, 1.5, 0); put('ballon', -3.1, -4.1, 0);
      // Haies taillées le long des bords, palmiers
      for (let k = -12; k <= 12; k += 2.6) { put('bambou', -14.1, k, Math.PI / 2); put('bambou', 14.1, k, Math.PI / 2); }
      for (const [x, z] of [[-9, -6], [9, -6], [-9, 6.5], [9, 6.5], [-4.5, 7.5], [4.5, 7.5]]) put('palmier', x, z, rnd() * 6, true);
      fronts(['plante', 'velo', 'bonsai', 'neko', 'jizo', 'lampe']);
      for (const [cx, cz] of [[-6, 7], [6, 7], [0, 6.5], [-9.5, 2.5], [9.5, 2.5]]) { put('banc', cx, cz, rnd() * Math.PI); around(cx, cz, 3, ['plante', 'bonsai', 'jizo', 'neko', 'lampe', 'velo', 'parasol', 'ballon']); }
      fill(100, ['plante', 'plante', 'bonsai', 'jizo', 'neko', 'lampe', 'velo', 'parasol', 'caisses', 'ballon', 'bambou']);
      m.spawns = { hunter: [[0, -6.4], [-1.6, -6.4], [1.6, -6.4]], center: [0, -1.2] };
    }

    if (id === 'port') {
      // Maisons colorées au nord et sur les côtés, le marché au poisson au milieu, le quai et deux pontons au sud.
      const LOOKS = ['ramen', 'cafe', 'fleurs', 'pain', 'maison', 'sushi', 'bar', 'appart', 'livres', 'immeuble'];
      const edge = HALF - BD / 2 - 0.3;
      [-9.6, -4.8, 0, 4.8, 9.6].forEach((x, k) => building(LOOKS[k], x, -edge, 0));
      [-6, -1.2].forEach((z, k) => { building(LOOKS[5 + k], -edge, z, Math.PI / 2); building(LOOKS[7 + k], edge, z, -Math.PI / 2); });
      const Q = 6.5; // bord du quai ; au-delà, la mer
      m.water.push({ x0: -HALF - 40, x1: HALF + 40, z0: Q, z1: HALF + 40, kind: 'mer' });
      for (const [x0, x1] of [[-HALF - 3, -7.5], [-5.5, 4.5], [6.5, HALF + 3]]) rect(x0, x1, Q, HALF + 3);
      rect(-7.5, -5.5, 13, HALF + 3); rect(4.5, 6.5, 13, HALF + 3); // bout des pontons
      m.ground.push({ kind: 'cobble', x0: -HALF - 3, x1: HALF + 3, z0: -HALF - 3, z1: Q }, { kind: 'planks', x0: -HALF - 3, x1: HALF + 3, z0: Q - 1.4, z1: Q }, { kind: 'planks', x0: -7.5, x1: -5.5, z0: Q, z1: 13 }, { kind: 'planks', x0: 4.5, x1: 6.5, z0: Q, z1: 13 });
      m.boats.push({ x: -9.5, z: 9.5, ry: Math.PI / 2 }, { x: -3.5, z: 10.5, ry: Math.PI / 2 }, { x: 8.5, z: 9, ry: Math.PI / 2 + 0.2 }, { x: 2.5, z: 11.5, ry: -Math.PI / 2 }, { x: 12, z: 12, ry: 0.4 });
      // Petits phares au bout des pontons, barques tirées sur le quai
      put('neko', -6.5, 12.4, 0); put('neko', 5.5, 12.4, 0);
      for (const x of [-12, -2, 2.6, 10.5]) put('puits', x, Q - 0.9, Math.PI / 2 + (rnd() - 0.5) * 0.4);
      // Marché au poisson : cabanes, étals de caisses, filets, tonneaux, bouées
      for (const [cx, cz] of [[-6, -1.5], [6, -1.5], [0, -3.5], [-3, 2.5], [3, 2.5], [0, 0]]) { put('kiosque', cx, cz, rnd() * 6); around(cx, cz, 4, ['caisses', 'filet', 'tonneau', 'toro', 'caisses', 'filet'], 1, 1.8); }
      fronts(['plante', 'caisses', 'tonneau', 'velo', 'filet', 'lampe']);
      for (let k = -12; k <= 12; k += 3.2) put(['toro', 'filet', 'tonneau', 'caisses', 'bambou'][Math.floor(rnd() * 5)], k + rnd(), Q - 0.5, rnd() * 6);
      fill(100, ['caisses', 'filet', 'tonneau', 'toro', 'bambou', 'bonsai', 'banc', 'lampe', 'plante', 'velo']);
      m.spawns = { hunter: [[0, -6.5], [-1.6, -6.5], [1.6, -6.5]], center: [0, -1] };
    }

    // Départs : chasseurs ensemble, objets répartis sur la carte, toujours sur un endroit libre.
    m.spawn = (k, hunter) => {
      if (hunter) { const [x, z] = m.spawns.hunter[k % m.spawns.hunter.length]; return { x, z: z + Math.floor(k / 3) * 0.6 }; }
      for (let t = 0; t < 40; t++) {
        const a = (k * 7 + t) * 2.39996, d = 3 + ((k + t) % 5) * 2, x = m.spawns.center[0] + Math.cos(a) * d, z = m.spawns.center[1] + Math.sin(a) * d;
        if (!m.blocks.some(b => x > b.x0 - 0.4 && x < b.x1 + 0.4 && z > b.z0 - 0.4 && z < b.z1 + 0.4) && Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1) return { x, z };
      }
      return { x: m.spawns.center[0], z: m.spawns.center[1] };
    };
    // Repousse un cercle (x, z, r) hors des bâtiments, de l'eau, des objets fixes et des bords.
    m.collide = (p, r, extra = []) => {
      p.x = Math.max(-HALF + r, Math.min(HALF - r, p.x)); p.z = Math.max(-HALF + r, Math.min(HALF - r, p.z));
      for (const b of m.blocks) {
        const ox = Math.min(p.x + r - b.x0, b.x1 - (p.x - r)), oz = Math.min(p.z + r - b.z0, b.z1 - (p.z - r));
        if (ox > 0 && oz > 0) { if (ox < oz) p.x += p.x < (b.x0 + b.x1) / 2 ? -ox : ox; else p.z += p.z < (b.z0 + b.z1) / 2 ? -oz : oz; }
      }
      for (const c of [...m.circles, ...m.decor, ...extra]) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min && d > 1e-6) { p.x += dx / d * (min - d); p.z += dz / d * (min - d); }
      }
      return p;
    };
    return m;
  }

  const cache = {};
  const get = id => cache[id] ?? (cache[id] = build(MAPS.includes(id) ? id : 'place'));
  const api = { SPEED, RUN, R, BW, BD, MAPS, NAMES, get };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PH = api;
})(this);
