# Sessão numa pasta sem git: ícone de pasta e caminho, sem branch

Pedido: "quando a sessão estiver trabalhando em uma pasta que não tenha um repositorio git
iniciado, o icone GIT deve ser trocado para uma pasta, e ao inves de mostrar o nome do
repositorio, seja mostrada o nome da pasta. e para esse cenário, não deve ser mostrada a informação
de branch nem o icone."

## Decisões do usuário
- Nome mostrado: **caminho encurtado** (ex.: `~\Documents\notas-do-projeto`), cortado com `…`
  quando não couber.
- Sessão numa **subpasta de um repositório** (ex.: `repo\docs`): mostrar **o repositório e a
  branch**, como na raiz (subir as pastas até achar o `.git`).
- "só inicie a implementação quando o merge for feito. pode ir fazendo a análise sem fazer commit de
  nada enquanto isso": a implementação espera o merge do PR #22 (a série seguinte,
  `fix/task-tree-serie-11`).

## Hoje (mapa)
- **Leitura**: `io/git.ts` `readGit($)`: `root = $.session.root()`; lê `<root>/.git/HEAD`; senão
  `<root>/.git` como arquivo `gitdir:` (worktree, submódulo) e `<gitdir>/HEAD`; `parseHead` dá a
  branch ou o hash curto (destacado). **Qualquer falha devolve `undefined`.**
- **Estado**: `hooks/panel.ts:351–356` grava `$.state` `git` (com `at`) só quando muda.
- **Publicação**: `io/publish.ts:50,143,165` põe `git: { repo, branch, detached?, at }` no arquivo
  da sessão; a mãe lê em `io/host.ts:158` (`Child.git`, mantém o anterior se o arquivo não tiver).
- **Desenho**: `draw/svg.ts` `gitSvg(git, x, cy, size, repo, max)` (233–245): `repoIcon` + nome
  do repo, depois `branch()` + nome da branch; `gitW` (247) mede. Usado no cartão (`labelSvg`, 339)
  e no topo (`headerSvg`, 526–527, com a queda para "sem repo" quando não cabe).
- **Numa pasta sem git hoje**: `readGit` → `undefined` → `git` nulo → **nada** desenhado (nem
  ícone, nem nome). Casos-limite:
  - **subpasta de repo**: só olha `<root>/.git` → também `undefined` (nada) — a corrigir (sobe as
    pastas);
  - **HEAD destacado**: mostra o hash curto (`detached`); **`.git` corrompido** (HEAD ilegível ou
    sem formato): `undefined` → hoje nada; passa a ser pasta (ver abaixo);
  - **cwd inexistente** ou sem permissão: `root` vazio ou leitura falha → nada (continua nada).

## Plano
1. `types/index.d.ts`: `GitInfo` ganha a forma de pasta:
   `{ kind?: 'git' | 'folder'; repo: string; branch?: string; detached?: true; at?: number }`
   (`kind` ausente = `git`, compatível com arquivos já publicados). Para pasta: `kind: 'folder'`,
   `repo` = caminho encurtado, sem `branch`.
2. `io/git.ts`:
   - `findGit(root)`: sobe de `root` até a raiz do disco (no máx. ~40 níveis) procurando
     `<dir>/.git/HEAD` ou o arquivo `<dir>/.git` (`gitdir:`); a primeira que achar é o repositório.
     `repo` = `basename(dir)` do repositório (não da subpasta), `branch` do HEAD dela.
   - Sem repositório em nenhum nível, ou `.git` existente mas ilegível/corrompido: devolve
     `{ kind: 'folder', repo: short(root) }`.
   - `short(path)`: troca o início `USERPROFILE`/`HOME` (via `$.env.get`, já usado em
     `io/publish.ts`) por `~`, mantém o separador nativo; o corte com `…` é do desenho (passo 4).
   - `root` vazio (cwd inexistente): continua `undefined` (nada).
3. `hooks/panel.ts` / `io/publish.ts` / `io/host.ts`: publicar e ler `kind`; a comparação do
   `publishPanel` inclui `kind`. `parsePublished` aceita `branch` ausente quando `kind: 'folder'`.
4. `draw/svg.ts`:
   - **`folderIcon(x, y)`**, mesma caixa de 14 px e mesmo estilo do `repoIcon` (silhueta preenchida
     na cor apagada dos ícones, `gyf`, com o detalhe na cor do cartão, `cds`):
     ```ts
     export function folderIcon(x: number, y: number): string {
       return (
         `<g transform="translate(${x} ${y})">` +
         // a pasta: aba à esquerda em cima e o corpo, cantos arredondados, preenchida como o losango do Git
         '<path class="gyf" d="M-6 -4.2Q-6 -5.5 -4.8 -5.5H-1.6L-0.3 -4H4.8Q6 -4 6 -2.8V4.3Q6 5.5 4.8 5.5H-4.8Q-6 5.5 -6 4.3Z"/>' +
         // a borda da frente da pasta, na cor do cartão (como o grafo do logotipo)
         '<path class="cds" d="M-6 -1.8H6" fill="none" stroke-width="1"/></g>'
       )
     }
     ```
   - `gitSvg`: com `kind === 'folder'`, desenha `folderIcon` + o caminho (`fit` ao espaço, corte
     com `…` **no começo**, para ficar o fim do caminho, o mais informativo), e **nada de branch**
     (nem ícone, nem nome). `gitW` idem (sem a parte da branch).
   - Cartão (`labelSvg`) e topo (`headerSvg`): a ordem de sacrifício quando falta espaço continua
     (o nome de repositório/pasta é o primeiro a sair no cartão); no topo, a queda "sem repo"
     passa a "sem nada" para pasta (não há branch para ficar).
5. Terminal: no `tail` do cartão e no cabeçalho, o texto do caminho sem `⑂ branch`.
6. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual: sessão numa
   pasta sem git (pasta + `~\…\nome`, sem branch); numa subpasta de um repo (Git + repo + branch);
   na raiz do repo (igual a hoje); HEAD destacado (hash curto, igual a hoje); nos dois temas, no
   cartão e no topo.
7. **Só começar depois do merge do PR #22** (palavras do usuário); até lá, nada de commit.
