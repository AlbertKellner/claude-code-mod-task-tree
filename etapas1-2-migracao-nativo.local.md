# Etapas 1 e 2 da migração para o híbrido nativo: relato

Worktree `claude-code-mod-task-tree-wt\integra`, branch `feat/painel-nativo`. Dois commits locais, sem
push, sem `--no-verify` (o hook de pré-commit passou nos dois):

- `263bb98` feat(task-tree): linhas fora de cartão em componentes nativos
- `d4813ba` feat(task-tree): cartões, rótulo de sessão e anel em componentes nativos

## Check

Etapa 1 (`npm run check` manual, antes do commit): regras 148 cobertas / 0 pendentes / 19 checklist
(167), mapa sem aviso; travas ok; selos 231 testes, 3 kits, 4 desenhos; os dois validate ok; tsc ok;
plugin test 231 pass, 0 fail (≈30 s); regressão: 231 testes de HEAD, 5 falharam, todos por decisão
registrada (os 4 de golden + o teste do título).

Etapa 2: os mesmos números; regressão com 5 falhas registradas (golden filha, envios, subagente — o
principal não tem cartão e não mudou — e os dois testes de geometria de cartão).

Nenhum teste estourou os 5 s; os três de 600 KB levaram 1,5 a 1,8 s.

## O que entrou

Etapa 1: `svg-slim.diff` (parâmetro `base` de `slim`), `draw/icons.ts` e `draw/desktop.tsx` da faixa,
`render-etapa1.diff`, mais o corte por caracteres de texto em `hooks/render.tsx`:
- `TEXT_LIMIT = 95000`; `textOf(made)` soma strings, `alt` e `label` (a fonte do Svg não conta);
- `over() = bytes > 600 KB || texto > 95.000`; a meta de cada tentativa é o menor entre a dos bytes e a
  do texto; `fitted` só guarda quando `!over()`; o aviso de emergência segue só por bytes;
- só no desktop (`e.surface === 'desktop'`): no terminal o corte por texto mudaria o desenho de
  pedidos grandes, e o contrato diz que o terminal não muda (o teste de 600 KB também afirma que o
  terminal fica inteiro).
Etapa 2: `render-etapa2.diff` (desktopTree; sai a sobreposição de Buttons e a geometria de cartão em
`render.tsx`) e o fator 0,8 por caractere `caption` no rótulo de sessão (`CAPTION`, `cap()` em
`draw/desktop.tsx`: palavra de estado, repositório/branch, toks/s, modelo, ultracode; título, guias e
paddings seguem 1 ch).

## Testes e cenários reescritos

Etapa 1 (selo `decisao`, motivo M1 do plano):
- `visual.test.ts::o título de uma linha sem contagem vai até o tempo; a com contagem corta antes da barra`
  (asserções 2 → 6): o título é um pedaço de texto igual a LONGO, `wrap: truncate-end`; na folha só o
  tempo vem depois; no pai, a contagem.
- `visual.test.ts::texto cortado não tem tooltip…` (4 → 4): o título inteiro num `Text`.
- Catálogo: `visual.titulo-sem-contagem-vai-ate-o-tempo` ganha `Reescrito: 2026-11-13…`;
  `cabecalho.limite-de-linhas-do-desenho` ganha o "Dado" com 95.000 caracteres de texto no desktop e um
  `Reescrito: 2026-11-13…` (mesma regra "Cortar os mais antigos"); `regras/visual.md` Código da área
  com `draw/icons.ts, draw/desktop.tsx`.
- Os três testes de 600 KB **não mudaram de resultado** (passam sem reajuste): não foram selados.
Etapa 2 (selo `decisao`, motivo M2):
- `…no cartão da filha, o título da folha passa da coluna da contagem e corta junto do tempo` (2 → 4).
- `…a linha ↩ do cartão, sem tempo, vai até a borda do cartão antes de cortar` (2 → 2).
- Kit `leitura.ts`: sai `svgs()` (selo `decisao`); `visual.test.ts` perde `desenhado`, `aDireita`.
- Código dos cenários: `ultracode.md:5` + `draw/desktop.tsx`; `sessoes.md` 174/185/196 +
  `draw/desktop.tsx, draw/icons.ts`; `envios.md` (6 linhas) + `draw/icons.ts`.
- Golden aprovado nas duas etapas com o motivo do usuário de 2026-11-13.

## Medidas (harness, 60 colunas; teste temporário, não commitado)

| Desenho | Linhas | Bytes | Nós | Fundo | Texto (car.) | Por linha: bytes (min–max) / nós / texto |
|---|---|---|---|---|---|---|
| principal (etapas 1 e 2, sem cartão) | 7 | 15.151 | 134 | 6 | 420 | 1.680 (1.043–2.332) / 19 / 48 |
| filha, etapa 1 (cartão em Svg) | 6 | 18.241 | 95 | 6 | 481 | 2.403 (1.043–4.088) / 15 / 64 |
| filha, etapa 2 (tudo nativo) | 6 | 16.625 | 125 | 8 | 597 | 2.065 (1.043–2.941) / 20 / 80 |
| pedido pesado (393 linhas, títulos ≈250 car.), cortado | 167 | 340.515 | 2.951 | 6 | 88.878 | 2.022 (417–2.771) / 18 / 532 |

- Sem o corte por texto (rodada de prova com o limite desligado), o mesmo pedido teria ≈156.131
  caracteres de texto (aviso do harness "156131 characters of text are drawn up to the first 100000")
  e ≈790 KB (393 × 2 KB): o teste `um pedido só acima de 600 KB… fecha com "+N linhas"` falhava (a
  linha "+N linhas" não era desenhada). Com o corte, quem manda é o texto (167 linhas), não os bytes.
- Nós: bem abaixo de 20.000 (≈18 por linha → 400 linhas ≈ 7.200). Não entrou o teste opcional de nós.

## Diferenças visuais esperadas (checklist do app)

- Guias em caracteres de caixa mono (` │ `, ` ├─`, ` └─`), 3 colunas por nível, apagadas (inactive dim).
- Na etapa 2, cartão com borda redonda nativa e fundo `userMessageBackground`; as guias de fora vão
  numa faixa de `Text mono` com `\n` à esquerda do cartão (risco: a altura da linha mono pode não bater
  com a do corpo; a faixa pode escorregar ~2 px por nível em cartão dentro de cartão).
- A coluna do rótulo de sessão some: as tarefas do cartão alinham com o busto (como no terminal).
- Barra de progresso da linha nativa (`height 0.2`, trilho `rgba(136,135,128,0.25)`, verde `success`).
- Título cortado pelo app (`truncate-end`); onde o corte cai depende do app.
- Rótulo: repositório e modelo somem mais tarde que na faixa (fator 0,8); conferir a 60 colunas se o
  conjunto ainda estoura a linha (se estourar, o app corta a branch e o nome antes).
- `ultracode` em `effortUltra`, palavra "aguardando" em `warning`.
- Cabeçalho ainda é o Svg antigo (etapa 3).

## Desvios e incertezas

1. O corte por texto vale só no desktop (motivo acima). O aviso "Painel grande demais" segue só por bytes.
2. A contagem de texto do mod (strings + `alt` + `label`) não é a do app, que não está documentada
   além de "one drawing draws 100000 characters in all"; a margem de 95.000 cobre a diferença que o
   harness mostrou (sem aviso dele depois do corte). O app real não foi visto.
3. A janela entre as etapas (painel misto: guias em caractere fora do cartão, em px dentro) existe só
   no commit `263bb98`.
4. Pintura, cliques reais, temas e larguras: nada visto no app; vai ao checklist do usuário.
5. `git apply` do `render-etapa2.diff` entrou direto (sem conflito com o corte por texto).
