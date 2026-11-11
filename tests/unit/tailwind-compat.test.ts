import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// app/globals.css restores Tailwind 3's space-x-* / space-y-* for each size the
// app uses (see the comment there). A size missing from that list would
// silently fall back to v4's behaviour, so every one in use must be listed.

const ROOT = join(__dirname, '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path)
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : []
  })
}

const used = new Map<string, string>()
for (const dir of ['app', 'components', 'lib']) {
  for (const file of sourceFiles(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/(?<![\w-])([\w-]*:)?(-?space-[xy]-[\w.]+)/g)) {
      used.set(m[0], file)
    }
  }
}
const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')
const escape = (cls: string) => cls.replace(/\./g, '\\.')

describe('Tailwind 3 space-x/space-y compatibility', () => {
  it('finds the space utilities in use', () => {
    expect(used.size).toBeGreaterThan(5)
  })

  it.each([...used.entries()])('%s has the v3 rule in globals.css', (token, file) => {
    const [variant, cls] = token.includes(':') ? token.split(/:(?=[^:]*$)/) : ['', token]
    expect(variant, `${token} in ${file}: variants aren't covered by the compat CSS`).toBe('')
    if (cls.endsWith('-reverse')) throw new Error(`${token} in ${file}: -reverse isn't supported`)
    const selector = `.${escape(cls)} > :not([hidden]) ~ :not([hidden])`
    expect(css.includes(selector), `${selector} missing (used in ${file})`).toBe(true)
    // ...and in the reset of v4's margin.
    const reset =
      cls.startsWith('space-y-') || cls.startsWith('-space-y-')
        ? 'margin-block-end'
        : 'margin-inline-end'
    const block = css.slice(0, css.indexOf(selector))
    const listed = new RegExp(`${`.${escape(cls)}`.replace(/[.\\]/g, '\\$&')}\\s*[,)]`)
    expect(listed.test(block), `${cls} missing from the ${reset} reset`).toBe(true)
  })
})
