# Triagem dos achados médios: durabilidade, regras de uso, catálogo, documentação e scripts

Escrito pelo agente de triagem C em 2026-11-13. Só ele escreve aqui.

Fonte: `auditoria-mod-task-tree.local.md`, áreas "Durabilidade, recarga e I/O" (13 médios), "Regras de
uso do painel e lembretes ao modelo" (9), "Catálogo de regras e testes" (8), "Documentação" (3) e
"Scripts, travas e CI" (2). Conferido contra o código da branch `fix/pendencias-auditoria`, ponta
`1f9e8c1`. Só leitura: nada foi executado além de leituras, `git log` e contagens de tamanho.

## Resumo

35 achados médios.

| Classe | Quantos |
|---|---|
| Resolvido ou obsoleto | 1 |
| Correção direta | 17 |
| Decisão do usuário | 14 |
| Não confirmado | 3 |

- Quatro achados foram resolvidos em parte pelos PRs 36 e 37 e seguem na lista só pelo que sobrou: o
  aviso ao modelo sobre subagentes (a reabertura que voltava a ✕ foi corrigida), o resultado do plan
  (os textos que prometiam estado guardado foram corrigidos), o golden (✕ e anel entraram) e os cenários
  de cartão com tarefa replanejada (três dos quatro fluxos ganharam cenário e teste).
- Nenhum dos achados médios destas áreas é a frase nova do lembrete sobre a tarefa parada com Esc em
  turno de aviso. Os lotes de texto abaixo mexem no mesmo arquivo (`task-tree/text/rules.ts`): precisam
  ir em sequência com esse trabalho, não em paralelo.
- Cinco achados têm uma parte direta e uma parte que depende de decisão. Estão contados pela parte
  principal, e a outra parte aparece no texto e nas listas do fim.

Medidas de hoje (só tamanhos e contagens):
- Store do mod (`~/.claude/plugins/store/task-tree_inline-….json`): 962 KB, 23% do teto de 4 MiB. Na
  auditoria eram 591 KB (14%). Por prefixo: `session` 30 chaves e 478 KB (a maior com 166 KB; eram
  282 KB), `links` 143 chaves e 106 KB, `work` 145, `turn` 98, `asks` 13 chaves e 8 KB, `view` 5. Dos
  478 KB de painéis, 204 KB são grupos de subagente (694 grupos; uma sessão sozinha tem 524).
- Pasta dos arquivos publicados (`~/.claude/task-tree-waits`): 129 arquivos, 3,9 MB, o maior com 816 KB.
- Selos: 239 testes selados, 12 com zero asserções contadas (eram 11).

---

# Durabilidade, recarga e I/O

## Store do plugin tem teto de 4 MiB: ao estourar, o painel para de ser salvo em silêncio e a poda nunca mais roda

**Classe: correção direta** (a política de quanto guardar é decisão: ver os achados das 30 sessões e
dos grupos de subagente).

- Prova: `task-tree/state/durability.ts:173-180` (a única poda apaga só `session:` além das 30, e só
  depois de uma gravação que deu certo); `task-tree/hooks/panel.ts:357-359` (`persist` engole a falha
  do `saveGroups`), `56-64` (`saveTurn`), `622-624` (`setWork`) e `692-706` (`saveLinks`): nenhuma das
  quatro gravações registra a falha. O kit tem `$.store.keys()` e o contrato do `set` diz que ele
  rejeita com o store acima de 4 MiB.
- Comportamento errado: quando o store passar do teto, o painel segue certo na tela, mas nada mais é
  salvo. No reinício seguinte, no `/model` ou na retomada, volta a última versão salva (ou vazio) e os
  cartões perdem a tarefa de origem. Nada avisa, e não há recuperação sozinha. O grosso do crescimento desta
  semana veio dos próprios painéis guardados (`session`), não das sobras.
- Correção: registrar no log de depuração, uma vez por motivo, a gravação do store que falha, e dizer
  no `/task-tree`; apagar uma vez as chaves de prefixos que não existem mais (`asks:`, `view:`); podar,
  junto com `session:`, os registros `work:`, `turn:` e `links:` das sessões que já saíram da lista
  (sem o painel, eles não desenham nada); podar antes de gravar e tentar de novo quando a gravação
  falhar. Cenário novo em `regras/durabilidade.md` (store cheio não perde o painel em silêncio).
- Arquivos: `task-tree/state/durability.ts`, `task-tree/hooks/panel.ts`, `task-tree/hooks/command.ts`,
  `regras/durabilidade.md`, `task-tree/tests/durabilidade.test.ts`.
- Tamanho: médio.
- Limite: essa correção devolve cerca de 110 KB hoje. O alívio de verdade depende das decisões sobre o
  que pode ser podado do painel guardado: só os grupos de subagente terminados ocupam 204 KB.

## /clear e retomada não mexem nas ligações das filhas: cartões antigos caem sob tarefas novas que reusam o id

**Classe: decisão do usuário.**

- Prova: `task-tree/hooks/session-start.ts:72-78` (o `/clear` esvazia grupos, esperas, cartas, trabalho
  e fim do turno; as filhas com as âncoras, os lançamentos, a lista de sessões terminadas, a cópia das
  ligações e as dobras ficam). O contrato do kit diz que depois do `/clear` o processo segue com outro
  id de sessão e sem `session.start`.
- Falta medir no app, antes de implementar: se a lista de sessões continua trazendo as filhas depois
  do `/clear` na mãe (é provável, a lista é pelo id `local_…`, que não muda; o código não mostra). A
  parte da retomada com filhas está no achado seguinte.
- Pergunta: **Depois de um /clear numa sessão que abriu sessões filhas, o que acontece com o cartão de
  uma filha aberta antes do /clear?**
  1. Fica solto no fim do painel enquanto a filha trabalha, sem ligação com as tarefas novas; parada,
     vai para o histórico (Recomendado). O cartão nunca aparece sob uma tarefa nova que reuse o id "1",
     não soma no x/y dela e não a deixa em andamento.
  2. Some na hora, com o resto do painel. A filha segue trabalhando sem cartão na mãe.
  3. Como hoje: a ligação antiga fica, e se o plano novo reusar o id o cartão antigo aparece sob a
     tarefa nova, com o ícone de sessão e somando no x/y dela.

## Retomada (resume) num processo vivo troca só grupos, work e turno, e só se o store tiver cópia; o resto fica da sessão anterior

**Classe: correção direta** (a parte das cartas e ligações não se confirma pela leitura).

- Prova: `task-tree/hooks/session-start.ts:79-83`; `task-tree/hooks/panel.ts:396-399` (`restore` não
  faz nada sem cópia), `726-732` e `95-106` (idem para o trabalho e o fim do turno); nada toca esperas,
  resumo (`brief`) nem recap.
- Comportamento errado: ao retomar, no mesmo processo, uma sessão que não tem painel guardado (nunca
  usou o mod, ou saiu das 30), o painel da sessão anterior continua desenhado e a escrita seguinte o
  grava sob o id da sessão retomada. Com painel guardado, um "Aguardando sua escolha" da sessão
  anterior segue no painel da retomada.
- Correção: na retomada sem cópia no store, esvaziar o painel, como o `/clear` faz; em toda retomada,
  zerar esperas, resumo e recap. Cenário próprio em `regras/durabilidade.md` (estende "o reinício e a
  retomada restauram o painel do store").
- Arquivos: `task-tree/hooks/session-start.ts`, `task-tree/hooks/panel.ts`, `regras/durabilidade.md`,
  `task-tree/tests/durabilidade.test.ts`.
- Tamanho: pequeno.
- Não confirmado: cartas e cartões da sessão anterior sob a tarefa "1" da sessão retomada. Só existem
  no app desktop, e faltou saber se o app retoma outra sessão dentro do mesmo processo (cada sessão
  costuma ter o seu). Se retomar, a correção soma "trazer as ligações da sessão retomada, substituindo".

## Processo novo com o turno gravado como "em curso" (app fechado ou morto no meio do turno) desenha ◉ e roda o relógio sem turno nenhum

**Classe: decisão do usuário.**

- Prova: `task-tree/hooks/panel.ts:32-38` (no primeiro turno nada vai ao store; nos seguintes vai
  `ended: null`), `95-106` (`restoreTurn` devolve o que achou, ou nada); `session-start.ts:56-61`.
  Nada grava o fim do turno quando o processo morre: `turn.complete` não roda.
- O cenário "o fim do turno sobrevive ao reinício" só cobre o turno que terminou antes do reinício.
  A decisão de 2026-10-27 ("◉ só no caminho da última iniciada no turno atual") aponta para ◷.
- Pergunta: **Se o app fechar, ou o processo morrer, no meio de um turno, como deve aparecer, ao
  reabrir, a tarefa que estava em andamento?**
  1. ◷ aguardando, com o relógio parado, até o próximo pedido (Recomendado). É o que o fim normal do
     turno já faz.
  2. ✕ interrompida, fora da contagem, até um novo start nela, como depois do Esc.
  3. ◉ em andamento, com o relógio correndo e o painel redesenhado a cada segundo, como hoje.

## O painel do store é lido sem validação nem versão, e uma falha de leitura do store termina em gravação por cima

## Leitura do store que falha é tratada como "nada salvo": o painel e as ligações podem ser sobrescritos pelo estado vazio

**Classe dos dois: não confirmado** (mesma causa, ficam juntos).

- O caminho existe: `task-tree/hooks/panel.ts:390-393` (o painel do store entra por conversão de tipo,
  sem conferência), `410-430` (`ensureGroups` responde "nada" tanto para "não existe" quanto para "não
  deu para ler", e a escrita seguinte grava do vazio), `96`, `712`, `727` e `734` (quatro restaurações
  marcam "já trazido" antes de ler); `session-start.ts:56-57` (`adopt` e `restore` fora de proteção).
- O que faltou: o gatilho. Não há prova de que a leitura do store do app rejeite de vez em quando
  (arquivo único de 962 KB, regravado por todas as sessões da máquina) nem valor guardado em outra
  forma: os 30 painéis de hoje estão na forma atual. A leitura do código não mostra nenhum dos dois.
- Como fechar: o registro de falhas do lote do store (achado do teto de 4 MiB) passa a dizer também a
  leitura que falhou; com isso o caso aparece no log se existir.
- Se a orquestradora quiser a defesa mesmo sem o gatilho: separar "não existe" de "não deu para ler",
  marcar "já trazido" só depois da leitura, não gravar a chave enquanto a leitura dela não respondeu e
  conferir a forma do painel lido (descartar o que não é grupo com lista de tarefas). Não contraria
  nenhuma decisão. Arquivos: `task-tree/hooks/panel.ts`, `task-tree/state/durability.ts`,
  `task-tree/io/publish.ts`, `task-tree/hooks/session-start.ts`. Tamanho: médio. Versão com migração
  do formato é pergunta de um achado baixo e fica fora.

## /clear publica o painel antes de zerar waits e sends: o arquivo publicado fica dizendo "aguardando" e com as cartas antigas

**Classe: correção direta.**

- Prova: `task-tree/hooks/session-start.ts:72-78`: o `replace` da linha 73 grava e publica
  (`panel.ts:383-386`, `355-361`, `506-530`), e só depois as linhas 74 a 77 zeram esperas, cartas,
  trabalho e fim do turno, sem publicar de novo. `io/publish.ts:133` grava "aguardando" pelo número de
  esperas; `io/host.ts:140` e `154` mantêm a filha "aguardando" na mãe.
- Comportamento errado: a filha termina o turno com uma pergunta do wrap_up e recebe `/clear`. O painel
  dela fica vazio, mas na mãe o cartão segue âmbar "aguardando", a tarefa de origem segue em andamento
  e o relógio de 1 s não para, até a filha receber outro prompt. Se o mod recarregar antes, as cartas
  apagadas reaparecem na própria filha.
- Correção: zerar esperas, cartas, trabalho e fim do turno antes do `replace`, para a única publicação
  do ramo já sair limpa. Teste: wrap_up com pergunta, `/clear`, e o arquivo publicado da própria sessão
  sem espera e sem cartas.
- Arquivos: `task-tree/hooks/session-start.ts`, `regras/durabilidade.md` (estende "o /clear esvazia o
  painel"), `task-tree/tests/durabilidade.test.ts`.
- Tamanho: pequeno.

## Os grupos de subagente nunca saem do estado: crescem sem limite e são regravados a cada mudança

**Classe: decisão do usuário.** A proposta original deixou de ser neutra depois do PR 36.

- Prova: nenhum ponto tira grupos do estado além do `/clear` e da retomada
  (`task-tree/hooks/agents.ts:81-95` só acrescenta); cada mudança regrava todos no estado, no store e
  no arquivo publicado (`panel.ts:374-381`, `355-361`).
- Medida de hoje no store (só contagens): uma sessão guarda 524 grupos de subagente, 148 KB dos 166 KB
  do painel dela (na auditoria o maior caso tinha 59); somados, os grupos de subagente são 694 e ocupam
  204 KB dos 478 KB de painéis guardados. Os painéis guardados cresceram 196 KB desde a auditoria; não
  medi quanto disso veio dos subagentes.
- O que mudou: a auditoria dizia que o cartão de subagente sob tarefa fechada já não era desenhado, e
  que apagar não mudaria o desenho. O PR 36 (commit `e4f1dfa`, cenário
  `subagentes.cartao-fica-com-a-origem-fechada`) passou a manter o cartão sob a tarefa ✓, e ele sai
  junto com o pedido para "+N pedidos anteriores". Apagar agora tira o cartão do histórico. Contraria
  também `subagentes.terminado-segue-cartao` ("Fecha ao terminar" não foi escolhido, 2026-11-09).
- Pergunta: **Os cartões de subagentes já terminados ficam guardados para sempre no estado da sessão, e
  todos são regravados a cada mudança do painel (uma sessão desta máquina já guarda 524 deles, 148 KB).
  Eles podem ser apagados quando o pedido deles sai do trabalho atual?**
  1. Apagar os que terminaram sem planejar tarefas no painel e manter os que têm tarefas próprias
     (Recomendado). No trabalho atual nada muda; ao abrir "+N pedidos anteriores", esses cartões não
     aparecem mais sob as tarefas antigas, e um start que reabra uma tarefa antiga não os traz de volta.
  2. Não apagar nada, como hoje. O histórico fica completo, e o estado, o store e o arquivo publicado
     seguem crescendo com cada workflow.

## Arquivos publicados nunca são apagados, crescem sem teto e são relidos por inteiro a cada 3 s

**Classe: decisão do usuário**, com uma parte direta que não muda nada visível.

- Prova: `task-tree/io/host.ts:78-99` (`readFiles` relê e interpreta o arquivo de toda filha listada,
  arquivadas inclusive, a cada releitura); `task-tree/hooks/sessions.ts:76-85`;
  `task-tree/io/publish.ts:131-149` (o corpo inteiro, com os painéis das filhas e a cópia `tasks`, é
  serializado a cada publicação). O kit não apaga arquivo (`$.fs` tem ler, escrever, listar, existir e
  medir); `$.fs.list` devolve tamanho e data de cada arquivo.
- Parte direta, opcional (custo, não painel errado): uma listagem da pasta por releitura e leitura só
  dos arquivos cuja data ou tamanho mudou; não reler a filha arquivada depois da primeira leitura.
  Arquivos: `task-tree/hooks/sessions.ts`, `task-tree/io/host.ts`, `task-tree/io/publish.ts`.
  Tamanho: médio.
- Pergunta: **Os arquivos que cada sessão publica para a sessão que a abriu nunca são apagados (129
  arquivos, 3,9 MB hoje) e levam dentro uma cópia antiga das tarefas e o histórico inteiro das sessões
  filhas. O que pode sair?**
  1. Tirar a cópia antiga das tarefas, publicar as filhas cortadas ao trabalho atual e esvaziar o
     arquivo das sessões que o app não lista mais (Recomendado). Na sessão avó, o cartão de uma neta
     deixa de ter "+N pedidos anteriores"; o cartão de uma filha em versão do mod anterior aos grupos
     deixa de mostrar tarefas. Toca a decisão de 2026-11-04 ("Ficam em '+N pedidos anteriores'").
  2. Só esvaziar o arquivo das sessões que o app não lista mais. O painel não muda.
  3. Nada sai, como hoje.

## A primeira gravação das ligações depois de uma recarga funde o store por cima do state que sobreviveu: cartas duplicadas ou ressuscitadas e cartões fantasmas

**Classe: correção direta.**

- Prova: `task-tree/hooks/panel.ts:690-691` (a primeira gravação depois da recarga chama
  `restoreLinks`), `711-723`; `task-tree/state/durability.ts:139-144` (a união compara pelo texto
  inteiro de cada entrada); `task-tree/hooks/sessions.ts:202` (o lembrete de recebimento marca a carta
  só no state, sem publicar em seguida: `prompt-submit.ts:84-94`, `tool-call.ts:166-171`);
  `panel.ts:646-652` (o comentário diz que a recarga esvazia o state, e ela o mantém).
- Comportamento errado: com um arquivo do mod salvo entre uma mudança só no state e a publicação
  seguinte, a tarefa passa a ter duas linhas "Para X: …" e o lembrete "recebimento confirmado" sai
  outra vez; a carta de uma tarefa cujo id um plano reusou volta sob a tarefa nova; uma carta que o
  plano descartou volta. É uso real nesta máquina, onde o clone recarrega em todas as sessões a cada
  arquivo salvo.
- Correção: com o state mantido, o state é a verdade. As ligações voltam do store no primeiro uso,
  antes de qualquer escrita delas (começo do `tool.call` e do `prompt.submit`, e nos mesmos pontos em
  que os grupos voltam), e só para as chaves que o state não tem; a cópia do módulo é sempre refeita.
  Corrigir o comentário. Teste: recarga com o store e o state divergentes.
- Arquivos: `task-tree/hooks/panel.ts`, `task-tree/hooks/tool-call.ts`,
  `task-tree/hooks/prompt-submit.ts`, `task-tree/state/durability.ts` (a linha "quando volta" das
  quatro chaves), `regras/durabilidade.md`, `task-tree/tests/durabilidade.test.ts`.
- Tamanho: médio.
- Vale também se a recarga rodar `session.start` (achado seguinte): ele chama a mesma fusão.

## A premissa "a recarga não roda session.start" contradiz o contrato do kit da versão em uso

**Classe: não confirmado.**

- O contrato continua dizendo o contrário do repositório: os tipos gerados da 2.1.321 dizem que o
  `session.start` roda de novo, só para os hooks do plugin, numa ativação, num respawn do worker ou
  numa recarga; `task-tree/state/durability.ts:8-11`, o `DESENVOLVIMENTO.md` e o cenário
  `durabilidade.recarga-mantem-painel-ligacoes-e-resumo` dizem que não roda, "como medido" em outubro.
- O que faltou: a medição no app. Uma linha de depuração no começo do `sessionStart` dizendo se o
  state já tinha grupos, salvar um arquivo do mod e ler o log. Exige mudança de código e uma ação no
  app, por isso não cabe nesta triagem.
- Conforme o resultado: se roda, falta o teste "recarga com session.start e state mantido", corrigir
  os três textos e pular o `$.ui.open` do `session.start` quando o state já tem grupos
  (`session-start.ts:64`). A correção da fusão das ligações (achado anterior) já cobre os dois casos.
- Pergunta ligada, que pode ser feita agora porque o `plan` já reabre o painel a cada plano
  (`task-tree/hooks/tools.ts:119`): **Quando você fecha o painel de tarefas, ele deve reabrir sozinho?**
  1. Só na sua próxima mensagem e em processo novo (Recomendado). Fechar vale até você escrever de
     novo; plan e recarga do mod não reabrem.
  2. Como hoje: reabre também a cada plan do modelo e, se a recarga rodar `session.start`, a cada
     arquivo do mod salvo em qualquer sessão.

## Tabela de durabilidade do documento diverge da TABLE: turnEnded aparece só no state, e faltam turnAborted, ultracode, rate, git e o store turn

**Classe: decisão do usuário** (documentação). Mesma causa do achado "Tabela de durabilidade e
documentação desatualizadas, e o teste que a tabela diz ter não existe", da área de documentação: a
pergunta é uma só e está lá.

- Prova: `task-tree/DESENVOLVIMENTO.md:237` (linha `view`, que não existe mais), `250` (`turnEnded`
  só no state, sem volta), `225` e `270-273` (`ensureView`, `restoreView`); a `TABLE` de
  `task-tree/state/durability.ts:48-105` diz state e store `turn`, com volta em start, resume e
  primeiro uso, e tem `turnAborted`, `replanDue`, `ultracode`, `rate` e `git`. O commit de documentação
  do PR 37 (`22ad5de`) não tocou essa seção.

## O store guarda o painel só das 30 sessões que gravaram por último: sessão antiga retomada volta vazia e apaga o histórico do cartão na mãe

**Classe: decisão do usuário.**

- Prova: `task-tree/state/durability.ts:125` e `173-180` (a lista é do plugin, de todas as sessões da
  máquina; só as 30 que gravaram por último ficam). Hoje o store tem 145 registros de trabalho e 143 de
  ligações para 30 painéis: mais de 110 sessões já não têm o painel guardado.
- Pergunta: **O painel de cada sessão é guardado para sobreviver a reinícios, mas só o das 30 sessões
  que gravaram por último nesta máquina. Uma sessão parada há alguns dias, ao receber mensagem depois de
  um reinício do app, volta com o painel vazio, e o cartão dela na sessão mãe perde as rodadas e os ✓
  anteriores. Por quanto tempo o painel de uma sessão parada deve ser guardado?**
  1. Enquanto a sessão existir no app (Recomendado). O painel volta inteiro sempre que ela for
     retomada, e o cartão na mãe mantém o histórico.
  2. Um prazo fixo, por exemplo 30 dias desde a última gravação. Dentro do prazo volta inteiro; depois,
     vazio, como hoje.
  3. As 30 últimas, como hoje.
- Nota para quem implementar: qualquer aumento soma ao teto de 4 MiB do store (hoje em 23%); decidir
  junto com a poda dos subagentes terminados. A saída mais barata é restaurar do arquivo publicado da
  própria sessão quando o store não tem o painel.

---

# Regras de uso do painel e lembretes ao modelo

## Os lembretes medem "tarefa aberta" no grupo inteiro e "usou o painel" por qualquer chamada: pedido novo sem plano não é lembrado quando sobra tarefa antiga ou depois de um done

**Classe: correção direta.**

- Prova: `task-tree/hooks/tool-call.ts:187-200` (o lembrete cala com qualquer tarefa aberta do grupo ou
  com a marca de uso); `task-tree/hooks/tools.ts:36` (a marca liga antes de o plan ser aceito, mesmo no
  plan recusado por ids repetidos), `133` (liga em qualquer done) e `177` (a cobrança do summary olha o
  grupo inteiro). O teste só cobre o painel vazio (`task-tree/tests/lembretes.test.ts:121-137`).
- Comportamento errado: o pedido um deixa um passo ○. No pedido dois o modelo fecha esse passo com
  done, ou nem isso, e trabalha sem plan: nenhum lembrete "sem plano aberto" sai no pedido inteiro, e o
  trabalho não aparece no painel. O cenário `lembretes.primeira-chamada-sem-plano` ("dado um pedido sem
  plan") não se cumpre nesse caso.
- Correção: medir pelo pedido atual. A marca de uso liga só com plan aceito, com start, ou com done em
  tarefa do pedido atual; uma tarefa só pendente de pedido anterior não cala o lembrete (uma em
  andamento cala: retomar plano antigo sem plan novo é fluxo previsto); a cobrança do summary olha "nada
  aberto no pedido atual". Reescrever o cenário com a condição exata e cobrir os dois casos.
- Arquivos: `task-tree/hooks/tool-call.ts`, `task-tree/hooks/tools.ts`, `regras/lembretes.md`,
  `regras/arvore.md`, `task-tree/tests/lembretes.test.ts`.
- Tamanho: médio.
- Fica de fora, como pergunta: a recusa da pergunta por "tarefa do pedido atual" (ver o achado da
  recusa da pergunta).

## Textos que o modelo lê prometem tooltip com a resposta inteira e "a primeira frase da resposta" sem summary; o painel não faz nenhum dos dois

**Classe: correção direta** (uma pergunta pequena sobra).

- Prova: `task-tree/text/rules.ts:35-37` ("com a resposta inteira no tooltip. Sem ele, o painel usa a
  primeira frase da resposta") e `91-93`; `task-tree/hooks/turn.ts:121-141` (sem summary não há linha
  ↩); `regras/visual.md`, `visual.tooltip` (tooltip removido por decisão de 2026-11-09). O campo da
  linha que guardaria a resposta inteira é gravado em `task-tree/draw/layout.ts:1195`, `1205` e `1264`
  e ninguém o lê, também depois do desenho nativo (`draw/desktop.tsx` só usa o texto alternativo).
- Comportamento errado: o modelo acredita que sem summary o painel resume sozinho e encerra o turno
  sem ele; o pedido fica sem linha ↩.
- Correção: nas regras e na descrição do `summary`, dizer "é a linha ↩ do painel; sem ele, o pedido
  fica sem linha ↩" e tirar o tooltip. Corrigir os comentários de `rules.ts:6-10`, `turn.ts:27-29` e
  `128-129`, `tools.ts:176` e `layout.ts:881` e `949`. Cenário em `regras/lembretes.md` para o texto.
- Arquivos: `task-tree/text/rules.ts`, `task-tree/hooks/turn.ts`, `task-tree/hooks/tools.ts`,
  `task-tree/draw/layout.ts` (comentários), `regras/lembretes.md`, `task-tree/tests/lembretes.test.ts`.
- Tamanho: pequeno.
- Pergunta que sobra: **A resposta inteira de cada turno (até 600 caracteres) é guardada e publicada,
  mas não aparece em lugar nenhum desde que o tooltip saiu. O que fazer com ela?**
  1. Basta o resumo ↩: tirar a resposta inteira do que o painel monta (Recomendado). Nada muda na tela.
  2. Pôr a resposta inteira no texto alternativo da linha ↩. Não aparece na tela; só leitor de tela lê.
  3. Deixar como está, guardada e sem uso.

## A recusa da pergunta confere só "tarefa aberta", não "em andamento"; com tarefa só pendente a espera fica solta no fim, e ExitPlanMode e wrap_up com ask não têm a mesma exigência

**Classe: decisão do usuário.**

- Prova: `task-tree/hooks/tool-call.ts:53-59` (recusa só sem nenhuma tarefa aberta, de qualquer
  pedido) e `92-96` (a espera só ganha tarefa quando há uma em andamento); `task-tree/text/rules.ts:174-177`
  (o texto da recusa fala em "tarefa em andamento"); `regras/perguntas.md`, `perguntas.sem-tarefa-recusada`
  ("dado nenhuma tarefa aberta"). O código segue o catálogo; o texto ao modelo pede mais do que o
  código exige.
- Parte direta, pequena, que vai com o lote de textos: o comentário de `tool-call.ts:53-54` diz que o
  modo plano "pode segurar as ferramentas do painel", contra o documento (o ExitPlanMode livre é o
  desenho original).
- Pergunta 1: **Quando o modelo faz uma pergunta (AskUserQuestion) tendo tarefa aberta mas nenhuma em
  andamento, hoje a pergunta passa e o aviso "Aguardando sua resposta" fica solto no fim do painel. O
  que deve acontecer?**
  1. Aceitar e pendurar o aviso sob a tarefa pendente do pedido atual, como já se faz com a carta
     (Recomendado). O aviso aparece sob a tarefa ○. ExitPlanMode e wrap_up com pergunta seguem livres,
     com o aviso sob a última tarefa do pedido.
  2. Recusar e pedir start antes de perguntar. O aviso fica sempre sob uma tarefa ◉; o modelo gasta uma
     chamada a mais. Reescreve o cenário coberto "a pergunta sem tarefa aberta é recusada".
  3. Como hoje: passa, e o aviso fica solto no fim.
- Pergunta 2: **Um passo ○ esquecido de um pedido anterior basta para liberar a pergunta de um pedido
  novo que não tem tarefa nenhuma?**
  1. Não: a pergunta precisa de tarefa aberta do pedido atual, ou de uma em andamento (Recomendado). No
     pedido novo sem plano, a pergunta é recusada e o modelo planeja antes.
  2. Sim, como hoje: qualquer tarefa aberta do painel libera, e o aviso fica solto no fim.

## Refazer um pai concluído: três textos diferentes, a recusa do start não diz "ids novos" e chama de "concluída" uma tarefa interrompida

**Classe: correção direta.**

- Prova: `task-tree/text/rules.ts:47-48` ("replaneje o nível 1 com ids novos"), `97-98` ("replaneje o
  nível 1 com plan") e `task-tree/hooks/tools.ts:216-217` (a recusa diz "já foi concluída e tem
  subtarefas: replaneje o nível 1 com plan" também para a tarefa interrompida).
- Comportamento errado: o modelo recebe a recusa, replaneja com os mesmos ids num nível 1 ainda aberto,
  e nada muda: o pai segue ✓. O caminho que funciona sem replano (start nas subtarefas, que reabre os
  pais) não aparece na recusa.
- Correção: um texto só nos três lugares ("para refazer um pai concluído, chame start nas subtarefas a
  refazer, ou replaneje com ids novos") e, na recusa, o estado real ("foi interrompida" ou "foi
  concluída"), mantendo o trecho que o teste confere.
- Arquivos: `task-tree/text/rules.ts`, `task-tree/hooks/tools.ts`, `regras/arvore.md`
  (`arvore.start-recusa-pai-concluido`: o "Então" ganha o caminho do start; a origem é "regra do painel
  desde a entrada do mod", não decisão datada), `task-tree/tests/arvore.test.ts` (só acréscimo).
- Tamanho: pequeno.

## O modelo não é avisado quando o painel fecha ou marca ✕ a tarefa pelos subagentes, e as regras do prompt ainda descrevem o comportamento antigo

**Classe: correção direta** (uma parte já resolvida).

- Resolvido pelo PR 36 (commit `def10c8`, cenário `subagentes.reaberta-nao-fecha-pelo-subagente-antigo`):
  a tarefa reaberta com start não volta a ✕ "falhou" pelos subagentes antigos
  (`task-tree/hooks/agents.ts:262-264`, `task-tree/state/tasks.ts:128-129`).
- De pé: `task-tree/text/rules.ts:59-60` ainda diz "subagentes que usam o painel ganham um grupo
  próprio" (o cartão existe desde o lançamento, e a tarefa fecha sozinha quando todos concluem);
  `agents.ts:265-306` fecha ou marca ✕ sem deixar nota; `tools.ts:155` responde só "foi interrompida"
  ao done numa tarefa ✕.
- Comportamento errado: um subagente em segundo plano falha depois do turno e a tarefa fica ✕ "falhou".
  No prompt seguinte nada diz isso ao modelo, e o done dele recebe "foi interrompida", sem o caminho
  para refazer. Quando a tarefa fecha sozinha, ele também não é avisado, e para a carta entregue é.
- Correção: atualizar a regra dos subagentes; uma nota única, como a da carta, quando o fim dos
  subagentes fecha ou interrompe uma tarefa; no done em tarefa ✕, dizer que o start a reabre. Não muda
  o fechamento automático, que é decisão de 2026-11-09.
- Arquivos: `task-tree/text/rules.ts`, `task-tree/hooks/agents.ts`, `task-tree/hooks/tools.ts`,
  `task-tree/hooks/prompt-submit.ts` e `task-tree/hooks/tool-call.ts` (onde a nota sai),
  `regras/subagentes.md`, `task-tree/tests/subagentes.test.ts`.
- Tamanho: médio.

## O resultado do plan não diz o que foi interrompido, renomeado ou zerado

**Classe: correção direta** (uma parte já resolvida).

- Resolvido pelo PR 36 (cenário `lembretes.estado-guardado-so-no-mesmo-pedido`): as regras e os
  lembretes de depois do Esc já dizem que o estado só é guardado no replano da mesma mensagem
  (`task-tree/text/rules.ts:38-48`, `144-168`).
- De pé: `task-tree/hooks/tools.ts:122-124`. A resposta do plan é sempre a mesma frase, mesmo quando
  ele deixa um nível 1 aberto de pedido anterior como histórico interrompido (`tools.ts:60-66`, `80`)
  ou põe um plano novo ao lado de um concluído.
- Comportamento errado: o modelo segue achando que a tarefa antiga está em andamento ou concluída; o
  usuário vê o painel regredir sem que o modelo corrija.
- Correção: avisos na resposta do plan, no padrão "Avisos:" do done: o nível 1 de pedido anterior que
  ficou como histórico, com quantas abertas foram interrompidas; o nível 1 concluído que ficou como
  histórico; quantas tarefas mantiveram o estado num replano. O comportamento do plan não muda (regra
  confirmada em 2026-10-27).
- Arquivos: `task-tree/hooks/tools.ts`, `task-tree/text/rules.ts`, `regras/pedidos.md`,
  `task-tree/tests/pedidos.test.ts`.
- Tamanho: pequeno a médio.

## Os lembretes da mesma mensagem dão ordens opostas (done primeiro x "a PRIMEIRA chamada é plan"); com ids reutilizados, o plan primeiro deixa a tarefa antiga ✕ e o done seguinte fecha a tarefa nova

**Classe: decisão do usuário** (muda a frase de uma regra de uso que existe desde a entrada do mod).

- Prova: `task-tree/text/rules.ts:109-119` ("A PRIMEIRA chamada de ferramenta é mcp__task-tree__plan")
  e `120-124` ("Feche com done… antes de seguir ou de planejar o pedido novo"), que saem juntos em
  `task-tree/hooks/prompt-submit.ts:153-161`; `task-tree/state/tasks.ts:32-46` (o done pelo id curto
  prefere a tarefa aberta, que depois do plan é a nova).
- O aviso no resultado do plan (achado anterior) já reduz o dano sem mudar a regra.
- Pergunta: **Quando chega uma mensagem nova com tarefas ainda abertas, o modelo recebe duas ordens:
  "feche com done o que esta mensagem conclui antes de planejar" e "a PRIMEIRA chamada é plan". Se ele
  planeja primeiro reusando o id "1", a tarefa antiga, já respondida, vira ✕ no pedido anterior, e o
  done seguinte fecha a tarefa nova. Qual ordem vale?**
  1. Primeiro done no que a mensagem conclui, depois plan (Recomendado). É o que três dos quatro textos
     já dizem; mudam o lembrete de pedido novo e a primeira regra do painel. A tarefa da pergunta
     respondida fica ✓ no pedido dela, e o plano novo entra intacto.
  2. Os textos ficam como estão. O resultado depende de qual dos dois o modelo segue.

## "A mãe é avisada de que ela parou com N pendentes" só acontece se a origem já estava fechada quando a filha parou

**Classe: correção direta.** O cenário já diz o comportamento certo, sem condição de ordem.

- Prova: `task-tree/hooks/sessions.ts:247-269`: a lista das sessões que terminaram é zerada na primeira
  leitura (linha 250), e "parou com N pendentes" só entra para o cartão que já está encerrado naquele
  instante (linhas 262-266); `task-tree/text/rules.ts:233-236` (o lembrete de turno terminado não diz
  quantas pendentes ficaram); `task-tree/hooks/tools.ts:143-185` (o done na origem não olha os cartões).
  O teste só cobre a ordem inversa (`task-tree/tests/sessoes.test.ts:629-641`). Decisão: `regras/sessoes.md`,
  `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`, 2026-11-04 ("Origem fechada (Recomendado)").
- Comportamento errado: na ordem mais comum, a filha para com 2 pendentes e a origem ainda aberta. A
  mãe recebe "terminou o turno… marque com done", o modelo fecha a origem, o cartão vira "encerrada" e
  as 2 pendentes saem do cabeçalho, do chip e do x/y sem aviso nenhum. O próprio lembrete induz o
  fechamento que esconde as pendentes.
- Correção: o lembrete de turno terminado passa a dizer quantas pendentes a filha deixou, e o done que
  fecha a origem de uma filha parada com pendentes acrescenta ao resultado o aviso de que elas saíram
  da contagem. Teste para a ordem "filha para primeiro, origem fecha depois".
- Arquivos: `task-tree/hooks/sessions.ts`, `task-tree/hooks/tools.ts`, `task-tree/text/rules.ts`,
  `task-tree/tests/sessoes.test.ts`.
- Tamanho: pequeno a médio.

## O aviso "falta o summary" dispara no meio do turno, quando o done fecha a última aberta antes do plan seguinte, na ordem que os próprios lembretes mandam

**Classe: correção direta.**

- Prova: `task-tree/hooks/tools.ts:177-178` (a condição é só "fechou algo, nada aberto, sem summary");
  `task-tree/text/rules.ts:182-185` e `56-58` mandam done e depois plan depois da resposta a uma
  pergunta; `tools.ts:138` (o summary dado ali cala o aviso do done final).
- Comportamento errado: plano de uma tarefa só, "Perguntar o rumo". Respondida a pergunta, o modelo
  fecha a tarefa, recebe "falta o summary" e obedece com "Usuário escolheu a opção B". Depois planeja e
  executa o trabalho, esquece o summary no último done e não é avisado. A linha ↩ do pedido fica
  "Usuário escolheu a opção B".
- Correção: o aviso passa a dizer que só vale se este foi o último passo do turno (se ainda vai
  planejar, ignore), e um done sem summary depois de um plan do mesmo turno volta a cobrar, mesmo com
  um resumo dado antes desse plan. A cobrança não sai: fora do app desktop ela é a única.
- Arquivos: `task-tree/text/rules.ts`, `task-tree/hooks/tools.ts`, `regras/arvore.md`
  (`arvore.done-sem-summary-e-varias-sem-start`), `task-tree/tests/arvore.test.ts` (o trecho "falta o
  summary" fica).
- Tamanho: pequeno.
- Fora da correção: inverter a ordem done e plan nas regras muda regra de uso e é a pergunta do achado
  das ordens opostas.

---

# Catálogo de regras e testes

## A contagem de asserções ignora helpers do kit que afirmam (esperarPalavra, esperarCartaSob) e os helpers locais; testes selados contam zero

**Classe: correção direta.**

- Prova: `scripts/selos.mjs:22` (a lista fixa tem `expect`, `esperarEstado`, `esperarCarta`, `linha` e
  `antes`, que não existe no kit) e `61-68` (conta só pelo nome, dentro do corpo do teste). No kit,
  também afirmam `esperarPalavra`, `esperarCartaSob` e `linhaDoApp` (`task-tree/tests/kit/leitura.ts:341`,
  `355`, `208`). Em `regras/selos.json`, 12 dos 239 testes têm zero asserções: 3 de durabilidade, 3 de
  envios, os 4 de golden, 1 de sessões e 1 de visual.
- Comportamento errado: um teste que afirma só por esses helpers, ou por função do próprio arquivo,
  pode perder todas as afirmações com selo de refatoração, e o check passa. Contraria a trava "as
  asserções não podem diminuir" do `CLAUDE.md`.
- Correção: derivar a lista do kit (toda função exportada de `leitura.ts` que chama `expect` ou lança),
  contar também as afirmações das funções de topo do arquivo que o teste chama, e uma trava que falhe
  quando um helper que afirma ficar fora. Regravar a contagem numa passada que só mexa em `assercoes`.
- Arquivos: `scripts/selos.mjs`, `scripts/travas.test.mjs`, `regras/selos.json`.
- Tamanho: pequeno a médio.

## A maior parte dos textos ao modelo não tem cenário nem teste, e o cabeçalho de rules.ts cita um teste e um golden de textos que não existem

**Classe: decisão do usuário**, com uma parte direta pequena.

- Prova: `task-tree/text/rules.ts:6-7` cita `tests/textos.test.ts` e `tests/golden/textos.ts`, que não
  existem. O PR 36 cobriu parte: o catálogo de lembretes tem hoje dez cenários, e os testes passaram a
  ler "recebimento confirmado", "mensagem não entregue" e o prefixo "é a resposta do usuário"
  (`task-tree/tests/envios.test.ts:482`, `418-440`; `task-tree/tests/lembretes.test.ts:246`). Seguem sem
  nenhum trecho em teste (busquei cada texto em `task-tree/tests`): o hand-back, a notificação de
  tarefa em segundo plano e o aviso do app, a resposta por opção e a que virá pelo chat, o wrap_up sem
  resumo e com abertas, a carta na fila no done, o envio que ficou na fila e a sessão que terminou o
  turno com a origem aberta.
- Parte direta, com o lote de textos: corrigir o cabeçalho de `rules.ts`, que afirma uma conferência
  letra por letra que não existe.
- Pergunta: **Os textos que o mod manda ao modelo (lembretes, avisos do done e do wrap_up, avisos de
  carta e de sessão) quase não têm cenário nem teste: um deles pode deixar de sair, ou sair na hora
  errada, e o check passa. Como proteger?**
  1. Um cenário por texto, conferindo quando ele sai e os trechos essenciais (Recomendado). Mudar a
     redação segue livre; mudar quando o texto sai passa a exigir decisão registrada.
  2. Golden letra por letra, como o do desenho. Toda mudança de redação bloqueia o commit até a sua
     aprovação.
  3. Deixar como está.
  Em nenhuma das três o painel muda.

## O golden não contém o que os cenários visual.desenho-* dizem travar

**Classe: decisão do usuário** (uma parte já resolvida).

- Resolvido pelos PRs 36 e 37: o cenário principal do golden tem a tarefa ✕ ("Um.dois", interrompida)
  e o cartão da filha tem o anel de contexto (42%), além de toks/s, repositório e branch
  (`task-tree/tests/golden/desenho.ts`).
- De pé: nenhum dos quatro cenários tem o modelo no cartão da sessão filha (só nos de subagente), a
  carta interrompida (em "envios" a terceira carta segue na fila), o repositório no cabeçalho, a palavra
  "ultracode", a linha "+N pedidos anteriores" nem o cabeçalho largo. `regras/visual.md` continua
  dizendo que `visual.desenho-principal` cobre "todos os estados" e "o cabeçalho em cartão com
  repositório e branch", e que os checklists do modelo e da posição do toks/s "ficam travados por
  visual.desenho-*".
- Decisão registrada que a correção toca: `CLAUDE.md`, "Golden do desenho", 2026-10-28 ("Sim, validar
  antes do commit (Recomendado)"): desenho novo só entra com a validação dele no app.
- Pergunta: **O golden do desenho não contém tudo o que o catálogo diz que ele trava: faltam o modelo
  no cartão da sessão filha, a carta interrompida, o repositório no cabeçalho, "ultracode", a linha
  "+N pedidos anteriores" e o cabeçalho largo. Uma mudança nesses desenhos passa no check sem bloquear
  o commit. O que fazer?**
  1. Ampliar os roteiros do golden para cobrir o que falta; você valida os desenhos novos no app antes
     do commit (Recomendado). O painel não muda; passa a bloquear o commit quando esses desenhos mudarem.
  2. Só corrigir o texto dos cenários e dos checklists para o que o golden cobre hoje. Nada mais fica
     travado.

## O selo do teste não cobre o que ele usa por tabela: declarações de topo indiretas e arquivos importados fora do kit (fixtures)

**Classe: correção direta.**

- Prova: `scripts/selos.mjs:53` e `70` (o hash leva só as declarações de topo citadas direto no corpo;
  o que elas usam e os arquivos importados ficam fora) e `114-122` (só `*.test.ts` e `kit/` são selados:
  `task-tree/tests/fixtures/publicados.ts` não entra em selo nenhum); `scripts/regressao.mjs:53-58` (a
  regressão roda com a fixture do commit de comparação).
- Comportamento errado: tirar dois formatos da fixture dos arquivos publicados faz o teste dos "8
  formatos" conferir 6 com o mesmo hash; `selos`, `plugin test` e `regressao` passam, sem selo e sem
  decisão. O mesmo com uma declaração alcançada só por outra.
- Correção: fechar o conjunto de declarações por alcance transitivo e selar os arquivos de `tests/` que
  não são teste, kit nem golden; um modo de migração que regrave o hash mantendo tipo, data e motivo, só
  quando o texto do teste é igual ao de `HEAD`, num commit só de scripts e selos. No teste dos formatos,
  afirmar o número deles (acréscimo de asserção).
- Arquivos: `scripts/selos.mjs`, `scripts/travas.test.mjs`, `regras/selos.json`, `regras/README.md`,
  `task-tree/tests/durabilidade.test.ts`.
- Tamanho: médio a grande (muda o hash de quase todos os testes selados).

## Remover ou renomear um teste por decisão, junto com a mudança de código, não tem saída na regressão

**Classe: correção direta.** Mesma peça do achado "a etapa selos não compara o selos.json com o de
HEAD": os dois precisam do mesmo registro de remoção e devem ser desenhados juntos.

- Prova: `scripts/regressao.mjs:81-97` (a falha de um teste de `HEAD` só passa com selo de decisão na
  mesma chave) e `scripts/selos.mjs:169-171`, `240-248` (o `--remover` apaga o selo; não fica registro).
  Na CI com `--base` o teste removido roda sempre.
- Comportamento errado: o usuário decide tirar um comportamento; a sessão reescreve o cenário, apaga o
  teste, remove o selo e tira o código no mesmo commit, como o fluxo manda. O hook acusa "REGRESSÃO OU
  DECISÃO NÃO REGISTRADA" e bloqueia. O mesmo ao renomear um teste e mudar o comportamento. Sobra o
  `--no-verify`, que o `CLAUDE.md` proíbe.
- Correção: o `--remover` grava a remoção em `regras/selos.json` (chave, data, motivo e o `Reescrito:`
  usado), e a regressão libera a falha de um teste de `HEAD` que esteja ali, com a mesma exigência do
  selo de decisão; um `--renomear` leva o selo para a chave nova. Cobrir os dois nas travas. Enquanto
  não entra, escrever no `CLAUDE.md` o contorno em dois commits (primeiro o teste e o selo, depois o
  código).
- Arquivos: `scripts/selos.mjs`, `scripts/regressao.mjs`, `scripts/travas.test.mjs`, `regras/README.md`,
  `CLAUDE.md`.
- Tamanho: médio.

## Nenhum cenário nem teste cobre o que acontece com cartão e carta quando a tarefa de origem é replanejada

**Classe: decisão do usuário**, só para o caso que sobrou; o resto foi resolvido pelo PR 36.

- Resolvido: o replano no mesmo pedido que mantém a tarefa do cartão
  (`task-tree/tests/pedidos.test.ts:271-291`, o cartão segue sob "Um"); o pedido novo com o mesmo id e
  cartão ou carta sob a tarefa antiga (`task-tree/tests/sessoes.test.ts:644-760`, cenários
  `pedidos.id-reusado-segura-pedido-com-cartao-aberto` e `…-com-sessao-viva`); o nível 1 concluído com
  plan de mesmo id (`pedidos.test.ts:216-235`, `pedidos.id-reusado-nao-segura-pedido-concluido`); e o
  cartão de subagente (`subagentes.id-reusado-nao-herda-cartao`).
- De pé: o cartão cuja tarefa de origem sai do plano num replano do mesmo pedido. Não há regra escrita.
  Hoje ele fica solto no fim enquanto a sessão trabalha ou tem tarefa aberta, e depois vai para o
  histórico (`task-tree/draw/layout.ts:1349`, `1598-1615`). A carta nesse caso tem regra: fica pendurada
  no nível 1 do pedido até a entrega (`task-tree/hooks/tools.ts:110-113`).
- Pergunta: **Uma tarefa tem embaixo o cartão de uma sessão filha, e o modelo replaneja o mesmo pedido
  sem essa tarefa. Onde fica o cartão?**
  1. Sob o nível 1 do pedido, como já acontece com a carta de uma tarefa que sai do plano
     (Recomendado). O cartão segue dentro do pedido a que pertence, nunca solto.
  2. Solto no fim do painel enquanto a sessão trabalha ou tem tarefa aberta, e depois no histórico,
     como hoje. Só vira regra escrita, com teste.

## Tempo de tarefa, pedido e cabeçalho sem definição no catálogo; o código usa três bases e o número pula entre estados

**Classe: decisão do usuário.**

- Prova: `task-tree/draw/layout.ts:590-594` (a linha em andamento e a concluída contam do primeiro
  start), `576-583` (a linha e o pedido aguardando contam do start ou, sem ele, do plano, pendentes
  incluídas) e `613-621` (o cabeçalho, idem). Nenhum teste afirma o texto de um tempo, e os cenários só
  dizem "relógio parado".
- A pergunta geral de tempo da auditoria (quatro pontos ligados) pode vir de outra triagem; a deste
  achado é a base da contagem.
- Pergunta: **O tempo de um pai e de um pedido muda de base conforme o estado: durante o turno conta
  desde o primeiro start; no fim do turno, com passos pendentes, passa a contar desde o plano e sobe de
  uma vez (2 minutos, se houve uma pergunta de 2 minutos antes do primeiro start); com tudo fechado
  volta a contar do start. De onde ele deve contar?**
  1. Sempre do primeiro start, como a linha em andamento (Recomendado). O número não pula. Muda o tempo
     das linhas ◷ e pode mudar o golden do cenário principal, que você valida no app.
  2. Sempre do plano. O tempo inclui a espera antes do primeiro start; mudam as linhas em andamento e
     as concluídas.
  3. Como hoje.

## Os testes de pedidos e sessões não reproduzem o que o app publica: cenários "coberto" passam com dados que o uso real não gera

**Classe: resolvido.**

- Os quatro problemas que o achado cita ganharam cenário e teste no PR 36, com os dados que o app
  publica: o nível 1 repetido no pedido novo, com cartão de filha
  (`task-tree/tests/sessoes.test.ts:644-760`); a abertura da filha marcada como turno próprio
  (`sessoes.test.ts:761-790`, cenário `sessoes.turno-de-abertura-da-filha-sob-a-origem`, commit
  `fbe86b4`); a linha fantasma no cartão parado (`sessoes.test.ts:297`, cenário
  `sessoes.cartao-parado-sem-pedidos-anteriores-a-mais`, commit `ba8209a`); e o pedido concluído que não
  saía de vista (`task-tree/tests/pedidos.test.ts:216-268`, commit `90680aa`). O kit ganhou o roteiro
  da mensagem no meio do trabalho (`relatoNoMeio`, `digitadaNoMeio`, usados em `pedidos.test.ts:279-293`).
- Sobra, sem urgência: uma fixture feita de um recorte anônimo de um arquivo real de
  `task-tree-waits`. Se entrar, precisa de selo (achado do selo que não cobre fixtures).

---

# Documentação

## Tabela de durabilidade e documentação desatualizadas, e o teste que a tabela diz ter não existe

**Classe: correção direta** para o código; a parte do documento é a pergunta abaixo, a mesma do achado
"Tabela de durabilidade do documento diverge da TABLE".

- Prova: `task-tree/state/durability.ts:107-108` e `task-tree/hooks/panel.ts:19-22` dizem que
  `tests/durabilidade.test.ts` falha quando uma chave do state fica sem linha na tabela; nenhum teste
  usa a tabela, e `STATE_KEYS`, `STORES`, `LINK_KEYS` e `stateOf` só aparecem na própria
  `durability.ts`. `task-tree/io/publish.ts:100-102` diz que as cartas já tomadas são tiradas na
  publicação, e elas vão ao arquivo (`publish.ts:146`): precisam ir, a carta verde no cartão da
  remetente depende delas. `task-tree/io/host.ts:11` cita `tests/host.test.ts`, que não existe.
- Efeito: nenhum no painel de hoje. Quem acrescenta uma chave confia numa trava que não existe.
- Correção: os comentários passam a dizer a verdade ("conferido à mão", ou uma conferência das chaves
  num script do check, junto da etapa `regras`; teste do harness não cabe, ele não lê arquivos); tirar
  as linhas mortas e os quatro exports sem uso.
- Arquivos: `task-tree/state/durability.ts`, `task-tree/hooks/panel.ts`, `task-tree/io/publish.ts`,
  `task-tree/io/host.ts`; opcional, `scripts/regras.mjs`.
- Tamanho: pequeno.
- Pergunta (documento): **O `DESENVOLVIMENTO.md` descreve funções, comandos e tabelas que não existem
  mais: a tabela de durabilidade ainda traz a visão (`view`), diz que o fim do turno vive só no state e
  não cita cinco chaves novas; a seção do arquivo publicado não cita quatro campos. Atualizo agora?**
  1. Atualizar agora, num trabalho só, trocando a tabela por um ponteiro para `state/durability.ts`
     (Recomendado). O painel não muda; some o risco de alguém seguir o documento e tirar a gravação do
     fim do turno.
  2. Deixar para depois. Segue valendo a nota de 2026-10-23, "sem docs até você pedir".

## A memória do projeto, carregada em toda sessão, ainda diz "sem testes nem docs" e "sem claude plugin test", contra o CLAUDE.md atual

**Classe: decisão do usuário** (a memória guarda palavras dele; é uma confirmação de uma linha).

- Prova: as notas `bug-teste-antes-da-correcao.md` e `fluxo-commit-local-validacao-visual.md` da memória
  do projeto, de 2026-10-23, e a linha do índice ("Sem testes nem docs no task-tree: suíte removida em
  2026-10-23"), seguem como estavam. O `CLAUDE.md` do repositório manda teste e cenário no mesmo commit
  e o check completo no hook, com decisões de 2026-10-28.
- Não é mudança no repositório: quem escreve a memória é a sessão principal.
- Pergunta: **A memória do projeto ainda diz "sem testes nem docs" e "sem claude plugin test"
  (2026-10-23). O `CLAUDE.md` do repositório, com decisões suas de 2026-10-28, manda teste e cenário no
  mesmo commit e o check completo. Confirma que vale o `CLAUDE.md` e que as notas da memória devem ser
  reescritas?**
  1. Sim: reescrever as duas notas e a linha do índice, citando a decisão posterior e apontando para o
     `CLAUDE.md` (Recomendado). Toda sessão de correção passa a receber o pedido de teste e cenário. A
     parte "sem docs" segue a resposta da pergunta da documentação.
  2. Não: as notas ficam, e a sessão que seguir a memória entrega correção sem teste nem cenário.

## npm run testes:alterados e npm run impacto comparam com HEAD: depois do commit local, que o fluxo manda fazer antes do relato, os dois respondem "nenhum"

**Classe: correção direta.**

- Prova: `scripts/alterados.mjs:14-21` e `39`; `scripts/impacto.mjs:69-76`. Sem argumento, os dois
  comparam `HEAD` com a pasta de trabalho. `CLAUDE.md:106-108` e o modelo de relato de
  `regras/README.md:125-135` começam pelo hash do commit e não dizem quando rodar.
- Comportamento errado: a sessão muda um teste por decisão, sela, faz o commit local e monta o relato.
  Os dois comandos respondem "nenhum", e o relato diz ao usuário que nenhum teste existente mudou,
  justo a informação que ele usa para revisar selos.
- Correção: quando o índice e a pasta de trabalho não diferem de `HEAD`, os dois comparam o último
  commit e dizem isso na primeira linha; corrigir o rótulo "a base do PR", que aparece com qualquer
  `--base`; uma linha no modelo de relato. A CI não muda (ela passa `--base`).
- Arquivos: `scripts/alterados.mjs`, `scripts/impacto.mjs`, `scripts/travas.test.mjs` (se cobrir),
  `regras/README.md`, `CLAUDE.md`.
- Tamanho: pequeno.

---

# Scripts, travas e CI

## A etapa selos não compara o selos.json com o de HEAD: editar o arquivo à mão passa em todo o check

**Classe: correção direta.** Desenhar junto com a remoção e o renome de teste por decisão.

- Prova: `scripts/selos.mjs:174-204`: o `selos.json` de `HEAD` só entra na conta de asserções (linhas
  191-195), e essa conta usa o número gravado no próprio selo, não o contado no teste; a chave apagada
  do arquivo deixa de ser procurada (linha 184 só olha as chaves que restam); o tipo trocado à mão para
  decisão não é conferido contra o `Reescrito:`; o cenário de golden apagado junto com o selo não gera
  problema (linhas 196-202).
- Comportamento errado: apagar um teste selado e a entrada dele, trocar à mão o hash e o tipo de um
  teste alterado, ou apagar um cenário do golden com o selo: nos três o check passa, e o comportamento
  deixa de estar protegido sem erro. Hoje só a leitura do diff de `selos.json` defende.
- Correção: na conferência, comparar com `HEAD`: chave ausente exige o registro de remoção; hash
  diferente com tipo "novo" é erro; com tipo "decisão", confere o `Reescrito:` contra a data do selo de
  `HEAD`; a queda de asserções compara com o número contado no teste; todo cenário do golden previsto
  no script e todo cenário de `HEAD` precisa existir no arquivo e no selo. Três casos novos nas travas.
- Arquivos: `scripts/selos.mjs`, `scripts/golden.mjs`, `scripts/travas.test.mjs`, `regras/README.md`.
- Tamanho: médio.

## Regra de versão do release: BREAKING CHANGE em qualquer ponto do corpo do PR sobe a major, e título fora do formato vira patch sem aviso

**Classe: decisão do usuário** (são duas regras documentadas no `CLAUDE.md` e no workflow).

- Prova: `.github/workflows/release.yml:43-49`: o `grep` do corpo não tem âncora; a minor só sai com
  `feat:` ou `feat(escopo):` em minúsculas; o resto é patch, sem aviso; o commit na `main`, a tag e a
  release vêm em seguida. Não há workflow ativo em PR aberto que confira o título
  (`.github/workflows/test.yml:6-9`, desligado por escolha do usuário em 2026-10-29).
- Risco de hoje: a descrição do PR é reescrita a cada push por regra global; um PR que cite a regra, ou
  diga "sem BREAKING CHANGE", leva o plugin de 0.15.x para 1.0.0.
- Pergunta 1: **No release, a expressão "BREAKING CHANGE" em qualquer ponto da descrição do PR sobe a
  versão major (de 0.15.x para 1.0.0), mesmo quando a descrição só cita a regra ou diz "sem BREAKING
  CHANGE". Restrinjo?**
  1. Só conta no rodapé, numa linha que começa com "BREAKING CHANGE:", o padrão do Conventional
     Commits (Recomendado). Citar a expressão no meio do texto deixa de subir a major.
  2. Como hoje: qualquer ocorrência sobe a major.
- Pergunta 2: **Um PR com título fora do formato Conventional Commits ("Feat: …", "feature: …", "feat
  add …") hoje vira patch sem aviso, mesmo quando deveria ser minor. O que fazer?**
  1. O release falha com erro claro, sem gravar versão nem criar tag; corrige-se o título do PR e
     reexecuta-se, e o workflow passa a ler o título na hora (Recomendado). Enquanto ninguém corrige, o
     PR fica na `main` sem versão nova.
  2. Continua virando patch, com um aviso visível no resumo do workflow.
  3. Como hoje: patch, em silêncio.
  Conferir o título antes do merge exigiria ligar a CI nos PRs, que está desligada por escolha sua.

---

# Correções diretas, em lotes

Cada item é um commit local, com o teste e o cenário no mesmo commit. Os lotes 1 a 3 mexem em
`task-tree/hooks/panel.ts` e os lotes 4 a 6 em `task-tree/text/rules.ts` e `task-tree/hooks/tools.ts`:
dentro de cada grupo, em sequência. Todo lote do mod sela testes em `regras/selos.json`, o mesmo
arquivo que os lotes de scripts regravam: scripts e mod não rodam em paralelo.

**Lote A. Relato e contagem dos selos (scripts, pequeno). Primeiro, porque melhora o relato e a trava de
todos os lotes seguintes.**
1. `testes:alterados` e `impacto` depois do commit local.
2. Contagem de asserções pelos helpers do kit e pelas funções do arquivo.

**Lote 1. /clear e retomada limpos (pequeno).**
3. O `/clear` zera esperas, cartas, trabalho e fim do turno antes de publicar.
4. A retomada sem cópia no store esvazia o painel; toda retomada zera esperas, resumo e recap.

**Lote 2. Ligações na recarga (médio).**
5. Com o state mantido, a volta das ligações do store não duplica nem ressuscita cartas e cartões.

**Lote 3. Store (médio).**
6. Falha de gravação do store registrada e dita no `/task-tree`; prefixos órfãos apagados; registros
   das sessões fora da lista podados; poda antes de gravar e nova tentativa. O mesmo registro passa a
   dizer a leitura que falha, que é o que fecha os dois achados não confirmados do store.
7. Comentários e exports da tabela de durabilidade (o teste que não existe, as cartas tomadas no
   arquivo publicado, o teste do host que não existe).

**Lote 4. Textos que dizem o que o painel não faz (pequeno; só texto e mensagem de recusa).**
8. Tooltip e "primeira frase da resposta" fora das regras e da descrição do summary; cabeçalho de
   `rules.ts` sem o teste e o golden de textos que não existem; comentário do modo plano.
9. Refazer um pai concluído: um texto só, e a recusa diz o estado real.
10. Regra dos subagentes atualizada (cartão desde o lançamento, a tarefa fecha sozinha, ✕ se um falha).

**Lote 5. Avisos que faltam ao modelo (médio).**
11. Resultado do plan com avisos do que ficou como histórico, foi interrompido ou manteve o estado.
12. "Parou com N pendentes" nas duas ordens (o lembrete de turno terminado e o done que fecha a origem).
13. Nota quando o fim dos subagentes fecha ou interrompe a tarefa; done em tarefa ✕ diz o caminho do
    start.
14. "Falta o summary" só vale para o último passo do turno.

**Lote 6. Lembrete de planejar pelo pedido atual (médio).**
15. O lembrete "sem plano aberto" e a marca de uso do painel medidos pelo pedido atual.

**Lote B. Travas (médio a grande; por último, num trabalho só de scripts e selos).**
16. `selos.json` comparado com o de `HEAD`, com o registro de remoção e o renome de teste por decisão
    (os dois achados juntos).
17. Selo por alcance transitivo e fixtures seladas, com o modo de migração dos hashes.

Opcional, sem efeito visível: reler os arquivos publicados só quando mudam, e não reler a filha
arquivada (médio; `task-tree/hooks/sessions.ts`, `task-tree/io/host.ts`).

Ordem sugerida: A, 1, 2, 3, 4, 5, 6, B. O lote 4 e a frase do lembrete do Esc em turno de aviso
(tratada à parte) tocam o mesmo arquivo de textos.

# Perguntas ao usuário

Em ordem de efeito no painel. O texto completo e as opções estão no achado de cada uma.

1. App fechado no meio do turno: como aparece, ao reabrir, a tarefa que estava em andamento? (◷, ✕ ou
   ◉ como hoje.)
2. Tempo de um pai e de um pedido: conta do primeiro start, do plano, ou como hoje?
3. Pergunta com tarefa aberta mas nenhuma em andamento: pendurar o aviso na pendente, recusar, ou como
   hoje?
4. Um passo ○ de pedido anterior basta para liberar a pergunta de um pedido novo sem tarefa?
5. Mensagem nova com tarefas abertas: vale "done primeiro, depois plan"?
6. Cartão de sessão filha cuja tarefa sai do plano no mesmo pedido: sob o nível 1 do pedido, ou solto
   no fim como hoje?
7. `/clear` numa sessão com filhas: o cartão da filha aberta antes fica solto no fim, some, ou mantém a
   ligação antiga? (Medir antes no app se a lista segue trazendo as filhas.)
8. Painel de sessão parada: guardar enquanto a sessão existir, por prazo fixo, ou as 30 últimas?
9. Subagentes terminados: apagar do estado os que não usaram o painel quando o pedido sai do trabalho?
10. Arquivos publicados: o que pode sair deles e da pasta?
11. Painel fechado por você: reabre só na sua próxima mensagem, ou também a cada plan e recarga?
12. Resposta inteira do turno, guardada e sem uso: tirar, pôr no texto alternativo, ou deixar?
13. Golden: ampliar para o que o catálogo diz travar, ou só corrigir o texto do catálogo?
14. Textos ao modelo: cenários por texto, golden letra por letra, ou como está?
15. `DESENVOLVIMENTO.md`: atualizar agora ou depois?
16. Memória do projeto: reescrever as notas "sem testes nem docs"?
17. Release: "BREAKING CHANGE" só no rodapé?
18. Release: título fora do formato falha, avisa, ou vira patch em silêncio?

As perguntas 8, 9 e 10 são a mesma conversa (o que pode ser podado) e pesam no teto do store, hoje em
23%. As perguntas 15 e 16 também andam juntas.

# Não confirmados

- Leitura do store que falha, ou painel guardado em outra forma (dois achados): falta o gatilho. O
  registro de falhas do lote 3 fecha o caso.
- Recarga que roda `session.start`: falta a medição no app, com uma linha de depuração no começo do
  `sessionStart`.
- Parte de um achado direto: cartas e cartões da sessão anterior depois de uma retomada no mesmo
  processo. Falta saber se o app desktop retoma outra sessão dentro do mesmo processo.
