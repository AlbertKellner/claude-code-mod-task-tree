# Pendência 2: aviso "Painel grande demais" com "Voltar", e histórico aberto cortado pelo teto (plano)

Planejador do item 2. Base: branch `fix/pendencias-auditoria`, ponta `1f9e8c1`. Só leitura do código;
nada foi executado além de `git log` e `npm run impacto`. Dois commits, um por parte.

Sem BLOQUEIO: nada aqui contraria decisão registrada. Três pontos que a orquestradora pode vetar estão
no fim ("Pontos de atenção"), cada um com o que muda no plano se for vetado.

Arquivos do mod que mudam: parte A, `task-tree/hooks/render.tsx`; parte B, `task-tree/draw/layout.ts` e
`task-tree/hooks/render.tsx`. Fora do mod, nas duas: `task-tree/tests/cabecalho.test.ts`,
`regras/cabecalho.md`, `regras/selos.json`, `task-tree/DESENVOLVIMENTO.md`. O kit não muda. O golden não
muda.

Ordem sugerida: A, depois B (a ordem inversa também funciona; as duas mexem no mesmo laço de
`render.tsx`, em pontos diferentes, ditos abaixo).

---

## Parte A. Aviso "Painel grande demais" e botão "Voltar"

Decisões: 2026-11-04, "coloque um botão para voltar a visualização anterior"; 2026-11-13, "Manter como
rede (Recomendado)" (ficam no código para o caso raro em que o corte não basta; o "Voltar" tem de
funcionar quando aparecer).

### A.1 Quando o aviso ainda pode aparecer hoje (causa confirmada)

Escrito no código:

- O aviso só sai em `hooks/render.tsx:378`, com a condição `drawn.size > DRAW_LIMIT` (600 KB do JSON do
  desenho), depois do laço de corte (`render.tsx:370–376`).
- O laço refaz o desenho com menos linhas enquanto passa de 600 KB ou, no app desktop, de 95 000
  caracteres de texto (`TEXT_LIMIT`, `render.tsx:45`, `over()` em `:352`), e só para quando cabe ou
  quando o limite de linhas chega a 2 (`max > 2`). Cada volta diminui o limite (o novo é no máximo
  `drawn.rows - 1`, e `limitRows` nunca devolve mais linhas que o limite: `draw/layout.ts:718–737`),
  então ele sempre termina.
- Com limite 2, `limitRows` devolve no máximo duas linhas: as duas de contagem ("+N linhas anteriores" e
  "+N linhas"), ou a de contagem e a última linha de nível 0, ou a primeira linha do único pedido e
  "+N linhas".
- O título de tarefa não tem limite de tamanho: o schema da tool `plan` pede só `string`
  (`hooks/tools.ts:25–26`) e `state/tasks.ts:17` copia o título inteiro (só o `request` é cortado em 80,
  `tools.ts:40`).
- No app desktop o título vai duas vezes ao desenho: no cabeçalho, no `Text` e no `alt` da barra
  (`draw/head.tsx:111` e `:122`, com o `alt` montado em `render.tsx:293–303`); na linha, no `Text` e no
  `alt` do ícone (`draw/desktop.tsx:364` e `:284`, `rowAlt` em `draw/svg.ts:230–232`). O título do
  cabeçalho é o da tarefa de nível 1 corrente e não depende do que está aberto ou fechado
  (`render.tsx:261–267`).

Conclusão (dedução a partir do acima):

- Hoje o aviso só aparece quando o cabeçalho mais duas linhas ainda passam de 600 KB. Sem um texto
  gigante isso dá poucos KB (a medida do DESENVOLVIMENTO: 7 linhas, 15 KB). Só um texto sozinho de
  centenas de KB chega lá: no app, um título de nível 1 com cerca de 310 000 caracteres ou mais (duas
  vezes no cabeçalho); no terminal, cerca de 600 000. Número de linhas, históricos abertos e sessões
  longas não levam mais ao aviso: o corte resolve antes.
- O corte por texto não leva ao aviso: se, com duas linhas, o desenho passa de 95 000 caracteres mas
  não de 600 KB (um título entre cerca de 47 500 e 310 000 caracteres), `render.tsx:378` não dispara, o
  desenho vai como está e o app desenha só os primeiros 100 000 caracteres (as linhas depois do
  cabeçalho perdem o texto), sem aviso. É uma falha do último recurso: o limite de texto entrou no
  laço em 2026-11-13 e não entrou na condição do aviso.
- O "Voltar" (`closeOpened`, `render.tsx:29–35`) só fecha chaves que a pessoa abriu: os históricos
  (`…sec:turns` com valor `false`) ou, sem nenhum, as linhas com valor `false`. No único caso em que o
  aviso aparece hoje, a causa é um texto gigante, que não depende do que está aberto: sem nada aberto
  o botão regrava o mesmo conteúdo e nada muda; com um histórico aberto, ele fecha e o aviso continua.
  Ou seja: quando o aviso aparece, o botão quase nunca tem efeito.
- O harness alcança o aviso com um título gigante (não com planos comuns), então o cenário pode sair
  de `checklist` para `coberto`.

### A.2 O que muda (`task-tree/hooks/render.tsx`)

Comportamento novo, no painel:

1. O aviso aparece quando o corte não basta por qualquer um dos dois limites: o desenho que, com o
   limite de linhas no mínimo, ainda passa de 600 KB ou, no app desktop, de 95 000 caracteres de texto.
   Texto do aviso e do botão iguais aos de hoje.
2. "Voltar à visualização anterior" continua fechando o que a pessoa abriu (os históricos abertos; sem
   nenhum, as linhas abertas) e, na mesma gravação, liga uma marca "a pessoa pediu para voltar".
3. Com a marca ligada, quando o desenho normal não cabe, o painel é desenhado com os textos longos
   encurtados (200 caracteres e "…") no lugar do aviso, com o corte de linhas de sempre. Esse desenho
   cabe por construção (cabeçalho e linhas passam a ter tamanho limitado), então o botão sempre traz o
   painel de volta. Se ainda assim não couber (não há caso conhecido), o aviso continua como rede.
4. Quando o desenho normal cabe, nada muda: nenhum texto é encurtado, com a marca ligada ou não. A
   marca fica ligada (não há quem a desligue: o desenho não pode gravar estado); o efeito é que o aviso
   não volta a aparecer naquela sessão enquanto o desenho encurtado couber.

Mudanças, por função:

- `closeOpened` (`:29–35`): na mesma chamada de `update` do atom `folds`, além de fechar o que já fecha,
  grava a marca numa chave reservada do próprio atom, com valor `true` (sugestão de nome: `essential`,
  sem dois-pontos, para não colidir com chave de linha, que sempre tem prefixo `t:`, `T:`, `s:`, `g:`,
  `gg:`, `gl:` ou `sec:`). Com valor `true` ela não entra na lista de "abertas" do próprio
  `closeOpened` (que só olha valores `false`), e `setFold` a preserva (ele espalha o atom). Motivo de
  usar o atom e não uma variável de módulo: a gravação do atom é o que faz o painel ser desenhado de
  novo (é o mecanismo de todos os cliques do painel, no app e no harness); com o conteúdo igual, como
  hoje, não há garantia de novo desenho. Não cria chave de estado nova (nada muda em
  `state/durability.ts`).
- `paint` (`:246–337`): ganha um segundo parâmetro, "textos curtos". Quando ligado, logo depois de
  `layout(...)` cada linha passa por um corte dos seus campos de texto que vão ao desenho (`title`,
  `hint`, `meta`, `engine`, `label`, `whole`, o repositório e a branch de `git`, o nome em `ring`) e o
  título do cabeçalho (`head`) e o rótulo de git do cabeçalho passam pelo mesmo corte antes de montar o
  `alt` e o cabeçalho. Chaves (`key`, `fold.key`, `sid`) e `nodes` não são tocados: cliques e contagem
  ficam iguais. Vale para as duas superfícies (o corte é feito antes de escolher desktop ou terminal).
  O tamanho do corte é uma constante nova ao lado de `TEXT_LIMIT` (200).
- O trecho de `:350–377` (medida, memória `fitted`, laço) vira um procedimento que roda para um modo
  (normal ou textos curtos) e devolve o desenho; a chave da memória `fitted` passa a incluir o modo,
  para o limite que coube num modo não servir ao outro.
- No lugar de `:378`: roda o modo normal; se ao fim ele ainda passa de um dos limites (`over()`, não
  só os bytes) e a marca está ligada no atom já lido em `:221` (`chosen`), roda o modo de textos curtos;
  o aviso sai só se não há marca ou se o modo curto também não coube. O log de depuração continua só
  quando o aviso sai. `drawn.size` e `drawn.rows` ficam os do último desenho medido, como hoje.
- Comentários em inglês no estilo do arquivo, citando as palavras do usuário ("Manter como rede
  (Recomendado)", 2026-11-13) em `closeOpened` e no último recurso.

Custo: com a marca ligada e um texto gigante presente, cada desenho faz as tentativas do modo normal
(poucas) e uma do modo curto. Só no caso raro.

### A.3 Impacto

`npm run impacto -- task-tree/hooks/render.tsx`: núcleo tocado, todos os cenários cobertos (156
afetados; o check roda todos); checklist do app inteiro; golden: os 4 cenários (não mudam: são desenhos
pequenos, que cabem, e para eles o código novo devolve o mesmo desenho). "Fora do mapa: nenhum".

### A.4 Testes (em `task-tree/tests/cabecalho.test.ts`, no fim; o kit não muda)

Os dois citam `// Regra: cabecalho.aviso-de-painel-grande-volta` e usam `montarNoApp` (aperta `back` e
relê), com `{ timeoutMs: 15000 }`. Importar `montarNoApp` numa linha de import à parte, sem editar as
linhas de import que os testes selados usam.

1. `o aviso de painel grande, sem nada aberto, volta ao painel com os textos encurtados`
   - Roteiro: `fixar`, `host(on, [])`; um pedido com um plano de uma tarefa de nível 1 cujo título tem
     um começo legível e mais 330 000 caracteres simples (ASCII), com duas folhas de título curto; start
     numa folha.
   - Afirma: no app, o desenho é o aviso; depois de apertar `back`, não é mais o aviso, o desenho tem
     até 600 KB, uma linha mostra a folha, e o texto do cabeçalho tem o começo do título e menos de
     1 000 caracteres.
   - Falha hoje: sem nada aberto o `back` regrava o mesmo conteúdo e o desenho continua sendo o aviso
     (a asserção depois do `back`).
2. `o aviso vale também para o limite de texto, e "Voltar" fecha o histórico aberto`
   - Roteiro: `fixar`, `host(on, [])`; um pedido pequeno concluído, fim do turno; segundo pedido com um
     plano pequeno e start (aparece "+1 pedidos anteriores"); abrir essa linha pelo terminal (`montar` e
     `recolher`); no mesmo pedido, um plano novo com uma tarefa de nível 1 de título com 60 000
     caracteres e uma folha, start na folha.
   - Afirma: no app, o desenho é o aviso; depois de `back`, não é o aviso, a linha do histórico está
     fechada ("▸" e "+1 pedidos anteriores" no texto dela) e o plano do primeiro pedido não está no
     desenho; a folha do plano novo está; no terminal (`painel`), o plano do primeiro pedido também não
     aparece.
   - Falha hoje: com 120 000 caracteres de texto e cerca de 125 KB o aviso não aparece (a primeira
     asserção); o app receberia o desenho com texto além do que desenha.

Testes existentes: nenhum muda nesta parte. Se algum falhar, é regressão no código (parar e relatar).

Risco do roteiro: o título de 330 000 caracteres atravessa o state e o `fs.write` do stub várias vezes.
Se o harness recusar o tamanho, o implementador relata; o segundo teste (60 000) já prova o "Voltar"
no caso do texto, e o primeiro pode cair para o menor título que ainda passe de 600 KB com duas linhas.

### A.5 Catálogo (`regras/cabecalho.md`)

`cabecalho.aviso-de-painel-grande-volta`, reescrito e com `Estado: coberto`:

- Título: O aviso de painel grande é o último recurso, e o botão dele sempre traz o painel de volta.
- Dado um desenho que, com o corte de linhas no mínimo, ainda passa de 600 KB ou, no app desktop, de
  95.000 caracteres de texto (um título gigante no cabeçalho ou numa linha), com ou sem algo aberto
  pela pessoa
- Quando o painel é desenhado e a pessoa aperta "Voltar à visualização anterior"
- Então aparece o aviso "Painel grande demais" com o botão; apertado, o que a pessoa abriu fecha (os
  históricos abertos; sem nenhum, as linhas abertas) e o painel volta; se o desenho ainda não cabe, ele
  vem com os textos longos encurtados (200 caracteres e "…"), e o aviso não volta enquanto esse
  desenho couber
- Origem: mantém a de 2026-11-04.
- `Reescrito: 2026-11-13, decisão do usuário ("Manter como rede (Recomendado)"): o aviso e o botão
  ficam para o caso raro em que o corte não basta, por tamanho ou por texto, e o botão passa a ter
  efeito sempre (sem nada aberto ele não mudava nada).`
- `Código: hooks/render.tsx` (já tem).

`cabecalho.limite-de-linhas-do-desenho`: o fim do Então passa de "ainda passa de 600 KB" para "ainda
passa de 600 KB ou, no app desktop, de 95.000 caracteres de texto", com `Reescrito: 2026-11-13, decisão
do usuário ("Manter como rede (Recomendado)"): o último recurso vale para os dois limites do corte.`
Os testes dele não mudam (o selo é do corpo do teste, não do texto do cenário).

Selos (Git Bash, aspas simples por fora por causa das aspas no nome):

    npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::o aviso de painel grande, sem nada aberto, volta ao painel com os textos encurtados' --tipo novo --motivo 'decisão do usuário, 2026-11-13: "Manter como rede (Recomendado)"; o Voltar passa a ter efeito sempre'
    npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::o aviso vale também para o limite de texto, e "Voltar" fecha o histórico aberto' --tipo novo --motivo 'decisão do usuário, 2026-11-13: "Manter como rede (Recomendado)"; o aviso cobre o limite de texto e o Voltar fecha o histórico'

### A.6 Documentação (`task-tree/DESENVOLVIMENTO.md`)

- No "como é hoje" do desenho (perto de "A linha de aviso ('Painel grande demais', com o botão que
  fecha o que a pessoa abriu) fica como último recurso", linhas ~604–606): a condição (os dois
  limites), o que o botão faz e o modo de textos curtos.
- Na tabela de estado, linha de `collapsed` (~249): acrescentar a marca do "Voltar" (a chave reservada).
- Seção nova no fim, datada (2026-11-13), com a decisão nas palavras do usuário, quando o aviso aparece
  e o que o botão faz. As seções de histórico acima ficam como estão.
- `CLAUDE.md`: sem mudança.

### A.7 Golden

Não muda (nenhum dos 4 cenários chega perto dos limites; o desenho que cabe é o mesmo).

### A.8 Checklist do app

- O clique real no botão e o redesenho no app (o harness aperta pela chave).
- A pintura do aviso e do painel de textos curtos, nos dois temas.
- Só dá para ver com um título artificial (por exemplo, pedir a uma sessão um `plan` com um título de
  60 000 caracteres): aparece o aviso; "Voltar" traz o painel com o título encurtado; `/task-tree`
  mostra o tamanho do desenho. Sem esse ensaio, o item fica validado só pelo harness.

---

## Parte B. Histórico aberto e cortado pelo teto de linhas

Decisão: 2026-11-13, "Preservar a linha (Recomendado)": o corte sempre deixa visível a linha do
histórico aberto.

### B.1 Causa confirmada

Escrito no código:

- A linha do histórico é criada em `draw/layout.ts:1415–1427` (`body`): chave `<escopo>sec:turns`,
  tom `section`, `fold: { key, open }`, na profundidade do topo da lista, e é a primeira linha que
  `body` põe. No painel principal isso é a linha 0, profundidade 0 (`draw` chama `body` direto para o
  grupo principal, `:1552`). No cartão de uma sessão é a primeira linha dentro do cartão (`panel` em
  `:1267`), numa profundidade maior que 0.
- `limitRows` (`layout.ts:718–737`) não olha o que a linha é. No primeiro caso (`:722–723`) devolve a
  linha de contagem e as linhas a partir de um índice maior que 0: a linha 0 sai sempre. No segundo
  caso (`:726–736`), com o último bloco começando depois da linha 0, o começo inteiro vira a linha de
  contagem: a linha 0 sai também.
- O mesmo `limitRows` é chamado com limites menores pelo corte por tamanho (`render.tsx:247` e o laço
  em `:370–376`), então o histórico aberto também some no app quando o desenho passa de 600 KB ou de
  95 000 caracteres com menos de 400 linhas.

Confirmado pelos testes de hoje: em `cabecalho.test.ts:217–233`, com o histórico aberto, a primeira
linha do desenho é "+N linhas anteriores" (a do histórico não está); em `:316–336` o teste fecha o
histórico pelo terminal porque no app a linha foi cortada.

Dedução: o histórico de um cartão some do mesmo jeito quando o pedido do cartão é um dos blocos
tirados do começo, ou quando a linha fica depois do ponto em que o último pedido é cortado. Nesses
casos também não sobra onde clicar.

### B.2 O que muda

Comportamento novo, no painel: quando o corte de linhas age (pelas 400 linhas ou pelo tamanho), toda
linha de histórico aberta continua desenhada, com as linhas de que ela pende (nenhuma, no painel
principal; o pedido, a tarefa e o cartão, quando é o histórico de um cartão). A linha de contagem vem
logo depois delas. Exemplo no painel principal: "▾ +4 pedidos anteriores", depois "+N linhas
anteriores", depois os pedidos recentes. Um clique na linha fecha o histórico, e o desenho volta a
caber. Sem histórico aberto, o corte é idêntico ao de hoje.

`task-tree/draw/layout.ts`, `limitRows(rows, max)`:

1. Até `max` linhas, devolve as linhas como estão (igual a hoje).
2. Linhas fixadas: cada linha com `fold.open` verdadeiro e chave terminada em `sec:turns` (o mesmo
   sufixo que `closeOpened` usa em `render.tsx:32`), mais as ancestrais dela: andando para trás, a
   linha anterior mais próxima de cada profundidade menor, até a profundidade 0. Sem campo novo em
   `Row`. Teto de segurança: no máximo `MAX_ROWS - 3` linhas fixadas, na ordem do documento (na prática
   são de 1 a 6 por histórico aberto).
3. Sem linha fixada, o resultado é o de hoje, linha por linha.
4. Com F linhas fixadas, a escolha de hoje é feita com o orçamento diminuído de F:
   - primeiro caso: procura o primeiro início de bloco (profundidade 0, índice maior que 0) a partir do
     qual o resto cabe em `max - 1 - F` linhas;
   - segundo caso (não achou): o último bloco é desenhado do começo, com `max - 1 - F` linhas menos 1
     se houver linha de contagem do começo, nunca menos que 0.
5. Montagem, nesta ordem: as fixadas da parte cortada do começo; "+N linhas anteriores" (N = linhas
   do começo que não ficaram; sem a linha se N for 0); as linhas mantidas; no segundo caso, as fixadas
   que ficaram depois do ponto de corte e "+N linhas" (N = linhas do fim que não ficaram; sem a linha
   se N for 0). Linha fixada que já está entre as mantidas não se repete. O `cut` de cada linha de
   contagem é o N dela (o `render.tsx:249` soma esses valores).
6. Garantia: o resultado tem no máximo `max` linhas sempre que `max` é pelo menos F + 2 (com 400, sempre).
   Abaixo disso (só o corte por tamanho chega lá), o resultado são as fixadas e as linhas de
   contagem, e pode passar de `max`.
7. Atualizar o comentário acima de `MAX_ROWS` (em inglês, citando "Preservar a linha (Recomendado)",
   2026-11-13).

`task-tree/hooks/render.tsx`, o laço do corte por tamanho (`:370–376`, ou dentro do procedimento que a
parte A extrai): acrescentar uma parada: se uma tentativa desenhou mais linhas que o limite pedido
(só restam as fixadas e as de contagem), o laço termina. É obrigatório: hoje o laço confia em
"linhas desenhadas ≤ limite" para diminuir o limite a cada volta; sem a parada, com o resultado acima
do limite, o limite pode parar de diminuir e o desenho não termina (o painel trava). Depois do laço
nada muda: se cabe, desenha; se não cabe, é o aviso da parte A, cujo "Voltar" fecha os históricos (as
fixadas somem).

O que não muda: a contagem do cabeçalho (as ancestrais fixadas são pais abertos, com `nodes` vazio; uma
tarefa-folha com cartão conta a si mesma, como já conta quando desenhada); guias e cartões (a lista
continua sendo uma árvore em ordem, só com menos linhas; `guides`, `labelCols` e `desktopTree` não
mudam); a memória `fitted`.

### B.3 Impacto

`npm run impacto -- task-tree/draw/layout.ts task-tree/hooks/render.tsx`: núcleo tocado
(`hooks/render.tsx`), 162 cenários afetados, todos os cobertos; checklist do app inteiro; golden: os 4
cenários (não mudam: têm poucas linhas, e até `max` linhas `limitRows` devolve o mesmo). "Fora do mapa:
nenhum". Só `draw/layout.ts`: 109 cenários, entre eles todos os de `cabecalho.md`.

### B.4 Testes (em `task-tree/tests/cabecalho.test.ts`; o kit não muda)

Teste existente que muda, por decisão do usuário (2026-11-13, "Preservar a linha (Recomendado)"):

- `pedidos antigos saem inteiros do começo, contados em "+N linhas anteriores"` (`:217`). Hoje afirma
  que a primeira linha do desenho é "+N linhas anteriores". Passa a afirmar que a primeira é a linha
  do histórico aberto (título "+1 pedidos anteriores") e a segunda é "+N linhas anteriores"; o resto
  fica. Continua citando só `cabecalho.limite-de-linhas-do-desenho` (não acrescentar o cenário novo
  aqui: o selo de decisão exige `Reescrito:` em cada regra citada). Asserções: de 4 para 5. É o único
  teste existente que muda; na etapa `regressao`, o teste de `HEAD` falha contra o código novo e passa
  pelo selo de decisão.

Testes novos, os dois com `// Regra: cabecalho.corte-preserva-historico-aberto` e
`{ timeoutMs: 15000 }`:

1. `cortado pelo tamanho no app, "+N pedidos anteriores" aberto fica no desenho e fecha com um clique`
   - Roteiro: `fixar`, `host(on, [])`, `pedidoPesado($, relogio, 0)` e `pedidoPequeno($, relogio)` (os
     auxiliares que já existem no arquivo); `montarNoApp`; apertar `fold:sec:turns` (abre).
   - Afirma, aberto: não é o aviso; até 600 KB; a primeira linha do desenho tem o botão
     `fold:sec:turns` e "+1 pedidos anteriores" no texto; a segunda é "+N linhas anteriores"; "Pequeno
     um" está no desenho. Depois de apertar `fold:sec:turns` de novo: nenhuma linha "linhas anteriores"
     e "Pequeno um" continua.
   - Falha hoje: aberto, nenhuma linha do desenho do app tem o botão (a linha foi cortada), então não
     há onde apertar.
2. `o histórico aberto no cartão de uma filha fica à vista quando o corte tira o pedido dela`
   - Roteiro: `fixar`; `host` com uma filha (id no formato `local_<uuid>`, nome `filha-um`) que publica
     dois turnos: o turno 1 com cerca de 420 tarefas de nível 1 concluídas e o turno 2 com uma tarefa
     iniciada ("Atual da filha"); pedido um com um plano pequeno, start numa folha, `abrirSessao`,
     `aviso`; sem fim de turno, pedido dois com um plano pequeno ("Pequeno um") e start. O cartão mostra
     "+1 pedidos anteriores" (não há histórico no painel principal: são só dois pedidos, os dois com
     algo aberto). Abrir essa linha pelo terminal (`montar`, `recolher`).
   - Afirma, aberto: o desenho tem até 400 linhas; a linha "+1 pedidos anteriores" está lá, e também o
     cartão `filha-um`, a tarefa de onde ele pende e o plano dela; há uma linha "+N linhas anteriores";
     "Pequeno um" está. Depois de `recolher` de novo: nenhuma "linhas anteriores" e "Atual da filha"
     aparece.
   - Falha hoje: aberto, o pedido um sai inteiro do começo com o cartão, e a linha "+1 pedidos
     anteriores" não está no desenho (não há onde clicar).
   - O roteiro da filha não foi executado por mim (planejador só lê). Exemplos de filha com turnos:
     `sessoes.test.ts` (`deTurno`, `turnoDe`, `:519–536`). O implementador pode ajustar o roteiro,
     desde que o teste falhe no código de hoje pelo motivo dito. Importar `abrirSessao` e
     `montarNoApp` em linhas de import à parte.

Os outros testes de `cabecalho.limite-de-linhas-do-desenho` não mudam: os sem nada aberto não têm linha
fixada; o de `:316` lê a linha de contagem por busca, não pela posição, e fecha pelo terminal.

### B.5 Catálogo (`regras/cabecalho.md`)

Cenário novo:

    ### cabecalho.corte-preserva-historico-aberto
    O corte de linhas nunca tira a linha do histórico aberto.

    - Dado "+N pedidos anteriores" aberto pela pessoa, no painel ou no cartão de uma sessão, e um desenho que passa do limite de linhas (400, ou menos quando o tamanho pede)
    - Quando o corte tira os pedidos mais antigos ou o fim do último pedido
    - Então a linha "+N pedidos anteriores" continua desenhada, com as linhas de que ela pende (o pedido, a tarefa e o cartão, quando é a de um cartão), antes da linha de contagem, e um clique nela fecha o histórico

    Origem: decisão do usuário, 2026-11-13 ("Preservar a linha (Recomendado)").
    Código: hooks/render.tsx
    Estado: coberto

`cabecalho.limite-de-linhas-do-desenho`: no Então, depois de 'contados em "+N linhas anteriores"',
acrescentar "(a linha do histórico aberto fica, antes dela)"; e
`Reescrito: 2026-11-13, decisão do usuário ("Preservar a linha (Recomendado)"): com o histórico aberto, a linha dele continua no desenho, antes de "+N linhas anteriores".`

Selos (Git Bash):

    npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::pedidos antigos saem inteiros do começo, contados em "+N linhas anteriores"' --tipo decisao --motivo 'decisão do usuário, 2026-11-13: "Preservar a linha (Recomendado)"; a linha do histórico aberto fica antes de +N linhas anteriores'
    npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::cortado pelo tamanho no app, "+N pedidos anteriores" aberto fica no desenho e fecha com um clique' --tipo novo --motivo 'decisão do usuário, 2026-11-13: "Preservar a linha (Recomendado)"'
    npm run regras:selar -- 'task-tree/tests/cabecalho.test.ts::o histórico aberto no cartão de uma filha fica à vista quando o corte tira o pedido dela' --tipo novo --motivo 'decisão do usuário, 2026-11-13: "Preservar a linha (Recomendado)"'

### B.6 Documentação (`task-tree/DESENVOLVIMENTO.md`)

- No "como é hoje" do layout (~321–322, "`limitRows` corta em `MAX_ROWS` = 400…") e do desenho
  (~596–604, o corte por tamanho): a linha do histórico aberto e as ancestrais ficam; a parada nova do
  laço.
- Seção nova no fim, datada (2026-11-13), com a decisão nas palavras do usuário e a regra. A seção
  antiga "Limite de linhas" é histórico e fica como está.
- `CLAUDE.md`: sem mudança.

### B.7 Golden

Não muda (os 4 cenários têm poucas linhas).

### B.8 Checklist do app

- Numa sessão longa, abrir "+N pedidos anteriores" até o corte agir: a linha fica no topo com "▾",
  "+N linhas anteriores" logo abaixo, e o clique nela fecha; nos dois temas.
- O histórico de um cartão cortado junto com o pedido: o pedido, a tarefa e o cartão aparecem só com
  a linha do histórico dentro; conferir as guias e o respiro desse cartão de uma linha.
- O painel não trava nem pisca com o histórico aberto e uma tarefa rodando (o relógio redesenha a cada
  segundo).

---

## Riscos e interações

- A parada nova do laço (parte B) é o ponto mais sensível: sem ela, `limitRows` devolvendo mais linhas
  que o limite deixa o laço sem fim. O teste do corte por tamanho com histórico aberto passa pelo laço,
  mas não chega ao mínimo; o implementador confere a parada lendo o laço.
- As duas partes editam o mesmo trecho de `render.tsx` (`:350–391`). Na ordem A e depois B, a parada do
  laço entra dentro do procedimento que A extraiu; na ordem inversa, A extrai o laço já com a parada.
- Mudança em mais de um arquivo do mod (parte B: `layout.ts` e `render.tsx`) vai de uma vez, de uma
  cópia no scratchpad, por causa da recarga a quente.
- `cabecalho.test.ts` fica mais pesado (três roteiros grandes a mais). Os testes rodam em série e cada
  um tem 15 s; se o arquivo passar do tempo, o do cartão pode usar menos tarefas (basta passar de 400
  linhas).
- Item 1 (carta para subagente parado): mexe em outra parte de `layout.ts` e em outros arquivos de
  teste; sem sobreposição com `limitRows`. `regras/selos.json` e `DESENVOLVIMENTO.md` recebem linhas
  dos três itens, em série. Item 3 (frase do lembrete): `text/rules.ts`, sem relação.
- `regressao`: o único teste de `HEAD` que falha contra o código novo é o da parte B, coberto pelo selo
  de decisão. Qualquer outro é regressão no código.

## Pontos de atenção (não são bloqueio)

1. O aviso passa a valer também para o limite de texto (A.2, item 1). Não é decisão do usuário: é
   correção do último recurso, que ficou só com os bytes quando o corte por texto entrou. Se for
   vetado: a condição de `render.tsx:378` fica como está, o cenário `limite-de-linhas-do-desenho` não é
   reescrito na parte A, e o segundo teste de A usa um título de 330 000 caracteres com o histórico
   aberto antes do plano gigante (passa a falhar hoje na asserção depois do `back`).
2. Depois do primeiro "Voltar", o aviso não reaparece naquela sessão enquanto o desenho de textos
   curtos couber (A.2, item 4). Alternativa não escolhida: encurtar os textos sempre, sem botão, o que
   deixaria o aviso inalcançável; a decisão foi manter o aviso como rede.
3. A parte B preserva também o histórico aberto dentro de cartão, com as linhas de que ele pende. A
   decisão fala em "a linha do histórico aberto", sem separar os dois casos. Se for para valer só no
   painel principal: as linhas fixadas passam a ser só a de chave `sec:turns` sem escopo, o segundo
   teste novo de B sai, e o cenário perde "ou no cartão de uma sessão" e a parte das linhas de que ela
   pende.
