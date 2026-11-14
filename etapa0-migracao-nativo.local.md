# Etapa 0 da migração para o nativo: relato

Commit local `72f6fe1` na worktree `claude-code-mod-task-tree-wt\integra`, branch `feat/painel-nativo`:
`test(task-tree): leitura do desenho do app por key, texto e alt; golden da árvore`. Não houve push. O
código do mod (`task-tree/` fora de `tests/`) não mudou.

## Check

`npm run check` manual, tudo ok: regras (148 cobertas, 0 pendentes, 19 checklist, 167 no total; mapa
sem aviso), travas, selos (231 testes, 3 arquivos do kit, 4 desenhos), os dois validate, tsc, plugin test
(231 pass, 0 fail, 34 s), regressao (230 testes de HEAD contra o código novo, 0 falharam). O hook de
pré-commit passou (os validate foram pulados porque os arquivos deles não mudaram).

## `npm run testes:alterados` (resumo; a saída inteira está em scratchpad/alterados.txt)

- cabecalho.test.ts, os 3 testes de 600 KB: decisao, asserções 7→7, 7→7, 6→6
- golden.test.ts, `golden: principal|filha|envios|subagente`: decisao, 0→0
- taxa.test.ts, `no fim do turno o último número fica aceso, sem "(último turno)"`: decisao, 2→2
- ultracode.test.ts, os 4 testes: decisao, 3→4, 5→5, 1→1, 3→3
- visual.test.ts, as 2 faixas (5→5, 3→3) e o tooltip (3→4): decisao
- Novo: `visual.test.ts::no app, o ícone da linha que recolhe e o anel do cartão são botões com chave` (selo novo)

Os kits `leitura.ts` e `ambiente.ts` foram selados como decisao, com o motivo M do plano.

## Catálogo

`Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod …"): …` em:
- visual: tooltip (e o Então reescrito), golden-gera-desenho (4 cenários, árvore e fontes dos Svg; Dado e
  Então reescritos), desenho-principal, desenho-cartao-filha (o anel), desenho-envios, desenho-subagente,
  faixa-de-estado-geral;
- taxa.fim-do-turno-fica-aceso; ultracode: cartao-da-filha, so-o-interruptor-real, cabecalho,
  subagente-sem-palavra; cabecalho.limite-de-linhas-do-desenho.
- Cenário novo `visual.botoes-por-chave` (coberto, `Código: hooks/render.tsx`). A origem cita as palavras
  do usuário de 2026-10-21 e os commits 3c4e7df e e5fd006.

## Kit, golden, scripts

- `leitura.ts`: o bloco da seção 2.2 (Pedaco, LinhaDoApp, DesenhoDoApp com nos/fundo, noApp, montarNoApp,
  primeiraDoApp, linhaDoApp, pedacosDepois, estadoGeral por pedaço, emTextoDoApp, arvoreDoApp,
  desenhoDoApp). `svgs()` fica e passa a usar `svgsDe(raiz)`, o mesmo andar que `d.svgs` usa.
- `ambiente.ts`: `Filha.contexto` (publica `context: { percent, at: AGORA }`) e `Host.pedidosAoApp()`.
- O golden passa para `tests/golden/desenho.ts` (git mv), no formato `{ arvore, svgs }`, com 88 KB e 7
  fontes de Svg no cenário da filha. O anel entra ("contexto da sessão"). A árvore não leva `press`,
  `part` nem `group`: as props vistas são só de Box, Svg e Button. Aprovado com o motivo do plano.
- `selos.mjs` (GOLDEN e o comentário) e `travas.test.mjs` (caminho e exemplo `{arvore, svgs}`).

## Desvios do plano

1. **LONGO de cabecalho.test.ts é `.repeat(3).trim()` (≈ 250 caracteres), não `.repeat(10)`.** Com
   `.repeat(10)` (e também com `.repeat(5)`), o teste `um pedido só acima de 600 KB…` falha no desenho de
   hoje. O harness avisa "ui.render (Pane): 153881 characters of text are drawn up to the first 100000",
   corta o texto que passa disso ("… 841 more characters, not drawn") e a linha "+N linhas" não chega
   inteira. Com `.repeat(3)`, o pedido sozinho mede 583 KB, 288 linhas, 975 nós e 77.629 caracteres de
   texto (alt). Os três testes levam de 0,7 a 2 s. O comentário do teste explica o limite.
   **Risco para a etapa 1:** o limite de 100.000 caracteres de texto vale no harness. A correção 16 do
   plano diz que ele não vale para o Pane, mas pelo menos o `drawn()` do harness o aplica. O alt parece
   contar como texto. No nativo, o título vai duas vezes (Text e alt), então ≈ 290 linhas com título de
   250 caracteres passam de 100k caracteres antes de chegar a 600 KB. A calibração da etapa 1 precisa
   olhar os dois limites (bytes e caracteres de texto). Pode até ser preciso o mod cortar também por
   caracteres de texto. Vale conferir na sonda se o app real aplica o mesmo limite.
2. A linha de assinatura do commit é `Claude Opus 5.5`, como o pedido mandou (o plano dizia Fable 5.2).
3. `cabecalho.test.ts`: em vez de `cortes(d)`, há um helper de topo `cortado($)` = `noApp` mais `antes` e
   `depois` sobre `d.textos`. A constante `AVISO` saiu porque o kit já calcula `aviso`. Nenhum nome de
   topo novo colide com outros testes: `node scripts/selos.mjs` só listou os 15 esperados mais o novo.
4. No teste novo, o anel é apertado antes do ícone de dobrar, porque dobrar "Plano A" esconde o cartão.

## O que não deu / fica para depois

- `scripts/golden.mjs --pagina` segue no formato antigo e quebra com o golden novo. Pelo plano, isso vai
  num commit próprio da faixa paralela. O comentário da linha 6 ainda diz `svg.ts`.
- A key de `Text` no `drawn()` não foi sondada aqui (é da etapa S).
