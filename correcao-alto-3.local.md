# Correção do achado alto nº 3: o turno de abertura da filha vira "pedido do usuário na filha"

Plano de 2026-11-10. Só leitura no repositório (branch `fix/achados-altos-auditoria`, HEAD `07e602e`,
com os achados 1 e 2 já commitados). Auditoria: `auditoria-mod-task-tree.local.md`, item 3 dos 13 de
severidade alta e o achado detalhado "O primeiro turno da filha (o texto do start_session) é marcado
como 'pedido do usuário na filha'" (seção "Sessões filhas e cartões"), mais o item 3 de "Proposta de
correção, em ordem".

**Resumo:** correção inteira **sem decisão do usuário**, só no lado da mãe (`draw/layout.ts`, `split`).
Não muda teste selado, cenário decidido nem golden. Ensaiada numa cópia: `npm run check` completo
passa (171 de 171, regressão 169 de 169 dos testes de HEAD contra o código novo); o teste novo
principal falha em HEAD com exatamente o desenho da auditoria. **Sem BLOQUEIO.**

## 1. Causa (estado em HEAD 07e602e)

- `task-tree/hooks/prompt-submit.ts:88`: `openTurn($, it.title, !it.peer, it.from)`. Todo prompt que
  abre turno e não traz `<cross-session-message>` é marcado `own: true` (`hooks/panel.ts:176`),
  inclusive o primeiro prompt da filha, que é o texto do `start_session`.
- `task-tree/draw/layout.ts:321` (`split`): `ownTurns = turns.filter(u => u.own === true)`; na linha
  348 cada turno `own` vira parte de chave negativa; na 412 a âncora dessa parte é `inForce(...)`, o
  último nível 1 do pedido vigente da mãe, e na 416 ela ganha `ownTurn` (título
  "<nome> · pedido do usuário na filha", `layout.ts:1173`).
- Resultado: o cartão de abertura sai da tarefa de origem, vai para a linha do nível 1 (antes das
  subtarefas) e ganha o rótulo errado. Viola `sessoes.cartao-sob-a-tarefa-de-origem`;
  `sessoes.turno-proprio-da-filha-no-pedido-vigente` fala só do turno "que o usuário abriu digitando
  na filha".
- Os testes não pegam: as filhas fabricadas publicam o turno 1 sem `own` (`tests/sessoes.test.ts:143`,
  `turno(id, at)`), e o único turno próprio testado tem id 2 (`sessoes.test.ts:325`).

## 2. Dados reais conferidos (só leitura, `~/.claude/task-tree-waits`)

Mães com `openedAt` gravado, e o turno 1 da filha correspondente:

- 23 de 27 filhas publicaram o turno 1 com `own: true`; as outras 4 começaram por `msg` (mensagem de
  outra sessão) ou o turno 1 já tinha sido descartado (sem tarefa).
- Distância do turno 1 ao `openedAt`: de 4,6 s a 96,9 s (o máximo com 10 filhas abertas de uma vez,
  `local_52f619b3`).
- Uma filha (`local_5cfc57f0`, mãe `local_ee919fbf`) tem turno 1 `own` 4 h depois do `openedAt`, com
  títulos claramente digitados ("Parar tudo"…): os ids de turno recomeçam depois de `/clear`
  (`session-start.ts:72-78` zera os grupos). Por isso a regra não pode ser só "id 1".

## 3. A correção (lado da mãe)

Por que na mãe e não na filha: os arquivos já publicados e as filhas em outra versão trazem a marca;
e na filha o primeiro prompt chega ora puro, ora com a tag de outra sessão (o `e.origin.kind` que o
app manda nesse prompt não foi medido). A correção na origem (decidir `own` pelo `origin.kind`) fica
para o achado médio "'digitado pelo usuário' é qualquer prompt que não seja mensagem de sessão", que
pede medir no app antes.

Regra: o turno de abertura é o turno **id 1** da filha, quando ela tem `openedAt` e o turno começou
até **10 min** depois dele (ou sem `at`); sem `openedAt`, quando a ligação tem âncora (ligações
antigas, de antes do `openedAt`). Esse turno não é tratado como próprio: cai na parte 0 (âncora
`c.anchor`, nome simples), como um turno comum de antes da primeira rodada. Filha sem `openedAt` nem
âncora (cartão `own_initiative` clicado, hand-off) fica como hoje, para não antecipar a pergunta 20
("Filha aberta por clique num cartão proposto ou por hand-off").

Diff de `task-tree/draw/layout.ts` (ensaiado):

```diff
@@ export const WAIT_ORIGIN = 10000
 export const WAIT_ORIGIN = 10000
+// The turn that opened a session is its first (id 1) when it began within OPENING ms of when this
+// session opened it (its `openedAt`; seen up to 97 s with many sessions opened at once). A turn 1
+// begun long after it is one the person typed there after a /clear (the ids start over).
+const OPENING = 10 * 60_000
@@ split(...)
-  const ownTurns = (main.turns ?? []).filter(u => u.own === true)
+  // The turn that opened the session (the start_session's text) is not one the person typed there,
+  // though the session publishes it as its own (any prompt that is not another session's message is,
+  // see prompt-submit): its card stays under the task it was opened from (the panels already
+  // published bring the mark, so it is told apart here). A session with neither `openedAt` nor an
+  // origin (not opened by a start_session of this one) keeps it as it is.
+  const opening = (u: Turn) => u.id === 1 && (c0.openedAt !== undefined ? u.at === undefined || u.at - c0.openedAt < OPENING : c0.anchor !== undefined)
+  const typed = (u: Turn) => u.own === true && !opening(u)
+  const ownTurns = (main.turns ?? []).filter(typed)
@@ (laço que dá a parte de cada turno)
-    if (u.own === true) {
+    if (typed(u)) {
       // Its own part, keyed below zero (one per turn), apart from the rounds.
```

O que muda no painel: o cartão da filha recém-aberta fica sob a tarefa de origem, com o nome simples
(ex.: "auditoria-mod" sob "Abrir a sessão em espera", não "auditoria-mod · pedido do usuário na
filha" sob o nível 1 "65"). Isso também desfaz a primeira metade dos "dois cartões da auditoria-mod"
do print. Os turnos realmente digitados depois (id ≥ 2, ou id 1 bem depois da abertura) seguem como
hoje, um cartão por turno no pedido vigente (decisão de 2026-11-03 intacta).

## 4. Teste novo (`task-tree/tests/sessoes.test.ts`, no fim do arquivo, depois de uma linha em branco)

Usa o que o arquivo já tem (`fixar`, `host`, `noTurno`, `PROPRIO`, `abrirNoPedidoAntigo`, `cartoes`).

```ts
// O turno 1 como a filha o publica quando o texto do start_session chega como prompt próprio
// (os arquivos publicados reais trazem a marca).
const abertura = (at: number) => ({ id: 1, title: 'Texto do start_session', at, own: true })

// Regra: sessoes.turno-de-abertura-da-filha-sob-a-origem
test('o turno de abertura que a filha publica como próprio fica sob a tarefa de origem, sem "pedido do usuário na filha"', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'iniciada')], turns: [abertura(AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }, { id: 'o2', title: 'Conferir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo === PROPRIO), emTexto(p)).toBe(false)
  const cs = cartoes(p, 'governanca')
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
  expect(cs[0]?.tarefas, emTexto(p)).toEqual(['Reescrever autoria'])
})

// Regra: sessoes.turno-de-abertura-da-filha-sob-a-origem, sessoes.turno-proprio-da-filha-no-pedido-vigente
test('o turno 1 próprio que começa bem depois da abertura (a filha limpa com /clear) segue como pedido do usuário na filha', async ($: any, on: any) => {
  const { h } = await abrirNoPedidoAntigo($, on)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  h.filha(K1).painel = { tasks: [noTurno(1, '1', 'Reescrever com filter-repo', 'iniciada')], turns: [{ id: 1, title: 'pode apagar e reescrever', at: AGORA + 20 * 60_000, own: true }] }
  await aviso($)
  const p = await painel($)
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
})
```

Em HEAD, o primeiro falha com o desenho da auditoria:

```
└─ ◉ Reescrita  ◍  0/3  0:01
   │  ◍ governanca · pedido do usuário na filha
   │  ◉ Reescrever autoria  0:01
   ├─ ◉ Pedir a reescrita  0:00
   └─ ○ Conferir a reescrita
```

O segundo passa em HEAD e com a correção: trava a janela de 10 min (o turno digitado depois de um
`/clear` não pode virar "abertura").

## 5. Cenário novo no catálogo (`regras/sessoes.md`, logo depois de `sessoes.turno-proprio-da-filha-no-pedido-vigente`)

```markdown
### sessoes.turno-de-abertura-da-filha-sob-a-origem
O turno que abriu a filha (o texto do start_session) não é pedido do usuário na filha, mesmo quando ela o publica como próprio.

- Dado uma filha aberta a partir de uma tarefa, que publica o primeiro turno marcado como próprio (os arquivos publicados reais trazem a marca)
- Quando a mãe desenha o painel
- Então o cartão desse turno fica sob a tarefa de origem, com o nome simples, sem "pedido do usuário na filha"; um turno 1 marcado como próprio que começa bem depois da abertura (a filha limpa com /clear, os turnos recomeçam) segue como pedido do usuário na filha (sessoes.turno-proprio-da-filha-no-pedido-vigente)

Origem: auditoria 2026-11-10 (o primeiro turno da filha é marcado como pedido do usuário na filha); aplica sessoes.cartao-sob-a-tarefa-de-origem e sessoes.turno-proprio-da-filha-no-pedido-vigente ("O turno que o usuário abriu digitando na filha"), sem mudar nenhuma das duas.
Código: draw/layout.ts
Estado: coberto
```

Nenhum cenário existente é reescrito (nada de `Reescrito:`).

## 6. Passos, na ordem

1. Impacto antes de tocar: `npm run impacto -- task-tree/draw/layout.ts` (saída do ensaio abaixo).
2. Num passo só (o clone recarrega o mod a cada save; ver CLAUDE.md, "Editar o mod sem quebrar a
   recarga"): aplicar o diff de `layout.ts`, o teste da seção 4 e o cenário da seção 5. O diff
   completo do ensaio (os quatro arquivos, `selos.json` incluso) está em
   `<scratchpad>\alto3.diff`
   (o scratchpad é desta sessão; se tiver sumido, o código acima basta).
3. Selar os dois testes novos (tipo `novo`):
   - `npm run regras:selar -- 'task-tree/tests/sessoes.test.ts::o turno de abertura que a filha publica como próprio fica sob a tarefa de origem, sem "pedido do usuário na filha"' --tipo novo --motivo "auditoria 2026-11-10, achado alto 3"`
   - `npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o turno 1 próprio que começa bem depois da abertura (a filha limpa com /clear) segue como pedido do usuário na filha" --tipo novo --motivo "auditoria 2026-11-10, achado alto 3"`
4. `npm run check` (todas as etapas) e `npm run testes:alterados` para o relato.
5. Commit local só dos quatro arquivos (`git commit -- regras/selos.json regras/sessoes.md
   task-tree/draw/layout.ts task-tree/tests/sessoes.test.ts`), mensagem sugerida:
   `fix(task-tree): o turno de abertura da filha fica sob a tarefa de origem`. Sem push nem PR (o
   usuário libera depois da validação no app).
6. Checklist do app (o harness não vê): abrir uma filha real por `start_session` a partir de uma
   subtarefa em andamento e conferir, na mãe, o cartão sob essa subtarefa, com o nome simples; depois
   digitar direto na filha e conferir que esse turno ainda vira "· pedido do usuário na filha" no
   pedido vigente.

## 7. Ensaio (cópia em `scratchpad\alto3`, clone de `07e602e`)

- `npm run check`: `ok` em regras, travas, selos, os dois validate, tsc, plugin test (171 pass, 0
  fail) e regressão ("169 testes de HEAD contra o código novo, 0 falharam"). Golden intacto.
- Antes da correção: 170 pass, 1 fail (o teste de abertura, desenho acima).
- `npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum"; novos: os dois acima.
- Nota do ensaio: num clone novo o `validate` não gerou `task-tree/.claude-plugin/types/` e o `tsc`
  falhou por falta do tsconfig gerado; copiei a pasta do repositório. No repositório real ela já existe.
- `npm run impacto -- task-tree/draw/layout.ts`: 84 cenários afetados (o `layout.ts` é de muitas
  áreas), entre eles `sessoes.cartao-sob-a-tarefa-de-origem` (2 testes),
  `sessoes.turno-proprio-da-filha-no-pedido-vigente` (3 testes, com o novo) e
  `sessoes.turno-de-abertura-da-filha-sob-a-origem` (2 testes); checklist do app:
  `cabecalho.aviso-de-painel-grande-volta`, `subagentes.cartao-no-app`, `ultracode.cor-e-corte`;
  golden: `visual.desenho-principal`, `visual.desenho-cartao-filha`, `visual.desenho-envios`,
  `visual.desenho-subagente` (todos passam); fora do mapa: nenhum.

## 8. Decisões e riscos

- **Sem BLOQUEIO.** Não contradiz decisão registrada: aplica `sessoes.cartao-sob-a-tarefa-de-origem` e
  a letra de `sessoes.turno-proprio-da-filha-no-pedido-vigente` ("digitando na filha"). Não toca as
  perguntas pendentes 13 (fundir turnos próprios num cartão) nem 20 (filha aberta por clique ou
  hand-off, que fica como hoje).
- A janela de 10 min é escolha técnica, não do usuário: o máximo visto é 97 s. Risco residual: um
  `/clear` na filha seguido de digitação nos primeiros 10 min depois da abertura seria lido como
  abertura (cartão sob a origem, sem o rótulo). Raro, e o efeito é o de hoje para turnos não próprios.
- Fica de fora (outro achado, médio): decidir `own` na própria filha pelo `e.origin.kind`; antes,
  registrar no log o `kind` do prompt de abertura e de um prompt digitado.
