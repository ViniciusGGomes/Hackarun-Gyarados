import { equipmentOperationsRepository } from '../modules/equipment-operations/equipment-operations.repository'
import { markNoShows } from '../modules/equipment-operations/equipment-operations.service'

export const NO_SHOW_JOB_NAME = 'mark-no-show'
export const NO_SHOW_INTERVAL_MS = 60 * 1000

/**
 * One run of the no-show routine (RF19). It writes a `job_logs` row only when it changed reservations
 * or failed, so a run every minute does not fill the table. Returns how many reservations changed.
 */
export async function runMarkNoShow(now: Date = new Date()) {
  const startedAt = new Date()

  try {
    const affected = await markNoShows(now)

    if (affected > 0) await equipmentOperationsRepository.logJob(NO_SHOW_JOB_NAME, 'success', affected, startedAt)

    return affected
  } catch (error) {
    // Only what identifies the failure: the message of a database error can carry personal data.
    const name = error instanceof Error ? error.name : 'Error'
    const code = (error as { code?: unknown }).code
    const summary = code ? `${name} ${String(code)}` : name

    console.error('No-show job failed', { name, code })
    await equipmentOperationsRepository.logJob(NO_SHOW_JOB_NAME, 'failed', 0, startedAt, summary).catch(() => undefined)

    return 0
  }
}

/** Runs the routine every minute inside the API process; a run is skipped while the previous one is still going. */
export function startNoShowJob(intervalMs: number = NO_SHOW_INTERVAL_MS) {
  let running = false

  const timer = setInterval(async () => {
    if (running) return

    running = true

    try {
      await runMarkNoShow()
    } finally {
      running = false
    }
  }, intervalMs)

  timer.unref()

  return timer
}
