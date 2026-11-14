# "ultracode" no cartão da sessão filha, na cor do app

Análise de 2026-11-10, só leitura, sobre a branch `feat/toks-como-savvy` (8688fab) e o binário do app
`%APPDATA%\Claude\claude-code\2.1.321\d020ce1b5d30\claude.exe`. Feita com workflow (ultracode): 3
investigadores (cor, detecção, caminho no mod) e 3 verificadores adversariais; dois achados confirmados
integralmente, o do mod com uma correção (abaixo). Clone intocado.
Pedido do usuário: "quero que, você adicione nos cards de filhas, ao lado do modelo se a filha está usando
ultracode, se sim, mostre a palavra na mesma cor que é mostrada na IDE do claude code".

## Resposta curta

1. **Detectável, mas só por um caminho:** o kit não expõe o ultracode em nenhum noun, evento ou campo
   (0 ocorrências em `index.d.ts`). O engine, porém, injeta para o modelo um attachment de tipo
   `ultra_effort_enter` (com `reminderType: "full"` ao ligar e `"sparse"` a cada N turnos) enquanto o
   interruptor real está ligado, e `ultra_effort_exit` quando desliga. Um hook `prompt.attachment`
   casando esses tipos é a única pista que chega a um mod sem ler o prompt. O **aviso por mensagem** que a
   orquestradora mandou ontem não liga nada: é texto; só a palavra "ultracode" digitada pelo usuário no
   próprio prompt gera outro attachment (`workflow_keyword_request`, opt-in de um turno), e esse **não**
   deve contar como "filha em ultracode".
2. **Cor:** não é gradiente nem arco-íris. O rótulo "Ultracode on" usa o token `effortUltra`, uma cor
   sólida por tema: `rgb(175,135,255)` (#AF87FF) no dark e dark-daltonized; `rgb(135,0,255)` (#8700FF) no
   light e light-daltonized; `ansi:magentaBright` (dark-ansi) e `ansi:magenta` (light-ansi). É a mesma cor
   do token `autoAccept` (o roxo do modo auto-accept). Por cima há um "shimmer": a cada 100 ms um
   caractere fica em negrito com `#d0b4ff` fixo e os vizinhos em negrito na cor do tema.
3. **Onde entra:** a filha publica um campo novo `ultracode: boolean` ao lado de `engine` (mesmo caminho:
   state → `publishPanel` → arquivo → `io/publish.ts` → `io/host.ts` → `Child` → `Row` → `svg.ts`); o SVG
   desenha a palavra "ultracode" logo à direita do texto do modelo, em roxo (`#AF87FF`/`#8700FF` por
   tema), e no corte ela sai **junto com o modelo** (como um bloco), mantendo a ordem atual: repositório,
   depois modelo+ultracode, depois toks/s.
4. Cabeçalho e cartão de subagente: só perguntas (abaixo).
5. Golden não muda (o cenário `filha` não injeta `engine`); dois cenários novos; impacto 132 cenários
   (núcleo `types/index.d.ts` tocado).

## 1. Detecção

### O que existe no app (binário 2.1.321)

- O estado vive no app state da sessão: `ultracode: void 0` ao lado de `sessionEffort` e `fastMode`;
  `function xyt(e){return e.getAppState().ultracode===!0}`.
- Vale de fato quando `Pg(ultracode, model)` = `ultracode === true && vH(model)`, onde `vH` = workflows
  dinâmicos habilitados (`Sm()`: runtime, política da organização, flag) **e** o modelo suporta xhigh.
- Liga por `/effort ultracode on`, `--effort ultracode`, chave `ultracode` em settings
  (`apply_flag_settings`, o caminho que o app desktop usa pelo interruptor da UI) ou pelo controle do
  slider de esforço.
- O valor efetivo sai para o host como metadata `is_ultracode_active` (`notifyUltracodeActive`,
  recalculado no fim de cada turno). **Não passa por hook.**
- Para o modelo, o engine injeta, uma vez por turno regular do usuário (ou turno aberto por entrega):
  `[{type:"ultra_effort_enter", reminderType:"full"}]` quando `Pg` é verdadeiro e o último marcador não
  era `enter`; `reminderType:"sparse"` a cada N turnos enquanto segue ligado; `ultra_effort_exit` quando
  deixa de valer. É o system-reminder "Ultracode is on for the session" que vemos.
- Distinto: a palavra "ultracode" **digitada** pelo usuário gera `workflow_keyword_request` ("opting this
  turn into multi-agent orchestration"). Opt-in de um turno, não estado.

### O que o kit expõe

| Caminho | Serve? |
|---|---|
| `on('prompt.attachment', { type: 'ultra_effort_enter' }, …)` e `{ type: 'ultra_effort_exit' }` | **Sim.** O kit casa `type` por nome (`UndeclaredAttachmentInput`, "Builds add and retire kinds: match by name"). O hook devolve `next(e)` sem mexer no texto. Chega só em turno regular do usuário, então a filha fica alguns segundos sem saber até o primeiro turno dela depois de ligar |
| `$.settings.read({ key: 'ultracode' })` | Parcial: só vê o caso que veio por settings/flag (o do app desktop), não `/effort ultracode` digitado; e não aplica a condição do modelo (`vH`) |
| `prompt.submit` com `e.command?.name === 'effort'` | Só a tentativa, não o efeito |
| grep no texto do prompt | Não: `e.text` é "as typed"; reminders são attachments separados |
| `turn.step`/`turn.start` | Não: `e.effort` é só o nível (`xhigh` quando ultracode, mas xhigh sozinho não implica ultracode) |
| `$.session.*`, `$.session.usage()` | Não |

**Proposta:** hook `prompt.attachment` nos dois tipos, gravando `$.state ultracode: boolean` (nova chave,
com linha em `state/durability.ts`), e publicando no painel. Como reforço no arranque (a filha aberta já
em ultracode recebe o `enter` "full" no primeiro turno dela, então o hook basta; mas uma recarga do mod
no meio não perde nada porque o state persiste).

**O aviso por mensagem não conta.** Pelas palavras do usuário ("se a filha está usando ultracode"), a
palavra deve refletir o interruptor real, que é o que o app mostra. A orquestradora mandou "ative o modo
ultra code" por `SendMessage`: isso mudou o comportamento do modelo nas filhas, mas o app delas mostra
"Ultracode off" (não verifiquei na UI; pelo código, só `Pg` liga o rótulo). Se o usuário quiser que o
aviso conte, é outra regra (pergunta 2).

## 2. Cor exata

Fonte: módulo de temas do binário (`function p4(r)` mapeia nome → objeto).

| Tema do app | `effortUltra` |
|---|---|
| dark (padrão) | `rgb(175,135,255)` = #AF87FF |
| dark-daltonized | `rgb(175,135,255)` = #AF87FF |
| light | `rgb(135,0,255)` = #8700FF |
| light-daltonized | `rgb(135,0,255)` = #8700FF |
| dark-ansi | `ansi:magentaBright` |
| light-ansi | `ansi:magenta` |
| shimmer (todos) | `#d0b4ff`, um caractere por vez, negrito |

- Rótulo: `e(Pe,{text:"Ultracode  on",color:"effortUltra"})`; desligado, "Ultracode" bold + "off" dim.
- `Pe` é o shimmer: cada caractere na cor do token; a cada 100 ms o caractere `g` fica `#d0b4ff` bold e os
  vizinhos bold. A função `jie` que escreve "ultracode" no texto do `/effort` usa a mesma cor e o mesmo
  destaque.
- Não há `effortLow/Medium/High`: os níveis têm só glifos (○ ◐ ◈). Em todos os temas `effortUltra` é
  idêntico a `autoAccept`.
- Verificado por agente adversarial com os offsets no binário.

### Como reproduzir

- **SVG (app desktop):** duas classes novas em `draw/svg.ts`: `['ul', 'fill:#8700FF']` em `LIGHT` e
  `['ul', 'fill:#AF87FF']` em `DARK`. O painel só distingue light/dark (`prefers-color-scheme`), então os
  temas daltonized caem nos mesmos valores (que são iguais) e os ansi ficam com o hex equivalente
  (`magentaBright` ≈ #AF87FF, `magenta` ≈ #8700FF). Sem shimmer: o painel redesenha a cada segundo, não a
  cada 100 ms, e o SMIL do kit só serve para hover; proponho a palavra estática. Opacidade: 1 (a cor já é
  o destaque), ou `.9`; o modelo ao lado segue `.75`.
- **Terminal:** `Text color="…"` aceita `ThemeKey | string`. Se `effortUltra` ou `autoAccept` forem
  `ThemeKey` do kit, usar o nome (segue o tema do app sozinho); se não, o hex por tema não é possível no
  terminal (o mod não sabe o tema), então `"magenta"`. Hoje o terminal **não desenha o modelo** no cartão
  (`render.tsx:141-153` só tem git, meta, rate, ring), então a palavra só faria sentido se o modelo também
  entrar; proponho só o desktop, e no terminal nada (pergunta 5).

## 3. Caminho no mod e onde a palavra entra

Caminho atual de "modelo · esforço" (confirmado pelo verificador, com linhas corrigidas):

| Etapa | Onde |
|---|---|
| Filha captura `model`/`effort` em cada `turn.step` do loop principal e grava `engine` | `hooks/turn.ts:55-62`, `engineText` em `io/host.ts:103-108` |
| Publica | `hooks/panel.ts:502,509` → `io/publish.ts:137,166` (campo `engine`) |
| Mãe lê | `io/publish.ts:45` (aceita string não vazia); `io/host.ts:88-92` (`read.engines`), fallback `get_session` com cache de 60 s (`engineOf`, 112-125); `deriveChildren` grava `Child.engine` (156) |
| Desenho | `draw/layout.ts:1181` (`Row.engine`); `draw/svg.ts:377-390`: texto 11 px, `opacity .75`, `text-anchor="end"` em `end` (à esquerda do anel), depois o rate à esquerda dele; alt em 713 |
| Corte | `svg.ts:384-386`: 1º repositório (fica a branch), 2º modelo, 3º toks/s; branch por último, nome nunca |
| Tipos | `engine?: string` em `Sub`, `Published`, `Child` (`types/index.d.ts:61,116,159`); `Publication` em `publish.ts:102`; `durability.ts:67,95` |

### Duas formas de levar a palavra

- **A (recomendada): campo próprio `ultracode?: boolean`** em `Published`, `Child`, `Row` (e no state da
  filha), publicado ao lado de `engine`. O SVG desenha `engine` e, se `ultracode`, a palavra "ultracode"
  em `class="ul"` à direita do modelo (ou entre modelo e anel), com `engW` somando a largura dela; no
  corte, modelo e palavra saem juntos no 2º passo. Mantém `engineText` intacto (ela é usada também no
  cartão de subagente e no fallback `get_session`), e a cor só é possível com campo separado (um `<text>`
  só tem uma classe).
  Toca: `types/index.d.ts` (3 tipos), `io/publish.ts` (leitor e escritor), `io/host.ts` (Read, readFiles,
  deriveChildren), `hooks/panel.ts` (publicar), `hooks/register.tsx` (registrar o hook novo),
  `hooks/<novo ou turn.ts>` (o hook `prompt.attachment`), `state/durability.ts`, `draw/layout.ts`,
  `draw/svg.ts`.
- **B: dentro do texto `engine`** ("Fable 5.1 · high · ultracode"). Menos arquivos, mas a palavra sairia
  na mesma cor cinza do modelo: contradiz o pedido ("na mesma cor"). Só vale se a cor for dispensada.

Posição: **à direita do modelo**, antes do anel ("ao lado do modelo", palavras dele). Ordem final da
direita para a esquerda: anel · ultracode · modelo · toks/s. Alternativa: entre toks/s e modelo
(pergunta 4).

## 4. Cabeçalho e subagente: só perguntas

- Cabeçalho do painel principal: a própria sessão sabe o estado pelo mesmo hook. Mostrar "ultracode" ao
  lado do modelo no cabeçalho é a mesma regra aplicada à própria sessão. Não proponho; pergunta 6.
- Cartão de subagente: o subagente herda o ultracode da sessão (o `Pg` usa o `mainLoopModel`; o
  attachment só vai ao loop principal). Mostrar no cartão dele repetiria a informação da sessão.
  Pergunta 7.

## 5. Catálogo, testes e golden

### Cenários novos

`regras/sessoes.md`:

```
### sessoes.ultracode-no-cartao
O cartão da filha diz "ultracode" ao lado do modelo quando o interruptor dela está ligado.

- Dado uma filha com o ultracode ligado (o engine injetou `ultra_effort_enter` no turno dela)
- Quando o cartão é desenhado na mãe
- Então ao lado do modelo aparece a palavra "ultracode"; desligado (`ultra_effort_exit`), ela some; a
  palavra "ultracode" digitada num prompt (opt-in de um turno) não a acende

Origem: decisão do usuário, 2026-11-10 ("quero que, você adicione nos cards de filhas, ao lado do modelo
se a filha está usando ultracode, se sim, mostre a palavra na mesma cor que é mostrada na IDE do claude code").
Código: hooks/turn.ts (ou o arquivo do hook), hooks/panel.ts, io/publish.ts, io/host.ts, draw/layout.ts
Estado: coberto
```

`regras/visual.md` (checklist, pintura):

```
### visual.ultracode-na-cor-do-app
A palavra "ultracode" no cartão tem a cor do rótulo "Ultracode on" do app.

- Dado uma filha em ultracode
- Quando o cartão é desenhado no app desktop, nos dois temas
- Então "ultracode" fica à direita do modelo, em #AF87FF no escuro e #8700FF no claro (o `effortUltra` do app), e sai do cartão junto com o modelo quando falta espaço

Origem: a mesma decisão.
Código: draw/svg.ts
Estado: checklist (cor e tema, no app)
```

### Testes (`tests/sessoes.test.ts`, selados `--tipo novo`)

O verificador corrigiu o investigador: **o kit já injeta `engine` numa filha** pelo campo
`publicado` de `Filha` (`tests/kit/ambiente.ts:95,120`; `tests/fixtures/publicados.ts:12-13` trazem
`"engine": "Fable 5.1 · high"`, usado em `tests/durabilidade.test.ts:238`). Então:

1. Filha publicada com `"ultracode": true` → `esperarPalavra(p, 'filha-um', 'ultracode')` (o texto do
   terminal precisa desenhar a palavra para o teste ler; hoje o terminal não desenha o modelo. Ou se
   acrescenta modelo+ultracode ao terminal, ou o teste lê o alt do SVG, como os de posição fazem).
2. `$.prompt.attachment({ type: 'ultra_effort_enter', text: '…' })` na própria sessão → o arquivo
   publicado traz `ultracode: true`; `ultra_effort_exit` → `false`. O harness expõe `$.prompt.attachment`
   (d.ts 5037), então o hook é testável sem UI; **não verificado** se o stub precisa de `origin`.
3. `workflow_keyword_request` não liga.
4. Fixture nova em `publicados.ts` com `ultracode` para a `durabilidade` (formato publicado).

### Golden

`visual.desenho-cartao-filha` não injeta `engine` (confirmado: `golden.test.ts:55-73` dá git e rate; o SVG
aprovado não tem texto de modelo). Sem `engine` nem `ultracode` na fixture, o desenho não muda. Se a
implementação quiser o golden cobrindo a palavra, é cenário novo de golden (`visual.desenho-cartao-ultracode`),
com aprovação do usuário no app.

## Perguntas ao usuário

1. **O que acende a palavra:** o interruptor real do app (recomendado: é o que o app mostra como "Ultracode
   on"), ou também o aviso por mensagem da orquestradora? O aviso não é detectável de forma confiável (é
   texto); se contar, teria de ser uma convenção nossa (ex.: a filha grava um state ao receber a frase).
2. **Cor no painel:** sólida por tema, #AF87FF escuro e #8700FF claro, sem o shimmer (recomendado), ou
   tentar o shimmer com animação SMIL (o kit só a usa em hover; incerto)?
3. **Posição:** à direita do modelo, entre o modelo e o anel (recomendado), ou à esquerda dele?
4. **Corte:** sai junto com o modelo (recomendado) ou é a primeira a sair?
5. **Terminal:** nada (recomendado, o terminal não mostra nem o modelo) ou "ultracode" em `magenta`?
6. **Cabeçalho da própria sessão:** mostrar também ao lado do modelo? (sem recomendação; só perguntar)
7. **Cartão de subagente:** mostrar? (sem recomendação; só perguntar)

## `npm run impacto -- hooks/turn.ts hooks/panel.ts io/publish.ts io/host.ts draw/layout.ts draw/svg.ts hooks/render.tsx types/index.d.ts`

```
Núcleo tocado (hooks/render.tsx, types/index.d.ts): todos os cenários cobertos (o check roda todos)
Cenários afetados (132): 118 cobertos, 14 checklist (cabecalho.aviso-de-painel-grande-volta,
  subagentes.cartao-no-app, visual.*)
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
Fora do mapa: nenhum
```

`hooks/render.tsx` só entra se o terminal desenhar a palavra (pergunta 5); sem isso o núcleo tocado é só
`types/index.d.ts`. Golden não deve mudar (acima). Validação no app (checklist): uma filha com
`/effort ultracode on` e outra sem, nos dois temas; comparar a cor com o rótulo do próprio app.

## Não verificado

- Não rodei a sessão para ver o attachment chegar ao hook (só leitura); a existência e a condição de
  injeção vêm do binário, confirmadas por grep independente do verificador.
- Se `$.prompt.attachment` do harness exige `origin` ou `text` no input.
- Se `effortUltra`/`autoAccept` são `ThemeKey` aceitos por `Text color` no terminal (a lista de
  `ThemeKey` não foi lida).
- A conversão exata de `ansi:magenta` nos temas ansi depende do terminal do usuário.
