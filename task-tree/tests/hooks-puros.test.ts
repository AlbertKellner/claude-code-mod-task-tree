import { describe, expect, test } from 'claude-code/testing'
import { said } from '../hooks/prompt-submit'
import { brief } from '../hooks/turn'
import { begin, build, duplicates, edit, fillStarts, finish, resolve, settle } from '../state/tasks'
import { BRIEF } from '../text/rules'

// The pure parts the hook files expose: what a prompt is (prompt.submit's classification, apart from
// its effects), the ↩ line's cut (turn.complete) and the edits of the task tree (plan, start, done:
// ../state/tasks). The hooks themselves are covered by the mounted tests (task-tree.test.ts).

describe('prompt.submit: a classificação do prompt (said), pura', () => {
  test('pedido da pessoa: nem de outra sessão, nem hand-back, nem aviso; o título é o corpo', () => {
    const it = said('<system-reminder>status</system-reminder>\nCorrija o bug 3')
    expect(it).toEqual({ body: 'Corrija o bug 3', peer: false, handback: false, notice: false, title: 'Corrija o bug 3' })
  })
  test('mensagem de outra sessão: peer, com o título vindo de dentro da tag', () => {
    const it = said('<cross-session-message from="local_abc" name="Orq">\nok, prossiga\n</cross-session-message>')
    expect(it.peer).toBe(true)
    expect(it.handback).toBe(false)
    expect(it.notice).toBe(false)
    expect(it.title.trim()).toBe('ok, prossiga')
    // Cut before the closing tag: still the inner text.
    expect(said('<cross-session-message from="local_abc">texto').title).toBe('texto')
  })
  test('hand-back de subagente: pela tag agent-message (não local_) ou pelo marcador', () => {
    expect(said('<agent-message from="a1b2">pronto</agent-message>').handback).toBe(true)
    expect(said('[Subagent hand-back] terminou').handback).toBe(true)
    // An agent-message from a session (local_) is not a hand-back.
    expect(said('<agent-message from="local_x">oi</agent-message>').handback).toBe(false)
  })
  test('aviso do app: corpo vazio (só status) ou <side-sessions-event>', () => {
    expect(said('<system-reminder>só status</system-reminder>').notice).toBe(true)
    expect(said('').notice).toBe(true)
    expect(said('<side-sessions-event>a filha terminou</side-sessions-event>').notice).toBe(true)
    expect(said('texto qualquer').notice).toBe(false)
  })
})

describe('turn.complete: o ↩ em até BRIEF caracteres', () => {
  test('curto fica; longo corta numa palavra com …, nunca acima do limite', () => {
    expect(brief('  dois   espaços  ')).toBe('dois espaços')
    const long = Array.from({ length: 40 }, (_, i) => `palavra${i}`).join(' ')
    const cut = brief(long)
    expect(cut.length).toBeLessThanOrEqual(BRIEF)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.slice(0, -1).endsWith('palavra')).toBe(false)
    // One word longer than the limit: cut hard, no trailing punctuation.
    expect(brief('x'.repeat(BRIEF + 10) + ', ').length).toBe(BRIEF)
  })
})

describe('as edições da árvore (state/tasks), puras', () => {
  const plan = () => build([{ id: 'A', title: 'Pai', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: 'x', title: 'Fundo', children: [{ id: 'deep', title: 'Nível 4' }] }] }] }], 1, undefined, 100)

  test('build: ids abaixo do nível 1 ganham o prefixo, no máximo 3 níveis, plannedAt do relógio', () => {
    const t = plan()
    expect(t[0].id).toBe('A')
    expect(t[0].children.map(c => c.id)).toEqual(['A/1', 'A/2'])
    expect(t[0].children[1].children[0].id).toBe('A/x')
    expect(t[0].children[1].children[0].children).toEqual([])
    expect(t[0].plannedAt).toBe(100)
    expect(t[0].children[0].short).toBe('1')
    expect(duplicates(build([{ id: '1', title: 'a' }, { id: '1', title: 'b' }], 1))).toEqual(['1'])
  })

  test('resolve: id inteiro ou curto; abertas antes das fechadas; ambíguo diz as opções', () => {
    const t = plan()
    expect(resolve(t, 'A/1').node?.title).toBe('Um')
    expect(resolve(t, '1').node?.title).toBe('Um')
    expect(resolve(t, 'nada')).toEqual({})
    const two = [...t, ...build([{ id: 'B', title: 'Outro', children: [{ id: '1', title: 'Um de B' }] }], 1)]
    expect(resolve(two, '1').error).toContain('ambíguo')
    // A closed one and an open one with the same short id: the open wins.
    const closed = edit(two, 'A/1', finish(200))
    expect(resolve(closed, '1').node?.id).toBe('B/1')
  })

  test('begin: marca em andamento, reabre pais, guarda o relógio; done: fecha a subárvore e o pai completo', () => {
    let t = plan()
    t = begin(t, 'A/x', 1, 150)
    const x = t[0].children[1].children[0]
    expect(x.started).toBe(1)
    expect(x.startedAt).toBe(150)
    expect(t[0].startedAt).toBe(150)
    // done on "1": closes it and gives it a start (none before: the parent's start).
    t = settle(edit(fillStarts(t, 'A/1', 300), 'A/1', finish(300)), 300)
    expect(t[0].children[0].status).toBe('done')
    expect(t[0].children[0].startedAt).toBe(150)
    expect(t[0].children[0].endedAt).toBe(300)
    expect(t[0].status).toBe('open')
    // done on "2": its subtree goes, and the parent completes.
    t = settle(edit(fillStarts(t, 'A/2', 400), 'A/2', finish(400)), 400)
    expect(t[0].children[1].children[0].status).toBe('done')
    expect(t[0].status).toBe('done')
    expect(t[0].endedAt).toBe(400)
    // begin on a closed leaf reopens it and its parent.
    t = begin(t, 'A/1', 2, 500)
    expect(t[0].status).toBe('open')
    expect(t[0].children[0].status).toBe('open')
    expect(t[0].children[0].startedAt).toBe(500)
  })

  test('fillStarts: uma tarefa fechada sem start começa no fim da irmã fechada antes dela', () => {
    let t = plan()
    t = settle(edit(fillStarts(t, 'A/1', 300), 'A/1', finish(300)), 300)
    t = fillStarts(t, 'A/2', 350)
    expect(t[0].children[1].startedAt).toBe(300)
    // Never after now.
    const late = fillStarts(plan(), 'A/1', 50)
    expect(late[0].children[0].startedAt).toBe(50)
  })
})

// The cut of a title with "…" (draw/svg fit): pinned against the rule it had before phase 6 (the
// width recomputed for every prefix), over many titles, sizes and widths, so a faster fit must give
// the same string, character for character, including the trailing spaces trimmed before the "…".
import { em, fit, textW } from '../draw/svg'

describe('fit: o corte de títulos com … é o mesmo da regra original', () => {
  // The rule as it was: every prefix measured whole.
  function fitRef(s: string, size: number, max: number): string {
    if (textW(s, size) <= max) return s
    let out = ''
    for (const ch of Array.from(s)) {
      if (textW(out + ch + '…', size) > max) break
      out += ch
    }
    return out.trimEnd() + '…'
  }
  const TITLES = [
    'Um título bem comprido que não cabe na largura estreita do painel <b>',
    'Corrigir o bug 3 da fase 4: teste instável no orçamento, duas suítes ao mesmo tempo',
    'Orquestração de alteração do plugin',
    'WWW MMM iii lll 111 ... ,,, ::: ;;; !!! ||| ((( ))) [[[ ]]] fff ttt rrr jjj',
    '한국어 제목이 길어서 잘려야 합니다 — 넓은 글자',
    '日本語のタイトルも長いので切られる必要があります',
    'Emoji 🎉🚀🔥 no título e texto depois dele que continua por um bom tempo',
    'a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m n o p',
    'palavra   com   espaços   largos   no   meio   e   no   fim   ',
    'curto',
    '',
    'x',
    'Trailing spaces before the cut point should be trimmed      and then more text here',
  ]
  test('igual à regra original em todos os títulos, tamanhos e larguras', () => {
    let cut = 0
    let compared = 0
    for (const s of TITLES) {
      for (const size of [12, 14]) {
        for (let max = 0; max <= 600; max += 7) {
          const got = fit(s, size, max)
          expect(got).toBe(fitRef(s, size, max))
          compared++
          if (got !== s) {
            cut++
            // What is kept, plus the "…", fits (or nothing is kept).
            expect(got.endsWith('…')).toBe(true)
            expect(got === '…' || textW(got, size) <= max).toBe(true)
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(2000)
    expect(cut).toBeGreaterThan(500)
  })
  test('casos fixos: cabe inteiro, corta numa palavra com espaços aparados, corta tudo', () => {
    expect(fit('Orquestração de alteração do plugin', 12, 600)).toBe('Orquestração de alteração do plugin')
    expect(fit('Um título bem comprido que não cabe na largura estreita do painel', 12, 100)).toBe('Um título bem c…')
    expect(fit('Um título bem comprido que não cabe na largura estreita do painel', 14, 60)).toBe('Um títu…')
    expect(fit('palavra   com   espaços', 12, 50)).toBe('palavra…')
    expect(fit('abc', 12, 1)).toBe('…')
    // The "…" is measured as an ordinary 0.56 em glyph.
    expect(em('…')).toBe(0.56)
  })
})
