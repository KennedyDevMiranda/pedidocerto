/* ===================================================================
   SCRIPT.JS — Menu Central (Homepage Comercial)
   API_BASE definido em config.js
   =================================================================== */

/* ===================================================================
   UTILITÁRIOS
   =================================================================== */

function formatCurrency(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const parsed = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(parsed.getTime())) return '';
    const diff = Date.now() - parsed.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `há ${days}d`;
}

/* ===================================================================
   CACHE LOCAL (acessível com sistema fechado)
   =================================================================== */

const CACHE_KEYS = {
    produtos: 'dm_cache_produtos',
    status: 'dm_cache_status',
    feedbacks: 'dm_cache_feedbacks_home'
};

function salvarCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function lerCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw).data;
    } catch { return null; }
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
        salvarCache(CACHE_KEYS.status, dados);
        aplicarStatusLoja(dados, true);
    } catch {
        // Tentar cache
        const cached = lerCache(CACHE_KEYS.status);
        if (cached) {
            aplicarStatusLoja(cached, false);
        } else {
            const text = document.getElementById('storeStatusText');
            if (text) text.textContent = 'Indisponível';
            const badge = document.getElementById('storeStatusBadge');
            if (badge) badge.style.opacity = '1';
            const horarioTexto = document.getElementById('horarioTexto');
            if (horarioTexto) horarioTexto.textContent = 'Não foi possível verificar o horário.';
            const hCard = document.getElementById('horarioCard');
            if (hCard) hCard.style.opacity = '1';
        }
    }
}

function aplicarStatusLoja(dados, live) {
    const aberta = live ? (dados.aberta !== false) : false;

    // Badge do hero
    const dot = document.querySelector('.hero-badge-dot');
    const text = document.getElementById('storeStatusText');
    if (dot && text) {
        if (!live) {
            dot.className = 'hero-badge-dot offline';
            text.textContent = 'Sistema Offline — Navegue à vontade';
        } else if (aberta) {
            dot.className = 'hero-badge-dot online';
            text.textContent = 'Loja Aberta Agora';
        } else {
            dot.className = 'hero-badge-dot offline';
            text.textContent = 'Loja Fechada';
        }
        const badge = document.getElementById('storeStatusBadge');
        if (badge) badge.style.opacity = '1';
    }

    // Card de horário
    const horarioTexto = document.getElementById('horarioTexto');
    const statusPill = document.getElementById('statusPill');

    if (!live) {
        if (statusPill) {
            statusPill.textContent = '● Offline';
            statusPill.className = 'status-pill fechada';
        }
        if (horarioTexto) {
            if (dados.diaAberto && dados.horaAbertura) {
                const virada = dados.horaFechamento <= dados.horaAbertura;
                const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                horarioTexto.textContent = `Horário de funcionamento: ${dados.horaAbertura} — ${ate}. Sistema offline no momento.`;
            } else {
                horarioTexto.textContent = 'Sistema offline. Volte mais tarde para fazer pedidos!';
            }
        }
    } else if (aberta) {
        if (statusPill) {
            statusPill.textContent = '● Aberta';
            statusPill.className = 'status-pill aberta';
        }
        if (horarioTexto) {
            if (dados.diaAberto && dados.horaAbertura) {
                const virada = dados.horaFechamento <= dados.horaAbertura;
                const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                horarioTexto.textContent = `Aberta agora — das ${dados.horaAbertura} às ${ate}`;
            } else {
                horarioTexto.textContent = 'Estamos abertos! Faça seu pedido agora.';
            }
        }
    } else {
        if (statusPill) {
            statusPill.textContent = '● Fechada';
            statusPill.className = 'status-pill fechada';
        }
        if (horarioTexto) {
            if (dados.diaAberto && dados.horaAbertura) {
                const virada = dados.horaFechamento <= dados.horaAbertura;
                const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                horarioTexto.textContent = `Fechada agora — Horário: ${dados.horaAbertura} às ${ate}`;
            } else {
                horarioTexto.textContent = 'Estamos fechados no momento. Volte mais tarde!';
            }
        }
    }

    // Endereço no footer
    const enderecoEl = document.getElementById('footerEndereco');
    if (enderecoEl) {
        if (dados.enderecoLoja) {
            enderecoEl.textContent = dados.enderecoLoja;
        } else {
            enderecoEl.textContent = 'Endereço disponível em breve';
        }
    }

    // Revelar card de horário (começa oculto para evitar "Carregando...")
    const hCard = document.getElementById('horarioCard');
    if (hCard) hCard.style.opacity = '1';
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
        salvarCache(CACHE_KEYS.produtos, lista);
        renderProdutosDestaque(lista, container);
    } catch {
        // Tentar cache
        const cached = lerCache(CACHE_KEYS.produtos);
        if (cached && cached.length) {
            renderProdutosDestaque(cached, container);
        } else {
            container.innerHTML = '<p style="text-align:center;color:var(--muted);">Nenhum produto disponível no momento.</p>';
        }
    }
}

function renderProdutosDestaque(lista, container) {
    if (lista.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);">Nenhum produto disponível no momento.</p>';
        return;
    }

    // Mostrar até 8 produtos (mais vendidos primeiro, depois promoções)
    const ordenados = [...lista].sort((a, b) => {
        const vendA = a.totalVendido || 0;
        const vendB = b.totalVendido || 0;
        if (vendB !== vendA) return vendB - vendA;
        if (a.ofertaAtiva && !b.ofertaAtiva) return -1;
        if (!a.ofertaAtiva && b.ofertaAtiva) return 1;
        return 0;
    });
    const destaques = ordenados.slice(0, 8);

    container.innerHTML = destaques.map((p, i) => {
        const temOferta = p.ofertaAtiva && p.precoPromocional > 0;
        const precoExibido = temOferta ? p.precoPromocional : p.preco;
        const vendidos = p.totalVendido || 0;

        const imgHtml = p.imagemUrl
            ? `<img src="${API_BASE}${p.imagemUrl}" alt="${p.nome}" class="showcase-img" loading="lazy">`
            : `<div class="showcase-img-placeholder">📦</div>`;

        const promoBadge = temOferta
            ? `<span class="showcase-promo-badge">-${p.percentualDesconto}% OFF</span>`
            : '';

        const bestSellerBadge = vendidos >= 5
            ? `<span class="showcase-bestseller-badge">🔥 Mais Vendido</span>`
            : '';

        const priceHtml = temOferta
            ? `<span class="showcase-price-old">${formatCurrency(p.preco)}</span><span class="showcase-price">${formatCurrency(precoExibido)}</span>`
            : `<span class="showcase-price">${formatCurrency(precoExibido)}</span>`;

        const soldHtml = vendidos > 0
            ? `<span class="showcase-sold">${vendidos} vendido${vendidos > 1 ? 's' : ''}</span>`
            : '';

        return `
        <a href="/pedido" class="showcase-card animate-on-scroll" style="animation-delay:${i * 80}ms">
            ${imgHtml}
            <div class="showcase-body">
                ${bestSellerBadge}
                ${promoBadge}
                <h3>${p.nome}</h3>
                <p class="showcase-desc">${p.descricao || ''}</p>
                <div class="showcase-price-row">${priceHtml}${soldHtml}</div>
            </div>
        </a>`;
    }).join('');

    initScrollAnimations();
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
        salvarCache(CACHE_KEYS.feedbacks, data);
        renderAvaliacoes(data, carousel);
    } catch {
        // Tentar cache
        const cached = lerCache(CACHE_KEYS.feedbacks);
        if (cached) {
            renderAvaliacoes(cached, carousel);
        } else {
            carousel.innerHTML = '<p style="text-align:center;color:var(--muted);">Nenhuma avaliação ainda. Seja o primeiro!</p>';
            // Mostrar zeros amigáveis em vez de "—"
            const bigValue = document.getElementById('bigScoreValue');
            const bigStars = document.getElementById('bigScoreStars');
            const bigCount = document.getElementById('bigScoreCount');
            const statNota = document.getElementById('statNota');
            const statFeedbacks = document.getElementById('statFeedbacks');
            if (bigValue) bigValue.textContent = '0.0';
            if (bigStars) bigStars.textContent = '☆☆☆☆☆';
            if (bigCount) bigCount.textContent = '0 avaliações';
            if (statNota) statNota.textContent = '0.0 ★';
            if (statFeedbacks) statFeedbacks.textContent = '0';
        }
    }
}

function renderAvaliacoes(data, carousel) {
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
        const nome = fb.nomeExibicao || fb.nomeCliente || 'Cliente';
        const iniciais = (nome === 'Cliente' ? '?' : nome)
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
                    <div class="review-name">${nome}</div>
                    <div class="review-stars">${gerarEstrelas(fb.nota)}</div>
                </div>
            </div>
            ${produtoTag}
            <p class="review-comment">${fb.comentario || ''}</p>
            <div class="review-date">${timeAgo(fb.dataCriacao || fb.criadoEm)}</div>
        </div>`;
    }).join('');

    initScrollAnimations();
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
        const resp = await fetch(`${API_BASE}/api/site/metricas`);
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        const total = data.totalPedidos || 0;
        el.textContent = total;
        salvarCache('dm_cache_stat_pedidos', total);
    } catch {
        const cached = lerCache('dm_cache_stat_pedidos');
        el.textContent = cached != null ? cached : 0;
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
            salvarCache('dm_cache_online', data.online);

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
        } catch {
            // Offline — mostrar pelo menos "1" (o próprio usuário)
            const countEl = document.getElementById('liveCount');
            if (countEl && countEl.textContent === '0') {
                const cached = lerCache('dm_cache_online');
                countEl.textContent = cached && cached > 0 ? cached : 1;
            }
        }
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

    // Mostrar "1" imediatamente (o próprio visitante) até o primeiro poll
    const countElInit = document.getElementById('liveCount');
    if (countElInit && countElInit.textContent === '0') {
        const cachedOnline = lerCache('dm_cache_online');
        countElInit.textContent = cachedOnline && cachedOnline > 0 ? cachedOnline : 1;
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

    // Animações dos cards estáticos (módulos, perks, rewards, mockups)
    document.querySelectorAll('.step-card, .perk-card, .horario-card, .reward-proof-card, .mockup-frame, .flow-step, .demo-video-wrap').forEach(el => {
        el.classList.add('animate-on-scroll');
    });
    initScrollAnimations();
});