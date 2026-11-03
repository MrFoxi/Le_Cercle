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
];
export const WORLD = 1100;                       // au-delà : la brume, on ne peut pas aller plus loin
export const OPEN_SEA = 580;                     // au-delà de cette distance de Port-Galet : il faut une coque renforcée
export const FOSSE = { x: 830, z: 440, r: 230, name: 'La Fosse' }; // eaux très profondes : coque de haute mer

export const ZONES = {
  cote: 'Côtes de Port-Galet', recif: 'Récif des Palmes', roche: 'Rochers des Falaises', phare: 'Eaux du Phare',
  large: 'Haute mer', fosse: 'La Fosse',
};

// Coins de pêche : des remous où les poissons rares mordent plus souvent.
export const SPOTS = [
  { x: 95, z: 60, zone: 'cote' }, { x: -100, z: 95, zone: 'cote' }, { x: 60, z: -110, zone: 'cote' },
  { x: 380, z: -175, zone: 'recif' }, { x: 520, z: -310, zone: 'recif' }, { x: 205, z: -390, zone: 'recif' },
  { x: -380, z: -110, zone: 'roche' }, { x: -560, z: -250, zone: 'roche' }, { x: -640, z: 220, zone: 'roche' },
  { x: 230, z: 30, zone: 'large' }, { x: -260, z: -440, zone: 'large' }, { x: 300, z: 420, zone: 'large' },
  { x: -80, z: 680, zone: 'phare' }, { x: -190, z: 790, zone: 'phare' },
  { x: 800, z: 400, zone: 'fosse' }, { x: 900, z: 520, zone: 'fosse' },
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
    { name: 'Coque de haute mer', cost: 1200, desc: 'Affronte les creux de la Fosse.' }] },
  lanterne: { name: 'Lanterne', icon: '🏮', levels: [
    { name: 'Pas de lanterne', cost: 0 }, { name: 'Lanterne de pont', cost: 160, desc: 'Éclaire la nuit : les poissons nocturnes mordent à sa lumière.' }] },
};

// ---------- Villages et habitants ----------
export const VILLAGES = {
  port: { name: 'Port-Galet', island: 'port', shop: true, market: 1 },
  corail: { name: 'Anse-Corail', island: 'palmes', shop: false, market: 1.1 }, // on y paie un peu mieux
  phare: { name: 'Le Phare', island: 'phare', shop: false, market: 0 },        // pas de marché, juste le gardien
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
    hello: 'Le récif est vivant, tu sais. Je plonge tous les jours et je ne m’en lasse pas.',
    quests: [
      { id: 'labre', text: 'Montre-moi un Labre arc-en-ciel, pour mon carnet de dessins.', type: 'catch', fish: 'labre', reward: 80, done: 'Regarde ces couleurs ! Je le dessine et je te le rends… enfin, je le garde.' },
      { id: 'merou', text: 'Le vieux Mérou corail du récif… personne ne l’a jamais sorti de l’eau.', type: 'catch', fish: 'merou', reward: 220, done: 'Incroyable. Il est encore plus gros que dans mes rêves.' },
    ] },
  { id: 'kai', name: 'Kaï', role: 'Gamin du hameau', village: 'corail', face: '🧒',
    hello: 'T’as vu le phare, au sud-ouest ? Mon oncle dit qu’il faut une coque solide pour y aller.',
    quests: [
      { id: 'bouteille', text: 'J’ai jeté une bouteille à la mer avec un dessin dedans ! Tu l’as vue ? Elle dérivait vers l’ouest.', type: 'find', item: 'dessin', reward: 70, done: 'Tu l’as retrouvée ! Garde le dessin, c’est un cadeau.' },
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
];

export const DAY_SECONDS = 600; // une journée dure 10 minutes
