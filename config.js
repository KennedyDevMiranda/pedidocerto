/* ===================================================================
   CONFIG.JS — Configuração central (API_BASE auto-detect)
   Incluir ANTES de qualquer outro script em todas as páginas.
   =================================================================== */

const API_BASE = (function detectApiBase() {
    const host = window.location.hostname;

    // Domínios onde a API é servida junto (mesmo origin)
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', ''];
    const tunnelDomain = 'pedidocerto.uk';

    if (localHosts.includes(host) || host.endsWith(tunnelDomain)) {
        return '';
    }

    // Se estiver em outro domínio (Vercel, CDN, etc.), apontar para a API do túnel
    return 'https://api.pedidocerto.uk';
})();