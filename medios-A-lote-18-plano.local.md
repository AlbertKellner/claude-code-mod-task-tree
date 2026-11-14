# Lote 18: Esc na principal com filha ou subagente vivo sob a tarefa

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário).

## 1. O que cobre

- Achado "Esc na principal: só a carta na fila poupa a tarefa; sessão filha viva e subagente em segundo
  plano deixam a tarefa ✕" (a parte do cartão do subagente que sumia foi resolvida no PR 36).
- Decisão 7, 2026-11-14: **"Segue ◉/◷ (Recomendado)"**. A opção: "Segue ◉ enquanto a filha trabalha e ◷
  enquanto o subagente roda: como a tarefa com carta na fila; o Esc para a principal, não o trabalho
  delegado. Reescreve a decisão de 2026-10-28 e 2026-10-30 para toda tarefa com trabalho delegado vivo."
- Ligada à decisão 21 da triagem B ("Fecha como no fim normal": depois do Esc, o fim do subagente em
  segundo plano fecha a tarefa), que é planejada pela B.

## 2. Causa confirmada na ponta atual

Escrito no código:
- `state/tasks.ts:73-79` (`park`): no Esc, toda folha aberta e iniciada ganha `stopped`.
- `draw/layout.ts:57-73` (`halt`) e `84-95` (`stay`): a folha `stopped` é lida como interrompida, salvo a
  que está na lista `sent` (as tarefas com carta ainda na fila), que fica ◷.
- A lista `sent` só tem cartas: `layout.ts:1046` (`sentFrom`), `hooks/panel.ts:347` (`showStatus`),
  `hooks/render.tsx:221` (a conta da sessão inteira) e `layout.ts:176` (o cartão de uma filha
  trabalhando).
- `layout.ts:1100-1106` (`rows`): o tom testa `interrupted` antes de `w.busy` (filha trabalhando sob a
  tarefa); a tarefa parada fica ✕ com o cartão "trabalhando" embaixo e o pai ◉.

Decisão registrada que esta reescreve: `envios.esc-apos-entrega-imediata` (2026-10-28 e 2026-10-30: "a
tarefa iniciada fica ✕ no Esc, como qualquer outra"), que cobre a tarefa cuja mensagem foi entregue.

## 3. O que muda

`draw/layout.ts`, `hooks/panel.ts`, `hooks/render.tsx`. `park` não muda (a marca `stopped` segue sendo
gravada; o que muda é a leitura enquanto há trabalho delegado vivo).

- Uma função nova em `draw/layout.ts` devolve, para um painel (grupos, cartas, filhas), "as tarefas que o
  fim do turno poupa": as de hoje (com carta na fila, sem `taken` e sem `cut`) e mais
  - a tarefa onde está a rodada atual de cada filha viva desse painel (`roundAt`: a do último envio,
    senão a de abertura; `live`: rodando ou esperando a pessoa, não arquivada);
  - a tarefa de onde saiu cada subagente do loop principal ainda rodando ou em segundo plano
    (`subLive`, `Group.anchor`).
- Essa lista entra onde hoje entra a das cartas: `layout()` (`halt` no fim do turno e `stayed` com o turno
  em curso), `panelOf` (o cartão de uma filha, trabalhando ou parada, com as cartas, filhas e subagentes
  do painel dela), `showStatus` e a conta da sessão inteira do `render`.
- O resto vem do que já existe: a folha poupada fica aberta com o relógio parado (◷, `leftWaiting`); com
  a filha trabalhando sob ela, `w.busy` a desenha ◉ com o tempo correndo; com o subagente rodando, fica
  ◷. Quando o trabalho delegado acaba, a tarefa sai da lista:
  - filha que para: a tarefa volta a ser lida pela marca do Esc, ✕ "interrompida" até o start nela
    (decisão de 2026-11-12), e o lembrete "terminou o turno" a cita, porque ela segue aberta;
  - subagente que termina: o fechamento automático de hoje a conclui (ou a deixa ✕ "falhou"), a
    decisão 21 da triagem B.
- A contagem do cartão desta sessão na mãe não muda (rodada parada com Esc fora da conta, decisão 15).

Comportamento novo no painel:
- Esc na principal com a filha trabalhando sob a tarefa X: X segue ◉, com o tempo correndo, o cartão
  "trabalhando" embaixo; quando a filha para, X fica ✕ até o start;
- Esc com um subagente em segundo plano lançado de X: X fica ◷ enquanto ele roda; quando ele termina, X
  fecha como no fim normal;
- sem trabalho delegado vivo, o Esc deixa X ✕, como hoje.

Textos ao modelo: não mudam.

## 4. Impacto

`npm run impacto -- draw/layout.ts hooks/panel.ts hooks/render.tsx`: núcleo tocado (`hooks/render.tsx`):
todos os 159 cenários cobertos. Golden: os 4; ver 8.

## 5. Testes

Novos, regra `turnos.esc-com-trabalho-delegado-vivo` (nova):
1. `tests/sessoes.test.ts`: **"no Esc, a tarefa com a filha trabalhando embaixo segue em andamento; quando
   a filha para, fica interrompida até o start"**. Roteiro: `const h = await abrir($, on, { painel: {
   tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })`; `esc($)`.
   Afirma: "Um" em andamento; `cabecalho(p).chips.interrompidas` 0; o cartão "filha-um" sem "parada".
   Depois `h.filha(K1).rodando = false`, `h.filha(K1).painel` com a tarefa concluída, `aviso`: "Um"
   interrompida. Depois `pedido($, 'segue')` e `start(['1'])`: "Um" em andamento.
   Falha hoje: logo depois do Esc, "Um" está interrompida.
2. `tests/subagentes.test.ts`: **"no Esc, a tarefa com subagente em segundo plano aguarda enquanto ele
   roda"**. Roteiro: `fixar`; `lancaveis(on, ['sub-1'])`; `pedido`; `plan(UM)`; `start(['1'])`;
   `lancar($, { descricao: 'varrer o repo', segundoPlano: true })`; `esc($)`.
   Afirma: "Investigar" aguardando; a linha do cartão contém "em segundo plano"; `chips.interrompidas` 0.
   Falha hoje: "Investigar" interrompida.
3. `tests/sessoes.test.ts`: **"no cartão de uma filha parada com Esc, a tarefa com neta trabalhando segue
   em andamento"**. Com `publicado` no `host`: a filha parada, `aborted: true`, a tarefa "Delegada"
   iniciada com `stopped: true`, e uma neta rodando ancorada nela. Afirma: "Delegada" em andamento.
   Falha hoje: interrompida.

Teste existente que muda (decisão registrada), `tests/envios.test.ts:228`, **mantendo o nome**:
- "depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem". O `host` do teste
  usa `{ id: 'local_x' }`, uma sessão rodando: com a decisão, a tarefa cuja sessão destino segue
  trabalhando sob ela não fica ✕ no Esc. O `host` passa a `{ id: 'local_x', rodando: false }` (a sessão
  destino já terminou o turno), com um comentário dizendo por quê; as asserções ficam iguais (com o lote
  07, o roteiro já tem o `pedido` e o `start` antes do `esc`).

Conferido por varredura dos testes com `esc`: os demais não têm filha viva nem subagente rodando sob a
tarefa parada (`visual.test.ts:29`: a filha está sob a tarefa de outro pedido; `envios.test.ts:556`: o
subagente termina logo depois do Esc; `envios.test.ts:448` e `:477`: destino arquivado).

## 6. Catálogo e selos

`regras/turnos.md`:

```markdown
### turnos.esc-com-trabalho-delegado-vivo
O Esc não interrompe a tarefa que tem trabalho delegado vivo embaixo.

- Dado uma tarefa iniciada com uma sessão filha trabalhando sob ela (a rodada atual da filha) ou um subagente ainda rodando lançado dela
- Quando a pessoa para o turno (Esc)
- Então ela segue ◉ enquanto a filha trabalha, com o tempo correndo, e ◷ enquanto o subagente roda, como a tarefa com carta na fila (envios.fila-nao-interrompe-no-fim-do-turno); quando a filha para, a tarefa fica ✕ até o start nela (turnos.parada-segue-interrompida-ate-o-start); quando o subagente termina, ela fecha como no fim normal; o mesmo dentro do cartão de uma filha; sem trabalho delegado vivo, o Esc a interrompe (turnos.esc-interrompe-so-a-iniciada)

Origem: decisão do usuário, 2026-11-14 ("Segue ◉/◷ (Recomendado)": "o Esc para a principal, não o trabalho delegado"). Reescreve, para a tarefa com trabalho delegado vivo, a decisão de 2026-10-28 e 2026-10-30 ("a tarefa iniciada fica ✕ no Esc, como qualquer outra").
Código: hooks/render.tsx, hooks/agents.ts
Estado: coberto
```

Cenários que ganham `Reescrito: 2026-11-14, decisão do usuário ("Segue ◉/◷ (Recomendado)")`:
- `envios.esc-apos-entrega-imediata`: no "Então", "a tarefa iniciada fica ✕ no Esc, como qualquer outra"
  ganha ", salvo enquanto a sessão destino segue trabalhando sob ela
  (turnos.esc-com-trabalho-delegado-vivo)". O teste muda (o destino passa a parado).
- `turnos.esc-interrompe-so-a-iniciada`: acrescentar ao "Então" "; a iniciada com trabalho delegado vivo
  embaixo não é interrompida (turnos.esc-com-trabalho-delegado-vivo)". O teste não muda.

Selos:

```bash
npm run regras:selar -- "task-tree/tests/envios.test.ts::depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem" --tipo decisao --motivo "decisão do usuário, 2026-11-14: \"Segue ◉/◷ (Recomendado)\"; o destino do teste passa a parado, porque com ele trabalhando a tarefa não é interrompida"
```

e `--tipo novo` para os três testes novos, com o motivo `decisão do usuário, 2026-11-14: "Segue ◉/◷
(Recomendado)"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho "A parada com Esc espera o `start`" (~591-604: "Com a carta dela na fila,
segue ◷") ganha a filha viva e o subagente rodando; entrada em "Decisões (histórico)".

## 8. Golden

Não deve mudar: no cenário "envios", a tarefa parada com Esc já é poupada pela carta na fila. Conferir.

## 9. Checklist do app

- Com uma filha real trabalhando sob a tarefa, apertar Esc na orquestradora: a tarefa segue ◉ e o tempo
  dela segue correndo; ao terminar a filha, ✕ até o start.
- Com um subagente real em segundo plano: ◷ depois do Esc, e a tarefa fecha quando ele termina.

## 10. Dependências e conflitos

- Depois do lote 17 (que já passa ao cartão da filha parada as cartas dela na fila; este estende a mesma
  lista) e do lote 07 (o mesmo teste de `envios.test.ts` muda nos dois; fazer nesta ordem).
- Lote 09 (turno que morre por erro): a tarefa "falhou" com trabalho delegado vivo segue a mesma regra.
- Triagem B: decisão 21 ("Fecha como no fim normal", as guardas de `settleBySubs` no Esc) é a outra
  metade desta; decisão 24 ("◉ como a filha" para a tarefa sem start com subagente rodando) mexe no tom
  em `rows`: a decisão 7 diz ◷ para a tarefa parada com Esc com subagente rodando; se as duas colidirem
  no mesmo `if`, vale ◷ para a tarefa parada (palavras do usuário) e ◉ para a que nunca recebeu start.
  As correções "nada mais em execução nela" e "os dois fechamentos automáticos" definem "trabalho vivo
  sob a tarefa" para o fechamento: usar a mesma noção.
- Triagem C: decisão 33 (processo novo com o turno em curso: "✕ interrompida") usa `park`.

## 11. Bloqueio

Nenhum.
