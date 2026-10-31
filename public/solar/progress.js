// Progression d'un pilote : astres découverts, points, éléments débloqués au hangar et titres.
// Gardée dans le navigateur (c'est esthétique) ; aucune dépendance à three.js, pour être testable avec Node.
// Les identifiants doivent rester ceux de solar/game.js (CATALOG), que le serveur vérifie.

// need : points nécessaires pour débloquer l'élément
export const CATALOG = {
  model: {
    eclaireur: { name: 'Éclaireur', need: 0, desc: 'Polyvalent et maniable : le vaisseau des explorateurs.' },
    intercepteur: { name: 'Intercepteur', need: 0, desc: 'Effilé, ailes inversées et double réacteur.' },
    cargo: { name: 'Cargo', need: 0, desc: 'Massif et rassurant, avec quatre réacteurs.' },
    chasseur: { name: 'Chasseur lourd', need: 300, desc: 'Blindé, deux gros réacteurs et des nacelles d’armes.' },
    course: { name: 'Vaisseau de course', need: 600, desc: 'Une aiguille avec un énorme réacteur.' },
    soucoupe: { name: 'Soucoupe', need: 1000, desc: 'Le grand classique venu d’ailleurs.' },
    navette: { name: 'Navette rétro', need: 1500, desc: 'Une fusée des années 50, ailerons et hublot.' },
  },
  paint: {
    uni: { name: 'Uni', need: 0 }, bandes: { name: 'Bandes', need: 100 }, metal: { name: 'Métallisé', need: 200 },
    damier: { name: 'Damier', need: 400 }, flammes: { name: 'Flammes', need: 700 }, camo: { name: 'Camouflage', need: 900 },
    chrome: { name: 'Chromé', need: 1300 },
  },
  trail: {
    standard: { name: 'Lumineuse', need: 0 }, fumee: { name: 'Fumée', need: 150 }, flammes: { name: 'Flammes', need: 350 },
    etincelles: { name: 'Étincelles', need: 550 }, arcenciel: { name: 'Arc-en-ciel', need: 850 }, glitch: { name: 'Glitch', need: 1200 },
  },
  boost: {
    standard: { name: 'Standard', need: 0 }, plasma: { name: 'Plasma violet', need: 250 }, onde: { name: 'Onde de choc', need: 500 },
    eclair: { name: 'Éclairs', need: 800 },
  },
};
export const COLORS = ['#36d7ff', '#ff5c8a', '#ffb340', '#7cff6b', '#b07cff', '#ff6b3d', '#f5f7fa', '#2f6bff'];

// Points gagnés à la première visite, selon le genre d'endroit
export const POINTS = { star: 150, planet: 100, dwarf: 150, moon: 60, station: 20, zone: 80, comet: 200 };

// Titres affichés sous le pseudo ; has(v) : v = ensemble des endroits découverts
export const TITLES = {
  pilote: { name: 'Pilote', has: () => true },
  icare: { name: 'Icare', hint: 'Frôler le Soleil', has: v => v.has('soleil') },
  rouge: { name: 'Marcheur martien', hint: 'Mars, Phobos et Deimos', has: v => ['mars', 'phobos', 'deimos'].every(x => v.has(x)) },
  'as-kepler': { name: 'As du champ de Kepler', hint: 'Traverser le champ de Kepler', has: v => v.has('kepler') },
  jovien: { name: 'Ami des lunes joviennes', hint: 'Les 4 grandes lunes de Jupiter', has: v => ['io', 'europe', 'ganymede', 'callisto'].every(x => v.has(x)) },
  'explorateur-saturne': { name: 'Explorateur de Saturne', hint: 'Saturne et Titan', has: v => v.has('saturne') && v.has('titan') },
  confins: { name: 'Voyageur des confins', hint: 'Pluton et la ceinture de Kuiper', has: v => v.has('pluton') && v.has('kuiper') },
  'chasseur-comete': { name: 'Chasseur de comète', hint: 'Rattraper la comète de Halley', has: v => v.has('halley') },
  cartographe: { name: 'Cartographe du système', hint: 'Tout découvrir (100 %)', has: (v, all) => all.every(x => v.has(x)) },
};

export const unlocked = (points, kind, id) => (CATALOG[kind][id]?.need ?? Infinity) <= points;

// places : [{ id, kind }] (ce qu'on peut découvrir). store : { get(k), set(k, v) } (localStorage).
export function createProgress(places, store) {
  let data = { visited: {}, bonus: 0, km: 0 };
  try { data = { ...data, ...JSON.parse(store.get('se-progress') ?? '{}') }; } catch { /* progression illisible : on repart de zéro */ }
  const save = () => store.set('se-progress', JSON.stringify(data));
  const ids = places.map(p => p.id);
  const visited = () => new Set(Object.keys(data.visited));
  const points = () => places.reduce((s, p) => s + (data.visited[p.id] ? POINTS[p.kind] ?? 0 : 0), 0) + data.bonus + Math.floor(data.km / 5e6) * 10;
  const titles = () => Object.keys(TITLES).filter(t => TITLES[t].has(visited(), ids));
  const unlocks = pts => Object.entries(CATALOG).flatMap(([kind, items]) => Object.keys(items).filter(id => items[id].need <= pts).map(id => `${kind}:${id}`));
  // Applique un changement et renvoie ce qu'il a rapporté : points, nouveaux déblocages, nouveaux titres.
  const gain = change => {
    const before = { pts: points(), titles: titles(), unlocks: unlocks(points()) };
    change();
    save();
    const pts = points();
    return {
      gained: pts - before.pts,
      unlocks: unlocks(pts).filter(u => !before.unlocks.includes(u)).map(u => { const [kind, id] = u.split(':'); return { kind, id, name: CATALOG[kind][id].name }; }),
      titles: titles().filter(t => !before.titles.includes(t)).map(t => TITLES[t].name),
    };
  };
  return {
    visited, points, titles,
    percent: () => Math.floor((100 * ids.filter(id => data.visited[id]).length) / ids.length),
    has: id => !!data.visited[id],
    // Première visite d'un endroit (ou bonus ponctuel, ex. une comète de passage) ; null si déjà vu.
    discover(id, bonus = 0) {
      if (ids.includes(id) ? data.visited[id] : !bonus || data.visited[id]) return null;
      return gain(() => { data.visited[id] = Date.now(); data.bonus += bonus; });
    },
    // Distance parcourue : 10 points tous les 5 millions de km ; renvoie les gains quand un palier est franchi.
    travel(km) {
      const step = Math.floor((data.km + km) / 5e6) > Math.floor(data.km / 5e6);
      if (!step) { data.km += km; return null; }
      return gain(() => { data.km += km; });
    },
    flush: save,
  };
}
