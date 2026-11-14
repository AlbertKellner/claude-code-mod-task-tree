# Cartão da filha parado com pendentes na orquestradora

Análise de 2026-11-04. Só leitura; nada foi alterado no clone (HEAD 2c4c02c).
Pedido do usuário: "entao pq esse card de plano esta parado? analise se é um bug do mod, ou se podemos
fazer melhoria. ele ja deveria estar encerrado".

## Resposta curta

**São duas coisas.**

1. **Melhoria (lacuna de regra):** o cabeçalho em "83%, 10 de 12" e o chip "2 pendentes" não contrariam
   nenhuma regra. O catálogo manda exatamente isso. Falta à regra uma saída: hoje nada diz quando uma
   pendente de filha parada deixa de valer, se nenhuma mensagem nova chegar.
2. **Bug (reproduzido):** uma rodada que o painel já descartou continua segurando a visão resumida. Um
   pedido novo da mãe não limpa o painel, por causa de uma pendente que nem conta mais.

**Proposta:** a pendente sai da contagem quando a filha está parada, sem nada iniciado aberto, e a tarefa
de origem na mãe já fechou. Calculado no desenho, sem estado novo, então ela volta sozinha se a filha
retomar. Decisão do usuário abaixo.

**Atenção à reprodução:** a mensagem que pediu esta análise já mudou o caso. Ela abriu uma rodada nova, e
pelo teste a rodada do colapso virou descartada: o cabeçalho deve ter saído do "83%" e o chip deve ter
sumido, com as 3 ✓ dela saindo junto. O cartão "parada" fica. Falta conferir no app; é uma previsão.

## 1. O que acontece hoje

| Situação | Pendentes (○) | Iniciada aberta | Conta no cabeçalho? | Regra |
|---|---|---|---|---|
| Subagente termina | ✕ | ✕ | Fora do total, no chip "interrompidas" | `turnos.subagente-que-termina-interrompe` |
| Filha arquivada | ✕ | ✕ | Fora do total | `sessoes.filha-arquivada-interrompe` |
| Filha termina o turno | ○ | ◷ | **Sim, e entra no chip "pendentes"** | `sessoes.filha-parada-pendentes-seguem-pendentes` |
| Filha parada com Esc, com algo aberto | ○ | ✕ | Rodada inteira fora, ✓ inclusive | `sessoes.rodada-descartada-fora-da-contagem` |
| Mensagem nova abre outra rodada | ○ | ◷ | Rodada anterior inteira fora, ✓ inclusive | a mesma |

A regra do subagente não se aplica à filha, e a diferença é deliberada. O subagente acabou de vez; a filha
pode voltar. O usuário decidiu em 2026-10-27, "pendentes nunca ✕", depois de ver quatro passos nunca
iniciados virarem "✕ interrompida" com o cabeçalho em "Passo 2 · 2 de 2 · 100%". O motivo registrado em
DESENVOLVIMENTO é que "o plano continua no próximo turno". Essa premissa falha quando não há próximo turno.

No caso real, publicado em `local_0c961c71-fcda-4fe0-acad-3d0fd66fa806.json`: "Colapso: em espera de novo
pedido" e 1.1 e 1.2, do turno 43, abertas e nunca iniciadas. A tarefa de origem na mãe, "99/99.3 Depois:
analisar o colapso", está ✓, e o pedido 99 também. Ou seja, a mãe parou de esperar, e a filha não tem como
saber.

## 2. Bug ou lacuna

**Contagem e cartão: lacuna.** O código em `discarded` e `panelOf` (`draw/layout.ts:117` e `:131`) faz o que
a regra diz, e o comentário em `layout.ts:115` diz que isso é intencional. O teste protegido
`filha parada: a iniciada aguarda e as pendentes seguem pendentes` afirma esse comportamento. Mudar exige
decisão do usuário registrada no catálogo.

**Visão presa: bug.** `openInSight` (`draw/layout.ts:668`, chamada em `hooks/panel.ts:580`) olha a filha
inteira, sem separar as rodadas e sem `discarded`. Já `alive`, logo abaixo, exclui a rodada descartada. O
usuário disse que essas tarefas "foram descartadas", então elas não deveriam contar como "algo aberto à
vista". A correção não desfaz decisão nenhuma.

Efeito medido no teste: depois de a rodada ser descartada e os pedidos seguintes fecharem, "Pedido tres"
continua com "Um" à vista e o total em 4, quando deveria ser 1. No app, o `work` publicado da orquestradora
tem hoje 34 tarefas de nível 1 (88 a 116). Isso combina com o bug, mas não provei que ele é a causa de todas:
a pendente da análise é recente, e o acúmulo vem de antes dela. Pode haver outras razões históricas.

**Detalhes menores:**
- O comentário em `layout.ts:115` diz "its 3/5 reads 3/3", o que não vale mais.
- A linha do pedido dentro do cartão aparece ◷ com ○ embaixo e nada iniciado ("◷ turno 1  2/3" no teste).
  Pode ser o certo, porque o pedido parou no meio; fica para o usuário olhar.

## 3. Proposta

Na correção do bug, `openInSight` passa a ignorar a rodada descartada. Vale em qualquer das opções abaixo.

### Opção A (recomendada): origem fechada

A pendente deixa de contar quando tudo isto vale:
- a filha não está trabalhando, nem esperando a pessoa, nem arquivada, nem abrindo;
- não há nada iniciado aberto no cartão (só ○);
- não há mensagem da mãe na fila para ela;
- a tarefa de origem do cartão na mãe está fechada.

| Pergunta | Resposta |
|---|---|
| Cabeçalho | As ○ saem do total e do chip. As ✓ continuam contando: é trabalho feito. O caso do print vira "10 de 10 · 100%" |
| Cartão | Continua desenhado, com as ○ como estão. Palavra nova, "encerrada", no lugar de "parada" |
| Visão resumida | Deixa de segurar o pedido |
| Se a filha retomar | Nada a desfazer: é calculado no desenho. Trabalhando ou com `start`, ela volta a contar. Mensagem nova abre rodada, e a regra atual segue valendo |
| Filha à espera de sinal | Fica como hoje enquanto tiver tarefa iniciada ◷ ou a origem aberta |

**Limites que o usuário precisa conhecer:**
- Uma filha à espera só com ○, sem nada iniciado, e com a origem já fechada sai da contagem até o sinal
  chegar. A mãe fecha cedo tarefas como "Delegar à Governança", e o painel conclui sozinho a tarefa de um envio
  confirmado. Então "origem fechada" não prova que ninguém espera. O erro é visual e se desfaz sozinho.
- Pelo mesmo motivo, uma filha que parou no meio de um plano pode dar 100% na mãe, parecido com o
  "2 de 2 · 100%" de 2026-10-27. A diferença é que o cartão segue à vista com as ○. Para cobrir isso, o
  lembrete à mãe (`SESSION.ended`, hoje só com a origem aberta) pode avisar também "parou com N pendentes".
- Neta dentro de cartão não passa pelo `split` na contagem, então a regra vale só para a filha direta.

### Opção B: só por ação do usuário

Botão "Encerrar" no cartão, gravando o id na mãe. Nunca erra e dá controle, mas não atende "ele ja deveria
estar encerrado": o usuário teria de clicar em cada cartão. Custa um estado novo (state e store), um
`Button` sobreposto e um item no checklist do app. Pode ser somado à A depois.

### Opção C: por tempo

Sai da contagem depois de N minutos parada só com ○. É a mais simples de explicar, mas o número é arbitrário,
erra nas esperas longas e legítimas (a análise já ficou dias parada entre pedidos, e isso é normal) e depende
de redesenho, que uma sessão parada não tem. Não recomendo.

**Descartada:** tirar as ○ da contagem assim que a filha para. Isso repete o "100%" de 2026-10-27.
**Hoje, sem mudar nada:** arquivar a filha resolve (○ vira ✕), mas tira de uso uma sessão reaproveitada.

### Perguntas ao usuário

1. Opção A, B ou C?
2. Com a A, as ○ ficam como ○ (recomendado, "pendentes nunca ✕") ou viram outra marca?
3. Com a A, a palavra muda para "encerrada" (recomendado) ou segue "parada"?
4. Com a A, as ✓ da filha seguem contando (recomendado)? Na rodada descartada elas saem, por decisão de
   2026-10-24; aqui ficariam, e as duas regras passam a diferir. É isso que dá 10 de 10.

## 4. Catálogo, testes e impacto

**Bug (sem decisão pendente):** reescrever `pedidos.resumida-mantem-anteriores-com-algo-aberto`, acrescentando
"uma rodada descartada não conta como algo aberto"; teste novo em `tests/cabecalho.test.ts`, onde está o teste dessa regra.

**Opção A, cenário novo em `regras/sessoes.md`:**

- Id: `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`
- Dado uma filha parada só com pendentes, sem nada iniciado aberto e sem mensagem na fila
- Quando a tarefa de origem do cartão na mãe está fechada
- Então as pendentes saem do cabeçalho, do chip e do x/y do pai, e não seguram a visão; as ✓ seguem contando;
  o cartão fica desenhado, com a palavra "encerrada"; se a filha voltar a trabalhar, tudo volta a contar
- Estado: `pendente (tests/sessoes.test.ts)`

**Reescrever, com as palavras da decisão:**
- `sessoes.filha-parada-pendentes-seguem-pendentes`: acrescentar "com a tarefa de origem aberta ou algo iniciado".
  O teste selado atual tem a origem aberta, então deve continuar passando sem mudança.
- `sessoes.palavra-de-estado-do-cartao`: acrescentar "encerrada".

**Testes novos em `tests/sessoes.test.ts`:**
- origem fechada e só ○: 100%, sem chip, palavra "encerrada", ○ à vista;
- origem aberta: segue "parada" e conta;
- origem fechada com ◷: segue "parada" e conta;
- filha que retoma: volta a contar;
- mensagem na fila: segue contando.

**No app (checklist):** cartão "encerrada" nos dois temas, e o cabeçalho verde.

### Reprodução

`<scratchpad>\cartao\task-tree\tests\zz-cartao.test.ts`,
sobre uma cópia do HEAD: 129 testes, 0 falhas. Os 5 testes novos afirmam o comportamento atual:

| Teste | Resultado |
|---|---|
| Origem fechada, filha parada só com pendente | "parada", ○, 3 de 4 · 75%, chip 1 |
| Mensagem nova | Rodada antiga fora: 3 de 3, sem chip; o cartão fica "parada" |
| Controle: filha com tudo feito, pedido novo | Visão limpa, total 1 |
| Com pendente, pedido novo | Visão não limpa, total 5 |
| Rodada já descartada, pedido seguinte | Visão não limpa, total 4 (o bug) |

### `npm run impacto -- draw/layout.ts hooks/panel.ts`

```
Cenários afetados (83):
Checklist do app: cabecalho.aviso-de-painel-grande-volta
Golden: visual.desenho-principal, visual.desenho-cartao-filha, visual.desenho-envios
Fora do mapa: nenhum
 pedidos.resumida-mantem-anteriores-com-algo-aberto coberto task-tree/tests/cabecalho.test.ts: 1 teste
 sessoes.palavra-de-estado-do-cartao coberto task-tree/tests/sessoes.test.ts: 3 testes
 sessoes.filha-parada-pendentes-seguem-pendentes coberto task-tree/tests/sessoes.test.ts: 1 teste
 sessoes.rodada-descartada-fora-da-contagem coberto task-tree/tests/sessoes.test.ts: 2 testes
 sessoes.rodada-descartada-fora-da-contagem-do-pai coberto task-tree/tests/sessoes.test.ts: 1 teste
 sessoes.cartao-vivo-nunca-some coberto task-tree/tests/sessoes.test.ts: 1 teste
```
