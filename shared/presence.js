// Présence : chaque page du Cercle signale toutes les 20 s quel jeu est ouvert et avec quel pseudo (pour la page
// d'administration : qui joue à quoi, solo compris). Rien n'est envoyé quand l'onglet est caché.
(() => {
  const game = location.pathname.split('/')[1] || 'accueil';
  const ALIAS = { imposteur: 'imp', bataille: 'bn', solar: 'se', strategy: 'sc' };
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ping = () => {
    if (document.hidden) return;
    const pseudo = get(`${game}-pseudo`) || get(`${ALIAS[game]}-pseudo`) || get('pseudo') || '';
    fetch('/api/admin/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, game, pseudo }), keepalive: true }).catch(() => {});
  };
  ping(); setInterval(ping, 20000);
  document.addEventListener('visibilitychange', ping);
})();
