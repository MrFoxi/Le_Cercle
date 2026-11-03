// Mini-golf : catalogue de personnalisation (balle, finition, traînée, effet de victoire, club) et points nécessaires
// pour débloquer chaque élément. Partagé par le serveur (qui vérifie les choix) et le navigateur (window.GolfLooks).
(function (root) {
  const CATALOG = {
    color: [
      { id: 'rouge', name: 'Rouge', hex: '#ff5a5f', need: 0 }, { id: 'bleu', name: 'Bleu', hex: '#3d8bff', need: 0 },
      { id: 'jaune', name: 'Jaune', hex: '#ffc93c', need: 0 }, { id: 'violet', name: 'Violet', hex: '#9b5de5', need: 0 },
      { id: 'menthe', name: 'Menthe', hex: '#00c2a8', need: 0 }, { id: 'orange', name: 'Orange', hex: '#ff8c42', need: 0 },
      { id: 'rose', name: 'Rose', hex: '#f15bb5', need: 0 }, { id: 'blanc', name: 'Blanc', hex: '#f4f4f4', need: 0 },
      { id: 'noir', name: 'Nuit', hex: '#2d3142', need: 60 }, { id: 'citron', name: 'Citron', hex: '#b5e550', need: 60 },
      { id: 'ciel', name: 'Ciel', hex: '#7ad7ff', need: 60 }, { id: 'corail', name: 'Corail', hex: '#ff7f6e', need: 60 },
    ],
    motif: [
      { id: 'uni', name: 'Uni', need: 0 }, { id: 'rayures', name: 'Rayures', need: 0 }, { id: 'etoiles', name: 'Étoiles', need: 100 },
      { id: 'smiley', name: 'Smiley', need: 150 }, { id: 'damier', name: 'Damier', need: 200 }, { id: 'pasteque', name: 'Pastèque', need: 250 },
      { id: 'huit', name: 'Boule 8', need: 300 }, { id: 'planete', name: 'Planète', need: 400 }, { id: 'arcenciel', name: 'Arc-en-ciel', need: 600 },
    ],
    finish: [
      { id: 'mat', name: 'Classique', need: 0 }, { id: 'brillant', name: 'Brillante', need: 120 },
      { id: 'fluo', name: 'Fluo qui pulse', need: 350 }, { id: 'or', name: 'Or massif', need: 800 },
    ],
    trail: [
      { id: 'aucune', name: 'Aucune', need: 0 }, { id: 'classique', name: 'Classique', need: 0 }, { id: 'etincelles', name: 'Étincelles', need: 150 },
      { id: 'arcenciel', name: 'Arc-en-ciel', need: 200 }, { id: 'bulles', name: 'Bulles', need: 250 }, { id: 'coeurs', name: 'Cœurs', need: 300 },
      { id: 'flammes', name: 'Flammes', need: 400 },
    ],
    sink: [
      { id: 'confettis', name: 'Confettis', need: 0 }, { id: 'etoiles', name: 'Pluie d’étoiles', need: 150 }, { id: 'feu', name: 'Feu d’artifice', need: 200 },
      { id: 'bonbons', name: 'Pluie de bonbons', need: 250 }, { id: 'coeurs', name: 'Cœurs', need: 300 },
    ],
    club: [
      { id: 'bois', name: 'Bois', need: 0 }, { id: 'sucre', name: 'Sucre d’orge', need: 250 }, { id: 'neon', name: 'Néon', need: 300 },
      { id: 'or', name: 'Or', need: 500 }, { id: 'laser', name: 'Sabre laser', need: 700 },
    ],
  };
  // Succès : chacun rapporte des points et un titre à afficher sous son pseudo
  const ACHIEVEMENTS = [
    { id: 'premier', name: 'Premier trou', desc: 'Terminer un trou.', title: 'Golfeur du dimanche' },
    { id: 'trouenun', name: 'Trou en un', desc: 'Rentrer la balle du premier coup.', title: 'As du trou en un' },
    { id: 'birdie3', name: 'Série de birdies', desc: '3 birdies (ou mieux) d’affilée dans une partie.', title: 'Roi du birdie' },
    { id: 'sec', name: 'Au sec', desc: 'Finir une partie de 5 trous ou plus sans tomber à l’eau.', title: 'Imperméable' },
    { id: 'gagnant', name: 'Champion', desc: 'Gagner une partie contre au moins un adversaire.', title: 'Champion du green' },
    { id: 'habitue', name: 'Habitué', desc: 'Terminer 10 parties.', title: 'Pilier du club' },
    { id: 'centenaire', name: 'Centenaire', desc: 'Jouer 100 trous.', title: 'Légende du parcours' },
    { id: 'billard', name: 'Billard', desc: 'Pousser la balle d’un adversaire dans l’eau.', title: 'Joueur de billard' },
    { id: 'chanceux', name: 'Chanceux', desc: 'Entrer dans le trou poussé par une autre balle.', title: 'Trèfle à quatre feuilles' },
    { id: 'ricochet', name: 'Ricochet', desc: 'Rentrer la balle après 4 rebonds ou plus.', title: 'Roi du ricochet' },
    { id: 'bonus', name: 'Chasseur de trésor', desc: 'Rentrer la balle dans un trou bonus.', title: 'Chasseur de trésor' },
    { id: 'teleport', name: 'Raccourci', desc: 'Rentrer la balle après un téléporteur ou un tuyau.', title: 'Maître des raccourcis' },
    { id: 'saut', name: 'Cascadeur', desc: 'Rentrer la balle après un saut sur une rampe.', title: 'Cascadeur' },
    { id: 'lave', name: 'Pieds au frais', desc: 'Finir le volcan sans toucher la lave.', title: 'Maître de la lave' },
    { id: 'marathon', name: 'Marathonien', desc: 'Finir le parcours Marathon (18 trous).', title: 'Marathonien' },
    { id: 'parieur', name: 'Parieur', desc: 'Gagner 20 points de paris au total.', title: 'Bookmaker' },
    { id: 'chaos', name: 'Dompteur du chaos', desc: 'Finir une partie en mode chaos.', title: 'Dompteur du chaos' },
    { id: 'jour', name: 'Rendez-vous quotidien', desc: 'Jouer le trou du jour.', title: 'Lève-tôt' },
  ];
  const DEFAULT = { color: 'rouge', motif: 'uni', finish: 'mat', trail: 'classique', sink: 'confettis', club: 'bois', title: '' };
  const valid = (k, v) => (k === 'title' ? v === '' || ACHIEVEMENTS.some(a => a.id === v) : CATALOG[k].some(i => i.id === v));
  // Un choix inconnu est remplacé par celui par défaut (les déblocages sont vérifiés dans le navigateur : c'est décoratif).
  const validLook = look => Object.fromEntries(Object.keys(DEFAULT).map(k => [k, valid(k, look?.[k]) ? look[k] : DEFAULT[k]]));
  const titleOf = id => ACHIEVEMENTS.find(a => a.id === id)?.title ?? '';
  const hexOf = id => (CATALOG.color.find(c => c.id === id) ?? CATALOG.color[0]).hex;

  const api = { CATALOG, ACHIEVEMENTS, DEFAULT, validLook, hexOf, titleOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GolfLooks = api;
})(this);
