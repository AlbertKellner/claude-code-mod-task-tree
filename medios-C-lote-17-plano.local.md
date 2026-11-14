# Lote 17 (triagem C): resultado do plan com avisos

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "O resultado do plan não diz o que foi interrompido, renomeado ou zerado" (a parte dos textos
  que prometiam estado guardado foi resolvida no PR 36). Correção direta.

## 2. Causa confirmada na ponta

- Escrito, `hooks/tools.ts:122-124`: a resposta do plan é sempre "Plano exibido no painel: N tarefas
  neste plano (M abertas no seu grupo)."
- Escrito, `hooks/tools.ts:60-66` e `78-83`: num pedido novo, um nível 1 aberto de pedido anterior
  com id repetido não é replanejado: fica como histórico, as abertas dele interrompidas e o id
  trocado; um nível 1 fechado com id repetido fica como histórico e o novo entra ao lado; no mesmo
  pedido, o replano guarda o estado das tarefas que mantêm o id (`carry`).
- Dedução: sem aviso, o modelo segue achando que a tarefa antiga está em andamento ou concluída, e
  não corrige o painel que regrediu.

## 3. O que muda

`hooks/tools.ts` (`planTool`): a resposta ganha "Avisos: …" no padrão do done, só quando há o que
dizer. Os textos ficam em `text/rules.ts` (um grupo novo de avisos do plan):
- nível 1 aberto de pedido anterior que ficou como histórico: `"<id>" era de um pedido anterior e
  ficou como histórico, com K tarefas abertas interrompidas; a tarefa nova entrou toda pendente (para
  seguir na antiga, use start e done nos ids dela, sem replanejar)`;
- nível 1 já fechado com o mesmo id: `"<id>" já estava fechada e ficou como histórico; a tarefa nova
  entrou ao lado`;
- replano no mesmo pedido: `"<id>" replanejada no lugar: K tarefas mantiveram o estado (C concluídas,
  A em andamento); as demais entraram pendentes`, só quando alguma manteve estado que não é pendente.
A primeira frase ("Plano exibido no painel: …") fica igual. O comportamento do plan não muda (regra
confirmada em 2026-10-27, `pedidos.plano-anterior-vira-historico`).

Em termos do painel: nada muda no desenho; o modelo passa a saber o que o plan dele fez às tarefas
que já existiam.

## 4. Impacto

`npm run impacto -- hooks/tools.ts text/rules.ts`: 44 cenários (pedidos 14, lembretes 11, árvore 9,
envios 3). Checklist: nenhum. Golden: nenhum.

## 5. Testes de verificação (`tests/pedidos.test.ts`)

Regra de todos: `pedidos.plan-avisa-o-que-fez-as-tarefas-antigas`.
- "o plan avisa o nível 1 de pedido anterior que ficou como histórico, com as abertas interrompidas":
  pedido um, plan com `1` e duas filhas, start numa, fim do turno; pedido dois, plan com `1`. A
  resposta contém "Plano exibido", "Avisos", "pedido anterior", "histórico" e "2 tarefas abertas
  interrompidas". Falha hoje: sem avisos.
- "o plan avisa o nível 1 fechado que ficou como histórico": tudo concluído; plan com o mesmo id; a
  resposta contém "já estava fechada".
- "o replano no mesmo pedido diz quantas tarefas mantiveram o estado": uma concluída, uma em
  andamento, uma nova; contém "mantiveram o estado" e os números.
- "um plano sem ids repetidos não traz avisos": a resposta não contém "Avisos".
- Testes existentes: nenhum muda (os que leem a resposta do plan conferem só "Plano exibido").

## 6. Catálogo (`regras/pedidos.md`) e selos

Novo, `coberto`:

```markdown
### pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
A resposta do plan diz o que ele fez às tarefas que já existiam com o mesmo id.

- Dado um plan que repete o id de um nível 1 que já existe
- Quando o plan responde
- Então, além de "Plano exibido", a resposta avisa: o nível 1 aberto de pedido anterior que ficou como histórico, com quantas abertas interrompidas; o nível 1 já fechado que ficou como histórico; e, no replano do mesmo pedido, quantas tarefas mantiveram o estado; sem id repetido, não há avisos

Origem: auditoria 2026-11-10 (o modelo não sabia o que o plan tinha interrompido ou guardado); aplica pedidos.plano-anterior-vira-historico, pedidos.nivel1-concluido-e-historico e pedidos.replano-preserva-estado, sem mudar nenhuma delas.
Código: text/rules.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/pedidos.test.ts::<nome>" --tipo novo --motivo "auditoria: avisos na resposta do plan"`, um por teste novo.

## 7. Documentação

`text/rules.ts`: o comentário do topo cita os avisos do plan. `DESENVOLVIMENTO.md`, "Textos para o
modelo" (diz que os resultados das ferramentas ficam fora de `rules.ts`): no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

Nada na tela.

## 10. Dependências e conflitos

- Depois do lote 15 (mesmos arquivos); antes do 24 (o aviso daqui reduz o dano da ordem plan antes do
  done, que o lote 24 corrige nos lembretes).
- Triagem A, lote 02 (decisão 1: nível 1 que fechou sozinho e é replanejado com o mesmo id, no mesmo
  pedido, reabre mantendo os ✓): muda o segundo aviso daqui para esse caso (lá deixa de virar
  histórico; vira um replano, e o aviso certo passa a ser o terceiro). Quem vier depois ajusta a
  condição e o teste.
- Triagem A, lotes 01 (ids no plan), 03 (título do primeiro plan), 14 (o plan adota cartas e
  cartões) e 15 (cartão sob o nível 1): todos em `planTool`. Em sequência.

## 11. Bloqueio

Nenhum.
