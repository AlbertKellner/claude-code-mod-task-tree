# Lote 26 (triagem C): tempo do pai e do pedido conta do primeiro start

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Tempo de tarefa, pedido e cabeçalho sem definição no catálogo; o código usa três bases e o
  número pula entre estados".
- Decisão 44: "Do primeiro start (Recomendado)". A opção: "Sempre do primeiro start, como a linha em
  andamento. O número não pula. Muda o tempo das linhas ◷ e pode mudar o golden do cenário principal,
  que você valida no app." A pergunta era sobre o tempo de um pai e de um pedido.

## 2. Causa confirmada na ponta

- Escrito, `draw/layout.ts:587-594` (`timeOf`, `timeSpan`) e `112-118` (`span`): a linha em andamento
  e a concluída contam do primeiro start (`startedAt`) entre a tarefa, as subtarefas e as tarefas das
  sessões embaixo.
- Escrito, `draw/layout.ts:576-583` (`stillSpan`): a linha aguardando (◷), de tarefa e de pedido,
  conta do menor entre start e, **sem start, o plano** (`startedAt ?? plannedAt`), com as pendentes
  incluídas. É usada nas linhas `1137` (tarefa) e `1206` (pedido) quando o tom é "aguardando".
- Escrito, `draw/layout.ts:613-621` (`sessionTime`, o cabeçalho, `hooks/render.tsx:282`): a mesma base
  mista.
- Dedução: durante o turno o pai conta do primeiro start; no fim do turno, com passos pendentes,
  passa a contar do plano e sobe de uma vez (o tempo de uma pergunta feita antes do primeiro start);
  com tudo fechado volta a contar do start.
- Nenhum teste afirma o texto de um tempo; os cenários só dizem "relógio parado".

## 3. O que muda

`draw/layout.ts`:
- `stillSpan`: os começos passam a ser só os starts (`startedAt`) da tarefa, das subtarefas e das
  tarefas das sessões embaixo; as pendentes, sem start, não entram. Sem nenhum start, a linha ◷ fica
  sem tempo.
- Nada mais muda: a linha em andamento e a concluída já contam do primeiro start; a linha em
  andamento sem nenhum start embaixo (a tarefa acesa só por uma sessão a trabalho) segue com a conta
  de hoje, e o cabeçalho também (o tempo do cabeçalho é a decisão 25, lote 18 da triagem B).

Em termos do painel: o tempo de um pai e de um pedido não pula quando o turno termina: é o mesmo
número que a linha mostrava em andamento, parado no último fechamento embaixo dela. Uma pergunta de 2
minutos antes do primeiro start não entra mais no tempo do pedido aguardando.

## 4. Impacto

`npm run impacto -- draw/layout.ts`: 110 cenários e os quatro do golden. Checklist:
`envios.destino-arquivado-no-app`, os quatro "no app" de subagentes, `ultracode.cor-e-corte`
(conferência geral, nada específico).

## 5. Testes de verificação (`tests/turnos.test.ts`)

Regra dos dois: `turnos.tempo-conta-do-primeiro-start`. O tempo é lido no texto da linha (formato
"m:ss", `clockText` de `draw/svg.ts`); se a leitura em texto do kit não trouxer o tempo, usar os
pedaços da linha do app (`linhaDoApp`).
- "o tempo do pai e do pedido não pula no fim do turno com passos pendentes": pedido, plan com duas
  tarefas; o relógio avança 2 minutos; start na primeira; avança 5 s; done nela. Com o turno em
  curso, o pai e o pedido mostram 0:05. Fim do turno: os dois ficam ◷ e seguem com 0:05. Falha hoje:
  no fim do turno passam a 2:05.
- "com tudo fechado, o tempo segue contando do primeiro start": na mensagem seguinte, start e done na
  segunda tarefa; o pai concluído mostra o tempo do primeiro start ao último done, sem os 2 minutos
  de antes.
- Testes existentes: nenhum afirma tempo; nenhum muda.

## 6. Catálogo (`regras/turnos.md`) e selos

Novo, `coberto`:

```markdown
### turnos.tempo-conta-do-primeiro-start
O tempo de uma tarefa, de um pai e de um pedido conta do primeiro start, em qualquer estado.

- Dado um pai (ou um pedido) com passos iniciados e passos ainda pendentes, planejados antes do primeiro start
- Quando a linha dele passa de em andamento a aguardando (o fim do turno) e depois a concluída
- Então o tempo mostrado conta sempre do primeiro start embaixo dele: não inclui a espera entre o plano e esse start, e não muda de base de um estado para outro; aguardando, fica parado no último fechamento embaixo dele; sem nenhum start, a linha não mostra tempo

Origem: decisão do usuário, 2026-11-14 ("Do primeiro start (Recomendado)"), à pergunta "De onde ele deve contar?".
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/turnos.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: o tempo conta do primeiro start"`, um por teste novo.

## 7. Documentação

Comentários de `stillSpan` e de `sessionTime` em `draw/layout.ts` (o segundo diz que o cabeçalho segue
com a base antiga, até a decisão 25).

## 8. Golden

Pode mudar o cenário "principal" (é o que tem pai e pedido ◷ com pendentes). Pela leitura do roteiro
(`tests/golden.test.ts:33-54`), o plan e o primeiro start caem no mesmo instante do relógio parado,
então o número deve ficar igual; a etapa do check diz. Se mudar: regravar com
`npm run golden:aprovar -- principal --motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"` e
seguir com o commit (o cenário `visual.desenho-principal` ganha `Reescrito: 2026-11-14, decisão do
usuário ("Do primeiro start (Recomendado)")`).

## 9. Checklist do app

- Um pedido real com uma pergunta longa antes do primeiro start: no fim do turno, o tempo do pedido e
  do pai ◷ é o mesmo que aparecia em andamento, sem saltar.
- As alturas e a posição do tempo na linha não mudam.

## 10. Dependências e conflitos

- Independente dos outros lotes da triagem C; antes do 27 (o golden ampliado grava os tempos como
  ficarem).
- Mesmas funções de tempo em `draw/layout.ts`, a fazer em sequência com:
  - triagem B, lote 18 (decisão 25: o tempo do cabeçalho para no fim do turno) e lote 19 (decisão 26:
    o tempo da tarefa só conta com turno em curso; mexe em tipos, `state/tasks.ts` e `layout.ts`);
  - triagem A, lote 22 (decisão 17: o tempo da tarefa concluída com filha embaixo é só o próprio) e
    lote 21 (o tempo da ◷ no cartão da filha parada).
  A decisão 26 de B muda o que se soma (só os trechos com turno em curso); a daqui diz de onde começa
  (o primeiro start). As duas valem juntas: quem vier depois mantém "nunca do plano" na linha ◷.

## 11. Bloqueio

Nenhum.
