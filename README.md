# claude-code-mod-task-tree

Mod do Claude Code que mostra, num painel lateral, a árvore de tarefas planejadas da sessão (até 3 níveis), marcando as tarefas em andamento e colapsando as concluídas.

O plugin `task-tree` expõe três ferramentas ao modelo: `plan` (publica o plano), `start` (marca tarefas em andamento) e `done` (marca tarefas concluídas).

## Instalação

A instalação é pelo marketplace do repositório, na branch `feature/task-tree`.

### Pelo terminal

```bash
claude plugin marketplace add "AlbertKellner/claude-code-mod-task-tree@feature/task-tree"
claude plugin install task-tree@claude-code-mod-task-tree
```

### De dentro do Claude Code

```
/plugin marketplace add AlbertKellner/claude-code-mod-task-tree@feature/task-tree
/plugin install task-tree@claude-code-mod-task-tree
```

Abra uma sessão nova depois de instalar para o plugin carregar.

### Por uma sessão do Claude Code

Cole este prompt numa sessão e o Claude faz a instalação:

````text
Instale o plugin task-tree do Claude Code a partir do GitHub, branch feature/task-tree:

1. Rode `claude plugin marketplace add "AlbertKellner/claude-code-mod-task-tree@feature/task-tree"`.
2. Rode `claude plugin install task-tree@claude-code-mod-task-tree`.
3. Rode `claude plugin list` e confirme que `task-tree@claude-code-mod-task-tree` está `enabled`.
4. Se eu carregava o mod por pasta local (`CLAUDE_CODE_PLUGIN_DIRS` em `~/.claude/settings.json` ou `--plugin-dir`), mostre o caminho antigo e peça minha confirmação antes de removê-lo, para o plugin não carregar em duplicidade.
5. Avise que preciso abrir uma sessão nova para o plugin carregar.
````

### Verificar

```bash
claude plugin list
```

`task-tree@claude-code-mod-task-tree` deve aparecer como `enabled`.

## Atualizar e remover

```bash
claude plugin marketplace update claude-code-mod-task-tree
claude plugin update task-tree@claude-code-mod-task-tree
claude plugin uninstall task-tree@claude-code-mod-task-tree
```

## Se você usava o mod local

Quem carregava o mod por pasta (`CLAUDE_CODE_PLUGIN_DIRS` ou `--plugin-dir`) deve tirar esse caminho depois de instalar, para o plugin não carregar em duplicidade.

## Desenvolvimento

O plugin fica em [`task-tree/`](task-tree). Para testar uma alteração sem instalar, aponte a pasta para o Claude Code:

```bash
claude --plugin-dir ./task-tree
```
