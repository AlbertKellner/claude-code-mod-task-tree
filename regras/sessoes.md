# Sessões

Os cartões das sessões filhas.

### sessoes.cartao-sob-a-tarefa-de-origem
O cartão da filha fica sob a tarefa de onde foi aberta.

- Dado uma sessão filha aberta a partir de uma tarefa
- Quando o painel é desenhado
- Então o cartão fica sob essa tarefa, ou sob a da última rodada; com várias tarefas em andamento, cada sessão nova vai à tarefa do lote recente ainda sem sessão nem mensagem

Origem: regra do painel desde a entrada do mod, 2026-10-20 (commit 465b09e); "cartão novo vai sob a tarefa que enviou a mensagem", 2026-10-21 (commit 5508b25).
Reescrito: 2026-10-28, decisão do usuário ("Tarefa sem sessão nem mensagem (Recomendado)... Abrir sessão conta como uso da tarefa"), achado da tarefa 7.
Estado: coberto

### sessoes.palavra-de-estado-do-cartao
O cartão diz em uma palavra o estado da filha, quando ela não está só trabalhando.

- Dado uma filha
- Quando ela trabalha, espera a pessoa, para com tarefas abertas, termina ou é arquivada
- Então o cartão não mostra palavra, ou mostra "aguardando", "parada", "concluída" ou "arquivada"

Origem: regra do painel ("Parada, não arquivada, com tarefa aberta", DESENVOLVIMENTO).
Estado: coberto

### sessoes.um-cartao-por-mensagem
Cada mensagem à filha, em turnos diferentes, tem o seu cartão.

- Dado duas mensagens à mesma filha, tratadas em turnos diferentes dela
- Quando o painel é desenhado
- Então há dois cartões, cada um sob a tarefa da sua mensagem

Origem: commit 4af1b92.
Estado: pendente (sessoes, rodadas)

### sessoes.cadeia-sem-cartao-dentro-de-cartao
Uma cadeia de filhas não põe cartão dentro de cartão.

- Dado filhas em sequência, uma aberta depois da outra
- Quando o painel é desenhado
- Então os cartões ficam em sequência, sem cartão dentro de cartão

Origem: commit fddd473, 2026-10-23.
Estado: pendente (sessoes, rodadas)

### sessoes.mensagem-entre-filhas-no-cartao-da-remetente
A mensagem entre filhas fica no cartão da remetente.

- Dado uma filha que manda mensagem a outra
- Quando o painel é desenhado
- Então a mensagem fica no cartão da remetente, sob a tarefa que a mandou

Origem: commit 28ae764, 2026-10-23.
Estado: pendente (sessoes, rodadas)

### sessoes.filha-trabalhando-mantem-pais-em-andamento
A filha trabalhando mantém a tarefa e os pais em andamento.

- Dado uma filha trabalhando sob uma tarefa
- Quando o modelo chama done nessa tarefa
- Então a tarefa e os pais seguem ◉ enquanto a filha trabalha

Origem: commit d956e11, 2026-10-24.
Estado: coberto

### sessoes.filha-parada-pendentes-seguem-pendentes
Na filha parada, as pendentes seguem pendentes.

- Dado uma filha que terminou o turno com pendentes
- Quando o cartão é desenhado
- Então as pendentes seguem ○ e entram no chip "pendentes"; a iniciada aberta ◷ (✕ se o turno foi interrompido)

Origem: decisão do usuário, 2026-10-27 ("pendentes nunca ✕", desfaz "reaproveitar o interrompida"); commit d57807e.
Estado: coberto

### sessoes.filha-arquivada-interrompe
A filha arquivada deixa interrompido o que ficou aberto.

- Dado uma filha arquivada com tarefas abertas
- Quando o cartão é desenhado
- Então o que ficou aberto fica ✕, e o pai com filha ✓ fica ◷

Origem: regra do painel desde a entrada do mod ("Arquivada fica, como histórico", DESENVOLVIMENTO); o pai ◷: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"), commit 95b1a21.
Estado: coberto

### sessoes.rodada-descartada-fora-da-contagem
A rodada descartada sai da contagem.

- Dado uma rodada de filha abandonada ou abortada
- Quando o painel conta as tarefas
- Então ela sai das contagens dos pais e do cabeçalho

Origem: commit bf77359, 2026-10-24.
Estado: pendente (sessoes, rodadas)

### sessoes.busto-so-no-pai
O busto da sessão só na tarefa de que o cartão pende.

- Dado uma tarefa com cartão de filha embaixo
- Quando o painel é desenhado
- Então o busto aparece só nela, não no pedido nem nos ancestrais

Origem: commit e570baa, 2026-10-24.
Estado: coberto

### sessoes.pasta-sem-git
A sessão numa pasta sem git mostra a pasta.

- Dado uma sessão numa pasta sem repositório
- Quando o cartão é desenhado
- Então mostra o ícone de pasta e o caminho, sem branch

Origem: commit 17f1140, 2026-10-24.
Estado: coberto

### sessoes.toks-e-repo-branch-no-cartao
O cartão mostra toks/s, repositório e branch.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado
- Então mostra "n toks/s", o repositório e a branch (a posição no app desktop: visual.cartao-posicao-de-toks-e-repo)

Origem: commits 1987482 e 689d569, 2026-10-24; dividida em conteúdo e posição por decisão do usuário, 2026-10-28.
Estado: coberto

### sessoes.mensagens-juntas-vao-a-ultima
Mensagens entregues juntas: o cartão vai à tarefa da última.

- Dado várias mensagens à mesma sessão entregues juntas
- Quando o turno dela começa
- Então o cartão do turno fica na tarefa da última mensagem

Origem: commit 8b67366, 2026-10-23.
Estado: pendente (sessoes, rodadas)
