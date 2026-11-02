// Rendu 3D de Prop Hunt : les cartes construites avec les modèles de Little District (place japonaise, villa moderne avec
// piscine, port de pêche), à l'heure dorée ou de nuit (lanternes, lampe torche des chasseurs). Caméra à la 3e personne qui ne
// traverse pas les murs. Visée au centre de l'écran ; effets : confettis, moqueries, radar, objets marqués qui scintillent.
import * as THREE from 'three';
import { TEX, MATS, buildBuilding, makeDecor, makePerson, bake, seeded, std, box, cyl, ball, shape, G, canvasTex, textured } from '/district/models.js';

const PH = window.PH;

// Objets propres à Prop Hunt (absents de Little District) : parasol, ballon de plage, filet de pêche, tonneau.
function extraDecor(type) {
  const g = new THREE.Group();
  if (type === 'parasol') {
    cyl(g, 0.02, 1.15, std('#d8d4cc', { metalness: 0.5 }), 0, 0, 0);
    const tex = canvasTex('parasolStripes', 64, 64, (x, w, h) => { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#f4f2ee' : '#26282c'; x.beginPath(); x.moveTo(w / 2, h / 2); x.arc(w / 2, h / 2, w, k / 8 * Math.PI * 2, (k + 1) / 8 * Math.PI * 2); x.fill(); } });
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.22, 16, 1, true), textured('parasolTop', tex, { side: THREE.DoubleSide }));
    top.position.y = 1.15; g.add(top); box(g, 0.3, 0.04, 0.3, std('#26282c'), 0, 0, 0);
  } else if (type === 'ballon') {
    const tex = canvasTex('beachball', 64, 32, (x, w, h) => ['#e8432e', '#f4f2ee', '#2a5fa8', '#f4f2ee', '#f2c14e', '#f4f2ee'].forEach((c, k) => { x.fillStyle = c; x.fillRect(k * w / 6, 0, w / 6 + 1, h); }));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), textured('beachballM', tex, { roughness: 0.4 })); b.position.y = 0.14; g.add(b);
  } else if (type === 'filet') {
    const tex = canvasTex('net', 128, 128, (x, w, h) => { x.fillStyle = '#5a6a5a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c8c0a0'; x.lineWidth = 2; for (let k = 0; k <= w; k += 12) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 30, h); x.stroke(); x.beginPath(); x.moveTo(k + 30, 0); x.lineTo(k, h); x.stroke(); } }, { repeat: [2, 2] });
    shape(g, G.ico, textured('netM', tex, { roughness: 1, flatShading: true }), 0, 0.1, 0, 0.7, 0.3, 0.55);
    for (const [x, z] of [[-0.2, 0.15], [0.15, -0.12], [0.25, 0.2]]) ball(g, 0.05, std('#f08a2e', { roughness: 0.5 }), x, 0.24, z);
  } else if (type === 'tonneau') {
    cyl(g, 0.16, 0.42, textured('barrel', TEX.wood('#7a5434')), 0, 0, 0);
    for (const y of [0.08, 0.32]) cyl(g, 0.165, 0.03, std('#333'), 0, y, 0);
  } else return null;
  return g;
}
const MAKE = type => (type === 'palmier' ? makeDecor('cerisier') : extraDecor(type) ?? makeDecor(type));

// Sols
const GROUND_TEX = {
  slab: () => TEX.slab(),
  lawn: () => canvasTex('lawn', 256, 256, (x, w, h) => { x.fillStyle = '#6fa04a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 2; k++) { x.fillStyle = k ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'; x.fillRect(0, k * h / 2, w, h / 2); } for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,70,20' : '190,230,130'},${Math.random() * 0.25})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 3); } }),
  deck: () => canvasTex('poolDeck', 256, 256, (x, w, h) => { x.fillStyle = '#ece6da'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2; for (let k = 0; k <= w; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, h); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(w, k); x.stroke(); } for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
  cobble: () => canvasTex('cobble', 256, 256, (x, w, h) => { x.fillStyle = '#b8a888'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 22) for (let px = (y / 22) % 2 ? -11 : 0; px < w; px += 22) { x.fillStyle = `hsl(${30 + Math.random() * 12}, ${18 + Math.random() * 10}%, ${58 + Math.random() * 14}%)`; x.beginPath(); x.roundRect(px + 2, y + 2, 19, 19, 5); x.fill(); } }),
  planks: () => TEX.wood('#8a6a4a'),
};

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3b98a');
  scene.fog = new THREE.Fog('#f0b48a', 18, 55);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 160);
  const hemi = new THREE.HemisphereLight('#ffe2c4', '#5a4a6a', 1.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc98f', 2.6);
  sun.position.set(-14, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const setGlow = k => { for (const m of MATS.values()) if (m.userData.glow) m.emissiveIntensity = m.userData.glow.day + (m.userData.glow.night - m.userData.glow.day) * k; };

  // La carte : tout ce qui change d'un lieu à l'autre est dans ce groupe.
  let map = null, mapGroup = new THREE.Group(), solid = [], decorObjs = [], pools = new THREE.Group(), circles = [], water = [];
  scene.add(mapGroup);
  const protos = new Map();
  const proto = type => { const k = `${map.id}:${type}`; if (!protos.has(k)) protos.set(k, bake(MAKE(type))); return protos.get(k); };
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,200,120,.75)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  let loading = null, night = false;

  async function loadMap(id) {
    if (map?.id === id) return;
    if (loading?.id === id) return loading.p;
    const p = (async () => {
      const m = PH.get(id);
      const S = await import(`/district/styles.js?quartier=${m.style}`);
      S.install(); // les modèles du bon quartier
      scene.remove(mapGroup);
      mapGroup = new THREE.Group(); solid = []; decorObjs = []; circles = m.circles; water = [];
      map = m;
      // Sols (du plus large au plus petit, légèrement superposés)
      m.ground.forEach((gr, k) => {
        const t = GROUND_TEX[gr.kind]().clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping;
        const w = gr.x1 - gr.x0, d = gr.z1 - gr.z0, tile = gr.kind === 'planks' ? 1.4 : gr.kind === 'deck' ? 2.4 : 1.9;
        t.repeat.set(w / tile, d / tile); t.needsUpdate = true;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.set((gr.x0 + gr.x1) / 2, 0.002 * k, (gr.z0 + gr.z1) / 2); mesh.receiveShadow = true;
        mapGroup.add(mesh);
      });
      // Eau : piscine (avec margelle) ou mer (sous le quai, avec des bateaux)
      for (const wt of m.water) {
        const sea = wt.kind === 'mer', w = wt.x1 - wt.x0, d = wt.z1 - wt.z0;
        const mat = new THREE.MeshStandardMaterial({ color: sea ? '#1f8fa8' : '#3fc8e0', roughness: 0.08, metalness: 0.25, emissive: sea ? '#06303a' : '#0c5a6a', emissiveIntensity: 0.5, transparent: true, opacity: 0.92 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set((wt.x0 + wt.x1) / 2, sea ? -0.3 : 0.03, (wt.z0 + wt.z1) / 2);
        mapGroup.add(mesh); water.push(mesh);
        if (!sea) for (const [x, z, ww, dd] of [[(wt.x0 + wt.x1) / 2, wt.z0, w + 0.3, 0.15], [(wt.x0 + wt.x1) / 2, wt.z1, w + 0.3, 0.15], [wt.x0, (wt.z0 + wt.z1) / 2, 0.15, d], [wt.x1, (wt.z0 + wt.z1) / 2, 0.15, d]]) box(mapGroup, ww, 0.06, dd, std('#f4f2ee'), x, 0, z);
        else { // mur du quai et poteaux des pontons
          const q = Math.min(...m.water.map(x => x.z0));
          box(mapGroup, m.HALF * 2 + 6, 0.35, 0.3, std('#8d8a83', { roughness: 0.95 }), 0, -0.35, q);
          for (const g of m.ground.filter(g => g.kind === 'planks' && g.z0 >= q)) for (let z = g.z0 + 1; z < g.z1; z += 2) for (const x of [g.x0, g.x1]) cyl(mapGroup, 0.08, 0.7, std('#5a4232'), x, -0.6, z);
        }
      }
      for (const b of m.boats) { const g = new THREE.Group(); S.boatModel(g, ['#f4f1ea', '#2f6fa8', '#c8402e'][Math.abs(Math.round(b.x)) % 3], Math.abs(Math.round(b.z)) % 2 === 0, 2.6); g.position.set(b.x, -0.32, b.z); g.rotation.y = b.ry; mapGroup.add(g); }
      // Bâtiments
      for (const b of m.buildings) {
        const g = bake(buildBuilding(b.type, 6, b.d, b.w).group);
        g.position.set(b.x, 0, b.z); g.rotation.y = b.ry;
        g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
        mapGroup.add(g); solid.push(g);
      }
      for (const c of m.circles) { const g = bake(makeDecor(c.kind)); g.scale.setScalar(c.scale ?? 1); g.position.set(c.x, 0, c.z); mapGroup.add(g); solid.push(g); }
      // Objets du décor : chacun garde son numéro pour la visée
      for (const d of m.decor) {
        const g = proto(d.type).clone();
        g.position.set(d.x, 0, d.z); g.rotation.y = d.ry;
        g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.decor = d.id; } });
        mapGroup.add(g); decorObjs.push(g);
      }
      // Flaques de lumière (la nuit) sous les lampes et devant les façades
      pools = new THREE.Group(); pools.visible = night; mapGroup.add(pools);
      for (const d of m.decor) if (['lampe', 'toro', 'vending'].includes(d.type)) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); q.rotation.x = -Math.PI / 2; q.position.set(d.x, 0.02, d.z); q.scale.setScalar(d.type === 'lampe' ? 4.5 : 2.4); pools.add(q); }
      for (const b of m.buildings) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); q.rotation.x = -Math.PI / 2; q.position.set(b.x + Math.sin(b.ry) * (b.d / 2 + 0.8), 0.02, b.z + Math.cos(b.ry) * (b.d / 2 + 0.8)); q.scale.set(4.5, 2.5, 1); q.rotation.z = -b.ry; pools.add(q); }
      scene.add(mapGroup);
      setGlow(night ? 1 : 0.55);
      for (const p of people.values()) p.type = undefined; // les déguisements se refont avec les modèles de cette carte
    })();
    loading = { id, p };
    await p;
    loading = null;
  }

  const torch = new THREE.SpotLight('#fff3d6', 0, 16, 0.42, 0.5, 1.2); torch.castShadow = false;
  scene.add(torch, torch.target);
  let torchOn = false;
  // Anneau lumineux sous l'objet visé (pour savoir en quoi on va se transformer)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  // Étincelles au-dessus des objets marqués par une grenade à confettis
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✨', 32, 34); return new THREE.CanvasTexture(c); })();
  const sparks = new Map();

  // Joueurs : un passant (humain), ou l'objet dont il a pris la forme.
  const people = new Map();
  function player(name, color, hunter) {
    const p = { name, form: null, type: null, walk: 0, hunter };
    people.set(name, p);
    return p;
  }
  function setForm(p, type, color) {
    if (p.form) scene.remove(p.form);
    p.type = type;
    if (type) {
      p.form = proto(type).clone();
      p.form.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.player = p.name; } });
      p.person = null;
    } else {
      const m = makePerson(seeded(p.name.length * 131 + p.name.charCodeAt(0)), p.hunter ? '#c8321f' : color);
      if (p.hunter) { // casquette de chasseur
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 12), std('#1c1c1c')); cap.position.set(0, 0.6, 0); m.root.add(cap);
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.07), std('#1c1c1c')); brim.position.set(0, 0.585, 0.06); m.root.add(brim);
      }
      p.form = m.root; p.person = m;
      p.form.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.player = p.name; } });
    }
    scene.add(p.form);
  }

  // Effets : confettis (trouvé), fumée rouge (raté), moqueries (émoji), radar, anneaux
  const fx = [];
  const noteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#3a1a5a'; g.lineWidth = 5; g.strokeText('♪', 32, 34); g.fillText('♪', 32, 34); return new THREE.CanvasTexture(c); })();
  const EMOJI = { canard: '🦆', pet: '💨', rire: '😂', coucou: '👋', sifflet: '🎵' };
  const emojiTex = new Map();
  const emoji = e => { if (!emojiTex.has(e)) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70); emojiTex.set(e, new THREE.CanvasTexture(c)); } return emojiTex.get(e); };
  function ringFx(x, z, color, max, life, h = 0.05) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, h, z); scene.add(m);
    fx.push({ items: [], ring: m, max, t: 0, life });
  }
  function burst(x, z, kind, taunt) {
    if (kind === 'radar') return ringFx(x, z, '#3ff0ff', 7, 1.2);
    if (kind === 'ping') { for (let k = 0; k < 3; k++) setTimeout(() => ringFx(x, z, '#ff3b3b', 1.2, 0.9, 0.08), k * 350); return; }
    if (kind === 'taunt') {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoji(EMOJI[taunt] ?? '🎵'), transparent: true, depthWrite: false }));
      m.scale.setScalar(0.9); m.position.set(x, 1.3, z); scene.add(m);
      fx.push({ items: [{ m, vx: 0, vy: 0.35, vz: 0, g: 0 }], t: 0, life: 2.4 });
      return;
    }
    if (kind === 'grenade') { ringFx(x, z, '#ffd84d', 3, 0.7); kind = 'found'; }
    const n = kind === 'found' ? 60 : kind === 'whistle' ? 5 : 18, items = [];
    for (let k = 0; k < n; k++) {
      let m;
      if (kind === 'whistle') m = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: ['#ffd84d', '#ff7ab8', '#7ad7ff'][k % 3], transparent: true, depthWrite: false }));
      else m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.01), new THREE.MeshBasicMaterial({ color: kind === 'found' ? ['#ff5a5f', '#ffc93c', '#2fd47a', '#3d8bff', '#f472b6'][k % 5] : '#c0392b', transparent: true }));
      m.scale.setScalar(kind === 'whistle' ? 0.35 : kind === 'miss' ? 2.5 : 1);
      m.position.set(x, kind === 'whistle' ? 0.8 + k * 0.25 : 0.5, z);
      const a = Math.random() * 6.28, v = kind === 'found' ? 1.5 + Math.random() * 2.5 : 0.4;
      items.push({ m, vx: Math.cos(a) * v * (kind === 'whistle' ? 0.2 : 1), vy: kind === 'whistle' ? 0.6 : 2 + Math.random() * 2, vz: Math.sin(a) * v * (kind === 'whistle' ? 0.2 : 1), g: kind === 'found' ? 5 : kind === 'miss' ? -0.5 : 0 });
      scene.add(m);
    }
    fx.push({ items, t: 0, life: kind === 'whistle' ? 2.2 : 1.6 });
  }

  // Caméra 3e personne : derrière le joueur, au-dessus de l'épaule, raccourcie si un mur est entre les deux.
  const ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), center = new THREE.Vector2(0, 0);
  const cam = { yaw: 0, pitch: 0.35, dist: 2.1 };
  function placeCamera(x, z, h = 0.55) {
    const target = new THREE.Vector3(x + Math.cos(cam.yaw) * 0.32, h, z - Math.sin(cam.yaw) * 0.32);
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    ray.set(target, dir); ray.far = cam.dist;
    const hit = ray.intersectObjects(solid, true)[0];
    const d = hit ? Math.max(0.3, hit.distance - 0.15) : cam.dist;
    camera.position.copy(target).addScaledVector(dir, d);
    camera.position.y = Math.max(0.12, camera.position.y);
    // au-dessus d'un bassin (fontaine) plutôt que dedans
    for (const c of circles) if (Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < c.r * 1.4 + 0.4) camera.position.y = Math.max(camera.position.y, 1.5);
    camera.lookAt(target.x, target.y + 0.12, target.z);
  }

  return {
    cam, scene, loadMap,
    get mapId() { return map?.id ?? null; },
    resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    // list : [{ name, color, hunter, x, z, ry, type, alive, moving, marked }]
    update(list, focus, dt, time) {
      if (!map) return;
      const seen = new Set();
      for (const o of list) {
        seen.add(o.name);
        const p = people.get(o.name) ?? player(o.name, o.color, o.hunter);
        if (p.hunter !== o.hunter) { p.hunter = o.hunter; p.type = undefined; }
        if (p.type !== (o.type || null) || !p.form) setForm(p, o.type || null, o.color);
        p.form.visible = o.alive;
        p.form.position.set(o.x, 0, o.z);
        p.form.rotation.y = o.ry;
        if (p.person) { // marche : bras et jambes qui balancent
          p.walk += dt * (o.moving ? 11 : 0);
          const s = o.moving ? Math.sin(p.walk) * 0.6 : 0;
          p.person.legL.rotation.x = s; p.person.legR.rotation.x = -s; p.person.armL.rotation.x = -s * 0.8; p.person.armR.rotation.x = s * 0.8;
        }
        let sp = sparks.get(o.name);
        if (o.marked && o.alive) {
          if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false })); scene.add(sp); sparks.set(o.name, sp); }
          sp.position.set(o.x, (o.type ? map.PROPS[o.type]?.h ?? 0.7 : 0.7) + 0.35 + Math.sin(time * 6) * 0.08, o.z); sp.scale.setScalar(0.45 + Math.sin(time * 9) * 0.08);
        } else if (sp) { scene.remove(sp); sparks.delete(o.name); }
      }
      for (const [n, p] of people) if (!seen.has(n)) { scene.remove(p.form); people.delete(n); const sp = sparks.get(n); if (sp) { scene.remove(sp); sparks.delete(n); } }
      if (ring.visible) ring.material.opacity = 0.55 + Math.sin(time * 7) * 0.3;
      for (const w of water) w.material.emissiveIntensity = 0.45 + Math.sin(time * 1.3) * 0.08; // l'eau scintille un peu
      for (let k = fx.length - 1; k >= 0; k--) {
        const f = fx[k]; f.t += dt;
        if (f.ring) { f.ring.scale.setScalar(0.2 + f.max * f.t / f.life); f.ring.material.opacity = Math.max(0, 1 - f.t / f.life); if (f.t > f.life) { scene.remove(f.ring); fx.splice(k, 1); } continue; }
        for (const it of f.items) { it.vy -= it.g * dt; it.m.position.x += it.vx * dt; it.m.position.y = Math.max(0.02, it.m.position.y + it.vy * dt); it.m.position.z += it.vz * dt; it.m.rotation.x += dt * 8; it.m.material.opacity = Math.max(0, 1 - f.t / f.life); }
        if (f.t > f.life) { for (const it of f.items) scene.remove(it.m); fx.splice(k, 1); }
      }
      if (focus) placeCamera(focus.x, focus.z, focus.h);
      if (torchOn) { // lampe torche : part de la caméra, éclaire là où l'on regarde
        torch.position.copy(camera.position);
        camera.getWorldDirection(tmp); torch.target.position.copy(camera.position).addScaledVector(tmp, 8); torch.target.updateMatrixWorld();
      }
      sun.target.position.set(camera.position.x, 0, camera.position.z); sun.position.set(camera.position.x - 14, 16, camera.position.z + 9); sun.target.updateMatrixWorld();
      renderer.render(scene, camera);
    },
    // Ce qu'on vise au centre de l'écran : un objet du décor, un joueur, ou rien (mur). Ignore son propre personnage.
    aim(me) {
      ray.setFromCamera(center, camera); ray.far = 12;
      const targets = [...decorObjs, ...[...people.values()].filter(p => p.name !== me && p.form?.visible).map(p => p.form), ...solid];
      for (const h of ray.intersectObjects(targets, true)) {
        const u = h.object.userData;
        if (u.player === me) continue;
        if (u.decor !== undefined) return { decor: u.decor, point: h.point };
        if (u.player) return { player: u.player, point: h.point };
        return null; // un mur
      }
      return null;
    },
    burst,
    // Nuit : ciel sombre, lanternes à fond, flaques de lumière ; lampe torche pour les chasseurs.
    setNight(on, flashlight) {
      night = on;
      scene.background.set(on ? '#141a33' : '#f3b98a'); scene.fog.color.set(on ? '#141a33' : '#f0b48a');
      scene.fog.near = on ? 10 : 18; scene.fog.far = on ? 38 : 55;
      hemi.color.set(on ? '#6a7ab8' : '#ffe2c4'); hemi.groundColor.set(on ? '#1a1424' : '#5a4a6a'); hemi.intensity = on ? 0.55 : 1.3;
      sun.color.set(on ? '#9fb2ff' : '#ffc98f'); sun.intensity = on ? 0.45 : 2.6;
      setGlow(on ? 1 : 0.55); pools.visible = on;
      torchOn = on && flashlight; torch.intensity = torchOn ? 40 : 0;
    },
    highlight(decorId) {
      const d = decorId == null || !map ? null : map.decor[decorId];
      ring.visible = !!d && !d.scenery;
      if (d) { ring.position.set(d.x, 0.04, d.z); ring.scale.setScalar(d.r + 0.25); }
    },
    project(x, y, z) { tmp.set(x, y, z).project(camera); return [(tmp.x + 1) / 2 * canvas.clientWidth, (1 - tmp.y) / 2 * canvas.clientHeight, tmp.z < 1 && tmp.z > -1]; },
  };
}
