# Governança task-tree: PR

- PR: https://github.com/AlbertKellner/claude-code-mod-task-tree/pull/4 (branch `feature/ordem-e-cartoes-por-mensagem` → `main`)
- Commit: 4af1b92
- Labels: enhancement e documentation (já existiam); task-tree (criada nesta etapa)
- Arquivos: register.tsx, types/index.d.ts, tests/task-tree.test.ts, docs/task-tree-proposta-visual.svg, DESENVOLVIMENTO.md
- No DESENVOLVIMENTO.md entrou só o trecho desta tarefa (hunk @@ -163). A seção "Rodar o mod a partir do clone", que ainda não estava commitada e cita `scripts/origem-task-tree.mjs` (pasta não rastreada), ficou fora do commit e continua modificada na cópia local.
- A cópia local agora está na branch nova, não na `main`.
- Não verificado: testes (não rodaram), aparência do SVG na tela, versão do plugin (continua 0.7.4).

## Acréscimo
- Commit 814468c: filha parada com tarefa aberta (trecho do DESENVOLVIMENTO.md + SVG). O código e os testes já estavam no 4af1b92. Descrição do PR ganhou o item 4; título e labels mantidos.
- Commit cb2c101: ✉ continua enquanto a mensagem está na fila (register.tsx, teste, trecho do DESENVOLVIMENTO.md). Descrição do PR ganhou o item 5; título e labels mantidos.
- Commit 450aa9f: tooltip com o nome inteiro (register.tsx, teste, trecho do DESENVOLVIMENTO.md). Descrição do PR ganhou o item 6.
- Commit 5508b25: sendAnchor (register.tsx, teste, trecho do DESENVOLVIMENTO.md). Descrição do PR ganhou o item 7.
- Commit afdb8a1: nada recolhe sozinho (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do PR ganhou o item 8.
- Commit 47270cc: cartão igual ao painel da filha (register.tsx, types, teste, DESENVOLVIMENTO.md; SVG sem mudança). Descrição do PR ganhou o item 9.
- Commit 9a794f0: texto da seta no DESENVOLVIMENTO.md (o código já estava no 47270cc). Item 6 da descrição do PR ganhou a seta.
- Commit 8c0ffa1: tarefa de envio fecha sozinha (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do PR ganhou o item 10.
- Commit 25e9f32: linha com relógio não pisca (teste + DESENVOLVIMENTO.md; o código do hoverLayer foi no 8c0ffa1). Item 6 da descrição do PR atualizado.
- Commit 4bef852: cadeia sob a tarefa de origem (register.tsx, teste, DESENVOLVIMENTO.md). Descrição do PR ganhou o item 11.
- Commit 0ff2b17: cartões em ordem de execução (register.tsx, teste, DESENVOLVIMENTO.md). Descrição do PR ganhou o item 12.
- Commit d53d7f0: README com o prompt de atualização. Descrição do PR ganhou o item 13 e o README na lista de arquivos; labels mantidas (documentation já cobre).
- Commit 37925f4: nome da sessão em linha própria (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do PR ganhou o item 14.
- Commit 71b6970: recolher pelo ícone (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do PR ganhou o item 15.
- Commit 5ee051d: nome da sessão como rótulo solto (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do PR ganhou o item 16.

## PR #5 (após o merge do #4)
- #4 mergeado em 22:22:26Z (merge 2a7074f, head d53d7f0). Os commits 37925f4, 71b6970 e 5ee051d foram aplicados com cherry-pick em fix/cartao-da-filha-rotulo-e-recolher (42edfce, 8fc6ac8, 135e17e).
- PR #5: https://github.com/AlbertKellner/claude-code-mod-task-tree/pull/5 (labels enhancement, documentation, task-tree)
- PR #4: descrição de volta aos itens 1 a 13 (última edição antes do merge: 19:57:49Z); título igual ao do merge.
- A pasta agora está em fix/cartao-da-filha-rotulo-e-recolher. Na troca, register.tsx e o teste, alterados e ainda sem commit, foram junto sem perda.
- Os próximos sinais vão para o PR #5.
- Commit 6af2b20 (PR #5): ícone alinhado e conector no cartão (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do #5 ganhou o item 4. O sinal pedia o PR #4, mas este commit foi para o #5, como a principal mandou.
- Commit 8a46908 (PR #5): layout restaurado (register.tsx, teste, DESENVOLVIMENTO.md). O SVG já estava no 6af2b20. Descrição do #5 ganhou o item 5.
- Commit f632502 (PR #5): a linha inteira recolhe (register.tsx, teste, DESENVOLVIMENTO.md, descrição do SVG). Descrição do #5 ganhou o item 6.
- Commit 12d2296 (PR #5): botão nativo cobre a linha inteira (register.tsx, teste, DESENVOLVIMENTO.md). Item 6 da descrição do #5 complementado; "Não verificado" ganhou o clique no app.
- Commit 7c734de (PR #5): ✉ em todo envio (register.tsx, types, teste, DESENVOLVIMENTO.md). Descrição do #5 ganhou o item 7 e types/index.d.ts na lista de arquivos.
- Commit 2994dbf (PR #5): cartão novo nasce sob a tarefa de origem (register.tsx, teste, DESENVOLVIMENTO.md). Descrição do #5 ganhou o item 8.
- Commit c0f37c4 (PR #5): só o ícone recolhe; ⑂ à esquerda (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Descrição do #5 ganhou o item 9, e o item 6 foi marcado como substituído.
- Commit 76f1411 (PR #5): anel de contexto só no cartão + testes que faltaram no c0f37c4 (teste, DESENVOLVIMENTO.md, SVG). Testes no HEAD: 141 pass, 0 fail. Descrição do #5 ganhou o item 10 e o resultado dos testes.
- Commit 9c054f8 (PR #5): aviso de etapas fechadas juntas sem start (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 143 pass, 0 fail. Descrição do #5 ganhou o item 11.
- Commit 7b55570 (PR #5): resposta da sessão (↩) (register.tsx, types, teste, DESENVOLVIMENTO.md, SVG). Testes: 145 pass, 0 fail. Descrição do #5 ganhou o item 12.
- Commit 7045b3c (PR #5): ↩ também no painel da própria sessão (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Testes: 147 pass, 0 fail. Item 12 da descrição do #5 complementado.
- Commit bbf9a64 (PR #5): id curto vai para a tarefa aberta (teste + DESENVOLVIMENTO.md; o resolve() foi no 7045b3c). Testes: 147 pass, 0 fail. Descrição do #5 ganhou o item 13.
- Commit 926fb44 (PR #5): ligações persistidas (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 149 pass, 1 fail (on("mcp.call") registered twice); avisei a codigo-task-tree. Descrição do #5 ganhou o item 14 e a falha.
- Commit 9316e4b (PR #5): sem ↩ em grupo com cartão de filha (teste, DESENVOLVIMENTO.md, SVG; o turnRows foi no 926fb44). Testes: 150 pass, 0 fail. Item 12 da descrição do #5 complementado; a falha registrada no 926fb44 foi resolvida.
- Commit 946f653 (PR #5): ↩ com resumo de até 60 caracteres (register.tsx, types, teste, DESENVOLVIMENTO.md, SVG). Testes: 151 pass, 0 fail. Item 12 da descrição do #5 complementado.
- Commit 3f06a32 (PR #5): ↩ só com o resumo da própria sessão (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Testes: 151 pass, 0 fail. Item 12 da descrição do #5 ajustado.
- Commit 9f030ac (PR #5): anel de contexto clicável abre a sessão (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 152 pass, 0 fail. Descrição do #5 ganhou o item 15.
- Commit 45a02e6 (PR #5): resumo do ↩ com até 120 caracteres (register.tsx, types, DESENVOLVIMENTO.md, SVG; o teste não tinha mudança nova). Testes: 152 pass, 0 fail. Item 12 da descrição do #5 ajustado.
- Commit fa4effe (PR #5): anel de contexto em todo cartão (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Testes: 153 pass, 0 fail. Descrição do #5 ganhou o item 16.
- Commit 288b63b (PR #5): níveis 1 sob o cabeçalho do pedido (register.tsx, teste, DESENVOLVIMENTO.md, SVG). Testes: 154 pass, 0 fail. Descrição do #5 ganhou o item 17.
- Commit 0651d8c (PR #5): breaks() sem travar o worker (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 155 pass, 0 fail. Descrição do #5 ganhou o item 18.
- Commit 6616343 (PR #5): mensagem sem rodada + hover do anel inteiro (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 156 pass, 0 fail. O commit da mensagem sem rodada esperou a falha do teste do anel ser corrigida. Descrição do #5 ganhou os itens 19 e 20.
- Commit c808d40 (PR #5): anel no centro da caixa do botão (register.tsx, teste, DESENVOLVIMENTO.md, descrição do SVG). Testes: 156 pass, 0 fail. Item 20 da descrição do #5 complementado.
- Commit c1bd3da (PR #5): caixa do botão do anel na largura do realce nativo (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 156 pass, 0 fail. Item 20 complementado; em "Não verificado" entrou a captura de tela do anel.
- Commit 5e5dc7d (PR #5): botão do anel na ponta direita (register.tsx, teste, DESENVOLVIMENTO.md). Testes: 156 pass, 0 fail. O usuário aprovou o resultado ("Sim, ficou certo"), então saiu de "Não verificado" o item da captura do anel.
- Commit d5b2e37 (PR #5): modelo e esforço no cartão (register.tsx, types, teste, DESENVOLVIMENTO.md, SVG). Testes: 159 pass, 0 fail. Descrição do #5 ganhou o item 21.
- Commit 4edb3f2 (PR #5): cliques por chave, painel na tela e desenho menor (register.tsx, teste, DESENVOLVIMENTO.md, descrição do SVG). Testes: 165 pass, 0 fail. Descrição do #5 ganhou os itens 22 a 24. A sessão trocou para Sonnet 5.5 e os commits daqui em diante levam essa linha de co-autoria.
- Commit 8ee40f8 (PR #5): cabeçalho soma só o que a visão desenha (register.tsx, teste, DESENVOLVIMENTO.md, descrição do SVG). Testes: 166 pass, 0 fail. Descrição do #5 ganhou o item 25.

## Nova branch após o merge do #5
- PR #5 MERGED em 2026-10-22T02:25:46Z, merge commit 6d79470 em origin/main (tree igual ao 8ee40f8).
- Pasta em feature/proximos-trabalhos (nome provisório), criada de origin/main, sem upstream e sem push. O push entra com o primeiro commit; se o nome mudar, renomear antes.
- Seguem na pasta, sem commit: a seção do clone em task-tree/DESENVOLVIMENTO.md (22 linhas) e scripts/origem-task-tree.mjs.
- fix/cartao-da-filha-rotulo-e-recolher (local e remota) mantida.

## Aviso para o R6 (testes da correção de regressões)
- Antes do primeiro push: git branch -m feature/proximos-trabalhos test/rede-de-protecao-regressoes; push com -u; sem PR (o usuário autorizou commit e push; PR só quando pedir).
- Suíte inteira e validação ANTES do commit; só commita com tudo verde. Se falhar, avisar correcao-regressao (local_2cc346a1-feae-4314-8217-2fd7adf79c9a) e a orquestradora.
- git commit -- <caminhos> só dos arquivos do sinal, conferindo o diff. Fora do commit: docs/analises/, seção do clone do DESENVOLVIMENTO.md, scripts/. Do DESENVOLVIMENTO.md só os hunks do R6.
- Mensagem do commit usa o checklist do R4 (docs/analises/03-recomendacoes.md).

## R6 (branch test/rede-de-protecao-regressoes, sem PR)
- Branch renomeada de feature/proximos-trabalhos; push com -u feito, sem PR (o usuário autorizou só commit e push).
- Commit 9c8acaf: teste de orçamento (task-tree/tests/orcamento.test.ts, tests/fixtures/orquestradora-real.ts, DESENVOLVIMENTO.md só com os hunks do R6). Testes antes do commit: 167 pass, 0 fail; claude plugin validate passou. Mensagem com o checklist do R4.
- Fora do commit, seguem na pasta: docs/analises/, scripts/ e a seção do clone do DESENVOLVIMENTO.md. SVG sem mudança (sinal do svg-task-tree).
- Commit c7a9ae2 (R7, branch test/rede-de-protecao-regressoes, push feito, sem PR): golden do SVG por tom (tests/svg-golden.test.ts, tests/golden/svg.ts e atualizar.mjs, DESENVOLVIMENTO.md só com os hunks do R7). Testes: 174 pass, 0 fail; validate ok. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança.
- Commit 836551f (R8, branch test/rede-de-protecao-regressoes, push feito, sem PR): testes de reinício e recarga (tests/reinicio.test.ts, DESENVOLVIMENTO.md só com os hunks do R8). Testes: 182 pass, 0 fail; validate ok. 3 bugs abertos na lista KNOWN do teste. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança.
- Commit 59eb558 (H6.1, branch test/rede-de-protecao-regressoes, push feito, sem PR): grupos voltam do store sem session.start (register.tsx, tests/reinicio.test.ts, DESENVOLVIMENTO.md só com os hunks da H6.1). Testes: 182 pass, 0 fail; validate ok. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança. A docs-task-tree constava "working" na hora; o diff conferido estava coerente.
- Commit 13ef0ef (H3.2, branch test/rede-de-protecao-regressoes, push feito, sem PR): ligações das filhas com lista parcial do host (register.tsx, tests/reinicio.test.ts, DESENVOLVIMENTO.md só com os hunks da H3.2). Testes: 182 pass, 0 fail; validate ok. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança.
- Commit bd00688 (bug 3, branch test/rede-de-protecao-regressoes, push feito, sem PR): lastBrief no state (register.tsx, types/index.d.ts, tests/reinicio.test.ts, DESENVOLVIMENTO.md só com os hunks do bug 3). Testes: 182 pass, 0 fail; validate ok. KNOWN agora vazio. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança.
- Commit 04fcae7 (R9, branch test/rede-de-protecao-regressoes, push feito, sem PR): contrato Published com version e leitura validada (register.tsx, types/index.d.ts, tests/publicado.test.ts, DESENVOLVIMENTO.md só com os hunks do R9). Testes: 190 pass, 0 fail; validate ok. Fora do commit: docs/analises/, scripts/, seção do clone. SVG sem mudança.
- Commit 1d55fa0 (R15, branch test/rede-de-protecao-regressoes, push feito, sem PR): limite de 400 linhas (docs/task-tree-proposta-visual.svg só a <desc>, register.tsx, types/index.d.ts, tests/limite-linhas.test.ts, tests/task-tree.test.ts, DESENVOLVIMENTO.md só com os hunks do R15). Testes: 194 pass, 0 fail; validate ok; XML do SVG válido, render não conferido. Fora do commit: docs/analises/, scripts/, seção do clone.

## Aviso para o R20 (fecha a fase 1)
- Depois do commit e do push do R20, abrir o PR de test/rede-de-protecao-regressoes para a main, com gh (MCP do GitHub com token recusado). Autorização: "Libere e abra um PR".
- Título descreve a fase 1 (ex.: "test(task-tree): rede de proteção contra regressões (fase 1)"). Descrição: cada item com o commit (R6 9c8acaf, R7 c7a9ae2, R8 836551f, H6.1 59eb558, H3.2 13ef0ef, lastBrief bd00688, R9 04fcae7, R15 1d55fa0, R20 e o hash dele), resultado da suíte, o que não foi verificado no app; termina com a linha "🤖 Generated with [Claude Code](https://claude.com/claude-code)".
- Labels: consultar as existentes, aplicar as que servirem, criar as que faltarem, conferir no PR.
- Mesmas regras de commit: suíte antes, só os arquivos do sinal, fora docs/analises/, seção do clone e scripts/.
- Commit b8fb0a6 (R20, fecha a fase 1; push feito): limpeza de resíduos (register.tsx, tests/task-tree.test.ts, DESENVOLVIMENTO.md só com os hunks do R20). Testes: 194 pass, 0 fail; validate ok. Fora do commit: docs/analises/, scripts/, seção do clone.
- PR #6: https://github.com/AlbertKellner/claude-code-mod-task-tree/pull/6 (test/rede-de-protecao-regressoes → main). Labels: tests (criada nesta etapa, #0e8a16), bug, enhancement, documentation, task-tree (já existiam). Descrição com os 9 itens e commits; "Não verificado" cita app real, render do SVG e respawn real.
