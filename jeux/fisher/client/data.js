// Little Fisher : le contenu du jeu (archipel, poissons, améliorations, habitants, trésors).
// Aucune dépendance à three.js : la logique (game.js) et les tests Node s'en servent aussi.

// ---------- L'archipel ---------- (x vers l'est, z vers le sud ; 1 unité ≈ 1 m)
// zone : eaux autour de l'île ; dock : direction du ponton (le bateau accoste là) ; village : on peut y vendre.
export const ISLANDS = [
  { id: 'port', name: 'Port-Galet', kind: 'foret', x: 0, z: 0, r: 78, zone: 'cote', dock: [0, 1], village: 'port',
    desc: 'Ton île : une forêt de pins, un petit port et le chantier naval du vieux Joseph.' },
  { id: 'palmes', name: 'Île aux Palmes', kind: 'tropical', x: 440, z: -250, r: 66, zone: 'recif', dock: [-0.9, 0.45], village: 'corail',
    desc: 'Plages blanches, cocotiers et un lagon turquoise. Le hameau d’Anse-Corail vit du récif.' },
  { id: 'falaises', name: 'Les Falaises', kind: 'roche', x: -470, z: -190, r: 88, zone: 'roche',
    desc: 'De hautes falaises grises où nichent les mouettes. Les rochers abritent des poissons coriaces.' },
  { id: 'phare', name: 'Îlot du Phare', kind: 'phare', x: -130, z: 740, r: 36, zone: 'phare', dock: [0.6, -0.8], village: 'phare',
    desc: 'Un rocher perdu au large et son phare. Le gardien Anselme y guette la brume.' },
  // petits îlots pour le décor (et pour pêcher sur la côte)
  { id: 'ilot1', kind: 'rocher', x: 210, z: 190, r: 16, zone: 'cote' },
  { id: 'ilot2', kind: 'rocher', x: -250, z: 280, r: 20, zone: 'cote' },
  { id: 'ilot3', kind: 'tropical', x: 180, z: -430, r: 22, zone: 'recif' },
  { id: 'ilot4', kind: 'rocher', x: -680, z: 260, r: 24, zone: 'roche' },
  { id: 'ilot5', kind: 'rocher', x: 640, z: 90, r: 15, zone: 'cote' },
  // au-delà de la haute mer
  { id: 'braise', name: 'Mont Braise', kind: 'volcan', x: -760, z: -600, r: 95, zone: 'volcan',
    desc: 'Un volcan qui fume doucement. Ses eaux sont tièdes et ses plages, noires comme du charbon.' },
  { id: 'glaciers', name: 'Les Glaciers', kind: 'glace', x: 120, z: -930, r: 90, zone: 'glace', dock: [0, 1], village: 'station',
    desc: 'Tout au nord, une île de neige et de glace. Une petite station de recherche y veille, et les nuits s’y colorent d’aurores.' },
  { id: 'naufrages', name: 'Baie des Naufrages', kind: 'banc', x: -860, z: 420, r: 70, zone: 'epaves',
    desc: 'Un banc de sable traître où des navires se sont échoués. Leurs carcasses cachent encore des trésors.' },
  { id: 'mangrove', name: 'Mangrove des Hérons', kind: 'mangrove', x: 470, z: 800, r: 110, zone: 'mangrove', dock: [-0.7, -0.7], village: 'heron',
    desc: 'Un labyrinthe de racines et de chenaux. Les hérons y pêchent aussi bien que toi.' },
];
export const WORLD = 1100;                       // au-delà : la brume, on ne peut pas aller plus loin
export const OPEN_SEA = 580;                     // au-delà de cette distance de Port-Galet : il faut une coque renforcée
export const NORTH = -800;                       // au nord de cette ligne (les Glaciers) : coque de haute mer
export const FOSSE = { x: 830, z: 440, r: 230, name: 'La Fosse' }; // eaux très profondes : coque de haute mer
export const CAVE = { x: -598, z: -168, r: 20, open: Math.PI, name: 'Grotte aux Lucioles' }; // dans les Falaises ; open : direction de l'entrée

export const ZONES = {
  cote: 'Côtes de Port-Galet', recif: 'Récif des Palmes', roche: 'Rochers des Falaises', phare: 'Eaux du Phare',
  large: 'Haute mer', fosse: 'La Fosse', volcan: 'Eaux tièdes du Mont Braise', glace: 'Mer des Glaciers',
  epaves: 'Baie des Naufrages', mangrove: 'Chenaux de la mangrove', grotte: 'Grotte aux Lucioles',
};
export const ZONE_SHORT = { cote: 'côtes de Port-Galet', recif: 'récif des Palmes', roche: 'rochers des Falaises', phare: 'eaux du Phare', large: 'haute mer', fosse: 'la Fosse',
  volcan: 'Mont Braise', glace: 'Glaciers', epaves: 'Baie des Naufrages', mangrove: 'mangrove', grotte: 'grotte aux Lucioles' };

// Coins de pêche : des remous où les poissons rares mordent plus souvent.
export const SPOTS = [
  { x: 95, z: 60, zone: 'cote' }, { x: -100, z: 95, zone: 'cote' }, { x: 60, z: -110, zone: 'cote' },
  { x: 380, z: -175, zone: 'recif' }, { x: 520, z: -310, zone: 'recif' }, { x: 205, z: -390, zone: 'recif' },
  { x: -380, z: -110, zone: 'roche' }, { x: -560, z: -250, zone: 'roche' }, { x: -640, z: 220, zone: 'roche' },
  { x: 230, z: 30, zone: 'large' }, { x: -260, z: -440, zone: 'large' }, { x: 300, z: 420, zone: 'large' },
  { x: -80, z: 680, zone: 'phare' }, { x: -190, z: 790, zone: 'phare' },
  { x: 800, z: 400, zone: 'fosse' }, { x: 900, z: 520, zone: 'fosse' },
  { x: -640, z: -560, zone: 'volcan' }, { x: -820, z: -480, zone: 'volcan' },
  { x: 20, z: -860, zone: 'glace' }, { x: 230, z: -870, zone: 'glace' },
  { x: -780, z: 470, zone: 'epaves' }, { x: -900, z: 330, zone: 'epaves' },
  { x: 360, z: 720, zone: 'mangrove' }, { x: 560, z: 690, zone: 'mangrove' },
  { x: -598, z: -168, zone: 'grotte' },
];

// ---------- Les poissons ----------
// zones : où il vit ; when : jour, nuit, crepuscule (aube et soir) ou toujours ; weather : pluie / brume s'il ne sort que par ce temps
// difficulty : 1 (facile) à 5 ; wait : attente avant la touche (s) ; size : taille en cm ; price : prix moyen
// look : forme (long, rond, plat, anguille, calmar, raie), couleurs et motif, pour le dessin du carnet
export const RARITY = {
  commun: { name: 'Commun', weight: 60, color: '#8aa39b' },
  peu: { name: 'Peu commun', weight: 26, color: '#3fa7d6' },
  rare: { name: 'Rare', weight: 9, color: '#b26ee8' },
  legende: { name: 'Légendaire', weight: 1.2, color: '#f2a93b' },
};
export const FISH = [
  // Côtes
  { id: 'sardine', name: 'Sardine argentée', zones: ['cote', 'large'], rarity: 'commun', price: 4, size: [12, 22], when: 'toujours', difficulty: 1, wait: [2, 5],
    look: { shape: 'long', body: '#b9cfe0', belly: '#eef5fb', accent: '#4f7aa3', pattern: 'plain' }, desc: 'Elle voyage en bancs serrés qui brillent comme des pièces sous la surface.' },
  { id: 'maquereau', name: 'Maquereau rayé', zones: ['cote', 'large'], rarity: 'commun', price: 6, size: [25, 40], when: 'jour', difficulty: 1, wait: [2, 6],
    look: { shape: 'long', body: '#3f8f7a', belly: '#e8f2ee', accent: '#173f37', pattern: 'stripes' }, desc: 'Vif et gourmand, il mord à tout ce qui brille.' },
  { id: 'rouget', name: 'Rouget doré', zones: ['cote'], rarity: 'peu', price: 13, size: [18, 30], when: 'jour', difficulty: 2, wait: [4, 9],
    look: { shape: 'long', body: '#e2614a', belly: '#ffd7a8', accent: '#f2c14e', pattern: 'stripes' }, desc: 'Ses barbillons fouillent le sable à la recherche de crevettes.' },
  { id: 'bar', name: 'Bar tacheté', zones: ['cote', 'roche'], rarity: 'peu', price: 16, size: [35, 65], when: 'crepuscule', difficulty: 3, wait: [5, 10],
    look: { shape: 'long', body: '#8d9aa8', belly: '#f0f2f4', accent: '#2f3a48', pattern: 'spots' }, desc: 'Il chasse à l’aube et au crépuscule, quand la lumière est rasante.' },
  { id: 'sole', name: 'Sole des sables', zones: ['cote'], rarity: 'peu', price: 14, size: [20, 35], when: 'toujours', difficulty: 2, wait: [6, 11],
    look: { shape: 'plat', body: '#b8986c', belly: '#e8d6b8', accent: '#7a5c3a', pattern: 'spots' }, desc: 'Posée à plat sur le fond, elle prend la couleur du sable.' },
  // Récif des Palmes
  { id: 'perroquet', name: 'Poisson-perroquet', zones: ['recif'], rarity: 'commun', price: 9, size: [25, 45], when: 'jour', difficulty: 1, wait: [2, 6],
    look: { shape: 'rond', body: '#3fc6b0', belly: '#a8f0de', accent: '#ff7eb6', pattern: 'stripes' }, desc: 'Il croque le corail avec son bec et rejette… du sable blanc.' },
  { id: 'labre', name: 'Labre arc-en-ciel', zones: ['recif'], rarity: 'peu', price: 18, size: [15, 28], when: 'jour', difficulty: 2, wait: [4, 9],
    look: { shape: 'long', body: '#ffcf4a', belly: '#fff2b8', accent: '#3a7bff', pattern: 'rainbow' }, desc: 'Chaque écaille a sa couleur. Les enfants d’Anse-Corail l’appellent « le peintre ».' },
  { id: 'lune', name: 'Poisson-lune', zones: ['recif', 'large'], rarity: 'peu', price: 22, size: [50, 120], when: 'jour', difficulty: 2, wait: [7, 13],
    look: { shape: 'rond', body: '#c9c3b8', belly: '#efebe4', accent: '#8b8478', pattern: 'plain' }, desc: 'Un énorme disque qui se dore au soleil, couché sur le flanc à la surface.' },
  { id: 'merou', name: 'Mérou corail', zones: ['recif'], rarity: 'rare', price: 45, size: [60, 110], when: 'toujours', difficulty: 4, wait: [8, 15],
    look: { shape: 'rond', body: '#d9483b', belly: '#ffb199', accent: '#5b1a14', pattern: 'spots' }, desc: 'Le maître du récif. Il se cache dans les grottes et tire très fort vers le fond.' },
  // Rochers des Falaises
  { id: 'vieille', name: 'Vieille de roche', zones: ['roche'], rarity: 'commun', price: 7, size: [20, 40], when: 'toujours', difficulty: 1, wait: [2, 6],
    look: { shape: 'rond', body: '#7c9a52', belly: '#d8e3b5', accent: '#c25b2c', pattern: 'spots' }, desc: 'Ses grosses lèvres broutent les algues des rochers.' },
  { id: 'rascasse', name: 'Rascasse', zones: ['roche'], rarity: 'peu', price: 17, size: [15, 35], when: 'toujours', difficulty: 3, wait: [5, 10],
    look: { shape: 'rond', body: '#c4472f', belly: '#f4b48f', accent: '#5c1f12', pattern: 'spines' }, desc: 'Hérissée d’épines, elle se fond dans la roche. Attention aux doigts.' },
  { id: 'congre', name: 'Congre', zones: ['roche', 'phare'], rarity: 'rare', price: 38, size: [80, 180], when: 'nuit', difficulty: 4, wait: [8, 14],
    look: { shape: 'anguille', body: '#4b5560', belly: '#a7b0b8', accent: '#1d2328', pattern: 'plain' }, desc: 'Un long serpent de mer qui ne sort de son trou que la nuit.' },
  // Haute mer
  { id: 'daurade', name: 'Daurade royale', zones: ['large', 'cote'], rarity: 'peu', price: 19, size: [30, 55], when: 'jour', difficulty: 2, wait: [5, 10],
    look: { shape: 'rond', body: '#a9b8c4', belly: '#eef2f5', accent: '#e6b422', pattern: 'band' }, desc: 'Un sourcil d’or entre les yeux : c’est sa couronne.' },
  { id: 'thon', name: 'Thon rouge', zones: ['large'], rarity: 'rare', price: 55, size: [90, 200], when: 'jour', difficulty: 4, wait: [8, 15],
    look: { shape: 'long', body: '#23406e', belly: '#d9e2ea', accent: '#f2c14e', pattern: 'finlets' }, desc: 'Une torpille d’acier bleu qui traverse l’océan tout entier.' },
  { id: 'espadon', name: 'Espadon', zones: ['large', 'fosse'], rarity: 'rare', price: 75, size: [150, 300], when: 'toujours', difficulty: 5, wait: [10, 18], minRod: 1,
    look: { shape: 'epee', body: '#3d4f7a', belly: '#d5dbe6', accent: '#1b2440', pattern: 'plain' }, desc: 'Son épée fend l’eau. Il faut une canne solide pour le ramener.' },
  // Eaux du Phare
  { id: 'calmar', name: 'Calmar luciole', zones: ['phare', 'large'], rarity: 'peu', price: 24, size: [15, 30], when: 'nuit', difficulty: 2, wait: [4, 9],
    look: { shape: 'calmar', body: '#7fd8ff', belly: '#d7f4ff', accent: '#3a7bff', pattern: 'glow' }, desc: 'La nuit, il s’allume de petits points bleus pour attirer ses proies.' },
  { id: 'lanterne', name: 'Lanterne des brumes', zones: ['phare'], rarity: 'rare', price: 60, size: [20, 40], when: 'nuit', weather: 'brume', difficulty: 3, wait: [8, 14],
    look: { shape: 'rond', body: '#3b3552', belly: '#6f6690', accent: '#ffe27a', pattern: 'lure' }, desc: 'Elle ne monte que les nuits de brume, une petite lanterne pendue au front.' },
  { id: 'hareng', name: 'Hareng du nord', zones: ['phare', 'large'], rarity: 'commun', price: 6, size: [20, 32], when: 'toujours', difficulty: 1, wait: [2, 6],
    look: { shape: 'long', body: '#8fa7b8', belly: '#e9eff3', accent: '#3e5566', pattern: 'plain' }, desc: 'Les eaux froides du phare en regorgent.' },
  // La Fosse
  { id: 'grenadier', name: 'Grenadier', zones: ['fosse'], rarity: 'commun', price: 20, size: [40, 80], when: 'toujours', difficulty: 2, wait: [4, 9],
    look: { shape: 'anguille', body: '#7d6d8f', belly: '#c6b8d6', accent: '#3a2f48', pattern: 'plain' }, desc: 'Une grosse tête, une queue en pointe : il vit tout au fond, dans le noir.' },
  { id: 'baudroie', name: 'Baudroie abyssale', zones: ['fosse'], rarity: 'peu', price: 48, size: [40, 90], when: 'toujours', difficulty: 3, wait: [7, 12],
    look: { shape: 'rond', body: '#3a2f2a', belly: '#6b5a50', accent: '#9effd8', pattern: 'lure' }, desc: 'Une bouche immense et une lumière au bout d’une canne. Elle pêche, elle aussi.' },
  { id: 'dragon', name: 'Poisson-dragon', zones: ['fosse'], rarity: 'rare', price: 95, size: [25, 45], when: 'nuit', difficulty: 4, wait: [9, 16],
    look: { shape: 'anguille', body: '#161a2e', belly: '#2d3354', accent: '#ff5ca8', pattern: 'glow' }, desc: 'Noir comme l’encre, avec des dents de verre et des lumières roses.' },
  // Légendaires (canne de carbone au moins)
  { id: 'roi', name: 'Roi des Sardines', zones: ['cote'], rarity: 'legende', price: 300, size: [40, 50], when: 'crepuscule', difficulty: 4, wait: [12, 20], minRod: 2,
    look: { shape: 'long', body: '#f5d76e', belly: '#fff6cf', accent: '#c99a1d', pattern: 'crown' }, desc: 'Selon Joseph, il guide tous les bancs de l’archipel. Une couronne d’écailles dorées.' },
  { id: 'raie', name: 'Raie céleste', zones: ['large'], rarity: 'legende', price: 450, size: [200, 350], when: 'nuit', difficulty: 4, wait: [12, 20], minRod: 2,
    look: { shape: 'raie', body: '#1f2b5c', belly: '#4b5fa8', accent: '#ffffff', pattern: 'stars' }, desc: 'Son dos est couvert d’étoiles. Les nuits claires, on la voit voler sous la mer.' },
  { id: 'leviathan', name: 'Léviathan d’argent', zones: ['fosse'], rarity: 'legende', price: 900, size: [400, 600], when: 'nuit', weather: 'pluie', difficulty: 5, wait: [15, 25], minRod: 3,
    look: { shape: 'anguille', body: '#cfd8e3', belly: '#ffffff', accent: '#7aa7d6', pattern: 'scales' }, desc: 'La légende de l’archipel. Il ne remonte de la Fosse que les nuits d’orage.' },
];

// Les poissons des terres lointaines
FISH.push(
  // Mont Braise (eaux tièdes)
  { id: 'gobie', name: 'Gobie des sources', zones: ['volcan'], rarity: 'commun', price: 11, size: [8, 16], when: 'toujours', difficulty: 1, wait: [2, 5],
    look: { shape: 'long', body: '#8a6a52', belly: '#d8b898', accent: '#ff8a3a', pattern: 'spots' }, desc: 'Il adore l’eau chaude qui sort des roches du volcan.' },
  { id: 'braisefish', name: 'Poisson-braise', zones: ['volcan'], rarity: 'peu', price: 32, size: [20, 40], when: 'jour', difficulty: 3, wait: [5, 10],
    look: { shape: 'rond', body: '#3a2a26', belly: '#6a4a3a', accent: '#ff6a2a', pattern: 'glow' }, desc: 'Ses écailles rougeoient comme des braises quand il nage près des sources.' },
  { id: 'salamandre', name: 'Salamandre de mer', zones: ['volcan'], rarity: 'rare', price: 88, size: [50, 110], when: 'nuit', difficulty: 4, wait: [8, 15],
    look: { shape: 'anguille', body: '#2a1a1a', belly: '#5a2a1a', accent: '#ffb02a', pattern: 'spots' }, desc: 'La nuit, elle se glisse hors des fissures du volcan, tachetée de feu.' },
  { id: 'phenix', name: 'Phénix des abysses', zones: ['volcan'], rarity: 'legende', price: 700, size: [80, 140], when: 'crepuscule', weather: 'clair', difficulty: 5, wait: [15, 25], minRod: 3,
    look: { shape: 'long', body: '#ff7a2a', belly: '#ffd27a', accent: '#ff2a2a', pattern: 'glow' }, desc: 'On raconte qu’il renaît chaque soir dans le volcan, quand le ciel s’enflamme.' },
  // Les Glaciers
  { id: 'morue', name: 'Morue polaire', zones: ['glace'], rarity: 'commun', price: 10, size: [30, 60], when: 'toujours', difficulty: 1, wait: [2, 6],
    look: { shape: 'long', body: '#9aa08a', belly: '#eeeedd', accent: '#5a604a', pattern: 'spots' }, desc: 'Elle supporte l’eau glacée sans broncher.' },
  { id: 'omble', name: 'Omble arctique', zones: ['glace'], rarity: 'peu', price: 28, size: [35, 70], when: 'jour', difficulty: 2, wait: [5, 10],
    look: { shape: 'long', body: '#5a7a8a', belly: '#ff8a6a', accent: '#ffd0c0', pattern: 'spots' }, desc: 'Un ventre rouge vif sous un dos couleur de glace.' },
  { id: 'glassfish', name: 'Poisson des glaces', zones: ['glace'], rarity: 'rare', price: 72, size: [20, 40], when: 'toujours', weather: 'brume', difficulty: 3, wait: [8, 14],
    look: { shape: 'long', body: '#d8f0ff', belly: '#ffffff', accent: '#9ad8ff', pattern: 'plain' }, desc: 'Presque transparent : son sang n’a pas de rouge. Il sort dans la brume.' },
  { id: 'requin', name: 'Requin des glaces', zones: ['glace'], rarity: 'rare', price: 130, size: [200, 400], when: 'nuit', difficulty: 5, wait: [12, 20], minRod: 2,
    look: { shape: 'long', body: '#4a5560', belly: '#a8b0b8', accent: '#2a3038', pattern: 'plain' }, desc: 'Lent, énorme et très vieux : certains auraient plus de trois cents ans.' },
  // Baie des Naufrages
  { id: 'lion', name: 'Rascasse volante', zones: ['epaves'], rarity: 'peu', price: 34, size: [20, 38], when: 'toujours', difficulty: 3, wait: [5, 10],
    look: { shape: 'rond', body: '#e8a080', belly: '#fff0e0', accent: '#8a2a1a', pattern: 'stripes' }, desc: 'Des nageoires comme des éventails, et des épines venimeuses. Elle adore les épaves.' },
  { id: 'barracuda', name: 'Barracuda', zones: ['epaves', 'large'], rarity: 'peu', price: 30, size: [60, 150], when: 'jour', difficulty: 3, wait: [5, 10],
    look: { shape: 'long', body: '#8a9aa8', belly: '#e8eef2', accent: '#2a3a48', pattern: 'stripes' }, desc: 'Une flèche aux dents pointues qui patrouille autour des carcasses.' },
  { id: 'pierre', name: 'Poisson-pierre', zones: ['epaves'], rarity: 'rare', price: 64, size: [20, 40], when: 'toujours', difficulty: 4, wait: [9, 15],
    look: { shape: 'rond', body: '#7a6a58', belly: '#a89a88', accent: '#4a3a28', pattern: 'spots' }, desc: 'On le prend pour un caillou… jusqu’à ce qu’il bouge.' },
  // Mangrove des Hérons
  { id: 'barramundi', name: 'Barramundi', zones: ['mangrove'], rarity: 'commun', price: 15, size: [40, 90], when: 'toujours', difficulty: 2, wait: [3, 7],
    look: { shape: 'long', body: '#a8a890', belly: '#f0f0e0', accent: '#5a5a48', pattern: 'plain' }, desc: 'Le poisson roi des chenaux, à l’œil rouge.' },
  { id: 'archer', name: 'Poisson-archer', zones: ['mangrove'], rarity: 'peu', price: 27, size: [12, 25], when: 'jour', difficulty: 2, wait: [4, 9],
    look: { shape: 'rond', body: '#e8e0b0', belly: '#fffff0', accent: '#2a2a2a', pattern: 'band' }, desc: 'Il crache un jet d’eau pour faire tomber les insectes des feuilles. En plein dans le mille !' },
  { id: 'tarpon', name: 'Tarpon argenté', zones: ['mangrove'], rarity: 'rare', price: 84, size: [100, 200], when: 'crepuscule', difficulty: 4, wait: [9, 16],
    look: { shape: 'long', body: '#c8d0d8', belly: '#ffffff', accent: '#6a7a8a', pattern: 'scales' }, desc: 'Le roi d’argent : quand il saute, on dirait un miroir qui vole.' },
  // Grotte aux Lucioles
  { id: 'aveugle', name: 'Poisson aveugle', zones: ['grotte'], rarity: 'peu', price: 42, size: [8, 15], when: 'toujours', difficulty: 2, wait: [4, 9],
    look: { shape: 'long', body: '#f0d8d8', belly: '#fff0f0', accent: '#e0b0b0', pattern: 'plain' }, desc: 'Il n’a jamais vu le soleil : rose pâle, sans yeux, il se guide au toucher.' },
  { id: 'lucifer', name: 'Poisson-lucifer', zones: ['grotte'], rarity: 'rare', price: 96, size: [15, 30], when: 'toujours', difficulty: 4, wait: [9, 16],
    look: { shape: 'anguille', body: '#101830', belly: '#203060', accent: '#7affd8', pattern: 'glow' }, desc: 'Il brille comme les lucioles de la grotte. Certains disent que ce sont elles, les lucioles.' },
);
// Pris seulement dans les casiers (trap : eaux où le casier les attrape) ou en plongée au harpon (dive).
FISH.push(
  { id: 'crabe', name: 'Crabe vert', zones: [], trap: ['cote', 'recif', 'roche', 'phare'], rarity: 'commun', price: 6, size: [6, 11], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'crabe', body: '#5f8f3a', belly: '#a9c46a', accent: '#2f4f1f', pattern: 'plain' }, desc: 'Il court de travers et pince tout ce qui bouge.' },
  { id: 'etrille', name: 'Étrille', zones: [], trap: ['cote', 'roche'], rarity: 'peu', price: 14, size: [6, 10], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'crabe', body: '#5a4a8a', belly: '#9a8ac0', accent: '#e04848', pattern: 'spots' }, desc: 'Un petit crabe aux yeux rouges, réputé pour sa chair fine.' },
  { id: 'araignee', name: 'Araignée de mer', zones: [], trap: ['cote', 'phare'], rarity: 'peu', price: 18, size: [12, 22], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'crabe', body: '#d08a4a', belly: '#f0c08a', accent: '#8a4a1a', pattern: 'spines' }, desc: 'De longues pattes fines et une carapace hérissée de piquants.' },
  { id: 'poulpe', name: 'Poulpe', zones: [], trap: ['roche', 'recif'], rarity: 'peu', price: 24, size: [30, 90], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'poulpe', body: '#c8645a', belly: '#f0a89a', accent: '#7a2a24', pattern: 'spots' }, desc: 'Huit bras, trois cœurs, et assez malin pour entrer dans le casier… mais pas pour en sortir.' },
  { id: 'paletuvier', name: 'Crabe de palétuvier', zones: [], trap: ['mangrove'], rarity: 'peu', price: 22, size: [8, 14], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'crabe', body: '#2a6a7a', belly: '#6ab0c0', accent: '#e0402a', pattern: 'plain' }, desc: 'Il grimpe aux racines de la mangrove, une pince rouge plus grosse que l’autre.' },
  { id: 'royal', name: 'Crabe royal', zones: [], trap: ['glace'], rarity: 'rare', price: 95, size: [40, 80], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'crabe', body: '#c84a3a', belly: '#f0a088', accent: '#7a1a10', pattern: 'spines' }, desc: 'Des pattes d’un mètre et une carapace hérissée : le trésor des eaux glacées.' },
  { id: 'langouste', name: 'Langouste royale', zones: [], trap: ['recif'], rarity: 'rare', price: 58, size: [25, 45], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'homard', body: '#e0703a', belly: '#f5b07a', accent: '#8a3010', pattern: 'spots' }, desc: 'Ses longues antennes dépassent du casier. Soir de fête à Anse-Corail !' },
  { id: 'homard', name: 'Homard bleu', zones: [], trap: ['roche', 'phare'], rarity: 'rare', price: 72, size: [25, 50], when: 'toujours', difficulty: 1, wait: [1, 2],
    look: { shape: 'homard', body: '#2f5fa8', belly: '#7aa0d8', accent: '#14284a', pattern: 'plain' }, desc: 'Bleu comme la nuit, avec deux pinces énormes.' },
  { id: 'ange', name: 'Poisson-ange royal', zones: [], dive: ['recif'], rarity: 'rare', price: 66, size: [20, 35], when: 'toujours', difficulty: 3, wait: [1, 2],
    look: { shape: 'ange', body: '#ffcf3a', belly: '#ffe9a0', accent: '#2a3fbf', pattern: 'stripes' }, desc: 'Le joyau du lagon : on ne l’approche qu’en plongée.' },
  { id: 'baliste', name: 'Baliste picasso', zones: [], dive: ['recif'], rarity: 'peu', price: 28, size: [18, 30], when: 'toujours', difficulty: 2, wait: [1, 2],
    look: { shape: 'rond', body: '#e8e0c8', belly: '#fff8e6', accent: '#2a2a2a', pattern: 'band' }, desc: 'On dirait qu’un peintre l’a dessiné. Il grogne quand on l’approche !' },
  { id: 'murene', name: 'Murène tigrée', zones: [], dive: ['recif', 'cote'], rarity: 'peu', price: 32, size: [60, 140], when: 'toujours', difficulty: 2, wait: [1, 2],
    look: { shape: 'anguille', body: '#d8c050', belly: '#f0e0a0', accent: '#3a3010', pattern: 'spots' }, desc: 'Elle guette depuis son trou, la bouche ouverte. Impressionnante, mais pas méchante.' },
);
// L'appât préféré de chaque poisson (il mord trois fois plus souvent avec), et sa façon de se battre au moulinet :
// calme, course (il file et la vitesse change), fond (il tire vers le fond : l'arc rétrécit), saut (l'arc bouge), zigzag (l'aiguille change de sens).
const BAIT_OF = { maquereau: 'leurre', rouget: 'ver', bar: 'leurre', sole: 'ver', perroquet: 'crevette', labre: 'crevette', merou: 'calmar', vieille: 'crevette',
  rascasse: 'ver', congre: 'calmar', daurade: 'crevette', thon: 'leurre', espadon: 'calmar', calmar: 'lumineux', lanterne: 'lumineux', hareng: 'leurre',
  grenadier: 'ver', baudroie: 'lumineux', dragon: 'lumineux', roi: 'leurre', raie: 'lumineux', leviathan: 'calmar', lune: 'crevette',
  gobie: 'ver', braisefish: 'crevette', salamandre: 'calmar', phenix: 'lumineux', morue: 'ver', omble: 'leurre', glassfish: 'lumineux', requin: 'calmar',
  lion: 'crevette', barracuda: 'leurre', pierre: 'ver', barramundi: 'ver', archer: 'crevette', tarpon: 'leurre', aveugle: 'ver', lucifer: 'lumineux' };
const FIGHT_OF = { thon: 'course', espadon: 'saut', merou: 'fond', congre: 'fond', baudroie: 'fond', leviathan: 'course', raie: 'saut', bar: 'zigzag',
  rascasse: 'zigzag', daurade: 'zigzag', dragon: 'zigzag', roi: 'saut', labre: 'zigzag', maquereau: 'course', lune: 'fond', grenadier: 'fond',
  salamandre: 'fond', phenix: 'saut', requin: 'fond', barracuda: 'course', tarpon: 'saut', lion: 'zigzag', lucifer: 'zigzag', omble: 'course', pierre: 'fond' };
const DIVE_OF = { perroquet: ['recif'], labre: ['recif'], merou: ['recif'], rouget: ['cote'], bar: ['cote'], sole: ['cote'], sardine: ['cote'] };
for (const f of FISH) { f.bait = BAIT_OF[f.id] ?? null; f.fight = FIGHT_OF[f.id] ?? 'calme'; f.trap ??= null; f.dive ??= DIVE_OF[f.id] ?? null; }
export const FIGHTS = { calme: '', course: 'Il file au large !', fond: 'Il tire vers le fond !', saut: 'Il saute hors de l’eau !', zigzag: 'Il zigzague dans tous les sens !' };

// ---------- Appâts (vendus par paquets ; le leurre ne s'use pas) ----------
export const BAITS = {
  ver: { name: 'Vers de vase', icon: '🪱', pack: 5, cost: 8, desc: 'Les poissons de fond en raffolent : rouget, sole, rascasse…' },
  crevette: { name: 'Crevettes', icon: '🦐', pack: 5, cost: 12, desc: 'Le régal des poissons du récif.' },
  calmar: { name: 'Lamelles de calmar', icon: '🦑', pack: 5, cost: 20, desc: 'Pour les gros : mérou, congre, espadon…' },
  lumineux: { name: 'Appât lumineux', icon: '✨', pack: 5, cost: 25, desc: 'Brille dans le noir : les poissons de nuit mordent même sans lanterne.' },
  leurre: { name: 'Leurre argenté', icon: '🎏', pack: 1, cost: 90, forever: true, desc: 'Ne s’use jamais. Les chasseurs (maquereau, bar, thon) ne lui résistent pas.' },
};
export const BAIT_SHOPS = { port: ['ver', 'calmar', 'leurre'], corail: ['crevette', 'lumineux', 'calmar'] };
export const GEAR = {
  harpon: { name: 'Masque et harpon', icon: '🤿', cost: 260, shop: 'corail', desc: 'Plonge là où l’eau est claire et peu profonde (touche H) et chasse au harpon. On y trouve aussi des huîtres perlières.' },
  grappin: { name: 'Grappin et aimant', icon: '🪝', cost: 340, shop: 'port', desc: 'Arrête-toi au-dessus d’une épave et fouille-la (touche E) : pièces, et parfois une relique ancienne.' },
};

// ---------- Améliorations (chantier naval de Port-Galet) ----------
// levels[k] : le niveau k ; le niveau 0 est celui du départ (gratuit).
export const UPGRADES = {
  moteur: { name: 'Moteur', icon: '⚙️', levels: [
    { name: 'Moteur de barque', cost: 0, speed: 13 }, { name: 'Moteur deux-temps', cost: 140, speed: 18 },
    { name: 'Moteur marin', cost: 420, speed: 24 }, { name: 'Moteur de course', cost: 1100, speed: 31 }] },
  cale: { name: 'Cale', icon: '📦', levels: [
    { name: 'Petit panier', cost: 0, slots: 6 }, { name: 'Caisses en bois', cost: 110, slots: 10 },
    { name: 'Cale réfrigérée', cost: 380, slots: 16 }, { name: 'Grande cale', cost: 950, slots: 24 }] },
  canne: { name: 'Canne', icon: '🎣', levels: [
    { name: 'Canne en bambou', cost: 0, arc: 0.95, luck: 1 }, { name: 'Canne en fibre', cost: 180, arc: 1.15, luck: 1.35 },
    { name: 'Canne en carbone', cost: 600, arc: 1.35, luck: 1.8 }, { name: 'Canne de légende', cost: 1800, arc: 1.55, luck: 2.4 }] },
  coque: { name: 'Coque', icon: '⛵', levels: [
    { name: 'Coque en bois', cost: 0, desc: 'Pour les eaux calmes de l’archipel.' },
    { name: 'Coque renforcée', cost: 300, desc: 'Tient la haute mer : le phare et le large.' },
    { name: 'Coque de haute mer', cost: 1200, desc: 'Affronte les creux de la Fosse et les eaux glacées du nord.' }] },
  lanterne: { name: 'Lanterne', icon: '🏮', levels: [
    { name: 'Pas de lanterne', cost: 0 }, { name: 'Lanterne de pont', cost: 160, desc: 'Éclaire la nuit : les poissons nocturnes mordent à sa lumière.' }] },
  filet: { name: 'Filet de traîne', icon: '🥅', levels: [
    { name: 'Pas de filet', cost: 0 }, { name: 'Petit filet de traîne', cost: 220, every: 260, desc: 'Se déploie derrière le bateau (touche N) et attrape des petits poissons pendant que tu navigues.' },
    { name: 'Grand filet', cost: 700, every: 150, desc: 'Attrape deux fois plus souvent.' }] },
  casiers: { name: 'Casiers', icon: '🦀', levels: [
    { name: 'Aucun casier', cost: 0, count: 0 }, { name: '2 casiers', cost: 150, count: 2, desc: 'Pose-les sur un fond peu profond (touche T) et reviens quelques heures plus tard.' },
    { name: '4 casiers', cost: 450, count: 4 }, { name: '6 casiers', cost: 900, count: 6 }] },
};

// ---------- Villages et habitants ----------
export const VILLAGES = {
  port: { name: 'Port-Galet', island: 'port', shop: true, market: 1 },
  corail: { name: 'Anse-Corail', island: 'palmes', shop: false, market: 1.1 }, // on y paie un peu mieux
  phare: { name: 'Le Phare', island: 'phare', shop: false, market: 0 },        // pas de marché, juste le gardien
  station: { name: 'Station Boréale', island: 'glaciers', shop: false, market: 1.2 }, // loin de tout : on y paie bien
  heron: { name: 'Cabane des Hérons', island: 'mangrove', shop: false, market: 1 },
};

// Missions : catch (rapporter un poisson), sell (vendre n poissons), find (rapporter un objet trouvé en mer), see (voir un lieu).
export const PEOPLE = [
  { id: 'joseph', name: 'Joseph', role: 'Charpentier de marine', village: 'port', face: '🧔',
    hello: 'Ah, te voilà moussaillon ! Ton bateau est petit mais il flotte. Va pêcher, vends au marché, et je t’améliorerai tout ça.',
    quests: [
      { id: 'debut', text: 'Vends tes 3 premiers poissons au marché.', type: 'sell', count: 3, reward: 30, done: 'Bravo ! Voilà pour l’essence. La mer est à toi.' },
      { id: 'palmes', text: 'Va voir l’Île aux Palmes, à l’est. Le hameau d’Anse-Corail t’achètera tes poissons.', type: 'see', place: 'palmes', reward: 40, done: 'Alors, ce lagon ? Il paraît que le mérou y est énorme.' },
      { id: 'roi', text: 'On dit qu’un Roi des Sardines nage au crépuscule autour de Port-Galet. Rapporte-le moi.', type: 'catch', fish: 'roi', reward: 500, done: 'Par ma barbe… il existe vraiment ! Tu es un vrai pêcheur, maintenant.' },
    ] },
  { id: 'lucie', name: 'Lucie', role: 'Poissonnière', village: 'port', face: '👩‍🍳',
    hello: 'Mes clients réclament du poisson frais ! Si tu croises un bar, pense à moi.',
    quests: [
      { id: 'bar', text: 'Rapporte-moi un Bar tacheté. Il mord à l’aube et au crépuscule.', type: 'catch', fish: 'bar', reward: 60, done: 'Magnifique ! Ce soir, bar grillé au fenouil.' },
      { id: 'sole', text: 'Une Sole des sables pour la fête du port ?', type: 'catch', fish: 'sole', reward: 50, done: 'Parfait, elle sera à la meunière.' },
    ] },
  { id: 'gustave', name: 'Gustave', role: 'Vieux marin', village: 'port', face: '👴',
    hello: 'Quand j’avais ton âge, j’ai perdu mon alliance en mer, du côté des Falaises. Elle flottait dans une petite boîte…',
    quests: [
      { id: 'alliance', text: 'Retrouve la boîte de Gustave, quelque part près des Falaises.', type: 'find', item: 'alliance', reward: 150, done: 'Ma bague… cinquante ans après. Merci, petit. Merci.' },
    ] },
  { id: 'ines', name: 'Inès', role: 'Plongeuse', village: 'corail', face: '🤿',
    hello: 'Le récif est vivant, tu sais. Je plonge tous les jours et je ne m’en lasse pas. Si tu veux essayer, je vends masques et harpons à la boutique.',
    quests: [
      { id: 'labre', text: 'Montre-moi un Labre arc-en-ciel, pour mon carnet de dessins.', type: 'catch', fish: 'labre', reward: 80, done: 'Regarde ces couleurs ! Je le dessine et je te le rends… enfin, je le garde.' },
      { id: 'merou', text: 'Le vieux Mérou corail du récif… personne ne l’a jamais sorti de l’eau.', type: 'catch', fish: 'merou', reward: 220, done: 'Incroyable. Il est encore plus gros que dans mes rêves.' },
      { id: 'ange', text: 'Prends mon masque et mon harpon (boutique), plonge dans le lagon (touche H) et montre-moi un Poisson-ange royal.', type: 'catch', fish: 'ange', reward: 180, done: 'Tu l’as vu de près, hein ? Le plus beau poisson du monde.' },
    ] },
  { id: 'kai', name: 'Kaï', role: 'Gamin du hameau', village: 'corail', face: '🧒',
    hello: 'T’as vu le phare, au sud-ouest ? Mon oncle dit qu’il faut une coque solide pour y aller.',
    quests: [
      { id: 'bouteille', text: 'J’ai jeté une bouteille à la mer avec un dessin dedans ! Tu l’as vue ? Elle dérivait vers l’ouest.', type: 'find', item: 'dessin', reward: 70, done: 'Tu l’as retrouvée ! Garde le dessin, c’est un cadeau.' },
    ] },
  { id: 'lena', name: 'Léna', role: 'Chercheuse polaire', village: 'station', face: '👩‍🔬',
    hello: 'Bienvenue au bout du monde ! J’étudie les poissons qui vivent dans l’eau glacée. Et les nuits claires… regarde le ciel.',
    quests: [
      { id: 'glassfish', text: 'Un Poisson des glaces, pour mes recherches. Il ne sort que les jours de brume.', type: 'catch', fish: 'glassfish', reward: 160, done: 'Transparent ! Regarde, on voit son cœur battre. Merci !' },
      { id: 'aurore', text: 'Reste au large des Glaciers par une nuit claire et regarde les aurores.', type: 'see', place: 'aurore', reward: 120, done: 'Magnifique, n’est-ce pas ? Je ne m’en lasse pas.' },
    ] },
  { id: 'tibo', name: 'Tibo', role: 'Passeur de la mangrove', village: 'heron', face: '🧑‍🦱',
    hello: 'Ici, les chenaux changent avec la marée. Suis les hérons : ils savent où sont les poissons.',
    quests: [
      { id: 'archer', text: 'Attrape un Poisson-archer, celui qui crache sur les insectes !', type: 'catch', fish: 'archer', reward: 70, done: 'Il m’a craché dessus, le coquin. Merci !' },
      { id: 'tarpon', text: 'Le Tarpon argenté saute au crépuscule. Personne ici n’en a jamais sorti un.', type: 'catch', fish: 'tarpon', reward: 260, done: 'Un vrai miroir volant ! Tu es le roi de la mangrove.' },
    ] },
  { id: 'anselme', name: 'Anselme', role: 'Gardien du phare', village: 'phare', face: '🧑‍✈️',
    hello: 'Peu de bateaux viennent jusqu’ici. Les nuits de brume, des lueurs montent de l’eau… et les nuits d’orage, du côté de la Fosse, quelque chose d’énorme.',
    quests: [
      { id: 'calmar', text: 'Rapporte-moi un Calmar luciole : sa lumière me tient compagnie.', type: 'catch', fish: 'calmar', reward: 90, done: 'Merci. Il brillera dans mon bocal, là-haut.' },
      { id: 'fosse', text: 'Va voir la Fosse, à l’est. Il te faudra la coque de haute mer de Joseph.', type: 'see', place: 'fosse', reward: 200, done: 'Tu en es revenu ! Alors tu as entendu le Léviathan, toi aussi…' },
    ] },
];

// ---------- Trésors (objets qui flottent, une seule fois chacun) ----------
// kind : bouteille, coffre ou boîte ; money : ce qu'il contient ; item : objet de mission ; note : message trouvé dedans
export const TREASURES = [
  { id: 't1', kind: 'bouteille', x: 150, z: 120, money: 15, note: '« Si tu lis ceci, les sardines remontent toujours à la tombée du jour. »' },
  { id: 't2', kind: 'coffre', x: -330, z: -300, money: 120, note: 'Un petit coffre de corsaire, couvert de coquillages.' },
  { id: 'alliance', kind: 'boite', x: -560, z: -60, item: 'alliance', name: 'Boîte de Gustave', note: 'Une petite boîte en fer : dedans, une alliance en or gravée « G & M ».' },
  { id: 'dessin', kind: 'bouteille', x: -330, z: 130, item: 'dessin', name: 'Bouteille de Kaï', note: 'Le dessin d’un bateau… qui ressemble beaucoup au tien.' },
  { id: 't3', kind: 'coffre', x: 560, z: -140, money: 90, note: 'Des pièces anciennes, frappées d’un poisson couronné.' },
  { id: 't4', kind: 'bouteille', x: 40, z: 480, money: 25, note: '« Le gardien du phare aime les calmars. Et les visites. »' },
  { id: 't5', kind: 'coffre', x: -240, z: 830, money: 200, note: 'Un coffre lesté, à moitié pris dans les algues. Lourd !' },
  { id: 't6', kind: 'coffre', x: 960, z: 560, money: 400, note: 'Au fond de la Fosse, un coffre remonté par le courant. Plein d’or.' },
  { id: 't7', kind: 'bouteille', x: 700, z: -420, money: 30, note: '« La raie céleste ne sort que les nuits claires, loin des côtes. »' },
  // bouteilles qui contiennent une carte au trésor (map : la chasse qu'elles lancent)
  { id: 'm1', kind: 'bouteille', x: 330, z: -40, map: 'h1', note: 'Un vieux parchemin roulé : une carte au trésor !' },
  { id: 'm2', kind: 'bouteille', x: -420, z: 420, map: 'h2', note: 'Une carte déchirée, tachée de sel.' },
  { id: 'm3', kind: 'bouteille', x: -640, z: -760, map: 'h3', note: 'Une carte roussie par la chaleur.' },
  { id: 'm4', kind: 'bouteille', x: 330, z: -760, map: 'h4', note: 'Une carte raide de givre.' },
  { id: 't8', kind: 'coffre', x: -700, z: 520, money: 260, note: 'Un coffre de marine tombé d’une des épaves, intact.' },
  { id: 't9', kind: 'bouteille', x: 620, z: 860, money: 35, note: '« Les hérons pêchent au lever du jour. Fais comme eux. »' },
];

// ---------- Reliques (trouvées dans les épaves et les trésors enterrés ; on peut les exposer chez soi) ----------
export const RELICS = {
  boussole: { name: 'Boussole en laiton', icon: '🧭', desc: 'Son aiguille montre toujours… le large.' },
  longuevue: { name: 'Longue-vue de capitaine', icon: '🔭', desc: 'Gravée au nom du « Neptune ».' },
  cloche: { name: 'Cloche du Neptune', icon: '🔔', desc: 'La cloche du navire amiral des Naufrages.' },
  proue: { name: 'Figure de proue', icon: '🧜', desc: 'Une sirène de bois aux yeux peints en bleu.' },
  ancre: { name: 'Ancre dorée', icon: '⚓', desc: 'Trop belle pour avoir jamais servi.' },
  sablier: { name: 'Sablier de navigateur', icon: '⏳', desc: 'Le sable coule encore, très lentement.' },
  jade: { name: 'Statuette de jade', icon: '🗿', desc: 'Un poisson souriant, venu de très loin.' },
  couronne: { name: 'Couronne engloutie', icon: '👑', desc: 'Celle du Roi des Sardines ? Personne ne sait.' },
  carte: { name: 'Carte des étoiles', icon: '🗺️', desc: 'Les constellations des marins d’autrefois.' },
  perle: { name: 'Perle noire', icon: '⚫', desc: 'Grosse comme une bille, et d’un noir profond.' },
};
// Épaves : on les fouille au grappin, une fois par jour ; la première fouille donne leur relique.
export const WRECKS = [
  { id: 'neptune', name: 'Le Neptune', x: -790, z: 480, relic: 'cloche', kind: 'galion' },
  { id: 'sirene', name: 'La Sirène', x: -930, z: 360, relic: 'proue', kind: 'galion' },
  { id: 'albatros', name: 'L’Albatros', x: -800, z: 350, relic: 'longuevue', kind: 'chalutier' },
  { id: 'mouette', name: 'La Mouette', x: -60, z: 640, relic: 'boussole', kind: 'chalutier' },
  { id: 'abysses', name: 'L’Étoile des abysses', x: 700, z: 330, relic: 'carte', kind: 'galion' },
  { id: 'glacon', name: 'Le Glaçon', x: 240, z: -820, relic: 'sablier', kind: 'chalutier' },
];
// Cartes au trésor : un indice, un endroit sur une plage ; on y creuse (touche E quand on est tout près).
export const HUNTS = {
  h1: { name: 'Carte du pirate borgne', clue: 'Île aux Palmes, sur la plage tournée vers le soleil couchant, près de la pointe.', island: 'palmes', dir: [-1, 0.15], money: 180, relic: 'jade' },
  h2: { name: 'Carte déchirée', clue: 'Sur un îlot rocheux, à l’ouest de Port-Galet, la plage qui regarde vers le sud.', island: 'ilot2', dir: [0, 1], money: 150, relic: 'ancre' },
  h3: { name: 'Carte roussie', clue: 'Mont Braise : sur le sable noir, côté soleil levant.', island: 'braise', dir: [1, 0], money: 320, relic: 'perle' },
  h4: { name: 'Carte givrée', clue: 'Les Glaciers : la plage la plus à l’ouest, là où le vent ne souffle jamais.', island: 'glaciers', dir: [-1, 0], money: 380, relic: 'couronne' },
};
// Merveilles : des lieux à voir (certaines à un moment précis). when : jour, nuit, soir (coucher de soleil) ; weather : clair.
export const WONDERS = [
  { id: 'arche', name: 'L’Arche des Falaises', icon: '🌉', x: -560, z: -290, r: 60, desc: 'Une arche de pierre géante où s’engouffrent les vagues.' },
  { id: 'cascade', name: 'La Cascade de Port-Galet', icon: '💧', x: 10, z: -95, r: 70, desc: 'Une cascade qui tombe de la forêt directement dans la mer.' },
  { id: 'source', name: 'Les Sources fumantes', icon: '♨️', x: -680, z: -560, r: 70, desc: 'L’eau bouillonne et fume au pied du volcan.' },
  { id: 'cathedrale', name: 'La Cathédrale de glace', icon: '🧊', x: 40, z: -870, r: 60, desc: 'Une arche de glace bleue, haute comme une église.' },
  { id: 'aurore', name: 'Les Aurores boréales', icon: '🌌', x: 120, z: -870, r: 260, when: 'nuit', weather: 'clair', desc: 'Des voiles verts et violets qui dansent dans le ciel du nord.' },
  { id: 'foret', name: 'La Forêt sur pilotis', icon: '🌳', x: 470, z: 800, r: 130, desc: 'Des arbres qui marchent sur l’eau, perchés sur leurs racines.' },
  { id: 'lucioles', name: 'La Grotte aux Lucioles', icon: '✨', x: -598, z: -168, r: 18, desc: 'Une grotte où des milliers de petites lumières bleues scintillent.' },
  { id: 'cimetiere', name: 'Le Cimetière des navires', icon: '⚓', x: -850, z: 410, r: 110, desc: 'Des carcasses de navires échoués sur le sable, comme des baleines endormies.' },
  { id: 'rayonvert', name: 'Le Rayon vert', icon: '🟢', zone: 'large', when: 'soir', weather: 'clair', desc: 'Au large, à l’instant précis où le soleil disparaît, un éclair vert.' },
];

export const DAY_SECONDS = 600; // une journée dure 10 minutes
