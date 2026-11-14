# Resumo ↩ do done na recarga (análise)

Base: `test/regressivos-automacao-testes` em `ab04703`, lido por `git show`/`git archive` (a Governança está trocando de branch no clone). Reprodução numa cópia no scratchpad. Nada foi editado no repositório.

## Essencial

- **A recarga não perde o resumo.** Com estado semeado (módulo novo, state mantido) e o turno terminando com texto, o ↩ "Resumo X" aparece no painel e vai ao arquivo publicado (`brief`), igual sem recarga.
- **O motivo do checklist era outro:** o `fimDoTurno` do kit manda `answer: ''`. Em `turnComplete` (`hooks/turn.ts`), o turno só grava `reply` **e** `brief` quando há texto (`if (said !== '')`, com `said = recap ?? answer`). Sem resposta final e sem `wrap_up`, o `summary` do `done` é **descartado**: a linha ↩ não aparece e nada vai ao publicado.
- **Classificação:**
  - (a) para o cenário da recarga, é limite do helper do kit, não do plugin;
  - (b) **e há um bug pequeno e real:** um turno que termina sem texto final (o modelo para logo depois de uma ferramenta) perde o ↩ que o `done` pediu. Nenhuma decisão do usuário amarra o ↩ a haver resposta: as regras dizem que "a linha ↩ só existe com resumo" e que o `summary` "é a linha ↩".
- **Correção:**
  - `turn.ts`: gravar o `brief` mesmo sem `said`. Uma condição; o `reply` fica só quando há texto;
  - kit: `fimDoTurno($, resposta = '')`, sem mudar o padrão;
  - `durabilidade.resumo-do-done-na-recarga` passa de checklist a **coberto**, com um par de recarga;
  - regra nova `turnos.resumo-sem-resposta-final` (coberto).
- **O `wrap_up`:** o recap vai ao arquivo como `reply` e conta como "texto". Por isso o teste da Implementação com recap passava: o recap fazia o `brief` ser gravado junto.

## 1. Caminho do dado

1. `done` com `summary` (`hooks/tools.ts` `doneTool`): grava o resumo no state `brief` ("done's summary until the turn ends… in the state so a reload mid-turn keeps it", tabela de durabilidade). Sobrevive à recarga (`946f653` → state).
2. `wrap_up` com `recap` (`tool-call.ts` `wrapUpAsk`): grava o state `recap` (`22650c9`).
3. `turnComplete` (`hooks/turn.ts`, no loop principal e não abortado):
   ```ts
   const recap = await lastRecap($)
   const said = (recap ?? e.answer ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
   const given = await lastBrief($)
   const short = given !== undefined ? brief(given) : undefined
   …
   if (said !== '') { …turns: … { ...u, reply: said, ...(short !== undefined ? { brief: short } : {}) } }
   ```
   O `brief` só entra no turno **dentro** do `if (said !== '')`. Os states `brief` e `recap` são zerados antes, então, sem texto, o resumo some.
4. `publishPanel`: publica os grupos com os turnos (`reply`, `brief`), que a sessão mãe lê no cartão.
5. `draw/layout.ts`: a linha ↩ do pedido (`turnRows`) e a do cartão (`session()`, `replies` com `hasBrief`) só existem com `brief`; o tooltip mostra `u.reply ?? u.brief`.

## 2. Evidência (reprodução no scratchpad)

Plano A › {Um}, `start 1`, `done 1` com `summary 'Resumo X'`, e o fim do turno com `answer` diferente:

```
SEM RECARGA answer=""                publicado=[{}]
✓ Pedido um  1/1
└─ ✓ Plano A  1/1
   └─ ✓ Um                           ← sem ↩

SEM RECARGA answer="Resposta final"  publicado=[{"reply":"Resposta final","brief":"Resumo X"}]
✓ Pedido um  1/1
├─ ✓ Plano A  1/1
│  └─ ✓ Um
└─ ↩ Resumo X

RECARGA (state semeado, módulo novo) publicado=[{"reply":"Resposta final","brief":"Resumo X"}]
├─ ✓ Plano A  1/1
│  └─ ✓ Um
└─ ↩ Resumo X
```

Os 4 testes temporários passaram (são só leitura). A recarga mantém o resumo; a ausência de resposta final o perde.

## 3. Correção

**`task-tree/hooks/turn.ts`** (`turnComplete`):
```ts
// The turn's ↩ is the done's summary; it is kept even when the turn ended with no text of its own
// (the model stopped right after a tool), the answer in its tooltip only when there is one.
if (said !== '' || short !== undefined) {
  await change($, all => all.map(g => {
    …
    return last ? { ...g, turns: turns.map(u => (u.id === last.id
      ? { ...u, ...(said !== '' ? { reply: said } : {}), ...(short !== undefined ? { brief: short } : {}) }
      : u)) } : g
  }))
}
```
- Sem texto e sem summary: nada muda, como hoje.
- Com summary e sem texto: grava só o `brief`. O ↩ aparece, e o tooltip mostra o próprio resumo (`u.reply ?? u.brief`).

**Kit** (`tests/kit/cenario.ts`): `export const fimDoTurno = ($: any, resposta = '') => $.turn.complete({ …, answer: resposta, … })`. O padrão continua `''`, então nenhum teste existente muda. Selo do kit: `refatoracao`.

## 4. Testes e regras

- **`durabilidade.resumo-do-done-na-recarga`** (de `checklist` para **coberto**), par em `tests/durabilidade.test.ts`:
  - 1/2: `estado(on, RESUMO, 'captura')`; `pedido`, `plan(A)`, `start 1`, `done(['1'], 'Resumo X')`;
  - 2/2: `estado(on, RESUMO, 'semear')`, `host`, `fimDoTurno($, 'Resposta final')` → a linha "↩ Resumo X" no painel, e `brief: 'Resumo X'` no publicado (`h.proprio()`).
  - O motivo do checklist ("não chega ao arquivo publicado nem sem recarga") sai; a origem fica (`946f653`, `22650c9`).
- **Regra nova `turnos.resumo-sem-resposta-final`** (coberto), em `tests/turnos.test.ts`:
  - Dado um `done` com `summary`;
  - Quando o turno termina sem texto final e sem `wrap_up`;
  - Então a linha ↩ mostra o resumo, e ele vai ao arquivo publicado.
  - Origem: "a linha ↩ só existe com resumo" e o `summary` "é a linha ↩" (regras do painel, `text/rules.ts`; `3f06a32`, 2026-10-21); bug achado na análise de 2026-10-29.
  - Teste: `done(['1'], 'Resumo X')` e `fimDoTurno($)` (sem resposta) → "↩ Resumo X".
- **Não-regressão:** o teste "recarga a quente, 2/2: o fim do turno mostra o recap" segue igual (o recap vira `reply`). Nenhum teste existente muda; `testes:alterados` confirma.

## 5. Travas e riscos

- **Mod:** só `hooks/turn.ts`, uma condição. Escrever de uma vez; `npm run check` verde com a etapa `regressao` (os testes de `HEAD` contra o código novo não mudam de resultado).
- **Kit:** `cenario.ts` muda (parâmetro opcional), com selo `refatoracao` e o padrão igual.
- **Hook e golden:** o desenho dos 3 cenários de golden não tem ↩ sem resposta. Se algum cenário terminar o turno sem texto e com summary, o desenho muda e o golden acusa, com aprovação no app. Pelo que li, os cenários do golden não fazem isso; conferir no `npm run check`.
- **Branch:** a Governança está trocando de branch no clone. A Implementação deve trabalhar na branch certa, conforme a orquestradora (`test/regressivos-automacao-testes` ou a branch nova a partir de `origin/main`), e só depois que o clone estabilizar.

## 6. Brief para a Implementação

Commit local, na branch indicada pela orquestradora. Sem push.

1. `task-tree/hooks/turn.ts`: a condição e o objeto da seção 3, com o comentário.
2. `tests/kit/cenario.ts`: `fimDoTurno($, resposta = '')`; selar o kit `--tipo refatoracao --motivo "fimDoTurno com resposta opcional"`.
3. `tests/durabilidade.test.ts`: o par "recarga a quente: o resumo do done chega ao ↩ e ao publicado" (`// Regra: durabilidade.resumo-do-done-na-recarga`); selo `novo`.
4. `tests/turnos.test.ts`: "o ↩ aparece mesmo quando o turno termina sem texto final" (`// Regra: turnos.resumo-sem-resposta-final`); selo `novo`.
5. `regras/durabilidade.md`: o cenário → `coberto`, sem o motivo antigo. `regras/turnos.md`: o cenário novo.
6. `npm run check` verde; o relato com `npm run testes:alterados` (nenhum teste existente mudou).

Commit: `fix(task-tree): o resumo do done vira a linha ↩ mesmo quando o turno termina sem texto final`.

O usuário valida no app: um turno que termina logo depois de uma ferramenta, sem texto final, ainda mostra a linha ↩ com o resumo do `done`.
