# Tarefa 4: envios ✉ (detalhamento antes da implementação)

Base: branch `test/regressivos-automacao-testes`, topo `58e91c2`. Nada foi editado.

## Essencial

- **Dá para testar no kit.**
  - O `SendMessage` é um `$.tool.call` respondido por um stub do teste. O texto do resultado decide entre fila e entrega imediata (`queued` sem `turn has started`).
  - A **entrega** ("a sessão tomou a mensagem") é lida pelo mod no host: `mcp.call` `ccd_session_mgmt`/`list_sessions` e `get_session self`, mais `fs.read` do arquivo publicado da outra sessão, com `received: [{ from, at }]`. Tudo isso se responde com stubs `on`.
  - O `aviso($)` (aviso do app) força a releitura na hora, sem depender do relógio.
- **A cor é observável no terminal** como o token de cor do ícone ✉ (`permission` = azul fila, `success` = verde entregue, `inactive` = cinza interrompida), junto com a palavra à direita ("na fila", "entregue", "interrompida"). A cor pintada de verdade fica no checklist.
- **Helpers novos:**
  - em `kit/ambiente.ts`, `host(on, ...)` e `responderEnvio(on)`;
  - em `kit/cenario.ts`, `envio($, para)` e `mensagemDe($, de, texto)`;
  - em `kit/leitura.ts`, o campo `carta` na `Linha`.
- **Testes:** cerca de 10, num arquivo novo `tests/envios.test.ts`, incluindo `pedidos.replano-mantem-envio-ate-entrega`.
- **Catálogo:**
  - `envios.sem-tarefa-em-andamento-ancora-na-ultima-iniciada` está **desatualizada**: a regra atual vem de `5f3df6e` (2026-10-23) e diz "a pendente planejada por último do pedido atual; sem pendente, a última iniciada". Ela é reescrita.
  - `envios.mensagens-juntas-vao-a-ultima` depende do painel publicado da filha com turnos e passa para a tarefa 5 (sessões).
- **Dúvida para o usuário:** a mensagem entregue na hora ("its turn has started") aparece azul "na fila" até a outra sessão publicar que a recebeu.

## 1. Como funciona hoje (código)

**Envio** (`hooks/tool-call.ts`, `sentMessage`, l. 101–162; só no loop principal, depois da chamada):
- A âncora é calculada **antes** de registrar: `sendAnchor(tarefas, usedAnchors(children, sends), askingAnchors(waits))` (`hooks/panel.ts:129–170`).
- `children`: a sessão destino ganha uma rodada `{ at, anchor }`. Se ela não está na lista e `to` começa com `local_`, ganha uma entrada nova.
- `sends`: grava `{ to, anchor, at }`, mais `delivered: true` quando o resultado **não** casa com `/queued|held|pending/` ou casa com `/turn has started/`. Um envio que falhou (`isError` ou `success: false`) não grava.
- A tarefa-âncora vira **tarefa de mensagem** (`msg: true`): fica fora das contagens x/y e dos chips.
- Na fila, o resultado ao modelo ganha a nota "a mensagem para X ainda está na fila…".

**Entrega** (`hooks/sessions.ts` `watchSends`, l. 104–167, chamada por `refreshChildren`):
- `refreshChildren` roda no `session.start`, a cada 3 s pelo `poller` (`clock.every`), em `refreshStale` (uma chamada de ferramenta depois de 3 s) e **num aviso do app** (`prompt-submit.ts:68`).
- Lê `list_sessions` (`io/host.ts:31`) e o arquivo publicado da sessão destino (`readPublished`, em `<USERPROFILE|HOME>/.claude/task-tree-waits/<id>.json`, via `$.fs.read`).
- Se o arquivo traz `received` com `from === eu` (`selfId`, via `get_session self`) e `at ≥ s.at`, marca o envio `taken`. Arquivos antigos, sem `received`, usam turnos do arquivo ou o running.
- Com o envio tomado, a tarefa-âncora aberta é **concluída sozinha** (`finish` + `settle`).

**Desenho** (`draw/layout.ts` l. 911–968, `hooks/render.tsx` l. 215–217, `draw/svg.ts` l. 31 e 319–322):
- `waitsOn` = envios **não tomados** ancorados na tarefa. Com algum, o tom é `sent`, antes de qualquer status (o ✉ vence o ✓ e o ✕).
- Estado da tarefa de mensagem: `queued` se há envio não tomado; senão `cut` se a tarefa está `interrupted`; senão `delivered`.
- No terminal: o glifo `✉` com a cor `MSG_TERM` (`queued` → `permission`, `delivered` → `success`, `cut` → `inactive`) e a palavra à direita (`MSG_WORD`: "na fila", "entregue", "interrompida").
- Nível 1 de pedido aberto por mensagem de outra sessão (`Turn.msg`, `recvOf`): `recv` = `queued` aberto, `delivered` concluído, `cut` interrompido, com o mesmo ✉ e as mesmas cores.

**Âncora** (`sendAnchor`):
1. Folhas iniciadas e abertas, tirando as que têm pergunta aberta (`asking`).
   - Se só uma não pergunta e há mais de uma iniciada, vai a ela.
   - Se há várias, vai às livres (sem envio desde o próprio `startedAt`), no **lote** dos starts até 3 s antes do mais novo, a primeira do lote.
2. Nada iniciado e aberto: no pedido atual, a **pendente planejada por último** (empate: a última na ordem); sem pendente, a **última iniciada**; senão, a última do pedido.
3. Com trabalho em andamento: o `current().anchor`, ou uma pendente planejada **depois** do início dela ("planejei o envio e mandei sem start").

## 2. Regras, código e origem

| id | Confere no código | Origem resolvida |
|---|---|---|
| `envios.fica-ate-entrega` | sim (`waitsOn` vence o ✓; concluída sozinha na entrega) | decisão do usuário, 2026-10-23 ("não mostre como interrompida, deixe como mensagem até ela ser entregue"); commit `109b92d` |
| `envios.cor-por-estado` | sim (`MSG_TERM`/`MSG_WORD`) | decisão do usuário, 2026-10-24 ("mantenha o ícone e troque somente a cor"); commit `8eb801c` |
| `envios.ancora-no-lote-recente` | sim (lote de 3 s, livres, `asking` fora) | decisão do usuário, 2026-10-24 (nota `analise-task-tree-ancora-envio-recente`); commit `26adf08` |
| `envios.sem-tarefa-em-andamento-ancora-na-ultima-iniciada` | **desatualizada**: hoje é a pendente planejada por último do pedido atual e, sem pendente, a última iniciada | decisão do usuário, 2026-10-23 (nota `analise-task-tree-ancora-envio`: "Várias pendentes: a última planejada. Nenhuma pendente: última iniciada"); commits `b742294` → `5f3df6e` |
| `envios.fila-nao-interrompe-no-fim-do-turno` | sim (`halt` poupa a folha com envio; o tom `sent` vem antes) | decisão do usuário, 2026-10-24; commit `b897cac` |
| `envios.mensagens-juntas-vao-a-ultima` | sim, mas é posição de **cartão** de filha (`split`/rodadas) | commit `8b67366`, 2026-10-23 → passa para `sessoes` (tarefa 5) |
| `envios.nivel1-recebido-mostra-carta` | sim (`recv`) | decisão do usuário, 2026-10-24 ("o ícone do 'analisar a tarefa' deveria ser uma carta também"); commit `83f715d` |
| `pedidos.replano-mantem-envio-ate-entrega` | sim (`carry` mantém `kept`; `rows` esconde depois da entrega) | decisão do usuário, 2026-10-27; commit `fbf3c5c` |

## 3. Helpers novos (mínimos)

`tests/kit/ambiente.ts`:
```ts
// O host do app desktop: esta sessão, as sessões que ela abriu e o arquivo que cada uma publica.
// `recebeu` simula a outra sessão tomando a mensagem (o `received` do arquivo dela).
// Chamar antes da primeira chamada a $.
export const EU = 'local_00000000-0000-0000-0000-00000000e0e0'
export type Host = { recebeu(id: string, at: number): void }
export function host(on: any, sessoes: { id: string; nome?: string; rodando?: boolean }[]): Host
```

Stubs (os nomes dos campos do evento estão a conferir no tipo `Args<'mcp.call'>` e `Args<'fs.read'>`):
- `on('mcp.call', …)`:
  - `get_session` → `{ content: [{ type: 'text', text: JSON.stringify({ sessionId: EU }) }] }`;
  - `list_sessions` → a lista `[{ sessionId, name, title, isRunning, startedBy: EU }]`;
  - outras ferramentas → resposta vazia.
- `mock.env(on, { USERPROFILE: 'C:/u' })`.
- `on('fs.read', (_$, e) => …)`: para `.../task-tree-waits/<id>.json`, devolve `JSON.stringify({ version: 1, waiting: false, waits: [], children: [], groups: [], received: [...] })`; para outro caminho, `{ deny }`.
- `on('fs.write', () => ({ value: undefined }))`: a publicação do próprio painel.
- Se o kit não aceitar `mock.env` junto de `fixar`, usar `on('env.get')`.

```ts
// O host responde o SendMessage: 'fila' (queued) ou 'entregue' (a sessão começou a tratar).
// Chamar antes da primeira chamada a $; `modo` muda entre envios.
export function responderEnvio(on: any): { modo: 'fila' | 'entregue' }
```
O stub `on('tool.call', { tool: 'SendMessage' }, …)` devolve:
- fila: `{ result: '{"success":true,"message":"Message queued; it will be delivered when the session is idle"}' }`;
- entregue: `{ result: '{"success":true,"message":"Message delivered; its turn has started on it"}' }`.

`tests/kit/cenario.ts`:
```ts
// O modelo manda uma mensagem a outra sessão (SendMessage); o stub está em responderEnvio.
export const envio = ($: any, para: string, texto = 'oi') => ferramenta($, 'SendMessage', { to: para, message: texto })
// Uma mensagem de outra sessão: abre um pedido marcado como recebido.
export const mensagemDe = ($: any, de: string, texto: string) =>
  $.prompt.submit({ text: `<cross-session-message from="${de}" name="outra">${texto}</cross-session-message>` })
```
`lembretes.test.ts` usa essa mensagem inline. Pode passar a usar `mensagemDe`; é opcional, sem mudar a asserção.

`tests/kit/leitura.ts`:
- `Linha` ganha `carta?: 'fila' | 'entregue' | 'interrompida'`.
- O ícone da linha passa a ser também o `✉`. Nesse caso, `estado` fica indefinido e `carta` sai da cor do elemento do ícone (`props.color`: `permission` → fila, `success` → entregue, `inactive` → interrompida). A cor fica no `Text` do glifo, ou dentro do `Button` quando a linha dobra: procurar o primeiro `Text` com cor dentro do ícone.
- Novo `esperarCarta(linhas, titulo, carta)`, como `esperarEstado`, com o painel em texto na falha.
- Os testes existentes não mudam: só as linhas com ✉ ganham `carta`.

## 4. Testes (`tests/envios.test.ts`)

Roteiro comum: `fixar(on)`, `const h = host(on, [{ id: 'local_x', rodando: true }])`, `const env = responderEnvio(on)`, `pedido($, 'Pedido um')`, `plan(A)` com A › {Um, Dois}.

Cada teste com `// Regra:` acima:

1. **O ✉ na fila fica na tarefa, mesmo concluída, até a entrega** (`envios.fica-ate-entrega`, `envios.cor-por-estado`):
   - `start 1`, `envio('local_x')` em modo fila → "Um" com `carta` `fila` e o texto da linha com "na fila";
   - `done 1` → "Um" segue `fila`, não ✓;
   - `h.recebeu('local_x', AGORA)`, `aviso($)` → "Um" `entregue`, com "entregue" no texto.
2. **Entregue na hora, o ✉ segue até a outra sessão tomar a mensagem** (`envios.fica-ate-entrega`): modo `entregue`, `start 1`, `envio` → "Um" `fila`; `recebeu` + `aviso` → `entregue`, e "Um" concluída sozinha (sem `done`), com o cabeçalho sem contá-la (tarefa de mensagem). O azul aqui é a **dúvida 1**: o teste fixa o comportamento de hoje, e muda se o usuário decidir diferente.
3. **Mensagem interrompida fica cinza** (`envios.cor-por-estado`):
   - `start 1`, `envio` fila, `fimDoTurno`, `advance(1000)`;
   - `pedido('Pedido dois')`, `plan(A com título 'Plano A novo')`: o anterior é interrompido e renomeado, com o envio;
   - `recebeu` + `aviso` → a linha "Um" do pedido um com `carta` `interrompida` e "interrompida" no texto.
   - Se o comportamento divergir (por exemplo, a âncora renomeada não casar), **não ajustar**: marcar pendente e relatar.
4. **O envio na fila não vira interrompido no fim do turno** (`envios.fila-nao-interrompe-no-fim-do-turno`): `start 1`, `envio` fila, `esc($)` → "Um" `fila`, nenhuma linha ✕; o mesmo com `fimDoTurno`, num teste ou em dois passos do mesmo teste.
5. **O envio vai ao lote recente de starts sem envio** (`envios.ancora-no-lote-recente`):
   - `start 1`, `start 2` (mesmo instante);
   - `envio('local_x')` → "Um" com ✉;
   - `envio('local_y')`, com a sessão `local_y` no host → "Dois" com ✉.
6. **A tarefa antiga só depois do lote recente** (`envios.ancora-no-lote-recente`): plano com três folhas; `start 1`, `advance(10_000)`, `start 2` → `envio` vai a "Dois", e "Um" fica sem ✉.
7. **Nunca na tarefa com pergunta aberta** (`envios.ancora-no-lote-recente`):
   - `start 1`, `start 2`;
   - pergunta aberta a partir de "Dois", com `responderDepois` e o padrão `settle`/`advance` de `perguntas.test.ts`: o `start` em Dois por último deixa a âncora da pergunta em Dois;
   - com a pergunta pendente, `envio` → vai a "Um", e "Dois" sem ✉;
   - depois, `advance` e `await` da pergunta.
8. **Sem tarefa em andamento, o envio vai à pendente planejada por último** (regra reescrita, id novo `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`): `start 1`, `done 1` → `envio` → "Dois" com ✉ ("Um" segue ✓ sem ✉).
9. **Sem pendente, vai à última iniciada** (mesmo id): plano C › {Um}, `start 1`, `done 1` → `envio` → "Um" com ✉ `fila`.
10. **O nível 1 aberto por mensagem recebida mostra a carta** (`envios.nivel1-recebido-mostra-carta`): `mensagemDe('local_x', 'Analise isto')`, `plan(R)` com R › {r1} → "Plano R" com `carta` `fila`; `start`/`done` r1 → "Plano R" `entregue`.
11. **A tarefa de mensagem que sai do plano fica até a entrega** (`pedidos.replano-mantem-envio-ate-entrega`): `start 1`, `envio` fila, `plan(A sem "Um")` → "Um" segue visível com `fila`; `recebeu` + `aviso` → nenhuma linha "Um".

## 5. Atualização do catálogo (no mesmo commit)

- `regras/envios.md`:
  - `fica-ate-entrega`, `cor-por-estado`, `ancora-no-lote-recente`, `fila-nao-interrompe-no-fim-do-turno` e `nivel1-recebido-mostra-carta` → `Estado: coberto`, com as origens da tabela da seção 2 (as citações nas palavras do usuário entram onde há);
  - `sem-tarefa-em-andamento-ancora-na-ultima-iniciada` é **substituída** por `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`:
    - Dado nada em andamento no pedido atual;
    - Quando sai uma mensagem;
    - Então ela vai à pendente planejada por último; sem pendente, à última iniciada;
    - Origem: decisão do usuário, 2026-10-23 ("Várias pendentes: a última planejada. Nenhuma pendente: última iniciada"); commits `b742294`, `5f3df6e`;
    - `Estado: coberto`;
  - `mensagens-juntas-vao-a-ultima` **sai** de `envios.md` e entra em `regras/sessoes.md` como `sessoes.mensagens-juntas-vao-a-ultima`, `Estado: pendente (sessoes)`, origem commit `8b67366`, 2026-10-23.
- `regras/pedidos.md`: `pedidos.replano-mantem-envio-ate-entrega` → `Estado: coberto`.
- Se algum teste ficar pendente por comportamento divergente, o cenário segue `pendente` com o motivo.

## 6. Checklist do app

- A cor pintada do ✉ (azul, verde, cinza) nos dois temas, e o "pulo" do ícone quando a cor muda.
- A entrega real: a sessão destino publicando `received` e a latência do poll (3 s).
- O ✉ no cartão da filha (a tarefa de mensagem dela) e o chip "aguardando sessão".
- O tooltip "Aguardando confirmação de …".

## 7. Dúvida para o usuário

1. **Entrega imediata:** quando a mensagem é entregue na hora (o app responde que a sessão "começou a tratar"), o ✉ aparece **azul "na fila"** até a outra sessão publicar que a recebeu. Normalmente isso leva poucos segundos, mas com uma sessão de versão antiga do mod pode demorar.
   - Isso está certo? Ou a entrega imediata já deveria aparecer verde "entregue"?
   - O teste 2 fixa o comportamento de hoje e muda conforme a resposta.

## 8. Riscos

- **Recarga do clone:** só arquivos de `tests/` e `regras/` mudam (nada do mod), então não há risco de recusar o módulo. Mesmo assim, escrever tudo de uma vez e rodar `npm run check`.
- **Nomes dos campos dos eventos `mcp.call`, `fs.read` e `env.get` no kit:** conferir nos tipos (`claude-code/index.d.ts`) antes de escrever o `host`. O kit falha nomeando o evento sem resposta.
- **Estado de módulo do mod** (`ownId`, `usedReceipts`, `home`): o módulo é recarregado a cada teste, então não vaza entre testes.
- **O `poller` de 3 s:** com `mock.clock`, ele só roda num `advance`. Os testes usam `aviso($)` para a releitura determinística; evitar `advance` grande depois de um envio sem querer a entrega.
- **Testes atuais sem `host`:** o `refreshChildren` falha em silêncio (lista indisponível) e mostra a linha "Sessões indisponíveis". Conferir que essa linha não quebra o `painel()` das outras áreas; hoje já passa.
- **Os testes 3 e 7** são os mais frágeis (renomeação com envio; pergunta pendente concorrente). Se o kit não os permitir, ficam pendentes com o motivo, sem ajustar a asserção.

## 9. Brief para a Implementação

Tarefa 4 do plano de automação, na branch `test/regressivos-automacao-testes`, depois de `58e91c2`. Um commit local. Sem push.

1. `tests/kit/ambiente.ts`: `EU`, `host(on, sessoes)` com `recebeu(id, at)`, e `responderEnvio(on)`, conforme a seção 3 (conferir os campos de `mcp.call`, `fs.read` e `env.get` nos tipos).
2. `tests/kit/cenario.ts`: `envio($, para, texto?)` e `mensagemDe($, de, texto)`.
3. `tests/kit/leitura.ts`: `carta` na `Linha` (ícone ✉ e a cor do elemento) e `esperarCarta`. Sem mudar o resultado dos testes existentes.
4. `tests/envios.test.ts` (novo): os testes 1 a 11 da seção 4, cada um com `// Regra:`.
5. `regras/envios.md`, `regras/sessoes.md` e `regras/pedidos.md`, conforme a seção 5.
6. Escrever tudo de uma vez e rodar `npm run check`. A etapa `regras` deve mostrar os cenários novos como cobertos.
7. Teste que divergir do esperado: **não ajustar**; marcar o cenário `pendente` com o motivo e relatar.

Commit: `test(task-tree): envios ✉ (fila até a entrega, cor por estado, âncora, fim do turno, recebida, replano)`, com `git commit -- task-tree/tests/kit/ambiente.ts task-tree/tests/kit/cenario.ts task-tree/tests/kit/leitura.ts task-tree/tests/envios.test.ts regras/envios.md regras/sessoes.md regras/pedidos.md`.

Relatar:
- o hash;
- o resumo do check (a linha do catálogo);
- os campos reais dos eventos do host;
- se os testes 3 e 7 passaram ou ficaram pendentes.

O usuário valida lendo:
- `tests/envios.test.ts`: os nomes dizem as regras de envio que ele decidiu;
- `regras/envios.md`: as origens resolvidas e a regra reescrita da âncora sem andamento;
- a resposta à dúvida 1.
