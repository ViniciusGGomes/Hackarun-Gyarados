import { describe, expect, it } from 'vitest'

import { generateProtocol } from './protocol'

describe('protocol', () => {
  it('protocol matches CAP-XXXX-XXXX with the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const protocol = generateProtocol()

      expect(protocol).toHaveLength(13)
      expect(protocol).toMatch(/^CAP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    }
  })

  it('protocol values are unique across many calls', () => {
    const values = new Set(Array.from({ length: 5000 }, () => generateProtocol()))

    expect(values.size).toBe(5000)
  })
})
