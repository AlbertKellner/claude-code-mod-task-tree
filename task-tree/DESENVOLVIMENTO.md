# Desenvolvendo o task-tree

Notas para quem mantém o mod. Quem só usa não precisa disto: as regras de uso vão para o
modelo pelo próprio mod (seção `task-tree:regras` do prompt de sistema, lembretes e descrições
das ferramentas). Princípio do repositório (ver "Comportamento dos mods" no
[CLAUDE.md](../CLAUDE.md)): regra nova de uso do painel entra no `RULES` e, onde couber, nos
contextos dos hooks; nunca na memória do Claude Code nem num CLAUDE.md da máquina.

## Estrutura

- `.claude-plugin/plugin.json`: manifesto (nome, versão, `types`).
- `hooks/hooks.json` e `hooks/register.tsx`: o módulo de hooks.
- `draw/layout.ts`: o layout do painel (R12, fase 3, etapa 1): `layout(model, choices, now, ownId): Row[]`, função de topo e pura: não lê nada além dos argumentos (etapa 2). Saíram o relógio de módulo `drawNow` (`split(c, sisters, me, owner, now, memo)` recebe o `now`), o `WeakMap` de módulo `breaksMemo` (agora um `BreaksMemo` por desenho, criado por `newBreaksMemo()` no `layout()` e passado a `split`/`breaks`; chave explícita de `hits`: `lista|me|caminho|id|parte`, a mesma partição de antes) e o mapa lateral `sendsAt` (o `panel` calcula `pending` e o passa como parâmetro a `rows`/`turnRows`; só o grupo principal manda mensagens, os escopos de subagente recebem `[]`). `Model` = `{ groups, waits, children, sends (só as não tomadas), view, work }`; `Choices` = o atom `folds`. Leva junto os auxiliares puros de modelo que o `register.tsx` também usa (`count`, `total`, `split`, `atWork`, `trimToWork`, `limitRows`, `MAX_ROWS`, `SHOWN_TURNS`, `Row`, `Tone` etc.), exportados daqui. Só importa `../types`: sem import circular e sem `$`.
- `draw/geometry.ts`: a geometria do desenho num só lugar (R14, fase 2): constantes com nome (`CELL`, `col`, `TEXT_IN`, `CARD_IN`, `CARD_RIGHT`, `RING_IN`, alturas do cabeçalho etc.), `lineWidth`, `cardRight`/`textRight` e `overlay(kind, …)` (`'icon'`, `'ring'`, `'name'`). Não recebe `$`; `register.tsx` importa por `'../draw/geometry'` (o kit aceita import relativo de um `.ts` do plugin).
- `types/index.d.ts`: o contrato do `$.state` (`groups`, `waits`, `launches` e o legado `tasks`).
- `tests/task-tree.test.ts`: testes do `claude plugin test`.
- `tests/orcamento.test.ts`: teste de orçamento do desenho (ver "Validar e testar").
- `tests/fixtures/orquestradora-real.ts`: estado real de uma orquestradora (97 pedidos de nível 1, 70 turnos, 5 filhas), com títulos anonimizados; exporta `REAL`.
- `tests/svg-golden.test.ts`, `tests/golden/svg.ts` e `tests/golden/atualizar.mjs`: golden do SVG por tom (ver "Validar e testar").
- `text/rules.ts`: todos os textos que o plugin escreve para o modelo (R16, fase 2): `BRIEF` = 120 e `LIMIT` ("até 120 caracteres", interpolado nos 6 textos que citam o limite), `RULES` (seção `task-tree:regras`), `COMMAND`, `TOOLS`, `PROMPT`, `ASK`, `DONE`, `WRAP_UP`, `SEND`, `UNPLANNED`, `SESSION`, `EXAMPLE`. Ficam fora dele os resultados das tools ("Plano exibido…", "Concluídas: d/n…") e os `alt`/títulos do desenho.
- `tests/textos.test.ts` e `tests/golden/textos.ts`: golden dos 23 textos (ver "Golden dos textos").
- `state/durability.ts`: a tabela de durabilidade (R13, fase 2): `TABLE`, uma linha por chave, com onde vive (`lives`: state, state+store, store ou module), o prefixo do store, a regra de fusão (`merge`: current, fill, union, replace, none), `keep` e quando volta (`restoredAt`: start, resume, first-use, first-save). 15 chaves de `$.state` (com `recap`), 1 do store (`sessions`) e 15 variáveis de módulo (`lastRecap` saiu). Exporta também `merge`, `current`, `loadStore`, `saveStore`, `saveGroups` (com `KEEP` = 30) e o conjunto `loaded`.
- `tests/durabilidade.test.ts`: 63 testes sobre a tabela (ver "Tabela de durabilidade").
- `tests/reinicio.test.ts`: testes de reinício do processo e recarga a quente (ver "Validar e testar").
- `tests/publicado.test.ts`: leitura e escrita do arquivo publicado (ver "Arquivo publicado").
- `tests/limite-linhas.test.ts`: limite de 400 linhas do desenho (ver "Desenho do painel").
- `tests/layout.test.ts`: testes de layout diretos, sem mount e sem SVG, com o fixture real (14 testes, ~130 ms); chamam `layout(model, choices, now, ownId)` com o `Model` montado como o `refreshChildren` monta (ver "Testes de layout").
- `.claude-plugin/types/`: tipos gerados pelo engine em cada máquina. Não versionar.

Fase 1 da rede de proteção concluída: teste de orçamento (R6), golden do SVG (R7), reinício e recarga
(R8, com os 3 bugs corrigidos), contrato `Published` (R9), limite de linhas (R15) e limpeza de resíduos
(R20: removidos `Work.ring`/`topRing`, o anel na linha de tarefa, o parâmetro `pinned` e `_up`/`up`).
Critério atendido: um teste falha se o desenho crescer 50% ou se qualquer SVG mudar sem golden novo.

## Validar e testar

Use o binário da mesma versão do Claude Code que roda a sessão. Versões antigas acusam erros
falsos (a 2.1.268, por exemplo, não reconhece `tool.check`). O app desktop traz o próprio binário:
no Windows, em `%APPDATA%\Claude\claude-code\<versão>\<hash>\claude.exe`. Fora do app,
o `claude` do PATH.

A partir da raiz do repositório:

```
claude plugin validate .
claude plugin validate task-tree
claude plugin test task-tree
```

O primeiro confere o `marketplace.json` (e o README); os outros, o mod.

### Teste de orçamento do desenho

`tests/orcamento.test.ts` monta o painel com o fixture `REAL` nas quatro combinações superfície
(terminal/desktop) × visão (resumida/completa), com `bodyColumns` 100. Afirma que o desenho não
caiu no de emergência nem em erro, que `size`, `lines` e `svgs` ficam em até 1,5 × a `BASELINE`, e que
cada desenho leva menos de 500 ms. Imprime a linha `ORCAMENTO …` no log do kit.

- `size` no teste é o JSON da árvore que o kit devolve: proporcional ao `drawSize` do módulo, não igual.
- Se o desenho crescer de propósito, refaça a `BASELINE` em `orcamento.test.ts`: rode o teste numa cópia
  sem `task-tree.test.ts` e copie os números da linha `ORCAMENTO`.
- Baseline gravada (HEAD 6d79470, kit 2.1.308): terminal resumida 11.671 bytes/29 linhas, completa
  11.789/30; desktop resumida 47.416 bytes/28 linhas/30 Svg, completa 48.174/29/31; 14–41 ms.
- Com este fixture as duas visões medem quase o mesmo, porque o limite de 3 pedidos corta antes.

### Golden do SVG

`tests/svg-golden.test.ts` (7 testes, 12 cenários: basico, basico-concluido, retomada, filha-rodando,
filha-parada, filha-arquivada, filha-recolhida, envio, espera-propria, subagente, real-completa,
real-resumida) monta o painel no desktop com relógio e largura fixos, recolhe cada `Svg` (alt, largura,
altura, interativo, fonte) e compara com `tests/golden/svg.ts`. Cobre os 12 valores de `Tone`. A falha
lista por `Svg`: índice, alt, tamanho do golden × atual, ou o primeiro trecho de fonte diferente com contexto.

- `tests/golden/svg.ts` é gerado (`GOLDEN`, um `Svg` por linha, para o diff do git mostrar um SVG mudado
  como uma linha). Não editar à mão.
- O `alt` faz parte do golden de propósito: é o que o terminal lê.
- Mudança intencional de SVG (inclusive texto de `alt`): rode `node task-tree/tests/golden/atualizar.mjs [claude.exe]`
  e commite o `svg.ts` junto. O script copia `task-tree/` para uma pasta temporária só com o teste do golden, roda
  `claude plugin test`, recolhe as linhas `GOLDEN-NEW <cenário> <json>` e funde no `svg.ts`, mantendo os
  cenários que batem. Segunda rodada: "Nada a atualizar". A aprovação é o diff do `svg.ts`.
- Limite do kit: um teste não importa `node:fs`/`fs` (recusado ao carregar) nem vê `process.env`
  (`process` é `undefined`); por isso a atualização é um script, não uma variável de ambiente.

### Golden dos textos

`tests/textos.test.ts` (7 testes) coleta os textos que chegam ao modelo (descrições registradas no
`session.start`, regras do `prompt.compose`, contextos do `prompt.submit`, as três saídas do
`AskUserQuestion`, avisos do `done`, do `SendMessage` na fila, do `wrap_up`, da chamada sem plano e as
notas de sessão) e compara com `tests/golden/textos.ts`. Confere também que toda ocorrência de "até N
caracteres" diz 120 (pelo menos 6). Quando difere, imprime `TEXTOS-NEW <json>` para colar no golden.

- Regra: mudança de texto = golden novo, aprovado de propósito (como no golden do SVG).
- O limite do resumo mora em um lugar só, `BRIEF` em `text/rules.ts`; antes eram 6 strings (o 60 → 120
  tocou todas).
- O golden foi gerado com o código anterior à extração, e o teste passou sem diferença depois dela.

### Tabela de durabilidade

`state/durability.ts` diz, por chave, onde o dado vive e como volta. `tests/durabilidade.test.ts` roda
4 cenários por chave do state: A (planta pela API do mod e confere state/store), B (reinício com
`session.start`), C (reinício sem `session.start`) e D (recarga a quente com o state semeado); mais o
`sessions`, uma sanidade da tabela e "chave nova sem linha": um cenário largo grava toda chave do state
e todo prefixo do store tocados, e falha se algum não tem linha ou se alguma linha não é tocada. `engine`,
`ended` e `tasks` (legado) são plantados por semeadura.

- Chave nova de state ou de store: acrescente a linha em `TABLE`, senão o teste falha.
- Limite do kit: o validador exige que a referência `{ plugin, key }` de `$.state.get/set` seja literal
  no próprio arquivo (ou const dele); um `stateOf('x')` importado é recusado. Por isso as 15 consts de
  chave continuam literais em `register.tsx`, e o teste é que garante a correspondência com a tabela.
- Funções que recebem `$` em arquivo importado (`loadStore`, `saveStore`, `saveGroups`) passam no
  validador: a armadilha do `$` fora do topo não apareceu aí.

Divergências que a tabela expôs (a extração não mudou nada; a 1 e a 2 já foram corrigidas):

1. (corrigida) `view` e `work` só voltavam no `session.start`: num respawn do worker sem ele (reinício
   do hooks worker, `/model`), a visão caía na padrão e o próximo `plan` gravava `work` por cima do
   store. Agora `ensureView($)` e `ensureWork($)`, no molde de `ensureGroups`, trazem do store no primeiro
   uso (`restoredAt` = `first-use` na tabela, como `groups`); marcam `loaded` só quando o state recebe o
   valor e devolvem o que trouxeram para quem não pode gravar (o `ui.render` não pode: `$.state.set`
   lá dentro lança). Chamados em `change()`, `publishWait()`, `nothingOpen()` e no `ui.render`. Sem nada
   no store, o painel fica nos padrões. Teste: `reinicio.test.ts`, "sem session.start: a visão e o
   trabalho atual voltam do store no primeiro uso".
2. (corrigida) `lastRecap` era variável de módulo: recarga entre o `wrap_up` e o fim do turno perdia o
   recap (o cartão mostrava a mensagem final). Agora é a chave de state `recap`, como o `brief`
   (`merge` none, `restoredAt` vazio: sobrevive à recarga, morre com o processo); `lastRecap($)` lê o
   state ('' = nenhum), o `wrap_up` grava e o `turn.complete` lê e zera. Testes: `reinicio.test.ts`
   ("recap antes da recarga", 1/2 e 2/2) e a linha nova na tabela, com os 4 testes do laço.
3. `groups` no `resume` substitui o state (o `SessionStart` de resume chama restore sem olhar o state);
   no `session.start`, o state vence.
4. `sends` sem teto na fusão; `received` e `launches` com 20.
5. Um `Agent` só chega ao store na próxima publicação dos links (fica no state até lá).
6. A visão vai ao store só no clique (`setView`); nenhuma outra gravação a leva.
7. O `ended` não é consumido pelas tools do painel (`plan`/`start`/`done` não passam pelo `tool.call`
   genérico); o lembrete "terminou o turno" sai na próxima chamada comum ou no `prompt.submit`.

### Testes de layout

`tests/layout.test.ts` (14 testes) chama `layout()` direto. Fixture real (5): visão completa com 28 linhas
("+67 pedidos anteriores" no topo, "+41 cartões antigos de sessões" no fim, só os pedidos 71–73
desenhados, 2 cartões sob as tarefas 97 e 98, nenhum na raiz), o ↩ (presente no 71, suprimido nos
pedidos com cartão), o cabeçalho (conta só os nós desenhados, 8/14; chips 6 em andamento, 1 sessão
ativa, 0 aguardando, 0 ✉), a visão resumida (27 linhas, "+1 pedidos anteriores", sem cartões antigos) e o
determinismo. Modelos pequenos (9): ordem dos cartões (`begins`), cadeia, filha de filha aninhada, ↩ por
turno, "+N pedidos anteriores" com pedido antigo aberto, ✉ no painel e dentro de um cartão (`pending` por
escopo), aviso ao usuário, escolhas (linha fechada guarda `nodes`) e o corte de 400 linhas.

- Regra para quem mexer no layout: mudança de linhas → `layout.test.ts`; mudança de pixels → golden do SVG.

### Reinício e recarga

`tests/reinicio.test.ts` (11 testes, com o fixture `REAL`) cobre dois casos:

- **Reinício do processo** (`$.state` vazio, store cheio): cada teste do kit é um módulo novo com
  `$.state` vazio; o store passa entre testes por um objeto compartilhado. Testado com e sem `session.start`.
- **Recarga a quente** (state mantido, módulo novo, sem `session.start`): `seedState` põe hooks
  `state.get`/`state.set` abaixo do kit, espelha as escritas e devolve o state semeado nas leituras vazias
  (as versões continuam do kit). O teste de recarga recebe o state exato que o módulo montou no reinício anterior.

O que sobrevive a quê, como medido: `$.state` sobrevive à recarga e não ao reinício; o store sobrevive a
tudo; variáveis do módulo não sobrevivem a nada.

**Falhas conhecidas (`KNOWN`):** o kit não tem skip/todo. `known(nome, ok, detalhe)` e a lista `KNOWN`:
o cenário com bug imprime `TODO …` e passa; quando o bug for corrigido, o teste falha pedindo para tirar o
nome de `KNOWN`. Ao corrigir um bug, tire o nome da lista. Bugs abertos:

1. (corrigido, fora de `KNOWN`) `reinicio-sem-session-start`: ver "Grupos do store sem `session.start`" abaixo.
2. (corrigido, fora de `KNOWN`) `links-lista-parcial`: ver "Ligações com lista parcial do host" abaixo.
3. (corrigido, fora de `KNOWN`) `recarga-perde-summary`: ver "Resumo do turno no state" abaixo.

`KNOWN` está vazio; o mecanismo `known()`/`KNOWN` fica para bugs futuros.

Limite: o kit não simula o respawn real do worker.

### Ligações com lista parcial do host

Antes, com a lista do host parcial, `restoreLinks` só mapeava as filhas listadas e `saveLinks` gravava o
store sem as outras (uma filha com 20 rodadas sumia). Agora:

- `Link`/`linkOf` e `keptLinks: Map<id, Link>`: cópia, no módulo, do que o store guarda em
  `links:<id>.children`; preenchida em `restoreLinks` e atualizada em `saveLinks`. É variável de módulo,
  refeita na primeira gravação após a recarga (como `linksLoaded`).
- `saveLinks` grava a união: filhas do state (ligações atuais) + entradas de `keptLinks` cujo id não está no
  state. Logo `links:<id>.children` pode ter mais ids que o state; leitores fazem merge por id.
- `refreshChildren` e `recordStart`: uma filha que entra no state sem histórico recebe
  `anchor`/`lastAnchor`/`rounds` de `keptLinks`; a filha que o host volta a listar recupera as ligações.
- Regra: o desenho segue a lista do host; o store só não esquece. Entradas de filhas não listadas ficam inertes
  (não vão ao state, ao desenho nem ao arquivo publicado) e só reaparecem se o host listar o id de novo. O
  host lista com `include_archived: true`, então arquivada continua listada e marcada `archived`. Custo
  aceito: o store pode guardar ids de sessões apagadas.

### Resumo do turno no state

O `summary` do último `done` (a linha ↩) era a variável de módulo `lastBrief` e morria na recarga: o turno
ficava sem ↩ com o resumo (sobrava a mensagem final). Agora é a chave de state `brief`
(`brief: string` em `types/index.d.ts`; '' = nenhum):

- O `done` grava o `summary` no state; `turn.complete` lê, usa no ↩ e zera; os avisos "falta o summary" (no
  `done` e no `wrap_up`) também leem o state. A função de topo `lastBrief($)` lê a chave.
- Sobrevive à recarga; não ao reinício nem ao resume, o que é aceitável porque o turno morre com o processo.
- O contrato `PluginState['task-tree']` precisa listar a chave: o validador confere as chaves de state por ele.
- Armadilha: uma função que recebe `$` precisa estar declarada no topo do arquivo (o validador recusa dentro do
  `register`: "$ is passed to "lastBrief", which is not a function declared at the top of this file").
- O recap do `wrap_up` seguiu o mesmo caminho: chave de state `recap` (divergência 2 do R13), lida por
  `lastRecap($)`.

### Arquivo publicado

`publishWait` escreve `~/.claude/task-tree-waits/<id>.json` e a sessão mãe o lê. O contrato é o tipo
`Published` em `types/index.d.ts`: `version?`, `waiting`, `at?`, `tasks?` (versões antigas), `groups?`,
`waits`, `children`, `context?`, `engine?`, `panes?`, `renderError?`, `work?`, `received?`, `sends?`.

- `PUBLISHED_VERSION = 1`: `publishWait` escreve `version: 1` (`satisfies Published`). Formato só acrescido.
- `parsePublished(text)` (pura): JSON inválido, não-objeto (lista/número/string/null) ou `version` presente e
  ≠ 1 → `{ error }`; senão normaliza (listas que não são listas saem; `waiting` só `=== true`; `context` só
  com `percent` e `at` numéricos; `engine` só string não vazia; `work` mapeado a string).
- `readPublished($, id)`: lê, valida e registra uma vez por sessão e motivo no log de depuração
  ("task-tree: arquivo publicado de <id> ignorado: <motivo>"); ao voltar a válido, o motivo é esquecido.
  `refreshChildren` e `watchSends` usam `readPublished`; `breaks`/`split` leem `c.panel` já normalizado.
- Regra: arquivo inválido = "sem arquivo". A sessão aparece pela linha do host e o último painel válido
  continua desenhado (o mesmo que arquivo ausente).
- Versões mistas (clone × instalado): a sessão antiga lendo o arquivo novo ignora `version`; a nova lendo o
  antigo (sem `version`) lê normal; arquivo com `version` ≠ 1 é ignorado por inteiro (a sessão aparece só
  pela lista do host, sem painel). Um arquivo que o código antigo aceitava pela metade (ex.: `groups`
  não-lista) agora é lido como "sem painel". Quando uma mudança de formato exigir, suba `PUBLISHED_VERSION`
  e decida a compatibilidade na leitura.
- `tests/publicado.test.ts` (8 testes): `version` no arquivo escrito; válido; só `groups`; `{}`; versão
  antiga (só `tasks`); versão 2 (ignorada, 1 log, volta ao consertar, logada de novo ao quebrar); corrompido
  e tipos errados; `watchSends` com arquivo corrompido do destino (✉ fica; com `received` válido, some).

### Grupos do store sem `session.start`

Sem `session.start` (respawn do hooks worker, `/model`), o módulo novo tinha `$.state` vazio e a primeira
escrita partia de `[]`, sobrescrevendo `session:<id>` (o store ia de 97 para 0 tarefas). Agora `groups`
volta do store também sem `session.start`, como já valia para `links`:

- `keptGroups($, id)`: o painel como o store guarda (subagentes interrompidos); extraído de `restore`, que o usa.
- `groupsLoaded` e `ensureGroups($)`, no estilo do `linksLoaded`: se o módulo ainda não viu os grupos e o
  state está vazio, lê `session:<id>` do store e grava no state; devolve os grupos trazidos e só marca
  "carregado" quando a escrita no state vingou (ou o state já tinha, ou o store não tem nada).
- Chamado em `change()` (toda escrita), `publishWait()` (toda publicação), `nothingOpen()` (antes do
  `change` do `plan`) e no `ui.render` (`held = state ?? brought`). `session.start` marca `groupsLoaded = true`
  depois do `restore`.
- `view` e `work` continuam só no `session.start`, de propósito: `restoreView` na guarda mudaria o padrão do
  desenho ('full' no render × 'summary' no restore) e quebraria o golden; fica para o R13.
- Sem `session.start`, o desenho traz as tarefas do store, mas ainda não os cartões de sessão (a lista do
  host só é lida no `session.start` ou pelo poll).

Armadilhas: (1) um `$.state.set` feito de dentro do `ui.render` não vinga no kit (a leitura acontece, o
desenho segue vazio); por isso o render usa o valor devolvido por `ensureGroups` e a flag só sobe com a
escrita confirmada. (2) `claude plugin validate` recusa uma função que recebe `$` com o mesmo nome de uma
variável atribuída em outro lugar ("the function handed $ "saved" is assigned to elsewhere"); por isso
`keptGroups`, não `saved`.

## Desenho do painel

- Referência do visual aprovado pelo usuário (claro e escuro):
  [docs/task-tree-proposta-visual.svg](../docs/task-tree-proposta-visual.svg).
- O desenho é um pipeline: estado → `Model` → `layout()` (`draw/layout.ts`, puro) → `Row[]` → guides/frames
  → SVG/JSX → orçamento. O `ui.render` só lê o estado (groups, view e work com os `ensure*`, waits,
  children, sends, folds), monta o `Model` e chama `layout()`; tudo o que toca `$` fica no
  `register.tsx` (o limite do kit continua respeitado). `layout()` devolve uma lista de linhas (`Row`:
  profundidade, estado, título, contagem) com a mesma travessia para as duas superfícies; `guides` calcula, só pela sequência de profundidades,
  onde cada linha continua as guias dos ancestrais (`bars`), se fecha o próprio ramo (`last`) e se
  desce para as filhas (`down`).
- Desktop (`e.surface === 'desktop'` e `Svg` no `$.ui.resolve`): cabeçalho e cada linha são um `Svg`
  de altura fixa (cabeçalho 44/48/70 px; nível 1 30 px; demais 28 px), empilhados num `Box` coluna.
  Cada SVG desenha o seu trecho das guias até as bordas de cima e de baixo, para elas ficarem
  contínuas. Largura `clamp(240, bodyColumns * 8 - 8, 900)` (heurística, não contrato). O SVG é
  imagem: não herda o tema do app, por isso cada um traz as classes claro/escuro (`STYLE`, com
  `prefers-color-scheme`). Texto em SVG não quebra nem corta: `fit` corta com `…` por uma medição
  aproximada (`textW`). Nome cortado ganha tooltip com o nome inteiro (pedido do usuário: "mostrar
  tooltip com o nome completo da tarefa", para não ter de alargar o painel). A linha continua
  imagem; o tooltip vai numa camada própria por cima (`hoverLayer`): um `Svg` interativo
  (`isInteractive`, moldura isolada, sem scripts; no modo imagem não há tooltip) transparente, só
  com o `<title>` do nome completo. No cabeçalho, a camada cobre só a área do título, abaixo dos
  botões de visão. Motivo da camada (pedido do usuário: "a cada segundo que é atualizado o tempo,
  a linha pisca"): a moldura recarrega, e fica em branco por um instante, a cada mudança da fonte;
  com a linha inteira interativa, o relógio a fazia piscar a cada segundo. A fonte da camada não
  muda com o relógio. Sobre ela o ponteiro é a seta padrão, não o cursor de texto
  (`cursor:default;user-select:none`; pedido do usuário: "quero que o mouse seja o mouse padrão,
  seta"). Linha sem corte não tem camada; recolher não corta nome; terminal sem tooltip.
  Nos testes, o helper `desktop()` ignora as camadas por padrão. Quando os chips não cabem com as palavras, ficam só os números.
- Terminal (e qualquer superfície sem `Svg`): um `Text` por linha, com as guias `├─ └─ │` em texto
  e os glifos `○ ◉ ✓ ✕ ◷ ⑂`; linha recolhida ganha " ⋯" depois do nome (nas duas superfícies). A cor fica só no ícone; o título vai em negrito na tarefa em
  andamento (e no nível 1 aberto), apagado nas concluídas e interrompidas.
- Ícones: anel âmbar com ponto (em andamento), check verde (concluída), círculo cinza (aberta),
  ✕ cinza com "interrompida" à direita (interrompida), relógio âmbar (espera), ramificação cinza
  (sessão rodando), triângulo cinza (subagente com tarefas abertas).
- Cabeçalho: título do nível 1 em andamento (ou "Tarefas"), "X de Y · N%", barra verde e chips só
  acima de zero: em andamento (tarefas em andamento sem nada aberto embaixo), aguardando (avisos
  desenhados, mais as sessões que esperam sem aviso publicado), interrompidas (fora da
  porcentagem) e sessões ativas.
- Abrir e recolher pelo clique no ícone de progresso (pedido do usuário: "quero que o botao de colapse nao
  apareca, e que a funcao de colapsar e expandir esteja no icone de progresso da tarefa"): não há
  coluna ▾/▸. No terminal, o glifo do ícone é o próprio `Button` (só em linha que recolhe); no
  desktop, só o ícone é o alvo (pedido do usuário: "volte para a solucao anterior de somente o
  icone de progresso ser clicavel, e ajuste o tamanho do box atras para ocupar o tamanho do icone
  com adicional de padding nos 4 lados"; a linha inteira, tentada antes, saiu): a linha continua uma
  imagem só e um `Button` de rótulo vazio (um espaço em) fica sobre o ícone, num `Box` absoluto da
  altura da linha que o centra nos dois eixos. O `Box` fica em células inteiras (~8 px), mas o
  conteúdo é centrado em pixels: 3 células em profundidade par, 2 em ímpar; o meio cai a menos de
  0,5 px do centro do ícone. O tamanho do realce é o do botão nativo (um espaço em mais o padding
  dele), que o plugin não controla; centrado, a margem é igual nos quatro lados enquanto o botão
  nativo for simétrico. Linha sem nada embaixo não tem botão. A camada do tooltip cobre o nome
  cortado inteiro e começa depois do `Box` do ícone. Não usar a linha em três peças (Svg | Button
  | Svg, tentada em 6af2b20; pedido do usuário: "o layout quebrou, corrija"): o desktop desenha o
  `Button` como botão nativo opaco e os SVGs cortados deslocavam o cartão. Não há controle visível. Não visto ao vivo: se o botão sobre a imagem que muda a
  cada segundo pisca. O kit não tem tooltip em `Button`: o sinal de clicável é o ponteiro invertendo o botão.
  Recolhida, a linha ganha " ⋯" depois do nome; o `alt` continua dizendo "recolhida". Toda linha com algo embaixo (tarefa com subtarefas, aviso, sessão ou
  subagente pendurado; sessão com painel; grupo de subagente) ganha
  `Row.fold = { key, open }`. A escolha do usuário fica no atom `folds` (estado `collapsed`:
  `true` recolhida, `false` aberta; sem entrada, o padrão) e é gravada pelo `setFold`, helper de topo
  chamado do `onPress` (o render não pode gravar estado). Padrão: tudo vem aberto, nada recolhe
  sozinho ao concluir (pedido do usuário: "quando você finalizar as tarefas, não colapse os itens,
  se eu quiser, eu mesmo colapso"): tarefa concluída mostra todas as subtarefas, pedido (turno)
  concluído, cartão de sessão filha em qualquer estado e grupo de subagente fechado vêm abertos.
  Só o clique do usuário recolhe. Chaves: `<escopo><agente>|t:<id>`
  (tarefa; `|t:A/1` no grupo principal), `<escopo>s:<id local>` (sessão), `<escopo>g:<agentId>`
  (subagente); dentro do painel de uma filha, o escopo é `<id local>>`. O `Button`
  tem `key` `fold:<chave>`.
- O render monta as linhas duas vezes: sem escolhas (`plain`, para os chips, que não mudam ao
  recolher) e com as escolhas (`lines`, o desenho).
- Concluídas e interrompidas ficam no lugar delas na lista, na ordem do plano (pedido do usuário:
  "quero que elas continuem na listagem, marcando que foi concluida"); não há seção separada. Uma
  concluída vem aberta, como as outras, e recolhe pelo clique. O tom
  `section` do desenho ficou sem uso.
- Desktop: a linha é um `Svg` com o ícone de progresso clicável por um `Button` vazio num `Box` absoluto
  (ver o item do clique no ícone acima). Não há coluna de botão nem seta à esquerda: o `GUTTER` foi removido.
- Terminal: o nível 1 começa no ícone e cada nível recua 3 colunas. Linha que recolhe é um `Box`
  em linha (`Text` das guias, `Button` com o glifo do ícone, `Text`); linha sem nada embaixo não
  tem botão.
- Cartões (sessão filha e grupo de subagente): a linha de cabeçalho tem `Row.card`; o cartão
  pega ela e as linhas seguintes mais fundas. `frames` calcula, pela sequência de profundidades,
  em que cartões cada linha está (do de fora para o de dentro) e se ela abre ou fecha cada um. Cada
  `Svg` desenha a sua fatia do cartão (fundo `.cd` cinza claro / `#444441` no escuro, borda fina
  `.cs`, cantos de 6 px só na primeira e na última linha) e ganha `PAD` (6 px) em cima, onde o cartão
  abre, e 6 px embaixo por cartão que fecha nela; um cartão de dentro fica 6 px mais estreito à
  direita, e o texto da direita fica dentro do cartão mais interno. A guia que entra no cabeçalho
  para na borda esquerda do cartão. Cabeçalho da sessão: um rótulo solto, não uma tarefa (pedido do usuário: "deve
  ser um texto solto nomeando esse painel, e na linha de baixo a tarefa em si"): só o nome
  (`c.name`, ou o título sem nome), em 12 px, cinza e negrito, sem ícone de progresso, barra,
  contador, tempo nem guia até a tarefa da principal. À esquerda do nome, no lugar do ícone de
  uma tarefa, o ⑂, que é o botão de recolher o cartão (pedido do usuário: "coloque o icone se sessao
  filha do lado esquerdo do nome da sessao, e ele tera a funcao de colapsar o painel"; mesmo `Box`
  e centragem do ícone de progresso). À direita do nome, o estado em palavra ("aguardando" em âmbar, já que não há ícone para colorir;
  "parada", "concluída" e "arquivada" apagadas); o anel de contexto fica solto na ponta direita da
  linha. Contador e tempo da sessão vão só no `alt`
  ("Sessão: <nome> (<título>), d de n, estado, tempo"). As tarefas do cartão são raízes, a partir
  da linha de baixo, sem guia até o rótulo (no terminal alinhadas com ele; no desktop recuadas
  dentro do cartão). O cartão inteiro recolhe pelo clique no ⑂ (no terminal, o glifo ⑂ é o
  `Button`). A guia desce da tarefa da
  principal e entra no cartão, terminando na borda esquerda dele à altura do rótulo (pedido do
  usuário: "a linha de conexao ... esta interrompida, conecte ela no painel"). Recolhido, " ⋯" depois do nome. Subagente:
  `tipo: descrição`, contador e tempo. No desktop a linha ocupa a largura toda. No terminal não há caixa: o cartão vira a linha de cabeçalho
  ("⑂ filha  aguardando", com as tarefas embaixo), como no esboço 7.3 da análise.
- Resposta da sessão (↩; pedido do usuário: "adicione nos paineis de sessao, o que foi gerado como
  resposta, com um icone de resposta"): no fim de cada turno do loop principal da filha
  (`turn.complete`, não abortado), ela grava em `Turn.reply` o `recap` do `wrap_up` desse turno (o
  mesmo texto que abre o aviso de fim de turno da principal) ou, sem ele, a mensagem final visível
  (`answer`), numa linha de até 600 caracteres, e publica com o painel. No cartão (cada cartão é uma
  rodada), depois das tarefas, uma linha ↩ por turno com resposta, na ordem dos turnos: ícone
  cinza, texto apagado, sem barra, contador nem tempo; não é tarefa e não conta no d/n. A linha mostra um
  resumo de até 120 caracteres (`BRIEF`, em `text/rules.ts`), e o tooltip a resposta inteira (pedido do usuário: "devem
  ser um resumo", depois "aumente a resposta para 120 caracteres, esta muito sucinto"; antes eram
  60). Se a linha não couber na largura, o corte visual com "…" e o tooltip continuam. Fonte do resumo: só o campo `summary` do `done`, escrito pela própria
  sessão, tipo manchete, com o que mudou e o resultado (ex.: "Cartões na raiz: causa na recarga; correção
  enviada"); acima de 120
  caracteres, corta no limite de uma palavra com "…". Sem `summary`, a linha mostra só "resposta",
  com a resposta inteira no tooltip; nunca o texto da resposta cortado (pedido do usuário: "nao
  ficou bom, voce esta imprimindo o texto integral cortado. quero que seja um resumo da resposta,
  super curto"). Como o pedido chega a quem responde: o contexto do `prompt.submit` pede `summary`
  no `done` da última etapa do turno; no schema do `done`, `summary` tem descrição própria e `ids`
  deixou de ser obrigatório (dá para chamar `done` só com `summary`); um `done` que fecha a última
  tarefa aberta sem `summary` responde "falta o summary…", e um `wrap_up` sem `summary` no turno
  avisa "falta o resumo do turno…". O resumo fica em `Turn.brief` e a resposta inteira em
  `Turn.reply`. Sem linha enquanto o turno roda. Terminal: "↩ texto", apagado.
  No próprio painel da sessão (inclusive na orquestradora; pedido do usuário: "igual a sessao
  filha, as tarefas que tenham filhas precisam ter tambem a resposta com o icone de resposta"), o
  grupo da mensagem (linha do pedido, `turnRows`) ganha no fim, depois de todos os níveis 1 dele,
  uma linha ↩ com a resposta do turno, da mesma fonte e com o mesmo visual. Uma linha por turno,
  mesmo com vários níveis 1 ou com nível 1 sem filhas; tarefas soltas, de antes dos turnos, não têm
  ↩; a linha só aparece com o grupo aberto. Exceção: grupo com alguma tarefa que tem cartão de
  sessão filha embaixo (aberta por `start_session` ou acionada por `SendMessage`) não tem ↩; ali a
  resposta que conta é a das filhas, já nos cartões delas (pedido do usuário: "quando as tarefas da
  sessao orquestradora abrirem sessao, a resposta nao deve aparecer, senao, fica quebrado").
- Cliques por chave (pedido do usuário: "as vezes clico nas acoes e nao faz nada, preciso clicar
  algumas vezes para funcionar"): o host só guarda o `onPress` enquanto o desenho existe, e o painel
  redesenha a cada segundo, então o clique na troca do desenho se perdia. O hook `ui.press` responde
  pela chave do botão (`fold:`, `open:`, `view:`) com a ação mais recente (mapa `actions`/`act`), e
  cada press vai para o log de depuração ("task-tree: press <chave> (<superfície>)").
- Painel na tela (`showPane`; pedidos do usuário: "o tasktree nao esta aparecendo na orquestradora",
  "eu troquei o modelo de opus para sonnet na orquestradora, e o task tree nao rendenizou a partir
  dai"): aberto sem pedido (`session.start`, `plan`), o painel só é posto com 144 colunas ou mais;
  num prompt da própria pessoa, se não estiver na tela (ex.: depois do reinício de uma troca de
  modelo), é reaberto como pedido, em qualquer largura. `/task-tree` abre com pedido e responde o
  diagnóstico: o que o app disse (posto ou o motivo), os painéis (na frente, aba atrás de outro, não
  desenhado) e "Desenho: N KB de 600 KB."; `/task-tree resumida | completa` troca a visão sem clicar.
  O arquivo de `task-tree-waits` publica também `panes` (id, `isPlaced`, `isShown`) e
  `renderError`; se o desenho lança exceção, o painel mostra "Painel de tarefas: erro ao desenhar:
  …" e publica o erro.
- Tamanho do desenho (causa do sumiço: o da orquestradora tinha 1,6 MB e o app não o mostrava;
  "resumir os 57 pedidos anteriores resolveu"): o painel do topo desenha só os 3 últimos pedidos,
  mais qualquer um com algo aberto, e os anteriores viram a linha "+N pedidos anteriores"; cada
  cartão, até 3 pedidos, com a mesma linha; cartões sem tarefa de origem, concluídos e começados
  antes do pedido mais antigo desenhado viram "+N cartões antigos de sessões". O cabeçalho continua
  contando tudo. Cada `Svg` leva só as regras CSS das classes que usa (`slim`). Medido com o estado
  da orquestradora: 1.614.695 → 101.345 bytes na completa, 29 KB na resumida. Os três limites, em
  ordem: `SHOWN_TURNS` (3 pedidos) → `MAX_ROWS` (400 linhas, ver abaixo) → `DRAW_LIMIT` (600 KB): só
  se 400 linhas passarem disso, desenho de emergência: "Painel grande demais (N KB): mostrando só o
  essencial. Use ≡ (/task-tree resumida) para a visão resumida." (agora raro). Aprovado pelo usuário:
  "Sim, está bom".
- Limite de linhas (R15; mudança de visual aprovada pelo usuário: "Sim, com o corte"): `MAX_ROWS = 400` e
  `limitRows(rows)`, aplicado no `ui.render` logo depois de `panel()`, antes de guias, molduras e SVG.
  Até 400 linhas nada muda. Acima, saem blocos inteiros de nível 0 do começo (os mais antigos), contados
  numa linha de seção `+N linhas anteriores` (tom `section`, alt "Linhas anteriores, não desenhadas"); as
  recentes ficam. Se o último bloco sozinho passa do limite, o que vinha antes sai contado, o bloco é
  desenhado até o limite e fecha com `+N linhas` (profundidade 1, alt "Linhas seguintes, não desenhadas").
  Total sempre ≤ 400. Corta-se por blocos inteiros do começo porque o trabalho atual fica no fim e cortar
  dentro de um bloco quebraria as guias. O cabeçalho conta o que está desenhado ("sessão inteira: X de Y"
  no tooltip). No desktop as duas linhas são `Svg` de tom `section`, sem geometria nova. O caso real (31
  linhas) não muda. O arquivo publicado ganha `drawRows` (`rows` em `Published`) e `drawSize`, informativos
  (telemetria para a orquestradora ver o tamanho das filhas; os leitores não os usam). Testes:
  `tests/limite-linhas.test.ts` (4 testes: 750 linhas → 400 com `+N linhas anteriores` e contagem fechando
  em 750; bloco de 700 etapas → `+302 linhas` no fim; 100 linhas → nada muda; `rows`/`drawSize` publicados) e
  o teste "desenho grande demais" de `task-tree.test.ts`, que agora espera o corte.
- Cabeçalho por visão (pedido do usuário: "na visao resumida, quero que a barra superior reflita o
  que tem nessa visao ... cada visao deve refletir os dados do seu tipo de vizualizacao"; aprovado
  com "Sim, bate nas duas"): o cabeçalho (X de Y, %, barra, tempo e os chips "em andamento",
  "interrompidas", "sessões ativas", "aguardando") é a soma das linhas desenhadas na visão. Cada
  linha carrega as tarefas que representa (`Row.nodes`): uma folha, ela mesma; uma linha recolhida,
  a subárvore inteira (com as tarefas das sessões embaixo); um pai aberto, nada; seções, ↩ e avisos,
  nada. Resumida: só o pedido atual (ex.: "1 de 1 · 100% · 0:17"). Completa: só os pedidos
  desenhados pelo limite de 3, com a linha "+N pedidos anteriores". O total da sessão inteira vai
  discreto, só quando difere do mostrado: no terminal, "(sessão inteira: D de N)" depois do
  cabeçalho; no desktop, no `alt` do cabeçalho. A barra e o % seguem a lista visível. Recolher uma
  linha não muda os números.
- Tempo decorrido: `TaskNode.startedAt`/`endedAt` (ms, opcionais; o painel publicado para a sessão
  mãe leva os dois, e versões antigas os ignoram). `start` liga o relógio da tarefa (de novo, se ela
  estava concluída) e o dos pais que ainda não tinham; `done`, o fechamento automático do pai e a
  interrupção do subagente param. Cada linha de tarefa iniciada mostra o tempo à direita
  (`clockText`: `0:04`, `6:12`, `1:02:09`); o cabeçalho, o da sessão inteira (`sessionTime`, ver
  Contador); sessão e subagente, do primeiro início ao último fim das tarefas deles (`span`).
  Interrompida mantém o tempo até a interrupção. A hora vem de `$.clock.now` (`stamp`); sem ela (kit sem `on('clock.now')`), nada de tempo.
- Relógio de 1 s (`keepTime`/`tick`): um `$.clock.every(1000)` que chama
  `$.ui.invalidate('ui.render')` enquanto alguma tarefa roda (aqui ou numa filha viva) e se cancela
  quando nada roda. Começa no `start`, no refresh das filhas e em toda chamada de ferramenta do loop
  principal (a recarga do mod cancela os timers do módulo antigo).
- Nos testes: terminal por `ui.drawn()` (os filhos do `Box`; o `key` do JSX não chega ao
  `findAll`; o `Button` é lido pelo `label`), desktop pelo `alt` de cada `Svg` em
  `findAll({ type: 'Svg' })`. A seta se aperta com `ui.press({ key: 'fold:<chave>' })` (helper
  `fold` do teste); subagentes, ao vivo. Tempo: `on('clock.now')` com um relógio do teste e
  `on('clock.every', () => ({ deny }))` (um período negado encerra o intervalo). Cartões: pelo
  `class="cd"` e pela altura de cada `Svg`. Uma tarefa
  interrompida só nasce de subagente, que o kit não simula: o teste a traz pelo `store.get` de uma
  sessão retomada (`classic.SessionStart` com `source: 'resume'`).

## Armadilhas

- O engine recusa o módulo inteiro, e continua rodando a versão anterior, se `$` for passado para
  uma função que não está no topo do arquivo. Helpers que recebem `$` são `function` ou `const`
  de topo.
- Desestruturar ou espalhar um `Set` (`const [x] = set`) pode virar `set[0]` na compilação do mod.
  Use arrays.
- A recarga depois de uma edição pode atrasar. Para confirmar a versão carregada, ponha um marcador
  temporário no resultado de uma ferramenta do mod e tire depois.
- Uma ferramenta nova registrada com `$.tool.register` só aparece a partir do próximo prompt.
- A pergunta do AskUserQuestion e a aprovação de plano abrem dentro do `next(e)` do `tool.call`
  (ordem: `tool.call`, `tool.check`, diálogo). Pedidos de permissão chegam por
  `classic.PermissionRequest`; nenhum evento marca a resposta, por isso o aviso de permissão só sai
  quando a chamada termina.
- A caixa de fim de turno do app desktop com pergunta e botões (`mcp__ccd_turn__wrap_up` com `ask`)
  volta na hora e o turno acaba, mas o usuário continua sendo perguntado. O `tool.call` cria o aviso
  `choice` ("Aguardando sua escolha", chave `<agente>:wrap_up:ask`), que não sai no fim da chamada:
  fica até o próximo `prompt.submit` ou até um wrap_up sem `ask` (ou com `ask` vazio). Entra no
  arquivo publicado (`waiting`/`waits`), então a principal desenha o relógio de espera na filha.
- Tarefas esquecidas abertas: dois lembretes no loop principal, com a lista das abertas sem nada
  aberto embaixo (`openList`). (1) No resultado de cada `mcp__ccd_turn__wrap_up` com tarefas
  abertas, para marcar `done` antes da mensagem final. (2) Quando uma sessão filha passa de rodando
  ou à espera para parada (`refreshChildren` grava o id em `ended`), uma vez, no próximo
  `prompt.submit` ou na próxima chamada de ferramenta do loop principal, se a tarefa de origem dela
  ainda estiver aberta. Fora do app desktop (sem wrap_up nem sessões) nada disso dispara.
- O `$.ui.status` fica embaixo da caixa de mensagem, que some enquanto uma pergunta está aberta:
  avisos de espera vão no painel.
- O kit de testes (`claude-code/testing`) não expõe `$.state`. Teste pelo painel montado
  (`$.ui.mount` + `findAll`, com `unmount` depois) e pelos resultados das ferramentas. O `agentId`
  de subagente vai no argumento das ferramentas (`plan($, tasks, 'sub1')`, com `on('agent.list')`);
  o `$.prompt.submit` do kit aceita `origin` e `isMeta`. Eventos sem implementação embaixo (`classic.SessionStart`,
  `prompt.compose`) precisam de um `on(...)` do teste que responda.
- O grupo de um subagente se liga à tarefa em que ele foi lançado pela descrição da chamada do
  Agent (`launches`); grupos criados antes disso não têm âncora e vão para o fim da lista.
- Fora do app desktop não há sessões filhas: se a lista falhar e nenhuma ferramenta `mcp__ccd_…`
  existir (`$.tool.list`), o painel não mostra a linha "Sessões indisponíveis". No app, a falha
  aparece nela.
- Sessões filhas (app desktop): vêm de `$.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true })`,
  consultado a cada 3 s (`watchSessions`, com `$.clock.every`; o intervalo é recriado no
  `session.start` e a cada chamada de ferramenta e prompt do loop principal, porque recarregar o
  módulo cancela o anterior) e após cada `start_session`. A lista
  exclui a própria sessão: o id dela é o `startedBy` que nenhuma linha listada tem. Em andamento =
  `isRunning` (ícone de ramificação). No teste, o hook `mcp.call` responde `{ value }`.
- Onde a sessão filha aparece: o `tool.call` de `mcp__ccd_session__start_session` grava em `children`
  o `anchor` (a tarefa em andamento da principal, como o `launches` dos subagentes) com o id `local_…`
  do resultado. A filha faz parte da árvore: fica embaixo dessa tarefa, aberta ou concluída (a
  tarefa concluída vem aberta). Uma filha parada fica embaixo da origem, como histórico, e some
  junto só quando o usuário recolhe a origem ou um pai dela. Sem âncora (cartão
  `own_initiative`, que só começa com o clique) vai para o fim da lista.
  Arquivada fica, como histórico (ver "Sessão arquivada").
- Ordem de execução (pedido do usuário: tarefas na ordem do plano; grupo novo sempre embaixo dos
  que já existem): replanejar um nível 1 aberto com o mesmo id o substitui do zero no mesmo lugar
  da lista, sem mandá-lo para o fim (texto das `RULES`: "substituído do zero no mesmo lugar da
  lista").
- Um cartão por mensagem (pedido do usuário: filha ocupada que recebe mensagem nova tem o painel
  duplicado; o cartão antigo fica onde estava e o novo vai sob a tarefa da principal que mandou a
  mensagem): cada `SendMessage` grava em `Child.rounds` `{ at, anchor }`, com a hora tomada antes
  da chamada. `split(c)` divide o painel publicado da filha em cartões pela hora de cada turno
  dela: o cartão 0 fica na âncora original; o cartão k vai sob a tarefa que mandou a mensagem k
  (`Child.part` = k). Subagentes, avisos de espera e netas vão para o cartão da tarefa-âncora
  deles. Só o cartão da frente mostra a espera; o anel de contexto aparece em todo
  cartão da sessão, em qualquer estado (trabalhando, ocioso, parado, concluído ou de rodada antiga),
  com o último % publicado (pedido do usuário: "mesmo depois que a sessao termina, o icone se
  contexto precisa continuar aparecendo"). Sem % publicado, sem anel nem botão de abrir (um anel
  vazio diria 0%, o que é falso). Com a filha rodando, todo
  cartão com tarefas abertas é desenhado em andamento. Mensagem ainda não lida não tem turno, logo
  não tem cartão: a tarefa que a mandou fica com o ✉ até a filha a pegar; aí o ✉ some e o cartão
  novo aparece. Na visão resumida a divisão vem antes do recorte. Chaves de dobra do cartão k>0:
  `<escopo>s:<id>#k`, com escopo interno `<escopo><id>#k>`.
  Rodadas também vêm de mensagens de sessões irmãs (pedido do usuário: "as tarefas que estao
  aparecendo na sessao filha, nao aparecem na sessao orquestradora"): cada filha publica o que
  recebeu (`Panel.received`) e `breaks()` junta as mensagens da principal com as das irmãs. A mensagem
  de uma irmã pertence à rodada do turno em que a irmã a mandou (não à última rodada dela antes de
  a mensagem chegar; pedido do usuário: "as tarefas de governança, svg e documentação, não são da
  tarefa de envio decha sozinha?"), e a rodada vai sob a tarefa onde estava esse cartão, seguindo a cadeia.
  A origem vem primeiro do ✉ da irmã: o envio pendente dela para esta sessão (`sends` publicado)
  aponta a tarefa que enviou, e o turno dessa tarefa dá a âncora na principal; sem ✉, o último turno
  da irmã antes da chegada. Sem origem conhecida, o cartão da mensagem não é desenhado por até 10 s
  (`WAIT_ORIGIN`) e depois vai para onde der (raiz, se nada). Motivo (pedido do usuário: "ela
  deveria abrir direto no lugar correto"): as leituras de 3 s e os arquivos gravados em momentos
  diferentes faziam o cartão nascer na raiz e pular depois. Na mesma cadeia
  (ex.: docs → SVG → governança ficam, cada grupo novo no seu cartão, sob a tarefa da principal que
  abriu a cadeia), sem aninhar no cartão da irmã, para não duplicar a sessão. Sob uma mesma
  tarefa (e soltos no fim da lista), os cartões vão na ordem em que o trabalho de cada um começou
  (`begins(c)` + `inOrder()`; ex.: implementação → documentação → SVG → governança), não na ordem da
  lista do host (pedido do usuário: "e rodou, ficando tudo junto").
  Custo do `breaks()`: as irmãs trocam mensagens em anel (impl → docs → SVG → governança → impl) e,
  com o `received` persistido, cada lista guarda 10–20 entradas; recalcular a cadeia da irmã por
  mensagem, recursivamente, crescia exponencialmente (até 20^5 chamadas por cartão a cada desenho,
  22,7 s medidos) e derrubava o worker ("task-tree was unloaded: it crashed the hooks worker", sem
  exceção no log). Agora há memo por desenho (`WeakMap` pela lista de irmãs, com o caminho na
  chave), a cadeia de cada irmã é calculada uma vez e há corte de ciclo (a sessão reencontrada no
  próprio caminho conta só as rodadas dela): 0,1 s, mesmo resultado. Teste de regressão no kit.
  Mensagem sem rodada registrada (pedido do usuário: "layout quebrou novamente"; envio feito com o
  painel fora do ar ou durante um crash): cada mensagem da dona que a filha tratou (o `received`
  dela) é casada em ordem com as rodadas registradas (`unsent`); a que sobra abre uma rodada mesmo
  assim, sob a tarefa da dona que estava aberta quando ela chegou (a que esperava a entrega) ou,
  sem tarefa aberta, no fim do painel, depois de todos os pedidos. Rodadas de irmãs sem origem
  também vão para o fim. Antes, essas mensagens caíam na rodada anterior e o cartão ficava acima de
  outro pedido. Um turno interrompido por crash antes de salvar a resposta fica sem ↩. Cartão de rodada já
  fechada de sessão ainda rodando mostra ✓ sem a palavra "concluída".
- Tarefa que enviou a mensagem (`sendAnchor`; pedido do usuário: "o segundo painel de
  implementacao deveria estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem
  de solicitação"): é a tarefa em andamento, salvo se, depois do início dela, foi planejada uma
  tarefa folha aberta sem `start`; aí é a mais nova dessas. Tarefas planejadas junto, antes do
  início, não mudam nada. Vale para o lugar do cartão (`rounds`), para a visão resumida
  (`lastAnchor`) e para o ✉ (`sends`).
- O que a filha mostra: o host não expõe espera nem tarefas de outra sessão (`list_sessions`/
  `get_session` só têm `isRunning`). Cada sessão grava `~/.claude/task-tree-waits/<id local>.json`
  com `{ waiting, at, tasks, groups, waits, children }` (o painel inteiro dela; `tasks` é o grupo
  principal, para versões antigas) a cada mudança do painel (`persist`), dos avisos de espera e das
  próprias filhas (id via `get_session` com `self`), e a sessão que a abriu lê o arquivo no refresh
  de 3 s (`Child.panel`). Rodando ou esperando: cabeçalho (ícone de ramificação cinza ou relógio
  âmbar, com `d/n`) e, embaixo, o painel dela desenhado pela mesma função (`panel`) que desenha o da
  principal: mesmos ícones, o aviso de espera embaixo da tarefa em andamento dela, os subagentes e
  as netas (até `DEEP` níveis). Parada sem tarefa aberta: rótulo `⑂ nome  concluída`, com o cartão aberto como os demais.
  Parada, não arquivada, com tarefa aberta (ex.: "Aguardar sinal…"): ícone ◷, palavra `parada`, com as tarefas da filha como ela as planejou, cada uma no seu estado
  (pedido do usuário: "no painel da sessão filha, devem aparecer exatamente as tarefas de dentro
  dela"); o clique continua recolhendo. Não se usa `$.store` para isso: a chave
  dele é o `$.session.id()` (uuid do CLI), que a principal não conhece; o arquivo usa o id `local_…`,
  que as duas sabem.
- Contador: `total` soma as tarefas da principal (todos os grupos) com as das filhas (as arquivadas
  como histórico, o que deixaram aberto como interrompido), recursivamente; vale para o topo do
  painel e o `$.ui.status`. As interrompidas ficam fora. Os resultados de `plan`/`done` contam só o
  grupo de quem chama.
  O `d/n` de cada tarefa da principal (`atWork`) soma, além das próprias folhas (a própria tarefa,
  se for folha com sessão), as tarefas das sessões ancoradas nela ou abaixo (arquivadas inclusive). Com uma
  dessas sessões viva, a tarefa é desenhada em andamento e o relógio corre, mesmo com `done`
  gravado (só o desenho; o status não muda). O chip "● em andamento" conta só o andamento próprio
  (`active`); a sessão já conta no chip ⑂. Sem nível 1 aberto, o cabeçalho mostra o que tem sessão
  viva embaixo. O tempo (`timeOf`) vai do primeiro início ao último fim da tarefa, das subtarefas e
  das tarefas dessas sessões (`allTasks`, até `DEEP`), ou até agora enquanto alguma roda ou uma
  sessão embaixo está viva; vale para linha, terminal e `alt`. O tempo do cabeçalho é o da sessão
  inteira (`sessionTime`), nas duas visões: do primeiro início (ou `plannedAt`) de qualquer tarefa
  do painel (todos os turnos, níveis 1 soltos, subagentes e sessões, arquivadas inclusive, até `DEEP`) ao
  último fim, ou até agora enquanto houver tarefa aberta ou sessão viva. O "N de M" vem do `total`. O relógio de 1 s
  (`running`) corre enquanto houver sessão viva.
- No kit de testes, o caminho chega ao `fs.write` com `\` no Windows, e `$.clock.now` precisa de um
  `on('clock.now', ...)`; sem ele, o `publishWait` falha calado.
- Os `tool.call` de `mcp__task-tree__plan`/`start`/`done` respondem sem chamar `next`, então o
  `tool.call` genérico (lembrete "sem plano aberto") não roda para eles: o que precisa saber que o
  pedido usou o painel (`planned`) é marcado dentro de cada um. `planned` volta a `false` no
  `prompt.submit`; com ele ligado, o fim do turno (wrap_up, mensagem final) não traz o lembrete.
- `list_sessions` sem sessão ligada responde texto puro ("No other sessions found."), não `[]`.
- Logo depois do `start_session`, o host ainda lista a filha parada: o marcador `Child.starting`
  impede que ela conte como turno encerrado até o host a ver rodando, esperando ou arquivada.
- AskUserQuestion do loop principal sem tarefa aberta é recusado (`deny`), para a pergunta não
  ficar solta no painel. ExitPlanMode passa sem essa exigência (o desenho original; não é que o modo
  de plano bloqueie as ferramentas do painel: `plan`/`start`/`done` respondem antes do `tool.check`).
- Resposta por mensagem no chat: o AskUserQuestion volta com "User did not answer this question —
  they sent a message instead…", antes de a mensagem chegar. O resultado ganha um contexto próprio
  e o próximo `prompt.submit` diz que a mensagem é a resposta. Todo `prompt.submit` com tarefas
  abertas lista as abertas para fechar as que a mensagem conclui ou substitui.
- Aviso de pergunta/plano (`question`/`plan`) do agente sai também no `turn.complete`, caso a
  chamada não volte. No kit, `$.turn.complete` exige `answer`, `durationMs`, `isAborted` e `turnId`
  no evento, e um `on('turn.complete', () => ({ text: '' }))`.
- Respostas das ferramentas por grupo: o `plan` diz o tamanho do plano enviado (todos os níveis) e
  as folhas abertas do grupo de quem chama; o `done`, "Concluídas: x/y no seu grupo" (o subagente não
  conta a principal).
- Origem das mensagens (`prompt.submit`, `e.origin.kind`, posta pelo engine): `task-notification`
  (a volta de um subagente, um comando em segundo plano), `observer`, `observer-activity`,
  `auto-continuation` e `unclassified` (avisos do engine e do app: ociosidade, recibos, eventos do
  app desktop) continuam o pedido em andamento (`NO_TURN`): não abrem turno nem trazem o lembrete de
  pedido novo, só um curto para pôr o painel em dia. As outras (o usuário, outra sessão, um plugin,
  uma tarefa agendada) abrem turno.
- Turnos (pedidos): cada `prompt.submit` que não é de `NO_TURN` abre um turno no grupo principal (`Group.turns`, `{ id,
  title, at }`), também as mensagens de outra sessão, que chegam como `isMeta` (sem isso, uma sessão
  filha ficava com um turno só e o trabalho atual dela nunca trocava), com o começo da mensagem sem
  as tags, numa linha (até 60 caracteres), como título; turnos sem tarefa são descartados nessa hora. O `plan` do loop principal grava `turn` em
  cada nível 1 novo (o último turno) e o `request` opcional renomeia esse turno (cria um, se não
  houver). Um nível 1 replanejado (mesmo id aberto) fica no turno em que estava. Como os turnos vão
  dentro do grupo, persistência, resume e o painel publicado já os levam; painéis antigos (sem
  `turns`) desenham os níveis 1 soltos, como antes, e esses ficam à frente dos turnos. Desenho só no
  painel de cima (`level === 0`) e, no cartão de uma filha, só para turno com mais de um
  nível 1 (pedido do usuário: "parece que quebrou de novo o layuot dos elementos", escolha "Tarefas
  sem ligação" → opção a): ali o cartão ganha o cabeçalho com o título do pedido e os níveis 1 ficam
  ligados por conector embaixo dele, sem repetir o ↩ (o cartão já mostra as respostas abaixo das
  tarefas); turno com um só nível 1 continua sem cabeçalho, para o cartão não ganhar uma linha por
  turno:
  `turnRows` faz a linha do pedido (d/n, barra e tempo somando as tarefas e as sessões abertas
  nelas, como no `atWork`), em andamento enquanto algo dele está, aberta também quando tudo fechou
  (chave `|T:<id>`), e os níveis 1 um nível abaixo. O limite de 3 níveis do `plan` não muda.
- Ícone de sessão filha: toda linha mantém o ícone de progresso (○/◉/✓/✕/✉; no cartão da sessão,
  ◉ rodando ou aguardando, ✓ concluída, ✕ arquivada). O cartão de uma sessão (`Row.session`) e a
  tarefa ou turno com sessão ancorada nela ou abaixo (`Row.kids`, de `atWork`; arquivada inclusive) ganham
  também o ramo; no `alt`, ", com sessão filha". Vale recolhida.
- Posição dos ícones (decisão do usuário, corrigida: "eh pra colocar o icone de sessao filha, nao os
  icones de progresso. volte o icone de progresso para o lugar que estava e coloque no lugar o icone
  de sessao filha"): no desktop, o ícone de progresso fica à esquerda, logo depois das guias, antes
  do título, em todas as linhas. Nas linhas de tarefa, turno e cartão, as colunas da direita são
  fixas: tempo (`TIME_W`), d/n (`COUNT_W`), barra e, logo à esquerda da barra, o ramo (só nas
  linhas com sessão; vazia nas outras, para alinhar), com a palavra de estado ("concluída",
  "interrompida") antes dele. No terminal: "◉ título  ⑂  d/n  tempo".
- Concluídas com o mesmo layout: a linha fechada tem o mesmo ícone de progresso (✓/✕), ramo,
  título, barra, d/n e tempo da aberta. `plan` grava `plannedAt`; `done` sem `start` dá início à
  tarefa (`fillStarts`): o fim da irmã anterior fechada, senão o início do pai, senão `plannedAt`
  (nunca depois de agora); o que ela fecha embaixo começa dela. Interrompida mantém o tempo até a
  interrupção. Sem tempo conhecido (painéis antigos, ou o kit de testes sem relógio), a linha fechada
  mostra "—" (`Row.time === null`). No desktop as colunas são fixas (ver a posição do ícone); no
  terminal o resto vem depois do título, sem colunas.
- Lista das sessões velha: além do refresh de 3 s (cujo callback não rejeita mais, para não
  encerrar o intervalo), o `prompt.submit` e cada chamada do loop principal leem a lista de novo
  quando a última leitura tem 3 s ou mais (`refreshStale`; só depois da primeira, no
  `session.start`). Sem isso, uma sessão parada podia ficar desenhada como viva e manter os pais em
  andamento.
- Mensagens a outras sessões (pedido do usuário: "somente encerre tarefas de mensagens enviadas
  para as filhas, quando houver confirmacao de recebimento"): todo `SendMessage` do loop principal que não falha (pedido do usuário: "uma
  sessao esta chamando a outra, mas nao esta aparecendo as tarefas com o icone de mensagem"; antes
  só o resultado "queued" contava, e entre filhas a entrega costuma ser imediata) grava em `sends` `{ to, anchor, at }`, com a tarefa em
  andamento, e o resultado ganha o aviso de manter a tarefa aberta. Entrega imediata ("delivered; its turn has started") grava com `delivered: true`
  e não ganha lembrete de recebimento; envio que falha não grava nem deixa ✉. Os `sends` vão no
  painel publicado, e a principal desenha o ✉ na tarefa que enviou dentro do cartão espelhado da
  filha. A tarefa fica com ✉ até o destino ser visto tratando a mensagem (o `received` publicado
  por ele, na releitura de 3 s); aí o painel a fecha sozinho, e o `RULES` diz para não chamar
  `done` nela. Enquanto o envio está pendente,
  a tarefa tem um ícone de progresso próprio (tom `sent`; pedido do usuário: "para as tarefas que
  voce esta esperando confirmacao da sessao filha, use um icone diferente"): envelope azul na coluna
  do ícone no desktop, "✉" (cor `permission`) no terminal, `alt` "Aguardando confirmação de
  <sessão>: título" e chip "N aguardando sessão"; não conta como "em andamento". O chip "N em andamento" conta, pelos dados e não
  pelas linhas desenhadas (`activeLeaves`), todas as folhas abertas (◉ e ○, sem subtarefas) de todos
  os grupos do painel e das sessões não arquivadas (até `DEEP`), como o `total`: é M − N do "N de M"
  (interrompidas fora dos dois), menos as que esperam confirmação (chip ✉). Pedido do usuário: "a
  quantidade de tarefas em andamento deve ser o total de tarefas de menor nivel (sem filhas)", e na
  escolha seguinte, "Folhas abertas". Confirmado, volta
  a ◉ (ou ✓, se o modelo concluir). `watchSends` (no `refreshChildren`) marca `idle` quando vê a sessão parada
  depois do envio e `taken` quando ela volta a rodar (começou a tratar a mensagem); o próximo
  `prompt.submit` ou chamada do loop principal lembra, uma vez, que o recebimento foi confirmado.
  A tarefa do envio fecha sozinha ao receber (escolha do usuário: "Fechar sozinha ao receber"):
  quando o envio é marcado como recebido, o `watchSends` (na releitura de 3 s, sem precisar de turno
  da sessão que enviou, que pode estar parada) conclui a tarefa, se ela estiver aberta e sem
  subtarefa aberta, e publica o painel, para o cartão na sessão mãe não ficar "parada". O aviso de
  recebimento diz que o painel já fechou a tarefa (reabrir com `start` se faltou algo); o `RULES` e
  o aviso de "ficou na fila" dizem que a tarefa fica em andamento até o recebimento e que a sessão
  pode encerrar o turno. `done` que fecha a tarefa de um envio ainda na fila conclui, mas avisa.
  A regra está no `RULES`.
- Etapa por etapa (pedido do usuário: "ela ficou parada muito tempo na primeira tarefa, e derepente
  pulo para a ultima"): a causa era o agente, que não chamava `start` e fechava várias etapas num
  `done` só no fim (as do meio saíam com 0:00); o espelho publica a cada mudança e a principal relê
  a cada 3 s. O `RULES` e o contexto do `prompt.submit` pedem `start` no começo de cada etapa e
  `done` assim que ela termina, antes da próxima, nunca várias de uma vez no fim. O `done` avisa
  quando 2 ou mais etapas nunca iniciadas fecham juntas ("N etapas fecharam juntas sem start ...");
  com `start` antes, ou com uma só, não há aviso.
- Id curto em `start`/`done` (`resolve()`; pedido do usuário: "as terafas foram executadas fora de
  ordem, verifique se existe um erro"): o id completo e o curto entram juntos e vence o aberto; no
  mesmo estado, o id completo desempata. Antes o id completo tinha prioridade, e "1" ou "3" pegavam
  níveis 1 antigos e já concluídos com esse id em vez de "31/1" e "31/3", abertos no plano atual,
  que ficavam pendentes no cartão.
- Ligações persistidas (pedido do usuário: "voltou o comportamento de sessoes abrirem no lugar
  errado"): âncoras e rodadas das sessões abertas, `sends`, `received` e `launches` ficavam só em
  memória; depois de recarregar o plugin ou reiniciar o app, os grupos voltavam do store mas as
  filhas ficavam sem âncora e as cadeias sem origem, e os cartões caíam na raiz. `saveLinks` grava
  `links:<sessão>` no store a cada publicação; `restoreLinks` restaura no `session.start` e, numa
  recarga (que não passa por ele), antes da primeira gravação, juntando ao estado atual em vez de
  sobrescrever.
- Visões (pedido do usuário: "quero que exista essa visao atual, e uma visão resumida, onde mostre
  somente as tarefas em andamento"; depois: "deixe mais bonito esse toggle, esta solto no layout. e
  a visao resumida deve ser a visao padrao ao iniciar uma nova sessao"; depois "o toggle ainda esta
  estranho, deixe mais bonito", com a opção "Ícones no canto"): dois botões só de ícone no canto
  direito da linha do título do cabeçalho, chave `view:<summary|full>`: "≡" resumida, "▤" completa.
  A API não deixa clicar em partes de um `Svg`, então no desktop o cabeçalho segue um `Svg` só (o
  título sozinho na 1ª linha, com `ICONS_W` livre à direita; "N de M · % · tempo" na 2ª; barra;
  chips) e os botões ficam por cima, num `Box` `position="absolute"` `top={0}` `right={0}`. O
  escolhido é `variant="primary"` (realce da superfície), o outro `plain` esmaecido. O `Button` não
  tem prop de ícone, dica (tooltip) nem nome acessível separado, e o desktop desenha o `label` como
  o texto do botão nativo (pedido do usuário: "quero que aparecam dois icones, sem texto"): o
  `label` é só o glifo, sem filhos, e qual visão está escolhida vai no `alt` do cabeçalho ("Visão:
  resumida, selecionada (≡ resumida, ▤ completa)"). No terminal, os glifos no fim da linha do
  título, o escolhido entre colchetes ("[≡] ▤").
  A escolha fica no estado `view` (reload) e no store em `view:<session id>`; no `session.start`,
  sem estado, vale a do store (resume) ou, sem ela, a resumida (sessão nova). Sem estado nenhum (o
  kit de testes, que não roda o `session.start`), o render usa a completa.
  Trabalho atual (pedido do usuário: "somente limpe os itens quando todos estiverem concluidos e quando
  iniciarem novas tarefas"): o estado `work` (e o store em `work:<session id>`, restaurado no
  `session.start`) guarda os níveis 1 do grupo principal do trabalho atual. Um `plan` ou `start` do
  loop principal começa trabalho novo (`startsWork`) só sem nenhuma folha aberta no painel
  (`nothingOpen`, sessões incluídas) e numa mensagem do usuário (turno) diferente da do trabalho
  atual; no mesmo turno, mesmo com tudo concluído antes, ou com algo aberto, os níveis 1 dele entram
  no atual (um nível 1 concluído renomeado pelo plano continua); `/clear` zera.
  A resumida é a visão completa de um recorte do painel (pedido do usuário: "a visao resumida deve
  usar a mesma base de logica da visao completa, com o diferencial que ela somente mostra as tarefas
  em andamento e elas somente sao ocultas dessa visao quando todas estao completas"): mesmas linhas,
  mesmos botões no ícone e o mesmo estado de abrir e recolher (`collapsed`, compartilhado pelas duas visões, já
  que as chaves são as mesmas). O recorte (`cut` no render, com `trimToWork`) é o trabalho atual:
  seus níveis 1 com os demais dos mesmos turnos (o d/n do turno bate com as linhas), os subagentes
  e as sessões debaixo deles ou ainda vivos; sem `work` (painéis antigos), o turno mais recente com
  tarefas; sem turnos, o último nível 1 aberto (ou o último), nunca o painel inteiro. Tudo concluído, o recorte continua com ✓ até o trabalho novo.
  Sessões filhas no recorte (pedido: "nao esta aparecendo a sessao filha no resumo"): cada
  `SendMessage` do loop principal a uma sessão grava em `Child.lastAnchor` a tarefa em andamento; o
  recorte põe a sessão sob essa tarefa se ela estiver no trabalho, senão sob a de origem (se
  estiver), senão, viva, solta no fim da lista; a completa não muda. Dentro do cartão, só a rodada
  atual da sessão ("so devem aparecer as novas dessa rodada"): cada sessão publica o seu `work`
  (`Panel.work`) e o mesmo `trimToWork` corta o painel dela e o das netas. No recorte, d/n, barra,
  tempo e as somas dos pais seguem a rodada; o cabeçalho segue a sessão inteira. Tarefa em
  andamento sem `start` conta o tempo desde `plannedAt` (linha e turno). O `alt` do cabeçalho diz a
  visão. Nos testes, o helper `view` tira os glifos do toggle da linha do título.
- Anel de contexto da sessão filha (pedido do usuário: "no item pai mais alto de uma sessao filha
  ... um icone a esquerda do icone de sessao filha, mostrando a porcentagem de contexto usado"): cada
  sessão publica no seu arquivo (`publishWait`, também no `turn.complete` do loop principal)
  `context: { percent, at }` de `$.session.usage()` (sem `breakdown`, que é caro); a que a abriu
  guarda em `Child.context`. O anel (`contextRing`: trilha cinza, arco do topo em sentido horário,
  azul até 69%, âmbar de 70%, vermelho de 85%; só o círculo, sem nada no centro: "pode ser somente o
  circular, nao precisa do icone dentro") fica só no cartão da
  própria sessão, solto na ponta direita da linha do rótulo, na coluna onde termina o tempo das
  linhas de baixo, longe do nome; a palavra de estado continua logo depois do nome (pedido do
  usuário: "deve estar solto e na direita da mesma linha"). Linhas de tarefa e de pedido não mostram
  mais o anel das filhas nem o citam no `alt` (pedido do usuário: "nao precisa colocar esse icone
  na tarefa pai que originou essas sessoes, porque gera inconsistencia"); o ⑂ continua nelas,
  marcando que há sessões embaixo. Sem percentual, sem anel. No desktop o anel é clicável e abre a sessão
  no painel principal da janela (pedido do usuário: "quero que o icone de contexto seja um icone
  clicavel tambem, e quando clicar nele, abra a sessao que ele representa"): um `Button` sem
  rótulo centrado no anel (`ringOver`, que chama `overlay('ring', …)` de `draw/geometry.ts`; o `overBox(cx)` do módulo, o mesmo do ícone de progresso, escolhe
  as células inteiras com o meio mais perto do centro do glifo; pedidos do usuário: "mesmo problema
  do icone de progresso, o botao atras nao tem padding" e "o mouse over do anel de contexto continua
  pequeno, nao envolvendo o icone todo"). O realce é do botão nativo: o tamanho vem do texto do botão
  mais o padding nativo, e o `Box` só posiciona. No anel, o texto é um em space (U+2003,
  `RING_LABEL`), para o realce ter o tamanho do anel (15 px), e o `Box` do botão tem 4 células
  (`RING_CELLS`), a largura do realce nativo (32 px), ancorado pela ponta direita da linha
  (`right`, `ringRight`), e o anel é desenhado no meio dele (`ringFromRight`: x = W − 8·(right +
  2); constantes `RING_D` 15, `RING_CELLS` 4, `RING_IN` = `CARD_RIGHT` + `RING_D` = 17,5). A regra "ancorar pela borda mais próxima" (ícone e nome contados pela esquerda, anel pela direita; célula `CELL` = 8 contra ≈7,87 reais) está escrita uma vez, no cabeçalho de `draw/geometry.ts`; `foldOver`/`ringOver`/`nameLayer` só chamam `overlay`; o anel não usa mais o `overBox`. Motivo, medido nos prints do usuário ("ainda não, segue
  desalinhado"; aprovado depois com "Sim, ficou certo"): a célula do desktop tem um pouco menos de
  8 px (≈7,87); contado da esquerda (cerca de 57 células) o erro somava ≈7 px e o anel ficava fora
  do realce, e contado da direita ele é de fração de px. O teste confere o `Box` pela direita, com 4
  células e folgas iguais até 1 px. O kit não dá tamanho ao `Button`, e o teste não mede o realce
  nativo)
  chama `open_session_in`
  (servidor `ccd_window`, `target: focus`) por `$.mcp.call` (`openSession`), o mesmo efeito de
  clicar na sessão na barra lateral; o kit não tem API própria para isso e o `Link` do desktop só
  abre https:. Limites do app: só abre esta sessão ou uma aberta por ela (o cartão de uma neta é
  recusado), só com esta sessão na tela, e recusa com o cursor num campo de texto; a recusa vira o
  toast "Não abriu <nome>: <motivo>". Sem tooltip "Abrir <nome>" (o `Button` não tem, e uma camada
  por cima engoliria o clique) e sem cursor de mão. O ⑂ continua recolhendo o cartão. Terminal: "42%" no fim da linha do
  rótulo, na cor da faixa.
- Modelo e esforço no cartão (pedido do usuário: "quero que voce mostre o nome do modelo e o
  esforco de cada sessao, ao lado esquerdo do anel de contexto"; depois "nao aparece em todos os
  paineis, somente no primeiro"; aprovado com "Sim, em todos"): cada sessão pega `model` e
  `effort` do `turn.step` (os pedidos do loop principal; hook em `async function*`) e publica o
  texto em `engine` no arquivo de `task-tree-waits`, só quando muda, como o % de contexto. Sem
  publicação (sessão que ainda não rodou um turno com esta versão), o cartão busca no registro do
  app (`get_session`), com cache de 1 min por sessão; o publicado tem prioridade. `engineText` dá o
  nome legível: `claude-opus-5-5[1m]` vira "Opus 5.5 · high", `claude-sonnet-5-5` vira "Sonnet
  5.5" (sem `[1m]` nem data; nome fora do formato fica como veio). Desenho: texto cinza de 11 px,
  terminando 8 px à esquerda do anel (sem anel, na borda do cartão), omitido se fosse encostar no
  nome, e citado no `alt`; vale em todos os cartões da sessão. Não entra no cabeçalho do painel da
  própria sessão (o app já mostra o próprio modelo). O hook `turn.step` não tem teste: o kit não
  tem implementação base para o evento em stream.
- Sessão arquivada (pedido do usuário: "Manter visível, marcada"): continua na árvore como histórico,
  sob a âncora, nas duas visões (na resumida, se a âncora estiver no recorte), com o cartão cinza,
  ✕ de progresso, ⑂ e "arquivada"; mostra o último painel publicado e recolhe como os outros. O
  `panelOf` de uma arquivada marca como interrompido o que ela deixou aberto (fora do M do "N de
  M", no chip de interrompidas). Suas tarefas entram no N de M, no d/n, no tempo dos ancestrais e
  do cabeçalho; o chip "em andamento" e "sessão ativa" não a contam. Nos ancestrais, a ⑂ continua; no cartão,
  o anel mostra o último percentual, esmaecido (`Ring.faded`).
- Pai aguardando (pedido do usuário: "nas tarefas que estao aguardando e ja tem alguma tarefa
  concluida, marque os pais como aguardando"): uma tarefa ou turno aberto, com algo concluído abaixo e
  nada em andamento (não acesa pelo `current`, sem ✉ nem sessão viva), tem o tom `paused`: ◷ âmbar
  no lugar do ○, `alt` "Aguardando: …", tempo parado no último fim abaixo (`stillSpan`). Não entra em
  chip. Como o `current` acende a primeira aberta quando nada foi iniciado, isso aparece quando outra
  tarefa está em andamento.
- Avisos do app (`<system-reminder>` com `<side-sessions-event>`, quando uma sessão filha termina) não
  chegam como `unclassified`: são reconhecidos pelo texto e tratados como `NO_TURN` (sem turno, sem
  título, sem pedido de request).
- Classificação das mensagens (0.7.3): antes de decidir, o `prompt.submit` tira os blocos
  `<system-reminder>…</system-reminder>` com o conteúdo (o app põe "Linked sessions now …" na frente
  da primeira mensagem de uma filha e das entregas da fila; na 0.7.2 isso fazia mensagens de verdade
  passarem por aviso). `<cross-session-message` sempre abre turno, com o conteúdo dela como título.
  A volta de subagente (`<agent-message from="<agentId>">`, "[Subagent hand-back] …", às vezes com a
  `<task-notification>` junto) e o aviso do app (sobra vazia ou começando com `<side-sessions-event>`)
  não abrem turno; o aviso relê a lista das sessões antes dos lembretes.
- Confirmação de mensagem na fila (0.7.3): quem recebe guarda e publica `received: [{ from, at }]`
  (`<cross-session-message from="local_…">`, os últimos 20), em qualquer prompt. Quem envia, em
  `watchSends` (antes dos retornos do `refreshChildren`, então também numa sessão sem filhas, para a
  mãe ou as irmãs), lê o arquivo do destino: `received` do próprio id (`selfId`) com `at` ≥ o envio
  confirma; senão um turno publicado depois do envio; senão a regra antiga (vista parada, depois
  rodando). Um `done` que fecha a tarefa do envio, um replan dela e o `/clear` tiram o envio de `sends`
  (sem ✉ fantasma num id reaproveitado).

## Pendências

- Bug conhecido (falha marcada `KNOWN` em `layout.test.ts`, que imprime `TODO` e passa; a orquestradora
  decide se vira correção): o cabeçalho conta como "em andamento" a tarefa ✉ de um cartão de filha. A
  fórmula `active` do `ui.render` exclui só as tarefas de `sentIds` (mensagens na fila DESTA sessão); a
  tarefa da filha que espera outra sessão fica como folha aberta e entra no "em andamento", embora já
  conte em "aguardando sessão". No cenário do teste: 1 em andamento + 2 aguardando; o esperado é 0 + 2.
- Cabeçalho fixo ao rolar (pedido do usuário, deixado para depois): o `Box` não tem sticky nem área
  rolável própria. O único caminho é o padrão do `ui.scroll` do `Pane`: não chamar `next`, guardar o
  próprio offset (`e.by`), invalidar e redesenhar o cabeçalho mais a fatia das linhas
  (`site.scroll.bodyRows`). Falta provar que o desktop dispara `ui.scroll` ao rolar o pane (lá as
  linhas são `Svg` em pixels). Próximo passo, quando retomado: um hook temporário de diagnóstico no
  `ui.scroll` que registre os eventos enquanto o usuário rola o pane no desktop.
