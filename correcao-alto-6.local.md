# Correção do achado alto 6: o fechamento automático olha subagentes de turnos anteriores

Data: 2026-11-11. Branch `fix/achados-altos-auditoria`, sobre `e4f1dfa`. Ensaiado num clone no
scratchpad; o repositório não foi tocado. Diff aplicável: `correcao-alto-6.diff`, ao lado deste
arquivo (`git apply --check` no repositório, em `e4f1dfa`: ok).

Sem BLOQUEIO para o diff: ele aplica decisões já registradas, não muda teste existente, selo antigo
nem golden. Duas variantes do achado dependem de perguntas em aberto e ficam fora (ver "Fica fora,
depende de decisão").

## O achado 4 não resolve isto

O achado 4 (`4fdc25c`) só cobre o caso do id reusado num plano novo, e só para dados gravados
depois dele. `settleBySubs` (`task-tree/hooks/agents.ts`) segue sem guarda de tempo. Os testes novos,
rodados no código de `e4f1dfa`, deram 5 falhas:

- reaberta com start depois do fechamento automático e deixada aberta: `✓` em vez de `◷`;
- fechada pelo `done`, reaberta com start e replanejada no mesmo pedido: `✓` em vez de `◷`;
- `✕ "falhou"`, reaberta e refeita por outro subagente que conclui: segue `✕ falhou` (vale o pior,
  contando o subagente antigo);
- `✕ "falhou"`, reaberta e parada com Esc: diz "falhou" (o `begin` não limpa `failed`);
- painel gravado antes do achado 4 (âncora do cartão no id reusado): o fim do turno fecha a tarefa
  nova `✓` pelo subagente do pedido anterior.

O sexto teste novo (lançado da pendente, o subagente termina antes do primeiro start) passa antes e
depois: é a trava de que "Fecha também" continua valendo.

## Por que não o filtro `sub.end >= (startedAt ?? plannedAt)` da auditoria

- Ele deixaria de fechar a tarefa pendente cujo subagente terminou antes do primeiro start. Isso
  contraria a letra de `subagentes.pai-conclui-no-fim-do-turno` ("iniciada ou pendente, com um ou
  mais subagentes lançados dela, todos concluído": "Fecha também").
- O `begin` não distingue o primeiro start de uma reabertura (os dois gravam `startedAt = now`).
- Por isso a correção grava quando a tarefa foi reaberta (`reopenedAt`), só no start de uma tarefa
  fechada, e o corte é por ela. Num `done` do modelo seguido de start, o corte também funciona.
- Para os dados antigos (achado 4), a defesa é outra: subagente lançado antes de a tarefa ser
  planejada (`sub.at < plannedAt`) não é dela. Um lançamento nunca vem antes do plano da própria
  tarefa, e o replano no mesmo pedido (`carry`) mantém o `plannedAt`.
- Relógio parado do kit: os existentes têm tudo no mesmo instante, e os dois cortes deixam passar o
  empate (`>=` e `<` estrito). Nada muda neles. Os testes novos usam `relogio.advance(1000)` antes
  do start que reabre ou do plano novo.

## Decisões conferidas (nenhuma contrariada)

- `subagentes.pai-conclui-no-fim-do-turno` ("Fecha de fato", "Fecha também"): a tarefa fecha pelo fim
  dos subagentes dela. Ela fecha uma vez; reaberta pelo modelo, só um fim posterior a fecha de novo. A
  pendente que nunca foi reaberta segue fechando, e um teste trava isso.
- `turnos.iniciada-aguarda-no-fim`: a reaberta fica ◷ como toda iniciada. A exceção "trabalho só de
  subagentes" não vale para o que veio antes da reabertura.
- `subagentes.pai-reflete-falha-ou-interrupcao` ("vale o pior"): na mesma abertura da tarefa, nada
  muda. O teste selado dos três casos segue passando. Só o subagente de antes da reabertura deixa de
  contar.
- `subagentes.um-rodando-mantem-o-pai`: um subagente ainda rodando (sem `end`) sempre conta e segura
  a tarefa, mesmo lançado antes da reabertura.
- `subagentes.id-reusado-nao-herda-cartao`: a defesa por `plannedAt` estende ao que já estava gravado
  o "sem fechar pelo subagente antigo".
- `subagentes.cartao-fica-com-a-origem-fechada`: os cartões antigos seguem embaixo da tarefa reaberta.
  O desenho não muda.
- `turnos.esc-interrompe-so-a-iniciada`: a reaberta e parada com Esc fica ✕ "interrompida". O
  "falhou" de antes não fica.

## Passo a passo

1. `task-tree/types/index.d.ts`: em `TaskNode`, campo opcional `reopenedAt?: number`, com comentário.
   Painéis publicados antes leem igual.
2. `task-tree/state/tasks.ts`:
   - `begin`: no alvo já aberto, igual a hoje. No alvo fechado (✓ ou ✕), reabre como hoje, grava
     `reopenedAt: now` e tira `failed`:
     ```ts
     if (t.status === 'open') return { ...t, status: 'open' as Status, started: seq, startedSeq: seq, startedAt: t.startedAt ?? now, endedAt: undefined }
     const { failed: _, ...rest } = t
     return { ...rest, status: 'open' as Status, started: seq, startedSeq: seq, startedAt: now, endedAt: undefined, ...(now !== undefined ? { reopenedAt: now } : {}) }
     ```
   - `carry`: o replano no mesmo pedido mantém `reopenedAt` (spread condicional no `kept`).
3. `task-tree/hooks/agents.ts`: em `settleBySubs`, só contam os subagentes da folha:
   ```ts
   const ofLeaf = (s: Sub, leaf: TaskNode) =>
     !(leaf.plannedAt !== undefined && s.at < leaf.plannedAt) &&
     (leaf.reopenedAt === undefined || s.end === undefined || s.end >= leaf.reopenedAt)
   // …
   const mine = subs.filter(g => …).map(g => g.sub!).filter(s => ofLeaf(s, leaf))
   ```
   O comentário acima de `settleBySubs` ganha o porquê. Os dois gatilhos (fim do turno e `subEnd`)
   passam pela mesma função.
4. `regras/subagentes.md`: dois cenários novos, `Estado: coberto`:
   - `subagentes.reaberta-nao-fecha-pelo-subagente-antigo` (`Código: state/tasks.ts`), com
     "Também" para a pendente que nunca foi reaberta e "Fora deste cenário" para as duas perguntas
     abertas;
   - `subagentes.lancado-antes-da-tarefa-nao-conta` (dados gravados antes do achado 4), com "Fora
     deste cenário" para o cartão antigo que, nesse painel, segue desenhado sob a tarefa nova.
5. `task-tree/tests/subagentes.test.ts`: o import ganha `estado` (kit/ambiente) e `esc`
   (kit/cenario). Sete testes no fim do arquivo:
   - `// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo`: "reaberta com start depois de
     fechar pelo subagente, a tarefa aguarda no fim do turno seguinte; o subagente antigo não a fecha
     de novo"; "fechada pelo done e reaberta com start no mesmo pedido, mesmo replanejada, a tarefa
     não fecha pelo subagente que terminou antes";
   - `// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-reflete-falha-ou-interrupcao`:
     "a tarefa ✕ "falhou" reaberta com start e refeita por outro subagente que conclui fica ✓";
   - `// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, turnos.esc-interrompe-so-a-iniciada`:
     "reaberta com start, a tarefa que tinha falhado e é parada com Esc diz "interrompida", não "falhou"";
   - `// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-conclui-no-fim-do-turno`:
     "lançado da pendente, o subagente que termina antes do primeiro start ainda fecha a tarefa no fim
     do turno";
   - `// Regra: subagentes.lancado-antes-da-tarefa-nao-conta`: o par "âncora gravada por versão
     anterior, 1/2 … 2/2". O 1/2 captura o state (`estado(on, ANTIGO, 'captura')`), confere que a
     âncora já foi renomeada (o achado 4) e a devolve ao id reusado, como uma versão anterior
     gravava. O 2/2 semeia esse state (recarga a quente) e termina o turno: "Corrigir" segue pendente.
6. Selos, tipo novo, um por teste. O diff já traz os sete em `regras/selos.json`; ao aplicar o diff,
   não é preciso selar de novo:
   `npm run regras:selar -- "task-tree/tests/subagentes.test.ts::<nome>" --tipo novo --motivo "auditoria 2026-11-10, achado alto 6"`
7. Aplicar o diff de uma vez (três arquivos do mod: recarga a quente), rodar `npm run check` e fazer
   um commit local só dos seis arquivos:
   `git commit -- regras/selos.json regras/subagentes.md task-tree/hooks/agents.ts task-tree/state/tasks.ts task-tree/tests/subagentes.test.ts task-tree/types/index.d.ts`.
   Título sugerido: `fix(task-tree): o fechamento automático ignora subagentes de antes da reabertura`.

## Impacto

- `npm run impacto -- task-tree/hooks/agents.ts task-tree/state/tasks.ts task-tree/types/index.d.ts`:
  o núcleo foi tocado (`types/index.d.ts`), então entram todos os 131 cenários cobertos. O checklist
  do app lista os de sempre (os `visual.*`, `subagentes.cartao-no-app` e outros). Golden: os 4
  desenhos, sem mudança. Fora do mapa: nenhum.
- Sem o `types` (o campo novo só existe para o tsc), `agents.ts` e `tasks.ts` afetam 53 cenários.
  Checklist do app: `subagentes.cartao-no-app`. Golden: nenhum.

## Resultado do check na cópia (binário 2.1.321)

```
ok    regras
ok    travas
ok    selos
ok    validate do marketplace
ok    validate do mod
ok    tsc
ok    plugin test       (183 testes, 0 fail, 15 arquivos)
ok    regressao         (176 testes de HEAD contra o código novo, 0 falharam)
```

`npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum"; os novos são os sete
acima. O golden passou sem regravar. Como nos achados 4 e 5, copiei para o clone o
`task-tree/.claude-plugin/types/` e o `node_modules` do repositório.

## Fica fora, depende de decisão (não bloqueia o diff)

- **Variante Esc** (pergunta 10 da auditoria): depois de um Esc, a tarefa iniciada segue `open` no
  state e o ✕ é só do desenho. O fim de um subagente tardio, ou o fim do turno seguinte, a fecha pelo
  subagente do turno parado, porque o start seguinte não a reabre (ela não estava fechada). A
  pergunta exata: "Depois de um Esc, quando o último subagente de uma tarefa termina, o painel deve
  fechá-la sozinho (como no fim normal) ou deixá-la como o Esc deixou? Recomendo não fechar depois
  de Esc: a próxima mensagem já pede o replano." Com "não fechar": gravar o Esc no subagente, ou
  cortar por `turnAborted`, e alinhar os dois gatilhos.
- **Falha e nova tentativa na mesma abertura** (pergunta 23): "Subagente falha, o modelo lança outro
  da mesma tarefa e ele conclui: tarefa ✓ (vale a última tentativa) ou ✕ "falhou" (vale o pior, como
  hoje)?" Mudar isso reescreve `subagentes.pai-reflete-falha-ou-interrupcao` e o teste selado. Este
  diff não toca nisso: só a tentativa feita depois de um start que reabriu a tarefa deixa de herdar a
  falha antiga.

## Fica fora, sem decisão (relatar)

- Restringir o gatilho do `subEnd` à âncora do subagente que terminou (achado médio "os dois gatilhos
  têm guardas diferentes"). O corte desta correção vale para os dois gatilhos.
- O `carry` não leva `failed`: a tarefa ✕ "falhou" replanejada no mesmo pedido passa a dizer
  "interrompida". É um bug à parte, visto no ensaio.
- O painel gravado antes do achado 4 segue desenhando o cartão antigo sob a tarefa nova de mesmo id
  (visto no 2/2). O fechamento está corrigido; o desenho pediria a mesma conferência por `plannedAt`
  em `below` (`draw/layout.ts`) e mexe no desenho.
- `DESENVOLVIMENTO.md` não cita `settleBySubs` (pergunta 37, documentação, segue aberta).

## Checklist do app (depois do commit local)

- Subagente real lançado de uma tarefa, fim do turno (✓). Na mensagem seguinte, start na mesma tarefa
  e fim do turno sem subagente novo: ela fica ◷ "Aguardando" e o cartão antigo segue embaixo.
