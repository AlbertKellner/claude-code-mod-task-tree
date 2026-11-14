# Tarefa 8, versão simplificada: golden do SVG com o aceite no app

Base: `44d0476`. Substitui o fluxo de aprovação de `analise-tarefa-8-golden-svg.local.md`. A parte técnica (como o SVG é gerado e lido pelo kit) continua valendo. Nada foi editado.

## Essencial

- **O aceite continua sendo o do usuário no app.** Ele não olha SVG nem página.
- O golden (o texto do SVG de 3 cenários, em 60 colunas) é uma **trava automática** que congela o desenho que ele aprovou no app:
  - uma mudança de desenho faz o check falhar;
  - ela só pode ser regravada depois de ele validar no app e dizer que funcionou;
  - as palavras dele vão para o selo.
- **Primeira referência:**
  - no commit 1, o teste só confere que o desenho é gerado;
  - a Implementação grava o golden do desenho atual **somente** quando o usuário, olhando o app, disser que está certo;
  - essa é a aprovação, e entra no selo.
- **A página de comparação** (`golden:pagina`, mais o Artifact) vira ferramenta opcional, só quando ele pedir. Não faz parte da aprovação.

## O que sai do desenho anterior

- **Cenários:** de 6 para **3**: principal, filha trabalhando e envios. Saem pergunta aberta, pasta sem git/título longo e resumida.
- **Larguras:** uma só, 60 colunas. Sai a de 110.
- **Página e Artifact no fluxo:** saem. Ficam como `npm run golden:pagina`, opcional, sob pedido.
- **A checagem do hash da página no `aprovar`:** sai. A prova passa a ser a validação dele no app, nas palavras dele.
- Os dois temas na página: só se ele pedir a página. O golden em si guarda os dois temas no mesmo texto.

## Fluxo de aprovação

**Primeira referência (commit 2, depois do commit 1):**
1. O usuário valida o painel no app, como sempre, e diz se está certo.
2. Com o "está certo" dele, a Implementação roda `npm run golden:aprovar -- --todos --motivo "<palavras dele>, <data>"`. O script roda os 3 cenários, grava `tests/golden/svg.ts` e registra o selo `golden` com as palavras e a data.
3. O `golden.test.ts` passa a comparar.
4. Se ele disser que algo está errado, não se grava nada: o defeito vira correção antes.

**Mudança de desenho depois disso:**
1. O código muda; o check falha no `golden.test.ts` ("o desenho de <cenário> mudou") e mostra o primeiro trecho diferente.
2. A Implementação faz o commit local **sem** regravar o golden? Não: o check bloqueia o commit. Então a Implementação deixa a mudança sem commit e pede a validação no app pela orquestradora.
3. O usuário valida no app e diz "funcionou" (ou "quebrou X").
4. Com o "funcionou", `npm run golden:aprovar -- <cenário> --motivo "<palavras dele>, <data>"`. O check passa e o commit segue com o código, `svg.ts` e `selos.json`.

Atenção à ordem: hoje o fluxo é commit local → o usuário valida → push. Para mudança de **desenho**, a validação vem **antes** do commit, porque o golden bloqueia o commit. Para o resto, nada muda. A dúvida 1 cobre isso.

## Travas

- `regras/selos.json` ganha `golden: { <cenário>: { hash, data, motivo } }`. O `selos.mjs` falha se o hash de `tests/golden/svg.ts` não bate com o selo, ou se há selo sem cenário.
- `golden:aprovar` **recusa** sem `--motivo`. O motivo precisa ter data (`AAAA-MM-DD`) e as palavras entre aspas.
- A etapa `regressao` roda o `golden.test.ts` de `HEAD` contra o código novo. Ela só libera uma falha se o cenário tem selo `golden` de hoje com hash novo. Assim, uma mudança de desenho sem a aprovação registrada não passa.
- **Limite honesto:** quem roda `aprovar` é a sessão. O código não sabe se as palavras são dele. A garantia é de processo: a orquestradora só repassa a aprovação com as palavras do usuário, e o relato cola o diff do selo.

## Regras `visual.*`

- **Novas, cobertas pelo golden** a partir do commit 2:
  - `visual.desenho-principal`: árvore com todos os estados, a linha ↩ e o cabeçalho em cartão com repositório e branch;
  - `visual.desenho-cartao-filha`: busto, toks/s, modelo e esforço, repositório e branch, anel;
  - `visual.desenho-envios`: ✉ na fila, entregue e interrompido.
  - Origem: "desenho validado pelo usuário no app em <data> ('<palavras>')".
- **Ficam `checklist`**, porque só o app mostra: cores pintadas, largura real do pane, cliques, tooltip, animação, status, recarga real, ordem e espera de cartões, posição na imagem.
  - Em `cores-dos-temas`, `cabecalho-em-cartao`, `cartao-modelo-e-esforco` e `cartao-posicao-de-toks-e-repo`, acrescentar ao `Estado:` "(o desenho fica travado por visual.desenho-*; a pintura real, no app)".
- **No commit 1**, os testes citam uma regra nova `visual.golden-gera-desenho` (coberto: "os cenários de golden geram o desenho"). As `visual.desenho-*` nascem `pendente (aguardando a validação do usuário no app)` e viram `coberto` no commit 2.

## Commit 1: infraestrutura (o que a Implementação faz)

Na branch `test/regressivos-automacao-testes`, depois de `44d0476`. Commit local. Sem push.

1. `tests/kit/leitura.ts`: `svgs($, { colunas = 60 })`. Monta o desktop uma vez e devolve cada `Svg` (`alt`, `width`, `height`, `isInteractive`, `source`), normalizado (CRLF→LF e números com 2 casas). Selo do kit: `refatoracao`.
2. `tests/golden.test.ts`: os 3 cenários, com `// Regra: visual.golden-gera-desenho`.
   - Cada cenário monta o estado pelo kit, `relogio.advance(1000)`, `svgs()`, e confere que há `Svg` com `source`.
   - Se `GOLDEN[cenário]` existe, compara e, na diferença, falha com o primeiro trecho diferente e imprime `GOLDEN-NEW <cenário> <json>`.
   - Se não existe, só imprime `GOLDEN-NEW`.
   - Selar `--tipo novo`.
3. `tests/golden/svg.ts`: `export const GOLDEN = {}` (vazio).
4. `scripts/golden.mjs`:
   - `--aprovar <cenário…|--todos> --motivo "…"`: roda o `plugin test` numa cópia temporária só com o `golden.test.ts`, recolhe os `GOLDEN-NEW`, grava em `tests/golden/svg.ts` e o selo `golden`; recusa sem motivo, ou motivo sem data e palavras entre aspas;
   - `--pagina` (opcional, sob pedido): HTML em `golden-recebido/`, fora do git, com o aprovado e o atual lado a lado.
5. `scripts/selos.mjs`: a categoria `golden`. `scripts/regressao.mjs`: a liberação por selo `golden` de hoje.
6. `scripts/travas.test.mjs`: três casos (aprovar sem motivo recusa; golden alterado sem selo falha; regressão de desenho sem selo de hoje falha).
7. `package.json`: `golden:aprovar` e `golden:pagina`. `.gitignore`: `golden-recebido/`.
8. `regras/visual.md`: `visual.golden-gera-desenho` (coberto) e as 3 `visual.desenho-*` (pendente).
9. `CLAUDE.md`, seção curta "Golden do SVG":
   - o desenho de 3 cenários fica travado;
   - mudança de desenho: validação do usuário no app **antes** do commit, e depois `golden:aprovar` com as palavras dele;
   - nunca aprovar sem elas;
   - a página só sob pedido.
10. `npm run check` verde.

O usuário valida o commit 1 como sempre, no app: nada no painel muda.

## Commit 2: primeira referência

Depois do "está certo" do usuário no app:
- `npm run golden:aprovar -- --todos --motivo "<palavras>, <data>"`;
- as 3 `visual.desenho-*` → `coberto`;
- `npm run check` verde;
- o relato cola as palavras dele e o diff do `selos.json`.

## Dúvida para o usuário (decisão nova)

1. Para mudanças que alteram o desenho do painel, a validação dele no app passa a vir **antes** do commit local (o golden bloqueia o commit até ele dizer que funcionou). Isso inverte a ordem de hoje (commit local e depois validação), **só** nesses casos. Está bom? Recomendado: sim.
   - A alternativa é permitir o commit local com o golden desatualizado. Nesse caso, a trava só barraria o push ou o PR, e o hook passaria a deixar essa falha passar.
