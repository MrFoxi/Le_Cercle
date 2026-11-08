# Le Cercle : carte du dépôt

Site de mini-jeux (Express + Socket.io + Three.js), déployé sur Render depuis `main`. Tout est en français :
textes, commentaires, messages de commit (`Feat : …` / `Fix : …`).

## Où est quoi

- `jeux/<jeu>/` : un dossier par jeu, trouvé tout seul par `server.js` (rien à y ajouter pour un nouveau jeu) :
  - `client/` : servi sur `/<jeu>/` ; contient aussi le code partagé avec le serveur (physique, cartes, circuits) ;
  - `server/server.js` : canal Socket.io `/<jeu>` (jeux en ligne) ; `server/api.js` : `/api/<jeu>` (classements) ;
  - `<jeu>.test.js` / `.mjs` : ses tests.
- `lib/rooms.js` : salons communs (codes, public/privé, reconnexion par jeton, spectateurs, chat). Un jeu fournit `Room`
  (players, spectators, get, spectator, taken, addPlayer, addSpectator, removePlayer, removeSpectator, viewFor, summary?)
  et ses actions ; `room.deadline` + `room.timeout()` pour les étapes chronométrées ; `room.notify()`, `room.emit()`
  (volatile) et `room.send()` (fiable) sont posés par `lib/rooms.js`.
- `lib/room-base.js` : `BaseRoom` (joueurs, spectateurs, créateur) pour tous les `Room` ; `PartyRoom` (robots, réglages,
  manches, fin de partie) pour Chute, Néon, Prop Hunt. `lib/leaderboard.js` : classements mondiaux (top 10 par pseudo).
- `shared/party.js` (sur `/shared/`) : salon côté navigateur des jeux à manches (pseudo, salons, reconnexion, joueurs, fil,
  fin de partie, sons `blip`) ; le jeu branche `onShow`/`onRoom` et lit `ui.room`.
- `lib/admin.js` : administration. Le pseudo `MrFoxi` est réservé (mot de passe dans la variable `ADMIN_PASSWORD`, jamais
  dans le code) ; taper ce pseudo dans un champ ouvre une fenêtre de mot de passe, et l'accueil montre alors
  un engrenage vers `/admin.html` (présence solo et multi, salons, classements) ; tout est dans `shared/presence.js`. `lib/rooms.js`,
  le 7,5 et `lib/leaderboard.js` s'y inscrivent et refusent le pseudo réservé sans le cookie admin.
- `lib/store.js` : stockage durable (Upstash Redis en ligne, `data/*.json` en local). `lib/activity.js` : bandeau de l'accueil.
- `site/index.html` : accueil (tableau `GAMES`, `PSEUDO_KEYS`) ; `site/previews/<jeu>.jpg` : aperçus.
- `jeux/7-5/server/server.js` : seul jeu qui n'utilise pas `lib/rooms.js` (plus ancien).

## Conventions

- Code partagé serveur + navigateur : script classique UMD (`window.X` ou `require`, ex. `chute/client/sim.js`,
  `prophunt/client/map.js`). Le serveur ne charge pas les modules ESM du client (Render) : Top Formula recopie donc
  ses temps minimaux dans `formula/server/game.js`, et Little Fisher ses tailles de poissons dans `fisher/server/sizes.js`
  (un test vérifie qu'ils correspondent).
- Côté navigateur : modules ESM, Three.js via l'importmap `/vendor/three/...`. Little District : `styles.js?quartier=<id>`
  charge l'apparence d'un quartier précis (utilisé par Prop Hunt).
- Positions temps réel : le navigateur déplace son personnage et envoie sa position ; le serveur contrôle (pas de
  téléportation) et tranche (dalles, collisions, tirs). Sillage Néon est entièrement calculé par le serveur.

## Commandes

- `npm start` : site sur http://localhost:3000 ; `npm test` : tous les tests (`node --test`, ~30 s).
- Un seul jeu : `node --test jeux/<jeu>/`.

## Avant de finir un changement

Tests verts, puis `git add . && git commit -m "Feat : …" && git push` (le dépôt est déployé automatiquement).
