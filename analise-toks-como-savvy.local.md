# toks/s medido como o session-band ("Savvy")

Análise de 2026-11-10, só leitura, sobre `origin/main` (1dd0878, v0.12.0; lido com `git show`, sem trocar
de branch) e o session-band 0.2.0 (`~\.claude\plugins\cache\claude-kit\session-band\0.2.0\hooks\register.tsx`).
Decisão do usuário: "Medir como o Savvy".

## Resposta curta

Dá para medir igual: o hook `turn.step` do task-tree já é um `async function*` (`hooks/turn.ts`), e em vez
de `const r = yield* next(e)` ele passa a iterar `for await (const chunk of next(e))`, marcando o relógio no
primeiro chunk e lendo `chunk.usage.output_tokens` no chunk `kind: 'stop'` (tipo `TurnStepStopChunk` do kit).
É o que o session-band faz. Nenhum cenário do catálogo descreve o cálculo atual; só a exibição ("n toks/s"
no cabeçalho, no cartão da filha e no do subagente). O kit de testes não aciona `turn.step` hoje; o harness
expõe `$.turn.step(input)` como stream, então dá para simular chunks com o relógio parado avançando entre eles
(a confirmar na implementação).

**Recomendações:** (1) relógio do primeiro chunk ao `stop`; (2) escopo = **último step válido** do turno,
como o Savvy, sem janela de 10 s nem média; (3) filtros iguais (20 tokens, 0,5 s, 1000 tok/s); (4) os três
lugares (cabeçalho, cartão da filha, cartão do subagente) no mesmo cálculo; (5) fim do turno: o último número
fica, esmaecido, como hoje, sem recalcular. Sete perguntas no fim, com recomendação.

## 1. Como medir só do primeiro chunk ao `stop`

### Hoje (`hooks/turn.ts:34-84`)

```ts
const t0 = await stamp($)
const r = yield* next(e)
// ...
const tokens = r?.usage?.output_tokens
const t1 = await stamp($)
samples = [...samples, { at: t1, tokens, ms: t1 - t0 }].slice(-20)
const toks = rateOf(samples, t1)   // Σtokens/Σms dos últimos 10 s, ou das 3 últimas
```

`t0` é antes do envio: inclui o tempo de ida da requisição, a leitura do prompt e o TTFT. Por isso o número
sai menor que o do Savvy (72 contra 96 no mesmo instante).

### Proposta

```ts
export async function* turnStep($, e, next) {
  // ... engine como hoje
  let first: number | undefined
  let stop: { tokens: number; at: number } | undefined
  const stream = next(e)
  for await (const chunk of stream) {
    if (first === undefined) first = await stamp($)
    if (chunk.kind === 'stop' && chunk.usage) stop = { tokens: chunk.usage.output_tokens, at: (await stamp($)) ?? 0 }
    yield chunk
  }
  const r = await stream.result   // ou guardar o retorno do generator; ver nota abaixo
  const ms = first !== undefined && stop ? stop.at - first : 0
  const sample = stop && ms > 0 ? speedOf(stop.tokens, ms) : undefined   // filtros em speedOf
  // main: grava rateState { toks, at, live: true } se sample válido e diferente
  // subagente: subStep($, agentId, e, r, sample)
  return r
}
```

Notas de implementação:
- `yield*` devolve o resultado do `next`; com `for await` o resultado vem por `stream.result` (`HookStream`
  tem `readonly result: Promise<R>`, d.ts 5495) ou por iteração manual com `it.next()` lendo `done`/`value`.
  O session-band ignora o resultado (não precisa dele); o task-tree precisa de `r` para o `subStep`
  (modelo/esforço) e para devolver ao engine.
- `stamp($)` é o relógio do mod (parado nos testes); o session-band usa `$.clock.now()`. Mesmo relógio.
- Chunks que chegam bufferizados encurtam o tempo (ponto fraco já conhecido do Savvy). O filtro de
  1000 tok/s descarta o caso extremo; sem o filtro, um step de 2 chunks daria um número absurdo.
- `rateOf` e `RATE_WINDOW` deixam de ser usados (ou ficam só para a média do fim do turno, se a pergunta 5
  mantiver a média).

### O que muda em cada arquivo

| Arquivo | Mudança |
|---|---|
| `hooks/turn.ts` | `turnStep` itera os chunks; `speedOf(tokens, ms)` com os filtros; `samples`/`rateOf`/`RATE_WINDOW` saem (ou viram média só do fim do turno); o fim do turno (`turnComplete`, linhas ~119-125) deixa de calcular média e só marca `live: false` |
| `hooks/agents.ts` | `subStep` recebe a amostra pronta (`toks` ou `undefined`) em vez de `t0`; sai o `samples` por agente e a média das 10 últimas; mantém o `THROTTLE` da escrita |
| O que a filha publica | Nada muda de forma: `rate: { toks, at, live }` (`panel.ts:503-509`, `io/publish.ts:34-47`, `io/host.ts:86,157`). Só o valor passa a ser o último step válido. A mãe e o cartão da filha não mudam |
| `draw/svg.ts`, `hooks/render.tsx` | Nada: `rateText`, posição e opacidade `live` seguem iguais |

## 2. Escopo do número

| Opção | Comportamento | Prós | Contras |
|---|---|---|---|
| **A (recomendada): último step válido** | Como o Savvy: o número é a velocidade da última resposta do modelo que passou nos filtros; steps inválidos não mudam o número | Igual ao Savvy (é o pedido: "Medir como o Savvy"); simples; sem estado além do número | Pula a cada step; steps curtos (chamada de ferramenta com 30 tokens) são válidos e podem oscilar |
| B: janela de 10 s com tempo de geração | Σtokens/Σms de geração dos steps dos últimos 10 s | Suaviza | Não é "como o Savvy": com o mesmo instante, os dois mostrariam números diferentes de novo, e o usuário compararia |
| C: média do turno | Σ/Σ de todos os steps do turno | Estável | Idem; e fica atrás do ritmo real |

Recomendo A. Se o usuário quiser suavizar depois, a B com tempo de geração é a evolução natural, mas aí
deixa de bater com o Savvy.

## 3. Filtros

Adotar os três iguais: `tokens >= 20`, `ms >= 500`, `toks <= 1000`. Motivos: steps de poucos tokens (uma
chamada de ferramenta) e muito curtos dão números sem sentido; o teto corta o efeito de chunks
bufferizados. Como constantes nomeadas em `turn.ts` (`MIN_TOKENS`, `MIN_MS`, `MAX_TOKS`), citadas no cenário.
Para o subagente, os mesmos filtros (ele faz muitos steps curtos de ferramenta; sem filtro o cartão oscila).
`Math.round` já é o que `rateText` faz.

## 4. Cabeçalho, cartão da filha, cartão de subagente

Todos no mesmo cálculo, pelo mesmo `speedOf`:
- **Cabeçalho**: lê `rateState` (`render.tsx:241-243`); muda só o valor gravado.
- **Cartão da filha**: a filha grava o `rateState` dela e publica; a mãe lê `rates[sessionId]`. Muda só o
  valor. Filhas com o mod antigo publicam o número antigo até recarregar: o mod recarrega em todas as
  sessões ao salvar, então na prática todas mudam juntas.
- **Cartão de subagente**: `subStep` passa a receber a amostra do step do subagente (o hook `turn.step` dispara
  com `e.agentId`; a iteração dos chunks é a mesma). Hoje é média das 10 últimas; passa a último step válido,
  com `THROTTLE` na escrita como hoje.

Um só lugar de cálculo (`speedOf` em `turn.ts`, importado por `agents.ts`) garante que os três batem.

## 5. Fim do turno

Hoje (`turn.ts` em `turnComplete`): média das amostras do turno, `live: false`, esmaecido ("(último turno)" no
alt). Com A não há amostras para a média. Opções:
- **Recomendada**: o último número válido fica, `live: false` (esmaecido), até o próximo step válido. O Savvy
  também não zera entre turnos; a diferença é só o esmaecido, que o usuário já escolheu ("a escolha dele para
  uma sessão parada") e que não contradiz "medir como o Savvy" (é exibição, não medida).
- Alternativa: manter a lista de amostras (já com tempo de geração) só para a média do fim do turno. Mais
  código para um número que o usuário vê esmaecido; não recomendo.

Um turno sem nenhum step válido (só chamadas curtas): o número anterior fica (não zera), esmaecido no fim.

## 6. Catálogo e testes

### O que existe

Nenhum cenário descreve **o cálculo**. Os que citam toks/s descrevem a exibição e são testados com valores
injetados (`rate: { toks: 42, live: true }` no host simulado):
- `sessoes.toks-e-repo-branch-no-cartao` (coberto; `tests/sessoes.test.ts:110`): "n toks/s" no cartão.
- `visual.cabecalho-em-cartao`, `visual.cartao-posicao-de-toks-e-repo` (checklist): posição.
- Golden `visual.desenho-cartao-filha` (`tests/golden.test.ts:63`): cartão com 42 toks/s injetado.
- Subagente: `subagentes.cartao-mostra-modelo-e-estado` fala de modelo e esforço; não cita toks.

A origem do número ("a contagem de tokens por segundo de cada sessão, usando o padrão 'n toks/s'") está só
no comentário de `turn.ts`. **Nenhum teste quebra com a mudança do cálculo**, e nenhuma decisão registrada
é contrariada; a decisão nova vira cenário próprio.

### Cenários a criar (`regras/cabecalho.md`, ou um `regras/taxa.md` novo com `Código da área: hooks/turn.ts`)

1. `taxa.velocidade-de-geracao`: Dado um step do modelo; Quando o stream chega, do primeiro chunk ao `stop`
   com `usage.output_tokens`; Então toks/s = tokens / tempo entre o primeiro chunk e o `stop`, arredondado;
   o tempo antes do primeiro chunk (envio, leitura do prompt, primeiro token) não entra. Origem: 2026-11-10,
   "Medir como o Savvy".
2. `taxa.ultimo-step-valido`: Dado vários steps no turno; Quando o painel é desenhado; Então o número é o do
   último step que passou nos filtros; um step que não passa não muda o número.
3. `taxa.filtros`: Dado um step com menos de 20 tokens, ou menos de 0,5 s, ou mais de 1000 toks/s; Quando
   termina; Então o número não muda.
4. `taxa.fim-do-turno-esmaece`: Dado um número do turno; Quando o turno termina; Então ele fica, esmaecido,
   até o próximo step válido (reescreve o comportamento de média; sem cenário antigo a reescrever, só o
   comentário de `turn.ts`).
5. `taxa.subagente-mesma-medida`: Dado um subagente com steps; Quando termina um step válido; Então o cartão
   mostra a velocidade de geração dele pela mesma regra (último válido, mesmos filtros).
6. `taxa.filha-publica-a-sua`: a filha publica o número dela e o cartão na mãe o mostra (hoje coberto
   indiretamente por `sessoes.toks-e-repo-branch-no-cartao`; pode ficar como ligação, sem cenário novo).

### Como testar no harness

O kit não tem hoje um roteiro para `turn.step`. O harness expõe `$.turn.step(input)` devolvendo um
`HookStream` (d.ts 5068), e um stub `on('turn.step', async function* () { ... })` registrado antes do
primeiro `$` pode emitir os chunks. Roteiro proposto em `tests/kit/cenario.ts`:

```ts
// Um step do modelo: `antes` ms até o primeiro chunk, `geracao` ms até o stop, `tokens` no usage.
export async function passoDoModelo($, relogio, { antes = 800, geracao = 2000, tokens = 200, agente } = {}) {
  stubDoStep = async function* () {        // o stub registrado uma vez em ambiente.ts lê esta variável
    await relogio.advance(antes)
    yield { kind: 'text', index: 0, text: 'a' }
    await relogio.advance(geracao)
    yield { kind: 'stop', stopReason: 'end_turn', usage: { output_tokens: tokens, input_tokens: 0 } }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { output_tokens: tokens } }
  }
  const s = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', ...(agente ? { agentId: agente } : {}) })
  for await (const _ of s) {}
  return s.result
}
```

Testes: (a) `antes=800, geracao=2000, tokens=200` → cabeçalho "100 toks/s" (hoje daria 71); (b) step com 10
tokens depois não muda; (c) `geracao=100` não muda; (d) `fimDoTurno` → alt "(último turno)" com o mesmo
número; (e) o mesmo com `agentId` → o cartão do subagente mostra "100 toks/s" (respeitando o `THROTTLE`:
avançar o relógio). O relógio parado é o que torna o teste determinístico; a leitura é pelo texto do
cabeçalho/cartão, como os outros.

**Não verificado:** se o harness aceita `$.turn.step` sem `turn.start` antes e se o stub do stream pode
avançar o relógio no meio (os dois são plausíveis pela API; a implementação confirma no primeiro teste). Se
não der, o cálculo puro (`speedOf`) fica numa função exportada e testada direto, e a parte do stream fica no
checklist do app (comparar com o Savvy no mesmo instante, como o workflow já fez).

Mudança no kit (`cenario.ts`, `ambiente.ts`) exige selo de kit (`npm run regras:selar`).

## Perguntas ao usuário

1. Escopo: último step válido, igual ao Savvy (recomendado), ou manter a janela de 10 s com o tempo de
   geração?
2. Filtros iguais aos do Savvy: 20 tokens, 0,5 s, 1000 toks/s (recomendado)?
3. Subagente e filha também no novo cálculo (recomendado: sim, um cálculo só)?
4. Fim do turno: o último número fica esmaecido (recomendado), ou some, ou fica aceso como no Savvy?
5. Turno sem step válido: o número anterior fica (recomendado) ou some?
6. Catálogo: cenários numa área nova `taxa` (recomendado: é um assunto próprio, com código em `turn.ts` e
   `agents.ts`) ou dentro de `cabecalho.md`?
7. Se o harness não aceitar o stream simulado: testar `speedOf` direto e deixar o stream no checklist
   (recomendado), ou gastar tempo em adaptar o kit?

## `npm run impacto -- hooks/turn.ts hooks/agents.ts hooks/panel.ts io/publish.ts io/host.ts draw/svg.ts`

```
Arquivos do mod tocados: hooks/turn.ts, hooks/agents.ts, hooks/panel.ts, io/publish.ts, io/host.ts, draw/svg.ts
Cenários afetados (118): 104 cobertos, 14 checklist (cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app, visual.*)
Checklist do app: os 14 acima
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
```

Na prática a mudança fica em `turn.ts` e `agents.ts` (os outros quatro só se o formato de `rate` mudar, e a
proposta não muda). Golden: não deve mudar, porque o valor do cartão da filha vem injetado (42) e o cabeçalho
do golden não tem taxa; se o desenho do cabeçalho mostrar taxa num cenário, o número só muda se o teste
passar a chamar `passoDoModelo`. Validação no app (checklist): task-tree e Savvy lado a lado no mesmo
instante, números iguais ou a 1 de diferença (arredondamento).
