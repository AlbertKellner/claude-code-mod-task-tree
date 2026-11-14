# codigo-task-tree: implementação (2026-10-21)

## Pedido (palavras do usuário, via principal)
1. Tarefas na ordem de execução = ordem do plano; grupo novo sempre abaixo dos existentes.
2. Filha ocupada que recebe mensagem nova: o painel dela é duplicado. O cartão antigo (grupo em andamento) fica onde estava; o novo fica embaixo da tarefa da principal que mandou a mensagem.
3. Carta azul (✉) na tarefa que enviou enquanto a filha não leu; quando ela começa a tratar, a carta some e o cartão novo aparece.

## O que foi implementado
- `hooks/register.tsx`
  - plan: um nível 1 aberto replanejado com o mesmo id agora fica **no mesmo lugar** (antes ia para o fim); os novos entram abaixo. Texto do `RULES` atualizado ("substituído do zero no mesmo lugar da lista").
  - SendMessage (loop principal): grava em `Child.rounds` `{ at, anchor }` (hora tirada **antes** da chamada, para um "delivered" que abre o turno da filha na hora; `at` do `Send` na fila usa a mesma hora).
  - `refreshChildren` preserva `rounds`.
  - Nova função `split(c)`: divide o painel publicado da filha num cartão por mensagem. Cada turno da filha vai para a última rodada com `rodada.at <= turno.at` (0 = mensagem de abertura). O cartão 0 fica na âncora original; o cartão k fica sob `rounds[k-1].anchor`. Subagentes, avisos e netas vão ao cartão da tarefa-âncora deles (senão ao cartão "líder": o que tem tarefa iniciada aberta, senão o último). Só o líder mostra aguardando e o anel de contexto; com a filha rodando, todo cartão com tarefa aberta é desenhado em andamento. Mensagem ainda não lida não abriu turno → sem cartão (a ✉ já existente continua na tarefa do envio).
  - `panel()` usa `p.children.flatMap(split)`; a visão resumida (`cut`) divide antes do corte e não move os cartões pelo `lastAnchor`.
  - Chaves de abrir/recolher do cartão k>0: `<escopo>s:<id>#k` e escopo interno `<escopo><id>#k>` (cartão 0 inalterado).
- `types/index.d.ts`: `Child.rounds?` e `Child.part?` (só de desenho).
- `tests/task-tree.test.ts`: 2 testes ajustados para a nova ordem do replanejamento; novo `describe('cartão por mensagem na filha')` com 2 testes (não lida: ✉ e um só cartão; lida: dois cartões, novo sob a tarefa do envio, N1 antes de N2).

## Verificação
- `claude plugin test task-tree` (2.1.304): 123 pass, 0 fail.
- `claude plugin validate task-tree` e `claude plugin validate .`: passed.

## Não verificado
- Não visto ao vivo no app (painel real com filha recebendo mensagem).
- Agente `plugin-validator`/`skill-reviewer` não rodado.
- Versão em `plugin.json` não alterada (fica para governança decidir).
- Turnos da filha atribuídos por hora: mensagem de uma irmã (não da mãe) cai na rodada mais recente da mãe.
- `task-tree/DESENVOLVIMENTO.md` tem alteração prévia não minha; não toquei.

## Acréscimo: painel da filha espelha as tarefas dela
Pedido do usuário: "no painel da sessão filha, devem aparecer exatamente as tarefas de dentro dela, hoje, a sessão orquestradora não mostra essas tarefas".

Diagnóstico: os dados chegam (o arquivo publicado da orquestradora em `~/.claude/task-tree-waits/` traz o painel de cada filha com as tarefas). O problema era o desenho: uma filha parada (ociosa) era desenhada com ✓ "concluída" e **recolhida**, mesmo com tarefas abertas (ex.: "Aguardar sinal…"), então as tarefas não apareciam.

Correção (`session()` em register.tsx): filha parada, não arquivada, com tarefa aberta → ícone ◷ (tom `paused`), palavra "parada" e cartão **aberto** por padrão, com as tarefas como ela planejou (estado de cada uma). Só fica "concluída" e recolhida quando não há tarefa aberta. O ▾/▸ continua recolhendo.

Testes: 2 testes de "sessões abertas" atualizados (parada com tarefa aberta agora vem aberta, "parada"). 123 pass, 0 fail; validate passed.

Observação: a orquestradora só vê a mudança se carregar o mod deste clone (`node scripts/origem-task-tree.mjs clone`) ou depois de instalar a nova versão.

## Ajuste: carta azul como ícone da tarefa que espera a entrega
Pedido do usuário: "quando enviar uma mensagem, e a tarefa estiver esperando a entrega, o icone de progresso da tarefa deve ser a carta azul".

Causa: o tom `sent` (✉ azul) já era o ícone da tarefa do envio, mas o envio só era registrado como "na fila" quando o resultado do SendMessage dizia "queued" e **não** dizia "delivered". Um resultado na fila que diz quando "will be delivered" ficava de fora, e a tarefa seguia com o ícone de em andamento.

Correção (handler do SendMessage em register.tsx): espera a entrega quando o resultado diz queued/held/pending e não diz "its turn has started". Só "its turn has started" confirma o recebimento. Quando a filha começa a tratar a mensagem (watchSends), a carta sai e a tarefa volta ao ícone normal (sem mudança aí).

Testes: novo describe "carta azul enquanto espera a entrega" (2 testes). 125 pass, 0 fail; validate passed. Não visto ao vivo; o texto real do resultado "na fila" do app não foi observado (inferido).

## Ajuste: tooltip com o nome completo
Pedido do usuário: "quando fizer mouse over nos nomes, quando estiverem colapsados, mostrar tooltip com o nome completo da tarefa...".

"Colapsado" entendido como nome cortado com "…" (`fit`). Recolher (▾/▸) não corta o nome da linha, então não há o que mostrar ali. O tooltip vale para toda linha cujo nome foi cortado, recolhida ou não.

Implementação (register.tsx, só no desktop): `tip(inteiro, mostrado)` põe `<title>nome inteiro</title>` dentro do `<text>` quando o nome foi cortado, nas linhas (`rowSvg`) e no título do cabeçalho (`headerSvg`). `hovers(source)` liga `isInteractive` no `Svg` só quando há `<title>`: o Svg interativo é desenhado num frame sandbox sem script, onde o tooltip do `<title>` funciona (no modo imagem padrão não funciona). As linhas sem corte continuam como imagem. No terminal não há tooltip.

Testes: novo teste no describe da visão resumida/desktop (corte → `<title>` + `isInteractive`; sem corte → nenhum dos dois); regex do teste "painel estreito" ajustada. 126 pass, 0 fail; validate passed. Não visto ao vivo (tooltip real e custo do frame por linha).

## Correção: cartão novo sob a tarefa que enviou
Bug: a principal planejou a 8 ("Repassar o tooltip…") sem start, com a 7 ainda em andamento, e mandou a mensagem. O cartão novo da filha ficou sob a 7, porque a âncora do envio era `current()` (a última iniciada).

Correção (register.tsx): nova `sendAnchor(tasks)`. A tarefa do envio é a em andamento, a menos que uma tarefa folha aberta, sem start, tenha sido planejada depois do início dela (`plannedAt` > `startedAt` da em andamento): nesse caso, a mais recente dessas. Vale para `rounds` (onde vai o cartão), `lastAnchor` (visão resumida) e `sends` (carta azul). Tarefas planejadas juntas antes do start não mudam nada: a em andamento continua sendo a de origem.

Testes: novo describe "tarefa de origem do envio" (2 testes). 128 pass, 0 fail; validate passed.

Observação: o working tree também tem o tooltip (register.tsx e testes), ainda não commitado (cb2c101 não o levou).

## Ajuste: nada recolhe sozinho ao concluir
Pedido do usuário: "quando você finalizar as tarefas, não colapse os itens, se eu quiser, eu mesmo colapso".

Implementação (register.tsx, render): todo padrão de abrir/recolher passou a "aberto". (1) Tarefa concluída mostra todas as subtarefas (antes: só o caminho até uma filha viva, `pinned`). (2) Turno (pedido) concluído vem aberto. (3) Cartão de sessão filha vem aberto, rodando, parada, concluída ou arquivada. (4) Grupo de subagente fechado vem aberto. A escolha do usuário no ▾/▸ (atom `folds`) continua valendo: recolher fecha, abrir abre.

Testes: 18 testes que esperavam recolhimento automático (ou apertavam ▾/▸ para abrir) foram ajustados: agora conferem que vem aberto e que o clique recolhe. 128 pass, 0 fail; validate passed.

Arquivos alterados desde 450aa9f (diff do working tree): task-tree/hooks/register.tsx (correção da âncora do envio `sendAnchor` + não recolher), task-tree/tests/task-tree.test.ts. task-tree/DESENVOLVIMENTO.md também aparece no diff, mas não é meu (documentação/alteração prévia).

## Correção: cartão da filha diverge do painel dela
Causas encontradas (dados reais em ~/.claude/task-tree-waits/):
1. Snapshot defasado: a orquestradora relia as filhas por um intervalo de 10 s criado só no session.start. Uma recarga do mod cancela os timers do módulo antigo, então o intervalo sumia e a releitura só acontecia em chamadas da própria orquestradora (>10 s). Na hora do print, a cópia guardada da governança ainda não tinha o grupo novo (N).
2. Mensagem vinda de uma irmã (docs → SVG → governança) não abria rodada: o `split` só conhecia as mensagens da própria orquestradora (`rounds`). Grupo novo misturado no mesmo cartão e, na visão resumida, cortado pelo trabalho atual.
3. Cartão antigo de uma filha que ainda roda (rodada concluída) dizia "concluída", parecendo que a sessão acabou. O ícone girando é do app (sessão ligada rodando), não do mod.

Correções (register.tsx, types):
- `watchSessions`: intervalo de releitura de 3 s (`POLL`), idempotente, iniciado no session.start e de novo em cada chamada de ferramenta e prompt do loop principal (sobrevive à recarga). `refreshStale` usa os mesmos 3 s.
- `Panel.received` (o que cada filha publica) passa a ser lido no `refreshChildren`.
- `breaks(c, irmãs, me)`: rodadas = mensagens da orquestradora (`rounds`, com a tarefa do envio) + mensagens de irmãs (`received` da filha). Uma rodada de irmã vai para a tarefa sob a qual estava o cartão da irmã que enviou naquele instante, seguindo a cadeia de irmãs (até 5 níveis). `split` usa `breaks`; `panel()` ganhou o parâmetro `me` (id de quem desenha).
- Decisão (pedido 4): os cartões de docs/SVG/governança que receberam mensagem de outra filha aparecem, cada grupo novo no próprio cartão, sob a tarefa da orquestradora em que estava o cartão da filha que enviou (a cadeia toda fica sob a tarefa que disparou a cadeia). Não aninhei dentro do cartão da irmã: as filhas são todas da orquestradora, e aninhar duplicaria a sessão em dois lugares.
- Cartão de uma rodada já concluída: ✓ sem a palavra "concluída".

Testes: novo describe "cartão da filha igual ao painel dela" (3 testes: cartão de mensagem de irmã sob a tarefa certa e na ordem do plano; contagem e estados iguais aos da filha; releitura de 3 s iniciada por chamada de ferramenta sem session.start). Teste "lista velha lida de novo" ajustado para 3 s. 131 pass, 0 fail; validate passed.

Arquivos alterados desde 450aa9f (working tree): task-tree/hooks/register.tsx, task-tree/types/index.d.ts, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md e docs/task-tree-proposta-visual.svg (documentação/SVG, não meus).

## Ajuste: cursor seta no nome cortado
Pedido: "na linha do texto que está colapsado, e aparece o tooltip, o mouse está aparecendo como texto, quero que o mouse seja o mouse padrão, seta".
Implementação: `STYLE` (CSS de todo SVG do painel) ganhou `svg,text{cursor:default;user-select:none}`. Só faz efeito no Svg interativo (nome cortado, com tooltip); no modo imagem não há cursor de texto. Teste do tooltip confere o CSS. 131 pass, 0 fail; validate passed. Não visto ao vivo.
Arquivos desde 450aa9f: os mesmos (register.tsx, types/index.d.ts, task-tree.test.ts meus; DESENVOLVIMENTO.md e docs/task-tree-proposta-visual.svg da documentação/SVG).

## Ajuste: tarefa de envio fecha sozinha ao receber
Pedido (escolha do usuário): "Fechar sozinha ao receber". Caso: SVG mandou à governança ("queued"), deixou a tarefa de envio em andamento e parou; a governança tratou e nada fechou a tarefa da SVG, cujo cartão ficou "parada".
Implementação (register.tsx):
- `watchSends` (roda na releitura periódica de 3 s, sem precisar de turno da sessão): ao marcar um envio como recebido (`taken`), conclui a tarefa do envio no grupo principal (se aberta e sem subtarefa aberta), com o tempo fechado, e publica o painel (o cartão na mãe deixa de aparecer parado).
- Aviso de recebimento (`takenNote`) agora diz que o painel já concluiu a tarefa (reabrir com start se ainda faltava algo).
- `RULES` e o aviso de "ficou na fila": a tarefa fica em andamento até o recebimento e o painel a conclui sozinho; pode encerrar o turno.
Testes: novo "remetente parado: a releitura periódica confirma e fecha a tarefa do envio, sem turno dele"; dois testes de confirmação ajustados (tarefa fica ✓). 132 pass, 0 fail; validate passed. Não visto ao vivo.
Arquivos desde 450aa9f: register.tsx, types/index.d.ts, task-tree.test.ts (meus); DESENVOLVIMENTO.md, docs/task-tree-proposta-visual.svg (doc/SVG).

## Correção: linha com relógio pisca no cartão
Causa: introduzida pelo tooltip. A linha com nome cortado virava um Svg interativo, que o app desenha num frame (iframe sandbox). Um frame recarrega, e fica em branco por um instante, a cada mudança do `source`; a linha com relógio muda a cada segundo. Por isso só piscavam as linhas cortadas e com tempo ("Tarefa de envio fecha sozinha ao re…", "Concluir no watchSends e ajusta…"); as não cortadas (imagem) e sem relógio não piscavam. Não era snapshot vazio.
Correção (register.tsx): a linha volta a ser sempre imagem. O tooltip vai numa camada própria por cima (`hoverLayer`): um Box absoluto com um Svg interativo transparente, só com `<title>` do nome inteiro e `cursor:default`. O source dessa camada só depende do nome e do tamanho, não do relógio, então o frame não recarrega a cada tique. No cabeçalho, a camada cobre só a área do título (largura W-64, altura 24), abaixo dos botões de visão.
Testes: teste do tooltip refeito (linha imagem + camada interativa com o nome); novo "linha cortada com relógio: a camada do tooltip não muda a cada segundo (não pisca)". Helper `desktop()` ignora as camadas por padrão (`layers` = true para incluí-las). 133 pass, 0 fail; validate passed. Não visto ao vivo (conferir que a camada transparente mostra o tooltip e não cobre o ▾/▸, que fica na coluna à esquerda, fora dela).
Arquivos desde 450aa9f: register.tsx, types/index.d.ts, task-tree.test.ts (meus); DESENVOLVIMENTO.md, docs/task-tree-proposta-visual.svg (doc/SVG).

## Correção: cartões da cadeia sob a tarefa de origem
Causa (dados reais): a principal mandou à implementação "fecha sozinha" às 16:38:37 (de 15/15.1) e o pisca-pisca às 16:40:18 (de 16). A implementação repassou "fecha sozinha" à documentação no fim do turno, e a documentação recebeu às 16:41:40, depois do envio da 16. `breaks` atribuía a mensagem da irmã à última rodada da irmã anterior à chegada (a da 16), não à rodada do turno em que ela mandou. Docs, SVG e governança seguiam a cadeia e caíam sob a 16.
Correção (`breaks` em register.tsx): a mensagem de uma irmã pertence à rodada do turno da irmã em que foi enviada (o último turno dela aberto até a chegada). A âncora é a da rodada que abriu esse turno, seguindo a cadeia de irmãs. Assim a cadeia toda (docs → SVG → governança) fica sob a tarefa da principal de onde partiu (15.1), e a próxima cadeia (16) fica sob a 16, em grupos/cartões separados.
Não feito: aninhar o cartão da documentação dentro do cartão da irmã, sob a tarefa "Avisar a documentação". As filhas são todas da principal; aninhar duplicaria a sessão em dois lugares. Ficam sob a tarefa de origem da principal (o mínimo pedido).
Teste: "a mensagem repassada de irmã em irmã fica sob a tarefa de onde a cadeia partiu, não sob o envio mais recente" (falha sem a correção, conferido). 134 pass, 0 fail; validate passed.
Arquivos desde 450aa9f: register.tsx, types/index.d.ts, task-tree.test.ts (meus); DESENVOLVIMENTO.md, docs/task-tree-proposta-visual.svg (doc/SVG).

## Correção: cartões juntos e fora de ordem sob a 16 (caso do print)
Diagnóstico com os dados reais (arquivo publicado da principal às 16:47): com a regra do commit 4bef852 (rodada do turno em que a irmã enviou), as âncoras já saem certas: cadeia da 15 → 15/15.1 e da 16 → 16 para docs, SVG e governança. O print foi tirado antes de a principal recarregar essa correção (o mod roda do clone).
Faltava a ordem: sob uma tarefa, os cartões saíam agrupados por sessão, na ordem da lista do host (governança, SVG, docs), e a implementação por último.
Correção (register.tsx): `begins(c)` (primeiro turno do cartão, senão a primeira tarefa planejada/iniciada) e `inOrder(list)`. Os cartões sob uma tarefa, e os soltos no fim, são desenhados na ordem em que o trabalho começou: implementação → documentação → SVG → governança.
Não feito: aninhar cada cartão sob a tarefa de envio da filha que mandou (o "ideal"). A filha não publica de qual tarefa dela saiu cada envio, e aninhar duplicaria a sessão.
Teste: "a cadeia da 15 fica sob a 15, a da 16 sob a 16, cada uma na ordem impl → docs → SVG → governança" (host listando em outra ordem; falha sem a ordenação, conferido). 135 pass, 0 fail; validate passed.
Arquivos alterados desde o último commit (4bef852): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Ajuste: nome da sessão em linha própria no cartão
Pedido: separar o nome da sessão do "nome da tarefa" na primeira linha do cartão da filha.
Conferido no código: a primeira linha do cartão já era só o cabeçalho da sessão (a primeira tarefa já vinha na linha de baixo). O que aparecia concatenado era `título da sessão · nome` (ex.: "Implementação: mudança de comportamento do task-tree · codigo-task-tree"). O título da sessão é escrito como uma tarefa, por isso parecia tarefa + sessão.
Implementação (register.tsx, `session()`): o cabeçalho mostra só o nome da sessão (`c.name`, ou o título quando não há nome). O título vai só para o alt (`Row.hint`: "Sessão: codigo-task-tree (Implementação: …), …"). As tarefas seguem como estão, a partir da linha de baixo.
Decisão: o ícone de sessão (ramificação ⑂, o ícone de progresso do cartão), o contador d/n, o tempo e o selo de estado ("aguardando", "parada", "concluída", "arquivada") e o anel de contexto ficam no cabeçalho, porque descrevem a sessão, não uma tarefa.
Testes: 30+ expectativas que tinham "Filha A · filha" passam a esperar "filha"; alts esperam "Sessão: <nome> (<título>)". 135 pass, 0 fail; validate passed.
SVG de referência: os cartões de filha que mostram "título · nome" devem passar a mostrar só o nome.
Arquivos alterados desde o último commit (d53d7f0): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md (documentação).

## Ajuste: recolher pelo ícone de progresso, sem ▾/▸
Pedido: "quero que o botao de colapse nao apareca, e que a funcao de colapsar e expandir esteja no icone de progresso da tarefa".
Implementação (register.tsx):
- Some a coluna ▾/▸ (GUTTER removido). No desktop a linha ocupa a largura toda (W); no terminal o nível 1 começa no ícone e cada nível anda 3 colunas (`prefix` sem os 2 espaços da seta).
- Terminal: em linha que recolhe (tarefa com subtarefas, turno, cartão de sessão, grupo de subagente), o glifo do ícone é o próprio Button (`plain`, filho Text na cor do estado). Linha sem nada embaixo: ícone comum, sem botão.
- Desktop: o Svg desenha o ícone como antes; por cima dele, um Box absoluto (coluna `floor((col(depth)-8)/8)`, 2 células) com um Button `plain` de rótulo vazio (em space). Desenhado depois da camada do tooltip, para ficar por cima.
- Sinal de clicável: o ponteiro inverte o botão (comportamento do Button plain). Não há tooltip em Button no kit, então não pus "Recolher/Expandir".
- Estado recolhido (o ▸ sumiu): " ⋯" depois do nome, nas duas superfícies; o alt segue dizendo "recolhida".
- Nada recolhe sozinho (padrão aberto mantido); a chave `fold:<chave>` e o atom `folds` não mudaram.
Testes: ~90 expectativas de texto do terminal convertidas por script (tira "▾ "/"▸ " e os 2 espaços por ancestral; "▸" vira " ⋯" depois do nome); helper `view()` lê o ícone-botão e o " ⋯"; testes do desktop (largura W; Button sem texto sobre o ícone) e novo teste do terminal. 136 pass, 0 fail; validate passed.
Não visto ao vivo: alinhamento do Button sobre o ícone no desktop (conversão px→células estimada em 8 px) e a aparência do botão nativo sem texto.
Arquivos alterados desde o último commit (37925f4): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md (documentação).

## Correção: nome da sessão como rótulo solto (corrige 37925f4)
Pedido: "o nome da sessao ficou como tarefa... deve ser um texto solto nomeando esse painel, e na linha de baixo a tarefa em si".
Implementação (register.tsx):
- Cabeçalho do cartão de sessão vira rótulo (`labelSvg` no desktop; ramo próprio no terminal): só o nome, 12 px, cinza e em negrito; sem ícone de progresso, sem barra, sem contagem, sem tempo e sem conector de árvore até a tarefa da principal (a linha dos irmãos só passa ao lado). Ao lado do nome, como etiquetas: ⑂, o anel de contexto e a palavra de estado ("aguardando" em âmbar, porque o rótulo não tem ícone para colorir; "parada", "concluída", "arquivada" apagadas).
- As tarefas do cartão são as raízes dele: `labelCols` marca, por linha, a coluna do rótulo em que ela está; essa coluna não ganha guia nem ramo. No terminal a coluna some e as raízes ficam alinhadas com o rótulo; no desktop as raízes ficam recuadas dentro do cartão, sem ligação com o rótulo.
- Recolher o cartão inteiro: clicando no próprio rótulo (nome). Terminal: o nome é o Button. Desktop: Button sem texto sobre o nome (largura do nome). Recolhido: " ⋯" depois do nome.
- A contagem e o tempo da sessão saíram da linha; seguem no alt ("Sessão: nome (título), d de n, estado, tempo").
Testes: expectativas do terminal com o cartão atualizadas (rótulo sem ícone, raízes alinhadas); checagens de ícone/contagem do cartão passam a conferir o rótulo; "aguardando" em âmbar conferido no nó. 136 pass, 0 fail; validate passed. Não visto ao vivo (alinhamento do botão sobre o nome no desktop).
Arquivos alterados desde o último commit (71b6970): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md (documentação).

## Correção: ícone que recolhe (alinhamento e pisca), conector do cartão, tooltip
Causas:
- Desalinhado: o botão ficava num Box absoluto, que no desktop é posicionado em células inteiras (top/left inteiros, ver BoxProps), nunca no pixel do ícone; o realce do botão nativo aparecia deslocado.
- Pisca: o botão ficava por cima de uma imagem (Svg) que é trocada a cada segundo (relógio), junto com a camada do tooltip na mesma área.
- Tooltip sumido: o botão absoluto e a camada do tooltip disputavam a mesma área sobre a linha.
- Conector: o rótulo da sessão (cabeçalho novo) não tinha mais ramo; a linha da tarefa da principal passava ao lado sem entrar no cartão.
Correções (register.tsx):
- `foldRow`: a linha que recolhe é cortada em três, no fluxo (sem sobreposição): Svg à esquerda do ícone (`cutSvg`, mesmo desenho com viewBox cortado), o Button que é o próprio ícone (glifo na cor do estado; no cartão, o nome do rótulo), e o Svg depois dele, com a camada do tooltip só sobre esse trecho. O desenho dessas linhas sai sem o ícone (`bare`). O botão fica centrado na altura pela linha (alignItems center) e na posição horizontal do ícone (o corte é em x-7 / x+7). Sem Box absoluto para o botão.
- Rótulo do cartão: o ramo desce da tarefa e entra no cartão, terminando na borda esquerda dele na altura do rótulo (mesmo estilo dos outros conectores).
- Teste novo: em painel estreito, toda linha com nome cortado tem, no mesmo Box do desenho, a camada interativa com `<title>` do nome inteiro, e nenhum Button nesse Box.
Respostas pedidas: sim, o código puxa as linhas para a esquerda desde 71b6970: no desktop a linha começa em 0 (sem a coluna das setas) e no terminal o nível 1 começa no ícone (3 colunas por nível). O SVG deve fazer o mesmo.
Limites: a célula do botão não tem o fundo cinza do cartão (pode aparecer um entalhe de ~14 px nas linhas que recolhem dentro de cartão de filha); o nome cortado do rótulo, por ser o próprio botão, não tem tooltip. Não visto ao vivo.
Testes: 137 pass, 0 fail; validate passed.

## Correção urgente: layout quebrado (desfaz a linha em três de 6af2b20) — PR #5
Pedido: "o layout quebrou, corrija".
Causa: no 6af2b20 a linha que recolhe foi cortada em três (Svg | Button | Svg). O desktop desenha um Button como botão nativo opaco: o glifo saiu branco, sem cor e em outra fonte, com fundo preto; os dois trechos de Svg cortados (viewBox) deslocaram o cartão e deixaram o rótulo sobre o fundo do botão, fora do quadro.
Correção (register.tsx):
- A linha volta a ser uma imagem só: ícone desenhado na cor do estado, rótulo dentro do quadro do cartão, conector entrando no cartão (mantido).
- O alvo de clique volta a ficar por cima, mas: Box absoluto com top=0 e bottom=0 (altura da linha) e alignItems/justifyContent center, 2 células de largura centradas no ícone (`round(col/8) - 1`); no rótulo, sobre o nome. Button `plain` com rótulo vazio (em space).
- A camada do tooltip começa depois do alvo (`left` = fim do alvo, em células), então nunca se sobrepõem; o rect dela é transparente.
- Removidos `foldRow`, `cutSvg` e o modo `bare`.
Testes: teste do desktop volta a conferir o Button vazio sobre o ícone (Box absoluto, altura da linha, centrado, 2 células); teste do tooltip confere rect transparente, camada começando depois do alvo e ícone desenhado com cor; teste do cartão confere o rótulo dentro do quadro (borda do cartão antes do nome). 137 pass, 0 fail; validate passed.
Limite que continua: o kit posiciona o alvo em células (~8 px), então o realce do botão ao passar o mouse pode ficar alguns px fora do centro do ícone; não há alvo de clique invisível sem botão nativo no desktop. Pisca: o alvo não está mais sob a camada do tooltip; não visto ao vivo.
Arquivos alterados desde o último commit (6af2b20), branch fix/cartao-da-filha-rotulo-e-recolher (PR #5): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md (documentação).

## Ajuste: a linha inteira recolhe ao clicar (opção b) — PR #5
Decisão do usuário: "Clicar na linha inteira".
Implementação (register.tsx, desktop): em cada linha que recolhe (tarefa com subtarefas, turno, grupo de subagente, rótulo do cartão da filha), um Box absoluto cobrindo a linha toda (top/bottom/left/right 0, alignItems stretch) com um Button plain de rótulo vazio (em space): o realce nativo aparece na linha inteira, sem quadrado sobre o ícone nem no meio do nome. Linha sem nada embaixo: sem Button. O desenho (ícone colorido, rótulo dentro do cartão, conector) não muda.
Tooltip: nas linhas com nome cortado, a camada do tooltip cobre só o nome (do início do texto ao fim do texto cortado) e é desenhada depois do Button, por cima dele. Passar o mouse no nome mostra o nome inteiro; clicar no nome não recolhe (o clique fica com a camada); o resto da linha recolhe. Não há como ter as duas coisas no mesmo ponto: a camada do tooltip é um frame que recebe o ponteiro.
Pisca: a camada do tooltip não muda com o relógio; o Button cobre uma imagem que muda a cada segundo (linha com tempo) e não foi visto ao vivo.
Terminal: sem mudança (o ícone continua sendo o botão).
Testes: Button sem texto cobrindo a linha toda (Box absoluto nas quatro bordas, stretch); camada do tooltip depois do Button e começando no nome. 137 pass, 0 fail; validate passed.
Arquivos alterados desde o último commit (8a46908): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts (meus); task-tree/DESENVOLVIMENTO.md (documentação).

## Correção: clicar na linha não recolhia (f632502)
Investigação:
1. Carga: o app carrega o task-tree do clone (`CLAUDE_CODE_PLUGIN_DIRS` aponta para task-tree/ deste repo; o plugin instalado está desligado), e o clone está na branch fix/cartao-da-filha-rotulo-e-recolher. Não há recusa do ui.render nas transcrições (busca por "task-tree: ui.render" vazia). Não é questão de recarregar.
2. Causa provável (código): o Button da linha tinha rótulo de um em space. O desktop desenha um Button nativo da largura do rótulo; o `alignItems: stretch` do Box não o alarga. O botão ficava minúsculo no canto esquerdo da linha (sobre as guias), e o clique no ícone ou no nome não caía nele.
3. Ao vivo: não há log acessível do desktop para conferir o press (o log de depuração do plugin só sai com `claude --debug`); não verificado.
Correção (register.tsx, `foldOver`): o rótulo do Button é uma sequência de em spaces da largura da linha (`floor(RW / 13)`), então o botão nativo cobre a linha toda.
Teste: o rótulo é só em spaces e soma a largura da linha. 137 pass, 0 fail; validate passed.
Se ainda não funcionar ao vivo, a outra hipótese é o kit não entregar o ponteiro a Button dentro de Box absoluto ("the pointer on it is on its parent", BoxProps.position); aí a saída seria o Button no fluxo (o que voltaria a mostrar o botão nativo).
Arquivos alterados desde o último commit (f632502): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Ajuste: ✉ em todo envio até o destino tratar (inclusive entre filhas) — PR #5
Causa: (1) o envio só era registrado quando o resultado do SendMessage era "queued"; entre filhas a entrega costuma ser imediata ("delivered; its turn has started"), então a tarefa nunca ganhava ✉. (2) O caminho é o mesmo para principal e filhas (o hook de SendMessage roda em toda sessão com o plugin), mas os envios não eram publicados, então o cartão espelhado da filha na orquestradora não tinha como mostrar ✉.
Implementação (register.tsx, types):
- Todo SendMessage que não falhou é registrado em `sends` (com `delivered: true` quando a entrega foi imediata) e publicado; a tarefa de envio fica com ✉ até a sessão destino ser vista tratando a mensagem (`received` publicado por ela ou turno aberto depois do envio, na releitura de 3 s). Aí o painel conclui a tarefa sozinho (comportamento do "fecha sozinha" já existente). Envio entregue na hora não gera lembrete de recebimento.
- O painel publicado de cada sessão leva `sends` (pendentes); a orquestradora lê (`Panel.sends`) e desenha ✉ na tarefa de envio dentro do cartão espelhado (por escopo do grupo principal de cada painel).
- Envio com erro (`isError` ou `"success": false`) não fica com ✉.
- RULES: a tarefa de envio fica com ✉ até a sessão destino tratar, mesmo com entrega imediata; não chamar done nela; o painel conclui sozinho.
Confirmação da proposta da principal: sim, ✉ desde o SendMessage até o destino começar a tratar; com entrega imediata, aparece pelo intervalo até a confirmação (até ~3 s), também no cartão espelhado. Se o modelo chamar done antes disso, a ✉ some com a tarefa concluída (done segue permitido).
Testes: entregue na hora mostra ✉; envio com falha não mostra; cartão espelhado mostra ✉ na tarefa de envio da filha; teste da resumida ajustado. 139 pass, 0 fail; validate passed.
Arquivos alterados desde o último commit (12d2296): task-tree/hooks/register.tsx, task-tree/types/index.d.ts, task-tree/tests/task-tree.test.ts.

## Correção: cartão novo de filha nascia na raiz e pulava (PR #5)
Causa: a origem de um cartão aberto por mensagem de irmã era deduzida dos turnos da irmã que mandou. Enquanto o estado dela lido pela principal ainda não tinha o turno do envio (leituras de 3 s, arquivos escritos em momentos diferentes), a origem saía errada ou vazia, e o cartão ia para a raiz (fim da lista, ou solto na visão resumida) até a próxima leitura.
Correção (register.tsx, `breaks`/`split`):
- A origem vem primeiro do ✉ da irmã: o envio pendente publicado por ela (`sends`) para esta sessão aponta a tarefa de envio; o turno dessa tarefa dá a rodada e a âncora na principal. Sem ✉, o último turno da irmã antes da chegada (como antes).
- Sem origem conhecida, o cartão da mensagem não é desenhado por até 10 s (`WAIT_ORIGIN`) a partir da chegada; passado o prazo, vai para onde der (raiz se nada).
Testes: primeiro desenho com a irmã ainda com ✉ já põe o cartão sob a tarefa de origem; sem origem, o cartão não aparece antes do prazo e aparece depois (falha com prazo 0, conferido). 141 pass, 0 fail; validate passed. Não visto ao vivo.
Arquivos alterados desde o último commit (7c734de): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Ajuste: só o ícone recolhe, com o realce centrado; ⑂ à esquerda do nome (PR #5)
Pedido: "volte para a solucao anterior de somente o icone de progresso ser clicavel, e ajuste o tamanho do box atras para ocupar o tamanho do icone com adicional de padding nos 4 lados. Para o painel de sessao, coloque o icone se sessao filha do lado esquerdo do nome da sessao, e ele tera a funcao de colapsar o painel".
Implementação (register.tsx):
- Sai o Button da linha inteira. Só o ícone de progresso das linhas com filhos recolhe: Button `plain` de rótulo vazio (1 em space) num Box absoluto da altura da linha (top/bottom 0) que o centra nos dois eixos (alignItems/justifyContent center).
- Centralização: o Box é posto em células inteiras (~8 px), mas o que ele contém é centrado em pixels. O Box abrange 3 células nas profundidades pares (left = 5·d/2) e 2 nas ímpares (left = (1+5·d)/2): o meio dele cai a 0,5 px do centro do ícone (col(d) = 12,5 + 20·d). Vertical: centrado na linha.
- Padding: o tamanho do realce é o do botão nativo (rótulo de 1 em space, ~13 px, mais o padding do próprio botão), não controlável pelo plugin; como fica centrado no ícone, a folga é igual nos quatro lados na medida em que o botão nativo é simétrico. Não visto ao vivo.
- Cartão da filha: o ⑂ passa para a esquerda do nome, no lugar do ícone de uma tarefa, e é o botão que recolhe o cartão (mesmo Box e centralização). Anel de contexto e palavra de estado ficam à direita do nome. Terminal: "⑂ nome  estado", com o ⑂ como botão.
- Tooltip: a camada do nome cortado volta a cobrir o nome inteiro, começando depois do Box do ícone (sem sobreposição).
Testes: Button vazio só sobre o ícone, Box da altura da linha, células [0,3] e [3,2], meio a ≤1 px do ícone; ⑂ à esquerda do nome no cartão; rótulos do terminal "⑂ nome". 141 pass, 0 fail; validate passed.
SVG: o ⑂ do cartão muda de lado (à esquerda do nome).
Arquivos alterados desde o último commit (2994dbf): task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Ajuste: anel de contexto só no cartão da filha, solto à direita (PR #5)
Pedidos: "nao precisa colocar esse icone na tarefa pai que originou essas sessoes, porque gera inconsistencia" e "o icone de porcentagem de uso do contexto das sessoes filhas, deve estar solto e na direita da mesma linha".
Implementação (register.tsx):
- Linhas de tarefa (nível 1 e subtarefas) e de turno não mostram mais o anel de contexto das filhas (nem no alt). O anel fica só no rótulo de cada cartão de filha.
- Decisão: o ⑂ continua nas linhas pai, marcando que há sessão(ões) abaixo (é um indicador de presença, não ambíguo como o %).
- No cartão, o anel vai para a ponta direita da linha do rótulo (centro em R-7, a coluna onde terminam o tempo e a contagem das linhas de baixo), separado do nome; a palavra de estado segue logo depois do nome. Terminal: o "42%" vai para o fim da linha do rótulo.
Testes: anel só no cartão, na ponta direita (longe do nome, perto da borda); pais sem anel e com ⑂; duas filhas cada uma com o seu anel; arquivada com anel apagado no cartão; turno sem anel. 141 pass, 0 fail; validate passed. Não visto ao vivo.
Arquivos alterados desde o último commit: task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Correção: painel parado na primeira tarefa e pulando para a última (PR #5)
Causa: (1) comportamento do agente, confirmado no meu próprio turno do print: planejei o grupo 25, não chamei start em nenhuma etapa e fechei 25.1, 25.2 e 25.3 num único done no fim. O painel ficou com a primeira como "em andamento" (a primeira aberta) o tempo todo e as do meio saíram com 0:00. (2) O espelho não é a causa: cada mudança publica o painel na hora e a principal relê as filhas a cada 3 s.
Correção do plugin (register.tsx):
- done avisa no resultado quando 2 ou mais etapas nunca iniciadas fecham juntas: "N etapas fecharam juntas sem start (...): o painel ficou parado na primeira e elas aparecem com 0:00. Daqui em diante, marque cada etapa com start ao começá-la e com done ao terminá-la, uma de cada vez".
- Regra (RULES) e o contexto do prompt.submit ficaram mais firmes: "etapa por etapa: start ao começar cada tarefa e done assim que ela estiver de fato concluída, antes da próxima (nunca várias de uma vez no fim)".
- Neste trabalho marquei etapa por etapa.
Testes: aviso no done em lote; sem aviso com start ou com uma só. 143 pass, 0 fail; validate passed.
Arquivos alterados desde o último commit: task-tree/hooks/register.tsx, task-tree/tests/task-tree.test.ts.

## Recurso: resposta da sessão (↩) no cartão, por turno (PR #5)
Pedido: "adicione nos paineis de sessao, o que foi gerado como resposta, com um icone de resposta".
Fonte da resposta: na própria sessão filha, ao fim de cada turno do loop principal (evento `turn.complete`, não abortado): o `recap` do wrap_up daquele turno (o mesmo texto que abre o aviso de fim de turno que chega à principal), senão `answer` do turn.complete (a mensagem final visível do turno). Uma linha (espaços colapsados), até 600 caracteres.
Implementação (register.tsx, types):
- `Turn.reply`: gravado no último turno com tarefas do grupo principal e publicado junto com o painel (a principal lê no arquivo de cada filha).
- No cartão da filha (cada cartão = um grupo/rodada), depois das tarefas, uma linha ↩ por turno com resposta, na ordem dos turnos: ícone de seta de resposta cinza, texto apagado, sem barra, contagem nem tempo; não é tarefa e não entra no X/Y. Cortada com "…" e com o tooltip do texto inteiro (mesma camada dos nomes cortados). Enquanto o turno roda, não há linha.
- Terminal: "↩ texto" apagado.
Testes: a sessão grava o recap (ou a mensagem final) no turno e publica; o cartão mostra a linha ↩ depois das tarefas, sem contar no X/Y e sem contagem no desktop. 145 pass, 0 fail; validate passed. Não visto ao vivo.
Arquivos alterados desde o último commit: task-tree/hooks/register.tsx, task-tree/types/index.d.ts, task-tree/tests/task-tree.test.ts.

## ↩ nos grupos do próprio painel (2026-10-21)
- Pedido: "igual a sessao filha, as tarefas que tenham filhas precisam ter tambem a resposta com o icone de resposta".
- register.tsx `turnRows`: depois dos níveis 1 do grupo da mensagem (turno), linha `reply` (↩, cinza, sem X/Y, sem tempo; o corte com reticências e o tooltip vêm do desenho comum de linha). A fonte é a mesma `Turn.reply` (recap do wrap_up, senão a mensagem final).
- Decisão: uma linha por turno, no fim do grupo da mensagem, mesmo com vários níveis 1, e também quando o nível 1 não tem filhas. Tarefas soltas de antes dos turnos não têm ↩. Só aparece com o grupo aberto.
- Teste novo: "no próprio painel, a resposta fecha o grupo da mensagem…". validate ok; test 146 pass, 0 fail.

## Tarefas fora de ordem (2026-10-21)
- Pedido: "as terafas foram executadas fora de ordem, verifique se existe um erro".
- Causa (hipótese 2, ids): `resolve` dava prioridade ao id completo. "1" e "3" achavam níveis 1 antigos já concluídos ("1", "3" de planos anteriores), não "31/1"/"31/3" abertos. done("1") e start("3") foram para tarefas antigas (o start ainda avisou "3 já foi concluída e tem subtarefas"). Não houve perda na recarga. Também houve comportamento meu (Edit antes do start da 31/2).
- Correção: `resolve` junta id completo e curto e prefere o aberto; no mesmo estado, o id completo desempata. Teste "id curto contra nível 1 antigo". validate ok; 147 pass, 0 fail.

## Cartões de filhas na raiz (2026-10-21)
- Pedido: "voltou o comportamento de sessoes abrirem no lugar errado".
- Causa (pelos arquivos de ~/.claude/task-tree-waits): o que liga os cartões às tarefas (children com anchor/lastAnchor/rounds, sends, received, launches) ficava só no $.state. Os grupos voltam do $.store, mas esses dados não. Depois do reinício do app (e de recargas), todas as filhas ficaram com anchor null, as rodadas da implementação só a partir da 41, e docs/SVG/governança só com 2 entradas em received. As cadeias antigas e as que dependem delas perderam a origem, e os cartões caíram na raiz.
- Correção: `saveLinks` (chamada em publishWait) grava `links:<sessão>` no store; `restoreLinks` (no session.start e, numa recarga sem session.start, antes do primeiro save) junta ao estado atual: devolve anchor/lastAnchor/rounds às sessões e as entradas que faltam nas listas.
- Testes: "recarga do mod, antes" (store recebe rodadas Y/Z) e "recarga do mod, depois" (módulo novo só com o store; cada cadeia continua sob a tarefa de origem). validate ok; 149 pass, 0 fail.
- Não feito: o prazo de 10 s para cartão sem origem continua; com os dados persistidos, a origem se resolve.

## ↩ some em grupo com cartão de filha (2026-10-21)
- Pedido: "quando as tarefas da sessao orquestradora abrirem sessao, a resposta nao deve aparecer, senao, fica quebrado, aparece a tarefa origem, depois a tarefa em andamento, e entao a resposta, não ficou bom".
- register.tsx `turnRows`: o ↩ só aparece se nenhum nível 1 do grupo da mensagem tem cartão de sessão embaixo (`atWork(...).any`, que cobre start_session e SendMessage). Grupos sem cartão continuam com ↩.
- Teste "grupo com cartão de sessão filha não mostra o ↩ da própria sessão". validate ok; 150 pass, 0 fail.
- Por um instante, a condição ficou `&& false` (↩ desligado em tudo) por causa de um teste de mutação mal feito; revertido em segundos.

## ↩ como resumo de até 60 caracteres (2026-10-21)
- Pedido: "as respostas, onde sao representadas pelos icones de resposta, devem ser um resumo, no maximo 60 caracteres".
- Fonte escolhida: as duas opções. (1) Campo novo `summary` no `done`, pedido nas RULES e na descrição da tool, para o done do último passo. (2) Fallback: a primeira frase da resposta (recap do wrap_up, senão a mensagem final).
- `brief()`: até 60 caracteres; acima disso, corta em limite de palavra com "…". Guardado em `Turn.brief`, com a resposta inteira em `Turn.reply`.
- Desenho: a linha ↩ (cartão da filha e painel próprio) mostra o brief; `Row.whole` leva a resposta inteira ao tooltip. Turnos antigos sem brief derivam o resumo de reply.
- Teste "↩ é um resumo de até 60 caracteres…". validate ok; 151 pass, 0 fail.

## ↩ com resumo escrito pela sessão (2026-10-21)
- Pedido: "nao ficou bom, voce esta imprimindo o texto integral cortado. quero que seja um resumo da resposta, super curto, e esse resumo tenha ate 60 caracteres, para caber na linha e entender por cima o que foi respondido".
- Pedido chega a quem responde por quatro caminhos: (1) prompt.submit: "No done da última etapa do turno, passe summary: resumo da resposta em até 60 caracteres, tipo manchete."; (2) schema do done: `summary` com descrição própria, e `ids` deixou de ser obrigatório (done só com summary vale); (3) done que fecha a última tarefa aberta sem summary responde "falta o summary…"; (4) wrap_up sem summary no turno avisa "falta o resumo do turno…".
- Fallback: sem summary, o ↩ diz só "resposta", com a resposta inteira no tooltip. Não deriva nada da resposta, porque qualquer corte do texto é o texto integral cortado que o usuário recusou.
- Summary acima de 60: corte em palavra com "…".
- Testes atualizados; 151 pass, 0 fail; validate ok.

## Anel de contexto abre a sessão (2026-10-21)
- Pedido: "quero que o icone de contexto seja um icone clicavel tambem, e quando clicar nele, abra a sessao que ele representa".
- Pesquisa no kit: não há API própria para navegar entre sessões. `Link` (href) no desktop só abre https:, e `#local_<id>` não é garantido num pane. O caminho viável é a tool do app `open_session_in` (servidor ccd_window), chamada por `$.mcp.call('ccd_window', 'open_session_in', { session_id, target: 'focus' })`. Ela mostra a sessão no painel principal desta janela, como o clique na barra lateral.
- Limites do app: só abre esta sessão ou uma que ela abriu (nos cartões de netas, recusa); age só com esta sessão na tela; recusa com o cursor em campo de texto ou terminal. Recusa ou erro vira toast "Não abriu <nome>: <motivo>".
- Desenho: `ringOver` põe um Button sem rótulo num Box absoluto de 3 células centrado no anel (15 px dentro da borda do cartão mais interno), como o foldOver do ícone. `Row.sid` leva o id da sessão. O ⑂ continua recolhendo.
- Não feito: tooltip "Abrir <nome>" (Button não tem tooltip, e uma camada interativa por cima engoliria o clique) e cursor de mão (o kit não controla o cursor do Button nativo).
- Teste "anel de contexto abre a sessão". validate ok; 152 pass, 0 fail.

## ↩ até 120 caracteres (2026-10-21)
- Pedido: "aumente a resposta para 120 caracteres, esta muito sucinto".
- BRIEF = 120. Os textos passam a dizer "até 120 caracteres": RULES, descrição do done e do campo summary ("o que mudou e o resultado"), contexto do prompt.submit, aviso do done e do wrap_up, comentário do tipo Turn. O teste de corte foi ajustado. O corte visual pela largura e o tooltip continuam. validate ok; 152 pass, 0 fail.

## Anel em qualquer estado + padding do botão do anel (2026-10-21)
- Pedidos: "mesmo depois que a sessao termina, o icone se contexto precisa continuar aparecendo"; "mesmo problema do icone de progresso, o botao atras nao tem padding".
- Causa do sumiço: em `split`, só o cartão principal (em andamento, senão o último) levava `context`. Os outros cartões da mesma sessão (rodadas antigas, como o 4/4 ✓ do print) ficavam sem anel. Agora todo cartão leva o último % publicado, em qualquer estado.
- Sem % publicado (sessão que nunca respondeu, versão antiga): sem anel e, por isso, sem botão de abrir. Um anel vazio diria 0%, o que é falso.
- Padding: helper comum `overBox(cx)` escolhe 3 ou 2 células inteiras com o meio mais perto do centro do glifo. O ícone (iconBox) e o anel (ringOver) usam o mesmo helper. Antes, o Box do anel ficava 2,5 px fora do centro.
- Testes: anel em todos os cartões da sessão parada (3 cartões, 37%); Box do anel com 2 ou 3 células e o meio até 2,5 px do centro do anel; Box do ícone igual ao de antes (left 0, width 3). validate ok; 153 pass, 0 fail.
- Observação: o realce é o do Button nativo centrado no Box; se ainda ficar justo, o próximo passo seria um label mais largo (como no 12d2296), mas o ícone aceito usa o mesmo desenho.

## Níveis 1 do mesmo turno ligados no cartão (2026-10-21)
- Pedido: "parece que quebrou de novo o layuot dos elementos" → "Tarefas sem ligação".
- Escolha: (a). No cartão de sessão, um turno que planejou mais de um nível 1 ganha o cabeçalho do pedido (título do request, igual ao painel principal), com os níveis 1 ligados por conector embaixo. Turno de um nível 1 só fica como estava (o próprio nível 1 é o cabeçalho), para não somar uma linha por turno em todo cartão. O ↩ desse cabeçalho não é desenhado no cartão, porque o cartão já lista as respostas abaixo das tarefas.
- Painel principal: já agrupa todo turno sob o cabeçalho do pedido (turnRows no nível 0), então não tinha o problema.
- Ids: nada ficou fora da árvore. 41 e 42 eram níveis 1 meus, do replanejamento que juntou o segundo pedido. Daqui em diante, num ajuste só, um nível 1 com subtarefas.
- Teste "níveis 1 do mesmo turno no cartão". validate ok; 154 pass, 0 fail.

## Crash do hooks worker (2026-10-21)
- Pedido: crash "task-tree was unloaded: it crashed the hooks worker" na orquestradora.
- Causa: explosão combinatória em `breaks` (origem dos cartões de irmãs). Para cada mensagem recebida, recalculava os breaks da irmã remetente, de forma recursiva até a profundidade 5. As irmãs trocam mensagens em anel (impl → docs → SVG → gov → impl; o received da impl tem 1 da gov, e o da gov 1 da impl). Com `received` agora persistido (926fb44), as listas chegam a 10–20 entradas. Em escala, isso vira 20^5 chamadas por cartão e por desenho, com o painel redesenhando a cada segundo. Não era exceção, por isso não aparece no log: o worker travava.
- Medido: o teste de regressão (4 irmãs em anel, 20 mensagens cada) levou 22,7 s para um desenho com o código anterior (rodado numa cópia fora do repo, sem recarregar as sessões) e 0,1 s com a correção.
- Correção: memo por lista de irmãs (WeakMap; uma lista por desenho) com o caminho na chave; os breaks de cada irmã remetente são calculados uma vez por chamada, não por mensagem; ao reencontrar uma sessão no próprio caminho, conta só as rodadas dela (corte de ciclo).
- try/catch não resolveria (não há exceção). Não acrescentei try/catch extra.
- Teste "irmãs em anel com muitas mensagens". validate ok; 155 pass, 0 fail.
- Os logs do app (%APPDATA%\Claude\logs) não têm o crash; o worker é do processo do Claude Code.

## Cartões acima do grupo (mensagem sem rodada) (2026-10-21)
- Pedido: "layout quebrou novamente".
- Causa (dados da orquestradora): as rodadas da implementação são 53, 54 e 57; a da 56 (layout) e a do crash não foram registradas, porque o envio aconteceu com o painel fora ou durante o crash. Os turnos dessas mensagens caíram na rodada anterior (54, do grupo 48 "Padding"), junto com a cadeia docs → SVG → governança, que herda a origem da implementação. O cartão foi desenhado no grupo 48, acima do grupo 49, que tem a 56.
- Correção (`unsent`): cada mensagem da dona que a filha tratou (o `received` com from = a dona) é casada em ordem com as rodadas. A que sobra abre uma rodada mesmo assim, sob a tarefa da dona que estava aberta quando a mensagem chegou (a que esperava a entrega; aqui, a 56). Sem tarefa aberta, o cartão vai para o fim do painel, depois de todos os pedidos, e nunca entre eles. Rodadas de irmãs sem origem também vão para o fim, em vez da âncora de abertura.
- ↩ do grupo 49: o turno 49 não tem reply guardado. O turn.complete desse turno não rodou porque o crash veio no fim dele. Não foi a regra do cartão de filha (o grupo 49 nem tinha cartão).
- Durante a edição, o módulo ficou ~1 min sem carregar (nome `owner` repetido em split; renomeado para `holder`).
- Teste "mensagem enviada sem rodada registrada". validate ok; 156 pass, 0 fail.

## Hover do anel envolvendo o ícone (2026-10-21)
- Pedido: "o mouse over do anel de contexto continua pequeno, nao envolvendo o icone todo".
- Causa: o realce é o do Button nativo, do tamanho do label dele (' ', um espaço) mais o padding nativo; o Box só posiciona o Button. Com um espaço, o realce fica menor que o anel (15 px: raio 5,5 e traço 2). O Box do anel também ficava a 1,5–2,5 px do centro.
- Correção: o Button do anel tem label em space (U+2003), para o realce ter o tamanho do anel. O Box do anel tem 4 ou 5 células, escolhidas pelo `overBox` com folga mínima de 1 célula (8 px) de cada lado do anel. `overBox` ganhou `widths` e `half` (meia largura + folga); o ícone de progresso segue com o padrão de antes.
- Limites: o kit não dá tamanho ao Button. O realce é o do label mais o padding nativo, e a altura é a da linha do botão. O Box só garante posição e folga. Não consigo medir o realce nativo no teste; o teste confere o Box e o label.
- Teste atualizado: Box com 4 ou 5 células, contendo o anel inteiro com 8 px de folga dos dois lados, e label em space. validate ok; 156 pass, 0 fail.

## Anel centrado no box do botão (2026-10-21)
- Pedido: "quase, ainda esta desalinhado".
- Causa: horizontal, o anel ficava na coluna do tempo (borda do cartão − 15 px) e o box em células inteiras, com o meio até 2,5 px à esquerda dele. Vertical, o box ocupa a altura inteira da linha (top 0, bottom 0), que no cabeçalho do cartão inclui a borda de cima (f.top); o anel ficava no meio do nome, alguns px abaixo do meio do box.
- Correção (como pedido, move o anel, não o box): labelSvg desenha o anel no centro do box do ringOver (o mesmo overBox: x = 8·left + 4·width; y = H/2).
- Teste: folgas esquerda/direita e cima/baixo diferem em até 1 px, e todas são positivas (o anel inteiro dentro do box). Com o desenho anterior, a diferença horizontal era de 5 px. validate ok; 156 pass, 0 fail.

## Anel desalinhado: medido nos prints do usuário (2026-10-21)
- Pedido: "ainda desalinhado". Prints 29.png (antes do c808d40), 30.png (depois) e 8.png (ícone de progresso).
- Medida (cinza por pixel): o realce nativo tem 32 px de largura (4 células); em 30.png, 23 px de altura.
  - 29.png: realce x 17–48, y 20–48; anel x ≈29–48, y ≈29–48; anel 6 px à direita e 4,5 px abaixo do meio do realce.
  - 30.png: realce x 10–42, y 23–45; anel x ≈25–42, y ≈27–41; meio do anel 33,5 contra 26 do realce, 7,5 px à direita, encostado na borda direita; na vertical, centrado (34 e 34).
- Causa real: o desktop deixa o realce (32 px) à esquerda de um Box mais largo; o Box tinha 5 células (40 px), e o anel ia para o meio do Box, não para o do realce.
- Correção: RING_BOX = [4], um Box exatamente da largura do realce, com folga mínima de 4 px (RING_ROOM), e o anel no meio do Box. Esperado: anel centrado, cerca de 8,5 px de folga de cada lado na horizontal e cerca de 4 px na vertical.
- Print de conferência depois: não foi possível, porque a janela do Claude continua minimizada para o computer-use (Click to Do na frente).
- Teste: Box de 4 células, anel inteiro dentro com folga, folgas iguais até 1 px. validate ok; 156 pass, 0 fail.

## Fluxo novo (2026-10-21)
- Palavras do usuário: "pare de tirar print, nao esta funcionando. quando voce finalizar uma implementacao, pergunte se esta funcionando, se sim, prossiga pras proximas etapas".
- Sem computer-use nem screenshot.
- Ao terminar um ajuste (código, testes e validate passando): não mando sinal à documentação; encerro o turno com o relato dizendo o que conferir no painel.
- Só depois do "ok, prossiga" da principal mando o sinal à documentação (cadeia até o PR #5).
- Vale do ajuste seguinte ao do anel de 4 células (que já está na cadeia).

## Anel ancorado pela direita (2026-10-21, aguardando confirmação do usuário)
- Pedido: "ainda não, segue desalinhado". Print 31.png (escala de tela 1,25).
- Medido (px de tela): realce x 27–57, y 20–48, centro (42, 34); anel x 42–60, y 24–43, centro (51, 33,5). Folgas: esq. 15, dir. −3 (anel passa da borda), cima 4, baixo 5. Vertical centrada; o erro é horizontal, ≈9 px de tela = ≈7 px CSS.
- Causa: o anel estava onde foi desenhado (≈15 px CSS da borda do cartão); o Box, contado em células a partir da esquerda (left ≈55), caía ≈7 px à esquerda. A célula do desktop tem um pouco menos de 8 px (≈7,87), e o erro se acumula em ~57 células.
- Correção: Box do anel com `right` (células contadas da ponta direita, onde o erro é de fração de px) e largura de 4 células; o anel no meio desse Box (W − 8·(right + 2)). Removidos RING_BOX/RING_ROOM; o anel não usa mais overBox.
- Teste: Box sem `left`, com `right` e 4 células; anel dentro com folgas iguais até 1 px. validate ok; 156 pass, 0 fail.
- Fluxo novo: sem sinal à documentação até o "ok, prossiga".

## Modelo e esforço no cartão (2026-10-21, aguardando confirmação)
- Pedido: "quero que voce mostre o nome do modelo e o esforco de cada sessao, ao lado esquerdo do anel de contexto".
- Fonte: o evento `turn.step` do kit, a cada pedido ao modelo do loop principal (sem agentId), traz `model` e `effort`. A sessão guarda o texto em `engine` (estado) e publica no arquivo `task-tree-waits`, quando muda. Quem abriu lê e põe em `Child.engine`.
- Nome legível (`engineText`): claude-opus-5-5[1m] → "Opus 5.5 · high"; tira o [1m] e a data; outro nome fica como veio (até 24 caracteres). Conferido com node.
- Desenho: texto cinza (11 px), terminando 8 px à esquerda do anel (ancorado à direita, c1bd3da intacto); sem anel, termina na borda do cartão; omitido se encostaria no nome ou na palavra de estado. Também vai no alt.
- Painel próprio: não pus no cabeçalho do topo. O app já mostra o modelo e o esforço da sessão na própria tela dela; no painel, a informação útil é a das outras sessões.
- Testes: cartão com engine e anel (texto à esquerda do anel e no alt); cartão sem anel. O hook turn.step não tem teste: o kit de teste não tem implementação base para o evento em stream ("no implementation for turn.step").
- Durante a edição, o módulo ficou ~1 min sem carregar (turn.step exige async function*).
- validate ok; 158 pass, 0 fail. Fluxo novo: sem sinal à documentação até o ok.

## Modelo e esforço em todos os cartões (2026-10-21, aguardando confirmação)
- Pedido: "nao aparece em todos os paineis, somente no primeiro".
- Causa (b): só a implementação tinha publicado `engine` ("Opus 5.5 · low"). Docs, SVG e governança estavam com null, porque não rodaram turno com o código novo. Não era (a): split copia o Child inteiro, então todo cartão da sessão recebe o engine dela.
- Correção: sem engine publicado, `engineOf` busca no registro do app (`get_session`: model e effort; ex.: docs = claude-opus-5-5 / low → "Opus 5.5 · low"), com cache de 1 min por sessão. O publicado pela sessão continua tendo prioridade (é o do último pedido).
- Teste "sessão que ainda não publicou: … (get_session)". validate ok; 159 pass, 0 fail. Sem sinal à documentação até o ok.

## Cliques ignorados (2026-10-21, aguardando confirmação)
- Pedido: "as vezes clico nas acoes e nao faz nada, preciso clicar algumas vezes para funcionar.. tanto sessao resumida quanto completa, colapse, abrir sessao pelo anel de contexto".
- Causa provável (hipótese 1): pelos tipos do kit, o host guarda o onPress de um Button "for the drawing's life". O painel redesenha a cada segundo enquanto há tarefa em andamento (relógio); um clique que chega quando o desenho é trocado acha o handler de um desenho que já não existe, e nada acontece. As chaves dos botões já eram estáveis (fold:<chave>, open:<id>, view:<visão>), mas a closure não.
- Correção: hook `ui.press` do painel responde pela chave do Button (`e.element`) com a ação mais recente daquela chave (mapa `actions`, preenchido a cada desenho por `act(key, fn)`), sem depender da closure do desenho velho. Vale para recolher pelo ícone, recolher o cartão pelo ⑂, abrir a sessão pelo anel e os botões ≡/▤.
- Log: cada press recebido vai para o log de depuração ("task-tree: press <chave> (<superfície>)", e ": sem ação conhecida" se a chave não tiver ação), ligado.
- Hipóteses 2–4: o estado recolhido fica no atom `collapsed` e não é recalculado pelo tique; a camada do tooltip não cobre o ícone (já separada no c0f37c4) nem o anel (o nameLayer começa depois do ícone e para antes da ponta direita? fica por cima do nome; o anel está fora dela). Não achei evidência delas.
- Teste: clique depois de o desenho ser trocado ainda recolhe e abre (terminal e desktop). Limite: o kit de teste reencontra o botão pela chave, então esse teste passaria também sem a correção; não reproduz o handle perdido do app.
- validate ok; 160 pass, 0 fail. Sem sinal à documentação até o ok.

## Painel sumiu na orquestradora (2026-10-21, aguardando confirmação)
- Pedido: "o tasktree nao esta aparecendo na orquestradora".
- O que se sabe: o plugin da orquestradora está vivo (publicou o arquivo às 22:47:22; as tools respondem). Não há log de depuração em disco (~/.claude/debug não existe; o app não registra o descarte de um desenho).
- Reprodução (cópia do plugin fora do repo, com o estado real: grupos da orquestradora do arquivo publicado, os 4 cartões das filhas): o desenho sai sem erro (230 ms), mas, na visão completa, tem 733 linhas, 1.066 Svgs, 311 botões e 1,6 MB, reenviados a cada segundo. Na resumida: 20 Svgs, 29 KB. O código dos cliques (último ajuste) não muda o tamanho nem lança erro.
- Causa provável (não confirmada): o tamanho do desenho da visão completa, que cresce com o histórico da orquestradora e passou de algum limite do app. O kit não documenta um limite para o Pane.
- Feito: cada Svg leva só as regras de estilo das classes que usa (`slim`): 1,6 MB → 1,3 MB (−18%). O grosso são as próprias linhas.
- Para trazer o painel de volta: trocar para a visão resumida (≡) ou reabrir com /task-tree. Se ficar na completa com esse histórico, o risco continua; uma saída maior seria limitar a completa (ex.: recolher pedidos antigos concluídos), o que muda o comportamento e precisa da decisão do usuário.
- Teste: cada Svg só com as regras das classes que usa. validate ok; 161 pass, 0 fail. Sem sinal à documentação.

## Troca de modelo e o painel sumido (2026-10-21, aguardando confirmação)
- Pedido: "eu troquei o modelo de opus para sonnet na orquestradora, e o task tree nao rendenizou a partir dai. tem correlacao?"
- Correlação provável: sim. O /model reinicia o processo da sessão; o plugin reabre o painel no session.start (e no plan) sem pedido da pessoa. Pela doc do kit ($.ui.open), um pane aberto sem pedido só é posto na tela com 144 colunas ou mais (110 depois de pedido uma vez); abaixo disso fica "undrawn" (isPlaced false) esperando um pedido. As tools continuam respondendo, como a principal viu. O código de modelo e esforço não entra nisso: get_session e engine tratam modelo novo ou ausente sem erro, e o desenho com o estado real sai sem erro.
- Correção (showPane): a cada prompt da própria pessoa (não mensagem de outra sessão nem aviso do app), se o painel não está na tela ($.ui.panes), ele é reaberto. Esse open conta como pedido e é posto em qualquer largura. Se não for posto, o motivo vai para o log de depuração.
- Para trazer de volta agora: /task-tree na orquestradora, ou o próximo prompt digitado nela, quando o plugin recarregar.
- Teste "painel de volta depois de reiniciar a sessão". validate ok; 162 pass, 0 fail. Sem sinal à documentação.

## Painel ainda some: diagnóstico (2026-10-21, aguardando o usuário)
- Pedido: "Ainda não aparece".
- Feito: a sessão publica no arquivo task-tree-waits o estado dos painéis que o app guarda ($.ui.panes: id, isPlaced, isShown). /task-tree abre com pedido (e foco), responde o que o app disse (posto ou o motivo, ex.: a largura) e os painéis (na frente, aba atrás de outro, não desenhado). /task-tree resumida | completa troca a visão sem clicar.
- Lido da orquestradora às 22:54:22: panes = [{"id":"task-tree","isPlaced":true,"isShown":true}]. Para o app, o painel está aberto, posto e na frente; o plugin não acredita em nada errado. A abertura não é o problema (nem a largura); o que falha é o desenho.
- Causa mais provável: o tamanho do desenho na visão completa (1,3 MB depois do estilo enxuto; 733 linhas). Na resumida, 29 KB.
- Passo para o usuário: na orquestradora, digitar `/task-tree resumida`. Se o painel aparecer, confirma o tamanho; aí a saída é limitar a completa (ex.: recolher pedidos antigos concluídos), que precisa da decisão dele.
- Teste "/task-tree com diagnóstico". validate ok; 163 pass, 0 fail. Sem sinal à documentação.

## Painel some até na resumida: limite do desenho (2026-10-21, aguardando o usuário)
- Pedido: "Continua sem aparecer".
- (1) A cópia da orquestradora roda o código novo: ela publica `panes`, que só existe desde o ajuste anterior. O /task-tree com diagnóstico existe lá; o "não está disponível" do harness é da sessão da principal, não do plugin. Não há outro meio além do comando para trocar a visão (o plugin não lê variável nem arquivo por desenho).
- Estado publicado pela orquestradora: às 22:54 panes = isPlaced true, isShown true; depois da recarga, isPlaced false (reaberto sem pedido, abaixo do piso de largura). renderError = null (o desenho não lançou erro).
- Erro de desenho visível: o hook do Pane agora pega exceção, mostra uma linha "Painel de tarefas: erro ao desenhar: …" e publica `renderError` (e loga). Durante a edição, o módulo ficou ~1 min sem carregar (o validator não aceita $ passado a função local); refeito com try/catch no próprio hook.
- (2) Limite do desenho, em qualquer visão:
  - Painel do topo: só os 3 últimos pedidos (grupos de mensagem), mais qualquer pedido com algo aberto; os anteriores viram uma linha "+N pedidos anteriores".
  - Cartões: até 3 pedidos do cartão, com a mesma linha.
  - Cartões sem tarefa de origem, todos concluídos e começados antes do mais antigo pedido desenhado: viram uma linha "+N cartões antigos de sessões".
  - O cabeçalho continua contando tudo.
- Medido com o estado real da orquestradora (cópia fora do repo), desktop, visão completa: 1.614.695 → 1.322.728 (estilo enxuto) → 101.345 bytes; 1.066 → 77 Svgs; 311 → 31 botões. Terminal: 268.045 → 20.763. Resumida: 29 KB.
- Testes: "histórico longo" (60 pedidos: só os 3 últimos, linha +57, desenho < 100 KB, cabeçalho com tudo). validate ok; 164 pass, 0 fail. Sem sinal à documentação.

## Medidor e desenho de emergência (2026-10-21, aguardando o usuário)
- Confirmado pelo usuário: "Agora está aparecendo, resumir os 57 pedidos anteriores resolveu". A linha "+57 pedidos anteriores" é o limite de grupos do ajuste anterior (3 pedidos no topo, 3 por cartão, cartões antigos sem origem contados). Ele já vale por padrão, sem comando nem compactação.
- Medidas com o estado antigo da orquestradora (cópia fora do repo): visão completa 1.614.695 → 101.345 bytes; resumida 29 KB.
- Limite do kit: não há limite documentado para o Pane (só para Client: 20.000 nós, 32 níveis, 100.000 caracteres; e 131.072 caracteres por SVG). O descarte do app não é documentado nem logado. Por isso o limite próprio DRAW_LIMIT = 600 KB, abaixo de 1,3 MB (o que não aparecia) e bem acima do desenho normal (~100 KB).
- Desenho de emergência: acima de 600 KB, o painel mostra só a linha "Painel grande demais (N KB): mostrando só o essencial. Use ≡ (/task-tree resumida) para a visão resumida." (e loga).
- Medidor: /task-tree responde "Desenho: N KB de 600 KB."
- Teste "desenho grande demais" (700 etapas abertas, que não são cortadas: só o aviso; medidor no /task-tree). validate ok; 165 pass, 0 fail. Sem sinal à documentação.

## Cabeçalho reflete a visão (2026-10-21, aguardando o usuário)
- Pedido: "na visao resumida, quero que a barra superior reflita o que tem nessa visao, a quantidade de tarefas, a barra de progresso, a porcentegem, tempo, etc... cada visao deve refletir os dados do seu tipo de vizualizacao".
- Como: cada linha desenhada ganha `Row.nodes`, as tarefas que ela representa (folha: ela mesma; linha recolhida: a subárvore e as tarefas das sessões embaixo; pai aberto: nada, as linhas de baixo respondem por si; seção/↩/aviso: nada). O cabeçalho (X de Y, %, barra, tempo, chips "em andamento", "interrompidas", "sessões ativas", "aguardando") é somado desses nodes das linhas da visão desenhada. Vale para qualquer visão e para linhas recolhidas pelo usuário (uma linha recolhida continua contando pelo d/n dela).
- Visão completa com o limite de pedidos: o cabeçalho conta só os pedidos desenhados; a linha "+N pedidos anteriores" fica como está; o total geral entra discreto, "(sessão inteira: D de N)", no cabeçalho do terminal e no tooltip (alt) do desktop, só quando difere do mostrado.
- Decisão: total geral só no tooltip/discreto, porque a barra e o % precisam bater com a lista que o usuário vê.
- Testes: 2 antigos ajustados à regra nova; 1 novo ("cabeçalho por visão": 6 pedidos, completa = 7 de 9 com "sessão inteira: 16 de 18", recolhido mantém, resumida = 1 de 3; em todos, o cabeçalho é igual à soma das linhas desenhadas). validate ok; 166 pass, 0 fail. Sem sinal à documentação.
