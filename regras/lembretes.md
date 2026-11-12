# Lembretes

Os textos que o mod manda ao modelo na mensagem seguinte.

Código da área: hooks/prompt-submit.ts, text/rules.ts, hooks/turn.ts

### lembretes.replanejar-apos-esc-pessoa
Depois do Esc, a mensagem da pessoa pede para replanejar.

- Dado um turno parado pela pessoa, com tarefas abertas
- Quando ela manda a mensagem seguinte
- Então o modelo recebe o pedido de replanejar com a lista das abertas, no lugar da lista para fechar

Origem: decisão do usuário, 2026-10-27 ("precisa replanejar quando eu interrompo e envio nova mensagem"); commit d3ff1be.
Estado: coberto

### lembretes.fim-normal-lista-abertas
Depois do fim normal, a mensagem da pessoa lista o que ficou aberto.

- Dado um turno terminado normalmente com tarefas abertas
- Quando chega a mensagem da pessoa
- Então o modelo recebe a lista para fechar ou manter, sem pedido de replanejar

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### lembretes.outra-sessao-apos-esc
Depois do Esc, a mensagem de outra sessão pede para replanejar.

- Dado um turno parado
- Quando a mensagem seguinte é de outra sessão
- Então o modelo recebe o pedido de replanejar dessa origem

Origem: commit 2326900, 2026-10-23 ("lembrete de replanejar quando uma mensagem de outra sessão chega depois de um turno interrompido").
Estado: coberto

### lembretes.esc-sem-abertas
Depois do Esc sem nada aberto, não há o que replanejar.

- Dado um turno parado sem tarefas abertas
- Quando chega a mensagem da pessoa
- Então não há pedido de replanejar

Origem: decisão do usuário, 2026-10-27; commit d3ff1be.
Estado: coberto

### lembretes.replanejar-vale-uma-vez
O pedido de replanejar vale uma vez só.

- Dado um pedido de replanejar já enviado
- Quando o turno seguinte termina normalmente e chega outra mensagem
- Então volta o lembrete normal da lista das abertas

Origem: decisão do usuário, 2026-10-27; commit d3ff1be.
Estado: coberto

### lembretes.replanejar-apos-esc-com-aviso-no-meio
Um aviso que não abre pedido, entre o Esc e a mensagem seguinte, não tira o pedido de replanejar.

- Dado um turno parado pela pessoa, com tarefas abertas
- Quando, antes da mensagem dela, chegam o aviso do app, o hand-back de um subagente ou a notificação de uma tarefa em segundo plano, e o turno deles termina normalmente
- Então a mensagem seguinte, da pessoa ou de outra sessão, ainda traz o pedido de replanejar com a lista das abertas, uma vez só

Origem: auditoria 2026-11-10 (o fim normal do turno do aviso apagava a marca do Esc); aplica lembretes.replanejar-apos-esc-pessoa ("precisa replanejar quando eu interrompo e envio nova mensagem") e lembretes.outra-sessao-apos-esc, sem mudar nenhuma regra nem o desenho.
Código: hooks/panel.ts, state/durability.ts
Estado: coberto

### lembretes.primeira-chamada-sem-plano
O lembrete de planejar na primeira ferramenta sem plano.

- Dado um pedido sem plan
- Quando o modelo chama a primeira ferramenta e, depois, a cada 10
- Então ele recebe o lembrete de planejar

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20); o texto passou para text/rules.ts no commit 758dbb7, 2026-10-22 ("textos do modelo num módulo, com golden").
Código: hooks/tool-call.ts
Estado: coberto

### lembretes.regras-no-prompt-de-sistema
As regras do painel entram no prompt de sistema.

- Dado as ferramentas do painel disponíveis
- Quando o prompt de sistema é montado
- Então a seção de regras do painel entra

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: coberto

### lembretes.estado-guardado-so-no-mesmo-pedido
Os textos ao modelo dizem que o replano só guarda o estado dentro da mesma mensagem.

- Dado as regras do painel, a descrição do plan e os lembretes de depois do Esc
- Quando o modelo os lê
- Então eles dizem que o mesmo id guarda o estado só no replano da mesma mensagem; numa mensagem seguinte, o nível 1 aberto com o mesmo id fica como histórico, com as abertas ✕, e a cópia nasce ○; para continuar, start e done nos ids que já existem, e o que é novo vai com ids novos

Origem: auditoria 2026-11-10 (os textos prometiam o estado guardado sem a condição da mensagem, contra pedidos.plano-anterior-vira-historico).
Estado: coberto

### lembretes.mensagem-no-meio-do-turno
A mensagem entregue no meio do turno traz o lembrete de que continua o pedido em curso.

- Dado um turno em curso, com tarefas abertas
- Quando chega, com esse turno em curso, o relato de uma sessão que esta abriu ou uma mensagem que a pessoa digitou por cima do turno
- Então o modelo recebe o lembrete de que ela continua o pedido em curso e não abre pedido novo, com a lista das abertas: seguir com start e done, fechar o que ela conclui, e pôr o que é novo no plano atual (ids novos, ou o nível 1 inteiro de novo, que guarda o estado), sem request; não recebe o lembrete de pedido novo ("a primeira chamada é plan") nem a lista para fechar antes do pedido novo; a resposta dada pelo chat a uma pergunta é dita como resposta, uma vez; as regras do prompt de sistema dizem a exceção; a mensagem de uma sessão que esta não abriu segue com o lembrete de pedido novo; depois de um Esc, a mensagem que chega com o turno de um aviso em curso ainda traz o pedido de replanejar e abre o seu pedido, uma vez (lembretes.replanejar-apos-esc-pessoa, lembretes.replanejar-apos-esc-com-aviso-no-meio)

Origem: auditoria 2026-11-10 (a mensagem entregue no meio do turno mandava planejar um pedido novo); decisão do usuário, 2026-11-12 ("Entra no pedido em curso (Recomendado)"). Exceção a lembretes.estado-guardado-so-no-mesmo-pedido: a mensagem que continua o pedido em curso não é "mensagem seguinte".
Código: hooks/tool-call.ts, hooks/panel.ts
Estado: coberto
