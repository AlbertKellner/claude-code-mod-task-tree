# Lote 23: gravações do cartão do subagente com freio por tempo

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "Cada chamada de ferramenta de subagente com texto diferente regrava o painel inteiro
antes de a ferramenta rodar". Nenhuma decisão nova (`subagentes.corpo-e-as-tarefas-ou-a-ferramenta` não
fixa a frequência).

## 2. Causa confirmada na ponta

- `hooks/agents.ts:133-147` (`subTool`): a cada chamada lê os grupos do state (`:139`) e só deixa de
  gravar quando o texto da ferramenta é igual ao já gravado e passou menos de 1 s (`:144`). O texto leva
  o arquivo, o padrão ou o comando (`toolText`, `:118-132`), então quase toda chamada grava. O
  comentário de `:25-26` diz outra coisa ("at most once every THROTTLE ms per subagent").
- Cada gravação passa por `change` (`hooks/panel.ts:374-381`): state, status, store e arquivo publicado.
- `hooks/tool-call.ts:227`: a chamada da ferramenta do subagente espera essa gravação antes de seguir
  (`await subTool`, antes do `next`).

Num workflow com dezenas de agentes: dezenas de gravações completas e redesenhos por segundo. O efeito
visível (lentidão, cliques perdidos no redesenho) não foi medido; a contagem de gravações está escrita
no código.

## 3. O que muda

`hooks/agents.ts`, `subTool`, e o que ele guarda no módulo:

- A cada chamada, só memória: a contagem de chamadas do agente (como hoje) e a última linha de ferramenta
  dele, guardada como pendente. Sem ler o state.
- Freio de verdade, um só para todos os subagentes: no máximo uma gravação por segundo (`THROTTLE`).
  Passado 1 s desde a última gravação, a chamada grava na hora (essa é a única que espera a gravação, uma
  por segundo no máximo); dentro do segundo, a chamada volta sem gravar e um temporizador
  (`$.clock.after`, um só armado por vez) grava o que estiver pendente quando o segundo fechar.
- Uma gravação leva de uma vez as linhas pendentes de todos os agentes (um `change` só). Dentro da
  escrita, cada agente é conferido contra os grupos como estão: só recebe a ferramenta e a contagem o
  cartão ainda vivo ("trabalhando" ou "em segundo plano"); o que já terminou não ganha a ferramenta de
  volta.
- `subEnd` e `checkSubs` (o fim do subagente) tiram o pendente dele.
- As ferramentas do próprio painel e o `SubagentHandback` seguem sem contar (`:135`).
- `subStep` (modelo e toks/s do cartão) não muda neste lote.

`hooks/tool-call.ts`: a linha `:227` segue chamando `subTool`; ele agora volta rápido. O comentário do
arquivo e o de `hooks/agents.ts:25-26` passam a dizer o freio como ele é.

No painel: a linha "ferramenta · N chamadas" de um cartão pode atrasar até 1 s; a contagem de chamadas
segue exata. Menos redesenhos por segundo com muitos subagentes.

## 4. Impacto

`npm run impacto -- task-tree/hooks/agents.ts task-tree/hooks/tool-call.ts`: os 30 cenários de
`hooks/agents.ts` mais os de envios e perguntas de `hooks/tool-call.ts`. Golden: nenhum cenário pelo
mapa. O golden `subagente` tem uma chamada de ferramenta de um subagente (a primeira: grava na hora), e
o desenho não muda.

## 5. Testes

Novos, em `tests/subagentes.test.ts`:

1. "muitas chamadas de ferramenta de subagentes no mesmo segundo gravam o painel uma vez; a linha da
   ferramenta chega em até 1 s". Cenário novo `subagentes.ferramenta-em-uso-com-freio`. Roteiro: `fixar`
   com `relogio`; `lancaveis` com três ids; stubs de `Read` e `Grep`; um contador próprio do teste das
   gravações dos grupos (`on('state.set', …)` que conta as de chave `groups` e chama `next`: o kit não
   ocupa esse evento em `fixar`); pedido; plan; start; três `lancar`; zera o contador; dez
   `chamadaDoSubagente` com argumentos diferentes, espalhadas pelos três, sem andar o relógio. Afirma: o
   contador em 1. Depois `relogio.advance(1000)`: o contador em 2, e cada cartão mostra a última
   ferramenta dele com a contagem certa ("… · N chamadas"). Falha hoje: dez gravações.
2. "a ferramenta pendente de um subagente que terminou não volta ao cartão dele". Mesmo cenário. Roteiro:
   dois subagentes; uma chamada do primeiro (grava); uma do segundo no mesmo instante (pendente);
   `fimDoSubagente` do segundo; `relogio.advance(1000)`. Afirma: o cartão do segundo diz "concluído" e
   não tem linha de ferramenta; a pílula conta 1 subagente.

Testes existentes: "sem usar o painel, o cartão mostra a ferramenta em uso e quantas chamadas fez"
(`:35-51`: uma chamada, o relógio anda 1500 ms, outra chamada) segue valendo: as duas gravam na hora.
Nenhum muda.

O teste 1 conta gravações do state, que é o custo que o lote corta; é o único jeito de fixá-lo pelo
harness. Se o `on('state.set', …)` do teste não puder conviver com o do kit em algum caso, o
implementador relata e mantém só as afirmações do painel.

## 6. Catálogo e selos

`regras/subagentes.md`, cenário novo:

- `### subagentes.ferramenta-em-uso-com-freio`
- Título: "As chamadas de ferramenta dos subagentes atualizam os cartões no máximo uma vez por segundo."
- Dado vários subagentes rodando sem usar o painel, com muitas chamadas de ferramenta por segundo
- Quando eles chamam ferramentas
- Então o painel é gravado no máximo uma vez por segundo para todos eles; a linha "ferramenta · N
  chamadas" de cada cartão chega em até 1 s, com a contagem exata; o cartão que terminou nesse intervalo
  não ganha a ferramenta de volta
- `Origem: auditoria 2026-11-10 (cada chamada com texto diferente regravava o painel inteiro antes de a
  ferramenta rodar); aplica subagentes.corpo-e-as-tarefas-ou-a-ferramenta, sem mudar a regra.`
- `Código: hooks/tool-call.ts`
- `Estado: coberto`

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::muitas chamadas de ferramenta de subagentes no mesmo segundo gravam o painel uma vez; a linha da ferramenta chega em até 1 s" --tipo novo --motivo "freio por tempo nas gravações do cartão do subagente"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a ferramenta pendente de um subagente que terminou não volta ao cartão dele" --tipo novo --motivo "freio por tempo nas gravações do cartão do subagente"

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Desempenho" e onde o cartão do subagente é descrito (procurar `THROTTLE` ou
`subTool`), o freio como ficou. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Num workflow real com muitos agentes: os cliques nas dobras do painel respondem, e as linhas de
ferramenta dos cartões seguem andando (com até 1 s de atraso).

## 10. Dependências e conflitos

- Independente dos outros lotes. O lote 24 (subagente retomado) mexe em `agentSpawn`, `subEnd` e na
  condição "vivo" de `subTool` (`:141`): o segundo dos dois a entrar adapta (a conferência de vivo passa
  a ser a de dentro da escrita).
- Triagem C, decisão 34 ("Apagar os sem tarefas (Recomendado)", poda dos subagentes terminados): a poda
  apaga grupos; a escrita pendente deste lote confere o grupo dentro da escrita e não recria grupo
  apagado.
- Triagem C, decisão 38 ("Tirar, basta o ↩") e 35 ("Enxugar e esvaziar"): mexem no que `change` grava e
  publica; menos gravações só ajudam.

## 11. Bloqueio

Nenhum.
