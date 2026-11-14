# task-tree-waits: correção (2026-10-20)

- A pasta faltando NÃO é a causa: `$.fs.write` "creates it and its directories as needed" (types/claude-code/index.d.ts, linha ~3244). Nenhum mkdir é necessário.
- Mudança em `task-tree/hooks/register.tsx`: os `catch {}` de `selfId` e `publishWait` agora gravam no log de depuração (`$.ui.log(..., { to: 'debug' })`, pelo novo helper `debug`), assim como `get_session` com `isError` e o caso de não haver USERPROFILE/HOME.
- Teste novo em `tests/task-tree.test.ts`: "sem id da sessão, a falha vai para o log de depuração".
- `claude plugin validate task-tree` ok; `claude plugin test task-tree`: 121 pass, 0 fail (binário 2.1.304 do app).
- Suspeita principal na máquina nova: `get_session {session_id:'self'}` falha (versão do app/servidor ccd_session_mgmt), ou USERPROFILE ausente. Próximo passo: na máquina nova, abrir uma filha e procurar "task-tree:" no debug log.
- Não verificado: comportamento na máquina nova. Versão do plugin.json não alterada. Git do checkout quebrado (`.git` aponta para worktree inexistente de intg-claude-code-mods): não mexido. Sem commit.
