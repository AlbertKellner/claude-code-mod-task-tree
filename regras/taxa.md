# Taxa

O "n toks/s" do cabeçalho, do cartão da filha e do cartão de subagente.

Código da área: hooks/turn.ts, hooks/agents.ts

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
- Então o último número válido fica, aceso, sem esmaecer e sem "(último turno)"

Origem: decisão do usuário, 2026-11-10 ("Fica aceso"); turno sem passo válido: o número anterior fica (derivado de "Fica aceso").
Reescrito: 2026-11-13, decisão do usuário ("migrar todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): o teste lê o texto do cabeçalho e da linha no app: o que mostram e o texto alternativo dos `Svg`, não mais o `alt` de uma imagem; a regra não muda.
Estado: coberto

### taxa.subagente-mesma-medida
O cartão de subagente mede igual.

- Dado um subagente com passos do modelo
- Quando termina um passo válido
- Então o cartão mostra a velocidade dele pela mesma regra

Origem: decisão do usuário, 2026-11-10 ("Sim, todos (Recomendado)").
Estado: coberto
