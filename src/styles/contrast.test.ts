/// <reference types="node" />
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// The colours of the interface are the tokens of theme.css: checking their pairs is
// checking every text that uses them (WCAG 2.1 AA: 4.5 for text, 3 for large text and
// for the parts of a control that must be seen, like a focus ring).

type Rgb = [number, number, number]

// Read from disk: the test run does not process stylesheets.
const css = readFileSync('src/styles/theme.css', 'utf8')

const tokens = new Map<string, string>()
for (const match of css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
  tokens.set(match[1] ?? '', (match[2] ?? '').trim())
}

function resolve(value: string): Rgb {
  const text = value.trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(text)
  if (hex) {
    const n = parseInt(hex[1] ?? '', 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(text)
  if (reference) {
    const target = tokens.get(reference[1] ?? '')
    if (!target) throw new Error(`unknown token ${text}`)
    return resolve(target)
  }
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/.exec(text)
  if (mix) {
    const share = Number(mix[2]) / 100
    const first = resolve(mix[1] ?? '')
    const second = resolve(mix[3] ?? '')
    return first.map((channel, i) => channel * share + (second[i] ?? 0) * (1 - share)) as Rgb
  }
  throw new Error(`cannot read the colour "${text}"`)
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [
    luminance(resolve(`var(--color-${a})`)),
    luminance(resolve(`var(--color-${b})`)),
  ].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

describe('contrast of the theme', () => {
  it.each([
    // text, ground
    ['foreground', 'background'],
    ['foreground', 'muted'],
    ['foreground', 'accent'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
    ['muted-foreground', 'accent'],
    ['primary-foreground', 'primary'],
    ['on-primary', 'primary-hover'],
    ['on-danger', 'danger'],
    ['on-danger', 'danger-hover'],
    ['danger', 'background'],
    ['danger', 'muted'],
    ['primary', 'background'],
    ['primary', 'muted'],
  ])('%s on %s is readable as text', (text, ground) => {
    expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['focus', 'background'],
    ['focus', 'muted'],
    ['key', 'background'],
  ])('%s on %s can be seen as part of a control', (part, ground) => {
    expect(contrast(part, ground)).toBeGreaterThanOrEqual(3)
  })
})
