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

Origem: regra do painel; a confirmar.
Estado: checklist (cliques reais)

### visual.tooltip
O tooltip mostra o texto inteiro.

- Dado uma linha cortada
- Quando a pessoa passa o mouse
- Então o tooltip mostra o texto inteiro

Origem: regra do painel; a confirmar.
Estado: checklist (tooltip do app)

### visual.animacao-de-linha-nova
A linha nova anima uma vez e nada pisca à toa.

- Dado uma linha nova no painel
- Quando ela aparece
- Então anima uma vez, e as outras não piscam

Origem: regra do painel; a confirmar.
Estado: checklist (animação real)

### visual.cores-dos-temas
As cores seguem o tema.

- Dado o tema claro ou escuro
- Quando o painel é desenhado
- Então as cores seguem o tema

Origem: regra do painel; a confirmar.
Estado: checklist (pintura real)

### visual.cabecalho-em-cartao
O cabeçalho aparece em cartão.

- Dado o painel aberto
- Quando o cabeçalho é desenhado
- Então ele aparece em cartão, com repositório e branch

Origem: regra do painel; a confirmar.
Estado: checklist (pintura real)

### visual.status-embaixo-da-caixa
O status aparece embaixo da caixa de mensagem.

- Dado uma tarefa em andamento
- Quando o app desenha a caixa de mensagem
- Então o status do painel aparece embaixo dela

Origem: regra do painel; a confirmar.
Estado: checklist (status do app)

### visual.cartao-modelo-e-esforco
O cartão da filha mostra o modelo e o esforço dela.

- Dado uma filha que publicou o modelo e o esforço
- Quando o cartão é desenhado no app desktop
- Então mostra o modelo e o esforço ("Opus 5.5 · high") à esquerda do anel

Origem: regra do painel.
Estado: checklist (o terminal não desenha o modelo)

### visual.cartao-posicao-de-toks-e-repo
No cartão do app desktop, toks/s fica à esquerda do modelo e repositório e branch à direita do nome.

- Dado uma filha trabalhando num repositório
- Quando o cartão é desenhado no app desktop
- Então "n toks/s" fica à esquerda do modelo, e o repositório e a branch à direita do nome

Origem: commits 1987482 e 689d569, 2026-10-24.
Estado: checklist (posição na imagem)

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
