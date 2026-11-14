# Instruções comuns aos implementadores dos lotes dos achados médios

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14 e revisto no mesmo dia, em rodadas de ensaio
da retomada em outra máquina. Só ela escreve aqui.

Você é o IMPLEMENTADOR de um ou mais lotes (até três, um depois do outro; o seu prompt diz quais). Outro
agente fez cada plano; você escreve o código e os testes a partir dele, valida o resultado e faz o commit
local. Decisões do usuário: "Implementador escreve o código (Recomendado)"; "a sessão de implantacao
tambem deve validar os resultados"; o implementador faz o commit; para estes lotes, 2026-11-14: "Um PR
só no fim" e "Validar só no fim (Recomendado)". As respostas dele aos achados estão em
`orq-decisoes-medios.local.md` (pasta de notas).

## Marcadores de caminho

Se este arquivo, ou outro da pasta de notas, trouxer `<repo>`, `<notas>`, `<scratchpad>` ou `<usuario>`
no lugar de um caminho, o prompt que você recebeu diz o caminho real de cada um nesta máquina
(`<scratchpad>` é o scratchpad da sua própria sessão). Use sempre o caminho real nos comandos; não grave
caminhos reais nos arquivos da pasta de notas.

## Fontes

- Use só os planos que o seu prompt indica, as decisões acima, o código do repositório e a lista "o que
  os planos não conhecem" (vem no prompt; se não vier, é a seção 7 de `<notas>/RETOMADA.md`). Não abra a
  pasta `descartados\`, outros planos nem outros diffs, salvo quando o prompt autorizar um plano pelo nome.
- Os planos foram escritos a partir de `6d5e026`. A ponta já tem commits de outros lotes: adapte o plano
  ao código atual e diga no relato o que adaptou. Há testes novos desde a base: uma conferência do plano
  do tipo "nenhum outro teste faz X" tem de ser refeita na ponta.
- Se algo no plano não fechar com o código, escolha o caminho mais fiel ao plano e relate. O que manda
  é o cenário do plano (Dado, Quando, Então) e a decisão do usuário que ele cita; os nomes de função, os
  arquivos e as linhas são o caminho sugerido sobre o código antigo. Uma nota da lista "o que os planos
  não conhecem" que só informa um fato não pede mudança por si: use-a ao adaptar.
- Quando parar. BLOQUEIO que o próprio plano declara para uma parte do lote: implemente o resto, não
  implemente a parte bloqueada e relate. Bloqueio que você descobre (teste protegido que precisa mudar
  sem decisão registrada, decisão do usuário que falta, lote anterior que falta): pare o lote inteiro,
  como no passo 9, e relate. É este segundo caso que o prompt chama de "pare nesse lote".
- As palavras do usuário valem como estão em `orq-decisoes-medios.local.md` (as de rodadas anteriores,
  em `orq-decisoes-altos.local.md`, `orq-decisoes-ajustes-nativo.local.md` e
  `orq-decisoes-pendencias.local.md`, e na origem dos cenários do catálogo). Se o plano grafar uma
  resposta de outro jeito, use a do arquivo no `Reescrito:` e no motivo do selo. Os números de linha
  dos planos são da base antiga e não valem mais em vários arquivos: ache o trecho pelo nome.
- Teste existente que falha e o plano não cita. Se o plano tiver a cláusula que cobre o caso ("se outro
  teste falhar pelo mesmo motivo…"), siga-a: só sele como decisão o teste cujo cenário esta decisão do
  usuário reescreve, com o `Reescrito:` dela, e diga o nome do teste no relato. Se o plano não tiver a
  cláusula, ou o teste afirmar outra coisa, pare no lote e relate: vira pergunta ao usuário.
- Decisão do usuário mais nova vale sobre texto mais antigo. Em especial, nesta rodada, "Validar só no
  fim (Recomendado)" vale sobre o trecho "Golden do desenho" do `CLAUDE.md` (que manda deixar a mudança
  sem commit até a validação no app), e "Um PR só no fim" vale sobre "valida no app e só então libera
  push e PR": o commit sai, o push e o PR são da orquestradora, no fim, e a validação no app vem antes
  do merge.

## Repositório

`<repo>`, branch `fix/achados-medios`. Leia o `CLAUDE.md`, o `PROCESSO.md` e o `regras/README.md`. O mod
é carregado a quente desse clone em todas as sessões: um estado intermediário que não compila aparece ao
usuário como "reload failed".

## Passos

1. No clone real, confira, e pare e relate (sem commit) se algo falhar:
   - `git status --short` vazio e a branch `fix/achados-medios`; anote a ponta. Arquivo alterado que não
     é seu é motivo para parar: há um implementador por vez.
   - a identidade do git: `git config user.email` igual a `git log -1 --format=%ae`, e
     `git config user.name` igual a `git log -1 --format=%an`. Nenhum commit pode sair com outra
     identidade.
   - o hook e o ambiente: `git config core.hooksPath` responde `.githooks`; existem `node_modules` e
     `task-tree/.claude-plugin/types/` (com `tsconfig.json`). Sem isso o commit sairia sem validação.
   - a ordem: os lotes que o plano pede antes ("Depois do lote N", na seção de dependências) já estão em
     commit, fora os que você mesmo vai fazer antes neste prompt. A lista dos lotes em commit vem no
     prompt (ou está na seção 5 de `<notas>/RETOMADA.md`, com os hashes); os títulos dos commits nem
     sempre repetem os do índice. Se faltar um, pare e relate. Não contam os lotes que ficaram fora da
     rodada: A-21 (absorvido pelo A-07), B-26 e C-13.
2. Faça uma cópia sua no scratchpad: `git clone` local do clone real, na ponta atual da branch, numa
   pasta só sua (outros agentes usam o mesmo scratchpad); `npm install` na cópia; e copie para ela a pasta
   `task-tree/.claude-plugin/types/` do clone real, inteira, com o `.gitignore` que há dentro dela (é
   ele, com `*`, que faz o git ignorar a pasta; sem ele o `git status` da cópia fica sujo e o
   `git clean` do passo 8 apaga os tipos). O `validate` não gera essa pasta: quem gera é o motor do
   Claude Code quando carrega o mod de uma pasta, e o `tsc` do check depende dela. Se o `npm install`
   mudar o `package-lock.json` da cópia, volte-o (`git checkout -- package-lock.json`): ele não entra
   no diff de nenhum lote.
3. Na cópia, escreva primeiro os testes novos (e as mudanças do kit, se o plano pedir) e prove que eles
   falham no código de hoje, pelo motivo que o plano diz. O `npm run check` não serve para a prova (para
   antes, em `regras` e `selos`). Rode os testes direto pelo binário do app, com a trava, guardando a
   saída num arquivo do scratchpad:
   - o binário: `node -e "import('./scripts/binario.mjs').then(m=>console.log(m.acharBinario()))"`, na
     raiz da cópia;
   - a prova: `"<binário>" plugin test task-tree`, na raiz da cópia. Ele roda todos os arquivos de teste;
     leia as linhas dos testes novos que falharam e o motivo.
   - Teste novo das travas (lote que só toca `scripts/`): a prova é `node --test scripts/travas.test.mjs`,
     também com a trava.
   - A prova é para os testes que o plano diz que falham hoje. Teste que o plano marca "passa hoje" (está
     lá para travar o comportamento) não precisa falhar: diga no relato que passou na base, como previsto.
     O `CLAUDE.md` diz que o teste "não precisa estar vermelho antes"; aqui a prova é pedida porque o
     usuário quis a validação pelo implementador.
4. Na cópia, implemente o resto: código, cenários, documentação e selos (`npm run regras:selar …`, como
   o plano lista). Rode `npm run check`, com a trava.
   - Se um teste falhar por tempo (5 s), rode de novo uma vez. Se falhar por tempo de novo, a máquina
     está carregada: pare o lote, como no passo 9, e relate.
   - Lote que muda o desenho: na cópia, o esperado é o check falhar SÓ pelo desenho: nos testes do golden
     ("o desenho de <cenário> mudou") ou, no lote que acrescenta cenários ao golden, já na etapa `selos`
     ("cenário do golden sumido"). A aprovação que vale é a do clone real (passo 6). Se você precisar do
     check verde na cópia para validar o resto (no lote que acrescenta cenários o check nem chega aos
     testes; nos outros, não chega à `regressao`), aprove o golden também na cópia, com o mesmo comando
     e o mesmo motivo do passo 6: o diff leva o `desenho.ts` e o `regras/selos.json` aprovados, e no
     clone real você aprova de novo.
   - Data do `Reescrito:`. Os planos escrevem `Reescrito: 2026-11-14, …`. O selo de decisão exige um
     `Reescrito:` com data igual ou posterior à do selo anterior do teste, e todo selo grava a data do
     dia em que é feito. Se hoje não é mais 2026-11-14, escreva a linha com a data de hoje e ponha a
     data da decisão no texto: `Reescrito: <hoje>, decisão do usuário de 2026-11-14 ("palavras dele").`
     Vale para toda linha `Reescrito:` nova, qualquer que seja o texto depois da vírgula. As datas
     dentro de `Origem:` e do `--motivo` dos selos são as da decisão e ficam em 2026-11-14.
   - Virada do dia. A regressão (no check e no hook) só aceita a falha de um teste antigo quando o selo
     de decisão, o registro de remoção ou o golden aprovado é do dia em que ela roda. Se o dia virar
     entre o selo e o commit: na cópia, volte o `regras/selos.json` ao de `HEAD`
     (`git checkout -- regras/selos.json`) e refaça TODOS os comandos de selo do lote (selar, `--kit`,
     `--remover`, `--renomear`), atualizando para a data do dia as linhas `Reescrito:` que o lote
     escreveu; leve o resultado ao clone real (desfazendo o do real antes, como no passo 7) e, no lote
     de desenho, aprove o golden de novo no real.
   - `npm run regras:selar -- …` é `node scripts/selos.mjs --selar …`, e `npm run golden:aprovar -- …`
     é `node scripts/golden.mjs --aprovar …`: use a segunda forma se o `npm run` estragar as aspas de
     um nome de teste ou de um motivo.
   - Arquivo novo: `git add -N <arquivo>` na cópia, para ele entrar no diff.
5. Leve tudo ao clone real de uma vez: `git diff --binary` na cópia e `git apply` no real.
6. No clone real:
   - Se o desenho mudou: `npm run golden:aprovar -- <cenários que mudaram> --motivo "\"Validar só no
     fim (Recomendado)\", 2026-11-14"` (com a trava; a data do motivo é a das palavras do usuário e não
     muda com o dia). Confira que a diferença do desenho é só a que o plano espera: compare, com um
     script seu no scratchpad, o `desenho.ts` de antes (`git show HEAD:task-tree/tests/golden/desenho.ts`)
     com o de depois, cenário por cenário, e relate o que mudou. Não use `npm run golden:pagina`, que é
     só a pedido do usuário. Depois rode o `npm run check` inteiro à mão no real, com a trava.
   - Se o desenho não mudou: NÃO rode o `npm run check` à mão no real. Ele já passou na cópia e o hook
     de pré-commit roda as mesmas etapas no commit (decisão do usuário, 2026-11-14: "Sim", ao ajuste de
     tirar o check repetido).
   - Nos dois casos, antes do commit: `npm run testes:alterados` e `npm run impacto` (o modelo de relato
     do `regras/README.md` diz "depois do commit"; os dois jeitos funcionam, e aqui vale antes).
7. Commit local só dos arquivos do lote, com a trava (o hook roda testes):
   `git commit -F <arquivo de mensagem> -- <caminhos>`. Arquivo novo precisa de `git add <arquivo>` antes.
   Nunca `git add -A`, nunca `--no-verify`. Um commit por decisão do usuário; as correções diretas de um
   lote podem ir num commit só, como o plano disser. Mensagem em Conventional Commits, em português,
   dizendo o que muda para o usuário; tipo `fix(task-tree): …`, salvo o plano dizer outro (`fix(scripts)`,
   `docs`). A última linha é a de atribuição: a que a sua sessão recebeu do Claude Code (ela diz o
   modelo que de fato escreveu o commit); se a sua sessão não recebeu nenhuma, a que o prompt trouxer;
   sem as duas, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   Se o hook falhar só por tempo de teste (5 s), tente o commit de novo uma vez.
   Se o hook falhar por outro motivo, ou o check à mão do lote de desenho falhar, ou a diferença do
   desenho não for a que o plano espera: corrija NA CÓPIA, nunca direto no clone real (ele recarrega o
   mod a cada arquivo salvo). Rode o check na cópia de novo. No clone real, desfaça o lote:
   `git checkout -- <arquivos do lote que o git já conhecia>` (inclusive `desenho.ts` e
   `regras/selos.json`, se o golden foi regravado; arquivo novo nessa lista faz o comando falhar
   inteiro) e, para cada arquivo novo que você criou, `git reset -q -- <arquivo>` e depois apague-o
   (nada de `git clean` nem de `git reset --hard` no clone real). Confira `git status --short` vazio.
   Depois refaça os passos 5 a 7 inteiros com o diff novo da cópia (no lote de desenho, isso inclui
   aprovar o golden de novo). O mesmo desfazer vale se você parar o lote depois do passo 5: o clone
   real tem de ficar como no último commit.
8. Entre um lote e o seguinte, ponha a cópia na ponta nova do clone real: na cópia,
   `git reset --hard && git clean -fd && git pull`, e confira que `git log -1` é o commit que você
   acabou de fazer (o `node_modules` e os tipos são ignorados pelo git e ficam). No lote de desenho, o
   "check verde" que vale é o do clone real; a cópia, depois do `git pull`, já está com o golden novo.
9. Não faça push. No fim, apague a sua cópia e os arquivos que você criou no scratchpad. Exceção: se
   parou num lote, guarde o que fez em `<scratchpad>/<código do lote>-parcial.patch` (por exemplo,
   `A-05-parcial.patch`; na cópia, `git add -N` nos arquivos novos e depois `git diff --binary`), não
   apague esse arquivo e diga o caminho no relato. O clone real fica como no último commit. Parar num
   lote encerra o prompt: não comece os lotes seguintes, que podem depender dele.

## Relato

Comece, em até 400 caracteres, com: os hashes dos commits (ou onde parou), o resultado do check, a
contagem de testes, se os testes novos falharam na base e passaram com a mudança, se o golden mudou e o
que ficou de fora. Depois, um bloco por lote, no modelo de relato do `regras/README.md` (com os selos
regravados e a regressão), mais: as linhas `ok` do check, a saída de `testes:alterados`, o resumo do
`impacto`, os arquivos do commit, os itens do checklist do app (os da seção 9 do plano, mais os que a
sua adaptação criar), o que você adaptou ou decidiu fora do plano, e o que mudou no código que os planos
seguintes não conhecem (funções criadas, renomeadas ou removidas, campos novos, mudanças no kit).

## Trava dos testes (pedido do usuário, 2026-11-14: não estourar os 5 s)

Os testes têm 5 s cada e estouram se dois conjuntos rodarem ao mesmo tempo na máquina. Antes de QUALQUER
comando que rode testes (`npm run check`, `claude plugin test`, `npm run golden:aprovar`,
`npm run golden:pagina`, `node --test scripts/travas.test.mjs`, a regressão, e o `git commit`, por causa
do hook), pegue a trava; solte logo depois do comando:

- Pegar: `until mkdir "<notas>/.trava-testes" 2>/dev/null; do sleep 10; done`
- Soltar: `rmdir "<notas>/.trava-testes"`

Pegue, rode e solte no MESMO comando de shell (`until …; done; <comando>; s=$?; rmdir …; exit $s`), para a
trava nunca ficar presa se você for interrompido entre dois comandos. Vale também na sua cópia do
scratchpad: o que pesa é a máquina, não a pasta. O check inteiro leva alguns minutos: peça o tempo máximo
do shell ou rode em segundo plano e espere o aviso. Se o ambiente recusar o `sleep` em primeiro plano,
rode o mesmo comando em segundo plano. Se o seu próprio comando foi morto por tempo e deixou a trava,
espere o processo dele acabar e remova-a você mesmo. Se a trava de outro parecer presa há mais de 15
minutos (veja a data da pasta), não a apague: pare o lote como no passo 9, com o patch parcial, e
relate.
