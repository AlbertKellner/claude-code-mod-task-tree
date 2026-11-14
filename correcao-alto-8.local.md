# Correção do achado alto 8: carta na fila sem saída quando a sessão destino é arquivada

Data: 2026-11-11. Base: branch `fix/achados-altos-auditoria`, HEAD `72384ff`. Ensaio numa cópia
(clone em scratchpad); o repositório não foi alterado.

## Resumo

- **BLOQUEIO** (pergunta 17 da auditoria): o que o painel mostra quando a sessão destino é
  arquivada com a carta ainda na fila. As decisões de 2026-10-23 e 2026-10-30
  (`envios.fica-ate-entrega`: "deixe como mensagem até ela ser entregue") mandam a carta ficar azul
  até a entrega. Dar fim à carta muda essa regra, por isso precisa da sua resposta.
- **Parte A, entra sem decisão:** `correcao-alto-8.diff`. Com a lista de sessões do app em erro,
  o envio não era conferido (`refreshChildren` saía antes do `watchSends`). Agora a entrega publicada
  pelo destino é confirmada mesmo assim. Isso aplica `envios.fica-ate-entrega` ("na entrega, verde,
  e o painel conclui a tarefa que enviou") e não muda nenhuma regra.
- **Parte B, depois da resposta (opção recomendada):** `correcao-alto-8-recomendada.diff`, que se
  aplica sobre a A.
- As duas partes juntas passam no `npm run check -- --base 72384ff`: todas as etapas ok,
  189 testes, e a regressão roda os 186 testes de `72384ff` contra o código novo sem nenhuma falha.
  Nenhum teste selado mudou, o golden não mudou (`testes:alterados`: nenhum existente alterado).

## Pergunta exata ao usuário

> Quando a sessão destino é arquivada com a carta ainda na fila, o que o painel deve mostrar?
> 1. Carta cinza "não entregue", sem tempo e fora do chip "aguardando sessão". A tarefa volta a
>    ser comum (no Esc fica ✕, como qualquer outra), o relógio para e o modelo é avisado uma vez.
>    Se a sessão for desarquivada antes de tomar a mensagem, a carta volta a azul "na fila"
>    (Recomendada).
> 2. A carta some.

A resposta vira a origem do cenário `envios.destino-arquivado-nao-entregue` (data e palavras
suas).

## Parte A: entrega com a lista de sessões em erro (sem decisão)

Arquivos: `task-tree/hooks/sessions.ts`, `task-tree/tests/envios.test.ts`, `regras/envios.md`,
`regras/selos.json`.

1. `npm run impacto -- task-tree/hooks/sessions.ts`: 33 cenários (envios, sessoes, durabilidade).
   É só orientação, porque o check roda tudo.
2. `hooks/sessions.ts`, `refreshChildren`: o `watchSends` passa para logo depois do
   `listSessions`, antes do retorno por erro. Com erro, ele recebe `[]`: a sessão que publica
   `received` confirma pelo arquivo, quando `to` é `local_…`. Sem linha, nada é marcado `idle`.
   ```ts
   const listed = await listSessions($)
   const rows = 'error' in listed ? undefined : listed.rows
   await watchSends($, Array.isArray(rows) ? rows : [])
   // ...linha de erro como antes...
   if (!Array.isArray(rows)) return
   ```
3. Cenário novo em `regras/envios.md`: `envios.entrega-com-lista-de-sessoes-em-erro`, com estado
   coberto, `Código: hooks/sessions.ts` e origem "auditoria 2026-11-10; aplica
   envios.fica-ate-entrega".
4. Teste novo em `envios.test.ts`, com `// Regra: envios.entrega-com-lista-de-sessoes-em-erro`.
   Um stub `on('mcp.call', { tool: 'list_sessions' })` é registrado antes do `host()` e devolve
   `isError` quando é ligado. A sequência é envio → lista em erro → `recebeu` → `aviso`. Ele afirma
   a carta "entregue", `feitas/total = [1, 2]` e o chip "aguardando sessão" = 0.
   - No HEAD ele falha (a carta fica "na fila" e o chip ✉ fica em 1). Com a correção, passa.
   - Nota: o cartão "Sessão…" fica abrindo porque a lista está em erro e segura "Um" ◉
     (`sessoes.filha-trabalhando-mantem-pais-em-andamento`). Por isso a conclusão é afirmada pela
     contagem, não pelo ícone.
5. Selo: `npm run regras:selar -- "task-tree/tests/envios.test.ts::com a lista de sessões em erro, a entrega publicada pela sessão deixa a carta verde e conclui a tarefa" --tipo novo --motivo "auditoria 2026-11-10: carta na fila sem saída com a lista em erro"`.
6. `npm run check` no ensaio: tudo ok, 187 testes, regressão de 186 testes de HEAD sem falha.
7. Commit sugerido: `fix(task-tree): a entrega da carta na fila é conferida mesmo com a lista de sessões em erro`.

Diff: `<notas>\correcao-alto-8.diff`
(confirmado com `git apply --check` no repositório).

## Parte B: destino arquivado (depois da resposta; opção 1)

Arquivos: `types/index.d.ts` (núcleo), `hooks/sessions.ts`, `draw/layout.ts`, `draw/svg.ts`,
`hooks/tools.ts`, `text/rules.ts`, `tests/envios.test.ts`, `regras/envios.md`, `regras/selos.json`.

1. `npm run impacto -- task-tree/types/index.d.ts task-tree/hooks/sessions.ts task-tree/draw/layout.ts task-tree/draw/svg.ts task-tree/hooks/tools.ts task-tree/text/rules.ts`:
   o núcleo foi tocado, então todos os cenários cobertos entram.
2. `types/index.d.ts`: `Send` ganha `lost?: boolean`, sempre gravado junto com `cut`. O campo é
   opcional e vai ao store e ao arquivo publicado sem subir a versão.
3. `hooks/sessions.ts`:
   - `watchSends`: depois dos recibos, um passo novo. Para cada envio ainda não tomado, quando
     todas as linhas da lista com o mesmo id ou nome estão arquivadas, marca `{ cut: true, lost: true }`.
     Quando alguma linha deixa de estar arquivada e o envio estava `lost`, marca
     `{ cut: false, lost: false, noted: false }`: ele volta a esperar e o modelo pode ser avisado de
     novo. Um envio tomado limpa o `lost`. Destino fora da lista não é julgado, porque a lista pode
     ser parcial.
   - `anyRunning`: `!s.taken && !s.cut`, para o relógio de 1 s parar.
   - `takenNote`: avisa uma vez os `lost` ainda não avisados (`SESSION.lost`) e marca `noted`.
4. `draw/layout.ts`:
   - `MsgState` ganha `'lost'`, com `MSG_WORD.lost = 'não entregue'`.
   - A carta faz `s.lost ? 'lost' : …`.
   - `openInSight` passa a usar `!s.cut`: a carta cinza não segura o pedido na visão, como a carta
     cinza de plano interrompido.
   - O resto do desenho já ignorava `cut`: halt, chip, `settle`, tempo.
5. `draw/svg.ts`: `MSG_CLASS.lost = 'gy'` e `MSG_TERM.lost = 'inactive'`, o mesmo cinza do `cut`.
6. `hooks/tools.ts`: o aviso do `done` ("ainda está na fila") passa a usar `!s.cut`.
7. `text/rules.ts`: `SESSION.lost(what)`, com o texto "mensagem não entregue, a sessão foi
   arquivada com ela ainda na fila: …; a tarefa do envio deixou de esperar por ela…".
8. Cenário `envios.destino-arquivado-nao-entregue` em `regras/envios.md`, estado coberto. **Antes
   do commit, preencha a Origem** (hoje está "AAAA-MM-DD", "<palavras dele>") com a data e as
   palavras da resposta.
9. Dois testes novos em `envios.test.ts`, ambos com `// Regra: envios.destino-arquivado-nao-entregue`
   (o import ganha `type Filha`):
   - Arquivada: envio → `x.arquivada = true` → `aviso`. Ele afirma o aviso "mensagem não entregue"
     no contexto, a carta cinza com o texto "não entregue", o chip "aguardando sessão" = 0, a
     ausência de um segundo aviso, e depois do Esc a tarefa "Um" ✕.
   - Desarquivada: arquiva → `aviso` → desarquiva → `aviso`. Ele afirma a carta de novo "na fila"
     e o chip = 1.
   - Os dois falham com o código da parte A e passam com a B.
   - O kit não mudou: o cinza é lido como `interrompida` (`CARTAS.inactive`), e a palavra é
     conferida no texto.
10. Selos `--tipo novo` para os dois testes. No ensaio, o motivo diz "decisão pendente". Sele de
    novo com as palavras da resposta, o que dá para fazer porque a chave não existe em HEAD.
11. `npm run check -- --base 72384ff` com A+B: tudo ok, 189 testes, regressão de 186 testes de
    `72384ff` sem falha. O golden não muda, porque nenhum dos 3 cenários tem carta.
12. Checklist do app: carta cinza "não entregue" nos dois temas, arquivando uma filha real com uma
    mensagem na fila, e o relógio parado.

Diff: `<notas>\correcao-alto-8-recomendada.diff`
(sobre a parte A; testado com `git apply --check` depois da A num clone do HEAD).

### Se a resposta for "a carta some"

No `watchSends`, o envio com destino arquivado sai de `sends` em vez de ganhar `cut/lost`. Nesse
caso não há `MsgState` novo nem mudança em `svg.ts`; o `!s.cut` em `anyRunning`, `openInSight` e
`tools.ts` deixa de ser necessário, e o aviso ao modelo continua (com o texto ajustado). Os testes
afirmam `cartaSob(p, 'Um') === undefined`, e a desarquivação não traz a carta de volta. Para isso
seria preciso refazer o ensaio da parte B.

## Fora deste plano (seguem do achado, sem decisão ou sem fato do app)

- **Destino que some da lista** (apagado, ou dado por um nome sem linha) e **envio fora do app
  desktop**. Para dar fim a esses, é preciso separar a lista parcial do host da sessão apagada
  (`keptLinks` em `panel.ts`) e confirmar no app o que acontece com a fila. A parte B só julga
  pelo que a lista mostra.
- `DESENVOLVIMENTO.md:807` descreve a ordem antiga ("erro/limpa erro → `watchSends`"). A linha 161
  ("`watchSends` antes de qualquer retorno") passa a valer. Documentação depende da pergunta 37 e
  da memória "sem docs".
- A recarga zera `usedReceipts` (achado médio separado): não foi tocada.
