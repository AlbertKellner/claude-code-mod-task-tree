# Aviso "Painel grande demais" na Vitrine depois dos 20 MB (e colapso, em espera)

Análise de 2026-11-04. Só leitura; nada foi alterado no clone.
Pedido do usuário: "separe os problemas, primeiro investigue a mensagem". O colapso fica para novo
pedido; o que já se sabe dele está na última seção, sem conclusão.

## Resposta curta

**Causa não provada; ficou reduzida a duas.** A mensagem só existe num ponto do código, e só sai com
o desenho acima do limite do módulo carregado. Como a Vitrine passa de 600 KB o tempo todo, o aviso
continuou por uma destas razões:

1. **Módulo antigo:** o processo da Vitrine seguia com 600 KB em memória, porque a recarga não chegou.
2. **Desenho antigo:** o módulo recarregou, mas o painel seguia mostrando a última resposta guardada.

Falta uma leitura que só a própria Vitrine dá, e custa um comando (ver "Como decidir"). O limite de
20 MB em si está certo: o commit 8af6704 está no clone e a árvore está limpa.

## O que está provado

- **Um só caminho até a mensagem.** No código do mod, ela só sai em `hooks/render.tsx:343`, quando
  `drawn.size > DRAW_LIMIT`. Não há outro. As cópias em `~/.claude/plugins` (cache 0.7.4 e marketplace)
  têm o texto, mas o plugin instalado está desligado (`task-tree@claude-code-mod-task-tree: false`).
  O mod vem do clone, por `CLAUDE_CODE_PLUGIN_DIRS`.
- **A sessão não reiniciou.** O processo da Vitrine (PID 18696) começou às 14:00:31 e segue vivo. Isso
  é antes de 7da338d (14:27) e de 8af6704 (14:34). Ele nasceu com 600 KB.
- **Última leitura direta do limite na Vitrine:** às 14:23:31, `/task-tree` respondeu "Desenho: 694 KB
  de 600 KB." Ou seja, o aviso era legítimo naquele momento. Depois disso ninguém leu o limite ali.
- **O tamanho publicado sempre passou de 600 KB:** 769 KB, 780 KB, 786 KB e 866 KB (16:33 a 17:02).
  Então qualquer módulo com 600 KB mostra o aviso.

## O que é indício, não prova

- **Nada aponta para limite do app.** A busca nos logs de hoje não achou recusa nem corte de desenho.
  A orquestradora publicou 935 KB, e o usuário só se queixou do aviso nela durante o teste de 600 KB.
- **A recarga funcionou em outra sessão.** Durante o teste, o aviso apareceu em cerca de 1 minuto. Pelo
  relato da orquestradora, foi no painel dela. Se foi, ela já tinha carregado os 20 MB antes do teste.

## Como o app recarrega uma sessão aberta (lido no binário 2.1.317)

- O observador da pasta está ligado pela configuração do usuário, `CLAUDE_CODE_PLUGIN_DIR_WATCH: "1"`.
  Pelo código, sem ela o padrão é desligado em sessões não interativas, como as do app desktop.
- Ele consulta a pasta a cada 400 ms com a sessão ativa, e a cada 30 s depois de 60 s sem interação.
- Com um turno correndo, a recarga fica segura. Ela roda na próxima fronteira de turno (início ou fim),
  quando o observador reescaneia o que mudou.
- Mais de 5 recargas seguidas pausam o observador até 10 s de calma, e ele se recupera sozinho.
- Uma recarga que falha mantém a versão anterior. Isso só aparece no log de depuração, e as sessões não
  rodam com depuração, então a recarga não deixa rastro que dê para conferir.

Por essa regra, a Vitrine deveria ter recarregado por volta das 14:35. Ela estava parada desde 14:23:31
e seguiu parada até 16:32:23. Se isso falhou, o início do turno de 16:32:23 ainda teria reescaneado.

## Linha do tempo

| Hora | Fato |
|---|---|
| 14:00:31 | Processo da Vitrine começa, com 600 KB |
| 14:23:31 | `/task-tree` na Vitrine: 694 KB de 600 KB |
| 14:34:56 | Commit 8af6704, limite em 20 MB |
| 16:32:23 | Turno da Vitrine começa, depois de 2 h parada |
| 16:32:55 | Usuário: "a outra sessão continua mostrando que o painel é grande demais" |
| ~16:41 | Limite em 600 KB no clone, só como teste |
| 16:41:44 | Usuário: "esta mostrando a mensagem de painel grande demais" |
| 16:42:22 | Limite de volta em 20 MB |
| 17:00:23 | Turno da Vitrine termina (28 min seguidos, com perguntas abertas) |

Duas leituras dessa linha do tempo:

- **A queixa veio 32 s depois de a Vitrine acordar.** O usuário pode ter visto o que estava na tela
  durante as 2 h paradas. Sem tarefa rodando, nenhum relógio pede redesenho, e isso combina com o
  "desenho antigo".
- **O teste de 600 KB não diz nada sobre a Vitrine.** Ela estava em turno de 16:32 a 17:00, então a
  recarga ficou segura e o arquivo voltou antes do fim do turno.

## Como decidir

Na sessão Vitrine, fora de uma pergunta aberta, o usuário roda:

```
/task-tree
```

| Resposta | Conclusão | O que fazer |
|---|---|---|
| "… KB de 20480 KB" e sem aviso | Já recarregou; a causa fica em aberto, sem efeito agora | Nada urgente; repetir a leitura se o aviso voltar |
| "… KB de 20480 KB" e com aviso | Desenho antigo, confirmado | Correção abaixo |
| "… KB de 600 KB" | Módulo antigo, confirmado | Reiniciar a sessão resolve agora; investigar a recarga com `--debug-file` |

O comando vale também para a orquestradora, para confirmar que ela saiu do aviso depois do teste.
Isso ainda não foi conferido.

## Correção proposta

Só depende da leitura acima. Nenhuma mexe no limite de 20 MB.

- **Se for desenho antigo:** pedir um redesenho quando o mod carrega, com `$.ui.invalidate('ui.render')`
  em `sessionStart` (`hooks/session-start.ts`). Os tipos do kit dizem que o `session.start` roda de novo
  numa recarga. Falta confirmar no app se isso alcança um painel de sessão escondida.
- **Se for módulo antigo:** não há o que corrigir no mod. O caso vai para investigação da recarga do app,
  com uma sessão aberta com `--debug-file`, e o paliativo é reiniciar a sessão.
- **Nos dois casos (opcional):** publicar o limite carregado no arquivo de `task-tree-waits`. A próxima
  dúvida se resolve lendo o arquivo, sem pedir comando ao usuário.

### Cenário do catálogo

Não existe cenário sobre o aviso de tamanho em `regras/`. Proposta, em `regras/visual.md`:

- Id: `visual.recarga-troca-o-aviso-de-tamanho`
- Dado um painel com o aviso de tamanho, numa sessão parada
- Quando o mod recarrega com um limite maior que o desenho
- Então o painel volta a mostrar as tarefas, sem depender de um evento da sessão
- Estado: `checklist`, porque o harness não simula a recarga a quente

### Teste

O harness não alcança a recarga real. Dá para cobrir só a metade: um teste em
`tests/durabilidade.test.ts` que confere o pedido de redesenho no `session.start`. O resto fica no
checklist do app ("recarga a quente real").

### `npm run impacto -- hooks/session-start.ts`

```
Cenários afetados (8):
  durabilidade.reinicio-restaura-do-store                coberto   4 testes
  durabilidade.respawn-sem-session-start                 coberto   2 testes
  durabilidade.fim-do-turno-sobrevive-ao-reinicio        coberto   6 testes
  durabilidade.clear-esvazia                             coberto   1 teste
  durabilidade.formatos-antigos-do-publicado             coberto   1 teste
  durabilidade.recarga-mantem-painel-ligacoes-e-resumo   coberto   6 testes
  durabilidade.ligacoes-com-lista-parcial-do-host        coberto   1 teste
  durabilidade.resumo-do-done-na-recarga                 coberto   2 testes
Checklist do app: nenhum
Golden: nenhum cenário
Fora do mapa: nenhum
```

## Colapso: achados guardados, sem conclusão

Análise parada a pedido do usuário. Isto é só o que já tinha sido visto; nada aqui é causa.

- **No harness, o colapso funciona.** Um teste no scratchpad recolheu e reabriu linhas no terminal e no
  desktop, sobre o HEAD: 126 testes passaram, 0 falharam. O teste está em
  `<scratchpad>\colapso\task-tree\tests\zz-colapso.test.ts`.
- **O redesenho de 100 ms não parece necessário.** Os tipos do kit dizem que ler `$.state` no desenho
  assina aquela chave, e gravar nela redesenha sem `$.ui.invalidate`. `setFold` grava `collapsed`, e o
  render a lê. O harness confirma isso, mas não reproduz o app.
- **Quem tem `fold`:** o diff de 2f29ce8 não toca em `fold`. Em f46bdce, `render.tsx` e `geometry.ts` só
  perderam os botões de visão; o diff de `layout.ts` desse commit ainda não foi conferido.
- **Pista a seguir no log do app:** `%LOCALAPPDATA%\Claude\logs\claude.ai-web.log` tem 454 linhas
  "engine surface: ui_press not handled" do task-tree, de 2026-10-19 até 16:33:48 de hoje. Exemplos:
  `fold:_t:95` e `fold:_T:75`, vários seguidos, como cliques repetidos. No harness a chave vem com `|`
  (`fold:|t:A/2`), e aqui com `_`. Não verifiquei se isso importa, nem se a frequência mudou hoje.
