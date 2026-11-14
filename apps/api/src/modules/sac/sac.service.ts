import { AppError } from '../../http/routes/_errors/app-error'
import { sacRepository as repository } from './sac.repository'
import type { CreateSacMessageInput } from './sac.schemas'

export async function createSacMessage(input: CreateSacMessageInput) {
  const activeVersion = await repository.findActivePrivacyVersion()
  const { accepted, privacyNoticeVersion } = input.consent

  if (accepted !== true || !activeVersion || privacyNoticeVersion !== activeVersion) {
    throw new AppError(400, 'CONSENT_REQUIRED', 'Accept the current privacy notice to continue')
  }

  const { protocol, createdAt } = await repository.createSacMessageTx({
    name: input.name,
    phone: input.phone,
    email: input.email,
    subject: input.subject,
    message: input.message,
    relatedServiceSlug: input.relatedService,
    relatedProtocol: input.relatedProtocol,
    privacyNoticeVersion: activeVersion,
  })

  return { protocol, status: 'open', createdAt, trackingPath: `/acompanhar/${protocol}` }
}
