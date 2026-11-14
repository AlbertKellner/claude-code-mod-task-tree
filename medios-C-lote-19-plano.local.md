# Lote 19 (triagem C): nota do fim dos subagentes e done em tarefa ✕

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "O modelo não é avisado quando o painel fecha ou marca ✕ a tarefa pelos subagentes…", nas
  partes que seguem de pé: a nota ao modelo e o done em tarefa ✕. A regra escrita foi no lote 15; a
  reabertura que voltava a ✕ foi resolvida no PR 36. Correção direta. O fechamento automático não
  muda (decisão de 2026-11-09).

## 2. Causa confirmada na ponta

- Escrito, `hooks/agents.ts:267-308` (`settleBySubs`): com o turno encerrado e todos os subagentes de
  uma tarefa terminados, a tarefa fecha (✓) ou fica interrompida ("falhou" quando um falhou), sem
  deixar nota. Chamado no fim do turno (`hooks/turn.ts:148`), no fim de um subagente em segundo plano
  (`hooks/agents.ts:161`), na conferência dos cartões (`249`) e na carta não entregue (`391`).
- Escrito, `hooks/tools.ts:155`: o done numa tarefa interrompida responde só `"<id>" foi interrompida`.
- Para comparar: a carta entregue fecha a tarefa e avisa uma vez (`takenNote`,
  `hooks/sessions.ts:199-224`).
- Dedução: um subagente em segundo plano falha depois do turno; a tarefa fica ✕ "falhou"; no prompt
  seguinte nada diz isso ao modelo, e o done dele recebe "foi interrompida", sem o caminho para refazer.

## 3. O que muda

- Chave nova do state para as tarefas do loop principal que o fim dos subagentes fechou ou
  interrompeu e de que o modelo ainda não foi avisado (id, título e como ficou: concluída, falhou,
  interrompida), no molde de `ended` (as sessões que terminaram o turno): só state, sem store.
  `types/index.d.ts` (`PluginState`) e uma linha na `TABLE` de `state/durability.ts`.
- `hooks/agents.ts` (`settleBySubs`): ao fechar ou interromper uma tarefa do loop principal, acrescenta
  à lista. Uma função `…Note` que devolve o texto uma vez e zera a lista, como `endedNote`.
- `hooks/prompt-submit.ts` (os três pontos em que hoje saem `endedNote` e `takenNote`) e
  `hooks/tool-call.ts` (`sessionNotes`): a nota nova sai junto.
- `text/rules.ts`, dois textos: "os subagentes lançados destas tarefas terminaram e o painel as
  concluiu sozinho: <lista>. Se alguma ainda tinha algo a fazer, reabra com mcp__task-tree__start." e
  "o painel marcou como interrompidas as tarefas cujo subagente falhou ou foi parado: <lista, com
  'falhou' ou 'interrompida'>. Para refazer, chame mcp__task-tree__start na tarefa (ela reabre) e
  lance o subagente de novo; se o resultado já basta, deixe como está."
- `hooks/tools.ts` (`doneTool`) com o texto em `text/rules.ts`: o aviso do done numa tarefa
  interrompida passa a `"<id>" foi interrompida: o done não a conclui; para retomá-la, chame start
  nela`. O trecho "foi interrompida" fica.

Em termos do painel: o desenho não muda. O modelo passa a saber, uma vez, que a tarefa fechou ou
ficou ✕ pelos subagentes, e como refazê-la.

## 4. Impacto

`npm run impacto` com os sete arquivos: núcleo tocado (`types/index.d.ts`), todos os cobertos. Sem o
núcleo, as áreas são subagentes 23, envios 17, turnos 14, pedidos 14, lembretes 11, árvore 9,
perguntas 8. Checklist: os quatro "no app" de subagentes (não tocados). Golden: nenhum (nada de
desenho muda).

## 5. Testes de verificação (`tests/subagentes.test.ts`, com `lancaveis`)

- "quando os subagentes fecham a tarefa no fim do turno, o modelo é avisado uma vez". Regra:
  `subagentes.modelo-avisado-do-fechamento`. Pedido, plan, start, um lançamento que termina, fim do
  turno (a tarefa fica ✓ sozinha); o contexto do pedido seguinte contém "concluiu sozinho" e o título
  da tarefa; o do prompt depois dele, não. Falha hoje: nenhum aviso.
- "o subagente em segundo plano que falha depois do turno: o prompt seguinte diz que a tarefa ficou
  interrompida e como refazer". Mesma regra: lançamento em segundo plano, fim do turno,
  `fimDoSubagenteCom` erro (a tarefa fica ✕ "falhou"); o contexto do `aviso` seguinte contém "falhou"
  e "mcp__task-tree__start". Falha hoje.
- "a nota sai também no resultado da ferramenta seguinte, com o turno em curso". Mesma regra: um
  lançamento em segundo plano, fim do turno, fim do subagente (a tarefa fecha), e então uma chamada
  de ferramenta do loop principal sem prompt antes (o turno de um aviso já em curso): o contexto do
  resultado dela traz a nota, e a chamada seguinte não.
- "o done numa tarefa interrompida diz que o start a reabre". Regra:
  `arvore.done-em-interrompida-indica-o-start` (em `tests/arvore.test.ts` ou aqui): a resposta do done
  contém "foi interrompida" e "start". Falha hoje: só "foi interrompida".
- Testes existentes: nenhum muda (nenhum confere o contexto do prompt depois de um fechamento pelos
  subagentes; conferir na hora com `npm run check`).

## 6. Catálogo e selos

`regras/subagentes.md`, novo, `coberto`:

```markdown
### subagentes.modelo-avisado-do-fechamento
O modelo é avisado, uma vez, quando o fim dos subagentes fecha ou interrompe uma tarefa.

- Dado uma tarefa do loop principal fechada pelo painel porque os subagentes lançados dela terminaram (✓), ou marcada ✕ porque um falhou ou foi parado
- Quando chega o prompt seguinte, ou a próxima chamada de ferramenta do loop principal
- Então o modelo recebe a nota com a tarefa e como ela ficou: concluída sozinha (reabrir com start se ainda havia o que fazer), ou interrompida, com "falhou" quando foi falha (start nela para refazer); a nota sai uma vez

Origem: auditoria 2026-11-10 (o fechamento automático não deixava nota); aplica subagentes.pai-conclui-no-fim-do-turno e subagentes.pai-reflete-falha-ou-interrupcao (decisões de 2026-11-09), sem mudá-las.
Código: hooks/prompt-submit.ts, hooks/tool-call.ts, text/rules.ts
Estado: coberto
```

`regras/arvore.md`, novo, `coberto`:

```markdown
### arvore.done-em-interrompida-indica-o-start
O done numa tarefa interrompida não a conclui, e diz que o start a reabre.

- Dado uma tarefa ✕ (interrompida pelo fim de um subagente, ou histórico de um pedido anterior)
- Quando o modelo chama done nela
- Então a resposta avisa que ela foi interrompida, que o done não a conclui e que o start nela a retoma; nada muda no painel

Origem: auditoria 2026-11-10 (o aviso dizia só "foi interrompida").
Código: text/rules.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/<arquivo>::<nome>" --tipo novo --motivo "auditoria: nota do fim dos subagentes e done em tarefa interrompida"`, um por teste novo.

## 7. Documentação

Comentário de `settleBySubs` e o topo de `hooks/tool-call.ts` (a lista das notas). `DESENVOLVIMENTO.md`:
no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Um subagente real em segundo plano que termina depois do turno: na mensagem seguinte, o modelo cita
  que a tarefa foi concluída pelo painel (ou que ficou ✕) sem tentar fechá-la de novo.

## 10. Dependências e conflitos

- Depois dos lotes 15 (a regra escrita) e 18 (`hooks/tools.ts`); depois do 09 (a chave nova precisa
  da linha na tabela).
- Triagem B, lote 07 (uma noção só de "nada em execução na tarefa"), 08 (decisão 22: relançar depois
  de falha, vale a última tentativa) e 09 (decisão 21: fim do subagente depois do Esc): mexem em
  `settleBySubs`. A nota daqui é gravada no ponto em que a tarefa muda de estado, qualquer que seja a
  regra que decide. Com a decisão 22, o texto "lance o subagente de novo" continua certo.
- Triagem B, lote 24 (subagente retomado volta a "trabalhando"): pode reabrir o que a nota disse
  fechado; a nota já saiu, e o done ou start seguinte valem.
- Triagem A, lote 05 (tarefa abandonada ✕ fora do x/y): cria outro jeito de uma tarefa ficar ✕; o
  aviso do done em interrompida precisa valer para ela também, com a frase que o lote 05 definir.
- Triagem A, lote 11 (marcas no começo do prompt) e B: outros trechos de `prompt-submit.ts`.

## 11. Bloqueio

Nenhum.
