import { AppError } from '../../http/routes/_errors/app-error'
import { lostReportsRepository as repository } from './lost-reports.repository'
import type { CreateLostReportInput } from './lost-reports.schemas'

export async function createLostReport(input: CreateLostReportInput) {
  const activeVersion = await repository.findActivePrivacyVersion()

  if (!input.consent.accepted || !activeVersion || input.consent.privacyNoticeVersion !== activeVersion) {
    throw new AppError(400, 'CONSENT_REQUIRED', 'Accept the current privacy notice to continue')
  }

  if (input.locationId && !(await repository.findActiveLocation(input.locationId))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unknown or inactive location')
  }

  const { protocol, createdAt } = await repository.createLostReportTx({
    name: input.name,
    phone: input.phone,
    email: input.email,
    category: input.category,
    description: input.description,
    identificationDetail: input.identificationDetail,
    photoUrl: input.photoUrl,
    locationId: input.locationId,
    unknownLocation: input.unknownLocation === true,
    lostDate: input.lostDate,
    lostPeriod: input.lostPeriod ?? 'unknown',
    privacyNoticeVersion: input.consent.privacyNoticeVersion,
  })

  return { protocol, status: 'registered', createdAt, trackingPath: `/acompanhar/${protocol}` }
}
