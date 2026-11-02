// Little District : les six quartiers. Données pures (pas de Three.js), lues par la logique et par l'affichage.
// Chaque quartier réutilise les mêmes « emplacements » de bâtiments (ramen, cafe…) et de décorations : seuls les noms,
// l'apparence et l'ambiance changent. La mécanique de jeu est la même partout.

// Quartier en cours : ?quartier=… dans l'adresse (le japonais par défaut).
export const DISTRICT_IDS = ['japon', 'moderne', 'cotier', 'europe', 'futur', 'med'];
const asked = globalThis.location ? new URLSearchParams(location.search).get('quartier') : null;
export const DISTRICT = DISTRICT_IDS.includes(asked) ? asked : 'japon';
export const saveKey = id => (id === 'japon' ? 'district-save-v1' : `district-save-${id}-v1`);
export const UNLOCK_EARNED = 300000; // ¥ gagnés dans le quartier précédent pour ouvrir le suivant

const GENERIC_LEVELS = { 2: 'Éclairage en façade et une place de plus', 3: 'Plantes devant l’entrée', 4: 'Plus de places, menu en vitrine', 5: 'Un étage, du personnel en plus', 6: 'Nouvelle déco intérieure', 7: 'Une terrasse devant l’entrée', 8: 'Plus de lumière, plus de monde', 9: 'Façade rénovée', 10: 'Grande enseigne lumineuse, au sommet du quartier' };

// b : [nom, description, icône] pour chaque emplacement · d : [nom, icône] pour chaque décoration
export const THEMES = {
  japon: {
    name: 'Quartier japonais', jp: '小さな街', title: 'Little District', pitch: 'Un quartier japonais miniature qui vit tout seul. Construis, décore, et regarde-le grandir, à ton rythme.',
    sectors: ['La ruelle', 'Rue des lanternes', 'Le haut quartier', 'Les jardins'],
    hill: 'Le sanctuaire', hillView: 'Vue du sanctuaire', south: 'Le canal', festival: '🏮 Festival ce soir ! Lanternes, feux d’artifice et clients en plus (revenus ×1,5)', festivalName: 'Festival',
    vendor: ['🍠', 'Marchand', 'Le marchand de patates douces passe dans la rue. Touche sa charrette !', 'Patates douces brûlantes pour tout le monde', '芋'],
    font: '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS Mincho", serif',
    b: {}, d: {},
  },
  moderne: {
    name: 'Quartier moderne', jp: 'VILLAS', title: 'Les Villas', pitch: 'Des villas d’architecte, des piscines et des palmiers. Le quartier chic, version miniature.',
    sectors: ['L’allée des palmiers', 'Les hauteurs', 'Le domaine', 'La marina'],
    hill: 'La villa du sommet', hillView: 'Vue des hauteurs', south: 'Le lac', festival: '🎉 Pool party ce soir ! Musique, feux d’artifice et invités en plus (revenus ×1,5)', festivalName: 'Pool party',
    vendor: ['🍦', 'Glacier', 'Le glacier ambulant passe dans l’allée. Touche son triporteur !', 'Glaces offertes à tout le quartier', ''],
    font: '"Inter", system-ui, sans-serif', levels: GENERIC_LEVELS, weather: { neige: 0.2, brouillard: 0.5 },
    b: {
      ramen: ['Snack de la piscine', 'Le premier commerce de l’allée : burgers et smoothies au bord de l’eau.', '🍔'], street: ['Food-truck', 'Un camion à tacos garé sous les palmiers.', '🌮'],
      cafe: ['Café design', 'Béton ciré, plantes suspendues et latte art.', '☕'], konbini: ['Épicerie fine', 'Huiles, fromages et produits rares.', '🧺'],
      appart: ['Villa cube', 'Un cube blanc et une grande baie vitrée.', '🏠'], fleurs: ['Jardinerie', 'Cactus, oliviers en pot et palmiers nains.', '🌵'],
      pain: ['Boulangerie bio', 'Pains au levain et viennoiseries dorées.', '🥐'], maison: ['Villa à piscine', 'Une terrasse en bois et une piscine turquoise.', '🏊'],
      livres: ['Galerie d’art', 'Grandes toiles et sculptures sous verrière.', '🖼️'], sushi: ['Restaurant gastronomique', 'Cuisine ouverte et service impeccable.', '🍽️'],
      bar: ['Rooftop bar', 'Cocktails et vue sur tout le quartier.', '🍸'], karaoke: ['Club de musique', 'DJ, basses et lumières le soir.', '🎧'],
      mode: ['Boutique de luxe', 'Vitrines minimalistes et sacs hors de prix.', '👜'], immeuble: ['Villa d’architecte', 'Des volumes en porte-à-faux sur plusieurs niveaux.', '🏛️'],
      arcade: ['Cinéma en plein air', 'Écran géant et transats.', '🎬'], hotel: ['Grande villa', 'Pool-house, jardin et invités tout l’été.', '🏡'], ryotei: ['Restaurant étoilé', 'La table la plus chic du quartier.', '⭐'],
    },
    d: { plante: ['Pot design', '🪴'], caisses: ['Transat', '🏖️'], banc: ['Banc design', '🪑'], velo: ['Trottinette', '🛴'], lampe: ['Lampadaire moderne', '💡'], bambou: ['Haie taillée', '🌳'], toro: ['Borne lumineuse', '🔦'], panneau: ['Panneau', '🪧'], bonsai: ['Sculpture', '🗿'], vending: ['Distributeur', '🥤'], cerisier: ['Palmier', '🌴'], erable: ['Olivier', '🫒'], torii: ['Arche design', '⛩️'], puits: ['Jacuzzi', '🛁'], neko: ['Statue chromée', '🪩'], sakura: ['Grand palmier', '🌴'], jizo: ['Sculpture abstraite', '🗿'], kiosque: ['Pergola', '🛖'], fontaine: ['Fontaine', '⛲'] },
  },
  cotier: {
    name: 'Village côtier', jp: 'LA CÔTE', title: 'Le Village côtier', pitch: 'Des maisons colorées face à la mer, une plage, un ponton et des mouettes. Ça sent les vacances.',
    sectors: ['Le front de mer', 'La rue du port', 'Le haut du village', 'La pointe'],
    hill: 'Le phare', hillView: 'Vue du phare', south: 'La plage', festival: '⚓ Fête du port ce soir ! Musique, feux d’artifice et visiteurs en plus (revenus ×1,5)', festivalName: 'Fête du port',
    vendor: ['🍦', 'Glacier', 'Le marchand de glaces longe le front de mer. Touche sa charrette !', 'Cornets de glace pour toute la plage', ''],
    font: 'Georgia, "Times New Roman", serif', levels: GENERIC_LEVELS, sea: true, weather: { neige: 0.2, brouillard: 1.6, nuages: 1.3 },
    b: {
      ramen: ['Crêperie du port', 'Galettes et crêpes au caramel, face aux bateaux.', '🥞'], street: ['Kiosque à glaces', 'Trois boules, un cornet, du soleil.', '🍦'],
      cafe: ['Café des marins', 'Chocolat chaud et récits de tempêtes.', '☕'], konbini: ['Épicerie du port', 'Tout pour le pique-nique et la pêche.', '🧺'],
      appart: ['Maisons de pêcheurs', 'Petites maisons collées, volets colorés.', '🏘️'], fleurs: ['Boutique de souvenirs', 'Coquillages, cartes postales et marinières.', '🐚'],
      pain: ['Boulangerie', 'Kouign-amann et pain chaud.', '🥖'], maison: ['Cabanon de plage', 'Planches peintes et filets qui sèchent.', '🛖'],
      livres: ['Librairie maritime', 'Cartes marines et romans d’aventure.', '📚'], sushi: ['Poissonnerie', 'La pêche du jour sur la glace.', '🐟'],
      bar: ['Bar de la plage', 'Les pieds dans le sable au coucher du soleil.', '🍹'], karaoke: ['Guinguette', 'Accordéon et danse sous les guirlandes.', '🪗'],
      mode: ['Boutique de surf', 'Planches, combinaisons et wax.', '🏄'], immeuble: ['Résidence face à la mer', 'Des balcons tournés vers l’horizon.', '🏢'],
      arcade: ['Salle de jeux', 'Flippers et pinces à peluches du front de mer.', '🕹️'], hotel: ['Hôtel de la plage', 'Chambres avec vue sur les vagues.', '🏨'], ryotei: ['Restaurant de fruits de mer', 'Plateaux royaux et vue sur le phare.', '🦞'],
    },
    d: { plante: ['Hortensias', '🪴'], caisses: ['Casiers à homards', '🦞'], banc: ['Banc', '🪑'], velo: ['Vélo', '🚲'], lampe: ['Réverbère', '💡'], bambou: ['Oyats', '🌾'], toro: ['Bouée', '🛟'], panneau: ['Panneau', '🪧'], bonsai: ['Filets de pêche', '🥅'], vending: ['Distributeur', '🥤'], cerisier: ['Pin parasol', '🌲'], erable: ['Tamaris', '🌳'], torii: ['Ancre géante', '⚓'], puits: ['Barque', '🛶'], neko: ['Phare miniature', '🗼'], sakura: ['Grand pin', '🌲'], jizo: ['Statue de marin', '🗿'], kiosque: ['Cabine de plage', '🏖️'], fontaine: ['Fontaine', '⛲'] },
  },
  europe: {
    name: 'Vieille ville européenne', jp: 'INTRA-MUROS', title: 'La Vieille Ville', pitch: 'Une cité fortifiée au bord de la mer, ses remparts, ses ruelles pavées et son abbaye. On construit à l’intérieur des murs.',
    sectors: ['La Grand’Rue', 'La rue des remparts', 'Le haut de la ville', 'Le pied de l’abbaye'],
    hill: 'L’abbaye', hillView: 'Vue de l’abbaye', south: 'Les douves', festival: '🛡️ Fête médiévale ce soir ! Bannières, feux d’artifice et visiteurs en plus (revenus ×1,5)', festivalName: 'Fête médiévale',
    vendor: ['🥨', 'Colporteur', 'Un colporteur traverse la ville avec sa charrette. Touche-la !', 'Galettes et cidre offerts à toute la ville', ''],
    font: 'Georgia, "Times New Roman", serif', levels: GENERIC_LEVELS, weather: { brouillard: 1.5, pluie: 1.3 },
    b: {
      ramen: ['Crêperie', 'La première boutique de la Grand’Rue : galettes, cidre et beurre salé.', '🥞'], street: ['Étal du marché', 'Pommes, fromages et pain de seigle.', '🧀'],
      cafe: ['Salon de thé', 'Nappes brodées et gâteaux maison.', '🫖'], konbini: ['Épicerie', 'Sacs de farine et bocaux sur les étagères.', '🧺'],
      appart: ['Maison de granite', 'Hauts murs de pierre et toit d’ardoise.', '🏘️'], fleurs: ['Fleuriste', 'Des fleurs jusque sous les arcades.', '💐'],
      pain: ['Boulangerie', 'Le four à bois chauffe depuis l’aube.', '🥖'], maison: ['Maison à colombages', 'Poutres apparentes et fenêtres fleuries.', '🏠'],
      livres: ['Bouquiniste', 'Vieux livres et cartes anciennes.', '📜'], sushi: ['Brasserie', 'Moules-frites et grande salle bruyante.', '🍲'],
      bar: ['Taverne', 'Tonneaux, chopes et chants de marins.', '🍺'], karaoke: ['Théâtre', 'Rideau rouge et comédiens en costume.', '🎭'],
      mode: ['Chapellerie', 'Chapeaux, capes et étoffes.', '🎩'], immeuble: ['Hôtel particulier', 'Une demeure de pierre sur trois niveaux.', '🏰'],
      arcade: ['Musée', 'Armures, maquettes de navires et vitraux.', '🏛️'], hotel: ['Auberge', 'Feu de cheminée et chambres sous les toits.', '🛏️'], ryotei: ['Grande table', 'Le restaurant gastronomique de la cité.', '🍷'],
    },
    d: { plante: ['Jardinière', '🪴'], caisses: ['Tonneaux', '🛢️'], banc: ['Banc de pierre', '🪑'], velo: ['Charrette', '🛒'], lampe: ['Lanterne en fer', '🏮'], bambou: ['Buisson', '🌳'], toro: ['Borne de pierre', '🪨'], panneau: ['Enseigne', '🪧'], bonsai: ['Pot de lavande', '🪻'], vending: ['Fontaine à eau', '🚰'], cerisier: ['Tilleul', '🌳'], erable: ['Platane', '🍁'], torii: ['Calvaire', '✝️'], puits: ['Puits', '🪣'], neko: ['Gargouille', '🗿'], sakura: ['Grand chêne', '🌳'], jizo: ['Statue de chevalier', '🛡️'], kiosque: ['Kiosque à musique', '🎺'], fontaine: ['Fontaine', '⛲'] },
  },
  futur: {
    name: 'Quartier futuriste', jp: 'NÉO-CITÉ', title: 'Néo-Cité', pitch: 'Des tours lumineuses, des voitures volantes au-dessus de la route et des habitants qui lévitent. Bienvenue en 2150.',
    sectors: ['Le secteur 1', 'L’avenue des néons', 'Le secteur haut', 'Les jardins suspendus'],
    hill: 'La flèche', hillView: 'Vue de la flèche', south: 'Le canal d’énergie', festival: '✨ Festival de lumière ce soir ! Hologrammes, feux d’artifice et visiteurs en plus (revenus ×1,5)', festivalName: 'Festival de lumière',
    vendor: ['🤖', 'Robot livreur', 'Un robot livreur flotte dans la rue. Touche-le !', 'Repas synthétiques offerts à tout le secteur', ''],
    font: '"Inter", system-ui, sans-serif', levels: GENERIC_LEVELS, futur: true, weather: { pluie: 1.6, neige: 0.3, brouillard: 1.4 },
    b: {
      ramen: ['Bar à nouilles orbital', 'Des nouilles servies par un bras robotisé.', '🍜'], street: ['Distributeur de repas', 'Un repas chaud imprimé en 12 secondes.', '🥡'],
      cafe: ['Café des androïdes', 'Un barista androïde et du café de synthèse.', '☕'], konbini: ['Supérette automatique', 'Pas de caisse, tout est scanné.', '🛒'],
      appart: ['Capsules d’habitation', 'Des modules empilés et lumineux.', '🏢'], fleurs: ['Serre hydroponique', 'Des plantes qui poussent sous la lumière violette.', '🌱'],
      pain: ['Pâtisserie moléculaire', 'Des gâteaux qui changent de couleur.', '🧁'], maison: ['Dôme résidentiel', 'Une bulle de verre et un jardin intérieur.', '🫧'],
      livres: ['Bibliothèque holographique', 'Des livres qui flottent dans l’air.', '📚'], sushi: ['Restaurant panoramique', 'Une salle qui tourne lentement.', '🍣'],
      bar: ['Bar à néons', 'Cocktails phosphorescents.', '🍸'], karaoke: ['Club de réalité virtuelle', 'Casques, gants et mondes imaginaires.', '🥽'],
      mode: ['Boutique de combinaisons', 'Des tenues qui s’ajustent toutes seules.', '🧥'], immeuble: ['Tour résidentielle', 'Des dizaines d’étages lumineux.', '🏙️'],
      arcade: ['Arène de jeux', 'Tournois en hologramme.', '🎮'], hotel: ['Hôtel capsule', 'Des chambres en forme de cocon.', '🛏️'], ryotei: ['Restaurant en apesanteur', 'On y dîne en flottant.', '🪐'],
    },
    d: { plante: ['Plante lumineuse', '🪴'], caisses: ['Conteneurs', '📦'], banc: ['Banc flottant', '🪑'], velo: ['Hoverboard', '🛹'], lampe: ['Lampadaire flottant', '💡'], bambou: ['Tiges lumineuses', '🎋'], toro: ['Borne holographique', '🔷'], panneau: ['Panneau holographique', '🪧'], bonsai: ['Drone de jardin', '🛸'], vending: ['Distributeur', '🥤'], cerisier: ['Arbre néon', '🌳'], erable: ['Arbre de cristal', '💎'], torii: ['Portail lumineux', '🌀'], puits: ['Borne de recharge', '🔋'], neko: ['Chat robot', '🤖'], sakura: ['Grand arbre néon', '🌳'], jizo: ['Hologramme', '👤'], kiosque: ['Station de téléportation', '🛸'], fontaine: ['Fontaine de lumière', '⛲'] },
  },
  med: {
    name: 'Quartier méditerranéen', jp: 'ΚΥΚΛΑΔΕΣ', title: 'Le Village blanc', pitch: 'Des maisons blanches, des volets et des coupoles bleus, des bougainvilliers et la mer qui brille. Comme dans une île grecque.',
    sectors: ['La ruelle blanche', 'La rue des coupoles', 'Le haut du village', 'La falaise'],
    hill: 'La chapelle', hillView: 'Vue de la chapelle', south: 'Le port', festival: '💃 Panigyri ce soir ! Musique, danses, feux d’artifice et visiteurs en plus (revenus ×1,5)', festivalName: 'Panigyri',
    vendor: ['🍦', 'Glacier', 'Le marchand de glaces descend la ruelle. Touche son triporteur !', 'Glaces au yaourt et au miel pour tout le monde', ''],
    font: 'Georgia, "Times New Roman", serif', levels: GENERIC_LEVELS, sea: true, weather: { neige: 0, soleil: 2, pluie: 0.5, brouillard: 0.3 },
    b: {
      ramen: ['Taverne', 'Le premier commerce de la ruelle : grillades, salade grecque et nappes à carreaux.', '🫒'], street: ['Stand de gyros', 'Pita, tzatziki et frites dedans.', '🥙'],
      cafe: ['Café de la place', 'Frappé glacé à l’ombre de la vigne.', '☕'], konbini: ['Épicerie', 'Miel, olives et feta.', '🧺'],
      appart: ['Maisons cubiques', 'Des cubes blancs empilés sur la pente.', '🏘️'], fleurs: ['Marchand d’olives', 'Une dizaine de sortes d’olives en bocaux.', '🫒'],
      pain: ['Boulangerie', 'Pains au sésame et koulourakia.', '🥯'], maison: ['Maison aux volets bleus', 'Blanche comme le sel, bleue comme la mer.', '🏠'],
      livres: ['Boutique d’artisanat', 'Céramiques peintes et sandales en cuir.', '🏺'], sushi: ['Restaurant de poissons', 'Poulpe grillé et poissons du matin.', '🐙'],
      bar: ['Bar du coucher de soleil', 'Le meilleur endroit pour voir le soleil plonger.', '🌅'], karaoke: ['Salle de bouzouki', 'Musique et assiettes cassées.', '🪕'],
      mode: ['Boutique de lin', 'Robes blanches et chapeaux de paille.', '👒'], immeuble: ['Grande maison blanche', 'Plusieurs terrasses à l’ombre des voiles.', '🏛️'],
      arcade: ['Musée', 'Amphores et statues antiques.', '🏺'], hotel: ['Hôtel à coupole', 'Une coupole bleue et une piscine à débordement.', '🏨'], ryotei: ['Restaurant sur la falaise', 'Dîner au-dessus de la mer.', '🍷'],
    },
    d: { plante: ['Pot de géraniums', '🪴'], caisses: ['Caisses d’olives', '📦'], banc: ['Banc', '🪑'], velo: ['Scooter', '🛵'], lampe: ['Lanterne', '💡'], bambou: ['Bougainvillier', '🌺'], toro: ['Amphore', '🏺'], panneau: ['Panneau', '🪧'], bonsai: ['Pot de basilic', '🌿'], vending: ['Distributeur', '🥤'], cerisier: ['Olivier', '🫒'], erable: ['Cyprès', '🌲'], torii: ['Arche blanche', '⛩️'], puits: ['Puits blanc', '🪣'], neko: ['Statue antique', '🗿'], sakura: ['Grand olivier', '🫒'], jizo: ['Colonne grecque', '🏛️'], kiosque: ['Pergola de vigne', '🍇'], fontaine: ['Fontaine', '⛲'] },
  },
};
export const T = THEMES[DISTRICT];
export const previousOf = id => DISTRICT_IDS[DISTRICT_IDS.indexOf(id) - 1];
