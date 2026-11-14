# Lote 21: fim do turno no arquivo publicado (absorvido pelo lote 07; não despachar)

Planejado em 2026-11-14 sobre `6d5e026`, só lendo.

Este número ficou sem implementação própria. O achado "No cartão da filha parada, a tarefa ◷ para no
último carimbo do painel publicado: 0:00 ou tempo cortado" (correção direta) é resolvido pelo lote 07:

- a triagem propunha um campo novo no arquivo publicado com o fim do turno;
- o lote 07 (decisão 5, "Seguir ◷ até o start") passa a gravar, no fim normal do turno, a hora do fim na
  própria tarefa em andamento e nos pais abertos; essa hora vai ao arquivo publicado dentro de `groups`,
  e o cartão da filha parada já a usa (`panelOf`, `draw/layout.ts:180-181`, pelo `endedAt` da tarefa);
- os dois testes de verificação e o cenário `sessoes.cartao-parado-mostra-o-tempo-do-turno` estão na
  seção 12 de `medios-A-lote-07-plano.local.md`, e entram no commit do lote 07.

Se, por alguma razão, o lote 07 não for implementado, este achado volta a pedir a correção da triagem:
publicar o fim do turno num campo opcional do arquivo (sem subir a versão), levá-lo por `io/host.ts` até
`Child` e usá-lo em `panelOf` como o instante em que o relógio parou, com o último carimbo como reserva;
arquivos: `types/index.d.ts`, `io/publish.ts`, `io/host.ts`, `hooks/panel.ts`, `draw/layout.ts`,
`tests/fixtures/publicados.ts`. Nesse caso, pedir um plano novo ao planejador.

Bloqueio: nenhum.
