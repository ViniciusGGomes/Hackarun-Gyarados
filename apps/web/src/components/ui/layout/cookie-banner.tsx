'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'capim-cookie-consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) !== 'accepted')
  }, [])

  if (!visible) return null

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  return (
    <div className="fixed right-4 bottom-[calc(14px+env(safe-area-inset-bottom,0px))] left-4 z-[5] mx-auto flex max-w-[980px] items-center gap-4 rounded-[14px] bg-card px-[18px] py-3.5 text-[12px] text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.3)] max-[860px]:flex-col max-[860px]:items-stretch">
      <span>
        Este site usa cookies para garantir uma melhor experiência. Mais
        detalhes na nossa{' '}
        <Link href="/privacidade">Política de Privacidade</Link>
        .
      </span>
      <button
        type="button"
        onClick={accept}
        className="cursor-pointer rounded-[10px] border-0 bg-menu px-[22px] py-[11px] font-bold text-white"
      >
        PROSSEGUIR
      </button>
    </div>
  )
}
