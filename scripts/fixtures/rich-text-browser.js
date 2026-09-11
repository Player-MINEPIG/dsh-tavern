import { RichText, renderRichTextHtml, sanitizeRenderedHtml } from '../../packages/client/src/play/rich-text.js'
import { normalizeRegexRule, applyDisplayRegex } from '../../packages/client/src/play/regex.js'

const results = []
function check(name, condition) {
  results.push({ name, pass: Boolean(condition) })
}
function mount(text) {
  const element = document.createElement('div')
  element.className = 'message'
  document.body.append(element)
  update(element, text)
  return element
}
function update(element, text) {
  const { props, ref } = RichText({ text })
  element.innerHTML = props.dangerouslySetInnerHTML.__html
  ref(element)
}
function root(element) {
  return element.querySelector('[data-dtv-style-boundary] > div')?.shadowRoot
}

async function run() {
  if (globalThis.__regexFixture) {
    const rules = globalThis.__regexFixture.map(rule => normalizeRegexRule(rule))
    const output = applyDisplayRegex('<thinking>\n<!-- begin_of_Subtext_think -->\n<div class="fixture-body"><strong>Ready</strong></div>\n<!-- end_of_Subtext_think -->\n</thinking>\n\nAfter', rules, {}, 'assistant').text
    const card = mount(output)
    const shadow = root(card)
    check('imported template horizontal bar', getComputedStyle(shadow.querySelector('summary')).display === 'flex')
    check('imported template animation active', shadow.querySelector('.jdg-flower-moon').getAnimations().length > 0)
    shadow.querySelector('summary').click()
    check('imported template expanded HTML', shadow.querySelector('details').open && shadow.querySelector('.fixture-body strong')?.textContent === 'Ready')
  }
  const plain = mount('<details><summary>Status</summary>\n**Ready**\n\n- A\n- B\n</details>')
  check('details Markdown', plain.querySelector('details strong')?.textContent === 'Ready' && plain.querySelectorAll('li').length === 2)
  const code = mount('<details><summary>Code</summary>\n```\nA\nB\n```\n</details>')
  check('details fenced newlines', code.querySelector('pre code')?.textContent === 'A\nB\n')

  const rule = normalizeRegexRule({
    findRegex: '/<thinking>([\\s\\S]*?)<\\/thinking>/g',
    replaceString: `<style>
      body,.outside{color:rgb(255,0,0)!important}
      .bar{display:flex;align-items:center;gap:8px;list-style:none}
      .bar::-webkit-details-marker{display:none}
      .star{animation:twinkle 1s infinite}
      @keyframes twinkle{from{opacity:.2}to{opacity:1}}
</style>
<details><summary class="bar"><span class="star">☆</span><span>STATUS</span></summary>
$1
</details>`,
    trimStrings: ['<!-- begin_of_Subtext_think -->', '<!-- end_of_Subtext_think -->'],
  })
  const output = applyDisplayRegex('<thinking><!-- begin_of_Subtext_think -->\n<div class="body"><strong>Ready</strong></div>\n<!-- end_of_Subtext_think --></thinking>\n\nAfter', [rule], {}, 'assistant').text
  const outside = document.createElement('div')
  outside.className = 'outside'
  outside.textContent = 'Outside'
  document.body.append(outside)
  const before = getComputedStyle(outside).color
  const card = mount(output)
  const shadow = root(card)
  check('styled content mounted in shadow root', shadow !== undefined)
  check('horizontal summary', getComputedStyle(shadow.querySelector('summary')).display === 'flex')
  const star = shadow.querySelector('.star')
  check('CSS animation active', star.getAnimations().some(a => a.animationName === 'twinkle'))
  check('regex retains inner HTML', shadow.querySelector('.body strong')?.textContent === 'Ready')
  check('stylesheet cannot select outside message', getComputedStyle(outside).color === before)
  const other = mount('<style>.star{animation:none}</style><span class="star">Other</span>')
  check('styles independent between messages', getComputedStyle(root(other).querySelector('.star')).animationName === 'none' && getComputedStyle(star).animationName === 'twinkle')
  const details = shadow.querySelector('details')
  check('initially collapsed', !details.open)
  details.querySelector('summary').click()
  check('native click expands', details.open && shadow.querySelector('.body').getBoundingClientRect().height > 0)
  details.querySelector('summary').click()
  check('native click collapses', !details.open)

  const unsafe = mount(`<style>:host{position:fixed;inset:0}.fixed{position:fixed;inset:0}</style>
<div class="fixed">Contained</div><script>window.__templateExecuted=true</script>
<img src="invalid:" onerror="window.__templateExecuted=true">
<a href="javascript:window.__templateExecuted=true">Unsafe</a>
<iframe srcdoc="unsafe"></iframe><template shadowrootmode="open"><script>bad()</script></template>`)
  const unsafeRoot = root(unsafe)
  check('script and executable containers removed', !unsafeRoot.querySelector('script,iframe,template'))
  check('event handlers and javascript URLs removed', !unsafeRoot.querySelector('[onerror],a[href]') && !window.__templateExecuted)
  check('host styling stays within outer paint boundary', getComputedStyle(unsafe.querySelector('[data-dtv-style-boundary]')).contain.includes('paint'))
  check('direct sanitization still forbids unscoped styles', !sanitizeRenderedHtml('<style>body{color:red}</style><p>Safe</p>').includes('<style'))
  const link = mount('<style>p{color:inherit}</style><a href="https://example.com">Link</a>')
  check('shadow links retain safe target', root(link).querySelector('a').rel === 'noopener noreferrer')

  update(card, output.replace('Ready', 'Updated'))
  check('styled streaming update mounts new content', root(card).querySelector('.body strong')?.textContent === 'Updated')
  update(card, '**Plain again**')
  check('switching to plain content removes old shadow', !root(card) && card.querySelector('strong')?.textContent === 'Plain again')

  const frame = document.createElement('iframe')
  // Parser-created declarative roots are also used by downloaded static HTML.
  frame.srcdoc = `<!doctype html><body>${renderRichTextHtml(output)}</body>`
  const loaded = new Promise(resolve => { frame.onload = resolve })
  document.body.append(frame)
  await loaded
  const exported = frame.contentDocument.querySelector('[data-dtv-style-boundary] > div').shadowRoot
  check('static export activates CSS without template JS', exported?.querySelector('.body strong')?.textContent === 'Ready' && frame.contentWindow.getComputedStyle(exported.querySelector('summary')).display === 'flex')
}

run().catch(error => results.push({ name: error.stack, pass: false })).finally(() => {
  const report = document.createElement('pre')
  report.id = 'results'
  report.textContent = JSON.stringify(results)
  document.body.append(report)
})
