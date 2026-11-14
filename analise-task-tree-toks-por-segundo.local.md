# "n toks/s" no cartão da sessão (à esquerda do modelo)

Pedido: "dentro do painel de sessão, ao lado esquerdo do modelo rodando, coloque a contagem de
tokens por segundo de cada sessão, usando o padrão 'n toks/s' onde n é a quantidade de tokens".

## Decisões do usuário
- Sessão **parada**: mostra a **média do último turno**, apagada, até o próximo turno.
- Janela: **média móvel das chamadas ao modelo dos últimos ~10 s** do turno em curso.
- Também no **cabeçalho do painel da própria sessão** ("n toks/s" ao lado da contagem).

## Fonte do dado (kit de mods, build 2.1.308)
- O kit **não dá a vazão pronta**. `$.session.usage()` traz contexto, custo e limites de taxa
  (`SessionUsage`), sem tokens de saída por tempo. O que existe:
  - hook `turn.step` (já usado pelo mod em `hooks/turn.ts:36` para publicar o modelo): é um
    gerador que repassa os pedaços da resposta; o **resultado do passo** (`TurnStepResult.usage:
    TurnUsage | null`) traz `output_tokens` da chamada. O gerador vê o início (antes do
    `yield* next(e)`) e o fim (o valor devolvido), então mede a **duração** da chamada.
  - Assim, cada sessão mede a **própria** vazão: por chamada, `output_tokens / duração`.
- A mãe não enxerga os turnos das filhas; recebe o número pelo **arquivo publicado**
  (`~/.claude/task-tree-waits/<id>.json`, `io/publish.ts`), que ela já lê a cada 3 s
  (`refreshChildren` → `readFiles`), como faz com `engine` e `context.percent`.

## Cálculo (na sessão medida)
- Em `turnStep` (`hooks/turn.ts`), só no laço principal (`!e.agentId`): `t0 = $.clock.now()` antes
  do `yield* next(e)`; ao voltar, `r.usage?.output_tokens` e `t1`. Guardar amostras
  `{ at: t1, tokens, ms: t1 − t0 }` numa variável de módulo (as últimas 20).
- **Taxa do turno em curso**: soma dos tokens das amostras com `at ≥ agora − 10 s` ÷ soma dos
  `ms` delas (não ÷ 10 s: entre chamadas o modelo não gera, e a divisão pelo tempo de parede
  deixaria o número cair enquanto as ferramentas rodam). Se não há amostra nos últimos 10 s mas o
  turno segue, usar as últimas 3 amostras.
- **Média do último turno**: ao fim do turno (`turn.complete`, já em `hooks/turn.ts`), guardar
  `last = Σ tokens ÷ Σ ms` de todas as amostras do turno e zerar as amostras.
- Publicar no arquivo: `rate: { toks: number, at: number, live: boolean }` (`toks` inteiro
  arredondado; `live` = turno em curso). Publicar quando a amostra muda (o `publishPanel` já só
  grava quando o corpo muda; incluir `rate.toks` e `rate.live` na comparação, deixar `rate.at`
  fora, como `context.at`).
- Guardar também no `$.state` (chave nova `rate`, tabela de durabilidade `state/durability.ts`,
  `lives: 'state'`, sem store) para o cabeçalho da própria sessão e para sobreviver à recarga do
  mod no meio do turno.

## Desenho
- **Cartão da filha** (`draw/svg.ts`, `labelSvg`, ~linha 278): à esquerda de `r.engine` ("Fable 5.1
  · high"), o texto `"${toks} toks/s"` na mesma classe `s`, 11 px, `opacity .75` quando `live`,
  `.45` quando é a média do último turno (parada). Separador: o mesmo " · " ou um espaço de
  `RIGHT_GAP`. Só desenhar se couber (mesma conta de largura do `engine`). `Row.rate` novo, vindo
  de `Child.rate` (`io/host.ts` `readFiles` → `deriveChildren` → `Child`), e `rowAlt` inclui o
  texto.
- **Cabeçalho da própria sessão** (`headerSvg`, `score`): `"N de M · 100% · 1:45 · 99 toks/s"`,
  com o `rate` do `$.state`; apagado quando é a média do último turno.
- Terminal: mesmo texto no `tail` do cartão e no cabeçalho.
- Formato: `n` inteiro (`Math.round`), unidade **"toks/s"** exatamente como pedido; sem casa
  decimal; sem o texto quando nunca houve turno (`rate` ausente).

## Atualização
- A filha publica a cada chamada ao modelo concluída (poucas por minuto em geral; numa rajada de
  ferramentas, uma a cada poucos segundos) e no fim do turno. A mãe lê a cada 3 s: suficiente, o
  número já é uma média de 10 s. Nenhum tique novo.
- Versões antigas do arquivo sem `rate`: nada desenhado (`parsePublished` tolera o campo ausente).

## Plano
1. `hooks/turn.ts`: medir em `turnStep` (t0/t1, `usage.output_tokens`), amostras de módulo,
   `rate` no `$.state` e `publishPanel` quando mudar; `turnComplete`: fechar a média do turno
   (`live: false`).
2. `state/durability.ts`: linha `rate` (`lives: 'state'`). `io/publish.ts`: campo `rate` no corpo
   publicado e na comparação (sem `at`); `parsePublished` lê `rate` opcional.
3. `io/host.ts`: `Read.rates[id]` e `Child.rate` em `deriveChildren`; `types/index.d.ts`: tipos
   `Rate` em `Published` e `Child`.
4. `draw/layout.ts`: `Row.rate` no cartão (de `Child.rate`); `draw/svg.ts`: texto no `labelSvg`
   (à esquerda do modelo) e no `headerSvg`; `rowAlt`/alt do cabeçalho; terminal.
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual: filha
   trabalhando mostra "n toks/s" vivo ao lado do modelo e muda ao longo do turno; parada, mostra a
   média do último turno apagada; o cabeçalho da própria sessão mostra o seu.
