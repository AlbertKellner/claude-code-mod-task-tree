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
