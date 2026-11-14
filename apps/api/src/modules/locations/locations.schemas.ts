import { z } from 'zod'

export const LocationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  floor: z.string(),
  type: z.enum(['entrance', 'food_court', 'parking', 'store_area', 'service', 'other']),
  active: z.boolean(),
})
