# Faixa "Cabeçalho" — entrega (2026-11-13)

Arquivos: `head.tsx` (vai para `task-tree/draw/head.tsx`) e `render-etapa3.diff` (contra o
`hooks/render.tsx` de `b7d2a50`, a HEAD de `integra`). Conferido numa worktree descartável
(`faixa-head`, já removida) com um `draw/icons.ts` provisório: `npx tsc --noEmit -p task-tree` = 0 e
`claude plugin validate task-tree --strict` = "Validation passed" (2.1.321). Nada rodou no harness.

## O que `head.tsx` espera de `./icons` ([D] seção 2)

    export function stateIcon(tone: Tone): string   // ícone de estado 16×16, para as pílulas
    export function headBar(d: number, n: number): string   // barra com width="100%" height="4"

## Assinatura entregue

    export type Head = { title; d; n; chips: Chip[]; time?: number; rate?: { toks; live };
      git?: GitLabel; state: HeaderState; ultracode: boolean; alt: string; whole: string; cols: number }
    export function desktopHead(ui: any, h: Head): any   // devolve o <Box key="head">

Diferença de [D] 4.9: `whole` a mais (pedido do brief). Não é desenhado: já está no `alt`
("; sessão inteira: a de b"), como hoje só o tooltip o mostrava.

## O diff de `render.tsx`

- `import { desktopHead } from '../draw/head'`; sai `headerSvg` do import de `../draw/svg`.
- `cols = bodyColumns || 40`; o `alt` (linhas 312-322) sem mudar uma letra; `desktopHead(ui, {...})`
  depois do `alt`.
- `drawDesktop` recebe `top` (o nó) no lugar de `top`+`alt` e o põe onde estava o `Box key="head"`.
- `W`/`lineWidth` **ficam** no diff porque, no `render.tsx` de hoje, `rowSvg` ainda os usa. Depois das
  etapas 1 e 2 (linhas nativas por `cols`), o integrador tira `W` e `lineWidth` ao aplicar: o diff
  não aplica limpo sobre o `render.tsx` dessas etapas; as três trocas acima são o que vale.

## Decisões

- Estrutura e props de [D] 4.9, com `0.25`/`0.5` nas cores cruas (correção 12). Cartão:
  `borderStyle="round"`, `paddingX/Y=0`, `overflow="hidden"`, `backgroundColor="userMessageBackground"`,
  `marginBottom={1}`, `flexDirection="row"` explícito.
- Faixa: `Box key="band"` de 1 coluna, cor por `state.tone` (`current`→`warning`, `running`→
  `permission`, `done`→`success`, `interrupted`→`inactive`, `open`→`rgba(136,135,128,0.25)`,
  `paused`→`rgba(239,159,39,0.5)`; tom fora do mapa → o de `open`).
- Painel vazio = `n === 0 && chips.length === 0` (a regra de `headerSvg`, não a do `alt`, que é
  `n + x === 0`): "Tarefas", "Nenhuma tarefa planejada.", sem barra, sem bloco de números, linha das
  pílulas vazia. Com `n === 0` e pílulas (ex.: só sessões ativas), a barra aparece e leva o `alt`.
- Estreito: `cols < 84` (equivale a `W < 600` com 7,2 px por coluna): sem taxa e sem ultracode.
- Contagem em caracteres no lugar dos px: bloco de números = 11 colunas (estreito) ou 18, mais 12
  com ultracode; borda + faixa + paddings = 6. `room = cols - bloco - 6` vale para o git e para as
  pílulas (pílula = `len(texto) + 5`, 1 de vão). Pílulas: com palavras se todas cabem, senão só o
  número; corta na primeira que não cabe. Git: `gitTerm` inteiro; senão `⑂ <branch>`; senão nada;
  pasta conta no máximo 22 colunas (os 160 px de `FOLDER_MAX`) e o app corta o resto pelo fim
  (antes cortava pelo começo, `fitStart`).
- Pílula: `alt` do ícone = `chip.text` inteiro mesmo quando o texto visível é só o número.
- Terceira linha do bloco: relógio, ` · N toks/s` (com `dimColor` quando é a média do último turno),
  ` · ultracode` em `color="effortUltra"`, como `Text` dentro de `Text`; só existe se houver algum.
- Nenhum `hover`, nenhum `display: 'none'`, nenhum `Button`.

## Incertezas (só o app mostra)

- Os números de colunas (11/18/6/+5) são estimativas: conferir no app em 60 e 120 colunas.
- `Text size="heading"` e `size="title"` dentro de `Box height={1}` podem cortar em cima/embaixo.
- Painel vazio: o `Box` da barra fica sem filho, então o cartão pode ficar uns 4 px mais baixo que
  com a barra.
- O fundo `userMessageBackground` e a cor `effortUltra` são chaves fora do tipo (a sonda mostra que
  o harness repassa; a pintura é do app).
- A ordem dos pedaços no `cabecalho` do kit: título, git, `alt` da barra, `alt` e texto de cada
  pílula, %, "d de n", relógio/taxa/ultracode. `estadoGeral` por pedaço acha o "estado geral" no
  `alt` da barra.
