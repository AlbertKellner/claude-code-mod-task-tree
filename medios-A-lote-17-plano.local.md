# Lote 17: regras de cartão valendo dentro do cartão de uma filha (netas)

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma correção direta, a maior do desenho: três regras que só valiam no painel principal).

## 1. O que cobre

- Achado "Regras de cartão valem só para as filhas diretas: "encerrada", cartão vivo solto e carta na fila
  no Esc não se aplicam dentro do cartão de uma filha". Correção direta.
- Nenhuma decisão nova. Estende a netas `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`
  (2026-11-04, "Origem fechada (Recomendado)"), `sessoes.cartao-vivo-nunca-some` (2026-11-03, "Cartão vivo
  solto no fim (Recomendado)") e `envios.fila-nao-interrompe-no-fim-do-turno` (2026-10-30, "Não, fica ◷
  enquanto a carta está na fila").
- A contagem da rodada parada com Esc não muda aqui (decisão 15, "Rodada fora da conta").

## 2. Causa confirmada na ponta atual

Escrito no código, `draw/layout.ts`:
- `layout.ts:1321-1327` (`panel`): os cartões são divididos por rodada em todo nível (`split`), mas
  `settle` ("encerrada") só é aplicado com `level === 0`, com as cartas desta sessão. O painel de uma
  filha traz as cartas dela (`p.sends`, usadas logo acima, em `pending`).
- `layout.ts:497-508` (`total`): só o primeiro nível recebe o `splitter`; abaixo, as netas contam cruas
  (`total(inCount(c), level + 1)`). `layout.ts:529-533` (`allTasks`): desce com `panelOf`, sem dividir,
  sem "encerrada" e sem tirar a rodada descartada. `layout.ts:1253`: o x/y do cartão é
  `total(p, level + 1)`.
- `layout.ts:1455-1458` e `1640-1642`: o cartão vivo de pedido cortado (`strays`) e o cartão solto vivo
  (`ends`) só são desenhados com `level === 0`; dentro de um cartão, nenhum.
- `layout.ts:180-181` (`panelOf`): a filha parada é lida com `halt(last, [], aborted)`: a lista das cartas
  na fila vai vazia, e a tarefa com carta na fila parada com Esc sai ✕ (no painel dela, `layout.ts:1046-
  1048`, a lista vai cheia e a tarefa fica ◷).

Dedução (orquestradora → filha → neta):
1. a neta para só com pendentes e a tarefa de origem dela na filha está fechada: no painel da filha ela
   é "encerrada" e fora da contagem; na orquestradora, as pendentes seguem contando no x/y do cartão da
   filha, da tarefa de origem e no cabeçalho, e o cartão diz "parada";
2. a neta trabalha sob um pedido da filha que saiu do trabalho dela: na filha, o cartão vai solto ao
   fim; na orquestradora, não aparece (e as tarefas dele contam);
3. a filha tem uma carta na fila e leva Esc: no painel dela a tarefa fica ◷; no cartão dela na
   orquestradora, ✕.

## 3. O que muda

`draw/layout.ts`; os chamadores que passam o `splitter` de hoje (`hooks/render.tsx:222-224`) e
`hooks/panel.ts:348` (`showStatus`) acompanham a assinatura.

1. Um só jeito de obter "os cartões de um painel, como contam": de um painel e do id da sessão dona
   dele, dividir cada filha por rodada (`split`, com as irmãs e as tarefas principais desse painel) e
   aplicar `settle` com as cartas desse painel (`p.sends`; no painel principal, as desta sessão). Uma
   função exportada faz isso e é usada:
   - no desenho, em `panel`, em todo nível (hoje só no nível 0);
   - na conta, em `total` e `allTasks`, em todo nível até `DEEP`: as netas passam a contar divididas,
     sem a rodada descartada e sem as pendentes da "encerrada", como as filhas diretas.
   O cache de quebras (`BreaksMemo`) do desenho é passado adiante; fora do desenho, um por chamada.
2. O x/y do cartão (`session`, `layout.ts:1253`) passa a sair dessa mesma conta.
3. Cartões vivos soltos dentro do cartão: o cartão vivo de pedido cortado (`strays`) e o solto vivo
   (`ends`, com `loosen`) passam a ser desenhados também com `level > 0`, no fim da lista do cartão da
   mãe deles, com o nome do pedido de origem no título. Parados e concluídos seguem fora (na linha
   "+N pedidos anteriores" do cartão).
4. `panelOf`, sessão parada: `halt` recebe as tarefas com carta ainda na fila desse painel (as `sends`
   dele sem `taken` e sem `cut`): a tarefa fica ◷, como no painel da própria sessão.

Comportamento novo no painel da orquestradora:
1. a neta parada só com pendentes e origem fechada: o cartão dela, dentro do cartão da filha, diz
   "encerrada"; as ○ seguem desenhadas e saem do x/y do cartão da filha, da tarefa de origem e do
   cabeçalho; as ✓ seguem contando;
2. a neta que trabalha sob um pedido da filha fora do trabalho: o cartão dela aparece no fim do cartão
   da filha, "<nome> · do pedido "<título>"";
3. a filha parada com Esc com carta na fila: a tarefa do envio aparece ◷ no cartão dela.

## 4. Impacto

`npm run impacto -- draw/layout.ts hooks/render.tsx hooks/panel.ts`: `hooks/render.tsx` é núcleo (todos os
159 cenários cobertos). Golden: os 4 cenários; ver 8. Checklist: o do app inteiro aparece pelo núcleo.

## 5. Testes a escrever

`tests/sessoes.test.ts`, regra `sessoes.regras-de-cartao-valem-para-netas` (nova). As netas vêm no
arquivo publicado da filha: usar `publicado` (o texto cru do arquivo, versão 1) no `host`, com `groups`
(o grupo principal da filha, com `turns` e `tasks`), `work` quando preciso, e `children` com a neta
(`id`, `name: 'neta'`, `title`, `running`, `archived: false`, `anchor`, `panel` com o grupo principal dela).

1. **"a neta parada só com pendentes e origem fechada fica "encerrada" e sai da contagem da
   orquestradora"**. Filha K1 rodando, com a tarefa "Origem da neta" concluída; neta parada, ancorada
   nela, com "n1" concluída e "n2" pendente. Mãe: `pedido`; `plan(A3)`; `start(['1'])`; `abrirSessao`;
   `aviso`. Afirma: a linha do cartão "neta" contém "encerrada"; "n2" pendente (desenhada);
   `cabecalho(p)`: `[feitas, total]` igual a `[2, 5]` (as três da mãe, a da filha e "n1").
   Falha hoje: o cartão diz "parada" e o total é 6.
2. **"a neta que trabalha sob um pedido da filha fora do trabalho aparece solta no fim do cartão da
   filha"**. Filha K1 rodando, com dois turnos: o 1 com "Antiga" concluída, o 2 com "Atual" iniciada, e
   `work` só com a tarefa do turno 2; neta rodando, ancorada em "Antiga", com "n1" iniciada. Afirma: há
   uma linha de sessão cujo título começa por "neta" depois da linha "Atual" e antes do fim do cartão
   da filha; "n1" em andamento.
   Falha hoje: não há linha da neta.
3. **"a filha parada com Esc com carta na fila mostra a tarefa do envio aguardando"**. Sem `publicado`:
   `host` com K1 `rodando: false`, `aborted: true`, `painel` com a tarefa "Avisar" iniciada e
   `stopped: true`, e `envios: [{ to: 'local_z', anchor: '1', at: AGORA }]`. Afirma: "Avisar"
   aguardando (não interrompida).
   Falha hoje: interrompida.

Testes existentes: nenhum deve mudar. Os que contam filhas diretas (`sessoes.test.ts:203`, `:212`, `:233`,
`:259`, `:374`, `:571`…) passam pelo mesmo caminho de antes. Se a `regressao` acusar um deles, o número
esperado é o de `HEAD`: corrigir o código, não o teste.

## 6. Catálogo e selos

`regras/sessoes.md`:

```markdown
### sessoes.regras-de-cartao-valem-para-netas
As regras de cartão valem também para os cartões dentro do cartão de uma filha.

- Dado uma sessão aberta por uma filha (uma neta), desenhada dentro do cartão da filha
- Quando ela para só com pendentes e a tarefa de origem dela na filha está fechada; ou trabalha sob um pedido da filha que saiu do trabalho; ou a filha, parada com Esc, tem uma carta na fila
- Então vale o mesmo que no painel da filha: a neta fica "encerrada", com as ○ desenhadas e fora do x/y do cartão da filha, da tarefa de origem e do cabeçalho (sessoes.filha-parada-com-origem-fechada-sai-da-contagem); o cartão vivo aparece solto no fim do cartão da filha, com o pedido de origem no título (sessoes.cartao-vivo-nunca-some); a tarefa com carta na fila fica ◷ (envios.fila-nao-interrompe-no-fim-do-turno); a rodada da neta dividida por mensagem e a descartada contam como nas filhas diretas

Origem: auditoria 2026-11-10 (triagem de 2026-11-13: "encerrada", cartão vivo solto e carta na fila só valiam para as filhas diretas); estende as três regras citadas, sem mudar nenhuma.
Código: hooks/render.tsx, hooks/panel.ts
Estado: coberto
```

Selos: um `npm run regras:selar -- "task-tree/tests/sessoes.test.ts::<nome>" --tipo novo --motivo "correção
direta: regras de cartão dentro do cartão"` para cada um dos três testes.

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Como é hoje", os trechos de `settle`/"encerrada", do cartão vivo solto e do
contador (`total`, ~1313-1316), dizendo que valem em todo nível até `DEEP`.

## 8. Golden

Conferir o golden "filha" (e os outros três) antes do commit: não deve mudar (o cartão do cenário não tem
netas, nem cartas, nem rodadas). Diferença em qualquer cenário é erro da implementação.

## 9. Checklist do app

- Uma cadeia real orquestradora → filha → neta: a neta "encerrada" e a neta viva solta aparecem no
  cartão da filha como no painel da filha; o número do cabeçalho da orquestradora bate com o da filha.

## 10. Dependências e conflitos

- Depois do lote 16 (mesma função `split` e a rodada da frente). Antes dos lotes 18 (Esc com filha ou
  subagente vivo: estende a lista do que poupa a tarefa em `halt`), 19 e 20.
- Lote 13: o corte de profundidade do publicado mantém os níveis que este lote lê.
- Triagem B, com sobreposição grande; quem vier depois junta:
  - "status "Tarefas d/n" diverge do cabeçalho" (`showStatus` chama `total`);
  - "recolher uma linha muda os chips e a faixa" (o que `Row.nodes` de uma linha fechada leva, via
    `allTasks` e `Work.cards`);
  - "a mesma carta aparece em todos os cartões de rodada" e "no cartão da filha parada com Esc, a carta
    entregue segue verde" (`panelOf`, `split`, `letters`);
  - decisão 23 (onde contam as tarefas de um subagente) mexe em `total`/`count`.
- Triagem C: nada nestas funções.

## 11. Bloqueio

Nenhum.
