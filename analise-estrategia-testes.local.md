# Análise: estratégia de testes regressivos e de aceite do task-tree

Pedido do usuário: "pensar como validar layout e regras de negócio do plugin e garantir que o que já funcionava continue funcionando ao criar funcionalidade ou corrigir bug."

Base: `main` em `6c706e7` (2026-10-27). Fontes: código em `task-tree/`, `task-tree/DESENVOLVIMENTO.md`, `git log`, commits `b9cd016` (remoção da suíte) e `042b359`, memórias do projeto. Nada foi editado.

## Essencial

- O mod já é bem separado: **desenho e regras da árvore são puros** (`draw/`, `state/tasks.ts`, `text/rules.ts`, partes puras de `io/`); só `hooks/` toca `$.state`. Isso permite testar quase toda regra de negócio e o SVG **sem o app**.
- A suíte antiga (33 arquivos, ~8,5 mil linhas, um `task-tree.test.ts` de 3,9 mil) foi removida em 2026-10-23 por decisão do usuário ("vai seguir outra abordagem"; ideia registrada: testes integrados por roteiro/foto). Ela era unitária e acoplada a detalhes; mudava a cada correção do mesmo dia (TDD + goldens letra a letra) e travava o ritmo.
- Proposta: **regressivo por cenários de ponta a ponta sobre o modelo** (roteiro de chamadas de hook → estado → linhas do layout → SVG), com **fotos aprovadas pelo usuário** como golden visual, e um **checklist curto de aceite no app** para o que só o app mostra. Poucos cenários, cada um nascido de um bug real ou de uma regra confirmada pelo usuário.

## 1. Como o mod funciona hoje

Entrada (14 hooks em `hooks/register.tsx`):
- `session.start` / `classic.SessionStart` (`session-start.ts`): registra `/task-tree` e as tools `plan`, `done`, `start`; restaura do store; abre o pane; lê sessões filhas.
- `prompt.submit` / `prompt.compose` (`prompt-submit.ts`): classifica o prompt (`said`, pura: pessoa, outra sessão `<cross-session-message`, hand-back, aviso do app), abre turno, injeta `RULES` no prompt de sistema.
- `tool.call` específicos (`tools.ts`): `planTool`, `doneTool`, `startTool`.
- `tool.call` genérico (`tool-call.ts`): `Agent` (launches), `AskUserQuestion`/`ExitPlanMode` (pergunta), `wrap_up` (recap/ask), `SendMessage` (envio ✉, rodadas), `start_session` (filhas), lembretes `UNPLANNED`.
- `turn.step`, `turn.complete` (`turn.ts`): modelo/esforço; fim do turno grava reply/brief, interrompe o que ficou aberto, `turnEnded`.
- `permission.ts`, `command.ts` (`/task-tree resumida|completa`), `render.tsx` (`ui.render`, `ui.press`).

Estado, em três camadas (tabela `TABLE` em `state/durability.ts`):
- `$.state`: sobrevive à recarga a quente, não ao reinício.
- store (`session:<uuid>`, 30 mais novas): sobrevive ao reinício/resume.
- variáveis de módulo (`loaded`, `keptLinks`, `ownId`, relógios, `lastStatus`…): morrem a cada recarga.
- Arquivo publicado (`io/publish.ts`, versionado; 8 formatos históricos lidos) para outras sessões lerem o painel das filhas.

Regra × renderização:
- Regras da árvore: `state/tasks.ts` (`build`, `resolve`, `finish`, `settle`, `begin`…), puro.
- Modelo → linhas: `draw/layout.ts` (`layout(model, choices, now, ownId): Row[]`), puro, ~1,3 mil linhas: visões resumida/completa, cartões de sessão, âncoras de envio, limites, contagens do cabeçalho.
- Linhas → SVG: `draw/svg.ts`, `draw/geometry.ts`, `draw/motion.ts`, puros.
- Integração com o app: `hooks/render.tsx` (Svg/Box/Button, cliques, tooltip), `hooks/panel.ts` (`change`/`persist`/`publishPanel`), `hooks/sessions.ts` (poll 3 s, relógio 1 s), `io/host.ts` (lista do host; `parseSessions`, `mineOf`, `panelOf`, `deriveChildren` puros), `io/git.ts`.

Puras (testáveis sem app): `draw/*`, `state/tasks.ts`, `text/rules.ts`, `said`, `brief`, `parsePublished`, `parseSessions`, `mineOf`, `panelOf`, `engineText`, `deriveChildren`.
Dependem do engine `$`: tudo em `hooks/`, `io/publish.ts` (leitura/escrita), `state/durability.ts` (store).

## 2. Comportamentos a proteger (por área)

Árvore e ferramentas
- `plan`: até 3 níveis, ids únicos, prefixo do nível 1 abaixo dele; substituir no lugar só o nível 1 aberto do pedido atual; nível 1 aberto de pedido anterior vira interrompido e renomeado; colisão com fechado renomeia e leva junto as ligações (sessões, launches, envios).
- `done`: id curto/completo, avisos (inexistente, ambíguo, outro agente, interrompida, envio na fila, sem summary, várias sem start); pai fecha quando todos os filhos fecham; `summary` vira a linha ↩.
- `start`: reabre pais; recusa pai concluído com filhos.
- Sem `start`, nada fica em andamento.

Turnos e pedidos
- Agrupamento por mensagem do usuário com o título de `request`; resumida mostra até 3 pedidos e mantém os anteriores enquanto houver algo aberto à vista.
- Fim de turno: o que estava em andamento vira ◷ aguardando / interrompida conforme as regras atuais; pendentes seguem pendentes; pai com filha concluída nunca ✕; pedido com tarefa interrompida é ✕.
- Prompts que não abrem turno (aviso do app, hand-back, task-notification).

Perguntas
- `AskUserQuestion` sem tarefa aberta é recusado; pergunta vira linha ◷ "Aguardando sua resposta"; resposta (opção ou chat) fecha a espera.

Mensagens entre sessões (✉)
- Envio ancora na tarefa em andamento (lote recente de starts sem envio; nunca a que tem pergunta aberta); ✉ fica até a entrega; cor por estado (azul fila, verde entregue, cinza interrompida); nível 1 aberto por mensagem de outra sessão mostra ✉ de recebida.

Sessões filhas e cartões
- Cartão sob a tarefa de onde a sessão foi aberta (ou da última rodada); cadeias sem cartão dentro de cartão; tarefa e pais em andamento enquanto a filha trabalha; pendentes de filha parada viram interrompidas; rodada descartada sai das contagens; busto só no pai; toks/s, modelo, repo/branch, pasta sem git.

Cabeçalho e contagens
- Números somam o que a visão desenha (recolhido conta igual); resumida exclui pedido finalizado; limites "+N pedidos anteriores", "+N cartões antigos", `MAX_ROWS`.

Layout/visual
- Largura real do painel (direita ancorada na borda, sem piso de W, título recortado); cabeçalho em cartão; cores dos temas claro/escuro; conector com canto redondo; animação de linha nova (5 quadros, 500 ms); não-sobreposição de ícones/botões.

Durabilidade
- Recarga a quente sem `session.start` mantém painel, ligações, resumo; reinício/resume restaura do store; leitura dos 8 formatos do arquivo publicado.

Textos ao modelo
- `RULES`, lembretes e descrições das tools (são parte do contrato de uso).

## 3. O que já existe de validação

- `claude plugin validate .` e `claude plugin validate task-tree` (estrutura, limites do kit, lista de hooks, reads/writes de estado). Pega erro de compilação e violações que fariam o engine recusar o módulo.
- `tsc --noEmit` (citado no histórico; não é passo formal).
- Medições de desempenho registradas em `DESENVOLVIMENTO.md` (fase 6).
- Validação visual pelo usuário no app (fluxo atual).
- Suíte removida (`b9cd016`, 2026-10-23): unitários de layout/hooks puros, goldens de SVG e de textos (letra por letra, `golden/atualizar.mjs`), fixtures de estado real (`orquestradora-real.ts`, publicados), testes de durabilidade e reinício. Lições para não repetir:
  - goldens letra a letra de textos e SVG inteiros quebravam em toda correção legítima e viravam "atualizar golden" sem revisão;
  - um arquivo monolítico de 3,9 mil linhas; testes descrevendo detalhes internos (nomes de função, chaves) em vez de comportamento;
  - teste vermelho obrigatório antes de cada correção, no mesmo dia de dezenas de correções, travava o ritmo;
  - os testes não viam o que de fato regrediu na tela (largura, cliques, recarga real), que é onde o usuário encontrava os bugs.

## 4. Pontos frágeis a regressões

- Recarga a cada save do clone em todas as sessões: estado intermediário quebrado vira "reload failed"; variáveis de módulo zeradas (relógios, `loaded`, `keptLinks`, `lastStatus`).
- Ids: prefixo por nível 1, renomeação `<tag>:id` em colisão, ids curtos ambíguos, ligações que precisam seguir a renomeação.
- Estados e transições: em andamento / pendente / ◷ aguardando / interrompida / ✕ / concluída, especialmente no fim do turno e com filha trabalhando (histórico mostra revert `6150b45` e idas e voltas).
- ✉: âncora do envio, fila × entregue × interrompida, ✉ em tarefa já concluída.
- Cartões: lugar (âncora/última rodada), cadeia, resumida × completa.
- Lista do host parcial ou atrasada (poll 3 s), formatos antigos do arquivo publicado.
- Largura e fonte: série recente de commits (revert `f34e719`) só sobre largura real; depende do app.
- Contagens do cabeçalho × o que a visão desenha.
- Textos `RULES` (mudar a regra muda o comportamento do modelo).

## 5. Testável sem o app × exige o app

Sem o app (determinístico, roda em segundos):
- Regras da árvore e das tools: chamar `build/resolve/finish/settle/begin` e o layout sobre modelos.
- Cenários de ponta a ponta com um `$` falso: sequência de hooks (`prompt.submit` → `plan` → `start` → `SendMessage` → `done` → `turn.complete`) sobre um engine em memória (state + store), conferindo as `Row[]` do layout e as contagens. O histórico cita um "kit" que roda o desenho real; vale confirmar se é o kit oficial do plugin-dev/engine e reaproveitá-lo.
- Recarga simulada: zerar variáveis de módulo mantendo `$.state`; reinício: zerar `$.state` mantendo store.
- SVG: gerar o SVG de cada cenário e rasterizar para PNG (ex.: resvg) em larguras e temas fixos → comparação de imagem com tolerância, não de texto.
- Parsers puros (sessões do host, arquivo publicado das 8 versões).

Só no app (checklist de aceite do usuário):
- Pane na tela (larguras mínimas 110/144 colunas), largura real e fonte, cliques sobre ícone/anel, tooltip, piscar a cada segundo.
- Recarga a quente real e respawn do worker.
- Sessões filhas reais, latência, `startedBy`, `<side-sessions-event>`, `wrap_up` com `ask`.
- `turn.step` (modelo/esforço), `$.ui.status`, tamanho real aceito.

## Plano proposto (para decisão do usuário)

1. **Catálogo de cenários** (arquivo de texto, não código): cada regra da seção 2 vira um cenário curto em linguagem natural ("pedido novo com plan 1 enquanto o anterior tem filha trabalhando → …"), com a origem (bug/commit ou decisão do usuário). Serve tanto ao teste automático quanto ao roteiro manual.
2. **Regressivo automático por cenário** (opcional, se o usuário quiser automação): um runner pequeno com `$` falso que executa o roteiro de hooks e confere *comportamento observável* (estado de cada tarefa, onde fica cada ✉/cartão, números do cabeçalho), não strings internas. Poucos cenários (~20–30), um arquivo por área.
3. **Golden visual por foto**: para alguns cenários-chave, PNG do SVG em 2 temas × 2 larguras; diff de imagem com tolerância; atualização só depois de o usuário aprovar a imagem nova (a foto aprovada é o aceite).
4. **Aceite no app**: checklist curto (seção 5, "só no app") rodado pelo usuário antes do push; a sessão de implementação descreve qual item da lista a mudança afeta.
5. **Portão por mudança**: `claude plugin validate task-tree` + `tsc --noEmit` + regressivo (se existir) antes do commit local; edição multiarquivo num passo só (memória da recarga).

## Dúvidas para o usuário (via orquestradora)

1. A "outra abordagem" que motivou remover a suíte era testes integrados por roteiro/foto? Quer automação (itens 2–3) ou só catálogo + checklist manual (itens 1 e 4)?
2. Golden visual: aceita fotos PNG versionadas no repo (ou numa pasta fora dele) aprovadas por você?
3. Se houver testes automáticos, eles podem ficar no repositório (pasta `task-tree/tests/`) e rodar no CI de release, ou só localmente?
4. Ao corrigir bug, o cenário que reproduz o bug entra junto no mesmo commit (sem exigir que esteja vermelho antes)?
