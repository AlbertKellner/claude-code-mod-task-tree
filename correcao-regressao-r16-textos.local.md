# correcao-regressao · R16 — textos de regra num módulo (`task-tree/text/rules.ts`)

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 2 da fase 2 do
`docs/analises/04-plano-de-aprofundamento.md` (R16 do `03`). Branch `refactor/fase-2-extracoes`,
sobre `9f900af` (R14). 2026-10-22.

## O que entrou

- **`task-tree/text/rules.ts`** (novo, 178 linhas, puro: strings e funções de strings, sem `$`).
  Exporta `BRIEF = 120` e, com `LIMIT = \`até ${BRIEF} caracteres\`` interpolado nos **6 textos**
  que citam o limite:
  - `RULES` (seção `task-tree:regras` do prompt de sistema);
  - `COMMAND` (descrição do `/task-tree`) e `TOOLS.plan/done/summary/start` (descrições das tools e
    da propriedade `summary`);
  - `PROMPT.request/open(list, answered)/handback/background/notice` (contextos do `prompt.submit`);
  - `ASK.refused/inChat/answered` (AskUserQuestion recusada sem tarefa, respondida pelo chat,
    respondida por opção);
  - `DONE.noSummary/unstarted(ids)/queued(to, id)` (avisos do resultado do `done`);
  - `WRAP_UP.noBrief/open(list)`, `SEND.queued(to, task)`, `UNPLANNED` (notas no contexto das
    chamadas de ferramenta);
  - `SESSION.taken(what)/ended(sessions, open)` (textos de `takenNote`/`endedNote`).
- **`task-tree/hooks/register.tsx`**: importa tudo isso de `../text/rules` e perde as 23 strings
  (−164/+25 linhas). `BRIEF` deixou de ser declarado nele; `brief()` continua lá e usa o importado.
  `takenNote`/`endedNote` continuam montando os dados (que sessão, que tarefa) e só pedem o texto
  ao módulo.
- **`task-tree/tests/textos.test.ts`** (novo, 7 testes) + **`task-tree/tests/golden/textos.ts`**
  (23 textos, letra por letra): coleta as descrições registradas no `session.start`, as regras do
  `prompt.compose`, os contextos do `prompt.submit` (pedido novo, tarefas abertas, resposta pelo
  chat, tarefa em segundo plano, subagente, aviso do app), as três saídas do AskUserQuestion, os
  avisos do `done` (falta o summary + etapas juntas sem start; mensagem na fila), do SendMessage na
  fila, do `wrap_up` (falta o resumo; tarefas abertas), da chamada sem plano e as notas de sessão
  (terminou o turno; recebimento confirmado). O último teste compara com o golden (imprime
  `TEXTOS-NEW <json>` quando difere, para colar no golden) e confere que **todas** as ocorrências
  de "até N caracteres" dizem 120 (≥ 6 ocorrências).

## Prova de que nada mudou

O golden foi gerado com o código **antes** da extração (`9f900af` + só o teste novo), numa cópia
temporária; depois da extração o mesmo teste passa sem `TEXTOS-NEW`: os 23 textos saem iguais,
letra por letra. O golden do SVG não é tocado (o módulo não mexe no desenho).

## Decisões

- Nomes em inglês como o resto do código; os textos ficam em português, como antes.
- `EXAMPLE` ('(ex.: "Commit 946f653 no PR #5; 151 testes ok")') também virou constante do módulo:
  aparece duas vezes (descrição do `done` e da `summary`).
- Fora do módulo, de propósito: os **resultados** das tools ("Plano exibido no painel…",
  "Em andamento: …", "Concluídas: d/n no seu grupo.", os avisos de id inexistente/ambíguo/de outro
  agente) e os `alt`/títulos do desenho: são saída do painel, não regra para o modelo. Se a
  orquestração quiser, entram num item à parte.
- `lastRecap` continua variável de módulo (R13).

## Testes

- **201 pass / 0 fail** (7 arquivos; +7 testes); `claude plugin validate task-tree` e `validate .`
  ok (o validate lista LICENSE/ícone como pendências do perfil do diretório, que já existiam e não
  mudam o resultado; não são desta frente).
- Golden do SVG: 0 `GOLDEN-NEW`; golden dos textos: 0 `TEXTOS-NEW`.
- Orçamento: 11 657 / 11 775 / 47 400 / 48 158 bytes, iguais ao R14.
- Saldo: `register.tsx` −164/+25; `rules.ts` 178 linhas; `textos.test.ts` 142; `golden/textos.ts` 30.

## O que conferir no app

Nada: comportamento idêntico. Se quiser olhar, o lembrete do `prompt.submit` e os avisos do `done`
e do `wrap_up` continuam com o mesmo texto (o painel os mostra no contexto das chamadas).
