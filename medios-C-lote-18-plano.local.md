# Lote 18 (triagem C): "parou com N pendentes" nas duas ordens

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "'A mãe é avisada de que ela parou com N pendentes' só acontece se a origem já estava fechada
  quando a filha parou". Correção direta: o cenário
  `sessoes.filha-parada-com-origem-fechada-sai-da-contagem` (decisão de 2026-11-04, "Origem fechada
  (Recomendado)") já diz o aviso sem condição de ordem.

## 2. Causa confirmada na ponta

- Escrito, `hooks/sessions.ts:257-279` (`endedNote`): a lista das sessões que terminaram é zerada na
  primeira leitura (linha 260); "parou com N pendentes" (`SESSION.stopped`) só entra para o cartão que
  já está encerrado naquele instante (linhas 271-276), isto é, com a origem já fechada.
- Escrito, `text/rules.ts:257-260` (`SESSION.ended`): o lembrete de turno terminado com a origem
  aberta não diz quantas pendentes a filha deixou, e manda marcar com done.
- Escrito, `hooks/tools.ts:143-185` (`doneTool`): o done que fecha a origem não olha os cartões.
- Teste só da ordem inversa: `tests/sessoes.test.ts:629-641`.
- Dedução: na ordem comum (a filha para com pendentes, a origem ainda aberta), o modelo fecha a
  origem como o lembrete manda, o cartão vira "encerrada" e as pendentes saem do cabeçalho, do chip e
  do x/y sem aviso.

## 3. O que muda

- `text/rules.ts`: `SESSION.ended` passa a dizer, por sessão, quantas pendentes ela deixou, quando
  deixou ("… (tarefa de origem "1" Um; parou com 2 pendentes)"), e ganha a frase "Ao fechar a tarefa
  de origem, as pendentes dessa sessão saem da contagem do painel; se o trabalho delegado não acabou,
  retome a sessão em vez de fechar." Um aviso novo do done: "a sessão <nome> parou com N pendentes:
  elas saíram da contagem do painel; se o trabalho delegado não acabou, retome a sessão". A expressão
  "N pendentes" fica igual nas três frases (o teste existente a confere).
- `hooks/sessions.ts`: `endedNote` conta as pendentes do cartão também com a origem aberta (a mesma
  conta das linhas 272-276: folhas abertas do painel cru do cartão) e as passa ao texto. Uma função
  exportada que responde, para uma lista de tarefas recém-fechadas, os cartões que ficaram encerrados
  por elas e quantas pendentes cada um tem (o mesmo `split` e `settle` do desenho).
- `hooks/tools.ts` (`doneTool`, loop principal): depois de fechar, pergunta por essa função e
  acrescenta o aviso aos "Avisos:" da resposta.
- Sem aviso repetido: a ordem "origem fecha, depois a filha para" segue com o `SESSION.stopped` de
  hoje; a ordem "filha para, depois a origem fecha" ganha o número no lembrete e o aviso no done.

Em termos do painel: o desenho não muda (as pendentes continuam saindo da conta, por decisão). O
modelo é avisado nas duas ordens.

## 4. Impacto

`npm run impacto -- hooks/sessions.ts hooks/tools.ts text/rules.ts`: 85 cenários (sessões 22, envios
17, pedidos 14, lembretes 11, árvore 9). Checklist: `envios.destino-arquivado-no-app`,
`envios.subagente-no-app` (não tocados). Golden: nenhum.

## 5. Testes de verificação (`tests/sessoes.test.ts`)

Regra dos dois: `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`.
- "a filha para primeiro com pendentes: o lembrete diz quantas, e o done que fecha a origem avisa que
  saíram da contagem". Roteiro do teste existente da linha 630, na outra ordem: a filha com uma
  tarefa pendente; pedido, plan com `1` e `9`, start `1`, `abrirSessao`, `aviso`; a filha para
  (`rodando = false`); o contexto do `aviso` seguinte contém "terminou o turno" e "1 pendentes"; a
  resposta do `done(['1'])` contém "Avisos" e "1 pendentes" e "saíram da contagem". Falha hoje: o
  lembrete não tem o número e o done não avisa.
- "o done que fecha a origem de uma filha sem pendentes não avisa": a filha parada com tudo
  concluído; o done sem "pendentes".
- Teste existente "a mãe é avisada de que a filha parou com pendentes": não muda.

## 6. Catálogo e selos

O cenário não muda de texto (já diz o aviso). Ganha só, na `Origem:`, "; o aviso nas duas ordens
(filha para antes ou depois de a origem fechar), auditoria 2026-11-10". Sem `Reescrito:` (não é
decisão nova).

Selos: `npm run regras:selar -- "task-tree/tests/sessoes.test.ts::<nome>" --tipo novo --motivo "auditoria: aviso das pendentes nas duas ordens"`, um por teste novo.

## 7. Documentação

Comentário de `endedNote`. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Uma filha real que para com passos pendentes e a origem aberta: o modelo da mãe recebe o número de
  pendentes no lembrete; se ele fechar a origem, a resposta do done diz que elas saíram da contagem.

## 10. Dependências e conflitos

- Depois do lote 17 (`hooks/tools.ts`).
- Triagem A, lote 10 (o lembrete "terminou o turno" passa a olhar a tarefa da rodada do turno que
  terminou): mesma função `endedNote` e mesmo texto `SESSION.ended`. Fazer em sequência; a contagem
  das pendentes daqui acompanha a tarefa que o lote 10 de A escolher.
- Triagem A, lote 26 (decisão 15, "Rodada fora da conta": só texto dos cenários da filha parada com
  Esc): outro cenário de sessões.
- Triagem B, lote 01 (o lembrete "recebimento confirmado"): outra frase de `SESSION`.

## 11. Bloqueio

Nenhum.
