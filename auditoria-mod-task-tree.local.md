# Auditoria do mod task-tree

Data: 2026-11-10. Só leitura: nada foi alterado no repositório, e nenhum teste nem `npm run check` foi rodado.

## O que foi auditado

- Código no disco na branch `feat/ultracode-no-cartao`, que é igual ao `main` atual (v0.14.0, com o toks/s medido como o session-band e o ultracode no cartão da filha já mergeados), salvo o número de versão do `plugin.json`.
- Três fontes comparadas: o código (`task-tree/hooks`, `draw`, `state`, `io`, `text/rules.ts`, `types`), o catálogo (`regras/*.md` e `regras/selos.json`) e a documentação (`task-tree/DESENVOLVIMENTO.md`, `CLAUDE.md`, `README.md`). Os scripts de trava e os workflows de CI entraram como área secundária.

## Como foi feito

1. Leitura: 30 leitores independentes, por área do código, por fluxo (recarga, Esc, fim de vida da sessão, uso fora do roteiro, falhas, concorrência, limites, tempo), por arquivo do catálogo, por documento e quatro dedicados ao cartão solto. Saíram 545 apontamentos brutos.
2. Deduplicação: 287 depois de juntar por área, 243 depois de juntar entre áreas.
3. Verificação: os 150 achados de severidade alta e média foram conferidos de novo, um a um, contra o código e contra as decisões já registradas no catálogo e na documentação. Dois foram descartados e vários tiveram severidade, evidência ou proposta corrigidas.
4. O trecho do `plan` que decide entre replano e pedido novo (`task-tree/hooks/tools.ts:47-113`) e a renomeação das âncoras (`task-tree/hooks/panel.ts:643-657`) foram conferidos também por mim.

## Resumo

241 achados ficaram de pé e 2 foram descartados.

| Severidade | Confirmados na verificação | Suspeitas | Sem segunda verificação | Total |
|---|---|---|---|---|
| Alta | 12 | 1 | 0 | 13 |
| Média | 93 | 12 | 0 | 105 |
| Baixa | 19 | 11 | 93 | 123 |

- "Confirmado na verificação": o problema foi reproduzido pela leitura do código, passo a passo, por um segundo leitor.
- "Suspeita": o caminho existe no código, mas o gatilho depende de comportamento do app ou do harness que o código não mostra.
- "Sem segunda verificação": apontado na leitura (80 como confirmados, 13 como suspeita) e não conferido de novo. São todos de severidade baixa.

### Os 13 de severidade alta

1. **Replanejar numa mensagem seguinte zera o estado.** O nível 1 que continua aberto vira histórico interrompido, a cópia nova nasce toda pendente, e o cartão e a carta ficam com a cópia antiga. O comportamento é decisão registrada, mas os textos ao modelo prometem o contrário. Confirmado. (Planejamento e estado)
2. **O trabalho atual não acompanha a renomeação do nível 1.** O pedido antigo com cartão vivo sai de vista e o cartão fica solto; no sentido inverso, um pedido antigo já concluído pode continuar à vista. Confirmado. (Sessões filhas e cartões)
3. **O primeiro turno da filha é marcado como "pedido do usuário na filha".** O cartão de abertura sai da tarefa de origem e ganha o rótulo errado. Confirmado, inclusive em arquivos publicados reais. (Sessões filhas e cartões)
4. **Plano que reusa um id não renomeia a âncora dos grupos de subagente.** Cartões antigos caem sob a tarefa nova, e ela fecha sozinha no fim do turno. Confirmado. (Subagentes)
5. **O cartão do subagente some quando a tarefa de origem fecha**, mesmo com o subagente rodando; o da sessão e a carta ficam. O catálogo diz que o cartão segue. Confirmado. (Subagentes)
6. **O fechamento automático pela conclusão dos subagentes olha subagentes de turnos anteriores.** Uma tarefa reaberta ou deixada aguardando é fechada pelo fim de um subagente antigo. Confirmado. (Subagentes)
7. **Subagentes lançados em paralelo não se enxergam**, e o cartão de grupo não se forma. É intermitente: numa sessão, 10 lançamentos em 850 ms caíram em 3 lotes. Confirmado. (Subagentes)
8. **Carta na fila sem saída.** Destino que nunca confirma (arquivado, sumido) deixa a tarefa presa, o relógio de 1 s ligado e o resumo sem reiniciar. Confirmado. (Envios)
9. **Um aviso automático depois do Esc reacende as tarefas interrompidas** e apaga a marca de turno interrompido. Confirmado. (Turnos e pedidos)
10. **Filha parada com Esc: o descarte é decidido depois da interrupção.** As tarefas concluídas dela continuam contando e o cartão diz "concluída". Confirmado. (Sessões filhas e cartões)
11. **Linha "+N pedidos anteriores" fantasma dentro do cartão de filha parada.** Nada está escondido, e abrir a linha não mostra nada novo. Confirmado. (Desenho e cabeçalho)
12. **Limite de 400 linhas e limite de 600 KB não se conciliam.** O aviso "Painel grande demais" pode aparecer sem nada aberto por você, e o botão de voltar não faz nada. Confirmado. (Desenho e cabeçalho)
13. **Mensagem entregue no meio do turno abre pedido novo**, derruba a pergunta aberta e manda planejar; o replano seguinte cai em "pedido novo". Suspeita: depende de o app entregar o prompt com o turno em curso. (Turnos e pedidos)

### O que ficou sem verificar

- Os 93 achados de severidade baixa não tiveram segunda verificação.
- O crítico de completude não rodou. Os itens que os leitores notaram de passagem e não investigaram (390) estão no anexo `auditoria-mod-task-tree-anexo.local.md`, sem verificação.
- Nada foi conferido no app: as 24 suspeitas dependem de um registro no app (origem do prompt, ordem de eventos, o que a lista de sessões devolve) antes de qualquer correção.
- A deduplicação foi automática; podem restar achados parecidos em áreas diferentes (por exemplo, o mesmo limite de 100 sessões aparece duas vezes em "Sessões filhas e cartões").

## Prioridade: cartão solto de sessão filha e replanejamento que perde o estado

### Causa raiz

Para o painel, "o mesmo pedido" é o turno aberto pela última mensagem. O `plan` só trata como replano (mantendo o estado) o nível 1 aberto cujo turno é o turno atual. Qualquer mensagem nova abre turno, inclusive a mensagem de outra sessão. Numa orquestradora, cada relato de filha é um "pedido novo".

Os textos que o modelo lê não dizem isso. Eles mandam replanejar o nível 1 inteiro mantendo os ids, "que guardam o estado", sem a condição de ser no mesmo pedido. O modelo segue o texto e cai, em uso comum, no caminho que zera o estado.

### Como o replano com ids iguais trata o estado

- `task-tree/hooks/tools.ts:61-63`: `sameRequest` só é verdadeiro quando o turno da tarefa é o turno atual; `replanned` exige tarefa aberta, id repetido e `sameRequest`.
- No mesmo pedido: a tarefa é substituída no lugar e o estado das que mantêm o id é preservado (`carry`).
- Em pedido novo (`tools.ts:67` e `76-78`): o nível 1 antigo é interrompido (o que estava aberto vira ✕), renomeado com um prefixo aleatório e fica como histórico no pedido antigo. O nível 1 novo entra todo pendente, no turno novo.
- Isso é decisão registrada: cenário `pedidos.plano-anterior-vira-historico` (2026-10-23, confirmado em 2026-10-27, reescrito em 2026-11-04), com teste selado em `task-tree/tests/pedidos.test.ts:51-72`.
- Os textos que prometem o contrário: `task-tree/text/rules.ts:38-42` (regra de replanejar), `68-71` (descrição da ferramenta `plan`) e `124-129`, `137-144` (lembretes de depois do Esc, que chegam justamente na mensagem que já abriu o turno novo).

### Por que a âncora se perde e o que manda o cartão para "solto"

- A âncora do cartão e da carta é o id completo da tarefa, escolhido uma vez (no envio ou na abertura) e casado com a árvore a cada desenho.
- No replano em pedido novo, `renameAnchors` (`task-tree/hooks/panel.ts:643-657`) leva a âncora do cartão e da carta para a cópia antiga renomeada. O cartão continua ligado à tarefa certa, que agora é histórico.
- O trabalho atual guarda o id cru. Em pedido novo, `kept` fica vazio (`tools.ts:110-112`; `startsWork` em `panel.ts:593-603`), então o pedido antigo sai do trabalho à vista, mesmo com cartão vivo. A checagem de "há algo aberto" enxerga o nível 1 novo, que tem o mesmo id.
- Resultado: o pedido antigo vai para "+N pedidos anteriores" e o cartão vivo, que nunca pode sumir (`sessoes.cartao-vivo-nunca-some`), é desenhado solto no fim, com "· do pedido '<título do pedido antigo>'".
- Voltar a pendente ou fechar a origem, por si, não solta o cartão. O que solta é o nível 1 dele sair do trabalho à vista.

### Reprodução passo a passo

Primeira sequência (a do print):

1. Mensagem A abre o turno 1. `plan` com 64 e filhos: nível 1 "64" no turno 1; trabalho atual = ["64"].
2. `start 64.1`: "64/64.1" em andamento.
3. `SendMessage` à filha: carta e cartão ancorados em "64/64.1".
4. Mensagem B abre o turno 2. `plan` com o mesmo "64" e o "65": o "64" antigo é do turno 1, então não é replano. Ele é interrompido (64.1 vira ✕) e renomeado; entra um "64" novo, pendente, no turno 2. A âncora do cartão segue a cópia antiga. O trabalho atual vira ["64", "65"] (as novas). O pedido antigo sai de vista e o cartão aparece solto.

Segunda sequência (64.1, 64.2 e 64.3 concluídos, plan com o mesmo "64" mais 64.5): mesmo caminho. O "64" antigo fica como histórico com as concluídas, o novo nasce com tudo pendente. O `done` que o modelo dá para restaurar as três gera "3 etapas fecharam juntas sem start".

### Efeitos colaterais da mesma causa

- **Título do grupo com o nome do pedido mais novo:** o "64" novo pertence ao turno novo, cujo título é o `request` novo. Há um segundo caminho independente: todo `plan` com `request` renomeia o último turno, mesmo depois de um aviso automático que não abriu turno (`tools.ts:86-94`).
- **Dois cartões da mesma sessão:**
  - o primeiro turno da filha (o texto do `start_session`) é marcado como turno próprio, e o cartão de abertura vai para o último nível 1 do pedido vigente com o rótulo "pedido do usuário na filha" (`task-tree/draw/layout.ts:327-332`);
  - cada turno aberto direto na filha vira um cartão separado, nunca fundido;
  - uma mensagem posterior à mesma filha ancora na tarefa nova, enquanto o cartão antigo fica solto.
- **Subagentes:** `renameAnchors` não renomeia a âncora dos grupos de subagente. Os cartões antigos caem sob a tarefa nova de mesmo id, e o fechamento automático a conclui sozinha no fim do turno.
- **Dobra herdada:** a dobra de uma tarefa é guardada pelo id; o id reusado herda a dobra da tarefa antiga.

### Por que os testes não pegam

- Os testes da visão resumida (`task-tree/tests/cabecalho.test.ts:35-76`) usam ids diferentes em cada pedido; nenhum reutiliza id entre pedidos.
- O teste do plano anterior que vira histórico não tem cartão nem carta.
- Os testes de sessões fabricam o primeiro turno da filha sem a marca de turno próprio, que os arquivos reais trazem.
- Nenhum cenário do catálogo diz o que acontece com cartão e carta quando a tarefa de origem é replanejada.

### Proposta de correção, em ordem

Sem depender de decisão sua (aplicam regras que já existem):

1. Traduzir o trabalho atual pelos ids renomeados antes de juntar o plano novo. O pedido antigo com cartão vivo ou carta na fila fica inteiro à vista, com o cartão sob a tarefa de origem; sem nada aberto, sai. Corrige o cartão solto mesmo que a regra do replano fique como está.
2. Renomear também a âncora dos grupos de subagente em `renameAnchors`, e fazer o fechamento automático ignorar subagentes que terminaram antes do turno atual.
3. Não tratar o turno de abertura da filha como turno próprio. A correção precisa existir no lado da mãe, porque os arquivos já publicados trazem a marca.
4. Fazer o resultado do `plan` dizer o que foi interrompido, renomeado ou zerado.
5. Corrigir os textos de `rules.ts` em qualquer caso: hoje prometem o estado guardado sem a condição de pedido.
6. Cenários e testes novos: replano com cartão e carta, id reutilizado entre pedidos, filha que publica o primeiro turno como próprio.

Dependem de decisão sua (estão nas perguntas abaixo): tratar como continuação o nível 1 aberto replanejado em mensagem seguinte; qual `request` dá o título do pedido; fundir os cartões de turnos abertos direto na filha.

### Confirmado e suspeita

- Confirmado pela leitura, por mais de um leitor e na verificação: todo o caminho acima.
- Não conferido no app: a ordem exata dos eventos no print. A reprodução é por leitura do código, e a frequência com que o primeiro prompt da filha chega marcado como próprio varia (em algumas filhas reais ele chegou como mensagem de outra sessão).

## Perguntas ao usuário

A primeira opção de cada pergunta é a recomendada.

### Replanejamento e pedidos

1. **Plan numa mensagem seguinte com um nível 1 que continua aberto (mesmo id e mesmos filhos): continuação ou pedido novo?**
   - Continuação (Recomendada): mantém o estado das tarefas que mantêm o id; o nível 1 fica no pedido em que estava; cartão e carta seguem sob a tarefa. Id reutilizado com árvore diferente continua virando histórico. Reescreve a decisão de 2026-10-27.
   - Manter a regra atual: todo id reutilizado em pedido novo vira histórico; então os textos ao modelo passam a dizer para não replanejar tarefa que continua.
2. **Um segundo `plan` no mesmo pedido, com outro `request`, muda o título do pedido?**
   - Não, vale o primeiro (Recomendada).
   - Sim, vale o último, como hoje.
3. **Mensagem que chega com a sessão no meio do turno abre pedido novo na hora?**
   - Só quando o turno em curso terminar (Recomendada).
   - Na hora, como hoje.
4. **Pedido que termina sem nenhuma tarefa: onde vai o resumo ↩?**
   - Num pedido próprio só com a linha ↩ quando há summary, e em lugar nenhum quando não há (Recomendada).
   - No pedido anterior, como hoje (sobrescreve o ↩ de um pedido já encerrado).
5. **Nível 1 que fechou sozinho e recebe, no mesmo pedido, um plan com o mesmo id e um passo a mais:**
   - Reabre mantendo as concluídas (Recomendada).
   - Fica como histórico, com um segundo nível 1 todo pendente ao lado, como hoje.
6. **`start` num pai aberto:**
   - Inicia a primeira folha aberta dele (Recomendada).
   - É recusado com aviso.
7. **Tarefa que o modelo abandona porque você mudou de rumo:**
   - Aparece ✕ interrompida e sai do x/y, com um jeito explícito de o modelo marcar isso (Recomendada).
   - ✓ concluída, como hoje.

### Esc, falhas e turnos

8. **Depois do Esc, a tarefa que você parou:**
   - Segue ✕ até o modelo dar start nela de novo, inclusive enquanto ele trata um aviso automático (Recomendada). Parte disso quebra um teste selado (`turnos.test.ts:133-146`).
   - Volta a ◉ sozinha no prompt seguinte, como hoje.
9. **No Esc da principal, a tarefa que tem filha trabalhando ou subagente em segundo plano:**
   - Segue ◉ enquanto a filha trabalha e ◷ enquanto o subagente roda, como a tarefa com carta na fila (Recomendada). Contraria a decisão de 2026-10-28 sobre o Esc depois da entrega imediata.
   - Fica ✕, como hoje.
10. **Depois de um Esc, o fim do último subagente fecha a tarefa sozinho?**
    - Não: fica como o Esc deixou (Recomendada).
    - Sim, como no fim normal.
11. **Turno que morre por erro de API ou limite de contexto:**
    - Tarefa em andamento ✕ "falhou", como no subagente (Recomendada).
    - ✕ "interrompida".
    - ◷ aguardando, como hoje.
12. **App fechado no meio do turno: ao reabrir, a tarefa que estava em andamento:**
    - ◷ aguardando (Recomendada).
    - ✕ interrompida.

### Sessões filhas e cartões

13. **Turnos abertos direto na filha:**
    - Entram no cartão que a sessão já tem naquele ponto, com uma linha de pedido por turno (Recomendada). Muda a decisão de 2026-11-03 de um cartão por turno.
    - Um cartão por turno, como hoje.
14. **Cartão de uma rodada anterior que a filha largou com tarefa aberta:**
    - Palavra própria ("substituída"), cinza e fora do chip de sessões (Recomendada).
    - Some para dentro de "+N pedidos anteriores".
    - Fica como hoje ("parada" ou trabalhando).
15. **Filha parada com Esc sem nada pendente: qual a palavra do cartão, e as tarefas dela contam?**
    - "Interrompida", e as concluídas e pendentes seguem contando no cabeçalho da mãe (Recomendada). Duas decisões suas se cruzam aqui (2026-10-24 e 2026-10-28).
    - "Concluída" e rodada fora da contagem, como hoje.
16. **`/clear` numa filha:**
    - O cartão na mãe mantém o que ela já tinha feito, como histórico (Recomendada).
    - Esvazia junto com a filha, como hoje.
17. **Carta na fila cujo destino foi arquivado ou sumiu:**
    - Carta cinza "não entregue" e a tarefa volta a ser comum (Recomendada).
    - A carta some.
18. **Carta de uma tarefa abandonada por pedido novo, depois de entregue:**
    - Segue o estado real da mensagem, azul e depois verde (Recomendada). Muda um teste selado.
    - Fica cinza, como hoje.
19. **Com uma tarefa em andamento e um passo novo pendente planejado depois dela, carta e cartão ficam sob qual?**
    - Sob a tarefa em andamento, que é o que as regras dizem ao modelo (Recomendada). Há um pedido seu registrado no sentido de hoje (`DESENVOLVIMENTO.md:1211-1216`).
    - Sob o passo novo, como hoje.
20. **Filha aberta por clique num cartão proposto ou por hand-off:**
    - Fica sob a tarefa em andamento quando o cartão foi proposto (Recomendada).
    - No fim do pedido vigente quando você clicou.
21. **`wrap_up` com pergunta que não bloqueia o trabalho:**
    - Só a pergunta bloqueante conta como espera; a outra aparece só como palavra no cartão (Recomendada).
    - Toda pergunta vira "Aguardando sua escolha", como hoje.
22. **Tarefa da mãe com `done` e filha ainda trabalhando: qual das duas frases suas vale?**
    - "As linhas pai só ficam concluídas quando as filhas concluírem", que é o que o código, o teste e o catálogo fazem (Recomendada); registrar a data no catálogo e tirar a frase oposta do documento.
    - "Um done explícito da mãe vale como concluído".

### Subagentes

23. **Subagente falha, o modelo lança outro da mesma tarefa e ele conclui:**
    - Tarefa ✓, vale a última tentativa (Recomendada). Muda a regra "vale o pior", coberta por teste selado.
    - Tarefa ✕ "falhou".
24. **Enquanto um subagente roda sob uma tarefa sem start, ela aparece ◉?**
    - Sim, como acontece com a sessão filha (Recomendada). Contraria a letra de "sem start, nada aceso" (2026-10-23).
    - Não, como hoje.
25. **As tarefas que um subagente planeja entram no "d de n"?**
    - Não, ficam fora de toda contagem, como o cartão (Recomendada).
    - Sim, no cabeçalho e nas linhas acima.
26. **Mensagem do loop principal a um subagente ou teammate vira carta?**
    - Não: carta só entre sessões (Recomendada); já há palavras suas nesse sentido (2026-10-30).
    - Sim, como hoje.

### Desenho, tempo e limites

27. **Desenho padrão acima de 600 KB sem nada aberto por você:**
    - Cortar os blocos mais antigos até caber, sem aviso (Recomendada).
    - Manter o aviso e fazer o botão mostrar só o que está em andamento.
28. **Definição do tempo (quatro pontos ligados):**
    - Tarefa que atravessa turnos conta só enquanto o turno está em curso; cabeçalho para no fim do turno, como as linhas; pai e pedido contam do primeiro start; o tempo inclui as filhas abertas a partir da tarefa (Recomendada).
    - Tempo de parede, do primeiro start ao fechamento, como hoje em parte.
29. **Cabeçalho estreito (abaixo de 84 colunas): toks/s e "ultracode"**
    - Mostrar sempre, pelo menos o "ultracode" (Recomendada). Muda o desenho aprovado a 60 colunas e o golden.
    - Omitir, como hoje.
30. **"Sessão inteira: a de b", que perdeu o lugar com a remoção do tooltip:**
    - Volta visível na linha "+N pedidos anteriores" ou junto do "d de n" (Recomendada).
    - Sai de vez.
31. **Faixa do cabeçalho:** entre um done e o start seguinte, com o turno rodando, segue âmbar; com só a filha trabalhando, azul "sessão ativa" (Recomendada, é o que o cenário diz). Ou fica como hoje.

### Estado, poda e documentação

32. **O que pode ser podado do estado e dos arquivos publicados:**
    - Filha arquivada vira uma linha com nome e contagem depois que o pedido sai do trabalho atual; grupos de subagente terminados que não usaram o painel são apagados; o arquivo publicado perde a cópia antiga das tarefas e leva as filhas cortadas ao trabalho atual; o painel de uma sessão parada vive enquanto a sessão existir no app (Recomendada). Parte toca "Arquivada fica, como histórico" e "Ficam em '+N pedidos anteriores'".
    - Nada é podado, como hoje (o store tem teto de 4 MiB e guarda só 30 painéis; a pasta de arquivos publicados já tem 3,5 MB).
33. **Recarga do mod com o painel fechado por você:**
    - Não reabre sozinho; abre só em processo novo e no seu próprio prompt (Recomendada).
    - Reabre, como hoje.
34. **Pergunta com tarefa aberta mas não iniciada:**
    - Aceitar e pendurar a espera na tarefa pendente do pedido atual (Recomendada).
    - Recusar pedindo start (reescreve um cenário coberto).
35. **Golden:**
    - Ampliar para cobrir ✕, anel, modelo, carta interrompida, seção e cabeçalho largo, com a sua validação no app (Recomendada).
    - Só corrigir o texto do catálogo, que hoje diz travar o que o golden não contém.
36. **Textos ao modelo sem cenário nem teste:**
    - Cenários que confiram quando cada texto sai e os trechos essenciais (Recomendada).
    - Golden letra por letra, como o do SVG.
37. **Documentação desatualizada (`DESENVOLVIMENTO.md` cita funções, comandos e tabelas que não existem mais):**
    - Atualizar agora, num trabalho só (Recomendada). A memória do projeto registra "sem docs até você pedir" (2026-10-23), por isso é pergunta.
    - Deixar para depois.
38. **Memória do projeto x `CLAUDE.md`:** a memória diz "suíte removida em 2026-10-23", e o `CLAUDE.md` descreve a suíte completa (decisões de 2026-10-28). Confirma que vale o `CLAUDE.md` e que a nota da memória deve ser reescrita?
39. **Release: título de PR fora do formato Conventional Commits**
    - Falha com erro claro (Recomendada).
    - Continua virando patch, como hoje.

# Achados por área

## Planejamento e estado das tarefas (plan, start, done)

19 achados: 1 de severidade alta, 6 média, 12 baixa.

### Replanejar numa mensagem seguinte um nível 1 que continua aberto não é tratado como replano: o antigo vira histórico interrompido, a cópia nova nasce toda pendente e o cartão e a carta ficam com a cópia antiga
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/text/rules.ts:124-129, 137-144 — PROMPT.interrupted e interruptedByYou mandam, na mensagem seguinte ao Esc (que já abriu turno novo em hooks/prompt-submit.ts:88), replanejar o nível 1 inteiro 'mantendo os ids das tarefas que continuam, que guardam o estado': é exatamente o caminho que cai em pedido novo e perde o estado
  - task-tree/text/rules.ts:68-71 — a descrição da ferramenta plan repete 'uma aberta com o mesmo id é substituída no mesmo lugar', sem a condição de pedido
  - task-tree/tests/pedidos.test.ts:51-72 — o teste selado cobre o comportamento atual (start, fim do turno, pedido novo, plan com o mesmo id: antigo no histórico com as abertas ✕, novo pendente)
  - task-tree/DESENVOLVIMENTO.md:100 — a doc descreve o comportamento como intencional
- **Regra do catálogo:** pedidos.plano-anterior-vira-historico (Um plano de pedido anterior com o mesmo id vira histórico); lembretes.replanejar-apos-esc-pessoa (o texto do lembrete promete o estado guardado)
- **Cenário:** Reprodução do caso relatado, pelo código. (1) Mensagem A abre o turno T1; plan 64{64.1,64.2,64.3}: nível 1 '64' com turn=T1, work=['64']. (2) start 64.1: '64/64.1' em andamento. (3) SendMessage à filha: `sendAnchor` devolve '64/64.1'; a filha ganha `lastAnchor` e uma rodada com essa âncora, o envio fica {anchor:'64/64.1', taken}. (4) Mensagem B: `openTurn` cria T2. plan 64{mesmos ids}+65: `nowTurn`=T2, o '64' antigo tem turn=T1, logo `sameRequest` é falso: o antigo é interrompido (64.1, 64.2 e 64.3 viram ✕) e renomeado 'ab12:64'; entra um '64' novo, turn=T2, com 64.1-64.3 pendentes (por isso '64.1 voltou a pendente' e, depois, 'os três concluídos voltaram a pendente'); o grupo do '64' passa a ser o pedido T2, com o título do `request` novo. `renameAnchors` leva a âncora do cartão e a da carta para 'ab12:64/64.1'. O work fica ['64','65'] (as tarefas novas), o pedido T1 sai de vista e o cartão, se vivo, é desenhado solto no fim com '· do pedido "<título de T1>"'. Uma mensagem posterior à mesma filha ancora na tarefa nova: dois cartões da mesma sessão, um solto e um sob a tarefa. O done que o modelo dá para restaurar 64.1-64.3 gera '3 etapas fecharam juntas sem start'. Repete-se a cada mensagem nova (do usuário ou de uma filha por SendMessage), porque `PROMPT.request` manda planejar em toda mensagem e o modelo, seguindo a regra de texto, replaneja o '64' que continua. Respostas diretas: a âncora é o id completo da tarefa (string), escolhido uma vez no envio ou na abertura (`sendAnchor`) e casado com a árvore a cada desenho; deixa de valer quando o id some do plano, quando a tarefa que o tinha é renomeada (pedido novo ou nível 1 fechado com id reutilizado) ou quando o nível 1 dela sai do trabalho à vista; voltar a pendente ou fechar a origem, por si, não solta o cartão.
- **Proposta:** Em `planTool` (hooks/tools.ts 62-67), tratar como replano (com `carry`, no lugar e no turno em que estava) o nível 1 aberto de pedido anterior quando o plano novo é continuação dele: mesmo id e mesmo título de nível 1 (normalizado como em `plain`), ou alguma filha com o mesmo id e o mesmo título. Nesse caso ele não entra em `renamed`, as âncoras não mudam (cartão e carta seguem sob 64.1) e o estado é preservado; o nível 1 novo de verdade (65) vai para o turno novo. Id reutilizado com título diferente segue virando histórico, como hoje (o teste atual continua passando). A correção reescreve o cenário pedidos.plano-anterior-vira-historico, decisão confirmada pelo usuário: vira pergunta antes. Junto, cenário e teste novos: plan, start, envio/abertura de sessão, pedido novo, plan com o mesmo id e título, e o cartão segue sob a tarefa, que segue em andamento.
- **Ajuste da verificação à proposta:** A proposta já prevê a pergunta, e precisa: reescreve cenário coberto por decisão do usuário e o teste selado. Qualquer que seja a resposta, os textos têm de mudar: se a regra atual ficar, RULES, a descrição do plan e os dois lembretes de depois do Esc devem dizer que o estado só é guardado no mesmo pedido (muda o golden de textos). No critério de continuação, exigir mesmo id de nível 1 e ao menos uma filha com o mesmo id e título é mais seguro do que só o título do nível 1; id reutilizado com árvore diferente segue virando histórico.
- **Pergunta ao usuário:** Quando uma mensagem nova (sua ou de outra sessão) chega e o modelo chama plan de novo com um nível 1 que continua aberto (mesmo id e mesmo título), o painel deve (a) tratar como continuação: mantém o estado das tarefas que mantêm o id, o nível 1 fica no pedido em que estava e o cartão e a carta seguem sob a tarefa [recomendado]; ou (b) manter a regra de 2026-10-27 para todo id reutilizado em pedido novo (antigo interrompido e renomeado como histórico, novo todo pendente), e então mudar os textos ao modelo para não replanejar tarefa que continua? Na opção (a), id reutilizado com título diferente continua virando histórico.
- **Decisão já registrada:** regras/pedidos.md:70-80 (série 2, 2026-10-23; confirmado pelo usuário em 2026-10-27; reescrito em 2026-11-04); task-tree/DESENVOLVIMENTO.md:100
- **Verificação:** Conferi planTool: nível 1 aberto de turno anterior não passa em sameRequest, é interrompido e renomeado, o novo entra todo pendente no turno novo e renameAnchors leva cartão e carta para a cópia antiga. O comportamento é decisão registrada e testada, mas os textos entregues ao modelo (RULES, descrição do plan e os lembretes de depois do Esc) prometem o estado guardado sem a condição de pedido, o que leva o modelo a esse caminho em uso comum.

### A dobra de uma tarefa é guardada pelo id; id reusado em pedido novo herda a dobra da tarefa antiga
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1330, 1378-1379 — o escopo das linhas do grupo principal é fixo (escopo + agente + '|'), então a chave da dobra é '|t:<id>' em qualquer pedido; a chave do pedido (T:<id do turno>) é única e não sofre o problema
  - task-tree/hooks/session-start.ts:72-78 — o /clear não limpa as dobras: um plano novo depois dele também herda a dobra do id
  - task-tree/draw/layout.ts:1198, 1206 — nos cartões das filhas a chave também é por id da tarefa (escopo do cartão), e o id é renomeado na sessão filha, fora do alcance de renameAnchors da mãe
- **Regra do catálogo:** Nenhuma: o catálogo só fala de linhas recolhidas na contagem do cabeçalho (regras/cabecalho.md:10-12).
- **Cenário:** A pessoa recolhe o nível 1 "1" (com subtarefas) do pedido A. No pedido B o modelo planeja de novo um "1" com subtarefas: a tarefa nova nasce recolhida (só " ⋯" indica), escondendo o trabalho atual, e a antiga, agora "xxxx:1" no histórico, volta aberta. O objeto de dobras cresce a sessão inteira com chaves mortas.
- **Proposta:** Renomear também as chaves de dobra em renameAnchors (prefixo tag: nas que terminam em t:id ou começam com id/), ou compor a chave com o turno ou o plannedAt da tarefa. Podar chaves que não aparecem em nenhum desenho há N desenhos.
- **Ajuste da verificação à proposta:** Renomear as chaves em renameAnchors só resolve o painel da própria sessão. Compor a chave com algo estável da tarefa (por exemplo o plannedAt, que o carry preserva no replano no lugar) cobre também os cartões das filhas e o /clear; a poda de chaves mortas é à parte e de baixa prioridade. Cenário novo no catálogo como checklist do app (a dobra é clique).
- **Verificação:** Conferi a chave (escopo fixo + 't:' + id), o rename que deixa o id puro com a tarefa nova e o setFold que só acrescenta chaves: a tarefa nova nasce recolhida e a antiga reabre. Depende de a pessoa ter recolhido a linha da tarefa, mas o reuso de ids como '1' entre pedidos é o normal.

### Id curto de tarefa fechada colide com as tarefas de histórico renomeadas
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1374-1378 — a ordem 'vence o aberto; no mesmo estado o id completo desempata' veio de bug relatado pelo usuário (o id '1' pegava nível 1 antigo e concluído em vez de '31/1', aberto)
  - task-tree/hooks/agents.ts:187-193 — a folha da principal pode ficar interrompida (subagente que falhou ou foi parado), o que torna real o caso da tarefa atual interrompida perdendo para a de histórico concluída
- **Regra do catálogo:** arvore.ids-curtos-e-avisos (Ids curtos e os avisos de id ambíguo, inexistente ou de outro agente)
- **Cenário:** (a) Pedido um: plan "1" com filhas 1.1 e 1.2, tudo concluído. Pedido dois: plan "1" com as mesmas filhas (o antigo vira `ab12:1/...`). O modelo conclui 1.1 e depois chama start ["1.1"] para reabrir: há duas concluídas com short "1.1" e nenhuma tem id completo igual a "1.1"; a resposta é '"1.1" é ambíguo, use "ab12:1/1.1" ou "1/1.1"', expondo o id interno do histórico (a lista cresce a cada pedido que reaproveita o id). (b) O plano novo não tem 1.3, o antigo tinha: start ["1.3"] reabre a tarefa do histórico e os pais dela, e o plano do pedido antigo volta ao painel em andamento, em vez de '"1.3" não existe'. (c) Tarefa atual "1" interrompida (subagente que falhou) e uma de histórico concluída: start ["1"] reabre a de histórico, porque done vem antes de interrupted.
- **Proposta:** Em resolve(): primeiro o id completo exato, em qualquer estado; depois as tarefas não renomeadas; o histórico (`tag:`) só pelo id completo. Acrescentar ao cenário arvore.ids-curtos-e-avisos (ou a um novo) o caso "id curto que só existe no histórico" e testar start e done.
- **Ajuste da verificação à proposta:** Não pôr 'id completo exato primeiro, em qualquer estado': desfaz a correção registrada e traz de volta o bug em que um nível 1 antigo e concluído ganha da tarefa aberta. Manter a ordem atual e só tirar do conjunto do id curto as tarefas renomeadas de histórico (id com prefixo 'tag:'), que passam a responder apenas pelo id completo. Acrescentar o caso ao cenário arvore.ids-curtos-e-avisos com teste de start e de done.
- **Decisão já registrada:** task-tree/DESENVOLVIMENTO.md:1374-1378 e o comentário em task-tree/state/tasks.ts:34-35 (a tarefa aberta vence, por id completo ou curto)
- **Verificação:** Reproduzi os três casos em resolve(): duas concluídas com o mesmo short e nenhuma com id completo igual dão 'ambíguo' citando o id interno do histórico; um short que só existe no histórico devolve a tarefa antiga e o start a reabre com os pais e a põe no trabalho atual; e 'done' vem antes de 'interrupted' na ordem. O rename de planTool mantém o short, que é a causa.

### Nível 1 que fechou sozinho e é replanejado com o mesmo id no mesmo pedido vira duplicata: as concluídas reaparecem pendentes
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/pedidos.test.ts:200-213 — o teste do cenário roda no mesmo pedido e espera ['concluida','pendente']: o comportamento é coberto e selado
  - task-tree/text/rules.ts:33-34, 40-42 — RULES já diz ao modelo que o pai fecha sozinho e que 'um nível 1 já concluído fica como histórico'
  - regras/pedidos.md:53 — o cenário do replano limita a reabertura a 'um pai abaixo do nível 1': a assimetria está escrita no catálogo
- **Regra do catálogo:** pedidos.nivel1-concluido-e-historico (Um nível 1 concluído fica como histórico) x pedidos.replano-preserva-estado
- **Cenário:** No mesmo pedido: plan 64{64.1,64.2,64.3}; as três são concluídas (por done, pela entrega de uma carta ou pelo fim dos subagentes); settle fecha o 64 sozinho. O modelo, que nunca fechou o 64 e o considera aberto, chama plan 64{64.1,64.2,64.3,64.5} para acrescentar um passo. Como o 64 está done, não há carry: o antigo vira tag:64 (✓ 3/3, com as cartas e os cartões das filhas, que são renomeados junto) e um segundo '64' entra ao lado com 64.1-64.3 e 64.5 pendentes (0/4). O painel mostra dois '64' com o mesmo título; o modelo refaz o done de 64.1-64.3 e recebe '3 etapas fecharam juntas sem start'. Repete-se a cada passo acrescentado (64.5, depois 64.6), porque o nível 1 volta a fechar sozinho quando o último passo termina. É o trecho do relato 'com 64.1, 64.2 e 64.3 concluídos'. Um pai de nível 2 na mesma situação reabre e preserva as filhas (teste 'pai abaixo do nível 1 concluído que ganha filha nova'); o nível 1 não.
- **Proposta:** Em planTool, para um nível 1 concluído do pedido atual (mesmo turno) com o mesmo id: aplicar carry (o estado de quem mantém o id) e deixar reopen/settle decidirem (reabre se entrou tarefa nova; segue ✓ se nada mudou). Manter 'histórico + plano novo ao lado' para o nível 1 concluído de pedido anterior. Alinhar o texto do start e da descrição da ferramenta com RULES. Reescrever pedidos.nivel1-concluido-e-historico e o teste que hoje espera ['concluida','pendente'].
- **Ajuste da verificação à proposta:** Vira pergunta (a proposta já a traz): pedidos.nivel1-concluido-e-historico é cenário coberto (regra desde a entrada do mod, sem palavras do usuário) e o teste selado espera a duplicata no mesmo pedido. Se a reabertura for escolhida, manter um caminho para refazer: com carry, um plan idêntico sobre um nível 1 concluído não reabre nada, então RULES ('ids novos para o que deve ser refeito') e a resposta do plan precisam dizer isso. Alinhar o aviso do start (hooks/tools.ts:213) com RULES vale nas duas respostas.
- **Pergunta ao usuário:** Um nível 1 que fechou sozinho (todas as filhas ✓) e recebe, no mesmo pedido, um plan com o mesmo id e um passo a mais deve (a) reabrir mantendo as ✓, como já acontece com um pai abaixo do nível 1 (recomendado), ou (b) continuar como hoje, ficando o ✓ como histórico e um segundo nível 1 com tudo pendente ao lado?
- **Verificação:** Conferi: replanned exige status open, então o nível 1 fechado por settle (ou pela entrega de uma carta) só é renomeado e o plano novo entra inteiro pendente ao lado; o pai de nível 2 na mesma situação reabre pelo carry. Não é violação do catálogo (está coberto e dito em RULES), é assimetria real com a decisão de 2026-10-27 ('✓ segue ✓; só tarefas novas nascem ○'), por isso severidade média e não alta.

### start num pai aberto acende a primeira folha sem ela ter sido iniciada, e o cabeçalho diz o contrário da linha
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:617-636 — o comentário de current() diz que acender a primeira tarefa aberta de um pai iniciado é intencional; o que não acompanha é o resto (pílula, fim do turno, âncora)
  - task-tree/hooks/panel.ts:228, 244-245 — sendAnchor não acha folha iniciada, mas acha algo em andamento e ancora a mensagem ou a sessão na primeira folha aberta do pai, que nunca foi iniciada
  - task-tree/state/tasks.ts:54-62, 89-97 — o done da primeira folha não tira o started do pai: a folha seguinte acende sozinha, sem start, com o relógio contando desde o plano
  - task-tree/draw/svg.ts:616 — o único 'active' lido é o do headerState; Row.active não é lido por ninguém
- **Regra do catálogo:** arvore.sem-start-nada-acende (Sem start, nada fica em andamento) e turnos.iniciada-aguarda-no-fim: nenhum cobre start num pai aberto
- **Cenário:** O modelo planeja "A" com filhas e chama start em "A" (o nível 1) em vez de numa folha. A primeira folha aparece ◉ com relógio correndo desde o plano; o cabeçalho mostra a faixa "aguardando", nenhuma pílula "em andamento" e a folha como pendente. O turno termina: a folha volta a ○ e nada fica ◷, como se nada tivesse sido iniciado.
- **Proposta:** Escolher: (a) start num pai com filhas inicia de fato a primeira folha aberta (grava `started`/`startedAt` nela), ou (b) start num pai é recusado com aviso para iniciar a folha. Registrar o cenário e ligar o teste; remover `Row.active` ou passá-lo a ser a fonte da pílula.
- **Ajuste da verificação à proposta:** As duas opções mudam comportamento visível: é pergunta (já posta). Na opção de iniciar a folha, o pai não deve guardar started próprio, senão current() segue acendendo a folha seguinte sem start quando a primeira fecha. Remover Row.active.
- **Pergunta ao usuário:** start num pai aberto deve iniciar a primeira folha aberta dele (recomendado) ou ser recusado com aviso?
- **Verificação:** Conferi startTool (só recusa pai concluído), begin (marca só o alvo e os ancestrais), current() (acende a primeira folha aberta do pai iniciado), a pílula do cabeçalho (conta por startedAt, então a folha acesa entra como pendente) e halt (no fim do turno nada fica aguardando). A folha acesa sem start próprio também contraria o espírito de 'sem start, nada aceso' (2026-10-23), que não previu este caso.

### Os lembretes mostram o id completo ("1/1.2") e o plan espera o id curto: replanejar copiando o id do lembrete duplica o prefixo e perde o estado
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/state/tasks.ts:16 — o short do nó mal prefixado vira '1/1.1': depois disso o id curto '1.1' responde 'não existe'
  - task-tree/text/rules.ts:167-169, 181-185, 205-208 e state/tasks.ts:43 — além dos lembretes de depois do Esc, o aviso de etapas sem start, o do wrap_up, o de sessão que terminou e o de id ambíguo também mostram o id completo
  - task-tree/hooks/prompt-submit.ts:88 e hooks/tools.ts:62 — no lembrete de depois do Esc o estado já se perde de qualquer jeito pelo pedido novo; o prejuízo próprio deste achado é no replano dentro do mesmo pedido
- **Regra do catálogo:** pedidos.replano-preserva-estado
- **Cenário:** O lembrete lista '"1/1.1" Analisar; "1/1.2" Corrigir'. O modelo replaneja o nível 1 "1" com as filhas de id "1/1.1" e "1/1.2", como leu. O build gera "1/1/1.1" e "1/1/1.2": nenhum id casa com o antigo, a tarefa ✓ e a ◉ somem e entram duas ○ novas. No lembrete seguinte os ids aparecem como "1/1/1.1", e o prefixo cresce a cada replano.
- **Proposta:** No build, quando o id de uma filha já começa por `<id do nível 1>/`, tirar o prefixo antes de montar (o `short` fica o id curto). E/ou mostrar nos lembretes e avisos o id curto junto do completo, e dizer nos textos de replanejamento que no plan os ids das subtarefas vão sem o prefixo.
- **Ajuste da verificação à proposta:** Tirar o prefixo no build é o conserto robusto (o plan passa a aceitar o id como o painel o mostra); só mudar texto não basta. Tirar apenas quando o id começa exatamente por '<id do nível 1>/'. Teste novo: replano no mesmo pedido com os ids completos mantém a concluída e a em andamento.
- **Verificação:** Conferi build (prefixa sempre, sem conferir prefixo já presente), carry (casa só por id completo), duplicates (não pega o caso) e openList (mostra o id completo ao lado do pedido de manter os ids). O resultado é determinístico para essa entrada; o que não dá para medir pela leitura é a frequência com que o modelo copia o id completo.

### Não há como o modelo abandonar uma tarefa: os lembretes mandam done no que a mensagem 'substitui', que aparece como ✓ concluída
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/text/rules.ts:181-185 — WRAP_UP.open não fala em 'substitui': só manda done no que já foi concluído; os textos com 'substitui' são PROMPT.open (111-115) e interruptedByYou (141-144)
  - task-tree/hooks/tools.ts:76-80 e regras/pedidos.md:53 — as saídas que existem hoje: no mesmo pedido, o replano sem a tarefa a tira do painel; em pedido novo, reusar o id do nível 1 deixa as abertas ✕ no histórico
- **Regra do catálogo:** lembretes.fim-normal-lista-abertas e lembretes.replanejar-apos-esc-pessoa (os dois textos mandam done no que a mensagem substitui)
- **Cenário:** Plano com 5 etapas, 2 feitas. A pessoa muda de rumo. O modelo, seguindo o lembrete, chama done nas 3 que não serão feitas: o painel mostra 5 de 5 ✓ e, com 2 ou mais sem start, ainda devolve o aviso de 'etapas fecharam juntas sem start'. Se não fechar, elas ficam ○ para sempre, entram em todos os lembretes seguintes e seguram o lembrete de planejar e o de summary.
- **Proposta:** Definir o destino do trabalho abandonado: um parâmetro no done (por exemplo `cancel: true`) ou uma ferramenta própria que marque interrompida (✕, fora do x/y), e trocar os três textos para 'feche com done o que foi concluído e cancele o que a mensagem substitui'. Sem ferramenta nova, ao menos dizer no texto que o que não será feito deve sair do plano por replano (no mesmo pedido) e não por done.
- **Ajuste da verificação à proposta:** É recurso novo (estado ou parâmetro) e troca textos do golden: decisão do usuário, a pergunta já está posta. A decisão 'pendentes nunca ✕' (2026-10-27, turnos.pendentes-seguem-pendentes) vale para o fim do turno e não responde este caso. A saída sem ferramenta nova (dizer que o que não será feito sai por replano) depende da resposta sobre o replano em mensagem seguinte: hoje, numa mensagem nova, o replano com o mesmo id já é pedido novo. WRAP_UP.open não precisa mudar.
- **Pergunta ao usuário:** Tarefa que o modelo abandona porque a pessoa mudou de rumo deve aparecer ✕ interrompida e sair do x/y (recomendado, com um jeito explícito de o modelo marcar isso), ou ✓ concluída como hoje?
- **Verificação:** Conferi doneTool e finish: o modelo só consegue marcar concluída, e os dois lembretes de mensagem nova mandam fechar com done o que a mensagem substitui, então trabalho abandonado aparece ✓ e conta no x/y. Não há cenário nem decisão registrada sobre abandono pedido pelo modelo.

### Entrada de plan, start e done sem validação além de ids repetidos
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:86-93 — com tasks vazio e request preenchido, o título do pedido atual é trocado mesmo sem tarefa nenhuma
  - task-tree/hooks/tools.ts:37, 43-45 — a recusa por ids repetidos sai depois de reminders.planned = true
  - Não confirmado pela leitura: se o host valida a entrada contra o schema antes do hook (o caso de ids como texto, o mais grave do achado, depende disso)
- **Regra do catálogo:** arvore.plan-recusa-ids-repetidos (plan com ids repetidos é recusado)
- **Cenário:** Se o motor não validar a entrada contra o schema: done com ids "1.2" (string em vez de lista) percorre os caracteres e fecha o nível 1 "1" inteiro e o "2", avisando só que "." não existe. Confirmado pela leitura: plan com 4 níveis perde o quarto sem aviso; plan com `tasks: []` responde como sucesso; um nível 1 com "/" no id faz o start registrar a raiz errada no trabalho atual; um id com ":" se confunde com o prefixo de histórico.
- **Proposta:** Validar no início de cada ferramenta: tasks lista não vazia, id e title texto não vazio, id sem '/' nem ':', profundidade máxima 3 com erro explícito, ids lista de textos. Responder erro (isError) sem mudar o painel. Estender o cenário de recusa (ou criar outro) e conferir no harness se o schema já barra algum desses casos.
- **Ajuste da verificação à proposta:** Conferir primeiro no harness ou no app se o host já recusa entrada fora do schema. Se recusa, sobra validar o que o schema não diz: tasks vazio, quarto nível (o schema não proíbe children no terceiro nó), id vazio ou com '/' ou ':'. Erro explícito sem tocar o painel.
- **Verificação:** Confirmei a parte lida: build corta o quarto nível sem aviso, plano vazio responde como sucesso e nenhum id é conferido além dos repetidos. A parte que fecharia tarefas erradas (ids como texto) segue suspeita, por depender da validação do host; por isso a severidade baixa.

### Sessão forkada, movida para a nuvem e compactação de contexto não têm tratamento nem cenário
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:108-111 e hooks/tool-call.ts:187-199 — numa sessão forkada com o painel vazio o modelo recebe PROMPT.request e, na primeira ferramenta sem plano, o lembrete de planejar: o caso do fork se corrige com um plano novo
  - task-tree/hooks/tool-call.ts:175-181 — o wrap_up lista de novo as abertas com os ids, o que cobre parte do caso da compactação
- **Regra do catálogo:** sem cenário
- **Cenário:** (a) Fork (a própria ferramenta de handoff do app cria "um fork desta conversa"): a sessão nova tem no contexto as chamadas plan/start da original, mas o painel dela nasce vazio; o modelo chama done("2") e recebe '"2" não existe', ou trabalha sem painel; se o app entregar o fork como retomada da original, o painel inteiro da mãe aparece duplicado no cartão da filha. (b) Compactação automática no meio de um turno longo: o resumo pode perder os ids e o estado das tarefas, e o mod não reapresenta as abertas até o próximo prompt. (c) Filha movida para a nuvem: o cartão na mãe fica com o último painel local, sem atualização. Depende do comportamento do app em cada caso.
- **Proposta:** Tratar source 'compact' devolvendo como contexto a lista de tarefas abertas (o mesmo texto de PROMPT.open) e source 'fork' com decisão explícita: painel vazio com um aviso ao modelo de que os ids do contexto não valem, ou cópia das tarefas abertas da origem. Verificar no app o que chega em cada caso (source, session_id) e catalogar os três cenários; para a nuvem, ao menos a palavra de estado do cartão.
- **Ajuste da verificação à proposta:** Antes de qualquer código, registrar no app o que chega no SessionStart de um fork, de uma compactação e de uma sessão movida (source e session_id). Repetir a lista das abertas depois da compactação é barato; para o fork, o painel vazio já é corrigido pelos lembretes, falta só decidir se herda as tarefas (pergunta já posta). Catalogar como checklist do app.
- **Pergunta ao usuário:** Uma sessão criada por fork deve começar com o painel vazio e um aviso ao modelo (recomendado) ou herdar as tarefas abertas da sessão de origem?
- **Verificação:** Conferi que classicSessionStart só trata 'clear' e 'resume' e que os tipos do kit listam também 'compact' e 'fork'; nada no catálogo nem na doc fala desses fluxos. Os efeitos descritos dependem do que o app entrega em cada caso, que o código não mostra, e os lembretes existentes reduzem o dano.

### persist calcula a linha de status antes de salvar e publicar: uma falha de exibição impede a durabilidade e a publicação
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:337 — $.ui.status não é aguardado: uma rejeição assíncrona dele não passa por catch nenhum; o que pode lançar dentro de persist é a leitura de children e o total()
  - Nenhum gatilho real de falha foi achado na leitura: o achado é a ordem das etapas, não uma falha reproduzida
- **Regra do catálogo:** sem cenário
- **Cenário:** Resposta à pergunta "um erro no desenho impede o registro do estado?": o erro do ui.render não impede (fica numa linha de erro e o estado é escrito por outros hooks). Mas a linha de status, que é exibição, roda dentro de persist antes do store e da publicação. Se ela lança, o plan responde `erro: …` com as tarefas já no state, fora do trabalho atual (podem aparecer como "+N pedidos anteriores" até o modelo repetir o plan), o store não recebe o painel novo e a mãe não recebe a publicação.
- **Proposta:** Em persist, salvar e publicar primeiro e atualizar o status por último, dentro de try/catch com debug(). Gravar lastStatus só depois de $.ui.status ter sido chamado.
- **Ajuste da verificação à proposta:** A ordem proposta está certa (salvar, publicar, status por último em try com debug). Gravar lastStatus só depois de $.ui.status e capturar também a rejeição dessa chamada.
- **Verificação:** Conferi persist e change: o status é calculado antes do store e da publicação, sem try, e o update do state já aconteceu quando persist lança, de modo que planTool pularia renameAnchors e joinWork. É lacuna de robustez sem falha conhecida que a dispare, por isso baixa.

### plan, start e done devolvem o texto cru da exceção ao modelo, sem log, com o estado já parcialmente aplicado; a forma da entrada não é conferida no hook
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:37, 43-45 e hooks/tool-call.ts:193 — caso reproduzível pela leitura: o plan recusado por ids repetidos já marcou reminders.planned; com o painel vazio, o lembrete de planejar não volta mais naquele pedido
  - Não confirmado: uma exceção real dentro de plan, start ou done, e a validação do schema pelo host
- **Regra do catálogo:** arvore.plan-recusa-ids-repetidos (plan com ids repetidos é recusado)
- **Cenário:** (a) Confirmado: o plan grava as tarefas no state e um passo seguinte lança. O modelo recebe "erro: TypeError: …" (texto interno, sem orientação), o painel ficou com as tarefas novas fora do trabalho atual e com as ligações das tarefas renomeadas pela metade, e nada vai para o log. Um novo plan conserta os grupos, mas as ligações renomeadas pela metade ficam. (b) Não verificado: se o host não validar o schema, done com ids "1.2" (texto em vez de lista) percorre "1", "." e "2" e fecha as tarefas de nível 1 "1" e "2" inteiras.
- **Proposta:** No catch das três ferramentas, registrar com debug() o stack e responder um texto fixo com a ação ("erro interno do painel; repita a chamada"), sem o texto da exceção. Conferir a forma no começo (Array.isArray de tasks e ids, id e title como texto) e responder um erro claro, antes de escrever qualquer coisa. Marcar reminders.planned só depois do sucesso. Em renameAnchors, calcular tudo antes e aplicar os três updates dentro de um try que registra qual ficou para trás.
- **Ajuste da verificação à proposta:** Registrar o stack com debug() nos três catch e marcar reminders.planned só depois do plan aceito: as duas mudanças não dependem de pergunta. Manter isError e um texto de erro reconhecível na resposta. A conferência de forma (listas, textos) só vale se o host não validar o schema: verificar no harness antes.
- **Verificação:** Conferi os três catch (devolvem String(err) sem debug), a ordem em planTool (planned marcado antes de qualquer validação; change, renameAnchors, sends e joinWork em sequência sem volta) e os três updates seguidos de renameAnchors. Os fatos estão certos, mas nenhum caminho de exceção real foi achado; o efeito concreto hoje é o lembrete de planejar desligado depois de um plan recusado.

### Campos e parâmetros lidos mas nunca gravados: `Send.cut`, `TaskNode.kept`, `Rate.live = false`, parâmetros mortos em `carry`, `REPLY` e `stateOf` sem uso
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:112-146` — O comentário de `carry` diz que a tarefa de mensagem deixada fora do replano "stays, marked kept"; o corpo diz "is not kept" e descarta `queued`, `parentOf` e `ids` com `void`.
  - `task-tree/types/index.d.ts:26-28` — `TaskNode.kept`: "A message task left out of a replan while its message is still queued: kept".
  - `task-tree/draw/layout.ts:999-1000` — `rows` ainda testa `t.kept`; nenhum código grava `kept: true`.
  - `task-tree/hooks/tools.ts:64-66` — "a message task a replan leaves out stays until delivered (carry)": o contrário do que `carry` faz.
  - `task-tree/hooks/turn.ts:101-103, 145` — A taxa é sempre gravada com `live: true` e "fica acesa" no fim do turno; nada grava `live: false`.
  - `task-tree/draw/svg.ts:702, 731` — Ramos para `live` falso: opacidade .45 e "(último turno)".
- **Regra do catálogo:** pedidos.replano-mantem-envio-ate-entrega; taxa.fim-do-turno-fica-aceso
- **Cenário:** Quem lê os tipos conclui que um replano mantém a tarefa de mensagem marcada `kept` e que a taxa esmaece depois do turno; nenhum dos dois acontece. Os ramos de `kept` e de `live` falso só rodam com painéis publicados por versões antigas do mod, sem teste que os proteja. A regra de fato está no catálogo.
- **Proposta:** Tirar `queued`, `parentOf` e `ids` de `carry` e o parâmetro de quem a chama; corrigir os três comentários. Marcar `kept` e `live: false` como "só lidos de versões anteriores" (ou tirá-los quando a compatibilidade deixar de valer). Atualizar os comentários de `Rate`. Remover `REPLY` e `stateOf`.

### done numa tarefa interrompida não muda nada nem diz o que fazer; start num pai interrompido diz "já foi concluída"
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tools.ts:151` — done em tarefa com status interrupted só acrescenta o aviso '"id" foi interrompida'.
  - `task-tree/hooks/tools.ts:212-213` — start em pai não aberto responde 'já foi concluída e tem subtarefas', também quando ele está interrompido.
  - `task-tree/hooks/agents.ts:158-199` — settleBySubs grava interrupted (com 'falhou') numa tarefa do loop principal quando o subagente lançado dela falha ou é parado.
  - `task-tree/text/rules.ts:116-119` — O lembrete do hand-back manda 'done no que ele concluiu', sem falar da tarefa que o painel já marcou ✕.
  - `task-tree/hooks/tools.ts:151` — done: `"id" foi interrompida`, sem orientação, e nada muda.
  - `task-tree/hooks/tools.ts:212-217` — start: folha interrompida é reaberta (begin) sem aviso; pai interrompido com filhas recebe a mensagem "já foi concluída e tem subtarefas".
- **Regra do catálogo:** arvore.ids-curtos-e-avisos (Ids curtos e os avisos de id ambíguo, inexistente ou de outro agente)
- **Cenário:** Um subagente lançado da tarefa "Pesquisar" falha depois do fim do turno; o painel marca a tarefa ✕ "falhou". O modelo refaz o trabalho por outro caminho e chama done nela: a resposta é só '"1" foi interrompida', a tarefa segue ✕ e fora da contagem. Nenhum texto diz que é preciso start antes; não há cenário nem teste para esse aviso.
- **Proposta:** Completar o aviso ("reabra com start se o trabalho continua") ou deixar o done concluir a folha interrompida; corrigir o texto do start para pai interrompido. Acrescentar o aviso ao cenário de ids e avisos, com teste.

### O replano limpa o 'em andamento' de um pai iniciado e de uma folha em andamento que ganha subtarefas
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:116-146` — carry.reopen põe started: undefined em todo nó com algo aberto embaixo, inclusive os que já estavam abertos e iniciados.
  - `task-tree/text/rules.ts:38-40` — 'em andamento segue em andamento'.
  - `regras/pedidos.md:48-56` — 'quem mantém o id mantém o estado'.
  - `task-tree/tests/pedidos.test.ts:142-152` — O teste só cobre o start numa folha que continua folha.
- **Regra do catálogo:** pedidos.replano-preserva-estado (O replano no mesmo pedido preserva o estado das tarefas que mantêm o id)
- **Cenário:** O modelo chama start(['2']) numa tarefa sem subtarefas e, ao perceber que ela é grande, replaneja o nível 1 dando a '2' as filhas 2.1 e 2.2. Depois do plan nada mais está aceso: '2' perde o start, uma pergunta feita em seguida fica sem tarefa de âncora e uma mensagem enviada vai para a regra das pendentes. O mesmo vale para start dado direto num pai.
- **Proposta:** Em reopen, só limpar started e endedAt quando o nó estava fechado; um nó aberto e iniciado mantém started. Acrescentar ao teste de replano o caso da folha em andamento que ganha filhas e o do pai iniciado.

### plan decide o que renomear numa leitura feita fora do `update`
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tools.ts:58-67` — `before`, `nowTurn` e `renamed` saem de um `$.state.get` anterior ao `change`.
  - `task-tree/hooks/tools.ts:69-80, 103-105` — Dentro do fecho, a escolha entre replanejar e renomear é refeita sobre o estado atual; renameAnchors recebe a lista da leitura antiga.
  - `task-tree/hooks/sessions.ts:154-167` — O poll fecha tarefas por conta própria (envio confirmado), fora da ordem das chamadas do modelo.
  - `task-tree/hooks/agents.ts:181-198` — settleBySubs também fecha tarefas sozinho.
- **Regra do catálogo:** sem cenário
- **Cenário:** O modelo replaneja reutilizando o id "1" no instante em que o poll confirma um envio e fecha a tarefa "1" de nível 1. A leitura antiga diz "aberta" (não entra em `renamed`); o fecho vê "fechada", renomeia a antiga e cria a nova "1". As âncoras não são renomeadas: os cartões e as cartas da tarefa antiga passam para baixo da nova.
- **Proposta:** Calcular `renamed` dentro do fecho do `change` (devolvido por variável externa, como o done faz com os avisos) e chamar renameAnchors com essa lista.

### Tarefas fechadas sem start ganham tempos por duas regras diferentes: 0:00 ou o tempo inteiro do pai
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:63-87` — fill: o início é o fim da irmã fechada anterior; para filhas abertas fechadas junto com o pai, `prev` não avança e todas começam no início do pai
  - `task-tree/hooks/tools.ts:146-156, 177-180` — done processa os ids em sequência (a primeira leva todo o intervalo, as seguintes começam e terminam em now); só avisa o modelo
  - `task-tree/DESENVOLVIMENTO.md:1366-1371` — 'as do meio saíam com 0:00' tratado só com aviso ao modelo
- **Regra do catálogo:** arvore.done-sem-summary-e-varias-sem-start: Avisos do done
- **Cenário:** Três passos nunca iniciados. done(['1','2','3']): o 1 mostra 5:00 e o 2 e o 3 mostram 0:00. done(['A']) no pai dos mesmos três: os três mostram 5:00 cada (soma 15:00 num pai de 5:00). Um done fora de ordem (fecha o 2 depois do 3) dá ao 2 um intervalo que cobre o do 3.
- **Proposta:** Uma regra só para tarefa fechada sem start. Recomendo não inventar tempo: a folha sem start fica com tempo desconhecido ('—', que o desenho já tem) e o pai mede pelo que foi de fato iniciado; ou repartir o intervalo igualmente. Registrar como cenário.
- **Pergunta ao usuário:** Para uma tarefa concluída sem start, o painel deve mostrar '—' (recomendado), repartir o intervalo entre as fechadas juntas, ou manter o cálculo atual?

### done e start de um agente sem grupo não avisam id inexistente nem "de outro agente"
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tools.ts:139-160` — `doneTool`: os avisos são montados dentro do `map`, só no ramo `g.agent === agent`; sem grupo do agente, nenhum id é examinado.
  - `task-tree/hooks/tools.ts:198-222` — `startTool`: mesma estrutura; responde "Nada marcado." sem avisos.
  - `task-tree/hooks/tools.ts:46` — Só o `planTool` chama `ensureGroup`; start e done não.
  - `task-tree/hooks/agents.ts:56` — Teammates e agentes retomados não ganham grupo no lançamento.
- **Regra do catálogo:** arvore.ids-curtos-e-avisos
- **Cenário:** Um teammate (ou um subagente cujo lançamento não foi ouvido) chama done(["1"]) com o id de uma tarefa do loop principal. Resposta: "Concluídas: 0/0 no seu grupo.", sem o aviso "\"1\" é de outro agente"; o agente conclui que fechou a tarefa. Com start: "Nada marcado." sem explicação.
- **Proposta:** Em `doneTool` e `startTool`, quando `all` não tem grupo para o agente, resolver os ids contra os outros grupos e devolver os avisos (ou chamar `ensureGroup` antes do `change`, como o plan).

### O replano no lugar não leva a marca 'falhou': a tarefa interrompida por falha de subagente vira só 'interrompida'
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:120` — carry copia status, started, startedSeq, startedAt, endedAt, plannedAt e msg; failed fica de fora.
  - `task-tree/hooks/agents.ts:190-192` — settleBySubs grava failed: true na tarefa cujo subagente falhou.
  - `task-tree/draw/layout.ts:1047` — O desenho escolhe 'falhou' ou 'interrompida' por t.failed.
  - `regras/subagentes.md:103-110` — Regra: a tarefa fica com 'falhou' se um subagente falhou.
- **Regra do catálogo:** subagentes.pai-reflete-falha-ou-interrupcao
- **Cenário:** Uma tarefa fica com 'falhou' porque o subagente dela falhou; no mesmo pedido o modelo replaneja o nível 1 mantendo o id dela e acrescentando uma tarefa de nova tentativa. A tarefa segue interrompida, mas a palavra passa de 'falhou' para 'interrompida'.
- **Proposta:** Incluir failed na lista copiada por carry (task-tree/state/tasks.ts, linha 120), com teste em tests/subagentes.test.ts ou tests/pedidos.test.ts.

### No replano, um pai que vira folha guarda o startedAt: tarefa pendente com relógio correndo e ✕ no Esc
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:107-108` — begin grava startedAt em todo ancestral da tarefa iniciada.
  - `task-tree/state/tasks.ts:118-122, 139-145` — carry copia startedAt do nó antigo para o novo com o mesmo id; reopen só mexe em quem tem filhas.
  - `task-tree/draw/layout.ts:57-63, 73` — halt trata como iniciada a folha com startedAt (◷ no fim normal, ✕ no Esc); timing liga o relógio para folha aberta com startedAt e sem endedAt.
  - `task-tree/hooks/render.tsx:282-283` — O chip 'em andamento' conta folha aberta com startedAt e sem endedAt.
- **Regra do catálogo:** turnos.pendentes-seguem-pendentes (pendentes nunca ✕)
- **Cenário:** plan A{2{2.1,2.2}}; start 2.1 (o pai '2' ganha startedAt); done 2.1; o modelo simplifica: plan A{2} com '2' sem subtarefas. A folha '2' nasce ○, mas com o startedAt do antigo pai: o tempo dela corre, o cabeçalho a conta como em andamento, o relógio de 1 s não para; no fim do turno fica ◷ 'Aguardando' e, com Esc, ✕ interrompida, sem nunca ter recebido start.
- **Proposta:** Em carry, quando o nó novo é folha e o antigo tinha filhas (ou o inverso), não herdar started, startedSeq, startedAt nem endedAt; herdar só status e plannedAt. Teste no bloco de pedidos.replano-preserva-estado.

## Turnos, pedidos e perguntas

18 achados: 2 de severidade alta, 12 média, 4 baixa.

### Um aviso automático depois do Esc reacende as tarefas interrompidas e apaga a marca de turno interrompido
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tool-call.ts:209 e hooks/tools.ts:38, 130, 191 — wake também roda em toda chamada de ferramenta da principal: tirar o wake do prompt do aviso não basta, a primeira ferramenta do turno do aviso reacende a tarefa
  - task-tree/DESENVOLVIMENTO.md:541-545 — este trecho da própria doc diz que wake roda no prompt.submit e nas chamadas, sem a restrição da linha 97: a doc se contradiz
- **Regra do catálogo:** lembretes.replanejar-apos-esc-pessoa; turnos.esc-interrompe-so-a-iniciada; sessoes.rodada-descartada-fora-da-contagem
- **Cenário:** Na orquestradora, tarefa 'Um' em andamento com filhas trabalhando. A pessoa aperta Esc: 'Um' fica ✕. Antes de ela escrever, uma filha termina o turno e o app manda o aviso (<side-sessions-event>), ou um subagente em segundo plano devolve o resultado. No prompt do aviso 'Um' volta a ◉ com o relógio correndo; o modelo responde o aviso e o turno termina normalmente: 'Um' passa a ◷ 'Aguardando' (não mais ✕). Quando a pessoa enfim escreve, o modelo recebe a lista para fechar, sem o pedido de replanejar. Se esta sessão é filha de outra, o cartão dela na mãe deixa de ser rodada descartada e volta a contar.
- **Proposta:** Em promptSubmit, chamar wake só nos prompts que abrem turno (como a doc descreve) ou, no ramo que não abre turno, guardar a marca; em turnComplete, não sobrescrever turnAborted quando o turno que termina foi aberto por prompt sem turno (ex.: gravar turnAborted = e.isAborted || (abortedAntes && turnoSemPedido)). Teste novo: esc, aviso, fimDoTurno, pedido da pessoa deve trazer 'replaneje o painel' e 'Um' deve seguir ✕ até o pedido. Cenário novo em regras/turnos.md e regras/lembretes.md.
- **Ajuste da verificação à proposta:** Separar as duas coisas. (1) A marca de turno interrompido não deve ser sobrescrita pelo fim de um turno que não abriu pedido (aviso, hand-back, notificação): basta para o lembrete de replanejar e não depende de pergunta; conferir o efeito no aborted publicado, que a mãe usa para a rodada descartada (talvez precise de marca própria). (2) Manter ✕ no desenho durante o turno do aviso exige um estado próprio ('interrompido desde o último pedido'), porque wake roda em toda chamada de ferramenta: essa parte é a pergunta ao usuário. Corrigir a linha 97 do DESENVOLVIMENTO.md.
- **Pergunta ao usuário:** Depois do Esc, enquanto o modelo trata um aviso automático (filha terminou, subagente devolveu), a tarefa que você parou deve seguir ✕ (recomendado) ou voltar a ◉ durante esse turno?
- **Verificação:** Segui a sequência no código: Esc grava turnAborted; o prompt do aviso chama wake (zera turnEnded) e sai pelo ramo sem turno sem tocar na marca; o fim normal desse turno grava turnAborted = false. A mensagem seguinte da pessoa recebe a lista comum em vez do pedido de replanejar, o que viola lembretes.replanejar-apos-esc-pessoa, e a iniciada passa de ✕ a em andamento e depois a aguardando; numa orquestradora com filhas rodando a sequência é comum.

### Prompt entregue no meio do turno (turnId presente) abre pedido novo, derruba a pergunta aberta e manda planejar: o replano seguinte, no mesmo turno do modelo, cai em 'pedido novo'
- **Categoria:** fluxo não mapeado · **Severidade:** alta · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:9658-9673 — o kit diz que 'task-notification' e 'peer' podem ser entregues dentro de um turno em curso, com turnId presente
  - O código do mod não lê turnId nem wait em lugar nenhum (busca em hooks/, draw/, state/, io/ e text/)
  - task-tree/hooks/prompt-submit.ts:88 — o turno de origem 'scheduled-trigger', 'channel', 'coordinator' ou 'slack-ping', sem a tag de outra sessão no texto, nasce marcado como pedido do usuário (own)
  - Não confirmado: o momento em que o app desktop levanta prompt.submit para um prompt em fila; o harness não simula entrega no meio do turno
- **Regra do catálogo:** pedidos.uma-mensagem-um-pedido (Cada mensagem abre o seu pedido)
- **Cenário:** A orquestradora está no meio do turno, com '64' em andamento. Chega a mensagem de uma filha (SendMessage, entregue dentro do turno em curso) ou o usuário digita uma instrução enquanto ela trabalha. prompt.submit dispara com turnId: o mod abre o turno T2, tira do painel a pergunta ou escolha aberta do loop principal, zera os lembretes e injeta 'todo pedido abre uma tarefa; a primeira chamada é plan'. O modelo, ainda no mesmo turno, chama plan 64{…, 64.5}: como T2 é o último turno, o 64 (de T1) é interrompido e renomeado, tudo volta a pendente e o cartão da filha fica solto. Isso explicaria a frequência relatada numa orquestradora, que recebe mensagens das filhas o tempo todo. Não confirmei no código quando o app levanta prompt.submit para um prompt em fila; o tipo do kit diz que levanta com turnId.
- **Proposta:** Tratar e.turnId em promptSubmit: um prompt entregue dentro de um turno em curso não deve trocar o 'pedido vigente' do plan nem derrubar a pergunta aberta naquele momento. Opções: (a) guardar o turno aberto como pendente e só torná-lo vigente no próximo plan que não reuse nenhum id aberto, ou no fim do turno em curso; (b) abrir o turno, mas fazer sameRequest aceitar a tarefa cujo turno estava em curso quando o prompt chegou. Classificar a origem pelo kind (peer, peer-send-message) e não só pelo texto. Registrar o cenário no catálogo como checklist do app (o harness não simula entrega no meio do turno).
- **Ajuste da verificação à proposta:** Antes de implementar, registrar no app (debug de e.turnId e e.origin.kind no prompt.submit) uma mensagem de filha e um prompt digitado com o turno em curso. Adiar a abertura do pedido muda quando 'cada mensagem abre o seu pedido' vale: é pergunta (já posta). Parte do dano some se o replano de nível 1 aberto em mensagem seguinte passar a ser continuação. Catalogar como checklist do app.
- **Pergunta ao usuário:** Uma mensagem que chega com a sessão no meio do turno (de uma filha, ou sua, digitada enquanto ela trabalha) deve abrir um pedido novo no painel na hora, como hoje, ou só quando o turno em curso terminar (recomendado), mantendo até lá o pedido em que o modelo está trabalhando?
- **Verificação:** Confirmei pela leitura que promptSubmit ignora turnId e, para qualquer prompt que não seja aviso, abre turno, tira a espera de pergunta da principal e zera os lembretes; a partir daí o plan trata o nível 1 em curso como de pedido anterior. Os tipos do kit dizem que o prompt pode chegar com o turno em curso, mas o comportamento real do app não está no código.

### Turno parado com Esc não limpa `brief` nem `recap`: o resumo antigo vira o ↩ do pedido seguinte e cala os avisos de "falta o summary"
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/types/index.d.ts:215-218 — o tipo diz que brief e recap valem 'until the turn ends (then '')', sem exceção para o turno parado.
  - task-tree/hooks/prompt-submit.ts:88 com index.d.ts gerado 9953-9960 — um prompt pode chegar com o turno rodando (turnId), então zerar no openTurn apagaria o resumo de um turno ainda em curso.
- **Regra do catálogo:** turnos.resumo-sem-resposta-final (O resumo do done vira a linha ↩ mesmo sem texto final no turno); nenhum cenário cobre o resumo depois de um turno parado
- **Cenário:** 1) O modelo chama `done` no último passo com `summary: "Resumo A"`. 2) A pessoa aperta Esc antes da mensagem final: `turn.complete` chega com `isAborted`, e `brief` continua "Resumo A". 3) Pedido novo: o modelo planeja, trabalha e fecha tudo sem `summary`. Nenhum aviso de "falta o summary" sai (no `done` nem no `wrap_up`), porque `lastBrief` ainda devolve "Resumo A". 4) No fim do turno, a linha ↩ do pedido novo mostra "Resumo A", o resumo do pedido anterior, que também vai ao arquivo publicado e ao cartão na mãe.
- **Proposta:** Em `turnComplete`, zerar `brief` e `recap` para todo fim de turno do loop principal (fora do `if (!e.isAborted)`), ou zerá-los no `promptSubmit` ao abrir um turno novo (`openTurn`). Acrescentar o cenário em `regras/turnos.md` e o teste: Esc depois do `done` com `summary`, pedido seguinte sem `summary`, sem linha ↩ herdada e com o aviso.
- **Ajuste da verificação à proposta:** Preferir a primeira opção: zerar brief e recap em todo turn.complete do loop principal, também no parado (fora do if de isAborted). Zerar no prompt.submit é arriscado: uma mensagem de outra sessão entregue no meio de um turno abre turno e apagaria o resumo que o done do turno em curso acabou de gravar.
- **Verificação:** Conferi que brief e recap só são gravados vazios em turn.ts:123-124, dentro do if de turno não parado, e que nenhum outro ponto os zera (nem o /clear). Depois de um Esc posterior ao done com summary, lastBrief segue devolvendo o resumo antigo: os avisos de falta de resumo não saem e o turno seguinte sem summary ganha o ↩ do anterior.

### O request de qualquer plan renomeia o último turno, mesmo quando o plan não é o primeiro da mensagem ou vem depois de um aviso
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1282-1284 — o documento descreve o comportamento do código (o request opcional renomeia o último turno, ou cria um), sem dizer qual request vale quando há mais de um.
  - task-tree/tests/pedidos.test.ts:11-19 e 36-49 — os testes cobrem um request só e um plan sem request depois do aviso; nenhum cobre o segundo request.
- **Regra do catálogo:** pedidos.titulo-vem-do-request (O título do pedido vem do request do plan); pedidos.aviso-do-app-nao-abre-pedido (o plano seguinte entra no pedido atual, sem falar do título)
- **Cenário:** A pessoa pede 'Auditar o mod' (turno com o nível 1 '64'). A filha termina; chega o aviso do app (sem turno). O modelo planeja '66: conferir relato' com request 'Relato da auditoria'. O pedido da pessoa, que contém a 64, passa a se chamar 'Relato da auditoria'. É um segundo caminho para o sintoma 'o grupo do 64 ficou com o título do pedido mais novo'.
- **Proposta:** Decidir e registrar em regras/pedidos.md. Recomendado: o primeiro request do turno vale; os seguintes só renomeiam se o turno ainda não tem nível 1 (guardar uma marca no Turn). Implementação em planTool, linhas 86-94; teste em tests/pedidos.test.ts (plan com request, aviso, plan com outro request: o título segue o primeiro).
- **Ajuste da verificação à proposta:** Manter como pergunta ao usuário. Se a resposta for 'vale o primeiro', a marca no Turn precisa ser campo opcional (o Turn vai ao arquivo publicado, lido por outras versões) e o texto de PROMPT.notice e PROMPT.handback deveria dizer para não passar request num plan que continua o pedido.
- **Pergunta ao usuário:** Quando um segundo plan no mesmo pedido (um replano, ou um plan depois de aviso de filha) traz outro request, o título do pedido muda? Recomendado: não, vale o primeiro.
- **Verificação:** Conferi tools.ts:84-94: todo plan do loop principal com request não vazio troca o título do último turno, sem olhar se o turno já tem tarefas nem se o plan veio depois de um aviso. Como aviso, hand-back e notificação não abrem turno, o plan seguinte renomeia o pedido da pessoa. Nada no catálogo decide o caso.

### Aviso de permissão é identificado só por agente e ferramenta: chamadas paralelas o tiram cedo, e não há rede de segurança se o fim da chamada não rodar
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:8053-8059 e 853-869 — o evento PermissionRequest traz tool_name, tool_input e agent_id, sem tool_use_id: não dá para casar o aviso com a chamada pelo id.
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:4213-4214 — o diálogo de permissão abre dentro do next(e) do tool.call; o finally de outra chamada da mesma ferramenta pode rodar com ele aberto.
  - task-tree/hooks/turn.ts:157 — no fim de um subagente, dropWaits tira todos os avisos dele, permissão inclusive; só o loop principal fica sem saída além do fim de uma chamada da mesma ferramenta (e do /clear, session-start.ts:74).
- **Regra do catálogo:** perguntas.permissao-espera (O pedido de permissão aparece como espera) — só cobre o aviso aparecer
- **Cenário:** (a) Sai cedo: o modelo dispara dois Bash no mesmo passo; o primeiro é permitido por regra, o segundo abre o diálogo de permissão. O aviso "Aguardando permissão: Bash" entra; quando o primeiro Bash termina, o finally dele tira o aviso do segundo, com o diálogo ainda aberto. O painel deixa de dizer que espera a pessoa e o arquivo publica waiting false: na mãe, a filha aparece trabalhando enquanto está parada à espera do usuário. (b) Não sai: se o hook da chamada que pediu permissão não chega ao finally (falhou antes do try e o host o pulou; ou o módulo foi recarregado com o diálogo aberto), o aviso fica até a próxima chamada da mesma ferramenta pelo mesmo agente; o prompt seguinte e o fim do turno não o tiram.
- **Proposta:** No tool.call, contar as chamadas em curso por `${agent}:${tool}` (variável de módulo) e tirar o aviso só quando a última termina. Como rede de segurança, no turn.complete do agente tirar também os avisos de permissão dele (turno encerrado não tem permissão pendente) e, no prompt da própria pessoa, os do loop principal. Acrescentar ao catálogo os cenários "a permissão sai quando a chamada termina" e "duas chamadas paralelas da mesma ferramenta".
- **Ajuste da verificação à proposta:** O contador de chamadas em curso por agente e ferramenta, se for variável de módulo, zera na recarga a quente: tratar contador ausente como zero e nunca deixar negativo. Na rede de segurança, não tirar a permissão do loop principal em todo prompt.submit: um prompt pode chegar com o turno rodando (mensagem de outra sessão entregue no meio do turno, prompt digitado em fila) e o diálogo ainda aberto; o lugar seguro é o turn.complete do loop principal (turno encerrado não tem permissão pendente).
- **Verificação:** Conferi permission.ts e tool-call.ts: a chave é agente mais nome da ferramenta e o finally de qualquer chamada da mesma ferramenta tira o aviso. Com duas chamadas simultâneas (duas leituras, uma liberada por regra e outra pedindo permissão) o aviso sai com o diálogo aberto e o arquivo publica waiting falso. A variante do aviso preso depende de uma falha do hook antes do try, que o código não mostra acontecer.

### A tarefa iniciada num turno anterior volta a 'em andamento' com o relógio correndo em qualquer prompt seguinte, e fica presa se o pedido novo muda de rumo
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/turnos.test.ts:133-146 — o teste afirma, sim, algo sobre 'Um': exige que o painel inteiro não tenha ✕ depois da mensagem seguinte ao Esc; manter o ✕ até o start quebra esse teste coberto
  - task-tree/DESENVOLVIMENTO.md:97, 541-545 e hooks/panel.ts:28-30 — voltar a 'em andamento' no prompt seguinte está documentado como intencional (wake)
  - regras/arvore.md:48-57 — a decisão de 2026-10-27 diz '◉ só no caminho da última iniciada no turno' e 'planos parados de pedidos anteriores seguem ◷'; a folha iniciada em turno anterior acende o plano e o pedido antigos pelo current(), fora dessa regra
- **Regra do catálogo:** turnos.prompt-seguinte-retoma; turnos.pedido-anterior-parado-aguarda; arvore.pai-em-andamento-no-caminho-da-ultima-iniciada
- **Cenário:** Pedido 1: plano A, 'Um' em andamento. Esc ('Um' ✕). A pessoa manda 'esquece, faça outra coisa'. No prompt, 'Um', 'Plano A' e 'Pedido 1' voltam a ◉ com o tempo contando desde o start original. O modelo planeja B com ids novos e trabalha: o painel mostra dois pedidos em andamento, o chip '2 em andamento' e o relógio de 'Um' correndo sem ninguém trabalhando nele, por tempo indefinido. Se o modelo seguir o lembrete e der done em 'Um', ela aparece ✓ e entra no 'x de y' como feita, embora tenha sido abandonada. O mesmo ocorre depois de um fim normal (◷ volta a ◉ no prompt seguinte, antes de qualquer start).
- **Proposta:** Definir no catálogo o destino da folha iniciada e aberta de um pedido anterior. Proposta: no prompt que abre turno depois de um turno interrompido, gravar no state a interrupção das folhas iniciadas da principal (menos a que tem carta na fila), mantendo o ✕ que a pessoa viu; start reabre (begin já reabre tarefa fechada) se o trabalho continua. Depois de fim normal, manter ◷ até um start no turno novo (acender folha só se startedAt >= início do turno em curso, como o trail já faz para os pais). Ajustar turnos.prompt-seguinte-retoma e acrescentar cenário 'pedido anterior com iniciada aberta'.
- **Ajuste da verificação à proposta:** As duas metades mudam comportamento coberto ou documentado: é pergunta (já posta). A metade do fim normal (seguir aguardando até um start no turno novo) casa com a decisão de 2026-10-27 e não quebra teste atual; a do Esc (seguir ✕ até o start) quebra o teste selado de turnos.prompt-seguinte-retoma. Não gravar a interrupção no state: muda o done (passa a responder 'foi interrompida') e tira a tarefa do x/y; manter como marca de desenho.
- **Pergunta ao usuário:** Depois do Esc, na mensagem seguinte, a tarefa que estava em andamento deve (a) seguir ✕ até o modelo dar start nela de novo (recomendado), ou (b) voltar a ◉ sozinha, como hoje? E depois de um fim normal: seguir ◷ até o start (recomendado) ou voltar a ◉ no prompt?
- **Verificação:** Conferi que halt é só de desenho, que wake o desliga em todo prompt e que current() acende toda folha aberta e iniciada, com os pais, de qualquer pedido, com o relógio contando o tempo parado. O retorno a 'em andamento' é intencional e documentado, mas o catálogo não diz o destino da folha iniciada de um pedido anterior, e duas regras cobertas puxam para lados opostos nesse caso; os testes só cobrem pedido anterior com concluída e pendentes.

### Turno sem plano grava a resposta e o resumo ↩ no pedido anterior
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/turn.ts:134 — sem summary no turno, só o reply (tooltip) do pedido anterior é trocado; a linha ↩ só muda quando há summary, que é justamente o que WRAP_UP.noBrief pede em todo wrap_up sem resumo (tool-call.ts:179, rules.ts:178-180).
  - task-tree/DESENVOLVIMENTO.md:105 — o documento descreve 'grava no último turno com tarefas', como comportamento do código, não como decisão.
  - task-tree/draw/layout.ts:605-607 e regras/turnos.md:69-77 — o turno sem tarefa é tratado como prompt que continua o plano; daí a escolha de gravar no último turno com tarefas.
- **Regra do catálogo:** turnos.resumo-sem-resposta-final; turnos.continuacao-sem-start-aguarda (o prompt que continua o plano, caso em que gravar no pedido anterior é o certo)
- **Cenário:** Pedido 1: plano, tudo concluído, ↩ 'Commit abc no PR #5'. Pedido 2: a pessoa faz uma pergunta rápida; o modelo responde só com texto, ou chama wrap_up, recebe 'falta o resumo do turno' e chama done só com summary 'Explicado o fluxo X'. No fim do turno, a linha ↩ do Pedido 1 passa a mostrar 'Explicado o fluxo X' (e o tooltip, a resposta do Pedido 2); no cartão desta sessão na sessão mãe, a resposta do Pedido 1 some. O Pedido 2 não aparece em lugar nenhum.
- **Proposta:** Decidir e registrar no catálogo. Sugestão: em turn.complete, gravar reply/brief só se o último turno com tarefas é o turno aberto agora ou se alguma tarefa dele foi mexida neste turno (continuação); caso contrário, guardar no turno novo e desenhá-lo como pedido só com a linha ↩, ou não guardar. Em wrapUpOpen, não pedir summary quando o pedido atual não tem tarefa.
- **Ajuste da verificação à proposta:** Manter como pergunta. A correção precisa preservar a continuação: quando a mensagem continua o plano do pedido anterior (alguma tarefa dele mexida no turno), a resposta segue indo para esse pedido. E wrapUpOpen só deve pedir summary quando o pedido aberto agora tem tarefa ou é continuação.
- **Pergunta ao usuário:** Quando um pedido termina sem nenhuma tarefa (só resposta), onde vai o ↩ dele: (a) num pedido próprio só com a linha ↩, (b) em lugar nenhum, ou (c) no pedido anterior, como hoje? Recomendo (a) quando há summary e (b) quando não há; nunca sobrescrever o ↩ de um pedido já encerrado.
- **Verificação:** Conferi turn.ts:127-137: reply e brief vão para o último turno que tem tarefas, não para o turno aberto pelo prompt. Num pedido sem plano, o wrap_up pede done só com summary e esse resumo sobrescreve o ↩ do pedido anterior, também no cartão que a mãe desenha. O código não distingue continuação de pedido novo sem tarefa.

### O prompt é classificado pelo texto em qualquer posição e não pela origem do motor; botões do wrap_up, mensagens só com anexo e disparos agendados não têm regra
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:63-65 — o comentário diz que os avisos do app e o hand-back NÃO chegam como 'unclassified' nem 'task-notification': por isso são reconhecidos pelo texto. A origem que eles trazem não está registrada em lugar nenhum.
  - task-tree/DESENVOLVIMENTO.md:1273-1278 — o documento registra que as outras origens (o usuário, outra sessão, um plugin, uma tarefa agendada) abrem turno; marcar o disparo agendado como pedido da própria pessoa não foi decidido.
  - task-tree/tests/kit/cenario.ts:43-50 — o kit manda os prompts sem origin: o reconhecimento pelo texto precisa continuar existindo.
- **Regra do catálogo:** turnos.prompt-sem-turno; pedidos.aviso-do-app-nao-abre-pedido; perguntas.escolha-do-wrapup-ate-proxima-mensagem
- **Cenário:** (1) A pessoa cola no chat um trecho que contém '[Subagent hand-back]' ou '<\cross-session-message' (comum ao discutir este mod): a mensagem não abre pedido, ou abre como carta recebida de outra sessão, sem o lembrete de pedido novo. (2) A pessoa manda só uma imagem, sem texto: corpo vazio, tratado como aviso do app. (3) Clique num botão de ação do wrap_up, se o app o entrega como auto-continuation: não abre turno e 'Aguardando sua escolha' fica na tela enquanto o modelo já trabalha. (4) Um /loop ou tarefa agendada abre um pedido marcado como da própria pessoa e, depois de Esc, recebe 'o usuário interrompeu... esta é a mensagem seguinte dele'.
- **Proposta:** Usar origin.kind como fonte principal (composer, bridge e sdk: pessoa; peer e peer-send-message: outra sessão; scheduled-trigger: disparo agendado, com texto próprio) e deixar o texto só como recuo quando a origem não vem, com as marcas ancoradas no começo do corpo. No ramo sem turno, tirar a espera 'choice' quando a origem é auto-continuation. Cenários novos no catálogo para anexo sem texto, botão do wrap_up e disparo agendado. Conferir no app que origem cada um traz.
- **Ajuste da verificação à proposta:** Não trocar para a origem como fonte principal antes de medir: o próprio código diz que os avisos do app e o hand-back não vêm com origem distinguível, então podem chegar com a mesma origem de um prompt digitado. Primeiro registrar no log a origem de cada tipo (aviso de sessão, hand-back, clique no botão do wrap_up, envio só com imagem, disparo agendado). Correção segura já: ancorar as marcas no começo do corpo (depois de tirar os system-reminder), em said e em noteReceived. Para o disparo agendado, não usar o texto de 'o usuário interrompeu' depois de um Esc.
- **Verificação:** Reproduzi pela leitura os casos do texto colado e do disparo agendado: a marca do hand-back e a tag de outra sessão valem em qualquer posição do corpo, e noteReceived grava como recebida qualquer tag citada, o que pode confirmar um envio alheio. O disparo agendado abre turno marcado como da pessoa. Os casos do botão do wrap_up e do envio só com imagem dependem do que o app entrega e seguem como suspeita.

### Comando local (/task-tree, /model e outros) passa pelo prompt.submit como pedido da pessoa: acorda o painel sem turno, tira a escolha pendente e consome as marcas do próximo pedido
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:9715-9724 — um comando em fila sem carimbo chega como 'unclassified', que está em NO_TURN: não abre pedido nem tira esperas, mas o wake (hooks/prompt-submit.ts:56) roda do mesmo jeito
  - task-tree/hooks/command.ts:10-29 — o /task-tree do próprio mod só abre o pane e publica; nada ali protege o painel do prompt.submit do comando
  - Não confirmado: se o app desktop levanta prompt.submit para comandos locais que não geram turno do modelo
- **Regra do catálogo:** perguntas.escolha-do-wrapup-ate-proxima-mensagem (A escolha do wrap_up fica até a próxima mensagem)
- **Cenário:** Turno terminado com 'Um' ◷ aguardando e 'Aguardando sua escolha' do wrap_up. A pessoa digita /task-tree (ou /model) para olhar o painel. Se o app levanta prompt.submit para o comando: 'Um' volta a ◉ com o relógio contando o tempo parado, sem turno nenhum rodando, até o próximo turno de verdade terminar; 'Aguardando sua escolha' some sem resposta; depois de um Esc, a marca de interrompido é gasta no comando e a mensagem seguinte recebe a lista comum em vez do pedido de replanejar; a marca 'esta mensagem é a resposta' também se perde.
- **Proposta:** Conferir no app com um log de e.command no prompt.submit. Se confirmar: quando e.command está presente e o comando não gera turno do modelo (ou sempre que for o próprio 'task-tree'), não chamar wake, não tirar esperas, não zerar marcas nem abrir turno. Cenário novo: 'comando local não mexe no painel'.
- **Ajuste da verificação à proposta:** Conferir primeiro no app (debug de e.command e e.origin.kind). Não tratar todo prompt com e.command como 'não é mensagem': comando de skill ou de prompt gera turno do modelo e é pedido de verdade, tem de continuar abrindo pedido. O critério seguro é pular wake, esperas, marcas e turno só para os comandos locais que não geram turno (a começar pelo próprio task-tree); o wake pode ficar para a primeira chamada de ferramenta, que já o faz (hooks/tool-call.ts:209).
- **Verificação:** Confirmei que promptSubmit não lê e.command e que turnEnded e turnAborted só voltam a ser gravados num turn.complete, então um comando sem turno deixaria a tarefa parada desenhada em andamento e gastaria as marcas do próximo pedido. Falta saber se o app levanta prompt.submit para esses comandos, o que o código não mostra.

### Esc na principal: só a carta na fila poupa a tarefa; sessão filha viva e subagente em segundo plano deixam a tarefa ✕
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1305-1312 — o cartão de subagente só é desenhado sob a tarefa enquanto t.status é 'open'; a folha que o halt deixa interrompida perde o cartão do subagente em segundo plano, que também não entra em lost (1383-1385) e some do painel e da pílula de subagentes.
  - task-tree/hooks/agents.ts:147 e 158-199 — quando o subagente em segundo plano termina depois do Esc, settleBySubs fecha no state a tarefa que o desenho mostrava interrompida.
  - regras/envios.md:31-42 e task-tree/tests/envios.test.ts:216-235 — decisão registrada: depois da entrega imediata (a sessão destino já trabalha na mensagem), o Esc deixa a tarefa iniciada interrompida, como qualquer outra.
- **Regra do catálogo:** envios.esc-apos-entrega-imediata (Depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem) — faltou no achado e trata do caso da filha trabalhando por mensagem
- **Cenário:** Orquestradora com "Implementar" iniciada e uma filha aberta nela, trabalhando. O usuário aperta Esc na orquestradora. Até a próxima mensagem, o painel mostra "Implementar" ✕ "interrompida" (sem x/y), com o cartão da filha "trabalhando" pendurado nela e o pai acima ◉. No fim normal do turno a mesma tarefa fica ◉; com uma carta na fila ficaria ◷; com um subagente em segundo plano fica ✕ e o cartão dele some.
- **Proposta:** Decidir e registrar no catálogo o que o Esc faz com a tarefa que tem trabalho delegado vivo. Implementação sugerida: passar ao `halt` também as âncoras com sessão viva na rodada atual (`roundAt`) e com subagente running/background, tratando-as como `sent` (ficam abertas, ◷ ou ◉ por `w.busy`).
- **Ajuste da verificação à proposta:** A proposta de manter em andamento a tarefa com filha viva contradiz, para a filha que trabalha numa mensagem entregue, a decisão registrada em envios.esc-apos-entrega-imediata: deve ir como pergunta ao usuário, citando esse cenário (manter a decisão, ou reescrevê-la para toda tarefa com trabalho delegado vivo). O que é defeito sem decisão contrária e pode ser corrigido direto: o cartão do subagente em segundo plano não pode sumir enquanto ele roda (desenhar os subagentes vivos sob a tarefa também quando ela está interrompida, ou soltá-los no fim da lista), e a linha interrompida não deve ter relógio correndo.
- **Pergunta ao usuário:** No Esc da principal, a tarefa que tem uma sessão filha trabalhando (ou um subagente em segundo plano) deve ficar ✕ interrompida, como hoje, ou seguir em andamento/aguardando como a tarefa com carta na fila? Recomendo: seguir ◉ enquanto a filha trabalha e ◷ enquanto o subagente roda, igual à carta.
- **Decisão já registrada:** regras/envios.md, envios.esc-apos-entrega-imediata, decisão do usuário de 2026-10-28 e 2026-10-30: 'a tarefa iniciada fica ✕ no Esc, como qualquer outra (entregue a mensagem, ela é uma tarefa comum)'. Cobre a tarefa com sessão trabalhando numa mensagem entregue; não cobre a sessão aberta por start_session nem o subagente em segundo plano.
- **Verificação:** Reproduzi pela leitura: com aborted, o halt deixa a folha iniciada interrompida, e o tom testa interrupted antes de w.busy; o pai volta a em andamento, a folha fica interrompida com o cartão da filha trabalhando embaixo e o tempo calculado como em curso. O cartão do subagente em segundo plano some porque só é desenhado sob tarefa aberta. Parte do comportamento já foi decidida pelo usuário para a mensagem entregue.

### Turno da principal que morre por erro de API, limite de contexto ou recusa é tratado como fim normal
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:14872-14874 — isAborted só é verdadeiro com reason 'aborted'; erro e recusa chegam com isAborted falso e caem no ramo de fim normal de turn.ts:118-150.
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim (define só o fim normal); nenhum cenário para turno da principal que morre por erro ou recusa
- **Cenário:** Tarefa 'Um' em andamento; a API devolve erro depois das tentativas, ou o contexto estoura. O painel mostra 'Um' ◷ 'Aguardando', igual a quando o modelo para de propósito esperando a pessoa; uma tarefa com subagentes concluídos fecha ✓ mesmo com o turno morto. Na mãe, o cartão da filha diz 'parada' e o lembrete fala em 'terminou o turno… confira o relato', sem indicar falha. A mensagem seguinte recebe só a lista para fechar.
- **Proposta:** Decidir e registrar no catálogo o desenho do turno falho. Proposta: tratar reason 'error'/'refusal' como interrupção para o painel (iniciada ✕, com a palavra 'falhou' que o subagente já usa) e levar na mensagem seguinte o pedido de replanejar; publicar a marca para o cartão na mãe. Ajustar o kit para usar reason 'answer'/'aborted' e acrescentar o roteiro de turno falho.
- **Ajuste da verificação à proposta:** Manter como pergunta. Para desenhar 'falhou' na principal é preciso um estado novo (o halt é só desenho e hoje recebe apenas aborted), guardado no store junto de turnEnded e turnAborted e publicado para o cartão na mãe. A correção do reason do kit ('end_turn' por 'answer' e 'aborted') mexe em arquivo selado do kit: precisa de selo de refatoração.
- **Pergunta ao usuário:** Quando o turno morre por erro de API ou limite de contexto, a tarefa em andamento deve aparecer ✕ 'falhou' (recomendado, como no subagente), ✕ 'interrompida', ou ◷ como hoje?
- **Verificação:** Conferi que turnComplete só lê e.isAborted para o loop principal e que subEnd distingue erro e recusa só para subagente. Os tipos do motor preveem reason 'error' e 'refusal' também na principal. O painel mostra a tarefa aguardando e a mãe recebe o lembrete de turno terminado, sem marca de falha.

### Fim de turno: o documento diz que a tarefa iniciada vira interrompida; o código e o catálogo a deixam aguardando (◷), e só o Esc interrompe
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:231 — a tabela de estado repete: turnEnded, 'o que ela deixou aberto é desenhado interrompido, sem relógio'.
  - task-tree/DESENVOLVIMENTO.md:1229 — 'estava em andamento aparece interrompido, sem relógio'.
  - task-tree/DESENVOLVIMENTO.md:536-537 — 'pai sem nada aberto embaixo vira interrompido'; no código (layout.ts:65-66) ele vira concluído.
  - Busca no documento por leftWaiting, aborted, turnAborted e Esc: nenhuma ocorrência; a regra de 2026-10-27 não entrou no documento.
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim; turnos.esc-interrompe-so-a-iniciada; turnos.pai-com-filha-concluida-nunca-interrompido
- **Cenário:** O modelo dá `start` numa tarefa e encerra o turno sem `done`. O painel mostra ◷ "Aguardando" e o chip de espera; o documento promete ✕ "interrompida" e a saída do total. Quem investiga um relato do tipo "ficou ◷, devia estar ✕" pelo documento conclui que o código está errado.
- **Proposta:** Reescrever o parágrafo "Tarefas abertas de uma sessão que terminou o turno" com a regra atual (iniciada ◷; ✕ só com `aborted`; tarefa com carta na fila fica ◷ mesmo com Esc; pai com nada aberto embaixo vira ✓) ou trocá-lo por um ponteiro para os cenários de `regras/turnos.md`.
- **Ajuste da verificação à proposta:** A correção é só de documentação e não muda regra. Além do parágrafo das linhas 521-540, corrigir a linha de turnEnded na tabela de estado (231) e o trecho da linha 1229, e trocar 'pai sem nada aberto embaixo vira interrompido' por concluído. O documento também não cita a assinatura atual de halt (at, sent, aborted).
- **Decisão já registrada:** regras/turnos.md: turnos.iniciada-aguarda-no-fim (decisão do usuário, 2026-10-27, commit 95b1a21) e turnos.esc-interrompe-so-a-iniciada (2026-10-27, commit d57807e; reescrito em 2026-11-04). O código segue o catálogo; só o documento ficou para trás.
- **Verificação:** Li o trecho do documento e o halt no código: no fim normal a folha iniciada fica aberta com o relógio parado (aguardando), só o turno parado interrompe, e o pai sem nada aberto fica concluído. O catálogo registra a decisão do usuário; o documento ainda descreve a regra anterior em pelo menos três lugares.

### Mensagem só com imagem (texto vazio) é classificada como aviso do app e não abre pedido
- **Categoria:** omissão · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:63-65 — os avisos do app são reconhecidos pelo texto porque não trazem origem distinguível; a origem de um aviso com corpo vazio não está registrada.
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:9939-9942 — attachments existe só quando o envio traz imagem ou outro item que não é texto: é o discriminador que não depende da origem.
- **Regra do catálogo:** pedidos.aviso-do-app-nao-abre-pedido (o cenário só fala do aviso com a tag de evento do app; o corpo vazio como aviso não tem cenário)
- **Cenário:** A pessoa cola um print do painel e envia sem texto (uso comum neste projeto, que valida o desenho no app). Se o app entrega text vazio com o anexo: o mod trata como aviso de sessão, não mostra o lembrete de pedido novo, não abre pedido; o plano que o modelo fizer entra no pedido anterior (e um request renomeia o título dele); 'Aguardando sua escolha' não sai; depois de um Esc, o pedido de replanejar não vem.
- **Proposta:** Tratar como aviso só o texto vazio sem anexos e sem origem da pessoa: se e.attachments tem itens ou origin.kind é composer/bridge, é pedido (título 'Imagem' ou o nome do arquivo). Conferir no app o que chega em e.text num envio só com imagem; cenário novo em regras/pedidos.md.
- **Ajuste da verificação à proposta:** É o mesmo caso do envio só com anexo do achado da classificação pelo texto: juntar os dois. Usar e.attachments com itens como sinal de pedido, sem depender de origin.kind (não se sabe a origem dos avisos de corpo vazio; se for a mesma de um prompt digitado, a regra por origem quebraria o aviso). Antes, conferir no app o que chega em e.text num envio só com imagem: se vier um marcador de imagem no texto, o problema não existe.
- **Verificação:** Pelo código, corpo vazio depois de tirar os system-reminder é aviso do app: não abre pedido, não tira a espera de escolha e não leva o pedido de replanejar. Se o envio só com imagem chega com texto vazio depende do app, e o código não mostra. O achado é plausível e fica como suspeita até a conferência no app.

### 'Mesmo pedido' no replano é o turno, e mensagem de outra sessão também abre turno: para a orquestradora, o relato de uma filha vira 'pedido novo'
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/text/rules.ts:124-144 — os lembretes de turno interrompido (mensagem da pessoa e de outra sessão) mandam replanejar 'mantendo os ids das tarefas que continuam, que guardam o estado'; mas essa mensagem abre turno novo (prompt-submit.ts:88) e, por tools.ts:60-63 e 76-78, o plano com os mesmos ids vira histórico interrompido e tudo recomeça pendente. O texto ao modelo contradiz o código.
  - task-tree/text/rules.ts:38-41 e 69-71 — a regra e a descrição do plan prometem que o replano guarda o estado, sem a condição 'no mesmo pedido'.
  - task-tree/DESENVOLVIMENTO.md:1279-1289 — o documento define 'mesmo pedido' como o último turno e registra que a mensagem de outra sessão abre turno.
  - regras/envios.md:108-118 — envios.pedido-recebido-mostra-carta: a mensagem de outra sessão abre um pedido.
- **Regra do catálogo:** pedidos.replano-no-lugar; pedidos.plano-anterior-vira-historico; envios.pedido-recebido-mostra-carta; lembretes.replanejar-apos-esc-pessoa; lembretes.outra-sessao-apos-esc
- **Cenário:** A pessoa pede a tarefa 64; a orquestradora planeja, abre uma filha e encerra o turno. A filha responde por SendMessage (abre turno, marcado como mensagem recebida). A orquestradora replaneja '64' para acrescentar o passo de conferência: como o turno é outro, o plano anterior vira histórico e tudo recomeça pendente, embora a pessoa não tenha pedido nada novo. Se a filha apenas encerrar o turno (aviso do app), o mesmo replano guarda o estado.
- **Proposta:** Definir em regras/pedidos.md o que é 'mesmo pedido' para o replano (recomendado: a decisão não depender do turno, e sim de o plano continuar o nível 1, como no primeiro achado). Se a regra por turno for mantida, registrar o cenário da mensagem de outra sessão com teste (mensagemDe seguido de plan com os mesmos ids).
- **Ajuste da verificação à proposta:** A recomendação de o replano não depender do turno contradiz duas decisões registradas (a mensagem de outra sessão abre pedido; o plano de pedido anterior com o mesmo id vira histórico): deve virar pergunta ao usuário, não correção direta. O que dá para corrigir sem decisão nova é o texto ao modelo: os lembretes de turno interrompido e a regra do replano dizem que manter os ids guarda o estado, o que só vale dentro do mesmo pedido. Ou o texto passa a dizer isso, ou a pergunta ao usuário inclui se o replano pedido depois de um Esc deve mesmo guardar o estado (o que pediria mudar o código nesse caminho).
- **Decisão já registrada:** regras/pedidos.md, pedidos.plano-anterior-vira-historico ('o usuário confirmou em 2026-10-27'); regras/envios.md, envios.pedido-recebido-mostra-carta (decisão do usuário, 2026-10-30: a mensagem de outra sessão abre um pedido, com a carta); task-tree/DESENVOLVIMENTO.md:1279-1289.
- **Verificação:** Conferi que o replano no lugar compara o turno da tarefa com o último turno e que toda mensagem de outra sessão abre turno: o relato de uma filha por mensagem faz o replano virar histórico, e o mesmo relato por aviso do app guarda o estado. As duas regras estão decididas e documentadas, mas o texto que o mod manda ao modelo promete o contrário depois de um turno interrompido, e nenhum teste cobre esse replano.

### turn.complete é uma sequência sem isolamento: uma falha no começo deixa o turno sem fim registrado e o painel "em andamento" para sempre
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:5404-5406 — o orçamento de 10 s do hook conta só o tempo do próprio código; o relógio para durante next(e) e qualquer chamada de $. Lentidão de disco ou de state não derruba o hook.
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:14843-14846 — hook que falha depois do next: o resultado do next fica valendo ('kept'); o r não se perde para o app.
  - task-tree/hooks/panel.ts:331-338 com task-tree/io/publish.ts:32-43 — a única fonte de exceção que achei: showStatus chama total sobre os painéis das filhas, e parsePublished não confere o interior de groups; um arquivo de filha com grupo sem tasks faria todo change lançar.
  - task-tree/hooks/panel.ts:31-37 e turn.ts:142-150 — para a principal o efeito não é permanente: o próximo turn.complete que rodar inteiro grava turnEnded.
- **Regra do catálogo:** durabilidade.fim-do-turno-sobrevive-ao-reinicio; turnos.subagente-que-termina-interrompe
- **Cenário:** O turno termina e um passo acessório lança (por exemplo, o cálculo do status em persist ao gravar a resposta do turno). O host descarta o hook: turnEnded e turnAborted não são gravados, saveTurn e publishPanel não rodam. O painel segue com ◉ e o relógio contando com a sessão parada; a mãe não recebe a resposta do turno nem a marca de turno parado; depois de um reinício o turno também volta como em andamento. Para subagente: se $.agent.list() lança, o cartão fica "trabalhando" para sempre, o que ele deixou aberto não é interrompido e a tarefa de origem nunca fecha (settleBySubs vê um subagente ainda rodando).
- **Proposta:** Gravar primeiro o essencial (turnEnded, turnAborted, saveTurn) e depois o resto, cada passo em bloco próprio com try/catch e debug(): a resposta no turno, settleBySubs e a publicação não podem impedir o registro do fim. No ramo do subagente, tratar a falha de $.agent.list() como "não é teammate" e seguir com subEnd.
- **Ajuste da verificação à proposta:** Corrigir o título: na principal o painel fica em andamento até o próximo turno terminar bem, não para sempre; permanente só no ramo do subagente (o fim dele não se repete). Manter a ordem proposta (gravar turnEnded, turnAborted e saveTurn antes do resto) e o try em $.agent.list(). No turnStep, chamar it.return() num finally quando o consumidor para antes do fim. Somar a validação do interior de groups em parsePublished, que tira a única fonte concreta de exceção.
- **Verificação:** A estrutura é como o achado descreve: nenhum passo depois do next é isolado e turnEnded vem depois do change. Mas não achei, no uso real, o que lance ali: o orçamento do hook não conta a espera de $ e as chamadas internas de publicação já têm try. O gatilho depende de uma falha do host ou de um arquivo de filha malformado, que o código não mostra acontecer.

### Pendentes "nunca ✕" no fim do turno, mas ficam ✕ quando o subagente termina ou a filha é arquivada
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/turnos.md:18-26` — turnos.pendentes-seguem-pendentes: nunca iniciadas 'seguem ○, nunca ✕', 'na principal e nas filhas' (decisão do usuário, 2026-10-27)
  - `regras/turnos.md:90-100` — turnos.subagente-que-termina-interrompe: 'o que ele deixou aberto fica ✕' (origem: regra do painel, sem decisão)
  - `task-tree/tests/turnos.test.ts:148-166` — 'Sub três', nunca iniciada, é afirmada 'interrompida' quando o subagente termina
  - `regras/sessoes.md:97-106` — sessoes.filha-arquivada-interrompe: 'o que ficou aberto fica ✕'
  - `task-tree/tests/sessoes.test.ts:82-90` — 'Aberta', nunca iniciada, afirmada 'interrompida' na filha arquivada
- **Regra do catálogo:** turnos.pendentes-seguem-pendentes — As pendentes seguem pendentes no fim do turno, na principal e nas filhas.
- **Cenário:** Um subagente planeja três tarefas, conclui uma, inicia a segunda e termina: a terceira, que nunca começou, aparece ✕ 'interrompida' e entra no chip de interrompidas. O mesmo plano na principal ou numa filha, no fim do turno ou no Esc, deixa a terceira ○. A decisão 'pendentes nunca ✕' não diz se vale para o fim de um subagente e para a filha arquivada; os dois cenários que dizem ✕ são 'regra do painel desde a entrada do mod', anteriores a ela.
- **Proposta:** Registrar a escolha nos dois cenários (origem com a decisão) e, se a resposta for igualar, tratar a pendente de subagente terminado e de filha arquivada como ○ fora da contagem (como a filha 'encerrada').
- **Pergunta ao usuário:** Tarefa nunca iniciada de um subagente que terminou (ou de uma filha arquivada): fica ✕ interrompida, como hoje, ou segue a regra 'pendentes nunca ✕'? Recomendo manter ✕ nesses dois casos (ninguém mais vai executá-las) e escrever isso no catálogo como decisão sua.

### 'Aguardando sua escolha' some com mensagem de outra sessão e fica com aviso automático; a regra diz 'até a próxima mensagem da pessoa'
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/prompt-submit.ts:66-82` — O dropWaits das esperas da principal roda em todo prompt que abre turno, inclusive o de outra sessão; os prompts sem turno saem antes e mantêm a espera.
  - `task-tree/hooks/tool-call.ts:76-88` — O comentário diz 'until the next prompt'; a espera 'choice' só sai ali ou num wrap_up novo.
  - `task-tree/hooks/panel.ts:565-570` — No fim do turno só saem as esperas de pergunta e plano; a de permissão não sai no fim do turno nem no prompt (prompt-submit.ts 82 a preserva).
  - `regras/perguntas.md:57-65` — perguntas.escolha-do-wrapup-ate-proxima-mensagem: fica 'até a próxima mensagem da pessoa'.
- **Regra do catálogo:** perguntas.escolha-do-wrapup-ate-proxima-mensagem
- **Cenário:** A orquestradora encerra o turno com wrap_up e pergunta ('Posso fazer o commit?'). Antes de a pessoa responder, uma filha manda uma mensagem: a linha 'Aguardando sua escolha' some e a sessão deixa de publicar que espera a pessoa, embora ela não tenha escolhido. Já um aviso do app (filha terminou) abre um turno automático e a linha permanece, mesmo que o turno termine sem novo wrap_up.
- **Proposta:** Decidir o critério (a pessoa respondeu, ou qualquer turno novo) e aplicar igual a mensagem de outra sessão e a aviso automático; ajustar o texto da regra ou o código. Aproveitar para limpar esperas de permissão órfãs no fim do turno da principal.

### turn.step percorre o fluxo do modelo com it.next() manual, sem try/finally, e faz chamadas ao host antes do pedido e do primeiro pedaço
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/turn.ts:73-106` — Antes de next(e): leitura e escrita de estado sem try. O laço usa it.next() e yield, sem finally que chame it.return(). Depois do último pedaço: subStep (que pode chegar a change e persist) e leitura e escrita da taxa, sem try.
  - `task-tree/hooks/turn.ts:87-93` — O relógio é lido com await antes de repassar o primeiro pedaço e no pedaço de parada; onde o relógio falha, stamp devolve undefined e a leitura se repete a cada pedaço.
  - `task-tree/.claude-plugin/types/claude-code/index.d.ts:13431-13439` — As formas que o kit indica são `return yield* next(e)` e `for await (const c of next(e)) yield f(c)`, que repassam o encerramento ao fluxo de baixo; e "a hook that fails mid-stream is left, the rest from beneath it".
  - `task-tree/hooks/agents.ts:89-101` — subStep grava o cartão do subagente via change (store e publicação) entre o fim do fluxo e a devolução do resultado.
- **Regra do catálogo:** sem cenário
- **Cenário:** A pessoa aperta Esc no meio de uma resposta: o gerador do mod é encerrado no yield, mas o iterador de baixo não recebe return() por este hook; se o host depende disso para liberar o fluxo, ele fica aberto (o código não mostra o que o host faz). Uma falha de estado antes de next(e) ou depois do último pedaço tira o hook do fluxo: a resposta segue, mas o modelo, a taxa e o cartão do subagente não são atualizados naquele passo. Cada resposta do modelo também espera uma ida ao host antes do primeiro pedaço.
- **Proposta:** Envolver o laço em try/finally que chame it.return?.() quando o gerador é encerrado antes do fim (ou reescrever com for await, lendo o resultado final como o kit indica). Pôr as leituras e escritas de estado de antes e de depois do fluxo no auxiliar único, e medir o primeiro pedaço sem segurar o yield.

## Sessões filhas e cartões

36 achados: 3 de severidade alta, 21 média, 12 baixa.

### O trabalho atual (work) não acompanha a renomeação do nível 1: o pedido antigo com cartão vivo sai de vista na hora (cartão solto) e, no sentido inverso, um pedido antigo já concluído pode ficar à vista
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:593-603 — startsWork responde verdadeiro em todo pedido novo antes do plan; daí kept vazio em tools.ts:112.
  - task-tree/tests/cabecalho.test.ts:35-76 — os testes da visão resumida usam ids diferentes em cada pedido (A e B); nenhum reutiliza id entre pedidos, então o caso não é coberto.
  - task-tree/hooks/tools.ts:47-53 — o comentário registra que o pedido antigo ficar à vista só por ter o id reutilizado foi o defeito que a renomeação quis corrigir.
- **Regra do catálogo:** pedidos.resumida-mantem-anteriores-com-algo-aberto; sessoes.cartao-vivo-nunca-some; cabecalho.resumida-exclui-pedido-finalizado e cabecalho.resumida-limpa-so-com-tudo-concluido (citadas em tests/cabecalho.test.ts:35)
- **Cenário:** Caso A (o do relato): work=['64'], cartão vivo sob '64/64.1'. Pedido novo com plan '64'+'65': o antigo vira 'ab12:64' e não entra no work (`kept=[]`); `openInSight(['64'])` enxerga o '64' novo; work=['64','65']; o pedido antigo, que tinha um cartão vivo (algo aberto à vista), é cortado para '+1 pedidos anteriores' e o cartão aparece solto no fim, com a carta escondida no histórico. Pela regra do catálogo o pedido anterior deveria ficar à vista com o cartão sob a tarefa de origem. Caso B (inverso): pedido 1 com plan '1' e '2', tudo concluído, work=['1','2']. Pedido 2 com plan '1' (id reutilizado) e '3': o '1' antigo vira 'tag:1'; `joinWork` chama `openInSight(['1','2'])`, que acha o '2' antigo e o '1' novo (aberto) e responde verdadeiro; work=['1','2','3']; como `trimToWork` mantém o turno inteiro do '2', o pedido 1, todo concluído, continua desenhado, contra 'com tudo fechado, só o novo'.
- **Proposta:** Em `planTool`, antes do `joinWork`, traduzir o work pelos renomeados (`cur.map(id => renamed.includes(id) ? `${tag}:${id}` : id)`, gravado com `setWork`) e só então chamar `joinWork(ids, fresh0)`: `openInSight` passa a avaliar as tarefas antigas de verdade. Com cartão vivo ou ✉ na fila preso ao antigo, o pedido antigo fica inteiro à vista e o cartão segue sob a tarefa de origem (✕), em vez de solto; sem nada aberto, o pedido antigo sai, também no caso B. Não contradiz cenário: aplica pedidos.resumida-mantem-anteriores-com-algo-aberto ao caso de id reutilizado; o teste de pedidos.plano-anterior-vira-historico (sem cartão nem carta) continua esperando o histórico. Vale mesmo que a decisão do item de continuação seja manter a regra atual. Teste novo nos dois sentidos.
- **Ajuste da verificação à proposta:** A proposta está correta e não contradiz cenário: renameAnchors já roda antes do joinWork, então as âncoras das sessões e das cartas já estão renomeadas quando openInSight avalia o trabalho traduzido. Fazer a tradução também quando não é trabalho novo (equivale ao kept de hoje). O caso inverso é mais comum do que parece: basta o pedido anterior ter dois níveis 1 e o novo reutilizar só um dos ids; enquanto esse id seguir sendo reutilizado, o pedido antigo concluído não sai da visão.
- **Verificação:** Refiz os dois casos passo a passo: o trabalho guarda o id cru, que depois do plan passa a nomear a tarefa nova; openInSight vê a tarefa nova aberta e responde que há algo aberto. No primeiro caso o pedido antigo com cartão vivo é cortado e o cartão vai solto para o fim; no segundo, o pedido antigo todo concluído continua desenhado. Os dois contrariam a regra da resumida, e os testes não reutilizam ids.

### Filha parada com Esc: o descarte é decidido depois do halt, então as ✓ dela continuam contando e o cartão diz "concluída"
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1537-1538 — layout corta as sessões em cartões e passa por trimToWork antes de panel; settle, atWork e session só rodam depois, já sobre o painel que passou pelo halt.
  - task-tree/draw/layout.ts:1164 — o cartão de uma rodada (part definido) não mostra palavra; a palavra 'concluída' só sai no cartão sem corte. Nos dois casos o cartão fica com o ícone de concluído e as tarefas concluídas contam.
  - task-tree/draw/layout.ts:119 — o mesmo vale para a rodada anterior de uma sessão parada com Esc: discarded exige tarefa aberta no painel já interrompido.
- **Regra do catálogo:** sessoes.rodada-descartada-fora-da-contagem; sessoes.rodada-descartada-fora-da-contagem-do-pai; sessoes.palavra-de-estado-do-cartao (parar com tarefas abertas é 'parada')
- **Cenário:** A filha tem "Feita" ✓ e "Começada" iniciada (nenhuma pendente nunca iniciada). O usuário aperta Esc nela. Na mãe: o halt transforma "Começada" em ✕, o painel do cartão fica sem nada aberto, discarded() responde false. Resultado: "Feita" continua no cabeçalho e no x/y da tarefa de origem, "Começada" entra no chip de interrompidas, e o cartão mostra ✓ com a palavra "concluída". Se a mesma filha tiver uma pendente nunca iniciada, tudo sai da contagem e a palavra é "parada": o resultado depende de existir ou não uma ○. O tooltip "sessão inteira" (calculado sobre o painel cru) exclui a rodada, ficando menor que o número do cabeçalho.
- **Proposta:** Decidir descarte e "parada" sobre o painel cru, uma vez, antes do trimToWork: em layout(), logo depois do split, gravar no cartão marcas só de desenho (como já se faz com settled), por exemplo discardedRaw e parkedRaw, e fazer discarded(), alive(), atWork() e session() lerem essas marcas. Teste novo: filha com uma ✓ e uma iniciada, Esc, cabeçalho sem a ✓ e chip de interrompidas sem a ✕.
- **Ajuste da verificação à proposta:** A correção da contagem aplica a regra já decidida e não precisa de pergunta. Pela regra da palavra de estado, a filha parada com Esc com tarefa aberta é 'parada': a correção deve chegar a isso; trocar a palavra para 'interrompida' é que é decisão nova e fica como pergunta. Alternativa mais simples às marcas no cartão: trimToWork guardar no cartão se o painel cru tinha tarefa aberta, e discarded e parked lerem esse valor.
- **Pergunta ao usuário:** Qual a palavra do cartão de uma filha parada com Esc que não deixou nada pendente: "concluída" (hoje), "parada" ou "interrompida" (recomendado, como o cartão de subagente diz "interrompido")?
- **Decisão já registrada:** regras/sessoes.md, sessoes.rodada-descartada-fora-da-contagem (decisão do usuário, 2026-10-24: 'as tarefas dessa sessão foram descartadas'; reescrito em 2026-10-28 e 2026-10-30): a sessão parada com Esc com tarefa aberta sai da contagem, concluídas inclusive. O código viola a regra no caso sem pendente.
- **Verificação:** Reproduzi pela leitura: trimToWork troca o painel do cartão pelo painel já passado pelo halt; com o turno parado, a iniciada vira interrompida e, sem pendente, não sobra tarefa aberta, então discarded responde falso. A concluída conta no cabeçalho e no x/y, a interrompida entra no chip, e o cartão aparece concluído; com uma pendente tudo sai da contagem. O total do tooltip usa o painel cru e diverge. O teste do Esc só tem a tarefa iniciada e passa nos dois casos.

### O primeiro turno da filha (o texto do start_session) é marcado como 'pedido do usuário na filha': o cartão de abertura sai da tarefa de origem e ganha o rótulo errado
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - Arquivos publicados reais em ~/.claude/task-tree-waits (só leitura): seis filhas da orquestradora local_9a792eb9 (plan, banco, clarify, analise, impl e governanca -veiculo-eletrico), com openedAt gravado pela mãe, publicaram o turno 1 com own verdadeiro, de 9 a 33 s depois do openedAt. Em outras filhas (local_0c961c71, local_6193af47) o turno 1 saiu com msg: o primeiro prompt nem sempre chega do mesmo jeito.
  - task-tree/hooks/panel.ts:170-173 — turnos sem tarefa são descartados: o turno mais antigo publicado pode não ser o de abertura.
  - task-tree/draw/layout.ts:327-332 — inForce devolve o último nível 1 do pedido vigente: o cartão sai da tarefa de origem e pode ir para outro nível 1.
- **Regra do catálogo:** sessoes.cartao-sob-a-tarefa-de-origem; sessoes.turno-proprio-da-filha-no-pedido-vigente (turno próprio é só o que o usuário abriu digitando na filha)
- **Cenário:** Estado real: as filhas auditoria-mod e analise-arquitetura, abertas por start_session, publicaram o turno 1 com own: true (4 a 6 s depois do openedAt gravado pela mãe); a mãe guarda anchor '65/65.1' e '69/69.1'. layout() com esses arquivos desenha 'auditoria-mod · pedido do usuário na filha' e 'analise-arquitetura · pedido do usuário na filha' direto sob os níveis 1 '65' e '69', antes das subtarefas, e não sob 'Abrir a sessão em espera' / 'Abrir a sessão e conferir...'. Tirando o own do turno 1 na simulação, o cartão vai para a tarefa de origem com o nome simples. É a primeira metade dos 'dois cartões da auditoria-mod' do print.
- **Proposta:** Não tratar o turno de abertura como próprio. Opção mais segura, no lado da mãe (split): o turno mais antigo da filha, quando own, sem turno antes dele e iniciado depois de Child.openedAt, fica na parte 0 (âncora c.anchor, sem o rótulo). Opção na origem: decidir own pela origem do prompt que o kit informa (e.origin.kind, PromptOrigin em .claude-plugin/types/claude-code/index.d.ts 9635-9750: composer, bridge, sdk, peer, peer-send-message, coordinator, scheduled-trigger, plugin) em vez do texto; antes, registrar no log o kind que chega no texto de abertura e num prompt digitado. Teste com a filha publicando own no primeiro turno e cenário novo no catálogo.
- **Ajuste da verificação à proposta:** Na correção do lado da mãe, não usar 'o turno mais antigo publicado': o turno de abertura sem tarefa é descartado, e um turno digitado depois passaria por abertura. Usar o turno de id 1 (ou o que começa poucos segundos depois de Child.openedAt) e tratar openedAt ausente (ligações antigas). A correção na mãe é necessária de todo modo, porque os arquivos já publicados e as filhas em outra versão seguem trazendo own no turno 1. Para a correção na origem, registrar antes no log a origem do primeiro prompt, que nos arquivos reais aparece de dois jeitos.
- **Decisão já registrada:** regras/sessoes.md, sessoes.turno-proprio-da-filha-no-pedido-vigente (decisão do usuário, 2026-11-03: 'No pedido vigente da orquestradora (Recomendado)') vale para o turno que ele abriu digitando na filha; o texto do start_session não é isso. O código viola sessoes.cartao-sob-a-tarefa-de-origem.
- **Verificação:** Conferi o código e os arquivos publicados: todo prompt que abre turno e não traz a tag de outra sessão é marcado como próprio, e filhas reais abertas por start_session publicaram o turno 1 assim. No split, esse turno vira parte negativa: o cartão vai para o último nível 1 do pedido vigente da mãe, com 'pedido do usuário na filha' no título, em vez de ficar sob a tarefa de origem. Os testes fabricam o turno 1 sem own.

### O lembrete 'terminou o turno a sessão…' olha só a tarefa em que a filha foi aberta, pelo id cru: filha reaproveitada por mensagem a partir de outra tarefa, ou com a tarefa renomeada, não gera lembrete
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:234-238 — na mesma função, o aviso 'parou com a tarefa de origem já fechada' usa split + settle, que olham `c.lastAnchor ?? c.anchor` (draw/layout.ts:149): os dois avisos do mesmo evento usam origens diferentes.
  - task-tree/hooks/panel.ts:643-657 — renameAnchors já renomeia `anchor`, `lastAnchor` e `rounds` no state quando o plan renomeia a tarefa fechada: o id cru do state acompanha a renomeação; a tarefa renomeada é sempre fechada, então não haveria lembrete para ela de qualquer modo. A parte 'renomeada, nunca mais sai' do achado é o mesmo caso do `lastAnchor`, não um segundo defeito.
  - task-tree/hooks/tool-call.ts:128-133 — `lastAnchor` é gravado na hora do envio, mesmo com a mensagem ainda na fila.
- **Regra do catálogo:** Nenhum cenário cobre o lembrete 'terminou o turno a sessão…' (regras/lembretes.md não o traz; sessoes.filha-parada-com-origem-fechada-sai-da-contagem cobre só o aviso 'parou com N pendentes'). Não há teste que cite o texto.
- **Cenário:** A filha 'analise-plano' foi aberta sob a tarefa 3 (já concluída). Mais tarde a principal manda mensagem a ela a partir de 64.1 (em andamento). A filha termina o turno: `endedNote` procura uma tarefa aberta com id igual a `c.anchor` ('3'), não acha e não diz nada; a 64.1 fica aberta sem o lembrete de fechar. O painel, porém, trata 64.1 como a origem da rodada (cartão sob ela, 'encerrada' pela regra do `lastAnchor`). Depois de uma renomeação (pedido novo com id reutilizado) a âncora aponta para a cópia interrompida e o lembrete nunca mais sai para aquela filha.
- **Proposta:** Em `endedNote`, usar a tarefa da rodada atual: `c.lastAnchor ?? c.anchor`, resolvida como o desenho resolve (`resolveAnchor` pelo `at` da última rodada), e dizer o id e o título dessa tarefa. Correção direta, com teste: filha aberta em tarefa fechada, mensagem a partir de outra aberta, e o aviso do fim do turno traz o lembrete com a segunda.
- **Ajuste da verificação à proposta:** Não usar `lastAnchor` cru: ele muda no envio, antes de a filha tratar a mensagem; se a filha termina o turno da rodada anterior com a mensagem nova ainda na fila, o lembrete apontaria a tarefa errada e mandaria fechá-la cedo. Usar a tarefa da rodada do turno que terminou: a última rodada cuja mensagem já foi tratada (sem envio pendente para a filha), senão a de abertura. `resolveAnchor` só é preciso para ligações antigas. Criar o cenário em lembretes ou sessões e o teste junto.
- **Verificação:** Confirmei em sessions.ts:229 que o lembrete procura só `c.anchor` entre as tarefas abertas; com a filha reaproveitada por mensagem a partir de outra tarefa (uso comum na orquestração), a tarefa da rodada fica aberta sem lembrete, enquanto o desenho e o aviso de 'encerrada' já tratam a tarefa da última rodada como origem.

### Envio a sessão que não é filha (irmã, mãe) cria um cartão fantasma 'Sessão…'; envio que falha ainda grava rodada e pode criar o fantasma
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:197-215 e 50-55 — recordStart põe a filha recém-aberta em children, mas o refreshChildren seguinte pode tirá-la (host ainda sem listá-la) sem publicar nem salvar as ligações: nesse caso keptLink não tem o id.
  - task-tree/hooks/panel.ts:661-677 — saveLinks guarda em keptLinks toda entrada já listada e nunca tira: a ligação do fantasma fica no store.
  - task-tree/hooks/turn.ts:152 — o fim do turno republica o painel: o fantasma só fica preso no arquivo quando o turno da filha termina antes do poll de 3 s seguinte ao envio; senão dura até a próxima publicação dela.
- **Regra do catálogo:** sessoes.mensagem-entre-filhas-no-cartao-da-remetente (o cartão da destinatária não fica dentro do cartão da remetente); sem cenário para envio que falha
- **Cenário:** Uma filha manda o sinal à irmã pelo id `local_…` (fluxo comum de sessões em sequência). No painel da filha surge, sob a tarefa do envio, um cartão 'Sessão…' trabalhando, que some no poll seguinte (até 3 s). O arquivo publicado da filha leva o fantasma até a próxima publicação dela: no painel da mãe aparece um cartão 'Sessão…' dentro do cartão da remetente, contado como sessão trabalhando no cabeçalho; se o turno da filha terminar antes do poll, ele fica até o turno seguinte dela. A ligação do fantasma vai ao store e não sai. Variante: SendMessage que falha para uma filha existente grava a rodada e o `lastAnchor`; o próximo turno dela (aberto por outra pessoa ou irmã) vira um cartão sob a tarefa do envio que falhou.
- **Proposta:** Calcular `failed` antes e não tocar em `children` quando o envio falha. Criar a entrada provisória só quando o destino pode ser filha: por exemplo, quando o id foi visto num recordStart recente ou num `keptLink`; para os demais ids (mãe, irmã), gravar só o envio. Ao limpar `children` no poll, republicar também quando a lista anterior não era vazia.
- **Ajuste da verificação à proposta:** O critério 'id visto num recordStart recente ou num keptLink' pode falhar justamente no caso que a entrada provisória protege: a filha recém-aberta que o poll tirou de children antes de qualquer publicação não está em keptLinks. Critério mais firme: guardar os ids que esta sessão abriu (recordStart) num conjunto próprio, ou negar a entrada quando a lista do host mostra o destino com startedBy de outra sessão (irmã) ou quando ele é quem abriu esta (mãe). Manter o resto: calcular failed antes de tocar em children e republicar quando o poll esvazia a lista.
- **Verificação:** Conferi tool-call.ts:126-137: todo destino com id de sessão que não está em children ganha uma entrada trabalhando, antes de se saber se o envio falhou, e o painel é publicado com ela. O poll a tira do state, mas uma sessão sem filhas não republica; na mãe, ela aparece como cartão dentro do cartão da remetente e conta como sessão ativa. O envio que falha a uma filha existente também grava a rodada e o lastAnchor.

### Âncora que sai do plano num replanejamento: três tratamentos diferentes para carta, subagente e cartão de sessão
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:106-109 — depois do replano, o plan só trata os envios: os entregues de tarefa que saiu são apagados e os da fila ficam (a carta sobe ao nível 1); nada é feito com `children` nem com os grupos de subagente.
  - task-tree/draw/layout.ts:718-722 — `loosen` não acha a tarefa da âncora removida: o cartão solto sai sem '· do pedido …'.
  - task-tree/draw/layout.ts:482-485 — `atWork` só soma sessões cuja âncora está na subárvore: com a subtarefa removida, as tarefas da filha saem do x/y de A.
- **Regra do catálogo:** pedidos.replano-mantem-envio-ate-entrega (só a carta tem regra para a tarefa que sai do plano); cabecalho.limite-de-cartoes-antigos (cartão sem tarefa de origem); sessoes.cartao-sob-a-tarefa-de-origem; nenhum cenário de subagentes trata o replano
- **Cenário:** A mãe planeja A com 1 e 2, inicia 1 e abre a filha (âncora A/1). Depois replaneja A com subtarefas de ids novos (x, y), como as regras do mod mandam para refazer trabalho. A carta enviada de A/1 continua sob A; o subagente lançado de A/1 vai para o fim do grupo; o cartão da filha sai de baixo de A: se ela ainda trabalha aparece solto no fim, sem título de pedido; se já concluiu, some, e as tarefas dela deixam de somar no x/y de A e do pedido.
- **Proposta:** Dar ao cartão de sessão (e ao subagente) o mesmo destino da carta: âncora que não existe mais no plano resolve para a tarefa de nível 1 que a continha (o prefixo do id, "A/1" para "A") e, sem ela, para a última tarefa de nível 1 do pedido em que a sessão foi aberta. Cenário novo em sessões e teste de replanejamento com filha sob subtarefa removida.
- **Ajuste da verificação à proposta:** A proposta não contraria decisão registrada, mas cria regra nova para cartão de sessão e de subagente: registrar como cenário e confirmar com o usuário antes (ele decidiu só o destino da carta). O prefixo do id serve para achar o nível 1 ('A/1' → 'A', e 'tag:A/1' → 'tag:A' depois de renomeado). Tratar junto o subagente terminado, que hoje sai do recorte (layout.ts:752).
- **Verificação:** Confirmei os três tratamentos: carta sobe ao nível 1 do pedido (layout.ts:1256-1262), subagente vai ao fim do grupo e some do recorte ao terminar (752, 1384-1385), cartão de sessão vira solto e só é desenhado enquanto vivo (1288, 1525-1527). O replano com ids novos é o que as próprias regras do mod recomendam, então o cenário é plausível.

### Filha recém-aberta perde a tarefa de origem se a primeira leitura do host ainda não a lista
- **Categoria:** omissão · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/sessions.ts:51-54 — com a lista vazia (primeira filha ainda não listada) o state é zerado, e a entrada `starting` vai junto.
  - task-tree/hooks/sessions.ts:79 e panel.ts:661-677 — a publicação (e o saveLinks) do próprio refresh vem depois do `set`: a entrada já saiu do state e nunca chega a `keptLinks`.
  - task-tree/hooks/tool-call.ts:226-231 — antes do recordStart roda refreshStale; se a lista já traz a sessão, ela entra sem âncora e recordStart completa a âncora (sessions.ts:211): esse caminho está certo. A perda exige a sessão fora da lista na leitura feita depois do recordStart, ou um poll em curso com a lista lida antes.
  - task-tree/io/host.ts:133-134 — o comentário diz que logo depois do start_session o host 'may still list it idle' (listada, mas parada): o caso 'não listada' não é o que o código prevê.
- **Regra do catálogo:** sessoes.cartao-sob-a-tarefa-de-origem; durabilidade.ligacoes-com-lista-parcial-do-host (só cobre a filha já listada antes)
- **Cenário:** O modelo abre uma sessão com start_session a partir de uma tarefa. A lista lida logo depois ainda não traz a sessão (ou um poll que leu a lista antes da abertura grava depois do recordStart). A entrada sai do state antes de qualquer saveLinks. Quando o host passa a listá-la, não há âncora: o cartão vai para o fim da lista, e a tarefa não conta como usada para a sessão ou carta seguinte.
- **Proposta:** Em recordStart, gravar a ligação (saveLinks, ou pôr em `keptLinks`) antes do refresh. Em deriveChildren, manter por um prazo curto a entrada `starting` que a lista ainda não traz. Teste com a filha `listada: false` no momento da abertura.
- **Ajuste da verificação à proposta:** As duas partes são necessárias e se completam com a correção da gravação sem versão: pôr a ligação em `keptLinks` (ou chamar saveLinks) no recordStart antes do refresh, e manter em deriveChildren a entrada `starting` que a lista ainda não traz, por prazo curto. Teste com a filha `listada: false` na abertura, como proposto.
- **Verificação:** Pela leitura, uma entrada `starting` que a lista não traz é descartada antes de qualquer saveLinks, e a âncora se perde (cartão no fim da lista e, concluído, fora do desenho). Se o app lista a sessão já no retorno do start_session o código não mostra; a corrida com um poll em curso é possível, mas estreita.

### Cartão sem âncora some do painel quando a filha conclui, e sem a linha "+N pedidos anteriores" não há como vê-lo
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1522-1524 — o comentário diz que, no recorte, o cartão sem tarefa também é histórico ('at work it ends the list, the rest only with the line open'): esconder é intencional; o que falta é o caso sem linha para abrir.
  - task-tree/draw/layout.ts:1513-1514, 1519-1520 — o critério 'recente fica' (`busy`) só vale com o histórico aberto.
  - task-tree/tests/cabecalho.test.ts:173-192 — o teste cobre só o cartão de antes dos três últimos pedidos, com pedidos cortados; não há teste do cartão recente nem do painel sem a linha.
  - task-tree/hooks/sessions.ts:198-199 — um cartão `own_initiative` não tem id `local_…` no resultado do start_session: nasce sem âncora, e o documento (DESENVOLVIMENTO.md:1139-1140) diz que ele 'vai para o fim da lista'.
  - task-tree/hooks/panel.ts:261 — sendAnchor só devolve undefined com o painel sem nenhuma tarefa.
- **Regra do catálogo:** cabecalho.limite-de-cartoes-antigos; sessoes.cartao-vivo-nunca-some
- **Cenário:** Primeiro pedido da sessão; o modelo chama start_session antes do plan (painel vazio), ou a âncora se perde por outro caminho (lista do host atrasada, subtarefa replanejada, cartão clicado). Enquanto a filha trabalha, o cartão aparece solto no fim. Quando ela conclui tudo, o cartão desaparece no mesmo instante, com as ✓ dela saindo do cabeçalho (ficam só no tooltip "sessão inteira"). Como nenhum pedido foi cortado, não existe a linha "+N pedidos anteriores" para abrir: o cartão fica inacessível.
- **Proposta:** No desenho padrão, aplicar ao cartão sem âncora o mesmo critério que já existe com o histórico aberto (`busy`: começou depois do pedido mais antigo ainda desenhado, ou vivo): o recente fica desenhado no fim; os antigos viram a linha "+N cartões antigos de sessões", mostrada sempre que houver algum escondido (clicável como a de pedidos). Atualizar o texto do DESENVOLVIMENTO e o cenário.
- **Ajuste da verificação à proposta:** Desenhar o cartão concluído recente no fim muda o que a decisão de 2026-11-04 fixou para os cartões sem origem: precisa da resposta do usuário (a pergunta do achado serve). O que pode ir sem pergunta é corrigir o texto do DESENVOLVIMENTO (1139-1140) para o que o código faz. Parte da causa some com as correções que evitam perder a âncora (filha recém-aberta fora da lista, subtarefa replanejada).
- **Pergunta ao usuário:** Cartão de filha sem tarefa de origem que já concluiu: fica desenhado no fim enquanto for recente (recomendado) ou segue escondido, mas com uma linha "+N cartões antigos" sempre visível para abrir?
- **Decisão já registrada:** regras/cabecalho.md, cabecalho.limite-de-cartoes-antigos: 'Reescrito: 2026-11-04, decisão do usuário ("…deixe somente a visão resumida"; "Ficam em '+N pedidos anteriores' (Recomendado)")'. A decisão cobre cartões parados sem origem 'de pedidos antigos'; não cobre o cartão recente nem o painel sem a linha.
- **Verificação:** Confirmei que, no nível 0, `main.whole` existe sempre, então com o histórico fechado ou inexistente só os cartões soltos vivos são desenhados e a linha '+N cartões antigos' não aparece: o cartão sem âncora some ao concluir e fica inacessível enquanto nenhum pedido for cortado. O cenário do catálogo fala de pedidos antigos e o documento diz 'fim da lista'; o código esconde qualquer um.

### Regras de cartão valem só para as filhas diretas: "encerrada", cartão vivo solto e carta na fila no Esc não se aplicam dentro do cartão de uma filha
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:753-756 — trimToWork corta também o painel de cada filha: dentro do cartão `main.whole` existe, `cutHistory` é verdadeiro e `ends` é `[]` (1527): neta sem tarefa à vista não é desenhada, viva ou não.
  - task-tree/hooks/panel.ts:331-334 — o status do app (`total` sem splitter) também não distingue rodada abandonada nem cartão encerrado, em nenhum nível.
  - task-tree/draw/layout.ts:117-121 e 131-136 — no caso do Esc com carta na fila, o painel da própria filha mostra a tarefa ◷ e contando; no cartão dela na mãe a tarefa vira ✕ (halt com lista vazia) e a rodada inteira sai da contagem (`discarded`).
- **Regra do catálogo:** sessoes.filha-parada-com-origem-fechada-sai-da-contagem; sessoes.cartao-vivo-nunca-some; envios.fila-nao-interrompe-no-fim-do-turno; sessoes.rodada-descartada-fora-da-contagem
- **Cenário:** Orquestradora → filha A → neta B. (1) B para só com pendentes e a tarefa de origem em A está fechada: no painel de A, B aparece "encerrada" e fora da contagem; no painel da orquestradora (cartão de A com B dentro) as pendentes de B continuam contando no x/y de A e no cabeçalho. (2) B trabalha sob um pedido de A que saiu do trabalho de A: em A o cartão é desenhado solto no fim; na orquestradora ele não aparece, mas as tarefas dele contam no x/y do cartão de A. (3) A manda mensagem a uma irmã, fica na fila, e o usuário dá Esc em A: no painel de A a tarefa fica ◷; no cartão de A na orquestradora fica ✕ com a carta azul embaixo, e a rodada inteira sai da contagem.
- **Proposta:** Aplicar `settle` em todos os níveis usando `p.sends` do painel dono; em `panelOf`, passar ao `halt` as âncoras de `p.sends` ainda na fila; estender `strays`/`loosen` aos níveis internos (soltos no fim do cartão da mãe deles). Cobrir com um teste de neta em `sessoes.test.ts`.
- **Ajuste da verificação à proposta:** As partes de `settle` em todos os níveis e de `strays`/soltos dentro do cartão seguem decisões já registradas e podem ir direto, com teste de neta; incluir o `total()` do cartão (linha 1165) e o do status, que precisam do mesmo corte. Passar as cartas na fila ao `halt` de panelOf segue a decisão de 2026-10-30 para o ícone; se a rodada da filha parada com Esc deve ou não sair da contagem quando a única tarefa aberta espera uma carta é choque entre duas decisões: vira pergunta.
- **Verificação:** Confirmei as três assimetrias: `settle` só no nível 0 com um comentário que não vale mais (`p.sends` é publicado e usado na linha 1225), cartões soltos e vivos de pedido cortado só no nível 0, e `halt(last, [], aborted)` sem as cartas na fila da filha. Exigem neta ou Esc com carta na fila, o que é borda plausível.

### Arquivo da filha ilegível numa leitura zera `waiting`, `aborted` e `ultracode`, mas mantém painel, contexto, modelo, taxa e git: o cartão pisca e sai lembrete falso de fim de turno
- **Categoria:** assimetria · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/io/host.ts:140 — `stopped` exige `r.isRunning !== true`: a filha que o host lista rodando nunca entra em `ended` por causa de uma leitura ruim; o lembrete indevido só sai com a filha já parada no host (fim de turno com wrap_up/ask, ou filha parada esperando escolha).
  - task-tree/io/publish.ts:148-149 — o arquivo só é regravado quando o conteúdo muda: filha parada e sem netas ativas não regrava; a janela de leitura no meio da gravação existe enquanto ela trabalha, no fim do turno, ou quando ela tem netas mudando.
  - task-tree/io/publish.ts:87-97 — a leitura inválida é registrada no log de depuração ('arquivo publicado de <id> ignorado: JSON inválido'), uma vez por sessão e motivo, e o registro volta a valer depois de uma leitura boa: dá para confirmar o caso real pelo log.
  - task-tree/io/host.ts:135 — o comentário só promete que 'a session whose file went missing keeps its last panel'; nada diz sobre waiting, aborted e ultracode.
- **Regra do catálogo:** ultracode.cartao-da-filha ('quando ela publica sem o interruptor, a palavra some': arquivo ilegível não é 'publicar sem'); sessoes.palavra-de-estado-do-cartao (a palavra 'aguardando' cai por um poll)
- **Cenário:** Uma filha está parada com uma pergunta aberta (cartão "aguardando"). A mãe lê o arquivo dela a cada 3 s; numa leitura o arquivo está sendo regravado (centenas de KB) e vem truncado ou falha. Naquele poll a filha vira "parada", entra em `ended`, e a principal recebe o lembrete de que a sessão terminou o turno (ler o relato, fechar a tarefa), sem ter terminado. No poll seguinte o cartão volta a "aguardando". O mesmo apaga por 3 s o "ultracode" e a marca de turno parado.
- **Proposta:** Tratar "arquivo que não deu para ler agora" diferente de "sem arquivo": readFiles devolve a lista dos ids ilegíveis e deriveChildren mantém para eles waiting, aborted e ultracode anteriores, sem contar em `ended`. Na escrita, gravar num arquivo temporário e trocar, se o kit tiver como; senão, a tolerância na leitura basta. Cenário novo no catálogo.
- **Ajuste da verificação à proposta:** A tolerância na leitura basta e é a parte segura: readFiles deve distinguir 'não deu para ler agora' (erro de leitura ou JSON inválido) de 'sem arquivo/versão diferente' e, no primeiro caso, deriveChildren mantém waiting, aborted e ultracode anteriores e não conta em `ended`. Antes de implementar, confirmar no log de depuração se a leitura truncada acontece de fato (o kit não documenta `$.fs.write` como atômico).
- **Verificação:** A assimetria existe no código: sem arquivo legível, waiting/aborted/ultracode vêm só da leitura atual (host.ts:154-159) e painel, contexto, modelo, taxa e git caem no valor anterior (156-166). Se a leitura pega o arquivo no meio da gravação depende do `$.fs.write` do kit, que o código não mostra; o efeito seria a palavra 'ultracode' ou 'aguardando' piscar por 3 s e, com a filha já parada no host, um lembrete de fim de turno adiantado.

### refreshChildren grava `children` sem conferir a versão e pode rodar sobreposto
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:70-73 — entre o `get` e o `set` não há nenhum `await`: a janela de perda entre os dois é de uma ida ao host. A janela grande é outra: `mine` e `read` vêm de listSessions (linha 37) e readFiles (65), lidos bem antes do `set` (73); uma entrada criada nesse meio (recordStart, sentMessage) não está em `mine` e é descartada pelo `mine.map` de deriveChildren (io/host.ts:144).
  - task-tree/draw/layout.ts:186-208 — `unsent` recria a rodada perdida a partir do `received` publicado pela filha, com a tarefa aberta na hora: o caso (a) é em parte recuperado no desenho; o `lastAnchor` perdido não é.
  - task-tree/hooks/sessions.ts:255 — `$.clock.every(POLL, () => refreshChildren($)…)` não espera a execução anterior; refreshStale (190-194), recordStart (214) e prompt-submit.ts:68 chamam a mesma função sem marca de execução em curso.
- **Regra do catálogo:** (nenhuma; o efeito mais visível é o do cartão sem tarefa de origem: sessoes.cartao-sob-a-tarefa-de-origem)
- **Cenário:** (a) O poll lê `children`; antes do set dele chegar, um SendMessage grava a rodada e o `lastAnchor`; o set do poll passa por cima: o cartão dessa mensagem fica sem origem e cai na regra de mensagem sem rodada. (b) Um poll lento (lista do app, dezenas de arquivos) ainda roda quando o seguinte, o do start_session ou o do aviso termina; o mais velho grava por último: a filha volta a aparecer rodando, e o poll seguinte gera um segundo lembrete "terminou o turno" para o mesmo fim.
- **Proposta:** Uma execução por vez em refreshChildren (marca de módulo e "rodar de novo ao terminar"), e gravar com `update(childrenState, cur => deriveChildren(mine, cur, …).children)`, calculando `ended` no mesmo fecho.
- **Ajuste da verificação à proposta:** Gravar com `update(childrenState, cur => deriveChildren(mine, cur, …).children)` resolve só a perda de campos de `cur`; não resolve a entrada nova que a lista lida antes não trazia. Juntar: (1) uma execução por vez, com 'rodar de novo ao terminar'; (2) em deriveChildren, manter a entrada `starting` que `mine` ainda não traz (mesma correção do achado da filha recém-aberta). Calcular `ended` dentro do mesmo fecho, como proposto.
- **Verificação:** Confirmei que refreshChildren grava `children` sem `ifVersion` e pode rodar sobreposto, enquanto os outros escritores usam `update`. A perda entre o get e o set é estreita (sem await entre eles) e a rodada perdida é em parte refeita por `unsent`; o caso que pesa é a lista velha derrubando uma filha recém-registrada e o lembrete de fim de turno repetido quando uma execução mais antiga grava por último.

### Filhas arquivadas e antigas nunca saem: painel inteiro guardado no state, arquivo relido a cada 3 s, tudo republicado aninhado sem teto de profundidade; a lista do host é pedida com limite 100
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/io/host.ts:113-126 — para arquivo sem modelo, engineOf chama get_session uma vez por minuto por sessão, arquivadas inclusive.
  - task-tree/hooks/sessions.ts:66-73 — o comentário do código já mede o custo: 220 KB do valor de `children` atravessando ao host no caso real.
  - task-tree/io/publish.ts:131-149 — a serialização para comparar roda a cada poll com filhas (sessions.ts:79), mesmo sem gravar.
  - task-tree/draw/layout.ts:1191 e 441-443 — o desenho e a contagem param em DEEP = 3; quem publica precisa manter DEEP níveis abaixo de si, não menos (a mãe de quem publica ainda desce).
- **Regra do catálogo:** sessoes.filha-arquivada-interrompe (a arquivada fica como histórico, com as tarefas)
- **Cenário:** Uma orquestradora que dura dias e abriu 50 filhas (quase todas arquivadas): a cada 3 s lê e analisa 50 arquivos (cada um com o histórico inteiro da filha), serializa megabytes para comparar e mantém tudo no state; o arquivo dela leva todos esses painéis, e quem a abriu relê isso. O custo cresce com o número de sessões já abertas, sem poda, no mesmo worker que atende os hooks de ferramenta. Passando de 100 sessões ligadas, as que o host deixar de fora somem do painel, mesmo vivas, e um envio endereçado por nome a uma delas nunca é confirmado. O efeito medido hoje é pequeno (4 filhas, 274 KB); o crescimento é que não tem teto.
- **Proposta:** Não reler o arquivo de sessão arquivada (ele não muda): guardar por id e ler uma vez. Para arquivadas antigas, guardar só a contagem e o título em vez do painel inteiro. Ao publicar, cortar children além de DEEP. Paginar a lista do host ou registrar no log quando vierem 100 linhas. Definir no catálogo o que acontece com o cartão de uma filha arquivada antiga.
- **Ajuste da verificação à proposta:** Separar o que não muda comportamento (pode ir direto): não reler o arquivo de sessão arquivada enquanto ela seguir arquivada (invalidar se o host a listar desarquivada), cortar `children` além de DEEP ao publicar, registrar no log quando vierem 100 linhas. Trocar o painel da arquivada antiga por uma linha com nome e contagem contraria 'Arquivada fica, como histórico': tem de virar pergunta ao usuário (a pergunta do achado já cobre).
- **Pergunta ao usuário:** Filha arquivada há muito tempo precisa continuar com todas as tarefas no painel da mãe, ou basta uma linha com nome e contagem? Recomendo a linha resumida depois que o pedido dela sai do trabalho atual.
- **Decisão já registrada:** regras/sessoes.md, sessoes.filha-arquivada-interrompe: origem 'regra do painel desde a entrada do mod ("Arquivada fica, como histórico", DESENVOLVIMENTO)'; task-tree/DESENVOLVIMENTO.md:1141 e 738-741 ('o desenho segue a lista do host').
- **Verificação:** Confirmei que cada poll lê e analisa o arquivo de toda filha listada, arquivada ou não, guarda o painel inteiro no state, serializa tudo duas vezes para comparar e mais uma para publicar, e publica as netas sem corte de profundidade. O efeito medido é pequeno hoje, mas o custo cresce com cada filha aberta, e o uso do dono é justamente orquestradora longa com muitas filhas.

### Cartão de rodada descartada é desenhado como 'trabalhando' ou 'parada' e conta como sessão no cabeçalho: a mesma filha aparece em dois cartões sem dizer qual vale
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:117-119 com 418 — todo cartão que não é o da frente e tem tarefa aberta é, por definição, rodada descartada; logo `running: c.running && (at || hasOpen(tasks))` marca como trabalhando exatamente as rodadas descartadas, enquanto a sessão roda.
  - task-tree/DESENVOLVIMENTO.md:1157-1158 — 'Com a filha rodando, todo cartão com tarefas abertas é desenhado em andamento': a regra de desenho é anterior à da rodada descartada e nunca foi revista com ela.
  - task-tree/draw/layout.ts:380-381 — a rodada da frente é a última com tarefa iniciada; entre o plan e o primeiro start de uma rodada nova, a rodada antiga com tarefa iniciada segue na frente e a nova é que sai da contagem por um instante.
- **Regra do catálogo:** sessoes.um-cartao-por-mensagem; sessoes.rodada-descartada-fora-da-contagem; sessoes.palavra-de-estado-do-cartao
- **Cenário:** A orquestradora manda duas mensagens à mesma filha a partir de tarefas diferentes; a filha deixa uma tarefa aberta da primeira rodada e passa à segunda. O painel mostra dois cartões com o mesmo nome: o da primeira rodada (descartada) aparece como 'parada', ou como trabalhando enquanto a filha roda, com as tarefas abertas dele, e o da segunda com o turno atual. O cabeçalho pode contar duas sessões trabalhando para uma só. É o que o relato descreve para 'auditoria-mod' (um cartão 'parada' com '+1 pedidos anteriores' e outro com o turno de teste); sem o arquivo de estado não dá para afirmar que era exatamente este caso.
- **Proposta:** Dar ao cartão de rodada descartada um estado próprio e não contá-lo como sessão viva: em session(), testar discarded(c) antes de live/parked (palavra sugerida 'substituída', tom cinza, live falso) e não marcar running em split para rodada não líder. Registrar no catálogo.
- **Ajuste da verificação à proposta:** Palavra nova no cartão e tirá-lo do chip de sessões mexem na lista de palavras decidida: a pergunta do achado é necessária. Sem pergunta dá para corrigir só a contagem dupla no chip (uma sessão, um cartão vivo), que não tem regra a favor.
- **Pergunta ao usuário:** O cartão de uma rodada anterior que a filha largou com tarefa aberta ao receber a mensagem seguinte deve (a) aparecer com uma palavra própria, por exemplo 'substituída', cinza e fora do chip de sessões (recomendado); (b) sumir para dentro de '+N pedidos anteriores'; ou (c) ficar como hoje ('parada' ou trabalhando)?
- **Verificação:** Confirmei que `session()` não testa `discarded`: a rodada descartada sai sem palavra e com `live` enquanto a sessão roda, ou 'parada' quando ela para, e o chip de sessões do cabeçalho conta as linhas com `live` (render.tsx:276, 289), podendo mostrar duas sessões para uma. O comentário do split ('the new group waits its turn') lê o mesmo estado ao contrário do `discarded`.

### O que o arquivo publicado diz não tem validade: filha morta com espera aberta fica "aguardando", e neta fica "trabalhando" dentro de sessão intermediária arquivada ou morta
- **Categoria:** omissão · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/register.tsx:17-35 — o mod não registra `session.end`; o kit oferece o evento (task-tree/.claude-plugin/types/claude-code/index.d.ts:4706-4708).
  - task-tree/draw/layout.ts:495-515 — a neta 'viva' publicada também mantém em andamento a tarefa da sessão intermediária dentro do cartão (busy) e o relógio do cabeçalho (render.tsx:277).
  - task-tree/hooks/session-start.ts:55-67 — um processo novo da filha republica no session.start, com `waits` vazio: o estado velho só fica enquanto a filha não ganha processo novo.
- **Regra do catálogo:** sessoes.palavra-de-estado-do-cartao; sessoes.filha-arquivada-interrompe (não diz o que acontece com as netas publicadas dentro da arquivada)
- **Cenário:** (1) Filha com pedido de permissão ou pergunta aberta; o app é fechado e a filha não é reaberta. O host a lista parada, mas o arquivo diz waiting: true: o cartão na mãe fica âmbar "aguardando", a tarefa de origem "em andamento" e o relógio de 1 s ligado, até a filha ganhar um processo novo e publicar. (2) Mãe abre a filha M, que abre a neta N; M é arquivada (ou o processo dela morre) com N trabalhando; N termina depois. O arquivo de M nunca mais muda, e a mãe desenha N "trabalhando" dentro do cartão arquivado de M, com chip de sessão ativa, indefinidamente. Depende de o app encerrar o processo sem o mod publicar de novo.
- **Proposta:** Em deriveChildren: ignorar waiting quando o host diz isRunning false e as esperas publicadas são só de pergunta, plano ou permissão (que exigem turno em curso); só a espera 'choice' do wrap_up sobrevive ao fim do turno. Em panelOf de filha arquivada ou não viva: tratar as netas publicadas como paradas (running e waiting falsos) quando a sessão intermediária não está viva. Registrar session.end para publicar o estado final (sem esperas) ao sair. Cenários novos em regras/sessoes.md.
- **Ajuste da verificação à proposta:** A primeira parte depende de um fato do app que o código não mostra: se o host lista `isRunning` verdadeiro enquanto uma pergunta ou permissão está aberta. Se listar falso, 'ignorar waiting com isRunning falso' apagaria o 'aguardando' de uma espera real; verificar no app antes. As outras duas partes são seguras: tratar as netas como paradas quando a sessão intermediária está arquivada ou não viva, e registrar `session.end` para publicar sem esperas ao sair.
- **Verificação:** Confirmei que `waiting` vem só do arquivo (host.ts:83, 154), que ninguém lê a hora do arquivo, e que panelOf da arquivada deixa `children` como publicados, com `running` das netas valendo no desenho e no chip. Se o processo de uma filha morre sem publicar de novo (app fechado, arquivamento) é comportamento do app; por isso fica como suspeita.

### Tarefa da mãe com `done` e filha ainda trabalhando: o documento cita uma decisão ("vale como concluído") oposta à do catálogo e do código (segue ◉)
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1238-1243 — segundo trecho com a regra antiga: o d/n soma as sessões 'só enquanto a tarefa não está concluída com `done`' e 'uma tarefa concluída com `done` fica concluída'.
  - task-tree/draw/layout.ts:503-510 e 515 — o código soma d/n de todas as sessões abaixo (`kept = below.filter(!discarded)`), concluída ou não, e `busy` é `hereOpen.some(live)`; só o tempo (`tasks`, linha 511) ainda filtra por tarefa não concluída.
  - Os commits d956e11 e a818dae citados não existem mais no repositório (histórico reescrito): a origem 'commit d956e11' do cenário não é mais verificável.
- **Regra do catálogo:** sessoes.filha-trabalhando-mantem-pais-em-andamento
- **Cenário:** A orquestradora envia a mensagem, dá `done` na tarefa do envio e a filha continua trabalhando. O painel mostra a tarefa, os pais e o pedido ◉ com o relógio correndo e o x/y somando as tarefas da filha. Quem lê o documento espera ✓ com a contagem própria e pode "corrigir" o `atWork` de volta, quebrando o cenário coberto.
- **Proposta:** Reescrever o bullet do documento com a regra do catálogo. No cenário do catálogo, registrar a origem em palavras do usuário e a linha `Reescrito:` dizendo que desfaz "um done explícito da mãe deve valer como concluído", como o formato do `regras/README.md` pede.
- **Ajuste da verificação à proposta:** Corrigir os dois trechos do documento (343-358 e 1238-1243) pode ir direto: código, teste e catálogo já concordam. A pergunta ao usuário pode se reduzir a confirmar a data da frase nova para a origem do cenário, que hoje só cita um commit que não existe mais; a linha `Reescrito:` deve dizer que desfaz 'um done explícito da mãe deve valer como concluído'.
- **Pergunta ao usuário:** As duas frases são suas e se contradizem. Vale hoje "as linhas pai só ficam concluídas quando as filhas concluírem" (o que o código, o teste e o catálogo fazem), desfazendo "um done explícito da mãe vale como concluído"? Recomendo confirmar a primeira e registrar a data no catálogo.
- **Decisão já registrada:** task-tree/draw/layout.ts:454-459 e 495-499 citam a regra nova nas palavras do usuário ('as linhas pai anteriores somente deveriam ficar como concluídas, quando as filhas fossem concluídas', 'the person's rule'); regras/sessoes.md:64-72 (coberto) e task-tree/tests/sessoes.test.ts:47-61 seguem essa regra. O documento guarda a decisão anterior.
- **Verificação:** Confirmei a contradição: o documento descreve `atWork` deixando a tarefa concluída ✓ com contagem própria, e o código, o cenário coberto e o teste mantêm a tarefa e os pais em andamento enquanto a filha trabalha. O texto antigo aparece em dois lugares do documento e induz a 'corrigir' o código para trás.

### Turno digitado pelo usuário na filha é sempre tratado como a rodada mais antiga: cartão da frente errado e rodada mais nova descartada
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:380-381 — o mesmo vale em todo intervalo entre um done e o start seguinte do turno próprio: sem tarefa iniciada aberta, a frente cai para a parte de maior chave (a rodada antiga) e o cartão próprio vira rodada descartada até o próximo start; não só no fim do turno com pendentes.
  - task-tree/draw/layout.ts:415 e 479 — fora da frente o cartão próprio perde o `lastAnchor`: `roundAt` fica vazio e o pedido onde ele está deixa de ser mantido em andamento e desenhado.
  - task-tree/draw/layout.ts:716 — `alive` exclui a rodada descartada: o cartão próprio também deixa de ser mantido solto no fim.
  - task-tree/tests/sessoes.test.ts:322-327 — o único roteiro de turno próprio põe a tarefa dele como 'iniciada'.
- **Regra do catálogo:** sessoes.turno-proprio-da-filha-no-pedido-vigente ('enquanto a filha trabalha nele, o pedido onde ele está segue desenhado'); sessoes.rodada-descartada-fora-da-contagem ('a rodada descartada é a anterior, não a que está trabalhando', reescrito em 2026-10-28); sessoes.filha-parada-pendentes-seguem-pendentes
- **Cenário:** A mãe manda uma mensagem à filha (rodada 1, tudo ✓). Depois o usuário digita direto na filha; ela planeja g1 e g2, conclui g1, deixa g2 pendente (nunca iniciada) e termina o turno. Partes: [-1, 1]; nenhuma tem tarefa iniciada, então lead = 1 (a rodada antiga). O cartão "pedido do usuário na filha", que é o trabalho mais recente, vira rodada descartada: g1 ✓ e g2 ○ saem do cabeçalho e do chip de pendentes, o cartão não conta como vivo (não é mantido solto no fim se o pedido sair de vista) e não segura a visão. Variante: se a rodada antiga ficou com uma tarefa iniciada e a filha trabalha no turno próprio com tarefa iniciada, busy escolhe a rodada antiga, e o pedido onde o cartão próprio está deixa de ser mantido em andamento.
- **Proposta:** Escolher a parte da frente pelo tempo, não pela chave: ordenar as partes pelo instante em que começaram (rounds[k-1].at para k>0, ownTurns[i].at para k<0, begins para 0) e usar essa ordem em busy e em lead; a regra de descarte ("rodada anterior") passa a valer só para partes anteriores no tempo. Teste: mensagem da mãe, depois turno próprio com uma ✓ e uma pendente, filha parada: as duas contam e o cartão próprio diz "parada".
- **Ajuste da verificação à proposta:** Manter: ordenar as partes pelo instante em que começaram e usar essa ordem em `busy` e `lead`. Manter as chaves como estão (negativas para turno próprio), porque `partAt`, a chave de dobra e `holder`/`partOfTask` dependem delas; mudar só a ordem de comparação. Somar ao teste o caso do intervalo entre done e start com a filha ainda rodando.
- **Decisão já registrada:** regras/sessoes.md: sessoes.rodada-descartada-fora-da-contagem, 'Reescrito: 2026-10-28 … a rodada descartada é a anterior, não a que está trabalhando'; sessoes.turno-proprio-da-filha-no-pedido-vigente, decisão de 2026-11-03. O código contraria as duas neste caso; a proposta as cumpre.
- **Verificação:** Confirmei que o turno próprio recebe chave negativa e que `busy`/`lead` leem a ordem numérica como ordem de tempo: sem tarefa iniciada, a frente é sempre a rodada da mãe, e o cartão do turno próprio, que é o trabalho mais novo, sai da contagem como rodada abandonada. Isso contraria a regra registrada de que a descartada é a rodada anterior.

### Todo wrap_up com ask vira espera "Aguardando sua escolha", mesmo quando falha, quando o app não mostra a pergunta ou quando ela não bloqueia
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tool-call.ts:215-221 — wrapUpAsk roda antes do next(e); o finally só tira a espera de chave '<agente>:<ferramenta>', nunca a '<agente>:wrap_up:ask': a espera fica com erro ou qualquer resultado
  - task-tree/hooks/tool-call.ts:81 — do input só são lidos 'ask' e 'recap'; 'blocked' não é lido
  - task-tree/draw/layout.ts:763 e task-tree/hooks/sessions.ts:269 — running() conta a filha 'live' (waiting inclusive): o relógio de 1 s da mãe não para
  - task-tree/DESENVOLVIMENTO.md:1110-1114 — o comportamento-base está documentado: a espera 'fica até o próximo prompt.submit' e 'entra no arquivo publicado (waiting/waits), então a principal desenha o relógio de espera na filha'
  - task-tree/state/durability.ts:66 — waits vive só no state (some num reinício do processo)
- **Regra do catálogo:** perguntas.escolha-do-wrapup-ate-proxima-mensagem (citada certa); toca também sessoes.palavra-de-estado-do-cartao ('aguardando') e sessoes.filha-trabalhando-mantem-pais-em-andamento
- **Cenário:** Uma filha termina o turno com wrap_up e um ask opcional ("Fazer commit?", sem blocked). A pessoa conduz tudo pela orquestradora e não clica no botão. Na filha, "Aguardando sua escolha" fica indefinidamente. Na mãe: o cartão fica "aguardando", a tarefa de origem e os pais seguem ◉ com o relógio correndo, o painel redesenha a cada segundo, e o lembrete "terminou o turno a sessão…" nunca é gerado, até alguém mandar mensagem à filha (e então a espera some por mensagem de outra sessão, não da pessoa, ao contrário do cenário). Se a chamada do wrap_up dá erro, ou o app responde que não mostrou a pergunta, a espera fica do mesmo jeito. Depois de um reinício do processo (/model) a espera some, com a pergunta ainda na tela (waits vive só no state).
- **Proposta:** Criar a espera depois do next(e), só se a chamada não falhou; tratar ask sem blocked como oferta (não conta como waiting no arquivo publicado, ou conta só para a palavra do cartão, sem manter a origem ◉ nem segurar o lembrete de fim de turno). Ajustar o texto do cenário para dizer quais mensagens tiram a espera.
- **Ajuste da verificação à proposta:** Separar em duas partes. (a) Correção sem decisão: criar a espera depois do next(e) e só se a chamada não falhou (e, se o resultado disser que a pergunta não foi mostrada, não criar). (b) Tratar 'ask' sem 'blocked' como oferta muda o que o teste selado de perguntas.test.ts:92-107 afirma (ask sem blocked mostra 'Aguardando sua escolha'): só com a resposta do usuário à pergunta já proposta, com 'Reescrito' no cenário e selo de decisão. O texto do cenário deve passar a dizer que qualquer prompt que abre turno tira a espera (hoje o código tira também com mensagem de outra sessão).
- **Pergunta ao usuário:** Um wrap_up com pergunta que não bloqueia o trabalho (sem blocked) deve manter a filha como "aguardando" e a tarefa de origem ◉ na orquestradora? Recomendo que só a pergunta com blocked conte como espera; a outra apareceria só como palavra no cartão.
- **Verificação:** Conferi tool-call.ts, publish.ts, host.ts, layout.ts e prompt-submit.ts: toda chamada de wrap_up com ask não vazio cria a espera antes da chamada, sem olhar resultado nem blocked; a filha publica waiting, a mãe a trata como viva (origem ◉, relógio correndo, sem entrar em 'ended') e a espera só sai num prompt que abre turno, de pessoa ou de outra sessão. O comportamento-base é documentado como regra do painel; as bordas (falha, pergunta não mostrada, sem blocked, reinício) não têm cenário.

### Sessões que nascem sem um start_session com id (cartão own_initiative clicado, hand_off_to_session) não têm âncora nem cenário
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/io/host.ts:144-165 — a linha nova do host sem registro anterior entra em children com anchor e openedAt só do store (keptLink): sem recordStart, fica sem âncora
  - task-tree/draw/layout.ts:1288, 1525-1527 — cartão sem âncora só é desenhado solto no fim enquanto está vivo (alive); concluído, não é desenhado, e sem a linha '+N pedidos anteriores' aberta nem a linha '+N cartões antigos' aparece
  - task-tree/DESENVOLVIMENTO.md:1139-1140 — o documento diz que o cartão own_initiative sem âncora 'vai para o fim da lista', o que hoje só vale enquanto ele está vivo
  - task-tree/hooks/tool-call.ts:227-231 — a segunda chamada de start_session com proposal_id passa por recordStart (o resultado traz o id): só o clique direto no cartão fica sem chamada
- **Regra do catálogo:** sessoes.cartao-sob-a-tarefa-de-origem (só o nascimento na hora); não há cenário para cartão clicado nem para hand_off_to_session
- **Cenário:** A sessão propõe um cartão (own_initiative) com "Um" em andamento; o usuário clica no cartão minutos depois. Não há chamada de ferramenta na mãe nesse momento: a filha aparece na lista do host e entra em children sem anchor nem openedAt. O cartão fica solto no fim, não mantém "Um" em andamento, não conta no x/y de nenhuma tarefa, nunca vira "encerrada" (não há origem para fechar) e some ao concluir. O mesmo vale para a sessão criada por hand_off_to_session; nesse caso as tarefas que a mãe entregou continuam abertas no painel dela, sem regra que diga o que fazer com elas.
- **Proposta:** Guardar a proposta como já se faz com os lançamentos de subagente: no start_session cujo resultado não traz id local_, gravar { name/title, anchor, at } e, em deriveChildren, a linha nova sem ligação cujo título ou nome casa com uma proposta a reclama (âncora e openedAt). Tratar hand_off_to_session como start_session (âncora = tarefa em andamento). Cenários novos no catálogo para os três nascimentos (na hora, por cartão, por hand-off).
- **Ajuste da verificação à proposta:** Antes de implementar, confirmar no app o que o código não mostra: se a sessão aberta pelo clique no cartão (e a do hand_off_to_session) aparece em list_sessions com startedBy desta sessão, e o que o resultado da proposta traz (task_id). Se o resultado trouxer um identificador que a linha do host também carrega, casar por ele em vez de por título ou nome (o casamento por nome falha com títulos repetidos). O destino do cartão (tarefa da proposta ou pedido vigente no clique) é pergunta ao usuário, como já proposto; o hand-off precisa de pergunta própria sobre o que fazer com as tarefas que ficam abertas na mãe.
- **Pergunta ao usuário:** A filha aberta por cartão deve ficar sob a tarefa em andamento quando o cartão foi proposto (recomendado) ou no fim do pedido vigente quando o usuário clicou?
- **Verificação:** Pelo código, só start_session com id local_ no resultado grava âncora; uma sessão que surja na lista do host sem essa chamada fica sem âncora, fora do x/y de qualquer tarefa, nunca vira 'encerrada' e deixa de ser desenhada ao concluir. Se o app de fato lista como filha a sessão nascida por clique ou por hand-off, e com qual startedBy, o código não mostra.

### Duas regras se contradizem para a filha parada com Esc que tem pendentes: 'o cabeçalho as conta' e 'saem do cabeçalho'
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:117-121 — discarded() usa hasOpen do painel cru: basta uma pendente (nunca iniciada) para a filha parada com Esc ser descartada inteira
  - task-tree/draw/layout.ts:503-512 — o x/y e o tempo da tarefa de origem também pulam a descartada (kept)
  - task-tree/tests/sessoes.test.ts:211-229 — o único teste do caso tem uma só tarefa iniciada: o total cai de 4 para 3 tanto por ✕ quanto por descarte, então não distingue as duas regras
- **Regra do catálogo:** turnos.pendentes-seguem-pendentes e sessoes.rodada-descartada-fora-da-contagem (citadas certas); também sessoes.filha-parada-pendentes-seguem-pendentes (pendentes da filha 'entram no chip pendentes', ✕ se o turno foi interrompido)
- **Cenário:** Uma filha com 2 concluídas, 1 iniciada e 2 pendentes é parada com Esc. No painel dela o cabeçalho diz '2 de 4' (a iniciada ✕ sai). Na mãe, o cartão desenha as mesmas linhas, mas contribui 0 de 0: as 2 concluídas e as 2 pendentes somem do cabeçalho e do x/y da tarefa de origem. A mesma sessão mostra números diferentes conforme quem olha, e as duas regras do catálogo dão respostas opostas.
- **Proposta:** Decidir qual regra vale para a filha parada com Esc e reescrever a outra citando a decisão (por exemplo: descartada só a rodada anterior abandonada; a parada com Esc conta ✓ e pendentes como a própria sessão conta). Acrescentar teste do total com pendentes na filha abortada.
- **Ajuste da verificação à proposta:** Manter como pergunta ao usuário (já proposta), citando as duas decisões; a resposta reescreve um dos dois cenários com 'Reescrito'. O teste novo deve usar filha abortada com ✓, iniciada e pendentes, para distinguir ✕ de descarte.
- **Pergunta ao usuário:** Filha parada com Esc: as tarefas concluídas e as pendentes dela devem seguir contando no cabeçalho da mãe, como contam no painel dela (recomendado), ou a rodada inteira sai da contagem, como hoje?
- **Decisão já registrada:** As duas regras vêm de decisões do usuário: regras/sessoes.md:108-119 (2026-10-24, 'as tarefas dessa sessão foram descartadas'; 2026-10-28, a descartada é a rodada anterior, não a que trabalha) e regras/turnos.md:18-26 (2026-10-27, 'pendentes nunca ✕', com 'o cabeçalho as conta'). Nenhuma diz qual vale para a filha parada com Esc que tem ✓ e pendentes.
- **Verificação:** Reproduzi pela leitura: filha parada com Esc, com 2 ✓, 1 iniciada e 2 pendentes, conta 2 de 4 no painel dela (halt com aborted, layout.ts:53-67) e 0 de 0 na mãe (total e atWork pulam a descartada). Os dois cenários do catálogo dão respostas opostas para as pendentes e as ✓ desse caso, e nenhum teste afirma a contagem.

### /clear numa filha apaga da mãe todo o trabalho dela (os ✓ saem da contagem) e o cartão vira "concluída" vazio, sem cenário
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/session-start.ts:72-78 — o /clear grava um grupo principal vazio (sem turnos), zera waits, sends e work, e publica
  - task-tree/io/host.ts:62 — 'if (file.groups)' é verdadeiro para o grupo vazio: o painel publicado vazio substitui o anterior (host.ts:166)
  - task-tree/draw/layout.ts:374-375, 1160-1165 — sem tarefas, um cartão só, sem contagem, com a palavra 'concluída'
  - regras/durabilidade.md:40-48 — durabilidade.clear-esvazia cobre só o painel da própria sessão
- **Regra do catálogo:** Nenhum cenário cobre o cartão da filha na mãe depois do /clear; o vizinho é durabilidade.clear-esvazia (o /clear esvazia o painel da própria sessão).
- **Cenário:** Mãe com tarefa "Implementar" 5/5 vindos da filha. O usuário dá /clear na filha (contexto cheio). Na leitura seguinte (3 s) o cartão da filha na mãe perde todas as tarefas e respostas, o x/y da tarefa de origem e o cabeçalho da mãe encolhem, e o cartão fica "filha concluída" sem nada dentro. As rodadas (rounds) da mãe continuam, então o próximo turno da filha (ids de pedido recomeçando em 1) é repartido pelos cartões antigos por horário. O modelo da mãe não é avisado.
- **Proposta:** Decidir e catalogar. Opção recomendada: a filha publica um marcador (ex.: clearedAt) e a mãe congela o último painel anterior ao /clear como histórico daquela rodada (como faz com arquivo ausente), desenhando o trabalho novo num cartão novo. Alternativa: aceitar o comportamento atual e escrever o cenário (sessoes.filha-com-clear) para que deixe de ser acidente.
- **Ajuste da verificação à proposta:** Manter como pergunta ao usuário. Para a opção de congelar o histórico: o marcador novo no arquivo publicado é campo opcional (sem subir PUBLISHED_VERSION, ou os leitores de versões antigas ignoram o arquivo), precisa entrar em tests/fixtures de formatos publicados e na comparação de publishWait; a mãe precisa guardar o painel anterior em children (state grande: 220 KB no caso real citado em sessions.ts:68-69). O app também tem clear_session, então a mãe pode ser quem limpa a filha.
- **Pergunta ao usuário:** Quando o usuário dá /clear numa filha, o cartão dela na mãe deve (a) manter o que ela já tinha feito como histórico (recomendado) ou (b) esvaziar junto com a filha?
- **Verificação:** Segui o caminho inteiro: /clear na filha publica groups com o grupo principal vazio; panelOf do host aceita, deriveChildren troca o painel, e o cartão na mãe perde tarefas e respostas, o x/y da origem e o cabeçalho encolhem e o cartão fica 'concluída' vazio. As rodadas da mãe ficam; o turno seguinte da filha cai na última rodada. Não há cenário nem decisão registrada.

### O cálculo das quebras de cartão (breaks) ainda cresce com a quarta ou quinta potência do número de irmãs que trocam mensagens entre si
- **Categoria:** indefinição · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/draw/layout.ts:243 — a chave do memo começa pelo caminho desde o cartão raiz: nada é reaproveitado entre cartões raiz diferentes nem entre caminhos
  - task-tree/hooks/render.tsx:225, task-tree/draw/layout.ts:708 e task-tree/hooks/sessions.ts:236 — três chamadores criam um memo novo por filha (newBreaksMemo() dentro do laço)
  - task-tree/DESENVOLVIMENTO.md:1186-1192 — o custo medido e o crash do worker são de troca em anel; não há medida para malha
- **Regra do catálogo:** visual.cartoes-ordem-e-espera (checklist); não há cenário de limite de irmãs
- **Cenário:** Uma orquestradora com 8 ou mais filhas que se escrevem em malha (cada uma com mensagens de várias irmãs entre as últimas 20 recebidas). Por cartão, as chamadas somam aproximadamente (n−1)(n−2)(n−3)(n−4) internas mais as folhas, cada uma percorrendo todas as tarefas da mãe; isso roda duas vezes por desenho e o desenho roda a cada segundo. O comentário do código registra que a versão anterior (20^5 chamadas) derrubou o worker de hooks. Com as cadeias lineares de hoje (uma filha sinaliza a seguinte) o custo é baixo (154 chamadas medidas); o limite de irmãs em malha não está definido nem testado.
- **Proposta:** Tirar o caminho da chave para o resultado sem ciclo (cache por irmã, com o corte de ciclo tratado à parte), calcular flat(owner) uma vez por desenho, reutilizar no render o split do layout em vez de refazê-lo, e pôr um teto explícito (por exemplo, seguir no máximo 2 níveis de irmãs). Teste de carga com 10 irmãs em malha no limite de 5 s do kit.
- **Ajuste da verificação à proposta:** Tirar o caminho da chave muda o resultado nos casos de ciclo (o comentário de layout.ts:242 diz que o corte vale 'ali, e só ali'): o cache por irmã só serve para subárvores sem reencontro; o teste da cadeia em anel (sessoes.test.ts:261-277) e o golden precisam continuar iguais. Começar pelo que não muda resultado: flat(owner) uma vez por desenho e um memo só por desenho nos três chamadores. Medir com 8 a 10 irmãs em malha antes de pôr teto; o teto de níveis altera onde cai o cartão de mensagem de irmã e pede cenário.
- **Verificação:** Conferi a recursão: desce até 5 níveis, uma vez por irmã distinta em received, com o caminho na chave, e calcula 'own' (resolveAnchor por rodada e unsent, cada um com flat(owner)) em toda chamada, antes do corte; a conta de (n−1)(n−2)(n−3)(n−4) nós internos por cartão raiz está certa para malha completa. Com as cadeias lineares e em anel de hoje o custo é baixo; se uma malha de 8 ou mais irmãs acontece e quanto custa não dá para fechar sem medir.

### No cartão da filha parada, a tarefa ◷ para no último carimbo do painel publicado: 0:00 ou tempo cortado
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:135-136 — 'last' é o maior startedAt/endedAt das tarefas (plannedAt e o 'at' dos turnos não entram); halt(last) grava endedAt = last na iniciada aberta
  - task-tree/draw/layout.ts:520-527, 1049 — tom 'paused' usa stillSpan: maior fim menos menor início, 0 quando o último carimbo é o próprio start
  - task-tree/draw/layout.ts:1179 — o tempo do cartão (span) herda o mesmo corte
  - task-tree/io/publish.ts:155-162 — o arquivo leva 'at' (hora da publicação), mas ele só é gravado quando algo muda (publish.ts:148-149) e deriveChildren não o copia para Child: não serve como fim do turno
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim (diz '◷ com o relógio parado', sem dizer em que hora); sessoes.filha-parada-pendentes-seguem-pendentes ('a iniciada aberta ◷')
- **Cenário:** A filha dá start em X às 10:00, trabalha 20 minutos sem outro start/done e encerra o turno com X aberta. No painel dela X aparece ◷ 20:00; no cartão dela na orquestradora X aparece ◷ 0:00 (o último carimbo conhecido é o próprio start). Se houve um done de outra tarefa às 10:05, o cartão mostra 5:00. O tempo do cartão e do pedido da mãe herdam o corte.
- **Proposta:** Publicar o fim do turno no arquivo (campo opcional novo, ex.: `ended`, em Published/Panel, lido por parsePublished) e usá-lo em panelOf como o instante do halt, com `last` só como reserva para arquivos de versões antigas. Cenário novo em regras/sessoes.md (tempo da tarefa ◷ no cartão igual ao do painel da filha).
- **Ajuste da verificação à proposta:** O campo novo (fim do turno) deve ser opcional, sem subir PUBLISHED_VERSION; entrar na chave de comparação de publishWait (ou a publicação do fim do turno pode ser pulada por 'nada mudou'); ser copiado por parsePublished e deriveChildren para Child; e ganhar fixture em tests/fixtures. Conferir o golden 'filha trabalhando' (não deve mudar: a filha está viva) antes do commit.
- **Verificação:** Reproduzi pela leitura: filha parada com uma tarefa iniciada às 10:00 e nenhum outro carimbo depois tem endedAt = startedAt no cartão da mãe (0:00), enquanto no painel dela o halt usa turnEnded (render.tsx:236-241) e mostra o tempo real; com um done às 10:05 o cartão mostra 5:00. O arquivo publicado não leva o fim do turno.

### Tarefa concluída com filha embaixo: o tempo corre enquanto a filha trabalha e regride quando ela para
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:483-485, 511 — 'tasks' (o que entra no tempo) vem só de sessões ancoradas em tarefa não concluída ('mine'); a contagem d/n usa 'kept' (503-510)
  - task-tree/draw/layout.ts:531-538 — com busy, now menos o menor início; sem busy, span() só da própria tarefa quando ela está concluída
  - task-tree/draw/layout.ts:1118 — o tempo da linha do pedido usa as mesmas 'tasks': regride junto
- **Regra do catálogo:** sessoes.filha-trabalhando-mantem-pais-em-andamento (a tarefa concluída segue ◉ enquanto a filha trabalha); nenhum cenário fala do tempo dessa linha
- **Cenário:** A orquestradora envia mensagem da tarefa T; a filha toma a mensagem em 3 s e T é concluída (0:03). A filha trabalha 10 minutos: T aparece ◉ com o tempo correndo até 10:03, e o pedido também. A filha para: T volta a ✓ 0:03 e o pedido perde os 10 minutos, embora o x/y de T e do pedido contem as folhas da filha e o tempo do cabeçalho inclua o trabalho dela.
- **Proposta:** Escolher uma definição e aplicá-la nos dois momentos. Recomendo que o tempo da linha inclua as tarefas das sessões que pendem dela, concluída ou não (trocar `mine` por `kept` no cálculo de `tasks`), para o número não regredir e bater com o x/y. Registrar o cenário em regras/sessoes.md.
- **Ajuste da verificação à proposta:** Manter como pergunta ao usuário. Trocar 'mine' por 'kept' muda o tempo de linhas concluídas com cartão embaixo e do pedido: conferir os três cenários do golden (o de envios tem carta entregue com tarefa concluída) e os testes que leem o texto da linha; se o desenho mudar, vale a regra do golden (validação no app antes do commit).
- **Pergunta ao usuário:** O tempo de uma tarefa (e do pedido) deve incluir o trabalho das filhas abertas a partir dela mesmo depois de ela estar concluída (recomendado, coerente com o x/y), ou só o tempo próprio até o done?
- **Verificação:** Confirmei no código: tarefa concluída na entrega (sessions.ts:152-167) com a filha trabalhando embaixo tem tempo 'agora menos o início' enquanto busy e, quando a filha para, volta ao intervalo próprio (0:03), porque as tarefas da filha só entram no tempo se a âncora não está concluída; o x/y da mesma linha continua contando as folhas da filha. É o fluxo comum de envio na fila seguido de trabalho da filha.

### Cada turno aberto direto na filha vira um cartão separado e nunca é fundido: dois cartões iguais '<nome> · pedido do usuário na filha' no mesmo ponto; e 'digitado pelo usuário' é qualquer prompt que não seja mensagem de sessão
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:316-321 — o comentário registra a escolha: 'each one a card of its own', no pedido vigente quando o usuário digitou
  - task-tree/hooks/prompt-submit.ts:88 — openTurn(..., !it.peer, ...): 'own' é todo prompt que abre turno e não é mensagem de outra sessão; e.origin.kind só é usado para NO_TURN (linhas 21, 49, 62-66)
  - task-tree/draw/layout.ts:1173 — os dois cartões saem com o mesmo título ('<nome> · pedido do usuário na filha'); só o tooltip (linha 1175) os distingue
- **Regra do catálogo:** sessoes.turno-proprio-da-filha-no-pedido-vigente ('o cartão desse turno'); sessoes.um-cartao-por-mensagem não cobre turnos próprios seguidos
- **Cenário:** auditoria-mod: turno 1 (abertura, tarefa 'Aguardar sinal...' aberta) e turno 2 ('Teste de mensagem', own, sem registro em received, concluído). A mãe desenha, sob '65', dois cartões com o mesmo título: o primeiro 'parada', o segundo com 'Responder ao teste'. É exatamente o print: dois cartões separados para a mesma filha. Pela regra atual é o esperado (um cartão por turno próprio); o que não está definido é se turnos próprios seguidos, no mesmo ponto, devem ser um cartão só.
- **Proposta:** Depois de corrigir o turno de abertura (achado anterior), juntar num cartão os turnos da mesma sessão que caem na mesma âncora sem rodada entre eles (uma linha de pedido por turno dentro do cartão, como já acontece com turnos de uma mesma rodada), e só abrir cartão novo quando a âncora muda. Decidir own pela origem do prompt (e.origin.kind), para que agendamento, plugin e mensagem por outro canal não sejam lidos como digitação.
- **Ajuste da verificação à proposta:** São duas coisas. (1) Juntar turnos próprios seguidos num cartão muda o comportamento registrado em 2026-11-03: só com a resposta do usuário à pergunta já proposta, e 'Reescrito' no cenário. (2) Decidir 'own' por e.origin.kind é correção da regra como escrita ('digitando na filha'), mas antes é preciso medir no app quais origens chegam (prompt de abertura do start_session, tarefa agendada, Remote Control, plugin) para não trocar um erro por outro; cenário novo para cada origem que não é digitação.
- **Pergunta ao usuário:** Turnos abertos direto na filha (digitados nela ou vindos por outro canal) devem: (a) Recomendado: entrar no cartão que a sessão já tem naquele ponto do painel da mãe, com uma linha de pedido por turno, abrindo cartão novo só quando o pedido vigente da mãe é outro; ou (b) continuar um cartão por turno, como hoje?
- **Decisão já registrada:** Um cartão por turno próprio é o comportamento registrado: regras/sessoes.md:16 e 187-197 (decisão de 2026-11-03, 'No pedido vigente da orquestradora (Recomendado)', que reescreve 'turno aberto direto pelo usuário na filha vira cartão próprio') e o comentário de task-tree/draw/layout.ts:316-320. O que é 'digitado pelo usuário' (origem do prompt) não tem decisão.
- **Verificação:** Confirmei em split: cada turno own vira uma parte e um cartão próprio, sem fusão, e dois turnos com o mesmo pedido vigente saem como cartões irmãos de mesmo título; isso é o desenho registrado, não defeito. A indefinição real é a segunda: prompt-submit marca own em todo prompt que abre turno e não vem de outra sessão, mais largo que 'o usuário digitando na filha' do cenário.

### A lista de sessões é pedida com limit: 100 e arquivadas incluídas: o que acontece acima de 100 ligadas não está definido
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:159-160 — o documento cita `limit: 100` como parâmetro, sem dizer o que acontece acima dele.
  - Mesmo assunto do achado sobre filhas arquivadas que nunca saem (limite 100 citado lá também): tratar como um só.
- **Regra do catálogo:** (nenhuma)
- **Cenário:** Orquestradora de vida longa: as filhas arquivadas nunca saem da lista ligada. Passando de 100 sessões ligadas (filhas, mãe, irmãs), o app corta a resposta numa ordem que o mod não controla. Se o corte tirar as mais novas, os cartões das filhas recém-abertas nunca aparecem e as cartas a elas não confirmam; se tirar as mais antigas, cartões de histórico somem sem aviso (com as ligações inertes no store).
- **Proposta:** Verificar no app a ordem e o comportamento do limit; pedir primeiro sem arquivadas (as vivas nunca podem faltar) e as arquivadas à parte, ou paginar. Quando a resposta vier com exatamente 100 linhas, dizer no painel (linha de seção) que a lista pode estar cortada. Registrar a decisão no catálogo.
- **Ajuste da verificação à proposta:** Primeiro verificar no app a ordem e o corte do `limit` (não está no código). O mínimo sem decisão: registrar no log quando vierem exatamente 100 linhas. Pedir vivas e arquivadas em chamadas separadas e a linha de aviso no painel mudam comportamento visível: seguem como pergunta ao usuário, como proposto.
- **Pergunta ao usuário:** Com mais de 100 sessões ligadas, o painel deve priorizar as vivas e mostrar só as arquivadas mais recentes (recomendado)?
- **Verificação:** Confirmei a chamada com `limit: 100` e arquivadas incluídas, sem paginação, e que tudo depende dessas linhas. O que o app faz acima de 100 sessões ligadas não aparece no código, e o volume fica longe do uso medido (4 filhas); é indefinição a registrar, sem efeito hoje.

### Um dado fora do formato num cartão de filha derruba o painel inteiro, as ferramentas e o poll: não há validação por elemento nem isolamento por cartão
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:73-78 — no poll, o `set` de `children` vem antes de showStatus: os cartões não congelam; o que se perde a cada volta é a publicação do próprio painel e o keepTime (linhas 79-80).
  - task-tree/draw/layout.ts:760-764 — `running()` só olha as tarefas próprias e `live` das filhas, sem percorrer os painéis delas: o tick de 1 s não lança por causa de um painel de filha malformado.
  - task-tree/hooks/panel.ts:340-346 e tools.ts:121-123 — persist chama showStatus antes de saveGroups e publishPanel: se `total()` lança, o state já mudou, o store não é salvo, nada é publicado e a ferramenta responde 'erro: TypeError…'.
  - task-tree/types/index.d.ts:101-104 — o contrato promete ignorar arquivo de outra versão ou que não é objeto; não promete validar os elementos.
  - Não achei caminho real que produza o dado malformado: o arquivo é escrito só pelo próprio mod (publish.ts:157-181), os 8 formatos antigos têm teste, e uma gravação pela metade falha no JSON.parse inteiro.
- **Regra do catálogo:** durabilidade.formatos-antigos-do-publicado
- **Cenário:** Uma filha publica (ou o store devolve) um grupo sem tasks, uma tarefa sem children ou um envio sem to, dentro da mesma versão do arquivo (um bug de quem escreveu, um store antigo restaurado sem validação, o painel de uma neta). Na mãe: o painel inteiro vira "Painel de tarefas: erro ao desenhar: TypeError…"; plan, start e done passam a responder `erro: TypeError…` (o state muda, mas o store não é salvo e nada é publicado); o poll de 3 s falha calado a cada volta e os cartões congelam; o tick rejeita a cada segundo. Tudo por um cartão, e sem dizer qual.
- **Proposta:** (1) Normalizar por elemento em parsePublished e ao ler o store: descartar grupo sem tasks em lista, tarefa sem children em lista e envio sem to, recursivamente nos painéis aninhados, registrando o motivo uma vez. (2) No layout, desenhar cada cartão de sessão dentro de um try: o que falha vira uma linha "cartão ilegível: <nome>" e o resto do painel segue. (3) Em showStatus, tratar a falha da contagem como status ausente.
- **Ajuste da verificação à proposta:** Manter as três partes, na ordem de custo: (3) showStatus com falha tratada como status ausente, para a ferramenta nunca deixar de salvar o store e publicar; (2) cartão isolado no desenho; (1) normalização por elemento em parsePublished. Tirar da descrição 'os cartões congelam' e 'o tick rejeita a cada segundo', que o código não confirma.
- **Verificação:** A falta de validação por elemento e de isolamento por cartão está confirmada na leitura (flat/tasksOf sem defesa, total() dentro de persist, erro de desenho troca o painel inteiro). É lacuna de robustez sem efeito hoje: não há caminho no código atual que publique grupo sem tasks, tarefa sem children ou envio sem to.

### Falha ao obter o id da própria sessão congela os cartões sem aviso, enquanto a falha da lista de sessões mostra uma linha no painel
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:45 — a linha de erro é limpa (a lista foi lida) antes de o id próprio ser pedido (58-59): o painel fica sem aviso e sem atualização ao mesmo tempo.
  - task-tree/hooks/sessions.ts:56-57 — o comentário diz que esperar pelo id é intencional ('a read waits for it … rather than deduce'); o silêncio é que não está tratado.
  - task-tree/hooks/panel.ts:491-496 — publishPanel também chama selfId: cada publicação repete a linha no log enquanto a falha durar.
- **Regra do catálogo:** (nenhuma)
- **Cenário:** No app, list_sessions responde e get_session falha (logo depois de uma recarga do mod, ou por erro do app). A linha de erro some (a lista foi lida), mas as filhas não são atualizadas: os cartões ficam com o último estado, uma filha parada segue desenhada como trabalhando e mantém os pais em andamento, e o painel não diz nada. No log, uma linha a cada 3 s. Se a exceção vier de outro ponto de refreshChildren, nem log há.
- **Proposta:** Usar a mesma saída para os dois casos: gravar em childrenError o motivo quando o id próprio não vem ("Sessões indisponíveis: id da sessão não lido"), e no catch do poll registrar com debug() uma vez por motivo e gravar o mesmo aviso. Deduplicar o log de selfId e o de publishWait como readPublished faz.
- **Ajuste da verificação à proposta:** Manter. Gravar o aviso só depois de algumas falhas seguidas (uma falha isolada logo após a recarga não deve piscar a linha no painel) e deduplicar o log por motivo, como readPublished faz.
- **Verificação:** Confirmei a assimetria: a falha de list_sessions vai para childrenError e aparece no painel; a de get_session dentro do app sai com `return` sem aviso, sem atualizar filhas, status ou relógio, e o poll engole qualquer outra exceção sem log. Só tem efeito se o app falhar em get_session com a lista funcionando, o que o código não indica ser comum.

### "coberto" vale por citação: a palavra "aguardando" do cartão (filha esperando a pessoa) não tem teste nenhum
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - `regras/sessoes.md:20-30` — sessoes.palavra-de-estado-do-cartao lista seis saídas (sem palavra, aguardando, parada, encerrada, concluída, arquivada) e está 'coberto'
  - `regras/sessoes.md:74-83` — sessoes.filha-parada-com-origem-fechada-sai-da-contagem tem a condição 'sem esperar a pessoa', também sem teste
  - `task-tree/tests/kit/ambiente.ts:88, 123` — o kit tem Filha.aguardando (waiting no arquivo publicado), que nenhum teste usa
  - `task-tree/tests/sessoes.test.ts:47-90, 476-531` — as palavras afirmadas são concluída, parada, arquivada e encerrada; 'aguardando' só aparece numa lista de palavras que NÃO devem estar
  - `task-tree/draw/layout.ts:1164` — o ramo c.waiting ? 'aguardando' existe no código
  - `scripts/regras.mjs:124-129` — 'coberto' só exige que algum teste cite o id
- **Regra do catálogo:** sessoes.palavra-de-estado-do-cartao; sessoes.filha-parada-com-origem-fechada-sai-da-contagem (condição 'sem esperar a pessoa')
- **Cenário:** Uma filha para numa pergunta ao usuário (waiting: true no arquivo publicado). Na principal o cartão deve dizer 'aguardando', contar como sessão viva e não virar 'encerrada' com a origem fechada. Nenhum teste publica waiting: true (busquei 'aguardando: true' e 'waiting' em tests/*.test.ts: só 'waiting: false' em ultracode.test.ts). Uma mudança que quebre esse ramo passa no check com o cenário marcado 'coberto', e é um estado comum na orquestração.
- **Proposta:** Acrescentar o teste (filha com aguardando: true: palavra 'aguardando', sem 'parada'/'encerrada', com a origem fechada inclusive) ligado aos dois cenários. Para o catálogo: quando um cenário enumera saídas, quebrar em cenários menores ou listar no Então só o que o teste afirma; opcionalmente, regras.mjs avisar cenário 'coberto' citado apenas como segunda regra de testes de outro assunto.
- **Ajuste da verificação à proposta:** O teste novo é selado como '--tipo novo' e pode citar as duas regras. Mexer em scripts/regras.mjs (aviso para cenário citado só como segunda regra) muda as travas e pede teste em 'travas'; é opcional e separado. Vale ligar este teste ao achado do wrap_up com ask: é o mesmo ramo (waiting publicado).
- **Verificação:** Busquei 'aguardando' e 'waiting' em task-tree/tests/*.test.ts: nenhum teste publica uma filha com aguardando: true (só 'waiting: false' em ultracode.test.ts:12 e a lista de palavras ausentes em sessoes.test.ts:54); o kit tem o campo (ambiente.ts:88, 123) e o ramo existe em layout.ts:1164 e host.ts:140-154. regras.mjs:124-129 aceita 'coberto' com qualquer citação. É lacuna de teste, sem efeito visível hoje.

### Sessão fora da tela e sem evento: depois da recarga, a leitura de 3 s das sessões não volta
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:4605-4611 — a descrição do kit diz que session.start roda de novo 'once per fresh load' e num 'reload (changed modules only)'; se vale, sessionStart (hooks/session-start.ts:66-67) chama refreshChildren e watchSessions e o cenário não acontece
  - task-tree/state/durability.ts:8-9 e task-tree/DESENVOLVIMENTO.md:205, 717 — o mod afirma o contrário ('a recarga não roda session.start'): as duas fontes divergem
  - task-tree/hooks/prompt-submit.ts:60 e task-tree/hooks/tool-call.ts:225 — qualquer prompt ou chamada do loop principal religa o poll (primeira leitura 3 s depois; o aviso do app relê na hora, prompt-submit.ts:68)
- **Regra do catálogo:** visual.recarga-real-e-respawn (checklist; parte de 'o painel aberto', não cobre sessão fora da tela)
- **Cenário:** Uma filha manda uma mensagem à mãe (fica na fila), encerra o turno e fica parada, sem estar na tela. Um arquivo do mod é salvo: o intervalo de 3 s morre com o módulo antigo. Se o app não desenha o pane de sessão que não está visível e a recarga não roda session.start, nada religa o poll: quando a mãe toma a mensagem, a filha não vê (watchSends não roda), a carta dela segue 'na fila' e a tarefa aberta, e é isso que o cartão dela mostra na mãe até a filha receber outro prompt. O mesmo vale para a orquestradora parada: os cartões das filhas só voltam a atualizar no próximo aviso do app.
- **Proposta:** Verificar no app (log de debug em watchSessions com a origem) se uma sessão em segundo plano religa o poll depois de um save. Se não religar: usar o session.start da recarga (se o kit de fato o dispara, ver o achado anterior) ou um hook que rode a cada carga do módulo para chamar watchSessions; e fazer refreshStale reler quando refreshedAt está indefinido. Registrar o caso como cenário de checklist (recarga com a sessão fora da tela).
- **Ajuste da verificação à proposta:** Primeiro medir no app (log em watchSessions com a origem, como proposto) e conferir se session.start roda na recarga: a tipagem do kit diz que sim, a documentação do mod diz que não; uma das duas está desatualizada e isso também interessa à tabela de durabilidade. Só se o poll de fato não religar: fazer refreshStale reler com refreshedAt indefinido e registrar o cenário de checklist.
- **Verificação:** ticker e poller são variáveis do módulo e só voltam por session.start, prompt, chamada do loop principal ou desenho (sessions.ts:243-257, render.tsx:205-212); refreshStale não relê com refreshedAt indefinido (sessions.ts:190-194). Se uma sessão parada e fora da tela fica sem poll depois de um save depende de o app desenhar o pane ao carregar o mod e de session.start rodar na recarga, que o código não mostra. O efeito seria um cartão desatualizado até o próximo evento, só após recarga do mod.

### Filha apagada (ou fora do limite de 100 da lista) some sem aviso, e o status e o arquivo publicado ficam com o valor antigo
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/sessions.ts:50-55` — Com a lista vazia, children é zerado e a função sai antes de showStatus, publishPanel e keepTime.
  - `task-tree/hooks/sessions.ts:75-80` — Com lista não vazia e nenhuma filha minha, o painel não é publicado (só publica com mine.length > 0).
  - `task-tree/io/host.ts:31-38` — list_sessions com linked: true, include_archived: true, limit: 100, sem paginação; a descrição do app diz que linked traz a família inteira, as mais recentes primeiro.
  - `task-tree/hooks/panel.ts:661-677` — As ligações de sessões que saíram da lista ficam no store para sempre (não há poda).
  - `task-tree/DESENVOLVIMENTO.md:726-741` — O documento aceita o custo de guardar ids de sessões apagadas; não diz o que o painel faz quando a filha some.
  - `task-tree/hooks/sessions.ts:50-55` — Sem nenhuma sessão ligada, o state é zerado e a função retorna antes de publicar.
- **Regra do catálogo:** sem cenário
- **Cenário:** A única filha é apagada no app com a tarefa de origem aberta. O cartão some do painel, mas a linha de status mantém "Tarefas d/n" com as tarefas dela e o arquivo publicado continua listando a filha (quem abriu esta sessão segue desenhando a neta) até outra mudança provocar publicação. A mãe não recebe lembrete algum sobre a tarefa de origem que ficou aberta. Numa família com mais de 100 sessões (arquivadas, irmãs e netas contam no limite), as mais antigas saem da lista da mesma forma silenciosa (este ponto depende da ordenação do app).
- **Proposta:** Sempre que children mudar (inclusive para vazio) chamar showStatus e publishPanel; quando uma filha com tarefa de origem aberta sair da lista, avisar o modelo uma vez, como no fim de turno; documentar o limite de 100 ou paginar; podar ligações de ids ausentes há muito tempo.

### Filha recém-aberta que o host lista ociosa é desenhada "concluída", e se nunca rodar fica `starting` para sempre
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/io/host.ts:130-135, 146-152` — O comentário diz que logo depois do start_session o host pode listar a sessão ociosa; ela fica starting: true e running: false até ser vista rodando, arquivada ou esperando.
  - `task-tree/draw/layout.ts:109, 1160-1164` — live() ignora starting; o tom e a palavra do cartão não olham starting: sem painel e sem rodar, cai em 'done' e "concluída".
  - `task-tree/draw/layout.ts:515` — A tarefa de origem só fica em andamento com live(): durante a janela de starting ela não acende.
  - `task-tree/io/host.ts:137-143` — `ended` exclui quem está starting: uma sessão que nunca chega a rodar não gera lembrete.
  - `task-tree/hooks/agents.ts:165-169` — O fechamento por subagentes trata starting como sessão viva (running || starting), diferente do desenho.
  - `task-tree/io/host.ts:132-134, 146-153` — `starting` segue enquanto o host não vir a sessão rodando, esperando ou arquivada; `running` é só o `isRunning` da linha.
- **Regra do catálogo:** sessoes.palavra-de-estado-do-cartao (não prevê a sessão abrindo)
- **Cenário:** start_session devolve o id; na releitura imediata o host lista a sessão com isRunning false. O cartão nasce com ✓ e a palavra "concluída", e a tarefa de origem não fica em andamento, até um poll ver a sessão rodando. Se a sessão nunca rodar (não recebeu o brief, falhou ao iniciar), fica starting indefinidamente: cartão "concluída", nenhum lembrete, e o cartão nunca pode virar "encerrada" (settle sai cedo com starting).
- **Proposta:** No desenho, tratar starting como sessão abrindo: tom de trabalho (ou a palavra "iniciando") e live para a tarefa de origem; dar prazo ao starting (depois de N segundos sem ser vista rodando, cai o sinal e a mãe recebe o lembrete de que a sessão não começou). Cenário novo para a palavra de estado nesse intervalo.

### Posição dos cartões e das cartas: quatro regras de "Como é hoje" foram desfeitas por decisões posteriores (cartão solto, `alive`, `lastAnchor`, ✉ na tarefa, envio apagado no replano)
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:397-408, 436, 454-455` — "o cartão dela não é desenhado solto"; "a resumida (...) nunca reposiciona cartão"; "`lastAnchor` (...) o desenho não o usa mais para posicionar"; "Saíram de `draw/layout.ts` `nest()`, `alive()`".
  - `task-tree/draw/layout.ts:712-722, 1360-1363, 1525-1530` — `alive` e `loosen` existem: o cartão vivo de um pedido fora de vista é desenhado solto no fim, com o nome do pedido (decisão de 2026-11-03).
  - `task-tree/draw/layout.ts:479, 486-494, 513` — `roundAt` e `atWork` usam `lastAnchor` para dizer onde a sessão trabalha (ícone, ◉ e sessão viva).
  - `task-tree/DESENVOLVIMENTO.md:100, 484-490` — "tira os `sends` do que foi replanejado"; "ou apaga os dois (tarefa replanejada)"; "a tarefa concluída com envio pendente tem tom `sent` (✉)".
  - `task-tree/hooks/tools.ts:106-109` — O replano só tira envios já tomados; o que está na fila fica (`|| !s.taken`), pendurado no nível 1 do pedido.
  - `task-tree/draw/layout.ts:1038-1043, 1269-1287` — A tarefa que enviou segue tarefa comum; o ✉ é uma linha própria (`letters`) sob ela.
- **Regra do catálogo:** sessoes.cartao-vivo-nunca-some; pedidos.replano-mantem-envio-ate-entrega; envios.carta-sob-a-tarefa
- **Cenário:** Uma filha trabalha sob um pedido que saiu de vista: o painel a desenha solta no fim, com "do pedido …" no título. Um replano tira do plano a tarefa de uma mensagem na fila: a carta continua, sob o último nível 1 do pedido. Nos dois casos o documento diz o contrário (cartão nunca solto; envio apagado junto), e o comentário final do `layout()` (linhas 1532-1535, "It never moves a card") repete a regra antiga.
- **Proposta:** Atualizar os bullets "Cartões no lugar certo", "Resumida: tudo à vista segura o painel" e "✉ até a entrega" com as decisões de 2026-10-30, 2026-11-03 e 2026-11-04, ou trocá-los por ponteiros para os cenários. Corrigir o comentário das linhas 1532-1535 de `draw/layout.ts`.

### O id da própria sessão é variável de módulo: o primeiro desenho depois da recarga divide os cartões sem ele
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/panel.ts:454-469` — ownId é variável de módulo, pedida de novo ao app depois da recarga; o desenho só lê knownId().
  - `task-tree/hooks/render.tsx:225, 251` — O desenho passa knownId() ao split e ao layout.
  - `task-tree/draw/layout.ts:186-188, 344` — Sem o id, `unsent` não devolve rodada nenhuma e o filtro das mensagens recebidas 'de mim' fica vazio: os turnos da filha vão para outra rodada/cartão.
  - `task-tree/hooks/sessions.ts:56-59` — O id só volta no refreshChildren (poll de 3 s) ou numa publicação.
- **Regra do catálogo:** visual.recarga-real-e-respawn (A recarga real e o respawn do worker não perdem nada)
- **Cenário:** Orquestradora com filhas que receberam várias mensagens (rodadas). Um arquivo do mod é salvo; o app redesenha o pane com o módulo novo antes de qualquer hook perguntar o id: os cartões das rodadas podem aparecer sob outra tarefa ou juntos, e voltam ao lugar no redesenho seguinte (até 3 s depois, quando o poll recupera o id e a restauração das ligações regrava o state). O efeito é um salto de cartões a cada save.
- **Proposta:** Guardar o id local numa chave de state só de state (não muda durante o processo e sobrevive à recarga); knownId passa a ser lido do state no desenho. Conferir no app se o salto aparece (checklist da recarga).

### Troca de modelo no meio da sessão não é um fluxo mapeado: toks/s do modelo antigo fica aceso e os campos do cartão têm fallbacks diferentes
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/turn.ts:73-81, 101-104` — engine e rate só mudam num turn.step do loop principal; o rate só é regravado por um passo válido com número diferente
  - `task-tree/hooks/register.tsx:17-35` — nenhum hook de troca de modelo (o engine oferece PostModelSwitch)
  - `task-tree/io/host.ts:136-170` — deriveChildren: engine, rate, git e context caem no valor anterior quando o arquivo não traz; ultracode, waiting e aborted não têm fallback (leitura falha ou arquivo sem o campo apaga)
  - `task-tree/io/host.ts:110-126` — sem engine publicado, o modelo vem do get_session com cache de 60 s
  - `regras/taxa.md:27-35` — 'o último número válido fica aceso' não considera mudança de modelo
- **Regra do catálogo:** taxa.fim-do-turno-fica-aceso: No fim do turno, o último número fica aceso
- **Cenário:** A filha mede 90 toks/s com um modelo; o usuário troca para outro. O cartão na orquestradora passa a mostrar o modelo novo (até 60 s depois, pelo cache) ao lado dos 90 toks/s do modelo antigo, acesos, até o primeiro passo válido; no cabeçalho da própria filha o número some (processo novo) ou fica (mesmo processo). Numa leitura falha do arquivo da filha, 'ultracode' pisca e apaga enquanto modelo e toks/s ficam.
- **Proposta:** Tratar a troca de modelo como evento: no PostModelSwitch (ou quando engine muda no turn.step) atualizar engine na hora e apagar o rate; em deriveChildren, dar a ultracode o mesmo critério dos outros campos (manter o anterior quando o arquivo não pôde ser lido, apagar só quando o arquivo lido diz que não). Cenário novo em regras/taxa.md.
- **Pergunta ao usuário:** Depois de trocar o modelo, o toks/s medido com o modelo anterior deve sumir até a primeira medida nova (recomendado) ou ficar aceso?

### Fim do trabalho delegado e tarefa de origem: carta fecha na entrega, subagente fecha no fim do turno, sessão filha nunca fecha
- **Categoria:** dúvida · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/sessions.ts:152-167` — Carta na fila: na entrega o painel conclui a tarefa de origem, mesmo no meio do turno.
  - `task-tree/hooks/agents.ts:150-157` — Subagente: no fim do turno a tarefa reflete o fim (✓, ✕ "falhou", ✕ "interrompida").
  - `task-tree/hooks/sessions.ts:217-241` — Sessão filha: só um lembrete ao modelo (e só se a tarefa de abertura ainda estiver aberta); a tarefa nunca é fechada nem marcada pelo painel, qualquer que seja o fim da filha.
  - `task-tree/draw/layout.ts:143-152` — O inverso existe: a origem fechada encerra a filha parada (`settle`).
- **Regra do catálogo:** sessoes.filha-trabalhando-mantem-pais-em-andamento; subagentes.pai-conclui-no-fim-do-turno
- **Cenário:** A orquestradora abre uma filha numa tarefa e encerra o turno. A filha conclui tudo (cartão "concluída", 3/3). A tarefa de origem fica ◷ "Aguardando" até o modelo dar done num turno futuro; se o turno seguinte for sobre outro assunto e o modelo ignorar o lembrete, fica aberta indefinidamente. Com um subagente no lugar da filha, o painel teria fechado a tarefa sozinho ("o pai sempre deve refletir seu status, não ficar pendente se não tiver nada em execucao").
- **Proposta:** Se a resposta for sim: estender a varredura de fim de turno (e o poll, quando a filha para depois do turno) à folha cujo trabalho era só uma sessão filha, com todas as tarefas dela concluídas e nada mais em execução; filha parada com Esc ou com tarefa aberta não fecha nada.
- **Pergunta ao usuário:** Quando uma sessão filha termina com todas as tarefas concluídas e não há mais nada em execução na tarefa de onde ela foi aberta, o painel deve fechar essa tarefa sozinho, como já faz com o subagente e com a carta? Recomendo que sim, só no caso de tudo concluído.

### O cartão do turno próprio da filha é desenhado no topo do último nível 1 do pedido, antes das subtarefas dele, e não no fim do pedido
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:327-332` — inForce devolve o id do último nível 1 do pedido vigente
  - `task-tree/draw/layout.ts:1068, 1305-1310` — o que pende de uma tarefa (cartas e cartões) é desenhado logo abaixo da linha dela, antes das subtarefas
  - `regras/sessoes.md:187-192` — 'o cartão desse turno fica no fim do pedido da mãe vigente'
  - `task-tree/tests/sessoes.test.ts:329-346` — o teste confere só sob qual linha o cartão está, não a posição em relação às subtarefas
- **Regra do catálogo:** sessoes.turno-proprio-da-filha-no-pedido-vigente
- **Cenário:** No painel real simulado, os dois cartões da auditoria-mod aparecem entre a linha '65' e a subtarefa '65.1', acima de todo o trabalho do nível 1, e não depois de 65.3.
- **Proposta:** Desenhar os cartões de turno próprio depois das subtarefas do último nível 1 (ou como último bloco do pedido), ou reescrever o cenário para dizer 'sob o último nível 1 do pedido'. O teste passa a conferir a posição.

## Envios (cartas)

19 achados: 1 de severidade alta, 11 média, 7 baixa.

### Carta na fila sem saída: destino que nunca confirma deixa a tarefa presa, o relógio de 1 s ligado e o resumo sem reiniciar
- **Categoria:** omissão · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:268 — a linha decisiva: 'if (sends.some(s => !s.taken)) return true' (nem cut é olhado): o relógio de 1 s não para
  - task-tree/hooks/sessions.ts:110, 141-148 — destino sem arquivo legível cai na regra antiga: linha arquivada (isRunning falso) só ganha 'idle' e nunca 'taken'
  - task-tree/draw/layout.ts:702 e task-tree/hooks/panel.ts:619 — openInSight segura o trabalho atual por qualquer envio não tomado ancorado nele (sem '!s.cut'); joinWork então soma cada pedido novo ao trabalho
  - task-tree/draw/layout.ts:148 — o envio preso também impede o cartão do destino de virar 'encerrada'
  - task-tree/DESENVOLVIMENTO.md:161 — o documento diz 'watchSends antes de qualquer retorno', mas o retorno por erro da lista (sessions.ts:40-44) vem antes
  - Busca por escritas de 'cut' em task-tree (hooks, io, state, draw): nenhuma; só leituras (layout.ts:148, 959, 964, 1225, 1273; agents.ts:169) e o tipo (types/index.d.ts:204)
- **Regra do catálogo:** envios.fica-ate-entrega, envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila e envios.fila-nao-interrompe-no-fim-do-turno; não há cenário para destino arquivado, apagado ou não confirmável
- **Cenário:** A orquestradora manda mensagem a uma filha ocupada (fica na fila) e a filha é arquivada, apagada ou nunca mais roda antes de pegar a mensagem. O mesmo vale para um destino dado por nome que a lista do host não traz, para uma sessão na nuvem ou sem o mod fora da lista, e para qualquer envio 'queued' fora do app desktop. Resultado: a carta fica azul 'na fila' com o tempo crescendo, a tarefa fica aguardando e imune ao Esc, o chip 'aguardando sessão' não sai, o painel redesenha a cada segundo para sempre e, como o envio segura o trabalho atual, a visão resumida passa a acumular todos os pedidos seguintes. Nem done, nem replan, nem pedido novo removem a carta; só /clear ou 20 envios novos.
- **Proposta:** Dar um fim à carta na fila: em watchSends, marcar `cut` (ou um estado novo 'não entregue') quando a linha do destino vem arquivada, quando o destino some da lista por N leituras, ou quando o destino não é confirmável (nome sem linha, fora do app); `cut` já é respeitado no desenho, no halt e no openInSight (este precisa ganhar o `!s.cut`). Avisar o modelo uma vez (como SESSION.taken) de que a mensagem não foi entregue. Registrar o cenário no catálogo.
- **Ajuste da verificação à proposta:** Manter a pergunta ao usuário (carta cinza 'não entregue' ou carta some), porque as decisões de 2026-10-23 e 2026-10-30 mandam a carta ficar até a entrega. Além de watchSends marcar o fim: anyRunning (sessions.ts:268) e openInSight (layout.ts:702) precisam ignorar o envio encerrado; a palavra de MSG_WORD.cut hoje é 'interrompida' (palavra nova muda o desenho e passa pelo golden de envios); 'destino some da lista por N leituras' precisa distinguir lista parcial do host (ver keptLinks em panel.ts:629-634) de sessão apagada; corrigir a frase de DESENVOLVIMENTO.md:161.
- **Pergunta ao usuário:** Quando a sessão destino é arquivada (ou some) com a carta ainda na fila, o que o painel deve mostrar: carta cinza 'não entregue' e a tarefa volta a ser comum (recomendado), ou a carta some?
- **Verificação:** Segui watchSends, anyRunning, halt e openInSight: um envio na fila só sai por recibo, turno posterior ou parada-depois-rodando; destino arquivado, apagado, dado por nome fora da lista ou com a lista em erro nunca confirma. O envio preso mantém a carta azul com o tempo crescendo, a tarefa ◷ imune ao Esc, o redesenho a cada segundo e a visão resumida acumulando os pedidos seguintes, e só /clear ou 20 envios novos o tiram; cut nunca é gravado.

### Recarga do mod faz um recibo antigo fechar a segunda mensagem ainda na fila (usedReceipts é variável do módulo)
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:117 e 127 — depois da recarga o envio 1 (já taken) é pulado e o recibo dele volta a ser candidato para o envio 2
  - task-tree/hooks/sessions.ts:88-90 — mensagens entregues juntas recebem o mesmo 'at' em noteReceived: dois recibos com a mesma chave '<id>|<at>' em usedReceipts
  - task-tree/hooks/tool-call.ts:153 — a entrega imediata nasce 'taken' sem passar por usedReceipts (o recibo dela fica livre, mas só casa com envio de 'at' anterior)
  - task-tree/DESENVOLVIMENTO.md:1524-1527 — o caso real que motivou o casamento um a um: a primeira entrega fechava as duas tarefas com a segunda ainda pendente
- **Regra do catálogo:** envios.fica-ate-entrega (a carta fica azul até a entrega); para a recarga, durabilidade.recarga-mantem-painel-ligacoes-e-resumo não cobre os envios na fila
- **Cenário:** Duas mensagens enviadas a uma filha ocupada, de duas tarefas (envios em t1 < t2). A filha toma só a primeira (recibo em r1 > t2): tarefa 1 ✓, carta 1 verde, carta 2 azul. O usuário salva um arquivo do mod (recarga a quente em todas as sessões) ou o processo reinicia. No poll seguinte, `usedReceipts` está vazio, r1 >= t2, e o envio 2 é marcado tomado: a tarefa 2 fecha ✓ e a carta 2 fica verde com a mensagem ainda na fila; o lembrete "recebimento confirmado" vai ao modelo.
- **Proposta:** Guardar o casamento no próprio envio, que já vive no state e no store: ao marcar `taken`, gravar `receipt: <at do recibo>`; em `watchSends`, derivar os recibos usados de `sends.filter(s => s.taken && s.receipt !== undefined)` em vez do `Set` do módulo. Teste em duas partes (como os de recarga de `durabilidade.test.ts`).
- **Ajuste da verificação à proposta:** Guardar o recibo no próprio envio resolve a recarga e o reinício, com dois cuidados: recibos de mesmo 'at' (entrega em lote) precisam ser contados, não só comparados por valor; e os envios tomados saem da lista (corte em 20 em tool-call.ts:154 e sessions.ts:175; filtro do plan em tools.ts:109), então o recibo de um envio já removido volta a parecer livre: guardar também o maior recibo já usado por destino, ou só aceitar recibo posterior a ele. O campo novo de Send vai ao store (links) e ao arquivo publicado (sends): opcional, sem subir a versão.
- **Verificação:** Reproduzi pela leitura: com dois envios na fila (t1 < t2) e só o primeiro tomado por um recibo r1 ≥ t2, uma recarga do mod ou um reinício do processo zera usedReceipts; no poll seguinte r1 volta a casar e marca o envio 2 como tomado, fechando a tarefa 2 e deixando a carta verde com a mensagem ainda na fila. Depende de o app entregar as duas mensagens em momentos diferentes, caso que o DESENVOLVIMENTO registra como já ocorrido.

### Carta, sessão ou subagente disparados antes do plan do pedido novo ancoram no pedido anterior
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:228-243 — antes disso: uma tarefa do pedido anterior deixada iniciada e aberta ainda conta como 'em andamento' no pedido novo (wake só limpa turnEnded) e recebe a âncora
  - task-tree/hooks/panel.ts:246-261 — sem nada em andamento, 'mine' são as tarefas do maior turn existente (o último pedido com tarefas)
  - task-tree/draw/layout.ts:1311 e 1384 — subagente ancorado em tarefa já concluída e à vista não é desenhado sob ela nem cai em 'lost': o cartão não aparece
  - task-tree/hooks/agents.ts:158-199 — settleBySubs fecha no fim do turno a pendente do pedido anterior que recebeu o subagente do pedido novo
  - task-tree/DESENVOLVIMENTO.md:508-509 — a implementação define 'pedido atual' como 'o último turno com tarefas, t.turn máximo'
- **Regra do catálogo:** envios.sem-andamento-vai-a-pendente-planejada-por-ultimo; também sessoes.cartao-sob-a-tarefa-de-origem e subagentes (mesma sendAnchor)
- **Cenário:** Pedido 1 terminou (com uma pendente esquecida, ou tudo concluído). Pedido 2: a primeira ação do modelo é lançar um subagente, abrir uma sessão ou mandar SendMessage, antes do plan. A âncora vai para o pedido 1: à pendente dele (que depois fecha ✓ sozinha no fim do turno, pelo subagente do pedido 2), ou à última tarefa iniciada dele, já concluída (o cartão do subagente não é desenhado; o cartão da sessão fica sob o pedido antigo, que pode já estar em '+N pedidos anteriores'). O plan que vem em seguida não traz o cartão para o pedido novo.
- **Proposta:** Passar a sendAnchor o id do turno aberto (o último de `turns`); se nenhuma tarefa é desse turno, devolver sem âncora e reancorar cartas, sessões e subagentes sem âncora na primeira tarefa do primeiro plan do turno (ou deixá-los soltos no fim do pedido novo). Cenário novo no catálogo para 'antes do plan'.
- **Ajuste da verificação à proposta:** A regra nova ('sem âncora e reancorar na primeira tarefa do primeiro plan do turno', ou solto no fim do pedido novo) não está coberta por nenhuma decisão: levar como pergunta ao usuário antes de escrever o cenário. Na implementação: sendAnchor é pura e só recebe tarefas, então o id do turno aberto vem dos chamadores (tool-call.ts:119, sessions.ts:206, agents.ts:43-51); a reancoragem precisa cobrir children (anchor, rounds), sends e launches, como renameAnchors; rodar 'npm run impacto' para hooks/panel.ts, porque testes de envio que mandam mensagem num pedido sem plano hoje esperam a âncora no pedido anterior.
- **Verificação:** Confirmei em sendAnchor: sem nada em andamento, o 'pedido atual' é o maior turn entre as tarefas existentes; com o pedido novo ainda sem plan, carta, sessão ou subagente ancoram no pedido anterior (pendente esquecida, que depois fecha sozinha, ou última iniciada já concluída, onde o cartão do subagente não é desenhado e o da sessão fica sob o pedido antigo). O plan seguinte não move nada. A decisão de 2026-10-23 não prevê o caso.

### Carta cinza 'interrompida': vence 'entregue', depende de o plano novo repetir o id, e a carta cinza ainda na fila segue contando como espera
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1228 com 131-137 e 1156 — no cartão de uma filha, o conjunto das interrompidas sai do painel já passado por panelOf: a filha parada com Esc ou arquivada tem as iniciadas lidas como interrompidas, e as cartas delas ficam cinza no cartão mesmo entregues, enquanto no painel da própria filha seguem verdes (envios.esc-apos-entrega-imediata).
  - task-tree/hooks/agents.ts:190-191 — a tarefa fechada como interrompida pelo fim de um subagente que falhou também deixa cinza a carta já entregue dela.
  - task-tree/hooks/sessions.ts:268 — a carta cinza ainda não tomada mantém o relógio de 1 s ligado.
- **Regra do catálogo:** envios.cor-por-estado; envios.esc-apos-entrega-imediata (a carta segue verde com a tarefa interrompida)
- **Cenário:** Carta na fila; pedido novo com plano de mesmo id: a carta fica cinza 'interrompida' embora a mensagem vá ser entregue e tratada; o relógio continua contando a espera e o alt da tarefa diz 'Aguardando confirmação'; na entrega continua cinza e o modelo lê que a tarefa foi concluída. Com plano de id diferente, a mesma carta fica azul e depois verde. Uma carta entregue há tempo, de tarefa deixada aberta, também fica cinza quando o id é reutilizado.
- **Proposta:** Fixar no catálogo o que cinza quer dizer. Sugestão: o estado da carta segue a mensagem (azul na fila, verde entregue), e o cinza fica para a mensagem que não será entregue (destino arquivado ou inexistente). Ajustar o texto de SESSION.taken para só dizer que concluiu quando concluiu.
- **Ajuste da verificação à proposta:** Mudar o que o cinza quer dizer altera um teste selado e uma decisão registrada: vira pergunta ao usuário (a do achado serve). Sem depender da resposta, cabe corrigir takenNote e SESSION.taken para só dizer que o painel concluiu a tarefa quando concluiu, e alinhar o texto do cenário (diz 'descartada antes da entrega'; o teste afirma 'depois da entrega').
- **Pergunta ao usuário:** A carta de uma tarefa abandonada por um pedido novo deve ficar cinza mesmo depois de entregue (como o teste afirma hoje), ou seguir o estado real da mensagem, azul e depois verde (recomendado)?
- **Decisão já registrada:** regras/envios.md:44-56 (cinza para a carta de plano interrompido, 2026-10-24 e 2026-10-30) e o teste selado task-tree/tests/envios.test.ts:33-52, que afirma cinza depois da entrega
- **Verificação:** O estado da carta olha primeiro se a tarefa hospedeira está interrompida e só depois taken (layout.ts:1273), e a tarefa de pedido anterior só é interrompida quando o plano novo repete o id (tools.ts:62-78). takenNote afirma a conclusão mesmo quando watchSends não fechou nada (tarefa interrompida ou fora do plano).

### O destino da mensagem é casado por nome sem tratar nomes repetidos nem o formato 'nome [ref]'
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/tool-call.ts:118 — o código já trata `to` como nome quando não começa por local_ (é o que casa com o título da tarefa); o kit de testes envia por nome (tests/envios.test.ts:354-355, 385-386).
  - task-tree/hooks/sessions.ts:118-120 — sem linha na lista e sem prefixo local_, o envio é pulado a cada leitura e nunca vira taken.
  - task-tree/hooks/sessions.ts:268 — anyRunning devolve true enquanto houver envio não tomado: o relógio de 1 s não para.
  - task-tree/types/index.d.ts:204 — o campo cut de Send não é gravado em lugar nenhum de hooks/, state/ ou io/: nada encerra um envio que não será entregue.
  - task-tree/.claude-plugin/types/claude-code-mcp/index.d.ts:381 — o app recomenda o id local_ ('the id, not its display name'); o sufixo ' [ref]' vem da descrição do SendMessage para nomes do ListAgents (claude-code-tools/index.d.ts:716-718).
- **Regra do catálogo:** envios.carta-pelo-nome-da-sessao usa o nome do destino para escolher a tarefa; nenhum cenário diz como o destino é resolvido para uma sessão
- **Cenário:** Os nomes das filhas seguem um padrão que se repete entre dias (ex.: 'analise-plano'). Se o modelo envia pelo nome e existe uma sessão arquivada com o mesmo nome: as duas ganham a rodada e o lastAnchor (o cartão arquivado passa a contar sob a tarefa atual e a marcá-la com o ícone de sessão), e watchSends pode conferir o recibo no arquivo da sessão errada (a carta nunca fica verde, ou fica verde pela sessão errada). Se o endereço vier como 'nome [ref]', nada casa: sem rodada, sem cartão sob a tarefa e carta azul sem fim. Com o id local_ nada disso ocorre. Não confirmei quais formas de to o app aceita entre sessões.
- **Proposta:** Resolver to uma vez, no envio, para o id da sessão (id exato; senão o nome entre as não arquivadas; com mais de uma, a de openedAt mais recente; tirar o sufixo ' [ref]') e gravar o id em sends e na rodada. watchSends e settle passam a comparar só por id.
- **Ajuste da verificação à proposta:** Manter a resolução para o id no envio, com quatro acréscimos: (a) o desempate entre nomes repetidos (não arquivada; a de openedAt mais recente) é regra nova e pede cenário no catálogo; (b) prever o envio que não resolve para sessão nenhuma, ou cujo destino está arquivado: hoje fica azul para sempre e mantém o relógio ligado; (c) dizer nas regras de uso (text/rules.ts) que o destino é o id local_, como o app recomenda; (d) confirmar no app se nome e 'nome [ref]' são aceitos entre sessões antes de tratar o sufixo.
- **Verificação:** O código casa por id ou nome nos pontos citados, e com dois nomes iguais as duas sessões ganham a rodada e watchSends pega a primeira linha. Não deu para fechar se o app aceita nome, nome repetido ou 'nome [ref]' entre sessões; o app e as regras do usuário mandam usar o id local_, caso em que nada disso ocorre.

### Mensagem enviada pela ferramenta antiga do app (mcp__ccd_session_mgmt__send_message) não gera carta nem rodada
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:29, 88 e hooks/sessions.ts:85-86 — só valem se a mensagem da ferramenta antiga chegar sem a tag cross-session-message; o código não mostra o formato de chegada ('user turn labelled From …'): essa metade é suspeita, não confirmada.
  - A ferramenta existe nesta instalação: mcp__ccd_session_mgmt__send_message está entre as ferramentas disponíveis da sessão.
- **Regra do catálogo:** envios.carta-sob-a-tarefa e envios.fica-ate-entrega falam de 'mensagem a outra sessão', sem dizer por qual ferramenta
- **Cenário:** O modelo usa mcp__ccd_session_mgmt__send_message para mandar trabalho a uma filha. Nenhuma carta aparece sob a tarefa, nenhum envio é acompanhado (a tarefa não é concluída na entrega, não há aviso de fila), e o cartão do turno que a mensagem abriu é colocado por palpite, podendo ir a outra tarefa ou ao fim do painel.
- **Proposta:** Tratar mcp__ccd_session_mgmt__send_message como SendMessage (campos session_id e message; "parent" resolvido para a sessão que abriu esta) em sentAt e sentMessage, ou dizer nas regras de uso que só SendMessage é acompanhado.
- **Ajuste da verificação à proposta:** 'parent' não tem como ser resolvido hoje: o mod não guarda o id da sessão que abriu esta (mineOf só filtra as filhas). Tratar session_id por id ou nome como o SendMessage e, para 'parent', decidir antes como achar a mãe; no mínimo dizer nas regras de uso que só SendMessage é acompanhado. Conferir o texto do resultado da ferramenta antiga ('delivered', 'queued', '(delivery: …)') contra as expressões de sentMessage antes de reaproveitá-las.
- **Verificação:** sentAt e sentMessage comparam o nome exato 'SendMessage' (tool-call.ts:104, 216), e a ferramenta antiga segue chamável: por ela não há carta, rodada nem acompanhamento da entrega. O app recomenda SendMessage e as regras de uso só falam dele, então é caso de borda.

### Com uma tarefa em andamento, a carta e o cartão vão para a pendente planejada depois dela, não para a tarefa em andamento
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1211-1216 — a regra está documentada com o pedido do usuário que a originou ('o segundo painel de implementacao deveria estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem de solicitação'): com tarefa em andamento, vale a folha aberta sem start planejada depois do início dela. A evidência 'sem decisão do usuário' está errada.
  - task-tree/hooks/panel.ts:182-184 — o comentário do código diz o mesmo ('planned to send, sent with no start').
  - task-tree/tests/envios.test.ts — nenhum teste exercita o ramo: o relógio fica parado entre o start e o plan, e plannedAt nunca passa do startedAt.
- **Regra do catálogo:** sem cenário: envios.ancora-no-lote-recente e envios.sem-andamento-vai-a-pendente-planejada-por-ultimo não cobrem 'uma em andamento e uma folha planejada depois, sem start'
- **Cenário:** No mesmo pedido: start 64.1; plan 64 com os mesmos ids mais 64.5 (estado preservado). Em seguida o modelo manda SendMessage ou abre uma sessão, ainda trabalhando em 64.1: a âncora devolvida é 64.5 (pendente, planejada depois do start de 64.1). A carta e o cartão da filha aparecem sob 64.5; se a mensagem ficou na fila, a entrega conclui 64.5 sozinha; 64.1 fica sem carta. O mesmo para o lançamento de subagente (launchAnchor usa sendAnchor).
- **Proposta:** Limitar o ramo 'planejada depois' ao caso para o qual foi criado: nenhuma tarefa iniciada no turno em curso. Com uma tarefa em andamento (started), ela é a âncora; a pendente só vence quando nada está em andamento (o ramo de cima já cobre). Criar o cenário no catálogo e o teste (start, replano com passo novo, envio: a carta fica sob a tarefa em andamento).
- **Ajuste da verificação à proposta:** O ramo foi criado justamente para o caso COM tarefa em andamento (planejar o passo do envio e enviar sem start). Restringi-lo desfaz um pedido registrado do usuário: vira pergunta, não correção. Independente da resposta, criar o cenário no catálogo e o teste do comportamento vigente (relógio andando entre o start e o replano) e ajustar o texto das regras de uso, que só fala de 'tarefa em andamento'.
- **Pergunta ao usuário:** Com uma tarefa em andamento e um passo novo pendente planejado depois dela, a carta ou o cartão da sessão deve ficar sob a tarefa em andamento (recomendado, é o que as regras dizem ao modelo) ou sob o passo novo, como hoje?
- **Decisão já registrada:** task-tree/DESENVOLVIMENTO.md:1211-1216 e 510 (pedido do usuário citado); comentário em task-tree/hooks/panel.ts:182-184
- **Verificação:** Reproduzi pela leitura: start, replano com passo novo (plannedAt maior que o início) e envio devolvem o passo novo, e a entrega da fila o conclui. É intencional e documentado, mas não tem cenário nem teste e difere do que as regras de uso dizem ao modelo; o código não distingue 'passo planejado para o envio' de 'passo novo qualquer'.

### A mesma carta aparece em todos os cartões de rodada da filha (e, no painel principal, a carta órfã de replano pendura em outro pedido)
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1537-1538 com 750 — no cartão, main.whole são só as tarefas da parte (trimToWork roda depois de split), então allIds é da parte e a carta de outra parte cai em levelOne.
  - task-tree/draw/layout.ts:1256-1261 — levelOne sempre devolve um nível 1 enquanto o painel desenhado tiver algum: vale também para a carta sem âncora.
  - task-tree/hooks/render.tsx:289 — o chip de quem aguarda sessão conta as linhas de carta na fila desenhadas: a carta repetida conta duas vezes.
- **Regra do catálogo:** envios.carta-sob-a-tarefa (A carta de envio é uma linha sob a tarefa de onde a mensagem saiu); pedidos.replano-mantem-envio-ate-entrega
- **Cenário:** Uma filha recebeu duas mensagens da mãe (dois cartões) e mandou um sinal a uma irmã a partir de uma tarefa do segundo cartão. No painel da mãe, a carta 'Para <irmã>: …' aparece sob a tarefa certa no segundo cartão e de novo sob o último nível 1 do primeiro cartão; com a carta na fila, o chip 'aguardando sessão' conta duas. No painel principal, caso menor da mesma causa: carta na fila cuja tarefa saiu num replano, depois um pedido novo que reinicia o trabalho: a carta passa a pender do último nível 1 do pedido novo, não do pedido em que foi enviada.
- **Proposta:** Em split, repartir `sends` como já se faz com `work`, `waits` e `children`: a carta fica na parte que tem a tarefa da âncora (`partOfTask`), senão na parte do turno em que foi enviada. Em levelOne, procurar em `everyTask` (o `whole`) e não devolver nada quando o pedido da carta não está no painel desenhado. Cobrir com teste de filha com duas rodadas e um envio publicado.
- **Ajuste da verificação à proposta:** Repartir sends em split como proposto; received pode seguir inteiro (split e breaks o leem). No painel principal, pedidos.replano-mantem-envio-ate-entrega diz 'nível 1 do pedido': não devolver tarefa de outro pedido está de acordo com a regra, mas falta decidir onde a carta aparece quando o pedido dela saiu do recorte (não desenhar, ou só com '+N pedidos anteriores' aberto).
- **Verificação:** Segui split, trimToWork e letters: sends chega inteiro a cada cartão de rodada e hostOf sempre acha um nível 1 na parte, então a carta se repete em todo cartão da filha que não tem a tarefa de origem. Acontece sempre que a filha tem mais de um cartão e mandou mensagem a outra sessão.

### O nome do destino na carta: irmã e mãe aparecem como 8 caracteres do id no painel próprio e com nome no cartão visto pela mãe
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:46-49 — refreshChildren já tem em mãos as linhas de toda a família ligada (antes do filtro por startedBy), com o nome: a fonte do mapa existe.
  - task-tree/hooks/sessions.ts:85-90 — received guarda só from e at; o nome de quem enviou fica no turno (Turn.from.name, hooks/panel.ts:176).
- **Regra do catálogo:** envios.carta-sob-a-tarefa (A carta de envio é uma linha sob a tarefa de onde a mensagem saiu)
- **Cenário:** Uma filha manda mensagem à irmã ou à mãe pelo id. No painel da filha a carta diz 'Para 1a2b3c4d: …'. No painel da mãe, o cartão da mesma filha mostra 'Para implementacao-x: …' para a irmã (a mãe a tem entre as filhas) e o código hex quando o destino é a própria mãe.
- **Proposta:** Guardar um mapa id → nome com o que já se conhece: as linhas do list_sessions (antes do filtro `startedBy`) e o `from.name` das mensagens recebidas; nameOf consulta o mapa, e a mãe aparece como 'sessão principal' (ou o nome dela).
- **Ajuste da verificação à proposta:** O mapa id → nome é dado novo: se for para o state, precisa de linha na tabela de durabilidade; se for publicado, entra no contrato do arquivo entre versões. No cartão da filha desenhado pela mãe, a própria mãe pode ser reconhecida pelo id próprio que o layout já recebe, sem mapa.
- **Verificação:** nameOf só procura o destino entre as filhas do painel desenhado e as de quem desenha (layout.ts:1263-1268); irmã e mãe caem nos 8 caracteres do id. No fluxo do usuário as filhas mandam sinal às irmãs pelo id local_, então o painel próprio da filha mostra o código.

### Os dois fechamentos automáticos de tarefa (entrega da carta e fim dos subagentes) usam condições diferentes e incompletas
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/sessions.ts:163 — a única condição do fechamento na entrega é a tarefa aberta e sem subtarefa aberta.
  - task-tree/hooks/agents.ts:168 — a sessão viva é só a de c.anchor (onde foi aberta) e só running ou starting: a filha que trabalha ali por rodada (lastAnchor, rounds) ou que espera a pessoa (waiting) não segura a tarefa, embora o cenário diga 'nenhuma sessão filha viva'.
  - task-tree/draw/layout.ts:1311 — fechada a tarefa, o cartão do subagente ainda rodando deixa de ser desenhado.
- **Regra do catálogo:** subagentes.um-rodando-mantem-o-pai; subagentes.pai-conclui-no-fim-do-turno ('nada mais em execução nela'); envios.fica-ate-entrega; envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila
- **Cenário:** a) Tarefa com um subagente rodando e uma carta na fila; a filha toma a carta primeiro: watchSends fecha a tarefa ✓, o x/y anda e o cartão do subagente vivo some; se o subagente falhar depois, a tarefa já está ✓ e não reflete a falha. b) Duas cartas na fila da mesma tarefa para sessões diferentes: a primeira entrega fecha a tarefa. c) Mensagem tomada 5 s depois do envio, com o modelo ainda trabalhando na tarefa: fecha no meio do turno; tomada na hora ('its turn has started'): segue em andamento até o done. d) Tarefa com subagente concluído e uma filha trabalhando nela por mensagem entregue na hora: o fim do turno fecha a tarefa de fato, embora a entrega imediata diga que ela fica até o done.
- **Proposta:** Extrair uma única função 'nada em execução na tarefa' (subagente vivo, sessão viva por âncora de abertura ou da última mensagem, carta na fila, pergunta aberta) e usá-la nos dois fechamentos; na entrega, fechar só quando ela for verdadeira (e, se o turno estiver em curso, deixar para o fim do turno). Testes dos sentidos que faltam.
- **Ajuste da verificação à proposta:** 'Deixar para o fim do turno' muda a conclusão automática decidida: vira pergunta (a do achado). Correção sem pergunta: a entrega não fechar a tarefa com subagente ainda rodando (contraria subagentes.um-rodando-mantem-o-pai) e settleBySubs contar a filha viva por rodada/lastAnchor e a que espera a pessoa. Duas cartas na fila da mesma tarefa: registrar no catálogo se a primeira entrega fecha.
- **Pergunta ao usuário:** Na entrega de uma carta que estava na fila, o painel deve concluir a tarefa só se nada mais estiver em execução nela e o turno já tiver terminado (recomendado), ou sempre, como hoje?
- **Decisão já registrada:** regras/envios.md:7-17 e 131-140: a conclusão na entrega da fila, mesmo com o turno em curso, é decisão ('Sim, conclusão automática como hoje'), anunciada ao modelo em task-tree/text/rules.ts:58-60 e 202-204
- **Verificação:** As duas condições são diferentes como descrito: watchSends não olha subagente, outra carta, pergunta nem turno; settleBySubs olha, mas só a sessão aberta naquela tarefa. O caso do subagente rodando com carta entregue viola subagentes.um-rodando-mantem-o-pai; o fechamento no meio do turno, não: é decisão registrada.

### O casamento "pelo nome da sessão" também é aplicado a textos livres (título da sessão, descrição e tipo do subagente), por qualquer palavra de 4 letras
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:214 — além da palavra, o nome inteiro é procurado como trecho do título (t.includes(name), nome com 3 letras ou mais): um tipo de subagente curto como 'Plan' casa com qualquer título que contenha 'plan' ('Planejar…', 'Replanejar…').
  - task-tree/hooks/panel.ts:231-237 e 250-252 — o nome só decide com várias candidatas (várias em andamento, ou várias pendentes sem nada em andamento); com uma só em andamento não é usado.
- **Regra do catálogo:** envios.carta-pelo-nome-da-sessao; subagentes.cartao-desde-o-lancamento
- **Cenário:** Duas tarefas em andamento, 'Pesquisa web: changelog' e 'Implementação: como ler o código'. O modelo lança um subagente com a descrição 'ver como o hover funciona na web': 'como' casa só com a segunda (ou 'web' teria só 3 letras), e o cartão vai para a tarefa errada, passando à frente da regra do lote recente e da ordem. O mesmo vale para o título de uma sessão nova, que é uma frase. O teste cobre só nomes em kebab no SendMessage; a abertura de sessão por nome e o subagente por descrição não têm teste.
- **Proposta:** Restringir o casamento por palavra a nomes (identificadores sem espaço: `name` da sessão, `to`), e para textos livres exigir o casamento forte (o título contém o nome inteiro ou o nome contém a cabeça do título) ou ao menos duas palavras; descrever no catálogo de onde vêm os 'nomes' em cada caso.
- **Ajuste da verificação à proposta:** Manter o casamento por palavra para o nome da sessão (decisão registrada). Para o título da sessão e para a descrição e o tipo do subagente não há decisão: a restrição proposta é pergunta (a do achado). Incluir na correção o casamento por trecho do tipo do subagente e os testes que faltam (abertura de sessão por nome, subagente por descrição).
- **Pergunta ao usuário:** O casamento por uma palavra deve valer também para a descrição do subagente e para o título da sessão (frases livres), ou só para o nome da sessão (recomendado)?
- **Decisão já registrada:** regras/envios.md:83-93: 'Pelo nome' e 'Sim, por palavra (Recomendado)' (2026-11-09) valem para o nome da sessão destino; regras/subagentes.md:15: o cartão 'segue a regra da carta'. O uso do título da sessão e da descrição e do tipo do subagente como nomes não está registrado.
- **Verificação:** Conferi os chamadores: start_session passa name e title, e os dois lançamentos passam a descrição e o tipo do subagente (tool-call.ts:41, 230; agents.ts:61). namedFor aceita uma única palavra de 4 letras sem lista de palavras comuns, e byName só exige que uma candidata case.

### O cenário do envio "sem nada em andamento" diz "pendente planejada por último", o Reescrito diz "a primeira ainda sem carta", e dois desempates do código não estão escritos
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/README.md:30-31 — a regra geral já existe: decisão nova que muda a regra reescreve o cenário e acrescenta a linha Reescrito; aqui só a linha foi acrescentada.
  - task-tree/hooks/panel.ts:253-259 — entre planos de horas diferentes o título segue certo (vale o lote de plannedAt mais recente); o que mudou foi o desempate dentro do lote (a primeira sem carta; todas com carta, a última).
  - task-tree/hooks/panel.ts:184-187 — o comentário de sendAnchor também cita só a decisão antiga ('ancora na última iniciada do pedido atual').
- **Regra do catálogo:** envios.sem-andamento-vai-a-pendente-planejada-por-ultimo — Sem nada em andamento, o envio vai à pendente planejada por último.
- **Cenário:** Plano com 'Um' e 'Dois' pendentes, nenhum start, um SendMessage sem nome que case: o título e o Então mandam a carta para 'Dois' (a última); a nota do Reescrito, o código e o teste de outro cenário mandam para 'Um'. Com as duas já com carta, o terceiro envio vai para 'Dois' (o código: 'todas com carta, a última'), e sem pendente nem iniciada vai ao último nível 1: nenhum dos dois está no catálogo. O DESENVOLVIMENTO descreve uma terceira regra (última iniciada primeiro).
- **Proposta:** Reescrever o Dado/Quando/Então (e o título) do cenário com a ordem completa: nome; pendentes do plan mais recente, a primeira sem carta; todas com carta, a última; sem pendente, a última iniciada; sem iniciada, o último nível 1. Ligar a ele um teste com duas pendentes e três envios, e alinhar os dois trechos do DESENVOLVIMENTO. Como regra geral do catálogo: Reescrito que muda a regra reescreve o corpo, não só acrescenta a linha.
- **Ajuste da verificação à proposta:** Reescrever o corpo sem mudar a regra: 'pendente planejada por último' segue valendo entre planos; dentro do mesmo plano, a primeira ainda sem carta. Os dois desempates sem registro ('todas com carta, a última'; 'sem iniciada, o último nível 1 do pedido') entram no cenário com a origem. O teste de duas pendentes e três envios entra como teste novo; o teste existente do cenário só muda com selo.
- **Decisão já registrada:** regras/envios.md:77-80 (decisão de 2026-10-23 e Reescrito de 2026-11-09): as decisões existem; o problema é o texto do cenário e do DESENVOLVIMENTO.md
- **Verificação:** O título e o Então dizem 'planejada por último', o Reescrito diz 'a primeira ainda sem carta' e o código faz as duas coisas em níveis diferentes (lote mais recente; dentro dele, a primeira livre). O teste ligado ao cenário tem uma pendente só, e DESENVOLVIMENTO.md:508-509 e 1217-1218 ainda descrevem a regra anterior.

### watchSends marca os envios pelo índice de uma leitura antiga; takenNote e endedNote gravam sem `update`
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tool-call.ts:151-154 e task-tree/hooks/sessions.ts:175 — os envios tomados ficam na lista (os últimos 20): numa sessão longa a lista está sempre cheia e todo envio novo desloca todos os índices
  - task-tree/hooks/sessions.ts:154 — as tarefas a fechar saem da lista antiga, então a tarefa certa fecha mesmo quando a marca cai no envio errado
  - task-tree/hooks/tool-call.ts:226 e 234 — no mesmo hook, refreshStale (com watchSends) termina antes de sentMessage: a corrida só existe contra o poll de 3 s ou outro hook em paralelo
- **Regra do catálogo:** envios.fica-ate-entrega
- **Cenário:** O poll está em watchSends lendo arquivos. O modelo manda outra mensagem da mesma tarefa à mesma sessão, ou replaneja. Os índices mudam e o `taken` cai em outro envio: a carta de uma mensagem ainda na fila fica "entregue", e o lembrete "recebimento confirmado" cita a sessão errada. Ou o set do takenNote passa por cima de uma marca recém-gravada: o recibo já foi gasto e a carta fica "na fila" para sempre, com o relógio do painel ligado, até uma recarga do mod.
- **Proposta:** Identificar o envio por destino, âncora e `at` dentro do fecho do `update`; trocar os set de takenNote e endedNote por `update`; só pôr o recibo em `usedReceipts` depois de a marca estar no state.
- **Ajuste da verificação à proposta:** A proposta está certa e é barata (identificar o envio por destino, âncora e 'at' dentro do update; update em takenNote e endedNote; recibo em usedReceipts só depois da marca gravada). Juntar com a correção do recibo guardado no envio (achado da recarga), que mexe nas mesmas linhas; o harness não simula hooks concorrentes, então o teste possível é de unidade sobre a função de marcação.
- **Verificação:** Os padrões existem como descritos: marcas por índice de uma leitura anterior aos awaits (sessions.ts:105-151), get seguido de set incondicional em takenNote (171-175) e endedNote (220-222), e o recibo gasto antes da marca (136). A janela é curta: precisa de uma entrega detectada no mesmo poll em que outro hook muda a lista (envio novo ou plan) ou grava entre o get e o set; quando acontece, a carta errada fica 'entregue' ou a certa fica na fila para sempre.

### tool.call genérico não tem tratamento: uma falha depois da chamada perde o registro do envio e os lembretes; antes dela, pula a recusa e os avisos
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tool-call.ts:224-231 — num SendMessage só keepTime vem antes de sentMessage; recordStart só roda em start_session.
  - task-tree/hooks/sessions.ts:258-270, 291-302 e task-tree/hooks/panel.ts:62-84, 140-147 — dentro de keepTime, ensureTurn e stamp já têm try/catch; sobram sem proteção só as leituras de $.state.get.
  - task-tree/hooks/register.tsx:34 — o registro do tool.call genérico não tem .catch.
  - Não achei pela leitura uma causa concreta de exceção nesses passos; o risco maior está nos que percorrem painéis publicados por outras sessões (recordStart → refreshChildren → showStatus/total; sessionNotes → endedNote → split), que vêm depois de sentMessage ou só em start_session.
- **Regra do catálogo:** envios.fica-ate-entrega; perguntas.sem-tarefa-recusada (nenhuma cobre a falha do hook)
- **Cenário:** O modelo chama SendMessage. A mensagem sai; na volta, keepTime (um passo só do relógio) lança. O host fica com o resultado da ferramenta e descarta o resto do hook: nenhuma rodada, nenhum envio gravado, nenhum ✉, nenhum aviso de fila. O cartão do turno que a mensagem abriu na filha fica sem tarefa de origem (o layout tenta compensar pelo received da filha). Com start_session, uma falha da releitura das sessões dentro de recordStart derruba os lembretes daquela chamada. Antes de next(e), uma falha em wake, subTool ou launch pula o hook inteiro: a pergunta sem tarefa aberta não é recusada e nenhum aviso de espera é criado.
- **Proposta:** Reordenar o pós-chamada para gravar primeiro o que só existe ali (recordStart sem a releitura, sentMessage) e deixar o relógio, a releitura e os lembretes por último, cada um em bloco com try/catch e debug(). Antes de next(e), isolar wake, subTool e launch do mesmo jeito, para que uma falha num passo de cartão não desligue a recusa e os avisos.
- **Ajuste da verificação à proposta:** Vale como endurecimento. Ao isolar os passos de antes de next(e), manter a recusa da pergunta sem tarefa fora do alcance da falha, ou dar .catch ao registro como o kit sugere (recusa quando next ainda não foi chamado). O harness não simula falha de $.state sem stub: prever o teste com um stub que lança, ou deixar como item de checklist.
- **Verificação:** toolCall não tem try de topo e o registro não tem .catch; pelo contrato do kit, a falha depois de next(e) deixa valer o resultado da ferramenta e descarta sentMessage e os lembretes, e antes dele a ferramenta roda sem a recusa. A estrutura é como o achado diz; falta uma causa real de falha, por isso a severidade baixa.

### O estado da carta sai de palavras do resultado do SendMessage; resultado desconhecido vira 'entregue' e não há cenário para falha
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:105, 139-149` — Fila = o texto contém 'queued', 'held' ou 'pending' e não contém 'turn has started'; falha = `isError` ou 'success: false'; todo o resto é gravado como entregue e tomado.
  - `task-tree/tests/kit/ambiente.ts:158-166` — O kit só conhece dois textos de resultado.
  - `regras/envios.md:1-140` — Nenhum cenário diz o que o painel mostra quando o SendMessage falha ou responde outra coisa.
- **Regra do catálogo:** sem cenário
- **Cenário:** O app responde com um texto fora dos dois conhecidos (sessão arquivada, aguardando permissão, mensagem guardada) sem `isError`: a carta nasce verde 'entregue' e nunca é conferida contra o recibo. Um texto de sucesso que traga 'pending' ou 'queued' no nome da sessão ou na mensagem ecoada põe a carta na fila sem motivo. Sem `r.result`, o texto examinado é o resultado inteiro, com o contexto que outros plugins acrescentaram.
- **Proposta:** Tratar como entregue só o que diz 'turn has started'; o resto que não é falha fica na fila e é confirmado pelo recibo publicado (que já existe). Escrever no catálogo o cenário de falha (sem carta, sem rodada) e fixar os textos conhecidos num fixture.

### Duas mensagens da mesma tarefa à mesma sessão são um registro só: a primeira entrega pinta de verde o texto da segunda e fecha a tarefa
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:151-154` — O envio novo substitui o de mesma (`to`, `anchor`), com `at` e texto novos.
  - `task-tree/draw/layout.ts:1250-1253, 1276` — Uma linha por (sessão, tarefa); a chave da linha é `m:<to>:<anchor>`.
  - `task-tree/hooks/sessions.ts:123-139` — O registro único casa com o primeiro recibo posterior ao segundo envio.
- **Regra do catálogo:** envios.carta-sob-a-tarefa (não cobre duas mensagens da mesma tarefa)
- **Cenário:** Da mesma tarefa saem duas mensagens à mesma filha ocupada. O painel mostra uma carta só, com o texto da segunda. A filha pega a primeira: a carta fica verde 'entregue' com o texto da segunda (ainda na fila) e a tarefa é concluída.
- **Proposta:** Decidir e registrar: ou uma linha por mensagem (chave com `at`), cada uma confirmada pelo seu recibo, ou manter uma linha por tarefa e sessão mas só dá-la por entregue quando todos os envios daquela dupla tiverem recibo (contador no registro).

### 'Nunca à tarefa com pergunta aberta' não vale quando ela é a única em andamento, ou a iniciada por último com as outras já usadas
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/panel.ts:228-245` — `asking` só é descontado nos ramos de 'uma livre entre várias' e 'várias livres'; fora deles a âncora é `current(list).anchor`, a iniciada por último, sem olhar `asking`.
  - `task-tree/hooks/tool-call.ts:79-88` — A espera de um wrap_up com pergunta fica aberta depois do fim do turno.
  - `task-tree/hooks/prompt-submit.ts:66-82` — Um aviso do app ou uma volta de subagente não tira essa espera (só um pedido novo tira).
  - `regras/envios.md:58-63` — '…nunca à que tem pergunta aberta'.
- **Regra do catálogo:** envios.ancora-no-lote-recente (O envio vai ao lote recente de starts sem envio)
- **Cenário:** O turno termina com wrap_up e pergunta, sob a única tarefa em andamento. Chega o aviso de que uma filha terminou e o modelo manda o sinal à filha seguinte: a carta vai para a tarefa da pergunta. O mesmo com três em andamento, duas já com carta e a terceira (iniciada por último) com a pergunta.
- **Proposta:** No ramo final de sendAnchor, se a âncora de `current` está em `asking`, usar a regra do caso sem andamento (pendente por nome ou ordem, senão última iniciada que não pergunta). Ou ajustar o texto do cenário para 'havendo outra candidata'.

### Recibo de uma mensagem entregue na hora pode confirmar a mensagem seguinte, ainda na fila
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:141-154` — A entrega imediata grava o envio já `taken`; a hora do envio (`sentAt`) é lida antes da chamada.
  - `task-tree/hooks/sessions.ts:116-117, 125-138` — Só os envios não tomados consomem recibos; vale qualquer recibo desta sessão com `at` maior ou igual ao do envio e ainda não usado.
  - `task-tree/hooks/sessions.ts:85-92` — O `at` do recibo é a hora em que o prompt.submit da sessão destino rodou, em outro processo.
- **Regra do catálogo:** envios.entrega-imediata-fica-verde (A entrega imediata aparece entregue na hora, e a tarefa segue em andamento até o done)
- **Cenário:** A mãe manda duas mensagens seguidas a uma filha parada. A primeira volta "its turn has started"; a segunda fica na fila, com `at` = T1. O hook da filha carimba o recibo da primeira depois de T1 (o processo dela começou o turno depois). No poll seguinte esse recibo casa com o segundo envio: carta "entregue", tarefa fechada pelo painel e lembrete "recebimento confirmado", com a mensagem ainda na fila.
- **Proposta:** Casar em ordem todos os envios à sessão, inclusive os entregues na hora (cada um gasta o seu recibo), ou guardar no envio quantos recibos desta sessão o destino já publicava no momento do envio.

### Tetos de 20 (envios, rodadas, recebidas, lançamentos) cortam por posição, sem olhar o estado, e a documentação diz outra coisa
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:130-136, 149-155` — rounds e sends recebem slice(-20) a cada envio: sai o mais antigo, mesmo que seja uma carta ainda na fila.
  - `task-tree/hooks/sessions.ts:90, 173-176` — received e sends (em takenNote) também são cortados nos 20 últimos, por posição.
  - `task-tree/draw/layout.ts:186-192, 333-336` — Uma rodada que saiu dos 20 não é recuperada (só recebidas depois de rounds[0]); os turnos dela caem na parte 0, o cartão de abertura, sob outra tarefa.
  - `task-tree/draw/layout.ts:1532-1535` — "It never moves a card": a regra do painel que o corte de rodadas contraria para o cartão mais antigo.
  - `task-tree/state/durability.ts:59-64` — A tabela diz que sends são "not yet taken up" e sem keep; received e launches têm keep 20; rounds não aparece.
  - `task-tree/io/publish.ts:100-103, 146, 179` — O comentário diz que os envios tomados são descartados na publicação, mas o código publica todos (o cartão da filha depende deles para as cartas verdes). DESENVOLVIMENTO.md linha 268 repete "só os não tomados".
- **Regra do catálogo:** envios.fica-ate-entrega (O ✉ fica na tarefa até a entrega)
- **Cenário:** (a) Uma orquestradora manda 20 mensagens enquanto a primeira segue na fila (destino ocupado ou esperando a pessoa por horas): o registro da primeira sai da lista, a carta ✉ some, a tarefa deixa de ser poupada no fim do turno e nunca fecha sozinha na entrega. (b) Uma filha recebe a 21ª mensagem: o cartão da primeira rodada funde no cartão de abertura, sob a tarefa onde a sessão foi aberta: um cartão antigo muda de lugar.
- **Proposta:** Cortar só os envios já tomados e avisados (os da fila nunca saem). Para rodadas, guardar a âncora da rodada descartada como âncora da parte 0 ou marcar as rodadas antigas como histórico. Acertar a linha de sends e incluir rounds na tabela de durabilidade, e corrigir o comentário de publish.ts e a linha do DESENVOLVIMENTO.

## Subagentes

19 achados: 4 de severidade alta, 10 média, 5 baixa.

### Plano novo que reusa um id não renomeia a âncora dos grupos de subagente: cartões antigos caem sob a tarefa nova e ela fecha ✓ sozinha no fim do turno
- **Categoria:** omissão · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:56, 76 — o rename vale para a subárvore ('tag:1/1.2' também); a âncora do grupo segue '1/1.2'.
  - task-tree/hooks/tools.ts:81, 103-105 — no replano de um subagente as tarefas dele também são renomeadas e renameAnchors nem é chamada: os grupos dos subagentes que ele lançou ficam com a âncora antiga.
  - task-tree/hooks/panel.ts:234 e 258 — no ramo de várias em andamento o uso é conferido contra o startedAt (o lançamento antigo não conta); no ramo das pendentes não há conferência de tempo.
  - task-tree/hooks/agents.ts:177, 188 — a tarefa nova é fechada com a hora do fim do subagente antigo, anterior ao próprio plano dela.
  - task-tree/DESENVOLVIMENTO.md:366-375 — a documentação de renameAnchors lista children, launches, sends e keptLinks; os grupos de subagente ficaram de fora.
- **Regra do catálogo:** subagentes.pai-conclui-no-fim-do-turno; subagentes.cartao-desde-o-lancamento (o cartão fica sob a tarefa de onde saiu)
- **Cenário:** Pedido A: plan [{id:'1', 'Investigar'}], start, um subagente é lançado dela e termina; a tarefa fecha. Pedido B: plan [{id:'1', 'Corrigir'}, {id:'2', …}] (os ids 1, 2, 3 se repetem a cada pedido, como as regras permitem). A antiga vira "xxxx:1", mas o grupo do subagente segue com anchor '1'. O painel mostra o cartão "concluído" do pedido A sob "Corrigir". Se o turno B termina normalmente com "Corrigir" ainda aberta (parou para perguntar, espera algo), settleBySubs a fecha ✓ com o fim do subagente antigo: tarefa não feita aparece concluída e sai dos lembretes de abertas.
- **Proposta:** Em renameAnchors (ou no change do planTool), renomear também Group.anchor dos grupos cujo anchor é um id renomeado ou começa com id + '/'. Como defesa, settleBySubs e usedAnchors devem ignorar subagente com sub.at anterior ao plannedAt da folha. Teste: dois pedidos reusando o id, com subagente no primeiro.
- **Ajuste da verificação à proposta:** Renomear a âncora só nos grupos lançados pelo laço que replanejou (parent igual ao agente do plan), inclusive no replano de um subagente. A defesa por tempo (lançamento anterior ao plannedAt da folha) deve valer também no desenho e para os dados já gravados com a âncora antiga, como resolveAnchor faz para as sessões.
- **Verificação:** renameAnchors não toca em groups[].anchor, e desde o cartão no lançamento todo subagente tem grupo com âncora. Com ids repetidos entre pedidos ('1', '2', '3'), o cartão antigo é desenhado sob a tarefa nova e settleBySubs a fecha no fim do turno se ela ficar aberta: tarefa não feita aparece concluída.

### O cartão do subagente some quando a tarefa-âncora fecha (o da sessão e a carta ficam)
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1293-1296 — o comentário do código diz que o grupo do subagente fica escondido com a tarefa quando ela fecha: regra de antes do cartão desde o lançamento, não revista.
  - Dados reais relidos agora (só contagens): em 8 dos 9 arquivos publicados com subagentes, todos os cartões estão sob tarefa já fechada, ou seja, nenhum é desenhado.
  - ../claude-code-mod-task-tree-notas/analise-pai-reflete-subagente.local.md:143-144 — a análise previa o teste afirmando o cartão 'concluído' depois do fim do turno; a asserção não entrou no teste.
- **Regra do catálogo:** subagentes.pai-conclui-no-fim-do-turno; subagentes.terminado-segue-cartao; subagentes.cartao-desde-o-lancamento
- **Cenário:** (1) Modelo: start na tarefa, lança um Explore, o subagente termina, o turno termina. `settleBySubs` fecha a tarefa ✓ e o cartão "concluído" desaparece do painel no mesmo instante. (2) Mesmo fluxo com `done` do modelo logo após o hand-back (o que o lembrete PROMPT.handback pede): o cartão some na hora. (3) Subagente em segundo plano: o modelo dá `done` na tarefa e segue; o cartão "em segundo plano" some com o agente ainda rodando, e a pílula "N subagentes" (soma de `Row.subs` das linhas desenhadas) deixa de contá-lo. (4) Pedido sem plano depois de um pedido todo concluído: o lançamento é ancorado na última tarefa iniciada (fechada) e o cartão nunca aparece. Nos quatro casos, um cartão de sessão ou uma carta na mesma tarefa continuariam desenhados.
- **Proposta:** Em `below` (draw/layout.ts), desenhar `drawKids(kids.filter(k => k.anchor === t.id))` sem a condição `t.status === 'open'`, como já é feito para `letters` e `session`. Para não reintroduzir histórico infinito, manter a saída pelo recorte que já existe (`trimToWork` tira o grupo quando a âncora sai do trabalho). Acrescentar ao teste de `subagentes.pai-conclui-no-fim-do-turno` a asserção de que a linha do cartão segue sob a tarefa ✓, e um cenário para o lançamento com tudo fechado.
- **Ajuste da verificação à proposta:** Corrigir junto com as âncoras de grupo que o plano não renomeia e com o cartão vivo que nunca termina: sem isso, cartões de pedidos antigos passam a aparecer sob a tarefa nova de mesmo id e os vivos órfãos ficam à vista para sempre. É mudança de desenho: se algum cenário do golden do SVG tiver subagente sob tarefa fechada, o commit espera a validação do usuário no app.
- **Decisão já registrada:** regras/subagentes.md:39-48 ('Fecha ao terminar' não escolhido: o cartão fica) e 92-101 ('o cartão segue concluído e fora da contagem' depois de a tarefa fechar sozinha): a decisão registrada é a favor da proposta
- **Verificação:** below só desenha os grupos de subagente com a tarefa aberta, e lost não pega o que está sob âncora fechada e à vista: o cartão some no instante em que a tarefa fecha, inclusive quando é o próprio painel que a fecha no fim do turno. Contraria o Então de subagentes.pai-conclui-no-fim-do-turno e subagentes.terminado-segue-cartao.

### settleBySubs considera subagentes de turnos anteriores: tarefa reaberta ou deixada aguardando é fechada pelo fim de um subagente antigo
- **Categoria:** omissão · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - Caminho mais comum, que o achado não citou: task-tree/hooks/panel.ts:643-657 — renameAnchors renomeia as âncoras de children, launches, sends e keptLinks, mas não Group.anchor dos subagentes; task-tree/hooks/tools.ts:54-56, 67, 76-80, 103-105 — um plano novo que reutiliza o id de um nível 1 fechado renomeia a tarefa antiga para 'tag:id'. O grupo do subagente antigo segue com anchor = id e passa a apontar para a tarefa NOVA de mesmo id.
  - task-tree/hooks/agents.ts:171-175 — a folha elegível é qualquer folha 'open', iniciada ou pendente: no fim do turno seguinte, a tarefa nova ainda pendente (ou deixada ◷) é fechada ✓ (ou ✕ 'falhou') pelo subagente do pedido anterior
  - task-tree/draw/layout.ts:1311 — o cartão antigo também é desenhado embaixo da tarefa nova enquanto ela está aberta
  - task-tree/state/tasks.ts:101-106 — begin não limpa 'failed': uma tarefa que foi ✕ 'falhou', reaberta e depois interrompida por outro motivo volta a dizer 'falhou' (layout.ts:1047)
- **Regra do catálogo:** Também pedidos (o plano que reutiliza id renomeia o antigo, regras/pedidos.md:75) e turnos.pendentes-seguem-pendentes: a pendente do pedido novo é fechada sozinha.
- **Cenário:** Turno 1: tarefa 1 com subagente concluído; fim do turno, 1 fica ✓. Turno 2: o usuário pede um complemento, o modelo reabre 1 com start, trabalha sozinho e termina o turno com 1 aberta de propósito (esperando resposta): em vez de ◷ 'Aguardando', a tarefa é fechada ✓ pelo subagente do turno 1, com fim anterior ao início (o tempo sai '—'). Variante: o subagente do turno 1 falhou (✕ 'falhou'); no turno 2 o modelo reabre e relança com sucesso, sem done: a tarefa volta a ✕ 'falhou' por causa do antigo. Variante Esc: subagente interrompido num turno parado fecha a tarefa como ✕ só no fim de um turno posterior.
- **Proposta:** Em `settleBySubs`, contar só os subagentes lançados desde o último início da tarefa (`s.at >= (leaf.startedAt ?? leaf.plannedAt)`), ou marcar no `Sub` que ele já foi refletido (`settled: true`) e ignorá-lo depois. Teste: reabrir com start depois do fechamento automático e terminar o turno com a tarefa aberta.
- **Ajuste da verificação à proposta:** Filtrar por sub.end >= (leaf.startedAt ?? leaf.plannedAt), não por sub.at (lançar da pendente e dar start depois é um caminho válido e deixaria de fechar). Além do filtro, renameAnchors precisa renomear Group.anchor dos subagentes junto com a tarefa (como já faz com sessões, envios e lançamentos), senão o cartão antigo continua sendo desenhado sob a tarefa nova. Teste: dois pedidos com os mesmos ids, subagente no primeiro, tarefa pendente no segundo, fim do turno; e o da proposta (reabrir com start).
- **Verificação:** Confirmei pela leitura os três cenários do achado (reabrir com start, falha antiga que volta, Esc que vira ✕ num turno posterior): settleBySubs não compara tempo nenhum. Lendo renameAnchors e planTool achei um caminho mais comum que o do achado: como os planos reutilizam ids entre pedidos, o cartão de subagente de um pedido anterior passa a pertencer à tarefa nova de mesmo id e a fecha no fim do turno; por isso subo para alta. Não executei testes (só leitura).

### Subagentes lançados em paralelo não se enxergam: o cartão de grupo não se forma
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - Dados reais relidos agora (só contagens e tempos relativos): numa sessão, 4 subagentes lançados da mesma tarefa em 45 ms têm 4 lotes diferentes (nenhum cartão de grupo); em outra, 10 lançados da mesma tarefa em 850 ms caíram em 3 lotes (7, 2 e 1): um cartão de grupo com 7 e 3 cartões soltos. A corrida é intermitente, não total: a afirmação 'nenhum achou companheiro' já não vale para todos os arquivos.
  - task-tree/hooks/tool-call.ts:37-43 — o registro do lançamento no tool.call calcula a âncora à parte, com a mesma leitura velha.
- **Regra do catálogo:** subagentes.varios-juntos-num-cartao-de-grupo (Workflow, ou mais de três subagentes lançados juntos, ficam num cartão de grupo)
- **Cenário:** O modelo chama Agent 4 vezes na mesma mensagem, a partir de uma tarefa. Os quatro hooks leem `groups` antes de o grupo de qualquer outro ser gravado; cada um grava o próprio `now` como lote. O painel mostra 4 cartões soltos em vez de "4 subagentes". O mesmo vale para a âncora: lida da mesma foto velha, depende de milissegundos se os lançamentos se espalham pelas tarefas ou ficam na mesma.
- **Proposta:** Decidir o lote dentro do fecho do `change` (sobre o `all` atual, que o `update` repete em conflito), ou tirar `batch` do state e agrupar no desenho os subagentes do mesmo pai e âncora cujo `at` dista até BATCH do vizinho. Acrescentar um teste com lançamentos em `Promise.all` e relógio andando.
- **Ajuste da verificação à proposta:** Das duas saídas, agrupar no desenho (mesmo pai e âncora, lançamentos a até BATCH um do outro) corrige também os dados já gravados e os cartões de filhas publicados por versões anteriores; decidir o lote dentro do change só corrige os lançamentos novos. Para a âncora com várias tarefas em andamento, o cálculo também precisa ir para dentro do change (ou ser feito em série), senão os lançamentos paralelos seguem indo todos à primeira tarefa livre.
- **Verificação:** agentSpawn lê os grupos uma vez depois de next(e), faz mais awaits e só então grava o grupo com o lote calculado fora do change: lançamentos da mesma mensagem não se veem. Os arquivos publicados mostram lotes diferentes para lançamentos a milissegundos um do outro, e o teste lança em série com o relógio parado.

### Subagente fica "trabalhando" ou "em segundo plano" para sempre quando o fim dele não chega
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - Dados reais relidos agora (só contagens): 2 dos 9 arquivos publicados com subagentes têm um cartão em 'background' sem fim, lançado há 10,9 h e 23,2 h, com o arquivo parado há 8,3 h e 10,2 h.
  - task-tree/draw/layout.ts:1311 — nos dois casos reais a tarefa-âncora já está fechada, então o cartão vivo nem é desenhado: o defeito está no state e aparece quando a âncora está aberta, ou assim que o sumiço do cartão sob tarefa fechada for corrigido.
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:3384-3389 — $.agent.list() não lista os agentes de workflow e solta a linha do subagente algum tempo depois do fim.
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:356-357 — a nova tentativa de um agente de workflow travado não gera outro agent.spawn.
- **Regra do catálogo:** subagentes.cartao-mostra-modelo-e-estado; subagentes.um-rodando-mantem-o-pai (o cartão vivo para sempre impede a tarefa de fechar sozinha); não há cenário de subagente depois de reinício em regras/durabilidade.md nem em regras/subagentes.md
- **Cenário:** A sessão lança um subagente em segundo plano. O processo reinicia (/model, reinício do app, resume, queda do worker), ou o fim dele nunca é entregue (tarefa parada, tentativa de workflow travada: o kit diz que a nova tentativa não gera outro agent.spawn). O painel volta do store com o cartão "em segundo plano": ele fica no fim da lista com o tempo crescendo a cada desenho, a pílula conta 1 subagente, a tarefa de origem não fecha sozinha, e a sessão mãe mostra o mesmo dentro do cartão da filha.
- **Proposta:** (1) Em keptGroups, cartão vivo que volta do store vira "interrompido" com `end` no último tempo conhecido. (2) Conferir os cartões vivos contra `$.agent.list()` (campo `status`) no poll ou no fim do turno do loop principal: agente não listado ou não rodando encerra o cartão. (3) Criar no catálogo o cenário do subagente em segundo plano com reinício (a análise antiga previa `subagentes.segundo-plano`, que não entrou).
- **Ajuste da verificação à proposta:** (1) keptGroups também atende a volta do worker de hooks (ensureGroups, primeiro uso), em que os subagentes seguem rodando no motor: marcar interrompido só depois de conferir com $.agent.list(), não em toda volta do store. (2) A conferência pela lista não vale para agentes de workflow (não são listados): para eles usar outro critério (fim do run, ou tempo sem chamadas). (3) Corrigir junto com o cartão que some sob tarefa fechada, senão os cartões vivos órfãos passam a aparecer para sempre.
- **Verificação:** subEnd é o único fim do cartão e keptGroups devolve sub como estava; settleBySubs pula a tarefa enquanto houver subagente vivo. Os dados reais confirmam cartões vivos sem fim, mas hoje escondidos por estarem sob tarefa fechada: por isso media, subindo para alta se o cartão passar a ser desenhado sob tarefa fechada.

### Cada chamada de ferramenta de subagente com texto diferente regrava o painel inteiro (state, store, arquivo) antes de a ferramenta rodar; o freio de 1 s só vale para texto repetido e é por subagente
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/agents.ts:129-130 — o comentário junto do código já diz 'The first call, a new tool, or a second gone by: written': a contradição é entre este e o das linhas 28-29 ('at most once every THROTTLE ms per subagent'), dentro do mesmo arquivo
  - task-tree/hooks/panel.ts:359-366 — change também roda ensureGroups, ensureWork e adopt (mais leituras de state) antes do update
  - task-tree/state/durability.ts:171-178 — saveGroups: store.set dos grupos, store.get e store.set da lista de sessões (e deletes acima de KEEP)
  - task-tree/io/publish.ts:148-181 — a chave de comparação inclui groups; como sub.tool mudou, o arquivo inteiro é regravado em toda chamada com texto novo
- **Regra do catálogo:** subagentes.corpo-e-as-tarefas-ou-a-ferramenta (Com tarefas, o cartão mostra as tarefas dele; sem tarefas, a ferramenta em uso)
- **Cenário:** Um workflow com 30 agentes, cada um lendo arquivos diferentes: cada Read, Grep ou Bash muda o texto do cartão e dispara gravação dos grupos no state, store.set dos grupos, serialização do painel inteiro e regravação do arquivo publicado (centenas de KB numa orquestradora longa), mais um redesenho. São dezenas de gravações completas por segundo, e a chamada de cada subagente espera a sua. A sessão mãe relê esse arquivo a cada 3 s e também regrava o seu. O efeito visível (lentidão, cliques perdidos no redesenho) não foi medido.
- **Proposta:** Tornar o freio global e por tempo: guardar a ferramenta e a contagem em variável de módulo e gravar no máximo uma vez por segundo para todos os subagentes juntos (um só change), sem bloquear a chamada (não aguardar a gravação antes do next). Separar o que é efêmero (ferramenta em uso, contagem, toks/s) do que precisa de store.
- **Ajuste da verificação à proposta:** Se a gravação deixar de ser aguardada antes do next(e), a checagem do estado tem de ir para dentro da função do update (só grava tool/calls se o sub ainda está running/background), senão uma gravação atrasada pode repor 'tool' num subagente que o subEnd já fechou. O teste coberto (subagentes.test.ts:36-51) avança 1500 ms entre as chamadas e continua válido com freio por tempo.
- **Verificação:** Li subTool, setSub, change, persist, saveGroups e publishWait: a única guarda é texto igual E menos de 1 s; como toolText leva arquivo, padrão ou comando, quase toda chamada grava state, store e arquivo publicado, e toolCall aguarda isso antes de next(e). O custo real por gravação não foi medido (o próprio achado diz), por isso media.

### settleBySubs: os dois gatilhos têm guardas diferentes e não há guarda de tempo (tarefa reaberta fecha de novo; depois de Esc um subagente tardio fecha tudo)
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/turn.ts:142 — turnEnded é gravado em todo fim de turno do loop principal, também o abortado; por isso o gatilho de agents.ts:147 dispara depois de um Esc
  - task-tree/draw/layout.ts:53-67, 960 — o ✕ do Esc é só do desenho (halt); no state a folha segue 'open', e é isso que settleBySubs fecha como done
  - Observação de ordem: no Esc, um subagente em primeiro plano abortado cujo turn.complete chegue depois do do loop principal grava a tarefa como 'interrupted' de fato (subEnd -> settleBySubs); se chegar antes, nada é gravado. O resultado depende da ordem dos eventos do app.
- **Regra do catálogo:** Também turnos.esc-interrompe-so-a-iniciada (a iniciada fica ✕ no Esc): o fechamento tardio troca esse ✕ por ✓ sem ação de ninguém.
- **Cenário:** (1) Tarefa "1" com subagente terminado; turno encerra, painel fecha "1" ✓. No pedido seguinte o modelo reabre "1" com start, trabalha nela sem subagente e encerra o turno deixando-a aberta para o usuário validar: em vez de ◷ "Aguardando", o painel a fecha ✓ de novo, por causa do subagente antigo. (2) O usuário dá Esc com "1" (subagente terminado) e "2" (subagente em segundo plano) iniciadas: nada fecha, as duas ficam ✕. Quando o subagente de "2" termina, a varredura fecha "1" e "2" como ✓ no state: o painel troca ✕ por ✓ sem nenhuma ação.
- **Proposta:** Em `settleBySubs`, considerar só subagentes com `sub.end >= (leaf.startedAt ?? leaf.plannedAt)` e, no gatilho de `subEnd`, restringir à âncora do subagente que terminou. Decidir o caso do Esc e alinhar os dois gatilhos (mesma condição de `turnAborted`).
- **Ajuste da verificação à proposta:** O filtro por tempo deve usar o fim do subagente (sub.end >= leaf.startedAt ?? leaf.plannedAt), como a proposta diz, e não sub.at: com sub.at, lançar da pendente e dar start depois deixaria de fechar. Restringir o gatilho do subEnd à âncora do subagente que terminou é seguro (a carta entregue já fecha a tarefa dela em watchSends). O caso do Esc precisa da pergunta, como proposto. Este achado e o 4 são o mesmo defeito (sem guarda de tempo): tratar juntos.
- **Pergunta ao usuário:** Depois de um Esc, quando o último subagente de uma tarefa termina, o painel deve fechá-la sozinho (como no fim normal) ou deixá-la como o Esc deixou? Recomendo não fechar depois de Esc: a próxima mensagem já pede o replano.
- **Verificação:** Reproduzi os dois cenários pela leitura: (1) start numa tarefa já fechada por subagente a reabre (begin) e o fim normal do turno seguinte a fecha de novo pelo subagente antigo; (2) depois do Esc turnEnded é número e turnAborted não é consultado em subEnd, então o fim de qualquer subagente tardio varre todas as folhas e fecha como ✓ as que o Esc tinha desenhado ✕. Não achei guarda que anule.

### Subagente retomado ou acordado por mensagem: o primeiro fim de turno é tratado como fim definitivo e o cartão não volta a 'trabalhando'
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/turn.ts:68-69 e agents.ts:135 — os comentários assumem 'A subagent's turn ending is its end'; só o teammate é poupado
  - task-tree/hooks/agents.ts:139-141 — subEnd apaga a contagem (calls.delete): na retomada ela recomeça do zero
  - task-tree/hooks/agents.ts:175 — settleBySubs só segura a tarefa com sub.state running/background: um subagente retomado (state 'done' velho) trabalhando em segundo plano não segura a tarefa de origem
  - task-tree/draw/layout.ts:1311 — os cartões só são desenhados sob tarefa 'open': com a origem já ✓, o cartão do subagente retomado nem aparece (o cenário diz que ele segue 'concluído'; ele some)
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:556-565 — AgentStatus: 'a message may yet resume one, under the same id'
- **Regra do catálogo:** Também subagentes.um-rodando-mantem-o-pai: com o subagente retomado trabalhando e o state 'done' antigo, a tarefa de origem fecha no fim do turno.
- **Cenário:** Um subagente termina a primeira execução com tarefas abertas no grupo: elas ficam ✕, o cartão diz 'concluído' e, no fim do turno, a tarefa de origem fecha. O modelo retoma o mesmo subagente (resume, ou mensagem a ele, por exemplo para continuar depois de um Esc): ele trabalha de novo, mas o cartão segue 'concluído' (ou 'interrompido'), sem ferramenta em uso, fora da pílula, com as tarefas ✕; a tarefa de origem pode já estar ✓.
- **Proposta:** Tratar a retomada: em agentSpawn com e.resume (ou num hook de turn.start com agentId já conhecido), voltar sub.state a 'running', limpar end e reabrir a contagem; decidir o que fazer com as tarefas ✕ do grupo (reabrem só com start) e com a tarefa de origem já fechada. Cenário novo em regras/subagentes.md.
- **Ajuste da verificação à proposta:** Na retomada usar o id de e.resume.agentId (o mesmo que next devolve) e continuar a contagem a partir de sub.calls. Definir também o que acontece quando a origem já fechou (hoje o cartão não é desenhado sob tarefa fechada). Cenário novo no catálogo; o comportamento da retomada no app real vai para o checklist.
- **Verificação:** O código confirma: agentSpawn sai em e.resume, subTool ignora quem não está running/background e todo turn.complete de subagente não-teammate vira fim definitivo. Que a retomada chega com o mesmo agentId e um turn.complete por execução está nos tipos do kit (e a própria ferramenta Agent manda continuar um agente por SendMessage), então o fluxo existe e não está mapeado.

### Relançar um subagente depois de uma falha deixa a tarefa ✕ "falhou", mesmo com a nova tentativa concluída
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - `task-tree/hooks/agents.ts:171-178` — O fim da tarefa é o pior entre todos os subagentes ancorados nela, de qualquer momento; não há noção de tentativa substituída.
  - `regras/subagentes.md:103-112` — A regra do 'pior' está registrada como derivada, não como palavras do usuário.
  - `task-tree/hooks/tools.ts:147-152` — Um done posterior numa tarefa interrompida só devolve o aviso 'foi interrompida'; o modelo precisa de start para reabrir.
  - `task-tree/tests/subagentes.test.ts:257-281` — O teste do misto lança os dois juntos; não há o caso de falha seguida de nova tentativa.
  - `regras/subagentes.md:103-112` — A regra do pior fim é 'derivada das respostas acima', não palavras do usuário; as palavras dele falam de um subagente ('interrompido se é interrompido, falha se ele falhou').
  - `task-tree/hooks/agents.ts:176` — `failed` se qualquer um falhou, senão `interrupted` se qualquer um foi interrompido, sem olhar a ordem no tempo.
- **Regra do catálogo:** subagentes.pai-reflete-falha-ou-interrupcao ("com fins mistos vale o pior ..., derivado das respostas acima")
- **Cenário:** start em 'Investigar'; o subagente falha (erro de API ou recusa); o modelo vê a falha e lança outro da mesma tarefa, que conclui; o turno termina sem done (ou o segundo roda em segundo plano e termina depois). O painel fecha 'Investigar' como ✕ 'falhou', embora o trabalho tenha sido concluído; o done seguinte do modelo recebe 'foi interrompida'.
- **Proposta:** Definir a regra para tentativas em sequência: considerar só o último lote lançado da tarefa (por `batch`), ou só os subagentes lançados depois da última falha. Cenário e teste novos.
- **Ajuste da verificação à proposta:** Mudar 'vale o pior' para tentativas em sequência altera uma regra coberta: tem de virar pergunta (a proposta já traz) e, com a resposta, 'Reescrito' no cenário e teste novo, sem mexer no teste 'misto' selado. Se valer a última tentativa, 'batch' serve (tentativa lançada mais de 3 s depois tem lote novo), mas agentes de workflow não têm lote comum: ordenar por sub.at.
- **Pergunta ao usuário:** Quando um subagente falha e o modelo lança outro da mesma tarefa, que conclui, a tarefa deve ficar ✓ (vale a última tentativa, recomendado) ou ✕ 'falhou' (vale o pior de todos)?
- **Verificação:** agents.ts:176 escolhe 'failed' se qualquer subagente ancorado na folha falhou, sem ordem no tempo: falha seguida de nova tentativa concluída, sem done do modelo antes do fim do turno, fecha a tarefa ✕ 'falhou', e o done seguinte recebe 'foi interrompida' (tools.ts:151). O código segue o catálogo como está escrito; o caso da nova tentativa é que não foi decidido.

### As tarefas de um subagente contam no cabeçalho só enquanto o cartão dele está desenhado, e nunca na linha da tarefa ou do pedido
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1311 — quando a tarefa de origem fecha, o cartão do subagente deixa de ser desenhado: as tarefas dele saem do cabeçalho também nesse momento, sem ninguém recolher nada
  - task-tree/hooks/render.tsx:224-226, 287 — o 'sessão inteira: a de b' do tooltip conta todos os grupos (total), como o status
- **Regra do catálogo:** cabecalho.numeros-somam-o-desenhado é violada neste caso: recolher a tarefa (ou o pedido) que tem um cartão de subagente com plano muda o 'd de n' (Row.nodes = [t, ...w.cards] só leva as tarefas das sessões).
- **Cenário:** Um subagente usa o painel (planeja duas tarefas) sob a tarefa "Investigar". O cabeçalho passa a dizer, por exemplo, "0 de 4" enquanto o pedido diz 0/2. A pessoa recolhe "Investigar" ou o pedido: o cabeçalho volta a "0 de 2". Num workflow (cartão de grupo), as tarefas dos agentes não contam até a pessoa abrir a linha de um agente; aberta, passam a contar.
- **Proposta:** Decidir uma regra só e aplicá-la nos quatro lugares (cabeçalho, linha da tarefa e do pedido, linha recolhida, cartão de grupo). Registrar o cenário no catálogo e cobrir com teste de recolher.
- **Ajuste da verificação à proposta:** A pergunta é necessária. Qualquer que seja a resposta, 'recolher não muda nada' já é regra: a linha recolhida da tarefa e do pedido precisa levar (ou excluir) as tarefas dos subagentes do mesmo jeito que a aberta. Teste novo de recolher com subagente que planejou, sem alterar o teste selado da regra.
- **Pergunta ao usuário:** As tarefas que um subagente planeja entram no "d de n" do cabeçalho e das linhas acima dele, ou ficam fora de toda contagem como o próprio cartão (recomendado: fora, igual à decisão "Fora da contagem")?
- **Verificação:** Li rows, turnRows, draw e groupCard: as tarefas do subagente entram no cabeçalho só pelas linhas do cartão aberto (ou pelo cartão recolhido, g.tasks), nunca no x/y da tarefa ou do pedido, e somem ao recolher a linha de cima, no grupo fechado e quando a origem fecha. Neste ambiente os subagentes usam o painel com frequência, então o caso é comum.

### Tarefa pendente com trabalho pendurado: sessão viva acende a tarefa, carta na fila acende só os pais, subagente rodando não acende nada
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1308-1311 — outra face da mesma assimetria: o cartão da sessão é desenhado sob a tarefa em qualquer estado; o do subagente só sob tarefa 'open'. Um subagente em segundo plano cuja tarefa o modelo fechou com done some do painel e da pílula enquanto ainda roda
  - task-tree/draw/layout.ts:960 — no fim do turno só as cartas na fila poupam a tarefa do halt: a iniciada com subagente em segundo plano rodando vira ◷ e entra no chip 'aguardando'
- **Regra do catálogo:** Também sessoes.filha-trabalhando-mantem-pais-em-andamento (o precedente da filha), subagentes.um-rodando-mantem-o-pai (só diz que não fecha) e turnos.iniciada-aguarda-no-fim.
- **Cenário:** Plano com "Investigar" pendente, sem start. (a) O modelo abre uma sessão filha: "Investigar", o pai e o pedido ficam ◉. (b) Manda uma mensagem que fica na fila: "Investigar" segue ○, o pai e o pedido ficam ◉. (c) Lança um subagente: "Investigar", o pai e o pedido seguem ○ "pendente", o chip "em andamento" fica em zero, com um cartão "trabalhando" logo abaixo; no fim do turno a tarefa pula de ○ direto para ✓.
- **Proposta:** Tratar subagente running/background ancorado na tarefa como trabalho em curso no tom: incluir no cálculo de `tone` (e no de `turnRows`) um termo equivalente a `w.busy` para grupos com `subLive` sob a tarefa ou abaixo dela. Registrar a regra em `regras/subagentes.md`.
- **Ajuste da verificação à proposta:** Tem de ser pergunta (a proposta já traz), citando 'sem start, nada aceso'. A resposta deve cobrir também: a tarefa iniciada com subagente em segundo plano depois do fim do turno (hoje ◷ 'Aguardando') e o cartão do subagente vivo sob tarefa já fechada (hoje não desenhado).
- **Pergunta ao usuário:** Enquanto um subagente roda sob uma tarefa que o modelo não iniciou com start, a tarefa (e o pai e o pedido) deve aparecer ◉ em andamento, como acontece com a sessão filha? Recomendo que sim.
- **Decisão já registrada:** arvore.sem-start-nada-acende (2026-10-23, 'sem start, nada aceso'): acender ◉ uma tarefa sem start por causa de um subagente contraria a letra dessa decisão; a filha é a exceção registrada (commit d956e11). Para o subagente não há decisão.
- **Verificação:** Confirmei: w.busy vem só de sessões (atWork), waitsBelow só de carta na fila e só acende pais, e nenhum termo do tom ou do turnRows olha subLive; a tarefa pendente com subagente rodando fica ○ com 0 em andamento e pula para ✓ no fim do turno (este salto é decidido: 'Fecha também').

### SendMessage para subagente ou teammate vira carta de sessão; envio feito por subagente não tem carta mas mexe nos cartões
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tool-call.ts:149-154 — o envio é gravado para qualquer 'to' não vazio que não falhou, sem conferir se é sessão: a carta 'Para <agente>: …' é desenhada qualquer que seja o texto do resultado (layout.ts:1262-1287, nameOf devolve o próprio 'to')
  - task-tree/hooks/sessions.ts:268 — anyRunning devolve true enquanto houver envio não tomado: uma carta a agente presa na fila mantém o relógio de 1 s redesenhando o painel para sempre
  - Só a parte 'fica na fila para sempre' e a do recibo publicado pela filha dependem do texto e do remetente que o app devolve, que o código não mostra.
- **Regra do catálogo:** envios.carta-sob-a-tarefa ('Dado uma mensagem a outra sessão') e envios.pedido-recebido-mostra-carta (as palavras do usuário sobre cartas).
- **Cenário:** O loop principal manda SendMessage a um subagente ou teammate (o destino é o nome do agente): o painel desenha 'Para <agente>: …' como carta de sessão; se o resultado disser 'queued' ou 'pending', a carta fica na fila para sempre (ninguém confirma) e a tarefa presa. No sentido contrário, um subagente manda mensagem a uma filha: não há carta, a filha publica o recibo como vindo desta sessão, o cartão abre numa rodada órfã sob a tarefa aberta naquela hora e o recibo pode confirmar por engano um envio do loop principal que ainda espera. Depende do texto que o app devolve para esses destinos, que o código não mostra.
- **Proposta:** Decidir e registrar: só destinos de sessão (`local_…` ou nome de linha da lista) viram carta; para agentes, nenhuma carta ou uma linha própria sem espera. Gravar o envio do subagente com a âncora do grupo dele, ou ao menos a rodada, para o cartão não nascer órfão.
- **Ajuste da verificação à proposta:** Com as palavras já registradas, 'só destino de sessão vira carta' pode ser tratado como correção; a pergunta fica como confirmação, citando-as. Critério de sessão: 'local_…' ou nome de uma linha de children; para os demais, nenhum registro em sends. A parte do envio feito por subagente deve ser conferida no app antes de mudar (checklist).
- **Pergunta ao usuário:** Mensagem do loop principal a um subagente ou teammate deve aparecer como carta? Recomendado: não (carta só entre sessões).
- **Decisão já registrada:** regras/envios.md:116 (2026-10-30): 'as cartas deveriam representar somente quando uma sessão se comunica com outra'. Foi dito sobre o ícone das tarefas derivadas, mas responde à pergunta proposta: destino que não é sessão não deveria virar carta.
- **Verificação:** A primeira metade está confirmada pelo código: sentMessage não filtra o destino, então SendMessage a subagente ou teammate grava um envio e desenha carta de sessão; e a chamada de subagente sai em tool-call.ts:222 sem registro. O resto (carta presa, recibo que confirma envio errado) é plausível e fecha com watchSends e unsent, mas depende do texto do app.

### No cartão de grupo (mais de três, ou workflow), o aviso de espera de um agente não aparece
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1314 — no cartão individual o aviso de um subagente sem tarefas sai em body ('notice' sob o cabeçalho); esse caminho só roda dentro de draw(k), que o groupCard não chama para linha fechada
  - task-tree/hooks/render.tsx:291 — headerState usa o mesmo waitingNow: a faixa do cabeçalho também não vira 'aguardando'
- **Regra do catálogo:** Também perguntas.permissao-espera ('aparece Aguardando permissão: <ferramenta>'): no cartão de grupo o aviso não aparece.
- **Cenário:** Workflow com 12 agentes num cartão 'Workflow · 12 agentes'; um deles pede permissão para rodar um comando (ou abre uma pergunta). O painel mostra a linha dele como 'trabalhando' com a última ferramenta; nenhum 'Aguardando permissão' aparece, nem na pílula. O usuário não vê pelo painel que o workflow está parado esperando por ele.
- **Proposta:** Em `groupCard`: a linha de um agente com `wait` aberto usa tom 'wait' e o texto `waitText(w)` no lugar da ferramenta (ou abre sozinha), e o cabeçalho do grupo diz 'N aguardando'. Teste com `lancar` x4 + permissão de um deles.
- **Ajuste da verificação à proposta:** Sem ajuste de fundo. Vale para os dois grupos (mais de três lançados juntos e workflow); se agentes de workflow em segundo plano pedem permissão à pessoa depende do app, mas o grupo de subagentes em primeiro plano basta para o caso. Não deixar o aviso depender de dobra: mesmo com a linha do agente fechada, ele deve entrar na pílula.
- **Verificação:** Confirmei em groupCard: a linha de cada agente vem fechada (opened(lineKey, false)) e mostra só ferramenta ou estado; os waits do agente só existem dentro de draw/body, e a pílula e a faixa contam linhas desenhadas com tom 'wait'. permission.ts grava o wait com o agent_id do subagente, então o pedido de permissão de um agente do grupo fica invisível no painel.

### 'Nada mais em execução nela' é medido diferente no fechamento automático e no desenho
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/io/host.ts:152-154 — running é o isRunning do host e waiting vem do arquivo publicado: a filha que encerrou o turno com escolha aberta (wrap_up com ask) é viva e não running, o caso que busy não vê
  - task-tree/hooks/tool-call.ts:153 — a entrega imediata grava o envio já 'taken', então a terceira condição de busy também não segura a tarefa
- **Regra do catálogo:** subagentes.pai-conclui-no-fim-do-turno; subagentes.um-rodando-mantem-o-pai
- **Cenário:** A tarefa T lança um subagente (concluído) e manda uma mensagem, entregue na hora, a uma sessão aberta antes em outra tarefa; a sessão trabalha na rodada de T. Fim do turno: `busy` não vê a sessão (a âncora de abertura é outra, a carta já foi tomada) e T é fechada de fato ✓; o desenho ainda a mostra em andamento por causa da sessão, mas o x/y já a conta e nenhum done será pedido. O mesmo com uma filha aberta em T que está 'aguardando' o usuário (viva, não running). E um wait de um subagente cuja tarefa própria tem o mesmo id de uma folha da principal segura essa folha.
- **Proposta:** Fazer `busy` usar o mesmo critério do desenho: `live(c)` e `(c.lastAnchor ?? c.anchor) === id` (ou qualquer rodada aberta ali), e filtrar `waits` por `w.agent === owner`. Idealmente extrair a condição para draw/layout.ts e usá-la nos dois lugares.
- **Ajuste da verificação à proposta:** Usar live(c) || c.starting e conferir a rodada atual (c.lastAnchor ?? c.anchor), como roundAt; filtrar os waits por agente dono (w.agent === owner).
- **Verificação:** Comparei busy (agents.ts:165-169) com live/roundAt/atWork do desenho: busy só olha a âncora de abertura e running/starting, e casa waits por id de tarefa sem conferir o grupo. A tarefa fecha de fato com a sessão trabalhando na rodada dela ou esperando a pessoa, contra o Dado do cenário; o efeito visível é pequeno (o desenho ainda a mostra em andamento enquanto a filha trabalha).

### 'Lançamento conta como uso da tarefa' espalha lançamentos simultâneos (e agentes de um workflow) por tarefas diferentes e desfaz o cartão de grupo
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/agents.ts:53-61 — a âncora é lida do state depois de 'await next(e)': com lançamentos realmente simultâneos, dois spawns podem ler os grupos antes de qualquer um gravar e cair na mesma tarefa; a distribuição 1 + 3 do cenário vale para lançamentos em sequência
- **Regra do catálogo:** subagentes.cartao-desde-o-lancamento (reescrito 2026-11-09) x subagentes.varios-juntos-num-cartao-de-grupo
- **Cenário:** start em duas tarefas (A e B) e 4 subagentes lançados juntos: o 1º vai a A, o 2º a B, o 3º e o 4º a B (última iniciada): A com 1, B com 3, nenhum lugar com mais de três, quatro cartões soltos. Workflow de 12 agentes nas mesmas condições: 1 cartão solto em A e 'Workflow · 11 agentes' em B. Agentes de fases posteriores do mesmo workflow, lançados depois que o modelo trocou de tarefa, caem em outra tarefa ainda (ou numa fechada, e não aparecem).
- **Proposta:** Decidir: lançamentos do mesmo lote (janela de 3 s) e do mesmo `run` herdam a âncora do primeiro (recomendado: o grupo fica inteiro num lugar e o contador do workflow bate), ou mantém-se a distribuição e o catálogo passa a dizer que o grupo é por tarefa.
- **Ajuste da verificação à proposta:** A opção recomendada (todo o lote herda a âncora do primeiro) desfaz a regra registrada e o caso que ela atende (duas tarefas iniciadas, um subagente para cada): tem de ser pergunta, e convém restringi-la aos agentes do mesmo workflow (run), mantendo a distribuição para lançamentos avulsos. Alternativa sem mudar a regra: escrever no catálogo que o grupo e o contador 'Workflow · N' são por tarefa.
- **Pergunta ao usuário:** Subagentes lançados juntos (ou do mesmo workflow) com mais de uma tarefa em andamento: ficam todos na mesma tarefa, num cartão de grupo só (recomendado), ou continuam distribuídos, um por tarefa?
- **Decisão já registrada:** regras/subagentes.md:15 (Reescrito 2026-11-09, 'Vai à pendente (Recomendado)'): 'com várias em andamento, a primeira do lote ainda sem carta nem cartão, na ordem dos starts'; e a regra da carta 'pela ordem' (hooks/panel.ts:188-195). A distribuição de um lançamento por tarefa é a regra decidida; o que não está decidido é o caso do workflow e o do lote com mais lançamentos que tarefas.
- **Verificação:** Confirmei em sendAnchor/usedAnchors e drawKids que cada lançamento vai à próxima tarefa do lote sem cartão e que o agrupamento é por lugar: com duas em andamento, 4 lançamentos ficam 1 + 3 (nenhum grupo) e um workflow de 12 vira 1 solto + 'Workflow · 11 agentes'. Mas a distribuição é comportamento decidido e escrito; sobra uma lacuna de borda (workflow com várias tarefas em andamento), por isso baixa.

### Cartão de subagente: toks/s some quando ele termina e não existe na linha do grupo; o tempo tem duas origens
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:1476-1484` — o toks/s só entra no meta com subLive(s)
  - `task-tree/draw/layout.ts:1445-1455` — linha do cartão de grupo: ferramenta, ou modelo e estado; nunca o toks/s; tempo sempre (s.end ?? now) - s.at
  - `task-tree/draw/layout.ts:1473-1476, 1493` — cartão individual: com tarefas o tempo é span(g.tasks) (vazio até o primeiro start), sem tarefas é lançamento→fim, apesar do comentário 'its time runs from the launch to its end'
  - `task-tree/hooks/agents.ts:89-101` — a taxa de um passo válido é descartada quando houve escrita do cartão há menos de 1 s (o limite é compartilhado com a linha de ferramenta) e não é regravada depois
  - `regras/taxa.md:27-45` — 'fica aceso' no fim e 'o cartão mostra a velocidade dele pela mesma regra'
  - `task-tree/draw/layout.ts:1473-1484` — A taxa só entra na palavra do cartão com subLive(s): terminado, o cartão mostra só modelo e estado.
- **Regra do catálogo:** taxa.subagente-mesma-medida: O cartão de subagente mede igual
- **Cenário:** Subagente mede 60 toks/s; ao terminar, o cartão fica 'Haiku 5.5 · concluído' sem o número, enquanto cabeçalho e cartão de filha mantêm o último número aceso. No cartão de grupo (workflow) o número nunca aparece com a linha fechada. Um subagente que chama plan perde o tempo do cartão até dar start, e o mesmo agente mostra tempos diferentes como linha do grupo e como cartão aberto.
- **Proposta:** Decidir e registrar: manter o toks/s no cartão terminado (coerente com 'Fica aceso' e 'Sim, todos') e usar sempre lançamento→fim no tempo do cartão; gravar a taxa pendente na próxima escrita em vez de descartá-la.
- **Pergunta ao usuário:** No cartão de subagente terminado, o último toks/s deve continuar visível como no cabeçalho e no cartão da filha (recomendado) ou sumir como hoje?

### A contagem de chamadas do cartão do subagente recomeça depois de uma recarga
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/agents.ts:32-33` — `wrote` e `calls` são Maps de módulo (sem linha na tabela de durabilidade).
  - `task-tree/hooks/agents.ts:119-133` — subTool soma a partir de `calls.get(agent) ?? 0` e grava esse número em sub.calls, por cima do que o state tinha.
  - `task-tree/hooks/agents.ts:136-145` — subEnd grava o total do Map (o pós-recarga) como contagem final.
  - `task-tree/draw/layout.ts:1496-1499` — A linha do cartão mostra '<ferramenta> · N chamadas' a partir de sub.calls.
  - `task-tree/hooks/agents.ts:32-33, 122-123, 132, 140-145` — `calls` e `wrote` são variáveis do módulo; depois da recarga `calls.get(agent)` é undefined, `n` volta a 1 e é gravado por cima de `sub.calls`; no fim, grava-se o `n` reiniciado.
  - `task-tree/state/durability.ts:84-102` — A tabela de durabilidade lista as variáveis de módulo, mas não `calls` nem `wrote` (e ainda lista `samples`, que nenhum código usa).
- **Regra do catálogo:** subagentes.corpo-e-as-tarefas-ou-a-ferramenta (Com tarefas, o cartão mostra as tarefas dele; sem tarefas, a ferramenta em uso)
- **Cenário:** Um subagente já fez 37 chamadas ('Read x · 37 chamadas'). Um arquivo do mod é salvo. Na chamada seguinte o cartão mostra só a ferramenta (contagem 1), depois '2 chamadas', e o total gravado no fim é só o das chamadas feitas depois da recarga.
- **Proposta:** Em subTool, partir do maior entre o Map e o state: `Math.max(calls.get(agent) ?? 0, s.calls ?? 0) + 1` (perde-se no máximo o que o limite de 1 s ainda não tinha gravado). Acrescentar `calls` e `wrote` à tabela de durabilidade.

### Subagente de subagente: regras do laço principal aplicadas pela metade
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:749-752` — `trimToWork` testa `under(g.anchor)` contra os ids do grupo principal, sem olhar `g.parent`: a âncora de um neto é um id do plano do subagente pai; terminado, ele é cortado do desenho (ou mantido por coincidência de id).
  - `task-tree/hooks/agents.ts:158-179` — `settleBySubs` percorre todos os grupos como donos quando o turno PRINCIPAL termina: fecha a folha de um subagente pai que ainda está rodando.
  - `task-tree/hooks/turn.ts:153-162` — No fim do subagente pai, o que ele deixou aberto vira interrompido sem passar por `settleBySubs` (salvo se o turno principal já terminou): a folha cujo neto concluiu sai ✕ em vez de ✓.
  - `task-tree/draw/layout.ts:1438-1457` — Num cartão de grupo, os netos só aparecem se a linha do agente for aberta.
- **Regra do catálogo:** sem cenário
- **Cenário:** Um subagente (ou agente de workflow) que usa o painel lança outro subagente da tarefa X dele. O neto conclui: o cartão dele some do painel (X não é id da principal). Se o turno principal termina com o pai ainda em segundo plano, X é fechada ✓ no grupo do pai com ele trabalhando nela; se o pai termina antes, X sai ✕ 'interrompida' mesmo com o neto concluído.
- **Proposta:** Em `trimToWork`, aplicar o corte por âncora só a grupos com `parent === MAIN` (os demais seguem o pai). Em `settleBySubs`, só tratar como dono um grupo cujo próprio laço terminou (MAIN com turno encerrado; subagente com `sub.state` final), e chamá-lo para o próprio grupo no `turn.complete` do subagente, antes do `interrupt`. Cenário `subagentes.aninhado` no catálogo.

### As mesmas regras vão ao subagente, mas várias cláusulas só valem no loop principal: request e summary são ignorados sem aviso, a pergunta sem tarefa não é recusada e não há lembrete sem plano
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/prompt-submit.ts:114-118` — RULES entra em todo pedido que oferece a ferramenta plan, sem distinguir o agente.
  - `task-tree/hooks/tools.ts:81, 133-134, 162-175` — O grupo de subagente retorna antes de tratar request; o summary só é guardado e cobrado no loop principal.
  - `task-tree/hooks/tool-call.ts:53-60, 222` — A recusa do AskUserQuestion e todos os avisos depois da chamada são só do loop principal.
  - `task-tree/text/rules.ts:22-37, 53-54` — 'Todo pedido abre pelo menos uma tarefa', 'passe em request', 'passe em summary', 'AskUserQuestion sem tarefa aberta é recusado'; 'Subagentes que usam o painel ganham um grupo próprio' (hoje todo subagente ganha cartão desde o lançamento, agents.ts 53-84).
- **Regra do catálogo:** subagentes.corpo-e-as-tarefas-ou-a-ferramenta (Com tarefas, o cartão mostra as tarefas dele; sem tarefas, a ferramenta em uso)
- **Cenário:** Um subagente lê as regras, passa request no plan e summary no último done: os dois somem sem aviso, e ele pergunta sem tarefa aberta sem ser recusado. Num workflow com dezenas de agentes, cada um é instruído a planejar ('todo pedido abre pelo menos uma tarefa'), sem regra que diga se isso é desejado dentro dos cartões.
- **Proposta:** Dar ao subagente uma versão curta das regras (plan, start e done no próprio grupo; sem request nem summary), escolhida em promptCompose pelo agentId, ou acrescentar uma linha a RULES dizendo o que não se aplica a subagentes. Atualizar a frase sobre o grupo próprio para o cartão desde o lançamento.

## Desenho do painel e cabeçalho

30 achados: 2 de severidade alta, 10 média, 18 baixa.

### Limite de 400 linhas e limite de 600 KB não se conciliam: o aviso "Painel grande demais" pode aparecer sem nada aberto, e o botão "Voltar" não faz nada
- **Categoria:** fluxo não mapeado · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/golden/svg.ts — conferido: 76 KB para 43 Svgs (3 cabeçalhos e 40 linhas), cerca de 1,7 KB por Svg no JSON; 400 linhas dão por volta de 650 a 700 KB, acima dos 614 KB (600 * 1024)
  - regras/cabecalho.md:74 — o estado do cenário diz 'checklist (… o aviso só aparece acima de 20 MB)': está desatualizado, o limite voltou a 600 KB (hooks/panel.ts:529), abaixo dos 4 MB do harness, então o cenário já pode ser coberto por teste
  - task-tree/DESENVOLVIMENTO.md:1038, 1051 — ainda citam '/task-tree resumida | completa' e 'Use ≡', que não existem mais (hooks/command.ts só abre o painel)
- **Regra do catálogo:** cabecalho.limite-de-linhas-do-desenho (O desenho tem no máximo 400 linhas) e cabecalho.aviso-de-painel-grande-volta (O aviso de painel grande tem um botão que volta)
- **Cenário:** A sessão (ou uma filha cujo cartão é desenhado aqui) planeja algumas centenas de tarefas, ou vários cartões de filhas ficam à vista ao mesmo tempo, e o desenho padrão chega a cerca de 250 a 400 linhas. Tudo vem aberto por padrão, a pessoa não abriu nada. O JSON passa de 600 KB e o painel inteiro vira "Painel grande demais (N KB)". A pessoa aperta "Voltar à visualização anterior": closeOpened não acha nenhuma chave aberta por ela, nada muda e o aviso continua. Como as linhas não são desenhadas, ela também não consegue recolher nada. O painel fica assim até um pedido novo trocar o trabalho. Uma nota antiga (analise-painel-grande-demais.local.md, dado possivelmente desatualizado) já tinha medido 400 linhas com cerca de 930 KB e proposto o corte por bytes; a correção foi arquivada quando o limite subiu para 20 MB, decisão depois desfeita.
- **Proposta:** Cortar por bytes além de linhas: depois de montar os SVGs, tirar blocos inteiros do começo (como limitRows) até caber no orçamento, com a linha "+N linhas anteriores", de modo que o aviso seja de fato o último recurso. No aviso, quando não há nada aberto pela pessoa, o botão precisa mudar alguma coisa (por exemplo, desenhar só o pedido em andamento). Reescrever cabecalho.limite-de-linhas-do-desenho para "400 linhas e 600 KB" e cobrir no desktop com o plano grande que o teste já tem (o desenho de 600 KB cabe no limite de 4 MB do harness).
- **Ajuste da verificação à proposta:** A opção (a) (cortar por bytes até caber) atende à decisão registrada e pode ir como correção; a pergunta fica só para escolher entre (a) e (b). Em qualquer caso o botão precisa ter efeito sem nada aberto. Atualizar o estado de cabecalho.aviso-de-painel-grande-volta (de 20 MB para 600 KB) e cobrir o caso no desktop; corrigir os trechos velhos do DESENVOLVIMENTO.md.
- **Pergunta ao usuário:** Quando o desenho padrão (sem nada aberto por você) passa de 600 KB, o que o painel deve mostrar: (a) cortar os blocos mais antigos até caber, sem aviso (recomendado), ou (b) manter o aviso e fazer o botão mostrar só o que está em andamento?
- **Decisão já registrada:** hooks/panel.ts:523-529 e DESENVOLVIMENTO.md:1568-1574 (2026-11-04): 'eu quero ver as tarefas em andamento, e quando aparecer essa mensagem, quero que tenha um botao ali, pra voltar a visualizar as mensagens em andamento'. O botão que não muda nada quando a pessoa não abriu coisa alguma descumpre essa decisão.
- **Verificação:** Confirmei: limitRows corta só por número de linhas, o limite de 600 KB é medido depois sobre o JSON, e closeOpened só fecha chaves com valor false; sem nenhuma, o desenho seguinte é idêntico e o aviso fica, sem linhas para recolher. Pela conta sobre o golden, um desenho padrão de cerca de 350 a 400 linhas (plano grande ou vários cartões de filhas abertos) já passa do limite, cenário plausível numa orquestradora.

### Linha '+N pedidos anteriores' fantasma dentro do cartão de filha parada: nada está escondido, e abrir a linha não mostra nada novo
- **Categoria:** contradição · **Severidade:** alta · **Situação:** confirmado na verificação
- **Evidência:**
  - Não vale para sessão arquivada: interrupt (layout.ts:29-34) devolve o mesmo objeto para tarefa que já não está aberta, e depois da primeira passada nada está aberto; a segunda passada preserva a identidade
  - Condição exata na filha parada não arquivada: um nível 1 que é pai aberto (halt cria objeto novo sempre, layout.ts:65-66, mesmo só com pendentes embaixo) ou folha iniciada e aberta em turno não interrompido (layout.ts:62); com o turno interrompido a folha vira ✕ na primeira passada e não se repete, mas o pai aberto sim
  - task-tree/draw/layout.ts:756 — vale também para cartões aninhados (neta dentro da filha): trimToWork aplica panelOf em cada nível e session() aplica de novo
- **Regra do catálogo:** cabecalho.limites-de-linhas (Os pedidos fora do trabalho viram '+N pedidos anteriores')
- **Cenário:** Filha parada (não rodando, não arquivada) com uma folha iniciada e aberta, ou com um pai aberto, num cartão de um turno só. Simulação com o arquivo real da auditoria-mod no estado do print: o cartão 'parada' mostra '+1 pedidos anteriores' e a tarefa 'Aguardar sinal...'; com a mesma tarefa só pendente (nunca iniciada) a linha some; com a linha aberta, o desenho é o mesmo. Explica por que 'parada' e '+1 pedidos anteriores' aparecem juntos. Vale também para cartão de sessão arquivada com algo aberto.
- **Proposta:** Comparar por id em body(): montar um Set dos ids de recentOnly/drawn e filtrar whole por ele (linhas 1343 e 1361). Ou fazer panelOf aplicar o mesmo halt/interrupt a g.whole, ou não chamar panelOf duas vezes sobre o painel já cortado. Teste: filha parada com uma tarefa iniciada e um turno só não desenha linha de pedidos anteriores.
- **Ajuste da verificação à proposta:** Comparar por id nas linhas 1343 e 1361 (um Set dos ids de recentOnly e de drawn) é a correção mais simples e não muda nenhum outro caminho. Teste: filha parada com um nível 1 pai aberto (só pendentes embaixo) e outra com folha iniciada, um turno só, sem linha de pedidos anteriores no cartão.
- **Verificação:** Reproduzi pela leitura: trimToWork (layout.ts:747-757) grava tasks e whole com os objetos de panelOf(c); session() (1156) chama panelOf de novo, que recria os níveis 1 abertos e deixa whole com os antigos; body (1341-1344) compara por identidade, left fica 1 e a linha '+1 pedidos anteriores' é desenhada sem nada escondido. Filha parada com pai aberto é caso comum na orquestradora.

### Tempo do cabeçalho segue contra 'agora' com o turno encerrado, mas o relógio de 1 s para: o número congela e salta
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1247-1251 — a doc descreve o comportamento ('até agora enquanto houver tarefa aberta ou sessão viva'; 'o relógio de 1 s corre enquanto houver sessão viva'), sem citar decisão do usuário; o texto é anterior à regra do relógio parado no fim do turno
  - task-tree/hooks/sessions.ts:269 — com o turno encerrado, running() recebe groups vazio: os grupos de subagente também saem, não só as tarefas próprias
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim ('◷ com o relógio parado'); durabilidade.fim-do-turno-sobrevive-ao-reinicio ('o relógio não anda até o próximo pedido'); não há cenário de tempo em regras/cabecalho.md
- **Cenário:** Plano com 3 passos, start no 1, o turno termina (1 fica ◷, 2 e 3 ○). As linhas mostram tempos parados e o cabeçalho fica com o valor do último desenho. Uma hora depois a pessoa clica numa dobra (ou o poll muda uma filha): o cabeçalho pula para 1:05:00 e para de novo. O mesmo com um subagente em segundo plano depois do fim do turno e com uma neta trabalhando sob uma filha parada: o tempo só anda quando outra coisa provoca desenho.
- **Proposta:** Uma regra só para 'o que tem relógio correndo': ou o cabeçalho para no fim do turno quando não há sessão viva (limitar `to` a model.ended), ou anyRunning passa a cobrir tudo que o desenho mede contra now (folha aberta, subagente vivo, neta viva). Registrar o cenário em regras/cabecalho.md (hoje não há cenário de tempo).
- **Ajuste da verificação à proposta:** Segue como pergunta. A opção recomendada (o cabeçalho para no fim do turno quando não há sessão viva nem carta na fila) é a que combina com os dois cenários acima; a outra (anyRunning cobrir toda folha aberta) redesenharia o painel a cada segundo enquanto existir qualquer pendente, para sempre. Os casos de subagente em segundo plano e de neta viva sob filha parada pedem regra própria e podem ficar como item separado.
- **Pergunta ao usuário:** Com o turno encerrado e tarefas ainda abertas (○/◷), o tempo do cabeçalho deve parar no fim do turno, como as linhas (recomendado), ou seguir contando em tempo de parede com o relógio ligado?
- **Verificação:** Conferi render.tsx:277 (hasOpen(shown) basta para medir até agora; as folhas ○ e ◷ continuam 'open' depois do halt), layout.ts:556-565 e sessions.ts:258-283 (com turnEnded número e sem filha viva nem carta na fila, o relógio se cancela). O número do cabeçalho fica o do último desenho e pula no desenho seguinte.

### Recolher uma linha muda os chips e a faixa do cabeçalho (avisos, cartas na fila, sessões ativas e subagentes somem da conta)
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1164, 1178 — o cartão de filha recolhido ainda diz 'aguardando' na própria linha (meta); o que some é a linha do aviso e, com ela, o chip e a faixa
  - task-tree/io/publish.ts:133 — o 'waiting' publicado para a sessão mãe vem dos waits, não do desenho: a dobra não afeta o que a mãe vê
- **Regra do catálogo:** cabecalho.numeros-somam-o-desenhado — Os números do cabeçalho somam o que está desenhado ("recolher não muda nada")
- **Cenário:** A filha pede permissão (aviso dentro do cartão dela) e a pessoa recolhe o cartão, a tarefa de origem ou o pedido: o chip "1 aguardando" some e a faixa passa de "aguardando" para "sessão ativa"/"em andamento". Recolher a tarefa que tem o cartão de uma filha trabalhando tira "1 sessão ativa" (e a faixa azul vira verde/âmbar claro); recolher a tarefa com carta na fila tira "aguardando sessão"; recolher a tarefa com subagentes tira o chip de subagentes. Os números d/n ficam iguais, como a regra pede, mas os chips e o estado geral mudam.
- **Proposta:** Fazer a linha recolhida carregar o que esconde: em rows()/turnRows()/session(), quando a linha fecha, somar em campos da própria Row (ex.: waits, queued, lives, subs) o que os 'below' e as linhas de dentro contariam, e o render somar esses campos em vez de contar linhas. Acrescentar ao teste da regra um caso que recolhe tarefa com cartão vivo, com aviso e com carta na fila e compara os chips antes e depois.
- **Ajuste da verificação à proposta:** Não alterar o teste selado da regra (cabecalho.test.ts:12-33): criar teste novo que recolhe tarefa com cartão vivo, aviso e carta na fila e compara chips e estado geral. Como as palavras do usuário falam de tarefas, registrar no cenário (Reescrito ou cenário novo) que a regra vale também para os chips; se houver dúvida de que ele quer isso, uma pergunta curta. Aplicar o mesmo às tarefas de subagente (outro achado relacionado desta área).
- **Verificação:** Confirmei em render.tsx:276-291: d/n e os chips de tarefa vêm de Row.nodes, mas aguardando, aguardando sessão, sessões ativas e subagentes são contados por linha desenhada; a linha recolhida (rows, turnRows, session) não leva live, pending, subs nem as cartas. A letra de 'recolher não muda nada' é violada para chips e faixa; como a origem da regra fala de tarefas e a dobra é ato da pessoa, media.

### toks/s e "ultracode" do cabeçalho não são desenhados abaixo de 84 colunas; os testes só leem o alt
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/svg.ts:116-122 — é aqui (não em geometry.ts) que o comentário fala do painel de ~427 px; geometry.ts:16-23 fala da fonte medida em 8,6 px por coluna
  - task-tree/draw/svg.ts:648-649 — o comentário do código declara a omissão: 'too narrow, it is left out, like the rate'
  - task-tree/hooks/render.tsx:321-329 — o cabeçalho do terminal mostra o toks/s e nunca 'ultracode' (ultracode.cor-e-corte: 'nada no terminal')
  - A regra do estreito veio com o cabeçalho V4 (commit 18ee8f7, 2026-11-03), validado no app e travado no golden a 60 colunas.
- **Regra do catálogo:** Também ultracode.cor-e-corte ('faltando espaço, sai junto com o modelo', decidido para o cartão) e os cenários do golden (visual.desenho-*, 60 colunas).
- **Cenário:** Painel lateral com menos de 84 colunas (todo o harness e o golden usam 60; um painel de ~690 px reais com a fonte medida em 8,6 px/coluna dá ~80 colunas). O interruptor de ultracode está ligado e há toks/s medido: o cabeçalho mostra só "0%  0 de 2  0:05". A palavra e a taxa existem apenas no texto alternativo, e o check passa.
- **Proposta:** Decidir a regra do painel estreito e escrevê-la no catálogo (ultracode.cabecalho, taxa, visual.cabecalho-em-cartao). Se devem aparecer sempre, quebrar o bloco em duas linhas ou encolher a barra em vez de omitir; decidir pelo espaço real (CSS) e não por W. Em qualquer caso, os testes de cabeçalho devem ler o source do SVG (como visual.test.ts faz com a faixa), não o alt, e haver um desenho a 100+ colunas.
- **Ajuste da verificação à proposta:** Mostrar sempre muda o desenho aprovado a 60 colunas: passa pelo fluxo do golden (validação dele no app) e tem de ser pergunta, como proposto. Independente da resposta: escrever a condição de largura em ultracode.cabecalho, taxa e visual.cabecalho-em-cartao, e fazer o teste de ultracode.cabecalho ler o source do Svg numa largura de 84 colunas ou mais (svgs($, { colunas })), porque hoje o cenário está 'coberto' por um teste que passa sem a palavra existir no desenho.
- **Pergunta ao usuário:** No painel estreito, o cabeçalho deve mostrar toks/s e "ultracode" (apertando a barra) ou pode omiti-los como hoje? Recomendo mostrar sempre, pelo menos o "ultracode".
- **Decisão já registrada:** Em parte: o cabeçalho V4 estreito sem toks/s foi aprovado pelo usuário no app ('gostei da V4', golden a 60 colunas; a nota antiga analise-cabecalho-v4.local.md diz 'estreito: só o tempo'), mas o catálogo não escreve a condição de largura. Para 'ultracode' no cabeçalho estreito não há decisão: só o comentário do código.
- **Verificação:** Confirmei: narrow = W < 600 com W = colunas x 7,2, logo abaixo de 84 colunas o cabeçalho não desenha toks/s nem 'ultracode', e o alt os diz sempre; os testes de ultracode e de taxa leem só o alt e o texto do terminal, a 60 colunas. A omissão do toks/s é do desenho V4 aprovado; a do 'ultracode' e a falta da condição no catálogo são a lacuna real, e num painel lateral comum (cerca de 690 px, ~80 colunas) a palavra recém-entregue não aparece.

### Status 'Tarefas d/n' sob a caixa de mensagem diverge do cabeçalho e do total da sessão
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:1234-1236 — o parágrafo 'Contador' ainda diz que `total` 'vale para o topo do painel e o $.ui.status'; hoje o topo soma as linhas desenhadas (render.tsx:274-275) e o status usa o total cru
  - task-tree/hooks/sessions.ts:77-78 — o poll chama showStatus a cada leitura das filhas, sempre com o total sem split e sem settle
- **Regra do catálogo:** sessoes.filha-parada-com-origem-fechada-sai-da-contagem (As pendentes de uma filha parada saem da contagem quando a tarefa de origem fecha); visual.status-embaixo-da-caixa (checklist, não diz qual número o status mostra)
- **Cenário:** Uma filha para com 2 pendentes e a tarefa de origem é fechada: o cartão vira 'encerrada', o cabeçalho mostra 4 de 4, 100%, concluído, e o status embaixo da caixa de mensagem fica em 'Tarefas 4/6' indefinidamente. O mesmo com uma rodada antiga abandonada com tarefa aberta. São três totais diferentes para a mesma sessão (cabeçalho, sessão inteira, status).
- **Proposta:** showStatus usar o mesmo cálculo do 'sessão inteira' (split com knownId e settle com os sends), extraído para uma função única em draw/layout usada pelos dois. Cenário no catálogo dizendo qual total o status mostra.
- **Ajuste da verificação à proposta:** Manter a proposta (uma função única em draw/layout para o total da sessão, com split e settle, usada pelo render e pelo showStatus) e corrigir junto o parágrafo 'Contador' do DESENVOLVIMENTO. Qual total o status mostra (sessão inteira ou o desenhado) não está decidido em lugar nenhum: registrar no cenário novo.
- **Verificação:** Conferi panel.ts:331-338: total({groups, waits: [], children}) sem splitter; como settle só é aplicado no desenho (layout.ts:1238) e no render (render.tsx:224-226), o `settled` nunca chega ao showStatus e inCount conta as pendentes da filha encerrada; sem split, discarded() só enxerga a sessão abortada inteira. O status fica em 'Tarefas d/n' com d<n enquanto o cabeçalho mostra 100%.

### Com "+N pedidos anteriores" aberto e mais de 400 linhas, a própria linha que fecha o histórico é cortada
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/state/durability.ts:75 — 'collapsed' vive só no state: não é permanente, some com o processo (reinício do app, /model); no terminal é a única saída além de recolher pedidos à mão até caber em 400 linhas
  - task-tree/draw/layout.ts:663-674 — o segundo ramo de limitRows (último bloco sozinho acima do limite) também descarta o índice 0
  - Com o histórico fechado e mais de 400 linhas, a linha ▸ some do mesmo jeito (não dá para abrir o histórico)
  - No desktop, 400 linhas costumam passar de 600 KB (ver outro achado relacionado desta área): aí aparece o aviso, cujo botão fecha os históricos; o beco sem saída é a faixa entre 400 linhas e 600 KB.
- **Regra do catálogo:** cabecalho.historico-abre-com-clique ("um clique de novo a fecha; o limite de 400 linhas do desenho continua valendo") x cabecalho.limite-de-linhas-do-desenho
- **Cenário:** Sessão longa (o código cita uma com 57 pedidos e 700 linhas). A pessoa clica em "+57 pedidos anteriores"; o desenho passa de 400 linhas, os blocos antigos saem e, com eles, a linha "▾ +57 pedidos anteriores". O painel passa a abrir com "+N linhas anteriores" (sem botão) e não há onde clicar para fechar o histórico; a dobra fica gravada em 'collapsed'. No terminal isso é permanente; no desktop só se desfaz se o desenho também passar de 600 KB e aparecer o botão "Voltar".
- **Proposta:** Em limitRows, preservar as linhas de seção com fold que estejam antes do corte (manter sec:turns na posição 0 e descontar do espaço), ou dar à linha "+N linhas anteriores" o fold do histórico quando ele estiver aberto. Acrescentar ao teste de 'pedidos antigos saem inteiros' a afirmação de que a linha do histórico continua lá e fecha com um clique.
- **Ajuste da verificação à proposta:** O teste coberto 'pedidos antigos saem inteiros do começo' afirma que a primeira linha é '+N linhas anteriores'; manter sec:turns na posição 0 muda essa asserção e pede decisão e selo. Sem mexer no teste: pôr a linha do histórico logo depois de '+N linhas anteriores' (posição 1, descontada do espaço), ou dar o fold do histórico à própria linha de contagem. Acrescentar teste novo de fechar com o corte ativo.
- **Verificação:** Confirmei: body empilha sec:turns como primeira linha de profundidade 0 e limitRows procura o corte com i > 0, então a linha com o único botão do histórico sai sempre que há corte. As duas regras do catálogo não se conciliam nesse caso; dou media porque o trabalho atual segue desenhado no fim e há saídas (aviso de 600 KB, reinício), embora nenhuma seja o clique que a regra promete.

### limitRows: um bloco pequeno depois do pedido gigante esconde o pedido inteiro; e no bloco único o corte guarda o começo, não a tarefa em andamento
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1351-1359 + 663-674 — caso a mais: com '+N pedidos anteriores' na primeira linha e um pedido único acima do limite, o segundo ramo troca essa linha por '+1 linhas anteriores' (sem dobra), e o histórico perde onde clicar
  - regras/cabecalho.md:99-109 e task-tree/DESENVOLVIMENTO.md:1053-1060 — guardar o começo do bloco e fechar com '+N linhas' no fim é o desenho aprovado, não um desvio
- **Regra do catálogo:** cabecalho.limite-de-linhas-do-desenho (O desenho tem no máximo 400 linhas; o que passa vira uma linha de contagem)
- **Cenário:** Plano de 500 tarefas num pedido e um subagente lançado sem tarefa em andamento (ou um cartão vivo solto de pedido antigo): o painel mostra "+501 linhas anteriores" e só o cartão; o plano inteiro some e o cabeçalho conta só o que restou. Sem o bloco extra: o modelo inicia a tarefa 450; a linha dela está depois do corte, o chip "em andamento" fica em 0 e a faixa diz "aguardando" com trabalho em curso.
- **Proposta:** Tratar como "último pedido" o último bloco de pedido (linha de turno), não a última linha de profundidade 0, e reservar espaço para os blocos finais pequenos; no bloco único, centrar a janela de linhas na tarefa em andamento (ou guardar o caminho dela) em vez de sempre o começo. Acrescentar os dois casos ao teste.
- **Ajuste da verificação à proposta:** Separar em dois. (a) Bloco pequeno de profundidade 0 depois do pedido gigante escondendo o pedido inteiro: é bug contra a regra, corrige-se sem pergunta (o 'último pedido' é o último bloco de pedido; os blocos finais pequenos ficam com espaço reservado). (b) Centrar a janela na tarefa em andamento muda o desenho aprovado ('desenhado até o limite e fecha com +N linhas no fim dele'): vira pergunta ao usuário antes de implementar.
- **Decisão já registrada:** regras/cabecalho.md:99-109 (decisão de 2026-10-22, 'Sim, com o corte'; texto corrigido em 2026-10-28 para o desenho aprovado); task-tree/DESENVOLVIMENTO.md:1053-1060
- **Verificação:** Conferi limitRows (layout.ts:657-675): o findIndex aceita qualquer linha de profundidade 0 a partir da qual o resto cabe, e depois dos pedidos vêm nessa profundidade o aviso sem tarefa (1380), os subagentes sem âncora (1385), '+N cartões antigos' e os cartões soltos (1529-1530). No bloco único, o corte guarda o começo, e a tarefa iniciada no fim sai de `shown` (render.tsx:274-291): chip 'em andamento' em 0 e faixa 'aguardando'.

### "Sessão inteira: a de b" não tem mais onde aparecer no desktop; o catálogo ainda diz que fica no tooltip
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - A causa apontada está errada: o commit bb2392e não tirou o 'sessão inteira' do desktop. Antes dele (git show bb2392e^:task-tree/hooks/render.tsx:294-313) o total já ia só no `alt` do cabeçalho; a camada de hover removida levava apenas o título cortado (`tip(title, name)` em headerSvg)
  - task-tree/DESENVOLVIMENTO.md:307 e 1073-1075 — a doc já dizia 'no desktop, no `alt` do cabeçalho'; as linhas 1060-1061 e 1551 dizem 'no tooltip', e a 553 ainda cita 'a faixa de hover do título tem 40 px'
  - task-tree/DESENVOLVIMENTO.md:900-903 — 'no modo imagem não há tooltip': o `alt` não aparece ao passar o mouse
  - task-tree/hooks/render.tsx:57, 220, 273 — comentários ainda falam em 'tooltip layer' e 'header's tooltip'
- **Regra do catálogo:** cabecalho.limites-de-linhas ('a sessão inteira, só no tooltip'); visual.cabecalho-barra-e-chips-desenhados (checklist: 'o tooltip sessão inteira aparece'); visual.tooltip
- **Cenário:** Com pedidos em "+N pedidos anteriores", o cabeçalho do desktop mostra "1 de 1" e a pessoa não tem como ver o total da sessão (5 de 5): o tooltip que o mostrava saiu com a remoção do tooltip de texto cortado. O item do checklist do app pede para validar algo que não existe mais.
- **Proposta:** Decisão do usuário; depois, reescrever os dois cenários. Opção recomendada: desenhar o total discreto no próprio cabeçalho quando difere (por exemplo "1 de 1 · sessão 5 de 5" na linha do "d de n", ou no texto da linha "+N pedidos anteriores").
- **Ajuste da verificação à proposta:** Reescrever a pergunta: o total da sessão inteira, no app desktop, só existe no texto alternativo do cabeçalho (não aparece na tela), e isso é anterior à remoção do tooltip; quer esse total visível (na linha '+N pedidos anteriores' ou junto do 'd de n') ou pode ficar só no texto alternativo e no terminal? Com a resposta, acertar os dois cenários, o item do checklist, os trechos do DESENVOLVIMENTO e os comentários do render.
- **Pergunta ao usuário:** A remoção do tooltip (2026-11-09) também tirou o "sessão inteira: a de b" do cabeçalho do desktop. Quer esse total visível de outro jeito (recomendo: na linha "+N pedidos anteriores" ou junto do "d de n"), ou pode sair de vez?
- **Decisão já registrada:** regras/visual.md:27-37 (2026-11-09: 'não funcionou. aborte e remova a funcionalidade de tooltip') decide só o tooltip de texto cortado; sobre o total da sessão no desktop não há decisão
- **Verificação:** Conferi render.tsx:287, 297-307 (o total vai só ao fim do `alt`) e 321-329 (no terminal aparece no texto). O catálogo e o checklist pedem um tooltip que o código não tem; a contradição é real, mas não nasceu em 2026-11-09.

### O cronômetro da tarefa retomada soma o tempo parado entre turnos
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:31-37 + task-tree/draw/layout.ts:623-627 — a tarefa segue com `started` no state: no prompt seguinte (wake), antes de qualquer start, ela já volta a ◉ e o tempo volta a ser agora menos o primeiro startedAt
  - task-tree/draw/layout.ts:131-137 — no cartão da mãe vale o mesmo: a filha parada é parada no último tempo conhecido, e ao voltar a trabalhar o tempo é medido do primeiro startedAt publicado
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim; turnos.prompt-seguinte-retoma (nenhuma das duas define o tempo ao retomar)
- **Cenário:** 'Um' recebe start às 10:00; o turno termina às 10:05 (◷, 5:00). A pessoa volta às 14:00 e manda 'continue': a linha passa a mostrar 4:00:05 e contando; fechada às 14:02, fica '4:02:00'. O tempo do pai, do pedido e do cabeçalho inflam igual. O mesmo depois de um Esc.
- **Proposta:** Definir a regra e, se o tempo deve ser só o de trabalho, guardar na tarefa o tempo acumulado ao fim de cada turno (ou o intervalo parado a descontar) e medir a partir do wake; cenário novo em regras/turnos.md e teste com relogio.advance entre fimDoTurno e pedido.
- **Ajuste da verificação à proposta:** É regra nova de tempo: vai como pergunta (já está). Se a resposta for 'só o tempo de trabalho', a correção precisa valer também para o pai, o pedido, o cabeçalho e o cartão da filha na mãe (os tempos vão no arquivo publicado como startedAt/endedAt), não só para a folha.
- **Pergunta ao usuário:** O tempo de uma tarefa que atravessa turnos deve contar só enquanto o turno está em curso (recomendado) ou do primeiro start até o fechamento, incluindo o tempo parado?
- **Verificação:** Conferi tasks.ts:101-106 (start em tarefa aberta mantém startedAt), layout.ts:83-87 (elapsed = agora - startedAt sem endedAt) e que o endedAt do fim do turno existe só na cópia do desenho (halt, layout.ts:53-67, 960). Nenhum cenário do catálogo nem trecho do DESENVOLVIMENTO define o tempo de uma tarefa que atravessa turnos.

### '+N pedidos anteriores' conta também o pedido que segue desenhado em parte, e esse pedido perde os níveis 1 fechados
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1331-1335 — o comentário diz que fica 'any request with something still open' (o pedido); o filtro da linha 1341 é por tarefa de nível 1
  - task-tree/draw/layout.ts:686-690 — decisão citada no código: 'as tarefas concluídas deveriam ficar do jeito que estão até todas as tarefas estarem concluídas'
  - O número '+32 com 35 pedidos' veio de um estado real que não reproduzi; o mecanismo (pedido antigo parcialmente desenhado entra em `left`) confere pela leitura
- **Regra do catálogo:** cabecalho.limites-de-linhas; pedidos.resumida-mantem-anteriores-com-algo-aberto (O painel mantém os pedidos anteriores enquanto há algo aberto)
- **Cenário:** Estado real da orquestradora: 35 pedidos com tarefas; desenhados os pedidos 30, 33, 34 e 35; a linha diz '+32 pedidos anteriores' (32 + 4 = 36). O pedido 30 aparece só com '65'; o nível 1 'Ultracode no cartão da filha' interrompido do mesmo pedido some e o pedido é contado também entre os anteriores.
- **Proposta:** Decidir por pedido, não por tarefa: um pedido antigo com algo aberto fica inteiro (todos os níveis 1 dele) e não entra em left; ou contar em left só os turnos sem nenhuma tarefa desenhada.
- **Ajuste da verificação à proposta:** Das duas opções, a primeira (decidir por pedido: o pedido antigo com algo aberto fica inteiro e fora de `left`) é a que segue a decisão registrada; a segunda (só acertar a contagem) manteria os níveis 1 fechados sumindo. Não precisa de pergunta. Teste: mais de três pedidos no trabalho, o mais antigo com um nível 1 fechado e outro aberto.
- **Decisão já registrada:** regras/pedidos.md:102-110 (decisão de 2026-10-23: 'somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas'); palavras do usuário citadas em layout.ts:686-690
- **Verificação:** Com mais de 3 pedidos no trabalho, recentOnly (layout.ts:1341) mantém do pedido antigo só os níveis 1 com algo aberto ou sessão viva; `left` (1343) conta o turno de qualquer tarefa de fora, então o mesmo pedido é desenhado e contado em '+N'; turnRows (1379) soma o x/y só do que sobrou. Os testes de cabecalho.test.ts não cobrem esse caso.

### Faixa e chips do cabeçalho divergem do que a árvore mostra: "aguardando" com linha ◉, e âmbar por tarefa da filha
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1061 — Row.active ('In progress of its own (the chip)') é calculado e nunca lido: o render recalcula `active` pelos nodes desenhados (render.tsx:282-283), que incluem as folhas dos cartões das filhas
  - task-tree/draw/layout.ts:991 — o comentário registra que o caminho da última iniciada (trail) é 'in progress in the tone only, not in the chip': deixar o chip de fora é deliberado
  - task-tree/DESENVOLVIMENTO.md:1243-1244 — a doc diz que o chip 'em andamento' conta só o andamento próprio e que a sessão conta no chip de sessões; o código conta também a folha iniciada da filha
- **Regra do catálogo:** visual.faixa-de-estado-geral; cabecalho.chips-contam-folhas; cabecalho.numeros-somam-o-desenhado
- **Cenário:** (1) No meio de um turno, o modelo fecha a tarefa 1 e ainda não iniciou a 2: o pedido e o plano seguem ◉ na árvore, mas a faixa vai para âmbar claro e o alt diz "estado geral: aguardando"; no start seguinte volta ao âmbar. A faixa alterna a cada done/start. (2) Na orquestradora, com tudo dela concluído e a filha com uma tarefa iniciada, a faixa fica âmbar "em andamento" e nunca azul; o azul só aparece se a filha trabalha sem tarefa iniciada. (3) Uma tarefa desenhada ◉ por ter sessão trabalhando embaixo entra no chip "aguardando".
- **Proposta:** Definir no catálogo os estados que faltam e alinhar o código: passar a headerState se o turno está em curso (o render já conhece 'ended') para que "turno em curso com pendentes" não seja 'aguardando'; e decidir se a tarefa iniciada da filha conta como "em andamento" próprio ou como "sessão ativa".
- **Ajuste da verificação à proposta:** Seguem as duas perguntas. Para (a), mudar só a faixa (e a palavra do estado geral), sem mexer no chip, que fica de fora de propósito. Para (b), o cenário e a doc dizem azul e o código e o comentário do teste (visual.test.ts:35) dizem âmbar: é contradição a decidir; a correção separa as folhas próprias das folhas dos cartões (o Row.active já existe para isso). O caso (3), a tarefa ◉ por sessão viva embaixo contada no chip 'aguardando', sai da mesma decisão.
- **Pergunta ao usuário:** (a) Entre um done e o próximo start, com o turno ainda rodando, a faixa deve seguir âmbar "em andamento"? Recomendo que sim. (b) Com só a filha trabalhando (tarefa dela iniciada, nada seu), a faixa deve ser azul "sessão ativa" ou âmbar como hoje? Recomendo azul, como o cenário diz.
- **Decisão já registrada:** regras/visual.md:206-215 (2026-11-03: só pendentes, nada iniciado = 'Âmbar claro, aguardando'; 'azul com só uma sessão filha trabalhando'); o estado 'algo feito, algo pendente, turno em curso' não está no cenário
- **Verificação:** Conferi svg.ts:615-623 e render.tsx:282-291: entre um done e o start seguinte não há folha com relógio correndo, então active=0 e o estado cai em 'aguardando', enquanto trail (layout.ts:599-604, 1025) mantém pai e pedido ◉. Com o turno encerrado e filha viva, a tarefa de origem fica ◉ por w.busy (1017) mas é leftWaiting e entra em 'aguardando' (render.tsx:285-288). O golden de envios mostra '2 aguardando ... estado geral: aguardando' com linha 'Em andamento'.

### Com o histórico aberto, o layout monta todas as linhas da sessão a cada desenho e só depois corta em 400; recolher não poupa cálculo
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/draw/layout.ts:1063-1064 — o `under` é usado para saber se a linha tem dobra; dá para adiar a montagem, não para pular a pergunta 'há algo embaixo?'
  - task-tree/DESENVOLVIMENTO.md:1186-1192 — o precedente de queda do worker foi o cálculo das rodadas (22,7 s medidos), hoje com memo por desenho; não há medição do caminho do histórico aberto
- **Regra do catálogo:** cabecalho.limite-de-linhas-do-desenho; cabecalho.historico-abre-com-clique
- **Cenário:** Sessão orquestradora longa (centenas de pedidos, vários cartões). A pessoa abre "+N pedidos anteriores" com uma tarefa em andamento: a cada segundo o layout percorre a sessão inteira, monta milhares de linhas e descarta quase todas. O painel pode ficar lento ou o worker dos hooks estourar, como já aconteceu com o cálculo das rodadas. Recolher pedidos ou cartões não alivia.
- **Proposta:** Indexar as tarefas por pedido uma vez (Map), avaliar o que pende de uma linha só quando ela está aberta, guardar por desenho o panelOf de cada filha e, com o histórico aberto, montar os pedidos do fim para o começo parando ao atingir o limite de linhas. Medir antes e depois com o estado de uma sessão longa.
- **Ajuste da verificação à proposta:** Medir antes de mexer (estado real de uma sessão longa, histórico aberto e fechado). Sem número que mostre lentidão, fica como dívida: o histórico nasce fechado, MAX_ROWS limita o desenho e o aviso de painel grande cobre o excesso.
- **Verificação:** A leitura confere (drawn = whole com o histórico aberto, limitRows só no fim, panel() chamado para saber se o cartão fechado tem o que abrir, panelOf refeito por tarefa em atWork), mas o efeito é custo de cálculo que o código não mostra e ninguém mediu.

### Texto com caractere de controle ou meio par substituto entra no SVG sem filtro
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/tools.ts:86-93 — o título do pedido vindo do prompt costuma ser trocado pelo `request` do primeiro plan, o que reduz a exposição do corte de panel.ts:164
  - task-tree/hooks/tool-call.ts:108 e task-tree/hooks/turn.ts:120 — mais dois cortes por unidade UTF-16 (o texto da carta em 200 e a resposta em 600)
  - task-tree/DESENVOLVIMENTO.md:913-921 — o app passa a fonte do Svg pelo DOMPurify (perfil svg); o que acontece com caractere de controle ou substituto solto no modo imagem não está registrado
- **Regra do catálogo:** sem cenário
- **Cenário:** A pessoa cola saída de terminal com sequências ANSI no começo do prompt, ou o prompt tem um emoji exatamente na posição 59/60. O título do pedido fica com U+001B ou com meio emoji. O SVG dessa linha deixa de ser XML bem-formado: se o app carrega o Svg como imagem, a linha (ou o cabeçalho, se for o título) aparece quebrada ou vazia; se converte com encodeURIComponent, um substituto solto lança erro. O harness não vê: ele não pinta.
- **Proposta:** Em xml(), remover os caracteres proibidos em XML e os substitutos soltos. Trocar os quatro cortes por corte em pontos de código (Array.from, como fit). Teste: título com \u001b e com emoji na borda do corte, conferindo que o source é XML válido.
- **Ajuste da verificação à proposta:** Filtrar em xml() (caracteres proibidos em XML e substitutos soltos) resolve todos os cortes de uma vez; trocar os cortes por pontos de código é opcional. Incluir os dois cortes acima na lista. O teste só confere a fonte; o efeito no app vai ao checklist.
- **Verificação:** Conferi que xml() (svg.ts:128-129) só troca & < > e aspas, que nenhum arquivo do mod filtra caracteres de controle (busca sem resultado) e que os cortes citados são por unidade. O dano depende de como o app carrega a fonte, que o código não mostra.

### O relógio de 1 s e os cliques disparam promessas sem catch (void), ao contrário do poll: uma rejeição fica sem tratamento no worker dos hooks
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/sessions.ts:306-314 — openSession já tem try/catch por dentro; o `void` dele só falha se o toast falhar
  - task-tree/DESENVOLVIMENTO.md:1186-1192 — a queda registrada do worker foi por tempo de cálculo, 'sem exceção no log'; não é precedente de rejeição sem tratamento
  - Nada no código nem na doc mostra $.state.get rejeitando
- **Regra do catálogo:** sem cenário
- **Cenário:** Com uma tarefa em andamento o relógio dispara a cada segundo. Se anyRunning lançar (uma leitura de estado que falha, um grupo fora do formato), tick rejeita a cada segundo, o ticker nunca é cancelado (o cancelamento fica depois do await) e a rejeição não tem quem a trate. O efeito depende do host, que o código não mostra: pode ser só ruído, ou derrubar o worker, o que descarrega o mod, como já aconteceu por outro motivo.
- **Proposta:** Dar ao tick o mesmo tratamento do poll: () => tick($).catch(err => debug(...)), com try/catch em volta de anyRunning que, em falha, cancela o ticker (o próximo desenho ou chamada o religa). Nos cliques, trocar void f() por f().catch(err => debug(...)).
- **Ajuste da verificação à proposta:** Proposta ok como endurecimento barato: tick($).catch com registro no debug, e setFold/closeOpened com catch. Não precisa cancelar o relógio na falha: basta não deixar a rejeição solta.
- **Verificação:** Conferi sessions.ts:271-283 e 297 (tick sem try em volta de anyRunning, chamado com void) contra o poll (255, com catch), e render.tsx:55 e 351. A assimetria existe; o efeito de uma rejeição solta no worker depende do host.

### Desenho e cabeçalho: largura da linha, título sem tarefa acesa e "só verificável no app" divergentes do código
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:558` — "A largura é `lineWidth(bodyColumns)` = `clamp(240, colunas × 8 − 8, 900)`".
  - `task-tree/draw/geometry.ts:16-28` — `COL_PX = 7.2`, `MIN_W = 240`, `MAX_W = 1400`; `lineWidth = max(240, min(1400, floor(colunas × 7.2)))`.
  - `task-tree/DESENVOLVIMENTO.md:316-321` — Título sem tarefa em andamento: "… senão o ÚLTIMO nível 1 com sessão viva embaixo (…); senão a primeira aberta".
  - `task-tree/hooks/render.tsx:264-270` — O último recurso é `newest[0]`: o nível 1 planejado por último, aberto ou não.
  - `task-tree/DESENVOLVIMENTO.md:626` — "`turn.step` (modelo e esforço): o kit não tem implementação base para o evento em stream" (lista do que só o app mostra).
  - `task-tree/tests/kit/ambiente.ts:203` — O kit dispara `$.turn.step(...)`; `tests/taxa.test.ts` (linhas 18-60) mede o toks/s por ele.
- **Regra do catálogo:** cabecalho.titulo-e-a-ultima-iniciada
- **Cenário:** Quem ajusta um corte de título ou investiga "o desenho corta à direita" calcula a largura pela fórmula do documento (8 px por coluna, teto de 900) e chega a números que o código não usa (7,2 px, teto de 1 400). Quem lê a regra do título espera "a primeira aberta" num painel sem nada iniciado e vê o nível 1 mais recente.
- **Proposta:** Corrigir os três trechos do documento (ou trocar a fórmula por um ponteiro para `draw/geometry.ts`), tirar `turn.step` da lista do que só o app mostra e limpar o comentário do `drawDesktop`.

### Palavras de estado do subagente divergem entre o cartão próprio, o cartão de grupo e o grupo antigo
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:1414-1430` — Cabeçalho do cartão de grupo: `failed` junta 'failed' e 'interrupted' e a palavra é sempre 'interrompido'; com agentes vivos, a falha de um não aparece no cabeçalho.
  - `task-tree/draw/layout.ts:1468-1487` — Com `sub`, o cabeçalho usa só `SUB_WORD[s.state]`; sem `sub` (grupo antigo), um grupo com tarefa ✕ diz 'interrompido'. Um subagente que terminou normalmente deixando tarefas abertas (viram ✕) mostra '✓ concluído' com ✕ dentro.
  - `task-tree/hooks/turn.ts:156-162` — O fim normal grava `state: 'done'` e, em seguida, interrompe o que ficou aberto.
  - `task-tree/state/tasks.ts:101-110` — begin reabre a tarefa sem limpar `failed`.
  - `task-tree/draw/layout.ts:1047` — Qualquer interrupção posterior de uma tarefa com `failed` é escrita como 'falhou'.
  - `task-tree/hooks/agents.ts:187-193` — settleBySubs só acrescenta `failed`; num fim 'interrompido' não o retira.
- **Regra do catálogo:** subagentes.cartao-mostra-modelo-e-estado; turnos.subagente-que-termina-interrompe
- **Cenário:** Quatro subagentes juntos, um falha por erro de API e os outros concluem: o cabeçalho diz '4 subagentes · interrompido' (a regra distingue 'falhou' de 'interrompido'). Um subagente que usa o painel e termina com duas tarefas abertas: cartão '✓ concluído' com duas linhas ✕ dentro, e a tarefa de origem fecha ✓.
- **Proposta:** No cartão de grupo, usar 'falhou' quando algum falhou e contar ('1 falhou') mesmo com outros vivos. Decidir se subagente que deixou tarefas abertas conta como 'concluído' ou 'interrompido' para o cartão e para a tarefa de origem.

### Faixa "interrompido" só aparece quando nada conta; com 1 ✓ e várias ✕ a faixa é verde "concluído", e nenhum teste afirma o cinza
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:615-623` — headerState: concluído quando n > 0, d === n e sem pendentes; interrompido só é alcançado com n === 0 e x > 0, porque as interrompidas ficam fora de n.
  - `regras/visual.md:206-215` — visual.faixa-de-estado-geral: "verde com tudo concluído; cinza com o que ficou interrompido", sem dizer qual vence; também não define pendentes com filha trabalhando (o código dá azul).
  - `task-tree/tests/visual.test.ts:14-50` — Os dois testes citam "interrompido" no nome, mas afirmam paused, current, done, running e, depois do Esc, só not.toBe('current').
  - `task-tree/draw/svg.ts:615-623` — a ordem é: em andamento, aguardando, sessão ativa, concluído (n > 0, d = n, sem pendentes), interrompido (x > 0, sem pendentes). Sem folha aberta d = n sempre, então o cinza só sai quando n = 0 (toda folha à vista é ✕); com ✓ e ✕ juntos vence o verde, e com pendentes sobra o âmbar claro
  - `task-tree/tests/visual.test.ts:44-49` — depois do Esc o teste só pede not.toBe('current'); nesse roteiro o resultado real é 'running' (a filha segue viva), nunca 'interrupted'
  - `regras/visual.md:206-215` — o Então lista o cinza sem dizer quando ele vence o verde ou o âmbar claro; "o estado vai ao texto alternativo" também não é afirmado por teste próprio
- **Regra do catálogo:** visual.faixa-de-estado-geral (A faixa à esquerda do cabeçalho diz o estado geral pela cor)
- **Cenário:** Um pedido com 10 folhas: 1 concluída e 9 interrompidas com Esc, nada pendente. O cabeçalho mostra faixa verde, "concluído", 100%, "1 de 1" e a pílula "9 interrompidas".
- **Proposta:** Escrever no cenário a precedência escolhida e afirmar o estado "interrupted" num teste (hoje o ramo cinza não tem asserção).
- **Pergunta ao usuário:** Com tudo fechado e pelo menos uma tarefa interrompida, a faixa deve ser cinza "interrompido" (recomendado: o verde sugere que tudo foi feito) ou verde, como hoje, sempre que alguma folha foi concluída?

### Depois de um plan num pedido novo (antes do start), o título do cabeçalho é o de um pedido que saiu do desenho
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/render.tsx:256-270` — o título sai de mainTasks (todas as tarefas da sessão): a tarefa iniciada por último, feita ou não, mesmo que esteja fora do trabalho
  - `task-tree/hooks/render.tsx:274-275` — os números saem só das linhas desenhadas
  - `task-tree/hooks/tools.ts:109-113` — o plan num pedido novo já começa trabalho novo (joinWork com fresh), antes de qualquer start
  - `task-tree/tests/cabecalho.test.ts:35-58` — o teste do pedido finalizado sempre faz plan e start juntos; o intervalo entre os dois não é visto
  - `task-tree/hooks/render.tsx:256-270` — mainTasks são todas as tarefas da sessão (sem o corte do trabalho); sem nada em andamento vale startedLast(mainTasks), e newest[0] só entra quando nada foi iniciado na sessão inteira.
  - `task-tree/hooks/render.tsx:271-275` — Os números vêm de shown (as linhas desenhadas): título e números passam a falar de conjuntos diferentes.
- **Regra do catálogo:** cabecalho.titulo-e-a-ultima-iniciada x cabecalho.resumida-exclui-pedido-finalizado
- **Cenário:** Pedido um todo concluído. Pedido dois: o modelo chama plan (Plano B) e demora a chamar start. O painel desenha só o Plano B, com o um em "+1 pedidos anteriores", mas o cabeçalho diz "Plano A  0 de 2 · 0%": o título de um plano escondido sobre os números do plano visível.
- **Proposta:** Em render.tsx, procurar a tarefa iniciada por último entre as tarefas desenhadas (shown) e, sem nenhuma, usar o nível 1 mais recente à vista; acrescentar o caso "plan sem start no pedido novo" ao teste do título.

### Nome de cartão cortado: a branch é desenhada assim mesmo, sobre o anel e além da borda (ela nunca é omitida)
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:349-355` — labelName corta o nome para caber exatamente com a palavra de estado e o anel.
  - `task-tree/draw/svg.ts:380-404` — Sem espaço saem repositório, modelo e taxa, e gitSvg é chamado com end - left, mesmo negativo.
  - `task-tree/draw/svg.ts:267-287` — Para um repositório git a branch tem piso de 24 px mais 17 px de ícone e nunca é omitida (só a pasta sem repositório é).
  - `task-tree/draw/layout.ts:1173` — O título do cartão ganha sufixos longos: " · pedido do usuário na filha" e " · do pedido \"…\"" (até 60 caracteres).
  - `task-tree/draw/svg.ts:349-355` — O nome é ajustado reservando só o anel e a palavra de estado (`tags`), não o repositório e a branch.
  - `task-tree/draw/svg.ts:380-404` — Sem espaço, saem repositório, modelo e taxa, mas `gitSvg` é chamado sempre que há git, com `end - left` possivelmente negativo.
- **Regra do catálogo:** visual.cartao-posicao-de-toks-e-repo
- **Cenário:** Cartão de um turno que a pessoa digitou na filha, com nome de 20 letras ou mais, a 60 colunas, filha num repositório. O nome é cortado junto ao anel; em px de W o ícone da branch cai entre W-26 e W-20 (o centro do anel fica em W-16) e 24 px do nome da branch passam da borda do cartão. No app a sobra entre a largura real e W atenua o efeito; a parte da direita é deslocada, a branch não.
- **Proposta:** Omitir a branch quando o espaço for menor que ícone mais 24 px, como o repositório, e registrar a ordem completa de corte. Conferir no app.

### Limites de largura não definidos: a indentação cresce sem teto e o título do cabeçalho e o nome da sessão ainda são cortados pela largura estimada
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/geometry.ts:30-36` — col(k) = 12 + 20·k px, sem teto de profundidade.
  - `task-tree/draw/layout.ts:106-107, 1155-1214` — Três níveis de sessão são desenhados por inteiro, cada um somando até ~5 de profundidade (cartão, pedido, três níveis de tarefa), mais os cartões de subagente.
  - `task-tree/draw/svg.ts:571-582` — A caixa do título é calc(100% − (W − edge + pad + tx)): com tx grande e as colunas de tempo, contagem e barra, a largura chega a zero, sem mínimo; e não há tooltip.
  - `task-tree/draw/svg.ts:349-355, 667` — O nome do cartão e o título do cabeçalho usam fit() contra W (estimativa por baixo), enquanto as linhas passaram a usar o corte real do CSS.
  - `task-tree/draw/svg.ts:131-135` — A faixa WIDE não cobre símbolos comuns em títulos (U+2600 a U+27BF, U+2B50) e conta ZWJ e seletores de variação como 0,56 em.
  - `task-tree/draw/svg.ts:516-543, 578-582` — Tempo, contagem, barra e busto ocupam colunas fixas a partir da direita; a caixa do título é `calc(100% - (W - edge + pad + tx))`, sem piso.
- **Regra do catálogo:** visual.largura-real (O desenho termina na borda real)
- **Cenário:** Num pane de ~430 px, uma tarefa pai com barra e contagem dentro do cartão de uma filha (profundidade 8) fica com ~60 px de título; da profundidade ~11 em diante (neta, ou subagente dentro de filha), zero: sobra o ícone e os números. Num pane largo, o título do cabeçalho é cortado antes da borda real, porque W é estimado por baixo. A largura real depende do app; a conta foi feita com as constantes do código.
- **Proposta:** Definir no catálogo um mínimo de título (ex.: 80 px) e o que cede primeiro (barra, contagem, depois a indentação comprimida a partir de certa profundidade). Passar o título do cabeçalho e o nome do cartão para o mesmo corte por CSS das linhas.
- **Pergunta ao usuário:** Em linhas muito indentadas num painel estreito, o que deve ceder primeiro para o título continuar legível? Recomendo: some a barra, depois a contagem, e a indentação para de crescer depois do 8º nível.

### Depois do fim do turno, "Aguardando sua escolha" sai de baixo da tarefa e vai para a raiz do painel
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:53-67` — halt devolve a folha iniciada com started: undefined
  - `task-tree/draw/layout.ts:1301-1306` — a espera é desenhada sob a tarefa que current() aponta no momento do desenho, não sob wait.anchor
  - `task-tree/draw/layout.ts:1380` — sem tarefa acesa, a espera do loop principal vai para o fim da lista, na raiz
  - `task-tree/hooks/tool-call.ts:83-96` — a espera guarda a âncora (askAnchor), usada só para as cartas
  - `task-tree/tests/perguntas.test.ts:91-107` — o teste só confere que a linha existe antes e depois do fim do turno, não onde
- **Regra do catálogo:** perguntas.escolha-do-wrapup-ate-proxima-mensagem; perguntas.espera-sob-a-tarefa
- **Cenário:** wrap_up com ask enquanto "Um" está ◉: a espera aparece logo abaixo de "Um". O turno termina: "Um" vira ◷ e a espera salta para o fim do painel, depois do último pedido, mesmo que "Um" seja de um pedido anterior. Se a tarefa da âncora estiver recolhida pela pessoa, a espera de uma pergunta em curso não é desenhada nem contada no chip.
- **Proposta:** Desenhar a espera sob wait.anchor quando a tarefa existe e está à vista (cair para current().anchor e depois para a raiz); com o pai recolhido, contar a espera no chip mesmo sem linha. Cenário: "a escolha fica sob a tarefa da pergunta depois do fim do turno".

### O relógio do painel não corre por causa de subagente vivo
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/sessions.ts:258-283` — `anyRunning` liga o relógio de 1 s por tarefa cronometrando, sessão viva ou carta na fila; com o turno encerrado passa `groups: []`. Subagente vivo não conta.
  - `task-tree/draw/layout.ts:760-764` — `running()` olha só `timing(tasks)` e `children.some(live)`.
  - `task-tree/draw/layout.ts:1452, 1476` — O tempo do cartão e da linha do grupo é `(s.end ?? now) - s.at`: depende de redesenho para andar.
- **Regra do catálogo:** subagentes.cartao-mostra-modelo-e-estado
- **Cenário:** Subagente em segundo plano depois do fim do turno, ou lançado de uma tarefa pendente (sem start): o tempo do cartão fica parado e só pula quando o agente troca de ferramenta ou de taxa (cada escrita redesenha). Um agente pensando por um minuto sem chamar ferramenta mostra o mesmo tempo o minuto inteiro; as tarefas próprias de um subagente em segundo plano também param de contar com o turno principal encerrado.
- **Proposta:** Em `anyRunning`, devolver true quando algum grupo tem `subLive(g.sub)` (antes do corte por `ended`), como já se faz para sessões vivas e cartas na fila.

### Tempos negativos ou inválidos são desenhados como "-1:-2": só parte dos cálculos tem guarda
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:11-16` — clockText não tem piso: -1500 ms dá s = -2 e o texto "-1:-2"; NaN dá "NaN:NaN".
  - `task-tree/draw/layout.ts:76-87, 556-565` — span, elapsed e sessionTime devolvem undefined quando to < from.
  - `task-tree/draw/layout.ts:534-538, 1052-1053, 1121-1122, 1284, 1431, 1452, 1476` — Sem guarda: timeSpan com busy (now - menor start), os dois now - plannedAt, o tempo da carta (now - s.at) e os tempos de subagente e de grupo.
- **Regra do catálogo:** sem cenário
- **Cenário:** O relógio do sistema é corrigido para trás (NTP, ajuste manual) com uma carta na fila ou um subagente rodando: a linha mostra "-1:-2" até o relógio alcançar o instante gravado.
- **Proposta:** Dar piso zero em clockText (e texto vazio para valor não finito), o que cobre todos os pontos de uma vez. Teste com relogio.advance negativo ou carta com at no futuro.

### Contagem com três dígitos invade a barra, e o "1" é medido estreito em textos com algarismos tabulares
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:427-431, 520-533` — COUNT_W é a largura de "00/00" (33,6 px); a barra fica a COUNT_W + 8 px da coluna da contagem, que é ancorada pelo fim.
  - `task-tree/draw/svg.ts:134-135, 517, 538` — emOf dá 0,32 em ao "1", mas o tempo é desenhado com tabular-nums; a borda do título é R - textW(t) - 8.
- **Regra do catálogo:** visual.titulo-sem-contagem-vai-ate-o-tempo
- **Cenário:** Um pedido da orquestradora que soma as folhas das filhas chega a "112/340": o texto (cerca de 47 px) passa dos 33,6 px reservados mais os 8 px de folga e cobre uns 5 px da barra; "1000/1200" cobre metade dela. Num título cortado ao lado de um tempo como "11:11", o "…" encosta ou entra 1 a 3 px no tempo.
- **Proposta:** Calcular a posição da barra pela largura real da contagem da linha (com mínimo "00/00") e medir os textos tabulares com a largura de dígito cheio.

### Sem tarefas, mas com chips (filha ativa, aviso, subagente): o desktop desenha "Tarefas 0% 0 de 0" com pílulas, e o alt e o terminal dizem "Nenhuma tarefa planejada"
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:645, 663-666` — O SVG só é "vazio" com n === 0 e nenhum chip.
  - `task-tree/hooks/render.tsx:297-299, 313-319` — O alt e o terminal usam n + x === 0; o terminal nem desenha a linha de chips nesse caso.
  - `task-tree/tests/kit/leitura.ts:132-135` — O kit devolve vazio: true e chips zerados ao ver "Nenhuma tarefa planejada."
- **Regra do catálogo:** sem cenário
- **Cenário:** A sessão abre uma filha, lança um subagente ou recebe um pedido de permissão antes de qualquer plan. No app o cabeçalho mostra "Tarefas", "0%", "0 de 0" e a pílula "1 sessão ativa". O texto alternativo diz "Nenhuma tarefa planejada, estado geral: sessão ativa", e o harness lê um cabeçalho vazio, sem chips.
- **Proposta:** Usar uma só condição de vazio nos três lugares (sem tarefas e sem chips) e desenhar os chips também no terminal quando existirem.

### Numa worktree, o "repositório" mostrado é o nome da pasta da worktree, não o do repositório
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/io/git.ts:76-87` — Com `.git` arquivo ("gitdir: …"), o HEAD é lido do gitdir, mas `repo` é `basename(dir)`, a pasta onde o `.git` foi achado.
  - `task-tree/io/git.ts:1-12` — O cabeçalho cita o pedido ("qual repositório e qual branch a sessão está trabalhando") e define repositório como "its folder's name".
  - `regras/sessoes.md:155-163` — O cenário diz "o repositório e a branch", sem tratar worktree nem submódulo.
- **Regra do catálogo:** sessoes.toks-e-repo-branch-no-cartao: O cartão mostra toks/s, repositório e branch.
- **Cenário:** Uma filha aberta com worktree própria (pasta `…/.claude/worktrees/<nome>` ou uma pasta irmã). O cabeçalho dela e o cartão na mãe mostram `<nome da pasta da worktree>` e a branch; o nome do repositório não aparece. Várias filhas em worktrees do mesmo repositório parecem trabalhar em repositórios diferentes.
- **Proposta:** Quando o gitdir aponta para `<repo>/.git/worktrees/<n>`, usar o nome da pasta do repositório principal (o pai do `.git`), com a pasta da worktree no tooltip.
- **Pergunta ao usuário:** Numa worktree, o cartão deve mostrar o nome do repositório principal ou o nome da pasta da worktree? Recomendo o do repositório principal, com a pasta da worktree no tooltip.

### "Turno" tem dois sentidos: o pai acende sem start depois de um aviso do app, mas aguarda depois de uma mensagem da pessoa
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/layout.ts:599-607, 1538` — trail() acende o caminho da última iniciada se ela começou depois do início do último turno gravado (lastTurnAt), que é a última mensagem que abriu pedido, não o turno do motor.
  - `task-tree/hooks/prompt-submit.ts:21, 66-80` — Aviso do app, hand-back e notificação de tarefa não abrem turno: o início do 'turno' continua sendo o da mensagem da pessoa.
  - `regras/arvore.md:48-57` — O cenário fala em 'última tarefa iniciada no turno' e 'no mesmo turno', sem dizer qual turno.
  - `regras/turnos.md:69-77` — turnos.continuacao-sem-start-aguarda: mensagem que continua o plano, sem start, deixa pai e pedido ◷.
  - `task-tree/tests/turnos.test.ts:76-89` — O teste da continuação usa só mensagem da pessoa, com o relógio avançado.
- **Regra do catálogo:** arvore.pai-em-andamento-no-caminho-da-ultima-iniciada (O pai aberto fica em andamento no caminho da última tarefa iniciada no turno)
- **Cenário:** Pedido com Um concluído e Dois pendente; o turno termina (pai e pedido ◷). Chega o aviso de uma sessão filha: o painel volta a desenhar o pai e o pedido em ◉ antes de qualquer start, porque a última iniciada é do mesmo 'turno' (a mesma mensagem). Se, no lugar do aviso, a pessoa escreve "continua", o pai e o pedido ficam ◷ até o start.
- **Proposta:** Definir nos dois cenários o que conta como turno. Se a intenção é "◉ só com start no turno do motor", usar o momento do último wake/prompt (de qualquer origem) como início; se é "por pedido", dizer isso no texto dos cenários e cobrir o aviso do app com teste.
- **Pergunta ao usuário:** Depois de um aviso do app (sessão filha terminou), o pai e o pedido devem acender ◉ antes do primeiro start? Recomendo que fiquem ◷ até o start, igual à mensagem da pessoa.

### Título do cabeçalho, nome da sessão e branch são cortados contra a largura estimada; só o título das linhas usa a largura real
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/svg.ts:571-582` — linha de tarefa: o corte é do CSS (foreignObject com text-overflow) na largura real do slot, porque cortar contra W "parava antes da borda real"
  - `task-tree/draw/svg.ts:349-355, 267-286, 667` — nome da sessão (labelName), branch e pasta (gitSvg) e título do cabeçalho continuam cortados em JS com fit() contra W
  - `task-tree/draw/geometry.ts:16-28` — W = colunas × 7,2 é um piso da largura real (a medida na máquina do usuário foi 8,6 px por coluna)
  - `regras/visual.md:27-47` — sem tooltip, o texto cortado não pode ser lido inteiro; a regra de ir até o tempo/borda só fala das linhas de tarefa
- **Regra do catálogo:** visual.titulo-sem-contagem-vai-ate-o-tempo; visual.tooltip (lista "título, nome de sessão, repositório, pasta ou branch")
- **Cenário:** Num painel mais largo que a estimativa (o caso normal, já que W erra para menos), um título de cabeçalho longo, um nome de sessão ou uma branch comprida aparecem com "…" com espaço livre à direita, enquanto a linha de tarefa logo abaixo usa a largura toda. O efeito visível depende da largura real do app, que o código não mostra.
- **Proposta:** Levar o título do cabeçalho e o nome da sessão para o mesmo corte por CSS (foreignObject com a largura do slot menos o que fica à direita); a branch pode seguir o mesmo caminho. Registrar a regra num cenário (ou estender visual.titulo-sem-contagem-vai-ate-o-tempo).

### O chip 'sessões ativas' conta cartões, não sessões
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/render.tsx:276, 289-291` — o chip e o estado geral usam tally(r => r.live): uma por linha de cartão viva
  - `task-tree/draw/layout.ts:418, 1188` — com a sessão rodando, todo cartão dela com tarefa aberta é marcado running, logo live
  - `regras/cabecalho.md:53-61` — cabecalho.chips-contam-folhas não define o chip de sessões
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma filha rodando com tarefa aberta em dois cartões (duas rodadas, ou abertura e turno próprio): o cabeçalho diz '2 sessões ativas' (simulado: duas linhas vivas para uma sessão).
- **Proposta:** Contar ids de sessão distintos (Row.sid) entre as linhas vivas. Cenário no catálogo para o chip.

## Durabilidade, recarga e I/O

20 achados: 0 de severidade alta, 13 média, 7 baixa.

### Store do plugin tem teto de 4 MiB: ao estourar, o painel para de ser salvo em silêncio e a poda nunca mais roda
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/state/durability.ts:176 — é o único `$.store.delete` do mod; nenhum `$.store.keys()` em lugar nenhum
  - medida de hoje (só contagens e tamanhos): ~/.claude/plugins/store/task-tree_inline-….json com 591 KB (14% do teto): session 30 chaves/282 KB, links 137/116 KB, work 139, turn 93, asks 13/9 KB, view 5
  - task-tree/state/durability.ts:173-177 — a poda só tira `session:` além das 30, então mesmo rodando ela não devolveria espaço depois do teto: não há caminho de recuperação
- **Regra do catálogo:** durabilidade.respawn-sem-session-start ('o store não encolhe') é o cenário vizinho; não há cenário para store cheio
- **Cenário:** Uso normal por meses, com muitas sessões. Medida de hoje no store do clone (só tamanhos e contagens): 548 KB; 30 chaves `session:` (240 KB, podadas), 136 `links:` (113 KB em 18 dias), 138 `work:`, 92 `turn:`, e sobras de prefixos que não existem mais na tabela (`asks:` 13 chaves, 8 KB; `view:` 5). Quando a soma passar de 4 MiB, todo `store.set` rejeita: saveGroups falha na primeira linha e não chega à poda, persist engole, nada vai ao log. O painel segue certo na tela, mas no próximo reinício, `/model` ou retomada volta a última versão salva (ou vazio) e as ligações dos cartões somem. Não há recuperação sozinha, porque a poda só roda depois de uma gravação que deu certo.
- **Proposta:** (a) Podar junto com `session:` os `work:`, `links:` e `turn:` das sessões fora das 30, e apagar uma vez as chaves de prefixos órfãos (`asks:`, `view:`), com `$.store.keys()`. (b) Podar antes de gravar; se o `set` falhar, podar mais e tentar de novo. (c) Registrar a falha no log de depuração (uma vez por motivo) e dizer no `/task-tree`. (d) Cenário novo em regras/durabilidade.md: store cheio não perde o painel em silêncio.
- **Ajuste da verificação à proposta:** Sem correção de rumo. Acrescentar: (a) a poda de `work:`, `links:` e `turn:` deve poupar as sessões ainda listadas em `sessions`; (b) apagar `asks:` e `view:` uma vez (prefixos sem linha na TABLE); (c) o log de falha uma vez por motivo, como readPublished já faz.
- **Verificação:** O contrato do kit (index.d.ts, `store.set`: 'Rejects … a store over 4 MiB of JSON text in all') e o código batem com o achado: `work:`, `links:` e `turn:` nunca são apagados e as quatro gravações engolem a falha sem log. Hoje está longe do teto, por isso média e não alta.

### /clear e retomada não mexem nas ligações das filhas: cartões antigos caem sob tarefas novas que reusam o id
- **Categoria:** omissão · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/draw/layout.ts:1288, 1525-1530 — logo depois do /clear, antes de qualquer plano novo: as filhas vivas são desenhadas soltas no fim (alive, loosen) e entram na contagem, então o painel não fica 'Nenhuma tarefa planejada.'; as paradas somem sem linha '+N' para abrir (left = 0)
  - task-tree/DESENVOLVIMENTO.md:96 — a doc descreve o clear como 'esvazia grupos, waits, sends e work', sem falar das ligações
  - A parte da retomada com filhas depende de retomada no mesmo processo dentro do app desktop, que nada no código nem na doc mostra acontecer (no terminal não há filhas)
- **Regra do catálogo:** durabilidade.clear-esvazia (O /clear esvazia o painel); durabilidade.reinicio-restaura-do-store
- **Cenário:** Uma orquestradora com filhas ligadas a "1" e "2" recebe /clear. O painel esvazia, mas o state mantém as filhas com anchor, lastAnchor e rounds apontando para "1" e "2". No pedido seguinte o modelo planeja de novo "1", "2" (ids que os planos repetem): os cartões das filhas antigas aparecem sob as tarefas novas, com o ícone de sessão e somando no x/y delas; uma filha antiga ainda trabalhando deixa a tarefa nova em andamento. Na retomada dentro do mesmo processo, os grupos passam a ser os da sessão retomada e as ligações continuam as da sessão anterior. Depende de o app continuar listando as filhas depois do /clear (a lista é por família de sessão do app; o código não mostra o contrário).
- **Proposta:** No clear: tirar as âncoras das filhas (anchor, lastAnchor, rounds[].anchor) no state e em keptLinks, e zerar launches e ended; as filhas vivas ficam soltas no fim, as demais como histórico. No resume: trazer o registro de ligações da sessão retomada (restoreLinks com o id dela, substituindo). Estender os cenários durabilidade.clear-esvazia e reinicio-restaura-do-store com filhas.
- **Ajuste da verificação à proposta:** A pergunta ao usuário continua valendo (cartão de filha aberta antes do /clear: some ou fica solto enquanto trabalha). No clear, zerar também as dobras (collapsed), que hoje valem para o pedido 1 novo. Antes de implementar, confirmar no app se a lista de sessões segue trazendo as filhas depois do /clear.
- **Pergunta ao usuário:** Depois do /clear, o cartão de uma filha aberta antes dele: some (histórico) ou fica solto no fim enquanto ela trabalha (recomendado)?
- **Verificação:** Conferi session-start.ts:72-78 (children, launches, ended, keptLinks e collapsed ficam), resolveAnchor (layout.ts:217-228: sem tarefa renomeada devolve o id puro, que passa a ser a tarefa nova) e panel.ts:161-179 (o id do pedido volta a 1). O efeito depende de o app continuar listando as filhas depois do /clear, que o código não mostra; por ser borda (limpar uma orquestradora com filhas), fica em média.

### Retomada (resume) num processo vivo troca só grupos, work e turno, e só se o store tiver cópia; o resto fica da sessão anterior
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/durabilidade.test.ts:100-122 — o próprio catálogo trata a retomada com outro painel no state como fluxo real (teste em duas partes), sempre com cópia no store
  - task-tree/state/durability.ts:166-178 — sem cópia, a escrita seguinte grava o painel antigo sob o id da sessão retomada (saveStore e saveGroups usam $.session.id() do momento)
  - No caso (b), esperas que sobrevivem a um turno são só as de wrap_up com pergunta, e cartas e filhas só existem no app desktop: essa parte depende de a retomada no mesmo processo acontecer no app, que o código não mostra
- **Regra do catálogo:** durabilidade.reinicio-restaura-do-store (O reinício e a retomada restauram o painel do store)
- **Cenário:** No mesmo processo, a pessoa retoma outra sessão. a) Se essa sessão não tem painel no store (nunca usou o mod, ou saiu das 30 guardadas), o painel da sessão anterior continua desenhado e a próxima escrita o grava sob o id da sessão retomada. b) Com painel no store, as cartas (sends) e esperas da sessão anterior ficam: uma carta ancorada em "1" aparece sob a tarefa "1" da sessão retomada (os ids de nível 1 se repetem entre sessões), e "Aguardando sua escolha" da outra sessão segue no painel.
- **Proposta:** Na retomada: sem cópia no store, esvaziar o painel (como o clear) em vez de manter o anterior; sempre zerar waits, brief e recap; trazer as ligações da sessão retomada (restoreLinks com o id dela, substituindo). Confirmar no app/CLI se a retomada no mesmo processo acontece (no app cada sessão costuma ter o seu processo).
- **Ajuste da verificação à proposta:** Tratar em duas partes: (a) retomada sem cópia no store deixa o painel da sessão anterior e o grava sob o id novo: confirmado pela leitura; esvaziar o painel nesse caso é comportamento novo e pede cenário próprio no catálogo. (b) cartas, esperas e ligações da sessão anterior: conferir primeiro no app se a retomada no mesmo processo existe; se não existir, basta zerar waits, brief e recap.
- **Verificação:** Conferi session-start.ts:79-83 e panel.ts:380-384, 697-703, 87-97: restore, restoreWorkOf e restoreTurn não fazem nada sem cópia no store, e nada toca waits, sends, children, received, launches, brief ou recap; durability.ts:57-64 confirma que as ligações não voltam em 'resume'.

### Processo novo com o turno gravado como "em curso" (app fechado ou morto no meio do turno) desenha ◉ e roda o relógio sem turno nenhum
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:33 — no primeiro turno da sessão o wake não grava nada (turnEnded ainda é undefined), então o store nem tem o registro `turn`: restoreTurn sai sem escrever (panel.ts:91-92) e o efeito é o mesmo (ended undefined, nada parado)
- **Regra do catálogo:** durabilidade.fim-do-turno-sobrevive-ao-reinicio (só cobre o turno que terminou antes do reinício)
- **Cenário:** A sessão está no meio de um turno (tarefa ◉) e o app é fechado, o computador reinicia ou o processo é morto: turn.complete não roda. Ao reabrir, session.start traz ended=null: a tarefa aparece ◉ "em andamento", o tempo dela e o do cabeçalho correm e o painel é redesenhado a cada segundo, até a pessoa mandar uma mensagem e esse turno terminar.
- **Proposta:** No session.start de processo novo (state vazio), se o registro `turn` do store tem ended null e há tarefa iniciada, gravar o fim agora (turnEnded = último startedAt/endedAt conhecido ou o relógio) antes do primeiro desenho; o respawn sem session.start (worker que caiu no meio do turno) fica como está. Cenário e teste no par 1/2 (sem fimDoTurno) e 2/2 (iniciarSessao).
- **Ajuste da verificação à proposta:** A condição da proposta precisa cobrir também 'sem registro `turn` no store', não só 'ended null': no session.start de processo novo (state vazio), havendo tarefa iniciada e aberta, gravar o fim do turno antes do primeiro desenho. A pergunta (◷ ou ✕) segue; a decisão de 2026-10-27 ('◉ só no caminho da última iniciada no turno atual') aponta para ◷.
- **Pergunta ao usuário:** Se o app fechar no meio de um turno, ao reabrir a tarefa que estava em andamento deve aparecer ◷ aguardando (recomendado) ou ✕ interrompida?
- **Verificação:** Conferi wake e saveTurn (panel.ts:31-58), restoreTurn (87-97), session-start.ts:55-61, render.tsx:236-251 (ended só entra no modelo quando é número) e sessions.ts:258-270 (sem ended, tarefa iniciada liga o relógio). App fechado no meio do turno volta com ◉ e relógio correndo sem turno, até um novo pedido terminar.

### O painel do store é lido sem validação nem versão (o arquivo publicado tem as duas), e uma falha de leitura do store termina em gravação por cima
- **Categoria:** assimetria · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - medida de hoje no store (só forma): 30 registros `session:`, nenhum fora da forma (lista de grupos com `tasks` em lista): o caso 'store de outra forma' não ocorre com os dados atuais
  - task-tree/hooks/panel.ts:377 — com um valor que não é lista, `kept.map` lança; com um grupo sem `tasks`, `g.tasks.map` lança (só para grupo de subagente; o principal entra sem conferência)
  - task-tree/hooks/panel.ts:683 — `loaded.add('links')` antes do `try`: é a linha decisiva do caso (2) para as ligações
- **Regra do catálogo:** durabilidade.reinicio-restaura-do-store e durabilidade.respawn-sem-session-start (o store); durabilidade.formatos-antigos-do-publicado só cobre o arquivo publicado
- **Cenário:** (1) Store com forma diferente da atual (versão antiga do mod, edição à mão, bug): no session.start o hook lança; se o valor é uma lista com um grupo sem `tasks`, ele entra no state e todo desenho lança (linha "erro ao desenhar"), plan/start/done respondem "erro:", até um `/clear`. (2) Leitura do store que falha uma vez: o painel é desenhado vazio e a primeira escrita apaga do store o painel ou as ligações que ele queria preservar. (3) Uma filha em outra versão do mod publica `version: 1` com um grupo malformado: o desenho inteiro da mãe vira a linha de erro por causa de um cartão.
- **Proposta:** Um `parseGroups` (como parsePublished) usado em keptGroups e nos grupos e children do arquivo publicado: descarta o que não é grupo com `tasks` em lista e registra no log. Gravar uma versão junto do painel no store. Em restoreLinks, marcar `loaded` só depois da leitura; em `change`, não persistir quando ensureGroups falhou por erro de leitura. Proteger `adopt` e `restore` do session.start com try. Fixtures de formatos antigos do store, como já existem para o arquivo publicado.
- **Ajuste da verificação à proposta:** Juntar com os achados da versão do state/store e da leitura que falha (mesma correção: leitura conferida + não gravar por cima quando a leitura não respondeu). O `parseGroups` nos `groups` e `children` do arquivo publicado é a parte mais útil hoje, porque filhas rodam versões diferentes do mod e a versão do arquivo continua 1 enquanto ganha campos.
- **Verificação:** Os caminhos existem como descritos (cast sem conferência, `adopt`/`restore` fora de try no session.start, `change` que persiste depois de um ensureGroups que falhou). O gatilho (store de outra forma, leitura do store que rejeita, filha publicando grupo malformado) depende do host ou de outra versão do mod e não aparece nos dados de hoje.

### /clear publica o painel antes de zerar waits e sends: o arquivo publicado fica dizendo "aguardando" e com as cartas antigas
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:501 — o `work` publicado também é o antigo (lido antes do setWork)
  - A volta das cartas numa recarga a quente depende de o /clear manter o mesmo $.session.id(): o registro de ligações é gravado por id de sessão (durability.ts:163-168); se o id mudar, restoreLinks lê outro registro. O arquivo publicado fica por id local_ e não muda
  - task-tree/DESENVOLVIMENTO.md:1528 — a doc diz que o /clear tira o envio de sends: vale para o state, não para o que foi publicado e gravado
- **Regra do catálogo:** durabilidade.clear-esvazia (O /clear esvazia o painel)
- **Cenário:** Filha termina o turno com wrap_up com pergunta (espera 'choice', que fica até o próximo prompt). O usuário digita /clear nela. O painel da filha fica vazio, mas o arquivo publicado continua com waiting: true e os sends antigos. Na mãe, o cartão da filha segue âmbar "aguardando", a tarefa de origem fica "em andamento" e o relógio de 1 s não para, até a filha receber outro prompt. Se o mod recarregar antes disso, as cartas apagadas reaparecem na própria filha.
- **Proposta:** Em classicSessionStart ('clear'), zerar waits, sends (e o resto do resíduo) antes do replace, ou chamar publishPanel no fim do ramo; usar dropWaits em vez de $.state.set direto. Teste: wrap_up com ask, limpar, e o arquivo publicado (proprio()) com waiting false e sends vazios.
- **Ajuste da verificação à proposta:** A forma mais simples: zerar waits, sends, work e o fim do turno antes do replace, para a única publicação do ramo já sair limpa (e o saveLinks gravar sends vazio). Teste como proposto, lendo o arquivo publicado da própria sessão.
- **Verificação:** Conferi session-start.ts:72-78 e a cadeia replace → persist → publishPanel (panel.ts:340-346, 368-371, 491-511): waits e sends são lidos antes de serem zerados e nada publica depois; publish.ts:133 grava waiting pelo tamanho de waits; sessions.ts:79 só republica no poll de quem tem filhas. Na mãe, host.ts:154 mantém a filha 'aguardando', a tarefa de origem ◉ e o relógio ligado até o próximo prompt da filha.

### Os grupos de subagente nunca saem do estado: crescem sem limite e são regravados a cada mudança
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1311 — o cartão de subagente só é desenhado sob tarefa aberta (`t.status === 'open' ? drawKids(...) : []`): terminado, sob tarefa fechada, ele já não aparece em lugar nenhum, nem com '+N pedidos anteriores' aberto
  - task-tree/draw/layout.ts:752 e 1384 — grupo sem âncora (`anchor === undefined`) nunca sai do corte e é desenhado no fim da lista para sempre (só acontece quando o lançamento não achou tarefa nenhuma)
  - task-tree/hooks/agents.ts:119-133 — com o subagente rodando, cada troca de ferramenta (no máximo 1 por segundo por agente) passa por `change`: state, store (saveGroups) e publicação com todos os grupos
  - medida de hoje no store (só contagens): uma sessão guarda 59 grupos de subagente
- **Regra do catálogo:** subagentes.terminado-segue-cartao (o cartão fica ao terminar; nada diz até quando o grupo fica no estado)
- **Cenário:** Sessão longa com vários workflows de dezenas de agentes: centenas de grupos terminados ficam em `groups`. Cada start/done/plan e cada escrita de ferramenta de subagente serializa todos eles para o store e para o arquivo publicado; `settleBySubs` e `launchAnchor` varrem todos a cada lançamento e fim de turno. A análise original perguntava se 'subagentes terminados de pedidos antigos saem com o pedido'; a resposta não está no catálogo.
- **Proposta:** Podar os grupos terminados sem tarefas próprias cuja âncora não existe mais ou pertence a um pedido fora do trabalho atual (por exemplo em `openTurn` ou quando `joinWork` começa trabalho novo), ou manter no máximo N terminados. Registrar a decisão em regras/subagentes.md.
- **Ajuste da verificação à proposta:** A poda dos terminados cuja tarefa de origem está fechada não muda o desenho de hoje (já ficam escondidos); o único efeito visível é que um `start` que reabre a tarefa deixa de trazer os cartões antigos de volta: dizer isso na pergunta ao usuário. Manter os que têm tarefas próprias e os que ainda seguram `settleBySubs` (âncora em folha aberta). O histórico do grupo principal (tarefas e turnos) não entra na poda: 'Ficam em +N pedidos anteriores' é decisão de 2026-11-04.
- **Pergunta ao usuário:** Subagentes terminados de pedidos antigos podem ser apagados do estado quando o pedido sai do trabalho atual (deixam de aparecer em '+N pedidos anteriores')? Recomendo apagar os que não usaram o painel e manter os que têm tarefas próprias.
- **Verificação:** Conferi todos os pontos que mexem em `groups`: só o /clear e o resume tiram grupos; agentSpawn só acrescenta. Cada `change` regrava todos no state, no store e no arquivo publicado, e um workflow grande multiplica isso por agente e por segundo.

### Arquivos publicados nunca são apagados, crescem sem teto e são relidos por inteiro a cada 3 s
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:3419-3540 — `$.fs` tem read, write, list, exists, stat e ancestors: não existe apagar, então o item (d) da proposta não é possível pelo kit
  - task-tree/hooks/sessions.ts:66-69 — o custo já foi notado e reduzido em parte (o state só é gravado quando a lista muda, '220 KB in the real case'); a leitura, o JSON.parse e os dois JSON.stringify por poll continuam
  - task-tree/io/publish.ts:148-149 — a cada publicação o corpo inteiro (com os painéis das filhas) é serializado só para comparar com o anterior
  - medida de hoje: 123 arquivos, 3,5 MB, o maior com 816 KB (de 2026-10-23)
- **Regra do catálogo:** sem cenário
- **Cenário:** Medida de hoje: 123 arquivos, 3,5 MB em 18 dias, o maior com 816 KB; nenhum foi apagado desde 2026-10-23. Uma orquestradora de sessão longa relê e interpreta, a cada 3 s, os arquivos de todas as filhas (arquivadas inclusive), compara a lista inteira por JSON e republica o próprio arquivo com os painéis de todas dentro; a avó faz o mesmo um nível acima. O custo cresce com o histórico e com a profundidade, sem limite (o limite de 600 KB vale só para o desenho).
- **Proposta:** (a) Um `$.fs.list` da pasta por poll e releitura só dos arquivos cuja data ou tamanho mudou. (b) Não reler filha arquivada depois da primeira leitura. (c) Publicar os painéis das filhas já cortados ao trabalho atual. (d) Limpeza: apagar o arquivo de sessões que o host não lista mais, ou por idade.
- **Ajuste da verificação à proposta:** (d) Trocar 'apagar' por regravar o arquivo com um corpo mínimo (o kit não apaga) ou deixar a limpeza para um script fora do mod. (c) Publicar as filhas já cortadas ao trabalho atual tira, na avó, o '+N pedidos anteriores' de dentro dos cartões das netas: bate na decisão de 2026-11-04 ('Ficam em +N pedidos anteriores') e precisa ir como pergunta. (a) e (b) não mudam comportamento visível e podem ir direto; `tasks` duplicado é compatibilidade com versões antigas do mod (comentário de publish.ts:100-102), tirar é decisão do usuário.
- **Pergunta ao usuário:** O arquivo publicado ainda precisa levar `tasks` (cópia do grupo principal para versões antigas do mod) e o histórico inteiro das filhas? Recomendo tirar a cópia `tasks`, publicar as filhas cortadas ao trabalho atual e apagar os arquivos de sessões que o app não lista mais.
- **Verificação:** Confirmei que nada lista nem reduz a pasta, que readFiles relê e interpreta o arquivo de toda filha listada (arquivadas inclusive) a cada 3 s, e que o arquivo publicado leva `tasks` duplicado e os painéis inteiros das filhas. É custo que cresce com o histórico, não painel errado.

### A primeira gravação das ligações depois de uma recarga funde o store por cima do state que sobreviveu: cartas duplicadas ou ressuscitadas e cartões fantasmas
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:91-112 e tool-call.ts:166-171 — depois do takenNote não há publicação no mesmo hook: a janela dura até o próximo plan/start/done, fim de turno ou, em sessão com filhas, o poll de 3 s (sessions.ts:79)
  - task-tree/state/durability.ts:143-148 — em `children` (fill) o state vence campo a campo; a duplicação só atinge as listas `union` (sends, received, launches)
  - task-tree/draw/layout.ts:1276 — as duas cartas saem com a mesma chave `m:<to>:<anchor>`
  - task-tree/hooks/tool-call.ts:128-154 e sessions.ts:209-213 — sends, children e launches são gravados direto por `update`, fora do `change`: um 'ensureLinks' teria de rodar no começo do toolCall e do promptSubmit (onde o `wake` já roda), não só nos pontos do ensureGroups
- **Regra do catálogo:** durabilidade.recarga-mantem-painel-ligacoes-e-resumo (o teste semeia só o state, sem `armazem`, e não exercita a fusão)
- **Cenário:** (1) Uma carta na fila é entregue; no prompt ou na chamada seguinte o modelo recebe o lembrete e o envio ganha `noted` só no state. Um arquivo do mod é salvo antes da próxima publicação (em sessão sem filhas próprias, só no próximo plan/start/done ou no fim do turno). Na primeira publicação do módulo novo, a união acha a cópia do store diferente (sem `noted`) e a põe ao lado da do state: a tarefa passa a ter duas linhas 'Para X: …' e o lembrete 'recebimento confirmado' sai outra vez. (2) Um plan reaproveita o id de uma tarefa fechada: o envio antigo é renomeado no state, mas a cópia do store (id antigo) volta na recarga e a carta antiga aparece sob a tarefa nova. (3) Um envio que o plan descartou volta. (4) Numa sessão cujo state `children` está vazio de propósito (o host não lista mais nenhuma), 'fill' põe no state as ligações que o store só guardava para não esquecer: cartões de sessões não listadas aparecem até o poll seguinte e vão ao arquivo publicado.
- **Proposta:** Com o state mantido, o state é a verdade: restoreLinks deve sempre refazer `keptLinks`, mas só levar ao state as chaves que estão `undefined` (processo novo). Para o caso 'processo novo sem session.start que grava antes de restaurar', trazer as ligações no primeiro uso, antes de qualquer escrita (um ensureLinks nos mesmos pontos de ensureGroups), em vez da união na primeira gravação. Se a união ficar, comparar por identidade (to + anchor + at), com a entrada do state vencendo. Publicar depois de takenNote, renameAnchors e do filtro do plan. Teste: recarga com `armazem` e `estado` divergentes.
- **Ajuste da verificação à proposta:** Manter a ideia (com state mantido o state é a verdade), mas a parte 'levar ao state só as chaves undefined' sozinha perde as cartas na fila no respawn sem session.start, porque um SendMessage ou um Agent grava a chave antes da primeira publicação: o ensureLinks precisa rodar antes de qualquer escrita das ligações (começo do toolCall e do promptSubmit). Corrigir também o comentário de panel.ts:622-628, que diz que a recarga esvazia o state. O caso (4) dura até o poll seguinte e é o mesmo comportamento do processo novo; pode ficar fora.
- **Verificação:** Reproduzi pela leitura: toda recarga zera `loaded`, a primeira publicação chama restoreLinks e a união compara por JSON inteiro, então a cópia do store sem `noted` (ou com a âncora antiga, depois do renameAnchors) entra ao lado da do state. Só acontece com um arquivo do mod salvo dentro da janela entre a mudança só no state e a publicação seguinte, o que é uso real nesta máquina (o clone recarrega em todas as sessões a cada save).

### A premissa 'a recarga não roda session.start' contradiz o contrato do kit da versão em uso
- **Categoria:** contradição · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:1 e 4605-4612 — tipos da 2.1.321; o CLAUDE.md e a CI citam 2.1.308 (.github/workflows/test.yml:25) e a pasta do app tem 2.1.317 e 2.1.321: a medição de outubro é de versão anterior
  - task-tree/hooks/tools.ts:115 — o `plan` também chama `$.ui.open` sem pedido a cada plano: o painel fechado pela pessoa já reabre no plan seguinte, com ou sem session.start na recarga
  - task-tree/hooks/session-start.ts:57-61 — com state mantido, `restore`, `restoreWork` e `restoreTurn` não fazem nada; o que rodaria de novo é `restoreLinks` (a fusão das ligações) e o `$.ui.open`
- **Regra do catálogo:** durabilidade.recarga-mantem-painel-ligacoes-e-resumo; não há cenário no catálogo sobre o painel fechado pela pessoa
- **Cenário:** Se a versão atual do app de fato dispara session.start na recarga: cada arquivo salvo no clone faz, em toda sessão aberta, registrar de novo o comando e as três ferramentas, rodar restoreLinks (a fusão do achado das ligações) e chamar `$.ui.open`: o painel que a pessoa fechou reabre sozinho a cada save de qualquer sessão. Se não dispara (como o repositório mediu em outubro), o texto do kit está à frente do comportamento e os fluxos 'sem session.start' continuam valendo. Hoje ninguém sabe qual dos dois vale: os testes de recarga só modelam 'sem session.start'.
- **Proposta:** Medir no app: uma linha no log de debug no começo de sessionStart dizendo se o state já tinha grupos (processo novo ou não), salvar um arquivo e ler o log. Conforme o resultado, corrigir durability.ts, DESENVOLVIMENTO.md e o cenário do catálogo, e acrescentar o teste que falta ('recarga com session.start e state mantido': `estado` semeado + `iniciarSessao`). Independente da medição, o `$.ui.open` do session.start deveria ser pulado quando o state já tem grupos (não é processo novo).
- **Ajuste da verificação à proposta:** A medição no app vem primeiro (uma linha de debug no começo do sessionStart). A pergunta ao usuário sobre reabrir o painel precisa incluir o `plan`, que já reabre sem pedido a cada plano; perguntar só do session.start deixaria a regra pela metade.
- **Pergunta ao usuário:** Quando o mod recarrega e você tinha fechado o painel, ele deve reabrir sozinho? Recomendo que não: abrir sem pedido só em processo novo (session.start com state vazio) e no seu próprio prompt.
- **Verificação:** O texto do kit da versão em uso diz que o session.start roda de novo, só para os hooks do plugin, numa recarga; durability.ts, DESENVOLVIMENTO.md e o cenário do catálogo dizem o contrário, 'como medido'. Qual dos dois vale no app de hoje o código não mostra.

### Tabela de durabilidade do documento diverge da `TABLE`: `turnEnded` aparece só no state, e faltam `turnAborted`, `ultracode`, `rate`, `git` e o store `turn`
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:218 e 207, 251-253 — a tabela e o texto ainda trazem a linha `view` (store `view`) e as funções `ensureView`, `restoreView` e `setView`, que não existem mais no código (a TABLE não tem `view`; só sobrou a menção num comentário de panel.ts:59)
  - task-tree/DESENVOLVIMENTO.md:220 — o `Link` da tabela não cita `openedAt`, que durability.ts:130-131 guarda
- **Regra do catálogo:** durabilidade.fim-do-turno-sobrevive-ao-reinicio: O fim do turno sobrevive ao reinício
- **Cenário:** Quem mexe no fim do turno segue o documento ("vive em state", "morre com o processo") e não chama `saveTurn` depois de gravar `turnEnded`/`turnAborted`, ou tira a volta do store por achá-la sobra. O resultado é o bug que o cenário de durabilidade protege: depois de `/model` ou de um respawn, a tarefa parada volta ◉ com o relógio correndo.
- **Proposta:** Regerar a tabela do documento a partir da `TABLE` (ou trocar a tabela por um ponteiro para `state/durability.ts`, que é a fonte), corrigindo `turnEnded`, incluindo `turnAborted`, `ultracode`, `rate`, `git`, o campo `openedAt` das ligações e o `ensureTurn` na lista de "quem traz do store e quando".
- **Ajuste da verificação à proposta:** Além do que a proposta lista, tirar a linha `view` e as menções a ensureView/restoreView/setView (linhas 207, 218, 251-253, 700 e 872-873). Trocar a tabela por um ponteiro para a TABLE evita a próxima divergência.
- **Verificação:** Comparei linha a linha: o documento diz `turnEnded | state | none` e 'vive em state', e a TABLE diz state+store `turn`, com volta em start, resume e first-use; faltam turnAborted, ultracode, rate e git, e sobra `view`. É documentação que induz a erro justo no ponto que o cenário do fim do turno protege.

### O store guarda o painel só das 30 sessões que gravaram por último (todas as sessões da máquina): sessão antiga retomada volta vazia e apaga o histórico do cartão na mãe
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - medida de hoje no store (só contagens): 139 registros `work:` e 137 `links:` para 30 `session:`: 109 sessões já não têm o painel guardado
  - task-tree/DESENVOLVIMENTO.md:119 e 232 — o KEEP = 30 está documentado como fato da implementação, sem dizer o que acontece com a sessão que sai da lista
  - task-tree/io/publish.ts:157-181 — a publicação regrava o arquivo inteiro: é ela que troca o histórico da filha pelo painel só com o pedido novo
- **Regra do catálogo:** durabilidade.reinicio-restaura-do-store (não diz o limite nem o que acontece fora dele)
- **Cenário:** Uso de orquestração: dezenas de sessões por dia, cada uma gravando no mesmo store. Uma filha fica parada alguns dias enquanto 30 outras sessões gravam; o app é reiniciado; a mãe manda mensagem nova à filha. O processo novo da filha não acha session:<id>, o painel dela nasce vazio, e na publicação seguinte o cartão dela na mãe perde todas as rodadas e ✓ anteriores. Medido nesta máquina (só tamanhos): o store do clone tem 138 registros work e 136 links, mas só 30 session (no teto): 108 sessões já perderam o painel guardado.
- **Proposta:** Trocar o corte por contagem por um corte por idade ou tamanho (ex.: manter todo painel gravado nos últimos N dias, com teto de bytes), ou guardar o painel num arquivo por sessão (como o publicado) em vez de no store único. Quando o store não tem o painel mas o arquivo publicado da própria sessão (task-tree-waits/<id local>.json) existe, restaurar dele. Catalogar o limite.
- **Ajuste da verificação à proposta:** Restaurar do arquivo publicado da própria sessão quando o store não tem o painel é a saída mais barata (ele tem `groups` e `work`), mas depende do id local_ (selfId, por MCP), que no session.start pode ainda não estar disponível: prever a volta no primeiro uso. Qualquer aumento do KEEP soma ao teto de 4 MiB do store; decidir os dois juntos.
- **Pergunta ao usuário:** Por quanto tempo o painel de uma sessão parada deve sobreviver a reinícios: enquanto a sessão existir no app (recomendado) ou um prazo fixo (ex.: 30 dias)?
- **Verificação:** Reproduzi pela leitura: a lista `sessions` é global do plugin, só as 30 que gravaram por último ficam, e uma sessão fora dela nasce vazia no processo novo e regrava o próprio arquivo publicado sem o histórico. Precisa de três condições (parada enquanto 30 outras gravam, processo novo, novo uso); com cerca de 7 sessões por dia nesta máquina, são uns 4 dias parada.

### Leitura do store que falha é tratada como "nada salvo": o painel e as ligações podem ser sobrescritos pelo estado vazio
- **Categoria:** contradição · **Severidade:** média · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/panel.ts:88, 683, 698 e 705 — os quatro `loaded.add` antes da leitura (restoreTurn, restoreLinks, restoreWorkOf, restoreWork); nos ensure* (linhas 66-78, 399-409, 425-436) a marca vem depois
  - task-tree/hooks/panel.ts:672-675 — quando a gravação das ligações falha, `lastLinks` não muda e a tentativa se repete a cada publicação, sem log
- **Regra do catálogo:** durabilidade.respawn-sem-session-start ('o store não encolhe')
- **Cenário:** Processo novo sem session.start (worker reiniciado, /model), state vazio. A primeira leitura do store falha uma vez (o arquivo do store é um só para todas as sessões da máquina, cada uma num processo, gravando nele a cada plan/start/done). (1) O modelo chama start: ensureGroups devolve undefined, o update cria o grupo principal vazio, persist grava esse painel vazio por cima do painel inteiro; na chamada seguinte o state já tem valor e 'groups' é marcado como carregado. O painel volta vazio e o store encolheu. (2) Na primeira publicação, restoreLinks marca 'links' como carregado, a leitura falha, e saveLinks grava children/sends/received/launches do state vazio: os cartões perdem a tarefa de origem para sempre.
- **Proposta:** Fazer loadStore devolver um resultado que separe 'não existe' de 'não deu para ler'. Em ensureGroups/ensureWork/ensureTurn e nos restore*, só marcar 'loaded' quando a leitura respondeu (com ou sem valor). Enquanto a leitura de uma chave não respondeu, não gravar essa chave no store (persist, saveLinks, saveTurn, setWork pulam a gravação e registram no log de depuração) e tentar de novo no uso seguinte. Mover o loaded.add de restoreLinks/restoreTurn/restoreWork para depois da leitura, igual aos ensure*.
- **Ajuste da verificação à proposta:** Sem correção de rumo. A mesma mudança resolve o caso do valor malformado (o keptGroups que lança cai no mesmo catch): tratar juntos. Registrar no log a leitura que falhou, uma vez por motivo.
- **Verificação:** O caminho no código é como descrito: ensureGroups devolve undefined tanto para 'nada salvo' quanto para 'não deu para ler', `change` segue do vazio e o persist grava por cima; os restore* marcam `loaded` antes de ler. Falta o gatilho: se o `$.store.get` do app rejeita de vez em quando (arquivo único, vários processos) o código não mostra.

### O estado "ultracode" vive só no $.state e não tem cenário para reinício, respawn, retomada nem /clear
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/turn.ts:73-81 — o `engine` (também só no state) se refaz sozinho no primeiro turn.step do processo novo; o `ultracode` não tem esse caminho: só volta com o próximo ultra_effort_enter
  - claude-code-mod-task-tree-notas/analise-ultracode-no-cartao.local.md:38-50 (análise antiga, dado) — o interruptor é estado do app/processo (settings, /effort) e o engine reenvia o enter 'full' só quando o último marcador não era enter, e o 'sparse' a cada N turnos: o caso (b), retomar outra sessão no mesmo processo, tende a não existir (o interruptor continua ligado no processo); o caso (a) fica sem a palavra até o reenvio
  - task-tree/io/host.ts:158-159 — a palavra do cartão vale só o que o arquivo diz a cada leitura: é o comportamento decidido em ultracode.cartao-da-filha ('quando ela publica sem o interruptor, a palavra some'), não lacuna
- **Regra do catálogo:** ultracode.so-o-interruptor-real e ultracode.cabecalho (nenhum fala de processo novo); ultracode.cartao-da-filha cobre o 'some quando o arquivo não diz'
- **Cenário:** (a) Sessão em ultracode, o worker é refeito (/model, crash, reinício do app): o state nasce vazio, 'ultracode' some do cabeçalho e do arquivo publicado (o cartão na mãe perde a palavra) até o engine mandar outro ultra_effort_enter, alguns turnos depois. (b) No mesmo processo, retomar outra sessão (resume) que não está em ultracode: a chave continua true e o cabeçalho e o arquivo publicado dizem 'ultracode' até um ultra_effort_exit que pode nunca vir. Depende de o engine reenviar o enter/exit nesses momentos, o que o código não mostra.
- **Proposta:** Decidir e escrever o cenário (ultracode.reinicio-e-retomada): guardar a chave no registro 'turn' ou 'session' do store por sessão (restoredAt start/resume/first-use) e zerá-la no resume de outra sessão; ou declarar no catálogo que a palavra só volta no próximo aviso do engine. Validar no app o que o engine envia depois de /model e de um resume (checklist).
- **Ajuste da verificação à proposta:** Tirar da proposta o 'zerar no resume de outra sessão' enquanto não se medir no app: o interruptor é do processo, e zerar pode apagar a palavra com o interruptor ligado. O que falta decidir é só o processo novo (respawn, /model, reinício): guardar no registro `turn` do store por sessão, ou declarar no catálogo que a palavra volta no próximo aviso do engine. Medir antes o que o engine envia depois de /model.
- **Pergunta ao usuário:** Depois de um reinício do worker ou de retomar outra sessão, a palavra 'ultracode' deve voltar na hora (guardada por sessão) ou pode esperar o próximo aviso do engine? Recomendo guardar por sessão, como o fim do turno.
- **Verificação:** Confirmei que `ultracode` vive só no state (durability.ts:68), que nada o toca em session.start, clear ou resume, e que o catálogo não tem cenário de reinício. O efeito depende de quando o engine reenvia o aviso, que o código não mostra; é só uma palavra que some por alguns turnos e volta sozinha.

### Não há um padrão único de tratamento de falha: cada hook e cada chamada ao host decide sozinha entre tratar, registrar, engolir ou deixar escapar
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - contagem conferida: 25 `catch {}` + 7 `catch {` de várias linhas = 32 nos hooks e no io; há mais 13 `.catch(() => {})`
  - task-tree/hooks/command.ts:12-22 — o command.run também tem try
  - task-tree/DESENVOLVIMENTO.md:594-611 ('Limites do kit', itens 2 e 3) — função que recebe `$` tem de ser de topo e a chave do `$.state` é literal no arquivo que chama: o auxiliar proposto precisa caber nisso (o `debug($, texto)` de io/log.ts mostra que cabe)
- **Regra do catálogo:** sem cenário
- **Cenário:** Em qualquer hook sem try, uma exceção num passo acessório (relógio, status, releitura) cancela os passos essenciais que vêm depois (abrir o turno, gravar o envio, registrar o fim do turno). Como o host segue em frente, o usuário não vê erro nenhum: vê o painel errado. Nos pontos com catch vazio, nem o log de depuração guarda o motivo, e quem investiga um "painel não atualiza" não tem por onde começar.
- **Proposta:** Criar um auxiliar único (por exemplo io/guard.ts: `step($, nome, fn)`), que roda o passo em try/catch, registra com debug() uma vez por passo e motivo, e devolve um valor padrão. Classificar os passos de cada hook em essenciais (escrita do estado do painel) e acessórios (relógio, status, publicação, releitura, lembretes): essenciais primeiro, acessórios cada um no seu step. Trocar os 32 catch vazios por esse auxiliar. Guardar o último erro de hook numa chave de estado e mostrar no /task-tree (e publicar junto com renderError), para o diagnóstico não depender do log.
- **Ajuste da verificação à proposta:** Começar pelos dois pontos de maior retorno em vez dos 32 de uma vez: log (uma vez por motivo) nas quatro gravações do store e try de topo em promptSubmit e turnComplete, com os passos essenciais (openTurn, turnEnded, saveTurn) antes dos acessórios. O último erro no /task-tree é melhoria de diagnóstico, não correção.
- **Verificação:** Os números e os exemplos batem: 17 registros, só as três ferramentas, o render e o comando com try de topo, e debug() em 4 arquivos. Para um passo lançar é preciso o host rejeitar um `$.state`/`$.clock`, o que não acontece em uso normal: é dívida de diagnóstico, sem efeito visível hoje.

### Não há versão nem migração para o formato do $.state e do store; a recarga entrega ao código novo o que o código velho gravou
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/.claude-plugin/types/claude-code/index.d.ts:740-748 — `shape` é opção do `atom`; as outras chaves usam `$.state.get/set` direto, então a versão delas teria de ser uma chave própria ou um campo do valor
  - medida de hoje no store: os 30 painéis guardados estão na forma atual
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma mudança altera a forma de uma chave (um campo obrigatório novo em Group, Sub, Send ou Child, ou a troca de sentido de um campo). No save, todas as sessões abertas recarregam com o state antigo e, nos 30 painéis do store, a forma antiga persiste para toda retomada. O desenho tem try/catch e mostra a linha de erro, mas tool.call, prompt.submit e turn.complete não: um acesso a campo ausente lança dentro do hook a cada chamada, em todas as sessões, e só sai reiniciando cada processo (o store continua velho). O caminho inverso também existe: trocar o clone para um commit mais antigo faz o código velho ler state do novo. Hoje funciona porque todo campo novo foi opcional; é convenção não escrita.
- **Proposta:** Escrever a regra no CLAUDE.md ('campo novo do state é sempre opcional; mudança de forma exige migração') e dar o mecanismo: uma chave de versão no state e nos registros do store, conferida nos ensure*/restore (forma desconhecida é ignorada e dita no log, como parsePublished faz), ou `shape` nos atoms. Cenário no catálogo: 'state ou store de outra forma não derruba os hooks'.
- **Ajuste da verificação à proposta:** O mínimo que fecha a lacuna é a convenção escrita no CLAUDE.md ('campo novo é opcional; mudança de forma exige migração') mais a leitura conferida do painel do store (a mesma do achado da leitura sem validação). Versão única com migração é escolha do usuário, como a pergunta já diz.
- **Pergunta ao usuário:** Quer que o state e o store ganhem versão com migração (recomendado: versão única + leitura conferida, valor de forma desconhecida é ignorado com aviso no log), ou basta registrar no CLAUDE.md a convenção de só acrescentar campos opcionais?
- **Verificação:** Confirmei que só o arquivo publicado tem versão, que o store é lido por cast e que o CLAUDE.md não fala de compatibilidade do state gravado. Hoje nada quebra, porque todo campo novo foi opcional: é indefinição, sem efeito visível.

### As dobras da pessoa vivem só no state: uma troca de modelo ou o respawn do worker reabre tudo
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/durability.ts:75` — collapsed: lives 'state', restoredAt []: não vai ao store.
  - `task-tree/hooks/render.tsx:17-22` — O atom folds é escrito só pelos cliques e nunca restaurado.
  - `regras/visual.md:123-131` — visual.recarga-real-e-respawn diz "nada some" e não fala das dobras.
- **Regra do catálogo:** visual.recarga-real-e-respawn
- **Cenário:** A pessoa recolhe pedidos e cartões concluídos para deixar o painel legível. Troca o modelo (/model) ou o worker reinicia: todas as linhas voltam abertas e os históricos abertos fecham. Num painel grande isso pode levar o desenho de volta para perto do limite de tamanho.
- **Proposta:** Decidir e registrar. Se devem persistir, guardar collapsed no store por sessão (como work), podando as chaves de tarefas que não existem mais.
- **Pergunta ao usuário:** As linhas que você recolheu devem continuar recolhidas depois de trocar o modelo ou reiniciar o app (recomendado: sim, guardadas por sessão)?

### Contrato do arquivo publicado: o documento lista a ordem e a normalização dos campos sem `ultracode`, `rate`, `git` e `aborted`
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:264-285` — "nesta ordem de chaves": version … engine, panes, renderError …; "sete `$.state.get`"; a normalização da leitura cobre só `waiting`, `context`, `engine`, `work`; a comparação é "o JSON dele mais o `percent`".
  - `task-tree/io/publish.ts:131-181` — O arquivo sai com `ultracode`, `rate`, `git` e `aborted` entre `engine` e `panes`; a comparação inclui a taxa e o git, sem os `at`.
  - `task-tree/io/publish.ts:36-61` — `parsePublished` valida `ultracode`, `rate` (toks, at, live), `git` (pasta ou repositório com branch) e `aborted`.
  - `task-tree/hooks/panel.ts:491-515` — `publishPanel` faz dez leituras de state e chama `refreshGit` (leitura de arquivo) a cada publicação.
  - `task-tree/io/host.ts:9-11` — O comentário cita `tests/host.test.ts`, que não existe.
- **Regra do catálogo:** durabilidade.formatos-antigos-do-publicado
- **Cenário:** O arquivo publicado é o contrato entre sessões que podem rodar versões diferentes do mod, e a seção "Arquivo publicado" é a única descrição dele em texto. Quem acrescenta um campo segue a lista "nesta ordem" e a regra "formato só acrescido" sem saber que quatro campos já entraram, nem que `rate.at` e `git.at` ficam fora da comparação de mudança (um campo novo com relógio dentro faria o arquivo ser regravado a cada publicação).
- **Proposta:** Atualizar a lista de campos e a de normalização, dizer quais relógios ficam fora da comparação e corrigir o número de leituras de state. Corrigir o comentário de `io/host.ts`.

### Publicações do painel sem ordem: uma mais velha pode gravar por último
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/io/publish.ts:116-183` — Cada publicação compara com `lastPublished`, espera o uso de contexto, os panes e o relógio, grava e só então guarda a chave; nada impede duas em curso.
  - `task-tree/hooks/turn.ts:62, 79, 103` — `void publishPanel($)` disparado sem esperar, do turn.step e do anexo do ultracode.
  - `task-tree/hooks/panel.ts:491-515` — Cada publicação lê o state no seu momento, em cerca de dez leituras seguidas.
  - `task-tree/hooks/sessions.ts:79` — Uma sessão sem filhas não publica no poll: um arquivo velho não é corrigido até o próximo evento.
- **Regra do catálogo:** sem cenário
- **Cenário:** A publicação disparada no fim do último passo do modelo (taxa nova) corre junto com as do fim do turno. Se a mais velha gravar por último, o arquivo fica sem o ↩ e sem a marca de turno parado, e `lastPublished` guarda a chave velha. Numa sessão sem filhas nada mais publica: a mãe mostra o cartão desatualizado até o próximo evento da filha.
- **Proposta:** Uma publicação por vez: marca de "publicando" e "sujo"; a que termina relê o state e publica de novo se algo chegou no meio.

### O plan publica e grava as ligações antes de renomear âncoras e de atualizar o trabalho
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tools.ts:69, 103-113` — A ordem é: change (grupos novos), depois renameAnchors, depois o filtro de sends, depois joinWork; nenhuma publicação no fim.
  - `task-tree/hooks/panel.ts:359-366, 340-346` — change chama persist, que grava o store e publica o painel na hora, com o que o estado tem naquele instante.
  - `task-tree/hooks/panel.ts:491-511, 661-678` — publishPanel lê children, sends e work do estado e grava as ligações (saveLinks): ainda com as âncoras nuas e o trabalho antigo.
  - `task-tree/hooks/sessions.ts:79` — A leitura periódica só republica quando esta sessão tem filhas.
- **Regra do catálogo:** sem cenário
- **Cenário:** Num plan que renomeia tarefas, o arquivo publicado e o registro de ligações no store saem com os grupos já renomeados, mas com as âncoras das filhas e das cartas apontando para o id nu (agora a tarefa nova) e com o work antigo. Entre o change e o renameAnchors o painel local pode desenhar um quadro com o cartão sob a tarefa nova. Numa sessão sem filhas (uma filha comum), o arquivo publicado fica assim até a próxima chamada de start ou done: o cartão dela na mãe mostra o trabalho antigo e esconde o pedido novo em '+1 pedidos anteriores'. Uma queda do processo nesse intervalo deixa as âncoras antigas no store.
- **Proposta:** Em planTool, fazer as mudanças dependentes (âncoras, sends, work) antes do change dos grupos ou num único passo, e publicar uma vez no fim (publishPanel depois de joinWork).

## Regras de uso do painel e lembretes ao modelo

18 achados: 0 de severidade alta, 9 média, 9 baixa.

### Os lembretes medem 'tarefa aberta' no grupo inteiro e 'usou o painel' por qualquer chamada: pedido novo sem plano não é lembrado quando sobra tarefa antiga ou depois de um done
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:84-85 — planned só volta a false num pedido de verdade (não em aviso, hand-back ou notificação)
  - task-tree/hooks/prompt-submit.ts:108-111 — todo pedido já leva PROMPT.request ('a PRIMEIRA chamada é plan'); o lembrete do tool.call é a segunda rede, e é ela que falha
- **Regra do catálogo:** lembretes.primeira-chamada-sem-plano; perguntas.sem-tarefa-recusada (A pergunta sem tarefa aberta é recusada: 'Dado nenhuma tarefa aberta')
- **Cenário:** Pedido um deixa 'Dois' pendente (as pendentes nunca viram ✕). Pedido dois chega; o modelo fecha 'Dois' com done, como o lembrete das abertas manda, e segue com Bash e Edit sem plan: planned já é true, nenhum lembrete 'sem plano aberto' sai no pedido inteiro e o trabalho não aparece no painel. Se ele nem fecha 'Dois', hasOpen segura o lembrete do mesmo jeito, e o último done do pedido novo não cobra summary.
- **Proposta:** Medir pelo pedido atual: lembrar quando nenhum nível 1 pertence ao último turno (nem foi iniciado nele), em vez de hasOpen do grupo; marcar planned só em plan aceito ou em start/done que toquem tarefa do pedido atual; em noSummary, usar 'nada aberto no pedido atual'. Reescrever o cenário do catálogo com a condição exata e cobrir os dois casos acima.
- **Ajuste da verificação à proposta:** Um start no pedido atual deve continuar contando como uso do painel, mesmo em tarefa de pedido anterior: retomar um plano antigo sem plan novo é fluxo previsto (turnos.prompt-seguinte-retoma, turnos.continuacao-sem-start-aguarda). Só o done em tarefa de pedido anterior e o plan recusado não devem contar. A recusa do AskUserQuestion pelo grupo inteiro bate com o texto do catálogo ('nenhuma tarefa aberta'); mudar para 'tarefa do pedido atual' é mudança de regra e vira pergunta ao usuário.
- **Verificação:** Reproduzi pela leitura: done na pendente antiga liga planned (tools.ts:129) e cala o lembrete pelo resto do pedido; sem fechá-la, hasOpen do grupo cala do mesmo jeito (tool-call.ts:193). O teste só cobre o painel vazio.

### Textos que o modelo lê prometem tooltip com a resposta inteira e "a primeira frase da resposta" sem `summary`; o painel não faz nenhum dos dois
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1134, 1144, 1203 — únicos lugares que gravam Row.whole; nenhum arquivo de draw/svg.ts ou hooks/render.tsx o lê (rowAlt, svg.ts:721-734, usa só hint)
  - task-tree/hooks/turn.ts:118-137 — sem summary não há brief; reply é gravado e publicado, mas não é desenhado em lugar nenhum
  - task-tree/DESENVOLVIMENTO.md:1003-1005 e 1016-1017 — ainda descrevem 'o tooltip a resposta inteira'
  - task-tree/hooks/tools.ts:172 — comentário antigo ('would say only "resposta"')
- **Regra do catálogo:** visual.tooltip (Texto cortado não tem tooltip); turnos.resumo-sem-resposta-final (O resumo do done vira a linha ↩ mesmo sem texto final no turno)
- **Cenário:** O modelo lê nas regras que, sem `summary`, o painel usa a primeira frase da resposta, e encerra o turno sem `done` com `summary` (o aviso `DONE.noSummary` só sai quando o último `done` fecha tudo). O pedido fica sem linha ↩ nenhuma. Com `summary`, a resposta inteira (`reply`, até 600 caracteres) é publicada e nunca mostrada.
- **Proposta:** Em `RULES` e `TOOLS.summary`, trocar por "é a linha ↩ do painel; sem ele, o pedido fica sem linha ↩" e tirar a menção ao tooltip. Corrigir os comentários de `text/rules.ts` (linhas 4-10), `hooks/turn.ts` (24-26, 125-126) e `hooks/tools.ts` (172). Criar um cenário em `regras/lembretes.md` para o texto das regras. Decidir o destino de `Row.whole`: ir para o `alt` da linha ↩ ou sair.
- **Ajuste da verificação à proposta:** A correção dos textos segue as duas decisões registradas e não precisa de pergunta. Só o destino da resposta inteira (texto alternativo da linha ↩ ou nada) é pergunta, como a proposta já faz. Incluir a correção dos trechos do DESENVOLVIMENTO.md citados.
- **Pergunta ao usuário:** Sem tooltip, a resposta inteira do turno deve aparecer em algum lugar (por exemplo, no texto alternativo da linha ↩) ou basta o resumo? Recomendo só o resumo e tirar `Row.whole`.
- **Decisão já registrada:** regras/visual.md, visual.tooltip, Reescrito 2026-11-09 ("não funcionou. aborte e remova a funcionalidade de tooltip"); task-tree/DESENVOLVIMENTO.md:471-476 e 1005-1010 (a linha ↩ só existe com o summary do done; sem resumo não há linha)
- **Verificação:** Conferi rules.ts 35-37 e 83-85 contra turn.ts e o desenho: não existe atalho pela primeira frase nem tooltip, e Row.whole não é lido por ninguém. Os arquivos tests/textos.test.ts e tests/golden/textos.ts citados no cabeçalho de rules.ts não existem.

### A recusa da pergunta confere só 'tarefa aberta', não 'em andamento'; com tarefa só pendente a espera fica solta no fim, e ExitPlanMode e wrap_up com ask não têm a mesma exigência
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:1301 e 1380 — a âncora da espera é recalculada a cada desenho por `current(g.tasks)` (só tarefa aberta e iniciada); sem nenhuma, a espera do grupo principal vai para o fim da lista
  - task-tree/DESENVOLVIMENTO.md:1260-1262 — o ExitPlanMode sem a exigência está documentado como 'o desenho original'; o comentário de tool-call.ts:54 ('plan mode may hold the panel's tools') diz o contrário do documento
  - regras/perguntas.md:7-15 — o cenário e o teste dizem 'nenhuma tarefa aberta': o código cumpre o catálogo; quem diz 'em andamento' é só o texto ASK.refused e as RULES
- **Regra do catálogo:** perguntas.sem-tarefa-recusada; perguntas.espera-sob-a-tarefa; perguntas.exitplanmode-espera; perguntas.escolha-do-wrapup-ate-proxima-mensagem
- **Cenário:** (1) O modelo planeja e, sem start, chama AskUserQuestion: a chamada passa e 'Aguardando sua resposta' aparece solta no fim do painel, não sob a tarefa. Basta um passo ○ esquecido de um pedido de ontem para liberar a pergunta de hoje, sem tarefa nenhuma do pedido atual. (2) ExitPlanMode ou wrap_up com ask sem nenhuma tarefa: nada é recusado e a espera também fica solta. (3) Na sessão que só recebeu avisos do app e fechou tudo, o AskUserQuestion é recusado e o modelo precisa criar uma tarefa só para perguntar.
- **Proposta:** Decidir a regra única e aplicá-la aos três: ou a recusa exige tarefa iniciada do loop principal (current().anchor definido) e o texto da recusa manda dar start; ou, com tarefa só pendente, o painel ancora a espera na pendente mais recente do pedido atual (como sendAnchor faz para envios) em vez de soltá-la no fim. Corrigir o comentário de tool-call.ts sobre o modo plano para bater com a doc. Acrescentar os três cenários que faltam em regras/perguntas.md.
- **Ajuste da verificação à proposta:** Exigir tarefa iniciada reescreve um cenário coberto (perguntas.sem-tarefa-recusada): só com decisão do usuário, 'Reescrito' e selo de decisão. A alternativa de ancorar a espera na pendente do pedido atual não mexe em teste protegido e combina com a regra das cartas. O ExitPlanMode e o wrap_up com ask livres já são o comportamento documentado: basta corrigir o comentário do código e catalogar. O caso (3) é a regra funcionando, não defeito.
- **Pergunta ao usuário:** Pergunta com tarefa aberta mas não iniciada: recusar (pedindo start) ou aceitar e pendurar a espera na tarefa pendente? E ExitPlanMode / wrap_up com ask sem tarefa: seguem livres? Recomendo aceitar e pendurar na pendente do pedido atual, e manter livres os outros dois, só desenhando a espera sob a última tarefa do pedido.
- **Verificação:** Confirmei que a recusa usa hasOpen (qualquer tarefa aberta, de qualquer pedido), que o askAnchor e o desenho só ancoram em tarefa iniciada, e que por isso a espera com tarefa só pendente fica solta no fim. O código segue o catálogo; a divergência está entre o texto dado ao modelo ('em andamento'), o que é exigido ('aberta') e o comentário sobre o modo de plano.

### Refazer um pai concluído: três textos diferentes, a recusa do start não diz 'ids novos' (replanejar com os mesmos ids não muda nada) e chama de 'concluída' uma tarefa interrompida
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/text/rules.ts:89 — a descrição do start já diz 'Em uma tarefa concluída sem subtarefas, reabre a tarefa e os pais dela': o caminho existe em texto; o que falta é dizer, na recusa, que para refazer o pai basta dar start nas subtarefas dele
  - task-tree/hooks/tools.ts:63, 78 — o replano com os mesmos ids só não muda nada quando o nível 1 ainda está aberto (carry); com o nível 1 já concluído, o plano novo entra ○ ao lado e o antigo vira histórico (pedidos.nivel1-concluido-e-historico), então replanejar funciona nesse caso
  - task-tree/hooks/tools.ts:212 — `hit.status !== 'open'` inclui a interrompida, e o texto diz sempre 'já foi concluída'
- **Regra do catálogo:** arvore.start-recusa-pai-concluido ('a resposta recusa e manda replanejar o nível 1'); arvore.start-reabre-pais; pedidos.replano-preserva-estado
- **Cenário:** O modelo quer refazer '1.2' (pai ✓). start(['1.2']) é recusado com 'replaneje o nível 1 com plan'. Ele replaneja com os mesmos ids: o resultado diz 'Plano exibido' e nada muda, 1.2 segue ✓. O caminho que funciona sem replano (start nas folhas de 1.2, que reabre os pais) não aparece em texto nenhum.
- **Proposta:** Unificar os três textos: 'para refazer um pai concluído, chame start nas subtarefas a refazer (os pais reabrem) ou replaneje com ids novos'. Na recusa, dizer o estado real ('foi interrompida' ou 'foi concluída').
- **Ajuste da verificação à proposta:** Unificar como proposto, mantendo na recusa o trecho 'já foi concluída e tem subtarefas' para a tarefa concluída (o teste de arvore.test.ts confere essa frase) e trocando só a palavra para a interrompida. Como o cenário arvore.start-recusa-pai-concluido diz 'manda replanejar o nível 1', acrescentar o caminho do start nas subtarefas muda o 'Então' do cenário: confirmar com o usuário e registrar.
- **Verificação:** Os três textos divergem como descrito (só as RULES dizem 'ids novos'), a recusa chama de concluída uma tarefa interrompida, e o replano com os mesmos ids num nível 1 ainda aberto preserva o ✓ e não refaz nada. Corrigi dois pontos: o start em folha concluída está, sim, na descrição da ferramenta, e o replano funciona quando o nível 1 inteiro já está concluído.

### O modelo não é avisado quando o painel fecha ou marca ✕ a tarefa pelos subagentes, e as regras do prompt ainda descrevem o comportamento antigo
- **Categoria:** assimetria · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/agents.ts:163-177 com task-tree/state/tasks.ts:101-106 — reaberta com start, a tarefa segue com o grupo do subagente que falhou ancorado nela; no fim do turno seguinte settleBySubs olha todos os subagentes dela (vale o pior) e a marca ✕ 'falhou' de novo, mesmo com um subagente novo concluído, salvo se o modelo chamar done antes (lido no código, sem teste que cubra)
  - task-tree/draw/layout.ts:1047 — 'falhou' sai de t.failed, que begin não limpa
- **Regra do catálogo:** subagentes.pai-conclui-no-fim-do-turno; subagentes.pai-reflete-falha-ou-interrupcao; subagentes.cartao-desde-o-lancamento (RULES ainda diz 'subagentes que usam o painel')
- **Cenário:** Um subagente em segundo plano falha depois do fim do turno: o painel marca a tarefa ✕ 'falhou'. No prompt seguinte a lista de abertas não a inclui e nada diz ao modelo que ela falhou; ao tentar done, ele recebe 'foi interrompida' sem instrução de reabrir com start. No caso de sucesso, o modelo também não é informado do fechamento automático, enquanto para a carta entregue é.
- **Proposta:** Em text/rules.ts: atualizar a regra de subagentes (cartão desde o lançamento; a tarefa fecha sozinha quando todos concluem; ✕ se algum falha, reabrir com start para refazer) e criar uma nota única, como a da carta, quando settleBySubs fecha ou interrompe uma tarefa.
- **Ajuste da verificação à proposta:** A proposta não contradiz decisão (só texto e aviso). Completar: 'reabrir com start para refazer' não basta hoje, porque a tarefa volta a ✕ 'falhou' no fim do turno; junto com o aviso, settleBySubs deve considerar só os subagentes lançados depois do último start da tarefa, e o start deve limpar 'failed'. Sendo correção de bug, pede teste e cenário.
- **Decisão já registrada:** regras/subagentes.md, decisão do usuário de 2026-11-09 ("Fecha de fato (Recomendado)"; "interrompido se é interrompido, falha se ele falhou"): o fechamento automático é decidido; sobre avisar o modelo não há decisão
- **Verificação:** Conferi: settleBySubs não gera nota, takenNote gera para a carta, e o done em tarefa ✕ devolve só 'foi interrompida'. RULES 53-54 descreve o comportamento anterior ao cartão desde o lançamento.

### O resultado do plan não diz o que foi interrompido, renomeado ou zerado
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:115-120 — a resposta do plan é sempre a mesma frase, sem 'Avisos:'
  - task-tree/hooks/tools.ts:60-63, 76-79 — num pedido novo (turno novo), o nível 1 aberto com o mesmo id não é replanejado: é interrompido e renomeado, e o novo entra todo pendente
  - task-tree/text/rules.ts:38-42 e 124-144 — RULES e os lembretes de replanejar depois do Esc mandam manter os ids 'que guardam o estado', sem a condição 'no mesmo pedido'; a mensagem seguinte sempre abre um turno novo (hooks/prompt-submit.ts:88), então o estado não é guardado (o teste de pedidos.test.ts:62-71 mostra o antigo virando histórico e o novo pendente)
- **Regra do catálogo:** pedidos.plano-anterior-vira-historico (Um plano de pedido anterior com o mesmo id vira histórico); pedidos.nivel1-concluido-e-historico; pedidos.replano-preserva-estado (só 'no mesmo pedido')
- **Cenário:** Nos casos em que o plan abandona um nível 1 aberto (pedido anterior) ou duplica um concluído, o modelo recebe a mesma frase de um replano normal. Ele segue acreditando que 64.1 está em andamento e que 64.2 já foi concluída; só percebe (ou não) pelo aviso do done seguinte. O usuário vê o painel regredir sem que o modelo corrija.
- **Proposta:** Acrescentar notas à resposta do plan, no padrão 'Avisos:' do done: para cada nível 1 abandonado, 'o "64" do pedido anterior ficou como histórico: N tarefas abertas interrompidas; as deste plano entram pendentes (refaça start no que está em andamento)'; para cada nível 1 concluído reusado, 'o "64" já estava concluído e ficou como histórico'; e quantas tarefas mantiveram o estado num replano. Os textos vão em text/rules.ts; cenário em regras/arvore.md ou pedidos.md.
- **Ajuste da verificação à proposta:** Manter o comportamento, que é decidido (histórico e abandono: pedidos.plano-anterior-vira-historico, confirmado pelo usuário em 2026-10-27); a proposta só acrescenta avisos à resposta, o que não contradiz decisão. Acrescentar à proposta: corrigir o texto de RULES e dos lembretes de replanejar depois do Esc, que prometem estado guardado ao repetir ids num pedido novo, onde o plan faz o contrário. Esse ponto merece análise própria: se o esperado depois do Esc é guardar o estado, é mudança de regra e vira pergunta ao usuário.
- **Verificação:** Li planTool inteiro: 'renamed' e a interrupção das abertas só servem para renomear âncoras e nunca chegam ao texto devolvido; done e start devolvem avisos. Não há cenário nem decisão sobre o texto da resposta do plan.

### Os lembretes da mesma mensagem dão ordens opostas (done primeiro x 'a PRIMEIRA chamada é plan'); com ids reutilizados, o plan primeiro deixa a tarefa antiga ✕ e o done seguinte fecha a tarefa nova
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:56 e 76 — o nível 1 antigo é renomeado só no `id` (`tag:1`); o `short` continua '1', por isso o done(['1']) seguinte acha os dois e fica com o aberto (state/tasks.ts:36-41)
  - task-tree/hooks/tools.ts:153 e 180 — o aviso de 'fechou sem start' só sai com duas ou mais, então fechar a '1' nova sozinha não avisa nada
  - task-tree/text/rules.ts:6-7 — o cabeçalho cita tests/textos.test.ts e tests/golden/textos.ts, que não existem mais: os textos estão sem conferência letra a letra
- **Regra do catálogo:** lembretes.fim-normal-lista-abertas; pedidos.plano-anterior-vira-historico (o nível 1 aberto de pedido anterior vira ✕ renomeado quando o pedido novo reusa o id: comportamento decidido)
- **Cenário:** Pedido um: plano '1' Perguntar ao usuário (◉), pergunta respondida pelo chat. A mensagem chega com PROMPT.open (feche a '1') e PROMPT.request (a PRIMEIRA chamada é plan). O modelo obedece ao segundo e planeja '1', '2', '3' (os ids do exemplo das regras). O '1' antigo vira ✕ interrompida no pedido anterior, embora tenha sido respondido. Em seguida o modelo chama done(['1']) para fechar a pergunta: o painel fecha o '1' do plano novo, sem start e sem aviso. Se obedecer ao primeiro texto (done antes), o resultado é ✓ no antigo e o plano novo intacto.
- **Proposta:** Dar uma ordem só: em PROMPT.request e em RULES, trocar 'a primeira chamada é plan' por 'antes de qualquer outra ferramenta: done no que a mensagem conclui, depois plan' quando PROMPT.open (ou interruptedByYou) acompanha; ou montar um texto único em promptSubmit quando há tarefas abertas. No plan, dizer no resultado quando um nível 1 aberto de pedido anterior foi interrompido e renomeado ('o "1" do pedido anterior ficou como histórico, interrompido'), para o modelo perceber. Criar cenário no catálogo para a ordem esperada.
- **Ajuste da verificação à proposta:** Corrigir só os textos (a ordem única: done no que a mensagem conclui, depois plan); o comportamento do plan com id reutilizado é regra confirmada pelo usuário em 2026-10-27 e não muda. O aviso no resultado do plan ('o "1" do pedido anterior ficou como histórico, interrompido') é o que mais ajuda. Como muda o texto das regras de uso (RULES e PROMPT.request), levar ao usuário a frase nova antes de implementar.
- **Verificação:** Os dois textos vão no mesmo contexto e mandam ordens opostas, e reproduzi o resto pela leitura: o plan primeiro com o id '1' deixa a tarefa antiga ✕ e o done(['1']) seguinte fecha a nova. Média e não alta: três dos quatro textos (PROMPT.open, RULES e ASK.inChat) mandam o done primeiro, então o erro depende de o modelo seguir o texto em maiúsculas e reusar o id.

### "A mãe é avisada de que ela parou com N pendentes" só acontece se a origem já estava fechada quando a filha parou
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:143-151 — o cartão só fica 'encerrada' com a tarefa de origem fechada; calculado a cada desenho, nada guardado
  - task-tree/hooks/sessions.ts:222, 234-238 — a lista é zerada na primeira chamada e 'parou com N pendentes' só entra se a origem já estava fechada naquele instante
- **Regra do catálogo:** sessoes.filha-parada-com-origem-fechada-sai-da-contagem
- **Cenário:** Ordem mais comum: a filha para com 2 pendentes e a tarefa de origem ainda aberta. A mãe recebe "terminou o turno... a tarefa de origem continua aberta... marque com done". O modelo chama done na origem. Nesse momento o cartão passa a "encerrada" e as 2 pendentes saem do cabeçalho, do chip e do x/y, sem nenhum aviso de que a filha deixou trabalho por fazer: o próprio lembrete induz o fechamento que esconde as pendentes.
- **Proposta:** Duas mudanças: o lembrete SESSION.ended passa a dizer quantas pendentes a filha deixou ("parou com N pendentes"), e o done do loop principal, quando fecha uma tarefa que encerra o cartão de uma filha parada com pendentes, acrescenta ao resultado o aviso de SESSION.stopped. Estender o teste para a ordem filha para primeiro, origem fecha depois.
- **Decisão já registrada:** regras/sessoes.md:74-83, decisão do usuário de 2026-11-04 ("Origem fechada (Recomendado)"): o Então diz 'a mãe é avisada de que ela parou com N pendentes', sem condição de ordem
- **Verificação:** Segui a ordem filha para primeiro, origem fecha depois: sai SESSION.ended sem contagem, e o done na origem (tools.ts:139-181) não confere cartões; as pendentes saem da contagem sem aviso. O teste só cobre a ordem inversa (sessoes.test.ts:536-548). Pelo critério estrito (regra do catálogo não cumprida nessa ordem) caberia alta; deixei média porque o desenho está certo e só o aviso falta.

### O aviso 'falta o summary' dispara no meio do turno, quando o done fecha a última aberta antes do plan seguinte, na ordem que os próprios lembretes mandam
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/tools.ts:134 — o summary dado no meio do turno fica no state até o fim do turno (turn.ts:121-124), salvo outro summary depois
- **Regra do catálogo:** arvore.done-sem-summary-e-varias-sem-start ('o último done do pedido', que o código aproxima por 'nada aberto no grupo')
- **Cenário:** Plano de uma tarefa: 'Perguntar o rumo'. A pessoa responde o AskUserQuestion; o modelo segue o lembrete e chama done(['1']). Como era a única aberta, recebe 'falta o summary: chame done de novo só com summary' e obedece com 'Usuário escolheu a opção B'. Depois planeja e executa o trabalho de verdade; no último done esquece o summary e não é avisado (já existe um). O ↩ do pedido fica 'Usuário escolheu a opção B'. O mesmo acontece com quem planeja uma tarefa por vez.
- **Proposta:** Não pedir summary no done quando o turno claramente continua: por exemplo, quando o done vem logo depois de uma pergunta respondida (waits/answered) ou deixar a cobrança do summary para o fim de turno (wrap_up e, fora do app, turn.complete sem brief). Alternativa de texto: inverter a ordem em ASK.answered/inChat e RULES para 'plan com as próximas tarefas e então done na tarefa da pergunta'. Guardar o brief só do último done com summary já resolve a sobra, mas não o aviso indevido.
- **Ajuste da verificação à proposta:** Menor mudança: o aviso passar a dizer que só vale se este foi o último passo do turno (se ainda vai planejar, ignore). Fora do app desktop não há wrap_up, e o aviso do done é a única cobrança do summary; por isso não convém tirá-lo sem outra cobrança no lugar. Inverter a ordem done/plan em RULES e ASK muda texto de regra e vira pergunta.
- **Verificação:** Conferi tools.ts:172-174: a condição é só 'fechou algo, nada aberto, sem summary'. ASK.answered e RULES 50-52 mandam done e depois plan, então a tarefa da pergunta, quando é a única aberta, dispara o aviso no meio do turno; o summary dado ali cala o aviso do done final.

### Depois de uma recarga no meio do pedido, o modelo recebe o lembrete de planejar mesmo já tendo planejado
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:115-130 — brief e recap já foram passados para o state pelo mesmo motivo (recarga entre o done e o fim do turno)
- **Regra do catálogo:** lembretes.primeira-chamada-sem-plano
- **Cenário:** A pessoa pede algo; o modelo planeja, executa e fecha todas as tarefas. Antes das últimas chamadas do turno (um git status, o wrap_up), outra sessão salva um arquivo do mod. No módulo novo `planned` é false e não há tarefa aberta: a chamada seguinte volta com 'há chamada de ferramenta sem plano aberto… chame plan agora'. O modelo tende a abrir um plano supérfluo no fim do pedido, que suja o painel. Com `answeredInChat` acontece o inverso: a marca posta pelo módulo antigo se perde e o prompt seguinte lista as abertas sem dizer 'esta mensagem é a resposta'.
- **Proposta:** Derivar `planned` do state em vez de guardá-lo no módulo: o pedido atual (último turno do grupo principal) já tem tarefa de nível 1 = planejou. Para `answeredInChat`, uma chave de state (como brief e recap). Cenário no catálogo ('recarga no meio de um pedido que já planejou não repete o lembrete') e teste com `estado` semeado.
- **Ajuste da verificação à proposta:** Em vez de derivar 'planned' do último turno ter nível 1 (falha quando o pedido continua um plano antigo só com start e done), guardar planned e answeredInChat em chaves do state, zeradas no prompt.submit, como brief e recap; cada chave nova precisa de linha na tabela de durabilidade.
- **Verificação:** Pela leitura, reminders é variável de módulo e o próprio comentário diz que a recarga a zera; com tudo fechado, a chamada seguinte recebe UNPLANNED. Só acontece com recarga no meio do pedido (uso de quem desenvolve o mod) e o efeito é um lembrete indevido; o harness não simula recarga.

### Plano aberto sem nenhum start não gera lembrete; tarefa única fechada sem start nunca é avisada
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:192-196` — Com qualquer tarefa aberta, reminder() não diz nada, por mais chamadas que o loop principal faça sem tarefa iniciada.
  - `task-tree/hooks/tools.ts:153, 177-180` — O aviso de etapas sem start só sai quando duas ou mais fecham juntas; uma só, nunca.
  - `task-tree/text/rules.ts:22-25, 31-34` — 'Uma tarefa basta para um pedido simples' e 'start ao começar cada tarefa'.
  - `regras/arvore.md:37-46` — Decisão 'sem start, nada aceso': sem start o painel inteiro fica ○.
- **Regra do catálogo:** arvore.sem-start-nada-acende (Sem start, nada fica em andamento); arvore.done-sem-summary-e-varias-sem-start
- **Cenário:** Caso mais comum: pedido simples, plan com uma tarefa, o modelo esquece o start, trabalha vinte chamadas e fecha com done. Durante todo o turno o painel mostra a tarefa e o pedido ○, nada em andamento, relógio parado; no fim vira ✓. Nenhum aviso em momento algum. Com várias tarefas, o aviso só vem no fim, depois que o painel já ficou parado.
- **Proposta:** Acrescentar um lembrete no tool.call do loop principal: plano aberto, nenhuma tarefa iniciada (e nenhum envio na fila, sessão ou subagente vivo sob elas) e N chamadas desde o último plan/start/done. E/ou avisar no done também quando uma única tarefa fecha sem start. Cenário novo em regras/lembretes.md.
- **Ajuste da verificação à proposta:** O lembrete novo é comportamento novo e fica como pergunta ao usuário, como a proposta já faz; não mexer no desenho sem start.
- **Pergunta ao usuário:** Quer um lembrete quando há plano aberto e nada iniciado depois de algumas chamadas (ex.: 3) e/ou o aviso do done também para uma tarefa só fechada sem start? Recomendo o lembrete no tool.call, uma vez por plano, porque é o único que corrige o painel ainda durante o trabalho.
- **Decisão já registrada:** regras/arvore.md:37-46, decisão do usuário de 2026-10-23 ("sem start, nada aceso"): o painel todo ○ sem start é decidido; o aviso só para várias etapas vem do commit 9c054f8
- **Verificação:** Conferi tool-call.ts:192-196 (com qualquer tarefa aberta, nenhum lembrete) e tools.ts:180 (aviso só com 2 ou mais). É lacuna, não erro: as regras e o lembrete de cada pedido já mandam chamar start, e o painel parado em ○ é o comportamento decidido para quem não chama.

### Lembretes de "sessão terminou" e "mensagem entregue" são consumidos antes de serem entregues: uma falha depois os perde para sempre
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/hooks/sessions.ts:171-175 — takenNote lê e depois grava a lista inteira; uma escrita do poll (watchSends, a cada 3 s) ou de um envio entre as duas é sobrescrita. Como o recibo já foi marcado em usedReceipts (sessions.ts:103, 136), o envio não volta a ser marcado como recebido e a carta fica azul
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma filha encerra o turno; o poll põe o id em `ended`. Na chamada seguinte do loop principal, endedNote zera a lista e, ao montar o texto, lança (ou um passo posterior do mesmo hook lança, ou o hook estoura o tempo). O host descarta o resultado: o modelo nunca recebe o lembrete para ler o relato e fechar a tarefa de origem, que fica aberta até alguém perceber. O mesmo vale para o lembrete de mensagem entregue.
- **Proposta:** Montar o texto primeiro e só então marcar como entregue: zerar `ended` e gravar `noted` no fim do hook, depois de as notas entrarem no resultado. Em takenNote, trocar o get+set por update, para não perder um envio gravado no intervalo.
- **Ajuste da verificação à proposta:** Trocar o get+set de takenNote por update é barato e vale por si. Mover a marcação de 'entregue' para o fim do hook só se justifica se houver falha real observada depois das notas.
- **Verificação:** A ordem é como o achado descreve (a lista é zerada antes de montar o texto), mas a perda depende de uma exceção ou estouro de tempo nos passos seguintes, que o código não mostra acontecer, e de como o app trata um hook que lança depois do next. A corrida do get+set existe na leitura, com janela pequena.

### 'Esta mensagem é a resposta do usuário à pergunta anterior' é anexado também a uma mensagem de outra sessão, e a marca é gasta
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/prompt-submit.ts:101-107` — PROMPT.open(openList, reminders.answeredInChat) é usado sem olhar it.peer, e a marca é zerada em qualquer pedido.
  - `task-tree/hooks/tool-call.ts:64-67` — A marca nasce quando a pergunta volta com 'did not answer / sent a message instead'.
  - `task-tree/hooks/panel.ts:132-137` — A marca é variável do módulo: uma recarga a quente entre a pergunta e a mensagem também a perde.
- **Regra do catálogo:** sem cenário
- **Cenário:** A orquestradora pergunta, a pessoa decide responder pelo chat, e antes da mensagem dela chega a de uma filha (fila de entregas). A mensagem da filha recebe o prefixo 'é a resposta do usuário à pergunta anterior' e o modelo a trata como resposta; a mensagem real da pessoa chega depois sem o prefixo.
- **Proposta:** Só aplicar e zerar answeredInChat quando o prompt não é de outra sessão; guardar a marca no estado (como brief e recap) para sobreviver à recarga.

### Depois do Esc sem nada aberto: a pessoa não recebe pedido de replanejar, a outra sessão recebe
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/prompt-submit.ts:103-106` — Com turno interrompido e nada aberto: mensagem de outra sessão recebe PROMPT.interruptedEmpty; mensagem da pessoa não recebe nada.
  - `task-tree/text/rules.ts:130-133` — interruptedEmpty manda 'replaneje o painel com o que esta mensagem pede'.
  - `regras/lembretes.md:37-45` — O título é geral ('não há o que replanejar'), o Quando só cita a mensagem da pessoa.
  - `task-tree/tests/lembretes.test.ts:54-63` — Só a mensagem da pessoa é testada.
- **Regra do catálogo:** lembretes.esc-sem-abertas (Depois do Esc sem nada aberto, não há o que replanejar)
- **Cenário:** Turno parado com Esc, tudo fechado. Chega mensagem de outra sessão: o modelo lê "replaneje o painel" (além do lembrete de todo pedido). Chega mensagem da pessoa: só o lembrete de todo pedido.
- **Proposta:** Ou tirar o interruptedEmpty (o lembrete de todo pedido já manda planejar), ou registrar a diferença num cenário próprio com teste.
- **Pergunta ao usuário:** Com o turno interrompido e nada aberto, a mensagem de outra sessão precisa de um pedido de replanejar próprio? Recomendo tirar: fica igual à mensagem da pessoa.

### Filha arquivada ou apagada com a tarefa de origem aberta: a mãe não recebe lembrete, e a apagada leva os ✓ da contagem
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/io/host.ts:137-143` — ended só entra para quem parou e não está arquivada (r.isArchived !== true); filha que sai da lista (apagada) nem é avaliada.
  - `task-tree/io/host.ts:144-169` — children é reconstruído só das linhas do host: a apagada some do state com painel e contagem.
  - `task-tree/hooks/sessions.ts:217-241` — endedNote só fala de sessões em `ended`.
  - `task-tree/text/rules.ts:197-212` — SESSION só tem os textos taken, ended e stopped; nenhum para arquivada ou apagada.
  - `regras/sessoes.md:97-106` — sessoes.filha-arquivada-interrompe só trata do desenho; não há cenário para filha apagada nem desarquivada.
- **Regra do catálogo:** sessoes.filha-arquivada-interrompe (A filha arquivada deixa interrompido o que ficou aberto)
- **Cenário:** A filha trabalha sob a tarefa "3" (aberta, iniciada); o usuário arquiva a filha pelo app (ou a apaga). O cartão vira "arquivada" com ✕ (ou some, levando os ✓ que contavam no x/y de "3" e no cabeçalho). O modelo da mãe nunca é avisado: "3" continua aberta até alguém fechar à mão. Desarquivar faz o cartão voltar a "parada" com as pendentes ○, também sem cenário.
- **Proposta:** Incluir em `ended` (ou numa lista nova) a filha que passou de viva para arquivada, e a que saiu da lista com a origem aberta, com um texto próprio em SESSION ("a sessão X foi arquivada/apagada com a tarefa de origem aberta"). Catalogar três cenários: arquivada enquanto trabalhava, apagada (cartão some: decidir se os ✓ ficam como histórico) e desarquivada.
- **Pergunta ao usuário:** Filha apagada no app: o cartão some com tudo (como hoje) ou o último painel fica como histórico cinza, como a arquivada (recomendado manter como hoje, mas avisar o modelo)?

### O lembrete 'chame plan agora' sai também no wrap_up e na última chamada do turno, contra a regra 'não crie plano retroativo'
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/tool-call.ts:187-200, 232-239` — reminder() roda para toda ferramenta do loop principal que não é do painel, inclusive mcp__ccd_turn__wrap_up, e emite UNPLANNED na 1ª, 11ª, 21ª chamada sem plano.
  - `task-tree/text/rules.ts:43` — RULES: 'Não crie plano retroativo para trabalho já feito: se perceber que começou sem plano, planeje o que falta.'
  - `task-tree/text/rules.ts:193-196` — UNPLANNED: 'chame mcp__task-tree__plan agora, start ao começar e done só quando a tarefa estiver de fato concluída'.
  - `task-tree/hooks/tool-call.ts:175-181` — No mesmo resultado do wrap_up vai também WRAP_UP.noBrief (falta o resumo).
- **Regra do catálogo:** lembretes.primeira-chamada-sem-plano (O lembrete de planejar na primeira ferramenta sem plano)
- **Cenário:** Pedido respondido só com texto no app desktop; a única chamada do turno é o wrap_up. O resultado dele traz 'falta o resumo do turno' e 'há chamada de ferramenta sem plano aberto... chame plan agora'. Não há mais nada a fazer, então o modelo cria um plano retroativo de uma tarefa e fecha em seguida (linha 0:00 no painel), ou ignora. O mesmo ocorre quando a 11ª chamada sem plano é a última do turno.
- **Proposta:** Não acrescentar UNPLANNED ao resultado do wrap_up (o turno acabou) e trocar o texto, depois da primeira ocorrência, por 'planeje o que falta'. Cenário novo em regras/lembretes.md para o wrap_up sem plano.

### Lembretes e recusa não conferem se as ferramentas do painel estão disponíveis; só o prompt de sistema confere
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/prompt-submit.ts:114-118` — promptCompose só acrescenta as regras quando mcp__task-tree__plan está entre as ferramentas do pedido.
  - `task-tree/hooks/prompt-submit.ts:108-111` — PROMPT.request ('A PRIMEIRA chamada de ferramenta é mcp__task-tree__plan') vai em todo pedido, sem essa conferência.
  - `task-tree/hooks/tool-call.ts:55-59, 187-199` — A recusa do AskUserQuestion e o UNPLANNED também não conferem se plan/start existem para o modelo.
- **Regra do catálogo:** lembretes.regras-no-prompt-de-sistema (As regras do painel entram no prompt de sistema)
- **Cenário:** Sessão em que as ferramentas do painel não são oferecidas ao modelo (regra de permissão negando mcp__task-tree__*, lista de ferramentas restrita, ferramentas não registradas depois de um reinício sem session.start). O modelo recebe a cada pedido a ordem de chamar uma ferramenta que não tem, o lembrete 'sem plano aberto' a cada 10 chamadas, e todo AskUserQuestion é recusado com 'abra (plan) ou reabra (start) a tarefa', sem saída: a pergunta nunca chega à pessoa.
- **Proposta:** Guardar em prompt.compose se as ferramentas do painel estavam na última composição do loop principal e, sem elas, não mandar PROMPT.request/UNPLANNED nem recusar a pergunta. Cenário em regras/lembretes.md e regras/perguntas.md.

### A convivência com o plano e o fim de turno do app (update_plan, wrap_up, TaskCreate) não está nas regras nem no catálogo
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/text/rules.ts:22-25, 100-104` — O mod exige que a primeira chamada seja mcp__task-tree__plan; nenhuma linha fala das listas de tarefas do próprio app.
  - `task-tree/text/rules.ts:177-186` — WRAP_UP.noBrief e WRAP_UP.open chegam no resultado do wrap_up e pedem done 'antes da mensagem final', isto é, depois do wrap_up.
  - `task-tree/hooks/tool-call.ts:79-88, 175-181, 187-191` — Do app, o mod só conhece o mcp__ccd_turn__wrap_up; update_plan, TaskCreate e afins contam como chamada comum (ganham o lembrete de planejar).
- **Regra do catálogo:** sem cenário
- **Cenário:** No app desktop o modelo tem duas listas: a do app (update_plan, que também pede para ser a primeira chamada, e wrap_up, que pede para ser a última antes da mensagem final) e a do painel. Sem regra do mod sobre a ordem, o modelo fecha o turno com wrap_up e só então descobre, pelo resultado, que faltam o summary e os done: uma chamada extra por turno, ou o ↩ e as tarefas ficam para trás. Se o modelo usa só a lista do app, o painel fica vazio e a única reação é o lembrete genérico a cada 10 chamadas.
- **Proposta:** Acrescentar a RULES e a PROMPT.request uma linha de ordem: feche as tarefas e passe o summary no done ANTES do wrap_up; update_plan e plan podem ir na mesma primeira mensagem; a lista do app não substitui o painel. Cenários em regras/lembretes.md para 'wrap_up sem resumo' e 'wrap_up com tarefas abertas' (hoje sem cenário nem teste).

## Catálogo de regras e testes

32 achados: 0 de severidade alta, 8 média, 24 baixa.

### A contagem de asserções ignora helpers do kit que afirmam (`esperarPalavra`, `esperarCartaSob`) e os helpers locais; 11 testes selados contam zero
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/selos.json — 11 testes com 'assercoes: 0': 3 de durabilidade, 3 de envios, os 4 de golden e 1 de sessoes
  - task-tree/tests — esperarPalavra e esperarCartaSob aparecem em 35 linhas de teste (envios 23, sessoes 11, pedidos 1), não 41
  - task-tree/tests/kit/leitura.ts — não existe helper 'antes'; os únicos 'antes' são variáveis locais
- **Regra do catálogo:** sem cenário
- **Cenário:** Em envios.test.ts, 'cada envio vai a uma tarefa do lote recente de starts ainda sem envio' afirma só com `esperarCartaSob` e está selado com `assercoes: 0`. Uma sessão apaga as duas linhas `esperarCartaSob` e sela com `--tipo refatoracao`: 0 não é menor que 0, o selo é aceito, `selos` e `plugin test` passam. O teste virou um roteiro sem afirmação nenhuma, sem decisão do usuário. O mesmo vale para os 4 testes de golden (afirmam pelo `conferir` local), os pares '1/2' de durabilidade e para qualquer das 41 chamadas a `esperarPalavra`/`esperarCartaSob` em envios, sessoes e pedidos: tirá-las não baixa a contagem.
- **Proposta:** Em scripts/selos.mjs: (1) derivar a lista do kit em vez de fixá-la (toda função exportada de tests/kit/leitura.ts cujo corpo chama `expect` ou dá `throw`), ou no mínimo incluir `esperarPalavra` e `esperarCartaSob` e tirar `antes`; (2) contar também as asserções dentro das funções de topo do próprio arquivo que o teste chama (`conferir`, `exigir`, `terminarTurno`…); (3) uma trava em travas.test.mjs que falhe quando um `esperar*` exportado pelo kit não estiver na lista. Regravar a contagem dos selos numa passada só (a contagem só sobe, então a trava de 'menos asserções' não dispara).
- **Ajuste da verificação à proposta:** Ao regravar a contagem, conferir que a passada só muda 'assercoes' (o hash do corpo não muda), para não exigir selo novo de cada teste. Contar asserções dentro de funções de topo do arquivo (conferir, do golden) é o ponto que mais muda o script; pode ficar para um segundo passo.
- **Verificação:** Conferi a lista fixa (selos.mjs:22) e a contagem só por nome no corpo do teste (62-68): os dois helpers do kit que chamam expect ficam de fora. Com zero contado, um selo de refatoração aceita tirar todas as afirmações, o que contraria a trava descrita no CLAUDE.md ('as asserções não podem diminuir').

### A maior parte dos textos ao modelo não tem cenário nem teste, e o cabeçalho de rules.ts cita um teste e um golden de textos que não existem
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/arvore.test.ts:92-99 — também lê texto ao modelo: o resultado do done ('falta o summary', '2 etapas fecharam juntas sem start')
  - task-tree/tests/sessoes.test.ts:536-548 — lê o lembrete da filha parada ('1 pendentes')
  - Portanto lembretes.test.ts não é o único arquivo. Sem nenhum trecho em teste ficam: hand-back, notificação e aviso do app, resposta por opção e pelo chat, o prefixo 'é a resposta do usuário', carta na fila no done, wrap_up sem resumo e com abertas, envio na fila, mensagem tratada e sessão que terminou o turno
  - regras/lembretes.md:64 — a origem cita o commit 758dbb7 ('textos do modelo num módulo, com golden'): o golden dos textos existiu e não está mais no repositório
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma mudança que deixe de anexar SESSION.ended, WRAP_UP.open ou ASK.inChat, ou que troque a condição deles, passa em todas as etapas do check: a matriz de impacto não lista cenário nenhum para esses textos, e nenhuma trava de regressão os cobre. As contradições de texto deste relatório nasceram assim (o texto mudou sem cenário que dissesse o que ele promete).
- **Proposta:** Um cenário por texto e por condição em que ele sai (quando sai, o que cita, quando não sai), com teste que leia o context ou o resultado: resposta por opção e pelo chat, wrap_up sem resumo e com tarefas abertas, envio na fila e tratado, sessão que terminou o turno e que parou com a origem fechada, hand-back, notificação e aviso do app, done com carta na fila. Corrigir o cabeçalho de rules.ts ou recriar o golden dos textos, por decisão do usuário.
- **Ajuste da verificação à proposta:** Corrigir já o cabeçalho de rules.ts (afirma uma conferência letra por letra que não existe). Recriar ou não o golden dos textos é decisão do usuário, como a proposta pergunta; não achei registro de decisão sobre isso.
- **Pergunta ao usuário:** Quer de volta um golden letra por letra dos textos ao modelo (como o do SVG), ou bastam cenários que confiram quando cada texto sai e os trechos essenciais (recomendado)?
- **Verificação:** Busquei em tests/ os trechos de cada texto: só os lembretes de replanejar, a lista de abertas, 'sem plano aberto', os dois avisos do done e 'N pendentes' têm teste. tests/textos.test.ts e tests/golden/textos.ts não existem, e o cabeçalho de rules.ts diz que existem.

### O golden não contém o que os cenários visual.desenho-* dizem travar (✕, anel, modelo, carta interrompida, repositório no cabeçalho)
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/golden/svg.ts — textos alternativos lidos do JSON aprovado: principal só tem Aguardando, Concluída, Aberta e Resposta (sem Em andamento e sem Interrompida), e o cabeçalho sem repositório; filha tem toks/s, repositório e branch, sem modelo e sem anel; envios tem 1 entregue e 2 na fila, nenhuma interrompida (o Esc do roteiro não corta a carta)
  - Correção: o cenário subagente tem o modelo nos cartões de subagente ('Haiku 5.5 · trabalhando'); o que falta é o modelo no cartão de sessão filha
  - 'ultracode' não aparece em nenhum dos quatro
- **Regra do catálogo:** visual.desenho-principal; visual.desenho-cartao-filha; visual.desenho-envios; visual.cartao-modelo-e-esforco; visual.cartao-posicao-de-toks-e-repo; visual.cabecalho-em-cartao
- **Cenário:** Alguém muda labelSvg (posição do modelo, do anel, do toks/s), o ícone ✕, o envelope cinza, a linha de seção ou o cabeçalho largo: o golden não muda, o check passa e o fluxo "mudança de desenho bloqueia o commit até o usuário validar no app" não dispara, embora o catálogo diga que esses desenhos estão travados.
- **Proposta:** Ajustar os roteiros do golden para conterem o que o cenário descreve: no principal, deixar o Esc por último (✕ e pendentes) e stubar o git do cabeçalho; na filha, usar 'publicado' com engine, ultracode e context (anel); nos envios, produzir de fato uma carta cortada. Acrescentar um cenário com "+N pedidos anteriores", aviso de espera, cartão parado/arquivado e um desenho a 100+ colunas. Como muda o golden, exige a validação do usuário no app; até lá, corrigir o texto dos cenários e dos checklists para o que o golden realmente cobre.
- **Ajuste da verificação à proposta:** Ampliar o golden muda desenho aprovado e depende da validação do usuário no app, então fica como pergunta, como a proposta já faz. Corrigir o texto dos cenários e dos checklists para o que o golden cobre hoje não depende dele e pode ir antes.
- **Pergunta ao usuário:** Quer ampliar o golden para cobrir ✕, anel, modelo, carta interrompida, seção e cabeçalho largo (você valida os desenhos novos no app), ou prefere só corrigir o texto do catálogo? Recomendo ampliar.
- **Decisão já registrada:** CLAUDE.md, 'Golden do SVG', decisão do usuário de 2026-10-28 ("Sim, validar antes do commit (Recomendado)"): todo desenho novo do golden só entra com a validação dele no app
- **Verificação:** Li os quatro cenários aprovados e os roteiros de golden.test.ts: os cenários do catálogo afirmam 'todos os estados', repositório no cabeçalho, anel e carta interrompida, que não estão no desenho travado. Mudança nesses desenhos passa no check sem bloquear o commit.

### O selo do teste não cobre o que ele usa por tabela: declarações de topo indiretas e arquivos importados fora do kit (fixtures)
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - scripts/selos.mjs:53, 61-70 — confirmado: 'decls' só traz as declarações de topo cujo nome aparece no corpo do teste; imports e o que essas declarações usam ficam fora
  - task-tree/tests/durabilidade.test.ts:235-251 — o teste percorre PUBLISHED_FILES sem afirmar que são 8 (só o nome do teste diz '8 formatos'): tirar formatos da fixture não quebra nada
  - task-tree/tests/durabilidade.test.ts:257-268, 275-277 — outro caso igual: terminarTurno usa o plano A, e os testes 'fim do turno… 1/2' só citam terminarTurno e o store; o plano A fica fora do hash deles
  - scripts/travas.test.mjs:151-159 — a trava testada é só a constante citada direto no corpo
  - scripts/regressao.mjs:53-58 — a regressão copia tests/ inteiro do commit de comparação, fixtures incluídas
- **Regra do catálogo:** durabilidade.formatos-antigos-do-publicado (Os formatos antigos do arquivo publicado são lidos); sessoes.um-cartao-por-mensagem; durabilidade.fim-do-turno-sobrevive-ao-reinicio
- **Cenário:** Uma sessão tira dois formatos de tests/fixtures/publicados.ts (ou troca o conteúdo de um). O teste 'os 8 formatos do arquivo publicado: cada filha aparece…' passa a conferir 6, mas o corpo é o mesmo: hash igual, `selos` passa, `plugin test` passa, e a `regressao` roda com a fixture de HEAD. O commit entra sem selo e sem decisão, e a proteção de durabilidade.formatos-antigos-do-publicado encolheu. Do mesmo jeito, mudar `tarefa()`, `A3` ou `turno()` em sessoes.test.ts muda o que afirmam os testes que os alcançam só por `duasRodadas`/`noTurno`, sem mudar o hash deles.
- **Proposta:** Em `testesDe` (scripts/selos.mjs), fechar o conjunto de declarações de topo por alcance transitivo (visitar também o texto das declarações já incluídas). Para arquivos de tests/ que não são `*.test.ts` nem kit/ nem golden/ (hoje, fixtures/), selar o arquivo como o kit ou somar o hash dos módulos importados ao hash dos testes que os importam. Cobrir os dois casos em travas.test.mjs. Exige regravar os hashes uma vez (selo `refatoracao` em lote, com o motivo).
- **Ajuste da verificação à proposta:** Fechar o alcance transitivo muda o hash de quase todos os 164 testes selados, e hoje não há comando para regravar em lote (--novos só sela o que não tem selo; --selar é um por vez). A correção precisa de um modo de migração próprio (regravar o hash mantendo tipo, data e motivo, só quando o texto do teste é igual ao de HEAD), num commit só de scripts e selos, sem tocar em teste. Para a fixture, afirmar no teste o número de formatos também fecha o buraco (é acréscimo de asserção, selo de refatoração).
- **Verificação:** Li testesDe e extrair: o hash cobre o corpo e só as declarações citadas direto; tests/fixtures/ não entra em selo nenhum e a regressão usa a fixture do commit de comparação. O CLAUDE.md promete que um teste selado não muda sem selo novo, e aqui o que o teste afirma muda em uso normal, sem burlar nada.

### Remover ou renomear um teste por decisão, junto com a mudança de código, não tem saída na regressão
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - scripts/regressao.mjs:81-97 e scripts/selos.mjs:169-171 — confirmado: teste de HEAD que falha e não tem mais selo na pasta nunca é liberado
  - git log -- regras/selos.json — nenhum commit removeu chave de teste até hoje (d3fee94 só reordenou uma): o caso ainda não aconteceu
  - task-tree/tests/pedidos.test.ts:74-87 e task-tree/tests/sessoes.test.ts:82-90 — os nomes dizem 'fica aguardando'/'aguarda' e as asserções esperam 'concluida': o nome ficou velho porque renomear troca a chave do selo
  - .github/workflows/test.yml:6-9 — a CI com --base só roda à mão e não é exigida para o merge
- **Regra do catálogo:** sem cenário
- **Cenário:** O usuário decide tirar um comportamento. A sessão reescreve o cenário com `Reescrito:`, apaga o teste, roda `--remover … --tipo decisao` e tira o código, tudo no mesmo commit (o fluxo do CLAUDE.md: um commit por item). No hook, a `regressao` roda o teste de HEAD contra o código novo, ele falha, e como a chave não tem mais selo o resultado é 'REGRESSÃO OU DECISÃO NÃO REGISTRADA': commit bloqueado. O mesmo acontece ao renomear um teste e mudar o comportamento por decisão (o selo novo está em outra chave). Contorno local: dois commits (primeiro o teste, depois o código). Na CI com `--base` não há contorno: os testes da base sempre incluem o teste removido, e o PR fica vermelho para sempre. O caminho que sobra é o `--no-verify`, que o CLAUDE.md proíbe.
- **Proposta:** Registrar a remoção em regras/selos.json (ex.: seção `removidos` com chave, data, motivo e a linha `Reescrito:` usada, gravada pelo `--remover`) e fazer a regressão liberar a falha de um teste de HEAD que esteja em `removidos` com data de hoje (ou, com `--base`, trazido no PR). Para renome, um `--renomear <antiga> <nova>` que leve o selo junto. Cobrir os dois casos nas travas.
- **Ajuste da verificação à proposta:** Hoje há dois caminhos que passam: manter o nome do teste e reescrever o corpo com selo de decisão (cobre mudança de comportamento, não remoção), ou dois commits (primeiro o teste e o selo, depois o código). Enquanto o script não muda, vale escrever isso no CLAUDE.md. A liberação por 'removidos' deve exigir o mesmo que o --remover (Reescrito com data igual ou posterior à do selo de HEAD) e ser desenhada junto com a comparação do selos.json com HEAD (outro achado relacionado desta área), que precisa do mesmo registro.
- **Verificação:** Segui o hook: com o teste e o selo removidos no índice, a regressão roda o teste de HEAD, ele falha contra o código novo e liberaTeste devolve false por falta de selo. Não há saída no mesmo commit; na CI com --base o teste removido roda sempre.

### Nenhum cenário nem teste cobre o que acontece com cartão e carta quando a tarefa de origem é replanejada
- **Categoria:** fluxo não mapeado · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/tests/envios.test.ts:33-52 — a carta com pedido novo e o mesmo id já tem teste (envios.cor-por-estado): segue a tarefa renomeada e fica cinza
  - task-tree/tests/envios.test.ts:172-191 — a carta cuja tarefa sai do plano no mesmo pedido tem teste (pedidos.replano-mantem-envio-ate-entrega)
  - task-tree/tests/pedidos.test.ts:89-107 — o mesmo id em dois pedidos com ✓ embaixo existe, sem sessão
  - task-tree/hooks/tools.ts:103-113 e task-tree/hooks/panel.ts:643-657 — só renameAnchors mexe nas âncoras das sessões e dos lançamentos; a tarefa que um replano do mesmo pedido tira deixa a âncora do cartão apontando para um id que não existe mais, e nenhum cenário diz onde o cartão fica
- **Regra do catálogo:** sessoes.cartao-sob-a-tarefa-de-origem; envios.carta-sob-a-tarefa; pedidos.replano-preserva-estado; pedidos.plano-anterior-vira-historico; pedidos.nivel1-concluido-e-historico
- **Cenário:** Os quatro fluxos que produziram o caso real passam pelo check sem nenhuma asserção: (1) replano no mesmo pedido mantendo a tarefa do cartão; (2) replano no mesmo pedido tirando a tarefa do cartão; (3) pedido novo com o mesmo id e cartão vivo sob a tarefa antiga; (4) nível 1 concluído com cartão e plan de mesmo id. Qualquer mudança em `planTool`, `renameAnchors` ou `joinWork` pode quebrá-los sem a trava de regressão acusar.
- **Proposta:** Acrescentar ao catálogo um cenário por fluxo (em regras/sessoes.md e regras/envios.md, com `Código: hooks/tools.ts, hooks/panel.ts`) e os testes com o kit atual (`abrirSessao`, `envio`, `pedido`, `plan`), junto das correções dos itens de continuação, de work e de subagente. O fluxo (1) já pode ser coberto hoje (o cartão segue sob a tarefa); os outros dependem das decisões.
- **Ajuste da verificação à proposta:** A lacuna é dos cartões de sessão e dos cartões de subagente; para a carta, dois dos quatro fluxos já têm teste. O cartão cuja tarefa sai do plano no mesmo pedido não tem regra: precisa da decisão do usuário (onde ele fica) antes de virar cenário. Os outros três (tarefa mantida, pedido novo com o mesmo id, nível 1 concluído) podem entrar já como testes do comportamento atual.
- **Verificação:** Conferi os testes de replano e de sessões: nenhum abre sessão e replaneja a tarefa de origem, e nenhum de sessões repete um id entre planos. O catálogo só trata a carta que sai do plano; para o cartão não há Então escrito.

### Tempo de tarefa, pedido e cabeçalho sem definição no catálogo; o código usa três bases e o número pula entre estados
- **Categoria:** indefinição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/draw/layout.ts:531-538 — timeOf/timeSpan (linha em andamento e concluída) contam só a partir de startedAt
  - task-tree/draw/layout.ts:520-527, 1049, 1118 — stillSpan (linha e pedido aguardando) usa startedAt ?? plannedAt de toda a subárvore, pendentes incluídas
  - task-tree/draw/layout.ts:557-565 — sessionTime (cabeçalho) usa startedAt ?? plannedAt
  - task-tree/DESENVOLVIMENTO.md:1245-1250, 1443, 1504 — o doc descreve timeOf, sessionTime e 'tempo parado no último fim abaixo', mas não diz de onde o tempo do pai aguardando começa
  - task-tree/tests — nenhum teste afirma o texto de um tempo (só a posição do '0:00', visual.test.ts:105)
- **Regra do catálogo:** turnos.iniciada-aguarda-no-fim; turnos.pai-e-pedido-aguardam-no-fim; durabilidade.fim-do-turno-sobrevive-ao-reinicio (só dizem 'relógio parado')
- **Cenário:** Plano feito às 10:00, start do primeiro passo às 10:02 (depois de uma pergunta). Durante o turno o pai mostra o tempo desde 10:02; no fim do turno, com passos pendentes, o pai ◷ passa a medir desde 10:00 (plannedAt das pendentes) e o número sobe 2 minutos de uma vez; quando tudo fecha, volta a medir desde 10:02. Cabeçalho, pedido e pai mostram tempos diferentes para o mesmo trabalho. Nenhum teste afirma um tempo de tarefa.
- **Proposta:** Escrever os cenários de tempo (tarefa, pai, pedido, cartão, cabeçalho; '—' para desconhecido) numa área própria do catálogo e alinhar stillSpan a span (só startedAt), deixando plannedAt apenas onde a regra disser. Testes com o relógio do kit afirmando o texto do tempo.
- **Ajuste da verificação à proposta:** Alinhar stillSpan muda o tempo desenhado nas linhas aguardando: o golden do cenário principal (que termina com fim de turno) pode mudar e exige validação no app. A pergunta ao usuário vem antes da mudança; os cenários de tempo entram com o código, no mesmo commit.
- **Pergunta ao usuário:** O tempo de um pai/pedido deve contar a partir do primeiro start (recomendado, igual à linha em andamento) ou a partir do plano?
- **Verificação:** Refiz o cenário pelo código: no turno o pai mede desde o primeiro start; no fim do turno, com pendentes, stillSpan pega o plannedAt delas e o número sobe pela diferença entre o plano e o primeiro start; com tudo fechado volta a medir do start. O salto é do tamanho dessa diferença, que cresce quando há pergunta antes do primeiro start.

### Os testes de pedidos e sessões não reproduzem o que o app publica: cenários 'coberto' passam com dados que o uso real não gera
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/prompt-submit.ts:88 — todo prompt que não é mensagem de outra sessão abre turno com own: true, o de abertura da filha inclusive
  - task-tree/draw/layout.ts:321, 348-351 — cada turno own vira uma parte própria do cartão
  - task-tree/tests/sessoes.test.ts:143, 150, 311 — nos testes o turno de abertura da filha nunca tem own; só o turno 2 de digitouNaFilha (325) tem
  - ~/.claude/task-tree-waits (amostra de 12 arquivos recentes, só as marcas dos turnos) — há arquivos reais com o turno 1 own: true seguido de turnos de mensagem
  - task-tree/tests/sessoes.test.ts:160 — duasRodadas preenche received (h.recebeu); só a abertura fica sem
  - task-tree/tests/perguntas.test.ts:57-73, 92-108 — resposta pelo chat e escolha do wrap_up têm teste, com pedido() e ferramenta(); falta o roteiro pronto no kit, não a cobertura
  - task-tree/tests/pedidos.test.ts:89-107 — o mesmo id em dois pedidos com ✓ embaixo existe, mas com título novo e sem cartão
- **Regra do catálogo:** sessoes.turno-proprio-da-filha-no-pedido-vigente; sessoes.cartao-sob-a-tarefa-de-origem; pedidos.plano-anterior-vira-historico
- **Cenário:** Os quatro problemas confirmados com o estado real (clone do nível 1 no pedido novo, abertura marcada como turno próprio, linha fantasma no cartão parado, pedido concluído que não sai de vista) passam por todos os testes atuais, porque nenhum teste usa: o mesmo id e título em dois pedidos com subtarefa concluída e cartão de filha; filha com own no primeiro turno; filha parada com tarefa iniciada; ids repetidos em parte entre pedidos.
- **Proposta:** Acrescentar ao kit um roteiro de 'mensagem no meio do trabalho' e uma filha publicada como o app publica (primeiro turno com own, received preenchido), e usar como fixture um recorte anonimizado de um arquivo real de task-tree-waits. Cada correção acima entra com o seu cenário e teste.
- **Ajuste da verificação à proposta:** Tirar da lista o que já tem teste (resposta pelo chat, escolha do wrap_up, received depois de um envio). A fixture de arquivo real segue o padrão que já existe em tests/fixtures/publicados.ts e precisa entrar no selo (outro achado relacionado desta área). Os quatro problemas citados são de outros achados e não foram conferidos aqui: cada um entra com o seu cenário.
- **Verificação:** Conferi o kit e os testes de sessões: o painel da filha é montado à mão e a abertura nunca vem marcada como turno próprio, enquanto o código marca todo prompt que não é mensagem de outra sessão, e arquivos reais mostram isso. Parte das evidências estava errada, mas a diferença entre o dado de teste e o publicado existe.

### Catálogo e CLAUDE.md desatualizados sobre o desenho: aviso "acima de 20 MB", cabeçalho de 116 px, golden com "3 cenários", checklist com "tooltip"
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/visual.md:78, 141, 164, 177, 190 — '116 px' só aparece em linhas 'Reescrito:' (registro da decisão de 2026-11-03), não no Dado/Quando/Então; a altura atual é 125 (draw/geometry.ts:84)
  - regras/visual.md:138 e regras/cabecalho.md:81 — também citam o tooltip 'sessão inteira'; hoje esse texto vai ao alt do cabeçalho e ao terminal (hooks/render.tsx:287, 307, 328)
  - O 'botão sem efeito do primeiro achado' citado no cenário é de outro lote e não foi conferido aqui
- **Regra do catálogo:** cabecalho.aviso-de-painel-grande-volta; visual.golden-gera-desenho; visual.cartoes-ordem-e-espera; visual.cabecalho-barra-e-chips-desenhados
- **Cenário:** Quem lê o catálogo conclui que o aviso de painel grande não é testável no harness (20 MB contra o teto de 4 MB) e o deixa em checklist. Com 600 KB ele é testável, e o teste mostraria o botão sem efeito do primeiro achado.
- **Proposta:** Corrigir os quatro textos. Passar cabecalho.aviso-de-painel-grande-volta para pendente ou coberto, com teste no desktop.
- **Ajuste da verificação à proposta:** Corrigir os textos. Para cabecalho.aviso-de-painel-grande-volta, passar a 'pendente' só depois de confirmar que o harness chega a um desenho acima de 600 KB em 5 s (o desenho tem teto de 400 linhas); se não chegar, segue checklist com o motivo certo. As linhas 'Reescrito:' são histórico: acrescentar a altura atual em vez de reescrever a antiga.
- **Verificação:** Conferi cada trecho: limite de 600 KB em panel.ts:529 contra '20 MB' no catálogo; 4 cenários em golden.test.ts e selos.json contra '3' em visual.md:148 e CLAUDE.md:125; 'tooltip' no checklist do CLAUDE.md:158 depois da remoção de 2026-11-09; anel em todo cartão (layout.ts:420-422) contra 'só no cartão líder'. É documentação desatualizada, sem efeito no painel.

### Uma decisão antiga do usuário libera novas mudanças de teste: o `Reescrito:` vale com data igual à do selo anterior
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/selos.json — refiz a conta: 55 dos 164 testes selados têm, em todas as regras citadas, um 'Reescrito' com data igual ou posterior à do selo; 35 são selos 'decisao' e 20 são 'novo' cuja regra foi reescrita depois sem o teste mudar
  - Depois de reaproveitada uma vez em outro dia, a data do selo passa a ser a de hoje e a mesma linha deixa de valer; no mesmo dia vale quantas vezes for
- **Regra do catálogo:** sem cenário
- **Cenário:** O teste 'a interrompida sai do total e entra no chip' foi selado como decisão em 2026-11-04 e a regra dele tem `Reescrito: 2026-11-04`. Hoje uma sessão muda o corpo do teste (ou tira asserções) e roda `npm run regras:selar -- "…" --tipo decisao`: o script aceita, porque 2026-11-04 >= 2026-11-04, sem nenhuma linha nova no catálogo. A etapa `selos` passa, e a `regressao` libera a falha do teste de HEAD (selo decisao de hoje, hash novo). Rodei a mesma conta sobre o selos.json atual: 55 dos 164 testes selados estão nessa condição (todas as regras citadas têm `Reescrito` com data >= a do selo). O mesmo vale para `--remover`. A mudança não aparece no diff do catálogo, só no do selos.json.
- **Proposta:** Fazer cada selo de decisão consumir uma linha `Reescrito:` própria: gravar no selo o hash (ou o texto) da linha `Reescrito:` usada e recusar novo selo `decisao`/`--remover` quando a linha mais recente da regra for a mesma já gravada no selo anterior. Isso mantém o caso do mesmo dia (duas decisões no dia = duas linhas) sem depender de `>=`. Acrescentar o caso em scripts/travas.test.mjs.
- **Ajuste da verificação à proposta:** Ao gravar no selo a linha 'Reescrito:' usada, prever os selos já existentes, que não têm o campo: preencher numa passada só com as linhas atuais (todas contam como já usadas), senão os 55 seguem liberados. É mudança de regra das travas e fica como pergunta ao usuário, como a proposta já faz.
- **Pergunta ao usuário:** Uma decisão registrada (`Reescrito:`) pode liberar mais de uma mudança no mesmo teste? Recomendo que não: cada selo de decisão exige uma linha `Reescrito:` nova.
- **Verificação:** Conferi exigirReescrito (selos.mjs:207-210), selar (252-257) e liberaTeste (169-171): basta uma data maior ou igual à do selo anterior, sem marcar a linha como usada. O 'igual ou posterior' está documentado em regras/README.md:72-73, mas o efeito contraria o que o CLAUDE.md promete (teste só muda com decisão registrada).

### O selo do kit não tem regra nenhuma: aceita `novo` para arquivo existente, não pede decisão e a regressão nunca roda os testes antigos com o kit novo
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/selos.json — kit/ambiente.ts selado 'novo' em 2026-11-10 e kit/cenario.ts 'novo' em 2026-11-09; os três arquivos do kit entraram no commit 023a054, de 2026-10-27
  - scripts/travas.test.mjs:138-147 — as travas só testam 'kit mudou sem selo' e 'comentário não muda o hash'
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma sessão afrouxa `esperarEstado` em tests/kit/leitura.ts (por engano ou para 'consertar' um teste que falha) e roda `node scripts/selos.mjs --kit task-tree/tests/kit/leitura.ts --tipo novo --motivo x`. O selo é aceito; `plugin test` passa (a asserção ficou mais fraca); a `regressao` usa o kit de HEAD contra o código, que não mudou, e passa. Todos os testes que usam o helper ficaram mais fracos com um selo de uma linha, sem decisão registrada. O kit é o arquivo de maior alcance da suíte e é o menos protegido.
- **Proposta:** Em `selar` (scripts/selos.mjs): recusar `novo` para arquivo do kit que existe em HEAD e exigir motivo não vazio. Em scripts/regressao.mjs: quando o kit mudou, rodar uma segunda passada com os testes de HEAD e o kit novo contra o código novo, para que uma mudança do kit que quebre (ou mude o resultado de) testes antigos apareça.
- **Ajuste da verificação à proposta:** A segunda passada da regressão (testes de HEAD com o kit novo) dobra o tempo da etapa mais lenta, que já roda em série por causa do limite de 5 s; rodá-la só quando houver diferença em tests/kit/. Recusar 'novo' para arquivo do kit que existe em HEAD e exigir motivo é barato e pode ir antes.
- **Verificação:** Conferi selos.mjs:233-239 (o selo do kit grava sem conferir nada além do tipo) e regressao.mjs:51-58 (testes e kit vêm juntos de HEAD). A documentação só promete 'o kit mudou sem selo', então não há contradição com regra escrita: é proteção fraca no arquivo de maior alcance.

### Não há cenário nem teste para os cartões voltarem sob as mesmas tarefas depois de um reinício (ligações lidas do store)
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - regras/visual.md:123-131 — já existe cenário para o worker refeito e a retomada com cartões ('nada some'), mas em estado checklist: visual.recarga-real-e-respawn; o que falta é o teste no harness
  - task-tree/tests/durabilidade.test.ts:34-61, 180-232 — confirmado: os testes de reinício não têm sessão, e os de ligações usam o state semeado ou um armazém vazio dentro de um teste só
  - task-tree/hooks/session-start.ts:61 e task-tree/hooks/panel.ts:661-694 — os dois caminhos sem teste: restoreLinks no session.start e saveLinks na primeira publicação depois do respawn
  - task-tree/DESENVOLVIMENTO.md:1381-1382 — o defeito já aconteceu uma vez (filhas sem âncora depois de reiniciar)
- **Regra do catálogo:** visual.recarga-real-e-respawn (A recarga real e o respawn do worker não perdem nada), checklist; durabilidade.reinicio-restaura-do-store; durabilidade.respawn-sem-session-start
- **Cenário:** Sessão com filha aberta sob "Um" e uma carta na fila; o processo reinicia. O que garante que o cartão volta sob "Um", que a carta não some e que as rodadas não se perdem é restoreLinks no session.start ou no primeiro save; uma regressão ali (cartões na raiz, cartas perdidas) passa em todos os testes.
- **Proposta:** Cenário novo, por exemplo durabilidade.reinicio-mantem-ligacoes, e par de testes 1/2 e 2/2 com armazem + host: abrir filha e enviar mensagem no 1/2; no 2/2 (iniciarSessao e também respawn sem session.start) afirmar o cartão sob a mesma tarefa e a carta na fila.
- **Ajuste da verificação à proposta:** Não é verdade que não haja cenário: há o do checklist do app. A proposta vale como teste de harness (o kit tem armazem e host). O cenário novo deve dizer que cobre no harness a parte de ligações do cenário do checklist, e o par de testes precisa dos dois caminhos: com session.start e sem ele.
- **Verificação:** Li os testes de durabilidade e restoreLinks: nenhum teste parte de state vazio com ligações no store. Não achei defeito no código; é falta de trava num caminho que já quebrou antes, por isso baixa.

### O catálogo acha `test(` por linha e o selo só por instrução de topo: teste aninhado, com nome em template ou com nome repetido é contado como cobertura e nunca é selado
- **Categoria:** assimetria · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/regras.mjs:19, 111-122` — TESTE = /^\s*test\(/, linha a linha, com indentação aceita
  - `scripts/selos.mjs:45-46, 55-60` — só `test(...)` como instrução de topo do arquivo e com nome em string literal entra na extração
  - `scripts/selos.mjs:116-119` — a chave é `arquivo::nome`; dois testes com o mesmo nome no arquivo ficam com um selo só (o último sobrescreve)
  - `scripts/regras.mjs:19, 111-122` — regex /^\s*test\(/ linha a linha: aceita teste indentado (dentro de bloco) e não vê test.skip/test.only
  - `scripts/selos.mjs:45-46, 55-60` — só statements de topo cujo chamado é o identificador test, com nome em string literal; os outros são pulados com continue
  - `scripts/selos.mjs:116-119` — testes[`${rel}::${t.nome}`] = t: dois testes com o mesmo nome no arquivo, o segundo sobrescreve o primeiro
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma sessão escreve testes num laço (`for (const c of casos) test(`caso ${c}`, …)`), dentro de um bloco, ou repete um nome no mesmo arquivo. A etapa `regras` aceita (há `// Regra:` na linha de cima) e o cenário fica 'coberto'; a etapa `selos` não enxerga esses testes: não cobra selo, não acusa mudança nem sumiço. O teste pode ser alterado ou apagado depois sem trava (se outro teste citar a regra). Hoje não há nenhum caso assim (164 extraídos, 164 selados).
- **Proposta:** Em scripts/selos.mjs, fazer `extrair` contar os `test(` que a regra por linha acha e falhar quando o número difere dos testes extraídos por arquivo ('teste fora do topo ou com nome não literal') e quando duas chaves colidem. Uma linha no regras/README.md dizendo que `test(` é sempre de topo, com nome literal e único no arquivo.

### Comportamentos de plan, start, done e das esperas sem cenário no catálogo
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/state/tasks.ts:54-87` — finish mantém ✕ o que já estava interrompido sob um pai concluído; fillStarts dá início retroativo à tarefa fechada sem start.
  - `task-tree/hooks/tools.ts:62-63, 81, 133-134, 212` — Subagente sempre replaneja no lugar e o request dele é ignorado; o summary de subagente é ignorado em silêncio; start num pai aberto é aceito e acende o pai.
  - `task-tree/hooks/tools.ts:173-174` — O aviso de falta de summary só sai quando não sobra nenhuma tarefa aberta em todo o grupo principal, de qualquer pedido.
  - `task-tree/hooks/tool-call.ts:79-88` — wrap_up sem ask tira a escolha anterior; a escolha e o recap são gravados antes de a chamada responder.
  - `task-tree/hooks/panel.ts:161-179` — O turno sem plano é descartado na mensagem seguinte; o título vindo da mensagem corta em 60 caracteres com reticências, o vindo do request em 80 sem reticências (tools.ts 41).
  - `regras/arvore.md:7-99` — Nove cenários; nenhum para done num pai aberto, done em tarefa já concluída, done ou start em interrompida, start em tarefa já em andamento, plano vazio ou com mais de 3 níveis.
- **Regra do catálogo:** sem cenário
- **Cenário:** Nenhum desses comportamentos tem cenário: o done repetido numa tarefa ✓ (sem aviso), o done só com summary, o summary de subagente descartado, o start em pai aberto, o tempo das tarefas fechadas sem start, o replano de subagente, a saída da escolha por um wrap_up sem ask, e o aviso de summary que não sai enquanto um pedido anterior tem tarefa aberta. Podem mudar sem que o check perceba.
- **Proposta:** Na próxima análise que tocar hooks/tools.ts ou state/tasks.ts, registrar esses comportamentos como cenários (origem "regra do painel", a confirmar) e ligar testes; começar pelos que afetam o que a pessoa vê (aviso de summary, start em pai aberto, wrap_up sem ask).

### Os 52 hashes de commit citados nas origens do catálogo não existem no repositório, nem o exemplo "--base 9980131" do CLAUDE.md
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/sessoes.md:71` — 'Origem: commit d956e11, 2026-10-24.' (git cat-file não acha; o commit equivalente hoje é 8637626)
  - `regras/arvore.md:14, 24, 34` — 465b09e ('entrada do mod') é citado 27 vezes no catálogo e não existe (o histórico começa em 2c471e9/85744cb)
  - `regras/README.md:16, 23-24` — o formato pede 'o commit que a implementou'; o exemplo cita d57807e, também inexistente
  - `CLAUDE.md:121` — 'ex.: --base 9980131, o começo da branch'
  - `scripts/selos.mjs:129-132` — selosDeHead devolve vazio quando o git show falha: um --base inválido vira 'sem selos na base', sem erro
  - `regras/sessoes.md:64-72` — "Origem: commit d956e11, 2026-10-24." é a única origem do cenário; `git cat-file -e d956e11` falha. O commit com esse assunto hoje é 8637626.
- **Regra do catálogo:** sem cenário
- **Cenário:** Verifiquei cada hash de 7 dígitos de regras/*.md com git cat-file: os 52 distintos são inexistentes em todos os ramos (291 commits), provavelmente trocados pelo squash dos PRs. Quem precisa saber por que uma regra existe (para decidir se uma correção contradiz uma decisão) segue a origem e não acha nada. Rodar o exemplo do CLAUDE.md, npm run check -- --base 9980131, passa pela etapa selos como se a base não tivesse selo algum e só falha mais adiante, na regressão, com 'saída irreconhecível do plugin test'.
- **Proposta:** Trocar os hashes pelos do main atual (casando por data e título do commit) ou por data + título, que sobrevivem ao squash; passar a citar o número do PR nas origens novas. Em regras.mjs, avisar (sem falhar) hash citado que não existe. Em selos.mjs/regressao.mjs, falhar cedo com mensagem clara quando o --base não resolve. Corrigir o exemplo do CLAUDE.md.

### Catálogo e testes do ciclo de turno, pedido e pergunta têm lacunas e nomes desatualizados
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/perguntas.test.ts:109-121` — o teste da permissão só confere que a espera aparece; nada cobre a saída dela (fim da chamada), nem a saída de pergunta/plano no fim do turno (dropAsked), nem a escolha tirada por um wrap_up sem ask
  - `task-tree/tests/pedidos.test.ts:74-87` — o teste se chama "pai com filha concluída fica aguardando" e afirma 'concluida' (o cenário foi reescrito em 2026-11-04); o mesmo em turnos.test.ts 148-166 ("o pai com filha concluída aguarda")
  - `regras/pedidos.md:112` — "Código: … hooks/command.ts" (também em regras/cabecalho.md 27 e 39): command.ts hoje só abre o pane e responde o diagnóstico, não tem regra de visão
  - `task-tree/hooks/command.ts:10-29` — o /task-tree (abre o pane com foco e diz painéis e tamanho) não tem cenário nem teste
  - `task-tree/tests/kit/cenario.ts:40-62` — comentário órfão "Troca a visão, como /task-tree resumida | completa"; pedido() sem origin; fim de turno com reason 'end_turn'
  - `task-tree/tests/turnos.test.ts:194-203` — só a origem task-notification é testada; observer, auto-continuation e unclassified não
- **Regra do catálogo:** turnos.pai-com-filha-concluida-nunca-interrompido; perguntas.permissao-espera; pedidos.resumida-mantem-anteriores-com-algo-aberto
- **Cenário:** Fluxos do código sem cenário: o painel que volta no prompt da pessoa (showPane); o registro do comando e das ferramentas no session.start; ExitPlanMode sem tarefa aberta (liberado); pergunta de subagente; espera de permissão que some no fim da chamada; turno aberto por outra sessão visto do lado dos turnos e pedidos; prompt com command, turnId ou só imagem; fim de turno por erro. Uma mudança nesses pontos passa no check sem nenhum teste falhar.
- **Proposta:** Acrescentar os cenários (pendente ou checklist, conforme o harness alcance) e os testes; renomear os dois testes com selo de refatoração; tirar hooks/command.ts dos três "Código:" e dar a ele um cenário próprio; alinhar o kit aos motivos reais do turn.complete e permitir origin/command no pedido().

### Os avisos de envio ao modelo (ficou na fila, recebimento confirmado, done com carta na fila) não têm cenário nem teste
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/text/rules.ts:171, 187-192, 201-204` — DONE.queued, SEND.queued e SESSION.taken: três textos que orientam o modelo sobre a carta.
  - `task-tree/hooks/tool-call.ts:158-171` — Onde SEND.queued e a nota de recebimento entram no resultado da ferramenta.
  - `task-tree/hooks/tools.ts:161-168` — Onde DONE.queued entra no resultado do done.
  - `regras/lembretes.md:1-76` — Sete cenários, nenhum sobre envio ou sessão que terminou.
  - `task-tree/tests/envios.test.ts:1-391` — Os testes leem o painel; nenhum lê o contexto devolvido ao modelo num envio.
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma mudança que deixe de mandar 'recebimento confirmado', mande duas vezes (o `noted` perdido numa recarga) ou troque a tarefa citada passa no check. O caso do AskUserQuestion logo depois do fechamento automático (recusado por 'não há tarefa aberta', sem a nota que explica o fechamento, porque `asked` responde antes das notas) também não está escrito.
- **Proposta:** Acrescentar ao catálogo os cenários dos três avisos (quando saem, uma vez só, qual tarefa citam) e ligá-los a testes que leiam o contexto do resultado do SendMessage, do done e do prompt seguinte.

### Testes que afirmam só parte do "Então" do cenário que citam
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/pedidos.test.ts:51-72` — O replano é feito com um único nível 1: 'no mesmo lugar da lista' não tem como falhar; o histórico com nível 1 folha ('✕ se é folha') não é afirmado.
  - `task-tree/tests/arvore.test.ts:19-46` — Cita arvore.pai-em-andamento-no-caminho-da-ultima-iniciada mas só afirma ◉ no nível 1 e no pai; a linha do pedido, o chip 'em andamento' sem o pai e 'planos de pedidos anteriores seguem ◷' não são afirmados aqui.
  - `task-tree/tests/arvore.test.ts:74-89` — Ids ambíguo, inexistente e de outro agente só são testados com start; o cenário diz 'start ou done'.
  - `task-tree/tests/arvore.test.ts:102-111` — 'Nada muda no painel' no plan recusado é afirmado só com o painel vazio.
  - `task-tree/tests/perguntas.test.ts:109-122` — A permissão só é testada aparecendo; a saída do aviso no fim da chamada não é afirmada.
  - `regras/pedidos.md:37-46, 70-80` — Textos dos cenários de replano no lugar e de plano anterior que vira histórico.
- **Regra do catálogo:** pedidos.replano-no-lugar (O replano no mesmo pedido substitui no lugar)
- **Cenário:** Uma regressão que ponha o nível 1 replanejado no fim da lista, que faça o done não avisar id ambíguo, que apague um plano existente ao recusar ids repetidos ou que deixe o aviso de permissão preso passa em todos os testes atuais.
- **Proposta:** Completar os testes (como refatoração, sem diminuir asserções): replano com dois níveis 1 afirmando a ordem; done com id ambíguo, inexistente e de outro agente; plan recusado com um plano já no painel; permissão que some ao fim da chamada; linha do pedido e chip no teste do pai em andamento; nível 1 folha abandonado por pedido novo fica ✕.

### Mapa de código do catálogo não cobre os arquivos de que alguns cenários dependem
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/perguntas.md:1-5, 57-65` — Código da área: hooks/tool-call.ts, hooks/panel.ts, draw/layout.ts; o cenário da escolha não soma outro arquivo.
  - `task-tree/hooks/prompt-submit.ts:82` — Quem tira a escolha na próxima mensagem é o prompt.submit.
  - `task-tree/hooks/turn.ts:113` — O turn.complete tira pergunta e plano abertos (dropAsked).
  - `regras/lembretes.md:1-5, 57-66` — Código da área: prompt-submit, rules, turn; o cenário da primeira chamada soma só hooks/tool-call.ts.
  - `task-tree/hooks/tools.ts:37, 129, 190` — O estado do lembrete de planejar (reminders.planned) é escrito em hooks/tools.ts e declarado em hooks/panel.ts, fora do mapa de lembretes.
  - `regras/pedidos.md:102-113` — O cenário da visão resumida soma hooks/command.ts, que hoje só abre o painel; a regra vive em joinWork (hooks/panel.ts) e openInSight/trimToWork (draw/layout.ts).
- **Regra do catálogo:** perguntas.escolha-do-wrapup-ate-proxima-mensagem (A escolha do wrap_up fica até a próxima mensagem)
- **Cenário:** Na análise de uma mudança em hooks/prompt-submit.ts ou hooks/tools.ts, `npm run impacto` não lista os cenários de perguntas nem o do lembrete de planejar como afetados; o brief sai sem eles.
- **Proposta:** Acrescentar hooks/prompt-submit.ts e hooks/turn.ts ao código da área de perguntas; hooks/tools.ts e hooks/panel.ts ao cenário do lembrete de planejar; trocar hooks/command.ts por hooks/panel.ts no cenário da visão resumida.

### Regras de ultracode: o que se afirma é só o alt; o corte "junto com o modelo" está como checklist embora o harness alcance, e o golden não tem ultracode
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/ultracode.test.ts:20-21, 26-42, 77-93` — cartao() e topo() leem só o alt dos Svgs
  - `task-tree/draw/svg.ts:382-399, 730` — o desenho decide `eng` pela largura (palavra e modelo saem juntos); rowAlt escreve a palavra sempre
  - `regras/ultracode.md:39-47` — cor-e-corte: checklist (cor e tema, no app), mas inclui "faltando espaço, sai junto com o modelo" e "nada no terminal"
  - `task-tree/tests/kit/leitura.ts:79-103` — svgs() devolve o source de cada Svg: dá para afirmar a presença de class="ul" e o corte
- **Regra do catálogo:** ultracode.cor-e-corte; ultracode.cartao-da-filha
- **Cenário:** Uma mudança que desenhe o modelo sem a palavra quando falta espaço, que tire o <text class="ul"> do cartão ou que passe a escrever a palavra no terminal passa em todos os testes; só a validação visual pegaria.
- **Proposta:** Separar o cenário: a cor e o tema ficam em checklist; o corte e o "nada no terminal" viram cenário coberto, com teste no source do SVG (cartão largo com a palavra, cartão estreito sem modelo e sem palavra, terminal sem a palavra). Acrescentar a filha em ultracode a um cenário do golden na próxima aprovação visual.

### Cenários de turnos e durabilidade cobertos só em parte (e dois testes com nome que contradiz o que afirmam)
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/turnos.test.ts:133-146` — prompt-seguinte-retoma: só o caso com Esc; o "normal" do Dado não é exercitado, nem o estado da tarefa antiga depois do prompt
  - `task-tree/tests/turnos.test.ts:44-55, 104-116` — iniciada-aguarda-no-fim: afirma ◷, não o "relógio parado"
  - `task-tree/tests/durabilidade.test.ts:274-326` — fim-do-turno-sobrevive-ao-reinicio: cobre session.start e respawn; a "retomada" do Quando (restoreTurn com substituição) e "o relógio não anda" não são afirmados
  - `task-tree/tests/durabilidade.test.ts:110-122` — retomada 2/2: o store tem o trabalho da sessão; "um trabalho sem nenhuma tarefa presente não vale" não é exercitado
  - `task-tree/tests/turnos.test.ts:148-166` — nome diz "o pai com filha concluída aguarda"; a asserção é 'concluida'
  - `task-tree/tests/pedidos.test.ts:74-87` — nome diz "fica aguardando, nunca interrompido"; as asserções são 'concluida' (regra reescrita em 2026-11-04)
- **Regra do catálogo:** turnos.prompt-seguinte-retoma; turnos.iniciada-aguarda-no-fim; durabilidade.fim-do-turno-sobrevive-ao-reinicio; durabilidade.reinicio-restaura-do-store; turnos.pai-com-filha-concluida-nunca-interrompido
- **Cenário:** Uma regressão no caminho de retomada do fim do turno, no relógio parado ou no trabalho sem tarefa presente não é pega; e quem lê o nome dos dois testes entende a regra antiga (pai ◷), não a atual (pai ✓).
- **Proposta:** Acrescentar os casos que faltam como testes novos (selo `novo`): prompt seguinte depois de fim normal, tempo parado com relogio.advance, retomada com fim de turno no store, retomada sem trabalho no store. Renomear os dois testes como refatoração selada, sem mudar asserções.

### Os arquivos publicados de referência param em 8 formatos; nenhum tem rate, git, aborted, ultracode nem grupo de subagente
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/fixtures/publicados.ts:5-13` — 8 entradas; a mais nova tem version, engine, panes, drawSize, rows, work, received, sends
  - `task-tree/io/publish.ts:3-8, 44-57` — o contrato diz "one file of every shape ever written"; parsePublished lê ultracode, rate, git (com kind), aborted e renderError, sem exemplo nos fixtures
  - `regras/durabilidade.md:50-60` — "os 8 formatos que já existiram"
- **Regra do catálogo:** durabilidade.formatos-antigos-do-publicado
- **Cenário:** Os campos que entraram depois (taxa com live:false da medida antiga, git de pasta, aborted, ultracode, grupos com `sub`) mudaram a forma do arquivo sem mudar `version`; uma filha com versão diferente do mod publica esses formatos e nenhum teste os lê.
- **Proposta:** Acrescentar um fixture por forma nova (um com rate.live=false, um com git kind folder, um com aborted, um com ultracode e grupo com sub) e trocar o "8" do cenário por "todos os formatos de fixtures/publicados.ts"; registrar a regra de quando subir PUBLISHED_VERSION.

### Mapa de código incompleto: taxa não aponta o desenho nem a publicação, e turnos não aponta tool-call.ts
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/taxa.md:5` — Código da área: hooks/turn.ts, hooks/agents.ts
  - `task-tree/draw/layout.ts:1482` — o toks/s do cartão de subagente é montado aqui
  - `task-tree/draw/svg.ts:55-56, 386-403` — rateText e o lugar e o corte da taxa no cartão
  - `task-tree/io/publish.ts:47-49, 148` — leitura e publicação de rate
  - `task-tree/io/host.ts:160` — a taxa da filha chega ao cartão por aqui
  - `task-tree/hooks/tool-call.ts:82, 209` — o recap do wrap_up e o wake em toda chamada do loop principal (parte das regras de turnos) vivem aqui, fora do mapa de regras/turnos.md
- **Regra do catálogo:** taxa.* e turnos.* (linha "Código da área")
- **Cenário:** `npm run impacto -- task-tree/draw/layout.ts task-tree/io/publish.ts` numa mudança que mexe no toks/s do cartão não lista nenhum cenário de taxa; o brief da análise sai sem eles.
- **Proposta:** Acrescentar a taxa.md: draw/layout.ts, draw/svg.ts, io/publish.ts, io/host.ts; a turnos.md: hooks/tool-call.ts e hooks/tools.ts (wake e resumo). O check só avisa, então não bloqueia nada.

### Testes que afirmam só parte do "Então" em cenários marcados como cobertos
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/sessoes.test.ts:47-61, 232-277` — A palavra 'aguardando' só é afirmada pela ausência (nenhuma filha de teste espera a pessoa); o parâmetro `tomada` do roteiro da cadeia nunca é usado como true (carta entre irmãs entregue não é lida).
  - `task-tree/tests/subagentes.test.ts:20-33, 185-205, 221-238` — Não se afirma o esforço nem 'em segundo plano'; no pai que conclui, não se afirma o cartão depois do ✓, o tempo parado no fim do subagente, nem que o done posterior acrescenta o resumo (só `erro` falso).
  - `task-tree/tests/envios.test.ts:287-310, 346-391` — A carta 'antes do cartão da sessão' e o chip de espera por sessão não são afirmados; o casamento pelo nome só é exercitado com SendMessage, nunca com a abertura de sessão ('a carta e o cartão').
  - `task-tree/tests/kit/cenario.ts:28-29` — abrirSessao manda sempre `title: 'filha'` e nenhum `name`: o caminho dos nomes em recordStart não tem como ser testado com o kit atual.
- **Regra do catálogo:** sessoes.palavra-de-estado-do-cartao; subagentes.pai-conclui-no-fim-do-turno; subagentes.cartao-mostra-modelo-e-estado; envios.carta-pelo-nome-da-sessao; sessoes.mensagem-entre-filhas-no-cartao-da-remetente; envios.carta-sob-a-tarefa; envios.pedido-recebido-mostra-carta
- **Cenário:** O check aceita o cenário como coberto porque algum teste cita o id; as partes listadas do Então podem regredir sem nenhum teste falhar. Foi o que deixou passar o cartão de subagente que some com a tarefa fechada.
- **Proposta:** Completar as asserções (teste novo ou refatoração selada, sem diminuir as existentes): filha com `aguardando: true`; cadeia com a carta tomada; cartão do subagente depois do ✓; 'em segundo plano' e esforço; abrirSessao com nome no kit e teste do cartão pelo nome; chip de espera por sessão na carta na fila; carta recebida cinza.

### Comportamentos de sessões, envios e subagentes sem cenário no catálogo
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/sessions.ts:33-45, 169-186, 217-241` — A linha 'Sessões indisponíveis: …' quando a lista falha; o aviso único de recebimento confirmado; o lembrete de sessão que terminou o turno com a origem aberta: nenhum tem cenário (regras/lembretes.md só cobre replanejar, lista de abertas, sem plano e regras no prompt).
  - `task-tree/hooks/tool-call.ts:126-162` — O cartão provisório 'Sessão…' para destino ainda não listado, o envio com falha que não gera carta, a detecção de fila por texto ('queued|held|pending') e a nota de mensagem na fila.
  - `task-tree/draw/layout.ts:107, 177-208, 294-296` — Profundidade máxima de 3 níveis de sessões, a rodada de mensagem sem envio registrado (cartão órfão) e a espera de 10 s pela origem de mensagem de irmã.
  - `task-tree/hooks/agents.ts:53-57` — Subagente retomado (`resume`) e teammate são ignorados no lançamento: o cartão de um retomado segue 'concluído' enquanto ele trabalha de novo.
  - `task-tree/hooks/sessions.ts:94-103, 141-148` — A confirmação de entrega para sessão que não publica `received` (parada e depois rodando) e o limite das últimas 20 mensagens, rodadas e envios.
- **Regra do catálogo:** sem cenário
- **Cenário:** Mudanças nesses pontos não aparecem na matriz de impacto nem são protegidas por regra: por exemplo, alterar o texto que detecta 'queued' ou o limite de 20 rodadas muda o painel sem cenário que diga o esperado.
- **Proposta:** Criar cenários (cobertos onde o harness alcança, checklist no resto) para: lembretes de sessão (terminou o turno, recebimento confirmado, mensagem na fila, done com carta na fila); lista de sessões indisponível; sessão iniciando; envio que falha; mensagem sem rodada registrada; subagente retomado e teammate; limites de 20 e de profundidade.

### Onde caem os cliques (Box sobre o ícone e o anel) não tem proteção automática; 'crossings' e 'spanOf' são código morto
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/draw/geometry.ts:129-156` — o comentário promete "no two Boxes on one line cross (see crossings)"; crossings e spanOf não são chamados por nenhum arquivo do mod nem dos testes (grep em task-tree/)
  - `task-tree/hooks/render.tsx:71-80, 93-104` — os Box e Button são montados a partir de overlays(), em células
  - `task-tree/tests/kit/leitura.ts:82-103` — svgs() só recolhe elementos Svg: left/right/width dos Box e as chaves dos Button do desktop não entram no golden nem em asserção alguma
  - `task-tree/DESENVOLVIMENTO.md:706` — a doc descreve a regra como "conferida" (7 profundidades × 4 aninhamentos, 6 larguras), conferência que não existe mais na suíte
- **Regra do catálogo:** visual.cliques-no-icone-e-no-anel (checklist)
- **Cenário:** Uma mudança em CELL, COL_STEP, RING_CELLS ou em overBox desloca o botão de recolher ou o do anel (ou faz os dois se cruzarem numa linha funda de painel estreito). O check passa inteiro, o golden não muda, e o defeito só aparece se alguém clicar no app.
- **Proposta:** O desktop montado no harness devolve os Box com left/right/width: acrescentar ao kit uma leitura dos Box por linha e um teste (ou incluí-los no golden) que afirme a posição do botão sobre o ícone e o anel e que dois Box da mesma linha não se cruzam nas profundidades e larguras usadas; remover ou passar a usar crossings/spanOf.

### Checklists que o harness já alcança pelo source do SVG seguem sem teste
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/visual.md:93-111, 217-226` — os três cenários estão em checklist por "pintura real" ou "o terminal não desenha o modelo"
  - `task-tree/tests/visual.test.ts:52-73, 91-110` — o kit já lê posições e classes no source do SVG do desktop (faixa, recorte do título, x do tempo): a mesma técnica serve para a seção sem traço e para a ordem toks/s, modelo, anel
  - `task-tree/draw/svg.ts:79, 559-566` — a linha de seção hoje só desenha o ▸/▾ e o texto; as classes do traço (ln, lnf) ficaram sem uso: nada impede o traço de voltar
  - `task-tree/tests/ultracode.test.ts:20-42` — o cartão com modelo já é montável no harness com o arquivo 'publicado', mas a asserção é só no alt
- **Regra do catálogo:** visual.secao-sem-traco, visual.cartao-modelo-e-esforco, visual.cartao-posicao-de-toks-e-repo, cabecalho.aviso-de-painel-grande-volta (13 dos 34 cenários dos dois arquivos estão em checklist: 1 de 14 no cabeçalho, 12 de 20 no visual)
- **Cenário:** Sem proteção automática hoje: linha de seção sem traço, modelo e esforço à esquerda do anel, toks/s à esquerda do modelo e repositório à direita do nome, o aviso de painel grande e o botão Voltar; além do que só o app mostra de fato (largura real, cliques, animação, cores dos temas, status do app, ordem com sessões reais, recarga a quente). Uma regressão nos quatro primeiros passa no check.
- **Proposta:** Converter em testes de source: seção sem <path>/<rect> de traço; no cartão, x do toks/s < x do modelo < anel e repositório depois do nome; avaliar o aviso de painel grande com um plano grande no desktop. Mudar o estado para coberto no mesmo commit e deixar em checklist só a pintura.

### Testes cobertos que afirmam só parte do "Então"
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/tests/cabecalho.test.ts:137-149` — "só ele fica ◉": o teste afirma Plano A em andamento, mas não que Plano B não está
  - `task-tree/tests/cabecalho.test.ts:151-170` — "no máximo três pedidos sem nada aberto ficam desenhados": o roteiro deixa só o último pedido à vista (+4); o limite de três dentro do trabalho (layout.ts 1336-1341) não é exercitado aqui, e em sessoes.test.ts 348-366 só a exceção (cartão vivo) é
  - `task-tree/tests/cabecalho.test.ts:35-58` — "(plan ou start)": o teste faz os dois em sequência; nem o plan sozinho nem o start sozinho (de tarefa de pedido antigo) são vistos
  - `task-tree/tests/visual.test.ts:61-73, 91-129` — "a palavra de estado encosta no tempo" (svg.ts 540-543) não é afirmada em nenhum dos três testes da regra
- **Regra do catálogo:** cabecalho.titulo-desempata-pela-ordem-do-start; cabecalho.limites-de-linhas; cabecalho.resumida-exclui-pedido-finalizado; visual.titulo-sem-contagem-vai-ate-o-tempo
- **Cenário:** Uma mudança que acenda os dois planos no empate, que deixe quatro pedidos concluídos desenhados dentro do trabalho, que faça o plan sozinho não limpar o pedido finalizado ou que afaste a palavra "interrompida" do tempo passa em todos os testes que citam essas regras.
- **Proposta:** Acrescentar as asserções que faltam (são acréscimos, selo de refatoração: Plano B ≠ andamento no empate; um trabalho com 4+ pedidos e um aberto, afirmando quais ficam; casos separados de plan e de start; x da palavra de estado junto do tempo).

### O comando /task-tree não tem cenário nem teste, e o mapa de código o cita em três cenários de visão que não passam mais por ele
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/command.ts:1-29` — o comando abre o painel com foco, lista os painéis do app, publica e responde 'Painel de tarefas aberto... Desenho: X KB de Y KB' ou 'O app não pôs o painel na tela: <motivo>'
  - `regras/cabecalho.md:27, 39` — 'Código: hooks/panel.ts, hooks/command.ts' em cabecalho.resumida-exclui-pedido-finalizado e cabecalho.resumida-limpa-so-com-tudo-concluido
  - `regras/pedidos.md:112` — 'Código: draw/layout.ts, hooks/command.ts' em pedidos.resumida-mantem-anteriores-com-algo-aberto
  - `scripts/regras.mjs:92-93` — 'fora do mapa' só avisa arquivo que nenhum cenário cita: uma citação vencida cala o aviso
  - `task-tree/DESENVOLVIMENTO.md:1546-1548` — 'Saíram ... os argumentos de /task-tree' (2026-11-04)
- **Regra do catálogo:** sem cenário
- **Cenário:** Quando o painel não aparece, o usuário digita /task-tree para saber por quê (largura, aba atrás de outra, não desenhado). Esse diagnóstico não tem cenário no catálogo nem teste (nenhum arquivo de tests/ dispara command.run). O arquivo só não aparece como 'fora do mapa' porque três cenários de visão ainda o listam, de quando o comando trocava a visão; npm run impacto -- hooks/command.ts aponta para cenários que não dependem dele.
- **Proposta:** Criar o cenário do comando (abre o painel e responde o diagnóstico, nos dois ramos) em regras/durabilidade.md ou num arquivo próprio, com teste se o harness tiver command.run (senão checklist), e tirar hooks/command.ts dos três Código:. Revisar o mapa por área depois de cada remoção de funcionalidade.

### Pendências e decisões em aberto só existem no histórico; o catálogo não tem nenhum cenário pendente
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:1532-1542` — Pendências: 'elapsed não é usado' e 'Cabeçalho fixo ao rolar (pedido do usuário, deixado para depois)', com o próximo passo descrito.
  - `task-tree/draw/layout.ts:83, 872` — elapsed e REPLY seguem exportados e sem uso (por serem exportados, o noUnusedLocals não os acusa).
  - `task-tree/DESENVOLVIMENTO.md:1070-1072` — 'os números somam os dois, consequência da regra, e se isso deve mudar ficou para decisão do usuário'.
  - `regras/cabecalho.md:7-14` — cabecalho.numeros-somam-o-desenhado já registra a decisão de somar o que está desenhado, o que torna a pendência acima obsoleta ou não respondida.
  - `task-tree/DESENVOLVIMENTO.md:946-947` — 'Não visto ao vivo: se o botão sobre a imagem que muda a cada segundo pisca.'
  - `regras/README.md:25-28` — O estado 'pendente' existe no formato, mas nenhum cenário o usa.
- **Regra do catálogo:** cabecalho.numeros-somam-o-desenhado (Os números do cabeçalho somam o que está desenhado)
- **Cenário:** O usuário pediu o cabeçalho fixo ao rolar e o pedido ficou 'para depois' num parágrafo do histórico. Como o catálogo é o lugar das decisões e não tem cenário pendente, a matriz de impacto e as análises não enxergam o pedido, e ele pode ser esquecido ou refeito do zero. O mesmo vale para a dúvida sobre a soma do cabeçalho com pedido anterior em andamento.
- **Proposta:** Levar ao catálogo: um cenário 'pendente' para o cabeçalho fixo ao rolar (com as palavras do usuário), e fechar a dúvida da soma do cabeçalho (ou apagar a frase do histórico, se a decisão de 2026-10-23 já a responde). Remover elapsed e REPLY ou registrar por que ficam. Passar 'se o botão pisca' para um cenário de checklist existente.
- **Pergunta ao usuário:** O cabeçalho fixo ao rolar continua desejado? Se sim, entra no catálogo como pendente; se não, sai das pendências. Recomendo registrar como pendente.

### O catálogo e os testes cobrem a recarga só para painel, cartões, recap e resumo; os fluxos com carta na fila, subagente vivo, pergunta aberta e lembretes não têm cenário
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/durabilidade.md:62-70, 83-92` — Os dois cenários de recarga: painel + ligações + recap, e o resumo do done.
  - `task-tree/tests/durabilidade.test.ts:135-203, 328-352` — Os testes de recarga: state semeado, módulo novo; nenhum com store, envio pendente, subagente, espera ou lembrete.
  - `regras/visual.md:123-131` — O único cenário de checklist da recarga real: 'nada some, os relógios voltam a correr e o primeiro clique funciona'.
  - `task-tree/tests/kit/ambiente.ts:51-70` — O kit já permite simular a recarga (state mantido, módulo novo) junto com `armazem`, `host`, `lancaveis`.
- **Regra do catálogo:** durabilidade.recarga-mantem-painel-ligacoes-e-resumo (A recarga a quente mantém o painel, as ligações e o recap do turno)
- **Cenário:** Os defeitos deste relatório (carta fechada pelo recebimento errado, envio duplicado pela fusão, contagem do subagente, lembrete de planejar) estão todos em caminhos que o harness alcança com `estado(...,'semear')`, mas nenhum tem cenário: nada os teria pego, e uma correção não teria onde ligar o teste. O que só o app mostra (pane fora da tela, chamada em voo, clique entre a recarga e o redesenho) também não está discriminado no cenário de checklist.
- **Proposta:** Acrescentar à área durabilidade um cenário por fluxo de recarga no meio do turno: tarefa cronometrando (o tempo continua do início), subagente vivo (contagem e fim), carta na fila (duas para a mesma sessão), pergunta/permissão aberta, pedido que já planejou (sem lembrete), ligações com store diferente do state. Os que dependem do app ficam `checklist`, desdobrando visual.recarga-real-e-respawn.

### O catálogo e os testes não têm nenhum cenário de falha: linha de erro do desenho, "Sessões indisponíveis", store ou arquivo que falha, hook que lança
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/durabilidade.md:1-97` — Os oito cenários são de caminho feliz (reinício, respawn, recarga, formatos antigos); nenhum diz o que acontece quando o store não lê ou não grava.
  - `regras/fumaca.md:1-16` — A área declara io/log.ts como código dela, mas o único cenário é "o plan mostra a tarefa"; nada sobre o que deve ser registrado.
  - `task-tree/hooks/render.tsx:292, 359-364` — Dois comportamentos visíveis sem cenário: a linha "Sessões indisponíveis: …" e a linha "Painel de tarefas: erro ao desenhar: …".
  - `task-tree/tests/kit/ambiente.ts:41-50, 103-136` — Os stubs de store, mcp e fs sempre respondem; o único { deny } é "sem arquivo". O kit aceita { deny } para simular falha, mas nenhum teste usa em store.get, store.set, fs.write, agent.list ou no get_session.
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma mudança que troque a ordem dos passos de um hook, ou remova um catch, passa em todo o npm run check, porque nenhum teste faz o host falhar. As regressões desta frente (store encolhido, fim de turno não registrado, cartão congelado) só apareceriam no uso.
- **Proposta:** Criar uma área "falhas" no catálogo, com um cenário por comportamento decidido: store que não lê não encolhe; store que não grava é avisado; lista de sessões indisponível mostra a linha e mantém os cartões; arquivo publicado ilegível mantém o último painel; erro no desenho mostra a linha e publica renderError; falha num passo acessório não impede o registro do fim do turno nem do envio. No kit, um ambiente `hostQueFalha({ store, fs, mcp, agent })` com stubs { deny }.

## Documentação

18 achados: 0 de severidade alta, 3 média, 15 baixa.

### Tabela de durabilidade e documentação desatualizadas, e o teste que a tabela diz ter não existe
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/hooks/panel.ts:20-21 — o mesmo engano repetido ('has a row for every one of them (tests/durabilidade.test.ts)')
  - task-tree/types/index.d.ts:231 e task-tree/state/durability.ts:50-81 — as 19 chaves de $.state têm linha na tabela; o que falta ou sobra são linhas de variáveis de módulo
  - task-tree/draw/layout.ts:1227 e task-tree/types/index.d.ts:203 — o cartão desenha as cartas a partir dos sends publicados, tomados inclusive (os últimos 20): publicar a lista inteira é o comportamento certo; errados estão o comentário de io/publish.ts:100-102 e o DESENVOLVIMENTO.md:268
  - task-tree/DESENVOLVIMENTO.md:241, 247-249 — o doc já admite 'starting' sem linha e drawNow/breaksMemo sem variável
  - STATE_KEYS, STORES, LINK_KEYS e stateOf — confirmado por busca: só aparecem na própria durability.ts
- **Regra do catálogo:** sem cenário
- **Cenário:** Quem acrescenta uma chave de state ou muda o arquivo publicado confia na tabela e no doc: acredita que um teste falha se esquecer a linha (não falha), procura `view` e `ensureView` (não existem), e supõe que os envios entregues não vão ao arquivo (vão). O efeito é manutenção errada, não um defeito visível hoje.
- **Proposta:** (a) Um teste puro que lê os arquivos de `hooks/` e confere cada `key: '…'` contra TABLE, e o tipo PluginState contra STATE_KEYS; ou trocar o comentário por "conferido à mão". (b) Tirar as linhas mortas da tabela e acrescentar as variáveis de módulo que faltam. (c) Atualizar "Estado e durabilidade" e "Arquivo publicado" do DESENVOLVIMENTO e os comentários de publish.ts, host.ts e types. (d) Decidir se os envios já entregues devem mesmo ir ao arquivo publicado e alinhar comentário e tipo.
- **Ajuste da verificação à proposta:** (a) Não cabe como teste do harness (sem fs dentro do teste, CLAUDE.md:26-27): a conferência das chaves vai num script do check (junto da etapa regras) ou o comentário passa a dizer 'conferido à mão'. (d) Não é decisão a tomar: os envios entregues precisam ir ao arquivo (a carta verde no cartão da remetente depende deles); basta corrigir o comentário e o doc. (c) é o mesmo trabalho dos outros achados relacionados desta área e deve ir junto, com a mesma pergunta sobre manter o DESENVOLVIMENTO.
- **Verificação:** Abri durability.ts, o teste de durabilidade, publish.ts e host.ts: o teste citado no comentário não existe, quatro exports não têm uso, há linhas mortas e variáveis sem linha, e o doc diz o contrário do comentário. As chaves de state estão todas na tabela; o risco é alguém confiar numa trava que não existe.

### A memória do projeto, carregada em toda sessão, ainda diz 'sem testes nem docs' e 'sem claude plugin test', contra o CLAUDE.md atual
- **Categoria:** contradição · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - CLAUDE.md:149-152 — a regra 'nunca na memória' vale só para regras de uso do painel; não é ela que invalida a memória de fluxo
  - CLAUDE.md:49-50 e 127-128 — decisões do usuário de 2026-10-28 ('Sim, pular (Recomendado)'; 'Sim, validar antes do commit (Recomendado)') são posteriores às memórias de 2026-10-23 e supõem a suíte
  - regras/selos.json — selos datados de 2026-10-28 em diante: a suíte voltou depois da memória
  - memory/fluxo-commit-local-validacao-visual.md:15 — a mesma memória registra 'sem docs', que continua sem confirmação atual
  - task-tree/text/rules.ts:6-7 e regras/lembretes.md:64 — são do repositório; a origem em lembretes.md é citação de mensagem de commit, não regra
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma sessão orquestradora abre uma filha de correção de bug e monta o resumo de abertura. A memória diz para não pedir teste nem documentação e para não rodar `claude plugin test`; o CLAUDE.md do repositório manda o contrário (teste e cenário no mesmo commit, check completo no hook). Conforme a fonte que a sessão seguir, a filha entrega a correção sem teste e sem cenário, e o hook não acusa: nada obriga um commit de código a trazer teste novo.
- **Proposta:** A sessão principal (dona da memória) apaga ou reescreve as entradas `bug-teste-antes-da-correcao` e a parte 'sem testes' de `fluxo-commit-local-validacao-visual`, deixando a memória apontar para o CLAUDE.md do repositório. Não é mudança no repositório.
- **Ajuste da verificação à proposta:** As memórias guardam palavras do usuário: a reescrita deve citar a decisão posterior e ser confirmada com ele em uma linha, e incluir as duas linhas do índice MEMORY.md. A parte 'sem docs' não deve ser apagada junto: vira pergunta com o outro achado relacionado desta área. O comentário de text/rules.ts é mudança no repositório (só comentário), ao contrário do que a proposta diz.
- **Decisão já registrada:** Decisão antiga: memória bug-teste-antes-da-correcao.md (2026-10-23, 'Manter sem testes'). Decisões posteriores que a desfazem: CLAUDE.md:16-17, 49-50 e 127-128 (2026-10-28).
- **Verificação:** Li as duas memórias e o CLAUDE.md: a memória manda não pedir teste, cenário nem plugin test, e o CLAUDE.md manda teste e cenário no mesmo commit. O hook roda os testes de qualquer jeito, mas nada obriga uma correção a trazer teste novo, então a sessão que seguir a memória entrega sem ele.

### `npm run testes:alterados` e `npm run impacto` comparam com HEAD: depois do commit local, que o fluxo manda fazer antes do relato, os dois respondem 'nenhum'
- **Categoria:** ambiguidade · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - scripts/alterados.mjs:14-17, 32-39 e scripts/impacto.mjs:69-76 — confirmado: sem argumento, os dois comparam HEAD com a pasta de trabalho
  - scripts/alterados.mjs:16-17 e scripts/impacto.mjs:74-75 — os dois já aceitam --base <ref>: com -- --base HEAD~1 dão a resposta certa depois do commit
  - scripts/alterados.mjs:39 — com --base o título diz 'a base do PR (<hash>)', mesmo quando a base é HEAD~1
  - CLAUDE.md:106-109 e regras/README.md:127-135 — nenhum dos dois diz quando rodar; o modelo do relato começa pelo hash do commit
- **Regra do catálogo:** sem cenário
- **Cenário:** A sessão de implementação muda um teste por decisão, sela, faz o commit local e monta o relato pelo modelo (commit, check, testes:alterados, impacto). Rodados depois do commit, os dois comandos comparam HEAD com a pasta de trabalho idêntica: 'Testes existentes alterados desde HEAD: nenhum' e 'Arquivos do mod tocados: nenhum'. O usuário lê um relato dizendo que nenhum teste existente mudou, justamente a informação que serve para ele revisar selos de decisão e refatoração.
- **Proposta:** Nos dois scripts, quando o índice e a pasta de trabalho não diferem de HEAD, comparar o último commit (`HEAD~1..HEAD`) e dizer isso na primeira linha ('desde HEAD~1, o commit <hash>'). Como alternativa mínima, corrigir CLAUDE.md e regras/README.md para mandar rodar antes do commit ou com `-- --base HEAD~1`.
- **Ajuste da verificação à proposta:** A alternativa mínima resolve sem mexer em script: CLAUDE.md e regras/README.md mandam rodar com -- --base HEAD~1 (ou antes do commit). Se o padrão dos scripts mudar, a CI não é afetada (ela passa --base) e convém corrigir o rótulo 'a base do PR'.
- **Verificação:** Li os dois scripts: com a árvore limpa depois do commit local, os dois respondem 'nenhum'. O fluxo manda commit por item e relato com as duas saídas, sem dizer a ordem, e o relato pode afirmar que nenhum teste mudou quando mudou.

### Inventário de módulos e hooks parado na versão 0.7.4: `hooks/agents.ts`, `io/git.ts`, três hooks e quatro chaves de estado sem nenhuma linha no documento
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:11-14 — a seção se data ('escrita na fase 5 sobre a main 152da41… atualizada na fase 6'), o que avisa o leitor em parte
  - task-tree/hooks/register.tsx:18-34 — confirmado: 17 registros, com agent.spawn e dois prompt.attachment
  - task-tree/types/index.d.ts:231 — confirmado: 19 chaves
  - task-tree/hooks/panel.ts:305-317, 320-325 — identify ainda reclama o registro de launches, mas só para o grupo criado sem o agent.spawn (primeiro plan ou espera)
  - busca no DESENVOLVIMENTO.md por agent.spawn, agents.ts, settleBySubs, namedFor, refreshGit, ultracode, toks, turnAborted, prompt.attachment e io/git — nenhuma ocorrência
- **Regra do catálogo:** subagentes.cartao-desde-o-lancamento; taxa.velocidade-de-geracao; ultracode.cartao-da-filha; envios.carta-pelo-nome-da-sessao
- **Cenário:** Uma busca no documento inteiro por `agents.ts`, `io/git`, `agent.spawn`, `prompt.attachment`, `toks`, `ultracode`, `turnAborted`, `settleBySubs`, `namedFor` e `refreshGit` não acha nada. Tudo o que entrou de 2026-11-09 em diante (cartões de subagente, toks/s, ultracode, repositório e branch, pai que reflete o subagente, carta pelo nome da sessão) só existe no código e no catálogo.
- **Proposta:** Acrescentar a "Módulos" os dois arquivos, corrigir a contagem e a tabela dos hooks (17, com `agent.spawn` e as duas `prompt.attachment`), a contagem de chaves (19) e um parágrafo curto por recurso novo apontando para o cenário do catálogo. Tirar o número de versão do texto (ele sobe sozinho no merge).
- **Ajuste da verificação à proposta:** Atualizar o documento contraria a ordem registrada de não mexer em docs sem pedido: deve virar pergunta, a mesma do outro achado relacionado desta área (manter 'Como é hoje' a cada mudança ou reduzi-la). Se a resposta for reduzir, o inventário de módulos e hooks sai em vez de ser atualizado. Juntar com os outros achados relacionados desta área: é um trabalho só.
- **Decisão já registrada:** Memória do projeto, fluxo-commit-local-validacao-visual.md:15 (2026-10-23): 'sem docs, sinal, etc... somente correção e commit'; o DESENVOLVIMENTO.md fica para quando ele pedir. A própria memória pode estar vencida (outro achado relacionado desta área).
- **Verificação:** Conferi versão, contagens, lista de módulos e tabela de hooks contra o código: tudo o que o achado diz que falta, falta. É dívida de documentação sem efeito no painel; o código e o catálogo estão certos.

### "Como é hoje" ainda descreve as duas visões e o estado `view`, que o próprio documento diz terem saído
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** confirmado na verificação
- **Evidência:**
  - task-tree/DESENVOLVIMENTO.md:11-14 — a abertura data a seção (main 152da41, fase 6), mas afirma descrever o código como está
  - task-tree/DESENVOLVIMENTO.md:1547-1548 — a nota 'as menções a visões nas seções anteriores são histórico' foi posta de propósito no commit f46bdce
  - task-tree/hooks/panel.ts:2, 59, 581-582 — comentários do código também ainda citam 'the view' e 'ensureView'
  - task-tree/tests/kit/cenario.ts:40 — sobrou o comentário 'Troca a visão' sem função embaixo
  - task-tree/tests/sessoes.test.ts:403 e task-tree/tests/durabilidade.test.ts:64, 81 — nomes de testes ainda falam em 'duas visões' e 'visão resumida' (renomear troca a chave do selo)
- **Regra do catálogo:** cabecalho.numeros-somam-o-desenhado (Reescrito 2026-11-04: 'não há mais visões'); pedidos.resumida-mantem-anteriores-com-algo-aberto
- **Cenário:** Quem vai editar o mod lê "Como é hoje" (a referência de arquitetura apontada pelo CLAUDE.md) e procura `setView`, a linha `view` da tabela ou a chave `view:`; nada disso existe. O aviso de que virou histórico está 1 200 linhas abaixo, em outra seção, e a abertura de "Como é hoje" diz o contrário (tudo conferido).
- **Proposta:** Tirar de "Como é hoje" as menções a visões (módulos, tabela dos hooks, fluxo de dados, tabela de durabilidade, bullets do terminal e do `ui.press`) e trocar a frase de abertura por data e commit da última conferência. O que for comportamento deve apontar para o cenário do catálogo em vez de repetir a regra.
- **Ajuste da verificação à proposta:** A pergunta ao usuário já está no achado e deve vir antes de qualquer edição, porque há ordem registrada de não mexer em docs sem pedido. Juntar com os outros achados relacionados desta área (tabela de durabilidade) e 8 (inventário) desta área: mesma seção, mesma resposta. Se a resposta for reduzir, sobram no doc arquitetura, durabilidade e limites do kit; os comentários do código e do kit que citam a visão entram na mesma limpeza (o do kit exige selo).
- **Pergunta ao usuário:** "Como é hoje" deve voltar a ser mantida a cada mudança (regra no CLAUDE.md, no mesmo commit do catálogo), ou deve ser reduzida a arquitetura, durabilidade e limites do kit, deixando o comportamento só no catálogo `regras/`? Recomendo reduzir: o catálogo já é conferido pelo `npm run check`, o documento não é.
- **Decisão já registrada:** task-tree/DESENVOLVIMENTO.md:1544-1551 (nota do próprio doc, sem palavras do usuário sobre o doc) e memória fluxo-commit-local-validacao-visual.md:15 (2026-10-23: 'sem docs'; o DESENVOLVIMENTO.md fica para quando ele pedir)
- **Verificação:** Conferi cada menção: setView, restoreView, ensureView, a linha view e a chave view: não existem no código. O doc avisa 1 500 linhas abaixo que viraram histórico, então foi deixado assim de propósito, mas a seção 'Como é hoje' continua dizendo o contrário; sem efeito no painel.

### Mudança de vários arquivos por git (troca de branch, pull, rebase) no clone carregado não está nas regras de recarga
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - CLAUDE.md:141-143 — o que a doc garante: estado que não compila mostra 'reload failed' e a versão anterior segue carregada
  - task-tree/DESENVOLVIMENTO.md:1103-1104 — 'a recarga depois de uma edição pode atrasar'; nada no repositório diz se o app agrupa as mudanças de arquivo
  - scripts/testes.mjs:23, 79-80 — confirmado: o check manual roda o validate sobre task-tree/ do clone, que grava .claude-plugin/types/ ali
  - o clone carregado está hoje em feat/ultracode-no-cartao — trocas de branch nele acontecem de fato
- **Regra do catálogo:** visual.recarga-real-e-respawn (checklist)
- **Cenário:** Com o app aberto e o mod carregado do clone, uma sessão troca de branch, faz pull ou rebase. O git reescreve vários arquivos de task-tree/ um a um. Cada sessão aberta recarrega no meio da troca: ou aparece 'reload failed', ou carrega uma mistura de arquivos de duas versões (por exemplo register.tsx novo com panel.ts antigo) que compila mas grava estado e arquivo publicado em formatos diferentes. O código não mostra se o app agrupa as mudanças antes de recarregar, por isso é suspeita. O mesmo vale para o npm run check manual, que grava os tipos gerados dentro da pasta carregada.
- **Proposta:** Acrescentar ao CLAUDE.md, em 'Editar o mod sem quebrar a recarga', o caso do git: operações que reescrevem task-tree/ (checkout, pull, merge, rebase, stash) só com as sessões paradas, ou feitas num segundo clone/worktree e levadas ao clone carregado de uma vez. Registrar no checklist do app a conferência depois de uma troca de branch, e confirmar no app se gravar .claude-plugin/types/ dispara recarga.
- **Ajuste da verificação à proposta:** Depois da operação do git, o último arquivo escrito dispara uma recarga com o conjunto final, então a mistura de versões, se existir, é passageira. A regra pode ser mais leve que 'só com as sessões paradas': depois de checkout, pull ou rebase, confirmar a versão carregada (o marcador que o DESENVOLVIMENTO já ensina) antes de seguir. Confirmar no app, antes de escrever a regra, se há 'reload failed' ou estado misto numa troca de branch e se gravar os tipos gerados recarrega o mod.
- **Pergunta ao usuário:** Quer que a troca de branch e o pull no clone carregado virem regra escrita (só com as sessões paradas)? Recomendo que sim.
- **Verificação:** O fluxo não está escrito em lugar nenhum e as evidências conferem, mas o dano depende de como o app observa os arquivos, que o código do mod não mostra. Continua suspeita.

### Documentação e comentários ainda descrevem o replano 'do zero', a tarefa de mensagem mantida (kept) e o descarte de envios, que o código não faz mais
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:1142-1145` — 'replanejar um nível 1 aberto com o mesmo id o substitui do zero no mesmo lugar', citando um texto das RULES que não existe mais.
  - `task-tree/DESENVOLVIMENTO.md:100, 485-486 e 1528` — Dizem que o plan 'tira os sends do que foi replanejado' e que o replano da tarefa de envio apaga o envio; o código só tira envios já entregues cuja âncora sumiu.
  - `task-tree/hooks/tools.ts:64, 106-109 e 169-171` — Comentários falam em tarefa de mensagem que 'fica' (carry) e em 'drops both (a replanned task)'; o filtro da linha 109 mantém todo envio não entregue.
  - `task-tree/state/tasks.ts:112-115 e 133-137` — O cabeçalho de carry promete manter a tarefa de mensagem marcada kept; o corpo descarta queued, parentOf e ids com void e diz que ela não é mantida.
  - `task-tree/types/index.d.ts:27-28` — O campo kept continua documentado, mas nada mais o grava.
  - `task-tree/draw/layout.ts:999-1000` — Ramo de desenho para t.kept que nunca é alcançado.
- **Regra do catálogo:** pedidos.replano-mantem-envio-ate-entrega
- **Cenário:** Quem analisa ou implementa a partir do DESENVOLVIMENTO.md ou dos comentários conclui que o replano zera o estado e apaga envios, ou que a tarefa de mensagem é mantida; as três coisas foram desfeitas por decisões de 2026-10-27 e 2026-10-30. Sem efeito no painel hoje, mas induz análise errada do mesmo fluxo que está sendo corrigido.
- **Proposta:** Atualizar os trechos citados do DESENVOLVIMENTO.md e os comentários; remover de carry os parâmetros e auxiliares mortos (queued, parentOf, ids), o campo kept do tipo e o ramo da linha 1000 do layout, tudo num passo só para não quebrar a recarga.

### Restos da medida antiga da taxa: `live` sempre true, mas o desenho ainda esmaece e escreve "(último turno)"; tipos e tabela descrevem a média que não existe mais
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/turn.ts:101-104` — a taxa é sempre gravada com live: true e nunca muda no fim do turno
  - `task-tree/draw/svg.ts:401, 702, 731` — opacidade .45 e "(último turno)" quando live é false
  - `task-tree/hooks/render.tsx:303` — o alt do cabeçalho ainda tem o ramo "(último turno)"
  - `task-tree/types/index.d.ts:92-94, 119-122` — Rate e Published.rate descritos como média dos últimos ~10 s e média do último turno
  - `task-tree/state/durability.ts:69, 97` — nota de `rate` fala em "last turn's mean"; a linha `samples` descreve uma variável de módulo que não existe mais no código
  - `regras/taxa.md:27-35` — "sem esmaecer e sem '(último turno)'"
- **Regra do catálogo:** taxa.fim-do-turno-fica-aceso
- **Cenário:** Uma filha que ainda roda uma versão anterior do mod (ou um arquivo publicado antigo) traz rate.live=false: o cartão dela aparece esmaecido e com "(último turno)" no alt, o que a regra atual proíbe. Para quem lê o código, tipos e tabela descrevem outra medida.
- **Proposta:** Tirar o ramo live=false do desenho e do alt (ou normalizar live=true em parsePublished), atualizar os comentários de Rate/Published.rate e a nota de `rate` na tabela, e remover a linha `samples`. Um teste com filha publicando live:false fecha a regra.

### Golden: o código, o teste e os selos têm 4 cenários; CLAUDE.md, o cenário do catálogo e o cabeçalho do script dizem 3
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/golden.mjs:1, 18` — comentário 'o desenho de 3 cenários'; CENARIOS = ['principal', 'filha', 'envios', 'subagente']
  - `task-tree/tests/golden.test.ts:7, 96-97` — 'O desenho do app desktop em 4 cenários'; teste 'golden: subagente'
  - `regras/visual.md:145-154` — visual.golden-gera-desenho: 'Dado os 3 cenários do golden (principal, filha trabalhando, envios)', citado pelos 4 testes
  - `CLAUDE.md:125` — 'O desenho do app desktop em 3 cenários (principal, filha trabalhando, envios; 60 colunas)'
  - `regras/selos.json:1686-1705` — quatro selos de golden
  - `CLAUDE.md:125` — "O desenho do app desktop em 3 cenários (principal, filha trabalhando, envios; 60 colunas)"
- **Regra do catálogo:** visual.golden-gera-desenho — Os cenários do golden geram o desenho do app desktop.
- **Cenário:** Quem segue o CLAUDE.md para aprovar o golden depois de mexer no cartão de subagente não sabe que existe o cenário 'subagente' (npm run golden:aprovar -- principal filha envios deixa o quarto de fora e o check continua falhando). O cenário visual.golden-gera-desenho, 'coberto', descreve um conjunto que não é o que os testes rodam.
- **Proposta:** Atualizar CLAUDE.md, o comentário do golden.mjs e o Dado de visual.golden-gera-desenho para os 4 cenários (ou escrever 'os cenários de CENARIOS' sem número). O cenário do catálogo muda só de texto: Reescrito com 'sem mudança de regra'.

### Documentação e comentários do ciclo do turno descrevem funções e arquivos que não existem mais
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:95` — a tabela de hooks diz que session.start chama restoreView; o código chama restoreWork, restoreTurn e restoreLinks (session-start.ts 56-61); setView/restoreView/ensureView também aparecem nas linhas 28, 115, 207, 251-253
  - `task-tree/DESENVOLVIMENTO.md:97` — diz que o wake só acontece no pedido da pessoa e no de outra sessão; o código o faz em todo prompt (prompt-submit.ts 56)
  - `task-tree/text/rules.ts:5-7` — cita tests/textos.test.ts e tests/golden/textos.ts, que não existem (tests/golden só tem svg.ts): os textos ao modelo não têm trava
  - `task-tree/state/durability.ts:69-97` — a linha 'rate' fala em "the last turn's mean" e a linha 'samples' descreve uma variável de módulo que turn.ts não tem mais
  - `task-tree/hooks/panel.ts:59` — comentário cita ensureView
- **Regra do catálogo:** sem cenário
- **Cenário:** Quem analisa uma mudança no ciclo do turno pela doc conclui que um aviso do app não reacende o painel, que session.start restaura uma visão e que os lembretes ao modelo têm golden. As três coisas são falsas no disco, e a análise (obrigatória antes de toda mudança) parte de premissa errada.
- **Proposta:** Atualizar o DESENVOLVIMENTO (tabela de hooks: restoreTurn/clearTurn, wake em todo prompt; tirar a visão), o cabeçalho de text/rules.ts, as linhas 'rate' e 'samples' da tabela de durabilidade e o comentário de panel.ts. Decidir se os textos ao modelo ganham golden: os achados sobre lembretes mostram que eles mudam comportamento sem trava.

### Pendências e instruções da primeira metade nunca fechadas: clique "falta conferir", medidas sem bancada, "não vinga" × "lança", `validate` sem `--strict`
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:192-193` — "Falta conferir no app se o clique pega de primeira." (correção do relógio duplicado), sem fechamento.
  - `task-tree/DESENVOLVIMENTO.md:569-571` — As medidas são "de uma bancada de medição que não está mais no repositório" e "Nenhum número deve ser alterado sem remedir": não há como remedir.
  - `task-tree/DESENVOLVIMENTO.md:608, 689-690` — Limite 5: "Um `$.state.set` de dentro do `ui.render` não vinga"; no histórico: "`$.state.set` lá dentro lança".
  - `task-tree/hooks/panel.ts:407-411` — O `ensureGroups` trata os dois casos: `try/catch` em volta do `set` e `loaded` só marcado se a escrita passou.
  - `task-tree/DESENVOLVIMENTO.md:663-670` — "Validar" (histórico) manda rodar `claude plugin validate .` e `claude plugin validate task-tree` sem `--strict`.
  - `CLAUDE.md:36-38` — O check roda os dois `validate` com `--strict`.
- **Regra do catálogo:** visual.cliques-no-icone-e-no-anel (checklist)
- **Cenário:** Quem edita o render não sabe se uma escrita de state ali falha em silêncio ou lança (o tratamento é diferente). Quem valida pelo trecho do histórico roda sem `--strict` e deixa passar o que o check barra. A pendência do clique e as metas de desempenho ficam abertas sem dono, e o código do hook genérico sugere que ele pode rodar para as ferramentas do painel, o contrário do que o documento afirma.
- **Proposta:** Fechar ou apagar cada pendência: marcar o clique como validado (ou levá-lo ao checklist do app no catálogo); dizer que as medidas de desempenho são só registro; unificar o limite 5 com o comportamento real; apontar o "Validar" do histórico para o CLAUDE.md; e decidir se os ramos `mcp__task-tree__` do hook genérico são defesa (comentar) ou código morto (tirar).

### CLAUDE.md com cinco afirmações que o repositório já não sustenta
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `CLAUDE.md:158` — O checklist do app ainda manda validar 'tooltip'.
  - `regras/visual.md:27-37` — visual.tooltip: texto cortado não tem tooltip, reescrito em 2026-11-09 e coberto por teste.
  - `CLAUDE.md:125-126` — '3 cenários (principal, filha trabalhando, envios; 60 colunas)'.
  - `scripts/golden.mjs:1-2, 18` — O cabeçalho diz 3 cenários, mas CENARIOS tem 4 (principal, filha, envios, subagente).
  - `task-tree/tests/golden.test.ts:7, 96-97` — '4 cenários', com o teste 'golden: subagente'.
  - `CLAUDE.md:23-28` — '5 s por teste', leitura 'pela superfície terminal' e 'não simula a recarga a quente'.
- **Regra do catálogo:** visual.tooltip (Texto cortado não tem tooltip)
- **Cenário:** Uma sessão segue o CLAUDE.md ao relatar o que o usuário deve validar no app e pede para conferir o tooltip, que foi removido. Outra aprova o golden com --todos achando que são 3 cenários. Outra evita escrever teste de recarga ou de mais de 5 s por acreditar que o harness não permite.
- **Proposta:** No CLAUDE.md: tirar 'tooltip' do checklist; trocar para 4 cenários, com 'subagente'; dizer que o limite padrão é 5 s e pode subir por teste com timeoutMs; dizer que a recarga é emulada em duas metades (estado capturado e semeado) e que só a recarga real fica no checklist; dizer que o golden lê a superfície desktop. Corrigir também o cabeçalho de scripts/golden.mjs.

### README e as descrições do plugin dizem que o painel colapsa as concluídas, contra a decisão de não colapsar nada sozinho
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `README.md:3` — 'marcando as tarefas em andamento e colapsando as concluídas'.
  - `task-tree/.claude-plugin/plugin.json:4` — description: '... marcando e colapsando as concluídas'.
  - `.claude-plugin/marketplace.json:8` — A mesma descrição no marketplace.
  - `task-tree/DESENVOLVIMENTO.md:952-956` — Decisão do usuário: 'quando você finalizar as tarefas, não colapse os itens, se eu quiser, eu mesmo colapso'.
  - `task-tree/draw/layout.ts:979, 1068, 1104` — Linhas de tarefa e de pedido abrem por padrão (opened(key, true)), concluídas inclusive.
  - `README.md:5, 76-82` — Cita só as três ferramentas; não fala do comando /task-tree, de que sessões filhas e cartões só existem no app desktop, nem da versão mínima do Claude Code.
- **Regra do catálogo:** sem cenário
- **Cenário:** Quem instala pelo marketplace lê que as concluídas colapsam e vê tudo aberto no painel; quem tem o painel sem aparecer não acha no README o /task-tree, que é o diagnóstico previsto.
- **Proposta:** Trocar a descrição nos três arquivos por algo como 'árvore de tarefas da sessão (até 3 níveis), com sessões filhas e subagentes; recolhe pelo clique'. Acrescentar ao README o /task-tree, o que depende do app desktop e a versão mínima do Claude Code testada.

### Parte histórica do DESENVOLVIMENTO.md mistura regras vigentes e desfeitas sem marcação, e duas afirmações do retrato atual estão erradas
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/DESENVOLVIMENTO.md:872-875` — 'view e work continuam só no session.start, de propósito'.
  - `task-tree/hooks/panel.ts:416-442` — ensureWork traz o trabalho do store no primeiro uso, sem session.start; a visão não existe mais.
  - `task-tree/DESENVOLVIMENTO.md:965-966` — 'O tom section do desenho ficou sem uso'.
  - `task-tree/draw/layout.ts:660, 674, 1352-1356` — O tom section é usado nas linhas '+N linhas anteriores', '+N linhas' e '+N pedidos anteriores'.
  - `task-tree/DESENVOLVIMENTO.md:894-899` — Cabeçalho de 44/48/70 px e largura clamp(240, bodyColumns * 8 - 8, 900).
  - `task-tree/draw/geometry.ts:23-28, 84` — COL_PX 7,2, MIN_W 240, MAX_W 1400 e HEADER_H 125.
- **Regra do catálogo:** visual.cartao-modelo-e-esforco (O cartão da filha mostra o modelo e o esforço dela)
- **Cenário:** Quem procura como o trabalho atual volta depois de um respawn lê que 'work' só volta no session.start e conclui que há um bug a corrigir; quem procura o limite de largura acha 900 px; quem quer testar o modelo publicado no turn.step lê que o kit não reproduz o evento e manda o caso para o checklist do app. A nota do topo avisa que a parte é histórica, mas vários trechos foram emendados no lugar com 'regra substituída', o que faz o resto parecer vigente.
- **Proposta:** Corrigir as duas afirmações do retrato atual (linha 626 e a lista 'O que só é verificável no app'). Na parte histórica, ou parar de emendar e marcar cada bloco com a data e 'substituído por <seção ou cenário>', ou enxugar para as decisões e remeter o comportamento ao catálogo. Com o turn.step testável, avaliar um cenário coberto para a publicação do modelo e esforço da sessão (hooks/turn.ts 75-80), hoje sem teste.

### Comentários de código ainda descrevem tooltip, botões de visão e recuo do resumo que saíram
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/render.tsx:57-64, 220, 273` — 'the header's Svg (its tooltip layer, the view toggle)', 'the tooltip layer over a cut name', 'for the header's tooltip'.
  - `task-tree/hooks/panel.ts:572-582` — Comentário sobre o clique em ▾/▸, a regra goingOn e 'like the view', todos desfeitos.
  - `task-tree/hooks/sessions.ts:31` — 'by the 10 s poll', com POLL = 3000 (linha 249).
  - `task-tree/draw/layout.ts:803, 869-871` — 'The whole text for the tooltip' e a descrição do marcador 'resposta', que o desenho não usa mais.
  - `scripts/testes.mjs:49-58, 71-72` — Função e comentário do modo paralelo ('junto') que nenhuma etapa usa; o CLAUDE.md diz que roda em série.
- **Regra do catálogo:** sem cenário
- **Cenário:** Como o DESENVOLVIMENTO.md está defasado, o comentário de cabeçalho de cada arquivo é a documentação mais lida. Uma sessão que lê render.tsx procura a camada de tooltip e os botões de visão para mexer neles, ou conclui pelo comentário de panel.ts que o trabalho anterior sai quando tudo fecha (regra antiga).
- **Proposta:** Uma passada só de comentários, num commit próprio e sem mudar código: render.tsx, panel.ts, sessions.ts, layout.ts, turn.ts, rules.ts e scripts/testes.mjs (tirando também rodarJunto, que está morto).

### 'Copie tudo junto' não garante uma recarga só: a regra depende de um comportamento do observador que ninguém mediu
- **Categoria:** ambiguidade · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `CLAUDE.md:139-148` — 'Mudança em vários arquivos vai de uma vez: escreva numa cópia no scratchpad e copie tudo junto'.
  - `task-tree/DESENVOLVIMENTO.md:606-611` — O engine recusa o módulo que não valida e segue com a versão anterior; 'a recarga depois de uma edição pode atrasar'.
- **Regra do catálogo:** sem cenário
- **Cenário:** Uma cópia de três arquivos são três gravações; se o observador recarrega a cada arquivo (não há espera documentada), as sessões abertas podem carregar por um instante a mistura de arquivos novos e velhos: se não compila, aparece 'reload failed'; se compila, um módulo misto roda hooks e grava state em todas as sessões. O mesmo vale para git pull, merge ou troca de branch no clone, que a regra não menciona.
- **Proposta:** Medir quantas recargas uma cópia de vários arquivos provoca (um contador no log de debug). Conforme o resultado: manter a regra dizendo o que foi medido, ou adotar uma das saídas já levantadas na análise anterior (pasta de entrega copiada depois do check, ou desligar a observação) e citar git pull/checkout na seção.
- **Pergunta ao usuário:** A análise de 'SVG e recarga' deixou em aberto como o mod é carregado no dia a dia (cópia de entrega depois do check, desligar a observação, ou como está). Qual delas vale? Recomendo a cópia de entrega; antes, conferir se o store segue o mesmo arquivo quando a pasta muda (hoje há um store para a instalação do marketplace e outro para a pasta do clone).

### A política para quando um hook falha não está definida nem documentada: nenhum registro usa .catch, e a recusa da pergunta sem tarefa falha aberta
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/register.tsx:17-35` — Nenhum on(...) leva .catch.
  - `task-tree/hooks/tool-call.ts:49-60, 206-214` — A recusa ({ deny: ASK.refused }) vem depois de wake, subTool e launch, sem try: se um deles lança, o hook é pulado e a pergunta abre.
  - `task-tree/.claude-plugin/types/claude-code/index.d.ts:4204-4208, 4222-4225, 10196-10215, 5411-5426` — O kit diz: hook que falha é pulado ("a guard fails open unless its registration carries a .catch"), o validate lista cada hook que barra com ou sem .catch, e cada hook tem 10 s de tempo próprio.
  - `task-tree/DESENVOLVIMENTO.md:594-600, 1100-1109` — "Limites do kit" e as notas de comportamento não dizem o que o host faz quando um hook lança ou estoura o tempo, nem os limites de 4 MiB do store e do fs; a resposta só está nos tipos gerados, que o git ignora.
- **Regra do catálogo:** perguntas.sem-tarefa-recusada
- **Cenário:** Quem altera o mod não encontra na documentação se um erro num hook bloqueia a ferramenta do modelo (não bloqueia: o host pula o hook e a ferramenta roda), nem qual é a escolha do mod para a recusa da pergunta quando o próprio hook falha. Hoje a escolha é implícita: falha aberta em tudo.
- **Proposta:** Acrescentar ao DESENVOLVIMENTO.md uma seção "Falhas": o que o host faz (pula o hook, vale o último resultado de next, 10 s de tempo próprio, store e fs com 4 MiB, recarga cancela os timers), a política do mod por hook e a regra de usar o auxiliar único. Registrar a decisão sobre a recusa no catálogo.
- **Pergunta ao usuário:** Quando o hook da pergunta falha por erro interno do mod, a pergunta sem tarefa aberta deve passar (como hoje) ou ser recusada (com .catch no registro)? Recomendo deixar passar e registrar no log: recusar por causa de um erro do painel travaria o modelo por um defeito que não é dele.

### DESENVOLVIMENTO não descreve o cartão de subagente nem como o mod lida com escritas concorrentes
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `task-tree/hooks/register.tsx:17-35` — 17 registros de hook, entre eles agent.spawn e dois prompt.attachment.
  - `task-tree/DESENVOLVIMENTO.md:22-48, 89-108` — "Os 14 hooks" e a lista de módulos não citam hooks/agents.ts, agent.spawn nem os anexos do ultracode.
  - `task-tree/DESENVOLVIMENTO.md:214-232` — A tabela ainda traz `view`, diz que `turnEnded` vive só no state e não tem `turnAborted`, `ultracode`, `rate` nem `git`.
  - `task-tree/state/durability.ts:48-81` — A tabela do código: `turnEnded` e `turnAborted` em state+store, sem `view`, com `ultracode`, `rate` e `git`.
  - `task-tree/.claude-plugin/types/claude-code/index.d.ts:3588-3596` — O kit diz que todo `get` de um mesmo dispatch lê um só momento; o documento não diz como o código conta com isso nem quais escritas usam `update` e quais get seguido de set.
- **Regra do catálogo:** sem cenário
- **Cenário:** Quem mexe em hooks/agents.ts ou acrescenta uma escrita de state não acha no documento a regra de quando usar `update`, nem que hooks de chamadas paralelas, o poll e os relógios correm intercalados. Os defeitos de leitura velha (lote de subagentes, `children`, índices dos envios) vêm dessa lacuna.
- **Proposta:** Acrescentar a "Como é hoje" uma seção de concorrência (o que corre intercalado, toda leitura-modificação-escrita por `update`, uma execução por vez no poll e na publicação) e a descrição de hooks/agents.ts; alinhar a tabela de durabilidade do documento com `TABLE`.

## Scripts, travas e CI

12 achados: 0 de severidade alta, 2 média, 10 baixa.

### A etapa selos não compara o selos.json com o de HEAD: editar o arquivo à mão passa em todo o check
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - scripts/selos.mjs:174-204 — confirmado: o selos.json de HEAD só entra na conta de asserções
  - scripts/selos.mjs:191-195 — essa conta usa o número gravado no próprio selos.json (s.assercoes), não o contado no teste: um selo editado à mão escapa dela também
  - task-tree/tests/golden.test.ts:25-26 — confirmado: sem o cenário aprovado o teste volta sem comparar
  - scripts/golden.mjs:18 — há 4 cenários (principal, filha, envios, subagente), todos aprovados em svg.ts; o CLAUDE.md:125 ainda fala em 3
  - regras/README.md:76 — 'Selar é um passo explícito, que aparece no diff de selos.json': a defesa prevista hoje é a leitura do diff
- **Regra do catálogo:** sem cenário
- **Cenário:** (1) Apaga-se um teste selado e a entrada dele no selos.json no editor: 'selos' passa (a chave não está mais no arquivo), 'regras' passa se outra citação cobre a regra (ou o estado vira checklist), 'regressao' passa (o teste de HEAD segue verde contra o código). (2) Troca-se à mão hash e "tipo": "decisao" de um teste alterado: conferir não revalida o Reescrito nem a queda de asserções (só refatoracao/novo). (3) Apaga-se um cenário de tests/golden/svg.ts e o selo dele: o teste de golden vira 'só há desenho'. Nos três casos o comportamento protegido deixa de ser protegido sem erro.
- **Proposta:** Em conferir, comparar com head: chave de HEAD ausente exige um registro de remoção (ex.: selos.removidos[chave] com tipo decisao e Reescrito >= data do selo de HEAD); hash diferente do de HEAD com tipo 'novo' é erro; com tipo 'decisao' revalida exigirReescrito contra a data do selo de HEAD; golden: todo cenário de CENARIOS (scripts/golden.mjs) e todo cenário de HEAD precisa existir em svg.ts e no selo. Acrescentar os três casos às travas.
- **Ajuste da verificação à proposta:** Os três casos exigem editar selos.json ou svg.ts à mão, o que hoje só a convenção impede. A comparação com HEAD precisa do mesmo registro de remoção pedido para a remoção por decisão (outro achado relacionado desta área): desenhar os dois juntos. Somar: comparar com a contagem de asserções lida do teste, não com a gravada no selo; e exigir em svg.ts todos os cenários de scripts/golden.mjs (os 4 já estão aprovados).
- **Verificação:** Segui conferir caso a caso: chave apagada do arquivo deixa de ser procurada, tipo trocado para decisão não é revalidado contra o Reescrito, e cenário de golden apagado com o selo não gera problema. As exigências existem só nos comandos, não na conferência.

### Regra de versão do release: `BREAKING CHANGE` em qualquer ponto do corpo do PR sobe a major, e título fora do formato vira patch sem aviso
- **Categoria:** omissão · **Severidade:** média · **Situação:** confirmado na verificação
- **Evidência:**
  - .github/workflows/release.yml:43-49 — confirmado: 'BREAKING CHANGE' em qualquer ponto do corpo dá major; minor só com 'feat:' ou 'feat(escopo):' em minúsculas; o resto é patch
  - .github/workflows/release.yml:29-31 e CLAUDE.md:165-166 — a regra do corpo está documentada como o código faz ('BREAKING CHANGE no corpo → major'); a diferença para o texto é só o 'feat…' mais largo que o regex
  - .github/workflows/release.yml:3-6, 34-36 — o workflow roda no PR já fechado e lê título e corpo do evento
  - .github/workflows/test.yml:6-9 — não há workflow ativo em PR aberto que pudesse validar o título antes do merge
- **Regra do catálogo:** sem cenário
- **Cenário:** (1) Um PR que mexe no release.yml ou na seção 'Release e PR' descreve a regra no corpo ('`BREAKING CHANGE` no corpo sobe a major'), ou escreve 'sem BREAKING CHANGE': no merge, o grep acha a sequência e o plugin vai de 0.13.x para 1.0.0, com commit na main, tag e release publicados. A descrição do PR é atualizada a cada push por regra global, o que aumenta a chance. (2) Um PR com título 'Feat: …', 'feat add …' ou 'feature: …' deveria ser minor pelo texto do CLAUDE.md (`feat…`) e sai como patch, em silêncio. Em nenhum dos casos há validação do título antes do merge.
- **Proposta:** No release.yml: detectar a quebra só no rodapé do Conventional Commits (`grep -Eq '^BREAKING[ -]CHANGE: '`, no começo da linha); validar o título contra `^(feat|fix|docs|test|chore|refactor|ci|perf|build|revert)(\([^)]*\))?!?: ` e falhar com `::error::` (sem gravar versão) quando não casar. Alinhar o texto do CLAUDE.md ao regex (`feat:` ou `feat(escopo):`).
- **Ajuste da verificação à proposta:** Restringir a quebra ao rodapé muda uma regra documentada: entra na pergunta ao usuário junto com a do título. Falhar no release e 'reexecutar depois de corrigir o título' não funciona como descrito: a reexecução de um workflow usa o mesmo evento, com o título antigo; seria preciso ler o título na hora (gh pr view) ou validar o título antes do merge, num workflow de PR aberto, que hoje está desligado por escolha do usuário (CLAUDE.md:117-119). E quando o release falha o PR já está na main sem versão nova: a proposta precisa dizer como se recupera.
- **Pergunta ao usuário:** Título de PR fora do formato Conventional Commits deve bloquear o release (recomendado: sim, falhar com erro claro e permitir reexecutar depois de corrigir o título) ou continuar virando patch?
- **Verificação:** Li o release.yml: o grep do corpo não tem âncora e o título fora do formato cai em patch sem aviso, com commit na main, tag e release em seguida. O comportamento do corpo é o documentado, mas uma descrição que apenas cite a expressão sobe a major, e nada confere o título antes do merge.

### A regressão não confere se todos os testes de HEAD rodaram: o que não aparece na saída conta como aprovado
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita (a verificação não fechou o caso)
- **Evidência:**
  - task-tree/tests/*.test.ts e tests/kit — nenhum arquivo de teste importa do mod (só ./kit, ./fixtures, ./golden e claude-code/testing): renomear um export do mod não impede um arquivo de teste de HEAD de carregar; o exemplo do achado não acontece
  - scripts/testes.mjs:84-86 — a etapa plugin test roda antes e bloqueia: se o mod novo não carrega, o check para antes da regressão
  - scripts/regressao.mjs:76-79 — sem nenhuma falha listada, saída diferente de 0 já vira 'saída irreconhecível'; a brecha só existe junto com uma falha liberada por decisão
  - scripts/regressao.mjs:64-75, 98 — confirmado: o resumo conta só o que apareceu na saída, sem comparar com os testes de HEAD
- **Regra do catálogo:** sem cenário
- **Cenário:** Um commit traz uma decisão registrada (um teste de HEAD falha e é liberado pelo selo de hoje) e, no mesmo commit, renomeia um export do mod que outro arquivo de teste de HEAD importa. Se o harness relatar o arquivo que não carrega (ou o que estoura o tempo, ou o processo que cai) sem linhas `(fail) <nome>`, a regressão vê uma falha, liberada, e responde 'todas por decisão registrada', mesmo com dezenas de testes de HEAD sem rodar. Depende de como o `claude plugin test` relata arquivo que não carrega, o que o script não mostra.
- **Proposta:** Em scripts/regressao.mjs, cruzar `resultados` com as chaves de `head.testes` (os selos de HEAD ou da base): todo teste selado em HEAD tem de aparecer como `pass`, ou como `fail` liberado; chave ausente vira falha ('teste de HEAD não rodou'). Com isso o exit != 0 sem explicação também deixa de passar.
- **Ajuste da verificação à proposta:** Trocar o exemplo: o que pode sumir da saída é um arquivo de teste de HEAD cujo processo cai ou que o harness não relata por nome (estouro de tempo), não um import quebrado. A proposta é barata e vale: cruzar os resultados com as chaves de teste do selos.json do commit de comparação e falhar com 'teste de HEAD não rodou'.
- **Verificação:** O script de fato não confere se todos os testes de HEAD rodaram, mas o cenário descrito não se sustenta pelo código, e o restante depende de como o claude plugin test relata um arquivo que cai, que o repositório não mostra. Além disso precisa coincidir com uma falha liberada no mesmo commit.

### Selos autodeclarados: "refatoracao" não prova que o teste afirma o mesmo, e 3 dos 4 desenhos do golden foram aprovados com "faça push e crie o pr"
- **Categoria:** indefinição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/selos.mjs:254-257` — refatoracao: a única condição é não ter menos asserções contadas que o selo anterior
  - `scripts/regressao.mjs:50-58` — só roda testes antigos contra código novo; o teste novo contra o código antigo nunca roda
  - `scripts/selos.mjs:149-150` — motivoValido aceita qualquer texto entre aspas com uma data
  - `regras/selos.json:1686-1705` — envios, filha e principal: motivo '"faça push e crie o pr", 2026-11-09'; só subagente tem '"Funcionou"'
  - `CLAUDE.md:123-125` — seção Golden do SVG: o aceite é a validação do painel no app, com as palavras dele
  - `regras/selos.json:1686-1706` — principal, filha e envios: motivo "faça push e crie o pr", 2026-11-09; só subagente tem "Funcionou"
- **Regra do catálogo:** visual.desenho-principal — O desenho do painel principal é o validado no app.
- **Cenário:** Troca-se num teste esperarEstado(p, 'Pai', 'aguardando') por 'concluida' junto com a mudança de código e sela-se como refatoracao: mesmo número de asserções, passa. O teste antigo falharia na regressão, mas só se o comportamento antigo ainda estivesse coberto por ele no HEAD com outro valor; para asserções trocadas por outras mais fracas (toContain no lugar de toBe, um título a menos) nada acusa. No golden, a frase gravada como aprovação de três desenhos é a liberação do push, não a validação visual que o CLAUDE.md exige.
- **Proposta:** Para selo refatoracao, rodar o teste novo contra o código de HEAD (pasta temporária, como a regressão, invertida) e exigir verde: prova que a forma mudou e a afirmação não. Para o golden, definir o que conta como validação (ex.: o motivo cita o que foi visto, ou a pergunta feita ao usuário e a resposta) e registrar isso no CLAUDE.md.
- **Pergunta ao usuário:** 'faça push e crie o pr' vale como validação do desenho no app para aprovar o golden, ou a aprovação precisa de uma frase sua sobre o desenho (como 'Funcionou')? Recomendo exigir a frase sobre o desenho.

### Versão do binário: o check usa a pasta mais nova do app (há 2.1.317 e 2.1.321), a CI e o CLAUDE.md estão em 2.1.308, e nada compara as três
- **Categoria:** contradição · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/binario.mjs:13-26` — CLAUDE_BIN, senão o claude.exe da pasta de versão mais alta em %APPDATA%\Claude\claude-code, senão `claude` do PATH
  - `CLAUDE.md:66-67, 113-115` — 'Use a mesma versão que roda a sessão'; a CI fixa `CLAUDE_CODE_VERSION`, 'hoje 2.1.308; subir junto com o app'
  - `.github/workflows/test.yml:23-26, 40-44` — CLAUDE_CODE_VERSION: 2.1.308, instalado do npm
  - `scripts/testes.mjs:58-64` — o check só imprime a versão encontrada; não avisa diferença
  - `.github/workflows/test.yml:24-26` — CLAUDE_CODE_VERSION: 2.1.308, com o comentário 'a mesma versão do app; subir junto com o app'.
  - `CLAUDE.md:113-114` — 'fixado na versão do app (CLAUDE_CODE_VERSION, hoje 2.1.308; subir junto com o app)'.
- **Regra do catálogo:** sem cenário
- **Cenário:** Nesta máquina existem as pastas 2.1.317 e 2.1.321. O hook e o `npm run check` usam a 2.1.321, mesmo que a sessão que carrega o mod ainda rode a 2.1.317 (o app baixa a versão nova e mantém a antiga até reiniciar); os tipos gerados e o kit de teste são os da versão nova. Se a pasta mais nova estiver incompleta, o check para com 'Binário do Claude Code não encontrado' e não tenta a anterior, bloqueando todo commit. Quando a CI for ligada, ela roda 13 versões atrás do que valida localmente. Fora do Windows (sem APPDATA) o script cai no `claude` do PATH, caminho que o CLAUDE.md não descreve.
- **Proposta:** Guardar a versão fixada num arquivo único (ex.: `.claude-code-version`), lido pelo test.yml e por scripts/testes.mjs, que avisa quando a versão encontrada difere. Em scripts/binario.mjs, se o `--version` da pasta mais nova falhar, tentar a anterior. Atualizar o 'hoje 2.1.308' do CLAUDE.md ou trocá-lo pela referência ao arquivo.

### Checklists do visual sem linha "Código:": a matriz de impacto não os lista quando o arquivo que os implementa muda
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `regras/visual.md:5, 83-131` — a área só mapeia draw/svg.ts e draw/geometry.ts; esses quatro cenários não têm linha Código
  - `scripts/impacto.mjs:26-43` — o checklist listado é o dos cenários cujo código inclui um arquivo tocado (ou todos, se o núcleo foi tocado); draw/layout.ts, hooks/panel.ts e hooks/sessions.ts não são núcleo
  - `task-tree/draw/layout.ts:288-296, 398-402` — a ordem dos cartões (inOrder) e a espera de 10 s da origem (WAIT_ORIGIN) de visual.cartoes-ordem-e-espera vivem em layout.ts
  - `task-tree/hooks/panel.ts:327-338` — o status de visual.status-embaixo-da-caixa vive em panel.ts
  - `regras/cabecalho.md:27, 39` — no sentido contrário, dois cenários citam hooks/command.ts, que não troca mais de visão
- **Regra do catálogo:** visual.cartoes-ordem-e-espera, visual.status-embaixo-da-caixa, visual.recarga-real-e-respawn, visual.cartao-modelo-e-esforco
- **Cenário:** Uma mudança em inOrder/split (layout.ts) ou em showStatus (panel.ts): 'npm run impacto' não lista visual.cartoes-ordem-e-espera nem visual.status-embaixo-da-caixa no "Checklist do app", e o brief e o relato deixam de pedir ao usuário a validação que só o app dá.
- **Proposta:** Acrescentar as linhas Código: visual.cartoes-ordem-e-espera → draw/layout.ts; visual.status-embaixo-da-caixa → hooks/panel.ts; visual.recarga-real-e-respawn → hooks/sessions.ts, hooks/panel.ts, state/durability.ts; visual.cartao-modelo-e-esforco e visual.cartao-posicao-de-toks-e-repo → draw/layout.ts, io/host.ts; cabecalho.aviso-de-painel-grande-volta → hooks/panel.ts. Tirar hooks/command.ts dos cenários do cabeçalho.

### regras.mjs não confere a Origem, o prefixo do id nem um "Código da área:" fora do topo
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/regras.mjs:13-19` — as únicas linhas lidas são o id, Estado, Código da área, Código e Regra; não há regex de Origem nem de Reescrito
  - `scripts/regras.mjs:56-85` — 'Código da área:' depois do primeiro cenário cai fora de todos os ifs (a && !atual) e é ignorado em silêncio; o prefixo do id não é comparado com o nome do arquivo; 'Estado: pendente' passa sem o arquivo entre parênteses
  - `regras/cabecalho.md:37` — origem de decisão do usuário sem data
  - `regras/visual.md:100, 140` — 'Origem: regra do painel.' sem commit nem data
  - `regras/turnos.md:86` — decisão do usuário sem data
  - `regras/README.md:20-28` — o formato exige data, palavras quando houver, commit, e 'pendente (<arquivo de teste>)'
- **Regra do catálogo:** sem cenário
- **Cenário:** Passei o catálogo por uma leitura própria: 137 cenários, todos com Origem, Dado/Quando/Então e Estado; mas 7 origens não têm data (cabecalho.resumida-limpa-so-com-tudo-concluido, durabilidade.clear-esvazia, sessoes.palavra-de-estado-do-cartao, sessoes.filha-arquivada-interrompe, turnos.pai-com-filha-concluida-nunca-interrompido, visual.cartao-modelo-e-esforco, visual.cabecalho-barra-e-chips-desenhados) e 14 dizem 'decisão do usuário' sem as palavras dele. Um cenário novo sem Origem, com id de outra área, ou um arquivo com o mapa escrito depois do primeiro cenário passa no check sem aviso.
- **Proposta:** Em lerCatalogo: exigir uma linha Origem por cenário; avisar origem sem AAAA-MM-DD e 'decisão do usuário' sem aspas (aviso, como o mapa); falhar id cujo prefixo difere do nome do arquivo, 'Código da área:' fora do topo e 'pendente' sem arquivo. Completar as 7 datas e marcar 'a confirmar' onde as palavras não forem recuperáveis.

### As etapas `regras` e `selos` só rodam se o caminho do script bater com `process.argv[1]`; com link simbólico no caminho elas saem com 0 sem conferir nada
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `scripts/regras.mjs:134` — a linha de comando só executa se `fileURLToPath(import.meta.url)` for igual a `process.argv[1]`
  - `scripts/selos.mjs:263` — a mesma guarda; sem ela nada roda e o processo termina com 0
  - `scripts/testes.mjs:25, 74-78` — no hook, as etapas rodam com cwd na cópia do índice criada em `tmpdir()` e script relativo
  - `scripts/golden.mjs:42` — a mesma guarda no golden:aprovar
- **Regra do catálogo:** sem cenário
- **Cenário:** No macOS, `os.tmpdir()` fica em /var/folders/…, e /var é link para /private/var. O hook copia o índice para lá e roda `node scripts/regras.mjs` com esse cwd: `process.argv[1]` fica com /var/… e `import.meta.url` com o caminho real /private/var/…; a comparação falha, o bloco não executa e a etapa sai com 0. O resumo mostra 'ok regras' e 'ok selos' sem nenhuma conferência. O mesmo ocorre no Windows se o TEMP ou o clone estiverem atrás de junção ou `subst`, e em `npm run regras:selar` (não sela e não avisa). Nesta máquina conferi que o nome curto 8.3 do TEMP (<usuario>) não dispara o problema; o caso com link não foi executado.
- **Proposta:** Trocar a guarda, nos quatro scripts, por `pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url`. Como segunda proteção, em scripts/testes.mjs, tratar como falha a etapa `regras` ou `selos` que termina sem imprimir a linha de resumo ('regras: …', 'selos: …').

### Release: reexecutar depois de falha parcial pula uma versão, e a checagem 'release já existe' não cobre esse caso
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `.github/workflows/release.yml:24-27, 38` — o job faz checkout da main atual e lê a versão do plugin.json dela
  - `.github/workflows/release.yml:62-73` — a checagem procura a release da versão NOVA calculada
  - `.github/workflows/release.yml:75-103` — o commit e o push da versão vêm antes do `gh release create`
  - `.github/workflows/release.yml:11-14` — concurrency com `cancel-in-progress: false`: o GitHub mantém só uma execução pendente por grupo
- **Regra do catálogo:** sem cenário
- **Cenário:** Merge de um PR: a versão vai de 0.13.0 para 0.13.1, o commit `chore(release)` é enviado à main e o `gh release create` falha (erro da API). Ao reexecutar o job, o checkout pega a main já com 0.13.1, calcula 0.13.2, não acha release v0.13.2, grava e publica 0.13.2. A v0.13.1 fica com commit e sem tag nem release, e o PR gerou dois saltos. Outros casos sem tratamento: três merges seguidos (a execução pendente do meio é descartada pela fila do grupo e o PR dela fica sem release); e, se a main ganhar proteção que exija PR, o `git push origin HEAD:main` passa a falhar em todo merge.
- **Proposta:** No release.yml, antes de calcular: se o commit do topo da main já é `chore(release): task-tree vX` e não existe a release `vX`, só criar a release dele (sem novo salto). Dar ao job um resumo de erro que diga o que ficou pela metade. Documentar em 'Release e PR' que a proteção da main precisa liberar o push do bot.

### O que o hook pula é decidido por `git diff --name-only` com detecção de renome e caminhos entre aspas: arquivo movido ou com acento escapa das condições
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `scripts/mudou.mjs:23-27` — `git diff --cached --name-only HEAD`, sem `--no-renames` nem `core.quotepath=false`
  - `scripts/mudou.mjs:8-19` — as condições são `startsWith('scripts/')`, `startsWith('task-tree/')` e `startsWith('.claude-plugin/')`
  - `package.json:14-16` — a versão do TypeScript, de que dependem o tsc e os hashes dos selos, fica fora das condições
- **Regra do catálogo:** sem cenário
- **Cenário:** Reproduzi num repositório descartável: movendo `scripts/x.mjs` para `tools/x.mjs` e `task-tree/draw/layout.ts` para `lib/layout.ts`, a saída lista só `tools/x.mjs` e `lib/layout.ts`; e um arquivo novo `task-tree/draw/cabeçalho.ts` sai como `"task-tree/draw/cabe\303\247alho.ts"`, com aspas na frente. Nos três casos `etapasDoHook` devolve travas, validate e tsc como falsos: um commit que só move um arquivo do mod para fora de task-tree/, ou só cria um arquivo com acento no nome, pula validate e tsc. Um commit que só sobe o TypeScript no package.json pula tsc e travas. O `plugin test` continua rodando, o que limita o dano.
- **Proposta:** Em `alteradosNoIndice`: `git -c core.quotepath=false diff --cached --name-only --no-renames -z HEAD` e separar por `\0`. Em `mudaTsc` e `mudaTravas`, incluir `package.json` e `package-lock.json`. Acrescentar os três casos ao teste das travas.

### A regressão deixa de comparar sem avisar em dois caminhos: base vazia na CI e check manual com a árvore limpa
- **Categoria:** omissão · **Severidade:** baixa · **Situação:** apontado como confirmado na leitura, sem segunda verificação
- **Evidência:**
  - `.github/workflows/test.yml:53-65` — `echo "ref=$(git merge-base …)"`: se o merge-base falhar, o passo não falha e `ref` fica vazio; o check recebe `--base ""`
  - `scripts/testes.mjs:17-20` — `--base` com valor vazio vira modo HEAD (`comBase = []`)
  - `scripts/regressao.mjs:34-45` — sem diferença em task-tree/ contra HEAD, sai com 0 ('nada a comparar')
  - `scripts/selos.mjs:128-132` — se o `git show <ref>:regras/selos.json` falhar, os selos da base viram vazios e a comparação de asserções deixa de existir, sem erro
  - `CLAUDE.md:59-60` — 'O `npm run check` manual roda tudo'
- **Regra do catálogo:** sem cenário
- **Cenário:** (1) Na CI, se `git merge-base origin/main HEAD` falhar, o job roda `npm run check -- --base ""`: o script entra em modo HEAD, a árvore do runner está limpa, a regressão diz 'nada a comparar', os selos são comparados consigo mesmos e o check fica verde sem ter comparado nada com a base. (2) Localmente, depois de um commit feito sem o hook (rebase, cherry-pick, merge, clone sem `npm install`), o `npm run check` manual mostra 'ok regressao' sem ter rodado os testes antigos; a frase 'roda tudo' do CLAUDE.md sugere o contrário.
- **Proposta:** Em scripts/testes.mjs, `--base` sem valor ou com ref que não resolve (`git rev-parse --verify`) é erro. No test.yml, `set -euo pipefail` no passo e teste de `ref` não vazio. Em scripts/selos.mjs, `selosDeHead` falha quando a ref não existe (distinguindo de 'arquivo ausente na ref'). No CLAUDE.md, dizer que a regressão do check manual só compara com mudança pendente e indicar `-- --base <ref>` para conferir commits já feitos.

### Commit feito de uma worktree: o hook roda, mas falha por falta de `node_modules` e dos tipos gerados
- **Categoria:** fluxo não mapeado · **Severidade:** baixa · **Situação:** suspeita, sem segunda verificação
- **Evidência:**
  - `scripts/testes.mjs:31-35` — a cópia do índice só recebe `node_modules` e `.claude-plugin/types` se existirem na pasta do repositório
  - `scripts/selos.mjs:19` — a etapa `selos`, nunca pulada, importa `typescript`
  - `scripts/testes.mjs:81` — o tsc roda por `npx tsc`, que sem o TypeScript local tenta baixar o pacote `tsc`
  - `.gitignore:1-5` — `node_modules/` e `.claude-plugin/types/` são ignorados, logo não existem numa worktree nova
  - `package.json:7` — o hook é ligado por `core.hooksPath`, configuração compartilhada com as worktrees
- **Regra do catálogo:** sem cenário
- **Cenário:** O usuário pede uma filha em worktree (previsto nas regras de orquestração). A worktree nasce sem `node_modules` e sem os tipos. No primeiro commit, o hook copia o índice para o temporário sem a ligação ao `node_modules`; a etapa `selos` quebra com ERR_MODULE_NOT_FOUND e o commit é bloqueado com uma mensagem que não diz o que fazer; se chegasse ao tsc, o `npx tsc` tentaria baixar outro pacote. A saída é rodar `npm install` e um validate na worktree, o que não está escrito em lugar nenhum. Não executei; a conclusão vem da leitura.
- **Proposta:** Em scripts/testes.mjs, quando a pasta não tem `node_modules`, procurar o do clone principal (`git rev-parse --git-common-dir`) e ligar esse; sem nenhum, parar no começo com 'rode npm install'. Trocar `npx tsc` por `node node_modules/typescript/bin/tsc`. Uma linha no CLAUDE.md sobre worktree.

## Descartados na verificação

Apontados na leitura e refutados ao conferir o código ou as decisões já registradas.

- **Cartão "encerrada" continua contando como cartão vivo: fica solto no fim do painel em todos os pedidos seguintes** (Sessões filhas e cartões): O código faz o que o achado descreve (alive não exclui settled; layout.ts:716, 1360-1363, 1525-1530), mas é o comportamento decidido, escrito no cenário e travado por teste selado; os dois cenários não se contradizem. O acúmulo de cartões encerrados no fim do painel é consequência dessa decisão, não defeito.
- **A mesma mensagem fecha ou não a tarefa conforme a filha estava ocupada no instante do envio** (Envios (cartas)): O código faz o que o achado descreve, mas cada lado é decisão do usuário registrada no catálogo, coberta por teste e dita ao modelo nas regras de uso; a conclusão automática na entrega da fila foi confirmada por ele depois da regra da entrega imediata. Não há contradição com o que está registrado.
