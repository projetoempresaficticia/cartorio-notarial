// Cartório Notarial — pedir um serviço. O órgão emite o boleto; o
// pagamento no Prepacoin é que fecha o processo.

const areaLogin = document.getElementById('area-login');
const areaPedir = document.getElementById('area-pedir');
const areaBoleto = document.getElementById('area-boleto');
const areaSemEmpresa = document.getElementById('area-sem-empresa');
const seletor = document.getElementById('servico');

let catalogo = [];
let empresaAtual = null;

// Rótulos legíveis para os campos que o catálogo pede em snake_case.
const ROTULOS = {
  nome_empresa: ['Nome da empresa', 'Como deve constar no registo.'],
  setor: ['Setor de atividade', null],
  morada: ['Morada da sede', 'Rua, número e localidade.'],
  finalidade: ['Para que serve a certidão', 'Ex.: abrir conta, concurso, contrato com cliente.'],
  descricao_documento: ['Que documento quer reconhecer', 'Descreva o documento assinado.'],
  o_que_muda: ['O que vai mudar', 'Ex.: morada, nome, setor.'],
  valor_novo: ['Novo valor', 'O que passa a constar no registo.'],
};

async function carregarCatalogo() {
  const { data } = await sb
    .from('orgao_tipos')
    .select('tipo, descricao, exige_taxa, exige_assinatura_tipo, campos_obrigatorios')
    .eq('orgao', 'cartorio')
    .order('exige_taxa');
  catalogo = data || [];

  seletor.innerHTML = catalogo
    .map((t) => `<option value="${esc(t.tipo)}">${esc(t.descricao)}</option>`)
    .join('');
  desenharCampos();
}

function servicoAtual() {
  return catalogo.find((t) => t.tipo === seletor.value);
}

function desenharCampos() {
  const t = servicoAtual();
  if (!t) return;

  document.getElementById('ajuda-servico').textContent =
    t.exige_taxa > 0
      ? `Taxa de ${formatarP$(t.exige_taxa)} — o Cartório emite o boleto e o serviço fica registado assim que o pagar.`
      : 'Sem taxa — fica registado de imediato.';

  document.getElementById('campos-dinamicos').innerHTML =
    (t.campos_obrigatorios || []).map((campo) => {
      const [rotulo, ajuda] = ROTULOS[campo] || [campo, null];
      const multilinha = campo === 'morada' || campo === 'descricao_documento';
      return `
        <div class="ct-campo">
          <label for="c-${esc(campo)}">${esc(rotulo)}</label>
          ${multilinha
            ? `<textarea id="c-${esc(campo)}" data-campo="${esc(campo)}" required style="min-height:80px"></textarea>`
            : `<input id="c-${esc(campo)}" data-campo="${esc(campo)}" type="text" required />`}
          ${ajuda ? `<p class="ct-ajuda">${esc(ajuda)}</p>` : ''}
        </div>`;
    }).join('');

  const campoAss = document.getElementById('campo-assinatura');
  campoAss.hidden = !t.exige_assinatura_tipo;
  if (t.exige_assinatura_tipo) carregarDocumentosAssinados(t.exige_assinatura_tipo);
}

// Só documentos completos servem — o servidor volta a verificar isso.
async function carregarDocumentosAssinados(tipo) {
  const alvo = document.getElementById('assinatura');
  const { data } = await sb
    .from('documentos')
    .select('id, tipo, estado, criado_em')
    .eq('tipo', tipo)
    .eq('estado', 'completo')
    .order('criado_em', { ascending: false });

  if (!data || !data.length) {
    alvo.innerHTML = '<option value="">— nenhum documento assinado disponível —</option>';
    return;
  }
  alvo.innerHTML = data
    .map((d) => `<option value="${esc(d.id)}">${esc(d.tipo)} · ${formatarData(d.criado_em)}</option>`)
    .join('');
}

seletor.addEventListener('change', desenharCampos);

document.getElementById('form-pedir').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById('msg-pedir');
  const btn = document.getElementById('btn-pedir');
  const t = servicoAtual();

  const dados = {};
  document.querySelectorAll('[data-campo]').forEach((el) => {
    dados[el.dataset.campo] = el.value.trim();
  });

  const assinatura = t.exige_assinatura_tipo
    ? document.getElementById('assinatura').value || null
    : null;
  if (t.exige_assinatura_tipo && !assinatura) {
    mostrarMsg(msg, 'Escolha o documento assinado. Se não houver nenhum, assine-o primeiro no Subsight.', 'erro');
    return;
  }

  btn.disabled = true;
  mostrarMsg(msg, 'A registar o pedido…');

  // Uma porta só para todos os serviços. Houve um momento em que a
  // certidão tinha caminho próprio, e o caminho genérico não trazia a
  // regra "exige registo aprovado" — dava para emitir certidão de uma
  // empresa por registar. As regras vivem agora no catálogo, aplicadas
  // por quem processa; aqui não se decide nada.
  const r = await api('orgao_pedir_servico', {
    p_tipo: t.tipo, p_dados: dados, p_assinatura: assinatura, p_dias: 15,
  });

  btn.disabled = false;

  if (!r.ok) {
    mostrarMsg(msg, r.erro, 'erro');
    return;
  }
  mostrarResultado(r.dados, t);
});

function mostrarResultado(d, t) {
  document.getElementById('area-pedir').hidden = true;
  areaBoleto.hidden = false;

  if (d.estado === 'aprovado') {
    document.getElementById('selo-boleto').innerHTML = selo('Registado', 'ok');
    document.getElementById('boleto-titulo').textContent = 'Registado de imediato';
    document.getElementById('boleto-explica').textContent =
      'Este serviço não tem taxa, por isso ficou registado logo.';
    document.getElementById('boleto-ref').textContent = d.protocolo;
    document.querySelector('#boleto-ref').previousElementSibling.textContent = 'Protocolo';
    document.getElementById('boleto-valor').textContent = '—';
    document.getElementById('boleto-fatura').textContent = '—';
    document.getElementById('boleto-prazo').textContent = '—';
    return;
  }

  document.getElementById('selo-boleto').innerHTML = selo('Aguarda pagamento', 'recusado');
  document.getElementById('boleto-titulo').textContent = 'Boleto emitido';
  document.getElementById('boleto-explica').textContent =
    'Pague no Prepacoin. Assim que o pagamento entrar, o Cartório emite o ' +
    'protocolo automaticamente — não precisa de voltar aqui a avisar.';
  document.getElementById('boleto-ref').textContent = d.boleto;
  document.getElementById('boleto-valor').textContent = formatarP$(d.valor);
  document.getElementById('boleto-fatura').textContent = d.fatura;
  document.getElementById('boleto-prazo').textContent = formatarData(d.prazo);
}

async function verificarSessao() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    areaLogin.hidden = false;
    return;
  }
  areaLogin.hidden = true;

  const ctx = await minhaEmpresa();
  if (!ctx) {
    areaSemEmpresa.hidden = false;
    return;
  }
  empresaAtual = ctx.empresa;
  areaPedir.hidden = false;
  await carregarCatalogo();
}

ligarFormularioLogin(verificarSessao);
verificarSessao();
