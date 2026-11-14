# Correção do achado alto 5: o cartão do subagente some quando a tarefa de origem fecha

Data: 2026-11-10. Branch `fix/achados-altos-auditoria`, sobre `4fdc25c`. Ensaiado numa cópia no
scratchpad (clone local); o repositório não foi tocado. Diff aplicável: `correcao-alto-5.diff`, ao
lado deste arquivo (`git apply --check` no repositório, em `4fdc25c`: ok).

Sem BLOQUEIO: a correção aplica decisões já registradas, não muda teste existente nem o golden.

## O defeito, reproduzido

- `task-tree/draw/layout.ts`, `body` → `below`: os grupos de subagente só são desenhados sob a tarefa
  com `t.status === 'open'`; carta (`letters`) e cartão de sessão (`session`) não têm essa condição.
  O comentário acima de `body` ainda diz "hidden with it once it closes", regra de antes do cartão
  desde o lançamento.
- `lost` (fim da lista) não pega o grupo sob âncora fechada e à vista. Resultado: o cartão some no
  instante em que a tarefa fecha, inclusive quando é o próprio painel que a fecha no fim do turno.
- Os três testes novos falham no código atual (rodados na cópia), todos com o cartão ausente:
  - fim do turno fecha "Investigar" ✓: `abaixo('Investigar')` = `[]`;
  - `done` com o subagente em segundo plano: cartão e pílula `▸ 1` somem com o agente rodando;
  - pedido sem plano depois de um pedido todo concluído: o lançamento vai à última iniciada
    (fechada) e o cartão nunca aparece.

## Decisões conferidas (nenhuma contrariada)

- `subagentes.terminado-segue-cartao`: "Fecha ao terminar" não foi escolhido; o cartão fica. A
  correção aplica isso também depois de a tarefa fechar.
- `subagentes.pai-conclui-no-fim-do-turno` ("Fecha de fato", "Fecha também"): o Então já diz "o
  cartão segue 'concluído' e fora da contagem". Não muda quando nem como a tarefa fecha; só o
  desenho do cartão embaixo dela.
- `subagentes.pai-reflete-falha-ou-interrupcao`, `subagentes.um-rodando-mantem-o-pai`: intocados
  (nada em `hooks/agents.ts`).
- `subagentes.cartao-desde-o-lancamento`: o cartão fica sob a tarefa de onde saiu.
- `subagentes.fora-da-contagem`: o cartão segue fora do "d de n"; vivo, segue na pílula.
- `subagentes.id-reusado-nao-herda-cartao` (achado 4, `4fdc25c`): pré-requisito já no HEAD. Sem ele,
  cartões antigos cairiam sob a tarefa nova de mesmo id; com ele, ficam na cópia renomeada, fora do
  trabalho, e não aparecem (o teste dele segue passando).
- `pedidos.*` / `cabecalho.historico-*`: o cartão sai com o pedido quando ele sai do trabalho
  ("+N pedidos anteriores"), pelo recorte que já existe (`trimToWork`, e o desenho só sob tarefa
  desenhada). Nenhum histórico infinito novo.
- Testes existentes alterados: nenhum (`npm run testes:alterados`). Golden: nenhum cenário tem
  subagente sob tarefa fechada; `golden.test.ts` passa sem regravar.

## Passo a passo

1. `task-tree/draw/layout.ts`, em `body`:
   - `below`: trocar
     `...(t.status === 'open' ? drawKids(kids.filter(k => k.anchor === t.id), depth + 1) : []),`
     por `...drawKids(kids.filter(k => k.anchor === t.id), depth + 1),` (como `letters` e `session`).
   - Reescrever o comentário acima de `body`: os grupos ficam sob a tarefa depois que ela fecha,
     como o cartão da sessão e a carta, e saem com o pedido dela quando ele sai do trabalho.
   - `lost` fica como está (ver "Fora do escopo").
2. `regras/subagentes.md`: cenário novo `subagentes.cartao-fica-com-a-origem-fechada`
   (Dado/Quando/Então; origem na auditoria aplicando `terminado-segue-cartao`,
   `pai-conclui-no-fim-do-turno`, `cartao-desde-o-lancamento`, `fora-da-contagem`;
   `Código: draw/layout.ts`; `Estado: coberto`), com uma linha "Fora deste cenário" para o vivo sob
   pedido que saiu do trabalho.
3. `task-tree/tests/subagentes.test.ts`: três testes com `// Regra: subagentes.cartao-fica-com-a-origem-fechada`:
   - "a tarefa que fecha sozinha no fim do turno, ou pelo done do modelo, segue com o cartão
     "concluído" embaixo": fim do turno fecha "Investigar" ✓ com o cartão "concluído" embaixo e o
     cabeçalho 1 de 2; no pedido seguinte, `start 2`, subagente termina, `done 2`: o cartão segue
     sob "Outra" ✓;
   - "com a tarefa fechada pelo done, o subagente em segundo plano segue no cartão e na pílula até
     terminar": `done 1` com o subagente em segundo plano: cartão "em segundo plano" sob
     "Investigar" ✓ e `▸ 1` no cabeçalho; depois do fim, "concluído", ainda embaixo;
   - "lançado num pedido sem plano depois de um pedido todo concluído, o cartão aparece sob a última
     tarefa iniciada": cartão "trabalhando" sob "Investigar" ✓.
4. Selos (tipo novo), um por teste:
   `npm run regras:selar -- "task-tree/tests/subagentes.test.ts::<nome>" --tipo novo --motivo "auditoria 2026-11-10, achado alto 5"`
   (hashes no diff: `3e40470cceec5936`, `dcf3324b22fa9b03`, `42efd176ce0a2c8b`).
5. `npm run check` e commit local único dos quatro arquivos
   (`git commit -- regras/selos.json regras/subagentes.md task-tree/draw/layout.ts task-tree/tests/subagentes.test.ts`),
   título sugerido: `fix(task-tree): o cartão do subagente fica sob a tarefa de origem fechada`.
   Aplicar o diff de uma vez (recarga a quente: o `layout.ts` é um arquivo só, mas tudo junto).

## Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 86 cenários (o arquivo é o desenho inteiro), todos
cobertos por testes que passam; checklist do app `cabecalho.aviso-de-painel-grande-volta`,
`subagentes.cartao-no-app`, `ultracode.cor-e-corte`; golden: os 4 desenhos, sem mudança. Fora do
mapa: nenhum.

## Resultado do check na cópia

```
ok    regras
ok    travas
ok    selos
ok    validate do marketplace
ok    validate do mod
ok    tsc
ok    plugin test       (176 pass, 0 fail, 15 arquivos)
ok    regressao         (173 testes de HEAD contra o código novo, 0 falharam)
```

`npm run testes:alterados`: "Testes existentes alterados desde HEAD: nenhum"; novos: os três acima.

Nota do ensaio: num clone limpo o `validate` não gerou `task-tree/.claude-plugin/types/`, e o `tsc`
falhou por isso; copiei a pasta (ignorada pelo git) do repositório e o check passou. No repositório
real ela já existe.

## Efeitos colaterais e riscos (sem decisão pendente)

- Mais linhas no painel: os cartões terminados agora aparecem sob tarefas fechadas do trabalho
  atual (em 8 dos 9 arquivos publicados reais, todos os cartões estavam escondidos assim). O limite
  de linhas segue valendo; pedidos fora do trabalho seguem sem desenhar os cartões.
- Tarefas que um subagente planejou seguem no "d de n" do cabeçalho enquanto o cartão dele está
  desenhado (comportamento de hoje com a tarefa aberta); antes sumiam quando a origem fechava. A
  pergunta da auditoria sobre contar ou não essas tarefas continua aberta e não muda com isto.
- Cartão vivo órfão (achado médio "subagente fica trabalhando para sempre quando o fim não chega"):
  passa a aparecer sob a tarefa fechada, com o tempo crescendo e na pílula, enquanto o pedido dela
  for o trabalho atual; sai com o pedido. A verificação pediu corrigir junto; fica como próximo item
  (não depende de decisão, mas depende de `$.agent.list()` e de outro critério para agentes de
  workflow), e o risco é limitado ao pedido atual.

## Fora do escopo

- Subagente vivo sob tarefa de um pedido que saiu do trabalho: segue não desenhado (o `lost` só
  pega grupos com tarefa aberta). Desenhá-lo solto no fim, como `sessoes.cartao-vivo-nunca-some`,
  só depois do achado médio acima, senão os órfãos ficam à vista para sempre.
- `settleBySubs` sem guarda de tempo (achado alto 6): independente deste.

## Checklist do app (depois do commit local)

- Subagente real lançado de uma tarefa, terminado, fim do turno: a tarefa fica ✓ e o cartão
  "concluído" segue embaixo, nos dois temas; o ícone de dobrar do cartão funciona.
- Subagente em segundo plano com `done` na tarefa: cartão e pílula seguem até ele terminar.
