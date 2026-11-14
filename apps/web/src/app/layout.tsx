import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Capim Dourado Shopping',
    template: '%s · Capim Dourado Shopping',
  },
  description:
    'Serviços e comodidades do Capim Dourado Shopping: cadeira de rodas, carrinho de bebê, achados e perdidos e SAC.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
