import type { Service } from '@/types/service'

// Aceita NEXT_PUBLIC_API_URL com ou sem o sufixo /api/v1.
const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/+$/, '')
const API_URL = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`

/**
 * Lista os serviços ativos (RF01). Retorna `null` quando a API não responde,
 * para a página poder distinguir "erro" de "lista vazia".
 */
export async function listServices(): Promise<Service[] | null> {
  try {
    const response = await fetch(`${API_URL}/services`, {
      next: { revalidate: 60 },
    })

    if (!response.ok) return null

    const body = (await response.json()) as { data: Service[] }
    return body.data
  } catch {
    return null
  }
}

export interface OpeningHour {
  weekday: number
  closed: boolean
  open: string | null
  close: string | null
}

export interface ServiceDetail extends Service {
  description: string | null
  howItWorks: string | null
  openingHours: OpeningHour[]
  isOpenNow: boolean
  pickupLocation: { id: string; name: string; floor: string | null } | null
  loanDurationMinutes: number | null
  pickupToleranceMinutes: number | null
  storageDays: number | null
  contactPhone: string | null
}

/** Detalhe de um serviço. `null` = não encontrado ou API indisponível. */
export async function getService(slug: string): Promise<ServiceDetail | null> {
  try {
    const response = await fetch(`${API_URL}/services/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    })

    if (!response.ok) return null

    const body = (await response.json()) as { data?: ServiceDetail } & Partial<ServiceDetail>
    return (body.data ?? body) as ServiceDetail
  } catch {
    return null
  }
}
