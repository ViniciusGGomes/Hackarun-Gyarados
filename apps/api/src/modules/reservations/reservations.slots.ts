// Pure time and counting rules for equipment reservations. No database, no clock:
// every function receives `now`. The shopping works in America/Araguaina (UTC-3, no daylight saving).

const OFFSET_HOURS = 3
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

export type Settings = {
  slotMinutes: number
  loanDurationMinutes: number
  pickupToleranceMinutes: number
  maxAdvanceDays: number
}

export type Opening = { closed: boolean; openTime: string | null; closeTime: string | null } | null

export type Block = { start: Date; end: Date }

function parts(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return { year, month, day }
}

/** UTC instant of a local date (`YYYY-MM-DD`) and time (`HH:mm`). */
export function localDateToUtc(date: string, time = '00:00') {
  const { year, month, day } = parts(date)
  const [hours, minutes] = time.split(':').map(Number)

  return new Date(Date.UTC(year, month - 1, day, hours + OFFSET_HOURS, minutes))
}

/** 0 = Sunday ... 6 = Saturday, for a local date. */
export function localWeekday(date: string) {
  const { year, month, day } = parts(date)

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Local calendar date (`YYYY-MM-DD`) of an instant. */
export function localDateOf(instant: Date) {
  return new Date(instant.getTime() - OFFSET_HOURS * 60 * MINUTE).toISOString().slice(0, 10)
}

function dayOf(date: string, days: number) {
  // localDateToUtc(date) is 03:00Z of that date; adding whole days keeps the same local calendar day.
  const shifted = new Date(localDateToUtc(date).getTime() + days * DAY)

  return localDateOf(shifted)
}

/** Today (local) up to today plus `maxAdvanceDays`, inclusive. */
export function isWithinWindow(date: string, now: Date, settings: Settings) {
  const today = localDateOf(now)

  return date >= today && date <= dayOf(today, settings.maxAdvanceDays)
}

function openRange(date: string, opening: Opening, settings: Settings) {
  if (!opening || opening.closed || !opening.openTime || !opening.closeTime) return null

  const first = localDateToUtc(date, opening.openTime)
  const lastStart = new Date(localDateToUtc(date, opening.closeTime).getTime() - settings.loanDurationMinutes * MINUTE)

  return { first, lastStart }
}

/**
 * Blocks of one local day, from the opening time to the last start that still ends its loan by the
 * closing time. Past blocks (end <= now) and dates outside the booking window are dropped; the block in
 * progress is kept.
 */
export function buildBlocks(date: string, opening: Opening, settings: Settings, now: Date): Block[] {
  if (!isWithinWindow(date, now, settings)) return []

  const range = openRange(date, opening, settings)
  if (!range) return []

  const step = settings.slotMinutes * MINUTE
  const blocks: Block[] = []

  for (let start = range.first.getTime(); start <= range.lastStart.getTime(); start += step) {
    const block = { start: new Date(start), end: new Date(start + step) }

    if (block.end.getTime() > now.getTime()) blocks.push(block)
  }

  return blocks
}

export function currentBlock(blocks: Block[], now: Date) {
  return blocks.find((block) => block.start.getTime() <= now.getTime() && now.getTime() < block.end.getTime())
}

/**
 * Units still free during the whole `window`: total units minus the highest number of reservations
 * active at the same time at any instant of the window. Never below zero.
 */
export function freeUnits(window: Block, reservations: { startAt: Date; endAt: Date }[], totalUnits: number) {
  const events: [number, number][] = []

  for (const reservation of reservations) {
    const from = Math.max(reservation.startAt.getTime(), window.start.getTime())
    const to = Math.min(reservation.endAt.getTime(), window.end.getTime())

    if (from < to) events.push([from, 1], [to, -1])
  }

  // At the same instant a release comes before a new start.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  let active = 0
  let peak = 0

  for (const [, delta] of events) {
    active += delta
    peak = Math.max(peak, active)
  }

  return Math.max(0, totalUnits - peak)
}

/** Checks a requested start: opening hours, block alignment, not past, inside the advance window. */
export function validateStartAt(
  startAt: Date,
  opening: Opening,
  settings: Settings,
  now: Date,
): 'ok' | 'outside_hours' | 'invalid' {
  const date = localDateOf(startAt)
  const range = openRange(date, opening, settings)

  if (!range || startAt.getTime() < range.first.getTime() || startAt.getTime() > range.lastStart.getTime()) {
    return 'outside_hours'
  }

  if ((startAt.getTime() - range.first.getTime()) % (settings.slotMinutes * MINUTE) !== 0) return 'invalid'
  if (startAt.getTime() < now.getTime()) return 'invalid'
  if (date > dayOf(localDateOf(now), settings.maxAdvanceDays)) return 'invalid'

  return 'ok'
}
