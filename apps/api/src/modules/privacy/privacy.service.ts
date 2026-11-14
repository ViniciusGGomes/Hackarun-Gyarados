import { NotFoundError } from '../../http/routes/_errors/not-found-error'
import { privacyRepository } from './privacy.repository'

export async function getActive() {
  const notice = await privacyRepository.findActive()

  if (!notice) throw new NotFoundError('Privacy notice not found')

  return { version: notice.version, text: notice.text, updatedAt: notice.publishedAt }
}
