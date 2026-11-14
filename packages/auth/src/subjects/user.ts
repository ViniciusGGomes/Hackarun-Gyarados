import { z } from 'zod'

export const userSubject = z.tuple([
  z.union([
    z.literal('manage'),
    z.literal('get'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  z.union([
    z.literal('User'),
    z.object({
      __typename: z.literal('User'),
      id: z.string(),
      profile: z.string(),
    }),
  ]),
])

export type UserSubject = z.infer<typeof userSubject>