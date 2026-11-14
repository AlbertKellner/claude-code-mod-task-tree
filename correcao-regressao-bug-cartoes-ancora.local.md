# correcao-regressao · bug: cartões de filhas de turnos anteriores sob a tarefa do turno atual

Sessão `correcao-regressao`. Branch `fix/cartoes-na-tarefa-errada`, sobre a `main` `20daa8e` (fase 6).
2026-10-22. Autorização do usuário: corrigir bugs sem perguntar.

## Sintoma (print 33.png, painel do plugin instalado 0.7.4 = fase 5)

Numa pergunta simples da orquestradora, que abriu "Voltar o plugin para o clone local" com uma
subtarefa e não mandou mensagem a sessão nenhuma, apareceram sob essa tarefa os cartões de docs,
governança, análise e correção dos turnos das fases 5 e 6, com tarefas e ↩.

## Causa (não é regressão da fase 6)

Os planos da orquestradora reutilizam ids de nível 1 a cada pedido ("1", "2", "3"). Quando um plano
novo reutiliza o id de uma tarefa fechada, o `plan` renomeia a fechada com um prefixo aleatório
(`t18n:1`) e a nova fica com o id (regra do `planTool`, presente desde a importação do mod, 0.7.3).
As ligações das sessões, porém, continuavam com o id curto: `anchor`, `lastAnchor` e o `anchor` de
cada rodada (`rounds`) em `children`, mais `launches` e `sends`. No estado publicado da orquestradora
agora (494 KB, 104 turnos, 188 tarefas de nível 1, 22 renomeadas), todas as rodadas com âncora "1",
"2" ou "3" resolviam para as tarefas "1", "2", "3" do turno 110 (planejadas depois do envio), em vez
de `9z0f:1`, `jsdw:2`, `xyfz:3` etc., que eram essas tarefas quando as mensagens saíram.
Confirmação de que já existia: o arquivo de testes novo, rodado sobre `5a5d2f7` (fase 5) numa cópia
fora do repositório, falha igual (316 pass, 3 fail, mesmo desenho); sobre a `main` atual, idem
(325 pass, 3 fail).

## Correção

1. **Raiz** — `task-tree/hooks/panel.ts`: `renameAnchors($, ids, tag)` (nova, exportada) renomeia as
   ligações no state (`children`: `anchor`, `lastAnchor`, `rounds[].anchor`; `launches`: `anchor`;
   `sends`: `anchor`) e na cópia do módulo `keptLinks`; regra: âncora `a` com `a === id` ou `a`
   começando por `id/` vira `tag:a`. `task-tree/hooks/tools.ts` (`planTool`) chama-a com as tarefas
   fechadas que renomeou (`renamed`) e o mesmo `tag`.
2. **Layout, para dados já publicados** — `task-tree/draw/layout.ts`: `resolveAnchor(owner, anchor,
   at)` (nova, exportada): só quando a tarefa que hoje tem o id foi planejada depois do momento
   (`plannedAt > at`) e existe uma renomeada (`*:id`, prefixo sem `:`) planejada antes, a âncora passa a
   ser a última dessas (a que tinha o id então); em qualquer outro caso (tarefa planejada antes, sem
   `plannedAt`, sem renomeada) fica como está. Aplicada em `breaks` (as rodadas da sessão, pelo `at`
   de cada rodada; a âncora de uma irmã, pelo início do trabalho dela) e em `split` (o `anchor` do
   cartão pelo início do trabalho da sessão, `begins`; o `lastAnchor` pela última rodada).
   Uma primeira versão mais ampla (soltar a âncora sempre que a tarefa fosse mais nova que o
   momento) mudou 4 goldens (`filha-*`: fixtures sintéticas com tempos arbitrários) e foi descartada;
   a regra final não toca nenhum caso fora da reutilização de id.

## Testes

- Novo `task-tree/tests/cartoes-ancora.test.ts` (3): layout com uma renomeação (`ab12:1` fechada,
  "1" nova): o cartão fica na velha e a resumida não mostra cartão sob a nova; layout com duas
  renomeações: cada rodada vai à tarefa que era "1" quando a mensagem saiu; pelas ferramentas:
  plan "1" → sessão aberta nela → done → novo pedido com plan "1" → o cartão fica na tarefa velha.
  Os 3 falham na `main` e em `5a5d2f7`; passam com a correção.
- Suíte: **328 pass / 0 fail** em 2 rodadas (325 + 3); `validate task-tree` ok; 0 `GOLDEN-NEW`,
  0 `TEXTOS-NEW`; orçamento 11657 / 11775 / 47400 / 48162 (rodada 2; a rodada 1 teve o artefato
  do relógio já registrado, +14/16 bytes).

## Efeito no painel do usuário

Com o mod novo, ao recarregar, o estado publicado existente é desenhado com as âncoras resolvidas
pelo momento (os cartões voltam às tarefas de origem renomeadas); os planos seguintes renomeiam as
ligações junto, e o problema não se repete. Nada muda nos outros casos (goldens iguais).

## Commit sugerido

Arquivos: `task-tree/hooks/panel.ts`, `task-tree/hooks/tools.ts`, `task-tree/draw/layout.ts`,
`task-tree/tests/cartoes-ancora.test.ts` (novo), mais os hunks do `DESENVOLVIMENTO.md` da
docs-task-tree (patch à parte, sem a seção local).
Mensagem: `fix(task-tree): cartões de sessões ficam na tarefa que mandou a mensagem quando o plano reutiliza o id`

## Comparação no mesmo cenário (o estado publicado real da orquestradora, 494 KB, hoje)

Fixture temporária (só no scratchpad) com o arquivo publicado da orquestradora e um teste que imprime as
linhas do `layout()`, rodado em cópias de `5a5d2f7` (fase 5, = 0.7.4) e de `20daa8e` (fase 6, main):
- **259 linhas idênticas nas duas versões** (`diff` vazio): 23 cartões de turnos anteriores sob
  "Registrar regra e avisar as sessões" (tarefa "1" do pedido mais novo), 17 sob "Achar causa e corrigir
  com teste (correção)" (tarefa "2" do pedido 110), 1 sob "Commit, push e PR (governança)". O print do
  usuário é esse desenho, igual nas duas versões: **não é regressão da fase 6**.
- **Com a correção** (working tree): 37 linhas; os cartões antigos voltam aos pedidos de origem (que
  estão recolhidos em "+102 pedidos anteriores") e sob o pedido atual ficam só os 4 cartões da
  governança enviados dele ("Criar branch de correção") e 1 sob "Registrar regra e avisar as sessões",
  ambos de mensagens de fato enviadas dessas tarefas (rodadas com `at` posterior ao `plannedAt`).

## TDD (regra do usuário)

Testes escritos antes da correção e vistos falhar pelo motivo certo (saída em
`scratchpad/suite-bug-r0.log`, suíte da main com os 3 novos: 325 pass, 3 fail):
1. "layout: a rodada ancorada em "1" quando "1" era a tarefa velha…": esperado
   `['Pedido 1','  Velha','    ⑂ filha','      Feito','      ↩ resposta','Pedido 2','  Nova']`,
   recebido `['Pedido 1','  Velha','Pedido 2','  Nova','    ⑂ filha',…]` (o cartão sob a Nova).
2. "layout: duas renomeações do mesmo id…": esperado só `['  Terceira']` depois da Terceira; recebido
   a Terceira seguida dos dois cartões ("Um" e "Dois") que eram da Primeira e da Segunda.
3. "plan "1" → sessão → done → novo pedido planeja "1" de novo…": `at('filha') < at('Nova')` falhou
   (cartão desenhado depois da Nova, isto é, sob ela).
Depois da correção: os 3 passam; suíte 328 pass em 2 rodadas.

## Documentação e sinal

- docs-task-tree: 7 hunks em `task-tree/DESENVOLVIMENTO.md` (+35/−6): módulos (`renameAnchors`,
  `resolveAnchor`), tabela dos hooks (planTool), bloco "Âncoras e ids reutilizados" em "Desenho",
  testes 325 → 328 e linha `cartoes-ancora.test.ts | 3`, histórico. Patch só com eles (sem a seção
  local do clone): `correcao-regressao-bug-cartoes-desenvolvimento.patch` nesta pasta,
  `git apply --cached --check` ok.
- Sinal do commit enviado à governança com os 4 arquivos de código/teste + o patch, a mensagem
  `fix(task-tree): cartões de sessões ficam na tarefa que mandou a mensagem quando o plano reutiliza o id`
  e os testes vermelhos com a saída resumida.
