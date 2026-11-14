import type { EquipmentType } from '@prisma/client'

import { prisma } from '../../lib/prisma'

export type OperationResult = 'won' | 'lost'

/**
 * Every status change is one conditional `updateMany` inside a transaction: the row that matches the
 * expected status (and window) is updated by exactly one caller, the others affect 0 rows. The history
 * row is created only by the winner, in the same transaction.
 */
export const equipmentOperationsRepository = {
  /** Reservations of the type that start inside [dayStart, dayEnd), of every status. */
  findAgendaReservations(type: EquipmentType, dayStart: Date, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: { equipmentType: type, startAt: { gte: dayStart, lt: dayEnd } },
      select: {
        startAt: true,
        endAt: true,
        pickupDeadline: true,
        request: {
          select: { id: true, protocol: true, status: true, visitorName: true, anonymizedAt: true, createdAt: true },
        },
      },
    })
  },

  findOperable(id: string) {
    return prisma.request.findUnique({
      where: { id },
      select: { id: true, type: true, status: true, anonymizedAt: true, reservation: { select: { startAt: true, endAt: true, pickupDeadline: true } } },
    })
  },

  loadDetail(id: string) {
    return prisma.request.findUnique({
      where: { id },
      include: {
        reservation: { include: { currentLocation: true } },
        history: { orderBy: { createdAt: 'asc' }, include: { actorUser: { select: { name: true } } } },
      },
    })
  },

  pickupTx(id: string, userId: string, data: { documentChecked?: boolean; notes?: string }, now: Date): Promise<OperationResult> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.request.updateMany({
        where: {
          id,
          type: 'reservation',
          status: 'reserved',
          anonymizedAt: null,
          reservation: { is: { startAt: { lte: now }, pickupDeadline: { gte: now } } },
        },
        data: { status: 'picked_up' },
      })

      if (count === 0) return 'lost'

      await tx.reservation.update({
        where: { requestId: id },
        data: { pickedUpAt: now, documentChecked: data.documentChecked, pickupNotes: data.notes },
      })
      await tx.requestHistory.create({
        data: { requestId: id, fromStatus: 'reserved', toStatus: 'picked_up', actorType: 'staff', actorUserId: userId },
      })

      return 'won'
    })
  },

  returnTx(id: string, userId: string, data: { conditionNotes?: string }, now: Date): Promise<OperationResult> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.request.updateMany({
        where: { id, type: 'reservation', status: 'picked_up', anonymizedAt: null },
        data: { status: 'returned', completedAt: now },
      })

      if (count === 0) return 'lost'

      await tx.reservation.update({ where: { requestId: id }, data: { returnedAt: now, returnNotes: data.conditionNotes } })
      await tx.requestHistory.create({
        data: { requestId: id, fromStatus: 'picked_up', toStatus: 'returned', actorType: 'staff', actorUserId: userId },
      })

      return 'won'
    })
  },

  /**
   * Marks the `reserved` reservations whose pickup deadline is past. One conditional update per row, in
   * ascending id order (two runs never lock rows in opposite orders), so a run that loses a row to another
   * run or to a pickup affects 0 and writes no history for it. Returns how many reservations changed.
   */
  markNoShowsTx(now: Date): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const overdue = { is: { pickupDeadline: { lt: now } } }
      const eligible = await tx.request.findMany({
        where: { type: 'reservation', status: 'reserved', reservation: overdue },
        select: { id: true },
        orderBy: { id: 'asc' },
      })

      let affected = 0

      for (const { id } of eligible) {
        const { count } = await tx.request.updateMany({
          where: { id, type: 'reservation', status: 'reserved', reservation: overdue },
          data: { status: 'no_show', completedAt: now },
        })

        if (count === 1) {
          await tx.requestHistory.create({
            data: { requestId: id, fromStatus: 'reserved', toStatus: 'no_show', actorType: 'system' },
          })
          affected += 1
        }
      }

      return affected
    })
  },

  logJob(jobName: string, status: 'success' | 'failed', affectedCount: number, startedAt: Date, error?: string) {
    return prisma.jobLog.create({
      data: { jobName, status, affectedCount, error, startedAt, finishedAt: new Date() },
    })
  },
}
