# Achados médios, triagem C: índice dos lotes

Escrito pelo planejador da triagem C em 2026-11-14, só lendo o código (branch `fix/achados-medios`,
ponta `6d5e026`). Fontes: `triagem-medios-C.local.md`, `orq-decisoes-medios.local.md` (itens "(C)"),
`orq-instrucoes-planejador-medios.local.md`. Um arquivo por lote: `medios-C-lote-NN-plano.local.md`,
nesta pasta. Cada lote é um commit. Caminhos do mod relativos a `task-tree/`.

Situação: os 31 planos estão escritos.

## Ordem de implementação

A ordem segue a da triagem (scripts de relato; `/clear` e retomada; ligações; store; textos; avisos;
lembrete de planejar; travas), com cada decisão encaixada onde toca a mesma função. Duas diferenças
contra a ordem da triagem, com o motivo:

- O registro de remoção e de renome de teste (lote 03) sobe para o começo. Os lotes de decisão que
  tiram ou renomeiam um teste junto com o código (o 16 daqui, e os das outras triagens) não passam na
  etapa `regressao` sem ele.
- O `/clear` numa sessão com filhas (lote 07) vem depois das ligações na recarga (lote 06), porque usa
  a função de primeiro uso das ligações que o 06 cria.

O selo por alcance (lote 31) fica por último, de todas as triagens: regrava o hash de quase todos os
testes.

| Lote | Título | Achados | Decisão (número em `orq-decisoes-medios`) | Arquivos do mod | Plano |
|---|---|---|---|---|---|
| 01 | Relato depois do commit local: `testes:alterados` e `impacto` | os dois comandos respondem "nenhum" depois do commit | correção direta | nenhum (`scripts/`, `regras/README.md`, `CLAUDE.md`) | escrito |
| 02 | Contagem de asserções pelos helpers do kit e pelas funções do arquivo | a contagem ignora helpers que afirmam | correção direta | nenhum (`scripts/`, `regras/selos.json`) | escrito |
| 03 | Selos conferidos contra `HEAD`, registro de remoção e renome de teste | a etapa selos não compara com `HEAD`; remover ou renomear teste por decisão não tem saída na regressão | correção direta (dois achados, mesma peça) | nenhum (`scripts/`, `regras/`, `CLAUDE.md`) | escrito |
| 04 | `/clear` e retomada limpos | o `/clear` publica antes de zerar; a retomada sem cópia mantém o painel anterior | correção direta (dois achados, mesmo arquivo) | `hooks/session-start.ts`, `hooks/panel.ts` | escrito |
| 05 | Processo morto no meio do turno: a tarefa em andamento volta ✕ | turno gravado como "em curso" desenha ◉ sem turno nenhum | 33: "✕ interrompida" | `hooks/session-start.ts`, `hooks/panel.ts`, `state/durability.ts` | escrito |
| 06 | Ligações na recarga: o state é a verdade | a primeira gravação depois da recarga funde o store por cima do state | correção direta | `hooks/panel.ts`, `state/durability.ts`, `hooks/tool-call.ts`, `hooks/prompt-submit.ts`, `hooks/sessions.ts`, `hooks/agents.ts`, `hooks/session-start.ts` | escrito |
| 07 | `/clear` numa sessão com filhas: o cartão da filha some na hora | `/clear` e retomada não mexem nas ligações das filhas | 32: "Some na hora" | `hooks/session-start.ts`, `hooks/panel.ts`, `hooks/sessions.ts`, `hooks/tool-call.ts`, `state/durability.ts` | escrito |
| 08 | Store: falha registrada, sobras apagadas, poda e nova tentativa | teto de 4 MiB: o painel para de ser salvo em silêncio | correção direta | `state/durability.ts`, `hooks/panel.ts`, `hooks/command.ts`, `io/log.ts` | escrito |
| 09 | Comentários e exports da tabela de durabilidade | o teste que a tabela diz ter não existe (parte do código) | correção direta | `state/durability.ts`, `hooks/panel.ts`, `io/publish.ts`, `io/host.ts` (e `scripts/regras.mjs`) | escrito |
| 10 | Subagentes terminados sem tarefas saem do estado | os grupos de subagente nunca saem do estado | 34: "Apagar os sem tarefas (Recomendado)" | `hooks/panel.ts`, `hooks/tools.ts` | escrito |
| 11 | Arquivos publicados: enxugar e esvaziar | arquivos publicados nunca são apagados e crescem sem teto | 35: "Enxugar e esvaziar (Recomendado)" | `io/publish.ts`, `hooks/panel.ts`, `hooks/sessions.ts`, `io/host.ts`, `draw/layout.ts` (uma função pura de corte) | escrito |
| 12 | Painel guardado enquanto a sessão existir | o store guarda só as 30 últimas | 37: "Enquanto a sessão existir (Recomendado)" | `hooks/panel.ts`, `hooks/session-start.ts`, `state/durability.ts`, `io/publish.ts`, `types/index.d.ts` | escrito |
| 13 | Arquivos publicados lidos só quando mudam | parte direta, opcional, do achado dos arquivos publicados | correção direta (opcional na triagem) | `io/publish.ts`, `io/host.ts`, `hooks/sessions.ts`, `state/durability.ts` | escrito |
| 14 | Painel fechado reabre só na mensagem da pessoa | pergunta ligada ao achado da recarga que roda `session.start` | 36: "Só na sua mensagem (Recomendado)" | `hooks/tools.ts`, `hooks/session-start.ts`, `hooks/panel.ts`, `types/index.d.ts`, `state/durability.ts` | escrito |
| 15 | Textos que dizem o que o painel não faz | tooltip e "primeira frase"; refazer um pai concluído; regra dos subagentes; comentário do modo plano | correção direta (três achados, mesma causa e arquivos) | `text/rules.ts`, `hooks/tools.ts`; comentários em `hooks/turn.ts`, `hooks/tool-call.ts`, `draw/layout.ts` | escrito |
| 16 | Resposta inteira do turno fora do painel | a resposta inteira guardada e sem uso | 38: "Tirar, basta o ↩ (Recomendado)" | `hooks/turn.ts`, `hooks/tool-call.ts`, `hooks/panel.ts`, `draw/layout.ts`, `state/durability.ts`, `types/index.d.ts` | escrito |
| 17 | Resultado do plan com avisos | o resultado do plan não diz o que foi interrompido ou guardado | correção direta | `hooks/tools.ts`, `text/rules.ts` | escrito |
| 18 | "Parou com N pendentes" nas duas ordens | a mãe só é avisada se a origem já estava fechada | correção direta | `hooks/sessions.ts`, `hooks/tools.ts`, `text/rules.ts` | escrito |
| 19 | Nota do fim dos subagentes e done em tarefa ✕ | o modelo não é avisado quando o painel fecha ou marca ✕ pelos subagentes | correção direta | `hooks/agents.ts`, `hooks/tools.ts`, `hooks/prompt-submit.ts`, `hooks/tool-call.ts`, `text/rules.ts`, `types/index.d.ts`, `state/durability.ts` | escrito |
| 20 | "Falta o summary" só vale para o último passo | o aviso dispara no meio do turno | correção direta | `hooks/tools.ts`, `text/rules.ts`, `hooks/panel.ts` | escrito |
| 21 | Lembrete de planejar pelo pedido atual | os lembretes medem "tarefa aberta" no grupo inteiro | correção direta | `hooks/tool-call.ts`, `hooks/tools.ts`, `hooks/panel.ts` | escrito |
| 22 | Pergunta sem tarefa em andamento: o aviso fica sob a pendente | a espera fica solta no fim | 39: "Pendurar na pendente (Recomendado)" | `hooks/tool-call.ts`, `draw/layout.ts` | escrito |
| 23 | Passo ○ de pedido anterior não libera a pergunta | a recusa confere só "tarefa aberta" | 40: "Não (Recomendado)" | `hooks/tool-call.ts`, `text/rules.ts` | escrito |
| 24 | Mensagem nova com tarefas abertas: done, depois plan | os lembretes da mesma mensagem dão ordens opostas | 41: "Done, depois plan (Recomendado)" | `text/rules.ts`, `hooks/prompt-submit.ts` | escrito |
| 25 | Um cenário por texto ao modelo | a maior parte dos textos ao modelo não tem cenário nem teste | 42: "Cenário por texto (Recomendado)" | nenhum (catálogo e testes) | escrito |
| 26 | Tempo do pai e do pedido conta do primeiro start | tempo de tarefa, pedido e cabeçalho sem definição | 44: "Do primeiro start (Recomendado)" | `draw/layout.ts` | escrito |
| 27 | Golden ampliado ao que o catálogo diz travar | o golden não contém o que os cenários `visual.desenho-*` dizem | 43: "Ampliar o golden (Recomendado)" | nenhum (`tests/golden.test.ts`, `tests/golden/desenho.ts`, o kit, `scripts/selos.mjs`) | escrito |
| 28 | Release: "BREAKING CHANGE" só no rodapé | regra de versão do release (primeira pergunta) | 47: "Só no rodapé (Recomendado)" | nenhum (`.github/workflows/release.yml`, `scripts/versao.mjs`, `CLAUDE.md`) | escrito |
| 29 | Release: título fora do formato vira patch com aviso | regra de versão do release (segunda pergunta) | 48: "Patch com aviso" | nenhum (os mesmos do lote 28) | escrito |
| 30 | `DESENVOLVIMENTO.md` atualizado | tabela de durabilidade e documentação desatualizadas (dois achados, uma pergunta) | 45: "Atualizar agora (Recomendado)" | nenhum (`DESENVOLVIMENTO.md`) | escrito |
| 31 | Selo por alcance transitivo e fixtures seladas | o selo não cobre o que o teste usa por tabela | correção direta | nenhum (`scripts/`, `regras/selos.json`, um teste) | escrito |

Contagem: 17 achados de correção direta em 15 lotes (01 a 04, 06, 08, 09, 13, 15, 17 a 21 e 31; o 03
e o 04 juntam dois achados cada, o 15 junta três e divide um com o 19; o 13 é a parte direta de um
achado de decisão); 16 decisões em 16 lotes (05, 07, 10, 11, 12, 14, 16, 22 a 30; a 45 responde dois
achados).

## Golden

Só o lote 27 muda o golden por desenho (dois cenários novos; os quatro aprovados ficam). O lote 26
pode mudar o cenário "principal" (pela leitura do roteiro, não deve). Os lotes 16 e 22 mexem em
`draw/layout.ts` sem mudar o que é desenhado nos roteiros. Em qualquer mudança, o implementador
regrava com `--motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"`.

## Fora dos lotes

- Não confirmados ("Ficam de fora (Recomendado)"): o painel do store lido sem validação e a leitura do
  store que falha (o lote 08 só registra no log a leitura que falha); a recarga que roda
  `session.start`; a parte "cartas e cartões da sessão anterior depois de uma retomada no mesmo
  processo" do achado da retomada.
- Resolvido: os testes de pedidos e sessões que não reproduziam o que o app publica (PR 36).
- Decisão 9 (cartão cuja tarefa de origem sai do plano): fica com a triagem A (lote 15 de lá).
- Decisão 46 (memória "sem testes nem docs"): feita pela orquestradora.
- O cabeçalho de `text/rules.ts` que citava um teste e um golden de textos: já corrigido no PR 38
  (conferido na ponta: linhas 6 e 7). Sobra só a frase das linhas 9 e 10, que vai no lote 15.

## Pontos para a orquestradora (não são bloqueios)

- Lote 07: o plano entende "a filha segue trabalhando sem cartão na mãe" como definitivo naquela
  sessão, mesmo quando a mãe manda mensagem nova à filha (só a carta aparece). Se o usuário quiser o
  cartão de volta nesse caso, é pergunta nova (o texto está no item 11 do plano).
- Lote 05: a regra vale no `session.start` de processo novo e na retomada. Se um dia se confirmar que
  o `session.start` roda também quando só o worker dos hooks volta com o turno vivo (achado não
  confirmado), ela marcaria ✕ uma tarefa de turno vivo; o evento não traz sinal para distinguir.
- Lote 11: leitura assumida da opção: "tirar a cópia antiga das tarefas" é parar de escrever `tasks`;
  a leitura dos formatos antigos fica. E falta confirmar, na implementação, como o app responde à
  consulta de uma sessão que não existe; sem sinal claro, a passada não esvazia nada.
- Lote 12 e lote 21 da triagem A usam o mesmo campo novo do arquivo publicado (o fim do turno): quem
  entrar primeiro o cria.
- Lote 13 é opcional na triagem; pode ficar para depois sem afetar os outros.
- Lotes 28 e 29 precisam estar no PR desta rodada antes do merge: a descrição dele vai citar a regra
  do "BREAKING CHANGE", e o workflow de release roda a versão que estiver na `main` depois do merge.
- Lote 31 é o último commit de teste e selo da branch, das três triagens.
- Conflitos com as triagens A e B estão no item 10 de cada plano. Os arquivos mais disputados:
  `text/rules.ts` e `hooks/tools.ts` (lotes 15 a 24 daqui; A: 02, 03, 04, 05, 14; B: 01, 02, 26),
  `hooks/panel.ts` (quase todos), `hooks/sessions.ts` e `io/publish.ts` (11 a 13 daqui; A: 10, 12, 13,
  21, 23, 24; B: 10, 25), as funções de tempo de `draw/layout.ts` (26 daqui; A: 21, 22; B: 18, 19) e
  `regras/selos.json` (todos).

## Bloqueios

Nenhum. Nenhum plano contraria decisão registrada sem cobertura das respostas de 2026-11-14. As
reescritas de cenário coberto estão nos lotes 10 (decisão 34), 16 (decisão 38), 23 (decisão 40) e 27
(decisão 43), cada uma com o `Reescrito:` e as palavras dele.
