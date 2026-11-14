'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import type { PrivacyNotice } from '@/services/public-api'

export const inputClass =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[14px] outline-none focus:border-g500'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold">
      {label}
      {children}
      {hint && <span className="text-[11px] font-normal text-sub">{hint}</span>}
    </label>
  )
}

export function ConsentBox({
  notice,
  checked,
  onChange,
}: {
  notice: PrivacyNotice | null
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 text-[12px] text-sub">
      <p className="mb-2">{notice?.text ?? 'Não foi possível carregar o aviso de privacidade.'}</p>
      <label className="flex items-start gap-2 font-bold text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5"
        />
        Li e aceito o aviso de privacidade{notice ? ` (versão ${notice.version})` : ''}.{' '}
        <Link href="/privacidade" className="underline" target="_blank">
          Ler
        </Link>
      </label>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
      {message}
    </p>
  )
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-gold px-6 py-3 font-bold text-ink disabled:opacity-60"
    >
      {pending ? 'Enviando...' : children}
    </button>
  )
}

export function SuccessCard({ protocol, title, children }: { protocol: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center">
      <div className="mb-2 text-4xl">✅</div>
      <h2 className="mb-1 text-2xl font-bold">{title}</h2>
      <p className="text-sub">Guarde o seu protocolo:</p>
      <p className="my-3 text-3xl font-extrabold tracking-wider">{protocol}</p>
      {children}
      <Link
        href="/servicos"
        className="mt-4 inline-block rounded-full bg-gold px-6 py-3 font-bold text-ink"
      >
        Voltar aos serviços
      </Link>
    </div>
  )
}

export const onlyDigits = (value: string) => value.replace(/\D/g, '')
