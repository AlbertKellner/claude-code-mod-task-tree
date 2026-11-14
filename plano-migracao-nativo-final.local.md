# Plano final da migração para o híbrido nativo (crítica e fusão dos dois planos)

Escrito em 2026-11-13 pelo agente crítico, só por leitura da worktree
`<repo>-wt\integra` (branch
`feat/painel-nativo`, base `b7d2a50`, árvore limpa). Nada foi editado nem executado lá além de `git`,
`grep` e `node scripts/impacto.mjs`. Tipos conferidos: kit 2.1.321
(`task-tree/.claude-plugin/types/claude-code/index.d.ts`).

Fontes fundidas (continuam valendo no que este arquivo não corrige):

- **[D]** `plano-migracao-nativo-desenho.local.md`: o JSX de cada elemento (seções 3, 4 e 5), as keys
  (6), o que morre (8), os riscos do app (10).
- **[A]** `plano-migracao-nativo-acessorios.local.md`: as travas (1), os 18 testes (2), o kit (3), o
  golden (4), o catálogo (5), docs e CI (6), o contrato com o desenho (7).

Onde este arquivo diverge de [D] ou [A], vale este. A seção 1 lista as correções; a 2, os contratos; a
3, as etapas; a 4, o paralelismo; a 5, as armadilhas.

Pedido do usuário (2026-11-13): "migrar todo o Mod para o hibrido de nativo e mantendo somente o que
for obrigatório em SVG"; "Adeque tambem toda a validação e assessórios que temos para funcionar com
esse novo paradigma"; "Realize a migração em etapas... migre, teste, faça commit local e somente
depois va pra proxima etapa".

Matriz de impacto (rodada agora):
`node scripts/impacto.mjs -- task-tree/hooks/render.tsx task-tree/draw/svg.ts task-tree/draw/geometry.ts task-tree/draw/layout.ts`
→ núcleo tocado (`hooks/render.tsx`), 166 cenários, os 19 de checklist, golden `visual.desenho-*`
(os quatro), nada fora do mapa.

## 1. Correções feitas aos dois planos

### 1.1 Conflitos entre os planos

1. **Quem reescreve os testes, e quando.** [D] punha kit, testes, golden e selos na etapa 1, "em
   paralelo" com o código. [A] mostra que isso não fecha: `regras/selos.json` é regravado inteiro a
   cada selo, o golden só pode ser aprovado com o código final da etapa, e teste de `HEAD` que falha
   só passa com selo `decisao` do dia e hash novo (`scripts/selos.mjs:169-171`,
   `scripts/regressao.mjs:83-96`). Fica a **etapa 0 de preparação** de [A], antes de qualquer
   mudança no desenho, e um só escritor para `task-tree/tests/**`, `regras/**` e `scripts/selos.mjs`.
2. **Os três testes de 600 KB** (`tests/cabecalho.test.ts:297-355`): [D] os reescrevia na etapa 1;
   [A], na preparação. Fica na etapa 0, com reajuste do peso (e novo selo `decisao`) na etapa em que
   a medida mostrar que precisa.
3. **Peso da linha nativa.** [A] supôs "algumas centenas de bytes" e por isso pediu título de 1.700
   caracteres; [D] estimou 1,2 a 2 KB. Pelo JSX de [D] 4.2/4.3, [D] está certo: a linha leva o `Svg`
   do ícone (≈0,4 KB de fonte), dois `Box` absolutos com sete props cada, e o título **duas vezes**
   (no `Text` e no `alt` = `rowAlt(r)`). Com isso basta um título de ≈830 caracteres (seção 3,
   etapa 0, item 4); 1.700 dobraria o plano publicado (670 KB) sem necessidade e arrisca os 15 s.
4. **Faixa do cabeçalho nos testes.** [D] reescrevia os dois testes da faixa na etapa 3; [A], na
   preparação, pela palavra "estado geral: …". Fica [A]; na etapa 3 a cor da faixa entra como
   asserção a mais, opcional.
5. **Documentação "não mexe em `task-tree/`"** ([A] 8.4): errado para `task-tree/DESENVOLVIMENTO.md`.
   O commit de documentação muda `task-tree/`, então o hook roda `validate`, `tsc` e `regressao`
   (`scripts/mudou.mjs`). Passa, mas demora como um commit de código.

### 1.2 Erros que quebrariam o check ou mudariam comportamento

6. **`estadoGeral` de [A] 3.1 quebra na etapa 3.** A regex `/estado geral: ([^,;]+)/` sobre o texto
   inteiro do cabeçalho funciona enquanto o cabeçalho é um `Svg` só. Com o cabeçalho nativo, depois
   do `alt` da barra vêm os `alt` e os textos das pílulas ("1 em andamento"), e a captura vira
   "em andamento 1 em andamento…". **Correção:** a regex roda no pedaço (um `alt` ou um texto) que
   contém "estado geral:", não no texto juntado (seção 2.2).
7. **`linhaDoApp` (única, senão erro) nos testes existentes.** Os testes de hoje pegam a *primeira*
   linha que contém o texto (`ultracode.test.ts:20,90`, `cabecalho.test.ts:273`). No nativo o título
   aparece no `alt` e no `Text`, e pode haver outra linha com o nome (✉ "Para filha-um"). Trocar por
   "única" pode lançar à toa. **Correção:** os 15 testes reescritos usam "a primeira que contém"
   (`d.linhas.find(...)`, helper `primeiraDoApp`); `linhaDoApp` (única) fica para os testes novos.
8. **`$` e as ações dos cliques.** [D] criava `acts` dentro de `paint` (arrow dentro de `render`).
   O limite 3 do kit (`DESENVOLVIMENTO.md:629-646`) pede `$` em função de topo. **Correção:**
   `drawDesktop($, ui, …)` continua função de topo de `hooks/render.tsx` (como hoje, linha 72), cria
   `acts` ali (`pressOf($, r)`, `openSession($, …)`) e chama `desktopTree(ui, lines, acts, cols)`.
   Os arquivos de `draw/` nunca recebem `$`.
9. **A regra de cursor do `slim`.** [D] mandava tirá-la "na etapa 3, para não regravar o golden na
   4". Mas os ícones nascem na etapa 1 passando por `slim` (`draw/svg.ts:109`), então levariam a
   regra `svg,text{cursor:default;user-select:none}` (41 caracteres × até 400 linhas) e mudariam de
   novo depois. **Correção:** na etapa 1, `slim(svg, base = 'svg,text{cursor:default;user-select:none}')`
   com a chave do cache `base + classes`; `draw/icons.ts` chama `slim(x, '')`. `rowSvg`/`headerSvg`
   seguem com o padrão até morrerem. Na etapa 4 o parâmetro some e **nenhum byte do desenho muda**
   (a `regressao` da etapa 4 passa sem aprovar golden).
10. **Mapa de código com caminho que ainda não existe.** [D] deixa escrever `draw/head.tsx` desde a
    etapa 1. `scripts/regras.mjs:53-55` **falha** com caminho inexistente: o arquivo só entra num
    `Código da área:` no commit que o cria (etapa 3), e `draw/geometry.ts` sai de `regras/visual.md:5`
    no commit que o apaga (etapa 4). Arquivo novo fora do mapa só avisa.
11. **`Reescrito: 2026-11-13` e a virada do dia.** `exigirReescrito` (`selos.mjs:207-210,256`) pede um
    `Reescrito:` com data ≥ a do **selo anterior**. Um teste selado na etapa 0 e selado de novo num
    dia posterior (reajuste do peso, asserção a mais) é recusado se o cenário só tiver
    `Reescrito: 2026-11-13`. **Correção:** a data do `Reescrito:` é a do dia em que o cenário é
    reescrito; passando da meia-noite, a linha nova é
    `Reescrito: 2026-11-14, decisão do usuário de 2026-11-13 ("migrar todo o Mod…")`.
12. **`rgba(…,.25)`** em [D] 4.3/4.9: o app só aceita cor crua "com números"; escreva `0.25`, `0.5`,
    `0.13` (com o zero).

### 1.3 Afirmações sobre tipos, conferidas no `index.d.ts`

13. Todas as props que [D] usa existem no tipo: `Box` (`:928-1041`): `key`, `position`, `top/left/
    right/bottom` (inteiros, em células), `flexDirection`, `flexGrow`, `flexShrink`, `alignItems`,
    `justifyContent`, `gap/columnGap`, `width/height/minWidth/minHeight` (`number | string`),
    `margin*`, `padding*`, `borderStyle`, `borderColor`, `borderDimColor`, `backgroundColor`,
    `overflow`, `display`. `Text` (`:13871-13940`): `color`, `dimColor`, `size`, `weight`, `mono`,
    `tabular`, `wrap` (com `'truncate-end'`). `Svg` (`:13576-13608`): `source`, `alt` (obrigatório),
    `width`, `height` (números). `Button` (`:1093-1195`): `key`, `label`, `plain` (tipo `true`),
    `dimColor`, `onPress`; filhos só texto e `Text` (`:1108-1110`).
14. Não está no tipo, só no bundle lido por [D] (**suspeita até a sonda**): altura fracionária
    (`height={0.2}`), `width="40%"`, as chaves `effortUltra` e `userMessageBackground` (o tipo
    `Color`, `:1727`, aceita qualquer texto; o que o harness faz com chave desconhecida não está
    escrito), `Text` com `\n`, "o pai de `Box` absoluto ganha `position:relative` sozinho".
    **Correção:** a célula do ícone leva `position="relative"` explícito (como `render.tsx:107` hoje),
    e a etapa S (sonda) decide o resto antes de escrever código.
15. `Text` não tem `key` em `TextProps`; o JSX aceita (`IntrinsicAttributes`, `:16484-16486`) e o
    terminal já escreve `<Text key="title">`. O kit novo não depende de `key` em `Text` ([A] certo).
16. "20.000 nós, 32 níveis, 100.000 caracteres" (`:1450-1451`) está na descrição de `ClientElements`
    ("keeps every tree's bounds"). Os 100.000 caracteres comprovadamente não valem para o `Pane`
    (hoje vão 600 KB). Nós e profundidade: suspeita, não regra. O kit expõe `nos` e `fundo` para
    medir; a asserção fica opcional (etapa 2, item 6).
17. O harness: `mount` valida a árvore pela tabela da superfície e rejeita com o motivo
    (`:16786-16790`); `drawn()` devolve `{ type, props (com key), hover?, part?, group?, children }`
    e, no `Button`, `press: { plugin, handle }` (`:10255-10342`, `:13508-13533`). [A] 4.1 está certo
    em tirar `press`, `part` e `group` do golden.

### 1.4 Lacunas preenchidas

18. **Sonda antes de tudo** (etapa S): [D] a punha "antes de escrever as linhas", dentro da etapa 1,
    na worktree de integração. Vai para uma worktree descartável, antes da etapa 0, porque dois
    resultados dela mudam a etapa 0 (se a `key` de `Text` chega ao `drawn()`, o peso por linha).
19. **Teste das keys de clique no desktop.** Hoje nenhum teste aperta `fold:`/`open:` no desktop; a
    migração troca justamente a sobreposição. O teste novo de [A] 2.6 deixa de ser "sugerido": entra
    na etapa 0 (passa no desenho de hoje) e protege as keys em todas as etapas.
20. **O anel no golden.** `visual.desenho-cartao-filha` diz "e anel", mas o cenário não publica
    `context` (0 ocorrências de "contexto da sessão" no golden). Entra `contexto: 42` na etapa 0.
21. **`golden:pagina`** quebra com o formato novo (`scripts/golden.mjs:64`, `lista.map`): conserto em
    commit próprio (faixa paralela), logo depois da etapa 0.
22. **Coluna do rótulo de sessão.** [D] esconde a coluna (as tarefas do cartão alinham com o busto,
    como no terminal); hoje o desktop a deixa vazia. Coberto pela decisão "guias como no terminal";
    é diferença visual e vai ao relatório final.
23. **Colisão de nomes no hash do selo.** O hash de um teste inclui as declarações de topo cujos
    nomes aparecem no corpo, **como qualquer identificador, inclusive propriedade**
    (`selos.mjs:63-70`). Uma constante de topo nova chamada `d`, `texto` ou `linhas` muda o hash de
    testes que não foram tocados. Depois de editar um arquivo de teste, rode `node scripts/selos.mjs`
    e confira que só os testes esperados aparecem em "mudou sem selo novo".

## 2. Contratos entre o desenho e os acessórios (valem em todas as etapas)

### 2.1 O que o desenho do desktop garante

1. Raiz: `<Box flexDirection="column">` com, na ordem: a linha de erro (`Text key="error"`, se
   houver), `Box key="head"`, depois as linhas. Cada `Row` de `lines[i]` é um `Box key={`r${i}`}`,
   em ordem de documento, em qualquer profundidade (dentro de `Box key={`c${i}`}` de cartão).
2. Botões: `fold:<Row.fold.key>` (ícone de progresso, busto do rótulo, ▸/▾ da seção),
   `open:<sid>` (anel, só com `r.session && r.sid && r.ring`), `back` (desenho de emergência).
   Sempre dentro do `Box r<i>` da linha. Rótulo do botão sobre ícone e anel: `'\u2003'`.
3. O `alt` do ícone de estado (ou busto, ou ✉) da linha é `rowAlt(r)` inteiro (`draw/svg.ts:721-734`).
   O do anel: `contexto da sessão <nome>: <N>%`. Linha de seção não tem ícone nem `alt`.
4. O `alt` do cabeçalho inteiro (o texto de `render.tsx:312-322`, sem mudar uma letra) vai no
   primeiro `Svg` dentro de `Box key="head"`: até a etapa 2, o `Svg` do cabeçalho; da etapa 3 em
   diante, a barra de progresso. Painel vazio: sem barra; basta o texto "Nenhuma tarefa planejada.".
5. Em cada linha, o título é um `Text` cujo único filho é `r.title` exato (sem espaço na frente, sem
   o " ⋯"), com `wrap="truncate-end"`; o tempo é um `Text` próprio (`0:00`); na linha com colunas, a
   contagem é um `Text` próprio (`1/2`). O que vem à direita do título vem depois dele no documento.
6. Nenhum elemento com `hover` nem `display: 'none'`; nenhum `Svg` com `isInteractive`; nenhum
   `<title>` em fonte de `Svg`.
7. A árvore do terminal (`drawTerminal`, `render.tsx:123-185`, e o cabeçalho de `:328-353`) não muda
   um byte: 212 testes de `HEAD` dependem dela na `regressao`.

### 2.2 O kit de leitura (`task-tree/tests/kit/leitura.ts`, depois da linha 103)

API de [A] 3.1, com as correções 6 e 7 e dois campos de medida:

```ts
export type Pedaco = { tipo: 'texto' | 'svg' | 'botao'; texto: string; key?: string; props: Record<string, unknown> }
export type LinhaDoApp = { key: string; texto: string; pedacos: Pedaco[]; botoes: string[]; el: any }
export type DesenhoDoApp = {
  raiz: any; bytes: number; nos: number; fundo: number; aviso: boolean
  cabecalho: LinhaDoApp; linhas: LinhaDoApp[]; textos: string[]; svgs: DesenhoSvg[]; revelados: number
}
export async function noApp($: any, opcoes: { colunas?: number } = {}): Promise<DesenhoDoApp>
export async function montarNoApp($: any, opcoes?: { colunas?: number }): Promise<{ desenho(): Promise<DesenhoDoApp>; apertar(key: string): Promise<void>; fim(): Promise<void> }>
export const primeiraDoApp = (d: DesenhoDoApp, quem: string | RegExp): LinhaDoApp | undefined   // a primeira cujo texto contém
export function linhaDoApp(d: DesenhoDoApp, quem: string | RegExp): LinhaDoApp                  // a única; senão erro com emTextoDoApp(d)
export const pedacosDepois = (l: LinhaDoApp, quem: string | RegExp): Pedaco[]                   // depois do 1º pedaço de texto igual (ou que casa)
export const estadoGeral = (d: DesenhoDoApp): string | undefined                                // por pedaço, ver abaixo
export const emTextoDoApp = (d: DesenhoDoApp) => [d.cabecalho.texto, ...d.textos].join('\n')
export function arvoreDoApp(raiz: any): { arvore: unknown; svgs: string[] }                     // [A] 4.1, como está
export async function desenhoDoApp($: any): Promise<{ arvore: unknown; svgs: string[] }>        // monta a 60 colunas
```

Regras de leitura (uma função recursiva, ordem de documento):

- string com `/\S/` → `{ tipo: 'texto', texto: a string crua, props: as do Text que a contém }`
  (`String.prototype.trim` e `\s` cobrem o U+2003);
- `Svg` → `{ tipo: 'svg', texto: props.alt, props }`;
- `Button` → a `key` (`el.key ?? el.props?.key`) entra em `botoes`; com `label` não vazio depois de
  aparado e sem filhos, `{ tipo: 'botao', texto: label }`; com filhos, os pedaços deles;
- `texto` de uma região: os pedaços juntados com espaço, `replace(/\s+/g, ' ').trim()`;
- `cabecalho`: o primeiro `Box` de key `head` (texto `''` se não houver); `linhas`: todo `Box` de
  key `/^r\d+$/`, **em qualquer profundidade**, sem descer dentro de um já achado;
- `estadoGeral`: `d.cabecalho.pedacos.map(p => /estado geral: ([^,;]+)/.exec(p.texto)?.[1]).find(Boolean)?.trim()`;
- `nos`: elementos mais strings; `fundo`: a maior profundidade; `bytes`: `JSON.stringify(raiz).length`;
- `revelados`: elementos com `hover` (em `el.hover` ou `el.props.hover`) ou `props.display === 'none'`.

`svgs()` e `DesenhoSvg` ficam até a etapa 2 (os dois testes de geometria de cartão ainda os usam).
Nenhuma constante só para documentar o que fica de fora (`noUnusedLocals`).

### 2.3 Arquitetura do desenho ([D] seção 2, com a correção 8)

    hooks/render.tsx             lê o estado, layout(), monta o Head, limite de tamanho; drawDesktop($, …) cria acts
      draw/icons.ts    (novo)    stateIcon, msgIcon, bustIcon, ringIcon, headBar: fontes de Svg, puras, lembradas em Map
      draw/desktop.tsx (novo)    cells, iconCell, desktopRow, desktopTree
      draw/head.tsx    (novo)    desktopHead
      draw/svg.ts                encolhe: textos comuns ao terminal, alts, primitivas de ícone (não é renomeado)

Assinaturas: as de [D] seção 2. Se a sonda mostrar que `validate` recusa JSX fora de `hooks/`, os
dois `.tsx` viram `hooks/desktop.tsx` e `hooks/head.tsx` (o mapa de código usa esses nomes).

## 3. Etapas

Comandos em Git Bash, de dentro da worktree de integração. Cada etapa: implementar →
`npm run check` inteiro verde → `git add` de **tudo** o que a etapa tocou (o hook confere o índice) →
commit local com `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Sem `--no-verify`.

Atalhos usados abaixo:

    MOTIVO_G='"migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG", 2026-11-13'
    selar()  { node scripts/selos.mjs --selar "$1" --tipo "${3:-decisao}" --motivo "$2"; }
    golden() { node scripts/golden.mjs --aprovar --todos --motivo "$MOTIVO_G"; }
    testar() { "$(node -e "import('./scripts/binario.mjs').then(m=>console.log(m.acharBinario()))")" plugin test task-tree; }

`npm run regras:selar -- "<chave>"` quebra no Windows com nomes que têm aspas: use sempre `selar`
com a chave entre aspas simples. `testar` serve para iterar antes de selar (o check para na etapa
`selos` enquanto houver teste mudado sem selo).

Linha de `Reescrito:` (antes do `Código:`/`Estado:` do cenário; a vírgula depois da data é exigida):

    Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): <o que muda>.

### Etapa S: sonda (sem commit, worktree descartável)

Onde: `git worktree add --detach ../sonda feat/painel-nativo` (fora do clone; `--detach` porque a branch já está na worktree de integração), `npm install`, tipos copiados
de `integra/task-tree/.claude-plugin/types`. Nada daqui vai para a branch; `git worktree remove
--force ../sonda` no fim.

O quê: um `draw/sonda.tsx` com uma função que devolve uma árvore de teste, importado por
`hooks/render.tsx` no ramo do desktop (troca temporária do retorno), e um `tests/sonda.test.ts` que
monta `surface: 'desktop'` e imprime `JSON.stringify(await ui.drawn())`.

Perguntas, e o que cada resposta decide:

| Pergunta | Se não |
|---|---|
| `claude plugin validate task-tree --strict` e o `plugin test` aceitam JSX em `draw/*.tsx`? | os arquivos novos vão para `hooks/desktop.tsx` e `hooks/head.tsx` |
| O `mount` aceita `height={0.2}` e `width="40%"`? | barra da linha em texto: `ratioBar(d, n, 5)` em dois `Text mono` (`success` e `inactive dimColor`) |
| Aceita `color="effortUltra"`, `backgroundColor="userMessageBackground"` e `rgba(136,135,128,0.25)`? | cada uma que for recusada troca sozinha: `effortUltra` → a cor crua `#8700FF` (a do tema claro de hoje; perda registrada no relatório); fundo do cartão → sem fundo; trilho e faixa cinza → `inactive`; âmbar claro → `warning` |
| Aceita `Text` com `\n` (a faixa lateral do cartão)? | a faixa vira uma coluna de `Text`, um por linha |
| Aceita `Box position="absolute"` com `top/bottom/left/right={0}` dentro de `Box position="relative"`, com `Button label={'\u2003'} plain`? | manter os `Box` de hoje (`render.tsx:80-86`) com `left={0} width={3}` |
| A `key` de um `Text` chega ao `drawn()`? | nada muda (o kit não depende); só registrar no `DESENVOLVIMENTO.md` |
| Quanto pesa uma linha de tarefa de [D] 4.3 (bytes e nós)? | calibra o título dos testes de 600 KB (etapa 0, item 4) |

Registre as respostas no relatório da migração; elas entram no `DESENVOLVIMENTO.md` na etapa 5.

### Etapa 0: preparação dos acessórios (o código do mod não muda)

Arquivos: `task-tree/tests/kit/leitura.ts`, `task-tree/tests/kit/ambiente.ts`,
`task-tree/tests/{taxa,ultracode,cabecalho,visual,golden}.test.ts`,
`task-tree/tests/golden/svg.ts` → `desenho.ts`, `scripts/selos.mjs`, `scripts/travas.test.mjs`,
`regras/{visual,taxa,ultracode,cabecalho}.md`, `regras/selos.json`.

1. **Catálogo primeiro** (o `--tipo decisao` é recusado sem a linha). `Reescrito:` em:
   - `regras/visual.md`: `visual.tooltip` (:27; o "Então" passa a "não há tooltip: nenhum `Svg`
     interativo, nenhum `<title>` em fonte de `Svg` e nenhum elemento com `hover` ou escondido"),
     `visual.golden-gera-desenho` (:145; "os 4 cenários (principal, filha trabalhando, envios,
     subagente)"; "cada cenário gera a árvore do desenho, elementos e props, e as fontes dos `Svg`,
     a mesma a cada vez"), `visual.desenho-principal`, `-cartao-filha` ("o cenário passa a publicar
     o contexto, para o anel"), `-envios`, `-subagente` (:156, :170, :183, :196; "o golden guarda a
     árvore e as fontes dos `Svg`; é regravado pela sessão de migração e validado pelo usuário no
     app no fim"), `visual.faixa-de-estado-geral` (:207; "o teste lê o estado no texto alternativo
     do cabeçalho");
   - `regras/taxa.md`: `taxa.fim-do-turno-fica-aceso` (:27); `regras/ultracode.md`: as quatro
     (:7, :17, :28, :50) ("o teste lê o texto do cabeçalho e da linha no app: o que mostram e o
     texto alternativo dos `Svg`"); `regras/cabecalho.md`: `cabecalho.limite-de-linhas-do-desenho`
     (:99; "o teste lê o texto das linhas e usa títulos mais longos; a regra não muda").
   - Cenário novo em `regras/visual.md`: `visual.botoes-por-chave`, `Estado: coberto`,
     `Código: hooks/render.tsx`, origem os dois pedidos de `render.tsx:57-69`: "Dado uma linha com
     algo embaixo e um cartão de sessão com anel; Quando o painel é desenhado no app desktop; Então
     a linha tem o botão `fold:<chave>` e o cartão o botão `open:<sessão>`; apertá-los recolhe a
     linha e pede a sessão ao app".
2. **Kit.** `leitura.ts`: o bloco da seção 2.2; comentário das linhas 4-5 atualizado. `ambiente.ts`:
   `Filha.contexto?: number` (tipo, linhas 83-97) e no arquivo montado (linhas 121-133)
   `...(s.contexto !== undefined ? { context: { percent: s.contexto, at: AGORA } } : {})`
   (`io/publish.ts:44` lê `context.percent` e `context.at`); `Host.pedidosAoApp(): string[]` (o
   `on('mcp.call', …)` da linha 103 guarda `e.tool` antes de responder).
3. **Testes reescritos sob o mesmo nome** (nunca renomear nem remover: fatos 1 e 4 de [A] 1):
   - `taxa.test.ts:8`: `altTopo` → `async ($) => (await noApp($)).cabecalho.texto`; as duas
     asserções iguais. Import: `svgs` sai, `noApp` entra.
   - `ultracode.test.ts:20-21`: `cartao` → `primeiraDoApp(await noApp($), 'filha-um')?.texto ?? ''`;
     `topo` → `(await noApp($)).cabecalho.texto`. Teste 1: `toContain('Opus 5.5 · xhigh')`,
     `alt.indexOf('ultracode') > alt.indexOf('Opus 5.5 · xhigh')`, depois `toContain` do modelo e
     `not.toContain('ultracode')`. Teste 4 (linha 88): `const d = await noApp($)`;
     `d.cabecalho.texto` e `primeiraDoApp(d, 'Explore: ler o kit')?.texto ?? ''`.
   - `cabecalho.test.ts:260-274`: `mostradoNoApp`, `altsNoApp` e `noApp` saem (vêm do kit);
     `d.alts` → `d.textos`; `antes`/`depois` viram constantes locais do teste ou helper
     `cortes(d)` = `{ antes: d.textos.find(t => /\+\d+ linhas anteriores$/.test(t)), depois:
     d.textos.find(t => /\+\d+ linhas$/.test(t)) }`. O import de `PROPS` (linha 5) sai; `AGORA`
     fica (linha 176).
   - `visual.test.ts:9-12`: `faixa` → `async ($) => estadoGeral(await noApp($))`; valores
     `'aguardando'`, `'em andamento'`, `'aguardando'`, `'concluído'`; linha 24 →
     `expect((await noApp($)).cabecalho.texto).toContain('1 em andamento')`; teste 2: `'sessão
     ativa'`, `'em andamento'`, `not.toBe('em andamento')`. Tooltip (76-89): `const d = await
     noApp($)`; `d.linhas.some(l => l.texto.includes(LONGO))`; `d.svgs.filter(s =>
     s.isInteractive).length` é 0; nenhum `source` com `<title`; `d.revelados` é 0.
     Os três testes de geometria (62-73, 92-110, 113-129) **não são tocados** nesta etapa, nem
     `LONGO`, `desenhado`, `aDireita` (entram no hash deles).
   - `golden.test.ts`: [A] 4.2 como está (`./golden/desenho`, `desenhoDoApp($)`, `conferir` com
     `{ arvore, svgs }`); `golden: filha` ganha `contexto: 42`.
   - Teste novo em `visual.test.ts`, `// Regra: visual.botoes-por-chave`:
     `no app, o ícone da linha que recolhe e o anel do cartão são botões com chave`. Filha com
     `contexto: 42`; `montarNoApp`; a linha "Plano A" tem um botão `fold:…`; a linha do cartão tem
     `open:<id>`; `apertar(fold)` e a linha da tarefa de baixo some de `d.linhas`; `apertar(open)` e
     `h.pedidosAoApp()` contém `open_session_in` (`hooks/sessions.ts:337`). Dê à tarefa de baixo um
     título que não seja pedaço de outro ("Tarefa única").
4. **Peso do cenário de 600 KB** (`cabecalho.test.ts:264`). `LONGO` passa a ≈830 caracteres
   (`'com um título comprido, como os de uma sessão real, que passa da largura do painel; '.repeat(10)`).
   Conta: 393 linhas × 2 × 0,83 KB (título no texto e no `alt`) ≈ 650 KB só de títulos, nos dois
   desenhos. Confira nas mensagens (`kb(d)`) que o desenho inteiro passa de 600 KB e, na saída do
   `plugin test`, que cada um dos três testes fica bem abaixo dos 15 s (alvo: 8 s); se estourar,
   reduza a repetição para o menor valor que ainda corta. Comentário das linhas 276-278 atualizado.
5. **Golden e scripts.** `git mv task-tree/tests/golden/svg.ts task-tree/tests/golden/desenho.ts`,
   conteúdo trocado pelo cabeçalho de `CABECA_GOLDEN` mais `{}`; `scripts/selos.mjs:138-139`
   (comentário e `GOLDEN = 'task-tree/tests/golden/desenho.ts'`); `scripts/travas.test.mjs:196,202`
   (`golden/desenho.ts`; o exemplo das linhas 196 e 200 pode virar
   `{"principal":{"arvore":{"t":"Box"},"svgs":["<svg/>"]}}`, o `trocar` da 202 segue valendo).
6. **Selos**, nesta ordem (os 15 testes existentes, sempre `decisao`):

       M='migração para o desenho nativo: leitura do app por key, texto e alt; decisão do usuário, 2026-11-13'
       node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts  --tipo decisao --motivo "$M"
       node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo decisao --motivo "$M"
       selar 'task-tree/tests/taxa.test.ts::no fim do turno o último número fica aceso, sem "(último turno)"' "$M"
       selar 'task-tree/tests/ultracode.test.ts::o cartão da filha diz "ultracode" depois do modelo enquanto ela publica o interruptor ligado' "$M"
       selar 'task-tree/tests/ultracode.test.ts::ultra_effort_enter acende a palavra no cabeçalho e no arquivo publicado; ultra_effort_exit apaga' "$M"
       selar 'task-tree/tests/ultracode.test.ts::a palavra digitada num prompt e o attachment de um subagente não acendem' "$M"
       selar 'task-tree/tests/ultracode.test.ts::com a sessão em ultracode, o cartão de subagente não diz "ultracode"' "$M"
       selar 'task-tree/tests/cabecalho.test.ts::sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso' "$M"
       selar 'task-tree/tests/cabecalho.test.ts::com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha' "$M"
       selar 'task-tree/tests/cabecalho.test.ts::um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso' "$M"
       selar 'task-tree/tests/visual.test.ts::a faixa do cabeçalho: em andamento, aguardando, concluído e interrompido' "$M"
       selar 'task-tree/tests/visual.test.ts::a faixa do cabeçalho: interrompido depois do Esc, e sessão ativa com só a filha trabalhando' "$M"
       selar 'task-tree/tests/visual.test.ts::texto cortado não tem tooltip: nenhuma camada interativa e nenhum <title>' "$M"
       for c in principal filha envios subagente; do selar "task-tree/tests/golden.test.ts::golden: $c" "$M"; done
       selar 'task-tree/tests/visual.test.ts::no app, o ícone da linha que recolhe e o anel do cartão são botões com chave' 'teste novo: as keys de clique no app' novo
       golden          # por último, com os testes na forma final
       node scripts/selos.mjs    # só os esperados; nenhum "mudou sem selo novo" (correção 23)

7. `npm run check`. Esperado: `regressao` com 0 falhas (os testes de `b7d2a50` contra o mesmo código).
   Se um teste reescrito falhar no desenho de hoje, o erro está no kit ou no teste, não no mod.

Commit: `test(task-tree): leitura do desenho do app por key, texto e alt; golden da árvore`.

Relato: `npm run testes:alterados` (os 15, antes e depois).

### Etapa 1: fundação e linhas fora de cartão

Código (arquivos de [D] etapa 1):

- `draw/svg.ts`: só o parâmetro `base` de `slim` (correção 9). Nada mais muda nele.
- `draw/icons.ts` (novo): as cinco funções de [D] seção 2 e 4.2, com `slim(x, '')`; `headBar` já
  pronta ([D] 4.9), sem uso até a etapa 3.
- `draw/desktop.tsx` (novo): `cells` ([D] 4.1), `iconCell` ([D] 4.2, com `position="relative"` no
  `Box` de fora), `desktopRow` para tarefa, pedido, aviso, ↩, ✉, ferramenta de subagente e seção
  ([D] 4.3 e 4.4), com as regras gerais de [D] seção 3 e o contrato 2.1 daqui.
- `hooks/render.tsx`: em `drawDesktop` (função de topo), `acts` e, no `lines.map`,
  `cards[i]!.cards.length === 0 ? desktopRow(ui, r, i, cut…, acts, cols) : <o Box com o Svg de hoje>`.
  `cols = (e.props as any).bodyColumns || 40` desce como parâmetro ao lado de `W`.

Acessórios no mesmo commit:

- `regras/visual.md:5`: `Código da área: draw/svg.ts, draw/geometry.ts, draw/icons.ts, draw/desktop.tsx`.
- `regras/visual.md:39` (`visual.titulo-sem-contagem-vai-ate-o-tempo`): `Reescrito:` com o "Então"
  de [A] 5.1 (o título vai inteiro ao texto da linha e o app o corta; sem barra nem contagem,
  depois do título só vem o tempo; com contagem, a contagem e a barra; onde o corte cai é do app).
- `visual.test.ts:62-73`, mesmo nome: `const d = await noApp($)`; as duas linhas com um pedaço de
  texto igual a `LONGO`, na ordem pai, folha; folha: os pedaços de texto de
  `pedacosDepois(folha, LONGO)` são um só e casam `/^\d+:\d\d/`; pai: há um pedaço `/^\d+\/\d+$/`;
  o pedaço do título tem `props.wrap === 'truncate-end'`; existe linha com o pedaço `'Curta'`.
- Tooltip (`visual.test.ts:76-89`), asserção trocada: `d.linhas.some(l => l.pedacos.some(p =>
  p.tipo === 'texto' && p.texto === LONGO))` (o título vai inteiro a um `Text`). Selo `decisao`.
- Medir e anotar para o relatório: `d.bytes / d.linhas.length` e `d.nos` nos quatro cenários do
  golden e no pedido pesado. Se os três testes de 600 KB de `HEAD` falharem na `regressao` (o
  desenho inteiro ficou abaixo de 600 KB), aumente a repetição de `LONGO` e sele os três de novo
  (`decisao`; atenção à correção 11).

       M1='migração para o desenho nativo: as linhas fora de cartão são Box e Text; decisão do usuário, 2026-11-13'
       selar 'task-tree/tests/visual.test.ts::o título de uma linha sem contagem vai até o tempo; a com contagem corta antes da barra' "$M1"
       selar 'task-tree/tests/visual.test.ts::texto cortado não tem tooltip: nenhuma camada interativa e nenhum <title>' "$M1"
       golden

Esperado na `regressao`: falham os 4 de golden (liberados por `liberaGolden`) e o teste do título (liberado pelo selo `decisao` acima);
os dois testes de geometria de cartão seguem passando (as linhas de cartão ainda são `Svg`).
**Qualquer outro teste de `HEAD` que falhe é contrato 2.1 quebrado: corrige-se o desenho.**

Commit: `feat(task-tree): linhas fora de cartão em componentes nativos`.

### Etapa 2: cartões, rótulo de sessão e anel

Código: `draw/desktop.tsx` ganha `desktopTree` ([D] seção 5), o rótulo de sessão e a célula do anel
([D] 4.5), o cálculo do que cabe por contagem de caracteres; `hooks/render.tsx`: `drawDesktop` vira
linha de erro, o cabeçalho de hoje (`headerSvg`) e `desktopTree(ui, lines, acts, cols)`; saem os
imports sem uso (`overlays`, `Placed`, `frames`, `rowHeight`, `rowSvg`; `rowAlt` e `RING_LABEL`
passam a ser importados por `draw/desktop.tsx`). `draw/icons.ts` não é tocado.

Acessórios no mesmo commit:

1. `visual.test.ts:92-110`, mesmo nome: na linha com o pedaço `LONGO` (a folha do cartão),
   `pedacosDepois` tem um pedaço de texto só, `/^\d+:\d\d/`, e nenhum `/^\d+\/\d+$/`.
2. `visual.test.ts:113-129`, mesmo nome: uma linha só com um pedaço de texto que começa por
   `Folha cortava`; `pedacosDepois` dela é vazio (nem tempo, nem contagem, nem `Svg`).
3. `visual.test.ts`: saem `desenhado`, `aDireita` e o import de `svgs` (`noUnusedLocals`).
4. `tests/kit/leitura.ts`: sai `svgs()` (linhas 82-103); `DesenhoSvg` e `normalizar` ficam. Selo do kit.
5. `regras/ultracode.md:5` ganha `draw/desktop.tsx`; `regras/sessoes.md:174,185,196` ganham
   `draw/desktop.tsx, draw/icons.ts`; `regras/envios.md` (as 6 linhas com `draw/svg.ts`) ganham
   `draw/icons.ts`. Opcional para o check (só melhora a matriz), mas barato.
6. Opcional: teste novo `// Regra: cabecalho.limite-de-linhas-do-desenho` (selo `novo`) que, no
   pedido pesado, afirma `d.nos <= 20000` e `d.fundo <= 32`, com a origem dita como suspeita
   (correção 16). Só se a medida da etapa 1 ficar acima de 10.000 nós.

       M2='migração para o desenho nativo: cartões, rótulo de sessão e anel em Box e Text; decisão do usuário, 2026-11-13'
       selar 'task-tree/tests/visual.test.ts::no cartão da filha, o título da folha passa da coluna da contagem e corta junto do tempo' "$M2"
       selar 'task-tree/tests/visual.test.ts::a linha ↩ do cartão, sem tempo, vai até a borda do cartão antes de cortar' "$M2"
       node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo decisao --motivo 'sai svgs(): nenhum teste lê mais a lista de Svg (migração para o nativo, 2026-11-13)'
       golden

Os dois testes citam `visual.titulo-sem-contagem-vai-ate-o-tempo`, que já tem o `Reescrito:` da
etapa 1 (a data do selo anterior deles é 2026-11-09: basta).

Commit: `feat(task-tree): cartões, rótulo de sessão e anel em componentes nativos`.

### Etapa 3: cabeçalho

Código: `draw/head.tsx` (novo; [D] 4.9, com `0.25`/`0.5` nas cores cruas) e, em
`hooks/render.tsx:309-323`, o `Head` montado e `desktopHead(ui, head)` no lugar de `headerSvg`;
saem `lineWidth`, `headerSvg` e `W`. O `alt` (linhas 312-322) não muda uma letra e vai na barra
(contrato 2.1, item 4).

Acessórios no mesmo commit:

- `regras/visual.md:5` e `regras/cabecalho.md:5` ganham `draw/head.tsx`; `regras/ultracode.md:5`
  também; `taxa.fim-do-turno-fica-aceso` ganha `Código: draw/head.tsx`.
- `regras/visual.md`, texto dos cenários `checklist` que a etapa torna falsos ([A] 5.2):
  `visual.cabecalho-em-cartao` (sem "(16 px)"; `Reescrito:`), `visual.cabecalho-barra-e-chips-desenhados`
  (sem `o tooltip "sessão inteira"`), `visual.largura-real`, `visual.cores-dos-temas`,
  `visual.cartao-posicao-de-toks-e-repo` ("posição na linha"), `visual.cliques-no-icone-e-no-anel`.
  Texto livre, sem selo.
- Opcional, um commit só se entrar: nos dois testes da faixa, a cor (`backgroundColor` do `Box
  key="band"`, por estado), selo `decisao`; e um teste novo a 120 colunas, `// Regra:
  ultracode.cabecalho`, de que o bloco de números mostra `toks/s` e `ultracode` em texto (selo `novo`).

       golden

Esperado na `regressao`: só os 4 de golden. Os testes de `taxa`, `ultracode` e da faixa de `HEAD`
passam sem mudança porque leem `d.cabecalho` por pedaço (correção 6).

Commit: `feat(task-tree): cabeçalho em componentes nativos, com a barra em Svg`.

### Etapa 4: retirada do desenho antigo

Sem mudança de desenho: **não** aprove o golden; se o teste de golden falhar, a remoção mudou um
byte e é isso que se corrige.

- `draw/svg.ts`: apagar a lista "morre" de [D] 8 (inclusive o parâmetro `base` de `slim`, agora
  sempre vazio, e as classes de `LIGHT`/`DARK` que nenhuma primitiva usa: confira uma a uma contra
  `icon`, `envelope`, `sessionIcon`, `contextRing`, `headBar`). Sobrevive o que `hooks/render.tsx`
  (terminal), `hooks/tools.ts:9` (`plural`), `draw/icons.ts`, `draw/desktop.tsx` e `draw/head.tsx`
  importam.
- `draw/geometry.ts`: apagado. `draw/layout.ts`: saem `frames`, `Card`, `Frame` e o import de `PAD`
  (linha 12); comentários que falam em `Svg` (843, 962-963, 983-986) reescritos.
- `hooks/render.tsx`: comentários das linhas 1-3 e 55-71; `hooks/sessions.ts:313-314` (comentário).
- `regras/visual.md:5`: sai `draw/geometry.ts` (no mesmo commit, senão `regras` falha).
- `tsc` com `noUnusedLocals` aponta o que sobrou sem uso dentro de cada arquivo; export sem uso ele
  não acusa: procure com `grep` cada export de `draw/svg.ts`.

`npm run impacto` sobre o diff, para o relato. Commit:
`refactor(task-tree): sai o desenho em SVG por linha e a geometria em px`.

### Etapa 5: documentação e CI

Arquivos: `CLAUDE.md`, `task-tree/DESENVOLVIMENTO.md`, `regras/README.md`,
`.github/workflows/test.yml`. Conteúdo: [A] 6.1, 6.2 e 6.3 como estão, mais:

- `CLAUDE.md`, "Travas contra regressão": duas linhas com os fatos 1 a 4 de [A] 1 e a correção 11.
- `DESENVOLVIMENTO.md`, "Limites do kit": o que a sonda respondeu (etapa S), `Button` só com texto e
  `Text` como filhos, `Svg` folha de até 131.072 caracteres, deslocamentos inteiros; seção datada
  `## Desenho nativo híbrido (2026-11-13)` com o pedido, as decisões, o que ficou em `Svg`, as
  diferenças visuais aceitas (correção 22 inclusive), o peso e os nós medidos.
- `.github/workflows/test.yml:25`: `CLAUDE_CODE_VERSION: 2.1.321`; `CLAUDE.md:114` igual. A CI segue
  desligada (`workflow_dispatch`).

Commit: `docs(task-tree): desenho nativo híbrido, golden do desenho e checklist do app`.

### Fechamento

    npm run check -- --base origin/main      # o que a CI rodaria: os testes do main contra o código final
    npm run testes:alterados -- --pr
    npm run impacto -- --base origin/main

No check com `--base` os testes do `main` que falham precisam terminar a branch com selo `decisao`
de hash diferente do `main` (os 14 de comportamento) ou com o golden de hash novo (os 4). Por isso,
**nesta branch, nenhum selo `refatoracao` nos 18 testes de desktop**. Depois do "funcionou" do
usuário no app: `golden` de novo com as palavras e a data dele (os hashes não mudam), commit só de
`regras/selos.json`, e a segunda metade da frase do `CLAUDE.md` ([A] 6.1).

## 4. Paralelismo

Regra dura: `task-tree/tests/**`, `regras/**`, `scripts/selos.mjs`, `scripts/travas.test.mjs`,
`hooks/render.tsx`, `draw/svg.ts` e `draw/layout.ts` têm **um escritor só**, o integrador, na
worktree de integração, em série. Só o integrador roda `npm run check` e aprova o golden. As outras
faixas trabalham em worktrees próprias (fora do clone) e não rodam `plugin test` enquanto o
integrador roda o check (os testes estouram os 5 s com a máquina carregada); `npx tsc --noEmit -p
task-tree` pode rodar a qualquer hora.

| Faixa | Arquivos (só estes) | Quando | Entra na branch |
|---|---|---|---|
| Integrador | tudo da regra dura; os commits das etapas 0 a 5 | em série | cada etapa |
| Sonda | worktree descartável | antes de tudo; em paralelo com o item 1 da etapa 0 (catálogo) | nunca |
| Linhas | `draw/icons.ts`, `draw/desktop.tsx` (novos) | durante a etapa 0, depois da sonda | copiados pelo integrador na etapa 1 (e completados por ele na 2) |
| Cabeçalho | `draw/head.tsx` (novo) | durante as etapas 0 a 2 | copiado pelo integrador na etapa 3 |
| Página do golden | `scripts/golden.mjs` (comentários e `--pagina`, [A] 4.3) | depois da etapa 0 | commit próprio entre duas etapas (`chore: página do golden no formato da árvore`); muda `scripts/`, o hook roda as `travas` |
| Documentação | rascunho de `CLAUDE.md`, `DESENVOLVIMENTO.md`, `regras/README.md`, `test.yml` | durante as etapas 2 a 4 | etapa 5, depois da 4 |

As faixas Linhas e Cabeçalho escrevem contra as assinaturas de [D] seção 2 e o contrato 2.1; como
os arquivos são novos e ninguém os importa até o integrador ligar, não há conflito de merge. Não
escreva arquivo pela metade dentro da worktree de integração: o `validate` pode ler a pasta inteira.

As etapas 1 e 2 ficam separadas (o painel misto, linhas nativas e cartões em `Svg`, existe só entre
dois commits locais; o usuário valida no fim). Juntá-las economiza uma aprovação de golden, mas
dobra o que um commit pode quebrar.

## 5. Armadilhas

- Selo e commit no mesmo dia (`liberaTeste` e `liberaGolden` comparam com `hoje()`): virou o dia
  entre selar e commitar, sele e aprove de novo. E a correção 11 para o `Reescrito:`.
- O hook confere o índice: teste, kit, golden, `selos.json` e catálogo têm de estar no `git add`.
- Depois da etapa 0 nenhum teste lê `svgs()[0]`: um `not.toContain` sobre o primeiro `Svg` passaria
  à toa no nativo (o primeiro `Svg` vira um ícone).
- `noUnusedLocals`: import que sobra (`svgs`, `PROPS`, `rowSvg`, `lineWidth`…) bloqueia o `tsc`.
- Os testes de golden têm 0 asserções contadas e seguem com 0 (`ASSERCOES` conta `expect` no corpo
  do teste; `conferir` é função de topo). Não mexa em `ASSERCOES`.
- Teste que estoura o tempo com a máquina carregada: rode de novo antes de concluir que quebrou.
- Nunca editar o clone `<repo>`
  (recarrega o mod em todas as sessões); o checkout da branch nele é o último passo da entrega.
- `plugin.json`: a versão não é editada; o título do PR (`feat(task-tree): …`) sobe o minor.

## 6. Não verificado por esta crítica

- Nada rodou no harness: que os 15 testes reescritos passam no desenho de hoje, o peso real da
  linha nativa, a duração dos testes de 600 KB com o título maior e as respostas da sonda são
  leitura de código, não execução.
- O que o bundle do app faz ([D] 1.1) não foi relido; só os tipos.
- Tudo o que é pintura (alinhamento das guias, faixa lateral dos cartões, realce do botão, cores)
  fica para o checklist do app, com o usuário, no fim.
