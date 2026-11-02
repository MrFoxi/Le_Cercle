// Prop Hunt : la carte (une place de quartier japonais) et les collisions, partagées par le serveur (robots, contrôles)
// et le navigateur (affichage, déplacements). Script classique : window.PH ou require().
// Les bâtiments et objets reprennent les modèles de Little District (même échelle : un passant mesure ~0,6).
(function (root) {
  const HALF = 15; // la place fait 30 × 30
  const BW = 4.3, BD = 4.2; // emprise d'un bâtiment
  const SPEED = 1.7, RUN = 2.6, R = 0.16; // vitesse de marche, de course, rayon d'un joueur sous forme humaine
  // Objets en lesquels on peut se transformer : rayon de collision, hauteur (pour viser), nom affiché.
  const PROPS = {
    plante: { r: 0.2, h: 0.5, name: 'Plante' },
    caisses: { r: 0.2, h: 0.45, name: 'Caisses' },
    banc: { r: 0.38, h: 0.35, name: 'Banc' },
    velo: { r: 0.25, h: 0.42, name: 'Vélo' },
    lampe: { r: 0.12, h: 1.5, name: 'Lampadaire' },
    bambou: { r: 0.25, h: 1.4, name: 'Bambous' },
    toro: { r: 0.18, h: 0.9, name: 'Lanterne' },
    panneau: { r: 0.17, h: 0.55, name: 'Panneau' },
    bonsai: { r: 0.2, h: 0.45, name: 'Bonsaï' },
    vending: { r: 0.26, h: 0.85, name: 'Distributeur' },
    jizo: { r: 0.18, h: 0.7, name: 'Statue' },
    neko: { r: 0.3, h: 1.1, name: 'Chat porte-bonheur' },
    puits: { r: 0.33, h: 0.9, name: 'Pompe à eau' },
  };
  const TYPES = Object.keys(PROPS);
  const LOOKS = ['ramen', 'cafe', 'konbini', 'fleurs', 'pain', 'livres', 'sushi', 'bar', 'karaoke', 'mode', 'arcade', 'ryotei', 'street', 'appart', 'maison', 'immeuble'];

  let s = 20260;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // Bâtiments tout autour, tournés vers la place ; des ruelles aux quatre coins.
  const buildings = [];
  const edge = HALF - BD / 2 - 0.3;
  [-9.6, -4.8, 0, 4.8, 9.6].forEach((x, k) => { buildings.push({ type: LOOKS[k], x, z: -edge, ry: 0 }); buildings.push({ type: LOOKS[k + 5], x: -x, z: edge, ry: Math.PI }); });
  [-4.8, 0, 4.8].forEach((z, k) => { buildings.push({ type: LOOKS[10 + k], x: -edge, z, ry: Math.PI / 2 }); buildings.push({ type: LOOKS[13 + k], x: edge, z: -z, ry: -Math.PI / 2 }); });
  // rectangle occupé (les bâtiments sont tournés d'un quart de tour au plus)
  for (const b of buildings) { const turned = Math.abs(Math.sin(b.ry)) > 0.5; b.hw = (turned ? BD : BW) / 2; b.hd = (turned ? BW : BD) / 2; }
  const fountain = { x: 0, z: 0, r: 0.75 }; // fontaine au centre (décor fixe, pas un objet de déguisement)

  // Objets : devant les boutiques (plantes, panneaux, caisses, vélos, distributeurs), et en îlots sur la place.
  const decor = [];
  const blocked = (x, z, r) => Math.abs(x) > HALF - 0.6 || Math.abs(z) > HALF - 0.6 ||
    buildings.some(b => Math.abs(x - b.x) < b.hw + r + 0.05 && Math.abs(z - b.z) < b.hd + r + 0.05) ||
    Math.hypot(x - fountain.x, z - fountain.z) < fountain.r + r + 0.6 ||
    decor.some(d => Math.hypot(d.x - x, d.z - z) < d.r + r + 0.35);
  const put = (type, x, z, ry) => { const r = PROPS[type].r; if (blocked(x, z, r)) return false; decor.push({ id: decor.length, type, x, z, ry, r }); return true; };
  // le long des façades
  for (const b of buildings) {
    const fx = Math.sin(b.ry), fz = Math.cos(b.ry), sx = Math.cos(b.ry), sz = -Math.sin(b.ry); // vers la place, et le long de la façade
    const front = BD / 2 + 0.45;
    for (const [side, type] of [[-1.6, ['plante', 'panneau', 'caisses', 'vending'][Math.floor(rnd() * 4)]], [1.6, ['velo', 'plante', 'bonsai', 'caisses', 'toro'][Math.floor(rnd() * 5)]], [0.2, rnd() < 0.5 ? 'panneau' : null]]) {
      if (!type) continue;
      const x = b.x + fx * front + sx * side, z = b.z + fz * front + sz * side;
      put(type, x, z, b.ry + (type === 'velo' || type === 'banc' ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.3);
    }
  }
  // îlots sur la place : un banc entouré de lampes, plantes, lanternes…
  const islands = [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, -6.5], [0, 6.5], [-7, 0], [7, 0], [-3, -2.5], [3, 2.5], [3, -2.5], [-3, 2.5]];
  for (const [cx, cz] of islands) {
    const a = rnd() * Math.PI;
    put('banc', cx, cz, a);
    const ring = ['lampe', 'plante', 'toro', 'bonsai', 'bambou', 'jizo', 'caisses', 'velo', 'neko', 'puits'];
    for (let k = 0; k < 4; k++) {
      const t = a + Math.PI / 2 + k * (Math.PI / 2) + (rnd() - 0.5) * 0.6, d = 0.9 + rnd() * 0.6;
      put(ring[Math.floor(rnd() * ring.length)], cx + Math.cos(t) * d, cz + Math.sin(t) * d, rnd() * Math.PI * 2);
    }
  }
  // quelques objets isolés pour remplir
  for (let k = 0; k < 400 && decor.length < 95; k++) put(TYPES[Math.floor(rnd() * TYPES.length)], (rnd() * 2 - 1) * (HALF - 3), (rnd() * 2 - 1) * (HALF - 3), rnd() * Math.PI * 2);

  // Départs : chasseurs au centre (autour de la fontaine), objets n'importe où de libre.
  const spawn = (k, hunter) => {
    if (hunter) { const a = k * 2.1; return { x: Math.cos(a) * 1.6, z: Math.sin(a) * 1.6 }; }
    const a = k * 2.39996, d = 3 + (k % 4) * 2;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  };

  // Repousse un cercle (x, z, r) hors des bâtiments, de la fontaine, des objets fixes et des bords.
  function collide(p, r, extra = []) {
    p.x = Math.max(-HALF + r, Math.min(HALF - r, p.x)); p.z = Math.max(-HALF + r, Math.min(HALF - r, p.z));
    for (const b of buildings) {
      const dx = p.x - b.x, dz = p.z - b.z, ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx) * ox; else p.z += Math.sign(dz) * oz; }
    }
    for (const c of [fountain, ...decor, ...extra]) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-6) { p.x += dx / d * (min - d); p.z += dz / d * (min - d); }
    }
    return p;
  }

  const api = { HALF, SPEED, RUN, R, PROPS, TYPES, buildings, decor, fountain, spawn, collide, BW, BD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PH = api;
})(this);
