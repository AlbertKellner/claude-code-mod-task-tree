// A line in the debug log only; a failing log never breaks the session.
export async function debug($: any, text: string): Promise<void> {
  try {
    await $.ui.log(text, { to: 'debug' })
  } catch {}
}
