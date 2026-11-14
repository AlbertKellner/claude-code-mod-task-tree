# Lote 26: a ferramenta antiga de mensagem acompanhada como o `SendMessage`

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

**BLOQUEADO até um ensaio no app** (seção 11). O plano está escrito para os dois resultados possíveis do
ensaio; o implementador só começa com o resultado em mãos.

## 1. O que cobre

Correção direta, com dois pontos a conferir no app antes: "Mensagem enviada pela ferramenta antiga do app
(`mcp__ccd_session_mgmt__send_message`) não gera carta nem rodada". Regra do projeto que a pede: "Painel
errado é bug do plugin: corrige-se o plugin, nunca o jeito de usar" (não basta dizer ao modelo para usar
a outra ferramenta).

## 2. Causa confirmada na ponta

- `hooks/tool-call.ts:104`: `sentMessage` só trata a chamada cujo nome é exatamente `SendMessage`; e
  `:232` só marca o instante do envio (`sentAt`) para esse nome.
- A ferramenta antiga segue chamável nesta instalação: os tipos gerados do app
  (`.claude-plugin/types/claude-code-mcp/index.d.ts`, por volta da linha 292) dizem "this older tool
  stays callable for now", com os campos `session_id` (id, nome curto ou "parent") e `message`.
- Efeito: a mensagem enviada por ela não mostra carta sob a tarefa, não é acompanhada (sem aviso de
  fila, sem conclusão na entrega), e o cartão do turno que ela abre na sessão destino é posto por
  palpite (`unsent`, `draw/layout.ts:231-253`).

Escrito no código. O que o código não mostra (e por isso o bloqueio):

- (a) o texto do resultado da ferramenta antiga, contra as expressões que decidem fila ou entrega
  (`hooks/tool-call.ts:141` e `:148`: "queued", "held", "pending", "turn has started", `success: false`);
- (b) como a mensagem chega na sessão destino. O tipo diz "a user turn labelled From …"; o recibo só é
  publicado para a marca `<cross-session-message from="local_…">` (`hooks/sessions.ts:93-100`). Sem
  recibo, uma carta dada como "na fila" ficaria azul para sempre, porque a sessão destino desta versão
  publica `received` e o casamento passa a depender só dele (`hooks/sessions.ts:134-149`);
- (c) o que "parent" vira: o mod não guarda quem abriu a sessão.

## 3. O que muda

Comum aos dois resultados do ensaio (`hooks/tool-call.ts`):

- `sentMessage` passa a tratar também a chamada de nome `mcp__ccd_session_mgmt__send_message`: o destino
  vem de `session_id` (no evento ou em `input`), o texto de `message`; `sentAt` é marcado para ela
  também. A tarefa do envio (`sendAnchor`), a rodada da sessão destino e o registro do envio (a carta
  "Para <sessão>: …") são feitos como no `SendMessage`. A ferramenta antiga só fala com sessões: a busca
  de subagente (`subagentOf`) não se aplica.
- O destino é nome de sessão para o casamento "pelo nome" (lote 03).
- `text/rules.ts`, `RULES`: na frase da carta, "(SendMessage)" vira "(SendMessage, ou a ferramenta antiga
  do app, mcp__ccd_session_mgmt__send_message)".

Variante A (o ensaio mostra que o resultado usa as mesmas palavras de fila e de entrega, e que a
mensagem chega com a marca `<cross-session-message from="local_…">`): nada mais. A entrega é conferida
pelo recibo, como hoje.

Variante B (o resultado tem outras palavras, ou a mensagem chega sem a marca):

- As palavras do resultado da ferramenta antiga que significam "na fila", "entregue" e "falhou" entram
  nas expressões (as que o ensaio mostrar; colar o texto exato no comentário).
- Se a chegada não tem a marca: o envio feito pela ferramenta antiga é gravado com uma marca própria
  (campo opcional novo em `Send`, `types/index.d.ts`), e `watchSends` (`hooks/sessions.ts`) confirma esse
  envio pelo caminho que já existe para sessões sem `received`: um turno da sessão destino aberto depois
  do envio (`:150-157`), em vez do recibo. Assim a carta não fica azul para sempre.
- `noteReceived`, se o ensaio mostrar um formato estável do "From …" com o id de quem enviou: passa a
  reconhecê-lo também, para a sessão destino publicar o recibo (aí a marca do envio deixa de ser
  necessária para destinos desta versão). Sem id no formato, não.

"parent" (qualquer variante): o destino não pode ser acompanhado (não há id). A carta é gravada como
entregue na hora (verde, sem acompanhamento e sem aviso de fila), com o destino que veio ("parent"). Se o
ensaio mostrar que o resultado da ferramenta devolve o id da sessão mãe, usar esse id como destino e
tratar como qualquer outro.

No painel: a mensagem enviada pela ferramenta antiga mostra a carta sob a tarefa em andamento, azul na
fila e verde na entrega, a tarefa conclui na entrega e o modelo recebe os mesmos avisos; o cartão do
turno que ela abre na filha vai sob a tarefa do envio.

## 4. Impacto

`npm run impacto -- task-tree/hooks/tool-call.ts task-tree/text/rules.ts` (variante A): 28 cenários de
`hooks/tool-call.ts` (envios, perguntas, parte de subagentes) e os de lembretes. Na variante B entram
`hooks/sessions.ts` e `types/index.d.ts` (núcleo: todos). Golden: nenhum cenário muda.

## 5. Testes

Novos, em `tests/envios.test.ts`. A ferramenta antiga é chamada com `ferramenta($,
'mcp__ccd_session_mgmt__send_message', { session_id: 'local_x', message: 'oi' })`, com um stub do teste
(`on('tool.call', { tool: 'mcp__ccd_session_mgmt__send_message' }, …)`) que devolve o texto de resultado
que o ensaio mostrou (colado no teste, na fila e na entrega). Nenhuma mudança no kit.

1. "a mensagem enviada pela ferramenta antiga do app mostra a carta sob a tarefa e avisa da fila".
   Cenário novo `envios.ferramenta-antiga-como-o-sendmessage`. Roteiro: host com `local_x`; pedido; plan;
   start; a chamada (resultado de fila). Afirma: a carta na fila sob a tarefa; o chip "aguardando sessão"
   em 1; o contexto do resultado com o aviso de fila. Falha hoje: nenhuma carta.
2. "a entrega da mensagem enviada pela ferramenta antiga deixa a carta verde e conclui a tarefa". Mesmo
   cenário. Roteiro: o anterior e a entrega: na variante A, `h.recebeu('local_x', AGORA)` e `aviso`; na
   variante B, a filha passa a publicar um turno aberto depois do envio (`painel.turns` com `at` maior
   que o envio) e `aviso`. Afirma: carta entregue, tarefa concluída, "recebimento confirmado". Falha
   hoje.
3. "com entrega imediata pela ferramenta antiga, a carta fica verde na hora e a tarefa segue em
   andamento". Mesmo cenário e `envios.entrega-imediata-fica-verde`. Roteiro: resultado de entrega.
   Afirma como o teste vizinho do `SendMessage` (`:193-214`). Falha hoje.
4. "para 'parent', a carta aparece entregue, sem acompanhamento". Mesmo cenário. Afirma: a carta verde
   sob a tarefa, o chip "aguardando sessão" em 0 e nenhum aviso de fila.

Testes existentes: nenhum muda.

## 6. Catálogo e selos

`regras/envios.md`, cenário novo:

- `### envios.ferramenta-antiga-como-o-sendmessage`
- Título: "A mensagem enviada pela ferramenta antiga do app é acompanhada como a do SendMessage."
- Dado uma tarefa em andamento
- Quando o modelo manda uma mensagem a outra sessão pela ferramenta antiga do app
  (`mcp__ccd_session_mgmt__send_message`)
- Então a carta aparece sob a tarefa, azul na fila e verde na entrega, a tarefa conclui na entrega e o
  modelo é avisado, como no SendMessage; para "parent", que não pode ser acompanhado, a carta aparece
  entregue
- `Origem: auditoria 2026-11-10 (a ferramenta antiga não gerava carta nem rodada); regra do projeto
  "painel errado é bug do plugin"; formato do resultado e da chegada conferidos no app em <data do
  ensaio>.`
- `Código: text/rules.ts` (na variante B: `hooks/sessions.ts, text/rules.ts`)
- `Estado: coberto`

Selos (`novo`) para os quatro testes, motivo "a ferramenta antiga de mensagem é acompanhada como o
SendMessage". Forma:

    npm run regras:selar -- "task-tree/tests/envios.test.ts::a mensagem enviada pela ferramenta antiga do app mostra a carta sob a tarefa e avisa da fila" --tipo novo --motivo "a ferramenta antiga de mensagem é acompanhada como o SendMessage"

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Fluxo de dados" (o envio) e em "O que só é verificável no app", a ferramenta
antiga, o texto do resultado e o formato de chegada que o ensaio mostrou. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Depois do commit: uma mensagem real pela ferramenta antiga a uma filha ocupada (carta azul, depois verde,
tarefa concluída) e a uma filha parada (verde na hora).

## 10. Dependências e conflitos

- Depois dos lotes 01, 02 e 03 (a tarefa do envio), 07 (a conclusão na entrega) e 10 (os recibos). É o
  último lote da triagem B.
- Triagem A, decisão 13 ("Sim, o plan adota"): a carta criada antes do plan do pedido; a da ferramenta
  antiga entra pelo mesmo caminho de `sentMessage`, então segue o que A fizer.
- Triagem C, decisão 42 ("Cenário por texto"): a frase das regras muda aqui.

## 11. Bloqueio

O lote inteiro espera um ensaio no app, que o planejador e o implementador não podem fazer (manda uma
mensagem de verdade a outra sessão). Quem faz: a orquestradora, com a autorização do usuário, ou o
próprio usuário. O que anotar, com o texto exato:

1. O resultado de `mcp__ccd_session_mgmt__send_message` para uma sessão ocupada (fila) e para uma sessão
   parada (entrega), e para um destino inexistente (erro).
2. Como a mensagem chega na sessão destino: o texto do prompt (se tem a marca `<cross-session-message
   from="local_…">` ou outro formato, e se o formato traz o id de quem enviou); e se o arquivo publicado
   da sessão destino ganhou uma entrada em `received`.
3. O que `session_id: "parent"` faz, e se o resultado devolve o id da sessão mãe.

Com o resultado: variante A se (1) usa "queued"/"held"/"pending" e "turn has started" como o
`SendMessage` e (2) chega com a marca; senão variante B, com os textos anotados.

Pergunta à orquestradora, se preferir decidir sem o ensaio:

> A ferramenta antiga de mensagem do app não gera carta no painel. Para corrigir com segurança é preciso
> um ensaio no app (uma mensagem real a uma sessão ocupada e a uma parada). Fazer o ensaio agora?
- **Sim, fazer o ensaio e depois implementar (Recomendado).**
- **Não, deixar este lote de fora por enquanto** (a ferramenta nova, `SendMessage`, é a que as regras
  mandam usar).
