import MarkdownIt from 'markdown-it'
import { codeToHtml } from 'shiki'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
})

const TASK_PREFIX = /^\[([ xX])\] /

// Un jeton html_inline fixe : le texte de la tâche reste un jeton text, donc échappé comme le reste.
md.core.ruler.after('inline', 'task-lists', (state) => {
  const tokens = state.tokens
  for (let i = 0; i + 2 < tokens.length; i++) {
    const item = tokens[i]!
    const inline = tokens[i + 2]!
    if (item.type !== 'list_item_open' || tokens[i + 1]!.type !== 'paragraph_open' || inline.type !== 'inline') continue
    const first = inline.children?.[0]
    const match = first?.type === 'text' ? TASK_PREFIX.exec(first.content) : null
    if (!first || !match || !item.map) continue

    first.content = first.content.slice(match[0].length)
    const box = new state.Token('html_inline', '', 0)
    box.content = `<input type="checkbox" class="task-checkbox" data-line="${item.map[0]}"${match[1] === ' ' ? '' : ' checked'}> `
    inline.children!.unshift(box)
    item.attrJoin('class', 'task-item')
  }
})

// Both palettes are emitted as CSS variables; app.vue picks one from the active theme.
const SHIKI_OPTIONS = {
  themes: { light: 'github-light', dark: 'github-dark' },
  defaultColor: false,
} as const

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function renderMarkdown(source: string): Promise<string> {
  const baseHtml = md.render(source)

  const blockRe = /<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g
  const replacements: Array<{ match: string; html: string }> = []

  let m: RegExpExecArray | null
  while ((m = blockRe.exec(baseHtml)) !== null) {
    const lang = m[1] || 'text'
    const code = decodeEntities(m[2] || '').replace(/\n$/, '')
    let highlighted: string
    try {
      highlighted = await codeToHtml(code, { lang, ...SHIKI_OPTIONS })
    } catch {
      highlighted = await codeToHtml(code, { lang: 'text', ...SHIKI_OPTIONS })
    }
    const wrapped = `<div class="code-wrap" data-raw="${escapeAttr(code)}">${highlighted}<button class="copy-code" type="button" title="Copier ce bloc" aria-label="Copier ce bloc"><svg class="icon-copy" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg><svg class="icon-check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`
    replacements.push({ match: m[0], html: wrapped })
  }

  let final = baseHtml
  for (const r of replacements) {
    final = final.replace(r.match, r.html)
  }
  return final
}

const TASK_LINE = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/

// Passe par l'analyse Markdown pour ne basculer qu'une vraie tâche, jamais un « [ ] » de bloc de code.
export function toggleTask(source: string, line: number): string {
  const isTask = md.parse(source, {}).some((t, i, all) =>
    t.type === 'list_item_open' && t.map?.[0] === line && TASK_PREFIX.test(all[i + 2]?.content ?? ''))
  if (!isTask) return source

  const lines = source.split('\n')
  const match = TASK_LINE.exec(lines[line] ?? '')
  if (!match) return source
  const marker = match[2] === ' ' ? 'x' : ' '
  lines[line] = lines[line]!.replace(TASK_LINE, `$1[${marker}]`)
  return lines.join('\n')
}
