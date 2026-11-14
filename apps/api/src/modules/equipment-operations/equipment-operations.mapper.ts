import type { Prisma } from '@prisma/client'

import { isPickupOverdue, isReturnOverdue } from './equipment-operations.logic'

type LoadedReservation = Prisma.RequestGetPayload<{
  include: {
    reservation: { include: { currentLocation: true } }
    history: { include: { actorUser: { select: { name: true } } } }
  }
}>

/** The `RequestDetail` of the contract for a reservation. Nothing outside these fields leaves the API. */
export function toReservationDetail(request: LoadedReservation, now: Date) {
  const reservation = request.reservation

  if (!reservation) throw new Error('The request has no reservation')

  // Same millisecond: the entry without a previous status (the creation) comes first.
  const history = [...request.history].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || Number(a.fromStatus !== null) - Number(b.fromStatus !== null),
  )

  return {
    id: request.id,
    protocol: request.protocol,
    type: 'reservation' as const,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    visitor: { name: request.visitorName, phone: request.visitorPhone, email: request.visitorEmail },
    reservation: {
      equipmentType: reservation.equipmentType,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      pickedUpAt: reservation.pickedUpAt,
      returnedAt: reservation.returnedAt,
      forWhom: reservation.forWhom,
      size: reservation.size,
      strollerKind: reservation.strollerKind,
      currentLocation: reservation.currentLocation,
      notes: reservation.notes,
      pickupOverdue: isPickupOverdue(request.status, reservation.pickupDeadline, now),
      returnOverdue: isReturnOverdue(request.status, reservation.endAt, now),
    },
    lostReport: null,
    sacMessage: null,
    history: history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      actor: { type: entry.actorType, userId: entry.actorUserId, name: entry.actorUser?.name ?? null },
      internalNote: entry.internalNote,
      createdAt: entry.createdAt,
    })),
    messages: [],
  }
}
