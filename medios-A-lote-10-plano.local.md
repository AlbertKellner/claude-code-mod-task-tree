# Lote 10: lembrete "terminou o turno" pela tarefa da rodada

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma correção direta).

## 1. O que cobre

- Achado "O lembrete "terminou o turno a sessão…" olha só a tarefa em que a filha foi aberta". Correção
  direta. Nenhuma decisão nova.

## 2. Causa confirmada na ponta atual

Escrito no código, `hooks/sessions.ts:257-279` (`endedNote`):
- as linhas do lembrete saem de `open.find(t => t.id === c.anchor)` (`sessions.ts:267`): só a tarefa em
  que a filha foi aberta, e só se ela ainda está aberta;
- na mesma função, o aviso "parou com a tarefa de origem já fechada" já usa a tarefa da última rodada
  (`settleCard`, que lê `c.lastAnchor ?? c.anchor`, `draw/layout.ts:194`);
- cada mensagem à filha grava uma rodada com a tarefa do envio (`hooks/tool-call.ts:126-136`,
  `Child.rounds`), e o envio fica em `sends` com a mesma tarefa e `taken` quando a filha o trata
  (`sessions.ts:112-196`).

Dedução: a filha foi aberta sob a tarefa 3 (já concluída) e depois recebeu uma mensagem enviada da 64.1
(em andamento). Ela termina o turno: nenhuma linha no lembrete, porque a 3 está fechada; a 64.1 fica
aberta sem o modelo ser lembrado de conferir o relato.

## 3. O que muda

Só `hooks/sessions.ts` (`endedNote`).

- A tarefa que o lembrete cita passa a ser, para cada sessão que terminou o turno, a primeira destas que
  estiver aberta:
  1. a tarefa da última rodada cuja mensagem a filha já tratou: entre as `rounds` dela, da mais nova
     para a mais antiga, a primeira que não tem envio ainda na fila (um `send` para essa sessão, pelo
     id ou pelo nome, com a mesma tarefa, sem `taken` e sem `cut`);
  2. a tarefa em que a filha foi aberta (`c.anchor`), como hoje.
- Não usar `c.lastAnchor` cru: ele muda no envio, antes de a filha tratar a mensagem; a filha que
  termina o turno de abertura com uma mensagem nova ainda na fila deve lembrar a tarefa de abertura.
- O texto do lembrete (`SESSION.ended`) e o aviso de pendentes (`SESSION.stopped`) não mudam.

Comportamento novo: quando a filha termina o turno que tratou a mensagem enviada da 64.1, o modelo recebe
"terminou o turno a sessão "<nome>" (tarefa de origem "64/64.1" …), e a tarefa de origem continua
aberta…". Com a tarefa da rodada já fechada e a de abertura aberta, segue citando a de abertura.

## 4. Impacto

`npm run impacto -- hooks/sessions.ts`: 46 cenários (sessoes 22, envios 17, subagentes 3, pedidos 2,
durabilidade 2). Checklist por mapa: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`; nada
muda neles. Golden: nenhum cenário.

## 5. Testes a escrever

`tests/lembretes.test.ts`, regra `lembretes.filha-terminou-o-turno` (nova; o lembrete não tem cenário
hoje). Ler o contexto com o `contexto(...)` do arquivo.

1. **"quando a filha termina o turno de uma mensagem, o lembrete cita a tarefa de onde a mensagem saiu"**.
   Roteiro: `const { relogio } = fixar(on)`; `const env = responderEnvio(on)`; `env.modo = 'entregue'`;
   `const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [], turns: [] } }])`; `pedido`;
   `plan` de "A" com "1" "Um" e "2" "Dois"; `start(['1'])`; `abrirSessao`; `aviso`; `done(['1'])`;
   `start(['2'])`; `relogio.advance(1000)`; `envio($, K1)`; `relogio.advance(1000)`;
   `h.recebeu(K1, AGORA + 1500)`; `aviso`; `h.filha(K1).rodando = false`;
   `const ctx = contexto(await aviso($))`.
   Afirma: `ctx` contém "terminou o turno a sessão" e `tarefa de origem "A/2" Dois`.
   Falha hoje: a tarefa de abertura ("Um") está fechada e o lembrete não sai.
2. **"com a mensagem nova ainda na fila, o lembrete do turno que terminou cita a tarefa de abertura"**.
   Roteiro: como em 1, sem o `done(['1'])` e com o envio na fila (`responderEnvio` no modo padrão, sem
   `h.recebeu`); `h.filha(K1).rodando = false`; `const ctx = contexto(await aviso($))`.
   Afirma: `ctx` contém `tarefa de origem "A/1" Um` e não contém `"A/2"` como tarefa de origem.
   Passa hoje: protege contra a correção errada (usar a tarefa do último envio).
3. **"com a tarefa da rodada já fechada e a de abertura aberta, o lembrete cita a de abertura"**. Roteiro:
   como em 1, sem o `done(['1'])` e com `done(['2'])` depois da entrega. Afirma: `ctx` contém `tarefa de
   origem "A/1" Um`.
   Passa hoje: protege o caso que não pode se perder.

Testes existentes: nenhum muda (`sessoes.test.ts:630`, "a mãe é avisada de que a filha parou com
pendentes", usa o outro aviso).

## 6. Catálogo e selos

`regras/lembretes.md`:

```markdown
### lembretes.filha-terminou-o-turno
Quando uma sessão filha termina o turno, o modelo é lembrado da tarefa de origem daquele trabalho.

- Dado uma filha aberta de uma tarefa, que depois recebeu mensagens enviadas de outras tarefas
- Quando ela termina um turno
- Então, uma vez, o modelo recebe o lembrete de conferir o relato e fechar o que o trabalho delegado concluiu, citando a tarefa da última mensagem que a filha já tratou, se ela segue aberta, senão a tarefa em que a filha foi aberta; a mensagem ainda na fila não muda a tarefa citada; sem nenhuma das duas aberta, não há lembrete

Origem: regra do painel desde a entrada do mod (o lembrete, sem cenário até aqui); auditoria 2026-11-10 (triagem de 2026-11-13: o lembrete olhava só a tarefa de abertura, enquanto o painel já tratava a tarefa da última rodada como a origem). Aplica sessoes.um-cartao-por-mensagem, sem mudar nenhuma regra.
Código: hooks/sessions.ts, hooks/tool-call.ts
Estado: coberto
```

Selos:

```bash
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::quando a filha termina o turno de uma mensagem, o lembrete cita a tarefa de onde a mensagem saiu" --tipo novo --motivo "correção direta: lembrete pela tarefa da rodada"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::com a mensagem nova ainda na fila, o lembrete do turno que terminou cita a tarefa de abertura" --tipo novo --motivo "correção direta: lembrete pela tarefa da rodada"
npm run regras:selar -- "task-tree/tests/lembretes.test.ts::com a tarefa da rodada já fechada e a de abertura aberta, o lembrete cita a de abertura" --tipo novo --motivo "correção direta: lembrete pela tarefa da rodada"
```

## 7. Documentação

`DESENVOLVIMENTO.md`: onde descreve `endedNote` ("Fluxo de dados", passo das sessões), uma frase com a
ordem nova das duas tarefas.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada novo (o lembrete é texto ao modelo; o harness o lê).

## 10. Dependências e conflitos

- Independente dos lotes anteriores.
- Lote 12 (leitura das filhas) mexe em `refreshChildren` e `recordStart`, no mesmo arquivo; lote 14
  (adoção pelo plan) muda âncoras de cartões: a tarefa citada segue sendo a da rodada depois da adoção.
- Triagem C: a correção ""a mãe é avisada de que ela parou com N pendentes" só acontece se a origem já
  estava fechada" mexe na segunda metade de `endedNote` (a lista `left`). Triagem B: a correção do
  lembrete "recebimento confirmado" mexe em `takenNote`, ao lado. Conflito de linhas vizinhas.

## 11. Bloqueio

Nenhum.
