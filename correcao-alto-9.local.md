# Correção do achado alto 9: um aviso automático depois do Esc reacende as tarefas interrompidas

Data: 2026-11-11. Base: branch `fix/achados-altos-auditoria`, HEAD `ee8d8f0`. Ensaio num clone em
scratchpad; o repositório não foi alterado.

## Resumo

O achado tem duas partes, e a auditoria já as separa ("Ajuste da verificação à proposta"):

- **Parte A, entra sem decisão** (`correcao-alto-9.diff`): a marca do Esc não se perde mais no
  fim de um turno que não abriu pedido (aviso do app, hand-back de subagente, notificação de tarefa
  em segundo plano). A mensagem seguinte da pessoa (ou de outra sessão) volta a trazer o pedido de
  replanejar. Isso aplica `lembretes.replanejar-apos-esc-pessoa` ("precisa replanejar quando eu
  interrompo e envio nova mensagem", 2026-10-27) e `lembretes.outra-sessao-apos-esc`. Não muda o
  desenho, nenhum teste selado, nem o golden.
- **BLOQUEIO** (pergunta 8 da auditoria): o que o painel desenha durante e depois do turno do aviso.
  Hoje a tarefa parada volta a ◉ no prompt do aviso e fica ◷ no fim dele, e o cartão dessa sessão
  na mãe deixa de ser rodada descartada. Manter ✕ muda `turnos.prompt-seguinte-retoma` (teste selado
  `turnos.test.ts:133-146`) e o golden `principal`. Precisa da sua resposta.

Ensaio da parte A no clone: `npm run check` com todas as etapas ok (regras, travas, selos, os dois
validate, tsc, plugin test com 189 testes e 0 falhas, regressão com os 187 testes de `ee8d8f0`
contra o código novo e 0 falhas). `testes:alterados`: nenhum teste existente alterado; 2 novos. Os
2 testes novos falham contra o código de `ee8d8f0` (conferido num segundo clone), ou seja,
reproduzem o achado. `git apply --check` do diff sobre o repositório real: ok.

Observação do ensaio: no clone, o `claude plugin validate` não gerou `task-tree/.claude-plugin/types/`
(o tsc falhou por isso). Copiei a pasta gerada do repositório. No repositório real ela já existe.

## Por que a parte A não depende de decisão

- O defeito no código: `turnComplete` (`hooks/turn.ts:148`) grava `turnAborted = e.isAborted` em
  todo fim de turno da principal. Depois do Esc, o prompt do aviso sai pelo ramo sem turno
  (`prompt-submit.ts:66-80`) sem tocar na marca, e o fim normal desse turno a zera. A mensagem
  seguinte da pessoa recebe a lista comum ("deixe abertas só as que continuam"), contra
  `lembretes.replanejar-apos-esc-pessoa`.
- O próprio código já promete o contrário: a nota de `turnAborted` na tabela de durabilidade e em
  `types/index.d.ts` diz "until the next request".
- `turnAborted` também decide o desenho (`halt` com `aborted`) e o `aborted` publicado (rodada
  descartada na mãe). Mexer nele mudaria o desenho depois do turno do aviso (◷ vira ✕), que é a
  pergunta 8. Por isso a parte A usa uma marca própria, `replanDue`, só para o lembrete: o desenho e
  o publicado ficam exatamente como hoje.

## Parte A, passo a passo

Arquivos: `task-tree/hooks/turn.ts`, `task-tree/hooks/prompt-submit.ts`, `task-tree/hooks/panel.ts`,
`task-tree/state/durability.ts`, `task-tree/types/index.d.ts`, `task-tree/tests/lembretes.test.ts`,
`regras/lembretes.md`, `regras/selos.json`.

1. `npm run impacto -- task-tree/hooks/prompt-submit.ts task-tree/hooks/turn.ts task-tree/hooks/panel.ts task-tree/state/durability.ts task-tree/types/index.d.ts`:
   o núcleo (`types/index.d.ts`) é tocado, então todos os 133 cenários cobertos aparecem; os
   diretamente ligados são os de `lembretes.*`, `turnos.*` e `durabilidade.fim-do-turno-sobrevive-ao-reinicio`.
   É só orientação: o check roda tudo.
2. Estado novo `replanDue: boolean` (`types/index.d.ts`, no `PluginState`, com o comentário), com
   linha na tabela (`state/durability.ts`): `state+store`, campo do registro `turn`, `merge: current`,
   volta em `start`, `resume` e `first-use`, como `turnAborted`.
3. `hooks/panel.ts`: o registro `turn` ganha o campo `replan`. `saveTurn` grava, `ensureTurn` e
   `restoreTurn` trazem de volta, `clearTurn` (/clear) zera. Registro de versão anterior, sem o
   campo: `replan = aborted` (sem pedido desde o Esc, porque o pedido zera os dois).
4. `hooks/turn.ts` (`turnComplete`): no turno da principal parado (`isAborted`), `replanDue = true`.
   O fim normal não toca na marca. `turnAborted` segue como hoje.
5. `hooks/prompt-submit.ts`: o lembrete olha `turnAborted || replanDue` (o `||` cobre um state de
   antes da recarga, que só tem `turnAborted`); o ramo do pedido (pessoa ou outra sessão) zera os
   dois e grava o registro. O ramo sem turno não mexe em nada, como hoje.
6. Cenário novo em `regras/lembretes.md`, `lembretes.replanejar-apos-esc-com-aviso-no-meio`
   (texto no diff), estado `coberto`, origem: auditoria 2026-11-10, aplicando as duas regras acima,
   sem mudar nenhuma.
7. Dois testes novos em `task-tree/tests/lembretes.test.ts`, com `// Regra:
   lembretes.replanejar-apos-esc-com-aviso-no-meio` (o import novo vai numa linha própria, para não
   mexer nas declarações dos testes selados):
   - "depois do Esc, avisos que não abrem pedido no meio não tiram o pedido de replanejar da
     mensagem da pessoa": Esc, aviso do app + fim, hand-back + fim, notificação + fim; o pedido da
     pessoa traz "replaneje o painel", "o usuário interrompeu" e "Um", sem a lista comum; o seguinte
     volta à lista comum (vale uma vez);
   - "depois do Esc e de um aviso do app, a mensagem de outra sessão ainda pede para replanejar".
8. Selos (tipo `novo`):
   `npm run regras:selar -- "task-tree/tests/lembretes.test.ts::<nome>" --tipo novo --motivo "auditoria 2026-11-10: aviso automático depois do Esc apagava o pedido de replanejar"`,
   um para cada teste.
9. `npm run check`; commit local só desses arquivos (`git commit -- <caminhos>`), mensagem
   `fix(task-tree): o aviso depois do Esc não apaga o pedido de replanejar`.

Fica fora da parte A (é documentação, pergunta 37): `DESENVOLVIMENTO.md:97`, que diz que o `wake`
só roda no pedido da pessoa e no de outra sessão (ele roda em todo prompt e em toda chamada da
principal).

## BLOQUEIO: pergunta exata ao usuário

> Depois do Esc, enquanto o modelo trata um aviso automático (uma filha terminou, um subagente
> devolveu o resultado), e depois do fim desse turno, a tarefa que você parou:
> 1. **Segue ✕ até o modelo dar start nela de novo**, inclusive durante o aviso e depois de uma
>    mensagem sua em que ele inicia outra tarefa (Recomendada).
> 2. **Volta a ◉ sozinha no prompt seguinte e fica ◷ no fim do turno**, como hoje.

O que muda no painel com a opção 1:
- No prompt do aviso, a tarefa parada não acende; o relógio dela não volta a correr; no fim do turno
  do aviso ela segue ✕ (hoje vira ◷ "Aguardando").
- Numa mensagem sua depois do Esc, se o modelo dá start em outra tarefa, a parada segue ✕ (hoje
  volta a ◉ e depois ◷). Só um start nela a reacende.
- Se esta sessão é filha, o cartão dela na mãe segue "rodada descartada" (fora da contagem) até o
  start; hoje volta a contar depois do turno do aviso.
- Testes e desenho afetados: `turnos.prompt-seguinte-retoma` ("nada fica ✕ e a tarefa iniciada
  acende ◉") é reescrito, com o teste selado `turnos.test.ts::o prompt seguinte ao fim do turno volta
  ao trabalho e o start acende a tarefa` selado como decisão; o golden `principal` muda (a "Um.dois"
  parada com Esc no Pedido um fica ✕ em vez de ◷) e precisa da sua validação no app antes do
  `golden:aprovar`.

Como seria a implementação da opção 1 (depois da resposta, não ensaiada): uma lista `stopped` dos
ids que o Esc interrompeu (state + registro `turn`), gravada no `turnComplete` parado; o `layout`
desenha essas folhas ✕ mesmo com `turnEnded` nulo; `start` e `done` tiram o id da lista, e um plano
que substitui a tarefa também; o `aborted` publicado passa a ser "há id em `stopped` ainda aberto".
Cenário novo `turnos.parada-segue-interrompida-ate-o-start`, reescrita de `turnos.prompt-seguinte-retoma`.

Com a opção 2, nada mais entra além da parte A.
