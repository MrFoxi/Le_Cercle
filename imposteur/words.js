// Paires de mots de L'Imposteur, par catégorie : deux mots proches (pour semer le doute) mais distinguables par les indices.
// À chaque manche, le serveur tire une paire et décide au hasard lequel des deux mots revient aux civils.
const CATEGORIES = [
  { id: 'animaux', name: 'Animaux', emoji: '🐾', pairs: [
    ['Chat', 'Chien'], ['Lion', 'Tigre'], ['Loup', 'Renard'], ['Abeille', 'Guêpe'], ['Dauphin', 'Requin'], ['Cheval', 'Âne'],
    ['Crocodile', 'Lézard'], ['Hibou', 'Perroquet'], ['Grenouille', 'Crapaud'], ['Poule', 'Canard'], ['Papillon', 'Libellule'],
    ['Tortue', 'Escargot'], ['Pingouin', 'Phoque'], ['Girafe', 'Zèbre']] },
  { id: 'nourriture', name: 'Nourriture', emoji: '🍕', pairs: [
    ['Pizza', 'Burger'], ['Café', 'Thé'], ['Crêpe', 'Gaufre'], ['Croissant', 'Pain au chocolat'], ['Sushi', 'Ramen'], ['Frites', 'Chips'],
    ['Glace', 'Sorbet'], ['Ketchup', 'Mayonnaise'], ['Raclette', 'Fondue'], ['Pomme', 'Poire'], ['Fraise', 'Framboise'],
    ['Chocolat', 'Caramel'], ['Lasagnes', 'Spaghetti'], ['Tacos', 'Kebab']] },
  { id: 'films', name: 'Films et séries', emoji: '🎬', pairs: [
    ['Harry Potter', 'Le Seigneur des anneaux'], ['Star Wars', 'Star Trek'], ['Titanic', 'Avatar'], ['Friends', 'How I Met Your Mother'],
    ['Breaking Bad', 'Narcos'], ['Le Roi lion', 'Le Livre de la jungle'], ['Stranger Things', 'Dark'], ['Game of Thrones', 'The Witcher'],
    ['Spider-Man', 'Batman'], ['Matrix', 'Inception'], ['Squid Game', 'Alice in Borderland'], ['La Casa de Papel', 'Lupin'],
    ['Intouchables', 'Bienvenue chez les Ch’tis'], ['Jurassic Park', 'King Kong']] },
  { id: 'jeux', name: 'Jeux vidéo', emoji: '🎮', pairs: [
    ['Minecraft', 'Roblox'], ['Fortnite', 'PUBG'], ['Mario Kart', 'Crash Team Racing'], ['FIFA', 'PES'], ['Call of Duty', 'Battlefield'],
    ['Zelda', 'Skyrim'], ['GTA', 'Red Dead Redemption'], ['Tetris', 'Candy Crush'], ['Among Us', 'Fall Guys'], ['League of Legends', 'Dota'],
    ['Sonic', 'Mario'], ['Clash Royale', 'Brawl Stars'], ['Les Sims', 'Animal Crossing'], ['Pokémon', 'Palworld']] },
  { id: 'metiers', name: 'Métiers', emoji: '👷', pairs: [
    ['Médecin', 'Infirmier'], ['Pompier', 'Policier'], ['Boulanger', 'Pâtissier'], ['Pilote', 'Hôtesse de l’air'], ['Professeur', 'Directeur d’école'],
    ['Avocat', 'Juge'], ['Plombier', 'Électricien'], ['Vétérinaire', 'Dentiste'], ['Journaliste', 'Présentateur télé'], ['Chanteur', 'Acteur'],
    ['Architecte', 'Maçon'], ['Coiffeur', 'Barbier'], ['Facteur', 'Livreur'], ['Cuisinier', 'Serveur']] },
  { id: 'objets', name: 'Objets du quotidien', emoji: '🪑', pairs: [
    ['Fourchette', 'Cuillère'], ['Brosse à dents', 'Dentifrice'], ['Stylo', 'Crayon'], ['Oreiller', 'Couette'], ['Parapluie', 'Imperméable'],
    ['Lunettes', 'Lentilles'], ['Ciseaux', 'Couteau'], ['Clé', 'Cadenas'], ['Montre', 'Réveil'], ['Savon', 'Shampoing'], ['Chaise', 'Tabouret'],
    ['Lampe', 'Bougie'], ['Sac à dos', 'Valise'], ['Assiette', 'Bol']] },
  { id: 'sports', name: 'Sports', emoji: '⚽', pairs: [
    ['Football', 'Rugby'], ['Tennis', 'Badminton'], ['Basket', 'Handball'], ['Ski', 'Snowboard'], ['Boxe', 'Judo'], ['Natation', 'Water-polo'],
    ['Surf', 'Skateboard'], ['Golf', 'Mini-golf'], ['Cyclisme', 'Course à pied'], ['Volley', 'Ping-pong'], ['Hockey', 'Patinage artistique'],
    ['Formule 1', 'Rallye'], ['Escalade', 'Alpinisme'], ['Karaté', 'Escrime']] },
  { id: 'pays', name: 'Pays et villes', emoji: '🌍', pairs: [
    ['Paris', 'Londres'], ['France', 'Belgique'], ['Espagne', 'Portugal'], ['New York', 'Los Angeles'], ['Japon', 'Chine'], ['Rome', 'Venise'],
    ['Brésil', 'Argentine'], ['Canada', 'États-Unis'], ['Marseille', 'Nice'], ['Égypte', 'Maroc'], ['Suisse', 'Autriche'],
    ['Australie', 'Nouvelle-Zélande'], ['Dubaï', 'Las Vegas'], ['Mexique', 'Cuba']] },
  { id: 'celebrites', name: 'Célébrités', emoji: '⭐', pairs: [
    ['Zinédine Zidane', 'Kylian Mbappé'], ['Lionel Messi', 'Cristiano Ronaldo'], ['Beyoncé', 'Rihanna'], ['Michael Jackson', 'Elvis Presley'],
    ['Albert Einstein', 'Isaac Newton'], ['Napoléon', 'Jules César'], ['Omar Sy', 'Jean Dujardin'], ['Taylor Swift', 'Ariana Grande'],
    ['Elon Musk', 'Bill Gates'], ['Squeezie', 'Cyprien'], ['Teddy Riner', 'Léon Marchand'], ['Aya Nakamura', 'Angèle'], ['Jul', 'Ninho'],
    ['Louis XIV', 'Marie-Antoinette']] },
  { id: 'marques', name: 'Marques', emoji: '🏷️', pairs: [
    ['Coca-Cola', 'Pepsi'], ['Nike', 'Adidas'], ['Apple', 'Samsung'], ['McDonald’s', 'Burger King'], ['Netflix', 'Disney+'], ['Ferrari', 'Lamborghini'],
    ['Lego', 'Playmobil'], ['Nutella', 'Kinder'], ['Amazon', 'AliExpress'], ['Ikea', 'Conforama'], ['PlayStation', 'Xbox'], ['Haribo', 'Carambar'],
    ['Decathlon', 'Intersport'], ['Red Bull', 'Monster']] },
  { id: 'animes', name: 'Dessins animés et mangas', emoji: '🍥', pairs: [
    ['Naruto', 'Bleach'], ['One Piece', 'Fairy Tail'], ['Pokémon', 'Digimon'], ['Bob l’éponge', 'Oggy et les Cafards'], ['Les Simpson', 'Les Griffin'],
    ['Tom et Jerry', 'Bip Bip et Coyote'], ['Shrek', 'L’Âge de glace'], ['La Reine des neiges', 'Raiponce'], ['Toy Story', 'Cars'],
    ['L’Attaque des Titans', 'Demon Slayer'], ['Death Note', 'Tokyo Ghoul'], ['Mon voisin Totoro', 'Le Voyage de Chihiro'], ['Astérix', 'Tintin'],
    ['Dragon Ball', 'One Punch Man']] },
  { id: 'musique', name: 'Musique', emoji: '🎵', pairs: [
    ['Guitare', 'Basse'], ['Piano', 'Synthétiseur'], ['Batterie', 'Tambour'], ['Violon', 'Violoncelle'], ['Rap', 'R&B'], ['Concert', 'Festival'],
    ['Trompette', 'Saxophone'], ['Micro', 'Enceinte'], ['Opéra', 'Comédie musicale'], ['Spotify', 'Deezer'], ['DJ', 'Chef d’orchestre'],
    ['Karaoké', 'Blind test'], ['Jazz', 'Blues'], ['Flûte', 'Harmonica']] },
  { id: 'tech', name: 'Technologie', emoji: '💻', pairs: [
    ['Smartphone', 'Tablette'], ['Ordinateur', 'Console'], ['Wi-Fi', 'Bluetooth'], ['Clavier', 'Souris'], ['Google', 'Wikipédia'], ['Imprimante', 'Scanner'],
    ['Robot', 'Intelligence artificielle'], ['Clé USB', 'Disque dur'], ['Écouteurs', 'Casque audio'], ['Instagram', 'Snapchat'], ['YouTube', 'Twitch'],
    ['Montre connectée', 'Lunettes connectées'], ['Mot de passe', 'Code PIN'], ['E-mail', 'SMS']] },
  { id: 'nature', name: 'Nature', emoji: '🌿', pairs: [
    ['Mer', 'Océan'], ['Montagne', 'Colline'], ['Rivière', 'Cascade'], ['Forêt', 'Jungle'], ['Soleil', 'Lune'], ['Pluie', 'Neige'], ['Volcan', 'Geyser'],
    ['Désert', 'Plage'], ['Arbre', 'Buisson'], ['Rose', 'Tulipe'], ['Orage', 'Tornade'], ['Lac', 'Étang'], ['Étoile', 'Planète'],
    ['Arc-en-ciel', 'Aurore boréale']] },
  { id: 'culture', name: 'Culture générale', emoji: '📚', pairs: [
    ['Avion', 'Hélicoptère'], ['Cinéma', 'Théâtre'], ['Musée', 'Bibliothèque'], ['Roi', 'Empereur'], ['Château', 'Palais'], ['Pyramide', 'Sphinx'],
    ['Président', 'Premier ministre'], ['Chevalier', 'Mousquetaire'], ['Tour Eiffel', 'Arc de Triomphe'], ['Euro', 'Dollar'],
    ['La Joconde', 'La Vénus de Milo'], ['Dictionnaire', 'Encyclopédie'], ['Noël', 'Nouvel An'], ['Jeux olympiques', 'Coupe du monde']] },
  { id: 'absurde', name: 'Absurde et amusant', emoji: '🤪', pairs: [
    ['Licorne', 'Dragon'], ['Zombie', 'Vampire'], ['Fantôme', 'Squelette'], ['Sorcière', 'Fée'], ['Pirate', 'Ninja'], ['Extraterrestre', 'Astronaute'],
    ['Chaussette perdue', 'Télécommande perdue'], ['Doudou', 'Peluche'], ['Pet', 'Rot'], ['Chewing-gum', 'Bonbon'], ['Coussin péteur', 'Poil à gratter'],
    ['Père Noël', 'Lapin de Pâques'], ['Clown', 'Mime'], ['Yéti', 'Monstre du Loch Ness'], ['Lundi matin', 'Dimanche soir']] },
];

module.exports = { CATEGORIES };
