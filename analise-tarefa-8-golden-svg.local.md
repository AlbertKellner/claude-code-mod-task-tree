# Tarefa 8: golden do SVG e página de aprovação (análise, sem implementar)

Base: `44d0476` (tsc bloqueia, o hook pula etapas, 82 regras cobertas). Nada foi editado.

## Essencial

- **O SVG sai do próprio kit, sem script Node à parte.** No desktop, cada linha do painel é um `Svg` cuja `source` vem de funções puras (`rowSvg`, `headerSvg`, `hoverLayer` em `draw/svg.ts`), montadas por `drawDesktop` (`hooks/render.tsx`).
  - Um teste monta o painel com `surface: 'desktop'` e lê o `source` de cada `Svg` do desenho (`ui.drawn()`), exatamente o que o app recebe. É o caminho da suíte antiga (`svg-golden.test.ts`, removida em 2026-10-23), refeito com o kit e os cenários atuais.
  - Gerar o SVG fora do binário (Node puro) duplicaria o caminho dos hooks e não passaria pelo `render.tsx`; não recomendo.
- **O golden é o texto do SVG**, não a pintura. Ele fica num módulo versionado (`task-tree/tests/golden/svg.ts`), porque o teste do kit não lê arquivos.
  - **Mudar o golden exige a aprovação do usuário**, travada como os selos: um registro `golden` em `regras/selos.json`, com o hash de cada cenário, e um comando `npm run golden:aprovar -- <cenário> --motivo "<palavras do usuário>, <data>"`.
  - O check falha se o golden e o selo divergem. A etapa `regressao` já roda o teste de golden de `HEAD` contra o código novo, e uma mudança de desenho sem aprovação **falha**.
- **A página de aprovação** é uma ferramenta, não um teste. `npm run golden:pagina` gera um HTML local (fora do git) com, por cenário, o aprovado e o recebido lado a lado e o diff de texto; o mesmo HTML vai como Artifact privado.
  - Os 2 temas: o SVG traz o tema escuro sob `@media (prefers-color-scheme: dark)`. A página mostra o escuro **reescrevendo uma cópia** do SVG com essa regra sempre ativa, só no cenário principal, como ele decidiu.
- **A primeira referência nasce da aprovação dele** sobre o desenho atual, depois de ele conferir no app. A memória "SVG da proposta não é referência" fica respeitada: `docs/task-tree-proposta-visual.svg` não é usado.
- **Regras:** os `visual.*` de pintura passam a **coberto parcialmente**. A forma do desenho fica travada pelo golden; a pintura real (fonte, largura do app, cliques, animação) segue no checklist. A proposta é dividir cada regra visual em "desenho travado" (coberto) e "como o app pinta" (checklist).
- **Tempo:** o teste de golden roda dentro do `plugin test` (+~2 s); a página não entra no hook.
- **Dúvidas:** 4 decisões de produto (seção 7).

## 1. Como o SVG é gerado

- `hooks/render.tsx` → `drawDesktop($, ui, lines, W, top, alt, …)` (l. 56–160):
  - `sources = lines.map((r, i) => rowSvg(r, lanes[i], cards[i], W, hides[i]))`, com `lanes = guides(lines)`, `cards = frames(lines)` e `hides = labelCols(lines)`, todas puras, de `draw/`;
  - o cabeçalho: `headerSvg(head, d, n, list, W, time, rate, git)`;
  - por cima: `hoverLayer(source, w, h)` (o tooltip) e `overlays(...)` (onde ficam os botões);
  - `W = lineWidth(bodyColumns)`, a largura em px a partir das colunas do pane.
- **Tema:** cada SVG leva `<style>…regras claras… @media (prefers-color-scheme: dark){…regras escuras…}</style>` (`svg.ts:101`). O mesmo texto serve aos dois temas.
- **Animação** (`motion.ts`): "nada anima no primeiro desenho de um módulo, nem num desenho em que a maioria das chaves é nova". Um teste que monta o desktop **uma vez**, com o relógio parado, recebe o desenho estático. Montar o terminal antes no mesmo teste "aqueceria" o mapa; o cenário de golden não deve fazer isso, ou deve avançar o relógio além de `DUR` (500 ms) antes da montagem desktop.
- **Determinismo:**
  - o relógio é fixo (`fixar`);
  - a largura do texto é **estimada** pelo próprio código (`fit`/`textW`), sem depender de fonte;
  - os ids de sessão são fixos.
  - Normalizar só CRLF→LF e arredondar números a 2 casas na comparação, contra floats.

## 2. O desenho da solução

**Arquivos novos:**
- `task-tree/tests/golden.test.ts`: um teste por cenário, `// Regra: visual.<…>-desenho`. Cada um:
  - monta o estado pelo kit (`plan`, `start`, `envio`, `host`…);
  - `relogio.advance(1000)`;
  - `svgs($, { colunas })` (kit novo, abaixo);
  - compara com `GOLDEN[cenario]` (normalizado).
  - Na diferença, falha mostrando o primeiro trecho diferente e imprime `GOLDEN-NEW <cenário> <json>`.
- `task-tree/tests/golden/svg.ts`: `export const GOLDEN: Record<string, { alt; w; h; hover; source }[]>`. Gerado, nunca editado à mão.
- `tests/kit/leitura.ts`: `svgs($, { colunas }): Promise<GoldenSvg[]>`, que monta o desktop, percorre o `drawn()` e devolve cada `Svg` (`alt`, `width`, `height`, `isInteractive`, `source`). Selo do kit: `refatoracao`.
- `scripts/golden.mjs`:
  - `--receber`: roda `claude plugin test` numa cópia temporária (só o `golden.test.ts`), recolhe as linhas `GOLDEN-NEW` e grava `golden-recebido/recebido.json` (fora do git, no `.gitignore`);
  - `--pagina`: gera `golden-recebido/index.html` com, por cenário, o **aprovado** (do `svg.ts`) e o **recebido** lado a lado, o diff de texto e, no cenário principal, os dois temas. Também imprime o caminho, para publicar como Artifact;
  - `--aprovar <cenário…> --motivo "…"`: grava o recebido em `tests/golden/svg.ts` e registra em `regras/selos.json`, `golden.<cenário> = { hash, data, motivo }`.
    - **Recusa sem `--motivo`.** Recusa também se o recebido mudou desde a página: o hash do recebido aprovado tem de ser igual ao que a página mostrou (o hash aparece na página).
- `package.json`: `golden:receber`, `golden:pagina`, `golden:aprovar`.

**Travas** (no `npm run check` e no hook):
- `scripts/selos.mjs` ganha a categoria `golden`: o hash de cada cenário de `tests/golden/svg.ts` precisa bater com `selos.golden`. Golden alterado sem `golden:aprovar` falha.
- O `golden.test.ts` é um teste selado como os outros, e o corpo dele não muda.
- A etapa `regressao` roda o `golden.test.ts` de `HEAD` (com o golden de `HEAD`) contra o código novo. Uma mudança de desenho faz o teste antigo falhar, e só passa se a mudança vier com o golden aprovado nesta mesma mudança.
  - A regra de liberação da `regressao` (selo `decisao` com data de hoje) ganha o equivalente para golden: cenário com `selos.golden` de hoje e hash novo.

**Fluxo de uma mudança visual legítima:**
1. A Análise descreve a mudança e os cenários de golden afetados.
2. A Implementação muda o código; o check falha no `golden.test.ts` ("desenho mudou").
3. A Implementação roda `npm run golden:receber` e `golden:pagina`, publica a página como Artifact privado e manda o link.
4. O usuário olha a página e o app e aprova com as palavras dele.
5. A Implementação roda `npm run golden:aprovar -- <cenário> --motivo "aprovado pelo usuário em <data>: '<palavras>'"`. O check passa.
6. O commit traz o código, `tests/golden/svg.ts` e `regras/selos.json`. O relato cola as palavras dele e o link da página.

**Primeira referência:** o mesmo fluxo a partir do desenho de hoje. O usuário valida no app, olha a página e aprova; só então o `svg.ts` nasce. Nenhum golden entra sem a aprovação dele.

## 3. Cenários (uma largura: 60 colunas; mais 110 só no principal, conforme a dúvida 3)

1. **Principal** (2 temas na página):
   - árvore de 3 níveis com todos os estados (○, ◉, ✓, ✕, ◷);
   - a linha ↩ do resumo;
   - o cabeçalho em cartão com repositório e branch.
2. **Pergunta aberta:** a linha ◷ "Aguardando sua resposta" sob a tarefa.
3. **Envios:** ✉ na fila, entregue e interrompido; um nível 1 recebido por mensagem.
4. **Cartão de filha:** trabalhando (busto, toks/s, modelo, repo/branch, anel) e uma parada.
5. **Pasta sem git e título longo** recortado na largura menor (a direita ancorada na borda).
6. **Visão resumida** com "+N pedidos anteriores".

São 6 cenários, cerca de 40–60 `Svg` no total; o `svg.ts` deve ficar em ~150–250 KB.

## 4. Regras do catálogo

- Cada `visual.*` de pintura (hoje `checklist`) ganha um par:
  - `visual.<x>-desenho` (coberto pelo golden): "o desenho de <x> é o aprovado";
  - o atual, que fica `checklist` para o que só o app mostra (fonte real, largura do pane, clique, animação, status).
- Candidatos a `-desenho`: `cores-dos-temas`, `cabecalho-em-cartao`, `cabecalho-barra-e-chips-desenhados`, `cartao-posicao-de-toks-e-repo`, `cartao-modelo-e-esforco` (o modelo só aparece no desktop: **passa a ser verificável** pelo `source`) e `largura-real`, no que o texto do SVG mostra (a direita ancorada na largura dada).
- Continuam só `checklist`: `cliques-no-icone-e-no-anel`, `tooltip` (o comportamento; a camada está no golden), `animacao-de-linha-nova`, `status-embaixo-da-caixa`, `recarga-real-e-respawn` e `cartoes-ordem-e-espera`.
- Origem de cada `-desenho`: a mesma do par, mais "golden aprovado pelo usuário em <data>". O estado só vira `coberto` no commit em que ele aprova o golden.

## 5. Riscos

- **O golden virar "ajusta para passar":** a trava está no selo `golden` com motivo, na `regressao` e na página. Fica um limite honesto: quem roda `golden:aprovar` é a sessão, com o texto que escrever. O código não sabe se as palavras são do usuário. Mitigações:
  - o hash do recebido mostrado na página precisa bater;
  - a orquestradora só repassa a aprovação com as palavras dele;
  - o diff do `selos.json` e do `svg.ts` vai no relato.
- **Mudanças de desenho legítimas e frequentes:** cada uma exige uma aprovação nova. Menos cenários (6) e o diff na página reduzem o custo. Mudanças que não alteram o desenho (refatoração) não tocam no golden.
- **Diferenças falsas:** floats e fins de linha (normalizados); texto com acento (UTF-8 fixo); ordem dos atributos (vem do código, estável).
- **A página não é o app:** o navegador pinta o SVG com outra fonte. A página serve para ver a mudança, e o aceite final continua no app (checklist).
- **Tamanho do golden** (~200 KB versionado): aceitável. Se crescer, reduzir cenários ou larguras.
- **Recarga do clone:** nada do mod muda; só `tests/`, `scripts/`, `regras/` e `package.json`.
- **Hook:** o `golden.test.ts` roda no `plugin test` (+~2 s). Quando o mod muda, a regressão roda de novo (+~2 s).

## 6. Fatiamento

1. **Infraestrutura sem referência**, num commit:
   - `svgs()` no kit;
   - `golden.test.ts` com os 6 cenários, mas **sem** comparar (só confere que gera SVG e imprime `GOLDEN-NEW`). Como ainda não há golden, o teste falha honestamente se o desenho não sair, e não compara nada;
   - `scripts/golden.mjs` (receber, página, aprovar) e a categoria `golden` no `selos.mjs`;
   - a regra de liberação da regressão;
   - testes do script em `travas.test.mjs` (aprovar sem motivo recusa; golden alterado sem selo falha).
2. **Primeira aprovação:**
   - o usuário valida o app atual;
   - a Implementação gera a página e publica o Artifact;
   - ele aprova cenário por cenário;
   - `golden:aprovar`; o `golden.test.ts` passa a comparar; o catálogo ganha os `-desenho` como cobertos.

## 7. Dúvidas para o usuário

1. **A primeira referência é o desenho de hoje?** Ele confere o app atual e aprova a página; o que estiver errado vira correção antes do golden nascer. Recomendado: sim.
2. **Quem aprova uma mudança de golden:** só ele, com as palavras dele repassadas pela orquestradora e registradas no motivo (recomendado)? Ou aceita que a sessão aprove mudanças que ele já validou no app sem ver a página?
3. **Larguras:** 60 colunas em todos os cenários e 110 só no principal (recomendado, menos referências para aprovar)? Ou as duas larguras em todos?
4. **A página como Artifact privado a cada mudança de desenho**, ou só o HTML local, com o Artifact quando ele pedir? Recomendado: Artifact a cada mudança, para ele ver pelo celular.

## 8. Brief para a Implementação (commit 1: infraestrutura sem referência; depois das respostas 1–4)

Na branch `test/regressivos-automacao-testes`, depois de `44d0476`. Commit local. Sem push.

1. `tests/kit/leitura.ts`: `svgs($, { colunas })` (seção 2); selo do kit `refatoracao`.
2. `tests/golden.test.ts`: os 6 cenários da seção 3, cada um com `// Regra:` numa regra nova `visual.<x>-desenho` em estado `pendente (golden: aguardando a aprovação do usuário)`. Sem `GOLDEN` ainda: cada teste confere que há `Svg` com `source` e imprime `GOLDEN-NEW`. Selar `novo`.
   - Com o golden ainda vazio, os testes citam regras pendentes, e o `regras.mjs` recusa isso. Alternativa: citar uma regra nova `visual.golden-gera-desenho` (coberto, "todo cenário de golden gera o desenho"); as regras `-desenho` ficam pendentes sem teste até a aprovação.
3. `scripts/golden.mjs` (`--receber`, `--pagina`, `--aprovar`), `.gitignore` com `golden-recebido/`, e `package.json` com os três scripts.
4. `scripts/selos.mjs`: a categoria `golden` (vazia neste commit; `--golden <cenário> --motivo` grava). `scripts/regressao.mjs`: a liberação por `selos.golden` de hoje.
5. `scripts/travas.test.mjs`: dois casos (aprovar sem motivo recusa; golden alterado sem selo falha).
6. `CLAUDE.md`: uma seção curta "Golden do SVG" com o fluxo da seção 2 (receber → página → aprovação do usuário → aprovar) e "nunca aprovar sem as palavras dele".
7. `npm run check` verde; rodar `npm run golden:receber` e `golden:pagina` e publicar o Artifact privado para a primeira aprovação, que fica para o commit 2.

O usuário valida lendo a seção nova do `CLAUDE.md` e, no Artifact, os 6 cenários. A aprovação dele abre o commit 2.
