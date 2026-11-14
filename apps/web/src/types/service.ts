/** Espelha o schema `Service` do contrato OpenAPI (GET /services). */
export type ServiceKind = 'interactive' | 'informational'

export type ServiceFlow =
  | 'equipment_reservation'
  | 'lost_report'
  | 'sac_message'
  | 'none'

export type EquipmentType = 'wheelchair' | 'stroller'

export interface Service {
  id: string
  slug: string
  name: string
  shortDescription: string
  icon: string | null
  kind: ServiceKind
  flow: ServiceFlow
  equipmentType: EquipmentType | null
}
