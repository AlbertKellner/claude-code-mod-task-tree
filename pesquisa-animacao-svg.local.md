# Pesquisa: animação SVG/CSS que recomeça ao redesenhar (pesquisa-animacao-svg)

Contexto: cada linha do painel é um SVG (CSS @keyframes/transition + SMIL); o host recria os SVG a cada desenho (rajada de ~3 desenhos em 160 ms, e às vezes por conta própria). Animação recomeça do zero ou "toca 2–3 vezes".

Regra comum a todos os casos: **nó novo = animação nova**. Animação CSS e relógio SMIL pertencem ao elemento/documento; recriar o nó (innerHTML, remount, novo `<img>`/data URI) zera o tempo. Sem JS no SVG e sem nó estável, só restam: (a) não recriar, (b) recriar com o tempo já corrido embutido, (c) não animar nos desenhos repetidos.

## 1. innerHTML substitui o nó → animação reinicia/perde
- Fonte: https://gsap.com/community/forums/topic/39884-i-want-my-text-animation-to-be-smooth-but-it-is-janky/ ; https://www.paulund.co.uk/restart-css-animation
- Sintoma: texto/elemento atualizado por innerHTML "pula" e a animação recomeça.
- Causa: innerHTML apaga as instâncias antigas e cria novas; a animação dos nós antigos some, a dos novos começa no 0.
- Correção: não substituir o nó animado; atualizar só o conteúdo (textContent/atributo) dentro de um wrapper estável. Paulund mostra o inverso (clonar o nó é justamente o jeito de *forçar* o reinício).
- Nosso caso: é exatamente o mecanismo. Aplica só se o host permitir manter o mesmo nó (ex.: string SVG idêntica → host reaproveita?). Vale verificar se o host compara a string antes de recriar: desenho idêntico byte a byte pode evitar recriação.

## 2. React: remount por `key`/troca de elemento reinicia CSS animation
- Fonte: https://forum.freecodecamp.org/t/restarting-css-animation-in-react/292936 ; https://www.kirupa.com/animations/restarting_css_animations.htm
- Sintoma: animação reinicia (ou não reinicia) conforme o React reaproveita ou remonta o nó.
- Causa: React mantém o nó DOM se tipo+key iguais (animação continua); key diferente ou árvore diferente → remount → reinicia.
- Correção: key estável e mesma estrutura entre renders para manter; key nova só quando se quer reiniciar.
- Nosso caso: se `render.tsx` gera o SVG via componente/elemento cuja key/estrutura muda a cada desenho (ou via data URI que muda), cada desenho remonta. Conferir se a key e a string do SVG ficam idênticas nos desenhos da rajada quando nada mudou.

## 3. SVG em `<img>`/data URI: trocar `src` reinicia/para a animação
- Fonte: https://bugzilla.mozilla.org/show_bug.cgi?id=1184530 ; https://bugzilla.mozilla.org/show_bug.cgi?id=934507 ; https://www.w3.org/Bugs/Public/show_bug.cgi?id=24711 ; commit Gecko "Reset animations when .src changes" (bug 594771)
- Sintoma: animação SVG para ou recomeça quando o `src` é reatribuído (inclusive com o mesmo valor); depois de várias trocas, para.
- Causa: SVG-como-imagem é um documento isolado com relógio próprio; nova carga = novo documento = tempo 0. Browsers resetam animações de imagem ao mudar `src` (decisão explícita do Gecko).
- Correção: não reatribuir `src`; se precisa mudar, usar URL diferente aceitando o reinício; manter o mesmo `<img>` com o mesmo `src` quando nada mudou.
- Nosso caso: se o host usa `<img src=data:...>`, qualquer diferença na string (até um atributo de delay calculado) recria o documento. **Ironia**: o delay negativo variável muda a string a cada desenho, forçando recriação mesmo quando nada mudou. Também SMIL em SVG-imagem tem `begin` relativo à carga do documento, não ao relógio global.

## 4. animation-delay negativo para "retomar no meio"
- Fonte: https://css-tricks.com/?p=179881 ; https://css-irl.info/quick-tip-negative-animation-delay
- Sintoma tratado: elementos que precisam começar já no meio do ciclo.
- Causa/mecânica: delay negativo inicia imediatamente como se já tivessem passado |delay| ms.
- Correção: delay = -(agora − início real); com `animation-fill-mode: both`. Para SMIL o equivalente é `begin="-0.12s"` (begin negativo é válido em SMIL) ou `setCurrentTime` (exige JS).
- Nosso caso: aplica (é o que já foi tentado). Pontos a conferir: (a) o tempo decorrido precisa medir até o momento em que o *host pinta*, não quando a string é gerada — erro de ~1 frame (Safari/WebKit fica 1 frame atrás, https://bugs.webkit.org/show_bug.cgi?id=290993) dá um "tranco"; (b) quando decorrido ≥ DUR, emitir estado final estático (sem animação), senão toca de novo; (c) aplicar também a SMIL (`begin` negativo), não só a CSS; (d) transition não aceita "retomar": transition no nó novo não tem valor anterior → trocar transitions por @keyframes com from explícito.

## 5. Web Animations API: alinhar startTime de animação recriada
- Fonte: https://developer.mozilla.org/en-US/docs/Web/API/Animation/startTime ; https://lists.w3.org/Archives/Public/public-css-archive/2021Oct/0777.html ; https://lists.w3.org/Archives/Public/public-css-archive/2024May/0218.html
- Sintoma: animações de elementos montados em momentos diferentes ficam fora de fase/recomeçam.
- Causa: cada CSS animation tem startTime = momento em que o nó entrou.
- Correção: `el.getAnimations()` e copiar `startTime` de uma referência (ou `document.timeline.currentTime - decorrido`); proposta de CSS para alinhar ao múltiplo da duração.
- Nosso caso: **não aplica direto** (sem JS no SVG, e se for `<img>` o host não expõe as animações internas). Aplica só se o mod tiver acesso ao nó no DOM do host.

## 6. Coalescer/debounce dos desenhos da rajada (padrão geral)
- Fonte: GSAP forum (item 1) + prática comum; anime.js `keepTime` para frameworks reativos: https://www.mintlify.com/juliangarnier/anime/utilities/time
- Correção: emitir um único desenho por mudança (debounce ~DUR ou trailing-edge), ou garantir que os desenhos extras da rajada sejam **byte a byte idênticos** ao primeiro (sem tempo/delay embutido) para o host poder reaproveitar.
- Nosso caso: aplica parcialmente (o host às vezes redesenha sozinho, fora do nosso controle).

## 3 correções mais promissoras para o nosso caso
1. **Desenhos idênticos byte a byte na rajada + estado final estático**: a mudança anima só uma vez; todo redesenho posterior emite o SVG final sem animação (nem delay), idêntico entre si. Se o host recria mesmo assim, o pior caso é a animação ser cortada, não repetida.
2. **Delay negativo corrigido**: medir decorrido pelo relógio de pintura (incluir ~1 frame), aplicar em CSS *e* SMIL (`begin` negativo), trocar transitions por @keyframes com `from` explícito, e passar a estático quando decorrido ≥ DUR.
3. **Verificar se o host reaproveita nó/`img` quando a string não muda** (key estável no render.tsx, sem atributo variável): se sim, nó estável elimina o reinício na origem (casos 1–3).

## Animação em mods do Claude Code (kit de mods, build 2.1.308)

Fonte: skill local `plugin-authoring` (reference.md e types/claude-code.d.ts dessa build). Na web não achei exemplos públicos de mods com animação nem relatos de animação piscando em mods: a API é nova e o que vale é o contrato dos tipos.

O que os tipos dizem:
1. **`Svg` no desktop** (`SvgProps`): sem `isInteractive`, o desktop desenha o SVG **como imagem**. Com `isInteractive`, desenha num **iframe sandboxed sem script**, onde "hover, CSS :hover, **SMIL animation** e <title> funcionam". Ou seja, SMIL só é garantido com `isInteractive`. O `render.tsx` do task-tree usa `isInteractive` só nas camadas de hover (linhas 115 e 125). As linhas animadas podem estar caindo no modo imagem, que é o mesmo caso dos `<img>`/data URI acima: documento novo a cada `source` diferente.
2. **Ritmo de redesenho** (`$.ui.invalidate`): no máximo 10 redesenhos/s (30 no terminal com pane visível); chamadas mais próximas são juntadas. Cada redesenho entrega uma árvore nova, e o `Svg` com `source` diferente é recriado. Não existe `key` em `Svg` nem `blit` para ele: o `$.ui.blit` troca só `Raster` e `Image` com `key`, e esses dois existem só no **terminal**.
3. **`Client`** (desktop e terminal; no vscode não): é uma região desenhada por um módulo de superfície do próprio plugin. O engine **mantém a instância (estado local e timers) entre os redesenhos do plugin** enquanto um `Client` com a mesma `key` continua na árvore; props novas chegam à instância viva. O `setState` agenda um redesenho só da instância no próximo frame (várias chamadas viram uma). Atenção: três `setState` seguidos sem tick, tecla ou props no meio contam como laço de render, e a instância é desmontada. Limite: `ClientElements` é a tabela do terminal sem `Client`/`Raster`/`Image`, ou seja, **sem `Svg`** (só Box/Text etc.). Serve para animar por quadros (texto ou blocos coloridos) com o próprio relógio, sem depender da rajada do host.
4. **Componente nativo `Spinner`**: é a linha animada do turno ("Sauteing..."); o host a anima. Pode ser redesenhada por `ui.render`, mas não serve para animação dentro de pane.
5. **Status line** (`$.ui.status`): só texto. Animar ali = trocar o texto por timer (`$.clock.every`), limitado ao ritmo de redesenho.

Casos de "reinicia ou pisca" no próprio kit: os tipos avisam que "a redraw reaches the running instance, its state kept" só para `Client`. Para `Svg`, cada `source` novo é um elemento novo. Isso confirma, pelo contrato, a causa do nosso bug.

### Correções específicas de mod (entram nas promissoras)
- **A. `isInteractive` nas linhas animadas** (ou num `Svg` interativo só com a camada de animação): sai do modo imagem e garante SMIL/CSS no iframe. Continua sendo recriado se o `source` mudar, então combina com a correção 1 (`source` idêntico na rajada). Ainda precisa verificar se o desktop reaproveita o iframe quando o `source` é igual.
- **B. Manter o `source` do `Svg` estável entre redesenhos** e mandar `$.ui.invalidate` só quando algo mudou de fato. O próprio host já junta redesenhos a menos de 100 ms (≤10/s), então uma rajada de 3 em 160 ms dá pelo menos 2 desenhos.
- **C. Para animações que não podem reiniciar** (barra, ícone): desenhar com `Client` com `key` fixa, que guarda o estado e o relógio entre redesenhos. Custo: perde o `Svg` (só Box/Text) e precisa de um módulo de superfície; muda o visual.
