import { z } from 'zod'

export const LoginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(['attendant', 'manager']),
  active: z.boolean(),
})

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: UserSchema,
})
