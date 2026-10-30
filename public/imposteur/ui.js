// Affichage partagé par le mode en ligne (client.js) et le mode « un seul appareil » (solo.js).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const ROLE = {
  civil: { label: 'Civil', plural: 'Civils', hint: 'Tous les civils ont ce mot. Démasque ceux qui ont un autre mot… ou aucun.' },
  imposteur: { label: 'Imposteur', plural: 'Imposteurs', hint: 'Ton mot est proche de celui des civils. Fonds-toi dans la masse et devine leur mot.' },
  white: { label: 'Mr. White', plural: 'Mr. White', hint: 'Tu n’as aucun mot. Écoute les indices, improvise… et si tu es démasqué, devine le mot des civils.' },
};

// Dos de carte doré ; face selon le rôle. « fresh » : la carte se retourne avec une animation.
function cardFace(me) {
  if (!me) return '<div class="face front none"><b>Spectateur</b><p>Tu joueras à la prochaine manche.</p></div>';
  if (me.role === 'white') return `<div class="face front white"><b class="word white-name">MR.<br>WHITE</b><p>${ROLE.white.hint}</p></div>`;
  // Civil ou imposteur ? La carte est identique : seul le mot change, personne ne sait dans quel camp il est.
  return `<div class="face front word"><span class="role">Ton mot secret</span><b class="word">${esc(me.word)}</b>
    <p>Les autres ont-ils le même mot que toi ? Écoute bien leurs indices…</p></div>`;
}
export const card = (me, flipped, cls = '') => `<div class="card3d ${cls}${flipped ? ' flipped' : ''}"><div class="flip-in">
  <div class="face back"><span>?</span><small>Le Cercle</small></div>${cardFace(me)}</div></div>`;

// Carte de l'éliminé, qui se retourne pour révéler son rôle (suspense : elle reste face cachée un instant).
export function revealCard(o, animate) {
  return `<div class="reveal-wrap"><div class="card3d big elim ${animate ? 'suspense' : 'flipped'}"><div class="flip-in">
    <div class="face back"><span>?</span><small>Le Cercle</small></div>
    <div class="face front ${o.role}"><span class="role">Rôle révélé</span>
      <b class="word${o.role === 'white' ? ' white-name' : ''}">${o.role === 'white' ? 'MR.<br>WHITE' : ROLE[o.role].label.toUpperCase()}</b>
      <p>${esc(o.name)} · ${o.votes} voix</p></div></div></div></div>`;
}

export function tallyHtml(v) {
  const rows = Object.entries(v.tally).sort((a, b) => b[1] - a[1]);
  const by = t => Object.keys(v.votes).filter(n => v.votes[n] === t).map(esc).join(', ');
  return `<h3>${v.top.length > 1 ? (v.revote ? 'Égalité persistante' : 'Égalité') : 'Résultat du vote'}</h3>`
    + (rows.length ? rows.map(([t, c]) => `<div class="tally-row${v.top.includes(t) ? ' top' : ''}"><b>${esc(t)}</b><span class="bar" style="--w:${(c / Math.max(...rows.map(r => r[1]))) * 100}%"></span><span class="count">${c} voix</span><small>${by(t)}</small></div>`).join('')
      : '<p class="hint">Personne n’a voté.</p>');
}

// Fin de manche : vainqueur, mots, rôles, éliminations, scores.
export function overHtml(s, solo = false) {
  const G = s.game, R = G.reveal, w = R.winner, mine = G.me && w.names.includes(s.me);
  const head = w.team === 'civil' ? 'Les civils gagnent !' : w.team === 'imposteur' ? `${w.names.length > 1 ? 'Les imposteurs gagnent' : 'L’imposteur gagne'} !`
    : 'Mr. White gagne !';
  const how = w.team === 'white' ? (G.out?.found ? `${esc(w.names[0])} a deviné le mot des civils : « ${esc(G.out.guess)} » !` : `${esc(w.names.join(', '))} a survécu jusqu’au bout sans aucun mot !`)
    : w.team === 'civil' ? 'Tous les intrus ont été démasqués.' : 'Ils sont désormais aussi nombreux que les civils.';
  const last = s.round >= s.settings.rounds, host = solo || s.me === s.host;
  const ranking = [...s.players].sort((a, b) => b.score - a.score);
  return `<div class="over ${w.team}">
    <div class="winner"><span class="crown">♛</span><h2>${head}</h2><p>${how}</p>${solo ? `<p class="mine">${w.names.map(esc).join(', ')} : <b>+${w.points} points</b></p>` : G.me ? `<p class="mine">${mine ? `Bravo, tu gagnes <b>+${w.points} points</b> !` : 'Perdu pour cette fois…'}</p>` : ''}</div>
    <div class="words">
      <div class="w civil"><small>Mot des civils</small><b>${esc(R.words.civil)}</b></div>
      <div class="w imposteur"><small>Mot des imposteurs</small><b>${esc(R.words.imposteur)}</b></div>
      <div class="w cat"><small>Catégorie</small><b>${esc(R.category)}</b></div>
    </div>
    <div class="cols">
      <div><h3>Rôles</h3><ul class="roles">${G.order.map(n => `<li class="${R.roles[n]}"><b>${esc(n)}</b><span class="tag ${R.roles[n]}">${ROLE[R.roles[n]].label}</span>${w.names.includes(n) ? '<small>gagnant</small>' : ''}</li>`).join('')}</ul></div>
      <div><h3>Éliminations</h3><ol class="elims">${G.elims.length ? G.elims.map(e => `<li><b>${esc(e.name)}</b> <span class="tag ${e.role}">${ROLE[e.role].label}</span><small>tour ${e.tour} · ${e.votes} voix${e.role === 'white' ? ` · a proposé « ${esc(e.guess ?? '—')} »` : ''}</small></li>`).join('') : '<li class="hint">Aucune</li>'}</ol></div>
    </div>
    <h3>Classement · ${last ? 'partie terminée' : `manche ${s.round} / ${s.settings.rounds}`}</h3>
    <ol class="ranking">${ranking.map((p, i) => `<li class="${i === 0 && last ? 'first' : ''}"><span>${i + 1}</span><b>${esc(p.name)}</b><em>${p.score} pt${p.score > 1 ? 's' : ''}</em></li>`).join('')}</ol>
    <p class="hint">Points : civil gagnant +${s.points.civil} · imposteur gagnant +${s.points.imposteur} · Mr. White gagnant +${s.points.white}</p>
    ${host ? `<div class="row"><button class="gold big" id="nextBtn">${last ? 'Nouvelle partie' : 'Manche suivante : nouveaux mots, nouveaux rôles'}</button><button class="ghost" id="lobbyBtn">${solo ? 'Changer les joueurs' : 'Retour au salon'}</button></div>`
      : `<p class="hint">${esc(s.host)} lance la suite…</p>`}
  </div>`;
}


// Les indices de la manche, tour par tour ; le rôle d'un joueur n'apparaît qu'une fois révélé (éliminé ou fin de manche).
export function cluesHtml(G, silent) {
  const tours = [...new Set(G.clues.map(c => c.tour))];
  return '<h3>Indices</h3>' + tours.map(t => `<div class="tour"><span class="tour-no">Tour ${t}</span><ul>${G.clues.filter(c => c.tour === t).map(c => {
    const role = G.elims.find(e => e.name === c.name)?.role ?? G.reveal?.roles[c.name];
    return `<li class="${c.text ? '' : 'silent'} ${role ? `is-${role}` : ''}"><small>${esc(c.name)}</small><b>${c.text ? esc(c.text) : silent}</b></li>`;
  }).join('')}</ul></div>`).join('');
}
