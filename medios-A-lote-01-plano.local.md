# Lote 01: ids no plan, start e done

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (duas correções diretas no mesmo arquivo, `state/tasks.ts`).

## 1. O que cobre

- Achado "Os lembretes mostram o id completo ("1/1.2") e o plan espera o id curto: replanejar copiando
  o id do lembrete duplica o prefixo e perde o estado". Correção direta.
- Achado "Id curto de tarefa fechada colide com as tarefas de histórico renomeadas". Correção direta.
- Nenhuma decisão nova do usuário. Aplicam decisões antigas: `pedidos.replano-preserva-estado`
  (2026-10-27, "◉ segue ◉, ✓ segue ✓, ✉ segue até a entrega; só tarefas novas nascem ○") e a ordem
  "a tarefa aberta vence" do id curto (`arvore.ids-curtos-e-avisos`).

## 2. Causa confirmada na ponta atual

Escrito no código:
- `state/tasks.ts:13-22` (`build`): toda subtarefa recebe `<id do nível 1>/<id dado>`, sem olhar se o id
  dado já começa por esse prefixo; `short` guarda o id como veio.
- `hooks/panel.ts:307-311` (`openList`): os lembretes listam `"${t.id}"`, o id completo. O lembrete da
  mensagem no meio do turno manda replanejar "de novo com o nível 1 inteiro" (`text/rules.ts:134-141`).
- `state/tasks.ts:32-46` (`resolve`): casa por `t.id === id || t.short === id` em todas as tarefas do
  grupo, na ordem aberta, concluída, interrompida.
- `hooks/tools.ts:55` (`rename`): a renomeação do plan troca só o `id` (`<tag>:<id>`, nas subtarefas
  também); o `short` da tarefa de histórico fica igual ao da tarefa nova.

Dedução (pela leitura, sem rodar):
- replano com "A/1" e "A/2" cria "A/A/1" e "A/A/2": `carry` não acha os ids antigos, a ✓ e a ◉ somem e
  entram duas ○; a cada replano o prefixo cresce;
- com dois pedidos que reusaram o nível 1 "1": `start ["1.1"]` com as duas "1.1" concluídas devolve
  `"1.1" é ambíguo, use "<tag>:1/1.1" ou "1/1.1"`; `start ["1.3"]`, quando só o plano antigo tinha 1.3,
  reabre a tarefa de histórico e os pais (e `joinWork` traz o pedido antigo de volta ao painel); com a
  "1" atual interrompida e a de histórico concluída, `start ["1"]` reabre a de histórico (a concluída
  vem antes da interrompida na ordem).

## 3. O que muda

Só `state/tasks.ts`.

- `build`: abaixo do nível 1, quando o id dado começa exatamente por `<id do nível 1>/`, o prefixo é
  tirado antes de montar; o `short` fica o id sem o prefixo. O nível 1 não muda. Vale em qualquer
  profundidade (a subtarefa de nível 3 também recebe o prefixo do nível 1). Só um prefixo é tirado
  (quem mandar "A/A/1" segue ganhando "A/A/1").
- `resolve`: as tarefas de histórico saem do conjunto do id curto e respondem só pelo id completo.
  Tarefa de histórico: toda a subárvore de um nível 1 cujo `id` difere do `short` (o plan renomeia o
  nível 1 para `<tag>:<id>` e mantém o `short`; um nível 1 que o plan não renomeou tem `id === short`).
  A ordem dentro do conjunto (aberta, concluída, interrompida; id exato vence) não muda. O mesmo vale
  para a pergunta "é de outro agente" (ela usa `resolve`).
  - Efeito colateral aceito: uma tarefa do formato de antes dos grupos (`migrate`, `hooks/panel.ts:160`)
    com ":" no id passa a responder só pelo id completo. Painéis desse formato são de outubro.

Comportamento novo no painel:
- o modelo replaneja o nível 1 com os ids como os lembretes mostram ("A/1", "A/2.1"): a concluída segue
  ✓, a em andamento segue ◉, só o passo novo nasce ○; `start`/`done` seguem aceitando o id curto dele;
- `start`/`done` com id curto nunca reabre nem fecha uma tarefa de histórico, e a resposta nunca cita o
  id interno `<tag>:…` por ambiguidade com o histórico; id curto que só existe no histórico responde
  `"<id>" não existe`.

Textos ao modelo: não mudam (o plan só passa a tolerar o que os lembretes já mostram).

## 4. Impacto

`npm run impacto -- state/tasks.ts`: 46 cenários (pedidos 14, arvore 9, envios 17, cabecalho 2, turnos 1,
sessoes 1, subagentes 1, durabilidade 1). Checklist do app: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app` (só por mapa de área; nada deles muda). Golden: nenhum cenário.

## 5. Testes a escrever (pelo kit)

1. `tests/pedidos.test.ts`, regra `pedidos.replano-aceita-o-id-completo` (nova):
   **"replano com os ids completos que os lembretes mostram mantém a concluída e a em andamento"**.
   Roteiro: `fixar`; `pedido`; `plan(A2)`; `start(['1'])`; `done(['1'])`; `start(['2.1'])`; `plan` do
   nível 1 "A" com os filhos de ids "A/1", "A/2" (este com "A/2.1" e "A/2.2") e um novo "A/3" "Três".
   Afirma: "Um" concluída; "Dois.um" em andamento; "Três" pendente; o painel não tem duas linhas "Um";
   o texto do painel contém "1 de 4"; depois `start(['3'])` responde "Em andamento: Três".
   Falha hoje: os ids viram "A/A/1"…, "Um" e "Dois.um" renascem ○ e o cabeçalho diz "0 de 4".
2. `tests/arvore.test.ts`, regra `arvore.id-curto-nao-alcanca-o-historico` (nova):
   **"o id curto não alcança as tarefas de histórico: start numa concluída não é ambíguo e o id que só
   existe no histórico não existe"**.
   Roteiro: `const { relogio } = fixar(on)`; pedido um; `plan` nível 1 "1" "Antigo" com "1.1" "Antiga um"
   e "1.3" "Só no antigo"; `start`/`done` nas duas; `fimDoTurno`; `relogio.advance(1000)`; pedido dois;
   `plan` nível 1 "1" "Novo" com "1.1" "Nova um"; `start(['1.1'])`; `done(['1.1'])`.
   Afirma: `start(['1.1'])` não contém "ambíguo" e contém "Em andamento: Nova um"; no painel "Nova um"
   em andamento; `start(['1.3'])` contém `"1.3" não existe` e "Nada marcado"; no painel não há linha
   "Só no antigo" nem "Antigo" (o pedido antigo segue em "+1 pedidos anteriores").
   Falha hoje: o primeiro `start` responde "é ambíguo" com o id `<tag>:1/1.1`; o segundo reabre a tarefa
   de histórico e traz o pedido antigo de volta.
3. `tests/arvore.test.ts`, mesma regra:
   **"com a tarefa atual interrompida e a de histórico concluída, o start pelo id curto reabre a atual"**.
   Roteiro: `fixar`; `lancaveis(on, ['sub-1'])`; pedido um; `plan([{ id: '1', title: 'Antiga' }])`;
   `start`/`done`; `fimDoTurno`; avançar; pedido dois; `plan([{ id: '1', title: 'Nova' }])`;
   `start(['1'])`; `lancar`; `fimDoSubagenteCom($, 'sub-1', { erro: true })`; `fimDoTurno` ("Nova" fica ✕
   "falhou", por `subagentes.pai-reflete-falha-ou-interrupcao`); pedido três; `start(['1'])`.
   Afirma: a resposta contém "Em andamento: Nova"; "Nova" em andamento.
   Falha hoje: responde "Em andamento: Antiga" (a concluída de histórico vem antes da interrompida).

Testes existentes: nenhum muda. `arvore.ids-curtos-e-avisos` (dois níveis 1 do mesmo pedido, sem
histórico) segue valendo: "A/1" e "B/1" seguem ambíguos por "1".

## 6. Catálogo e selos

Cenários novos:

```markdown
### pedidos.replano-aceita-o-id-completo
O replano aceita os ids das subtarefas como o painel os mostra nos lembretes.

- Dado um nível 1 aberto com uma tarefa ✓ e outra ◉
- Quando o modelo replaneja o nível 1 passando as subtarefas com o id completo ("A/1", "A/2.1"), como os lembretes as listam
- Então o id completo vale como o curto: quem mantém o id mantém o estado, só o passo novo nasce ○, e o prefixo não se repete no id

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o replano com o id do lembrete duplicava o prefixo e perdia o estado); aplica pedidos.replano-preserva-estado (decisão do usuário, 2026-10-27), sem mudar nenhuma regra.
Estado: coberto
```

```markdown
### arvore.id-curto-nao-alcanca-o-historico
O id curto de start e done não alcança as tarefas de histórico.

- Dado um nível 1 de um pedido anterior que virou histórico porque um plan novo reusou o id dele
- Quando o modelo chama start ou done com um id curto que as duas cópias têm, ou que só a de histórico tem
- Então vale a tarefa do plano atual (sem aviso de ambíguo); o id que só existe no histórico "não existe"; a tarefa de histórico só responde pelo id completo

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: o id curto reabria tarefa de histórico e expunha o id interno); aplica arvore.ids-curtos-e-avisos ("a tarefa aberta vence") e pedidos.plano-anterior-vira-historico, sem mudar nenhuma das duas.
Estado: coberto
```

Selos (um por teste novo, depois de escritos):

```bash
npm run regras:selar -- "task-tree/tests/pedidos.test.ts::replano com os ids completos que os lembretes mostram mantém a concluída e a em andamento" --tipo novo --motivo "correção direta: o plan aceita o id completo dos lembretes"
npm run regras:selar -- "task-tree/tests/arvore.test.ts::o id curto não alcança as tarefas de histórico: start numa concluída não é ambíguo e o id que só existe no histórico não existe" --tipo novo --motivo "correção direta: id curto fora do histórico"
npm run regras:selar -- "task-tree/tests/arvore.test.ts::com a tarefa atual interrompida e a de histórico concluída, o start pelo id curto reabre a atual" --tipo novo --motivo "correção direta: id curto fora do histórico"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: no item "Id curto em `start`/`done`" (linha ~1452) acrescentar que as tarefas de
histórico (nível 1 renomeado pelo plan) só respondem pelo id completo; na linha do `planTool` em "Os 14
hooks" (linha ~109), que `build` aceita a subtarefa já com o prefixo do nível 1. Uma frase cada.

## 8. Golden

Não muda (nenhum cenário do golden usa id completo no plan nem id curto de histórico).

## 9. Checklist do app

Nada novo.

## 10. Dependências e conflitos

- Nenhum lote antes.
- Lote 02 (nível 1 concluído reabre) e lote 05 (cancelar tarefa) mexem em `hooks/tools.ts`, não em
  `build` nem `resolve`.
- Outras triagens: a triagem C tem correções nos resultados e recusas de `plan` e `start`
  (`hooks/tools.ts`); a triagem B não toca `state/tasks.ts` nestas funções. Conflito provável só de
  linhas vizinhas em `state/tasks.ts`.

## 11. Bloqueio

Nenhum.
