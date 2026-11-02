// Stockage durable des classements et de l'activité.
// En ligne : Upstash Redis (variables UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN), qui survit aux redéploiements.
// En local, sans ces variables : un fichier JSON par donnée dans data/, comme avant.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const loaded = new Set(); // on n'écrit jamais une donnée qu'on n'a pas réussi à lire (sinon on écraserait les vrais classements)
const wait = ms => new Promise(r => setTimeout(r, ms));

async function redis(cmd) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(cmd),
  });
  const out = await res.json();
  if (!res.ok || out.error) throw new Error(out.error || `HTTP ${res.status}`);
  return out.result;
}
const online = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Lit une donnée ; si elle n'existe pas encore, renvoie fallback. Réessaie si la base ne répond pas.
async function load(name, fallback) {
  if (!online()) {
    loaded.add(name);
    try { return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')); } catch { return fallback; }
  }
  for (let k = 0; ; k++) {
    try {
      const v = await redis(['GET', name]);
      loaded.add(name);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      console.error(`Stockage : lecture de « ${name} » impossible (${e.message}), nouvel essai…`);
      await wait(Math.min(30000, 1000 * 2 ** k));
    }
  }
}

function save(name, value) {
  if (!loaded.has(name)) return Promise.resolve(); // pas encore lu : ne rien écraser
  const json = JSON.stringify(value);
  if (!online()) return fs.promises.mkdir(DIR, { recursive: true }).then(() => fs.promises.writeFile(path.join(DIR, `${name}.json`), json)).catch(e => console.error('Stockage :', e.message));
  return redis(['SET', name, json]).catch(e => console.error(`Stockage : écriture de « ${name} » impossible (${e.message})`));
}

module.exports = { load, save, online };
