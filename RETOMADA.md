# Retomada do trabalho em outra máquina

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14, ao parar o trabalho na máquina antiga, e
revisto no mesmo dia a pedido do usuário ("revise e veja se faltou algo para continuarmos o que paramos,
exatamente do mesmo jeito"). Leia este arquivo inteiro antes de qualquer ação. A conversa da sessão
antiga não viajou: tudo o que a sessão nova precisa está aqui e nos arquivos que ele cita.

## 1. Onde as coisas estão

- **Repositório:** `claude-code-mod-task-tree` (GitHub, conta AlbertKellner). Chamado aqui de `<repo>`.
- **Branch do trabalho:** `fix/achados-medios`, já no remoto, ponta `0716717`. Sem PR aberto.
- **Notas:** branch `notas/achados-medios` do mesmo repositório (nunca entra no `main`). Elas têm de
  ficar numa PASTA IRMÃ do clone, chamada `<repo>-notas` (ex.: `...\claude-code-mod-task-tree-notas`),
  fora do repositório do trabalho. Chamada aqui de `<notas>`.
- **Marcadores:** nos arquivos de notas, os caminhos da máquina antiga foram trocados por `<repo>`,
  `<notas>`, `<scratchpad>` e `<usuario>`. Os arquivos ficam com os marcadores (não os troque no disco:
  a pasta é pública). Todo prompt de agente começa dizendo o caminho real de cada marcador (seção 4).

## 2. Preparar a máquina nova

O que só o usuário faz está marcado com (usuário); o resto a sessão confere.

1. Clonar o repositório e entrar na branch do trabalho:
   `git clone https://github.com/AlbertKellner/claude-code-mod-task-tree.git` e
   `git checkout fix/achados-medios`.
2. Trazer as notas para a pasta irmã, sem misturar com o clone do trabalho (rodado na pasta que contém
   o clone):
   `git clone --branch notas/achados-medios --single-branch https://github.com/AlbertKellner/claude-code-mod-task-tree.git claude-code-mod-task-tree-notas`
3. Ferramentas: git, Node com npm e o `gh`. Na máquina antiga os agentes usavam o Git Bash e, às vezes,
   `python3` para editar arquivos; nenhum script do repositório depende de Python.
4. (usuário) App desktop do Claude Code instalado e aberto ao menos uma vez: o check usa o binário do
   app, em `%APPDATA%\Claude\claude-code\<versão>\` (na máquina antiga, a 2.1.321). Fora do Windows, ou
   com o binário em outro lugar, a variável `CLAUDE_BIN` aponta para ele.
5. (usuário) Mod carregado DESTE clone, e não do marketplace. Na máquina antiga isso estava em
   `~/.claude/settings.json`:
   - em `env`: `CLAUDE_CODE_PLUGIN_DIRS` com o caminho de `<repo>\task-tree` (outros mods, se houver,
     separados por `;`), `CLAUDE_CODE_PLUGIN_DIR_WATCH` igual a `"1"` (recarga a cada arquivo salvo) e
     `CLAUDE_CODE_WORKFLOWS` igual a `"1"`;
   - em `enabledPlugins`: `"task-tree@claude-code-mod-task-tree": false`, para a versão instalada pelo
     marketplace não rodar junto com a do clone.
   A sessão não edita a configuração do Claude Code por conta própria: se o painel de tarefas não
   aparecer, ou se as ferramentas `mcp__task-tree__plan`/`start`/`done` não existirem, ela avisa o
   usuário e espera.
6. (usuário) `gh` autenticado na conta **AlbertKellner**, e só nela (`gh api user -q .login` tem de
   responder `AlbertKellner`). Push sempre com
   `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <branch>`.
7. No clone do trabalho: `npm install` (ativa o hook de pré-commit; `git config core.hooksPath` passa a
   responder `.githooks`) e `npm run check` (tem de dar tudo `ok`, com mais de 300 testes; ele também
   gera `task-tree/.claude-plugin/types/`, que o git ignora).
8. (usuário) Sessão do app aberta no clone do trabalho, em modo automático de permissões, como na
   máquina antiga: sem isso os agentes param a cada comando para pedir autorização. A orquestradora
   terminou lá em Fable 5.2 (antes, Opus 5.5); o modelo e o esforço da sessão são escolha do usuário.
9. Colar o prompt da seção 12.

Não viajaram, e não são necessários para os lotes: `node_modules`, os tipos gerados, os outros mods da
máquina antiga (barra de progresso, faixa de sessão e semelhantes), a memória local do Claude Code e o
`CLAUDE.md` global do usuário (seção 8).

## 3. Como o trabalho é conduzido

- `PROCESSO.md` e `CLAUDE.md`, na raiz do repositório: papéis, lotes, paralelismo, golden, testes.
- `<notas>/orq-instrucoes-implementador-medios.local.md`: instruções que todo implementador lê.
- `<notas>/orq-instrucoes-planejador-medios.local.md`: instruções dos planejadores (os planos já estão
  prontos; só serve para um replano).
- `<notas>/orq-decisoes-medios.local.md` e `<notas>/orq-decisoes-pendencias.local.md`: todas as
  decisões do usuário, com as palavras dele. São a fonte dos `Reescrito:` e dos motivos dos selos.

**Quem faz o quê.** A sessão que recebe o prompt é a orquestradora: não escreve código nem planos. O
planejamento e a implementação são feitos por SUBAGENTES lançados por ela com a ferramenta `Agent`, em
segundo plano, e não por sessões filhas. É pedido do usuário para este trabalho ("quero que você faca
do zero o planejamento e a implementacao dos 4 itens, em subagentes separados"; "A implementação deve
ser feita conforme combinamos") e está no `PROCESSO.md`, que prevalece neste repositório sobre regra
geral de orquestração que mande abrir sessões filhas.

Configuração dos agentes na hora da parada (o usuário trocou quatro vezes num dia: confirme no início e
registre cada troca; uma troca vale a partir do próximo agente lançado):
- implementador: `model: "opus"`, `effort: "low"`;
- planejador (só se precisar de replano): `model: "fable"`, `effort: "medium"`.

Regras que valem e não estão no `PROCESSO.md`:
- Até três lotes por agente, um commit por decisão, check verde na cópia entre eles.
- O implementador trabalha numa cópia no scratchpad e leva tudo ao clone de uma vez.
- Nunca dois agentes rodando testes ao mesmo tempo: a trava é a pasta `<notas>/.trava-testes`. Se ela
  sobrar de um agente parado, a orquestradora a remove (`rmdir`) depois de conferir que nenhum agente
  está rodando.
- O check não é repetido à mão no clone: roda na cópia e no hook do commit.
- Golden: o implementador regrava com `--motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"`.
- Teste protegido que precise mudar sem decisão registrada: o lote para e vira pergunta ao usuário.
- Sem `--no-verify`, sem `git add -A`, sem force-push. Nenhum push nem PR até o fim dos lotes.
- Perguntas ao usuário pelo `AskUserQuestion`, até 4 por vez, cada uma legível sozinha, com a
  recomendada primeiro. Resposta sem escolha: não agir.
- A pergunta com os próximos passos só sai quando o desenvolvimento terminou, não há agente rodando e o
  passo seguinte depende do usuário.
- Workflows do GitHub: o "Release" está ativo e fica assim ("se está ativo, deixe assim"); o "Testes"
  só roda à mão. A validação é o check local e o usuário no app.
- Worktrees: analisado e descartado para esta rodada. Só a pedido do usuário.

## 4. Como lançar um implementador

Um por vez (todo lote grava em `regras/selos.json`). Parâmetros da ferramenta `Agent`:
`subagent_type: "general-purpose"`, `model: "opus"`, `effort: "low"`, `run_in_background: true`,
`description: "Implementar lotes A-04 a A-06"`. O prompt, trocando os caminhos pelos reais desta
máquina e a lista de lotes:

> Marcadores usados nos arquivos de notas: `<repo>` = (caminho absoluto do clone); `<notas>` = (caminho
> absoluto da pasta irmã de notas); `<scratchpad>` = (o seu próprio scratchpad).
>
> Você é o IMPLEMENTADOR de três lotes dos achados médios do mod task-tree, um depois do outro. Antes de
> tudo, leia e siga integralmente `<notas>/orq-instrucoes-implementador-medios.local.md` (inclui a trava
> dos testes e a regra de não repetir o check à mão no clone). Pasta dos planos: `<notas>`.
>
> Lotes, nesta ordem, um commit por decisão, com o check verde na cópia antes de passar ao próximo:
> 1. `medios-A-lote-04-plano.local.md`
> 2. `medios-A-lote-05-plano.local.md`
> 3. `medios-A-lote-06-plano.local.md`
> (índice: `medios-A-indice.local.md`, só para contexto; as deduções do planejador listadas no índice
> valem como estão escritas.)
>
> A ponta é `0716717` ou depois. O que os planos (escritos sobre `6d5e026`) não conhecem: (copiar a
> seção 7 do RETOMADA, atualizada). Adapte.
>
> Se um teste existente protegido precisar mudar sem que o plano traga a decisão registrada (as decisões
> estão em `orq-decisoes-medios.local.md`), ou houver BLOQUEIO, pare nesse lote, guarde o patch parcial
> no scratchpad e relate.
>
> Relato: comece, em até 400 caracteres, com os hashes (ou onde parou), o check, a contagem de testes e
> o golden; depois, um bloco por lote como as instruções pedem.

Quando o agente termina, a orquestradora, no mesmo turno:
1. confere o que ele relatou (`git log --oneline`, `git status --short`; a árvore tem de estar limpa e a
   trava solta);
2. acrescenta à seção 7 o que o relato disser que mudou e que os planos seguintes não conhecem;
3. lança o agente dos próximos lotes;
4. relata ao usuário, em poucas linhas: o que cada commit muda para ele no painel, o resultado do check,
   a contagem de testes, se o desenho mudou, o que entra no checklist do app e quantos lotes faltam.

Ao falar com o usuário, descreva cada lote pelo que ele faz. O código do lote (como "A-04") nunca vai
sozinho: o usuário não tem o plano na frente.

Agente que trava ou some: `PROCESSO.md`, seção 7. Em resumo, antes de relançar, conferir arquivos e
commits; trabalho pela metade no clone é desfeito e o lote recomeça do zero, pelo plano.

## 5. O que já está em commit (18 lotes de 80, 19 commits, tudo no remoto)

Triagem C (durabilidade, scripts, release): C-01 `6ec76e7`, C-02 `dadc76a`, C-03 `a21cc3e`,
C-04 `6a0b93c`, C-05 `509013b`, C-06 `52e6fec`, C-07 `91558b8`, C-08 `2d772df`, C-09 `013b758`,
C-10 `57a987d`, C-11 `ecc682b`, C-12 `ce03bd9`, C-14 `941c4a8`, C-28 `80615f2`, C-29 `0a8b42f`.
Triagem A: A-01 `b0c1672`, A-02 `cf132fc`, A-03 `0716717`.
Fora dos lotes: `5b2dc1a`, o `PROCESSO.md`.

O relato do A-03 (o título do pedido é o do primeiro plan) não chegou a ser lido: o agente foi parado
logo depois do commit. O commit passou pelo hook e a orquestradora conferiu que ele traz o que o plano
pede (o teste novo, o campo `named` do turno, os textos das regras, o cenário e o selo).

## 6. O que falta (62 lotes), nesta ordem

Os planos estão em `<notas>/medios-<X>-lote-<NN>-plano.local.md`; os índices, com as dependências e
as deduções de cada planejador, em `<notas>/medios-<X>-indice.local.md`.

1. **Triagem A, 22 lotes:** A-04 a A-20 e A-22 a A-26. O A-21 não existe como lote (absorvido pelo
   A-07). O A-04 (start num pai inicia a primeira subtarefa) estava pela metade quando o trabalho
   parou e foi desfeito: recomeça do zero, pelo plano ("Recomeça do zero (Recomendado)").
2. **Triagem B, 25 lotes:** B-01 a B-25. O B-26 fica de fora (depende de um ensaio no app).
3. **Triagem C, 14 lotes:** C-15 a C-27 e C-30. O C-13 é opcional e fica de fora.
4. **C-31 por último:** tem de ser o último commit de teste e selo da branch (regrava quase todos os
   hashes dos selos).
5. **Fechamento** (seção 9).

Fora desta rodada, por decisão do usuário: os 10 achados "não confirmados", os 123 achados de
severidade baixa da auditoria e a comparação de prints do painel nativo.

## 7. O que os planos não conhecem

Os planos foram escritos sobre `6d5e026`. Cada prompt de implementador precisa dizer o que mudou desde
então. Até a ponta `0716717`:

- `restoreLinks` virou `ensureLinks` (primeiro uso das ligações); as fusões `union`/`fill` saíram da
  tabela de durabilidade.
- `saveStore` não lança mais e devolve se gravou (`guarded`, `pruneStore`, `storeFailure`).
- Saíram `STATE_KEYS`, `STORES`, `LINK_KEYS` e `stateOf` de `state/durability.ts`; a etapa `regras`
  confere a tabela de durabilidade contra as chaves do state (chave nova precisa de linha na TABLE).
- `/clear`: tudo é zerado antes de publicar (`dropHeld`); filhas abertas antes somem (`forgetChildren`,
  campo `left`). Processo morto no meio do turno deixa a tarefa ✕ (`parkDeadTurn`).
- Arquivo publicado: não leva mais `tasks`; as filhas vão cortadas (`trimPublished`); campo novo `turn`
  (`ended`, `aborted`, `replan`); o painel volta do arquivo publicado da própria sessão
  (`restoreFromOwnFile`); arquivos de sessões que o app não lista são esvaziados (`sweepPublished`).
- O `plan` não abre mais o painel; o `session.start` abre uma vez por processo (`paneOpened`).
- Subagente terminado sem tarefas sai do estado quando o pedido sai do trabalho (`dropSettledSubs`).
- `state/tasks.ts`: o `build` aceita o id completo; o id curto não alcança o histórico.
- `hooks/tools.ts`: nível 1 concluído reabre no replano do mesmo pedido (`replanned`); o título do
  pedido é o do primeiro plan (campo `named` no tipo `Turn`). Os textos de `RULES` e `TOOLS.plan` já
  mudaram por causa dos dois.
- Selos: `--remover` grava registro, `--renomear` existe, a contagem de asserções segue os helpers do
  kit, e `--recontar` regrava as contagens.
- Release: o cálculo da versão está em `scripts/versao.mjs`.
- Kit (`tests/kit/ambiente.ts`): `fixar` devolve `log`; o armazém aceita `recusar`; o host aceita
  `pasta`, `listaFalha`, `arquivoProprio` e devolve `gravados()`.

## 8. O que ficou só na máquina antiga

**Memória local do Claude Code.** As regras dela que este trabalho usa já estão no `CLAUDE.md`, no
`PROCESSO.md` ou aqui. Duas não estavam em arquivo nenhum do repositório; a sessão nova as grava na
memória dela, do jeito dela:
- Ao falar com o usuário, descrever cada item pelo que ele faz, nunca só por um código de relatório ou
  de lote. Motivo: ele costuma não ter o documento na frente (pedido de 2026-10-22).
- `docs/task-tree-proposta-visual.svg` é só demonstrativo e está desatualizado. Não serve de referência
  nem de prova de que o painel está certo; o que vale é o painel real no app (2026-10-23).

**`CLAUDE.md` global do usuário.** É privado, não foi publicado e pode não existir nesta máquina. Dele,
este trabalho usa só as regras de PR, repetidas na seção 9.

## 9. Fechamento, quando o último lote estiver em commit

1. Conferir a árvore limpa e o check verde na ponta.
2. Push de `fix/achados-medios` e UM PR para o `main`:
   - título no formato Conventional Commits, `fix(task-tree): …`. Com o "Release" ativo, o merge sobe a
     versão de patch (0.15.1 para 0.15.2);
   - descrição com o que muda (um item por commit ou por grupo), a validação (check, contagem de testes,
     testes reescritos por decisão) e o checklist do app. Nenhuma linha da descrição pode começar com
     "BREAKING CHANGE:": desde esta rodada, é essa linha, no rodapé, que sobe a versão major;
   - a descrição termina com a linha de atribuição do Claude Code que a sessão receber;
   - labels: usar as que o repositório já tem e descrevem o PR (existem `bug`, `documentation`,
     `enhancement`, `task-tree`, `tests`, `refactor`, `ci`, `desenho`); criar só a que faltar, depois de
     conferir que não há equivalente; conferir que ficaram no PR; dizer ao usuário quais foram aplicadas.
   - a cada push posterior na mesma branch: reler o título e a descrição, atualizar a descrição e rever
     as labels, e dizer ao usuário o que mudou.
3. O usuário valida no app, pelo checklist acumulado. Até a parada, ele tinha:
   - `/clear` numa filha que terminou o turno com pergunta aberta: o cartão dela na mãe deixa de ficar
     âmbar em até 3 segundos;
   - o cartão de uma neta visto na sessão avó;
   - o painel de uma sessão antiga voltando inteiro;
   - o painel fechado seguindo fechado nos plans e na recarga;
   - o arquivo de uma sessão apagada esvaziado depois de um dia.
   Cada lote acrescenta os seus itens; a orquestradora mantém a lista aqui.
4. Com tudo pronto, nenhum agente rodando e o passo seguinte dependendo dele, a pergunta com os
   próximos passos, pelo `AskUserQuestion`. Candidatos: os 123 achados de severidade baixa; os 10 não
   confirmados (precisam de medição no app); o lote da ferramenta antiga de mensagem (B-26) e o da
   leitura dos arquivos publicados só quando mudam (C-13); a comparação de prints do painel nativo;
   apagar as branches já mescladas e a branch de notas.

## 10. Pontos em aberto que a sessão nova herda

- **Deduções dos planejadores:** as 8 do índice A e as do índice B valem como estão escritas; nenhuma
  contraria decisão registrada. Três do B já viraram resposta do usuário (lotes B-09, B-15 e B-16, na
  nota de decisões).
- **Decisão 32 (`/clear` com filhas):** "Some na hora" foi lido como definitivo; mensagem nova a uma
  dessas filhas mostra só a carta.
- **Conflitos entre triagens:** estão na seção 10 de cada plano. Os mais fortes: funções de tempo
  (A-07, A-22, B-18, B-19, C-26), `sendAnchor` (A-14 com B-02 e B-03), a contagem (`total`,
  `allTasks`, com A-16 a A-20 e B-05, B-06, B-14) e os textos de `text/rules.ts` (C-15 a C-24).
- **Golden:** devem mudar o cenário `principal` os lotes B-18 e B-19 (tempo do cabeçalho) e talvez o
  C-26; o C-27 acrescenta dois cenários; o B-20 muda o cabeçalho estreito sem mudar o golden. O usuário
  valida tudo no app antes do merge.
- **Ritmo medido:** cerca de 12 minutos por lote nos primeiros; os lotes de A e B são maiores.

## 11. O que fazer ao ler este arquivo

O usuário retoma com um prompt de uma linha (seção 12). Ao recebê-lo, a sessão nova:

1. Assume o papel de orquestradora deste trabalho, como descrito no `PROCESSO.md` e na seção 3.
2. Lê, nesta ordem: `PROCESSO.md` e `CLAUDE.md` (raiz do repositório) e, em `<notas>`,
   `orq-decisoes-medios.local.md` e `orq-instrucoes-implementador-medios.local.md`.
3. Descobre os caminhos reais desta máquina (o clone, a pasta irmã de notas e o próprio scratchpad),
   para usá-los nos prompts no lugar dos marcadores.
4. Confere a seção 2: branch `fix/achados-medios`, ponta `0716717` ou depois, árvore limpa, `gh` na
   conta AlbertKellner, `core.hooksPath` em `.githooks`, painel de tarefas presente, e `npm install`
   seguido de `npm run check` verde. Se algo falhar, para e relata; não contorna.
5. Grava na memória dela as duas regras da seção 8.
6. Diz ao usuário, em poucas linhas, o que entendeu e o que conferiu, confirma com ele o modelo e o
   esforço dos agentes (seção 3) e pergunta o que estiver em dúvida.
7. Continua de onde o trabalho parou: os lotes da seção 6, na ordem, lançados como na seção 4. Sem push
   nem PR antes do fim dos lotes.

Registro: decisões novas do usuário vão para `<notas>/orq-decisoes-medios.local.md`, com as palavras
dele e a data. A pasta de notas é um clone git da branch `notas/achados-medios`; para levar o trabalho
a outra máquina de novo, é fazer commit e push dela, sem nomes nem caminhos da máquina.

## 12. O prompt de retomada

Numa sessão do app aberta no clone do trabalho:

> Leia o arquivo `..\claude-code-mod-task-tree-notas\RETOMADA.md` e retome os trabalhos.
