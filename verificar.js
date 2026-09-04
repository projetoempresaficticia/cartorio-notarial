// Cartório Notarial — verificação pública. Não exige sessão: um
// fornecedor tem de poder verificar um cliente sem ter conta, como na
// vida real. O código diz qual das duas consultas usar.

const resultado = document.getElementById('resultado');

function campo(rotulo, valor) {
  return `
    <div>
      <p class="ct-sobretitulo" style="margin-bottom:2px">${esc(rotulo)}</p>
      <div>${valor}</div>
    </div>`;
}

document.getElementById('form-verificar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById('msg-verificar');
  const codigo = document.getElementById('codigo').value.trim();

  mostrarMsg(msg, 'A verificar…');
  resultado.hidden = true;

  const ehCertidao = /^CERT-/i.test(codigo);
  const r = ehCertidao
    ? await api('cartorio_verificar_certidao', { p_codigo: codigo })
    : await api('orgao_verificar_protocolo', { p_protocolo: codigo });

  if (!r.ok) {
    mostrarMsg(msg, r.erro, 'erro');
    return;
  }
  mostrarMsg(msg, '');
  (ehCertidao ? mostrarCertidao : mostrarProtocolo)(r.dados);
  resultado.hidden = false;
});

// Uma certidão vale se não expirou; mas o que ela mostra é a situação
// de HOJE da empresa — é isso que a torna útil a quem consulta.
function mostrarCertidao(d) {
  const e = d.empresa || {};
  const valida = !d.expirada;
  const regular = e.pode_operar;

  document.getElementById('selo-resultado').innerHTML =
    selo(valida && regular ? 'Regular' : 'Atenção', valida && regular ? 'ok' : 'recusado');

  document.getElementById('r-sobretitulo').textContent = 'Certidão permanente';
  document.getElementById('r-titulo').textContent = e.nome || '—';

  let sub;
  if (d.expirada) {
    sub = 'Esta certidão está expirada. Peça à empresa uma certidão atualizada.';
  } else if (!e.registada) {
    sub = 'Atenção: a empresa não tem registo aprovado no Cartório.';
  } else if (!regular) {
    sub = `Atenção: a empresa está em ${esc(e.estado)}. Hoje não pode operar.`;
  } else {
    sub = 'A empresa está registada e em situação regular.';
  }
  document.getElementById('r-subtitulo').textContent = sub;

  document.getElementById('r-campos').innerHTML = [
    campo('Código', `<span class="ct-protocolo-mini">${esc(d.codigo)}</span>`),
    campo('Cédula', `<span class="ct-mono">${esc(e.cedula)}</span>`),
    campo('NIF', `<span class="ct-mono">${esc(e.nif)}</span>`),
    campo('Setor', esc(e.setor || '—')),
    campo('Situação hoje',
      `<strong style="color:${regular ? 'var(--ct-verde-400)' : 'var(--ct-erro)'}">${esc(e.estado)}</strong>`),
    campo('Registo', e.protocolo_registo
      ? `<span class="ct-protocolo-mini">${esc(e.protocolo_registo)}</span>`
      : '<span style="color:var(--ct-erro)">sem registo</span>'),
    campo('Emitida em', formatarDataHora(d.emitida_em)),
    campo('Válida até', d.expirada
      ? `<span style="color:var(--ct-erro)">${formatarData(d.valida_ate)} (expirada)</span>`
      : formatarData(d.valida_ate)),
  ].join('');
}

// Um protocolo prova que aquele documento passou pelo Estado. O carimbo
// (hash) denuncia se os dados foram alterados depois de aprovado.
function mostrarProtocolo(d) {
  const ok = d.valido;
  document.getElementById('selo-resultado').innerHTML =
    selo(ok ? 'Registado' : 'Inválido', ok ? 'ok' : 'recusado');

  document.getElementById('r-sobretitulo').textContent =
    NOME_ORGAO[d.orgao] || d.orgao || 'Protocolo';
  document.getElementById('r-titulo').textContent = d.documento || '—';
  document.getElementById('r-subtitulo').textContent = ok
    ? 'Documento aprovado, e os dados continuam intactos desde a aprovação.'
    : (!d.integro
        ? 'Atenção: os dados foram alterados depois da aprovação — o carimbo já não bate.'
        : `Este documento está no estado "${d.estado}".`);

  document.getElementById('r-campos').innerHTML = [
    campo('Protocolo', `<span class="ct-protocolo-mini">${esc(d.protocolo)}</span>`),
    campo('Empresa', esc(d.empresa || '—')),
    campo('Estado', esc(d.estado)),
    campo('Íntegro', d.integro
      ? '<strong style="color:var(--ct-verde-400)">sim</strong>'
      : '<strong style="color:var(--ct-erro)">não</strong>'),
    campo('Data', formatarDataHora(d.criada_em)),
  ].join('');
}

// ?codigo=… abre já verificado — é o link que o histórico usa.
const codigoUrl = new URLSearchParams(window.location.search).get('codigo');
if (codigoUrl) {
  document.getElementById('codigo').value = codigoUrl;
  document.getElementById('form-verificar').dispatchEvent(new Event('submit'));
}
