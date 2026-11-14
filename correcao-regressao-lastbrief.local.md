# correcao-regressao · `lastBrief` morria na recarga (↩ sem o summary)

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Bug 3 dos três confirmados no R8. 2026-10-22.

## O bug

`lastBrief` era variável do módulo: `done` com `summary` → recarga a quente do mod (salvar um arquivo
do mod no meio do turno) → `turn.complete` no módulo novo achava `undefined` e o turno ficava sem o
↩ com o resumo (só a mensagem final no tooltip). Reproduzido em `reinicio.test.ts` › "summary antes
da recarga 1/2 e 2/2".

## A correção

- `task-tree/hooks/register.tsx`: chave de state `brief` (`briefState`) e `lastBrief($)` (função de
  topo, lê o state; `''` = nenhum). O `done` grava `summary` no state; `turn.complete` lê, usa e
  zera (`''`); os dois avisos ("falta o summary" no `done` e no `wrap_up`) leem o state. A variável
  `let lastBrief` saiu. `lastRecap` (recap do `wrap_up`) continua variável do módulo: mesma classe
  de problema, menor (só o tooltip do ↩ cai para a mensagem final); fica como item do R13 se
  quiserem.
- `task-tree/types/index.d.ts`: `brief: string` no contrato `PluginState['task-tree']`, com
  comentário. Necessário: o validador lista as chaves de state pelo contrato.
- `task-tree/tests/reinicio.test.ts`: `KNOWN` ficou vazio (o mecanismo fica para bugs futuros); o
  teste 2/2 agora exige `brief === summary`, `reply` = mensagem final e `state.brief === ''` depois
  do turno.

Armadilha confirmada de novo: o validador exige que uma função que recebe `$` seja declarada no topo
do arquivo ("$ is passed to "lastBrief", which is not a function declared at the top of this
file"); a primeira versão, dentro do `register`, foi recusada.

## Testes

182 pass / 0 fail (4 arquivos), nenhum TODO; golden do SVG e orçamento inalterados;
`claude plugin validate task-tree` e `validate .` ok.

## O que conferir no app

Nada visual muda. O caso corrigido: dar `done` com `summary`, salvar um arquivo do mod (recarga) e
terminar o turno — o ↩ do turno deve trazer o summary.

## Fase 1 depois deste item

Pelo `04`, faltam: **R9** (contrato `Published` + validador `parsePublished`, sem mudar o formato),
**R15** (`MAX_ROWS` sobre `Row[]` + publicar `drawSize`/`rows`) e **R20** (resíduos). Ordem do plano:
R9 → R15 → R20.
