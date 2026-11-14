# Correção do achado alto 13: mensagem entregue no meio do turno

Essencial: suspeita **confirmada** (harness + transcritos reais + tipos do kit). Entra sem decisão só
a parte da pergunta/plano aberto (diff `correcao-alto-13.diff`, 3 arquivos + selo, `npm run check`
verde na cópia, `git apply --check` ok sobre `ba8209a`). O resto (quando a mensagem abre o pedido) é
**BLOQUEIO**: pergunta 3 da auditoria, abaixo.

## 1. Confirmação

### No harness (sonda, não versionada)

Roteiro: `pedido`, `plan 64{64.1, 64.2}`, `start 64.1`, depois
`$.prompt.submit({ text: '<cross-session-message from=K1 …>relato</…>', turnId: 't', origin: { kind: 'peer' } })`
e o replano natural `plan 64{64.1, 64.2, 64.3}`.

- O mod ignora `e.turnId`: abre o pedido "✉ relato da filha" na hora e injeta, no meio do trabalho,
  "tarefas abertas antes desta mensagem … feche as que esta mensagem conclui ou substitui" e
  "A PRIMEIRA chamada de ferramenta é mcp__task-tree__plan".
- Depois do replano: o "64" em curso (64.1 ◉ um instante antes) vira histórico em "+1 pedidos
  anteriores"; o painel mostra só `✉ relato da filha 0/3` com 64, 64.1, 64.2, 64.3 todos ○.
- Segunda sonda: `AskUserQuestion` aberto sob 64.1 e um prompt digitado com `turnId` (origem
  `composer`, `wait: true`): a linha "◷ Aguardando sua resposta" some com a pergunta ainda aberta.
  Também vale para `ExitPlanMode`.

### No app (transcritos reais, só leitura)

- `~/.claude/projects/*/*.jsonl`: 133 transcritos têm anexos `queued_command`, ou seja, prompts
  entregues dentro de um turno em curso: 140 digitados pela pessoa (`origin.kind: human`) e 48 de
  `peer`. Entre os de `peer` há `<cross-session-message from="local_…">` (mensagens de filhas
  entregues à orquestradora no meio do turno), além dos hand-backs de subagente.
- Tipos do kit (`index.d.ts`, `PromptSubmitInput.turnId`): "A queued delivery (a peer session's
  message) reaches the model inside a running turn"; `turnId` vem preenchido para prompt "typed over
  that turn, or delivered into it"; `next(e)` resolve quando o prompt "was queued behind the running
  one". O `prompt.submit` dispara com o turno em curso.
- O que não foi registrado: o `e.turnId` e o `e.origin.kind` que o mod de fato recebe nesse caso.
  Vai ao checklist do app (seção 4).

## 2. Parte que entra sem decisão (o diff)

Não depende da pergunta 3: a pergunta e o plano continuam abertos na tela, abrindo ou não o pedido.
Aplica `perguntas.espera-sob-a-tarefa` e `perguntas.exitplanmode-espera` ("até a resposta"). Não
mexe em `pedidos.uma-mensagem-um-pedido`, `pedidos.plano-anterior-vira-historico`,
`envios.pedido-recebido-mostra-carta` nem em teste selado ou golden.

Arquivos:
- `task-tree/hooks/prompt-submit.ts`: a rede de segurança (`dropWaits` antes do `openTurn`) deixa de
  tirar as esperas `question` e `plan` do loop principal quando o prompt chega com `e.turnId`. A
  própria chamada tira a espera quando volta (`finally` em `tool-call.ts`), e o fim do turno também
  (`dropAsked`). A `choice` do wrap_up e a `permission` ficam como estão. O mod continua sem ler
  `turnId` em outros pontos.
- `regras/perguntas.md`: cenário novo `perguntas.mensagem-no-meio-do-turno-mantem-espera`
  (`Código: hooks/prompt-submit.ts`, `coberto`), antes de `perguntas.escolha-do-wrapup-ate-proxima-mensagem`.
- `task-tree/tests/perguntas.test.ts`: teste novo com `// Regra: perguntas.mensagem-no-meio-do-turno-mantem-espera`
  ("mensagem entregue no meio do turno não tira a espera da pergunta nem a do plano ainda abertas").
  Ele chama `$.prompt.submit` com `turnId`, sem mexer no kit. Fica vermelho contra o código de
  `HEAD` ("Linha 'Aguardando sua resposta' não encontrada") e verde com a correção. São 5 asserções.
- `regras/selos.json`: selo `novo` desse teste, criado com
  `npm run regras:selar -- "task-tree/tests/perguntas.test.ts::mensagem entregue no meio do turno não tira a espera da pergunta nem a do plano ainda abertas" --tipo novo --motivo "auditoria 2026-11-10: a mensagem entregue no meio do turno derrubava a pergunta ou o plano ainda abertos"`.
  O diff já traz o selo, com data 2026-11-11. Se for aplicado outro dia, basta selar de novo.

Matriz de impacto (`npm run impacto -- task-tree/hooks/prompt-submit.ts`, igual sobre o diff): 36
cenários (pedidos, turnos, lembretes, envios.pedido-recebido-mostra-carta e o novo de perguntas).
Checklist do app: nenhum. Golden: nenhum cenário.

`npm run testes:alterados`:

    Testes existentes alterados desde HEAD: nenhum
    Novos: task-tree/tests/perguntas.test.ts::mensagem entregue no meio do turno não tira a espera da pergunta nem a do plano ainda abertas

`npm run check` na cópia (binário 2.1.321): regras, travas, selos, os dois validate e tsc ok; plugin
test com 192 testes e 0 falhas; regressão com 191 testes de HEAD contra o código novo e 0 falhas.

Aplicar: `git apply ..\claude-code-mod-task-tree-notas\correcao-alto-13.diff`, depois `npm run check`
e um commit local. Copiar de uma vez, porque a recarga a quente do clone pega cada arquivo salvo.

## 3. BLOQUEIO: quando a mensagem do meio do turno abre o seu pedido

Pergunta exata (pergunta 3 da auditoria, detalhada):

> Uma mensagem que chega com a sessão no meio do turno, de uma filha ou digitada por você enquanto ela
> trabalha, deve abrir um pedido novo no painel na hora, como hoje, ou entrar no pedido em curso
> enquanto o turno não termina?
> - **Entra no pedido em curso (Recomendada):** o plano que o modelo fizer até o fim do turno fica
>   no pedido em curso; replanejar com o mesmo id guarda o estado; a pergunta aberta fica; essa
>   mensagem não ganha linha de pedido própria com ✉. Reescreve `pedidos.uma-mensagem-um-pedido` só
>   para o meio do turno e cria uma exceção ao "uma carta por mensagem" de 2026-10-30
>   (`envios.pedido-recebido-mostra-carta`).
> - **Na hora, como hoje:** cada mensagem segue com o seu pedido e o ✉; os textos ao modelo passam a
>   dizer que uma mensagem chegada no meio do trabalho não pede replano do nível 1 aberto (start e
>   done nos ids existentes; o que é novo vai com ids novos).

Ela depende da pergunta 1 da auditoria (o plan com o nível 1 aberto, numa mensagem seguinte, é
continuação ou pedido novo). Se a resposta à 1 for "Continuação", o replano deixa de zerar o estado
com mensagem no meio do turno ou fora dele, e a 3 decide só onde ficam a linha e o ✉.

Plano de cada opção, para depois da resposta. Nenhuma das duas muda teste selado ou golden.

**Entra no pedido em curso:**
1. `hooks/prompt-submit.ts`: com `e.turnId` e fora de `NO_TURN`, não chamar `openTurn`, não zerar
   `reminders` e não pôr o `PROMPT.request`. A mensagem segue para `noteReceived` (a remetente
   confirma o envio por ela) e para `showPane` quando é da pessoa. O texto de contexto passa a ser um
   novo `PROMPT.midTurn` em `text/rules.ts`: "mensagem entregue no meio do turno: continua o pedido
   em curso; o que ela pede de novo entra no plano atual".
   A marca do Esc (`aborted`) não chega aqui, porque um turno em curso não foi parado.
2. Catálogo:
   - `pedidos.uma-mensagem-um-pedido` ganha `Reescrito:` com as palavras do usuário. O teste dele usa
     prompts sem `turnId` e não muda.
   - Cenários novos: `pedidos.mensagem-no-meio-do-turno-continua-o-pedido` (o replano com o mesmo id
     guarda o estado e fica no pedido em curso) e `lembretes.mensagem-no-meio-do-turno`.
   - `envios.pedido-recebido-mostra-carta` ganha `Reescrito:` para a exceção.
3. Testes novos em `pedidos.test.ts` e `lembretes.test.ts`, selados `novo`.
4. Impacto: `npm run impacto -- task-tree/hooks/prompt-submit.ts task-tree/text/rules.ts`.

**Na hora, como hoje:**
1. `hooks/prompt-submit.ts` e `text/rules.ts`: com `e.turnId`, trocar o `PROMPT.request` ("A PRIMEIRA
   chamada é plan") por uma variante que manda planejar só o que a mensagem traz de novo, com ids
   novos, e seguir com start e done no que já está aberto.
2. Cenário novo `lembretes.mensagem-no-meio-do-turno-nao-pede-replano`, com teste em
   `lembretes.test.ts`, selado `novo`.

## 4. Checklist do app (o harness não alcança)

- O `prompt.submit` de uma mensagem de filha entregue com a orquestradora no meio do turno traz
  `e.turnId` e `e.origin.kind` (`peer` ou `peer-send-message`). O mesmo para um prompt digitado por
  cima do turno (`composer`, com e sem `ctrl+x enter`). Registrar com um `debug` temporário ou pelo
  log do mod.
- Com o diff aplicado: abrir um AskUserQuestion na principal, mandar de uma filha uma mensagem
  enquanto ele está aberto e conferir que "Aguardando sua resposta" fica até a resposta.
- Depois da decisão: o caso do print (64 em andamento, relato de filha no meio do turno, replano)
  não solta o cartão e não zera o estado.

## Observação fora do escopo

A rede de segurança tira a `choice` do wrap_up com qualquer mensagem, inclusive de outra sessão, e o
cenário `perguntas.escolha-do-wrapup-ate-proxima-mensagem` diz "até a próxima mensagem da pessoa".
Não mexi nisso: é outro achado, se for o caso.
