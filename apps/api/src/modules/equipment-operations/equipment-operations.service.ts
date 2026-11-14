import type { EquipmentType } from '@prisma/client'

import { AppError } from '../../http/routes/_errors/app-error'
import { NotFoundError } from '../../http/routes/_errors/not-found-error'
import { reservationsRepository } from '../reservations/reservations.repository'
import { buildBlocks, localDateToUtc, localWeekday } from '../reservations/reservations.slots'
import { assembleSlots, pickupWindowOpen } from './equipment-operations.logic'
import { toReservationDetail } from './equipment-operations.mapper'
import { equipmentOperationsRepository as repository } from './equipment-operations.repository'
import type { PickupInput, ReturnInput } from './equipment-operations.schemas'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

async function loadSettings() {
  const settings = await reservationsRepository.getSettings()

  if (!settings) throw new Error('Reservation settings are missing (singleton id 1)')

  return settings
}

export async function getAgenda(date: string, type: EquipmentType, now: Date = new Date()) {
  const settings = await loadSettings()
  const dayStart = localDateToUtc(date)
  const dayEnd = new Date(dayStart.getTime() + DAY)
  const loanMs = settings.loanDurationMinutes * MINUTE

  const [opening, totalUnits, rows, active] = await Promise.all([
    reservationsRepository.getOpeningHour(localWeekday(date)),
    reservationsRepository.getEquipmentUnits(type),
    repository.findAgendaReservations(type, dayStart, dayEnd),
    reservationsRepository.findActiveReservations(type, dayStart, new Date(dayEnd.getTime() + loanMs)),
  ])

  // `now` at the start of the day: no block counts as past and the booking window does not apply.
  const blocks = buildBlocks(date, opening, settings, dayStart)

  const reservations = rows.map((row) => ({
    id: row.request.id,
    protocol: row.request.protocol,
    visitorName: row.request.anonymizedAt ? null : row.request.visitorName,
    status: row.request.status,
    startAt: row.startAt,
    endAt: row.endAt,
    pickupDeadline: row.pickupDeadline,
    createdAt: row.request.createdAt,
  }))

  return {
    date,
    equipmentType: type,
    slots: assembleSlots(blocks, reservations, active, totalUnits, loanMs, settings.slotMinutes * MINUTE, now),
  }
}

/** Loads a request that this feature can operate on; anything else looks like an unknown id. */
async function findReservationRequest(id: string) {
  const found = await repository.findOperable(id)

  if (!found || found.type !== 'reservation' || !found.reservation || found.anonymizedAt) {
    throw new NotFoundError('Request not found')
  }

  return { ...found, reservation: found.reservation }
}

async function detailOf(id: string, now: Date) {
  const loaded = await repository.loadDetail(id)

  if (!loaded) throw new NotFoundError('Request not found')

  return toReservationDetail(loaded, now)
}

export async function registerPickup(id: string, userId: string, input: PickupInput, now: Date = new Date()) {
  await findReservationRequest(id)

  const settings = await loadSettings()

  if (settings.requireDocumentOnPickup && input?.documentChecked !== true) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The document check is required for the pickup')
  }

  const result = await repository.pickupTx(id, userId, { documentChecked: input?.documentChecked, notes: input?.notes }, now)

  if (result === 'lost') {
    // Lost the race or the window: read the current state to say why.
    const { status, reservation } = await findReservationRequest(id)

    if (status !== 'reserved') {
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Only a reserved reservation can be picked up (status: ${status})`)
    }

    if (!pickupWindowOpen(reservation.startAt, reservation.pickupDeadline, now)) {
      const reason = now < reservation.startAt ? 'The pickup window has not started' : 'The pickup deadline has passed'

      throw new AppError(409, 'INVALID_STATUS_TRANSITION', reason)
    }

    throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'The reservation changed while it was being picked up')
  }

  return detailOf(id, now)
}

export async function registerReturn(id: string, userId: string, input: ReturnInput, now: Date = new Date()) {
  await findReservationRequest(id)

  const result = await repository.returnTx(id, userId, { conditionNotes: input?.conditionNotes }, now)

  if (result === 'lost') {
    const { status } = await findReservationRequest(id)

    throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Only a picked up reservation can be returned (status: ${status})`)
  }

  return detailOf(id, now)
}

export function markNoShows(now: Date = new Date()) {
  return repository.markNoShowsTx(now)
}
