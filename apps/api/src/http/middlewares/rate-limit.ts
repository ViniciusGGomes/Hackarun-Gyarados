import type { FastifyRequest } from 'fastify'

import { AppError } from '../routes/_errors/app-error'

/**
 * Fixed-window limiter per client IP, kept in memory (one instance of the API, local use).
 * Each call creates its own counters. Use it in `onRequest` so invalid requests count too.
 */
export function rateLimit({ max, windowMs }: { max: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>()

  return async (request: FastifyRequest) => {
    const now = Date.now()
    const entry = hits.get(request.ip)

    if (!entry || now >= entry.resetAt) {
      hits.set(request.ip, { count: 1, resetAt: now + windowMs })
      return
    }

    entry.count += 1

    if (entry.count > max) {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Try again in a moment.')
    }
  }
}
