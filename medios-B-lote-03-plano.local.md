# Lote 03: casamento por uma palavra só no nome da sessão

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão).

## 1. O que cobre

- Achado: "O casamento 'pelo nome da sessão' também é aplicado a textos livres, por qualquer palavra de
  4 letras".
- Decisão 20 (B), 2026-11-14: "Só no nome (Recomendado)". Texto da opção: "para o título da sessão e
  para a descrição e o tipo do subagente, o cartão só segue o texto quando o título da tarefa o contém
  inteiro (ou o texto contém o começo do título); senão vale a ordem de sempre (lote recente, a primeira
  sem carta)."

## 2. Causa confirmada na ponta

- `hooks/panel.ts:213-232`: `namedFor(title, names)` trata todo texto de `names` igual. Um texto casa
  com o título quando o título o contém (`t.includes(name)`, por trecho, sem olhar limite de palavra),
  quando o texto contém o começo do título antes de ":" (4 letras ou mais), ou quando uma palavra dele
  de 4 letras ou mais é palavra do título (`words`). `byName` (`:229-232`) só aceita o casamento com uma
  única candidata.
- Quem passa o quê:
  - a carta: `hooks/tool-call.ts:118`, o `to` do `SendMessage` e o nome que o app lista para aquele id
    (nomes de sessão);
  - a sessão aberta: `hooks/tool-call.ts:245-246`, o `name` e o `title` do `start_session`, juntos, e
    `hooks/sessions.ts:235-244` (`recordStart`) os repassa: o `title` é frase livre;
  - o subagente: `hooks/tool-call.ts:41` e `hooks/agents.ts:73`, a descrição e o tipo: frases livres.
- Escrito no código. Dedução do planejador, a partir do exemplo da própria pergunta ("o tipo 'Plan'
  dentro de 'Planejar…'"): esse caso não vem da palavra, vem do `t.includes(name)` por trecho ("plan"
  está dentro de "planejar"). Para a resposta valer no exemplo que a pergunta deu, "o título contém o
  texto inteiro" tem de ser lido em palavras inteiras quando o texto é frase livre.

## 3. O que muda

- `hooks/panel.ts`:
  - `namedFor` e `byName` passam a receber dois conjuntos: os nomes de sessão (casam como hoje: trecho,
    começo do título, palavra de 4 letras) e as frases livres. Uma frase livre casa só quando, sem
    acento, hífen nem maiúsculas, as palavras do título contêm a frase inteira como sequência de
    palavras inteiras, ou a frase contém, como sequência de palavras inteiras, o começo do título antes
    de ":" (4 letras ou mais). Uma palavra em comum não basta, nem um trecho dentro de uma palavra.
  - `sendAnchor` ganha o parâmetro das frases livres (por último, vazio por padrão) e o repassa nas
    duas chamadas de `byName`. O casamento único entre candidatas vale para a soma dos dois conjuntos.
- `hooks/tool-call.ts`:
  - `launch`: a descrição e o tipo vão como frases livres (nenhum nome de sessão).
  - a chamada de `recordStart`: o `name` como nome de sessão, o `title` como frase livre.
  - `sentMessage`: sem mudança (só nomes de sessão).
- `hooks/sessions.ts`, `recordStart`: recebe os dois conjuntos e os passa a `sendAnchor`.
- `hooks/agents.ts`: `anchorIn`, `launchAnchor` e `agentSpawn` passam a descrição e o tipo como frases
  livres.
- Comportamento novo no painel: com duas tarefas candidatas (duas em andamento, ou duas pendentes sem
  nada em andamento), o cartão de um subagente cuja descrição só tem uma palavra em comum com uma
  delas, ou cujo tipo é um trecho de uma palavra do título, deixa de ir para ela e segue a ordem de
  sempre (o lote recente, a primeira ainda sem carta nem cartão). O mesmo para o cartão da sessão
  aberta quando só o título dela tem a palavra. O nome da sessão segue decidindo por palavra.

## 4. Impacto

`npm run impacto -- task-tree/hooks/panel.ts task-tree/hooks/tool-call.ts task-tree/hooks/sessions.ts
task-tree/hooks/agents.ts`: a soma das áreas de envios, sessões, subagentes, perguntas, pedidos,
lembretes e durabilidade (o implementador cola a saída; `hooks/panel.ts` sozinho dá 69 cenários,
`hooks/agents.ts` 30, `hooks/tool-call.ts` 28). Golden: nenhum cenário pelo mapa (`hooks/*` fora o
núcleo não pinta).

## 5. Testes

Novos:

1. `tests/subagentes.test.ts`: "a descrição do subagente com só uma palavra em comum com uma tarefa não
   decide: o cartão segue a ordem". Cenários `envios.carta-pelo-nome-da-sessao` e
   `subagentes.cartao-desde-o-lancamento`. Roteiro: `lancaveis`; pedido; `plan` de um nível 1 com "Ler
   o kit" e "Descobrir como o hover funciona"; `start` nas duas (uma chamada, nessa ordem); `lancar`
   com a descrição "ver como ficou". Afirma: o cartão sob "Ler o kit" (a primeira do lote sem cartão),
   não sob a outra. Falha hoje: a palavra "como" leva o cartão à segunda.
2. `tests/subagentes.test.ts`: "o tipo do subagente que é só um trecho de uma palavra do título não
   decide". Mesmos cenários. Roteiro: nível 1 com "Ler o kit" e "Planejar a migração", `start` nas
   duas, `lancar` com `tipo: 'Plan'` e descrição "x". Afirma: o cartão sob "Ler o kit". Falha hoje:
   "plan" dentro de "planejar" leva o cartão à segunda.
3. `tests/subagentes.test.ts`: "a descrição inteira dentro do título leva o cartão a essa tarefa".
   Mesmos cenários. Roteiro: "Ler o kit" e "Revisar testes do hover", `start` nas duas, `lancar` com a
   descrição "revisar testes". Afirma: o cartão sob "Revisar testes do hover". Passa hoje (fixa o que
   fica).
4. `tests/sessoes.test.ts`: "o título da sessão nova com só uma palavra em comum com uma tarefa não
   decide: o cartão segue a ordem". Cenários `envios.carta-pelo-nome-da-sessao` e
   `sessoes.cartao-sob-a-tarefa-de-origem`. Roteiro: host com uma filha (id no formato `local_<uuid>`);
   pedido; `plan` com "Pesquisa web: changelog" e "Implementação: ler o código"; `start` nas duas (uma
   chamada, nessa ordem); a sessão aberta com `ferramenta($, 'mcp__ccd_session__start_session', { name:
   'sessao-um', title: 'Conferir o código gerado' })`; `aviso`. Afirma: o cartão sob "Pesquisa web:
   changelog" (a primeira do lote sem cartão). Falha hoje: a palavra "código" do título leva o cartão a
   "Implementação: ler o código".
5. `tests/sessoes.test.ts`: "o nome da sessão nova com uma palavra em comum com uma só tarefa leva o
   cartão a ela". Mesmos cenários. Roteiro igual, com `{ name: 'revisao-codigo', title: 'x' }`. Afirma: o
   cartão sob "Implementação: ler o código" (pela ordem iria à primeira). Passa hoje (fixa o que fica).

Testes existentes: nenhum muda. Os três de `envios.carta-pelo-nome-da-sessao`
(`tests/envios.test.ts:346-392`) usam o `to` do envio, que segue casando por palavra.

## 6. Catálogo e selos

`regras/envios.md`, `envios.carta-pelo-nome-da-sessao`:

- Título: fica.
- Quando: "…cujo nome casa com o título de uma única candidata (sem acento, sem hífen e sem diferença de
  maiúsculas: o título contém o nome, o nome contém o começo do título antes de ":", ou uma palavra do
  nome, com 4 letras ou mais, é palavra do título)".
- Então: acrescentar "; o título da sessão nova e a descrição e o tipo de um subagente são frases
  livres: só levam o cartão a uma tarefa quando o título dela contém a frase inteira, em palavras
  inteiras, ou a frase contém o começo do título; uma palavra em comum não decide".
- Linha nova antes do `Estado:`: `Reescrito: 2026-11-14, decisão do usuário ("Só no nome
  (Recomendado)"): o casamento por uma palavra vale só para o nome da sessão (o destino da mensagem, o
  nome da sessão aberta); para o título da sessão e para a descrição e o tipo do subagente, só a frase
  inteira. Os testes deste cenário não mudam.`
- `Código:` passa a `hooks/tool-call.ts, hooks/sessions.ts, hooks/agents.ts`.

Selos (`novo`), com o nome final de cada teste:

    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a descrição do subagente com só uma palavra em comum com uma tarefa não decide: o cartão segue a ordem" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só no nome (Recomendado)"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::o tipo do subagente que é só um trecho de uma palavra do título não decide" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só no nome (Recomendado)"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a descrição inteira dentro do título leva o cartão a essa tarefa" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só no nome (Recomendado)"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o título da sessão nova com só uma palavra em comum com uma tarefa não decide: o cartão segue a ordem" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só no nome (Recomendado)"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::o nome da sessão nova com uma palavra em comum com uma só tarefa leva o cartão a ela" --tipo novo --motivo "decisão do usuário, 2026-11-14: Só no nome (Recomendado)"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde `namedFor` ou "Pelo nome" é descrito (procurar `Pelo nome` e `por palavra`),
acrescentar a decisão de 2026-11-14 e a diferença entre nome de sessão e frase livre. Comentários de
`hooks/panel.ts:209-218`: reescritos com as duas regras. `CLAUDE.md`: nada.

## 8. Golden

Não muda: no cenário `subagente`, as descrições e o tipo "Explore" não casam com "Investigar" nem com
"Revisar" por nenhuma das regras, antes ou depois.

## 9. Checklist do app

Nada novo além do que o harness vê. Opcional: lançar um subagente com duas tarefas em andamento e uma
descrição que só compartilha uma palavra com a segunda.

## 10. Dependências e conflitos

- Depois dos lotes 01 e 02 (mesma função e mesmos comentários).
- Triagem A, decisão 13 ("Sim, o plan adota (Recomendado)": "soltos no fim só até o primeiro plan do
  pedido, que os adota sob a tarefa pelo nome da sessão, senão a primeira pendente"): a adoção de A usa
  o casamento "pelo nome". Ela deve chamar o casamento com a mesma separação deste lote (nome de sessão
  por palavra; título da sessão e descrição do subagente só por frase inteira). Se o lote de A vier
  antes, este lote adapta as chamadas novas de A; se vier depois, A usa a assinatura nova.
- Lote 26 (ferramenta antiga de mensagem): o destino dela (`session_id`, id ou nome curto) é nome de
  sessão.

## 11. Bloqueio

Nenhum. Um ponto de leitura, sem bloquear: "contém inteiro" foi lido em palavras inteiras para as frases
livres (seção 2), porque o exemplo da pergunta ("Plan" em "Planejar…") só deixa de errar assim. Para o
nome da sessão nada muda (segue por trecho, como os testes cobertos afirmam).
