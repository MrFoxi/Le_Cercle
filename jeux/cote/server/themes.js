// Thèmes proposés au créateur du salon, rangés par catégorie. Pour en ajouter un : l'ajouter dans la bonne liste.
const CATALOG = {
  'Culture et divertissement': ['Films', 'Séries TV', 'Dessins animés', 'Animes et mangas', 'Jeux vidéo', 'Musique',
    'Artistes et célébrités', 'Livres', 'Personnages fictifs', 'Émissions TV', 'Publicités', 'Internet et YouTube'],
  'Vie quotidienne': ['Nourriture', 'Boissons', 'Fast-food', 'Desserts', 'Animaux', 'Métiers', 'Transports', 'Vêtements',
    'École et études', 'Travail', 'Technologie', 'Logiciels et applications'],
  'Loisirs et passions': ['Sports', 'Jeux de société', 'Voyages', 'Vacances', 'Automobile', 'Motos', 'Pêche',
    'Musculation et fitness', 'Soirées', 'Fêtes et événements', 'Hobbies'],
  'Humour et thèmes absurdes': ['Situations gênantes', 'Red Flags', 'Green Flags', 'Pires excuses', 'Choses inutiles',
    'Mauvaises habitudes', 'Situations du quotidien', 'Personnes insupportables', 'Pouvoirs inutiles', 'Pires façons de mourir',
    'Objets improbables', 'Débats absurdes', 'Pires colocataires', 'Galères de soirée', 'Comportements gênants', 'Idées stupides',
    'Pires cadeaux', 'Pires prénoms', 'Situations improbables', 'Choses qu’on regrette', 'Mauvaises décisions'],
  'Culture générale et société': ['Pays et villes', 'Histoire', 'Sciences', 'Mythologie', 'Inventions', 'Marques',
    'Personnalités historiques', 'Expressions françaises', 'Langues', 'Événements historiques', 'Nature', 'Espace'],
};

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// THEMES : [{ id, name, category }]
const THEMES = Object.entries(CATALOG).flatMap(([category, names]) => names.map(name => ({ id: slug(name), name, category })));

module.exports = { THEMES };
