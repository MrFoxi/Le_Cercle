// Le demi-cercle : cadran bleu → rouge, graduations, zone secrète, aiguille déplaçable (souris, doigt, clavier).
const NS = 'http://www.w3.org/2000/svg';
const CX = 220, CY = 222, R = 190; // centre (pivot) et rayon du cadran, en unités du viewBox
const BANDS = [[40, 1], [30, 2], [20, 3], [10, 4], [5, 5]]; // demi-largeur de la zone -> points

// Valeur 0..100 -> angle : 0 à gauche, 50 en haut, 100 à droite.
const angle = v => Math.PI * (1 - v / 100);
const pt = (v, r) => [CX + r * Math.cos(angle(v)), CY - r * Math.sin(angle(v))];
const clamp = v => Math.max(0, Math.min(100, v));

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}
const wedge = (a, b, r) => {
  const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r);
  return `M${CX},${CY} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`;
};

export function createDial(svg, { onChange } = {}) {
  svg.setAttribute('viewBox', '-16 0 472 262'); // marge pour les graduations 0 et 100
  // Un seul dégradé : bleu profond à gauche, presque blanc au milieu, rouge vif à droite.
  svg.innerHTML = `<defs><linearGradient id="dialGrad" x1="${CX - R}" x2="${CX + R}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1d56d8"/><stop offset=".3" stop-color="#6f9bf2"/><stop offset=".5" stop-color="#eef1f7"/>
    <stop offset=".7" stop-color="#f08a92"/><stop offset="1" stop-color="#e0202f"/></linearGradient></defs>`;
  el('path', { d: `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY} Z`, class: 'face' }, svg);

  const target = el('g', { class: 'target' }, svg);

  const ticks = el('g', { class: 'ticks' }, svg);
  for (let v = 0; v <= 100; v += 2) {
    const big = v % 10 === 0, [x1, y1] = pt(v, R + 4), [x2, y2] = pt(v, R + (big ? 16 : 10));
    el('line', { x1, y1, x2, y2, class: big ? 'big' : '' }, ticks);
    if (big) {
      const [tx, ty] = pt(v, R + 28);
      el('text', { x: tx, y: ty + 4 }, ticks).textContent = v;
    }
  }
  el('path', { d: `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`, class: 'rim' }, svg);
  el('text', { x: CX - R + 40, y: CY + 32, class: 'side low' }, svg).textContent = 'SOUS-COTÉ';
  el('text', { x: CX + R - 40, y: CY + 32, class: 'side high' }, svg).textContent = 'SURCOTÉ';

  const needle = el('g', { class: 'needle' }, svg);
  el('path', { d: `M${CX - 7},${CY} L${CX},${CY - R + 12} L${CX + 7},${CY} Z` }, needle);
  el('circle', { cx: CX, cy: CY, r: 16, class: 'pivot' }, svg);
  el('circle', { cx: CX, cy: CY, r: 6, class: 'pivot-dot' }, svg);

  let value = 50, interactive = false;

  function set(v, animate = true) {
    value = clamp(v);
    needle.classList.toggle('instant', !animate);
    needle.style.transform = `rotate(${(value - 50) * 1.8}deg)`;
    svg.setAttribute('aria-valuenow', Math.round(value));
  }

  // Zone secrète : bandes de points autour de la position, de la plus large (1 pt) à la plus fine (5 pts).
  function setTarget(t, reveal = false) {
    target.innerHTML = '';
    target.classList.toggle('reveal', reveal);
    if (t === null || t === undefined) return;
    for (const [w, p] of BANDS) {
      el('path', { d: wedge(clamp(t - w), clamp(t + w), R - 2), class: `band b${p}` }, target);
    }
    for (const [w, p] of BANDS) {
      const inner = BANDS.find(b => b[1] === p + 1)?.[0]; // le chiffre se place entre sa bande et la suivante, plus fine
      for (const v of p === 5 ? [t] : [t - (w + inner) / 2, t + (w + inner) / 2]) {
        if (v < 0 || v > 100) continue;
        const [x, y] = pt(v, R - 22);
        el('text', { x, y: y + 5, class: 'band-label' }, target).textContent = p;
      }
    }
  }

  // Position du pointeur -> valeur ; sous la ligne de base, on reste collé à l'extrémité la plus proche.
  function fromPointer(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const a = Math.atan2(Math.max(0, CY - p.y), p.x - CX);
    return clamp(100 - (a / Math.PI) * 100);
  }
  const move = e => {
    set(fromPointer(e), false);
    onChange?.(value);
  };
  svg.addEventListener('pointerdown', e => {
    if (!interactive) return;
    svg.setPointerCapture(e.pointerId);
    move(e);
  });
  svg.addEventListener('pointermove', e => interactive && svg.hasPointerCapture(e.pointerId) && move(e));
  svg.addEventListener('keydown', e => {
    if (!interactive) return;
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (!step) return;
    e.preventDefault();
    set(value + step * (e.shiftKey ? 5 : 1));
    onChange?.(value);
  });

  svg.setAttribute('role', 'slider');
  svg.setAttribute('aria-valuemin', 0);
  svg.setAttribute('aria-valuemax', 100);
  svg.setAttribute('aria-label', 'Position sur l’échelle, de sous-coté (0) à surcoté (100)');
  set(50, false);

  return {
    get value() { return value; },
    set,
    setTarget,
    setInteractive(on) {
      interactive = on;
      svg.classList.toggle('interactive', on);
      svg.tabIndex = on ? 0 : -1;
    },
    showNeedle(on) { needle.classList.toggle('hidden', !on); },
  };
}
