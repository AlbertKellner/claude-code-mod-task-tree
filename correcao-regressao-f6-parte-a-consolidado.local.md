# correcao-regressao · fase 6, parte A — consolidado dos 10 itens (para docs e svg)

Branch `perf/fase-6-desempenho`, sobre a `main` `5a5d2f7` (fase 5). Dez commits, um por item, sem push:
4038e45, e9a3730, 9e22f89, 1c632e7, 96ab1b5, ce9c1bc, e566523, dacbd18, 684ba40, d1916f2.
Diff da parte A: 12 arquivos em `task-tree/`, +464/−73 (`git diff --stat 5a5d2f7..d1916f2 -- task-tree`).
Regra da parte A: nenhuma linha, byte ou texto do desenho mudou (goldens SVG e de textos, orçamento e
layout idênticos em todos os itens; 56/56 comparações de linhas da bancada). Nada da parte B entrou.
Notas por item: `correcao-regressao-f6-item{1..10}-*.local.md` nesta pasta (antes/depois, metas, testes).

## O que mudou no código, por área (para o DESENVOLVIMENTO.md)

### Fluxo de desenho (`draw/layout.ts`, `hooks/render.tsx`, `draw/svg.ts`)
1. Cabeçalho (`render.tsx`): o id da tarefa acesa (`current(mainTasks).lit[0]`) é calculado uma vez
   antes do `find`, não por nível 1 (era quadrático nos pedidos).
2. `layout()` monta as linhas numa passada só, com as escolhas da pessoa desde o início; saiu a
   passada sem escolhas com resultado descartado (vinha do render antigo, dos chips). Comentário e
   pendência do `DESENVOLVIMENTO.md` já ajustados no commit e9a3730 (item "O layout monta as linhas
   uma vez só…" e a pendência "Sobra da etapa 1 do layout: `elapsed` não é usado").
3. `split()` devolve o cartão já cortado (`c.part` definido) antes de calcular `breaks`.
6. Os pedidos (turnos) com tarefa de nível 1 são filtrados por um `Set` dos turnos das tarefas, em
   `panel()` (cartões antigos) e em `openTurn` (`hooks/panel.ts`).
9. `split()`: a parte de cada turno, as tarefas e o `flat` de cada parte e a parte de cada tarefa
   (`holder`) em mapas, uma vez por chamada; o dono (`ownerOf`) lembrado por agente; `turns` e `work`
   dos cartões filtrados por `Set`.
10. `atWork` lembrado por tarefa dentro da passada de `panel()` (`WeakMap`): `turnRows` e `rows`
    pedem o mesmo trabalho; uma chamada por tarefa e passada.
7. `fit` (`svg.ts`) acumula a largura do que fica (mesmos termos, mesma ordem que `textW`: mesmo corte
   em ponto flutuante); `em(ch)` lembrado por caractere num `Map` do módulo.
8. `slim` (`svg.ts`) guarda a folha `<style>` por conjunto de classes num `Map` do módulo (chave: os
   atributos `class` na ordem em que aparecem, lidos numa passada; cap de 1 000).

### Publicação (`io/publish.ts`, `hooks/panel.ts`, `state/durability.ts`)
4. `publishWait` monta o corpo do arquivo sem `at`, `context.at` e `panes`, compara com o último
   publicado para o caminho (`lastPublished`, `Map` do módulo, chave = corpo + `percent`) e só grava
   quando muda; `ui.panes` e o relógio só são pedidos na gravação. Formato do arquivo igual (mesmos
   campos, mesma ordem, `PUBLISHED_VERSION` 1). `waitFile` guarda o `home` (uma ida ao host por
   módulo). `saveLinks` grava o registro de ligações no store só quando muda (`lastLinks`);
   `showStatus` chama `ui.status` só quando o texto muda (`lastStatus`). Tabela de durabilidade:
   linhas novas `lastPublished, lastLinks, lastStatus` e `home` (vivem no módulo; uma recarga grava
   cada um uma vez a mais, sem dano).

### Poll das filhas (`hooks/sessions.ts`)
5. `refreshChildren` lê o state, deriva as filhas e só grava `children` quando a lista derivada
   difere da atual (JSON); `childrenError` só quando o texto muda; a lista vazia é limpa uma vez.
   `ended` continua vindo de `deriveChildren`. Cadência do poll inalterada (3 s).

## Medidas (bancada `docs/analises/medicoes/fase6/run6.sh`, mesma máquina, hoje; medianas)

| Medida | Antes | Depois | Meta do relatório |
|---|---|---|---|
| Cabeçalho, caso real / 1 000 níveis 1 / 3 000 | 2,2 ms / 185 / 2 200 | 0,1 / 1,2 / 3,0 | ≤ 2 ms a 1 000, ≤ 6 a 3 000 ✓ |
| `layout()` real completa / resumida | 8,9 / 7,8 ms | 4,2–5,8 / 2,8–3,9 | REAL ≤ 5 ✓ (mín 3,0) |
| `layout()` O2500 completa | 57,7 ms | 17,6 | ≤ 20 ✓ (na última rodada; 26 numa rodada carregada) |
| `breaks` por desenho, resumida real | 323 (310 recálculos) | 154 (= completa) | ≤ completa + cartões ✓ |
| Poll real sem mudança: parede | 45–60 ms (24,5 sem o hook) | 9–12 ms | ≤ 25 ✓ |
| Poll real sem mudança: bytes gravados / `store.set` / idas ao host | 220 KB / 1 / 20 | 0 KB / 0 / 8 | 0 / 0 / ≤ 12 ✓ |
| `state.set` de `children` por poll sem mudança | 1 | 0 | 0 ✓ |
| `layout()` T3000 completa (3 000 pedidos) | 64,8 ms | 10,4 | ≤ 16 ✓ |
| `fit`, 400 linhas a 40 colunas | 10,2 ms | 0,8 | ≤ 1,5 ✓ |
| `slim`, 400 linhas | 2,7 ms | 0,5 | ≤ 0,5 ✓ |
| `rowSvg`, 400 linhas a 40 colunas / real | 18,1 / 1,5 ms | 2,9 / 0,5 | |
| `split`, filha com 500 pedidos e 20 rodadas / 200 e 20 / reais | 18,2 / 6,8 / 0,5–0,7 ms | 1,1 / 0,4 / 0,2–0,5 | ≤ 2 ✓ / ≲ 1 ✓ / ≤ 0,3 (4 de 5) |
| `atWork` por passada, 3 000 níveis 1 | 12 000 (6 000 após o item 2) | 3 000 | ≤ 1 por nível 1 ✓ |
| Desenho real inteiro no kit, completa / resumida (terminal) | 17 / 17 ms | 11 / 8 | |

Observação da bancada: `patch6.mjs` ancora no texto antigo em 6 trechos (cabeçalho, passada do
`layout`, `split`, `update(children)`, `publishWait` usage/fs.write, `ats`, `slim`); medi com uma cópia
em scratchpad com as âncoras adaptadas; a cópia oficial em `docs/analises/` precisa dessa atualização
(fora do meu escopo; não editei `docs/analises/`). Artefato pré-existente no `orcamento.test.ts`: o host
devolve `t += 1000` a cada `clock.now`, então em 2 de 14 rodadas os tamanhos saíram ±14/16 bytes (tempo
decorrido desenhado), dentro da folga de 1,5×; registrado para a parte B (relógio).

## Testes
316 → 325 (9 novos): cabeçalho com 300 níveis 1 (2, `task-tree.test.ts`); publicar só quando muda
(3, `publicado.test.ts`); `fit` contra a regra antiga (2, `hooks-puros.test.ts`); cartões e linhas de
uma filha funda fixados (2, `layout.test.ts`). Validate ok em todos os itens. Bugs encontrados: nenhum.

## Conferências de fechamento

- **svg-task-tree** (2026-10-22): só leitura em `d1916f2`; `git diff --stat 5a5d2f7 d1916f2 -- task-tree/tests/golden`
  vazio (svg.ts e textos.ts iguais nos 10 commits) e `-- docs/task-tree-proposta-visual.svg` vazio; nada
  editado, o SVG não muda. Não rodou a suíte nem a bancada (para não disputar com as minhas rodadas):
  a suíte verde (325, 0 GOLDEN-NEW / TEXTOS-NEW) fica pelas minhas 2 rodadas por item.
- **docs-task-tree**: pendente.
- **docs-task-tree** (2026-10-22): `task-tree/DESENVOLVIMENTO.md` atualizado no working tree, 10 hunks
  (+105/−27), só "Como é hoje" (intro, fluxo de dados, estado e durabilidade, arquivo publicado, desenho,
  seção nova "Desempenho (fase 6, parte A)", testes 316 → 325 e contagens por arquivo); 538
  identificadores e os 13 números da tabela conferidos; não rodou testes. Patch só com os 10 hunks
  (sem a seção local do clone): `correcao-regressao-f6-parte-a-desenvolvimento.patch` nesta pasta,
  `git apply --cached --check` ok.
- **Sinal final à governança** enviado com o patch, a mensagem `docs(task-tree): DESENVOLVIMENTO.md com a
  fase 6, parte A (desempenho sem mudança visual)` e o relato da parte A.
