# correcao-regressao · R15 — `MAX_ROWS` sobre `Row[]` + `drawSize`/`rows` publicados

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 5 da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## O que entrou

- `task-tree/hooks/register.tsx`:
  - `MAX_ROWS = 400` e `limitRows(rows)`, aplicado em `ui.render` logo depois de `panel()` (antes de
    `guides`, `labelCols`, molduras e qualquer SVG). Abaixo do limite, devolve a lista como está.
    Acima: tira **blocos inteiros** de nível 0 (uma linha de profundidade 0 e tudo que pende dela)
    **do começo** (os mais antigos) até caber em 399, e põe na frente a linha de seção
    `+N linhas anteriores` (alt "Linhas anteriores, não desenhadas"); as linhas recentes, onde está o
    trabalho, ficam. Se o último bloco sozinho passa do limite, o que vinha antes dele sai inteiro
    (`+N linhas anteriores`), o bloco é desenhado até o limite e fecha com `+N linhas`
    (profundidade 1, alt "Linhas seguintes, não desenhadas"). Total sempre ≤ 400 linhas.
  - `drawRows` (linhas do último desenho, depois do corte) e `drawSize` (já existia) publicados no
    arquivo (`publishWait`). `DRAW_LIMIT` (600 KB) continua como último recurso.
- `task-tree/types/index.d.ts`: `drawSize?: number` e `rows?: number` em `Published` (campos
  informativos; os leitores não os usam).
- `task-tree/tests/limite-linhas.test.ts` (novo, 4 testes): 150 grupos × 4 etapas abertas (750
  linhas) → 400 linhas com `+N linhas anteriores` na frente, contagem fecha em 750, grupo 149
  desenhado e grupo 0 não, sem "Painel grande demais", desktop < 600 KB; um bloco de 700 etapas →
  399 linhas + `+302 linhas`; 100 linhas → nada muda; `rows`/`drawSize` no arquivo publicado.
- `task-tree/tests/task-tree.test.ts`: o teste "desenho grande demais" (700 etapas abertas) passou a
  esperar o corte por linhas (sem o aviso; `+302 linhas`; < 600 KB), com o nome ajustado.

## O que muda de visual (só em painéis enormes)

Caso real (31 linhas) e tudo até 400 linhas: **igual** (golden e orçamento intactos). Acima de 400
linhas, o que hoje é a linha única de aviso "Painel grande demais (N KB): mostrando só o essencial…"
passa a ser:

```
<cabeçalho>
+350 linhas anteriores            ← seção cinza, como "+N pedidos anteriores"
○ Grupo 62  0/4
├─ ○ Etapa 0 do grupo 62
…                                  ← até 399 linhas, as mais recentes
└─ ◉ Etapa 3 do grupo 149
```
ou, para um bloco só (um plan com 700 etapas):
```
◉ Enorme  0/700
├─ ○ Etapa 0
…
├─ ○ Etapa 397
   +302 linhas                     ← seção cinza, no fim
```
O cabeçalho conta o que está desenhado (regra do `8ee40f8`); a sessão inteira fica no tooltip. O
aviso de 600 KB só aparece se 400 linhas passarem de 600 KB (~1,5 KB/linha; hoje ~1 KB).

## Decisões

- `MAX_ROWS = 400`: o `05` sugere "ex.: 400"; o `DRAW_LIMIT` é atingido com ~600 linhas no desktop.
- Corte do começo, por blocos: o painel desenha do mais antigo ao mais recente, com o trabalho
  atual no fim; cortar o fim esconderia o que importa; cortar no meio de um bloco quebraria as
  guias (um primeiro row com profundidade > 0 sem ancestral).
- Não mexi em `SHOWN_TURNS` nem no `DRAW_LIMIT`.

## Testes

194 pass / 0 fail (6 arquivos; +4); `claude plugin validate task-tree` e `validate .` ok. Golden do
SVG e orçamento inalterados.

## O que conferir no app

Nada muda no caso real. Para ver o corte: um `plan` com mais de 400 etapas abertas.

## Fase 1 depois deste item

Falta **R20** (resíduos: `tests:109–119`, `rowSvg` com `r.ring` em tarefa, `pinned`, `_up`,
`topRing/Work.ring`). Depois, fase 2.
