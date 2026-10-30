# Le Cercle — jeux en ligne

Un seul serveur pour plusieurs projets : la page d'accueil (`/`) mène à chaque jeu.

- `/cote/` : **Le Demi-Cercle**, jeu à deux en temps réel : un sujet, un indice, une aiguille entre BON et MAUVAIS, 68 thèmes au choix, 10 manches.
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
- `cote/` : serveur du Demi-Cercle : `game.js` (règles, barème, rôles, thèmes, position secrète filtrée), `subjects.js` (68 thèmes en 5 catégories, 15 sujets chacun : ajouter un sujet = l’ajouter à la liste de son thème), `server.js` (salons à code, reconnexion par jeton, canal Socket.io `/cote`).
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
