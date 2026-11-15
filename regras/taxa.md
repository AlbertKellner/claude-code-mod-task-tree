# Taxa

O "n toks/s" do cabeçalho, do cartão da filha e do cartão de subagente.

Código da área: hooks/turn.ts, hooks/agents.ts, draw/desktop.tsx, draw/head.tsx, draw/svg.ts, draw/layout.ts, io/publish.ts, io/host.ts

### taxa.velocidade-de-geracao
O toks/s é a velocidade de escrita da resposta, do primeiro chunk ao 'stop'.

- Dado um passo do modelo
- Quando o stream chega, do primeiro chunk ao 'stop' com os tokens de saída
- Então toks/s = tokens / tempo entre o primeiro chunk e o 'stop', arredondado; o tempo antes do primeiro chunk não entra; o número é o do último passo válido

Origem: decisão do usuário, 2026-11-10 ("Medir como o Savvy"; "Última resposta (Recomendado)").
Estado: coberto

### taxa.filtros
Um passo curto demais, ou rápido demais, não muda o número.

- Dado um passo com menos de 20 tokens, ou menos de 0,5 s, ou mais de 1000 toks/s
- Quando ele termina
- Então o número anterior fica

Origem: decisão do usuário, 2026-11-10 ("Sim, iguais (Recomendado)").
Estado: coberto

### taxa.fim-do-turno-fica-aceso
No fim do turno, o último número fica aceso.

- Dado um número medido no turno
- Quando o turno termina (com ou sem passo válido nele)
- Então o último número válido fica, aceso, sem esmaecer e sem "(último turno)"; o número de uma filha em versão anterior do mod, publicado como média do último turno, também aparece aceso

Origem: decisão do usuário, 2026-11-10 ("Fica aceso"); turno sem passo válido: o número anterior fica (derivado de "Fica aceso").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Reescrito: 2026-11-15, texto: aplica "Fica aceso" (2026-11-10) à taxa lida de uma filha em versão anterior do mod; saem do desenho os restos da medida antiga. Os testes existentes não mudam.
Código: draw/head.tsx
Estado: coberto

### taxa.subagente-mesma-medida
O cartão de subagente mede igual.

- Dado um subagente com passos do modelo
- Quando termina um passo válido
- Então o cartão mostra a velocidade dele pela mesma regra

Origem: decisão do usuário, 2026-11-10 ("Sim, todos (Recomendado)").
Estado: coberto

### taxa.passo-nao-cai-com-o-painel
Uma falha do painel antes ou depois do stream não derruba o passo do modelo.

- Dado uma falha ao ler ou gravar o modelo, a taxa ou o cartão do subagente
- Quando o passo do modelo roda
- Então a resposta passa inteira, a falha fica no log de depuração, e o passo seguinte volta a medir

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: as leituras e escritas em volta do stream não tinham proteção).
Estado: coberto

### taxa.fluxo-encerrado-quando-o-consumo-para
Quando a resposta é interrompida no meio, o painel encerra o fluxo que ele repassava.

- Dado um passo do modelo com o stream pela metade
- Quando quem consome o stream para (Esc no meio da resposta)
- Então o fluxo de baixo é encerrado por este hook, e o último toks/s válido fica como estava

Origem: auditoria 2026-11-10 (triagem de 2026-11-15: o laço não tinha `finally`).
Estado: coberto

### taxa.esc-no-meio-da-resposta
No app, o Esc no meio de uma resposta para a resposta e não deixa o painel preso.

- Dado uma resposta longa em curso, no app desktop
- Quando a pessoa aperta Esc
- Então a resposta para, o painel mostra o turno parado (a tarefa em andamento ✕) e o toks/s fica no último valor válido

Origem: auditoria 2026-11-10 (triagem de 2026-11-15); o harness não para um stream real.
Código: hooks/turn.ts
Estado: checklist (o harness não simula o Esc no meio de um stream real)
