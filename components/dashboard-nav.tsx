"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AppIcon } from '@/components/app-icon'
import { useState } from 'react'
import { BrandWordmark } from '@/components/brand-wordmark'

interface Profile {
  full_name: string | null
  role?: string | null
}

const baseNav = [
  ['dashboard', 'Dashboard', '/dashboard'],
  ['description', 'Papers', '/dashboard/papers'],
  ['category', 'Subjects', '/dashboard/subjects'],
  ['bookmark', 'Bookmarks', '/dashboard/bookmarks'],
] as const

const adminNav = [
  ['Question Bank', '/dashboard/admin/question-bank'],
  ['Topic Manager', '/dashboard/admin/topics'],
  ['Resource Analytics', '/dashboard/admin/resource-analytics'],
] as const

export function DashboardNav({ user, profile }: { user: SupabaseUser; profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = profile?.role === 'admin'
  const isAdminRoute = pathname.startsWith('/dashboard/admin')
  const [signingOut, setSigningOut] = useState(false)
  const [adminOpen, setAdminOpen] = useState(isAdminRoute)


  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#f5f3ee] border-b border-[#c3c6ce66] px-6 py-4 flex items-center justify-between"><BrandWordmark className="text-xl" /><button type="button" onClick={signOut} disabled={signingOut} className="text-sm disabled:opacity-60">{signingOut ? 'Signing out…' : 'Sign out'}</button></header>
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#f5f3ee] flex-col py-8 z-40 border-r border-[#c3c6ce33]">
        <div className="px-8 mb-12"><BrandWordmark className="text-xl" href="/dashboard" /></div>
        <div className="flex flex-col gap-2 flex-1">
          {baseNav.map(([icon, label, href]) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return <Link key={href} href={href} className={`flex items-center gap-3 py-3 ${active ? 'text-[#00152a] font-semibold border-l-4 border-[#735b2b] pl-4 bg-[#fbf9f4]' : 'text-[#6b7280] pl-5 hover:text-[#00152a]'}`}><AppIcon name={icon} className="size-5" /><span className="font-body">{label}</span></Link>
          })}
          {isAdmin ? (
            <div>
              <button
                type="button"
                onClick={() => setAdminOpen((open) => !open)}
                aria-expanded={adminOpen}
                aria-controls="admin-sidebar-links"
                className={`flex w-full items-center gap-3 py-3 text-left ${isAdminRoute ? 'text-[#00152a] font-semibold border-l-4 border-[#735b2b] pl-4 bg-[#fbf9f4]' : 'text-[#6b7280] pl-5 hover:text-[#00152a]'}`}
              >
                <AppIcon name="settings" className="size-5" />
                <span className="font-body">Admin</span>
                <AppIcon name="chevron_right" className={`ml-auto mr-4 size-4 transition-transform ${adminOpen ? 'rotate-90' : ''}`} />
              </button>
              <div id="admin-sidebar-links" className={`overflow-hidden transition-[max-height,opacity] duration-200 ${adminOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="mt-1 space-y-1 pb-2 pl-12 pr-4">
                  {adminNav.map(([label, href]) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`)
                    return <Link key={href} href={href} className={`block rounded-sm px-3 py-2 font-body text-sm transition ${active ? 'bg-white font-semibold text-[#00152a] shadow-sm' : 'text-[#6b7280] hover:bg-[#fbf9f4] hover:text-[#00152a]'}`}>{label}</Link>
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="px-6"><div className="text-sm font-body text-[#00152a] mb-1">{profile?.full_name || 'MYP Atlas Student'}</div><div className="text-xs text-[#43474d] mb-4 truncate">{user.email}</div><button type="button" className="w-full py-3 bg-[#00152a] text-white text-sm inline-flex items-center justify-center gap-2 rounded-sm disabled:opacity-60" onClick={signOut} disabled={signingOut}><AppIcon name="logout" className="size-4" />{signingOut ? 'Signing out…' : 'Sign Out'}</button></div>
      </nav>
    </>
  )
}
