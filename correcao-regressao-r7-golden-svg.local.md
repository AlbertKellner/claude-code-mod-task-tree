# correcao-regressao · R7 — golden do SVG por tom

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 2 da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## O que entrou

- `task-tree/tests/svg-golden.test.ts` — 7 testes, 12 cenários. Cada cenário monta o painel no
  desktop e recolhe todos os `Svg` da árvore que o kit devolve (`alt`, largura, altura, se é a camada
  interativa do tooltip, `source`), na ordem, e compara com o golden. Relógio fixo (`clock.now`
  constante; no estado real, o `at` do fixture), larguras fixas (bodyColumns 60; 100 no real).
  Cenários:
  - `basico`, `basico-concluido`: pedido (turno com `request`), 3 níveis, aberta/em andamento/
    concluída, nome cortado (tooltip), cabeçalho com chips; depois tudo concluído com `summary` (↩).
  - `retomada`: tarefa interrompida (store + `SessionStart resume`).
  - `filha-rodando` (cartão, anel 42 %, "aguardando", modelo/esforço, nome cortado), `filha-parada`,
    `filha-arquivada`, `filha-recolhida`.
  - `envio`: ✉ (SendMessage na fila) e chip "aguardando sessão".
  - `espera-propria`: aviso "Aguardando sua resposta" durante AskUserQuestion.
  - `subagente`: grupo de subagente.
  - `real-completa`, `real-resumida`: fixture do R6 (inclui "+N pedidos anteriores", ↩, cartões de
    filhas reais, "cartões antigos").
  Tons cobertos: open, current, done, interrupted, wait, running, paused, archived, agent, section,
  sent, reply (os 12 de `Tone`).
- `task-tree/tests/golden/svg.ts` (~150 KB) — `GOLDEN: Record<cenário, GoldenSvg[]>`, JSON com uma
  entrada por linha (o diff do git mostra um SVG mudado como uma linha). Gerado, não editar à mão.
- `task-tree/tests/golden/atualizar.mjs` — o modo de atualização. O kit não deixa um teste ler/escrever
  arquivo nem ver `process.env` (testado: `node:fs` e `fs` recusados ao carregar; `process` é
  `undefined`), por isso a atualização é um script de fora: copia `task-tree/` para uma pasta
  temporária só com `svg-golden.test.ts`, roda `claude plugin test`, recolhe as linhas
  `GOLDEN-NEW <cenário> <json>` que o teste emite para os cenários que diferem (ou não têm golden) e
  funde no `svg.ts`, mantendo os que batiam. Uso: `node task-tree/tests/golden/atualizar.mjs
  [claude.exe]`. Segunda rodada: "Nada a atualizar".

## Falha legível

A falha é adiada para o fim de cada teste (`verdict()`), para todos os cenários do teste serem
conferidos e emitidos numa rodada. A mensagem diz, por Svg (até 6): índice, alt, e
- se mudou tamanho/alt/interatividade: `golden 472×28 "…"; agora 472×29 "…"`;
- se mudou só a fonte: o primeiro trecho diferente (fonte partida em `>`), com o trecho anterior
  como contexto, golden × agora.

Conferido com duas mutações numa cópia: `rowHeight` 28→29 (12 Svg apontados com os tamanhos) e
`opacity=".7"`→`.6` (um trecho: `<text class="s" opacity=".7" …` × `.6`).

## Resultado

- Só o golden: 7 pass / 0 fail (3,4 s). Suíte inteira: 174 pass / 0 fail (3 arquivos, ~30 s) antes
  do acréscimo de parada/arquivada; rodada final registrada no relato.
- `claude plugin validate task-tree` e `validate .` ok (o `.mjs` em `tests/golden/` não incomoda).

## Limites (R10)

- O golden é a fonte do SVG como string, não a pintura: posição real em células, moldura
  interativa e tema do app continuam só verificáveis no app.
- `alt` entra no golden; um texto de alt mudado também falha (é intencional: o alt é o que o
  terminal lê).
- Scripts do kit em `tests/*.test.ts` não podem usar `fs`/`env`; qualquer teste futuro de
  "snapshot" segue o mesmo caminho (módulo TS + script de fora).
