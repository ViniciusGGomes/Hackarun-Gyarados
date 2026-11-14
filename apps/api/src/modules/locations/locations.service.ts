import { locationsRepository } from './locations.repository'

export async function listActive() {
  const locations = await locationsRepository.findManyActive()

  return locations.map(({ id, name, floor, type, active }) => ({ id, name, floor, type, active }))
}
