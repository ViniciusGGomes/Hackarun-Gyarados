import { describe, expect, it } from 'vitest'

import {
  buildBlocks,
  currentBlock,
  freeUnits,
  isWithinWindow,
  localDateToUtc,
  localWeekday,
  validateStartAt,
} from './reservations.slots'

const settings = { slotMinutes: 30, loanDurationMinutes: 120, pickupToleranceMinutes: 15, maxAdvanceDays: 7 }
const opening = { closed: false, openTime: '10:00', closeTime: '22:00' }
const MONDAY = '2026-11-16'
const MINUTE = 60 * 1000

// Local times are America/Araguaina (UTC-3): 10:00 local is 13:00Z.
const at = (date: string, time: string) => localDateToUtc(date, time)

describe('slots', () => {
  it('slots build blocks from the weekday opening hours', () => {
    const now = at(MONDAY, '09:00')

    const blocks = buildBlocks(MONDAY, opening, settings, now)

    expect(blocks).toHaveLength(21) // 10:00 ... 20:00 (22:00 minus the 2 h loan)
    expect(blocks[0].start).toEqual(new Date('2026-11-16T13:00:00Z'))
    expect(blocks[20].start).toEqual(new Date('2026-11-16T23:00:00Z'))
    for (const block of blocks) {
      expect(block.end.getTime() - block.start.getTime()).toBe(30 * MINUTE)
    }
  })

  it('slots follow a changed slot size and loan duration', () => {
    const now = at(MONDAY, '09:00')

    const blocks = buildBlocks(MONDAY, opening, { ...settings, slotMinutes: 60, loanDurationMinutes: 60 }, now)

    expect(blocks).toHaveLength(12) // hourly, 10:00 ... 21:00
    expect(blocks[11].start).toEqual(at(MONDAY, '21:00'))
  })

  it('slots closed or missing weekday has no blocks', () => {
    const now = at(MONDAY, '09:00')

    expect(buildBlocks(MONDAY, { closed: true, openTime: null, closeTime: null }, settings, now)).toEqual([])
    expect(buildBlocks(MONDAY, null, settings, now)).toEqual([])
  })

  it('slots drop past blocks and keep the one in progress', () => {
    const now = at(MONDAY, '11:10')

    const blocks = buildBlocks(MONDAY, opening, settings, now)

    expect(blocks[0].start).toEqual(at(MONDAY, '11:00')) // 11:00-11:30 is in progress
    expect(blocks).toHaveLength(19)
  })

  it('slots have no blocks left after the last one has ended', () => {
    expect(buildBlocks(MONDAY, opening, settings, at(MONDAY, '20:30'))).toEqual([])
  })

  it('slots drop dates beyond the maximum advance', () => {
    const now = at(MONDAY, '09:00')

    expect(buildBlocks('2026-11-23', opening, settings, now)).not.toHaveLength(0) // today + 7
    expect(buildBlocks('2026-11-24', opening, settings, now)).toEqual([]) // today + 8
    expect(buildBlocks('2026-11-15', opening, settings, now)).toEqual([]) // yesterday
  })

  it('window accepts today through today plus the maximum advance', () => {
    const now = at(MONDAY, '23:30')

    expect(isWithinWindow(MONDAY, now, settings)).toBe(true)
    expect(isWithinWindow('2026-11-23', now, settings)).toBe(true)
    expect(isWithinWindow('2026-11-24', now, settings)).toBe(false)
    expect(isWithinWindow('2026-11-15', now, settings)).toBe(false)
  })

  it('local date uses UTC-3 around midnight', () => {
    // 2026-11-17T01:30Z is still Monday 22:30 local
    expect(isWithinWindow('2026-11-17', new Date('2026-11-17T01:30:00Z'), settings)).toBe(true)
    expect(localWeekday(MONDAY)).toBe(1)
    expect(localWeekday('2026-11-15')).toBe(0)
  })

  it('current block is the one that contains the instant', () => {
    const now = at(MONDAY, '11:10')
    const blocks = buildBlocks(MONDAY, opening, settings, now)

    expect(currentBlock(blocks, now)?.start).toEqual(at(MONDAY, '11:00'))
    expect(currentBlock(blocks, at(MONDAY, '11:30'))?.start).toEqual(at(MONDAY, '11:30'))
    expect(currentBlock([], now)).toBeUndefined()
  })
})

describe('free units', () => {
  const window = { start: at(MONDAY, '11:00'), end: at(MONDAY, '13:00') }
  const resv = (from: string, to: string) => ({ startAt: at(MONDAY, from), endAt: at(MONDAY, to) })

  it('free units use peak simultaneity in the loan window', () => {
    // A (10-12) and B (12-14) both overlap the window but never coexist: peak is 1
    expect(freeUnits(window, [resv('10:00', '12:00'), resv('12:00', '14:00')], 2)).toBe(1)
    // C (11:30-13:30) coexists with A until 12:00: peak is 2
    expect(freeUnits(window, [resv('10:00', '12:00'), resv('12:00', '14:00'), resv('11:30', '13:30')], 2)).toBe(0)
  })

  it('free units ignore reservations that only touch the window edges', () => {
    expect(freeUnits(window, [resv('09:00', '11:00'), resv('13:00', '15:00')], 2)).toBe(2)
  })

  it('free units never go below zero', () => {
    const three = [resv('10:00', '12:00'), resv('11:00', '13:00'), resv('11:30', '12:30')]

    expect(freeUnits(window, three, 1)).toBe(0)
    expect(freeUnits(window, [], 0)).toBe(0)
  })
})

describe('startAt validation', () => {
  const now = at(MONDAY, '09:00')

  it('startAt outside hours is outside_hours', () => {
    expect(validateStartAt(at(MONDAY, '09:30'), opening, settings, now)).toBe('outside_hours')
    expect(validateStartAt(at(MONDAY, '20:30'), opening, settings, now)).toBe('outside_hours') // loan would end after 22:00
    expect(validateStartAt(at(MONDAY, '14:00'), { closed: true, openTime: null, closeTime: null }, settings, now)).toBe('outside_hours')
    expect(validateStartAt(at(MONDAY, '14:00'), null, settings, now)).toBe('outside_hours')
  })

  it('startAt unaligned past or beyond advance is invalid', () => {
    expect(validateStartAt(at(MONDAY, '10:15'), opening, settings, now)).toBe('invalid')
    expect(validateStartAt(at(MONDAY, '10:00'), opening, settings, at(MONDAY, '10:30'))).toBe('invalid') // already past
    expect(validateStartAt(at('2026-11-24', '10:00'), opening, settings, now)).toBe('invalid') // today + 8
  })

  it('startAt on an aligned free block inside the window is ok', () => {
    expect(validateStartAt(at(MONDAY, '10:00'), opening, settings, now)).toBe('ok')
    expect(validateStartAt(at(MONDAY, '20:00'), opening, settings, now)).toBe('ok')
    expect(validateStartAt(at('2026-11-23', '10:00'), opening, settings, now)).toBe('ok') // today + 7
    expect(validateStartAt(at(MONDAY, '10:00'), opening, settings, at(MONDAY, '10:00'))).toBe('ok') // starts exactly now
  })
})
