import type { Service } from '@/types/service'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1'

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
