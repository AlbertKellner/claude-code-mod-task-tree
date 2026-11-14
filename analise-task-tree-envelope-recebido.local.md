# Envelope recebido na sessão destino, com as tarefas derivadas como filhas

Pedido: "a sessão de implementacao tem a carta enviando mensagem para governança, a sessão de
governança precisa mostrar tambem a carta como recebida, e as tarefas partem como subtarefas da
tarefa de recebimento da mensagem, elas derivam da mensagem" (print 32: no cartão da implementação,
"Avisar a Governança do commit do envelope" ✉ verde "entregue"; no cartão da governança logo abaixo,
"Push e PR da serie-11" como tarefa comum).

Implementação na série 12, depois do merge do PR #23.

## Decisões do usuário
- **Linha de recebimento desenhada** (não uma tarefa de verdade): o pedido aberto por uma mensagem de
  outra sessão vira uma linha ✉ "recebida", e as tarefas planejadas nesse turno aparecem como filhas
  dela, recuadas. Não depende da sessão destino colaborar; não entra em contagem.
- Cor do ✉ recebido: **azul enquanto trata, verde ao concluir** (acompanha o trabalho derivado).
- Título: **remetente + 1ª linha** ("De implementacao-task-tree: Commit 8eb801c pronto para push e
  PR…"), cortado no fim da largura.

## O que já existe
- `hooks/prompt-submit.ts`: `said(text)` reconhece a mensagem de outra sessão
  (`<cross-session-message … from="local_…" name="…">`, `peer`) e tira o corpo (`title`); chama
  `openTurn($, it.title, !it.peer)` (`hooks/panel.ts:90–108`), que abre um **turno** no grupo
  principal com o título (60 caracteres) e `own` só quando é o usuário. `noteReceived`
  (`hooks/sessions.ts:84`) guarda `{from, at}` em `received` (as últimas 20), publicado para o
  remetente confirmar a entrega.
- O `plan` (`hooks/tools.ts:59–98`) põe as tarefas de nível 1 do grupo principal no turno aberto
  agora (`turn` = id do último turno).
- Na própria sessão, o turno é desenhado como linha de pedido (`turnRows`, `draw/layout.ts:961`)
  com as tarefas de nível 1 embaixo. No cartão dela na mãe, o painel é cortado por rodada
  (`split`, linha 256) e o cartão mostra as tarefas da rodada **sem** a linha do pedido.

## Plano
1. **Turno sabe que veio de mensagem** (`types/index.d.ts` `Turn`): campos novos
   `from?: { id: string; name?: string }` (o `from` e o `name` da tag) e `msg?: true`.
   `said` passa a extrair também `from` e `name` (atributo `name="…"`, o título da sessão
   remetente); `openTurn` grava `from` e `msg: true` quando `peer`. Título do turno: só a 1ª linha
   do corpo (sem tags), como hoje; o "De …:" é do desenho (passo 3).
   - Várias mensagens na mesma entrega (duas tags no mesmo prompt): o turno guarda o primeiro
     remetente e o título da primeira; as demais vão para o tooltip. (Mensagens na fila chegam uma
     por turno, cada uma com a sua linha.)
   - Mensagem durante um turno em andamento: o app a entrega como turno novo quando o atual
     termina; nada de especial.
   - Prompt do usuário: sem `from`, como hoje (linha de pedido comum, sem ✉).
2. **Estado da linha recebida** (`draw/layout.ts`): para um turno com `msg`:
   - **azul** enquanto há tarefa aberta no turno ou a sessão está trabalhando nele (o turno é o
     último e `!turnEnded`); **verde** quando tudo do turno está concluído; **cinza** se o turno
     foi interrompido (tarefas ✕, `turnAborted`).
   - Sem contagem própria: a linha não entra em `count()` (como as de mensagem enviada); o x/y e a
     barra dela são os das tarefas filhas (como a linha de pedido hoje).
3. **Desenho**:
   - No painel da própria sessão: a linha do pedido de um turno `msg` usa o ícone ✉ na cor do
     estado (o `envelope(x, y, cls)` do 8eb801c: `bl` azul, `gr` verde, `gy` cinza) e o título
     `De <name>: <título>` (`name` do remetente; sem nome, o id curto).
   - **No cartão dela na mãe**: a rodada de um turno `msg` passa a desenhar essa linha de
     recebimento no topo do cartão (abaixo do cabeçalho com nome/repo/branch), com as tarefas da
     rodada recuadas um nível como filhas dela. Precisa que o painel publicado leve `turns` com
     `from`/`msg` (já publica `groups` com `turns`) e que `split`/o desenho do cartão use o turno da
     rodada para essa linha.
   - Palavra apagada à direita, como no envelope enviado: "recebida" (azul) / "concluída" (verde) /
     "interrompida" (cinza).
4. **Ligação com o envio do remetente**: visual não é necessária — o cartão da destino já fica
   pendurado na tarefa ✉ do remetente na mãe (rodada pela âncora do envio). No tooltip da linha
   recebida, citar a tarefa de envio do remetente quando o painel dele tiver um `send` com o mesmo
   horário (opcional).
5. **Regras** (`text/rules.ts`): nada a mudar; a destino não precisa fazer nada.
6. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual: a
   implementação manda mensagem à governança; no cartão da governança aparece "✉ De
   implementacao-task-tree: …" azul com "Push e PR da serie-11" recuada embaixo; ao concluir, ✉
   verde; no painel da própria governança, o pedido aparece com o ✉. Duas mensagens seguidas: duas
   linhas recebidas, cada uma com as suas tarefas. Prompt do usuário na governança: pedido comum.

## AJUSTE (print 33): o ✉ vai na própria tarefa de nível 1, sem linha extra
Palavras do usuário: "nesse caso, o icone do 'analisar a tarefa', deveria ser uma carta tambem". No
print, no cartão analise-task-tree, a tarefa de nível 1 "Analisar a tarefa de pergunta" (criada ao
tratar uma mensagem da principal) aparece com o ícone comum (◷).

O plano acima previa uma **linha extra** de recebimento ("✉ De X: …") no topo da rodada, com as
tarefas recuadas embaixo, e deixava as tarefas de nível 1 com o ícone comum. **Isso muda:**
1. **Sem linha extra.** As **tarefas de nível 1 de um turno aberto por mensagem** (`turn.msg`) é que
   mostram o ✉ de recebida no lugar do ícone de progresso; as subtarefas delas seguem com os ícones
   comuns (○/◉/✓/✕), sem recuo novo. Vale no painel da própria sessão e no cartão dela na mãe.
2. **Cor** pelo estado da própria tarefa de nível 1: **azul** enquanto aberta (pendente ou em
   andamento, inclusive ◷); **verde** quando concluída; **cinza** quando interrompida/descartada.
   Na troca de estado, o mesmo pulo dos outros ícones.
3. **Vários níveis 1 no mesmo turno**: todos derivam da mesma mensagem, então **cada um** mostra o
   ✉, cada um com a cor do seu estado.
4. **Remetente e mensagem**: no tooltip/alt da linha ("Mensagem de implementacao-task-tree: <1ª
   linha>"); na própria sessão, a linha do pedido (turno) segue com o título da mensagem, como hoje.
   Sem palavra à direita (a linha já tem barra, x/y e tempo).
5. **Contagem**: estas são tarefas de execução — **contam normalmente** (diferente da tarefa de
   envio, que fica fora). Só o ícone muda.
6. Dados: os mesmos do plano (`Turn.from`, `Turn.msg`, gravados em `openTurn` a partir do `said`,
   publicados com os `turns`); o desenho só olha o `turn` da tarefa de nível 1.
