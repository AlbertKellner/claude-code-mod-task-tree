# Pai ◷ com todos os filhos ✓ ou ✕

Só leitura; nada implementado nem commitado. Base lida: a pasta de trabalho do clone em
`feat/filha-completa-na-orquestradora` (a Implementação escrevendo nela; não tocada). Reprodução numa
cópia no scratchpad
(`<scratchpad>\pai-fechado`,
`task-tree/tests/repro.test.ts`, binário 2.1.317).

Pedido do usuário (2026-11-04): "verifique esse comportamento: todos os subitens estão concluidos ou
interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem".
Print: o pedido "Validar a linha de envio no app" ◷ 13/13 20:44:11, com 4 ✓ e 2 ✕ "interrompida"
embaixo.

## Essencial

- **É regra do painel, não acidente, mas uma regra que o catálogo nunca pediu nesses termos:** o desenho
  pinta de ◷ ("Aguardando") todo pedido ou pai cujos filhos estão todos fechados com ✓ e ✕ misturados.
  Foi a saída escolhida em 95b1a21 para cumprir "se existem tarefas concluidas como filhas, o pai nunca
  pode ficar como interrompido" (as palavras dele só proíbem o ✕; o ◷ foi escolha do mod, e o catálogo
  a registrou como "o pai fica ◷, nunca ✕"). O ícone é o relógio âmbar (◷), não o ◉; ele leu como "em
  andamento" porque é âmbar e o tempo corre no formato de relógio parado.
- **Reproduzido no kit**: replano em pedido novo com o mesmo id (as ✕ do print) → "◷ Pedido um 2/2" e
  "◷ Plano A 2/2" com ✓ ✓ ✕; também no Esc (pai ◷ com ✓ e ✕) e na filha arquivada.
- **Proposta: pai e pedido fecham quando nada embaixo segue aberto**: ✓ se há ao menos uma folha ✓
  (as ✕ ficam fora do x/y, como hoje), ✕ só se nada foi concluído; ◷ fica reservado a pai com algo
  ainda aberto embaixo (pendente ○ ou folha aguardando ◷) e nada em andamento. Isso mantém as duas
  decisões anteriores (nunca ✕ com filha ✓; ◷ com concluída e aberta embaixo, 2026-10-20) e atende a
  nova. Dois cenários reescritos, um novo; **3 testes mudam (selo `decisao`), confirmados na cópia
  com a mudança aplicada (119 passam, 3 falham, só eles), um novo reproduz o print; o golden não
  muda** (os 3 cenários passaram).
- **Onde:** `draw/layout.ts` (`rows` e `turnRows`, o tom; e `halt`, o pai parado), `state/tasks.ts`
  (`settle` fecha o pai com filhas todas fechadas e alguma ✓). Sem mudança de kit, de textos ao modelo
  nem de contagem. Independente da mudança "só resumida" (arquivos diferentes dentro de `layout.ts`);
  ordem indiferente, mas um commit por mudança.
- Sem dúvida de produto que bloqueie: a única é se o pai com ✓ e ✕ deve ser ✓ (as palavras dele dizem
  que sim). Pergunta secundária na §5, com recomendação.

## 1. Como o ícone do pai e do pedido é calculado hoje, e por que dá ◷ aqui

Tudo em `draw/layout.ts`, no desenho (o state guarda só `status` open/done/interrupted).

**Pedido (linha do turno, `turnRows`):** o tom é, nesta ordem: ◉ se alguma tarefa está acesa, na trilha
da última iniciada, com sessão trabalhando ou carta na fila; senão, com algum nível 1 aberto: ◷ se há
algo concluído ou aguardando embaixo (`resting`), senão ○; senão (tudo fechado): **se há alguma ✕, ◷
quando também há alguma ✓, ✕ quando não há**; senão ✓. É este penúltimo ramo que dá o ◷ do print: os 6
níveis 1 fechados, 4 ✓ e 2 ✕.

**Tarefa pai (`rows`):** `status === 'interrupted'` com filha ✓ embaixo → ◷ (em vez de ✕); `status ===
'done'` com filha ✕ embaixo → ◷ (um `done` do modelo num pai com ✕ de subagente, por exemplo);
`status === 'open'` sem nada aceso: ◷ se há algo concluído ou aguardando embaixo (`resting`), senão ○.
O pai aberto só fica assim com todos os filhos fechados por obra do `halt` (fim de turno ou Esc,
aplicado no desenho): um pai sem filha aberta mas com alguma ✓ é mantido aberto com o relógio parado,
"e é interrompido só sem nada feito embaixo" (comentário do `halt`, citando a decisão de 95b1a21).

**O que fecha de verdade no state:** `settle` (depois de cada `done`) fecha o pai só quando **todas** as
filhas estão ✓; `interrupt` (subagente que termina, filha arquivada, plano abandonado por replano com o
mesmo id em pedido novo, `away` em `hooks/tools.ts`) marca ✕ o que estava aberto, filhas ✓ ficam ✓, e o
pai vira `interrupted` → desenhado ◷ pela regra acima.

**Por que o print:** o pedido "Validar a linha de envio no app" teve dois níveis 1 abandonados por um
replano com os mesmos ids num pedido novo (`away`: ✕ e renomeados, ficam no pedido antigo); os outros
quatro estavam ✓. Nada aberto, alguma ✕, alguma ✓ → ◷, "13/13" (as ✕ fora do total,
`cabecalho.interrompida-fora-do-total`), e o tempo "20:44:11" é `stillSpan`, do primeiro start ao
último fechamento, no formato de relógio parado.

**Reprodução (cópia no scratchpad, saída do terminal do kit):**

```
REPRO1  replano em pedido novo com o mesmo id (o print)
◷ Pedido um  2/2  0:01
└─ ◷ Plano A  2/2  0:01
   ├─ ✓ Um
   ├─ ✓ Dois
   └─ ✕ Três  interrompida
○ Pedido dois  0/1
└─ ○ Plano A novo  0/1
   └─ ○ Xis

REPRO2a  Esc com Um ✓ e Dois.dois ✕ (Dois.um ✓)
◷ Pedido um  2/2
└─ ◷ Plano C  2/2
   ├─ ✓ Um
   └─ ◷ Dois  1/1
      ├─ ✓ Dois.um
      └─ ✕ Dois.dois  interrompida

REPRO3  fim normal com Um ✓, Dois iniciada, Três pendente (este ◷ está certo)
◷ Pedido um  1/3
└─ ◷ Plano A  1/3
   ├─ ✓ Um
   ├─ ◷ Dois
   └─ ○ Três
```

## 2. Bug ou regra: as decisões no catálogo

- `turnos.pai-com-filha-concluida-nunca-interrompido` (commit 95b1a21): "Dado um pai com uma filha ✓;
  Quando o resto embaixo fica ✕ (Esc ou subagente que termina); Então o pai fica ◷, nunca ✕". Origem:
  decisão do usuário, "se existem tarefas concluidas como filhas, o pai nunca pode ficar como
  interrompido". **As palavras dele só vetam o ✕**; o ◷ foi a escolha de implementação, e o cenário a
  cristalizou. O pedido de hoje escolhe o ✓ para esse caso: não desfaz a decisão original, substitui a
  escolha do mod.
- `sessoes.filha-arquivada-interrompe` (95b1a21, mesma origem): "o que ficou aberto fica ✕, e o pai com
  filha ✓ fica ◷". Mesma situação: passa a ✓.
- `turnos.pai-e-pedido-aguardam-no-fim` ("Pai aguardando", 2026-10-20: "nas tarefas que estao
  aguardando e ja tem alguma tarefa concluida, marque os pais como aguardando"): o ◷ é para pai com
  tarefa **aguardando** embaixo, isto é, ainda aberta. Não se aplica a pai com tudo fechado. Fica.
- `arvore.pai-em-andamento-no-caminho-da-ultima-iniciada` (2026-10-27, "pai aberto deve mostrar ◉ em
  andamento"): ◉ só no caminho da última iniciada no turno. Não se aplica (nada iniciado aberto). Fica.
- `arvore.pai-fecha-com-os-filhos` (465b09e): "Quando todas as folhas são concluídas com done, o pai e
  os ancestrais ficam ✓". Só cobre o caso de todas ✓; o caso ✓+✕ nunca foi decidido além do "nunca ✕".
- `cabecalho.interrompida-fora-do-total`: "13/13" está coerente (as ✕ não contam); nada muda.

**Veredito:** regra do painel incompleta (escolha de implementação nunca validada pelo usuário), agora
decidida por ele. Não é regressão nem bug de código: o desenho faz o que o código manda. A correção é
uma reescrita de regra com `Reescrito:` e selo `decisao`.

## 3. O estado certo do pai em cada combinação de filhos

| Filhos (folhas, diretas ou abaixo) | Hoje | Proposta |
|---|---|---|
| só ✓ | ✓ (`settle`) | ✓ |
| ✓ e ✕, nada aberto | ◷ | **✓** (as ✕ fora do x/y: "2/2") |
| só ✕, nada aberto | ✕ | ✕ |
| alguma ◉ (ou sessão trabalhando, carta na fila, trilha da última iniciada) | ◉ | ◉ |
| alguma ◷ (folha deixada aguardando) e nada ◉ | ◷ | ◷ |
| alguma ○ e alguma ✓ (ou ◷), nada ◉ | ◷ | ◷ (2026-10-20) |
| só ○ (e eventualmente ✕), nada ◉ | ○ | ○ (`turnos.esc-interrompe-so-a-iniciada`: "o pai sem nada feito embaixo fica ○") |
| sem filhos, iniciada e aberta no fim do turno | ◷ | ◷ |

Vale igual para a tarefa pai, o nível 1 e a linha do pedido, no painel próprio e nos cartões das
filhas (parada, arquivada). O x/y, a barra, o tempo (do primeiro start ao último fechamento) e os
chips não mudam.

**Regra proposta (nova, `arvore.md`):**

```
### arvore.pai-fecha-com-filhas-concluidas-e-interrompidas
Um pai com todas as filhas fechadas fica ✓ se alguma foi concluída.

- Dado um pai (tarefa, nível 1 ou pedido) cujas folhas estão todas ✓ ou ✕, ao menos uma ✓
- Quando o painel é desenhado (depois de Esc, de subagente que terminou, de replano com o mesmo id em pedido novo, de filha parada ou arquivada)
- Então o pai e os ancestrais ficam ✓, com as ✕ fora do x/y; só ✕ embaixo deixa o pai ✕; ◷ fica para o pai com algo ainda aberto embaixo

Origem: decisão do usuário, 2026-11-04 ("todos os subitens estão concluidos ou interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"); mantém "se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido" (95b1a21).
Código: draw/layout.ts
Estado: coberto
```

**Reescritos** (com `Reescrito: 2026-11-04, decisão do usuário ("todos os subitens estão concluidos ou
interrompidos, mas a tarefa pai está como em andamento, ela deveria estar concluida tambem"); troca o
◷ por ✓ quando nada embaixo segue aberto; "nunca ✕" mantido`):
- `turnos.pai-com-filha-concluida-nunca-interrompido`: Então "o pai fica ✓ (nunca ✕); ◷ só enquanto
  algo embaixo segue aberto".
- `sessoes.filha-arquivada-interrompe`: "o que ficou aberto fica ✕, e o pai com filha ✓ fica ✓".
- `arvore.pai-fecha-com-os-filhos`: Então ganha "(ou interrompidas, com ao menos uma concluída: o par
  arvore.pai-fecha-com-filhas-concluidas-e-interrompidas)". Opcional; só se quiserem a ligação no texto.
- `turnos.pai-e-pedido-aguardam-no-fim`: Dado "algo concluído ou aguardando **e algo ainda aberto**
  embaixo de um pai aberto". Só clareza; o teste não muda.

## 4. Arquivos, testes, golden, impacto, relação com "só resumida"

**`draw/layout.ts`**
- `turnRows`, o tom com tudo fechado: `flat(list).some(done) ? 'done' : 'interrupted'` (sai o ramo
  "some interrupted → paused").
- `rows`: `interrupted` com ✓ embaixo → `'done'` (era `'paused'`); `done` com ✕ embaixo → `'done'` (era
  `'paused'`); pai `open` sem nada aceso: `hasOpen(children) ? (resting ? 'paused' : 'open') :
  (doneBelow ? 'done' : 'interrupted')` (hoje `resting` sozinho dá ◷ mesmo sem filha aberta). O
  `label` segue o tom ("Concluída"). O `time` do tom `done` já é o intervalo fechado.
- `halt` (o pai no fim de turno/Esc, aplicado no desenho e em `panelOf` das filhas paradas): o ramo do
  pai sem filha aberta e com alguma ✓ passa a devolver `status: 'done'` (hoje fica `open` com o
  relógio parado). Com isso o desenho e o state dos cartões dizem o mesmo; o comentário do `halt` muda
  junto (cita a decisão nova).
- `resting` continua (serve ao pai com filha ○ ou ◷).

**`state/tasks.ts`**, `settle`: fecha o pai quando todas as filhas estão fechadas (✓ ou ✕) e alguma é
✓ (hoje exige todas ✓). Hoje esse estado só surge no state por `carry` ou por `done` numa folha irmã
de uma ✕ de subagente; fechar no state evita que `hasOpen`, `openInSight` (a resumida mantém o pedido
"aberto") e o corte dos 3 últimos pedidos tratem como aberto um pai que o painel mostra ✓. Painéis já
gravados com esse estado: `settle` roda no próximo `done`; o desenho já cobre desde a recarga.

**Testes que mudam** (selo `decisao`, motivo com as palavras dele, 2026-11-04):
- `pedidos.test.ts` "no Esc, pai com filha concluída fica aguardando, nunca interrompido" → "fica
  concluído, nunca interrompido": `Plano C` e `Pedido um` passam a `concluida`. Mantém a asserção de
  `Dois` interrompida.
- `sessoes.test.ts` "filha arquivada: o que ficou aberto fica interrompido, e o pai com filha concluída
  aguarda" → "… fica concluído": `Pai da filha` `concluida`.
- `turnos.test.ts` "o subagente que termina deixa interrompido o que ficou aberto, e o pai com filha
  concluída aguarda" → `Plano do sub` `concluida` (Sub um ✓, Sub dois e três ✕).
- **Novo** (`turnos.test.ts` ou `pedidos.test.ts`, citando `arvore.pai-fecha-com-filhas-concluidas-e-interrompidas`):
  o print: dois níveis 1 ✓, um iniciado, fim do turno, pedido novo com `plan` do mesmo id → o pedido
  antigo e o nível 1 ✓ com "2/2", a folha ✕; e, no mesmo teste ou noutro, "só ✕ → pai ✕" e "✓ com ○
  embaixo → ◷" como contraprova (REPRO3).
- Não mudam (o ◷ deles tem folha aberta embaixo): `turnos.test` linhas 35–54, 72–73, 87–88, 112–115;
  `durabilidade.test` 287, 307; `sessoes.test` 72, 223; `envios.test` 324.
- **Confirmado na cópia do scratchpad** com a mudança de `rows`, `turnRows` e `halt` aplicada (sem o
  `settle`): **119 passam, 3 falham, exatamente os três acima**, cada um recebendo "concluida" onde
  esperava "aguardando"; as reproduções passam a "✓ Pedido um 2/2 / ✓ Plano A 2/2 / ✓ ✓ ✕" (o print)
  e "✓ Pedido um / ✓ Plano C / ✓ Dois 1/1 (✓ ✕)" no Esc; o caso com ○ e ◷ embaixo segue ◷. Sem a
  mudança no `halt`, o Esc deixava "Plano C" e o pedido em ◷ (o pai parado fica `open` no desenho e o
  nível acima o vê aberto): a mudança no `halt` é necessária, não opcional.

**Golden:** **não muda** (os 3 cenários passaram na cópia com a mudança): no "principal", o Esc do
pedido um é seguido do pedido dois, e sem o fim de turno vigente o `halt` não se aplica (Um.dois volta
a iniciada). Nenhuma validação de golden; `visual.desenho-principal` não precisa de `Reescrito:`. Se
o check acusar mesmo assim, aí validação no app como de costume.

**Detalhe à parte (mesma regra, decisão pequena):** a linha de cabeçalho de um grupo de subagente que
terminou fica "✕ general-purpose: … · interrompido" quando ele deixou algo ✕, mesmo com o plano dele ✓
embaixo (visto na cópia: "✕ … 1/1 · interrompido" sobre "✓ Plano do sub 1/1"). Sugiro aplicar a mesma
regra ao cabeçalho do grupo (✓ quando algo foi concluído, mantendo a palavra "interrompido" como
`meta` se quiserem o rastro); é uma linha em `draw` (`layout.ts` ~1343) e não muda teste existente.
Se preferirem não mexer, fica como está, sem contradizer a regra nova (não é pai de tarefa).

**`npm run impacto -- draw/layout.ts state/tasks.ts`:** `layout.ts` está no código de quase todas as
áreas (arvore, cabecalho, envios, pedidos, sessoes, turnos, visual.golden) → ~70 cenários, 0 do
checklist do app, os 3 do golden; "Fora do mapa: nenhum". A Implementação roda sobre o diff real.

**Relação com "só resumida" (análise anterior, em andamento):** mexem em trechos diferentes de
`layout.ts` (`rows`/`turnRows`/`halt` aqui; `trimToWork`/o fim de `layout()` lá) e em testes diferentes
(aqui `pedidos`, `sessoes` arquivada, `turnos` subagente; lá `cabecalho`, `durabilidade`, `sessoes`
cartão vivo). Sem conflito de conteúdo; os dois tocam `selos.json` e o golden "principal", então **um
commit de cada vez, com a sua aprovação do golden**. Efeito cruzado a relatar: com o pedido fechando ✓
no state (`settle`) ou no desenho, a resumida passa a tirar esse pedido do trabalho no próximo pedido
novo sem nada aberto (hoje um pedido com pai ◷ de ✓+✕ pode ficar à vista por `hasOpen`): coerente com
`cabecalho.resumida-limpa-so-com-tudo-concluido` e com a dúvida 1 daquela análise (histórico na
resumida). Ordem recomendada: esta primeiro (menor, independente, o usuário acabou de pedir), depois
"só resumida".

## 5. Riscos, dúvida e brief

**Riscos**
- `hasOpen` e `openInSight` deixam de ver o pai aberto que o `settle` fechar: um pedido com ✓+✕ sai da
  resumida no próximo pedido novo (acima). É o comportamento que o catálogo já descreve.
- O `halt` devolvendo `status: 'done'` para o pai é só no desenho (o state do painel próprio não muda
  no fim do turno); `panelOf` das filhas paradas também é só desenho. Nada muda no publicado.
- Após o Esc o pai ✓ volta a ◉ no prompt seguinte quando a folha iniciada reacende
  (`turnos.prompt-seguinte-retoma`): mesmo vaivém que a folha ✕→◉ já tem hoje.
- Um `done` do modelo num pai com ✕ de subagente embaixo passa a desenhar ✓ (hoje ◷): é o que ele
  pediu.

**Dúvida (secundária, não bloqueia):** o pai com **só ✕** embaixo. Hoje ✕; a frase dele ("concluidos ou
interrompidos … deveria estar concluida") lida ao pé da letra daria ✓ até com tudo ✕. Opções: A) ✕
(recomendado: nada foi feito; é o que `turnos.esc-interrompe-so-a-iniciada` e 95b1a21 já supõem);
B) ✓ sempre que tudo embaixo fechou. Seguir A salvo resposta contrária.

### Brief para a Implementação
- Pedido e decisão do usuário: "todos os subitens estão concluidos ou interrompidos, mas a tarefa pai
  está como em andamento, ela deveria estar concluida tambem" (2026-11-04). Mantém "se existem tarefas
  concluidas como filhas, o pai nunca pode ficar como interrompido" (95b1a21).
- Cenários: novo `arvore.pai-fecha-com-filhas-concluidas-e-interrompidas` (texto na §3); reescritos
  `turnos.pai-com-filha-concluida-nunca-interrompido`, `sessoes.filha-arquivada-interrompe`
  (o golden não muda; `visual.desenho-principal` fica); clareza opcional em `turnos.pai-e-pedido-aguardam-no-fim` e
  `arvore.pai-fecha-com-os-filhos`; sem mudança que protegem a área: os demais de `turnos.md`,
  `arvore.md`, `sessoes.md`, `cabecalho.interrompida-fora-do-total`.
- Matriz de impacto: `npm run impacto -- draw/layout.ts state/tasks.ts` (~70 cenários, golden ×3,
  checklist nenhum); rodar sobre o diff real.
- Testes existentes que mudam (selo `decisao`): `pedidos.test.ts` "no Esc, pai com filha concluída…",
  `sessoes.test.ts` "filha arquivada…", `turnos.test.ts` "o subagente que termina…"; teste novo com o
  caso do print e as contraprovas (só ✕ → ✕; ✓ com ○ → ◷). Nenhum outro pode mudar; se a suíte acusar
  outro, parar e relatar.
- Arquivos: `draw/layout.ts` (`rows`, `turnRows`, `halt` e comentários; opcional o cabeçalho do grupo
  de subagente), `state/tasks.ts` (`settle`), `regras/arvore.md`, `regras/turnos.md`,
  `regras/sessoes.md`, os 3 testes + o novo, `regras/selos.json`; sem golden. Commit sugerido:
  `fix(task-tree): pai e pedido ficam ✓ quando as filhas fecharam com ✓ e ✕`. Um commit, depois do
  commit da linha de envio e antes de "só resumida".
- O que o usuário valida no app: o pedido do print (e o nível 1 "Commit 2 das cartas…" renomeado)
  com ✓ e "13/13" após a recarga; um pedido com folha ◷ ou ○ embaixo segue ◷; o golden "principal".
