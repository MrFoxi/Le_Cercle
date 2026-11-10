// Loup-Garou : ce que le serveur et le navigateur partagent (script classique : window.LG ou require).
// Rôles et composition, emotes, objets à lancer, apparence des personnages, sièges en cercle et place du village.
(function (root, factory) {
  const LG = factory();
  if (typeof module === 'object' && module.exports) module.exports = LG;
  else root.LG = LG;
})(this, () => {
  const ROLES = {
    loup: { name: 'Loup-Garou', icon: '🐺', camp: 'loups', text: 'Chaque nuit, avec ta meute, choisis un villageois à dévorer. Le jour, fais-toi passer pour un innocent.' },
    voyante: { name: 'Voyante', icon: '🔮', camp: 'village', text: 'Chaque nuit, ta boule de cristal te montre le vrai rôle d’un joueur.' },
    sorciere: { name: 'Sorcière', icon: '🧪', camp: 'village', text: 'Une potion de vie pour sauver la victime des loups, une potion de mort pour éliminer quelqu’un. Une seule fois chacune.' },
    chasseur: { name: 'Chasseur', icon: '🏹', camp: 'village', text: 'Si tu meurs, tu tires une dernière flèche sur le joueur de ton choix.' },
    villageois: { name: 'Villageois', icon: '🧑‍🌾', camp: 'village', text: 'Pas de pouvoir, mais ta voix compte : démasque les loups et vote juste !' },
  };
  const MIN_PLAYERS = 4, MAX_PLAYERS = 12;
  // Rôles de la partie selon le nombre de joueurs (la composition est connue de tous).
  function composition(n) {
    const list = Array(n <= 5 ? 1 : n <= 9 ? 2 : 3).fill('loup');
    list.push('voyante');
    if (n >= 6) list.push('sorciere');
    if (n >= 7) list.push('chasseur');
    while (list.length < n) list.push('villageois');
    return list;
  }

  const EMOTES = {
    rire: { icon: '😂', name: 'Rire', ms: 2200 },
    applaudir: { icon: '👏', name: 'Applaudir', ms: 2000 },
    pleurer: { icon: '😭', name: 'Pleurer', ms: 2600 },
    pointer: { icon: '👉', name: 'Accuser', ms: 2200 },
    danser: { icon: '💃', name: 'Danser', ms: 3200 },
    doigt: { icon: '🖕', name: 'Doigt d’honneur', ms: 1800 },
    tomber: { icon: '🪑', name: 'Tomber', ms: 2800 },
    coucou: { icon: '👋', name: 'Coucou', ms: 1800 },
    colere: { icon: '😡', name: 'Colère', ms: 2000 },
    bisou: { icon: '😘', name: 'Bisou', ms: 1600 },
  };
  const ITEMS = {
    tomate: { icon: '🍅', name: 'Tomate' },
    oeuf: { icon: '🥚', name: 'Œuf' },
    chaussure: { icon: '👞', name: 'Chaussure' },
    poisson: { icon: '🐟', name: 'Poisson' },
    chou: { icon: '🥬', name: 'Chou' },
    rose: { icon: '🌹', name: 'Rose' },
  };

  // Apparence : un numéro par réglage, dans cet ordre.
  const LOOK = {
    skin: ['#f8d9bd', '#efc19b', '#d39a6c', '#a86f47', '#6e442b'],
    hair: ['Court', 'Mèche', 'Long', 'Chignon', 'Hérissé', 'Tresses', 'Chauve'],
    hairColor: ['#2b1d16', '#6b3e22', '#b8642a', '#e8c170', '#b8322c', '#e9e4dc', '#36447f'],
    outfit: ['Tunique', 'Robe', 'Cape', 'Tablier', 'Gilet'],
    outfitColor: ['#b8432f', '#2f6b9a', '#4f7f3a', '#7a4a8f', '#d0902e', '#3a3f58', '#8a5a3a', '#d98aa0', '#2e8a7a', '#efe4cc'],
    hat: ['Aucun', 'Paille', 'Capuche', 'Couronne de fleurs', 'Bonnet', 'Chapeau à plume', 'Casque'],
    extra: ['Aucun', 'Lunettes', 'Moustache', 'Barbe', 'Foulard', 'Cache-œil'],
  };
  const LOOK_KEYS = Object.keys(LOOK);
  const validLook = a => Array.isArray(a) && a.length === LOOK_KEYS.length && a.every((v, k) => Number.isInteger(v) && v >= 0 && v < LOOK[LOOK_KEYS[k]].length);
  const randomLook = (rng = Math.random) => LOOK_KEYS.map(k => Math.floor(rng() * LOOK[k].length));

  // La place : un disque pavé avec une rosace au centre, des sièges en cercle (tournés vers le centre), des lanternes.
  const AREA = 12.5, R = 0.35, SPEED = 3.2, RUN = 5.2;
  const SEAT_KINDS = ['banc', 'chaise', 'souche', 'tonneau', 'tabouret', 'chaise'];
  const SEATS = Array.from({ length: MAX_PLAYERS }, (_, k) => {
    const a = (k / MAX_PLAYERS) * Math.PI * 2 + Math.PI / MAX_PLAYERS, x = Math.sin(a) * 6.6, z = Math.cos(a) * 6.6;
    return { x, z, ry: Math.atan2(-x, -z), kind: SEAT_KINDS[k % SEAT_KINDS.length] };
  });
  const LANTERNS = Array.from({ length: 6 }, (_, k) => { const a = ((k + 0.5) / 6) * Math.PI * 2; return { x: Math.sin(a) * 9.6, z: Math.cos(a) * 9.6 }; });
  const COLLIDERS = LANTERNS.map(l => ({ ...l, r: 0.3 }));
  // Repousse hors des lanternes, et garde sur la place (le centre est dégagé).
  function collide(p, r = R) {
    for (const c of COLLIDERS) {
      let dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d >= min) continue;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
      p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min;
    }
    const d = Math.hypot(p.x, p.z), max = AREA - r;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
    return p;
  }

  return { ROLES, MIN_PLAYERS, MAX_PLAYERS, composition, EMOTES, ITEMS, LOOK, LOOK_KEYS, validLook, randomLook, AREA, R, SPEED, RUN, SEATS, LANTERNS, collide };
});
