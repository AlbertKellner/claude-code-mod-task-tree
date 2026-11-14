# Carta e cartão sob a tarefa errada

Análise de 2026-11-09. Só leitura, sobre o HEAD 913aaf8 (lido com `git show`, porque a implementação
está escrevendo no clone). Clone intocado.
Pedido do usuário: "em paralelo, a sessõ de pesquisa na WEB abriu na tarefa errada".

## Resposta curta

Sem nada em andamento, o mod manda todo envio para a pendente planejada por último, e o empate vai para a
última na ordem. As duas tarefas nasceram no mesmo `plan`, empataram, e as duas cartas foram para a 18.2.
O `start` que veio depois não move nada.

O código segue a regra do catálogo, que é decisão do usuário de 2026-10-23. A regra não previu dois envios
seguidos com várias pendentes do mesmo plano. **É lacuna de regra, e o ajuste precisa da decisão dele.**

**Proposta:** no empate, cada envio vai à primeira pendente ainda sem carta, na ordem do plano. Quatro
linhas em `hooks/panel.ts`. Testado numa cópia: o caso fica certo e nenhum teste quebra.

## Como o mod escolhe hoje

`sendAnchor` em `task-tree/hooks/panel.ts:197`, chamada no `SendMessage` (`hooks/tool-call.ts:115`) e na
abertura de sessão (`hooks/sessions.ts:206`). A escolha é feita uma vez, na hora do envio, e fica gravada
na carta (`sends`) e na rodada do cartão (`rounds`).

| Situação na hora do envio | Tarefa escolhida | Regra |
|---|---|---|
| Uma em andamento | Ela | regra geral |
| Várias em andamento | A primeira do lote recente de starts ainda sem carta, na ordem | `envios.ancora-no-lote-recente` ("pela ordem") |
| Nenhuma em andamento, com pendentes no pedido atual | A pendente planejada por último; no empate, a última na ordem | `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo` |
| Nenhuma em andamento nem pendente | A última iniciada | a mesma |

O caso do usuário cai na terceira linha. `plannedAt` é igual nas duas, o `reduce` com `>=` fica com a
última, e o segundo envio repete a conta, porque esse ramo não olha onde as cartas anteriores foram
(`used` só é usado no ramo de várias em andamento).

Nenhum teste cobre o empate: o teste da regra tem uma pendente só.

## Reprodução

Cópia do HEAD em
`<scratchpad>\carta\task-tree`,
teste `tests/zz-carta.test.ts`: plano com duas filhas, dois envios, depois `start` nas duas.

Hoje:

```
└─ ◉ Investigar  0/2
   ├─ ◉ Pesquisa web: changelog
   └─ ◉ Implementação: ler o código  ◍  0/1
      ├─ ✉ Para x: oi  na fila
      ├─ ✉ Para y: oi  na fila
```

Com o ajuste da opção A (133 passam, 0 falham):

```
   ├─ ◉ Pesquisa web: changelog  ◍  0/1
   │  ├─ ✉ Para x: oi  na fila
   └─ ◉ Implementação: ler o código  ◍  0/1
      ├─ ✉ Para y: oi  na fila
```

## Opções

### A (recomendada): no empate, pela ordem, uma carta por pendente

Entre as pendentes planejadas por último (mesmo `plannedAt`), o envio vai à primeira ainda sem carta
desta sessão. Todas com carta: a última, como hoje. É a mesma lógica do "pela ordem" que o usuário já
decidiu para várias em andamento.

```ts
if (newest) {
  const batch = pending.filter(t => (t.plannedAt ?? -Infinity) === (newest.plannedAt ?? -Infinity))
  const free = batch.find(t => !used.some(u => u.anchor === t.id))
  return (free ?? newest).id
}
```

- Mantém "a última planejada": uma tarefa planejada depois continua ganhando das antigas.
- Muda só o desempate. Um envio único, com várias pendentes do mesmo plano, passa a ir à primeira
  ("Delegar, Conferir, Relatar" sem start: hoje vai a "Relatar", passaria a "Delegar").
- Vale igual para o cartão de sessão aberta com `start_session`, que usa a mesma função.
- Limite: acerta quando a ordem dos envios é a ordem do plano. Se o modelo envia fora de ordem, erra.

### B: casar o destinatário com o título

Se o nome da sessão destino ("pesquisa-web") casa com o título de uma única tarefa candidata ("Pesquisa
web: …"), ela ganha. No caso real casaria as duas ("implementacao" e "Implementação", sem acento e sem
hífen). Cobre o envio fora de ordem, mas é heurística: depende de o título repetir o nome da sessão, e o
nome só existe depois que o app lista a sessão (uma recém-aberta ainda aparece como "Sessão…"). Pode
somar à A como critério anterior ao desempate; sem casamento único, vale a A.

### C: reatribuir quando o start vem logo depois

Não recomendo. O `start` não diz a qual envio se refere: no caso real, as duas tarefas foram iniciadas
juntas, e a reatribuição teria de adivinhar a mesma ordem que a A já usa. Além disso, a carta e o cartão
mudariam de lugar depois de desenhados.

### D: aviso do hook ao modelo

O `SendMessage` que sai sem tarefa em andamento e com mais de uma pendente devolve um lembrete dizendo
sob qual tarefa a carta ficou. Sozinho não resolve, porque o modelo não tem como mover a carta. Com a A
vira só informação; fica como opcional.

### Regra de uso em `text/rules.ts`

Hoje (linhas 55 a 62) a regra do `start_session` manda dar `start` antes de abrir a sessão, e a do
`SendMessage` não diz nada. Proposta de texto, somando à regra da carta:

> antes de enviar, marque com start a tarefa a que a mensagem pertence; com vários envios na mesma
> resposta, dê start em todas antes do primeiro envio.

É complemento, não a correção: pela regra do projeto, o painel tem de acertar mesmo sem o start.

## Perguntas ao usuário

1. Opção A, que muda o desempate da decisão de 2026-10-23 ("Várias pendentes: a última planejada")?
   Recomendo que sim.
2. Somar a B, o casamento do nome da sessão com o título? Recomendo deixar para depois, se a A errar na prática.
3. O envio único com várias pendentes do mesmo plano passa à primeira, em vez da última. Aceita? Recomendo
   que sim: a primeira pendente é o próximo passo.

## Catálogo

Reescrever `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo` em `regras/envios.md`:

- Dado nada em andamento no pedido atual
- Quando sai uma mensagem
- Então ela vai à pendente planejada por último; com várias planejadas juntas, à primeira delas ainda sem
  carta, na ordem do plano; sem pendente, à última iniciada
- `Reescrito: 2026-11-09`, com as palavras da decisão dele sobre a opção A

Os dois testes atuais da regra continuam passando sem mudança (conferido na cópia).

Testes novos em `tests/envios.test.ts`, selados com `--tipo novo`:
- dois envios sem start, duas pendentes do mesmo plano: cada carta sob a sua tarefa, e o `start` depois não muda;
- um envio, três pendentes do mesmo plano: a carta vai à primeira;
- pendente planejada depois, num plano seguinte: o envio vai a ela, e não à primeira do plano antigo.

Se o texto de `rules.ts` mudar: `lembretes.regras-no-prompt-de-sistema` é o cenário que o cobre.

## `npm run impacto -- hooks/panel.ts text/rules.ts`

```
Cenários afetados (59):
  envios.ancora-no-lote-recente                             coberto  tests/envios.test.ts: 3 testes
  envios.sem-andamento-vai-a-pendente-planejada-por-ultimo  coberto  tests/envios.test.ts: 2 testes
  envios.carta-sob-a-tarefa                                 coberto  tests/envios.test.ts: 1 teste
  lembretes.regras-no-prompt-de-sistema                     coberto  tests/lembretes.test.ts: 1 teste
  (os outros 55 são da área, sem relação direta)
Checklist do app: nenhum
Golden: nenhum cenário
Fora do mapa: nenhum
```

Na cópia, os 3 golden passaram com o ajuste.

## Não verificado

- O painel publicado da orquestradora: não conferi os `plannedAt` reais da 18.1 e da 18.2. A reprodução
  no harness dá o mesmo desenho que ela descreveu.
- O caso real já gravado não se corrige sozinho: as cartas e as rodadas da 18.2 ficam onde estão.
