import { expect, test } from 'claude-code/testing'

// Fumaça: o mod carrega, a tool plan responde e a tarefa planejada aparece no painel.

const PANE_PROPS = {
  title: 'Tarefas',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { top: 0, bodyRows: 40 },
  view: {},
} as any

const texto = (el: any): string =>
  typeof el === 'string' ? el : el?.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(texto).join('')

// Regra: fumaca.plan-mostra-tarefa
test('plan mostra a tarefa no painel', async ($: any) => {
  const r = await $.tool.call({ tool: 'mcp__task-tree__plan', tasks: [{ id: '1', title: 'Tarefa de fumaça' }] })
  expect(String(r?.result ?? r?.text ?? '')).toContain('Plano exibido')

  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
  const painel = texto(await ui.drawn())
  await ui.unmount()
  expect(painel).toContain('Tarefa de fumaça')
})
