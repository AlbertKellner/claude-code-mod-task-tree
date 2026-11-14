# Lote 07: a tarefa ◷ segue ◷ na mensagem seguinte, até o start

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "A tarefa iniciada num turno anterior volta a "em andamento" com o relógio correndo em qualquer
  prompt seguinte, e fica presa se o pedido novo muda de rumo" (a metade do fim normal; a do Esc foi
  resolvida no PR 36).
- Decisão 5, 2026-11-14: **"Seguir ◷ até o start (Recomendado)"**. A opção: "igual ao que você decidiu
  para o Esc; o relógio fica parado, e se a mensagem nova muda de rumo a tarefa antiga não aparece "em
  andamento" sem ninguém trabalhando nela."

## 2. Causa confirmada na ponta atual

Escrito no código:
- O fim normal do turno só grava a hora (`hooks/turn.ts:145-146`, `turnEnded`); a tarefa em andamento
  fica no state como estava (`started` e `startedAt`, sem `endedAt`). O ◷ é só do desenho:
  `draw/layout.ts:57-73` (`halt`) e `layout.ts:1048`.
- `hooks/panel.ts:32-38` (`wake`) apaga `turnEnded` em todo prompt e em toda chamada do loop principal;
  daí o desenho lê o state cru: `current` (`layout.ts:683-696`) acende toda folha aberta com `started`, e o
  tempo dela é "agora menos o início" (`layout.ts:119-123`), com o intervalo parado dentro.
- Só o Esc deixa marca na tarefa: `state/tasks.ts:73-79` (`park`: `stopped` e `endedAt`).

Regra registrada que a decisão completa: `turnos.iniciada-aguarda-no-fim` (◷ no fim) e
`turnos.prompt-seguinte-retoma` (o start reacende). O teste de `turnos.prompt-seguinte-retoma` só cobre
o caminho do Esc.

## 3. O que muda

`state/tasks.ts`, `hooks/turn.ts`, `draw/layout.ts`, `hooks/tools.ts`, `text/rules.ts`. Sem campo novo.

A ideia: no fim normal do turno, gravar na tarefa o que o desenho já mostrava (o `halt` sem Esc), como
o `park` faz no Esc. O estado "aguardando" passa a ser o da própria tarefa: aberta, sem `started`, com
`startedAt` e `endedAt` (é o que `leftWaiting`, `layout.ts:101`, já reconhece e desenha ◷).

- `state/tasks.ts`, função nova ao lado de `park` (sugestão: `rest(at)`): numa folha aberta com
  `started` e sem a marca `stopped`, tira `started` e põe `endedAt = stop(t, at)`; num pai aberto, tira
  `started` e põe `endedAt = stop(t, at)`, e desce; folha nunca iniciada e tarefa fechada não mudam. Não
  muda `status` (o pai sem nada aberto embaixo segue sendo fechado só no desenho, como hoje).
- `hooks/turn.ts`, `turnComplete`, fim normal do loop principal: depois do `settleBySubs`, aplicar `rest`
  às tarefas do grupo principal (um `change`), com a hora do fim. No Esc segue o `park`.
- `park` (`state/tasks.ts:77`): a folha só recebe `stopped` quando está em andamento agora
  (`started !== undefined`); hoje basta `startedAt`. A tarefa que um turno anterior deixou ◷ e ninguém
  reiniciou não é interrompida por um Esc posterior.
- `halt` (`layout.ts:61-70`): a folha que já aguarda (aberta, sem `started`, com `startedAt` e `endedAt`,
  sem `stopped`) fica como está em qualquer fim de turno, parado inclusive. Vale também para o cartão
  de uma filha (o painel publicado dela traz a tarefa nesse estado).
- `hooks/tools.ts:157` (`doneTool`, lista `unstarted`): "nunca iniciada" passa a ser sem `started` **e**
  sem `startedAt`. Sem isso, concluir duas tarefas ◷ sem start daria o aviso "fecharam juntas sem
  start… aparecem com 0:00", que não é verdade para elas.
- `wake`, `begin`, `finish`, `carry`, `current`, `stay` e `trail` não mudam: `begin` já tira o `endedAt`
  e põe `started` (a tarefa volta a ◉); `finish` conclui sem start; `carry` mantém os campos no replano;
  `trail` já devolve vazio quando a última iniciada está aberta com `endedAt`.

Comportamento novo no painel:
- fim normal com a tarefa X em andamento: X fica ◷ (como hoje);
- mensagem seguinte, antes de qualquer start: X segue ◷, com o tempo parado onde o turno terminou; o
  pai e o pedido dela seguem ◷; o chip conta "1 aguardando", nenhum "em andamento"; o relógio de 1 s do
  painel não roda por ela;
- start em outra tarefa: só a outra acende; X segue ◷; start em X: X volta a ◉; done em X: ✓;
- turno aberto por aviso do app, hand-back ou notificação: X segue ◷;
- Esc num turno seguinte em que X não recebeu start: X segue ◷ (só o que estava em andamento fica ✕);
- com filha trabalhando sob X, X segue ◉ enquanto ela trabalha (a regra da filha, `atWork`, não muda);
- com carta na fila saída de X, X segue ◷ e a entrega a conclui, como hoje.

Textos ao modelo (`text/rules.ts`), texto exato:
- `RULES`, item novo logo depois do item do Esc: "- Uma tarefa em andamento quando o turno termina
  normalmente fica aguardando (◷) no painel até um novo mcp__task-tree__start nela: nem a mensagem
  seguinte nem um turno aberto por aviso automático a reacende. Para seguir nela, chame start nela antes
  de trabalhar; se ela já terminou, done a conclui sem start."
- `PROMPT.open`: acrescentar ao fim "As que estavam em andamento seguem aguardando (◷): chame
  mcp__task-tree__start na que for continuar."
- Dedução do planejador: os lembretes curtos (`PROMPT.notice`, `handback`, `background`) não ganham
  lista, para não repetir texto a cada aviso; eles já dizem "start no que começa".

## 4. Impacto

`npm run impacto -- state/tasks.ts hooks/turn.ts draw/layout.ts hooks/tools.ts text/rules.ts`:
`draw/layout.ts` 110 cenários (subagentes 23, sessoes 22, turnos 14, cabecalho 14, visual 9, perguntas 8,
envios 8…); `state/tasks.ts` 46; `hooks/turn.ts` 40; `hooks/tools.ts` 31; `text/rules.ts` 16. Checklist do
app (por mapa de `draw/layout.ts`): `envios.destino-arquivado-no-app`, `subagentes.*-no-app`,
`ultracode.cor-e-corte`. Golden: os 4 cenários (`visual.desenho-principal`, `-cartao-filha`, `-envios`,
`-subagente`); ver 8.

## 5. Testes

Novos, `tests/turnos.test.ts`, regra `turnos.aguardando-segue-ate-o-start` (nova):
1. **"depois de um fim normal, a mensagem seguinte não reacende a tarefa que aguardava, e o relógio dela
   fica parado"**. Roteiro: `const { relogio } = fixar(on)`; `pedido`; `plan(A)`; `start(['2.1'])`;
   `relogio.advance(3000)`; `fimDoTurno`; `const noFim = await painel($)`; `relogio.advance(5000)`;
   `pedido($, 'segue')`; `relogio.advance(5000)`. Afirma: "Dois.um" aguardando; `semNadaAceso(p)`; as
   linhas "Dois.um", "Dois", "Plano A" e "Pedido um" têm o mesmo texto de `noFim`; `cabecalho(p).chips`:
   `andamento` 0, `aguardando` 1. Depois `start(['1'])`: "Um" em andamento e "Dois.um" aguardando.
   Depois `start(['2.1'])`: "Dois.um" em andamento, `chips.andamento` 2.
   Falha hoje: depois do `pedido`, "Dois.um" está em andamento com 0:13.
2. **"um turno que não abre pedido não reacende a tarefa que aguardava"**. Roteiro: o de 1 até o
   `fimDoTurno`; para cada entrada de `PROMPTS_SEM_PEDIDO` (já no arquivo): avançar, o prompt, o painel
   ("Dois.um" aguardando, `semNadaAceso`), `fimDoTurno`, de novo aguardando.
   Falha hoje: no turno do aviso "Dois.um" volta a em andamento.
3. **"o Esc num turno seguinte não interrompe a tarefa que aguardava sem start"**. Roteiro: `start(['2.1'])`;
   `fimDoTurno`; `pedido($, 'segue')`; `start(['1'])`; `esc`. Afirma: "Um" interrompida, "Dois.um"
   aguardando, `chips.interrompidas` 1.
   Falha hoje: as duas ficam interrompidas.
4. **"o done em tarefas que aguardavam as conclui sem o aviso de etapas sem start"**. Roteiro:
   `start(['1', '2.1'])`; `fimDoTurno`; `pedido($, 'segue')`; `const r = await done($, ['1', '2.1'])`.
   Afirma: as duas concluídas; `r.texto` não contém "fecharam juntas sem start".
   Hoje passa (elas ainda têm `started`): garante que a mudança não cria o aviso.
5. `tests/lembretes.test.ts`, regra `lembretes.aguardando-so-volta-com-start` (nova):
   **"as regras e o lembrete da mensagem seguinte dizem que a tarefa que aguardava só volta com start
   nela"**. Afirma: depois de `iniciar` e `fimDoTurno`, o contexto do `pedido` contém "seguem aguardando
   (◷)" e "deixe abertas só as que continuam"; as regras do prompt de sistema contêm "termina
   normalmente fica aguardando".
   Falha hoje: os textos não existem.

Teste existente que muda (decisão registrada), `tests/envios.test.ts:228`, **mantendo o nome**:
- "depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem". O roteiro chama
  `fimDoTurno` e logo `esc`, sem prompt nem start no meio, e espera "Um" interrompida: com a decisão, a
  tarefa que o fim normal deixou ◷ não é interrompida por um Esc posterior sem start. O corpo ganha,
  entre o `fimDoTurno` (com a asserção da carta entregue) e o `esc`: `await pedido($, 'segue')` e
  `await start($, ['1'])`. As quatro asserções finais ficam iguais (carta entregue, "Um" interrompida,
  "Plano A" não interrompida, "Dois" pendente).

Conferido por varredura dos testes: nenhum outro afirma "andamento" depois de um `fimDoTurno` sem start,
nem faz envio, abertura de sessão ou lançamento depois de um fim de turno sem start (fora
`subagentes.test.ts:381`, que é pedido sem plano). Se outro teste de `HEAD` falhar na `regressao` pelo
mesmo motivo (tarefa ◷ que aparecia ◉ ou ✕ sem start), relatar com o nome; só selar como decisão se o
cenário dele receber o `Reescrito:` desta decisão.

## 6. Catálogo e selos

`regras/turnos.md`, cenário novo:

```markdown
### turnos.aguardando-segue-ate-o-start
A tarefa que o fim normal do turno deixou aguardando segue aguardando até o modelo dar start nela.

- Dado uma tarefa iniciada e aberta quando o turno termina normalmente, ◷ desde então
- Quando chega a mensagem seguinte, ou um prompt que não abre pedido (aviso do app, hand-back, notificação), ou o modelo dá start em outra tarefa, ou a pessoa para com Esc um turno em que ela não recebeu start
- Então ela segue ◷, com o tempo parado no fim do turno, o pai e o pedido como estavam, no chip "aguardando" e fora do "em andamento"; só o start nela a reacende ◉, e o done a conclui sem aviso de falta de start; com uma sessão filha trabalhando sob ela, segue ◉ enquanto a filha trabalha (sessoes.filha-trabalhando-mantem-pais-em-andamento); o estado vai no painel publicado, e o cartão desta sessão na mãe mostra o mesmo

Origem: decisão do usuário, 2026-11-14 ("Seguir ◷ até o start (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a tarefa ◷ voltava a ◉ em qualquer prompt, com o relógio contando o tempo parado). Estende a decisão de 2026-11-12 do Esc ("Segue ✕ até novo start (Recomendado)") ao fim normal.
Código: state/tasks.ts, hooks/tools.ts, text/rules.ts
Estado: coberto
```

`regras/lembretes.md`, cenário novo:

```markdown
### lembretes.aguardando-so-volta-com-start
Os textos ao modelo dizem que a tarefa que ficou aguardando no fim do turno só volta com start nela.

- Dado uma tarefa em andamento quando o turno terminou normalmente
- Quando o modelo lê as regras do painel e o lembrete da mensagem seguinte
- Então eles dizem que ela segue aguardando (◷) até o start nela, que a mensagem seguinte não a reacende e que o done a conclui sem start

Origem: decisão do usuário, 2026-11-14 ("Seguir ◷ até o start (Recomendado)").
Estado: coberto
```

Cenários que ganham `Reescrito:` (o texto muda; salvo o de envios, os testes não mudam):
- `turnos.prompt-seguinte-retoma`: no "Então", acrescentar "a que o fim normal deixou ◷ segue ◷ até o
  start nela (turnos.aguardando-segue-ate-o-start)". Linha: `Reescrito: 2026-11-14, decisão do usuário
  ("Seguir ◷ até o start (Recomendado)"); antes, o prompt seguinte reacendia sozinho a tarefa que o fim
  normal deixara ◷. O teste não muda.`
- `durabilidade.fim-do-turno-sobrevive-ao-reinicio`: trocar "e o relógio não anda até o próximo pedido"
  por "e o relógio não anda até o start nela". Mesma linha `Reescrito:`, com "Os testes não mudam."
- `envios.esc-apos-entrega-imediata`: no "Quando", "o turno termina, normal ou com Esc" vira "o turno em
  que ela está em andamento termina, normal ou com Esc". Linha: `Reescrito: 2026-11-14, decisão do
  usuário ("Seguir ◷ até o start (Recomendado)"); a tarefa que um fim normal deixou ◷ não é interrompida
  por um Esc posterior sem start nela; o teste passa a dar start antes do Esc.`

Selos:

```bash
npm run regras:selar -- "task-tree/tests/envios.test.ts::depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem" --tipo decisao --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\"; o Esc só interrompe o que está em andamento, e o teste dá start antes dele"
npm run regras:selar -- "task-tree/tests/turnos.test.ts::depois de um fim normal, a mensagem seguinte não reacende a tarefa que aguardava, e o relógio dela fica parado" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::um turno que não abre pedido não reacende a tarefa que aguardava" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o Esc num turno seguinte não interrompe a tarefa que aguardava sem start" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o done em tarefas que aguardavam as conclui sem o aviso de etapas sem start" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\""
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::as regras e o lembrete da mensagem seguinte dizem que a tarefa que aguardava só volta com start nela" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Seguir ◷ até o start (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho "A parada com Esc espera o `start`" termina com "`wake` não mudou: o que um
fim normal deixou ◷ volta a ◉ no prompt seguinte; só o que o Esc parou espera o `start`" (~603): passa a
dizer que o fim normal grava o estado de espera na tarefa (`rest`) e que só o start a reacende; a linha
do `turn.complete` em "Os 14 hooks" (~116); entrada em "Decisões (histórico)". O parágrafo "Tarefas
abertas de uma sessão que terminou o turno" (~561-579) é do lote 26.

## 8. Golden

Não deve mudar: o que passa a ser gravado no fim normal é o que o `halt` já calculava para o desenho (o
cenário "principal" termina num `fimDoTurno` com "b2" em andamento; a hora gravada é a mesma que o
desenho usava). Se o check acusar "o desenho de principal mudou", conferir a diferença: só se aceita
mudança que venha desta regra, e aí regravar com `--motivo "\"Validar só no fim (Recomendado)\",
2026-11-14"`.

## 9. Checklist do app

- Fim normal com uma tarefa em andamento; mandar outra mensagem: a tarefa segue ◷ com o tempo parado, e
  o painel não redesenha a cada segundo por ela.
- Numa orquestradora, a tarefa com filha trabalhando embaixo segue ◉ depois do fim do turno e da
  mensagem seguinte, e passa a ◷ quando a filha para.
- No cartão de uma filha real que terminou o turno com tarefa em andamento: ◷ com o tempo do trabalho
  (não 0:00), ver o lote 21.

## 10. Dependências e conflitos

- Depois do lote 04 (toda tarefa em andamento passa a ter início próprio) e do lote 06 (mesmo bloco de
  `turnComplete`).
- O lote 21 (tempo da ◷ no cartão da filha parada) passa a depender deste: com a hora do fim gravada
  na tarefa e publicada com o painel, a causa daquele achado some.
- Os lotes 09 (turno que morre por erro) e 18 (Esc com filha ou subagente vivo) mexem em `park` e
  `halt`: vêm depois.
- Triagem B: decisões 25 e 26 (tempo do cabeçalho com o turno encerrado; tempo da tarefa que atravessa
  turnos: "Só com turno em curso") mexem na base do tempo e em `begin`; este lote não muda `begin` (a
  tarefa reiniciada segue contando desde o primeiro início, até a B acertar). Decisão 29 (faixa do
  cabeçalho entre um done e o start seguinte) e decisão 24 (◉ com subagente rodando) mexem em `rows` e
  no cabeçalho, perto de `halt`.
- Triagem C: decisão 33 (app fechado no meio do turno: "✕ interrompida") mexe em `ensureTurn`/
  `restoreTurn`; decisão 44 (base do tempo de pai e pedido); as decisões 41 e 42 mexem em `PROMPT.open`
  e `RULES`. Manter a frase nova do `PROMPT.open` e o item novo das `RULES`.

## 11. Bloqueio

Nenhum.

## 12. Acréscimo: o tempo da ◷ no cartão da filha parada (correção direta absorvida por este lote)

Achado "No cartão da filha parada, a tarefa ◷ para no último carimbo do painel publicado: 0:00 ou tempo
cortado" (correção direta; era o lote 21 do índice).

- Causa na ponta atual: `draw/layout.ts:180-181` (`panelOf`) para o relógio do cartão da filha parada no
  maior `startedAt`/`endedAt` das tarefas publicadas, porque o arquivo publicado não leva o fim do turno
  (`io/publish.ts:131-147`) e a tarefa em andamento não tem `endedAt`. A filha dá start em X, trabalha 20
  minutos sem outro start nem done e encerra o turno: no painel dela X é ◷ 20:00; no cartão dela na mãe,
  ◷ 0:00.
- A triagem propunha publicar o fim do turno num campo novo do arquivo. Com este lote não é preciso: o
  fim normal passa a gravar `endedAt` na própria tarefa (e nos pais abertos), que vai ao arquivo
  publicado dentro de `groups`, como a marca do Esc já vai. `panelOf` já usa o `endedAt` da tarefa quando
  ele existe (`stop(t, at)` devolve `t.endedAt`); o último carimbo fica como reserva para arquivos de
  versões antigas do mod. Nenhuma mudança em `types/index.d.ts`, `io/publish.ts` nem `io/host.ts`.

Testes a mais neste lote:
6. `tests/turnos.test.ts`, regra `sessoes.cartao-parado-mostra-o-tempo-do-turno` (nova):
   **"o fim normal do turno vai no painel publicado: a tarefa que aguardava leva a hora do fim"**.
   Roteiro: `const { relogio } = fixar(on)`; `const h = host(on, [])`; `pedido`; `plan(A)`;
   `start(['2.1'])`; `relogio.advance(3000)`; `fimDoTurno`. Afirma, nas tarefas do grupo principal de
   `h.proprio()`: "Dois.um" tem `endedAt` igual a `AGORA + 3000`, `startedAt` igual a `AGORA` e não tem
   `started`; "Dois" e "Plano A" têm `endedAt` igual a `AGORA + 3000`.
   Falha hoje: a tarefa é publicada com `started` e sem `endedAt`.
7. `tests/sessoes.test.ts`, mesma regra:
   **"no cartão da filha parada, a tarefa que aguardava mostra o tempo até o fim do turno dela"**.
   Roteiro: `abrir($, on, { painel: { tasks: [...] } })` com a filha publicando "Longa" aberta, sem
   `started`, com `startedAt: AGORA - 1_200_000` e `endedAt: AGORA - 1000` (o que a filha publica com
   este lote) e "Curta" concluída entre `AGORA - 1_200_000` e `AGORA - 900_000`; `h.filha(K1).rodando =
   false`; `aviso`. Afirma: "Longa" aguardando, e a linha dela contém "19:59".
   Passa hoje com esse arquivo: protege a leitura do lado da mãe.

Cenário novo, `regras/sessoes.md`:

```markdown
### sessoes.cartao-parado-mostra-o-tempo-do-turno
No cartão da filha parada, a tarefa que aguardava mostra o tempo até o fim do turno dela.

- Dado uma filha que deu start numa tarefa, trabalhou sem outro start nem done e terminou o turno com ela aberta
- Quando a mãe desenha o cartão da filha parada
- Então a tarefa aparece ◷ com o tempo do início ao fim do turno da filha, o mesmo do painel dela, e o tempo do cartão e o do pedido da mãe o seguem; o arquivo publicado leva a hora do fim na própria tarefa; para um arquivo de versão anterior do mod, o relógio para no último início ou fim publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o relógio do cartão parava no último carimbo do painel publicado, 0:00 ou tempo cortado); cumpre turnos.iniciada-aguarda-no-fim ("◷ com o relógio parado"). Corrigido junto com turnos.aguardando-segue-ate-o-start, que grava a hora do fim na tarefa.
Código: state/tasks.ts, hooks/turn.ts
Estado: coberto
```

Selos: `--tipo novo` para os dois testes, com o motivo "correção direta: o fim do turno vai na tarefa
publicada".

Checklist do app (soma à seção 9): numa filha real que terminou o turno com uma tarefa em andamento há
vários minutos, o cartão na mãe mostra ◷ com esse tempo, não 0:00.
