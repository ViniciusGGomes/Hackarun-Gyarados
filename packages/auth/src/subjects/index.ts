export type SubjectName =
  | 'Request'
  | 'Reservation'
  | 'FoundItem'
  | 'LostReport'
  | 'Equipment'
  | 'Location'
  | 'User'
  | 'ReservationSettings'
  | 'Indicator'

export type RequestStatus =
  | 'reserved'
  | 'picked_up'
  | 'returned'
  | 'no_show'
  | 'registered'
  | 'searching'
  | 'possible_match'
  | 'ready_for_pickup'
  | 'delivered'
  | 'closed_not_found'
  | 'open'
  | 'in_progress'
  | 'answered'
  | 'closed'
  | 'cancelled'

export const FINAL_REQUEST_STATUSES: RequestStatus[] = [
  'returned',
  'delivered',
  'closed_not_found',
  'closed',
  'cancelled',
]

export interface RequestSubject {
  __typename: 'Request'
  status: RequestStatus
}

export type Subject = SubjectName | RequestSubject
