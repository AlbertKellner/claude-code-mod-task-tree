# Cartas ✉ e checks ✓, v2: carta de recebimento e linha de envio

Complementa `analise-cartas-e-checks.local.md` (v1) com as respostas do usuário de 2026-10-30. Só leitura; nada foi editado nem commitado. Base: `test/resumo-recarga-e-impacto` (`e30cc39`).

## Essencial

- **Respostas:** (1) a carta de recebimento é a linha do pedido, uma por mensagem, sempre visível no cartão; (2) azul tratando, verde concluído, cinza interrompido; (3) **a tarefa que envia a mensagem deixa de virar carta**: segue tarefa comum (○ ◉ ✓, conta), e o ✉ do envio vai para **uma linha própria**.
- **O que muda da v1:** só o item 3. A v1 mantinha "a tarefa de quem manda é a carta" (decisão de 2026-10-24, `8eb801c`). Agora a carta de envio é uma **linha embaixo da tarefa**, como já ficam o aviso de espera e o cartão da filha: "✉ Para <sessão>: <mensagem>", com a palavra "na fila / entregue / interrompida" à direita, fora da contagem. A tarefa volta a ser trabalho.
- **O ciclo da carta de envio não muda:** azul na fila, verde quando a sessão destino começa a tratar (na hora, se a entrega é imediata), cinza se a mensagem foi descartada (plano substituído, sessão arquivada). O que muda é que **a tarefa não acompanha mais a carta**: ela segue as regras de tarefa (Esc interrompe se estava iniciada; fim normal aguarda; `done` quando o modelo quiser).
- **Compatibilidade:** o arquivo publicado já carrega `sends`; passa a carregar também os entregues (hoje só os na fila) e o começo do texto da mensagem. Quem lê com a versão antiga já filtra os entregues e ignora campos novos: nada quebra. A marca `msg` nas tarefas vira legado e deixa de ser gravada e de mudar o ícone.
- **Golden:** o cenário **"envios" muda de desenho** (as 3 tarefas voltam a ✓/✕ e ganham 3 linhas ✉ embaixo); "principal" e "filha" não mudam. A aprovação segue a regra: o usuário valida no app antes do commit, e só então `golden:aprovar`.
- **Dois commits**, nesta ordem: **1** a carta de recebimento (v1, pequeno, sem golden); **2** a linha de envio (maior: 8 arquivos do mod, 11 testes reescritos com `Reescrito:`, golden "envios"). Impacto medido com `npm run impacto` (seção 5).
- **Dúvidas novas:** 3 (seção 6), com os dois mockups para ele escolher onde a carta de envio fica.

## 1. O novo modelo do envio

**Onde a carta fica.** Embaixo da tarefa de onde a mensagem saiu (a "âncora", escolhida como hoje por `sendAnchor`), no mesmo lugar em que já pendem o aviso de espera ("◷ Aguardando sua resposta") e o cartão da filha. Ordem embaixo da tarefa: avisos de espera, **cartas de envio** (na ordem em que saíram), cartões das filhas (o cartão da rodada daquela mensagem fica logo abaixo da carta dela). Veja os mockups na seção 6.

**Título da carta:** "Para <nome da sessão>: <começo da mensagem>" (60 caracteres, como o título do pedido). Sem nome conhecido, o id curto. Hoje o painel não guarda o texto da mensagem; passa a guardar.

**Cores e palavra à direita** (iguais às de hoje, só mudam de linha):
- **azul "na fila"**: o app respondeu "queued" e a sessão destino ainda não começou a tratar;
- **verde "entregue"**: a sessão destino começou a tratar (confirmado pelo arquivo publicado dela), ou a entrega foi imediata ("its turn has started"): verde na hora;
- **cinza "interrompida"**: a mensagem foi descartada antes da entrega: a tarefa saiu do plano por um pedido novo, a sessão destino foi arquivada. **Esc e fim do turno não mexem na carta** (a mensagem já saiu; ela espera a outra sessão, não este turno).

**A tarefa de quem mandou:** vira tarefa comum.
- `start`/`done` normais; conta no x/y e nos chips; **Esc interrompe** se estava iniciada (regra "Esc: só a iniciada ✕"); fim normal do turno: ◷ aguardando, como qualquer iniciada.
- Deixa de ser **concluída sozinha** quando a entrega chega (hoje o painel fecha a tarefa quando a filha começa a tratar). Recomendação: a carta fica verde e o modelo recebe o aviso "recebimento confirmado…" com a sugestão de concluir a tarefa **se ela era só o aviso**; quem decide é o modelo, como em toda tarefa. (Dúvida 2 confirma.)
- Continua **em andamento enquanto a filha trabalha embaixo dela**, mesmo depois do `done` (regra de 2026-10-24, `d956e11`), porque isso vem do cartão, não da carta.

**A regra "não chame done na tarefa com mensagem na fila"** (`text/rules.ts`) cai. Texto novo para o modelo: "Uma mensagem a outra sessão (SendMessage) aparece como uma carta ✉ embaixo da tarefa em andamento de onde saiu: azul enquanto está na fila, verde quando a sessão começa a tratar, sem você fazer nada. A tarefa continua uma tarefa comum: conclua com done quando o trabalho dela acabar (se ela era só avisar a outra sessão, pode concluir logo depois de enviar). O painel avisa quando o recebimento é confirmado." O aviso "a mensagem ficou na fila" também perde o "mantenha em andamento a tarefa do envio".

**Âncora, uso e abertura de sessão:** nada muda. `sendAnchor` escolhe a tarefa; `usedAnchors` (envios, rodadas, `openedAt`) impede que duas mensagens ou sessões caiam na mesma tarefa do lote; "sem tarefa em andamento, vai à pendente planejada por último" segue. A regra "a tarefa que já tem envio não recebe outra do lote" continua valendo (a carta é a prova do uso).

**Envios no mesmo instante / mesma tarefa:** hoje um segundo envio à mesma sessão a partir da mesma tarefa **substitui** o registro. Proposta: continua uma carta por (sessão destino, tarefa), com o texto da última mensagem; envios a sessões diferentes da mesma tarefa viram cartas separadas (como hoje, só que visíveis). "Mensagens juntas vão à última": o **cartão** do turno da filha continua indo à tarefa da última mensagem; cada carta fica na sua tarefa, verde na entrega.

**Contagem:** a carta fica fora do x/y, das barras e dos chips, exceto o chip "aguardando sessão", que passa a contar **cartas na fila** (hoje conta linhas de tarefa com envio na fila: o mesmo número). A tarefa conta normalmente: "em andamento" passa a incluir a tarefa iniciada que mandou mensagem (hoje ela é excluída).

**Dados** (o que muda por baixo):
- `Send` ganha `text` (começo da mensagem) e, opcionalmente, `cut` (descartada); os envios **tomados não são mais apagados** do estado na próxima mensagem (hoje `takenNote` apaga): ficam como histórico sob a tarefa, até 20 por sessão (o store já limita). Um envio cuja tarefa sumiu do plano passa a pendurar no nível 1 do pedido dela (substitui o `kept` do replano).
- `TaskNode.msg` deixa de ser gravado e de mudar o ícone e a contagem; `kept` deixa de ser usado. Os dois ficam no tipo como legado.
- **Arquivo publicado:** `sends` passa a sair inteiro (não só os na fila), com `text`. A sessão mãe desenha as cartas no cartão da filha a partir disso. Versões antigas do mod lendo o arquivo: já filtram `!taken` e ignoram `text`; a tarefa `msg` da filha deixa de existir nas versões novas, então a mãe antiga vê a tarefa como comum. Versão antiga **escrevendo** (filha antiga): a mãe nova vê os envios dela só enquanto na fila e as tarefas `msg` como comuns (sem carta verde depois): transição aceitável.
- Store: painéis antigos com tarefas `msg` passam a contar essas tarefas (eram excluídas). Sem migração; é histórico.

**Código que lê `msg`/`sent`/`recv`/carta e o que muda:**
| Arquivo | Hoje | Muda |
|---|---|---|
| `draw/layout.ts` | tom `sent` e `Row.msg` na tarefa (l. 935–990); `halt` poupa a tarefa com envio (l. 60, 888); `count` exclui `msg` (l. 96); `kept` (l. 928); `recvOf` nas tarefas de nível 1 (l. 1241) | linha nova `send` embaixo da tarefa (em `below`, l. 1190); tarefa sem tom `sent`, sem `msg`; `halt` não poupa mais a tarefa (a carta não entra no `halt`); `count` sem a exclusão; `recv` na linha do pedido (commit 1) |
| `draw/svg.ts` | `MSG_CLASS`/`MSG_TERM`, `envelope` no ícone (l. 547); chip "aguardando sessão" (l. 581) | a linha de envio usa o mesmo envelope e as mesmas cores; chip conta cartas na fila |
| `hooks/render.tsx` | `r.msg ?? r.recv` no glifo e no pulo (l. 72–104, 216); `sentIds`/`sentTasks` tiram a tarefa dos chips (l. 365–377) | a linha de envio entra no mesmo caminho do glifo e do pulo; as exclusões dos chips saem |
| `hooks/tool-call.ts` | grava o envio e marca `msg: true` na tarefa (l. 134–158) | grava `text`; não marca `msg` |
| `hooks/sessions.ts` | `watchSends` conclui a tarefa na entrega; `takenNote` apaga os tomados | não conclui a tarefa (dúvida 2); não apaga, marca `noted` para avisar uma vez |
| `hooks/tools.ts` | `doneTool` avisa ao fechar tarefa com envio na fila (l. 160–166); `planTool` mantém a tarefa `kept` com envio (l. 65–67) | o aviso sai (fechar é normal); o replano rependura a carta no nível 1 em vez de manter a tarefa |
| `state/tasks.ts` | `carry` mantém a folha `msg` com envio na fila (l. 133–137) | sai |
| `text/rules.ts` | regra do ✉ na tarefa; `SEND.queued`; `SESSION.taken` ("o painel já concluiu a tarefa") | textos novos (acima) |
| `io/publish.ts` | publica só `sends` não tomados | publica todos, com `text` |
| `types/index.d.ts` | `Send`, `TaskNode.msg`/`kept` | `Send.text`, `Send.cut`, `Send.noted`; `msg`/`kept` marcados legado |

## 2. Regras do catálogo afetadas (o que cada uma reescreve)

Decisões que fundamentam: 2026-10-24, "quero diferenciar as tarefas de execução, das tarefas de mensagem" (`8eb801c`), que passa a ser lida como **a carta é a mensagem; a tarefa é execução**; e 2026-10-30, "a tarefa de trabalho que enviou uma mensagem segue tarefa comum e o ✉ do envio vai para uma linha própria" (as palavras exatas dele vão no `Reescrito:`).

| Regra | Hoje | Reescrita (commit 2, salvo indicação) |
|---|---|---|
| `envios.fica-ate-entrega` | o ✉ fica **na tarefa**, mesmo concluída, até a entrega | a **carta** fica azul sob a tarefa até a entrega, mesmo com a tarefa concluída |
| `envios.cor-por-estado` | o ✉ da tarefa muda só de cor | a carta muda só de cor (azul, verde, cinza); a tarefa tem ícone comum |
| `envios.entrega-imediata-fica-verde` | ✉ verde na hora; a tarefa segue em andamento | igual, na carta |
| `envios.esc-apos-entrega-imediata` | o Esc mantém o ✉ verde (a tarefa não é interrompida) | a carta segue verde; **a tarefa, iniciada, fica ✕ como qualquer outra** (dúvida 3) |
| `envios.fila-nao-interrompe-no-fim-do-turno` | a tarefa com envio na fila não vira ✕ | a carta na fila não é interrompida pelo fim do turno; a tarefa segue as regras de tarefa |
| `envios.ancora-no-lote-recente`, `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo` | onde o ✉ aparece | onde a **carta** aparece (só o texto) |
| `envios.nivel1-recebido-mostra-carta` | ✉ nas tarefas de nível 1 | **commit 1:** `envios.pedido-recebido-mostra-carta`: a carta é a linha do pedido; tarefas com ícone comum |
| `pedidos.replano-mantem-envio-ate-entrega` | a tarefa de mensagem fica visível até a entrega | a carta de uma tarefa que saiu do plano fica sob o nível 1 do pedido até a entrega |
| `pedidos.replano-preserva-estado` | cita o ✉ preservado | só o texto: a carta segue com a tarefa que mantém o id |
| `cabecalho.chips-contam-folhas` | "tarefas de mensagem ficam fora" | cartas ficam fora; a tarefa que enviou conta como qualquer folha |
| `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` | a tarefa com ✉ no cartão da remetente | a carta sob a tarefa, no cartão da remetente |
| `sessoes.um-cartao-por-mensagem`, `sessoes.mensagens-juntas-vao-a-ultima`, `sessoes.cartao-sob-a-tarefa-de-origem` | — | não mudam (cartões) |
| Nova: `sessoes.pedido-recebido-aparece-no-cartao` | — | **commit 1:** a linha ✉ do pedido recebido aparece no cartão mesmo com uma tarefa só |
| Nova: `envios.carta-sob-a-tarefa` | — | a carta de envio fica embaixo da tarefa de onde saiu, antes do cartão da filha, fora da contagem |

As outras que citam "mensagem" (`lembretes.*`, `perguntas.*`, `pedidos.uma-mensagem-um-pedido`, `turnos.*`) falam da mensagem do usuário ou de outra sessão como prompt: não mudam.

**Testes que mudam** (selo `decisao`, com o `Reescrito:` acima): os 11 de `envios.test.ts` (afirmam a carta pelo título da tarefa; passam a afirmar a linha "Para outra: …" sob a tarefa e a tarefa com estado comum), o "mensagem entre irmãs" de `sessoes.test.ts`, o "chips contam só folhas" de `cabecalho.test.ts` (`andamento` 1 em vez de 0 depois do envio). Kit: `leitura.ts` ganha `cartas(linhas, titulo)` (as cartas sob uma tarefa) e `esperarCarta` passa a procurar a linha de carta; selo `refatoracao`.

## 3. Golden

- **"envios"** (`tests/golden.test.ts`): três tarefas com envio e um Esc. Hoje: ✉ azul, ✉ verde, ✉ cinza nas próprias tarefas. Depois: "Na fila" ✕ (iniciada, Esc), "Entregue" ✕, "Cortada" ✕ (as três estavam iniciadas no Esc), cada uma com a carta embaixo: azul, verde e… a terceira **também azul** (a mensagem saiu, está na fila; o Esc não a corta). Se ele quiser uma carta cinza no golden, o cenário precisa de uma mensagem descartada de verdade (plano substituído). **O desenho muda: validação dele no app antes do commit 2, depois `golden:aprovar -- envios`.**
- **"filha"**: abre sessão, não envia: **não muda**.
- **"principal"**: não muda.
- **Commit 1** (recebimento): nenhum cenário de golden tem pedido aberto por mensagem: **não muda**.

## 4. Fatiamento

**Commit 1: carta de recebimento** (`fix(task-tree): a carta de recebimento é a linha do pedido; as tarefas derivadas têm ícone comum`)
- `draw/layout.ts` só: `recv` na linha do pedido (`turnRows`); `rows` sem `recvOf`; no cartão, pedido vindo por mensagem sempre com a linha.
- Catálogo: `envios.nivel1-recebido-mostra-carta` → `envios.pedido-recebido-mostra-carta` (`Reescrito: 2026-10-30, "Sim, uma carta por mensagem"…`); nova `sessoes.pedido-recebido-aparece-no-cartao`.
- Testes: 1 reescrito (selo `decisao`), 3 novos (v1, seção 3).
- Sem golden. Validação no app depois do commit (regra geral), porque o golden não muda.
- `npm run impacto -- draw/layout.ts`: 54 cenários (toda a área de desenho) → o check roda todos; o checklist do app: cartões, cliques, nada pisca.

**Commit 2: linha de envio** (`feat(task-tree): a carta de envio é uma linha sob a tarefa; a tarefa que enviou segue tarefa comum`)
- 8 arquivos do mod (tabela da seção 1) + `types/index.d.ts`, escritos de uma vez.
- `text/rules.ts`: os textos novos (seção 1). Modelo de uso: o modelo não precisa fazer nada de novo; perde a proibição de `done` na tarefa com mensagem na fila.
- Catálogo: as reescritas da seção 2 e a nova `envios.carta-sob-a-tarefa`.
- Testes: 13 reescritos (`decisao`), kit (`refatoracao`), novos: carta sob a tarefa; tarefa concluída com carta azul; replano rependura a carta no nível 1; carta cinza por plano substituído; chip "em andamento" inclui a tarefa que enviou.
- **Golden "envios"**: validação dele no app **antes** do commit; `golden:aprovar -- envios --motivo "\"<palavras>\", 2026-10-30"`.
- `npm run impacto -- draw/layout.ts hooks/tool-call.ts hooks/sessions.ts hooks/tools.ts state/tasks.ts draw/svg.ts text/rules.ts io/publish.ts`: **96 cenários** (praticamente tudo) → o check roda todos; checklist do app: ✉ e entrega reais entre sessões, filha parada e arquivada, cartões, cliques; golden "envios".

Ordem: 1 antes de 2 (os dois mexem em `draw/layout.ts` perto do mesmo ponto; o 2 pressupõe o `recv` na linha do pedido).

**Riscos:**
- **Sessões rodando versões diferentes** durante a transição (mãe nova, filha antiga ou o inverso): a carta verde da filha antiga não aparece na mãe nova depois da entrega; a mãe antiga vê as tarefas da filha nova sem ✉. Some quando as duas atualizam. Nada quebra (os leitores já toleram campos a mais e a menos).
- **Store com tarefas `msg`** (painéis antigos): passam a contar. É histórico; sem migração.
- **Envios no estado crescem** (não são mais apagados): limite de 20 por sessão, como as rodadas; o `links` do store já poda.
- **Mudança de comportamento para o modelo** (pode concluir a tarefa do envio): os textos novos precisam ser claros, senão o modelo conclui antes de a filha responder e o cartão fica sob tarefa ✓. Isso já acontece hoje na entrega imediata e o painel trata (a filha mantém a tarefa ◉).
- **Esc com carta na fila:** a tarefa iniciada vira ✕ (hoje era poupada). É a consequência da decisão 3; dúvida 3 confirma.
- 8 arquivos do mod num commit: recarga do clone; escrever de uma vez e `npm run check`.

## 5. Matriz de impacto (medida)

- Commit 1 (`draw/layout.ts`): 54 cenários cobertos afetados; golden: nenhum muda de fato (conferido: nenhum cenário de golden tem pedido por mensagem).
- Commit 2 (8 arquivos): 96 cenários; golden: "envios". Os dois dizem "o check roda todos os testes"; a lista serve ao relato e ao checklist do app.

## 6. Dúvidas para o usuário e mockups

**1. Onde a carta de envio fica.** Dois desenhos (como o painel imprime no terminal; no app é o mesmo com ícones coloridos):

**Mockup A — carta como linha própria, embaixo da tarefa, antes do cartão da filha (recomendado):**
```
◉ Commit do ↩ e matriz de impacto  5/7  14:17
├─ ✓ Aguardando suas respostas: validação do ↩ e matriz   1:05
├─ ◉ Implementação: regravar golden e commitar o ↩  ◍   3:50
│     ✉ Para implementacao: Regrave o golden e commite o ↩   entregue   3:50
│     ◍ implementacao  ⑂ test/resumo-recarga-e-impacto
│     ✉ Matriz de impacto (3 commits)  4/4                    ← carta de recebimento (commit 1)
│     ├─ ✓ Ler a análise da matriz
│     ├─ ✓ Commit 1: script de impacto e travas
│     └─ ✓ Commit 3: CLAUDE.md e passo no workflow
└─ ◉ Governança: push e PR depois da matriz  ◍   2:05
      ✉ Para governanca: Confira, rode o check, faça push…   na fila   0:12
```
A carta tem o remetente implícito (é desta sessão), o destino, o começo da mensagem e a palavra de estado. Fica onde o olho já procura o que pende da tarefa. Recomendo este: uma mensagem = uma linha, igual ao recebimento.

**Mockup B — a carta vira o cabeçalho do cartão da filha (sem linha extra):**
```
├─ ◉ Implementação: regravar golden e commitar o ↩   3:50
│     ✉ implementacao  ⑂ test/resumo-recarga-e-impacto   entregue
│     ✉ Matriz de impacto (3 commits)  4/4
│     ├─ ✓ Ler a análise da matriz
└─ ◉ Governança: push e PR depois da matriz   2:05
      ✉ Para governanca: Confira, rode o check…   na fila        ← só enquanto não há cartão
```
Menos linhas, mas a carta muda de forma (linha solta na fila; cabeçalho do cartão depois) e o cartão perde o busto ◍ que diz "sessão". Não recomendo.

**2. Concluir a tarefa do envio quando a entrega chega.** Hoje, com a mensagem na fila, o painel conclui a tarefa sozinho quando a filha começa a tratar. Com a tarefa comum: (a) **o painel não conclui mais; avisa o modelo, que conclui com `done` se a tarefa era só avisar** (recomendado: a tarefa é trabalho e quem a fecha é o modelo, como todas); (b) manter a conclusão automática.

**3. Esc com uma carta ainda na fila.** A tarefa iniciada de onde a mensagem saiu: (a) **vira ✕ como qualquer tarefa iniciada no Esc; a carta segue azul até a entrega** (recomendado: é a regra "só a iniciada vira ✕", sem exceção); (b) continua poupada (fica ◷) enquanto a carta está na fila, como hoje.
