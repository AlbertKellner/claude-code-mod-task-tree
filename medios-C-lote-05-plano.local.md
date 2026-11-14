# Lote 05 (triagem C): processo morto no meio do turno, a tarefa em andamento volta ✕

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Processo novo com o turno gravado como 'em curso' (app fechado ou morto no meio do turno)
  desenha ◉ e roda o relógio sem turno nenhum".
- Decisão 33: "✕ interrompida" (a opção: "✕ interrompida, fora da contagem, até um novo start nela,
  como depois do Esc"). Foge da recomendação da triagem (◷): vale a resposta.

## 2. Causa confirmada na ponta

- Escrito, `hooks/panel.ts:32-38` (`wake`): o fim do turno só vai ao store quando havia um fim gravado
  (`turnEnded` numérico); no primeiro turno da sessão nada é gravado, e nos seguintes o registro `turn`
  fica com `ended: null` enquanto o turno roda.
- Escrito, `hooks/turn.ts:146-168`: só o `turn.complete` grava o fim; se o processo morre, ele não roda.
- Escrito, `hooks/panel.ts:95-106` (`restoreTurn`) e `hooks/session-start.ts:56-61`: o processo novo
  traz o painel e o registro como estão; com `ended: null` (ou sem registro), `turnEnded` fica vazio, e
  o desenho trata o turno como em curso: a tarefa iniciada fica ◉ e o relógio de 1 s roda
  (`hooks/sessions.ts:296-309`).
- Dedução: num processo novo o `session.start` roda antes de qualquer prompt, então não há turno em
  curso nesse instante; o que o store diz estar em curso morreu com o processo anterior.

## 3. O que muda

`hooks/session-start.ts` (`sessionStart`, depois de trazer o painel e o fim do turno) e
`hooks/panel.ts` (uma função nova, chamada dali e do ramo `resume` de `classicSessionStart`):

- Só quando o painel acabou de vir do store para um state vazio (processo novo), ou numa retomada:
  se o registro do turno diz "em curso" (`ended: null`) ou não existe, e o grupo principal tem tarefa
  aberta iniciada (uma folha com start e sem fim, ou um pai iniciado), o turno é dado como parado:
  - as tarefas do grupo principal passam pelo mesmo `park` que o Esc aplica (`state/tasks.ts:73-79`):
    a folha iniciada ganha a marca da parada e o relógio para; as pendentes seguem ○;
  - o instante da parada é o último que o painel conhece (o maior `startedAt`, `endedAt`, `plannedAt`
    e `at` de turno do grupo principal), não a hora da reabertura: o relógio não soma o tempo com o
    app fechado;
  - `turnEnded` recebe esse instante, `turnAborted` e `replanDue` ficam verdadeiros, e tudo vai ao
    store (o painel pelo `change`, o registro pelo `saveTurn`).
- Sem tarefa iniciada aberta, nada muda (o painel volta como hoje).
- O caminho do primeiro uso (`ensureTurn`, `ensureGroups`: worker que voltou sem `session.start`) não
  aplica a regra: ali o turno pode estar vivo, e a próxima chamada do loop principal segue nele.

Em termos do painel: ao reabrir o app depois de fechá-lo (ou de o processo morrer) no meio de um
turno, a tarefa que estava ◉ aparece ✕ "interrompida", fora do x/y, com o relógio parado, e nada fica
◉; ela só volta a ◉ com um start nela (o done a conclui sem start), como depois do Esc. A mensagem
seguinte recebe o pedido de replanejar, como depois do Esc (dedução do "como depois do Esc": o texto do
lembrete é o que já existe, "o usuário interrompeu o turno anterior antes de terminar"; nenhum texto
novo). No cartão desta sessão na mãe, a rodada conta como a de uma filha parada com Esc (o arquivo
publicado passa a dizer `aborted`).

## 4. Impacto

`npm run impacto -- hooks/session-start.ts hooks/panel.ts state/durability.ts`: 69 cenários
(durabilidade 9, envios 17, turnos 14, pedidos 14, perguntas 8 e outros, por `hooks/panel.ts`).
Checklist: `envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/durabilidade.test.ts`)

Pares 1/2 e 2/2 com `armazem`, como os de "fim do turno no reinício" (linhas 253-326):
- "processo morto no meio do primeiro turno, 1/2: a tarefa fica em andamento no store" e "…, 2/2: o
  processo novo a desenha interrompida até o start nela". Regra:
  `durabilidade.turno-em-curso-no-reinicio-fica-interrompido`. O 1/2: pedido, plan A, start `1`, done
  `1`, start `2.1`, sem fim de turno. O 2/2: `iniciarSessao`; afirma "Dois.um" interrompida, "Dois.dois"
  pendente, nada em andamento (o helper `semAndamento` do arquivo), o cabeçalho sem a interrompida no
  total; depois pedido e start `2.2` (em andamento, "Dois.um" segue interrompida) e start `2.1` (volta a
  andamento). Falha hoje: "Dois.um" volta ◉.
- "processo morto num turno seguinte, 1/2" e "…, 2/2": o mesmo com um primeiro turno terminado antes
  (o registro do store fica `ended: null`). Falha hoje pelo mesmo motivo.
- "processo morto no meio do turno: a mensagem seguinte pede para replanejar": no 2/2 de um dos pares,
  o contexto do `pedido` contém "replaneje o painel" (como `lembretes.test.ts:34-44`). Mesma regra.
- "respawn sem session.start com o turno em curso segue em andamento": par com `armazem`, sem
  `iniciarSessao` no 2/2: o primeiro desenho mostra a tarefa em andamento, e um start em outra segue
  normal. Protege o limite do item 3 (passa hoje; entra como teste novo da mesma regra).
- Testes existentes: nenhum muda. Os pares "fim do turno no reinício/respawn/Esc" e "parada com Esc no
  reinício" terminam o turno antes do reinício e seguem valendo.

## 6. Catálogo (`regras/durabilidade.md`) e selos

Novo, `coberto`:

```markdown
### durabilidade.turno-em-curso-no-reinicio-fica-interrompido
O app fechado, ou o processo morto, no meio de um turno deixa a tarefa em andamento interrompida.

- Dado um turno em curso com uma tarefa iniciada e aberta, e o processo que morre sem terminar o turno (o app fechado, o processo morto)
- Quando um processo novo abre a sessão (session.start, ou a retomada dela)
- Então a tarefa que estava em andamento aparece ✕ "interrompida", fora do x/y, com o relógio parado no último instante que o painel conhece; as pendentes seguem ○ e nada fica ◉; ela só volta a andamento com start nela, e o done a conclui sem start; a mensagem seguinte traz o pedido de replanejar, como depois do Esc; o processo que volta sem session.start, com o turno ainda vivo, segue em andamento

Origem: decisão do usuário, 2026-11-14 ("✕ interrompida"), à pergunta "Se o app fechar, ou o processo morrer, no meio de um turno, como deve aparecer, ao reabrir, a tarefa que estava em andamento?"; aplica turnos.parada-segue-interrompida-ate-o-start.
Código: hooks/turn.ts, state/tasks.ts, draw/layout.ts
Estado: coberto
```

O cenário `durabilidade.fim-do-turno-sobrevive-ao-reinicio` não muda (cobre o turno que terminou antes
do reinício).

Selos: `npm run regras:selar -- "task-tree/tests/durabilidade.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: processo morto no meio do turno fica ✕ interrompida"`, um por teste novo.

## 7. Documentação

- `state/durability.ts`, notas das linhas `turnEnded`, `turnAborted` e `replanDue` da `TABLE`: dizer
  que um registro "em curso" achado por um processo novo vira parada.
- `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda (nenhum roteiro do golden reinicia o processo).

## 9. Checklist do app

- Com uma tarefa ◉ e o turno rodando, fechar o app; reabrir a sessão: a tarefa aparece ✕
  "interrompida", o relógio parado, a faixa do cabeçalho sem "em andamento".
- Trocar o modelo com `/model` no meio de um turno (reinicia o processo): mesmo resultado.
- Mandar a mensagem seguinte: o modelo replaneja ou dá start na tarefa.

## 10. Dependências e conflitos

- Depois do lote 04 (mesmos trechos de `session-start.ts` e `restoreTurn`).
- Limite conhecido, ligado ao achado não confirmado "a recarga roda `session.start`": se uma medição
  futura mostrar que o `session.start` roda também quando só o worker dos hooks volta, com o state
  vazio e o turno vivo, esta regra marcaria ✕ uma tarefa de turno vivo. Não há sinal no evento que
  diga se há turno em curso (conferido nos tipos da 2.1.321: `SessionStartInput` só traz `cwd`,
  `surface` e `isInteractive`). Fica registrado; não se resolve aqui.
- Triagem A, lote 09 (turno que morre por erro: ✕ "falhou") e lote 07 (a ◷ segue ◷ até o start):
  mexem em `hooks/turn.ts`, `state/tasks.ts` e nas mesmas marcas da tarefa. A função nova daqui usa o
  `park` como estiver na hora; se o lote 09 de A criar uma marca própria de "falhou", a daqui continua
  sendo a da parada.
- Triagem A, lote 21 (fim do turno no arquivo publicado): se já tiver entrado, o registro publicado
  leva também esta parada (é o mesmo `turnEnded`).

## 11. Bloqueio

Nenhum.
