'use client'

import { useState } from 'react'

import { postJson, type PrivacyNotice, type ProtocolCreated } from '@/services/public-api'

import { ConsentBox, Field, FormError, inputClass, onlyDigits, SubmitButton, SuccessCard } from '../forms/form-parts'

const SUBJECTS = [
  ['question', 'Dúvida'],
  ['complaint', 'Reclamação'],
  ['suggestion', 'Sugestão'],
  ['compliment', 'Elogio'],
  ['data_deletion', 'Exclusão dos meus dados'],
  ['other', 'Outro assunto'],
] as const

export function SacForm({ notice, serviceSlug }: { notice: PrivacyNotice | null; serviceSlug: string }) {
  const [subject, setSubject] = useState<string>('question')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ProtocolCreated | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!phone && !email) return setError('Informe um telefone ou e-mail para retorno.')
    setPending(true)
    try {
      setDone(
        await postJson<ProtocolCreated>('/sac-messages', {
          subject,
          message,
          name,
          phone: phone ? onlyDigits(phone) : undefined,
          email: email || undefined,
          relatedService: serviceSlug,
          consent: { accepted: consent, privacyNoticeVersion: notice?.version ?? '' },
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setPending(false)
    }
  }

  if (done) return <SuccessCard protocol={done.protocol} title="Mensagem enviada!" />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Assunto">
        <select className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sua mensagem" hint={`${message.length}/1500`}>
        <textarea className={inputClass} rows={5} maxLength={1500} required value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <Field label="Nome">
        <input className={inputClass} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone (com DDD)">
          <input className={inputClass} inputMode="tel" placeholder="63999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="E-mail (opcional)">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <ConsentBox notice={notice} checked={consent} onChange={setConsent} />
      <FormError message={error} />
      <SubmitButton pending={pending}>Enviar mensagem</SubmitButton>
    </form>
  )
}
