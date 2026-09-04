-- Cartório Notarial — os quatro serviços e a certidão permanente.
--
-- Assenta em cima do `pp-orgaos` (tabelas `orgao_tipos`, `submissoes`,
-- `multas` e a RPC `orgao_submeter`, já corrigida e testada). Aqui só se
-- acrescenta o que é próprio do Cartório.
--
-- ## Âmbito (decidido com o Germano, 2026-09-04)
--
--  1. registo_empresa   — dá existência legal. Sem ele a empresa não opera.
--  2. certidao_permanente — a prova verificável de que está registada.
--  3. reconhecimento    — dá fé pública a um documento já assinado no Subsight.
--  4. alteracao_registo — mudança de nome, setor ou morada.
--
-- ## A certidão
--
-- Em Portugal a certidão permanente não é um papel: é um **código** com
-- validade (3, 6 ou 12 meses) que dá acesso a uma página sempre atualizada
-- com a situação da empresa. Bancos, clientes e concursos pedem-na.
--
-- Aqui é igual: `CERT-2026-000042`, válido 90 dias, e a página de
-- verificação mostra o estado **de hoje** — incluindo o `incumprimento`
-- que vem do Prepacoin quando a empresa falha um salário ou um imposto.
-- Uma empresa que não paga fica com a ficha à vista de quem a consultar.
--
-- **A certidão não nasce com a empresa.** O formando tem de a solicitar —
-- é trabalho administrativo, que é o objetivo do exercício. A empresa
-- existe sem ela; o que não consegue é provar-se perante terceiros.
--
-- Guardamos as certidões na própria tabela `submissoes`: o tipo é
-- `certidao_permanente`, o `protocolo` é o código, e a coluna `prazo`
-- (que existia e nunca tinha sido usada) guarda a validade.
--
-- Aplicada ao Supabase do projeto (moxxbehwylcjaqjacmyh) em 2026-09-04.

-- ---------------------------------------------------------------------
-- 1. Catálogo dos serviços do Cartório
-- ---------------------------------------------------------------------
insert into public.orgao_tipos
  (tipo, orgao, descricao, exige_assinatura_tipo, exige_taxa, iban_orgao,
   campos_obrigatorios, periodicidade)
values
  ('certidao_permanente', 'cartorio', 'Certidão permanente da empresa',
   null, 1500,
   (select iban from public.contas where cedula = 'EP-2026-00007'),
   array['finalidade'], 'unica'),

  ('reconhecimento', 'cartorio', 'Reconhecimento de assinatura',
   'declaracao', 2500,
   (select iban from public.contas where cedula = 'EP-2026-00007'),
   array['descricao_documento'], 'unica'),

  ('alteracao_registo', 'cartorio', 'Registo de alteração da empresa',
   'declaracao', 3000,
   (select iban from public.contas where cedula = 'EP-2026-00007'),
   array['o_que_muda', 'valor_novo'], 'unica')
on conflict (tipo) do nothing;

-- ---------------------------------------------------------------------
-- 1b. Prefixo próprio para a certidão
-- ---------------------------------------------------------------------
-- `fn_proximo_protocolo` (do pp-orgaos) mapeia órgão → prefixo e cai em
-- 'OG' para o que não conhece. A certidão precisa do seu próprio prefixo
-- e da sua própria sequência, separada da dos registos — senão o código
-- sairia 'OG-2026-000001' e partilharia contador com outra coisa.
create or replace function public.fn_proximo_protocolo(p_orgao text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_ano int := extract(year from now()); v_seq int; v_pref text;
begin
  v_pref := case p_orgao
    when 'AT' then 'AT'
    when 'seg_social' then 'SS'
    when 'cartorio' then 'CT'
    when 'diario' then 'DR'
    when 'certidao' then 'CERT'
    else 'OG' end;
  insert into public.contador_protocolo(orgao, ano, ultimo) values (p_orgao, v_ano, 1)
  on conflict (orgao, ano) do update set ultimo = contador_protocolo.ultimo + 1
  returning ultimo into v_seq;
  return v_pref || '-' || v_ano || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

revoke execute on function public.fn_proximo_protocolo(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. cartorio_estado_empresa — o ponto único de consulta
-- ---------------------------------------------------------------------
-- É isto que os outros apps chamam para saber se podem confiar numa
-- empresa. Público de propósito: um fornecedor tem de poder verificar um
-- cliente sem ter sessão iniciada, tal como na vida real.
create or replace function public.cartorio_estado_empresa(p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_registo record;
  v_cert record;
begin
  if p_cedula is null or btrim(p_cedula) = '' then
    return jsonb_build_object('ok', false, 'erro', 'Cédula obrigatória.');
  end if;

  select * into e from public.empresas where cedula = btrim(p_cedula);
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Empresa não encontrada: ' || p_cedula);
  end if;

  -- o registo é único e definitivo: o primeiro aprovado é o que vale
  select protocolo, criada_em into v_registo
    from public.submissoes
    where empresa_cedula = e.cedula and tipo = 'registo_empresa' and estado = 'aprovado'
    order by criada_em
    limit 1;

  -- a certidão vale a mais recente que ainda não expirou
  select protocolo, prazo into v_cert
    from public.submissoes
    where empresa_cedula = e.cedula and tipo = 'certidao_permanente'
      and estado = 'aprovado' and prazo > now()
    order by prazo desc
    limit 1;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'cedula', e.cedula,
    'nome', e.nome,
    'nif', e.nif_ficticio,
    'setor', e.setor,
    'regiao', e.regiao,
    -- o estado vem da empresa: 'ativa', 'incumprimento' (Prepacoin) ou 'falida'
    'estado', e.estado,
    'registada', v_registo.protocolo is not null,
    'protocolo_registo', v_registo.protocolo,
    'registada_em', v_registo.criada_em,
    'certidao_valida', v_cert.protocolo is not null,
    'certidao_codigo', v_cert.protocolo,
    'certidao_valida_ate', v_cert.prazo,
    -- o resumo que os outros apps devem usar para decidir
    'pode_operar', v_registo.protocolo is not null and e.estado = 'ativa'
  ));
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Falha ao consultar: ' || sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. cartorio_pedir_certidao — emite, com as regras próprias da certidão
-- ---------------------------------------------------------------------
-- Não passa pelo `orgao_submeter` genérico porque tem duas regras que só
-- existem aqui: exige registo aprovado, e grava validade.
create or replace function public.cartorio_pedir_certidao(
  p_finalidade text,
  p_taxa uuid,
  p_dias int default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r_tipo record;
  v_pessoa record;
  v_empresa text;
  v_conta text;
  r_txn record;
  v_id uuid := gen_random_uuid();
  v_codigo text;
  v_motivo text;
  v_prazo timestamptz;
  v_dias int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sem sessão.');
  end if;

  select p.cedula into v_pessoa from public.pessoas p where p.id = auth.uid();
  if v_pessoa.cedula is null then
    return jsonb_build_object('ok', false, 'erro', 'Sem ficha na Carteirinha.');
  end if;
  v_empresa := public.fn_minha_empresa_cedula();
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro',
      'Só quem está vinculado a uma empresa pode pedir a certidão.');
  end if;

  select * into r_tipo from public.orgao_tipos where tipo = 'certidao_permanente';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível.');
  end if;

  v_dias := least(greatest(coalesce(p_dias, 90), 30), 365);

  -- regra própria: sem registo aprovado não há certidão do quê
  if not exists (
    select 1 from public.submissoes
    where empresa_cedula = v_empresa and tipo = 'registo_empresa' and estado = 'aprovado'
  ) then
    v_motivo := 'A empresa ainda não tem registo aprovado no Cartório.';
  elsif coalesce(p_finalidade, '') = '' then
    v_motivo := 'Indique para que serve a certidão.';
  else
    -- taxa: mesmas garantias do orgao_submeter (paga pela própria empresa,
    -- valor certo, conta certa, e não reutilizada)
    select iban into v_conta from public.contas where cedula = v_empresa;
    if p_taxa is null then
      v_motivo := 'Esta certidão exige o pagamento de uma taxa.';
    else
      select * into r_txn from public.transacoes where id = p_taxa;
      if not found or r_txn.estado <> 'concluida' then
        v_motivo := 'Taxa não paga.';
      elsif r_txn.valor <> r_tipo.exige_taxa then
        v_motivo := 'Valor da taxa incorreto.';
      elsif r_txn.destino_iban is distinct from r_tipo.iban_orgao then
        v_motivo := 'Taxa paga para a conta errada.';
      elsif r_txn.origem_iban is distinct from v_conta then
        v_motivo := 'A taxa tem de ser paga pela conta da sua empresa.';
      elsif exists (select 1 from public.submissoes s
                    where s.transacao_taxa_id = p_taxa and s.estado = 'aprovado') then
        v_motivo := 'Este pagamento já foi usado noutra submissão.';
      end if;
    end if;
  end if;

  if v_motivo is not null then
    insert into public.submissoes(id, tipo, empresa_cedula, submetido_por, dados,
      transacao_taxa_id, estado, motivo)
    values (v_id, 'certidao_permanente', v_empresa, v_pessoa.cedula,
      jsonb_build_object('finalidade', p_finalidade), p_taxa, 'rejeitado', v_motivo);
    return jsonb_build_object('ok', false, 'erro', v_motivo);
  end if;

  v_codigo := public.fn_proximo_protocolo('certidao');
  v_prazo := now() + (v_dias || ' days')::interval;

  insert into public.submissoes(id, tipo, empresa_cedula, submetido_por, dados,
    transacao_taxa_id, estado, protocolo, prazo, hash_carimbo)
  values (v_id, 'certidao_permanente', v_empresa, v_pessoa.cedula,
    jsonb_build_object('finalidade', p_finalidade, 'dias', v_dias),
    p_taxa, 'aprovado', v_codigo, v_prazo,
    encode(digest(v_empresa || '|' || v_codigo, 'sha256'), 'hex'));

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'codigo', v_codigo, 'valida_ate', v_prazo, 'dias', v_dias));
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Falha ao emitir certidão: ' || sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. cartorio_verificar_certidao — a consulta pública pelo código
-- ---------------------------------------------------------------------
-- O que a outra empresa faz com o código que lhe deram. Mostra a situação
-- de HOJE, não a do dia da emissão — é isso que a torna útil.
create or replace function public.cartorio_verificar_certidao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  e record;
  v_estado jsonb;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    return jsonb_build_object('ok', false, 'erro', 'Código obrigatório.');
  end if;

  select * into s from public.submissoes
    where upper(protocolo) = upper(btrim(p_codigo)) and tipo = 'certidao_permanente';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Certidão não encontrada.');
  end if;

  select * into e from public.empresas where cedula = s.empresa_cedula;
  v_estado := public.cartorio_estado_empresa(s.empresa_cedula);

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'codigo', s.protocolo,
    'emitida_em', s.criada_em,
    'valida_ate', s.prazo,
    'expirada', s.prazo <= now(),
    'finalidade', s.dados->>'finalidade',
    -- a situação de hoje, não a do dia da emissão
    'empresa', v_estado->'dados'
  ));
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Falha ao verificar: ' || sqlerrm);
end;
$$;
