// LES EAUX DE MONET — les objets qu'on consulte : le carnet naturaliste, la carte peinte, la boîte à leurres. Pas de menus :
// on les prend en main au campement (E), ou d'une touche quand on les a sur soi.
import { ESPECES, LEURRES, CANNES, FAMILLES, LIEUX, ETANG, TEMPS, LEGENDES, espece } from './reglages.js';
import { DEFIS, POSTES } from './jardinier.js';
import { illustrer } from './vue-poissons.js';
import { momentDe } from './temps.js';
import { sons, audio } from './sons.js';

const $ = s => document.querySelector(s), h = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const heureTxt = v => `${String(Math.floor(v)).padStart(2, '0')} h ${String(Math.floor((v % 1) * 60)).padStart(2, '0')}`, secteurNom = id => ETANG.secteurs.find(s => s.id === id)?.nom ?? 'Au large', meteoNom = id => TEMPS.meteos[id]?.nom ?? id, leurreNom = id => LEURRES.find(l => l.id === id)?.nom ?? id;

// un leurre peint sur une petite toile
function peindreLeurre(c, L) {
  const x = c.getContext('2d'), W = c.width, H = c.height; x.clearRect(0, 0, W, H); x.lineCap = 'round'; const ligne = (a, b, e, col) => { x.strokeStyle = col; x.lineWidth = e; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  const [A, B] = L.couleurs, cy = H / 2;
  if (L.famille === 'tournant') { x.fillStyle = A; x.beginPath(); x.ellipse(W * 0.42, cy, W * 0.2, H * 0.28, 0.2, 0, 7); x.fill(); ligne([W * 0.32, cy], [W * 0.5, cy - 4], 3, B); ligne([W * 0.12, cy], [W * 0.9, cy], 2, '#5a4a3a'); }
  else if (L.famille === 'nageur') { for (let i = 0; i < 40; i++) { const t = i / 39, e = Math.sin(t * Math.PI) * H * 0.26; ligne([W * (0.16 + t * 0.62), cy - e], [W * (0.16 + t * 0.62), cy + e], 3.4, i % 5 < 2 ? B : A); } ligne([W * 0.16, cy + 3], [W * 0.04, cy + 13], 4, '#c9c0a8'); x.fillStyle = '#1a1820'; x.beginPath(); x.arc(W * 0.24, cy - 3, 2.6, 0, 7); x.fill(); }
  else { for (let i = 0; i < 26; i++) { const t = i / 25; x.strokeStyle = i % 4 ? A : B; x.lineWidth = 9 - t * 6; x.beginPath(); x.moveTo(W * (0.14 + t * 0.66), cy + Math.sin(t * 7) * 7); x.lineTo(W * (0.17 + t * 0.66), cy + Math.sin(t * 7 + 0.4) * 7); x.stroke(); } }
}

export function creerInterface({ carnet, peche, temps, voyager, secteursVus, reprendre }) {
  const fond = $('#objet'); let ouvert = null, onglet = 'especes', page = ESPECES[0].id;
  function fermer() { if (!ouvert) return; ouvert = null; fond.hidden = true; fond.innerHTML = ''; reprendre(); }
  function ouvrir(q) { ouvert = q; fond.hidden = false; sons.page(); document.exitPointerLock?.(); ({ carnet: rendreCarnet, carte: rendreCarte, boite: rendreBoite, reglages: rendreReglages })[q](); }

  /* ---------- Le carnet naturaliste ---------- */
  function ficheHTML(e) {
    const F = carnet.fiche(e.id), R = F?.record, D = F?.derniere, ligne = (t, v) => `<dt>${t}</dt><dd>${v}</dd>`, tu = '<i>à découvrir</i>';
    if (!F) return `<div class="page-droite vide"><h2>Espèce inconnue</h2><canvas id="illu" width="620" height="300"></canvas><p>Observe l’eau patiemment : une silhouette finira par se montrer.</p></div>`;
    const pris = F.prises > 0;
    return `<div class="page-droite"><h2>${h(e.nom)}</h2><p class="latin">${h(e.latin)}</p><canvas id="illu" width="620" height="300"></canvas><p class="desc">${h(e.description)}</p>
      <dl>${ligne('Habitat', h(e.habitatTxt))}${ligne('Comportement', h(e.comportement))}${ligne('Taille', `${e.longueur[0]} à ${e.longueur[1]} cm`)}${ligne('Poids', pris ? `jusqu’à ${R.poids.toFixed(2).replace('.', ',')} kg pour ta plus belle prise` : tu)}
      ${ligne('Mon record', pris ? `<b>${R.longueur} cm</b>, ${R.poids.toFixed(2).replace('.', ',')} kg` : e.appat ? tu : 'ne se pêche pas aux leurres')}${ligne('Lieu de capture', pris ? h(secteurNom(R.secteur)) : tu)}${ligne('Conditions', pris ? h(meteoNom(R.meteo)) : tu)}${ligne('Heure de capture', pris ? heureTxt(R.heure) : tu)}${ligne('Leurres efficaces', pris ? h(F.leurres.map(leurreNom).join(', ')) : tu)}
      ${ligne('Mes observations', `${F.vu} fois vu${F.vu > 1 ? 's' : ''}${pris ? `, ${F.prises} pris, ${F.relaches} remis à l’eau` : ''}`)}${carnet.donnees.gestes.includes(e.geste[0]) ? ligne('Noté sur le vif', h(e.geste[1])) : ''}</dl></div>`;
  }
  function rendreCarnet() {
    const D = carnet.donnees, T = temps(), onglets = [['especes', 'Espèces'], ['legendes', 'Légendes'], ['collection', 'Collection'], ['album', 'Album'], ['galerie', 'Mes tableaux'], ['progres', 'Mes promenades']];
    let droite = '';
    if (onglet === 'especes') droite = ficheHTML(espece(page));
    if (onglet === 'collection') droite = `<div class="page-droite"><h2>Ma collection</h2>${D.collection.length ? `<ul class="liste">${D.collection.map(c => `<li><b>${h(espece(c.espece).nom)}</b>, ${c.longueur} cm, ${c.poids.toFixed(2).replace('.', ',')} kg<br><small>${h(secteurNom(c.secteur))}, ${h(meteoNom(c.meteo))}, ${heureTxt(c.heure)}</small></li>`).join('')}</ul>` : '<p>Les poissons que tu choisis de conserver sont consignés ici. Rien ne t’y oblige : relâcher compte tout autant.</p>'}</div>`;
    if (onglet === 'legendes') droite = `<div class="page-droite"><h2>Les légendes</h2><p class="desc">Cinq poissons hors du commun, un par coin de l’étang. Le père Anselme sait où et quand les chercher.</p><ul class="liste legende">${LEGENDES.map(g => { const p = D.legendes[g.id], su = D.rumeurs.includes(g.id); return `<li><b>${p || su ? h(g.nom) : '· · ·'}${p ? ' ✓' : ''}</b><br>${p ? `${h(espece(g.espece).nom)} de <b>${p.premiere.longueur} cm</b>, ${p.premiere.poids.toFixed(2).replace('.', ',')} kg, pris à ${heureTxt(p.premiere.heure)} (${h(meteoNom(p.premiere.meteo))}). ` : ''}<small>${su || p ? h(g.rumeur) : 'Une page encore blanche. Rends quelques services au père Anselme.'}</small></li>`; }).join('')}</ul></div>`;
    if (onglet === 'galerie') droite = `<div class="page-droite"><h2>Mes tableaux</h2>${D.galerie.length ? `<div class="galerie">${D.galerie.map(p => `<figure><img src="${p.img}" alt="${h(p.titre)}"><figcaption>${h(p.titre)}</figcaption></figure>`).join('')}</div>` : '<p>Pose ton chevalet où tu veux (touche V) : la vue se peindra sous tes yeux.</p>'}</div>`;
    if (onglet === 'album') droite = `<div class="page-droite"><h2>Mon album</h2>${D.album.length ? `<div class="album">${D.album.map(p => `<figure><img src="${p.img}" alt="${h(p.legende)}"><figcaption>${h(p.legende)}</figcaption></figure>`).join('')}</div>` : '<p>Sors l’appareil (touche P) et cadre ce qui te plaît : un paysage, un poisson, une averse.</p>'}</div>`;
    if (onglet === 'progres') { const L = LIEUX.find(l => l.condition), p = carnet.progres(L); droite = `<div class="page-droite"><h2>Mes promenades</h2><p class="desc">${h(momentDe(T.heure).nom)}, ${heureTxt(T.heure)}. ${h(meteoNom(T.suivante ?? T.meteo))}.</p><h3>Le père Anselme</h3><p>${D.jardinier.vu ? `Il jardine ${{ nenuphars: 'près des grands nénuphars', pont: 'au pied du pont japonais', saule: 'sous le vieux saule', camp: 'près du campement' }[POSTES[momentDe(T.heure).id]]} à cette heure-ci. ${D.jardinier.defi < DEFIS.length ? 'Ce qu’il t’a demandé : ' + h(DEFIS[D.jardinier.defi].rappel) : 'Il t’a tout dit.'}` : 'Un vieil homme ratisse la berge près du campement. Va le saluer.'}</p><h3>Les coins de l’étang</h3><ul class="liste">${ETANG.secteurs.map(s => `<li>${D.secteurs.includes(s.id) ? '✓' : '○'} ${h(s.nom)}${D.secteurs.includes(s.id) ? `<br><small>${h(s.texte)}</small>` : ''}</li>`).join('')}</ul><h3>Pour rejoindre ${h(L.nom)}</h3><ul class="liste"><li>${p.especes[0]} / ${p.especes[1]} espèces découvertes</li><li>${p.secteurs[0]} / ${p.secteurs[1]} coins de l’étang visités</li><li>${p.gestes[0]} / ${p.gestes[1]} comportements notés sur le vif</li></ul></div>`; }
    fond.innerHTML = `<article class="carnet"><nav class="page-gauche"><h1>Carnet du pêcheur</h1><div class="onglets">${onglets.map(([k, n]) => `<button data-onglet="${k}" class="${k === onglet ? 'on' : ''}">${n}</button>`).join('')}</div>
      <ol class="sommaire">${ESPECES.map(e => { const F = carnet.fiche(e.id); return `<li><button data-page="${e.id}" class="${onglet === 'especes' && page === e.id ? 'on' : ''}">${F ? h(e.nom) : '· · ·'}${F?.prises ? ' ✓' : ''}</button></li>`; }).join('')}</ol><p class="compte">${carnet.decouvertes()} / ${ESPECES.length} espèces</p></nav>${droite}<button class="fermer" data-fermer>Refermer le carnet (C)</button></article>`;
    const c = $('#illu'); if (c) { const F = carnet.fiche(page); illustrer(c, page, !F?.prises); if (!F) c.style.opacity = 0.25; }
  }
  fond.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.fermer !== undefined) return fermer();
    if (b.dataset.onglet) { onglet = b.dataset.onglet; sons.page(); return rendreCarnet(); }
    if (b.dataset.page) { page = b.dataset.page; onglet = 'especes'; sons.page(); return rendreCarnet(); }
    if (b.dataset.leurre) { peche.choisir(null, LEURRES.find(l => l.id === b.dataset.leurre)); return rendreBoite(); }
    if (b.dataset.canne) { peche.choisir(CANNES.find(c => c.id === b.dataset.canne), null); return rendreBoite(); }
    if (b.dataset.aller) { fermer(); voyager(b.dataset.aller); }
    if (b.dataset.moment) { temps().heure = +b.dataset.moment; return rendreReglages(); }
    if (b.dataset.meteo) { temps().imposer(b.dataset.meteo); return rendreReglages(); }
  });

  // les curseurs et les cases du panneau de réglages
  fond.addEventListener('input', ev => {
    const c = ev.target; if (c.dataset.son) sons.regler(c.dataset.son, c.value / 100);
    if (c.dataset.heure !== undefined) { temps().heure = +c.value; $('#heure-txt').textContent = heureTxt(+c.value); }
    if (c.dataset.fige !== undefined) temps().fige = !c.checked;
    if (c.dataset.musique !== undefined && c.checked !== audio.musique) sons.musique();
  });

  /* ---------- Les réglages : les sons, l'heure et le temps qu'il fait ---------- */
  function rendreReglages() {
    const T = temps(), V = audio.volumes, M = momentDe(T.heure).id, met = T.suivante ?? T.meteo, curseur = (k, n) => `<label class="curseur"><span>${n}</span><input type="range" min="0" max="100" value="${Math.round(V[k] * 100)}" data-son="${k}"></label>`;
    fond.innerHTML = `<article class="reglages"><h1>Réglages</h1>
      <section><h2>Les sons</h2>${curseur('general', 'Volume général')}${curseur('musique', 'La musique')}${curseur('nature', 'La nature')}${curseur('gestes', 'Les gestes du pêcheur')}<label class="case"><input type="checkbox" data-musique ${audio.musique ? 'checked' : ''}> Jouer la musique (M)</label></section>
      <section><h2>L’heure</h2><label class="curseur"><span id="heure-txt">${heureTxt(T.heure)}</span><input type="range" min="0" max="23.75" step="0.25" value="${T.heure.toFixed(2)}" data-heure></label>
        <div class="choix">${TEMPS.moments.map(m => `<button data-moment="${{ nuit: 23, matin: 7, jour: 13, soir: 19 }[m.id]}" class="${m.id === M ? 'on' : ''}">${h(m.nom)}</button>`).join('')}</div></section>
      <section><h2>Le temps qu’il fait</h2><div class="choix">${Object.entries(TEMPS.meteos).map(([id, m]) => `<button data-meteo="${id}" class="${id === met ? 'on' : ''}">${h(m.nom)}</button>`).join('')}</div>
        <label class="case"><input type="checkbox" data-fige ${T.fige ? '' : 'checked'}> Laisser les heures passer et le ciel changer</label></section>
      <button class="fermer" data-fermer>Fermer (O)</button></article>`;
  }

  /* ---------- La boîte à leurres ---------- */
  function rendreBoite() {
    const libre = peche.etat === 'repos';
    fond.innerHTML = `<article class="boite"><h1>La boîte à leurres</h1>${libre ? '' : '<p class="note-boite">Ramène d’abord ta ligne pour changer de matériel.</p>'}
      <div class="plateau">${LEURRES.map(l => `<button data-leurre="${l.id}" class="${peche.leurreChoisi === l ? 'on' : ''}" ${libre ? '' : 'disabled'}><canvas width="150" height="62" data-peint="${l.id}"></canvas><b>${h(l.nom)}</b><small>${h(FAMILLES[l.famille])} · ${l.taille} cm</small><em>${h(l.conseil)}</em></button>`).join('')}</div>
      <div class="cannes">${CANNES.map(c => `<button data-canne="${c.id}" class="${peche.canne === c ? 'on' : ''}" ${libre ? '' : 'disabled'}><b>${h(c.nom)}</b><small>${h(c.texte)}</small></button>`).join('')}</div><button class="fermer" data-fermer>Refermer la boîte (B)</button></article>`;
    fond.querySelectorAll('[data-peint]').forEach(c => peindreLeurre(c, LEURRES.find(l => l.id === c.dataset.peint)));
  }

  /* ---------- La carte peinte ---------- */
  function rendreCarte() {
    const D = carnet.donnees;
    fond.innerHTML = `<article class="carte"><h1>Carte de mes eaux</h1><div class="terre"><canvas id="toile-carte" width="900" height="560"></canvas>
      ${LIEUX.map(l => { const ok = carnet.debloque(l), p = carnet.progres(l); return `<div class="lieu ${l.id === 'etang' ? 'ici' : ok ? 'ouvert' : ''}" style="left:${l.x * 100}%;top:${l.y * 100}%"><b>${h(l.nom)}</b><small>${l.id === 'etang' ? 'Tu es ici' : ok ? 'Ouvert à ta curiosité : ce lieu reste à peindre' : p ? `${p.especes[0] + p.secteurs[0] + p.gestes[0]} / ${p.especes[1] + p.secteurs[1] + p.gestes[1]} découvertes` : 'Au-delà des collines'}</small></div>`; }).join('')}</div>
      <h2>Rejoindre un coin de l’étang</h2><div class="coins">${ETANG.secteurs.map(s => `<button data-aller="${s.id}" ${secteursVus().includes(s.id) ? '' : 'disabled'} title="${D.secteurs.includes(s.id) ? h(s.texte) : 'Va d’abord le découvrir à pied'}">${h(s.nom)}</button>`).join('')}</div><button class="fermer" data-fermer>Replier la carte (K)</button></article>`;
    const x = $('#toile-carte').getContext('2d'); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    x.fillStyle = '#e6dcbc'; x.fillRect(0, 0, 900, 560); const tache = (cx, cy, R, pal, n) => { for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * R; x.strokeStyle = pal[Math.floor(r() * pal.length)]; x.globalAlpha = 0.6; x.lineWidth = 6 + r() * 9; x.lineCap = 'round'; x.beginPath(); const X = cx + Math.cos(a) * d * 1.3, Y = cy + Math.sin(a) * d * 0.8; x.moveTo(X, Y); x.lineTo(X + 16 + r() * 14, Y + (r() - 0.5) * 7); x.stroke(); } };
    tache(450, 300, 330, ['#a8bc78', '#94ae6c', '#bcc488', '#7f9c64'], 700); tache(120, 440, 90, ['#7fb6c8', '#5f9cb0', '#a0c8d0'], 110); tache(770, 345, 95, ['#8fa8c0', '#a8b8c8', '#c8ccd0'], 120); tache(450, 310, 46, ['#4f8a8c', '#5f9c98', '#6fae9c'], 80); tache(690, 150, 70, ['#d8843c', '#c8602c', '#e0a848'], 110); tache(490, 480, 56, ['#6a8a5c', '#8a7aa8', '#5f7a5c'], 80);
    x.globalAlpha = 0.75; x.strokeStyle = '#5f9cb0'; x.lineWidth = 7; x.beginPath(); x.moveTo(170, 60); x.bezierCurveTo(260, 180, 170, 260, 330, 320); x.stroke(); x.globalAlpha = 1;
  }
  return { ouvrir, fermer, get ouvert() { return ouvert; }, basculer(q) { if (ouvert === q) fermer(); else if (!ouvert) ouvrir(q); }, rafraichir() { if (ouvert) ouvrir(ouvert); } };
}
