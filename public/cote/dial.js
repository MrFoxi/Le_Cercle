// Le demi-cercle : cadran MAUVAIS (0) → BON (100), graduations, aiguille déplaçable (souris, doigt, clavier)
// et roue de révélation qui tourne autour du pivot puis s'arrête sur la position secrète.
const NS = 'http://www.w3.org/2000/svg';
const CX = 220, CY = 222, R = 190; // pivot et rayon du cadran, en unités du viewBox
const BANDS = [[40, 1], [30, 2], [20, 3], [10, 4], [5, 5]]; // demi-largeur de la zone -> points
const SPIN_MS = 3600;

// Valeur 0..100 -> point : 0 à gauche, 50 en haut, 100 à droite.
const rad = v => Math.PI * (1 - v / 100);
const pt = (v, r) => [CX + r * Math.cos(rad(v)), CY - r * Math.sin(rad(v))];
const clamp = v => Math.max(0, Math.min(100, v));
const deg = v => (v - 50) * 1.8; // rotation (en degrés) d'un élément dessiné à 50 pour l'amener à v

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
  svg.setAttribute('viewBox', '-16 -34 472 296'); // marges pour les graduations et « NEUTRE »
  svg.innerHTML = `<defs>
    <linearGradient id="dialGrad" x1="${CX - R}" x2="${CX + R}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0c0c0e"/><stop offset=".22" stop-color="#2c2620"/><stop offset=".5" stop-color="#9a7434"/>
      <stop offset=".78" stop-color="#f5d27a"/><stop offset="1" stop-color="#fff1c4"/></linearGradient>
    <clipPath id="dialHalf"><path d="M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY} Z"/></clipPath></defs>`;
  el('path', { d: `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY} Z`, class: 'face' }, svg);

  // Roue : dessinée centrée sur 50 (en haut), puis tournée jusqu'à la position. Le cadran la coupe en demi-cercle.
  const wheelClip = el('g', { 'clip-path': 'url(#dialHalf)' }, svg);
  const wheel = el('g', { class: 'wheel hidden' }, wheelClip);
  for (let a = 0; a < 360; a += 15) {
    const t = (a * Math.PI) / 180;
    el('line', { x1: CX, y1: CY, x2: CX + R * Math.cos(t), y2: CY + R * Math.sin(t), class: 'spoke' }, wheel);
  }
  for (const [w, p] of BANDS) el('path', { d: wedge(50 - w, 50 + w, R - 2), class: `band b${p}` }, wheel);
  for (const [w, p] of BANDS) {
    const inner = BANDS.find(b => b[1] === p + 1)?.[0]; // le chiffre se place entre sa bande et la suivante, plus fine
    for (const v of p === 5 ? [50] : [50 - (w + inner) / 2, 50 + (w + inner) / 2]) {
      const [x, y] = pt(v, R - 24);
      el('text', { x, y: y + 5, class: 'band-label' }, wheel).textContent = p;
    }
  }
  el('line', { x1: CX, y1: CY, x2: CX, y2: CY - R + 4, class: 'secret-line' }, wheel);
  el('path', { d: `M${CX - 9},${CY - R - 2} L${CX + 9},${CY - R - 2} L${CX},${CY - R + 14} Z`, class: 'secret-mark' }, wheel);

  const ticks = el('g', { class: 'ticks' }, svg);
  for (let v = 0; v <= 100; v += 2) {
    const big = v % 10 === 0, [x1, y1] = pt(v, R + 4), [x2, y2] = pt(v, R + (big ? 11 : 7));
    el('line', { x1, y1, x2, y2, class: big ? 'big' : '' }, ticks);
    if (big) {
      const [tx, ty] = pt(v, R + 20);
      el('text', { x: tx, y: ty + 3 }, ticks).textContent = v;
    }
  }
  el('path', { d: `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`, class: 'rim' }, svg);
  el('text', { x: CX - R + 40, y: CY + 32, class: 'side bad' }, svg).textContent = 'MAUVAIS';
  el('text', { x: CX, y: CY - R - 34, class: 'side neutral' }, svg).textContent = 'NEUTRE';
  el('text', { x: CX + R - 30, y: CY + 32, class: 'side good' }, svg).textContent = 'BON';

  // Écart entre la réponse et la position secrète, dessiné le long du bord après la révélation.
  const gap = el('g', { class: 'gap hidden' }, svg);
  const gapArc = el('path', { class: 'gap-arc' }, gap);
  const gapText = el('text', { class: 'gap-label' }, gap);

  const needle = el('g', { class: 'needle' }, svg);
  el('path', { d: `M${CX - 7},${CY} L${CX},${CY - R + 12} L${CX + 7},${CY} Z` }, needle);
  el('circle', { cx: CX, cy: CY, r: 16, class: 'pivot' }, svg);
  el('circle', { cx: CX, cy: CY, r: 6, class: 'pivot-dot' }, svg);

  let value = 50, interactive = false, spin = null;

  function set(v, animate = true) {
    value = clamp(v);
    needle.classList.toggle('instant', !animate);
    needle.style.transform = `rotate(${deg(value)}deg)`;
    svg.setAttribute('aria-valuenow', Math.round(value));
  }

  function showGap(target, guess) {
    const [a, b] = [Math.min(target, guess), Math.max(target, guess)];
    const [x1, y1] = pt(a, R - 8), [x2, y2] = pt(b, R - 8), [lx, ly] = pt((a + b) / 2, R * 0.58);
    gapArc.setAttribute('d', b - a < 0.5 ? '' : `M${x1},${y1} A${R - 8},${R - 8} 0 0 1 ${x2},${y2}`);
    gapText.setAttribute('x', lx);
    gapText.setAttribute('y', ly);
    gapText.textContent = b - a ? `écart ${Math.round(b - a)}` : 'en plein dans le mille !';
    gap.classList.remove('hidden');
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
  svg.setAttribute('aria-label', 'Position sur l’échelle, de MAUVAIS (0) à BON (100)');
  set(50, false);

  return {
    get value() { return value; },
    set,
    // Affiche (ou cache, avec null) la zone secrète, sans animation.
    setTarget(t) {
      spin?.cancel();
      wheel.classList.toggle('hidden', t === null || t === undefined);
      svg.classList.toggle('revealing', t !== null && t !== undefined);
      wheel.classList.remove('landed');
      gap.classList.add('hidden');
      if (t !== null && t !== undefined) wheel.style.transform = `rotate(${deg(t)}deg)`;
    },
    // Révélation : la roue tourne vite, ralentit et s'arrête pile sur la position secrète, puis l'écart s'affiche.
    reveal(target, guess) {
      const end = deg(target), start = end - 360 * 5 - 120;
      wheel.classList.remove('hidden', 'landed');
      svg.classList.add('revealing');
      gap.classList.add('hidden');
      spin?.cancel();
      const done = () => {
        wheel.style.transform = `rotate(${end}deg)`;
        wheel.classList.add('landed');
        showGap(target, guess);
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done(), Promise.resolve();
      spin = wheel.animate([{ transform: `rotate(${start}deg)` }, { transform: `rotate(${end}deg)` }],
        { duration: SPIN_MS, easing: 'cubic-bezier(.12, .7, .16, 1)', fill: 'forwards' });
      return spin.finished.then(done, () => {});
    },
    setInteractive(on) {
      interactive = on;
      svg.classList.toggle('interactive', on);
      svg.tabIndex = on ? 0 : -1;
    },
    showNeedle(on) { needle.classList.toggle('hidden', !on); },
  };
}
