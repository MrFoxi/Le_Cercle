# Le Cercle — jeux en ligne

Un seul serveur pour plusieurs projets : la page d'accueil (`/`) mène à chaque jeu.

- `/solar/` : **Solar Explorer**, exploration spatiale en 3D (Three.js) jusqu’à 16 pilotes par univers :
  - vol à la troisième personne dans un système solaire qui tourne (heure commune donnée par le serveur), de Mercure à Pluton, avec ceintures d’astéroïdes et de Kuiper, comète de Halley, relief en 3D sur la Lune et Mars, ombres des anneaux et éclipses ;
  - chat, messages rapides, pings, émotes, téléportation vers un ami ;
  - journal d’exploration (vrais faits scientifiques), points, déblocages au hangar de la station (7 vaisseaux, peintures, traînées, effets de boost) et titres ;
  - événements en direct choisis par le serveur : pluie de météorites, comète de passage, tempête solaire ; musique et annonces radio.
  - jouable sur téléphone et tablette : joystick au pouce gauche, visée au pouce droit, boutons boost, monter, descendre et menu ⋯ ; graphismes allégés (`?mobile` force ce mode sur ordinateur).
  Les positions, pings et émotes passent par un canal rapide à part. `SOLAR_FAST_EVENTS=1 npm start` rapproche les événements pour les tester ; `?depart=saturne` part près d’un astre.
- `/mines/` : **Démineur Rogue**, le démineur en roguelike, en solo :
  - grilles qui grandissent et se densifient, parfois en losange ou trouées ; premier clic toujours sûr ; chaque grille est vérifiée par un solveur pour se finir par déduction (et si l’on est forcé de deviner, la mine est déplacée sans pénalité) ;
  - 4 personnages (Démineur, Sapeur, Banquier, Voyant), vies, pièces, trésors et coffres cachés, combo d’ouvertures rapides ;
  - 19 améliorations en 4 raretés (dont le Pacte maudit), 2 évolutions, 4 combinaisons cachées, 6 pouvoirs, boutique avec revente, choix du chemin entre les niveaux, 10 événements (dont l’Inconnu et la grille d’élite) ;
  - 5 boss en boucle tous les 5 niveaux (Colosse, Ombre, Écho, Démineur fou, Pendule) ;
  - partie du jour (même graine pour tous, classement du jour), défi à un ami par lien, mode apprentissage, musique qui s’intensifie, raccourcis clavier ;
  - records, succès, thèmes, collection, historique, statistiques par amélioration, objectif suivant, classement mondial (`/api/mines`).
- `/pinball/` : **3D Pinball**, flipper d’arcade en 3D (Three.js), en solo, sur 5 tables (chacune se débloque avec 100 000 points sur la précédente) :
  - Arcade classique (A-R-C, cibles tombantes, porte et trou de capture), Espace (planètes, vaisseau mobile, portails, trou noir qui aspire), Casino (roulette, machine à sous, cartes, jetons), Jungle (totems T-I-K-I, serpents mobiles, temple, piège, passage secret, trésor caché), Volcan (lave qui repousse, rochers mobiles, jets de vapeur, bumpers surpuissants) ;
  - sur chaque table : flippers, slingshots, 3 bumpers, 2 rampes en relief, spinner, couloirs 1-2-3, multiball à 3 billes, super jackpot, 7 à 9 missions affichées en jeu ;
  - score multiplié (×1 à ×5), combos, protection de début de bille, secousse et tilt, décompte de fin de bille ;
  - succès, billes à débloquer, statistiques et record par table dans le navigateur ; classement mondial par table (`/api/pinball`) ;
  - clavier, souris et tactile ; sons et musique synthétisés, une ambiance par table.
- `/strategy/` : **Strategy Club**, le salon des jeux de stratégie : échecs, dames internationales, shogi et go (9 × 9, 13 × 13, 19 × 19) :
  - règles complètes (roque, prise en passant, promotion, pat et nulles ; prise majoritaire, rafles et dames volantes ; parachutages, nifu, uchifuzume, sennichite ; ko, suicide interdit, marquage des pierres mortes, compte chinois ou japonais) ;
  - entre amis (salon public ou privé, places, « prêt », pendule de 5 à 30 min), contre un robot (Débutant à Expert, revanche et changement de niveau sans quitter), spectateurs en direct et discussion ;
  - plateau qui se construit à l’ouverture de chaque jeu, coups animés, apparence (plateaux, pièces, ambiances).
- `/golf/` : **Mini-golf** vu du dessus, de 1 à 8 joueurs (et des robots) :
  - 10 trous à thème (moulin, île, station spatiale, volcan, bonbons, manoir hanté, banquise, fête foraine, fond marin, jungle) et leurs versions miroir ; parcours Découverte, Nouveaux mondes, Grand Tour, Express, Aléatoire, Marathon (18 trous) et Trou du jour (classement du jour) ;
  - balles qui se cognent, effet, vent, rampes et sauts, moulins, portes, plaques et portes secrètes, tuyaux, téléporteurs, aimants, tapis roulants, animaux qui bougent, trou sur un manège, trous bonus ;
  - modes Chacun son tour, Tous en même temps, Course, Mort subite, Par équipes ; option chaos (un modificateur par trou), paris entre amis, aide à la visée, temps de tir et coups max réglables ; un robot remplace un joueur déconnecté ;
  - vestiaire (couleurs, motifs, finitions, traînées, effets de victoire, clubs), points, succès et titres, statistiques ; émotes, chat, ralenti des beaux coups, caméra qui suit la balle, musique et ambiance par thème ; parcours tourné sur un téléphone tenu à la verticale.
  Le serveur calcule chaque tir et envoie les trajectoires : tout le monde voit les balles rouler au même moment.
- `/bataille/` : **Bataille navale**, à deux en temps réel : modes Classique, Moderne (radar, drone, sonar, missiles, brouillage) et Rapide (8 × 8), flottes gardées secrètes par le serveur.
- `/imposteur/` : **L’Imposteur**, de 3 à 12 joueurs en temps réel : civils, imposteurs (mot proche) et Mr. White (aucun mot), indices, discussion, vote secret. Aussi en mode soirée sur un seul appareil (`/imposteur/solo.html`).
- `/size/` : **Size It Up**, jeu solo : mettre l’objet rouge à l’échelle de l’objet bleu, à l’œil nu.
- `/p4/` : **Puissance 4**, à deux en temps réel, avec revanches, statistiques du salon et spectateurs.
- `/cote/` : **Le Demi-Cercle**, jeu à deux en temps réel : un thème, un mot donné par l’adversaire, une aiguille entre MAUVAIS et BON, 68 thèmes au choix, 10 manches.
- `/pays/` : **Trouve le pays**, quiz de géographie sur une carte du monde (jeu solo, tout se passe dans le navigateur).
- `/7-5/` : **Le Cercle du 7,5**, jeu de cartes « 7,5 » en temps réel dans le navigateur (Node.js, Express, Socket.io).
Le serveur fait autorité : paquet, tirages, défis et paiements sont calculés côté serveur, et les cartes cachées ne sont jamais envoyées aux autres joueurs.

## Lancer en local

Il faut Node.js 18 ou plus.

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000 (accueil) ou directement http://localhost:3000/7-5/ dans deux onglets, avec deux pseudos différents.

Tests du moteur de règles : `npm test`.

## Déployer sur Render

1. Pousser ce dossier sur un dépôt GitHub.
2. Sur Render : **New → Web Service**, choisir le dépôt.
3. Runtime **Node**, Build command `npm install`, Start command `npm start`.
4. Render fournit la variable `PORT`, le serveur l'utilise automatiquement.

Les salons sont en mémoire : un redémarrage du service les efface. Les classements et l'activité de l'accueil sont gardés dans Upstash Redis (variables `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`), ou dans `data/` en local.

## Organisation

Un dossier par jeu dans `jeux/<jeu>/`, trouvé tout seul par `server.js` :

- `client/` : ce que voit le navigateur, servi à l'adresse `/<jeu>/` (et le code partagé avec le serveur : physique, cartes, circuits) ;
- `server/server.js` (jeux en ligne) : branché sur le canal Socket.io `/<jeu>` ;
- `server/api.js` (classements…) : servi sur `/api/<jeu>` ;
- `<jeu>.test.js` (ou `.mjs`) : ses tests.

Le reste :

- `server.js` : démarre le site, branche chaque jeu, `/health`, `/api/online`, `/api/activity`.
- `site/` : la page d'accueil (`index.html`) et les aperçus des jeux (`previews/`).
- `lib/rooms.js` : salons temps réel communs (code, salon public ou privé, reconnexion par jeton, spectateurs, chat). Un jeu fournit sa classe `Room` et la liste de ses actions ; si la `Room` a un `deadline`, sa méthode `timeout()` est appelée à l’heure dite.
- `lib/room-base.js` : base des classes `Room` (joueurs, spectateurs, créateur) ; `PartyRoom` y ajoute robots, réglages, manches et fin de partie pour les jeux à manches (Chute Libre, Sillage Néon, Prop Hunt).
- `lib/leaderboard.js` : classements mondiaux (top 10, meilleur score par pseudo) pour Trouve le pays, Pinball, Démineur Rogue et Top Formula.
- `lib/store.js` (stockage durable), `lib/activity.js` (bandeau d’activité de l’accueil).
- `shared/party.js` (servi sur `/shared/`) : côté navigateur des jeux à manches : pseudo, salons, reconnexion, lien d’invitation, liste des joueurs, fil d’événements, fin de partie et petits sons.
- `npm test` lance tous les fichiers `*.test.*` (`node --test`).

### Détail par jeu

- `jeux/7-5/` : Le Cercle du 7,5 : `server/game.js` (points, tours, défis, paiements, rotation du banquier, temps de jeu), `server/server.js` (ses propres tables, plus anciennes que `lib/rooms.js`).
- `jeux/solar/server/` : Solar Explorer : `game.js` (pilotes, catalogue de personnalisation, heure commune, événements en direct, validation des messages), `server.js` (canal `/solar`, relais des positions, pings et émotes) ; client dans `jeux/solar/client/` :
  - `world.js` (astres et orbites, collisions, relief, zones, comètes, météorites), `textures.js` (textures dessinées par le code), `shadows.js` (éclipses et ombre des anneaux) ;
  - `ships.js` (vaisseaux, peintures, traînées), `fx.js` (feux d’artifice, ondes de choc, éclairs), `audio.js` (sons, musique, voix) ;
  - `progress.js` (journal, points, déblocages, titres), `facts.js` (fiches du journal), `main.js` (vol, caméra, multijoueur, interface, cartes) ;
  - tests dans `jeux/solar/solar.test.js`. Three.js est servi depuis `node_modules` sur `/vendor/three/`.
- `jeux/golf/server/` : Mini-golf : `game.js` (salon, réglages, modes, tours, pénalités, paris, robots, trou du jour), `bot.js` (robot : meilleur tir sur une grille, avec la vraie physique), `server.js` (canal `/golf`, émotes) ; partagés avec le navigateur dans `jeux/golf/client/` : `physics.js` (physique), `holes.js` (trous, miroirs, parcours, chaos : ajouter un trou = ajouter un objet à `HOLES`), `looks.js` (personnalisation, succès) ; client : `render.js` (dessin), `audio.js` (sons, musique), `profile.js` (points et succès dans le navigateur), `client.js` (écrans) ; tests dans `jeux/golf/golf.test.js` (dont un robot qui vérifie que chaque trou peut se terminer).
- `jeux/pinball/server/api.js` : classement mondial du flipper ; jeu dans `jeux/pinball/client/` : `physics.js` (physique 2D dans le plan de la table, 600 pas par seconde, rampes en 3D), `tables.js` (géométrie, règles et missions : une table = un objet, sur une ossature commune), `game.js` (règles), `render.js` (scène 3D, lumières, particules, écran du fronton), `audio.js`, `main.js` (menu, commandes, interface, progression) ; tests dans `jeux/pinball/pinball.test.mjs`.
- `jeux/mines/server/api.js` : classement mondial du Démineur Rogue ; jeu dans `jeux/mines/client/` : `board.js` (grille, génération résoluble, solveur), `run.js` (partie : niveaux, améliorations, pouvoirs, boutique, événements, boss), `main.js` (écrans, commandes, animations, sons, progression) ; tests dans `jeux/mines/mines.test.mjs`.
- `jeux/strategy/server/` : Strategy Club : `game.js` (salon : places humain ou robot, prêt, pendule, coups validés par les règles, marquage au go, revanche), `bot-worker.js` (un robot réfléchit dans un thread à part), `server.js` (canal `/strategy`) ; partagés avec le navigateur dans `jeux/strategy/client/` : `games/*.js` (règles d’un jeu : `init`, `moves`, `play`, `over`, `notation`, `evaluate` ; ajouter un jeu = un fichier ici, une ligne dans `GAMES` et une fiche dans `INFO` du client), `ai.js` (robots : alpha-bêta pour échecs, dames et shogi, Monte-Carlo pour le go) ; client : `boards.js` (plateaux, animations), `client.js` (écrans) ; tests dans `jeux/strategy/strategy.test.js` (comptages de référence « perft » des quatre jeux, cas particuliers, salon, robot).
- `jeux/bataille/server/` : Bataille navale : `game.js` (flottes, tirs, capacités, ce que chacun a le droit de voir), `server.js` (canal `/bataille`) ; client dans `jeux/bataille/client/`, tests dans `jeux/bataille/bataille.test.js`.
- `jeux/imposteur/server/` : L’Imposteur : `words.js` (paires de mots par catégorie : en ajouter une = une ligne), `game.js` (rôles, tours d’indices, vote et revote, Mr. White, victoires, cartes filtrées pour chaque joueur), `server.js` (canal `/imposteur`), `engine.js` (les mêmes règles servies au navigateur sur `/imposteur/engine.js` pour le mode un seul appareil) ; client dans `jeux/imposteur/client/` (`client.js` en ligne, `solo.js` un seul appareil, `ui.js` affichage commun), tests dans `jeux/imposteur/imposteur.test.js`.
- `jeux/size/server/` : Size It Up : `objects.js` (objets et dimensions réelles), `game.js` (paires, score), `api.js` (API `/api/size` : les vraies tailles ne sont envoyées qu’après validation) ; client dans `jeux/size/client/`, tests dans `jeux/size/size.test.js`.
- `jeux/p4/server/` : règles du Puissance 4 (`game.js`) et branchement sur `lib/rooms.js` (`server.js`, canal `/p4`) ; client dans `jeux/p4/client/`, tests dans `jeux/p4/p4.test.js`.
- `jeux/cote/server/` : serveur du Demi-Cercle : `game.js` (règles, barème, rôles, thèmes, position secrète filtrée), `themes.js` (68 thèmes en 5 catégories : en ajouter un = l’ajouter à la liste de sa catégorie), `server.js` (salons à code, reconnexion par jeton, canal Socket.io `/cote`).
- `jeux/cote/client/` : client du Demi-Cercle (`dial.js` : le demi-cercle interactif et la roue de révélation, `client.js` : écrans et thèmes).
- `jeux/cote/cote.test.js` : tests du Demi-Cercle (lancés aussi par `npm test`).
- `jeux/pays/client/` : quiz « Trouve le pays » :
  - `quiz.js` (règles, questions, score), `map.js` (carte d3 : frontières, zoom, clics), `stats.js` (records et paramètres dans le navigateur), `main.js` (écrans) ;
  - `countries.json` : frontières Natural Earth 1:50m (197 pays + territoires), générées par `scripts/build-countries.mjs`.
- `jeux/pays/pays.test.mjs` : tests du quiz et des données de la carte (lancés aussi par `npm test`).
- `jeux/formula/` : Top Formula : `client/tracks.js` (circuits, relief), `physics.js` (conduite), `ai.js` (robots), `render.js` + `car.js` + `decor.js` + `fx.js` + `textures.js` (rendu), `main.js` (menus, course, multijoueur) ; `server/game.js` (salons), `server/api.js` (records).
- `jeux/chute/`, `jeux/neon/`, `jeux/prophunt/` : Chute Libre, Sillage Néon, Prop Hunt : `server/game.js` (règles, robots), `server/server.js` ; côté client `main.js` (écrans, partie) et `render.js` ; partagés : `client/sim.js` (Chute), `client/map.js` (Prop Hunt, avec les modèles de Little District).
- `jeux/district/` : Little District (solo) : `client/sim.js` (économie), `models.js` et `styles.js` (bâtiments, décor, quartiers), `world.js`, `land.js`, `layouts.js`, `people.js`, `life.js`, `main.js`.

Pour régénérer la carte (rarement utile) : `node scripts/build-countries.mjs`.

## Ajouter un jeu

1. Créer `jeux/<nom>/client/` avec son `index.html` : il est servi à l'adresse `/<nom>/`.
2. En ligne : `jeux/<nom>/server/server.js` qui exporte `nsp => …` (souvent `lib/rooms.js` + une classe `Room`) ; côté navigateur, `io('/<nom>')`.
3. Ajouter ses tests dans `jeux/<nom>/<nom>.test.js`, sa carte dans `site/index.html` et son aperçu dans `site/previews/<nom>.jpg`.

Rien à modifier dans `server.js` ni dans `package.json`.
