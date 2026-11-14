import { describe, expect, it } from 'vitest'

import { assembleSlots, isPickupOverdue, isReturnOverdue, pickupWindowOpen } from './equipment-operations.logic'
import type { AgendaReservation } from './equipment-operations.logic'

const MINUTE = 60 * 1000
const BASE = new Date('2026-11-17T13:00:00Z') // 10:00 local
const at = (minutes: number) => new Date(BASE.getTime() + minutes * MINUTE)

describe('overdue flags and pickup window', () => {
  it('overdue flags follow status and the clock at the exact limits', () => {
    const deadline = at(15)
    const end = at(120)

    // Pickup: only `reserved`, and only strictly after the deadline.
    expect(isPickupOverdue('reserved', deadline, at(15))).toBe(false)
    expect(isPickupOverdue('reserved', deadline, new Date(deadline.getTime() + 1))).toBe(true)
    for (const status of ['picked_up', 'returned', 'cancelled', 'no_show']) {
      expect(isPickupOverdue(status, deadline, at(500)), status).toBe(false)
    }

    // Return: only `picked_up`, and only strictly after the end of the loan.
    expect(isReturnOverdue('picked_up', end, at(120))).toBe(false)
    expect(isReturnOverdue('picked_up', end, new Date(end.getTime() + 1))).toBe(true)
    for (const status of ['reserved', 'returned', 'cancelled', 'no_show']) {
      expect(isReturnOverdue(status, end, at(500)), status).toBe(false)
    }
  })

  it('pickup window includes both extremes', () => {
    expect(pickupWindowOpen(at(0), at(15), new Date(at(0).getTime() - 1))).toBe(false)
    expect(pickupWindowOpen(at(0), at(15), at(0))).toBe(true)
    expect(pickupWindowOpen(at(0), at(15), at(15))).toBe(true)
    expect(pickupWindowOpen(at(0), at(15), new Date(at(15).getTime() + 1))).toBe(false)
  })
})

describe('assembleSlots', () => {
  const blocks = [0, 30, 60].map((minutes) => ({ start: at(minutes), end: at(minutes + 30) }))

  function reservation(overrides: Partial<AgendaReservation> & { startMinutes: number }): AgendaReservation {
    const { startMinutes, ...rest } = overrides

    return {
      id: `id-${startMinutes}`,
      protocol: 'CAP-AAAA-BBBB',
      visitorName: 'Maria',
      status: 'reserved',
      startAt: at(startMinutes),
      endAt: at(startMinutes + 120),
      pickupDeadline: at(startMinutes + 15),
      createdAt: at(-1000 + startMinutes),
      ...rest,
    }
  }

  const build = (
    reservations: AgendaReservation[],
    active = reservations.filter((item) => ['reserved', 'picked_up'].includes(item.status)),
    now = at(0),
  ) => assembleSlots(blocks, reservations, active, 4, 120 * MINUTE, 30 * MINUTE, now)

  it('places each reservation in the block that contains its start, in block order', () => {
    const slots = build([reservation({ startMinutes: 60 }), reservation({ startMinutes: 0 })])

    expect(slots.map((slot) => slot.start.toISOString())).toEqual([at(0), at(30), at(60)].map((date) => date.toISOString()))
    expect(slots.map((slot) => slot.reservations.length)).toEqual([1, 0, 1])
    expect(slots[0].reservations[0]).toMatchObject({ id: 'id-0', pickupOverdue: false, returnOverdue: false })
  })

  it('counts free units from reserved and picked up only', () => {
    const all = [
      reservation({ startMinutes: 0, status: 'reserved' }),
      reservation({ startMinutes: 0, status: 'picked_up', id: 'b' }),
      reservation({ startMinutes: 0, status: 'cancelled', id: 'c' }),
      reservation({ startMinutes: 0, status: 'no_show', id: 'd' }),
      reservation({ startMinutes: 0, status: 'returned', id: 'e' }),
    ]

    const slots = build(all)

    expect(slots[0].totalUnits).toBe(4)
    expect(slots[0].freeUnits).toBe(2) // 4 units, 2 simultaneous reserved/picked_up
    expect(slots[0].reservations).toHaveLength(5) // every status is listed
  })

  it('gives a reservation outside the current blocks a slot of its own', () => {
    const slots = build([reservation({ startMinutes: 210 })])

    expect(slots).toHaveLength(4)
    expect(slots[3].start.toISOString()).toBe(at(210).toISOString())
    expect(slots[3].end.toISOString()).toBe(at(240).toISOString())
    expect(slots[3].reservations.map((item) => item.id)).toEqual(['id-210'])
  })

  it('lists the reservations of a slot in order of creation and sets the overdue flags', () => {
    const late = reservation({ startMinutes: 0, id: 'late', createdAt: at(-5), status: 'reserved' })
    const early = reservation({ startMinutes: 0, id: 'early', createdAt: at(-50), status: 'picked_up' })

    const slots = build([late, early], [late, early], at(200))

    expect(slots[0].reservations.map((item) => item.id)).toEqual(['early', 'late'])
    expect(slots[0].reservations[0]).toMatchObject({ returnOverdue: true, pickupOverdue: false })
    expect(slots[0].reservations[1]).toMatchObject({ pickupOverdue: true, returnOverdue: false })
  })

  it('returns the blocks with no reservations and every unit free for an empty day', () => {
    const slots = build([])

    expect(slots.map((slot) => [slot.freeUnits, slot.reservations.length])).toEqual([
      [4, 0],
      [4, 0],
      [4, 0],
    ])
  })
})
