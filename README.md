# Le Cercle — jeux en ligne

Un seul serveur pour plusieurs projets : la page d'accueil (`/`) mène à chaque jeu.

- `/solar/` : **Solar Explorer**, exploration spatiale en 3D (Three.js) jusqu’à 16 pilotes par univers :
  - vol à la troisième personne dans un système solaire qui tourne (heure commune donnée par le serveur), de Mercure à Pluton, avec ceintures d’astéroïdes et de Kuiper, comète de Halley, relief en 3D sur la Lune et Mars, ombres des anneaux et éclipses ;
  - chat, messages rapides, pings, émotes, téléportation vers un ami ;
  - journal d’exploration (vrais faits scientifiques), points, déblocages au hangar de la station (7 vaisseaux, peintures, traînées, effets de boost) et titres ;
  - événements en direct choisis par le serveur : pluie de météorites, comète de passage, tempête solaire ; musique et annonces radio.
  - jouable sur téléphone et tablette : joystick au pouce gauche, visée au pouce droit, boutons boost, monter, descendre et menu ⋯ ; graphismes allégés (`?mobile` force ce mode sur ordinateur).
  Les positions, pings et émotes passent par un canal rapide à part. `SOLAR_FAST_EVENTS=1 npm start` rapproche les événements pour les tester ; `?depart=saturne` part près d’un astre.
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

Tout est en mémoire : un redémarrage du service efface les lobbys et les jetons.

## Fichiers

- `server.js` : serveur unique (Express + Socket.io), route `/health`, lobbys du 7,5 sur le canal Socket.io `/7-5`.
- `game.js` : moteur de règles du 7,5 (points, tours, défis, paiements, rotation du banquier, temps de jeu).
- `test.js` : tests lancés par `npm test`.
- `public/index.html` : page d'accueil qui liste les projets.
- `public/7-5/` : client du 7,5 (HTML/CSS/JS).
- `lib/rooms.js` : salons temps réel communs aux jeux multijoueurs (code, lobby public ou privé, reconnexion par jeton, spectateurs, chat). Un jeu fournit sa classe `Room` et la liste de ses actions ; si la `Room` a un `deadline`, sa méthode `timeout()` est appelée à l’heure dite (étapes chronométrées).
- `solar/` : Solar Explorer : `game.js` (pilotes, catalogue de personnalisation, heure commune, événements en direct, validation des messages), `server.js` (canal `/solar`, relais des positions, pings et émotes) ; client dans `public/solar/` :
  - `world.js` (astres et orbites, collisions, relief, zones, comètes, météorites), `textures.js` (textures dessinées par le code), `shadows.js` (éclipses et ombre des anneaux) ;
  - `ships.js` (vaisseaux, peintures, traînées), `fx.js` (feux d’artifice, ondes de choc, éclairs), `audio.js` (sons, musique, voix) ;
  - `progress.js` (journal, points, déblocages, titres), `facts.js` (fiches du journal), `main.js` (vol, caméra, multijoueur, interface, cartes) ;
  - tests dans `test-solar.js`. Three.js est servi depuis `node_modules` sur `/vendor/three/`.
- `golf/` : Mini-golf : `game.js` (salon, réglages, modes, tours, pénalités, paris, robots, trou du jour), `bot.js` (robot : meilleur tir sur une grille, avec la vraie physique), `server.js` (canal `/golf`, émotes) ; partagés avec le navigateur dans `public/golf/` : `physics.js` (physique), `holes.js` (trous, miroirs, parcours, chaos : ajouter un trou = ajouter un objet à `HOLES`), `looks.js` (personnalisation, succès) ; client : `render.js` (dessin), `audio.js` (sons, musique), `profile.js` (points et succès dans le navigateur), `client.js` (écrans) ; tests dans `test-golf.js` (dont un robot qui vérifie que chaque trou peut se terminer).
- `strategy/` : Strategy Club : `game.js` (salon : places humain ou robot, prêt, pendule, coups validés par les règles, marquage au go, revanche), `bot-worker.js` (un robot réfléchit dans un thread à part), `server.js` (canal `/strategy`) ; partagés avec le navigateur dans `public/strategy/` : `games/*.js` (règles d’un jeu : `init`, `moves`, `play`, `over`, `notation`, `evaluate` ; ajouter un jeu = un fichier ici, une ligne dans `GAMES` et une fiche dans `INFO` du client), `ai.js` (robots : alpha-bêta pour échecs, dames et shogi, Monte-Carlo pour le go) ; client : `boards.js` (plateaux, animations), `client.js` (écrans) ; tests dans `test-strategy.js` (comptages de référence « perft » des quatre jeux, cas particuliers, salon, robot).
- `bataille/` : Bataille navale : `game.js` (flottes, tirs, capacités, ce que chacun a le droit de voir), `server.js` (canal `/bataille`) ; client dans `public/bataille/`, tests dans `test-bataille.js`.
- `imposteur/` : L’Imposteur : `words.js` (paires de mots par catégorie : en ajouter une = une ligne), `game.js` (rôles, tours d’indices, vote et revote, Mr. White, victoires, cartes filtrées pour chaque joueur), `server.js` (canal `/imposteur`), `engine.js` (les mêmes règles servies au navigateur sur `/imposteur/engine.js` pour le mode un seul appareil) ; client dans `public/imposteur/` (`client.js` en ligne, `solo.js` un seul appareil, `ui.js` affichage commun), tests dans `test-imposteur.js`.
- `size/` : Size It Up : `objects.js` (objets et dimensions réelles), `game.js` (paires, score), `api.js` (API `/api/size` : les vraies tailles ne sont envoyées qu’après validation) ; client dans `public/size/`, tests dans `test-size.js`.
- `p4/` : règles du Puissance 4 (`game.js`) et branchement sur `lib/rooms.js` (`server.js`, canal `/p4`) ; client dans `public/p4/`, tests dans `test-p4.js`.
- `cote/` : serveur du Demi-Cercle : `game.js` (règles, barème, rôles, thèmes, position secrète filtrée), `themes.js` (68 thèmes en 5 catégories : en ajouter un = l’ajouter à la liste de sa catégorie), `server.js` (salons à code, reconnexion par jeton, canal Socket.io `/cote`).
- `public/cote/` : client du Demi-Cercle (`dial.js` : le demi-cercle interactif et la roue de révélation, `client.js` : écrans et thèmes).
- `test-cote.js` : tests du Demi-Cercle (lancés aussi par `npm test`).
- `public/pays/` : quiz « Trouve le pays » :
  - `quiz.js` (règles, questions, score), `map.js` (carte d3 : frontières, zoom, clics), `stats.js` (records et paramètres dans le navigateur), `main.js` (écrans) ;
  - `countries.json` : frontières Natural Earth 1:50m (197 pays + territoires), générées par `scripts/build-countries.mjs`.
- `test-pays.mjs` : tests du quiz et des données de la carte (lancés aussi par `npm test`).

Pour régénérer la carte (rarement utile) : `node scripts/build-countries.mjs`.

## Ajouter un projet

1. Mettre ses fichiers dans `public/<nom-du-projet>/` : il sera servi à l'adresse `/<nom-du-projet>/`.
2. S'il a besoin de temps réel, lui donner son propre canal : `sockets.of('/<nom-du-projet>')` dans `server.js`, `io('/<nom-du-projet>')` côté client.
3. Ajouter sa carte dans `public/index.html`.
