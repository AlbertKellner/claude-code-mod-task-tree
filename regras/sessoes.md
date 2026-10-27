# Sessões

Os cartões das sessões filhas.

### sessoes.cartao-sob-a-tarefa-de-origem
O cartão da filha fica sob a tarefa de onde foi aberta.

- Dado uma sessão filha aberta a partir de uma tarefa
- Quando o painel é desenhado
- Então o cartão fica sob essa tarefa, ou sob a da última rodada

Origem: regra do painel; a confirmar.
Estado: pendente (sessoes)

### sessoes.cadeia-sem-cartao-dentro-de-cartao
Uma cadeia de filhas não põe cartão dentro de cartão.

- Dado filhas em sequência, uma aberta depois da outra
- Quando o painel é desenhado
- Então os cartões ficam em sequência, sem cartão dentro de cartão

Origem: commit fddd473, 2026-10-23.
Estado: pendente (sessoes)

### sessoes.mensagem-entre-filhas-no-cartao-da-remetente
A mensagem entre filhas fica no cartão da remetente.

- Dado uma filha que manda mensagem a outra
- Quando o painel é desenhado
- Então a mensagem fica no cartão da remetente, sob a tarefa que a mandou

Origem: commit 28ae764, 2026-10-23.
Estado: pendente (sessoes)

### sessoes.filha-trabalhando-mantem-pais-em-andamento
A filha trabalhando mantém a tarefa e os pais em andamento.

- Dado uma filha trabalhando sob uma tarefa
- Quando o modelo chama done nessa tarefa
- Então a tarefa e os pais seguem ◉ enquanto a filha trabalha

Origem: commit d956e11, 2026-10-24.
Estado: pendente (sessoes)

### sessoes.filha-parada-pendentes-seguem-pendentes
Na filha parada, as pendentes seguem pendentes.

- Dado uma filha que terminou o turno com pendentes
- Quando o cartão é desenhado
- Então as pendentes seguem ○ e entram no chip "pendentes"; a iniciada aberta ◷

Origem: decisão do usuário, 2026-10-27; commit d57807e.
Estado: checklist (até o kit ter stub do host)

### sessoes.filha-arquivada-interrompe
A filha arquivada deixa interrompido o que ficou aberto.

- Dado uma filha arquivada com tarefas abertas
- Quando o cartão é desenhado
- Então o que ficou aberto fica ✕, e o pai com filha ✓ fica ◷

Origem: regra do painel; a confirmar.
Estado: checklist (até o kit ter stub do host)

### sessoes.rodada-descartada-fora-da-contagem
A rodada descartada sai da contagem.

- Dado uma rodada de filha abandonada ou abortada
- Quando o painel conta as tarefas
- Então ela sai das contagens dos pais e do cabeçalho

Origem: commit bf77359, 2026-10-24.
Estado: pendente (sessoes)

### sessoes.busto-so-no-pai
O busto da sessão só na tarefa de que o cartão pende.

- Dado uma tarefa com cartão de filha embaixo
- Quando o painel é desenhado
- Então o busto aparece só nela, não no pedido nem nos ancestrais

Origem: commit e570baa, 2026-10-24.
Estado: pendente (sessoes)

### sessoes.pasta-sem-git
A sessão numa pasta sem git mostra a pasta.

- Dado uma sessão numa pasta sem repositório
- Quando o cartão é desenhado
- Então mostra o ícone de pasta e o caminho, sem branch

Origem: commit 17f1140, 2026-10-24.
Estado: pendente (sessoes)

### sessoes.toks-por-segundo-e-repo-branch
O cartão mostra toks/s, repositório e branch.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado
- Então mostra "n toks/s" à esquerda do modelo e o repositório e a branch à direita do nome

Origem: commits 1987482 e 689d569, 2026-10-24.
Estado: checklist (valores reais do host)
