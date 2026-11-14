# Cartas ✉ e checks ✓, v3: o envio com as decisões finais

Ajusta a v2 (`analise-cartas-e-checks-v2.local.md`) com as respostas de 2026-10-30. Só leitura; nada editado nem commitado. O commit 1 (carta de recebimento, v1/v2) segue para a Implementação em paralelo; este arquivo é o **commit 2**.

## Essencial

- **Decisões:** (1) carta de envio = linha própria sob a tarefa (mockup A); (2) na entrega da mensagem que estava na fila, o painel **continua concluindo sozinho** a tarefa que enviou; (3) no Esc, a tarefa iniciada de onde a mensagem saiu **fica ◷** enquanto a carta está na fila.
- **O que a tarefa que enviou passa a ser:** uma tarefa comum no ícone (○ ◉ ✓ ◷ ✕) e na contagem (conta no x/y e nos chips, como ele disse: "segue tarefa comum, conta no x/y"), que, **enquanto a carta dela está na fila, é tratada como "aguardando a sessão"**: não vira ✕ no Esc (fica ◷), o modelo não a conclui (a regra "não chame done nela" **fica**) e o painel a conclui quando a entrega chega. Entregue a mensagem (carta verde), ela é uma tarefa como qualquer outra.
- **Coerente, sem pergunta nova.** O conjunto fecha se a leitura for essa: "a tarefa espera a sessão enquanto a carta está azul". As duas aparentes inconsistências (tarefa contada no x/y, mas fechada pelo painel; tarefa ◷ contada em "aguardando" ao lado da carta em "aguardando sessão") se resolvem sem decisão nova (seção 1). Um ponto para ele **olhar no app**, não para perguntar: depois de uma entrega **imediata** (carta já verde), o Esc passa a interromper a tarefa como qualquer outra (hoje ela era poupada por ser a própria carta).
- **O que muda da v2:** só o lado da tarefa: `halt` poupa a tarefa com carta na fila; `watchSends` segue concluindo a tarefa na entrega; `doneTool` segue avisando; os textos ao modelo mudam menos. O resto da v2 (carta, dados, arquivo publicado, chips, golden, fatiamento) vale.
- **Golden "envios"** muda de desenho (seção 3): validação dele no app antes do commit, depois `golden:aprovar -- envios`.
- 13 testes selados mudam (selo `decisao`), 8 arquivos do mod mais `types/index.d.ts` e `hooks/render.tsx` (núcleo): `npm run impacto` diz "tudo"; o check roda tudo.

## 1. A tarefa que enviou: o que é hoje, o que fica, o que muda

| Aspecto | Hoje (tarefa de mensagem) | Depois |
|---|---|---|
| Ícone | ✉ sempre, só a cor muda | **comum**: ○ ◉ ✓ ◷ ✕. A carta é a linha embaixo. |
| x/y e barras | fora | **conta** (decisão de hoje; a decisão de 2026-10-24 "diferenciar execução de mensagem" passa a valer entre a tarefa e a carta, não dentro da tarefa) |
| Chips | fora de todos; a tarefa com envio na fila conta em "aguardando sessão" | **segue o ícone**: ◉ conta em "em andamento"; ◷ em "aguardando". A **carta** na fila é o que conta em "aguardando sessão". |
| Fim normal do turno | poupada do halt (fica como está, o relógio dela corre enquanto a carta espera) | ◷ como qualquer iniciada, relógio parado; **o tempo de espera passa para a carta** ("na fila 0:12", que segue correndo) |
| Esc com carta na fila | poupada (não vira ✕) | **poupada: ◷** (decisão 3), relógio parado |
| Esc com carta já entregue (entrega imediata) | poupada (`e51ffec`: "o Esc mantém o ✉ verde") | **✕ como qualquer tarefa iniciada**; a carta segue verde (o que ele decidiu em 2026-10-28 era sobre a mensagem, e ela continua verde). Só até a próxima mensagem, como todo Esc. |
| Entrega da mensagem na fila | o painel conclui a tarefa sozinho e avisa o modelo | **igual** (decisão 2) |
| Entrega imediata | a tarefa segue em andamento até o `done` | igual |
| `done` com carta na fila | permitido, com aviso; a regra manda não chamar | **igual**: a regra fica ("não chame done nela: o painel a conclui na entrega"); o aviso fica |
| Replano que tira a tarefa com carta na fila | a tarefa fica (`kept`) até a entrega | a tarefa sai; **a carta rependura no nível 1** do pedido até a entrega; não há mais tarefa a concluir |

**Inconsistências do conjunto e a resolução mais simples:**
1. *Contada no x/y, mas quem a conclui é o painel.* Não é contradição: a entrega **é** o fim dessa etapa ("pedir à outra sessão"), e o +1 no x/y é correto. Fica a assimetria que já existe hoje: com entrega imediata, quem conclui é o modelo. Aceitável; o aviso "recebimento confirmado… se ela ainda tinha algo a fazer, reabra com start" fica.
2. *Tarefa ◷ no Esc conta em "aguardando" e a carta em "aguardando sessão".* São duas coisas (uma tarefa parada, uma mensagem na fila); os dois chips podem mostrar. Se incomodar no app, a correção é uma linha (tirar do chip "aguardando" a tarefa cuja carta está na fila). Não precisa de decisão agora.
3. *Durante o turno, a tarefa ◉ conta em "em andamento" e a carta em "aguardando sessão".* Igual ao item 2; correto: o modelo está trabalhando, a mensagem esperando.
4. *Por que poupar no Esc só enquanto a carta está na fila?* Porque é o período em que a tarefa espera a sessão; entregue, ela é uma tarefa comum e o Esc a trata como as outras. É a leitura mais simples das três decisões juntas.

**Pergunta nova:** nenhuma necessária. O único ponto que pode surpreendê-lo é o Esc depois de uma entrega imediata (tarefa ✕ por um instante, carta verde). Vai para a validação no app; se ele quiser a tarefa poupada também nesse caso, é uma condição a mais no `halt` e um `Reescrito:` em `envios.esc-apos-entrega-imediata`.

## 2. Regras do catálogo e testes (commit 2)

Palavras para os `Reescrito:` (2026-10-30): "A: linha própria sob a tarefa"; "Sim, conclusão automática como hoje"; "Não, fica ◷ enquanto a carta está na fila"; e a de 2026-10-30 na v2: "a tarefa de trabalho que enviou uma mensagem não deve virar ✉ nem sair da contagem; segue tarefa comum (○ ◉ ✓, conta no x/y) e o ✉ do envio vai para uma linha própria".

| Regra | Reescrita | Teste |
|---|---|---|
| `envios.fica-ate-entrega` | a carta azul sob a tarefa até a entrega; na entrega, verde, e o painel conclui a tarefa que enviou (mesmo se já estava ✓) | muda (2) |
| `envios.cor-por-estado` | a carta muda só de cor; a tarefa tem ícone comum e conta | muda (2) |
| `envios.entrega-imediata-fica-verde` | carta verde na hora; a tarefa segue em andamento até o `done` | muda (2: afirmava a carta na tarefa) |
| `envios.esc-apos-entrega-imediata` | a carta segue verde; a tarefa iniciada fica ✕ no Esc, como qualquer outra | muda (1) |
| `envios.fila-nao-interrompe-no-fim-do-turno` | a carta na fila não é interrompida por fim de turno nem Esc; a tarefa fica ◷ enquanto a carta está na fila (Esc inclusive) | muda (1) |
| `envios.ancora-no-lote-recente`, `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo` | só o texto: onde a carta aparece | mudam (5: afirmam a carta pelo título da tarefa) |
| `pedidos.replano-mantem-envio-ate-entrega` | a carta de uma tarefa que saiu do plano fica sob o nível 1 do pedido até a entrega | muda (1) |
| `pedidos.replano-preserva-estado` | só o texto (a carta segue com a tarefa que mantém o id) | não muda |
| `cabecalho.chips-contam-folhas` | cartas ficam fora dos chips (só "aguardando sessão" as conta); a tarefa que enviou conta pelo ícone | muda (1: `[1, 1, 2]` em vez de `[0, 1, 2]`) |
| `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` | a carta sob a tarefa, no cartão da remetente | muda (1) |
| `turnos.esc-interrompe-so-a-iniciada` | ganha a exceção: salvo a tarefa cuja carta está na fila, que fica ◷ | não muda (sem envio no teste) |
| Nova `envios.carta-sob-a-tarefa` | a carta de envio é uma linha sob a tarefa de onde saiu ("Para <sessão>: <mensagem>", na fila/entregue/interrompida, com o tempo de espera), antes do cartão da filha, fora da contagem | novo |
| Nova `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila` | enquanto a carta está na fila, a tarefa não vira ✕ no Esc, o modelo não a conclui e o painel a conclui na entrega | novo |

Total: 13 testes reescritos (selo `decisao`), kit (`cartas(linhas, titulo)`, `esperarCarta` na linha de carta; selo `refatoracao`), e os novos: carta sob a tarefa (fila → entregue → tarefa concluída sozinha); Esc com carta na fila (tarefa ◷, carta azul); carta rependurada no nível 1 depois do replano; carta cinza por plano substituído; carta no cartão da filha (a mãe lê os `sends` entregues da filha); "em andamento" conta a tarefa ◉ que enviou. Golden: o teste `golden: envios` **não muda de corpo** (só o desenho é aprovado de novo).

## 3. Golden "envios"

Cenário atual: `start 1`, envio (fila); `start 2`, envio, recebido; `start 3`, envio (fila); Esc. Desenho novo esperado:
```
◉ Pedido um  1/3
└─ ◉ Plano A  1/3
   ├─ ◷ Na fila              ← poupada: carta na fila (decisão 3)
   │     ✉ Para outra: oi   na fila   0:01
   ├─ ✓ Entregue             ← concluída pelo painel na entrega (decisão 2)
   │     ✉ Para outra: oi   entregue
   └─ ◷ Cortada              ← também na fila: não há mais "cortada" neste cenário
         ✉ Para outra: oi   na fila   0:01
```
Hoje as três linhas são ✉ (azul, verde, cinza) na própria tarefa. O título "Cortada" fica cosmético; uma carta cinza de verdade exigiria mudar o cenário (plano substituído), que é teste selado: recomendo **não** mexer agora. Fluxo: a Implementação faz a mudança, o check acusa "o desenho de envios mudou", o usuário valida o painel no app, diz que funcionou, `npm run golden:aprovar -- envios --motivo "\"<palavras dele>\", 2026-10-30"`, e o commit segue. "principal" e "filha" não mudam.

## 4. Arquivos do mod, impacto e riscos

Arquivos (todos de uma vez): `draw/layout.ts` (linha de carta em `below`; tarefa sem tom `sent`/`msg`; `halt` poupa a tarefa com carta na fila, não a carta; `count` sem a exclusão; o tempo de espera na carta), `draw/svg.ts` (envelope na linha de carta; chip "aguardando sessão" por cartas), `hooks/render.tsx` (glifo/pulo da linha de carta; sem `sentIds`/`sentTasks`), `hooks/tool-call.ts` (grava `text`; não marca `msg`), `hooks/sessions.ts` (`watchSends` continua concluindo a tarefa; `takenNote` não apaga os tomados, marca `noted`), `hooks/tools.ts` (`doneTool` aviso fica; `planTool` rependura a carta em vez de `kept`), `state/tasks.ts` (`carry` sem `kept`), `text/rules.ts`, `io/publish.ts` (publica todos os `sends`, com `text`), `types/index.d.ts` (`Send.text/cut/noted`; `msg`/`kept` legado).

Textos ao modelo (`text/rules.ts`): "Uma mensagem a outra sessão (SendMessage) aparece como uma carta ✉ embaixo da tarefa em andamento de onde saiu: azul na fila, verde quando a sessão destino começa a tratar, sem você fazer nada. A tarefa continua uma tarefa comum, com ícone e contagem normais. Na entrega imediata ('delivered; its turn has started on it'), a carta fica verde na hora e a tarefa segue em andamento até você chamar done. Com 'queued', não chame done nela: quando o recebimento é confirmado, o painel a conclui sozinho (mesmo com esta sessão parada) e avisa." `SEND.queued` e `SESSION.taken` ficam como estão; `DONE.queued` fica.

`npm run impacto`: com `hooks/render.tsx` no conjunto, é núcleo: "todos os cenários; checklist do app inteiro; golden: os 3". Sem o render (medido na v2): 96 cenários. O check roda tudo de qualquer forma.

Riscos (além dos da v2: versões diferentes do mod entre mãe e filha, tarefas `msg` antigas no store passando a contar, envios acumulando até 20): o `halt` passa a precisar dos envios na fila **da tarefa** (já recebe `sentFrom`: a mesma lista); o Esc depois de entrega imediata muda (seção 1); 10 arquivos num commit: cópia no scratchpad e `npm run check` antes de qualquer outro passo; commit 2 **só depois** do commit 1 (os dois mexem em `draw/layout.ts` no mesmo trecho: `rows`/`below`).

## 5. Brief para a Implementação: commit 2

Na branch indicada pela orquestradora, **depois do commit 1** (carta de recebimento). Um commit local. Validação do usuário no app **antes** do commit (o golden "envios" muda). Sem push.

1. Escrever de uma vez os 10 arquivos da seção 4, com este comportamento:
   - **carta de envio**: uma linha por (sessão destino, tarefa) sob a tarefa de onde a mensagem saiu, antes do cartão da filha: "✉ Para <nome ou id curto>: <até 60 caracteres da mensagem>", palavra "na fila / entregue / interrompida", tempo desde o envio enquanto na fila; fora de x/y, barras e chips, exceto "aguardando sessão"; cinza só quando descartada (tarefa fora do plano por pedido novo, sessão arquivada); Esc e fim do turno não a mudam; um envio cuja tarefa saiu do plano pendura no nível 1 do pedido;
   - **a tarefa que enviou**: ícone e contagem comuns; enquanto a carta está na fila, `halt` a poupa do ✕ (fica ◷ com relógio parado, no fim normal e no Esc), `watchSends` a conclui na entrega (como hoje), `doneTool` avisa se o modelo a conclui antes; entregue (imediata ou confirmada), tarefa comum em tudo;
   - **dados**: `Send.text`, `Send.noted` (o aviso ao modelo sai uma vez; o envio não é apagado), `Send.cut`; `TaskNode.msg` e `kept` não são mais gravados nem lidos (legado no tipo); o arquivo publicado leva todos os `sends`;
   - **cartão da filha na mãe**: as cartas da filha desenhadas sob as tarefas dela a partir dos `sends` publicados (os antigos sem `text` ganham "Para <sessão>" sem texto).
2. `text/rules.ts`: o texto da seção 4.
3. Catálogo: as reescritas e as duas regras novas da seção 2, com os `Reescrito:` nas palavras dele.
4. Testes: os 13 reescritos (selo `decisao`), o kit (`cartas`, `esperarCarta`; selo `refatoracao`), os 6 novos (selo `novo`). O corpo de `golden.test.ts` não muda.
5. `npm run check`: vai falhar só em "o desenho de envios mudou". Mandar o usuário validar o painel no app (um envio na fila, um entregue, um Esc com carta na fila; e o Esc depois de uma entrega imediata, para ele ver a tarefa ✕ com a carta verde). Com o "funcionou", `npm run golden:aprovar -- envios --motivo "\"<palavras dele>\", 2026-10-30"`; check verde; commit.
6. Relato: hash; `npm run check`; `npm run testes:alterados` (os 13); `npm run impacto` (núcleo: tudo); o que ele validou e disse; qualquer divergência vista no kit (não ajustar: relatar).

Commit: `feat(task-tree): a carta de envio é uma linha sob a tarefa; a tarefa que enviou segue comum, contada, e aguarda a sessão enquanto a carta está na fila`.
