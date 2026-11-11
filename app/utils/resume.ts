// Command that reopens the Claude Code conversation a note came from.
// Claude Code keeps conversations per folder, so the command first goes back to the session's folder.

const SAFE_SESSION_ID = /^[A-Za-z0-9._-]+$/

export function canResume(sessionId: string | null | undefined): sessionId is string {
  return typeof sessionId === 'string' && SAFE_SESSION_ID.test(sessionId)
}

function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

// `windows`: PowerShell syntax (`;`), which Windows PowerShell 5.1 needs since it has no `&&`.
export function resumeCommand(sessionId: string, cwd: string | null, windows: boolean): string {
  if (!canResume(sessionId)) throw new Error('invalid session id')
  const resume = `claude --resume ${sessionId}`
  if (!cwd) return resume
  return windows ? `cd "${cwd}"; ${resume}` : `cd ${posixQuote(cwd)} && ${resume}`
}
