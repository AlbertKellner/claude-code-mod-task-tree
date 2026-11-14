# Tarefa parada com Esc segue ✕ até o start nela: plano e diff (rodada 2)

Data: 2026-11-12. Base do ensaio: `b02a9a9` + `correcao-r2-itens-1-2.diff` (commit local `bfe28bd` na
cópia `scratchpad\r2-item-9`). O repositório real só foi lido pelo git (clones no scratchpad); nada foi
escrito nele.

## Resumo

- **Diff pronto, sem BLOQUEIO:**
  `<notas>\correcao-r2-item-9.diff`.
  `git apply --check` ok em três bases: a do ensaio; o HEAD atual do repositório real (`9636242`: itens
  1 e 2, subagente neto, 8 e 12); e esse HEAD mais `correcao-r2-item-13.diff`.
- **O diff NÃO traz `task-tree/tests/golden/svg.ts` nem o selo `golden`.** Com ele aplicado, o check
  falha em uma coisa só, e é a esperada: `o desenho de principal mudou`. Fica sem commit até o usuário
  validar no app (seção 7).
- **Check na cópia, estado entregue:** `regras`, `travas`, `selos`, os dois `validate` e `tsc` ok;
  `plugin test` 205 de 206, a única falha é `golden: principal`.
- **Check na cópia, ensaio com o golden regravado só na cópia:** as 8 etapas ok, 206 testes; regressão
  com os 196 testes da base contra o código novo, 2 falhas, as duas por decisão registrada (o desenho e
  o teste selado como decisão).
- **Um teste selado muda**, o que a decisão nomeia (seção 6). Nenhum outro teste existente mudou, e os
  goldens `filha`, `envios` e `subagente` seguem iguais.
- A marca fica na própria tarefa (campo novo `stopped`), não numa lista de ids. `halted` serviu de
  modelo, mas não de base (seção 3).

## 1. Decisão do usuário

2026-11-12, palavras dele: "Segue ✕ até novo start (Recomendado)" (`orq-decisoes-altos.local.md`).

A tarefa parada com Esc só volta a ◉ quando o modelo dá start nela. Não acende no prompt de um aviso, o
relógio não corre, não vira ◷ no fim do turno. Numa mensagem da pessoa em que o modelo dá start em
outra tarefa, a parada segue ✕. Se a sessão é filha, o cartão dela na mãe segue "rodada descartada"
até esse start.

## 2. Causa, confirmada no código da base

O Esc não deixava nada na tarefa. O ✕ vinha de duas marcas do turno, e as duas se perdem no turno
seguinte:

- `hooks/panel.ts:31` (`wake`) zera `turnEnded`. Ela roda em todo prompt, antes de se saber que tipo de
  prompt é (`hooks/prompt-submit.ts:57`), e em toda chamada de ferramenta da principal.
- `draw/layout.ts:979`: sem `ended`, o desenho usa as tarefas como o state as guarda. A parada continua
  `open` com `started`, então `current()` (`layout.ts:640`) a acende e o relógio dela corre.
- `hooks/turn.ts:149`: todo fim de turno da principal grava `turnAborted = e.isAborted`. O fim normal
  do turno do aviso grava `false`, e `halt` (`layout.ts:53`) passa a ler a tarefa como ◷.
- `hooks/panel.ts:519` publica esse `turnAborted` como `aborted`, e `discarded` (`layout.ts:126`) só
  olha para ele: depois do turno do aviso, o cartão da filha volta a contar.

Reproduzido na base (teste de sondagem, relógio fixo): Esc deixa "✕ Dois.um 0:03"; no aviso vira
"◉ Dois.um 0:08" e 5 s depois "0:13"; no fim do turno, "◷ Dois.um 0:13". Com o diff: "✕ Dois.um
interrompida 0:03" nos três momentos.

Dos 11 testes novos ou alterados, 9 falham contra o código da base. Os 2 que passam nela guardam o que
não pode quebrar (o start reacende, o done conclui).

## 3. Como ficou

**A marca.** No Esc (`turnComplete` com `isAborted`, loop principal), `park` (novo, em
`state/tasks.ts`) marca `stopped: true` em cada folha aberta e iniciada do grupo principal, e para ali
o relógio dela e o dos pais abertos (`endedAt`). A tarefa segue `open` e com `started` no state. Por
isso os lembretes continuam a listá-la, o `done` continua a fechá-la e a âncora de cartas, sessões e
subagentes fica onde estava.

**Quem tira a marca.** O start na tarefa (`begin`), o done (`finish`) e o plano que a abandona
(`interrupt`). O replano no mesmo pedido que mantém a tarefa mantém a marca (`carry`).

**Quem lê a marca.**
- `halt` (fim de turno): a folha marcada é ✕ também no fim normal.
- `stay` (novo, turno em curso): só as folhas marcadas são lidas como ✕; o resto fica como está. Com a
  carta dela na fila, a tarefa segue ◷, como a regra de 2026-10-30 manda. `stayed` aplica isso ao grupo
  principal: no painel da própria sessão e, na mãe, no cartão de uma filha que está trabalhando.
- `trail`: não acende o caminho de uma tarefa parada.
- `discarded`: a filha parada com tarefa marcada segue descartada, mesmo sem `aborted` no arquivo.
- A contagem da sessão inteira (tooltip do cabeçalho, `hooks/render.tsx`) e a linha de status
  (`showStatus`, `hooks/panel.ts`) passam a ler o grupo por `stayed`.

**O pai iniciado diretamente.** Um `start` num pai acende o pai e a primeira folha aberta dele, sem
marcar a folha como iniciada. Depois do Esc nada ficava ✕, e o prompt seguinte reacendia tudo. `park`
desfaz o `started` desse pai: ele só reacende com outro start nele. É o mesmo defeito para outro tipo
de tarefa, e a decisão o cobre; tem teste.

**Por que não `halted`.** `halted` é o que o desenho escreve numa cópia que já tem `status:
'interrupted'`. Se o state guardasse o mesmo nome numa tarefa `open`, `leftOpen` (que lê `halted` sem
olhar o status) veria como "deixada aberta" uma tarefa já concluída em que algum caminho de fecho
esqueceu de limpar o campo. Com nome próprio, todo leitor confere antes se a tarefa está aberta, e
uma marca velha numa tarefa fechada não tem efeito. A cópia do desenho leva os dois (`halted` e
`stopped`), porque o cartão da filha é cortado depois de lido e o descarte precisa da marca ali.

**Por que não a lista `stopped` do plano anterior.** Um plano num pedido novo renomeia a tarefa antiga
e cria outra com o mesmo id: uma lista de ids marcaria a nova. A lista também não chega à mãe, que
precisa saber qual tarefa do cartão está parada. A marca na tarefa viaja com ela pelo store e pelo
arquivo publicado, sem chave nova de state nem linha nova na tabela de durabilidade.

**`Published.aborted` não mudou.** Continua a dizer só que o último turno foi parado. Juntar a marca a
ele faria a mãe ler como ✕ também a tarefa que a filha iniciou depois, num turno normal.

**`wake` não mudou.** O que um fim normal deixou ◷ volta a ◉ no prompt seguinte, como hoje. Só o que o
Esc parou espera o start.

## 4. Consequências que a decisão não diz com todas as letras

Entraram porque saem direto de "segue ✕". O usuário vai vê-las no app:

1. **O pai com ✓ e ✕ embaixo, sem nada aberto, fica ✓** nos turnos seguintes. É a regra de 2026-11-04
   ("Fica ✓"), que já valia logo depois do Esc e agora dura enquanto a parada dura. No golden, "Um"
   passa de ◷ a ✓.
2. **A parada sai da contagem em todo lugar**, como qualquer interrompida: cabeçalho, x/y do pai e do
   pedido, "sessão inteira" do tooltip e linha de status ("Tarefas d/n"). Hoje, logo depois do Esc, o
   tooltip e a linha de status ainda a contam como aberta (na base, o cabeçalho diz "0 de 2" e o
   tooltip "sessão inteira: 0 de 3", sem nada fora de vista). Sem esse ajuste a diferença passaria a
   durar turnos inteiros, e o tooltip do golden `principal` diria "sessão inteira: 2 de 6" ao lado de
   "2 de 5". **O efeito também aparece logo depois do Esc**, onde hoje a linha de status conta a
   tarefa.
3. **O relógio do pai e do pedido da parada para no Esc.** No golden, "Pedido principal" e "Plano A"
   passam de 0:01 a 0:00.
4. **O `done` na parada, sem start, a conclui com o tempo até o Esc** (o relógio não correu depois).

## 5. Cenários

- **Reescrito:** `turnos.prompt-seguinte-retoma`. "Então a tarefa iniciada acende ◉; a que o Esc parou
  segue ✕ até o start nela, e com esse start nada fica ✕". Linha `Reescrito: 2026-11-12, decisão do
  usuário ("Segue ✕ até novo start (Recomendado)")`.
- **Reescrito (só a linha):** `visual.desenho-principal`, como nas outras vezes em que o golden mudou
  por decisão.
- **Novos, `coberto`:**
  - `turnos.parada-segue-interrompida-ate-o-start` (`Código: state/tasks.ts`);
  - `durabilidade.parada-com-esc-sobrevive-ao-reinicio`;
  - `sessoes.filha-parada-com-esc-segue-descartada-ate-o-start`.
- **Sem mudança, e seguem valendo:** `turnos.esc-interrompe-so-a-iniciada`,
  `turnos.pai-com-filha-concluida-nunca-interrompido`, `turnos.iniciada-aguarda-no-fim`,
  `envios.fila-nao-interrompe-no-fim-do-turno`,
  `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`,
  `sessoes.rodada-descartada-fora-da-contagem`, `sessoes.filha-parada-com-esc-sem-pendente`,
  `durabilidade.fim-do-turno-sobrevive-ao-reinicio`, `lembretes.replanejar-apos-esc-*`.

## 6. Testes

**Existente que muda (1), por decisão:**
`turnos.test.ts::o prompt seguinte ao fim do turno volta ao trabalho e o start acende a tarefa`.
Afirmava que, depois de Esc em "Um", mensagem e start em "Dois.um", nada ficava ✕. Passa a afirmar:
"Dois.um" ◉, "Um" segue ✕; com o start em "Um", "Um" ◉ e nada ✕. Asserções: 2 → 4.

**Nenhum outro teste selado muda.** A regressão do ensaio confirma: dos 196 testes da base, só esse e
o `golden: principal` falham contra o código novo.

**Novos (10):**
- `turnos.test.ts` (7):
  - depois do Esc, um prompt que não abre pedido (aviso do app, hand-back, notificação de tarefa em
    segundo plano) não reacende a parada, o relógio dela, do pai e do pedido não anda, e o fim desse
    turno não a deixa ◷; cabeçalho com 1 interrompida, 0 aguardando, sem "sessão inteira";
  - mensagem da pessoa com start em outra tarefa: a parada segue ✕, também no fim do turno;
  - o start na parada a reacende e ela volta a contar; no fim do turno aguarda como qualquer outra;
  - o done na parada, sem start, a conclui;
  - o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende;
  - o replano no mesmo pedido que mantém a parada a mantém ✕, com o relógio parado;
  - a marca vai no painel publicado até o start nela (e o arquivo não diz `aborted`).
- `durabilidade.test.ts` (2, par 1/2 e 2/2): Esc, aviso tratado até o fim, processo novo: a parada
  segue ✕, o start em outra não a reacende, o start nela sim.
- `sessoes.test.ts` (1): filha com uma tarefa marcada e outra iniciada depois. Trabalhando, o cartão já
  mostra a parada ✕; parada, a rodada segue descartada e a outra aguarda ◷; sem a marca (start), a
  rodada volta a contar.

Os imports novos estão em linhas próprias, e nenhuma declaração de topo usada por teste selado mudou.
O kit não foi tocado.

### Comandos de selo (Git Bash, na raiz do repositório)

Se `regras/selos.json` colidir: `git apply --exclude=regras/selos.json <diff>` e depois:

```bash
DEC='decisão do usuário, 2026-11-12: "Segue ✕ até novo start (Recomendado)"'
NOVO='decisão do usuário, 2026-11-12: "Segue ✕ até novo start (Recomendado)"; achado alto 9 da auditoria de 2026-11-10'

npm run regras:selar -- "task-tree/tests/turnos.test.ts::o prompt seguinte ao fim do turno volta ao trabalho e o start acende a tarefa" --tipo decisao --motivo "$DEC"

for t in \
  "task-tree/tests/turnos.test.ts::depois do Esc, um prompt que não abre pedido não reacende a tarefa parada, o relógio dela não corre e o fim desse turno não a deixa aguardando" \
  "task-tree/tests/turnos.test.ts::numa mensagem da pessoa em que o modelo dá start em outra tarefa, a parada com Esc segue interrompida, também no fim do turno" \
  "task-tree/tests/turnos.test.ts::o start na tarefa parada com Esc a reacende e ela volta a contar; no fim do turno aguarda como qualquer outra" \
  "task-tree/tests/turnos.test.ts::o done na tarefa parada com Esc, sem start, a conclui" \
  "task-tree/tests/turnos.test.ts::o pai iniciado e parado com Esc não reacende no prompt seguinte; o start nele o reacende" \
  "task-tree/tests/turnos.test.ts::o replano no mesmo pedido que mantém a tarefa parada com Esc a mantém interrompida, com o relógio parado" \
  "task-tree/tests/turnos.test.ts::a marca da parada com Esc vai no painel publicado até o start nela" \
  "task-tree/tests/durabilidade.test.ts::parada com Esc no reinício, 1/2: o Esc para a tarefa e um aviso é tratado até o fim" \
  "task-tree/tests/durabilidade.test.ts::parada com Esc no reinício, 2/2: o processo novo a desenha interrompida até o start nela" \
  "task-tree/tests/sessoes.test.ts::a filha parada com Esc segue rodada descartada depois de outro turno, até dar start na tarefa parada"
do
  npm run regras:selar -- "$t" --tipo novo --motivo "$NOVO"
done
```

O selo `decisao` só passa na regressão no dia em que é gravado: se a implementação for noutro dia,
regrave esse selo no dia.

## 7. Golden

**Muda só o cenário `principal`.** `filha`, `envios` e `subagente` saem idênticos (conferido no ensaio,
e de novo sobre o HEAD real com o item 13 por cima).

O cenário: no "Pedido principal", "Um.um" é concluída, "Um.dois" é iniciada e parada com Esc; depois
vem o "Pedido dois", com "b1" concluída e "b2" iniciada, e o turno termina normalmente.

Das 13 linhas do desenho, mudam 5:

| Linha | Aprovado hoje | Com o diff |
|---|---|---|
| Cabeçalho | 2 de 6 (33%); 2 pendentes, 2 aguardando | 2 de 5 (40%); 2 pendentes, 1 aguardando, 1 interrompida |
| Pedido principal | ◷ 1 de 4, 0:01 | ◷ 1 de 3, 0:00 |
| Plano A | ◷ 1 de 4, 0:01 | ◷ 1 de 3, 0:00 |
| Um | ◷ 1 de 2, 0:01 | ✓ 1 de 1, 0:00 |
| Um.dois | ◷ 0:01 | ✕ "interrompida", 0:00 |

"Um.um", "Dois", "Três", "Pedido dois", "Plano B", "b1", "b2" e a linha ↩ não mudam.

**Na aplicação:** o check falha em `o desenho de principal mudou (valide no app antes de aprovar)`, e
o hook de pré-commit bloqueia. A mudança fica aplicada e sem commit até o usuário validar o painel.
Depois do "funcionou" dele:

```bash
npm run golden:aprovar -- principal --motivo "\"<palavras dele>\", AAAA-MM-DD"
```

O commit leva o código, `tests/golden/svg.ts` e `regras/selos.json`, no mesmo dia da aprovação (a
regressão só aceita a falha do golden de `HEAD` com o desenho aprovado no dia).

**Como regravei na cópia, só para ver o resto do check:**
`npm run golden:aprovar -- principal --motivo "\"ENSAIO do planejador na cópia, não é aprovação do usuário\", 2026-11-12"`.
Depois do ensaio desfiz: `git checkout task-tree/tests/golden/svg.ts` e `regras/selos.json` de volta
ao que tinha só os selos dos testes. O diff entregue foi gerado desse estado e conferido byte a byte
(nenhuma ocorrência de `svg.ts` nem de "ENSAIO").

## 8. O que o usuário confere no app

Numa sessão com o painel aberto:

1. Tarefa em andamento, Esc: ela fica ✕ "interrompida", como hoje.
2. Sem escrever nada, deixar chegar um aviso automático (uma filha que termina o turno, um subagente
   que devolve o resultado): durante esse turno a tarefa **segue ✕**, sem ◉ e sem o tempo dela andar;
   quando o turno termina, **segue ✕**, não ◷.
3. Mandar uma mensagem que faça o modelo iniciar outra tarefa: a outra fica ◉, a parada segue ✕.
4. Pedir para retomar a parada: quando o modelo dá start nela, ela volta a ◉ e volta à contagem.
5. Cabeçalho: a parada conta em "interrompidas" e fica fora do "d de n". O tooltip não mostra "sessão
   inteira" quando não há pedido fora de vista. A linha de status embaixo da caixa de mensagem não a
   conta.
6. Um pai cujos subitens ficaram só ✓ e ✕ aparece ✓ enquanto a parada não é retomada.
7. Com sessão filha: parar a filha com Esc numa tarefa iniciada. Na mãe, o cartão diz "parada" e sai
   da contagem. Depois de a filha tratar um aviso ou outra tarefa e parar de novo, o cartão **segue
   fora da contagem**, com a tarefa ✕. Volta a contar quando a filha dá start naquela tarefa.
8. Recarga a quente com uma tarefa parada na tela (salvar um arquivo do mod): ela segue ✕.

## 9. Resultado do check, impacto e testes alterados

Binário 2.1.321, na cópia.

**Estado entregue (sem golden):**
```
ok    regras            (140 cobertas, 16 checklist; mapa sem avisos)
ok    travas
ok    selos             (206 testes, 3 arquivos do kit, 4 desenhos)
ok    validate do marketplace
ok    validate do mod
ok    tsc
FALHA plugin test       205 pass, 1 fail: golden: principal ("o desenho de principal mudou")
--    regressao         (não rodou)
```

**Ensaio (golden `principal` regravado só na cópia):**
```
ok    regras | travas | selos | validate (2) | tsc
ok    plugin test       206 pass, 0 fail
ok    regressao         196 testes de HEAD contra o código novo, 2 falharam, todas por decisão registrada
        - desenho aprovado: golden: principal
        - decisão: turnos.test.ts::o prompt seguinte ao fim do turno volta ao trabalho e o start acende a tarefa
```

**Sobre o HEAD real `9636242` + `correcao-r2-item-13.diff` + este diff** (clone no scratchpad):
`regras` ok (144 cobertas), `selos` ok (221 testes, sem regravar nada), `tsc` ok, `plugin test` 220 de
221, a única falha é `golden: principal`.

Ressalva: a máquina estava carregada pelos outros ensaios. Em duas rodadas completas anteriores
apareceram estouros dos 5 s do kit em testes que este diff não toca (`taxa.test.ts::o toks/s conta só
do primeiro chunk ao stop`; numa regressão, 5 testes de `sessoes`, `subagentes`, `turnos` e `visual`).
Rodados de novo, sozinhos e na regressão refeita à mão (testes de `HEAD` contra o código novo),
passaram todos. As rodadas finais acima saíram limpas.

**`npm run testes:alterados`:** "Testes existentes alterados desde HEAD: 1", o da seção 6 (selo
`decisao`, asserções 2 → 4); 10 novos.

**`npm run impacto`:** arquivos do mod tocados: `draw/layout.ts`, `hooks/panel.ts`, `hooks/render.tsx`,
`hooks/turn.ts`, `state/tasks.ts`, `types/index.d.ts`. Núcleo tocado (`render.tsx`, `index.d.ts`):
144 cenários afetados, e o check roda todos. Golden: os 4 desenhos. Fora do mapa: nenhum.
Para o brief, `npm run impacto -- task-tree/draw/layout.ts task-tree/hooks/turn.ts task-tree/state/tasks.ts`
lista 134 cenários.

## 10. Arquivos que o diff toca

| Arquivo | O que muda |
|---|---|
| `task-tree/types/index.d.ts` | campo `stopped` em `TaskNode` (perto da linha 38) |
| `task-tree/state/tasks.ts` | `park` (novo); `finish`, `begin` e `carry` tiram ou mantêm a marca; o import de `draw/layout` ganha `timing` |
| `task-tree/draw/layout.ts` | `interrupt`, `halt`, `anyStopped`/`stay`/`stayed` (novos), `discarded`, `panelOf`, `trail`, e a linha `const held` de `layout()` |
| `task-tree/hooks/turn.ts` | `turnComplete`: a hora do fim lida uma vez; `park` no Esc; 2 imports em linhas novas |
| `task-tree/hooks/panel.ts` | `showStatus`; 1 import em linha nova |
| `task-tree/hooks/render.tsx` | o `total` da sessão inteira; 1 import em linha nova |
| `task-tree/DESENVOLVIMENTO.md` | um item novo no fim de "Tarefas abertas de uma sessão que terminou o turno" |
| `task-tree/tests/turnos.test.ts` | 1 teste alterado, 7 novos, 2 imports e 2 declarações novas |
| `task-tree/tests/durabilidade.test.ts` | 2 testes novos, antes do bloco do resumo do done |
| `task-tree/tests/sessoes.test.ts` | 1 teste novo, antes de "Três filhas paradas" |
| `regras/turnos.md`, `durabilidade.md`, `sessoes.md`, `visual.md` | seção 5 |
| `regras/selos.json` | 1 selo `decisao`, 10 `novo` |

Fora do diff, de propósito: `task-tree/tests/golden/svg.ts` e o selo `golden`.

## 11. Onde pode colidir com os outros itens

Este item entra por último.

- **Itens 1 e 2, subagente neto, 8 e 12 (já no HEAD real `9636242`):** o diff aplica sem ajuste.
- **Item 12:** mexe na linha de import de `draw/layout` em `render.tsx`. Por isso os imports novos
  deste diff estão em linhas próprias nos três arquivos de hooks.
- **Item 13 (`correcao-r2-item-13.diff`):** aplica sem ajuste por cima. Combinação a saber: com a
  mensagem do meio do turno entrando no pedido em curso, o plan com o mesmo id passa a replanejar no
  lugar mais vezes, e nesse replano a parada mantida segue ✕ (é o teste do replano). O texto
  `PROMPT.midTurn` não fala de tarefa parada; não precisa.
- **Item 8:** a carta "não entregue" é marcada `cut`, e os três filtros novos de "carta na fila" deste
  diff usam `!s.taken && !s.cut`, como os do item 8. A parada cuja carta foi dada como não entregue
  fica ✕, não ◷.
- **Subagente sem fim vira "interrompido" (ainda sem diff nas notas quando conferi):** deve tocar
  `hooks/agents.ts`, `hooks/panel.ts` (`keptGroups`), talvez `turnComplete` em `hooks/turn.ts` e
  `tests/subagentes.test.ts`. Colisão de texto possível em `turnComplete`, perto de `settleBySubs`:
  este diff troca a linha do `turnEndedState` logo acima e acrescenta um bloco depois do
  `replanDueState`. De comportamento: quando o cartão órfão vira "interrompido", `settleBySubs` pode
  fechar de verdade a tarefa de origem, parada ou não. O fecho de verdade vale mais que a marca, e
  `begin` limpa a marca velha se a tarefa for reaberta. Não vi conflito, mas não foi ensaiado junto.
- **`regras/selos.json`:** todos os itens escrevem nele; os comandos estão na seção 6.
- **Golden:** se outro item mudar o desenho `principal`, a aprovação tem de ser uma só, depois dos
  dois. Os planos dos itens 8, 12, 13 e do neto dizem que não mudam o golden.

## 12. Riscos e limites

- **Esc dado antes da recarga do mod não tem marca.** A tarefa parada por um Esc anterior à aplicação
  segue o comportamento antigo (reacende no prompt seguinte) até o próximo Esc. Para validar, o Esc tem
  de ser dado depois de o diff estar aplicado.
- **O modelo que retoma a parada sem chamar start** deixa o painel em ✕ enquanto trabalha nela; é o
  que a decisão pede. Na mensagem seguinte ao Esc os textos já mandam usar start
  (`PROMPT.interruptedByYou`, `PROMPT.interrupted`, e a regra "para seguir numa mensagem seguinte com
  tarefas de uma anterior, use start e done"). No turno de um aviso o texto é só "start no que
  começa". **Não mexi em `text/rules.ts`** (o item 13 o edita). Se no app o modelo retomar sem start
  nos avisos, sugiro um item à parte: uma frase a mais em `PROMPT.notice`, `handback` e `background`
  quando houver tarefa parada.
- **Carta, sessão ou subagente abertos sem start depois do Esc** continuam ancorando na parada, como
  hoje (no state ela segue iniciada). Com a carta na fila a tarefa mostra ◷ e a entrega a conclui
  (regras de 2026-10-30); com sessão viva embaixo, ✕ com o tempo correndo, como já é logo depois do
  Esc.
- **Subagente que termina depois do Esc** ainda pode fechar a tarefa de origem no fim de um turno
  normal (`settleBySubs`). Não mudou; é outro achado da auditoria (médio).
- **Versões misturadas:** uma mãe com o mod antigo ignora `stopped` e mostra o comportamento antigo.
  Uma filha com o mod antigo não publica a marca, e a mãe nova cai no `aborted`, como hoje.
- **Não verificável no harness:** recarga a quente real e a pintura (item 8 da seção 8).
- **`DESENVOLVIMENTO.md`, linha 97** (diz que o `wake` só roda no pedido da pessoa e no de outra
  sessão) continua errada; a auditoria a aponta à parte e o item 13 edita essa região. Não toquei.

## 13. Para o implementador

1. `git apply correcao-r2-item-9.diff` na raiz, de uma vez (o mod recarrega a quente).
2. `npm run check`: tem de falhar só em `golden: principal`. Qualquer outra falha é para parar.
3. Sem commit. O usuário valida no app (seção 8).
4. Com as palavras dele: `npm run golden:aprovar -- principal --motivo "\"<palavras>\", AAAA-MM-DD"`.
5. `npm run check` inteiro ok; commit local dos arquivos da seção 10 mais `tests/golden/svg.ts`.
   Sugestão: `fix(task-tree): tarefa parada com Esc segue interrompida até o start nela`.
6. Relato com `npm run testes:alterados` e `npm run impacto`.
