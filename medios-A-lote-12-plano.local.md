# Lote 12: leitura das filhas (uma por vez, a recém-aberta mantida, sem cartão fantasma)

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (correções diretas da mesma leitura e dos mesmos arquivos).

## 1. O que cobre

- Achado "Filha recém-aberta perde a tarefa de origem se a primeira leitura do host ainda não a lista, e
  refreshChildren grava `children` sem conferir a versão e pode rodar sobreposto" (dois achados, a mesma
  causa). Correção direta.
- Achado "Envio a sessão que não é filha (irmã, mãe) cria um cartão fantasma "Sessão…"; envio que falha
  ainda grava rodada". Correção direta.
- Fora: "Arquivo da filha ilegível numa leitura" (não confirmado). A higiene das arquivadas é o lote 13.

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/sessions.ts:34-89` (`refreshChildren`): lê a lista do host e os arquivos e depois grava
  `children` com `$.state.set` (`sessions.ts:78-81`), sem `update`. Com a lista vazia zera o state e
  retorna sem publicar (`sessions.ts:59-62`); só publica com `mine.length > 0` (`:87`).
- `io/host.ts:136-171` (`deriveChildren`): os filhos saem só das linhas da lista (`mine.map`); a entrada
  que está no state e a lista não traz é descartada. As ligações voltam de `kept(id)` (a cópia do store,
  `keptLinks`), que só é preenchida em `saveLinks` (`hooks/panel.ts:690-707`).
- `sessions.ts:235-253` (`recordStart`): grava a entrada "Sessão iniciando…" com a tarefa de origem e
  chama `refreshChildren` em seguida, sem salvar as ligações antes.
- `sessions.ts:293`: o relógio de 3 s chama `refreshChildren` sem esperar a execução anterior; há mais
  três chamadores (`recordStart`, `refreshStale`, `hooks/prompt-submit.ts:83`).
- `hooks/tool-call.ts:126-136` (`sentMessage`): todo destino `local_…` que não está entre as filhas ganha
  uma entrada "Sessão…" trabalhando, com a tarefa do envio e a rodada; a filha existente ganha a rodada.
  A falha do envio só é calculada depois (`tool-call.ts:148`).

Dedução:
- a filha recém-aberta que a lista ainda não traz some do state na primeira leitura, e a ligação nunca
  chegou ao store: quando a lista passa a trazê-la, o cartão nasce sem tarefa de origem (vai ao fim e,
  concluído, some);
- duas leituras sobrepostas: a mais antiga grava por último, a filha volta a "rodando", e a leitura
  seguinte gera um segundo lembrete "terminou o turno" para o mesmo fim. Não depende do app;
- a filha manda o sinal à irmã: surge o cartão "Sessão…" sob a tarefa do envio, e a mãe o vê dentro do
  cartão da remetente, contando como sessão ativa, até a próxima publicação da filha;
- o envio que falha para uma filha existente grava a rodada, e o turno seguinte dela vira cartão sob a
  tarefa do envio que falhou.

O gatilho de a lista ainda não trazer a sessão recém-aberta depende do app (não medido); a perda da
ligação nesse caso e a corrida estão no código.

## 3. O que muda

`hooks/sessions.ts`, `io/host.ts`, `hooks/tool-call.ts`.

1. Uma leitura por vez (`refreshChildren`): se já há uma em curso, o pedido novo só marca "rodar de novo"
   e espera a que está em curso; ao terminar, ela roda mais uma vez se a marca existir. Quem chamou
   recebe o resultado da última. Vale para os quatro chamadores. A marca e a execução em curso são
   variáveis do módulo (uma recarga começa do zero).
2. Gravação conferida: o passo 3 deixa de usar `get` e `set`. Compara primeiro (como hoje, para não
   gravar a cada 3 s) e, havendo diferença, grava com `update`, derivando de novo sobre o valor que o
   `update` entrega; os que "acabaram de terminar" saem dessa mesma derivação.
3. A recém-aberta é mantida: a entrada `starting` que a lista ainda não traz fica no state enquanto for
   recente (constante nova, sugestão `STARTING_GRACE = 120_000` ms, contada do `openedAt`); passado o
   prazo sai, como hoje. Vale em `deriveChildren` (que passa a receber a hora) e no ramo da lista vazia.
   Entrada `starting` sem `openedAt` (versão anterior) não tem prazo: sai como hoje.
4. A ligação é guardada antes da primeira leitura: `recordStart` chama `saveLinks` (já exportada de
   `hooks/panel.ts`) logo depois de gravar a entrada e antes de `refreshChildren`. Se a entrada sair do
   state depois do prazo, `kept(id)` devolve a tarefa de origem quando a lista a trouxer.
5. Publicar ao esvaziar: quando a leitura muda `children` (inclusive para vazio), o painel é publicado,
   mesmo com `mine.length === 0`.
6. `sentMessage`:
   - a falha (`r.isError === true` ou `success: false` no resultado) é calculada antes de tudo; com
     falha, `children` não é tocado (nem rodada, nem entrada, nem `lastAnchor`), e segue sem carta;
   - destino entre as filhas (id ou nome): como hoje;
   - destino `local_…` fora das filhas: ler a lista na hora (`refreshChildren`). Se a leitura o trouxe
     como filha, grava como a entrada provisória de hoje gravava: a tarefa do envio como origem, se ela
     não tinha nenhuma, `lastAnchor` e a rodada. Se não trouxe, mas há ligação guardada para o id
     (`keptLink`: uma sessão que esta abriu e a lista deixou de fora), cria a entrada provisória com as
     ligações guardadas e a rodada. Senão (mãe, irmã, qualquer sessão que esta não abriu), **nenhuma
     entrada e nenhuma rodada**: fica só a carta sob a tarefa.

Comportamento novo no painel:
- a filha recém-aberta fica como "Sessão iniciando…" sob a tarefa de origem até a lista do host
  trazê-la, e o cartão dela segue sob a mesma tarefa;
- a mensagem à irmã ou à mãe mostra só a carta ✉; nenhum cartão "Sessão…", nenhuma sessão ativa a mais;
- o envio que falha não deixa rastro: o turno seguinte da filha segue no cartão em que estava;
- um fim de turno de filha gera um lembrete só.

## 4. Impacto

`npm run impacto -- hooks/sessions.ts io/host.ts hooks/tool-call.ts`: `hooks/sessions.ts` 46 cenários
(sessoes 22, envios 17…), `io/host.ts` 29 (sessoes 22, ultracode 5, durabilidade 2), `hooks/tool-call.ts`
28 (envios 17, perguntas 8…). Checklist por mapa: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app`, `ultracode.cor-e-corte`. Golden: nenhum cenário pelo mapa; ver 8.

## 5. Testes a escrever

1. `tests/durabilidade.test.ts`, regra `durabilidade.filha-recem-aberta-ainda-nao-listada` (nova):
   **"a filha recém-aberta que a lista do host ainda não traz segue sob a tarefa de origem quando passa a
   ser listada"**. Roteiro: `fixar`; `const h = host(on, [{ id: K1, nome: 'filha-um', listada: false,
   painel: { tasks: [uma tarefa iniciada "Tarefa da filha"] } }])`; `pedido`; `plan(A)`; `start(['1'])`;
   `abrirSessao`; `aviso` (a lista vem vazia); o painel tem uma linha de sessão sob "Um" (a "Sessão
   iniciando…"); `h.filha(K1).listada = true`; `aviso`.
   Afirma: `cartoes(p, 'filha-um').map(c => c.sob)` igual a `['Um']`.
   Falha hoje: a primeira leitura zera as filhas e a ligação se perde; o cartão aparece solto no fim.
   Repetir no mesmo teste com uma segunda filha já listada (`K2`, aberta antes de outra tarefa), para o
   caminho da lista não vazia: as duas sob as suas tarefas.
2. `tests/envios.test.ts`, regra `sessoes.destino-que-nao-e-filha-nao-vira-cartao` (nova):
   **"a mensagem a uma sessão que esta não abriu deixa só a carta: sem cartão e sem sessão ativa"**.
   Roteiro: `fixar`; `const h = host(on, [])`; `responderEnvio(on)`; `pedido`; `plan(A)`; `start(['1'])`;
   `envio($, 'local_99999999-9999-9999-9999-999999999999')`.
   Afirma: `cartaSob(p, 'Um')` é "fila"; nenhuma linha com `sessao`; `cabecalho(p).chips.ativas` é 0;
   `h.proprio()?.children ?? []` está vazio.
   Falha hoje: há um cartão "Sessão…" sob "Um", 1 sessão ativa e a entrada no arquivo publicado.
3. `tests/envios.test.ts`, regra `envios.envio-que-falha-nao-deixa-rastro` (nova):
   **"o envio que falha não grava rodada: o turno seguinte da filha segue no cartão dela"**. Roteiro:
   `const { relogio } = fixar(on)`; stub `on('tool.call', { tool: 'SendMessage' }, () => ({ result:
   '{"success":false,"message":"no such session"}' }))`; `host` com K1 publicando a tarefa "f1" do turno
   1; `pedido`; `plan(A3)` (três folhas); `start(['1'])`; `abrirSessao`; `aviso`; `start(['2'])`;
   `relogio.advance(1000)`; `envio($, K1)`; `relogio.advance(1000)`; a filha passa a publicar "f1" e
   "f2", esta num turno 2 com `at` depois do envio; `aviso`.
   Afirma: `cartoes(p, 'filha-um')` é um cartão só, sob "Um", com "f1" e "f2"; não há carta sob "Dois".
   Falha hoje: "f2" aparece num segundo cartão sob "Dois".
4. `tests/sessoes.test.ts`, regra `sessoes.leitura-das-filhas-uma-por-vez` (nova):
   **"leituras pedidas ao mesmo tempo rodam uma de cada vez"**. Roteiro: `fixar`; `const h = host(on,
   [{ id: K1, nome: 'filha-um' }])`; `pedido`; `plan(A)`; `start(['1'])`; `abrirSessao`; `aviso`;
   `const antes = h.pedidosAoApp().filter(t => t === 'list_sessions').length`;
   `await Promise.all([aviso($), aviso($), aviso($)])`.
   Afirma: a lista foi pedida no máximo mais 2 vezes (a em curso e uma de novo).
   Falha hoje: 3 vezes. Se o harness rodar os três prompts em série (a conta dá 3 também depois da
   correção), o teste sai, o cenário fica `checklist` e o relato diz.

Testes existentes: nenhum deve mudar. Atenção a dois pontos na `regressao`:
- testes que mandam mensagem a uma filha antes de qualquer leitura (`host` sem `session.start`, por
  exemplo `envios.test.ts:194`, `:288`, `:312` e o cenário "envios" do golden): hoje a entrada nasce
  provisória (rodando, "Sessão…") e a leitura seguinte a corrige; com a mudança, a leitura acontece no
  envio e a entrada já nasce com o que o host diz (nome, parada ou rodando). A tarefa de origem, a rodada
  e a carta ficam iguais;
- `durabilidade.test.ts:206` (a lista deixa uma filha de fora e a traz de volta) segue pelo caminho de
  `kept`.
Se algum teste de `HEAD` falhar, relatar; não há decisão que autorize mudá-lo.

## 6. Catálogo e selos

`regras/durabilidade.md`:

```markdown
### durabilidade.filha-recem-aberta-ainda-nao-listada
A filha recém-aberta que a lista do host ainda não traz mantém a tarefa de origem.

- Dado uma sessão filha aberta de uma tarefa, que a lista do host ainda não lista
- Quando o painel relê as sessões, e depois a lista passa a trazê-la
- Então, enquanto é recente, ela segue no painel como sessão iniciando, sob a tarefa de origem; quando a lista a traz, o cartão dela fica sob a mesma tarefa; a ligação vai ao store antes da primeira leitura

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a primeira leitura descartava a filha recém-registrada e a ligação dela); estende durabilidade.ligacoes-com-lista-parcial-do-host à filha que ainda não foi listada nenhuma vez.
Código: hooks/sessions.ts, io/host.ts
Estado: coberto
```

`regras/sessoes.md`:

```markdown
### sessoes.destino-que-nao-e-filha-nao-vira-cartao
A mensagem a uma sessão que esta não abriu não cria cartão.

- Dado uma mensagem enviada à sessão mãe, a uma irmã ou a qualquer sessão que esta não abriu
- Quando o painel é desenhado, aqui e no cartão desta sessão na mãe
- Então só a carta ✉ aparece sob a tarefa do envio: nenhum cartão "Sessão…", nenhuma sessão ativa a mais no cabeçalho, nenhuma filha a mais no painel publicado

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: todo destino `local_…` fora das filhas ganhava uma entrada "Sessão…" trabalhando); aplica sessoes.mensagem-entre-filhas-no-cartao-da-remetente ("o cartão da destinatária não fica dentro do cartão da remetente").
Código: hooks/tool-call.ts
Estado: coberto
```

```markdown
### sessoes.leitura-das-filhas-uma-por-vez
A leitura das sessões filhas roda uma de cada vez.

- Dado leituras pedidas ao mesmo tempo (o relógio de 3 s, um aviso do app, a abertura de uma sessão)
- Quando uma já está em curso
- Então as outras esperam e, no fim, roda mais uma só; uma leitura mais antiga nunca grava por cima de uma mais nova, e o fim de turno de uma filha gera um lembrete só

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: leituras sobrepostas gravavam sem conferir a versão).
Estado: coberto
```

`regras/envios.md`:

```markdown
### envios.envio-que-falha-nao-deixa-rastro
O envio que falha não deixa carta nem rodada.

- Dado uma mensagem a uma sessão filha cujo envio falha
- Quando a filha abre o turno seguinte
- Então não há carta do envio que falhou, e as tarefas do turno seguinte seguem no cartão em que a filha já estava, não num cartão novo sob a tarefa do envio

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: a rodada era gravada antes de saber se o envio falhou); aplica sessoes.um-cartao-por-mensagem, sem mudá-la.
Estado: coberto
```

Selos: um `npm run regras:selar -- "<arquivo>::<nome>" --tipo novo --motivo "correção direta: leitura das
filhas"` por teste novo (os quatro nomes da seção 5).

## 7. Documentação

`DESENVOLVIMENTO.md`: os quatro passos de `refreshChildren` em "Fluxo de dados" e a linha de `sessions.ts`
em "Módulos" (uma leitura por vez, `update`, o prazo da recém-aberta); o trecho "Rodadas perdidas por a
sessão não estar na lista do host" (~1281-1291), que descreve a entrada criada por `sentMessage`, com a
regra nova; as variáveis de módulo novas na lista (~277) e, se a regra seguir de pé, na `TABLE`.

## 8. Golden

Não deve mudar. O cenário "envios" manda mensagem a uma filha antes da primeira leitura: com a leitura
feita no envio, a filha nasce com a mesma tarefa de origem e as mesmas rodadas. Se o check acusar
mudança em "envios", conferir a diferença antes de qualquer coisa: mudança de lugar do cartão é erro da
implementação.

## 9. Checklist do app

- Abrir uma filha e olhar o painel nos primeiros segundos: o cartão nasce sob a tarefa e não pula para
  o fim.
- Numa filha real, mandar mensagem à irmã e à mãe: no painel dela e no cartão dela na mãe não aparece
  "Sessão…" nem sessão ativa a mais.
- Depois de uma filha terminar o turno, um lembrete só "terminou o turno".

## 10. Dependências e conflitos

- Depois do lote 10 (mesmo arquivo; trechos diferentes). O lote 13 (higiene) vem em seguida, sobre a
  mesma leitura. Os lotes 14 (adoção pelo plan) e 23 (/clear numa filha) mexem em `recordStart`,
  `deriveChildren` e `sentMessage`.
- Triagem B: "recarga do mod faz um recibo antigo fechar a segunda mensagem" (`watchSends`,
  `usedReceipts`), "nome do destino na carta" (mapa id → nome para irmã e mãe, que pode querer a lista
  lida no envio) e "ferramenta antiga de mensagem" (um segundo caminho para `sentMessage`) mexem nos
  mesmos trechos. Triagem C: "/clear publica o painel antes de zerar waits e sends", "a primeira
  gravação das ligações depois de uma recarga funde o store por cima do state" (`saveLinks`/
  `restoreLinks`) e a decisão 32 (/clear com filhas: "Some na hora") mexem nas ligações e em `children`.
  Quem vier depois mantém: uma leitura por vez; gravação por `update`; nenhuma entrada para sessão que
  esta não abriu.

## 11. Bloqueio

Nenhum.
