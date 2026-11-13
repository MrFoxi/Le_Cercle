// La Castagne : la simulation du combat, partagée par le serveur (qui fait foi) et le navigateur (qui anticipe son
// propre personnage). Script classique : window.BR ou require. 60 images par seconde, unités en pixels, y vers le bas.
// Un combattant se déplace, saute (un saut au sol, deux en l'air, contre les murs), s'accroche au rebord, esquive
// (même pour annuler un coup qui a touché), attaque à mains nues ou avec une arme ramassée (six familles), la lance ;
// les coups ajoutent des dégâts et éjectent d'autant plus loin que les dégâts sont hauts ; sortir de l'arène coûte une vie.
// Testé par jeux/castagne/castagne.test.js.
(function (root, factory) {
  const BR = factory();
  if (typeof module === 'object' && module.exports) module.exports = BR;
  else root.BR = BR;
})(this, () => {
  const FPS = 60;
  const IN = { L: 1, R: 2, U: 4, D: 8, JUMP: 16, LIGHT: 32, HEAVY: 64, DODGE: 128, PICK: 256 };
  const HW = 22, HH = 86; // demi-largeur et hauteur du corps (pieds en y)
  const BUFMASK = IN.JUMP | IN.LIGHT | IN.HEAVY | IN.DODGE | IN.PICK;
  const CHARGE = 45; // images de charge au plus
  const chargeK = f => 1 + ((f.charge ?? 0) / CHARGE) * 0.45;

  /* ---------------- Arène ---------------- */
  const ARENAS = {
    phare: {
      name: 'Le Phare des Nuées',
      solids: [{ x0: -430, x1: 430, y0: 0, y1: 240 }], // l'île principale (on ne passe pas au travers ; on s'accroche à ses rebords)
      plats: [{ x0: -340, x1: -140, y: -175 }, { x0: 140, x1: 340, y: -175 }, { x0: -95, x1: 95, y: -330 }], // planches traversables par en dessous
      blast: { l: -1180, r: 1180, t: -950, b: 720 },
      spawns: [[-260, 0], [260, 0], [-90, 0], [90, 0], [-370, 0], [370, 0], [-240, -175], [240, -175]],
      respawn: [0, -520],
    },
  };

  /* ---------------- Coups ---------------- */
  // Une attaque : f images en tout ; hits : fenêtres actives (s → e) avec une boîte (x vers l'avant, y depuis les pieds,
  // largeur, hauteur), des dégâts, un recul de base (kb) qui grandit avec les dégâts déjà subis (ks), une direction (dx, dy) ;
  // « shot » : au lieu d'une boîte, un projectile ; vel : vitesses imposées ; grav : gravité pendant le coup ; land : temps
  // de récupération à l'atterrissage.
  function moveset(k, tweak) {
    const T = n => Math.max(1, Math.round(n * k.spd)), P = n => +(n * k.pow).toFixed(2), R = n => Math.round(n * k.reach);
    const hit = (s, e, x, y, w, h, dmg, kb, ks, dx, dy, o = {}) => ({ s: T(s), e: T(e), x: R(x), y, w: R(w), h, dmg: P(dmg), kb: P(kb), ks, dx, dy: dy + (k.lift ?? 0) * (dy < 0 ? 1 : 0), ...o });
    const m = {
      jab: { f: T(20), vel: [[2, 4.5, null]], hits: [hit(3, 10, 52, -56, 72, 34, 5, 3.2, 0.025, 1, -0.3)] },
      sLight: { f: T(26), vel: [[2, 11.5, null]], hits: [hit(5, 14, 58, -52, 76, 36, 7, 4, 0.045, 1, -0.35)] },
      dLight: { f: T(28), vel: [[2, 10, null]], hits: [hit(4, 14, 48, -14, 82, 28, 6, 4.5, 0.035, 0.45, -1)] },
      nHeavy: { f: T(42), vel: [[T(10), 2, -3]], hits: [hit(10, 22, 28, -104, 84, 84, 13, 6, 0.1, 0.15, -1)], heavy: true },
      sHeavy: { f: T(46), vel: [[T(13), 8, null]], hits: [hit(13, 24, 76, -52, 104, 44, 16, 7, 0.13, 1, -0.42)], heavy: true },
      dHeavy: { f: T(44), hits: [hit(12, 24, 0, -22, 200, 36, 14, 6.5, 0.11, 1, -0.6, { both: true })], heavy: true },
      nAir: { f: T(28), air: true, land: 5, hits: [hit(4, 16, 0, -46, 124, 92, 8, 4, 0.05, 0.6, -0.8, { both: true })] },
      sAir: { f: T(28), air: true, land: 6, vel: [[4, 8, null]], hits: [hit(5, 16, 62, -46, 82, 40, 9, 5, 0.07, 1, -0.3)] },
      dAir: { f: T(32), air: true, land: 7, hits: [hit(6, 18, 6, 6, 66, 44, 10, 5, 0.07, 0.25, 1, { spike: true })] },
      aHeavy: { f: T(38), air: true, land: 9, vel: [[T(9), 6, -2]], hits: [hit(9, 19, 66, -50, 96, 54, 13, 6.5, 0.11, 1, -0.45)], heavy: true },
      recovery: { f: T(38), air: true, land: 10, grav: 0.45, once: true, vel: [[3, 3, -17]], hits: [hit(3, 16, 14, -82, 74, 92, 11, 6, 0.08, 0.3, -1)], heavy: true },
      pound: { f: T(60), air: true, land: 12, pound: true, vel: [[T(8), 0, 24]], hits: [hit(8, 60, 0, 2, 96, 48, 14, 6.5, 0.1, 0.7, -0.7, { both: true })], heavy: true },
    };
    tweak?.(m, hit, T);
    return m;
  }

  /* ---------------- Armes : des coups légers propres à chacune ---------------- */
  // hit(s, e, x, y, l, h, dégâts, recul, croissance, dx, dy, options) ; options : g (coup en plusieurs touches : un groupe
  // par touche), move (la boîte avance de n px par image), fx (effet : feu, vent, taille, onde, foudre, glace), both, shot.
  const WEAPONS = {
    epee: { name: 'Épée', icon: '🗡️', k: { spd: 0.92, pow: 1.05 }, lights: (hit, T) => ({
      jab: { f: T(20), hits: [hit(3, 7, 60, -58, 90, 30, 4, 3, 0.02, 1, -0.3, { g: 0 }), hit(9, 13, 60, -50, 90, 30, 4, 3.4, 0.03, 1, -0.35, { g: 1 })] },
      sLight: { f: T(26), vel: [[3, 13, null]], hits: [hit(5, 13, 70, -52, 110, 30, 7, 4, 0.045, 1, -0.3)] },
      dLight: { f: T(28), vel: [[2, 12, null]], hits: [hit(4, 14, 60, -12, 120, 22, 6, 4.5, 0.035, 0.5, -1)] },
      nAir: { f: T(28), air: true, land: 5, hits: [hit(4, 16, 0, -46, 150, 110, 8, 4, 0.05, 0.6, -0.8, { both: true })] },
      sAir: { f: T(28), air: true, land: 6, hits: [hit(5, 15, 70, -50, 120, 50, 9, 5, 0.07, 1, -0.25)] },
      dAir: { f: T(30), air: true, land: 7, vel: [[4, 4, 10]], hits: [hit(5, 18, 30, 0, 70, 50, 9, 5, 0.06, 0.3, 1, { spike: true })] },
    }) },
    lance: { name: 'Lance', icon: '🔱', k: { spd: 1.08, pow: 1.0 }, lights: (hit, T) => ({
      jab: { f: T(24), hits: [hit(5, 12, 100, -58, 150, 24, 6, 3.6, 0.03, 1, -0.25)] },
      sLight: { f: T(30), vel: [[3, 14, null]], hits: [hit(6, 16, 110, -54, 170, 26, 8, 4.5, 0.05, 1, -0.3)] },
      dLight: { f: T(30), hits: [hit(6, 15, 90, -10, 180, 22, 7, 4.5, 0.04, 0.6, -1)] },
      nAir: { f: T(30), air: true, land: 6, hits: [hit(6, 16, 0, -110, 80, 140, 8, 4, 0.05, 0.2, -1)] },
      sAir: { f: T(30), air: true, land: 6, hits: [hit(6, 16, 100, -46, 170, 26, 9, 5, 0.07, 1, -0.2)] },
      dAir: { f: T(32), air: true, land: 7, hits: [hit(6, 20, 10, 40, 40, 120, 10, 5, 0.07, 0.2, 1, { spike: true })] },
    }) },
    pistolets: { name: 'Pistolets', icon: '🔫', k: { spd: 0.95, pow: 0.95 }, lights: (hit, T) => {
      const shot = (s, dx, dy, o = {}) => hit(s, s, 30, -60, 14, 10, 4, 2.6, 0.02, dx, dy, { shot: { speed: 17, life: 32, ...o } });
      return {
        jab: { f: T(20), hits: [shot(5, 1, -0.15)] },
        sLight: { f: T(26), vel: [[2, -4, null]], hits: [{ ...shot(6, 1, -0.2), g: 0 }, { ...shot(12, 1, -0.2), g: 1 }] },
        dLight: { f: T(26), vel: [[2, 11, null]], hits: [hit(4, 13, 50, -12, 90, 24, 6, 4.5, 0.035, 0.5, -1)] },
        nAir: { f: T(26), air: true, land: 5, hits: [{ ...shot(6, 1, 0), g: 0 }, { ...shot(6, -1, 0), g: 1 }] },
        sAir: { f: T(26), air: true, land: 5, hits: [shot(6, 1, 0)] },
        dAir: { f: T(28), air: true, land: 6, hits: [hit(7, 7, 0, 10, 14, 10, 5, 3, 0.03, 0, 1, { shot: { speed: 17, life: 26, down: true } })] },
      };
    } },
    marteau: { name: 'Marteau', icon: '🔨', k: { spd: 1.2, pow: 1.3 }, lights: (hit, T) => ({
      jab: { f: T(28), hits: [hit(9, 15, 60, -40, 110, 90, 8, 4.5, 0.05, 0.6, -0.8)] },
      sLight: { f: T(32), vel: [[4, 8, null]], hits: [hit(9, 18, 70, -50, 130, 60, 9, 5, 0.06, 1, -0.4)] },
      dLight: { f: T(34), hits: [hit(10, 16, 0, -14, 200, 28, 8, 5, 0.05, 1, -0.7, { both: true, fx: 'shock' })] },
      nAir: { f: T(32), air: true, land: 7, hits: [hit(7, 18, 0, -70, 130, 120, 9, 5, 0.06, 0.3, -1)] },
      sAir: { f: T(32), air: true, land: 7, hits: [hit(8, 18, 70, -46, 120, 70, 10, 5.5, 0.08, 1, -0.35)] },
      dAir: { f: T(34), air: true, land: 9, vel: [[6, 0, 14]], hits: [hit(6, 24, 0, 10, 90, 50, 11, 6, 0.08, 0.4, 1, { spike: true })] },
    }) },
    hache: { name: 'Hache', icon: '🪓', k: { spd: 1.1, pow: 1.2 }, lights: (hit, T) => ({
      jab: { f: T(24), hits: [hit(5, 11, 50, -70, 90, 90, 6, 4, 0.04, 0.3, -1)] },
      sLight: { f: T(28), vel: [[3, 10, null]], hits: [hit(6, 14, 70, -50, 110, 40, 7, 4.2, 0.045, -0.4, -0.6)] }, // crochet qui ramène vers soi
      dLight: { f: T(30), hits: [hit(6, 14, 60, -12, 130, 24, 7, 4.5, 0.04, 0.6, -1)] },
      nAir: { f: T(30), air: true, land: 6, hits: [hit(4, 18, 0, -46, 140, 130, 8, 4, 0.05, 0.4, -1, { both: true })] },
      sAir: { f: T(30), air: true, land: 6, hits: [hit(6, 16, 70, -46, 110, 60, 9, 5, 0.07, 0.8, -0.6)] },
      dAir: { f: T(32), air: true, land: 7, hits: [hit(7, 18, 30, 10, 80, 50, 10, 5, 0.07, 0.3, 1, { spike: true })] },
    }) },
    gantelets: { name: 'Gantelets', icon: '🥊', k: { spd: 0.8, pow: 0.9 }, lights: (hit, T) => ({
      jab: { f: T(24), hits: [hit(3, 7, 50, -56, 70, 34, 3.5, 2, 0.01, 1, -0.2, { g: 0 }), hit(10, 15, 54, -56, 74, 34, 4.5, 3.6, 0.03, 1, -0.4, { g: 1 })] },
      sLight: { f: T(30), vel: [[2, 11, null], [10, 8, null]], hits: [hit(3, 6, 50, -56, 70, 34, 2.5, 1.5, 0, 1, -0.1, { g: 0 }), hit(9, 12, 50, -56, 70, 34, 2.5, 1.5, 0, 1, -0.1, { g: 1 }), hit(15, 19, 56, -56, 80, 34, 5, 4.2, 0.04, 1, -0.4, { g: 2 })] },
      dLight: { f: T(26), hits: [hit(4, 10, 40, -60, 70, 90, 6, 4, 0.04, 0.2, -1)] },
      nAir: { f: T(30), air: true, land: 5, hits: [0, 1, 2].map(k => hit(4 + k * 5, 7 + k * 5, 30, -50, 90, 70, 2.5, 1.2, 0, 0.3, -0.5, { g: k })).concat([hit(20, 24, 30, -50, 100, 80, 5, 4.5, 0.05, 0.6, -0.8, { g: 3 })]) },
      sAir: { f: T(26), air: true, land: 5, hits: [hit(5, 14, 55, -40, 80, 40, 8, 4.5, 0.06, 1, -0.3)] },
      dAir: { f: T(30), air: true, land: 6, vel: [[4, 0, 12]], hits: [hit(5, 10, 10, 6, 60, 40, 4, 2, 0.01, 0, 1, { g: 0 }), hit(14, 22, 10, 6, 70, 44, 7, 5, 0.06, 0.3, 1, { g: 1, spike: true })] },
    }) },
  };
  const WEAPON_IDS = Object.keys(WEAPONS);

  /* ---------------- Coups lourds signatures : un trio par personnage et par arme ---------------- */
  // Au sol, on peut les charger en gardant la touche (jusqu'à 3/4 de seconde) : plus de dégâts et d'éjection.
  const SIGS = {
    fenna: {
      mains: (hit, T) => ({
        nHeavy: { f: T(44), spin: true, vel: [[T(10), 2, -6]], hits: [hit(10, 16, 10, -90, 90, 90, 5, 2, 0.01, 0.1, -1, { g: 0, fx: 'wind' }), hit(18, 26, 10, -110, 100, 100, 9, 6.5, 0.11, 0.15, -1, { g: 1, fx: 'wind' })] },
        sHeavy: { f: T(46), vel: [[T(12), 16, -2]], hits: [hit(12, 24, 60, -60, 100, 50, 14, 7, 0.13, 1, -0.35, { fx: 'slash' })] },
        dHeavy: { f: T(44), spin: true, hits: [hit(12, 26, 0, -20, 220, 40, 13, 6.5, 0.11, 1, -0.55, { both: true, fx: 'wind' })] },
      }),
      epee: (hit, T) => ({
        nHeavy: { f: T(50), spin: true, vel: [[T(8), 0, -10]], hits: [0, 1, 2].map(k => hit(8 + k * 6, 12 + k * 6, 0, -80 - k * 10, 120, 110, 3, 1.5, 0, 0, -1, { g: k, both: true, fx: 'wind' })).concat([hit(26, 32, 0, -110, 130, 120, 9, 7, 0.12, 0.2, -1, { g: 3, both: true, fx: 'wind' })]) },
        sHeavy: { f: T(48), vel: [[T(11), 20, null]], hits: [hit(11, 22, 40, -56, 110, 70, 15, 7.5, 0.13, 1, -0.38, { fx: 'slash' })] },
        dHeavy: { f: T(50), hits: [hit(12, 32, 40, -30, 60, 60, 13, 6.5, 0.11, 0.5, -1, { move: 9, fx: 'ice' })] },
      }),
      lance: (hit, T) => ({
        nHeavy: { f: T(48), hits: [hit(12, 24, 30, -150, 70, 200, 15, 7, 0.12, 0.1, -1, { fx: 'lightning' })] },
        sHeavy: { f: T(50), vel: [[T(12), 18, null]], hits: [hit(12, 26, 130, -54, 210, 40, 15, 7.5, 0.13, 1, -0.32, { fx: 'lightning' })] },
        dHeavy: { f: T(48), spin: true, hits: [hit(12, 18, 0, -16, 300, 30, 6, 3, 0.02, 1, -0.4, { g: 0, both: true, fx: 'wind' }), hit(22, 30, 0, -16, 300, 30, 10, 6.5, 0.11, 1, -0.6, { g: 1, both: true, fx: 'wind' })] },
      }),
      pistolets: (hit, T) => ({
        nHeavy: { f: T(46), hits: [hit(12, 22, 10, -140, 80, 150, 14, 7, 0.12, 0.1, -1, { fx: 'fire' })] },
        sHeavy: { f: T(48), vel: [[T(14), -6, null]], hits: [hit(14, 14, 40, -58, 30, 30, 14, 7.5, 0.13, 1, -0.35, { fx: 'fire', shot: { speed: 22, life: 40, big: true } })] },
        dHeavy: { f: T(46), vel: [[T(10), 0, -10]], hits: [hit(14, 14, 20, -40, 24, 24, 9, 6, 0.1, 1, -0.5, { g: 0, fx: 'fire', shot: { speed: 20, life: 30, dir: [1, 1], big: true } }), hit(14, 14, 20, -40, 24, 24, 9, 6, 0.1, -1, -0.5, { g: 1, fx: 'fire', shot: { speed: 20, life: 30, dir: [-1, 1], big: true } })] },
      }),
    },
    gromm: {
      mains: (hit, T) => ({
        nHeavy: { f: T(44), vel: [[T(10), 2, -5]], hits: [hit(10, 20, 24, -100, 90, 110, 14, 6.5, 0.11, 0.15, -1, { fx: 'fire' })] },
        sHeavy: { f: T(48), vel: [[T(12), 15, null]], hits: [hit(12, 26, 40, -52, 80, 70, 16, 7, 0.13, 1, -0.42, { fx: 'shock' })] },
        dHeavy: { f: T(50), hits: [hit(14, 30, 30, -20, 60, 50, 13, 6.5, 0.11, 1, -0.7, { g: 0, move: 8, fx: 'shock' }), hit(14, 30, -30, -20, 60, 50, 13, 6.5, 0.11, -1, -0.7, { g: 1, move: -8, fx: 'shock' })] },
      }),
      marteau: (hit, T) => ({
        nHeavy: { f: T(46), hits: [hit(12, 22, 30, -110, 150, 140, 15, 7, 0.12, 0.2, -1, { fx: 'fire' })] },
        sHeavy: { f: T(54), spin: true, vel: [[T(8), 9, null], [T(20), 9, null]], hits: [hit(8, 14, 30, -50, 150, 90, 4, 2, 0.01, 0.4, -0.4, { g: 0, both: true, fx: 'wind' }), hit(16, 22, 30, -50, 150, 90, 4, 2, 0.01, 0.4, -0.4, { g: 1, both: true, fx: 'wind' }), hit(24, 32, 40, -50, 160, 90, 11, 7.5, 0.13, 1, -0.45, { g: 2, fx: 'fire' })] },
        dHeavy: { f: T(54), hits: [hit(16, 36, 40, -24, 80, 60, 15, 7, 0.12, 1, -0.75, { g: 0, move: 10, fx: 'shock' }), hit(16, 36, -40, -24, 80, 60, 15, 7, 0.12, -1, -0.75, { g: 1, move: -10, fx: 'shock' })] },
      }),
      hache: (hit, T) => ({
        nHeavy: { f: T(48), vel: [[T(8), 0, -8]], hits: [hit(8, 14, 40, -90, 110, 90, 5, 2.5, 0.01, 0.2, -1, { g: 0, fx: 'fire' }), hit(18, 26, 30, -120, 120, 120, 11, 7, 0.12, 0.15, -1, { g: 1, fx: 'fire' })] },
        sHeavy: { f: T(50), spin: true, vel: [[T(12), 13, -4]], hits: [hit(12, 26, 50, -60, 120, 100, 16, 7.5, 0.13, 0.9, -0.6, { fx: 'fire' })] },
        dHeavy: { f: T(50), hits: [hit(16, 34, 60, -26, 70, 60, 14, 7, 0.12, 0.4, -1, { move: 7, fx: 'shock' })] },
      }),
      gantelets: (hit, T) => ({
        nHeavy: { f: T(44), vel: [[T(8), 2, -13]], hits: [hit(8, 20, 20, -100, 70, 110, 13, 7, 0.12, 0.15, -1, { fx: 'lightning' })] },
        sHeavy: { f: T(46), vel: [[T(10), 24, null]], hits: [hit(10, 22, 50, -56, 80, 50, 15, 7.5, 0.13, 1, -0.35, { fx: 'lightning' })] },
        dHeavy: { f: T(46), hits: [hit(12, 20, 0, -20, 180, 40, 6, 3, 0.02, 1, -0.3, { g: 0, both: true, fx: 'shock' }), hit(22, 30, 0, -20, 220, 44, 11, 6.5, 0.11, 1, -0.65, { g: 1, both: true, fx: 'shock' })] },
      }),
    },
  };

  /* ---------------- Personnages ---------------- */
  const CHARS = {
    fenna: { name: 'Fenna', title: 'la renarde voltigeuse', weight: 90, run: 9.6, accel: 1.7, airSpeed: 8.2, airAccel: 0.8, jump: 16, airJump: 13.4, grav: 0.63, fall: 12.5, fastFall: 20, k: { spd: 1, pow: 1, reach: 1 }, weapons: ['epee', 'lance', 'pistolets'], stats: { vitesse: 5, force: 2, poids: 2, portée: 3 } },
    gromm: { name: 'Gromm', title: 'l’ours forgeron', weight: 118, run: 7.8, accel: 1.25, airSpeed: 6.8, airAccel: 0.62, jump: 15.8, airJump: 12.8, grav: 0.67, fall: 13.5, fastFall: 21, k: { spd: 1.18, pow: 1.28, reach: 1.15 }, weapons: ['marteau', 'hache', 'gantelets'], stats: { vitesse: 2, force: 5, poids: 5, portée: 4 } },
  };
  const CHAR_IDS = Object.keys(CHARS);
  // Coups de chaque personnage, à mains nues et avec chacune de ses armes : base, coups légers de l'arme, signatures.
  const MOVES = {};
  for (const [id, c] of Object.entries(CHARS)) {
    MOVES[id] = {};
    for (const w of ['mains', ...WEAPON_IDS]) {
      const W = WEAPONS[w], k = W ? { spd: c.k.spd * W.k.spd, pow: c.k.pow * W.k.pow, reach: c.k.reach } : c.k;
      MOVES[id][w] = moveset(k, (m, hit, T) => {
        if (W) Object.assign(m, W.lights(hit, T));
        const sig = (SIGS[id][w] ?? SIGS[id].mains)(hit, T);
        for (const v of Object.values(sig)) { v.heavy = true; v.sig = true; v.fx = v.hits.find(h => h.fx)?.fx; }
        Object.assign(m, sig);
      });
    }
    c.moves = MOVES[id].mains;
  }
  const movesOf = f => MOVES[f.char][f.weapon ?? 'mains'];
  const MOVE_IDS = Object.keys(MOVES.fenna.mains);

  /* ---------------- Un combattant ---------------- */
  function fighter(id, char, [x, y], facing = 1) {
    return { id, char, x, y, vx: 0, vy: 0, facing, state: 'air', move: null, mt: 0, ground: false, jumps: 2, wallJumps: 3, coyote: 0, drop: 0, dmg: 0, stocks: 3, hitstun: 0, hitlag: 0, invuln: 0, dodgeCd: 0, airDodge: false, recovery: true, prevIn: 0, hitIds: [], lag: 0, dead: 0, wall: 0, lastHit: null, kos: 0, falls: 0, weapon: null, ledgeT: 0, ledgeCd: 0, combo: 0, buf: 0, bufT: 0, charge: 0 };
  }
  const C = f => CHARS[f.char];

  function startMove(f, id) {
    f.state = 'attack'; f.move = id; f.mt = 0; f.hitIds = []; f.charge = 0;
    if (movesOf(f)[id].once) f.recovery = false;
  }
  function pickMove(f, inp, heavy) {
    const side = (inp & IN.L ? -1 : 0) + (inp & IN.R ? 1 : 0), down = inp & IN.D;
    if (side) f.facing = side;
    if (f.ground) return heavy ? (down ? 'dHeavy' : side ? 'sHeavy' : 'nHeavy') : down ? 'dLight' : side ? 'sLight' : 'jab';
    if (heavy) return down ? 'pound' : inp & IN.U ? (f.recovery ? 'recovery' : null) : 'aHeavy';
    return down ? 'dAir' : side ? 'sAir' : 'nAir';
  }
  function startDodge(f, inp, dir) {
    f.state = 'dodge'; f.mt = 0; f.dodgeCd = 54; f.hitIds = [];
    const dy = (inp & IN.D ? 1 : 0) - (inp & IN.U ? 1 : 0);
    if (!f.ground && (dir || dy)) { const l = Math.hypot(dir, dy); f.move = 'air'; f.vx = (dir / l) * 13; f.vy = (dy / l) * 13; f.invuln = 14; f.airDodge = true; }
    else { f.move = 'spot'; f.invuln = 20; if (!f.ground) f.airDodge = true; }
    f.events?.push('dodge');
  }

  function support(f, A) {
    for (const s of A.solids) if (f.x > s.x0 - HW * 0.6 && f.x < s.x1 + HW * 0.6 && Math.abs(f.y - s.y0) < 0.5) return true;
    if (f.drop > 0) return false;
    for (const p of A.plats) if (f.x > p.x0 && f.x < p.x1 && Math.abs(f.y - p.y) < 0.5) return true;
    return false;
  }
  function land(f) { f.ground = true; f.vy = 0; f.jumps = 2; f.wallJumps = 3; f.airDodge = false; f.recovery = true; }
  // Rebord de l'île : on s'y accroche en tombant tout près.
  function tryLedge(f, A) {
    if (f.ledgeCd > 0 || f.vy < 0) return false;
    for (const s of A.solids) for (const [ex, side] of [[s.x0, 1], [s.x1, -1]]) {
      const hx = ex - side * HW;
      if (Math.abs(f.x - hx) < 18 && f.y > s.y0 + 8 && f.y < s.y0 + 80) {
        Object.assign(f, { state: 'ledge', x: hx, y: s.y0 + 56, vx: 0, vy: 0, facing: side, ledgeT: 0, jumps: 2, recovery: true, airDodge: false, wallJumps: 3, move: null });
        f.invuln = Math.max(f.invuln, 24);
        f.events?.push('ledge');
        return true;
      }
    }
    return false;
  }

  // Une image pour un combattant, avec ses touches (bits IN). Les coups qui touchent sont réglés par resolve().
  function step(f, inp, A) {
    if (f.state === 'out') return;
    if (f.dead > 0) { if (--f.dead === 0) respawn(f, A); return; }
    const fresh = inp & ~f.prevIn & BUFMASK;
    if (fresh) { f.buf = fresh; f.bufT = 8; } else if (f.bufT > 0 && --f.bufT === 0) f.buf = 0; // une touche appuyée trop tôt reste en mémoire
    if (f.hitlag > 0) { f.hitlag--; f.prevIn = inp; return; } // gel de l'impact
    const c = C(f), M = movesOf(f), pressed = (inp & ~f.prevIn) | (f.bufT > 0 ? f.buf : 0);
    f.prevIn = inp;
    const used = bits => { f.buf &= ~bits; if (!f.buf) f.bufT = 0; };
    const dir = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0);
    if (f.invuln > 0) f.invuln--;
    if (f.dodgeCd > 0) f.dodgeCd--;
    if (f.drop > 0) f.drop--;
    if (f.coyote > 0) f.coyote--;
    if (f.ledgeCd > 0) f.ledgeCd--;
    let grav = c.grav, maxFall = c.fall;

    if (f.state === 'ledge') {
      f.ledgeT++;
      const away = dir === -f.facing;
      if (pressed & IN.JUMP) { used(IN.JUMP); f.state = 'air'; f.vy = -c.jump; f.ledgeCd = 30; f.events?.push('jump'); }
      else if ((inp & IN.U) || (dir === f.facing && f.ledgeT > 6) || (pressed & (IN.LIGHT | IN.HEAVY))) { used(IN.LIGHT | IN.HEAVY); f.x += f.facing * (HW * 2 + 6); f.y -= 56; f.state = 'lag'; f.lag = 8; f.ground = true; f.ledgeCd = 20; f.events?.push('climb'); }
      else if ((pressed & IN.D) || (away && f.ledgeT > 6) || f.ledgeT > 150) { f.state = 'air'; f.ledgeCd = 40; f.x -= f.facing * 6; }
      return;
    }
    if (f.state === 'hitstun') {
      f.vx *= 0.986; f.vx += dir * 0.12;
      if (--f.hitstun <= 0) { f.state = 'air'; f.combo = 0; }
      maxFall = c.fall * 1.6;
    } else if (f.state === 'lag') {
      f.vx *= 0.8;
      if (--f.lag <= 0) f.state = 'idle';
    } else if (f.state === 'dodge') {
      f.mt++;
      if (f.move === 'air') { grav = 0; if (f.mt > 14) { f.state = 'air'; f.vx *= 0.4; f.vy *= 0.4; } }
      else { f.vx *= 0.75; if (f.mt > 22) f.state = f.ground ? 'idle' : 'air'; }
    } else if (f.state === 'attack') {
      const m = M[f.move];
      if (m.sig && !m.air && f.mt === 1 && f.ground && inp & IN.HEAVY && f.charge < CHARGE) { f.charge++; f.vx *= 0.8; if (f.charge === 1) f.events?.push('charge'); } // charge du coup lourd
      else f.mt++;
      if (f.mt <= 3 && dir && !f.hitIds.length && !m.pound) f.facing = dir; // on peut encore se retourner
      for (const [fr, vx, vy] of m.vel ?? []) if (fr === f.mt) { if (vx !== null) f.vx = vx * f.facing; if (vy !== null) f.vy = vy; }
      for (const h of m.hits) if (h.shot && f.mt === h.s) { const sh = h.shot, [sx, sy] = sh.dir ?? (sh.down ? [0, 1] : [Math.sign(h.dx), 0]), l = Math.hypot(sx, sy); f.spawn?.push({ kind: sh.big ? 'boulet' : 'balle', x: f.x + h.x * f.facing * Math.sign(sx), y: f.y + (sh.down ? -10 : h.y), vx: (sx / l) * sh.speed * f.facing, vy: (sy / l) * sh.speed, life: sh.life, h, ck: chargeK(f) }); }
      if (f.ground && !m.air) f.vx *= 0.9;
      else { f.vx += dir * c.airAccel * 0.5; f.vx = Math.max(-c.airSpeed, Math.min(c.airSpeed, f.vx)); }
      if (m.grav !== undefined && f.mt < m.f * 0.6) grav = c.grav * m.grav;
      if (m.pound) { grav = 0; maxFall = 24; }
      if (pressed & IN.DODGE && f.hitIds.length && f.dodgeCd === 0) { used(IN.DODGE); startDodge(f, inp, dir); } // l'esquive annule un coup qui a touché
      else if (f.mt >= m.f && !m.pound) { f.state = f.ground ? 'idle' : 'air'; f.move = null; }
    } else {
      // libre : courir, sauter, tomber vite, traverser une planche, esquiver, attaquer, ramasser ou lancer une arme
      if (f.ground) {
        const target = dir * c.run;
        f.vx += Math.sign(target - f.vx) * Math.min(Math.abs(target - f.vx), dir ? c.accel : c.accel * 1.6);
        if (dir) f.facing = dir;
        f.state = dir ? 'run' : 'idle';
      } else {
        f.vx += dir * c.airAccel;
        if (!dir) f.vx *= 0.97;
        f.vx = Math.max(-c.airSpeed * 1.15, Math.min(c.airSpeed * 1.15, f.vx));
        f.state = 'air';
        if (inp & IN.D && f.vy > -2) { f.vy = Math.max(f.vy, c.fastFall * 0.8); maxFall = c.fastFall; }
      }
      if (pressed & IN.JUMP && (f.ground || f.coyote > 0 || (f.wall && f.wallJumps > 0) || f.jumps > 0)) {
        used(IN.JUMP);
        if (f.ground || f.coyote > 0) { f.vy = -c.jump; f.ground = false; f.coyote = 0; f.events?.push('jump'); }
        else if (f.wall && f.wallJumps > 0) { f.wallJumps--; f.vy = -c.airJump; f.vx = -f.wall * 7.5; f.facing = -f.wall; f.events?.push('walljump'); }
        else if (f.jumps > 0) { f.jumps--; f.vy = -c.airJump; if (dir) f.vx = dir * c.airSpeed; f.events?.push('airjump'); }
      }
      if (!(inp & IN.JUMP) && f.vy < -4 && !f.ground) f.vy += c.grav * 0.9; // saut court si on relâche tôt
      if (f.ground && pressed & IN.D) { for (const p of A.plats) if (f.x > p.x0 && f.x < p.x1 && Math.abs(f.y - p.y) < 0.5) { f.drop = 12; f.ground = false; f.vy = 2; } }
      if (pressed & IN.PICK) {
        used(IN.PICK);
        if (f.weapon) { // lancer son arme droit devant (ou vers le haut, vers le bas)
          const up = inp & IN.U ? -1 : inp & IN.D ? 1 : 0;
          f.spawn?.push({ kind: 'arme', weapon: f.weapon, x: f.x + f.facing * 20, y: f.y - 60, vx: f.facing * (up ? 9 : 19), vy: up * 15 - 3, life: 70, spin: 0, h: { dmg: 9, kb: 6, ks: 0.06, dx: 1, dy: -0.5 } });
          f.weapon = null; f.events?.push('throw');
        } else f.wantPick = true;
      }
      if (pressed & IN.DODGE && f.dodgeCd === 0 && (f.ground || !f.airDodge)) { used(IN.DODGE); startDodge(f, inp, dir); }
      else if (pressed & (IN.LIGHT | IN.HEAVY)) { const id = pickMove(f, inp, pressed & IN.HEAVY); used(IN.LIGHT | IN.HEAVY); if (id) startMove(f, id); }
    }
    if (f.state === 'dodge' && f.move === 'spot' && !f.ground) grav *= 0.4;

    // gravité et déplacement
    if (!f.ground) f.vy = Math.min(f.vy + grav, Math.max(maxFall, f.vy));
    const px = f.x, py = f.y;
    f.x += f.vx; f.y += f.vy;
    f.wall = 0;
    const wasGround = f.ground;
    f.ground = false;
    if (f.vy >= 0 && f.drop === 0 && !(f.state === 'hitstun' && inp & IN.D)) for (const p of A.plats) if (py <= p.y + 0.5 && f.y >= p.y && f.x > p.x0 && f.x < p.x1) { f.y = p.y; f.ground = true; }
    for (const s of A.solids) {
      if (f.x + HW <= s.x0 || f.x - HW >= s.x1 || f.y <= s.y0 || f.y - HH >= s.y1) continue;
      if (py <= s.y0 + 0.5 && f.vy >= 0) { f.y = s.y0; f.ground = true; }
      else if (py - HH >= s.y1 - 0.5) { f.y = s.y1 + HH; f.vy = Math.max(0, f.vy); }
      else { const left = px < (s.x0 + s.x1) / 2; f.x = left ? s.x0 - HW : s.x1 + HW; f.vx = 0; f.wall = left ? 1 : -1; }
    }
    if (f.wall && f.vy > 2 && !f.ground && f.state === 'air') f.vy = Math.min(f.vy, 3.5); // glisse le long du mur
    if (f.ground) {
      if (!wasGround) {
        if (f.state === 'hitstun' && f.vy > 0 && Math.abs(f.vy) + Math.abs(f.vx) > 14) { f.vy = -Math.abs(f.vy) * 0.45; f.ground = false; f.events?.push('bounce'); } // rebond
        else {
          const m = f.state === 'attack' ? M[f.move] : null;
          land(f);
          if (m?.air) { f.state = 'lag'; f.lag = m.land; f.move = m.pound ? 'poundLand' : null; f.events?.push(m.pound ? 'pound' : 'land'); }
          else if (f.state === 'hitstun') { f.state = 'lag'; f.lag = 10; f.hitstun = 0; f.combo = 0; f.events?.push('land'); }
          else { if (f.state === 'air') f.state = 'idle'; f.events?.push('land'); }
        }
      } else land(f);
    } else if (wasGround) {
      if (support(f, A)) f.ground = true; else f.coyote = 6; // quelques images pour sauter après avoir quitté le bord
    }
    if (!f.ground && (f.state === 'idle' || f.state === 'run')) f.state = 'air';
    if (f.state === 'air' && !f.ground) tryLedge(f, A);
  }

  // Boîtes de coup actives (en coordonnées du monde) : [x0, y0, x1, y1, données].
  function activeHits(f) {
    const M = movesOf(f);
    if (f.state !== 'attack' && !(f.state === 'lag' && f.move === 'poundLand' && f.lag > M.pound.land - 4)) return [];
    const m = M[f.state === 'lag' ? 'pound' : f.move], out = [];
    for (const h of m.hits) {
      if (h.shot || (f.state === 'attack' && (f.mt < h.s || f.mt > h.e))) continue;
      const cx = f.x + (h.x + (h.move ? (f.mt - h.s) * h.move : 0)) * f.facing, cy = f.y + h.y;
      out.push([cx - h.w / 2, cy - h.h / 2, cx + h.w / 2, cy + h.h / 2, h]);
    }
    return out;
  }
  // Un coup qui touche : dégâts, éjection (plus forte avec les dégâts déjà subis), gel, compteur de combo.
  // Un coup qui éjecte très fort gèle plus longtemps (le navigateur zoome dessus).
  function applyHit(a, b, h, dx, dy, x, y, events, by, ck = 1) {
    b.dmg = Math.min(999, b.dmg + h.dmg * ck);
    if (dy > 0 && b.ground) dy = -dy * 0.7; // un coup vers le bas sur quelqu'un au sol le fait rebondir
    const l = Math.hypot(dx, dy) || 1, v = (h.kb + b.dmg * h.ks) * ck * (100 / C(b).weight);
    b.combo = b.state === 'hitstun' ? b.combo + 1 : 1;
    b.vx = (dx / l) * v; b.vy = (dy / l) * v;
    b.state = 'hitstun'; b.hitstun = Math.round(Math.min(75, 8 + v * 2.3)); b.move = null; b.ground = false; b.lastHit = by; b.recovery = true;
    b.y -= 1;
    const big = v > 19, lag = Math.round(2 + h.dmg * 0.3 + (h.ks >= 0.08 ? 1 : 0) + (big ? 8 : 0));
    if (a) a.hitlag = lag;
    b.hitlag = lag;
    if (b.facing === Math.sign(dx)) b.facing = -b.facing;
    events.push({ t: 'hit', a: by, b: b.id, x: Math.round(x), y: Math.round(y), dmg: h.dmg, v: +v.toFixed(1), heavy: h.ks >= 0.08, big, combo: b.combo, fx: h.fx ?? null });
  }
  const foe = (a, b) => b !== a && b.state !== 'out' && b.dead === 0 && b.invuln === 0 && !(a.team && a.team === b.team);
  function resolve(list, events) {
    for (const a of list) {
      if (a.hitlag > 0) continue;
      for (const [x0, y0, x1, y1, h] of activeHits(a)) {
        for (const b of list) {
          const key = h.g === undefined ? b.id : `${b.id}/${h.g}`;
          if (!foe(a, b) || a.hitIds.includes(key)) continue;
          if (b.x + HW < x0 || b.x - HW > x1 || b.y < y0 || b.y - HH > y1) continue;
          a.hitIds.push(key);
          const dx = h.both ? Math.sign(b.x - a.x || a.facing) * Math.abs(h.dx) : h.dx * a.facing;
          applyHit(a, b, h, dx, h.dy, (Math.max(x0, b.x - HW) + Math.min(x1, b.x + HW)) / 2, b.y - HH / 2, events, a.id, chargeK(a));
        }
      }
    }
  }
  function respawn(f, A) {
    if (f.stocks <= 0) { f.state = 'out'; return; }
    Object.assign(f, { x: A.respawn[0], y: A.respawn[1], vx: 0, vy: 0, dmg: 0, state: 'air', move: null, invuln: 120, jumps: 2, recovery: true, airDodge: false, hitstun: 0, combo: 0 });
  }

  /* ---------------- Le monde ---------------- */
  function world(arenaId, entries, stocks = 3) {
    const A = ARENAS[arenaId];
    return {
      arena: arenaId, frame: 0, items: [], shots: [], nextItem: 360, seq: 0,
      fighters: entries.map((e, k) => { const sp = A.spawns[k % A.spawns.length]; return Object.assign(fighter(e.id, e.char, sp, sp[0] > 0 ? -1 : 1), { stocks, team: e.team ?? null }); }),
    };
  }
  // Hauteur où un objet qui tombe en x se pose (null : dans le vide).
  function floorAt(A, x, y) {
    let best = null;
    for (const p of A.plats) if (x > p.x0 && x < p.x1 && p.y >= y && (best === null || p.y < best)) best = p.y;
    for (const s of A.solids) if (x > s.x0 && x < s.x1 && s.y0 >= y && (best === null || s.y0 < best)) best = s.y0;
    return best;
  }
  // Une image pour tout le monde : chacun bouge, les armes tombent et se ramassent, projectiles et coups touchent,
  // ceux qui sortent de l'arène perdent une vie (et leur arme).
  function stepWorld(w, inputs, events = []) {
    const A = ARENAS[w.arena];
    w.frame++;
    for (const f of w.fighters) {
      f.events = []; f.spawn = []; f.wantPick = false;
      step(f, inputs[f.id] ?? 0, A);
      for (const e of f.events) events.push({ t: e, id: f.id, x: Math.round(f.x), y: Math.round(f.y) });
      for (const s of f.spawn) { w.shots.push({ ...s, id: ++w.seq, owner: f.id, team: f.team }); if (s.kind !== 'arme') events.push({ t: 'shot', big: s.kind === 'boulet', id: f.id, x: Math.round(s.x), y: Math.round(s.y) }); }
      if (f.wantPick) {
        const it = w.items.find(i => i.ground && Math.abs(i.x - f.x) < 46 && Math.abs(i.y - f.y) < 60);
        if (it) { const list = C(f).weapons; f.weapon = list[(w.frame + it.id) % list.length]; w.items.splice(w.items.indexOf(it), 1); events.push({ t: 'pick', id: f.id, weapon: f.weapon, x: Math.round(it.x), y: Math.round(it.y) }); }
      }
      delete f.events; delete f.spawn; delete f.wantPick;
    }
    // armes qui tombent du ciel
    if (--w.nextItem <= 0) {
      w.nextItem = 420 + ((w.frame * 7919) % 240);
      if (w.items.length < 3) { const S = A.solids[0], x = S.x0 + 40 + ((w.frame * 2654435761) % (S.x1 - S.x0 - 80)); w.items.push({ id: ++w.seq, x, y: -900, vy: 0, ground: false, life: 1500 }); events.push({ t: 'item', x, y: floorAt(A, x, -900) ?? 0 }); }
    }
    for (const it of w.items) {
      if (!it.ground) { it.vy = Math.min(it.vy + 0.25, 6); const fl = floorAt(A, it.x, it.y); it.y += it.vy; if (fl !== null && it.y >= fl) { it.y = fl; it.ground = true; events.push({ t: 'land', id: null, x: Math.round(it.x), y: Math.round(it.y) }); } }
    }
    w.items = w.items.filter(it => --it.life > 0 && it.y < A.blast.b);
    // projectiles : balles et armes lancées
    for (const s of w.shots) {
      s.x += s.vx; s.y += s.vy; s.life--;
      if (s.kind === 'arme') { s.vy += 0.4; s.spin += 0.4; }
      if (A.solids.some(o => s.x > o.x0 && s.x < o.x1 && s.y > o.y0 && s.y < o.y1)) { s.life = 0; continue; }
      const owner = w.fighters.find(f => f.id === s.owner) ?? { id: s.owner, team: s.team };
      for (const b of w.fighters) {
        if (!foe(owner, b) || s.life <= 0) continue;
        if (s.x < b.x - HW - 6 || s.x > b.x + HW + 6 || s.y < b.y - HH - 6 || s.y > b.y + 6) continue;
        applyHit(null, b, s.h, Math.sign(s.vx || 1) * Math.max(0.3, Math.abs(s.h.dx)), s.kind === 'arme' ? -0.6 : s.h.dy, s.x, s.y, events, s.owner, s.ck ?? 1);
        s.life = 0;
      }
    }
    w.shots = w.shots.filter(s => s.life > 0 && s.x > A.blast.l && s.x < A.blast.r && s.y < A.blast.b);
    resolve(w.fighters, events);
    const B = A.blast;
    for (const f of w.fighters) {
      if (f.state === 'out' || f.dead > 0) continue;
      if (f.x < B.l || f.x > B.r || f.y > B.b || f.y < B.t) {
        f.stocks--; f.falls++; f.dead = 100; f.state = 'dead'; f.weapon = null; f.combo = 0;
        const killer = w.fighters.find(o => o.id === f.lastHit && o !== f);
        if (killer) killer.kos++;
        events.push({ t: 'ko', id: f.id, by: killer?.id ?? null, x: Math.round(Math.max(B.l, Math.min(B.r, f.x))), y: Math.round(Math.max(B.t, Math.min(B.b, f.y))), left: f.stocks });
      }
    }
    return events;
  }
  const alive = w => w.fighters.filter(f => f.state !== 'out');

  // Combattant envoyé sur le réseau (et rejoué tel quel par le navigateur)
  const KEYS = ['x', 'y', 'vx', 'vy', 'facing', 'state', 'move', 'mt', 'ground', 'jumps', 'wallJumps', 'coyote', 'drop', 'dmg', 'stocks', 'hitstun', 'hitlag', 'invuln', 'dodgeCd', 'airDodge', 'recovery', 'prevIn', 'lag', 'dead', 'wall', 'kos', 'falls', 'weapon', 'ledgeT', 'ledgeCd', 'combo', 'buf', 'bufT', 'charge'];
  const pack = f => { const o = { id: f.id, char: f.char, team: f.team }; for (const k of KEYS) o[k] = typeof f[k] === 'number' ? Math.round(f[k] * 100) / 100 : f[k]; o.hitIds = f.hitIds; return o; };
  const packItems = w => ({ items: w.items.map(i => [i.id, Math.round(i.x), Math.round(i.y), i.ground ? 1 : 0]), shots: w.shots.map(s => [s.id, s.kind, Math.round(s.x), Math.round(s.y), +s.vx.toFixed(1), +s.vy.toFixed(1), s.weapon ?? '', +(s.spin ?? 0).toFixed(2), s.owner]) });

  return { FPS, IN, HW, HH, ARENAS, CHARS, CHAR_IDS, WEAPONS, WEAPON_IDS, MOVES, MOVE_IDS, movesOf, STATES: ['idle', 'run', 'air', 'attack', 'lag', 'dodge', 'hitstun', 'ledge', 'dead', 'out'], fighter, step, resolve, activeHits, world, stepWorld, alive, pack, packItems, floorAt };
});
