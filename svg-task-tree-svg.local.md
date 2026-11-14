# svg-task-tree: atualização do SVG

Arquivo alterado: docs/task-tree-proposta-visual.svg (altura de 500 para 600).
- "Escrever notas" passa a estar em andamento e ganha, embaixo, o cartão "Revisão do código · mensagem 2" (cartão k sob a tarefa que mandou a mensagem k; ele não mostra a espera, que fica só no cartão 0).
- Nova tarefa "Revisar o texto final", com o envelope azul (✉) e o texto "mensagem não lida".
- Contadores ajustados para 4 de 8 (50%); a <desc> descreve as novidades.
- Validação: XML bem formado (minidom). Não verificado: aparência renderizada (não abri no navegador).

## Acréscimo: filha parada
Cartão "Testes · sessao-filha" sob "Revisar o texto final": ◷, "parada · 0/1", aberto, tarefa "Aguardar sinal da revisão". Altura 670. XML válido; renderização não conferida.

## Ajuste: nada recolhe sozinho
Concluídas e o grupo do subagente interrompido passam a ▾ abertos, com as tarefas visíveis (3 concluídas; subagente 1 ✓ e 2 ✕). Altura 830. Nenhum ▸ restante. XML válido; renderização não conferida.

## Ajuste: tarefa de envio fecha sozinha
"Escrever notas" (enviou a mensagem 2, já recebida) passa de em andamento a ✓; desc atualizada. XML válido.

## Ajuste: nome da sessão no cabeçalho
Cabeçalhos dos cartões: "revisao-codigo" (cartões 0 e 2) e "qualidade-testes" (parada). desc atualizada. XML válido.

## Ajuste: recolher pelo ícone
7 setas ▾ removidas (sem coluna de abrir/recolher); desc atualizada. Nada recolhido no desenho, então nenhum " ⋯". As posições x não foram encostadas à esquerda (o espaço da antiga seta ficou vazio). XML válido.

## Correção: rótulo solto
Cabeçalhos dos 3 cartões viram rótulo 12px cinza negrito + ⑂ (+ anel e "aguardando" âmbar no cartão 0; "parada" esmaecido no parado). Removidos contagens, ícone do parado, guia rótulo→tarefas e as ligações dos cartões 2 e parado à tarefa da principal. Mantida a guia de "Ler a documentação" até "Aguardando sua resposta" (passa atrás do cartão 0). XML válido; render não conferido.

## Correção: linhas à esquerda e ligação no cartão
Corpo redesenhado: raiz em x=30, nível 1 em x=52, sem espaço da seta; cartões em x=74..656 com a guia da tarefa da principal entrando na borda esquerda à altura do rótulo (y 276, 434, 532); guias também no grupo do subagente. XML válido; render não conferido.

## Ajuste: a linha inteira recolhe
Só a <desc> mudou (clique na linha inteira; no terminal o ícone; nome cortado mostra a dica e não recolhe). XML válido.

## Ajuste: só o ícone recolhe; ⑂ à esquerda
⑂ dos 3 cartões em x=90 (lugar do ícone), nome em x=106, anel/estado à direita. desc: só o ícone recolhe; ⑂ recolhe o cartão. XML válido.

## Ajuste: anel só no cartão
Cartão 0: "aguardando" em x=214 logo após o nome; anel em x=646 (ponta direita, coluna do tempo). Linhas-mãe já não tinham anel. desc atualizada. XML válido.

## Recurso: resposta da sessão (↩)
Cartão 0 (aguardando) ganha ↩ com a resposta do turno; cartão parado ganha ↩ "À espera do sinal…"; cartão 2 (turno em curso) sem ↩. Cartões crescem 22px; o resto desce por <g transform>. Altura 874. XML válido; render não conferido.

## Recurso: ↩ no painel principal
Após as 3 concluídas (turno anterior concluído) entra a linha ↩ com a resposta do turno; o grupo do subagente desce 25px. O grupo em andamento ("Implementar...") não tem ↩ (turno rodando). Altura 899. XML válido; render não conferido.

## Correção: sem ↩ em grupo com cartão
Nenhum ↩ removido: o único ↩ do painel principal está no grupo das Concluídas, sem cartão. Só a <desc> ganhou a regra. XML válido.

## Ajuste: ↩ com resumo de até 60 caracteres
Resumos: "Três apontamentos; falta decidir os nomes", "Escopo, issue e ambiente prontos"; o do cartão parado já tinha 50. desc atualizada. XML válido.

## Ajuste: ↩ só com o resumo da sessão
Cartão parado: "Aguardando o sinal da revisão"; grupo Concluídas: "resposta" (exemplo sem resumo). desc atualizada. XML válido.

## Ajuste: limite 120
desc: 60→120; ↩ do cartão 0 e do parado alongados (79 e 51 caracteres; cabem em ~550px). "resposta" mantido. XML válido.

## Ajuste: anel em todo cartão
Anel em x=646 também no cartão 2 (25%) e no parado (75%). desc atualizada. XML válido.

## Ajuste: cabeçalho do pedido no cartão
Cartão 0 (2 tarefas de nível 1) ganha a linha do pedido "Revisar o código da feature" e as tarefas ligadas por guia abaixo; cartão +26px, resto desce; altura 925. Cartões 2 e parado (1 tarefa) sem cabeçalho. XML válido; render não conferido.

## Ajuste: anel no centro da caixa do botão
Só a <desc> mudou; o desenho é esquemático e o anel já está na ponta direita (x=646). XML válido.

## Recurso: modelo e esforço no cartão
Cartão 0 e 2: "Opus 5.5 · high"; parado: "Sonnet 5.5"; texto 11px cinza, fim em x=633 (8px antes do anel). desc atualizada. XML válido; render não conferido.

## Pacote cliques/painel/tamanho
Desenho não muda (painel curto, até 3 pedidos); desc ganhou a regra "+N pedidos anteriores" / "+N cartões antigos de sessões". XML válido.

## Ajuste: cabeçalho por visão
Desenho esquemático não muda; desc ganhou a regra do cabeçalho que soma só as linhas da visão. XML válido.

## Ajuste: limite de 400 linhas (R15)
Só a <desc> mudou: corte acima de 400 linhas ("+N linhas anteriores" no começo, "+N linhas" no fim do último bloco; "Painel grande demais" como último recurso). Desenho inalterado (o corte só aparece em painéis enormes). XML validado. Render não conferido.
