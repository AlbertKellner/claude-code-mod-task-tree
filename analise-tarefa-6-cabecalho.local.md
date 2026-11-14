# Tarefa 6: cabeçalho e visão resumida (análise, sem implementar)

Base: branch `test/regressivos-automacao-testes`, topo `cf88f3d`. Nada foi editado.

## Essencial

- **O harness cobre quase tudo.** O cabeçalho do terminal é texto puro, e o `painel()` do kit já o recebe como linhas:
  - a 1ª linha é `<título>  d de n · p%  <tempo>  <toks/s>  <repo ⑂ branch>  (sessão inteira: a de b)  [≡] ▤`;
  - a 2ª é a barra mais os chips, como glifo e número: `● 1  ○ 3  ◷ 1  ✉ 1  ✕ 2  ◍ 1`, para em andamento, pendentes, aguardando, aguardando sessão, interrompidas e sessões ativas.
- **A troca de visão** sai por `$.command.run({ command: 'task-tree', args: 'resumida' })`. **Recolher uma linha** é apertar o `Button` do ícone dela no desenho montado.
- **Kit:**
  - `cabecalho(linhas)`: lê título, d, n, %, sessão inteira e chips;
  - `visao($, 'resumida' | 'completa')`;
  - `montar($)`, um painel montado que permite `recolher(titulo)` e reler.
- **Testes** em `tests/cabecalho.test.ts`, um arquivo novo, cobrindo:
  - as 5 regras de `regras/cabecalho.md`;
  - `pedidos.resumida-mantem-anteriores-com-algo-aberto`;
  - 2 regras novas que o código já cumpre, com as palavras do usuário: a resumida limpa só quando tudo à vista está concluído, e os chips contam só folhas.
- **Origens "a confirmar" resolvidas pelo git:**
  - `4edb3f2` (2026-10-21): limites "+N";
  - `16062cc` (2026-10-23) e o histórico: título "o título é o do passo iniciado por último";
  - `465b09e`: interrompida fora do total, desde a entrada do mod, reafirmada pelo usuário em 2026-10-24;
  - `6599050` e `897c0d7`: resumida.
- **Checklist do app:** a barra e os chips desenhados no desktop (SVG), o tempo andando de verdade, o clique nos botões ≡/▤ e o tooltip "sessão inteira".
- **Sem dúvidas para o usuário.** Nenhuma regra observada contradiz decisão dele.

## 1. Como o cabeçalho e a resumida são feitos (código)

**Cabeçalho** (`hooks/render.tsx` ~l. 336–440):
- `lines = layout(model, …)`. O cabeçalho conta `shown = lines.flatMap(r => r.nodes)`: **o que a visão desenha**. Uma linha recolhida leva o que está embaixo (`nodes`), então recolher não muda os números.
- `[d, n, x] = count(shown)` (`draw/layout.ts:87`): só folhas; tarefas de mensagem fora; interrompida (`x`) fora de `n`, no chip.
- **Chips** (`svg.ts:576`, `chips`):
  - em andamento: folhas iniciadas, abertas, sem fim;
  - pendentes: folhas abertas não iniciadas;
  - aguardando: avisos de espera mais folhas `leftWaiting`;
  - aguardando sessão: linhas `sent`;
  - interrompidas: `x`;
  - sessões ativas: linhas de cartão vivas.
- **Título:** o nível 1 que contém a âncora de `current()` (a tarefa iniciada por último ainda aberta); sem nada em andamento, o nível 1 da `startedLast` (concluída ou não); senão, o último nível 1 com sessão viva embaixo; senão, o nível 1 mais novo; sem nenhum, "Tarefas".
- `whole`: "sessão inteira: a de b" quando a visão não mostra tudo.
- **Terminal:** `Nenhuma tarefa planejada.` quando `n + x === 0`.

**Visões** (`draw/layout.ts:1289–1301`):
- **completa:** o painel inteiro, com cortes:
  - só os 3 últimos pedidos (`SHOWN_TURNS`), mais os que ainda têm algo aberto ou sessão viva; os outros viram "+N pedidos anteriores" (l. 1211–1218);
  - cartões sem tarefa de origem, parados e antigos viram "+N cartões antigos de sessões" (l. 1279–1287);
  - mais de `MAX_ROWS` = 400 linhas: `limitRows`, com "+N linhas anteriores/seguintes".
- **resumida:** `trimToWork` do painel pelo `work`:
  - `startsWork`/`joinWork`/`openInSight` em `hooks/panel.ts:505–560`;
  - um `plan`/`start` numa mensagem nova começa trabalho novo;
  - com algo aberto à vista (tarefa, ✉, cartão com tarefa aberta), o trabalho anterior fica inteiro e o novo entra embaixo;
  - só com tudo à vista concluído o painel é limpo;
  - nunca move cartão.

## 2. Regras (`regras/cabecalho.md` e afins)

| id | Confere | Origem (resolvida) | Estado |
|---|---|---|---|
| `cabecalho.numeros-somam-o-desenhado` | sim (`shown` = `nodes`) | decisão do usuário, 2026-10-23: "deve somar as tarefas que estão sendo mostradas na listagem. a visão resumida mostra somente informacoes dessa visao" e "as colapsada, mas que estao nessa visao, tambem entram"; `3e79cb8` | coberto |
| `cabecalho.resumida-exclui-pedido-finalizado` | sim (`trimToWork`) | decisão do usuário, 2026-10-22: "segundo a regra antiga, na visão resumida, ficam somente as tarefas novas do turno"; `6599050` | coberto (reescrever o Dado/Quando/Então: o pedido finalizado de turno anterior sai da resumida e dos números dela quando um pedido novo começa trabalho; a completa o mantém e conta) |
| `cabecalho.interrompida-fora-do-total` | sim (`count`) | regra do painel desde a entrada do mod (`465b09e`, "Interrupted tasks are kept out of the done/total count"); reafirmada pelo usuário em 2026-10-24 ("interrompida fora do total, 3/5 → 3/3") | coberto |
| `cabecalho.limites-de-linhas` | sim | commit `4edb3f2`, 2026-10-21 (o desenho de 1,6 MB que o app parou de mostrar) | coberto para "+N pedidos anteriores"; "+N cartões antigos" e as 400 linhas conforme a seção 4 |
| `cabecalho.titulo-e-a-ultima-iniciada` | sim | decisão do usuário: "o título é o do passo iniciado por último" (histórico, 2026-10-23); `16062cc` e a correção de desempenho da fase 6 | coberto (reescrever o Então: o título é o **nível 1** que contém essa tarefa) |
| `pedidos.resumida-mantem-anteriores-com-algo-aberto` | sim (`openInSight`) | decisão do usuário, 2026-10-23 (ver a regra nova abaixo); `897c0d7` | coberto |

Regras novas (o código já faz; vêm de pedidos do usuário):
- **`cabecalho.resumida-limpa-so-com-tudo-concluido`:**
  - Dado o trabalho de um pedido anterior **todo concluído**;
  - Quando um pedido novo começa trabalho;
  - Então a resumida mostra só o pedido novo.
  - Origem: decisão do usuário: "somente limpe os itens quando todos estiverem concluidos e quando iniciarem novas tarefas" (histórico de `work`); `897c0d7`.
  - É o par de `pedidos.resumida-mantem-anteriores-com-algo-aberto`.
- **`cabecalho.chips-contam-folhas`:**
  - Dado tarefas com filhas, tarefas de mensagem e folhas em cada estado;
  - Quando o cabeçalho é desenhado;
  - Então os chips contam só folhas, nunca pais nem tarefas de mensagem: em andamento (iniciadas), pendentes (não iniciadas), aguardando (◷ e avisos), interrompidas.
  - Origem: regra do painel; comentário de `render.tsx` "Open leaves only, a parent never"; "Message tasks are not work" (decisão do usuário, 2026-10-24: "quero diferenciar as tarefas de execução, das tarefas de mensagem"; `8eb801c`).
- **`visual.cabecalho-barra-e-chips-desenhados`** (checklist): a barra, os chips em ícone e cor e o tooltip "sessão inteira" no desktop.

## 3. Kit (selo do kit regravado, tipo `refatoracao`, motivo "leitura do cabeçalho e visões")

`tests/kit/leitura.ts`:
```ts
export type Cabecalho = {
  titulo: string; feitas: number; total: number; pct: number
  inteira?: { feitas: number; total: number }       // "sessão inteira: a de b"
  chips: { andamento: number; pendentes: number; aguardando: number; sessao: number; interrompidas: number; ativas: number }
  vazio: boolean                                    // "Nenhuma tarefa planejada."
}
// O cabeçalho a partir das linhas do painel (as duas primeiras: título e barra).
export function cabecalho(linhas: Linha[]): Cabecalho
```
- Glifos dos chips: `●` em andamento, `○` pendentes, `◷` aguardando, `✉` sessão, `✕` interrompidas, `◍` ativas; ausente = 0.
- Regex na 1ª linha: `/^(.*?)  (\d+) de (\d+) · (\d+)%/` e `/sessão inteira: (\d+) de (\d+)/`.
- A 2ª linha: `/([●○◷✉✕◍]) (\d+)/g`.
- As linhas do cabeçalho passam a ser marcadas `cabecalho: true` em `Linha`, para que `linha()`/`emTexto` sigam funcionando sem confusão.

`tests/kit/leitura.ts` (montagem):
```ts
// O painel montado, para agir nele (recolher uma linha) e reler sem remontar.
export async function montar($: any, opcoes?: { colunas?: number }): Promise<{
  linhas(): Promise<Linha[]>
  recolher(titulo: string): Promise<void>   // aperta o Button do ícone da linha com esse título
  fim(): Promise<void>
}>
```
- `recolher` acha, no `drawn()`, o elemento da linha com aquele título, pega o `key` do `Button` do ícone dela e chama `ui.press({ key })`. É o único lugar que sabe disso.
- O `painel()` atual vira `montar` + `linhas` + `fim`, sem mudar o resultado para os testes existentes.

`tests/kit/cenario.ts`:
```ts
// Troca a visão, como /task-tree resumida | completa.
export const visao = ($: any, v: 'resumida' | 'completa') => $.command.run({ command: 'task-tree', args: v })
```
O `commandRun` chama `$.ui.open` e `$.ui.panes` dentro de `try`. Se o kit reclamar do evento, stub em `fixar`: `on('ui.open', () => ({ value: { isPlaced: true } }))`, `on('ui.panes', () => ({ value: [] }))`.

## 4. Testes (`tests/cabecalho.test.ts`)

Planos: A › {Um, Dois › {Dois.um, Dois.dois}}; B › {b1, b2}.

1. **Os números somam o que a visão desenha, e recolher não muda nada** (`cabecalho.numeros-somam-o-desenhado`):
   - `pedido`, `plan(A)`, `start 1`, `done 1` → cabeçalho 1 de 3;
   - `montar`, `recolher('Dois')`, depois `recolher('Plano A')` e `recolher('Pedido um')` → segue 1 de 3 a cada passo;
   - o mesmo na resumida.
2. **O pedido finalizado sai da resumida quando um pedido novo começa trabalho; a completa o mantém** (`cabecalho.resumida-exclui-pedido-finalizado`, `cabecalho.resumida-limpa-so-com-tudo-concluido`):
   - P1 com A todo concluído; `fimDoTurno`; `pedido('Pedido dois')`; `plan(B)`; `start b1`;
   - completa: as linhas "Plano A" e "Plano B" existem e o cabeçalho dá 3 de 5;
   - `visao('resumida')`: sem "Plano A", o cabeçalho dá 0 de 2 e mostra "sessão inteira: 3 de 5".
3. **Com algo aberto à vista, a resumida mantém o pedido anterior** (`pedidos.resumida-mantem-anteriores-com-algo-aberto`): P1 com "Um" ✓ e o resto aberto; `fimDoTurno`; P2 com `plan(B)` e `start b1`; resumida → "Plano A" e "Plano B" aparecem, e os números contam os dois.
4. **A interrompida sai do total e entra no chip** (`cabecalho.interrompida-fora-do-total`):
   - `plan(A)`, `start 1`, `fimDoTurno`;
   - `pedido` novo e `plan` com o mesmo id A (o anterior fica ✕, renomeado);
   - no cabeçalho da completa, `interrompidas` igual ao número de folhas ✕ do A antigo e o total sem elas.
5. **Os chips contam só folhas, nunca pais nem tarefas de mensagem** (`cabecalho.chips-contam-folhas`):
   - `start 2.1` → `andamento` 1 e `pendentes` 2 (Um, Dois.dois); o pai "Dois" não entra;
   - com o `host`/`responderEnvio` da tarefa 4: `envio` a partir de 2.1 (fila) → `andamento` 0, `sessao` 1, e a tarefa de mensagem fora de `pendentes`.
6. **O título é o nível 1 da tarefa iniciada por último** (`cabecalho.titulo-e-a-ultima-iniciada`): `plan(A)` e `plan(B)` no mesmo pedido; `start b1`, `done b1`, `start 1`, `done 1` → título "Plano A"; `start b2` → "Plano B".
7. **Só os três últimos pedidos aparecem na completa; os outros viram "+N pedidos anteriores"** (`cabecalho.limites-de-linhas`):
   - 5 pedidos (`pedido` + `plan` com um nível 1 de uma folha, `start` + `done`, `fimDoTurno`, `advance`);
   - completa → a linha "+2 pedidos anteriores" existe, os dois mais antigos não aparecem, e o cabeçalho segue contando os cinco (5 de 5).
   - Se um dos antigos tiver tarefa aberta, ele aparece (não é cortado).
8. **(Opcional)** "+N cartões antigos de sessões": exige 4 pedidos e um cartão sem âncora e parado (`host` com uma filha sem `start_session` correspondente). Se o arranjo ficar frágil, fica `pendente`.
9. **(Opcional)** o corte de 400 linhas (`limitRows`): um plano com mais de 400 linhas pode estourar os 5 s. Tentar com `{ timeoutMs: 15000 }`; se não couber, `checklist` com o motivo.

As asserções usam o `cabecalho()` (números, chips e título), a presença e ausência de linhas por título e a palavra "+N pedidos anteriores". Nenhum nome de função nem chave interna.

## 5. Checklist do app

- A barra de progresso e os chips em ícone e cor no desktop (SVG do cabeçalho em cartão).
- O tempo do cabeçalho correndo de verdade e parando quando nada roda.
- Os botões ≡/▤ (clique e realce do escolhido) e o tooltip "sessão inteira".
- O desenho grande (mais de 400 linhas), se o teste 9 não couber.

## 6. Riscos

- **Selo do kit:** `leitura.ts` e `cenario.ts` mudam; selar `--kit … --tipo refatoracao`. O `painel()` reimplementado sobre `montar` precisa devolver exatamente o mesmo para os testes existentes. A etapa `regressao` e os testes atuais passando são a prova.
- **`recolher` depende do `key` do `Button` no desenho.** Ele lê o `key` do próprio desenho, sem nome fixo no teste. Se o desenho mudar, quebra só no kit.
- **O formato do texto do cabeçalho** (`d de n · p%`, glifos dos chips) passa a ser lido pelo kit. Uma mudança visual intencional nele exige mudar o kit, com selo `refatoracao` ou `decisao`, conforme o caso.
- **Recarga do clone:** nenhum arquivo do mod muda; só `tests/` e `regras/`. Escrever tudo de uma vez.
- **Comportamento divergente:** não ajustar; o cenário fica `pendente` com o motivo, e o caso é relatado.

## 7. Brief para a Implementação

Na branch `test/regressivos-automacao-testes`, depois de `cf88f3d`. Um commit local. Sem push.

1. `tests/kit/leitura.ts`: `Cabecalho`, `cabecalho(linhas)`, `cabecalho: true` nas linhas do cabeçalho, e `montar($)` com `linhas`, `recolher` e `fim`; `painel()` sobre `montar`, com o mesmo resultado.
2. `tests/kit/cenario.ts`: `visao($, v)`. Stubs de `ui.open`/`ui.panes` em `fixar` só se o kit pedir.
3. `tests/cabecalho.test.ts` (novo): os testes 1–7 da seção 4; os 8 e 9 se couberem, senão o cenário vai a `pendente`/`checklist` com o motivo.
4. `regras/cabecalho.md`:
   - as 5 regras → `coberto`, com as origens da tabela;
   - reescrever o Dado/Quando/Então de `resumida-exclui-pedido-finalizado` e de `titulo-e-a-ultima-iniciada` (o texto, não a regra);
   - novas: `cabecalho.resumida-limpa-so-com-tudo-concluido` e `cabecalho.chips-contam-folhas`.
5. `regras/pedidos.md`: `pedidos.resumida-mantem-anteriores-com-algo-aberto` → `coberto`.
6. `regras/visual.md`: `visual.cabecalho-barra-e-chips-desenhados` (checklist).
7. Selar: os testes novos (`--tipo novo`) e o kit (`--kit tests/kit/leitura.ts` e `tests/kit/cenario.ts`, `--tipo refatoracao`, motivo "leitura do cabeçalho e visões").
8. `npm run check` verde; o relato traz `npm run testes:alterados` (deve dizer que nenhum teste existente mudou).

Commit: `test(task-tree): cabeçalho e visão resumida (números da visão, recolhidos, interrompida fora do total, chips, título, limites)`.

O usuário valida lendo `tests/cabecalho.test.ts` e `regras/cabecalho.md` (as origens nas palavras dele) e, no app, os itens da seção 5.
