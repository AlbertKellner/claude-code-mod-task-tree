# Lote 25 (triagem C): um cenário por texto ao modelo

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "A maior parte dos textos ao modelo não tem cenário nem teste…" (a parte do cabeçalho de
  `text/rules.ts` já foi resolvida no PR 38).
- Decisão 42: "Cenário por texto (Recomendado)". A opção: "Um cenário por texto, conferindo quando
  ele sai e os trechos essenciais. Mudar a redação segue livre; mudar quando o texto sai passa a
  exigir decisão registrada."

## 2. Causa confirmada na ponta

Busca de cada texto de `text/rules.ts` em `task-tree/tests` (na ponta). Sem nenhum trecho em teste:
- `PROMPT.handback` ("o subagente terminou") e `PROMPT.background` ("uma tarefa em segundo plano");
  o `PROMPT.notice` ("mantenha o painel em dia") só aparece como contraste nos testes da tarefa parada;
- `ASK.answered` ("o usuário respondeu") e `ASK.inChat` ("vai responder por mensagem no chat"); o
  prefixo "Esta mensagem é a resposta do usuário" só é conferido na mensagem do meio do turno;
- `WRAP_UP.noBrief` ("falta o resumo do turno") e `WRAP_UP.open` ("o turno termina com tarefas
  abertas");
- `DONE.queued` ("ainda está na fila") e `SEND.queued`/`SEND.queuedSub` ("ficou na fila");
- `SESSION.ended` ("terminou o turno a sessão", com a origem aberta).
Já cobertos, sem mudança: os lembretes de depois do Esc, o do meio do turno, o da tarefa parada, o de
planejar, "recebimento confirmado", "mensagem não entregue", e os textos novos dos lotes 15 a 24
desta triagem (cada um entra com o seu teste).

## 3. O que muda

Nenhum arquivo do mod. Só catálogo e testes: um cenário por texto da lista, com um teste que confere
**quando** o texto sai (e quando não sai) e um ou dois trechos essenciais, nunca a frase inteira. Os
testes leem o contexto que o mod devolve no prompt (`$.prompt.submit`) ou no resultado da ferramenta
(`$.tool.call`, campo `context`), como `tests/lembretes.test.ts` já faz.

## 4. Impacto

Nenhum arquivo do mod tocado.

## 5. Testes de verificação (novos; passam hoje, porque só travam o que já acontece)

Em `tests/lembretes.test.ts`:
1. `lembretes.retorno-de-subagente`: o prompt de hand-back traz "o subagente terminou" e
   "mcp__task-tree__done"; não traz "A PRIMEIRA chamada"; não abre pedido (o painel não ganha linha).
2. `lembretes.tarefa-em-segundo-plano`: o prompt com origem `task-notification` traz "tarefa em
   segundo plano" e "terminou"; não abre pedido.
3. `lembretes.aviso-do-app`: o `<side-sessions-event>` traz "mantenha o painel em dia"; não traz o
   lembrete de pedido novo.
4. `lembretes.resposta-por-opcao`: a pergunta respondida por opção, com tarefa aberta, devolve no
   resultado "o usuário respondeu" e "mcp__task-tree__plan".
5. `lembretes.resposta-pelo-chat`: a pergunta dispensada para o chat devolve "vai responder por
   mensagem no chat"; a mensagem seguinte da pessoa (fora do meio do turno) traz "Esta mensagem é a
   resposta do usuário à pergunta anterior", uma vez só.
6. `lembretes.wrap-up-sem-resumo`: o wrap_up sem summary anterior devolve "falta o resumo do turno";
   com summary dado antes, não.
7. `lembretes.wrap-up-com-abertas`: o wrap_up com tarefas abertas devolve "o turno termina com
   tarefas abertas" e os títulos; com tudo fechado, não.

Em `tests/envios.test.ts`:
8. `envios.aviso-de-envio-na-fila`: o `SendMessage` que fica na fila devolve "ficou na fila" e a
   tarefa do envio; na entrega imediata, não; para um subagente, "para o subagente".
9. `envios.done-com-carta-na-fila`: o done que fecha a tarefa de uma carta ainda na fila responde
   "ainda está na fila"; com a carta entregue, não.

Em `tests/sessoes.test.ts`:
10. `sessoes.lembrete-de-turno-terminado`: a filha termina o turno com a tarefa de origem aberta; o
    prompt seguinte (ou o resultado da ferramenta seguinte) traz "terminou o turno a sessão", o nome
    dela e a tarefa de origem, uma vez só; com a origem já fechada, não traz esse texto.

Nenhum teste existente muda.

## 6. Catálogo e selos

Dez cenários novos, `coberto`, nos arquivos da lista acima (`regras/lembretes.md`, `regras/envios.md`,
`regras/sessoes.md`), todos no mesmo molde. O primeiro, por extenso; os outros nove seguem os itens
1 a 10 do item 5, com o "Quando" e o "Então" de cada um:

```markdown
### lembretes.retorno-de-subagente
O retorno de um subagente traz o lembrete curto de atualizar o painel.

- Dado um subagente que devolve o trabalho ao loop principal
- Quando o prompt de retorno chega
- Então o modelo recebe o lembrete de que o subagente terminou e de marcar com done o que ele concluiu; não recebe o lembrete de pedido novo, e o painel não ganha pedido

Origem: regra do painel (texto em text/rules.ts desde o commit 758dbb7, 2026-10-22); cenário criado por decisão do usuário, 2026-11-14 ("Cenário por texto (Recomendado)"): o teste confere quando o texto sai e os trechos essenciais; a redação segue livre.
Código: hooks/prompt-submit.ts
Estado: coberto
```

A `Origem:` dos outros nove repete a segunda parte (a decisão de 2026-11-14). `Código:` de cada um: o
arquivo do hook que solta o texto, quando não é o da área (`hooks/tool-call.ts` para os de pergunta,
wrap_up e envio; `hooks/tools.ts` para o do done; `hooks/sessions.ts` para o da sessão).

Selos: `npm run regras:selar -- "task-tree/tests/<arquivo>::<nome>" --tipo novo --motivo "decisão 2026-11-14: um cenário por texto ao modelo"`, um por teste novo.

## 7. Documentação

- `text/rules.ts`, comentário do topo (linhas 6-7): acrescentar que cada texto tem um cenário no
  catálogo que diz quando ele sai.
- `CLAUDE.md`, "Regras de uso do painel": uma linha: "todo texto novo ao modelo entra com um cenário
  que diz quando ele sai e um teste dos trechos essenciais; mudar quando um texto sai é mudança de
  regra (decisão registrada)".
- `DESENVOLVIMENTO.md`, "Textos para o modelo": no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois de todos os lotes de texto desta triagem (15 a 24): os testes daqui travam os textos como
  ficarem (o lote 18 muda `SESSION.ended`; o 24, o lembrete de pedido novo).
- De preferência depois dos lotes de texto das outras triagens (A: 02, 03, 04, 05, 07, 09, 14; B: 01,
  02, 26), para os trechos essenciais já serem os finais. Se entrar antes, cada um desses lotes que
  mudar um trecho conferido aqui ajusta o teste: é mudança de redação (selo `--tipo refatoracao`, sem
  perder asserções), não de quando o texto sai.
- Triagem B, lote 01 (o lembrete "recebimento confirmado" só diz que concluiu quando concluiu) e
  triagem A, lote 10 (o lembrete "terminou o turno" pela tarefa da rodada): mudam **quando** ou **o
  que** dois desses textos dizem; os cenários 8 a 10 daqui devem ser escritos já com o comportamento
  deles, se tiverem entrado.

## 11. Bloqueio

Nenhum.
