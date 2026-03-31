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

/* ── Login ── */
function fazerLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;

    if (!email || !senha) return;

    const btn = e.target.querySelector('.login-btn');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Entrando...';
    btn.disabled = true;

    setTimeout(() => {
        alert('⚠️ O painel de gestão está em desenvolvimento. Entre em contato pelo WhatsApp para acessar seu painel.');
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }, 1500);
}