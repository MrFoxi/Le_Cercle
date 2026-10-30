# 7,5 — multijoueur en ligne

Jeu de cartes « 7,5 » en temps réel dans le navigateur (Node.js, Express, Socket.io).
Le serveur fait autorité : paquet, tirages, défis et paiements sont calculés côté serveur, et les cartes cachées ne sont jamais envoyées aux autres joueurs.

## Lancer en local

Il faut Node.js 18 ou plus.

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000 dans deux onglets (avec deux pseudos différents).

Tests du moteur de règles : `npm test`.

## Déployer sur Render

1. Pousser ce dossier sur un dépôt GitHub.
2. Sur Render : **New → Web Service**, choisir le dépôt.
3. Runtime **Node**, Build command `npm install`, Start command `npm start`.
4. Render fournit la variable `PORT`, le serveur l'utilise automatiquement.

Tout est en mémoire : un redémarrage du service efface les lobbys et les jetons.

## Fichiers

- `game.js` : moteur de règles (points, tours, défis, paiements, rotation du banquier).
- `server.js` : lobbys, connexions, reconnexion sous 60 s, envoi d'un état filtré à chaque joueur.
- `public/` : client HTML/CSS/JS.
- `test.js` : tests lancés par `npm test`.
