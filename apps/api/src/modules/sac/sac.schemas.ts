import { z } from 'zod'

const SacSubjectSchema = z.enum(['question', 'complaint', 'suggestion', 'compliment', 'other', 'data_deletion'])

export const CreateSacMessageSchema = z.object({
  subject: SacSubjectSchema,
  message: z.string().trim().min(1).max(1500),
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^[0-9]{10,11}$/).optional(),
  email: z.email().max(255).optional(),
  relatedService: z.string().max(100).nullish(),
  relatedProtocol: z.string().max(13).nullish(),
  consent: z.object({ accepted: z.unknown().optional(), privacyNoticeVersion: z.unknown().optional() }),
})

export const SacProtocolCreatedSchema = z.object({
  protocol: z.string(),
  status: z.string(),
  createdAt: z.date(),
  trackingPath: z.string(),
})

export type CreateSacMessageInput = z.infer<typeof CreateSacMessageSchema>
