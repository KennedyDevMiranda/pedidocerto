/* ===================================================================
   HOME.JS — Pedido Certo (Homepage Comercial)
   =================================================================== */

const API_BASE = 'https://api.pedidocerto.uk';

/* ===================================================================
   UTILITÁRIOS
   =================================================================== */

function formatCurrency(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `há ${days}d`;
}

/* ===================================================================
   STATUS DA LOJA
   =================================================================== */

async function carregarStatusLoja() {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`${API_BASE}/api/status`, { signal: ctrl.signal });
        clearTimeout(timer);

        if (!resp.ok) throw new Error();

        const dados = await resp.json();
        const aberta = dados.aberta !== false;

        // Badge do hero
        const dot = document.querySelector('.hero-badge-dot');
        const text = document.getElementById('storeStatusText');
        if (dot && text) {
            if (aberta) {
                dot.className = 'hero-badge-dot online';
                text.textContent = 'Loja Aberta Agora';
            } else {
                dot.className = 'hero-badge-dot offline';
                text.textContent = 'Loja Fechada';
            }
        }

        // Card de horário
        const horarioTexto = document.getElementById('horarioTexto');
        const statusPill = document.getElementById('statusPill');

        if (aberta) {
            statusPill.textContent = '● Aberta';
            statusPill.className = 'status-pill aberta';
            if (dados.diaAberto && dados.horaAbertura) {
                const virada = dados.horaFechamento <= dados.horaAbertura;
                const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                horarioTexto.textContent = `Aberta agora — das ${dados.horaAbertura} às ${ate}`;
            } else {
                horarioTexto.textContent = 'Estamos abertos! Faça seu pedido agora.';
            }
        } else {
            statusPill.textContent = '● Fechada';
            statusPill.className = 'status-pill fechada';
            if (dados.diaAberto && dados.horaAbertura) {
                const virada = dados.horaFechamento <= dados.horaAbertura;
                const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                horarioTexto.textContent = `Horário hoje: ${dados.horaAbertura} — ${ate}. Volte no horário de atendimento!`;
            } else {
                horarioTexto.textContent = 'Estamos fechados hoje. Volte amanhã!';
            }
        }

        // Endereço no footer
        if (dados.enderecoLoja) {
            const el = document.getElementById('footerEndereco');
            if (el) el.textContent = dados.enderecoLoja;
        }
    } catch {
        const text = document.getElementById('storeStatusText');
        if (text) text.textContent = 'Indisponível';
        const horarioTexto = document.getElementById('horarioTexto');
        if (horarioTexto) horarioTexto.textContent = 'Não foi possível verificar o horário.';
    }
}

/* ===================================================================
   PRODUTOS EM DESTAQUE
   =================================================================== */

async function carregarProdutosDestaque() {
    const container = document.getElementById('productsShowcase');
    if (!container) return;

    try {
        const resp = await fetch(`${API_BASE}/api/produtos`);
        if (!resp.ok) throw new Error();

        const produtos = await resp.json();
        const lista = Array.isArray(produtos) ? produtos : [];

        if (lista.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--muted);">Nenhum produto disponível no momento.</p>';
            return;
        }

        // Mostrar até 8 produtos (priorizar promoções)
        const ordenados = [...lista].sort((a, b) => {
            if (a.ofertaAtiva && !b.ofertaAtiva) return -1;
            if (!a.ofertaAtiva && b.ofertaAtiva) return 1;
            return 0;
        });
        const destaques = ordenados.slice(0, 8);

        container.innerHTML = destaques.map((p, i) => {
            const temOferta = p.ofertaAtiva && p.precoPromocional > 0;
            const precoExibido = temOferta ? p.precoPromocional : p.preco;

            const imgHtml = p.imagemUrl
                ? `<img src="${API_BASE}${p.imagemUrl}" alt="${p.nome}" class="showcase-img" loading="lazy">`
                : `<div class="showcase-img-placeholder">📦</div>`;

            const promoBadge = temOferta
                ? `<span class="showcase-promo-badge">-${p.percentualDesconto}% OFF</span>`
                : '';

            const priceHtml = temOferta
                ? `<span class="showcase-price-old">${formatCurrency(p.preco)}</span><span class="showcase-price">${formatCurrency(precoExibido)}</span>`
                : `<span class="showcase-price">${formatCurrency(precoExibido)}</span>`;

            return `
            <a href="index.html" class="showcase-card animate-on-scroll" style="animation-delay:${i * 80}ms">
                ${imgHtml}
                <div class="showcase-body">
                    ${promoBadge}
                    <h3>${p.nome}</h3>
                    <p class="showcase-desc">${p.descricao || ''}</p>
                    <div>${priceHtml}</div>
                </div>
            </a>`;
        }).join('');

        initScrollAnimations();
    } catch {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);">Não foi possível carregar os produtos.</p>';
    }
}

/* ===================================================================
   AVALIAÇÕES
   =================================================================== */

async function carregarAvaliacoes() {
    const carousel = document.getElementById('reviewsCarousel');
    if (!carousel) return;

    try {
        const resp = await fetch(`${API_BASE}/api/feedbacks?pagina=1&tamanhoPagina=6`);
        if (!resp.ok) throw new Error();

        const data = await resp.json();

        // Summary
        const bigValue = document.getElementById('bigScoreValue');
        const bigStars = document.getElementById('bigScoreStars');
        const bigCount = document.getElementById('bigScoreCount');

        if (bigValue) bigValue.textContent = data.mediaGeral.toFixed(1);
        if (bigStars) bigStars.textContent = gerarEstrelas(Math.round(data.mediaGeral));
        if (bigCount) bigCount.textContent = `${data.total} avaliações`;

        // Stats no hero
        const statNota = document.getElementById('statNota');
        const statFeedbacks = document.getElementById('statFeedbacks');
        if (statNota) statNota.textContent = `${data.mediaGeral.toFixed(1)} ★`;
        if (statFeedbacks) statFeedbacks.textContent = data.total;

        // Cards
        const feedbacks = data.feedbacks || [];
        if (feedbacks.length === 0) {
            carousel.innerHTML = '<p style="text-align:center;color:var(--muted);">Nenhuma avaliação ainda.</p>';
            return;
        }

        carousel.innerHTML = feedbacks.map((fb, i) => {
            const iniciais = (fb.nomeCliente || '?')
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

            const produtoTag = fb.produtoNome
                ? `<span class="review-product">${fb.produtoNome}</span>`
                : '';

            return `
            <div class="review-card animate-on-scroll" style="animation-delay:${i * 100}ms">
                <div class="review-header">
                    <div class="review-avatar">${iniciais}</div>
                    <div class="review-meta">
                        <div class="review-name">${fb.nomeCliente || 'Cliente'}</div>
                        <div class="review-stars">${gerarEstrelas(fb.nota)}</div>
                    </div>
                </div>
                ${produtoTag}
                <p class="review-comment">${fb.comentario || ''}</p>
                <div class="review-date">${timeAgo(fb.criadoEm)}</div>
            </div>`;
        }).join('');

        initScrollAnimations();
    } catch {
        carousel.innerHTML = '<p style="text-align:center;color:var(--muted);">Não foi possível carregar avaliações.</p>';
    }
}

function gerarEstrelas(nota) {
    const n = Math.max(0, Math.min(5, Math.round(nota)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/* ===================================================================
   CONTAGEM DE PEDIDOS (STAT)
   =================================================================== */

async function carregarStatPedidos() {
    const el = document.getElementById('statPedidos');
    if (!el) return;

    try {
        const resp = await fetch(`${API_BASE}/api/site/status`);
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        // Usa o número de compras registradas como indicador
        if (data.totalCompras !== undefined) {
            el.textContent = data.totalCompras;
        } else {
            el.textContent = '100+';
        }
    } catch {
        el.textContent = '100+';
    }
}

/* ===================================================================
   SCROLL ANIMATIONS (Intersection Observer)
   =================================================================== */

function initScrollAnimations() {
    const els = document.querySelectorAll('.animate-on-scroll:not(.visible)');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    els.forEach(el => observer.observe(el));
}

/* ===================================================================
   ATIVIDADE AO VIVO — Visitantes online + Notificações de compra
   =================================================================== */

(function initLiveActivity() {
    const SESSION_ID = sessionStorage.getItem('dm_session') || (function() { const id = crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`; sessionStorage.setItem('dm_session', id); return id; })();
    const HEARTBEAT_INTERVAL = 30000;
    const POLL_INTERVAL = 10000;
    const TOAST_DURATION = 5000;

    let ultimoTimestamp = Date.now();
    let toastQueue = [];
    let toastExibindo = false;

    function sendHeartbeat() {
        fetch(`${API_BASE}/api/site/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: SESSION_ID })
        }).catch(() => {});
    }

    async function pollStatus() {
        try {
            const res = await fetch(`${API_BASE}/api/site/status?desde=${ultimoTimestamp}`);
            if (!res.ok) return;

            const data = await res.json();

            const countEl = document.getElementById('liveCount');
            if (countEl) countEl.textContent = data.online;

            if (data.compras && data.compras.length > 0) {
                data.compras.forEach(c => {
                    if (c.timestamp > ultimoTimestamp) {
                        toastQueue.push(c.primeiroNome);
                    }
                });
                const maxTs = Math.max(...data.compras.map(c => c.timestamp));
                if (maxTs > ultimoTimestamp) ultimoTimestamp = maxTs;

                processarToastQueue();
            }
        } catch {}
    }

    function processarToastQueue() {
        if (toastExibindo || toastQueue.length === 0) return;

        toastExibindo = true;
        const nome = toastQueue.shift();
        mostrarPurchaseToast(nome);

        setTimeout(() => {
            esconderPurchaseToast();
            setTimeout(() => {
                toastExibindo = false;
                processarToastQueue();
            }, 600);
        }, TOAST_DURATION);
    }

    function mostrarPurchaseToast(nome) {
        const toast = document.getElementById('purchaseToast');
        const text = document.getElementById('purchaseToastText');
        if (!toast || !text) return;
        text.textContent = `${nome} acabou de fazer um pedido!`;
        toast.classList.add('show');
    }

    function esconderPurchaseToast() {
        const toast = document.getElementById('purchaseToast');
        if (toast) toast.classList.remove('show');
    }

    sendHeartbeat();
    pollStatus();
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    setInterval(pollStatus, POLL_INTERVAL);

    window.addEventListener('beforeunload', () => {
        const body = JSON.stringify({ sessionId: SESSION_ID });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${API_BASE}/api/site/disconnect`, new Blob([body], { type: 'application/json' }));
        }
    });
})();

/* ===================================================================
   INICIALIZAÇÃO
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    carregarStatusLoja();
    carregarProdutosDestaque();
    carregarAvaliacoes();
    carregarStatPedidos();

    // Animações dos cards estáticos (steps, perks)
    document.querySelectorAll('.step-card, .perk-card, .horario-card').forEach(el => {
        el.classList.add('animate-on-scroll');
    });
    initScrollAnimations();
});