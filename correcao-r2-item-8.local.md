# Carta na fila e sessão destino arquivada: carta cinza "não entregue" (rodada 2)

Data: 2026-11-12. Base do ensaio: `b02a9a9` + `correcao-r2-itens-1-2.diff` (commit local `98d92f7` na
cópia). Ensaio numa cópia no scratchpad; o repositório real não foi tocado.

## Resumo

- **Diff pronto, sem bloqueio:** `<notas>\correcao-r2-item-8.diff`
  (`git apply --check` ok num clone da base; ok também depois de `correcao-r2-subagente-neto.diff`).
  O commit `c62ee43` do repositório (itens 1 e 2) tem a mesma árvore da base do ensaio, e o diff
  aplica nele sem ajuste.
- **`npm run check` na cópia: tudo ok.** 200 testes passam (196 da base + 4 novos); a regressão roda os
  196 testes da base contra o código novo, 0 falhas.
- **Nenhum teste existente mudou** (`testes:alterados`: nenhum). Nenhum selo `decisao` é necessário.
- **O golden não muda** (confirmado, ver a seção própria): `tests/golden/svg.ts` fora do diff e os 4
  testes de golden passam.
- A parte A (entrega conferida com a lista em erro) já está no `ee8d8f0` e não entra aqui.

## Decisão do usuário

2026-11-12, palavras dele: "Cinza \"não entregue\" (Recomendado)".

Significado: carta cinza "não entregue", sem tempo e fora do chip "aguardando sessão"; a tarefa volta a
ser comum (no Esc fica ✕), o relógio para e o modelo é avisado uma vez; se a sessão for desarquivada
antes de tomar a mensagem, a carta volta a azul "na fila".

## Causa confirmada no código (base)

Um envio na fila só sai desse estado quando a sessão destino toma a mensagem. Com o destino arquivado,
isso nunca acontece, e nada no código olha `isArchived` para os envios:

- `hooks/sessions.ts`, `watchSends` (linhas 106 a 171): marca só `taken` (recibo publicado pelo
  destino, ou turno dele depois do envio) e `idle`. A linha da lista do app traz `isArchived`
  (`io/host.ts:19`), mas `watchSends` não a lê.
- `hooks/sessions.ts:270`, `anyRunning`: `sends.some(s => !s.taken)` mantém o relógio de 1 s ligado
  para sempre (redesenho e leitura do git a cada segundo).
- `draw/layout.ts:978` e `983`: a tarefa do envio fica poupada do Esc (◷) e a carta conta no chip
  "aguardando sessão", sem prazo.
- `draw/layout.ts:719`, `openInSight`: a carta segura o pedido à vista, sem prazo.
- `hooks/tools.ts:169`: o `done` da tarefa avisa "ainda está na fila" toda vez.
- O campo `cut` de `Send` (`types/index.d.ts:210`) já é lido em `layout.ts` (154, 978, 983, 1244,
  1292) e em `agents.ts:188`, mas nenhum código o grava na base: a carta cinza de hoje vem só da
  tarefa interrompida pelo plano (`cutHere`).

## O que mudou em relação ao ensaio anterior (`correcao-alto-8-recomendada.diff`)

O código do ensaio anterior aplica sem conflito na base atual (os commits que entraram depois e os
itens 1 e 2 só deslocaram linhas). Revisado contra a base, mudou:

1. **Correção nova:** a mensagem tomada depois de dada como "não entregue" (o recibo do destino chega
   com a sessão ainda arquivada) ficava verde e concluía a tarefa, mas o modelo não era avisado,
   porque o envio já estava marcado como avisado. Agora o aviso de entrega vai (`noted: false` nesse
   caminho). Tem teste.
2. **Testes:** de 2 para 4, com nomes sem aspas internas (o comando de selo fica simples). Os dois
   novos cobrem o `done` sem aviso de fila com a entrega tardia, e o pedido que deixa de ficar à
   vista.
3. **Catálogo:** origem preenchida com as palavras e a data; `Reescrito:` em
   `envios.fica-ate-entrega`, `envios.cor-por-estado` e `envios.carta-sob-a-tarefa`; cenário de
   checklist `envios.destino-arquivado-no-app`; o `Código:` do cenário novo ganhou `hooks/tools.ts`.
4. **Marcadores "decisão pendente":** trocados pelas palavras e pela data no catálogo, nos selos e no
   comentário do código.
5. **Golden:** o plano anterior dizia "nenhum dos 3 cenários tem carta". Está errado no motivo: são 4
   cenários e o `envios` tem 3 cartas. A conclusão continua certa (ver abaixo).

## Passos (o que o diff faz)

1. `types/index.d.ts`: `Send` ganha `lost?: boolean`, gravado sempre junto com `cut`. Campo opcional:
   vai ao store e ao arquivo publicado sem subir versão. Uma sessão mãe com versão antiga do mod lê só
   o `cut` e desenha a carta cinza "interrompida".
2. `hooks/sessions.ts`:
   - `watchSends`: depois dos recibos, um passo novo. Para cada envio ainda não tomado, quando todas
     as linhas da lista com o mesmo id ou nome estão arquivadas, marca `{ cut: true, lost: true }`.
     Quando alguma deixa de estar arquivada e o envio estava `lost`, marca
     `{ cut: false, lost: false, noted: false }`: volta a esperar e o modelo pode ser avisado de novo.
     Tomado nesse meio-tempo: `{ taken: true, cut: false, lost: false, noted: false }`.
     Destino fora da lista, ou lista em erro (chega vazia, pela parte A), não é julgado.
   - `takenNote`: avisa uma vez os `lost` ainda não avisados (`SESSION.lost`) e marca `noted`; junta
     com o aviso de entrega quando há os dois.
   - `anyRunning`: `!s.taken && !s.cut`, para o relógio de 1 s parar.
3. `draw/layout.ts`:
   - `MsgState` ganha `'lost'`; `MSG_WORD.lost = 'não entregue'`.
   - A carta: `s.lost ? 'lost' : …` (o resto como antes). Sem tempo, porque só a carta na fila tem.
   - `openInSight`: `!s.cut`, a carta não entregue não segura o pedido à vista.
   - O Esc, o chip e a espera da tarefa já ignoravam `cut` (linhas 978, 983, 1244): nada a mudar.
4. `draw/svg.ts`: `MSG_CLASS.lost = 'gy'` e `MSG_TERM.lost = 'inactive'`, o mesmo cinza da carta
   interrompida. Nenhuma classe ou estilo novo.
5. `hooks/tools.ts`: o aviso do `done` ("ainda está na fila") passa a usar `!s.cut`.
6. `text/rules.ts`: `SESSION.lost(what)`: "mensagem não entregue, a sessão foi arquivada com ela ainda
   na fila: …. A tarefa do envio deixou de esperar por ela; trate-a como qualquer outra tarefa
   (mcp__task-tree__done quando concluída)."
7. `regras/envios.md`, `tests/envios.test.ts`, `regras/selos.json`: abaixo.

Todos os arquivos do mod vão de uma vez (o clone recarrega a quente): `git apply` do diff inteiro, e
`npm run check` antes do commit.

## Cenários

- **Novo, coberto:** `envios.destino-arquivado-nao-entregue`. Origem: decisão do usuário, 2026-11-12
  ("Cinza \"não entregue\" (Recomendado)"). Então: carta cinza "não entregue", sem tempo, fora do chip;
  a tarefa volta a ser comum (Esc ✕; `done` sem aviso de fila; concluída, não segura o pedido à
  vista); modelo avisado uma vez; desarquivada, volta a azul "na fila" e a tarefa volta a esperar;
  tomada mesmo assim, verde e o modelo é avisado da entrega.
- **Novo, checklist:** `envios.destino-arquivado-no-app` (sessão real arquivada; relógio e pintura).
- **Reescritos** (`Reescrito: 2026-11-12, decisão do usuário ("Cinza \"não entregue\" (Recomendado)")`),
  sem mudança nos testes deles:
  - `envios.fica-ate-entrega`: a carta fica azul até a entrega só enquanto a mensagem ainda pode ser
    entregue.
  - `envios.cor-por-estado`: o cinza vale também para a carta não entregue, com a palavra própria.
  - `envios.carta-sob-a-tarefa`: a linha ganha a palavra "não entregue", sem tempo e fora do chip.
- **Sem `Reescrito:`, citados na origem do cenário novo como limitados por ele:**
  `envios.fila-nao-interrompe-no-fim-do-turno` e
  `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`. O texto deles segue verdadeiro ao pé
  da letra ("enquanto a carta está na fila").

## Testes (todos novos, em `task-tree/tests/envios.test.ts`, `// Regra: envios.destino-arquivado-nao-entregue`)

1. `a sessão destino arquivada com a carta na fila: carta cinza não entregue, sem tempo e fora do chip; o modelo é avisado uma vez e o Esc interrompe a tarefa`
2. `a sessão destino desarquivada antes de tomar a mensagem: a carta volta a azul, na fila, a tarefa volta a esperar e a entrega a conclui`
3. `carta não entregue: o done da tarefa não avisa de fila; tomada mesmo assim, fica verde e o modelo é avisado da entrega`
4. `carta não entregue não segura o pedido à vista: com tudo concluído, o pedido novo fica só`

- Os 4 falham na base (rodados contra `98d92f7`: 196 passam, 3 falham; o quarto foi conferido
  tirando só o `!s.cut` do `openInSight`) e passam com a correção.
- Conferido por mutação: sem o `!s.cut` do `done`, o teste 3 falha no aviso de fila; sem o
  `noted: false` da entrega tardia, o teste 3 falha no aviso de entrega; sem o `!s.cut` do
  `openInSight`, o teste 4 falha.
- Não coberto pelo harness: o `!s.cut` do `anyRunning` (o relógio de 1 s). Vai ao checklist.
- O kit não mudou. O cinza é lido como `interrompida` (a cor `inactive`) e a palavra é conferida no
  texto da linha.
- O import ganhou `type Filha`; três declarações de topo novas (`cartaDe`, `NAO_ENTREGUE`,
  `contexto`), usadas só pelos testes novos (o selo dos existentes não muda).

## Comandos de selo (Git Bash, na raiz do repositório)

Se `regras/selos.json` colidir, aplique o diff com `git apply --exclude=regras/selos.json` e rode:

```bash
M='decisão do usuário, 2026-11-12: "Cinza \"não entregue\" (Recomendado)"; auditoria 2026-11-10: carta na fila sem saída com a sessão destino arquivada'
npm run regras:selar -- "task-tree/tests/envios.test.ts::a sessão destino arquivada com a carta na fila: carta cinza não entregue, sem tempo e fora do chip; o modelo é avisado uma vez e o Esc interrompe a tarefa" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/envios.test.ts::a sessão destino desarquivada antes de tomar a mensagem: a carta volta a azul, na fila, a tarefa volta a esperar e a entrega a conclui" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/envios.test.ts::carta não entregue: o done da tarefa não avisa de fila; tomada mesmo assim, fica verde e o modelo é avisado da entrega" --tipo novo --motivo "$M"
npm run regras:selar -- "task-tree/tests/envios.test.ts::carta não entregue não segura o pedido à vista: com tudo concluído, o pedido novo fica só" --tipo novo --motivo "$M"
```

- Rodados assim na cópia (a variável `M` em aspas simples guarda as aspas das palavras dele).
- Hashes esperados, na ordem: `57583c91834d0c56` (11 asserções), `6a405bf5bc4817fa` (7),
  `c9486d03627c776e` (6), `8fb262a54a2a0966` (4).
- Nenhum selo `decisao` nem de kit.

## Resultado do check na cópia

```
regras: 138 cobertas, 0 pendentes, 17 checklist (155 no total)
mapa: 138 cobertos com código, 0 avisos
selos: 200 testes, 3 arquivos do kit, 4 desenhos
plugin test: 200 pass, 0 fail (15 arquivos)
regressão: 196 testes de HEAD contra o código novo, 0 falharam

ok    regras
ok    travas
ok    selos
ok    validate do marketplace
ok    validate do mod
ok    tsc
ok    plugin test
ok    regressao
```

Binário: o do app desktop, 2.1.321. O `validate` não gerou `task-tree/.claude-plugin/types/` na
cópia; a pasta foi copiada do repositório real, como o brief previa.

## `npm run testes:alterados`

```
Testes existentes alterados desde HEAD: nenhum
Novos: (os 4 testes acima)
```

## Impacto

`npm run impacto -- task-tree/types/index.d.ts task-tree/hooks/sessions.ts task-tree/hooks/tools.ts task-tree/draw/layout.ts task-tree/draw/svg.ts task-tree/text/rules.ts`
e `npm run impacto` sobre o diff dão o mesmo:

```
Arquivos do mod tocados: draw/layout.ts, draw/svg.ts, hooks/sessions.ts, hooks/tools.ts, text/rules.ts, types/index.d.ts
Núcleo tocado (types/index.d.ts): todos os cenários cobertos (o check roda todos)
Cenários afetados (155)
Checklist do app: (todos os de checklist, com envios.destino-arquivado-no-app)
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
```

## Golden do SVG: não muda (confirmado)

- `tests/golden.test.ts` tem 4 cenários. O `envios` desenha 3 cartas ("na fila", "entregue" e a
  cortada pelo Esc), todas para uma sessão que nunca é arquivada. Nenhum cenário cai no estado novo.
- O estado novo reusa a classe cinza que já existe (`gy`): nenhum estilo entra no desenho.
- Prova: os 4 testes de golden passam no check e `tests/golden/svg.ts` não está no diff. Não é
  preciso `golden:aprovar`.

## Riscos

- **Comportamento do app não confirmado:** o plano assume que a sessão arquivada segue na lista do
  app com `isArchived: true` (é como o cartão "arquivada" já funciona) e que, desarquivada, a
  mensagem segue na fila. Se o app descartar a fila ao arquivar, a carta volta a azul na
  desarquivação e fica azul sem saída, como hoje. Só o app mostra.
- **Lista parcial ou em erro:** o destino que não aparece na lista não é julgado e segue "na fila".
  O achado da auditoria para o destino que some da lista continua aberto (fora desta decisão).
- **Nome repetido:** com duas sessões de mesmo nome, só vira "não entregue" se todas estiverem
  arquivadas.
- **Tempo "—":** no terminal a carta "não entregue" mostra "—" no lugar do tempo, como as cartas
  "entregue" e "interrompida" já mostram hoje.
- **Carta de tarefa que saiu do plano:** a carta não entregue de uma tarefa que um replano tirou
  fica sob o nível 1 do pedido, cinza, como a carta na fila ficava azul. Não foi mexido.
- **Ordem com o item da tarefa parada com Esc depois de aviso automático:** o teste 2 só afirma ◷
  depois de um Esc com a carta azul e sem Esc anterior, o mesmo roteiro do teste já selado de
  `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`. Se aquele item mudar esse roteiro,
  os dois testes mudam juntos.
- **`DESENVOLVIMENTO.md`** não foi atualizado (os commits recentes de correção também não o tocam).

## Checklist do app (validação visual, depois do commit local)

1. Com uma filha real ocupada, mandar uma mensagem que fique na fila; arquivar a filha antes de ela
   tomar a mensagem. Em poucos segundos: carta cinza "não entregue", sem tempo, chip "aguardando
   sessão" sem ela. Nos dois temas.
2. O tempo do painel para de contar (relógio parado) quando não há mais nada em andamento.
3. No próximo turno, o modelo recebe uma vez "mensagem não entregue…".
4. Esc com a carta "não entregue": a tarefa fica ✕, não ◷.
5. Desarquivar a filha antes de ela tomar a mensagem: a carta volta a azul "na fila" com o tempo de
   espera; quando ela tomar, verde e a tarefa concluída.

## Arquivos que o diff toca (para prever colisões)

- `regras/envios.md`: uma linha `Reescrito:` e o `Então` em `envios.fica-ate-entrega`,
  `envios.cor-por-estado` (logo depois do `Reescrito:` dos itens 1 e 2) e `envios.carta-sob-a-tarefa`;
  dois cenários novos no fim do arquivo.
- `regras/selos.json`: 4 chaves novas de `envios.test.ts`.
- `task-tree/tests/envios.test.ts`: a linha do import de `./kit/ambiente` e o fim do arquivo.
- `task-tree/hooks/sessions.ts`: `watchSends`, `takenNote`, `anyRunning`.
- `task-tree/draw/layout.ts`: `openInSight` (1 linha), `MsgState`/`MSG_WORD`, o estado da carta (1 linha).
- `task-tree/draw/svg.ts`: `MSG_CLASS`, `MSG_TERM`.
- `task-tree/hooks/tools.ts`: 1 linha no `doneTool`.
- `task-tree/text/rules.ts`: `SESSION.lost` e o comentário acima de `SESSION`.
- `task-tree/types/index.d.ts`: o tipo `Send`.

## Commit sugerido

`fix(task-tree): carta cinza "não entregue" quando a sessão destino é arquivada com ela na fila`

## Fora deste plano

- Destino que some da lista (apagado, ou dado por um nome sem linha) e envio fora do app desktop.
- A recarga zera a memória dos recibos já usados (achado médio separado).
