// Rendu 3D de Prop Hunt : la place japonaise construite avec les modèles de Little District (boutiques, objets, passants),
// à l'heure dorée ou de nuit (lanternes, lampe torche des chasseurs). Caméra à la 3e personne qui ne traverse pas les murs.
// Visée au centre de l'écran ; effets : confettis, moqueries, radar, objets marqués qui scintillent.
import * as THREE from 'three';
import { TEX, MATS, textured, buildBuilding, makeDecor, makePerson, bake, seeded, std } from '/district/models.js';

const M = window.PH;

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
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 120);
  const hemi = new THREE.HemisphereLight('#ffe2c4', '#5a4a6a', 1.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc98f', 2.6);
  sun.position.set(-14, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Sol pavé, ciel, bâtiments, fontaine
  const slab = TEX.slab().clone(); slab.wrapS = slab.wrapT = THREE.RepeatWrapping; slab.repeat.set(16, 16); slab.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(M.HALF * 2 + 6, M.HALF * 2 + 6), new THREE.MeshStandardMaterial({ map: slab, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const solid = []; // ce que la caméra et la visée ne traversent pas
  for (const b of M.buildings) {
    const g = bake(buildBuilding(b.type, 6).group);
    g.position.set(b.x, 0, b.z); g.rotation.y = b.ry;
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.solid = true; } });
    scene.add(g); solid.push(g);
  }
  const fountain = bake(makeDecor('fontaine')); fountain.scale.setScalar(1.35); scene.add(fountain); solid.push(fountain);
  // Lanternes : à moitié allumées à l'heure dorée, à fond la nuit
  const setGlow = k => { for (const m of MATS.values()) if (m.userData.glow) m.emissiveIntensity = m.userData.glow.day + (m.userData.glow.night - m.userData.glow.day) * k; };
  setGlow(0.55);
  // Flaques de lumière au sol sous les lampes et lanternes (la nuit seulement), lampe torche du chasseur
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,200,120,.75)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const pools = new THREE.Group(); pools.visible = false; scene.add(pools);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const d of M.decor) if (['lampe', 'toro', 'vending'].includes(d.type)) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); m.rotation.x = -Math.PI / 2; m.position.set(d.x, 0.02, d.z); m.scale.setScalar(d.type === 'lampe' ? 4.5 : 2.4); pools.add(m); }
  for (const b of M.buildings) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); m.rotation.x = -Math.PI / 2; m.position.set(b.x + Math.sin(b.ry) * (M.BD / 2 + 0.8), 0.02, b.z + Math.cos(b.ry) * (M.BD / 2 + 0.8)); m.scale.set(4.5, 2.5, 1); m.rotation.z = -b.ry; pools.add(m); }
  const torch = new THREE.SpotLight('#fff3d6', 0, 16, 0.42, 0.5, 1.2); torch.castShadow = false;
  scene.add(torch, torch.target);
  let torchOn = false;
  // Anneau lumineux sous l'objet visé (pour savoir en quoi on va se transformer)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  // Étincelles au-dessus des objets marqués par une grenade à confettis
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✨', 32, 34); return new THREE.CanvasTexture(c); })();
  const sparks = new Map();

  // Objets du décor (ceux qu'on peut copier) : chacun garde son numéro pour la visée.
  const decorObjs = [];
  const protos = new Map();
  const proto = type => { if (!protos.has(type)) protos.set(type, bake(makeDecor(type))); return protos.get(type); };
  for (const d of M.decor) {
    const g = proto(d.type).clone();
    g.position.set(d.x, 0, d.z); g.rotation.y = d.ry;
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.decor = d.id; } });
    scene.add(g); decorObjs.push(g);
  }

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

  // Effets : confettis (trouvé), fumée rouge (raté), notes de musique (sifflet)
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

  // Caméra 3e personne : derrière le joueur, raccourcie si un mur est entre les deux.
  const ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), center = new THREE.Vector2(0, 0);
  const cam = { yaw: 0, pitch: 0.35, dist: 2.1 };
  function placeCamera(x, z, h = 0.55) {
    // au-dessus de l'épaule droite : le personnage à gauche, le viseur libre au centre
    const target = new THREE.Vector3(x + Math.cos(cam.yaw) * 0.32, h, z - Math.sin(cam.yaw) * 0.32);
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    ray.set(target, dir); ray.far = cam.dist;
    const hit = ray.intersectObjects(solid, true)[0];
    const d = hit ? Math.max(0.3, hit.distance - 0.15) : cam.dist;
    camera.position.copy(target).addScaledVector(dir, d);
    camera.position.y = Math.max(0.12, camera.position.y);
    // au-dessus du bassin de la fontaine plutôt que dedans
    if (Math.hypot(camera.position.x - M.fountain.x, camera.position.z - M.fountain.z) < M.fountain.r * 1.4 + 0.4) camera.position.y = Math.max(camera.position.y, 1.5);
    camera.lookAt(target.x, target.y + 0.12, target.z);
  }

  return {
    cam, scene,
    resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    // list : [{ name, color, hunter, x, z, ry, type, alive, moving, visible }]
    update(list, focus, dt, time) {
      const seen = new Set();
      for (const o of list) {
        seen.add(o.name);
        const p = people.get(o.name) ?? player(o.name, o.color, o.hunter);
        if (p.hunter !== o.hunter) { p.hunter = o.hunter; p.type = undefined; }
        if (p.type !== (o.type || null) || !p.form) setForm(p, o.type || null, o.color);
        p.form.visible = o.alive && o.visible !== false;
        p.form.position.set(o.x, 0, o.z);
        p.form.rotation.y = o.ry;
        if (p.person) { // marche : bras et jambes qui balancent
          p.walk += dt * (o.moving ? 11 : 0);
          const s = o.moving ? Math.sin(p.walk) * 0.6 : 0;
          p.person.legL.rotation.x = s; p.person.legR.rotation.x = -s; p.person.armL.rotation.x = -s * 0.8; p.person.armR.rotation.x = s * 0.8;
        }
      }
      for (const [n, p] of people) if (!seen.has(n)) { scene.remove(p.form); people.delete(n); }
      for (const o of list) {
        let sp = sparks.get(o.name);
        if (o.marked && o.alive) {
          if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false })); scene.add(sp); sparks.set(o.name, sp); }
          sp.position.set(o.x, (o.type ? M.PROPS[o.type].h : 0.7) + 0.35 + Math.sin(time * 6) * 0.08, o.z); sp.scale.setScalar(0.45 + Math.sin(time * 9) * 0.08);
        } else if (sp) { scene.remove(sp); sparks.delete(o.name); }
      }
      if (ring.visible) { ring.material.opacity = 0.55 + Math.sin(time * 7) * 0.3; }
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
      scene.background.set(on ? '#141a33' : '#f3b98a'); scene.fog.color.set(on ? '#141a33' : '#f0b48a');
      scene.fog.near = on ? 10 : 18; scene.fog.far = on ? 38 : 55;
      hemi.color.set(on ? '#6a7ab8' : '#ffe2c4'); hemi.groundColor.set(on ? '#1a1424' : '#5a4a6a'); hemi.intensity = on ? 0.55 : 1.3;
      sun.color.set(on ? '#9fb2ff' : '#ffc98f'); sun.intensity = on ? 0.45 : 2.6;
      setGlow(on ? 1 : 0.55); pools.visible = on;
      torchOn = on && flashlight; torch.intensity = torchOn ? 40 : 0;
    },
    highlight(decorId) {
      const d = decorId == null ? null : M.decor[decorId];
      ring.visible = !!d;
      if (d) { ring.position.set(d.x, 0.04, d.z); ring.scale.setScalar(d.r + 0.25); }
    },
    project(x, y, z) { tmp.set(x, y, z).project(camera); return [(tmp.x + 1) / 2 * canvas.clientWidth, (1 - tmp.y) / 2 * canvas.clientHeight, tmp.z < 1 && tmp.z > -1]; },
  };
}
