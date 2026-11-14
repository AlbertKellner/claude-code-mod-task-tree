# Pendência 2: histórico aberto no corte (B) e o "Voltar" do aviso de painel grande (A): plano

Planejador: só leitura. Base: `d3b1078` (ponta de `fix/pendencias-auditoria`, árvore limpa; o item 3 já
está nesse commit). Nada foi editado no repositório.

## Essencial

- **B (histórico aberto cortado): bug confirmado.** A linha "+N pedidos anteriores" é a primeira linha
  do desenho, sozinha num bloco de nível 0. Qualquer corte que tira blocos do começo (as 400 linhas ou
  o laço de tamanho/texto) a leva junto. O próprio teste de 2026-11-13 já contorna isso: ele fecha a
  linha pelo terminal porque no desktop ela some.
  Correção em `draw/layout.ts` (`limitRows`): a linha de um histórico aberto, com as linhas acima dela
  (as mães), nunca é cortada. Em `hooks/render.tsx` há um ajuste no laço de tamanho, para ele terminar
  sempre.
- **A (aviso e "Voltar"): o aviso só aparece com um texto enorme que o corte não tira**, porque o laço
  reduz o desenho até 2 linhas antes de desistir. Na prática, é o título (sem limite de tamanho) da
  tarefa de nível 1 do cabeçalho, que vai duas vezes no desenho: no texto e no `alt` da barra. Fechar
  linhas não muda esse tamanho, por isso o "Voltar" de hoje nunca tem efeito: sem nada aberto, ele
  nem escreve nada.
  Correção em `hooks/render.tsx`: o "Voltar" continua fechando o que a pessoa abriu e passa também a
  ligar uma marca. Com ela, um desenho que não cabe volta com os textos longos encurtados em "…", em
  vez do aviso. Quando o desenho inteiro volta a caber, os textos voltam inteiros.
  Recomendo, na mesma parte, que o aviso também apareça quando o que não cabe é o texto (95 000
  caracteres): hoje esse caso dá um painel quase vazio, sem aviso e sem botão.
- Arquivos do mod: `task-tree/draw/layout.ts` (B), `task-tree/hooks/render.tsx` (B e A). Mais
  `regras/cabecalho.md`, `regras/selos.json`, `task-tree/tests/cabecalho.test.ts` e
  `task-tree/DESENVOLVIMENTO.md`. O kit não muda e o golden não muda.
- Ordem recomendada: **B primeiro, depois A**, num commit cada. A descrição de A ("o que sobra no
  desenho de 2 linhas") já conta com as linhas que B preserva, e o ajuste do laço vem com B.
- Sem BLOQUEIO. Há um ponto para a orquestradora confirmar, que não bloqueia: o aviso também por texto
  (A, passo 3). Ver "Decisões tomadas neste plano".

---

## Parte B. O corte deixa à vista a linha do histórico aberto

### B.1 Causa (confirmada no código)

- `draw/layout.ts:1413–1427`: a linha `+N pedidos anteriores` (chave `${scope}sec:turns`, `fold`) é
  empurrada na profundidade `top` como a **primeira** linha da lista do grupo principal; no painel de
  cima, `top = 0` e nada vem antes dela (`draw(main, base)` em `:1612`, depois loose e turns). Aberta, ela
  é seguida dos pedidos antigos e dos atuais, cada pedido um bloco de nível 0.
- `draw/layout.ts:718–737` (`limitRows`): acima do limite, `from` é o primeiro índice de nível 0, **maior
  que 0**, a partir do qual o resto cabe; devolve `[+N linhas anteriores, ...rows.slice(from)]`. O índice
  0 (a linha do histórico) sempre sai. No ramo do último bloco sozinho, `last > 0` também tira o índice 0.
  Num cartão de sessão, a linha do histórico do cartão (`<escopo do cartão>sec:turns`, mais funda) sai
  com o bloco inteiro do cartão quando ele é antigo, ou no fim cortado ("+N linhas") quando o cartão
  está no último bloco.
- O laço de tamanho e texto (`hooks/render.tsx:353–376`) chama o mesmo `limitRows` com `maxRows` menor:
  abrir o histórico numa sessão longa passa de 600 KB ou de 95 000 caracteres, e o laço corta. É o caso
  comum desde 2026-11-12.
- Prova escrita: `tests/cabecalho.test.ts:316–336`. O comentário da linha 323 diz que a linha "é aberta
  e fechada pelo terminal, que a desenha inteira": no desktop cortado ela não existe. No terminal, o
  teste das linhas 217–233 abre o histórico e o desenho começa por "+N linhas anteriores". Pela conta
  (1 + 329 + 329 + 4 = 663 linhas; `from` = 330), a linha do histórico está dentro dessas 330.
- Por dedução (o harness não chega lá): o ✉/▸ de fora não alcança. O mapa `actions` nunca é limpo, então
  um aperto por chave ainda fecharia o histórico, mas a pessoa não tem onde clicar.

### B.2 O que muda

**`draw/layout.ts`, `limitRows(rows, max)`:**
1. Antes de cortar, marcar as **linhas preservadas**: cada linha de histórico aberto (a chave termina em
   `sec:turns` e `fold.open === true`) e as suas mães. A mãe de uma linha é a linha anterior mais próxima
   com profundidade menor; sobe-se até a profundidade 0. No painel de cima, é só a própria linha (nível
   0). Num cartão, são o pedido, a tarefa ou tarefas, o cabeçalho do cartão e a linha.
2. Sem linha preservada, o resultado é **idêntico** ao de hoje. Esse é o critério de não regressão.
3. Ramo com `from` (cortar blocos antigos inteiros): `from` passa a ser o primeiro índice de nível 0,
   maior que 0, em que (linhas a partir dele) + (preservadas antes dele) ≤ `max − 1`. O resultado fica:
   - "+N linhas anteriores", com N = linhas antes de `from` menos as preservadas (N ≥ 1 sempre: se não,
     tudo caberia e não haveria corte);
   - as preservadas antes de `from`, na ordem original;
   - `rows.slice(from)`.

   A linha de contagem continua sendo a **primeira**. Assim o teste selado das linhas 217–233
   (`desenho[0]` = "+N linhas anteriores") segue valendo sem mudança.
4. Ramo do último bloco sozinho: `head` passa a ser
   - "+N linhas anteriores", com N = `last` menos as preservadas antes de `last`, só se N > 0;
   - seguido das preservadas antes de `last`.

   No bloco: K linhas do começo, mais as preservadas do bloco que ficam depois dessas K (na ordem), mais
   a linha "+M linhas". K é o maior valor com total ≤ `max`, e M = linhas do bloco − K − as preservadas
   depois de K.
5. Se as preservadas sozinhas passam de `max` (só com `max` muito pequeno, no laço de tamanho), elas
   ficam assim mesmo, porque a decisão diz "sempre". O desenho pode então passar de `max`, mas só por
   elas. Nas 400 linhas isso não acontece na prática: cada histórico aberto preserva de 1 a ~5 linhas.
6. Contas exatas: (linhas desenhadas) + (soma dos `cut`) = linhas antes do corte. O `all` do render e o
   mapa `fitted` dependem disso.
7. Atualizar o comentário de `MAX_ROWS`/`limitRows` (`:712–716`) com a regra nova e a origem.

**`hooks/render.tsx`, o laço (`:370–376`):**
- Hoje o novo máximo é `max(2, min(drawn.rows − 1, …))`. Isso só garante a queda porque hoje
  `drawn.rows ≤ max` sempre. Com as preservadas, `drawn.rows` pode passar de `max`, e o laço poderia
  subir o máximo ou não terminar.
- Trocar `drawn.rows − 1` por "o menor entre `max` e `drawn.rows`, menos 1": o máximo cai a cada volta.
  Hoje as duas contas dão o mesmo valor, então nada muda nos testes atuais.
- Atualizar o comentário do laço (`:338–349`).

**Comportamento no painel:** com "+N pedidos anteriores" aberto numa sessão longa, o painel mostra
"+X linhas anteriores", depois "▾ +N pedidos anteriores" e depois os pedidos recentes. Um clique no ▾
fecha o histórico, e o painel volta sem o corte, ou com o corte comum. Num cartão, a linha do histórico
aberto do cartão aparece com o cartão e a tarefa de origem acima dela.

### B.3 Impacto

`npm run impacto -- task-tree/draw/layout.ts task-tree/hooks/render.tsx`:
- `render.tsx` é núcleo: todos os 162 cenários e "Fora do mapa: nenhum";
- golden: os 4 cenários (principal, filha, envios, subagente), que não mudam (poucas linhas, nada
  aberto, nenhum corte);
- checklist do app citado: `cabecalho.aviso-de-painel-grande-volta` e os `visual.*`/`subagentes.*` de
  sempre.

O relato da implementação roda `npm run impacto` sobre o diff real.

### B.4 Testes novos (`task-tree/tests/cabecalho.test.ts`, no fim, reaproveitando `pedidoPesado`, `pedidoPequeno`, `cortado`, `grande`, `kb`, `LIMITE`)

Os dois citam `// Regra: cabecalho.corte-preserva-historico-aberto` e usam `{ timeoutMs: 15000 }`, como os
vizinhos. Importar `montarNoApp` e `linha` do kit. A importação de `./kit/leitura` está numa linha que os
testes selados usam: acrescentar um import à parte, para não mexer no hash deles.

1. **`com "+N pedidos anteriores" aberto, o corte por tamanho deixa a linha à vista, e um clique nela fecha o histórico`** (desktop)
   - Roteiro: `fixar`, `host(on, [])`, `pedidoPesado($, relogio, 0)`, `pedidoPequeno($, relogio)`;
     `m = montarNoApp($)`; apertar `fold:sec:turns` (a key do `Button` da linha de seção no desktop,
     `draw/desktop.tsx:280`).
   - Afirma, aberto:
     - sem aviso;
     - bytes ≤ `LIMITE`;
     - "+N linhas anteriores" presente;
     - uma linha com "+1 pedidos anteriores" presente, e a linha seguinte à de contagem é ela;
     - essa linha tem o botão `fold:sec:turns` (`linhaDoApp(d, …).botoes`);
     - "Pequeno um" presente.
   - Aperta `fold:sec:turns` de novo e afirma:
     - sem "+N linhas anteriores";
     - "Pequeno um" presente;
     - nenhuma linha "U0".
   - `m.fim()`.
   - Falha hoje porque a linha "+1 pedidos anteriores" não está no desenho aberto.
2. **`com "+N pedidos anteriores" aberto, o corte das 400 linhas deixa a linha à vista, logo depois de "+N linhas anteriores"`** (terminal)
   - Roteiro igual ao do teste das linhas 217–233 (pedidos um e dois `grande('U'|'D', 8, 8, 4)`, pedido
     três pequeno), com `m = montar($)` e `m.recolher('+1 pedidos anteriores')`.
   - Afirma:
     - desenho (sem cabeçalho) ≤ 400 linhas;
     - `desenho[0]` casa "+N linhas anteriores";
     - `desenho[1].titulo` = "+1 pedidos anteriores", com ▾ no texto;
     - "Pequeno um" presente;
     - N + linhas desenhadas − 1 = total do painel aberto (opcional, se a conta ficar clara).
   - Depois `m.recolher('+1 pedidos anteriores')` (hoje lança "sem ícone para recolher", porque a linha
     não existe) e afirma que ela aparece com ▸.
   - `m.fim()`.
   - Falha hoje no `desenho[1]`.
3. Opcional: o histórico aberto **num cartão** de filha, cortado. O roteiro é pesado: uma filha com mais
   de 3 rodadas publicadas, ligada a uma tarefa de um pedido antigo, mais pedidos novos para forçar o
   corte. Se couber no kit sem mudá-lo, cobrir. Se não, fica no checklist do app (abaixo).

Testes existentes: **nenhum muda**. Os que abrem o histórico com corte (linhas 217–233 e 316–336) passam
com a ordem escolhida (contagem primeiro). Os demais não têm histórico aberto, então o resultado é
idêntico.

### B.5 Catálogo e selos

**Novo, em `regras/cabecalho.md`**, depois de `cabecalho.historico-abre-com-clique`:
- id: `cabecalho.corte-preserva-historico-aberto`;
- título: "O corte do desenho deixa à vista a linha do histórico aberto.";
- Dado: "+N pedidos anteriores" aberto pela pessoa (no painel ou no cartão de uma sessão), e um desenho
  que passa do limite de linhas, de tamanho ou de texto;
- Quando: é desenhado;
- Então: a linha "+N pedidos anteriores" continua no desenho, com ▾, logo depois de "+N linhas
  anteriores" (num cartão, com o pedido, a tarefa e o cartão acima dela), e um clique nela fecha o
  histórico; o resto é cortado como antes;
- Origem: decisão do usuário, 2026-11-13 ("Preservar a linha (Recomendado)");
- `Código: draw/layout.ts, hooks/render.tsx`;
- `Estado: coberto`.

**`cabecalho.limite-de-linhas-do-desenho`**: o texto não precisa mudar, porque nenhum teste dele muda.
Opcional: acrescentar ao Então "a linha de um histórico aberto fica (ver
`cabecalho.corte-preserva-historico-aberto`)", com
`Reescrito: 2026-11-13, decisão do usuário ("Preservar a linha (Recomendado)")`.

Selos:
- `npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com \"+N pedidos anteriores\" aberto, o corte por tamanho deixa a linha à vista, e um clique nela fecha o histórico" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"Preservar a linha (Recomendado)\""`
- `npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::com \"+N pedidos anteriores\" aberto, o corte das 400 linhas deixa a linha à vista, logo depois de \"+N linhas anteriores\"" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"Preservar a linha (Recomendado)\""`

(As aspas duplas dentro do nome vão escapadas no PowerShell/Bash. Se o script reclamar, usar aspas
simples por fora, como na nota da correção do achado alto 12.)

### B.6 Documentação

`task-tree/DESENVOLVIMENTO.md`:
- no parágrafo do limite de linhas (`:1104–1110`), acrescentar que a linha de um histórico aberto e as
  mães dela ficam, depois de "+N linhas anteriores";
- no parágrafo do render (`:598–607`), acrescentar que o laço baixa o máximo a cada volta;
- no fim, uma entrada nova de histórico, "Histórico aberto no corte (2026-11-13)", com as palavras do
  usuário.

O `CLAUDE.md` não muda.

### B.7 Golden

Não muda.

### B.8 Checklist do app

- Numa sessão longa (a orquestradora), abrir "+N pedidos anteriores": o painel aparece cortado, com "+X
  linhas anteriores" e logo abaixo "▾ +N pedidos anteriores"; o clique no ▾ fecha, nos dois temas.
- Num cartão de filha com histórico aberto, num painel cortado: a linha aparece dentro do cartão, com a
  faixa e as guias contínuas.

### B.9 Riscos

- Guias no desktop: entre as linhas preservadas e o começo do recorte há linhas que faltam. As guias e
  os cartões são montados pela profundidade (`desktopTree`, `draw/desktop.tsx:444`), como no corte de
  hoje. Conferir no checklist.
- Ordem: a contagem vem antes da linha preservada, embora as linhas contadas estivessem depois dela. Foi
  escolhida para não mexer em teste selado. A ordem original (o histórico primeiro) exigiria reselar o
  teste das linhas 217–233 como decisão.

---

## Parte A. O aviso "Painel grande demais" e o botão "Voltar"

### A.1 Quando o aviso ainda aparece hoje (confirmado no código)

- `hooks/render.tsx:370–376`: enquanto `over()` (bytes > 600 KB, ou no desktop texto > 95 000
  caracteres) e `max > 2`, o desenho é refeito com menos linhas. O laço só para em `max = 2`.
- `:378`: o aviso sai só se **`drawn.size > DRAW_LIMIT`** depois disso. O texto sozinho nunca dá aviso.
- Com `max = 2`, `limitRows` devolve no máximo 2 linhas (`layout.ts:718–737`):
  - duas linhas de contagem, ou a contagem e a última linha de nível 0 (um cartão solto, um "+N cartões
    antigos", uma tarefa sem pedido);
  - ou, com um bloco só, a primeira linha dele (a linha do pedido, título cortado em 60/80 caracteres,
    `hooks/panel.ts:175`, `hooks/tools.ts:40`) e "+N linhas".
- O resto do desenho não depende do corte:
  - o cabeçalho, com o título da tarefa de nível 1 no `Text` (`draw/head.tsx:111`: `truncate-end` só
    corta na pintura, o título vai inteiro no desenho) e de novo no `alt` da barra (`render.tsx:297`,
    `head.tsx:122`);
  - a linha de erro das sessões (até 200 caracteres, `io/host.ts:36`).
- O título de uma tarefa não tem limite em lugar nenhum (`hooks/tools.ts`, `state/tasks.ts`, conferido
  por grep). **Conclusão:** o aviso só aparece quando um título enorme fica no que sobra: o do
  cabeçalho, ou o de uma linha das 2 restantes, ou, depois de B, o de uma linha preservada. São uns
  300 mil caracteres para passar de 600 KB, porque o título vai duas vezes no cabeçalho. Abrir o
  histórico já não leva ao aviso, como diz o cenário.
- Texto (dedução sobre o código e o harness): com um título de, por exemplo, 150 mil caracteres, os
  bytes ficam em ~300 KB, mas o texto passa de 95 000. O laço vai até 2 linhas e devolve o desenho
  **sem aviso**. O app desenha só os primeiros 100 000 caracteres, e o painel fica com o cabeçalho e
  nada mais, sem botão. É o mesmo "corte que não basta", sem rede.
- Terminal: só bytes (`textual` é falso). O cabeçalho leva o título uma vez, então o aviso pede ~600
  mil caracteres.

### A.2 Por que o "Voltar" de hoje não tem efeito (confirmado)

`closeOpened` (`render.tsx:29–35`) fecha os históricos abertos e, se não houver nenhum, as linhas
abertas:
- sem nada aberto, ele grava um objeto igual ao anterior, e o desenho seguinte é o mesmo aviso;
- com algo aberto, fechar só muda quais linhas sobram dentro das 2 do corte. O título enorme continua
  no cabeçalho, e o aviso volta.

Nos dois casos, o painel não volta.

### A.3 O que muda (`hooks/render.tsx`)

1. **Marca "encurtar"** no átomo das dobras (`folds`, chave de state `collapsed`, que já tem linha em
   `state/durability.ts:75`):
   - uma chave fixa, por exemplo `sec:short`, com `true`;
   - nenhum código lê as dobras por varredura, exceto `closeOpened`, que só olha os `false`. O layout lê
     chaves exatas.

   O botão "Voltar" faz, num só `update`, o que `closeOpened` faz hoje e mais esta marca. Assim a
   escrita sempre muda o state e o painel é redesenhado, como em qualquer clique de dobra (caminho que o
   harness já exercita).
2. **Textos encurtados** em `paint`, como parâmetro (por exemplo, `paint(maxRows, short)`): com `short`,
   o título de cada linha (`Row.title`) e o título do cabeçalho (`head`, que entra no `Text` e no `alt`)
   ficam em no máximo uma constante nova, por exemplo `SHORT_TEXT = 200` caracteres, terminando em "…".
   As chaves, os `nodes`, as contagens e o `sid` não mudam.
3. **Ordem do render:**
   - primeiro o laço de hoje, com os textos inteiros;
   - se não couber e a marca estiver ligada, o mesmo laço de novo com os textos encurtados, a partir de
     400 linhas. O mapa `fitted` fica separado por modo: a chave do painel ganha o modo, ou a segunda
     passada não lê nem grava `fitted`;
   - só se ainda não couber, o aviso.

   Com isso, quando o desenho inteiro volta a caber (o título enorme saiu do cabeçalho, a pessoa fechou
   algo), ele sai inteiro, sem "…". A marca fica nas dobras, mas só age quando o desenho inteiro não
   cabe. Num próximo caso raro da mesma sessão, o painel já vem encurtado, sem passar pelo aviso.
4. **Recomendado (bug da mesma rede): o aviso também por texto.** A condição do aviso (`:378`) passa de
   "bytes > 600 KB" para `over()` (bytes ou, no desktop, texto). O registro de depuração diz qual
   limite passou. O texto do aviso continua "Painel grande demais (N KB): mostrando só o essencial."; se
   a medida for o texto, pode dizer "N mil caracteres". O terminal não muda (`chars` é 0 ali).
5. Comentários: os de `closeOpened` (`:26–28`) e do laço/aviso (`:338–349`), com a decisão de 2026-11-13.

Custo: no caso raro com a marca ligada, cada desenho (a cada segundo, com uma tarefa rodando) faz o laço
inteiro e depois o encurtado. Isso vai até ~10 serializações de ~650 KB, alguns milissegundos.

**Comportamento no painel:**
- o aviso aparece só quando o desenho, reduzido a duas linhas, ainda não cabe;
- o "Voltar" fecha o que a pessoa abriu e traz o painel de volta, com as tarefas em andamento à vista e
  os textos muito longos encurtados em "…";
- quando o desenho inteiro volta a caber, os textos voltam inteiros.

### A.4 Impacto

Os mesmos arquivos de B (`render.tsx`, núcleo): todos os cenários, os 4 do golden (sem mudança), "Fora
do mapa: nenhum". Só A: `npm run impacto -- task-tree/hooks/render.tsx` dá o mesmo resultado (núcleo).

### A.5 Testes novos (`task-tree/tests/cabecalho.test.ts`)

Os dois citam `// Regra: cabecalho.aviso-de-painel-grande-volta`, que passa a `coberto`, com
`{ timeoutMs: 15000 }`. Um título enorme: `GIGANTE = 'G ' + 'x'.repeat(320000)` (bytes) e outro de
`150000` (texto).

1. **`um título enorme no cabeçalho leva ao aviso, e "Voltar" traz o painel de volta com os textos encurtados`** (desktop)
   - Roteiro:
     - `fixar`, `host(on, [])`, `pedido($, 'Pedido um')`;
     - `plan` com `[{ id: 'G', title: GIGANTE, children: [Folha um, Folha dois] }]`, depois
       `start(['g1'])`;
     - `m = montarNoApp($)`.
   - Afirma `d.aviso` verdadeiro.
   - `m.apertar('back')`. Afirma:
     - sem aviso;
     - bytes ≤ `LIMITE`;
     - uma linha "Folha um" (a tarefa em andamento);
     - o texto do cabeçalho com "…" e com menos de 1 000 caracteres.
   - Depois, `pedidoPequeno`-like: `fimDoTurno`, `pedido('Pedido dois')`, plano pequeno, `start(['p1'])`.
     Afirma:
     - o cabeçalho é "Plano pequeno";
     - sem aviso;
     - nenhuma linha de texto termina em "…".

     Isso prova que os textos voltam inteiros quando o desenho cabe.
   - `m.fim()`.
   - Falha hoje no passo do `back`: o aviso continua, porque `closeOpened` não muda nada.
2. **`um título que passa do limite de texto também leva ao aviso, e "Voltar" traz o painel de volta`** (desktop; só se A.3 passo 4 entrar)
   - Mesmo roteiro, com o título de 150 000 caracteres.
   - Afirma o aviso; depois do `back`, sem aviso e "Folha um" presente.
   - Falha hoje no primeiro passo: sem aviso, o desenho cai a 2 linhas e "Folha um" não aparece.
3. O terminal não precisa de teste novo.

Testes existentes: **nenhum muda**. Os três testes do corte por tamanho afirmam "sem aviso" em desenhos
que cabem, o que continua.

Riscos do roteiro:
- o harness desenha só os primeiros 100 000 caracteres de texto. O aviso e o botão vêm antes do título,
  e depois do "Voltar" os textos são curtos. Ler `bytes` pelo kit (`JSON` da raiz), não pelo texto;
- se o `plan` do kit recusar um título desse tamanho, usar o maior que ele aceitar e conferir que o
  cabeçalho passa de 600 KB (`bytes` antes do `back`).

### A.6 Catálogo e selos

**`cabecalho.aviso-de-painel-grande-volta`, reescrito:**
- título: "O aviso de painel grande tem um botão que traz o painel de volta.";
- Dado: o painel trocado pelo aviso "Painel grande demais", porque, mesmo reduzido a duas linhas, o
  desenho passa de 600 KB (no app desktop, também de 95.000 caracteres de texto). Isso só acontece com
  um texto enorme que o corte não tira, como o título da tarefa do cabeçalho;
- Quando: a pessoa aperta "Voltar à visualização anterior";
- Então:
  - o que ela abriu fecha (os históricos abertos; sem nenhum, as linhas abertas);
  - o painel volta, com as tarefas em andamento e os textos longos encurtados em "…" enquanto o
    desenho inteiro não couber;
  - quando ele volta a caber, os textos voltam inteiros;
  - na mesma sessão, um desenho grande demais já vem encurtado, sem o aviso;
- manter a Origem de 2026-11-04;
- `Reescrito: 2026-11-13, decisão do usuário ("Manter como rede (Recomendado)"): o aviso fica para o caso
  raro em que o corte não basta, e o botão sempre traz o painel de volta; desfaz o "Voltar" que só fechava
  o que foi aberto.`;
- `Código: hooks/render.tsx`;
- `Estado: coberto`.

**`cabecalho.limite-de-linhas-do-desenho`**: no fim do Então, "ele fica só para o desenho que, reduzido a
duas linhas, ainda passa de 600 KB" vira "… passa de 600 KB ou, no app desktop, de 95.000 caracteres de
texto". Acrescentar `Reescrito: 2026-11-13, decisão do usuário ("Manter como rede (Recomendado)")`. Se o
passo 4 de A.3 não entrar, este cenário não muda.

Selos:
- `npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::um título enorme no cabeçalho leva ao aviso, e \"Voltar\" traz o painel de volta com os textos encurtados" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"Manter como rede (Recomendado)\""`
- `npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::um título que passa do limite de texto também leva ao aviso, e \"Voltar\" traz o painel de volta" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"Manter como rede (Recomendado)\""`

### A.7 Documentação

`task-tree/DESENVOLVIMENTO.md`:
- no parágrafo do render (`:598–607`), trocar "com o botão que fecha o que a pessoa abriu" por o que o
  botão faz agora (fecha e liga os textos encurtados, `SHORT_TEXT`) e quando o aviso sai (bytes ou
  texto);
- uma entrada nova no fim, "O aviso como rede e o Voltar que sempre volta (2026-11-13)", com as palavras
  do usuário, o que o aviso ainda alcança (um título enorme) e por que o "Voltar" antigo não tinha
  efeito;
- as seções antigas de histórico (`:1096–1102`, `:1619–1629`) ficam como eram.

O `CLAUDE.md` não muda.

### A.8 Golden

Não muda: nenhum dos 4 cenários tem aviso nem texto longo.

### A.9 Checklist do app

- O aviso e o botão desenhados nos dois temas. O clique real em "Voltar à visualização anterior" traz o
  painel com "…" nos títulos longos. O harness aperta pela chave e não vê a pintura. Para provocar no
  app: um plano com um título de ~320 mil caracteres. É opcional; o usuário decide se quer ver.
- Depois que o título enorme sai do cabeçalho, os títulos voltam inteiros.

### A.10 Riscos

- A marca fica nas dobras até o fim da sessão. O reinício pode limpá-la, conforme a linha de
  durabilidade do `collapsed`. Depois do primeiro "Voltar", o caso raro não mostra mais o aviso, só o
  painel encurtado. É o que o "Então" diz.
- 200 caracteres por título bastam com folga. Se um dia houver centenas de linhas preservadas com títulos
  curtos e ainda assim passar, o aviso volta, e um novo "Voltar" fecha os históricos, que são a origem
  dessas linhas.

---

## Interações com os outros itens

- Item 1 (carta): outro planejador; toca envios e layout de cartas. Se a carta mexer em `layout.ts`
  perto de `limitRows`, rebasear. Não conflita na lógica.
- Item 3 (frase do lembrete): já em `d3b1078`; não toca estes arquivos.
- Entre A e B: os dois tocam `render.tsx`. Fazer B (com o ajuste do laço) e depois A. Cada commit roda
  `npm run check` inteiro.

## Decisões tomadas neste plano (sem BLOQUEIO)

- O que o "Voltar" faz para sempre ter efeito: fechar o que foi aberto, como hoje, mais os textos
  encurtados. A decisão de 2026-11-13 pede o efeito e deixa o meio em aberto. Alternativa descartada:
  "voltar ao último desenho que coube", que fica congelado e nem sempre existe.
- O aviso também por texto (A.3, passo 4): bug da mesma rede, recomendado. Se a orquestradora preferir
  não incluir, basta tirar esse passo, o teste 2 de A.5 e a reescrita de
  `cabecalho.limite-de-linhas-do-desenho`; o resto de A fica igual.
- Em B, a contagem vem antes da linha preservada, para não mexer em teste selado.
