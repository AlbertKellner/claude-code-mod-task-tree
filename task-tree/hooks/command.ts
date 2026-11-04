// /task-tree: opens the pane and says what the app answered.

import { PANE, DRAW_LIMIT, drawn, publishPanel } from './panel'

// Opens the panel, asked by the person (placed at any width), and says what the app answered and
// which panes it holds, so a panel that does not show up can be told apart: undrawn (the width),
// open behind another plugin's pane (a tab), or not there at all.

import type { EngineInterface } from 'claude-code'
export async function commandRun($: EngineInterface, e: any) {
  let opened: any
  try {
    opened = await $.ui.open({ id: PANE, title: 'Tarefas', focus: true })
  } catch (err) {
    opened = { isPlaced: false, reason: String(err) }
  }
  let panes = ''
  try {
    panes = (await $.ui.panes())
      .map((p: any) => `${p.id}${p.isShown ? ' (na frente)' : p.isPlaced ? ' (aba atrás de outra)' : ' (não desenhado)'}`)
      .join(', ')
  } catch {}
  void publishPanel($).catch(() => {})
  return {
    text: opened?.isPlaced
      ? `Painel de tarefas aberto. Painéis: ${panes || 'nenhum'}. Desenho: ${Math.round(drawn.size / 1024)} KB de ${Math.round(DRAW_LIMIT / 1024)} KB.`
      : `O app não pôs o painel na tela: ${String(opened?.reason ?? 'sem motivo')}. Painéis: ${panes || 'nenhum'}.`,
  }
}
