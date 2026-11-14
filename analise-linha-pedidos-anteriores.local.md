# Linha sobre "+N pedidos anteriores" e cartões em tarefa trocada

Análise de 2026-11-09, só leitura, sobre o HEAD bb2392e (lido com `git show`; o `hooks/agents.ts` e o
`regras/subagentes.md` da árvore de trabalho, ainda sem commit). Clone intocado.
Pedido do usuário: "esta ficando bom, mas tem uma linha em cima do +1 pedido anterior, não quero ver essa
linha. ela deveria existir?"

## Resposta curta

1. **A linha é do mod, não do app.** `draw/svg.ts:578` desenha, em toda linha de tom `section`
   ("+N pedidos anteriores", "+N cartões antigos de sessões", "+N linhas anteriores"), um retângulo de
   1 px de altura, de `x=0` até a borda real do slot (`width: calc(100% - …)`), por cima dos quadros do
   cartão (os `cards` vêm antes no mesmo SVG). Por isso ela atravessa o painel inteiro e passa sobre as
   bordas do cartão da filha. A da raiz é a mesma peça, com a mesma linha de código: tirar uma tira a
   outra, a menos que se condicione pela profundidade. Nenhum cenário do catálogo a descreve: as regras
   de `cabecalho.md` sobre "+N pedidos anteriores" falam de contagem, clique e conteúdo; nenhuma fala
   do traço. O comentário "remova a barra horizontal de divisão" (`svg.ts:640`) é do cabeçalho em cartão
   e não tem relação. O golden não tem nenhuma linha de seção (0 `lnf` em `tests/golden/svg.ts`), então
   remover o traço não muda o golden.
2. **Cartões trocados: duas âncoras, duas causas.**
   - A carta foi para "…na orquestradora" porque o casamento pelo nome não pegou: a regra atual exige
     que o título contenha o nome inteiro ("analise plano") ou que o nome contenha o começo do título
     antes de ":" (o título não tem ":"). Sem casamento, valeu "pela ordem": a primeira iniciada do lote
     sem carta, que era "…na orquestradora".
   - O card do subagente foi para "…na análise" porque o lançamento (`agents.ts:44` e
     `tool-call.ts:39`) usa `current(tasks).anchor`, que é sempre a **última** iniciada, e não olha
     nem o lote "pela ordem" nem o que já tem carta ou cartão.
   As duas âncoras não conversam: a carta não sabe que o subagente já ocupou uma tarefa, e vice-versa.

**Proposta:** (a) remover o retângulo da seção (uma linha em `svg.ts`); (b) o lançamento de subagente
passa a usar `sendAnchor` com o mesmo `used` das cartas, e os lançamentos entram no `used` das cartas;
(c) o casamento pelo nome aceita uma palavra do nome (≥ 4 letras) como palavra do título, desde que
case com uma única candidata. Com (b) sozinha o caso do print já fica certo; (c) acerta também quando
a ordem de lançar e enviar não é a ordem dos starts.

## 1. A linha horizontal

### Onde está

`task-tree/draw/svg.ts`, `rowSvg`, linha 578:

```ts
(section ? `<rect class="lnf" x="0" y="0" height="1" style="width:calc(${slot(W)} - ${W - R}px)"/>` : '') +
```

`lnf` é `fill:#888780; fill-opacity:.45` (linha 77). `slot(W)` é `'100%'` (linha 118). O comentário logo
acima (linhas 562-563) diz que "a linha de uma seção vai até a borda do slot". Ela começa em `x=0`,
ignorando a profundidade (`r.depth`) e o quadro do cartão, e é desenhada depois de `cards.map(c => c.svg)`,
logo por cima da borda esquerda e direita do cartão.

A linha dentro do cartão da filha vem de `layout.ts:1333-1341`: o mesmo trecho que cria a seção da raiz
roda também para cada grupo (`scope`), com `depth: top` (a profundidade de dentro do cartão). Então a
seção "+1 pedidos anteriores" da filha é uma linha comum do SVG, com o quadro do cartão em volta e o
traço de seção atravessando tudo.

A `render.tsx` não desenha nada além dos Svgs; não é o app.

### Está no catálogo?

Não. Procurei em `regras/*.md` por "seção", "linha horizontal", "atravessa", "lnf": nenhum cenário
descreve o traço. Os cenários de `cabecalho.md` que citam "+N pedidos anteriores" (contagem, clique,
cartões que voltam) continuam válidos sem o traço. Como é desenho, o harness não o vê: só o checklist
do app e o golden, que não tem seção.

### Opções

- **A (recomendada): tirar o traço de todas as seções.** Apagar a linha 578 e os dois comentários. A
  seção fica como as outras linhas: ícone ▸/▾ e o título em tom apagado. Sai junto a da raiz, a de
  "+N cartões antigos de sessões" e a de "+N linhas anteriores" (o corte de 400 linhas). O usuário
  perguntou "ela deveria existir?": é a resposta mais simples a "não quero ver essa linha".
- **B: tirar só dentro do cartão.** `section && r.depth === 0` (ou `cards.length === 0`). Mantém a
  da raiz. Só vale se o usuário quiser a da raiz, que também aparece no print dele e que ele não
  mencionou como boa.
- **C: encurtar.** Começar o traço no `x` do ícone e, dentro do cartão, parar em `CARD_RIGHT`. Mantém a
  ideia de divisória sem passar sobre as bordas. Mais código (precisa do quadro do cartão na `rowSvg`)
  para um traço que o usuário não quer ver.

### Catálogo (opção A)

Cenário novo em `regras/visual.md`, estado `checklist` (não há como testar pintura):

```
### visual.secao-sem-traco
A linha "+N pedidos anteriores" (e as outras seções) não tem traço horizontal.

- Dado uma seção no painel ("+N pedidos anteriores", na raiz ou dentro de um cartão; "+N cartões antigos")
- Quando o painel é desenhado
- Então não há linha horizontal atravessando o painel nem as bordas do cartão; a seção é só o ▸/▾ e o texto apagado

Origem: decisão do usuário, 2026-11-09 ("tem uma linha em cima do +1 pedido anterior, não quero ver essa linha").
Código: draw/svg.ts
Estado: checklist
```

Golden: não muda (nenhum cenário do golden tem seção). Se o usuário escolher B, o cenário diz "dentro
de um cartão" e a raiz fica como está.

## 2. Cartões em tarefa trocada

### O que aconteceu, na ordem

1. `start` nas duas: "Subagente da hora na orquestradora (3ª vez)" (primeira) e "Subagente da hora na
   análise (3ª vez)" (segunda), no mesmo lote.
2. `Agent` lançado da orquestradora. `agentSpawn` (`hooks/agents.ts:44`) e `launch`
   (`hooks/tool-call.ts:39`) pegam `current(tasks).anchor`. `current` (`layout.ts:623`) percorre as
   iniciadas em ordem de `started` e deixa em `anchor` a última: "…na análise". **Errado:** o
   subagente era da orquestradora.
3. `SendMessage` para `analise-plano`. `sentMessage` (`tool-call.ts:117-118`) monta `names =
   ["analise-plano"]` e chama `sendAnchor`. Ramo de várias em andamento:
   - `byName`: `namedFor("Subagente da hora na análise (3ª vez)", ["analise-plano"])`. `plain` do
     título = "subagente da hora na analise (3a vez)"; `plain` do nome = "analise plano". O título não
     contém "analise plano"; o título não tem ":", então `head` é o título inteiro e o nome não o
     contém. **Sem casamento.** O mesmo para a outra tarefa.
   - `free`: as duas, porque `used` não sabe do subagente (só cartas, rodadas e sessões abertas).
   - `batch[0]`: a primeira iniciada, "…na orquestradora". **Errado:** a carta era da análise.

Resultado: carta e cartão "analise-plano" sob "…na orquestradora"; card do subagente sob "…na análise".
Exatamente o que o print mostra.

### Causas

- **Âncora do subagente** (`agents.ts:44`, `tool-call.ts:39`): usa `current`, que é "a última
  iniciada". A regra `subagentes.cartao-desde-o-lancamento` diz só "Dado uma tarefa em andamento …
  embaixo dessa tarefa": não previu várias em andamento. Lacuna de regra nova (2026-11-09), não
  contradiz decisão.
- **Casamento pelo nome** (`panel.ts`, `namedFor`): decisão de hoje ("Pelo nome") implementada com
  dois critérios estreitos. "analise-plano" contra "…na análise" precisa de casamento por palavra.
- **`used` sem lançamentos**: a carta não considera que um subagente já ocupou uma tarefa, e o
  lançamento não considera as cartas. Mesmo que (c) falhe, (b) resolve o caso quando a ordem de
  lançar e enviar segue a ordem dos starts, que é o uso normal ("pela ordem").

### Proposta

**(b) Lançamento usa `sendAnchor`, e os lançamentos entram no `used`.**

Em `agents.ts:44` e `tool-call.ts:39`, trocar `current(...)` por:

```ts
const tasks = (value as Group[]).find(g => g.agent === parent)?.tasks ?? []
const anchor = sendAnchor(tasks, usedAnchors(kids, sends, groups), askingAnchors(waits), [description, subagentType])
```

e `usedAnchors` ganha um terceiro insumo: os grupos de subagente com âncora (`g.sub && g.anchor`,
`at: g.sub.at`). Para o loop principal, `parent === MAIN`; para uma filha, os `tasks` do grupo dela e
um `used` só dos subagentes daquela filha (as cartas são do MAIN).

Efeitos:
- Com uma em andamento, nada muda (`sendAnchor` devolve ela).
- Com várias, o subagente vai à primeira do lote ainda sem carta nem cartão; a carta seguinte vai à
  próxima. No caso do print: subagente → "…na orquestradora", carta → "…na análise". Certo.
- Sem nada em andamento, o subagente vai à pendente do pedido atual (hoje `current` devolve `undefined`
  e o cartão fica solto). Melhora, mas é mudança de comportamento: cabe à pergunta 2.
- O nome do subagente para `byName`: `description` e `subagentType`. Raro casar, inofensivo.

**(c) Casamento por palavra.** Em `namedFor`, somar um terceiro critério: alguma palavra do nome, com
4 letras ou mais, igual a uma palavra do título (comparação após `plain`, por palavra inteira):

```ts
const words = (s: string) => plain(s).split(' ').filter(w => w.length >= 4)
// ...
return name.length >= 3 && (t.includes(name) || (head.length >= 4 && name.includes(head)) ||
  words(n).some(w => words(title).includes(w)))
```

"analise-plano" → ["analise", "plano"]; o título "…na analise (3a vez)" tem "analise": casa. O outro
título ("…na orquestradora…") não: casamento único, `byName` devolve a certa. Continua valendo só com
casamento **único** (`hit.length === 1`), então palavras comuns ("plano", "hora") não desviam quando
as duas tarefas as têm: cai na ordem. Risco: títulos de tarefas que repetem palavras de nomes de
sessões sem ser a tarefa delas; o requisito de unicidade entre as candidatas limita isso.

**Por que as duas.** (b) sozinha acerta o print. (c) sozinha também acerta o print (a carta iria por
nome a "…na análise", e o subagente continuaria em "…na análise" pela `current` — não, erraria o
subagente). Então (b) é obrigatória para o subagente; (c) protege a carta quando o modelo envia fora
da ordem dos starts.

### Catálogo

Reescrever `subagentes.cartao-desde-o-lancamento` (`regras/subagentes.md`), acrescentando ao Então:
"com várias em andamento, embaixo da primeira do lote ainda sem carta nem cartão, na ordem dos starts,
como a carta (envios.ancora-no-lote-recente); um lançamento conta como uso da tarefa para a carta
seguinte". `Reescrito: 2026-11-09`, com as palavras do usuário sobre este print.

Reescrever `envios.carta-pelo-nome-da-sessao` (`regras/envios.md`): no Quando, somar "ou uma palavra do
nome com 4 letras ou mais é palavra do título"; no Então, "um subagente lançado da tarefa conta como
carta". `Reescrito: 2026-11-09`.

Testes novos (`tests/subagentes.test.ts` e `tests/envios.test.ts`, selados `--tipo novo`):
- duas em andamento, `Agent` lançado e depois `SendMessage` para "analise-plano": card do subagente
  sob a primeira, carta sob a segunda;
- duas em andamento, `SendMessage` para "analise-plano" com título "… na análise …": carta sob ela,
  mesmo sendo a segunda iniciada (casamento por palavra);
- duas em andamento, nomes que casam com as duas ("hora"): vale a ordem;
- lançamento sem nada em andamento: o cartão vai à pendente do pedido atual (se a pergunta 2 for sim).

Os dois testes atuais de `envios.carta-pelo-nome-da-sessao` (envios.test.ts:346 e 363) continuam
passando: o critério novo só soma.

### Não reproduzi no harness

Diferente das análises anteriores, não montei a cópia: o `agents.ts` ainda está sem commit na árvore de
trabalho da implementação e muda a cada save. A leitura do código basta para a sequência acima; a
implementação confirma com o primeiro teste novo.

## Perguntas ao usuário

1. Linha de seção: tirar de todas (opção A, recomendada), ou só de dentro do cartão (B)?
2. Subagente lançado sem nenhuma tarefa em andamento: o cartão vai à pendente do pedido atual, como a
   carta (hoje fica solto)? Recomendo que sim, é a mesma regra.
3. Casamento por palavra (c), somado ao casamento atual? Recomendo que sim.

## `npm run impacto -- draw/svg.ts hooks/panel.ts hooks/tool-call.ts hooks/agents.ts`

```
Arquivos do mod tocados: draw/svg.ts, hooks/panel.ts, hooks/tool-call.ts, hooks/agents.ts
Cenários afetados (94): 80 cobertos (envios, subagentes, sessoes, turnos, pedidos…), 1 pendente,
  13 checklist (cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app, visual.*)
Checklist do app: cabecalho.aviso-de-painel-grande-volta, subagentes.cartao-no-app, visual.largura-real,
  visual.cliques-no-icone-e-no-anel, visual.animacao-de-linha-nova, visual.cores-dos-temas,
  visual.cabecalho-em-cartao, visual.status-embaixo-da-caixa, visual.cartao-modelo-e-esforco,
  visual.cartao-posicao-de-toks-e-repo, visual.cartoes-ordem-e-espera, visual.recarga-real-e-respawn,
  visual.cabecalho-barra-e-chips-desenhados
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
```

O golden aparece por `svg.ts` estar no mapa, mas nenhum cenário do golden tem linha de seção, então o
desenho não deve mudar. A mudança de âncora não toca o desenho.

Validação no app (checklist): o print do usuário de novo, com duas tarefas iniciadas juntas, um
subagente e uma carta: sem traço na seção, subagente sob a primeira, carta sob "…na análise".
