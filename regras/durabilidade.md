# Durabilidade

O painel depois de reinício e recarga.

### durabilidade.reinicio-restaura-do-store
O reinício e a retomada restauram o painel do store.

- Dado um painel salvo no store
- Quando um processo novo roda o session.start, ou a sessão é retomada (resume) com outro painel no state
- Então o painel volta como estava no store (títulos, estados e números), e o start seguinte age sobre ele

Origem: regra do painel desde a entrada do mod (commit 465b09e); tabela de durabilidade, commit 9fb1c51, 2026-10-22.
Estado: coberto

### durabilidade.respawn-sem-session-start
Num processo novo sem session.start, o painel volta no primeiro uso, e o store não encolhe.

- Dado o painel no store e um processo novo que não rodou o session.start
- Quando o painel é desenhado e o modelo chama start e done
- Então o painel aparece inteiro, a visão escolhida e o trabalho atual voltam, e o store não encolhe

Origem: commits 59eb558 e fba6171, 2026-10-22.
Estado: coberto

### durabilidade.fim-do-turno-sobrevive-ao-reinicio
O fim do turno sobrevive ao reinício.

- Dado um turno que terminou (normal ou com Esc) com uma tarefa iniciada e aberta
- Quando um processo novo desenha o painel (session.start, respawn sem ele, ou retomada)
- Então nada fica ◉: a iniciada fica ◷ (✕ se o turno foi parado), o pai fica ◷, e o relógio não anda até o próximo pedido

Origem: decisões do usuário de 2026-10-27 (◉ só no caminho da última iniciada no turno atual; no fim do turno, a iniciada aguarda) aplicadas ao reinício; achado da tarefa 7, 2026-10-28.
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
Estado: coberto

### durabilidade.resumo-do-done-na-recarga
O resumo do done chega à resposta do turno, mesmo com uma recarga no meio.

- Dado um done com summary e uma recarga a quente antes do fim do turno
- Quando o turno termina
- Então o resumo aparece como ↩ no cartão desta sessão, na sessão que a abriu

Origem: commits 946f653, 2026-10-21, e 22650c9; o ↩ sem resposta final foi corrigido na análise de 2026-10-29.
Estado: coberto
