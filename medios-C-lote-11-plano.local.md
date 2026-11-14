# Lote 11 (triagem C): arquivos publicados, enxugar e esvaziar

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Arquivos publicados nunca são apagados, crescem sem teto e são relidos por inteiro a cada
  3 s", na parte da decisão. A parte direta (reler só o que mudou) é o lote 13.
- Decisão 35: "Enxugar e esvaziar (Recomendado)". A opção: "Tirar a cópia antiga das tarefas, publicar
  as filhas cortadas ao trabalho atual e esvaziar o arquivo das sessões que o app não lista mais. Na
  sessão avó, o cartão de uma neta deixa de ter '+N pedidos anteriores'; o cartão de uma filha em
  versão do mod anterior aos grupos deixa de mostrar tarefas. Toca a decisão de 2026-11-04 ('Ficam em
  +N pedidos anteriores')."

## 2. Causa confirmada na ponta

- Escrito, `io/publish.ts:131-147` e `157-181`: o arquivo leva `tasks` (a cópia do grupo principal,
  "para leitores antigos") além de `groups`, e `children` como o state as tem.
- Escrito, `hooks/panel.ts:515` e `526`: `children` vai com o `panel` de cada filha inteiro (todo o
  histórico dela, e dentro dele o das netas).
- Escrito, tipos do kit 2.1.321: `$.fs` tem `read`, `write`, `list` (nome, tipo, tamanho, `mtimeMs`),
  `exists` e `stat`; não tem apagar. O arquivo de uma sessão que deixou de existir fica para sempre.
- Medido pela triagem (não refeito): 129 arquivos, 3,9 MB, o maior com 816 KB.
- Leitura da opção (dedução, a frase da pergunta é ambígua): "tirar a cópia antiga das tarefas" é
  parar de **escrever** `tasks`. A leitura dos formatos antigos fica como está (o cenário
  `durabilidade.formatos-antigos-do-publicado` e o teste dos 8 formatos não mudam). A consequência
  dita na pergunta vale para uma sessão mãe que rode uma versão do mod de antes dos grupos: ela deixa
  de ver as tarefas desta.

## 3. O que muda

Três partes, um commit (uma decisão):

**(a) Sem a cópia `tasks`.** `io/publish.ts` (`publishWait`, o tipo `Publication`) e `hooks/panel.ts`
(`publishPanel`) deixam de montar e gravar `tasks`. `parsePublished` e `panelOf` (`io/host.ts`) seguem
lendo `tasks` de arquivos antigos.

**(b) As filhas publicadas cortadas ao trabalho atual.** Em `publishPanel`, cada filha vai ao arquivo
com o painel dela cortado ao trabalho atual dela: os níveis 1 do `work` que ela publicou (sem `work`,
os do último pedido com tarefas; sem pedidos, todos), só os turnos dessas tarefas, os grupos de
subagente pendurados nelas (e os ainda vivos), as esperas, o `received` e os `sends` inteiros (as
remetentes confirmam cartas por eles), e as filhas dela cortadas do mesmo jeito. O corte usa o painel
cru da filha (`rawPanel`, de `draw/layout.ts`), não o lido para desenho (`panelOf` marca tarefas só
para o desenho), e não guarda o resto (`whole`). A regra do corte é a mesma de `trimToWork`
(`draw/layout.ts:813-858`): uma função pura ao lado dela, sem as partes de desenho. O state desta
sessão continua com as filhas inteiras (o painel dela não muda); só o que ela publica encolhe.

**(c) Esvaziar o arquivo das sessões que o app não lista mais.** Uma passada em segundo plano, no
`session.start` de um processo novo, só no app desktop (`hooks/sessions.ts`, com as leituras em
`io/host.ts` e a gravação em `io/publish.ts`):
- lista a pasta `~/.claude/task-tree-waits`; candidatos: `local_….json` que não é o desta sessão, com
  mais de 1 KB e sem gravação há mais de 24 h;
- pede ao app a lista de todas as sessões, arquivadas incluídas (a mesma ferramenta de hoje, sem o
  filtro das ligadas, com limite alto); se a lista falhar ou vier no limite, não faz nada;
- para cada candidato que a lista não traz, confirma com a consulta daquela sessão (`get_session` com
  o id): só quando o app responde que ela não existe o arquivo é regravado vazio (`version`, `waiting`
  falso, `waits` e `children` vazias); qualquer outra resposta, ou erro de outro tipo, deixa como está;
- no máximo 20 arquivos por passada; cada um vai ao log de depuração.
A confirmar na implementação: a forma da resposta do app para um id que não existe (o plano não a
mediu; sem um sinal claro de "não existe", a passada não esvazia nada).

Em termos do painel: o desta sessão não muda. Na sessão avó, o cartão de uma neta (dentro do cartão
da filha) mostra só o trabalho atual dela, sem a linha "+N pedidos anteriores". Os arquivos encolhem.

## 4. Impacto

`npm run impacto -- io/publish.ts hooks/panel.ts hooks/sessions.ts io/host.ts` (sem
`types/index.d.ts`, que não precisa mudar): 98 cenários (sessões 22, envios 17, turnos 14, pedidos 14,
durabilidade 9, perguntas 8, subagentes 5, ultracode 5). Checklist: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app`, `ultracode.cor-e-corte`. Golden: nenhum. Se a função pura do corte ficar
em `draw/layout.ts` (ao lado de `trimToWork`), a matriz passa a listar também o catálogo do desenho e
os quatro cenários do golden; como é função nova, sem mexer nas que desenham, o golden não muda.

## 5. Testes de verificação

`tests/sessoes.test.ts` (com `host`, lendo `h.proprio()`):
- "o arquivo publicado não leva a cópia antiga das tarefas". Regra:
  `sessoes.publicado-enxuto`. Pedido, plan, start; `h.proprio()` tem `groups` e não tem `tasks`. Falha
  hoje: tem `tasks`.
- "a filha vai ao arquivo publicado cortada ao trabalho atual dela". Mesma regra: uma filha cujo
  painel publicado tem dois pedidos (o primeiro concluído, o segundo em andamento, com `work` no
  segundo; o `host` do kit precisa aceitar `work` no painel da filha: campo novo, opcional, na `Filha`,
  com selo de refatoração do kit); depois de `abrirSessao` e `aviso`, `h.proprio().children[0].panel`
  só tem as tarefas do segundo pedido, e o painel desta sessão segue mostrando "+1 pedidos anteriores"
  no cartão da filha (o state não foi cortado). Falha hoje: o publicado leva os dois pedidos.
- "na avó, o cartão da neta não tem '+N pedidos anteriores'". Mesma regra: uma filha que publica uma
  neta já cortada (o `painel` da filha com `children`, como esta versão escreve; se o `host` do kit
  não aceitar filhas dentro do painel, usar `publicado`, o texto cru); o cartão da neta aparece com o
  trabalho atual e sem a linha. Passa hoje com esse dado; define o formato que a avó lê.
- "uma rodada antiga da neta, de pedido cortado, não quebra o cartão". Mesma regra: a neta com uma
  rodada cuja tarefa de turno saiu no corte: o desenho não tem erro nem cartão com tarefa de outro
  pedido.

`tests/durabilidade.test.ts`:
- "o arquivo de uma sessão que o app não lista mais é esvaziado, e o de uma listada não". Regra:
  `durabilidade.publicado-de-sessao-que-nao-existe-e-esvaziado`. Precisa do `host` do kit com
  `fs.list` (nomes, tamanhos e datas dos arquivos das sessões dadas) e com a resposta de erro do
  `get_session` para id fora da lista (apoios novos no kit, selo de refatoração); `iniciarSessao`;
  afirma a gravação vazia no arquivo da sessão que não existe e nenhuma gravação nos outros (a
  listada, a arquivada, a recente). Falha hoje: nada é esvaziado.
- "com a lista do app em erro, nada é esvaziado". Mesma regra.
- O teste dos 8 formatos e os demais existentes: nenhum muda.

## 6. Catálogo e selos

`regras/sessoes.md`, novo, `coberto`:

```markdown
### sessoes.publicado-enxuto
O arquivo que a sessão publica leva o painel dela inteiro e as filhas cortadas ao trabalho atual.

- Dado uma sessão com filhas, e filhas com pedidos já concluídos e netas
- Quando ela publica o painel para a sessão que a abriu
- Então o arquivo leva os grupos dela inteiros, sem a cópia antiga das tarefas, e cada filha só com o trabalho atual dela (e as netas, do mesmo jeito); o painel da própria sessão não muda; na sessão avó, o cartão de uma neta mostra o trabalho atual, sem "+N pedidos anteriores"; os arquivos de formatos antigos seguem sendo lidos

Origem: decisão do usuário, 2026-11-14 ("Enxugar e esvaziar (Recomendado)"); limita, para as netas vistas pela avó, a decisão de 2026-11-04 ("Ficam em '+N pedidos anteriores' (Recomendado)").
Código: hooks/panel.ts
Estado: coberto
```

`regras/durabilidade.md`, novo, `coberto`:

```markdown
### durabilidade.publicado-de-sessao-que-nao-existe-e-esvaziado
O arquivo publicado de uma sessão que o app não lista mais é esvaziado.

- Dado a pasta dos arquivos publicados com o arquivo de uma sessão que não existe mais no app, parado há mais de um dia
- Quando um processo novo abre uma sessão no app desktop
- Então esse arquivo é regravado vazio; o de uma sessão que o app lista (arquivada inclusive), o desta sessão e o gravado há pouco ficam como estão; com a lista do app em erro, incompleta ou sem a confirmação de que a sessão não existe, nada é esvaziado

Origem: decisão do usuário, 2026-11-14 ("Enxugar e esvaziar (Recomendado)").
Código: hooks/sessions.ts, io/host.ts, io/publish.ts
Estado: coberto
```

Se algum cenário coberto de sessões afirmar hoje "+N pedidos anteriores" dentro do cartão de uma neta
vista pela avó (a busca por "neta" e "avó" nos testes não achou nenhum), ele ganha `Reescrito:
2026-11-14, decisão do usuário ("Enxugar e esvaziar (Recomendado)")` e o teste é selado `--tipo decisao`.

Selos:
- `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "host com work e filhas no painel da filha, fs.list e get_session de sessão que não existe"`
- `npm run regras:selar -- "task-tree/tests/<arquivo>::<nome>" --tipo novo --motivo "decisão 2026-11-14: arquivos publicados enxutos e esvaziados"`, um por teste novo.

## 7. Documentação

Cabeçalho de `io/publish.ts` e o comentário de `Published` em `types/index.d.ts` (só se o tipo for
tocado; o campo `tasks` continua existindo para a leitura). `DESENVOLVIMENTO.md`, "Arquivo publicado":
no lote 30.

## 8. Golden

Não muda (nenhum roteiro tem neta).

## 9. Checklist do app

- Sessão avó real (principal → filha → neta): o cartão da neta dentro do cartão da filha mostra o
  trabalho atual e não tem "+N pedidos anteriores"; o cartão da filha segue com o histórico dela.
- Depois de reabrir o app um dia depois de apagar uma sessão: o arquivo dela em
  `~/.claude/task-tree-waits` fica com poucas dezenas de bytes; os das sessões vivas e arquivadas não
  mudam.

## 10. Dependências e conflitos

- Antes do lote 12 (o painel passa a voltar do arquivo publicado da própria sessão: o arquivo próprio
  continua inteiro, e só some quando a sessão deixa de existir no app, que é exatamente a regra "(c)").
- Triagem A, lote 13 (higiene do que é publicado: "netas publicadas sem corte", profundidade): mexe
  na mesma montagem das filhas em `publishPanel`. Os dois cortes somam (lá a profundidade, aqui o
  histórico); quem vier depois junta os dois na mesma função de corte.
- Triagem A, lote 17 (regras de cartão valendo para as netas) e lote 23 (`/clear` numa filha mantém o
  histórico no cartão): leem o painel das filhas e das netas. O lote 23 de A guarda o histórico da
  filha do lado da mãe; o corte daqui é só no que a mãe publica para a avó.
- Triagem A, lote 21 (fim do turno no arquivo publicado): acrescenta um campo ao mesmo arquivo.
- Triagem A, lote 24 (filha arquivada antiga vira linha): lê as mesmas listas.

## 11. Bloqueio

Nenhum.
