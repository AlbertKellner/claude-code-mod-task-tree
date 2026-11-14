# Repositório e branch no cartão da sessão e no topo do painel

Pedido: "quero colocar ao lado direito do nome da sessão, qual repositório e qual branch a sessão
está trabalhando. coloque essas infos também no topo do painel de tarefas".

## Decisões do usuário
- Repositório = **nome da pasta** (basename da raiz do repo).
- **Ícones em vez de texto-rótulo**: para o repo, o **ícone do GitHub**; para a branch, o
  **antigo ícone de sessão** (`branch()`, o ⑂ de três bolinhas, reservado para isto).
- No topo: **linha da contagem** ("N de M · % · tempo · toks/s", e então repo e branch).
- Quando não couber no cartão: **repo some primeiro, depois modelo/esforço**, depois toks/s; nome e
  branch ficam.

## Fonte do dado
- O app **não** dá a branch: `get_session`/`list_sessions` trazem `cwd` (e `originCwd`); só
  sessões em worktree têm dado de worktree/branch, e mesmo esse não chega ao mod por `$`.
- Cada sessão lê o **próprio git pelo `$.fs.read`**, sem rodar `git`:
  1. raiz: `await $.session.root()` (o kit a dá; segue `/cd`, worktree);
  2. `<raiz>/.git`: se é pasta, `HEAD` está em `<raiz>/.git/HEAD`; se é **arquivo** ("gitdir:
     <caminho>", caso de worktree ou submódulo), ler `<caminho>/HEAD`;
  3. `HEAD` = `ref: refs/heads/<branch>` → branch; senão um hash → **detached**: mostrar os 7
     primeiros caracteres;
  4. repo = basename da raiz (num worktree, basename do worktree; se o usuário quiser o repo
     principal, ler `<gitdir>/commondir` → `..` → basename: deixar para depois).
  Falha em qualquer passo (sem `.git`, pasta sem permissão): sem repo/branch, nada desenhado.
- Publicação: a sessão grava `git: { repo, branch, detached?: true, at }` no arquivo
  `task-tree-waits/<id>.json` (`io/publish.ts`), como faz com `engine`; a mãe lê no poll de 3 s
  (`readFiles` → `Child.git`). A própria sessão guarda em `$.state` (`git`, `lives: 'state'`) para
  o topo.
- Atualização: a branch muda durante a sessão (checkout, worktree). Reler `HEAD` a cada
  `publishPanel` da sessão (ela publica a cada tool call, plan/start/done, fim de turno) e no
  `tick` de 1 s **só quando** o relógio já roda; é uma leitura de arquivo de 40 bytes. Sem hook de
  git no kit.

## Desenho
- **Ícones** (`draw/svg.ts`, 14 px, classe `s`/`gy`, traço 1,3):
  - repo: ícone do GitHub. Observação: o **Octocat** é marca registrada do GitHub; para uso no
    painel pessoal não há problema prático, mas recomendo a silhueta **simplificada** (cabeça com
    orelhas e o contorno do corpo, 14 px) ou o octicon "repo" (livro) se preferir evitar a marca.
    Decidir na validação visual; o path fica isolado em `repoIcon(x, y, cls)`.
  - branch: `branch(x, y, cls)` já existente (três bolinhas e a curva), sem mudança.
- **Cartão da filha** (`labelSvg`): à direita do nome, em `s` 11 px apagado:
  `[github] claude-code-mod-task-tree   [⑂] fix/task-tree-serie-7`, depois `n toks/s` e o modelo
  (que ficam à direita como hoje). Larguras por `textW`; ordem de sacrifício quando não cabe:
  **repo** (ícone + nome) → **modelo/esforço** → **toks/s**; a branch encurta com `…` só em último
  caso (tooltip com o nome inteiro, `hoverLayer`). O nome da sessão nunca encurta por causa disto.
- **Topo** (`headerSvg`, linha da contagem): `N de M · 100% · 1:45 · 99 toks/s   [github] repo
  [⑂] branch`, mesmo estilo `s` 12 px; se não couber na largura, cair para só `[⑂] branch` e
  depois omitir.
- Filha em **outro repo ou worktree**: nada diferente no desenho (o repo dela já aparece); se o
  repo for igual ao da mãe, mostrar mesmo assim (o usuário escolheu ícones, baratos em espaço).
- Terminal: texto `repo ⑂ branch` no `tail` do cartão e na linha do cabeçalho.
- `rowAlt`/alt do cabeçalho incluem "repositório X, branch Y".

## Plano
1. `io/git.ts` (novo): `readGit($): Promise<{ repo, branch, detached? } | undefined>` com os
   passos acima (só `$.session.root()`, `$.fs.read`; sem processos).
2. `hooks/panel.ts` `publishPanel`: chamar `readGit`, guardar em `$.state` `git` quando muda e pôr
   no corpo publicado (`io/publish.ts`, comparação sem `at`); `parsePublished` lê `git` opcional.
   `state/durability.ts`: linha `git`.
3. `io/host.ts`: `Read.gits[id]` → `Child.git`; `types/index.d.ts`: tipo `GitInfo` em `Published`
   e `Child`.
4. `draw/svg.ts`: `repoIcon`; `labelSvg` com repo/branch à direita do nome e a ordem de sacrifício;
   `headerSvg` com repo/branch na linha da contagem; `rowAlt`.
5. `draw/layout.ts`: `Row.git` no cartão; `hooks/render.tsx`: `git` do estado para o cabeçalho;
   terminal.
6. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual: cartão com
   `[github] repo [⑂] branch` à direita do nome, topo com os mesmos na linha da contagem, painel
   estreito escondendo repo e depois modelo, troca de branch refletida em poucos segundos.
