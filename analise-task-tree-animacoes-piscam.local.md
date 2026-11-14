# Animações ainda piscam (sem relógios nem tique)

O que o usuário chama de piscar: "linhas somem e voltam e icones piscam".

## Teste (DIAG sem commit, já retirado; log em `diag-piscar.local.log` nesta pasta)
Cada desenho da principal registrava as marcas de `mark()` (`draw/motion.ts`). Eu mexi no cartão da
analise-task-tree (plan com PROVA-A/B, uma pergunta, done, start), com o usuário olhando.

- Não há redesenho a mais: sem relógio, a principal só desenhou nas mudanças (segundos entre um e
  outro, sempre acima do `DUR` de 400 ms). A animação não se repete por desenhos seguidos.
- **Causa 1 (linhas somem e voltam): a chave da linha não é estável.** `rowKey`
  (`hooks/render.tsx:148`) é `fold.key` quando a linha tem algo embaixo, senão
  `depth|sid|title|nodes`. No log:
  - 23:16:15, uma pergunta (aguardando) aparece sob PROVA-A: a linha vira dobrável, a chave passa
    a `t:18/18.3.1` e PROVA-A **entra de novo** (fade-in);
  - 23:16:39, a pergunta é respondida: a chave volta a `5||PROVA-A|18/18.3.1` e ela **entra de novo**;
  - 23:15:45, um replan pôs filhas em 18.3: a linha 18.3 trocou de chave e entrou de novo.
  A chave muda também com o título, com `nodes` (dobrar e abrir troca `[t]` por `[]`), e pela
  rodada do cartão (`…#1792797277337`).
- **Causa 2 (ícones piscam): `pop` em toda troca de tom, inclusive nos pais e nas trocas de
  passagem.** 23:16:42, o done de PROVA-A muda o tom de `t:18` e `t:18/18.3`, que passam de em
  andamento a aguardando. 23:16:57, o start de PROVA-B os devolve a em andamento. Cada mudança dá
  um `pop` (de 60% para 100%, com fade) nos ícones dos pais, que vão e voltam a cada tarefa.
- **Causa 3 (contribui): a barra recomeça do zero** em toda mudança de contagem (`grow` com
  `scaleX(0)`), em todas as linhas ancestrais e no cabeçalho de uma vez (23:16:42: `t:18#bar`,
  `t:18/18.3#bar`, `T:35#bar`, `t:AT#bar` e `head#bar`). A barra some e cresce: lê-se como piscar.

## Plano de correção
1. **Chave estável por entidade** (`rowKey`): a mesma chave em qualquer estado da linha.
   - tarefa: `scope + 't:' + id` (o `scope` que o layout já usa nas dobras, sem depender de
     `fold`);
   - pedido: `scope + 'T:' + turn.id`; cartão de sessão: `'s:' + sid` (sem a rodada); espera:
     `'w:' + id do wait`; ↩ resposta: `'r:' + sid/turno`; seções: `'sec:' + título`.
   Melhor que o `layout` ponha a chave em `Row.key` ao criar cada linha (ele sabe o que é cada
   uma) e que `rowKey` só a leia. Título, `nodes` e `fold` saem da chave.
2. **`pop` só onde a mudança é da própria linha e chega a um estado final ou novo de verdade:**
   - folhas (tarefa sem filhas): `open → current` e `* → done`/`interrupted`;
   - pais e pedidos: só `* → done` (o ✓ quando tudo fecha). As idas e voltas entre em andamento e
     aguardando dos pais não animam;
   - cartões: sem `pop`.
3. **Barra a partir do valor anterior:** `mark()` passa a guardar e devolver o estado anterior
   (`was.state` antes da troca). A barra anima de `from=antigo` para `to=novo` (SMIL `<animate
   attributeName="width" from=… to=… dur=".3s" fill="freeze">` no `rect.grf`, ou CSS com
   `transform: scaleX(antigo/novo)` para `none`). Só quando o novo for maior (avanço); se diminuir
   (replan com mais tarefas), sem animação.
4. Fade-in: continua só para chaves realmente novas, ou seja, linha nova de verdade.
5. Validar a recarga do mod e repetir o roteiro deste teste (plan com 2 folhas, pergunta sob uma,
   resposta, done, start). Esperado: só as linhas novas entram, só a folha que mudou anima o ícone,
   o ✓ do pai só quando ele fecha, e as barras andam do valor antigo ao novo. Depois religar os
   relógios (retirar `TESTE-SEM-RELOGIOS`) e conferir de novo.

## Rodada 2 (depois de c4c5532, 6971066 e 7aee7c6): CAUSA CONFIRMADA
- **Animações desligadas** (`animate()` devolvendo o SVG puro, sem commit) + PASSO-1/2 no cartão:
  o usuário respondeu "Não, ficou estável". Então o código novo roda (a recarga funciona) e o
  piscar vem das animações, não da troca das imagens.
- **Animações religadas + log** (cópia em `diag-piscar-2.local.log`): o desenho só marcou o que de
  fato mudou (✓ de PASSO-2, chips, barras que avançaram, a linha de espera). A principal desenhou
  só nos eventos, com segundos ou minutos entre um e outro.
- Mas o usuário: "elas ficam fazendo flash, fazem fade e animam (barras de progresso) em loop e
  ficam animando sem parar do início ao final da animação".
- **Causa:** o SVG com a animação **fica no desenho até o próximo redesenho**. A marca dura só
  `DUR` (400 ms), mas sem relógio nem evento o próximo desenho pode demorar minutos. Enquanto isso,
  o app **remonta as imagens SVG por conta própria**, sem `ui.render` do mod. Já se via na prova
  do relógio: a linha A, sem nenhuma mudança, "pulava" a cada segundo. A cada remontagem, a
  animação CSS/SMIL do SVG recomeça do início (fade de 0, barra crescendo), e daí o laço.
  Isso também explica por que as correções de chave, `pop` e barra "não mudaram nada": elas
  reduziram o que anima, mas o que anima continua em laço.

## Plano de correção
1. **Tirar a animação do desenho logo depois de tocar.** Quando um desenho escreve alguma animação
   (`marks` não vazias e `rules` aplicadas), agendar um redesenho em `DUR` ms
   (`$.clock.after(DUR + 50, () => $.ui.invalidate('ui.render'))`, um por vez, guardado em
   variável de módulo como o `ticker`). Esse redesenho já sai sem as marcas (passou do `DUR`), e o
   SVG volta ao estático. As remontagens seguintes do app mostram o estado final, sem laço.
2. Garantir que o desenho seguinte a uma marca sai mesmo sem animação: `mark()` não renova `at`
   quando o estado não mudou (já é assim); conferir que o redesenho agendado não gera marca nova.
3. Mesmo assim, a animação pode ser cortada ou repetida se o app remontar dentro dos 400 ms. Para
   que uma repetição não pareça flash, nada deve partir do invisível: fade de 0,6 a 1, ícone de
   85% a 100% sem opacidade, barra do valor anterior (já é assim) e o traço do ✓.
4. Hover layers (`hoverLayer(source, …)`, `isInteractive`): conferir que levam o `source` sem a
   animação, porque, embutido num frame, ele também remontaria em laço.
5. Validar a recarga do mod e repetir o roteiro (start/done/pergunta no cartão). Esperado: cada
   mudança anima uma vez e para, sem laço, com o painel parado por minutos. Depois religar os
   relógios (`TESTE-SEM-RELOGIOS`) e conferir de novo, porque o redesenho de minuto também sai sem
   animação.

Instrumentação desta rodada retirada (`DIAG-PISCAR` em `render.tsx` e `TESTE-SEM-ANIMACOES` em
`motion.ts`). Ficam só as linhas `TESTE-SEM-RELOGIOS` da implementação.

## Rodada 3 (depois de 8e94ba2): o "pulo"
Usuário: "elas fazem uma vez só, mas ... dão uma pulada na animação".
- R3.1: onde é o pulo? "Não sei dizer". Depois de um done/start no cartão: pulo no **ícone ✓/◉** e
  na **barra**.
- R3.2: redesenho final desligado (`settleMotion` com `return`, sem commit), PULO-2 start→done:
  "Agora anima em laço". Era o esperado: sem o redesenho final, volta o laço da rodada 2. O teste
  não diz se o pulo some. Variante retirada.
- R3.3, variante SUAVE (sem commit, já retirada): o ícone e a barra seguravam 150 ms o estado
  inicial e animavam em 450 ms com ease-in-out; `DUR` passou a 800. SUAVE-1 start→done. Usuário:
  "parece que fez 2 vezes e parou". **Isso confirma a causa do pulo.**

### Causa do pulo
Uma mudança gera **vários desenhos em rajada**. Na rodada 1, o log mostrou 3 em 160 ms
(23:15:12.831, .900, .992): o estado gravado em etapas, a publicação, o poll das filhas. Como o app
recria todos os `Svg` a cada desenho, e cada desenho dentro do `DUR` ainda leva a marca, **a
animação recomeça do zero a cada desenho da rajada**. Com 250–300 ms, o segundo desenho chega no
meio da animação e a corta, voltando ao início: é o "pulo". Com 450 ms + 150 ms de atraso, ela
chegou a tocar quase inteira e então recomeçou: "fez 2 vezes e parou". O redesenho final (DUR+50)
não é o culpado: ele sai sem animação, no estado final.

### Plano de correção
1. **Continuar a animação entre desenhos, em vez de recomeçar:** cada desenho com marca escreve a
   animação com `animation-delay` **negativo** igual ao tempo já corrido desde a mudança
   (`-(now − at)` ms, de `mark()`: passar `at` junto das marcas). Assim, o SVG recriado na rajada
   começa no ponto em que o anterior estava e a animação segue lisa até o fim, seja qual for o
   número de remontagens. Vale para fade, `pop`, traço do ✓, chip e barra (cada regra recebe o
   `elapsed`). No SMIL não há uso hoje; se houver, `begin="-Xs"`.
2. Manter o redesenho final em `DUR + 50` ms (sai estático, no estado final, igual ao último quadro
   da animação: sem salto ao parar). Com o atraso negativo, um desenho depois do fim já cai no
   ramo sem marca.
3. Durações: 300–350 ms com `ease-out` estão bem; nada de atraso positivo. `DUR` volta a 400 (ou
   duração + margem).
4. Opcional: juntar a rajada (a escrita do estado em várias etapas já coalesce no app a 10/s, pelo
   kit). O passo 1 já resolve, mesmo sem isso.
5. Validar a recarga do mod e repetir o roteiro start→done no cartão, com o usuário olhando o
   ícone e a barra. Esperado: uma passada lisa, sem recomeço nem salto. Depois religar os relógios.

## Rodada 4 (Fable, com a pesquisa `pesquisa-animacao-svg.local.md`): log de desenhos
Log `DIAG-PULO` (sem commit) em `drawDesktop`: hora, instância, nº de linhas, se levou animação,
tamanho e tipos do `seen` de `motion.ts`, e as marcas com o `ago`. Achados:
- **Visão resumida sem o cartão da análise.** Com `work=[BK]` e a análise ancorada em BI (turno
  43), a resumida da principal desenhou só 3 linhas (turno 45, BK, ↩): meu cartão não estava lá,
  embora a sessão esteja `running`. Por isso "não alterou nada" em BASE-1/2. Item à parte (bug da
  âncora viva na resumida), não tratado aqui.
- **Duas instâncias de desenho alternam na mesma sessão**: `linhas=3` e `linhas=24` se revezam a
  cada mudança (02:06:00.313 → 24 linhas; 00.681 → 3; 01.789 → 24 com `enter=64`; 09.916 → 3 com
  `head#bar` changed; 28.930 → 24 com `enter=64` de novo).
- **Causa do laço/pulo:** `mark()` guarda um único `seen` de módulo e **esquece toda chave que o
  desenho atual não traz**. Com duas instâncias de conjuntos de linhas diferentes, cada desenho de
  uma apaga as chaves da outra; no desenho seguinte da outra, todas as linhas dela "entram" de novo
  (`enter=64`, fade-in em tudo) e `head#bar`, chave igual nas duas com valores diferentes, "muda" a
  cada vez (barra cresce a cada vez). E o redesenho de assentamento (`settleMotion`) ainda faz as
  duas desenharem outra vez. Isso dá as 2–3 repetições e o "laço" das rodadas anteriores (que eu
  tinha atribuído ao app remontar as imagens).
- Correção do achado acima, com a instância no log: só há **uma** instância
  (`desktop/task-tree/dock/75 colunas`). Os desenhos de 3 linhas vieram das **trocas de visão**
  (≡/▤) do usuário durante o teste. Ainda assim o mecanismo vale: ao trocar de visão, `mark()`
  esquece as chaves da visão anterior e, na volta, **todas as linhas "entram" de novo** (`enter=64`,
  fade-in no painel inteiro) e `head#bar` "muda" (barra cresce). Isso é um defeito a corrigir
  (trocar de visão não deve animar nada), mas não é o pulo por mudança.
- BASE-3 (start → done na minha sessão, principal na visão ▤): os desenhos da principal nesse
  intervalo saíram **sem nenhuma marca** (`changed=0`). As linhas da minha rodada atual não
  estão onde o usuário olha: minha rodada atual começou por mensagem da sessão de pesquisa, e o
  cartão dela fica sob a remetente (28ae764), não sob uma tarefa da principal; o usuário também
  relatou as duas visões "congeladas". Para o teste valer, a principal deve me mandar uma mensagem
  nova (cartão sob a tarefa de envio, no pedido atual) e o usuário observar esse cartão.

## Rodada 5 (teste de entrega 5, cartão sob a tarefa atual): CAUSA DO PULO CONFIRMADA
- PULO-A/PULO-B (0,3 s, código do dce5f5c): o log da principal mostra, por mudança, **um só desenho
  com animação e um de assentamento ~470 ms depois** (02:11:45.810 anim → 46.276 estático;
  51.811 → 52.279). Nenhuma rajada. O usuário: **"2 em cada"** troca.
- PULO-C, variante sem commit com animações de **2 s** e assentamento aos 2,4 s (já retirada):
  log 02:18:08.868 anim=1 → 02:18:11.337 estático, **nenhum outro desenho no intervalo**. O
  usuário viu o movimento **"voltar ao início 2 ou mais vezes"** nesses 2,4 s e um **salto no fim**.
- Conclusão: entre dois desenhos do mod, **o app remonta a imagem SVG por conta própria, cerca de
  uma vez por segundo**, e cada remontagem reinicia a animação CSS/SMIL do zero (o atraso negativo
  calculado no desenho não ajuda: a remontagem é depois). O salto do fim é o assentamento trocando a
  imagem reiniciada pelo estado final. Com 0,3 s de animação, uma remontagem cai dentro da janela em
  boa parte das vezes: "2 trancos" = reinício + assentamento.
- Consequência para o **relógio em SMIL (4f6b223)**: os `<set begin="Ns">` dependem do tempo do
  documento, que volta a 0 a cada remontagem. Com `TESTE-SEM-RELOGIOS` retirado, o relógio deve
  andar e voltar (a prova do relógio já mostrava a linha A "pulando" a cada segundo com fonte
  igual). Validar isso antes de confiar no 4f6b223; a alternativa é voltar ao redesenho por segundo.
- Isso bate com a pesquisa (casos 1 e 3: nó novo = animação nova; SVG-imagem reinicia ao recarregar)
  e descarta as correções por delay negativo/fonte idêntica: quem recria é o app, fora do nosso
  controle, e sem JS no SVG não há como alinhar o tempo.

## Decisão do usuário
"Animação por quadros": o mod conduz a animação, redesenhando a cada ~100 ms durante os 300 ms.

## PLANO FINAL (para a implementação)
Princípio: o app recria a imagem SVG quando quer, então **nenhuma animação pode depender do tempo
do documento SVG**. O mod desenha o estado intermediário certo a cada quadro; o CSS só suaviza os
100 ms até o quadro seguinte. Uma recarga do app, no pior caso, volta ≤ 100 ms.

1. **Quadros** (`hooks/render.tsx`, no lugar de `settleMotion`): enquanto alguma marca está dentro
   de `DUR` (300 ms), o desenho com movimento agenda o próximo quadro com
   `$.clock.after(100, () => $.ui.invalidate('ui.render'))` (um timer de cada vez, variável de
   módulo). O desenho feito depois de `DUR` sai estático e não agenda nada. 3–4 quadros por
   mudança; o kit já limita a 10 desenhos/s.
2. **Estado intermediário por quadro** (`draw/motion.ts`): com `ago` de `mark()`, progresso
   `p = easeOut(min(1, ago / 300))`. As regras injetadas por `animate()` passam a ter **valores
   estáticos** para este quadro e um **trecho de 100 ms** até o estado do quadro seguinte
   (`p2 = easeOut(min(1, (ago + 100) / 300))`), com `from`/`to` explícitos e `fill both`:
   - fade da linha/cartão: `.mv{opacity:o(p);transform:translateY(y(p))}` + `@keyframes` de
     `o(p)→o(p2)`;
   - ícone: `.ic{transform:scale(s(p))}` (`transform-box:fill-box; transform-origin:center`) +
     trecho `s(p)→s(p2)`; ✓: `stroke-dashoffset` `d(p)→d(p2)` (dasharray 16);
   - chip: opacidade como o fade;
   - barra: `.bar{transform:scaleX(f(p))}` com `f` interpolando de `antes/agora` a 1 + trecho.
   Nada parte do invisível (0,6 / 85 %) — mantém o 8e94ba2. Nenhum `animation-delay`.
3. **`mark()`**: não esquecer chaves só porque o desenho atual não as traz (troca de visão ≡/▤
   fazia tudo "entrar" de novo e `head#bar` "mudar"): guardar a visão na chave do cabeçalho
   (`head@summary#bar`) e expirar chaves não vistas só depois de ~10 s. Um desenho em que mais da
   metade das chaves é nova (troca de visão, recarga) não anima nada (`kind: 'none'`).
4. **Relógio**: o SMIL do 4f6b223 também é reiniciado pela recarga do app (tempo do documento volta
   a 0): voltar o relógio ao redesenho por segundo (`tick` de 1 s com `invalidate`), e o texto
   `m:ss` estático. Retirar as linhas `TESTE-SEM-RELOGIOS` na mesma mudança. Os quadros de 100 ms
   e o tique de 1 s convivem (são só `invalidate`).
5. **Validação visual** (recarga do mod validada antes): start → done numa tarefa do cartão com o
   usuário olhando — um movimento de ~0,3 s, sem recomeço e sem salto no fim; trocar ≡/▤ sem
   nenhuma animação; relógio andando sem voltar. Se os 3–4 quadros parecerem "em degraus", subir a
   duração para 400 ms (4–5 quadros), não abaixar o intervalo (limite do kit).

Instrumentação retirada (`DIAG-PULO` em `render.tsx` e `motion.ts`; cópia do log em
`diag-pulo.local.log`). Só restam as linhas `TESTE-SEM-RELOGIOS` da implementação.

## Rodada 6: o hover pisca sem nenhum desenho do mod (dica do usuário)
Dica: "quando paro o mouse em cima de um ícone com ação, a borda que aparece atrás fica piscando
praticamente com o mesmo padrão". Teste: contador de desenhos religado (`DIAG-HOVER`, sem commit, já
retirado; cópia em `diag-hover.local.log`), eu parada 20 s (02:23:22–02:23:44 UTC), o usuário com
o mouse sobre um ✓ do painel da principal.
- Log da principal nesse intervalo: desenhos às 02:23:23.3, 23.9, 24.7 e 24.7, e **nenhum até o fim
  dos 20 s**.
- Usuário: a borda do hover piscou **"cerca de 2 vezes por segundo"** o tempo todo.
- Conclusão: **o app reconstrói o conteúdo do painel ~2 vezes por segundo, sem o mod desenhar**:
  recria as imagens SVG (reinicia animações CSS/SMIL) e também o frame interativo do hover
  (`isInteractive`), cuja borda some e volta. Não há `invalidate` em laço, cadeia de assentamento
  nem poll regravando estado por trás disso. É comportamento do app (a relatar à Anthropic); o
  mod só pode não depender de tempo dentro do SVG.
- Isso fecha o diagnóstico das rodadas 2–5 e confirma o plano final (animação por quadros): com
  reconstruções a cada ~500 ms, uma animação CSS de 300 ms é atingida em metade das vezes; com
  quadros de 100 ms e trechos CSS de 100 ms, o recuo máximo é de um trecho. O relógio em SMIL
  também é atingido a cada ~500 ms, por isso volta ao redesenho por segundo.
- Observação à parte: no mesmo log, desenhos de 7 linhas e de 30 linhas se alternam em menos de
  100 ms (02:23:18.5/18.6 com 7; 23.3 com 30; 24.7 com 7) sem troca de visão pelo usuário. Pode
  haver duas instâncias (janela destacada e painel lateral) com visões diferentes, ou outra causa.
  Item a investigar à parte (não muda o plano, e o passo 3 do plano, chaves por visão, cobre os
  dois casos).

## Rodada 7 (58472a1, animação por quadros): "aparentemente não tem animação"
Log `DIAG-QUADROS` (sem commit) por desenho: instância, linhas, marcas, `ago`, chaves.
- **Os quadros saem**: QUADRO-1 (start) deu desenhos em 02:31:51.834 (ago 0), .852 (18), .945
  (111), 52.056 (222) e 52.167 estático: 4 quadros em 330 ms, como planejado. O `invalidate` de
  100 ms dispara e o app não os engole.
- Então o problema é **percepção**: 300 ms, ícone 85→100 % e fade 60→100 % são sutis demais, ainda
  mais com o app reconstruindo a imagem a cada ~500 ms (um quadro pode ser engolido).
- **Variante sem commit** (QUADRO-2): `DUR` 700 ms, ícone 50→100 %, fade 30→100 % com 6 px, ✓
  desenhando o traço inteiro (dashoffset 16→0). Usuário: **"aparentemente está suave"**. Mas:
  "quando abro as tarefas que estavam colapsadas, parou de animar a mostra das linhas".
- Achado no log: na mesma instância (`desktop/task-tree/dock/83 colunas/164x58`), os desenhos
  alternam a cada tique entre **7 e 9 linhas** (com e sem as filhas 27.2.1/27.2.2 de uma tarefa
  minha), sem o usuário fazer nada. Em apuração se é o estado de dobra (`folds`) de duas
  instâncias (janela destacada + painel lateral) com a mesma identificação, ou outra regra.
  Consequência para o movimento: `mark()` usa um `seen`/`lastDrawn` únicos; com dois conjuntos de
  linhas alternando, `shown = drawn >= lastDrawn` falha para as linhas que só uma instância mostra
  (sem `pop`) e uma linha reaberta por dobra já está em `seen` pela outra instância (sem fade-in).
- Decisão do usuário: **700 ms** ("700 ms (Recommended)").
- Sobre a alternância 7/9 linhas: nos minutos seguintes só houve desenhos de 9 linhas, com `folds`
  iguais; as dobras das tarefas 27, 27.2 e 27.3 aparecem como abertas pelo clique do usuário. A
  alternância ficou sem causa confirmada (hipóteses: duas instâncias, janela destacada e painel
  lateral, com a mesma identificação; ou cliques do usuário no momento). Item à parte.

## PLANO FINAL 2 (para a implementação; a validação é do usuário via principal)
1. **Duração e amplitude** (`draw/motion.ts`): `DUR = 700`, `FRAME = 100` (7 quadros). Fade da
   linha/cartão/chip de **0,3 → 1** com deslocamento de **−6 px → 0**; ícone de **50 % → 100 %**;
   ✓ desenhando o traço inteiro (`stroke-dashoffset` **16 → 0**, dasharray 16); barra do valor
   anterior ao novo (como está). Easing `ease-out` como está.
2. **Fade ao reabrir uma dobra** (`mark()`): uma chave que não estava no desenho anterior
   (`was.drawn < lastDrawn`) e volta agora conta como **`enter`** (fade-in), e não como vista.
   Exceção mantida: quando mais da metade das chaves do desenho é nova ou reentrante (troca de
   visão ≡/▤, recarga), nada anima. `KEEP` pode ficar (só evita que a chave suma do mapa).
3. O resto do 58472a1 fica: quadros a cada 100 ms (`nextFrame`), estado estático por quadro +
   trecho CSS de 100 ms, relógio por segundo, chave do cabeçalho com a visão.
4. **Validação, nesta ordem**: `claude plugin validate`; recarga do mod; depois a implementação
   **relata à principal antes de dar por corrigido**, e a principal pede ao usuário: (a) start →
   done numa tarefa do cartão: movimento de ~0,7 s, suave, sem reinício e sem salto; (b) recolher e
   reabrir uma tarefa com filhas: as linhas reabertas entram com fade; (c) trocar ≡/▤: nada anima;
   (d) relógio andando sem voltar.

Instrumentação `DIAG-QUADROS` retirada (`git checkout` em `draw/motion.ts` e `hooks/render.tsx`,
que só tinham a variante e o log); cópia do log em `diag-quadros.local.log`. Árvore limpa.
