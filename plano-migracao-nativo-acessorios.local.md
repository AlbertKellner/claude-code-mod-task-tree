# Plano da migração para o desenho nativo: acessórios de qualidade

Escrito em 2026-11-13 por um agente de planejamento, só por leitura da worktree
`<repo>-wt\integra` (branch
`feat/painel-nativo`, base `b7d2a50`). Nada foi editado nem executado lá além de `git`, `grep`,
`node scripts/impacto.mjs`, `node scripts/regras.mjs` e uma chamada pura a `motivoValido`.
Os tipos lidos são os do kit 2.1.321 (`task-tree/.claude-plugin/types/claude-code/index.d.ts`).
Todos os caminhos abaixo são relativos à worktree, salvo quando absolutos.

Parte coberta: testes, kit de testes, golden, selos, travas, catálogo `regras/`, matriz de impacto,
CI, `CLAUDE.md`, `DESENVOLVIMENTO.md` e a ordem dos commits. O desenho em si (quais `Box`/`Text`
cada linha vira) é de outro plano; a seção 7 lista o que este plano exige dele.

## 1. O que decide o plano (ler primeiro)

Cinco fatos das travas e dos tipos, conferidos no código, que mandam em todo o resto:

1. **Teste que falha contra o código novo não pode ser removido nem renomeado.** A etapa `regressao`
   roda os testes de `HEAD` (com o kit e o golden de `HEAD`) contra o código novo
   (`scripts/regressao.mjs:50-58`) e só aceita uma falha quando a MESMA chave `arquivo::nome` tem,
   no `regras/selos.json` novo, selo `decisao` de hoje com hash diferente
   (`liberaTeste`, `scripts/selos.mjs:169-171`; uso em `regressao.mjs:83-96`). Chave que sumiu do
   `selos.json` (`--remover`, ou nome trocado) cai em "REGRESSÃO OU DECISÃO NÃO REGISTRADA". Logo:
   todo teste afetado é **reescrito sob o mesmo nome**, nunca removido.
2. **Mudar só o kit não libera um teste.** `liberaTeste` exige hash novo do teste. Se o teste de
   `HEAD` falha contra o código novo, o corpo do teste (ou uma declaração de topo que ele usa) tem de
   mudar no mesmo commit, com selo `decisao`.
3. **O selo e o commit são do mesmo dia.** `liberaTeste` e `liberaGolden` comparam `s.data` com
   `hoje()` (`selos.mjs:29,164-171`). Selou ou aprovou o golden num dia e fez o commit no outro: a
   `regressao` do hook falha. Sele (e aprove o golden) de novo no dia do commit.
4. **Na comparação com a base do PR vale só o último selo.** `npm run check -- --base origin/main`
   (a CI, e o ensaio final) roda os testes do `main` contra o código final: os 18 testes da seção 2
   falham lá, e cada um precisa terminar a branch com selo `decisao` de hash diferente do `main`.
   Nesta branch, **todo selo desses 18 testes é `--tipo decisao`, sempre**; um `refatoracao` por
   último (mesmo legítimo) quebra o check com `--base`.
5. **`exigirReescrito`** (`selos.mjs:207-210,256`): selar como `decisao` exige, em cada regra citada
   pelo teste, uma linha `Reescrito: AAAA-MM-DD,` (com a vírgula) de data igual ou posterior à do selo
   anterior. A lista das regras está na seção 5.

Consequência: a forma mais barata é **uma etapa de preparação, antes de qualquer mudança no desenho**,
que troca a leitura do desktop nos testes por uma leitura que vale para o SVG por linha E para o
nativo ("texto de uma região = textos mostrados + `alt` dos `Svg` dentro dela"). Com ela, cada teste
é reescrito uma vez só, passa no desenho atual (a `regressao` não tem o que reclamar: o código não
mudou) e segue passando em cada etapa híbrida, servindo de rede de proteção da migração. Nas etapas
do desenho sobram só o golden e três testes de geometria em pixel.

### Conferência da análise contra os tipos (kit 2.1.321)

- **Divergência que afeta o desenho e o checklist:** um `Button` só aceita strings e `Text` como
  filhos; "any other element is refused" (`index.d.ts:1106-1112` e `10349-10353`). O ícone de estado
  fica em `Svg` (decisão do usuário), então **o `Svg` do ícone não pode ser filho do `Button`**. A
  análise (`analise-svg-e-recarga.local.md`, linhas 56-57 e 121-122) afirma o contrário ("o próprio
  ícone pode ser o alvo do clique", "`overlays` deixa de existir"); isso só vale para ícone em texto.
  O clique no ícone e no anel segue sendo um `Button` sobre o `Svg` (um `Box` `position="absolute"`,
  em células inteiras) ou um `Button` ao lado. Parte de `draw/geometry.ts` pode sobreviver por isso,
  e "cliques no ícone e no anel" continua no checklist do app.
- `key`: `BoxProps.key` (`:930-938`) e `ButtonProps.key` (`:1094-1104`) existem; `TextProps`
  (`:13871-13940`) não tem `key`, embora o JSX aceite (`:16484-16486`) e o terminal de hoje escreva
  `<Text key="title">`. Os tipos não dizem se a `key` de um `Text` chega ao `drawn()`
  (`FoundElement.key`: "What its props carry as `key`, when they do", `:16924`). **O kit novo
  não depende de `key` em `Text`**: acha linha e cabeçalho pela `key` do `Box`, botão pela `key` do
  `Button`, e pedaço de linha pelo texto. Sonda de 5 linhas, na etapa de preparação, para registrar o
  fato no `DESENVOLVIMENTO.md`: `(await ui.findAll({ type: 'Text' })).map(t => t.key)`.
- `ui.find`/`findAll` (`ElementQuery`, `:16686-16706`; `:17329-17346`) casam `type`, `key` e o texto mostrado
  (strings filhas, rótulo de `Button`/`Link`, `Markdown`, `Code`, `Input`). **O `alt` de um `Svg` não
  entra no texto.** O kit continua andando na árvore de `drawn()` por conta própria (como hoje).
- `$.ui.mount` valida a árvore pela tabela da superfície e **rejeita com o motivo** quando há
  elemento ou prop que ela não tem (`:16786-16790`, `:17316-17327`). Um teste que monta o `desktop` é,
  de graça, a validação das props do desenho nativo na versão do binário que roda o teste. É por isso
  que a versão fixada na CI importa (seção 6).
- O harness "never a surface's paint" (`:42-44`): largura real, corte com "…", cor pintada e posição
  em pixel continuam fora do alcance. Asserção em px não tem tradução; vira estrutura (o que vem
  depois do título na linha) mais checklist.
- Confirmados como a análise diz: `Svg` com `source` até 131072 caracteres, `alt` obrigatório,
  `width`/`height` numéricos, `isInteractive` (`:13576-13608`); `Text` com `size`, `weight`, `mono`,
  `tabular`, `wrap: 'truncate-end'…` (`:13871-13940`); `Box` com `backgroundColor`, `borderStyle`,
  `overflow`, `position`, `top/left/right/bottom` inteiros em células, `hover` (`:889-1041`);
  `ThemeKey` com 23 chaves (`:14053`).
- `drawn()` devolve, num `Button`, `press: { plugin, handle: number }` (`:10339-10342`) e, em
  `Box`/`Text`, `part`/`group` (`:13523-13533`). Isso não é desenho e o `handle` não é estável: o
  golden novo precisa tirar esses campos (seção 4).

## 2. Testes que leem o desenho do desktop

São 18, em 5 arquivos. Nenhum outro teste monta `surface: 'desktop'` (conferido com `grep`): os
outros 212 leem o terminal por `painel()`/`montar()` e **não mudam, desde que a árvore do terminal
(`drawTerminal`, `hooks/render.tsx:123-185`, e o cabeçalho de `:328-353`) saia byte a byte como hoje**.
Qualquer mudança nela derruba dezenas de testes de `HEAD` na `regressao`.

Selo: `decisao` em todos (motivo no fim da seção). "Quando" diz em que etapa o teste é reescrito.

### 2.1 `task-tree/tests/taxa.test.ts`

| Teste | Lê hoje | Afirma | Forma nova | Quando |
|---|---|---|---|---|
| `no fim do turno o último número fica aceso, sem "(último turno)"` (linhas 38-49; `altTopo`, linha 8) | `svgs($)[0].alt`: o `alt` do `Svg` do cabeçalho | depois do fim do turno, o cabeçalho diz `100 toks/s` e não diz `último turno` | `const d = await noApp($)`; `expect(d.cabecalho.texto).toContain('100 toks/s')`; `expect(d.cabecalho.texto).not.toContain('último turno')`. Opcional, quando o cabeçalho for nativo: o `Text` do número sem `dimColor` ("aceso") | preparação |

Os outros 3 testes do arquivo leem o terminal (`topo`, `painel`) e não mudam.

### 2.2 `task-tree/tests/ultracode.test.ts` (helpers `cartao`, linha 20, e `topo`, linha 21)

| Teste | Lê hoje | Afirma | Forma nova | Quando |
|---|---|---|---|---|
| `o cartão da filha diz "ultracode" depois do modelo enquanto ela publica o interruptor ligado` (26-42) | o `alt` do `Svg` da linha que contém `filha-um` | contém `Opus 5.5 · xhigh, ultracode`; sem o interruptor, contém `Opus 5.5 · xhigh` e não `ultracode` | `const l = linhaDoApp(await noApp($), /filha-um/)`; `expect(l.texto).toContain('Opus 5.5 · xhigh')`; `expect(l.texto.indexOf('ultracode')).toBeGreaterThan(l.texto.indexOf('Opus 5.5 · xhigh'))` (a ordem "à direita do modelo"; no `alt` de hoje e no nativo); depois: contém o modelo e `not.toContain('ultracode')`. 3 asserções → 4 | preparação |
| `ultra_effort_enter acende a palavra no cabeçalho e no arquivo publicado; ultra_effort_exit apaga` (44-61) | `svgs($)[0].alt` | o cabeçalho ganha e perde `ultracode`; o arquivo publicado idem | `topo` passa a ser `(await noApp($)).cabecalho.texto`; as 5 asserções ficam iguais | preparação |
| `a palavra digitada num prompt e o attachment de um subagente não acendem` (63-75) | `svgs($)[0].alt` | o cabeçalho não diz `ultracode` | o mesmo `topo`. Atenção: a versão antiga passaria **à toa** no nativo (o primeiro `Svg` vira um ícone qualquer); por isso é reescrita mesmo sem falhar | preparação |
| `com a sessão em ultracode, o cartão de subagente não diz "ultracode"` (77-93; `svgs` direto, linha 88) | `alts[0]` e o `alt` que contém `Explore: ler o kit` | cabeçalho com `ultracode`; a linha do subagente com `ler o kit` e sem `ultracode` | `d.cabecalho.texto` e `linhaDoApp(d, /Explore: ler o kit/).texto`; 3 asserções iguais | preparação |

### 2.3 `task-tree/tests/cabecalho.test.ts` (helpers das linhas 260-295)

Os três testes de `cabecalho.limite-de-linhas-do-desenho` com `{ timeoutMs: 15000 }`:

- `sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso` (298-318)
- `com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha` (321-341)
- `um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso` (344-355)

Leem hoje, por `noApp` (267-274): `aviso` (o texto "Painel grande demais"), `bytes`
(`JSON.stringify(raiz).length`), `alts` (o `alt` de cada `Svg`, um por linha), `antes`
(`/\+\d+ linhas anteriores$/` num `alt`) e `depois` (`/\+\d+ linhas$/`). Afirmam: sem aviso, desenho
≤ 600 KB, a linha de contagem existe (ou não), `Pequeno um` e `U0.0.0` desenhados, o corte igual um
segundo depois, e a última linha é a de contagem.

Forma nova, com as mesmas asserções:

- `noApp`, `mostradoNoApp` e `altsNoApp` saem do teste e vão para o kit (seção 3). `alts` vira
  `textos`: o texto de cada linha (`d.linhas.map(l => l.texto)`), que no SVG de hoje é o `alt` da
  linha e no nativo é o que a linha mostra. `antes` e `depois` usam os mesmos dois regex sobre
  `l.texto` (já aparado). `d.alts[d.alts.length - 1]` vira `d.textos[d.textos.length - 1]`.
- **O cenário precisa de títulos mais pesados.** `pedidoPesado` (279-287) monta 393 linhas com
  `LONGO` de 83 caracteres: "menos de 400 linhas e mais de 600 KB" só é verdade porque cada linha
  em SVG pesa cerca de 1,5 KB. No nativo a linha pesa algumas centenas de bytes: 393 linhas ficam
  abaixo de 600 KB, o corte por tamanho não acontece e os três testes falham (`d.antes` indefinido).
  Na preparação, troque `LONGO` por um título de cerca de 1 700 caracteres (por exemplo
  `'com um título comprido, …'.repeat(20)`): 393 linhas nativas passam de 600 KB só com os títulos
  (≈ 670 KB), e no SVG de hoje o desenho fica maior e o corte acontece do mesmo jeito (o laço de
  `render.tsx:379-383` converge em poucas voltas). O comportamento afirmado não muda. Na etapa em
  que as linhas viram nativas, confira o `kb(d)` das mensagens; se o desenho inteiro ficar abaixo de
  600 KB, aumente a repetição e sele de novo (`decisao`).
- O comentário das linhas 276-278 passa a dizer "títulos longos o bastante para o desenho nativo
  passar de 600 KB".

Quando: preparação. Os outros 12 testes do arquivo leem o terminal (inclusive os dois do corte de
400 linhas) e não mudam. `PROPS` e `AGORA` deixam de ser importados aqui se só `noApp` os usava
(`tsc` com `noUnusedLocals` bloqueia import sem uso).

### 2.4 `task-tree/tests/visual.test.ts`

| Teste | Lê hoje | Afirma | Forma nova | Quando |
|---|---|---|---|---|
| `a faixa do cabeçalho: em andamento, aguardando, concluído e interrompido` (14-30) | a classe `fx fx-<tom>` e `class="ch-current"` no SVG do cabeçalho | o estado geral: só pendentes → aguardando; iniciada → em andamento; fim do turno → aguardando; tudo concluído → concluído; e a pílula "em andamento" existe | `faixa` passa a ser `estadoGeral(await noApp($))`, a palavra depois de "estado geral: " no texto do cabeçalho: `'aguardando'`, `'em andamento'`, `'aguardando'`, `'concluído'`. A linha 24 vira `expect((await noApp($)).cabecalho.texto).toContain('1 em andamento')`. 5 asserções | preparação |
| `a faixa do cabeçalho: interrompido depois do Esc, e sessão ativa com só a filha trabalhando` (33-50) | idem | `running` → `'sessão ativa'`; `current` → `'em andamento'`; depois do Esc, `not.toBe('em andamento')` | idem, 3 asserções. Quando o cabeçalho for nativo, pode ganhar a cor da faixa (`backgroundColor` do `Box` da faixa, chave de tema por estado) como asserção a mais, ainda `decisao` | preparação |
| `texto cortado não tem tooltip: nenhuma camada interativa e nenhum <title>` (76-89) | `foreignObject` com o título inteiro; `isInteractive`; `<title` | o título vai inteiro ao desenho; nenhum `Svg` interativo; nenhum `<title>` | `const d = await noApp($)`; `expect(d.linhas.some(l => l.texto.includes(LONGO))).toBe(true)`; `expect(d.svgs.filter(s => s.isInteractive).length).toBe(0)`; `expect(d.svgs.some(s => s.source.includes('<title'))).toBe(false)`; mais uma, que já é verdade hoje e passa a importar no nativo: `expect(d.revelados).toBe(0)` (nenhum elemento com `hover` nem `display: 'none'`, o cartão de hover nativo). 3 → 4 | preparação |
| `o título de uma linha sem contagem vai até o tempo; a com contagem corta antes da barra` (62-73) | `foreignObject x` e `calc(100% - N px)` | a folha deixa à direita só o tempo; o pai, também a contagem e a barra (diferença > 60 px) | **impossível em px.** Nativo: as duas linhas cujo pedaço de título é `LONGO`, na ordem pai, folha (`pedacosDepois(l, LONGO)`, seção 3). Folha: depois do título só vem o tempo (`/^\d+:\d\d/`), nenhum pedaço `/^\d+\/\d+$/`. Pai: depois do título há a contagem `0/2`. O `Text` do título leva o título inteiro e `wrap` de corte no fim (`truncate-end`, ou o que o desenho usar). `Curta` existe como linha | etapa em que as linhas de tarefa da raiz viram nativas |
| `no cartão da filha, o título da folha passa da coluna da contagem e corta junto do tempo` (92-110) | px do fim do título contra o `x` do tempo | o título da folha termina entre 46 e 24 px antes do tempo | **impossível em px.** Nativo: na linha da folha dentro do cartão (título começando por `Um título`), depois do título só vem o tempo `0:00`; nenhum pedaço de contagem; o título inteiro no `Text` | etapa em que as linhas de dentro do cartão viram nativas |
| `a linha ↩ do cartão, sem tempo, vai até a borda do cartão antes de cortar` (113-129) | o recorte à direita ≤ 12 px | a linha ↩ só desconta a borda | **impossível em px.** Nativo: há uma linha só cujo texto começa por `Folha cortava`; depois do pedaço do resumo não há pedaço nenhum (nem tempo, nem contagem); o resumo inteiro no `Text` | etapa em que a linha ↩ do cartão vira nativa |

Os três últimos continuam usando `svgs()` (o leitor antigo, mantido no kit) até a etapa deles. O
ponto exato do corte, na largura real, vai para o checklist do app (seção 6).

### 2.5 `task-tree/tests/golden.test.ts`

`golden: principal`, `golden: filha`, `golden: envios`, `golden: subagente` (linhas 32, 56, 77, 97).
Leem hoje a lista de todos os `Svg` (`alt`, `height`, `source` normalizado) e comparam com
`tests/golden/svg.ts`. Forma nova na seção 4. Os nomes ficam (`regressao.mjs:88` acha o cenário pelo
nome `golden: <cenário>`). Reescritos na preparação (formato novo, mesmo desenho) e regravados em
cada etapa do desenho.

### 2.6 Selos e motivo

Para cada um dos 18, depois de reescrever o cenário (seção 5):

    npm run regras:selar -- "task-tree/tests/<arquivo>::<nome exato>" --tipo decisao --motivo "migração para o desenho nativo: <o que mudou na leitura>; decisão do usuário, 2026-11-13"

Nomes com aspas duplas (`"ultracode"`, `"+N pedidos anteriores"`, `"(último turno)"`, `"+N linhas"`)
quebram no `npm run` do Windows: chame `node scripts/selos.mjs --selar '<chave>' --tipo decisao --motivo '…'`
no Git Bash, com a chave entre aspas simples.

Testes novos sugeridos (selo `novo`, cenário novo na seção 5), para cobrir o que a sobreposição em
células deixava só no checklist; passam no desenho de hoje e, por isso, podem entrar na preparação:

- `visual.test.ts`: `no app, o ícone da linha que recolhe e o anel do cartão são botões com chave`:
  monta o desktop (`montarNoApp`), acha `Button` com `key` `fold:<chave>` na linha `Plano A`, aperta
  (`ui.press({ key })`), e a linha de baixo some de `d.linhas`; com uma filha que publica `context`,
  há um `Button` `open:<id da filha>` na linha do cartão, e apertá-lo pede `open_session_in` ao app
  (o stub `host` passa a guardar as ferramentas chamadas em `mcp.call`; ver 3.3).

## 3. Kit novo de leitura do desktop (`task-tree/tests/kit/leitura.ts`)

### 3.1 O que entra (depois da linha 103)

```ts
// ---- O desenho do app desktop, lido de um jeito que vale para o Svg por linha e para o nativo:
// o texto de uma região é o que ela mostra (strings, rótulo de Button) mais o alt dos Svg dela.
export type Pedaco = { tipo: 'texto' | 'svg' | 'botao'; texto: string; key?: string; props: Record<string, unknown> }
export type LinhaDoApp = { key: string; texto: string; pedacos: Pedaco[]; botoes: string[]; el: any }
export type DesenhoDoApp = {
  raiz: any
  bytes: number            // JSON.stringify(raiz).length, o que o limite de 600 KB mede
  aviso: boolean           // o desenho virou "Painel grande demais"
  cabecalho: LinhaDoApp    // o Box key="head" (texto '' se não houver)
  linhas: LinhaDoApp[]     // os Box key="r<i>", na ordem
  textos: string[]         // linhas.map(l => l.texto)
  svgs: DesenhoSvg[]       // todos os Svg, como svgs() os devolvia
  revelados: number        // elementos com hover ou display: 'none' (cartão de hover): tem de ser 0
}
export async function noApp($: any, opcoes: { colunas?: number } = {}): Promise<DesenhoDoApp>
export async function montarNoApp($: any, opcoes?): Promise<{ desenho(): Promise<DesenhoDoApp>; apertar(key: string): Promise<void>; fim(): Promise<void> }>
export function linhaDoApp(d: DesenhoDoApp, quem: string | RegExp): LinhaDoApp   // a única; senão erro com emTextoDoApp(d)
export const pedacosDepois = (l: LinhaDoApp, titulo: string): Pedaco[]           // o que vem depois do pedaço de texto === titulo
export const estadoGeral = (d: DesenhoDoApp) => /estado geral: ([^,;]+)/.exec(d.cabecalho.texto)?.[1]?.trim()
export const emTextoDoApp = (d: DesenhoDoApp) => [d.cabecalho.texto, ...d.textos].join('\n')
export function arvoreDoApp(raiz: any): { arvore: unknown; svgs: string[] }      // para o golden (seção 4)
```

Regras de leitura (uma função `pedacos(el)` recursiva, em ordem de documento):

- string com algo além de espaço → `{ tipo: 'texto', texto, props: as do Text que a contém }`;
- `Svg` → `{ tipo: 'svg', texto: props.alt, props }` (folha);
- `Button` → o `key` entra em `botoes`; sem filhos e com `label` não vazio depois de aparado, o
  `label` é um pedaço de texto (o `label=' '` da sobreposição de hoje não conta); com filhos, eles;
- `key` de um elemento: `el.key ?? el.props?.key` (o kit de hoje já lê dos dois jeitos, linha 70);
- `texto` da região: os pedaços juntados com um espaço, espaços repetidos reduzidos a um, aparado;
- `cabecalho`: o primeiro `Box` com `key === 'head'`; `linhas`: os `Box` com `key` `/^r\d+$/`;
- `linhaDoApp(d, 'x')`: a linha com um pedaço de texto igual a `x` (aparado) ou, na falta
  (desenho em SVG), cujo `texto` contém `x`; com `RegExp`, testa `texto`. Zero ou mais de uma: erro
  com o desenho inteiro em texto, como `linha()` faz no terminal (linhas 155-159).

`noApp` monta `surface: 'desktop'` com `PROPS(opcoes.colunas ?? 60)` e `requestId: 'task-tree'`, lê
`drawn()` e desmonta, como `svgs()` (linhas 82-86). `montarNoApp` deixa montado, relê com
`ui.drawn()` e aperta com `ui.press({ key })`.

### 3.2 O que sai, e quando

- `svgs()` e `DesenhoSvg` (linhas 78-103): `svgs()` fica até o último dos três testes de geometria
  da seção 2.4 ser reescrito; sai nesse commit, à mão (o `noUnusedLocals` não acusa export sem uso).
  `DesenhoSvg` fica (é o tipo de `d.svgs`).
- O comentário das linhas 4-5 ("pela superfície terminal. Único lugar que conhece os glifos…")
  ganha a segunda metade: "e o desenho do app desktop, por `key` de `Box`/`Button`, texto e `alt`".

### 3.3 `task-tree/tests/kit/ambiente.ts` (opcional, para o teste novo e para o golden)

- `Filha.contexto?: number` (tipo, linhas 83-97) e, no arquivo montado (linhas 121-133),
  `...(s.contexto !== undefined ? { context: { percent: s.contexto, at: AGORA } } : {})`
  (`io/publish.ts:33,44` lê `context.percent` e `context.at`). Hoje nenhum cenário do kit tem anel,
  e o golden não o trava (0 ocorrências de "contexto da sessão" em `tests/golden/svg.ts`), embora
  `visual.desenho-cartao-filha` diga "e anel". Como o anel é um dos três `Svg` que ficam, o cenário
  `golden: filha` deve passar `contexto: 42`.
- `Host.pedidosAoApp(): string[]`: o `on('mcp.call', …)` da linha 103 guarda `e.tool`; serve ao
  teste do botão do anel (`open_session_in`, `hooks/sessions.ts:335-343`).

### 3.4 Selo do kit

Cada commit que muda um arquivo de `tests/kit/` regrava o selo dele (a etapa `selos` só compara o
hash; o tipo é livre, `selos.mjs:185-190,233-239`):

    node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo decisao --motivo "leitura do desenho do app desktop por key, texto e alt (migração para o nativo, 2026-11-13)"

Opcional: acrescentar `'linhaDoApp'` a `ASSERCOES` (`scripts/selos.mjs:22`), porque ela falha quando
a linha não existe, e atualizar a lista em `regras/README.md:56-57`. Muda `scripts/`: as `travas`
rodam no hook.

## 4. Golden novo

### 4.1 O que travar

A árvore inteira do desktop, normalizada, mais os `Svg` que restam, por cenário:

```ts
// tests/kit/leitura.ts
// Só type, key, props, hover e children entram: press (o handle não é estável), part, group e client não são desenho.
export function arvoreDoApp(raiz: any): { arvore: unknown; svgs: string[] } {
  const svgs: string[] = []
  const ordenado = (o: any) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]))
  const no = (el: any): unknown => {
    if (typeof el !== 'object' || el === null) return el                 // string filha
    const p = { ...(el.props ?? {}) }
    const k = el.key ?? p.key
    delete p.key
    if (el.type === 'Svg') {
      const s = normalizar(String(p.source ?? ''))                        // LF e 2 casas, como hoje (linha 81)
      delete p.source
      const i = svgs.includes(s) ? svgs.indexOf(s) : svgs.push(s) - 1
      return { t: 'Svg', p: ordenado(p), s: i }                           // alt, height, width; a fonte por índice
    }
    return { t: el.type, ...(k !== undefined ? { k } : {}), ...(Object.keys(p).length ? { p: ordenado(p) } : {}), ...(el.hover ? { h: el.hover } : {}), ...(el.children?.length ? { c: el.children.map(no) } : {}) }
  }
  return { arvore: no(raiz), svgs }
}
```

- `no` só copia `type`, `key`, `props`, `hover` e `children`; não declare uma constante só para
  listar o que fica de fora (`noUnusedLocals` bloqueia local sem uso, também no kit).
- As fontes dos `Svg` ficam numa lista sem repetição: no nativo o mesmo ícone se repete em dezenas
  de linhas; a árvore referencia pelo índice, o arquivo fica pequeno e a mudança de um ícone aparece
  num lugar só.
- O valor de cada cenário passa de `DesenhoSvg[]` para `{ arvore, svgs }`. `hashGolden`
  (`selos.mjs:148`) é sobre o JSON do valor: nada a mudar.

### 4.2 `task-tree/tests/golden.test.ts`

- Linha 2: `import { GOLDEN } from './golden/desenho'`. Linha 5: `import { arvoreDoApp } from './kit/leitura'`
  (mais `PROPS` de `./kit/ambiente` se o teste montar direto; melhor um `desenhoDoApp($)` no kit que
  monta a 60 colunas e devolve `arvoreDoApp(await ui.drawn())`).
- `conferir` (20-29): o parâmetro vira `{ arvore, svgs }`; a primeira checagem vira "há desenho":
  `expect(JSON.stringify(desenho.arvore).length, `${cenario}: sem desenho`).toBeGreaterThan(2)`; o
  resto (a linha `GOLDEN-NEW <cenário> <json>`, a comparação e `trecho`) fica igual. `receber`
  (`scripts/golden.mjs:21-38`) lê essa linha e não depende do formato.
- Os quatro `conferir('<cenário>', await svgs($))` (52, 73, 93, 116) passam a
  `conferir('<cenário>', await desenhoDoApp($))`.
- `golden: filha` (56-74): acrescentar `contexto: 42` à filha do `host` (3.3).
- Comentário 7-9: "O desenho do app desktop em 4 cenários, a 60 colunas: a árvore de `Box`, `Text` e
  `Button` e os `Svg` que restam (ícones de estado, anel, barra do cabeçalho)".

### 4.3 Arquivo e scripts

- Arquivo: `task-tree/tests/golden/svg.ts` → `task-tree/tests/golden/desenho.ts` (`git mv`). O
  `.gitattributes` (`task-tree/tests/golden/* text eol=lf`) já cobre. A `regressao` copia os testes
  de `HEAD` inteiros, com o `golden/svg.ts` de `HEAD`: o teste antigo segue importando o arquivo dele.
- `scripts/selos.mjs:138-139`: comentário "Golden do desenho…" e
  `export const GOLDEN = 'task-tree/tests/golden/desenho.ts'`. `CABECA_GOLDEN` (140), `lerGolden`,
  `aprovarGolden`, `liberaGolden`, `motivoValido` não mudam.
- `scripts/travas.test.mjs:184-206`: o caminho `golden/svg.ts` nas linhas 196 e 202 vira
  `golden/desenho.ts`; o conteúdo de exemplo pode virar `{"principal":{"arvore":{"t":"Box"},"svgs":["<svg/>"]}}`
  (linhas 196 e 200; o `trocar` da 202, de `<svg/>` para `<svg></svg>`, continua valendo).
- `scripts/golden.mjs`: comentários 1-9 ("Golden do desenho", `tests/golden/desenho.ts`); o
  `--pagina` (61-69) usa `s.alt` e `s.source` de uma lista e quebra com o formato novo. Trocar
  `coluna(lista)` por uma função que desenha a árvore de forma aproximada: `Box` → `<div
  style="display:flex;flex-direction:…">`, `Text` → `<span>` (com `font-family:monospace` se
  `p.mono`), `Button` → `<button>`, `Svg` → `svgs[s]` em linha, string → texto escapado (`xml`, linha
  40). O título da página diz que é aproximação e que o aceite é no app. É só sob pedido do usuário e
  fora do check: pode ir em paralelo (seção 8).
- `CENARIOS` (`golden.mjs:18`) não muda. `regressao.mjs:87-90` não muda.
- `scripts/impacto.mjs:43` (`r.id.startsWith('visual.desenho-')`) não muda.

### 4.4 Aprovação pela sessão de migração

O motivo pedido passa no `golden:aprovar` como está: `motivoValido` (`selos.mjs:150`) só exige uma
data `AAAA-MM-DD` e um trecho entre aspas. Conferido com a função real:
`motivoValido('"migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG", 2026-11-13')`
→ `true`. Nenhum script precisa mudar por causa disso. No Git Bash, para as aspas chegarem inteiras:

    node scripts/golden.mjs --aprovar --todos --motivo '"migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG", 2026-11-13'

- A data dentro do motivo é a das palavras do usuário; a `data` do selo é sempre `hoje()`
  (`selos.mjs:158`), e é ela que a `regressao` compara (fato 3 da seção 1).
- Ordem na preparação: criar `tests/golden/desenho.ts` com
  `// Gerado por npm run golden:aprovar, com a aprovação do usuário no app; não editar à mão.` e
  `export const GOLDEN: Record<string, unknown> = {}` (o teste importa o arquivo; vazio, ele só
  imprime `GOLDEN-NEW`), remover `svg.ts`, e só então aprovar.
- Em cada etapa do desenho: implementar, `--aprovar --todos`, conferir o diff de `desenho.ts` (é
  legível: `Box`/`Text` com as props, e a lista de fontes), commit. O teste de golden de `HEAD` falha
  na `regressao` e passa por `liberaGolden` (aprovado hoje, hash novo).
- No fim, com o "funcionou" do usuário no app: aprovar de novo com as palavras dele e a data (os
  hashes não mudam; só o motivo e a data do selo), num commit só de `selos.json`. Assim o selo final
  volta a registrar a validação dele, como o `CLAUDE.md` promete.

## 5. Catálogo `regras/`

### 5.1 `Reescrito:` necessários antes de selar (formato exato, com a vírgula depois da data)

    Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): <o que muda>.

Vai antes do `Código:`/`Estado:` de cada regra citada por um teste re-selado:

| Regra | Arquivo:linha do `###` | O que dizer depois dos dois-pontos |
|---|---|---|
| `visual.tooltip` | `regras/visual.md:27` | "Então" vira: "não há tooltip: nenhum `Svg` interativo, nenhum `<title>` nos `Svg` que restam e nenhum cartão de hover (elemento com `hover` ou escondido)" |
| `visual.titulo-sem-contagem-vai-ate-o-tempo` | `visual.md:39` | "Então" vira: "o título vai inteiro ao texto da linha, e o app o corta com '…' onde o espaço acaba; na linha sem barra nem contagem, depois do título só vem o tempo (a linha ↩, sem tempo, nada); a linha com contagem tem a contagem e a barra depois do título. Onde o corte cai, na largura real, é do app (checklist)" |
| `visual.golden-gera-desenho` | `visual.md:145` | "Dado os 4 cenários (principal, filha trabalhando, envios, subagente)"; "Então cada cenário gera a árvore do desenho (`Box`, `Text`, `Button` e os `Svg` que restam: ícones de estado, anel, barra do cabeçalho), a mesma a cada vez" |
| `visual.desenho-principal`, `-cartao-filha`, `-envios`, `-subagente` | `visual.md:156,170,183,196` | "o desenho passa a ser a árvore nativa com os `Svg` que restam; o golden é regravado pela sessão de migração e validado pelo usuário no app no fim" (`-cartao-filha`: o cenário passa a ter o anel) |
| `visual.faixa-de-estado-geral` | `visual.md:207` | "a faixa é um `Box` com a cor de fundo do estado; o estado segue no texto alternativo do cabeçalho ('estado geral: …'), que é o que o teste lê" |
| `taxa.fim-do-turno-fica-aceso` | `regras/taxa.md:27` | "o teste lê o texto do cabeçalho do app (textos e texto alternativo), não mais o `alt` de uma imagem" |
| `ultracode.cartao-da-filha`, `ultracode.so-o-interruptor-real`, `ultracode.cabecalho`, `ultracode.subagente-sem-palavra` | `regras/ultracode.md:7,17,28,50` | idem; em `cartao-da-filha`: "a palavra vem depois do modelo no texto do cartão" |
| `cabecalho.limite-de-linhas-do-desenho` | `regras/cabecalho.md:99` | "o teste lê o texto das linhas no lugar do `alt` de cada imagem, e o cenário usa títulos mais longos, porque a linha nativa pesa menos; a regra não muda" |

`visual.golden-gera-desenho`, `visual.desenho-subagente`, `visual.faixa-de-estado-geral`,
`visual.titulo-sem-contagem-vai-ate-o-tempo`, `taxa.fim-do-turno-fica-aceso` e as quatro de
`ultracode` não têm nenhum `Reescrito:` hoje: sem a linha, o `--tipo decisao` é recusado.

### 5.2 Cenários `checklist` cujo texto cita o SVG (texto livre, sem selo; mudar quando o desenho mudar)

- `visual.largura-real` (`visual.md:7-15`): "o desenho termina na borda real da imagem" → "as linhas
  terminam na borda real do painel, com o texto cortado pelo app ('…'), em qualquer largura".
- `visual.cliques-no-icone-e-no-anel` (17-25): fica `checklist` (o alvo real do clique); o texto
  ganha "o botão sobre o ícone e sobre o anel". Se o teste novo dos botões entrar, cenário novo
  `visual.botoes-por-chave` (`coberto`): "Dado uma linha com algo embaixo e um cartão com anel;
  Quando o painel é desenhado no app; Então a linha tem o botão `fold:<chave>` e o cartão o botão
  `open:<sessão>`, e apertá-los recolhe a linha e pede a sessão ao app". Origem: os dois pedidos já
  citados em `render.tsx:57-69`.
- `visual.cores-dos-temas` (60-68): "os textos e fundos usam as cores do tema do app; os `Svg` que
  restam levam as suas, claro e escuro".
- `visual.cabecalho-em-cartao` (70-81): tirar "(16 px)" e "116 px": "título no tamanho de título do
  app, faixa de estado em fundo de `Box`"; `Reescrito: 2026-11-13` (diferença visual aceita:
  "Vai para nativo").
- `visual.cartao-modelo-e-esforco` (93-101) e `visual.cartao-posicao-de-toks-e-repo` (103-111):
  "posição na imagem" → "posição na linha". Com o nativo, a ordem dos pedaços da linha do cartão é
  legível no harness (`pedacos`); podem virar `coberto` com um teste de ordem, se sobrar fôlego. Não
  é necessário para o check.
- `visual.cabecalho-barra-e-chips-desenhados` (133-143): cita `o tooltip "sessão inteira"`, que não
  existe desde 2026-11-09: "a barra de progresso (o `Svg` que resta), as pílulas e, no texto
  alternativo, a sessão inteira".
- `visual.secao-sem-traco` (218-227): só o `Código:`.
- Texto velho, sem relação com teste: `cabecalho.md:81` ("a sessão inteira, só no tooltip") e
  `sessoes.md:225` ("o texto digitado no tooltip") → "no texto alternativo". Ver o item da seção 7
  sobre o que hoje só existe no `alt`.

### 5.3 Mapa de código (`Código da área:` e `Código:`)

`scripts/regras.mjs:53-55` **falha o check com caminho inexistente**. `draw/svg.ts` aparece em 20
linhas e `draw/geometry.ts` em uma; no commit que apagar ou renomear um deles, todas mudam junto:

- `draw/geometry.ts`: `regras/visual.md:5`.
- `draw/svg.ts`: `cabecalho.md:5,144`; `envios.md:42,58,108,133,166,177`; `sessoes.md:174,185,196`;
  `subagentes.md:68`; `ultracode.md:5`; `visual.md:5,215,226`. (`regras/README.md:99` é exemplo e não
  é lido pelo script; atualize por coerência.)

O que cada citação protege, para apontar ao arquivo certo se o desenho for repartido:

| Citação | O que do `svg.ts` de hoje ela usa |
|---|---|
| `cabecalho.md:5` (área) | `chips`, `headerState`, `percent`, `ratioBar`, `headerSvg` |
| `cabecalho.md:144` | o ▸/▾ da linha de seção |
| `envios.md` (6 linhas) | `envelope`, `MSG_CLASS`, `MSG_TERM`, `GLYPH.sent` |
| `sessoes.md:174` | `sessionIcon`, o busto (`GLYPH.running`) |
| `sessoes.md:185,196` | `gitSvg`, `gitTerm`, `gitAlt`, `folderIcon`, `rateText` |
| `subagentes.md:68` | `chips` (a pílula de subagentes) |
| `ultracode.md:5` (área) | `ULTRA`, `rowAlt`, `labelSvg`, `headerSvg` |
| `visual.md:5` (área) | tudo do desktop |

Recomendação para não mexer no mapa a cada etapa: **`draw/svg.ts` continua existindo com esse nome
até a última etapa** (vai encolhendo: ficam os `Svg` de ícone, anel e barra e os textos comuns ao
terminal). Arquivo novo do desenho nativo entra em `visual.md:5` no commit que o cria (sem isso a
etapa `regras` só avisa "fora do mapa", não falha) e em `ultracode.md:5`. Na última etapa, um commit
só troca o mapa inteiro. `taxa.fim-do-turno-fica-aceso` ganha `Código: <arquivo do cabeçalho do app>`
(o teste dele lê o cabeçalho do desktop e a área de `taxa.md` não cita desenho).

`NUCLEO` (`scripts/regras.mjs:22`) não muda: se `drawDesktop` sair de `hooks/render.tsx` para um
arquivo de `draw/`, esse arquivo não é núcleo (não afeta os testes do terminal); fica na área de
`visual.md`. `scripts/impacto.mjs` não precisa de mudança de código. Saída de hoje, para o brief:
`node scripts/impacto.mjs -- draw/svg.ts draw/geometry.ts` → 48 cenários (15 de checklist), golden
`visual.desenho-*`, nada fora do mapa; com `hooks/render.tsx`, o núcleo: 148 cenários cobertos e os
19 de checklist.

## 6. `CLAUDE.md`, CI e `DESENVOLVIMENTO.md`

### 6.1 `CLAUDE.md`

- "Como testamos" (linhas 19-29). Linha 24-25: "…e a leitura do painel em comportamento: título e
  estado de cada linha pela superfície terminal, e o desenho do app desktop pelo texto de cada linha
  e do cabeçalho (o que mostram e o texto alternativo dos `Svg`), pelos botões (por `key`) e pelas
  props." Linha 26-28: "não verifica a pintura (largura real, corte do texto, cor pintada, alvo do
  clique)": o harness passa a ver a chave de cor e o botão, não a pintura.
- "CI" (111-121), linha 114: `hoje 2.1.321`.
- "Golden do SVG" (123-137) → "Golden do desenho": "O desenho do app desktop em 4 cenários
  (principal, filha trabalhando, envios, subagente; 60 colunas), a árvore de `Box`, `Text` e `Button`
  normalizada e os `Svg` que restam (ícones de estado, anel de contexto, barra do cabeçalho), fica
  travado em `task-tree/tests/golden/desenho.ts`…". Linha 129: "Ele não olha a árvore nem página."
  Linha 133: `desenho.ts`. Acrescentar: "Na migração para o nativo (2026-11-13) o golden foi
  regravado pela sessão de migração, por decisão do usuário ('Validar só no fim'); a validação dele
  no app regravou o selo com as palavras dele." (a segunda metade, só depois de acontecer).
- "Travas contra regressão": acrescentar os fatos 1 a 4 da seção 1 em duas linhas ("teste que falha
  contra o código novo é reescrito sob o mesmo nome, com selo de decisão do dia; mudar só o kit não o
  libera").
- "Checklist do app" (154-161), lista nova:
  - largura real: o texto de cada linha cortado com "…" pelo app na borda, o título indo até o tempo,
    ao estreitar e alargar o painel, nos dois temas;
  - fonte e tamanhos do app: guias em caracteres de caixa alinhadas e contínuas de uma linha para a
    outra, ícone, título, contagem e tempo na mesma linha de base;
  - cores do tema: trocar o tema com o painel aberto (textos e fundos acompanham; ícones, anel e
    barra, que são imagem, também);
  - cabeçalho: faixa de estado na cor certa, barra de progresso, pílulas e bloco de números;
  - cartões de sessão e de subagente: moldura, aninhamento, busto, ✉, anel;
  - cliques no ícone e no anel (alvo e realce do botão nativo); nenhum tooltip nem cartão ao passar o
    mouse; linha nova sem animação; nada pisca com o relógio de 1 s;
  - sessão longa: o painel segue aparecendo (o tamanho do desenho no `/task-tree`);
  - recarga a quente real; sessões filhas reais; avisos do app; modelo e esforço no cartão; status
    embaixo da caixa de mensagem (como hoje).

### 6.2 CI (`.github/workflows/test.yml`)

- Linha 25: `CLAUDE_CODE_VERSION: 2.1.308` → `2.1.321`. O app desta máquina roda a 2.1.321 (é a
  única em `%APPDATA%\Claude\claude-code\`), os tipos da worktree são dela, e o `CLAUDE.md:114` manda
  subir junto com o app: a CI já está atrás. As duas versões existem no npm (`npm view
  @anthropic-ai/claude-code@2.1.321 version` e `@2.1.308` respondem; `latest` é 2.1.323).
- **O kit 2.1.308 tem o que o desenho nativo precisa? Não foi possível conferir**: só a 2.1.321 está
  instalada, e os tipos são escritos pelo binário ao carregar o mod (não vêm no pacote). O risco é
  concreto: o `mount` do harness rejeita a árvore com prop que a tabela daquela versão não tem
  (seção 1), então uma prop mais nova (`mono`, `tabular`, `size`, `wrap: 'truncate-end'`, `hover`)
  faria falhar todo teste que monta o desktop. Não há motivo para sustentar a 2.1.308: subir a
  versão, no mesmo PR.
- A CI segue desligada (`workflow_dispatch`) e informativa; nada mais muda no arquivo. O passo
  "npm run check -- --base" depende do fato 4 da seção 1.

### 6.3 `task-tree/DESENVOLVIMENTO.md`

Reescrever (o arquivo descreve "como é hoje" e depois o histórico por data):

- "Módulos", linhas 47-49 (`render.tsx`), 70-71 (`geometry.ts`) e 72-74 (`svg.ts`): os arquivos de
  desenho como ficarem.
- "Desenho", linhas 370-375 (`fit`, `slim`): saem, com uma nota de que eram do SVG por linha; linha
  578 (**Cabeçalho V4**, em px) e 579-584 (**Desktop**): o desenho nativo (o que é `Box`/`Text`, os
  três `Svg` que restam, onde ficam os botões, as chaves `head`, `r<i>`, `fold:`, `open:`); 587-598
  (limite de 600 KB): acrescentar que a linha nativa pesa bem menos e quantas linhas cabem agora
  (medir); 599 (`ui.press`): tirar `view:<summary|full>`, que não existe desde 2026-11-04.
- "Desempenho (fase 6, parte A)", 602-623: as linhas `fit`, `slim` e `rowSvg` da tabela ficam como
  histórico, marcadas "código removido em 2026-11".
- "Limites do kit", 629-646, itens novos: `Button` só aceita strings e `Text` como filhos; `Svg`
  é folha, com até 131072 caracteres e `alt` obrigatório; deslocamentos de `Box` em células inteiras;
  o que a sonda disser sobre `key` em `Text`; o `mount` do harness valida as props do desktop.
- "O que só é verificável no app", 648-664: linha 654-656 (cliques: "a regra de não-sobreposição
  fala em células") conforme o desenho; 657 ("Se a linha pisca a cada segundo") continua; 663
  (tamanho real).
- "Pendências", 1572-1577: "(lá as linhas são `Svg` em pixels)" deixa de valer.
- Seção nova no fim, no padrão das datadas (1579 em diante): `## Desenho nativo híbrido (2026-11-13)`,
  com o pedido nas palavras do usuário, as decisões do brief, o que ficou em `Svg` e por quê, as
  diferenças visuais aceitas, a divergência do `Button` com filhos, e o que mudou nos acessórios
  (kit, golden, selos). "Decisões (histórico) > Desenho do painel" (918 em diante) fica como está:
  é histórico.
- `regras/README.md`: linha 56-57 (lista de asserções, se `ASSERCOES` mudar), 99 (exemplo com
  `draw/svg.ts`), 109 (sem mudança).

## 7. O que este plano exige do desenho nativo (conferir contra o plano do desenho)

1. A raiz do desktop continua uma coluna com `Box key="head"` (o cabeçalho) e um `Box key="r<i>"` por
   `Row`, na ordem (`render.tsx:94,98` já são assim). O kit acha as regiões por essas chaves.
2. Os botões mantêm as chaves `fold:<chave>` e `open:<id da sessão>` (`render.tsx:81,85`), e `back`
   no aviso (`:392`).
3. A árvore do terminal não muda em nada.
4. **O que hoje só existe no `alt` precisa de destino**, porque a linha nativa não tem `alt`:
   - cabeçalho (`render.tsx:312-322`): "estado geral: <palavra>" e "; sessão inteira: a de b" não são
     desenhados em lugar nenhum; o toks/s, a palavra "ultracode" e os textos inteiros das pílulas
     somem do SVG em painel estreito (`headerSvg`: `narrow`, `wide`) e ficam só no `alt`. Recomendo
     que **o `Svg` da barra do cabeçalho leve o `alt` inteiro de hoje**, sem mudança: preserva o texto
     para leitor de tela e garante, a 60 colunas (a largura do harness), tudo o que os testes leem
     (`100 toks/s`, `ultracode`, `1 em andamento`, `estado geral: …`). Com o painel vazio não há
     barra: o texto "Nenhuma tarefa planejada" basta.
   - linha (`rowAlt`, `svg.ts:721-734`): `r.hint` ("Mensagem de X: …", "Pedido do usuário na filha:
     …"), "com sessão filha", "recolhida", "(último turno)" e "contexto da sessão X: N%". Recomendo o
     `alt` do ícone de estado da linha igual a `rowAlt(r)`, e o do anel "contexto da sessão X: N%".
     Linha sem ícone (seção, "+N linhas") não tem `alt`: o texto dela basta.
5. O texto da linha vai inteiro ao `Text` (título, modelo, repositório), para o app cortar. Se o mod
   deixar de emitir um texto por falta de colunas (como o SVG faz com o modelo), ele precisa estar no
   `alt` (item 4), ou os testes de `ultracode` falham a 60 colunas.
6. Em cada linha, o título é um pedaço de texto próprio (um `Text` só com o título), o tempo outro
   (`0:00`), a contagem outro (`1/2`): os três testes de geometria da seção 2.4 leem a ordem deles.
7. Nenhum elemento com `hover` nem `display: 'none'` (sem tooltip, decisão do usuário).

## 8. Ordem: o que vai no mesmo commit e o que pode ir em paralelo

### 8.1 Etapa de preparação (um commit, antes de qualquer mudança no desenho)

Tudo junto, porque `selos.json`, o catálogo e os testes se conferem entre si:

1. `tests/kit/leitura.ts` (3.1; `svgs()` fica) e, se entrarem, `tests/kit/ambiente.ts` (3.3).
2. `tests/taxa.test.ts`, `tests/ultracode.test.ts`, `tests/cabecalho.test.ts` (os 3 testes e os
   helpers 260-295), `tests/visual.test.ts` (os 2 da faixa e o do tooltip; os 3 de geometria
   intocados), `tests/golden.test.ts`; o teste novo dos botões, se entrar.
3. `tests/golden/svg.ts` → `tests/golden/desenho.ts`; `scripts/selos.mjs:138-139`;
   `scripts/travas.test.mjs:196,200,202`.
4. `regras/visual.md`, `regras/taxa.md`, `regras/ultracode.md`, `regras/cabecalho.md` (os
   `Reescrito:` de 5.1, menos o de `visual.titulo-sem-contagem-vai-ate-o-tempo`, que vai com o teste).
5. Selos: `--kit` de cada arquivo do kit mudado; `--selar … --tipo decisao` dos 15 testes (4 do
   golden, 2 da faixa, 1 do tooltip, 1 da taxa, 4 do ultracode, 3 do cabeçalho); `--tipo novo` do
   teste novo; `golden:aprovar --todos` por último (depois de os testes estarem na forma final).
6. `npm run check`. Esperado: `regressao` com 0 falhas (o código do mod não mudou; os testes de
   `HEAD` rodam contra o mesmo código).

Relato: `npm run testes:alterados` lista os 15 com o corpo antes e depois.

### 8.2 Em cada etapa do desenho (um commit por etapa, em série, na worktree de integração)

No mesmo commit do código:

- `tests/golden/desenho.ts` e as entradas `golden` de `regras/selos.json` (`--aprovar --todos`);
- os testes de geometria da seção 2.4 cuja linha virou nativa naquela etapa, com o `Reescrito:` em
  `visual.titulo-sem-contagem-vai-ate-o-tempo` (uma vez) e o selo `decisao` de cada um; no commit do
  último deles, `svgs()` sai do kit (selo do kit);
- o mapa de código do catálogo, se a etapa criar ou apagar arquivo do mod (5.3);
- os textos dos cenários `checklist` que a etapa tornou falsos (5.2).

Depois do código e antes do commit: `npm run check`; se a `regressao` acusar um teste além do golden
e dos três de geometria, o contrato da seção 7 foi quebrado: **corrige-se o desenho, não o teste**
(é exatamente o caso que a trava protege). Se for um dos três do cabeçalho por tamanho, é o peso da
linha: aumentar a repetição do título (2.3).

O hook de pré-commit confere o índice: tudo o que a etapa precisa tem de estar no `git add` (teste,
kit, golden, selos, catálogo), senão o hook falha num arquivo que está certo na pasta.

### 8.3 Última etapa (retirada do desenho antigo)

Código que só o SVG por linha usava sai; o desenho não muda, então o golden de `HEAD` passa sem nova
aprovação. No mesmo commit: o mapa de código inteiro (5.3) se `svg.ts`/`geometry.ts` sumirem ou
mudarem de nome, e `regras/README.md:99`.

### 8.4 O que pode ir em paralelo, sem conflito de arquivos

Regra: quem escreve `regras/selos.json`, `regras/*.md`, `task-tree/tests/**` ou `scripts/selos.mjs`
trabalha em série na worktree de integração (o `selos.json` é reescrito inteiro e ordenado a cada
selo; dois ramos nele conflitam sempre). Fora disso, em outra worktree da mesma branch:

| Trabalho | Arquivos (só estes) | Entra |
|---|---|---|
| Documentação | `CLAUDE.md`, `task-tree/DESENVOLVIMENTO.md`, `regras/README.md` | por último, depois da retirada do desenho antigo (descreve o estado final); as etapas não tocam esses três arquivos |
| CI | `.github/workflows/test.yml:25` (e a linha 114 do `CLAUDE.md`, no commit da documentação) | a qualquer momento |
| Página do golden | `scripts/golden.mjs` (comentários e `--pagina`) | depois da preparação (precisa do formato novo); a preparação não toca esse arquivo. Muda `scripts/`: o hook roda as `travas` |

Os commits de documentação e de CI não mexem em `task-tree/`: no hook, `validate` e `tsc` são
pulados, a `regressao` não tem o que comparar, e `regras`, `selos` e `plugin test` rodam.

### 8.5 Fechamento

- `npm run check -- --base origin/main` na ponta da branch (o que a CI rodaria): os 18 testes do
  `main` falham contra o código final e passam pelos selos `decisao` e pelo golden. É a prova do
  fato 4 da seção 1.
- `npm run testes:alterados -- --pr` e `npm run impacto -- --base origin/main` no relato.
- Depois da validação do usuário no app: re-aprovar o golden com as palavras dele (4.4).

## 9. Armadilhas

- Nomes de teste com aspas no `npm run … -- "<chave>"` do Windows: usar `node scripts/selos.mjs` no
  Git Bash com aspas simples.
- Virou o dia entre selar e commitar: selar e aprovar de novo (fato 3).
- `noUnusedLocals`: import que sobrar num teste (`svgs`, `PROPS`, `AGORA`) bloqueia o `tsc`.
- O teste `a palavra digitada num prompt…` e qualquer `not.toContain` sobre `svgs()[0].alt` passam à
  toa no nativo. Depois da preparação, nenhum teste deve ler `svgs()[0]`.
- `ASSERCOES` conta só chamadas no corpo do teste (`selos.mjs:63-68`): os testes de golden têm 0
  asserções contadas, e continuam com 0.
- Os testes do corte por tamanho montam 393 linhas com títulos de 1,7 KB: o arquivo publicado e o
  store crescem; se algum estourar os 15 s com a máquina carregada, rodar de novo antes de concluir
  que quebrou, e só então reduzir a repetição.
- `docs/task-tree-proposta-visual.svg` é demonstrativo e não entra em nada disto.

## 10. Não verificado

- Nada foi executado no harness: se a `key` de um `Text` chega ao `drawn()`, o peso real de uma
  linha nativa e se os testes reescritos passam no desenho de hoje são hipóteses de leitura.
- A tabela de elementos do kit 2.1.308 (seção 6.2).
- Como o plano do desenho divide as etapas e os arquivos: as seções 5.3, 7 e 8.2 estão escritas por
  gatilho ("no commit em que a linha X vira nativa", "no commit que apaga o arquivo Y") para valer
  com qualquer divisão.
