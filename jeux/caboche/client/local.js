// Caboche Cup : un match joué entièrement dans le navigateur (tournoi, survie, défis, deux joueurs sur le même clavier).
// Mêmes règles que le salon en ligne (server/game.js) : coup d'envoi, jeu, but, fin ; but en or à égalité ;
// premier à N buts si demandé. Les robots jouent avec bot.js, la physique est celle de sim.js.
const CC = window.CC, Bot = window.CCBot;
const KICKOFF = 132, GOAL = 312, FRAME_MS = 1000 / CC.FPS, GOLDEN_MS = 60000;

export class LocalMatch {
  // players : [{ id, char, acc, side, bot }] (bot : niveau 1 à 3, ou 0 pour un humain)
  // settings : { time (s), goals (0 : au temps), mode, stade, bonus }
  constructor(players, settings) {
    this.players = players;
    this.settings = { time: 120, goals: 0, mode: 'normal', stade: 'nuit', bonus: 1, ...settings };
    const s = this.settings;
    this.world = CC.world(players.map(p => ({ id: p.id, char: p.char, side: p.side })), { mode: s.mode, stade: s.stade, bonus: !!s.bonus, seed: 1 + Math.floor(Math.random() * 1e9) });
    this.score = [0, 0];
    this.clockMs = s.time * 1000;
    this.golden = false;
    this.phase = 'kickoff'; this.pt = 0;
    this.events = []; this.brains = {}; this.result = null;
  }
  sides() { return [0, 1].map(s => this.players.filter(p => p.side === s).map(p => p.id)); }
  reached() { return this.settings.goals > 0 && Math.max(...this.score) >= this.settings.goals; }
  to(phase) { this.phase = phase; this.pt = 0; }
  // Une image ; inputs : touches des humains par identifiant.
  step(inputs) {
    this.pt++;
    if (this.phase === 'end') return;
    if (this.phase === 'kickoff') { if (this.pt >= KICKOFF) this.to('play'); else return; }
    if (this.phase === 'goal' && this.pt >= GOAL) { if (this.golden || this.clockMs <= 0 || this.reached()) return this.end(); CC.kickoff(this.world); return this.to('kickoff'); }
    const w = this.world, all = {};
    for (const p of this.players) all[p.id] = p.bot ? (this.phase === 'play' ? Bot.think(w, w.players.find(q => q.id === p.id), p.bot, Math.random, (this.brains[p.id] ??= {})) : 0) : inputs[p.id] ?? 0;
    const side = CC.stepWorld(w, all, this.events);
    if (this.phase !== 'play') return;
    this.clockMs -= FRAME_MS;
    if (side !== null) {
      this.score[side]++;
      const team = w.players.filter(p => p.side === side), scorer = team.find(p => p.id === w.touch) ?? team[0];
      for (const p of w.players) if (p.side !== side) p.gauge = Math.min(1, p.gauge + 0.25);
      this.events.push({ t: 'goal', side, by: scorer.id, touch: w.touch, own: !!w.touch && !team.some(p => p.id === w.touch), score: [...this.score] });
      this.to('goal');
    } else if (this.clockMs <= 0) {
      if (this.score[0] === this.score[1] && !this.golden) { this.golden = true; this.clockMs = GOLDEN_MS; this.events.push({ t: 'golden' }); }
      else this.end();
    }
  }
  // Fin du match, ou plus tôt (défi réussi, abandon : forfeit = côté qui abandonne).
  end(forfeit = null) {
    const [s0, s1] = this.score, win = forfeit !== null ? 1 - forfeit : s0 === s1 ? null : s0 > s1 ? 0 : 1;
    this.result = { score: [s0, s1], win, forfeit, sides: this.sides() };
    this.to('end');
  }
}
