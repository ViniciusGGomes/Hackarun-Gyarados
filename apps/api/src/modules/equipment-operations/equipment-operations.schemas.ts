import { z } from 'zod'

import { LocationSchema } from '../locations/locations.schemas'

// Control characters (C0, DEL, C1) and zero-width characters are removed, except the line break.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‍⁠﻿]/g

const note = z
  .string()
  .transform((value) => value.replace(CONTROL, '').trim())
  .pipe(z.string().max(300))

const EquipmentTypeSchema = z.enum(['wheelchair', 'stroller'])

export const AgendaQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const [year, month, day] = value.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))

      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    }, 'Invalid calendar date'),
  equipmentType: EquipmentTypeSchema,
})

export const IdParamsSchema = z.object({ id: z.uuid() })

// The bodies are optional: the contract does not mark `requestBody` as required (Fastify hands a missing body as null).
export const PickupBodySchema = z.object({ documentChecked: z.boolean().optional(), notes: note.optional() }).nullish()

export const ReturnBodySchema = z.object({ conditionNotes: note.optional() }).nullish()

export const AgendaSchema = z.object({
  date: z.string(),
  equipmentType: EquipmentTypeSchema,
  slots: z.array(
    z.object({
      start: z.date(),
      end: z.date(),
      totalUnits: z.number().int(),
      freeUnits: z.number().int(),
      reservations: z.array(
        z.object({
          id: z.string(),
          protocol: z.string(),
          visitorName: z.string().nullable(),
          status: z.string(),
          pickupOverdue: z.boolean(),
          returnOverdue: z.boolean(),
        }),
      ),
    }),
  ),
})

export const RequestDetailSchema = z.object({
  id: z.string(),
  protocol: z.string(),
  type: z.literal('reservation'),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  visitor: z.object({ name: z.string(), phone: z.string().nullable(), email: z.string().nullable() }),
  reservation: z.object({
    equipmentType: EquipmentTypeSchema,
    startAt: z.date(),
    endAt: z.date(),
    pickedUpAt: z.date().nullable(),
    returnedAt: z.date().nullable(),
    forWhom: z.string().nullable(),
    size: z.string().nullable(),
    strollerKind: z.string().nullable(),
    currentLocation: LocationSchema.nullable(),
    notes: z.string().nullable(),
    pickupOverdue: z.boolean(),
    returnOverdue: z.boolean(),
  }),
  lostReport: z.null(),
  sacMessage: z.null(),
  history: z.array(
    z.object({
      id: z.string(),
      fromStatus: z.string().nullable(),
      toStatus: z.string(),
      actor: z.object({
        type: z.enum(['staff', 'visitor', 'system']),
        userId: z.string().nullable(),
        name: z.string().nullable(),
      }),
      internalNote: z.string().nullable(),
      createdAt: z.date(),
    }),
  ),
  messages: z.array(z.object({ id: z.string(), author: z.enum(['staff', 'visitor']), text: z.string(), createdAt: z.date() })),
})

export type PickupInput = z.infer<typeof PickupBodySchema>
export type ReturnInput = z.infer<typeof ReturnBodySchema>
