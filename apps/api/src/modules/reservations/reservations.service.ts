import type { EquipmentType } from '@prisma/client'

import { reservationsRepository as repository } from './reservations.repository'
import {
  buildBlocks,
  currentBlock,
  freeUnits,
  isWithinWindow,
  localDateOf,
  localWeekday,
} from './reservations.slots'

const MINUTE = 60 * 1000

async function loadSettings() {
  const settings = await repository.getSettings()

  if (!settings) throw new Error('Reservation settings are missing (singleton id 1)')

  return settings
}

export async function getAvailability(type: EquipmentType, date: string, now: Date = new Date()) {
  const settings = await loadSettings()
  const [opening, units] = await Promise.all([
    repository.getOpeningHour(localWeekday(date)),
    repository.getEquipmentUnits(type),
  ])

  const blocks = buildBlocks(date, opening, settings, now)
  const loanMs = settings.loanDurationMinutes * MINUTE

  const reservations = blocks.length
    ? await repository.findActiveReservations(
        type,
        blocks[0].start,
        new Date(blocks[blocks.length - 1].start.getTime() + loanMs),
      )
    : []

  // A block is free only if a unit stays free during the whole loan that would start in it.
  const slots = blocks.map((block) => {
    const availableUnits = freeUnits(
      { start: block.start, end: new Date(block.start.getTime() + loanMs) },
      reservations,
      units,
    )

    return { start: block.start, end: block.end, availableUnits, available: availableUnits > 0 }
  })

  let nowAvailable: boolean | null = null

  if (date === localDateOf(now)) {
    const current = currentBlock(blocks, now)

    nowAvailable = current ? (slots.find((slot) => slot.start.getTime() === current.start.getTime())?.available ?? false) : false
  }

  if (isWithinWindow(date, now, settings) && slots.length > 0 && !slots.some((slot) => slot.available)) {
    try {
      await repository.recordUnmetDemand(type, date)
    } catch (error) {
      // The unmet-demand record is statistics only; it must not break the consultation.
      console.error('Could not record the unmet demand', error)
    }
  }

  return {
    equipmentType: type,
    date,
    slotMinutes: settings.slotMinutes,
    loanDurationMinutes: settings.loanDurationMinutes,
    nowAvailable,
    slots,
  }
}
