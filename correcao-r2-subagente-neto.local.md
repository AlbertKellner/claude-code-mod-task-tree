# Cartão do subagente lançado por outro subagente (rodada 2, PR #36)

Diff pronto, sem bloqueio: `correcao-r2-subagente-neto.diff` (nesta pasta), sobre `b02a9a9` + itens 1 e 2.
`npm run check` na cópia: todas as etapas ok (200 testes, 0 falhas; regressão: 196 testes de HEAD
contra o código novo, 0 falharam). Um arquivo do mod muda (`task-tree/draw/layout.ts`, só `trimToWork`).
Golden não muda. Nenhum teste existente muda.

## Decisão do usuário

2026-11-12, escolheu "Cartão do subagente neto", com a descrição "Fazer o cartão do subagente neto
aparecer depois que ele termina, como acontece com os outros subagentes"
(`orq-decisoes-altos.local.md`, "Achados novos"). É correção de bug: traz o teste que reproduz e o
cenário no catálogo.

## Causa confirmada

Reproduzido no harness (o kit já simula: `lancar($, { descricao, pai: 'sub-1' })` manda o
`agent.spawn` com o subagente de origem).

- O grupo do subagente lançado por outro é gravado com `parent` = id de quem o lançou e `anchor` = id
  da tarefa do plano de quem o lançou (`hooks/agents.ts`, `agentSpawn` e `anchorIn`); sem plano em
  quem o lançou, fica sem `anchor`.
- O desenho já sabe o lugar dele: `body` do grupo de quem o lançou pega `kidsOf(<esse agente>)` e
  desenha cada um sob a tarefa da âncora (`below`) ou no fim do cartão (`lost`). Enquanto roda, o
  cartão aparece certo.
- O corte para o trabalho atual (`trimToWork`, `draw/layout.ts`) decidia quem fica com uma regra só,
  para todos os grupos: `sem âncora || âncora entre as tarefas do loop principal || tem tarefa aberta
  || está rodando`. A âncora do subagente lançado por outro é uma tarefa do plano de outro subagente,
  nunca do loop principal. Enquanto roda, ele fica pelo "está rodando"; ao terminar, nenhuma cláusula
  vale e o grupo sai do desenho. O `trimToWork` é o mesmo para o cartão de uma filha (recursivo), então
  o defeito vale na raiz e dentro de filha.

A mesma linha tinha mais dois efeitos, vistos no ensaio (o achado da auditoria já citava "ou mantido
por coincidência de id"):

1. Lançado por um subagente sem tarefas (o caso mais comum: a maioria não usa o painel), o grupo fica
   sem âncora e a regra "sem âncora fica" o mantém para sempre. Quando o pedido sai do trabalho, o
   cartão de quem o lançou sai e o dele sobra, solto no fim do painel principal:
   `✓ Explore: achar o kit  Haiku 5.5 · concluído` depois do pedido novo.
2. Se uma tarefa da sessão tem o mesmo id da tarefa do subagente (ex.: o subagente planeja `B` e o
   pedido seguinte da sessão também planeja `B`), o cartão fica pela coincidência e, já sem o cartão de
   quem o lançou, é desenhado sob a tarefa nova da sessão.

## Onde o cartão é desenhado (as regras decidem, sem pergunta)

- `subagentes.cartao-desde-o-lancamento`: "o cartão aparece embaixo dessa tarefa" (a tarefa em
  andamento de quem lançou). O código já faz isso para quem lança sendo subagente: dentro do cartão
  dele, sob a tarefa dele.
- `subagentes.terminado-segue-cartao`: terminado, o cartão fica.
- `subagentes.cartao-fica-com-a-origem-fechada`: fechada a tarefa, o cartão segue embaixo dela; "sai
  junto com o pedido da tarefa, quando ele sai do trabalho".

Logo: o cartão fica onde já aparece enquanto roda (dentro do cartão de quem o lançou, sob a tarefa de
onde saiu, ou no fim do cartão quando não há tarefa) e sai junto com esse cartão.

## Correção

`task-tree/draw/layout.ts`, `trimToWork`: a escolha de quem fica passa a ser a função local `stays`:

- grupo principal, grupo com tarefa aberta ou subagente rodando: fica (como antes);
- lançado pelo loop principal, ou por um agente sem grupo (teammate, retomado): a regra de antes
  (`sem âncora || âncora entre as tarefas do trabalho`);
- lançado por um subagente que tem grupo: fica se o grupo de quem o lançou fica (recursivo, com
  guarda contra ciclo). Não olha mais as tarefas do loop principal.

Para todo grupo lançado pelo loop principal o resultado é idêntico ao de antes. Nada muda em
`hooks/agents.ts`, `hooks/panel.ts` nem no state: é só o corte do desenho, então vale também para
painéis já gravados e para o arquivo publicado das filhas.

Efeito colateral coerente com `cabecalho.numeros-somam-o-desenhado`: o subagente lançado por outro que
planejou tarefas saía do "d de n" ao terminar (o grupo era cortado); agora as tarefas dele seguem
contadas enquanto o cartão está à vista, como as de qualquer subagente.

### As duas variantes entram junto (avaliar)

Os efeitos 1 e 2 acima não estão na letra da descrição ("aparecer depois que ele termina"), mas são a
mesma linha e a mesma regra ("como acontece com os outros subagentes": o cartão sai com o pedido).
Não mudam teste selado, cenário decidido nem golden; cada um tem o seu teste. Sem eles, o cartão que
agora fica à vista continuaria indo parar solto no fim (ou sob tarefa alheia) quando o pedido saísse.
Se a orquestradora quiser só a letra da decisão: em `stays`, trocar a última linha por
`return g.anchor === undefined || under(g.anchor) || stays(from, [...seen, g.agent])`, retirar os dois
últimos testes e a frase "e sai junto com esse cartão…" do cenário. Recomendo manter como está.

## Catálogo (`regras/subagentes.md`, no fim do arquivo)

- Novo `subagentes.neto-segue-o-cartao-de-quem-o-lancou`, `Estado: coberto`. Origem: "auditoria
  2026-11-10 / rodada de correções; decisão do usuário, 2026-11-12", com as palavras dele; aplica
  `terminado-segue-cartao`, `cartao-desde-o-lancamento` e `cartao-fica-com-a-origem-fechada` sem mudar
  nenhuma. Sem `Código:` próprio (a área já lista `draw/layout.ts`).
- Novo `subagentes.neto-no-app`, `Estado: checklist (subagente real lançando outro no app)`.
- Nenhum cenário reescrito.

## Testes (`task-tree/tests/subagentes.test.ts`, no fim do arquivo)

Os quatro citam `subagentes.neto-segue-o-cartao-de-quem-o-lancou` e falham sem a correção (conferido:
196 passam, 4 falham com o `layout.ts` da base):

1. `terminado, o subagente lançado por outro subagente segue com o cartão "concluído" sob a tarefa de quem o lançou`
   (o bug decidido: aparece "trabalhando"; termina e segue "concluído" sob "Ler os testes"; quem o
   lançou fecha a tarefa e termina, o turno acaba, e os dois cartões seguem).
2. `numa filha, o subagente terminado que outro subagente lançou segue no cartão dele`
   (cita também `subagentes.na-filha`; painel publicado pela filha).
3. `lançado por um subagente sem tarefas, o cartão fica no fim do cartão dele e sai com ele, sem ficar solto no fim do painel`
4. `o cartão do subagente lançado por outro não vai para uma tarefa da sessão que tem o mesmo id da tarefa de quem o lançou`

### Selos (tipo novo)

O diff já traz os quatro em `regras/selos.json`. Se o diff colidir nesse arquivo, aplicar sem ele
(`git apply --exclude=regras/selos.json correcao-r2-subagente-neto.diff`) e selar, no Git Bash:

```bash
M='decisão do usuário, 2026-11-12: "Fazer o cartão do subagente neto aparecer depois que ele termina, como acontece com os outros subagentes"'
npm run regras:selar -- 'task-tree/tests/subagentes.test.ts::terminado, o subagente lançado por outro subagente segue com o cartão "concluído" sob a tarefa de quem o lançou' --tipo novo --motivo "$M"
npm run regras:selar -- 'task-tree/tests/subagentes.test.ts::numa filha, o subagente terminado que outro subagente lançou segue no cartão dele' --tipo novo --motivo "$M"
npm run regras:selar -- 'task-tree/tests/subagentes.test.ts::lançado por um subagente sem tarefas, o cartão fica no fim do cartão dele e sai com ele, sem ficar solto no fim do painel' --tipo novo --motivo "$M"
npm run regras:selar -- 'task-tree/tests/subagentes.test.ts::o cartão do subagente lançado por outro não vai para uma tarefa da sessão que tem o mesmo id da tarefa de quem o lançou' --tipo novo --motivo "$M"
```

Alternativa de uma linha, se só estes quatro estiverem sem selo: `node scripts/selos.mjs --novos --motivo "$M"`.

## Passos da implementação

1. `git apply correcao-r2-subagente-neto.diff` na raiz (toca um arquivo do mod só, `draw/layout.ts`:
   a recarga a quente recebe a mudança de uma vez).
2. Se `selos.json` colidiu, os comandos acima.
3. `npm run check`.
4. Commit local só dos quatro arquivos (`git commit -- regras/selos.json regras/subagentes.md
   task-tree/draw/layout.ts task-tree/tests/subagentes.test.ts`). Título sugerido:
   `fix(task-tree): cartão do subagente lançado por outro subagente segue depois que ele termina`.

## Resultado na cópia (binário 2.1.321)

- `npm run check`: ok regras (138 cobertas, 0 pendentes, 17 checklist; mapa sem avisos), ok travas, ok
  selos, ok validate do marketplace, ok validate do mod, ok tsc, ok plugin test (200 pass, 0 fail),
  ok regressao (196 testes de HEAD contra o código novo, 0 falharam).
- `npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum"; novos: os quatro acima.
- `npm run impacto` (igual a `npm run impacto -- task-tree/draw/layout.ts`): arquivo tocado
  `draw/layout.ts`; 95 cenários afetados (todos os de subagentes, sessões, cabeçalho, envios, turnos
  que passam pelo layout); checklist do app: `cabecalho.aviso-de-painel-grande-volta`,
  `subagentes.cartao-no-app`, `subagentes.lancados-juntos-no-app`, `subagentes.neto-no-app`,
  `ultracode.cor-e-corte`; golden: os quatro desenhos estão no mapa, e os quatro testes de golden
  passam sem mudança (nenhum cenário de golden tem subagente lançado por outro); fora do mapa: nenhum.
- Na cópia o `validate` não gerou `task-tree/.claude-plugin/types/`; copiei a pasta do repositório.

## Riscos e o que fica fora

- Subagente lançado por outro ainda rodando (ou com tarefa aberta) depois que o cartão de quem o
  lançou saiu do trabalho: segue como hoje (fica pelo "está rodando" e, sem o grupo de quem o lançou
  no desenho, cai no loop principal: solto no fim, ou sob uma tarefa da sessão com o mesmo id). Lido
  no código, não ensaiado. É o cartão vivo órfão, do item seguinte.
- Dentro de um cartão de grupo ("N subagentes", "Workflow · N agentes"), o que um agente lançou só
  aparece com a linha desse agente aberta (fechada por padrão). Já era assim rodando; não mudei.
- A tarefa de quem o lançou fechar (ou não) pelo fim dele (`settleBySubs` percorre todos os grupos só
  no fim do turno principal; o fim do subagente interrompe o que ele deixou aberto): achado da
  auditoria sobre o estado das tarefas, não sobre o cartão. O usuário escolheu só o cartão.
- Reabrir "+N pedidos anteriores" não traz de volta cartões de subagente de pedidos fora do trabalho
  (nem os lançados pelo loop principal). Não mudei.
- Mais linhas no desenho (cartões que antes sumiam): o limite de linhas (`limitRows`) segue valendo.
- `task-tree/DESENVOLVIMENTO.md` não foi editado (as correções anteriores da rodada também não o editaram).

## Checklist do app (`subagentes.neto-no-app`)

Numa sessão real, pedir um subagente que lance outro (ex.: um `general-purpose` que chama `Agent`):

- uma vez com o primeiro usando o painel (plan e start): ao terminar o segundo, o cartão dele segue
  "concluído" sob a tarefa do primeiro, dentro do cartão do primeiro; segue depois que o primeiro
  termina e o turno acaba;
- outra vez sem o primeiro usar o painel: o cartão do segundo fica no fim do cartão do primeiro;
- mandar um pedido novo com plano: os dois cartões saem juntos, nada fica solto no fim.

O harness não confirma que o app real informa o subagente de origem no lançamento nem que entrega o
fim do segundo com o id dele; isso só o app mostra.

## Arquivos que o diff toca

- `task-tree/draw/layout.ts` (só `trimToWork`, 17 linhas a mais, 4 a menos);
- `task-tree/tests/subagentes.test.ts` (4 testes no fim);
- `regras/subagentes.md` (2 cenários no fim);
- `regras/selos.json` (4 selos novos).

## Para o planejador do item seguinte (subagente "em segundo plano" para sempre)

- Mudei só `trimToWork` em `draw/layout.ts` (locais novos `byAgent` e `stays`, no lugar do `.filter`
  de uma linha). Não toquei `hooks/agents.ts`, `hooks/panel.ts`, `hooks/turn.ts`, tipos nem kit.
- No state, o subagente lançado por outro é um grupo como os demais: `{ agent, label, parent: <id de
  quem o lançou>, anchor?: <id da tarefa do plano de quem o lançou>, tasks, sub }`. `parent` vem de
  `e.parentAgentId` do `agent.spawn` (`agentSpawn`); pelo caminho antigo (`identify`, no primeiro
  plan), de `AgentInfo.parentId`.
- `$.agent.list()` nos tipos do kit (`task-tree/.claude-plugin/types/claude-code/index.d.ts`):
  - `AgentInfo` (linhas 125-190): `id`, `description`, `type`, `status`, `parentId?` ("The id of the
    agent whose loop spawned it; absent when the main loop did"), `teammateId?`, `spawnedBy?`, `name?`.
    A lista é plana, da sessão inteira: o subagente lançado por outro entra como qualquer um, com
    `parentId` = id de quem o lançou. Conferir cartão vivo por `g.agent` contra `id` cobre os dois níveis.
  - `AgentStatus` (linha 566): `'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'`.
  - `list` (linhas 3383-3391): "One entry an agent, until the engine drops its task: as a teammate
    ends or seconds after, a subagent's later"; laços sem `agent.spawn` (skill em fork) aparecem; os de
    workflow não. Linhas 197-200: os agentes de workflow e os forks do motor têm ids que nenhuma lista nomeia.
- No kit, `lancaveis` e `subagente` (`tests/kit/ambiente.ts`) respondem o `agent.list` com `{ id,
  type, description }`, sem `status` nem `parentId`, e listam todos os ids sempre (terminados também).
  Um teste de "não listado" ou de `status` precisa de stub próprio no teste (`on('agent.list', …)`
  antes da primeira chamada a `$`, como `subagentes.test.ts:541`) ou de mudança no kit com selo
  (`node scripts/selos.mjs --kit <arquivo> --tipo refatoracao --motivo "…"`). Cuidado: com o critério
  "sem `status` = não está rodando", os testes atuais (lista sem `status`) encerrariam cartões vivos.
- `hooks/turn.ts:159` já chama `$.agent.list()` no fim do turno de cada subagente (para pular teammate).
- Com a minha mudança, o cartão órfão que você marcar "interrompido" com `end` deixa de ficar pelo
  "está rodando" e passa a seguir o cartão de quem o lançou (fica com ele, sai com ele). Antes, sumiria
  na hora. O que ainda roda depois que o cartão de quem o lançou saiu continua solto no fim (ver Riscos).
- `settleBySubs` trata todo grupo como dono: se você chamar depois de encerrar cartões órfãos, a
  tarefa do subagente que os lançou também reflete o fim.
- Colisão de texto: o meu diff acrescenta no fim de `regras/subagentes.md` e de
  `tests/subagentes.test.ts` e quatro chaves em `regras/selos.json`; parta dele.
