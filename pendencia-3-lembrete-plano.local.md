# Plano: frase da tarefa parada com Esc nos textos ao modelo (pendência 3)

Planejador, 2026-11-13. Só leitura do repositório (`fix/pendencias-auditoria`, ponta `1f9e8c1`).
Decisão do usuário, 2026-11-13: "Acrescentar (Recomendado)".

Resumo: a frase entra nos dois lugares. Uma regra geral nas `RULES` (prompt de sistema) e um lembrete
condicional, com a lista das tarefas paradas, nos três prompts que não abrem pedido (aviso do app,
hand-back de subagente, notificação de tarefa em segundo plano). Arquivos do mod: `task-tree/text/rules.ts`
e `task-tree/hooks/prompt-submit.ts`. Sem mudança de desenho, sem golden, sem BLOQUEIO.

## 1. Situação confirmada no código

Não é bug de comportamento do painel: o painel já faz o que a decisão de 2026-11-12 pede. O que falta é
texto ao modelo.

Escrito no código:

- `task-tree/hooks/prompt-submit.ts`, linhas 81 a 95: o prompt que não abre pedido (`NO_TURN`, aviso ou
  hand-back) leva no contexto só a nota de sessão que terminou (`endedNote`), a de recebimento
  (`takenNote`) e um dos três lembretes curtos, escolhido na linha 92.
- `task-tree/text/rules.ts`, linhas 136 a 140: os três lembretes curtos. `PROMPT.handback` ("o subagente
  terminou; atualize o painel (mcp__task-tree__done no que ele concluiu)"), `PROMPT.background` (o mesmo
  para tarefa em segundo plano) e `PROMPT.notice` ("mantenha o painel em dia (done no que terminou, start
  no que começa)"). Nenhum fala de Esc nem de tarefa parada.
- `task-tree/text/rules.ts`, linhas 17 a 69 (`RULES`): nenhuma menção a Esc. O que existe de mais próximo
  é a frase da regra de replano (linhas 43 e 44): "Para seguir numa mensagem seguinte com tarefas de uma
  anterior, use start e done nos ids delas", que fala de mensagem, não de aviso.
- Só as mensagens depois do Esc mandam usar start nas tarefas que continuam: `PROMPT.interruptedByYou`
  (linhas 159 a 168) e `PROMPT.interrupted` (linhas 144 a 151). Elas valem uma vez (`replanDue`) e só
  para a mensagem da pessoa ou de outra sessão.
- A marca da parada fica na própria tarefa: `park` (`task-tree/state/tasks.ts`, linhas 73 a 79) grava
  `stopped` em cada folha aberta e iniciada do grupo principal no Esc (`task-tree/hooks/turn.ts`, linhas
  161 a 166); `begin` (linhas 120 a 134) a tira no start; `finish` (linhas 54 a 66) no done; o plano que
  substitui a tarefa também (`interrupt`, `task-tree/draw/layout.ts`, linhas 29 a 35).

Dedução (não está escrito em lugar nenhum; é o motivo da sugestão original): num turno aberto por aviso
depois do Esc, o modelo que volta a trabalhar na tarefa parada não tem por que chamar start, porque do
ponto de vista dele a tarefa já estava iniciada. O painel fica ✕ enquanto ele trabalha nela. É o que a
decisão de 2026-11-12 pede para o painel; a frase ensina o modelo a dar o start.

Observação fora do item: o comentário do topo de `task-tree/text/rules.ts` (linhas 6 e 7) cita
`tests/textos.test.ts` e `tests/golden/textos.ts`, que não existem mais. Não faz parte deste item; fica
para a orquestradora decidir se entra como limpeza.

## 2. O que muda

### 2.1 Onde a frase entra, e por quê os dois

- Regra geral nas `RULES`: é o lugar que o `CLAUDE.md` e o `DESENVOLVIMENTO.md` (linhas 5 a 7) mandam
  ("regra nova de uso do painel entra no `RULES` e, onde couber, nos contextos dos hooks"). Vale em
  qualquer turno, inclusive nos casos que o lembrete não alcança (ver "Limites", na seção 9).
- Lembrete no turno do aviso: é a sugestão original ("uma frase a mais em `PROMPT.notice`, `handback` e
  `background` quando houver tarefa parada"). Chega na hora em que o risco existe, com os ids e os
  títulos das tarefas paradas, e não custa nada quando não há tarefa parada.
- Fora: as descrições das ferramentas (`TOOLS`) não mudam; `PROMPT.midTurn`, `PROMPT.open` e
  `PROMPT.request` também não (já mandam seguir com start e done, e a regra geral cobre o resto).

### 2.2 `task-tree/text/rules.ts`

Dois acréscimos, nenhum texto existente muda.

a) Um item novo nas `RULES`, logo depois do item do replano (o que termina em "replaneje o nível 1 com
ids novos para o que deve ser refeito.") e antes de "Não crie plano retroativo…". Texto:

> - Uma tarefa em andamento quando o usuário para o turno (Esc) fica interrompida no painel até um novo
> mcp__task-tree__start nela. Nada mais a reacende: nem a mensagem seguinte, nem o start em outra tarefa,
> nem um turno aberto por aviso automático, por retorno de subagente ou por tarefa em segundo plano que
> terminou. Para retomá-la, chame start nela antes de trabalhar; se ela já terminou, done a conclui sem
> start.

b) Uma entrada nova em `PROMPT` (nome sugerido: `parked`, o mesmo verbo de `park` em `state/tasks.ts`;
`stopped` já é usado em `SESSION`), função da lista das tarefas paradas, que abre com o prefixo comum
dos lembretes (`PANEL`). Texto, com a lista no lugar de `<lista>`:

> Painel de tarefas (task-tree): o usuário parou (Esc) o turno em que estas tarefas estavam em
> andamento, e elas seguem interrompidas no painel: <lista>. Um turno aberto por aviso automático ou por
> retorno de subagente, como este, não as retoma: cada uma só volta a andamento com
> mcp__task-tree__start nela. Se for seguir numa delas agora, chame start nela antes; a que já terminou,
> feche com mcp__task-tree__done.

Cuidados com o texto (testes existentes dependem disso): ele não pode conter "replaneje o painel",
"mensagem não entregue", "recebimento confirmado" nem "sem plano aberto"; os dois textos acima não
contêm. A frase é neutra de propósito: não manda retomar nem proíbe retomar o que a pessoa parou, só diz
que retomar exige start.

O comentário que descreve `PROMPT` (linhas 104 a 107) ganha a menção à entrada nova e à decisão
(2026-11-13, "Acrescentar (Recomendado)").

### 2.3 `task-tree/hooks/prompt-submit.ts`

Só o ramo dos prompts que não abrem pedido (linhas 81 a 95) muda:

- Antes de montar o contexto, ler as tarefas do grupo principal (a chave `groups` já é literal neste
  arquivo, linha 16), garantindo antes que os grupos vieram do store, como o ramo da mensagem no meio do
  turno já faz na linha 115 (`ensureGroups`).
- Separar as tarefas paradas: as do grupo principal, em qualquer nível, abertas e com a marca `stopped`.
  No state a marca só existe em folha aberta; `flat` (de `draw/layout`, de onde o arquivo já importa
  `MAIN` e `hasOpen`) dá a lista plana.
- Se houver alguma, acrescentar ao contexto a entrada nova de `PROMPT`, com a lista no formato de
  `openList` (id entre aspas e título, até 10, "e mais N"; `openList` já é importada e aceita a lista
  filtrada). Ela vai por último, como item próprio do contexto, depois do lembrete curto, que continua
  igual. Sem tarefa parada, o contexto fica exatamente como hoje.
- O mesmo para os três casos (aviso, hand-back, notificação): a escolha do lembrete curto na linha 92
  não muda.
- Nada mais muda no arquivo: nem o ramo do meio do turno, nem o do pedido novo, nem `said`.

Limites do validate respeitados: a chave de `$.state` usada já é literal no arquivo; a leitura fica
dentro de `promptSubmit`, função de topo.

### 2.4 Comportamento novo, em termos do que se observa

- Painel: nada muda. Mesmos estados, mesmo desenho.
- Textos ao modelo: com uma tarefa que o Esc parou e que ainda não recebeu start, todo turno aberto por
  aviso do app, hand-back ou notificação de tarefa em segundo plano traz, além do lembrete curto, a
  lista dessas tarefas e a frase. Vale enquanto a marca existir, inclusive depois de outros pedidos.
  Some com o start ou o done na tarefa, ou quando um plano a substitui. As regras do prompt de sistema
  passam a dizer a regra geral.

### 2.5 Ordem de escrita (recarga a quente)

Os dois arquivos vão de uma vez (cópia no scratchpad e cópia conjunta), como manda o `CLAUDE.md`. Se
forem um por vez, `text/rules.ts` primeiro: a entrada nova sem uso compila; o inverso quebra a recarga.

## 3. Matriz de impacto

`npm run impacto -- text/rules.ts hooks/prompt-submit.ts` (rodado em 2026-11-13, na ponta `1f9e8c1`):

- Arquivos do mod tocados: `text/rules.ts`, `hooks/prompt-submit.ts`. Núcleo não tocado.
- Cenários afetados: 42, todos `coberto`. Por área: lembretes, os 10 (14 testes em
  `tests/lembretes.test.ts`); turnos, os 14 (entre eles `turnos.parada-segue-interrompida-ate-o-start`,
  7 testes); pedidos, 14 (em `pedidos.test.ts`, `sessoes.test.ts`, `cabecalho.test.ts` e
  `envios.test.ts`); envios, 2 (`envios.pedido-recebido-mostra-carta`,
  `envios.destino-arquivado-nao-entregue`); `arvore.done-sem-summary-e-varias-sem-start`;
  `perguntas.mensagem-no-meio-do-turno-mantem-espera`.
- Checklist do app: nenhum. Golden: nenhum cenário. Fora do mapa: nenhum.

O número é alto porque `hooks/prompt-submit.ts` é código da área de turnos e de pedidos; a mudança só
acrescenta um item ao contexto dos prompts que não abrem pedido.

## 4. Testes

Todos em `task-tree/tests/lembretes.test.ts`, pelo kit que o arquivo já usa (`iniciar`, `contexto`,
`esc`, `aviso`, `pedido`, `start`, `done`, `fimDoTurno`), todos citando o cenário novo
`lembretes.parada-so-volta-com-start`. `iniciar` deixa "Um" em andamento e "Dois" pendente.

Declarações de topo: só acrescentar (uma constante com o trecho que identifica a frase, "só volta a
andamento com mcp__task-tree__start nela", e, se quiser, a lista dos três prompts que não abrem pedido,
como `PROMPTS_SEM_PEDIDO` em `turnos.test.ts`). Não mexer em `A`, `REPLANEJAR`, `ABERTAS`, `iniciar` nem
`contexto`: o selo de cada teste existente inclui as declarações de topo que ele usa.

1. `depois do Esc, o turno de um aviso, de um hand-back ou de uma notificação diz que a tarefa parada só volta com start nela`
   - Roteiro: `iniciar`, Esc; para cada um dos três prompts (aviso do app; hand-back; notificação com
     origem `task-notification`, como nas linhas 92 a 96 do arquivo), ler o contexto e terminar o turno.
   - Afirma, nos três: o contexto contém o trecho da frase e "o usuário parou (Esc)"; contém "Um" (a
     parada); não contém "Dois" (a pendente nunca iniciada não é listada).
   - Falha hoje: o contexto desses prompts tem só o lembrete curto; a primeira afirmação não passa.

2. `a frase da tarefa parada com Esc segue nos avisos depois de outro pedido e some com o start nela`
   - Roteiro: `iniciar`, Esc; mensagem da pessoa com start em "2"; fim do turno; aviso (primeira
     leitura); fim do turno; mensagem da pessoa com start em "1"; fim do turno; aviso (segunda leitura).
   - Afirma: a primeira leitura contém o trecho da frase e "Um" e não contém "Dois" (iniciada depois, não
     parada); a segunda não contém o trecho e contém o lembrete curto ("mantenha o painel em dia").
   - Falha hoje: a primeira leitura não traz a frase. Prova que a frase segue a marca na tarefa, não o
     pedido de replanejar (que a mensagem do meio já consumiu).

3. `sem tarefa parada com Esc, ou depois do done nela, o aviso leva só o lembrete curto`
   - Roteiro: `iniciar`; fim normal do turno; aviso (primeira leitura); fim do turno; mensagem da pessoa
     com start em "1"; Esc; aviso (segunda leitura); fim do turno; mensagem da pessoa com done em "1";
     fim do turno; aviso (terceira leitura).
   - Afirma: a primeira e a terceira não contêm o trecho da frase e contêm "mantenha o painel em dia"; a
     segunda contém o trecho e "Um".
   - Falha hoje: na segunda leitura. A primeira e a terceira já passam hoje; estão no teste para travar
     que a frase é condicional (não pode virar texto fixo dos avisos).

4. `as regras do prompt de sistema dizem que a tarefa parada com Esc só volta com start nela`
   - Roteiro: como o teste de `lembretes.regras-no-prompt-de-sistema` (stub de `prompt.compose` antes da
     primeira chamada a `$`, `fixar`, compor com `mcp__task-tree__plan` nas ferramentas, ler a seção
     `task-tree:regras`).
   - Afirma: a seção contém "para o turno (Esc)", "até um novo mcp__task-tree__start nela", "aviso
     automático" e "retorno de subagente".
   - Falha hoje: nenhum desses trechos existe nas `RULES`.

Testes existentes que mudam: nenhum. Conferido:

- `lembretes.test.ts`, linha 92 (`lembretes.replanejar-apos-esc-com-aviso-no-meio`): lê o contexto do
  aviso depois do Esc, onde a frase nova passa a aparecer, e afirma só que ele não contém "replaneje o
  painel". A frase não contém.
- `envios.test.ts`, linhas 437 a 507: leem o contexto de avisos, alguns depois de Esc, procurando
  "mensagem não entregue" e "recebimento confirmado". A frase não contém nenhum dos dois.
- Nenhum teste compara o contexto inteiro nem conta os itens dele.
- Os testes que leem as `RULES` só afirmam trechos que continuam lá.

Se algum teste existente falhar com o código novo, é regressão do código: corrige-se o código, não o
teste.

Não coberto por teste: a frase no primeiro aviso de um processo novo (respawn sem `session.start`), que
depende de os grupos virem do store antes da leitura. A marca no store já é coberta por
`durabilidade.parada-com-esc-sobrevive-ao-reinicio`; os testes de durabilidade existentes, na etapa de
regressão, guardam que a leitura a mais dos grupos não muda o painel.

## 5. Catálogo

Cenário novo, no fim de `regras/lembretes.md` (o código da área já tem `hooks/prompt-submit.ts` e
`text/rules.ts`; não precisa de `Código:`):

> ### lembretes.parada-so-volta-com-start
> Os textos ao modelo dizem que a tarefa parada com Esc só volta com start nela.
>
> - Dado uma tarefa em andamento quando a pessoa parou o turno (Esc), ainda sem start depois disso
> - Quando chega um prompt que não abre pedido (aviso do app, hand-back de subagente, notificação de tarefa em segundo plano), logo depois do Esc ou em qualquer turno seguinte enquanto ela não recebe start
> - Então, além do lembrete curto, o modelo recebe a lista das tarefas paradas e a frase de que um turno aberto por aviso automático ou por retorno de subagente não as retoma, e cada uma só volta a andamento com start nela; a pendente nunca iniciada não entra na lista; sem Esc, ou depois do start ou do done na parada, o aviso leva só o lembrete curto; as regras do prompt de sistema dizem a regra para qualquer turno (nem a mensagem seguinte nem o start em outra tarefa a reacendem; o done a conclui sem start)
>
> Origem: decisão do usuário, 2026-11-13 ("Acrescentar (Recomendado)"), sobre a sugestão da correção de 2026-11-12 (turnos.parada-segue-interrompida-ate-o-start, "Segue ✕ até novo start (Recomendado)"): no turno de um aviso, o texto ao modelo era só "start no que começa".
> Estado: coberto

Cenários reescritos: nenhum (nenhuma regra existente muda; sem `Reescrito:`).

Selos (depois de escrever os testes; a data sai sozinha):

    npm run regras:selar -- "task-tree/tests/lembretes.test.ts::depois do Esc, o turno de um aviso, de um hand-back ou de uma notificação diz que a tarefa parada só volta com start nela" --tipo novo --motivo "decisão do usuário, 2026-11-13 ('Acrescentar (Recomendado)'): frase da tarefa parada com Esc nos avisos"
    npm run regras:selar -- "task-tree/tests/lembretes.test.ts::a frase da tarefa parada com Esc segue nos avisos depois de outro pedido e some com o start nela" --tipo novo --motivo "decisão do usuário, 2026-11-13 ('Acrescentar (Recomendado)'): frase da tarefa parada com Esc nos avisos"
    npm run regras:selar -- "task-tree/tests/lembretes.test.ts::sem tarefa parada com Esc, ou depois do done nela, o aviso leva só o lembrete curto" --tipo novo --motivo "decisão do usuário, 2026-11-13 ('Acrescentar (Recomendado)'): a frase é condicional"
    npm run regras:selar -- "task-tree/tests/lembretes.test.ts::as regras do prompt de sistema dizem que a tarefa parada com Esc só volta com start nela" --tipo novo --motivo "decisão do usuário, 2026-11-13 ('Acrescentar (Recomendado)'): regra geral nas RULES"

Se o implementador mudar o nome de um teste, a chave do selo muda junto. Alternativa de um comando só:
`node scripts/selos.mjs --novos --motivo "…"`.

Commit sugerido (um só, com código, testes, cenário, selos e documentação):
`fix(task-tree): avisos e regras dizem ao modelo que a tarefa parada com Esc só volta com start nela`.

## 6. Documentação

`task-tree/DESENVOLVIMENTO.md`:

- "Um prompt" (linhas 155 a 158): onde diz que o prompt que não abre turno "leva só `endedNote`,
  `takenNote` e um lembrete curto", acrescentar que, com tarefa parada com Esc ainda sem start no grupo
  principal, leva também a entrada nova de `PROMPT` com a lista delas (decisão de 2026-11-13,
  "Acrescentar (Recomendado)").
- "A parada com Esc espera o `start`" (linhas 571 a 584): uma frase no fim dizendo que os textos ao
  modelo dizem a regra (o item das `RULES` e o lembrete nos avisos), com o cenário
  `lembretes.parada-so-volta-com-start`.

`CLAUDE.md` do repositório: sem mudança (nada novo no checklist do app).

## 7. Golden

Não muda. Os textos ao modelo não entram no desenho; a matriz de impacto não lista cenário de golden.

## 8. Checklist do app

O harness cobre o texto e a condição. O que só o app mostra é o efeito no modelo, que não é
determinístico; não é item de aceite, é observação para o usuário:

- Parar com Esc um turno com uma tarefa em andamento. Quando um aviso automático abrir um turno (uma
  sessão filha que terminou, um subagente em segundo plano que voltou) e o modelo retomar aquela tarefa,
  ela deve acender ◉ (ele chamou start) em vez de seguir ✕ enquanto ele trabalha nela.
- Se o modelo não retomar a tarefa nesse turno, ela segue ✕, como hoje.

Para validar, o Esc tem de ser dado depois de o mod recarregar com a mudança (as `RULES` entram no prompt
de sistema do pedido seguinte à recarga).

## 9. Riscos, limites e interações

Limites do lembrete (a regra geral das `RULES` cobre os dois):

- Pai iniciado diretamente e parado com Esc: `park` só marca folhas iniciadas; o pai perde o `started` e
  as folhas dele, nunca iniciadas, ficam sem marca. Sem marca, o lembrete não lista nada.
- Tarefa parada com carta na fila: é listada, e o texto diz "seguem interrompidas", mas no painel ela
  está ◷ enquanto a carta espera (`envios.fila-nao-interrompe-no-fim-do-turno`). A parte que importa
  continua verdadeira (só o start a reacende). Excluir essas tarefas exigiria ler os envios no hook; não
  compensa.

Riscos:

- Repetição: a frase vai em todo aviso enquanto a marca existir. Se a pessoa abandona a tarefa parada
  sem fechá-la, cada aviso leva cerca de 400 caracteres a mais. É o mesmo padrão de `PROMPT.open`, que
  lista as abertas a cada mensagem; a saída é o modelo fechar ou retomar a tarefa. Não contraria
  nenhuma decisão registrada; se o usuário preferir a frase uma vez por Esc, é ajuste pequeno, em outro
  item.
- As `RULES` crescem cerca de 400 caracteres, em todo pedido.
- Leitura a mais dos grupos no ramo dos avisos (`ensureGroups` e uma leitura do state): mesmo padrão do
  ramo do meio do turno e do fim do turno; os testes de durabilidade e de turnos guardam o painel.

Interações com os outros itens (em série: carta, depois histórico e aviso, depois este):

- Carta para subagente parado: se aquele item acrescentar texto em `text/rules.ts` (um aviso de "não
  entregue", ou a regra das cartas nas `RULES`), os dois acréscimos deste plano são independentes dele:
  localizar pelo conteúdo vizinho (o fim do item do replano; o objeto `PROMPT`), não pelo número da
  linha. Conferir de novo que a frase não contém nenhum trecho que os testes novos de envios procurem
  em contexto de aviso.
- Histórico e aviso "Painel grande demais": desenho e render; sem arquivo em comum além de
  `regras/selos.json`, que todos escrevem (em série, sem conflito).
- Os números de linha deste plano são da ponta `1f9e8c1`; depois dos outros itens podem ter andado.

## 10. BLOQUEIO

Nenhum. Nada no plano contraria decisão registrada: nenhum teste existente muda, nenhum cenário é
reescrito, o desenho não muda.
