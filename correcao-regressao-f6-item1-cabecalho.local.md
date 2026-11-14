# correcao-regressao · fase 6, parte A, item 1 — cabeçalho calcula a tarefa atual uma vez

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Branch `perf/fase-6-desempenho`, sobre `5a5d2f7`
(fase 5). 2026-10-22. Fluxo da fase 6: sem ok do usuário entre itens; sinal do commit à governança
(que roda a suíte, commita e devolve o hash) antes do item seguinte.

## O que mudou

`task-tree/hooks/render.tsx`: o cabeçalho procurava a tarefa de nível 1 acesa com
`mainTasks.find(t => t.id === current(mainTasks).lit[0])`, e `current()` (um `flat` da árvore inteira,
ordenação e `pathTo`) rodava uma vez por nível 1 percorrido pelo `find`: quadrático nos pedidos quando a
tarefa em andamento não é a primeira da lista (o caso normal) ou não há nenhuma. Agora
`const lit = current(mainTasks).lit[0]` é calculado uma vez e o `find` compara com ele. O segundo `find`
(`atWork(...).busy`) continua igual e só roda quando o primeiro falha. Mesma expressão, mesma tarefa.

`task-tree/tests/task-tree.test.ts`: describe novo "cabeçalho com muitos níveis 1", 2 testes semânticos
(sem tempo): com 300 níveis 1 e a última em andamento, o título do cabeçalho é o dela; com nenhuma em
andamento e as duas primeiras concluídas, o título é o da primeira aberta e a contagem é "2 de 300".

## Medidas (bancada `run6.sh`, mesma máquina, cópia instrumentada no scratchpad; mediana)

Camada do kit (mod inteiro, fase "cabeçalho (headTask)" do `ui.render`, sem o hook de contagem):

| Cenário | Antes | Depois | Parede do desenho antes → depois |
|---|---|---|---|
| REAL desktop/completa | 1,9 (1,8) ms | 0,2 (0,1) ms | 17,4 → 14,0 ms |
| REAL terminal/resumida | 2,2 (2,1) | 0,2 (0,1) | 16,9 → 14,1 |
| T300 desktop/completa | 87,8 (87,5) | 0,4 (0,3) | 103 → 15,8 |
| T300 terminal/resumida | 77,5 (77,4) | 0,4 (0,4) | 87,8 → 11,7 |
| T1000 desktop/completa | 995 (995) | 1,9 (1,3) | 1 025 → 48,5 |

Camada pura (a expressão do cabeçalho chamada direto; a coluna "içado" é a expressão que o código tem
agora): REAL 2,2 → 0,1 ms; D1000 (nenhuma em andamento) 185 → 1,2; D1000 (última) 236 → 0,3; D3000
(nenhuma) 2 200 → 3,0; T300 77,6 → 0,3; T1000 929 → 0,6. `sameTask: true` em 27/27 cenários, `same:
true` em 56/56 comparações de linhas das variantes.

**Meta do relatório: cabeçalho ≤ 2 ms com 1 000 níveis 1, ≤ 6 ms com 3 000 → 1,2 e 3,0 ms. Atingida.**

Observação da bancada: `patch6.mjs` ancora no texto antigo do `headTask`; para medir o "depois" usei
uma cópia da pasta `medicoes/fase6` no scratchpad com só essa âncora adaptada ao texto novo (nada em
`docs/analises/` foi alterado). A bancada oficial precisará dessa âncora atualizada quando o relatório
for revisado (fora do meu escopo).

## Testes

- Suíte inteira: **318 pass / 0 fail** em 2 rodadas (316 + 2 novos). `validate task-tree` ok.
- Golden SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`) e orçamento (11657 / 11775 / 47400 /
  48162) iguais: nenhuma linha, byte ou texto do desenho mudou.

## Commit sugerido

Arquivos: `task-tree/hooks/render.tsx`, `task-tree/tests/task-tree.test.ts`.
Mensagem: `perf(task-tree): cabeçalho calcula a tarefa atual uma vez, fora do find`

Fora do commit (não são meus): `task-tree/DESENVOLVIMENTO.md` (seção local do clone), `docs/analises/`,
`scripts/`.

## Bugs encontrados

Nenhum neste item.
