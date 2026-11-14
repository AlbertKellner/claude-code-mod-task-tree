# Instruções comuns aos implementadores dos lotes dos achados médios

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14 e revisto no mesmo dia, depois de dois ensaios
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
- Se algo no plano não fechar com o código, escolha o caminho mais fiel ao plano e relate. Se o plano
  trouxer BLOQUEIO, não implemente a parte bloqueada: relate.
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
   - a identidade do git: `git config user.email` igual a `git log -1 --format=%ae`. Nenhum commit pode
     sair com outra identidade.
   - o hook e o ambiente: `git config core.hooksPath` responde `.githooks`; existem `node_modules` e
     `task-tree/.claude-plugin/types/` (com `tsconfig.json`). Sem isso o commit sairia sem validação.
2. Faça uma cópia sua no scratchpad: `git clone` local do clone real, na ponta atual da branch, numa
   pasta só sua (outros agentes usam o mesmo scratchpad); `npm install` na cópia; e copie para ela a pasta
   `task-tree/.claude-plugin/types/` do clone real. O `validate` não gera essa pasta: quem gera é o motor
   do Claude Code quando carrega o mod de uma pasta, e o `tsc` do check depende dela.
3. Na cópia, escreva primeiro os testes novos (e as mudanças do kit, se o plano pedir) e prove que eles
   falham no código de hoje, pelo motivo que o plano diz. O `npm run check` não serve para a prova (para
   antes, em `regras` e `selos`). Rode os testes direto pelo binário do app, com a trava, guardando a
   saída num arquivo do scratchpad:
   - o binário: `node -e "import('./scripts/binario.mjs').then(m=>console.log(m.acharBinario()))"`, na
     raiz da cópia;
   - a prova: `"<binário>" plugin test task-tree`, na raiz da cópia. Ele roda todos os arquivos de teste;
     leia as linhas dos testes novos que falharam e o motivo.
4. Na cópia, implemente o resto: código, cenários, documentação e selos (`npm run regras:selar …`, como
   o plano lista). Rode `npm run check`, com a trava.
   - Se um teste falhar por tempo (5 s), rode de novo uma vez.
   - Lote que muda o desenho: na cópia, o esperado é o check falhar SÓ nos testes do golden ("o desenho
     de <cenário> mudou"). Não aprove o golden na cópia.
   - Data do `Reescrito:`. Os planos escrevem `Reescrito: 2026-11-14, …`. O selo de decisão exige um
     `Reescrito:` com data igual ou posterior à do selo anterior do teste, e todo selo grava a data do
     dia em que é feito. Se hoje não é mais 2026-11-14, escreva a linha com a data de hoje e ponha a
     data da decisão no texto: `Reescrito: <hoje>, decisão do usuário de 2026-11-14 ("palavras dele").`
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
   - Nos dois casos, antes do commit: `npm run testes:alterados` e `npm run impacto`.
7. Commit local só dos arquivos do lote, com a trava (o hook roda testes):
   `git commit -F <arquivo de mensagem> -- <caminhos>`. Arquivo novo precisa de `git add <arquivo>` antes.
   Nunca `git add -A`, nunca `--no-verify`. Um commit por decisão do usuário; as correções diretas de um
   lote podem ir num commit só, como o plano disser. Mensagem em Conventional Commits, em português,
   dizendo o que muda para o usuário; tipo `fix(task-tree): …`, salvo o plano dizer outro (`fix(scripts)`,
   `docs`). A última linha é a de atribuição: a que o seu prompt trouxer; se ele não trouxer, a que a
   sua sessão recebeu do Claude Code. Se o hook falhar, corrija e tente de novo.
8. Entre um lote e o seguinte, ponha a cópia na ponta nova do clone real: na cópia,
   `git checkout -- . && git clean -fd && git pull`, e confira que `git log -1` é o commit que você
   acabou de fazer (o `node_modules` e os tipos são ignorados pelo git e ficam).
9. Não faça push. No fim, apague a sua cópia e os arquivos que você criou no scratchpad. Exceção: se
   parou num lote, guarde o que fez em `<scratchpad>/<lote>-parcial.patch` (`git diff --binary` da
   cópia), não apague esse arquivo e diga o caminho no relato. O clone real fica como no último commit.

## Relato

Comece, em até 400 caracteres, com: os hashes dos commits (ou onde parou), o resultado do check, a
contagem de testes, se os testes novos falharam na base e passaram com a mudança, se o golden mudou e o
que ficou de fora. Depois, um bloco por lote: as linhas `ok` do check, a saída de `testes:alterados`, o
resumo do `impacto`, os arquivos do commit, os itens do checklist do app (os da seção 9 do plano, mais
os que a sua adaptação criar), o que você adaptou ou decidiu fora do plano, e o que mudou no código que
os planos seguintes não conhecem (funções criadas, renomeadas ou removidas, campos novos, mudanças no kit).

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
rode o mesmo comando em segundo plano. Se a trava parecer presa há mais de 15 minutos (veja a data da
pasta), relate em vez de apagar.
