# Esc depois de uma entrega imediata: o ✉ segue verde (plano de correção)

Base: branch `test/regressivos-automacao-testes`, topo `15474a1`. Nada foi editado.

## Essencial

- **Causa:** em `draw/layout.ts`, `halt` (l. 50–64) só poupa a folha cujo envio está **na fila** (`sent` = âncoras de envios não `taken`, l. 874).
  - Na entrega imediata, o envio já sai `taken` e, no próximo prompt ou chamada, é até **removido** do estado (`takenNote`).
  - No Esc (`aborted`), a tarefa de mensagem iniciada e aberta passa por `interrupt` e fica `interrupted`.
  - O estado da carta (`layout.ts` ~l. 953) vira então `cut`: ✉ cinza "interrompida".
- **Regra proposta:** no fim do turno, normal ou com Esc, uma **tarefa de mensagem** (`msg`) aberta nunca é interrompida pelo `halt`. Ela fica como no fim normal: aberta, relógio parado, ✉ **verde "entregue"**.
  - Só isso muda.
  - As tarefas de mensagem interrompidas **no estado** continuam cinza: plano substituído por pedido novo (teste 3), subagente que terminou, sessão arquivada.
- A mudança é **uma linha em `halt`**, mais o comentário.
- Contagens, chips e arquivo publicado: sem impacto. O cartão da filha segue a mesma regra, porque `panelOf` usa `halt`.
- **Não contradiz decisões:** "Esc: só a iniciada vira ✕" ganha a exceção que o usuário acabou de decidir (a mensagem entregue não é interrompida); o pai continua nunca ✕ com algo feito ou aberto embaixo.

## 1. Como é hoje

- **Desenho do fim de turno** (`layout.ts:874–876`): `held = halt(ended, sentFrom, model.aborted === true)` no grupo principal; `sentFrom` = âncoras dos envios **não tomados**.
- **`halt`, numa folha aberta:**
  - âncora de envio na fila → intacta;
  - iniciada e não `aborted` → aberta com o relógio parado (◷);
  - iniciada e `aborted` → `interrupt`;
  - nunca iniciada → intacta (○).
- **Entrega imediata** (`15474a1`): o envio fica `{ delivered: true, taken: true }`, e a tarefa segue aberta e iniciada, com `msg: true`, até o `done`. `takenNote` tira o envio do estado na chamada ou prompt seguinte. Depois disso, **a única marca que fica é `msg` na tarefa.**
- **Carta** (~l. 953): `waitsOn > 0` → `queued` (azul); `status === 'interrupted'` → `cut` (cinza); senão `delivered` (verde). O ✉ substitui o glifo em qualquer estado.
- **Resultados de hoje:**
  - fim normal depois da entrega imediata: a tarefa fica aberta com o relógio parado (`leftWaiting`); a carta `delivered` mostra ✉ verde com a palavra "entregue"; o pai e o pedido ficam ◷ (`resting` conta `leftWaiting`). **Coerente.**
  - Esc depois da entrega imediata: a tarefa vira `interrupted` → ✉ cinza "interrompida". **É o bug.**

## 2. Regra exata

No fim do turno (`halt`, na sessão principal e no cartão de filha via `panelOf`):

| Folha aberta | Fim normal | Esc |
|---|---|---|
| Tarefa de mensagem com envio na fila | intacta (✉ azul) | intacta (✉ azul) — como hoje |
| **Tarefa de mensagem (`msg`) sem envio na fila** (entregue) | aberta, relógio parado (✉ verde "entregue") | **igual ao fim normal** (✉ verde "entregue") — muda |
| Outra iniciada | ◷ | ✕ — como hoje |
| Nunca iniciada | ○ | ○ — como hoje |

Pai: como hoje.
- Com a tarefa de mensagem aberta embaixo, `hasOpen(children)` → o pai fica aberto (◷ se tem algo feito ou aguardando embaixo, ○ se não), nunca ✕.
- A tarefa de mensagem aberta com relógio parado conta como "deixada aguardando" (`leftWaiting`) para o pai, como no fim normal.

Continuam cinza, porque ficam `interrupted` **no estado** e não pelo `halt`:
- plano substituído por pedido novo (`tools.ts`, `away`);
- subagente que terminou (`turn.ts`);
- sessão arquivada (`panelOf`, `interrupt`).

O teste 3 de envios ("a mensagem de um plano interrompido fica cinza depois da entrega") segue passando.

## 3. Mudança

`task-tree/draw/layout.ts`, em `halt`, na folha:
```ts
const begun = t.started !== undefined || t.startedAt !== undefined
// A message task (its message delivered, or queued: spared above) is not this turn's work to
// interrupt: a stop leaves it as a normal end does, ✉ green (the person, 2026-10-28).
if (begun && (!aborted || t.msg)) return { ...t, started: undefined, endedAt: stop(t, at) }
return begun ? interrupt(at)(t) : t
```
Acrescentar ao comentário de `halt` (l. 34–49) uma frase: a tarefa de mensagem não é interrompida por um turno parado; fica como no fim normal, com o ✉ verde.

Nada mais muda:
- `render.tsx`: o chip e o glifo já vêm da carta;
- `io/publish.ts`: `halt` é desenho, e o arquivo publica o estado cru;
- `hooks/turn.ts`, `hooks/tool-call.ts`.

## 4. Impacto

- **Contagens e chips:** a tarefa de mensagem fica fora de x/y e de todos os chips (`count()` e `open` em `render.tsx` ignoram `msg`), então nada muda.
- **Tom do pai e do pedido:** no Esc, antes, a tarefa de mensagem ✕ fazia o pai sem nada feito virar ✕ (`interrupt`, sem filha aberta nem concluída). Agora o pai fica aberto (◷), como no fim normal. É coerente com "pai nunca ✕ com algo feito ou aberto embaixo".
- **Cartão da filha:** `panelOf` usa `halt(..., c.aborted)`. Uma filha parada com Esc depois de uma entrega imediata mostra o ✉ verde no cartão, como no próprio painel dela.
- **Arquivo publicado:** sem mudança (estado cru).
- **Próximo prompt:** `wake` limpa `turnEnded`, e o desenho volta ao estado cru: a tarefa aberta e iniciada com ✉ verde, como antes do Esc.

## 5. Testes (no mesmo commit, `tests/envios.test.ts`)

1. **Reativar o teste comentado** (l. 208–226), com `// Regra: envios.esc-apos-entrega-imediata` e o nome "depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem". Ele espera:
   - depois de `fimDoTurno`: "Um" `entregue`;
   - depois de `esc`: "Um" `entregue`, e nenhuma linha com "interrompida".
2. **Acrescentar ao mesmo teste, ou num separado:** o pai segue aberto no Esc. Com o plano A › {Um, Dois}: "Plano A" não está `interrompida` (`expect(linha(p, 'Plano A').estado).not.toBe('interrompida')`) e "Dois" segue `pendente`.
3. **Não-regressão**, sem mudança:
   - teste 3 ("plano interrompido fica cinza");
   - teste do fim do turno com fila ("o envio na fila não vira interrompido…");
   - "Esc interrompe só a tarefa iniciada" em `turnos.test.ts`, onde uma tarefa comum segue ✕.
4. **Fim normal**, já coberto pela primeira metade do teste 1: ✉ verde depois de `fimDoTurno`.

Catálogo (`regras/envios.md`), `envios.esc-apos-entrega-imediata`:
- Dado uma tarefa de mensagem em andamento cuja mensagem foi entregue na hora;
- Quando o turno termina, normal ou com Esc;
- Então o ✉ segue verde "entregue", a tarefa não é interrompida e o pai não vira ✕;
- Origem: decisão do usuário, 2026-10-28 ("a mensagem foi entregue; não é interrompida");
- `Estado: coberto`.

## 6. Riscos

- **Recarga do clone:** um arquivo do mod (`draw/layout.ts`), mais o teste e o catálogo. Escrever os três de uma vez e rodar `npm run check`.
- **Tarefa de mensagem de versão antiga, ou de um envio que nunca chegou** (aberta, `msg`, sem envio): também deixa de ser interrompida no Esc. Hoje só a entrega imediata deixa uma tarefa `msg` aberta sem envio; a fila conclui a tarefa na recepção. É aceitável e coerente: o envio saiu.
- **Interação com `pedidos.replano-mantem-envio-ate-entrega`** (`kept`): a tarefa mantida tem envio na fila e já é poupada antes. Sem mudança.

## 7. O que o usuário valida no app

1. Mandar uma mensagem a uma sessão parada (✉ verde) e apertar Esc antes do `done`: o ✉ segue verde "entregue", e nada fica ✕.
2. O mesmo com fim normal do turno: ✉ verde, e o pai ◷.
3. Uma tarefa comum em andamento com Esc: segue ✕.
4. Uma mensagem na fila com Esc: segue azul.

## Brief para a Implementação

Commit separado na branch `test/regressivos-automacao-testes`, depois de `15474a1`. Sem push.

1. `task-tree/draw/layout.ts`: em `halt`, `if (begun && (!aborted || t.msg))` em vez de `if (begun && !aborted)`, com o comentário da seção 3, e acrescentar a frase ao comentário de `halt`.
2. `task-tree/tests/envios.test.ts`: reativar o teste pendente com `// Regra: envios.esc-apos-entrega-imediata` e a asserção do pai (seção 5), e tirar o comentário "PENDENTE".
3. `regras/envios.md`: `envios.esc-apos-entrega-imediata` → coberto, com o texto da seção 5.
4. Escrever os três de uma vez e rodar `npm run check`: todos verdes, incluindo o teste 3 de envios e o "Esc interrompe só a tarefa iniciada" de `turnos`.

Commit: `fix(task-tree): Esc depois de uma entrega imediata mantém o ✉ verde (tarefa de mensagem não é interrompida)`, com `git commit -- task-tree/draw/layout.ts task-tree/tests/envios.test.ts regras/envios.md`.

Relatar o hash, o resumo do check e o estado do pai no Esc.
