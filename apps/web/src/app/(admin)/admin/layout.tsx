import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  // The AbilityProvider and the unauthenticated redirect are wired to the
  // authenticated user in the authentication feature (out of scope here).
  // Sidebar/header gate their items via useAbility().
  return <>{children}</>
}
