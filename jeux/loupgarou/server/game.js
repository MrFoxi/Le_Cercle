// Loup-Garou : un village, des rôles secrets, des nuits où les loups dévorent et des journées où l'on vote.
// Étapes d'une partie : révélation des rôles, nuit (loups + voyante, puis sorcière), aube (les morts), jour (on discute et
// on se promène sur la place), vote, verdict ; le chasseur qui meurt tire une dernière fois. Le serveur tient les rôles,
// les choix de nuit, les votes, la fin de partie, contrôle les positions et relaie les emotes et objets lancés (« fx »).
// Les robots jouent tous les rôles. Testé par jeux/loupgarou/loupgarou.test.js.
const LG = require('../client/rules');
const { PartyRoom } = require('../../../lib/room-base');

const SETTINGS = { rounds: [1, 2, 3], day: [60, 90, 120, 180], vote: [20, 30, 45] };
const T = { reveal: 9000, wolves: 30000, witch: 15000, dawn: 7000, hunter: 20000, verdict: 7000, roundEnd: 12000 };
const TICK_MS = 100, EMOTE_CD = 1200, THROW_CD = 2000, THROW_RANGE = 20;
const COLORS = ['#e8543c', '#3d8bff', '#ffc93c', '#2fd47a', '#a46bff', '#ff8a3d', '#22d3ee', '#f472b6', '#84cc16', '#f8fafc', '#94a3b8', '#c0262d'];
const BOT_NAMES = ['Gaspard', 'Mathilde', 'Barnabé', 'Ysaline', 'Firmin', 'Aliénor', 'Bertrand', 'Philomène', 'Anselme', 'Clothilde', 'Eudes'];
// Phases où l'on peut faire des emotes et lancer des objets (vivants), et celles où l'on ne fait que regarder.
const SOCIAL = ['lobby', 'reveal', 'dawn', 'day', 'vote', 'verdict', 'hunter', 'roundEnd', 'over'];
const OPEN = ['lobby', 'roundEnd', 'over']; // tout le monde, même les morts
const SAY = {
  accuse: ['{x}, tu étais où cette nuit ?', 'Je trouve {x} bien trop calme…', 'Moi je vote {x}, il y a un truc pas net.', '{x} a des poils sur les mains, regardez !', 'Pourquoi {x} sourit comme ça ?', '{x} sentait le sous-bois ce matin…'],
  defend: ['Ce n’est pas moi, je le jure sur ma chèvre !', 'Je suis un simple villageois, moi !', 'Arrêtez de me regarder comme ça !', 'Vous faites erreur, je dormais !'],
  idle: ['Quelqu’un a vu mon chat ?', 'Cette nuit, j’ai entendu hurler près de la forêt…', 'La soupe de l’auberge était excellente hier.', 'Il fait frais ce matin.', 'On devrait réparer la fontaine.'],
  seer: ['J’ai vu la vérité dans ma boule : {x} est un loup-garou !'],
  grief: ['Pauvre {x}… paix à son âme.', 'Ils ont eu {x} ! On doit réagir.'],
  hit: ['Aïe !', 'Hé ! Qui a lancé ça ?', 'Mon bel habit !', 'Tu vas me le payer !'],
};
const num = v => typeof v === 'number' && Number.isFinite(v);

class Room extends PartyRoom {
  static MAX_PLAYERS = LG.MAX_PLAYERS;
  static SETTINGS = SETTINGS;
  static COLORS = COLORS;
  static BOT_NAMES = BOT_NAMES;
  constructor(...args) {
    super(...args);
    this.settings = { rounds: 1, day: 120, vote: 30 };
    this.timer = null;
    this.deadline = null;
    this.roles = null;
    this.cool = {};
  }
  newPlayer(name, extra) { return { ...super.newPlayer(name, extra), look: LG.randomLook(this.rng) }; }
  names() { return this.players.map(p => p.name); }
  alive(role) { return this.names().filter(n => this.life?.[n] && (!role || this.roles[n] === role)); }
  pick(list) { return list[Math.floor(this.rng() * list.length)]; }
  inGame() { return !!this.roles && !['lobby', 'roundEnd', 'over'].includes(this.phase); }

  // Changer de tenue (à tout moment)
  dress(name, look) {
    if (!LG.validLook(look)) throw new Error('Apparence invalide');
    this.get(name).look = [...look];
  }

  start(name) {
    this.hostOnly(name);
    if (this.players.length < LG.MIN_PLAYERS) throw new Error(`Il faut au moins ${LG.MIN_PLAYERS} joueurs (ajoute des robots !)`);
    this.round++;
    this.roundNo = 0;
    for (const p of this.players) p.points = 0;
    this.nextRound();
  }
  // Nouvelle partie dans le salon : rôles tirés au sort, chacun à son siège.
  nextRound() {
    this.roundNo++;
    const names = this.names(), deck = LG.composition(names.length);
    for (let k = deck.length - 1; k > 0; k--) { const j = Math.floor(this.rng() * (k + 1)); [deck[k], deck[j]] = [deck[j], deck[k]]; }
    this.roles = Object.fromEntries(names.map((n, k) => [n, deck[k]]));
    this.comp = LG.composition(names.length);
    this.life = Object.fromEntries(names.map(n => [n, true]));
    this.seats = Object.fromEntries(names.map((n, k) => [n, k]));
    this.bodies = Object.fromEntries(names.map(n => [n, this.atSeat(n)]));
    Object.assign(this, { seen: {}, potions: { heal: true, kill: true }, dayNo: 0, log: [], wolfChat: [], hits: {}, deaths: [], votes: {}, verdict: null, hunters: [], shot: null, winner: null, brains: {}, ready: new Set(), step: null, wolfVotes: {} });
    this.go('reveal', T.reveal);
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  atSeat(n) { const s = LG.SEATS[this.seats[n]]; return { x: s.x, z: s.z, ry: s.ry, sit: this.seats[n], heard: this.clock() }; }
  seatAll() { for (const n of this.names()) Object.assign(this.bodies[n], this.atSeat(n)); }
  go(phase, ms) { this.phase = phase; this.phaseAt = this.clock(); this.deadline = ms ? this.phaseAt + ms : null; }
  hurry(ms = 2500) { if (this.deadline) this.deadline = Math.min(this.deadline, this.clock() + ms); }
  stop() { clearInterval(this.timer); this.timer = null; }

  timeout() {
    if (!this.deadline || this.clock() < this.deadline) return;
    switch (this.phase) {
      case 'reveal': return this.night();
      case 'night': return this.step === 'wolves' ? this.endWolves() : this.dawn();
      case 'dawn': case 'verdict': return this.next();
      case 'hunter': if (!this.shot) this.hunters.shift(); return this.next();
      case 'day': return this.startVote();
      case 'vote': return this.endVote();
      case 'roundEnd': if (this.roundNo < this.settings.rounds) return this.nextRound(); this.stop(); this.deadline = null; return this.finish();
    }
  }
  // Après les morts : le chasseur tire, sinon la partie est finie, sinon on enchaîne (jour après l'aube, nuit après le vote).
  next() {
    if (this.hunters.length) { this.shot = null; return this.go('hunter', T.hunter); }
    const w = this.winning();
    if (w) return this.endRound(w);
    if (this.after === 'day') this.startDay(); else this.night();
  }
  winning() {
    const alive = this.alive(), wolves = alive.filter(n => this.roles[n] === 'loup').length;
    return wolves === 0 ? 'village' : wolves >= alive.length - wolves ? 'loups' : null;
  }
  kill(name, cause) {
    if (!this.life[name]) return;
    this.life[name] = false;
    this.deaths.push({ name, role: this.roles[name], cause });
    this.log.push(`💀 ${name} (${LG.ROLES[this.roles[name]].name}) ${{ loups: 'a été dévoré par les loups', sorciere: 'a été empoisonné', vote: 'a été chassé du village', chasseur: 'a reçu la flèche du chasseur' }[cause]}`);
    if (this.roles[name] === 'chasseur') this.hunters.push(name);
  }

  /* ---- Nuit ---- */
  night() {
    this.dayNo++;
    Object.assign(this, { wolfVotes: {}, seerDone: false, victim: null, saved: false, poisoned: null, deaths: [], verdict: null, step: 'wolves' });
    this.seatAll();
    this.log.push(`🌙 Nuit ${this.dayNo}`);
    this.go('night', T.wolves);
  }
  nightCheck(step) { if (this.phase !== 'night' || this.step !== step) throw new Error('Ce n’est pas le moment'); }
  wolf(name, target) {
    this.nightCheck('wolves');
    if (this.roles[name] !== 'loup' || !this.life[name]) throw new Error('Seuls les loups chassent');
    if (!this.life[target] || this.roles[target] === 'loup') throw new Error('Choisis un villageois vivant');
    this.wolfVotes[name] = target;
    this.nightDone();
  }
  see(name, target) {
    this.nightCheck('wolves');
    if (this.roles[name] !== 'voyante' || !this.life[name]) throw new Error('Tu n’as pas de boule de cristal');
    if (this.seerDone) throw new Error('Tu as déjà regardé une carte cette nuit');
    if (!this.life[target] || target === name) throw new Error('Choisis un autre joueur vivant');
    (this.seen[name] ??= {})[target] = this.roles[target];
    this.seerDone = true;
    this.nightDone();
  }
  // Loups d'accord et voyante servie : la nuit avance.
  nightDone() {
    const wolves = this.alive('loup'), targets = new Set(wolves.map(w => this.wolfVotes[w]));
    if (wolves.every(w => this.wolfVotes[w]) && targets.size === 1 && (!this.alive('voyante').length || this.seerDone)) this.hurry(2500);
  }
  endWolves() {
    const count = {};
    for (const t of Object.values(this.wolfVotes)) if (this.life[t]) count[t] = (count[t] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(count));
    this.victim = max ? this.pick(Object.keys(count).filter(n => count[n] === max)) : null;
    const witch = this.alive('sorciere')[0];
    if (witch && (this.potions.heal || this.potions.kill)) { this.step = 'witch'; this.go('night', T.witch); } else this.dawn();
  }
  potion(name, kind, target) {
    this.nightCheck('witch');
    if (this.roles[name] !== 'sorciere' || !this.life[name]) throw new Error('Tu n’as pas de potions');
    if (kind === 'heal') {
      if (!this.potions.heal || !this.victim || this.saved) throw new Error('Pas de potion de vie à utiliser');
      this.potions.heal = false; this.saved = true;
    } else if (kind === 'kill') {
      if (!this.potions.kill) throw new Error('Potion de mort déjà utilisée');
      if (!this.life[target] || target === name) throw new Error('Choisis un autre joueur vivant');
      this.potions.kill = false; this.poisoned = target;
    } else if (kind !== 'done') throw new Error('Potion inconnue');
    if (kind === 'done' || (!this.potions.heal && !this.potions.kill)) this.hurry(1500);
  }
  dawn() {
    this.deaths = [];
    if (this.victim && !this.saved) this.kill(this.victim, 'loups');
    if (this.poisoned) this.kill(this.poisoned, 'sorciere');
    if (!this.deaths.length) this.log.push('☀️ Personne n’est mort cette nuit');
    this.step = null;
    this.after = 'day';
    this.go('dawn', T.dawn + 2500 * this.deaths.length);
  }

  /* ---- Jour ---- */
  startDay() {
    this.ready = new Set();
    this.votes = {};
    this.log.push(`☀️ Jour ${this.dayNo}`);
    this.go('day', this.settings.day * 1000);
  }
  // « On vote ! » : quand tous les humains vivants sont prêts, la discussion s'arrête.
  rush(name) {
    if (this.phase !== 'day' || !this.life[name]) throw new Error('Ce n’est pas le moment');
    if (this.ready.has(name)) this.ready.delete(name); else this.ready.add(name);
    if (this.alive().every(n => this.get(n).bot || !this.get(n).connected || this.ready.has(n))) this.hurry(3000);
  }
  startVote() {
    this.votes = {};
    this.seatAll();
    this.go('vote', this.settings.vote * 1000);
  }
  vote(name, target) {
    if (this.phase !== 'vote' || !this.life[name]) throw new Error('Tu ne peux pas voter maintenant');
    if (target === null) { delete this.votes[name]; return; }
    if (!this.life[target] || target === name) throw new Error('Vote pour un autre joueur vivant');
    this.votes[name] = target;
    if (this.alive().every(n => this.votes[n])) this.hurry(2500);
  }
  // Le plus de voix est chassé ; égalité : personne.
  endVote() {
    const count = {};
    for (const [v, t] of Object.entries(this.votes)) if (this.life[v] && this.life[t]) count[t] = (count[t] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(count)), top = Object.keys(count).filter(n => count[n] === max);
    this.deaths = [];
    if (max && top.length === 1) { this.verdict = { name: top[0], role: this.roles[top[0]], votes: max }; this.kill(top[0], 'vote'); }
    else { this.verdict = { name: null, tie: top.length > 1 }; this.log.push(top.length > 1 ? '⚖️ Égalité : personne n’est chassé' : '🤷 Personne n’a voté'); }
    this.after = 'night';
    this.go('verdict', T.verdict);
  }
  shoot(name, target) {
    if (this.phase !== 'hunter' || this.hunters[0] !== name || this.shot) throw new Error('Ce n’est pas à toi de tirer');
    if (!this.life[target] || target === name) throw new Error('Vise un joueur vivant');
    this.hunters.shift();
    this.shot = { by: name, who: target };
    this.kill(target, 'chasseur');
    this.send?.('fx', { kind: 'shot', who: name, to: target });
    this.hurry(4000);
  }
  // Fin d'une partie : chaque gagnant +1, +1 encore s'il est vivant.
  endRound(winner) {
    this.winner = winner;
    for (const p of this.players) if (LG.ROLES[this.roles[p.name]]?.camp === winner) p.points += this.life[p.name] ? 2 : 1;
    this.log.push(winner === 'loups' ? '🐺 Les loups-garous ont gagné' : '🏡 Le village a gagné');
    this.go('roundEnd', T.roundEnd);
  }
  // Un joueur quitte le salon en pleine partie : il meurt, et la partie peut se terminer.
  left(name) {
    if (!this.inGame() || !this.life[name]) return;
    this.life[name] = false;
    this.log.push(`🚪 ${name} a quitté le village`);
    this.hunters = this.hunters.filter(h => h !== name);
    const w = this.winning();
    if (w) this.endRound(w);
  }
  whisper(name, text) {
    text = String(text ?? '').trim().slice(0, 160);
    if (this.phase !== 'night' || this.roles[name] !== 'loup' || !this.life[name] || !text) throw new Error('La meute ne parle que la nuit');
    this.wolfChat.push({ name, text });
    if (this.wolfChat.length > 40) this.wolfChat.shift();
  }
  // Qui peut écrire dans le fil commun (lib/rooms.js) : personne la nuit, ni les morts ni les spectateurs pendant la partie.
  canChat(name) {
    if (!this.roles || OPEN.includes(this.phase)) return true;
    return !!this.life[name] && this.phase !== 'night';
  }

  /* ---- Sur la place : déplacements, emotes, objets lancés ---- */
  move(name, p) {
    const b = this.bodies?.[name];
    if (!b || !this.life[name] || this.phase !== 'day' || !p || ![p.x, p.z, p.ry].every(num)) return;
    const now = this.clock(), far = Math.max(2.5, ((now - b.heard) / 1000) * LG.RUN * 1.6);
    if (Math.hypot(p.x - b.x, p.z - b.z) > far) return; // téléportation refusée
    let q = LG.collide({ x: p.x, z: p.z }), sit = -1;
    const s = LG.SEATS[p.s];
    if (Number.isInteger(p.s) && s && Math.hypot(s.x - q.x, s.z - q.z) < 1.3 && !this.names().some(n => n !== name && this.bodies[n].sit === p.s)) { sit = p.s; q = { x: s.x, z: s.z }; }
    Object.assign(b, { x: q.x, z: q.z, ry: p.ry, sit, heard: now });
  }
  social(name, key, cd) {
    if (!SOCIAL.includes(this.phase) || !(OPEN.includes(this.phase) || this.life?.[name])) return false;
    const now = this.clock(), k = `${name}:${key}`;
    if (now - (this.cool[k] ?? 0) < cd) return false;
    this.cool[k] = now;
    return true;
  }
  emote(name, e, to = null) {
    if (!LG.EMOTES[e] || (to !== null && (!this.get(to) || to === name))) return;
    if (!this.social(name, 'e', EMOTE_CD)) return;
    this.send?.('fx', { kind: 'emote', who: name, e, to });
  }
  toss(name, item, to) {
    if (!LG.ITEMS[item] || !this.get(to) || to === name) return;
    if (this.inGame()) {
      const a = this.bodies[name], b = this.bodies[to];
      if (!a || !b || !this.life[to] || Math.hypot(a.x - b.x, a.z - b.z) > THROW_RANGE) return;
    }
    if (!this.social(name, 't', THROW_CD)) return;
    if (this.hits) this.hits[to] = (this.hits[to] ?? 0) + 1;
    this.send?.('fx', { kind: 'toss', who: name, to, item });
    if (this.get(to).bot && this.rng() < 0.5) this.say(to, SAY.hit, name);
  }
  // Un robot parle (bulle au-dessus de sa tête) ; on évite de répéter ce qui vient d'être dit.
  say(name, lines, x) {
    this.said ??= [];
    let text = '';
    for (let k = 0; k < 4 && (!text || this.said.includes(text)); k++) text = this.pick(lines).replace('{x}', x ?? '');
    this.said = [...this.said.slice(-7), text];
    this.send?.('fx', { kind: 'say', who: name, text });
  }

  tick() {
    if (!this.players.length) return this.stop();
    if (!this.roles || this.phase === 'over') return;
    const now = this.clock();
    let changed = false;
    for (const p of this.players) if (p.bot && this.think(p.name, now)) changed = true;
    if (changed) this.notify?.();
    const r = v => Math.round(v * 100) / 100;
    this.emit?.('snap', this.names().filter(n => this.bodies[n]).map(n => { const b = this.bodies[n]; return [n, r(b.x), r(b.z), r(b.ry), b.sit]; }));
  }

  /* ---- Robots ---- */
  // Renvoie vrai si le robot a changé l'état de la partie (vote, choix de nuit).
  think(n, now) {
    if (!this.life[n] && !(this.phase === 'hunter' && this.hunters[0] === n)) return false; // un chasseur mort tire encore
    const key = `${this.phase}.${this.step}.${this.dayNo}`;
    let br = this.brains[n];
    if (br?.key !== key) {
      const others = this.alive().filter(x => x !== n), prey = others.filter(x => this.roles[n] !== 'loup' || this.roles[x] !== 'loup');
      br = this.brains[n] = { key, at: now + 2000 + this.rng() * 6000, done: false, goal: null, walkAt: now + this.rng() * 4000, talkAt: now + 4000 + this.rng() * 12000, funAt: now + 3000 + this.rng() * 9000, suspect: this.brains[n]?.key?.endsWith(`.${this.dayNo}`) ? this.brains[n].suspect : this.pick(prey) };
      if (!this.life[br.suspect]) br.suspect = this.pick(prey);
    }
    const role = this.roles[n], others = this.alive().filter(x => x !== n);
    if (this.phase === 'day') this.wander(n, br, now);
    if (now < br.at || br.done) return false;
    br.done = true;
    try { return this.decide(n, br, role, others); } catch { return false; } // choix devenu impossible : le robot passe son tour
  }
  decide(n, br, role, others) {
    if (this.phase === 'night' && this.step === 'wolves') {
      if (role === 'loup') { const mate = Object.values(this.wolfVotes).find(t => this.life[t]); this.wolf(n, mate ?? this.pick(others.filter(x => this.roles[x] !== 'loup'))); return true; }
      if (role === 'voyante') { const unknown = others.filter(x => !this.seen[n]?.[x]); if (unknown.length) { this.see(n, this.pick(unknown)); return true; } }
    }
    if (this.phase === 'night' && this.step === 'witch' && role === 'sorciere') {
      if (this.victim && this.potions.heal && (this.victim === n || this.rng() < 0.5)) this.potion(n, 'heal');
      if (this.potions.kill && this.dayNo >= 2 && this.rng() < 0.25) this.potion(n, 'kill', this.knownWolf(n) ?? br.suspect);
      this.potion(n, 'done');
      return true;
    }
    if (this.phase === 'hunter' && this.hunters[0] === n && !this.shot) { this.shoot(n, this.knownWolf(n) ?? (this.life[br.suspect] ? br.suspect : this.pick(others))); return true; }
    if (this.phase === 'vote' && !this.votes[n] && others.length) {
      const target = this.botVote(n, br, others);
      this.vote(n, target);
      this.emote(n, 'pointer', target);
      return true;
    }
    return false;
  }
  knownWolf(n) { return Object.entries(this.seen[n] ?? {}).find(([x, r]) => r === 'loup' && this.life[x])?.[0] ?? null; }
  botVote(n, br, others) {
    const count = {};
    for (const t of Object.values(this.votes)) if (t !== n) count[t] = (count[t] ?? 0) + 1;
    const lead = Object.keys(count).sort((a, b) => count[b] - count[a]);
    if (this.roles[n] === 'loup') return lead.find(x => this.roles[x] !== 'loup') ?? (this.roles[br.suspect] !== 'loup' && this.life[br.suspect] ? br.suspect : this.pick(others.filter(x => this.roles[x] !== 'loup')) ?? this.pick(others));
    const wolf = this.knownWolf(n);
    if (wolf) return wolf;
    if (lead.length && this.rng() < 0.5) return lead[0];
    return this.life[br.suspect] && br.suspect !== n ? br.suspect : this.pick(others);
  }
  // Pendant la journée : se promener, s'asseoir, parler, faire des emotes, lancer des tomates sur son suspect.
  wander(n, br, now) {
    const b = this.bodies[n];
    if (now >= br.walkAt && !br.goal) {
      br.walkAt = now + 5000 + this.rng() * 9000;
      const taken = new Set(this.names().filter(x => x !== n).map(x => this.bodies[x].sit));
      const free = LG.SEATS.map((s, k) => k).filter(k => !taken.has(k));
      if (this.rng() < 0.45 && free.length) { const k = this.pick(free); br.goal = { ...LG.SEATS[k], seat: k }; }
      else { const a = this.rng() * Math.PI * 2, d = 3 + this.rng() * 8; br.goal = { x: Math.sin(a) * d, z: Math.cos(a) * d, seat: -1 }; }
    }
    if (br.goal) {
      const dx = br.goal.x - b.x, dz = br.goal.z - b.z, d = Math.hypot(dx, dz), step = (LG.SPEED * TICK_MS) / 1000;
      if (d < 0.3) {
        const s = br.goal.seat, free = s >= 0 && !this.names().some(x => x !== n && this.bodies[x].sit === s);
        Object.assign(b, free ? { x: LG.SEATS[s].x, z: LG.SEATS[s].z, ry: LG.SEATS[s].ry, sit: s } : { sit: -1 });
        br.goal = null;
      } else {
        b.sit = -1;
        b.x += (dx / d) * Math.min(d, step); b.z += (dz / d) * Math.min(d, step);
        LG.collide(b);
        b.ry = Math.atan2(dx, dz);
        if (Math.hypot(br.goal.x - b.x, br.goal.z - b.z) > d - step * 0.3) { b.x += (-dz / d) * step; b.z += (dx / d) * step; LG.collide(b); } // bloqué : on contourne
      }
    }
    if (now >= br.talkAt) {
      br.talkAt = now + 15000 + this.rng() * 20000;
      const wolf = this.roles[n] === 'voyante' && this.knownWolf(n), lastDead = this.deaths.at(-1)?.name;
      if (wolf && this.rng() < 0.6) this.say(n, SAY.seer, wolf);
      else if (lastDead && !br.grieved && this.rng() < 0.4) { br.grieved = true; this.say(n, SAY.grief, lastDead); }
      else if (this.rng() < 0.55 && this.life[br.suspect]) this.say(n, SAY.accuse, br.suspect);
      else this.say(n, this.rng() < 0.5 ? SAY.defend : SAY.idle);
    }
    if (now >= br.funAt) {
      br.funAt = now + 5000 + this.rng() * 10000;
      const r = this.rng();
      if (r < 0.35 && this.life[br.suspect]) this.toss(n, this.pick(['tomate', 'tomate', 'oeuf', 'chaussure', 'chou', 'poisson']), br.suspect);
      else if (r < 0.55 && this.life[br.suspect]) this.emote(n, 'pointer', br.suspect);
      else this.emote(n, this.pick(['rire', 'applaudir', 'danser', 'coucou', 'colere', 'pleurer', 'bisou', 'tomber']));
    }
  }

  viewFor(name) {
    const base = this.baseView(name);
    base.players = base.players.map(p => ({ ...p, look: this.get(p.name).look }));
    if (!this.roles) return base;
    const role = this.roles[name] ?? null, me = this.get(name), dead = !!me && !this.life[name], end = OPEN.includes(this.phase);
    const roles = {};
    for (const n of Object.keys(this.roles)) if (end || dead || n === name || !this.life[n] || (role === 'loup' && this.roles[n] === 'loup')) roles[n] = this.roles[n];
    if (role === 'voyante') for (const [n, r] of Object.entries(this.seen[name] ?? {})) roles[n] = r;
    const wolf = role === 'loup' || dead;
    return {
      ...base, role, roles, life: this.life, comp: this.comp, dayNo: this.dayNo, step: this.step, seats: this.seats,
      wolfVotes: wolf || end ? this.wolfVotes : null, wolfChat: wolf ? this.wolfChat : [],
      victim: (role === 'sorciere' && this.step === 'witch') || dead ? this.victim : null,
      potions: role === 'sorciere' ? this.potions : null, seerDone: role === 'voyante' ? !!this.seerDone : null,
      votes: ['vote', 'verdict'].includes(this.phase) ? this.votes : {}, verdict: this.phase === 'verdict' ? this.verdict : null,
      deaths: ['dawn', 'verdict', 'hunter'].includes(this.phase) ? this.deaths : [], hunter: this.phase === 'hunter' ? this.hunters[0] ?? null : null, shot: this.shot,
      ready: [...this.ready], winner: this.winner, log: this.log.slice(-40), logN: this.log.length, hits: this.hits,
    };
  }
}
module.exports = { Room, SETTINGS, T };
