# Plano: ajuste 1, o cartão se destaca do painel (PR 37)

Diff pronto, sem bloqueio. Na cópia (`22ad5de` + diff), o `npm run check` falha só no golden: "o
desenho de filha mudou", "de envios" e "de subagente" (230 passam, 3 falham; `principal` não muda).
Dois testes novos falham na base e passam com a mudança. Diff:
`<notas>\ajuste-1-cartao.diff`.

Escrito pelo planejador em 2026-11-13. O repositório real não foi tocado (segue limpo em `22ad5de`).
Base de trabalho: um clone novo no scratchpad, branch `feat/painel-nativo`, ponta `22ad5de`.

## 1. Análise

### Causa, confirmada no código

`task-tree/draw/desktop.tsx`, a constante do cartão (linha 301 em `22ad5de`):

    const CARD = { borderStyle: 'round', paddingX: 1, paddingY: 0, flexDirection: 'column', flexGrow: 1, minWidth: 0, backgroundColor: 'userMessageBackground' }

Dois problemas, um no fundo e um na borda:

- **Fundo.** `userMessageBackground` é uma chave de tema. No app desktop ela vale a primeira superfície
  do app, que é a mesma do painel. O cartão é pintado na cor exata do painel.
- **Borda.** O cartão não diz `borderColor`. O app usa a borda padrão dele: branco a 4% no escuro,
  preto a 8% no claro.

Três fontes concordam:

| Fonte | O que mostra |
|---|---|
| Print do usuário (tema escuro), medido pixel a pixel | Painel `#191919`; dentro do cartão `#191919` (igual); borda de 1 px `#222222`, 9 níveis acima do painel. O cabeçalho tem os mesmos valores. |
| Código do app instalado (`app-5.11492.2`, `resources\ion-dist.asar`), a tabela de chaves de tema | `userMessageBackground` → primeira superfície (`--cds-surface-1`: `#191919` no escuro, `#fff` no claro). Borda sem cor → `--cds-border` (`#ffffff0a` no escuro, `#00000014` no claro). |
| Tipos do kit (`Color`, `backgroundColor` do `Pane`) | "A surface with no counterpart for a theme key keeps its own look." |

Branco a 4% sobre `#191919` dá `#222222`: a conta fecha com o print.

### Por que não outra chave de tema

No tema claro as superfícies do app são todas brancas (`--cds-surface-1`, `-2` e `-3` = `#fff`). A
chave da segunda superfície (`userMessageBackgroundHover`) daria `#1f1f1f` no escuro e branco sobre
branco no claro. Nenhuma chave destaca o cartão nos dois temas.

### Valores propostos

Uma cor crua e translúcida, o mesmo cinza que o mod já usa no trilho das barras (`136,135,128`, o
`#888780` dos ícones):

| | Valor | Escuro (painel `#191919`) | Claro (painel `#fff`) | Cartão em SVG (referência do brief) |
|---|---|---|---|---|
| Fundo | `rgba(136,135,128,0.06)` | `#20201f` | `#f8f8f7` | `#20201f` e `#f9f9f7` |
| Borda | `rgba(136,135,128,0.22)` | `#373634` | `#dfdfdd` | `#373736` e `#e1e1df` |

A borda é pintada sobre o fundo do próprio cartão (o app desenha o `Box` como um `div` com `border` e
`background-color`; o fundo passa por baixo da borda). As cores da tabela já contam isso.

Diferença para o SVG: no máximo 2 níveis por canal, invisível. No escuro o fundo sai idêntico.

### Por que funciona nos dois temas sem o mod saber o tema

- O mod não recebe o tema: nada em `hooks/` nem em `draw/` o lê.
- Um cinza médio translúcido puxa o que está embaixo na direção dele: clareia o painel escuro e
  escurece o claro. A mesma string serve aos dois temas.
- Vale também para a outra paleta que o app tem (painel `#1a1a19` no escuro): a cor é relativa ao que
  está embaixo, não a um valor fixo.
- O app pinta cor crua só nestas formas: `#hex` (3, 4, 6 ou 8 dígitos) e `rgb()`, `rgba()`, `hsl()`,
  `hsla()` de números. `rgba(136,135,128,0.06)` passa; é a forma que o trilho das barras já usa.

### Cartão dentro de cartão

O cartão de dentro de outro (subagente dentro da filha) leva a mesma borda e nenhum fundo próprio:
mostra o fundo do cartão de fora. Dois fundos translúcidos empilhados dariam um tom por nível, que é o
"contraste diferente por nível de cartão" que o brief deixa fora. Fica como no SVG: um fundo só.

## 2. Impacto, antes de implementar

`npm run impacto -- task-tree/draw/desktop.tsx`:

    Arquivos do mod tocados: draw/desktop.tsx
    Cenários afetados (29):
      sessoes.busto-so-no-pai                      coberto   task-tree/tests/sessoes.test.ts: 1 teste
      sessoes.pasta-sem-git                        coberto   task-tree/tests/sessoes.test.ts: 1 teste
      sessoes.toks-e-repo-branch-no-cartao         coberto   task-tree/tests/sessoes.test.ts: 1 teste
      ultracode.cartao-da-filha                    coberto   task-tree/tests/ultracode.test.ts: 1 teste
      ultracode.so-o-interruptor-real              coberto   task-tree/tests/ultracode.test.ts: 2 testes
      ultracode.cabecalho                          coberto   task-tree/tests/ultracode.test.ts: 1 teste
      ultracode.cor-e-corte                        checklist —
      ultracode.subagente-sem-palavra              coberto   task-tree/tests/ultracode.test.ts: 1 teste
      visual.largura-real                          checklist —
      visual.cliques-no-icone-e-no-anel            checklist —
      visual.botoes-por-chave                      coberto   task-tree/tests/visual.test.ts: 1 teste
      visual.tooltip                               coberto   task-tree/tests/visual.test.ts: 1 teste
      visual.titulo-sem-contagem-vai-ate-o-tempo   coberto   task-tree/tests/visual.test.ts: 3 testes
      visual.animacao-de-linha-nova                checklist —
      visual.cores-dos-temas                       checklist —
      visual.cabecalho-em-cartao                   checklist —
      visual.status-embaixo-da-caixa               checklist —
      visual.cartao-modelo-e-esforco               checklist —
      visual.cartao-posicao-de-toks-e-repo         checklist —
      visual.cartoes-ordem-e-espera                checklist —
      visual.recarga-real-e-respawn                checklist —
      visual.cabecalho-barra-e-chips-desenhados    checklist —
      visual.golden-gera-desenho                   coberto   task-tree/tests/golden.test.ts: 4 testes
      visual.desenho-principal                     coberto   task-tree/tests/golden.test.ts: 1 teste
      visual.desenho-cartao-filha                  coberto   task-tree/tests/golden.test.ts: 1 teste
      visual.desenho-envios                        coberto   task-tree/tests/golden.test.ts: 1 teste
      visual.desenho-subagente                     coberto   task-tree/tests/golden.test.ts: 1 teste
      visual.faixa-de-estado-geral                 coberto   task-tree/tests/visual.test.ts: 2 testes
      visual.secao-sem-traco                       checklist —
    Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios, visual.desenho-subagente
    Fora do mapa: nenhum

## 3. Implementação na cópia

### O que muda no código

Só `task-tree/draw/desktop.tsx`, um arquivo do mod (a recarga a quente vê um estado só):

- duas constantes, `CARD_FILL` e `CARD_LINE`;
- `CARD` perde `backgroundColor: 'userMessageBackground'` e ganha `borderColor: CARD_LINE`;
- `block(...)` ganha o parâmetro `nested`; o cartão leva `backgroundColor={nested ? undefined : CARD_FILL}`.

### `npm run check` na cópia

Base (`22ad5de`, sem mudança): tudo ok, 231 testes.

Com o diff:

    ok    regras          (149 cobertas, 0 pendentes, 20 checklist; mapa: 0 avisos)
    ok    travas
    ok    selos           (233 testes, 3 arquivos do kit, 4 desenhos)
    ok    validate do marketplace
    ok    validate do mod
    ok    tsc
    FALHA plugin test (exit 1)    230 pass, 3 fail, 233 testes em 15 arquivos
    --    regressao (não rodou)

As 3 falhas são o golden, e só ele:

    (fail) golden: filha       Error: o desenho de filha mudou (valide no app antes de aprovar)
    (fail) golden: envios      Error: o desenho de envios mudou (valide no app antes de aprovar)
    (fail) golden: subagente   Error: o desenho de subagente mudou (valide no app antes de aprovar)

A etapa `regressao`, rodada à mão (`node scripts/regressao.mjs --repo .`): 231 testes de `HEAD` contra
o código novo, 3 falharam, os mesmos três de golden. Ela passa depois do `golden:aprovar`.

### O que muda em cada cenário do golden

Comparação da árvore aprovada com a atual, prop a prop. Em todo cartão, as mesmas duas props; nada mais.

| Cenário | Cartões | Diferenças |
|---|---|---|
| `principal` | nenhum | nenhuma |
| `filha` | 1 (a filha) | `backgroundColor`: `userMessageBackground` → `rgba(136,135,128,0.06)`; `borderColor`: ausente → `rgba(136,135,128,0.22)` |
| `envios` | 1 (a sessão "outra") | as mesmas duas |
| `subagente` | 3 (rodando, concluído, grupo) | as mesmas duas, em cada um (6 no total) |

Nenhum cenário do golden tem cartão dentro de cartão; esse caso fica com o segundo teste novo.

### `npm run impacto` sobre o diff real

Igual ao previsto, mais os dois cenários novos (31 afetados):

    visual.cartao-se-destaca-do-painel           coberto   task-tree/tests/visual.test.ts: 2 testes
    visual.cartao-cores-pintadas                 checklist —

### `npm run testes:alterados`

    Testes existentes alterados desde HEAD: nenhum

    Novos: task-tree/tests/visual.test.ts::no app, o cartão de subagente e o de grupo têm fundo e borda que se destacam do painel nos dois temas | task-tree/tests/visual.test.ts::no app, o cartão da filha se destaca do painel; o do subagente dentro dele tem a mesma borda e fica com o fundo dela

## 4. Testes de verificação

Os dois em `task-tree/tests/visual.test.ts`, pelo kit (`noApp`), lendo a árvore do app (`d.raiz`): o
`Box` com borda dentro de cada `Box key="c<i>"`. O kit não muda. Os dois citam o cenário novo:

    ### visual.cartao-se-destaca-do-painel
    Origem: decisão do usuário, 2026-11-13 ("nao aparece nenhum card", ...)
    Estado: coberto

O que os testes afirmam não é o valor exato (isso é do golden), é o destaque: compõem a cor do
cartão sobre a superfície do painel de cada tema (`#191919` e `#fff`) e exigem o fundo a 5 níveis ou
mais do painel e a borda a 20 ou mais do fundo. No SVG eram 6 a 7 e 23 a 24. Ajustar a força depois
não quebra os testes, desde que o cartão siga visível.

### Teste 1

- **Nome:** `no app, o cartão de subagente e o de grupo têm fundo e borda que se destacam do painel nos dois temas`
- **Cenário:** `visual.cartao-se-destaca-do-painel`
- **Afirma:** com um subagente lançado e quatro lançados juntos, há dois cartões na raiz ("Explore:
  buscar usos de hover" e "4 subagentes"); em cada um, fundo e borda são cores cruas e translúcidas e
  passam nos limites acima, no escuro e no claro.
- **Falha na base:**

      (fail) no app, o cartão de subagente e o de grupo têm fundo e borda que se destacam do painel nos dois temas
        AssertionError: ... Explore: buscar usos de hover ...: o fundo (userMessageBackground) não é uma cor crua e translúcida
        Expected: defined
        Received: undefined

- **Selo:**

      npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cartão de subagente e o de grupo têm fundo e borda que se destacam do painel nos dois temas" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"nao aparece nenhum card\"; o cartão de subagente e o de grupo com fundo e borda próprios"

### Teste 2

- **Nome:** `no app, o cartão da filha se destaca do painel; o do subagente dentro dele tem a mesma borda e fica com o fundo dela`
- **Cenário:** `visual.cartao-se-destaca-do-painel`
- **Afirma:** com uma filha que tem um subagente, há dois cartões, o da filha na raiz e o do subagente
  dentro dele; o da filha passa nos limites; o de dentro tem a mesma borda, nenhum fundo próprio, e a
  borda dele passa no limite contra o fundo da filha.
- **Falha na base:**

      (fail) no app, o cartão da filha se destaca do painel; o do subagente dentro dele tem a mesma borda e fica com o fundo dela
        AssertionError: Sessão: filha, 0 de 1, 0:01 filha: o fundo (userMessageBackground) não é uma cor crua e translúcida
        Expected: defined
        Received: undefined

- **Selo:**

      npm run regras:selar -- "task-tree/tests/visual.test.ts::no app, o cartão da filha se destaca do painel; o do subagente dentro dele tem a mesma borda e fica com o fundo dela" --tipo novo --motivo "decisão do usuário, 2026-11-13: \"nao aparece nenhum card\"; o cartão da filha com fundo e borda próprios, e o cartão de dentro sem repetir o fundo"

Prova da base: os dois testes e o cenário escritos na cópia com o `desktop.tsx` de `22ad5de`;
`claude plugin test task-tree` deu 231 pass, 2 fail (só esses dois). Com a mudança, os dois passam.

Os dois selos já estão no diff (`regras/selos.json`, tipo `novo`, data 2026-11-13). Os comandos acima
só precisam ser rodados de novo se o texto de um teste mudar antes do commit.

## 5. Checklist do app

O harness não vê a cor pintada. Cenário novo no catálogo, `visual.cartao-cores-pintadas`
(`checklist`). O usuário confere, nos dois temas:

- [ ] Tema escuro: o cartão de subagente tem fundo um tom acima do painel (perto de `#20201f`) e a
      borda arredondada se vê inteira (perto de `#373634`).
- [ ] Tema escuro: o mesmo no cartão de sessão filha e no cartão de grupo ("N subagentes").
- [ ] Tema claro: o fundo do cartão é um tom abaixo do branco (perto de `#f8f8f7`) e a borda se vê
      inteira (perto de `#dfdfdd`).
- [ ] Cartão dentro de cartão (subagente dentro da filha): a borda de dentro se vê; o fundo é o do
      cartão de fora, sem um tom a mais.
- [ ] Recarga a quente: depois de aplicar o diff, o painel recarrega sem "reload failed".
- [ ] Nada mais mudou: guias, recuo, espaçamento interno e cabeçalho iguais a antes.

Se ele achar fraco ou forte, são duas constantes (`CARD_FILL`, `CARD_LINE`); o golden é regravado de
novo com as palavras dele.

## 6. Bloqueio

Nenhum. As decisões registradas dele sobre a cor do cartão ("calcule qual seria a terceira cor", "use
a mesma cor da borda") são retomadas: as cores pintadas são as do SVG, a até 2 níveis.

Pontos para a orquestradora, que não bloqueiam e não estão no diff:

- **Cabeçalho.** `draw/head.tsx` tem a mesma causa (a mesma chave de fundo e a borda padrão): no
  print ele também é da cor do painel, com borda `#222222`. O brief pede só os cartões de sessão e de
  subagente; o cabeçalho ficou como está. A origem de `visual.cabecalho-em-cartao` fala em "fundo,
  borda e raio dos cartões de sessão" (título de commit, não palavras do usuário): com este ajuste
  ele passa a diferir dos cartões. Levar as duas constantes para ele é uma linha e muda o golden dos
  4 cenários.
- **`visual.cores-dos-temas`** (checklist, origem "regra do painel") foi reescrito para dizer que o
  fundo e a borda dos cartões levam cor crua; ganhou a linha `Reescrito:`.

## Arquivos que o diff toca

| Arquivo | Mudança |
|---|---|
| `task-tree/draw/desktop.tsx` | as duas constantes, `CARD` e o parâmetro `nested` |
| `task-tree/tests/visual.test.ts` | os dois testes e os ajudantes deles (3 imports ampliados) |
| `regras/visual.md` | `visual.cartao-se-destaca-do-painel` (coberto), `visual.cartao-cores-pintadas` (checklist), `visual.cores-dos-temas` reescrito |
| `regras/selos.json` | os dois selos `novo` |
| `task-tree/DESENVOLVIMENTO.md` | um item em "Desenho nativo híbrido" |
| `CLAUDE.md` | a linha das cores cruas no checklist do app |

O golden (`task-tree/tests/golden/desenho.ts`) não está no diff.

## Para quem implementa

1. Na raiz do repositório, em `22ad5de`:
   `git apply "<notas>\ajuste-1-cartao.diff"`.
   Conferido: aplica limpo num clone novo e dá os mesmos 6 arquivos da cópia.
2. `npm run check`: deve falhar só no golden (filha, envios, subagente).
3. Sem commit: o hook bloqueia até o golden ser aprovado. O usuário valida no app (seção 5).
4. Com as palavras dele:
   `npm run golden:aprovar -- filha envios subagente --motivo "\"<palavras dele>\", AAAA-MM-DD"`
   (a data do dia em que ele validar; a etapa `regressao` só aceita o desenho aprovado no dia).
5. `npm run check` de novo e o commit local, com o código, `desenho.ts` e `selos.json`. Título
   sugerido: `fix(task-tree): cartão com fundo e borda próprios, que se destacam do painel`.

Observação de ambiente: num clone novo, o `validate` não gerou `task-tree/.claude-plugin/types/` e o
`tsc` falhou; copiei a pasta do repositório real, como o pedido previa. No repositório real ela já
existe.
