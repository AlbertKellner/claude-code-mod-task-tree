# Lote 25: o nome do destino na carta

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "O nome do destino na carta: irmã e mãe aparecem como 8 caracteres do id". Nenhuma
decisão nova.

## 2. Causa confirmada na ponta

`draw/layout.ts:1351-1356` (`nameOf`, dentro de `panel`): o nome do destino só é procurado entre as
sessões filhas do painel desenhado e as filhas de quem desenha (`[...(p.children ?? []),
...model.children]`); o que não é achado vira `to.slice(6, 14)`, oito caracteres do id.

- No painel de uma filha que manda sinal à irmã ou à mãe pelo id: nenhuma das duas é filha dela; a carta
  diz "Para 1a2b3c4d: …".
- No painel da mãe, no cartão dessa filha: a irmã é achada (é filha da mãe), mas quando o destino é a
  própria mãe, não: código hexadecimal.
- O envio a um id que a lista ainda não traz cria uma entrada de sessão sem nome
  (`hooks/tool-call.ts:134-135`, título "Sessão…"); `nameOf` a acha, não tira nome dela e cai no mesmo
  código.

O que a sessão já sabe e não usa: as linhas da lista de sessões ligadas, com id e nome, lidas em
`hooks/sessions.ts:43-44` antes de filtrar as filhas (`mineOf`, `:70`); o nome que a marca da mensagem
recebida traz (`<cross-session-message from="local_…" name="…">`, lido em `hooks/prompt-submit.ts:38-41`
para o pedido); e o id próprio, que o desenho recebe (`ownId` em `layout`, `me` em `panel`). Escrito no
código. Não confirmado pelo código: se a lista do app traz a mãe e as irmãs para uma sessão filha (o
comentário de `io/host.ts:40-43` diz que a lista deixa a própria sessão de fora e traz quem iniciou
quem); e se a resposta de `get_session` traz o nome da própria sessão.

## 3. O que muda

- Estado novo: um mapa de id de sessão para nome (chave nova do `$.state`, nome sugerido `names`),
  declarada em `types/index.d.ts` e com linha na tabela de `state/durability.ts` (vive só no state: a
  releitura de 3 s o refaz depois de um processo novo).
- `hooks/sessions.ts`, `refreshChildren`: com a lista lida, toda linha com id e nome entra no mapa (as
  filhas, e também a mãe e as irmãs quando a lista as traz). Gravado só quando muda.
- `hooks/sessions.ts`, `noteReceived`: o nome que a marca da mensagem recebida traz entra no mapa, pelo
  id de quem enviou.
- `hooks/panel.ts`, `selfId`: se a resposta do app trouxer o nome (ou o título) da própria sessão, ele
  entra no mapa pelo id próprio. Se não trouxer, nada.
- `hooks/render.tsx`: lê o mapa e o passa ao desenho, no modelo (`Model`, em `draw/layout.ts`, ganha o
  campo, opcional).
- `draw/layout.ts`, `nameOf`: a ordem passa a ser: o nome da sessão filha conhecida (como hoje; a
  entrada sem nome não conta); o nome do mapa; e só então os oito caracteres do id. Vale para o painel
  principal e para os cartões (no cartão da filha, o destino que é a própria sessão que desenha é achado
  no mapa pelo id próprio, quando o nome dela é conhecido).

No painel: a carta para a irmã ou para a mãe diz "Para <nome>: …" no painel da filha; no painel da mãe,
o cartão da filha diz o nome da irmã (como hoje) e, quando o destino é a própria mãe, o nome dela se o
app o informa. Sem nome conhecido, fica como hoje (os oito caracteres).

## 4. Impacto

`npm run impacto -- task-tree/hooks/sessions.ts task-tree/hooks/panel.ts task-tree/hooks/render.tsx
task-tree/draw/layout.ts task-tree/types/index.d.ts task-tree/state/durability.ts`: todos os cenários
(núcleo). Golden pelo mapa: os quatro; no `envios`, o destino é uma filha listada com nome ("outra"),
achada como hoje: o desenho não muda.

## 5. Testes

Mudança no kit (`tests/kit/ambiente.ts`), só acréscimos: uma sessão do `host` pode dizer quem a iniciou
(um campo opcional, por exemplo `iniciadaPor`; sem ele, esta sessão, como hoje), para a lista trazer uma
sessão ligada que não é filha (a mãe, uma irmã); e o `host` pode receber o nome desta sessão, que o
`get_session` simulado passa a devolver. Selo do kit na seção 6.

Novos:

1. `tests/envios.test.ts`: "a carta para uma sessão que não é filha mostra o nome que veio na mensagem
   dela". Cenário novo `envios.carta-mostra-o-nome-do-destino`. Roteiro: host vazio; `responderEnvio`;
   `mensagemDe($, <id da mãe, formato local_<uuid>>, 'faça X')` (o kit põe `name="outra"` na marca);
   plan; start; `envio` ao id da mãe. Afirma: a linha da carta começa com "Para outra". Falha hoje:
   "Para " e oito caracteres do id.
2. `tests/envios.test.ts`: "a carta para uma irmã listada pelo app mostra o nome dela". Mesmo cenário.
   Roteiro: host com uma sessão `{ id: <irmã>, nome: 'irma-docs', iniciadaPor: <outra sessão> }`; pedido;
   plan; start; `aviso` (lê a lista); `envio` ao id dela. Afirma: "Para irma-docs"; e que ela não ganhou
   cartão de filha por estar na lista (nenhuma linha de sessão "irma-docs" antes do envio). Falha hoje.
3. `tests/sessoes.test.ts`: "no cartão da filha, a carta para a própria mãe mostra o nome da mãe quando o
   app o informa". Mesmo cenário. Roteiro: host com o nome desta sessão ("orquestradora") e uma filha
   que publica `envios: [{ to: EU, anchor: <tarefa dela>, at: … }]`. Afirma: a linha da carta no cartão
   começa com "Para orquestradora". Falha hoje (oito zeros do id).

Testes existentes: nenhum muda.

## 6. Catálogo e selos

`regras/envios.md`, cenário novo:

- `### envios.carta-mostra-o-nome-do-destino`
- Título: "A carta diz o nome da sessão destino, também quando ela não é filha desta sessão."
- Dado uma mensagem enviada pelo id a uma sessão que não é filha de quem envia (a mãe, uma irmã)
- Quando a carta é desenhada, no painel de quem enviou ou no cartão dela na sessão mãe
- Então ela diz "Para <nome>: …" com o nome que a lista de sessões do app ou a mensagem recebida dessa
  sessão informaram; no cartão da filha, o destino que é a própria sessão que desenha aparece com o nome
  dela, quando o app o informa; sem nome conhecido, os oito primeiros caracteres do id, como antes
- `Origem: auditoria 2026-11-10 (irmã e mãe apareciam como 8 caracteres do id); aplica
  envios.carta-sob-a-tarefa ("Para <sessão>: <mensagem>"), sem mudar nenhuma regra.`
- `Código: draw/layout.ts, hooks/render.tsx, hooks/prompt-submit.ts`
- `Estado: coberto`

Selos:

    node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "o host simulado pode listar uma sessão ligada que não é filha e informar o nome desta sessão; nada do que os testes afirmam muda"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::a carta para uma sessão que não é filha mostra o nome que veio na mensagem dela" --tipo novo --motivo "o nome do destino na carta"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::a carta para uma irmã listada pelo app mostra o nome dela" --tipo novo --motivo "o nome do destino na carta"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::no cartão da filha, a carta para a própria mãe mostra o nome da mãe quando o app o informa" --tipo novo --motivo "o nome do destino na carta"

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Estado e durabilidade" e na "Tabela de durabilidade", a chave nova; no desenho
das cartas, de onde vem o nome. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Numa filha real que manda sinal à irmã e à mãe pelo id: no painel da filha, as cartas dizem os nomes. No
painel da mãe, o cartão da filha: a carta para a mãe mostra o nome dela, se o app o informa (se mostrar
o código, anotar: é o limite conhecido deste lote).

## 10. Dependências e conflitos

- Depois do lote 11 (as cartas nos cartões; mesma função `panel`, ao lado de `letters`). Se o lote 04 já
  mudou `tests/kit/ambiente.ts` (o status), o selo do kit daqui é mais um, sobre o arquivo como estiver.
- Lote 10 também acrescenta uma chave de state e uma linha na tabela de durabilidade: as duas convivem
  (esta não vai ao store).
- Lote 26 (ferramenta antiga de mensagem): o destino dela pode ser um nome curto ou "parent"; `nameOf`
  mostra o que vier, e o mapa ajuda quando vier o id.
- Triagem A, decisão 13 ("Sim, o plan adota"): a adoção pelo nome da sessão pode usar o mesmo mapa para
  saber o nome de um destino que não é filha. Triagem C, decisão 35 ("Enxugar e esvaziar", arquivos
  publicados): o mapa não é publicado.

## 11. Bloqueio

Nenhum. Dois limites conhecidos, que o código não deixa confirmar: se a lista do app traz a mãe e as
irmãs para uma filha (se não trouxer, sobra o nome da mensagem recebida), e se o app informa o nome da
própria sessão (se não informar, o destino "a própria mãe" segue com o código, como hoje).
