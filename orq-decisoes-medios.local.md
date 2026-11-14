# Decisões do usuário sobre os achados médios da auditoria (triagens A, B e C)

Registro da orquestradora "Orq - TaskTree". Só ela escreve aqui. Perguntas feitas em 2026-11-14, 4 por
vez, a partir de `triagem-medios-A/B/C.local.md` (o texto completo de cada pergunta está no achado).
As perguntas "âncora que sai do plano" (A) e "cartão com a tarefa de origem replanejada" (C) foram
juntadas numa só (a 9). Formato: número, achado (triagem), resposta nas palavras dele.

1. Nível 1 que fechou sozinho e é replanejado com o mesmo id (A): "Reabre mantendo os ✓ (Recomendado)".
2. start num pai aberto (A): "Inicia a 1ª subtarefa (Recomendado)".
3. Tarefa abandonada pelo modelo (A): "✕ fora do x/y (Recomendado)".
4. request de um segundo plan no mesmo pedido (A): "Não, vale o 1º (Recomendado)".
5. Tarefa ◷ depois de fim normal, na mensagem seguinte (A): "Seguir ◷ até o start (Recomendado)".
6. ↩ de pedido sem tarefa (A): "Pedido próprio (Recomendado)".
7. Esc na principal com filha ou subagente vivo sob a tarefa (A): "Segue ◉/◷ (Recomendado)".
8. Turno que morre por erro de API ou limite de contexto (A): "✕ \"falhou\" (Recomendado)".
9. Cartão cuja tarefa de origem sai do plano num replano (A e C juntas): "Sob o nível 1 (Recomendado)".
10. Cartão de filha sem tarefa de origem que conclui (A): resposta livre: "Se existe uma sessão filha ou
    subagente criados antes do plan, eles deveriam se planejadas para mostrar corretamente na lista, o
    que acha?" (levado de novo como confirmação, junto com a pergunta 1 da triagem B; ver 13).
11. Filha arquivada antiga (A): "Vira linha resumida (Recomendado)".
12. Cartão da rodada largada pela filha (A): "\"Substituída\", cinza (Recomendado)".
13. Carta e cartão criados antes do plan do pedido (A, pergunta 10, e B, pergunta 1, juntas):
    "Sim, o plan adota (Recomendado)": soltos no fim só até o primeiro plan do pedido, que os adota sob a
    tarefa pelo nome da sessão, senão a primeira pendente; as regras pedem planejar antes de abrir sessão
    ou lançar subagente.
14. Pergunta opcional no wrap_up de uma filha (A): "Toda pergunta espera" (como hoje; só a parte direta
    do achado entra).
15. Filha parada com Esc e a contagem na mãe (A): "Rodada fora da conta (Recomendado)".
16. /clear numa filha (A): "Mantém o histórico (Recomendado)".
17. Tempo da tarefa concluída com filha embaixo (A): "Só o próprio" (até o done; o relógio da linha não
    corre enquanto a filha trabalha).
18. Turnos digitados direto na filha (A): "Um cartão só (Recomendado)" (muda a decisão de 2026-11-03).
19. Carta com tarefa em andamento e passo novo pendente (B): "Sob a em andamento (Recomendado)" (desfaz
    o pedido registrado em DESENVOLVIMENTO.md:1261).
20. Casamento por uma palavra (B): "Só no nome (Recomendado)".
21. Esc e fim posterior do subagente em segundo plano (B): "Fecha como no fim normal" (coerente com a 7:
    a tarefa segue ◷ enquanto o subagente roda e fecha pelo fim dele).
22. Relançar subagente depois de falha (B): "✓, vale a última (Recomendado)".
23. Onde contam as tarefas de um subagente (B): "No cabeçalho e acima" (entram no "d de n" e no x/y da
    tarefa de origem e do pedido, com o cartão aberto, recolhido ou em grupo).
24. Tarefa sem start com subagente rodando (B): "Sim, ◉ como a filha (Recomendado)".
25. Tempo do cabeçalho com o turno encerrado (B): "Parar no fim do turno (Recomendado)".
26. Tempo da tarefa que atravessa turnos (B): "Só com turno em curso (Recomendado)".
27. Cabeçalho estreito (B): "Os dois sempre" (toks/s e "ultracode" em qualquer largura; muda o desenho
    aprovado a 60 colunas e o golden: validação no app).
28. Total da sessão inteira no app (B): "Na linha +N (Recomendado)".
    (25 a 28 ficaram sem resposta na primeira vez e foram respondidas no fim, em 2026-11-14.)
29. Faixa do cabeçalho entre um done e o start seguinte (B): "\"Em andamento\" (Recomendado)".
30. Faixa com só a filha trabalhando (B): "Âmbar, como hoje" (corrigir o texto do cenário de 2026-11-03).
31. Pedido único acima do limite de linhas (B): "Trecho da em andamento (Recomendado)" (muda o desenho
    aprovado em 2026-10-22).
32. /clear numa sessão com filhas, cartão da filha aberta antes (C): "Some na hora".
33. App fechado ou processo morto no meio do turno (C): "✕ interrompida".
34. Poda dos subagentes terminados no estado (C): "Apagar os sem tarefas (Recomendado)".
35. Arquivos publicados (C): "Enxugar e esvaziar (Recomendado)" (toca a decisão de 2026-11-04).
36. Painel fechado reabre sozinho? (C): "Só na sua mensagem (Recomendado)".
37. Por quanto tempo guardar o painel de sessão parada (C): "Enquanto a sessão existir (Recomendado)".
38. Resposta inteira do turno, guardada e sem uso (C): "Tirar, basta o ↩ (Recomendado)".
39. Pergunta com tarefa aberta mas nenhuma em andamento (C): "Pendurar na pendente (Recomendado)".
40. Passo ○ de pedido anterior libera a pergunta de pedido novo? (C): "Não (Recomendado)".
41. Ordem done/plan numa mensagem nova com tarefas abertas (C): "Done, depois plan (Recomendado)".
42. Proteção dos textos ao modelo (C): "Cenário por texto (Recomendado)".
43. Golden que não cobre o que o catálogo diz travar (C): "Ampliar o golden (Recomendado)" (os desenhos
    novos passam pela validação dele no app antes do commit).
44. Base do tempo de pai e pedido (C): "Do primeiro start (Recomendado)" (pode mudar o golden principal:
    validação no app).
45. Atualizar o DESENVOLVIMENTO.md agora (C): "Atualizar agora (Recomendado)".
46. Reescrever a memória "sem testes nem docs" (C): "Sim, reescrever (Recomendado)" (feito pela
    orquestradora em 2026-11-14).
47. BREAKING CHANGE no corpo do PR (C): "Só no rodapé (Recomendado)".
48. Título de PR fora do formato (C): "Patch com aviso".

## Situação

Todas as 48 perguntas respondidas em 2026-11-14. Falta planejar e implementar: as correções diretas das
três triagens e as decisões acima, em lotes, pelo processo combinado (planejador Fable alto, só lendo;
implementador Opus baixo; um commit por item; push e PR quando o usuário liberar). As decisões que mudam
o desenho (27, 31, 43, 44 e outras) passam pela validação dele no app antes de regravar o golden.

## Como entregar, 2026-11-14 (depois do merge do PR 38)

- "Merge feito. Continue com o planejamento e a implementação."
- Entrega: "Um PR só no fim" (branch `fix/achados-medios`, a partir do `main` em `6d5e026`, v0.15.1).
- Golden: "Validar só no fim (Recomendado)". O implementador regrava o golden com
  `--motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"` e segue com o commit; o usuário vê tudo no
  app antes do merge.
- Planejadores: "3 em paralelo (Recomendado)", um por triagem (A, B, C), Fable, esforço alto, só leitura.
  Implementadores: Opus, esforço baixo, um por vez, lote por lote.
- Não confirmados: "Ficam de fora (Recomendado)".

## Perguntas dos planos da triagem B, 2026-11-14

- Lote B-09 (Esc e varredura do fim dos subagentes): "Todas, como hoje" (a varredura segue fechando
  também as paradas cujos subagentes terminaram antes do Esc; o código fica, só cenário e testes).
- Lote B-15 (tarefa concluída com subagente em segundo plano): "Segue ✓ (Recomendado)".
- Lote B-16 (faixa "em andamento"): "Do primeiro start (Recomendado)".
- Lote B-26 (ferramenta antiga de mensagem): bloqueado por ensaio no app; fica de fora, como os não
  confirmados ("Ficam de fora (Recomendado)").
- As 8 deduções do planejador da triagem A (índice A) seguem como ele escreveu: nenhuma contraria
  decisão registrada.

## Ordem de implementação (orquestradora)

C-03 (selos: remoção e renome de teste, de que lotes A e C precisam), C-04 a C-14, A-01 a A-26 (sem o
21), B-01 a B-25, C-15 a C-30 (sem o 13, opcional), C-31 por último.

## Ao finalizar, 2026-11-14

- "Quando finalizar, sugira os próximos passos usando AskQuestions": depois do último lote (e do push e
  PR único), a orquestradora pergunta os próximos passos pelo AskUserQuestion, em vez de só relatar.
- Refinado em seguida: "Quando finalizar o desenvolvimento, não tiver mais nenhum subagente rodando, é
  precisar da minha interação, sugira os próximos passos usando AskQuestions". As três condições juntas:
  desenvolvimento terminado, nenhum subagente rodando e necessidade de interação dele. Enquanto houver
  agente rodando ou lote por fazer, seguir sem perguntar.

## Lote C-10 (poda dos subagentes terminados), 2026-11-14

- A poda derruba o teste protegido "âncora gravada por versão anterior, 1/2" (e o 2/2), de
  `subagentes.lancado-antes-da-tarefa-nao-conta`, porque a preparação dele usa um subagente terminado sem
  tarefas. Pergunta: "Posso ajustar a preparação desse teste, com selo de decisão?"
- Resposta: "Sim, ajustar a preparação (Recomendado)". O teste passa a montar ele mesmo o subagente
  antigo; as afirmações ficam iguais; o cenário ganha `Reescrito: 2026-11-14` com essas palavras e o
  teste é selado `--tipo decisao`.
- O lote C-10 será retomado depois de C-11, C-12 e C-14 (patch parcial em `scratchpad\lote10-parcial.patch`).

## Ritmo, 2026-11-14

- Worktrees: analisado e descartado (todo lote grava em `regras/selos.json`, quase todos tocam
  `hooks/panel.ts`, os planos dependem da ordem e dois checks juntos estouram os 5 s).
- "Sim" aos dois ajustes: (1) o implementador não roda mais o check inteiro à mão no clone (passa na
  cópia e no hook do commit); (2) os lotes só de scripts do release (C-28, C-29) rodam numa trilha
  paralela aos lotes do mod.

## PROCESSO.md, 2026-11-14

- O usuário quis persistir o modo de trabalho só neste repositório, sem tocar o CLAUDE.md global ("Para
  não poluir o Claude.md global do usuário, com regras específicas desse repositório").
- Rascunho em `orq-rascunho-PROCESSO.local.md`; resposta dele: "Aprovado". Vai para `PROCESSO.md` na
  raiz, importado pelo `CLAUDE.md` do repositório, num commit próprio da branch `fix/achados-medios`.

## Workflows do GitHub, 2026-11-14

- Usuário: "O workflow do GitHub está desativado. Não conte com ele". Não usar workflow do GitHub como
  validação nem como passo do plano; a validação é o `npm run check` local e o app.
- Conferido na hora: `gh workflow list` mostra "Release" e "Testes" ativos, e o "Release" rodou com
  sucesso no merge do PR 38 (v0.15.1, commit do github-actions). O "Testes" só roda à mão. Levado ao
  usuário para ele dizer qual dos dois está desativado para ele.
- Depois de conferido (Release ativo, roda a cada merge; Testes só à mão, nunca rodou): "Não, se está
  ativo, deixe assim". O Release fica como está; nada a mudar nos workflows.

## Mudança de máquina, 2026-11-14

- Pedido: "quero continuar exatamente o que estamos fazendo aqui em uma nova maquina. ela vai clonar o
  repositorio e quero continuar exatamente o que estamos fazendo do mesmo jeito que estamos fazendo."
- Notas: "Branch à parte no repo (Recomendado)"; depois de saber que o repositório é público: "Branch
  pública, sem nomes". Conteúdo: "Tudo". Prints: "Vão também". Limpeza: "Menos os ids de sessão"
  (usuário do Windows, caminhos, sobrenome, e-mail e a menção à <outra organização> saem; os ids `local_…` ficam).
- Push da branch do trabalho sem PR: "opcao 1" (sim).
- Parada: "Agora". O agente dos lotes A-03 a A-05 foi parado com o A-03 em commit (`0716717`); o A-04
  estava aplicado sem commit e foi desfeito. Lote parado: "Recomeça do zero (Recomendado)" (o patch
  parcial não viaja).
- Caminhos: "Não sei ou diferentes (Recomendado)": relativos ao clone e à pasta irmã de notas.
- Retomada: "Junto das notas (Recomendado)". Esta máquina: "Para de vez (Recomendado)".
- "quero continuar na nova maquina mandando um prompt simples, tipo \"leia o arquivo X e retome os
  trabalhos\"": o `RETOMADA.md` diz, ele mesmo, o que a sessão nova faz ao lê-lo (seção 9), e o prompt
  de uma linha está na seção 10.
- Feito em 2026-11-14: push de `fix/achados-medios` (ponta `0716717`) e da branch `notas/achados-medios`
  (commit `82734cc`, 482 arquivos, com a limpeza de nomes conferida por busca; os 15 prints foram vistos
  um a um e mostram só o painel). Esta máquina parou: nenhum agente rodando, árvore limpa.

## Revisão da passagem, 2026-11-14

- Pedido: "revise e veja se faltou algo para continuarmos o que paramos, exatamente do mesmo jeito".
- Faltava e entrou no `RETOMADA.md`: como o mod é carregado do clone (configuração do Claude Code, que
  só o usuário muda); o modo automático de permissões; que planejador e implementador são subagentes da
  ferramenta `Agent`, com os parâmetros e o modelo de prompt; a definição dos marcadores de caminho em
  todo prompt; o que a orquestradora faz quando um agente termina; as duas regras da memória local que
  não estavam no repositório; as regras de PR do `CLAUDE.md` global; os candidatos a próximos passos.
- Não viajaram, por serem do usuário: a memória local do Claude Code e o `CLAUDE.md` global.

## Revisão em loop da passagem, 2026-11-14

- Pedido: "revise em loop e veja se faltou algo para continuarmos o que paramos, exatamente do mesmo
  jeito, até que não falte mais nada".
- Rodada 1 (o que depende da máquina). Achado grave, erro da orquestradora: a identidade do git (nome e
  e-mail do autor) está só na configuração local do clone antigo; a identidade global daquela máquina é
  a de outra conta. Os dois primeiros commits da branch de notas saíram com a identidade global. A
  branch foi apagada do remoto e republicada com um commit só, com a identidade certa; os dois commits
  antigos ficam sem referência, mas ainda podem ser abertos pelo hash até o GitHub os recolher (só o
  suporte do GitHub apaga antes). A branch do trabalho nunca teve commit com outra identidade.
- Entraram no `RETOMADA.md`: a identidade do git nos dois clones, com conferência obrigatória; as versões
  das ferramentas; a regra das datas dos selos; o check do PR inteiro antes do PR; como o usuário
  trabalha com a sessão; o que a orquestradora faz de git. Nas instruções do implementador: a
  conferência da identidade antes de qualquer commit, e o fim da trilha paralela.
