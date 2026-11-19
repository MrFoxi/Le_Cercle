// LES EAUX DE MONET — les poissons sont de vrais êtres : chacun a son coin d'eau, sa profondeur, ses heures, sa façon de nager,
// il voit le leurre, s'y intéresse ou s'en méfie, a peur des pas lourds sur la berge. Aucun n'apparaît pour le joueur.
import { ESPECES, LEGENDES, ETANG, espece } from './reglages.js';
import { profondeur, habitat, abri, CASES_EAU, hasard as graine } from './etang.js';
import { momentDe } from './temps.js';

const TAU = Math.PI * 2, angle = a => Math.atan2(Math.sin(a), Math.cos(a));
// l'envie de chasser d'une espèce à cette heure, par ce temps (0 à environ 1,3)
export function activite(sp, heure, meteo) { return sp.activite[momentDe(heure).id] * (sp.meteo[meteo] ?? 1); }
// une légende est-elle sortie de sa cachette, à cette heure et par ce temps ?
export const eveillee = (g, heure, meteo) => g.moments.includes(momentDe(heure).id) && g.meteos.includes(meteo);

function placer(sp, r) {
  const notes = CASES_EAU.map(([x, z]) => [x, z, habitat(sp.habitat, x, z) ** 2 + 1e-4]), total = notes.reduce((s, n) => s + n[2], 0); let v = r() * total;
  for (const n of notes) { v -= n[2]; if (v <= 0) return [n[0], n[1]]; } return notes[0];
}
const hauteurVoulue = (sp, d, ph) => (sp.colonne === 'surface' ? -0.35 - Math.max(0, Math.sin(ph)) * 0.25 : sp.colonne === 'fond' ? -d + 0.35 : -d * (0.45 + Math.sin(ph) * 0.12));

export function creerPoissons(seed = 7) {
  const r = graine(seed), L = []; let id = 0;
  for (const sp of ESPECES) {
    let chef = null, reste = 0;
    for (let n = 0; n < sp.nombre; n++) {
      if (reste <= 0) { chef = null; reste = sp.banc; } reste--;
      const [hx, hz] = chef ? [chef.home[0] + (r() - 0.5) * 3, chef.home[1] + (r() - 0.5) * 3] : placer(sp, r), d = Math.max(0.4, profondeur(hx, hz)), k = r() ** 1.6;
      const f = { id: id++, sp, chef, home: [hx, hz], x: hx, y: hauteurVoulue(sp, d, 0), z: hz, cap: r() * TAU, vit: 0, etat: 'cale', cible: null, attente: r() * 4, interet: 0, suivi: 0, mefiant: 0, phase: r() * TAU, nage: 0, longueur: Math.round(sp.longueur[0] + (sp.longueur[1] - sp.longueur[0]) * k), retour: 0, decal: [(r() - 0.5) * 2.4, (r() - 0.5) * 2.4] };
      f.poids = poidsDe(sp, f.longueur); L.push(f); if (!chef) chef = f;
    }
  }
  // les légendes : chacune dans l'eau la plus proche de son coin, assez profonde pour elle
  for (const g of LEGENDES) {
    const sp = espece(g.espece), s = ETANG.secteurs.find(x => x.id === g.secteur), [hx, hz] = CASES_EAU.filter(([x, z]) => profondeur(x, z) > sp.habitat.profMin + 0.15).sort((a, b) => Math.hypot(a[0] - s.x, a[1] - s.z) - Math.hypot(b[0] - s.x, b[1] - s.z))[0];
    const f = { id: id++, sp, legende: g, chef: null, home: [hx, hz], x: hx, y: hauteurVoulue(sp, profondeur(hx, hz), 0), z: hz, cap: 0, vit: 0, etat: 'cale', cible: null, attente: 0, interet: 0, suivi: 0, mefiant: 0, phase: 0, nage: 0, longueur: g.longueur, retour: 0, decal: [0, 0] };
    f.poids = poidsDe(sp, f.longueur); L.push(f);
  }
  return L;
}
export const poidsDe = (sp, cm) => Math.round(sp.poids[0] * cm ** sp.poids[1]) / 1000;

function fuir(f, depuisX, depuisZ, ev) { f.etat = 'fuit'; f.attente = 3 + Math.random() * 3; f.interet = 0; f.cible = [f.x + (f.x - depuisX) * 3, f.z + (f.z - depuisZ) * 3]; ev?.push({ type: 'fuite', f }); }
// ce que le poisson perçoit du leurre, de 0 (rien) à 1 (il ne voit que lui)
export function perception(f, L, m) {
  const sp = f.sp, d = Math.hypot(f.x - L.x, f.y - L.y, f.z - L.z), portee = sp.vue * (L.famille === 'tournant' ? 1.15 : 1) * (1 - m.pluie * 0.25) * (1 - m.brume * 0.15) * (m.force < 0.6 ? (sp.id === 'sandre' ? 1.2 : 0.7) : 1);
  return d >= portee ? 0 : 1 - d / portee;
}
// l'envie de mordre ce leurre-là, animé comme ça
function appetit(f, L, m) {
  if (f.legende && (!eveillee(f.legende, m.heure, m.meteo) || !f.legende.leurres.includes(L.id))) return 0;
  const sp = f.sp, [a, b] = sp.tailleLeurre, fit = L.taille < a ? 0.55 : L.taille > b ? 0.35 : 1, fond = sp.colonne === 'fond' ? (L.y < -profondeur(L.x, L.z) + 1 ? 1 : 0.2) : sp.colonne === 'surface' ? (L.y > -1.4 ? 1 : 0.35) : 1;
  return sp.leurres[L.famille] * fit * fond * L.anim * activite(sp, m.heure, m.meteo) * (f.faim > 0 ? 1.4 : 1) * (f.legende ? 1.3 : 1); // faim : un banc ou des insectes viennent de passer
}

// un pas de vie pour tous. m : { heure, meteo, pluie, brume, force, joueur: {x, z, vitesse}, leurre: {x, y, z, famille, taille, anim, plouf} | null }
export function majPoissons(L, dt, m) {
  const ev = [], t = m.t ?? 0;
  for (const f of L) {
    const sp = f.sp;
    if (f.etat === 'retire') { f.retour -= dt; if (f.retour <= 0) renaitre(f); continue; }
    if (f.etat === 'ferre') continue; // la ligne décide
    f.mefiant = Math.max(0, f.mefiant - dt);
    // des pas lourds sur la berge font fuir ce qui nage tout près du bord
    const dj = Math.hypot(f.x - m.joueur.x, f.z - m.joueur.z);
    if (f.etat !== 'fuit' && m.joueur.vitesse > 3.2 && dj < sp.peur) { fuir(f, m.joueur.x, m.joueur.z, ev); f.mefiant = 20 * sp.mefiance; }
    const Lu = m.leurre;
    if (Lu && sp.appat && f.etat !== 'fuit') {
      // un leurre qui tombe sur la tête d'un poisson méfiant le fait détaler
      if (Lu.plouf && Math.hypot(f.x - Lu.x, f.z - Lu.z) < 1 + sp.mefiance * 3 && Math.random() < sp.mefiance) { fuir(f, Lu.x, Lu.z, ev); f.mefiant = 30; continue; }
      const p = f.mefiant > 0 ? 0 : perception(f, Lu, m), envie = p > 0 ? appetit(f, Lu, m) : 0;
      if (p > 0 && envie > 0.12) { f.interet += dt * envie * (0.55 + p) * (1.15 - sp.mefiance * 0.5); if (f.etat === 'cale' && f.interet > 0.28) { f.etat = 'suit'; f.suivi = 0; ev.push({ type: 'suit', f }); } }
      else f.interet = Math.max(0, f.interet - dt * 0.25);
    } else f.interet = Math.max(0, f.interet - dt * 0.25);
    if (!Lu && (f.etat === 'suit' || f.etat === 'attaque')) { f.etat = 'cale'; f.interet = 0; }

    let tx, ty, tz, v = sp.vitesse, vire = 2.2;
    if (f.etat === 'suit') {
      f.suivi += dt; const d = Math.hypot(f.x - Lu.x, f.z - Lu.z), dx = (Lu.x - f.x) / (d || 1), dz = (Lu.z - f.z) / (d || 1);
      tx = Lu.x - dx * 1.1; ty = Lu.y; tz = Lu.z - dz * 1.1; v = Math.min(2.6, Math.max(sp.vitesse, (Lu.vit ?? 0.8) * 1.15 + (d > 2 ? 1 : 0))); vire = 4;
      // il hésite : une animation molle ou un leurre qui arrive au bord le décourage
      if (Lu.anim < 0.22 && f.suivi > 1.2 || Math.hypot(Lu.x - m.joueur.x, Lu.z - m.joueur.z) < 3) { f.etat = 'cale'; f.interet = 0; f.mefiant = 12 + sp.mefiance * 30; ev.push({ type: 'refus', f }); }
      else if (f.interet > 1 + sp.mefiance * 0.4 && f.suivi > (sp.style === 'affut' ? 2 : 0.7)) f.etat = 'attaque';
    } else if (f.etat === 'attaque') {
      tx = Lu.x; ty = Lu.y; tz = Lu.z; v = sp.style === 'affut' ? 7 : 4.5; vire = 9;
      if (Math.hypot(f.x - Lu.x, f.y - Lu.y, f.z - Lu.z) < 0.5) { ev.push({ type: 'touche', f }); f.etat = 'ferre'; continue; }
    } else if (f.etat === 'fuit') {
      f.attente -= dt; [tx, tz] = f.cible ?? f.home; ty = -Math.max(0.5, profondeur(f.x, f.z) - 0.3); v = sp.vitesse * 4 + 1; vire = 5; if (f.attente <= 0) f.etat = 'cale';
    } else if (f.chef && f.chef.etat !== 'retire' && f.chef.etat !== 'ferre') {
      tx = f.chef.x + f.decal[0]; ty = f.chef.y; tz = f.chef.z + f.decal[1]; v = Math.max(sp.vitesse, f.chef.vit * 1.1) + Math.hypot(tx - f.x, tz - f.z) * 0.25;
    } else {
      // chez lui : le brochet reste à l'affût, les autres font leur ronde, plus loin quand ils ont envie de chasser
      f.attente -= dt; const a = activite(sp, m.heure, m.meteo);
      if (!f.cible || f.attente <= 0) { const R = (sp.style === 'affut' ? 2.5 : sp.style === 'banc' ? 16 : 10) * (0.5 + a * 0.6), b = Math.random() * TAU; let cx = f.home[0] + Math.cos(b) * R, cz = f.home[1] + Math.sin(b) * R; if (profondeur(cx, cz) < 0.5) { cx = f.home[0]; cz = f.home[1]; } f.cible = [cx, cz]; f.attente = (sp.style === 'affut' ? 9 : 4) + Math.random() * 7; }
      [tx, tz] = f.cible; ty = hauteurVoulue(sp, profondeur(f.x, f.z), t * 0.2 + f.phase); v = sp.style === 'affut' ? (Math.hypot(tx - f.x, tz - f.z) > 0.6 ? 0.28 : 0) : sp.vitesse * (0.55 + a * 0.5);
    }
    // nager : tourner vers la cible, sans jamais quitter l'eau
    const voulu = Math.atan2(tx - f.x, tz - f.z), dc = angle(voulu - f.cap); f.cap = angle(f.cap + Math.max(-vire * dt, Math.min(vire * dt, dc)));
    f.vit += (v - f.vit) * Math.min(1, dt * 2.5);
    const nx = f.x + Math.sin(f.cap) * f.vit * dt, nz = f.z + Math.cos(f.cap) * f.vit * dt, pr = profondeur(nx, nz);
    if (pr > 0.4) { f.x = nx; f.z = nz; } else { f.cap = angle(Math.atan2(f.home[0] - f.x, f.home[1] - f.z)); f.cible = null; }
    const fond = -Math.max(0.3, profondeur(f.x, f.z)) + 0.2; f.y += (Math.min(-0.15, Math.max(fond, ty)) - f.y) * Math.min(1, dt * 1.4);
    f.nage += dt * (2.5 + f.vit * 5);
  }
  return ev;
}
function renaitre(f) { const d = Math.max(0.4, profondeur(...f.home)); Object.assign(f, { x: f.home[0], z: f.home[1], y: hauteurVoulue(f.sp, d, 0), etat: 'cale', interet: 0, mefiant: 10, vit: 0, cible: null }); }
// la prise a quitté l'eau (conservée) ou vient d'y retourner : elle reprendra sa place bien plus tard
export function retirer(f, secondes = 240) { f.etat = 'retire'; f.retour = secondes; }
export function relacher(f, x, z) { Object.assign(f, { etat: 'fuit', x, z, y: -0.4, attente: 6, mefiant: 120, interet: 0, cible: f.home.slice() }); }
export { espece, abri };
