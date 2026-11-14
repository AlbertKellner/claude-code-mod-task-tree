# Tarefa de mensagem: sempre o envelope (✉), só a cor muda

Pedido: "apareceu uma carta azul ao enviar mensagens entre sessões, mas depois foi trocado para um
check verde. nesse caso, e em todos os outros no qual isso acontece (carta trocando de icone), quero
que você mantenha o icone e troque somente a cor. quero diferencias as tarefas de execução, das
tarefas de mensagem" (prints 30 e 31: "Avisar a principal" no cartão da implementação, ✉ azul que
vira ✓ verde).

## Decisões do usuário
- Cores: **azul → verde**. Azul enquanto a mensagem não foi tratada (na fila / aguardando a sessão);
  **verde** assim que a sessão destino começa a tratar (mesmo que ainda trabalhe); **cinza** quando
  interrompida ou descartada.
- Contagem: a tarefa de mensagem **não conta** no x/y nem nas barras (nem no topo); só as tarefas de
  execução contam. Isto **muda** a regra do ajuste dos contadores ("chamar uma filha contabiliza"):
  a tarefa do envio deixa de contar 1; as folhas da filha penduradas nela continuam contando.
- Animação: o mesmo **pulo** dos outros ícones na troca de estado (50 % → 100 %).
- Palavra **apagada à direita**, como "interrompida" hoje: "na fila" (azul), "entregue" (verde),
  "interrompida" (cinza).

## Hoje: onde o ✉ vira outro ícone
- **Tom** (`draw/layout.ts:879–894`): `sent` só enquanto há envio **não tratado** ancorado na tarefa
  (`waitsOn = pending.filter(s => s.anchor === t.id)`, `pending` = `sends` sem `taken`). Tratado o
  envio, o tom cai na regra comum: `current` (◉, se a filha trabalha, d956e11), `done` (✓),
  `interrupted` (✕), `open`. Vale nas duas pontas: na principal (`model.sends`) e no cartão da filha
  (`p.sends` do arquivo publicado, `layout.ts:1076–1078`), que é o caso do print 31.
- **Ícone** (`draw/svg.ts:316–320`): o ✉ só sai de `icon('sent')`, classe `bl` (azul: `#378add`
  claro / `#85b7eb` escuro). `GLYPH.sent` (linha 31) no terminal.
- **Fim de turno** (`halt`, b897cac): poupa a folha com envio **não tratado**; tratado, segue a regra
  comum (✕ se iniciada e aberta).
- **Rodada descartada / sessão parada** (`panelOf`, `discarded`): a folha vira ✕ pelo `halt`/
  `interrupt`; o ✉ some.
- **Pai / pedido**: o tom do pai nunca é `sent` (é o da sua subárvore); o ícone de mensagem só vale
  para a folha que mandou.
- **Chip** "N aguardando sessão": conta linhas `sent`.
- **Alt**: `rowAlt` usa o `label` ("Aguardando confirmação de …" no `sent`).
- **Contagem**: a folha do envio entra em `count()` como qualquer folha (✓ conta como feita).

## Quem é tarefa de mensagem
Uma folha com **algum envio ancorado nela, tratado ou não** (`sends` guarda os envios com `taken`;
a tabela de durabilidade os mantém, `union`). Antes de um SendMessage sair, é tarefa comum. No
cartão da filha, o mesmo critério com os `sends` do arquivo dela.

## Plano
1. `draw/layout.ts`:
   - `msg(t) = allSends.some(s => s.anchor === t.id)` (principal: `model.sends`; cartão:
     `p.sends`), só para folhas.
   - Estado da mensagem: `queued` (algum envio não tratado) → **azul**; `delivered` (todos tratados)
     → **verde**; tarefa `interrupted` (ou rodada descartada, `halt` com `all`) → **cinza**.
   - `Row.msg?: 'queued' | 'delivered' | 'cut'`; o tom continua o de hoje (para o resto da linha:
     negrito, relógio, chips), mas o **ícone** passa a sair de `msg` quando ele existe.
   - `label`/`meta`: "na fila" / "entregue" / "interrompida" na palavra apagada à direita
     (`r.meta`, já desenhada em `s` com `opacity .75`); o alt diz "Mensagem para <sessão>: na fila |
     entregue | interrompida".
   - **Contagem**: `count()` passa a pular as folhas de mensagem (recebe o conjunto de ids de
     mensagem, ou cada `TaskNode` ganha uma marca no desenho); vale para o x/y das linhas, os pais,
     o pedido e o topo (`count(shown)` e `total`). As folhas da filha pendurada continuam contando.
     Um pai que só tem tarefas de mensagem fica sem x/y (`sub` indefinido quando `n = 0`).
2. `draw/svg.ts`:
   - `icon('sent')` vira `envelope(x, y, cls)` com a classe de cor por estado: `bl` (azul, já
     existe), `gr` (verde, já existe: `#639922` claro / `#97c459` escuro), `gy` (cinza).
     Contraste sobre o cartão (#20201f / #f9f9f7) e o painel: azul 6,5 / 3,8; verde 8,4 / 3,2;
     cinza 6,3 / 3,3 — todos legíveis para ícone (≥ 3).
   - `rowSvg`: o `lead` usa `envelope` quando `r.msg`.
3. `hooks/render.tsx`:
   - Pulo: `popsAt` passa a valer também para a troca de cor da mensagem (chave `#msg` em `mark()`:
     `queued` → `delivered` dispara o `pop` no `.ic`, como nas folhas).
   - Chip "aguardando sessão": continua contando as `queued`.
4. Terminal: o glifo `✉` em todos os estados, com a cor do estado (`permission` azul → `success`
   verde → `inactive` cinza).
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual: um envio a
   uma filha ocupada (✉ azul "na fila"), a filha começa a tratar (✉ verde "entregue", com o pulo),
   o x/y do pedido e do topo sem a tarefa da mensagem; no cartão da filha, "Avisar a principal"
   segue ✉ (azul → verde); uma mensagem interrompida (✉ cinza "interrompida"). Nos dois temas.
