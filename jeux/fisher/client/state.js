// Little Fisher : l'état partagé par les modules (partie sauvegardée, bateau, météo, écran en cours, scène 3D).
import * as G from './game.js';
import { store } from '/shared/party.js';

export const S = {
  save: G.loadSave(store.get('fisher-save')),
  B: { x: 0, z: 0, heading: 0, speed: 0, turn: 0, docked: null, dockAnim: 0, camHeading: 0 }, // le bateau
  W: { kind: 'clair', left: 160 },     // météo en cours et temps restant (s)
  mode: 'title',                       // title, sail (en mer) ou dive (sous l'eau)
  panel: null,                         // fenêtre ouverte (village, inv, book, map)
  time: 0,                             // secondes depuis le chargement (animations)
  amp: 1,                              // hauteur des vagues (plus fortes sous la pluie)
  keys: new Set(), touch: { x: 0, y: 0 },
  scene: null, camera: null, world: null, boat: null,
};
export function persist() {
  if (S.mode !== 'title') S.save.boat = { x: S.B.x, z: S.B.z, heading: S.B.heading };
  store.set('fisher-save', JSON.stringify(S.save));
}
export const fwd = h => ({ x: Math.sin(h), z: Math.cos(h) });
export const right = h => ({ x: -Math.cos(h), z: Math.sin(h) });
export const waveH = (x, z) => S.world.waveAt(x, z, S.time, S.amp).h;
