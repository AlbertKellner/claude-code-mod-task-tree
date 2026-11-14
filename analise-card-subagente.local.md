# Card de subagente no painel

Análise de 2026-11-09. Só leitura, sobre o HEAD bb2392e (lido com `git show`). Clone intocado.
Pedido do usuário: "Quero uma nova funcionalidade, parecida com o card de sessão filha, mas par sub
agentes. Quero que seja criado um card que mostre a execução de um sub agente na raiz, ou dentro de uma
sessão filha. Explore as possibilidades e crie sugestões de como ficaria o card."

Protótipo visual das opções, para abrir no navegador:
`<notas>\analise-card-subagente-prototipo.local.html`
É um esboço em HTML, não o desenho do mod: serve para comparar a forma, não cores nem medidas.

## Resposta curta

Quatro opções: (1) linha rica, (2) cartão igual ao da filha, (3) cartão com as últimas ferramentas,
(4) cartão de grupo para vários em paralelo. **Recomendo a 2, com a 4 para workflow.** O kit expõe quase
tudo o que o cartão precisa. O que falta hoje é o mod ouvir o lançamento: ele só conhece o subagente que
chama `plan`.

## 1. O que já existe

- **Só o subagente que usa o painel aparece.** O grupo dele nasce no primeiro `plan` ou na primeira
  pergunta à pessoa (`ensureGroup`, `hooks/panel.ts:311`). Um `Explore` que só lê não deixa rastro.
- **Onde fica.** Antes da chamada `Agent`/`Task`, o mod grava a tarefa em andamento de quem lançou
  (`launch`, `hooks/tool-call.ts:36`). O grupo reclama esse registro pela descrição (`identify`,
  `hooks/panel.ts:296`) e fica embaixo dessa tarefa; sem tarefa, no fim da lista.
- **Como é desenhado.** Já é um cartão: cabeçalho `card: true` com "tipo: descrição", contagem, barra e
  tempo, as tarefas dentro, e o ícone dobra e abre (`draw`, `draw/layout.ts:1373`). Fechado, vira uma
  linha, com "interrompido" se algo ficou ✕.
- **Fim.** O `turn.complete` do subagente é o fim dele: o que ficou aberto vira ✕
  (`turnos.subagente-que-termina-interrompe`).
- **Aninhado.** Subagente de subagente pende do grupo de quem lançou (`parentId`), se esse tiver grupo.
- **Dentro de uma filha.** A filha publica os grupos dela, e a orquestradora desenha o cartão da filha a
  partir desse painel, com os grupos de subagente dentro. Vale o mesmo limite: só os que planejaram.
- **Sem tratamento próprio:** workflow, fork e segundo plano. O hand-back só é reconhecido para não abrir
  pedido (`hooks/prompt-submit.ts:30`).

O que falta para o cartão pedido: existir sem `plan`, e ter modelo, esforço, tokens/s, estado, ferramenta
atual, resultado e clique.

## 2. O que o kit expõe

Fonte: tipos gerados, `task-tree/.claude-plugin/types/claude-code/index.d.ts`.

| Dado | De onde | Observação |
|---|---|---|
| Início | hook `agent.spawn`; `next(e)` devolve `{ model, agentId }` | O mod não ouve hoje |
| Tipo e descrição | `agent.spawn` (`subagentType`, `description`), `$.agent.list()` | Já usados no rótulo |
| Quem lançou | `parentAgentId`, `parentId` | Raiz ou outro subagente |
| Modelo | resposta do `agent.spawn`; `turn.step` com `agentId` | Resolvido, não o apelido |
| Esforço | `turn.step` (`e.effort`) | Usado hoje só para o laço principal; para subagente, não verificado em execução |
| Tokens e tokens/s | `turn.step`: `usage.output_tokens` e o tempo do passo | Hoje medido só no principal (`hooks/turn.ts:57`) |
| Tempo | relógio do mod entre o início e o fim | |
| Ferramenta em uso | `tool.call` com `agentId` | O mod já recebe; hoje só usa para envios e perguntas |
| Segundo plano | `agent.spawn` (`background`) | |
| Fork | `agent.spawn` (`fork`) | Herda modelo e contexto |
| Workflow | `agent.spawn` (`workflow.runId`, `agentIndex`) | Agrupa os agentes de uma execução |
| Estado | `$.agent.list()`: pending, running, waiting, idle, completed, failed, killed | Consulta, não evento |
| Fim e resultado | `turn.complete` com `agentId`: `answer`, `reason` (answer, aborted, error, refusal) | |
| Abrir a conversa dele | `$.ui.view({ agentId })`, só em resposta a um clique | Igual ao anel da filha |

**De dentro de uma filha, visto da orquestradora:** só o que a filha publica no arquivo dela
(`io/publish.ts`). Hoje vão os grupos com tarefas. Para o cartão, a filha passa a publicar também os
dados do agente (tipo, modelo, estado, ferramenta, resultado). A atualização segue o ritmo da publicação
da filha, não é ao vivo.

**Não dá:** contexto usado pelo subagente (o anel de contexto é da sessão), e agente de workflow com
isolamento remoto, que não gera evento nenhum.

## 3. Sugestões de card

Esboços no formato dos testes. `◆` é o ícone de subagente (a definir; o da filha é `◍`).

### Opção 1: linha rica

Uma linha por subagente, sem moldura, com o que cabe à direita. Corpo só quando ele usa o painel.

```
└─ ◉ Investigar o hover  1/2  0:42
   ├─ ◆ Explore: buscar usos de hover  Haiku 5.5 · Grep  0:12
   └─ ✓ Ler o kit  0:30
```

- Menor custo de desenho e de código. Não parece o cartão da filha, que é o que o pedido descreve.

### Opção 2 (recomendada): cartão igual ao da filha

Mesma moldura e mesmo rótulo do cartão de sessão: ícone, "tipo: descrição", modelo e esforço, tokens/s e
a palavra de estado. O corpo depende de ele usar o painel.

Rodando, sem usar o painel (uma linha com a ferramenta atual e quantas chamadas fez):

```
└─ ◉ Investigar o hover  1/2  0:42
   ├─ ┌ ◆ Explore: buscar usos de hover   Haiku 5.5 · low  84 tok/s  trabalhando  0:12
   │  └   ▸ Grep "hover" em draw/  ·  7 chamadas
   └─ ✓ Ler o kit  0:30
```

Rodando, usando o painel (as tarefas dele, como hoje):

```
   ├─ ┌ ◆ general-purpose: revisar testes   Opus 5.5 · high  61 tok/s  trabalhando  1/3  1:05
   │  │   ├─ ✓ Ler os testes  0:20
   │  │   ├─ ◉ Rodar o check  0:45
   │  └   └─ ○ Relatar
```

Terminado: fecha numa linha, com o ↩ do resultado (até 120 caracteres; o texto inteiro no tooltip):

```
   ├─ ✓ ◆ Explore: buscar usos de hover   Haiku 5.5  concluído  0:31
   │    ↩ 14 usos em 3 arquivos; nenhum no cabeçalho
```

Estados (palavra à direita, como no cartão da filha):

| Estado | Ícone | Palavra | Faixa |
|---|---|---|---|
| Rodando | ◉ | trabalhando | azul |
| Em segundo plano | ◉ | em segundo plano | azul |
| Aguardando (permissão, plano, outro agente) | ◷ | aguardando | âmbar claro |
| Terminado | ✓ | concluído | verde, fechado numa linha |
| Falhou | ✕ | falhou | cinza |
| Interrompido (Esc, parado) | ✕ | interrompido | cinza |

Clique no cartão abre a conversa do subagente no app (`$.ui.view`), como o anel abre a filha.

### Opção 3: cartão com as últimas ferramentas

A opção 2, com as três últimas chamadas no corpo em vez de uma.

```
   ├─ ┌ ◆ Explore: buscar usos de hover   Haiku 5.5 · low  84 tok/s  trabalhando  0:12
   │  │   ✓ Glob draw/**/*.ts
   │  │   ✓ Read draw/svg.ts
   │  └   ▸ Grep "hover" em draw/
```

- Mostra mais do andamento. Custa três linhas por agente e redesenha a cada chamada; com vários em
  paralelo o painel cresce rápido.

### Opção 4: cartão de grupo, para vários em paralelo

Agentes de um mesmo workflow (`runId`), ou lançados juntos na mesma resposta, entram num cartão só, uma
linha por agente. Clicar no ícone de uma linha abre o cartão dela (opção 2).

```
└─ ◉ Revisar o PR  0/1  2:10
   └─ ┌ ◆ Workflow · 5 agentes   3/5  2 trabalhando  2:10
      │   ✓ Explore: ler o diff           Haiku 5.5   0:40
      │   ✓ Explore: ler os testes        Haiku 5.5   0:52
      │   ✓ general-purpose: segurança    Opus 5.5    1:30
      │   ◉ general-purpose: correção     Opus 5.5    ▸ Read src/api.ts   2:10
      └   ◉ Plan: consolidar              Opus 5.5    ▸ aguardando 2 agentes
```

### Aninhamento

Na raiz, embaixo da tarefa em andamento no lançamento (regra de hoje). Dentro de uma filha, dentro do
cartão dela, embaixo da tarefa da filha. Subagente de subagente, dentro do cartão de quem lançou:

```
└─ ◉ Delegar a análise  0/1  3:00
   └─ ┌ ◍ analise-plano   Fable 5.1 · low  97 tok/s  trabalhando  1/2  3:00
      │   ├─ ✓ Ler o código  1:10
      │   └─ ◉ Reproduzir  1:50
      │      └─ ┌ ◆ Explore: achar o teste   Haiku 5.5  trabalhando  0:20
      │         └   ▸ Grep "esperarCartaSob"
      └
```

O mod já limita a profundidade dos cartões aninhados pela largura; o cartão de subagente entra na mesma conta.

### Comparação

| | 1 linha rica | 2 cartão | 3 com ferramentas | 4 grupo |
|---|---|---|---|---|
| Parece o cartão da filha | Não | Sim | Sim | Sim, por fora |
| Linhas por agente rodando | 1 | 2 | 4 | 1 |
| Linhas depois de terminado | 1 | 1 ou 2 (com ↩) | 1 ou 2 | 1 |
| Vários em paralelo | Bom | Regular | Ruim | Melhor |
| Custo de código | Baixo | Médio | Médio | Médio, sobre a 2 |

**Recomendação:** opção 2 como cartão padrão, e a 4 quando houver workflow ou mais de três agentes
lançados juntos. A 3 fica como evolução, se o usuário sentir falta de mais detalhe.

## 4. Perguntas ao usuário

1. Qual opção? Recomendo a 2, com a 4 para vários em paralelo.
2. O subagente que não usa o painel conta no cabeçalho ("d de n", %)? Recomendo que não: ele não é
   tarefa. Ganha uma pílula própria, "N subagentes", como "sessões ativas".
3. Terminado, o cartão fecha numa linha com o ↩ do resultado? Recomendo que sim.
4. Clique no cartão abre a conversa do subagente? Recomendo que sim.
5. Ícone do subagente: recomendo um próprio, diferente do da filha.
6. Subagentes terminados de pedidos antigos saem com o pedido, como as tarefas? Recomendo que sim.

## 5. Impacto

**Código tocado** (estimativa): `hooks/register.tsx` (ouvir `agent.spawn`), `hooks/tool-call.ts`
(ferramenta atual por agente), `hooks/turn.ts` (modelo, esforço, tokens/s e fim por agente),
`hooks/panel.ts` e `state/durability.ts` (estado novo dos agentes), `io/publish.ts` (a filha publica os
agentes), `draw/layout.ts` e `draw/svg.ts` (o cartão), `hooks/render.tsx` (clique e terminal),
`tests/kit` (simular lançamento, passo e fim de subagente; mudança de kit pede selo).

**`npm run impacto`** sobre esses arquivos: 115 cenários, porque `hooks/register.tsx` é núcleo e afeta
tudo. Golden: os três. Fora do mapa: nenhum. O cenário mais próximo é
`turnos.subagente-que-termina-interrompe` (2 testes), que deve continuar valendo para o que usa o painel.

**Golden.** Os três cenários atuais não têm subagente, então não devem mudar se o cartão só aparecer
quando houver um. Convém um quarto cenário, "subagente", aprovado pelo usuário no app.

**Limites do desenho.** 600 KB (`DRAW_LIMIT`, `hooks/panel.ts:519`) e 400 linhas (`MAX_ROWS`,
`draw/layout.ts:656`). Um workflow de 20 agentes dá 40 linhas na opção 2 e 80 na 3. Para caber:
terminado fecha numa linha, a opção 4 agrupa, e a linha de ferramenta redesenha só quando a ferramenta
muda. A ferramenta atual muda muitas vezes por segundo; o redesenho precisa de limite de frequência para
o painel não piscar.

**Cenários novos em `regras/` (área nova, `subagentes.md`, ou em `sessoes.md`):**

- `subagentes.cartao-desde-o-lancamento`: lançado um subagente, o cartão aparece embaixo da tarefa em
  andamento, mesmo sem ele usar o painel.
- `subagentes.cartao-mostra-tipo-modelo-e-estado`: o rótulo traz tipo, descrição, modelo e a palavra de estado.
- `subagentes.corpo-e-as-tarefas-ou-a-ferramenta`: com tarefas, elas; sem tarefas, a ferramenta atual.
- `subagentes.terminado-fecha-com-o-resultado`: ao terminar, uma linha e o ↩; falha e interrupção com a palavra própria.
- `subagentes.segundo-plano`: lançado em segundo plano, o cartão segue vivo depois do fim do turno.
- `subagentes.aninhado-no-cartao-de-quem-lancou`: subagente de subagente e subagente de filha.
- `subagentes.varios-em-paralelo-num-grupo`: agentes do mesmo workflow num cartão só (se a 4 for aceita).
- `subagentes.nao-conta-no-cabecalho`: fora do "d de n" (conforme a pergunta 2).
- No checklist do app: clique que abre a conversa, tokens/s, cores nos dois temas, subagente real em filha real.

## Não verificado

- Se `turn.step` de um subagente traz `effort` e `usage` como o do laço principal. Os tipos dizem que o
  evento dispara para subagente; não rodei um de verdade.
- Se `agent.spawn` dispara para subagente lançado dentro de workflow em todos os casos (os tipos dizem
  que sim, menos com isolamento remoto).
- O atraso real com que o subagente de uma filha chega à orquestradora.
- Nada foi desenhado pelo mod: os esboços e o protótipo são propostas.
