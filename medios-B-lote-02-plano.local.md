# Lote 02: carta e cartão sob a tarefa em andamento

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "Com uma tarefa em andamento, a carta e o cartão vão para a pendente planejada depois dela".
- Decisão 19 (B), 2026-11-14: "Sob a em andamento (Recomendado)". Desfaz o pedido registrado no
  `DESENVOLVIMENTO.md` ("o segundo painel de implementacao deveria estar abaixo da tarefa de tooltip
  completo, foi ele quem enviou a mensagem de solicitação").

## 2. Causa confirmada na ponta

`hooks/panel.ts:274-286`, o fim de `sendAnchor`. Com uma tarefa em andamento, `current(list).anchor` dá
a tarefa em andamento (`:255-256`), e o trecho final percorre as folhas abertas: qualquer uma ainda não
iniciada e planejada depois do start da tarefa em andamento (`plannedAt` maior que o `startedAt` dela)
toma o lugar, a planejada por último entre elas. Os três chamadores usam a função: a carta
(`hooks/tool-call.ts:119`), a sessão aberta (`hooks/sessions.ts:244`) e o subagente
(`hooks/agents.ts:48-53`). O comentário `hooks/panel.ts:193-194` descreve o ramo ("unless an open task
was planned after it was started"). Escrito no código. Sem cenário nem teste: uma varredura dos testes
(start, depois plan do loop principal, depois envio, sessão ou lançamento no mesmo turno) não achou
nenhum que passe por esse ramo; a etapa `regressao` do check confirma.

## 3. O que muda

- `hooks/panel.ts`, `sendAnchor`: sai o trecho final (o laço sobre as folhas planejadas depois). Com
  algo em andamento e nenhum dos casos anteriores decidindo (uma só em andamento; várias, todas já com
  carta), a função devolve a tarefa em andamento que `current` dá. O resto da função não muda (lote
  recente, pergunta aberta, nome, o caso sem nada em andamento).
- Comentários de `sendAnchor` (o bloco acima de `Used`): tirar "unless an open task was planned after it
  was started (planned to send, sent with no start): that newest one" e dizer a regra nova com as
  palavras e a data da decisão.
- Comportamento novo no painel: com "Um" ◉ e "Novo" ○ planejado depois, a carta "Para <sessão>: …", o
  cartão da sessão aberta e o cartão do subagente lançado aparecem sob "Um". "Novo" segue ○ até o start
  nele. Na entrega de uma carta que ficou na fila, quem conclui sozinha é "Um" (a tarefa do envio), não
  "Novo".
- `text/rules.ts`: não muda. As regras já dizem "embaixo da tarefa em andamento de onde saiu" e "antes
  de abrir uma sessão, marque com start a tarefa a que ela pertence".

## 4. Impacto

`npm run impacto -- task-tree/hooks/panel.ts`: 69 cenários (envios, pedidos, perguntas, sessões,
lembretes, durabilidade, parte de cabeçalho e subagentes). Checklist: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app`. Golden: nenhum cenário.

## 5. Testes

Novos (o relógio precisa andar entre o start e o plan: com o relógio parado o `plannedAt` empata com o
`startedAt` e o ramo antigo não era tomado):

1. `tests/envios.test.ts`: "com uma tarefa em andamento e um passo planejado depois, a carta fica sob a
   tarefa em andamento, e a entrega conclui essa tarefa". Cenário novo
   `envios.com-andamento-fica-sob-a-tarefa-em-andamento`. Roteiro: `fixar` (com `relogio`), host com
   `local_x`, `responderEnvio`; pedido; `plan` de um nível 1 com "Um"; `start` em "Um";
   `relogio.advance(1000)`; `plan` de outro nível 1 no mesmo pedido com "Novo"; `envio` (fila). Afirma:
   carta na fila sob "Um"; nenhuma carta sob "Novo"; "Novo" pendente. Depois `h.recebeu` e `aviso`:
   "Um" concluída, "Novo" pendente. Falha hoje: a carta vai para "Novo" e a entrega conclui "Novo".
2. `tests/sessoes.test.ts`: "com uma tarefa em andamento e um passo planejado depois, a sessão aberta
   fica sob a tarefa em andamento". Cenários `envios.com-andamento-fica-sob-a-tarefa-em-andamento` e
   `sessoes.cartao-sob-a-tarefa-de-origem`. Mesmo roteiro com `abrirSessao` e `aviso`; lê
   `cartoes(p, <nome>)[0].sob`. Afirma "Um". Falha hoje: "Novo".
3. `tests/subagentes.test.ts`: "com uma tarefa em andamento e um passo planejado depois, o subagente
   lançado fica sob a tarefa em andamento". Cenários
   `envios.com-andamento-fica-sob-a-tarefa-em-andamento` e `subagentes.cartao-desde-o-lancamento`.
   Mesmo roteiro com `lancaveis` e `lancar`; o cartão entre as linhas abaixo de "Um" (o ajudante
   `abaixo` do arquivo), não abaixo de "Novo". Falha hoje.

Testes existentes: nenhum deve mudar. Se a `regressao` acusar algum, é teste coberto por regra: o
implementador para e relata (a decisão 19 autoriza `--tipo decisao` só para teste que afirme a carta ou
o cartão sob o passo planejado depois, com o `Reescrito` abaixo no cenário dele).

## 6. Catálogo e selos

`regras/envios.md`, cenário novo:

- `### envios.com-andamento-fica-sob-a-tarefa-em-andamento`
- Título: "Com uma tarefa em andamento, a carta e o cartão ficam sob ela, não sob o passo planejado
  depois."
- Dado uma tarefa em andamento (◉) e um passo novo pendente (○) planejado depois do start dela, no mesmo
  pedido
- Quando sai uma mensagem, abre uma sessão ou é lançado um subagente
- Então a carta e o cartão ficam sob a tarefa em andamento; o passo novo segue ○ até o start nele e não
  fecha sozinho na entrega (quem fecha é a tarefa do envio)
- `Origem: decisão do usuário, 2026-11-14 ("Sob a em andamento (Recomendado)"); desfaz o pedido
  registrado em 2026-10-21 ("o segundo painel de implementacao deveria estar abaixo da tarefa de tooltip
  completo, foi ele quem enviou a mensagem de solicitação"), que mandava a carta para o passo planejado
  depois do start.` (a data do pedido antigo: conferir no `DESENVOLVIMENTO.md`, procurando a frase; se
  não houver data, escrever "pedido registrado no DESENVOLVIMENTO.md")
- `Código: hooks/agents.ts`
- `Estado: coberto`

`subagentes.cartao-desde-o-lancamento` e `sessoes.cartao-sob-a-tarefa-de-origem` não são reescritos (os
testes deles não mudam; os testes novos só os citam).

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/envios.test.ts::com uma tarefa em andamento e um passo planejado depois, a carta fica sob a tarefa em andamento, e a entrega conclui essa tarefa" --tipo novo --motivo "decisão do usuário, 2026-11-14: Sob a em andamento (Recomendado)"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::com uma tarefa em andamento e um passo planejado depois, a sessão aberta fica sob a tarefa em andamento" --tipo novo --motivo "decisão do usuário, 2026-11-14: Sob a em andamento (Recomendado)"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::com uma tarefa em andamento e um passo planejado depois, o subagente lançado fica sob a tarefa em andamento" --tipo novo --motivo "decisão do usuário, 2026-11-14: Sob a em andamento (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: na entrada que cita "o segundo painel de implementacao deveria estar abaixo da
tarefa de tooltip completo" (procurar a frase; fica em "Armadilhas", item "Tarefa que enviou a
mensagem"), acrescentar que a decisão de 2026-11-14 ("Sob a em andamento (Recomendado)") a desfaz e que
a carta fica sob a tarefa em andamento. Em "Como é hoje", onde o lote 01 escreveu a ordem do envio,
acrescentar o caso com tarefa em andamento. `CLAUDE.md`: nada.

## 8. Golden

Não muda (os quatro cenários não planejam passo depois de um start antes de enviar).

## 9. Checklist do app

Numa sessão real: com uma tarefa ◉, planejar um passo novo e mandar uma mensagem (ou abrir uma sessão)
sem dar start nele; a carta e o cartão aparecem sob a tarefa ◉.

## 10. Dependências e conflitos

- Depois do lote 01 (mesma função, mesmos comentários e o mesmo trecho do `DESENVOLVIMENTO.md`).
- Lote 03 (casamento por palavra) mexe em `namedFor` e nos chamadores, não no trecho que sai aqui.
- Triagem A, decisão 13 ("Sim, o plan adota (Recomendado)"): mexe em `sendAnchor` no caso "sem nada em
  andamento e pedido sem tarefas" (`hooks/panel.ts:257-273`), ao lado do trecho que sai aqui; e na
  frase das regras de uso sobre planejar antes de abrir sessão ou lançar subagente. Conflito provável
  de merge em `hooks/panel.ts`; as mudanças não se cruzam na lógica.
- Triagem A, decisão 9 ("Sob o nível 1 (Recomendado)", cartão cuja tarefa de origem sai do plano) e
  decisão 2 ("Inicia a 1ª subtarefa", start num pai aberto): mexem em quem é "a tarefa em andamento"
  (`current`); o que este lote devolve é o que `current` der.

## 11. Bloqueio

Nenhum. A decisão desfaz um pedido registrado, com as palavras dele.
