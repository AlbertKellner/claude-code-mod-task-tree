# Ajuste 4: contador x/y de cada linha soma toda a subárvore (com as sessões penduradas)

## Regra (decisão do usuário)
"sessão é filha, é uma forma de acompanhar visualmente o que está sendo feito, ela não contabiliza
como tarefa feita. Chamar uma filha sim, contabiliza, e quando a sessão abre, ela deixa de ser uma
tarefa e passa a ser um encadeamento".
- A tarefa que chama a filha (ex.: "Enviar plano…") conta como 1.
- O cartão da sessão não conta; as folhas da sessão contam (encadeamento).
- O resultado é a regra que o topo já usa: 9 = Enviar ajuste (1) + análise (2) + Enviar plano (1) +
  implementação (4) + Conferir (1).
- Esperado no print 4: "Enviar ajuste…" **3/3**, "Enviar plano…" **5/5**, "Tarefas de outra
  conversa…" **9/9**, topo 9 de 9. O "4/4" que o usuário citou eram só as folhas da sessão; pela
  resposta dele, a chamada também conta.

## Causa
Contador da linha de tarefa (`draw/layout.ts` ~781–782 e `sub`):
```
[ld, ln] = t.children.length > 0 ? count(t.children) : w.any ? count([t]) : [0, 0]
[sd, sn] = [ld + w.d, ln + w.n]
```
`w = atWork(t, …)` (`layout.ts:397–412`) soma as sessões penduradas, mas só as ancoradas em tarefas
**abertas** (`counted = open(t)`, `mine = below.filter(c => counted.includes(c.anchor))`). Quando a
tarefa (ou a neta onde a sessão está ancorada) fecha, `w.d/w.n` zeram e sobra só a contagem das
tarefas da principal: daí 1/1 e 3/3. A linha de pedido (`turnRows`, ~838) soma os mesmos `w` e tem o
mesmo defeito.

O topo usa outro caminho: `count(shown)` sobre `Row.nodes`, que inclui `w.cards`, ou seja, todas as
sessões, abertas ou fechadas. Por isso dá 9.

## Plano
1. Em `atWork`, separar o que serve ao estado do que serve à contagem:
   - manter `mine` (sessões sob tarefas abertas) para `busy`/tom;
   - contar `d`/`n` com **todas** as sessões ancoradas na subárvore (`below`), não arquivadas ou
     arquivadas, do mesmo jeito que `w.cards`/topo (`total(panelOf(c), level+1)` já devolve folhas
     da sessão e das sessões dela até `DEEP`). Conferir se `total` e o topo tratam arquivadas e
     interrompidas igual (interrompidas fora do total).
2. Linha de tarefa: manter `count(t.children)` ou `count([t])` para as tarefas da principal; com a
   soma do passo 1, "Enviar plano" (folha + sessão) fica 1 + 4 = 5/5. Mostrar `sub` sempre que
   `w.any` (já mostra).
3. Linha de pedido (`turnRows`): herda pelo `work` corrigido (soma `ws`).
4. Cartões de sessão: o x/y da primeira tarefa do cartão já conta só as tarefas daquela sessão; se
   houver sessão neta pendurada numa tarefa do cartão, o passo 1 também vale (mesma `atWork` com
   `level + 1`).
5. Coerência: a linha de nível 1 deve bater com o topo quando a visão mostra um só pedido
   (9 = 9). Conferir também a visão completa (o topo soma por `Row.nodes`) e as linhas recolhidas.
6. Tempos (`timeOf`, `w.tasks`) não mudam: `w.tasks` continua só das sessões abertas, para não
   alterar relógio/tom. Mudar apenas `d`/`n`.
7. Sem testes nem docs (memória do projeto). Validar a recarga do mod e fazer a validação visual
   com o cenário do print 4.
