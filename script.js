// Detecta o IP/domínio do servidor automaticamente (mesmo host da página)
//const API_BASE = window.location.origin;
const API_BASE = 'https://minha-api-pedidos.onrender.com';
//const API_BASE = 'http://100.104.17.8:5000/';

function atualizarNumeracaoItens() {
    const rows = document.querySelectorAll('.item-row');
    rows.forEach((row, index) => {
        const badge = row.querySelector('.item-index');
        if (badge) badge.textContent = '#' + (index + 1);
    });

    const totalItens = rows.length;
    document.getElementById('contadorItensBadge').textContent = totalItens + (totalItens === 1 ? ' item' : ' itens');
    document.getElementById('resumoItens').textContent = totalItens;
}

function atualizarResumo() {
    const rows = document.querySelectorAll('.item-row');
    let quantidadeTotal = 0;

    rows.forEach(row => {
        const qtd = parseInt(row.querySelector('.quantidade').value) || 0;
        quantidadeTotal += qtd;
    });

    const descontoInput = document.getElementById('desconto');
    const desconto = descontoInput ? (parseFloat(descontoInput.value) || 0) : 0;

    document.getElementById('resumoQuantidade').textContent = quantidadeTotal;
    document.getElementById('resumoDesconto').textContent = 'R$ ' + desconto.toFixed(2);
    atualizarNumeracaoItens();
}

function adicionarItem() {
    const container = document.getElementById('itensContainer');
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <div class="form-group">
            <span class="item-index">#${container.children.length + 1}</span>
            <label>Cód. Produto</label>
            <input type="number" class="produto-id" min="1" required inputmode="numeric" placeholder="Ex.: 250">
        </div>
        <div class="form-group">
            <label>Qtd.</label>
            <input type="number" class="quantidade" min="1" value="1" required inputmode="numeric" placeholder="1">
        </div>
        <button type="button" class="btn-remove" onclick="removerItem(this)" title="Remover item">✕</button>
    `;
    container.appendChild(row);
    row.querySelector('.produto-id').focus();
    atualizarResumo();
}

function removerItem(btn) {
    const container = document.getElementById('itensContainer');
    if (container.children.length > 1) {
        btn.closest('.item-row').remove();
        atualizarResumo();
    } else {
        showToast('O pedido precisa ter pelo menos 1 item.', 'error');
    }
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 4000);
}

document.addEventListener('input', (e) => {
    if (
        e.target.classList.contains('quantidade') ||
        e.target.classList.contains('produto-id') ||
        e.target.id === 'desconto'
    ) {
        atualizarResumo();
    }
});

document.getElementById('formPedido').addEventListener('submit', async (e) => {
    e.preventDefault();

    const clienteInput = document.getElementById('clienteId');
    const usuarioInput = document.getElementById('usuarioId');
    const descontoInput = document.getElementById('desconto');
    const observacaoInput = document.getElementById('observacao');

    if (!clienteInput || !usuarioInput || !descontoInput || !observacaoInput) {
        showToast('Campos principais do pedido não foram carregados no HTML.', 'error');
        return;
    }

    const clienteId = parseInt(clienteInput.value);
    const usuarioId = parseInt(usuarioInput.value);

    if (!clienteId || clienteId <= 0) {
        showToast('Informe um cliente válido.', 'error');
        clienteInput.focus();
        return;
    }

    if (!usuarioId || usuarioId <= 0) {
        showToast('Informe um usuário válido.', 'error');
        usuarioInput.focus();
        return;
    }

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Enviando...';

    const itens = [];
    const rows = document.querySelectorAll('.item-row');

    for (const row of rows) {
        const produtoId = parseInt(row.querySelector('.produto-id').value);
        const quantidade = parseInt(row.querySelector('.quantidade').value);

        if (!produtoId || produtoId <= 0 || !quantidade || quantidade <= 0) {
            showToast('Preencha todos os itens corretamente.', 'error');
            btn.disabled = false;
            btn.textContent = 'Enviar Pedido';
            return;
        }

        itens.push({ produtoId, quantidade });
    }

    const pedido = {
        clienteId: clienteId,
        usuarioId: usuarioId,
        desconto: parseFloat(descontoInput.value) || 0,
        observacao: observacaoInput.value,
        itens: itens
    };

    try {
        const resp = await fetch(API_BASE + '/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido)
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok && data) {
            let msg = '✅ Pedido #' + data.pedidoId + ' criado!';
            if (data.valorTotal != null) {
                msg += ' Total: R$ ' + data.valorTotal.toFixed(2);
            }

            showToast(msg, 'success');
            document.getElementById('formPedido').reset();

            const container = document.getElementById('itensContainer');
            while (container.children.length > 1) {
                container.removeChild(container.lastChild);
            }

            container.querySelector('.quantidade').value = '1';
            atualizarResumo();
        } else {
            const errorMsg = (typeof data === 'string' ? data : null)
                || (data && data.mensagem)
                || await resp.text().catch(() => '')
                || 'Erro ao criar pedido.';

            showToast('❌ ' + errorMsg, 'error');
        }
    } catch (err) {
        showToast('❌ Sem conexão com o servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Pedido';
    }
});