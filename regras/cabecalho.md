# Cabeçalho

Os números, chips e limites do cabeçalho e do que é desenhado.

Código da área: draw/layout.ts, draw/svg.ts

### cabecalho.numeros-somam-o-desenhado
Os números do cabeçalho somam o que está desenhado.

- Dado linhas recolhidas no painel
- Quando o cabeçalho é desenhado
- Então os números somam o que o painel mostra, e recolher não muda nada

Origem: decisão do usuário, 2026-10-23 ("deve somar as tarefas que estão sendo mostradas na listagem. a visão resumida mostra somente informacoes dessa visao"; "as colapsada, mas que estao nessa visao, tambem entram"); commit 3e79cb8.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); não há mais visões.
Estado: coberto

### cabecalho.resumida-exclui-pedido-finalizado
O pedido finalizado sai do trabalho quando um pedido novo começa trabalho.

- Dado um pedido de turno anterior todo concluído
- Quando um pedido novo começa trabalho (plan ou start)
- Então o finalizado sai do desenho e dos números e fica em "+N pedidos anteriores"; aberta a linha, ele volta a ser desenhado e contado

Origem: decisão do usuário, 2026-10-22 ("segundo a regra antiga, na visão resumida, ficam somente as tarefas novas do turno"); commit 6599050.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: hooks/panel.ts, hooks/command.ts
Estado: coberto

### cabecalho.resumida-limpa-so-com-tudo-concluido
O trabalho só é limpo quando tudo à vista está concluído.

- Dado o trabalho de um pedido anterior todo concluído
- Quando um pedido novo começa trabalho
- Então o painel mostra só o pedido novo, com os anteriores em "+N pedidos anteriores" (o par de pedidos.resumida-mantem-anteriores-com-algo-aberto)

Origem: decisão do usuário ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"); commit 897c0d7.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: hooks/panel.ts, hooks/command.ts
Estado: coberto

### cabecalho.interrompida-fora-do-total
A interrompida fica fora do total.

- Dado uma tarefa ✕
- Quando o cabeçalho é desenhado
- Então ela sai do total e entra no chip "interrompidas"

Origem: regra do painel desde a entrada do mod (commit 465b09e, "Interrupted tasks are kept out of the done/total count"); reafirmada pelo usuário, 2026-10-24 ("interrompida fora do total, 3/5 → 3/3").
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Estado: coberto

### cabecalho.chips-contam-folhas
Os chips (as pílulas do cabeçalho) contam só folhas, nunca pais nem tarefas de mensagem.

- Dado tarefas com filhas, tarefas de mensagem e folhas em cada estado
- Quando o cabeçalho é desenhado
- Então em andamento conta as folhas iniciadas (inclusive a tarefa que enviou uma mensagem), pendentes as não iniciadas; a carta na fila só conta no chip ✉ ("aguardando sessão")

Origem: regra do painel ("Open leaves only, a parent never"); tarefas de mensagem fora: decisão do usuário, 2026-10-24 ("quero diferenciar as tarefas de execução, das tarefas de mensagem"), commit 8eb801c.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa que enviou conta pelo ícone; a carta, fora dos chips de tarefa.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### cabecalho.aviso-de-painel-grande-volta
O aviso de painel grande tem um botão que volta à visualização anterior.

- Dado o painel trocado pelo aviso "Painel grande demais", depois de abrir "+N pedidos anteriores"
- Quando a pessoa aperta "Voltar à visualização anterior"
- Então o que foi aberto fecha (os históricos abertos; sem nenhum, as linhas abertas) e o painel normal volta, com "+N pedidos anteriores" fechado

Origem: decisão do usuário, 2026-11-04 ("coloque um botão para voltar a visualização anterior").
Código: hooks/render.tsx
Estado: checklist (o harness limita cada valor do state a 4 MB, e o aviso só aparece acima de 20 MB)

### cabecalho.limites-de-linhas
Os pedidos fora do trabalho viram "+N pedidos anteriores".

- Dado pedidos fora do trabalho atual, sem nada aberto
- Quando o painel é desenhado
- Então eles viram uma linha "+N pedidos anteriores", e o cabeçalho conta o que ficou à vista (a sessão inteira, só no tooltip); no máximo três pedidos sem nada aberto ficam desenhados; um cartão vivo de um pedido cortado é desenhado solto no fim (sessoes.cartao-vivo-nunca-some)

Origem: commit 4edb3f2, 2026-10-21 (o desenho de 1,6 MB que o app parou de mostrar).
Reescrito: 2026-11-03, decisão do usuário ("Cartão vivo solto no fim (Recomendado)"): o cartão vivo de um pedido cortado não some.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: coberto

### cabecalho.limite-de-cartoes-antigos
Os cartões antigos sem tarefa de origem ficam em "+N pedidos anteriores".

- Dado cartões parados, sem tarefa de origem, de pedidos antigos
- Quando o painel é desenhado
- Então fechada a linha, não aparecem; aberta, viram uma linha "+N cartões antigos de sessões"

Origem: commit 4edb3f2, 2026-10-21.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: coberto

### cabecalho.limite-de-linhas-do-desenho
O desenho tem no máximo 400 linhas; o que passa vira uma linha de contagem.

- Dado um painel com mais de 400 linhas
- Quando é desenhado
- Então saem blocos inteiros de pedidos do começo (os mais antigos), contados em "+N linhas anteriores"; se o último pedido sozinho passa do limite, ele é desenhado até o limite e fecha com "+N linhas" no fim dele; o desenho nunca passa de 400 linhas

Origem: decisão do usuário ("Sim, com o corte"), 2026-10-22; commit 1d55fa0 (o tamanho do desenho, 4edb3f2, 2026-10-21, levou a ele).
Reescrito: 2026-10-28, texto corrigido para o desenho aprovado em 2026-10-22 (sem mudança de regra).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Estado: coberto

### cabecalho.titulo-e-a-ultima-iniciada
O título do cabeçalho é o nível 1 da tarefa iniciada por último.

- Dado nada em andamento e uma tarefa iniciada por último
- Quando o cabeçalho é desenhado
- Então o título é o nível 1 que contém essa tarefa

Origem: decisão do usuário ("o título é o do passo iniciado por último", 2026-10-23); commit 16062cc.
Código: state/tasks.ts, hooks/tools.ts
Estado: coberto

### cabecalho.titulo-desempata-pela-ordem-do-start
Duas tarefas iniciadas no mesmo instante: vale a ordem do start.

- Dado um start com duas tarefas de planos diferentes, as duas concluídas depois
- Quando o cabeçalho é desenhado, sem nada em andamento
- Então o título é o nível 1 da última da lista do start, e só ele fica ◉

Origem: regra do painel; correção do empate achada no teste da tarefa 6, 2026-10-28.
Código: state/tasks.ts, hooks/tools.ts
Estado: coberto

### cabecalho.historico-abre-com-clique
"+N pedidos anteriores" abre e fecha com um clique.

- Dado pedidos fora do trabalho, cortados numa linha "+N pedidos anteriores"
- Quando a pessoa clica no ▸ dessa linha (fechada por padrão)
- Então os pedidos cortados são desenhados, a linha mostra ▾, e um clique de novo a fecha; o limite de 400 linhas do desenho continua valendo

Origem: decisão do usuário, 2026-11-03 ("Sim, fechado por padrão (Recomendado)"); pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc...".
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: draw/svg.ts, hooks/render.tsx
Estado: coberto

### cabecalho.historico-guarda-o-que-saiu
O que saiu do trabalho fica em "+N pedidos anteriores", com os cartões das filhas.

- Dado um pedido finalizado, com o cartão de uma filha, fora do trabalho
- Quando a pessoa abre a linha "+N pedidos anteriores"
- Então o pedido é desenhado, com o cartão e as tarefas da filha sob a tarefa de origem

Origem: decisão do usuário, 2026-11-04 ("Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: coberto
