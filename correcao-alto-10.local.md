# Correção do achado alto 10: filha parada com Esc sem pendente

Sem BLOQUEIO. Diff pronto, ensaiado numa cópia sobre o HEAD d2905d8: `npm run check` verde (190 testes, regressão 189 de HEAD, 0 falhas; golden sem mudança). Diff: `<notas>\correcao-alto-10.diff` (`git apply --check` ok num clone novo do repositório, com CRLF preservado).

## O defeito, reproduzido

Filha com "Feita" ✓ e "Começada" iniciada, nenhuma pendente, parada com Esc (`aborted`). No HEAD, o teste novo falha assim:

```
Plano A  1 de 4 · 25%  0:01  (sessão inteira: 0 de 3)
█████░░░░░░░░░░░░░░░  ● 1  ○ 2  ✕ 1
   ├─ ◉ Um  ◍  1/2  0:01
   │     ◍ filha-um  concluída
   │     ├─ ✓ Feita  —
   │     └─ ✕ Começada  interrompida  0:00
```

Causa: `trimToWork` troca o painel do cartão pelo `panelOf(c)`, já passado pelo `halt`. Depois disso, `rawPanel(c)` devolve o painel em que a iniciada já é ✕. Sem pendente, nada fica aberto. Aí `discarded()` responde falso, a ✓ conta, a ✕ entra no chip e `parked` também é falso, então o cartão diz "concluída". Com uma pendente o resultado era outro (tudo fora da contagem, "parada"). O "sessão inteira" do tooltip, calculado sobre o painel cru, já dava 0 de 3.

## Decisões respeitadas (nenhuma muda)

- `sessoes.rodada-descartada-fora-da-contagem` (2026-10-24, "as tarefas dessa sessão foram descartadas"; reescrito em 10-28, 10-30 e 11-04): a sessão parada com Esc com tarefa aberta sai da contagem, ✓ inclusive, e também do chip "interrompidas". A correção aplica isso ao caso sem pendente.
- `sessoes.rodada-descartada-fora-da-contagem-do-pai`: o x/y da tarefa de origem não conta a rodada.
- `sessoes.palavra-de-estado-do-cartao`: "para com tarefas abertas" é "parada". O cartão passa a dizer "parada", não "interrompida". "Interrompida" seria decisão nova (pergunta 15 da auditoria) e fica fora.
- `turnos.pendentes-seguem-pendentes` e `sessoes.filha-parada-pendentes-seguem-pendentes`: nada muda (pendentes seguem ○; a iniciada segue ✕ no Esc).
- Nenhum teste selado muda, nem o golden (`npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum").

## Passo a passo

1. `task-tree/types/index.d.ts`, em `TaskNode`: campo novo `halted?: boolean`, só de desenho (nunca guardado nem publicado: a publicação usa os grupos do state, não o painel parado).
2. `task-tree/draw/layout.ts`:
   - `halt`: a folha iniciada que o Esc lê como interrompida sai marcada: `{ ...interrupt(at)(t), halted: true }`.
   - Função nova `leftOpen(list)`: alguma tarefa `open` ou marcada `halted`. Conta como aberto o que estava aberto até o Esc.
   - `discarded()`, `parked` (em `session()`) e `left` (em `atWork`, o estado do busto na linha da tarefa) trocam `hasOpen(tasksOf(rawPanel(c)...))` por `leftOpen(...)`.
   - Por que a marca na tarefa e não no cartão: o split das filhas de nível mais fundo (netas) roda depois do `trimToWork`, dentro de `panel()`. Uma marca booleana no cartão passaria para todas as rodadas. A marca na tarefa segue a tarefa no split, no corte e nos níveis.
   - O efeito é igual ao do painel cru: sem `aborted` o `halt` não interrompe nada, então nada muda no fim normal do turno, na filha arquivada, no subagente nem na rodada anterior.
3. `task-tree/tests/sessoes.test.ts`: teste novo, logo depois de "a sessão parada com Esc e tarefa aberta sai da contagem…":
   - `// Regra: sessoes.filha-parada-com-esc-sem-pendente`
   - `test('a filha parada com Esc sem pendente sai da contagem, ✓ inclusive, e o cartão diz "parada"')`: filha com `noTurno(1,'1','Feita','feita')` e `noTurno(1,'2','Começada','iniciada')`, plano A3, `start 1`, abrir, `rodando=false` e `aborted=true`.
   - O teste afirma: Feita ✓, Começada ✕, cabeçalho `[0, 3]`, chip interrompidas 0, "Um" com `0/1`, palavra "parada" e sem "concluída" (8 asserções).
   - No HEAD ele falha com o painel acima; com a correção, o painel fica `0 de 3 · 0%`, sem chip ✕, `Um 0/1` e "filha-um parada".
4. `regras/sessoes.md`: cenário novo `sessoes.filha-parada-com-esc-sem-pendente`, entre `rodada-descartada-fora-da-contagem` e `-do-pai`, com estado `coberto` e `Código: draw/layout.ts`. A origem é a auditoria de 2026-11-10, aplicando as duas regras sem mudá-las, no mesmo padrão de `turno-de-abertura-da-filha-sob-a-origem`.
5. Selo: `npm run regras:selar -- 'task-tree/tests/sessoes.test.ts::a filha parada com Esc sem pendente sai da contagem, ✓ inclusive, e o cartão diz "parada"' --tipo novo --motivo "auditoria 2026-11-10, achado alto 10"`. O selo no diff tem a data 2026-11-11 e o hash 5192b3c7aaab1f70. Se o nome ou o corpo do teste mudar, selar de novo.
6. Aplicar de uma vez (recarga a quente): `git apply <diff>` grava os 5 arquivos juntos. Depois `npm run check`, e o commit local só desses caminhos:
   - caminhos: `regras/selos.json`, `regras/sessoes.md`, `task-tree/draw/layout.ts`, `task-tree/tests/sessoes.test.ts`, `task-tree/types/index.d.ts`;
   - título sugerido: `fix(task-tree): filha parada com Esc sem pendente sai da contagem e diz "parada"`.

## Impacto

`npm run impacto -- task-tree/draw/layout.ts task-tree/types/index.d.ts` (e sobre o diff real, igual):
- Núcleo tocado (`types/index.d.ts`): todos os 138 cenários cobertos entram, e o check roda todos.
- Golden: visual.desenho-principal, -cartao-filha, -envios, -subagente. O teste de golden passou, sem mudança no desenho.
- Checklist do app: o que esta mudança muda de visual. O cartão da filha parada com Esc sem pendente passa de ✓ "concluída" (tom done) para "parada" (tom paused), e o busto na linha da tarefa de origem passa a dizer "parada". Validar no app com uma filha real parada com Esc, nos dois temas.

## Saída do check (cópia, código novo)

```
ok regras · ok travas · ok selos · ok validate do marketplace · ok validate do mod · ok tsc · ok plugin test (190 pass, 0 fail) · ok regressao (189 testes de HEAD contra o código novo, 0 falharam)
```

Nota do ensaio: na cópia (clone no scratchpad), o `validate` não gerou `task-tree/.claude-plugin/types/`, e o tsc falhou por isso. Copiei a pasta do repositório real e o tsc passou. No repositório real a pasta já existe.

## Relação com outros achados

- Achado alto 11 (linha fantasma "+N pedidos anteriores" no cartão de filha parada): independente. Ele mexe em `body()` (comparação por id, por volta das linhas 1343/1361) e não toca `halt`, `discarded`, `parked` nem `atWork`. No teste novo não aparece linha fantasma, porque as tarefas são folhas e a segunda passada do `halt` não recria objetos. Os dois diffs mexem em `layout.ts`, `sessoes.test.ts`, `sessoes.md` e `selos.json` em trechos diferentes. Quem aplicar o segundo pode precisar só reaplicar contexto (e selar de novo se o hash do arquivo de teste depender da posição; o selo é por teste).
- Pergunta 15 da auditoria ("Interrompida", com concluídas e pendentes contando) e o achado médio "Duas regras se contradizem para a filha parada com Esc que tem pendentes": seguem em aberto e não dependem disto. Esta correção só alinha o caso sem pendente ao caso com pendente, como as regras já decidem. Se o usuário escolher a opção recomendada da pergunta 15, este cenário e `rodada-descartada-fora-da-contagem` serão reescritos juntos, com `Reescrito:`, e o teste novo será selado como decisão.
