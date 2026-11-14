import { NotFoundError } from '../../http/routes/_errors/not-found-error'
import { servicesRepository } from './services.repository'

const UTC_OFFSET_HOURS = -3 // America/Araguaina, no DST

type OpeningHour = { weekday: number; closed: boolean; open: string | null; close: string | null }

export function isOpenNow(hours: OpeningHour[], now: Date = new Date()) {
  const local = new Date(now.getTime() + UTC_OFFSET_HOURS * 60 * 60 * 1000)
  const today = hours.find((h) => h.weekday === local.getUTCDay())

  if (!today || today.closed || !today.open || !today.close) return false

  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  return toMinutes(today.open) <= minutes && minutes < toMinutes(today.close)
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export async function listServices() {
  const services = await servicesRepository.findManyActive()

  return services.map(
    ({ id, slug, name, shortDescription, icon, kind, flow, equipmentType }) => ({
      id,
      slug,
      name,
      shortDescription,
      icon,
      kind,
      flow,
      equipmentType,
    }),
  )
}

export async function getServiceDetail(slug: string, now: Date = new Date()) {
  const service = await servicesRepository.findUniqueBySlug(slug)

  if (!service) throw new NotFoundError('Service not found')

  const [hours, settings] = await Promise.all([
    servicesRepository.findOpeningHours(),
    servicesRepository.findReservationSettings(),
  ])

  const openingHours = hours.map((h) => ({
    weekday: h.weekday,
    closed: h.closed,
    open: h.openTime,
    close: h.closeTime,
  }))

  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    shortDescription: service.shortDescription,
    icon: service.icon,
    kind: service.kind,
    flow: service.flow,
    equipmentType: service.equipmentType,
    description: service.description,
    howItWorks: service.howItWorks,
    openingHours,
    isOpenNow: isOpenNow(openingHours, now),
    pickupLocation: service.pickupLocation && {
      id: service.pickupLocation.id,
      name: service.pickupLocation.name,
      floor: service.pickupLocation.floor,
      type: service.pickupLocation.type,
      active: service.pickupLocation.active,
    },
    loanDurationMinutes: settings?.loanDurationMinutes ?? null,
    pickupToleranceMinutes: settings?.pickupToleranceMinutes ?? null,
    storageDays: settings?.foundItemStorageDays ?? null,
    contactPhone: service.contactPhone,
  }
}
