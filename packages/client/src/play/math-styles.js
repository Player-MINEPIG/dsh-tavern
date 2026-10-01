// Apply only within Tavern content; never introduce global KaTeX font rules.
export function mathStyles(scope) {
  return `${scope} .dtv-math-block{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding-block:.25em}`
}
