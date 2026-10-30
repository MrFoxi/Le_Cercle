// Banque de sujets, rangés par catégorie : pour en ajouter, il suffit d'ajouter une ligne dans la bonne liste.
const BANK = {
  Nourriture: [
    'La galette des rois', 'Le chocolat', 'Les pizzas à l’ananas', 'Les fast-foods', 'Les sushis', 'Le fromage qui sent fort',
    'Les brocolis', 'Le café', 'Les croissants', 'La raclette', 'Les épinards', 'Le Nutella', 'Les huîtres', 'Le brunch',
    'Les cookies', 'La cuisine végane', 'Les frites', 'Le thé matcha', 'La fondue savoyarde',
  ],
  'Films et séries': [
    'Les films Marvel', 'Star Wars', 'Harry Potter', 'Game of Thrones', 'Les comédies romantiques', 'Les films d’horreur',
    'Friends', 'Titanic', 'Les remakes Disney en prises de vue réelles', 'Netflix', 'Le Seigneur des anneaux', 'Les films Pixar',
    'La Casa de papel', 'Les séries coréennes', 'Les téléfilms de Noël', 'La cérémonie des Oscars',
  ],
  'Jeux vidéo': [
    'Minecraft', 'Fortnite', 'Les jeux sur téléphone', 'Mario Kart', 'League of Legends', 'Les Pokémon', 'GTA', 'Les jeux de foot',
    'Les jeux rétro', 'Zelda', 'Animal Crossing', 'Les battle royale', 'Les achats intégrés', 'Tetris', 'Les jeux très difficiles', 'Among Us',
  ],
  Musique: [
    'Les Beatles', 'Le rap français', 'Les vinyles', 'L’Eurovision', 'La K-pop', 'Taylor Swift', 'Les comédies musicales', 'Le jazz',
    'Les playlists Spotify', 'La musique classique', 'Les boys bands', 'Le karaoké', 'Les festivals d’été', 'L’autotune', 'La techno',
    'Les chansons de l’été',
  ],
  Sports: [
    'Le football', 'Le golf', 'Les Jeux olympiques', 'La Formule 1', 'Le padel', 'Le marathon', 'Le Tour de France', 'Le rugby',
    'Le yoga', 'La salle de sport', 'Le ski', 'La pétanque', 'Le tennis', 'L’e-sport', 'Le surf', 'Le curling',
  ],
  'Vie quotidienne': [
    'Le lundi matin', 'Les transports en commun', 'Se lever à 6 h', 'Faire la vaisselle', 'Les embouteillages', 'La sieste',
    'Le télétravail', 'Les réunions', 'Le dimanche soir', 'Faire les courses', 'Les soldes', 'Le repassage', 'Les files d’attente',
    'Les déménagements', 'Les jours de pluie', 'Le premier café du matin',
  ],
  Célébrités: [
    'Elon Musk', 'Beyoncé', 'Kylian Mbappé', 'La famille Kardashian', 'Zinédine Zidane', 'Lady Gaga', 'Leonardo DiCaprio',
    'Cristiano Ronaldo', 'Johnny Hallyday', 'Omar Sy', 'Rihanna', 'Squeezie', 'Les youtubeurs', 'La famille royale britannique',
    'Céline Dion', 'Les stars de la télé-réalité',
  ],
  Technologie: [
    'L’intelligence artificielle', 'Les smartphones pliables', 'Les montres connectées', 'La réalité virtuelle', 'Les voitures électriques',
    'Les assistants vocaux', 'L’iPhone', 'Les cryptomonnaies', 'La 5G', 'Les imprimantes', 'Les trottinettes électriques',
    'Les objets connectés', 'Les mises à jour automatiques', 'Le Wi-Fi gratuit', 'Les écouteurs sans fil', 'Les ordinateurs de gamer',
  ],
  Voyages: [
    'Les vacances à la plage', 'Le camping', 'Les croisières', 'Paris', 'Les road trips', 'Les clubs de vacances', 'New York',
    'Les voyages en train', 'Les aéroports', 'La randonnée en montagne', 'Venise', 'Les auberges de jeunesse', 'Le Japon',
    'Les voyages organisés', 'Disneyland', 'Les vols low cost',
  ],
  'Culture générale': [
    'La Joconde', 'Les musées', 'Les pyramides d’Égypte', 'La tour Eiffel', 'Les châteaux de la Loire', 'L’opéra', 'La poésie',
    'Les livres de développement personnel', 'Les dictionnaires', 'Les jeux télévisés', 'L’art contemporain', 'Shakespeare',
    'Les mathématiques', 'Les escape games', 'L’histoire de France', 'La philosophie',
  ],
  'Réseaux sociaux': [
    'Les réseaux sociaux', 'Les influenceurs', 'TikTok', 'Instagram', 'Les stories', 'Les selfies', 'Facebook', 'Les mèmes',
    'LinkedIn', 'Les hashtags', 'Les filtres photo', 'Les lives Twitch', 'BeReal', 'Les challenges viraux', 'Les vidéos de chats',
    'Les commentaires YouTube',
  ],
  Animaux: [
    'Les chats', 'Les chiens', 'Les pandas', 'Les araignées', 'Les licornes', 'Les pigeons', 'Les dauphins', 'Les moustiques',
    'Les hamsters', 'Les manchots', 'Les serpents', 'Les loutres', 'Les chevaux', 'Les poissons rouges', 'Les lamas', 'Les requins',
  ],
  Loisirs: [
    'Les jeux de société', 'La lecture', 'Le jardinage', 'Le tricot', 'La pêche', 'Les puzzles', 'La photographie', 'Le bricolage',
    'Les parcs d’attractions', 'Le cinéma en salle', 'Les soirées pyjama', 'La cuisine maison', 'Le scrapbooking', 'Les mangas',
    'Le Monopoly', 'Les apéros entre amis',
  ],
};

module.exports = Object.entries(BANK).flatMap(([category, list]) => list.map(text => ({ text, category })));
