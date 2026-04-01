/* ===================================================================
   MENU CENTRAL — PAINEL DE GESTÃO (painel.js)
   =================================================================== */

const API_BASE = 'https://api.pedidocerto.uk';

/* ── Estado ── */
let currentPage = 'dashboard';
let currentFilter = '';

/* ── Navegação ── */
function navegar(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.sidebar-link[data-page="${page}"]`);
    if (link) link.classList.add('active');

    const titles = { dashboard: 'Dashboard', pedidos: 'Pedidos', produtos: 'Produtos', clientes: 'Clientes', financeiro: 'Financeiro', plano: 'Meu Plano' };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

    if (page === 'dashboard') carregarDashboard();
    if (page === 'pedidos') carregarPedidos();
    if (page === 'produtos') carregarProdutos();
    if (page === 'clientes') carregarClientes();
    if (page === 'financeiro') carregarFinanceiro();
    if (page === 'plano') carregarPlano();

    // Fechar sidebar no mobile
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('visible');
}

function sairPainel() {
    sessionStorage.removeItem('painel_token');
    sessionStorage.removeItem('painel_user');
    window.location.href = '/entrar';
}

/* ── Helpers ── */
function formatarMoeda(valor) {
    return 'R$ ' + (valor || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function statusNome(code) {
    const map = { 0: 'Aberto', 1: 'Preparando', 2: 'Finalizado', 3: 'Entregue', 4: 'Cancelado' };
    return map[code] ?? 'Desconhecido';
}

function statusClasse(code) {
    const map = { 0: 'aberto', 1: 'preparando', 2: 'finalizado', 3: 'entregue', 4: 'cancelado' };
    return map[code] ?? '';
}

function formatarData(dt) {
    if (!dt) return '—';
    const d = new Date(dt.replace(' ', 'T'));
    if (isNaN(d)) return dt;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ===================================================================
   DASHBOARD
   =================================================================== */
async function carregarDashboard() {
    try {
        const resp = await fetch(`${API_BASE}/api/dashboard`);
        if (!resp.ok) throw new Error();
        const d = await resp.json();

        setVal('kpiPedidosHoje', d.pedidosHoje);
        setVal('kpiFaturamentoHoje', formatarMoeda(d.faturamentoHoje));
        setVal('kpiClientes', d.totalClientes);
        setVal('kpiProdutos', d.totalProdutos);

        setVal('statusAbertos', d.pedidosAbertos);
        setVal('statusPreparando', d.pedidosPreparando);
        setVal('statusFinalizados', d.pedidosFinalizados);
        setVal('statusFaturamentoMes', formatarMoeda(d.faturamentoMes));

        // Badge de pedidos abertos na sidebar
        const badge = document.getElementById('badgePedidosAbertos');
        if (badge) badge.textContent = d.pedidosAbertos > 0 ? d.pedidosAbertos : '';

        // Últimos pedidos
        const ulEl = document.getElementById('ultimosPedidos');
        if (ulEl) {
            if (d.ultimosPedidos && d.ultimosPedidos.length) {
                ulEl.innerHTML = d.ultimosPedidos.map(p => `
                    <div class="pedido-item">
                        <div class="pedido-item-info">
                            <strong>${p.numero || '#' + p.id}</strong>
                            <span>${p.cliente}</span>
                        </div>
                        <div class="pedido-item-right">
                            <span class="pedido-valor">${formatarMoeda(p.valor)}</span>
                            <span class="badge badge-${statusClasse(p.status)}">${statusNome(p.status)}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                ulEl.innerHTML = '<div class="empty-state">Nenhum pedido ainda.</div>';
            }
        }

        // Top produtos
        const topEl = document.getElementById('topProdutos');
        if (topEl) {
            if (d.topProdutos && d.topProdutos.length) {
                topEl.innerHTML = d.topProdutos.map((p, i) => `
                    <div class="ranking-item">
                        <span class="ranking-pos">${i + 1}º</span>
                        <span class="ranking-name">${p.nome}</span>
                        <span class="ranking-count">${p.vendidos} vendidos</span>
                    </div>
                `).join('');
            } else {
                topEl.innerHTML = '<div class="empty-state">Nenhuma venda registrada.</div>';
            }
        }

    } catch {
        const ulEl = document.getElementById('ultimosPedidos');
        if (ulEl) ulEl.innerHTML = '<div class="empty-state">Não foi possível carregar o dashboard.</div>';
    }
}

/* ===================================================================
   PEDIDOS
   =================================================================== */
async function carregarPedidos(status) {
    const body = document.getElementById('pedidosBody');
    if (!body) return;

    let url = `${API_BASE}/api/dashboard/pedidos?limite=50`;
    if (status !== undefined && status !== '') url += `&status=${status}`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        const pedidos = data.pedidos || data;

        if (!pedidos.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum pedido encontrado.</td></tr>';
            return;
        }

        body.innerHTML = pedidos.map(p => `
            <tr>
                <td>${p.numero || '#' + p.id}</td>
                <td>${p.cliente}</td>
                <td>${formatarMoeda(p.valor)}</td>
                <td><span class="badge badge-${statusClasse(p.status)}">${statusNome(p.status)}</span></td>
                <td>${formatarData(p.data)}</td>
                <td>
                    ${p.status < 3 ? `<button class="btn-sm" onclick="avancarStatus(${p.id}, ${p.status})">Avançar ▸</button>` : '—'}
                </td>
            </tr>
        `).join('');
    } catch {
        body.innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar pedidos.</td></tr>';
    }
}

function filtrarPedidos(btn, status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = status;
    carregarPedidos(status);
}

async function avancarStatus(pedidoId, statusAtual) {
    const novoStatus = statusAtual + 1;
    try {
        await fetch(`${API_BASE}/api/pedidos/${pedidoId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        carregarPedidos(currentFilter);
        carregarDashboard();
    } catch { /* silencioso */ }
}

/* ===================================================================
   PRODUTOS (leitura)
   =================================================================== */
async function carregarProdutos() {
    const container = document.getElementById('pageProdutos');
    if (!container) return;
    const body = container.querySelector('.produtos-body');
    if (!body) return;

    try {
        const resp = await fetch(`${API_BASE}/api/produtos`);
        if (!resp.ok) throw new Error();
        const produtos = await resp.json();

        if (!produtos.length) {
            body.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>';
            return;
        }

        body.innerHTML = produtos.map(p => `
            <div class="produto-row">
                <div class="produto-row-info">
                    <strong>${p.nome}</strong>
                    <span>${p.descricao || ''}</span>
                </div>
                <div class="produto-row-right">
                    <span class="produto-preco">${formatarMoeda(p.preco)}</span>
                    <span class="produto-estoque">Estoque: ${p.quantidadeEstoque ?? p.estoque ?? 0}</span>
                </div>
            </div>
        `).join('');
    } catch {
        body.innerHTML = '<div class="empty-state">Erro ao carregar produtos.</div>';
    }
}

/* ===================================================================
   CLIENTES (leitura)
   =================================================================== */
async function carregarClientes() {
    const container = document.getElementById('pageClientes');
    if (!container) return;
    const body = container.querySelector('.clientes-body');
    if (!body) return;

    try {
        const resp = await fetch(`${API_BASE}/api/clientes`);
        if (!resp.ok) throw new Error();
        const clientes = await resp.json();
        const lista = Array.isArray(clientes) ? clientes : (clientes.clientes || []);

        if (!lista.length) {
            body.innerHTML = '<div class="empty-state">Nenhum cliente cadastrado.</div>';
            return;
        }

        body.innerHTML = lista.slice(0, 50).map(c => `
            <div class="cliente-row">
                <div class="cliente-avatar">${(c.nome || 'C')[0].toUpperCase()}</div>
                <div class="cliente-info">
                    <strong>${c.nome}</strong>
                    <span>${c.documento || ''}</span>
                </div>
                <div class="cliente-meta">
                    <span>${c.telefone || ''}</span>
                </div>
            </div>
        `).join('');
    } catch {
        body.innerHTML = '<div class="empty-state">Erro ao carregar clientes.</div>';
    }
}

/* ===================================================================
   FINANCEIRO (resumo simples)
   =================================================================== */
async function carregarFinanceiro() {
    const container = document.getElementById('pageFinanceiro');
    if (!container) return;
    const body = container.querySelector('.financeiro-body');
    if (!body) return;

    try {
        const resp = await fetch(`${API_BASE}/api/dashboard`);
        if (!resp.ok) throw new Error();
        const d = await resp.json();

        body.innerHTML = `
            <div class="fin-grid">
                <div class="fin-card">
                    <div class="fin-icon">📊</div>
                    <div class="fin-value">${formatarMoeda(d.faturamentoHoje)}</div>
                    <div class="fin-label">Faturamento Hoje</div>
                </div>
                <div class="fin-card">
                    <div class="fin-icon">📈</div>
                    <div class="fin-value">${formatarMoeda(d.faturamentoMes)}</div>
                    <div class="fin-label">Faturamento do Mês</div>
                </div>
                <div class="fin-card">
                    <div class="fin-icon">📋</div>
                    <div class="fin-value">${d.pedidosHoje}</div>
                    <div class="fin-label">Pedidos Hoje</div>
                </div>
                <div class="fin-card">
                    <div class="fin-icon">📦</div>
                    <div class="fin-value">${d.pedidosMes}</div>
                    <div class="fin-label">Pedidos no Mês</div>
                </div>
            </div>
        `;
    } catch {
        body.innerHTML = '<div class="empty-state">Erro ao carregar financeiro.</div>';
    }
}

/* ===================================================================
   MEU PLANO
   =================================================================== */
async function carregarPlano() {
    const el = document.getElementById('planoInfo');
    if (!el) return;

    try {
        const resp = await fetch(`${API_BASE}/api/planos`);
        if (!resp.ok) throw new Error();
        const planos = await resp.json();

        // Pegar assinatura ativa (usuário 1)
        const respAss = await fetch(`${API_BASE}/api/planos/minha-assinatura?usuarioId=1`);
        let assinatura = null;
        if (respAss.ok) assinatura = await respAss.json();

        if (assinatura && assinatura.planoNome) {
            el.innerHTML = `
                <div class="plano-header">
                    <span class="plano-badge">⭐ ${assinatura.planoNome}</span>
                    <span class="plano-status ${assinatura.status === 'ativa' ? 'ativo' : 'inativo'}">${assinatura.status === 'ativa' ? 'Ativa' : assinatura.status}</span>
                </div>
                <div class="plano-details">
                    <p><strong>Ciclo:</strong> ${assinatura.ciclo || 'trial'}</p>
                    <p><strong>Início:</strong> ${formatarData(assinatura.dataInicio)}</p>
                    <p><strong>Expira:</strong> ${formatarData(assinatura.dataFim)}</p>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="plano-header">
                    <span class="plano-badge">Sem plano ativo</span>
                </div>
                <p style="color:var(--muted);margin-top:12px">Entre em contato para ativar seu plano.</p>
            `;
        }
    } catch {
        el.innerHTML = '<div class="empty-state">Erro ao carregar plano.</div>';
    }
}

/* ── Utility ── */
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ── Data no topbar ── */
function atualizarData() {
    const el = document.getElementById('topbarDate');
    if (el) {
        const d = new Date();
        el.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
}

/* ── Init ── */
atualizarData();
carregarDashboard();

window.navegar = navegar;
window.toggleSidebar = toggleSidebar;
window.sairPainel = sairPainel;
window.filtrarPedidos = filtrarPedidos;
window.avancarStatus = avancarStatus;