'use client'

import { useState } from 'react'

import { postJson, type Location, type PrivacyNotice, type ProtocolCreated } from '@/services/public-api'

import { ConsentBox, Field, FormError, inputClass, onlyDigits, SubmitButton, SuccessCard } from '../forms/form-parts'

const CATEGORIES = [
  ['documents', 'Documentos'],
  ['wallet_bag', 'Carteira ou bolsa'],
  ['phone_electronics', 'Celular ou eletrônicos'],
  ['keys', 'Chaves'],
  ['clothing_accessories', 'Roupas e acessórios'],
  ['glasses_jewelry', 'Óculos ou joias'],
  ['other', 'Outro'],
] as const

const PERIODS = [
  ['unknown', 'Não sei'],
  ['morning', 'Manhã'],
  ['afternoon', 'Tarde'],
  ['night', 'Noite'],
] as const

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }).format(new Date())

export function LostReportForm({ notice, locations }: { notice: PrivacyNotice | null; locations: Location[] }) {
  const [category, setCategory] = useState('wallet_bag')
  const [description, setDescription] = useState('')
  const [identificationDetail, setIdentificationDetail] = useState('')
  const [locationId, setLocationId] = useState('')
  const [lostDate, setLostDate] = useState(today())
  const [lostPeriod, setLostPeriod] = useState('unknown')
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
    setPending(true)
    try {
      setDone(
        await postJson<ProtocolCreated>('/lost-reports', {
          category,
          description,
          identificationDetail: identificationDetail || undefined,
          ...(locationId ? { locationId } : { unknownLocation: true }),
          lostDate,
          lostPeriod,
          name,
          phone: onlyDigits(phone),
          email: email || undefined,
          consent: { accepted: consent, privacyNoticeVersion: notice?.version ?? '' },
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <SuccessCard protocol={done.protocol} title="Objeto registrado!">
        <p className="text-sub">Se o item for encontrado, avisaremos você.</p>
      </SuccessCard>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="O que você perdeu?">
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descrição do objeto" hint={`${description.length}/500`}>
        <textarea className={inputClass} rows={3} maxLength={500} required value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Característica que identifique (opcional)" hint="Ex.: marca, cor, adesivo, arranhão. Não será exibida publicamente.">
        <input className={inputClass} maxLength={300} value={identificationDetail} onChange={(e) => setIdentificationDetail(e.target.value)} />
      </Field>
      <Field label="Onde você acha que perdeu?">
        <select className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Não sei</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.floor ? ` — ${l.floor}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <input className={inputClass} type="date" required max={today()} value={lostDate} onChange={(e) => setLostDate(e.target.value)} />
        </Field>
        <Field label="Período do dia">
          <select className={inputClass} value={lostPeriod} onChange={(e) => setLostPeriod(e.target.value)}>
            {PERIODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Seu nome">
        <input className={inputClass} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone (com DDD)">
          <input className={inputClass} required inputMode="tel" placeholder="63999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="E-mail (opcional)">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <ConsentBox notice={notice} checked={consent} onChange={setConsent} />
      <FormError message={error} />
      <SubmitButton pending={pending}>Registrar objeto perdido</SubmitButton>
    </form>
  )
}
