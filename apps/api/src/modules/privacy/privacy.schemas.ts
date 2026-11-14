import { z } from 'zod'

export const PrivacyNoticeSchema = z.object({
  version: z.string(),
  text: z.string(),
  updatedAt: z.date(),
})
