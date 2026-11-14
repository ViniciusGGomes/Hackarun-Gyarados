import type { EquipmentType, ReservationForWhom, StrollerKind, WheelchairSize } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { generateProtocol } from '../../utils/protocol'
import { freeUnits } from './reservations.slots'

const ACTIVE_STATUSES = ['reserved', 'picked_up'] as const

export type CreateReservationData = {
  equipmentType: EquipmentType
  startAt: Date
  endAt: Date
  pickupDeadline: Date
  name: string
  phone: string
  email?: string
  currentLocationId?: string
  forWhom?: ReservationForWhom
  size?: WheelchairSize
  strollerKind?: StrollerKind
  notes?: string
  privacyNoticeVersion: string
  maxActivePerPhone: number
  totalUnits: number
}

export type CreateReservationResult =
  | { kind: 'created'; protocol: string; createdAt: Date }
  | { kind: 'limit' }
  | { kind: 'slot_unavailable' }

export type CancelReservationResult =
  | { kind: 'not_found' }
  | { kind: 'not_cancellable' }
  | {
      kind: 'cancelled'
      protocol: string
      createdAt: Date
      equipmentType: EquipmentType
      startAt: Date
      endAt: Date
      timeline: { status: string; at: Date }[]
    }

export const reservationsRepository = {
  getSettings() {
    return prisma.reservationSettings.findUnique({ where: { id: 1 } })
  },

  getOpeningHour(weekday: number) {
    return prisma.openingHour.findUnique({ where: { weekday } })
  },

  async getEquipmentUnits(type: EquipmentType) {
    const total = await prisma.equipment.aggregate({ _sum: { quantity: true }, where: { type, active: true } })

    return total._sum.quantity ?? 0
  },

  async getPickupLocation(type: EquipmentType) {
    const equipment = await prisma.equipment.findFirst({
      where: { type, active: true },
      orderBy: { createdAt: 'asc' },
      include: { pickupLocation: true },
    })

    return equipment?.pickupLocation ?? null
  },

  /** Reservations of the type that hold a unit (reserved or picked up) and touch [from, to). */
  findActiveReservations(type: EquipmentType, from: Date, to: Date) {
    return prisma.reservation.findMany({
      where: {
        equipmentType: type,
        startAt: { lt: to },
        endAt: { gt: from },
        request: { status: { in: [...ACTIVE_STATUSES] } },
      },
      select: { startAt: true, endAt: true },
    })
  },

  findActiveLocation(id: string) {
    return prisma.location.findFirst({ where: { id, active: true } })
  },

  async findActivePrivacyVersion() {
    const notice = await prisma.privacyNotice.findFirst({ where: { active: true } })

    return notice?.version ?? null
  },

  recordUnmetDemand(type: EquipmentType, date: string) {
    return prisma.unmetDemand.create({ data: { equipmentType: type, requestedFor: new Date(`${date}T00:00:00Z`) } })
  },

  /**
   * One transaction per booking. The advisory lock serializes bookings of the same equipment type, so
   * the phone limit, the free-unit count and the inserts cannot interleave with another booking.
   */
  createReservationTx(data: CreateReservationData): Promise<CreateReservationResult> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`equipment:${data.equipmentType}`}))`

      const activeOfPhone = await tx.request.count({
        where: {
          type: 'reservation',
          visitorPhone: data.phone,
          status: { in: [...ACTIVE_STATUSES] },
          reservation: { equipmentType: data.equipmentType },
        },
      })

      if (activeOfPhone >= data.maxActivePerPhone) return { kind: 'limit' }

      const overlapping = await tx.reservation.findMany({
        where: {
          equipmentType: data.equipmentType,
          startAt: { lt: data.endAt },
          endAt: { gt: data.startAt },
          request: { status: { in: [...ACTIVE_STATUSES] } },
        },
        select: { startAt: true, endAt: true },
      })

      if (freeUnits({ start: data.startAt, end: data.endAt }, overlapping, data.totalUnits) < 1) {
        return { kind: 'slot_unavailable' }
      }

      // A unique violation would abort the transaction, so look for a free protocol first.
      let protocol = generateProtocol()
      while (await tx.request.findUnique({ where: { protocol }, select: { id: true } })) {
        protocol = generateProtocol()
      }

      const request = await tx.request.create({
        data: {
          protocol,
          type: 'reservation',
          status: 'reserved',
          visitorName: data.name,
          visitorPhone: data.phone,
          visitorEmail: data.email,
          reservation: {
            create: {
              equipmentType: data.equipmentType,
              startAt: data.startAt,
              endAt: data.endAt,
              pickupDeadline: data.pickupDeadline,
              forWhom: data.forWhom,
              size: data.size,
              strollerKind: data.strollerKind,
              currentLocationId: data.currentLocationId,
              notes: data.notes,
            },
          },
          consents: { create: { privacyNoticeVersion: data.privacyNoticeVersion, purpose: 'atender a solicitação' } },
          history: { create: { fromStatus: null, toStatus: 'reserved', actorType: 'visitor' } },
        },
        select: { protocol: true, createdAt: true },
      })

      return { kind: 'created', protocol: request.protocol, createdAt: request.createdAt }
    })
  },

  /** Cancels a reservation that is still `reserved`; the conditional update lets only one transition win. */
  cancelReservationTx(protocol: string, phone: string, reason: string | undefined, now: Date): Promise<CancelReservationResult> {
    return prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({ where: { protocol }, include: { reservation: true } })

      if (!request || request.visitorPhone !== phone || request.anonymizedAt) return { kind: 'not_found' }
      if (request.type !== 'reservation' || !request.reservation) return { kind: 'not_cancellable' }

      const { count } = await tx.request.updateMany({
        where: { id: request.id, status: 'reserved' },
        data: { status: 'cancelled', completedAt: now },
      })

      if (count === 0) return { kind: 'not_cancellable' }

      await tx.requestHistory.create({
        data: {
          requestId: request.id,
          fromStatus: 'reserved',
          toStatus: 'cancelled',
          actorType: 'visitor',
          internalNote: reason,
        },
      })

      const history = await tx.requestHistory.findMany({
        where: { requestId: request.id },
        orderBy: { createdAt: 'asc' },
        select: { fromStatus: true, toStatus: true, createdAt: true },
      })
      // Same millisecond: the first entry (no previous status) comes first.
      history.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || Number(x.fromStatus !== null) - Number(y.fromStatus !== null))

      return {
        kind: 'cancelled',
        protocol: request.protocol,
        createdAt: request.createdAt,
        equipmentType: request.reservation.equipmentType,
        startAt: request.reservation.startAt,
        endAt: request.reservation.endAt,
        timeline: history.map((entry) => ({ status: entry.toStatus, at: entry.createdAt })),
      }
    })
  },
}
