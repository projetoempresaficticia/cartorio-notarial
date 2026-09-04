// Cartório Notarial — a situação da empresa perante o Estado.

const areaLogin = document.getElementById('area-login');
const areaSituacao = document.getElementById('area-situacao');
const areaSemEmpresa = document.getElementById('area-sem-empresa');
const navLogado = document.getElementById('nav-logado');
const navAnonimo = document.getElementById('nav-anonimo');

let empresaAtual = null;

async function carregarSituacao() {
  const msg = document.getElementById('msg-geral');
  mostrarMsg(msg, '');

  const [rSituacao, rEstado] = await Promise.all([
    api('orgao_situacao_empresa', {}),
    api('cartorio_estado_empresa', { p_cedula: empresaAtual.cedula }),
  ]);

  if (!rSituacao.ok) {
    mostrarMsg(msg, rSituacao.erro, 'erro');
    return;
  }
  const s = rSituacao.dados;
  const e = rEstado.ok ? rEstado.dados : {};

  desenharEstado(s, e);
  desenharPorPagar(s.a_aguardar_pagamento || []);
  desenharAprovados(s.aprovados || []);
}

// O painel do topo: registada? regularizada? em incumprimento?
function desenharEstado(s, e) {
  const seloEl = document.getElementById('selo-estado');
  const titulo = document.getElementById('titulo-estado');
  const detalhe = document.getElementById('detalhe-estado');

  const registada = e.registada;
  const emIncumprimento = e.estado && e.estado !== 'ativa';

  if (!registada) {
    seloEl.innerHTML = selo('Por registar', 'recusado');
    titulo.textContent = 'Empresa por registar';
    detalhe.innerHTML =
      'Sem o registo aprovado, a empresa <strong>não pode operar nem vender</strong>. ' +
      'É o primeiro passo: peça o <em>Registo da empresa</em>.';
  } else if (emIncumprimento) {
    seloEl.innerHTML = selo('Irregular', 'recusado');
    titulo.textContent = 'Situação irregular';
    detalhe.innerHTML =
      `A empresa está em <strong>${esc(e.estado)}</strong> — quem consultar a certidão vê isto. ` +
      'Regularize no Prepacoin para voltar a poder operar.';
  } else if (!s.regularizada) {
    seloEl.innerHTML = selo('Pendente', 'recusado');
    titulo.textContent = 'Há pendências por resolver';
    detalhe.textContent = s.multas_pendentes > 0
      ? `Tem ${formatarP$(s.multas_pendentes)} em multas por pagar, além dos boletos em aberto.`
      : 'Tem boletos por pagar. Assim que pagar, fica tudo regularizado.';
  } else {
    seloEl.innerHTML = selo('Registado', 'ok');
    titulo.textContent = 'Situação regularizada';
    detalhe.innerHTML =
      `Registada em ${formatarData(e.registada_em)} · protocolo ` +
      `<span class="ct-protocolo-mini">${esc(e.protocolo_registo)}</span>. ` +
      'Não há nada em falta perante o Estado.';
  }

  // a certidão, se estiver válida
  const linha = document.getElementById('linha-certidao');
  if (e.certidao_valida) {
    linha.hidden = false;
    document.getElementById('cert-codigo').textContent = e.certidao_codigo;
    const dias = diasAte(e.certidao_valida_ate);
    document.getElementById('cert-validade').textContent =
      ` · válida até ${formatarData(e.certidao_valida_ate)}` +
      (dias !== null && dias <= 15 ? ` (faltam ${dias} dias!)` : '');
  } else {
    linha.hidden = true;
  }

  document.getElementById('nome-empresa').textContent = e.nome || empresaAtual.nome;
}

function desenharPorPagar(lista) {
  const painel = document.getElementById('painel-por-pagar');
  const alvo = document.getElementById('lista-por-pagar');
  if (!lista.length) {
    painel.hidden = true;
    return;
  }
  painel.hidden = false;
  alvo.innerHTML = lista.map((b) => {
    const dias = diasAte(b.prazo);
    const prazoTexto = b.atrasado
      ? '<strong style="color:var(--ct-erro)">prazo ultrapassado</strong>'
      : `paga até ${formatarData(b.prazo)}${dias !== null && dias <= 3 ? ` (faltam ${dias} dias)` : ''}`;
    return `
      <div class="ct-linha">
        <div>
          <div class="ct-linha-titulo">${esc(b.documento)} ${etiqueta(b.estado_boleto)}</div>
          <div class="ct-linha-detalhe">
            ${esc(NOME_ORGAO[b.orgao] || b.orgao)} · fatura ${esc(b.fatura)} · ${prazoTexto}
          </div>
        </div>
        <div style="text-align:right">
          <div class="ct-linha-titulo">${formatarP$(b.valor)}</div>
          <div class="ct-protocolo-mini">${esc(b.boleto)}</div>
        </div>
      </div>`;
  }).join('');
}

function desenharAprovados(lista) {
  const alvo = document.getElementById('lista-aprovados');
  if (!lista.length) {
    alvo.innerHTML = '<p class="ct-vazio">Ainda não há nada registado. Comece pelo registo da empresa.</p>';
    return;
  }
  alvo.innerHTML = lista.map((a) => `
    <div class="ct-linha">
      <div>
        <div class="ct-linha-titulo">${esc(a.documento)} ${etiqueta('aprovado')}</div>
        <div class="ct-linha-detalhe">${esc(NOME_ORGAO[a.orgao] || a.orgao)} · ${formatarData(a.em)}</div>
      </div>
      <a href="verificar.html?codigo=${encodeURIComponent(a.protocolo)}"
         class="ct-protocolo-mini" style="text-decoration:none">${esc(a.protocolo)}</a>
    </div>`).join('');
}

async function verificarSessao() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    areaLogin.hidden = false;
    return;
  }
  areaLogin.hidden = true;
  navLogado.hidden = false;
  navAnonimo.hidden = true;

  const ctx = await minhaEmpresa();
  if (!ctx) {
    areaSemEmpresa.hidden = false;
    return;
  }
  empresaAtual = ctx.empresa;
  areaSituacao.hidden = false;
  await carregarSituacao();
}

document.getElementById('btn-sair').addEventListener('click', async () => {
  await sb.auth.signOut();
  window.location.reload();
});

ligarFormularioLogin(verificarSessao);
verificarSessao();
