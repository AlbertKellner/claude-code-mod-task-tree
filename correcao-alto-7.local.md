# Correção do achado alto 7: subagentes lançados juntos não se veem, e o cartão de grupo não se forma

Data: 2026-11-11. Plano feito só com leitura do repositório (branch `fix/achados-altos-auditoria`, HEAD `def10c8`).
Ensaio numa cópia (clone no scratchpad): `npm run check` passou inteiro, com os 3 testes novos vermelhos no código de HEAD.
Diff aplicável sobre HEAD: `<notas>\correcao-alto-7.diff`
(`git apply --check` passou no repositório).

**BLOQUEIO: nenhum.** A correção aplica as regras que já existem. Fica de fora uma pergunta da auditoria, de severidade baixa, que não muda esta correção (ver "Fora desta correção").

## Causa

`agentSpawn` (`task-tree/hooks/agents.ts`) lê os grupos uma vez, logo depois de `next(e)`. Com essa leitura ele calcula fora do `change` a tarefa (`launchAnchor`) e o lote (`mate`, `batch`), faz mais `await` e só então grava. Os lançamentos de uma mesma mensagem correm juntos e leem o painel antes que algum deles grave:
- cada um grava o próprio `now` como lote. O desenho (`drawKids` em `draw/layout.ts`) agrupa por `sub.batch`, então os lançamentos ficam soltos em vez de "N subagentes";
- com duas tarefas em andamento, todos vão à primeira tarefa livre. Em série, a regra registrada põe um em cada.

O `update` do kit relê e repete em caso de conflito. Por isso, o que é decidido dentro do fecho do `change` enxerga os lançamentos já gravados.

Reproduzido no harness (código de HEAD, testes novos):
- 4 lançados juntos de uma tarefa, com o relógio andando: 4 cartões soltos, sem "4 subagentes";
- 2 lançados juntos com duas tarefas em andamento: os 2 ficam em "Primeira", nenhum em "Segunda";
- cartão de filha publicado com um lote por lançamento (lançamentos a 10 ms um do outro): 4 cartões soltos.

## Passo a passo

1. **`task-tree/hooks/agents.ts`**
   - `launchAnchor` se divide em `mainUses($)` (lê `children`, `sends`, `waits`, com as chaves literais deste arquivo) e `anchorIn(groups, parent, names, uses)`, que é puro. `launchAnchor` mantém a assinatura (o `tool-call.ts` o usa).
   - `agentSpawn`: lê `uses` antes (os lançamentos não gravam essas chaves). A tarefa (`anchorIn(all, …)`), o `mate` e o `sub` (com `batch`) passam a ser calculados dentro do fecho do `change`, sobre `all`, que é o estado atual repetido em caso de conflito. O `mate` ignora o próprio grupo (`g.agent !== agent`).
   - Sai a constante local `BATCH`. Ela é trocada por `SUB_BATCH`, importada de `draw/layout`.
2. **`task-tree/draw/layout.ts`**
   - `export const SUB_BATCH = 3000`, ao lado de `SUB_GROUP`.
   - Em `drawKids`, fora de workflow, o lote passa a vir dos tempos: mesmo loop e mesmo lugar (`parent|anchor`), em ordem de `at`, com um lote novo quando a distância até o anterior passa de `SUB_BATCH`. O nome do lote é o `at` do primeiro, igual ao `batch` que o `agentSpawn` grava, e por isso a chave de dobra `gg:<lote>` não muda. Assim também se corrigem painéis gravados e arquivos de filhas publicados por versões anteriores. O workflow segue por `run`.
3. **`regras/subagentes.md`**: dois cenários novos.
   - `subagentes.lancados-juntos-se-veem` (coberto). Aplica `varios-juntos-num-cartao-de-grupo` ("Cartão + grupo (Recomendado)") e `cartao-desde-o-lancamento` ("Vai à pendente (Recomendado)") aos lançamentos simultâneos, sem reescrever nenhuma delas.
   - `subagentes.lancados-juntos-no-app` (checklist).
4. **`task-tree/tests/subagentes.test.ts`**: um ajudante de topo, `juntos(on, relogio, ids)`, e três testes no fim do arquivo. O kit não muda.
   - O ajudante define stubs no próprio teste. `agent.spawn` devolve cada id 5 ms depois do anterior e anda o relógio 10 ms. Em `state.get`, as primeiras leituras de `groups` depois dos lançamentos ficam presas até chegarem tantas quantos os lançamentos. Assim cada lançamento lê o painel antes de outro gravar, de forma determinística. `presas()` devolve quantas ficaram presas juntas, e o teste afirma isso, o que prova que a corrida aconteceu.
   - `// Regra: subagentes.lancados-juntos-se-veem, subagentes.varios-juntos-num-cartao-de-grupo`: "quatro lançados juntos da mesma tarefa, com o relógio andando, ficam num cartão de grupo".
   - `// Regra: subagentes.lancados-juntos-se-veem, subagentes.cartao-desde-o-lancamento`: "com duas em andamento, dois lançados juntos vão um a cada tarefa, como em série".
   - `// Regra: subagentes.lancados-juntos-se-veem, subagentes.na-filha`: "o cartão de uma filha publicado com um lote por lançamento junta os quatro lançados juntos num cartão de grupo".
5. **Selos** (`regras/selos.json`): os 3 testes entram com `npm run regras:selar -- "task-tree/tests/subagentes.test.ts::<nome>" --tipo novo --motivo "auditoria 2026-11-10, achado alto 7"`. Os hashes já estão no diff, e o hash não depende do fim de linha (conferido).
6. **Aplicar de uma vez**, para não quebrar a recarga: `git apply ..\claude-code-mod-task-tree-notas\correcao-alto-7.diff`, depois `npm run check`, depois o commit local dos 5 arquivos (`git commit -- <caminhos>`).
   - Mensagem sugerida: `fix(task-tree): subagentes lançados juntos se veem e formam o cartão de grupo`.

## Resultado do ensaio

- `npm run check`: ok em regras, travas, selos, validate do marketplace e do mod, tsc, plugin test (186 testes em 15 arquivos, 0 falhas) e regressão (183 testes de HEAD contra o código novo, 0 falhas). O golden passou: os 4 desenhos não mudam, então não há aprovação de golden.
- Os testes novos, rodados 5 vezes seguidas: estáveis, de 200 a 350 ms cada (o limite é 5 s).
- `npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum". Novos: os 3 acima.
- Nenhum teste selado mudou e o kit não mudou.

## Impacto

`npm run impacto -- task-tree/hooks/agents.ts task-tree/draw/layout.ts` e `npm run impacto` sobre o diff dão o mesmo resultado:
- 94 cenários afetados. `draw/layout.ts` é código da área de quase tudo, e entre os afetados está `subagentes.lancados-juntos-se-veem` (3 testes).
- Checklist do app: `cabecalho.aviso-de-painel-grande-volta`, `subagentes.cartao-no-app`, `subagentes.lancados-juntos-no-app`, `ultracode.cor-e-corte`.
- Golden: `visual.desenho-principal`, `-cartao-filha`, `-envios`, `-subagente`, todos inalterados.
- Fora do mapa: nenhum.

## O que o harness cobre e o que fica no checklist

- **Coberto**: a leitura velha, simulada com as leituras de `groups` presas juntas e o relógio andando. Isso dá a mesma situação dos dados reais (lotes diferentes a milissegundos um do outro). Também a distribuição pela regra da carta com dois lançamentos simultâneos, e o desenho de dados antigos com um lote por lançamento.
- **Não coberto** (vai para `subagentes.lancados-juntos-no-app`, checklist): a ordem real dos hooks do app com lançamentos simultâneos. No app, lançar 4 ou mais `Agent` na mesma mensagem deve dar um cartão "N subagentes" sem cartões soltos; noutra vez, com duas tarefas iniciadas, 2 lançamentos devem dar um cartão em cada.

## Fora desta correção

- **Pergunta em aberto da auditoria** (achado baixo "'Lançamento conta como uso da tarefa' espalha lançamentos simultâneos…"): subagentes lançados juntos, ou do mesmo workflow, com mais de uma tarefa em andamento ficam todos na mesma tarefa, num cartão de grupo só, ou continuam distribuídos, um por tarefa?
  - A correção segue a regra registrada (Reescrito 2026-11-09, "Vai à pendente (Recomendado)"): lançados juntos dão o mesmo que em série.
  - O teste novo só afirma o caso decidido (dois lançamentos, duas tarefas: um em cada). O lote com mais lançamentos que tarefas e o workflow com várias tarefas não estão em teste.
  - Se você escolher "todos num cartão só", entra depois como `Reescrito:` em `subagentes.cartao-desde-o-lancamento`, sem desfazer esta correção.
- **`task-tree/hooks/tool-call.ts`, `launch()`**: o registro `launches` ainda calcula a âncora com a leitura velha. Ele só é usado por `identify` quando o grupo nasce antes do `agent.spawn` (o subagente chama `plan` antes de o lançamento ser ouvido), e o `agentSpawn` refaz a âncora. Ficou de fora para não mexer num caminho sem teste.
- **`batch` gravado**: continua sendo gravado, e certo (no fecho), por compatibilidade com o tipo e com os arquivos publicados. O desenho deixa de depender dele fora de workflow. Nenhum teste observa o valor gravado: o harness não lê o state pelo `$` do teste.
- **`DESENVOLVIMENTO.md`**: não foi atualizado, como nos commits dos achados 4 a 6.
