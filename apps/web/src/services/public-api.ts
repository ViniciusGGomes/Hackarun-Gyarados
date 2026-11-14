import { API_URL } from './services'

export interface PrivacyNotice {
  version: string
  text: string
  updatedAt: string
}

export interface Location {
  id: string
  name: string
  floor: string | null
  type: string
  active: boolean
}

export interface Slot {
  start: string
  end: string
  availableUnits: number
  available: boolean
}

export interface Availability {
  equipmentType: 'wheelchair' | 'stroller'
  date: string
  slotMinutes: number
  loanDurationMinutes: number
  nowAvailable: boolean | null
  slots: Slot[]
}

export interface ProtocolCreated {
  protocol: string
  status: string
  createdAt: string
  trackingPath: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
    if (!response.ok) return null
    const body = await response.json()
    return (body?.data ?? body) as T
  } catch {
    return null
  }
}

export const getPrivacyNotice = () => getJson<PrivacyNotice>('/privacy-notice')
export const getLocations = async () => (await getJson<Location[]>('/locations')) ?? []
export const getAvailability = (type: string, date: string) =>
  getJson<Availability>(`/equipment/${type}/availability?date=${date}`)

const ERROR_MESSAGES: Record<string, string> = {
  CONSENT_REQUIRED: 'É preciso aceitar o aviso de privacidade para continuar.',
  VALIDATION_ERROR: 'Confira os dados informados e tente novamente.',
  NO_AVAILABILITY: 'Esse horário acabou de ser reservado. Escolha outro.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Tente novamente.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const code = data?.code ?? data?.error
    throw new ApiError(
      ERROR_MESSAGES[code as string] ?? data?.message ?? 'Não foi possível concluir a solicitação.',
      code,
    )
  }

  return (data?.data ?? data) as T
}
