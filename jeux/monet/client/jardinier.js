// LES EAUX DE MONET — le père Anselme, jardinier de l'étang depuis toujours. Il raconte, il donne de petits défis,
// et à chaque défi relevé il livre une rumeur : où et quand trouver l'une des cinq légendes. Ici, rien que des mots.
import { LEGENDES, ETANG, espece, legende } from './reglages.js';

export const NOM = 'Le père Anselme';
const cm = r => `${r.longueur} centimètres`;
// les défis, dans l'ordre ; chacun ouvre la rumeur d'une légende
export const DEFIS = [
  { id: 'pages', legende: 'reine', demande: 'Commence par regarder. Ouvre trois pages de ton carnet : trois poissons différents, observés de tes yeux.', rappel: 'Trois pages au carnet, trois poissons vus de près. Penche-toi sur l’eau, laisse-la s’éclaircir.', fait: D => Object.keys(D.especes).length >= 3 },
  { id: 'tableau', legende: 'bronze', demande: 'Tu as un chevalet sur le dos, non ? Pose-le où tu veux (touche V) et peins-moi l’étang. Un seul tableau, pour commencer.', rappel: 'Mon tableau, alors ? Pose ton chevalet n’importe où (V), et laisse le paysage venir.', fait: D => D.galerie.length >= 1 },
  { id: 'relacher', legende: 'ombre', demande: 'Un bon pêcheur rend plus qu’il ne garde. Remets trois poissons à l’eau, et regarde-les repartir.', rappel: 'Trois poissons rendus à l’eau. Ils reviendront, plus malins.', fait: D => Object.values(D.especes).reduce((s, e) => s + e.relaches, 0) >= 3 },
  { id: 'pluie', legende: 'dame', demande: 'L’étang n’est jamais plus beau que sous l’averse. Rapporte-moi une photographie prise sous la pluie.', rappel: 'Une photographie sous la pluie. Quand le ciel se couvre, sors l’appareil (P).', fait: D => D.album.some(p => p.meteo === 'pluie') },
  { id: 'coins', legende: 'fantome', demande: 'Dernière chose : fais le tour. Les cinq coins de l’étang, chacun à pied.', rappel: 'Les cinq coins de l’étang, tous. Ta carte te dira ceux qui manquent.', fait: D => D.secteurs.length >= ETANG.secteurs.length },
];
const ANECDOTES = [
  'Le peintre de la maison venait ici avant l’aube, avec quatre toiles à la fois. Il en changeait à chaque fois que la lumière tournait.',
  'Les nénuphars, je les taille à la main, depuis la barque. Si on les laisse faire, ils mangent tout l’étang en un été.',
  'Les perches se tiennent près des piles du pont. Les gros brochets, eux, attendent à la lisière des feuilles, sans bouger un aileron.',
  'Quand les gardons s’affolent en surface, c’est qu’un carnassier les pousse. Lance là où l’eau bouillonne.',
  'Par temps gris, les poissons oublient leur méfiance. Par grand soleil, il faut s’approcher doucement.',
  'Le sandre n’aime pas la lumière. Attends le soir, et pêche tout contre le fond.',
  'Ne cours pas sur la berge : le chevesne t’entend arriver depuis l’autre rive.',
  'Le matin, une brume se lève parfois sur l’eau. Ce sont les heures que je préfère.',
];
// où il travaille selon l'heure
export const POSTES = { matin: 'nenuphars', jour: 'pont', soir: 'saule', nuit: 'camp' };

// parler au jardinier : rend les répliques à afficher, et note au carnet ce qu'il a dit
export function parler(C) {
  const D = C.donnees, J = D.jardinier, dit = [];
  if (!J.vu) {
    J.vu = true; J.prises = total(D);
    dit.push('Tiens, un nouveau visage au bord de l’eau ! Je suis Anselme, je jardine ici depuis plus longtemps que les saules.', 'On raconte que cinq poissons pas comme les autres vivent dans cet étang. Des légendes. Moi, je les ai tous vus, au moins une fois.', 'Je te dirai où les chercher… si tu me rends quelques services. ' + DEFIS[0].demande);
    C.garder(); return dit;
  }
  // une légende sortie de l'eau depuis notre dernière conversation
  for (const g of LEGENDES) if (D.legendes[g.id]?.prises && !J.legendes.includes(g.id)) { J.legendes.push(g.id); dit.push(`${g.nom} ! Tu l’as eue ? ${cm(D.legendes[g.id].premiere)}… Il y a quarante ans que personne ne l’avait sortie de l’eau.`); }
  const n = total(D);
  if (n > J.prises && D.derniere && !D.derniere.legende) dit.push(reaction(D.derniere));
  J.prises = n;
  if (J.defi < DEFIS.length) {
    const d = DEFIS[J.defi];
    if (d.fait(D)) {
      const g = legende(d.legende); C.rumeur(g.id); J.defi++;
      dit.push(`C’est bien, c’est très bien. Alors écoute : ${g.rumeur}`, `Je l’ai noté dans ton carnet, page des légendes : ${g.nom}.`);
      dit.push(J.defi < DEFIS.length ? DEFIS[J.defi].demande : 'Je t’ai tout dit. Les cinq sont quelque part sous ces feuilles. Prends ton temps : l’étang ne se presse jamais.');
    } else dit.push(d.rappel, ANECDOTES[J.anecdote++ % ANECDOTES.length]);
  } else {
    const restantes = LEGENDES.filter(g => !D.legendes[g.id]?.prises);
    dit.push(restantes.length ? `Il t’en reste ${restantes.length} à trouver. ${ANECDOTES[J.anecdote++ % ANECDOTES.length]}` : 'Les cinq ! Tu as pris les cinq légendes. Il faudra que le peintre fasse ton portrait.');
  }
  C.garder(); return dit;
}
const total = D => Object.values(D.especes).reduce((s, e) => s + e.prises, 0);
function reaction(r) {
  const sp = espece(r.espece), g = r.longueur >= sp.longueur[0] + (sp.longueur[1] - sp.longueur[0]) * 0.7;
  return g ? `J’ai vu ça d’ici : ${sp.nom.toLowerCase() === 'perche' ? 'une perche' : 'un ' + sp.nom.toLowerCase()} de ${cm(r)} ! Une très belle prise.` : `Alors, ${sp.nom.toLowerCase() === 'perche' ? 'cette perche' : 'ce ' + sp.nom.toLowerCase()} ? ${cm(r)}, c’est un bon début. Les grands se tiennent plus loin.`;
}
