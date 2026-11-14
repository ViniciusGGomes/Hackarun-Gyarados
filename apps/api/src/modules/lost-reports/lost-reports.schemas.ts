import { z } from 'zod'

import { localDateOf } from '../reservations/reservations.slots'

// Control characters (C0, DEL and C1) and invisible zero-width characters are removed, except the line
// break (\n), which long texts keep.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g
const CONTROL_AND_BREAK = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g

/** Removes control characters and trims, before the limits are checked. */
const shortText = (value: string) => value.replace(CONTROL_AND_BREAK, '').trim()
const longText = (value: string) => value.replace(CONTROL, '').trim()

/** Text of at most `max` characters; an emoji counts as one, like in the database column. */
const maxChars = (max: number) => z.string().refine((value) => [...value].length <= max, `At most ${max} characters`)

/** An optional field sent as an empty string (an empty form input) is the same as absent. */
const emptyAsAbsent = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

const ObjectCategorySchema = z.enum([
  'documents',
  'wallet_bag',
  'phone_electronics',
  'keys',
  'clothing_accessories',
  'glasses_jewelry',
  'other',
])

const DayPeriodSchema = z.enum(['morning', 'afternoon', 'night', 'unknown'])

const LostDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day) // not Date.UTC: it maps the years 0 to 99 to 1900 to 1999

    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  }, 'Invalid calendar date')
  .refine((value) => value <= localDateOf(new Date()), 'The date cannot be in the future')

export const CreateLostReportSchema = z
  .object({
    category: ObjectCategorySchema,
    description: z.string().transform(longText).pipe(maxChars(500)).pipe(z.string().min(1)),
    identificationDetail: z.preprocess(emptyAsAbsent, z.string().transform(longText).pipe(maxChars(300)).optional()),
    photoUrl: z.preprocess(emptyAsAbsent, z.url({ protocol: /^https?$/ }).max(500).optional()),
    locationId: z.uuid().optional(),
    unknownLocation: z.boolean().optional(),
    lostDate: LostDateSchema,
    lostPeriod: DayPeriodSchema.optional(),
    name: z.string().transform(shortText).pipe(maxChars(120)).pipe(z.string().min(1)),
    phone: z.string().regex(/^[0-9]{10,11}$/),
    email: z.preprocess(
      emptyAsAbsent,
      z
        .string()
        .transform(shortText)
        .pipe(z.email().max(255))
        .nullish()
        .transform((value) => value ?? undefined),
    ),
    // Only the presence of `consent` is checked here: a missing or malformed `accepted` or version is
    // answered as CONSENT_REQUIRED by the service, not as a validation error.
    consent: z.object({ accepted: z.unknown().optional(), privacyNoticeVersion: z.unknown().optional() }),
  })
  .superRefine((value, ctx) => {
    const hasLocation = value.locationId !== undefined
    const isUnknown = value.unknownLocation === true

    if (hasLocation === isUnknown) {
      ctx.addIssue({
        code: 'custom',
        path: ['locationId'],
        message: 'Send exactly one of locationId or unknownLocation true',
      })
    }
  })

export const ProtocolCreatedSchema = z.object({
  protocol: z.string(),
  status: z.string(),
  createdAt: z.date(),
  trackingPath: z.string(),
})

export type CreateLostReportInput = z.infer<typeof CreateLostReportSchema>
