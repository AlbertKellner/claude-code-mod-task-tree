# Cabeçalho

Os números, chips e limites do cabeçalho e das visões.

### cabecalho.numeros-somam-o-desenhado
Os números do cabeçalho somam o que a visão desenha.

- Dado linhas recolhidas na visão
- Quando o cabeçalho é desenhado
- Então os números somam o que a visão mostra, e recolher não muda nada

Origem: decisão do usuário ("deve somar"), 2026-10-23; commit 3e79cb8.
Estado: pendente (cabecalho)

### cabecalho.resumida-exclui-pedido-finalizado
A resumida exclui o pedido finalizado das contagens.

- Dado um pedido finalizado e outro aberto
- Quando a visão resumida é desenhada
- Então o finalizado sai das contagens do cabeçalho

Origem: regra do painel; a confirmar.
Estado: pendente (cabecalho)

### cabecalho.interrompida-fora-do-total
A interrompida fica fora do total.

- Dado uma tarefa ✕
- Quando o cabeçalho é desenhado
- Então ela sai do total e entra no chip "interrompidas"

Origem: regra do painel; a confirmar.
Estado: pendente (cabecalho)

### cabecalho.limites-de-linhas
Os limites de linhas viram "+N".

- Dado mais pedidos ou cartões do que o limite
- Quando o painel é desenhado
- Então os mais antigos viram uma linha "+N pedidos anteriores" ou "+N cartões antigos"

Origem: regra do painel; a confirmar.
Estado: pendente (cabecalho)

### cabecalho.titulo-e-a-ultima-iniciada
O título do cabeçalho é a última tarefa iniciada.

- Dado nada em andamento e uma tarefa iniciada por último
- Quando o cabeçalho é desenhado
- Então o título é essa tarefa

Origem: regra do painel; a confirmar.
Estado: pendente (cabecalho)
