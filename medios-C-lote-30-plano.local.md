# Lote 30 (triagem C): `DESENVOLVIMENTO.md` atualizado

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achados "Tabela de durabilidade do documento diverge da TABLE: turnEnded aparece só no state, e
  faltam turnAborted, ultracode, rate, git e o store turn" e "Tabela de durabilidade e documentação
  desatualizadas…" (parte do documento): a mesma pergunta.
- Decisão 45: "Atualizar agora (Recomendado)". A opção: "Atualizar agora, num trabalho só, trocando a
  tabela por um ponteiro para `state/durability.ts`. O painel não muda; some o risco de alguém seguir
  o documento e tirar a gravação do fim do turno."

## 2. Causa confirmada na ponta (`task-tree/DESENVOLVIMENTO.md`)

- "Estado e durabilidade" (linhas 239-294): o texto cita `ensureView` e `restoreView`, que não
  existem mais; a tabela (251-269) tem a linha `view`, diz `turnEnded` só no state e sem volta, e não
  tem `turnAborted`, `replanDue`, `ultracode`, `rate`, `git` nem o registro `turn` do store. A `TABLE`
  de `state/durability.ts` tem tudo isso.
- "Quem traz do store e quando" (289-294): cita `restoreView` e `ensureView`; não cita o fim do turno
  (`restoreTurn`, `ensureTurn`).
- "Arquivo publicado (versão 1)" (296-324): a lista de campos não cita `ultracode`, `rate`, `git` nem
  `aborted`; diz "`sends` (só os não tomados)" (os tomados também vão) e "sete `$.state.get`" (são
  dez na ponta, `hooks/panel.ts:513-524`).
- "Textos para o modelo" (326-333): diz que os resultados das ferramentas ficam fora de
  `text/rules.ts`.
- Linha 688 e a lista de hooks: o plan abrindo o painel.

## 3. O que muda (só o documento; escrever com o código como estiver na ponta da branch na hora)

1. **Estado e durabilidade**: sai a tabela; entra um parágrafo que aponta para a `TABLE` de
   `state/durability.ts` como a única fonte (por chave: onde vive, o prefixo do store, a fusão, quando
   volta), dizendo que a etapa `regras` do check confere as chaves do state contra ela (lote 09).
   Ficam em prosa: as três camadas e quando cada uma morre; o registro `turn` do store e por que o
   fim do turno é gravado (um processo novo não pode desenhar ◉ o que já parou; e o registro "em
   curso" achado por um processo novo vira parada, lote 05); as fusões que restarem (lote 06: as
   ligações só entram do store na chave que o state não tem); a poda do store e o registro de falha
   (lote 08); o painel que volta do arquivo publicado quando o store não o tem (lote 12); a lista das
   filhas deixadas no `/clear` (lote 07); a poda dos subagentes terminados sem tarefas (lote 10).
2. **Quem traz do store e quando**: reescrito com as funções da ponta (sem `ensureView` e
   `restoreView`; com `ensureTurn`, `restoreTurn`, o primeiro uso das ligações e a volta pelo arquivo).
3. **A premissa da recarga**: onde o documento afirma que a recarga não roda `session.start`, dizer
   que foi medido em outubro de 2026, que o contrato do kit 2.1.321 diz que roda (numa ativação, num
   respawn do worker ou numa recarga), que não foi medido de novo, e que o código funciona nos dois
   casos (lotes 06 e 14).
4. **Arquivo publicado**: a lista de campos como `publishWait` os grava na hora (com `ultracode`,
   `rate`, `git`, `aborted`; sem `tasks`, lote 11; com o fim do turno, se o lote 12 daqui ou o 21 da
   triagem A o tiver acrescentado); `sends` inteiro; as filhas cortadas ao trabalho atual; o arquivo
   como cópia de longo prazo do painel da própria sessão; a passada que esvazia os arquivos de
   sessões que o app não lista; a leitura só do que mudou (lote 13, se tiver entrado). Tirar a
   contagem "sete `$.state.get`".
5. **Textos para o modelo**: os avisos do plan, a recusa do start e a nota dos subagentes também
   vivem em `text/rules.ts` (lotes 15, 17 e 19); cada texto tem um cenário que diz quando sai (lote
   25); a ordem "done, depois plan" (lote 24).
6. **Painel na tela**: o plan não abre mais o painel; ele abre em processo novo, na mensagem da
   pessoa e com `/task-tree` (lote 14).
7. **Tempo**: a base do tempo do pai e do pedido (lote 26), onde o documento descrever os tempos.
8. **Golden**: seis cenários (lote 27), onde o documento citar os quatro.
9. Uma entrada curta em "Decisões (histórico)" com a data 2026-11-14 e as decisões desta triagem que
   mudaram comportamento (as de números 32 a 41 e 44 de `orq-decisoes-medios.local.md`, cada uma com
   as palavras do usuário e o cenário do catálogo que a guarda).

Cada item só entra para o que de fato tiver sido implementado: conferir lote a lote no `git log` da
branch antes de escrever.

## 4. Impacto

Nenhum arquivo de código. `npm run impacto` não lista `.md`.

## 5. Testes

Nenhum. O hook roda o check inteiro (há mudança em `task-tree/`); nada deve mudar de resultado.

## 6. Catálogo e selos

Nenhum cenário, nenhum selo.

## 7. Documentação

É o próprio lote. `CLAUDE.md` do repositório: conferir a seção "Checklist do app" contra o que os
lotes 04, 05, 07, 12 e 14 acrescentaram (cada um já traz a sua linha).

## 8. Golden

Não muda.

## 9. Checklist do app

Nada.

## 10. Dependências e conflitos

- Depois de todos os lotes do mod desta triagem (04 a 27), para descrever o estado final de uma vez
  ("num trabalho só").
- Triagem A, lote 26 (documentação: fim de turno, done da mãe com filha trabalhando) e triagem B,
  lote 01 (`DESENVOLVIMENTO.md` alinhado ao cenário do envio): mesmo arquivo, outras seções. Em
  sequência; de preferência este por último, para a seção de durabilidade e a do arquivo publicado já
  levarem o que os lotes de A (21, 23, 24) e de B (10, 25) acrescentaram ao store e ao arquivo.
- A memória "sem testes nem docs" já foi reescrita pela orquestradora (decisão 46).

## 11. Bloqueio

Nenhum.
