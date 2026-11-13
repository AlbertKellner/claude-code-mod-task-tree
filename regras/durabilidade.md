# Durabilidade

O painel depois de reinício e recarga.

Código da área: state/durability.ts, hooks/panel.ts, hooks/session-start.ts

### durabilidade.reinicio-restaura-do-store
O reinício e a retomada restauram o painel do store.

- Dado um painel salvo no store
- Quando um processo novo roda o session.start, ou a sessão é retomada (resume) com outro painel no state
- Então o painel volta como estava no store (títulos, estados e números), com o trabalho da sessão retomada, e o start seguinte age sobre ele; um trabalho sem nenhuma tarefa presente não vale, e o painel nunca fica vazio por isso

Origem: regra do painel desde a entrada do mod (commit 465b09e); tabela de durabilidade, commit 9fb1c51, 2026-10-22.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); sem visão completa, o trabalho antigo deixava o painel vazio na retomada.
Estado: coberto

### durabilidade.respawn-sem-session-start
Num processo novo sem session.start, o painel volta no primeiro uso, e o store não encolhe.

- Dado o painel no store e um processo novo que não rodou o session.start
- Quando o painel é desenhado e o modelo chama start e done
- Então o painel aparece inteiro, o trabalho atual volta, e o store não encolhe

Origem: commits 59eb558 e fba6171, 2026-10-22.
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)").
Estado: coberto

### durabilidade.fim-do-turno-sobrevive-ao-reinicio
O fim do turno sobrevive ao reinício.

- Dado um turno que terminou (normal ou com Esc) com uma tarefa iniciada e aberta
- Quando um processo novo desenha o painel (session.start, respawn sem ele, ou retomada)
- Então nada fica ◉: a iniciada fica ◷ (✕ se o turno foi parado), o pai fica ◷, e o relógio não anda até o próximo pedido

Origem: decisões do usuário de 2026-10-27 (◉ só no caminho da última iniciada no turno atual; no fim do turno, a iniciada aguarda) aplicadas ao reinício; achado da tarefa 7, 2026-10-28.
Código: hooks/turn.ts, hooks/sessions.ts, hooks/render.tsx
Estado: coberto

### durabilidade.parada-com-esc-sobrevive-ao-reinicio
A tarefa parada com Esc segue interrompida num processo novo.

- Dado uma tarefa parada com Esc e, depois, um turno que não abriu pedido terminado normalmente
- Quando um processo novo desenha o painel (session.start)
- Então a parada segue ✕ e nada fica ◉; o pedido seguinte com start em outra tarefa não a reacende, e o start nela sim (turnos.parada-segue-interrompida-ate-o-start)

Origem: decisão do usuário, 2026-11-12 ("Segue ✕ até novo start (Recomendado)"), aplicada ao reinício: a marca da parada fica na própria tarefa, que o store guarda com o painel.
Código: hooks/turn.ts, state/tasks.ts, draw/layout.ts
Estado: coberto

### durabilidade.clear-esvazia
O /clear esvazia o painel.

- Dado um painel com tarefas
- Quando a pessoa usa /clear
- Então o painel fica "Nenhuma tarefa planejada."

Origem: regra do painel desde a entrada do mod (commit 465b09e).
Estado: coberto

### durabilidade.formatos-antigos-do-publicado
Os formatos antigos do arquivo publicado são lidos.

- Dado um arquivo publicado por uma versão antiga do mod (os 8 formatos que já existiram)
- Quando o painel lê a sessão filha
- Então o cartão aparece, sem erro, com as tarefas que o formato traz

Origem: contrato do arquivo publicado, commit 04fcae7, 2026-10-22 ("Já existiram 8 formatos", DESENVOLVIMENTO).
Reescrito: 2026-11-04, decisão do usuário ("remova os icones de reesumo e tarefas completas, deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)"); o teste só deixa de escolher a visão ou abre a linha.
Código: io/publish.ts, io/host.ts
Estado: coberto

### durabilidade.recarga-mantem-painel-ligacoes-e-resumo
A recarga a quente mantém o painel, as ligações e o recap do turno.

- Dado um painel com cartões ligados a tarefas e um recap do wrap_up
- Quando o mod recarrega a quente (módulo novo, state mantido, sem session.start)
- Então o painel e os cartões seguem iguais, e o fim do turno publica o recap gravado antes

Origem: bugs achados no teste visual do usuário, 2026-10-21/22; commits 946f653, 22650c9 e 13ef0ef.
Estado: coberto

### durabilidade.ligacoes-com-lista-parcial-do-host
A filha que a lista do host deixa de fora volta sob a mesma tarefa.

- Dado filhas ligadas a tarefas e uma lista do host que deixa uma delas de fora
- Quando a lista volta a listá-la
- Então o cartão volta sob a mesma tarefa

Origem: commit 13ef0ef, 2026-10-22.
Código: hooks/sessions.ts, io/host.ts
Estado: coberto

### durabilidade.resumo-do-done-na-recarga
O resumo do done chega à resposta do turno, mesmo com uma recarga no meio.

- Dado um done com summary e uma recarga a quente antes do fim do turno
- Quando o turno termina
- Então o resumo aparece como ↩ no cartão desta sessão, na sessão que a abriu

Origem: commits 946f653, 2026-10-21, e 22650c9; o ↩ sem resposta final foi corrigido na análise de 2026-10-29.
Código: hooks/turn.ts, hooks/tools.ts
Estado: coberto
