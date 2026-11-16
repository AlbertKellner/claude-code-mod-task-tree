# claude-code-mod-task-tree

Mod do Claude Code que mostra, num painel lateral, a árvore de tarefas da sessão (até 3 níveis), com as sessões filhas e os subagentes que trabalham em cada tarefa. As linhas só recolhem quando você clica no ícone delas.

O plugin `task-tree` expõe três ferramentas ao modelo: `plan` (publica o plano), `start` (marca tarefas em andamento) e `done` (marca tarefas concluídas).

## Uso

- `/task-tree` abre o painel e diz o que o app respondeu: se o painel está na frente, numa aba atrás de outra ou não foi desenhado, e o tamanho do desenho. Serve para quando o painel não aparece.
- No terminal o painel mostra a árvore, com cada sessão filha numa linha, e as linhas recolhem pelo ícone (com um clique, ou com Enter no foco); os cartões das sessões filhas e dos subagentes, o modelo e o esforço, e abrir a sessão pelo anel de contexto dependem do app desktop.

## Instalação

A instalação é pelo marketplace do repositório, a partir da branch `main`.

### Pelo terminal

```bash
claude plugin marketplace add "AlbertKellner/claude-code-mod-task-tree"
claude plugin install task-tree@claude-code-mod-task-tree
```

### De dentro do Claude Code

```
/plugin marketplace add AlbertKellner/claude-code-mod-task-tree
/plugin install task-tree@claude-code-mod-task-tree
```

Abra uma sessão nova depois de instalar para o plugin carregar.

### Por uma sessão do Claude Code

Cole este prompt numa sessão e o Claude faz a instalação:

````text
Instale o plugin task-tree do Claude Code a partir do GitHub:

1. Rode `claude plugin marketplace add "AlbertKellner/claude-code-mod-task-tree"`.
2. Rode `claude plugin install task-tree@claude-code-mod-task-tree`.
3. Rode `claude plugin list` e confirme que `task-tree@claude-code-mod-task-tree` está `enabled`.
4. Se eu carregava o mod por pasta local (`CLAUDE_CODE_PLUGIN_DIRS` em `~/.claude/settings.json` ou `--plugin-dir`), mostre o caminho antigo e peça minha confirmação antes de removê-lo, para o plugin não carregar em duplicidade.
5. Avise que preciso abrir uma sessão nova para o plugin carregar.
````

### Atualizar por uma sessão do Claude Code

Cole este prompt numa sessão (no Claude Code desktop ou no terminal) e o Claude atualiza o plugin para a versão mais recente da `main`:

````text
Atualize o plugin task-tree do Claude Code para a versão mais recente:

1. Rode `claude plugin list` e anote a versão atual de `task-tree@claude-code-mod-task-tree`.
2. Rode `claude plugin marketplace update claude-code-mod-task-tree`.
3. Rode `claude plugin update task-tree@claude-code-mod-task-tree`.
4. Rode `claude plugin list` de novo, confirme que o plugin está `enabled` e me diga a versão antes e depois.
5. Se eu carregava o mod por pasta local (`CLAUDE_CODE_PLUGIN_DIRS` em `~/.claude/settings.json` ou `--plugin-dir`), avise que é essa pasta que carrega, e não o plugin atualizado.
6. Avise que preciso abrir uma sessão nova para a versão nova carregar.
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
