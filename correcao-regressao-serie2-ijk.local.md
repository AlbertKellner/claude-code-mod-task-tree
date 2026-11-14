# correcao-regressao · série 2, itens I, J, K — investigação (antes de editar; commit 7 pendente)

2026-10-23. Sonda: estado publicado real da orquestradora (595 KB, 8 filhas), `layout()` direto, código do
working tree (commit 6 + correção do B), escolhas de recolher vazias.

## K — tarefa da mãe concluída aparece em andamento (confirmado)
`rt` "Conferir o clone e retomar a correção": status `done`, sem filhas, `endedAt` gravado. Desenho:
`current 45/50` na tarefa e no pedido. Causa: em `rows()`, `w.busy` (sessão trabalhando embaixo, atWork) vem
antes de `done` no tom, e a contagem soma `w.d/w.n` (tarefas das sessões); em `turnRows`, `busy` e d/n idem.
Plano: um nível 1 concluído (done explícito) fica concluído, e a contagem dele não soma as sessões (o progresso
delas fica no cartão); vale também para o pedido. Abertos mantêm a regra atual (sessões contam e mantêm em
andamento: testes antigos de cadeia/neta). Cabeçalho (45 de 47): soma das linhas desenhadas, regra aprovada,
item E com o usuário — não mexer.

## I — cartões das conversas entre filhas empilhados sob a tarefa da mãe (confirmado)
Sob `rt` (2 mensagens da mãe: correção e governança) há 17 cartões: correção, docs, docs, correção, governança…
Causa: regra das cadeias em `breaks` (peer): a mensagem de uma irmã S para C ganha a âncora da rodada de S (a
tarefa da mãe que mandou a S) e o cartão de C vai para a tarefa da mãe.
Plano (regra do usuário: cada mensagem sob a tarefa QUE A ENVIOU): uma parte de C aberta por mensagem de uma irmã
S vai para DENTRO do cartão de S, sob a tarefa de S que mandou (o envio pendente de S, senão a tarefa de S em
andamento no instante do recebimento); sem tarefa de S achada, fica a regra atual. Na mãe ficam só os cartões
das mensagens da mãe. Atenção: os testes da regra das cadeias (layout.test.ts "cadeia: …", "filha de outra
filha …", "cartão da filha igual ao painel dela > a mensagem de uma irmã abre cartão próprio…") vão mudar.

## J — cartões recolhidos (não reproduzido pelos dados)
Com escolhas vazias, todos abertos nas duas visões. O "···" do print viria do estado `collapsed` do app (não
publicado). Hipótese a testar: alguma chave antiga do estado coincidindo com cartões novos, ou um caminho em que
o cartão aberto desenha vazio (o cartão vira "fechado" quando o painel dele sai vazio). Preciso de um caso que
reproduza; se não houver, registro e sigo.

## J, 2026-10-23 (sobre 594e423)
- Teste-guarda `task-tree/tests/cartoes-resumida.test.ts` (sem commit): nenhum cartão sem linhas embaixo, sem escolhas, nas duas visões. Passa no fixture e no estado publicado atual da orquestradora (sonda probeG): não reproduz.
- Caminhos de código conferidos: `opened(key, true)` (tudo nasce aberto); cartão de parte antiga na resumida cai no último turno da parte (teste "split … as linhas das duas visões"); sessão parada vem aberta (teste "parada com tarefa aberta…").
- O `collapsed` (escolhas) fica só na memória do app: não está no store (`~/.claude/plugins/store`) nem nos logs; o `debug` das presses vai para `$.ui.log` de depuração, não gravado.
- Falta saber: qual cartão, visão, desktop ou terminal, se mostra ⋯/▸ (dobra fechada) ou só o cabeçalho sem linhas.
- Print do usuário (resumida, desktop, ~03:2x, código do commit 6/7): ~14 cartões "nome ⋯" (dobra fechada) sob "Conferir o clone e retomar a correção": as partes das conversas entre irmãs (docs/governança/correção). Sem escolhas, o código só fecha uma dobra com `fl[key] === true`; a sonda com o estado real de agora (contando também dobras fechadas) não dá nenhum. Tratado junto com o I (os cartões das conversas vão para dentro do cartão da remetente); teste-guarda endurecido.
