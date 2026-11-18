// THE HOLLOW — ce qui s'écrit par-dessus le dessin : les paroles des PNJ (écrites à la main, au-dessus de leur tête),
// l'invite d'action (E), l'encrier, et le carnet du voyageur (C) : chaque moment fort y devient une page dessinée.
import * as THREE from 'three';

const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué : tant pis, la page reste en mémoire */ } };

export function createUI(camera, canvas) {
  const say = $('#say'), prompt = $('#prompt'), inkEl = $('#ink'), book = $('#carnet'), v = new THREE.Vector3();
  let anchor = null, sayTimer = 0, pending = null;
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
    // une page du carnet : on capture l'image juste après le prochain dessin, on l'encre en noir et blanc
    page(caption) { pending = caption; },
    capture() {
      if (!pending) return;
      const c = document.createElement('canvas'), w = 520, h = Math.round((w * canvas.height) / canvas.width);
      c.width = w; c.height = h; const x = c.getContext('2d');
      x.filter = 'grayscale(1) contrast(1.7) brightness(1.08) sepia(.25)'; x.drawImage(canvas, 0, 0, w, h);
      pages.push({ img: c.toDataURL('image/jpeg', 0.72), caption: pending }); keep('hollow-carnet', pages);
      toastPage(pending); pending = null;
    },
    get pages() { return pages; },
    toggleBook() {
      book.hidden = !book.hidden;
      if (!book.hidden) book.innerHTML = `<h2>Carnet du voyageur</h2>${pages.length ? pages.map(p => `<figure><img src="${p.img}" alt=""><figcaption>${p.caption}</figcaption></figure>`).join('') : '<p class="vide">Aucune page encore. Le monde attend d’être vu.</p>'}<small>C pour fermer</small>`;
      return !book.hidden;
    },
    update(dt) {
      if (anchor) { place(say, anchor, 40); sayTimer -= dt; if (sayTimer <= 0) { say.classList.remove('on'); anchor = null; } }
    },
  };
  function toastPage(text) { const t = $('#pagetoast'); t.textContent = `Une page s’ajoute au carnet : « ${text} »`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
  addEventListener('keydown', e => { if (e.code === 'KeyC') ui.toggleBook(); });
  return ui;
}
export const save = { load, keep };
