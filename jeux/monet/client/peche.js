// LES EAUX DE MONET — la pêche aux leurres, du lancer à la prise. Un état à la fois :
// repos → charge → vol → eau (animer le leurre) → touche (ferrer) → combat (tension) → epuisette → prise.
// Rien ici ne dessine : le jeu lit l'état, et les tests jouent une partie entière sans écran.
import { CANNES, LEURRES, PECHE, espece } from './reglages.js';
import { profondeur, dansLEau, hauteur, abri, secteurEn } from './etang.js';

const borne = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function creerPeche(hasard = Math.random) {
  const P = {
    etat: 'repos', canne: CANNES[0], leurreChoisi: LEURRES[0], puissance: 0, vitesse: 1, tension: 0, evenements: [], message: '',
    l: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, vit: 0, anim: 0, plouf: false, tirees: [], pause: 0, regul: 0, age: 0, accroche: false, zig: 0 },
    poisson: null, combat: null, resultat: null, attente: 0,
  };
  const dire = (type, extra = {}) => P.evenements.push({ type, ...extra });
  P.choisir = (canne, leurre) => { if (P.etat !== 'repos') return false; if (canne) P.canne = canne; if (leurre) P.leurreChoisi = leurre; return true; };
  // le leurre tel que les poissons le voient (null s'il n'est pas à l'eau)
  P.vueLeurre = () => (P.etat === 'eau' && !P.l.accroche ? { x: P.l.x, y: P.l.y, z: P.l.z, famille: P.leurreChoisi.famille, taille: P.leurreChoisi.taille, anim: P.l.anim, vit: P.l.vit, plouf: P.l.plouf } : null);
  function rentrer() { P.etat = 'repos'; P.poisson = null; P.combat = null; P.tension = 0; P.puissance = 0; P.l.accroche = false; }
  P.rentrer = rentrer;

  // l'animation réussie ? chaque famille a sa manière d'être bien pêchée (0 à 1)
  function noteAnimation(dt, e) {
    const L = P.l, F = P.leurreChoisi, cible = F.ideale; let n = 0;
    L.tirees = L.tirees.filter(t => L.age - t < 6);
    if (F.famille === 'tournant') {
      L.regul = e.moulinet ? Math.min(1, L.regul + dt * 0.9) : Math.max(0, L.regul - dt * 1.6);
      n = L.regul * borne(1 - Math.abs(L.vit - cible) / (cible * 1.2));
    } else if (F.famille === 'nageur') {
      const c = L.tirees.length, rythme = c >= 2 && c <= 7 ? 1 : c === 1 ? 0.55 : 0.08, pause = L.pause > 0.25 && L.pause < 3.4 ? 1 : 0.7;
      n = rythme * pause * (L.pause > 4 ? 0.3 : 1);
    } else {
      const haut = L.y - hauteur(L.x, L.z), surFond = haut < 0.75 ? 1 : haut < 1.5 ? 0.5 : 0.1, lent = L.vit < 1 ? 1 : 0.4, vie = L.tirees.length >= 1 ? 1 : L.pause < 5 ? 0.45 : 0.15;
      n = surFond * lent * vie;
    }
    L.anim += (n - L.anim) * Math.min(1, dt * 2.4);
  }
  function majLeurre(dt, e) {
    const L = P.l, F = P.leurreChoisi, dx = e.pos.x - L.x, dz = e.pos.z - L.z, d = Math.hypot(dx, dz) || 1;
    L.age += dt; L.plouf = false; if (L.accroche) { P.tension = 0.3; if (e.tiree) { if (hasard() < 0.45) { L.accroche = false; P.message = 'Le leurre se libère.'; dire('libere'); } else dire('tire'); } if (e.moulinet && (L.force = (L.force ?? 0) + dt) > 2.2) { L.force = 0; dire('casse'); P.message = 'Le fil a cédé : tu noues un autre leurre.'; rentrer(); } return; }
    const v = e.moulinet ? PECHE.vitessesMoulinet[P.vitesse] : 0;
    L.vit += (v - L.vit) * Math.min(1, dt * 5);
    L.pause = e.moulinet ? 0 : L.pause + dt;
    if (e.tiree && L.age - (L.derniere ?? -9) > PECHE.tiree.recharge) {
      L.derniere = L.age; L.tirees.push(L.age); L.pause = 0; L.zig = -Math.sign(L.zig || 1); const T = PECHE.tiree, k = F.famille === 'souple' ? 0.5 : 1;
      L.x += (dx / d) * T.dard * k + (-dz / d) * L.zig * 0.35 * k; L.z += (dz / d) * T.dard * k + (dx / d) * L.zig * 0.35 * k; L.y += F.famille === 'souple' ? T.leve : -0.12; dire('tiree');
    }
    L.x += (dx / d) * L.vit * dt; L.z += (dz / d) * L.vit * dt;
    // la profondeur : chaque leurre a sa nage
    const fond = hauteur(L.x, L.z) + 0.06;
    if (L.vit > 0.2 && F.famille !== 'souple') L.y += (Math.max(fond, -F.prof) - L.y) * Math.min(1, dt * 2.2);
    else L.y += (F.famille === 'souple' && L.vit > 0.2 ? F.coule * 0.5 : F.coule) * -dt;
    L.y = Math.min(-0.05, Math.max(fond, L.y));
    noteAnimation(dt, e);
    // les zones encombrées : les nénuphars et les souches accrochent, surtout ce qui traîne au fond
    const a = abri(L.x, L.z), risque = (a.nenuphar * PECHE.accroche.nenuphar * (L.y > -0.8 ? 1 : 0.3) + a.structure * PECHE.accroche.structure * (L.y - fond < 0.4 ? 1 : 0.1)) * (F.famille === 'souple' ? 0.55 : 1);
    if (hasard() < risque * dt) { L.accroche = true; L.force = 0; P.message = 'Accroché ! Donne des tirées pour le libérer.'; dire('accroche'); }
    // le leurre revient au bord : on le sort de l'eau
    if (d < 2.4 || !dansLEau(L.x, L.z)) { dire('sortie'); rentrer(); }
  }

  function majCombat(dt, e) {
    const C = P.combat, f = P.poisson, sp = f.sp, gros = f.longueur / sp.longueur[1];
    C.burst -= dt;
    if (C.burst <= 0) { C.court = hasard() < 0.35 + C.forces * 0.45; C.burst = C.court ? 1 + hasard() * 1.8 : 1.4 + hasard() * 2; C.cote = hasard() < 0.5 ? -1 : 1; if (C.court && hasard() < 0.25 && sp.colonne !== 'fond') dire('saut', { f }); }
    const F = sp.force * (0.45 + gros * 0.75) * (C.court ? 1 : 0.32) * (0.4 + C.forces * 0.6), reel = e.moulinet ? P.canne.puissance * 0.42 : 0;
    // tenir la canne du côté opposé à sa course : la canne encaisse à la place de la ligne
    const bon = e.lateral && Math.sign(e.lateral) === -C.cote ? 0.62 : e.lateral ? 1.18 : 1, herbes = abri(C.x, C.z); let cible = ((F + reel) * bon) / P.canne.resistance + (herbes.nenuphar + herbes.structure > 0.8 && C.court ? 0.16 : 0);
    if (!e.moulinet && !C.court) cible *= 0.45;
    P.tension += (cible - P.tension) * Math.min(1, dt * 4.5);
    // le frein laisse filer le fil quand le poisson tire fort
    const glisse = Math.max(0, P.tension - P.canne.frein), court = C.court ? (1.2 + F * 2.4) : 0;
    C.dist += (court * (0.35 + glisse * 4) - (e.moulinet && P.tension < 0.93 ? 1.5 + P.canne.puissance : 0) - (!C.court && !e.moulinet ? 0.05 : 0)) * dt;
    C.dist = borne(C.dist, 0, P.canne.portee + 18);
    C.forces = Math.max(0, C.forces - dt * (0.035 + P.tension * 0.1 + (C.court ? 0.03 : 0)) / (0.55 + gros * 0.7));
    // sa place dans l'eau : il tire de côté pendant que tu le ramènes
    C.ang += C.cote * (C.court ? 0.34 : 0.1) * dt; const nx = e.pos.x + Math.sin(C.ang) * C.dist, nz = e.pos.z + Math.cos(C.ang) * C.dist;
    if (profondeur(nx, nz) > 0.3) { C.x = nx; C.z = nz; } else C.ang -= C.cote * 0.9 * dt;
    f.x = C.x; f.z = C.z; f.y = -Math.min(1.2, Math.max(0.2, profondeur(C.x, C.z) * 0.5)); f.cap = C.ang + (C.court ? C.cote * 0.9 : Math.PI); f.vit = C.court ? 2.4 : 1; f.nage += dt * (C.court ? 22 : 9);
    P.l.x = f.x; P.l.y = f.y; P.l.z = f.z;
    C.haut = P.tension >= 1 ? C.haut + dt : 0; C.mou = P.tension < 0.05 ? C.mou + dt : 0;
    if (C.haut > PECHE.casse) { P.message = 'La ligne a cassé !'; dire('casse'); lacher(); return; }
    if (C.mou > PECHE.decroche) { P.message = 'La ligne était trop molle : il s’est décroché.'; dire('decroche'); lacher(); return; }
    if (C.dist < PECHE.sortie) { P.etat = 'epuisette'; P.attente = 0; P.message = ''; dire('epuisette'); }
  }
  function lacher() { const f = P.poisson; if (f) { f.etat = 'fuit'; f.attente = 5; f.mefiant = 90; f.cible = f.home.slice(); } rentrer(); }

  // un poisson a mordu (les poissons décident, voir poissons.js)
  P.touche = f => { if (P.etat !== 'eau') { f.etat = 'cale'; return false; } P.poisson = f; P.etat = 'touche'; P.attente = PECHE.fenetreFerrage; dire('touche', { f }); return true; };

  P.maj = (dt, e) => {
    const L = P.l;
    switch (P.etat) {
      case 'repos':
        if (e.charge) { P.etat = 'charge'; P.puissance = 0; }
        break;
      case 'charge':
        P.puissance = Math.min(1, P.puissance + dt / PECHE.chargeLancer);
        if (!e.charge) {
          if (P.puissance < 0.12) { P.etat = 'repos'; break; }
          const portee = P.canne.portee * (0.25 + P.puissance * 0.75), T = 0.55 + P.puissance * 0.55, cx = e.pos.x + e.dir.x * portee + (e.vent?.x ?? 0) * P.puissance * 2, cz = e.pos.z + e.dir.z * portee + (e.vent?.z ?? 0) * P.puissance * 2;
          Object.assign(L, { x: e.pos.x, y: e.pos.y, z: e.pos.z, vx: (cx - e.pos.x) / T, vz: (cz - e.pos.z) / T, vy: (-e.pos.y + 0.5 * PECHE.gravite * T * T) / T, vit: 0, anim: 0, tirees: [], pause: 0, regul: 0, age: 0, accroche: false, plouf: false });
          P.etat = 'vol'; dire('lancer');
        }
        break;
      case 'vol':
        L.vy -= PECHE.gravite * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt;
        if (L.y <= 0) {
          L.y = -0.05;
          if (dansLEau(L.x, L.z)) { P.etat = 'eau'; L.plouf = true; dire('plouf', { x: L.x, z: L.z }); }
          else { P.message = 'Le leurre est tombé sur la berge.'; dire('berge'); rentrer(); }
        }
        break;
      case 'eau':
        majLeurre(dt, e);
        break;
      case 'touche':
        P.attente -= dt; L.y -= dt * 0.6;
        if (e.ferrer) {
          const f = P.poisson, a = Math.atan2(L.x - e.pos.x, L.z - e.pos.z);
          P.combat = { dist: Math.hypot(L.x - e.pos.x, L.z - e.pos.z), ang: a, x: L.x, z: L.z, forces: 1, burst: 0, court: true, cote: 1, haut: 0, mou: 0 }; P.tension = 0.45; P.etat = 'combat'; dire('ferre', { f });
        } else if (P.attente <= 0) { const f = P.poisson; f.etat = 'fuit'; f.attente = 4; f.mefiant = 45; f.cible = f.home.slice(); P.poisson = null; P.etat = 'eau'; P.message = 'Trop tard : il a recraché le leurre.'; dire('rate'); }
        break;
      case 'combat':
        majCombat(dt, e);
        break;
      case 'epuisette':
        P.tension *= 1 - dt * 3;
        if (e.prendre) {
          const f = P.poisson, s = secteurEn(e.pos.x, e.pos.z);
          P.resultat = { espece: f.sp.id, longueur: f.longueur, poids: f.poids, secteur: s?.id ?? null, leurre: P.leurreChoisi.id, canne: P.canne.id, heure: e.heure ?? 12, meteo: e.meteo ?? 'soleil' };
          P.etat = 'prise'; dire('prise', { f });
        }
        break;
      case 'prise': break;
    }
  };
  // la décision est prise (conserver ou relâcher) : la canne revient au repos
  P.terminer = () => { P.resultat = null; rentrer(); };
  return P;
}
export { espece };
