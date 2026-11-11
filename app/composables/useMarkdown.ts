import MarkdownIt from 'markdown-it'
import { codeToHtml } from 'shiki'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
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
