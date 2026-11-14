# Tarefa de pergunta: ícone novo, resumo da pergunta e alternativas como subtarefas

Pedido: "o icone de perguntando, deveria ser outro, mostre no painel sugestoes de icones para eu
escolher. e o texto dele, está muito genérico, nao mostre somente 'Aguardando sua resposta', envie o
resumo da pergunta como texto de tarefa, e abra as sub tarefas com as alternativas disponiveis.
quando responder, mantenha somente a sub tarefa seleciona com um check verde, e as descartadas com o
X cinza. Se eu digitar a resposta em texto, mostre o resumo da resposta".

Implementação na série 12, depois do envelope recebido, na mesma branch.

## Decisões do usuário
- Ícone: **D. Balão com reticências** (escolhido numa prova temporária no topo do próprio painel,
  já retirada). Path (14 px, traço 1,4, `round`, âmbar `am` como o ◷ de hoje; pontos em `amf`):
  ```
  <path d="M-6 -5.5H6V3H-1.5L-4.5 6V3H-6Z"/>
  <circle cx="-2.8" cy="-1.2" r="0.95"/><circle cx="0" cy="-1.2" r="0.95"/><circle cx="2.8" cy="-1.2" r="0.95"/>
  ```
- Contagem: **a pergunta conta 1** (aberta enquanto espera; concluída ao ser respondida); as
  alternativas **não** contam.
- Várias perguntas numa chamada: **uma linha por pergunta**, cada uma com as suas alternativas.

## Hoje
- `hooks/tool-call.ts` `asked()` (linhas ~47–72): em `AskUserQuestion`/`ExitPlanMode`, grava um
  `Wait { agent, kind: 'question' | 'plan', tool, key }` (`addWait`) **antes** do `next(e)` (o
  diálogo abre dentro dele) e **apaga** no `finally` (`dropWaits`). O resultado `r` traz a resposta
  ("Your questions have been answered: \"<pergunta>\"=\"<resposta>\" …") ou, respondida por
  mensagem, "did not answer / sent a message instead" (`inChat`).
- `wrap_up` com `ask` (`tool-call.ts:74–86`): grava `Wait { kind: 'choice' }` e só sai no próximo
  prompt (`prompt-submit.ts:77`, `dropWaits`). Permissões (`hooks/permission.ts`): `kind:
  'permission'`.
- Desenho: `waitText` (`draw/layout.ts:562`) dá o texto fixo ("Aguardando sua resposta" etc.); a
  linha usa o tom `wait` e o ícone ◷ (`draw/svg.ts:322–324`). A linha fica sob a tarefa em
  andamento; some quando a resposta chega. Nos cartões de filha, as `waits` publicadas aparecem do
  mesmo jeito (`layout.ts:373`).
- Nenhum registro da pergunta sobrevive à resposta.

## Plano
1. **Registro persistente** (`$.state` + store, como `groups`): chave nova `asks` (tabela de
   durabilidade `state/durability.ts`, `lives: 'state+store'`, guardar as últimas ~50):
   `Ask = { key, agent, tool, at, anchor?: string, items: AskItem[], state: 'open' | 'answered' |
   'chat' | 'dropped' }`, `AskItem = { title: string; header?: string; options: string[]; multi?:
   boolean; chosen?: string[]; text?: string }`.
   - `anchor` = a tarefa em andamento do laço que pergunta (`current(...)`), onde a linha é desenhada
     (como a linha de espera hoje).
2. **Abertura** (`asked`, antes do `next(e)`):
   - `AskUserQuestion`: um `AskItem` por `questions[i]`: `title` = resumo da pergunta (a `question`
     limpa, 1ª frase, ~80 caracteres; o `header` vai no tooltip), `options` = `options[].label`,
     `multi` = `multiSelect`.
   - `ExitPlanMode`: um item "Aprovar o plano" com as alternativas "Aprovar" e "Continuar
     planejando".
   - `wrap_up` com `ask`: um item com `title` = `ask` e `options` = `actions[].label`.
   - Permissão: fica como hoje (linha de espera, sem alternativas).
3. **Resposta** (depois do `next(e)`):
   - Ler `r.result` (texto) por item: `"<pergunta>"="<resposta>"`. A resposta é casada com os
     labels: um label igual → `chosen=[label]`; `multi` → separar por vírgula e casar cada um; o
     que não casar com nenhum label → `text` = resumo da resposta (1ª frase, ~80 caracteres) e
     `chosen` = [].
   - `inChat` (respondida por mensagem): `state: 'chat'`; o resumo vem da **próxima mensagem do
     usuário** (`prompt-submit`, quando `reminders.answeredInChat`): `text` = 1ª frase dela.
   - `wrap_up`: a resposta chega no próximo prompt; se o texto do prompt é igual a um `label`/
     `message` das actions → `chosen`; senão `text` = resumo.
   - `ExitPlanMode`: aprovado → "Aprovar"; recusado → "Continuar planejando" (+ `text` com o
     feedback, se houver).
   - Sem resposta (turno abortado): `state: 'dropped'`.
4. **Desenho** (`draw/layout.ts`, `draw/svg.ts`): sob a âncora, **uma linha por item**:
   - Aberta: ícone **balão com reticências** âmbar, título = resumo da pergunta, filhas = as
     alternativas com ○ (pendentes), nesta ordem.
   - Respondida: o ícone da pergunta fica **✓ verde** (a pergunta conta 1 como concluída); as
     filhas: escolhidas **✓ verde**, as demais **✕ cinza**; com `text`, uma filha a mais
     "Resposta: <resumo>" com ✓ verde, e todas as alternativas com ✕.
   - `dropped`: a pergunta ✕ cinza, alternativas ✕.
   - Palavra apagada à direita da pergunta: "aguardando" / "respondida" / "por mensagem".
   - Contagem: a linha da pergunta entra em `count()` como uma folha (aberta → conta no total;
     respondida → conta como feita); as alternativas e a resposta não entram.
   - A linha de espera genérica (`waitText` "Aguardando sua resposta") deixa de ser desenhada para
     `question`/`plan`/`choice` com registro; fica só para permissão.
5. **Cartão da filha**: `asks` publicado no arquivo da sessão (`io/publish.ts`) e lido pela mãe
   (`io/host.ts`); o desenho do cartão usa o mesmo componente.
6. **Pulo** na troca de estado (aberta → respondida) e fade das alternativas, pelas animações já
   existentes (`mark()`, chave `ask:<key>:<i>`).
7. Terminal: glifo do balão (`…` num balão não existe em texto: usar `◌` ou `?` âmbar) e as
   alternativas com ○/✓/✕.
8. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual: uma
   pergunta com 3 alternativas (aberta: balão âmbar + 3 ○; respondida: ✓ na escolhida, ✕ nas
   outras), resposta em "Other" (linha "Resposta: …" ✓), duas perguntas numa chamada (duas
   linhas), múltipla escolha (várias ✓), resposta por mensagem no chat, wrap_up com ask e
   ExitPlanMode; no cartão de uma filha também.
