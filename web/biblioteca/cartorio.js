// Cartório Notarial — utilitários da biblioteca deste app.
// O cliente Supabase (`sb`) e o `api()` vêm do comum.js da pp-base.

// Dinheiro é bigint em cêntimos de P$; formatar só no ecrã.
function formatarP$(centimos) {
  return 'P$ ' + (Number(centimos || 0) / 100).toLocaleString('pt-PT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function diasAte(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

const NOME_ORGAO = {
  cartorio: 'Cartório Notarial',
  AT: 'Autoridade Tributária',
  seg_social: 'Segurança Social',
  diario: 'Diário da República',
};

function etiqueta(estado) {
  const mapa = {
    aprovado: ['ct-etiqueta-aprovado', 'Registado'],
    rejeitado: ['ct-etiqueta-rejeitado', 'Rejeitado'],
    aguarda_pagamento: ['ct-etiqueta-analise', 'Aguarda pagamento'],
    em_analise: ['ct-etiqueta-analise', 'Em análise'],
    por_pagar: ['ct-etiqueta-analise', 'Por pagar'],
    em_pagamento: ['ct-etiqueta-analise', 'A aguardar aprovação'],
    pago: ['ct-etiqueta-aprovado', 'Pago'],
  };
  const [classe, texto] = mapa[estado] || ['ct-etiqueta-analise', estado];
  return `<span class="ct-etiqueta ${classe}">${texto}</span>`;
}

// O selo carimbado. `variante` é 'ok' | 'recusado'.
function selo(titulo, variante) {
  const ano = new Date().getFullYear();
  return `
    <div class="ct-selo ${variante === 'recusado' ? 'ct-selo-recusado' : ''}">
      <span class="ct-selo-titulo">Cartório<br />Notarial</span>
      <span class="ct-selo-ano">${ano}</span>
      <span class="ct-selo-titulo">${titulo}</span>
    </div>`;
}

function mostrarMsg(el, texto, tipo) {
  if (!el) return;
  el.textContent = texto || '';
  el.className = 'ct-msg' + (tipo ? ' ct-msg-' + tipo : '');
}

// Escapar texto que vem da base antes de o pôr em innerHTML.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Login partilhado pelas páginas que o pedem.
function ligarFormularioLogin(aoEntrar) {
  const form = document.getElementById('form-login');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = document.getElementById('msg-login');
    mostrarMsg(msg, 'A entrar…');
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById('email').value,
      password: document.getElementById('senha').value,
    });
    if (error) {
      mostrarMsg(msg, 'Login inválido.', 'erro');
      return;
    }
    mostrarMsg(msg, '');
    await aoEntrar();
  });
}

// A empresa que a pessoa logada representa.
async function minhaEmpresa() {
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: pessoa } = await sb
    .from('pessoas').select('cedula, nome, empresa_id')
    .eq('id', data.user.id).single();
  if (!pessoa || !pessoa.empresa_id) return null;
  const { data: empresa } = await sb
    .from('empresas').select('cedula, nome, setor, regiao, estado')
    .eq('id', pessoa.empresa_id).single();
  return empresa ? { pessoa, empresa } : null;
}
