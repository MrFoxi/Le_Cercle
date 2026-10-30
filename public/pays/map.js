// Carte du monde interactive (SVG + d3) : vraies frontières, zoom, déplacement, repères pour les petits pays.
/* global d3 */
const W = 960, H = 500;
const markerPx = () => (innerWidth < 600 ? 5 : 7); // rayon à l'écran des repères des petits pays, quel que soit le zoom
const SMALL_AREA = 15; // en px² sur la carte non zoomée : en dessous, le pays reçoit un repère cliquable

// Plus grand morceau d'un pays (ex. la métropole pour la France) : sert à placer repères et cadrages.
function mainPart(f) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polys = f.geometry.coordinates.map(coordinates => ({ type: 'Polygon', coordinates }));
  return polys.reduce((a, b) => (d3.geoArea(b) > d3.geoArea(a) ? b : a));
}

export function createMap(svgEl, features, { onPick, onHover }) {
  const projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features });
  const path = d3.geoPath(projection);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.selectAll('*').remove();
  svg.append('rect').attr('class', 'ocean').attr('width', W).attr('height', H);
  const g = svg.append('g');

  const byId = new Map();
  g.selectAll('path').data(features).join('path')
    .attr('d', path)
    .attr('class', d => (d.properties.q ? 'country' : 'territory'))
    .each(function (d) { byId.set(d.id, { el: this, f: d, center: path.centroid(mainPart(d)) }); });

  const small = features.filter(f => f.properties.q && path.area(f) < SMALL_AREA);
  g.selectAll('circle.marker').data(small).join('circle')
    .attr('class', 'marker')
    .attr('cx', d => byId.get(d.id).center[0])
    .attr('cy', d => byId.get(d.id).center[1])
    .each(function (d) { byId.get(d.id).marker = this; });

  // Taille d'un pixel écran en unités de carte, pour garder repères et animations à taille constante.
  let k = 1;
  const unit = () => W / (svgEl.clientWidth || W) / k;
  const resizeMarkers = () => g.selectAll('circle.marker').attr('r', markerPx() * unit());

  const zoom = d3.zoom()
    .scaleExtent([1, 60])
    .translateExtent([[0, 0], [W, H]])
    .clickDistance(6) // un glisser de la carte ne compte pas comme un clic
    .on('zoom', e => {
      k = e.transform.k;
      g.attr('transform', e.transform);
      resizeMarkers();
    });
  svg.call(zoom).on('dblclick.zoom', null); // un double-clic ne doit pas valider deux réponses
  new ResizeObserver(resizeMarkers).observe(svgEl);
  resizeMarkers();

  const idOf = e => e.target.closest('.country, .marker, .territory');
  // On lit l'élément sous le point exact du doigt ou de la souris : l'événement « click » du navigateur
  // est recalé sur un pays voisin quand on tape près d'une frontière sur mobile.
  let down = null;
  svg.on('pointerdown', e => {
    down = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null; // 2e doigt = pincement
  });
  svg.on('pointerup', e => {
    const tap = down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
    down = null;
    if (!tap) return; // glisser ou pincer la carte n'est pas une réponse
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.country, .marker');
    const d = el && d3.select(el).datum();
    if (d?.properties?.q && !el.classList.contains('out')) onPick(d.id);
  });
  svg.on('pointermove', e => {
    const el = idOf(e);
    const d = el && d3.select(el).datum();
    onHover(d?.properties ? d : null, e);
  });
  svg.on('pointerleave', () => onHover(null));

  const each = (id, fn) => { const c = byId.get(id); if (c) { fn(c.el); if (c.marker) fn(c.marker); } };

  // Vue de départ : sur un écran en hauteur (téléphone), on zoome pour que la carte remplisse l'écran.
  function home() {
    const ratio = (svgEl.clientHeight / (svgEl.clientWidth || 1)) * (W / H);
    const s = Math.min(4, ratio);
    if (s <= 1) return d3.zoomIdentity; // écran large : la carte entière tient
    return d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-W * 0.53, -H * 0.47);
  }

  function zoomToIds(ids, duration = 650) {
    const boxes = ids.map(id => byId.get(id)).filter(Boolean).map(c => path.bounds(mainPart(c.f)));
    if (!boxes.length) return;
    const [x0, y0, x1, y1] = [Math.min(...boxes.map(b => b[0][0])), Math.min(...boxes.map(b => b[0][1])),
      Math.max(...boxes.map(b => b[1][0])), Math.max(...boxes.map(b => b[1][1]))];
    const scale = Math.max(1, Math.min(8, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(duration).call(zoom.transform, t);
  }

  return {
    // État d'un pays : 'found' (vert), 'revealed' (orange, passé), ou retiré.
    setState(id, cls, on = true) { each(id, el => el.classList.toggle(cls, on)); },
    flash(id, cls, ms = 700) {
      each(id, el => {
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), ms);
      });
    },
    // Grise et rend inactifs les pays hors de la zone jouée.
    setScope(ids) {
      const keep = new Set(ids);
      for (const [id, c] of byId) {
        const out = c.f.properties.q && !keep.has(id);
        c.el.classList.toggle('out', out);
        if (c.marker) c.marker.classList.toggle('out', out);
      }
    },
    clear() { for (const [id] of byId) each(id, el => el.classList.remove('found', 'revealed', 'wrong', 'good')); },
    // Cercle qui se resserre sur un pays, pour montrer où il se trouvait.
    ping(id) {
      const c = byId.get(id);
      if (!c) return;
      g.append('circle').attr('class', 'ping').attr('cx', c.center[0]).attr('cy', c.center[1])
        .attr('r', 60 * unit()).attr('stroke-width', 3 * unit())
        .transition().duration(900).ease(d3.easeCubicOut).attr('r', 8 * unit())
        .transition().duration(400).style('opacity', 0).remove();
    },
    zoomToIds,
    zoomBy: f => svg.transition().duration(250).call(zoom.scaleBy, f),
    reset: (duration = 650) => svg.transition().duration(duration).call(zoom.transform, home()),
  };
}
