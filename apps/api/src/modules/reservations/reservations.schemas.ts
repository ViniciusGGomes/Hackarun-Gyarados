import { z } from 'zod'

import { LocationSchema } from '../locations/locations.schemas'

const PhoneSchema = z.string().regex(/^[0-9]{10,11}$/)
const EquipmentTypeSchema = z.enum(['wheelchair', 'stroller'])

export const AvailabilityParamsSchema = z.object({ type: EquipmentTypeSchema })

export const AvailabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const [year, month, day] = value.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))

      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    }, 'Invalid calendar date'),
})

export const AvailabilitySchema = z.object({
  equipmentType: EquipmentTypeSchema,
  date: z.string(),
  slotMinutes: z.number().int(),
  loanDurationMinutes: z.number().int(),
  nowAvailable: z.boolean().nullable(),
  slots: z.array(
    z.object({
      start: z.date(),
      end: z.date(),
      availableUnits: z.number().int(),
      available: z.boolean(),
    }),
  ),
})

export const CreateReservationSchema = z
  .object({
    equipmentType: EquipmentTypeSchema,
    mode: z.enum(['now', 'scheduled']),
    startAt: z.coerce.date().optional(),
    name: z.string().trim().min(1).max(120),
    phone: PhoneSchema,
    email: z.email().max(255).optional(),
    currentLocationId: z.uuid().optional(),
    forWhom: z.enum(['self', 'other']).optional(),
    size: z.enum(['adult', 'child']).optional(),
    strollerKind: z.enum(['single', 'double']).optional(),
    notes: z.string().max(200).optional(),
    consent: z.object({
      accepted: z.boolean(), // `false` is answered as CONSENT_REQUIRED by the service
      privacyNoticeVersion: z.string().min(1),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'scheduled' && !value.startAt) {
      ctx.addIssue({ code: 'custom', path: ['startAt'], message: 'startAt is required when mode is scheduled' })
    }

    if (value.equipmentType === 'stroller') {
      for (const field of ['forWhom', 'size'] as const) {
        if (value[field] !== undefined) {
          ctx.addIssue({ code: 'custom', path: [field], message: `${field} only applies to wheelchair` })
        }
      }
    }

    if (value.equipmentType === 'wheelchair' && value.strollerKind !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['strollerKind'], message: 'strollerKind only applies to stroller' })
    }
  })

export const ReservationCreatedSchema = z.object({
  protocol: z.string(),
  status: z.string(),
  createdAt: z.date(),
  trackingPath: z.string(),
  equipmentType: EquipmentTypeSchema,
  startAt: z.date(),
  endAt: z.date(),
  pickupDeadline: z.date(),
  pickupLocation: LocationSchema.nullable(),
})

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>
