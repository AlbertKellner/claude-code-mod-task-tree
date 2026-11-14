# Tarefa 2: kit de helpers e 2 testes de árvore (detalhamento antes da implementação)

Base: `main` `9980131` (tarefa 1). Fontes conferidas:
- `task-tree/tests/fumaca.test.ts` e `scripts/testes.mjs`;
- as declarações do kit em `task-tree/.claude-plugin/types/claude-code/index.d.ts` (módulo `claude-code/testing`, linhas ~15819–16950, binário 2.1.308);
- `hooks/tools.ts` (`startTool`, `doneTool`), `state/tasks.ts` (`settle`, `begin`), `draw/svg.ts` (`GLYPH`);
- a suíte removida (`b9cd016~1:task-tree/tests/task-tree.test.ts` e `reinicio.test.ts`).

Nada foi editado.

## Essencial

- A API do kit confirma o plano, com dois ajustes.
  1. Não existe `recarga()` no kit. Cada teste é um módulo novo com `$.state` vazio, o que equivale a um **reinício**. A recarga é simulada semeando o `$.state` pelo teste, como a suíte antiga fazia. Isso fica para a tarefa 7, não para esta.
  2. O painel é lido pela superfície **terminal**, cuja árvore é texto e glifos (`○ ◉ ✓ ✕ ◷`), o que permite asserções de comportamento sem SVG.
- Esta tarefa cria só `tests/kit/ambiente.ts`, `tests/kit/cenario.ts` e `tests/kit/leitura.ts`, mais `tests/arvore.test.ts` com 2 testes:
  - pai fecha quando todos os filhos fecham;
  - `start` reabre os pais de uma tarefa concluída, e recusa uma tarefa concluída que tem subtarefas.
- O usuário valida lendo `arvore.test.ts` e vendo a mensagem de erro de um teste quebrado de propósito: ela imprime o painel em texto.

## 1. API real do kit (confirmada nas declarações)

- `test(nome, corpo)` ou `test(nome, { timeoutMs, plugins, options }, corpo)`; o corpo é `($, on) => …`. O limite é de 5000 ms por teste e cada arquivo roda num processo. Também há `describe`, `expect` (com `toBe`, `toEqual`, `toMatchObject`, `toContain`, `toMatch`, `toHaveLength`, `.not`, `.resolves`) e `tier`.
- Os `on` são registrados **antes** da primeira chamada a `$`, porque é ela que carrega o plugin. Embaixo de todos os plugins há um hook do kit que lança erro com o nome do evento quando nada respondeu, e um `stub` de `on` responde com `{ value }`, `{ deny }` ou `{ result }`.
- **Ferramentas:** `$.tool.call({ tool: 'mcp__task-tree__plan', tasks, request?, agentId? })` devolve `{ result | text }`. Sem `agentId`, a chamada vem do loop principal.
- **Prompt e turno:** `$.prompt.submit(...)`, `$.turn.complete(...)`, `$.session.start(...)` e `$.classic.SessionStart({ source })`. Não são usados na tarefa 2.
- **Desenho:** `$.ui.mount({ plugin: 'task-tree', surface: 'terminal' | 'desktop', component: 'Pane', props, requestId: 'task-tree' })` devolve um handle com:
  - `drawn()`: a árvore como dados (`RenderElement`);
  - `find({ type?, key?, text? })` e `findAll(...)`, que devolvem `FoundElement { type, key, props, text, children }`;
  - `press({ key })`, `redraw(props?)` e `unmount()`.

  O kit "nunca verifica a pintura", só a árvore que o mod devolve. O teste-fumaça já usa esse caminho (`surface: 'terminal'`).
- **mock:**
  - `mock.clock(on, { now })` devolve `{ now, advance(ms), set(ms), settle(), sleep(ms) }`; as esperas (`every`, `after`, `sleep`) ficam presas até um `advance`.
  - `mock.store(on, entradas?)` guarda o store em memória.
  - `mock.env(on, vars)` responde `$.env.get`.
  - `mock.session(on)` responde `appended()`.
  - Não há `mock.process` nem mock da lista do host: `process.run`, `ui.status`, `ui.panes` e as `mcp`/sessões se respondem com `on('<evento>', () => ({ value }))`, como a suíte antiga fazia com `clock.now`, `clock.every`, `ui.status` e `ui.log`.
  - O `$.state` é atendido pelo kit (memória, vazio a cada teste).
- **Sem ler/gravar arquivos nem ambiente** dentro do teste ("no fs, network or process").

**Hooks do host que o mod chama ao planejar e desenhar.** A ser confirmado na implementação rodando o teste: o kit falha nomeando o evento sem resposta.
- O fumaça passa sem nenhum stub. Ou o kit responde esses eventos, ou o mod os tolera, porque `plan` e o render terminal usam `try/catch`, e `stamp` lê o relógio do kit, que é o real.
- **Decisão:** o ambiente fixa o relógio com `mock.clock` (tempo determinístico) e nega `clock.every` para que nenhum relógio vivo dispare. Os demais (`ui.status`, `ui.log`, `ui.panes`, `process.run` do git) só entram se o teste reclamar deles. Esta tarefa não constrói stubs do host de sessões, que ficam para a tarefa 5.

## 2. Recarga e reinício no kit

- **Reinício:** cada teste já começa com o módulo novo, `$.state` vazio e as variáveis de módulo zeradas. Com `mock.store(on, storeSalvo)` e `$.session.start(...)`, o teste vira "reinício com o store restaurado".
- **Recarga a quente** (módulo novo com o `$.state` mantido): não existe API para isso. Duas saídas, a decidir na tarefa 7:
  1. Semear o `$.state` com as chaves que o mod usa (`groups`, `work`, `view`…), copiadas de um estado gerado por outro teste e guardado num módulo `.ts`, sem rodar `session.start`. É a abordagem antiga e é viável, mas presa ao formato das chaves; se elas mudarem, o teste muda.
  2. Cobrir a recarga só pelo checklist do app e testar o reinício pelo store.

  Recomendo a 1 para os três casos que já regrediram (painel, ligações e resumo ↩) e a 2 para o resto.
- Nada disso entra na tarefa 2.

## 3. Assinaturas dos helpers (só o necessário para os 2 testes)

`tests/kit/ambiente.ts`
```ts
import { mock } from 'claude-code/testing'
export const AGORA = 1_000_000
export const PROPS = (colunas = 60) => ({ title: 'Tarefas', isFocused: false, bodyColumns: colunas, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} }) as any
// Relógio fixo e sem relógio vivo; chamar antes da primeira chamada a $.
export function fixar(on: any, opcoes?: { agora?: number }): { relogio: ReturnType<typeof mock.clock> }
```
- `fixar` faz `mock.clock(on, { now: agora })` e `on('clock.every', () => ({ deny: 'sem relógio' }))`. Confirmar se `mock.clock` já atende `every`: as declarações dizem que ele segura as esperas, `every` inclusive, e nesse caso o deny é desnecessário. Na implementação, fica a versão que funcionar com o fumaça.

`tests/kit/cenario.ts`
```ts
export type No = { id: string; title: string; children?: No[] }
export type Resposta = { texto: string; erro: boolean }
export function plan($: any, tarefas: No[], request?: string): Promise<Resposta>
export function start($: any, ids: string[]): Promise<Resposta>
export function done($: any, ids: string[], summary?: string): Promise<Resposta>
```
- Os três chamam `$.tool.call({ tool: 'mcp__task-tree__<nome>', … })` e normalizam o resultado: `texto = String(r?.result ?? r?.text ?? '')` e `erro = r?.isError === true`.
- Sem `agentId` nesta tarefa: é YAGNI. O parâmetro opcional entra quando um teste de subagente precisar.

`tests/kit/leitura.ts`
```ts
export type Estado = 'pendente' | 'andamento' | 'concluida' | 'interrompida' | 'aguardando'
export type Linha = { texto: string; titulo: string; estado?: Estado; nivel: number }
export function painel($: any, opcoes?: { colunas?: number }): Promise<Linha[]>
export function linha(linhas: Linha[], titulo: string): Linha                 // lança erro com o painel em texto
export function emTexto(linhas: Linha[]): string                              // uma linha por linha, para mensagens
export function esperarEstado(linhas: Linha[], titulo: string, estado: Estado): void
```

Detalhes de `painel`:
- Monta com `surface: 'terminal'` e `PROPS(colunas)`, lê com `drawn()` e faz `unmount()`.
- Cada filho objeto da raiz é uma linha. `texto` é o texto mostrado (o rótulo de `Button` incluído) sem o seletor de visão no fim, como no `shown`/`view` da suíte antiga.
- `estado` sai do glifo da linha, pela mesma tabela de `draw/svg.ts` `GLYPH`: `○` pendente, `◉` andamento, `✓` concluída, `✕` interrompida, `◷` aguardando.
- `titulo` é o texto depois do glifo, aparado, sem contagem nem relógio. O título vem do elemento seguinte ao glifo, como na suíte antiga, e não de um regex sobre o texto inteiro.
- `nivel` vem do prefixo de guias (`├ └ │`), dividido pela largura da guia. Calibrar com o fumaça; se não for confiável, deixar de fora nesta tarefa, porque os 2 testes não precisam dele.

Outras regras:
- `linha(...)` acha a **única** linha cujo `titulo === titulo`. Se não achar uma só, lança `Error` com a mensagem `Linha "<título>" não encontrada (ou repetida). Painel:\n<emTexto>`.
- `esperarEstado` usa `expect(l.estado, '<título> no painel:\n' + emTexto(linhas)).toBe(estado)`. Com isso, toda falha imprime o painel inteiro.
- Os helpers são o **único** lugar que conhece os glifos e a forma da árvore. Os testes falam só de títulos e estados.

## 4. Os 2 testes de árvore (`tests/arvore.test.ts`)

Plano comum (`ARVORE`):
```
1 "Pedido"
├ 1.1 "Analisar"
└ 1.2 "Corrigir"
   ├ 1.2.1 "Editar"
   └ 1.2.2 "Validar"
```

**Teste 1: "pai fecha sozinho quando todos os filhos fecham".** Origem: regra do painel ("um pai fica concluído quando todos os filhos estão"), `settle` em `state/tasks.ts`.
1. `fixar(on)`, depois `plan($, ARVORE, 'Pedido de teste')`; esperar `texto` contendo `Plano exibido`.
2. `start(['1.1'])` e `done(['1.1'])`. No painel, "Analisar" está concluída e "Pedido" em andamento: o pai não fecha com filho aberto.
3. `start(['1.2.1'])` e `done(['1.2.1'])`. "Editar" está concluída; "Corrigir" e "Pedido" continuam em andamento.
4. `start(['1.2.2'])` e `done(['1.2.2'], 'Resumo do teste')`. "Validar", "Corrigir" e "Pedido" ficam **concluídas**; o pai e o avô fecharam sem `done` próprio. A resposta do último `done` contém `Concluídas:` e **não** contém `Avisos`.

**Teste 2: "start reabre os pais de uma tarefa concluída e recusa tarefa concluída com subtarefas".** Origem: `begin` (reabre os pais) e o aviso de `startTool` ("já foi concluída e tem subtarefas: replaneje o nível 1 com plan").
1. `fixar(on)` e `plan($, ARVORE)`; depois `start` + `done` em 1.1, 1.2.1 e 1.2.2, um por vez. Tudo concluído, como no fim do teste 1, sem repetir as asserções.
2. `start(['1.2'])`. A resposta contém `já foi concluída e tem subtarefas` e `Nada marcado`; no painel, "Corrigir" e "Pedido" **seguem concluídas**.
3. `start(['1.2.1'])`. A resposta contém `Em andamento: Editar`; no painel, "Editar", "Corrigir" e "Pedido" voltam a **andamento**, e "Validar" e "Analisar" seguem concluídas.

Notas:
- As asserções sobre o texto de resposta usam trechos curtos e estáveis (`Nada marcado`, `já foi concluída`), não a frase inteira.
- O estado "andamento" de um pai depende de o pai mostrar `◉`. Confirmar no primeiro teste rodado como o terminal desenha o pai aberto com filho em andamento: se aparecer `○` com relógio em vez de `◉`, a tradução fica em `leitura.ts`, e o teste não muda.
- Se o teste mostrar um comportamento diferente do esperado, o bug é do plugin: não se ajusta a asserção ao bug. Relatar à orquestradora.

## 5. Recarga do clone ao salvar arquivos em `tests/`

- O mod roda deste clone, e o engine recarrega o plugin quando um arquivo dele é salvo. A suíte antiga viveu em `task-tree/tests/` sem quebrar o mod. Os `*.test.ts` não são importados pelo `register.tsx`, então um teste com erro não deve recusar o módulo; mesmo assim, cada save pode disparar a recarga em todas as sessões, que zera as variáveis de módulo (relógios, `lastStatus`) e redesenha o painel.
- Risco prático: um piscar ou um relógio religado no painel do usuário enquanto os testes são escritos. Não é quebra.
- Não dá para confirmar sem o app se o engine ignora `tests/`. Pela regra de editar o mod sem quebrar a recarga, a Implementação faz assim:
  - escreve os 4 arquivos num passo só, ou numa cópia no scratchpad, e copia de uma vez;
  - roda `npm run check` antes de dar o passo seguinte;
  - observa se o painel recarregou (o log de depuração, ou o usuário vendo) e relata, para fechar essa dúvida.

## 6. Brief para a Implementação

Tarefa 2 do plano de automação (`analise-plano-automacao-testes.local.md`). Branch `main`, depois de `9980131`. É um commit local. Sem push.

Arquivos novos, escritos de uma vez (copiar do scratchpad):
1. `task-tree/tests/kit/ambiente.ts`: `AGORA`, `PROPS(colunas = 60)` e `fixar(on, { agora? })` (mock.clock; deny em `clock.every` só se necessário), conforme a seção 3.
2. `task-tree/tests/kit/cenario.ts`: `No`, `Resposta`, `plan`, `start` e `done` sobre `$.tool.call`, conforme a seção 3.
3. `task-tree/tests/kit/leitura.ts`: `Estado`, `Linha`, `painel` (terminal, a partir de `drawn()`, glifos da tabela `GLYPH`), `linha`, `emTexto`, `esperarEstado`, conforme a seção 3. Toda falha imprime o painel em texto.
4. `task-tree/tests/arvore.test.ts`: os 2 testes da seção 4, com os nomes em português dizendo a regra e um comentário de uma linha com a origem.

Opcional: `fumaca.test.ts` passa a usar `PROPS` e `painel` do kit. Fica a critério, se reduzir duplicação sem mudar o teste.

Regras:
- Não importar funções internas do mod (`settle`, `begin`, `layout`); só `claude-code/testing` e o kit.
- Não construir helpers de pergunta, envio, sessões ou recarga: são das tarefas seguintes.
- Comentários curtos em português, como no resto do repositório.
- Se um teste falhar por comportamento do plugin, não mudar a asserção: parar e relatar à orquestradora com a saída.

Pronto quando:
- `npm run check` passa (validate --strict ×2, tsc como aviso, `plugin test` com fumaça + 2 testes);
- o tempo de cada teste fica bem abaixo de 5 s.

Relatar:
- hash do commit;
- a saída resumida do check;
- se algum stub do host foi necessário, e qual;
- como o pai aberto aparece no terminal (`◉` ou outro);
- se salvar em `tests/` recarregou o mod.

O usuário valida:
1. Ler `task-tree/tests/arvore.test.ts` e conferir que se lê como regra: "pai fecha sozinho quando todos os filhos fecham"; "start reabre os pais… recusa tarefa concluída com subtarefas".
2. Ver a mensagem de erro com o painel em texto. A Implementação troca **temporariamente**, numa cópia, uma asserção (por exemplo, esperar "Pedido" pendente no fim do teste 1), roda `claude plugin test task-tree`, cola a saída no relato (mostrando o painel em texto, linha a linha, com os glifos) e desfaz a troca, que **não** entra no commit.
3. O painel do app continua igual: nada no código do mod mudou.

Commit: `test(task-tree): kit de cenário e testes da árvore (pai fecha com os filhos; start reabre pais)`, com `git commit -- <os 4 caminhos>`.
