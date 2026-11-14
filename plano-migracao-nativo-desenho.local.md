# Plano da migração para o híbrido nativo: o desenho do desktop

Sessão de análise (só leitura), 2026-11-13. Worktree lida:
`<repo>-wt\integra` (branch
`feat/painel-nativo`, a partir de `b7d2a50`). Nada foi editado nela; nenhum check, build ou teste
rodou. Único comando do repositório: `node scripts/impacto.mjs -- <arquivos>` (leitura).

Pedido do usuário (2026-11-13): "migrar todo o Mod para o hibrido de nativo e mantendo somente o que
for obrigatório em SVG", em etapas, com commit local por etapa.

Este arquivo cobre só o **desenho nativo do desktop**. Validação (kit de testes, golden, selos,
catálogo) aparece aqui só como "o que cada etapa quebra".

## 0. Resumo

- O desktop passa a devolver uma árvore de `Box`/`Text`/`Button`, com `Svg` pequeno (16 × 16 px,
  sem texto) só para: ícone de estado, busto de sessão, envelope, anel de contexto; e um `Svg` de
  4 px de altura para a barra do cabeçalho.
- O clique no ícone e no anel **continua sendo um `Button` de rótulo vazio sobreposto**, só que
  agora dentro da célula do próprio ícone (`Box` absoluto com `top/bottom/left/right = 0`), sem
  contar células a partir da borda da linha. Motivo: o `Button` não aceita `Svg` como filho, e o
  app desenha só o `label` (seção 1).
- Cartões: `Box` com `borderStyle="round"` aninhados. As guias dos ancestrais de fora do cartão
  vão numa faixa de texto mono à esquerda do cartão, dentro de um `Box` em linha com ele.
- Arquivos novos: `task-tree/draw/icons.ts` (fontes dos `Svg` pequenos), `task-tree/draw/desktop.tsx`
  (linhas e cartões), `task-tree/draw/head.tsx` (cabeçalho). `hooks/render.tsx` só liga.
- Quatro etapas, cada uma com o check verde: (1) linhas fora de cartão; (2) cartões e rótulo de
  sessão; (3) cabeçalho; (4) remoção do código morto e documentação. A etapa 1 já inclui a conferência
  do limite de tamanho. Detalhe na seção 9.
- `DRAW_LIMIT`, `fitted` e o desenho de emergência não mudam de código. Muda o peso de cada linha
  (estimativa: parecido com o de hoje) e a contagem de nós por linha, que passa a importar.

Matriz de impacto pedida pelo CLAUDE.md, para os arquivos que a migração toca:

    npm run impacto -- task-tree/hooks/render.tsx task-tree/draw/svg.ts task-tree/draw/geometry.ts task-tree/draw/layout.ts task-tree/hooks/panel.ts

Resultado hoje: núcleo tocado (`hooks/render.tsx`), 166 cenários afetados, ou seja, todos.

## 1. O que foi conferido, e o que a análise anterior dizia diferente

Fontes: os tipos do kit em
`task-tree/.claude-plugin/types/claude-code/index.d.ts` e o bundle do app instalado hoje,
`%LOCALAPPDATA%\AnthropicClaude\app-5.11492.2\resources\ion-dist.asar` (a análise de 2026-11-10 leu
a 4.23118.1). Do bundle li a região do desenhador de árvores (funções `ap`, `Tp`, `Cp`, `Zf`, `Qf`,
`np`, `Gh`, `Qp`, `xg`, `cg`, `$h`). Tudo abaixo é **confirmado** nesses dois lugares; nada foi
visto na tela.

### 1.1 Como o app traduz cada prop (bundle 5.11492.2)

| Prop | CSS que o app gera |
|---|---|
| `Box` | `div` com `display:flex; box-sizing:border-box`. **`flexDirection` ausente é `row`.** |
| `width`, `minWidth` número | `N ch`. Texto: só percentual (`"40%"`, regex `^\d+(\.\d+)?%$`). Fração é aceita (`0.5` vira `0.5ch`). |
| `height`, `minHeight` número | `N lh`. Mesmas regras. |
| `padding*`, `margin*`, `gap` número | na horizontal `N ch`; **na vertical `N × 0,5 lh`** (`calc(N * var(--engine-row-unit,.5lh))`; só o `Client` troca a unidade para `1lh`). Nomes `xs`…`xl` viram tokens do app. |
| `top`, `bottom` | `N lh`, só inteiro. `left`, `right`: `N ch`, só inteiro. Só valem em `position="absolute"`. |
| pai de `Box` absoluto | ganha `position:relative` sozinho (não precisa pedir). |
| `borderStyle` (qualquer texto) | `border:1px solid <borda do app>`; `round` dá `border-radius: raio + .25rem`; `bold` 2 px; `double` 3 px. **Borda sempre nos quatro lados.** |
| `Box` com borda | ganha `padding: <pad.md> <pad.lg>` por padrão. `paddingX`/`paddingY` explícitos vêm depois e ganham. |
| `borderColor`, `borderDimColor` | cor resolvida; com `borderDimColor`, `color-mix(cor 60%, transparente)`. |
| `backgroundColor` | cor resolvida; chave desconhecida vira `currentColor` e é descartada (sem fundo). |
| `Box` em linha sem `alignItems` | marca `data-engine-row`: os filhos diretos `span`, `button`, `img` ficam centrados na vertical. Um `Box` filho (div) **não** é centrado: estica. |
| `Text` | `span`. **Sem `wrap` (ou `wrap="wrap"`): `white-space:pre-wrap; overflow-wrap:anywhere`, quebra linha.** Um texto de até 24 caracteres sem espaço ganha `white-space:pre`. |
| `Text wrap="truncate-end"` (e qualquer outro valor) | `display:inline-block; max-width:100%; white-space:pre; overflow:hidden; text-overflow:ellipsis; min-width:0`. O "…" é sempre no fim: não há corte no começo nem no meio no desktop. |
| `size` | `caption`, `footnote`, `body`, `heading`, `title`: tamanho e altura de linha dos tokens do app (`title` troca também a família para a de títulos). Os px não estão no trecho lido. |
| `weight` | `regular`, `medium`, `semibold`, `bold`. `bold: true` é `semibold`. |
| `mono` | família mono de interface do app. `tabular`: `font-variant-numeric:tabular-nums`. |
| `dimColor` | sem `color`: a tinta apagada do app (`text.secondary`). Com `color`: `color-mix(cor 60%, transparente)`. |
| `Svg` sem `isInteractive` | `<img src="data:image/svg+xml,…" style="display:block;max-width:100%;border:0;width:Npx;height:Npx">`. O app acrescenta `font-family` e `color` na raiz do SVG quando ela não os tem (`currentColor` segue o tema; as outras cores, não). |
| `Button` | `<button data-press-key=…>` com um `span` cujo texto é **o `label`**. `plain`: `min-height:1lh; padding:0 <pad.xs>`, sem fundo em repouso, fundo "ghost" no hover. `max-width:100%` do pai. |

Cores: além das 23 chaves do tipo `ThemeKey` (`index.d.ts:14053`), o app resolve outras, entre elas
`effortUltra` (a cor de ultracode do próprio app), `userMessageBackground` e
`bashMessageBackgroundColor` (superfície 1), `userMessageBackgroundHover` (superfície 2),
`clawd_background` (superfície 0), `composerSidebarBackground` (superfície do painel). Cor crua vale
em hex e em `rgb()/rgba()/hsl()/hsla()` só com números. O tipo `Color` aceita qualquer texto
(`index.d.ts:1727`).

Detecção de grade do app (não usada aqui, mas explica o comportamento): numa coluna, `Text` cortados
seguidos, com só texto dentro e caracteres de caixa, ganham fonte mono sozinhos; um `Text` com `\n`
e caracteres de caixa também.

### 1.2 Correções à análise de 2026-11-10

1. "`Button` aceita filhos, então o próprio ícone pode ser o alvo do clique": **não vale para `Svg`**.
   O tipo só admite texto e `Text` como filhos (`index.d.ts:1108-1110`, "any other element is
   refused"), e o app desktop desenha só o `label` (`Gh` no bundle: `textContent = label`). O ícone
   em `Svg` continua precisando de um `Button` por cima.
2. "`Text` vira `span` com corte por reticências": só com `wrap` diferente de `wrap`. Sem a prop, o
   texto **quebra linha**. Todo texto que não pode quebrar precisa de `wrap="truncate-end"` ou de
   um `Box` com `flexShrink={0}` em volta.
3. "`wrap` com `truncate-start/middle/end`": no desktop os três dão o mesmo corte no fim.
4. "Larguras em `ch`, verticais em `lh`": vale para `width/height/top/bottom`; **espaçamento
   vertical é meio `lh` por unidade** no `Pane`.
5. `Box` com borda tem padding padrão: quem não zerar ganha um cartão mais gordo que o previsto.
6. O que continua certo: `Box` é `div` flex; `Svg` imagem; limite de 131.072 caracteres por `Svg`;
   troca do DOM inteiro a cada desenho; sem atualização parcial.

### 1.3 Limites de árvore

- O tipo diz, falando da árvore de um `Client`: "A tree of them keeps every tree's bounds (20,000
  nodes, 32 deep, 100,000 characters serialized)" (`index.d.ts:1450-1451`). Os 100.000 caracteres
  não valem para o `Pane` (hoje ele recebe 600 KB). **Suspeita:** os 20.000 nós e os 32 níveis podem
  valer para toda árvore. O desenho abaixo fica longe dos dois (seção 7).
- No bundle, o único limite de tamanho achado na região (262.144 caracteres, 2.000 nós, 32 níveis)
  é o da página de um `Client`, não o do `Pane`. O limite real do `Pane` continua desconhecido.

## 2. Arquitetura

    hooks/render.tsx            lê o estado, layout(), cabeçalho, limite de tamanho; liga os cliques
      draw/layout.ts            Row[], guides, labelCols (sem mudança de lógica)
      draw/icons.ts   (novo)    fontes dos Svg pequenos, puras e lembradas por chave
      draw/desktop.tsx (novo)   linhas e cartões do desktop: funções de (ui, linhas, ações) -> árvore
      draw/head.tsx   (novo)    cabeçalho do desktop
      draw/svg.ts               o que sobra: texto compartilhado e as primitivas de ícone

Regras que os arquivos novos respeitam:

- Nenhum recebe `$`. As ações dos cliques nascem em `hooks/render.tsx` (onde `$` está) e descem
  como funções prontas. Assim os limites do kit (`$` só em função de topo, chave de `$.state`
  literal) não entram neles.
- JSX fora de `hooks/`: `h` e `Fragment` são globais do kit (`index.d.ts:16460`), e `draw/*.ts` já
  é empacotado por importação. **Primeira coisa da etapa 1:** confirmar que
  `claude plugin validate task-tree --strict` aceita `draw/desktop.tsx`. Se recusar, os dois
  arquivos de JSX vão para `hooks/desktop.tsx` e `hooks/head.tsx`, sem mudar mais nada.
- Os dois arquivos novos de JSX entram no mapa de impacto: `Código da área:` de `regras/visual.md`
  (hoje `draw/svg.ts, draw/geometry.ts`).

Assinaturas (o contrato entre quem escreve cada arquivo):

    // draw/icons.ts
    export const ICON = 16
    export function stateIcon(tone: Tone): string                    // ícone de progresso
    export function msgIcon(state: MsgState): string                 // envelope na cor do estado
    export function bustIcon(state: SessionState): string            // busto; 'arquivada' apagado
    export function ringIcon(percent: number, faded: boolean): string
    export function headBar(d: number, n: number): string            // barra do cabeçalho

    // draw/desktop.tsx
    export type Acts = { fold: (r: Row) => () => void; open: (r: Row) => () => void }
    export function cells(r: Row, g: Guide, hide: number[]): { col: number; text: string }[]
    export function desktopRow(ui: any, r: Row, i: number, lead: string, acts: Acts, cols: number): any
    export function desktopTree(ui: any, lines: Row[], acts: Acts, cols: number): any[]

    // draw/head.tsx
    export type Head = { title: string; d: number; n: number; chips: Chip[]; time?: number
      rate?: { toks: number; live: boolean }; git?: GitLabel; state: HeaderState; ultracode: boolean
      alt: string; cols: number }
    export function desktopHead(ui: any, h: Head): any

Em `hooks/render.tsx`, dentro de `paint` (linha 264), as ações são criadas uma vez por desenho:

    const acts = {
      fold: (r: Row) => act(`fold:${(r.fold as any).key}`, pressOf($, r)),
      open: (r: Row) => act(`open:${r.sid}`, () => void openSession($, r.sid as string, r.title)),
    }

`pressOf` (linha 62), `act`/`actions` (`hooks/panel.ts:550-554`) e o hook `press` (linha 188) não
mudam.

## 3. Regras gerais do desenho nativo

Valem para todos os elementos da seção 4.

1. **Toda linha tem a mesma altura:** `<Box key={`r${i}`} height={1}>` (1 `lh` da fonte do corpo do
   painel). Sem isso, uma linha só com texto pequeno fica mais baixa e as guias e a faixa lateral
   dos cartões desalinham. Nada de margem vertical entre linhas de um mesmo bloco.
2. **A coluna da árvore é uma célula de 3 caracteres mono.** Guias, conector e ícone ocupam uma
   célula cada. A célula do ícone é dimensionada por um `Text mono` de três espaços, e o ícone fica
   centrado nela por um `Box` absoluto. Assim a barra vertical dos filhos (no meio da célula) cai
   exatamente sob o meio do ícone do pai, em qualquer fonte, sem contar px.
3. **Texto que pode ser cortado:** `wrap="truncate-end"`, dentro de um `Box` com
   `flexShrink={1} minWidth={0}`. **Texto que não pode encolher:** dentro de um `Box` com
   `flexShrink={0}`. Nenhum `Text` fica solto como filho direto da linha, salvo dentro desses dois.
4. **Espaços:** texto com espaço no começo ou no fim usa `wrap="truncate-end"` (`white-space:pre`);
   sem isso, o espaço do fim não ocupa lugar. Entre blocos, `columnGap`/`paddingLeft` do `Box`.
5. **Cores só por chave de tema**, salvo as duas tintas com transparência da seção 4.9.
6. **`Svg` sempre com `width` e `height` em px**, salvo a barra do cabeçalho (largura do slot).

Tabela de estilos de texto (os tamanhos de hoje, em px, viram degraus do app):

| Papel | Hoje (SVG) | Nativo |
|---|---|---|
| Título de tarefa | 13 px (14 no nível 0), classe `pc` | sem `size` (corpo); sem `color` |
| Título em destaque (`r.strong`) | peso 600 | `weight="semibold"` |
| Título apagado: concluída, aviso, ↩, seção | classe `sc` | `color="inactive"` |
| Título de interrompida e arquivada | `sc` com opacidade .7 | `color="inactive" dimColor` |
| Tempo, contagem | 12 px, `s`, `tabular-nums` | `size="footnote" color="inactive" tabular` |
| Palavra de estado, modelo, repositório, branch | 11–12 px, `s` a .75 | `size="footnote"` (linha) ou `size="caption"` (rótulo), `color="inactive"` |
| toks/s da média do último turno | `s` a .45 | `size="caption" color="inactive" dimColor` |
| Nome da sessão no rótulo | 12 px, 600, `s` | `size="footnote" weight="semibold" color="inactive"` |
| "aguardando" no rótulo | âmbar | `color="warning"` |
| `ultracode` | `#8700FF` / `#AF87FF` fixos | `color="effortUltra"` (a cor do app; chave fora do tipo, resolvida no bundle) |
| Guias e conectores | traço `g`, cinza a .55 | `mono color="inactive" dimColor` |
| Título do cabeçalho | 16 px, 600 | `size="heading" weight="semibold"` |
| % do cabeçalho | 26 px (20 estreito), 700 | `size="title" weight="bold" tabular` |
| Linhas pequenas do cabeçalho | 12 px, `s` | `size="footnote" color="inactive"` |

Perda conhecida: as três opacidades de hoje (.75, .7, .45) viram um degrau só (60%).

## 4. Elemento por elemento

Referências de hoje: `draw/svg.ts` (`rowSvg` 466-592, `labelSvg` 356-419, `headerSvg` 631-719),
`hooks/render.tsx` (`drawDesktop` 72-119).

### 4.1 Guias e conectores

Nativo, texto mono. Função nova `cells` em `draw/desktop.tsx`, a irmã de `prefix`
(`draw/svg.ts:44-48`), com a barra no meio da célula:

    export const cells = (r: Row, g: Guide, hide: number[] = []) => {
      const out: { col: number; text: string }[] = []
      if (r.depth === 0) return out
      g.bars.forEach((on, k) => { if (!hide.includes(k)) out.push({ col: k, text: on ? ' │ ' : '   ' }) })
      if (!hide.includes(r.depth - 1)) out.push({ col: r.depth - 1, text: g.last ? ' └─' : ' ├─' })
      return out
    }

Diferenças para `prefix`, de propósito:

- a barra fica na segunda posição (`' │ '`, não `'│  '`), para cair sob o meio do ícone do pai;
- o rótulo de sessão ganha conector (`├─`/`└─`) como qualquer linha: é o traço que hoje entra no
  cartão até a borda esquerda (`svg.ts:486-492`); no terminal ele não existe;
- a coluna de um rótulo de sessão (`hide`, de `labelCols`) some, como no terminal: as tarefas do
  cartão começam alinhadas ao busto do rótulo. Hoje, no desktop, a coluna fica vazia (as tarefas
  recuam um nível). Ver "pontos em aberto".

`col` é a coluna de origem de cada célula, usada para repartir as células entre a faixa lateral e o
interior de cada cartão (seção 5).

Desenho, uma vez por linha, só quando há células:

    <Box flexShrink={0}><Text mono color="inactive" dimColor wrap="truncate-end">{lead}</Text></Box>

`g.down` (o traço que desce do ícone, `svg.ts:493`) não tem equivalente: a barra começa na linha de
baixo, como no terminal. `prefix` fica como está, para o terminal.

### 4.2 Ícone de estado, e o ícone que dobra

Fica em `Svg`: 16 × 16 px, sem texto, sem fonte. Fonte por `stateIcon(progress(r))`, ou
`msgIcon(r.msg ?? r.recv)` numa tarefa de mensagem. `draw/icons.ts` monta com as primitivas que já
existem:

    const open = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${STYLE}`
    stateIcon(tone)  = slim(open + icon(tone, 8, 8) + '</svg>')            // svg.ts:318
    msgIcon(state)   = slim(open + envelope(8, 8, MSG_CLASS[state]) + '</svg>')   // svg.ts:306
    bustIcon(state)  = slim(open + sessionIcon('filha', state, 8, 8) + '</svg>')  // svg.ts:190
    ringIcon(p, f)   = slim(open + (f ? `<g opacity=".45">${contextRing(p, 8, 8)}</g>` : contextRing(p, 8, 8)) + '</svg>')

Cada função guarda o resultado num `Map` do módulo (12 tons, 4 estados de mensagem, 4 de sessão,
até 202 anéis). As cores continuam nas classes claro/escuro de `LIGHT`/`DARK` com
`prefers-color-scheme`: a imagem não enxerga as variáveis do app.

A célula do ícone, igual em toda linha de tarefa e no rótulo de sessão:

    const iconCell = (svg: string, alt: string, press?: { key: string; fn: () => void }) => (
      <Box flexShrink={0}>
        <Text mono wrap="truncate-end">{'   '}</Text>
        <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
          <Svg source={svg} alt={alt} width={16} height={16} />
        </Box>
        {press ? (
          <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
            <Button key={press.key} label={'\u2003'} plain onPress={press.fn} />
          </Box>
        ) : null}
      </Box>
    )

- `alt` do ícone = `rowAlt(r)` (`svg.ts:721-734`), inteiro. Assim o texto alternativo de cada linha
  continua existindo com as mesmas palavras (o título da sessão, "recolhida", a contagem e o tempo
  da sessão, que só existem no `alt`), e os testes que leem `alt` de linha seguem valendo.
- Linha com `r.fold`: `press = { key: `fold:${r.fold.key}`, fn: acts.fold(r) }`. Linha sem nada
  embaixo: sem `Button`.
- O rótulo é o espaço em (U+2003), o mesmo de hoje (`render.tsx:81`). Escrever como `'\u2003'`, não
  o caractere, para nenhuma ferramenta normalizar.
- O realce é o do botão nativo, limitado à largura da célula (`max-width:100%`).
- Saem `overlays`, `overBox`, `Placed`, `CELL` e a regra "ancorar pela borda mais próxima"
  (`draw/geometry.ts:96-156`): a célula do botão é a do ícone.

### 4.3 Linha de tarefa (e de pedido, aviso, ↩, ferramenta de subagente)

    <Box key={`r${i}`} height={1}>
      {lead ? guias : null}
      {iconCell(...)}
      <Box flexGrow={1} flexShrink={1} minWidth={0} paddingLeft={1}>
        <Text wrap="truncate-end" {...estiloDoTitulo}>{r.title}</Text>
        {r.fold && !r.fold.open ? <Text color="inactive">{' ⋯'}</Text> : null}
      </Box>
      {direita.length > 0 ? <Box flexShrink={0} columnGap={1}>{direita}</Box> : null}
    </Box>

- Título: nativo. O corte é o do app, na largura real; some `foreignObject`, `textW`, `fit`.
- ` ⋯` de recolhida: `Text` próprio depois do título (como no terminal), não mais dentro do texto
  cortado: o título corta e o ⋯ fica.
- `estiloDoTitulo`: `quiet` e `dim` como em `svg.ts:569-570` (tabela da seção 3).

A direita reproduz as regras de `svg.ts:501-556`:

    const tabular = r.bar === true || r.card === true
    const t = typeof r.time === 'number' ? clockText(r.time) : tabular && r.time === null ? '—' : ''
    const forked = r.kids === true
    const colunas = tabular && (r.sub !== undefined || forked)

| Caso | Filhos do bloco da direita, da esquerda para a direita |
|---|---|
| `colunas` | palavra (`r.meta`), célula do busto, célula da barra, célula da contagem, célula do tempo: as quatro células sempre presentes, vazias quando não há o que mostrar |
| `tabular` sem `colunas` | palavra, tempo com a largura do próprio texto: o título vai até o tempo |
| não `tabular` | `rightText(r)` (`"3/5 · concluída"`), tempo (só quando número) |

Células de largura fixa, para as colunas baterem entre linhas:

- **tempo:** `<Box width={7} justifyContent="flex-end"><Text size="footnote" color="inactive" tabular>{t}</Text></Box>`
  (cabe "0:00:00").
- **contagem:** `<Box width={5} justifyContent="flex-end"><Text size="footnote" color="inactive" tabular dimColor={interrompida ou arquivada}>{`${d}/${n}`}</Text></Box>`.
- **barra da linha:** nativa (a decisão deixa em SVG só a barra do cabeçalho):

      <Box width={5} alignItems="center" flexShrink={0}>
        <Box flexGrow={1} height={0.2} backgroundColor="rgba(136,135,128,.25)">
          {n > 0 && d > 0 ? <Box width={`${Math.max(11, Math.round((d / n) * 100))}%`} backgroundColor="success" /> : null}
        </Box>
      </Box>

  Usa altura em fração de `lh` (o app aceita; o harness, a confirmar na etapa 1). Se for recusada,
  a alternativa pronta é a barra em blocos do terminal: `ratioBar(d, n, 5)` (`svg.ts:49`) em dois
  `Text mono` (`success` e `inactive dimColor`).
- **busto de "com sessão abaixo":** `Svg` (ícone de estado): `<Box width={3} justifyContent="center">{forked ? <Svg source={bustIcon(r.kidsState ?? 'parada')} alt="com sessão filha" width={16} height={16} /> : null}</Box>`.
- **palavra de estado:** `<Text size="footnote" color="inactive">{r.meta}</Text>`.

Aviso (`tone: 'wait'`): ícone de espera, título apagado, sem direita. Linha ↩: ícone de resposta,
título apagado, sem direita (o título vai até a borda do cartão). Linha da ferramenta do subagente
(`gt:`): ícone de subagente, folha.

### 4.4 Seção ("+N pedidos anteriores", "+N cartões antigos", "+N linhas…")

Nativa, sem ícone e sem traço (regra `visual.secao-sem-traco`):

- seção que abre (`r.fold`): `<Button key={`fold:${r.fold.key}`} label={r.fold.open ? '▾' : '▸'} plain dimColor onPress={acts.fold(r)} />`
  no lugar do ícone, e o título;
- seção que não abre: só as guias e o título, começando onde estaria o ícone.

Título: `<Text color="inactive" wrap="truncate-end">`, no mesmo `Box` que cresce.

### 4.5 Rótulo do cartão de sessão

Primeira linha dentro do `Box` do cartão, sem guias (o conector dela está na faixa lateral):

    <Box key={`r${i}`} height={1}>
      {iconCell(bustIcon(sessionState(r.tone)), rowAlt(r), r.fold ? { key: `fold:${r.fold.key}`, fn: acts.fold(r) } : undefined)}
      <Box flexShrink={1} minWidth={0} paddingLeft={1}>
        <Text size="footnote" weight="semibold" color="inactive" wrap="truncate-end">{r.title}</Text>
        {recolhido ? <Text color="inactive">{' ⋯'}</Text> : null}
      </Box>
      {r.meta ? <Box flexShrink={0} paddingLeft={1}><Text size="caption" color={r.meta === 'aguardando' ? 'warning' : 'inactive'}>{r.meta}</Text></Box> : null}
      {r.git ? <Box flexShrink={100} minWidth={0} paddingLeft={1}><Text size="caption" color="inactive" wrap="truncate-end">{git}</Text></Box> : null}
      <Box flexGrow={1} />
      {taxa ? <Box flexShrink={0} paddingLeft={1}><Text size="caption" color="inactive" tabular dimColor={!r.rate.live}>{rateText(r.rate.toks)}</Text></Box> : null}
      {modelo ? <Box flexShrink={0} paddingLeft={1}>…</Box> : null}
      {r.ring ? anel : null}
    </Box>

- **Busto** à esquerda do nome: `Svg`, na célula de ícone, com o `Button` que recolhe o cartão.
- **Nome:** nativo; é o último a ceder (`flexShrink={1}` contra `100` do git: o app encolhe o git
  primeiro, e o nome só corta quando mais nada cabe).
- **git/repo/pasta:** nativo, em texto, com os glifos do terminal: `gitTerm` (`svg.ts:297`) dá
  `"repo ⑂ branch"` ou `"▭ pasta"`. Saem `repoIcon`, `branch`, `folderIcon`, `gitSvg`, `gitW`.
  Com `repo` falso (abaixo): `"⑂ branch"`. O caminho de uma pasta é cortado no começo por
  caracteres (os últimos 28, com "…" na frente), porque o app não corta no começo.
- **Modelo e esforço:** `<Text size="caption" color="inactive">{r.engine}</Text>`; **ultracode**
  junto, no mesmo `Box`: `<Text size="caption" color="effortUltra">{' ultracode'}</Text>`
  (com `wrap="truncate-end"` por causa do espaço da frente).
- **toks/s:** à esquerda do modelo; apagado quando é a média do último turno.
- **O que cabe:** a ordem de hoje (sai o repositório, depois o modelo com ultracode, depois a taxa;
  a branch corta por último; `svg.ts:388-394`) continua decidida antes de desenhar, mas por
  **contagem de caracteres contra as colunas do cartão**, não por px:

      const len = (s: string) => Array.from(s).length
      const room = cols - 3 - len(nome) - 2 - (r.meta ? len(r.meta) + 1 : 0) - (r.ring ? 4 : 0)
      const need = (repo, eng, rate) => (r.git ? len(gitTexto(repo)) + 1 : 0) + (eng ? engLen : 0) + (rate ? rateLen : 0)

  `cols` é `bodyColumns` menos 3 por nível de recuo e 3 por cartão em volta. A conta erra para
  mais (a letra média é mais estreita que 1 `ch`), então tira um item um pouco antes do necessário,
  nunca depois. O corte final da branch é o do app.
- **Anel de contexto, que abre a sessão:** `Svg` 16 × 16 (`ringIcon`), na ponta direita:

      <Box flexShrink={0} paddingX={1}>
        <Svg source={ringIcon(r.ring.percent, r.ring.faded === true)} alt={`contexto da sessão ${r.ring.name}: ${r.ring.percent}%`} width={16} height={16} />
        <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
          <Button key={`open:${r.sid}`} label={RING_LABEL} plain onPress={acts.open(r)} />
        </Box>
      </Box>

  Só quando `r.session && r.sid && r.ring`, como hoje (`render.tsx:101`). O `paddingX={1}` dá ao
  realce do botão folga dos dois lados. Saem `RING_CELLS`, `ringRight`, `ringFromRight`.
- Contagem e tempo da sessão: só no `alt`, como hoje.

### 4.6 Cabeçalho do subagente e cartão de grupo

A linha de cabeçalho (`card: true`, sem `session`) é uma linha de tarefa comum (4.3), com contagem,
tempo e palavra (`SUB_WORD`), dentro do `Box` do cartão. Nada próprio.

### 4.7 ✉

`msgIcon` na célula do ícone (4.2). A palavra à direita (`MSG_WORD`, em `r.meta`) segue 4.3.

### 4.8 Linha de erro, erro de desenho, desenho de emergência

Já são nativos e não mudam: `errorLine` (`render.tsx:307`), o `Text color="error"` do `catch`
(`render.tsx:404`), o aviso "Painel grande demais" com o `Button key="back"` (`render.tsx:387-397`).

### 4.9 Cabeçalho (`draw/head.tsx`)

    <Box key="head" borderStyle="round" paddingX={0} paddingY={0} overflow="hidden" backgroundColor={FUNDO_DO_CARTAO} marginBottom={1}>
      <Box key="band" width={1} flexShrink={0} backgroundColor={FAIXA[state.tone]} />
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} paddingX={1} paddingY={1}>
        <Box height={1}><Text size="heading" weight="semibold" wrap="truncate-end">{vazio ? 'Tarefas' : title}</Text></Box>
        <Box height={1}>{vazio ? <Text size="footnote" color="inactive">Nenhuma tarefa planejada.</Text> : gitDoTopo}</Box>
        <Box flexDirection="column" paddingY={1}>{vazio ? null : <Svg source={headBar(d, n)} alt={alt} height={4} />}</Box>
        <Box height={1} columnGap={1} overflow="hidden">{pílulas}</Box>
      </Box>
      {vazio ? null : (
        <Box flexDirection="column" flexShrink={0} alignItems="flex-end" justifyContent="center" paddingX={1}>
          <Text size="title" weight="bold" tabular>{`${percent(d, n)}%`}</Text>
          <Text size="footnote" color="inactive" tabular>{`${d} de ${n}`}</Text>
          {relogioETaxa}
        </Box>
      )}
    </Box>

- **Cartão:** as mesmas props do cartão de sessão (seção 5). `overflow="hidden"` para a faixa
  seguir os cantos arredondados.
- **Faixa de estado:** fundo de `Box`, 1 `ch` de largura, a altura do cartão. `FAIXA` por tom de
  `headerState` (`svg.ts:615-623`): `current` → `warning`; `running` → `permission`; `done` →
  `success`; `interrupted` → `inactive`; `open` → `rgba(136,135,128,.25)`; `paused` (âmbar claro) →
  `rgba(239,159,39,.5)`. As duas tintas com transparência são cruas porque não há chave de tema
  para "âmbar a 50%" nem para o cinza do trilho; a transparência as adapta aos dois temas.
- **Título:** nativo, uma linha, cortado pelo app.
- **Git do topo:** nativo, `gitTerm`, `size="footnote" color="inactive"`, cortado pelo app; a regra
  "sem lugar, só a branch; depois nada" (`svg.ts:672-675`) vira contagem de caracteres contra
  `cols` menos o bloco de números.
- **Barra de progresso:** `Svg`, 4 px de altura, largura do slot. Precisa de um pai em coluna (um
  `Svg` sem `width` num `Box` em linha fica com 300 px; `render.tsx:88-90`). Fonte sem estimativa
  de largura:

      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="4">STYLE
        <rect class="tr" width="100%" height="4" rx="2"/>
        <rect class="grf bar" width="P%" height="4" rx="2"/>        // só com d > 0; P = max(2, 100·d/n)
      </svg>

  **O `alt` do cabeçalho inteiro vai nesta barra** (o texto montado em `render.tsx:312-322`, igual):
  ela é o primeiro `Svg` do desenho, então quem lê `svgs[0].alt` continua lendo o cabeçalho.
- **Pílulas:** nativas. Cada uma:

      <Box key={`chip:${c.tone}`} borderStyle="round" borderColor={PILULA[c.tone]} borderDimColor paddingX={1} paddingY={0} flexShrink={0} columnGap={1}>
        <Svg source={stateIcon(c.tone)} alt={c.text} width={16} height={16} />
        <Text size="footnote">{texto}</Text>
      </Box>

  `PILULA`, pelo mapa `PILL` de hoje (`svg.ts:625`): `current`, `wait`, `paused` → `warning`;
  `open`, `interrupted`, `agent` → `inactive`; `sent`, `running` → `permission`; `done` → `success`.
  Contorno na cor do tom (segue o tema), ícone de estado em `Svg`. Hoje é um fundo a 13%; a
  alternativa com fundo é `backgroundColor` com `rgba(…,.13)` cru, que não segue o tema. A escolha
  "palavras ou só números" e o corte das que não cabem (`svg.ts:683-697`) viram contagem de
  caracteres: `wide = Σ(len(texto) + 5) <= cols - bloco - 4`. A linha das pílulas existe sempre,
  com 1 `lh`, para as tarefas não pularem quando uma pílula entra ou sai.
- **Bloco de números:** nativo, três `Text` alinhados à direita. Terceira linha: relógio, depois
  ` · 12 toks/s` (apagado quando é a média), depois ` · ultracode` em `effortUltra`, como `Text`
  dentro de `Text`. Estreito (`cols < 84`, o equivalente dos 600 px de hoje): sem taxa e sem
  ultracode, como hoje (`svg.ts:647-651`).
- **Painel vazio:** o mesmo cartão, com "Tarefas", "Nenhuma tarefa planejada.", a faixa cinza e as
  linhas da barra e das pílulas vazias (a altura não muda).
- `HEADER_GAP` vira `marginBottom={1}` (meio `lh`).

## 5. Cartões aninhados

Cartão = a linha com `r.card` e todas as seguintes mais fundas que ela (a mesma regra de `frames`,
`draw/layout.ts:1001-1014`). Em vez de uma fatia de cartão por linha (`cardSlice`), o cartão é um
`Box` que contém as linhas:

    const CARTAO = { borderStyle: 'round', paddingX: 1, paddingY: 0, flexDirection: 'column', flexGrow: 1, minWidth: 0, backgroundColor: 'userMessageBackground' }

    export function desktopTree(ui, lines, acts, cols) {
      const lanes = guides(lines), hides = labelCols(lines)
      const cut = (i, from, to) => cells(lines[i], lanes[i], hides[i]).filter(c => c.col >= from && c.col < to).map(c => c.text).join('')
      // os filhos de um contêiner cujo conteúdo começa na coluna `base`, para as linhas [a, b)
      const block = (a, b, base) => {
        const out = []
        for (let i = a; i < b; ) {
          const r = lines[i]
          if (!r.card) { out.push(desktopRow(ui, r, i, cut(i, base, Infinity), acts, cols)); i++; continue }
          let j = i + 1
          while (j < b && lines[j].depth > r.depth) j++
          const faixa = Array.from({ length: j - i }, (_, k) => cut(i + k, base, r.depth))
          out.push(
            <Box key={`c${i}`}>
              {faixa.some(s => s !== '') ? (
                <Box flexShrink={0}><Text mono color="inactive" dimColor wrap="truncate-end">{faixa.join('\n')}</Text></Box>
              ) : null}
              <Box {...CARTAO}>
                {desktopRow(ui, r, i, '', acts, cols)}
                {block(i + 1, j, r.depth)}
              </Box>
            </Box>,
          )
          i = j
        }
        return out
      }
      return block(0, lines.length, 0)
    }

Por que as guias não quebram:

1. **Dentro de um contêiner tudo é medido na mesma unidade.** Toda linha começa na borda de
   conteúdo do contêiner e avança de 3 em 3 caracteres mono. O cartão tem borda e padding, mas isso
   só desloca o conteúdo inteiro dele: as linhas de dentro continuam alinhadas entre si.
2. **O que é de fora do cartão fica fora.** As células de coluna menor que a profundidade do
   cabeçalho do cartão (as guias dos ancestrais e o conector do próprio cabeçalho) vão para a faixa
   à esquerda; as de coluna maior ou igual ficam nas linhas de dentro. `cut(i, from, to)` reparte
   pelas colunas de origem, então cartão dentro de cartão funciona igual: cada nível fica com as
   colunas entre a sua base e a base do de dentro.
3. **Só a primeira linha da faixa precisa bater com uma linha.** É nela que está o conector
   (`├─`/`└─`), que encosta na borda do cartão à altura do cabeçalho. As outras linhas da faixa só
   têm barra vertical ou espaço (uma linha de dentro tem o próprio conector numa coluna de dentro).
   Por isso a faixa pode ser um `Text` só, com uma linha por linha do cartão (`\n`).
4. **O cartão tem `paddingY={0}`** e as linhas têm `height={1}`: a primeira linha da faixa e o
   cabeçalho do cartão ficam a 1 px (a borda) um do outro. A faixa termina 2 px antes do fim do
   cartão por cartão de dentro; como ali só há barra, aparece no máximo como uma folga de poucos px
   na guia.
5. **A barra do pai cai sob o ícone do pai.** A última célula da faixa é a coluna do pai; a barra
   está no meio dela, e o ícone do pai está no meio da célula dele, na mesma coluna do mesmo
   contêiner.
6. **Faixa sem nada** (cartão solto na raiz, ou colunas todas escondidas): não é desenhada, e o
   cartão ocupa a largura toda.
7. **O corte de linhas não atrapalha.** `limitRows` corta `Row[]` antes da árvore; um cartão cortado
   no meio fecha onde as linhas acabam, e a linha "+N linhas" (profundidade 1) fecha os cartões
   abertos.

Fundo e borda: borda padrão do app (a mesma da caixa de texto, o pedido original: "use a mesma cor
da borda"); fundo `userMessageBackground` (superfície 1 do app). Se o tom ficar errado no app, as
outras opções confirmadas no bundle são `userMessageBackgroundHover` (superfície 2) e sem fundo.
Cartão de dentro: o mesmo fundo, mais estreito pelo padding do de fora (hoje, 6 px por nível).

Com isso `frames`, `Card` e `Frame` deixam de ser usados (seção 8).

## 6. Keys

Cliques (não mudam; `ui.press` responde por elas pelo mapa `actions`):

| Key | Onde | Ação |
|---|---|---|
| `fold:<Row.fold.key>` | `Button` sobre o ícone de progresso; sobre o busto do rótulo; o ▸/▾ da seção | `setFold` |
| `open:<sid>` | `Button` sobre o anel do rótulo de sessão | `openSession` |
| `back` | `Button` do desenho de emergência | `closeOpened` |

`Box` (no desktop a key de um `Box` só cria escopo de hover; servem aos testes para achar as partes):

| Key | Elemento |
|---|---|
| `head` | o cartão do cabeçalho (já existe, `render.tsx:94`) |
| `band` | a faixa de estado; o estado se lê em `backgroundColor` e no `alt` |
| `chip:<tom>` | cada pílula (um tom, uma pílula) |
| `r<i>` | a linha `i` de `lines` (já existe, `render.tsx:98`); agora pode estar dentro de cartões |
| `c<i>` | o grupo do cartão cujo cabeçalho é a linha `i` (novo) |
| `error` | a linha "Sessões indisponíveis" (já existe, num `Text`) |

Nenhuma key leva estado. O app não reconcilia por key (troca o DOM inteiro); o que ele reencontra
depois de redesenhar é o `Button`, pela key e pela ordem.

## 7. Limite de tamanho

- **Código:** `DRAW_LIMIT` (`hooks/panel.ts:545`), `drawn`, `sized`, o laço e `fitted`
  (`hooks/render.tsx:363-398`) **não mudam**. O laço mede `JSON.stringify` da árvore e pede menos
  linhas a `layout()`: nada ali depende de SVG. A chave de `fitted` continua
  `${surface}:${bodyColumns}`.
- **Não subir o limite.** Os 600 KB são empíricos e a causa nunca foi achada; pode ser tamanho de
  mensagem, que não depende do que vai dentro.
- **Peso por linha** (estimativa, não medição): célula do ícone com o `Svg` ≈ 0,7 KB; guias ≈
  0,15 KB; título ≈ 0,15 KB mais o texto; direita 0,2 a 0,9 KB. Linha folha ≈ 1,2 a 1,4 KB; linha
  com colunas ≈ 2 KB; rótulo de sessão completo ≈ 2,5 KB. Hoje: mediana 1,5 KB (0,9 a 3,7). Ou
  seja, a mesma ordem de grandeza: 400 linhas continuam perto do limite. **Medir na etapa 1**
  (`drawn.size / drawn.rows` nos quatro cenários do golden e no pedido pesado) e registrar no
  `DESENVOLVIMENTO.md`.
- **Nós, a novidade.** Hoje uma linha são 3 a 5 nós; nativa, 20 a 32 contando os textos (rótulo de
  sessão completo: 32; linha com colunas: 27). 400 linhas ≈ 8 a 13 mil nós, abaixo dos 20.000 do
  tipo. Profundidade máxima: raiz, até 5 cartões aninhados (2 níveis cada), linha, célula, `Box`
  absoluto, `Svg` = 15, abaixo de 32. Ao acrescentar qualquer coisa numa linha, a conta é
  `nós por linha × 400 < 20.000`.
- **Testes que dependem do peso:** os três de `cabecalho.limite-de-linhas-do-desenho` que montam o
  desktop (`tests/cabecalho.test.ts:297-355`, com `noApp` em 267-274) partem de "menos de 400
  linhas e mais de 600 KB" e leem as linhas pelo `alt` de cada `Svg`. A linha de seção deixa de ter
  `Svg`: passam a ler o texto da linha (`r<i>`), e o título comprido (`LONGO`, linha 264) pode
  precisar crescer para o desenho seguir acima do limite.
- **Sugestão de trava** (para quem cuida dos testes): no mesmo cenário pesado, conferir nós ≤
  20.000 e profundidade ≤ 32.

## 8. O que sobrevive e o que morre

### `draw/svg.ts`

Sobrevive (texto compartilhado com o terminal, textos alternativos, primitivas de ícone):
`clockText`, `GLYPH`, `prefix`, `ratioBar`, `plural` (usado por `hooks/tools.ts:9`), `rateText`,
`ULTRA`, `percent`, `LIGHT`, `DARK`, `STYLE`, `slim`, `ringClass`, `contextRing`, `ringTerm`,
`SessionKind`, `sessionIcon`, `sessionState`, `envelope`, `MSG_CLASS`, `MSG_TERM`, `PROGRESS`,
`progress`, `icon`, `RING_LABEL`, `Chip`, `chips`, `HeaderState`, `headerState`, `gitAlt`,
`gitTerm`, `rowAlt`, `rightText`.

Morre (remover na última etapa): `FONT`, `slot`, `toRight`, `svgOpen`, `xml`, `WIDE`, `emOf`,
`ems`, `em`, `textW`, `r1`, `fit`, `fitStart`, `FOLDER_MAX`, `branch`, `repoIcon`, `folderIcon`,
`gitSvg`, `gitW`, `labelName`, `labelSvg`, `TIME_W`, `TIME_GAP`, `COUNT_W`, `NO_FRAME`,
`rowHeight`, `cardSlice`, `rowSvg`, `BAND`, `PILL`, `headerSvg`; em `slim`, a regra
`svg,text{cursor:default;user-select:none}` (não há mais texto em SVG); em `LIGHT`/`DARK`, as
classes que só o desenho antigo usava (`p`, `s`, `pc`, `sc`, `g`, `ln`, `lnf`, `cd`, `cs`, `csf`,
`cds`, `ul`, `blf`, `amp`, `grp`, `gyp`, `blp`; conferir uma a uma contra `icon`, `envelope`,
`sessionIcon`, `contextRing` e `headBar`). O cabeçalho do arquivo (linhas 1-3) e o import de
`./geometry` (linhas 5-8) saem junto.

O arquivo não é renomeado nesta migração: o nome está em cerca de 15 `Código:` do catálogo.

### `draw/geometry.ts`

Morre inteiro (156 linhas): não sobra px nem célula contada. O arquivo é apagado na última etapa,
junto com `Código da área: draw/svg.ts, draw/geometry.ts` de `regras/visual.md` (o check falha com
caminho inexistente no mapa) e a seção "Sobreposição dos Box" do `DESENVOLVIMENTO.md` (739-745).

### `draw/layout.ts`

Sobrevive: tudo o que monta `Row[]`, `Row`, `Tone`, `Guide`, `guides`, `labelCols`, `MAX_ROWS`,
`limitRows`, `MSG_WORD`, `SUB_WORD`, `GitLabel`, `gitLabel`, `SessionState`, `kidsState`.

Morre: `Card`, `Frame`, `frames` (987-1014) e `import { PAD } from './geometry'` (linha 12). Os
comentários que falam em "Svg" (843, 962-963, 983-986) são reescritos.

### `hooks/render.tsx`

Sobrevive: `folds`, `setFold`, `closeOpened`, `fitted`, as chaves de estado, `pressOf`,
`drawTerminal`, `press`, `render` (leitura do estado, cabeçalho calculado, o `alt`, o laço do
limite, o desenho de emergência, o `catch`).

Morre: `drawDesktop` (72-119) com `over`, `sources`, `placed`; os imports `lineWidth`, `overlays`,
`Placed`, `frames`, `headerSvg`, `rowHeight`, `rowSvg`, `rowAlt`, `RING_LABEL` (os dois últimos
passam a ser importados pelos arquivos novos); a variável `W` (310). O comentário das linhas 55-71
é reescrito.

### `hooks/panel.ts`

Nada morre. `act`, `actions`, `DRAW_LIMIT`, `drawn` ficam como estão.

## 9. Etapas

Cada etapa termina com `npm run check` inteiro verde e um commit local. Toda etapa que muda o
desenho do desktop muda os `Svg` que o golden guarda: o golden é regravado no mesmo commit
(`npm run golden:aprovar -- --todos --motivo "\"migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG\", 2026-11-13"`),
e os testes reescritos levam `Reescrito: 2026-11-13, decisão do usuário (…)` no cenário e selo
`--tipo decisao`. Um escritor por arquivo; quem integra é o único a tocar `hooks/render.tsx`.

### Etapa 1: fundação e linhas fora de cartão

O que muda: toda linha que não está em cartão (`frames(lines)[i].cards.length === 0`) passa a ser
nativa; as linhas de cartão e o cabeçalho continuam como hoje. O desenho mistura as duas formas
(estado intermediário, que o usuário não vê: ele valida no fim).

| Arquivo | O quê | Pode ir em paralelo |
|---|---|---|
| `draw/icons.ts` (novo) | as cinco funções da seção 2, todas já nesta etapa | sim |
| `draw/desktop.tsx` (novo) | `cells`, `iconCell`, `desktopRow` para tarefa, pedido, aviso, ↩, ✉ e seção | sim, contra a assinatura de `icons.ts` |
| `hooks/render.tsx` | `acts`; no `lines.map` de `drawDesktop`, `cards[i].cards.length === 0 ? desktopRow(...) : <o Svg de hoje>` | depois dos dois |
| `tests/kit/leitura.ts`, `tests/visual.test.ts`, `tests/cabecalho.test.ts`, `regras/visual.md`, `regras/cabecalho.md`, `tests/golden/svg.ts`, `regras/selos.json` | leitura do desktop nativo; reescritas abaixo | sim |

Antes de escrever as linhas, um teste descartável que monta o desktop com: `draw/desktop.tsx`
importado, `height={0.2}`, `width="40%"`, `color="effortUltra"`,
`backgroundColor="userMessageBackground"`, um `Text` com `\n`. O que o harness recusar troca de
forma já (as alternativas estão nas seções 2, 4.3 e 5).

O que quebra e é reescrito: os quatro cenários do golden; em `tests/visual.test.ts`, "o título de
uma linha sem contagem vai até o tempo" (62-73) e a parte do tooltip que acha o título no
`foreignObject` (80-90); os três testes de 600 KB de `tests/cabecalho.test.ts`.

### Etapa 2: cartões de sessão e de subagente

O que muda: `desktopTree` (seção 5), o rótulo de sessão (4.5), o anel com o `Button` que abre a
sessão. Todas as linhas ficam nativas; `rowSvg`, `labelSvg`, `overlays` deixam de ser chamados.

| Arquivo | O quê | Pode ir em paralelo |
|---|---|---|
| `draw/desktop.tsx` | `desktopTree`, o rótulo, a célula do anel, o cálculo do que cabe | sim |
| `hooks/render.tsx` | `drawDesktop` vira: `errorLine`, o cabeçalho de hoje, `desktopTree(...)`; saem os imports sem uso | depois |
| `tests/visual.test.ts` (os dois testes de cartão, 93-129), `tests/ultracode.test.ts` se a leitura por `alt` deixar de bastar, `regras/visual.md`, golden, selos | reescritas | sim |

`draw/icons.ts` não é tocado (ficou completo na etapa 1).

### Etapa 3: cabeçalho

O que muda: `desktopHead` (4.9) no lugar de `headerSvg`; some `W`/`lineWidth` do render.

| Arquivo | O quê | Pode ir em paralelo |
|---|---|---|
| `draw/head.tsx` (novo) | o cabeçalho inteiro | **pode ser escrito desde a etapa 1**, porque nenhum outro escritor toca o arquivo; só entra no commit da etapa 3 |
| `hooks/render.tsx` | linhas 309-323: monta o `Head` e chama `desktopHead`; passa `cols` em vez de `W` | depois |
| `tests/visual.test.ts` (os dois testes da faixa, 15-50), `regras/visual.md` (`visual.faixa-de-estado-geral`, `visual.cabecalho-em-cartao`), golden, selos | reescritas | sim |

`tests/taxa.test.ts` e o `topo` de `tests/ultracode.test.ts` leem `svgs[0].alt`: seguem passando
se a barra do cabeçalho for o primeiro `Svg` e levar o `alt` de hoje (4.9).

### Etapa 4: remoção do código morto e documentação

Sem mudança de desenho (o golden não muda, salvo pela regra de cursor do `slim`; para não regravar
o golden aqui, **tirar essa regra já na etapa 3**).

| Arquivo | O quê | Pode ir em paralelo |
|---|---|---|
| `draw/svg.ts` | apagar a lista "morre" da seção 8 | sim |
| `draw/geometry.ts` | apagar o arquivo | com `svg.ts` e `layout.ts` (o mesmo escritor: os imports se cruzam) |
| `draw/layout.ts` | apagar `frames`, `Card`, `Frame`, o import de `PAD`; comentários | idem |
| `task-tree/DESENVOLVIMENTO.md` | "Desenho" (578-600), "Sobreposição dos Box" (739-745), "O que só é verificável no app" (648-664), uma seção datada "Híbrido nativo (2026-11-13)" com o que a seção 1 daqui confirmou | sim |
| `CLAUDE.md`, `regras/README.md`, `regras/visual.md` | "Golden do SVG", checklist do app, `Código da área` | sim |

## 10. Riscos que só o app mostra

1. **Guias em caracteres.** O glifo `│` costuma ser mais baixo que a altura de linha: as guias
   podem aparecer tracejadas entre linhas. Se a fonte mono do app não tiver os caracteres de caixa,
   o substituto pode ter outra largura e deslocar o ícone de uma linha para a outra.
   Ajustes possíveis: `size` um degrau acima só no `Text` das guias; célula de 2 caracteres.
2. **Altura das linhas.** Todas com 1 `lh` do corpo (hoje 28 e 30 px). O painel fica mais denso;
   aumentar a altura afasta as barras das guias.
3. **Cursor e seleção.** Texto nativo é selecionável e mostra o cursor de texto. O usuário pediu no
   passado a seta sobre o texto ("quero que o mouse seja o mouse padrão, seta"); o kit não dá
   controle disso.
4. **`Button` sobre o ícone e sobre o anel.** Tamanho e posição do realce, alvo do clique nos dois
   temas, se o clique chega durante a troca do desenho. Mesma técnica de hoje, mas a célula mudou.
5. **Cartão.** Raio, cor da borda, tom de `userMessageBackground` nos dois temas, cartão dentro de
   cartão, a folga de 1 a 2 px entre a faixa lateral e as bordas.
6. **Corte de texto em flex.** O "…" do título com a direita intacta em painel estreito; o `Box`
   que cresce não empurrar o tempo para fora; o rótulo de sessão no limite da largura.
7. **Unidade `ch`.** É a largura do "0" da fonte do corpo, que é proporcional: as larguras 7, 5 e 3
   das células da direita são aproximações.
8. **Alinhamento vertical de tamanhos diferentes.** Os `Text` são centrados na linha, não alinhados
   pela base: título (corpo) e tempo (`footnote`) podem parecer desnivelados.
9. **Cores.** `dimColor` é 60% fixo; `effortUltra` e `userMessageBackground` estão fora do tipo
   (numa versão do app que não as conheça, o texto sai na cor padrão e o cartão sem fundo); as duas
   tintas cruas do cabeçalho não seguem o tema.
10. **Cabeçalho.** A faixa cortada pelos cantos (`overflow="hidden"`), o `%` em `size="title"`
    (outra família de fonte), a altura final.
11. **Desempenho.** A cada segundo o app troca o DOM inteiro: hoje são até 400 imagens, depois até
    ~13 mil elementos. Piscar, travar a rolagem ou perder o hover são possíveis.
12. **Tamanho real aceito.** O limite do `Pane` para uma árvore nativa (bytes e nós) é desconhecido.
13. **Recarga a quente** com o painel aberto: igual a hoje, mas vale rever.

## 11. Pontos em aberto (interpretações que tomei, sem reabrir as decisões)

1. **Ícones de git (repositório, branch, pasta) viram texto** (`⑂`, `▭`): não são ícones de estado,
   então pela decisão saem do SVG.
2. **A barra das linhas vira nativa**; só a do cabeçalho fica em SVG.
3. **Ícones de subagente (▸) e de resposta (↩) ficam em SVG**: ocupam o lugar do ícone de estado da
   linha. O ▸/▾ das seções vira texto de `Button`.
4. **As tarefas de um cartão de sessão começam alinhadas ao busto do rótulo**, como no terminal;
   hoje, no desktop, recuam um nível. Para manter o recuo, basta `cells` não pular as colunas de
   `hide` (trocar por três espaços).
5. **Faixa "aguardando" e trilho** usam cor crua com transparência. Alternativa que segue o tema:
   a faixa como borda de um `Box` de largura zero com `borderDimColor` (deixaria de ser "fundo de
   `Box`", que foi a decisão).
6. **`alt` do ícone = `rowAlt` inteiro**: um leitor de tela ouve a linha duas vezes (o `alt` e o
   texto nativo). Mantive para não mudar o texto alternativo nem os testes que o leem.
7. **Etapas 1 e 2 podem ser uma só** se a mistura temporária de linhas nativas e em SVG incomodar:
   economiza uma regravação do golden, ao custo de um commit maior.
