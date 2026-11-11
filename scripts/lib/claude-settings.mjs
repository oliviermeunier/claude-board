// Adds or removes the board hooks in a Claude Code settings object (~/.claude/settings.json),
// leaving every other hook untouched.

const MARKER = 'claude-hook.mjs'

const EVENTS = {
  SessionStart: { arg: 'session-start' },
  Stop: { arg: 'stop' },
}

function isBoardHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(MARKER)
}

export function removeBoardHooks(settings) {
  const next = structuredClone(settings ?? {})
  if (!next.hooks) return next
  for (const event of Object.keys(next.hooks)) {
    const groups = (next.hooks[event] ?? [])
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !isBoardHook(hook)) }))
      .filter((group) => group.hooks.length > 0)
    if (groups.length > 0) next.hooks[event] = groups
    else delete next.hooks[event]
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks
  return next
}

// `command(arg)` builds the shell command for one hook event.
export function addBoardHooks(settings, command) {
  const next = removeBoardHooks(settings)
  next.hooks ??= {}
  for (const [event, { arg }] of Object.entries(EVENTS)) {
    next.hooks[event] ??= []
    next.hooks[event].push({ hooks: [{ type: 'command', command: command(arg) }] })
  }
  return next
}
