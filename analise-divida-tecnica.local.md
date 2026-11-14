# Dívida técnica do plano de automação (análise)

Base: `136992e`. Nada foi editado no repositório. Medido nesta máquina: `node scripts/regras.mjs`, `tsc --noEmit` (com e sem `--noUnusedLocals`) e o tempo da etapa `travas`.

## Essencial

- **Catálogo:**
  - 94 regras: 71 cobertas, 9 pendentes, 14 checklist.
  - **22 origens "a confirmar"**, todas resolvíveis pelo git: 15 nasceram na entrada do mod (`465b09e`, 2026-10-20); as outras têm commit próprio (tabela na seção 1).
  - Nenhuma tem palavras do usuário verificáveis além das já citadas.
- **Pendentes:**
  - 8 das 9 cabem no harness agora: avisos do `start`/`done`/`plan`, lembrete sem plano, regras no prompt de sistema, espera de permissão, subagente que termina (o kit tem `agentId` no `turn.complete`), limite de cartões antigos e limite de 400 linhas (com `timeoutMs`);
  - `turnos.prompt-sem-turno` cabe para o hand-back (reconhecido pelo **texto**), mas o `task-notification` depende da origem do prompt, que o `PromptSubmitArgs` do kit omite (testar; senão, checklist).
- **tsc:** 58 erros, em 9 arquivos.
  - 52 são da opção `noUncheckedIndexedAccess`: acesso por índice que pode ser `undefined` (`TS2532`/`TS2345`/`TS18048`/`TS2322`). Correção mecânica, sem mudar comportamento: `!` onde o índice é garantido.
  - Mais 6: `Send` não importado em `panel.ts`; um parâmetro sem tipo; os 3 handlers de ferramenta no `register.tsx` (tipo de retorno); e 1 **comparação morta** em `svg.ts:501`.
  - Em 3 lotes por pasta, o tsc passa a **bloquear** no último.
- **Código morto** (`--noUnusedLocals`):
  - `mainTasks` (`layout.ts:889`), `replannedIds` (`tools.ts:64`, sobra do replano que preserva o estado), `childrenErrorState`/`endedState` (`panel.ts:105–106`), `R` e `f` em `svg.ts`, `Svg` em `render.tsx`;
  - mais o `r.session === true` sempre falso em `svg.ts:501`;
  - os `next` não usados dos hooks fazem parte da assinatura e **ficam**.
- **Tempo:** a etapa `travas` leva **17 s** (7 casos, cada um monta um repositório git temporário). Ideias seguras:
  - pular `travas` quando `scripts/` não mudou;
  - no hook, pular o tsc enquanto não bloqueia;
  - pular o `validate` quando só mudaram `tests/`/`regras/`;
  - rodar `plugin test` e `regressao` em paralelo;
  - nas `travas`, montar o repositório base uma vez e copiar.
  - Estimativa: o hook cai de ~60 s para ~25–35 s, sem enfraquecer nenhuma trava.
- **7 commits independentes, em ordem.** Só os lotes 5–7 mexem no mod, sem mudar comportamento (a etapa `regressao` prova).

## 1. Origens "a confirmar" (resolvidas pelo git; citar só o verificável)

| id | Origem resolvida |
|---|---|
| `arvore.done-sem-summary-e-varias-sem-start` | `9c054f8`, 2026-10-21 ("avisa quando etapas fecham juntas sem start"); o aviso de falta de summary vem de `3f06a32`, 2026-10-21 |
| `arvore.plan-recusa-ids-repetidos` | entrada do mod, `465b09e`, 2026-10-20 |
| `lembretes.fim-normal-lista-abertas` | `465b09e` (o texto "deixe abertas só as que continuam" já estava lá) |
| `lembretes.outra-sessao-apos-esc` | `2326900`, 2026-10-23 ("lembrete de replanejar quando uma mensagem de outra sessão chega depois de um turno interrompido") |
| `lembretes.primeira-chamada-sem-plano` | `465b09e` (o lembrete sem plano); o texto passou para `text/rules.ts` em `758dbb7`, 2026-10-22 |
| `lembretes.regras-no-prompt-de-sistema` | `465b09e` (a seção `task-tree:regras`) |
| `pedidos.titulo-vem-do-request` | `465b09e` |
| `pedidos.uma-mensagem-um-pedido` | `465b09e` |
| `pedidos.aviso-do-app-nao-abre-pedido` | `465b09e` (`<side-sessions-event>` reconhecido) |
| `pedidos.nivel1-concluido-e-historico` | `465b09e` ("a closed one stays as history") |
| `perguntas.sem-tarefa-recusada` | `465b09e` (recusa com `deny`) |
| `perguntas.resposta-por-opcao-tira-espera` | `465b09e` |
| `perguntas.exitplanmode-espera` | `465b09e` |
| `perguntas.escolha-do-wrapup-ate-proxima-mensagem` | `465b09e` (chave `wrap_up:ask`) |
| `perguntas.permissao-espera` | `465b09e` ("Aguardando permissão"); o hook passou para `permission.ts` em `c442523`, 2026-10-22 |
| `turnos.prompt-sem-turno` | `465b09e` (`NO_TURN`, hand-back e aviso) |
| `visual.cliques-no-icone-e-no-anel` | `4edb3f2`, 2026-10-21 ("cliques por chave, painel na tela e desenho menor") |
| `visual.tooltip`, `visual.animacao-de-linha-nova`, `visual.cores-dos-temas`, `visual.cabecalho-em-cartao`, `visual.status-embaixo-da-caixa` | a Implementação acha o commit com `git log -S` no trecho de cada um (`hoverLayer`, `motion.ts`, as cores de `svg.ts`, `ccbd8fb` para o cabeçalho em cartão, `showStatus`) e escreve "commit X, data". Sem palavra do usuário, fica "regra do painel" |

O formato no catálogo: `Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).` ou `Origem: commit <hash>, <data> ("<título do commit>").` Sem inventar palavras do usuário.

## 2. Pendentes e checklist: o que cobre agora

| id | Situação | Como cobrir |
|---|---|---|
| `arvore.ids-curtos-e-avisos` | cabe | dois planos com o mesmo id curto → `start('1')` ambíguo → texto com "ambíguo"; inexistente → "não existe"; `start` com `agentId` de outro → "é de outro agente" |
| `arvore.done-sem-summary-e-varias-sem-start` | cabe | último `done` sem `summary` → aviso; dois `done` sem `start` → aviso das etapas |
| `arvore.plan-recusa-ids-repetidos` | cabe | `plan` com "1" duas vezes → `erro: true` e o painel sem o plano |
| `lembretes.primeira-chamada-sem-plano` | cabe | `pedido` + `ferramenta($, 'Bash', …)` com stub → o resultado traz o lembrete (`UNPLANNED`); a 10ª chamada também |
| `lembretes.regras-no-prompt-de-sistema` | cabe | `$.prompt.compose({ tools: ['mcp__task-tree__plan'], sections: [] })` → a seção `task-tree:regras`; sem a tool, não. Confirmar o nome dos campos no tipo |
| `perguntas.permissao-espera` | cabe | `$.classic.PermissionRequest({ tool_name: 'Bash', … })` → a linha "Aguardando permissão: Bash"; para `AskUserQuestion`, nada |
| `turnos.subagente-que-termina-interrompe` | cabe | `plan`/`start` com `agentId: 'sub-1'` (o `chamar` do kit ganha o `agentId` opcional) e `$.turn.complete({ …, agentId: 'sub-1' })` → as abertas do subagente ✕; o pai com filha ✓ ◷ |
| `turnos.prompt-sem-turno` | parcial | hand-back pelo texto (`<agent-message from="…">[Subagent hand-back] …`) → sem pedido novo. `task-notification`: tentar `$.prompt.submit({ text, origin: { kind: 'task-notification' } })`; se o kit ignorar `origin`, fica checklist só esse caso |
| `cabecalho.limite-de-cartoes-antigos` | cabe | 4 pedidos e uma filha sem âncora, parada e antiga → "+1 cartões antigos de sessões" |
| `cabecalho.limite-de-linhas-do-desenho` | provável | um plano de 3 níveis (8 × 8 × 7) passa de 400 linhas; `{ timeoutMs: 15000 }`. Se passar dos 15 s, checklist com o tempo medido |
| `durabilidade.resumo-do-done-na-recarga` (checklist) | **investigar** | o motivo registrado ("o resumo do done não chega ao arquivo publicado nem sem recarga") pode ser bug: o `reply`/`brief` vai aos grupos no fim do turno e é publicado. Pedir à Análise uma reprodução própria antes de mexer; não entra neste plano |
| `visual.*` (11) | checklist | pintura, cliques, tooltip e posição reais, como hoje |

Nenhuma pendente diverge do código pelo que li. O item da durabilidade é o único com cheiro de bug e vai separado.

## 3. tsc: 58 erros

| Arquivo | Erros | Causa | Correção sem mudar comportamento |
|---|---|---|---|
| `hooks/render.tsx` | 22 | índice de array (`lines[i]`, `keys[i]`, `lanes[i]`) | `!` no acesso (o índice vem do mesmo `map`) |
| `draw/layout.ts` | 11 | índice (`rounds[k-1]`, `parts[…]`), `since` | `!` onde o laço garante; `since` com `as number` onde a condição anterior já o garante (l. 1292) |
| `draw/svg.ts` | 6 | índice; `r.session === true` depois de `if (r.session) return` (TS2367) | `!`; trocar `r.session === true \|\| r.kids === true` por `r.kids === true`, que dá o mesmo valor |
| `hooks/panel.ts` | 5 | índice; `Send` não importado (TS2304); `g` sem tipo (TS7006) | `!`; `import type { Send }`; `(g: Group)` |
| `draw/geometry.ts` | 4 | `Placed \| undefined` em índice | `!` |
| `hooks/register.tsx` | 3 | o retorno de `planTool`/`doneTool`/`startTool` (`{ result, isError? }`) não casa com o tipo do handler de `tool.call` | anotar o retorno das três com o tipo do kit (`ToolCallResult`), ou `as const`. Conferir o tipo esperado e só mexer na assinatura |
| `io/host.ts` | 3 | índice | `!` |
| `hooks/sessions.ts` | 2 | `files[id]` (`Published \| undefined`); índice | `!` (o `if` acima preenche) |
| `io/git.ts` | 2 | índice de `split` | `!` |

Regra para o lote:
- **Só** `!`, `as`, `import type` e anotação de tipo. Nenhuma troca de `?.`/`??` que mude o valor em tempo de execução.
- A exceção é a comparação morta de `svg.ts:501`, que é equivalente.
- A etapa `regressao` prova que nada mudou: os testes de `HEAD` rodam contra o código corrigido.

**Quando bloquear:** no commit em que o tsc chega a 0, `scripts/testes.mjs` passa a etapa `tsc` para `bloqueia: true` e o `CLAUDE.md` tira o "só aviso".

## 4. Código morto (`--noUnusedLocals --noUnusedParameters`)

| Onde | O quê | Ação |
|---|---|---|
| `draw/layout.ts:889` | `mainTasks` | remover |
| `hooks/tools.ts:64` | `replannedIds` (sobra de antes do replano preservar o estado, `fbf3c5c`) | remover |
| `hooks/panel.ts:105–106` | `childrenErrorState`, `endedState` (chaves declaradas e não usadas neste arquivo) | remover. O validate exige a chave literal **no arquivo que chama** `$.state`; aqui não há chamada |
| `draw/svg.ts:363, 374` | parâmetro `f` e `R` não lidos | `R`: remover a linha. `f`: é parâmetro de função; trocar por `_f` só se o validate aceitar, senão manter |
| `hooks/render.tsx:406` | `Svg` desestruturado e não usado | remover da desestruturação |
| `hooks/prompt-submit.ts:114`, `render.tsx:278`, `tools.ts:34/126/185` | `$`/`next` não usados | **manter**: são a assinatura do hook (`($, e, next)`). Não ligar `noUnusedParameters` no tsconfig |

Ligar `noUnusedLocals` de vez no tsconfig fica como opção para depois do bloqueio do tsc (dúvida 2).

## 5. Filhas, subagente, hand-back e task-notification no harness

- **Filhas:** cobertas pelas tarefas 5 e 7. O que segue em checklist é real (ordem com sessões reais, espera de origem de 10 s, mais de 20 rodadas). A espera de origem (`WAIT_ORIGIN`) **cabe**: com `relogio.advance(10_001)`, o cartão aparece. Pode entrar como teste na tarefa de rodadas (opcional).
- **Subagente:** cabe (seção 2). Um `launch` também (`ferramenta($, 'Agent', { description })` com stub → o grupo do subagente sob a tarefa em andamento).
- **Hand-back:** cabe pelo texto.
- **task-notification:** depende de o kit aceitar `origin` no `$.prompt.submit` do teste. O tipo do lado do plugin (`PromptSubmitArgs`) o omite; o do motor talvez não. Tentar; se não, checklist.

## 6. Tempo

Medido: `travas` 17,1 s. Pelo relato da Implementação, o hook leva ~60 s no total.

Ideias seguras, sem enfraquecer nenhuma trava:
1. **`travas` só quando o código delas muda:** rodar `node --test scripts/travas.test.mjs` só se `scripts/selos.mjs`, `scripts/regressao.mjs`, `scripts/regras.mjs`, `scripts/alterados.mjs`, `scripts/testes.mjs` ou o próprio `travas.test.mjs` diferem de `HEAD` (no hook, do índice). As travas testam os scripts; script sem mudança, resultado igual. **−17 s** na maioria dos commits.
2. **Dentro das `travas`:** montar o repositório git base uma vez (`before`) e copiar a pasta para cada caso (`cpSync`), em vez de `git init` + commit por caso; ou rodar os casos em paralelo (`node --test --test-concurrency`). **−10 s** quando rodar.
3. **tsc no hook:** enquanto não bloqueia, não roda no hook (só no `npm run check` manual). Depois do lote que zera os erros, volta e bloqueia. **−5 a 10 s** até lá.
4. **`validate` só quando pode mudar:** pular os dois `validate` se nada mudou em `task-tree/` fora de `tests/`, nem em `.claude-plugin/`. **−5 a 10 s** nos commits de teste e catálogo.
5. **`plugin test` e `regressao` em paralelo:** pastas diferentes; os dois chamam o binário. **−10 s** quando a regressão roda.

Não fazer: pular `selos`, `regras` ou `regressao` quando há mudança em `task-tree/`, e cache de resultado de teste. Isso enfraqueceria as travas.

## 7. Commits (ordem; quem mexe no quê)

| # | Commit | Arquivos | Mod? | Paralelo |
|---|---|---|---|---|
| 1 | `docs(regras): origens resolvidas pelo git` | `regras/*.md` (só as linhas `Origem:`) | não | com o 2 |
| 2 | `chore: check mais rápido sem enfraquecer as travas` | `scripts/testes.mjs`, `scripts/travas.test.mjs`, `CLAUDE.md` (a seção "Como executar") | não | com o 1 |
| 3 | `test(task-tree): pendentes da árvore, lembretes e permissão` | `tests/arvore.test.ts`, `tests/lembretes.test.ts`, `tests/perguntas.test.ts`, `tests/kit/cenario.ts` (`agentId` opcional), `regras/*.md` (estados) | não | depois do 1 |
| 4 | `test(task-tree): subagente, hand-back e limites do desenho` | `tests/turnos.test.ts`, `tests/cabecalho.test.ts`, `regras/*.md` | não | depois do 3 |
| 5 | `refactor(task-tree): código morto sem uso` | `draw/layout.ts`, `hooks/tools.ts`, `hooks/panel.ts`, `draw/svg.ts`, `hooks/render.tsx` | sim, sem mudar comportamento | depois do 4 |
| 6 | `refactor(task-tree): tipos de draw/ sem erros do tsc` | `draw/*.ts` | sim | depois do 5 |
| 7 | `refactor(task-tree): tipos de hooks/ e io/ sem erros; tsc passa a bloquear` | `hooks/*.ts(x)`, `io/*.ts`, `scripts/testes.mjs`, `CLAUDE.md` | sim | depois do 6 |

- Os 5–7 só depois dos testes novos, para a etapa `regressao` ter mais testes protegendo.
- Os 1 e 2 tocam arquivos diferentes e podem ir em paralelo (duas escritoras, conjuntos separados), mas o `npm run check` roda tudo: em sequência é mais simples.

## 8. Riscos

- **Recarga do clone** (lotes 5–7): vários arquivos do mod por commit. Escrever cada lote de uma vez (cópia no scratchpad) e rodar `npm run check` antes do passo seguinte.
- **Selos:** os lotes 1, 2, 5, 6 e 7 não mudam testes. Os lotes 3 e 4 só acrescentam testes (`novo`) e o `agentId` no kit (`refatoracao`). Nenhum teste existente muda; `testes:alterados` confirma.
- **Validate e o código morto:** remover uma constante de chave de estado de um arquivo que **chama** `$.state` com ela recusaria o módulo. Por isso só as duas de `panel.ts` sem uso. Conferir com o `validate --strict` antes do commit.
- **O tipo de retorno dos handlers** (`register.tsx`): anotar sem mudar o objeto devolvido. Se o tipo do kit exigir outro formato, parar e relatar; não mudar o retorno.
- **Pular etapas no hook** (lote 2): a condição de "mudou" compara com `HEAD` no índice. Um erro na condição pularia uma etapa que deveria rodar. As `travas` (quando rodam) e o CI (tarefa 10) cobrem; o lote 2 deve ter um teste da condição.

## 9. Dúvidas para o usuário

1. **Pular etapas no hook quando os arquivos delas não mudaram** (`travas` sem mudança em `scripts/`, `validate` sem mudança no mod, tsc enquanto não bloqueia)? O `npm run check` manual continua rodando tudo. Recomendado: sim.
2. **Depois de zerar o tsc**, ligar também `noUnusedLocals` no tsconfig, para o código morto não voltar? Recomendado: sim, sem `noUnusedParameters`, por causa das assinaturas dos hooks.

## 10. Brief para a Implementação: lote 1 (origens no catálogo)

Na branch `test/regressivos-automacao-testes`, depois de `136992e`. Commit local. Sem push.

1. Em `regras/*.md`, trocar as 22 linhas "a confirmar" pelas origens da seção 1.
   - Para os cinco `visual.*` sem commit na tabela, achar o commit com `git log -S "<trecho>" --format="%h %ad %s" --date=short -- task-tree | tail -1` no trecho que implementa cada um, e escrever `Origem: commit <hash>, <data> ("<título>").`
   - Nada de palavras do usuário que não estejam num commit ou no `DESENVOLVIMENTO.md`.
2. Não mudar `Estado:` nem o Dado/Quando/Então.
3. `npm run check` verde (só a etapa `regras` muda algo, e deve seguir em "71 cobertas, 9 pendentes, 14 checklist"); `grep -c "a confirmar" regras/*.md` sai 0, menos o `README.md`, que descreve o formato.

Commit: `docs(regras): origens resolvidas pelo git`. O usuário valida lendo o diff de `regras/`.
