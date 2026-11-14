# Tarefa 5: sessões filhas e cartões (análise, sem implementar)

Base: branch `test/regressivos-automacao-testes`, topo `1eacad3` (travas ativas: selos, regressão e hook). Nada foi editado.

## Essencial

- **O harness cobre a maior parte.** O cartão nasce de dados que o mod lê do host, e todos já são respondidos por stubs no `host(on, …)` da tarefa 4:
  - `start_session` (o resultado com o id `local_<uuid>`) cria a filha sob a tarefa em andamento;
  - `list_sessions` diz se ela está rodando ou arquivada;
  - o arquivo publicado dela (`fs.read`) traz o painel, `aborted`, `git`, `rate`, `engine` e `waiting`;
  - um `aviso($)` força a releitura.
- **Falta no kit:**
  - `host` aceitar, por sessão, `painel`, `arquivada`, `aborted`, `git`, `rate` e `aguardando`;
  - um helper `abrirSessao($, id)`;
  - a leitura das linhas de **cartão** (glifo `◍`, nome, palavra de estado: "parada", "arquivada", "concluída", "aguardando") e do **busto** (o `◍` no fim da linha de uma tarefa).
  - Mudar o kit exige regravar o selo dele (`--kit`, tipo `refatoracao`, motivo "helpers de sessão").
- **Dois commits:**
  - **A**, 7 regras do cartão em si: lugar, filha trabalhando, parada, arquivada, busto, pasta sem git, toks/s e repositório/branch;
  - **B**, as 4 regras de **rodadas** (um cartão por mensagem; mensagens juntas; rodada descartada; cadeia e mensagem entre filhas), que exigem turnos com hora no painel publicado. Podem ficar para depois.
- **Ficam no checklist do app:**
  - modelo e esforço no cartão (o terminal não os desenha);
  - posição dos itens no cartão desktop (toks/s à esquerda do modelo; repositório/branch à direita do nome);
  - o anel de contexto;
  - ícones e cores;
  - sessões e latência reais.
- **Nenhuma regra contradiz decisão do usuário.** Duas origens "a confirmar" foram resolvidas pelo git. Há uma dúvida pequena: a toks/s e o repositório/branch passam a `coberto` pelo texto, com a posição no checklist, separando a regra em duas?

## 1. Como o cartão nasce (código)

- **Abertura:** `tool-call.ts` → `recordStart($, resultado)` (`hooks/sessions.ts:196`).
  - O id vem do resultado do `mcp__ccd_session__start_session` pela regex `/local_[0-9a-f-]{36}/`, então **os ids de teste precisam ter o formato de uuid**.
  - A âncora é a tarefa em andamento (`sendAnchor`, a mesma regra do envio).
  - Cria em `children` `{ starting: true, running: true, anchor }`.
- **Releitura:** `refreshChildren` (no `session.start`, no poll de 3 s, em `refreshStale` e no aviso do app), que lê:
  - `list_sessions`, com as linhas que têm `startedBy` = eu (`mineOf`);
  - o arquivo publicado de cada filha (`readFiles` → `panelOf`, `waiting`, `aborted`, `context`, `engine`, `rate`, `git`).

  Depois disso, `deriveChildren` (`io/host.ts:135`) monta `Child` com `running`, `archived`, `waiting`, `aborted`, `panel`, `git` e `rate`.
- **Desenho:** `draw/layout.ts`:
  - `session()` (l. 1086–1142): o cabeçalho do cartão.
    - Tom: `wait`, `running`, `archived`, `paused` (parada) ou `done`.
    - Palavra (`meta`): "aguardando", "arquivada", "parada" ou "concluída"; nada enquanto roda.
    - Também `git`, `rate`, `engine` e `ring`.
  - `panel()` (l. 1150): as tarefas da filha.
  - `panelOf(c)` (l. 128–135):
    - filha viva → o painel como ela publicou;
    - arquivada → `interrupt`;
    - parada → `halt` (iniciada ◷, ou ✕ se `aborted`; pendentes ○).
  - Na linha da tarefa-mãe: `w = atWork(t, …)`; `w.busy` (filha viva embaixo) → tom `current` mesmo com a tarefa concluída; `kids: w.direct` → o busto.
- **Terminal** (`hooks/render.tsx:226–238`), o cartão é:
  - o glifo `◍` (`GLYPH.running`, sempre, cor `inactive`);
  - o nome;
  - `⋯` se recolhido;
  - `gitTerm` (`repo ⑂ branch` ou `▭ pasta`);
  - a palavra de estado;
  - `rateText` (`N toks/s`);
  - o anel em `%`.

  Na tarefa com filha direta, o rabo da linha tem `  ◍`. **O modelo e o esforço (`engine`) não aparecem no terminal**, só no SVG do desktop.

## 2. Regras do catálogo (`regras/sessoes.md`)

| id | Situação no código | Origem (resolvida) | Estado proposto |
|---|---|---|---|
| `sessoes.cartao-sob-a-tarefa-de-origem` | sim (`recordStart` → âncora; `below`; sem âncora, vai para o fim) | regra do painel desde a entrada do mod, 2026-10-20 (`465b09e`); "cartão novo vai sob a tarefa que enviou a mensagem", 2026-10-21 (`5508b25`) | coberto (A) |
| `sessoes.filha-trabalhando-mantem-pais-em-andamento` | sim (`w.busy` → `current`) | commit `d956e11`, 2026-10-24 | coberto (A) |
| `sessoes.filha-parada-pendentes-seguem-pendentes` | sim (`panelOf` → `halt`) | decisão do usuário, 2026-10-27 ("pendentes nunca ✕", desfaz "reaproveitar o interrompida"); `d57807e` | coberto (A) |
| `sessoes.filha-arquivada-interrompe` | sim (`panelOf` → `interrupt`; pai com filha ✓ ◷ por `95b1a21`) | regra do painel desde a entrada do mod ("Arquivada fica, como histórico", DESENVOLVIMENTO); pai ◷: decisão do usuário ("se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido"), `95b1a21` | coberto (A) |
| `sessoes.busto-so-no-pai` | sim (`kids: w.direct`) | commit `e570baa`, 2026-10-24 | coberto (A) |
| `sessoes.pasta-sem-git` | sim (`gitTerm` folder) | commit `17f1140`, 2026-10-24 | coberto (A) |
| `sessoes.toks-por-segundo-e-repo-branch` | texto sim; posição só no desktop | commits `1987482`, `689d569`, 2026-10-24 | **dúvida**: dividir em `…-no-cartao` (coberto, texto) e `visual.cartao-posicao-de-toks-e-repo` (checklist) |
| `sessoes.cadeia-sem-cartao-dentro-de-cartao` | sim (`split`/cadeia) | commit `fddd473`, 2026-10-23 | pendente (B) |
| `sessoes.mensagem-entre-filhas-no-cartao-da-remetente` | sim | commit `28ae764`, 2026-10-23 | pendente (B) |
| `sessoes.rodada-descartada-fora-da-contagem` | sim (`discarded`) | commit `bf77359`, 2026-10-24 | pendente (B) |
| `sessoes.mensagens-juntas-vao-a-ultima` | sim (`split`, rodadas) | commit `8b67366`, 2026-10-23 | pendente (B) |

Regras novas a escrever (o que o código faz e o catálogo ainda não diz), como cenários `checklist` ou `pendente`:
- **`sessoes.palavra-de-estado-do-cartao`:**
  - Dado uma filha;
  - Quando ela roda, espera, para com tarefas abertas, termina ou é arquivada;
  - Então o cartão mostra nenhuma palavra, "aguardando", "parada", "concluída" ou "arquivada".
  - Origem: regra do painel (DESENVOLVIMENTO "Parada, não arquivada, com tarefa aberta").
  - Coberto (A), pelos testes 2–4.
- **`visual.cartao-modelo-e-esforco`:** o cartão mostra o modelo e o esforço da filha. Origem: regra do painel (`turnStep`/`engine`). Checklist (o terminal não desenha).

## 3. Kit: o que muda (selo do kit regravado, tipo `refatoracao`)

`tests/kit/ambiente.ts`:
```ts
// Uma sessão filha como o host a lista e como ela publica o painel.
export type Filha = {
  id: string                      // 'local_<uuid>' (o recordStart só reconhece esse formato)
  nome?: string
  rodando?: boolean               // padrão true
  arquivada?: boolean
  aguardando?: boolean            // published.waiting
  aborted?: boolean
  painel?: { tasks: any[]; turns?: any[] }  // o grupo principal publicado
  git?: { repo: string; branch?: string; kind?: 'folder' }
  rate?: { toks: number; live: boolean }
}
export function host(on: any, sessoes: Filha[]): Host & { filha(id: string): Filha }
```
- Compatível com a tarefa 4: os campos novos são opcionais.
- `filha(id)` devolve o objeto mutável, para o teste mudar `rodando` ou `arquivada` entre duas releituras.
- O `fs.read` publica `{ version: 1, waiting, aborted, groups: [{ agent: '', label: '', tasks, turns }], waits: [], children: [], git: {...git, at}, rate: {...rate, at}, received }`.
- O `list_sessions` passa `isRunning` e `isArchived`.

`tests/kit/cenario.ts`:
```ts
// O modelo abre uma sessão filha (start_session); o stub devolve o id dela.
export const abrirSessao = ($: any, id: string) => ferramenta($, 'mcp__ccd_session__start_session', { title: 'filha' })
```
- O stub fica em `host()`: `on('tool.call', { tool: 'mcp__ccd_session__start_session' }, () => ({ result: \`Started session ${proxima}\` }))`, com uma fila de ids.
- Alternativa mais simples: `abrirSessao($, id)` registra o id a devolver num objeto compartilhado com o `host`.

`tests/kit/leitura.ts`:
- `Linha` ganha `sessao?: true`, para a linha de cartão: o ícone `◍` no começo, com `titulo` = o nome do cartão.
- Novo `temBusto(linhas, titulo): boolean`: a linha de tarefa tem `◍` depois do título.
- Novo `esperarPalavra(linhas, titulo, palavra)`: o texto da linha contém a palavra, com o painel em texto na falha.
- As linhas de tarefa não mudam. As linhas de cartão hoje saem com `titulo` vazio; os testes existentes não as procuram pelo título.

## 4. Testes (`tests/sessoes.test.ts`, commit A)

Ids das filhas: `K1 = 'local_11111111-1111-1111-1111-111111111111'`, `K2 = …2222…`.

Roteiro comum: `fixar(on)`; `const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TF] } }])`; `pedido`; `plan(A)` com A › {Um, Dois › {Dois.um}}; `start ['1']`; `abrirSessao($, K1)`; `aviso($)`.

1. **O cartão da filha fica sob a tarefa de onde foi aberta** (`sessoes.cartao-sob-a-tarefa-de-origem`):
   - a linha do cartão "filha-um" vem logo depois de "Um", com `nivel` maior;
   - a tarefa da filha ("Tarefa da filha") vem depois do cartão, com `nivel` maior que o do cartão.
2. **A filha trabalhando mantém a tarefa e os pais em andamento** (`sessoes.filha-trabalhando-mantem-pais-em-andamento`, `sessoes.palavra-de-estado-do-cartao`):
   - `done ['1']` → "Um" e "Plano A" `andamento`; o cartão sem palavra de estado;
   - `h.filha(K1).rodando = false`, com a tarefa da filha `done` no painel, e `aviso` → "Um" `concluida` e o cartão com "concluída".
3. **Filha parada: a iniciada aguarda e as pendentes seguem pendentes** (`sessoes.filha-parada-pendentes-seguem-pendentes`, `sessoes.palavra-de-estado-do-cartao`):
   - painel da filha: "Feita" ✓, "Começada" (iniciada, aberta), "Nunca" (pendente); `rodando: false`; `aviso`;
   - o cartão tem "parada"; "Começada" `aguardando`; "Nunca" `pendente`; nada `interrompida`;
   - com `aborted: true`: "Começada" `interrompida` e "Nunca" `pendente`.
4. **Filha arquivada: o que ficou aberto fica interrompido, e o pai com filha concluída aguarda** (`sessoes.filha-arquivada-interrompe`, `sessoes.palavra-de-estado-do-cartao`):
   - painel: "Pai da filha" › {"Feita" ✓, "Aberta" ○}; `arquivada: true`; `aviso`;
   - o cartão tem "arquivada"; "Aberta" `interrompida`; "Pai da filha" `aguardando`.
5. **O busto da sessão só na tarefa de que o cartão pende** (`sessoes.busto-so-no-pai`): com `start ['2.1']` antes do `abrirSessao` → `temBusto` em "Dois.um" verdadeiro; em "Dois", "Plano A" e no pedido, falso.
6. **Sessão numa pasta sem git mostra a pasta, sem branch** (`sessoes.pasta-sem-git`): `git: { kind: 'folder', repo: 'C:/projetos/solto' }` → o cartão contém `▭` e "solto"; não contém `⑂`.
7. **O cartão mostra toks/s e repositório com branch** (o id conforme a dúvida 1): `git: { repo: 'meu-repo', branch: 'minha-branch' }` e `rate: { toks: 42, live: true }` → o cartão contém "42 toks/s" e "meu-repo ⑂ minha-branch".

Asserções sempre em título, estado, ordem/nível e palavras da linha. Nenhum nome de função.

## 5. Commit B (rodadas), pode ficar para depois

Exige que o painel publicado da filha tenha `turns` com `at` (hora em que cada turno dela começou), e que o teste mande `envio` à filha em instantes diferentes (`relogio.advance`), para que `split` corte o cartão por rodada.
- `sessoes.mensagens-juntas-vao-a-ultima`: três envios em fila, um turno da filha depois do último → um cartão só, sob a tarefa do último envio.
- Um cartão por mensagem: a regra já existe no código (`4af1b92`) e falta no catálogo; o id novo seria `sessoes.um-cartao-por-mensagem`. Dois envios em turnos diferentes → dois cartões, cada um sob a tarefa da sua mensagem.
- `sessoes.rodada-descartada-fora-da-contagem`: uma rodada anterior deixada com tarefa aberta quando a seguinte começa → as tarefas dela não contam no cabeçalho ("x de y" não muda) e o chip "interrompida" não as conta.
- `sessoes.cadeia-sem-cartao-dentro-de-cartao` e `sessoes.mensagem-entre-filhas-no-cartao-da-remetente`: o painel publicado de K1 traz `children` (K2) e `sends`. Um cartão de K2 sob a tarefa de K1, sem cartão dentro de cartão na cadeia.

São os cenários mais frágeis: dependem da hora dos turnos e do corte por rodadas. Se algum divergir do esperado, fica `pendente` com o motivo, sem ajustar ao comportamento.

## 6. Checklist do app (cenários `checklist` em `regras/visual.md` e `regras/sessoes.md`)

- Modelo e esforço no cartão (`visual.cartao-modelo-e-esforco`).
- Posição de toks/s (à esquerda do modelo) e de repositório/branch (à direita do nome) no desktop.
- Anel de contexto (cor por faixa) e o ícone de busto na cor do estado.
- Sessões reais: a latência do poll de 3 s, o cartão "Sessão iniciando…", filhas de versões antigas do mod.

## 7. Dúvida para o usuário

1. "O cartão mostra toks/s, repositório e branch" pode virar duas regras?
   - o **conteúdo** (o texto aparece no cartão), coberto por teste;
   - a **posição** (toks/s à esquerda do modelo, repositório/branch à direita do nome, no desktop), no checklist do app.
   - Recomendado: sim. O harness lê o texto, mas não a posição na imagem.

## 8. Riscos

- **Selo do kit:** a mudança em `ambiente.ts`, `cenario.ts` e `leitura.ts` exige `npm run regras:selar -- --kit <arquivo> --tipo refatoracao --motivo "helpers de sessão"`. A etapa `regressao` roda os testes de `HEAD` (com o kit antigo) contra o código, que não muda, então não deve acusar nada.
- **Testes de envio com `local_x`:** hoje criam cartões "Sessão…" (o `sentMessage` cria a entrada). A leitura nova dá `titulo` a essas linhas; os testes de envio procuram tarefas pelo título, então não muda. Conferir que a etapa `selos` não acusa os testes de envio (não são tocados).
- **Ids sem formato de uuid** não passam no `recordStart`: usar `K1`/`K2` com uuid.
- **Recarga do clone:** nenhum arquivo do mod muda; só `tests/` e `regras/`. Escrever tudo de uma vez.
- **Comportamento divergente** em algum teste: é bug do plugin. Marcar o cenário `pendente` com o motivo e relatar; não ajustar a asserção.

## 9. Brief para a Implementação (commit A)

Na branch `test/regressivos-automacao-testes`, depois de `1eacad3`. Commit local. Sem push.

1. `tests/kit/ambiente.ts`: `Filha` e `host(on, sessoes)` com os campos opcionais, `filha(id)` e o stub de `start_session` (seção 3).
2. `tests/kit/cenario.ts`: `abrirSessao($, id)`.
3. `tests/kit/leitura.ts`: `sessao` na `Linha`, `temBusto` e `esperarPalavra`.
4. `tests/sessoes.test.ts` (novo): os testes 1–7 da seção 4, cada um com `// Regra:`.
5. `regras/sessoes.md`:
   - cartao-sob-a-tarefa-de-origem, filha-trabalhando, filha-parada, filha-arquivada, busto-so-no-pai e pasta-sem-git → `coberto`, com as origens da tabela;
   - novo `sessoes.palavra-de-estado-do-cartao` (coberto);
   - toks/repo conforme a dúvida 1;
   - os quatro de rodadas seguem `pendente (sessoes, rodadas)`;
   - novo `sessoes.um-cartao-por-mensagem` (pendente).
6. `regras/visual.md`: `visual.cartao-modelo-e-esforco` (checklist) e, conforme a dúvida 1, `visual.cartao-posicao-de-toks-e-repo` (checklist).
7. Selar: os 7 testes novos (`--tipo novo`) e os 3 arquivos do kit (`--kit … --tipo refatoracao --motivo "helpers de sessão"`).
8. `npm run check` verde; o relato traz a saída de `npm run testes:alterados` (deve dizer "nenhum teste existente mudou").

Commit: `test(task-tree): sessões filhas (cartão sob a origem, filha trabalhando, parada, arquivada, busto, pasta, toks e branch)`.

O usuário valida lendo `tests/sessoes.test.ts` e `regras/sessoes.md` (as origens e as palavras dele) e, no app, os itens da seção 6.
