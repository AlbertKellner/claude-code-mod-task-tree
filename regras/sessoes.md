# Sessões

Os cartões das sessões filhas.

Código da área: hooks/sessions.ts, io/host.ts, io/publish.ts, draw/layout.ts

### sessoes.cartao-sob-a-tarefa-de-origem
O cartão da filha fica sob a tarefa de onde foi aberta.

- Dado uma sessão filha aberta a partir de uma tarefa
- Quando o painel é desenhado
- Então o cartão fica sob essa tarefa, ou sob a da última rodada; com várias tarefas em andamento, cada sessão nova vai à tarefa do lote recente ainda sem sessão nem mensagem; um turno que o usuário abriu digitando na filha vai à tarefa que a mãe tinha em andamento quando ele digitou, senão à tarefa da própria filha no pedido vigente, senão ao fim do pedido vigente (sessoes.turno-proprio-da-filha-no-pedido-vigente); a sessão aberta num pedido ainda sem plano fica solta até o plan (sessoes.aberta-antes-do-plan-e-adotada)

Origem: regra do painel desde a entrada do mod, 2026-10-20 (commit 85744cb); "cartão novo vai sob a tarefa que enviou a mensagem", 2026-10-21 (commit b90ec6e).
Reescrito: 2026-10-28, decisão do usuário ("Tarefa sem sessão nem mensagem (Recomendado)... Abrir sessão conta como uso da tarefa"), achado da tarefa 7.
Reescrito: 2026-11-03, decisão do usuário ("No pedido vigente da orquestradora (Recomendado)"), pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc..."; desfaz, para o turno próprio da filha, "turno aberto direto pelo usuário na filha vira cartão próprio, sem âncora, no fim do pedido de origem".
Reescrito: 2026-11-14, decisão do usuário ("Sim, o plan adota (Recomendado)"): a sessão aberta num pedido ainda sem plano fica solta até o plan.
Código: hooks/panel.ts
Estado: coberto

### sessoes.palavra-de-estado-do-cartao
O cartão diz em uma palavra o estado da filha, quando ela não está só trabalhando.

- Dado uma filha
- Quando ela trabalha, espera a pessoa, para com tarefas abertas, para porque o turno dela morreu por erro, para com a origem fechada e só pendentes, termina ou é arquivada
- Então o cartão não mostra palavra, ou mostra "aguardando", "parada", "falhou", "encerrada", "concluída", "arquivada" ou, no cartão da rodada largada, "substituída"

Origem: regra do painel ("Parada, não arquivada, com tarefa aberta", DESENVOLVIMENTO), no repositório desde 2026-10-21.
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓"); o teste da filha arquivada, que cobre também esta regra, passa a ver o pai ✓.
Reescrito: 2026-11-04, decisão do usuário ("Origem fechada (Recomendado)"): a palavra "encerrada".
Reescrito: 2026-11-14, decisão do usuário ("✕ \"falhou\" (Recomendado)": "o cartão desta sessão na mãe indica a falha"): a palavra "falhou". Os testes existentes não mudam.
Reescrito: 2026-11-14, decisão do usuário ("\"Substituída\", cinza (Recomendado)"): a palavra "substituída". Os testes existentes não mudam.
Estado: coberto

### sessoes.recem-aberta-sem-tarefas-trabalha
A sessão recém-aberta que ainda não publicou tarefas é desenhada trabalhando, não "concluída".

- Dado uma sessão filha que acabou de ser aberta, que o app ainda lista parada e que ainda não publicou nenhuma tarefa
- Quando o painel é desenhado nos 2 minutos seguintes à abertura
- Então o cartão aparece sem palavra, como sessão trabalhando, a tarefa de origem fica ◉ e a sessão conta entre as ativas; quando o app a mostra rodando, segue assim; passados os 2 minutos sem ela rodar nem publicar, vale o que o app diz (parada e sem tarefas: "concluída"); a sessão que já publicou tarefas é desenhada pelo que o app diz dela, como antes

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: logo depois de aberta, o cartão podia nascer "concluída" e a tarefa de origem apagada; se a sessão nunca rodasse, ficava assim para sempre); dedução, sem decisão do usuário: o resto do painel já trata a sessão abrindo como viva; a confirmar.
Código: io/host.ts
Estado: coberto

### sessoes.abriu-e-parou-sem-ser-vista-rodando
A sessão que abre, trabalha e para antes de o painel a ver rodando é tratada como quem já rodou.

- Dado uma sessão filha recém-aberta que o app lista parada e que já publicou tarefas
- Quando o painel a lê pela primeira vez
- Então ela deixa de contar como abrindo: o cartão mostra o que o app diz ("parada" com tarefa aberta, "concluída" com tudo feito), o modelo recebe uma vez o lembrete de que ela terminou o turno com a tarefa de origem aberta (lembretes.filha-terminou-o-turno), e com só pendentes e a origem fechada ela passa a "encerrada" (sessoes.filha-parada-com-origem-fechada-sai-da-contagem); a que ainda não publicou tarefas segue desenhada trabalhando (sessoes.recem-aberta-sem-tarefas-trabalha)

Origem: decisão do usuário, 2026-11-15 ("Tratar como quem já rodou (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a marca de abrindo ficava para sempre: sem lembrete e sem "encerrada").
Código: io/host.ts
Estado: coberto

### sessoes.rodada-largada-diz-substituida
O cartão da rodada que a filha largou diz "substituída", em cinza.

- Dado duas mensagens à mesma filha, de tarefas diferentes, e a filha larga uma tarefa aberta da primeira ao passar à segunda
- Quando o painel é desenhado, com a filha rodando ou parada
- Então o cartão da primeira mostra a palavra "substituída" e o busto cinza, sem contar como sessão ativa; as tarefas dele seguem desenhadas e fora da contagem (sessoes.rodada-descartada-fora-da-contagem); o cartão da rodada atual segue com o estado da filha; a rodada mais nova que ainda espera a vez não é "substituída"

Origem: decisão do usuário, 2026-11-14 ("\"Substituída\", cinza (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (dois cartões com o mesmo nome, sem dizer qual vale).
Código: draw/desktop.tsx, draw/svg.ts
Estado: coberto

### sessoes.um-cartao-por-mensagem
Cada mensagem à filha, em turnos diferentes, tem o seu cartão.

- Dado duas mensagens à mesma filha, tratadas em turnos diferentes dela
- Quando o painel é desenhado
- Então há dois cartões, cada um sob a tarefa da sua mensagem

Origem: decisão do usuário, 2026-10-21 ("filha ocupada que recebe mensagem nova tem o painel duplicado; o cartão antigo fica onde estava e o novo vai sob a tarefa da principal que mandou a mensagem", DESENVOLVIMENTO); commits 726a925 e b90ec6e.
Estado: coberto

### sessoes.cadeia-sem-cartao-dentro-de-cartao
Uma cadeia de filhas não põe cartão dentro de cartão.

- Dado filhas em sequência, uma aberta depois da outra
- Quando o painel é desenhado
- Então os cartões ficam em sequência, sem cartão dentro de cartão: sob a tarefa da mãe que iniciou a cadeia, no mesmo nível, na ordem de execução

Origem: decisão do usuário, 2026-10-23 ("quando uma tarefa chama uma sessão, o painel não deve ficar dentro de outro; deve ficar na sequência em que será executado"); commit bd0b1b3.
Estado: coberto

### sessoes.mensagem-entre-filhas-no-cartao-da-remetente
A mensagem entre filhas fica no cartão da remetente.

- Dado uma filha que manda mensagem a uma irmã
- Quando o painel é desenhado
- Então a tarefa da mensagem, com o ✉, fica no cartão da remetente, e o cartão da destinatária fica na sequência sob a tarefa da mãe, não dentro do cartão da remetente

Origem: commit 0bbf4b2, 2026-10-23; o cartão dentro do cartão foi desfeito por bd0b1b3 no mesmo dia ("o painel não deve ficar dentro de outro").
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a carta é a linha sob a tarefa, no cartão da remetente.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.filha-trabalhando-mantem-pais-em-andamento
A filha trabalhando mantém a tarefa e os pais em andamento.

- Dado uma filha trabalhando sob uma tarefa
- Quando o modelo chama done nessa tarefa
- Então a tarefa e os pais seguem ◉ enquanto a filha trabalha

Origem: decisão do usuário, 2026-10-24 ("as linhas pai anteriores somente deveriam ficar como concluídas, quando as filhas fossem concluídas"); commit 8637626. Desfaz "um done explícito da mãe deve valer como concluído" (2026-10-23, commit a818dae).
Estado: coberto

### sessoes.filha-parada-com-origem-fechada-sai-da-contagem
As pendentes de uma filha parada saem da contagem quando a tarefa de origem fecha.

- Dado uma filha parada só com pendentes, sem nada iniciado aberto, sem mensagem da mãe na fila, sem esperar a pessoa
- Quando a tarefa de origem do cartão na mãe está fechada
- Então as pendentes saem do cabeçalho, do chip e do x/y do pai, e não seguram a visão; as ✓ seguem contando; o cartão fica desenhado com as ○ e a palavra "encerrada"; a mãe é avisada de que ela parou com N pendentes; se a filha voltar a trabalhar, tudo volta a contar

Origem: decisão do usuário, 2026-11-04 ("Origem fechada (Recomendado)"), ao pedido "entao pq esse card de plano esta parado? analise se é um bug do mod, ou se podemos fazer melhoria. ele ja deveria estar encerrado"; o aviso nas duas ordens (filha para antes ou depois de a origem fechar), auditoria 2026-11-10.
Código: draw/layout.ts, hooks/sessions.ts, hooks/render.tsx
Estado: coberto

### sessoes.filha-parada-pendentes-seguem-pendentes
Na filha parada, as pendentes seguem pendentes.

- Dado uma filha que terminou o turno com pendentes, com a tarefa de origem aberta ou algo iniciado
- Quando o cartão é desenhado
- Então as pendentes seguem ○ e entram no chip "pendentes"; a iniciada aberta ◷ (✕ se o turno foi interrompido); com o turno interrompido (Esc), a rodada inteira sai da contagem da mãe: as pendentes seguem desenhadas ○, mas fora do cabeçalho, do chip e do x/y da tarefa de origem, até o start na tarefa parada (sessoes.rodada-descartada-fora-da-contagem); um cartão publicado sem trabalho mostra o último pedido com tarefas, e sem pedidos, todas as tarefas de nível 1

Origem: decisão do usuário, 2026-10-27 ("pendentes nunca ✕", desfaz "reaproveitar o interrompida"); commit cd96021.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); sem visão completa, o cartão sem `work` não pode mostrar uma tarefa só.
Reescrito: 2026-11-04, decisão do usuário ("Origem fechada (Recomendado)"); com a origem fechada e só pendentes vale sessoes.filha-parada-com-origem-fechada-sai-da-contagem.
Reescrito: 2026-11-14, decisão do usuário ("Rodada fora da conta (Recomendado)"); só o texto ganha a exceção que o código já fazia. Os testes não mudam.
Estado: coberto

### sessoes.filha-arquivada-interrompe
A filha arquivada deixa interrompido o que ficou aberto.

- Dado uma filha arquivada com tarefas abertas, com o pedido dela no trabalho atual
- Quando o cartão é desenhado
- Então o que ficou aberto, iniciado ou nunca iniciado, fica ✕, e o pai fica ✓

Origem: regra do painel desde a entrada do mod ("Arquivada fica, como histórico", DESENVOLVIMENTO); o pai ◷: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"), commit af4a524, 2026-10-27.
Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"; pai com só ✕ embaixo: "Fica ✓").
Reescrito: 2026-11-14, decisão do usuário ("Vira linha resumida (Recomendado)"); desfaz "Arquivada fica, como histórico" para o pedido que saiu do trabalho, onde ela vira uma linha (sessoes.arquivada-antiga-vira-linha). O teste não muda.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Como hoje, ✕ (Recomendado)"): a pendente da filha arquivada fica ✕. O teste não muda.
Estado: coberto

### sessoes.arquivada-nao-e-relida
O arquivo de uma filha arquivada não é relido enquanto ela segue arquivada.

- Dado uma sessão filha arquivada, já lida uma vez nesse estado
- Quando o painel relê as sessões
- Então o arquivo dela não é aberto de novo, e o cartão segue como estava (as tarefas, a palavra "arquivada", o anel apagado); desarquivada, volta a ser lida

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: toda leitura de 3 s relia o arquivo de cada arquivada); higiene, sem mudar sessoes.filha-arquivada-interrompe.
Código: io/host.ts
Estado: coberto

### sessoes.publicado-corta-a-profundidade
O painel publicado leva só os níveis de sessões que a sessão de cima ainda usa.

- Dado uma cadeia de sessões abertas umas pelas outras, com mais de três níveis abaixo desta
- Quando esta sessão publica o painel
- Então o arquivo leva as filhas, as netas e as bisnetas com as tarefas de cada uma, e nada abaixo das bisnetas; o painel desta sessão e o cartão dela na mãe mostram o mesmo de antes

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: as filhas eram republicadas aninhadas sem corte, além da profundidade que o desenho segue).
Código: hooks/panel.ts, draw/layout.ts
Estado: coberto

### sessoes.rodada-descartada-fora-da-contagem
A rodada descartada sai da contagem.

- Dado uma rodada anterior deixada com tarefa aberta quando a seguinte começa, ou a sessão parada com Esc com tarefa aberta
- Quando o painel conta as tarefas
- Então as tarefas dela, ✓ inclusive, saem do cabeçalho e do chip "interrompidas"; o cartão continua desenhado

Origem: decisão do usuário, 2026-10-24 ("as tarefas dessa sessão foram descartadas"); commit 93a01cc.
Reescrito: 2026-10-28, decisão do usuário ("Sim, corrigir (Recomendado)... o teste esperava o valor do bug; decisão de 2026-10-24 mantida"): a rodada descartada é a anterior, não a que está trabalhando.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa que enviou a mensagem passa a contar no total.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.filha-parada-com-esc-sem-pendente
A filha parada com Esc que não deixou pendente é descartada como a que deixou.

- Dado uma filha com uma tarefa ✓ e outra iniciada, sem pendente nunca iniciada
- Quando o usuário a para com Esc e a mãe desenha o painel
- Então a iniciada fica ✕ e conta como a tarefa aberta da sessão parada com Esc: as duas saem do cabeçalho, do chip "interrompidas" e do x/y da tarefa de origem (sessoes.rodada-descartada-fora-da-contagem, sessoes.rodada-descartada-fora-da-contagem-do-pai); o cartão continua desenhado, com a palavra "parada" (parou com tarefa aberta, sessoes.palavra-de-estado-do-cartao), não "concluída"

Origem: auditoria 2026-11-10 (filha parada com Esc: o descarte era decidido depois de o Esc deixar a iniciada ✕, então sem pendente a ✓ contava e o cartão dizia "concluída"; com uma pendente, tudo saía da contagem); aplica sessoes.rodada-descartada-fora-da-contagem (decisão do usuário, 2026-10-24: "as tarefas dessa sessão foram descartadas") e sessoes.palavra-de-estado-do-cartao, sem mudar nenhuma das duas.
Código: draw/layout.ts
Estado: coberto

### sessoes.filha-parada-com-esc-segue-descartada-ate-o-start
A filha parada com Esc segue rodada descartada até dar start na tarefa parada.

- Dado uma filha parada com Esc com uma tarefa iniciada, que depois tratou outro turno (um aviso, ou o start em outra tarefa) e o terminou normalmente
- Quando a mãe desenha o cartão dela, parada
- Então a tarefa parada segue ✕ e a rodada segue descartada (fora do cabeçalho, do chip "interrompidas" e do x/y da tarefa de origem; o cartão diz "parada"), e a outra iniciada aguarda ◷; enquanto a filha trabalha, o cartão já mostra a parada ✕; quando a filha dá start na tarefa parada, a rodada volta a contar

Origem: decisão do usuário, 2026-11-12 ("Segue ✕ até novo start (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (depois do turno de um aviso, o cartão da filha parada com Esc voltava a contar, com a tarefa ◷); aplica sessoes.rodada-descartada-fora-da-contagem (decisão do usuário, 2026-10-24: "as tarefas dessa sessão foram descartadas"), sem mudá-la.
Código: draw/layout.ts, state/tasks.ts, hooks/turn.ts
Estado: coberto

### sessoes.cartao-parado-sem-pedidos-anteriores-a-mais
O cartão da filha parada só mostra "+N pedidos anteriores" quando há pedido dela fora do desenho.

- Dado uma filha parada (não trabalhando, não arquivada), com um turno só, que deixou um pai aberto (só pendentes embaixo) ou uma folha iniciada, parada normalmente ou com Esc
- Quando a mãe desenha o cartão
- Então o cartão mostra as tarefas dela e nenhuma linha "+N pedidos anteriores", porque nada ficou fora; a linha segue aparecendo quando um pedido da filha sai do desenho (cabecalho.limites-de-linhas)

Origem: auditoria 2026-11-10 (a linha aparecia dentro do cartão da filha parada sem nada escondido, e aberta não mostrava nada novo: o cartão parado era lido duas vezes e as tarefas abertas da segunda leitura não eram reconhecidas como as da primeira); aplica cabecalho.limites-de-linhas ("Os pedidos fora do trabalho viram '+N pedidos anteriores'") e cabecalho.historico-guarda-o-que-saiu (decisão do usuário, 2026-11-04: "Ficam em '+N pedidos anteriores' (Recomendado)"), sem mudar nenhuma das duas.
Código: draw/layout.ts
Estado: coberto

### sessoes.rodada-descartada-fora-da-contagem-do-pai
A rodada descartada sai também do x/y da tarefa da mãe.

- Dado uma rodada anterior da filha deixada com uma tarefa ✓ e outra aberta, sob "Um"
- Quando o painel conta as tarefas da linha "Um"
- Então o x/y de "Um" não conta as tarefas dessa rodada

Origem: decisão do usuário, 2026-10-24 ("as tarefas dessa sessão foram descartadas"); commit 93a01cc.
Reescrito: 2026-10-30, decisão do usuário ("a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria"; "A: linha própria sob a tarefa (Recomendado)"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"); a tarefa que enviou a mensagem passa a contar no total.
Reescrito: 2026-11-04, validado pelo usuário no app ("Funcionou").
Estado: coberto

### sessoes.busto-so-no-pai
O busto da sessão só na tarefa de que o cartão pende.

- Dado uma tarefa com cartão de filha embaixo
- Quando o painel é desenhado
- Então o busto aparece só nela, não no pedido nem nos ancestrais

Origem: commit b3a9499, 2026-10-24.
Código: draw/svg.ts, draw/desktop.tsx, draw/icons.ts
Estado: coberto

### sessoes.pasta-sem-git
A sessão numa pasta sem git mostra a pasta.

- Dado uma sessão numa pasta sem repositório
- Quando o cartão é desenhado
- Então mostra o ícone de pasta e o caminho, sem branch

Origem: commit d88e930, 2026-10-24.
Código: draw/svg.ts, io/git.ts, draw/desktop.tsx, draw/icons.ts
Estado: coberto

### sessoes.toks-e-repo-branch-no-cartao
O cartão mostra toks/s, repositório e branch.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado
- Então mostra "n toks/s", o repositório e a branch (a posição no app desktop: visual.cartao-posicao-de-toks-e-repo)

Origem: commits 1a3dc9f e 2cd2beb, 2026-10-24; dividida em conteúdo e posição por decisão do usuário, 2026-10-28.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("O do repositório principal (Recomendado)"): numa worktree, "o repositório" é o principal (sessoes.worktree-mostra-o-repositorio-principal). Os testes deste cenário não mudam.
Código: draw/svg.ts, io/git.ts, draw/desktop.tsx, draw/icons.ts
Estado: coberto

### sessoes.worktree-mostra-o-repositorio-principal
Numa worktree, o cartão e o cabeçalho mostram o repositório principal.

- Dado uma sessão cuja pasta é uma worktree de um repositório (com o `.git` dela apontando para o principal por caminho absoluto ou relativo)
- Quando o cabeçalho dela e o cartão dela na sessão mãe são desenhados
- Então mostram o nome do repositório principal e a branch da worktree ("meu-projeto ⑂ fix/cabecalho"); num submódulo, ou com o `.git` apontando para outro lugar, o nome da pasta

Origem: decisão do usuário, 2026-11-15 ("O do repositório principal (Recomendado)").
Reescrito: 2026-11-15, texto: o caminho relativo é resolvido antes de achar o repositório principal (revisão do lote, 2026-11-15); nenhuma regra muda e os testes existentes não mudam.
Código: io/git.ts
Estado: coberto

### sessoes.mensagens-juntas-vao-a-ultima
Mensagens entregues juntas: o cartão vai à tarefa da última.

- Dado várias mensagens à mesma sessão entregues juntas
- Quando o turno dela começa
- Então o cartão do turno fica na tarefa da última mensagem

Origem: decisão do usuário, 2026-10-23 ("quero ver as tarefas lineares andando de cima para baixo; as paralelas andam fora de ordem, normal, mas as lineares precisam seguir uma linha do tempo"); commit 11e4044.
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
Os turnos que o usuário abriu digitando na filha ficam num cartão só por pedido da mãe vigente, onde a mãe estava quando ele digitou.

- Dado uma filha aberta num pedido antigo da mãe, e o usuário digitando direto nela depois de um pedido novo da mãe
- Quando a mãe desenha o painel
- Então o cartão fica sob a tarefa que a mãe tinha iniciado e não fechado quando ele digitou (com várias, a iniciada por último); sem nenhuma, sob a tarefa da própria filha (a de onde foi aberta, ou a da última mensagem que a mãe lhe mandou), com a filha trabalhando ou parada, se essa tarefa é do pedido da mãe vigente naquele instante (o último pedido planejado antes; sem nenhum, o de origem); só quando ela não é, no fim do pedido vigente, depois das subtarefas dele, como último bloco do pedido; a tarefa acesa por outra filha ou por um subagente não conta; com "pedido do usuário na filha" no título; os turnos digitados com o mesmo pedido da mãe em curso entram no mesmo cartão, cada um com a sua linha de pedido e as suas tarefas embaixo (com um turno só, as tarefas direto no cartão e o texto digitado no texto alternativo do ícone); o cartão fica onde o primeiro desses turnos aconteceu e não muda de lugar depois (sessoes.lugar-do-cartao-digitado-nao-muda); cartão novo só quando o pedido vigente da mãe é outro; enquanto a filha trabalha nele, o pedido onde ele está segue desenhado

Origem: decisão do usuário, 2026-11-03 ("No pedido vigente da orquestradora (Recomendado)"); pedido dele: "preciso saber pela sessão principal tudo que as filhas planejaram, executaram, estao executando, etc...". O pedido mantido enquanto a filha trabalha corrige um defeito: a conta de "sessão trabalhando sob o pedido" olhava só a rodada da última mensagem.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o texto digitado vai no texto alternativo do ícone da linha, não num tooltip.
Reescrito: 2026-11-14, decisão do usuário ("Um cartão só (Recomendado)"); desfaz "um cartão por turno" da decisão de 2026-11-03. Os testes existentes não mudam.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Na ordem em que aconteceu (Recomendado)"); desfaz "no fim do pedido" quando havia tarefa em andamento na mãe, e põe o cartão depois das subtarefas quando não havia. "Um cartão só" (2026-11-14) fica: um cartão por pedido vigente, no lugar do primeiro turno digitado.
Reescrito: 2026-11-15, decisões do usuário de 2026-11-15 ("Sob a tarefa ◉ (Recomendado)", "Sob a tarefa de origem (Recomendado)" e "Não conta (Recomendado)"): sem tarefa que a mãe tinha iniciado e não fechado quando ele digitou, o cartão fica sob a tarefa da própria filha, com ela trabalhando ou parada, se essa tarefa é do pedido vigente; desfaz, nesse caso, "sem nenhuma em andamento, no fim do pedido", que passa a valer só quando a tarefa da filha não está no pedido vigente ("No pedido vigente da orquestradora (Recomendado)", 2026-11-03, fica); a tarefa acesa por outra filha ou por um subagente não conta.
Código: draw/layout.ts
Estado: coberto

### sessoes.turno-de-abertura-da-filha-sob-a-origem
O turno que abriu a filha (o texto do start_session) não é pedido do usuário na filha, mesmo quando ela o publica como próprio.

- Dado uma filha aberta a partir de uma tarefa, que publica o primeiro turno marcado como próprio (os arquivos publicados reais trazem a marca)
- Quando a mãe desenha o painel
- Então o cartão desse turno fica sob a tarefa de origem, com o nome simples, sem "pedido do usuário na filha"; um turno 1 marcado como próprio que começa bem depois da abertura (a filha limpa com /clear, os turnos recomeçam) segue como pedido do usuário na filha (sessoes.turno-proprio-da-filha-no-pedido-vigente)

Origem: auditoria 2026-11-10 (o primeiro turno da filha é marcado como pedido do usuário na filha); aplica sessoes.cartao-sob-a-tarefa-de-origem e sessoes.turno-proprio-da-filha-no-pedido-vigente ("O turno que o usuário abriu digitando na filha"), sem mudar nenhuma das duas.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Na ordem em que aconteceu (Recomendado)"): o turno digitado depois de um /clear segue sendo pedido do usuário na filha, agora sob a tarefa em andamento da mãe.
Código: draw/layout.ts
Estado: coberto

### sessoes.lugar-do-cartao-digitado-nao-muda
O lugar do cartão "pedido do usuário na filha" é decidido uma vez e não muda depois.

- Dado um cartão de turnos que o usuário digitou numa filha, já desenhado sob uma tarefa ou fechando o pedido
- Quando a sessão de cima termina o turno, dá start de novo na tarefa que aguardava, reabre uma tarefa concluída, manda outra mensagem à filha, replaneja, recarrega o mod ou volta num processo novo
- Então o cartão segue onde estava; se um replano tira a tarefa de onde ele pendia, passa para baixo do nível 1 que a continha e fica lá (pedidos.replano-leva-o-cartao-ao-nivel-1); o lugar é guardado com os laços da sessão, um por cartão, sem teto, e publicado; a leitura sem novidade não o regrava; o cartão de uma neta fica onde a filha o guardou, também quando a filha a publica sem o primeiro turno digitado do cartão; o cartão que já existia quando o mod foi atualizado tem o lugar decidido uma vez, na primeira leitura; a neta publicada por uma versão sem o lugar guardado segue pela conta do relógio das tarefas da filha; um nível 1 planejado depois, mesmo reusando um id antigo, não muda o lugar; o lugar guardado numa tarefa que não existe mais não vale, e o cartão é decidido de novo; um pedido digitado na filha que ela apagou sem ele nunca ter tido cartão (Esc antes do plan, resposta sem tarefa e sem resumo) não dá o lugar ao pedido digitado depois: o cartão desse é decidido pela hora dele; o cartão feito depois de um /clear da filha tem lugar próprio, não o do cartão de antes do /clear; enquanto um plan da sessão de cima gravou as tarefas e ainda não levou os laços, a leitura das sessões não decide nem descarta lugar: o replano que tira a subtarefa leva o cartão ao nível 1 também com a leitura no meio

Origem: revisão do lote do cartão "na ordem em que aconteceu", 2026-11-15 (o lugar era recalculado a cada desenho e o cartão saltava); cumpre as decisões do usuário de 2026-11-15 ("Na ordem em que aconteceu (Recomendado)", "Sim, no primeiro") e de 2026-11-14 ("Sob o nível 1 (Recomendado)"), sem mudar nenhuma. Revisão de 2026-11-15 do lote que guardou o lugar: o teto de 20 (que entrava em laço) saiu.
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Lugar herdado de pedido apagado,Testes que faltam,Corrida no replano"): o cartão não herda o lugar de um pedido digitado que a filha apagou sem cartão; desfaz, na filha direta, "o cartão cujo primeiro turno a filha apagou segue no lugar guardado" (interpretação da revisão anterior do lote, não decisão). Os testes existentes não mudam.
Código: draw/layout.ts, hooks/panel.ts, hooks/tools.ts, state/durability.ts
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


### sessoes.publicado-enxuto
O arquivo que a sessão publica leva o painel dela inteiro e as filhas cortadas ao trabalho atual.

- Dado uma sessão com filhas, e filhas com pedidos já concluídos e netas
- Quando ela publica o painel para a sessão que a abriu
- Então o arquivo leva os grupos dela inteiros, sem a cópia antiga das tarefas, e cada filha só com o trabalho atual dela (e as netas, do mesmo jeito); o painel da própria sessão não muda; na sessão avó, o cartão de uma neta mostra o trabalho atual, sem "+N pedidos anteriores"; os arquivos de formatos antigos seguem sendo lidos

Origem: decisão do usuário, 2026-11-14 ("Enxugar e esvaziar (Recomendado)"); limita, para as netas vistas pela avó, a decisão de 2026-11-04 ("Ficam em '+N pedidos anteriores' (Recomendado)").
Código: hooks/panel.ts
Estado: coberto

### sessoes.cartao-parado-mostra-o-tempo-do-turno
No cartão da filha parada, a tarefa que aguardava mostra o tempo até o fim do turno dela.

- Dado uma filha que deu start numa tarefa, trabalhou sem outro start nem done e terminou o turno com ela aberta
- Quando a mãe desenha o cartão da filha parada
- Então a tarefa aparece ◷ com o tempo do início ao fim do turno da filha, o mesmo do painel dela, e o tempo do cartão e o do pedido da mãe o seguem; o arquivo publicado leva a hora do fim na própria tarefa; para um arquivo de versão anterior do mod, o relógio para no último início ou fim publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o relógio do cartão parava no último carimbo do painel publicado, 0:00 ou tempo cortado); cumpre turnos.iniciada-aguarda-no-fim ("◷ com o relógio parado"). Corrigido junto com turnos.aguardando-segue-ate-o-start, que grava a hora do fim na tarefa.
Código: state/tasks.ts, hooks/turn.ts
Estado: coberto

### sessoes.destino-que-nao-e-filha-nao-vira-cartao
A mensagem a uma sessão que esta não abriu não cria cartão.

- Dado uma mensagem enviada à sessão mãe, a uma irmã ou a qualquer sessão que esta não abriu
- Quando o painel é desenhado, aqui e no cartão desta sessão na mãe
- Então só a carta ✉ aparece sob a tarefa do envio: nenhum cartão "Sessão…", nenhuma sessão ativa a mais no cabeçalho, nenhuma filha a mais no painel publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: todo destino `local_…` fora das filhas ganhava uma entrada "Sessão…" trabalhando); aplica sessoes.mensagem-entre-filhas-no-cartao-da-remetente ("o cartão da destinatária não fica dentro do cartão da remetente").
Código: hooks/tool-call.ts
Estado: coberto

### sessoes.leitura-das-filhas-uma-por-vez
A leitura das sessões filhas roda uma de cada vez.

- Dado leituras pedidas ao mesmo tempo (o relógio de 3 s, um aviso do app, a abertura de uma sessão)
- Quando uma já está em curso
- Então as outras esperam e, no fim, roda mais uma só; uma leitura mais antiga nunca grava por cima de uma mais nova, e o fim de turno de uma filha gera um lembrete só

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: leituras sobrepostas gravavam sem conferir a versão).
Estado: coberto

### sessoes.aberta-antes-do-plan-e-adotada
A sessão aberta antes do plan do pedido fica solta no fim, e o plan do pedido a adota.

- Dado um pedido novo ainda sem plano e nada em andamento
- Quando o modelo abre uma sessão filha, e depois planeja o pedido
- Então, até o plan, o cartão fica no fim do painel, mesmo se a filha já concluiu, sem tarefa de pedido anterior; no primeiro plan do pedido, o cartão passa para a tarefa cujo título casa com o nome da sessão, senão para a primeira pendente, e segue lá, vivo ou concluído

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)"; antes, na resposta livre: "Se existe uma sessão filha ou subagente criados antes do plan, eles deveriam se planejadas para mostrar corretamente na lista").
Código: hooks/tools.ts, hooks/panel.ts
Estado: coberto

### sessoes.rodada-da-frente-e-a-mais-recente
A rodada atual de uma filha é a mais recente, seja de mensagem da mãe, seja de turno digitado nela.

- Dado uma filha com uma rodada da mãe já concluída e, depois, um turno que a pessoa digitou direto nela
- Quando esse turno tem tarefas abertas, com ou sem uma iniciada, e a filha está parada ou rodando
- Então o cartão desse turno é o da rodada atual: as tarefas dele contam no cabeçalho e nos chips, e o pedido onde ele está segue à vista enquanto a filha trabalha; a rodada descartada segue sendo a anterior deixada com tarefa aberta (sessoes.rodada-descartada-fora-da-contagem)

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o turno digitado na filha era sempre lido como a rodada mais antiga); cumpre sessoes.rodada-descartada-fora-da-contagem (decisão do usuário, 2026-10-28: "a rodada descartada é a anterior, não a que está trabalhando") e sessoes.turno-proprio-da-filha-no-pedido-vigente (2026-11-03).
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Sob a tarefa de origem (Recomendado)"): o cartão do turno digitado fica sob a tarefa de onde a filha foi aberta, e o roteiro do teste a deixa aberta (com ela fechada, o cartão parado só com pendentes é "encerrada": sessoes.filha-parada-com-origem-fechada-sai-da-contagem); a regra não muda.
Estado: coberto

### sessoes.sessao-conta-uma-vez-no-chip
Uma sessão conta uma vez no chip de sessões ativas, com um cartão ou vários.

- Dado uma filha rodando com mais de um cartão (uma rodada antiga deixada com tarefa aberta e a rodada atual)
- Quando o cabeçalho conta as sessões ativas
- Então conta 1 para ela, pelo cartão da rodada atual; os cartões seguem desenhados

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: cada cartão com tarefa aberta de uma sessão rodando contava como uma sessão ativa).
Código: hooks/render.tsx
Estado: coberto

### sessoes.regras-de-cartao-valem-para-netas
As regras de cartão valem também para os cartões dentro do cartão de uma filha.

- Dado uma sessão aberta por uma filha (uma neta), desenhada dentro do cartão da filha
- Quando ela para só com pendentes e a tarefa de origem dela na filha está fechada; ou trabalha sob um pedido da filha que saiu do trabalho; ou a filha, parada com Esc, tem uma carta na fila
- Então vale o mesmo que no painel da filha: a neta fica "encerrada", com as ○ desenhadas e fora do x/y do cartão da filha, da tarefa de origem e do cabeçalho (sessoes.filha-parada-com-origem-fechada-sai-da-contagem); o cartão vivo aparece solto no fim do cartão da filha, com o pedido de origem no título (sessoes.cartao-vivo-nunca-some); a tarefa com carta na fila fica ◷ (envios.fila-nao-interrompe-no-fim-do-turno); a rodada da neta dividida por mensagem e a descartada contam como nas filhas diretas

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: "encerrada", cartão vivo solto e carta na fila só valiam para as filhas diretas); estende as três regras citadas, sem mudar nenhuma.
Código: hooks/render.tsx, hooks/panel.ts
Estado: coberto

### sessoes.tempo-da-tarefa-concluida-com-filha
A tarefa concluída com filha embaixo mostra só o tempo próprio.

- Dado uma tarefa da mãe concluída com done, com uma sessão filha ainda trabalhando embaixo
- Quando o painel é desenhado, com a filha trabalhando e depois de ela parar
- Então a linha da tarefa mostra o tempo do início ao done dela, parado, nos dois momentos (o ícone segue ◉ enquanto a filha trabalha, e o x/y segue somando as tarefas da filha); o pedido com todas as tarefas concluídas mostra o tempo delas, parado; a tarefa aberta com filha trabalhando segue com o tempo correndo

Origem: decisão do usuário, 2026-11-14 ("Só o próprio": "T mostra 0:03 também enquanto a filha trabalha; o relógio dessa linha não corre"), sobre o achado da auditoria de 2026-11-10 (o tempo corria com a filha trabalhando e regredia quando ela parava).
Estado: coberto

### sessoes.clear-na-filha-mantem-o-historico
Depois de um /clear numa filha, o cartão dela na mãe mantém o que ela tinha feito.

- Dado uma sessão filha com tarefas feitas
- Quando a pessoa dá /clear nela, e depois ela trabalha de novo
- Então o painel da filha fica vazio (durabilidade.clear-esvazia), e o que ela tinha feito segue no painel publicado como histórico: na mãe, o cartão mantém as tarefas (as abertas ficam ✕), o x/y da tarefa de origem e o cabeçalho não encolhem; o trabalho de depois aparece num cartão novo; ficam os 5 /clear mais recentes

Origem: decisão do usuário, 2026-11-14 ("Mantém o histórico (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (o /clear na filha apagava da mãe o trabalho dela).
Código: hooks/session-start.ts, draw/layout.ts
Estado: coberto

### sessoes.arquivada-antiga-vira-linha
A filha arquivada cujo pedido saiu do trabalho atual vira uma linha com nome e contagem.

- Dado uma filha arquivada, com o cartão sob uma tarefa de um pedido
- Quando esse pedido sai do trabalho atual (vai para "+N pedidos anteriores")
- Então o cartão dela passa a ser uma linha só, com o nome, a contagem e "arquivada", sem as tarefas; o x/y da tarefa de origem e a conta da sessão inteira não mudam; o painel dela deixa de ser guardado, relido e republicado; desarquivada, ou com o pedido de volta ao trabalho, volta ao cartão inteiro

Origem: decisão do usuário, 2026-11-14 ("Vira linha resumida (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (as filhas arquivadas antigas ficavam inteiras no state e no painel publicado, sem teto).
Código: hooks/sessions.ts, io/host.ts
Estado: coberto

### sessoes.rodada-a-vista-nao-sai-pelo-teto
O cartão de uma rodada de tarefa à vista não muda de lugar por causa de mensagens novas.

- Dado uma filha com um cartão por mensagem e mais de 20 mensagens da mãe a ela
- Quando a 21ª mensagem é enviada
- Então os cartões das rodadas cujas tarefas estão no trabalho atual seguem sob as tarefas delas; só deixam de ter cartão próprio as rodadas mais antigas de pedidos que já saíram do trabalho

Origem: auditoria 2026-11-10 (o teto de 20 rodadas cortava por posição, e o cartão da primeira se fundia ao de abertura); aplica sessoes.um-cartao-por-mensagem, sem mudar nenhuma regra.
Código: hooks/tool-call.ts
Estado: coberto

### sessoes.id-proprio-nao-lido-avisa
Sem conseguir ler o id da própria sessão, o painel avisa em vez de congelar os cartões em silêncio.

- Dado o app desktop respondendo a lista de sessões, mas não o id desta sessão
- Quando isso dura mais de 10 s seguidos
- Então o painel mostra a linha "Sessões indisponíveis: id da sessão não lido" (os cartões ficam como estavam); uma falha isolada não mostra a linha; quando o id vem, a linha sai e os cartões voltam a ser atualizados; o log de depuração registra a falha uma vez por motivo, e também a leitura das sessões que lança

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: a lista que falha mostrava uma linha, o id que não vem não mostrava nada e enchia o log).
Código: hooks/panel.ts, hooks/render.tsx
Estado: coberto

### sessoes.lista-vazia-refaz-o-status
Quando a última sessão filha some da lista do app, a linha de status embaixo da caixa de mensagem é refeita.

- Dado uma sessão filha com tarefas somando no "Tarefas d/n"
- Quando a lista do app passa a vir vazia (a filha foi apagada)
- Então o cartão some, o painel é publicado sem ele, e o "Tarefas d/n" e o relógio são refeitos na mesma leitura

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: com a lista vazia o status ficava com o valor antigo até outra mudança).
Código: hooks/panel.ts
Estado: coberto

### sessoes.leitura-falha-nao-apaga-a-espera
Uma leitura do arquivo da filha que falha não apaga "aguardando", "ultracode" nem a parada com Esc.

- Dado uma filha que espera a pessoa (ou com ultracode, ou parada com Esc), já lida uma vez
- Quando o arquivo dela não pode ser lido numa volta da leitura
- Então o cartão segue como a última leitura disse, e a mãe não recebe o lembrete de "terminou o turno"; se o arquivo segue ilegível por mais de três leituras seguidas, volta a valer só o que o app diz da sessão; lido de novo, vale o arquivo

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: o arquivo ilegível era lido como vazio, e a filha que esperava era dada como parada por uma volta).
Estado: coberto

### sessoes.filha-que-conclui-tudo-fecha-a-origem
A sessão filha que termina o turno com tudo concluído fecha a tarefa de origem.

- Dado uma sessão filha aberta (ou com a última mensagem tratada) a partir de uma tarefa ainda aberta, sem subtarefa aberta
- Quando a filha termina o turno com todas as tarefas do trabalho atual dela concluídas, e não há mais nada em execução na tarefa de origem (outra sessão trabalhando ali, carta na fila, subagente vivo, pergunta aberta)
- Então o painel conclui a tarefa de origem sozinho, mesmo com esta sessão parada (o pai fecha se era a última), e o modelo é avisado uma vez, com o nome da sessão e a tarefa; a filha parada com Esc, com tarefa aberta ou ✕, ou sem tarefas não fecha nada, e vale o lembrete de fim de turno (lembretes.filha-terminou-o-turno); a tarefa de origem que o Esc desta sessão deixou interrompida segue ✕ até o start (turnos.esc-com-trabalho-delegado-vivo); o start na tarefa a reabre. Fora disso: a sessão aberta (ou a mensagem mandada a ela) num pedido ainda sem plano, com pergunta aberta na tarefa em andamento de um plano anterior, e posta noutra tarefa desse plano (envios.nunca-na-tarefa-da-pergunta) está nela só como lugar: a filha que conclui tudo não fecha essa tarefa, que segue como estava até o modelo trabalhar nela, e o modelo não é avisado de tarefa fechada

Origem: decisão do usuário, 2026-11-15 ("Fecha a tarefa sozinho (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a carta fechava na entrega, o subagente no fim do turno, e a sessão filha nunca); segue "o pai sempre deve refletir seu status" (2026-11-09) e "Sim, conclusão automática como hoje" (2026-10-30).
Código: hooks/sessions.ts, text/rules.ts
Reescrito: 2026-11-15, decisão do usuário de 2026-11-15 ("Também não fecha (Recomendado)"): a sessão posta só como lugar numa tarefa do plano anterior, com pergunta aberta num pedido ainda sem plano, não a fecha ao concluir tudo. Os testes existentes não mudam.
Estado: coberto

### sessoes.modelo-e-esforco-publicados
A sessão publica o modelo e o esforço do loop principal.

- Dado uma sessão
- Quando o loop principal faz um passo com um modelo (e um esforço)
- Então o arquivo publicado traz "Opus 5.5" ou "Opus 5.5 · high", e muda quando o modelo ou o esforço mudam; o passo de um subagente não muda o da sessão (o desenho no cartão da mãe segue em visual.cartao-modelo-e-esforco e no golden)

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Código: hooks/turn.ts
Estado: coberto

### sessoes.lista-em-erro-diz-sessoes-indisponiveis
Com a lista de sessões do app em erro, o painel diz "Sessões indisponíveis" e os cartões ficam como estavam.

- Dado uma filha com cartão no painel
- Quando a lista de sessões do app responde erro
- Então aparece a linha "Sessões indisponíveis: <motivo>", o cartão segue com o que tinha, e a linha some quando a lista volta

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Estado: coberto

### sessoes.mensagem-recebida-sem-rodada-abre-cartao
A mensagem que a filha recebeu desta sessão sem envio registrado abre o cartão dela mesmo assim.

- Dado uma filha que publica uma mensagem recebida desta sessão que o painel não viu sair (painel desligado ou recarga na hora do envio)
- Quando ela abre um turno depois dessa mensagem
- Então o turno ganha um cartão próprio, sob a tarefa que estava aberta quando a mensagem chegou, e não se junta ao cartão anterior

Origem: regra do painel, a confirmar (auditoria de 2026-11-10; achados baixos, 2026-11-15).
Estado: coberto
