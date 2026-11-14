import type { Service } from '@/types/service'

/**
 * Metadados apenas de apresentação, definidos no Figma e ausentes do contrato
 * da API (a API devolve `icon` como chave, não emoji, e não tem categoria).
 */

export const SERVICE_ICON_EMOJI: Record<string, string> = {
  wheelchair: '♿',
  baby: '🛒',
  briefcase: '🔍',
  headset: '🎧',
  family: '👨‍👩‍👧',
  wc: '🚻',
  mail: '✉️',
  badge: '🛡',
  car: '🪪',
  building: '🏛',
  users: '👥',
  store: '🥤',
  plug: '⚡',
  paw: '🐕',
  wifi: '📶',
  parking: '🚗',
  bike: '🚲',
}

export function serviceEmoji(icon: string | null): string {
  return (icon && SERVICE_ICON_EMOJI[icon]) || '🛠'
}

export type ServiceCategory = 'comfort' | 'public' | 'mobility'

export const SERVICE_CATEGORY_BY_SLUG: Record<string, ServiceCategory> = {
  'cadeiras-de-rodas': 'comfort',
  'carrinhos-de-bebe': 'comfort',
  'espaco-familia': 'comfort',
  'banheiros-pne': 'comfort',
  'pet-friendly': 'comfort',
  'wi-fi': 'comfort',
  correios: 'public',
  'policia-federal': 'public',
  detran: 'public',
  'resolve-palmas': 'public',
  'espaco-do-cliente': 'public',
  'maria-express': 'public',
  'carregadores-eletricos': 'mobility',
  estacionamento: 'mobility',
  bicicletario: 'mobility',
}

export type ServiceFilter = 'all' | 'online' | ServiceCategory

export const SERVICE_FILTERS: { key: ServiceFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'online', label: 'Solicite online' },
  { key: 'comfort', label: 'Conforto' },
  { key: 'public', label: 'Serviços públicos' },
  { key: 'mobility', label: 'Mobilidade' },
]

/** Serviços que exibem o selo "NOVO" no Figma. */
export const NEW_SERVICE_SLUGS = new Set(['carrinhos-de-bebe'])

export function matchesFilter(service: Service, filter: ServiceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'online') return service.kind === 'interactive'
  return SERVICE_CATEGORY_BY_SLUG[service.slug] === filter
}
