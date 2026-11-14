# Commit B da tarefa 5: rodadas dos cartões (análise, sem implementar)

Base: `23b7ff9`. O commit do achado 2 (a abertura de sessão conta como uso da tarefa) vem antes deste. Nada foi editado.

## Essencial

- **O harness cobre as rodadas.** O corte do cartão por rodada (`split`, `draw/layout.ts:271`) é puro e depende só de dados que o kit já fornece ou pode fornecer:
  - as **rodadas** da filha, gravadas pelo `SendMessage` da mãe (`Child.rounds`: hora e tarefa), com `relogio.advance` para separar as horas;
  - os **turnos** da filha, com `at`, e as tarefas com `turn`, no painel publicado;
  - o `received` da filha (as mensagens da mãe e das irmãs);
  - os `sends` da filha que mandou mensagem a uma irmã.
- **Mudança no kit:** o `host` aceita, por filha, `turnos`, `recebidas` (com `from` livre, para irmãs) e `envios`. Um helper `cartoes(linhas, nome)` lista os cartões de uma filha, cada um com a tarefa da mãe sob a qual está e as tarefas dentro dele. Cada teste tem 2–4 releituras: cabe nos 5 s.
- **Testes** em `tests/sessoes.test.ts`:
  - um cartão por mensagem;
  - mensagens juntas vão à última;
  - rodada descartada fora da contagem, em duas formas: abandonada e abortada;
  - a cadeia de irmãs na sequência, sem cartão dentro de cartão;
  - o ✉ da mensagem entre irmãs no cartão da remetente.
- **Catálogo — conflito histórico resolvido pelo git:**
  - `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` descreve a regra de `28ae764` (2026-10-23), que punha o cartão da destinatária **dentro** do cartão da remetente;
  - ela foi **desfeita no mesmo dia** por `fddd473`, a pedido do usuário: "quando uma tarefa chama uma sessão, o painel não deve ficar dentro de outro; deve ficar na sequência em que será executado";
  - a regra é reescrita: o cartão da destinatária fica na sequência, sob a tarefa da mãe; **só o ✉** da tarefa que mandou fica no cartão da remetente.
- **Sem dúvidas para o usuário:** as quatro regras e a nova têm origem clara, com as palavras dele em três delas. Risco técnico: a cadeia de irmãs é o caso mais frágil (`WAIT_ORIGIN`, a hora do envio da irmã); se não fechar no kit, fica `pendente` com o motivo.

## 1. Como as rodadas funcionam (código atual)

- **Rodadas** (`breaks`, `layout.ts:212–247`):
  - as próprias são `c.rounds` (uma por `SendMessage` da mãe: `{ at, anchor }`, `tool-call.ts`), mais as `unsent`;
  - as **de irmã** (`peer`) são cada `received` do painel publicado da filha cujo `from` é outra filha da mesma mãe. A âncora é a rodada da irmã antes da mensagem (pelos `sends` publicados da irmã, ou pelo último turno dela antes do envio), ou a âncora de origem da irmã.
- **Corte** (`split`, l. 271–390):
  - cada **turno** publicado da filha vai para a rodada da hora dele (`roundOf`: a última rodada com `at ≤ turno.at`);
  - turno aberto por **várias mensagens da mãe entregues juntas** (o `received` dela traz mais de uma desde o turno anterior): vai à **última** rodada do intervalo (`8b67366`);
  - as tarefas de nível 1 vão à parte do turno delas (`t.turn`);
  - cada parte vira um cartão: a parte 0 na âncora de origem; a parte k sob a tarefa da mensagem k (`rounds[k-1].anchor`);
  - o cartão **líder** (`lead`) é a parte com tarefa em andamento, ou a última; só ele mostra a espera e o anel.
- **Descarte** (`discarded`, l. 117–121): um cartão de rodada que **não é o líder** e ainda tem tarefa aberta (a mensagem seguinte já começou outra rodada), ou o líder de uma sessão **parada com Esc** (`aborted`) com tarefa aberta.
  - As folhas dele, ✓ inclusive, saem da contagem dos pais, do cabeçalho e do chip "interrompidas" (`session()`, l. 1138–1141: `nodes: []`). O cartão continua desenhado.
- **Cadeia** (`fddd473`): a parte que nasce de mensagem de irmã vai **para baixo da tarefa da mãe** onde a rodada da irmã está, no mesmo nível, na ordem de execução (`inOrder` por `begins`). Nunca dentro do cartão da irmã.
- **Âncora das mensagens da mãe:** `sendAnchor`. Com o achado 2, uma tarefa que já abriu sessão conta como usada. Nos testes, cada `SendMessage` sai de uma tarefa iniciada e ainda sem sessão nem envio.

## 2. Regras (`regras/sessoes.md`)

| id | Situação | Origem (resolvida) | Estado |
|---|---|---|---|
| `sessoes.um-cartao-por-mensagem` (nova) | sim | decisão do usuário, 2026-10-21: "filha ocupada que recebe mensagem nova tem o painel duplicado; o cartão antigo fica onde estava e o novo vai sob a tarefa da principal que mandou a mensagem" (DESENVOLVIMENTO); commits `4af1b92`, `5508b25` | coberto |
| `sessoes.mensagens-juntas-vao-a-ultima` | sim | decisão do usuário, 2026-10-23: "quero ver as tarefas lineares andando de cima para baixo; as paralelas andam fora de ordem, normal, mas as lineares precisam seguir uma linha do tempo"; `8b67366` | coberto |
| `sessoes.rodada-descartada-fora-da-contagem` | sim | decisão do usuário, 2026-10-24 ("as tarefas dessa sessão foram descartadas"); `bf77359` | coberto (o "Dado" passa a citar as duas formas: rodada anterior abandonada com tarefa aberta, e sessão parada com Esc com tarefa aberta) |
| `sessoes.cadeia-sem-cartao-dentro-de-cartao` | sim | decisão do usuário, 2026-10-23: "quando uma tarefa chama uma sessão, o painel não deve ficar dentro de outro; deve ficar na sequência em que será executado"; `fddd473` | coberto (o "Então" ganha "sob a tarefa da mãe que iniciou a cadeia, no mesmo nível, na ordem de execução") |
| `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` | **reescrever** | `28ae764` (2026-10-23), desfeito por `fddd473` no mesmo dia | coberto, com o texto novo: Dado uma filha que manda mensagem a uma irmã; Quando o painel é desenhado; Então a tarefa da mensagem, com o ✉, fica no cartão da remetente, e o cartão da destinatária fica na sequência sob a tarefa da mãe, não dentro do cartão da remetente. Origem: "28ae764, 2026-10-23; o cartão dentro do cartão foi desfeito por fddd473 ('o painel não deve ficar dentro de outro')". |

## 3. Kit (selo do kit, tipo `refatoracao`, motivo "rodadas: turnos, recebidas e envios da filha")

`tests/kit/ambiente.ts`, na `Filha`:
```ts
  turnos?: { id: number; at: number; title?: string }[]          // os turnos da filha, com a hora de início
  recebidas?: { from: string; at: number }[]                     // received além do que recebeu() acrescenta (de irmãs)
  envios?: { to: string; anchor?: string; at: number; taken?: boolean }[]  // sends publicados (mensagem a uma irmã)
```
- O painel publicado vira `groups: [{ agent: '', label: '', tasks: painel.tasks, turns: turnos }]`, `received: [...recebidas, ...as de recebeu()]`, `sends: envios`.
- As tarefas da filha levam `turn: <id do turno>` (já é campo de `TaskNode`).

`tests/kit/leitura.ts`:
```ts
// Os cartões de uma filha, na ordem do painel: a tarefa da mãe sob a qual cada um está (a linha
// anterior de nível menor que não é cartão), as tarefas dentro dele e o nível.
export function cartoes(linhas: Linha[], nome: string): { sob: string; tarefas: string[]; nivel: number }[]
```
- O `debaixo(...)`, hoje local em `durabilidade.test.ts`, pode passar a usar `cartoes`. É opcional: mudar o teste selado exige selo `refatoracao`. **Não mexer** neste commit.

`tests/kit/cenario.ts`: nada novo. `envio`, `abrirSessao`, `aviso` e `relogio.advance` bastam.

## 4. Testes (`tests/sessoes.test.ts`)

Plano da mãe: A › {Um, Dois, Três}. Filhas: `K1` (`filha-um`) e `K2` (`filha-dois`). O relógio avança entre os passos para separar as horas (`T0 = AGORA`).

1. **Um cartão por mensagem** (`sessoes.um-cartao-por-mensagem`):
   - `start 1`; `abrirSessao` (K1 sob Um); a filha com turno 1 (`at` T0+10) e a tarefa "f1" (turn 1);
   - `start 2`; `advance(1000)`; `envio(K1)` em fila (âncora: Dois);
   - a filha ganha o turno 2 (`at` T0+2000) com "f2" (turn 2) e `recebeu(K1, T0+1500)`; `aviso`;
   - `cartoes('filha-um')` → dois: `{ sob: 'Um', tarefas: ['f1'] }` e `{ sob: 'Dois', tarefas: ['f2'] }`.
2. **Mensagens juntas: o cartão do turno vai à tarefa da última** (`sessoes.mensagens-juntas-vao-a-ultima`):
   - como o 1, mas Dois e Três iniciados, e dois `envio(K1)` em fila (de Dois, depois de Três, separados por `advance`);
   - a filha recebe os dois (`recebeu` nas duas horas) e abre **um** turno depois do último, com "f2";
   - o cartão com "f2" fica sob **Três**; nenhum cartão sob Dois tem tarefa; o ✉ de Dois fica verde (entregue), sem cartão.
3. **Rodada anterior abandonada sai da contagem** (`sessoes.rodada-descartada-fora-da-contagem`):
   - como o 1, mas "f1" fica **aberta e iniciada** no turno 1 quando chega o turno 2;
   - o cabeçalho e o "x/y" do pai não contam "f1": o total é o de "Um, Dois, Três, f2", sem "f1";
   - o cartão de f1 continua desenhado;
   - variante com "f1" ✓: ela também sai (o cartão inteiro é descartado).
4. **Sessão parada com Esc e tarefa aberta sai da contagem** (mesmo id):
   - uma rodada só; a filha `rodando: false`, `aborted: true`, com "f1" iniciada aberta;
   - "f1" fica fora do total; o cartão desenhado mostra "f1" ✕;
   - sem `aborted` (parada normal), "f1" ◷ e conta. Não-regressão de `sessoes.filha-parada-pendentes-seguem-pendentes`.
5. **A cadeia de irmãs fica na sequência, sem cartão dentro de cartão** (`sessoes.cadeia-sem-cartao-dentro-de-cartao`):
   - `start 1`, `abrirSessao` (K1 sob Um); `start 2`, `abrirSessao` (K2 sob Dois; pelo achado 2 vai a Dois);
   - K1 publica uma tarefa "Avisar K2" (turn 1, `msg: true`) e `envios: [{ to: K2, anchor: 'Avisar K2', at: T0+3000 }]`;
   - K2 publica `recebidas: [{ from: K1, at: T0+3100 }]` e o turno 2 (`at` T0+3200) com "d2";
   - `aviso` → `cartoes('filha-dois')` tem um cartão com "d2" **sob Um** (a tarefa da mãe da rodada de K1), com o mesmo `nivel` dos cartões de K1;
   - nenhum cartão de K2 tem `nivel` maior que o de um cartão de K1 logo acima (não está dentro).
6. **A mensagem entre filhas fica no cartão da remetente** (`sessoes.mensagem-entre-filhas-no-cartao-da-remetente`), no mesmo arranjo do 5:
   - a linha "Avisar K2" está dentro do cartão de K1, com `carta` `fila` enquanto o envio não foi tomado;
   - com `taken: true`, `entregue`.

As asserções usam o nome dos cartões, a tarefa da mãe sob a qual estão, as tarefas dentro deles, o `nivel`, os números do cabeçalho e o `carta`. Nada interno.

## 5. Checklist do app

- A ordem dos cartões na tela com várias sessões reais (`inOrder` por início do trabalho).
- O cartão de mensagem de irmã que espera a origem (até 10 s sem desenhar, `WAIT_ORIGIN`): o "pulo" que ele evita.
- A espera e o anel só no cartão líder.
- Sessões com mais de 20 rodadas (o limite de `rounds`).

## 6. Riscos

- **A cadeia de irmãs (testes 5–6):** depende de a âncora da rodada da irmã ser conhecida (`known`). Sem os `sends` publicados de K1, ou com o último turno de K1 antes do envio ausente, a parte fica escondida por até 10 s (`WAIT_ORIGIN`): no kit, com o relógio parado, "para sempre". Montar K1 com `envios` **e** turno com `at` antes do envio. Se ainda assim não fechar, o cenário fica `pendente (sessoes, cadeia de irmãs no kit)` com o motivo, sem ajustar.
- **Dependência do commit do achado 2:** o teste 5 espera K2 sob Dois. Sem o achado 2, K2 cairia sob Um. Implementar só depois do commit do achado 2.
- **`turn` nas tarefas da filha:** sem ele, as tarefas vão à parte 0 (o cartão de origem), e o corte não aparece. O kit precisa mandar `turn` em toda tarefa de teste das filhas.
- **Selos:** testes novos (`novo`); o kit, `refatoracao`; `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` com o texto reescrito (é cenário `pendente` sem teste, então não exige `Reescrito:`; registrar a origem nova). Nenhum teste existente muda.
- **Recarga do clone:** nenhum arquivo do mod muda; só `tests/` e `regras/`.
- **Divergência:** se um teste mostrar o cartão no lugar errado, é bug do plugin. Fica `pendente` com o motivo e é relatado; não se ajusta.

## 7. Brief para a Implementação (depois do commit do achado 2)

Na branch `test/regressivos-automacao-testes`. Um commit local. Sem push.

1. `tests/kit/ambiente.ts`: `Filha` com `turnos`, `recebidas` e `envios`, e o publicado com `turns`, `received` e `sends`.
2. `tests/kit/leitura.ts`: `cartoes(linhas, nome)`.
3. `tests/sessoes.test.ts`: os testes 1–6 da seção 4, cada um com `// Regra:`.
4. `regras/sessoes.md`:
   - as quatro de rodadas → `coberto`, com as origens da seção 2 e o texto de "rodada descartada" e de "cadeia" completados;
   - `mensagem-entre-filhas-no-cartao-da-remetente` reescrita;
   - nova: `sessoes.um-cartao-por-mensagem` (coberto).
5. `regras/visual.md`: o item da ordem e da espera de cartões, em checklist, se ainda não estiver lá.
6. Selar os testes novos e o kit; `npm run check` verde; o relato com `npm run testes:alterados` (nenhum teste existente mudou).

Commit: `test(task-tree): rodadas das sessões (um cartão por mensagem, mensagens juntas, rodada descartada, cadeia de irmãs)`.

O usuário valida lendo `tests/sessoes.test.ts` e `regras/sessoes.md` (a regra reescrita da mensagem entre filhas) e, no app, os itens da seção 5.
