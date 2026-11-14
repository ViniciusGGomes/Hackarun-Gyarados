'use client'

import { useEffect, useState } from 'react'

import {
  getAvailability,
  postJson,
  type Availability,
  type Location,
  type PrivacyNotice,
} from '@/services/public-api'

import { ConsentBox, Field, FormError, inputClass, onlyDigits, SubmitButton, SuccessCard } from '../forms/form-parts'

interface Created {
  protocol: string
  startAt: string
  endAt: string
  pickupDeadline: string
  pickupLocation: { name: string; floor: string | null } | null
}

const TZ = 'America/Araguaina'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

export function ReservationForm({
  equipmentType,
  notice,
  locations,
}: {
  equipmentType: 'wheelchair' | 'stroller'
  notice: PrivacyNotice | null
  locations: Location[]
}) {
  const isWheelchair = equipmentType === 'wheelchair'
  const label = isWheelchair ? 'cadeira de rodas' : 'carrinho de bebê'

  const [date, setDate] = useState(today())
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [mode, setMode] = useState<'now' | 'scheduled'>('scheduled')
  const [startAt, setStartAt] = useState('')
  const [forWhom, setForWhom] = useState('self')
  const [size, setSize] = useState('adult')
  const [strollerKind, setStrollerKind] = useState('single')
  const [currentLocationId, setCurrentLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Created | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)
    setStartAt('')
    getAvailability(equipmentType, date).then((result) => {
      if (cancelled) return
      setAvailability(result)
      setLoadingSlots(false)
    })
    return () => {
      cancelled = true
    }
  }, [equipmentType, date])

  const canNow = date === today() && availability?.nowAvailable === true

  useEffect(() => {
    if (!canNow && mode === 'now') setMode('scheduled')
  }, [canNow, mode])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'scheduled' && !startAt) return setError('Escolha um horário.')
    setPending(true)
    try {
      setDone(
        await postJson<Created>('/reservations', {
          equipmentType,
          mode,
          startAt: mode === 'scheduled' ? startAt : undefined,
          name,
          phone: onlyDigits(phone),
          email: email || undefined,
          currentLocationId: currentLocationId || undefined,
          ...(isWheelchair ? { forWhom, size } : { strollerKind }),
          notes: notes || undefined,
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
    const place = done.pickupLocation
      ? ` em: ${done.pickupLocation.name}${done.pickupLocation.floor ? ` (${done.pickupLocation.floor})` : ''}`
      : ''

    return (
      <SuccessCard protocol={done.protocol} title="Reserva confirmada!">
        <p className="text-sub">
          Reserva da {label} das {time(done.startAt)} às {time(done.endAt)}.
          <br />
          Retire até {time(done.pickupDeadline)}
          {place}.
        </p>
      </SuccessCard>
    )
  }

  const slots = availability?.slots ?? []

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Data">
        <input className={inputClass} type="date" min={today()} required value={date} onChange={(e) => setDate(e.target.value || today())} />
      </Field>

      {canNow && (
        <div className="flex gap-2 text-[13px] font-bold">
          {(['now', 'scheduled'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full border px-4 py-2 ${mode === m ? 'border-g500 bg-gold' : 'border-line bg-card'}`}
            >
              {m === 'now' ? 'Preciso agora' : 'Agendar horário'}
            </button>
          ))}
        </div>
      )}

      {mode === 'scheduled' && (
        <div>
          <p className="mb-2 text-[13px] font-bold">
            Horário de retirada
            {availability && (
              <span className="font-normal text-sub"> (empréstimo de {availability.loanDurationMinutes} min)</span>
            )}
          </p>
          {loadingSlots ? (
            <p className="text-sub">Carregando horários...</p>
          ) : slots.length === 0 ? (
            <p className="text-sub">Sem horários disponíveis nesta data.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setStartAt(slot.start)}
                  className={`rounded-xl border px-2 py-2 text-[13px] font-bold disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                    startAt === slot.start ? 'border-g500 bg-gold' : 'border-line bg-card'
                  }`}
                >
                  {time(slot.start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isWheelchair ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Para quem?">
            <select className={inputClass} value={forWhom} onChange={(e) => setForWhom(e.target.value)}>
              <option value="self">Para mim</option>
              <option value="other">Para outra pessoa</option>
            </select>
          </Field>
          <Field label="Tamanho">
            <select className={inputClass} value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="adult">Adulto</option>
              <option value="child">Infantil</option>
            </select>
          </Field>
        </div>
      ) : (
        <Field label="Tipo de carrinho">
          <select className={inputClass} value={strollerKind} onChange={(e) => setStrollerKind(e.target.value)}>
            <option value="single">Simples</option>
            <option value="double">Duplo</option>
          </select>
        </Field>
      )}

      <Field label="Onde você está agora? (opcional)">
        <select className={inputClass} value={currentLocationId} onChange={(e) => setCurrentLocationId(e.target.value)}>
          <option value="">Prefiro não informar</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.floor ? ` — ${l.floor}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Observações (opcional)" hint="Não informe condições de saúde.">
        <input className={inputClass} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

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
      <SubmitButton pending={pending}>Reservar {label}</SubmitButton>
    </form>
  )
}
