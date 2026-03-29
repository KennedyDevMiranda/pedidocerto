/* ===================================================================
   DevMiranda — Script do Formulário de Pedido
   Adaptado à API real: /api/pedidos, /api/produtos, /api/clientes
   =================================================================== */

const API_BASE = 'https://api.pedidocerto.uk';

const ENDPOINTS = {
    criarPedido: `${API_BASE}/api/pedidos`,
    listarProdutos: (busca = '') => {
        const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
        return `${API_BASE}/api/produtos${q}`;
    },
    buscarClientePorDocumento: (doc) =>
        `${API_BASE}/api/clientes/documento/${encodeURIComponent(doc)}`,
    criarCliente: `${API_BASE}/api/clientes`,
    validarCupom: (codigo, subtotal) =>
        `${API_BASE}/api/cupons/validar/${encodeURIComponent(codigo)}?subtotal=${subtotal}`
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
    chave: '11999999999',         // Chave PIX do recebedor (telefone, CPF, e-mail ou aleatória)
    nome: 'DEVMIRANDA',           // Nome do recebedor (até 25 caracteres, sem acentos)
    cidade: 'SAO PAULO'           // Cidade do recebedor (até 15 caracteres, sem acentos)
};

/* ---------- Estado global ---------- */

const state = {
    step: 1,
    produtos: [],
    carrinho: [],
    cliente: {
        id: null,
        cpf: '',
        nome: '',
        email: '',
        telefone: '',
        existente: false
    },
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
    }
};

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

async function carregarProdutos(busca = '') {
    try {
        const resp = await fetch(ENDPOINTS.listarProdutos(busca));
        if (!resp.ok) throw new Error();
        const dados = await resp.json();
        state.produtos = Array.isArray(dados) ? dados : [];
        renderProdutos();
    } catch {
        listaProdutos.innerHTML = '<div class="empty-state">Não foi possível carregar os produtos do estoque.</div>';
        showToast('Erro ao carregar produtos.', 'error');
    }
}

let buscaTimeout;
produtoBusca.addEventListener('input', (e) => {
    clearTimeout(buscaTimeout);
    buscaTimeout = setTimeout(() => carregarProdutos(e.target.value.trim()), 300);
});

function renderProdutos() {
    if (!state.produtos.length) {
        listaProdutos.innerHTML = '<div class="empty-state">Nenhum produto encontrado no estoque.</div>';
        return;
    }
    listaProdutos.innerHTML = state.produtos.map(p => `
        <button type="button" class="product-card" data-produto-id="${p.id}">
            <div>
                <h3>${p.nome}</h3>
                <p>${p.descricao || ''} · Estoque: ${p.estoque}</p>
            </div>
            <div class="product-price">${formatCurrency(p.preco)}</div>
        </button>
    `).join('');
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
            showToast(`Estoque máximo de "${p.nome}": ${p.estoque}`, 'error');
            return;
        }
        existente.quantidade += 1;
    } else {
        state.carrinho.push({
            produtoId: p.id,
            nome: p.nome,
            preco: p.preco,
            estoque: p.estoque,
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
    if (novo > item.estoque) { showToast(`Estoque disponível: ${item.estoque}`, 'error'); return; }
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
    const taxaEntrega = TAXA_ENTREGA_FIXA;
    const total = Math.max(subtotal - desconto + taxaEntrega, 0);
    return { itens, quantidade, subtotal, desconto, taxaEntrega, total };
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

            document.getElementById('nomeCliente').value = cli.nome || '';
            document.getElementById('telefoneCliente').value = cli.telefone || '';
            document.getElementById('emailCliente').value = cli.email || '';
            document.getElementById('clienteId').value = cli.id;

            statusCliente.className = 'status-box success';
            statusCliente.textContent = `Cliente localizado: ${cli.nome} (ID ${cli.id}).`;
            showToast('Cliente encontrado no sistema.', 'success');
            return;
        }

        if (resp.status === 404) {
            state.cliente.id = null;
            state.cliente.existente = false;
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

function capturarEndereco() {
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

function montarEnderecoString() {
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
    if (step === 6) preencherRevisao();
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
        const obrig = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'];
        for (const id of obrig) {
            const el = document.getElementById(id);
            if (!el.value.trim()) {
                showToast('Preencha todos os campos de endereço obrigatórios.', 'error');
                el.focus();
                return false;
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
    const { subtotal, desconto, taxaEntrega, total } = getResumo();

    document.getElementById('reviewCliente').innerHTML = `
        <p><strong>${state.cliente.nome}</strong></p>
        <p>CPF: ${formatCpf(state.cliente.cpf)}</p>
        <p>Telefone: ${state.cliente.telefone || '—'}</p>
        <p>E-mail: ${state.cliente.email || '—'}</p>
        ${state.cliente.existente ? '<p style="color:var(--success);font-weight:700">✓ Cliente já cadastrado</p>' : '<p style="color:var(--warning);font-weight:700">⚠ Novo cadastro</p>'}
    `;

    const end = state.endereco;
    document.getElementById('reviewEndereco').innerHTML = `
        <p>${end.logradouro}, nº ${end.numero}</p>
        <p>${end.bairro} — ${end.cidade}/${end.uf}</p>
        <p>CEP: ${end.cep}</p>
        ${end.complemento ? `<p>${end.complemento}</p>` : ''}
        ${end.referencia ? `<p>Ref: ${end.referencia}</p>` : ''}
    `;

    document.getElementById('reviewItens').innerHTML = state.carrinho.map(i =>
        `<p>${i.quantidade}× ${i.nome} — ${formatCurrency(i.quantidade * i.preco)}</p>`
    ).join('');

    const nomePag = FORMAS_PAGAMENTO[state.formaPagamento] || '—';
    document.getElementById('reviewPagamento').innerHTML = `<p>${nomePag}</p>`;

    let valoresHtml = `<p>Subtotal: ${formatCurrency(subtotal)}</p>`;
    if (desconto > 0)
        valoresHtml += `<p>Cupom (${state.cupom.codigo}): -${formatCurrency(desconto)}</p>`;
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
        taxaEntrega: TAXA_ENTREGA_FIXA,
        trocoPara: state.formaPagamento === 1 ? state.trocoPara : 0,
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

            // Se for PIX, mostrar overlay de pagamento
            if (state.formaPagamento === 2 && data?.pedidoId && data?.valorTotal) {
                showToast(`Pedido ${num} criado! Complete o pagamento via Pix.`, 'success');
                exibirOverlayPix(data.pedidoId, num, data.valorTotal);
                return;
            }

            showToast(`Pedido ${num} criado com sucesso!`, 'success');
            setTimeout(() => window.location.reload(), 1500);
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
   OVERLAY PIX — Pagamento pós-pedido
   =================================================================== */

let pixOverlayPedidoId = null;
let pixOverlayValor = 0;

function exibirOverlayPix(pedidoId, numeroPedido, valorTotal) {
    pixOverlayPedidoId = pedidoId;
    pixOverlayValor = valorTotal;

    const overlay = document.getElementById('pixOverlay');
    const container = document.getElementById('pixOverlayQrContainer');
    const copiaCola = document.getElementById('pixOverlayCopiaCola');

    document.getElementById('pixOverlayPedido').textContent = `Pedido ${numeroPedido}`;
    document.getElementById('pixOverlayAmount').textContent = formatCurrency(valorTotal);

    // Gerar payload PIX
    const payload = gerarPixPayload(valorTotal);
    copiaCola.value = payload;

    // Gerar QR Code
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

    // Resetar estado visual
    document.getElementById('pixResultado').classList.add('hidden');
    document.querySelector('.pix-overlay-timer').style.display = '';
    document.querySelector('.pix-overlay-actions').style.display = '';
    document.querySelector('.pix-overlay-qr').style.display = '';
    document.querySelector('.pix-overlay-copiacola').style.display = '';
    document.getElementById('pixOverlayCopyStatus').style.display = 'none';
    document.getElementById('btnConfirmarPix').disabled = false;
    document.getElementById('btnConfirmarPix').textContent = '✅ Já paguei';

    overlay.classList.add('visible');
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
            // Esconder elementos de pagamento e mostrar resultado
            document.querySelector('.pix-overlay-timer').style.display = 'none';
            document.querySelector('.pix-overlay-actions').style.display = 'none';
            document.querySelector('.pix-overlay-qr').style.display = 'none';
            document.querySelector('.pix-overlay-copiacola').style.display = 'none';

            document.getElementById('pixResultado').classList.remove('hidden');
            showToast('Pagamento Pix confirmado!', 'success');

            setTimeout(() => window.location.reload(), 3000);
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
    document.getElementById('pixOverlay').classList.remove('visible');
    showToast('Você poderá pagar depois. O pedido foi criado com pagamento pendente.', 'success');
    setTimeout(() => window.location.reload(), 2000);
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

    document.getElementById('cpf').value = formatCpf(state.cliente.cpf);
    document.getElementById('nomeCliente').value = state.cliente.nome;
    document.getElementById('telefoneCliente').value = state.cliente.telefone;
    document.getElementById('emailCliente').value = state.cliente.email;
    document.getElementById('clienteId').value = state.cliente.id || '';

    statusCliente.className = 'status-box success';
    statusCliente.textContent = `Cliente localizado: ${state.cliente.nome} (ID ${state.cliente.id}).`;
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
    });
});

document.getElementById('trocoPara').addEventListener('input', atualizarTrocoInfo);

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
renderCarrinho();
irParaEtapa(1);

/* ===================================================================
   STATUS DA LOJA (ONLINE / OFFLINE)
   =================================================================== */

const STORE_STATUS_INTERVAL = 15000; // 15 segundos
let storeOnline = null;

async function verificarStatusLoja() {
    const badge = document.getElementById('storeStatus');
    const overlay = document.getElementById('offlineOverlay');
    const text = badge.querySelector('.status-text');

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`${API_BASE}/api/status`, { signal: ctrl.signal });
        clearTimeout(timer);

        if (resp.ok) {
            if (storeOnline !== true) {
                badge.className = 'store-status online';
                text.textContent = 'Loja Online';
                overlay.classList.remove('visible');
                storeOnline = true;
                // recarrega produtos caso tenha ficado offline
                carregarProdutos();
            }
            return;
        }
        throw new Error();
    } catch {
        if (storeOnline !== false) {
            badge.className = 'store-status offline';
            text.textContent = 'Loja Offline';
            overlay.classList.add('visible');
            storeOnline = false;
        }
    }
}

verificarStatusLoja();
setInterval(verificarStatusLoja, STORE_STATUS_INTERVAL);

window.alterarQuantidade = alterarQuantidade;
window.removerDoCarrinho = removerDoCarrinho;