// LES EAUX DE MONET — tous les réglages du jeu au même endroit : qualité, étang, temps, météo, cannes, leurres, espèces.
// Rien ici ne dépend du navigateur : les tests lisent les mêmes valeurs que le jeu.

export const QUALITE = {
  haute: { densite: 1, pixel: 1.5, reflet: 0.5, lod: 150 },
  moyenne: { densite: 0.6, pixel: 1, reflet: 0.4, lod: 110 },
  basse: { densite: 0.3, pixel: 0.8, reflet: 0.3, lod: 80 },
};

/* ---------- L'étang : des lobes d'eau (x, z, rayon, profondeur en mètres) ---------- */
export const ETANG = {
  lobes: [
    { x: 0, z: 0, r: 40, prof: 3.6 }, // le cœur de l'étang
    { x: 40, z: -8, r: 28, prof: 1.5 }, // les grands nénuphars : large et peu profond
    { x: -42, z: 30, r: 13, prof: 1 }, // la petite crique
    { x: -29, z: 19, r: 12, prof: 1.5 }, // le chenal de la crique
    { x: -31, z: -30, r: 20, prof: 3.2 }, // le vieux saule
    { x: 6, z: -40, r: 11, prof: 2.3 }, // le goulet sous le pont
    { x: 9, z: -60, r: 15, prof: 2.8 }, // le bras nord, derrière le pont
    { x: 24, z: 33, r: 17, prof: 2.7 }, // sous la rive boisée
  ],
  fosse: { x: -33, z: -33, r: 8, prof: 2.8 }, // le trou d'eau du vieux saule, le domaine du sandre
  limite: 112, // au-delà, le bois et la colline ferment le monde
  gue: 0.45, // profondeur maximale où l'on peut marcher
  pont: { a: [-14, -40], b: [26, -40], largeur: 2.4, fleche: 2.6 },
  camp: { x: -15, z: 54 },
  depart: { x: -9, z: 52, regard: 0 },
  secteurs: [
    { id: 'pont', nom: 'Le pont japonais', x: -12, z: -46, r: 26, texte: 'Un goulet profond, de l’ombre sous les arches : les carnassiers y guettent le passage.' },
    { id: 'nenuphars', nom: 'Les grands nénuphars', x: 62, z: 16, r: 30, texte: 'Une eau basse couverte de feuilles : on y voit tout, on s’y accroche souvent.' },
    { id: 'boisee', nom: 'La rive boisée', x: 36, z: 56, r: 22, texte: 'Des branches au-dessus de l’eau et de vieilles souches noyées.' },
    { id: 'crique', nom: 'La petite crique', x: -60, z: 40, r: 22, texte: 'Une eau claire et tiède, à l’abri du vent.' },
    { id: 'saule', nom: 'Le vieux saule', x: -58, z: -36, r: 24, texte: 'Sous les branches, le fond plonge soudain dans le noir.' },
  ],
};

/* ---------- Le temps qui passe ---------- */
export const TEMPS = {
  dureeJour: 1440, // secondes réelles pour 24 h de jeu
  heureDepart: 8.5,
  fondu: 90, // secondes pour passer d'une météo à l'autre
  dureeMeteo: [3, 8], // heures de jeu entre deux changements
  moments: [{ id: 'nuit', nom: 'Nuit', de: 21.5 }, { id: 'matin', nom: 'Matin', de: 5.5 }, { id: 'jour', nom: 'Journée', de: 10 }, { id: 'soir', nom: 'Soirée', de: 17.5 }],
  meteos: {
    soleil: { nom: 'Soleil', poids: 4, couvert: 0.12, pluie: 0, brume: 0, vent: 0.25 },
    couvert: { nom: 'Ciel couvert', poids: 3, couvert: 0.85, pluie: 0, brume: 0.1, vent: 0.45 },
    pluie: { nom: 'Pluie', poids: 2, couvert: 1, pluie: 1, brume: 0.2, vent: 0.7 },
    brouillard: { nom: 'Brouillard', poids: 2, couvert: 0.6, pluie: 0, brume: 1, vent: 0.08 },
  },
  // la lumière peinte au fil des heures : soleil, ombres colorées, horizon, zénith, brume
  lumieres: [
    { h: 0, soleil: '#5a6aa8', ombre: '#1c2348', horizon: '#26305c', zenith: '#0e1430', brume: '#28305a', force: 0.45 },
    { h: 5, soleil: '#7a7ab0', ombre: '#2a2c58', horizon: '#6a6a9c', zenith: '#1e2650', brume: '#5c5f8e', force: 0.5 },
    { h: 6.5, soleil: '#ffc9a0', ombre: '#6a5f9c', horizon: '#ffcfa8', zenith: '#8fa4d8', brume: '#e9c9c0', force: 0.85 },
    { h: 9, soleil: '#fff0c8', ombre: '#6f8fb0', horizon: '#f2e6c8', zenith: '#8fc0e0', brume: '#e6e2d0', force: 1 },
    { h: 13, soleil: '#fff8e0', ombre: '#7c9cb8', horizon: '#e8ecd8', zenith: '#7fb6e0', brume: '#e0e6d8', force: 1.08 },
    { h: 17, soleil: '#ffdf9c', ombre: '#7a78ac', horizon: '#f8d8a0', zenith: '#86a8d8', brume: '#efd8b8', force: 1 },
    { h: 19.5, soleil: '#ff9c68', ombre: '#5c4c90', horizon: '#ff9e70', zenith: '#6a70b8', brume: '#e8a890', force: 0.8 },
    { h: 21.5, soleil: '#6a6cb0', ombre: '#22265a', horizon: '#3c3c78', zenith: '#141a40', brume: '#333866', force: 0.5 },
    { h: 24, soleil: '#5a6aa8', ombre: '#1c2348', horizon: '#26305c', zenith: '#0e1430', brume: '#28305a', force: 0.45 },
  ],
};

/* ---------- Le matériel ---------- */
export const CANNES = [
  { id: 'legere', nom: 'La canne légère', texte: 'Sensible et douce : pour les petits leurres, la perche et le chevesne.', portee: 27, puissance: 0.6, resistance: 1, frein: 0.74, allure: { long: 2.4, rayon: 0.0082, bambou: ['#e2c384', '#c39a58'], soie: '#2f6a58', anneaux: 6, moulinet: 0.04, raideur: 0.8 } },
  { id: 'forte', nom: 'La canne forte', texte: 'Longue et nerveuse : elle lance loin et tient tête au brochet.', portee: 36, puissance: 1, resistance: 1.75, frein: 0.82, allure: { long: 3, rayon: 0.0118, bambou: ['#9c6c3a', '#74482a'], soie: '#8c2f38', anneaux: 7, moulinet: 0.05, raideur: 1.25 } },
];
export const LEURRES = [
  { id: 'cuiller', nom: 'Cuiller argentée', famille: 'tournant', taille: 5, couleurs: ['#e6e8ee', '#b8524a'], coule: 0.7, ideale: 1.05, prof: 0.8, conseil: 'Mouline régulièrement, sans t’arrêter.' },
  { id: 'ondulante', nom: 'Ondulante de cuivre', famille: 'tournant', taille: 8, couleurs: ['#c9803f', '#f0d9a8'], coule: 1.1, ideale: 1.05, prof: 1.5, conseil: 'Mouline régulièrement, elle nage plus profond.' },
  { id: 'vairon', nom: 'Nageur vairon', famille: 'nageur', taille: 7, couleurs: ['#7f9a8a', '#ece6d0'], coule: -0.12, ideale: 1, prof: 0.9, conseil: 'Des tirées sèches, puis une pause.' },
  { id: 'jerk', nom: 'Nageur perche', famille: 'nageur', taille: 12, couleurs: ['#6f8a3c', '#e2813a'], coule: -0.08, ideale: 1, prof: 1.5, conseil: 'De grandes tirées, de longues pauses.' },
  { id: 'ver', nom: 'Ver souple', famille: 'souple', taille: 6, couleurs: ['#6a4a78', '#a87fb0'], coule: 0.8, ideale: 0.55, prof: 9, conseil: 'Laisse-le toucher le fond, puis de petites tirées.' },
  { id: 'shad', nom: 'Shad gardon', famille: 'souple', taille: 11, couleurs: ['#dfe4dc', '#5f7f88'], coule: 1, ideale: 0.55, prof: 9, conseil: 'Sur le fond, très lentement, par petits sauts.' },
];
export const FAMILLES = { tournant: 'Leurre tournant', nageur: 'Poisson nageur', souple: 'Leurre souple' };

/* ---------- La pêche ---------- */
export const PECHE = {
  chargeLancer: 1.1, gravite: 11, vitessesMoulinet: [0.55, 1.05, 1.7],
  fenetreFerrage: 1.1, // secondes pour ferrer après la touche
  tiree: { dard: 0.9, leve: 0.65, recharge: 0.28 },
  casse: 0.45, // secondes en surtension avant que la ligne casse
  decroche: 3, // secondes de ligne molle avant que le poisson se décroche
  sortie: 3.2, // distance où l'on peut prendre le poisson
  accroche: { nenuphar: 0.07, structure: 0.1 }, // risque d'accrochage par seconde dans les zones encombrées
};

/* ---------- Les espèces ---------- */
export const ESPECES = [
  { id: 'brochet', nom: 'Brochet', latin: 'Esox lucius', appat: true, nombre: 4, banc: 1, longueur: [45, 105], poids: [0.0048, 3.05],
    habitat: { profMin: 0.8, profMax: 3.2, nenuphar: 1, roseau: 0.9, arbre: 0.3, structure: 0.8, ouvert: 0 }, colonne: 'milieu', style: 'affut', vitesse: 0.5, vue: 13, mefiance: 0.35, force: 1, peur: 6,
    activite: { matin: 1, jour: 0.55, soir: 1, nuit: 0.2 }, meteo: { soleil: 0.7, couvert: 1.2, pluie: 1, brouillard: 1.1 }, leurres: { tournant: 0.8, nageur: 1, souple: 0.45 }, tailleLeurre: [7, 16],
    description: 'Le grand chasseur des eaux calmes : un corps de flèche, un museau en bec de canard et des centaines de dents.',
    habitatTxt: 'Lisières de nénuphars, roseaux, ombres du pont.', comportement: 'Il attend, immobile. Il suit parfois un leurre longtemps avant de se décider, et son attaque est foudroyante.',
    geste: ['suit', 'Il a suivi ton leurre sans l’attaquer tout de suite.'] },
  { id: 'perche', nom: 'Perche', latin: 'Perca fluviatilis', appat: true, nombre: 8, banc: 4, longueur: [15, 42], poids: [0.012, 3.1],
    habitat: { profMin: 0.8, profMax: 3.6, nenuphar: 0.3, roseau: 0.3, arbre: 0.6, structure: 1, ouvert: 0.3 }, colonne: 'milieu', style: 'banc', vitesse: 0.9, vue: 9, mefiance: 0.2, force: 0.42, peur: 4,
    activite: { matin: 1, jour: 0.9, soir: 0.9, nuit: 0.05 }, meteo: { soleil: 1.1, couvert: 1, pluie: 0.7, brouillard: 0.7 }, leurres: { tournant: 1, nageur: 0.65, souple: 0.75 }, tailleLeurre: [3, 8],
    description: 'Rayée de sombre, nageoires rouge vif : la plus belle robe de l’étang, et la plus querelleuse.',
    habitatTxt: 'Autour des souches et des piles du pont, en petits groupes.', comportement: 'Elles chassent ensemble et font parfois bouillonner la surface. Une perche qui attaque en entraîne d’autres.',
    geste: ['groupe', 'Tu as vu un groupe de perches suivre ton leurre ensemble.'] },
  { id: 'sandre', nom: 'Sandre', latin: 'Sander lucioperca', appat: true, nombre: 3, banc: 1, longueur: [40, 85], poids: [0.007, 3.05],
    habitat: { profMin: 2.2, profMax: 7, nenuphar: 0, roseau: 0, arbre: 0.2, structure: 0.7, ouvert: 0.5 }, colonne: 'fond', style: 'rodeur', vitesse: 0.55, vue: 8, mefiance: 0.7, force: 0.8, peur: 7,
    activite: { matin: 0.8, jour: 0.15, soir: 1.1, nuit: 1 }, meteo: { soleil: 0.5, couvert: 1, pluie: 1.05, brouillard: 1.2 }, leurres: { tournant: 0.2, nageur: 0.4, souple: 1 }, tailleLeurre: [6, 13],
    description: 'Un œil de verre fait pour la pénombre. Discret, méfiant, il touche le leurre du bout des lèvres.',
    habitatTxt: 'Le trou d’eau du vieux saule, le cœur profond de l’étang.', comportement: 'Il ne chasse vraiment qu’à la lumière basse, tout près du fond.',
    geste: ['penombre', 'Tu l’as pris à la lumière basse, quand il sort chasser.'] },
  { id: 'chevesne', nom: 'Chevesne', latin: 'Squalius cephalus', appat: true, nombre: 5, banc: 2, longueur: [24, 55], poids: [0.011, 3],
    habitat: { profMin: 0.6, profMax: 2.8, nenuphar: 0.2, roseau: 0.2, arbre: 1, structure: 0.4, ouvert: 0.1 }, colonne: 'surface', style: 'rodeur', vitesse: 0.8, vue: 11, mefiance: 0.75, force: 0.55, peur: 10,
    activite: { matin: 0.8, jour: 1, soir: 0.8, nuit: 0.1 }, meteo: { soleil: 1.15, couvert: 0.85, pluie: 0.6, brouillard: 0.6 }, leurres: { tournant: 0.7, nageur: 1, souple: 0.2 }, tailleLeurre: [3, 8],
    description: 'Grosse tête, écailles de bronze. Il patrouille sous les branches et guette ce qui tombe dans l’eau.',
    habitatTxt: 'Sous les arbres de la rive boisée, tout près de la surface.', comportement: 'C’est le plus farouche de l’étang : un pas trop lourd sur la berge et il disparaît.',
    geste: ['ombre', 'Tu l’as vu patrouiller à l’ombre des branches.'] },
  { id: 'gardon', nom: 'Gardon', latin: 'Rutilus rutilus', appat: false, nombre: 12, banc: 6, longueur: [14, 30], poids: [0.012, 3.05],
    habitat: { profMin: 0.6, profMax: 3, nenuphar: 0.5, roseau: 0.5, arbre: 0.3, structure: 0.2, ouvert: 0.8 }, colonne: 'milieu', style: 'banc', vitesse: 0.75, vue: 0, mefiance: 1, force: 0.2, peur: 5,
    activite: { matin: 1, jour: 1, soir: 1, nuit: 0.4 }, meteo: { soleil: 1, couvert: 1, pluie: 1, brouillard: 1 }, leurres: { tournant: 0, nageur: 0, souple: 0 }, tailleLeurre: [0, 0],
    description: 'Argenté, l’œil rouge, il vit en bancs serrés. Il ne s’intéresse pas aux leurres : on le regarde passer.',
    habitatTxt: 'Partout en pleine eau, en bancs mobiles.', comportement: 'Ses bancs traversent l’étang. Quand ils s’affolent, c’est souvent qu’un carnassier approche.',
    geste: ['banc', 'Tu as suivi un banc de gardons traverser l’étang.'] },
  { id: 'rotengle', nom: 'Rotengle', latin: 'Scardinius erythrophthalmus', appat: false, nombre: 7, banc: 3, longueur: [14, 32], poids: [0.013, 3.05],
    habitat: { profMin: 0.5, profMax: 1.8, nenuphar: 1, roseau: 0.7, arbre: 0, structure: 0, ouvert: 0 }, colonne: 'surface', style: 'banc', vitesse: 0.5, vue: 0, mefiance: 1, force: 0.2, peur: 5,
    activite: { matin: 1, jour: 1, soir: 0.9, nuit: 0.3 }, meteo: { soleil: 1.2, couvert: 1, pluie: 0.8, brouillard: 0.8 }, leurres: { tournant: 0, nageur: 0, souple: 0 }, tailleLeurre: [0, 0],
    description: 'Laiton doré, nageoires écarlates : il broute sous les feuilles de nénuphar, en pleine lumière.',
    habitatTxt: 'Juste sous la surface, entre les nénuphars.', comportement: 'Il gobe les insectes et les jeunes pousses, indifférent aux leurres.',
    geste: ['surface', 'Tu l’as observé gober sous les nénuphars.'] },
];
export const espece = id => ESPECES.find(e => e.id === id);

/* ---------- La carte : six lieux, et ce qu'il faut pour ouvrir le suivant ---------- */
export const LIEUX = [
  { id: 'etang', nom: 'L’Étang des Nymphéas', x: 0.5, y: 0.56, ouvert: true },
  { id: 'peupliers', nom: 'La Rivière aux Peupliers', x: 0.24, y: 0.3, condition: { especes: 4, secteurs: 5, gestes: 2 } },
  { id: 'etretat', nom: 'Les Falaises d’Étretat', x: 0.14, y: 0.74 },
  { id: 'erables', nom: 'La Vallée des Érables', x: 0.76, y: 0.28 },
  { id: 'brumes', nom: 'Le Lac des Brumes', x: 0.86, y: 0.62 },
  { id: 'jardin', nom: 'Le Jardin oublié', x: 0.55, y: 0.85 },
];
