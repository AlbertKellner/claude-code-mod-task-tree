# Retomada do trabalho em outra máquina

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-14, ao parar o trabalho na máquina antiga, e
revisto em rodadas no mesmo dia, a pedido do usuário ("revise em loop e veja se faltou algo para
continuarmos o que paramos, exatamente do mesmo jeito, até que não falte mais nada"). As rodadas
incluíram ensaios em clones novos, por agentes sem o contexto da conversa. Leia este arquivo inteiro
antes de qualquer ação. A conversa da sessão antiga não viajou: tudo o que a sessão nova precisa está
aqui e nos arquivos que ele cita.

## 1. Onde as coisas estão

- **Repositório:** `claude-code-mod-task-tree`, no GitHub, na conta AlbertKellner.
- **Branch do trabalho:** `fix/achados-medios`, já no remoto, ponta `0716717`. Sem PR aberto.
- **Notas:** branch `notas/achados-medios` do mesmo repositório (nunca entra no `main`). Elas têm de
  ficar numa PASTA IRMÃ do clone do trabalho, com o nome do clone mais `-notas`
  (`claude-code-mod-task-tree-notas`), fora do repositório do trabalho.
- **Marcadores:** nos arquivos de notas, os caminhos da máquina antiga foram trocados por marcadores:
  `<repo>` é o caminho do clone do trabalho; `<notas>`, o da pasta irmã de notas; `<scratchpad>`, o
  scratchpad de quem lê; `<usuario>` só aparece em arquivos de rodadas antigas. Os arquivos ficam com os
  marcadores (não os troque no disco: a pasta é pública). Todo prompt de agente começa dizendo o caminho
  real de `<repo>` e de `<notas>` (seção 4).

## 2. Preparar a máquina nova

O que só o usuário faz está marcado com (usuário); o resto a sessão confere, como diz a seção 11.

1. Clonar o repositório e entrar na branch do trabalho:
   `git clone https://github.com/AlbertKellner/claude-code-mod-task-tree.git` e
   `git checkout fix/achados-medios`.
2. Trazer as notas para a pasta irmã, sem misturar com o clone do trabalho (rodado na pasta que contém
   o clone):
   `git clone --branch notas/achados-medios --single-branch https://github.com/AlbertKellner/claude-code-mod-task-tree.git claude-code-mod-task-tree-notas`
3. Ferramentas: git, Node com npm e o `gh`. Os agentes usam um shell do tipo bash (na máquina antiga, o
   Git Bash) e, às vezes, `python3` para editar arquivos; nenhum script do repositório depende de Python.
4. (usuário) App desktop do Claude Code instalado e aberto ao menos uma vez: o check usa o binário do
   app, em `%APPDATA%\Claude\claude-code\<versão>\`. Fora do Windows, ou com o binário em outro lugar,
   a variável `CLAUDE_BIN` aponta para ele.
5. (usuário) **Mod carregado DESTE clone, e não do marketplace.** Na máquina antiga isso estava em
   `~/.claude/settings.json`:
   - em `env`: `CLAUDE_CODE_PLUGIN_DIRS` com o caminho da pasta `task-tree` do clone (outros mods, se
     houver, separados por `;`), `CLAUDE_CODE_PLUGIN_DIR_WATCH` igual a `"1"` (recarga a cada arquivo
     salvo) e `CLAUDE_CODE_WORKFLOWS` igual a `"1"`;
   - em `enabledPlugins`: `"task-tree@claude-code-mod-task-tree": false`, para a versão instalada pelo
     marketplace não rodar junto com a do clone.
   A sessão não edita a configuração do Claude Code por conta própria. Ela confere: no shell,
   `echo "$CLAUDE_CODE_PLUGIN_DIRS"` tem de mostrar a pasta `task-tree` deste clone; as ferramentas
   `mcp__task-tree__plan`, `start` e `done` têm de existir; e a pasta do item 6 tem de existir. Se algo
   faltar, ela avisa o usuário e espera. Essas conferências não mostram se a versão do marketplace
   está desligada: a sessão pergunta isso ao usuário.
6. **Tipos do kit.** A pasta `task-tree/.claude-plugin/types/` (ignorada pelo git) é gravada pelo motor
   do Claude Code quando ele carrega o mod de uma pasta, e regravada a cada atualização do app. Não é o
   `claude plugin validate` que a gera, ao contrário do que dizem hoje o `CLAUDE.md` do repositório e
   dois comentários de `scripts/testes.mjs` (ver seção 10). Sem ela, o `npm run check` falha na etapa
   `tsc` com centenas de erros (ensaiado num clone novo em 2026-11-14). Com o passo 5 feito e uma sessão
   aberta, a pasta aparece no clone. Se não aparecer, a sessão para e avisa o usuário. O que a gerou no
   ensaio foi, na raiz do clone,
   `"<binário do app>" -p "ok" --plugin-dir "<repo>/task-tree" --max-turns 1` (o binário é o que
   `node -e "import('./scripts/binario.mjs').then(m=>console.log(m.acharBinario()))"` mostra). Esse
   comando abre outro Claude Code e gasta um turno de modelo na conta do usuário: quem o roda é o
   usuário, ou a sessão com o sim dele.
7. (usuário) `gh` autenticado na conta **AlbertKellner** (`gh api user -q .login` tem de responder
   `AlbertKellner`; `gh auth status` mostra todas as contas logadas, e a ativa tem de ser essa). Todo
   uso do `gh` e todo push são por essa conta, e só por ela. Push sempre com
   `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <branch>`.
8. (usuário) **Identidade do git, nos DOIS clones (trabalho e notas).** Na máquina antiga, o nome e o
   e-mail do autor estavam gravados só na configuração local do clone (`.git/config`), porque a
   identidade global daquela máquina era a de outra conta. Um clone novo não traz isso: sem este passo,
   os commits saem com a identidade global da máquina. Em cada um dos dois clones:
   `git config user.name "<o mesmo nome dos commits>"` e `git config user.email "<o mesmo e-mail>"`,
   iguais aos do último commit da branch (`git log -1 --format="%an <%ae>"`).
   A sessão confere, e não segue se falhar: `git config user.email` tem de ser igual a
   `git log -1 --format=%ae`, e `git config user.name` igual a `git log -1 --format=%an`, nos dois
   clones. Nenhum commit, de nenhuma branch, pode sair com outra
   identidade: o usuário não quer rastro da outra conta neste repositório. (Na revisão de 2026-11-14,
   dois commits das notas saíram com a identidade errada por falta deste passo, e a branch de notas teve
   de ser republicada.)
9. Fim de linha: não importa. Na máquina antiga o git usava `core.autocrlf=true`; no ensaio, as etapas
   `regras`, `travas` e `selos` passaram com os arquivos em LF e em CRLF.
10. No clone do trabalho: `npm install` (ativa o hook de pré-commit; `git config core.hooksPath` passa a
    responder `.githooks`) e `npm run check` (todas as etapas `ok`; no ensaio, 306 testes em 15
    arquivos; leva alguns minutos). Quem roda os dois é um agente, como na seção 11. Se o
    `npm install` alterar o `package-lock.json` (npm de outra versão), a mudança não entra em commit:
    `git checkout -- package-lock.json`, e isso vai no relato.
11. (usuário) Sessão do app aberta no clone do trabalho, em modo automático de permissões, como na
    máquina antiga: sem isso os agentes param a cada comando para pedir autorização. A orquestradora
    terminou lá em Fable 5.2 (antes, Opus 5.5); o modelo e o esforço da sessão são escolha do usuário.
    A pasta de notas fica fora da pasta da sessão. Na máquina antiga, com o modo automático, a sessão e
    os agentes leram e escreveram nela (a trava, os patches, este arquivo) sem pedido de permissão; a
    orquestradora não sabe dizer se havia alguma permissão configurada além do modo automático. Se aqui
    o app pedir permissão para essa pasta, é o usuário quem dá.
12. Colar o prompt da seção 12.

Versões na máquina antiga, para comparar se algo se comportar diferente: Node 24.14.1, npm 11.11.0,
git 2.56.1 (Windows), `gh` 2.89.0, e o binário do app na 2.1.325 (a 2.1.321 também estava instalada; o
check usa a mais nova).

Não viajaram, e não são necessários para os lotes: `node_modules`, os tipos gerados, os outros mods da
máquina antiga (barra de progresso, faixa de sessão e semelhantes), a memória local do Claude Code e o
`CLAUDE.md` global do usuário (seção 8).

## 3. Como o trabalho é conduzido

- `PROCESSO.md` e `CLAUDE.md`, na raiz do repositório: papéis, lotes, paralelismo, golden, testes.
- `<notas>/orq-instrucoes-implementador-medios.local.md`: instruções que todo implementador lê.
- `<notas>/orq-instrucoes-planejador-medios.local.md`: instruções dos planejadores (os planos já estão
  prontos; só serve para um replano).
- `<notas>/orq-decisoes-medios.local.md` e `<notas>/orq-decisoes-pendencias.local.md`: as decisões do
  usuário desta rodada, com as palavras dele. São a fonte dos `Reescrito:` e dos motivos dos selos.
  Decisões de rodadas anteriores que alguns planos citam estão em `<notas>/orq-decisoes-altos.local.md`
  (2026-11-12, por exemplo "Cinza já no plan (Recomendado)"), em
  `<notas>/orq-decisoes-ajustes-nativo.local.md` (2026-11-13) e na origem dos cenários do catálogo
  `regras/`.
- `<notas>/medios-A-indice.local.md`, `medios-B-indice.local.md` e `medios-C-indice.local.md`: os lotes
  de cada triagem, as dependências e as deduções de cada planejador.

**Como o usuário trabalha com a sessão.**
- Tudo em português do Brasil: conversa, perguntas, relatos, mensagens de commit e descrição de PR.
- Antes de começar algo grande, ele pede as dúvidas "em loop": perguntar em rodadas, até não sobrar
  nenhuma, e só então agir.
- Ele manda mensagens no meio do trabalho. "Pare tudo" é parar todos os agentes e deixar o clone como
  no último commit. "Comece do zero" é descartar o trabalho parcial, sem que o agente novo o leia.
- Quando a sessão erra, ele quer saber com todas as letras, com o que foi feito para corrigir.
- Ele pergunta "o que falta?" e "quanto tempo?": a resposta traz contagem (feitos, faltando) e a conta
  da estimativa.
- Painel de tarefas errado é bug do mod, a corrigir no mod; nunca se muda o jeito de usar o painel.

**Quem faz o quê.** A sessão que recebe o prompt é a orquestradora: não escreve código nem planos. Ela
pergunta, registra, lança os agentes, confere os commits e relata; e faz ela mesma as operações de git
que não são commit de código (criar branch, push, abrir e atualizar o PR). Check, testes, código e
commits são dos agentes. O planejamento e a implementação são feitos por SUBAGENTES lançados por ela
com a ferramenta `Agent`, em segundo plano, e não por sessões filhas. Isso vem das palavras do usuário
para este trabalho, e não do `PROCESSO.md`, que fala só em "agentes": "quero que você faca do zero o
planejamento e a implementacao dos 4 itens, em subagentes separados"; "A implementação deve ser feita
conforme combinamos"; "quero continuar exatamente o que estamos fazendo […] do mesmo jeito que estamos
fazendo". Se esta máquina tiver uma regra geral de orquestração que mande abrir sessões filhas para todo
trabalho, ou que proíba a sessão do pedido de fazer push e PR, neste trabalho vale o pedido dele, como
foi feito na máquina antiga: os agentes são subagentes; o push da branch do trabalho, o PR, e os commits
e o push da pasta de notas são da orquestradora.

**Decisões desta rodada que valem sobre o texto do `CLAUDE.md`.** O `PROCESSO.md` diz que, na
divergência, vale o `CLAUDE.md`. Duas frases do `CLAUDE.md` foram substituídas, nesta rodada, por
decisões datadas do usuário, e valem as decisões:
- "A mudança fica sem commit até ele validar o painel no app" (golden): substituída por "Validar só no
  fim (Recomendado)", de 2026-11-14. O implementador regrava o golden citando essa resposta e faz o
  commit; o usuário vê tudo no app antes do merge. Não é preciso confirmar de novo a cada lote.
- "O usuário valida visualmente no app depois do commit local e só então libera push e PR": substituída
  por "Um PR só no fim", de 2026-11-14. Depois do último lote, a orquestradora faz o push e abre o PR
  sem esperar a validação; a validação no app vem antes do merge.
No arquivo de decisões, a nota da decisão 43 e o parágrafo "Situação" ainda falam em validar antes do
commit: são anteriores e foram substituídos pela mesma resposta.

Configuração dos agentes na hora da parada (o usuário trocou três vezes num dia: confirme no início e
registre cada troca no arquivo de decisões; uma troca vale a partir do próximo agente lançado):
- implementador: `model: "opus"`, `effort: "low"`;
- planejador (só se precisar de replano): `model: "fable"`, `effort: "medium"`.

Regras que valem e não estão no `PROCESSO.md`:
- Até três lotes por agente, na ordem da seção 6, um commit por decisão, check verde na cópia entre
  eles. O grupo pode juntar o fim de uma triagem com o começo da seguinte. Três é o teto: a
  orquestradora manda menos quando o índice mostra um lote grande. Na máquina antiga os grupos foram
  sempre de três, e os lotes feitos eram pequenos ou médios.
- A prova de que o teste novo falha antes da mudança é pedida a todo implementador (o `CLAUDE.md` diz
  que o teste "não precisa estar vermelho antes"; o usuário quis a validação pelo implementador). Vale
  para os testes que o plano diz que falham hoje; os que o plano marca "passa hoje" só são relatados.
- Um implementador por vez. O `PROCESSO.md` admite uma trilha paralela para lotes que só tocam
  `scripts/`, `.github/` e documentação; ela foi usada nos dois lotes do release e não há mais lote
  assim (o C-31 é o último commit e o C-30 depende dos de A e B).
- O implementador trabalha numa cópia no scratchpad e leva tudo ao clone de uma vez.
- Nunca dois conjuntos de testes ao mesmo tempo: a trava é a pasta `<notas>/.trava-testes`.
- O check não é repetido à mão no clone: roda na cópia e no hook do commit. Exceção: lote que regrava o
  golden.
- Golden: o implementador regrava com `--motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"`. A
  data do motivo é a das palavras do usuário e não muda com o dia.
- Selos e datas: o selo grava a data do relógio em que foi feito. A regressão local só aceita a falha de
  um teste antigo quando o selo de decisão (ou o golden aprovado) é do dia: selar e fazer o commit no
  mesmo dia; se virar o dia no meio de um lote, selar de novo antes do commit.
- Data do `Reescrito:`: os planos escrevem `Reescrito: 2026-11-14, …`, e o selo de decisão exige data
  igual ou posterior à do selo anterior do teste. Num dia posterior, a linha leva a data do dia e a data
  da decisão vai no texto: `Reescrito: <hoje>, decisão do usuário de 2026-11-14 ("palavras dele").` É
  regra da orquestradora, escrita na revisão de 2026-11-14 para o trabalho não parar; o usuário pode
  mudá-la. O caso certo de acontecer: o teste de `envios.test.ts` que muda nos lotes A-07 e A-18.
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
`subagent_type: "general-purpose"`, `model: "opus"`, `effort: "low"` e, se a ferramenta tiver o
parâmetro, `run_in_background: true`. A `description` aparece no painel do usuário: diga o que os lotes
fazem, e não só os códigos (por exemplo, "Implementar: start num pai, cancelar tarefa, fim do turno").
O prompt, trocando os caminhos pelos reais desta máquina e a lista de lotes:

> Marcadores usados nos arquivos de notas: `<repo>` = (caminho absoluto do clone do trabalho);
> `<notas>` = (caminho absoluto da pasta irmã de notas); `<scratchpad>` = o scratchpad da sua sessão.
>
> Você é o IMPLEMENTADOR de três lotes dos achados médios do mod task-tree, um depois do outro. Antes de
> tudo, leia e siga integralmente `<notas>/orq-instrucoes-implementador-medios.local.md`. Pasta dos
> planos: `<notas>`.
>
> Lotes, nesta ordem, um commit por decisão, com o check verde na cópia antes de passar ao próximo:
> 1. `medios-A-lote-04-plano.local.md`
> 2. `medios-A-lote-05-plano.local.md`
> 3. `medios-A-lote-06-plano.local.md`
> (índice: `medios-A-indice.local.md`, só para contexto; as deduções do planejador listadas no índice
> valem como estão escritas.)
>
> A ponta é (o hash do último commit) ou depois. O que os planos (escritos sobre `6d5e026`) não
> conhecem: (copiar os itens gerais da seção 7 do RETOMADA, atualizados, e as linhas por lote das
> seções 7 e 10 que citem estes lotes, se houver). Adapte.
>
> Se um teste existente protegido precisar mudar sem que o plano traga a decisão registrada (as decisões
> estão em `orq-decisoes-medios.local.md`), ou houver BLOQUEIO, pare nesse lote, guarde o patch parcial
> como as instruções dizem e relate.
>
> Relato: como as instruções pedem (o começo em até 400 caracteres, depois um bloco por lote).

O prompt não leva linha de atribuição: o implementador usa a que a sessão dele recebe do Claude Code,
que diz o modelo de fato usado. Na máquina antiga as instruções fixavam
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, e é o que está nos 19 commits; a regra mudou
na revisão porque a orquestradora não tem como saber em que versão o apelido `opus` resolve.

As linhas por lote das seções 7 e 10 não cobrem todos os lotes, nem tudo de cada um: são o que os
ensaios acharam. Para os demais, valem os itens gerais, e o implementador adapta pelo cenário do plano e
relata. A orquestradora não precisa analisar o plano antes de lançar.

Quando o agente termina, a orquestradora, no mesmo turno:
1. confere o que ele relatou (`git log --oneline`, `git status --short`; a árvore tem de estar limpa, a
   trava solta, e o autor de cada commit novo com a identidade certa);
2. acrescenta à seção 7 o que o relato disser que mudou e que os planos seguintes não conhecem, e à
   seção 9 os itens do checklist do app que o relato trouxer (eles vêm da seção 9 de cada plano);
3. lança o agente dos próximos lotes;
4. relata ao usuário, em poucas linhas: o que cada commit muda para ele no painel, o resultado do check,
   a contagem de testes, se o desenho mudou, o que entra no checklist do app e quantos lotes faltam.

Ao falar com o usuário, descreva cada lote pelo que ele faz. O código do lote (como "A-04") nunca vai
sozinho: o usuário não tem o plano na frente.

**Parar um agente e limpar o que ele deixou.** Quando o usuário mandar parar, ou um agente travar:
1. Pare o agente com a ferramenta de parar tarefa em segundo plano da sessão (na máquina antiga,
   `TaskStop`, com o id do agente).
2. Antes de relançar, confira o que ele deixou (`PROCESSO.md`, seção 7): `git log`, `git status --short`
   e a pasta da trava. Um agente pode ter feito o commit de um lote e estar no meio do seguinte.
3. Se a árvore do clone ficou suja (lote aplicado sem commit): guarde o que há com
   `git diff --binary HEAD > "<notas>/descartados/<lote>-parcial.patch"`, volte os arquivos listados com
   `git checkout -- <arquivos>` e, se houver arquivo novo que o git não conhece, olhe-o e apague-o um a
   um (nada de `git clean` no clone real). Remova a trava que tenha sobrado (`rmdir`) e apague a cópia
   que o agente deixou no scratchpad. Nenhum agente lê a pasta `descartados\`.
4. O lote interrompido recomeça do zero, pelo plano. Foi o que se fez com o A-04 em 2026-11-14 (o
   usuário escolheu "Recomeça do zero (Recomendado)", e aquele patch nem foi guardado).
Diferente disso é o lote que o próprio implementador para, por bloqueio ou teste protegido: o clone fica
limpo, o patch parcial fica no scratchpad dele e o relato diz o caminho. Com a decisão do usuário, o
implementador seguinte recebe no prompt o caminho do patch e a decisão, e pode aproveitá-lo (foi assim
com a poda dos subagentes, o C-10).

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

Os planos estão em `<notas>/medios-<X>-lote-<NN>-plano.local.md`. Existem também os planos dos lotes que
ficam de fora (A-21, B-26, C-13): não os despache.

1. **Triagem A, 22 lotes:** A-04 a A-20 e A-22 a A-26. O A-21 não existe como lote (absorvido pelo
   A-07). O A-04 (start num pai inicia a primeira subtarefa) estava pela metade quando o trabalho
   parou e foi desfeito: recomeça do zero, pelo plano.
2. **Triagem B, 25 lotes:** B-01 a B-25. O B-26 fica de fora (depende de um ensaio no app).
3. **Triagem C, 14 lotes:** C-15 a C-27 e C-30. O C-13 é opcional e fica de fora.
4. **C-31 por último:** tem de ser o último commit de teste e selo da branch (regrava quase todos os
   hashes dos selos).
5. **Fechamento** (seção 9).

A ordem não contraria nenhuma dependência obrigatória dos índices nem dos planos (conferido no ensaio).

Fora desta rodada, por decisão do usuário: os 10 achados "não confirmados", os 123 achados de
severidade baixa da auditoria e a comparação de prints do painel nativo.

## 7. O que os planos não conhecem

Os planos foram escritos sobre `6d5e026`. Cada prompt de implementador precisa dizer o que mudou desde
então. Até a ponta `0716717`:

- `restoreLinks` virou `ensureLinks` (primeiro uso das ligações), chamado também em `agentSpawn`,
  `agentReceive`, `promptSubmit` e `toolCall`; as fusões `union`/`fill` saíram da tabela de durabilidade
  e o tipo `When` perdeu `'first-save'`.
- `saveStore` não lança mais e devolve se gravou (`guarded`, `pruneStore`, `storeFailure`); `saveGroups`
  devolve `{ saved, back }` e `restore` devolve se o store tinha o painel. `io/log.ts` ganhou
  `debugOnce`, e o `/task-tree` (`hooks/command.ts`) ganhou a linha do store.
- Saíram `STATE_KEYS`, `STORES`, `LINK_KEYS` e `stateOf` de `state/durability.ts`; a etapa `regras`
  confere a tabela de durabilidade contra as chaves do state. Chave nova do state, e variável de módulo
  nova, ganham linha na `TABLE`. `PER_SESSION` é a lista dos prefixos do store que `pruneStore` apaga
  por sessão (`session`, `work`, `turn`, `links`): campo novo num registro que já existe sai junto com
  o registro; só um prefixo novo no store precisa entrar na lista.
- `/clear` (o handler de `hooks/session-start.ts` foi reescrito: `dropHeld`, depois `forgetChildren`,
  depois `replace`): tudo é zerado antes de publicar (`dropHeld` zera as esperas, `brief` e `recap`);
  filhas abertas antes somem (`forgetChildren`, campo `left`; zera também `launches` e `ended`), e
  `isLeftBehind` (em `hooks/panel.ts`, usado no `sentMessage` de `hooks/tool-call.ts` e no
  `refreshChildren` de `hooks/sessions.ts`) impede que elas ganhem cartão ou rodada.
- Retomada (`source === 'resume'`): roda `dropHeld`; sem cópia no store, o painel fica vazio; e roda
  `parkDeadTurn`. Processo morto no meio do turno deixa a tarefa ✕ (`parkDeadTurn`, que chama `park`).
- Arquivo publicado: não leva mais `tasks`; as filhas vão cortadas (`trimPublished`, em
  `draw/layout.ts`); campo novo `turn` (`ended`, `aborted`, `replan`) no tipo `Publication`; o painel
  volta do arquivo publicado da própria sessão (`fromOwnFile`, `restoreFromOwnFile`); arquivos de
  sessões que o app não lista são esvaziados (`sweepPublished`, com `allSessionIds`, `sessionGone` e
  `staleFiles` em `io/host.ts` e `emptyPublished` em `io/publish.ts`).
- O `plan` não abre mais o painel; o `session.start` abre uma vez por processo (`paneOpened`).
- Subagente terminado sem tarefas sai do estado quando o pedido sai do trabalho (`settledSubs`,
  `dropSettledSubs`).
- `state/tasks.ts`: o `build` aceita o id completo; o id curto não alcança o histórico.
- `hooks/tools.ts`: nível 1 concluído reabre no replano do mesmo pedido (`replanned`); o título do
  pedido é o do primeiro plan (campo `named` no tipo `Turn`). Os textos de `RULES` e `TOOLS.plan` já
  mudaram por causa dos dois.
- Selos: `--remover` grava registro, `--renomear` existe, a contagem de asserções segue os helpers do
  kit, e `--recontar` regrava as contagens. A etapa `selos` ganhou regras: "tipo `novo` em teste que já
  existia", "asserções do selo diferentes das contadas", "selo apagado sem registro" e "cenário do
  golden sumido". A lista `CENARIOS` foi de `scripts/golden.mjs` para `scripts/selos.mjs`. Saiu a
  constante `ASSERCOES` (a lista vem de `assercoesDoKit` e `KIT_LEITURA`), e `testesDe` ganhou um
  parâmetro.
- `testes:alterados` e `impacto`, sem mudança fora de commit, comparam o último commit.
- Release: o cálculo da versão está em `scripts/versao.mjs`.
- Kit (`tests/kit/ambiente.ts`): `fixar` devolve `log`; o armazém aceita `recusar`; o host aceita
  `pasta` (a resposta do `fs.list` simulado), `listaFalha`, `arquivoProprio` e devolve `gravados()`; o
  `get_session` simulado responde "Session <id> not found." para id que não é a própria sessão nem uma
  filha conhecida; a filha aceita `painel.work` e `painel.filhas`.
- Há cerca de 900 linhas de testes novos em `arvore`, `pedidos`, `durabilidade`, `sessoes` e
  `subagentes`: conferências dos planos do tipo "nenhum outro teste faz X" têm de ser refeitas na ponta.
- Números de linha: os dos planos são da base `6d5e026`. Deixaram de valer em `hooks/panel.ts` (mais de
  300 linhas novas), `hooks/session-start.ts`, `hooks/sessions.ts`, `hooks/tools.ts`, `io/publish.ts`,
  `io/host.ts`, `state/durability.ts`, `state/tasks.ts`, `text/rules.ts` e nos arquivos de teste que
  cresceram. O índice A diz que "seguem valendo": foi escrito antes dessas mudanças. Ache o trecho pelo
  nome.
- O `DESENVOLVIMENTO.md` ainda cita `restoreLinks`, `STATE_KEYS`, `STORES`, `LINK_KEYS`, `stateOf` e
  `union`: os lotes de documentação (A-26 e C-30) encontram o documento atrás do código.

Planos que contavam com um lote da triagem C vindo depois, e a C já entrou (apontado nos ensaios de
2026-11-14 e conferido no código pela orquestradora; o prompt do lote leva a linha). Cada linha diz o
fato e o que ele pede; o resto da adaptação é do implementador, pelo cenário do plano:
- **A-07** (a tarefa ◷ segue ◷ até o start): a ponta já publica `turn.ended`, mas o plano não precisa
  dele (grava a hora do fim na própria tarefa, que vai publicada dentro de `groups`). Nada a mudar por
  isso.
- **A-08** (↩ de pedido sem tarefa num pedido próprio): `trimPublished` guarda só os turnos das tarefas
  mantidas, então o turno que só tem ↩ não vai no painel de uma neta republicado para a avó. O cenário
  do plano fala do cartão desta sessão na mãe, que lê o arquivo da própria filha, com os turnos
  inteiros: nada a mudar por isso; o caso da avó fica como está e é relatado.
- **A-09** (turno que morre por erro fica ✕ "falhou"): o registro `turn` do store, que ganha o campo
  novo, hoje é espelhado no arquivo publicado (montado em `publishPanel`, lido em `io/publish.ts`, usado
  por `restoreFromOwnFile`), e `parkDeadTurn` grava as chaves do turno. O campo novo precisa do mesmo
  tratamento nesses pontos, ou o painel que volta do arquivo perde a marca; o implementador decide o
  alcance e relata.
- **A-12 e A-14** (leitura das filhas; carta e cartão antes do plan): mexem em `sentMessage`, onde hoje
  está o `isLeftBehind` (ele também está no `refreshChildren`).
- **B-10** (recibo que sobrevive à recarga): o plano deixava para a C incluir a chave nova no que é
  apagado quando o painel de uma sessão sai do store. A poda já existe, e a chave do plano é um campo do
  registro das ligações (prefixo `links`), que já é apagado inteiro: nada a acrescentar em
  `PER_SESSION`. `restoreLinks`, que o plano cita, hoje é `ensureLinks` (o state vence o store).
- **B-25** (nome do destino na carta): pelo plano, a chave nova vive só no state e não vai ao store;
  `PER_SESSION` não entra. O lote mexe no `get_session` simulado do kit, que mudou (item do kit, acima).

Apontado no segundo ensaio e NÃO conferido pela orquestradora no código (o implementador confere):
- **A-13** (higiene das filhas arquivadas e do publicado): o plano diz que `children` vai ao arquivo
  "sem corte"; a ponta já corta com `trimPublished`, com regra própria no nível mais fundo (`DEEP`).
  Parte do plano já está feita, com outra regra.
- **A-23, A-24 e A-25** (`/clear` numa filha mantém o histórico; arquivada antiga vira linha; dobras no
  `/clear`): o handler do `/clear` foi reescrito, e a retomada sem cópia no store agora esvazia o
  painel. Campo novo no grupo principal ou na filha tem de sobreviver a `trimPublished`, e
  `fromOwnFile` devolve `children` do arquivo próprio.
- **B-10**, além do que está acima: `fromOwnFile` devolve `sends` e `received` sem a marca nova.
- **C-17** (resultado do plan com avisos): o plano avisa que o A-02 muda o segundo aviso; o A-02 já
  está em commit.
- **B-19** (tempo só com o turno em curso): o campo dos intervalos precisa sobreviver a `trimPublished`
  e ao tipo `Publication`, e é este lote que confere o caso de `parkDeadTurn`.
- **B-08 e B-24** (relançar depois de falha; subagente retomado): a poda `dropSettledSubs` já entrou. O
  B-24 manda decidir "com o outro plano em mãos": o prompt desse lote autoriza a leitura de
  `medios-C-lote-10-plano.local.md`.
- **C-27** (golden ampliado): os dois cenários novos entram em `CENARIOS`, que agora está em
  `scripts/selos.mjs`.

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

1. Um agente roda o check do PR inteiro e relata os números. Parâmetros: `general-purpose`,
   `model: "opus"`, `effort: "low"`. Prompt:

   > Marcadores: `<repo>` = (caminho do clone do trabalho); `<notas>` = (caminho da pasta de notas).
   > Tarefa de conferência, sem mudar nada: não edite arquivos, não sele, não faça commit nem push.
   > No clone `<repo>`, branch `fix/achados-medios`, com a árvore limpa (se não estiver, pare e relate):
   > rode `git fetch origin`; depois, com a trava dos testes (a seção "Trava dos testes" de
   > `<notas>/orq-instrucoes-implementador-medios.local.md`), `npm run check -- --base origin/main`; e
   > `npm run testes:alterados -- --pr`. Relate: cada etapa do check (`ok` ou a falha, com o texto), a
   > contagem de testes, quantos testes da base rodaram contra o código novo, quantos falharam e, para
   > cada um, se há decisão registrada (o check diz), e a lista dos testes existentes que mudaram.

   Esses números vão para a descrição do PR. Falha sem decisão registrada é regressão: corrige-se no
   código, por um implementador, antes do PR. Com `--base`, a regressão aceita o selo de decisão de
   qualquer dia. O plano do C-31 avisa que, depois dele, a comparação dos hashes dos selos com a base
   fica pulada para o PR inteiro (o jeito de calcular o selo muda): leia os números com isso em mente.
2. A orquestradora confere a árvore limpa e faz o push de `fix/achados-medios` e UM PR para o `main`
   (PR comum, não rascunho, como os anteriores; o merge é do usuário, depois de validar no app):
   - título no formato Conventional Commits, `fix(task-tree): …`. Com o "Release" ativo, o merge sobe a
     versão de patch (0.15.1 para 0.15.2);
   - descrição com o que muda (um item por commit ou por grupo), a validação (check, contagem de testes,
     testes reescritos por decisão) e o checklist do app. Nenhuma linha da descrição pode começar com
     "BREAKING CHANGE:": desde esta rodada, é essa linha, no rodapé, que sobe a versão major;
   - a descrição termina com a linha de atribuição do Claude Code que a sessão receber;
   - labels: usar as que o repositório já tem e descrevem o PR (existem `bug`, `documentation`,
     `enhancement`, `task-tree`, `tests`, `refactor`, `ci`, `desenho`); criar só a que faltar, depois de
     conferir que não há equivalente; conferir que ficaram no PR; dizer ao usuário quais foram aplicadas;
   - a cada push posterior na mesma branch: reler o título e a descrição, atualizar a descrição e rever
     as labels, e dizer ao usuário o que mudou.
3. O usuário valida no app, pelo checklist acumulado. Dos 18 lotes já em commit, ele tem:
   - `/clear` numa filha que terminou o turno com pergunta aberta: o cartão dela na mãe deixa de ficar
     âmbar em até 3 segundos;
   - app fechado, ou `/model`, no meio do turno: ao voltar, a tarefa em andamento aparece ✕
     "interrompida", com o relógio parado, e a mensagem seguinte replaneja ou dá start;
   - recarga a quente com uma carta entregue e o lembrete já dado: uma só linha "Para …", sem lembrete
     repetido;
   - `/clear` numa sessão com filha trabalhando: o painel fica vazio e segue vazio; mensagem à filha
     antiga mostra só a carta, verde na entrega;
   - `/task-tree` sem a linha do store em uso normal;
   - "+N pedidos anteriores" sem os cartões dos subagentes que não planejaram tarefas;
   - o cartão de uma neta visto na sessão avó;
   - o painel de uma sessão antiga voltando inteiro;
   - o arquivo de uma sessão apagada esvaziado depois de um dia;
   - o painel fechado seguindo fechado nos plans e na recarga, voltando na mensagem seguinte, e
     abrindo com `/model`;
   - no merge do PR: a nota do workflow "Release" diz patch ou minor conforme o título.
   Cada lote acrescenta os seus itens (seção 9 do plano e o relato do implementador); a orquestradora
   mantém a lista aqui.
4. Com tudo pronto, nenhum agente rodando e o passo seguinte dependendo dele, a pergunta com os
   próximos passos, pelo `AskUserQuestion`. Candidatos: os 123 achados de severidade baixa; os 10 não
   confirmados (precisam de medição no app); o lote da ferramenta antiga de mensagem (B-26) e o da
   leitura dos arquivos publicados só quando mudam (C-13); a comparação de prints do painel nativo;
   apagar as branches já mescladas e a branch de notas.

## 10. Pontos em aberto que a sessão nova herda

- **Deduções dos planejadores:** as 8 do índice A, as do índice B e as que estão dentro dos planos valem
  como estão escritas; nenhuma contraria decisão registrada.
- **Três perguntas dos planos da triagem B já respondidas** (estão no arquivo de decisões, e os planos
  não foram atualizados):
  - B-09 (fim do subagente depois do Esc): o plano escreve no cenário "(pergunta em aberto)" sobre as
    outras tarefas paradas com Esc cujos subagentes terminaram antes do Esc. A resposta foi "Todas, como
    hoje": o código fica; o caso entra no cenário como o comportamento de hoje, com teste; a frase
    "pergunta em aberto" não vai para o catálogo. O prompt desse lote diz isso.
  - B-15 (tarefa concluída com subagente em segundo plano): "Segue ✓ (Recomendado)", que é a leitura
    do plano.
  - B-16 (faixa "em andamento"): "Do primeiro start (Recomendado)", que é a leitura do plano.
- **Decisão 32 (`/clear` com filhas):** "Some na hora" foi lido como definitivo; mensagem nova a uma
  dessas filhas mostra só a carta.
- **Frases dos índices que a ordem real desfez:** índice C, "Lote 12 e lote 21 da triagem A usam o mesmo
  campo novo" (o A-21 não existe; o campo `turn` já está na ponta); índice A, o teste do lote A-14 "pode
  ganhar o nome novo" (a correção de renome já entrou, e o plano manda manter o nome: vale o plano).
- **Conflitos entre triagens:** estão na seção 10 de cada plano. Os mais fortes: funções de tempo
  (A-07, A-22, B-18, B-19, C-26), `sendAnchor` (A-14 com B-02 e B-03), a contagem (`total`,
  `allTasks`, com A-16 a A-20 e B-05, B-06, B-14) e os textos de `text/rules.ts` (C-15 a C-24).
- **Golden:** devem mudar o cenário `principal` os lotes B-18 e B-19 (tempo do cabeçalho) e talvez o
  C-26; o C-27 acrescenta dois cenários; o B-20 muda o cabeçalho estreito sem mudar o golden. O usuário
  valida tudo no app antes do merge.
- **Correção de documentação fora dos planos, achada na revisão:** o `CLAUDE.md` (etapa 4 de "Como
  executar") e dois comentários de `scripts/testes.mjs` dizem que o `validate` gera
  `task-tree/.claude-plugin/types/`. Quem gera é o motor, ao carregar o mod de uma pasta (seção 2,
  item 6). A correção desses textos entra no prompt do agente que fizer o lote de documentação da
  triagem C (C-30), como item a mais, num commit próprio depois do commit do C-30 (o plano do C-30 é só
  o `DESENVOLVIMENTO.md`; este toca o `CLAUDE.md` e `scripts/testes.mjs`), e é relatada ao usuário. Não
  verificado: a CI de testes, se um dia for ligada, deve falhar no `tsc` pelo mesmo motivo.
- **Commits antigos das notas:** os dois commits da branch de notas que saíram com a identidade errada
  (`82734cc` e `d674971`) não estão mais em nenhuma branch, mas podem ser abertos pelo hash até o GitHub
  recolhê-los. Só o suporte do GitHub apaga antes; pedir é decisão do usuário.
- **Ritmo medido:** cerca de 12 minutos por lote nos primeiros; os lotes de A e B são maiores.

## 11. O que fazer ao ler este arquivo

O usuário retoma com um prompt de uma linha (seção 12). Ao recebê-lo, a sessão nova:

1. Assume o papel de orquestradora deste trabalho, como descrito na seção 3.
2. Lê, nesta ordem: `PROCESSO.md` e `CLAUDE.md` (raiz do repositório) e, em `<notas>`,
   `orq-decisoes-medios.local.md`, `orq-decisoes-pendencias.local.md`,
   `orq-instrucoes-implementador-medios.local.md` e os três índices (`medios-A/B/C-indice.local.md`).
3. Descobre os caminhos reais desta máquina (o clone e a pasta irmã de notas), para usá-los nos prompts
   no lugar dos marcadores.
4. Confere ela mesma, só com leitura, a seção 2: branch `fix/achados-medios`, ponta `0716717` ou
   depois, árvore limpa no clone do trabalho (a pasta de notas pode ter edições da orquestradora ainda
   sem commit); `gh` na conta AlbertKellner; a identidade do git igual à dos commits nos dois clones; o
   mod carregado deste clone e a pasta de tipos presente (itens 5 e 6). Se algo falhar, para e relata
   ao usuário; não contorna e não muda configuração.
5. Diz ao usuário, em poucas linhas, o que entendeu e o que conferiu, confirma com ele o modelo e o
   esforço dos agentes (seção 3), pergunta se a versão do marketplace do mod está desligada e pergunta
   o que mais estiver em dúvida. Só lança agente depois dessa confirmação.
6. Lança um agente para conferir o ambiente (`general-purpose`, com o modelo e o esforço confirmados
   para o implementador):

   > Marcadores: `<repo>` = (caminho do clone do trabalho); `<notas>` = (caminho da pasta de notas).
   > Conferência do ambiente, sem mudar código: não edite arquivos rastreados, não faça commit nem push.
   > No clone `<repo>`, branch `fix/achados-medios`: rode `npm install`; confira que
   > `git config core.hooksPath` responde `.githooks` e que existe
   > `task-tree/.claude-plugin/types/tsconfig.json`; depois, com a trava dos testes (a seção "Trava dos
   > testes" de `<notas>/orq-instrucoes-implementador-medios.local.md`), rode `npm run check`. Relate
   > cada etapa (`ok` ou a falha, com as primeiras linhas), a contagem de testes, as versões de `node`,
   > `npm`, `git` e do binário do app que o check usou, e se `git status --short` ficou vazio (se só o
   > `package-lock.json` mudou, volte-o com `git checkout -- package-lock.json` e diga).

   Só segue com o check todo `ok`.
7. Grava na memória dela as duas regras da seção 8.
8. Continua de onde o trabalho parou: os lotes da seção 6, na ordem, lançados como na seção 4. Sem push
   da branch do trabalho nem PR antes do fim dos lotes.

Registro: decisões novas do usuário vão para `<notas>/orq-decisoes-medios.local.md`, com as palavras
dele e a data; o que muda a cada agente vai para este arquivo (seções 5, 6, 7 e 9). A pasta de notas é
um clone git da branch `notas/achados-medios`. A regra "nenhum push até o fim" é da branch do trabalho;
a de notas, a orquestradora publica (commit e push, com a identidade certa da seção 2, item 8, e sem
nomes nem caminhos da máquina nos arquivos) quando o usuário disser que vai mudar de máquina de novo,
ou quando ele pedir.

## 12. O prompt de retomada

Numa sessão do app aberta no clone do trabalho:

> Leia o arquivo `..\claude-code-mod-task-tree-notas\RETOMADA.md` e retome os trabalhos.
