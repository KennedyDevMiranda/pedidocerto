/* ===================================================================
   DevMiranda – Feedback & Fidelidade – Script
   API: /api/feedbacks, /api/fidelidade, /api/clientes
   =================================================================== */

const API_BASE = 'https://api.pedidocerto.uk';

const ENDPOINTS = {
    buscarClientePorDocumento: (doc) =>
        `${API_BASE}/api/clientes/documento/${encodeURIComponent(doc)}`,
    feedbacks: `${API_BASE}/api/feedbacks`,
    feedbacksPaginado: (pagina, tam) =>
        `${API_BASE}/api/feedbacks?pagina=${pagina}&tamanhoPagina=${tam}`,
    fidelidade: (clienteId) =>
        `${API_BASE}/api/fidelidade/${clienteId}`
};

/* ──────────── Estado global ──────────── */

const state = {
    cliente: { id: null, nome: '', documento: '' },
    fidelidade: null,
    muralPagina: 1,
    muralTamanho: 10,
    muralTotal: 0,
    feedbackNota: 5,
    feedbackTipo: 2
};

const STORAGE_KEY = 'devmiranda_fb_cpf';

/* ──────────── DOM refs ──────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ──────────── Init ──────────── */

document.addEventListener('DOMContentLoaded', () => {
    initIdentificacao();
    initTabs();
    initStarRating();
    initTipoToggle();
    initFeedbackForm();
    initCharCount();

    // Auto-login se CPF salvo
    const cpfSalvo = localStorage.getItem(STORAGE_KEY);
    if (cpfSalvo) {
        $('#cpfInput').value = cpfSalvo;
        identificarCliente(cpfSalvo);
    }
});

/* ──────────── CPF Mask ──────────── */

function maskCPF(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    return v;
}

/* ──────────── Identificação ──────────── */

function initIdentificacao() {
    const input = $('#cpfInput');
    const btn = $('#btnIdentificar');
    const btnSair = $('#btnSair');

    input.addEventListener('input', () => {
        input.value = maskCPF(input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
    });

    btn.addEventListener('click', () => {
        const cpf = input.value.replace(/\D/g, '');
        if (cpf.length < 11) {
            showToast('Informe um CPF válido.', 'error');
            return;
        }
        identificarCliente(cpf);
    });

    btnSair.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        state.cliente = { id: null, nome: '', documento: '' };
        state.fidelidade = null;
        $('#telaIdentificacao').classList.remove('hidden');
        $('#painelCliente').classList.add('hidden');
        $('#cpfInput').value = '';
    });
}

async function identificarCliente(cpf) {
    try {
        const res = await fetch(ENDPOINTS.buscarClientePorDocumento(cpf));
        if (!res.ok) {
            showToast('Cliente não encontrado. Verifique o CPF.', 'error');
            return;
        }
        const data = await res.json();
        state.cliente = { id: data.id, nome: data.nome, documento: data.documento };

        localStorage.setItem(STORAGE_KEY, cpf);

        $('#clienteNome').textContent = data.nome || 'Cliente';
        $('#telaIdentificacao').classList.add('hidden');
        $('#painelCliente').classList.remove('hidden');

        carregarFidelidade();
        carregarMural();
    } catch (err) {
        showToast('Erro ao identificar cliente.', 'error');
        console.error(err);
    }
}

/* ──────────── Tabs ──────────── */

function initTabs() {
    $$('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            $$('.tab').forEach(t => t.classList.remove('active'));
            $$('.tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            const content = document.querySelector(`.tab-content[data-tab="${target}"]`);
            if (content) content.classList.add('active');
        });
    });
}

/* ──────────── Star Rating ──────────── */

function initStarRating() {
    $$('#starRating .star').forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.dataset.star);
            state.feedbackNota = val;
            $('#feedbackNota').value = val;
            $$('#starRating .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.star) <= val);
            });
        });
    });
}

/* ──────────── Tipo Toggle ──────────── */

function initTipoToggle() {
    $$('.tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.tipo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.feedbackTipo = parseInt(btn.dataset.tipo);

            const campoPedido = $('#campoPedidoId');
            if (state.feedbackTipo === 1) {
                campoPedido.classList.remove('hidden');
            } else {
                campoPedido.classList.add('hidden');
                $('#feedbackPedidoId').value = '';
            }
        });
    });
}

/* ──────────── Char Count ──────────── */

function initCharCount() {
    const textarea = $('#feedbackComentario');
    const counter = $('#charCount');
    textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
    });
}

/* ──────────── Feedback Form Submit ──────────── */

function initFeedbackForm() {
    $('#formFeedback').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state.cliente.id) {
            showToast('Identifique-se primeiro.', 'error');
            return;
        }

        const comentario = $('#feedbackComentario').value.trim();
        if (!comentario) {
            showToast('Escreva um comentário.', 'error');
            return;
        }

        const dto = {
            clienteId: state.cliente.id,
            pedidoId: state.feedbackTipo === 1 ? (parseInt($('#feedbackPedidoId').value) || null) : null,
            nota: state.feedbackNota,
            comentario: comentario,
            tipo: state.feedbackTipo,
            anonimo: $('#feedbackAnonimo').checked
        };

        const btn = $('#formFeedback').querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const res = await fetch(ENDPOINTS.feedbacks, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto)
            });

            const data = await res.json();

            if (res.ok && data.sucesso) {
                showToast(data.mensagem || 'Feedback enviado! +10 pontos 🎉', 'success');
                $('#formFeedback').reset();
                $('#charCount').textContent = '0';
                state.feedbackNota = 5;
                $$('#starRating .star').forEach(s => s.classList.add('active'));

                // Recarregar dados
                carregarFidelidade();
                carregarMural();

                // Mudar para aba Mural
                $$('.tab').forEach(t => t.classList.remove('active'));
                $$('.tab-content').forEach(tc => tc.classList.remove('active'));
                document.querySelector('.tab[data-tab="mural"]').classList.add('active');
                document.querySelector('.tab-content[data-tab="mural"]').classList.add('active');
            } else {
                showToast(data.mensagem || 'Erro ao enviar feedback.', 'error');
            }
        } catch (err) {
            showToast('Erro de conexão.', 'error');
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.textContent = '📤 Enviar Feedback (+10 pts)';
        }
    });
}

/* ──────────── Carregar Fidelidade ──────────── */

async function carregarFidelidade() {
    if (!state.cliente.id) return;

    try {
        const res = await fetch(ENDPOINTS.fidelidade(state.cliente.id));
        if (!res.ok) return;

        const data = await res.json();
        state.fidelidade = data;

        // Atualizar pontos no badge
        $('#clientePontos').textContent = `${data.totalPontos} pts`;

        // Stats
        $('#statPontos').textContent = data.totalPontos.toLocaleString('pt-BR');
        $('#statCashback').textContent = `R$ ${data.cashback.toFixed(2).replace('.', ',')}`;
        $('#statPedidos').textContent = data.totalPedidos;

        // Sequência
        renderSequencia(data.sequencia);

        // Histórico
        renderHistoricoPontos(data.historicoPontos);

    } catch (err) {
        console.error('Erro ao carregar fidelidade:', err);
    }
}

function renderSequencia(seq) {
    const fill = $('#sequenciaFill');
    const dias = $('#sequenciaDias');
    const info = $('#sequenciaInfo');

    const pct = Math.min(100, (seq.atual / seq.meta) * 100);
    fill.style.width = pct + '%';

    // Dias markers
    let html = '';
    for (let i = 1; i <= seq.meta; i++) {
        let cls = '';
        if (i <= seq.atual) cls = 'done';
        if (i === seq.atual) cls = 'current';
        html += `<span class="${cls}">${i}</span>`;
    }
    dias.innerHTML = html;

    // Info text
    if (seq.atual >= seq.meta) {
        info.innerHTML = '🎉 <strong>Parabéns!</strong> Você completou a sequência e ganhou 10% de desconto!';
    } else if (seq.expirada) {
        info.innerHTML = '😢 Sua sequência expirou. Faça um novo pedido para recomeçar!';
    } else {
        info.innerHTML = `Faltam <strong>${seq.diasRestantes}</strong> pedido(s) para ganhar <strong>10% OFF</strong>!`;
    }
}

function renderHistoricoPontos(lista) {
    const container = $('#historicoPontos');
    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum ponto ainda. Faça pedidos e avaliações!</div>';
        return;
    }

    container.innerHTML = lista.map(item => {
        const positivo = item.pontos >= 0;
        const dataFormatada = formatarData(item.data);
        return `
            <div class="historico-item">
                <span class="hi-desc">${escapeHtml(item.descricao)}</span>
                <span class="hi-data">${dataFormatada}</span>
                <span class="hi-pontos ${positivo ? 'positivo' : 'negativo'}">
                    ${positivo ? '+' : ''}${item.pontos} pts
                </span>
            </div>`;
    }).join('');
}

/* ──────────── Carregar Mural ──────────── */

async function carregarMural(append = false) {
    try {
        const res = await fetch(ENDPOINTS.feedbacksPaginado(
            append ? state.muralPagina : 1,
            state.muralTamanho
        ));
        if (!res.ok) return;

        const data = await res.json();
        state.muralTotal = data.total;

        if (!append) state.muralPagina = 1;

        // Média
        $('#muralMedia').textContent = data.mediaGeral.toFixed(1);
        $('#muralTotal').textContent = data.total;

        // Lista
        const container = $('#muralLista');
        const html = data.feedbacks.map(fb => renderMuralCard(fb)).join('');

        if (append) {
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = data.feedbacks.length > 0 ? html
                : '<div class="empty-state">Nenhum feedback ainda. Seja o primeiro! ⭐</div>';
        }

        // Botão carregar mais
        const btnMais = $('#btnCarregarMais');
        const totalExibido = state.muralPagina * state.muralTamanho;
        if (totalExibido < state.muralTotal) {
            btnMais.classList.remove('hidden');
            btnMais.onclick = () => {
                state.muralPagina++;
                carregarMural(true);
            };
        } else {
            btnMais.classList.add('hidden');
        }

    } catch (err) {
        console.error('Erro ao carregar mural:', err);
    }
}

function renderMuralCard(fb) {
    const estrelas = '★'.repeat(fb.nota) + '☆'.repeat(5 - fb.nota);
    const badgeCls = fb.tipo === 1 ? 'pedido' : 'estabelecimento';
    const dataFormatada = formatarData(fb.dataCriacao);

    return `
        <div class="mural-card">
            <div class="mural-card-header">
                <span class="mural-card-nome">${fb.anonimo ? '🕶️ Anônimo' : escapeHtml(fb.nomeExibicao)}</span>
                <span class="mural-card-badge ${badgeCls}">${fb.tipoNome}</span>
            </div>
            <div class="mural-card-estrelas">${estrelas}</div>
            <div class="mural-card-comentario">${escapeHtml(fb.comentario)}</div>
            <div class="mural-card-data">${dataFormatada}${fb.pedidoId ? ` · Pedido #${fb.pedidoId}` : ''}</div>
        </div>`;
}

/* ──────────── Utilidades ──────────── */

function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ` ${type}` : '');
    setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatarData(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
}