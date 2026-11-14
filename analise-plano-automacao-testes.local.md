# Plano de implementação: automação de testes regressivos do task-tree

Base: `main` `6c706e7` (2026-10-27). Insumos: `analise-estrategia-testes.local.md`, `pesquisa-web-testes-mods.local.md`, o código e a suíte removida (`b9cd016~1:task-tree/tests/`). Nada foi editado.

## Essencial

- Conferido no binário do app (`%APPDATA%\Claude\claude-code\2.1.308\…\claude.exe`, v2.1.308): `claude plugin test [dir]` roda todo `*.test.ts` e `*.test.tsx` sob a pasta, cada arquivo num processo filho, com o kit `claude-code/testing`, e sai com 1 quando um teste falha. Não tem filtro, watch nem cobertura. `claude plugin validate` tem `--strict` e `--json`.
- **O "kit" citado no histórico do repositório é esse mesmo harness**: a suíte removida já importava `claude-code/testing` e usava `$.tool.call`, `$.ui.mount(...).drawn()` e stubs de `clock.now`/`clock.every`.
- Limite que dirige o desenho: o kit não deixa o teste ler nem gravar arquivos, nem ver variáveis de ambiente. Por isso o golden fica num módulo `.ts` importado pelo teste, e a atualização é feita por um script Node de fora, que recolhe as linhas `GOLDEN-NEW` que o teste emite (como fazia `atualizar.mjs`).
- Proposta: cerca de 8 arquivos de teste por área, de 4 a 8 cenários cada; uma camada de helpers de cenário que fala em comportamento ("estado da tarefa X", "✉ sob a tarefa Y", "cabeçalho 3/5"), não em nomes internos; e golden do texto do SVG **só em 6 a 8 cenários-chave**, com aprovação por uma página HTML que mostra lado a lado o SVG aprovado e o recebido.
- Portão: `npm run check` (validate --strict + tsc + plugin test). O CI vem depois, num job que baixa o binário na versão fixada.
- O trabalho fica em 9 commits pequenos, na ordem; a lista está em (f).

## (a) Estrutura de pastas e arquivos

```
task-tree/tests/
  kit/
    cenario.ts        # roteiro de hooks sobre $ (helpers da seção b)
    leitura.ts        # leitura do estado, das linhas, do cabeçalho e dos SVGs (em comportamento)
    ambiente.ts       # relógio fixo, stubs de host, git e fs, PROPS do pane (tema, largura)
  arvore.test.ts       # plan/start/done, ids, renomeação, pai e filhos, avisos das tools
  turnos.test.ts       # pedido novo, fim do turno, ◷ aguardando, interrompida, prompts sem turno
  perguntas.test.ts    # AskUserQuestion sem tarefa, espera, resposta por opção/chat
  envios.test.ts       # ✉: âncora, fila/entregue/interrompida, recebida
  sessoes.test.ts      # cartões de filhas: lugar, cadeia, filha trabalhando/parada, rodada descartada
  cabecalho.test.ts    # contagens por visão, recolhidos, limites "+N"
  durabilidade.test.ts # recarga (módulo novo, state mantido), reinício/resume (store), formatos publicados
  svg.test.ts          # golden do texto do SVG nos cenários-chave
  golden/
    svg.ts             # golden aprovado: { [cenario]: { tema, largura, svgs: string[] } }
scripts/ (na raiz do repositório, fora do mod)
  testes.mjs           # comando único: validate --strict, tsc, plugin test; acha o binário; exit code
  golden.mjs           # atualiza golden/svg.ts a partir dos GOLDEN-NEW e gera a página de aprovação
  golden-revisao.html  # gerado (ignorado pelo git): aprovado × recebido lado a lado
package.json (raiz)    # "check", "golden" e devDependency typescript fixada
```

Regras para não repetir os erros da suíte antiga:
- Nenhum arquivo passa de cerca de 300 linhas; nada de `task-tree.test.ts` monolítico.
- Os testes chamam as **ferramentas e hooks públicos** (`$.tool.call` de `mcp__task-tree__plan`, `$.prompt.submit`, `$.turn.complete`, `$.ui.mount`) e leem o resultado pelas helpers de `leitura.ts`. Não importam `layout()`, `settle()` etc., salvo para os parsers puros (`parsePublished`, `parseSessions`), que são contrato de formato.
- Asserções sobre comportamento observável: estado e ícone de cada linha, sob qual tarefa fica cada cartão ou ✉, os números do cabeçalho. Nunca sobre textos de `RULES` letra por letra: os textos ao modelo ficam fora do golden (no máximo um teste confere que `RULES` entra no prompt de sistema).
- O golden de SVG cobre poucos cenários e cada cenário é uma foto completa e pequena; o resto do layout é verificado por asserções semânticas, que sobrevivem a ajustes de pixel.
- O nome de cada teste diz a regra em português e a origem (commit ou decisão), sem códigos de relatório.

Os testes ficam dentro de `task-tree/` porque o `plugin test` roda a partir da pasta do mod. Confirmar no primeiro commit que `tests/` não entra na publicação do marketplace nem quebra o `validate`; a suíte antiga ficava no mesmo lugar sem problema.

## (b) Helpers de cenário

`kit/ambiente.ts`
- `fixar(on, { agora, tema, colunas })`: `clock.now` fixo, `clock.every` negado (sem relógio vivo), stubs de `ui.status`, `ui.log`, `ui.panes`, `process.run` (git: repo e branch fixos, ou "sem git") e `store.*` em memória (`mock.store`).
- `PROPS(colunas)` do Pane, como na suíte antiga.
- Lembrete do kit: todos os `on` são registrados antes da primeira chamada a `$`, e o módulo é recarregado a cada teste.

`kit/cenario.ts`: um roteiro fluente, `await` em cada passo
- `pedido($, texto)` → `$.prompt.submit` como mensagem da pessoa; `mensagemDe($, sessao, texto)` → `<cross-session-message>`; `aviso($)` → `<side-sessions-event>`.
- `plan($, tarefas, request?)`, `start($, ids)`, `done($, ids, summary?)`, todos via `$.tool.call`; `agente: 'sub-1'` opcional para subagente.
- `pergunta($, …)` → `AskUserQuestion` com `next` respondido; `envio($, para, { fila })` → `SendMessage`; `abrirSessao($, id)` → `start_session` com o resultado `local_…`; `wrapUp($, recap, ask?)`.
- `fimDoTurno($)` → `$.turn.complete`.
- `filhas(on, [{ id, running, painel }])`: stub da lista do host e do arquivo publicado de cada filha.
- `recarga($)`: recarrega o módulo mantendo `$.state`. Confirmar se o kit tem essa API; se não tiver, encerrar o teste e reabrir com o state copiado num stub, ou cobrir pela leitura do store. Fica marcado como dúvida técnica.
- `reinicio($)`: state vazio, store mantido, `$.session.start`.

`kit/leitura.ts`
- `painel($, { visao, colunas })`: monta o Pane (`$.ui.mount` com surface `desktop`) e devolve uma lista de linhas legíveis `{ nivel, titulo, estado: 'andamento'|'pendente'|'concluida'|'interrompida'|'aguardando'|'falhou', icones: ['✉-fila', …], cartao?: nomeDaSessao, sob: tituloDoPai }`, extraída do `alt`/texto dos elementos do desenho. Se o `alt` não bastar, a versão de terminal (`surface: 'terminal'`) é texto puro e mais fácil de ler.
- `cabecalho(...)` → `{ feitas, total, chips }`.
- `svgs(...)` → as fontes de `Svg`, em ordem (para o golden).
- `estado($)` → `$.state` cru, só para durabilidade.
- Uma asserção auxiliar `linha(painel, titulo)` com mensagem de erro que imprime o painel inteiro em texto, para depurar sem abrir o app.

## (c) Golden do texto do SVG

O que é, em uma linha para o usuário: um arquivo com o SVG que o painel gerou num cenário fixo e que ele aprovou. Se o código mudar o desenho, o teste falha e mostra o que mudou, até ele aprovar a versão nova.

- **Ambiente fixo:** relógio `NOW` fixo, sem animação (o quadro final de `motion`), 2 temas (escuro e claro) × 2 larguras (60 e 110 colunas), git fixo, ids de sessão fixos. A fonte do app não entra: o golden é o texto que o mod gera, não a pintura.
- **Normalização antes de comparar:** CRLF→LF e números arredondados a 2 casas, contra diferenças de float. `.gitattributes` com `task-tree/tests/golden/* text eol=lf` (o problema de `autocrlf` apontado na pesquisa).
- **Fluxo recebido/aprovado:**
  1. `svg.test.ts` compara cada cenário com `golden/svg.ts`; quando um diverge, falha mostrando o primeiro trecho diferente e emite `GOLDEN-NEW <cenario> <json>`.
  2. `npm run golden` roda o teste numa cópia, recolhe os `GOLDEN-NEW` e grava `scripts/golden-revisao.html` (ignorado pelo git), **sem** mexer no golden.
  3. O usuário abre a página e aprova cenário por cenário.
  4. `npm run golden -- --aprovar <cenario…|todos>` grava em `golden/svg.ts`, e o diff do git é a segunda conferência.
- **Página de aprovação:** HTML local estático, uma seção por cenário, com o SVG aprovado e o recebido lado a lado em cada tema e largura, um realce do que mudou (diff de texto embaixo) e o comando de aprovar para copiar. Também pode ser publicada como Artifact privado para o usuário ver pelo celular (opcional; os SVGs não têm dado sensível). Ela mostra o SVG renderizado pelo navegador, não pelo app: serve para o usuário reconhecer a mudança, e o aceite final continua no app.
- **Cenários-chave do golden** (uma foto cada, cobrindo os elementos visuais):
  1. Árvore de 3 níveis com todos os estados (andamento, pendente, concluída, interrompida, ◷ aguardando) e a linha ↩ do resumo.
  2. Pedido com pergunta aberta (linha ◷ "Aguardando sua resposta").
  3. Envios: ✉ em fila, entregue e interrompido, e um nível 1 aberto por mensagem recebida.
  4. Cartão de sessão filha trabalhando (busto, toks/s, modelo, repo/branch), com cadeia de duas filhas.
  5. Cabeçalho em cartão com repo/branch e pasta sem git.
  6. Título longo recortado na largura menor, com a direita ancorada na borda (largura real).
  7. Visão resumida com "+N pedidos anteriores".
  8. (Opcional) Tema claro só do cenário 1, se 2 temas em todos os cenários pesar.

  São de 7 a 8 cenários × 2 larguras (× 2 temas no cenário 1), algo como 20 fotos no máximo.

**Alternativa** (se o usuário preferir ver pixels): rasterizar os SVGs em PNG com `@resvg/resvg-js` e comparar com tolerância. Não recomendo agora: acrescenta uma dependência nativa, o resultado varia com a fonte instalada (o app usa a fonte dele) e o problema de "largura real" já se mostrou dependente do app. O texto do SVG é determinístico e o HTML já mostra a imagem. A alternativa volta à mesa se o golden de texto der falso positivo demais.

## (d) Primeiros cenários, por prioridade

Prioridade 1: regras que já regrediram (idas e voltas ou reverts no histórico).
1. Fim do turno: o que estava em andamento fica ◷ aguardando; as pendentes seguem pendentes; pai com filha concluída nunca fica ✕ (`95b1a21`, `55a2dd1`, revert `6150b45`).
2. Sem `start`, nada fica em andamento; o envio sem tarefa em andamento ancora na última iniciada (`b742294`).
3. ✉ fica na tarefa concluída até a entrega; cor por estado; envio vai ao lote recente de starts sem envio e nunca à tarefa com pergunta aberta (`109b92d`, `8eb801c`, `26adf08`).
4. Pergunta: `AskUserQuestion` sem tarefa aberta é recusada; a linha ◷ some com a resposta, seja por opção ou pelo chat (`309f9be`, `422fa88`, decisão de reverter a pergunta-como-tarefa).
5. `plan` com o mesmo id em pedido novo: o anterior aberto vira interrompido e renomeado, e cartões e envios seguem a renomeação (`cartões-ancora`, série 2).
6. Tarefa e pais ficam em andamento enquanto a filha trabalha, mesmo com `done`; pendentes de filha parada viram interrompidas (`d956e11`, `edb959f`).
7. Resumida mantém os pedidos anteriores enquanto houver algo aberto à vista; com tudo fechado, limpa (`897c0d7`, `46a4a1b`).
8. Cabeçalho: os números somam o que a visão desenha, recolher não muda nada, a resumida exclui o pedido finalizado (`3e79cb8`).
9. Recarga com o state mantido: o painel, as ligações e o resumo ↩ sobrevivem; reinício restaura do store (`lastbrief`, `h61-store`, `h32-links`).

Prioridade 2: regras estáveis, mas centrais.

10. Árvore: até 3 níveis, prefixo do nível 1, id curto ou completo, avisos de inexistente, ambíguo e de outro agente; pai fecha com os filhos; `start` reabre os pais e recusa pai concluído com filhos.
11. Mensagens entregues juntas: o cartão do turno vai para a tarefa da última (`8b67366`).
12. Cartões de cadeia sem cartão dentro de cartão; mensagem entre filhas fica no cartão da remetente (`fddd473`, `28ae764`).
13. Rodada descartada sai das contagens; busto só no pai (`bf77359`, `e570baa`).
14. Prompts que não abrem turno (aviso do app, hand-back, task-notification) e a classificação de `<cross-session-message>`.
15. Leitura dos 8 formatos do arquivo publicado e da lista do host parcial.
16. Limites `+N cartões antigos` e `MAX_ROWS`.

Prioridade 3: SVG.

17. Os 7 a 8 cenários-chave do golden (c).

Fica no **checklist manual do app**, que o kit não reproduz:
- largura e fonte reais e o recorte na borda;
- cliques no ícone e no anel nos dois temas;
- tooltip;
- piscar e animação de linha nova;
- recarga a quente real ("reload failed");
- respawn do worker;
- sessões filhas reais e a latência do poll;
- `<side-sessions-event>` e `wrap_up` com `ask` do app;
- `turn.step` (modelo e esforço);
- `$.ui.status`;
- tamanho máximo aceito pelo app.

## (e) Portão antes do commit local, e CI depois

Comando único na raiz: `npm run check` → `node scripts/testes.mjs`:
1. Acha o binário: `CLAUDE_BIN`, senão o `claude.exe` mais novo em `%APPDATA%\Claude\claude-code\*\*\`, senão `claude` no PATH. Imprime a versão usada.
2. `claude plugin validate . --strict` e `claude plugin validate task-tree --strict`. Conferir antes se o mod passa hoje com `--strict`; se houver avisos, o primeiro commit os resolve ou o script começa sem `--strict` e anota a pendência.
3. `npx tsc --noEmit -p task-tree`, com `typescript` fixado no `package.json`. Os tipos de `.claude-plugin/types/` são gerados pelo engine e ignorados pelo git: o script os gera ou confere antes, por um comando do binário a descobrir (provavelmente o `validate` ou o `plugin test` os escreve). Sem isso, o tsc falha numa máquina limpa.
4. `claude plugin test task-tree`.
5. Sai com o primeiro código diferente de 0 e um resumo de uma linha por etapa.

Para usar:
- **Local:** a sessão de implementação roda `npm run check` antes de cada commit local, junto com a regra da recarga (edição multiarquivo num passo só). Hook de pre-commit fica opcional, só se o usuário quiser.
- **CI, quando o usuário quiser:** um workflow `test.yml` em `pull_request` com `ubuntu-latest`, `actions/setup-node`, instalação do Claude Code na **versão fixada** (`npm i -g @anthropic-ai/claude-code@<versão>`, a mesma do app), `npm ci` e `npm run check`. O `plugin test` não pede login nem rede. Depois, colocar `check` como obrigatório para o merge e na frente do job de release. Risco: o binário do npm e o do app desktop podem divergir; fixar a versão e anotar no `DESENVOLVIMENTO.md` qual usar.

## (f) Tarefas, na ordem (cada uma é um commit local)

| # | Tarefa | O que o usuário valida |
|---|---|---|
| 1 | `package.json`, `scripts/testes.mjs` (validate --strict + tsc + test), `.gitattributes`, um teste-fumaça (`plan` → linha aparece) | Rodar `npm run check` e ver as 4 etapas passando e o exit 0; com um teste quebrado de propósito, exit 1. Painel no app inalterado. |
| 2 | `tests/kit/` (ambiente, cenário, leitura), com 2 testes de árvore usando os helpers | Ler um teste e confirmar que se lê como regra ("pai fecha quando os filhos fecham"). Ver a mensagem de erro que imprime o painel em texto. |
| 3 | `turnos.test.ts` + `perguntas.test.ts` (prioridade 1: itens 1, 2 e 4) | Conferir que os nomes dos testes batem com as regras que ele decidiu; nenhuma mudança no app. |
| 4 | `envios.test.ts` (item 3, mais o 11) | Idem. |
| 5 | `sessoes.test.ts` (itens 5, 6, 12, 13) | Idem. |
| 6 | `cabecalho.test.ts` + resumida (itens 7, 8, 16) | Idem. |
| 7 | `durabilidade.test.ts` (itens 9, 15) | Idem. |
| 8 | `svg.test.ts` + `golden/svg.ts` (cenários-chave) + `scripts/golden.mjs` + página HTML | **Validação visual principal:** abrir `golden-revisao.html` (ou o Artifact), conferir que cada foto é o painel como ele espera e aprovar. Depois, uma mudança proposital de cor mostra o diff na página. |
| 9 | `DESENVOLVIMENTO.md`, seção "Validar" (comando, golden, checklist do app) + memória atualizada | Ler a seção. Precisa do ok dele, porque a memória diz "sem docs no task-tree". |
| 10 (quando ele pedir) | `.github/workflows/test.yml` | Ver o check verde num PR. |

A regra para depois: toda correção de bug traz, no mesmo commit, o cenário que a reproduz (decisão 4), no arquivo da área.

Se algum cenário mostrar um bug real do plugin durante as tarefas 3 a 7, o teste fica marcado como pendente com o motivo e o bug vai para a frente de correção (não se adapta o teste ao bug).

## (g) Riscos e dúvidas

Riscos:
- **Recarga no kit:** não sei se o kit simula "módulo novo com state mantido". Se não simular, a durabilidade fica parcial e a recarga real vai para o checklist.
- **Leitura do desenho:** extrair estado e ícones do `alt` ou do texto pode acoplar a detalhes de apresentação. Mitigação: um único lugar (`leitura.ts`) faz essa tradução.
- **Limite de 5 s por teste** e um processo por arquivo: cenários longos (como estados reais grandes) podem estourar. Manter os cenários pequenos.
- **Tipos gerados por máquina** (`.claude-plugin/types/`): o tsc no CI depende de gerá-los com o binário.
- **Recarga do clone durante a escrita dos testes:** arquivos `*.test.ts` dentro de `task-tree/` disparam a recarga do mod em todas as sessões? Se o engine recarregar por qualquer save na pasta, um teste mal escrito não quebra o mod (não é importado pelo `register`), mas convém confirmar.
- **Divergência de versão** entre o binário do app (2.1.308) e o do CI.
- **Golden vira "atualizar sem olhar":** mitigado pela aprovação explícita por cenário na página e pelos poucos cenários.

Dúvidas para o usuário:
1. A documentação (tarefa 9) contraria a memória "sem docs no task-tree": pode atualizar a seção "Validar" do `DESENVOLVIMENTO.md` com o comando e o fluxo do golden?
2. `package.json` e `scripts/` na raiz do repositório estão ok, ou ele prefere tudo dentro de `task-tree/`?
3. A página de aprovação fica só local (HTML aberto no navegador) ou também como Artifact privado, para ver pelo celular?
4. Golden em 2 temas para todos os cenários-chave, ou tema claro só no cenário principal?
