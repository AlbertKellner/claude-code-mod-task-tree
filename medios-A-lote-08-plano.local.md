# Lote 08: o ↩ de um pedido sem tarefa fica num pedido próprio

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Turno sem plano grava a resposta e o resumo ↩ no pedido anterior".
- Decisão 6, 2026-11-14: **"Pedido próprio (Recomendado)"**. A opção: "Num pedido próprio só com a linha
  ↩, quando há resumo; em lugar nenhum, quando não há: o ↩ do pedido anterior, já encerrado, não é
  sobrescrito; quando a mensagem continua o plano anterior (alguma tarefa dele foi mexida no turno), a
  resposta segue indo para esse pedido."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/turn.ts:130-141`: a resposta (`reply`) e o resumo (`brief`) vão para o último turno **que tem
  tarefas** (`[...turns].reverse().find(u => g.tasks.some(t => t.turn === u.id))`), não para o turno que
  o prompt abriu.
- `hooks/panel.ts:181-187` (`openTurn`): a cada mensagem nova, os turnos sem tarefa de nível 1 são
  descartados (`used`); um pedido sem tarefa não tem onde guardar nada.
- `draw/layout.ts:1466-1469` (`body`): só o turno com tarefa desenhada ganha linha de pedido; a linha ↩
  é desenhada por `turnRows` (`layout.ts:1230-1233`).
- `hooks/tool-call.ts:195`: o `wrap_up` pede o resumo mesmo sem tarefa no pedido.

Dedução: pergunta rápida respondida sem plan, com `done` só de `summary`: o ↩ do pedido anterior passa a
mostrar o resumo da pergunta nova, no painel, no arquivo publicado e no cartão desta sessão na mãe.

Regra que toca: `turnos.continuacao-sem-start-aguarda` trata o turno sem tarefa como continuação do
plano; o catálogo não define o pedido sem tarefa.

## 3. O que muda

`hooks/turn.ts`, `hooks/panel.ts`, `draw/layout.ts`.

1. Para onde vai a resposta (`turnComplete`, fim normal do loop principal). Seja `cur` o último turno do
   grupo principal (o pedido aberto pela última mensagem que abre pedido):
   - `cur` tem tarefa de nível 1: vai para ele (como hoje).
   - `cur` não tem tarefa e alguma tarefa de pedido anterior foi mexida neste turno: vai para o último
     turno com tarefas (como hoje). "Mexida": alguma tarefa do grupo principal com `startedAt`, `endedAt`
     ou `plannedAt` igual ou posterior ao `at` de `cur`. Conferir isso antes do que o próprio fim do
     turno grava (o `settleBySubs` e, com o lote 07, a espera gravada nas tarefas). `cur` sem `at`
     (painel antigo): vale como mexida.
   - `cur` não tem tarefa, nada foi mexido e há resumo (`brief`): o resumo (e a resposta) ficam em `cur`,
     que passa a ser um pedido só com a linha ↩.
   - `cur` não tem tarefa, nada foi mexido e não há resumo: nada é gravado em turno nenhum.
2. `openTurn`: ao abrir um pedido, ficam os turnos com tarefa e também os turnos sem tarefa que têm
   resumo; destes, só os 20 mais recentes.
3. Desenho (`layout.ts`, `body` e `turnRows`), só no painel principal (nível 0):
   - o turno sem tarefa e com resumo ganha a linha de pedido (título: o começo da mensagem; ✓ "Pedido
     concluído"; sem contagem, sem barra, sem tempo: `time` indefinido, não o "—") e, embaixo, a linha
     ↩ com o resumo; recolhe como os outros pedidos; não conta no cabeçalho (`nodes` vazio);
   - ordem: pela ordem dos pedidos (o id do turno), entre os pedidos com tarefa;
   - à vista quando vem depois do primeiro pedido desenhado (ou quando nenhum pedido com tarefa está
     desenhado), no máximo os `SHOWN_TURNS` mais recentes deles; os demais contam em "+N pedidos
     anteriores" e aparecem com a linha aberta. Assim, quando um pedido novo limpa o painel, a pergunta
     respondida antes dele sai junto com os pedidos antigos.
4. Cartão desta sessão na mãe: a lista de ↩ do cartão já usa todos os turnos com resumo
   (`layout.ts:1289-1291`); o turno sem tarefa entra sozinho. Num cartão dividido em rodadas (`split`,
   `layout.ts:483`, que filtra os turnos pelas tarefas da parte), o turno sem tarefa e com resumo vai ao
   cartão da rodada dele (`partOfTurn`) quando ela tem cartão, senão ao da frente.

Comportamento novo no painel: pergunta rápida respondida sem plan e com resumo: aparece uma linha de
pedido com o começo da pergunta e, embaixo, "↩ <resumo>"; o ↩ do pedido anterior não muda. Sem resumo,
nada aparece e nada é sobrescrito. A mensagem que continua o plano anterior (start ou done numa tarefa
dele) segue com o ↩ no pedido dele.

Textos ao modelo: não mudam.

## 4. Impacto

`npm run impacto -- hooks/turn.ts hooks/panel.ts draw/layout.ts`: `draw/layout.ts` 110 cenários (os 4 do
golden entre eles), `hooks/panel.ts` 69, `hooks/turn.ts` 40. Checklist do app por mapa:
`envios.destino-arquivado-no-app`, `envios.subagente-no-app`, `subagentes.*-no-app`,
`ultracode.cor-e-corte`; nenhum muda.

## 5. Testes a escrever

`tests/turnos.test.ts`, regra `turnos.pedido-sem-tarefa-tem-o-seu-resumo` (nova):
1. **"o resumo de um pedido respondido sem tarefa fica num pedido próprio e não troca o ↩ do anterior"**.
   Roteiro: `const { relogio } = fixar(on)`; `const h = host(on, [])`; `pedido($, 'Pedido um')`; `plan` de
   "A" com a folha "1"; `start(['1'])`; `done(['1'], 'Resumo um')`; `fimDoTurno`; `relogio.advance(1000)`;
   `pedido($, 'Pergunta rápida')`; `done($, [], 'Resposta rápida')`; `fimDoTurno`.
   Afirma: há uma linha com "↩" e "Resumo um"; há uma linha com "↩" e "Resposta rápida"; há a linha de
   pedido "Pergunta rápida", depois de "Pedido um" e antes da linha "↩ Resposta rápida"; `cabecalho(p)`
   segue 1 de 1; os turnos publicados (`h.proprio()`) têm um `brief` "Resumo um" e outro "Resposta
   rápida".
   Falha hoje: o ↩ do pedido um vira "Resposta rápida" e não há linha "Pergunta rápida".
2. **"sem resumo, a resposta de um pedido sem tarefa não é gravada em pedido nenhum"**. Roteiro: até o
   primeiro `fimDoTurno` como em 1; `pedido($, 'Pergunta')`; `fimDoTurno($, 'texto da resposta')`.
   Afirma: a linha ↩ do pedido um segue "Resumo um"; não há linha "Pergunta"; nenhum turno publicado tem
   `reply` "texto da resposta".
   Falha hoje: o `reply` do pedido um passa a ser "texto da resposta". (Se a decisão 38 da triagem C já
   tiver tirado o `reply`, a última asserção sai e o teste afirma só as duas primeiras.)
3. **"a mensagem que continua o plano anterior deixa o resumo no pedido dele"**. Roteiro: `pedido`;
   `plan(A)`; `start(['1'])`; `done(['1'])`; `fimDoTurno`; avançar; `pedido($, 'continua')`;
   `start(['2.1'])`; `done(['2.1'], 'Tudo feito')`; `fimDoTurno`. Afirma: a linha "↩ Tudo feito" existe e
   não há linha de pedido "continua".
   Passa hoje: protege o caso que a decisão manda manter.
4. **"o pedido só com resumo sai de vista com os pedidos antigos quando um pedido novo limpa o painel"**.
   Roteiro: o de 1; `relogio.advance(1000)`; `pedido($, 'Pedido três')`; `plan` de "B" com "b1";
   `start(['b1'])`. Afirma: não há linha "Pergunta rápida"; há "+2 pedidos anteriores";
   `comHistorico($, 2)` mostra "Pergunta rápida" e "↩ Resposta rápida".
   Falha hoje: a linha não existe em lugar nenhum.

Testes existentes: nenhum muda (`turnos.resumo-sem-resposta-final`, `turnos.resumo-sem-seta-duplicada` e
`durabilidade.resumo-do-done-na-recarga` usam pedido com tarefa).

## 6. Catálogo e selos

`regras/turnos.md`:

```markdown
### turnos.pedido-sem-tarefa-tem-o-seu-resumo
O pedido respondido sem tarefa mostra o resumo dele numa linha própria, e não troca o do pedido anterior.

- Dado um pedido anterior encerrado, com o seu ↩, e uma mensagem nova que o modelo responde sem planejar tarefa
- Quando o turno termina, com resumo (o summary do done) ou sem
- Então, com resumo, aparece a linha do pedido novo (o começo da mensagem, ✓, sem contagem nem tempo) com a linha ↩ embaixo, na ordem dos pedidos; sem resumo, nada aparece; o ↩ e a resposta do pedido anterior não mudam; quando a mensagem continua o plano anterior (start, done ou plan numa tarefa dele no turno), o resumo vai para esse pedido; o pedido só com resumo sai de vista com os anteriores ("+N pedidos anteriores") e não conta no cabeçalho; no cartão desta sessão na mãe, cada ↩ segue no seu lugar

Origem: decisão do usuário, 2026-11-14 ("Pedido próprio (Recomendado)"), sobre o achado da auditoria de 2026-11-10 (a resposta de um turno sem plano era gravada no último pedido com tarefas).
Estado: coberto
```

Selos:

```bash
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o resumo de um pedido respondido sem tarefa fica num pedido próprio e não troca o ↩ do anterior" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Pedido próprio (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::sem resumo, a resposta de um pedido sem tarefa não é gravada em pedido nenhum" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Pedido próprio (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::a mensagem que continua o plano anterior deixa o resumo no pedido dele" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Pedido próprio (Recomendado)\""
npm run regras:selar -- "task-tree/tests/turnos.test.ts::o pedido só com resumo sai de vista com os pedidos antigos quando um pedido novo limpa o painel" --tipo novo --motivo "decisão do usuário, 2026-11-14: \"Pedido próprio (Recomendado)\""
```

## 7. Documentação

`DESENVOLVIMENTO.md`: linha do `turn.complete` em "Os 14 hooks" (~116: "grava no último turno com
tarefas") e o trecho da resposta do turno (~1073); `openTurn` em "Fluxo de dados"; entrada em "Decisões
(histórico)". O comentário de `Turn` em `types/index.d.ts:47-57` diz "turns no plan used are dropped":
acertar.

## 8. Golden

Não deve mudar (nenhum cenário do golden tem pedido sem tarefa). Se mudar, conferir.

## 9. Checklist do app

- No app, a linha do pedido só com resumo: ✓ verde, o título, sem "0/0", sem barra e sem "—"; a linha ↩
  embaixo, alinhada como nas outras; nos dois temas.
- No cartão de uma filha real: uma pergunta respondida nela sem plan, com resumo, aparece como ↩ no
  cartão sem trocar o ↩ anterior.

## 10. Dependências e conflitos

- Depois do lote 06 (zera resumo e recap em todo fim de turno) e do lote 07 (a espera gravada no fim
  normal não pode contar como "tarefa mexida": conferir antes dela).
- Lote 03: a marca de título no turno não interfere.
- Lote 20 (um cartão só para os turnos digitados na filha) mexe em `split`: quem vier depois mantém o
  turno sem tarefa com resumo no cartão.
- Triagem C: decisão 38 ("Tirar, basta o ↩") tira o `reply` no mesmo bloco de `turnComplete`; adaptar
  (com ela, só o `brief` é gravado).
- Triagem B: a correção ""+N pedidos anteriores" conta também o pedido que segue desenhado em parte"
  mexe na conta de `left` em `body` (`layout.ts:1436-1439`), a mesma que este lote soma; a decisão 31
  (pedido único acima do limite) mexe em `limitRows`. Quem vier depois junta as duas contas: N são os
  pedidos fora de vista, com tarefa ou só com resumo.

## 11. Bloqueio

Nenhum.
