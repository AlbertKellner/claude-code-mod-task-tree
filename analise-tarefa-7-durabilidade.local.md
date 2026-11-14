# Tarefa 7: durabilidade (análise, sem implementar)

Base: branch `test/regressivos-automacao-testes`, topo `490208b`. Nada foi editado.

## Essencial

- **O harness cobre mais do que parecia.** Cada teste é um módulo novo com o `$.state` vazio, e isso **é** um reinício do processo (respawn do worker, `/model`).
  - Com um **store compartilhado entre os testes do mesmo arquivo** (um objeto do arquivo, respondido por stubs `store.get/set/delete/keys`), o teste seguinte vê o store do anterior: reinício e retomada.
  - Com o `$.state` **semeado** pelo teste a partir do estado que o teste anterior gravou (stubs `state.get`/`state.set` por cima do kit), o teste seguinte é um **módulo novo com o state mantido**, sem `session.start`: a **recarga a quente**.
  - É a técnica da suíte antiga (`seedState`, removida em 2026-10-23), refeita no kit novo.
- **Testes** em pares "1/2, 2/2", num arquivo novo `tests/durabilidade.test.ts`, cobrindo:
  - reinício com `session.start`;
  - respawn sem `session.start` (o store volta no primeiro uso);
  - retomada (`resume`) e `/clear`;
  - recarga a quente: painel, resumo ↩ do `done` e recap do `wrap_up` sobrevivem;
  - ligações das filhas com a lista parcial do host;
  - os **8 formatos antigos** do arquivo publicado. Os arquivos-exemplo podem ser **recuperados do git** (`b9cd016~1:task-tree/tests/fixtures/publicados.ts`).
- **Origens resolvidas pelo git:**
  - tabela de durabilidade: `9fb1c51`;
  - grupos sem `session.start`: `59eb558`;
  - visão e trabalho sem `session.start`: `fba6171`;
  - ligações com lista parcial: `13ef0ef`;
  - contrato do publicado: `04fcae7`;
  - resumo e recap na recarga: `946f653`/`22650c9`;
  - `/clear`: `465b09e`.

  A durabilidade nasceu de bugs achados pelo teste visual dele, e não há citação literal dele sobre ela.
- **Checklist do app:**
  - a recarga real (salvar um arquivo do mod com o painel aberto e ver que nada some);
  - o respawn real do worker;
  - a retomada de uma sessão de verdade no app;
  - variáveis de módulo (relógios voltando a correr, cliques logo depois da recarga).
- **Sem dúvidas para o usuário.** Um risco técnico: os pares dependem de o kit rodar os testes de um arquivo em ordem e no mesmo processo, como a suíte antiga já fazia.

## 1. Como funciona (código)

**Três camadas** (`state/durability.ts`, tabela `TABLE`):
- `$.state`: sobrevive à recarga a quente, não ao processo;
- `$.store`: sobrevive a tudo, com a chave `<store>:<id da sessão>` (`session`, `view`, `work`, `links`, `sessions`);
- variáveis de módulo: morrem na recarga (`loaded`, `keptLinks`, `ownId`, relógios, `usedReceipts`…).

**Quando o store volta** (`restoredAt`):
- `start`: `session.start` (`session-start.ts`) faz `restore` se o state está vazio, mais `restoreView`, `restoreWork`, `restoreLinks`;
- `resume`: `classic.SessionStart` com `source: 'resume'` **substitui** o state pelo store da sessão `e.session_id`;
- `first-use`: depois de um processo novo sem `session.start` (respawn), a primeira escrita, desenho ou publicação traz os grupos, a visão e o trabalho (`ensureGroups`/`ensureView`/`ensureWork`). Sem isso, a primeira escrita gravaria por cima do store o painel reduzido (`59eb558`, `fba6171`);
- `first-save`: as ligações (`children`, `sends`, `received`, `launches`) voltam na primeira gravação delas. `keptLinks` guarda as das filhas que o host não listou (`13ef0ef`).
- Ainda: `classic.SessionStart` com `source: 'clear'` esvazia grupos, esperas, envios e trabalho.

**Do turno, só no state** (sobrevivem à recarga, não ao processo):
- `brief` (o `summary` do `done`, até o fim do turno; era variável de módulo e morria na recarga, `946f653` → state);
- `recap` (`22650c9`);
- `waits`, `turnEnded`, `turnAborted`, `collapsed`.

**Arquivo publicado** (`io/publish.ts`, `parsePublished`): `version` 1; os arquivos sem `version` são lidos como estão; outra versão é ignorada. Já existiram 8 formatos.

## 2. Regras (`regras/durabilidade.md`)

| id | Situação | Origem (resolvida) | Estado proposto |
|---|---|---|---|
| `durabilidade.reinicio-restaura-do-store` | reescrever: **com** `session.start` e **retomada** (`resume`) | regra do painel desde a entrada do mod (`465b09e`); tabela `9fb1c51`, 2026-10-22 | coberto |
| `durabilidade.formatos-antigos-do-publicado` | sim | contrato do publicado `04fcae7`, 2026-10-22; "Já existiram 8 formatos" (DESENVOLVIMENTO) | coberto |
| `durabilidade.recarga-mantem-painel-ligacoes-e-resumo` | reescrever o Estado: **coberto** pela simulação (state semeado), e a parte real vai à regra nova de checklist | `946f653`, `22650c9`, `13ef0ef`, 2026-10-21/22 (bugs achados no teste visual) | coberto |

Regras novas:
- **`durabilidade.respawn-sem-session-start`:**
  - Dado o painel no store e um processo novo que não rodou `session.start`;
  - Quando o painel é desenhado e o modelo chama `start`/`done`;
  - Então o painel aparece inteiro, a visão e o trabalho atual voltam, e o store não encolhe.
  - Origem: `59eb558` e `fba6171`, 2026-10-22.
  - Coberto.
- **`durabilidade.ligacoes-com-lista-parcial-do-host`:**
  - Dado filhas ligadas a tarefas e uma lista do host que deixa uma delas de fora;
  - Quando a lista volta a listá-la;
  - Então o cartão volta sob a mesma tarefa.
  - Origem: `13ef0ef`, 2026-10-22.
  - Coberto.
- **`durabilidade.clear-esvazia`:**
  - Dado um painel com tarefas, esperas e envios;
  - Quando a pessoa usa `/clear`;
  - Então o painel fica "Nenhuma tarefa planejada".
  - Origem: entrada do mod (`465b09e`).
  - Coberto.
- **`visual.recarga-real-e-respawn`** (checklist): salvar um arquivo do mod com o painel aberto, e um respawn do worker. Nada some, os relógios voltam a correr e os cliques funcionam logo depois.

## 3. Kit (selo do kit regravado, tipo `refatoracao`, motivo "durabilidade: store e state compartilhados")

`tests/kit/ambiente.ts`:
```ts
// Um store que passa de um teste ao outro do mesmo arquivo (o objeto é do arquivo): um teste
// grava, o seguinte (outro processo, outro módulo) lê. Chamar antes da primeira chamada a $.
export function armazem(on: any, dados: Record<string, unknown>): void
// store.get/set/delete/keys sobre `dados` (cópia JSON na escrita, como o store real).

// O $.state de um teste anterior: `captura` grava nele cada state.set; `semear` faz o state.get
// devolvê-lo enquanto a chave não foi escrita neste teste (módulo novo, state mantido: a recarga a
// quente). Chamar antes da primeira chamada a $.
export function estado(on: any, guardado: Record<string, unknown>, modo: 'captura' | 'semear'): void
```
A técnica é a da suíte antiga: `on('state.get', async (_$, e, next) => …next(e)…)` e `on('state.set', …)`, chamando `next` para o kit seguir guardando. **Conferir** que o kit aceita `next` nesses stubs; a suíte antiga, no mesmo binário de família, aceitava.

`tests/kit/cenario.ts`:
```ts
export const iniciarSessao = ($: any) => $.session.start({ cwd: '.' })                       // processo novo
export const retomar = ($: any, id: string) => $.classic.SessionStart({ source: 'resume', session_id: id })
export const limpar = ($: any) => $.classic.SessionStart({ source: 'clear' })
```

`tests/fixtures/publicados.ts`: **recuperar** de `b9cd016~1:task-tree/tests/fixtures/publicados.ts` (os 8 formatos reais, com os textos livres já trocados). O arquivo não é `.test.ts` e não precisa de selo de teste. Ele está em `tests/`, mas não em `tests/kit/`: conferir se o `selos.mjs` exige selo para ele. Se exigir, selar como kit.

`host` (da tarefa 5): aceitar `publicado?: string` por filha, o texto cru do arquivo, para os formatos antigos.

## 4. Testes (`tests/durabilidade.test.ts`)

No topo do arquivo: `const STORE: Record<string, unknown> = {}`, `const STATE: Record<string, unknown> = {}` e um id fixo de sessão, se o kit deixar escolher; senão, ler `$.session.id()` no teste 1/2 e guardar.

1. **Reinício com `session.start`** (`durabilidade.reinicio-restaura-do-store`):
   - **1/2:** `armazem(on, STORE)`; `pedido`, `plan(A)`, `start 1`, `done 1` com `summary`, `fimDoTurno`. Confere que o store tem o painel (alguma chave `session:`).
   - **2/2:** `armazem(on, STORE)`; `iniciarSessao` → o mesmo painel (títulos e estados: "Um" ✓, "Plano A" ◷), a linha ↩ com o resumo e o cabeçalho 1 de 3; `start 2.1` → acende sem apagar o resto.
2. **Respawn sem `session.start`** (`durabilidade.respawn-sem-session-start`):
   - 2/2, sem `iniciarSessao`: o `painel()` já mostra "Plano A";
   - a visão resumida volta (o par grava `visao('resumida')` na 1/2);
   - `start 2.1`/`done 2.1` → o store **segue com** "Um" ✓ (não encolhe).
3. **Retomada** (`durabilidade.reinicio-restaura-do-store`): 2/2 com o state semeado de **outro** painel (plano B) e `retomar($, id)` → o painel passa a ser o do store (plano A), sem o B.
4. **`/clear`** (`durabilidade.clear-esvazia`): `plan(A)`, `start 1`, `limpar` → o cabeçalho "Nenhuma tarefa planejada".
5. **Recarga a quente: o painel e o resumo do `done`** (`durabilidade.recarga-mantem-painel-ligacoes-e-resumo`):
   - 1/2: `estado(on, STATE, 'captura')`; `plan`, `start 1`, `done 1` com `summary 'Resumo X'` (sem fim do turno);
   - 2/2: `estado(on, STATE, 'semear')`, sem `session.start` nem store → o painel igual; `fimDoTurno` → a linha ↩ "Resumo X".
6. **Recarga a quente: o recap do `wrap_up`** (mesmo id): 1/2 com `ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'Recap Y' })`; 2/2 semeado + `fimDoTurno` → a resposta do turno guardada é "Recap Y". Ela é observável no ↩ se não há `summary`; senão, pelo cartão (conferir onde o recap aparece no terminal; se não aparecer, cobrir só o ↩ e deixar o recap no checklist).
7. **Recarga a quente: as ligações das filhas** (mesmo id): 1/2 com `host` (filha K1 aberta sob "Um") e `estado('captura')`; 2/2 semeado, com `host` → o cartão K1 segue sob "Um".
8. **Lista parcial do host** (`durabilidade.ligacoes-com-lista-parcial-do-host`): num teste só, com `armazem`:
   - filha K1 sob "Um" e K2 sob "Dois.um";
   - `h.filha(K2)` sai da lista (o host deixa de listar) e `aviso`;
   - K2 volta à lista e `aviso` → o cartão K2 de novo sob "Dois.um".
   - Se precisar de processo novo no meio, vira par.
9. **Os 8 formatos do arquivo publicado** (`durabilidade.formatos-antigos-do-publicado`): para cada fixture, uma filha com `publicado` = o texto → `aviso` → o cartão aparece, sem a linha de erro, e as tarefas do formato (quando há `tasks`/`groups`) aparecem sob ele. Num teste só, um laço; se passar de 5 s, `{ timeoutMs: 15000 }`.

As asserções usam títulos, estados, o ↩, o cabeçalho e a presença de cartões. No store só se confere a **presença do painel** (que alguma chave começa por `session:`), sem o formato interno.

## 5. Checklist do app

- Recarga real (salvar um arquivo do mod) com o painel aberto, cartões e resumo: nada some.
- Respawn real do worker (`/model` muda o modelo): o painel volta.
- Retomada de uma sessão real (`claude --resume`, ou retomar pelo app): o painel volta.
- Logo depois da recarga: os relógios voltam a correr e o primeiro clique funciona.

## 6. Riscos

- **Ordem e processo dos testes:** os pares exigem que o kit rode os testes de um arquivo em ordem e no mesmo processo (o objeto do arquivo vivo entre eles). A suíte antiga dependia disso. Se falhar, o 2/2 deve falhar com a mensagem "rode o par inteiro: o 1/2 não gravou", não passar vazio.
- **`next` nos stubs de `state`:** se o kit não aceitar, a recarga (testes 5–7) vai ao checklist com o motivo.
- **Id da sessão:** o store usa `$.session.id()`. Se o kit der ids diferentes por teste, o par precisa guardar o id do 1/2 e o 2/2 ler pelo mesmo. Conferir; se não der para fixar, usar `retomar($, idDo1)` no lugar de `iniciarSessao` no teste 1.
- **Selos:** testes novos (`--tipo novo`); kit `--tipo refatoracao`; fixture conforme o `selos.mjs`. Nenhum teste existente muda; `testes:alterados` deve dizer isso.
- **Recarga do clone:** nenhum arquivo do mod muda; só `tests/` e `regras/`.
- **Divergência:** se um par mostrar o painel perdido ou o store encolhido, é **bug do plugin** (os bugs de 2026-10-22 voltando). Marcar o cenário `pendente` com o motivo e relatar; não ajustar.

## 7. Brief para a Implementação

Na branch `test/regressivos-automacao-testes`, depois de `490208b`. Um commit local. Sem push.

1. `tests/kit/ambiente.ts`: `armazem(on, dados)` e `estado(on, guardado, modo)`; `host` aceita `publicado`.
2. `tests/kit/cenario.ts`: `iniciarSessao`, `retomar` e `limpar`.
3. `tests/fixtures/publicados.ts`: recuperado de `b9cd016~1` (sem mudar o conteúdo).
4. `tests/durabilidade.test.ts` (novo): os testes 1–9 da seção 4, em pares "1/2, 2/2" onde preciso, cada um com `// Regra:`.
5. `regras/durabilidade.md`:
   - reescrever `reinicio-restaura-do-store` (com `session.start` e retomada) e `recarga-mantem-…` (Estado `coberto`, simulação);
   - `formatos-antigos-do-publicado` → `coberto`;
   - novas: `respawn-sem-session-start`, `ligacoes-com-lista-parcial-do-host` e `clear-esvazia`, com as origens da seção 2.
6. `regras/visual.md`: `visual.recarga-real-e-respawn` (checklist).
7. Selar os testes novos e o kit; `npm run check` verde; o relato com `npm run testes:alterados` (nenhum teste existente mudou).

Commit: `test(task-tree): durabilidade (reinício, respawn, retomada, /clear, recarga a quente, lista parcial, formatos do publicado)`.

O usuário valida lendo `tests/durabilidade.test.ts` e `regras/durabilidade.md` e, no app, os itens da seção 5.
