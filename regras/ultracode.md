# Ultracode

A palavra "ultracode" ao lado do modelo, quando o interruptor de ultracode da sessão está ligado.

Código da área: hooks/turn.ts, io/publish.ts, io/host.ts, draw/layout.ts, draw/svg.ts, draw/desktop.tsx, draw/head.tsx

### ultracode.cartao-da-filha
O cartão da filha diz "ultracode" ao lado do modelo quando o interruptor dela está ligado.

- Dado uma filha que publica o interruptor de ultracode ligado
- Quando o cartão dela é desenhado na sessão que a abriu
- Então "ultracode" aparece à direita do modelo; quando ela publica sem o interruptor, a palavra some

Origem: decisão do usuário, 2026-11-10 ("quero que, você adicione nos cards de filhas, ao lado do modelo se a filha está usando ultracode, se sim, mostre a palavra na mesma cor que é mostrada na IDE do claude code"; posição: "à direita do modelo").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): a palavra vem depois do modelo no texto do cartão; o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Estado: coberto

### ultracode.so-o-interruptor-real
Só o interruptor real acende a palavra; o aviso por mensagem não conta.

- Dado uma sessão
- Quando o engine injeta `ultra_effort_enter` no loop principal (ligou) ou `ultra_effort_exit` (desligou)
- Então a sessão publica e desenha "ultracode" enquanto ligado; a palavra digitada num prompt (`workflow_keyword_request`), uma mensagem dizendo "ultracode" ou um attachment de subagente não a acendem

Origem: decisão do usuário, 2026-11-10 ("Só o interruptor real (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Código: hooks/register.tsx, hooks/panel.ts
Estado: coberto

### ultracode.cabecalho
O cabeçalho do painel diz "ultracode" quando o interruptor da própria sessão está ligado.

- Dado o interruptor de ultracode desta sessão ligado
- Quando o cabeçalho é desenhado
- Então "ultracode" aparece desenhado no bloco de números do cabeçalho, em qualquer largura: no painel largo (84 colunas ou mais), na linha do tempo e do toks/s, depois deles; no estreito, numa linha própria abaixo (o cabeçalho não desenha o modelo)

Origem: decisão do usuário, 2026-11-10 ("Cabeçalho do painel, Cartão de subagente"); a posição, junto do toks/s, derivada (o cabeçalho não tem modelo).
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Reescrito: 2026-11-14, decisão do usuário ("Os dois sempre"): a palavra é desenhada também no cabeçalho estreito. O teste existente deste cenário não muda.
Código: hooks/render.tsx
Estado: coberto

### ultracode.cor-e-corte
A palavra tem a cor do rótulo "Ultracode on" do app.

- Dado uma filha em ultracode
- Quando o cartão é desenhado no app desktop, nos dois temas
- Então "ultracode" fica em roxo sólido, #AF87FF no escuro e #8700FF no claro (o effortUltra do app), sem brilho animado; no cabeçalho estreito, a mesma cor

Origem: decisão do usuário, 2026-11-10 ("Roxo sólido (Recomendado)"; "Junto com o modelo (Recomendado)").
Reescrito: 2026-11-14, decisão do usuário ("Os dois sempre").
Reescrito: 2026-11-15, texto: o corte junto com o modelo e o "nada no terminal" passam a ultracode.sai-junto-com-o-modelo, coberto por teste; aqui ficam a cor e o tema. A regra não muda.
Estado: checklist (cor e tema, no app)

### ultracode.sai-junto-com-o-modelo
Faltando espaço no cartão, "ultracode" sai junto com o modelo; no terminal, a palavra não aparece.

- Dado uma filha em ultracode, com o modelo publicado
- Quando o cartão é desenhado no app num painel largo, num estreito, e no terminal
- Então no largo o modelo e, depois dele, "ultracode" são desenhados; no estreito os dois saem juntos (nunca a palavra sem o modelo, nem o modelo sem a palavra), e seguem no texto alternativo do ícone; no terminal, nem o cartão nem o cabeçalho escrevem "ultracode"

Origem: decisão do usuário, 2026-11-10 ("Junto com o modelo (Recomendado)"); antes parte de ultracode.cor-e-corte.
Estado: coberto


### ultracode.subagente-sem-palavra
O cartão de subagente não diz "ultracode", mesmo com a sessão em ultracode.

- Dado uma sessão com o interruptor de ultracode ligado e um subagente lançado dela
- Quando o cartão do subagente é desenhado
- Então ele não tem a palavra "ultracode" (o estado do subagente não chega ao mod, e herdar o da sessão não é garantido); o cabeçalho segue com ela

Origem: decisão do usuário, 2026-11-10 ("Deixar sem (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Código: draw/layout.ts
Estado: coberto

### ultracode.guardado-por-sessao
A palavra "ultracode" fica guardada por sessão e volta com ela num processo novo.

- Dado uma sessão com o interruptor de ultracode ligado (também a que já estava ligada quando o mod recarregou)
- Quando o processo dela é refeito (/model, reinício, reabrir o app) ou ela é retomada
- Então "ultracode" já aparece no cabeçalho e no cartão dela, sem esperar o aviso seguinte do Claude Code; só o aviso de saída a apaga; o interruptor é guardado a cada aviso do Claude Code e a cada publicação do painel, e uma gravação que falhou é tentada de novo; a retomada traz o interruptor da sessão retomada (sem registro: desligado); o /clear não mexe nele. Risco aceito: se o ultracode for desligado com a sessão parada, a palavra volta ligada e fica errada até o Claude Code avisar a saída

Origem: decisão do usuário, 2026-11-15 ("Guardar por sessão"; ele aceitou o risco, dito na pergunta, de a palavra aparecer errada se o ultracode for desligado com a sessão parada). Não muda ultracode.so-o-interruptor-real: só o aviso do motor liga e desliga.
Código: hooks/panel.ts, hooks/session-start.ts, hooks/render.tsx, state/durability.ts
Reescrito: 2026-11-15, texto: o interruptor de uma sessão já ligada na recarga do mod também é guardado, e a gravação que falha é tentada de novo (revisão do lote, 2026-11-15); nenhuma regra muda e os testes existentes não mudam.
Estado: coberto

### ultracode.guardado-no-app
No app, a palavra guardada bate com o interruptor depois de /model e de reabrir.

- Dado o ultracode ligado numa sessão real
- Quando o modelo é trocado (/model), o app é fechado e reaberto, e depois o interruptor é desligado com a sessão parada
- Então a palavra segue no cabeçalho nos dois primeiros casos; no terceiro, anotar por quanto tempo ela fica errada e se o Claude Code avisa a saída ao processo novo

Origem: decisão do usuário, 2026-11-15 ("Guardar por sessão").
Código: hooks/panel.ts
Estado: checklist (o que o motor avisa a um processo novo não é simulado pelo harness)
