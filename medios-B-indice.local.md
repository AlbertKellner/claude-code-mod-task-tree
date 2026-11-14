# Índice dos lotes da triagem B (envios, subagentes, desenho do painel e cabeçalho)

Escrito pelo planejador B em 2026-11-14, só lendo o código (`fix/achados-medios`, ponta `6d5e026`).
Fontes: `triagem-medios-B.local.md`, `orq-decisoes-medios.local.md` (itens marcados "(B)"),
`orq-instrucoes-planejador-medios.local.md`. Caminhos do mod relativos a `task-tree/`.

Situação: os 26 planos estão escritos (`medios-B-lote-01-plano.local.md` a
`medios-B-lote-26-plano.local.md`, nesta pasta). Um lote está bloqueado (26); quatro trazem uma pergunta
que não bloqueia (09, 15, 16 e, só como nota de leitura, 06).

## Ordem de implementação

Cada lote é um commit. "Decisão" é o número em `orq-decisoes-medios.local.md`.

| Lote | Título | Achados (triagem B) | Decisão | Arquivos do mod | Golden |
|---|---|---|---|---|---|
| 01 | Textos e catálogo dos envios, sem regra nova | cenário do envio "sem nada em andamento"; lembrete "recebimento confirmado"; texto de `envios.cor-por-estado` | nenhuma | `text/rules.ts`, `hooks/sessions.ts`, `hooks/panel.ts` (comentário) | não muda |
| 02 | Carta e cartão sob a tarefa em andamento | carta e cartão vão para a pendente planejada depois | 19 | `hooks/panel.ts` | não muda |
| 03 | Casamento por uma palavra só no nome da sessão | casamento "pelo nome" aplicado a textos livres | 20 | `hooks/panel.ts`, `hooks/tool-call.ts`, `hooks/sessions.ts`, `hooks/agents.ts` | não muda |
| 04 | Status "Tarefas d/n" igual à sessão inteira | status sob a caixa de mensagem diverge do cabeçalho | nenhuma | `hooks/panel.ts`, `hooks/render.tsx`, `draw/layout.ts`; kit `ambiente.ts` | não muda |
| 05 | "+N pedidos anteriores" decidido por pedido | "+N" conta o pedido desenhado em parte | nenhuma | `draw/layout.ts` | não muda |
| 06 | Total da sessão inteira na linha "+N pedidos anteriores" | "sessão inteira" sem lugar no desktop | 28 | `hooks/render.tsx`, `draw/head.tsx` (comentário) | não muda |
| 07 | Uma noção só de "nada em execução na tarefa" | os dois fechamentos automáticos; "nada mais em execução nela" medido diferente | nenhuma | `hooks/sessions.ts`, `hooks/agents.ts`, `draw/layout.ts` | não muda |
| 08 | Relançar depois de falha: vale a última tentativa | tarefa ✕ "falhou" com a nova tentativa concluída | 22 | `hooks/agents.ts` | não muda |
| 09 | Fim do subagente depois do Esc fecha como no fim normal | os dois gatilhos do fechamento (caso do Esc) | 21 | nenhum (cenário e testes) | não muda |
| 10 | O recibo já usado sobrevive à recarga e ao reinício | recarga faz um recibo antigo fechar a segunda mensagem | nenhuma | `hooks/sessions.ts`, `types/index.d.ts`, `state/durability.ts`, `hooks/panel.ts`, `hooks/session-start.ts` | não muda |
| 11 | Cartas dentro dos cartões (e a carta órfã de replano) | a mesma carta em todos os cartões de rodada; carta órfã; carta entregue cinza no cartão da filha parada e na tarefa ✕ pelo subagente | nenhuma | `draw/layout.ts` | não muda |
| 12 | A linha recolhida leva os chips e a faixa | recolher uma linha muda os chips e a faixa | nenhuma | `draw/layout.ts`, `hooks/render.tsx` | não muda |
| 13 | Aviso de espera no cartão de grupo | aviso de espera de um agente não aparece no grupo | nenhuma | `draw/layout.ts` | não muda |
| 14 | As tarefas do subagente contam no cabeçalho e nas linhas acima | tarefas do subagente só contam com o cartão desenhado | 23 | `draw/layout.ts` | não muda |
| 15 | A tarefa com subagente rodando aparece em andamento | subagente rodando não acende a tarefa | 24 | `draw/layout.ts`, `hooks/sessions.ts` | não muda |
| 16 | Faixa "em andamento" enquanto o turno roda | faixa "aguardando" entre um done e o start seguinte | 29 | `draw/svg.ts`, `hooks/render.tsx` | não muda |
| 17 | Faixa âmbar com só a filha trabalhando: texto do cenário | faixa âmbar por tarefa da filha | 30 | nenhum (cenário e teste) | não muda |
| 18 | O tempo do cabeçalho para no fim do turno | tempo do cabeçalho segue contra "agora" | 25 | `hooks/render.tsx`, `draw/layout.ts` | muda `principal` (0:02 vira 0:01) |
| 19 | O tempo da tarefa conta só com o turno em curso | cronômetro soma o tempo parado entre turnos | 26 | `types/index.d.ts`, `state/tasks.ts`, `draw/layout.ts`, `hooks/turn.ts`, `hooks/panel.ts`, `hooks/sessions.ts`, `hooks/tools.ts`, `hooks/render.tsx` | muda `principal` (0:01 vira 0:00) |
| 20 | toks/s e "ultracode" no cabeçalho em qualquer largura | toks/s e "ultracode" não desenhados abaixo de 84 colunas | 27 | `draw/head.tsx` | não muda nos 4 cenários; o desenho novo vai ao checklist do app |
| 21 | Corte de linhas: o bloco pequeno do fim não esconde o pedido | corte esconde o pedido inteiro | nenhuma | `draw/layout.ts` | não muda |
| 22 | O pedido único acima do limite mostra o trecho da tarefa em andamento | corte guarda o começo, não a tarefa em andamento | 31 | `draw/layout.ts` | não muda |
| 23 | Gravações do cartão do subagente com freio por tempo | cada chamada de ferramenta regrava o painel | nenhuma | `hooks/agents.ts`, `hooks/tool-call.ts` | não muda |
| 24 | O subagente retomado volta a "trabalhando" | o primeiro fim de turno do retomado é tratado como fim | nenhuma | `hooks/agents.ts` | não muda |
| 25 | O nome do destino na carta | irmã e mãe aparecem como 8 caracteres do id | nenhuma | `hooks/sessions.ts`, `hooks/panel.ts`, `hooks/render.tsx`, `draw/layout.ts`, `types/index.d.ts`, `state/durability.ts`; kit `ambiente.ts` | não muda |
| 26 | A ferramenta antiga de mensagem acompanhada como o `SendMessage` | mensagem pela ferramenta antiga não gera carta | nenhuma | `hooks/tool-call.ts`, `text/rules.ts` (e, conforme o ensaio, `hooks/sessions.ts`, `types/index.d.ts`) | não muda |

## Cadeias de dependência (dentro da triagem B)

- `sendAnchor` (`hooks/panel.ts`): 01, depois 02, depois 03.
- Contagens: 04 antes de 06; 05 antes de 06.
- Fechamento automático (`settleBySubs`, `watchSends`): 07, depois 08, depois 09; 07 antes de 15 e de 24.
- Cartas: 01 antes de 11; 11 antes de 12 e de 25.
- Chips e faixa: 12, depois 13, 14, 15, 16, 17 (16 antes de 17: mesmo cenário).
- Tempo: 15, depois 18, depois 19.
- Corte de linhas (`limitRows`): 21, depois 22.
- Subagentes: 23 antes de 24.
- 20 é independente (só `draw/head.tsx`). 10 é independente. 26 é o último.

## O que cruza com as triagens A e C (detalhe na seção 10 de cada plano)

- Decisão 13 (A, "Sim, o plan adota"): mesma função dos lotes 01, 02 e 03 (`sendAnchor`), e usa o
  casamento "pelo nome" que o lote 03 separa em nome de sessão e frase livre; cria blocos soltos no fim
  do painel, que o lote 21 trata como cauda.
- Decisão 7 (A, "Segue ◉/◷", Esc com filha ou subagente vivo): usa a noção do lote 07 e o termo do lote
  15; muda o intervalo que os testes do lote 09 deixam em aberto de propósito.
- Decisões 5 e 17 (A) e 44 (C), sobre tempo: mesmas funções do lote 19 (o maior ponto de conflito).
- Decisões 9, 11, 12, 18 (A): `split`, `session` e `body` em `draw/layout.ts`, tocados pelos lotes 05,
  11 e 12.
- Decisão 34 (C, poda dos subagentes terminados): os lotes 08, 14 e 24 leem os cartões terminados.
- Decisão 35 (C, enxugar o arquivo publicado): o lote 19 publica um campo novo no grupo principal.
- Decisão 39 (C, pergunta pendurada na pendente): o termo de espera do lote 07 e o teste do lote 21.
- Decisão 42 (C, cenário por texto): os textos novos dos lotes 01 e 26.
- Decisão 43 (C, ampliar o golden): os lotes 18, 19 e 20 mudam o que um cenário novo gravaria.

## Fora dos lotes

- Não confirmados ("Ficam de fora (Recomendado)"): destino por nome repetido ou "nome [ref]"; envio feito
  por subagente a uma sessão.
- Resolvidos: subagente "trabalhando" para sempre (PR 36); carta para subagente parado (PR 38); linha do
  histórico preservada no corte (PR 38).
- Decisão 13 (carta e cartão criados antes do plan): fica com a triagem A.
- Achado baixo vizinho, não planejado: "watchSends marca os envios pelo índice de uma leitura antiga"
  (citado no lote 10).

## Bloqueios e perguntas

- **Lote 26, bloqueado:** precisa de um ensaio no app (o resultado de
  `mcp__ccd_session_mgmt__send_message` na fila e na entrega, o formato em que a mensagem chega na sessão
  destino, e o que "parent" faz). O plano cobre os dois resultados possíveis. Pergunta e opções na seção
  11 do plano.
- **Lote 09, não bloqueia:** depois do Esc, o fim de um subagente fecha também as outras tarefas paradas
  cujos subagentes tinham terminado antes do Esc. A resposta "Fecha como no fim normal" não diz esse
  caso com certeza, e ele toca "Segue ✕ até novo start" (2026-11-12). O plano não muda o código nesse
  ponto. Pergunta pronta na seção 11.
- **Lote 15, não bloqueia:** "◉ como a filha" poderia incluir a tarefa já concluída com done e subagente
  ainda em segundo plano; o plano a mantém ✓ (cenário coberto `subagentes.cartao-fica-com-a-origem-
  fechada`). Pergunta pronta na seção 11.
- **Lote 16, não bloqueia:** "em andamento enquanto o turno roda" foi lido como "a partir do primeiro
  start do pedido", para não desfazer "Âmbar claro, 'aguardando'" (2026-11-03) no momento logo depois do
  plan, que um teste selado afirma. Pergunta pronta na seção 11.
- **Lote 06, nota de leitura:** o total vai na mesma linha, como a palavra da direita, e não colado ao
  título com " · " como no exemplo da pergunta, para não mudar o título que 20 asserções cobertas leem.
