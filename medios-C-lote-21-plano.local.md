# Lote 21 (triagem C): lembrete de planejar pelo pedido atual

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Os lembretes medem 'tarefa aberta' no grupo inteiro e 'usou o painel' por qualquer chamada:
  pedido novo sem plano não é lembrado quando sobra tarefa antiga ou depois de um done". Correção
  direta. A recusa da pergunta por "tarefa do pedido atual" é a decisão 40 (lote 23).

## 2. Causa confirmada na ponta

- Escrito, `hooks/tool-call.ts:203-216` (`reminder`): o lembrete "sem plano aberto" cala com a marca
  de uso (`reminders.planned`) ou com qualquer tarefa aberta do grupo principal, de qualquer pedido.
- Escrito, `hooks/tools.ts:36`: a marca liga no começo do `plan`, antes da validação (liga também no
  plan recusado por ids repetidos, linhas 41-44); `133`: liga em qualquer done; `194`: em qualquer
  start. `hooks/prompt-submit.ts:139-140`: o pedido novo a desliga.
- Escrito, `hooks/tools.ts:177`: a cobrança do summary olha "nada aberto" no grupo inteiro.
- Teste só do painel vazio: `tests/lembretes.test.ts:121-137`.
- Dedução: o pedido um deixa um passo ○; no pedido dois o modelo fecha esse passo com done, ou nem
  isso, e trabalha sem plan: nenhum lembrete sai no pedido inteiro, e o trabalho não aparece no
  painel. O cenário `lembretes.primeira-chamada-sem-plano` ("dado um pedido sem plan") não se cumpre.

## 3. O que muda

Uma noção só de "pedido atual" (as tarefas de nível 1 do último turno do grupo principal; sem turnos
gravados, painel antigo, todas), numa função de `hooks/panel.ts`, usada aqui e no lote 23.

- `hooks/tools.ts`: a marca de uso liga só com plan aceito (depois da recusa por ids repetidos), com
  start (qualquer um: retomar tarefa antiga é fluxo previsto), ou com done que fechou tarefa do
  pedido atual. Um done só com summary, ou só em tarefa de pedido anterior, não liga.
- `hooks/tool-call.ts` (`reminder`): o lembrete cala com a marca, com tarefa aberta do pedido atual,
  ou com tarefa em andamento de qualquer pedido (aberta, iniciada e não parada com Esc). Uma tarefa
  só pendente de pedido anterior não cala.
- `hooks/tools.ts:177`: a cobrança do summary passa a "fechou algo e não sobrou nada aberto no pedido
  atual" (um ○ esquecido de pedido anterior não esconde a cobrança).
- A mensagem entregue no meio do turno segue sem abrir pedido (não mexe na marca).

Em termos do painel: num pedido novo em que o modelo trabalha sem planejar, o lembrete volta a sair
na primeira ferramenta e a cada 10, mesmo com um passo antigo pendente; o trabalho volta a aparecer.

## 4. Impacto

`npm run impacto -- hooks/tool-call.ts hooks/tools.ts hooks/panel.ts`: 83 cenários (envios 17, turnos
14, pedidos 14, durabilidade 9, árvore 9, perguntas 8, cabeçalho 4, lembretes 3). Checklist:
`envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/lembretes.test.ts`)

Com um `Bash` de mentira, como o teste da linha 122. Regra: `lembretes.primeira-chamada-sem-plano`.
- "pedido novo sem plano, com um passo pendente do pedido anterior: o lembrete de planejar sai":
  pedido um, plan A, start e done numa das duas, fim do turno; pedido dois; a primeira ferramenta traz
  "sem plano aberto". Falha hoje: a pendente antiga cala.
- "fechar com done um passo do pedido anterior não conta como planejar o pedido novo": o mesmo, com
  um done na pendente antiga antes da ferramenta; o lembrete sai. Falha hoje.
- "o plan recusado por ids repetidos não cala o lembrete": pedido, plan com ids repetidos (erro),
  ferramenta: o lembrete sai. Falha hoje.
- "seguir numa tarefa antiga com start cala o lembrete": pedido dois, start na pendente antiga,
  ferramenta: sem lembrete. Passa hoje; protege o fluxo previsto.
- "o done que fecha a última tarefa do pedido atual cobra o summary mesmo com pendente antiga"
  (regras `lembretes.primeira-chamada-sem-plano` e `arvore.done-sem-summary-e-varias-sem-start`):
  pedido um com uma pendente deixada; pedido dois com plan, start e done sem summary: "falta o
  summary". Falha hoje.
- Teste existente "sem plano, a primeira ferramenta e cada 10ª…": não muda.

## 6. Catálogo e selos

`regras/lembretes.md`, `lembretes.primeira-chamada-sem-plano`, texto com a condição exata (correção,
sem `Reescrito:`):
- "Dado um pedido em que o modelo ainda não usou o painel (nenhum plan aceito, nenhum start, nenhum
  done em tarefa deste pedido), sem tarefa aberta própria e sem tarefa em andamento";
- "Quando o modelo chama a primeira ferramenta e, depois, a cada 10";
- "Então ele recebe o lembrete de planejar; uma tarefa só pendente de um pedido anterior não cala o
  lembrete, nem o done nela, nem um plan recusado; uma tarefa em andamento, ou um start numa tarefa
  antiga, cala";
- a `Origem:` ganha "; a medida pelo pedido atual, auditoria 2026-11-10" e o `Código:` passa a
  "hooks/tool-call.ts, hooks/tools.ts, hooks/panel.ts".

`regras/arvore.md`, `arvore.done-sem-summary-e-varias-sem-start`: "o último done do pedido" já diz o
certo; acrescentar ao "Dado": "(o último do pedido atual, mesmo com tarefa aberta de pedido anterior)".

Selos: `npm run regras:selar -- "task-tree/tests/lembretes.test.ts::<nome>" --tipo novo --motivo "auditoria: lembrete de planejar pelo pedido atual"`, um por teste novo.

## 7. Documentação

Comentário de `reminders` em `hooks/panel.ts` e o do topo de `hooks/tool-call.ts` (linhas 6-8).

## 8. Golden

Não muda.

## 9. Checklist do app

- Num pedido real seguinte a outro que deixou um passo pendente: se o modelo começar sem plan, o
  lembrete aparece no resultado da primeira ferramenta (visível no transcript).

## 10. Dependências e conflitos

- Depois do lote 20 (mesma condição do summary).
- Triagem A, lote 07 (decisão 5: a tarefa ◷ segue ◷ na mensagem seguinte, até o start): muda o que é
  "em andamento" num pedido novo. A condição daqui ("aberta, iniciada e não parada") deve acompanhar:
  se uma ◷ de turno anterior deixar de contar como em andamento, ela também deixa de calar o lembrete.
- Triagem A, lote 08 (pedido próprio para o ↩ sem tarefa) e lote 03: mexem em turnos e em `planTool`.
- Triagem A, lote 05 (tarefa abandonada): se criar uma ferramenta ou argumento novo, decidir lá se
  conta como uso do painel (pela regra daqui, não conta se não fecha tarefa do pedido atual).

## 11. Bloqueio

Nenhum.
