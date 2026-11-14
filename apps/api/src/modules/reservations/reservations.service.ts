import type { EquipmentType } from '@prisma/client'

import { AppError } from '../../http/routes/_errors/app-error'
import { reservationsRepository as repository } from './reservations.repository'
import type { CreateReservationInput } from './reservations.schemas'
import {
  buildBlocks,
  currentBlock,
  freeUnits,
  isWithinWindow,
  localDateOf,
  localWeekday,
  validateStartAt,
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

async function resolveStartAt(input: CreateReservationInput, settings: Awaited<ReturnType<typeof loadSettings>>, now: Date) {
  if (input.mode === 'now') {
    const today = localDateOf(now)
    const opening = await repository.getOpeningHour(localWeekday(today))
    const current = currentBlock(buildBlocks(today, opening, settings, now), now)

    if (!current) throw new AppError(400, 'OUTSIDE_OPENING_HOURS', 'Reservations are not open right now')

    return current.start
  }

  const startAt = input.startAt as Date
  const opening = await repository.getOpeningHour(localWeekday(localDateOf(startAt)))
  const check = validateStartAt(startAt, opening, settings, now)

  if (check === 'outside_hours') throw new AppError(400, 'OUTSIDE_OPENING_HOURS', 'That time is outside the opening hours')
  if (check === 'invalid') throw new AppError(400, 'VALIDATION_ERROR', 'That start time is not available for booking')

  return startAt
}

export async function createReservation(input: CreateReservationInput, now: Date = new Date()) {
  const settings = await loadSettings()

  const activeVersion = await repository.findActivePrivacyVersion()
  if (!activeVersion || input.consent.privacyNoticeVersion !== activeVersion) {
    throw new AppError(400, 'CONSENT_REQUIRED', 'Accept the current privacy notice to continue')
  }

  if (input.currentLocationId && !(await repository.findActiveLocation(input.currentLocationId))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unknown or inactive location')
  }

  const startAt = await resolveStartAt(input, settings, now)
  const endAt = new Date(startAt.getTime() + settings.loanDurationMinutes * MINUTE)
  // "Preciso agora": the block already started, so the pickup window counts from the request.
  const pickupFrom = input.mode === 'now' ? now : startAt
  const pickupDeadline = new Date(pickupFrom.getTime() + settings.pickupToleranceMinutes * MINUTE)

  const result = await repository.createReservationTx({
    equipmentType: input.equipmentType,
    startAt,
    endAt,
    pickupDeadline,
    name: input.name,
    phone: input.phone,
    email: input.email,
    currentLocationId: input.currentLocationId,
    forWhom: input.forWhom,
    size: input.size,
    strollerKind: input.strollerKind,
    notes: input.notes,
    privacyNoticeVersion: input.consent.privacyNoticeVersion,
    maxActivePerPhone: settings.maxActiveReservationsPerPhone,
    totalUnits: await repository.getEquipmentUnits(input.equipmentType),
  })

  if (result.kind === 'limit') {
    throw new AppError(409, 'ACTIVE_RESERVATION_LIMIT', 'This phone already has an active reservation for this equipment')
  }

  if (result.kind === 'slot_unavailable') {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'That time was just taken. Choose another time.')
  }

  const location = await repository.getPickupLocation(input.equipmentType)

  return {
    protocol: result.protocol,
    status: 'reserved',
    createdAt: result.createdAt,
    trackingPath: `/acompanhar/${result.protocol}`,
    equipmentType: input.equipmentType,
    startAt,
    endAt,
    pickupDeadline,
    pickupLocation: location
      ? { id: location.id, name: location.name, floor: location.floor, type: location.type, active: location.active }
      : null,
  }
}
