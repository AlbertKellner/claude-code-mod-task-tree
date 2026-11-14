# Lote 16: rodada da frente pelo tempo; chip de sessões conta a sessão uma vez

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (duas correções diretas na divisão dos cartões por rodada, em `draw/layout.ts`).

## 1. O que cobre

- Achado "Turno digitado pelo usuário na filha é sempre tratado como a rodada mais antiga: cartão da
  frente errado e rodada mais nova descartada". Correção direta.
- Achado "Cartão de rodada descartada é desenhado como "trabalhando" ou "parada" e conta como sessão no
  cabeçalho": a **parte direta** (a contagem dupla no chip de sessões). A palavra do cartão largado é a
  decisão 12, no lote 19.
- Nenhuma decisão nova. Cumprem `sessoes.rodada-descartada-fora-da-contagem` (2026-10-28: "a rodada
  descartada é a anterior, não a que está trabalhando") e `sessoes.turno-proprio-da-filha-no-pedido-vigente`
  (2026-11-03).

## 2. Causa confirmada na ponta atual

Escrito no código, `draw/layout.ts`, `split`:
- `layout.ts:404-407`: o turno digitado na filha recebe uma parte de chave negativa (`-1 - índice`);
- `layout.ts:430`: as partes são ordenadas pela chave, então as digitadas vêm sempre antes das rodadas
  da mãe (chave 0 em diante);
- `layout.ts:436-437`: a rodada da frente (`lead`) é a última, nessa ordem, com tarefa aberta e iniciada;
  sem nenhuma, a de maior chave. Sem tarefa iniciada, a frente é sempre uma rodada da mãe;
- `layout.ts:156-161` (`discarded`): a parte que não é a da frente e ficou com tarefa aberta é rodada
  descartada: fora do cabeçalho, dos chips e do que mantém o pedido à vista;
- `layout.ts:474`: todo cartão com tarefa aberta de uma sessão rodando fica `running`, e `layout.ts:1276`
  põe `live` na linha de cada um; `hooks/render.tsx:294` conta as linhas `live` no chip "sessões ativas".

Dedução:
- a mãe manda uma mensagem (rodada toda ✓); depois a pessoa digita direto na filha, que conclui uma
  tarefa, deixa outra pendente e termina o turno: o cartão "pedido do usuário na filha", o trabalho mais
  recente, é lido como rodada descartada. O mesmo em todo intervalo entre um done e o start seguinte
  desse turno, com a filha rodando;
- uma filha rodando com uma rodada antiga deixada com tarefa aberta: dois cartões `live`, e o chip diz
  "2 sessões ativas" para uma sessão.

## 3. O que muda

Só `draw/layout.ts`.

1. Em `split`, a rodada da frente passa a ser escolhida pelo instante em que cada parte começou, não
   pela chave: a parte mais recente com tarefa aberta e iniciada; sem nenhuma, a parte mais recente.
   O começo de cada parte: a mensagem da rodada (`rounds[k - 1].at`) para as rodadas da mãe e das irmãs;
   o `at` do turno para a parte digitada; o primeiro turno dela para a parte 0 (sem hora, antes de
   todas). Empate: a ordem de hoje (a chave).
   As chaves das partes não mudam (a dobra e a posição do cartão dependem delas, e elas entram no golden).
2. Em `session`, a linha do cartão só leva `live` quando o cartão é o da frente da sessão (ou a sessão não
   foi dividida em rodadas). O cartão de uma rodada antiga segue desenhado como hoje; só deixa de
   contar como uma sessão a mais no chip e no estado geral do cabeçalho.

Comportamento novo no painel:
- o cartão "pedido do usuário na filha" mais recente vale como a rodada atual: as tarefas dele contam no
  cabeçalho e nos chips, e o pedido onde ele está segue à vista enquanto a filha trabalha nele;
- uma sessão rodando conta 1 em "sessões ativas", com um ou vários cartões.

## 4. Impacto

`npm run impacto -- draw/layout.ts`: 110 cenários (subagentes 23, sessoes 22, turnos 14, cabecalho 14,
visual 9…). Checklist por mapa: `envios.destino-arquivado-no-app`, `subagentes.*-no-app`,
`ultracode.cor-e-corte`. Golden: os 4 cenários; ver 8.

## 5. Testes a escrever

`tests/sessoes.test.ts`:
1. Regra `sessoes.rodada-da-frente-e-a-mais-recente` (nova):
   **"o turno digitado na filha depois da rodada da mãe é a rodada atual: conta no cabeçalho, parado ou
   entre um done e o start seguinte"**. Roteiro (como `abrirNoPedidoAntigo`, com uma pendente a mais na
   mãe, para a origem seguir aberta): `fixar`; `host` com K1 "governanca" publicando o turno 1 com
   "Reescrever autoria" concluída; `pedido($, 'Pedido antigo')`; `plan` de "O" "Reescrita" com "o1" "Pedir
   a reescrita" e "o2" "Conferir a reescrita"; `start(['o1'])`; `abrirSessao`; `aviso`; `done(['o1'])`;
   `fimDoTurno`; a filha passa a publicar também o turno 2 digitado (`own: true`, `at: AGORA + 500`) com
   "Feita na filha" concluída e "Pendente na filha" aberta, sem start; `h.filha(K1).rodando = false`;
   `aviso`.
   Afirma: `cabecalho(p)`: `[feitas, total]` igual a `[3, 5]` ("o1", "o2", a do turno 1 e as duas do turno
   digitado) e `chips.pendentes` 2; o cartão `PROPRIO` tem "parada".
   Depois `h.filha(K1).rodando = true` e `aviso`: `[feitas, total]` segue `[3, 5]`, `chips.ativas` 1, e a
   linha "Reescrita" está em andamento.
   Falha hoje: o cartão digitado é lido como rodada descartada: o cabeçalho diz 2 de 3, com 1 pendente,
   e, rodando, o chip conta 2 sessões ativas.
2. Regra `sessoes.sessao-conta-uma-vez-no-chip` (nova):
   **"uma sessão rodando com uma rodada antiga deixada aberta conta uma vez em sessões ativas"**.
   Roteiro: `const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b',
   'iniciada')])` (já no arquivo). Afirma: `cabecalho(p).chips.ativas` é 1; os dois cartões seguem
   desenhados (`cartoes(p, 'filha-um').length` 2).
   Falha hoje: `chips.ativas` é 2.

Testes existentes: nenhum deve mudar. `sessoes.test.ts:424` e `:443` (turno próprio com tarefa iniciada)
já têm o cartão digitado na frente por causa da tarefa iniciada; `:203`, `:374` (rodada anterior
abandonada) seguem iguais (a rodada 2 é a mais recente e tem a tarefa iniciada).

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.rodada-da-frente-e-a-mais-recente
A rodada atual de uma filha é a mais recente, seja de mensagem da mãe, seja de turno digitado nela.

- Dado uma filha com uma rodada da mãe já concluída e, depois, um turno que a pessoa digitou direto nela
- Quando esse turno tem tarefas abertas, com ou sem uma iniciada, e a filha está parada ou rodando
- Então o cartão desse turno é o da rodada atual: as tarefas dele contam no cabeçalho e nos chips, e o pedido onde ele está segue à vista enquanto a filha trabalha; a rodada descartada segue sendo a anterior deixada com tarefa aberta (sessoes.rodada-descartada-fora-da-contagem)

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o turno digitado na filha era sempre lido como a rodada mais antiga); cumpre sessoes.rodada-descartada-fora-da-contagem (decisão do usuário, 2026-10-28: "a rodada descartada é a anterior, não a que está trabalhando") e sessoes.turno-proprio-da-filha-no-pedido-vigente (2026-11-03).
Estado: coberto
```

```markdown
### sessoes.sessao-conta-uma-vez-no-chip
Uma sessão conta uma vez no chip de sessões ativas, com um cartão ou vários.

- Dado uma filha rodando com mais de um cartão (uma rodada antiga deixada com tarefa aberta e a rodada atual)
- Quando o cabeçalho conta as sessões ativas
- Então conta 1 para ela, pelo cartão da rodada atual; os cartões seguem desenhados

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: cada cartão com tarefa aberta de uma sessão rodando contava como uma sessão ativa).
Código: hooks/render.tsx
Estado: coberto
```

Selos:

```bash
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o turno digitado na filha depois da rodada da mãe é a rodada atual: conta no cabeçalho, parado ou entre um done e o start seguinte" --tipo novo --motivo "correção direta: rodada da frente pelo tempo"
npm run regras:selar -- "task-tree/tests/sessoes.test.ts::uma sessão rodando com uma rodada antiga deixada aberta conta uma vez em sessões ativas" --tipo novo --motivo "correção direta: a sessão conta uma vez no chip"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho de `split()` em "Como é hoje" (~376) e o da rodada descartada, com a
escolha da frente pelo tempo e o `live` só no cartão da frente.

## 8. Golden

Não deve mudar: o cenário "filha" tem um cartão só, sem rodadas; os outros não dividem cartão. Conferir
o resultado do check antes do commit; diferença em qualquer cenário é erro da implementação.

## 9. Checklist do app

- Com uma filha real: digitar direto nela depois de uma mensagem da mãe; no painel da mãe, o cartão
  "pedido do usuário na filha" conta no cabeçalho e segura o pedido à vista.
- Uma filha real com dois cartões: o chip diz 1 sessão ativa.

## 10. Dependências e conflitos

- Independente dos lotes 01 a 15 no código; vem antes dos lotes 17 (netas), 19 ("substituída", que usa a
  rodada da frente) e 20 (um cartão só para os turnos digitados, que refaz as partes digitadas).
- Triagem B: a correção "a mesma carta aparece em todos os cartões de rodada da filha" mexe no fim de
  `split` (o que cada parte leva de `sends`); a correção "recolher uma linha muda os chips e a faixa"
  mexe em como `hooks/render.tsx` conta as linhas (`tally`), o mesmo lugar que lê `live`; as decisões 23 e
  24 mexem em `rows`. Adaptar: o critério deste lote é "a sessão conta uma vez".
- Triagem C: nada em `split`.

## 11. Bloqueio

Nenhum.
