// Prop Hunt : des objets (joueurs déguisés en objets du décor) se cachent, des chasseurs les cherchent.
// Phases d'une manche : cachette (chasseurs aveuglés), chasse, résultat. Les rôles tournent ; une manche sur deux de nuit.
// Chaque navigateur déplace son personnage et envoie sa position ; le serveur tient les rôles, les déguisements,
// les tirs (un objet innocent coûte de la vie au chasseur), les moqueries des objets, les gadgets des chasseurs
// (radar, grenade à confettis) et fait jouer les robots. Testé par jeux/prophunt/prophunt.test.js.
const PH = require('../client/map');

const MAX_PLAYERS = 12;
const SETTINGS = { rounds: [2, 4, 6], hide: [20, 30, 45], hunt: [120, 150, 180, 240], map: ['hasard', ...PH.MAPS] };
const HIDE_MS = 30000, HUNT_MS = 150000, ROUND_END_MS = 7000, TICK_MS = 100;
const TAG_RANGE = 4, MISS_DAMAGE = 12, FOUND_HEAL = 20, TAUNT_CD = 8000, FORCED_WHISTLE = 35000, FORM_CD = 10000;
// Moqueries : plus c'est voyant, plus ça rapporte.
const TAUNTS = { sifflet: 1, canard: 1, pet: 2, rire: 2, coucou: 3 };
const RADAR_RANGE = 7, GRENADE_RANGE = 12, GRENADE_RADIUS = 3, MARK_MS = 6000;
const COLORS = ['#ff5a5f', '#3d8bff', '#ffc93c', '#2fd47a', '#a46bff', '#ff8a3d', '#22d3ee', '#f472b6', '#84cc16', '#f8fafc', '#94a3b8', '#e11d48'];
const BOT_NAMES = ['Robot Théière', 'Robot Pot-de-fleur', 'Robot Lanterne', 'Robot Tabouret', 'Robot Bonsaï', 'Robot Parapluie', 'Robot Sushi', 'Robot Gong', 'Robot Éventail', 'Robot Daruma', 'Robot Origami'];
const num = v => typeof v === 'number' && Number.isFinite(v);

class Room {
  constructor(code, rng = Math.random, isPrivate = false, clock = Date.now) {
    this.code = code;
    this.private = isPrivate;
    this.rng = rng;
    this.clock = clock;
    this.players = []; // { name, connected, bot?, color, points, hunted }
    this.spectators = [];
    this.phase = 'lobby'; // lobby | hide | hunt | roundEnd | over
    this.round = 0;
    this.roundNo = 0;
    this.settings = { rounds: 4, hide: 30, hunt: 150, map: 'hasard' };
    this.mapId = 'place';
    this.wins = {};
    this.timer = null;
  }
  get host() { return this.players.find(p => !p.bot)?.name; }
  get(name) { return this.players.find(p => p.name === name); }
  spectator(name) { return this.spectators.find(s => s.name === name); }
  taken(name) { return !!this.get(name) || !!this.spectator(name); }
  freeColor() { const used = this.players.map(p => p.color); return COLORS.find(c => !used.includes(c)) ?? COLORS[0]; }

  addPlayer(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.phase !== 'lobby') throw new Error('Partie en cours : tu peux la regarder en attendant la suivante');
    if (this.players.length >= MAX_PLAYERS) throw new Error('Ce salon est complet (12 joueurs) : tu peux regarder');
    this.players.push({ name, connected: true, color: this.freeColor(), points: 0, hunted: 0 });
  }
  addSpectator(name) {
    if (this.taken(name)) throw new Error('Ce pseudo est déjà pris dans ce salon');
    if (this.spectators.length >= 30) throw new Error('Trop de spectateurs dans ce salon');
    this.spectators.push({ name, connected: true });
  }
  removeSpectator(name) { this.spectators = this.spectators.filter(s => s.name !== name); }
  removePlayer(name) {
    this.players = this.players.filter(p => p.name !== name);
    if (!this.players.some(p => !p.bot)) { this.players = []; this.stop(); return; }
    if (this.bodies?.[name]) { this.bodies[name].alive = false; this.checkEnd(); }
  }
  hostOnly(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'lobby') throw new Error('Attends la fin de la partie');
  }
  addBot(name) {
    this.hostOnly(name);
    if (this.players.length >= MAX_PLAYERS) throw new Error('Le salon est complet');
    this.players.push({ name: BOT_NAMES.find(n => !this.taken(n)), connected: true, bot: true, color: this.freeColor(), points: 0, hunted: 0 });
  }
  removeBot(name, bot) {
    this.hostOnly(name);
    if (!this.get(bot)?.bot) throw new Error('Ce joueur n’est pas un robot');
    this.players = this.players.filter(p => p.name !== bot);
  }
  configure(name, key, value) {
    this.hostOnly(name);
    if (!SETTINGS[key]?.includes(value)) throw new Error('Réglage invalide');
    this.settings[key] = value;
  }

  start(name) {
    this.hostOnly(name);
    if (this.players.length < 2) throw new Error('Il faut au moins 2 joueurs (ajoute des robots !)');
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) { p.points = 0; p.hunted = 0; }
    this.nextRound();
  }
  // Nouvelle manche : ceux qui ont le moins chassé deviennent chasseurs (1 pour 4 joueurs).
  nextRound() {
    this.roundNo++;
    this.phase = 'hide';
    // carte choisie, ou chacune à son tour (« au hasard » : on part d'une carte tirée au sort)
    if (this.settings.map !== 'hasard') this.mapId = this.settings.map;
    else { this.mapStart ??= Math.floor(this.rng() * PH.MAPS.length); this.mapId = PH.MAPS[(this.mapStart + this.roundNo - 1) % PH.MAPS.length]; }
    this.phaseAt = this.clock();
    const n = this.players.length, hunters = Math.max(1, Math.round(n / 4));
    // les humains passent chasseurs avant les robots, à nombre de chasses égal
    const order = [...this.players].sort((a, b) => a.hunted - b.hunted || !!a.bot - !!b.bot || this.rng() - 0.5);
    this.roles = {};
    order.forEach((p, k) => (this.roles[p.name] = k < hunters ? 'hunter' : 'prop'));
    this.bodies = {};
    let h = 0, q = 0;
    for (const p of this.players) {
      const hunter = this.roles[p.name] === 'hunter';
      if (hunter) p.hunted++;
      const sp = this.map.spawn(hunter ? h++ : q++, hunter);
      this.bodies[p.name] = { x: sp.x, z: sp.z, ry: 0, type: null, alive: true, hp: 100, whistleAt: this.clock(), movedAt: 0, heard: this.clock(), formAt: 0, radar: true, grenade: true, marked: 0 };
    }
    this.brains = {};
    this.order = []; // objets trouvés, dans l'ordre
    this.result = null;
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); this.timer = null; }

  get deadline() {
    if (this.phase === 'hide') return this.phaseAt + this.settings.hide * 1000;
    if (this.phase === 'hunt') return this.phaseAt + this.settings.hunt * 1000;
    if (this.phase === 'roundEnd') return this.phaseAt + ROUND_END_MS;
    return null;
  }
  timeout() {
    if (this.clock() < this.deadline) return;
    if (this.phase === 'hide') { this.phase = 'hunt'; this.phaseAt = this.clock(); for (const b of Object.values(this.bodies)) b.whistleAt = this.clock(); }
    else if (this.phase === 'hunt') this.endRound('props');
    else if (this.phase === 'roundEnd') { if (this.roundNo < this.settings.rounds) this.nextRound(); else this.finish(); }
  }
  playing() { return this.phase === 'hide' || this.phase === 'hunt'; }
  get map() { return PH.get(this.mapId); }
  living(role) { return Object.entries(this.bodies).filter(([n, b]) => b.alive && this.roles[n] === role); }

  /* ---- Ce que font les joueurs ---- */
  // Position envoyée par le navigateur : contrôlée (pas de téléportation, chasseurs immobiles pendant la cachette).
  move(name, p) {
    const b = this.bodies?.[name];
    if (!b?.alive || !this.playing() || !p || ![p.x, p.z, p.ry].every(num)) return;
    if (this.roles[name] === 'hunter' && this.phase === 'hide') { b.heard = this.clock(); return; } // immobile, mais bien là
    // pas plus loin que ce qu'on peut courir depuis la dernière position reçue (au moins 3 m : petites saccades)
    const far = Math.max(3, (this.clock() - b.heard) / 1000 * PH.RUN * 1.6);
    if (Math.abs(p.x) > this.map.HALF || Math.abs(p.z) > this.map.HALF || Math.hypot(p.x - b.x, p.z - b.z) > far) return;
    if (Math.hypot(p.x - b.x, p.z - b.z) > 0.02) b.movedAt = this.clock();
    Object.assign(b, { x: p.x, z: p.z, ry: p.ry, heard: this.clock() });
  }
  // Un objet prend l'apparence d'un objet du décor qu'il a sous les yeux (à moins de 4 m).
  disguise(name, type) {
    const b = this.bodies?.[name];
    if (!b?.alive || this.roles[name] !== 'prop' || !this.playing()) throw new Error('Tu ne peux pas te transformer maintenant');
    if (!this.map.PROPS[type]) throw new Error('Objet inconnu');
    if (!this.map.decor.some(d => d.type === type && Math.hypot(d.x - b.x, d.z - b.z) < 4.5)) throw new Error('Approche-toi de cet objet pour le copier');
    const wait = this.phase === 'hunt' && b.type ? FORM_CD - (this.clock() - b.formAt) : 0; // pendant la chasse : une transformation toutes les 10 s
    if (wait > 0) throw new Error(`Encore ${Math.ceil(wait / 1000)} s avant de pouvoir changer de forme`);
    b.type = type;
    b.formAt = this.clock();
  }
  // Un chasseur clique sur quelque chose : un joueur caché (trouvé !) ou un objet innocent (il perd de la vie).
  tag(name, target) {
    const b = this.bodies?.[name];
    if (!b?.alive || this.roles[name] !== 'hunter' || this.phase !== 'hunt' || !target) return;
    const now = this.clock();
    if (now - (b.tagAt ?? 0) < 400) return; // pas de mitraillage
    b.tagAt = now;
    if (target.player) {
      const t = this.bodies[target.player];
      if (!t?.alive || this.roles[target.player] !== 'prop' || Math.hypot(t.x - b.x, t.z - b.z) > TAG_RANGE + 0.5) return this.miss(name, b, t ?? b);
      t.alive = false;
      t.foundAt = now;
      this.order.push(target.player);
      this.get(name).points += 2;
      b.hp = Math.min(100, b.hp + FOUND_HEAL); // trouver redonne de la vie
      this.emit?.('fx', { kind: 'found', x: t.x, z: t.z, by: name, who: target.player });
      this.notify?.();
      return this.checkEnd();
    }
    const d = this.map.decor[target.decor];
    if (!d || Math.hypot(d.x - b.x, d.z - b.z) > TAG_RANGE + 0.5) return;
    this.miss(name, b, d);
  }
  miss(name, b, at) {
    b.hp -= MISS_DAMAGE;
    this.emit?.('fx', { kind: 'miss', x: at.x, z: at.z, by: name });
    if (b.hp <= 0) { b.alive = false; this.emit?.('fx', { kind: 'hunterOut', x: b.x, z: b.z, by: name }); this.notify?.(); this.checkEnd(); }
  }
  // Un objet se moque des chasseurs (sifflet, canard, pet, fou rire, coucou) : des points, mais tout le monde l'entend.
  taunt(name, kind = 'sifflet', forced = false) {
    const b = this.bodies?.[name], now = this.clock();
    if (!b?.alive || this.roles[name] !== 'prop' || this.phase !== 'hunt' || !TAUNTS[kind] || (!forced && now - (b.tauntAt ?? 0) < TAUNT_CD)) return;
    b.whistleAt = now; // dernier bruit (pour le sifflet forcé)
    if (!forced) b.tauntAt = now; // attente entre deux moqueries
    if (!forced) this.get(name).points += TAUNTS[kind];
    this.emit?.('fx', { kind: 'whistle', taunt: kind, x: b.x, z: b.z, forced });
    this.heard(b.x, b.z); // les robots chasseurs accourent
  }
  whistle(name, forced = false) { this.taunt(name, 'sifflet', forced); }
  // Radar (une fois par manche) : renvoie au chasseur la position des objets cachés à moins de 7 m.
  radar(name) {
    const b = this.bodies?.[name];
    if (!b?.alive || this.roles[name] !== 'hunter' || this.phase !== 'hunt' || !b.radar) return null;
    b.radar = false;
    this.emit?.('fx', { kind: 'radar', x: b.x, z: b.z, by: name });
    return this.living('prop').filter(([, t]) => Math.hypot(t.x - b.x, t.z - b.z) < RADAR_RANGE).map(([, t]) => ({ x: t.x, z: t.z }));
  }
  // Grenade à confettis (une fois par manche) : les objets touchés scintillent quelques secondes, pour tout le monde.
  grenade(name, x, z) {
    const b = this.bodies?.[name];
    if (!b?.alive || this.roles[name] !== 'hunter' || this.phase !== 'hunt' || !b.grenade || !num(x) || !num(z)) return;
    if (Math.hypot(x - b.x, z - b.z) > GRENADE_RANGE) return;
    b.grenade = false;
    const hits = this.living('prop').filter(([, t]) => Math.hypot(t.x - x, t.z - z) < GRENADE_RADIUS).map(([n]) => n);
    for (const n of hits) this.bodies[n].marked = this.clock() + MARK_MS;
    this.emit?.('fx', { kind: 'grenade', x, z, hits });
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (!this.playing()) return;
    const now = this.clock();
    for (const [n, b] of Object.entries(this.bodies)) {
      if (!b.alive) continue;
      const p = this.get(n);
      if (p?.bot) this.think(n, b);
      else if (!p?.connected || now - b.heard > 30000) { b.alive = false; this.notify?.(); this.checkEnd(); continue; } // parti
      // Sifflet forcé : un objet resté muet trop longtemps se trahit.
      if (this.phase === 'hunt' && this.roles[n] === 'prop' && now - b.whistleAt > FORCED_WHISTLE) this.taunt(n, 'sifflet', true);
    }
    const r = v => Math.round(v * 100) / 100;
    this.emit?.('snap', Object.entries(this.bodies).map(([n, b]) => [n, r(b.x), r(b.z), r(b.ry), b.type ?? '', b.alive ? 1 : 0, b.hp, b.marked > now ? 1 : 0]));
  }
  checkEnd() {
    if (this.phase !== 'hunt') return;
    if (!this.living('prop').length) this.endRound('hunters');
    else if (!this.living('hunter').length) this.endRound('props');
  }
  // Fin de manche : objets survivants +3, ou chasseurs encore debout +2 s'ils ont tout trouvé.
  endRound(winner) {
    if (!this.playing()) return;
    const survivors = this.living('prop').map(([n]) => n);
    if (winner === 'props') for (const n of survivors) this.get(n).points += 3;
    else for (const [n] of this.living('hunter')) this.get(n).points += 2;
    // meilleure cachette : un survivant au hasard parmi les objets jamais touchés par un confetti, sinon celui trouvé le plus tard
    const forms = Object.fromEntries(Object.entries(this.bodies).filter(([n]) => this.roles[n] === 'prop').map(([n, b]) => [n, b.type]));
    const best = survivors.length ? survivors[0] : this.order.at(-1) ?? null;
    this.result = { winner, survivors, found: [...this.order], forms, best };
    this.phase = 'roundEnd';
    this.phaseAt = this.clock();
    this.stop();
    this.notify?.();
  }
  finish() {
    this.phase = 'over';
    this.ranking = [...this.players].sort((a, b) => b.points - a.points).map(p => ({ name: p.name, points: p.points, color: p.color }));
    const w = this.ranking[0]?.name;
    if (w) this.wins[w] = (this.wins[w] ?? 0) + 1;
  }
  again(name) {
    if (name !== this.host) throw new Error('Seul le créateur du salon peut faire ça');
    if (this.phase !== 'over') throw new Error('La partie n’est pas finie');
    this.phase = 'lobby';
  }

  /* ---- Robots ---- */
  think(name, b) {
    const br = this.brains[name] ?? (this.brains[name] = { goal: null, next: 0 });
    const now = this.clock(), dt = TICK_MS / 1000, hunter = this.roles[name] === 'hunter';
    // Objet : file vers un coin tranquille près d'un objet, prend sa forme, puis ne bouge plus.
    if (!hunter) {
      if (b.type) { if (this.phase === 'hunt' && this.rng() < 0.004) this.taunt(name, ['canard', 'pet', 'rire', 'coucou'][Math.floor(this.rng() * 4)]); return; }
      if (!br.goal) {
        const real = this.map.decor.filter(x => !x.scenery), d = real[Math.floor(this.rng() * real.length)], a = this.rng() * Math.PI * 2;
        br.goal = { x: d.x + Math.cos(a) * (d.r + 0.5), z: d.z + Math.sin(a) * (d.r + 0.5), type: d.type };
      }
      if (this.walk(b, br.goal, PH.RUN, dt) < 0.2 || now - this.phaseAt > HIDE_MS - 3000 || this.phase === 'hunt') {
        b.type = br.goal.type; b.ry = this.rng() * Math.PI * 2;
      }
      return;
    }
    if (this.phase !== 'hunt') return;
    // Chasseur : va vers le dernier sifflet entendu, sinon fait le tour des objets ; tire de temps en temps.
    if (br.whistle && now - br.whistle.at < 8000) br.goal = br.whistle;
    if (!br.goal || this.walk(b, br.goal, PH.SPEED, dt) < 0.4) { const d = this.map.decor[Math.floor(this.rng() * this.map.decor.length)]; br.goal = { x: d.x + 0.6, z: d.z + 0.6 }; br.whistle = null; }
    if (now < br.next) return;
    br.next = now + 1500 + this.rng() * 1500;
    // gadgets : la grenade là où ça a sifflé, le radar au milieu de la chasse
    if (b.grenade && br.whistle && Math.hypot(br.whistle.x - b.x, br.whistle.z - b.z) < GRENADE_RANGE) this.grenade(name, br.whistle.x, br.whistle.z);
    if (b.radar && now - this.phaseAt > this.settings.hunt * 500) { const pings = this.radar(name); if (pings?.length) br.goal = pings[0]; }
    const marked = this.living('prop').find(([, t]) => t.marked > now && Math.hypot(t.x - b.x, t.z - b.z) < TAG_RANGE - 0.5);
    if (marked) return this.tag(name, { player: marked[0] });
    const near = (x, z) => Math.hypot(x - b.x, z - b.z) < TAG_RANGE - 0.5;
    const hidden = this.living('prop').filter(([, t]) => near(t.x, t.z));
    const suspect = hidden.find(([, t]) => now - t.movedAt < 6000 || now - t.whistleAt < 6000);
    const pick = suspect ?? (hidden.length && this.rng() < 0.3 ? hidden[0] : null);
    if (pick) return this.tag(name, { player: pick[0] });
    const fakes = this.map.decor.filter(d => near(d.x, d.z));
    if (fakes.length && b.hp > 40 && this.rng() < 0.25) this.tag(name, { decor: fakes[Math.floor(this.rng() * fakes.length)].id });
  }
  // Fait avancer un robot vers un point (en contournant les obstacles comme il peut). Renvoie la distance restante.
  walk(b, goal, speed, dt) {
    const dx = goal.x - b.x, dz = goal.z - b.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const step = Math.min(d, speed * dt), x0 = b.x, z0 = b.z;
    b.x += dx / d * step; b.z += dz / d * step;
    this.map.collide(b, b.type ? this.map.PROPS[b.type].r : PH.R);
    if (Math.hypot(b.x - x0, b.z - z0) < step * 0.3) { b.x += -dz / d * step; b.z += dx / d * step; this.map.collide(b, PH.R); } // bloqué : on longe
    b.ry = Math.atan2(dx, dz);
    b.movedAt = this.clock();
    return Math.hypot(goal.x - b.x, goal.z - b.z);
  }
  heard(x, z) { for (const [n] of this.living('hunter')) if (this.get(n)?.bot) (this.brains[n] ??= {}).whistle = { x, z, at: this.clock() }; }

  summary() { return { rounds: this.settings.rounds }; }
  viewFor(name) {
    const role = this.roles?.[name] ?? null;
    return {
      code: this.code, private: this.private, phase: this.phase, round: this.round, roundNo: this.roundNo, me: name, host: this.host, now: this.clock(),
      settings: this.settings, spectator: !!this.spectator(name), spectators: this.spectators.filter(s => s.connected).map(s => s.name),
      deadline: this.deadline, result: this.result, ranking: this.phase === 'over' ? this.ranking : null,
      role, roles: this.playing() || this.phase === 'roundEnd' ? this.roles : null, found: this.order ?? [],
      players: this.players.map(p => ({ name: p.name, connected: p.connected, bot: !!p.bot, color: p.color, points: p.points, wins: this.wins[p.name] ?? 0 })),
      map: this.mapId,
      spawn: this.bodies?.[name] && this.phase === 'hide' ? { x: this.bodies[name].x, z: this.bodies[name].z } : null,
      night: this.roundNo % 2 === 0, gadgets: this.bodies?.[name] ? { radar: this.bodies[name].radar, grenade: this.bodies[name].grenade } : null,
    };
  }
}
module.exports = { Room, SETTINGS, MAX_PLAYERS, HIDE_MS, HUNT_MS, TAUNTS };
