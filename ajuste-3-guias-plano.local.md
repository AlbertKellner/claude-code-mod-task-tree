# Plano do ajuste 3: as guias da árvore em caixas nativas finas e contínuas

Escrito pelo planejador do ajuste 3 em 2026-11-13, só com leitura do repositório na ponta `22ad5de`
(branch `feat/painel-nativo`). Nada foi rodado além de `git show`/`git log` de leitura e
`node scripts/impacto.mjs draw/desktop.tsx`. As linhas citadas são as de `22ad5de`; quem implementar
depois dos ajustes 1 e 2 precisa localizar de novo os trechos.

Resumo: sem bloqueio. O único arquivo do mod que muda é `task-tree/draw/desktop.tsx`. Acompanham:
`task-tree/tests/kit/leitura.ts`, `task-tree/tests/visual.test.ts`, `regras/visual.md`,
`regras/selos.json`, `task-tree/DESENVOLVIMENTO.md`, `CLAUDE.md` e, depois do aceite do usuário no app,
`task-tree/tests/golden/desenho.ts`.

## 1. Causa confirmada

Escrito no código:

- `draw/desktop.tsx:32-40` (`cells`): cada coluna de guia é um texto de três caracteres mono:
  `' │ '` (barra do ancestral), `'   '` (vazio), `' ├─'` ou `' └─'` (conector da linha).
- `draw/desktop.tsx:78-87` (`guidesOf`): as guias de uma linha vão num `Text mono color="inactive"
  dimColor`, dentro do `Box key="r<i>" height={1}` da linha (`desktop.tsx:115-116` e `275-276`).
- `draw/desktop.tsx:334-345` (`desktopTree`): a faixa à esquerda de um cartão é um único `Text mono`
  com uma linha de texto por linha do cartão, juntas com `'\n'`.
- A decisão que isso implementava está em `DESENVOLVIMENTO.md:1632` ("Caracteres (Recomendado)") e no
  comentário do topo de `desktop.tsx` (linhas 3-5).

Visto no print (`prints/2026-11-13-cartao-filha-estranho.png`), não no código:

- O glifo de caixa não ocupa a altura toda da linha: entre uma linha e a seguinte sobra um vão em toda
  barra vertical, dentro e fora dos cartões e na faixa ao lado deles. A linha tem 1 célula de altura; o
  glifo tem a altura da fonte mono, que é menor. Nenhuma prop de `Text` estica um glifo.

Dedução:

- Na faixa do cartão há uma segunda fonte de desalinho: o passo das linhas do texto com `'\n'` é o da
  fonte mono, e o das linhas do cartão é `height={1}` mais a borda de cima do cartão. Com caixas que
  esticam, isso deixa de existir.

Um ponto do brief que não bate com o repositório (não bloqueia): o brief diz que "o cenário do catálogo
ganha `Reescrito:`", mas não há cenário das guias em `regras/` (busquei "guia", "caractere", "ramo",
"mono" e os glifos). A decisão "Caracteres" só está em `DESENVOLVIMENTO.md` e nos comentários. Por isso
o plano cria cenários novos, com a origem citando o que desfazem, e põe `Reescrito:` nos quatro
`visual.desenho-*` (o desenho aprovado deles muda), como as decisões anteriores fizeram.

## 2. O que muda

Só `task-tree/draw/desktop.tsx`. `draw/layout.ts` (`guides`, `labelCols`), `draw/svg.ts` (`prefix`, do
terminal), `draw/icons.ts`, `draw/head.tsx` e `hooks/render.tsx` não mudam. O terminal segue com os
caracteres de caixa: a decisão é do app desktop.

### 2.1 Valores

Três constantes novas em `desktop.tsx`, com nome, para o usuário poder pedir ajuste depois de ver no app:

| O quê | Valor | Unidade | Por quê |
|---|---|---|---|
| cor das guias | `rgba(136,135,128,0.55)` | cor crua | a mesma nos dois temas |
| largura da barra vertical | `0.15` | colunas (`width` de `Box`) | cerca de 1,1 px |
| altura do braço horizontal | `0.06` | linhas (`height` de `Box`) | cerca de 1,2 px |

Por que a cor serve nos dois temas sem o mod saber qual está ativo:

- É um cinza médio com transparência. Sobre o fundo escuro do painel (perto de `#1a1a19`) resulta em
  cerca de `#575650`; sobre o branco, em cerca de `#bebdba`. Contrasta com os dois.
- Por ser transparente, mistura-se com qualquer fundo de cartão, inclusive os que os ajustes 1 e 4
  mudarem por nível.
- É a cor que as guias tinham no desenho em SVG que o usuário validou: a classe `g` de
  `git show d5b5ad3^:task-tree/draw/svg.ts` (linha 78: `stroke:#888780;stroke-opacity:.55`, traço de
  1 px nas linhas 415 e 588), sem regra própria para o tema escuro. Isso está escrito.
- Cor crua em `backgroundColor` de `Box` já é usada e aparece no app: o trilho da mini barra
  (`desktop.tsx:238`) e a faixa do cabeçalho (`head.tsx:39-40`).

Larguras, o que está escrito e o que é dedução:

- Escrito: altura fracionária de `Box` funciona no app. A mini barra usa `height={0.2}`
  (`desktop.tsx:238`) e aparece no print com a mesma espessura da barra do cabeçalho, que é um `Svg` de
  4 px. Logo 1 linha vale perto de 20 px, e `0.06` dá cerca de 1,2 px.
- Dedução: largura fracionária funciona do mesmo jeito. Não há `width` fracionário no código de hoje. A
  coluna vale perto de 7,2 px (comentário de `head.tsx:55`), e `0.15` dá cerca de 1,1 px.
- Se no app a barra sumir em alguma coluna, subir para `0.2` e `0.08`; se ficar grossa, descer para
  `0.12` e `0.05`. Qualquer troca muda o golden e passa pela validação dele.
- Alternativa de cor, se ele achar fraca: a chave de tema `inactive` (segue o tema sozinha; já é fundo
  da faixa do cabeçalho em `head.tsx:38`). A estrutura abaixo serve para as duas cores: nenhuma caixa se
  sobrepõe a outra.

### 2.2 `cells`: da coluna ao tipo de célula

`cells(r, g, hide)` segue com a mesma lógica de colunas (as barras dos ancestrais, o conector na coluna
`depth - 1`, as colunas de `hide` de fora), mas cada célula passa a dizer o tipo, não o texto:

- vazio: onde hoje é `'   '`;
- barra: onde hoje é `' │ '`;
- ramo: onde hoje é `' ├─'` (a linha tem irmã depois);
- fim: onde hoje é `' └─'` (a linha é a última).

`leadOf` sai: não tem nenhum uso no repositório (só a definição, `desktop.tsx:42-45`).

### 2.3 A célula de guia

Uma função nova no lugar de `guidesOf`, espelho de `iconCell` (`desktop.tsx:50-65`), para a célula ter a
mesma largura da célula do ícone por construção, sem depender de quanto vale uma coluna no app:

- A célula é um `Box` com `position="relative"` e `flexShrink={0}`, sem `width` e sem `height`.
- Primeiro filho: o mesmo espaçador de `iconCell`, um `Text mono wrap="truncate-end"` com três espaços.
  Ele dá a largura. Espaço não é caractere de caixa: `iconCell` já faz isso.
- Vazio: só o espaçador.
- Barra: mais uma camada, um `Box` com `position="absolute"`, `top`, `bottom`, `left` e `right` em 0
  (o mesmo de `iconCell`) e `justifyContent="center"`. Dentro dela, uma caixa só: `Box` com `width` da
  barra e `backgroundColor` da cor das guias, sem `height` e sem filhos. Ela estica até a altura da
  camada, que é a da linha.
- Ramo: a camada sem `justifyContent`, com três filhos em linha:
  1. um `Box` com `flexGrow={1}`, vazio (a metade esquerda);
  2. a caixa da barra, como acima (altura inteira);
  3. um `Box` com `flexGrow={1}` e `alignItems="center"`, e dentro dele a caixa do braço: `Box` com
     `flexGrow={1}`, `height` do braço e `backgroundColor` da cor das guias. É o mesmo arranjo da mini
     barra (`desktop.tsx:236-238`).
- Fim: igual ao ramo, mas o filho 2 é um `Box` com `width` da barra e `flexDirection="column"`, com dois
  filhos `flexGrow={1}`: o de cima com `backgroundColor` da cor das guias, o de baixo vazio. A barra
  desce só até o meio da linha, onde sai o braço.

Por que assim:

- Os dois `flexGrow={1}` vazios dos lados dividem a sobra por igual, então a barra fica no meio da
  célula, sob o meio do ícone do pai (o `Svg` de `iconCell` também é centrado na célula).
- Nenhuma caixa se sobrepõe a outra. Com cor transparente, sobreposição apareceria como um ponto mais
  escuro na junção.
- O braço vai do lado direito da barra até a borda direita da célula, a mesma extensão do `─` de hoje.
- Só entram props e arranjos que o app já desenha neste mod: camada absoluta 0/0/0/0, `flexGrow`
  vazio, caixa com fundo e sem altura que estica (o preenchimento verde da mini barra não tem `height`
  e aparece no print), altura fracionária.

### 2.4 As guias de uma linha

`desktopRow` e `labelRow` deixam de receber o texto das guias e passam a receber as células da linha.

- Com células, o primeiro filho do `Box key="r<i>"` é um `Box key="guides"` com `flexShrink={0}`, sem
  `height`, com uma célula por coluna, na ordem. Sem células, nada (como hoje com o texto vazio).
- Sem `height` próprio: o `Box key="guides"` e as células esticam até a altura da linha. Assim as
  guias acompanham sozinhas qualquer altura que o `Box key="r<i>"` tiver.
- A conta de `labelRow` (`desktop.tsx:104`) troca o comprimento do texto por três vezes o número de
  células. O número é o mesmo de hoje; o que cabe no rótulo de sessão não pode mudar.

### 2.5 A faixa à esquerda de um cartão

Em `desktopTree` (`desktop.tsx:312-357`):

- `cut` devolve as células da faixa de colunas pedida, não o texto.
- A faixa do cartão sai das células da linha do cabeçalho do cartão, nas colunas de `base` até
  `r.depth` (as mesmas de hoje). Ela é igual em todas as linhas do cartão: para toda coluna abaixo de
  `r.depth - 1` a barra do ancestral vale o mesmo no cabeçalho e nas linhas de dentro, e na coluna
  `r.depth - 1` as linhas de dentro têm barra exatamente quando o cabeçalho não é o último. O golden de
  hoje confirma (`"    │  ├─\n    │  │ "`, `"       └─\n         \n…"`).
- `wide` passa a ser três vezes o número de células da faixa; `inner` segue a mesma conta
  (`desktop.tsx:335-336`). Os números não mudam.
- Com células, o primeiro filho do `Box key="c<i>"` é um `Box key="strip"` com `flexShrink={0}`, sem
  `height`, no lugar do `Box` com o `Text` de várias linhas. Ele estica até a altura do cartão, bordas
  incluídas. Dentro, uma célula por coluna:
  - colunas dos ancestrais: a célula de guia comum, vazio ou barra. Sem altura própria, a barra vai do
    alto ao pé do cartão e emenda com as linhas de cima e de baixo;
  - a última coluna (o conector do cabeçalho): a célula com a camada em `flexDirection="column"`:
    1. um `Box` com `height={1}`, a altura da linha do cabeçalho do cartão, com os três filhos do ramo
       (o cartão tem irmã depois) ou do fim (é o último), em linha;
    2. só no ramo, um `Box` com `flexGrow={1}` e `justifyContent="center"`, com a caixa da barra
       dentro: a barra segue até o pé do cartão.
- O braço termina na borda direita da faixa, onde começa a borda do cartão: a guia entra no cartão na
  altura do rótulo, como o usuário pediu antes ("a linha de conexao ... esta interrompida, conecte ela
  no painel", `DESENVOLVIMENTO.md:1036-1037`).
- Dentro do cartão nada muda de lógica: as linhas recebem as células das colunas do cartão, e as
  colunas de rótulo de sessão seguem de fora (`labelCols`).

### 2.6 Comentários do arquivo

- Topo de `desktop.tsx` (linhas 3-5): a decisão nova, "Caixas finas nativas (Recomendado)",
  2026-11-13, que desfaz "Caracteres (Recomendado)".
- O parágrafo do contrato com o kit (linhas 8-12) ganha: as guias de uma linha estão no
  `Box key="guides"`, filho direto do `r<i>`; a faixa de um cartão, no `Box key="strip"`, filho direto
  do `c<i>`; uma célula por coluna; toda caixa com fundo dentro deles é um traço de guia.
- Os comentários de `cells`, de `desktopRow` ("Every line one `lh` high…") e de `desktopTree`
  (linhas 306-311) passam a falar de células e caixas.

### 2.7 O que nas guias precisa acompanhar os outros ajustes

- Altura da linha (ajuste 4): as guias das linhas acompanham sozinhas se a altura mudar no `height` do
  `Box key="r<i>"`. O bloco do conector na faixa do cartão usa a altura da linha do cabeçalho: tem de
  ser o mesmo valor (um nome só para as linhas e para esse bloco).
- Espaço entre linhas: não pode entrar por `rowGap`, margem ou `paddingY` do `r<i>`. Qualquer espaço
  fora da altura da linha reabre o vão nas guias.
- `paddingY` ou borda do cartão (ajustes 1 e 4): a faixa estica sozinha. O conector precisa descer o
  mesmo que o cabeçalho desce: antes do bloco de 1 linha entra um trecho de barra com a altura do
  `paddingTop` do cartão. A borda de 1 px de hoje não é compensada: o braço fica cerca de 1 px acima
  do meio do ícone do cabeçalho.
- Vão entre a faixa e o cartão: se um ajuste puser `columnGap` ou margem entre o `strip` e o cartão, o
  braço deixa de encostar no cartão.
- Recuo (ajuste 2): se for um espaço no contêiner da árvore, nada muda. Se for um filho a mais dentro
  do `r<i>` ou do `c<i>`, o `guides` e o `strip` deixam de ser o primeiro filho; o kit os acha pela
  key, não pela posição.
- Estrutura do cartão (ajuste 1): a faixa tem de seguir irmã do `Box` do cartão, numa linha, para
  esticar com ele.

## 3. Matriz de impacto

`npm run impacto -- draw/desktop.tsx` (rodado como `node scripts/impacto.mjs draw/desktop.tsx`):

- 29 cenários afetados, nenhum arquivo fora do mapa.
- Cobertos: `sessoes.busto-so-no-pai`, `sessoes.pasta-sem-git`, `sessoes.toks-e-repo-branch-no-cartao`
  (1 teste cada, `sessoes.test.ts`); `ultracode.cartao-da-filha`, `ultracode.so-o-interruptor-real`,
  `ultracode.cabecalho`, `ultracode.subagente-sem-palavra` (5 testes, `ultracode.test.ts`);
  `visual.botoes-por-chave`, `visual.tooltip`, `visual.titulo-sem-contagem-vai-ate-o-tempo`,
  `visual.faixa-de-estado-geral` (7 testes, `visual.test.ts`); `visual.golden-gera-desenho` e os quatro
  `visual.desenho-*` (4 testes, `golden.test.ts`).
- Checklist do app: `ultracode.cor-e-corte` e 12 de `visual.*` (largura real, cliques, animação, cores
  dos temas, cabeçalho, status, modelo e esforço, toks e repo, ordem dos cartões, recarga, barra e
  pílulas, seção sem traço).
- Golden: `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente`.

Dos testes existentes, nenhum lê as guias do app: busquei os glifos de caixa, `mono` e `strip` em
`tests/`. O único uso é a leitura do terminal (`kit/leitura.ts:41`), que não muda.

## 4. Testes

### 4.1 O kit (`task-tree/tests/kit/leitura.ts`)

Acréscimos, sem mudar nenhuma leitura existente:

- um tipo para a célula de guia: vazio, barra, ramo, fim;
- em cada linha do app (`LinhaDoApp`), `guias`: as células do `Box key="guides"` que é filho direto do
  `r<i>`, na ordem; lista vazia sem ele;
- no desenho (`DesenhoDoApp`), `faixas`: para cada `Box key="c<i>"`, o texto da primeira linha do
  cartão e as células do `Box key="strip"` filho direto dele (só os cartões que têm faixa);
- no desenho, `tracos`: toda caixa com `backgroundColor` e sem filhos dentro de um `guides` ou de um
  `strip`, com a cor, a largura e a altura que tiver;
- no desenho, a contagem de textos da árvore inteira que têm caractere de caixa (`│`, `├`, `└`, `─`)
  ou quebra de linha.

Como o kit reconhece o tipo de uma célula, pela forma: nenhuma caixa com fundo é vazio; caixa com
`width` e nenhuma com `height` é barra; caixa com `width` e caixa com `height` é ramo; caixa com
`height` e nenhuma com `width` é fim (a meia barra do fim não tem `width` nem `height`).

O comentário do bloco do app em `leitura.ts` (linha 103) ganha a frase do contrato das guias.

### 4.2 Testes novos (`task-tree/tests/visual.test.ts`)

Os três usam declarações de topo novas ou nenhuma; não mexer em `UM`, `faixa` e `LONGO`, que entram no
hash dos testes existentes. As listas de células abaixo saem do golden de hoje (mesmos planos); quem
implementar confirma na primeira execução.

**A. `no app, as guias da árvore são caixas com fundo, sem caracteres de caixa`**
- Regra: `visual.guias-em-caixas-nativas`.
- Cenário: um pedido; plano com duas tarefas de nível 1, "Plano A" (com "Um", que tem "Um.um" e
  "Um.dois", e "Dois") e "Plano B"; `start` de "Um.um".
- Afirma:
  - as células de cada linha: "Plano A" ramo; "Um" barra, ramo; "Um.um" barra, barra, ramo; "Um.dois"
    barra, barra, fim; "Dois" barra, fim; "Plano B" fim; a linha do pedido, nenhuma;
  - há traços, e todos têm a mesma cor;
  - nenhum texto do desenho tem caractere de caixa;
  - a linha "Um.um" tem um `Svg` só, o do ícone (as guias não são `Svg`).
- Falha hoje: não existe `Box key="guides"`, então toda linha lê zero células e zero traços; e os
  textos `' ├─'`, `' │ '` e `' └─'` estão no desenho.

**B. `no app, a faixa à esquerda do cartão tem uma célula de guia por coluna, com ramo ou fim`**
- Regra: `visual.guias-na-faixa-do-cartao`.
- Cenário: o do golden de subagente até o segundo cartão: `lancaveis` com dois ids e o stub de `Grep`
  antes da primeira chamada a `$`; plano "Plano A" com "Investigar" e "Revisar"; `start` de
  "Investigar"; um subagente lançado com uma chamada de `Grep`; outro lançado e terminado.
- Afirma:
  - a faixa do cartão "buscar usos de hover" (tem cartão irmão depois): vazio, barra, ramo;
  - a faixa do cartão "ler o kit" (o último sob "Investigar"): vazio, barra, fim;
  - dentro do primeiro cartão, a linha da ferramenta em uso: fim;
  - "Investigar": vazio, ramo; "Revisar": vazio, fim;
  - nenhum texto do desenho tem quebra de linha nem caractere de caixa.
- Falha hoje: não existe `Box key="strip"` (a faixa é um `Text` com `'\n'`), então não há faixas; e há
  texto com quebra de linha e com caractere de caixa.

**C. `no app, o cartão da filha tem a faixa de guias e as tarefas dela começam sem guia`**
- Regra: `visual.guias-na-faixa-do-cartao`.
- Cenário: o do golden da filha: `host` com uma filha de uma tarefa aberta; plano "Plano A" com "Um" e
  "Dois"; `start` de "Um"; `abrirSessao`; `aviso`.
- Afirma:
  - a faixa do cartão "filha-um": vazio, barra, fim;
  - a linha "Tarefa da filha", dentro do cartão: nenhuma célula (a coluna do rótulo segue de fora);
  - "Dois": vazio, fim;
  - todos os traços, das linhas e da faixa, têm a mesma cor.
- Falha hoje: não há faixa nem traços.

### 4.3 Testes existentes

Nenhum precisa mudar. Conferido:

- o texto de cada linha do app perde os glifos das guias (o kit só junta textos com algo além de
  espaço). Nenhum teste compara o texto inteiro de uma linha do app: os de `cabecalho.test.ts` usam
  expressões ancoradas no fim (`/\+\d+ linhas anteriores$/`, `/\+\d+ linhas$/`) ou `includes`; os de
  `ultracode.test.ts`, `taxa.test.ts` e `visual.test.ts` usam `includes`, pedaços e keys;
- o que cabe no rótulo de sessão (`ultracode.test.ts`, `sessoes.test.ts`) depende da conta de
  `labelRow`, que fica com os mesmos números;
- os quatro testes de `golden.test.ts` não mudam de corpo; o que muda é o desenho aprovado (item 7).

Se algum teste existente falhar, a correção é no código, nunca no teste.

## 5. Catálogo e selos

### 5.1 Cenários novos em `regras/visual.md`

**`visual.guias-em-caixas-nativas`** (coberto)
- Título: no app desktop, as guias da árvore são caixas nativas finas com fundo.
- Dado uma árvore com pai, filhas e netas.
- Quando o painel é desenhado no app desktop.
- Então cada linha tem uma célula de guia por nível: barra onde o ancestral ainda tem irmã abaixo,
  vazio onde não tem, e no fim o ramo (a linha tem irmã depois) ou o fim (é a última); cada traço é uma
  caixa com fundo, todas da mesma cor; nenhum texto tem caractere de caixa e nenhuma guia é `Svg`. O
  terminal segue com os caracteres.
- Origem: decisão do usuário, 2026-11-13 ("Caixas finas nativas (Recomendado)"), à pergunta se queria
  guias contínuas; desfaz "Caracteres (Recomendado)", do mesmo dia (guias em caracteres de caixa,
  mono).
- Código: `draw/layout.ts`.

**`visual.guias-na-faixa-do-cartao`** (coberto)
- Título: à esquerda de um cartão, as guias são as mesmas caixas, uma célula por coluna.
- Dado um cartão de sessão filha ou de subagente sob uma tarefa.
- Quando o painel é desenhado no app desktop.
- Então a faixa à esquerda do cartão tem uma célula por coluna de fora, não uma linha de texto por
  linha do cartão: barra onde o ancestral continua e, na última, o ramo (há irmã depois do cartão; a
  barra segue até o pé) ou o fim (o cartão é o último); dentro do cartão as linhas têm as guias das
  colunas do cartão, e as tarefas de uma sessão começam sem guia até o rótulo.
- Origem: a mesma decisão, 2026-11-13 ("Caixas finas nativas (Recomendado)").
- Código: `draw/layout.ts`.

**`visual.guias-continuas-e-visiveis`** (checklist: pintura real)
- Título: as guias são contínuas, alinhadas com os ícones e visíveis nos dois temas.
- Dado o painel aberto no app, no tema claro e no escuro, com cartões.
- Quando a árvore é desenhada.
- Então as barras não têm falha entre uma linha e a seguinte, dentro e fora dos cartões e na faixa ao
  lado deles; ficam sob o meio do ícone do pai; o braço chega ao cartão na altura do rótulo; e a cor
  aparece nos dois temas.
- Origem: a mesma decisão, 2026-11-13, sobre o print `2026-11-13-cartao-filha-estranho.png`.

### 5.2 Cenários reescritos

Os quatro do golden, cada um com uma linha antes do `Estado:`:

`Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas (Recomendado)"): as guias da árvore
e a faixa à esquerda dos cartões passam de caracteres de caixa a caixas nativas com fundo; o golden é
regravado com a validação dele no app.`

- `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente`.
- O check não exige essa linha (o corpo dos testes do golden não muda e eles não são selados de novo);
  ela segue o costume das decisões anteriores. Os outros ajustes do mesmo dia vão pôr as deles nos
  mesmos cenários.

### 5.3 Selos

Na ordem, depois de escrever os testes, o kit e o catálogo:

```
npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, as guias da árvore são caixas com fundo, sem caracteres de caixa" --tipo novo --motivo "guias em caixas nativas finas (decisão do usuário, 2026-11-13)"
npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, a faixa à esquerda do cartão tem uma célula de guia por coluna, com ramo ou fim" --tipo novo --motivo "guias em caixas nativas finas (decisão do usuário, 2026-11-13)"
npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cartão da filha tem a faixa de guias e as tarefas dela começam sem guia" --tipo novo --motivo "guias em caixas nativas finas (decisão do usuário, 2026-11-13)"
node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo refatoracao --motivo "leitura das guias do app (guias, faixas, traços); nenhuma leitura existente muda"
```

- Se `regras/selos.json` colidir com outro ajuste, aceitar a versão do outro e rodar os quatro comandos
  de novo: cada um regrava só a sua chave.
- Se outro ajuste também mexer em `kit/leitura.ts`, o selo do kit é um só: rodar o comando do kit por
  último, com um motivo que cite os dois.
- O golden não se sela aqui (item 7).

## 6. Documentação

`task-tree/DESENVOLVIMENTO.md`:

- linhas 70-74, a descrição de `desktop.tsx`: "as guias em caracteres de caixa (`Text mono`)" vira as
  guias em caixas nativas com fundo (uma célula por coluna, `guides` na linha e `strip` ao lado do
  cartão); atualizar a contagem de linhas do arquivo e os nomes exportados (sai `leadOf`);
- linha 670, a lista do que só o app mostra: "o alinhamento das guias mono" vira a continuidade, a
  espessura e a cor das guias em caixas, e o alinhamento com os ícones;
- seção "Desenho nativo híbrido (2026-11-13)" (linha 1625): um item novo com a decisão "Caixas finas
  nativas (Recomendado)", o que ela desfaz, os três valores e de onde vêm, e por que a célula usa o
  espaçador mono de `iconCell`; as medidas do harness (linha 1647) mudam e podem ser refeitas com
  `bytes` e `nos` do kit. As seções de histórico mais antigas ficam como estão.

`CLAUDE.md`, checklist do app (linha 166): "guias de caixa alinhadas entre linhas e ao lado do cartão"
vira guias em caixas finas, contínuas entre as linhas, dentro e fora dos cartões e na faixa ao lado
deles, alinhadas com os ícones e visíveis nos dois temas.

## 7. O que o check acusa depois

- `regras` e `selos`: passam com os cenários e os selos do item 5.
- `claude plugin test`: os quatro testes do golden falham com "o desenho de <cenário> mudou", até a
  aprovação. O que muda em cada um:
  - principal: as linhas `r1` a `r6` e `r8` a `r11` trocam o `Box` com o `Text mono` das guias pelo
    `Box key="guides"` com as células; `r0` e `r7` (nível 0) não mudam;
  - filha: `r1`, `r2` e `r5`, e a faixa do cartão `c3` (o `Text` de duas linhas vira o `strip`);
  - envios: `r1` a `r3` e `r5` a `r8`, e a faixa do cartão `c4`;
  - subagente: `r1`, `r2`, `r6`, `r4` e `r8` a `r11`, e as faixas de `c3`, `c5` e `c7`;
  - a lista de fontes de `Svg` de cada cenário não muda.
- `regressao`: os quatro testes do golden de `HEAD` falham contra o código novo; a etapa só aceita com
  o golden aprovado no dia.
- Consequência (regra do `CLAUDE.md`): a mudança fica sem commit até o usuário validar no app. Com as
  palavras dele, `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", AAAA-MM-DD"`, e o
  commit leva o código, `desenho.ts` e `selos.json`. Não rodar `golden:aprovar` antes.

## 8. Checklist do app

O harness só vê a árvore. O usuário confere, no tema claro e no escuro:

1. as barras verticais sem falha entre uma linha e a seguinte, fora dos cartões;
2. o mesmo dentro dos cartões de sessão e de subagente;
3. a faixa à esquerda de um cartão do alto ao pé dele, emendando com a linha de cima e a de baixo;
4. o braço do conector encostando no cartão na altura do rótulo (pode ficar 1 px acima do meio do
   ícone, pela borda do cartão);
5. as barras sob o meio do ícone do pai, em todos os níveis, e as linhas na mesma posição horizontal de
   antes (o recuo por nível não muda);
6. a espessura: fina, igual em todas as colunas e linhas, sem barra que some ou dobra de largura (olhar
   também com a escala do Windows em 125 % e 150 %);
7. a cor: visível sem pesar, sobre o fundo do painel e sobre o fundo dos cartões, nos dois temas;
8. o canto do "└" e a junção do "├" sem ponto mais escuro nem degrau visível;
9. um painel grande (centenas de linhas) ainda abre e redesenha a cada segundo sem engasgar.

## 9. Riscos e interações

- Largura fracionária no app é dedução (item 2.1). Se o harness ou o app recusarem `width` menor que 1,
  aparece na primeira execução; a saída é ajustar o valor, não voltar aos caracteres.
- Arredondamento de pixel: uma caixa de 1,1 px pode sair com 1 ou 2 px conforme a posição. Não há
  unidade em px para `Box` nos tipos do kit; fica para o item 6 do checklist.
- A continuidade depende de o filho sem altura esticar até a altura do pai. Está visto no app para um
  pai de altura fixa (o verde da mini barra). Para a faixa do cartão, a altura vem do conteúdo; é o
  mesmo arranjo da faixa do cabeçalho (`head.tsx:105`), mas o print não mostra essa faixa. Item 3 do
  checklist.
- Tamanho do desenho: uma linha de nível 3 ganha cerca de 1 KB (três células, de 150 a 700 bytes cada,
  contra um `Text` de 100 bytes). Em painel muito grande, o corte dos 600 KB (`render.tsx`) passa a
  tirar blocos antigos mais cedo. Os três testes de corte por tamanho de `cabecalho.test.ts` (linhas
  292-349, 15 s cada) afirmam só o que o corte garante e devem passar; se algum falhar ou ficar perto
  do tempo, a correção é aliviar a célula no código (por exemplo, um espaçador só para células vazias
  seguidas), não mexer no teste.
- O ▸ de uma seção usa `width={3}` (`desktop.tsx:195`), não o espaçador mono. Se no app as guias sob
  "+N pedidos anteriores" não ficarem sob o ▸, a causa é essa célula, que já existe e está fora deste
  ajuste; anotar para o usuário.
- As keys `guides` e `strip` fazem do `Box` um escopo de hover, sem efeito: nenhum elemento tem `hover`
  (o teste do tooltip segue contando zero).
- Recarga a quente: a mudança no mod é um arquivo só; um salvamento.
- Série 1, 2, 3, 4: todos mexem em `desktop.tsx`, no golden e em `selos.json`. Este ajuste parte do que
  os ajustes 1 e 2 deixarem (a constante do cartão e o contêiner da árvore podem ter mudado); o item
  2.7 diz o que o ajuste 4 precisa manter. Cada ajuste regrava os quatro cenários do golden.

## 10. Bloqueio

Nenhum. A decisão "Caracteres (Recomendado)" é desfeita pela decisão nova do próprio usuário, e nada no
plano contraria outra decisão registrada: não entra `Svg` novo, nem tooltip, nem hover, e o terminal não
muda.

Para a orquestradora confirmar, sem parar a implementação: o brief fala em reescrever "o cenário do
catálogo", e esse cenário não existe (item 1). O plano cria três cenários novos e põe `Reescrito:` nos
quatro `visual.desenho-*`.
