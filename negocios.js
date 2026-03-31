/* ===================================================================
   NEGÓCIOS — JS Compartilhado
   Usado por: negocios, planos, contato, entrar
   =================================================================== */

/* ── Billing Toggle (planos, negocios) ── */
let anual = false;

function toggleBilling() {
    anual = !anual;
    document.getElementById('billingSwitch').classList.toggle('active', anual);
    document.getElementById('lblMensal').classList.toggle('active', !anual);
    document.getElementById('lblAnual').classList.toggle('active', anual);

    document.querySelectorAll('.plan-price[data-monthly]').forEach(el => {
        const val = anual ? Number(el.dataset.yearly) : Number(el.dataset.monthly);
        const reais = Math.floor(val / 100);
        const centavos = String(val % 100).padStart(2, '0');
        el.innerHTML = `<span class="plan-currency">R$</span>${reais}<span class="plan-cents">,${centavos}</span>`;
    });

    document.querySelectorAll('.plan-period').forEach(el => {
        if (el.textContent.includes('mês') || el.textContent.includes('ano')) {
            el.textContent = anual ? '/mês (cobrado anualmente)' : '/mês';
        }
    });
}

/* ── Contato Form ── */
function enviarContato(e) {
    e.preventDefault();

    const nome = document.getElementById('contatoNome').value.trim();
    const email = document.getElementById('contatoEmail').value.trim();
    const telefone = document.getElementById('contatoTelefone').value.trim();
    const assunto = document.getElementById('contatoAssunto').value;
    const mensagem = document.getElementById('contatoMensagem').value.trim();

    const assuntos = {
        demo: 'Quero uma demonstração',
        planos: 'Dúvida sobre planos',
        parceria: 'Proposta de parceria',
        suporte: 'Suporte técnico',
        outro: 'Outro assunto'
    };

    const texto = `Olá! Sou ${nome}.%0A%0A` +
        `📧 E-mail: ${email}%0A` +
        (telefone ? `📱 Telefone: ${telefone}%0A` : '') +
        `📋 Assunto: ${assuntos[assunto] || assunto}%0A%0A` +
        `💬 Mensagem:%0A${encodeURIComponent(mensagem)}`;

    window.open(`https://wa.me/5527995045666?text=${texto}`, '_blank');

    document.getElementById('contactFormContent').style.display = 'none';
    document.getElementById('contactSuccess').classList.add('show');
}

/* ── Login Admin ── */
function fazerLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;

    if (!email || !senha) return;

    const btn = document.getElementById('btnEntrarAdmin');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Entrando...';
    btn.disabled = true;

    setTimeout(() => {
        alert('⚠️ O painel de gestão está em desenvolvimento. Entre em contato pelo WhatsApp para acessar seu painel.');
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }, 1500);
}

/* ===================================================================
   ENTRAR — Seletor de Perfil (Cliente / Admin)
   =================================================================== */

const CPF_STORAGE_KEY = 'devmiranda_cpf_salvo';
const API_BASE_LOGIN = 'https://api.pedidocerto.uk';

/* ── Trocar entre Cliente e Admin ── */
function trocarPerfil(role) {
    document.querySelectorAll('.role-tab').forEach(t => t.classList.toggle('active', t.dataset.role === role));
    document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.login-branding-panel').forEach(p => p.classList.remove('active'));

    if (role === 'cliente') {
        const el = document.getElementById('panelCliente');
        if (el) el.classList.add('active');
        const br = document.getElementById('brandingCliente');
        if (br) br.classList.add('active');
    } else {
        const el = document.getElementById('panelAdmin');
        if (el) el.classList.add('active');
        const br = document.getElementById('brandingAdmin');
        if (br) br.classList.add('active');
    }
}

/* ── Formatação CPF ── */
function formatarCPF(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return nums.slice(0, 3) + '.' + nums.slice(3);
    if (nums.length <= 9) return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6);
    return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6, 9) + '-' + nums.slice(9);
}

function mascaraCPF(cpf) {
    const n = cpf.replace(/\D/g, '');
    if (n.length < 6) return cpf;
    return n.slice(0, 3) + '.***.' + n.slice(6, 9) + '-' + n.slice(9);
}

/* ── Entrar como Cliente (CPF) ── */
function entrarCliente(e) {
    e.preventDefault();

    const input = document.getElementById('clienteCpf');
    const cpf = input ? input.value.replace(/\D/g, '') : '';

    if (cpf.length !== 11) {
        if (input) { input.style.borderColor = '#ef4444'; input.focus(); }
        return;
    }

    const btn = document.getElementById('btnEntrarCliente');
    if (btn) {
        btn.querySelector('span').textContent = 'Verificando...';
        btn.disabled = true;
    }

    if (document.getElementById('clienteLembrar') && document.getElementById('clienteLembrar').checked) {
        localStorage.setItem(CPF_STORAGE_KEY, cpf);
    } else {
        localStorage.removeItem(CPF_STORAGE_KEY);
    }

    sessionStorage.setItem('cpf_ativo', cpf);
    window.location.href = 'pedido.html';
}

/* ── Trocar CPF ── */
function trocarCpfCliente() {
    localStorage.removeItem(CPF_STORAGE_KEY);
    sessionStorage.removeItem('cpf_ativo');

    const welcome = document.getElementById('clienteWelcomeBack');
    const cpfGroup = document.getElementById('cpfInputGroup');
    const trocarArea = document.getElementById('clienteTrocarArea');
    const cpfInput = document.getElementById('clienteCpf');

    if (welcome) welcome.classList.add('hidden');
    if (cpfGroup) cpfGroup.classList.remove('hidden');
    if (trocarArea) trocarArea.classList.add('hidden');
    if (cpfInput) { cpfInput.value = ''; cpfInput.focus(); }
}

/* ── Init: verifica CPF salvo ao carregar ── */
document.addEventListener('DOMContentLoaded', () => {
    const cpfInput = document.getElementById('clienteCpf');
    if (!cpfInput) return;

    cpfInput.addEventListener('input', () => {
        cpfInput.value = formatarCPF(cpfInput.value);
        cpfInput.style.borderColor = '';
    });

    const salvo = localStorage.getItem(CPF_STORAGE_KEY);
    if (salvo && salvo.length === 11) {
        cpfInput.value = formatarCPF(salvo);

        fetch(`${API_BASE_LOGIN}/api/clientes/documento/${salvo}`)
            .then(r => r.ok ? r.json() : null)
            .then(cliente => {
                if (cliente && cliente.nome) {
                    const welcome = document.getElementById('clienteWelcomeBack');
                    const nomeEl = document.getElementById('clienteWelcomeNome');
                    const cpfEl = document.getElementById('clienteWelcomeCpf');
                    const cpfGroup = document.getElementById('cpfInputGroup');
                    const trocarArea = document.getElementById('clienteTrocarArea');

                    if (nomeEl) nomeEl.textContent = `Olá, ${cliente.nome}! 👋`;
                    if (cpfEl) cpfEl.textContent = `CPF: ${mascaraCPF(salvo)}`;
                    if (welcome) welcome.classList.remove('hidden');
                    if (cpfGroup) cpfGroup.classList.add('hidden');
                    if (trocarArea) trocarArea.classList.remove('hidden');
                }
            })
            .catch(() => {});
    }
});