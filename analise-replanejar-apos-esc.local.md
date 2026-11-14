# Replanejar o painel depois do Esc, na mensagem da própria pessoa (brief final)

Base: `main` + working tree (a correção do halt está em curso em `draw/layout.ts` e `tests/turnos.test.ts`; este plano não toca nesses arquivos). Nada foi editado.

## Essencial

- Hoje, depois de um turno parado pela pessoa (Esc), o lembrete de replanejar (`PROMPT.interrupted`) só vai ao modelo quando a próxima mensagem é **de outra sessão** (`hooks/prompt-submit.ts:100`, `aborted && it.peer`). Na mensagem da própria pessoa, vai só `PROMPT.open` ("feche com done as que esta mensagem conclui…").
- **Mudança:** com o turno anterior abortado e tarefas abertas, a mensagem da pessoa também leva um lembrete de replanejar, **no lugar** do `PROMPT.open`, nunca junto.
  - O texto é próprio, porque o atual fala em "mensagem de outra sessão". Ele prevê o caso em que a mensagem não tem relação com o plano interrompido.
- **Arquivos:** `hooks/prompt-submit.ts` (a condição) e `text/rules.ts` (um texto novo). Testes num arquivo novo, `tests/lembretes.test.ts`, para não tocar em `turnos.test.ts`, que a correção do halt está usando.
- Commit separado, depois do commit do halt.

## 1. Como é hoje (conferido no código)

- `hooks/turn.ts:125`: no `turn.complete` do loop principal, grava `turnAborted = e.isAborted === true`.
- `hooks/prompt-submit.ts`:
  - l. 59 lê `aborted`;
  - l. 66–80: prompts que não abrem turno (aviso do app, hand-back, `NO_TURN`) saem antes, sem tocar em `turnAborted`, que fica guardado para a próxima mensagem que abre turno;
  - l. 97 zera `turnAborted` em qualquer mensagem que abre turno;
  - l. 100–102:
    ```ts
    const left = aborted && it.peer
      ? hasOpen(tasks) ? PROMPT.interrupted(openList(tasks)) : PROMPT.interruptedEmpty
      : hasOpen(tasks) ? PROMPT.open(openList(tasks), reminders.answeredInChat) : undefined
    ```
- `text/rules.ts:117–130`: `PROMPT.interrupted(list)` e `PROMPT.interruptedEmpty`, os dois com "esta mensagem de outra sessão chegou em seguida".
- `openList` (`hooks/panel.ts:187`): as folhas abertas e os pais sem filha aberta, até 10, no formato `"id" título`.
- O contexto final é `[note?, taken?, left?, PROMPT.request]`. `left` é **um** só texto, então não há duplicação desde que a condição escolha um dos dois.

## 2. Condição exata

Na mensagem que abre turno (passou do bloco das l. 66–80), com `aborted` = `turnAborted` lido antes de ser zerado:

| Turno anterior abortado | Origem | Há tarefas abertas | Texto em `left` |
|---|---|---|---|
| sim | outra sessão | sim | `PROMPT.interrupted(lista)` (igual a hoje) |
| sim | outra sessão | não | `PROMPT.interruptedEmpty` (igual a hoje) |
| sim | **a pessoa** | sim | **`PROMPT.interruptedByYou(lista, answeredInChat)`** (novo) |
| sim | a pessoa | não | nada de replanejar: segue `undefined`, como hoje. Sem trabalho interrompido, não há o que juntar; o `PROMPT.request` já pede o plano |
| não | qualquer | sim | `PROMPT.open(lista, answeredInChat)` (igual a hoje) |
| não | qualquer | não | `undefined` (igual a hoje) |

`hasOpen(tasks)` é o mesmo critério que já decide o `PROMPT.open`.

Código proposto (l. 100–102):
```ts
const left = aborted && hasOpen(tasks)
  ? it.peer ? PROMPT.interrupted(openList(tasks)) : PROMPT.interruptedByYou(openList(tasks), reminders.answeredInChat)
  : aborted && it.peer ? PROMPT.interruptedEmpty
  : hasOpen(tasks) ? PROMPT.open(openList(tasks), reminders.answeredInChat) : undefined
```
Atualizar o comentário da l. 98–99: depois de um turno interrompido, a mensagem que vem em seguida, da pessoa ou de outra sessão, pede que o painel seja replanejado em vez da lista do que ficou aberto.

## 3. Texto proposto (`text/rules.ts`, junto de `interrupted`)

Mesmo estilo dos vizinhos: prefixo `PANEL`, imperativo curto, nomes completos das ferramentas, sem códigos internos.

```ts
// The person stopped the last turn (Esc) and wrote next (the person: "precisa replanejar quando eu
// interrompo e envio nova mensagem"): the model replans the panel before going on, keeping what the
// stopped work left open only if this message continues it.
interruptedByYou: (list: string, answered: boolean) =>
  (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
  PANEL + 'você interrompeu o turno anterior antes de terminar, e esta é a mensagem seguinte. Antes de ' +
  'seguir, replaneje o painel: chame mcp__task-tree__plan com o nível 1 inteiro, na ordem em que vai ' +
  `executar. Se esta mensagem continua o trabalho interrompido (tarefas abertas: ${list}), junte o que ` +
  'ficou com o que ela pede e remarque com mcp__task-tree__done o que já estava concluído; se ela muda ' +
  'de rumo, feche com mcp__task-tree__done o que ela substitui e planeje só o pedido novo. Depois siga ' +
  'etapa por etapa com start e done.',
```

- **Atenção ao sujeito:** quem interrompeu foi a pessoa, e o texto vai ao modelo. "Você interrompeu" leria como se o modelo tivesse interrompido. Trocar por **"o usuário interrompeu o turno anterior antes de terminar, e esta é a mensagem seguinte dele."** É a forma recomendada.
- **Mensagem sem relação com o plano interrompido:** o texto manda fechar com `done` o que ela substitui e planejar só o pedido novo. Assim, nada fica aberto sob o plano novo, como o `PROMPT.open` já orienta.
- **`answered`:** mantido para o caso raro de Esc com pergunta aberta em que a pessoa responde pelo chat, para não perder o aviso que o `PROMPT.open` dava.

## 4. Impactos

- **`RULES`** (o prompt de sistema): não muda. A regra geral "Ao replanejar, chame plan de novo" já existe; o lembrete é contextual.
- **Outros lembretes:** `PROMPT.request` segue sempre; `endedNote`/`takenNote` seguem. O `PROMPT.open` deixa de ir no caso abortado + pessoa, substituído pelo novo, então não há duplicação.
- **Painel:** nada no desenho. Depois do Esc, a mensagem nova já desfaz o ✕ (`wake`). O replanejamento acontece porque o modelo chama `plan` no pedido novo; um nível 1 aberto com o mesmo id de pedido anterior é interrompido e renomeado (`<tag>:id`) e fica como histórico, comportamento atual de `planTool`.
- **Mensagem de outra sessão:** não muda.
- **Tipos:** nenhuma chave nova de estado.
- **Validação:** `npm run check`; os textos ao modelo não têm golden (decisão do plano de testes), então nada a atualizar.

## 5. Cenários de teste (no mesmo commit, `task-tree/tests/lembretes.test.ts`)

Ler o contexto que o mod passa adiante. O `promptSubmit` devolve `next({ ...e, context })`, então o hook do próprio teste, registrado embaixo, recebe o `e.context`:
```ts
let ctx: string[] = []
on('prompt.submit', (e: any) => { ctx = e.context ?? []; return {} as any })
```
Registrar **antes** da primeira chamada a `$`. Se o kit pedir outro formato de resposta (o teste falha nomeando o evento), ajustar o retorno do stub. Alternativa: conferir se o resultado de `$.prompt.submit` já traz `context` e, se trouxer, dispensar o stub.

Roteiro comum: `fixar(on)`, `pedido($, 'Primeiro pedido')`, `plan` A › {Um, Dois}, `start(['Um'])`.

1. **Esc seguido de mensagem da pessoa:** `esc($)`, `pedido($, 'Agora faça outra coisa')`.
   - `ctx` contém um texto com `replaneje o painel`, `mcp__task-tree__plan`, `o usuário interrompeu` e a lista com `Um` e `Dois`.
   - **Não** contém o texto do `PROMPT.open` (o trecho `deixe abertas só as que continuam`).
2. **Fim normal seguido de mensagem da pessoa:** `fimDoTurno($)`, `pedido(...)`. `ctx` contém o texto do `PROMPT.open` e não contém `replaneje o painel`.
3. **Esc seguido de mensagem de outra sessão:** `esc($)`, `$.prompt.submit({ text: '<cross-session-message from="local_x" name="X">oi</cross-session-message>' })`. `ctx` contém `esta mensagem de outra sessão` e `replaneje o painel`: o texto atual, sem mudança.
4. **Esc sem tarefas abertas:** `done` em tudo antes do `esc`, depois `pedido(...)`. `ctx` não contém `replaneje o painel`.
5. **O lembrete vale uma vez:** depois do cenário 1, um novo `fimDoTurno` + `pedido` → `ctx` volta ao `PROMPT.open`, porque `turnAborted` foi zerado.

Para os cenários 2 a 5, usar trechos curtos e estáveis dos textos, não a frase inteira. Se a mensagem de outra sessão exigir campos de origem (`origin.kind`), conferir com o `said()` de `prompt-submit.ts`: ele reconhece o texto `<cross-session-message`.

## 6. Riscos

- O texto ao modelo muda o comportamento dele. Pode replanejar demais (chamar `plan` quando só ia continuar). O texto limita isso com "se esta mensagem continua… / se ela muda de rumo…".
- Esc com pergunta aberta: o `dropWaits` (l. 82) já limpa a espera; o `answered` mantém o aviso. Caso raro; conferir no app.
- Prompts que não abrem turno depois do Esc (aviso do app, notificação de tarefa em segundo plano) não consomem `turnAborted`. O lembrete chega na primeira mensagem real, que é o desejado.
- Se a correção do halt mudar como o Esc é marcado, a condição não muda: depende só de `turnAborted`.

## 7. O que o usuário valida no app

1. No meio de uma tarefa, apertar Esc e mandar uma mensagem que continua o trabalho. O modelo chama `plan` antes de seguir; o painel mostra o pedido novo com o plano reorganizado; o que já estava feito volta ✓.
2. Apertar Esc e mandar uma mensagem sobre outra coisa. O modelo fecha o que ficou e planeja só o pedido novo; nada fica aberto à toa sob o plano novo.
3. Terminar um turno normalmente e mandar mensagem: o comportamento é o de sempre, sem replanejamento forçado.
4. Uma mensagem de outra sessão depois do Esc continua igual.

## 8. Brief para a Implementação

Tarefa: replanejar o painel depois do Esc, na mensagem da própria pessoa. Commit local **separado** e **depois** do commit da correção do halt. Não tocar em `draw/layout.ts` nem em `tests/turnos.test.ts`. Sem push.

1. Em `task-tree/text/rules.ts`: acrescentar `PROMPT.interruptedByYou(list, answered)` logo depois de `interruptedEmpty`, com o texto da seção 3 e o sujeito "o usuário interrompeu o turno anterior antes de terminar, e esta é a mensagem seguinte dele", e o comentário curto em inglês, como os vizinhos.
2. Em `task-tree/hooks/prompt-submit.ts`: trocar o cálculo de `left` (l. 100–102) pelo da seção 2 e atualizar o comentário das l. 98–99.
3. Criar `task-tree/tests/lembretes.test.ts` com os cenários 1 a 5 da seção 5, usando `fixar`, `pedido`, `plan`, `start`, `done`, `fimDoTurno` e `esc` do kit e capturando o `context` com um stub de `prompt.submit`.
4. Escrever os 3 arquivos de uma vez (cópia no scratchpad e copiar junto) e rodar `npm run check`.
5. Se um teste mostrar outro comportamento do plugin, não ajustar a asserção ao bug: relatar.

Commit: `fix(task-tree): depois do Esc, a mensagem seguinte da pessoa pede para replanejar o painel`, com `git commit -- task-tree/text/rules.ts task-tree/hooks/prompt-submit.ts task-tree/tests/lembretes.test.ts`.

Relatar:
- o hash;
- a saída resumida do check;
- como o `context` foi lido no kit (stub ou resultado);
- se a mensagem de outra sessão precisou de campos de origem.
