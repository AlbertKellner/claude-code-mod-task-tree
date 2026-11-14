# Lote 20 (triagem C): "falta o summary" só vale para o último passo

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "O aviso 'falta o summary' dispara no meio do turno, quando o done fecha a última aberta
  antes do plan seguinte, na ordem que os próprios lembretes mandam". Correção direta. Inverter a
  ordem done e plan não entra aqui (é a decisão 41, lote 24).

## 2. Causa confirmada na ponta

- Escrito, `hooks/tools.ts:177-178`: a condição do aviso é "fechou algo, nada aberto, sem summary
  guardado".
- Escrito, `text/rules.ts:57-62` e `193-196`: depois da resposta a uma pergunta, os textos mandam done
  na tarefa da pergunta e depois plan com as próximas tarefas. Com um plano de uma tarefa só
  ("Perguntar o rumo"), esse done fecha a última aberta e recebe "falta o summary".
- Escrito, `hooks/tools.ts:138` e `hooks/panel.ts:130-133`: o summary dado ali fica guardado até o fim
  do turno, e cala o aviso do done final.
- Dedução: a linha ↩ do pedido fica com o resumo do passo da pergunta ("Usuário escolheu a opção B"),
  e o done final, sem summary, não é cobrado.

## 3. O que muda

- `text/rules.ts` (`DONE.noSummary`): "falta o summary: se este done foi o último passo do turno,
  chame done de novo só com summary, a resposta do turno em até 120 caracteres (vira a linha ↩); se
  ainda vai planejar ou seguir trabalhando, ignore este aviso e passe o summary no último done". O
  trecho "falta o summary" fica.
- `hooks/tools.ts` e `hooks/panel.ts`: um resumo dado antes de um plan do mesmo turno deixa de calar
  a cobrança. O `plan` do loop principal marca o resumo guardado como "de antes do plano" (uma marca
  junto das do pedido, em `reminders`, variável de módulo: uma recarga a esquece, e aí só não há a
  segunda cobrança); o done que fecha a última aberta sem summary cobra quando não há resumo ou
  quando o que há é de antes do plano; um done com summary novo limpa a marca. O resumo antigo
  continua guardado: se nenhum novo vier, ele ainda é a linha ↩ (melhor que nenhuma).
- A cobrança não sai: fora do app desktop ela é a única.

Em termos do painel: a linha ↩ do pedido passa a ser, na prática, o resumo do trabalho, não o do
passo da pergunta.

## 4. Impacto

`npm run impacto -- hooks/tools.ts text/rules.ts hooks/panel.ts`: 90 cenários (envios 17, turnos 14,
pedidos 14, lembretes 11, durabilidade 9, árvore 9, perguntas 8). Checklist:
`envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/arvore.test.ts`)

Regra dos dois: `arvore.done-sem-summary-e-varias-sem-start`.
- "o aviso de falta do summary diz que só vale para o último passo do turno": plano de uma tarefa,
  done sem summary; a resposta contém "falta o summary" e "último passo do turno". Falha hoje: sem a
  segunda frase.
- "um resumo dado antes de um plan não cala a cobrança do done final": plano de uma tarefa
  ("Perguntar"), start, done com summary; plan com o trabalho, start, done sem summary: a resposta
  contém "falta o summary"; um done seguinte só com summary não o contém mais. Falha hoje: o done
  final não cobra.
- Teste existente "o done avisa a falta do summary no fim e as etapas fechadas juntas sem start": não
  muda (os trechos conferidos ficam).

## 6. Catálogo (`regras/arvore.md`) e selos

`arvore.done-sem-summary-e-varias-sem-start`, texto completado (correção, sem `Reescrito:`):
- "Dado o último done do pedido sem summary (também quando o único resumo dado veio antes de um plan
  do mesmo turno), ou várias tarefas fechadas de uma vez sem start";
- "Então a resposta traz o aviso correspondente; o do summary diz que só vale se aquele done foi o
  último passo do turno";
- a `Origem:` ganha "; o aviso no meio do turno e o resumo de antes do plan, auditoria 2026-11-10".

Selos: `npm run regras:selar -- "task-tree/tests/arvore.test.ts::<nome>" --tipo novo --motivo "auditoria: falta o summary só no último passo"`, um por teste novo.

## 7. Documentação

Comentário de `reminders` em `hooks/panel.ts:143-148` e a linha `unplanned, planned, answeredInChat`
da `TABLE` (ganha a marca nova).

## 8. Golden

Não muda.

## 9. Checklist do app

- Um pedido real que começa com pergunta: depois do trabalho, a linha ↩ diz o resultado, não a
  escolha.

## 10. Dependências e conflitos

- Depois do lote 19 (`hooks/tools.ts`); antes do 21, que muda a mesma condição ("nada aberto" passa a
  "nada aberto no pedido atual").
- Triagem A, lote 06 (o Esc zera o resumo) e lote 08 (o ↩ de pedido sem tarefa): mexem no resumo
  guardado, em `hooks/turn.ts`; a marca daqui deve ser limpa onde o resumo for zerado.
- Lote 16 daqui: sem conflito (lá sai o recap, não o resumo).

## 11. Bloqueio

Nenhum.
