# correcao-regressao · bug 1 da fase 3 — chip "em andamento" contava a tarefa ✉ de uma filha

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Correção autorizada pelo usuário ("Todos os
bugs que você encontrar durante a fase 3, pode corrigir antes de abrir o Pull Request"). Branch
`refactor/fase-3-layout`, sobre `185a76e` (etapa 4). 2026-10-22.

## O bug

O chip "N em andamento" do cabeçalho conta as folhas abertas das linhas desenhadas, menos as tarefas
com mensagem na fila. A exclusão usava só `sentIds`, os `anchor` das mensagens na fila **desta**
sessão. A tarefa de um cartão de filha que espera outra sessão (✉, tom `sent`, vinda do `sends`
publicado pela filha) ficava como folha aberta e entrava no "em andamento", embora já contasse em
"aguardando sessão". Revelado pelo teste `layout.test.ts` ("mensagem na fila (✉)…", etapa 3), que
ficou em `KNOWN`.

## A correção

- **`task-tree/hooks/register.tsx`** (`ui.render`, +3): além de `sentIds`, `active` exclui os objetos
  de tarefa das linhas com tom `sent` (`sentTasks = Set(lines.filter(sent).flatMap(nodes))`). Pelo
  objeto, não pelo id: ids se repetem entre sessões (um `1` da filha e um `1` daqui), e os `nodes`
  são os mesmos objetos que `shown` percorre. Uma linha ✉ de folha tem `nodes = [t]`; uma ✉ com
  filhos desenhados tem `nodes = []`, e as folhas abertas dela continuam contando, como antes.
- **`task-tree/tests/layout.test.ts`**: `KNOWN` vazio; o helper `header()` espelha a fórmula nova; o
  teste do ✉ afirma `active === 0` com e sem `sentIds` (as linhas bastam para dizer quem espera).

## O que muda na tela

Só o número do chip "em andamento" quando um **cartão de filha** tem tarefa ✉: deixa de contar essa
tarefa (no cenário do teste, de "1 em andamento, 2 aguardando sessão" para "2 aguardando sessão").
Nenhuma linha, cor ou pixel muda; os goldens não mudam (o fixture real não tem ✉).

## Testes

- **287 pass / 0 fail** (os mesmos 287; só o `TODO` do bug 2 continua impresso). `claude plugin
  validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158) e todo o resto: iguais.

## O que conferir no app

Com uma sessão filha que tenha uma tarefa ✉ (mensagem na fila para outra sessão): o cabeçalho do
painel da mãe não a conta em "em andamento", só em "aguardando sessão".

## Fila

Bug 2 (camada do nome cortado sobre o botão do anel) fica para depois: muda a área clicável; a
orquestradora pergunta ao usuário antes.
