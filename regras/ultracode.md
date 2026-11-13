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
- Então "ultracode" aparece na linha do tempo e do toks/s, depois deles (o cabeçalho não desenha o modelo)

Origem: decisão do usuário, 2026-11-10 ("Cabeçalho do painel, Cartão de subagente"); a posição, junto do toks/s, derivada (o cabeçalho não tem modelo).
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Código: hooks/render.tsx
Estado: coberto

### ultracode.cor-e-corte
A palavra tem a cor do rótulo "Ultracode on" do app e sai junto com o modelo.

- Dado uma filha em ultracode
- Quando o cartão é desenhado no app desktop, nos dois temas
- Então "ultracode" fica em roxo sólido, #AF87FF no escuro e #8700FF no claro (o effortUltra do app), sem brilho animado; faltando espaço, sai junto com o modelo; nada no terminal

Origem: decisão do usuário, 2026-11-10 ("Roxo sólido (Recomendado)"; "Junto com o modelo (Recomendado)").
Estado: checklist (cor e tema, no app)


### ultracode.subagente-sem-palavra
O cartão de subagente não diz "ultracode", mesmo com a sessão em ultracode.

- Dado uma sessão com o interruptor de ultracode ligado e um subagente lançado dela
- Quando o cartão do subagente é desenhado
- Então ele não tem a palavra "ultracode" (o estado do subagente não chega ao mod, e herdar o da sessão não é garantido); o cabeçalho segue com ela

Origem: decisão do usuário, 2026-11-10 ("Deixar sem (Recomendado)").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Código: draw/layout.ts
Estado: coberto
