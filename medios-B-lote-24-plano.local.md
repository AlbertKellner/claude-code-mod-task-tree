# Lote 24: o subagente retomado volta a "trabalhando"

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit. Só
`hooks/agents.ts` muda.

## 1. O que cobre

Correção direta: "Subagente retomado ou acordado por mensagem: o primeiro fim de turno é tratado como fim
definitivo e o cartão não volta a 'trabalhando'". Nenhuma decisão nova. A dependência que a triagem
apontava (a carta para subagente parado) entrou no PR 38: a retomada já entrega a carta
(`takeSubSend`); falta o cartão.

## 2. Causa confirmada na ponta

- `hooks/agents.ts:64-69` (`agentSpawn`): no lançamento com `resume`, a carta pendente é dada como
  entregue (`:67`, PR 38) e a função sai sem tocar no cartão (`:69`, `|| e?.resume`). O cartão segue
  com o estado do primeiro fim ("concluído", "falhou" ou "interrompido") e com o fim marcado.
- `:141` (`subTool`): as chamadas de quem não está vivo são ignoradas: o retomado não mostra ferramenta.
- `hooks/turn.ts:171-181`: todo fim de turno de subagente (que não é teammate) é o fim dele (`subEnd`).
- `:267-289` (`settleBySubs`): com o cartão dizendo "concluído", a tarefa de origem ainda aberta fecha no
  fim do turno com o subagente retomado trabalhando. Contra `subagentes.um-rodando-mantem-o-pai`.
- O fluxo existe: a retomada vem como `agent.spawn` com `resume.agentId`, o mesmo id (o kit já a simula:
  `retomadaDoSubagente`, `tests/kit/cenario.ts:88-90`, e `lancaveis` devolve o mesmo id na retomada).

Escrito no código.

## 3. O que muda

`hooks/agents.ts`, `agentSpawn`, no ramo da retomada (depois da entrega da carta, que não muda):

- Se existe o cartão desse agente (o grupo com `sub`), ele volta a vivo: o estado passa a "em segundo
  plano" quando a retomada vem em segundo plano, senão "trabalhando"; o fim marcado sai; o último sinal
  (`seen`) passa a ser agora; o início (o lançamento), o lote, o run e o modelo ficam; a contagem de
  chamadas continua de onde estava (o contador do módulo é semeado com o `calls` do cartão).
- A ordem dentro da retomada: primeiro o cartão volta a vivo, depois a carta é dada como entregue. Assim
  a tarefa de onde o subagente foi lançado não fecha na entrega com ele rodando (ela fecha com o fim
  dele, como `envios.subagente-recebe-fica-verde` já diz: "salvo se dela ainda roda um subagente"); a
  carta que saiu de outra tarefa segue concluindo essa outra na entrega.
- Sem cartão para esse agente (um teammate, ou um agente que nunca teve cartão), nada muda.
- O fim seguinte vale como fim, pelo caminho de sempre (`subEnd`); uma nova retomada o traz de volta de
  novo.

O que deriva de regras já registradas e não muda (não precisa de código):

- as tarefas do grupo dele que ficaram ✕ no primeiro fim só voltam com start dele nelas (como a tarefa
  parada com Esc, 2026-11-12);
- a tarefa de origem já fechada não reabre (como em `subagentes.workflow-sem-sinal-vira-interrompido`: "a
  tarefa de origem já fechada não reabre"); a ainda aberta espera por ele, porque o cartão voltou a vivo
  (`settleBySubs` e o lote 07 leem o estado do cartão).

No painel: o subagente retomado mostra "trabalhando" (ou "em segundo plano"), volta à pílula "N
subagentes", mostra a ferramenta em uso e segue a contagem de chamadas; a tarefa de origem ainda aberta
não fecha enquanto ele roda (com o lote 15, aparece ◉); quando ele termina de novo, o cartão diz o novo
fim. O tempo do cartão segue contado desde o lançamento.

## 4. Impacto

`npm run impacto -- task-tree/hooks/agents.ts`: 30 cenários. Checklist: `envios.subagente-no-app` e os
quatro de subagentes no app. Golden: nenhum cenário.

## 5. Testes

Novos, em `tests/subagentes.test.ts` (com `retomadaDoSubagente` do kit; nenhuma mudança no kit):

1. "o subagente retomado volta a 'trabalhando', conta na pílula e segue a contagem de chamadas; o fim
   seguinte vale como fim". Cenário novo `subagentes.retomado-volta-a-trabalhando`. Roteiro: `fixar` com
   `relogio`; `lancaveis(['sub-1'])`; stub de `Read`; pedido; plan; start; `lancar`; uma chamada `Read`;
   `fimDoSubagente` (o cartão diz "concluído"); `retomadaDoSubagente($, 'sub-1', 'continue')`. Afirma: o
   cartão contém "trabalhando" e a pílula "▸ 1". `relogio.advance(1500)`; outra chamada `Read`: a linha
   da ferramenta diz "2 chamadas". `fimDoSubagente`: "concluído" e sem pílula. Falha hoje: depois da
   retomada o cartão segue "concluído".
2. "com o subagente retomado rodando, a tarefa de origem aberta não fecha no fim do turno; a já fechada
   não reabre". Mesmo cenário e `subagentes.um-rodando-mantem-o-pai`. Roteiro, primeira parte: `lancar`;
   `fimDoSubagente`; retomada; fim do turno; afirma "Investigar" não concluída; `fimDoSubagente`: agora
   concluída. Segunda parte (outra tarefa, outro subagente): `lancar`; `fimDoSubagente`; fim do turno
   (fecha ✓); retomada: a tarefa segue concluída e o cartão diz "trabalhando". Falha hoje na primeira
   parte (fecha com ele rodando).
3. "as tarefas que o subagente deixou interrompidas só voltam com start dele". Mesmo cenário. Roteiro: o
   subagente planeja "X" e dá start; `fimDoSubagente` ("X" ✕); retomada: "X" segue ✕; `start(['X'],
   'sub-1')`: em andamento. Passa hoje (fixa o que deriva das regras).

Testes existentes: nenhum muda. Os da carta a subagente retomado (`tests/envios.test.ts:594-613`) seguem
valendo; neles, depois da retomada, o cartão passa a "trabalhando", o que eles não afirmam ao contrário
(conferir: se algum afirmar "concluído" depois da retomada, é teste do PR 38, selado; o implementador
para e relata).

## 6. Catálogo e selos

`regras/subagentes.md`:

- Cenário novo `### subagentes.retomado-volta-a-trabalhando`
  - Título: "O subagente retomado volta a 'trabalhando' no mesmo cartão."
  - Dado um subagente que terminou (o cartão "concluído", "falhou" ou "interrompido")
  - Quando o app o retoma (com uma mensagem, sob o mesmo id)
  - Então o cartão volta a "trabalhando" (ou "em segundo plano"), sem fim, na pílula "N subagentes", com
    a ferramenta em uso e a contagem de chamadas seguindo de onde estava; o fim seguinte vale como fim;
    as tarefas dele que ficaram ✕ só voltam com start nelas; a tarefa de origem já fechada não reabre, e
    a ainda aberta espera por ele
  - `Origem: auditoria 2026-11-10 (o lançamento com retomada não tocava o cartão); aplica
    subagentes.um-rodando-mantem-o-pai, turnos.parada-segue-interrompida-ate-o-start ("só o start nela a
    reacende") e subagentes.workflow-sem-sinal-vira-interrompido ("a tarefa de origem já fechada não
    reabre"), sem mudar nenhuma regra.`
  - `Estado: coberto`
- Cenário novo `### subagentes.retomado-no-app`
  - Título: "No app, o subagente real retomado volta a 'trabalhando'."
  - Dado um subagente real que terminou, com o cartão sob a tarefa de origem
  - Quando o modelo manda uma mensagem a ele e o app o retoma
  - Então o cartão volta a "trabalhando", com a ferramenta em uso, e a pílula o conta; ao terminar de
    novo, diz o novo fim
  - `Origem: auditoria 2026-11-10; o teste simula a retomada pelo lançamento com o mesmo id, não a
    retomada real.`
  - `Estado: checklist (retomada real de subagente no app)`

Selos (`novo`) para os três testes, motivo "o subagente retomado volta a trabalhando no mesmo cartão".
Forma:

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::o subagente retomado volta a 'trabalhando', conta na pílula e segue a contagem de chamadas; o fim seguinte vale como fim" --tipo novo --motivo "o subagente retomado volta a trabalhando no mesmo cartão"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde o cartão do subagente e a carta a subagente (PR 38) são descritos (procurar
`resume` ou "retomado"), a volta do cartão. `CLAUDE.md`: o "Checklist do app" já tem "carta a subagente
real (recebida, parado antes de receber, retomado)"; acrescentar "o cartão do retomado volta a
'trabalhando'".

## 8. Golden

Não muda.

## 9. Checklist do app

`subagentes.retomado-no-app`: mandar uma mensagem a um subagente real já concluído; o cartão volta a
"trabalhando" e, ao terminar, a "concluído".

## 10. Dependências e conflitos

- Depois do lote 07 (a tarefa de origem espera o que roda nela) e do lote 23 (o freio de `subTool`: a
  conferência de vivo fica dentro da escrita; a semente da contagem de chamadas vai no mesmo mapa do
  módulo). O lote 08 (última tentativa) não conflita: o retomado é o mesmo cartão.
- Triagem C, decisão 34 ("Apagar os sem tarefas (Recomendado)", poda dos subagentes terminados no
  estado): se o cartão do subagente terminado for podado antes da retomada, a retomada não acha cartão e
  nada aparece. C deve manter o cartão enquanto a tarefa de origem está à vista, ou este lote recria o
  cartão na retomada; o implementador do lote que vier depois decide com o outro plano em mãos e relata.
- Triagem A, decisão 7 ("Segue ◉/◷", Esc com subagente vivo): um retomado vivo conta como subagente vivo.

## 11. Bloqueio

Nenhum. A triagem notou que os dois pontos derivados (as tarefas ✕ dele só voltam com start; a tarefa de
origem fechada não reabre) podiam ser confirmados com uma pergunta curta; eles seguem regras registradas
e o plano os assume.
