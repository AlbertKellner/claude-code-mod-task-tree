# claude-code-mod-task-tree

Mod do Claude Code (`task-tree/`) que desenha a árvore de tarefas da sessão num painel lateral.
Arquitetura e histórico de decisões: [task-tree/DESENVOLVIMENTO.md](task-tree/DESENVOLVIMENTO.md).
Regras de comportamento, uma por cenário: [regras/](regras/).
Como o trabalho é conduzido (papéis, perguntas, lotes, paralelismo): @PROCESSO.md

## Fluxo de trabalho

- Toda mudança passa por análise antes da implementação, mesmo as triviais.
- A implementação faz um commit local por item. O usuário valida visualmente no app depois do
  commit local e só então libera push e PR (palavras dele: "Entre cada tarefa implementada, crie um
  commit local. Quando eu achar necessário, vou pedir para fazer push e criar o PR").
- Painel errado é bug do plugin: corrige-se o plugin, nunca o jeito de usar.
- Bug achado é corrigido e relatado depois, sem pedir permissão. Se a correção contradiz uma decisão
  anterior do usuário (veja a origem no catálogo `regras/`), vira pergunta antes.
- Correção de bug traz, no mesmo commit, o teste que reproduz o bug (não precisa estar vermelho antes)
  e o cenário no catálogo.

## Como testamos

- Testes de comportamento em `task-tree/tests/*.test.ts`, um arquivo por área, rodando o mod de
  verdade no harness oficial (`claude plugin test`, kit `claude-code/testing`).
- `task-tree/tests/kit/` concentra o roteiro (`plan`, `start`, `done`, `pedido`, `fimDoTurno`, `esc`…),
  o ambiente fixo (relógio parado) e a leitura do painel em comportamento (título e estado de cada
  linha, pela superfície terminal) e o `test` que todo arquivo de teste importa (`kit/teste.ts`), que
  dá o teto por teste. Os testes falam de títulos e estados, nunca de funções internas.
- Limites do harness: 60 s por teste, teto só para o teste travado (o kit do Claude Code dá 5 s; o
  `test` de `task-tree/tests/kit/teste.ts` passa `timeoutMs`, e a etapa `selos` recusa o arquivo de
  teste que importa `test` direto de `claude-code/testing`; decisão do usuário, 2026-11-15:
  "Autorizo"); um processo por arquivo; sem fs, rede ou processo dentro do
  teste; não verifica a pintura (cores, largura, cliques); não simula a recarga a quente (cada teste
  é um módulo novo com o estado vazio). Stubs `on(...)` vão antes da primeira chamada a `$`.
- O que o harness não alcança vai ao checklist do app (abaixo) e fica marcado `checklist` no catálogo.

## Como executar

    npm install      # uma vez: typescript para o tsc e o hook de pré-commit
    npm run check

Etapas, na ordem do resumo final. As etapas 1 a 6 rodam em paralelo entre si e com o `plugin test`; a
primeira que falha encerra as que ainda rodam, e o check sai com falha mostrando a saída dela. A
`regressao` só começa depois de todas passarem. A saída de cada etapa aparece inteira quando ela
termina (a da `regressao`, ao vivo), e o resumo final segue a ordem da lista (decisão do usuário,
2026-11-15: "é possivel rodar as etapas do npm run check em paralello, e a primeira que quebrar, para
as outras que ainda estiverem rodando?"; "sim"). As etapas e o grupo: `scripts/etapas.mjs`.
1. `regras`: confere o catálogo `regras/` contra os testes (ids, estados, ligações).
2. `travas`: testa as regras do selo num repositório temporário.
3. `selos`: confere os testes e o kit contra `regras/selos.json`.
4. `claude plugin validate . --strict` e `claude plugin validate task-tree --strict`: manifesto do
   marketplace e do mod. Não gera `task-tree/.claude-plugin/types/` (ignorado pelo git), de que o `tsc`
   depende: quem grava essa pasta é o motor do Claude Code quando carrega o mod de uma pasta, e ele a
   regrava a cada atualização do app; num clone novo, sem ela, o `tsc` falha.
5. `tsc --noEmit`: bloqueia. Usa o tsconfig gerado (strict, noUncheckedIndexedAccess) e o
   `task-tree/tsconfig.json`, que liga `noUnusedLocals` (sem `noUnusedParameters`: os hooks têm
   `($, e, next)` na assinatura).
6. `claude plugin test task-tree`: todos os testes.
7. `regressao`: os testes de `HEAD` contra o código novo, numa pasta temporária; só com diferença em
   `task-tree/`. Não repete o arquivo de teste igual ao de `HEAD` quando o kit, os apoios e o golden
   também são iguais: a execução seria a mesma da passada principal, e os testes selados dele têm de
   constar aprovados nela, no mesmo check.

O hook de pré-commit roda o mesmo check sobre o índice, mas pula o que não pode mudar o resultado
(decisão do usuário, 2026-10-28: "Sim, pular (Recomendado)"), pelo que o índice muda contra `HEAD`
(`scripts/mudou.mjs`, testado nas `travas`):
- `travas`, se nada mudou em `scripts/`, no `package.json` nem no `package-lock.json`;
- os dois `validate`, se nada mudou em `task-tree/` fora de `tests/` nem em `.claude-plugin/`;
- `tsc`, se nada mudou em `task-tree/`, no `package.json` nem no `package-lock.json` (no hook ele lê
  os tipos gerados do repositório).

O que mudou é lido sem detecção de renome: um arquivo movido conta pelo caminho de onde saiu e pelo de
onde entrou, e um nome com acento conta como é.

`plugin test` e `regressao` rodam em série: em paralelo, com a máquina carregada, testes estouravam
os 5 s que cada teste tinha. As etapas leves (1 a 6) rodam junto com o `plugin test`.

`regras`, `selos`, `plugin test` e `regressao` nunca são pulados (a `regressao` roda sempre que há
mudança em `task-tree/`), e nenhum resultado de teste é guardado de uma execução para outra. Dentro
da `regressao`, só são repetidos os arquivos de teste que mudaram contra `HEAD` (decisão do usuário,
2026-11-15: "Autorizo", sobre a regressão só do que mudou): o modificado, e o removido ou renomeado,
que roda de `HEAD`; com qualquer mudança no kit, nos apoios (`tests/fixtures/`) ou no golden, todos.
Os testes selados dos arquivos não repetidos têm de estar aprovados na passada principal do mesmo
check ("NÃO CONFERIDO NA PASSADA PRINCIPAL" se não). Rodada sozinha, a `regressao` repete todos.
O `npm run check` manual roda tudo.
No check manual, a `regressao` compara com `HEAD` só o que ainda não está em commit (com a árvore
limpa, "nada a comparar"); para conferir commits já feitos (depois de rebase, cherry-pick, merge ou de
um commit sem o hook), `npm run check -- --base <ref>`. Um `--base` sem valor ou que não é commit
deste repositório é erro. Os testes de uma base anterior ao teto de 60 s rodam, na `regressao`, com
os 5 s que ela tinha. Com `--base <ref>`, vale o mesmo contra a base: repete os arquivos de teste que
o PR mudou, ou todos se ele mudou o kit, os apoios ou o golden.
A etapa `regras` ou `selos` que termina sem a linha de resumo dela (`regras: …`, `selos: …`) é falha.

Numa worktree, o hook usa o `node_modules` e os tipos gerados do clone principal quando ela não os tem;
sem `node_modules` em nenhum dos dois, o check para com "rode npm install".

Outros comandos: `npm run regras:selar -- "<arquivo>::<nome>" --tipo … --motivo "…"` (selar um
teste), `npm run testes:alterados` (os testes existentes que mudaram, para o relato; depois do
commit local, compara o último commit; `-- --pr` contra a base do PR) e `npm run impacto` (a matriz de impacto, abaixo).

O binário é o do app desktop, na versão mais nova em `%APPDATA%\Claude\claude-code\<versão>\` que
responde ao `--version` (se a pasta mais nova não responder, a anterior); `CLAUDE_BIN` escolhe outro.
Use a mesma versão que roda a sessão.

## BDD: o catálogo de regras

- Cada regra do painel é um cenário em `regras/<área>.md`: id estável, título, Dado/Quando/Então
  em comportamento observável, origem (decisão do usuário com data e as palavras dele, ou commit) e
  estado (`coberto`, `pendente`, `checklist`). Formato em [regras/README.md](regras/README.md).
- O teste cita a regra num comentário logo acima do `test(...)`: `// Regra: <id>[, <id>]`.
- Quando escrever: na análise, antes de implementar. Toda decisão nova do usuário vira cenário
  (novo ou reescrito, citando o que desfaz); a implementação liga o teste e muda o estado para
  `coberto` no mesmo commit.
- O `npm run check` falha se um cenário `coberto` não tem teste, se um teste cita id inexistente,
  se um teste não cita regra, ou se um teste cita um cenário ainda `pendente`/`checklist`.

## Travas contra regressão

O que já funcionava continua funcionando: um teste existente só muda quando o usuário decide mudar
a regra que ele protege.

- Teste existente coberto por regra só muda com decisão do usuário registrada no catálogo: o
  cenário ganha `Reescrito: AAAA-MM-DD, <palavras dele>`, e o teste é selado como decisão
  (`npm run regras:selar -- "<arquivo>::<nome>" --tipo decisao --motivo "…"`).
- Mudar a forma de um teste sem mudar o que ele afirma é refatoração (`--tipo refatoracao`): as
  asserções não podem diminuir, o teste antigo precisa continuar passando e o teste novo precisa
  passar no código anterior; o check roda essa prova nos commits com selo de refatoração (decisão do
  usuário, 2026-11-15: "Sim, provar (Recomendado)"). Por isso a refatoração de um teste e a mudança
  do código que ele cobre vão em commits separados.
- Teste novo é selado à mão (`--tipo novo`), e fica protegido a partir do commit seguinte.
- Tirar ou renomear um teste por decisão do usuário usa `node scripts/selos.mjs --remover` ou
  `--renomear`, que deixam em `selos.json` (`removidos`) o registro que a etapa `regressao` aceita; o
  hook passa no mesmo commit do código.
- Regressão se corrige no código, nunca no teste. Se a mudança precisa alterar um comportamento
  protegido e não há decisão do usuário, pare e pergunte.
- O `npm run check` falha quando: um teste selado mudou sem selo novo; um teste coberto perdeu
  asserções; um arquivo do kit ou de apoio dos testes (fixtures) mudou sem selo; ou um teste de `HEAD` falha contra o código novo
  sem decisão registrada ("testes antigos, código novo"); um teste selado como refatoração falha
  contra o código de `HEAD`; um teste selado de `HEAD` que não rodou
  (não aparece na saída do `plugin test`) conta como falha, e o de um arquivo não repetido tem de
  estar aprovado na passada principal; um selo do kit é `novo` para arquivo que já
  existia, ou sem motivo; um teste tem menos asserções sem mudar (helper do kit que deixou de afirmar,
  sem o kit selado como decisão); ou um `test(` é aninhado, sem nome literal ou repetido no arquivo; ou um arquivo de
  teste importa `test` direto de `claude-code/testing`.
- O hook de pré-commit (`.githooks/`, ativado pelo `npm install`) roda o check sobre o que vai no
  commit. Não use `--no-verify`.
- Matriz de impacto: cada arquivo do catálogo diz o código da área (`Código da área:`) e um cenário
  pode somar o seu (`Código:`), por arquivo, relativo a `task-tree/`. `npm run impacto` (o diff contra
  `HEAD`; `-- --base <ref>`; ou `-- <arquivos>`, antes de implementar) lista os cenários afetados, os
  testes que os cobrem, o checklist do app e o golden. É orientação: sai sempre com 0, e o check roda
  todos os testes. O check falha só com caminho inexistente no mapa; cenário coberto sem código ou
  arquivo do mod fora do mapa só avisa (decisão do usuário, 2026-10-29: "Só avisar (Recomendado)").
  O núcleo (`hooks/register.tsx`, `hooks/render.tsx`, `types/index.d.ts`) afeta tudo.
- O brief da análise traz `npm run impacto -- <arquivos que a mudança vai tocar>`; o relato da
  implementação traz `npm run impacto` sobre o diff real (depois do commit local, compara o último
  commit).
- O relato da implementação cola a saída de `npm run testes:alterados` e o resumo do check
  (modelos em [regras/README.md](regras/README.md)).

## CI

`.github/workflows/test.yml` roda o mesmo `npm run check`, todas as etapas, no Ubuntu, com o Claude
Code do npm fixado na versão do app (`scripts/versao-do-claude-code.txt`; subir junto com o app; o check
local avisa quando roda em outra versão) e
`--base <merge-base com o main>`: a regressão roda os testes da base do PR contra o código dele (os dos arquivos de
teste que o PR mudou; todos, se mudou o kit, os apoios ou o golden), e uma
falha só passa com o selo de decisão ou golden que o PR traz. Não precisa de segredo nem de login.
- Desligada por escolha do usuário (2026-10-29: "não roda por enquanto, deixe pronto para o futuro";
  o runner "ainda não está funcional"): só roda à mão (`workflow_dispatch`). Para ativar em cada PR
  para o `main`, descomentar o `pull_request` no topo do arquivo.
- A base vazia (o `git merge-base` sem resposta) derruba o passo "Base de comparação".
- Informativa: não é exigida para o merge. A proteção do `main` (branch protection) é do usuário.
- Ensaio local: `npm run check -- --base <ref>` (ex.: `--base main`, a base do PR).

## Golden do desenho

O desenho do app desktop em 6 cenários (principal, filha trabalhando, envios, subagente e filha com
modelo e cartas, a 60 colunas; largo, a 100)
fica travado em `task-tree/tests/golden/desenho.ts`, conferido por `tests/golden.test.ts` e selado em
`regras/selos.json` (`golden`). Decisão do usuário, 2026-10-28: "Sim, validar antes do commit
(Recomendado)".
- Desde a migração para o desenho nativo (2026-11-13, "migrar todo o Mod para o hibrido de nativo e
  mantendo somente o que for obrigatório em SVG"), cada cenário é `{ arvore, svgs }`: a árvore de
  `Box`, `Text`, `Button` e `Svg` que o app recebe (`arvoreDoApp` do kit: tipo, key, props, hover e
  filhos) e as fontes dos `Svg` que restam (ícones de estado, busto, envelope, anel e barra do
  cabeçalho), cada uma uma vez só.
- O aceite é do usuário, no app. Ele não olha a árvore nem a página.
- Mudança que altera o desenho: o check falha ("o desenho de <cenário> mudou") e bloqueia o commit.
  A mudança fica sem commit até ele validar o painel no app; com o "funcionou" dele,
  `npm run golden:aprovar -- <cenário…|--todos> --motivo "\"<palavras dele>\", AAAA-MM-DD"` regrava o
  golden e o selo, e o commit segue com o código, `desenho.ts` e `selos.json`. Para o resto, nada muda
  (commit local e depois validação).
- Nunca aprovar sem as palavras dele: o `golden:aprovar` recusa motivo sem aspas e sem data, e a
  etapa `regressao` só aceita a falha do teste de golden de `HEAD` com o desenho aprovado hoje.
- `npm run golden:pagina` (o aprovado e o atual lado a lado, em `golden-recebido/`: um desenho
  aproximado da árvore, a diferença da árvore linha a linha e as fontes dos `Svg`) só sob pedido dele.

## Editar o mod sem quebrar a recarga

- O mod costuma ser carregado deste clone e recarrega a cada arquivo salvo, em todas as sessões. Um
  estado intermediário que não compila aparece ao usuário como "reload failed" (a versão anterior
  segue carregada).
- Mudança em vários arquivos vai de uma vez: trabalhe numa cópia no scratchpad e traga tudo junto. No
  fluxo dos lotes, o commit é feito na cópia, onde o hook roda o check, e entra no clone por avanço
  direto da branch (`PROCESSO.md`, seção 4); fora dele, copie tudo junto e rode `npm run check` antes
  do passo seguinte.
- Operação do git que troca vários arquivos neste clone (`checkout`, `pull`, `merge`, `rebase`,
  `stash`): evite com turno em curso em outra sessão e, depois dela, confira que o mod recarregou
  sem "reload failed" antes de seguir (decisão do usuário, 2026-11-15: "Regra leve (Recomendado)").
- Limites do validate que o código respeita (chave de `$.state` literal no arquivo que chama, `$`
  só em função de topo etc.): DESENVOLVIMENTO.md, "Limites do kit".

## Regras de uso do painel

Regra nova de como o modelo usa o painel vai em `task-tree/text/rules.ts` (`RULES`, descrições das
ferramentas, lembretes dos hooks), nunca na memória do Claude Code nem num CLAUDE.md da máquina.
Todo texto novo ao modelo entra com um cenário que diz quando ele sai e um teste dos trechos essenciais;
mudar quando um texto sai é mudança de regra (decisão registrada); a redação segue livre.

## Checklist do app (validação visual do usuário)

Depois do commit local, o usuário valida no app, quando a mudança toca o que o harness não vê:
- largura real e recorte na borda, nos dois temas;
- cliques no ícone e no anel (botão transparente sobre o `Svg`) e na linha; realce do botão; linha
  nova sem animação; nada pisca à toa;
- desenho nativo: o toks/s e 'ultracode' no cabeçalho estreito, em linhas próprias, sem cortar o '%'; guias em caixas finas, contínuas entre as linhas, dentro e fora dos cartões e na
  faixa ao lado deles, alinhadas com os ícones e visíveis nos dois temas; corte do título no fim;
  alturas do título e do percentual do cabeçalho; o tempo do cabeçalho parado com o turno encerrado; o tempo das linhas e do cabeçalho ao retomar depois de horas; a faixa de 1 coluna do cabeçalho; pílulas com borda;
  o total da sessão inteira na linha "+N pedidos anteriores";
  cores cruas (`rgba(...)`) e as chaves de tema nos dois temas; o fundo e a borda do cartão e do
  cabeçalho destacados do painel, e o cartão dentro de cartão um degrau igual além do de fora, a cada
  nível, nos dois temas; a altura das linhas com o texto no meio; o respiro dos cartões nos quatro
  lados; o conector da faixa chegando na altura do cabeçalho do cartão;
- o limite de 100 000 caracteres de texto (o harness desenha só esses; o mod corta em 95 000 no app);
- recarga a quente real (salvar um arquivo com o painel aberto); os cartões das rodadas não saltam ao salvar um arquivo do mod; com um subagente trabalhando, o "· N chamadas" do cartão não volta a 1; o painel fechado pela pessoa segue fechado na recarga e nos plans;
- depois de `checkout`, `pull`, `merge`, `rebase` ou `stash` no clone carregado: o mod recarrega sem
  "reload failed" e o painel das sessões abertas segue inteiro;
- sessões filhas reais (cartão, ✉ e entrega, filha parada e arquivada, rodada substituída; filha apagada e
  filha arquivada com a tarefa de origem aberta: o modelo é avisado uma vez; a filha que conclui tudo
  fecha a tarefa de origem, com a mãe parada; digitar direto numa filha: o cartão aparece sob a tarefa em
  andamento da sessão de cima, ou fechando o pedido); carta a subagente real
  (recebida, parado antes de receber, retomado; o cartão do retomado volta a "trabalhando"); avisos do app;
- modelo e esforço no cartão; status embaixo da caixa de mensagem.
- processo novo e `/model` no meio do turno (o turno em curso fica ✕ interrompido; o toks/s some do
  cabeçalho e do cartão até a primeira resposta do modelo novo); o painel de uma sessão
  fora das 30 do store volta do arquivo publicado; o arquivo de uma sessão apagada é esvaziado;
- `/clear` real nesta sessão com filhas e numa filha (os cartões e o histórico na mãe);
- Esc no meio de uma resposta (a resposta para, a tarefa fica ✕, o toks/s fica no último valor);
- tempos através de turnos reais (a tarefa retoma de onde parou, o cabeçalho para no fim do turno, a
  linha ◷ conta do primeiro start) e o cabeçalho estreito e largo (toks/s, "ultracode", repositório);
- workflows reais com muitos subagentes (cartão de grupo com espera, retomada, cliques com o freio das
  gravações) e o turno que morre por erro real (✕ "falhou" no painel e no cartão);
- a nota da versão no merge do PR (workflow "Release").

## Release e PR

- A versão do plugin sobe sozinha no merge do PR, pelo título: `feat…` → minor; `!` depois do tipo,
  ou uma linha começando com `BREAKING CHANGE:` no corpo → major (citá-la no meio
  do texto não conta); o resto → patch; título fora do formato Conventional Commits → patch, com aviso
  no resumo do workflow. Não edite a versão do `plugin.json`.
- O commit de versão leva no corpo a linha `PR: #<número>` (decisão do usuário, 2026-11-15: "Sim,
  com a linha do PR (Recomendado)"): reexecutar o job "Release" de um PR é seguro; com a versão já
  gravada ele só cria a release que faltou, e com a release criada não faz nada. Vale para os PRs
  mesclados depois dessa mudança; os commits de versão de antes não têm a linha, e reexecutar o job
  de um PR antigo segue subindo a versão.
- Com vários merges seguidos, o GitHub pode descartar a execução do meio (o grupo `release` guarda
  uma só pendente): o PR dela fica sem versão e sem release até o job dele ser reexecutado à mão.
- Se a `main` passar a exigir PR, a proteção precisa liberar o push do `github-actions[bot]`.
- Título no formato Conventional Commits; descrição e labels atualizadas a cada push.
