<template>
  <main class="board">
    <header class="brand">
      <BrandMark class="brand-mark" />
      <div class="brand-text">
        <span class="wordmark">Claude <span class="wordmark-accent">Board</span></span>
        <span class="tagline">Les notes de tes sessions Claude Code</span>
      </div>
    </header>
    <NoteList />
  </main>
</template>

<style>
/*
 * Charte graphique (voir DESIGN.md) — deux couleurs :
 *   --primary   « Lagune », sarcelle : tout ce qui est interactif (onglet actif, liens, focus, boutons).
 *   --highlight « Ambre » : ce qui vient d'arriver (pastilles, bordure des notes non lues, bandeau).
 * Les fonds sont des gris légèrement teintés de sarcelle, pour que les deux couleurs restent les seules vives.
 */
:root {
  --bg: #0b1214;
  --bg-elev: #111b1e;
  --bg-elev-2: #182529;
  --border: #23343a;
  --text: #e4eef0;
  --text-dim: #8a9ea4;
  --code-bg: #0d181b;

  --primary: #2ec4b6;
  --primary-hover: #5dd9cd;
  --primary-soft: rgba(46, 196, 182, 0.14);
  --on-primary: #04201d;

  --highlight: #ffb547;
  --highlight-soft: rgba(255, 181, 71, 0.12);
  --highlight-border: rgba(255, 181, 71, 0.45);
  --highlight-text: #ffc977;
  --on-highlight: #2b1a00;

  --danger: #ff6b4a;
  --danger-soft: rgba(255, 107, 74, 0.13);
  --danger-border: rgba(255, 107, 74, 0.5);
  --on-danger: #2a0a03;

  --glow: rgba(46, 196, 182, 0.09);
  --shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  --radius: 12px;
  color-scheme: dark;
}

/* Light palette: explicit choice, or system preference when the theme is "auto". */
:root[data-theme="light"] {
  --bg: #f4f7f6;
  --bg-elev: #ffffff;
  --bg-elev-2: #ebf1f0;
  --border: #d9e3e1;
  --text: #102221;
  --text-dim: #5a6e6c;
  --code-bg: #f1f6f5;

  --primary: #0b7a70;
  --primary-hover: #086158;
  --primary-soft: rgba(11, 122, 112, 0.1);
  --on-primary: #ffffff;

  --highlight: #f59e0b;
  --highlight-soft: #fff4de;
  --highlight-border: #f5c46b;
  --highlight-text: #8a4b00;
  --on-highlight: #2b1a00;

  --danger: #c4401c;
  --danger-soft: #fdebe4;
  --danger-border: #f2b39f;
  --on-danger: #ffffff;

  --glow: rgba(11, 122, 112, 0.07);
  --shadow: 0 6px 24px rgba(16, 34, 33, 0.08);
  color-scheme: light;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #f4f7f6;
    --bg-elev: #ffffff;
    --bg-elev-2: #ebf1f0;
    --border: #d9e3e1;
    --text: #102221;
    --text-dim: #5a6e6c;
    --code-bg: #f1f6f5;

    --primary: #0b7a70;
    --primary-hover: #086158;
    --primary-soft: rgba(11, 122, 112, 0.1);
    --on-primary: #ffffff;

    --highlight: #f59e0b;
    --highlight-soft: #fff4de;
    --highlight-border: #f5c46b;
    --highlight-text: #8a4b00;
    --on-highlight: #2b1a00;

    --danger: #c4401c;
    --danger-soft: #fdebe4;
    --danger-border: #f2b39f;
    --on-danger: #ffffff;

    --glow: rgba(11, 122, 112, 0.07);
    --shadow: 0 6px 24px rgba(16, 34, 33, 0.08);
    color-scheme: light;
  }
}

/* Code blocks sit on the board's own code background; only the token colours come from Shiki. */
.shiki {
  background-color: var(--code-bg) !important;
}
.shiki span {
  color: var(--shiki-dark);
}
:root[data-theme="light"] .shiki span {
  color: var(--shiki-light);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) .shiki span {
    color: var(--shiki-light);
  }
}

* { box-sizing: border-box; }

/* Text size: every size in the app is in rem, so this one value scales the whole board. */
html { font-size: 16px; }
html[data-text-size="small"] { font-size: 14.5px; }
html[data-text-size="large"] { font-size: 18px; }

html, body, #__nuxt {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, 'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, Roboto,
    'Helvetica Neue', sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* A faint teal glow behind the header. */
body {
  background: radial-gradient(70rem 26rem at 50% -12rem, var(--glow), transparent 70%), var(--bg);
  background-attachment: fixed;
}

::selection {
  background: var(--primary-soft);
}

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

code, pre, kbd, textarea {
  font-family: 'Cascadia Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.board {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.75rem 1.25rem 5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
}
.brand-mark {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.wordmark {
  font-size: 1.375rem;
  font-weight: 750;
  letter-spacing: -0.03em;
}
.wordmark-accent {
  color: var(--primary);
}
.tagline {
  color: var(--text-dim);
  font-size: 0.875rem;
}

button {
  font: inherit;
  color: inherit;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
button:hover { background: var(--border); }
button.danger {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: var(--danger-border);
  font-weight: 600;
}
button.danger:hover { background: var(--danger); border-color: var(--danger); color: var(--on-danger); }
</style>
