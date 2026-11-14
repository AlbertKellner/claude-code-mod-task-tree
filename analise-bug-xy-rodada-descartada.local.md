# x/y de "Um" conta a rodada descartada (análise)

Base: `cba8f78`. Nada foi editado. A reprodução foi feita numa cópia de `HEAD` no scratchpad.

## Essencial

- **É bug do plugin, mas não onde parecia.** O x/y da linha-mãe (`atWork`) e o cabeçalho excluem igualmente os cartões descartados. O problema é **qual** rodada é dada como descartada.
  - Em `split` (`draw/layout.ts:342–343`), o cartão líder é `busy = parts.find(…tarefa iniciada aberta…)`: a **primeira** rodada com tarefa em andamento.
  - Com a rodada 1 abandonada com "f1b" ainda iniciada e a rodada 2 trabalhando em "f2", o líder vira a rodada 1, e a **rodada 2 (o trabalho atual) é a descartada**.
- **Reproduzido:** "Um" mostra 1/3 (Um, f1 ✓, f1b) e o cabeçalho dá 1 de 4 (Um, Três, f1, f1b). Quem saiu foi **f2**, não a rodada 1.
  - O teste coberto "a rodada anterior deixada com tarefa aberta sai da contagem" (`sessoes.test.ts:202`) espera `total 4` e **passa pelo motivo errado**: o comentário diz "contam Um, Dois, Três e f2", mas "Dois" é tarefa de mensagem (não conta), e os 4 são Um, Três, f1 e f1b.
- **A decisão do usuário cobre o x/y do pai.** `bf77359`, 2026-10-24, "as tarefas dessa sessão foram descartadas": "sai da contagem dos pais, do topo e do chip interrompida"; "suas folhas, inclusive ✓, saem do x/y e do total". A rodada descartada é a **anterior**, "deixada com tarefa aberta quando a mensagem seguinte começou a rodada depois dela".
  - O `find` é de `4af1b92` (2026-10-21), anterior à regra de descarte, que passou a depender dele sem ajustá-lo.
- **Correção:** o líder passa a ser a **última** rodada com tarefa iniciada aberta (`findLast`), uma linha.
  - O teste coberto citado muda de expectativa (de 4 para 3, e "Um" 0/1).
  - Pelas travas, isso exige o selo `decisao` e `Reescrito:` no catálogo. Não é decisão nova: o teste afirmava o valor do bug.
  - Fica uma **confirmação** para o usuário (não uma contradição): registrar a correção do teste citando a decisão de 2026-10-24.

## 1. Causa (código)

- `split` (`layout.ts:338–343`):
  ```ts
  const busy = parts.find(k => (flatIn.get(k) ?? []).some(t => t.status === 'open' && t.started !== undefined))
  const lead = busy ?? parts[parts.length - 1]
  ```
  `parts` está em ordem crescente (rodada 0, 1, …). Com tarefa iniciada aberta em duas rodadas, `find` devolve a mais antiga.
- `discarded` (`layout.ts:117–121`): `c.part !== undefined && !c.lead` com tarefa aberta → descartado. Então quem não é líder é descartado: aqui, a rodada mais nova.
- `atWork` (`layout.ts:462–474`) e o cabeçalho (`session()`, `nodes: []`; `total` com `splitter`) usam o mesmo `discarded`. Por isso a linha-mãe e o cabeçalho são **coerentes entre si**: os dois tiram f2 e contam f1 e f1b. A divergência relatada ("o cabeçalho exclui, o pai não") é uma leitura do teste; os números mostram a mesma rodada fora nos dois.
- Saída real do cenário (`duasRodadas` com f1 ✓ e f1b iniciada na rodada 1; f2 iniciada na rodada 2, sob "Dois"):
  ```
  Plano A  1 de 4 · 25%
  ├─ ◉ Um  ◍  1/3
  │     ◍ filha-um
  │     ◉ turno 1  1/2
  │     ├─ ✓ f1
  │     └─ ◉ f1b
  ├─ ✉ Dois  ◍  entregue
  │     ◍ filha-um
  │     ◉ f2
  └─ ○ Três
  ```

## 2. Bug ou regra

- **Regra do usuário** (2026-10-24, `bf77359`): "o cartão de rodada antiga com tarefa aberta, ou o líder de sessão abortada com tarefa aberta, é descartado: suas folhas, inclusive ✓, saem do x/y e do total". O código descarta a rodada **nova** quando a antiga ficou com tarefa iniciada, que é justamente o caso típico de rodada abandonada.
- **Outra decisão que mantenha a contagem no pai?** Não há. O comentário de `atWork` ("A discarded round adds nothing to the count nor to what the line stands for") e o de `discarded` falam da rodada antiga.
- **Mesmo efeito no desenho:** o cartão líder é o que mostra a espera e o anel, e o que segura `lastAnchor`/`running`. Com o líder errado, a espera e o "em andamento" ficam na rodada abandonada.

## 3. Correção

`task-tree/draw/layout.ts`, em `split`:
```ts
// The card at work: the latest round with a task in progress (an earlier one left with a task started
// is the abandoned one, discarded below), else the last.
const busy = [...parts].reverse().find(k => (flatIn.get(k) ?? []).some(t => t.status === 'open' && t.started !== undefined))
```
- As turnos próprios (`own`, chave negativa) vêm antes em `parts`; a ordem reversa os deixa por último na busca, o que está certo: a rodada de mensagem mais nova manda.
- **Impacto esperado:** só sessões com duas ou mais rodadas e tarefa iniciada aberta em mais de uma. Nos outros casos, `find` e `findLast` dão o mesmo.

## 4. Testes

- **Teste coberto que muda** (`sessoes.test.ts:202`, "a rodada anterior deixada com tarefa aberta sai da contagem, ✓ inclusive, e continua desenhada"):
  - **antes:** `total` 4, que é o valor do bug;
  - **depois:** `total` 3 (Um, Três, f2); "Um" com "0/1"; o cartão da rodada 1 continua desenhado com f1 e f1b; o cartão de f2 é o líder (f2 `andamento`).
  - Corrigir também o comentário ("contam Um, Três e f2; Dois é tarefa de mensagem").
  - Pelas travas: `Reescrito:` em `sessoes.rodada-descartada-fora-da-contagem`, e `npm run regras:selar -- "task-tree/tests/sessoes.test.ts::a rodada anterior deixada com tarefa aberta sai da contagem, ✓ inclusive, e continua desenhada" --tipo decisao --motivo "o teste afirmava o valor do bug; corrigido para a decisão de 2026-10-24"`.
  - A etapa `regressao` vai acusar esse teste antigo (ele falha contra o código novo); o selo `decisao` desta mudança o libera.
- **Cenário pendente que vira coberto:** `sessoes.rodada-descartada-fora-da-contagem-do-pai`, citado pelo mesmo teste (a asserção "Um" 0/1) ou por um teste novo:
  - "com a rodada anterior abandonada sob Um, o x/y de Um não a conta": `duasRodadas` com f1 ✓ e f1b iniciada → a linha "Um" contém "0/1", e o cabeçalho mostra `feitas` 0, `total` 3.
  - **Recomendado:** teste novo (selo `novo`), e o teste existente só com o número corrigido.
- **Não-regressão** (devem passar sem mudança):
  - "um cartão por mensagem" e "mensagens juntas", em que f1 está ✓ e só há uma rodada com tarefa iniciada;
  - o Esc com uma rodada só;
  - a cadeia de irmãs.
- **Variante nova** (opcional): o cartão líder é o mais novo. A espera ou o anel aparecem no cartão de f2, não no de f1. Exige `aguardando` na filha; se não for simples, fica no checklist.

## 5. Impacto nas regras e travas

- **Muda o mod:** só `draw/layout.ts`, uma linha mais o comentário. Escrever de uma vez; `npm run check`.
- **Regras cobertas afetadas:** `sessoes.rodada-descartada-fora-da-contagem` (o teste corrigido; o texto da regra já está certo); `sessoes.rodada-descartada-fora-da-contagem-do-pai` passa a coberto.
- **Selos:** um teste existente com selo `decisao` (pela correção), um novo (`novo`). O `testes:alterados` vai listar o teste corrigido, com antes e depois: é esperado e vai no relato.

## 6. Confirmação para o usuário

Não há contradição com decisão dele, mas as travas pedem a palavra dele para mudar um teste selado:

1. O teste "a rodada anterior deixada com tarefa aberta sai da contagem" foi escrito esperando o número que o bug produzia: contava a rodada antiga e tirava a atual. Posso corrigir o teste para a sua decisão de 2026-10-24 (a rodada **anterior** sai da contagem, inclusive do x/y da tarefa-mãe), junto com a correção do plugin? Recomendado: sim.

## 7. Brief para a Implementação (depois da confirmação)

Na branch `test/regressivos-automacao-testes`, depois de `cba8f78`. Um commit. Sem push.

1. `task-tree/draw/layout.ts`: `busy` com `findLast` (ordem reversa) e o comentário da seção 3.
2. `regras/sessoes.md`:
   - `sessoes.rodada-descartada-fora-da-contagem` ganha `Reescrito: 2026-10-28, <palavras do usuário na confirmação>; o teste afirmava o valor do bug`;
   - `sessoes.rodada-descartada-fora-da-contagem-do-pai` → `coberto`.
3. `task-tree/tests/sessoes.test.ts`:
   - o teste da linha 202 com `total` 3 e o comentário corrigido; selar `--tipo decisao`;
   - o teste novo do x/y de "Um" com `// Regra: sessoes.rodada-descartada-fora-da-contagem-do-pai`; selar `--tipo novo`.
4. `npm run check` verde (a etapa `regressao` libera o teste antigo pelo selo `decisao`).
5. O relato traz `npm run testes:alterados`, com o antes e depois do teste corrigido.

Commit: `fix(task-tree): rodada descartada é a anterior, não a que está trabalhando (líder do cartão é a rodada mais nova em andamento)`.

O usuário valida no app: com uma filha que recebeu uma segunda mensagem enquanto ainda tinha tarefa iniciada da primeira, o cartão novo aparece em andamento e com a espera/anel, e a tarefa-mãe da primeira mensagem não conta as tarefas abandonadas.
