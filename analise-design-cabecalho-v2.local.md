# Cabeçalho do painel, rodada 2: a P5 como guia e cinco variações

Só protótipos fora do repositório; nada implementado nem commitado. A rodada 1 (`analise-design-cabecalho.local.md`, pasta `cabecalho-propostas\`) fica como está.

- **Página autocontida (SVGs inline, abre sozinha):** `<notas>\cabecalho-propostas-v2\propostas-cabecalho-v2.html`
- **SVGs soltos:** na mesma pasta, `<proposta>-<tema>-<largura>.svg` (6 propostas × claro/escuro × largo 1200 px / 60 colunas 432 px); `gerar.mjs` regenera tudo.
- Dados: os do print 6. Paleta: a `LIGHT`/`DARK` do mod. Fonte: a do sistema.

## Essencial

- **A P5** (faixa de estado à esquerda; bloco de números à direita com o % grande; barra; pílulas) é a referência, igual à rodada 1, agora também com a **faixa por estado geral**: âmbar em andamento, âmbar apagado aguardando, azul sessão ativa, cinza interrompido, verde tudo concluído.
- **Cinco variações**, todas com a faixa e o bloco:
  - **V1 · Anel no mostrador:** o % dentro de um anel de progresso; pílulas só com contorno.
  - **V2 · Borda tingida e selo:** a faixa vira a borda inteira do cartão, fina, na cor do estado, mais um selo com a palavra ("em andamento") antes do título; contexto como trilha "repo / branch"; mini-barra sob o %.
  - **V3 · Faixa em gradiente:** a faixa se dissolve para dentro do cartão; a barra e os ícones de estado dividem uma linha; trilha discreta.
  - **V4 · Respiro (116 px):** a P5 com mais ar: faixa fina de altura inteira, título em 16 px, uma linha por camada, % em 26 px tabular.
  - **V5 · Duas linhas (72 px):** a P5 comprimida: título e estado na primeira linha; trilha, barra e mostrador na segunda.
- **Recomendação: V4.** É a P5 que ele escolheu, com a hierarquia mais nítida e o mostrador mais forte; custa 16 px a mais. Se a altura pesar, **V5** é a mesma ideia em 72 px.
- **Custo:** todas ficam em `draw/svg.ts` (`headerSvg`, `chips`); V3, V4 e V5 mudam `HEADER_H` em `draw/geometry.ts` (96, 116, 72); V2 muda a borda do cartão do cabeçalho (`cardSlice`). O terminal e o kit não mudam. **O golden muda nos 3 cenários** (todos desenham o cabeçalho): validação dele no app antes do commit e `golden:aprovar --todos`.

## A faixa por estado geral (vale para todas)

| Estado geral do painel | Cor da faixa | Quando |
|---|---|---|
| em andamento | âmbar | há tarefa ◉ própria |
| aguardando | âmbar a 50 % | nada ◉, algo ◷ (fim do turno, pergunta, permissão) |
| sessão ativa | azul | nada próprio em andamento, uma filha trabalhando |
| interrompido | cinza | nada aberto, algo ✕ |
| tudo concluído | verde | tudo ✓ |

A ordem acima é a precedência. A página mostra as cinco cores na P5 e na V4, nos dois temas, em 60 colunas. No código, é uma função pura de `Row[]`/`count` (as mesmas contas dos chips), devolvendo o tom da faixa; animação: a cor troca com o mesmo "pulo" dos ícones (`motion.ts`, chave nova `#faixa`).

## As propostas

**P5 · referência.** Como na rodada 1. Em 60 colunas: o bloco estreita (sem toks/s), título cortado, pílulas só com número.

**V1 · Anel no mostrador, pílulas leves** (100 px)
- *Muda:* o % entra num anel de progresso (raio 20, traço 5) à esquerda do bloco; "15 de 19" em negrito ao lado; pílulas só com contorno (45 % de opacidade), menos tinta.
- *60 colunas:* anel menor (raio 16), bloco de 92 px, título cortado antes.
- *Ganha:* o progresso vira figura e número ao mesmo tempo; o painel fica mais leve. *Perde:* o anel repete a barra (duas representações do mesmo 79 %); o bloco fica mais largo e rouba título em pane estreito.
- *Código:* arco com `stroke-dasharray` (regra nova de animação, ou sem animar); pílulas com `stroke` em vez de `fill`.

**V2 · Borda tingida e selo do estado** (100 px)
- *Muda:* sem faixa: a borda inteira do cartão fica na cor do estado (1,5 px, 80 %); um selo arredondado com a palavra do estado antes do título; contexto como trilha "repo / branch" sem ícones; a barra longa sai e vira uma mini-barra de 100 px sob o %; os pares "15 de 19 · 21:50 · 79 toks/s" numa linha só.
- *60 colunas:* selo e título dividem a linha (título curto); trilha só com a branch; mini-barra de 60 px.
- *Ganha:* o estado é dito **com palavra**, não só cor (acessível); o cartão inteiro muda de humor; sem ícones no contexto. *Perde:* a barra longa (a leitura rápida de progresso cai para a mini-barra); o selo come o título em pane estreito; a borda colorida compete com os cartões das sessões (que têm borda cinza).
- *Código:* `cardSlice` do cabeçalho com `stroke` por estado; selo = `rect` + texto; a trilha troca `gitSvg` por texto.

**V3 · Faixa em gradiente, estado na linha da barra** (96 px)
- *Muda:* a faixa é um gradiente de 47 px que se dissolve para dentro do cartão; a barra (até 360 px) e os ícones de estado com número ("● 1 ○ 3 ✕ 1 👤 1") ficam na mesma linha; contexto como trilha; mostrador como na P5.
- *60 colunas:* barra curta, ícones de estado logo após ela, bloco de 70 px.
- *Ganha:* uma linha a menos (96 px); a faixa fica "moderna" sem borda dura; estado e progresso lado a lado. *Perde:* as palavras do estado vão ao tooltip; o gradiente é sutil no tema claro (a 75 % de opacidade ainda se vê, mas menos que a faixa sólida).
- *Código:* `linearGradient` em `<defs>` (o SVG do mod aceita; ids únicos por desenho); barra mais curta; `faixaStatus` como na rodada 1.

**V4 · Respiro** (116 px) — recomendada
- *Muda:* faixa de 5 px na altura inteira; título em 16 px; cada camada na sua linha (título / contexto / barra / pílulas) com 16–20 px entre elas; pílulas de 22 px; % em 26 px e os pares em 12 px, tabulares; bloco de 130 px.
- *60 colunas:* bloco de 76 px (% em 20 px, sem toks/s), título cortado, pílulas só com número, só a branch.
- *Ganha:* a leitura mais fácil das seis (é a P5 com a hierarquia que faltava: tamanho e espaço separam as camadas); nada vai ao tooltip. *Perde:* 16 px de árvore.
- *Código:* `HEADER_H` 116 (o slot do cabeçalho; os botões continuam no canto); `headerSvg` com as posições novas; nada novo de desenho.

**V5 · Duas linhas** (72 px)
- *Muda:* linha 1: título + estado em ícone e número; linha 2: trilha, barra de 200 px e o mostrador numa linha só ("79% · 15/19 · 21:50" em negrito); faixa de 6 px.
- *60 colunas:* mostrador só com "79%", barra de 110 px, trilha só com a branch, título curto.
- *Ganha:* 28 px a mais para a árvore, mantendo faixa e mostrador. *Perde:* as palavras do estado e o toks/s vão ao tooltip; o % deixa de ser o maior número; o título cabe pouco em pane estreito.
- *Código:* `HEADER_H` 72 (e o `alt` do cabeçalho); `faixaStatus`.

## O que todas exigem no código

- `draw/svg.ts`: `headerSvg` reescrito para o desenho escolhido; `chips` vira pílulas (fundo ou contorno na cor do tom) ou a faixa de ícones; o tom da faixa de estado por uma função pura; o `alt` do cabeçalho mantém as mesmas palavras de hoje (o leitor de tela e o tooltip não mudam).
- `draw/geometry.ts`: `HEADER_H` só nas que mudam a altura (V3 96, V4 116, V5 72). `hooks/render.tsx`: o slot do cabeçalho segue `HEADER_H`; os botões ≡/▤ ficam no canto direito dentro de `ICONS_W`, por chave, como hoje.
- Restrições respeitadas: fonte do sistema; larguras por `textW`/`fit`; nada clicável além dos dois botões; tooltip pela camada de hover (as palavras do estado nas V3 e V5; o título cortado; o repositório inteiro quando só a branch aparece); só cores da paleta, com opacidade.
- Terminal: a linha do cabeçalho não muda (a faixa não existe lá); o kit (`cabecalho()`) continua lendo-a.
- Golden: os 3 cenários mudam de desenho. Fluxo: implementação → check acusa → ele valida no app → `golden:aprovar --todos --motivo "\"<palavras>\", <data>"` → commit. Regras: `visual.cabecalho-em-cartao`, `visual.cabecalho-barra-e-chips-desenhados`, `visual.desenho-*`; `cabecalho.chips-contam-folhas` só no texto ("pílulas"). Nova: `visual.faixa-de-estado-geral` (a cor por estado), com a tabela acima como Dado/Quando/Então.
- `npm run impacto -- draw/svg.ts` (visual + cabeçalho); com `draw/geometry.ts` e `hooks/render.tsx` (V3–V5), núcleo: tudo.

## Recomendação

**V4.** Mantém tudo o que ele gostou na P5 e corrige o que a P5 ainda tinha de apertado: cada informação na sua linha, o % como o número mais forte, pílulas legíveis nos dois temas, e a faixa fina de altura inteira que diz o estado geral de longe. Se os 16 px fizerem falta na árvore, a **V5** entrega a mesma ideia em 72 px, com as palavras do estado no tooltip. Entre as outras, a **V2** é a mais "diferente" (o estado em palavra, o cartão inteiro tingido) e vale um olhar se ele quiser algo mais marcante.

Próximo passo quando ele escolher: a Análise escreve o brief (posições exatas, a função do tom da faixa, as regras e o golden), e a Implementação faz num commit, com a validação dele no app antes.
