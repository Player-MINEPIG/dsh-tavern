// This boundary isolates CSS, not JavaScript. All content must be purified first;
// user-supplied scripts, event handlers and templates never reach this function.
const BASE_STYLE = `
:host{display:block;font:inherit;color:inherit}
*,*::before,*::after{box-sizing:border-box}
:first-child{margin-top:0}p,ul,ol,blockquote,pre,table{margin:0 0 .85em}
ul,ol{padding-left:1.5em}
blockquote{padding-left:12px;border-left:3px solid var(--dsw-alias-border-secondary,#666)}
pre{max-width:100%;overflow:auto;padding:11px 12px;border-radius:9px;background:var(--dsw-alias-markdown-code-block,#181a20);white-space:pre}
code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:.92em}
:not(pre)>code{padding:.12em .35em;border-radius:5px;background:var(--dsw-alias-markdown-code-inline,#181a20)}
table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}
th,td{padding:6px 9px;border:1px solid var(--dsw-alias-border-l2,#555)}
img,video{max-width:100%;height:auto}
a{color:var(--dsw-alias-state-business-primary,#8ab4ff);text-decoration:underline}
hr{border:0;border-top:1px solid var(--dsw-alias-border-l2,#555)}
`

export function isolateStyledHtml(template, documentObject) {
  if (!template.content.querySelector('style')) return template.innerHTML

  // The outer paint/layout boundary is outside the shadow tree: even a template
  // rule targeting :host or a fixed-position child cannot cover the Host UI.
  const boundary = documentObject.createElement('div')
  boundary.setAttribute('data-dtv-style-boundary', '')
  boundary.setAttribute('style', 'display:block;min-width:0;contain:layout paint;isolation:isolate')
  const host = documentObject.createElement('div')
  const shadowTemplate = documentObject.createElement('template')
  shadowTemplate.setAttribute('shadowrootmode', 'open')
  shadowTemplate.setAttribute('data-dtv-style-root', '')
  const baseStyle = documentObject.createElement('style')
  baseStyle.textContent = BASE_STYLE
  shadowTemplate.content.append(baseStyle, template.content)
  host.append(shadowTemplate)
  boundary.append(host)
  template.content.append(boundary)
  return template.innerHTML
}

// innerHTML does not activate declarative shadow roots. React's ref runs after
// insertion/update; static HTML exports use the same markup natively, without JS.
export function mountStyledHtml(element) {
  if (!element) return
  for (const template of element.querySelectorAll('template[data-dtv-style-root]')) {
    const host = template.parentElement
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    root.replaceChildren(template.content)
    template.remove()
  }
}
