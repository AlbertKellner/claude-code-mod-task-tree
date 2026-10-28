# Visual

O que só o app mostra.

### visual.largura-real
O desenho termina na borda real.

- Dado qualquer fonte e largura do painel
- Quando o painel é desenhado
- Então o desenho termina na borda real da imagem

Origem: commit 6c706e7, 2026-10-27.
Estado: checklist (largura real do app)

### visual.cliques-no-icone-e-no-anel
Os cliques no ícone e no anel funcionam.

- Dado o painel aberto, nos dois temas
- Quando a pessoa clica no ícone ou no anel
- Então a ação correspondente acontece

Origem: commit 4edb3f2, 2026-10-21 ("cliques por chave, painel na tela e desenho menor").
Estado: checklist (cliques reais)

### visual.tooltip
O tooltip mostra o texto inteiro.

- Dado uma linha cortada
- Quando a pessoa passa o mouse
- Então o tooltip mostra o texto inteiro

Origem: commit 450aa9f, 2026-10-21 ("tooltip com o nome inteiro da tarefa cortada").
Estado: checklist (tooltip do app)

### visual.animacao-de-linha-nova
A linha nova anima uma vez e nada pisca à toa.

- Dado uma linha nova no painel
- Quando ela aparece
- Então anima uma vez, e as outras não piscam

Origem: commit f19a4ad, 2026-10-23 ("linhas e cartões novos entram com fade-in").
Estado: checklist (animação real)

### visual.cores-dos-temas
As cores seguem o tema.

- Dado o tema claro ou escuro
- Quando o painel é desenhado
- Então as cores seguem o tema

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: checklist (pintura real; o desenho fica travado por visual.desenho-*; a pintura real, no app)

### visual.cabecalho-em-cartao
O cabeçalho aparece em cartão.

- Dado o painel aberto
- Quando o cabeçalho é desenhado
- Então ele aparece em cartão, com repositório e branch

Origem: commit ccbd8fb, 2026-10-24 ("cabeçalho dentro de um cartão (fundo, borda e raio dos cartões de sessão), sem a linha divisória").
Estado: checklist (pintura real; o desenho fica travado por visual.desenho-*; a pintura real, no app)

### visual.status-embaixo-da-caixa
O status aparece embaixo da caixa de mensagem.

- Dado uma tarefa em andamento
- Quando o app desenha a caixa de mensagem
- Então o status do painel aparece embaixo dela

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Estado: checklist (status do app)

### visual.cartao-modelo-e-esforco
O cartão da filha mostra o modelo e o esforço dela.

- Dado uma filha que publicou o modelo e o esforço
- Quando o cartão é desenhado no app desktop
- Então mostra o modelo e o esforço ("Opus 5.5 · high") à esquerda do anel

Origem: regra do painel.
Estado: checklist (o terminal não desenha o modelo; o desenho fica travado por visual.desenho-*; a pintura real, no app)

### visual.cartao-posicao-de-toks-e-repo
No cartão do app desktop, toks/s fica à esquerda do modelo e repositório e branch à direita do nome.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado no app desktop
- Então "n toks/s" fica à esquerda do modelo, e o repositório e a branch à direita do nome

Origem: commits 1987482 e 689d569, 2026-10-24.
Estado: checklist (posição na imagem; o desenho fica travado por visual.desenho-*; a pintura real, no app)

### visual.cartoes-ordem-e-espera
Os cartões de várias sessões reais seguem a ordem de execução, sem pulo.

- Dado várias sessões reais, com mensagens entre irmãs e mais de 20 rodadas
- Quando o painel é desenhado
- Então os cartões seguem a ordem de início do trabalho, o cartão de mensagem de irmã espera a origem (até 10 s) sem pular, e a espera e o anel ficam só no cartão líder

Origem: commits fddd473 e 8b67366, 2026-10-23.
Estado: checklist (sessões e tempos reais)

### visual.recarga-real-e-respawn
A recarga real e o respawn do worker não perdem nada.

- Dado o painel aberto, com cartões e resumos
- Quando um arquivo do mod é salvo, o worker é refeito (/model) ou a sessão é retomada no app
- Então nada some, os relógios voltam a correr e o primeiro clique funciona

Origem: tabela de durabilidade, commit 9fb1c51, 2026-10-22.
Estado: checklist (recarga e processo reais)

### visual.cabecalho-barra-e-chips-desenhados
A barra e os chips do cabeçalho aparecem desenhados no app desktop.

- Dado o painel aberto no app desktop
- Quando o cabeçalho é desenhado
- Então a barra de progresso, os chips em ícone e cor e o tooltip "sessão inteira" aparecem

Origem: regra do painel.
Estado: checklist (pintura real)

### visual.golden-gera-desenho
Os cenários do golden geram o desenho do app desktop.

- Dado os 3 cenários do golden (principal, filha trabalhando, envios), a 60 colunas
- Quando o painel é desenhado no app desktop
- Então cada cenário gera os SVGs do desenho, e o texto deles é o mesmo a cada vez

Origem: decisão do usuário, 2026-10-28 ("Sim, validar antes do commit (Recomendado)"): o desenho validado no app fica travado pelo golden.
Estado: coberto

### visual.desenho-principal
O desenho do painel principal é o validado no app.

- Dado uma árvore de 3 níveis com todos os estados, a linha ↩ e o cabeçalho em cartão com repositório e branch
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Estado: pendente (aguardando a validação do usuário no app)

### visual.desenho-cartao-filha
O desenho do cartão da filha trabalhando é o validado no app.

- Dado uma filha trabalhando, com busto, toks/s, repositório e branch e anel
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Estado: pendente (aguardando a validação do usuário no app)

### visual.desenho-envios
O desenho do ✉ na fila, entregue e interrompido é o validado no app.

- Dado tarefas de mensagem na fila, entregue e interrompida
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Estado: pendente (aguardando a validação do usuário no app)