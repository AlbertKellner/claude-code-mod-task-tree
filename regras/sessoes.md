# Sessões

Os cartões das sessões filhas.

Código da área: hooks/sessions.ts, io/host.ts, io/publish.ts, draw/layout.ts

### sessoes.cartao-sob-a-tarefa-de-origem
O cartão da filha fica sob a tarefa de onde foi aberta.

- Dado uma sessão filha aberta a partir de uma tarefa
- Quando o painel é desenhado
- Então o cartão fica sob essa tarefa, ou sob a da última rodada; com várias tarefas em andamento, cada sessão nova vai à tarefa do lote recente ainda sem sessão nem mensagem; um turno que o usuário abriu digitando na filha vai ao pedido vigente da mãe (sessoes.turno-proprio-da-filha-no-pedido-vigente)

Origem: regra do painel desde a entrada do mod, 2026-10-20 (commit 465b09e); "cartão novo vai sob a tarefa que enviou a mensagem", 2026-10-21 (commit 5508b25).
Reescrito: 2026-10-28, decisão do usuário ("Tarefa sem sessão nem mensagem (Recomendado)... Abrir sessão conta como uso da tarefa"), achado da tarefa 7.
Reescrito: 2026-11-03, decisão do usuário ("No pedido vigente da orquestradora (Recomendado)"), pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc..."; desfaz, para o turno próprio da filha, "turno aberto direto pelo usuário na filha vira cartão próprio, sem âncora, no fim do pedido de origem".
Código: hooks/panel.ts
Estado: coberto

### sessoes.palavra-de-estado-do-cartao
O cartão diz em uma palavra o estado da filha, quando ela não está só trabalhando.

- Dado uma filha
- Quando ela trabalha, espera a pessoa, para com tarefas abertas, para com a origem fechada e só pendentes, termina ou é arquivada
- Então o cartão não mostra palavra, ou mostra "aguardando", "parada", "encerrada", "concluída" ou "arquivada"

Origem: regra do painel ("Parada, não arquivada, com tarefa aberta", DESENVOLVIMENTO).
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓"); o teste da filha arquivada, que cobre também esta regra, passa a ver o pai ✓.
Reescrito: 2026-11-04, decisão do usuário ("Origem fechada (Recomendado)"): a palavra "encerrada".
Estado: coberto

### sessoes.um-cartao-por-mensagem
Cada mensagem à filha, em turnos diferentes, tem o seu cartão.

- Dado duas mensagens à mesma filha, tratadas em turnos diferentes dela
- Quando o painel é desenhado
- Então há dois cartões, cada um sob a tarefa da sua mensagem

Origem: decisão do usuário, 2026-10-21 ("filha ocupada que recebe mensagem nova tem o painel duplicado; o cartão antigo fica onde estava e o novo vai sob a tarefa da principal que mandou a mensagem", DESENVOLVIMENTO); commits 4af1b92 e 5508b25.
Estado: coberto

### sessoes.cadeia-sem-cartao-dentro-de-cartao
Uma cadeia de filhas não põe cartão dentro de cartão.

- Dado filhas em sequência, uma aberta depois da outra
- Quando o painel é desenhado
- Então os cartões ficam em sequência, sem cartão dentro de cartão: sob a tarefa da mãe que iniciou a cadeia, no mesmo nível, na ordem de execução

Origem: decisão do usuário, 2026-10-23 ("quando uma tarefa chama uma sessão, o painel não deve ficar dentro de outro; deve ficar na sequência em que será executado"); commit fddd473.
Estado: coberto

### sessoes.mensagem-entre-filhas-no-cartao-da-remetente
A mensagem entre filhas fica no cartão da remetente.

- Dado uma filha que manda mensagem a uma irmã
- Quando o painel é desenhado
- Então a tarefa da mensagem, com o ✉, fica no cartão da remetente, e o cartão da destinatária fica na sequência sob a tarefa da mãe, não dentro do cartão da remetente

Origem: commit 28ae764, 2026-10-23; o cartão dentro do cartão foi desfeito por fddd473 no mesmo dia ("o painel não deve ficar dentro de outro").
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é a linha sob a tarefa, no cartão da remetente.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.filha-trabalhando-mantem-pais-em-andamento
A filha trabalhando mantém a tarefa e os pais em andamento.

- Dado uma filha trabalhando sob uma tarefa
- Quando o modelo chama done nessa tarefa
- Então a tarefa e os pais seguem ◉ enquanto a filha trabalha

Origem: commit d956e11, 2026-10-24.
Estado: coberto

### sessoes.filha-parada-com-origem-fechada-sai-da-contagem
As pendentes de uma filha parada saem da contagem quando a tarefa de origem fecha.

- Dado uma filha parada só com pendentes, sem nada iniciado aberto, sem mensagem da mãe na fila, sem esperar a pessoa
- Quando a tarefa de origem do cartão na mãe está fechada
- Então as pendentes saem do cabeçalho, do chip e do x/y do pai, e não seguram a visão; as ✓ seguem contando; o cartão fica desenhado com as ○ e a palavra "encerrada"; a mãe é avisada de que ela parou com N pendentes; se a filha voltar a trabalhar, tudo volta a contar

Origem: decisão do usuário, 2026-11-04 ("Origem fechada (Recomendado)"), ao pedido "entao pq esse card de plano esta parado? analise se é um bug do mod, ou se podemos fazer melhoria. ele ja deveria estar encerrado".
Código: draw/layout.ts, hooks/sessions.ts, hooks/render.tsx
Estado: coberto

### sessoes.filha-parada-pendentes-seguem-pendentes
Na filha parada, as pendentes seguem pendentes.

- Dado uma filha que terminou o turno com pendentes, com a tarefa de origem aberta ou algo iniciado
- Quando o cartão é desenhado
- Então as pendentes seguem ○ e entram no chip "pendentes"; a iniciada aberta ◷ (✕ se o turno foi interrompido); um cartão publicado sem trabalho mostra o último pedido com tarefas, e sem pedidos, todas as tarefas de nível 1

Origem: decisão do usuário, 2026-10-27 ("pendentes nunca ✕", desfaz "reaproveitar o interrompida"); commit d57807e.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); sem visão completa, o cartão sem `work` não pode mostrar uma tarefa só.
Reescrito: 2026-11-04, decisão do usuário ("Origem fechada (Recomendado)"); com a origem fechada e só pendentes vale sessoes.filha-parada-com-origem-fechada-sai-da-contagem.
Estado: coberto

### sessoes.filha-arquivada-interrompe
A filha arquivada deixa interrompido o que ficou aberto.

- Dado uma filha arquivada com tarefas abertas
- Quando o cartão é desenhado
- Então o que ficou aberto fica ✕, e o pai fica ✓

Origem: regra do painel desde a entrada do mod ("Arquivada fica, como histórico", DESENVOLVIMENTO); o pai ◷: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"), commit 95b1a21.
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓").
Estado: coberto

### sessoes.rodada-descartada-fora-da-contagem
A rodada descartada sai da contagem.

- Dado uma rodada anterior deixada com tarefa aberta quando a seguinte começa, ou a sessão parada com Esc com tarefa aberta
- Quando o painel conta as tarefas
- Então as tarefas dela, ✓ inclusive, saem do cabeçalho e do chip "interrompidas"; o cartão continua desenhado

Origem: decisão do usuário, 2026-10-24 ("as tarefas dessa sessão foram descartadas"); commit bf77359.
Reescrito: 2026-10-28, decisão do usuário ("Sim, corrigir (Recomendado)... o teste esperava o valor do bug; decisão de 2026-10-24 mantida"): a rodada descartada é a anterior, não a que está trabalhando.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa que enviou a mensagem passa a contar no total.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.rodada-descartada-fora-da-contagem-do-pai
A rodada descartada sai também do x/y da tarefa da mãe.

- Dado uma rodada anterior da filha deixada com uma tarefa ✓ e outra aberta, sob "Um"
- Quando o painel conta as tarefas da linha "Um"
- Então o x/y de "Um" não conta as tarefas dessa rodada

Origem: decisão do usuário, 2026-10-24 ("as tarefas dessa sessão foram descartadas"); commit bf77359.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa que enviou a mensagem passa a contar no total.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.busto-so-no-pai
O busto da sessão só na tarefa de que o cartão pende.

- Dado uma tarefa com cartão de filha embaixo
- Quando o painel é desenhado
- Então o busto aparece só nela, não no pedido nem nos ancestrais

Origem: commit e570baa, 2026-10-24.
Código: draw/svg.ts
Estado: coberto

### sessoes.pasta-sem-git
A sessão numa pasta sem git mostra a pasta.

- Dado uma sessão numa pasta sem repositório
- Quando o cartão é desenhado
- Então mostra o ícone de pasta e o caminho, sem branch

Origem: commit 17f1140, 2026-10-24.
Código: draw/svg.ts, io/git.ts
Estado: coberto

### sessoes.toks-e-repo-branch-no-cartao
O cartão mostra toks/s, repositório e branch.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado
- Então mostra "n toks/s", o repositório e a branch (a posição no app desktop: visual.cartao-posicao-de-toks-e-repo)

Origem: commits 1987482 e 689d569, 2026-10-24; dividida em conteúdo e posição por decisão do usuário, 2026-10-28.
Código: draw/svg.ts, io/git.ts
Estado: coberto

### sessoes.mensagens-juntas-vao-a-ultima
Mensagens entregues juntas: o cartão vai à tarefa da última.

- Dado várias mensagens à mesma sessão entregues juntas
- Quando o turno dela começa
- Então o cartão do turno fica na tarefa da última mensagem

Origem: decisão do usuário, 2026-10-23 ("quero ver as tarefas lineares andando de cima para baixo; as paralelas andam fora de ordem, normal, mas as lineares precisam seguir uma linha do tempo"); commit 8b67366.
Estado: coberto

### sessoes.pedido-recebido-aparece-no-cartao
No cartão da filha, o pedido que veio por mensagem tem a sua linha, com a carta.

- Dado uma filha que recebeu uma mensagem e planejou as tarefas dela, mesmo uma só
- Quando o cartão é desenhado na sessão que a abriu
- Então a linha do pedido aparece com o ✉ de recebida, e as tarefas embaixo com o ícone comum (exceção à regra de que um pedido de uma tarefa só não tem linha no cartão)

Origem: decisão do usuário, 2026-10-30 ("Sim, uma carta por mensagem (Recomendado)": a linha do pedido aparece sempre no cartão da filha, até com uma tarefa só).
Código: draw/layout.ts
Estado: coberto

### sessoes.turno-proprio-da-filha-no-pedido-vigente
O turno que o usuário abriu digitando na filha fica no pedido da mãe vigente quando ele digitou.

- Dado uma filha aberta num pedido antigo da mãe, e o usuário digitando direto nela depois de um pedido novo da mãe
- Quando a mãe desenha o painel
- Então o cartão desse turno fica no fim do pedido da mãe vigente quando ele digitou (o último pedido da mãe planejado antes; sem nenhum, o de origem), com "pedido do usuário na filha" no título e o texto digitado no tooltip; enquanto a filha trabalha nele, o pedido onde ele está segue desenhado

Origem: decisão do usuário, 2026-11-03 ("No pedido vigente da orquestradora (Recomendado)"); pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc...". O pedido mantido enquanto a filha trabalha corrige um defeito: a conta de "sessão trabalhando sob o pedido" olhava só a rodada da última mensagem.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Código: draw/layout.ts
Estado: coberto

### sessoes.turno-de-abertura-da-filha-sob-a-origem
O turno que abriu a filha (o texto do start_session) não é pedido do usuário na filha, mesmo quando ela o publica como próprio.

- Dado uma filha aberta a partir de uma tarefa, que publica o primeiro turno marcado como próprio (os arquivos publicados reais trazem a marca)
- Quando a mãe desenha o painel
- Então o cartão desse turno fica sob a tarefa de origem, com o nome simples, sem "pedido do usuário na filha"; um turno 1 marcado como próprio que começa bem depois da abertura (a filha limpa com /clear, os turnos recomeçam) segue como pedido do usuário na filha (sessoes.turno-proprio-da-filha-no-pedido-vigente)

Origem: auditoria 2026-11-10 (o primeiro turno da filha é marcado como pedido do usuário na filha); aplica sessoes.cartao-sob-a-tarefa-de-origem e sessoes.turno-proprio-da-filha-no-pedido-vigente ("O turno que o usuário abriu digitando na filha"), sem mudar nenhuma das duas.
Código: draw/layout.ts
Estado: coberto

### sessoes.cartao-vivo-nunca-some
Um cartão com a sessão trabalhando ou com tarefa aberta nunca some.

- Dado um cartão vivo (sessão trabalhando ou tarefa aberta) sob um pedido que saiu de vista ("+N pedidos anteriores" fechada)
- Quando o painel é desenhado
- Então o cartão é desenhado solto no fim do painel, com o nome do pedido de origem no título; o pedido antigo não volta; cartões parados e concluídos ficam na linha

Origem: decisão do usuário, 2026-11-03 ("Cartão vivo solto no fim (Recomendado)"); pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc...". Reescreve, só para o cartão vivo, a decisão de 2026-10-23 da resumida ("não traz o pedido de volta, nem o cartão é desenhado solto").
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Código: draw/layout.ts
Estado: coberto

