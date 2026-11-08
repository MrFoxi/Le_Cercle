// Chargé par toutes les pages du Cercle.
// 1. Pseudo réservé : dès qu'on écrit « MrFoxi » dans un champ, une fenêtre demande le mot de passe administrateur.
//    Bon mot de passe : le navigateur est reconnu (cookie) ; sinon le pseudo est effacé. Sur l'accueil, l'administrateur
//    connecté a un engrenage qui mène à la page /admin.html.
// 2. Présence : toutes les 20 s, la page signale quel jeu est ouvert, avec quel pseudo, et si l'onglet est au premier plan.
// 3. Annonce : le message de l'administrateur (« Maintenance ce soir… ») s'affiche en haut de l'accueil.
(() => {
  const ADMIN = 'mrfoxi';
  const game = location.pathname.split('/')[1] || 'accueil';
  const ALIAS = { imposteur: 'imp', bataille: 'bn', solar: 'se', strategy: 'sc' };
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const del = k => { try { localStorage.removeItem(k); } catch { /* stockage bloqué */ } };
  const isAdminName = v => String(v ?? '').trim().toLowerCase() === ADMIN;
  let admin = null; // inconnu tant que le serveur n'a pas répondu
  const me = fetch('/api/admin/me').then(r => r.json()).then(r => (admin = !!r.admin)).catch(() => (admin = false));

  /* ---------- Fenêtre du mot de passe ---------- */
  let asking = null;
  function askPassword() {
    if (asking) return asking;
    asking = new Promise(done => {
      const box = document.createElement('div');
      box.innerHTML = `<div style="position:fixed;inset:0;z-index:99999;background:rgba(8,10,16,.6);display:grid;place-items:center;padding:16px;font:15px/1.4 system-ui,sans-serif">
        <form style="background:#181b24;color:#e8ebf2;border:1px solid #2a2f3d;border-radius:14px;padding:20px;width:min(360px,100%);display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
          <b style="font-size:1.1rem">🔒 Pseudo réservé</b>
          <span style="color:#8a93a6">« MrFoxi » est réservé à l’administrateur. Entre le mot de passe pour l’utiliser.</span>
          <input type="password" autocomplete="current-password" placeholder="Mot de passe" style="font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3d;background:#10131a;color:#e8ebf2">
          <span data-err style="color:#ff8a8a;min-height:1.2em"></span>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" data-cancel style="font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #2a2f3d;background:#222736;color:#e8ebf2;cursor:pointer">Annuler</button>
            <button style="font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#e5484d;color:#fff;cursor:pointer">Valider</button>
          </div>
        </form></div>`;
      document.body.append(box);
      const form = box.querySelector('form'), input = box.querySelector('input'), err = box.querySelector('[data-err]');
      const end = ok => { box.remove(); asking = null; done(ok); };
      box.querySelector('[data-cancel]').onclick = () => end(false);
      form.onsubmit = async e => {
        e.preventDefault();
        const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: input.value }) }).then(r => r.json()).catch(() => ({ error: 'Serveur injoignable' }));
        if (r.ok) { admin = true; gear(); end(true); } else { err.textContent = r.error || 'Mot de passe incorrect'; input.select(); }
      };
      setTimeout(() => input.focus(), 30);
    });
    return asking;
  }
  // Un champ où l'on vient d'écrire « MrFoxi » : mot de passe, sinon on l'efface
  async function guard(field) {
    await me;
    if (admin || !isAdminName(field.value)) return;
    if (await askPassword()) return;
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true })); // le jeu enregistre le pseudo vide
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
  }
  document.addEventListener('input', e => { const f = e.target; if (f.matches?.('input:not([type=password])') && isAdminName(f.value)) guard(f); }, true);
  // Pseudo « MrFoxi » déjà gardé dans ce navigateur, sans être connecté : on demande, sinon on l'oublie
  me.then(async () => {
    if (admin) return gear();
    const keys = [`${game}-pseudo`, `${ALIAS[game]}-pseudo`, 'pseudo'].filter(k => isAdminName(get(k)));
    if (!keys.length) return;
    if (await askPassword()) return;
    keys.forEach(del);
    for (const f of document.querySelectorAll('input')) if (isAdminName(f.value)) { f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); }
  });

  /* ---------- Engrenage de l'administrateur, sur l'accueil ---------- */
  function gear() {
    if (game !== 'accueil' || document.getElementById('adminGear')) return;
    const a = Object.assign(document.createElement('a'), { id: 'adminGear', href: '/admin.html', title: 'Administration', textContent: '⚙️' });
    a.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:26px;text-decoration:none;background:#181b24;border:1px solid #2a2f3d;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    document.body.append(a);
  }

  /* ---------- Présence ---------- */
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ping = () => {
    const pseudo = get(`${game}-pseudo`) || get(`${ALIAS[game]}-pseudo`) || get('pseudo') || '';
    fetch('/api/admin/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, game, pseudo, hidden: document.hidden }), keepalive: true })
      .then(r => (r.status === 200 ? r.json() : null)).then(r => r?.messages?.forEach(message)).catch(() => {});
  };
  ping(); setInterval(ping, 20000);
  document.addEventListener('visibilitychange', ping);

  // Un message de l'administrateur : un bandeau en haut de la page, avec un bouton pour le fermer
  function message(text) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99998;max-width:min(560px,92vw);display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:#181b24;color:#f4f1ea;border:1px solid #c8973a;box-shadow:0 12px 40px rgba(0,0,0,.5);font:600 15px/1.4 Inter,system-ui,sans-serif';
    el.innerHTML = '<span style="font-size:20px">📣</span><span><b style="color:#f5d27a">Administrateur</b><br></span><button aria-label="Fermer" style="border:0;background:none;color:#a9b1ba;font-size:18px;cursor:pointer">✕</button>';
    el.children[1].append(text);
    el.querySelector('button').onclick = () => el.remove();
    document.body.append(el); setTimeout(() => el.remove(), 20000);
  }

  /* ---------- Annonce de l'administrateur ---------- */
  if (game === 'accueil') fetch('/api/admin/announce').then(r => r.json()).then(a => {
    if (!a?.text || get('cercle-announce-seen') === String(a.at)) return;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:sticky;top:0;z-index:9998;display:flex;gap:12px;align-items:center;justify-content:center;padding:10px 44px 10px 16px;background:linear-gradient(90deg,#8a5f1c,#c8973a,#8a5f1c);color:#1a1206;font:600 15px/1.35 Inter,system-ui,sans-serif;text-align:center';
    bar.innerHTML = `<span>📣</span><span></span><button aria-label="Fermer" style="position:absolute;right:10px;border:0;background:none;font-size:20px;cursor:pointer;color:#1a1206">✕</button>`;
    bar.children[1].textContent = a.text;
    bar.querySelector('button').onclick = () => { bar.remove(); try { localStorage.setItem('cercle-announce-seen', String(a.at)); } catch { /* stockage bloqué */ } };
    document.body.prepend(bar);
  }).catch(() => {});
})();
