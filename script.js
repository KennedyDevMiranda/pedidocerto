const API_BASE = 'https://api.pedidocerto.uk';

const ENDPOINTS = {
    criarPedido: `${API_BASE}/api/pedidos`,
    buscarClientePorCpf: (cpf) => `${API_BASE}/api/clientes/cpf/${cpf}`
};

const API_BASE = 'https://api.pedidocerto.uk';

const ENDPOINTS = {
    criarPedido: `${API_BASE}/api/pedidos`,
    buscarClientePorCpf: (cpf) => `${API_BASE}/api/clientes/cpf/${cpf}`,
    listarProdutos: (busca = '') => {
        const query = busca ? `?busca=${encodeURIComponent(busca)}` : '';
        return `${API_BASE}/api/produtos${query}`;
    }
};

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
    pagamento: '',
    observacao: ''
};

const state = {
    step: 1,
    produtos: produtosMock,
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
    pagamento: '',
    observacao: ''
};

const steps = Array.from(document.querySelectorAll('.step-card'));
const progressSteps = Array.from(document.querySelectorAll('.progress-step'));
const listaProdutos = document.getElementById('listaProdutos');
const produtoBusca = document.getElementById('produtoBusca');
const itensPedido = document.getElementById('itensPedido');
const carrinhoVazio = document.getElementById('carrinhoVazio');
const statusCliente = document.getElementById('statusCliente');

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
    const digits = onlyDigits(value).slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCpf(cpf) {
    const clean = onlyDigits(cpf);
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i)) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(clean.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(clean.charAt(10));
}

function renderProdutos(filter = '') {
    const termo = filter.trim().toLowerCase();
    const filtrados = state.produtos.filter(p =>
        p.nome.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo)
    );

    if (!filtrados.length) {
        listaProdutos.innerHTML = `<div class="empty-state">Nenhum produto encontrado.</div>`;
        return;
    }

    listaProdutos.innerHTML = filtrados.map(produto => `
        <button type="button" class="product-card" data-produto-id="${produto.id}">
            <div>
                <h3>${produto.nome}</h3>
                <p>${produto.descricao}</p>
            </div>
            <div class="product-price">${formatCurrency(produto.preco)}</div>
        </button>
    `).join('');
}

function adicionarAoCarrinho(produtoId) {
    const produto = state.produtos.find(p => p.id === produtoId);
    if (!produto) return;

    const itemExistente = state.carrinho.find(i => i.produtoId === produtoId);
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        state.carrinho.push({
            produtoId: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: 1
        });
    }

    renderCarrinho();
    showToast(`${produto.nome} adicionado ao pedido.`, 'success');
}

function alterarQuantidade(produtoId, delta) {
    const item = state.carrinho.find(i => i.produtoId === produtoId);
    if (!item) return;

    item.quantidade += delta;
    if (item.quantidade <= 0) {
        state.carrinho = state.carrinho.filter(i => i.produtoId !== produtoId);
    }
    renderCarrinho();
}

function removerDoCarrinho(produtoId) {
    state.carrinho = state.carrinho.filter(i => i.produtoId !== produtoId);
    renderCarrinho();
}

function getResumo() {
    const itens = state.carrinho.length;
    const quantidade = state.carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const total = state.carrinho.reduce((acc, item) => acc + (item.quantidade * item.preco), 0);
    return { itens, quantidade, total };
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
                <button type="button" class="qty-btn" onclick="alterarQuantidade(${item.produtoId}, -1)">-</button>
                <strong>${item.quantidade}</strong>
                <button type="button" class="qty-btn" onclick="alterarQuantidade(${item.produtoId}, 1)">+</button>
            </div>
            <strong>${formatCurrency(item.quantidade * item.preco)}</strong>
            <button type="button" class="icon-btn" onclick="removerDoCarrinho(${item.produtoId})">✕</button>
        </div>
    `).join('');
}

function irParaEtapa(step) {
    state.step = step;

    steps.forEach(card => {
        card.classList.toggle('active', Number(card.dataset.step) === step);
    });

    progressSteps.forEach(item => {
        const current = Number(item.dataset.step);
        item.classList.toggle('active', current === step);
        item.classList.toggle('done', current < step);
    });

    if (step === 6) preencherRevisao();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validarEtapaAtual() {
    if (state.step === 1) {
        if (!state.carrinho.length) {
            showToast('Adicione pelo menos 1 produto antes de continuar.', 'error');
            return false;
        }
    }

    if (state.step === 2) {
        if (!state.carrinho.length) {
            showToast('Seu carrinho está vazio.', 'error');
            return false;
        }
    }

    if (state.step === 3) {
        const camposObrigatorios = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'];
        for (const id of camposObrigatorios) {
            const el = document.getElementById(id);
            if (!el.value.trim()) {
                showToast('Preencha os dados de endereço antes de continuar.', 'error');
                el.focus();
                return false;
            }
        }
        capturarEndereco();
    }

    if (state.step === 4) {
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

    if (state.step === 5) {
        if (!state.pagamento) {
            showToast('Selecione a forma de pagamento.', 'error');
            return false;
        }
    }

    return true;
}

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

function capturarCliente() {
    state.cliente.cpf = onlyDigits(document.getElementById('cpf').value);
    state.cliente.nome = document.getElementById('nomeCliente').value.trim();
    state.cliente.telefone = document.getElementById('telefoneCliente').value.trim();
    state.cliente.email = document.getElementById('emailCliente').value.trim();

    document.getElementById('clienteId').value = state.cliente.id || '';
}

function preencherRevisao() {
    const { total } = getResumo();

    document.getElementById('reviewCliente').innerHTML = `
        <p><strong>${state.cliente.nome}</strong></p>
        <p>CPF: ${formatCpf(state.cliente.cpf)}</p>
        <p>Telefone: ${state.cliente.telefone || '-'}</p>
        <p>E-mail: ${state.cliente.email || '-'}</p>
    `;

    document.getElementById('reviewEndereco').innerHTML = `
        <p>${state.endereco.logradouro}, ${state.endereco.numero}</p>
        <p>${state.endereco.bairro} - ${state.endereco.cidade}/${state.endereco.uf}</p>
        <p>CEP: ${state.endereco.cep}</p>
        <p>${state.endereco.complemento || ''}</p>
        <p>${state.endereco.referencia || ''}</p>
    `;

    document.getElementById('reviewItens').innerHTML = state.carrinho.map(item => `
        <p>${item.quantidade}x ${item.nome} - ${formatCurrency(item.quantidade * item.preco)}</p>
    `).join('');

    document.getElementById('reviewPagamento').innerHTML = `<p>${state.pagamento}</p>`;
    document.getElementById('reviewTotal').innerHTML = `<p><strong>${formatCurrency(total)}</strong></p>`;
}

async function consultarCpf() {
    const cpfInput = document.getElementById('cpf');
    const cpf = onlyDigits(cpfInput.value);

    if (!validarCpf(cpf)) {
        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'CPF inválido. Confira e tente novamente.';
        return;
    }

    statusCliente.className = 'status-box';
    statusCliente.textContent = 'Consultando cadastro...';

    try {
        const resp = await fetch(ENDPOINTS.buscarClientePorCpf(cpf));

        if (resp.ok) {
            const cliente = await resp.json();
            state.cliente.id = cliente.id || cliente.clienteId || null;
            state.cliente.existente = true;

            document.getElementById('nomeCliente').value = cliente.nome || '';
            document.getElementById('telefoneCliente').value = cliente.telefone || cliente.celular || '';
            document.getElementById('emailCliente').value = cliente.email || '';
            document.getElementById('clienteId').value = state.cliente.id || '';

            statusCliente.className = 'status-box success';
            statusCliente.textContent = 'Cliente já cadastrado. Dados carregados automaticamente.';
            showToast('Cliente localizado pelo CPF.', 'success');
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
            statusCliente.textContent = 'CPF não encontrado. Continue preenchendo para cadastrar um novo cliente.';
            showToast('CPF não encontrado. Novo cadastro será criado.', 'success');
            return;
        }

        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'Não foi possível validar o CPF agora.';
    } catch {
        statusCliente.className = 'status-box warning';
        statusCliente.textContent = 'Erro de comunicação ao consultar o CPF.';
    }
}

function montarPayload() {
    const { total } = getResumo();

    return {
        clienteId: state.cliente.id,
        usuarioId: parseInt(document.getElementById('usuarioId').value) || 1,
        desconto: parseFloat(document.getElementById('desconto').value) || 0,
        observacao: state.observacao,
        cpf: state.cliente.cpf,
        cliente: {
            nome: state.cliente.nome,
            email: state.cliente.email,
            telefone: state.cliente.telefone
        },
        enderecoEntrega: {
            cep: state.endereco.cep,
            logradouro: state.endereco.logradouro,
            numero: state.endereco.numero,
            bairro: state.endereco.bairro,
            cidade: state.endereco.cidade,
            uf: state.endereco.uf,
            complemento: state.endereco.complemento,
            referencia: state.endereco.referencia
        },
        formaPagamento: state.pagamento,
        valorTotal: total,
        itens: state.carrinho.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade
        }))
    };
}

async function enviarPedido(e) {
    e.preventDefault();

    if (state.step !== 6) return;

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Enviando...';

    try {
        const payload = montarPayload();

        const resp = await fetch(ENDPOINTS.criarPedido, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok) {
            showToast(`Pedido enviado com sucesso${data?.pedidoId ? ` #${data.pedidoId}` : ''}.`, 'success');
            setTimeout(() => window.location.reload(), 1200);
            return;
        }

        const errorMsg = data?.mensagem || data?.message || 'Erro ao criar pedido.';
        showToast(errorMsg, 'error');
    } catch {
        showToast('Sem conexão com o servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Pedido';
    }
}

produtoBusca.addEventListener('input', (e) => renderProdutos(e.target.value));

document.getElementById('listaProdutos').addEventListener('click', (e) => {
    const card = e.target.closest('[data-produto-id]');
    if (!card) return;
    adicionarAoCarrinho(Number(card.dataset.produtoId));
});

document.getElementById('btnIrCarrinho').addEventListener('click', () => {
    if (!state.carrinho.length) {
        showToast('Selecione pelo menos um produto.', 'error');
        return;
    }
    irParaEtapa(2);
});

document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!validarEtapaAtual()) return;
        irParaEtapa(state.step + 1);
    });
});

document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => irParaEtapa(state.step - 1));
});

document.getElementById('cpf').addEventListener('input', (e) => {
    e.target.value = formatCpf(e.target.value);
});

document.getElementById('cep').addEventListener('input', (e) => {
    const digits = onlyDigits(e.target.value).slice(0, 8);
    e.target.value = digits.replace(/(\d{5})(\d)/, '$1-$2');
});

document.getElementById('btnConsultarCpf').addEventListener('click', consultarCpf);

document.querySelectorAll('.payment-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.payment-option').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        state.pagamento = btn.dataset.value;
        document.getElementById('formaPagamento').value = state.pagamento;
    });
});

document.getElementById('formPedido').addEventListener('submit', enviarPedido);

renderProdutos();
renderCarrinho();
irParaEtapa(1);

window.alterarQuantidade = alterarQuantidade;
window.removerDoCarrinho = removerDoCarrinho;