# Ícone de sessão (substituir o ⑂ de branch)

Pedido: "esse ícone de sessão não está bom aqui, ele significa branch e pretendo usar esse ícone em
breve. quais opções vc sugere para usar como ícone de sessão, sessão filha, sessão herdada, etc...?"

## Onde o ícone de sessão aparece hoje
Tudo em `draw/svg.ts`, função `branch(x, y, cls)` (linha 177: três bolinhas e a curva, 14 px):
1. **Cabeçalho do cartão** da sessão, à esquerda do nome (`labelSvg`, linha ~236); é também o botão
   que dobra o cartão.
2. **Linha de tarefa ou pedido com sessões embaixo**: o ⑂ pequeno à esquerda da barra
   (`rowSvg`, `forked`, linha ~365).
3. **Chip do cabeçalho** "N sessão ativa" (`icon('running')`, linha ~203, e `chips`, linha ~411).
4. **Terminal**: o glifo `⑂` em `GLYPH.running` (linha 25) e no `tail` das linhas
   (`hooks/render.tsx:211`).
Não é ícone de sessão: ✉ (`sent`, mensagem enviada aguardando), ↩ (`reply`, resposta do turno), ✕
(`archived`/`interrupted`), ◉/○/✓ (progresso). Esses ficam.

## Tipos a distinguir
O modelo (`Child`, `hooks/sessions.ts`/`io/host.ts`) sabe hoje: sessão aberta por esta
(`startedBy`), **viva** (`running`/`waiting`), **parada** (idle), **arquivada**; rodadas por mensagem
(`rounds`) e mensagem de irmã (`peer`). **Não** registra se a sessão nasceu por fork/herança de
contexto nem se está numa cadeia (sequência): isso só pode vir do `list_sessions` do app (não há
campo hoje) ou de uma marca do mod ao abrir. Então a variante "herdada" e "cadeia" ficam
desenháveis, mas só entram quando houver dado; de início o painel usa a variante "filha" para todas.
Estados: viva (anel de contexto já existe no cartão; proponho um ponto azul no ícone, ou nada),
parada (ícone a 60 %), arquivada (ícone a 35 %, como o cinza atual).

## Famílias (prova visual: `icones-sessao.svg`, nos fundos #20201f e #f9f9f7, em 2× e 1×)
| | filha | herdada | cadeia | prós | contras |
|---|---|---|---|---|---|
| **A. Janela** | janela com barra de título | duas janelas sobrepostas (a de trás apagada) | janela + › | "sessão = janela do app", literal; traços retos, nítidos em 14 px; neutro nos dois temas | parecido com o ícone de "painel" do app (≡/▤ ao lado); pouco "vivo" |
| **B. Balão** | balão de conversa | dois balões (citação) | balão + › | "sessão = conversa", bate com a ideia de mensagens entre sessões (✉/↩ no mesmo campo semântico) | o rabicho some em 1×; pode ser lido como "comentário" |
| **C. Agente** | busto (cabeça + ombros) | dois bustos | busto + › | "sessão = agente trabalhando", o mais expressivo; distinto de git e dos glifos do painel | mais pesado visualmente; em 1× a cabeça vira um ponto; repete a figura em cada cartão |
| **D. Órbita** | núcleo + anel tracejado + satélite | dois satélites | três núcleos ligados | abstrato, leve, lembra "processo/instância"; satélite aceita cor de estado; cadeia é natural | menos imediato ("o que é isso?"); anel tracejado fica serrilhado em 1× no claro |
A família git (⑂) fica livre para o uso futuro do usuário (branch).

## Plano (a completar com a escolha)
1. `draw/svg.ts`: nova função `sessionIcon(kind, state, x, y, cls)` com a família escolhida
   (variantes `filha|herdada|cadeia`, estado por opacidade/ponto); `branch()` fica para o futuro
   ícone de branch, sem uso no momento.
2. Trocar as 3 chamadas de `branch` (cabeçalho do cartão, linha com sessões embaixo, chip) por
   `sessionIcon`. No `labelSvg` manter o tamanho e a posição (é o botão de dobrar).
3. Terminal: `GLYPH.running` e o `tail`: glifo correspondente (janela ▭ / balão 🗨 ou ◌ / agente ☺
   ou ◍ / órbita ◎), um só caractere, sem emoji colorido.
4. `kind`: começar com `filha` para todas; quando o modelo souber de herança/cadeia (campo novo em
   `Child`, lido do app se existir), usar as variantes.
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod e a validação visual nos dois
   temas, no cartão, na linha com sessões e no chip.

## Decisão do usuário (depois da prova temporária no próprio painel)
- Família **C. Agente** (busto: cabeça + ombros; herdada = dois bustos; cadeia = busto + ›).
- Estado **por cores, as mesmas das tarefas**: ativa = âmbar (`am`/`amf`, como ◉), concluída =
  verde (`gr`/`grf`, como ✓), parada = cinza (`gy`), arquivada = cinza a 40 % de opacidade.
- A prova (bloco `PROVA-ICONES` em `hooks/render.tsx`) foi retirada; árvore limpa.

## Plano final
1. `draw/svg.ts`: `sessionIcon(kind: 'filha' | 'herdada' | 'cadeia', state: 'ativa' | 'concluida' |
   'parada' | 'arquivada', x, y)`, 14 px, traço 1,3 com `round`:
   - filha: `<circle cx=0 cy=-3 r=2.6/>` + ombros `M-5.5 5.5C-5.5 1.5 -3 .2 0 .2S5.5 1.5 5.5 5.5`;
   - herdada: um segundo busto menor atrás, deslocado (+4, −1), a 55 %; o da frente em (−2, +1);
   - cadeia: busto deslocado (−2,5) + seta › (`M4 0H7M5.5 -1.6L7.2 0L5.5 1.6`);
   - classes por estado: `am` / `gr` / `gy`, e `opacity=".4"` na arquivada.
2. Trocar `branch()` por `sessionIcon` nos três lugares: cabeçalho do cartão (`labelSvg`, mantendo
   posição e o botão de dobrar), linha com sessões embaixo (`rowSvg`, `forked`), chip "N sessão
   ativa" (`icon('running')`). `branch()` fica no arquivo, sem uso, reservado para o ícone de branch
   que o usuário quer usar depois.
3. Estado do cartão → ícone: `running`/`waiting` → ativa; arquivada → arquivada; sessão parada com
   todas as tarefas concluídas → concluída (verde); parada com tarefa aberta → parada (cinza). Na
   linha de tarefa com sessões embaixo: ativa se alguma sessão embaixo está viva, senão concluída
   se todas terminaram, senão parada. No chip "sessão ativa": ativa.
4. `kind`: `filha` para todas por enquanto; `herdada`/`cadeia` quando o modelo tiver o dado (campo
   novo em `Child`, a vir do app ou de marca do mod ao abrir).
5. Terminal: `GLYPH.running` e o `tail` de `hooks/render.tsx:211` passam de `⑂` para um glifo de
   pessoa de um caractere (`☺` é emoji em muitos terminais; preferir `◍` ou `●` com a cor do
   estado, ou manter texto "sessão"). Decidir na implementação pelo que o terminal do app renderiza.
6. Sem testes nem docs (memória do projeto). Validar a recarga do mod e a validação visual nos dois
   temas: cartão ativo (âmbar), cartão parado concluído (verde), arquivado (apagado), linha com
   sessões embaixo e chip.
