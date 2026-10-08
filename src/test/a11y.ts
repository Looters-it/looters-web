import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Checks what is on the page against the WCAG A and AA rules axe can judge
 * without a real browser. Colour contrast needs computed layout, which jsdom
 * does not have: it is checked on the theme tokens in `contrast.test.ts`.
 */
export async function expectAccessible(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  const problems = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.html.slice(0, 160)}`).join('\n'),
  )
  expect(problems, problems.join('\n')).toEqual([])
}
