# correcao-regressao · R9 — contrato `Published` + validador

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 4 da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## O que entrou

- `task-tree/types/index.d.ts`: tipo `Published` (o arquivo inteiro que `publishWait` escreve e a
  mãe lê): `version?`, `waiting`, `at?`, `tasks?` (versões antigas), `groups?`, `waits`, `children`,
  `context?`, `engine?`, `panes?`, `renderError?`, `work?`, `received?`, `sends?`.
- `task-tree/hooks/register.tsx`:
  - `PUBLISHED_VERSION = 1`; `publishWait` passa a escrever `version: 1` (`satisfies Published`).
    Formato só acrescido: leitores antigos ignoram o campo.
  - `parsePublished(text)` (pura): `{ ok: Published } | { error }`. Erros: JSON inválido; não é
    objeto (lista/number/string/null); `version` presente e ≠ 1. Normaliza: listas que não são
    listas ficam de fora (ou `[]` em `waits`/`children`), `waiting` só se `=== true`, `context` só
    com `percent` e `at` numéricos, `engine` só string não vazia, `work` mapeado a string.
  - `readPublished($, id)`: lê o arquivo, valida, e diz **uma vez por sessão e motivo** no log de
    depuração (`task-tree: arquivo publicado de <id> ignorado: <motivo>`); quando o arquivo volta a
    ser válido, o motivo é esquecido (um erro posterior é dito de novo). Sem arquivo/ilegível →
    `undefined`, sem log (como antes).
  - `refreshChildren` e `watchSends` usam `readPublished`; os `Array.isArray` caso a caso saíram.
    Arquivo inválido = "sem arquivo": a sessão aparece pela linha do host, e o último painel válido
    fica desenhado (comportamento que já existia para arquivo ausente).
  - `breaks`/`split` leem `c.panel`, que já vem normalizado: sem mudança.
- `task-tree/tests/publicado.test.ts`: 8 testes — versão no arquivo escrito; válido (tarefas,
  espera, anel, modelo); só `groups`; `{}` → só a sessão, depois arquivo, depois sem arquivo (último
  painel fica); versão antiga (só `tasks`); versão 2 (ignorado, 1 log, volta ao consertar, logado de
  novo ao quebrar); corrompido e tipos errados (`[`, `[]`, `42`, `"texto"`, `null`, campos de tipo
  errado); `watchSends` com arquivo corrompido do destino (não confirma nem derruba; o válido
  confirma e o ✉ some).

## Decisões

- "Versão diferente" = `version` presente e ≠ 1 (inclusive maior). Arquivo sem `version` é versão
  antiga e é lido (os fixtures do R6 são assim).
- Não acrescentei `version` ao `Panel` interno nem mudei `Child.panel`.
- O log usa `debug()` (`$.ui.log … to: 'debug'`), o mesmo canal dos outros avisos do mod.

## Testes

190 pass / 0 fail (5 arquivos; +8); golden do SVG e orçamento inalterados; `claude plugin validate
task-tree` e `validate .` ok.

## O que conferir no app

Nada visual muda. O arquivo `~/.claude/task-tree-waits/<id>.json` desta sessão passa a ter
`"version":1` no início. Se alguma sessão rodar o plugin instalado (versão antiga), a mãe nesta
versão continua lendo o arquivo dela (sem `version`); a filha antiga lendo o arquivo novo ignora o
campo.

## Fase 1 depois deste item

Faltam **R15** (`MAX_ROWS` sobre `Row[]` + publicar `drawSize`/`rows` no arquivo — agora um campo
novo no `Published`) e **R20** (resíduos). Ordem do plano: R15 → R20.
