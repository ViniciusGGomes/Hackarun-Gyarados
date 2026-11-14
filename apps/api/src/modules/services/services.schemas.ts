import { z } from 'zod'

import { LocationSchema } from '../locations/locations.schemas'

export const ServiceSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  icon: z.string().nullable(),
  kind: z.enum(['interactive', 'informational']),
  flow: z.enum(['equipment_reservation', 'lost_report', 'sac_message', 'none']),
  equipmentType: z.enum(['wheelchair', 'stroller']).nullable(),
})

export const OpeningHourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  closed: z.boolean(),
  open: z.string().nullable(),
  close: z.string().nullable(),
})

export const ServiceDetailSchema = ServiceSchema.extend({
  description: z.string().nullable(),
  howItWorks: z.array(z.string()),
  openingHours: z.array(OpeningHourSchema),
  isOpenNow: z.boolean(),
  pickupLocation: LocationSchema.nullable(),
  loanDurationMinutes: z.number().int().nullable(),
  pickupToleranceMinutes: z.number().int().nullable(),
  storageDays: z.number().int().nullable(),
  contactPhone: z.string().nullable(),
})
