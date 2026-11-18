// THE HOLLOW — ce qui s'écrit par-dessus le dessin : les paroles des PNJ (écrites à la main, au-dessus de leur tête),
// l'invite d'action (E), l'encrier, et le carnet du voyageur (C) : chaque moment fort y devient une page dessinée.
import * as THREE from 'three';

const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué : tant pis, la page reste en mémoire */ } };

export function createUI(camera, canvas) {
  const say = $('#say'), prompt = $('#prompt'), inkEl = $('#ink'), airEl = $('#air'), goalEl = $('#goal'), markEl = $('#mark'), book = $('#carnet'), v = new THREE.Vector3();
  let anchor = null, sayTimer = 0, pending = null, target = null, goalText = '';
  const pages = load('hollow-carnet', []);
  const place = (el, p, dy) => { v.copy(p).project(camera); const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2; el.style.opacity = vis ? '' : 0; el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight - dy}px`; };
  const ui = {
    // une réplique, écrite à l'encre au-dessus de « at » (un point du monde qui peut bouger)
    say(text, at, secs = 5) {
      say.innerHTML = `<span>${text}</span>`; say.classList.remove('on'); void say.offsetWidth; say.classList.add('on');
      anchor = at; sayTimer = secs;
    },
    // l'invite : « E — parler », ou rien
    prompt(text) { prompt.textContent = text ? `E — ${text}` : ''; prompt.classList.toggle('on', !!text); },
    // l'encrier : n gouttes sur max
    ink(n, max) { inkEl.innerHTML = `<i style="height:${(n / max) * 100}%"></i><b>${n}</b>`; inkEl.classList.toggle('full', n >= max); inkEl.hidden = false; },
    // le souffle, de 0 à 1 (null : on respire, la bande disparaît)
    air(k) { airEl.hidden = k == null; if (k != null) { airEl.style.setProperty('--k', k.toFixed(3)); airEl.classList.toggle('low', k < 0.25); } },
    // une strate neuve : ni encrier ni souffle tant qu'elle ne les montre pas
    clear() { inkEl.hidden = true; ui.air(null); ui.prompt(null); ui.goal(null); },
    // l'objectif : ce qu'il faut faire maintenant (une ligne en haut à gauche), et un repère sur la cible (un point du monde)
    goal(text, at = null) {
      if (text !== goalText) { goalText = text || ''; goalEl.textContent = goalText; goalEl.hidden = !text; if (text) { goalEl.classList.remove('new'); void goalEl.offsetWidth; goalEl.classList.add('new'); } }
      target = text ? at : null; markEl.hidden = !target;
    },
    // une page du carnet : on capture l'image juste après le prochain dessin, on l'encre en noir et blanc
    page(caption) { pending = caption; },
    capture() {
      if (!pending) return;
      const c = document.createElement('canvas'), w = 520, h = Math.round((w * canvas.height) / canvas.width);
      c.width = w; c.height = h; const x = c.getContext('2d');
      x.filter = 'grayscale(1) contrast(1.7) brightness(1.08) sepia(.25)'; x.drawImage(canvas, 0, 0, w, h);
      pages.push({ img: c.toDataURL('image/jpeg', 0.72), caption: pending }); keep('hollow-carnet', pages);
      toastPage(pending); pending = null; ui.sons?.play('g-page');
    },
    get pages() { return pages; },
    toggleBook() {
      book.hidden = !book.hidden;
      if (!book.hidden) book.innerHTML = `<h2>Carnet du voyageur</h2>${pages.length ? pages.map(p => `<figure><img src="${p.img}" alt=""><figcaption>${p.caption}</figcaption></figure>`).join('') : '<p class="vide">Aucune page encore. Le monde attend d’être vu.</p>'}<small>C pour fermer</small>`;
      return !book.hidden;
    },
    update(dt) {
      // le repère : sur la cible si elle est à l'écran, sinon collé au bord, une flèche vers elle
      if (target) { v.copy(target).project(camera); const behind = v.z > 1; let x = v.x, y = v.y; if (behind) { x = -x; y = -y; } const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88, k = off ? 0.9 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-3) : 1; x *= off ? k : 1; y *= off ? k : 1; markEl.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; markEl.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`; markEl.classList.toggle('off', off); markEl.style.setProperty('--a', `${Math.atan2(-y, x)}rad`); markEl.dataset.d = `${Math.round(camera.position.distanceTo(target))} m`; }
      if (anchor) { place(say, anchor, 40); sayTimer -= dt; if (sayTimer <= 0) { say.classList.remove('on'); anchor = null; } }
    },
  };
  function toastPage(text) { const t = $('#pagetoast'); t.textContent = `Une page s’ajoute au carnet : « ${text} »`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
  addEventListener('keydown', e => { if (e.code === 'KeyC') ui.toggleBook(); });
  return ui;
}
// recommencer à zéro : toutes les histoires et la strate atteinte oubliées (et le carnet aussi, si on le demande)
const reset = (carnet = false) => { for (const k of ['hollow-jardins', 'hollow-brumes', 'hollow-foret', 'hollow-abysses', 'hollow-terres', 'hollow-cite', 'hollow-strate', 'hollow-fin', ...(carnet ? ['hollow-carnet'] : [])]) { try { localStorage.removeItem(k); } catch { /* stockage bloqué */ } } };
export const save = { load, keep, reset };
