"use client"

import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { DashboardNav } from '@/components/dashboard-nav'

type Profile = {
  full_name: string | null
  role?: string | null
}

const storageKey = 'myp-atlas-sidebar-collapsed'

export function DashboardShell({ user, profile, children }: { user: SupabaseUser; profile: Profile | null; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCollapsed(window.localStorage.getItem(storageKey) === 'true')
      setMounted(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateCollapsed(next: boolean) {
    setCollapsed(next)
    window.localStorage.setItem(storageKey, String(next))
  }

  const desktopOffset = mounted && collapsed ? 'md:ml-[4.5rem]' : 'md:ml-64'

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <DashboardNav user={user} profile={profile} collapsed={mounted ? collapsed : false} onCollapsedChange={updateCollapsed} />
      <main className={`${desktopOffset} min-h-screen pt-20 pb-16 transition-[margin] duration-200 md:pt-0`}>
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">{children}</div>
      </main>
    </div>
  )
}
