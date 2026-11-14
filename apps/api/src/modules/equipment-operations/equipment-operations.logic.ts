import { freeUnits } from '../reservations/reservations.slots'
import type { Block } from '../reservations/reservations.slots'

/** `reserved` and past its pickup deadline: waiting for a visitor who is late (equal is not late). */
export function isPickupOverdue(status: string, pickupDeadline: Date, now: Date) {
  return status === 'reserved' && now.getTime() > pickupDeadline.getTime()
}

/** `picked_up` and past the end of the loan (equal is not late). */
export function isReturnOverdue(status: string, endAt: Date, now: Date) {
  return status === 'picked_up' && now.getTime() > endAt.getTime()
}

/** The pickup is accepted from the start of the block up to the stored deadline, both included. */
export function pickupWindowOpen(startAt: Date, pickupDeadline: Date, now: Date) {
  return startAt.getTime() <= now.getTime() && now.getTime() <= pickupDeadline.getTime()
}

export type AgendaReservation = {
  id: string
  protocol: string
  visitorName: string | null
  status: string
  startAt: Date
  endAt: Date
  pickupDeadline: Date
  createdAt: Date
}

/**
 * Puts each reservation of the day in the block that starts at the same instant. A reservation whose start
 * is not the start of any current block (the opening hours or the block size changed after it was made)
 * gets a block of its own, so nothing is hidden. Free units use the same rule as the public availability.
 */
export function assembleSlots(
  blocks: Block[],
  reservations: AgendaReservation[],
  active: { startAt: Date; endAt: Date }[],
  totalUnits: number,
  loanMs: number,
  slotMs: number,
  now: Date,
) {
  const slots = new Map<number, { start: Date; end: Date; items: AgendaReservation[] }>()

  for (const block of blocks) {
    slots.set(block.start.getTime(), { start: block.start, end: block.end, items: [] })
  }

  const inOrder = [...reservations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  for (const reservation of inOrder) {
    const startAt = reservation.startAt.getTime()

    if (!slots.has(startAt)) {
      slots.set(startAt, { start: reservation.startAt, end: new Date(startAt + slotMs), items: [] })
    }

    slots.get(startAt)?.items.push(reservation)
  }

  return [...slots.values()]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((slot) => ({
      start: slot.start,
      end: slot.end,
      totalUnits,
      freeUnits: freeUnits({ start: slot.start, end: new Date(slot.start.getTime() + loanMs) }, active, totalUnits),
      reservations: slot.items.map((item) => ({
        id: item.id,
        protocol: item.protocol,
        visitorName: item.visitorName,
        status: item.status,
        pickupOverdue: isPickupOverdue(item.status, item.pickupDeadline, now),
        returnOverdue: isReturnOverdue(item.status, item.endAt, now),
      })),
    }))
}
