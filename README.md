# Le Cercle — jeux en ligne

Un seul serveur pour plusieurs projets : la page d'accueil (`/`) mène à chaque jeu.

- `/solar/` : **Solar Explorer**, exploration spatiale en 3D (Three.js) jusqu’à 16 pilotes par univers :
  - vol à la troisième personne dans un système solaire qui tourne (heure commune donnée par le serveur), de Mercure à Pluton, avec ceintures d’astéroïdes et de Kuiper, comète de Halley, relief en 3D sur la Lune et Mars, ombres des anneaux et éclipses ;
  - chat, messages rapides, pings, émotes, téléportation vers un ami ;
  - journal d’exploration (vrais faits scientifiques), points, déblocages au hangar de la station (7 vaisseaux, peintures, traînées, effets de boost) et titres ;
  - événements en direct choisis par le serveur : pluie de météorites, comète de passage, tempête solaire ; musique et annonces radio.
  - jouable sur téléphone et tablette : joystick au pouce gauche, visée au pouce droit, boutons boost, monter, descendre et menu ⋯ ; graphismes allégés (`?mobile` force ce mode sur ordinateur).
  Les positions, pings et émotes passent par un canal rapide à part. `SOLAR_FAST_EVENTS=1 npm start` rapproche les événements pour les tester ; `?depart=saturne` part près d’un astre.
- `/golf/` : **Mini-golf** vu du dessus, de 1 à 8 joueurs chacun son tour : 5 trous à thème (moulin, île tropicale, station spatiale, volcan, bonbons) avec murs, moulin, portes mobiles, ponts qui clignotent, sable, glace, eau ou lave, téléporteur, ressort, pente et cheminées. Visée au lance-pierre à la souris ou au doigt. Le serveur calcule chaque tir et envoie la trajectoire : tout le monde voit la balle rouler au même moment.
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
- `golf/` : Mini-golf : `game.js` (tours, coups, pénalités, temps de visée, scores), `server.js` (canal `/golf`) ; `public/golf/physics.js` (les 5 trous et la physique de la balle, partagés par le serveur et le navigateur : ajouter un trou = ajouter un objet à `HOLES`), client dans `public/golf/`, tests dans `test-golf.js` (dont un joueur automatique qui vérifie que chaque trou peut se terminer).
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
