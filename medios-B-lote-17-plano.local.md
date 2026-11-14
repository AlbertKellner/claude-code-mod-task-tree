# Lote 17: faixa âmbar com só a filha trabalhando, texto do cenário

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). Nenhum arquivo do mod muda: só catálogo e um teste.

## 1. O que cobre

- Achado: "Faixa e chips do cabeçalho divergem do que a árvore mostra: … âmbar por tarefa da filha", a
  segunda pergunta.
- Decisão 30 (B), 2026-11-14: "Âmbar, como hoje". Texto da opção: "o texto do cenário é corrigido para
  dizer que a tarefa iniciada da filha conta como 'em andamento'." Nota da orquestradora: "corrigir o
  texto do cenário de 2026-11-03".

## 2. Causa confirmada na ponta

- `hooks/render.tsx:279-288`: as tarefas que as linhas desenhadas representam incluem as dos cartões das
  filhas; `active` conta as folhas abertas com o relógio correndo entre todas elas. Uma tarefa iniciada
  da filha entra em "em andamento".
- `draw/svg.ts:221-224` (`headerState`): com `active > 0` o estado é "em andamento" (âmbar), antes de
  "sessão ativa" (azul).
- `regras/visual.md`, `visual.faixa-de-estado-geral`: o Então diz "azul com só uma sessão filha
  trabalhando", sem a condição. O teste selado do azul (`tests/visual.test.ts:29-47`) usa uma filha sem
  tarefa iniciada e diz no comentário "uma iniciada dela já conta 'em andamento' no cabeçalho".

O código e o teste já fazem o que a resposta pede; só o texto do cenário diverge.

## 3. O que muda

Nada no código. O cenário passa a dizer o que acontece, e um teste novo fixa o lado âmbar:

- com tudo desta sessão concluído e a filha trabalhando numa tarefa iniciada dela, à vista no cartão: a
  faixa é âmbar "em andamento", e o chip "em andamento" conta a tarefa da filha;
- azul "sessão ativa" só quando a filha trabalha sem tarefa iniciada dela à vista.

O outro ponto da mesma pergunta (a tarefa de origem ◉ por causa da filha, com o turno terminado, entra
no chip "aguardando") também fica como hoje; não ganha texto novo.

## 4. Impacto

Nenhum arquivo do mod tocado. Cenário de texto alterado: `visual.faixa-de-estado-geral`.

## 5. Testes

Novo, em `tests/visual.test.ts`. Passa hoje (fixa a decisão):

1. "com tudo desta sessão concluído e a filha trabalhando numa tarefa iniciada dela, a faixa é âmbar, em
   andamento". Cenário `visual.faixa-de-estado-geral`. Roteiro: host com uma filha (id `local_<uuid>`)
   que publica uma tarefa aberta e iniciada (`status: 'open', started: 1, startedAt: AGORA - 1000`, como
   no golden `filha`); pedido; plan `UM`; start; `abrirSessao`; `aviso`; done em "Um". Afirma: `faixa`
   igual a "em andamento"; o cabeçalho do app contém "1 em andamento" e "1 sessão ativa".

Testes existentes: nenhum muda.

## 6. Catálogo e selos

`regras/visual.md`, `visual.faixa-de-estado-geral`: no Então, trocar "azul com só uma sessão filha
trabalhando" por "azul com só uma sessão filha trabalhando sem tarefa iniciada dela à vista; com uma
tarefa iniciada da filha à vista no cartão, âmbar, porque ela conta como 'em andamento'". Linha nova:
`Reescrito: 2026-11-14, decisão do usuário ("Âmbar, como hoje"): a tarefa iniciada da filha conta como
"em andamento" no cabeçalho; o azul fica para a filha sem tarefa iniciada à vista. Os testes existentes
deste cenário não mudam.`

Selo:

    npm run regras:selar -- "task-tree/tests/visual.test.ts::com tudo desta sessão concluído e a filha trabalhando numa tarefa iniciada dela, a faixa é âmbar, em andamento" --tipo novo --motivo "decisão do usuário, 2026-11-14: Âmbar, como hoje"

## 7. Documentação

`DESENVOLVIMENTO.md`: no item "Cabeçalho V4", onde o azul é descrito, a mesma frase com as palavras e a
data. O comentário de `headerState` (`draw/svg.ts:215-219`) diz "a session at work (blue) with nothing of
its own running": acertar para "with nothing running, of its own or drawn in a session's card" fica para
o lote 16, que já mexe nesse comentário; se o lote 16 não tiver entrado, este lote não toca `draw/svg.ts`.
`CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada novo.

## 10. Dependências e conflitos

- Depois do lote 16 (mesmo cenário, outra frase do Então; juntar as duas linhas `Reescrito`, cada uma com
  a sua decisão).
- Triagem A, decisão 15 ("Rodada fora da conta (Recomendado)") e decisão 17 ("Só o próprio"): mexem no
  que as linhas de um cartão representam na contagem; se as tarefas de uma filha deixarem de entrar nos
  `nodes` em algum caso, o teste novo daqui acusa, e a decisão 30 ("como hoje") é a que vale para a
  tarefa iniciada da filha trabalhando.

## 11. Bloqueio

Nenhum.
