# correcao-regressao · bug: a visão resumida mantinha os pedidos concluídos de rodadas anteriores

Sessão `correcao-regressao` (Opus 5.5, médio). Branch `fix/resumida-so-tarefas-do-turno`, sobre a
`main` `20daa8e` (sem as mudanças do PR #12). 2026-10-22. TDD (regra do usuário).

## Sintoma
Ao começar uma rodada nova (mensagem nova do usuário), a resumida mostrava "+3 pedidos anteriores" e
três pedidos concluídos acima do novo. Regra do usuário: "segundo a regra antiga, na visão resumida,
ficam somente as tarefas novas do turno" (mais o que ainda está em andamento).

## Causa (não é regressão: já existia na 0.7.3)
`startsWork` (task-tree/hooks/panel.ts) só começava trabalho novo com `nothingOpen`: nenhuma folha
aberta no painel inteiro, sessões filhas incluídas (`activeLeaves`). Uma filha parada com uma tarefa
esquecida aberta fazia todo pedido novo entrar no trabalho atual. No estado real da orquestradora: a
docs-task-tree, parada, tem a folha "3" aberta; `work` = 11 níveis 1 de 6 pedidos.
Comparação: os testes novos falham igual em `5a5d2f7` (fase 5) e `20daa8e` (fase 6), 3 de 4.

## Correção
- `startsWork`: `ensureGroups`/`ensureWork` primeiro (restauração do store após recarga); com turnos,
  trabalho novo a cada mensagem nova do usuário (o trabalho atual não tem nível 1 do turno atual);
  no mesmo turno, soma; sem turnos, regra antiga (`nothingOpen`).
- `joinWork` com fresh: `goingOn(trabalho anterior)` + ids novos.
- `goingOn(p, ids)` (task-tree/draw/layout.ts, nova): os níveis 1 com algo aberto. Uma sessão viva sob
  tarefa concluída não segura a tarefa (a resumida já põe a sessão viva no fim: regra anterior mantida).
- Durante a correção: uma primeira versão (1) lia os grupos antes de restaurar do store e quebrou
  "reinício … o plan seguinte soma ao trabalho" (corrigido chamando `ensureGroups`/`ensureWork`
  primeiro) e (2) segurava a tarefa com sessão viva, o que quebrou "sessão viva sem tarefa no
  trabalho atual: aparece no fim da resumida" (regra anterior do usuário; desfeito).

## TDD: testes que falhavam antes (suíte na main com os 4 novos: 326 pass, 3 fail)
Arquivo novo `task-tree/tests/resumida-turno.test.ts`; a resumida desenhada antes da correção:
1. "dois pedidos concluídos e uma filha parada com folha aberta: o pedido novo aparece sozinho":
   esperado sem "Segundo pedido feito"; recebido `✓ primeiro pedido … └─ ✓ Abrir a filha … ⑂ filha
   parada … ✓ segundo pedido … ├─ ✓ Segundo pedido feito … ◉ terceiro pedido` (Expected false, Received true).
2. "um pedido anterior com tarefa ainda aberta continua; o concluído sai": recebido também
   `✓ primeiro pedido … Abrir a filha` (Expected false, Received true).
3. "uma sessão ainda trabalhando sob uma tarefa concluída…": recebido `✓ segundo pedido … Segundo
   pedido feito` (Expected false, Received true). (Expectativa final ajustada à regra da sessão viva no
   fim; o vermelho foi pelos pedidos concluídos, que continuam testados.)
4. "no mesmo pedido, um plano depois de tudo concluído soma" — passava antes e depois (controle).
Depois: a resumida dos três mostra só o pedido novo (+ "Ainda aberto" no 2; + "⑂ filha / Trabalho da
filha" no fim no 3).

## Testes
329 pass / 0 fail em 3 rodadas; `validate` ok; 0 GOLDEN-NEW, 0 TEXTOS-NEW; orçamento na baseline nas
rodadas 1 e 3 (rodada 2: −28 bytes nas quatro, o artefato do relógio do teste, já registrado).
A visão completa não muda (goldens iguais).

## Efeito no painel do usuário
O `work` já acumulado corrige no próximo `plan`/`start` de um pedido novo: ficam só os níveis 1 com
algo aberto e os novos.

## Commit sugerido
Arquivos: `task-tree/hooks/panel.ts`, `task-tree/draw/layout.ts`, `task-tree/tests/resumida-turno.test.ts`
(novo) + patch dos hunks da docs-task-tree no DESENVOLVIMENTO.md.
Mensagem: `fix(task-tree): a visão resumida mostra só o pedido atual e o que ainda está aberto`

## Documentação e sinal
- docs-task-tree: 6 hunks no DESENVOLVIMENTO.md (+19/−10): módulos (panel.ts, layout.ts `goingOn`),
  tabela dos hooks (planTool), testes 325 → 329 e linha `resumida-turno.test.ts | 4`, parágrafo
  "Trabalho atual" do histórico. Patch sem a seção local:
  `correcao-regressao-bug-resumida-desenvolvimento.patch` nesta pasta, `git apply --cached --check` ok.
- Sinal do commit enviado à governança com os 3 arquivos + o patch, a mensagem e os testes vermelhos.
