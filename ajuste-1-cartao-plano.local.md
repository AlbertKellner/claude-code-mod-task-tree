# Plano do ajuste 1: o cartão e o cabeçalho se destacam do painel

Escrito pelo planejador do ajuste 1 em 2026-11-13. Só leitura do repositório
(`feat/painel-nativo`, ponta `22ad5de`). Nada foi escrito no clone, nenhum teste rodou.

Resumo: o cartão (de sessão e de subagente) e o cabeçalho pedem ao app um fundo por uma chave de tema
que o app desktop não pinta, e não pedem cor de borda nenhuma. A correção troca o fundo por um cinza
translúcido cru e acrescenta a cor da borda, também translúcida, nos dois lugares, com os mesmos
valores. Dois arquivos do mod mudam: `task-tree/draw/desktop.tsx` e `task-tree/draw/head.tsx`.
Não há bloqueio. Há uma dedução que só o app confirma (o app pintar `rgba()` em `Box`); o item 9 traz
uma conferência barata para fazer antes de implementar e o plano de contingência.

## 1. Causa

### O que está escrito no código

- `task-tree/draw/desktop.tsx:301`: a constante `CARD`, usada em `desktop.tsx:346` para todo cartão
  (sessão filha, subagente e grupo de subagentes), tem `borderStyle: 'round'` e
  `backgroundColor: 'userMessageBackground'`. Não tem `borderColor`.
- `task-tree/draw/head.tsx:104`: o `Box key="head"` tem `borderStyle="round"` e
  `backgroundColor="userMessageBackground"`. Não tem `borderColor`.
- `userMessageBackground` não está na lista de chaves de tema do kit
  (`task-tree/.claude-plugin/types/claude-code/index.d.ts:14053`, tipo `ThemeKey`). O kit aceita
  qualquer texto como cor (`index.d.ts:1721-1727`: "What a surface draws for one it does not know is its
  own") e diz, sobre fundo, que "a surface with no counterpart for a theme key keeps its own look"
  (`index.d.ts:7979-7981`). É uma chave do tema do terminal; o desenho do desktop a herdou.
- O comentário de `desktop.tsx:299-300` ("Its border and fill are the app's (borderStyle round, the
  first surface)") descreve a intenção, não o que o app faz.

### O que foi medido no print

Print `prints/2026-11-13-cartao-subagente-sem-destaque.png` (tema escuro), pixels lidos:

- fundo do painel: `#191919`;
- dentro do cabeçalho e dentro do cartão do subagente: `#191919`, igual ao painel, em todos os pontos
  lidos (nenhum fundo pintado);
- borda do cabeçalho e do cartão: 1 px em `#222222`, 9 níveis acima do painel (a cor padrão do app
  para borda sem `borderColor`);
- a faixa de estado do cabeçalho (`backgroundColor="success"`) sai pintada (`#53c556`): chave de tema
  conhecida funciona em fundo de `Box`.

No segundo print da pasta (`prints/2026-11-13-cartao-filha-estranho.png`, lido só para esta medida) a
pílula "1 sessão ativa" tem a borda pintada (`#4a719b`, de `borderColor="permission"` com
`borderDimColor`): `borderColor` com chave de tema conhecida funciona.

### O que é dedução

- Que o desktop não tem correspondente para `userMessageBackground`: deduzido da medida (fundo igual ao
  do painel) e do texto do kit. Não li o código do app.
- Que o desktop pinta cor crua `rgba(...)` em `backgroundColor` e `borderColor` de `Box`: nenhum dos
  dois prints prova. O mod já usa `rgba(...)` em três fundos (`desktop.tsx:238`, o trilho da barra das
  linhas; `head.tsx:39-40`, a faixa "nenhuma tarefa" e "aguardando"), mas nos prints todas as barras
  estão cheias e a faixa é verde. O kit chama de cor crua "#hex or rgb(), rgba(), hsl() or hsla()"
  (`index.d.ts:13974-13975`, no tingimento do pano de fundo) e diz que o fundo de um `Box` aceita
  "a theme key, a raw color, or transparent" (`index.d.ts:7972-7974`). Ver o item 9.

## 2. O que muda

### Valores

Um cinza só, o neutro que o mod já usa nos `Svg` e nos trilhos (`136,135,128`, `#888780`), com duas
transparências:

| Papel | Valor | Onde |
|---|---|---|
| fundo do cartão e do cabeçalho | `rgba(136,135,128,0.06)` | `backgroundColor` |
| borda do cartão e do cabeçalho | `rgba(136,135,128,0.22)` | `borderColor` |

`borderStyle` segue `round`. Sem `borderDimColor` (ele enfraqueceria a borda). Nenhuma largura, altura,
margem ou espaço muda: a borda continua de 1 px, `paddingX`/`paddingY` e `CARD_COLS = 3` ficam como
estão, o `overflow="hidden"` e o `marginBottom={1}` do cabeçalho também.

### Por que funciona sem o mod saber o tema

Uma cor translúcida se mistura com o que está embaixo: resultado = fundo + α × (cinza − fundo). Sobre
um fundo mais escuro que o cinza, clareia; sobre um mais claro, escurece. O mesmo valor serve aos dois
temas e a qualquer tema que o usuário venha a usar, porque parte da cor real do painel. Contas:

| Tema | Painel | Fundo novo | Borda nova (sobre o fundo) | Referência do desenho em SVG |
|---|---|---|---|---|
| escuro | `#191919` (medido) | `#20201f` | `#373634` | fundo `#20201f`, borda `#373736` |
| claro | `#ffffff` (do comentário do `svg.ts` do `main`; não medido) | `#f8f8f7` | `#dfdfdd` | fundo `#f9f9f7`, borda `#e1e1df` |

Hoje, no escuro, a borda é `#222222` e não há fundo. Os valores reproduzem a referência do brief com
diferença de no máximo 2 níveis por canal. A referência vem de duas decisões antigas do usuário,
registradas no comentário do `svg.ts` do `main`: "calcule qual seria a terceira cor" (o fundo) e "use a
mesma cor da borda" (a borda da caixa de texto do app, branco ou preto a 10%).

A conta da borda supõe que o app pinta a borda sobre o fundo do próprio `Box` (o padrão de um `div`).
Se ele a pintar direto sobre o painel, ela sai `#313130` no escuro e `#e5e5e3` no claro: ainda visível.

### Arquivos, funções e props

1. `task-tree/draw/desktop.tsx`
   - Os dois valores viram constantes exportadas, ao lado de `CARD` (uma para o fundo, uma para a
     borda, ou um objeto com as duas props), para o cabeçalho usar as mesmas.
   - `CARD`: `backgroundColor` passa ao fundo novo e ganha `borderColor` com a borda nova. Todo cartão
     recebe as mesmas props, como hoje (um só `CARD`, sem olhar o nível).
   - Comentário de `CARD` (linhas 299-300) reescrito: o fundo e a borda são cinza translúcido cru,
     porque a chave `userMessageBackground` não tem correspondente no desktop; citar as palavras do
     usuário ("nao aparece nenhum card", 2026-11-13).
   - Comentário do topo (o contrato com a leitura dos testes, linhas 8-12): acrescentar que o cartão é
     o `Box` com `borderStyle` filho direto de `Box key="c<i>"`, e que o seu fundo e a sua borda são
     lidos pelo kit.
2. `task-tree/draw/head.tsx`
   - Importa as constantes de `./desktop` (hoje importa só de `./layout`, `./svg` e `./icons`;
     `desktop.tsx` não importa `head.tsx`, não há ciclo).
   - O `Box key="head"` (linha 104): `backgroundColor` passa ao fundo novo e ganha `borderColor` com a
     borda nova. O resto das props não muda.
   - Comentário do topo: dizer que o fundo e a borda são os do cartão (decisão do usuário, 2026-11-13:
     "Sim, junto do cartão (Recomendado)").

Nada muda em `hooks/render.tsx`, `draw/svg.ts`, `draw/icons.ts`, `draw/layout.ts` nem no desenho do
terminal.

Recarga a quente: `head.tsx` passa a depender de um export novo de `desktop.tsx`. Os dois arquivos vão
ao clone de uma vez (regra do `CLAUDE.md`, "Editar o mod sem quebrar a recarga"); se um for antes do
outro, tem de ser `desktop.tsx`.

### Comportamento novo

No app desktop, o cartão de sessão, o de subagente, o de grupo e o cabeçalho ficam um tom à parte do
painel (mais claro no escuro, mais escuro no claro), com uma borda arredondada visível. Um cartão dentro
de outro soma o tom do de fora (ver o item 9).

## 3. Matriz de impacto

`npm run impacto -- task-tree/draw/desktop.tsx task-tree/draw/head.tsx` (rodado em 2026-11-13):

- Arquivos do mod tocados: `draw/desktop.tsx`, `draw/head.tsx`. Fora do mapa: nenhum.
- 43 cenários afetados: os de `cabecalho` (13), `sessoes` (3: busto só no pai, pasta sem git, toks e
  repositório no cartão), `taxa` (1), `ultracode` (5) e `visual` (21).
- Testes que os cobrem: `cabecalho.test.ts`, `sessoes.test.ts`, `taxa.test.ts`, `ultracode.test.ts`,
  `visual.test.ts` (7 testes) e `golden.test.ts` (4 testes).
- Checklist do app (14): `cabecalho.aviso-de-painel-grande-volta`, `ultracode.cor-e-corte`,
  `visual.largura-real`, `visual.cliques-no-icone-e-no-anel`, `visual.animacao-de-linha-nova`,
  `visual.cores-dos-temas`, `visual.cabecalho-em-cartao`, `visual.status-embaixo-da-caixa`,
  `visual.cartao-modelo-e-esforco`, `visual.cartao-posicao-de-toks-e-repo`,
  `visual.cartoes-ordem-e-espera`, `visual.recarga-real-e-respawn`,
  `visual.cabecalho-barra-e-chips-desenhados`, `visual.secao-sem-traco`.
- Golden: `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente`.

Dos testes existentes, só os 4 do golden enxergam a mudança (props de `Box`); os outros leem textos,
keys e `alt`, que não mudam.

## 4. Testes

### Kit: `task-tree/tests/kit/leitura.ts` ganha a leitura das caixas do app

`leitura.ts` é o único lugar que conhece a forma da árvore desenhada, então a leitura nova mora nele:

- uma leitura dos cartões do desenho do app, a partir do `DesenhoDoApp` que `noApp` devolve: para cada
  `Box` de key `c<i>`, o filho direto que tem `borderStyle` (o cartão), com o texto da primeira linha
  dele (o mesmo texto que `linhas` dá para o `Box key="r<i>"`), o fundo (`backgroundColor`), a borda
  (`borderColor`), o estilo da borda (`borderStyle`) e quantos cartões há em volta dele;
- o mesmo para o cabeçalho, lido das props do `Box key="head"` (o elemento já está em
  `d.cabecalho.el`);
- um leitor da transparência de uma cor: o alfa de um `rgba(r,g,b,a)`, ou nada para qualquer outro
  texto (chave de tema, nome, hex).

Nenhuma função existente do kit muda. O arquivo muda, então precisa de selo novo (item 5).

### Testes novos, em `task-tree/tests/visual.test.ts`

Os dois citam o cenário novo `visual.cartao-e-cabecalho-destacados` (item 5).

1. Nome: `no app, o cartão de sessão e o de subagente têm fundo e borda próprios`
   - Roteiro: relógio fixo; host com uma filha de nome próprio e uma tarefa aberta; um subagente
     lançável; pedido; plano com duas tarefas; a primeira iniciada; sessão filha aberta e o aviso do
     app; um subagente lançado com uma descrição própria. Desenho lido com `noApp`.
   - Afirma: há um cartão cuja primeira linha traz o nome da filha e outro cuja primeira linha traz a
     descrição do subagente; em cada um, o estilo da borda é `round`, o fundo é uma cor crua
     translúcida (alfa maior que 0 e menor que 1), a borda também, e o alfa da borda é maior que o do
     fundo.
   - Por que falha hoje: a borda vem indefinida (`CARD` não tem `borderColor`, `desktop.tsx:301`) e o
     fundo é o texto `userMessageBackground`, que não é cor crua translúcida.
   - Não afirma que cartões de níveis diferentes têm o mesmo fundo (isso é do ajuste do contraste por
     nível).
2. Nome: `no app, o cabeçalho tem o mesmo fundo e a mesma borda do cartão`
   - Roteiro: o da filha do teste anterior, sem o subagente.
   - Afirma: o cabeçalho tem estilo de borda `round`, fundo e borda em cor crua translúcida, e os dois
     valores são iguais aos do cartão da filha (o cartão que não está dentro de outro).
   - Por que falha hoje: a borda do cabeçalho vem indefinida (`head.tsx:104`) e o fundo não é cor crua
     translúcida. A igualdade sozinha passaria hoje (os dois têm o mesmo fundo errado e nenhuma
     borda), por isso o teste afirma também a transparência.

O implementador prova a falha rodando os dois testes contra o código de hoje antes de mexer em
`desktop.tsx` e `head.tsx`.

### Testes existentes

- Nenhum teste existente muda de texto.
- `golden.test.ts` não muda; os 4 testes dele passam a falhar até a aprovação do desenho (item 7). É o
  esperado e não se corrige no teste.

## 5. Catálogo (`regras/visual.md`) e selos

### Cenário novo

- Id: `visual.cartao-e-cabecalho-destacados`.
- Título: o cartão de sessão, o de subagente e o cabeçalho se destacam do painel, com fundo próprio e
  borda visível.
- Dado: um cartão de sessão filha, um de subagente e o cabeçalho, no app desktop.
- Quando: o painel é desenhado.
- Então: cada um tem um fundo e uma borda arredondada de cor própria, em cinza translúcido, que
  clareia o painel escuro e escurece o claro sem o mod saber o tema; a borda é mais forte que o fundo;
  o cabeçalho usa o mesmo fundo e a mesma borda do cartão.
- Origem: decisão do usuário, 2026-11-13 ("nao aparece nenhum card"; para o cabeçalho: "Sim, junto do
  cartão (Recomendado)"). Referência: o desenho em SVG anterior (fundo `#20201f` e borda `#373736` no
  escuro, `#f9f9f7` e `#e1e1df` no claro; "calcule qual seria a terceira cor", "use a mesma cor da
  borda"). Mais o commit da correção.
- Sem linha `Código:` (o código da área já tem `draw/desktop.tsx` e `draw/head.tsx`).
- Estado: `coberto`, no mesmo commit dos testes.

### Cenários reescritos (ganham `Reescrito: 2026-11-13, decisão do usuário (...)`)

- `visual.cores-dos-temas` (checklist; origem "regra do painel", não é decisão do usuário): o texto
  "os textos e fundos usam as cores do tema do app" deixa de valer para o cartão e o cabeçalho.
  Reescrito com "nao aparece nenhum card": os textos usam as cores do tema; o fundo e a borda do
  cartão e do cabeçalho, o trilho das barras e a faixa sem chave de tema são cores cruas translúcidas,
  que assentam nos dois temas; os `Svg` levam as suas. Segue `checklist`.
- `visual.cabecalho-em-cartao` (checklist): reescrito com "Sim, junto do cartão (Recomendado)": o
  cabeçalho usa o mesmo fundo e a mesma borda translúcidos do cartão. Segue `checklist`.
- `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente` (cobertos pelo golden): uma linha `Reescrito:` em cada um, como nas
  mudanças anteriores do desenho: o cartão e o cabeçalho ganham fundo e borda translúcidos; o golden é
  regravado com a validação dele no app. O check não exige essas linhas (o teste do golden não muda);
  elas seguem o costume do catálogo.

### Selos (rodados pelo implementador, depois de escrever os testes e o kit)

    npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cartão de sessão e o de subagente têm fundo e borda próprios" --tipo novo --motivo "cartão destacado do painel: fundo e borda próprios (decisão do usuário, 2026-11-13: nao aparece nenhum card)"

    npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cabeçalho tem o mesmo fundo e a mesma borda do cartão" --tipo novo --motivo "cabeçalho com o fundo e a borda do cartão (decisão do usuário, 2026-11-13: Sim, junto do cartão)"

    node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo refatoracao --motivo "leitura.ts ganha a leitura do fundo e da borda dos cartões e do cabeçalho do app; nada do que existia muda"

O script aceita qualquer tipo para o kit; `refatoracao` é o que descreve (só acréscimo). O selo anterior
de `cenario.ts`, também de acréscimo, usou `novo`: qualquer um dos dois passa no check.

Se o nome de um teste mudar na implementação, a chave do selo muda junto.

O selo do golden não é do implementador: ver o item 7.

## 6. Documentação

- `task-tree/DESENVOLVIMENTO.md`, seção "Desenho nativo híbrido (2026-11-13)": um item novo com a
  causa (a chave `userMessageBackground` não tem correspondente no desktop: fundo igual ao do painel e
  borda padrão `#222222` sobre `#191919`, medidos no print), os dois valores, a conta nos dois temas e
  o motivo de ser cor translúcida (o mod não sabe o tema). Na lista de módulos (linhas 74-76), o trecho
  "os cartões de sessão são `Box` com borda" ganha "e fundo translúcido".
- As medidas do harness citadas nessa seção ("principal ... 15 151 B", "filha ... 16 625 B") crescem
  cerca de 40 bytes por cartão e pelo cabeçalho; se o implementador as medir de novo, atualiza; se não,
  ficam como estão.
- `CLAUDE.md`, "Checklist do app", item do desenho nativo: onde diz "cores cruas (`rgba(...)`) e as
  chaves de tema nos dois temas", acrescentar o fundo e a borda do cartão e do cabeçalho destacados do
  painel, e o cartão dentro de cartão.
- Nada em `task-tree/text/rules.ts` (não é regra de uso do painel).

## 7. O que o check deve acusar depois

Com o código, os testes novos, o kit, o catálogo e os três selos do item 5 no lugar:

- `regras`, `travas`, `selos`, os dois `validate` e o `tsc`: passam.
- `claude plugin test task-tree`: os dois testes novos passam; os 4 testes do golden falham com
  "o desenho de envios|filha|principal|subagente mudou (valide no app antes de aprovar)". Em cada
  cenário muda só isto:
  - o `Box key="head"`: `backgroundColor` deixa de ser `userMessageBackground` e vira o fundo novo, e
    aparece a prop `borderColor` (os 4 cenários);
  - cada `Box` de cartão, as mesmas duas props: 1 cartão em `filha`, 1 em `envios`, 3 em `subagente`,
    nenhum em `principal`.
  - Nenhum texto, key, `alt`, fonte de `Svg` ou número de nós muda.
- O commit fica bloqueado até o usuário validar no app (regra do `CLAUDE.md`, "Golden do desenho"). Com
  o "funcionou" dele, quem cuida da aprovação roda
  `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", AAAA-MM-DD"`, e o commit segue com
  o código, os testes, o kit, o catálogo, `desenho.ts` e `selos.json`. A etapa `regressao` só aceita a
  falha do golden de `HEAD` com o desenho aprovado no mesmo dia.
- O implementador não roda `golden:aprovar` nem faz commit.

## 8. Checklist do app (o que o harness não vê)

Nos dois temas, com uma sessão filha e um subagente no painel:

1. O cartão de sessão, o de subagente e o cabeçalho têm um fundo um tom à parte do painel (mais claro
   no escuro, mais escuro no claro) e a borda arredondada se vê sem esforço.
2. O cabeçalho e o cartão têm o mesmo fundo e a mesma borda.
3. O cartão de subagente dentro do cartão de sessão: o fundo dele soma um tom ao do cartão de fora; a
   borda dos dois se vê.
4. O cartão de uma linha só (subagente concluído, cartão recolhido) fica legível, com os cantos
   inteiros.
5. No cabeçalho: a faixa de estado segue encostada na borda esquerda, com o canto arredondado; as
   pílulas e a barra seguem legíveis sobre o fundo novo.
6. O realce dos botões (ícone, busto, anel) continua visível sobre o fundo do cartão.
7. Nada pisca; a recarga a quente mostra o desenho novo sem "reload failed".

Se o cartão aparecer igual ao de hoje (sem fundo, borda quase invisível), o app não pinta `rgba()` em
`Box`: vale a contingência do item 9. Se só o fundo ou só a borda aparecer, anotar qual.

## 9. Riscos e interações

### O app pintar `rgba()` em `Box` é dedução

É o único ponto do plano que só o app confirma. Conferência barata antes de implementar, sem mexer em
nada: o mod já manda `rgba(136,135,128,0.25)` como fundo do trilho das barras das linhas
(`desktop.tsx:238`). Numa linha com contagem parcial (por exemplo "1/3"), o trilho cinza aparece atrás
da parte verde? Se aparece, o app pinta `rgba()` em fundo de `Box` e o plano segue. O mesmo vale para a
faixa do cabeçalho em "aguardando" (âmbar claro, `head.tsx:40`). Nos dois prints da pasta todas as
barras estão cheias e a faixa é verde, por isso não deu para conferir neles.

Contingência, se o app não pintar `rgba()`:

1. Os mesmos valores em hex com alfa (`#8887800f` e `#88878038`): o kit cita hex como cor crua. Muda só
   o texto das duas constantes e o leitor de transparência do kit.
2. Se nenhuma cor crua for pintada: a borda por chave de tema, `borderColor="inactive"` com
   `borderDimColor`, o mesmo mecanismo das pílulas, que o print mostra pintado; fica mais forte que a
   referência. O fundo, nesse caso, só com um `Svg` por baixo do cartão com as classes de claro e
   escuro (as cores antigas), o que pede análise própria (altura do cartão em células contra px do
   `Svg`) e contraria o espírito de "somente o que for obrigatório em SVG": vira pergunta ao usuário.

### Cartão dentro de cartão soma o tom

Com fundo translúcido e as mesmas props em todo cartão, um cartão dentro de outro fica um passo além:
`#262625` no escuro e `#f1f1f0` no claro (borda `#3b3b39` e `#dadad8`). No desenho em SVG todos os
níveis tinham o mesmo fundo opaco. É efeito colateral da cor translúcida, não uma escolha deste ajuste;
o contraste por nível é de outro ajuste, que pode manter, reforçar ou anular esse passo (um cartão de
dentro sem fundo próprio volta ao comportamento antigo).

### Série com os ajustes 2, 3 e 4

- Todos mexem em `desktop.tsx` e regravam o golden. Este ajuste toca só a constante `CARD` (duas
  props e um export), a linha do `Box key="head"` e comentários; não toca `desktopTree`, `cells`,
  `iconCell`, paddings nem larguras. Um ajuste seguinte que mude o espaçamento de `CARD` encontra as
  cores já lá, na mesma constante.
- A leitura dos cartões no kit (com o nível de aninhamento) serve ao ajuste do contraste por nível. Se
  aquele ajuste trocar o fundo por algo que não seja `rgba()` translúcido, o primeiro teste novo daqui
  muda com selo de decisão.
- Cada ajuste deixa o golden diferente do aprovado; a aprovação é do usuário, uma vez por validação.
  Se os quatro forem validados juntos, o golden é aprovado uma vez só, no fim.

### Tamanho do desenho

Cerca de 40 bytes a mais por cartão e pelo cabeçalho. Não pesa no limite de 600 KB, e props não contam
no limite de 95 000 caracteres de texto.

### Fora deste ajuste (notado, sem mexer)

- No print, o conector `└─` da faixa à esquerda do cartão do subagente termina antes da borda do
  cartão, com um vão (guias e recuo: outro ajuste).
- O cartão não tem respiro vertical (`paddingY: 0`): a primeira linha encosta na borda de cima
  (espaçamento interno: outro ajuste).
- `effortUltra` (a cor de "ultracode", `desktop.tsx:160` e `head.tsx:148`) também está fora da lista de
  chaves do kit, como `userMessageBackground`; pode não sair roxo no app. É do cenário
  `ultracode.cor-e-corte` (checklist), fora deste ajuste.

## 10. Bloqueio

Nenhum. As decisões registradas que tocam o assunto ("calcule qual seria a terceira cor", "use a mesma
cor da borda", "Sim, junto do cartão (Recomendado)", "migrar todo o Mod para o hibrido de nativo e
mantendo somente o que for obrigatório em SVG") são seguidas: o fundo e a borda reproduzem a referência
com até 2 níveis de diferença por canal, em componentes nativos, sem `Svg` novo.
