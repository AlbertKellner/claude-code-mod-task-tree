# Cabeçalho V4 ("Respiro"): análise de implementação

Só leitura; nada implementado nem commitado. Código lido por `git show origin/main` (`d2566cb` + o que entrou depois; o PR #29 ainda aberto). Mockup de referência: `cabecalho-propostas-v2\v4-respiro-<tema>-<largura>.svg` e o `gerar.mjs` da mesma pasta (função `v4`), com a faixa por estado na página `propostas-cabecalho-v2.html`.

## Essencial

- **Escopo:** só o desenho do cabeçalho no desktop. Cabe em `draw/svg.ts` (`headerSvg`, `chips` → pílulas, a função pura do **estado geral** e 5 classes de cor novas na paleta), `draw/geometry.ts` (`HEADER_H` 100 → 116) e `hooks/render.tsx` (passa o estado geral ao `headerSvg`, a faixa de hover do título cresce de 28 para 40 px, o `alt` ganha o estado geral). `draw/motion.ts` **não muda**: a barra (`grf bar`) e as pílulas (`ch-<tom>`) mantêm as classes que a animação lê. A linha do terminal, o kit (`cabecalho()`), as contagens e as regras de contagem não mudam.
- **Golden:** os 3 cenários mudam de desenho. A mudança fica sem commit até ele validar o painel no app; com o "funcionou", `npm run golden:aprovar -- --todos --motivo "\"<palavras>\", 2026-11-03"`.
- **Catálogo:** reescrever `visual.cabecalho-em-cartao`, `visual.cabecalho-barra-e-chips-desenhados` e os três `visual.desenho-*` (`Reescrito: 2026-11-03, "gostei da V4, siga para análise e implementação"`); regra nova `visual.faixa-de-estado-geral` (coberta por um teste que lê a classe da faixa no SVG, sem golden).
- **Branch:** `feat/cabecalho-v4` a partir de `origin/main`, independente do PR #29. O PR #29 toca `svg.ts` só em `rowSvg` (as seções que abrem) e `render.tsx` só no terminal: **sem conflito** com o cabeçalho; o merge depois é limpo.
- **Impacto:** `npm run impacto -- draw/svg.ts draw/geometry.ts draw/motion.ts` → 33 cenários (cabeçalho, visual, golden); com `hooks/render.tsx`, núcleo: tudo. O check roda tudo.
- **Uma decisão de produto pequena** (seção 7): a cor da faixa quando só há tarefas pendentes, nada iniciado. Recomendação: cinza apagado ("parado").

## 1. Especificação da V4

Coordenadas em px do SVG do cabeçalho, `W` = largura do slot (`lineWidth(colunas)`), `R = W − HEADER_PAD`, `L = HEADER_PAD + 8` (a faixa ocupa os 8 px). Fonte: a do sistema (como hoje). Cores pelas classes da paleta `LIGHT`/`DARK` (`p` texto, `s` texto apagado, `amf`/`grf`/`gyf` preenchimentos, `tr` trilho, `cd`/`cs` cartão).

| Elemento | Posição e medidas | Texto/cor |
|---|---|---|
| Altura | `HEADER_H` = **116**; o cartão de `CARD_RIGHT` a `H − HEADER_GAP − CARD_RIGHT` (como hoje, `cardSlice`) | `cd`/`cs` |
| **Faixa de estado** | dentro da borda esquerda, **5 px** de largura, altura inteira do cartão, acompanhando o raio dos cantos (um `path`: arco de 7 px em cima e embaixo); grupo `<g class="fx fx-<tom>">` | cor do estado geral (tabela abaixo); "aguardando" com `opacity=".5"` |
| Título | `x=L`, baseline `y=30`, **16 px**, peso 600; cortado com `fit` em `R − ICONS_W − L − bloco`; o inteiro vai ao `<title>` (tooltip) quando cortado | `p` |
| Contexto | `gitSvg` como hoje, em `x=L`, `cy=48`, 12 px: repositório + branch; sem espaço, só a branch; sem espaço, nada | `s` |
| Barra | `x=L`, `y=66`, altura 4, largura `R − L − bloco − 20`; trilho `tr`; preenchida `class="grf bar"` com `width` em px (a animação lê) | `tr` / `grf` |
| **Pílulas** (os chips) | baseline `y=98`; cada uma: `rect` `y=82`, altura 22, `rx=11`, largura `30 + textW(texto, 12)`; ícone do tom em `(x+13, 94)` (o mesmo `icon(tom)` de hoje; `current` = anel âmbar com ponto); texto em `x+23`, 12 px, classe `p`; 8 px entre pílulas; grupo `<g class="ch-<tom>">` | fundo: cor do tom a 13 % (classes novas: `amp`, `gyp`, `grp`, `blp`); "sessão ativa" em azul |
| Pílulas apertadas | como os chips hoje: se as quatro com palavras não cabem em `R − L − bloco − 20`, só o número; corta as que não cabem | |
| **Bloco de números** (mostrador) | alinhado à direita em `bx = R − ICONS_W − 6`, `text-anchor="end"`, tabular; largura reservada `bloco` = 130 (largo) / 76 (estreito) | |
| · `79%` | `y=54`, **26 px** (estreito: 20 px), peso 700 | `p` |
| · `15 de 19` | `y=74`, 12 px | `s` |
| · `21:50 · 79 toks/s` | `y=92`, 12 px; o toks/s a 45 % de opacidade quando não é ao vivo (como hoje); estreito: só o tempo | `s` |
| Botões ≡/▤ | onde estão: `Box` absoluto no canto superior direito do slot, dentro de `ICONS_W`, chaves `view:summary`/`view:full`; o título reserva `ICONS_W` como hoje | |
| Tooltip | a camada de hover do título cresce para `hoverLayer(top.source, W − ICONS_W, 40)` (o título desceu para y=30); continua **um** tooltip por cabeçalho (o `<title>` do nome inteiro), como hoje | |
| `alt` | o de hoje + ", estado geral: <palavra>" | |
| Vazio (`n + x = 0` e sem chips) | "Tarefas" em `y=30` 16 px e "Nenhuma tarefa planejada." em `y=52`; faixa cinza; sem bloco | |

**Estreito (60 colunas, W = 432):** `bloco` = 76; o título cabe em ~245 px (`fit`); contexto cai para a branch sozinha (regra atual de `gitSvg`); pílulas só com número; mostrador 20/12/12 px, sem toks/s. **Largo:** tudo com palavras; o título cresce até `R − ICONS_W − L − 130`.

**Cor da faixa pelo estado geral** (função pura `headerState`, em `draw/svg.ts` ou `draw/layout.ts`, a partir do que o cabeçalho já conta em `render.tsx`: `active`, `resting` + avisos, `tally(live)`, `x`, `d`, `n`, pendentes):

| Ordem | Estado geral | Tom (`fx-<tom>`) | Cor | Quando |
|---|---|---|---|---|
| 1 | em andamento | `current` | âmbar `amf` | `active > 0` |
| 2 | aguardando | `paused` | âmbar a 50 % | `active = 0` e (avisos de espera > 0 ou `resting > 0`) |
| 3 | sessão ativa | `running` | azul `blf` (classe nova) | nada próprio em andamento e `tally(live) > 0` |
| 4 | tudo concluído | `done` | verde `grf` | `n > 0` e `d = n` e sem pendentes |
| 5 | interrompido | `interrupted` | cinza `gyf` | nada aberto e `x > 0` |
| 6 | parado | `open` | trilho `tr` (cinza apagado) | o resto (só pendentes, nada iniciado) — ver seção 7 |

Classes novas na paleta (`LIGHT`/`DARK`): `blf` (fill azul: `#378add` / `#85b7eb`), `amp`/`grp`/`gyp`/`blp` (fill da cor com `fill-opacity:.13`). A folha de estilo já é montada só com as classes usadas no desenho (`rules(set)`), então acrescentar à lista basta.

## 2. Arquivos e funções

**`draw/svg.ts`**
- `headerSvg(title, d, n, list, W, time, rate, git, state)`: ganha o parâmetro `state` (o tom da faixa) e é reescrito com as posições da seção 1. Mantém: `cardSlice`, `fit`/`tip` do título, `gitSvg` do contexto, `class="grf bar"` com `width` em px e `style="width:…"` (o `slot(W)`), `<g class="ch-<tom>">` em cada pílula, `slim(...)`.
- `chips(...)` continua devolvendo `Chip[]` (tom + texto); o desenho das pílulas é novo (`pill(chip, x)`).
- `headerState(...)` nova, pura, com a tabela acima; `LIGHT`/`DARK` com as 5 classes novas.
- O `envelope`/`icon` não mudam.

**`draw/geometry.ts`**: `HEADER_H = 116`. Quem depende: `headerSvg` (a altura do SVG), o slot em `render.tsx` (usa `top.height`), as medições de `DESENVOLVIMENTO.md` (só texto). Nada em `overlays` (as linhas da árvore não mudam).

**`hooks/render.tsx`**
- Calcula o estado geral com as contas que já tem (`active`, `resting`, `tally(r => r.live)`, `x`, `d`, `n`, `pending`, os avisos) e chama `headerSvg(..., state)`.
- A camada de hover do título: altura 40 em vez de 28 (duas ocorrências: `hoverLayer(top.source, W - ICONS_W, 28)` e o `height` do `Svg`).
- `alt`: acrescenta ", estado geral: <palavra>".
- Os botões (`chrome.views`) e o terminal (`drawTerminal`, a linha "d de n · p%") **não mudam**.

**`draw/motion.ts`**: nada. `chipIn` acha `ch-<tom>` (pílulas), `growFrom`/`barOf` acham `grf bar`. A faixa e o `%` trocam sem animar (o `%` é texto; animar o número seria regra nova, fora do escopo). Sem piscar: as chaves (`head@<visão>#chip:<tom>`, `#bar`) continuam as mesmas, então a marcação de "novo"/"mudou" é a de hoje.

**O que não muda:** a linha do terminal (o kit `cabecalho()` a lê), `chips()` e as contagens (`count`, `active`, `pending`, `resting`), `layout.ts`, o arquivo publicado, os textos ao modelo.

## 3. Catálogo e testes

| Regra | Ação |
|---|---|
| `visual.cabecalho-em-cartao` | reescrever: "o cabeçalho é um cartão com faixa de estado à esquerda, título, contexto, barra, pílulas e o bloco de números à direita" + `Reescrito: 2026-11-03, "gostei da V4, siga para análise e implementação"` (e a escolha da P5: "gostei da P5, mantenha como guia") |
| `visual.cabecalho-barra-e-chips-desenhados` | reescrever: barra e **pílulas**; `checklist` (pintura real) |
| `visual.desenho-principal`, `-cartao-filha`, `-envios` | `Reescrito:` com as palavras acima; o golden regravado na aprovação |
| `cabecalho.chips-contam-folhas` | só o texto ("pílulas"); o teste não muda (lê o terminal) |
| **nova** `visual.faixa-de-estado-geral` | Dado/Quando/Então = a tabela da seção 1; Origem: decisão do usuário, 2026-11-03 (V4 com a faixa por estado, página v2); `coberto` |

**O que o harness cobre do SVG:** o `source` de cada `Svg` (via `svgs()` do kit). Dá para afirmar, sem golden:
- a faixa: `source` do cabeçalho contém `class="fx fx-current"` com uma tarefa ◉; `fx-paused` depois do fim do turno; `fx-running` com filha viva e nada próprio ◉ (o `host` do kit); `fx-done` com tudo ✓; `fx-interrupted` com Esc e nada aberto; `fx-open` com plano sem `start`. Teste novo `tests/visual.test.ts` (ou em `cabecalho.test.ts`) com `// Regra: visual.faixa-de-estado-geral`; selo `novo`.
- as pílulas: `class="ch-current"` etc. continuam no cabeçalho (não-regressão da animação): uma asserção no mesmo teste.
- O **desenho** (posições, tamanhos) só o golden cobre: os 3 cenários.

`npm run impacto`: `draw/svg.ts draw/geometry.ts draw/motion.ts` → 33 cenários; `hooks/render.tsx` → núcleo: tudo.

## 4. Golden

Todos os cenários desenham o cabeçalho, então `principal`, `filha` e `envios` mudam. Fluxo (regra do `CLAUDE.md`): a Implementação faz a mudança; `npm run check` falha em "o desenho de principal/filha/envios mudou"; a mudança **fica sem commit**; ele valida o painel no app (os dois temas, pane largo e estreito); com o "funcionou" dele, `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", 2026-11-03"`; `npm run check` verde; commit único com código, `svg.ts` do golden e `selos.json`.

## 5. Branch

`feat/cabecalho-v4` a partir de `origin/main`. O PR #29 (`feat/filha-completa-na-orquestradora`) muda `draw/layout.ts` (72 linhas), `draw/svg.ts` só em `rowSvg` (a seção que abre), `hooks/render.tsx` só no `drawTerminal`, mais testes e tipos. O cabeçalho mexe em `headerSvg`, `chips`, a paleta e `drawDesktop`/o cálculo do `alt`: hunks diferentes, **sem conflito** esperado. Ordem de merge indiferente; se os dois tocarem `regras/visual.md` ou `selos.json` (golden), o segundo a entrar re-roda `golden:aprovar` com a aprovação já dada (o desenho combinado é o mesmo).

## 6. Riscos

- **Largura estimada:** o bloco de 130/76 px e as pílulas dependem de `textW`. Em fontes mais largas que a estimativa, o título ou a última pílula podem encostar no bloco; o corte (`fit`, "só o número") já trata. Validar no app em 60 colunas e no pane largo.
- **Recorte à direita:** o `%` em 26 px com `text-anchor="end"` em `bx` fica a 6 px de `ICONS_W`: não invade os botões. Conferir que o `slot(W)`/largura real não desloca o `end` (hoje as métricas são à esquerda; é o primeiro texto alinhado à direita no cabeçalho; as linhas da árvore já usam o mesmo truque).
- **Pane muito estreito** (abaixo de ~45 colunas): o título pode sumir atrás do bloco; regra: o bloco tem prioridade sobre o título, o título sobre o contexto. `fit` com mínimo de 24 px já existe.
- **Recarga do clone:** `svg.ts`, `geometry.ts` e `render.tsx` de uma vez (cópia no scratchpad), `npm run check` antes do passo seguinte.
- **Animação:** com as classes mantidas, nada novo pisca; a faixa troca de cor seca (aceitável; se incomodar, uma `piece` nova em `motion.ts` numa rodada seguinte).
- **`DESENVOLVIMENTO.md`** cita `HEADER_H = 100` e o cabeçalho antigo: atualizar a linha (docs aprovados neste escopo).

## 7. Decisão de produto (uma)

**Faixa com só pendentes, nada iniciado** (plano recém-feito, antes do primeiro `start`): (a) **cinza apagado, "parado"** (recomendado: nada aconteceu ainda; o âmbar diria "em andamento" sem `start`, contra a regra "sem start, nada acende"); (b) âmbar claro como "aguardando"; (c) sem faixa. Sem resposta, a Implementação segue (a).

## 8. Brief para a Implementação

Branch `feat/cabecalho-v4` a partir de `origin/main`. Um commit local, **depois** da validação dele no app (o golden muda). Sem push.

1. `draw/geometry.ts`: `HEADER_H = 116`.
2. `draw/svg.ts`: `headerState` (tabela da seção 1, com a decisão da seção 7); classes `blf`, `amp`, `grp`, `gyp`, `blp` em `LIGHT`/`DARK`; `headerSvg(..., state)` com as posições da seção 1; pílulas em `<g class="ch-<tom>">`; barra com `class="grf bar"` e `width` em px; faixa em `<g class="fx fx-<tom>">`; o vazio e o `alt` como descritos.
3. `hooks/render.tsx`: calcular o estado geral e passar a `headerSvg`; hover do título com 40 px; `alt` com o estado.
4. Escrever os três de uma vez; `npm run check`: só o golden deve acusar.
5. Catálogo (seção 3): as reescritas com `Reescrito:` e a regra nova; `tests/visual.test.ts` com os 6 estados da faixa e as classes das pílulas (selo `novo`); `DESENVOLVIMENTO.md`: a linha do `HEADER_H` e um parágrafo do cabeçalho novo.
6. Pedir a validação dele no app (claro e escuro; largo e 60 colunas; um plano em andamento, um aguardando, uma filha viva, tudo concluído). Com o "funcionou": `npm run golden:aprovar -- --todos --motivo "\"<palavras>\", 2026-11-03"`; `npm run check` verde; commit.
7. Relato: hash; check; `npm run testes:alterados` (nenhum teste existente mudou); `npm run impacto` (núcleo: tudo); as palavras dele na aprovação.

Commit: `feat(task-tree): cabeçalho V4 — faixa de estado, título em 16 px, pílulas e bloco de números (116 px)`.
