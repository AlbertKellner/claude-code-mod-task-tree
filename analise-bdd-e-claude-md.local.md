# BDD e CLAUDE.md do task-tree (desenho e texto proposto)

Base: branch `test/regressivos-automacao-testes`, topo `fbf3c5c` (replano preserva o estado), com `task-tree/tests/pedidos.test.ts` modificado e sem commit (é da Implementação). Nada foi editado.

## Essencial

- **O repositório não tem CLAUDE.md** (nem na raiz nem em `task-tree/`). O `task-tree/DESENVOLVIMENTO.md` (l. 6) aponta para `../CLAUDE.md` "Comportamento dos mods", um link quebrado. O texto que chega às sessões como "CLAUDE.md" vem do plugin brainstorm-harness, não deste repositório.
- **Proposta:** criar o `CLAUDE.md` na **raiz**, com:
  - como testamos;
  - como executar;
  - BDD: como e quando;
  - fluxo de trabalho;
  - edição sem quebrar a recarga;
  - checklist do app;
  - release/PR;
  - o princípio "regra de uso do painel vai nas RULES".
- **Catálogo BDD** em `regras/<área>.md`, na raiz e **fora de `task-tree/`**, porque `task-tree/` é o que o marketplace publica.
  - Um cenário Dado/Quando/Então por regra, com um id descritivo estável (`turnos.pendentes-seguem-pendentes`, sem códigos numéricos), origem e data, e estado: coberto, pendente ou checklist.
  - O teste cita o id num comentário `// Regra: <id>`.
  - Um script de ~60 linhas (`scripts/regras.mjs`) roda como primeira etapa do `npm run check` e confere a ligação nos dois sentidos.
- **Sem cucumber:** o `claude plugin test` roda os testes dentro do binário, sem fs e só com `claude-code/testing`; um runner Gherkin exigiria um segundo motor de teste fora do mod.
- O backfill tem 77 regras: 39 cobertas, 22 pendentes e 16 de checklist do app.
- **Dúvida:** atualizar também a seção "Validar" do `DESENVOLVIMENTO.md` (diz que a suíte foi removida, o que está desatualizado) com uma linha apontando para o CLAUDE.md?

## 1. O que existe, o que está desatualizado, o que falta

O que existe hoje:
- `README.md`: instalação, atualização e remoção pelo marketplace; desenvolvimento com `claude --plugin-dir ./task-tree`.
- `task-tree/DESENVOLVIMENTO.md` (1,5 mil linhas): arquitetura, hooks, durabilidade, limites do kit, "O que só é verificável no app", histórico de decisões por fase.
- `package.json`: `npm run check`.
- `scripts/testes.mjs`: validate do marketplace e do mod `--strict`, tsc (só aviso), `plugin test`.
- `.github/workflows/release.yml`: a versão sobe sozinha no merge do PR pelo título (`feat` → minor; `!` ou `BREAKING CHANGE` → major; o resto → patch).

Desatualizado:
1. `DESENVOLVIMENTO.md` "Validar" (l. 589–601): diz que a suíte foi removida e cita só o `validate`. Hoje há `npm run check` e 6 arquivos de teste.
2. `DESENVOLVIMENTO.md` l. 6: o link `../CLAUDE.md` não existe. Fica resolvido ao criar o CLAUDE.md com a seção "Regras de uso do painel".
3. A memória do Claude Code "sem testes nem docs no task-tree" (2026-10-23) está superada: a suíte voltou (decisão do usuário) e há docs aprovados neste escopo. Quem atualiza é a orquestradora; está fora do repositório.

Falta documentar, por prioridade:
1. **Como testamos e como executar:** `npm run check`, o que cada etapa faz, o binário e a versão (`CLAUDE_BIN`), tsc só como aviso (58 erros antigos), onde ficam os testes e o kit.
2. **BDD:** onde fica o catálogo, o formato, quando escrever (antes de implementar, na análise), a ligação com o teste e a verificação automática.
3. **Fluxo de trabalho:**
   - análise antes de implementar (mesmo itens triviais);
   - um commit local por item;
   - o usuário valida no app antes do commit;
   - push e PR só a pedido;
   - o cenário que reproduz um bug entra no mesmo commit da correção (sem exigir vermelho antes);
   - um bug achado é corrigido sem perguntar e relatado;
   - painel errado é bug do plugin, nunca se adapta o uso;
   - decisão anterior do usuário que a correção contradiz vira pergunta, não decisão.
4. **Edição sem quebrar a recarga:** o clone recarrega a cada save, em todas as sessões. Mudança em vários arquivos vai de uma vez (cópia no scratchpad e cópia única) e passa pelo `npm run check` antes do passo seguinte. Os limites do kit do validate (chaves de `$.state` literais etc.) ficam como referência ao `DESENVOLVIMENTO.md`.
5. **Limites do harness:** 5 s por teste; um processo por arquivo; sem fs, rede nem processo; não verifica a pintura; sem recarga simulada (cada teste é um módulo novo com o estado vazio); os stubs `on` são registrados antes da primeira chamada a `$`.
6. **Checklist do app:** o que só a validação visual pega (largura, cliques, tooltip, animação, recarga real, sessões filhas reais, avisos do app, `turn.step`, status).
7. **Release e PR:** a versão sai do título do PR (Conventional Commits); não editar a versão do `plugin.json` à mão; título e descrição atualizados a cada push; labels (as regras globais do usuário já pedem isso: só citar).
8. **Regras de uso do painel:** regra nova de uso vai nas `RULES` ou nos textos de `text/rules.ts`, nunca na memória nem num CLAUDE.md da máquina. É o princípio que o `DESENVOLVIMENTO.md` já cita.

**Não** vai ao CLAUDE.md (o código, o git ou o `DESENVOLVIMENTO.md` já dizem):
- arquitetura, hooks, chaves de estado, durabilidade;
- histórico de decisões por fase e commits;
- a lista das regras em si (vai ao catálogo `regras/`);
- instruções de instalação (README);
- detalhes do kit além dos limites práticos;
- assinaturas dos helpers (o código de `tests/kit/` diz).

## 2. Desenho do BDD

**Onde:** `regras/` na raiz do repositório, um arquivo por área, espelhando os arquivos de teste:
- `arvore.md`, `turnos.md`, `pedidos.md`, `perguntas.md`, `lembretes.md`, `envios.md`, `sessoes.md`, `cabecalho.md`, `durabilidade.md`, `visual.md`, `fumaca.md`;
- mais um `regras/README.md` curto, com o formato.

Fora de `task-tree/` porque essa pasta é publicada pelo marketplace e o catálogo é do repositório.

**Formato de um cenário:**

```markdown
### turnos.pendentes-seguem-pendentes
Pendentes seguem pendentes no fim do turno, na principal e nas filhas.

- Dado um plano com uma tarefa concluída e outras nunca iniciadas
- Quando o turno termina (normal ou Esc), na sessão principal ou numa filha
- Então as nunca iniciadas seguem ○ pendentes, nunca ✕, e o cabeçalho as conta

Origem: decisão do usuário, 2026-10-27 (desfaz "reaproveitar o interrompida", 2026-10-24); commit d57807e.
Estado: coberto
```

Regras:
- **id:** `<área>.<frase-curta-em-kebab>`, estável, sem números. Isso segue a preferência do usuário de descrever o item em vez de citar códigos. Um id renomeado exige atualizar o comentário dos testes; o script pega o esquecimento.
- **Título:** uma frase com a regra.
- **Dado/Quando/Então:** em português, em comportamento observável no painel ou nos textos ao modelo, sem nomes de função.
- **Origem:** "decisão do usuário, AAAA-MM-DD" (com as palavras dele entre aspas quando houver), ou "regra do painel desde a entrada do mod, 2026-10-20", mais o commit que a implementou.
- **Estado:**
  - `coberto`: há teste que a cita;
  - `pendente`: deve virar teste (o arquivo de destino entre parênteses, quando se sabe);
  - `checklist`: só o app mostra; o motivo entre parênteses.
- Quando a regra muda por decisão nova, o cenário é **reescrito** com a origem nova e a anterior citada em "desfaz…". O histórico fica no git.

**Ligação com o teste:** um comentário logo acima do `test(...)`, com um ou mais ids separados por vírgula:
```ts
// Regra: turnos.pendentes-seguem-pendentes, turnos.pai-e-pedido-aguardam-no-fim
test('fim do turno com uma tarefa iniciada: ela aguarda e as outras seguem pendentes', ...)
```
O comentário "Origem:" que os testes já têm é substituído pelo `// Regra:`; a origem passa a viver no catálogo.

**Verificação automática** (`scripts/regras.mjs`, Node puro, sem dependências):
1. Lê `regras/*.md` (menos o `README.md`). Cada `### <id>` abre um cenário, e a primeira linha `Estado: <x>` depois dele dá o estado.
2. Lê `task-tree/tests/**/*.test.ts(x)`. Cada `// Regra: a, b` imediatamente antes de uma linha `test(` liga esses ids ao teste.
3. Falha (exit 1), listando cada problema, quando:
   - (a) um id do catálogo se repete ou tem formato inválido;
   - (b) um cenário não tem `Estado:` válido;
   - (c) um cenário `coberto` não é citado por nenhum teste;
   - (d) um teste cita um id que não existe no catálogo;
   - (e) um cenário `pendente` ou `checklist` é citado por um teste: o estado deve virar `coberto`;
   - (f) um `test(` sem `// Regra:` acima. Exceção: `fumaca.test.ts` também cita o seu id, então não há exceção.
4. Imprime um resumo: N cobertos, N pendentes, N checklist.

Entra como **primeira etapa** de `scripts/testes.mjs` (bloqueia; roda em milissegundos, antes do validate).

**Cucumber/Gherkin: não.**
- O `claude plugin test` roda cada arquivo dentro do binário do Claude Code, sem fs nem pacotes além de `claude-code/testing`. Um `.feature` executável exigiria outro runner, em Node, fora do motor que carrega o mod de verdade.
- Duplicaria os steps e quebraria a premissa de testar pelo motor real.
- O ganho (texto executável) já vem da ligação id↔teste com a verificação automática.

## 3. Catálogo inicial (backfill)

Formato compacto abaixo. A Implementação expande cada entrada no formato da seção 2.

### `regras/fumaca.md`
- **fumaca.plan-mostra-tarefa**: Dado o mod carregado. Quando o modelo chama `plan` com uma tarefa. Então ela aparece no painel. Origem: entrada do mod, 2026-10-20; commit 9980131. **coberto** (`fumaca.test.ts`).

### `regras/arvore.md`
- **arvore.pai-fecha-com-os-filhos**: Dado um pai com filhas. Quando todas são concluídas. Então o pai e os ancestrais ficam ✓ sem `done` próprio, e o `done` não traz avisos. Origem: regra do painel desde a entrada do mod, 2026-10-20. **coberto** (arvore: "pai fecha sozinho…").
- **arvore.start-reabre-pais**: Dado uma árvore toda concluída. Quando `start` numa folha. Então ela e os pais voltam a ◉, e as irmãs seguem ✓. Origem: idem. **coberto** (arvore: "start reabre…").
- **arvore.start-recusa-pai-concluido**: Dado um pai ✓ com filhas. Quando `start` nele. Então é recusado ("replaneje o nível 1") e nada muda. Origem: idem. **coberto** (arvore: "start reabre…").
- **arvore.sem-start-nada-acende**: Dado um plano novo. Quando nenhum `start` foi chamado. Então tudo fica ○. Origem: decisão do usuário, 2026-10-23; commit b742294. **coberto** (turnos: "sem start, plano novo…").
- **arvore.pai-em-andamento-no-caminho-da-ultima-iniciada**: Dado `start` e `done` numa filha, sem outro `start`, no mesmo turno. Quando o painel é desenhado. Então o pai e o pedido aparecem ◉ (não ◷), e o chip "em andamento" não conta o pai. Origem: decisão do usuário, 2026-10-27 ("pai aberto deve mostrar ◉ em andamento"), sobre "Pai aguardando" de 2026-10-20; commit a201198. **coberto** (arvore: "pai fecha sozinho…").
- **arvore.ids-curtos-e-avisos**: Dado ids repetidos entre planos. Quando `start`/`done` com id curto ambíguo, inexistente ou de outro agente. Então a resposta avisa cada caso. Origem: regra do painel, 2026-10-20. **pendente** (arvore).
- **arvore.done-sem-summary-e-varias-sem-start**: Dado o último `done` do pedido sem `summary`, ou várias tarefas fechadas juntas sem `start`. Quando o `done` responde. Então traz o aviso. Origem: regra do painel. **pendente** (arvore).
- **arvore.plan-recusa-ids-repetidos**: Dado um plano com ids repetidos. Quando `plan`. Então é recusado com erro e nada muda. Origem: regra do painel. **pendente** (arvore).

### `regras/turnos.md`
- **turnos.iniciada-aguarda-no-fim**: Dado uma tarefa iniciada e aberta. Quando o turno termina normalmente. Então ela fica ◷ com o relógio parado, e o pai ◷. Origem: decisão do usuário, 2026-10-27; commit 95b1a21. **coberto** (turnos: 2 testes).
- **turnos.pendentes-seguem-pendentes**: Dado tarefas nunca iniciadas. Quando o turno termina (normal ou Esc). Então seguem ○ e entram em "pendentes". Origem: decisão do usuário, 2026-10-27 (desfaz "reaproveitar o interrompida", 2026-10-24); commit d57807e. **coberto** (turnos: 3 testes).
- **turnos.pai-e-pedido-aguardam-no-fim**: Dado algo concluído ou aguardando embaixo. Quando o turno termina. Então o pai aberto e o pedido ficam ◷. Origem: "Pai aguardando", 2026-10-20 ("nas tarefas que estao aguardando e ja tem alguma tarefa concluida, marque os pais como aguardando"). **coberto** (turnos).
- **turnos.esc-interrompe-so-a-iniciada**: Dado uma tarefa iniciada. Quando a pessoa para o turno (Esc). Então só ela fica ✕; as pendentes ○; o pai sem nada feito ○. Origem: decisão do usuário, 2026-10-27; commit d57807e. **coberto** (turnos).
- **turnos.prompt-seguinte-retoma**: Dado um turno terminado (normal ou Esc). Quando chega a mensagem seguinte e o modelo dá `start`. Então nada fica ✕ e a tarefa acende ◉. Origem: commit 55a2dd1, 2026-10-23. **coberto** (turnos).
- **turnos.pedido-anterior-parado-aguarda**: Dado um pedido anterior com algo feito e algo aberto. Quando um pedido novo está em andamento. Então o anterior fica ◷ e o novo ◉. Origem: decisão do usuário, 2026-10-27, sobre a regra de 2026-10-20. **coberto** (turnos).
- **turnos.continuacao-sem-start-aguarda**: Dado um prompt novo que continua o plano. Quando ainda não houve `start`. Então o pai fica ◷. Origem: decisão do usuário, 2026-10-27. **coberto** (turnos).
- **turnos.pai-com-filha-concluida-nunca-interrompido**: Dado um pai com uma filha ✓. Quando o resto fica ✕ (Esc, subagente). Então o pai fica ◷, nunca ✕. Origem: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"); commit 95b1a21. **coberto** (pedidos: "no Esc, pai com filha concluída…").
- **turnos.subagente-que-termina-interrompe**: Dado um subagente com tarefas abertas. Quando ele termina. Então o que deixou aberto fica ✕. Origem: regra do painel, 2026-10-20. **pendente** (sessoes, se o kit aceitar `agentId` no fim do turno; senão, checklist).
- **turnos.prompt-sem-turno**: Dado um hand-back de subagente ou uma notificação de tarefa em segundo plano. Quando chega. Então não abre pedido nem zera os lembretes. Origem: regra do painel. **checklist** (o kit não simula a origem do prompt; confirmar).

### `regras/pedidos.md`
- **pedidos.titulo-vem-do-request**: Dado uma mensagem longa. Quando `plan` com `request`. Então a linha do pedido mostra o `request`. Origem: regra do painel. **coberto**.
- **pedidos.uma-mensagem-um-pedido**: Dado duas mensagens da pessoa, cada uma com o seu plano. Então cada plano fica sob o seu pedido, na ordem. Origem: regra do painel. **coberto**.
- **pedidos.aviso-do-app-nao-abre-pedido**: Dado um aviso do app (`<side-sessions-event>`). Quando chega. Então não abre pedido, e o plano seguinte entra no pedido atual. Origem: regra do painel. **coberto**.
- **pedidos.replano-no-lugar**: Dado um nível 1 aberto do pedido atual. Quando `plan` com o mesmo id. Então ele é substituído no mesmo lugar, sem ✕. Origem: decisão do usuário, 2026-10-21 (ordem do plano); commit 4af1b92. **coberto**.
- **pedidos.replano-preserva-estado**: Dado tarefas ◉ e ✓ num nível 1 aberto. Quando o modelo replaneja com o mesmo id no mesmo pedido. Então quem mantém o id mantém o estado; as novas entram ○; quem sai do plano some; um pai ✓ que ganha filha nova reabre. Origem: decisão do usuário, 2026-10-27; commit fbf3c5c. **coberto** (pedidos: 4 testes).
- **pedidos.replano-mantem-envio-ate-entrega**: Dado uma tarefa de mensagem com ✉ na fila. Quando o replano a tira do plano. Então ela segue visível com o ✉ até a entrega e depois some. Origem: decisão do usuário, 2026-10-27. **pendente** (envios: falta o helper de envio).
- **pedidos.plano-anterior-vira-historico**: Dado um nível 1 aberto de pedido anterior. Quando um pedido novo traz `plan` com o mesmo id. Então o antigo fica ✕, renomeado, sob o pedido antigo, e o novo fica sob o pedido novo. Origem: série 2, 2026-10-23; o usuário confirmou em 2026-10-27. **coberto**.
- **pedidos.nivel1-concluido-e-historico**: Dado um nível 1 ✓. Quando `plan` com o mesmo id. Então o ✓ fica como histórico e o plano novo vai ao lado. Origem: regra do painel. **coberto**.
- **pedidos.resumida-mantem-anteriores-com-algo-aberto**: Dado um pedido anterior com algo aberto à vista. Quando um pedido novo começa. Então a resumida mantém os dois; com tudo fechado, só o novo. Origem: decisão do usuário, 2026-10-23; commit 897c0d7. **pendente** (cabecalho).

### `regras/perguntas.md`
- **perguntas.sem-tarefa-recusada**: Dado nenhuma tarefa aberta. Quando `AskUserQuestion`. Então é recusada e o painel não mostra espera. Origem: regra do painel. **coberto**.
- **perguntas.espera-sob-a-tarefa**: Dado uma tarefa ◉. Quando a pergunta está aberta. Então aparece ◷ "Aguardando sua resposta" logo abaixo dela, que segue ◉. Origem: decisão do usuário, 2026-10-26; commit 309f9be. **coberto**.
- **perguntas.resposta-por-opcao-tira-espera**: Quando a pessoa escolhe uma opção. Então a espera some e a tarefa segue ◉. **coberto**.
- **perguntas.resposta-pelo-chat-tira-espera**: Quando a pessoa responde pelo chat. Então a espera some na hora, antes da mensagem dela chegar, e a tarefa segue ◉. Origem: decisão do usuário, 2026-10-27; commit cf5ea53. **coberto**.
- **perguntas.exitplanmode-espera**: Quando `ExitPlanMode` está aberto. Então aparece "Aguardando aprovação do plano" até a resposta. **coberto**.
- **perguntas.escolha-do-wrapup-ate-proxima-mensagem**: Quando um `wrap_up` com pergunta encerra o turno. Então "Aguardando sua escolha" fica até a próxima mensagem. **coberto**.
- **perguntas.permissao-espera**: Quando o app pede permissão para uma ferramenta (exceto pergunta e plano). Então aparece "Aguardando permissão: <ferramenta>". Origem: regra do painel. **pendente** (perguntas).

### `regras/lembretes.md`
- **lembretes.replanejar-apos-esc-pessoa**: Dado um turno parado pela pessoa, com tarefas abertas. Quando ela manda a mensagem seguinte. Então o modelo recebe o pedido de replanejar com a lista das abertas, no lugar da lista para fechar. Origem: decisão do usuário, 2026-10-27 ("precisa replanejar quando eu interrompo e envio nova mensagem"); commit d3ff1be. **coberto**.
- **lembretes.fim-normal-lista-abertas**: Dado um turno terminado normalmente com abertas. Quando chega a mensagem da pessoa. Então o modelo recebe a lista para fechar ou manter. **coberto**.
- **lembretes.outra-sessao-apos-esc**: Dado um turno parado. Quando a mensagem seguinte é de outra sessão. Então o modelo recebe o pedido de replanejar dessa origem. Origem: regra do painel, anterior a 2026-10-27. **coberto**.
- **lembretes.esc-sem-abertas**: Dado um turno parado sem nada aberto. Então não há pedido de replanejar. **coberto**.
- **lembretes.replanejar-vale-uma-vez**: Depois do lembrete, o turno seguinte volta ao lembrete normal. **coberto**.
- **lembretes.primeira-chamada-sem-plano**: Dado um pedido sem `plan`. Quando o modelo chama a primeira ferramenta e, depois, a cada 10. Então recebe o lembrete de planejar. Origem: regra do painel. **pendente** (lembretes).
- **lembretes.regras-no-prompt-de-sistema**: Dado as ferramentas do painel disponíveis. Quando o prompt de sistema é montado. Então a seção de regras do painel entra. **pendente** (lembretes).

### `regras/envios.md`
Todas **pendentes** (tarefa 4, `envios.test.ts`):
- **envios.fica-ate-entrega**: o ✉ fica na tarefa, mesmo concluída, até a outra sessão receber. Origem: decisão do usuário, 2026-10-23; commit 109b92d.
- **envios.cor-por-estado**: o ✉ mantém o ícone e muda só a cor: azul na fila, verde entregue, cinza interrompida. Origem: decisão do usuário ("mantenha o ícone e troque somente a cor"), 2026-10-24; commit 8eb801c.
- **envios.ancora-no-lote-recente**: o envio vai ao lote recente de `start` sem envio; à tarefa antiga só depois; nunca à que tem pergunta aberta. Commit 26adf08.
- **envios.sem-tarefa-em-andamento-ancora-na-ultima-iniciada**: commit b742294.
- **envios.fila-nao-interrompe-no-fim-do-turno**: commit b897cac.
- **envios.mensagens-juntas-vao-a-ultima**: commit 8b67366.
- **envios.nivel1-recebido-mostra-carta**: um nível 1 aberto por mensagem de outra sessão mostra o ✉ de recebida, na cor do estado. Decisão do usuário ("o ícone do 'analisar a tarefa' deveria ser uma carta também"); commit 83f715d.

### `regras/sessoes.md`
Todas **pendentes** (tarefa 5), salvo indicação:
- **sessoes.cartao-sob-a-tarefa-de-origem**: o cartão da filha fica sob a tarefa de onde foi aberta, ou da última rodada.
- **sessoes.cadeia-sem-cartao-dentro-de-cartao**: commit fddd473.
- **sessoes.mensagem-entre-filhas-no-cartao-da-remetente**: commit 28ae764.
- **sessoes.filha-trabalhando-mantem-pais-em-andamento**: mesmo com `done`. Commit d956e11.
- **sessoes.filha-parada-pendentes-seguem-pendentes**: decisão do usuário, 2026-10-27; commit d57807e. **checklist**, até o kit ter stub do host.
- **sessoes.filha-arquivada-interrompe**: ✕, e o pai com filha ✓ ◷. **checklist**, idem.
- **sessoes.rodada-descartada-fora-da-contagem**: commit bf77359.
- **sessoes.busto-so-no-pai**: commit e570baa.
- **sessoes.pasta-sem-git**: ícone de pasta e caminho, sem branch. Commit 17f1140.
- **sessoes.toks-por-segundo-e-repo-branch**: commits 1987482, 689d569. **checklist**.

### `regras/cabecalho.md`
Todas **pendentes** (tarefa 6):
- **cabecalho.numeros-somam-o-desenhado**: recolher não muda os números. Decisão do usuário ("deve somar"); commit 3e79cb8.
- **cabecalho.resumida-exclui-pedido-finalizado**.
- **cabecalho.interrompida-fora-do-total**: entra no chip "interrompidas".
- **cabecalho.limites-de-linhas**: "+N pedidos anteriores", "+N cartões antigos".
- **cabecalho.titulo-e-a-ultima-iniciada**.

### `regras/durabilidade.md`
Todas **pendentes** (tarefa 7):
- **durabilidade.reinicio-restaura-do-store**.
- **durabilidade.formatos-antigos-do-publicado**: os 8 formatos são lidos.
- **durabilidade.recarga-mantem-painel-ligacoes-e-resumo**: **checklist** (o kit não simula a recarga), ou pendente com estado semeado.

### `regras/visual.md`
Todas **checklist**:
- **visual.largura-real**: termina na borda real em qualquer fonte. Commit 6c706e7.
- **visual.cliques-no-icone-e-no-anel**.
- **visual.tooltip**.
- **visual.animacao-de-linha-nova**.
- **visual.cores-dos-temas**.
- **visual.cabecalho-em-cartao**.
- **visual.status-embaixo-da-caixa**.

Os números da seção "Essencial" contam as linhas acima: há regras com dois testes, e alguns testes citam duas regras.

**Testes atuais × ids** (para a Implementação pôr o `// Regra:`):
- `arvore.test.ts`:
  - "pai fecha sozinho…" → `arvore.pai-fecha-com-os-filhos`, `arvore.pai-em-andamento-no-caminho-da-ultima-iniciada`
  - "start reabre…" → `arvore.start-reabre-pais`, `arvore.start-recusa-pai-concluido`
- `fumaca.test.ts` → `fumaca.plan-mostra-tarefa`
- `turnos.test.ts`:
  - "sem start, plano novo…" → `arvore.sem-start-nada-acende`
  - "no fim do turno o pai aberto…" → `turnos.pai-e-pedido-aguardam-no-fim`, `turnos.pendentes-seguem-pendentes`
  - "no fim do turno a tarefa iniciada…" → `turnos.iniciada-aguarda-no-fim`
  - "pedido anterior parado…" → `turnos.pedido-anterior-parado-aguarda`
  - "prompt novo que continua…" → `turnos.continuacao-sem-start-aguarda`
  - "fim do turno sem nenhum start…" → `turnos.pendentes-seguem-pendentes`
  - "fim do turno com uma tarefa iniciada…" → `turnos.iniciada-aguarda-no-fim`, `turnos.pendentes-seguem-pendentes`
  - "Esc interrompe só…" → `turnos.esc-interrompe-so-a-iniciada`
  - "o prompt seguinte…" → `turnos.prompt-seguinte-retoma`
- `pedidos.test.ts`, cada teste com o id do mesmo nome (título, uma mensagem, aviso, replano no lugar e plano anterior, pai com filha concluída, os 4 de replano preserva, nível 1 concluído).
- `perguntas.test.ts`: 6 testes → os 6 ids cobertos.
- `lembretes.test.ts`: 5 testes → os 5 ids cobertos.

## 4. Texto proposto do `CLAUDE.md` (raiz)

```markdown
# claude-code-mod-task-tree

Mod do Claude Code (`task-tree/`) que desenha a árvore de tarefas da sessão num painel lateral.
Arquitetura e histórico de decisões: [task-tree/DESENVOLVIMENTO.md](task-tree/DESENVOLVIMENTO.md).
Regras de comportamento, uma por cenário: [regras/](regras/).

## Fluxo de trabalho

- Toda mudança passa por análise antes da implementação, mesmo as triviais.
- Um commit local por item. Push e PR só quando o usuário pedir.
- O usuário valida no app antes do commit; a validação visual final é dele.
- Painel errado é bug do plugin: corrige-se o plugin, nunca o jeito de usar.
- Bug achado é corrigido e relatado depois, sem pedir permissão. Se a correção contradiz uma decisão
  anterior do usuário (veja a origem no catálogo `regras/`), vira pergunta antes.
- Correção de bug traz, no mesmo commit, o teste que reproduz o bug (não precisa estar vermelho antes)
  e o cenário no catálogo.

## Como testamos

- Testes de comportamento em `task-tree/tests/*.test.ts`, um arquivo por área, rodando o mod de
  verdade no harness oficial (`claude plugin test`, kit `claude-code/testing`).
- `task-tree/tests/kit/` concentra o roteiro (`plan`, `start`, `done`, `pedido`, `fimDoTurno`, `esc`…),
  o ambiente fixo (relógio parado) e a leitura do painel em comportamento (título e estado de cada
  linha, pela superfície terminal). Os testes falam de títulos e estados, nunca de funções internas.
- Limites do harness: 5 s por teste; um processo por arquivo; sem fs, rede ou processo dentro do
  teste; não verifica a pintura (cores, largura, cliques); não simula a recarga a quente (cada teste
  é um módulo novo com o estado vazio). Stubs `on(...)` vão antes da primeira chamada a `$`.
- O que o harness não alcança vai ao checklist do app (abaixo) e fica marcado `checklist` no catálogo.

## Como executar

    npm install      # uma vez: typescript para o tsc
    npm run check

Etapas, nessa ordem; a primeira que falha para:
1. `regras`: confere o catálogo `regras/` contra os testes (ids, estados, ligações).
2. `claude plugin validate . --strict` e `claude plugin validate task-tree --strict`: manifesto do
   marketplace e do mod; também gera `task-tree/.claude-plugin/types/` (ignorado pelo git).
3. `tsc --noEmit`: só aviso por enquanto (erros de tipo antigos). Passa a bloquear quando zerar:
   corrigir aos poucos, junto com mudanças nos mesmos arquivos.
4. `claude plugin test task-tree`: todos os testes.

O binário é o do app desktop, na versão mais nova em `%APPDATA%\Claude\claude-code\<versão>\`;
`CLAUDE_BIN` escolhe outro. Use a mesma versão que roda a sessão.

## BDD: o catálogo de regras

- Cada regra do painel é um cenário em `regras/<área>.md`: id estável, título, Dado/Quando/Então
  em comportamento observável, origem (decisão do usuário com data e as palavras dele, ou commit) e
  estado (`coberto`, `pendente`, `checklist`). Formato em [regras/README.md](regras/README.md).
- O teste cita a regra num comentário logo acima do `test(...)`: `// Regra: <id>[, <id>]`.
- Quando escrever: na análise, antes de implementar. Toda decisão nova do usuário vira cenário
  (novo ou reescrito, citando o que desfaz); a implementação liga o teste e muda o estado para
  `coberto` no mesmo commit.
- O `npm run check` falha se um cenário `coberto` não tem teste, se um teste cita id inexistente,
  se um teste não cita regra, ou se um teste cita um cenário ainda `pendente`/`checklist`.

## Editar o mod sem quebrar a recarga

- O mod costuma ser carregado deste clone e recarrega a cada arquivo salvo, em todas as sessões. Um
  estado intermediário que não compila aparece ao usuário como "reload failed" (a versão anterior
  segue carregada).
- Mudança em vários arquivos vai de uma vez: escreva numa cópia no scratchpad e copie tudo junto;
  rode `npm run check` antes do passo seguinte.
- Limites do validate que o código respeita (chave de `$.state` literal no arquivo que chama, `$`
  só em função de topo etc.): DESENVOLVIMENTO.md, "Limites do kit".

## Regras de uso do painel

Regra nova de como o modelo usa o painel vai em `task-tree/text/rules.ts` (`RULES`, descrições das
ferramentas, lembretes dos hooks), nunca na memória do Claude Code nem num CLAUDE.md da máquina.

## Checklist do app (validação visual do usuário)

Antes do commit, quando a mudança toca o que o harness não vê:
- largura real e recorte na borda, nos dois temas;
- cliques no ícone e no anel; tooltip; animação da linha nova; nada pisca à toa;
- recarga a quente real (salvar um arquivo com o painel aberto);
- sessões filhas reais (cartão, ✉ e entrega, filha parada e arquivada); avisos do app;
- modelo e esforço no cartão; status embaixo da caixa de mensagem.

## Release e PR

- A versão do plugin sobe sozinha no merge do PR, pelo título: `feat…` → minor; `!` depois do tipo
  ou `BREAKING CHANGE` no corpo → major; o resto → patch. Não edite a versão do `plugin.json`.
- Título no formato Conventional Commits; descrição e labels atualizadas a cada push.
```

## 5. Brief para a Implementação

Na branch `test/regressivos-automacao-testes`, **depois** do commit da Implementação que está em curso (há `pedidos.test.ts` modificado). Não misturar com ele.

Arquivos, escritos de uma vez (cópia no scratchpad e cópia única):
1. `CLAUDE.md` (raiz, novo): o texto da seção 4.
2. `regras/README.md` (novo): o formato da seção 2: id, título, Dado/Quando/Então, Origem, Estado, e a ligação `// Regra:`.
3. `regras/{fumaca,arvore,turnos,pedidos,perguntas,lembretes,envios,sessoes,cabecalho,durabilidade,visual}.md` (novos): o catálogo da seção 3, expandido no formato da seção 2, cada um com Dado/Quando/Então completos e a Origem como está.
4. `scripts/regras.mjs` (novo): a verificação da seção 2. Node puro, `fs` e `path`; regex `^### ([a-z0-9]+(?:\.[a-z0-9-]+)+)$` para os ids e `^Estado: (coberto|pendente|checklist)\b` para o estado; nos testes, `// Regra: (.+)` na linha imediatamente acima de `^\s*test\(`. Imprime os problemas e o resumo; `process.exit(1)` se houver problema.
5. `scripts/testes.mjs`: a nova primeira etapa `['regras', 'node', ['scripts/regras.mjs'], true]` (o `rodar` usa `shell` só para `claude`/`npx`: conferir que `node` resolve no PATH; senão, usar `process.execPath`).
6. `task-tree/tests/*.test.ts`: trocar cada comentário `// Origem: …` acima de um `test(` por `// Regra: <ids>`, conforme o mapeamento da seção 3, e acrescentar onde falta (os testes de `turnos`, `lembretes` e `perguntas` que não têm comentário próprio). Não mexer no corpo dos testes. Os comentários de bloco no topo dos arquivos podem ficar.
7. Rodar `npm run check`. A etapa `regras` deve passar com "N cobertos, N pendentes, N checklist".

Commits (dois, nessa ordem):
1. `test(task-tree): catálogo de regras (BDD) ligado aos testes e conferido no check`: `regras/`, `scripts/regras.mjs`, `scripts/testes.mjs` e os `task-tree/tests/*.test.ts` (só os comentários).
2. `docs: CLAUDE.md com fluxo, testes, BDD, recarga e checklist do app`: só o `CLAUDE.md`.

Use `git commit -- <caminhos>` em cada um.

O usuário valida lendo:
- o `CLAUDE.md`, se diz o que se pratica e se falta algo;
- dois ou três arquivos de `regras/` (por exemplo, `turnos.md` e `pedidos.md`): se cada regra está nas palavras dele, com a data e a origem certas, e se os estados batem;
- a saída do `npm run check`, com a linha de resumo do catálogo.

Relatar:
- os hashes;
- o resumo da etapa `regras`;
- algum teste sem regra clara, ou regra sem teste que o mapeamento não previu.

## Dúvidas para o usuário

1. A seção "Validar" do `task-tree/DESENVOLVIMENTO.md` diz que a suíte foi removida, o que está desatualizado. Posso trocar esse parágrafo por uma linha que aponta para o CLAUDE.md? Recomendado: sim, é uma correção de duas linhas no mesmo commit do CLAUDE.md.
2. Os ids do catálogo são frases curtas (`turnos.pendentes-seguem-pendentes`), não códigos numéricos, para seguir a preferência de descrever o item. Está bom assim?
