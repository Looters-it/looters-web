import { describe, expect, it } from 'vitest'

import { Demo, boundsOf, demoStage } from './demo'

/** Numbers that repeat: the same demonstration every time. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
const grid = (side: number) =>
  Array.from({ length: side * side }, (_, i) => ({
    id: i + 1,
    name: `Comune ${String(i + 1)}`,
    lon: 9 + (i % side) * 0.1,
    lat: 45 + Math.floor(i / side) * 0.1,
  }))

describe('demonstration on the homepage', () => {
  it('takes as its stage the municipalities around one of them', () => {
    const units = grid(30)
    const stage = demoStage(units, 100, seeded(1))
    expect(stage).toHaveLength(100)
    const [west, south, east, north] = boundsOf(stage)!
    // A compact patch, not a hundred municipalities scattered over the area.
    expect(east - west).toBeLessThan(1.5)
    expect(north - south).toBeLessThan(1.5)
    // A small area is taken whole.
    expect(demoStage(grid(5), 100, seeded(1))).toHaveLength(25)
    expect(boundsOf([])).toBeNull()
  })

  it('starts with every empire on its capital, apart from the others', () => {
    const demo = new Demo(grid(12), seeded(2))
    expect(demo.empires).toHaveLength(6)
    expect(demo.owner.size).toBe(6)
    expect(new Set(demo.empires.map((empire) => empire.color)).size).toBe(6)
    expect(new Set(demo.empires.map((empire) => empire.name)).size).toBe(6)
    for (const empire of demo.empires) expect(empire.name).toMatch(/ di Comune \d+$/)
  })

  it('grows by neighbours, then fights, and never loses a capital', () => {
    const demo = new Demo(grid(12), seeded(3))
    const capitals = demo.empires.map((empire) => empire.capitalId)
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const before = demo.owner.size
      const event = demo.step()
      if (!event) continue
      seen.add(event.type)
      // (When the stage fills up the story starts again, and the count drops.)
      const restarted = demo.owner.size < before
      if (event.type === 'annexed' && !restarted) expect(demo.owner.size).toBe(before + 1)
      if (event.type !== 'annexed') expect(event.other).not.toBe(event.empire)
      if (event.type !== 'defended') expect(demo.owner.get(event.unitId)).toBe(event.empire)
      capitals.forEach((id, index) => expect(demo.owner.get(id)).toBe(index))
    }
    expect([...seen].sort()).toEqual(['annexed', 'conquered', 'defended'])
    // Sizes add up to what is owned.
    expect(demo.sizes().reduce((sum, size) => sum + size, 0)).toBe(demo.owner.size)
  })

  it('starts again when the stage is nearly full', () => {
    const demo = new Demo(grid(4), seeded(4), 3)
    let most = 0
    for (let i = 0; i < 300; i++) {
      demo.step()
      most = Math.max(most, demo.owner.size)
    }
    expect(most).toBeGreaterThan(10)
    expect(demo.owner.size).toBeLessThanOrEqual(16)
    // It has gone round at least once: it is not stuck on a full map.
    demo.restart()
    expect(demo.owner.size).toBe(3)
  })
})
