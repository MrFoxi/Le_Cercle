// LES EAUX DE MONET — la boucle du jeu : marcher, regarder, pêcher, observer. Chaque module fait son métier ; ici on les relie.
import * as THREE from 'three';
import { QUALITE, ETANG, ESPECES, LEURRES, FAMILLES, PECHE, LEGENDES, espece } from './reglages.js';
import { hauteur, sol, surPont, secteurEn, dansLEau, profondeur, abri, OBSTACLES, NENUPHARS } from './etang.js';
import { UNI, Toile, FACE, matiereTouches, pioche } from './peinture.js';
import { construireDecor } from './decor.js';
import { creerEau, creerCiel } from './eau.js';
import { creerVuePoisson } from './vue-poissons.js';
import { creerPoissons, majPoissons, retirer, relacher, activite, eveillee } from './poissons.js';
import { creerPeche } from './peche.js';
import { creerMains } from './mains.js';
import { creerTemps, momentDe } from './temps.js';
import { creerCarnet } from './carnet.js';
import { creerInterface } from './interface.js';
import { sons, audio } from './sons.js';
import { creerJardinier, endroit } from './personnage.js';
import { parler, POSTES, NOM } from './jardinier.js';
import { creerChevalet } from './chevalet.js';

const $ = s => document.querySelector(s), params = new URLSearchParams(location.search);
const Q = QUALITE[params.get('q')] ?? (matchMedia('(pointer: coarse)').matches ? QUALITE.basse : QUALITE.moyenne); UNI.uLod.value = Q.lod;
const vue = $('#vue'), renderer = new THREE.WebGLRenderer({ canvas: vue, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1, 0.06, 620); camera.layers.enable(2); camera.rotation.order = 'YXZ'; scene.add(camera);
creerCiel(scene); const decor = construireDecor(scene, Q), eau = creerEau(scene, Q), mains = creerMains(camera, scene);

/* ---------- Les états du monde ---------- */
const temps = creerTemps(Math.random, { heure: +params.get('h') || undefined, meteo: params.get('meteo') || undefined });
let stock = null; try { stock = localStorage; } catch { /* navigation privée : le carnet vit le temps de la session */ }
const carnet = creerCarnet(stock), peche = creerPeche(), poissons = creerPoissons(1872);
const corps = poissons.map(f => { const m = creerVuePoisson(f.sp.id); m.scale.setScalar(f.longueur / 100); m.visible = false; scene.add(m); return m; });
const J = { x: ETANG.depart.x, y: 0, z: ETANG.depart.z, lacet: ETANG.depart.regard, tangage: 0.06, vit: 0, pas: 0, secteur: null };
J.y = sol(J.x, J.z) + 1.62; camera.position.set(J.x, J.y, J.z);
const anselme = creerJardinier(scene), chev = creerChevalet($('#chevalet')); let poste = null, repliques = [], parole = false, dAnselme = 99, tableauDemande = false, legT = 30;
const touches = new Set(); let gauche = false, droit = false, clicG = false, clicE = false, tirer = false, viseur = false, enPartie = false, tenu = null, photoDemandee = false, noteT = 0, lieuT = 0, aideFix = '';

const note = (txt, s = 4.5) => { const n = $('#note'); n.textContent = txt; n.classList.add('on'); noteT = s; };
const lieuTitre = txt => { const n = $('#lieu'); n.textContent = txt; n.classList.add('on'); lieuT = 4.5; };
const ui = creerInterface({ carnet, peche, temps: () => temps, secteursVus: () => carnet.donnees.secteurs, voyager, reprendre: () => { if (enPartie) vue.requestPointerLock?.(); } });
function voyager(id) { const s = ETANG.secteurs.find(x => x.id === id); if (!s) return; const v = $('#voile'); v.classList.add('on'); setTimeout(() => { J.x = s.x; J.z = s.z; J.y = sol(J.x, J.z) + 1.62; v.classList.remove('on'); lieuTitre(s.nom); }, 800); }
function decouvrir() { for (const l of carnet.verifierLieux()) { note(`Un nouveau lieu s’éclaire sur ta carte : ${l.nom}`, 7); } }

/* ---------- Les commandes ---------- */
addEventListener('keydown', e => {
  sons.ouvrir(); if (e.repeat) return; touches.add(e.code);
  if (chev.actif) { if (e.code === 'KeyE' && chev.fini) signer(); if (e.code === 'Escape') { chev.fermer(); note('Tu grattes la toile : on recommencera.', 3); } return; }
  if (e.code === 'KeyV' && enPartie && !ui.ouvert && !viseur && peche.etat === 'repos') { tableauDemande = true; taire(); }
  if (e.code === 'KeyE') clicE = true; if (e.code === 'Space') { tirer = true; e.preventDefault(); }
  if (e.code === 'KeyC') ui.basculer('carnet'); if (e.code === 'KeyB') ui.basculer('boite'); if (e.code === 'KeyK') ui.basculer('carte');
  if (e.code === 'Escape' && ui.ouvert) ui.fermer();
  if (e.code === 'KeyM') note(sons.musique() ? 'La musique revient, tout doucement.' : 'Plus que les bruits de l’eau.', 2.5);
  if (e.code === 'KeyP' && !ui.ouvert && peche.etat !== 'prise') { viseur = !viseur; $('#viseur').hidden = !viseur; }
  if (e.code === 'KeyF' && ['eau', 'vol'].includes(peche.etat)) peche.rentrer();
  if (peche.etat === 'prise') { if (e.code === 'KeyR') decider('relacher'); if (e.code === 'KeyG') decider('conserver'); }
});
addEventListener('keyup', e => touches.delete(e.code)); addEventListener('blur', () => { touches.clear(); gauche = droit = false; });
vue.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => { sons.ouvrir(); if (ui.ouvert || !enPartie || e.target !== vue) return; if (document.pointerLockElement !== vue) { vue.requestPointerLock?.(); return; } if (e.button === 0) { gauche = true; clicG = true; } if (e.button === 2) droit = true; });
addEventListener('mouseup', e => { if (e.button === 0) gauche = false; if (e.button === 2) droit = false; });
addEventListener('mousemove', e => { if (document.pointerLockElement !== vue || chev.actif) return; J.lacet -= e.movementX * 0.0021; J.tangage = Math.max(-1.25, Math.min(1.2, J.tangage - e.movementY * 0.0019)); });
addEventListener('wheel', e => { if (['eau', 'combat'].includes(peche.etat)) { peche.vitesse = Math.max(0, Math.min(2, peche.vitesse + (e.deltaY < 0 ? 1 : -1))); } }, { passive: true });
$('#titre').addEventListener('click', () => { if (!pret) return; $('#titre').classList.add('parti'); enPartie = true; sons.ouvrir(); vue.requestPointerLock?.(); lieuTitre('L’Étang des Nymphéas'); if (!carnet.donnees.jardinier.vu) setTimeout(() => note('Un vieil homme ratisse la berge, tout près du campement. Va le saluer.', 7), 6500); });
let pret = false;

/* ---------- Le promeneur ---------- */
function marcher(dt) {
  const av = (touches.has('KeyW') || touches.has('KeyZ') || touches.has('ArrowUp') ? 1 : 0) - (touches.has('KeyS') || touches.has('ArrowDown') ? 1 : 0), co = (touches.has('KeyD') || touches.has('ArrowRight') ? 1 : 0) - (touches.has('KeyA') || touches.has('KeyQ') || touches.has('ArrowLeft') ? 1 : 0);
  const presse = touches.has('ShiftLeft') || touches.has('ShiftRight'), libre = ['repos', 'charge'].includes(peche.etat) && !ui.ouvert, n = Math.hypot(av, co) || 1, V = libre && (av || co) ? (presse ? 4.6 : 2.5) : 0;
  J.vit += (V - J.vit) * Math.min(1, dt * 9); if (J.vit < 0.03) return;
  const s = Math.sin(J.lacet), c = Math.cos(J.lacet), dx = ((-s * av + c * co) / n) * J.vit * dt, dz = ((-c * av - s * co) / n) * J.vit * dt;
  const essai = (x, z) => { for (const [ox, oz, r] of OBSTACLES) if (Math.hypot(x - ox, z - oz) < r + 0.4) return false; return Math.hypot(x, z) < ETANG.limite && (hauteur(x, z) > -ETANG.gue || (surPont(x, z) && J.y - 1.62 > 0.1)); };
  if (essai(J.x + dx, J.z + dz)) { J.x += dx; J.z += dz; } else if (essai(J.x + dx, J.z)) J.x += dx; else if (essai(J.x, J.z + dz)) J.z += dz;
  J.pas += J.vit * dt; if (J.pas > (presse ? 1.5 : 1.15)) { J.pas = 0; sons.pas(surPont(J.x, J.z) ? 'pont' : hauteur(J.x, J.z) < 0.02 ? 'eau' : 'herbe'); }
}

/* ---------- Conserver ou relâcher ---------- */
function decider(choix) {
  const r = peche.resultat, f = peche.poisson; if (!r || !f) return;
  const dx = -Math.sin(J.lacet), dz = -Math.cos(J.lacet);
  if (choix === 'conserver') { carnet.conserver(r); retirer(f); note('Consigné dans ta collection.', 3); }
  else { carnet.relacher(r.espece); let x = J.x + dx * 3, z = J.z + dz * 3; if (!dansLEau(x, z)) { x = peche.l.x; z = peche.l.z; } relacher(f, x, z); eau.rond(x, z, 1.2); sons.plouf(1.1); note('Il repart, d’un coup de queue.', 3); }
  if (tenu) { camera.remove(tenu); tenu = null; } $('#prise').hidden = true; peche.terminer(); if (document.pointerLockElement !== vue && enPartie) vue.requestPointerLock?.();
}
$('#prise').addEventListener('click', e => { const c = e.target.closest('[data-choix]')?.dataset.choix; if (c) decider(c); });
function montrerPrise() {
  const r = peche.resultat, sp = espece(r.espece), b = carnet.prise(r); if (sp.id === 'sandre' && temps.lumiere.force < 0.75) carnet.geste('penombre');
  document.exitPointerLock?.(); gauche = droit = false; sons.prise();
  tenu = creerVuePoisson(sp.id); tenu.material.uniforms.uAir.value = 1; tenu.scale.setScalar(Math.min(0.58, 0.3 + r.longueur / 240)); tenu.position.set(0, -0.09, -0.62); tenu.rotation.y = Math.PI / 2; tenu.material.uniforms.uAmp.value = 0.035; camera.add(tenu);
  const g = r.legende && LEGENDES.find(x => x.id === r.legende); $('#prise').hidden = false; $('#prise').innerHTML = `<h2>${g ? g.nom : sp.nom}</h2><p>${g ? sp.nom + ', ' : ''}${r.longueur} cm, ${r.poids.toFixed(2).replace('.', ',')} kg${b.legende ? ' · une légende de l’étang ! Elle rejoint ton carnet' : b.nouvelle ? ' · une nouvelle page dans ton carnet' : b.record ? ' · ton plus beau à ce jour' : ''}</p><div class="choix"><button data-choix="relacher">Le relâcher (R)</button><button data-choix="conserver">Le conserver (G)</button></div>`;
  decouvrir(); if (g) { sons.saut(); note(`${g.nom} ! Le père Anselme n’en croira pas ses yeux.`, 6); }
}

/* ---------- Le père Anselme : il change de coin selon l'heure, et parle quand on s'approche ---------- */
function taire() { repliques = []; parole = false; $('#parole').hidden = true; }
function dire(txt) { parole = true; $('#parole').hidden = false; $('#parole').innerHTML = `<b>${NOM}</b><p></p><small>${repliques.length ? 'E : la suite' : 'E : au revoir'}</small>`; $('#parole p').textContent = txt; }
function jardiner(dt) {
  const id = carnet.donnees.jardinier.vu ? POSTES[momentDe(temps.heure).id] : 'camp';
  if (id !== poste && (poste === null || dAnselme > 30)) { const [x, z] = endroit(id); anselme.poser(x, z); poste = id; }
  dAnselme = anselme.maj(dt, J, parole);
  if (clicE && dAnselme < 3 && peche.etat === 'repos' && !ui.ouvert && !viseur) { clicE = false; if (parole && !repliques.length) taire(); else { if (!parole) repliques = parler(carnet); dire(repliques.shift()); sons.page(); } }
  if (parole && dAnselme > 5) taire();
}
function signer() { const img = chev.signer(); carnet.tableau({ img, titre: chev.titre, date: Date.now() }); sons.page(); note('Signé ! Le tableau rejoint la galerie de ton carnet.', 4); }
// une légende éveillée, pas trop loin : un remous énorme trahit sa présence
const DU = { 'Le ': 'du ', 'La ': 'de la ', 'Les ': 'des ' };
function legendes(dt) {
  if ((legT -= dt) > 0) return; legT = 50 + Math.random() * 50;
  const f = poissons.find(p => p.legende && p.etat === 'cale' && eveillee(p.legende, temps.heure, temps.suivante ?? temps.meteo) && Math.hypot(p.x - J.x, p.z - J.z) < 60); if (!f) return;
  const n = ETANG.secteurs.find(s => s.id === f.legende.secteur).nom, art = Object.keys(DU).find(a => n.startsWith(a));
  eau.rond(f.x, f.z, 2.4); sons.saut(); note(`Un remous énorme, du côté ${DU[art]}${n.slice(art.length)}…`, 5);
}

/* ---------- Ce qui se passe sur l'étang : des événements vrais, qui disent où sont les poissons ---------- */
const nuee = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ color: 0x35302c, side: THREE.DoubleSide }), 40); nuee.frustumCulled = false; nuee.layers.set(2); nuee.count = 0; scene.add(nuee);
const insectes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff0c0, side: THREE.DoubleSide }), 46); insectes.frustumCulled = false; insectes.layers.set(2); insectes.count = 0; scene.add(insectes);
const grenouilles = (() => { const T = new Toile(), r = Math.random, L = NENUPHARS.filter((_, i) => i % 53 === 0).slice(0, 7), G = []; const mat = matiereTouches(); for (const l of L) { const g = new THREE.Group(), t = new Toile(); for (let i = 0; i < 18; i++) { const a = r() * 6.28, R = r() * 0.1; t.touche(Math.cos(a) * R, 0.06 + r() * 0.07, Math.sin(a) * R * 1.3, 0.1, 0.06, a, FACE, pioche(['#5f8f4a', '#7fa850', '#4f7f48'], r), [0, 1, 0]); } t.poser(g, mat, 2); g.position.set(l.x, 0.06, l.z); scene.add(g); G.push({ g, l, saut: 0, parti: 0 }); } return G; })();
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(1, 1, 1);
let evT = 25, oiseaux = null, nuageI = null, brumeJour = 0;
const sauts = new Map();
function sauter(f) { sauts.set(f, 0); eau.rond(f.x, f.z, 1.3); sons.saut(); }
function evenement() {
  const proches = poissons.filter(f => f.etat === 'cale' && Math.hypot(f.x - J.x, f.z - J.z) < 55), g = Math.random(), carn = proches.filter(f => f.sp.appat);
  if (g < 0.3 && carn.length) { const f = carn[Math.floor(Math.random() * carn.length)]; sauter(f); f.faim = 90; note('Un poisson a sauté, là-bas. Il chasse.'); return; }
  if (g < 0.5) { const G = poissons.filter(f => f.sp.id === 'gardon' && !f.chef && f.etat === 'cale'), f = G[Math.floor(Math.random() * G.length)]; if (f) { const a = Math.random() * 6.28, cx = Math.cos(a) * 26, cz = Math.sin(a) * 26; f.home = [cx, cz]; f.cible = [cx, cz]; for (const p of poissons) if (p.sp.appat && Math.hypot(p.x - f.x, p.z - f.z) < 22) p.faim = 80; note('Un banc de gardons traverse : les carnassiers vont suivre.'); eau.rond(f.x, f.z, 0.8); } return; }
  if (g < 0.68) { const a = Math.random() * 6.28, d = 22 + Math.random() * 30; oiseaux = { t: 0, x: J.x + Math.cos(a) * d, z: J.z + Math.sin(a) * d, a }; sons.envol(); return; }
  if (g < 0.84) { const C = poissons.filter(f => f.sp.id === 'chevesne' && f.etat === 'cale'), f = C[Math.floor(Math.random() * C.length)] ?? proches[0]; if (f) { nuageI = { t: 0, x: f.x, z: f.z, f }; f.faim = 70; note('Des insectes dansent au-dessus de l’eau : quelque chose monte les gober.'); } return; }
  if (g < 0.93) { const v = grenouilles.filter(x => !x.parti).sort((a, b) => Math.hypot(a.l.x - J.x, a.l.z - J.z) - Math.hypot(b.l.x - J.x, b.l.z - J.z))[0]; if (v) { v.saut = 0.001; sons.grenouille(); } return; }
  if (temps.meteo !== 'pluie' && temps.heure > 8 && temps.heure < 20) { temps.changer('pluie'); note('Le ciel se couvre : une averse arrive.'); }
}
function vivants(dt, t) {
  evT -= dt; if (evT <= 0) { evT = 35 + Math.random() * 55; evenement(); }
  // une brume se lève certains matins
  if (temps.jour !== brumeJour && temps.heure > 5.4 && temps.heure < 7) { brumeJour = temps.jour; if (Math.random() < 0.55) temps.changer('brouillard'); }
  nuee.count = 0;
  if (oiseaux) { const O = oiseaux; O.t += dt; for (let i = 0; i < 16; i++) { const k = O.t * (4 + i * 0.12), bat = Math.sin(t * 16 + i) * 0.7; v3.set(O.x + Math.cos(O.a) * k + Math.sin(i * 3) * 2.2, 5 + O.t * (2.2 + (i % 4) * 0.3) + Math.cos(i * 2) * 1.2, O.z + Math.sin(O.a) * k + Math.cos(i * 5) * 2.2); nuee.setMatrixAt(i, m4.compose(v3, q4.setFromEuler(e4.set(bat, -O.a, 0)), s4)); } nuee.count = 16; nuee.instanceMatrix.needsUpdate = true; if (O.t > 11) oiseaux = null; }
  insectes.count = 0;
  if (nuageI) { const N = nuageI; N.t += dt; if (N.f) { N.x += (N.f.x - N.x) * dt * 0.4; N.z += (N.f.z - N.z) * dt * 0.4; } for (let i = 0; i < 46; i++) { v3.set(N.x + Math.sin(t * (1.1 + i * 0.07) + i) * 1.7, 0.45 + Math.abs(Math.sin(t * 2 + i * 1.3)) * 0.9, N.z + Math.cos(t * (0.9 + i * 0.05) + i * 2) * 1.7); insectes.setMatrixAt(i, m4.compose(v3, camera.quaternion, s4)); } insectes.count = 46; insectes.instanceMatrix.needsUpdate = true; if (N.t > 8 && Math.random() < dt * 0.3 && N.f) { sauter(N.f); N.f = null; } if (N.t > 28) nuageI = null; }
  for (const G of grenouilles) {
    if (G.saut) { G.saut += dt * 1.7; const k = Math.min(1, G.saut); G.g.position.set(G.l.x + k * 1.5, 0.06 + Math.sin(k * Math.PI) * 0.65, G.l.z + k * 0.6); if (k >= 1) { G.saut = 0; G.parti = 40; G.g.visible = false; eau.rond(G.g.position.x, G.g.position.z, 0.6); sons.plouf(0.45); } }
    else if (G.parti) { G.parti -= dt; if (G.parti <= 0) { G.parti = 0; G.g.position.set(G.l.x, 0.06, G.l.z); G.g.visible = true; } }
    else if (Math.hypot(G.l.x - J.x, G.l.z - J.z) < 5 && J.vit > 1) G.saut = 0.001;
  }
}

/* ---------- Observer : regarder un poisson assez longtemps l'inscrit au carnet ---------- */
function lumiereEau() { const L = temps.lumiere; return 15 * Math.min(1, 0.45 + L.force * 0.6) * (1 - temps.pluie * 0.45) * (1 - temps.brume * 0.5); }
function observer(dt) {
  const portee = lumiereEau(), av = camera.getWorldDirection(v3).clone(); let suiveurs = 0, bancVu = 0;
  poissons.forEach((f, i) => {
    const m = corps[i], d = Math.hypot(f.x - camera.position.x, f.y - camera.position.y, f.z - camera.position.z), retire = f.etat === 'retire' || (peche.poisson === f && ['prise'].includes(peche.etat));
    // un poisson se voit d'autant mieux qu'il est proche, peu profond, et que le regard plonge dans l'eau
    const plonge = Math.min(1, Math.max(0, (camera.position.y - f.y) / Math.max(d, 0.1)) * 2.6), net = Math.max(0, 1 - d / portee) * Math.max(0.28, 1 + f.y / 3.6) * (0.35 + plonge * 0.65);
    m.visible = !retire && net > 0.03; if (!m.visible) { f.regard = 0; return; }
    let y = f.y; const s = sauts.get(f); if (s !== undefined) { const k = s + dt / 0.85; if (k >= 1) { sauts.delete(f); eau.rond(f.x, f.z, 1.1); sons.plouf(0.8); } else { sauts.set(f, k); y = f.y + Math.sin(k * Math.PI) * (0.9 - f.y); m.visible = true; } }
    m.position.set(f.x, y, f.z); m.rotation.set(0, f.cap, 0); const u = m.material.uniforms; u.uNage.value = f.nage; u.uAmp.value = 0.05 + Math.min(0.09, f.vit * 0.05); u.uVoile.value = Math.min(1, net * 2.2); if (f.etat === 'suit') suiveurs += f.sp.id === 'perche' ? 1 : 0;
    const vers = new THREE.Vector3(f.x - camera.position.x, f.y - camera.position.y, f.z - camera.position.z).normalize();
    if (net > 0.15 && vers.dot(av) > 0.9 && !ui.ouvert) {
      f.regard = (f.regard ?? 0) + dt; if (f.sp.id === 'gardon') bancVu++;
      if (f.regard > 1.8) { f.regard = -40; if (carnet.observer(f.sp.id)) { note(`Nouvelle page au carnet : ${f.sp.nom}`, 5); sons.page(); decouvrir(); } if (f.sp.id === 'rotengle' && abri(f.x, f.z).nenuphar > 0.3 && carnet.geste('surface')) note('Noté dans le carnet : il gobe sous les nénuphars.'); if (f.sp.id === 'chevesne' && abri(f.x, f.z).arbre > 0.3 && carnet.geste('ombre')) note('Noté dans le carnet : il patrouille à l’ombre des branches.'); decouvrir(); }
    }
    if (f.faim > 0) f.faim -= dt;
  });
  if (suiveurs >= 2 && carnet.geste('groupe')) { note('Noté dans le carnet : les perches chassent en groupe.'); decouvrir(); }
  if (bancVu >= 4 && carnet.geste('banc')) { note('Noté dans le carnet : tout un banc de gardons passe.'); decouvrir(); }
}

/* ---------- La photographie ---------- */
function prendrePhoto() {
  const av = camera.getWorldDirection(v3).clone(), sujets = new Set(); poissons.forEach((f, i) => { if (corps[i].visible && new THREE.Vector3(f.x - J.x, f.y - J.y, f.z - J.z).normalize().dot(av) > 0.86) sujets.add(f.sp.nom); });
  const s = secteurEn(J.x, J.z), c = document.createElement('canvas'), W = 420, H = Math.round((W * vue.height) / vue.width); c.width = W; c.height = H; c.getContext('2d').drawImage(vue, 0, 0, W, H);
  const lieu = s?.nom ?? 'L’Étang des Nymphéas', legende = `${sujets.size ? [...sujets].join(', ') + ', ' : oiseaux ? 'Envolée d’oiseaux, ' : ''}${lieu.charAt(0).toLowerCase() + lieu.slice(1)}, ${momentDe(temps.heure).nom.toLowerCase()}`;
  carnet.photo({ img: c.toDataURL('image/jpeg', 0.62), legende: legende.charAt(0).toUpperCase() + legende.slice(1), date: Date.now(), meteo: temps.pluie > 0.5 ? 'pluie' : temps.meteo });
  [...sujets].forEach(n => { const e = ESPECES.find(x => x.nom === n); if (carnet.observer(e.id)) note(`Nouvelle page au carnet : ${n}`); }); decouvrir();
  const fl = $('#flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); sons.photo(); if (!noteT) note('La photo rejoint ton album.', 2.5);
}

/* ---------- La lumière du tableau ---------- */
function peindreLumiere(t) {
  const L = temps.lumiere; UNI.uTemps.value = t; UNI.uVent.value = 0.14 + temps.vent * 0.5; UNI.uSoleil.value.setRGB(...L.soleil); UNI.uOmbre.value.setRGB(...L.ombre); UNI.uHorizon.value.setRGB(...L.horizon); UNI.uZenith.value.setRGB(...L.zenith); UNI.uBrume.value.setRGB(...L.brume);
  UNI.uDirSoleil.value.set(...L.dir); UNI.uDensite.value = L.densite; UNI.uForce.value = L.force; UNI.uNuit.value = L.nuit; UNI.uCouvert.value = temps.couvert; UNI.uPluie.value = temps.pluie;
}
// la pluie tombe en traits de pinceau autour du promeneur
const pluie = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.018, 0.5), new THREE.MeshBasicMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }), 420); pluie.frustumCulled = false; pluie.layers.set(2); scene.add(pluie);
const gouttes = Array.from({ length: 420 }, () => [Math.random() * 30 - 15, Math.random() * 13, Math.random() * 30 - 15, 8 + Math.random() * 3]);
function pleuvoir(dt) { const n = Math.round(420 * temps.pluie); pluie.count = n; if (!n) return; const a = temps.vent * 0.28; for (let i = 0; i < n; i++) { const g = gouttes[i]; g[1] -= g[3] * dt; if (g[1] < 0) { g[1] = 13; if (Math.random() < 0.05) { const x = J.x + g[0], z = J.z + g[2]; if (dansLEau(x, z)) eau.rond(x, z, 0.28); } } m4.compose(v3.set(J.x + g[0] + g[1] * a, g[1] + J.y - 3, J.z + g[2]), q4.setFromEuler(e4.set(0, J.lacet, a)), s4); pluie.setMatrixAt(i, m4); } pluie.instanceMatrix.needsUpdate = true; }

/* ---------- Le mode d'emploi au bon moment ---------- */
const pres = (a, d = 2.3) => Math.hypot(a[0] - J.x, a[1] - J.y, a[2] - J.z) < d;
const OBJETS = [['carnet', 'E : ouvrir le carnet'], ['boite', 'E : ouvrir la boîte à leurres'], ['carte', 'E : regarder la carte']];
function aide() {
  if (viseur) return ''; const l = peche.leurreChoisi;
  switch (peche.etat) {
    case 'repos': { if (dAnselme < 3) return parole ? '' : 'E : parler au père Anselme'; const o = OBJETS.find(([k]) => pres(decor.hot[k])); if (o) { if (clicE) ui.ouvrir(o[0]); return o[1]; } return dansLEau(J.x - Math.sin(J.lacet) * 12, J.z - Math.cos(J.lacet) * 12) ? 'Maintiens le clic gauche pour lancer' : ''; }
    case 'charge': return 'Relâche pour lancer';
    case 'eau': return peche.l.accroche ? 'Clic gauche : donner des tirées pour libérer le leurre' : `${FAMILLES[l.famille]} : ${l.conseil} · clic droit : mouliner · clic gauche : tirée · F : ramener`;
    case 'touche': return 'Ça mord ! CLIC GAUCHE pour ferrer !';
    case 'combat': return peche.tension > 0.82 ? 'Attention, ça tire trop ! Lâche le moulinet' : peche.combat.court ? `Il file ${peche.combat.cote > 0 ? 'à droite' : 'à gauche'} : tiens la canne de l’autre côté (Q / D)` : 'Clic droit : mouliner quand il se calme';
    case 'epuisette': return 'Clic gauche (ou E) : le sortir de l’eau';
    default: return '';
  }
}

/* ---------- La boucle ---------- */
function retailler() { const w = innerWidth, h = innerHeight, p = Math.min(devicePixelRatio || 1, Q.pixel); renderer.setPixelRatio(p); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); eau.taille(w * p * Q.reflet, h * p * Q.reflet); }
addEventListener('resize', retailler); retailler();
const S = new THREE.Matrix4().makeScale(1, -1, 1), miroir = new THREE.PerspectiveCamera(); miroir.matrixAutoUpdate = false; miroir.matrixWorldAutoUpdate = false; miroir.layers.set(0);
let dernier = performance.now(), img = 0; const DT_MAX = params.has('debug') ? +params.get('dtmax') || 0.05 : 0.05; // les essais automatiques, sur une machine lente, avancent à grands pas
function image(ms) {
  requestAnimationFrame(image); const dt = Math.min(DT_MAX, (ms - dernier) / 1000); dernier = ms; const t = ms / 1000; img++;
  temps.maj(dt); peindreLumiere(t);
  if (enPartie && !chev.actif) marcher(dt);
  J.y += (sol(J.x, J.z, J.y - 1.62) + 1.62 - J.y) * Math.min(1, dt * 9);
  camera.position.set(J.x, J.y, J.z); camera.rotation.set(J.tangage, J.lacet, 0);
  // un nouveau coin de l'étang
  const s = secteurEn(J.x, J.z); if (s && s.id !== J.secteur) { J.secteur = s.id; if (carnet.secteur(s.id)) { lieuTitre(s.nom); note(s.texte, 6); decouvrir(); } } else if (!s) J.secteur = null;
  const aPied = peche.etat === 'repos' || peche.etat === 'charge', actif = enPartie && !ui.ouvert && !viseur && !chev.actif, fwd = new THREE.Vector3(-Math.sin(J.lacet), 0, -Math.cos(J.lacet));
  if (viseur && clicG) { photoDemandee = true; }
  const e = { pos: { x: J.x, y: J.y - 0.3, z: J.z }, dir: { x: fwd.x, z: fwd.z }, vent: { x: temps.vent * 0.8, z: temps.vent * 0.3 }, heure: temps.heure, meteo: temps.suivante ?? temps.meteo,
    charge: actif && gauche && aPied, moulinet: actif && droit, tiree: actif && (clicG || tirer) && peche.etat === 'eau', ferrer: actif && (clicG || tirer) && peche.etat === 'touche', prendre: actif && (clicG || clicE) && peche.etat === 'epuisette',
    lateral: actif ? ((touches.has('KeyD') ? 1 : 0) - (touches.has('KeyA') || touches.has('KeyQ') ? 1 : 0)) : 0 };
  peche.maj(dt, e);
  for (const x of peche.evenements.splice(0)) {
    if (x.type === 'lancer') { sons.lancer(); mains.secousse(0.5); }
    if (x.type === 'plouf') { eau.rond(x.x, x.z, 1); sons.plouf(0.8); }
    if (x.type === 'tiree') { mains.secousse(0.26); sons.tiree(); eau.rond(peche.l.x, peche.l.z, 0.35); }
    if (x.type === 'touche') { sons.touche(); mains.secousse(0.4); eau.rond(peche.l.x, peche.l.z, 1); }
    if (x.type === 'ferre') { mains.secousse(0.6); sons.saut(); }
    if (x.type === 'saut') { sauter(x.f); }
    if (['casse', 'decroche', 'berge', 'rate', 'accroche', 'libere'].includes(x.type)) { if (peche.message) note(peche.message, 3.5); if (x.type === 'casse') sons.casse(); }
    if (x.type === 'prise') montrerPrise();
  }
  if (peche.etat === 'eau' && droit && actif) sons.moulinet(dt, 0.6 + peche.vitesse * 0.5); if (peche.etat === 'combat') { if (droit) sons.moulinet(dt, 1); sons.frein(Math.max(0, peche.tension - peche.canne.frein) * dt * 40); if (Math.random() < dt * 2) eau.rond(peche.l.x, peche.l.z, 0.45 + peche.tension * 0.4); }
  for (const x of majPoissons(poissons, dt, { t, heure: temps.heure, meteo: temps.suivante ?? temps.meteo, pluie: temps.pluie, brume: temps.brume, force: temps.lumiere.force, joueur: { x: J.x, z: J.z, vitesse: J.vit }, leurre: peche.vueLeurre() })) {
    if (x.type === 'touche') peche.touche(x.f);
    if (x.type === 'suit' && x.f.sp.id === 'brochet' && carnet.geste('suit')) { note('Noté dans le carnet : le brochet suit ton leurre…'); decouvrir(); }
  }
  observer(dt); vivants(dt, t); pleuvoir(dt); jardiner(dt); legendes(dt);
  if (chev.maj(dt) && Math.random() < dt * 6) sons.pinceau();
  // le lancer : où tombera le leurre
  mains.maj(dt, peche, e, chev.actif || tableauDemande ? 'net' : ui.ouvert || viseur); mains.cible.visible = peche.etat === 'charge'; if (mains.cible.visible) { const P = peche.canne.portee * (0.25 + peche.puissance * 0.75); mains.cible.position.set(J.x + fwd.x * P, 0.08, J.z + fwd.z * P); mains.cible.material.color.set(dansLEau(mains.cible.position.x, mains.cible.position.z) ? 0xfff2c8 : 0xe08a6a); }
  if (tenu) { tenu.material.uniforms.uNage.value = t * 5; tenu.rotation.z = Math.sin(t * 2.1) * 0.05; }
  // l'écran : le moins possible
  const a = enPartie && !ui.ouvert && !chev.actif ? aide() : ''; if (a !== aideFix) { $('#aide').textContent = a; aideFix = a; }
  const mat = peche.leurreChoisi, txt = enPartie && !chev.actif ? `${mat.nom}${['eau', 'combat'].includes(peche.etat) ? ` · moulinet ${['lent', 'moyen', 'rapide'][peche.vitesse]}` : ''}` : ''; if ($('#materiel').textContent !== txt) $('#materiel').textContent = txt;
  $('#tension').hidden = peche.etat !== 'combat'; if (peche.etat === 'combat') { const k = Math.min(1, peche.tension), f = $('#fil'); f.setAttribute('stroke-dasharray', `${(k * 100).toFixed(1)} 100`); f.setAttribute('stroke', k > 0.82 ? '#e0583c' : k > 0.6 ? '#f0c060' : '#fbf4e2'); }
  $('#force').hidden = peche.etat !== 'charge'; if (peche.etat === 'charge') $('#force').style.setProperty('--p', peche.puissance.toFixed(2));
  $('#point').hidden = !enPartie || ui.ouvert || chev.actif; if (noteT > 0 && (noteT -= dt) <= 0) { noteT = 0; $('#note').classList.remove('on'); } if (lieuT > 0 && (lieuT -= dt) <= 0) $('#lieu').classList.remove('on');
  sons.maj(dt, temps, Math.max(0, 1 - Math.max(0, hauteur(J.x, J.z)) / 2));
  clicG = clicE = tirer = false;
  // le reflet : le paysage retourné, dans lequel les touches de l'eau viendront puiser
  camera.updateMatrixWorld(true); eau.maj(camera);
  if (img % (Q === QUALITE.basse ? 2 : 1) === 0) {
    miroir.projectionMatrix.copy(camera.projectionMatrix); miroir.projectionMatrixInverse.copy(camera.projectionMatrixInverse); miroir.matrixWorld.multiplyMatrices(S, camera.matrixWorld); miroir.matrixWorldInverse.copy(miroir.matrixWorld).invert();
    UNI.uMiroir.value = 1; renderer.setRenderTarget(eau.reflet); renderer.clear(); renderer.render(scene, miroir); UNI.uMiroir.value = 0; renderer.setRenderTarget(null);
  }
  renderer.render(scene, camera);
  if (photoDemandee) { photoDemandee = false; prendrePhoto(); }
  if (tableauDemande) { tableauDemande = false; const c = document.createElement('canvas'); c.width = 240; c.height = Math.round(240 * vue.height / vue.width); c.getContext('2d').drawImage(vue, 0, 0, c.width, c.height); const s = secteurEn(J.x, J.z); chev.commencer(c, `${s?.nom ?? 'L’Étang des Nymphéas'}, ${momentDe(temps.heure).nom.toLowerCase()}`); sons.page(); }
}
if (params.has('debug')) window.monet = { anselme, chev, signer, parlerA: () => { clicE = true; }, dAnselme: () => dAnselme, reveilLegende: () => { legT = 0; }, J, peche, poissons, carnet, temps, ui, eau, corps, camera, decor, UNI, entrer() { $('#titre').classList.add('parti'); enPartie = true; }, evenement, decider, touches };
pret = true; $('#pret').textContent = 'Cliquer pour entrer dans le tableau';
requestAnimationFrame(image);
