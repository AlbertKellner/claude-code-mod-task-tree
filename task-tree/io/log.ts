// A line in the debug log only; a failing log never breaks the session.
export async function debug($: any, text: string): Promise<void> {
  try {
    await $.ui.log(text, { to: 'debug' })
  } catch {}
}
// A line said once per module and text (the reason is in the text): a write that fails at every
// change, or a read that fails at every use, is said once.
const said = new Set<string>()
export async function debugOnce($: any, text: string): Promise<void> {
  if (said.has(text)) return
  said.add(text)
  await debug($, text)
}
// One accessory step of a hook: run on its own, its failure said once per step and reason
// ("<where>, passo <name>: <error>"), and undefined answered, so the steps after it still run.
export async function guardStep<T>($: any, where: string, name: string, run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run()
  } catch (err) {
    await debugOnce($, `task-tree: ${where}, passo ${name}: ${String(err)}`)
    return undefined
  }
}
