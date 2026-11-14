# Tarefa 3: turnos e perguntas (detalhamento antes da implementação)

Base: branch **`test/regressivos-automacao-testes`** (PR #26), topo `d3ff1be`, working tree limpa. O trabalho novo fica **nessa mesma branch**, num commit local, para entrar no PR #26 quando o usuário liberar o push. Nada foi editado.

## Essencial

- **`turnos.test.ts` já cobre**, com 9 testes: o fim do turno (normal e Esc), as pendentes ○, o pai ◷/◉, o pedido anterior parado e o prompt seguinte. **`lembretes.test.ts` cobre** o replanejar depois do Esc.
- **Falta em turnos**, num arquivo novo `pedidos.test.ts`, para não inchar `turnos.test.ts`, 5 testes:
  - o título do pedido vem do `request` do `plan`;
  - cada mensagem abre o seu pedido, com o seu plano embaixo;
  - um aviso do app não abre pedido;
  - `plan` com o mesmo id: no pedido atual, substitui no lugar; em pedido novo, o anterior vira ✕ renomeado;
  - no Esc, pai com filha concluída fica ◷, nunca ✕.
- **`perguntas.test.ts`**, novo, com 5 testes:
  - `AskUserQuestion` sem tarefa aberta é recusado;
  - com tarefa aberta, a linha ◷ "Aguardando sua resposta" aparece **enquanto** a pergunta está aberta e a tarefa segue ◉;
  - a resposta por opção tira a linha;
  - `ExitPlanMode` mostra "Aguardando aprovação do plano";
  - o `wrap_up` com `ask` mostra "Aguardando sua escolha" até a próxima mensagem.
- **API do kit:** a pergunta é um `$.tool.call({ tool: 'AskUserQuestion', … })` respondido por um stub `on('tool.call', { tool: 'AskUserQuestion' }, …)` do teste, que **segura a resposta** num `relogio.sleep`. Assim o painel pode ser lido com a pergunta aberta.
- **Dúvida para o usuário:** quando a pessoa responde pelo chat (sem escolher opção), a linha ◷ some na hora, antes da mensagem dela chegar. Isso está certo?
- A visão resumida (itens 7, 8 e 16 do plano) fica para a tarefa 6, como planejado.

## 1. O que já existe e o que falta (turnos e pedidos)

Já coberto (não duplicar):

| Regra | Teste existente |
|---|---|
| Sem start, nada acende (plano novo todo ○) | `turnos`: "sem start, plano novo fica todo pendente" |
| Fim normal do turno: iniciada ◷, pendentes ○, pai e pedido ◷ | `turnos`: 3 testes |
| Esc: só a iniciada ✕, pendentes ○, pai e pedido ○ | `turnos`: "Esc interrompe só a tarefa iniciada…" |
| Prompt seguinte reabre o trabalho e o `start` acende | `turnos`: "o prompt seguinte ao fim do turno…" |
| Pedido anterior parado ◷ com o novo ◉; prompt que continua sem start → ◷ | `turnos`: 2 testes |
| Pai fecha com os filhos; start reabre pais e recusa concluída com filhos | `arvore`: 2 testes |
| Replanejar depois do Esc (pessoa, outra sessão, uma vez só) | `lembretes`: 5 testes |

Falta, para esta tarefa (`tests/pedidos.test.ts`):

1. **O título do pedido vem do `request`:** `pedido('uma mensagem bem comprida da pessoa')`, `plan(A, 'Título curto')`.
   - Existe a linha "Título curto" (estado pendente) e não existe a linha com o texto da mensagem.
   - Origem: regra do painel (o `request` renomeia o turno, `planTool`).
2. **Cada mensagem abre o seu pedido:** `pedido('Pedido um')`, `plan(A)`, `fimDoTurno`, `advance`, `pedido('Pedido dois')`, `plan(B)`.
   - Na ordem das linhas: "Pedido um" < "Plano A" < "Pedido dois" < "Plano B".
   - O `nivel` de "Plano B" é maior que o de "Pedido dois".
   - Origem: agrupamento por mensagem do usuário.
3. **Aviso do app não abre pedido:** `pedido('Pedido um')`, `plan(A)`, `start 1`, `fimDoTurno`, `$.prompt.submit({ text: '<side-sessions-event>…</side-sessions-event>' })`, `plan(B)`.
   - Só existe a linha de pedido "Pedido um"; "Plano B" fica embaixo dela, sem pedido novo.
   - Origem: `said()`, `notice`, prompts que não abrem turno.
   - O hand-back de subagente e o `task-notification` (`origin.kind`) entram só se o kit aceitar `origin` em `prompt.submit` (conferir no tipo `Args<'prompt.submit'>`); senão, ficam fora.
4. **`plan` com o mesmo id:**
   - (a) no **mesmo pedido**, `plan(A)` e depois `plan(A com título "Plano A revisto")`: só "Plano A revisto" aparece, sem ✕ e sem a linha "Plano A";
   - (b) em **pedido novo**: `pedido('Pedido um')`, `plan(A)`, `start 1`, `fimDoTurno`, `advance`, `pedido('Pedido dois')`, `plan(A com título "Plano A novo")`.
     - "Plano A" (o antigo) e "Um" ficam ✕ sob "Pedido um" (interrompido e renomeado, como histórico);
     - "Plano A novo" fica pendente sob "Pedido dois".
   - Origem: `planTool`, série 2 (cartões e âncoras); o usuário confirmou no plano do halt que o plano substituído segue ✕.
5. **Pai com filha concluída nunca ✕, no Esc:** plano C › {Um, Dois} (Dois folha); `start Um`, `done Um`, `start Dois`, `esc`.
   - Dois ✕; "Plano C" **◷** (não ✕); o pedido ◷.
   - Origem: `95b1a21` ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido").

Fica de fora (outras tarefas):
- a âncora do envio sem tarefa em andamento (item 2 do plano) → tarefa 4, de envios;
- a resumida e o limite de pedidos → tarefa 6;
- o subagente que termina (✕) → depende de `agentId` no `turn.complete`: anotar e cobrir na tarefa 5 se o kit aceitar.

## 2. Perguntas (`tests/perguntas.test.ts`)

Como funciona no mod (`hooks/tool-call.ts` `asked`, l. 48–73):
- `AskUserQuestion` do loop principal **sem tarefa aberta** → `{ deny: ASK.refused }`.
- Com tarefa aberta: `addWait({ kind: 'question', key: e.tool_use_id, anchor })` e depois `await next(e)`, que é onde o diálogo fica aberto.
- Ao voltar, a resposta. Se o resultado casa com `/did not answer|sent a message instead/`, a resposta foi pelo chat, e `reminders.answeredInChat` fica marcado. O `finally` tira a espera.
- `ExitPlanMode`: kind `plan`, sem recusa.
- `mcp__ccd_turn__wrap_up` com `ask`: espera `choice` (chave `<agente>:wrap_up:ask`), que fica até o próximo prompt (`dropWaits` em `promptSubmit`) ou até um `wrap_up` sem `ask`.
- No desenho, a linha da espera tem tom `wait` (glifo ◷) e título `waitText`:
  - "Aguardando sua resposta";
  - "Aguardando aprovação do plano";
  - "Aguardando sua escolha".

API do kit para simular:
- `$.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [...] })`.
- Sem hook embaixo, o hook de fundo do kit lança o erro. O teste registra `on('tool.call', { tool: 'AskUserQuestion' }, async () => { await relogio.sleep(1000); return { result: 'Opção A' } })`, **antes** da primeira chamada a `$`.
  - Conferir a assinatura do handler: `fixar` usa `(_$, e)` para `prompt.submit`. Usar a mesma forma.
- Para ler o painel **com a pergunta aberta**:
  1. `const resp = $.tool.call(...)`, sem `await`;
  2. `await relogio.settle()`;
  3. `painel($)`;
  4. `await relogio.advance(1000)`;
  5. `await resp`;
  6. `painel($)` de novo.

  É o padrão do kit para "um hook do teste que responde tarde" (`MockClock.sleep`). Se o `mount` dentro de uma chamada pendente travar ou estourar os 5 s, plano B: ler `$.state` não serve (é interno). Nesse caso, o teste de "linha aparece" vai para o checklist e fica só o "linha some".
- O deny: o kit resolve a chamada com erro, e o motivo vem no `text`. O helper `chamar` já devolve `erro: true`.
- `wrap_up`: precisa de um stub `on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: 'ok' }))`.

Testes:
1. **Sem tarefa aberta, a pergunta é recusada:** `pedido`, sem `plan`, `pergunta` → `erro: true`; o painel não tem linha "Aguardando sua resposta". Origem: regra do painel ("AskUserQuestion sem tarefa aberta é recusado").
2. **Com a pergunta aberta, aparece a espera e a tarefa segue em andamento:** `pedido`, `plan(A)`, `start 1`, pergunta segurada → a linha "Aguardando sua resposta" está `aguardando`, "Um" está `andamento`, e a linha da espera vem logo depois de "Um", com `nivel` maior. Origem: `309f9be`, a pergunta na linha ◷.
3. **Respondida por opção, a espera some e a tarefa segue em andamento:** continuação do 2 → depois de `advance` e `await`, nenhuma linha "Aguardando sua resposta", e "Um" `andamento`.
4. **`ExitPlanMode` mostra a espera do plano:** com tarefa aberta, `ExitPlanMode` segurado → a linha "Aguardando aprovação do plano" fica `aguardando`; respondido, some.
5. **A escolha do `wrap_up` fica até a próxima mensagem:** `plan`, `start 1`, `wrap_up` com `ask: 'Seguir?'` → a linha "Aguardando sua escolha" existe; `fimDoTurno` → ainda existe; `pedido('sim')` → some.

As asserções usam só títulos de linha, estados e a ordem/nível das linhas. Nada dos textos de `ASK.*` ao modelo.

## 3. Helpers novos (`tests/kit/cenario.ts`, mínimos)

```ts
// Um aviso do app (uma sessão terminou): não abre pedido.
export const aviso = ($: any) => $.prompt.submit({ text: '<side-sessions-event>sessão terminou</side-sessions-event>' })

// Uma ferramenta qualquer chamada pelo modelo (pergunta, plano, wrap_up), já com o stub registrado.
export const ferramenta = ($: any, tool: string, args: object = {}) =>
  $.tool.call({ tool, tool_use_id: `${tool}-1`, ...args }).then((r: any) => ({ texto: String(r?.result ?? r?.text ?? ''), erro: r?.isError === true }))
```

Em `tests/kit/ambiente.ts`:
```ts
// O host responde a ferramenta depois de `ms` no relógio do teste (o diálogo aberto até um advance).
export function responderDepois(on: any, relogio: { sleep(ms: number): Promise<void> }, tool: string, resultado: string, ms = 1000): void
// on('tool.call', { tool }, async () => { await relogio.sleep(ms); return { result: resultado } })
```

`pedido`, `fimDoTurno`, `esc`, `plan`, `start` e `done` seguem como estão. A mensagem de outra sessão já existe inline em `lembretes.test.ts`; se `pedidos.test.ts` precisar dela, mover para o kit como `mensagemDe($, texto)` (opcional).

`leitura.ts`: nada novo. `linha`, `esperarEstado`, `painel` e o índice de cada linha (`linhas.findIndex`) bastam. Se a ordem for usada em vários testes, um helper `antes(linhas, a, b)` em `leitura.ts` que falha imprimindo o painel.

## 4. Checklist do app (o kit não reproduz)

- O diálogo real do `AskUserQuestion`, a resposta pelo chat e o tempo real da espera.
- O cartão do `wrap_up` do app e os botões.
- Os avisos reais `<side-sessions-event>`, o hand-back de subagente e o `task-notification` (se o kit não aceitar `origin`).
- O subagente que termina com tarefas abertas (✕) e o pai dele.
- A animação e o piscar da linha da espera.

## 5. Dúvida para o usuário

- **Resposta pelo chat:** quando a pessoa não escolhe uma opção e manda mensagem, a pergunta volta "sem resposta" e o mod **tira a linha ◷ "Aguardando sua resposta" na hora**, antes da mensagem dela chegar. Ele só manda o modelo esperar a mensagem.
  - Isso está certo? Ou a linha deve ficar até a mensagem chegar, como a escolha do `wrap_up`, que fica até a próxima mensagem?
  - Se ele quiser que fique, é bug do plugin e vira correção à parte. O teste deste caso entra só depois da resposta.

## 6. Riscos

- **Recarga do clone ao salvar:** arquivos novos em `tests/` e a mudança em `tests/kit/` não são importados pelo `register.tsx`, então não quebram o mod. Mesmo assim, escrever tudo de uma vez (cópia no scratchpad) e rodar `npm run check`.
- **Ler o painel com uma chamada de ferramenta pendente** (`mount` dentro do dispatch segurado): se o kit não deixar, os testes 2 e 4 de perguntas viram só "some depois da resposta", e o "aparece" vai ao checklist. Relatar.
- **`tool_use_id`:** a espera usa como chave; sem ele, `key` fica `undefined` e duas perguntas colidiriam. Os helpers sempre o passam.
- **Assinatura dos stubs `on`** (`(e)` ou `($, e)`): seguir o que `fixar` já usa e funciona.
- **5 s por teste:** cenários curtos, sem laços.

## 7. Brief para a Implementação

Tarefa 3 do plano de automação, na branch `test/regressivos-automacao-testes`, depois de `d3ff1be`. Um commit local. Sem push.

1. `tests/kit/cenario.ts`: acrescentar `aviso($)` e `ferramenta($, tool, args?)` (seção 3).
2. `tests/kit/ambiente.ts`: acrescentar `responderDepois(on, relogio, tool, resultado, ms = 1000)`.
3. `tests/pedidos.test.ts` (novo): os 5 testes da seção 1 (título por `request`, uma mensagem por pedido, aviso não abre pedido, `plan` com o mesmo id (a) e (b), Esc com filha concluída → pai ◷). Nomes em português dizendo a regra e um comentário de origem.
4. `tests/perguntas.test.ts` (novo): os testes 1 a 5 da seção 2. A resposta pelo chat **não** entra (é a dúvida).
5. Não tocar em `turnos.test.ts`, `arvore.test.ts` nem `lembretes.test.ts`, nem no código do mod.
6. Escrever tudo de uma vez e rodar `npm run check`.
7. Se um teste mostrar comportamento diferente do esperado, **não ajustar a asserção**: marcar como pendente com o motivo, como já foi feito antes, e relatar.

Commit: `test(task-tree): pedidos e perguntas (título do pedido, aviso sem pedido, plano substituído, espera da pergunta)`, com `git commit -- task-tree/tests/kit/cenario.ts task-tree/tests/kit/ambiente.ts task-tree/tests/pedidos.test.ts task-tree/tests/perguntas.test.ts`.

Relatar:
- o hash;
- a saída resumida do check;
- se ler o painel com a pergunta pendente funcionou;
- se o kit aceitou `origin` (hand-back ou `task-notification`);
- a assinatura usada nos stubs;
- algum teste que ficou pendente e por quê.

O usuário valida lendo `pedidos.test.ts` e `perguntas.test.ts`: os nomes dos testes dizem as regras que ele decidiu. O painel do app não muda.
