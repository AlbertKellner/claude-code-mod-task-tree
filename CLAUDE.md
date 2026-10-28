# claude-code-mod-task-tree

Mod do Claude Code (`task-tree/`) que desenha a árvore de tarefas da sessão num painel lateral.
Arquitetura e histórico de decisões: [task-tree/DESENVOLVIMENTO.md](task-tree/DESENVOLVIMENTO.md).
Regras de comportamento, uma por cenário: [regras/](regras/).

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
  linha, pela superfície terminal). Os testes falam de títulos e estados, nunca de funções internas.
- Limites do harness: 5 s por teste; um processo por arquivo; sem fs, rede ou processo dentro do
  teste; não verifica a pintura (cores, largura, cliques); não simula a recarga a quente (cada teste
  é um módulo novo com o estado vazio). Stubs `on(...)` vão antes da primeira chamada a `$`.
- O que o harness não alcança vai ao checklist do app (abaixo) e fica marcado `checklist` no catálogo.

## Como executar

    npm install      # uma vez: typescript para o tsc e o hook de pré-commit
    npm run check

Etapas, nessa ordem; a primeira que falha para:
1. `regras`: confere o catálogo `regras/` contra os testes (ids, estados, ligações).
2. `travas`: testa as regras do selo num repositório temporário.
3. `selos`: confere os testes e o kit contra `regras/selos.json`.
4. `claude plugin validate . --strict` e `claude plugin validate task-tree --strict`: manifesto do
   marketplace e do mod; também gera `task-tree/.claude-plugin/types/` (ignorado pelo git).
5. `tsc --noEmit`: só aviso por enquanto (erros de tipo antigos). Passa a bloquear quando zerar:
   corrigir aos poucos, junto com mudanças nos mesmos arquivos.
6. `claude plugin test task-tree`: todos os testes.
7. `regressao`: os testes de `HEAD` contra o código novo, numa pasta temporária; só com diferença em
   `task-tree/`.

Outros comandos: `npm run regras:selar -- "<arquivo>::<nome>" --tipo … --motivo "…"` (selar um
teste) e `npm run testes:alterados` (os testes existentes que mudaram, para o relato; `-- --pr`
contra a base do PR).

O binário é o do app desktop, na versão mais nova em `%APPDATA%\Claude\claude-code\<versão>\`;
`CLAUDE_BIN` escolhe outro. Use a mesma versão que roda a sessão.

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
  asserções não podem diminuir e o teste antigo precisa continuar passando.
- Teste novo é selado à mão (`--tipo novo`), e fica protegido a partir do commit seguinte.
- Regressão se corrige no código, nunca no teste. Se a mudança precisa alterar um comportamento
  protegido e não há decisão do usuário, pare e pergunte.
- O `npm run check` falha quando: um teste selado mudou sem selo novo; um teste coberto perdeu
  asserções; um arquivo do kit mudou sem selo; ou um teste de `HEAD` falha contra o código novo
  sem decisão registrada ("testes antigos, código novo").
- O hook de pré-commit (`.githooks/`, ativado pelo `npm install`) roda o check sobre o que vai no
  commit. Não use `--no-verify`.
- O relato da implementação cola a saída de `npm run testes:alterados` e o resumo do check
  (modelos em [regras/README.md](regras/README.md)).

## Editar o mod sem quebrar a recarga

- O mod costuma ser carregado deste clone e recarrega a cada arquivo salvo, em todas as sessões. Um
  estado intermediário que não compila aparece ao usuário como "reload failed" (a versão anterior
  segue carregada).
- Mudança em vários arquivos vai de uma vez: escreva numa cópia no scratchpad e copie tudo junto;
  rode `npm run check` antes do passo seguinte.
- Limites do validate que o código respeita (chave de `$.state` literal no arquivo que chama, `$`
  só em função de topo etc.): DESENVOLVIMENTO.md, "Limites do kit".

## Regras de uso do painel

Regra nova de como o modelo usa o painel vai em `task-tree/text/rules.ts` (`RULES`, descrições das
ferramentas, lembretes dos hooks), nunca na memória do Claude Code nem num CLAUDE.md da máquina.

## Checklist do app (validação visual do usuário)

Depois do commit local, o usuário valida no app, quando a mudança toca o que o harness não vê:
- largura real e recorte na borda, nos dois temas;
- cliques no ícone e no anel; tooltip; animação da linha nova; nada pisca à toa;
- recarga a quente real (salvar um arquivo com o painel aberto);
- sessões filhas reais (cartão, ✉ e entrega, filha parada e arquivada); avisos do app;
- modelo e esforço no cartão; status embaixo da caixa de mensagem.

## Release e PR

- A versão do plugin sobe sozinha no merge do PR, pelo título: `feat…` → minor; `!` depois do tipo
  ou `BREAKING CHANGE` no corpo → major; o resto → patch. Não edite a versão do `plugin.json`.
- Título no formato Conventional Commits; descrição e labels atualizadas a cada push.
