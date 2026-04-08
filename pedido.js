/* ===================================================================
   Menu Central — Script do Formulário de Pedido
   API: /api/pedidos, /api/produtos, /api/clientes
   API_BASE definido em config.js
   =================================================================== */

const ENDPOINTS = {
    criarPedido: `${API_BASE}/api/pedidos`,
    listarProdutos: (busca = '') => {
        const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
        return `${API_BASE}/api/produtos${q}`;
    },
    listarCategorias: `${API_BASE}/api/categorias`,
    buscarClientePorDocumento: (doc) =>
        `${API_BASE}/api/clientes/documento/${encodeURIComponent(doc)}`,
    criarCliente: `${API_BASE}/api/clientes`,
    validarCupom: (codigo, subtotal) =>
        `${API_BASE}/api/cupons/validar/${encodeURIComponent(codigo)}?subtotal=${subtotal}`,
    cuponsDisponiveis: `${API_BASE}/api/cupons/disponiveis`,
    fidelidade: (clienteId) => `${API_BASE}/api/fidelidade/${clienteId}`
};

/* ---------- Mapa de enums do backend ---------- */

const FORMAS_PAGAMENTO = {
    1: 'Dinheiro',
    2: 'Pix',
    3: 'Cartão de Crédito',
    4: 'Cartão de Débito',
    5: 'Boleto'
};

const STORAGE_KEY = 'devmiranda_cpf_salvo';
const TAXA_ENTREGA_FIXA = 3.00;

/* ---------- Configuração PIX ---------- */

const PIX_CONFIG = {
    chave: 'kennedymirandavenancio8@gmail.com',         // Chave PIX do recebedor (telefone, CPF, e-mail ou aleatória)
    nome: 'KENNEDY MIRANDA VENANCIO',           // Nome do recebedor (até 25 caracteres, sem acentos)
    cidade: 'ESPIRITO SANTO'           // Cidade do recebedor (até 15 caracteres, sem acentos)
};

/* ---------- Cache Local (site acessível offline) ---------- */

const CACHE_KEYS = {
    produtos: 'dm_cache_produtos',
    categorias: 'dm_cache_categorias',
    status: 'dm_cache_status',
    cupons: 'dm_cache_cupons'
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

function estaNoHorario(dados) {
    if (!dados || !dados.diaAberto || !dados.horaAbertura || !dados.horaFechamento) return null;
    const agora = new Date();
    const [hA, mA] = dados.horaAbertura.split(':').map(Number);
    const [hF, mF] = dados.horaFechamento.split(':').map(Number);
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const minutosAbre = hA * 60 + (mA || 0);
    const minutosFecha = hF * 60 + (mF || 0);
    if (minutosFecha > minutosAbre) {
        return minutosAgora >= minutosAbre && minutosAgora < minutosFecha;
    }
    return minutosAgora >= minutosAbre || minutosAgora < minutosFecha;
}

/* ---------- Estado global ---------- */

const state = {
    step: 1,
    produtos: [],
    categorias: [],
    categoriaFiltro: 0, // 0 = Todas
    carrinho: [],
    sistemaOnline: null,
    lojaAberta: null,
    estadoLoja: null,       // 'aberta', 'fechada', 'pausada', 'agendamento'
    aceitaPedidos: null,    // true/false — definido pela API
    mensagemLoja: '',       // mensagem personalizada do admin
    horarioTexto: '',
    cliente: {
        id: null,
        cpf: '',
        nome: '',
        email: '',
        telefone: '',
        existente: false,
        endereco: ''
    },
    modoEntrega: 'novo',
    enderecoLoja: '',
    endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        uf: '',
        complemento: '',
        referencia: ''
    },
    formaPagamento: 0,
    taxaEntrega: TAXA_ENTREGA_FIXA,
    trocoPara: 0,
    observacao: '',
    desconto: 0,
    cupom: {
        codigo: '',
        aplicado: false,
        valorDesconto: 0,
        descricao: ''
    },
    pontosDisponiveis: 0,
    pontosUsados: 0
};

function resetarPedido() {
    state.carrinho = [];
    state.modoEntrega = 'novo';
    state.endereco = { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', complemento: '', referencia: '' };
    state.formaPagamento = 0;
    state.taxaEntrega = TAXA_ENTREGA_FIXA;
    state.trocoPara = 0;
    state.observacao = '';
    state.desconto = 0;
    state.cupom = { codigo: '', aplicado: false, valorDesconto: 0, descricao: '' };
    state.pontosUsados = 0;

    // Limpar campos de formulário
    ['cep','logradouro','numero','bairro','cidade','uf','complemento'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const ref = document.getElementById('referencia');
    if (ref) ref.value = '';
    const obs = document.getElementById('observacao');
    if (obs) obs.value = '';
    const troco = document.getElementById('trocoPara');
    if (troco) troco.value = '';
    const trocoGroup = document.getElementById('trocoGroup');
    if (trocoGroup) trocoGroup.style.display = 'none';
    const pixSection = document.getElementById('pixSection');
    if (pixSection) pixSection.style.display = 'none';
    const cupomInput = document.getElementById('codigoCupom');
    if (cupomInput) cupomInput.value = '';
    const pontosInput = document.getElementById('pontosUsar');
    if (pontosInput) pontosInput.value = '';
    const pontosSection = document.getElementById('pontosSection');
    if (pontosSection) pontosSection.style.display = 'none';

    document.querySelectorAll('.payment-option').forEach(x => x.classList.remove('active'));
    document.getElementById('formaPagamento').value = '0';

    renderCarrinho();
    irParaEtapa(1);
}

/* ---------- Referências DOM ---------- */

const steps = Array.from(document.querySelectorAll('.step-card'));
const progressSteps = Array.from(document.querySelectorAll('.progress-step'));
const listaProdutos = document.getElementById('listaProdutos');
const produtoBusca = document.getElementById('produtoBusca');
const itensPedido = document.getElementById('itensPedido');
const carrinhoVazio = document.getElementById('carrinhoVazio');
const statusCliente = document.getElementById('statusCliente');

/* ===================================================================
   UTILITÁRIOS
   =================================================================== */

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function onlyDigits(value) {
    return (value || '').replace(/\D/g, '');
}

function formatCpf(value) {
    const d = onlyDigits(value).slice(0, 11);
    return d
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCpf(cpf) {
    const c = onlyDigits(cpf);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
    let r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== parseInt(c[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    return r === parseInt(c[10]);
}

/* ===================================================================
   PRODUTOS (GET /api/produtos?busca=)
   =================================================================== */

// Carregar cache de produtos imediatamente para exibição rápida
(function carregarProdutosDoCache() {
    const cached = lerCache(CACHE_KEYS.produtos);
    if (cached && cached.length && !state.produtos.length) {
        state.produtos = cached;
        renderProdutos();
    }
})();

async function carregarProdutos(busca = '') {
    try {
        const resp = await fetch(ENDPOINTS.listarProdutos(busca));
        if (!resp.ok) throw new Error();
        const dados = await resp.json();
        state.produtos = Array.isArray(dados) ? dados : [];
        if (!busca) salvarCache(CACHE_KEYS.produtos, state.produtos);
        renderProdutos();
    } catch {
        // Tentar cache local
        if (!busca) {
            const cached = lerCache(CACHE_KEYS.produtos);
            if (cached && cached.length) {
                state.produtos = cached;
                renderProdutos();
                return;
            }
        }
        listaProdutos.innerHTML = '<div class="empty-state">Não foi possível carregar o cardápio.</div>';
    }
}

let buscaTimeout;
produtoBusca.addEventListener('input', (e) => {
    clearTimeout(buscaTimeout);
    buscaTimeout = setTimeout(() => carregarProdutos(e.target.value.trim()), 300);
});

/* ===================================================================
   CATEGORIAS (GET /api/categorias)
   =================================================================== */

async function carregarCategorias() {
    try {
        const resp = await fetch(ENDPOINTS.listarCategorias);
        if (!resp.ok) throw new Error();
        const dados = await resp.json();
        state.categorias = Array.isArray(dados) ? dados : [];
        salvarCache(CACHE_KEYS.categorias, state.categorias);
    } catch {
        const cached = lerCache(CACHE_KEYS.categorias);
        if (cached && cached.length) state.categorias = cached;
    }
    renderCategoriasTabs();
}

function renderCategoriasTabs() {
    const container = document.getElementById('categoriasTabs');
    if (!container) return;

    const cats = state.categorias.filter(c => c.totalProdutos > 0);
    if (!cats.length) {
        container.innerHTML = '';
        return;
    }

    let html = `<button type="button" class="cat-tab${state.categoriaFiltro === 0 ? ' active' : ''}" data-cat-id="0">Todas</button>`;
    cats.forEach(c => {
        html += `<button type="button" class="cat-tab${state.categoriaFiltro === c.id ? ' active' : ''}" data-cat-id="${c.id}">${c.nome} <span class="cat-count">${c.totalProdutos}</span></button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.cat-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            state.categoriaFiltro = parseInt(btn.dataset.catId);
            container.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderProdutos();
        });
    });
}

/* ===================================================================
   CUPONS DISPONÍVEIS (GET /api/cupons/disponiveis)
   =================================================================== */

const bannerCupons = document.getElementById('bannerCupons');

async function carregarCuponsDisponiveis() {
    try {
        const resp = await fetch(ENDPOINTS.cuponsDisponiveis);
        if (!resp.ok) throw new Error();
        const cupons = await resp.json();
        const lista = Array.isArray(cupons) ? cupons : [];
        salvarCache(CACHE_KEYS.cupons, lista);
        renderCupons(lista);
    } catch {
        // Tentar cache
        const cached = lerCache(CACHE_KEYS.cupons);
        if (cached && cached.length) {
            renderCupons(cached);
        } else {
            bannerCupons.classList.add('hidden');
        }
    }
}

function renderCupons(cupons) {
    if (!cupons.length) {
        bannerCupons.classList.add('hidden');
        return;
    }
    bannerCupons.classList.remove('hidden');
    bannerCupons.innerHTML = `
        <div class="cupons-header">
            <span class="cupons-icon">🎟️</span>
            <strong>Cupons disponíveis</strong>
            <small style="color:var(--muted);margin-left:auto">Toque para copiar</small>
        </div>
        <div class="cupons-list">
            ${cupons.map(c => `
                <div class="cupom-card" data-cupom="${c.codigo}" title="Clique para copiar o código">
                    <span class="cupom-codigo">${c.codigo}</span>
                    <span class="cupom-valor">${c.valorFormatado}</span>
                    <span class="cupom-desc">${c.descricao || ''}</span>
                    ${c.diasRestantes != null ? `<span class="cupom-prazo">Expira em ${c.diasRestantes} dia${c.diasRestantes !== 1 ? 's' : ''}</span>` : ''}
                </div>
            `).join('')}
        </div>`;

    bannerCupons.querySelectorAll('.cupom-card').forEach(card => {
        card.addEventListener('click', () => {
            const codigo = card.dataset.cupom;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(codigo).catch(() => {});
            }
            const cupomInput = document.getElementById('codigoCupom');
            if (cupomInput && !cupomInput.disabled) {
                cupomInput.value = codigo;
            }
            showToast(`Cupom "${codigo}" copiado! Cole no campo de cupom.`, 'success');
        });
    });
}

function renderProdutos() {
    if (!state.produtos.length) {
        listaProdutos.innerHTML = '<div class="empty-state">Nenhum produto encontrado.</div>';
        return;
    }

    // Filtrar por categoria se selecionada
    const filtrados = state.categoriaFiltro > 0
        ? state.produtos.filter(p => p.categoriaId === state.categoriaFiltro)
        : state.produtos;

    if (!filtrados.length) {
        listaProdutos.innerHTML = '<div class="empty-state">Nenhum produto nesta categoria.</div>';
        return;
    }

    // Agrupar por categoria
    const grupos = {};
    filtrados.forEach(p => {
        const cat = p.categoriaNome || 'Outros';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(p);
    });

    const categoriasOrdenadas = Object.keys(grupos).sort((a, b) => {
        if (a === 'Outros') return 1;
        if (b === 'Outros') return -1;
        return a.localeCompare(b, 'pt-BR');
    });

    let html = '';
    categoriasOrdenadas.forEach(cat => {
        html += `<div class="categoria-grupo">
            <h3 class="categoria-titulo">${cat}</h3>
            <div class="categoria-produtos">`;

        html += grupos[cat].map(p => {
            const temOferta = p.ofertaAtiva && p.precoPromocional > 0;
            const precoExibido = temOferta ? p.precoPromocional : p.preco;
            const badgeOferta = temOferta && p.tipoOfertaNome
                ? `<span class="offer-badge">${p.tipoOfertaNome}</span>` : '';
            const precoHtml = temOferta
                ? `<div class="product-price-wrap">
                       ${badgeOferta}
                       <span class="product-price-old">${formatCurrency(p.preco)}</span>
                       <span class="product-price-new">${formatCurrency(precoExibido)}</span>
                       <span class="product-discount-badge">-${p.percentualDesconto}%</span>
                   </div>`
                : `<div class="product-price">${formatCurrency(p.preco)}</div>`;

            return `
            <button type="button" class="product-card${temOferta ? ' product-card--promo' : ''}" data-produto-id="${p.id}">
                ${p.imagemUrl
                    ? `<img src="${API_BASE}${p.imagemUrl}" alt="${p.nome}" class="product-img">`
                    : `<div class="product-img-placeholder">📦</div>`}
                <div class="product-info">
                    <h3>${p.nome}</h3>
                    <p>${p.descricao || ''} · Disponível: ${p.estoque}</p>
                </div>
                ${precoHtml}
            </button>`;
        }).join('');

        html += `</div></div>`;
    });

    listaProdutos.innerHTML = html;
}

/* ===================================================================
   CARRINHO
   =================================================================== */

function adicionarAoCarrinho(produtoId) {
    const p = state.produtos.find(x => x.id === produtoId);
    if (!p) return;

    const existente = state.carrinho.find(i => i.produtoId === produtoId);
    if (existente) {
        if (existente.quantidade >= p.estoque) {
            showToast(`Quantidade máxima disponível de "${p.nome}": ${p.estoque}`, 'error');
            return;
        }
        existente.quantidade += 1;
    } else {
        const precoEfetivo = (p.ofertaAtiva && p.precoPromocional > 0) ? p.precoPromocional : p.preco;
        state.carrinho.push({
            produtoId: p.id,
            nome: p.nome,
            preco: precoEfetivo,
            precoOriginal: p.preco,
            estoque: p.estoque,
            imagemUrl: p.imagemUrl || '',
            ofertaAtiva: p.ofertaAtiva || false,
            quantidade: 1
        });
    }
    renderCarrinho();
    showToast(`${p.nome} adicionado.`, 'success');
}

function alterarQuantidade(produtoId, delta) {
    const item = state.carrinho.find(i => i.produtoId === produtoId);
    if (!item) return;
    const novo = item.quantidade + delta;
    if (novo <= 0) { removerDoCarrinho(produtoId); return; }
    if (novo > item.estoque) { showToast(`Disponível: ${item.estoque} unidade(s)`, 'error'); return; }
    item.quantidade = novo;
    renderCarrinho();
}

function removerDoCarrinho(produtoId) {
    state.carrinho = state.carrinho.filter(i => i.produtoId !== produtoId);
    renderCarrinho();
}

function getResumo() {
    const itens = state.carrinho.length;
    const quantidade = state.carrinho.reduce((a, i) => a + i.quantidade, 0);
    const subtotal = state.carrinho.reduce((a, i) => a + i.quantidade * i.preco, 0);
    const desconto = state.cupom.aplicado ? state.cupom.valorDesconto : 0;
    const taxaEntrega = state.modoEntrega === 'retirada' ? 0 : TAXA_ENTREGA_FIXA;
    const descontoPontos = state.pontosUsados / 100;
    const total = Math.max(subtotal - desconto - descontoPontos + taxaEntrega, 0);
    return { itens, quantidade, subtotal, desconto, descontoPontos, taxaEntrega, total };
}

function renderCarrinho() {
    const { itens, quantidade, total } = getResumo();

    document.getElementById('resumoItens').textContent = itens;
    document.getElementById('resumoQuantidade').textContent = quantidade;
    document.getElementById('resumoTotal').textContent = formatCurrency(total);

    if (!state.carrinho.length) {
        carrinhoVazio.style.display = 'block';
        itensPedido.innerHTML = '';
        return;
    }
    carrinhoVazio.style.display = 'none';

    itensPedido.innerHTML = state.carrinho.map(item => `
        <div class="cart-item">
            ${item.imagemUrl
                ? `<img src="${API_BASE}${item.imagemUrl}" alt="${item.nome}" class="cart-item-img">`
                : `<div class="cart-item-img-placeholder">📦</div>`}
            <div>
                <h4>${item.nome}</h4>
                <small>${formatCurrency(item.preco)} cada</small>
            </div>
            <div class="qty-box">
                <button type="button" class="qty-btn" onclick="alterarQuantidade(${item.produtoId}, -1)">−</button>
                <strong>${item.quantidade}</strong>
                <button type="button" class="qty-btn" onclick="alterarQuantidade(${item.produtoId}, 1)">+</button>
            </div>
            <strong>${formatCurrency(item.quantidade * item.preco)}</strong>
            <button type="button" class="icon-btn" onclick="removerDoCarrinho(${item.produtoId})">✕</button>
        </div>
    `).join('');
}

/* ===================================================================
   CLIENTE (GET /api/clientes/documento/{doc}  ·  POST /api/clientes)
   =================================================================== */

async function consultarCpf() {
    const cpf = onlyDigits(document.getElementById('cpf').value);

    if (!validarCpf(cpf)) {
        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'CPF inválido. Confira e tente novamente.';
        return;
    }

    statusCliente.className = 'status-box';
    statusCliente.textContent = 'Consultando cadastro...';

    try {
        const resp = await fetch(ENDPOINTS.buscarClientePorDocumento(cpf));

        if (resp.ok) {
            const cli = await resp.json();
            state.cliente.id = cli.id;
            state.cliente.existente = true;
            state.cliente.endereco = cli.endereco || '';

            document.getElementById('nomeCliente').value = cli.nome || '';
            document.getElementById('telefoneCliente').value = cli.telefone || '';
            document.getElementById('emailCliente').value = cli.email || '';
            document.getElementById('clienteId').value = cli.id;

            statusCliente.className = 'status-box success';
            statusCliente.textContent = `Cliente localizado: ${cli.nome}.`;
            showToast('Cliente encontrado no sistema.', 'success');
            carregarPontosCliente(cli.id);
            return;
        }

        if (resp.status === 404) {
            state.cliente.id = null;
            state.cliente.existente = false;
            state.cliente.endereco = '';
            document.getElementById('clienteId').value = '';
            document.getElementById('nomeCliente').value = '';
            document.getElementById('telefoneCliente').value = '';
            document.getElementById('emailCliente').value = '';

            statusCliente.className = 'status-box warning';
            statusCliente.textContent = 'CPF não encontrado. Preencha os dados para cadastrar um novo cliente.';
            showToast('Novo cliente — preencha os dados abaixo.', 'success');
            return;
        }

        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'Não foi possível consultar o CPF agora.';
    } catch {
        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'Erro de comunicação ao consultar CPF.';
    }
}

async function garantirClienteId() {
    if (state.cliente.id) return state.cliente.id;

    const payload = {
        nome: state.cliente.nome,
        telefone: state.cliente.telefone,
        email: state.cliente.email,
        documento: state.cliente.cpf,
        endereco: montarEnderecoString()
    };

    const resp = await fetch(ENDPOINTS.criarCliente, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (resp.ok || resp.status === 201) {
        state.cliente.id = data.clienteId;
        return data.clienteId;
    }

    if (resp.status === 409 && data.clienteId) {
        state.cliente.id = data.clienteId;
        return data.clienteId;
    }

    throw new Error(data.mensagem || 'Erro ao cadastrar cliente.');
}

/* ===================================================================
   ENDEREÇO — concatena campos em string única para EnderecoEntrega
   =================================================================== */

async function buscarCep(cep) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    const statusEl = document.getElementById('cepStatus');
    if (statusEl) {
        statusEl.textContent = 'Buscando endereço...';
        statusEl.style.color = 'var(--muted)';
    }

    try {
        const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await resp.json();

        if (data.erro) {
            if (statusEl) {
                statusEl.textContent = 'CEP não encontrado.';
                statusEl.style.color = 'var(--danger)';
            }
            return;
        }

        if (data.logradouro) document.getElementById('logradouro').value = data.logradouro;
        if (data.bairro) document.getElementById('bairro').value = data.bairro;
        if (data.localidade) document.getElementById('cidade').value = data.localidade;
        if (data.uf) document.getElementById('uf').value = data.uf;

        if (statusEl) {
            statusEl.innerHTML = `<span style="color:var(--success)">✓ ${data.localidade}/${data.uf}</span>`;
        }

        document.getElementById('numero').focus();
    } catch {
        if (statusEl) {
            statusEl.textContent = 'Erro ao buscar CEP. Preencha manualmente.';
            statusEl.style.color = 'var(--warning)';
        }
    }
}

function selecionarModoEntrega(modo) {
    state.modoEntrega = modo;
    document.querySelectorAll('.address-tab').forEach(t => t.classList.toggle('active', t.dataset.modo === modo));
    document.querySelectorAll('.address-panel').forEach(p => p.classList.add('hidden'));

    if (modo === 'cadastrado') {
        const panel = document.getElementById('panelCadastrado');
        panel.classList.remove('hidden');
        const texto = document.getElementById('enderecoCadastradoTexto');
        texto.textContent = state.cliente.endereco || 'Nenhum endereço cadastrado para este cliente.';
    } else if (modo === 'retirada') {
        document.getElementById('panelRetirada').classList.remove('hidden');
    } else {
        document.getElementById('panelNovo').classList.remove('hidden');
    }
}

function inicializarAbasEndereco() {
    if (state.cliente.existente && state.cliente.endereco) {
        selecionarModoEntrega('cadastrado');
    } else {
        selecionarModoEntrega('novo');
    }
}

function capturarEndereco() {
    if (state.modoEntrega === 'cadastrado') {
        state.endereco = { cadastrado: true, texto: state.cliente.endereco };
    } else if (state.modoEntrega === 'retirada') {
        state.endereco = { retirada: true, texto: state.enderecoLoja };
    } else {
        state.endereco = {
            cep: document.getElementById('cep').value.trim(),
            logradouro: document.getElementById('logradouro').value.trim(),
            numero: document.getElementById('numero').value.trim(),
            bairro: document.getElementById('bairro').value.trim(),
            cidade: document.getElementById('cidade').value.trim(),
            uf: document.getElementById('uf').value.trim().toUpperCase(),
            complemento: document.getElementById('complemento').value.trim(),
            referencia: document.getElementById('referencia').value.trim()
        };
    }
}

function montarEnderecoString() {
    if (state.modoEntrega === 'cadastrado') {
        return state.cliente.endereco || '';
    }
    if (state.modoEntrega === 'retirada') {
        return 'RETIRADA NO LOCAL - ' + (state.enderecoLoja || '');
    }
    const e = state.endereco;
    let partes = [];
    if (e.logradouro) partes.push(e.logradouro);
    if (e.numero) partes.push(`nº ${e.numero}`);
    if (e.complemento) partes.push(e.complemento);
    if (e.bairro) partes.push(e.bairro);
    if (e.cidade && e.uf) partes.push(`${e.cidade}/${e.uf}`);
    else if (e.cidade) partes.push(e.cidade);
    if (e.cep) partes.push(`CEP ${e.cep}`);
    if (e.referencia) partes.push(`Ref: ${e.referencia}`);
    return partes.join(', ');
}

function capturarCliente() {
    state.cliente.cpf = onlyDigits(document.getElementById('cpf').value);
    state.cliente.nome = document.getElementById('nomeCliente').value.trim();
    state.cliente.telefone = document.getElementById('telefoneCliente').value.trim();
    state.cliente.email = document.getElementById('emailCliente').value.trim();
}

/* ===================================================================
   WIZARD — Navegação entre etapas
   =================================================================== */

function irParaEtapa(step) {
    state.step = step;
    steps.forEach(c => c.classList.toggle('active', Number(c.dataset.step) === step));
    progressSteps.forEach(p => {
        const n = Number(p.dataset.step);
        p.classList.toggle('active', n === step);
        p.classList.toggle('done', n < step);
    });
    if (step === 4) inicializarAbasEndereco();
    if (step === 5) atualizarTotalPagamento();
    if (step === 6) preencherRevisao();
    try { sessionStorage.setItem('pedidoCerto_etapa', step); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validarEtapaAtual() {
    const s = state.step;

    if (s === 1) {
        if (!state.carrinho.length) {
            showToast('Adicione pelo menos 1 produto.', 'error');
            return false;
        }
    }

    if (s === 2) {
        if (!state.carrinho.length) {
            showToast('Seu carrinho está vazio.', 'error');
            return false;
        }
        state.desconto = state.cupom.aplicado ? state.cupom.valorDesconto : 0;
        state.observacao = document.getElementById('observacao').value.trim();
    }

    if (s === 3) {
        const cpf = document.getElementById('cpf').value.trim();
        const nome = document.getElementById('nomeCliente').value.trim();
        const telefone = document.getElementById('telefoneCliente').value.trim();

        if (!validarCpf(cpf)) {
            showToast('Informe um CPF válido.', 'error');
            document.getElementById('cpf').focus();
            return false;
        }
        if (!nome) {
            showToast('Informe o nome do cliente.', 'error');
            document.getElementById('nomeCliente').focus();
            return false;
        }
        if (!telefone) {
            showToast('Informe o telefone do cliente.', 'error');
            document.getElementById('telefoneCliente').focus();
            return false;
        }
        capturarCliente();
    }

    if (s === 4) {
        if (!state.modoEntrega) {
            showToast('Selecione um modo de entrega.', 'error');
            return false;
        }
        if (state.modoEntrega === 'cadastrado') {
            if (!state.cliente.endereco) {
                showToast('Este cliente não possui endereço cadastrado. Escolha outra opção.', 'error');
                return false;
            }
        }
        if (state.modoEntrega === 'novo') {
            const obrig = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'];
            for (const id of obrig) {
                const el = document.getElementById(id);
                if (!el.value.trim()) {
                    showToast('Preencha todos os campos de endereço obrigatórios.', 'error');
                    el.focus();
                    return false;
                }
            }
        }
        capturarEndereco();
    }

    if (s === 5) {
        if (!state.formaPagamento) {
            showToast('Selecione a forma de pagamento.', 'error');
            return false;
        }

        if (state.formaPagamento === 1) {
            const trocoInput = document.getElementById('trocoPara');
            const trocoValor = parseFloat(trocoInput.value);
            const { total } = getResumo();

            if (!trocoInput.value.trim() || isNaN(trocoValor) || trocoValor <= 0) {
                showToast('Informe com quanto o cliente vai pagar em dinheiro.', 'error');
                trocoInput.focus();
                return false;
            }

            if (trocoValor < total) {
                showToast(`O valor informado (${formatCurrency(trocoValor)}) é menor que o total do pedido (${formatCurrency(total)}). Informe um valor igual ou maior.`, 'error');
                trocoInput.focus();
                return false;
            }

            state.trocoPara = trocoValor;
        } else {
            state.trocoPara = 0;
        }
    }

    return true;
}

/* ===================================================================
   REVISÃO (Etapa 6)
   =================================================================== */

function preencherRevisao() {
    const { subtotal, desconto, descontoPontos, taxaEntrega, total } = getResumo();

    document.getElementById('reviewCliente').innerHTML = `
        <p><strong>${state.cliente.nome}</strong></p>
        <p>CPF: ${formatCpf(state.cliente.cpf)}</p>
        <p>Telefone: ${state.cliente.telefone || '—'}</p>
        <p>E-mail: ${state.cliente.email || '—'}</p>
        ${state.cliente.existente ? '<p style="color:var(--success);font-weight:700">✓ Cliente já cadastrado</p>' : '<p style="color:var(--warning);font-weight:700">⚠ Novo cadastro</p>'}
    `;

    const end = state.endereco;
    let endHtml = '';
    if (state.modoEntrega === 'cadastrado') {
        endHtml = `
            <p style="color:var(--accent);font-weight:700">📍 Endereço Cadastrado</p>
            <p>${state.cliente.endereco}</p>
        `;
    } else if (state.modoEntrega === 'retirada') {
        endHtml = `
            <p style="color:var(--success);font-weight:700">🏪 Retirada no Estabelecimento</p>
            <p>${state.enderecoLoja}</p>
            <p style="color:var(--success);font-size:.85rem">✓ Sem taxa de entrega</p>
        `;
    } else {
        endHtml = `
            <p style="color:var(--primary);font-weight:700">📝 Novo Endereço</p>
            <p>${end.logradouro}, nº ${end.numero}</p>
            <p>${end.bairro} — ${end.cidade}/${end.uf}</p>
            <p>CEP: ${end.cep}</p>
            ${end.complemento ? `<p>${end.complemento}</p>` : ''}
            ${end.referencia ? `<p>Ref: ${end.referencia}</p>` : ''}
        `;
    }
    document.getElementById('reviewEndereco').innerHTML = endHtml;

    document.getElementById('reviewItens').innerHTML = state.carrinho.map(i =>
        `<p>${i.quantidade}× ${i.nome} — ${formatCurrency(i.quantidade * i.preco)}</p>`
    ).join('');

    const nomePag = FORMAS_PAGAMENTO[state.formaPagamento] || '—';
    document.getElementById('reviewPagamento').innerHTML = `<p>${nomePag}</p>`;

    let valoresHtml = `<p>Subtotal: ${formatCurrency(subtotal)}</p>`;
    if (desconto > 0)
        valoresHtml += `<p>Cupom (${state.cupom.codigo}): -${formatCurrency(desconto)}</p>`;
    if (descontoPontos > 0)
        valoresHtml += `<p>🎯 Pontos (${state.pontosUsados} pts): -${formatCurrency(descontoPontos)}</p>`;
    if (taxaEntrega > 0)
        valoresHtml += `<p>🚚 Taxa de entrega: ${formatCurrency(taxaEntrega)}</p>`;
    valoresHtml += `<p style="font-size:1.2rem"><strong>Total: ${formatCurrency(total)}</strong></p>`;
    if (state.formaPagamento === 1 && state.trocoPara > 0) {
        const troco = state.trocoPara - total;
        valoresHtml += `<p>💵 Troco para: ${formatCurrency(state.trocoPara)} (Troco: ${formatCurrency(troco)})</p>`;
    }
    if (state.observacao)
        valoresHtml += `<p style="margin-top:6px;font-size:.85rem;opacity:.85">Obs: ${state.observacao}</p>`;

    document.getElementById('reviewValores').innerHTML = valoresHtml;
}

/* ===================================================================
   PAYLOAD — monta o corpo para POST /api/pedidos
   =================================================================== */

function montarPayload(clienteId) {
    return {
        clienteId: clienteId,
        usuarioId: parseInt(document.getElementById('usuarioId').value) || 1,
        desconto: state.desconto,
        codigoCupom: state.cupom.aplicado ? state.cupom.codigo : '',
        observacao: state.observacao,
        formaPagamento: state.formaPagamento,
        taxaEntrega: state.modoEntrega === 'retirada' ? 0 : TAXA_ENTREGA_FIXA,
        trocoPara: state.formaPagamento === 1 ? state.trocoPara : 0,
        pontosUsados: state.pontosUsados || 0,
        enderecoEntrega: montarEnderecoString(),
        itens: state.carrinho.map(i => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade
        }))
    };
}

/* ===================================================================
   CUPOM DE DESCONTO (GET /api/cupons/validar/{codigo}?subtotal=)
   =================================================================== */

async function validarCupom() {
    const input = document.getElementById('codigoCupom');
    const statusEl = document.getElementById('cupomStatus');
    const codigo = input.value.trim();

    if (!codigo) {
        statusEl.textContent = 'Digite o código do cupom.';
        statusEl.style.color = 'var(--warning)';
        input.focus();
        return;
    }

    const { subtotal } = getResumo();

    statusEl.textContent = 'Validando cupom...';
    statusEl.style.color = 'var(--muted)';

    try {
        const resp = await fetch(ENDPOINTS.validarCupom(codigo, subtotal));
        const data = await resp.json();

        if (resp.ok && data.sucesso) {
            state.cupom = {
                codigo: data.codigo,
                aplicado: true,
                valorDesconto: data.valorDesconto,
                descricao: data.descricao || ''
            };
            state.desconto = data.valorDesconto;

            const info = data.tipoDesconto === 2
                ? `${data.valor}% de desconto`
                : `R$ ${data.valorDesconto.toFixed(2)} de desconto`;

            statusEl.innerHTML = `<strong style="color:var(--success)">✓ Cupom "${data.codigo}" aplicado!</strong> ${info}${data.descricao ? ` — ${data.descricao}` : ''}`;
            statusEl.style.color = 'var(--success)';

            input.disabled = true;
            document.getElementById('btnAplicarCupom').textContent = 'Remover';
            document.getElementById('btnAplicarCupom').removeEventListener('click', validarCupom);
            document.getElementById('btnAplicarCupom').addEventListener('click', removerCupom);

            renderCarrinho();
            showToast('Cupom aplicado com sucesso!', 'success');
        } else {
            statusEl.textContent = data.mensagem || 'Cupom inválido.';
            statusEl.style.color = 'var(--danger)';
            showToast(data.mensagem || 'Cupom inválido.', 'error');
        }
    } catch {
        statusEl.textContent = 'Erro ao validar o cupom. Tente novamente.';
        statusEl.style.color = 'var(--danger)';
        showToast('Erro de conexão ao validar cupom.', 'error');
    }
}

function removerCupom() {
    state.cupom = { codigo: '', aplicado: false, valorDesconto: 0, descricao: '' };
    state.desconto = 0;

    const input = document.getElementById('codigoCupom');
    input.disabled = false;
    input.value = '';

    const statusEl = document.getElementById('cupomStatus');
    statusEl.textContent = 'Se possui um cupom, insira o código acima.';
    statusEl.style.color = '';

    document.getElementById('btnAplicarCupom').textContent = 'Aplicar';
    document.getElementById('btnAplicarCupom').removeEventListener('click', removerCupom);
    document.getElementById('btnAplicarCupom').addEventListener('click', validarCupom);

    renderCarrinho();
    showToast('Cupom removido.', 'success');
}

/* ===================================================================
   ENVIAR PEDIDO
   =================================================================== */

async function enviarPedido(e) {
    e.preventDefault();
    if (state.step !== 6) return;

    // Bloquear pedido se loja não aceita pedidos
    if (state.aceitaPedidos === false || state.lojaAberta === false) {
        const mensagens = {
            fechada: state.horarioTexto
                ? `A loja está fechada no momento. Horário: ${state.horarioTexto}.`
                : 'A loja está fechada no momento. Tente novamente mais tarde.',
            pausada: state.mensagemLoja || 'Loja pausada temporariamente. Tente novamente em instantes.',
            agendamento: 'No momento só aceitamos agendamentos pelo WhatsApp.'
        };
        const msg = mensagens[state.estadoLoja] || mensagens.fechada;
        showToast(msg, 'error');
        return;
    }

    // Sem conexão e sem cache de horário — não conseguimos verificar
    if (!state.sistemaOnline && state.aceitaPedidos === null && state.lojaAberta === null) {
        showToast('Não foi possível verificar o status da loja. Tente novamente em instantes.', 'error');
        return;
    }

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Enviando...';

    try {
        const clienteId = await garantirClienteId();
        const payload = montarPayload(clienteId);

        const resp = await fetch(ENDPOINTS.criarPedido, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok || resp.status === 201) {
            const num = data?.numeroPedido || `#${data?.pedidoId || ''}`;

            // Notificar atividade de compra para exibição ao vivo
            fetch(`${API_BASE}/api/site/compra`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clienteNome: state.cliente.nome,
                    numeroPedido: num
                })
            }).catch(() => {});

            // Se for PIX, mostrar overlay de pagamento
            if (state.formaPagamento === 2 && data?.pedidoId && data?.valorTotal) {
                showToast(`Pedido ${num} criado! Complete o pagamento via Pix.`, 'success');
                exibirOverlayPix(data.pedidoId, num, data.valorTotal);
                return;
            }

            showToast(`Pedido ${num} criado com sucesso!`, 'success');
            setTimeout(() => resetarPedido(), 1500);
            return;
        }

        showToast(data?.mensagem || 'Erro ao criar pedido.', 'error');
    } catch (err) {
        showToast(err.message || 'Sem conexão com o servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Pedido';
    }
}

/* ===================================================================
   OVERLAY PIX — Pagamento pós-pedido (Mercado Pago + polling)
   =================================================================== */

let pixOverlayPedidoId = null;
let pixOverlayValor = 0;
let pixPollingInterval = null;

async function exibirOverlayPix(pedidoId, numeroPedido, valorTotal) {
    pixOverlayPedidoId = pedidoId;
    pixOverlayValor = valorTotal;

    const overlay = document.getElementById('pixOverlay');
    const container = document.getElementById('pixOverlayQrContainer');
    const copiaCola = document.getElementById('pixOverlayCopiaCola');

    document.getElementById('pixOverlayPedido').textContent = `Pedido ${numeroPedido}`;
    document.getElementById('pixOverlayAmount').textContent = formatCurrency(valorTotal);

    // Resetar estado visual
    document.getElementById('pixResultado').classList.add('hidden');
    document.querySelector('.pix-overlay-timer').style.display = '';
    document.querySelector('.pix-overlay-actions').style.display = '';
    document.querySelector('.pix-overlay-qr').style.display = '';
    document.querySelector('.pix-overlay-copiacola').style.display = '';
    document.getElementById('pixOverlayCopyStatus').style.display = 'none';
    document.getElementById('btnConfirmarPix').disabled = false;
    document.getElementById('btnConfirmarPix').textContent = '✅ Já paguei';

    container.innerHTML = '<div class="empty-state" style="padding:20px">Gerando QR Code do Pix...</div>';
    copiaCola.value = '';
    overlay.classList.add('visible');

    // Tentar criar cobrança dinâmica via Mercado Pago
    try {
        const resp = await fetch(`${API_BASE}/api/pix/cobranca`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedidoId,
                valor: valorTotal,
                numeroPedido: numeroPedido,
                emailPagador: state.cliente.email || ''
            })
        });

        const data = await resp.json();

        if (resp.ok && data.sucesso) {
            // QR Code dinâmico do Mercado Pago
            container.innerHTML = '';
            if (data.qrCodeBase64) {
                const img = document.createElement('img');
                img.src = `data:image/png;base64,${data.qrCodeBase64}`;
                img.alt = 'QR Code PIX';
                img.style.width = '220px';
                img.style.height = '220px';
                img.style.borderRadius = '12px';
                container.appendChild(img);
            }
            copiaCola.value = data.qrCode || '';

            // Iniciar polling automático a cada 5 segundos
            iniciarPollingPix(pedidoId);

            document.querySelector('.pix-overlay-timer small').textContent =
                '⏱️ Aguardando pagamento... (atualiza automaticamente)';
            return;
        }
    } catch {
        // Falha na API — usar QR estático como fallback
    }

    // Fallback: QR Code estático (sem confirmação automática)
    const payload = gerarPixPayload(valorTotal);
    copiaCola.value = payload;
    container.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: payload,
            width: 220,
            height: 220,
            colorDark: '#0f3460',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    document.querySelector('.pix-overlay-timer small').textContent =
        '⏱️ QR estático — clique em "Já paguei" após efetuar o pagamento';
}

function iniciarPollingPix(pedidoId) {
    pararPollingPix();
    pixPollingInterval = setInterval(async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/pix/status/${pedidoId}`);
            if (!resp.ok) return;
            const data = await resp.json();

            if (data.pago || data.status === 'approved') {
                pararPollingPix();
                exibirPagamentoConfirmado();
            }
        } catch { /* silencioso */ }
    }, 5000);
}

function pararPollingPix() {
    if (pixPollingInterval) {
        clearInterval(pixPollingInterval);
        pixPollingInterval = null;
    }
}

function exibirPagamentoConfirmado() {
    document.querySelector('.pix-overlay-timer').style.display = 'none';
    document.querySelector('.pix-overlay-actions').style.display = 'none';
    document.querySelector('.pix-overlay-qr').style.display = 'none';
    document.querySelector('.pix-overlay-copiacola').style.display = 'none';

    document.getElementById('pixResultado').classList.remove('hidden');
    showToast('Pagamento Pix confirmado automaticamente!', 'success');

    setTimeout(() => {
        document.getElementById('pixOverlay').classList.remove('visible');
        resetarPedido();
    }, 3000);
}

async function confirmarPagamentoPix() {
    if (!pixOverlayPedidoId) return;

    const btn = document.getElementById('btnConfirmarPix');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Confirmando...';

    try {
        const resp = await fetch(`${API_BASE}/api/pedidos/${pixOverlayPedidoId}/pagamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valor: pixOverlayValor,
                formaPagamento: 2,
                observacao: 'Pagamento via Pix confirmado pelo cliente'
            })
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok && data?.sucesso) {
            pararPollingPix();
            exibirPagamentoConfirmado();
            return;
        }

        showToast(data?.mensagem || 'Erro ao confirmar pagamento.', 'error');
        btn.disabled = false;
        btn.textContent = '✅ Já paguei';
    } catch {
        showToast('Erro de conexão ao confirmar pagamento.', 'error');
        btn.disabled = false;
        btn.textContent = '✅ Já paguei';
    }
}

function fecharOverlayPix() {
    pararPollingPix();
    document.getElementById('pixOverlay').classList.remove('visible');
    showToast('Você poderá pagar depois. O pedido foi criado com pagamento pendente.', 'success');
    setTimeout(() => resetarPedido(), 2000);
}

/* ===================================================================
   IDENTIFICAÇÃO POR CPF (tela inicial)
   =================================================================== */

function exibirBoasVindas(dados) {
    const welcomeDiv = document.getElementById('welcomeBack');
    document.getElementById('welcomeNome').textContent = `Olá, ${dados.nome}!`;
    document.getElementById('welcomeCpf').textContent = `CPF: ${formatCpf(dados.cpf)}`;
    welcomeDiv.classList.remove('hidden');

    document.getElementById('cpfInputArea').classList.add('hidden');
    document.getElementById('changeCpfArea').classList.remove('hidden');
}

function trocarCpf() {
    localStorage.removeItem(STORAGE_KEY);

    document.getElementById('welcomeBack').classList.add('hidden');
    document.getElementById('changeCpfArea').classList.add('hidden');
    document.getElementById('cpfInputArea').classList.remove('hidden');

    const input = document.getElementById('cpfIdentificacao');
    input.value = '';
    input.focus();

    document.getElementById('chkLembrar').checked = false;
}

function preencherDadosCliente(cli) {
    state.cliente.id = cli.id || cli.clienteId || null;
    state.cliente.cpf = cli.cpf || cli.documento || '';
    state.cliente.nome = cli.nome || '';
    state.cliente.telefone = cli.telefone || '';
    state.cliente.email = cli.email || '';
    state.cliente.existente = true;
    state.cliente.endereco = cli.endereco || '';

    document.getElementById('cpf').value = formatCpf(state.cliente.cpf);
    document.getElementById('nomeCliente').value = state.cliente.nome;
    document.getElementById('telefoneCliente').value = state.cliente.telefone;
    document.getElementById('emailCliente').value = state.cliente.email;
    document.getElementById('clienteId').value = state.cliente.id || '';

    statusCliente.className = 'status-box success';
    statusCliente.textContent = `Cliente localizado: ${state.cliente.nome}.`;
}

function mostrarWizard() {
    document.getElementById('telaIdentificacao').classList.add('hidden');
    document.getElementById('wizardShell').classList.remove('hidden');
}

async function identificarCliente() {
    const input = document.getElementById('cpfIdentificacao');
    const cpfRaw = onlyDigits(input.value);

    if (!validarCpf(cpfRaw)) {
        showToast('CPF inválido. Confira e tente novamente.', 'error');
        input.focus();
        return;
    }

    const btn = document.getElementById('btnIdentificar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Consultando...';

    try {
        const resp = await fetch(ENDPOINTS.buscarClientePorDocumento(cpfRaw));

        if (resp.ok) {
            const cli = await resp.json();

            const dados = {
                cpf: cpfRaw,
                nome: cli.nome,
                clienteId: cli.id
            };

            if (document.getElementById('chkLembrar').checked) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
            }

            preencherDadosCliente({ ...cli, cpf: cpfRaw });
            carregarPontosCliente(cli.id);
            showToast(`Bem-vindo(a), ${cli.nome}!`, 'success');
            mostrarWizard();
            return;
        }

        if (resp.status === 404) {
            state.cliente.cpf = cpfRaw;
            state.cliente.existente = false;
            document.getElementById('cpf').value = formatCpf(cpfRaw);

            statusCliente.className = 'status-box warning';
            statusCliente.textContent = 'CPF não encontrado. Preencha os dados para cadastrar um novo cliente.';

            if (document.getElementById('chkLembrar').checked) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ cpf: cpfRaw, nome: '', clienteId: null }));
            }

            showToast('Novo cliente — preencha os dados na etapa "Cliente".', 'success');
            mostrarWizard();
            return;
        }

        showToast('Não foi possível consultar o CPF agora.', 'error');
    } catch {
        showToast('Erro de comunicação ao consultar CPF.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Continuar';
    }
}

function inicializarIdentificacao() {
    const salvo = localStorage.getItem(STORAGE_KEY);

    if (salvo) {
        try {
            const dados = JSON.parse(salvo);
            if (dados.cpf) {
                document.getElementById('cpfIdentificacao').value = formatCpf(dados.cpf);
                document.getElementById('chkLembrar').checked = true;

                if (dados.nome) {
                    exibirBoasVindas(dados);
                }
            }
        } catch { /* localStorage corrompido, ignora */ }
    }
}

/* ===================================================================
   PONTOS – Carregar saldo e usar como desconto (100 pts = R$ 1,00)
   =================================================================== */

async function carregarPontosCliente(clienteId) {
    try {
        const resp = await fetch(ENDPOINTS.fidelidade(clienteId));
        if (!resp.ok) return;
        const data = await resp.json();
        state.pontosDisponiveis = data.totalPontos || 0;
        atualizarPontosUI();
    } catch {
        state.pontosDisponiveis = 0;
    }
}

function atualizarPontosUI() {
    const section = document.getElementById('pontosSection');
    const info = document.getElementById('pontosInfo');
    if (!section || !info) return;

    if (state.pontosDisponiveis <= 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    const maxValor = (state.pontosDisponiveis / 100).toFixed(2).replace('.', ',');
    info.textContent = `Você tem ${state.pontosDisponiveis} pontos (equivale a R$ ${maxValor}).`;

    const input = document.getElementById('pontosUsar');
    if (input) {
        input.max = state.pontosDisponiveis;
        if (!input.value) input.value = '';
    }
    atualizarDescontoPontos();
}

function atualizarDescontoPontos() {
    const input = document.getElementById('pontosUsar');
    const valorEl = document.getElementById('pontosValor');
    if (!input || !valorEl) return;

    const val = parseInt(input.value) || 0;

    if (val > state.pontosDisponiveis) {
        input.value = state.pontosDisponiveis;
        state.pontosUsados = state.pontosDisponiveis;
    } else {
        state.pontosUsados = Math.max(0, val);
    }

    const desconto = state.pontosUsados / 100;
    if (desconto > 0) {
        valorEl.innerHTML = `<span style="color:var(--success)">✅ Desconto de ${formatCurrency(desconto)} será aplicado.</span>`;
    } else {
        valorEl.textContent = '';
    }

    renderCarrinho();
    atualizarTotalPagamento();
}

function atualizarTotalPagamento() {
    const el = document.getElementById('totalPagamento');
    if (el) {
        const { total } = getResumo();
        el.textContent = formatCurrency(total);
    }
}

/* ===================================================================
   PIX — Gerador de payload EMV (padrão BACEN) + QR Code
   =================================================================== */

function pixCrc16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function pixField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return id + len + value;
}

function gerarPixPayload(valor) {
    const gui = pixField('00', 'BR.GOV.BCB.PIX');
    const chave = pixField('01', PIX_CONFIG.chave);
    const merchantInfo = pixField('26', gui + chave);

    const valorStr = valor.toFixed(2);
    const txid = pixField('05', '***');
    const additionalData = pixField('62', txid);

    let payload = '';
    payload += pixField('00', '01');               // Payload Format Indicator
    payload += pixField('01', '12');               // Point of Initiation (dinâmico)
    payload += merchantInfo;                        // Merchant Account Info
    payload += pixField('52', '0000');             // MCC
    payload += pixField('53', '986');              // Currency (BRL)
    payload += pixField('54', valorStr);           // Transaction Amount
    payload += pixField('58', 'BR');               // Country
    payload += pixField('59', PIX_CONFIG.nome.substring(0, 25));
    payload += pixField('60', PIX_CONFIG.cidade.substring(0, 15));
    payload += additionalData;
    payload += '6304';                              // CRC field ID + length

    const crc = pixCrc16(payload);
    return payload + crc;
}

let pixQrInstance = null;

function renderPixQrCode(valor) {
    const pixSection = document.getElementById('pixSection');
    const container = document.getElementById('pixQrContainer');
    const amountEl = document.getElementById('pixAmount');
    const copiaCola = document.getElementById('pixCopiaCola');
    const copyStatus = document.getElementById('pixCopyStatus');

    copyStatus.style.display = 'none';

    if (!valor || valor <= 0) {
        pixSection.style.display = 'none';
        return;
    }

    const payload = gerarPixPayload(valor);

    amountEl.textContent = `Total a pagar: ${formatCurrency(valor)}`;
    copiaCola.value = payload;

    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        pixQrInstance = new QRCode(container, {
            text: payload,
            width: 220,
            height: 220,
            colorDark: '#0f3460',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        container.innerHTML = '<p style="color:var(--warning);font-size:.85rem">QR Code indisponível.</p>';
    }

    pixSection.style.display = '';
}

function copiarPixCodigo() {
    const input = document.getElementById('pixCopiaCola');
    const status = document.getElementById('pixCopyStatus');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => {
            status.style.display = '';
            showToast('Código Pix copiado!', 'success');
            setTimeout(() => { status.style.display = 'none'; }, 3000);
        }).catch(() => fallbackCopy(input, status));
    } else {
        fallbackCopy(input, status);
    }
}

function fallbackCopy(input, status) {
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand('copy');
    status.style.display = '';
    showToast('Código Pix copiado!', 'success');
    setTimeout(() => { status.style.display = 'none'; }, 3000);
}

/* ===================================================================
   EVENT LISTENERS
   =================================================================== */

document.getElementById('listaProdutos').addEventListener('click', (e) => {
    const card = e.target.closest('[data-produto-id]');
    if (card) adicionarAoCarrinho(Number(card.dataset.produtoId));
});

document.getElementById('btnIrCarrinho').addEventListener('click', () => {
    if (!state.carrinho.length) { showToast('Selecione pelo menos um produto.', 'error'); return; }
    irParaEtapa(2);
});

document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (validarEtapaAtual()) irParaEtapa(state.step + 1);
    });
});

document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => irParaEtapa(state.step - 1));
});

document.getElementById('cpf').addEventListener('input', (e) => {
    e.target.value = formatCpf(e.target.value);
});

document.getElementById('cep').addEventListener('input', (e) => {
    const d = onlyDigits(e.target.value).slice(0, 8);
    e.target.value = d.replace(/(\d{5})(\d)/, '$1-$2');
    if (d.length === 8) buscarCep(d);
});

document.getElementById('btnConsultarCpf').addEventListener('click', consultarCpf);

document.querySelectorAll('.payment-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.payment-option').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        state.formaPagamento = parseInt(btn.dataset.value);
        document.getElementById('formaPagamento').value = state.formaPagamento;
        const trocoGroup = document.getElementById('trocoGroup');
        if (state.formaPagamento === 1) {
            trocoGroup.style.display = '';
            document.getElementById('trocoPara').value = '';
            atualizarTrocoInfo();
        } else {
            trocoGroup.style.display = 'none';
            document.getElementById('trocoPara').value = '';
            state.trocoPara = 0;
        }

        // PIX QR Code
        if (state.formaPagamento === 2) {
            const { total } = getResumo();
            renderPixQrCode(total);
        } else {
            document.getElementById('pixSection').style.display = 'none';
        }

        atualizarTotalPagamento();
    });
});

document.querySelectorAll('.address-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        selecionarModoEntrega(tab.dataset.modo);
    });
});

document.getElementById('trocoPara').addEventListener('input', atualizarTrocoInfo);

const pontosUsar = document.getElementById('pontosUsar');
if (pontosUsar) pontosUsar.addEventListener('input', atualizarDescontoPontos);

function atualizarTrocoInfo() {
    const trocoInput = document.getElementById('trocoPara');
    const infoEl = document.getElementById('trocoInfo');
    const valor = parseFloat(trocoInput.value);
    const { total } = getResumo();

    if (!trocoInput.value.trim() || isNaN(valor) || valor <= 0) {
        infoEl.textContent = 'Informe o valor que o cliente vai pagar em dinheiro.';
        infoEl.style.color = 'var(--muted)';
        return;
    }

    if (valor < total) {
        infoEl.textContent = `⚠️ Valor insuficiente. Total do pedido: ${formatCurrency(total)}`;
        infoEl.style.color = 'var(--danger)';
        return;
    }

    if (valor === total) {
        infoEl.textContent = '✅ Valor exato, sem troco.';
        infoEl.style.color = 'var(--success)';
    } else {
        const troco = valor - total;
        infoEl.textContent = `✅ Troco: ${formatCurrency(troco)}`;
        infoEl.style.color = 'var(--success)';
    }
}

document.getElementById('btnAplicarCupom').addEventListener('click', validarCupom);

document.getElementById('btnCopiarPix').addEventListener('click', copiarPixCodigo);

document.getElementById('btnCopiarPixOverlay').addEventListener('click', () => {
    const input = document.getElementById('pixOverlayCopiaCola');
    const status = document.getElementById('pixOverlayCopyStatus');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => {
            status.style.display = '';
            showToast('Código Pix copiado!', 'success');
            setTimeout(() => { status.style.display = 'none'; }, 3000);
        }).catch(() => fallbackCopy(input, status));
    } else {
        fallbackCopy(input, status);
    }
});

document.getElementById('btnConfirmarPix').addEventListener('click', confirmarPagamentoPix);
document.getElementById('btnPagarDepois').addEventListener('click', fecharOverlayPix);

document.getElementById('formPedido').addEventListener('submit', enviarPedido);

document.getElementById('btnIdentificar').addEventListener('click', identificarCliente);
document.getElementById('btnTrocarCpf').addEventListener('click', trocarCpf);

document.getElementById('cpfIdentificacao').addEventListener('input', (e) => {
    e.target.value = formatCpf(e.target.value);
});

document.getElementById('cpfIdentificacao').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); identificarCliente(); }
});

/* ===================================================================
   INICIALIZAÇÃO
   =================================================================== */

inicializarIdentificacao();
carregarProdutos();
carregarCuponsDisponiveis();
renderCarrinho();

(function restaurarEtapa() {
    try {
        const salva = parseInt(sessionStorage.getItem('pedidoCerto_etapa'), 10);
        irParaEtapa(salva >= 1 && salva <= 6 ? salva : 1);
    } catch {
        irParaEtapa(1);
    }
})();

/* ===================================================================
   BLOQUEIO VISUAL DE PEDIDO FORA DO HORÁRIO
   =================================================================== */

function atualizarBloqueioHorario() {
    const btnEnviar = document.getElementById('btnEnviar');
    const aviso = document.getElementById('avisoForaHorario');

    if (state.aceitaPedidos === true) {
        // Loja aberta e aceitando pedidos
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar Pedido';
        }
        if (aviso) aviso.style.display = 'none';
    } else if (state.lojaAberta === false || state.estadoLoja === 'fechada') {
        // Loja fechada
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.textContent = '🔒 Fora do Horário';
        }
        if (aviso) {
            aviso.textContent = state.horarioTexto
                ? `⏰ Pedidos disponíveis das ${state.horarioTexto}`
                : '⏰ Loja fechada no momento';
            aviso.style.display = 'block';
        }
    } else if (state.estadoLoja === 'pausada') {
        // Loja pausada temporariamente
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.textContent = '⏸ Pausada Temporariamente';
        }
        if (aviso) {
            aviso.textContent = state.mensagemLoja || '⏸ Loja pausada temporariamente. Volte em breve!';
            aviso.style.display = 'block';
        }
    } else if (state.estadoLoja === 'agendamento') {
        // Aceitando agendamentos
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.textContent = '📅 Apenas Agendamentos';
        }
        if (aviso) {
            aviso.textContent = state.mensagemLoja || '📅 Aceitando agendamentos para retirada futura.';
            aviso.style.display = 'block';
        }
    } else {
        // null — sem dados de horário, permitir navegação mas não envio
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.textContent = 'Verificando horário...';
        }
        if (aviso) aviso.style.display = 'none';
    }
}

/* ===================================================================
   STATUS DA LOJA (ONLINE / OFFLINE)
   =================================================================== */

const STORE_STATUS_INTERVAL = 15000; // 15 segundos
let storeOnline = null;

async function verificarStatusLoja() {
    const badge = document.getElementById('storeStatus');
    const banner = document.getElementById('offlineBanner');
    const text = badge.querySelector('.status-text');

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`${API_BASE}/api/status`, { signal: ctrl.signal });
        clearTimeout(timer);

        if (resp.ok) {
            const dados = await resp.json();

            // Guardar no cache para uso offline
            salvarCache(CACHE_KEYS.status, dados);

            // Extrair estado da API (novo formato com estado/aceitaPedidos)
            const estado = dados.estado || (dados.aberta !== false ? 'aberta' : 'fechada');
            const aceitaPedidos = dados.aceitaPedidos !== undefined ? dados.aceitaPedidos : dados.aberta !== false;

            state.estadoLoja = estado;
            state.aceitaPedidos = aceitaPedidos;
            state.mensagemLoja = dados.mensagem || '';

            if (dados.enderecoLoja) {
                state.enderecoLoja = dados.enderecoLoja;
                const lojaTexto = document.getElementById('enderecoLojaTexto');
                if (lojaTexto) { lojaTexto.textContent = dados.enderecoLoja; lojaTexto.style.opacity = '1'; }
            }

            // Sistema online
            state.sistemaOnline = true;

            // Carregar produtos na primeira vez
            if (storeOnline !== true) {
                storeOnline = true;
                carregarProdutos();
            }

            if (estado === 'aberta') {
                state.lojaAberta = true;
                badge.className = 'store-status online';
                text.textContent = 'Loja Aberta';
                badge.style.opacity = '1';
                if (banner) banner.classList.remove('visible');
            } else if (estado === 'pausada') {
                state.lojaAberta = true;
                badge.className = 'store-status paused';
                text.textContent = dados.mensagem || 'Loja Pausada';
                badge.style.opacity = '1';
                if (banner) {
                    const bannerText = banner.querySelector('.offline-banner-text');
                    if (bannerText) {
                        bannerText.textContent = dados.mensagem || '⏸ Estamos pausados temporariamente. Navegue pelo cardápio!';
                    }
                    banner.classList.add('visible');
                }
            } else if (estado === 'agendamento') {
                state.lojaAberta = false;
                badge.className = 'store-status scheduling';
                text.textContent = 'Aceitando Agendamentos';
                badge.style.opacity = '1';
                if (banner) {
                    const bannerText = banner.querySelector('.offline-banner-text');
                    if (bannerText) {
                        bannerText.textContent = dados.mensagem || '📅 Aceitando agendamentos para retirada futura. Navegue pelo cardápio!';
                    }
                    banner.classList.add('visible');
                }
            } else {
                // fechada
                state.lojaAberta = false;
                badge.className = 'store-status offline';
                badge.style.opacity = '1';

                if (dados.diaAberto && dados.horaAbertura) {
                    const virada = dados.horaFechamento <= dados.horaAbertura;
                    const ate = virada ? `${dados.horaFechamento} (dia seguinte)` : dados.horaFechamento;
                    state.horarioTexto = `${dados.horaAbertura} às ${ate}`;
                    text.textContent = `Loja Fechada · Abre ${dados.horaAbertura}`;
                } else {
                    state.horarioTexto = '';
                    text.textContent = 'Loja Fechada';
                }

                if (banner) {
                    const bannerText = banner.querySelector('.offline-banner-text');
                    if (bannerText) {
                        bannerText.textContent = state.horarioTexto
                            ? `⏰ Estamos fechados agora — Horário: ${state.horarioTexto}. Navegue pelo cardápio e volte no horário de atendimento!`
                            : '⏰ Estamos fechados agora. Volte mais tarde!';
                    }
                    banner.classList.add('visible');
                }
            }
            atualizarBloqueioHorario();
            return;
        }
        throw new Error();
    } catch {
        // Sistema offline — site permanece ativo, usa cache para determinar horário
        state.sistemaOnline = false;

        // Carregar produtos do cache se ainda não carregados
        if (!state.produtos.length) {
            const cached = lerCache(CACHE_KEYS.produtos);
            if (cached && cached.length) {
                state.produtos = cached;
                renderProdutos();
            }
        }

        // Carregar cupons do cache
        const cachedCupons = lerCache(CACHE_KEYS.cupons);
        if (cachedCupons && cachedCupons.length) {
            renderCupons(cachedCupons);
        }

        // Carregar status do cache para endereço e horário
        const cachedStatus = lerCache(CACHE_KEYS.status);
        if (cachedStatus) {
            if (cachedStatus.enderecoLoja) {
                state.enderecoLoja = cachedStatus.enderecoLoja;
                const lojaTexto = document.getElementById('enderecoLojaTexto');
                if (lojaTexto) { lojaTexto.textContent = cachedStatus.enderecoLoja; lojaTexto.style.opacity = '1'; }
            }

            // Verificar horário localmente com dados em cache
            const dentroHorario = estaNoHorario(cachedStatus);
            if (dentroHorario === true) {
                state.lojaAberta = true;
                state.aceitaPedidos = true;
                state.estadoLoja = 'aberta';
                badge.className = 'store-status online';
                text.textContent = 'Loja Aberta';
                badge.style.opacity = '1';
                if (banner) banner.classList.remove('visible');
            } else {
                state.lojaAberta = false;
                state.aceitaPedidos = false;
                state.estadoLoja = 'fechada';
                badge.className = 'store-status offline';
                badge.style.opacity = '1';
                if (cachedStatus.diaAberto && cachedStatus.horaAbertura) {
                    const virada = cachedStatus.horaFechamento <= cachedStatus.horaAbertura;
                    const ate = virada ? `${cachedStatus.horaFechamento} (dia seguinte)` : cachedStatus.horaFechamento;
                    state.horarioTexto = `${cachedStatus.horaAbertura} às ${ate}`;
                    text.textContent = `Loja Fechada · Abre ${cachedStatus.horaAbertura}`;
                } else {
                    state.horarioTexto = '';
                    text.textContent = 'Loja Fechada';
                }
                if (banner) {
                    const bannerText = banner.querySelector('.offline-banner-text');
                    if (bannerText) {
                        bannerText.textContent = state.horarioTexto
                            ? `⏰ Estamos fechados agora — Horário: ${state.horarioTexto}. Navegue pelo cardápio e volte no horário de atendimento!`
                            : '⏰ Estamos fechados agora. Volte mais tarde!';
                    }
                    banner.classList.add('visible');
                }
            }
            atualizarBloqueioHorario();
        } else {
            // Sem cache nenhum: manter cardápio visível, não mostrar "offline"
            badge.className = 'store-status';
            text.textContent = 'Consulte nosso horário';
            badge.style.opacity = '1';
            state.lojaAberta = null;
            state.aceitaPedidos = null;
            state.estadoLoja = null;
            atualizarBloqueioHorario();
        }
    }
}

verificarStatusLoja();
setInterval(verificarStatusLoja, STORE_STATUS_INTERVAL);

window.alterarQuantidade = alterarQuantidade;
window.removerDoCarrinho = removerDoCarrinho;

/* ===================================================================
   ATIVIDADE AO VIVO — Visitantes online + Notificações de compra
   =================================================================== */

(function initLiveActivity() {
    const SESSION_ID = sessionStorage.getItem('dm_session') || (function() { const id = crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`; sessionStorage.setItem('dm_session', id); return id; })();
    const HEARTBEAT_INTERVAL = 30000;   // 30s
    const POLL_INTERVAL = 10000;        // 10s
    const TOAST_DURATION = 5000;        // 5s visível

    let ultimoTimestamp = Date.now();
    let toastQueue = [];
    let toastExibindo = false;

    // ── Heartbeat ──
    function sendHeartbeat() {
        fetch(`${API_BASE}/api/site/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: SESSION_ID })
        }).catch(() => {});
    }

    // ── Polling de status ──
    async function pollStatus() {
        try {
            const res = await fetch(`${API_BASE}/api/site/status?desde=${ultimoTimestamp}`);
            if (!res.ok) return;

            const data = await res.json();

            // Atualizar contador online
            const countEl = document.getElementById('liveCount');
            if (countEl) countEl.textContent = data.online;
            salvarCache('dm_cache_online', data.online);

            // Novas compras
            if (data.compras && data.compras.length > 0) {
                data.compras.forEach(c => {
                    if (c.timestamp > ultimoTimestamp) {
                        toastQueue.push(c.primeiroNome);
                    }
                });
                // Atualizar timestamp para a maior compra
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

    // ── Fila de toasts de compra ──
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

    // ── Inicializar ──
    sendHeartbeat();
    pollStatus();
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    setInterval(pollStatus, POLL_INTERVAL);

    // ── Desconectar ao fechar a aba ──
    window.addEventListener('beforeunload', () => {
        const body = JSON.stringify({ sessionId: SESSION_ID });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${API_BASE}/api/site/disconnect`, new Blob([body], { type: 'application/json' }));
        }
    });
})();