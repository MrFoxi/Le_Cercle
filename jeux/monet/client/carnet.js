// LES EAUX DE MONET — le carnet naturaliste : ce que le joueur a vu, pris, conservé, photographié. C'est toute la progression.
// Une espèce se découvre en l'observant (sa fiche s'ouvre), et se complète en la pêchant.
import { ESPECES, LIEUX, espece } from './reglages.js';
import { momentDe } from './temps.js';

export const CLE = 'monet-carnet';
const vierge = () => ({ especes: {}, secteurs: [], gestes: [], collection: [], album: [], lieux: ['etang'], galerie: [], legendes: {}, rumeurs: [], jardinier: { vu: false, defi: 0, prises: 0, legendes: [], anecdote: 0 }, derniere: null });
const fiche = () => ({ vu: 0, prises: 0, relaches: 0, record: null, secteurs: [], meteos: [], moments: [], leurres: [], derniere: null });

export function creerCarnet(stock = null) {
  let D = vierge(); try { D = { ...vierge(), ...JSON.parse(stock?.getItem(CLE) ?? 'null') }; } catch { /* carnet illisible : on repart d'un carnet neuf */ }
  // stockage plein : on sacrifie les plus vieilles images (photos, puis tableaux) plutôt que de perdre tout le reste du carnet
  const garder = () => { for (let k = 0; k < 40; k++) { try { stock?.setItem(CLE, JSON.stringify(D)); return; } catch { if (D.album.length > 4) D.album.pop(); else if (D.galerie.length > 1) D.galerie.pop(); else return; } } };
  const f = id => (D.especes[id] ??= fiche());
  const ajoute = (l, v) => { if (v && !l.includes(v)) l.push(v); };
  const C = {
    donnees: D, garder,
    fiche: id => D.especes[id] ?? null,
    // un poisson observé assez longtemps : renvoie true la première fois (une page s'ouvre)
    observer(id) { const nouveau = !D.especes[id]; f(id).vu++; garder(); return nouveau; },
    secteur(id) { if (!id || D.secteurs.includes(id)) return false; D.secteurs.push(id); garder(); return true; },
    geste(id) { if (!id || D.gestes.includes(id)) return false; D.gestes.push(id); garder(); return true; },
    // une capture : renvoie ce qu'elle a de remarquable
    prise(r) {
      const nouvelle = !D.especes[r.espece]?.prises, e = f(r.espece), m = momentDe(r.heure).id, rec = !e.record || r.longueur > e.record.longueur;
      e.prises++; e.vu++; e.derniere = { ...r, moment: m }; if (rec) e.record = { longueur: r.longueur, poids: r.poids, secteur: r.secteur, meteo: r.meteo, heure: r.heure, leurre: r.leurre };
      ajoute(e.secteurs, r.secteur); ajoute(e.meteos, r.meteo); ajoute(e.moments, m); ajoute(e.leurres, r.leurre); D.derniere = { ...r };
      let legende = false; if (r.legende) { const g = (D.legendes[r.legende] ??= { prises: 0, premiere: null }); legende = !g.prises; g.prises++; g.premiere ??= { longueur: r.longueur, poids: r.poids, heure: r.heure, meteo: r.meteo, leurre: r.leurre, date: Date.now() }; }
      garder(); return { nouvelle, record: rec && !nouvelle, legende };
    },
    relacher(id) { f(id).relaches++; garder(); },
    conserver(r) { D.collection.push({ ...r, date: Date.now() }); garder(); },
    photo(p) { D.album.unshift(p); D.album.length = Math.min(D.album.length, 24); garder(); },
    tableau(t) { D.galerie.unshift(t); D.galerie.length = Math.min(D.galerie.length, 12); garder(); },
    rumeur(id) { if (!id || D.rumeurs.includes(id)) return false; D.rumeurs.push(id); garder(); return true; },
    // la progression vers un lieu : ce qui est fait sur ce qui est demandé
    progres(lieu) {
      const c = lieu.condition; if (!c) return null;
      return { especes: [Math.min(c.especes, Object.keys(D.especes).length), c.especes], secteurs: [Math.min(c.secteurs, D.secteurs.length), c.secteurs], gestes: [Math.min(c.gestes, D.gestes.length), c.gestes] };
    },
    debloque(lieu) { if (lieu.ouvert) return true; const p = C.progres(lieu); return !!p && Object.values(p).every(([a, b]) => a >= b); },
    // à appeler après chaque découverte : renvoie les lieux qui viennent de s'ouvrir
    verifierLieux() { const neufs = LIEUX.filter(l => l.condition && !D.lieux.includes(l.id) && C.debloque(l)); neufs.forEach(l => D.lieux.push(l.id)); if (neufs.length) garder(); return neufs; },
    decouvertes: () => ESPECES.filter(e => D.especes[e.id]).length,
  };
  return C;
}
export { espece };
