import { z } from 'zod'

export const CancelParamsSchema = z.object({ protocol: z.string() })

export const CancelBodySchema = z.object({
  phone: z.string().regex(/^[0-9]{10,11}$/),
  reason: z.string().max(200).optional(),
})

export const TrackingViewSchema = z.object({
  protocol: z.string(),
  type: z.enum(['reservation', 'lost_report', 'sac_message']),
  publicStatus: z.string(),
  createdAt: z.date(),
  summary: z.record(z.string(), z.unknown()),
  timeline: z.array(z.object({ status: z.string(), at: z.date() })),
  messages: z.array(
    z.object({ id: z.uuid(), author: z.enum(['staff', 'visitor']), text: z.string(), createdAt: z.date() }),
  ),
  canCancel: z.boolean(),
  canReply: z.boolean(),
})
