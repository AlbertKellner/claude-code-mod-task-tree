# Visual

O que só o app mostra.

Código da área: draw/svg.ts, draw/icons.ts, draw/desktop.tsx, draw/head.tsx

### visual.largura-real
O desenho termina na borda real.

- Dado qualquer fonte e largura do painel
- Quando o painel é desenhado
- Então as linhas terminam na borda real do painel, com o texto cortado pelo app ("…"), em qualquer largura

Origem: commit 6c706e7, 2026-10-27.
Estado: checklist (largura real do app)

### visual.cliques-no-icone-e-no-anel
Os cliques no ícone e no anel funcionam.

- Dado o painel aberto, nos dois temas
- Quando a pessoa clica no botão sobre o ícone ou sobre o anel
- Então a ação correspondente acontece

Origem: commit 4edb3f2, 2026-10-21 ("cliques por chave, painel na tela e desenho menor").
Estado: checklist (cliques reais)

### visual.botoes-por-chave
No app desktop, o ícone que recolhe a linha e o anel do cartão são botões com chave.

- Dado uma linha com algo embaixo e um cartão de sessão com anel
- Quando o painel é desenhado no app desktop
- Então a linha tem o botão `fold:<chave>` e o cartão o botão `open:<sessão>`; apertá-los recolhe a linha e pede a sessão ao app

Origem: decisão do usuário, 2026-10-21 ("quero que o botao de colapse nao apareca, e que a funcao de colapsar e expandir esteja no icone de progresso da tarefa"; "quando clicar nele, abra a sessao que ele representa"); commits 3c4e7df e e5fd006. Teste pedido na migração para o desenho nativo (2026-11-13), que troca a sobreposição dos botões.
Código: hooks/render.tsx
Estado: coberto

### visual.tooltip
Texto cortado não tem tooltip.

- Dado um texto cortado com "…" porque não coube (título, nome de sessão, repositório, pasta ou branch)
- Quando o painel é desenhado no app desktop
- Então não há tooltip: nenhum `Svg` interativo, nenhum `<title>` em fonte de `Svg` e nenhum elemento com `hover` ou escondido

Origem: commit 450aa9f, 2026-10-21 ("tooltip com o nome inteiro da tarefa cortada").
Reescrito: 2026-11-09, decisão do usuário ("não funcionou. aborte e remova a funcionalidade de tooltip"), depois de pedir "mostre um tooltip com o texto completo quando eu parar o mouse em cima do texto por um segundo".
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): não há tooltip: nenhum `Svg` interativo, nenhum `<title>` em fonte de `Svg` e nenhum elemento com `hover` ou escondido.
Código: hooks/render.tsx
Estado: coberto

### visual.titulo-sem-contagem-vai-ate-o-tempo
O título de uma linha sem barra nem contagem vai até o tempo.

- Dado uma tarefa sem subtarefas e sem sessão abaixo, com título mais largo que a linha
- Quando o painel é desenhado no app desktop
- Então o título só é cortado com "…" ao chegar no tempo da linha (ou na borda, sem tempo), e a palavra de estado encosta no tempo; a linha com barra e contagem segue cortando antes da barra

Origem: decisão do usuário, 2026-11-09 ("quero que o texto vá até alcança o tempo de execução, somente ai, corte o texto com reticencias"; "Encosta no tempo (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o título vai inteiro ao texto da linha e o app o corta com "…"; sem barra nem contagem, depois do título só vem o tempo; com contagem, a contagem e a barra; onde o corte cai é do app (checklist).
Estado: coberto

### visual.animacao-de-linha-nova
A linha nova aparece de uma vez, sem animação, e nada pisca à toa.

- Dado uma linha nova no painel
- Quando ela aparece
- Então ela aparece pronta, sem animação, e as outras não piscam

Origem: commit f19a4ad, 2026-10-23 ("linhas e cartões novos entram com fade-in").
Reescrito: 2026-11-04, "Manter sem animações" (decisão do usuário, depois de "desative as animacoes do task tree, quero avaliar como fica sem"); desfaz a linha que se revelava, o ícone que crescia, o traço do ✓, a barra que crescia e o chip que surgia.
Estado: checklist (desenho real)

### visual.cores-dos-temas
As cores seguem o tema.

- Dado o tema claro ou escuro
- Quando o painel é desenhado
- Então os textos e fundos usam as cores do tema do app; os `Svg` que restam levam as suas, claro e escuro

Origem: regra do painel desde a entrada do mod (465b09e, 2026-10-20).
Reescrito: 2026-11-13, decisão do usuário ("nao aparece nenhum card"): os textos usam as cores do tema; o fundo e a borda do cartão e do cabeçalho, o trilho das barras e a faixa sem chave de tema são cores cruas translúcidas, que assentam nos dois temas; os `Svg` levam as suas.
Estado: checklist (pintura real; o desenho fica travado por visual.desenho-*; a pintura real, no app)

### visual.cabecalho-em-cartao
O cabeçalho aparece em cartão, no desenho V4.

- Dado o painel aberto
- Quando o cabeçalho é desenhado
- Então ele é um cartão com a faixa de estado à esquerda (fundo de `Box`), o título no tamanho de título do app, o repositório e a branch, a barra, as pílulas e o bloco de números à direita (o % grande, "d de n", o tempo e toks/s)

Origem: commit ccbd8fb, 2026-10-24 ("cabeçalho dentro de um cartão (fundo, borda e raio dos cartões de sessão), sem a linha divisória").
Reescrito: 2026-11-03, decisão do usuário ("gostei da V4, siga para análise e implementação"): o cabeçalho V4 ("Respiro", 116 px).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o cabeçalho em componentes nativos, com só a barra e os ícones das pílulas em `Svg`; sem medidas em px.
Reescrito: 2026-11-13, decisão do usuário ("Sim, junto do cartão (Recomendado)"): o cabeçalho usa o mesmo fundo e a mesma borda translúcidos do cartão.
Código: io/git.ts, draw/head.tsx
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
Estado: checklist (posição na linha; o desenho fica travado por visual.desenho-*; a pintura real, no app)

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
A barra e as pílulas do cabeçalho aparecem desenhadas no app desktop.

- Dado o painel aberto no app desktop
- Quando o cabeçalho é desenhado
- Então a barra de progresso (o `Svg` que resta), as pílulas (ícone e texto numa borda da cor do tom) e, no texto alternativo, a sessão inteira aparecem

Origem: regra do painel.
Reescrito: 2026-11-03, decisão do usuário ("gostei da V4, siga para análise e implementação"): o cabeçalho V4 ("Respiro", 116 px).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: checklist (pintura real)

### visual.golden-gera-desenho
Os cenários do golden geram o desenho do app desktop.

- Dado os 4 cenários do golden (principal, filha trabalhando, envios, subagente), a 60 colunas
- Quando o painel é desenhado no app desktop
- Então cada cenário gera a árvore do desenho, elementos e props, e as fontes dos `Svg`, a mesma a cada vez

Origem: decisão do usuário, 2026-10-28 ("Sim, validar antes do commit (Recomendado)"): o desenho validado no app fica travado pelo golden.
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): os 4 cenários (principal, filha trabalhando, envios, subagente); cada cenário gera a árvore do desenho, elementos e props, e as fontes dos `Svg`, a mesma a cada vez.
Código: draw/layout.ts
Estado: coberto

### visual.cartao-e-cabecalho-destacados
O cartão de sessão, o de subagente e o cabeçalho se destacam do painel, com fundo próprio e borda visível.

- Dado um cartão de sessão filha, um de subagente e o cabeçalho, no app desktop
- Quando o painel é desenhado
- Então cada um tem um fundo e uma borda arredondada de cor própria, em cinza translúcido, que clareia o painel escuro e escurece o claro sem o mod saber o tema; a borda é mais forte que o fundo; o cabeçalho usa o mesmo fundo e a mesma borda do cartão que não está dentro de outro

Origem: decisão do usuário, 2026-11-13 ("nao aparece nenhum card"; para o cabeçalho: "Sim, junto do cartão (Recomendado)"). Referência: o desenho em SVG anterior (fundo `#20201f` e borda `#373736` no escuro, `#f9f9f7` e `#e1e1df` no claro; "calcule qual seria a terceira cor", "use a mesma cor da borda"). Mais o commit da correção.
Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card"): o fundo e a borda ficam um pouco mais fortes e passam a variar com o nível do cartão (visual.cartao-dentro-de-cartao-um-degrau).
Estado: coberto

### visual.guias-em-caixas-nativas
No app desktop, as guias da árvore são caixas nativas finas com fundo.

- Dado uma árvore com pai, filhas e netas
- Quando o painel é desenhado no app desktop
- Então cada linha tem uma célula de guia por nível: barra onde o ancestral ainda tem irmã abaixo, vazio onde não tem, e no fim o ramo (a linha tem irmã depois) ou o fim (é a última); cada traço é uma caixa com fundo, todas da mesma cor; nenhum texto tem caractere de caixa e nenhuma guia é `Svg`. O terminal segue com os caracteres

Origem: decisão do usuário, 2026-11-13 ("Caixas finas nativas (Recomendado)"), à pergunta se queria guias contínuas; desfaz "Caracteres (Recomendado)", do mesmo dia (guias em caracteres de caixa, mono).
Código: draw/layout.ts
Estado: coberto

### visual.guias-na-faixa-do-cartao
À esquerda de um cartão, as guias são as mesmas caixas, uma célula por coluna.

- Dado um cartão de sessão filha ou de subagente sob uma tarefa
- Quando o painel é desenhado no app desktop
- Então a faixa à esquerda do cartão tem uma célula por coluna de fora, não uma linha de texto por linha do cartão: barra onde o ancestral continua e, na última, o ramo (há irmã depois do cartão; a barra segue até o pé) ou o fim (o cartão é o último); dentro do cartão as linhas têm as guias das colunas do cartão, e as tarefas de uma sessão começam sem guia até o rótulo

Origem: a mesma decisão, 2026-11-13 ("Caixas finas nativas (Recomendado)"), que desfaz "Caracteres (Recomendado)", do mesmo dia.
Código: draw/layout.ts
Estado: coberto

### visual.guias-continuas-e-visiveis
As guias são contínuas, alinhadas com os ícones e visíveis nos dois temas.

- Dado o painel aberto no app, no tema claro e no escuro, com cartões
- Quando a árvore é desenhada
- Então as barras não têm falha entre uma linha e a seguinte, dentro e fora dos cartões e na faixa ao lado deles; ficam sob o meio do ícone do pai; o braço chega ao cartão na altura do rótulo; e a cor aparece nos dois temas

Origem: a mesma decisão, 2026-11-13 ("Caixas finas nativas (Recomendado)"), sobre o print `2026-11-13-cartao-filha-estranho.png`.
Estado: checklist (pintura real: continuidade, espessura e cor só aparecem no app)

### visual.cartao-dentro-de-cartao-um-degrau
Cada cartão dentro de outro fica um degrau além do de fora, o mesmo a cada nível.

- Dado um cartão de sessão com um cartão de subagente dentro, e outro dentro deste, no app desktop
- Quando o painel é desenhado
- Então o fundo e a borda de cada cartão são o mesmo cinza translúcido, mais forte a cada nível, de modo que cada cartão se afasta do de fora o mesmo tanto (mais claro no tema escuro, mais escuro no claro, sem o mod saber o tema); a borda é sempre mais forte que o fundo dela; o cabeçalho usa os do cartão que não está dentro de outro

Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card"). Mais o commit.
Código: draw/layout.ts
Estado: coberto

### visual.linhas-com-respiro
As linhas do app têm respiro: mais altas que o texto, com o conteúdo no meio.

- Dado um painel com tarefas, um cartão de sessão e cartões de subagente, no app desktop
- Quando o painel é desenhado
- Então toda linha tem a mesma altura, maior que a do texto, com o ícone, o título e o que vem à direita centrados nela; o espaço entre as linhas vem só dessa altura (nenhuma margem, nenhum vão: as guias seguem contínuas); o espaço entre o ícone e o título fica como era

Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; para a altura da linha, 1,4 linha: "1,4"; para mais espaço entre o ícone e o título: "Não, fica como está (Recomendado)"). Referência: a linha de 28 px do desenho em SVG anterior. Mais o commit.
Estado: coberto

### visual.cartao-com-respiro
O cartão tem respiro nos quatro lados, e a guia entra nele na altura do cabeçalho.

- Dado um cartão de sessão ou de subagente, em qualquer nível, no app desktop
- Quando o painel é desenhado
- Então entre a borda e o conteúdo há respiro nos quatro lados: o mesmo em cima e embaixo, e o mesmo à esquerda e à direita, maior que uma coluna; e o conector da faixa à esquerda desce o respiro de cima, para chegar ao cartão na altura do cabeçalho dele

Origem: decisão do usuário, 2026-11-13 ("aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; para os lados do cartão: "nos 4 lados"). Referência: os 6 px do cartão do desenho em SVG anterior. Mais o commit.
Código: draw/layout.ts
Estado: coberto

### visual.contraste-e-respiro-no-app
O contraste por nível e o respiro aparecem no app, nos dois temas.

- Dado o painel aberto no app, no tema claro e no escuro, com cartão dentro de cartão
- Quando o painel é desenhado
- Então cada nível de cartão se distingue do de fora a olho; o texto fica no meio da linha e não encosta em nenhum dos quatro lados do cartão; e as guias seguem contínuas com a linha mais alta

Origem: as mesmas decisões, 2026-11-13 ("1,4"; "nos 4 lados").
Estado: checklist (pintura real: tom, altura e respiro só aparecem no app)

### visual.desenho-principal
O desenho do painel principal é o validado no app.

- Dado uma árvore de 3 níveis com todos os estados, a linha ↩ e o cabeçalho em cartão com repositório e branch
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: desenho validado pelo usuário no app em 2026-10-29 ('sim, correto'); golden decidido em 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Reescrito: 2026-11-03, decisão do usuário ("gostei da V4, siga para análise e implementação"): o cabeçalho V4 ("Respiro", 116 px). O golden é regravado com a validação dele no app.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Reescrito: 2026-11-12, decisão do usuário ("Segue ✕ até novo start (Recomendado)"): a tarefa parada com Esc no primeiro pedido segue ✕, fora da contagem e com o relógio parado, depois do pedido seguinte (antes, ◷); o pai dela, sem mais nada aberto embaixo, fica ✓. O golden é regravado com a validação dele no app.
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o golden guarda a árvore do desenho e as fontes dos `Svg`; é regravado pela sessão de migração e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("nao aparece nenhum card"): o cartão e o cabeçalho ganham fundo e borda translúcidos; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)"): as guias da árvore e a faixa à esquerda dos cartões passam de caracteres de caixa a caixas nativas com fundo; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; "1,4"; "nos 4 lados"; "Não, fica como está (Recomendado)"): o fundo e a borda do cartão por nível, a linha de 1,4 de altura com o conteúdo centrado e o respiro do cartão nos quatro lados; o espaço entre o ícone e o título não muda; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Código: draw/layout.ts
Estado: coberto

### visual.desenho-cartao-filha
O desenho do cartão da filha trabalhando é o validado no app.

- Dado uma filha trabalhando, com busto, toks/s, repositório e branch e anel
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: desenho validado pelo usuário no app em 2026-10-29 ('sim, correto'); golden decidido em 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Reescrito: 2026-11-03, decisão do usuário ("gostei da V4, siga para análise e implementação"): o cabeçalho V4 ("Respiro", 116 px). O golden é regravado com a validação dele no app.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o cenário passa a publicar o contexto, para o anel; o golden guarda a árvore do desenho e as fontes dos `Svg`; é regravado pela sessão de migração e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("nao aparece nenhum card"): o cartão e o cabeçalho ganham fundo e borda translúcidos; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)"): as guias da árvore e a faixa à esquerda dos cartões passam de caracteres de caixa a caixas nativas com fundo; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; "1,4"; "nos 4 lados"; "Não, fica como está (Recomendado)"): o fundo e a borda do cartão por nível, a linha de 1,4 de altura com o conteúdo centrado e o respiro do cartão nos quatro lados; o espaço entre o ícone e o título não muda; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Código: draw/layout.ts
Estado: coberto

### visual.desenho-envios
O desenho do ✉ na fila, entregue e interrompido é o validado no app.

- Dado tarefas de mensagem na fila, entregue e interrompida
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: desenho validado pelo usuário no app em 2026-10-29 ('sim, correto'); golden decidido em 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Reescrito: 2026-11-03, decisão do usuário ("gostei da V4, siga para análise e implementação"): o cabeçalho V4 ("Respiro", 116 px). O golden é regravado com a validação dele no app.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o golden guarda a árvore do desenho e as fontes dos `Svg`; é regravado pela sessão de migração e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("nao aparece nenhum card"): o cartão e o cabeçalho ganham fundo e borda translúcidos; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)"): as guias da árvore e a faixa à esquerda dos cartões passam de caracteres de caixa a caixas nativas com fundo; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; "1,4"; "nos 4 lados"; "Não, fica como está (Recomendado)"): o fundo e a borda do cartão por nível, a linha de 1,4 de altura com o conteúdo centrado e o respiro do cartão nos quatro lados; o espaço entre o ícone e o título não muda; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Código: draw/layout.ts
Estado: coberto

### visual.desenho-subagente
O desenho do cartão de subagente e do cartão de grupo é o validado no app.

- Dado um subagente rodando com a ferramenta em uso, um concluído e quatro lançados juntos
- Quando o painel é desenhado no app desktop
- Então o desenho é o que o usuário validou no app

Origem: decisão do usuário, 2026-11-09 ("Cartão + grupo (Recomendado)"); golden decidido em 2026-10-28 ("Sim, validar antes do commit (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o golden guarda a árvore do desenho e as fontes dos `Svg`; é regravado pela sessão de migração e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("nao aparece nenhum card"): o cartão e o cabeçalho ganham fundo e borda translúcidos; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)"): as guias da árvore e a faixa à esquerda dos cartões passam de caracteres de caixa a caixas nativas com fundo; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Reescrito: 2026-11-13, decisão do usuário ("aumente um pouco o contraste do card, deixando ele um pouco mais claro, e repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora"; "1,4"; "nos 4 lados"; "Não, fica como está (Recomendado)"): o fundo e a borda do cartão por nível, a linha de 1,4 de altura com o conteúdo centrado e o respiro do cartão nos quatro lados; o espaço entre o ícone e o título não muda; o golden é regravado ("Validar só no fim (Recomendado)") e validado pelo usuário no app no fim.
Código: draw/layout.ts
Estado: coberto

### visual.faixa-de-estado-geral
A faixa à esquerda do cabeçalho diz o estado geral pela cor.

- Dado o painel com tarefas, sessões filhas ou nada
- Quando o cabeçalho é desenhado no app desktop
- Então a faixa é âmbar com tarefa em andamento; âmbar claro ("aguardando") com algo aguardando ou só tarefas pendentes, nada iniciado; azul com só uma sessão filha trabalhando; verde com tudo concluído; cinza com o que ficou interrompido; e o estado vai ao texto alternativo ("estado geral: …")

Origem: decisão do usuário, 2026-11-03 ("gostei da V4, siga para análise e implementação"; para só pendentes, nada iniciado: "Âmbar claro, 'aguardando'", contra a recomendação de cinza).
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o estado no texto alternativo do cabeçalho ("estado geral: …"), não mais a classe da faixa no SVG; a regra não muda.
Código: draw/svg.ts, hooks/render.tsx
Estado: coberto

### visual.secao-sem-traco
A linha "+N pedidos anteriores" (e as outras seções) não tem traço horizontal.

- Dado uma seção no painel ("+N pedidos anteriores", na raiz ou dentro de um cartão; "+N cartões antigos")
- Quando o painel é desenhado
- Então não há linha horizontal atravessando o painel nem as bordas do cartão; a seção é só o ▸/▾ e o texto apagado

Origem: decisão do usuário, 2026-11-09 ("esta ficando bom, mas tem uma linha em cima do +1 pedido anterior, não quero ver essa linha."; "Tirar de todas (Recomendado)").
Código: draw/svg.ts
Estado: checklist (pintura real)
