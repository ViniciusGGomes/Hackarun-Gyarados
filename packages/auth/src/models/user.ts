import { z } from 'zod'
import { roleSchema } from '../role'

export const userSchema = z.object({
  __typename: z.literal('User').optional(),
  id: z.string().uuid(),
  profile: roleSchema,
})

export type User = z.infer<typeof userSchema>