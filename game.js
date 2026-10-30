// Moteur de règles du 7,5 : aucune notion de réseau, testé par test.js.
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', 'V', 'D', 'R'];
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 0, V: 0.5, D: 0.5, R: 0.5 };
const MAX_PLAYERS = 8, START_CHIPS = 1000, MIN_BET = 10;

const pts = n => String(n).replace('.', ',');
const signed = n => (n >= 0 ? `+${n}` : `−${-n}`);
const total = cards => cards.reduce((s, c) => s + VALUES[c.rank], 0);
const isNatural = cards => cards.length === 2 && total(cards) === 7.5;
// Dépassement ou égalité : le banquier gagne.
const outcome = (cards, bankerTotal) => (total(cards) <= 7.5 && total(cards) > bankerTotal ? 'win' : 'lose');

function payout(bet, result, natural) {
  if (result === 'lose') return { player: -bet, banker: bet };
  const gain = Math.floor(natural ? bet * 1.5 : bet);
  return { player: gain, banker: -Math.floor(gain / 2) }; // l'autre moitié est créée par le jeu
}

function newDeck(rng = Math.random) {
  const d = SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })));
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

class Table {
  constructor(name) {
    this.name = name;
    this.players = []; // ordre des places autour de la table
    this.phase = 'waiting'; // waiting | betting | playing | banker | results
    this.bankerIdx = -1;
    this.round = null;
    this.log = []; // { r: n° de manche, k: type, t: texte }
    this.roundNo = 0;
    this.banned = new Set(); // pseudos bannis par le chef du lobby
  }

  say(t, k = 'info') {
    this.log.push({ r: this.roundNo, k, t });
    if (this.log.length > 300) this.log.shift();
  }
  get(name) { return this.players.find(p => p.name === name); }
  get host() { return this.players.find(p => !p.left)?.name; }
  canPlay(p) { return p.connected && !p.left && p.chips > 0; }

  addPlayer(name, avatar = '') {
    if (this.banned.has(name)) throw new Error('Tu as été banni de cette table');
    const p = this.get(name);
    if (p) {
      if (p.connected) throw new Error('Ce pseudo est déjà à cette table');
      p.connected = true;
      p.left = false;
      p.avatar = avatar || p.avatar;
      return this.say(`${name} est de retour`);
    }
    if (this.players.filter(p => !p.left).length >= MAX_PLAYERS) throw new Error('Table pleine');
    this.players.push({ name, avatar, chips: START_CHIPS, connected: true, left: false });
    this.say(`${name} rejoint la table`);
  }

  remove(i) {
    this.players.splice(i, 1);
    if (i <= this.bankerIdx) this.bankerIdx--; // la rotation repart du bon voisin
  }

  start(name) {
    if (name !== this.host) throw new Error("Seul l'hôte peut lancer la partie");
    if (this.phase !== 'waiting') throw new Error('Partie déjà en cours');
    if (this.players.filter(p => this.canPlay(p)).length < 2) throw new Error('Il faut au moins 2 joueurs');
    this.newRound();
  }

  newRound() {
    for (let i = this.players.length - 1; i >= 0; i--) if (this.players[i].left) this.remove(i);
    this.round = null;
    const n = this.players.length;
    if (this.players.filter(p => this.canPlay(p)).length < 2) {
      this.phase = 'waiting';
      return this.say('En attente de joueurs');
    }
    do this.bankerIdx = (this.bankerIdx + 1) % n; while (!this.canPlay(this.players[this.bankerIdx]));
    const order = [], hands = {};
    for (let k = 1; k < n; k++) {
      const p = this.players[(this.bankerIdx + k) % n];
      if (!this.canPlay(p)) continue;
      order.push(p.name);
      hands[p.name] = { cards: [], bet: null, done: false, challenged: false, result: null };
    }
    const banker = this.players[this.bankerIdx].name;
    this.round = { banker, order, hands, bankerCards: [], bankerDelta: 0, deck: newDeck(), turn: -1, cancelled: false };
    this.phase = 'betting';
    this.roundNo++;
    this.say(`${banker} est le banquier`, 'round');
  }

  deal() {
    const r = this.round;
    // shortcut: paquet épuisé → nouveau paquet complet (doublons possibles), à revoir si des mains très longues deviennent courantes
    if (!r.deck.length) r.deck = newDeck();
    return r.deck.pop();
  }

  bet(name, amount) {
    if (this.phase !== 'betting') throw new Error('Pas le moment de miser');
    const h = this.round.hands[name];
    if (!h) throw new Error('Tu ne joues pas cette manche');
    if (h.bet !== null) throw new Error('Mise déjà posée');
    const chips = this.get(name).chips, min = Math.min(MIN_BET, chips);
    amount = Math.floor(Number(amount));
    if (!(amount >= min && amount <= chips)) throw new Error(`Mise entre ${min} et ${chips}`);
    h.bet = amount;
    this.say(`${name} mise ${amount} jetons`, 'bet');
    this.checkBets();
  }

  checkBets() {
    const r = this.round;
    if (!r.order.length) return this.cancel('plus aucun joueur');
    if (r.order.every(n => r.hands[n].bet !== null)) {
      this.phase = 'playing';
      this.nextTurn();
    }
  }

  nextTurn() {
    const r = this.round;
    if (++r.turn >= r.order.length) {
      this.phase = 'banker';
      return this.say(`Tous les joueurs ont fini : au tour du banquier ${r.banker}`, 'banker');
    }
    const name = r.order[r.turn];
    r.hands[name].cards.push({ ...this.deal(), hidden: true });
    if (!this.get(name).connected) {
      r.hands[name].done = true;
      this.say(`${name} est absent : il reste automatiquement`);
      this.nextTurn();
    }
  }

  current(name) {
    const r = this.round;
    if (this.phase !== 'playing' || r.order[r.turn] !== name) throw new Error("Ce n'est pas ton tour");
    return r.hands[name];
  }

  draw(name, hidden) {
    const h = this.current(name);
    if (hidden && h.cards.some(c => c.hidden)) throw new Error('Une seule carte cachée par main');
    const c = { ...this.deal(), hidden: !!hidden };
    h.cards.push(c);
    this.say(hidden ? `${name} tire une carte et la garde face cachée` : `${name} tire ${c.rank}${c.suit}`, 'draw');
  }

  reveal(name) {
    const c = this.current(name).cards.find(c => c.hidden);
    if (!c) throw new Error('Aucune carte cachée');
    c.hidden = false;
    this.say(`${name} montre sa carte cachée : ${c.rank}${c.suit}`, 'draw');
  }

  stand(name) {
    const h = this.current(name);
    h.done = true;
    this.say(`${name} reste avec ${h.cards.length} carte${h.cards.length > 1 ? 's' : ''}`, 'draw');
    this.nextTurn();
  }

  bankerTurn(name) {
    if (this.phase !== 'banker' || this.round.banker !== name) throw new Error("Ce n'est pas ton tour");
    return this.round;
  }

  bankerDraw(name) {
    const r = this.bankerTurn(name);
    if (total(r.bankerCards) >= 7.5) throw new Error('À 7,5 tu ne peux plus que défier');
    const c = { ...this.deal(), hidden: false };
    r.bankerCards.push(c);
    const bt = total(r.bankerCards);
    this.say(`Le banquier tire ${c.rank}${c.suit} : total ${pts(bt)}`, 'banker');
    if (bt > 7.5) {
      this.say(`Le banquier saute avec ${pts(bt)} ! Tous les joueurs pas encore défiés gagnent`, 'lose');
      for (const n of r.order) {
        if (r.hands[n].challenged) continue;
        this.settle(n, 'win');
        this.say(`${n} (${pts(total(r.hands[n].cards))}) gagne ${signed(r.hands[n].result.delta)}`, 'win');
      }
      this.endRound();
    }
  }

  challenge(name, target) {
    const r = this.bankerTurn(name), h = r.hands[target];
    if (!r.bankerCards.length) throw new Error("Tire d'abord ta première carte");
    if (!h || h.challenged) throw new Error('Ce joueur ne peut pas être défié');
    const t = total(h.cards), bt = total(r.bankerCards), res = outcome(h.cards, bt);
    this.settle(target, res);
    const why = t > 7.5 ? ' (dépassé)' : t === bt ? ' (égalité, le banquier gagne)' : res === 'win' && isNatural(h.cards) ? ' (7,5 naturel, payé 3 pour 2)' : '';
    this.say(`Défi : ${target} ${pts(t)} contre ${pts(bt)} pour le banquier → ${target} ${res === 'win' ? 'gagne' : 'perd'} ${signed(h.result.delta)}${why}`, res);
    if (r.order.every(n => r.hands[n].challenged)) this.endRound();
  }

  settle(name, result) {
    const r = this.round, h = r.hands[name], banker = this.get(r.banker);
    const d = payout(h.bet, result, result === 'win' && isNatural(h.cards));
    h.cards.forEach(c => (c.hidden = false));
    h.challenged = true;
    h.result = { result, delta: d.player };
    this.get(name).chips += d.player;
    const before = banker.chips;
    // shortcut: un banquier ruiné s'arrête à 0 et le jeu couvre le reste, à revoir si on veut limiter les mises à la caisse du banquier
    banker.chips = Math.max(0, banker.chips + d.banker);
    r.bankerDelta += banker.chips - before;
  }

  endRound() {
    const r = this.round;
    this.phase = 'results';
    for (const h of Object.values(r.hands)) h.cards.forEach(c => (c.hidden = false));
    if (r.cancelled) return;
    const lines = r.order.map(n => `${n} ${signed(r.hands[n].result.delta)}`);
    this.say(`Bilan : ${[...lines, `${r.banker} (banquier) ${signed(r.bankerDelta)}`].join(' · ')}`, 'summary');
  }

  cancel(reason) {
    const r = this.round;
    for (const n of r.order) {
      const h = r.hands[n];
      if (h.result) this.get(n).chips -= h.result.delta;
      h.result = null;
    }
    this.get(r.banker).chips -= r.bankerDelta;
    r.bankerDelta = 0;
    r.cancelled = true;
    this.endRound();
    this.say(`Manche annulée (${reason}) : toutes les mises sont rendues`, 'lose');
  }

  disconnect(name, quiet = false) {
    const p = this.get(name);
    if (!p) return;
    p.connected = false;
    if (!quiet) this.say(`${name} s'est déconnecté`);
    const r = this.round;
    if (!r || this.phase === 'results') return;
    if (name === r.banker) return this.cancel('le banquier est parti');
    const h = r.hands[name];
    if (!h) return;
    if (this.phase === 'betting' && h.bet === null) {
      delete r.hands[name];
      r.order.splice(r.order.indexOf(name), 1);
      this.checkBets();
    } else if (this.phase === 'playing' && r.order[r.turn] === name) this.stand(name);
    // sinon il « reste » : son tour sera passé automatiquement s'il n'est pas revenu
  }

  leave(name, quiet = false) {
    const i = this.players.findIndex(p => p.name === name);
    if (i < 0) return;
    if (this.players[i].connected) this.disconnect(name, quiet);
    this.players[i].left = true;
    if (!quiet) this.say(`${name} quitte la table`);
    // en pleine manche sa main doit encore être défiée : on le retire à la manche suivante
    if (this.phase === 'waiting') this.remove(i);
  }

  // Le chef du lobby exclut un joueur ; banni, il ne peut plus revenir sous ce pseudo.
  kick(name, target, ban = false) {
    if (name !== this.host) throw new Error('Seul le chef du lobby peut exclure un joueur');
    const p = this.get(target);
    if (target === name || !p || p.left) throw new Error('Joueur introuvable');
    if (ban) this.banned.add(target);
    this.leave(target, true);
    this.say(`${target} a été ${ban ? 'banni' : 'exclu'} par ${name}`, 'lose');
  }

  ban(name, target) { this.kick(name, target, true); }

  // État envoyé à un joueur : les cartes cachées des autres n'y figurent jamais.
  viewFor(me) {
    const r = this.round, reveal = this.phase === 'results';
    return {
      lobby: this.name, phase: this.phase, me, host: this.host,
      banker: r?.banker ?? null,
      turn: this.phase === 'playing' ? r.order[r.turn] : null,
      cancelled: !!r?.cancelled,
      log: this.log, roundNo: this.roundNo,
      players: this.players.filter(p => !p.left || r?.hands[p.name]).map(p => {
        const isBanker = r?.banker === p.name, h = r?.hands[p.name], own = p.name === me;
        const cards = isBanker ? r.bankerCards : h?.cards ?? [];
        return {
          name: p.name, avatar: p.avatar, chips: p.chips, connected: p.connected, isBanker,
          inRound: !!h, bet: h?.bet ?? null, challenged: !!h?.challenged,
          result: isBanker && reveal && !r.cancelled ? { delta: r.bankerDelta } : h?.result ?? null,
          cards: cards.map(c => (c.hidden && !own ? { hidden: true } : c)),
          total: own || isBanker || reveal ? total(cards) : null,
        };
      }),
    };
  }
}

module.exports = { total, isNatural, outcome, payout, newDeck, Table, MAX_PLAYERS };
