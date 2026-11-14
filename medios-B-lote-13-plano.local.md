# Lote 13: aviso de espera no cartão de grupo

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit. Só
`draw/layout.ts` muda.

## 1. O que cobre

Correção direta: "No cartão de grupo (mais de três, ou workflow), o aviso de espera de um agente não
aparece". Nenhuma decisão nova; aplica `perguntas.permissao-espera` ("aparece Aguardando permissão:
<ferramenta>").

## 2. Causa confirmada na ponta

- `draw/layout.ts:1529-1574` (`groupCard`): a linha de cada agente vem fechada por padrão (`:1559`) e
  mostra o título, a ferramenta em uso ou o estado (`:1566`) e o tempo. As esperas do agente
  (`waits.filter(w => w.agent === g.agent)`) só são desenhadas dentro do cartão próprio dele (`draw`,
  `:1580`, e `body`, `:1396` e `:1404`), isto é, só com a linha aberta.
- `hooks/render.tsx:293`: o chip "aguardando" e a faixa contam linhas de aviso desenhadas (ou a sessão
  que espera sem aviso próprio, `r.pending`). A linha fechada do agente não é uma coisa nem outra.
- A espera chega ao state com o agente dela: permissão em `hooks/permission.ts` (`agent_id`), pergunta e
  plano em `hooks/tool-call.ts:62`.

No painel: num "Workflow · 12 agentes", um agente pede permissão ou abre uma pergunta; a linha dele
segue "trabalhando" com a última ferramenta, nenhum "Aguardando permissão" aparece, nem no chip nem na
faixa. Escrito no código.

## 3. O que muda

`draw/layout.ts`, `groupCard`:

- A linha fechada de um agente com espera aberta mostra o texto da espera no lugar da ferramenta (o de
  `waitText`: "Aguardando permissão: <ferramenta>", "Aguardando sua resposta", "Aguardando aprovação do
  plano", "Aguardando sua escolha"; com mais de uma, a primeira), com o tom de espera (o ícone ◷), e
  conta no chip "aguardando" e na faixa (a mesma marca que a sessão que espera usa, `pending`, lida em
  `hooks/render.tsx:293`).
- Aberta a linha (o cartão próprio do agente), nada muda: os avisos aparecem dentro dele, como hoje, e a
  linha de cabeçalho dele não conta de novo.
- O cartão de grupo recolhido leva essas esperas no campo do lote 12 (o que a linha recolhida esconde),
  para o chip e a faixa não mudarem ao recolher. A palavra do cabeçalho do grupo ("N trabalhando") não
  muda.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Golden pelo mapa: os quatro; no cenário
`subagente` nenhum agente espera: o desenho não muda.

## 5. Testes

Novo, em `tests/subagentes.test.ts`:

1. "no cartão de grupo, o agente que pede permissão mostra a espera na linha dele e conta no chip
   'aguardando', também com o cartão recolhido". Cenários novo `subagentes.espera-no-cartao-de-grupo` e
   `perguntas.permissao-espera`. Roteiro: `fixar`; `lancaveis` com quatro ids; `on('classic.
   PermissionRequest', () => ({}))`; pedido; plan; start; quatro `lancar` (o cartão "4 subagentes");
   `$.classic.PermissionRequest({ tool_name: 'Bash', agent_id: <o segundo id> })`. Afirma: a linha desse
   agente contém "Aguardando permissão: Bash" e tem o estado "aguardando"; as outras três não;
   `cabecalho(p).chips.aguardando` igual a 1. Depois, com `montar`, recolhe "4 subagentes": o chip segue
   1. Falha hoje: a linha diz "trabalhando" e o chip é 0.

Testes existentes: nenhum muda (os do cartão de grupo, `tests/subagentes.test.ts:89-117`, não têm
espera).

## 6. Catálogo e selos

`regras/subagentes.md`, cenário novo:

- `### subagentes.espera-no-cartao-de-grupo`
- Título: "No cartão de grupo, o agente que espera a pessoa mostra a espera na linha dele."
- Dado um cartão "N subagentes" ou "Workflow · N agentes" com as linhas dos agentes fechadas
- Quando um dos agentes pede permissão, abre uma pergunta ou um plano a aprovar
- Então a linha dele mostra "Aguardando permissão: <ferramenta>" (ou o texto da espera) no lugar da
  ferramenta, com o ícone de espera, e conta no chip "aguardando" e na faixa, também com o cartão de
  grupo recolhido; terminada a espera, a linha volta a mostrar a ferramenta
- `Origem: auditoria 2026-11-10 (o aviso de espera de um agente só existia dentro do cartão próprio
  dele); aplica perguntas.permissao-espera e cabecalho.recolher-nao-muda-chips-nem-faixa, sem mudar
  nenhuma regra.`
- `Estado: coberto`

Selo:

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::no cartão de grupo, o agente que pede permissão mostra a espera na linha dele e conta no chip 'aguardando', também com o cartão recolhido" --tipo novo --motivo "a espera de um agente aparece e conta no cartão de grupo"

## 7. Documentação

`DESENVOLVIMENTO.md`: na parte do cartão de grupo (procurar `groupCard` ou "Cartão + grupo"), uma frase.
`CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Num workflow real (ou mais de três subagentes juntos), um agente pede permissão: a linha dele mostra
"Aguardando permissão: …" em âmbar, o chip "aguardando" conta 1 e a faixa do cabeçalho muda.

## 10. Dependências e conflitos

- Depois do lote 12 (o campo do que a linha recolhida esconde). Sem o lote 12, a parte "com o cartão
  recolhido" do teste falha; os dois podem ir em sequência no mesmo dia.
- Lote 14 (tarefas do subagente contam) mexe nas mesmas linhas do `groupCard` (o que cada linha de agente
  representa na contagem): conflito de merge provável; lógica separada.
- Triagem C, decisão 39 ("Pendurar na pendente", pergunta sem tarefa em andamento) e decisão 40: mudam a
  tarefa da espera do loop principal, não a de um agente no grupo.

## 11. Bloqueio

Nenhum.
