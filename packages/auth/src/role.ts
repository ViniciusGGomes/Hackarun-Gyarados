import { z } from 'zod'

export const roleSchema = z.union([z.literal('attendant'), z.literal('manager')])

export type Role = z.infer<typeof roleSchema>
