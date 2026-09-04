# cartorio-notarial

**Cartório Notarial** — registos oficiais das empresas do Prepara Portugal

**Status:** biblioteca visual e backend construídos e testados. Páginas do
app por construir.
**Depende de:** [pp-base](https://github.com/projetoempresaficticia/pp-base),
[classcard](https://github.com/projetoempresaficticia/classcard),
[subsight](https://github.com/projetoempresaficticia/subsight),
[pp-banco](https://github.com/projetoempresaficticia/pp-banco),
[pp-orgaos](https://github.com/projetoempresaficticia/pp-orgaos)

Site: https://projetoempresaficticia.github.io/cartorio-notarial/
Biblioteca: https://projetoempresaficticia.github.io/cartorio-notarial/biblioteca.html

## O que o Cartório faz em Portugal

Vale a distinção, porque os formandos vão encontrá-la:

- **O notário** (profissão liberal desde 2004) faz escrituras públicas,
  reconhecimento de assinaturas, certificação de cópias, procurações.
- **A Conservatória do Registo Comercial** regista as empresas e emite a
  **certidão permanente**. Desde a "Empresa na Hora" (2005), constituir
  uma empresa já nem passa obrigatoriamente pelo notário.

Aqui as duas funções estão juntas num só "Cartório" — simplifica sem
mentir, desde que se use o vocabulário certo (escritura, certidão,
reconhecimento).

## Os quatro serviços

| Serviço | O que faz | Exige |
|---|---|---|
| `registo_empresa` | dá existência legal — sem ele a empresa não opera | P$ 50 + declaração assinada |
| `certidao_permanente` | a prova verificável de que está registada e regular | P$ 15 |
| `reconhecimento` | dá fé pública a um documento já assinado no Subsight | P$ 25 + documento assinado |
| `alteracao_registo` | mudança de nome, setor ou morada | P$ 30 + declaração assinada |

## A certidão permanente

Em Portugal não é um papel: é um **código com validade** que dá acesso a
uma página sempre atualizada com a situação da empresa. Bancos, clientes
e concursos pedem-na; a empresa dá o código e a outra parte consulta.

Aqui funciona igual — `CERT-2026-000001`, válida 90 dias — e é isso que a
torna diferente de um recibo: **não é o registo de algo que aconteceu, é
um espelho do estado de hoje**.

**Decisão do Germano (2026-09-04): a certidão não nasce com a empresa.**
O formando tem de a solicitar, porque é trabalho administrativo — que é o
objetivo do exercício. A empresa existe sem ela; o que não consegue é
provar-se perante terceiros.

Testado de ponta a ponta, e o resultado mostra bem o efeito pretendido:

1. empresa registada e com certidão emitida → quem consulta vê
   `estado: ativa`, `pode_operar: true`;
2. a empresa falha um salário no Prepacoin por falta de saldo → o banco
   marca `incumprimento`;
3. **a mesma certidão, o mesmo código**, consultada logo a seguir →
   `estado: incumprimento`, `pode_operar: false`.

Ou seja: quem não paga os salários fica com a ficha suja à vista de
qualquer parceiro, sem o professor ter de intervir.

## `cartorio_estado_empresa` — o ponto único de consulta

É a peça que liga o Cartório ao resto do ecossistema. Pública de
propósito (um fornecedor tem de poder verificar um cliente sem sessão
iniciada, como na vida real), devolve tudo o que outro app precisa de
saber:

```
cedula, nome, nif, setor, regiao,
estado              -- 'ativa' | 'incumprimento' | 'falida' (vem do Prepacoin)
registada           -- tem registo aprovado?
protocolo_registo   -- CT-2026-000001
certidao_valida     -- tem certidão dentro da validade?
certidao_codigo, certidao_valida_ate
pode_operar         -- o resumo: registada E ativa
```

**Os apps futuros devem chamar isto** antes de deixar uma empresa vender,
contratar, pedir crédito ou fechar contrato. Basta olhar para
`pode_operar`.

## O que este repositório fornece

- `web/biblioteca/cartorio.css` — a biblioteca visual **deste app**. Cada
  app do Prepara Portugal tem a sua; não há design system partilhado,
  porque cada um tem de manter a sua personalidade.
- `biblioteca.html` — a biblioteca documentada em página viva: cor,
  tipografia, componentes, o selo e os ícones.
- `sql/0001_servicos_e_certidao.sql` — os três serviços novos no catálogo,
  `cartorio_estado_empresa`, `cartorio_pedir_certidao`,
  `cartorio_verificar_certidao`, e o prefixo `CERT` no gerador de
  protocolos.
- `web/icones/` — Iconex estilo Light, normalizados para `currentColor`.

## A identidade visual

Base: *UI Kit | Style guide* do Figma (`ZTmj6zrRcNuB0vPBUL34Y4`), extraído
pela **API REST** — que contorna o limite de 20 chamadas/mês do MCP. Os
verdes, a tipografia Inter, os raios e as sombras vêm de lá.

A personalidade vem da ideia de **documento oficial**: régua verde de
papel timbrado no cabeçalho e nas folhas, cantos discretos (4 e 8px —
papel, não app), selo redondo carimbado com ligeira rotação, e o número
de protocolo tratado como herói da página, em monospace.

## Testes

Com sessões reais, incluindo o ciclo que junta os quatro apps: pagar a
taxa no **Prepacoin** → assinar a declaração no **Subsight** → registar no
**Cartório** (`CT-2026-000001`) → pedir a certidão (`CERT-2026-000001`) →
verificar publicamente **sem login**. Mais: pedir certidão sem registo é
recusado, e o teste do incumprimento descrito acima. Dados de teste
limpos; o catálogo e as contas dos órgãos ficaram.

## Por construir

- Páginas do app: submeter cada um dos quatro serviços, acompanhar o que
  a empresa já submeteu, e a página pública de verificação de certidão e
  protocolo.
- Ligar `cartorio_estado_empresa` aos apps que o devem exigir, quando
  existirem (pp-clientes, pp-emprego, pp-utilities).
