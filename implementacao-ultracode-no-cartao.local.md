# Implementação: "ultracode" ao lado do modelo (2026-11-10)

Commit local a626124 na branch feat/ultracode-no-cartao (criada de origin/main). Sem push, sem PR. O check passou: 163 testes, regressão 160/0. O golden não mudou.

## O que foi feito
- O hook `prompt.attachment` em `ultra_effort_enter` e `ultra_effort_exit` (`hooks/turn.ts` `ultraAttachment`, registrado em `register.tsx`) grava o state `ultracode`. Só vale o loop principal: o que tem `agentId` é ignorado. A linha correspondente está em `state/durability.ts`.
- `ultracode` é publicado ao lado de `engine` (`panel.ts`, `io/publish.ts`), e a mãe o lê em `io/host.ts` (Read.ultras → Child.ultracode). O campo `ultracode` foi acrescentado a Published, Child, Row e ao state.
- No cartão, a palavra fica à direita do modelo, com a classe `ul` em #8700FF no claro e #AF87FF no escuro. Modelo e palavra são um bloco só e saem juntos no corte. O alt diz "…, ultracode".
- No cabeçalho, ele não desenha o modelo, então a palavra vai na linha do tempo e do toks/s, depois deles. O bloco dos números alarga para caber a palavra. Em painel estreito (<600 px) ela sai, como o toks/s. A palavra também entra no alt.
- No terminal, nada.
- Catálogo novo em `regras/ultracode.md`:
  - 3 cenários cobertos: cartao-da-filha, so-o-interruptor-real e cabecalho;
  - 1 checklist: cor-e-corte.
- Testes em `tests/ultracode.test.ts`, 3 selados como novos.
- Uma revisão adversarial com workflow (2 agentes) achou que, no cabeçalho, a palavra invadia a barra e as pílulas. Corrigido antes do commit, alargando o bloco.

## Parado: cartão de subagente
O engine só injeta `ultra_effort_*` no loop principal. O estado de ultracode de um subagente não chega ao mod, e "herda da sessão" não é garantido (o `Pg` usa o mainLoopModel). Não implementei e não criei cenário. Isso precisa de uma decisão: mostrar o da sessão no subagente, ou deixar sem.

## Não verificado
- Que o attachment chega de fato ao hook no app real. O harness passa.
- A cor nos dois temas e o corte com pouco espaço: checklist no app. Abra uma filha com `/effort ultracode on` e outra sem, nos dois temas, e veja também o cabeçalho.
- A palavra só aparece no primeiro turno depois de ligar, quando o engine manda o `enter`.
