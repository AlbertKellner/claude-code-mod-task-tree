# Título de tarefa sem subtarefas cortado cedo

Análise de 2026-11-09. Só leitura; clone intocado (HEAD 913aaf8).
Pedido do usuário: "Quando você lança tarefas, que não tenham parra de progreso nem quantidade de
subtarefas, o texto está cortando, deve estar considerando as colunas dessas campos. Não consigo ver o
texto completo. para esses casos, de tarefas sem sub tarefas, quero que o texto vá até alcança o tempo de
execução, somente ai, corte o texto com reticencias."

## Resposta curta

O usuário acertou a causa. Toda linha de tarefa, turno e cartão reserva as colunas da contagem, da barra e
do ramo, com ou sem subtarefas. A reserva é deliberada (decisão antiga, "vazia nas outras, para alinhar"),
então isto é mudança de regra, já decidida pelas palavras acima, e não bug.

**Proposta:** numa linha sem contagem e sem ramo de sessão, o título vai até o tempo. Uma linha em
`draw/svg.ts`. Os 3 golden mudam e pedem o aceite dele no app antes do commit.

## Onde está

`task-tree/draw/svg.ts`, função `rowSvg`, linhas 510 a 538:

- `tabular = r.bar === true || r.card === true` (linha 510). `bar: true` vem de `draw/layout.ts:1030`
  (toda tarefa) e `:1100` (todo pedido).
- Com `tabular`, a borda do título é sempre `edge = ix - RIGHT_GAP` (linha 534), onde `ix` fica à esquerda
  de tempo, contagem, barra e ramo. A contagem e a barra só são desenhadas com `r.sub`; o ramo só com
  `r.kids`. Sem eles, o espaço fica vazio.
- O corte é `fit(whole, size, edge - 10 - tx)` (linha 561), e o `clipPath` `tc` (linha 569) usa a mesma borda.

Largura perdida numa folha: contagem ("00/00"), 8 px, barra de 36 px, 12 px do ramo e 12 px de folga,
por volta de 100 px, mais a diferença entre "0:00:00" e o tempo real da linha.

`hooks/render.tsx` e `draw/geometry.ts` não mudam: a camada do tooltip sobre o nome cortado vai até a
borda da linha ou até o anel, e não depende dessas colunas.

## Proposta

Na linha 534, trocar a borda por:

```ts
edge = r.sub || forked ? ix - RIGHT_GAP : t ? R - textW(t, 12) - RIGHT_GAP : R
```

| Linha | Título vai até |
|---|---|
| Com contagem e barra | Como hoje |
| Com ramo de sessão, sem contagem | Como hoje (o ramo fica na coluna dele) |
| Sem contagem e sem ramo, com tempo | O tempo desenhado, menos a folga |
| Sem contagem, sem ramo e sem tempo (pendente ○) | A borda direita da linha |

O `clipPath` segue a mesma borda, sem mudança própria. O tooltip do nome cortado continua valendo.

### Testado numa cópia

Cópia do HEAD em
`<scratchpad>\titulo\task-tree`,
com essa única linha trocada: 129 passam, 3 falham. As 3 são `golden: principal`, `golden: filha` e
`golden: envios`. Nenhum teste de comportamento quebra.

## Efeitos colaterais para o usuário decidir

1. **Palavra "interrompida".** A linha interrompida nunca tem contagem, nem a que tem filhas
   (`layout.ts:1029`). Com a proposta, a palavra encosta no tempo, em vez de ficar na coluna antiga, e o
   título ganha o espaço. Recomendo aceitar: vale igual para todas as interrompidas. A alternativa é
   manter a palavra na coluna antiga e só o título avançar até ela.
2. **Coluna do corte.** A borda usa a largura do tempo desenhado ("0:05" dá mais espaço que "1:02:03"),
   então títulos longos vizinhos podem cortar em colunas um pouco diferentes. Recomendo assim, pelo "até
   alcança o tempo de execução". A alternativa é a coluna fixa de `TIME_W`, que alinha os cortes e perde
   alguns px.
3. **Linha com ramo de sessão e sem contagem** fica como hoje. É rara.

## Catálogo

Cenário novo em `regras/visual.md`:

- Id: `visual.titulo-sem-contagem-vai-ate-o-tempo`
- Título: O título de uma linha sem barra nem contagem vai até o tempo.
- Dado uma tarefa sem subtarefas e sem sessão abaixo, com título mais largo que a linha
- Quando o painel é desenhado no app desktop
- Então o título só é cortado com "…" ao chegar no tempo da linha (ou na borda, sem tempo); a linha com
  barra e contagem segue cortando antes da barra
- Origem: decisão do usuário, 2026-11-09, com as palavras do pedido acima
- Código: draw/svg.ts
- Estado: `pendente (tests/visual.test.ts)`, e `coberto` no commit da implementação

Desfaz, só para a linha sem contagem e sem ramo, o trecho de DESENVOLVIMENTO.md ("vazia nas outras, para
alinhar", perto da linha 1306), que precisa ser reescrito junto. Não há cenário no catálogo com essa
decisão antiga; os três `visual.desenho-*` do golden é que a travam.

## Testes

- **Novo, em `tests/visual.test.ts`**, com `svgs($)` do kit, a 60 colunas: um pai com duas filhas de
  título longo e igual ao do pai. O texto desenhado da filha é mais longo que o do pai, os dois terminam
  em "…", e uma filha de título curto aparece inteira. Selar com `--tipo novo`.
- **Golden:** os 3 mudam, mesmo com títulos curtos, porque a largura do `clipPath` de cada linha sem
  contagem muda. O check bloqueia o commit até o "funcionou" do usuário no app; depois,
  `npm run golden:aprovar -- --todos --motivo "\"<palavras dele>\", AAAA-MM-DD"`.
- **Checklist do app:** largura real e recorte na borda nos dois temas, e o tooltip do nome cortado.

## `npm run impacto -- draw/svg.ts`

O arquivo é o código da área Visual e de cenários de cabeçalho, envios e sessões. Do que interessa:

```
visual.largura-real                  checklist
visual.tooltip                       checklist
visual.golden-gera-desenho           coberto   task-tree/tests/golden.test.ts: 3 testes
visual.desenho-principal             coberto   task-tree/tests/golden.test.ts: 1 teste
visual.desenho-cartao-filha          coberto   task-tree/tests/golden.test.ts: 1 teste
visual.desenho-envios                coberto   task-tree/tests/golden.test.ts: 1 teste
visual.faixa-de-estado-geral         coberto   task-tree/tests/visual.test.ts: 2 testes
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios
Fora do mapa: nenhum
```

Os demais cenários listados (cabeçalho, envios, sessões) passaram na cópia com a mudança.

## Não verificado

- O desenho no app: só o harness rodou. A folga real entre o "…" e o tempo fica para a validação visual.
- O terminal não foi olhado: o pedido e o print são do app desktop.

---

# Acréscimo (2026-11-09): tooltip do texto cortado, depois de 1 s parado

Pedido do usuário: "Quero tambem, que, quando um texto for cortado com reticencias, porque não coube,
mostre um tooltip com o texto completo quando eu parar o mouse em cima do texto por um segundo, e quando
somente passar o mouse, não mostre esse tooltip".

## Resposta curta

O tooltip do texto cortado já existe e é o nativo do navegador (`<title>` do SVG). Ele já espera o mouse
parar e não aparece na passagem. **O atraso é do app, não do mod: não dá para fixar 1 s.** Faltam três
coisas para atender "todo texto cortado, só quando cortado", todas em `draw/svg.ts` e `hooks/render.tsx`.

## O que existe hoje

- `tip(whole, shown)` (`draw/svg.ts:145`) põe um `<title>` com o texto inteiro só quando o texto foi cortado.
- A linha é uma imagem, e imagem não mostra tooltip. Por isso `hoverLayer` (`svg.ts:151`) desenha por cima
  uma camada transparente, um `Svg` com `isInteractive`, só com o `<title>` (`hooks/render.tsx:81` e `:94`).
- Texto que cabe não tem `<title>`, logo não tem camada nem tooltip.

Têm tooltip quando cortados: o título de tarefa, pedido e turno (`svg.ts:576`), o nome do cartão de sessão
(`:420`) e o título do cabeçalho (`:650`). A linha ↩ entra pelo mesmo caminho, com a resposta inteira.

## O que o kit permite

| Recurso do kit | Atraso | Serve? |
|---|---|---|
| `<title>` num `Svg` interativo | O do navegador do app, fora do alcance do mod | Sim, é o de hoje |
| CSS `:hover` dentro do `Svg` interativo | Controlável (`transition-delay: 1s`) | Só dentro da moldura da própria linha |
| `hover` de `Box` (revelar um `Box` escondido) | Nenhum, é imediato, e o tipo não tem campo de atraso | Não: aparece na passagem |
| `Button` | Sem tooltip | Não |

Fonte: tipos gerados do kit, `task-tree/.claude-plugin/types/claude-code/index.d.ts` (`BoxHoverProps`, perto
da linha 881; `isInteractive`, perto da 13306: "hover, CSS `:hover`, SMIL animation and `<title>` tooltips
work", sem script).

**1 s exato** só com um tooltip desenhado pelo mod em CSS, dentro do `Svg` interativo. Ele não sai da
moldura, que tem a altura da linha (28 px) e a largura do nome. O texto inteiro teria de caber em cima da
própria linha, em letra menor, e um texto longo seria cortado de novo. Não recomendo.

## Lacunas contra o pedido

1. **Repositório, pasta e branch cortados não têm tooltip.** `gitSvg` corta a branch com `fit` (`svg.ts:293`)
   e a pasta com `fitStart` (`:281`) sem `tip`. Vale no cabeçalho e no cartão de sessão.
2. **A camada pega um só `<title>` por linha.** `hoverLayer` lê o primeiro (`svg.ts:152`). Com nome e branch
   cortados na mesma linha, precisa de uma camada por texto, cada uma na sua área.
3. **A área do tooltip é maior que o texto.** A camada vai do começo do nome até a borda da linha (ou até o
   anel), então o tooltip aparece também sobre o tempo, a contagem e a barra. O pedido diz "em cima do
   texto". O ajuste é limitar a camada à largura do texto desenhado (`overlay('name')` em
   `draw/geometry.ts:127`).

A palavra de estado ("interrompida", "na fila") e o tempo nunca são cortados. O terminal não tem tooltip.

## Proposta

- **A (recomendada):** manter o tooltip nativo e fechar as três lacunas. O atraso fica o do app.
- **B:** tooltip próprio em CSS com 1 s exato, preso à moldura da linha. Pior leitura.

**Pergunta ao usuário:** o atraso nativo do app serve, mesmo sem ser exatamente 1 s? Recomendo que sim.

## Não verificado

- O atraso real do tooltip no app. O harness não vê hover. Em navegadores Chromium ele fica entre meio
  segundo e um segundo e meio, mas não medi no app.
- Se o usuário já vê o tooltip hoje. Se não vê ao parar o mouse sobre um título cortado, é bug à parte.

## Catálogo

Reescrever `visual.tooltip` em `regras/visual.md` (hoje: "Dado uma linha cortada / Quando a pessoa passa o
mouse / Então o tooltip mostra o texto inteiro"):

- Dado um texto cortado com "…" porque não coube (título, nome de sessão, repositório, pasta ou branch)
- Quando a pessoa para o mouse em cima do texto
- Então o tooltip mostra o texto inteiro; só passar o mouse não mostra; texto que coube não tem tooltip
- `Reescrito: 2026-11-09`, com as palavras do pedido acima
- Estado: segue `checklist (tooltip do app)`

Cenário novo, coberto pelo harness, porque `svgs($)` do kit lê o `<title>`:

- Id: `visual.todo-texto-cortado-leva-o-texto-inteiro`
- Dado um título e uma branch longos demais para a linha
- Quando o painel é desenhado no app desktop
- Então cada texto cortado carrega o texto inteiro, e o que coube não carrega nada
- Estado: `pendente (tests/visual.test.ts)`

## Impacto

`npm run impacto -- draw/svg.ts draw/geometry.ts hooks/render.tsx`: `hooks/render.tsx` é núcleo e afeta
tudo. Os 3 golden mudam se a branch do cenário for cortada a 60 colunas, e de qualquer forma já mudam
pelo ajuste do título. No checklist: `visual.tooltip`, `visual.cliques-no-icone-e-no-anel` (a camada não
pode cobrir o ícone nem o anel) e `visual.largura-real`.
