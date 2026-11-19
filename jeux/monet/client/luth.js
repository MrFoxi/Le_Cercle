// LES EAUX DE MONET — l'atelier du luthier : les notes sont calculées à part, pour que l'image ne saute jamais.
import { rendre } from './instruments.js';
onmessage = ({ data: n }) => { const d = rendre(n.inst, n.m, n.dur); postMessage({ k: n.k, d }, [d.buffer]); };
