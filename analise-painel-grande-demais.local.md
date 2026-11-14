# "Painel grande demais (743 KB)": de onde vem, por que aparece, e a correção

> **Encerrada em 2026-11-04 por decisão do usuário:** "é de outra sessão. deixe esse limite em 20
> megas, vou avaliar e avisar quando ele travar. pode ser uma restrição do código antigo." A
> Implementação sobe `DRAW_LIMIT` para 20 MB; a correção por bytes (§4) e a dúvida (§5) **não**
> seguem. O que fica de útil: a causa medida (§1: o histórico aberto desenha 400 linhas de ~2,4 KB)
> e a origem dos limites (§3), caso o painel trave de novo.

Só leitura; nada editado no repositório. Medições numa cópia de `HEAD` (7da338d, "painel sem
animações") no scratchpad
(`<scratchpad>\grande`,
`task-tree/tests/zz-grande.test.ts`), com o estado publicado da orquestradora
(`~/.claude/task-tree-waits/local_ee919fbf-….json`, 274 KB, gravado 17:25: 72 pedidos, 180 níveis 1,
4 filhas com 20 rodadas cada) semeado no state do kit e desenhado na superfície desktop.

Pergunta do usuário (2026-11-04): "de onde vem? e porque é exibida? é um valor arbitrario?".

## Essencial

- **Causa provada: o clique em "+69 pedidos anteriores".** Desde o commit f46bdce ("só a visão
  resumida"; decisão dele "Ficam em '+N pedidos anteriores' (Recomendado)"), tudo o que saiu do
  trabalho fica atrás dessa linha, fechada por padrão. Aberta, ela desenha os 72 pedidos com os
  cartões das filhas: o corte de 400 linhas (`MAX_ROWS`) para o desenho em 400, **e 400 linhas de hoje
  pesam ~930 KB** (medido: 954 KB a 120 colunas, 965 KB a 200), acima dos 600 KB de `DRAW_LIMIT` → a
  linha "Painel grande demais (N KB): mostrando só o essencial." no lugar do painel. Os 743 KB dele
  são o mesmo caso com menos linhas à vista (pane mais estreito, linhas recolhidas). Fechado o
  histórico, o painel dele tem 21–43 linhas e 50–104 KB.
- **Por que aparece:** dois limites que nunca foram conciliados. `MAX_ROWS = 400` (1d55fa0, 2026-10-22)
  e `DRAW_LIMIT = 600 KB` (dcf4a4c, 2026-10-21) foram escolhidos quando uma linha pesava poucas
  centenas de bytes e o histórico não abria; o DESENVOLVIMENTO diz "só se 400 linhas passarem disso",
  o que hoje é sempre: cada linha custa ~2,4 KB (SVG com a folha de estilo própria, `alt`, camada de
  tooltip, JSON com as aspas escapadas), e cabem ~330 linhas em 600 KB.
- **É arbitrário:** sim. Os 600 KB são uma margem abaixo do desenho de 1,3–1,6 MB que o app parou de
  mostrar em 2026-10-21; ninguém mediu o limite real do app, que não está documentado. As 400 linhas
  também ("far above a real panel"). Nenhum dos dois vem do app.
- **Sem relação** com o PR #31 em si nem com a remoção das animações (HEAD já sem `motion.ts`: 0
  regras de animação no desenho medido). A relação é com a mudança que entrou junto: o histórico
  clicável.
- **Correção proposta:** o corte passa a ser por bytes, não só por linhas: depois de montar os SVGs,
  se a soma passa do orçamento, saem blocos inteiros do começo (os mais antigos, como `limitRows`
  já faz) até caber, com a linha "+N linhas anteriores"; a linha de emergência vira último recurso
  (nunca deve aparecer). Cenário reescrito `cabecalho.limite-de-linhas-do-desenho` ("o desenho nunca
  passa de 400 linhas nem de 600 KB") e teste no kit com o painel grande já existente
  (`grande('T', 8, 8, 7)`) na superfície desktop: hoje ele produz a emergência; depois, SVGs e tamanho
  ≤ 600 KB. Opcional, de produto: ao abrir o histórico, cada pedido antigo vem recolhido (uma linha
  por pedido).

## 1. O que infla o desenho (medido)

Estado da orquestradora como publicado às 17:25, superfície desktop, `DRAW_LIMIT` desligado na cópia
para medir o que o render monta antes de decidir pela emergência:

| Caso | Linhas | Tamanho (JSON) | Por linha |
|---|---|---|---|
| Como está, 120 colunas (histórico fechado) | 43 | 104 KB | 2,4 KB |
| Como está, 60 colunas | 43 | 110 KB (31 camadas de tooltip a mais) | 2,6 KB |
| As 4 filhas trabalhando | 49 | 120 KB | 2,4 KB |
| **Histórico aberto** ("+69 pedidos anteriores"), 120 colunas | **400 + cabeçalho** (corte de `MAX_ROWS`) | **954 KB** | 2,4 KB |
| Histórico aberto, 200 colunas | 400 + cabeçalho | 965 KB | 2,4 KB |

(O arquivo publicado diz `rows: 21`, `drawSize: 49 603`: o painel real dele tem linhas recolhidas que
o arquivo não guarda; a proporção é a mesma, 2,36 KB por linha.)

Composição do desenho com o histórico aberto (954 KB, 493 `Svg`):
- 401 SVGs de linha: 648 KB de `source` (média 1,6 KB), dos quais **121 KB são as folhas de estilo**
  (uma `<style>` por SVG, ~245 B cada, só as classes usadas: `slim`) e o resto é a linha em si
  (cartão, guias, ícone, textos, clip);
- 92 camadas de tooltip (`hoverLayer`, nomes cortados): 49 KB;
- `alt` de todas as linhas: 38 KB (o do cabeçalho tem o resumo inteiro);
- o resto (~220 KB) é a estrutura JSON do desenho (`Box`, `Button`, props) e o escape das aspas do
  SVG dentro do JSON (`\"` em cada atributo: ~10–12 % do `source`).
- Por tipo de linha: 185 tarefas concluídas (247 KB), 43 cartões de sessão (128 KB, 3 KB cada: o
  cartão leva repositório, branch, taxa, modelo e anel), 75 linhas de pedido (118 KB), 52 linhas ↩
  (95 KB, 1,8 KB cada: a resposta inteira vai no `<title>`), 22 interrompidas (27 KB).
- Cabem **~330 linhas em 600 KB** a 120 colunas (328 a 200).

Nada "inflou" fora do esperado: cada peça pesa o que pesa desde o V4 (cabeçalho de 4,7 KB) e desde as
linhas ↩ e os cartões. O que mudou foi a quantidade de linhas que um clique passa a desenhar.

## 2. A relação com o PR #31 e com as animações

- O histórico "+N pedidos anteriores" com tudo o que saiu do trabalho entrou em f46bdce
  (2026-11-04, "só a visão resumida"), na branch do PR. Antes disso a completa mostrava só os 3
  últimos pedidos mais os abertos, e a resumida nem tinha histórico: 72 pedidos nunca eram desenhados
  de uma vez (o caso de 1,6 MB de 2026-10-21 foi justamente esse, e virou o corte de 3 pedidos).
  O clique no histórico reabre o mesmo caminho, agora limitado a 400 linhas, que ainda é demais.
- Animações: HEAD (7da338d) já está sem `motion.ts`; a medição acusa 0 regras `@keyframes`/`animation`.
  A animação só acrescentava regras nas linhas que mudavam; não explica os 743 KB. A Implementação
  está nos mesmos arquivos (`render.tsx`, `svg.ts`, `layout.ts`); a correção abaixo toca
  `render.tsx` e `layout.ts`: vai depois do commit dela, na mesma branch.

## 3. De onde vem o 600 KB, e o limite real do app

- `DRAW_LIMIT = 600 * 1024` em `hooks/panel.ts:487`; a medida é `JSON.stringify(made).length` em
  `hooks/render.tsx:338` (o desenho inteiro, `Box`/`Svg`/`Button` com props), e acima disso o render
  devolve o `Text` de aviso (`render.tsx:339–344`), grava no log de depuração e publica `drawSize`.
- Origem: commit dcf4a4c (2026-10-21, "cliques por chave, painel na tela e desenho menor"): o
  painel da orquestradora com 1 614 695 bytes "não era mostrado pelo app"; o commit cortou para 3
  pedidos (101 345 bytes) e pôs "acima de 600 KB, desenho de emergência" como rede de segurança. O
  valor é uma margem abaixo do que falhou; não há medição do limite real do app, nem documentação
  dele. `MAX_ROWS = 400` (1d55fa0, 2026-10-22, "Sim, com o corte") veio depois, por linhas, e o
  DESENVOLVIMENTO registrou a ordem "SHOWN_TURNS → MAX_ROWS → DRAW_LIMIT: só se 400 linhas passarem
  disso", supondo que não passariam.
- O limite real do app: desconhecido. Sabe-se que 1,3–1,6 MB não aparece e que ~120 KB aparece. Dá
  para medir (um desenho artificial crescente até o pane sumir), mas é experimento no app, com o
  usuário olhando; a correção abaixo não depende disso, porque o orçamento continua configurável e
  conservador.

## 4. Correção proposta

**A) Corte por bytes (`limitRows` por orçamento), em `draw/layout.ts` + `hooks/render.tsx`.**
Hoje o render monta os SVGs de todas as linhas (`sources`) e só depois mede o JSON inteiro. Proposta:
1. `limitRows` continua cortando em 400 linhas (barato, antes de qualquer SVG).
2. No render, com as `sources` prontas, somar o custo de cada linha (`source.length + alt.length +
   camada de tooltip + ~150 B de estrutura`) de trás para a frente; se o total passa de um orçamento
   (`DRAW_BUDGET`, p. ex. 480 KB = 80 % de `DRAW_LIMIT`), aplicar o mesmo corte de `limitRows`:
   saem blocos inteiros de nível 0 do começo (os mais antigos), uma linha "+N linhas anteriores"; se o
   último bloco sozinho não cabe, ele é desenhado até caber e fecha com "+N linhas". Para isso,
   extrair de `limitRows` uma função pura `cutRows(rows, fits)` que recebe o critério (por contagem
   hoje; por bytes acumulados aqui), e o render chama a segunda passagem só quando a soma passa do
   orçamento (o caso comum, até ~250 linhas, não paga nada).
3. A emergência (`DRAW_LIMIT`) fica como último recurso, com a mensagem dizendo o que fazer
   ("recolha o histórico"); nunca deve disparar com o passo 2.

**B) Opcional, de produto: o histórico abre recolhido.** Ao abrir "+N pedidos anteriores", cada
pedido antigo vem como uma linha fechada (▸ "Pedido …", com x/y); a pessoa abre o que quer. Com 69
pedidos: 69 linhas (~170 KB) em vez de 400. Resolve a leitura (ninguém lê 400 linhas) e mantém o
orçamento folgado; a trava A continua necessária (várias abertas de uma vez). Custo: `turnRows` com
`opened(key, false)` quando o pedido vem do histórico (uma condição), as chaves de dobra já existem.

**C) Economias de bytes (complementares, ~25 %):** não resolvem sozinhas (930 → ~700 KB), mas
baixam o custo por linha: uma `<style>` compartilhada não é possível (cada `Svg` é uma imagem
isolada), mas as regras podem ser abreviadas; a resposta inteira no `<title>` da linha ↩ (1,8 KB)
pode ser cortada a ~300 caracteres; o `alt` do cabeçalho pode perder a lista de chips. Deixar para
depois, se o orçamento apertar.

**Recomendação: A agora (bug: o painel some num clique legítimo), B como pergunta ao usuário,
C não.**

### Catálogo
- `cabecalho.limite-de-linhas-do-desenho`, reescrito: título "O desenho tem no máximo 400 linhas e
  600 KB; o que passa vira uma linha de contagem"; Dado "um painel com mais de 400 linhas, ou cujo
  desenho passa de 600 KB (p. ex. o histórico aberto de uma sessão longa)"; Então acrescenta "o
  desenho nunca passa de 400 linhas nem de 600 KB, e a linha 'Painel grande demais' não aparece".
  `Reescrito: 2026-11-04, bug achado pelo usuário ("de onde vem? e porque é exibida? é um valor
  arbitrario?"): 400 linhas de hoje pesam ~930 KB`. Código: `hooks/render.tsx`.
- `cabecalho.historico-abre-com-clique`: o Então já diz "o limite de 400 linhas do desenho continua
  valendo"; acrescentar "e o de 600 KB". Se B for aprovado: "os pedidos antigos vêm recolhidos", com
  `Reescrito:` nas palavras dele.
- DESENVOLVIMENTO: a frase "só se 400 linhas passarem disso" sai; entra a medida (2,4 KB por linha,
  ~330 linhas em 600 KB) e o corte por bytes.

### Testes
- Novo, em `cabecalho.test.ts` (cita `cabecalho.limite-de-linhas-do-desenho`): o plano
  `grande('T', 8, 8, 7)` (521 linhas) na superfície desktop (`svgs($)`): hoje a emergência (o kit
  devolve 0 SVGs: foi assim que a medição a pegou); depois, há SVGs, a soma dos `source` + `alt` fica
  abaixo de 600 KB, e a primeira linha de tarefa é "+N linhas anteriores" (ou a última "+N linhas").
  Reproduz o bug sem o estado real.
- Os dois testes existentes do limite (terminal) não mudam: no terminal não há SVG e o corte por
  bytes não se aplica (a superfície terminal continua por linhas).
- Se B: um teste de que o histórico aberto traz os pedidos antigos recolhidos (`cabecalho.test.ts`,
  "+N pedidos anteriores abre com um clique" ganha a asserção ou um teste novo).
- Golden: não muda (os 3 cenários têm poucas linhas; `limitRows` e o orçamento não entram).

### `npm run impacto -- draw/layout.ts hooks/render.tsx hooks/panel.ts`
`render.tsx` é núcleo → todos os 98 cenários cobertos, os 12 do checklist do app e os 3 do golden;
"Fora do mapa: nenhum". A Implementação roda sobre o diff real.

### Brief para a Implementação
- Pedido e decisão do usuário: pergunta dele de 2026-11-04 ("de onde vem? e porque é exibida? é um
  valor arbitrario?"); bug do plugin (CLAUDE.md: corrige e relata). B só com a resposta dele.
- Cenários: reescritos `cabecalho.limite-de-linhas-do-desenho`, `cabecalho.historico-abre-com-clique`
  (texto acima); sem mudança que protegem a área: os demais de `cabecalho.md`.
- Matriz de impacto: acima (núcleo).
- Testes existentes que mudam: nenhum (o novo entra ao lado dos dois do limite; se a suíte acusar
  outro, parar e relatar).
- Arquivos: `draw/layout.ts` (`cutRows` extraída de `limitRows`), `hooks/render.tsx` (a segunda
  passagem por bytes e a mensagem de emergência), `hooks/panel.ts` (`DRAW_BUDGET` ao lado de
  `DRAW_LIMIT`), `regras/cabecalho.md`, `tests/cabecalho.test.ts`, `selos.json`, `DESENVOLVIMENTO.md`.
  Depois do commit da Implementação que está em curso (mesmos arquivos). Commit sugerido:
  `fix(task-tree): o desenho nunca passa de 600 KB: corte por bytes antes da emergência`.
- O que o usuário valida no app: abrir "+69 pedidos anteriores" na orquestradora: o painel continua
  aparecendo, com "+N linhas anteriores" no topo em vez do aviso; fechar volta ao normal.

## 5. Riscos e dúvidas

- O orçamento por bytes estima a estrutura JSON por linha (~150 B); se a estimativa ficar curta, a
  emergência ainda pega (por isso fica). Medir uma vez com o estado real depois da mudança
  (`drawSize` publicado) e calibrar.
- O corte por bytes depende da largura (mais camadas de tooltip em pane estreito): a 60 colunas
  cabem menos linhas; o algoritmo já conta por linha, então se adapta.
- Dúvida de produto (B): ao abrir o histórico, os pedidos antigos vêm recolhidos (recomendado) ou
  abertos como hoje? Opções: recolhidos (uma linha por pedido, abre o que quiser) / abertos até o
  corte (como hoje, só com o corte certo). Recomendo recolhidos.
- O limite real do app segue desconhecido; se um dia for medido, `DRAW_LIMIT`/`DRAW_BUDGET` sobem ou
  descem num lugar só.
