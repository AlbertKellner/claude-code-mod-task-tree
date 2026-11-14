# Achados médios, triagem A: índice dos lotes

Escrito pelo planejador da triagem A em 2026-11-14, só lendo o código (branch `fix/achados-medios`,
ponta `6d5e026`). Fontes: `triagem-medios-A.local.md`, `orq-decisoes-medios.local.md`.
Um arquivo por lote: `medios-A-lote-NN-plano.local.md`, nesta pasta. Cada lote é um commit.
Situação: os 26 planos estão escritos (25 a implementar; o 21 foi absorvido pelo 07).

Caminhos de arquivo relativos a `task-tree/`, salvo `regras/`.

## Ordem de implementação

A ordem segue a da triagem (ids; fim do turno; lembrete; prompt; leitura das filhas; rodadas e cartões;
fim do turno publicado; dobras; documentação), com cada decisão encaixada onde toca a mesma função.
Implementar na ordem dos números: vários lotes dependem dos anteriores (está dito na seção 10 de cada um).

| Lote | Título | Achados | Decisão (número em `orq-decisoes-medios`) | Arquivos do mod |
|---|---|---|---|---|
| 01 | Ids no plan, start e done | o plan aceita o id completo dos lembretes; o id curto não alcança o histórico | correção direta | `state/tasks.ts` |
| 02 | Nível 1 concluído reabre no replano do mesmo pedido | nível 1 que fechou sozinho e é replanejado com o mesmo id | 1: "Reabre mantendo os ✓ (Recomendado)" | `hooks/tools.ts`, `text/rules.ts` |
| 03 | O título do pedido é o do primeiro plan | request de um segundo plan no mesmo pedido | 4: "Não, vale o 1º (Recomendado)" | `types/index.d.ts`, `hooks/tools.ts`, `text/rules.ts` |
| 04 | start num pai inicia a primeira subtarefa | start num pai aberto | 2: "Inicia a 1ª subtarefa (Recomendado)" | `hooks/tools.ts`, `text/rules.ts` |
| 05 | Tarefa abandonada pelo modelo fica ✕, fora do x/y | não há como o modelo abandonar uma tarefa | 3: "✕ fora do x/y (Recomendado)" | `hooks/session-start.ts`, `hooks/tools.ts`, `text/rules.ts` (e o kit) |
| 06 | Fim do turno: resumo depois do Esc, aviso de permissão, espera do wrap_up | Esc não limpa o resumo; aviso de permissão por agente e ferramenta; espera do wrap_up antes de a chamada dar certo (parte direta) | correção direta; a 14 ("Toda pergunta espera") fica como hoje | `hooks/turn.ts`, `hooks/tool-call.ts`, `hooks/panel.ts` |
| 07 | A tarefa ◷ segue ◷ na mensagem seguinte, até o start | tarefa iniciada num turno anterior volta a "em andamento"; e, absorvido, o tempo da ◷ no cartão da filha parada (correção direta) | 5: "Seguir ◷ até o start (Recomendado)" | `state/tasks.ts`, `hooks/turn.ts`, `draw/layout.ts`, `hooks/tools.ts`, `text/rules.ts` |
| 08 | O ↩ de um pedido sem tarefa fica num pedido próprio | turno sem plano grava a resposta no pedido anterior | 6: "Pedido próprio (Recomendado)" | `hooks/turn.ts`, `hooks/panel.ts`, `draw/layout.ts` |
| 09 | Turno que morre por erro: ✕ "falhou" | turno que morre por erro de API ou limite de contexto | 8: "✕ \"falhou\" (Recomendado)" | `hooks/turn.ts`, `state/tasks.ts`, `hooks/panel.ts`, `hooks/prompt-submit.ts`, `state/durability.ts`, `types/index.d.ts`, `draw/layout.ts`, `text/rules.ts` (e o kit) |
| 10 | Lembrete "terminou o turno" pela tarefa da rodada | o lembrete olha só a tarefa em que a filha foi aberta | correção direta | `hooks/sessions.ts` |
| 11 | Marcas de outra sessão e de retorno de subagente só no começo do prompt | prompt classificado pelo texto em qualquer posição (a parte não confirmada fica fora) | correção direta | `hooks/prompt-submit.ts`, `hooks/sessions.ts` |
| 12 | Leitura das filhas: uma por vez, a recém-aberta mantida, sem cartão fantasma | filha recém-aberta perde a origem e leitura sobreposta (dois achados); cartão fantasma para irmã ou mãe e rodada de envio que falha | correção direta | `hooks/sessions.ts`, `io/host.ts`, `hooks/tool-call.ts` |
| 13 | Leitura das filhas: higiene das arquivadas e do que é publicado | arquivadas relidas a cada 3 s, netas publicadas sem corte, lista com limite 100 (parte direta) | correção direta | `io/host.ts`, `hooks/sessions.ts`, `io/publish.ts` (e o kit) |
| 14 | Carta e cartão criados antes do plan: soltos no fim, e o plan os adota | cartão de filha sem tarefa de origem (A) e carta, sessão ou subagente antes do plan (B) | 13 (com a 10): "Sim, o plan adota (Recomendado)" | `hooks/panel.ts`, `hooks/tool-call.ts`, `hooks/sessions.ts`, `hooks/agents.ts`, `hooks/tools.ts`, `draw/layout.ts`, `text/rules.ts`, `types/index.d.ts` |
| 15 | Cartão cuja tarefa de origem sai do plano fica sob o nível 1 | âncora que sai do plano num replano (A e C) | 9: "Sob o nível 1 (Recomendado)" | `hooks/tools.ts`, `hooks/panel.ts` |
| 16 | Rodada da frente pelo tempo; chip de sessões conta a sessão uma vez | turno digitado na filha tratado como a rodada mais antiga; contagem dupla no chip (parte direta) | correção direta | `draw/layout.ts` |
| 17 | Regras de cartão valendo dentro do cartão de uma filha (netas) | regras de cartão só para as filhas diretas | correção direta | `draw/layout.ts`, `hooks/render.tsx`, `hooks/panel.ts` |
| 18 | Esc na principal com filha ou subagente vivo sob a tarefa | Esc: só a carta na fila poupa a tarefa | 7: "Segue ◉/◷ (Recomendado)" | `draw/layout.ts`, `hooks/panel.ts`, `hooks/render.tsx` |
| 19 | Cartão da rodada largada: "substituída", cinza | cartão de rodada descartada desenhado como o que vale | 12: "\"Substituída\", cinza (Recomendado)" | `draw/layout.ts`, `types/index.d.ts` |
| 20 | Turnos digitados na filha: um cartão só | cada turno aberto direto na filha vira um cartão | 18: "Um cartão só (Recomendado)" | `draw/layout.ts` |
| 21 | (absorvido pelo lote 07; não despachar) | a tarefa ◷ para no último carimbo do painel publicado | correção direta, resolvida pelo lote 07 | nenhum |
| 22 | Tempo da tarefa concluída com filha embaixo: só o próprio | o tempo corre enquanto a filha trabalha e regride | 17: "Só o próprio" | `draw/layout.ts` |
| 23 | /clear numa filha: o cartão mantém o histórico | /clear numa filha apaga da mãe o trabalho dela | 16: "Mantém o histórico (Recomendado)" | `types/index.d.ts`, `hooks/session-start.ts`, `draw/layout.ts` |
| 24 | Filha arquivada antiga vira uma linha | filhas arquivadas e antigas nunca saem (a decisão) | 11: "Vira linha resumida (Recomendado)" | `types/index.d.ts`, `hooks/sessions.ts`, `io/host.ts`, `draw/layout.ts` |
| 25 | Dobras: o id reusado não herda a dobra, e o /clear as limpa | a dobra é guardada pelo id | correção direta | `hooks/panel.ts`, `hooks/tools.ts`, `hooks/session-start.ts` |
| 26 | Documentação e textos de cenário | fim de turno no documento; done da mãe com filha trabalhando; as duas regras da filha parada com Esc | correção direta, e a 15: "Rodada fora da conta (Recomendado)" (como hoje: só o texto dos cenários e um teste que trava) | `DESENVOLVIMENTO.md`, `regras/` (nenhum código do mod) |

## Fora dos lotes

- Não confirmados ("Ficam de fora (Recomendado)"): comando local no `prompt.submit`; mensagem só com
  imagem; arquivo da filha ilegível numa leitura; arquivo publicado sem validade; sessões sem
  `start_session` com id; custo das quebras de cartão. As guardas opcionais que a triagem sugeria junto
  (corpo vazio com anexo, comando `task-tree`, tolerar arquivo ilegível) também ficam fora. Do achado do
  wrap_up, "o resultado diz que a pergunta não foi mostrada" fica fora (o texto do app não está
  registrado no repositório).
- Resolvido: "mesmo pedido" no replano e mensagem de outra sessão (PR 36).
- Decisão 10: respondida de novo como a 13; vai no lote 14.

## Testes existentes que mudam (sempre com o nome mantido e selo `--tipo decisao`)

| Lote | Teste | Por quê |
|---|---|---|
| 02 | `pedidos.test.ts`: "plan com o id de um nível 1 concluído deixa o concluído como histórico e põe um plano novo ao lado" | decisão 1: o corpo passa ao pedido seguinte |
| 04 | `turnos.test.ts`: "o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende" | decisão 2: o start no pai inicia a primeira subtarefa, que o Esc deixa ✕ |
| 07 e 18 | `envios.test.ts`: "depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem" | decisão 5 (start antes do Esc) e decisão 7 (o destino passa a parado) |
| 14 | `subagentes.test.ts`: "lançado num pedido sem plano depois de um pedido todo concluído, o cartão aparece sob a última tarefa iniciada" | decisão 13: o cartão termina a lista até o plan |

A etapa `regressao` libera a falha do teste de `HEAD` pela chave `arquivo::nome`; por isso os nomes ficam.
Se a correção da triagem C para renomear teste por decisão entrar antes, o teste do lote 14 pode ganhar o
nome novo que o plano sugere.

## Deduções do planejador que a orquestradora pode querer confirmar com o usuário

Nenhuma bloqueia; cada uma está marcada como dedução no plano.

- Lote 02: a reabertura do nível 1 concluído vale só para o loop principal (o replano de um subagente
  segue deixando a concluída como histórico, como o teste selado dele afirma).
- Lote 05: o jeito de cancelar é um parâmetro `cancel` no `done` (a decisão admitia parâmetro ou
  ferramenta).
- Lote 07: os lembretes curtos (aviso do app, retorno de subagente) não ganham a lista das tarefas ◷; só
  as regras e o lembrete da mensagem seguinte dizem que elas voltam com start.
- Lote 09: a recusa do modelo (`reason: refusal`) entra junto com o erro, como no subagente.
- Lote 14: a tarefa que adota a carta ou o subagente criados antes do plan não fecha sozinha por causa
  deles (a adoção é só de lugar).
- Lote 18: quando a filha para depois do Esc, a tarefa volta a ✕ até o start (a decisão só diz o que
  mostrar enquanto o trabalho delegado está vivo).
- Lote 20: "o cartão que a sessão já tem ali" foi lido como o cartão de turnos digitados naquele ponto; o
  turno digitado não entra no cartão de uma rodada aberta por mensagem da mãe. Com um turno só, o cartão
  segue sem linha de pedido.
- Lote 24: com "+N pedidos anteriores" aberto, as tarefas da filha resumida não somam ao cabeçalho (a
  linha mostra a contagem dela, e o x/y da tarefa de origem não muda).

## Observações de leitura

- Lote 11: a forma real das mensagens foi medida nos transcritos locais deste projeto (só contagem e
  formato): parte das mensagens de outra sessão e todos os retornos de subagente chegam com a linha
  "Another Claude session sent a message:" antes da tag. A âncora no começo do texto aceita essa linha;
  sem isso, a correção quebraria os retornos de subagente.
- Os planos foram escritos sobre `6d5e026`. Durante o planejamento a branch recebeu dois commits de outro
  agente, só em `scripts/`, `CLAUDE.md`, `regras/README.md` e `regras/selos.json` (`6ec76e7` e `dadc76a`;
  nada em `task-tree/`): as linhas de código citadas nos planos seguem valendo. O segundo muda a contagem
  de asserções do selo (passa a somar os helpers do kit) e regrava os selos: os comandos de selo dos
  planos não mudam, mas onde um plano diz quantas asserções um teste tem hoje, vale o número novo de
  `regras/selos.json`. O planejador não escreveu no repositório.

## Bloqueios

Nenhum.
