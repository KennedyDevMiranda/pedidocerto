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

    // Password rules validation
    const newPassEl = document.getElementById('recoveryNewPass');
    const confirmPassEl = document.getElementById('recoveryConfirmPass');
    if (newPassEl && confirmPassEl) {
        const validate = () => {
            const ruleLength = document.getElementById('ruleLength');
            const ruleMatch = document.getElementById('ruleMatch');
            const pw = newPassEl.value;
            const confirm = confirmPassEl.value;

            if (ruleLength) {
                ruleLength.classList.toggle('valid', pw.length >= 6);
                ruleLength.querySelector('.rule-icon').textContent = pw.length >= 6 ? '✓' : '○';
            }
            if (ruleMatch) {
                const matches = pw.length > 0 && confirm.length > 0 && pw === confirm;
                ruleMatch.classList.toggle('valid', matches);
                ruleMatch.querySelector('.rule-icon').textContent = matches ? '✓' : '○';
            }
        };
        newPassEl.addEventListener('input', validate);
        confirmPassEl.addEventListener('input', validate);
    }
});

/* ===================================================================
   RECUPERAÇÃO DE SENHA — Fluxo de 3 etapas
   =================================================================== */

let recoveryLogin = '';
let recoveryCodeStored = '';
let countdownInterval = null;

/* ── Abrir painel de recuperação ── */
function abrirRecuperacao() {
    const loginView = document.getElementById('adminLoginView');
    const recoveryView = document.getElementById('adminRecoveryView');
    if (loginView) loginView.classList.add('hidden');
    if (recoveryView) recoveryView.classList.remove('hidden');
    irParaEtapa(1);

    const loginField = document.getElementById('loginEmail');
    const recoveryField = document.getElementById('recoveryLogin');
    if (loginField && recoveryField && loginField.value.trim()) {
        recoveryField.value = loginField.value.trim();
    }
}

/* ── Voltar ao login normal ── */
function voltarLogin() {
    const loginView = document.getElementById('adminLoginView');
    const recoveryView = document.getElementById('adminRecoveryView');
    if (loginView) loginView.classList.remove('hidden');
    if (recoveryView) recoveryView.classList.add('hidden');
    limparRecuperacao();
}

/* ── Navegação entre etapas ── */
function irParaEtapa(step) {
    document.querySelectorAll('.recovery-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.recovery-step-dot').forEach(dot => {
        const s = Number(dot.dataset.step);
        dot.classList.remove('active', 'done');
        if (s < step) dot.classList.add('done');
        if (s === step) dot.classList.add('active');
    });
    document.querySelectorAll('.recovery-step-line').forEach((line, i) => {
        line.classList.toggle('done', i < step - 1);
    });

    const target = step === 4 ? 'recoverySuccess'
        : step === 3 ? 'recoveryStep3'
        : step === 2 ? 'recoveryStep2'
        : 'recoveryStep1';

    const el = document.getElementById(target);
    if (el) el.classList.add('active');
}

/* ── Limpar estado ── */
function limparRecuperacao() {
    recoveryLogin = '';
    recoveryCodeStored = '';
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

    ['recoveryLogin', 'recoveryCode', 'recoveryNewPass', 'recoveryConfirmPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['recoveryError1', 'recoveryError2', 'recoveryError3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.textContent = ''; }
    });
    document.querySelectorAll('.password-rule').forEach(r => {
        r.classList.remove('valid');
        const icon = r.querySelector('.rule-icon');
        if (icon) icon.textContent = '○';
    });
}

/* ── Mostrar mensagem ── */
function mostrarMsg(id, texto, tipo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = texto;
    el.className = `recovery-msg ${tipo}`;
    el.classList.remove('hidden');
}

/* ── Etapa 1: Solicitar código ── */
async function solicitarCodigo(e) {
    if (e) e.preventDefault();

    const loginInput = document.getElementById('recoveryLogin');
    const login = loginInput ? loginInput.value.trim() : '';
    if (!login) return;

    recoveryLogin = login;

    const btn = document.getElementById('btnSolicitarCodigo');
    const spanEl = btn ? btn.querySelector('span') : null;
    const textoOriginal = spanEl ? spanEl.textContent : '';
    if (spanEl) spanEl.textContent = 'Enviando...';
    if (btn) btn.disabled = true;

    const errEl = document.getElementById('recoveryError1');
    if (errEl) errEl.classList.add('hidden');

    try {
        const resp = await fetch(`${API_BASE_LOGIN}/api/recuperar-senha/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login })
        });

        const data = await resp.json();

        if (!resp.ok || !data.sucesso) {
            mostrarMsg('recoveryError1', data.mensagem || 'Erro ao solicitar código.', 'error');
            return;
        }

        // Se o WhatsApp não estava configurado, mostra o código de teste
        if (data.codigoTeste) {
            recoveryCodeStored = data.codigoTeste;
        }

        // Vai para etapa 2
        irParaEtapa(2);

        const msg2 = document.getElementById('recoveryStep2Msg');
        if (msg2) {
            if (data.enviado && data.telefoneMascarado) {
                msg2.textContent = `Código de 6 dígitos enviado para o WhatsApp terminado em ${data.telefoneMascarado}.`;
            } else if (data.codigoTeste) {
                msg2.innerHTML = `Seu código de verificação é: <strong style="font-size:1.2rem;color:var(--accent)">${data.codigoTeste}</strong>`;
            } else {
                msg2.textContent = 'Solicite o código ao administrador via WhatsApp.';
            }
        }

        iniciarContagem();

    } catch {
        mostrarMsg('recoveryError1', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (spanEl) spanEl.textContent = textoOriginal;
        if (btn) btn.disabled = false;
    }
}

/* ── Reenviar código ── */
function reenviarCodigo() {
    solicitarCodigo(null);
}

/* ── Contagem regressiva de 10 min ── */
function iniciarContagem() {
    if (countdownInterval) clearInterval(countdownInterval);

    let segundos = 600;
    const countdownEl = document.getElementById('recoveryCountdown');
    const reenviarBtn = document.getElementById('btnReenviar');
    if (reenviarBtn) reenviarBtn.disabled = true;

    const update = () => {
        const min = Math.floor(segundos / 60);
        const sec = segundos % 60;
        if (countdownEl) countdownEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;

        if (segundos <= 0) {
            clearInterval(countdownInterval);
            if (countdownEl) countdownEl.textContent = 'Expirado';
            if (reenviarBtn) reenviarBtn.disabled = false;
        }
        segundos--;
    };

    update();
    countdownInterval = setInterval(update, 1000);

    // Habilita reenviar após 30s
    setTimeout(() => { if (reenviarBtn) reenviarBtn.disabled = false; }, 30000);
}

/* ── Etapa 2: Verificar código ── */
async function verificarCodigo(e) {
    if (e) e.preventDefault();

    const codeInput = document.getElementById('recoveryCode');
    const codigo = codeInput ? codeInput.value.trim() : '';
    if (codigo.length !== 6) {
        if (codeInput) { codeInput.style.borderColor = '#ef4444'; codeInput.focus(); }
        return;
    }

    const btn = document.getElementById('btnVerificarCodigo');
    const spanEl = btn ? btn.querySelector('span') : null;
    const textoOriginal = spanEl ? spanEl.textContent : '';
    if (spanEl) spanEl.textContent = 'Verificando...';
    if (btn) btn.disabled = true;

    const errEl = document.getElementById('recoveryError2');
    if (errEl) errEl.classList.add('hidden');

    try {
        const resp = await fetch(`${API_BASE_LOGIN}/api/recuperar-senha/verificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: recoveryLogin, codigo })
        });

        const data = await resp.json();

        if (!resp.ok || !data.sucesso) {
            mostrarMsg('recoveryError2', data.mensagem || 'Código inválido.', 'error');
            if (codeInput) { codeInput.value = ''; codeInput.focus(); }
            return;
        }

        recoveryCodeStored = codigo;
        irParaEtapa(3);

        // Mark all dots as done up to step 3
        document.querySelectorAll('.recovery-step-dot').forEach(dot => {
            const s = Number(dot.dataset.step);
            dot.classList.remove('active', 'done');
            if (s < 3) dot.classList.add('done');
            if (s === 3) dot.classList.add('active');
        });

    } catch {
        mostrarMsg('recoveryError2', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (spanEl) spanEl.textContent = textoOriginal;
        if (btn) btn.disabled = false;
    }
}

/* ── Etapa 3: Redefinir senha ── */
async function redefinirSenha(e) {
    if (e) e.preventDefault();

    const newPassEl = document.getElementById('recoveryNewPass');
    const confirmPassEl = document.getElementById('recoveryConfirmPass');
    const novaSenha = newPassEl ? newPassEl.value : '';
    const confirmar = confirmPassEl ? confirmPassEl.value : '';

    if (novaSenha.length < 6) {
        mostrarMsg('recoveryError3', 'A senha deve ter no mínimo 6 caracteres.', 'error');
        return;
    }
    if (novaSenha !== confirmar) {
        mostrarMsg('recoveryError3', 'As senhas não coincidem.', 'error');
        return;
    }

    const btn = document.getElementById('btnRedefinirSenha');
    const spanEl = btn ? btn.querySelector('span') : null;
    const textoOriginal = spanEl ? spanEl.textContent : '';
    if (spanEl) spanEl.textContent = 'Redefinindo...';
    if (btn) btn.disabled = true;

    const errEl = document.getElementById('recoveryError3');
    if (errEl) errEl.classList.add('hidden');

    try {
        const resp = await fetch(`${API_BASE_LOGIN}/api/recuperar-senha/redefinir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                login: recoveryLogin,
                codigo: recoveryCodeStored,
                novaSenha
            })
        });

        const data = await resp.json();

        if (!resp.ok || !data.sucesso) {
            mostrarMsg('recoveryError3', data.mensagem || 'Erro ao redefinir senha.', 'error');
            return;
        }

        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        irParaEtapa(4);

        // Mark all dots as done
        document.querySelectorAll('.recovery-step-dot').forEach(dot => dot.classList.add('done'));
        document.querySelectorAll('.recovery-step-line').forEach(line => line.classList.add('done'));

    } catch {
        mostrarMsg('recoveryError3', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (spanEl) spanEl.textContent = textoOriginal;
        if (btn) btn.disabled = false;
    }
}