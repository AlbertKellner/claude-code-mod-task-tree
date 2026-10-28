# Cabeçalho

Os números, chips e limites do cabeçalho e das visões.

### cabecalho.numeros-somam-o-desenhado
Os números do cabeçalho somam o que a visão desenha.

- Dado linhas recolhidas na visão
- Quando o cabeçalho é desenhado
- Então os números somam o que a visão mostra, e recolher não muda nada

Origem: decisão do usuário, 2026-10-23 ("deve somar as tarefas que estão sendo mostradas na listagem. a visão resumida mostra somente informacoes dessa visao"; "as colapsada, mas que estao nessa visao, tambem entram"); commit 3e79cb8.
Estado: coberto

### cabecalho.resumida-exclui-pedido-finalizado
A resumida tira o pedido finalizado quando um pedido novo começa trabalho.

- Dado um pedido de turno anterior todo concluído
- Quando um pedido novo começa trabalho (plan ou start)
- Então o finalizado sai da resumida e dos números dela; a completa o mantém e o conta

Origem: decisão do usuário, 2026-10-22 ("segundo a regra antiga, na visão resumida, ficam somente as tarefas novas do turno"); commit 6599050.
Estado: coberto

### cabecalho.resumida-limpa-so-com-tudo-concluido
A resumida só é limpa quando tudo à vista está concluído.

- Dado o trabalho de um pedido anterior todo concluído
- Quando um pedido novo começa trabalho
- Então a resumida mostra só o pedido novo (o par de pedidos.resumida-mantem-anteriores-com-algo-aberto)

Origem: decisão do usuário ("somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas"); commit 897c0d7.
Estado: coberto

### cabecalho.interrompida-fora-do-total
A interrompida fica fora do total.

- Dado uma tarefa ✕
- Quando o cabeçalho é desenhado
- Então ela sai do total e entra no chip "interrompidas"

Origem: regra do painel desde a entrada do mod (commit 465b09e, "Interrupted tasks are kept out of the done/total count"); reafirmada pelo usuário, 2026-10-24 ("interrompida fora do total, 3/5 → 3/3").
Estado: coberto

### cabecalho.chips-contam-folhas
Os chips contam só folhas, nunca pais nem tarefas de mensagem.

- Dado tarefas com filhas, tarefas de mensagem e folhas em cada estado
- Quando o cabeçalho é desenhado
- Então em andamento conta as folhas iniciadas, pendentes as não iniciadas, e a tarefa de mensagem só no chip ✉

Origem: regra do painel ("Open leaves only, a parent never"); tarefas de mensagem fora: decisão do usuário, 2026-10-24 ("quero diferenciar as tarefas de execução, das tarefas de mensagem"), commit 8eb801c.
Estado: coberto

### cabecalho.limites-de-linhas
Os pedidos além dos três últimos viram "+N pedidos anteriores".

- Dado mais de três pedidos, os antigos sem nada aberto
- Quando a completa é desenhada
- Então os mais antigos viram uma linha "+N pedidos anteriores", e o cabeçalho conta o que ficou à vista (a sessão inteira, à parte)

Origem: commit 4edb3f2, 2026-10-21 (o desenho de 1,6 MB que o app parou de mostrar).
Estado: coberto

### cabecalho.limite-de-cartoes-antigos
Os cartões antigos sem tarefa de origem viram "+N cartões antigos de sessões".

- Dado cartões parados, sem tarefa de origem, de pedidos antigos
- Quando a completa é desenhada
- Então eles viram uma linha "+N cartões antigos de sessões"

Origem: commit 4edb3f2, 2026-10-21.
Estado: pendente (cabecalho; o arranjo de 4 pedidos e um cartão sem âncora ainda não foi escrito)

### cabecalho.limite-de-linhas-do-desenho
Mais de 400 linhas viram "+N linhas anteriores/seguintes".

- Dado um painel com mais de 400 linhas
- Quando é desenhado
- Então as linhas além do limite viram "+N linhas anteriores" ou "+N linhas seguintes"

Origem: commit 4edb3f2, 2026-10-21.
Estado: pendente (cabecalho; não tentado: um plano de 400 linhas pode passar dos 5 s do teste)

### cabecalho.titulo-e-a-ultima-iniciada
O título do cabeçalho é o nível 1 da tarefa iniciada por último.

- Dado nada em andamento e uma tarefa iniciada por último
- Quando o cabeçalho é desenhado
- Então o título é o nível 1 que contém essa tarefa

Origem: decisão do usuário ("o título é o do passo iniciado por último", 2026-10-23); commit 16062cc.
Estado: pendente (cabecalho; diverge: com os planos A e B no mesmo pedido, start e done em b1 e depois em Um, o título fica "Plano B" e não "Plano A", e o Plano B segue ◉ sem nada iniciado)
