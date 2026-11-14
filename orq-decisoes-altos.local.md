# Decisões do usuário sobre os achados altos pendentes (PR #36)

Registro da sessão orquestradora. Cada item cita as palavras do usuário (opção escolhida) e a data.

## Itens 1 e 2: id de nível 1 reusado com sessão viva ou carta na fila sob a tarefa antiga

- 2026-11-12, "Sim, fica à vista (Recomendado)".
- Efeito: o pedido anterior fica à vista enquanto a sessão trabalha ou a carta está na fila; cartão sob a
  tarefa de origem; tradução do passo 7 do achado 1 (`correcao-alto-1.local.md`, seção 2) no lugar do
  filtro `cards`; `envios.cor-por-estado` ganha `Reescrito:`, teste `envios.test.ts:33-52` troca
  `comHistorico($, 1)` por `painel($)`, selo `--tipo decisao`.
- Cor da carta, 2026-11-12, "Cinza já no plan (Recomendado)": mantém a regra de 2026-10-24 (cinza
  "interrompida" já no plan); o diff opcional `correcao-r2-itens-1-2-carta-azul.diff` NÃO entra.

## Item 8: carta na fila e sessão destino arquivada

- 2026-11-12, "Cinza \"não entregue\" (Recomendado)".
- Efeito: aplicar a parte B, `correcao-alto-8-recomendada.diff` (sobre a parte A já commitada em ee8d8f0);
  origem do cenário `envios.destino-arquivado-nao-entregue`.

## Item 9: tarefa parada com Esc depois de aviso automático ou de start em outra

- 2026-11-12, "Segue ✕ até novo start (Recomendado)".
- Efeito: opção 1 de `correcao-alto-9.local.md` (lista `stopped`); cenário novo
  `turnos.parada-segue-interrompida-ate-o-start`; `turnos.prompt-seguinte-retoma` ganha `Reescrito:`,
  teste `turnos.test.ts` selado `--tipo decisao`; o golden `principal` muda ("Um.dois" ✕ em vez de ◷):
  sem commit até o usuário validar no app e dizer as palavras para o `golden:aprovar`.

## Item 12: desenho padrão acima de 600 KB

- 2026-11-12, "Cortar os mais antigos (Recomendado)".
- Efeito: opção (a), `correcao-alto-12-opcao-a.diff` (não somar com `correcao-alto-12.diff`); trocar os
  marcadores pelas palavras e pela data acima (`Reescrito:` de `cabecalho.limite-de-linhas-do-desenho` e o
  comentário de `render.tsx`).

## Item 13: mensagem entregue no meio do turno

- 2026-11-12, "Entra no pedido em curso (Recomendado)".
- Efeito: plano "Entra no pedido em curso" de `correcao-alto-13.local.md`, seção 3 (`PROMPT.midTurn`, sem
  `openTurn` com `e.turnId`); `pedidos.uma-mensagem-um-pedido` e `envios.pedido-recebido-mostra-carta`
  ganham `Reescrito:`; cenários novos `pedidos.mensagem-no-meio-do-turno-continua-o-pedido` e
  `lembretes.mensagem-no-meio-do-turno`.

## Achados novos (fora do PR)

- 2026-11-12, escolhido só "Cartão do subagente neto": entra nesta rodada (o cartão do subagente lançado
  por outro subagente nunca aparece depois que ele termina).
- "Subagente sem fim sob tarefa fechada": primeiro ficou fora; depois da explicação, 2026-11-12,
  "Sim, entra nesta rodada (Recomendado)". Base: achado médio da auditoria "Subagente fica
  \"trabalhando\" ou \"em segundo plano\" para sempre quando o fim dele não chega"
  (`auditoria-mod-task-tree.local.md:1492`), com o ajuste da verificação: conferir os cartões vivos
  contra `$.agent.list()` (não em toda volta do store), outro critério para agentes de workflow
  (fim do run ou tempo sem chamadas), cartão órfão vira "interrompido" com `end`, cenário novo de
  subagente em segundo plano com reinício.

## Situação

Todos os itens decididos. O usuário vai pedir formalmente o início do planejamento e da implementação.

## Item 13, caso da mensagem da sessão-mãe ou irmã a uma filha ocupada

- 2026-11-12, "Segue com pedido próprio (Recomendado)": o diff principal (`correcao-r2-item-13.diff`) é a
  resposta; a variante `correcao-r2-item-13-todas-as-origens.diff` NÃO entra;
  `sessoes.um-cartao-por-mensagem` não muda.

## Subagente sem fim: agentes de workflow

- 2026-11-12, "30 minutos sem sinal (Recomendado)": aplicar
  `correcao-r2-subagente-sem-fim-workflow-opcional.diff` por cima do principal, trocando os marcadores
  `<AAAA-MM-DD>` e `<palavras do usuário>` e selando de novo os três testes.
