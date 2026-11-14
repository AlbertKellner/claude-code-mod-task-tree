# correcao-regressao · onde parei (pausa para reiniciar a máquina, 2026-10-22 23:34)

Branch `fix/painel-serie-2`, PR #14 (https://github.com/AlbertKellner/claude-code-mod-task-tree/pull/14).
Regra da série: uma correção por commit, feito pela governança; eu mando o sinal e espero o hash. TDD sempre
(teste vermelho primeiro, ver falhar pelo motivo certo, corrigir, suíte inteira, 2 rodadas).

## Feito (commitado)
1. `1423721` plan numa mensagem nova põe todos os níveis 1 no pedido novo.
2. `940746c` cada mensagem na fila fecha a sua tarefa só com a sua entrega (✉ pendente).

## Em commit pela governança (sinal enviado; esperar o hash)
3. Cartões abertos e sob a tarefa de origem; chave de recolher pelo horário da rodada; resumida = completa
   sem os pedidos finalizados (nunca move cartão); cobre os bugs A, F e H.
   Arquivos (estão modificados na pasta): `task-tree/draw/layout.ts`, `task-tree/types/index.d.ts`,
   `task-tree/tests/cartoes-lugar.test.ts` (novo), `task-tree/tests/layout.test.ts`,
   `task-tree/tests/task-tree.test.ts`, `task-tree/tests/resumida-turno.test.ts` + patch
   `correcao-regressao-serie2-3-desenvolvimento.patch` (8 hunks do DESENVOLVIMENTO.md). Suíte 345 pass.
   Ao retomar: conferir com `git log --oneline -1` que o commit 3 saiu e que a pasta só tem a seção local do
   DESENVOLVIMENTO.md, docs/analises/ e scripts/ fora de commit.

## Próximo: bug G (relógio depois de uma recarga) — teste vermelho pronto, correção não começada
- Teste: `correcao-regressao-retomada/relogio-recarga.test.ts` (cópia; o original estava em
  scratchpad/espera, que pode sumir no reinício). Copiar para `task-tree/tests/` ao retomar.
- Vermelho (na branch com o commit 3): "com uma tarefa cronometrando, o desenho da recarga já pede o relógio
  de 1 s, sem nenhum outro evento": `Expected: containing 1000`, `Received: []`
  (`correcao-regressao-retomada/vermelho-relogio.log`). O controle "sem nada cronometrando…" passa.
- Correção planejada: o `ui.render` (task-tree/hooks/render.tsx) chama `keepTime($)` e `watchSessions($)`
  de task-tree/hooks/sessions.ts (o kit não recusa `$.clock.every` durante o desenho; só `state.set`).
  Depois: suíte 2 rodadas, trecho da docs (keepTime/tick e a recarga), sinal à governança.
- Contexto: `correcao-regressao-serie2-g-painel-congelado.local.md` (medição do estado real: desenho pequeno,
  sem erro; render acompanha o estado; usuário: congelamento não reproduzido, coincidiu com recargas).

## Fila depois do G (todos com TDD, commit próprio ou junto se for a mesma raiz)
- C: um cartão só para várias mensagens, no pedido errado (talvez já resolvido em parte pelo commit 3:
  reconferir com o estado real; as mensagens de irmãs herdam a âncora da rodada da irmã — regra das cadeias).
- D: pai de tarefa ✉ aparece como não iniciado (círculo vazio, 0/1); linha ↩ "resposta" vazia (placeholder
  sem texto) — só mostrar ↩ com texto de verdade.
- B/E: cabeçalho mostra tarefa antiga e números de vários pedidos; deve mostrar a tarefa atual do pedido atual
  e os números dela (conferir `current()`/`lit` com ids reutilizados e o `shown` do cabeçalho).

## Ferramentas (cópias aqui em `correcao-regressao-retomada/`)
- `make_probe_g.py <scratchpad>`: monta uma cópia do mod com o estado publicado real da orquestradora como
  fixture (sonda do orçamento: tamanho/nós/profundidade/tempo; e um teste de `layout()` direto).
- `make_patch.py <diff> <saída> <início do hunk a tirar>`: patch do DESENVOLVIMENTO.md sem a seção local
  (melhor: tirar o hunk que contém "Rodar o mod a partir do clone", pelo conteúdo).
- Logs dos vermelhos: `vermelho-*.log`.
- `claude.exe`: `$APPDATA/Claude/claude-code/2.1.308/c17a819afb40/claude.exe` (`plugin validate task-tree`,
  `plugin test task-tree`).

## Atualização 23:3x: commit 3 confirmado — continuo em pausa
- Commit 3 feito pela governança: `3a762a9` (fix(task-tree): cartão de sessão fica aberto e sob a tarefa que
  mandou a mensagem). Push feito; PR #14 atualizado. A pasta deve estar só com a seção local do
  DESENVOLVIMENTO.md, docs/analises/ e scripts/ fora de commit.
- Aviso da governança: numa de 4 rodadas, 1 falha de tempo em "orçamento do desenho (estado real) >
  desktop/summary fica dentro da baseline" (5.185 ms contra o limite de 5 s do kit), não reproduzida nas 3
  seguintes. Ao retomar, olhar o custo desse teste (o `settled` + 3 medições por teste; talvez reduzir as
  repetições ou dar `timeoutMs` maior ao teste, sem afirmar tempo), como item próprio de TDD/estabilidade.
- Pausa pedida pelo usuário (via orquestradora): não começar o G até a mensagem da orquestradora depois do
  reinício. Nada foi tocado no repositório depois do sinal do commit 3.
