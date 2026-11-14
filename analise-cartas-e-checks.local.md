# Cartas ✉ e checks ✓: como é hoje e como mudar

Base: `origin/main` + `test/resumo-recarga-e-impacto` (`e30cc39`). Só leitura, mais uma reprodução numa cópia no scratchpad. Nada foi editado no repositório.

## Essencial

- **O que aparece nas imagens é o plugin fazendo exatamente o que foi decidido em 2026-10-24**, não erro do modelo nem bug: toda tarefa de **nível 1** planejada num pedido que **chegou por mensagem de outra sessão** ganha o ✉ no lugar do ícone (commit `83f715d`). As subtarefas dela seguem com ○ ◉ ✓. Reproduzi os dois prints no kit, linha por linha.
- Esse desenho foi um **ajuste** ("print 33") feito no mesmo dia sobre o pedido original do usuário ("print 32"), que era justamente o que ele quer agora: **uma linha ✉ de recebimento** com as tarefas derivadas como filhas, de ícone comum. O ajuste tirou a linha extra e pôs o ✉ na própria tarefa de nível 1; com várias tarefas de nível 1, cada uma vira ✉ (regra 3 do ajuste). É isso que dá os 4 ✉ do print 1.
- **Por que às vezes é ✓ e às vezes ✉ para a "mesma coisa":** depende de **como o modelo estrutura o plano**. Se ele planeja um nível 1 com subtarefas, só o nível 1 é ✉; se planeja 4 tarefas de nível 1 soltas, as 4 são ✉; se o pedido veio do usuário (não de uma sessão), nada é ✉. O ícone passa a depender da forma do plano, e não do que a tarefa é. É esse o incômodo.
- **O modelo mental do usuário** (✉ só no envio e no recebimento; o trabalho derivado é tarefa comum) bate com o lado do **envio** (já é assim) e com o pedido **original** dele de 2026-10-24; diverge só do ajuste do print 33, que a mudança desfaz.
- **Mudança recomendada:** o ✉ de recebimento vai para a **linha do pedido** (a linha que já agrupa as tarefas daquela mensagem; no painel da própria sessão ela já existe), nas cores de hoje (azul enquanto há trabalho, verde tudo concluído, cinza interrompido); as tarefas de nível 1 voltam ao ícone comum; no cartão da filha, a linha do pedido passa a aparecer **sempre** que o pedido veio por mensagem (hoje só aparece quando há mais de uma tarefa). Mexe só em `draw/layout.ts`, muda 1 teste selado (com `Reescrito:`), 2 regras do catálogo e **não toca no golden** (os 3 cenários não têm pedido recebido por mensagem). Validação dele no app antes do commit, porque é desenho.
- **Dúvidas:** 3 decisões de produto no fim (linha do pedido sempre visível no cartão; cor do ✉ recebido; o que fazer com a tarefa de trabalho que vira ✉ porque o modelo mandou uma mensagem a partir dela).

## 1. Como funciona hoje

Há **três** situações em que uma linha do painel mostra ✉, e só duas delas são "mensagem" de verdade.

**(a) Envio: a tarefa de quem manda.** Quando o modelo chama `SendMessage`, a tarefa que estava em andamento naquele momento (a "âncora", escolhida por `sendAnchor` em `hooks/panel.ts`) é marcada como tarefa de mensagem (`msg: true`, em `hooks/tool-call.ts`). Dali em diante ela mostra sempre o ✉, só mudando a cor: azul "na fila", verde "entregue", cinza "interrompida" (`draw/layout.ts`, `draw/svg.ts`, `hooks/render.tsx`). Ela fica **fora** das contagens x/y e dos chips, como o usuário pediu em 2026-10-24: "quero diferenciar as tarefas de execução, das tarefas de mensagem" (commit `8eb801c`). É o caso de "Implementação: regravar golden e commitar o ↩" e "Governança: push e PR…" no print 1, com "entregue". **Bate com o que ele quer.**

**(b) Recebimento: as tarefas de nível 1 do pedido que veio por mensagem.** Quando chega um prompt `<cross-session-message from=… name=…>`, `said()` (`hooks/prompt-submit.ts`) reconhece que é de outra sessão e `openTurn()` (`hooks/panel.ts`) abre um **pedido** (turno) marcado com `msg: true` e o remetente. O `plan` seguinte põe as tarefas de nível 1 nesse pedido. No desenho (`draw/layout.ts`, `rows` com `recvOf`), **cada tarefa de nível 1 desse pedido** troca o ícone pelo ✉: azul enquanto aberta, verde concluída, cinza interrompida; o tooltip diz "Mensagem de <sessão>: <texto>". As subtarefas (nível 2 e 3) ficam com ○ ◉ ✓. A linha do pedido em si **não** tem ✉. Essas tarefas **contam** no x/y (são trabalho). É o caso de "Ler a análise da matriz", "Commit 1…" (print 1), "Conferir, rodar check, push…" (print 1) e "Registrar decisões do clarify…" (print 2).

**(c) Não existe ✉ em nenhum outro caso:** subtarefas, pedidos do próprio usuário, subagentes e cartões não ganham ✉. O usuário não é instruído a criar "tarefas de mensagem": as regras (`text/rules.ts`) só falam do ✉ do envio (não chamar `done` na tarefa com mensagem na fila). O ✉ de recebimento é **derivação automática** do plugin.

**No cartão da filha (visto pela mãe), há um detalhe que explica o print 1:** a linha do pedido só é desenhada dentro de um cartão quando o pedido tem **mais de uma** tarefa de nível 1 (decisão anterior: "Tarefas sem ligação"). Por isso:
- no cartão "implementacao", "Matriz de impacto (3 commits)" é a **linha do pedido** (por isso ✓ comum) e as 4 linhas abaixo são as tarefas de nível 1 (por isso ✉);
- no cartão "governanca", o pedido tinha uma tarefa só, então a linha do pedido não aparece e sobra a tarefa de nível 1 com ✉;
- no print 2 (painel da própria sessão), "Recado da spec do BFF…" é a linha do pedido (✓) e "Registrar decisões…" a tarefa de nível 1 (✉).

**Reprodução no kit** (cópia no scratchpad; saída resumida):
```
A: mensagem → 1 nível 1 com 2 filhas          B: mensagem → 4 níveis 1 soltos (print 1)
◉ Recado da spec do BFF…  1/2                 ✓ Matriz de impacto (3 commits)  4/4
└─ ✉ Registrar decisões do clarify  1/2        ├─ ✉ Ler a análise da matriz
   ├─ ✓ Ler o clarify                          ├─ ✉ Commit 1: script e travas
   └─ ○ Gravar na issue                        ├─ ✉ Commit 2: mapa
                                               └─ ✉ Commit 3: CLAUDE.md
C: o MESMO plano de B, mas o pedido veio do usuário: nenhum ✉ (◷ no pedido, ✓/○ nas tarefas)
D: cartões na mãe: "implementacao" com a linha do pedido ✓ + 4 ✉; "governanca" só "✉ Conferir, rodar check…"
```
O que decide ✉ ou ✓ é a **origem do pedido** (sessão × usuário) e o **nível** da tarefa, não o que ela faz.

**Resposta direta:** é decisão do plugin (derivação automática pela regra do ajuste de 2026-10-24), aplicada corretamente. Não é bug e não é o modelo marcando algo. O que ficou errado, pelo olhar de hoje do usuário, é a regra.

## 2. O que o usuário quer, e o que já existia

Modelo mental dele (palavras de hoje): "as cartas deveriam representar somente quando uma sessão se comunica com outra, ou com a orquestradora… um pedido enviado, ou quando o pedido fosse recebido. Quando o pedido fosse recebido, ele seria representado por uma carta, e as tarefas derivadas dessa mensagem (pedido) deveriam ter os ícones de tarefas, não de cartas."

| Parte | Hoje | Bate? |
|---|---|---|
| ✉ no envio, na tarefa de quem manda; fora da contagem | sim (`8eb801c`, 2026-10-24) | **sim** |
| ✉ no recebimento, **uma** carta por pedido recebido | não há linha de carta; o ✉ vai nas tarefas de nível 1 | **não** |
| tarefas derivadas com ícone de tarefa | só as de nível 2 e 3 | **em parte** |
| sem ✉ em pedido do próprio usuário, subagentes, cartões | sim | sim |

**Histórico das decisões dele (nota `analise-task-tree-envelope-recebido.local.md` e commit `83f715d`):**
- **2026-10-24, print 32:** "a sessão de governança precisa mostrar também a carta como recebida, e as tarefas partem como subtarefas da tarefa de recebimento da mensagem, elas derivam da mensagem". O plano era uma linha ✉ "De <sessão>: …" com as tarefas recuadas embaixo e ícone comum. **É o modelo de hoje dele.**
- **2026-10-24, print 33 (ajuste):** "nesse caso, o ícone do 'analisar a tarefa', deveria ser uma carta também". O print mostrava **uma** tarefa de nível 1 ("Analisar a tarefa de pergunta") criada para tratar a mensagem, com ◷. A decisão virou: sem linha extra; o ✉ vai na própria tarefa de nível 1; com vários níveis 1, cada um mostra o ✉. Implementado em `83f715d`.
- **O que a mudança reescreve:** só o ajuste do print 33. Com uma tarefa de nível 1 (o caso do print 33), o resultado visual fica parecido: a linha do pedido com ✉ e a tarefa embaixo com ícone comum, em vez de a tarefa ser o ✉. Com várias (print 1), muda bastante: um ✉ e quatro ✓.

Regras do catálogo afetadas:
- `envios.nivel1-recebido-mostra-carta` (coberto, origem `83f715d`): é a regra a reescrever.
- `sessoes.*` e `pedidos.uma-mensagem-um-pedido` (a linha do pedido no cartão só com mais de uma tarefa): a exceção para pedidos recebidos por mensagem entra como `Reescrito:`.
- `envios.cor-por-estado`, `envios.fica-ate-entrega`, `envios.entrega-imediata-fica-verde`: lado do envio, **não mudam**.

## 3. Como mudar

**Regra nova, em uma frase:** o ✉ de recebimento é a **linha do pedido** aberto por mensagem de outra sessão; as tarefas planejadas nele têm ícone comum, em qualquer nível.

Detalhes:
1. **Painel da própria sessão** (print 2): a linha do pedido "Recado da spec do BFF…" passa a ter ✉ (azul enquanto há tarefa aberta no pedido ou a sessão trabalha nele; verde com tudo concluído; cinza interrompido). "Registrar decisões…" vira ✓.
2. **Cartão da filha na mãe** (print 1): a linha do pedido passa a aparecer **sempre** que o pedido veio por mensagem, mesmo com uma tarefa só, com o ✉; as tarefas abaixo com ícone comum. O cartão "governanca" ganha uma linha: "✉ Governança: push e PR…" e, embaixo, "✓ Conferir, rodar check…".
3. **Tooltip e título:** a linha do pedido já tem o texto da mensagem como título; o tooltip ganha "Mensagem de <sessão>" (hoje está nas tarefas).
4. **Contagem:** nada muda. A linha do pedido já soma as tarefas dela; as tarefas de nível 1 já contavam. (A tarefa de **envio** continua fora, como decidido.)
5. **Lado do envio:** nada muda.

**Arquivos:**
- `task-tree/draw/layout.ts`:
  - `turnRows`: quando o pedido tem `msg`, a linha ganha `recv` (cor pelo estado do pedido: aberto → azul, concluído → verde, interrompido → cinza) e o `hint` "Mensagem de …";
  - `rows`: deixa de receber `recvOf` (as tarefas de nível 1 não ganham mais `recv`);
  - no cartão (`body`, filtro dos `turns`): pedido com `msg` e ao menos uma tarefa desenhada sempre ganha a linha do pedido, mesmo com uma tarefa só.
- `hooks/render.tsx` e `draw/svg.ts`: já desenham `r.msg ?? r.recv` em qualquer linha; conferir que a linha do pedido (que tem barra e x/y) aceita o envelope no lugar do ícone sem quebrar a geometria. Provavelmente nada a mudar.
- `text/rules.ts`: nada (o modelo não faz nada para isso).
- `types/index.d.ts`: nada (`Turn.msg`/`from` já existem).

**Catálogo:**
- `envios.nivel1-recebido-mostra-carta` → reescrita como **`envios.pedido-recebido-mostra-carta`**: "Dado uma mensagem de outra sessão que abre um pedido / Quando o modelo planeja as tarefas dele / Então a linha do pedido mostra o ✉ de recebida (azul aberto, verde concluído, cinza interrompido) e as tarefas, em qualquer nível, mostram o ícone comum", com `Reescrito: 2026-10-29, "<palavras dele de hoje>"; desfaz o ajuste de 2026-10-24 ('o ícone do analisar a tarefa deveria ser uma carta também') e volta ao pedido original do mesmo dia ('as tarefas partem como subtarefas da tarefa de recebimento')`.
- Regra nova **`sessoes.pedido-recebido-aparece-no-cartao`**: no cartão da filha, um pedido que veio por mensagem tem a sua linha ✉ mesmo com uma tarefa só (exceção à regra "Tarefas sem ligação"), coberto.

**Testes:**
- `tests/envios.test.ts`, "o nível 1 aberto por mensagem recebida mostra a carta…" (selado): passa a esperar o ✉ na linha do pedido ("Analise isto") e `Plano R` com estado comum (`pendente`/`andamento`/`concluida`). Selo `--tipo decisao`, com o `Reescrito:` acima. O `testes:alterados` vai listá-lo.
- Novos (selo `novo`): (i) pedido recebido com 4 tarefas de nível 1 → 1 ✉ no pedido, 4 ícones comuns (o print 1); (ii) o mesmo plano vindo do usuário → nenhum ✉; (iii) no cartão da filha, pedido por mensagem com uma tarefa → linha do pedido com ✉ e a tarefa com ✓ (o `host` do kit já aceita `turnos` com `msg`/`from`, como na reprodução).
- A etapa `regressao` vai acusar o teste antigo; o selo `decisao` desta mudança o libera.
- **Golden:** os 3 cenários (principal, filha, envios) **não** têm pedido aberto por mensagem, então o desenho deles não muda e o golden não precisa de aprovação nova. Se o usuário quiser o recebimento no golden, entra como cenário novo depois, com a validação dele.
- `lembretes.test.ts` usa mensagem de outra sessão, mas afirma só os textos ao modelo: não muda.

**Riscos:**
- A linha do pedido com ✉ no cartão aparece em **toda** mensagem da mãe para a filha, inclusive as de uma tarefa só: cartões ficam uma linha mais altos. É o custo de ter a carta de recebimento.
- Mensagens entregues juntas abrem um pedido só (regra existente): uma carta, com o título da primeira e as outras no tooltip. Sem mudança.
- A tarefa de **envio** continua sendo "a tarefa que estava em andamento quando o modelo mandou a mensagem". Se o modelo manda uma mensagem a partir de uma tarefa de trabalho ("Commit 1…"), essa tarefa vira ✉ e sai da contagem. Não é desta mudança, mas é a outra situação em que uma "tarefa" aparece como carta; ver a dúvida 3.
- É mudança de desenho: validação do usuário no app **antes** do commit (regra do golden), mesmo o golden não mudando; e o mod muda num arquivo só (escrever de uma vez; `npm run check`).

## Dúvidas para o usuário (decisões de produto)

1. **A carta de recebimento é a linha do pedido** (a que já agrupa as tarefas daquela mensagem), e no cartão da filha ela passa a aparecer sempre, mesmo quando a mensagem gerou uma tarefa só?
   - **Recomendado: sim.** É a forma mais simples: uma carta por mensagem recebida, as tarefas embaixo com ícone comum, e nada depende de como o modelo estrutura o plano.
   - Alternativa: manter o ✉ na tarefa quando a mensagem gerou uma tarefa só (o caso do print 33) e usar a linha do pedido só com várias. Não recomendo: volta a depender da forma do plano.
2. **Cor da carta recebida:** azul enquanto há trabalho aberto no pedido, verde quando tudo concluiu, cinza se foi interrompido (**recomendado**, é a cor de hoje, "azul enquanto trata, verde ao concluir")? Ou verde desde o recebimento, já que a mensagem chegou (aí a cor não diz mais nada)?
3. **Tarefa de trabalho que vira carta por ter mandado uma mensagem:** hoje, se o modelo manda uma mensagem a partir de uma tarefa comum, ela vira ✉ para sempre e deixa de contar. Está bom assim (**recomendado por ora**: é o que foi decidido em 2026-10-24 e as regras mandam o modelo marcar a tarefa certa antes de enviar), ou ele quer que isso seja tratado depois, separado desta mudança?

## Brief para a Implementação (depois das respostas)

Na branch que a orquestradora indicar. Um commit local; validação do usuário no app **antes** do commit (mudança de desenho). Sem push.

1. `task-tree/draw/layout.ts`: `turnRows` com `recv`/`hint` para pedido `msg`; `rows` sem `recvOf`; no cartão, pedido `msg` sempre com a linha do pedido. Conferir no terminal e no desktop que a linha do pedido desenha o envelope.
2. `regras/envios.md`: `envios.nivel1-recebido-mostra-carta` → `envios.pedido-recebido-mostra-carta` com o `Reescrito:`; `regras/sessoes.md`: `sessoes.pedido-recebido-aparece-no-cartao` (coberto). Atualizar `Código:` conforme o mapa.
3. `tests/envios.test.ts`: o teste selado reescrito (selo `decisao`) e os 3 novos (selo `novo`), conforme a seção 3. Se precisar, `tests/sessoes.test.ts` para o caso do cartão.
4. `npm run check` verde (a `regressao` liberada pelo selo de decisão); o relato traz `npm run testes:alterados` e `npm run impacto`.

O usuário valida no app: numa filha que recebeu uma mensagem da orquestradora, a linha do pedido tem o ✉ e as tarefas abaixo têm ✓/◉/○; no cartão dela na orquestradora, o mesmo, inclusive com uma tarefa só; o envio continua ✉ "entregue" na orquestradora.
