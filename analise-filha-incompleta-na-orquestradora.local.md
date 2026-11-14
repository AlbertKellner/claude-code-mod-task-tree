# Por que a orquestradora não mostra tudo o que a filha fez (análise)

Base: `origin/main` = `d2566cb` (v0.8.1), lida por `git show`; reprodução numa cópia no scratchpad (`git archive origin/main`). Nada foi editado nem commitado.

## Essencial

- **Não é bug de leitura: a mãe lê o painel inteiro da filha.** O que some é cortado **no desenho**, por três regras que o usuário decidiu antes, pensando em sessões velhas, e que agora escondem trabalho vivo:
  1. **Turno aberto pelo usuário digitando na filha** ("own") vira um cartão próprio **no fim do pedido em que a filha foi aberta** (decisão dele: "turno aberto direto pelo usuário na filha vira cartão próprio, sem âncora, no fim do pedido de origem"). A Governança foi aberta num pedido antigo; tudo o que o usuário autorizou direto nela (a reescrita de 2026-10-29 e o trabalho de agora) pendura **naquele pedido antigo**.
  2. **Só os 3 últimos pedidos são desenhados** na completa ("+N pedidos anteriores", `SHOWN_TURNS = 3`); um pedido mais velho só fica se tem tarefa aberta ou **uma sessão trabalhando cuja rodada atual está sob ele**. O cartão do turno próprio não conta como "rodada atual sob ele", então o pedido antigo é cortado **com o trabalho vivo dentro**.
  3. **A resumida mostra só o trabalho atual** e, por decisão dele, "uma sessão ainda trabalhando sob um pedido fora do trabalho **não traz o pedido de volta**, nem o cartão é desenhado solto" (`trimToWork`, 2026-10-23/27).
- **Reproduzi os dois prints no kit** (seção 2): com o pedido de origem entre os 3 últimos, o cartão "pode apagar e reescrever" (turno próprio, com tarefa ◉) aparece no fim do pedido antigo; com 3 pedidos depois dele, some nas duas visões, o chip "sessões ativas" cai a 0 e só o cartão da última mensagem fica sob "Aguardando sua autorização…", exatamente como no print 5.
- **O print 4 (painel da própria filha):** não há pedido para o trabalho de agora, então **a filha ainda não planejou** (ou planejou depois do print). Se planejar, vai ao turno próprio e, na mãe, cai na regra 1.
- **O tempo 118:49:54** não é relógio quebrado: o cabeçalho mostra "do primeiro início ao agora" de **tudo o que está à vista**; a resumida da filha ainda mostra o pedido de 2026-10-29, então o tempo é de 29/10 até 03/11 (≈ 4,9 dias). É uma definição que engana; proposta na seção 5.
- **Proposta** (seção 4): (i) o turno próprio da filha pendura no fim do **pedido vigente na mãe quando o usuário digitou**, não no de origem; (ii) **cartão com sessão viva ou tarefa aberta nunca some**, nas duas visões: se o pedido dele foi cortado, o cartão é desenhado solto no fim do painel com o nome do pedido; (iii) o cabeçalho mostra o tempo do pedido atual. (ii) e (iii) reescrevem decisões anteriores dele: são as dúvidas da seção 6.

## 1. Como funciona hoje: o que a mãe mostra de cada filha

- **O que a mãe lê:** o arquivo publicado da filha, inteiro (todas as tarefas e pedidos dela, `turns` com `at`, `own`, `msg`), a cada 3 s e nos avisos do app. Nada é perdido na leitura.
- **Cartões por rodada** (`split`): cada mensagem que a mãe mandou à filha abre uma "rodada"; os pedidos da filha são repartidos pelas rodadas pela hora (`roundOf`: o pedido vai à última mensagem anterior a ele). Cada rodada vira um cartão sob a tarefa da mãe de onde a mensagem saiu. Decisão dele (2026-10-21): "um cartão por mensagem; o cartão k vai sob a tarefa que mandou a mensagem k".
- **Pedidos abertos pelo usuário na filha** (`own`): cada um vira um cartão à parte, sem rodada, no fim do pedido **em que a filha foi aberta** (`originEnd`). Motivo registrado: "work it did not ask for hung from 'Reverter o commit…'": um trabalho que a mãe não pediu não deve pendurar na tarefa da última mensagem dela.
- **Dentro de cada cartão**, só os 3 últimos pedidos daquela rodada (`SHOWN_CARD_TURNS = 3`), mais os que têm algo aberto.
- **Cortes do painel da mãe:**
  - **completa**: só os 3 últimos pedidos (`SHOWN_TURNS`); os outros viram "+N pedidos anteriores". Exceção: pedido com tarefa aberta, ou com sessão trabalhando **cuja rodada atual** (`roundAt` = a tarefa da última mensagem) está sob ele. Cartões soltos (sem tarefa de origem) parados e antigos viram "+N cartões antigos de sessões".
  - **resumida** (`trimToWork`): só os pedidos do trabalho atual; cartões só se a âncora está no trabalho; "uma sessão ainda trabalhando sob um pedido fora do trabalho não traz o pedido de volta, nem o cartão é desenhado solto". Origem: a decisão dele quando "um pedido de um dia atrás voltou com os cartões velhos enquanto uma sessão trabalhava".
- **Rodada do turno próprio e "vivo":** o cartão do turno próprio pode ser o **líder** (o que tem tarefa em andamento) e, nesse caso, a "rodada atual" da sessão aponta para a tarefa da última mensagem da mãe (`lastAnchor`), não para onde o cartão está. É isso que faz o pedido de origem **não** ser mantido como "tem sessão viva sob ele".

## 2. Por que cada item dos prints não aparece (reprodução)

Cenário no kit (cópia de `origin/main`): a mãe abre a filha num pedido antigo ("Reescrita", tarefa "Pedir a reescrita à Governança") e manda a mensagem (rodada 1 → pedido da filha "Reescrever autoria e publicar PR 26", ✓). O usuário digita na filha ("pode apagar e reescrever", turno próprio): "Apagar branches" ✓ e "Reescrever com filter-repo" **◉**. Depois, um pedido atual na mãe manda nova mensagem de "Aguardando sua autorização na Governança" (rodada 2 → "Conferências de leitura (passo 0)", ✓).

**A: o pedido antigo ainda entre os 3 últimos** (completa e resumida iguais):
```
✓ Pedido antigo: reescrever autoria  3/4
└─ ✓ Reescrita  ◍  3/4
   │  ◍ governanca
   │  ◉ pode apagar e reescrever  1/2          ← turno próprio: cartão no fim do pedido de ORIGEM
   │  ├─ ✓ Apagar branches (autorizado na filha)
   │  └─ ◉ Reescrever com filter-repo
   └─ ✉ Pedir a reescrita à Governança  ◍  1/1 · entregue
         ◍ governanca
         ✉ Reescrever autoria e publicar PR 26  1/1  ← rodada 1
         └─ ✓ Backup e reescrita da autoria
◉ Pedido atual: limpeza  1/2
└─ ◉ Limpeza
   ├─ ✉ Aguardando sua autorização na Governança  ◍  · entregue
   │     ◍ governanca
   │     ✉ Conferências de leitura (passo 0)       ← rodada 2
   │     └─ ✓ Passo 0: conferências
   └─ ○ Limpar refs
```
Tudo aparece, mas o trabalho que o usuário autorizou **agora** está lá em cima, no pedido antigo, longe de onde ele olha.

**B: três pedidos depois do antigo** (o caso real; completa e resumida iguais; é o print 5):
```
Limpeza  3 de 4 · 75%  (sessão inteira: 6 de 8)   chips: ○ 1 — "sessões ativas" 0
+2 pedidos anteriores
✓ Pedido 3 … ✓ Pedido 4 …
◉ Pedido atual: limpeza  1/2
└─ ◉ Limpeza
   ├─ ✉ Aguardando sua autorização na Governança  ◍  · entregue
   │     ◍ governanca
   │     ✉ Conferências de leitura (passo 0)
   │     └─ ✓ Passo 0: conferências
   └─ ○ Limpar refs
```
- **(a) "Reescrever autoria e publicar PR 26" (29/10):** é o cartão da rodada 1, sob a tarefa do pedido antigo. O pedido foi cortado ("+2 pedidos anteriores") na completa e está fora do trabalho na resumida. Some nas duas.
- **(b) o trabalho de agora, autorizado direto na filha:** se a filha planejar, é turno próprio → cartão no fim do pedido de origem (o mesmo antigo) → cortado nas duas visões, **mesmo com tarefa ◉**. O cabeçalho ainda conta ("sessão inteira: 6 de 8"), mas o chip "sessões ativas" fica **0** e o busto da tarefa some: a mãe mostra a filha como se não estivesse trabalhando. No print 4 a filha ainda não planejou o trabalho atual; se não planejar, não há nem o que mostrar (a mãe só vê o que a filha põe no painel dela).
- O cartão sob "Aguardando sua autorização…" mostra só a rodada 2, porque cada cartão é uma rodada: por desenho, não por erro.

## 3. Bug, limite ou regra?

- **Regras decididas**, não bug de código: as três da seção "Essencial" têm origem registrada no `DESENVOLVIMENTO.md` e no catálogo (`sessoes.cartao-sob-a-tarefa-de-origem`, `sessoes.um-cartao-por-mensagem`, `cabecalho.limites-de-linhas`, `cabecalho.resumida-exclui-pedido-finalizado`, `pedidos.resumida-mantem-anteriores-com-algo-aberto`). Foram pensadas para cartões **velhos e parados** (o desenho de 1,6 MB; "cartões de dias de sessões arquivadas e paradas se empilhando"), e hoje escondem **trabalho vivo**.
- **O que é defeito mesmo dentro das regras:** o pedido de origem é cortado enquanto a filha trabalha nele, porque a conta de "sessão viva sob o pedido" olha a rodada da última mensagem, não o cartão do turno próprio. Pela regra "pedido com sessão trabalhando sob ele fica", ele deveria ficar. É o ponto que dá para corrigir sem decisão nova.
- **Limite do kit:** nenhum; tudo se reproduz.

## 4. Proposta: a mãe mostra tudo o que a filha planejou, executa e executou

Três mudanças, da mais barata à que mais muda:

**(i) O turno próprio da filha pendura no pedido vigente da mãe** (`split`, `originEnd`): em vez do fim do pedido em que a filha foi aberta, o fim do pedido da mãe que estava aberto **quando o usuário digitou na filha** (o último pedido da mãe com `at` anterior ao `at` do turno próprio); sem nenhum, o de origem, como hoje. Mantém o motivo da decisão dele ("não pendurar na tarefa que não pediu"), e põe o trabalho onde ele está olhando. Rótulo no cartão: "pedido do usuário na filha" (tooltip: o texto digitado).
- Regra `sessoes.cartao-sob-a-tarefa-de-origem` ganha `Reescrito:`; nova `sessoes.turno-proprio-da-filha-no-pedido-vigente`. Teste novo com `turns: [{ own: true }]` no `host` do kit (já aceita).

**(ii) O que está vivo nunca some** (completa e resumida): um cartão com sessão trabalhando **ou** com tarefa aberta é sempre desenhado. Se o pedido dele foi cortado ("+N pedidos anteriores") ou está fora do trabalho (resumida), o cartão é desenhado **solto no fim do painel**, com o nome do pedido de origem no título ("governanca · do pedido 'Reescrita', 29/10"). Cartões parados e concluídos seguem como hoje (cortados, "+N cartões antigos"). Também corrige o chip "sessões ativas" e o busto.
- Reescreve a decisão de `trimToWork` ("não traz o pedido de volta, nem o cartão é desenhado solto"): o pedido continua **não** voltando; só o cartão vivo aparece, solto. **Dúvida 1.**
- Regras: `pedidos.resumida-mantem-anteriores-com-algo-aberto` (texto), `cabecalho.limites-de-linhas` (exceção), nova `sessoes.cartao-vivo-nunca-some`. Testes: o cenário B acima nas duas visões; não-regressão dos cartões antigos.

**(iii) Ver o histórico inteiro quando quiser:** "+N pedidos anteriores" passa a abrir com um clique (como ▾/▸), desenhando os pedidos cortados; fechado por padrão, para o desenho continuar pequeno. Atende "tudo que as filhas planejaram, executaram", sem desfazer o limite de 400 linhas (que continua valendo). **Dúvida 2.** Pode ficar para depois.

Não muda: um cartão por mensagem; os 3 últimos pedidos dentro de cada cartão (com algo aberto, ficam); o limite de 400 linhas.

**Impacto:** `draw/layout.ts` (split, body, trimToWork, panel) e `hooks/render.tsx` (chips; o tempo, se (iii) da seção 5). `npm run impacto -- draw/layout.ts`: 54 cenários; com `render.tsx`, núcleo: tudo. Golden: "filha" **pode mudar** se o rótulo do cartão solto entrar no cenário; os 3 cenários atuais não têm turno próprio nem pedido cortado, então, em princípio, **não mudam**; o check decide. Validação dele no app depois do commit (ou antes, se o golden acusar).

## 5. O tempo 118:49:54

`sessionTime` (cabeçalho): do **primeiro início** entre as tarefas à vista até agora (se algo roda) ou até o último fim. Na filha, a resumida ainda mostra o pedido de 29/10 (o trabalho não foi limpo: algo estava aberto à vista quando o pedido novo entrou, provavelmente a ✉ "Force-push feito…" à mãe ainda na fila), então o tempo vai de 29/10 até 03/11: 118 h. No kit, com dois pedidos 19 s afastados, o cabeçalho mostra 0:19, a mesma conta. Não é relógio errado; é a definição "tempo da sessão inteira à vista", que mistura pedidos de dias diferentes.

Proposta (**dúvida 3**): o cabeçalho mostra o tempo do **pedido em andamento** (ou do último, se nada roda); o tempo da sessão inteira vai ao tooltip, junto com "sessão inteira: X de Y". Regra nova `cabecalho.tempo-do-pedido-atual`; o golden não muda (os 3 cenários têm um pedido só).

## 6. Dúvidas para o usuário

1. **Cartão vivo fora do pedido à vista** (proposta ii). Em 2026-10-23 ele decidiu que uma sessão trabalhando sob um pedido antigo "não traz o pedido de volta, nem o cartão é desenhado solto" (um pedido de um dia atrás voltava com cartões velhos). Hoje ele quer ver tudo o que a filha executa. Opções:
   - **(a) recomendado:** o cartão **vivo** (sessão trabalhando ou tarefa aberta) aparece solto no fim do painel, com o nome do pedido de origem; o pedido antigo não volta; cartões parados seguem cortados;
   - (b) o pedido antigo inteiro volta enquanto a filha trabalha nele (é o que ele rejeitou em 2026-10-23);
   - (c) manter como hoje (o trabalho some até ele abrir a completa e rolar; e mesmo assim some além de 3 pedidos).
2. **"+N pedidos anteriores" abrir com clique** (proposta iii): (a) sim, fechado por padrão (**recomendado**, resolve "tudo o que planejaram e executaram" sem crescer o desenho); (b) não agora.
3. **Tempo do cabeçalho:** (a) do pedido em andamento, com o da sessão inteira no tooltip (**recomendado**); (b) como hoje, do primeiro início ao agora de tudo à vista (os 118 h); (c) soma dos tempos dos pedidos, sem os intervalos.
4. **Onde fica o turno próprio da filha** (proposta i): (a) no fim do pedido vigente da mãe quando o usuário digitou (**recomendado**); (b) como continuação do último cartão da filha (sob a tarefa da última mensagem; ele rejeitou isso antes: "work it did not ask for hung from 'Reverter o commit…'"); (c) como hoje, no pedido de origem.

Sem resposta às dúvidas 1 e 4, a única correção que não contradiz decisão anterior é a do defeito da seção 3 (manter desenhado o pedido de origem enquanto o cartão do turno próprio tem sessão viva ou tarefa aberta), que resolve (b) só na completa e só até o pedido de origem sair dos 3 últimos.
