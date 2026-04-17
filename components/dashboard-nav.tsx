"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Profile { full_name: string | null }

const nav = [
  ['menu_book', 'Workspace', '/dashboard'],
  ['local_library', 'Library', '/dashboard/subjects'],
  ['history_edu', 'Assessments', '/dashboard/progress'],
]

export function DashboardNav({ user, profile }: { user: SupabaseUser; profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#f5f3ee] border-b border-[#c3c6ce66] px-6 py-4 flex items-center justify-between"><div className="font-headline italic text-xl text-[#00152a]">The Scholarly Manuscript</div><span className="material-symbols-outlined">menu</span></header>
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#f5f3ee] flex-col py-8 z-40">
        <div className="px-8 mb-12"><div className="font-headline text-xl italic text-[#00152a]">The Scholarly Manuscript</div></div>
        <div className="flex flex-col gap-2 flex-1">{nav.map(([icon, label, href]) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href as string))
          return <Link key={href as string} href={href as string} className={`flex items-center gap-3 py-3 ${active ? 'text-[#00152a] font-semibold border-l-4 border-[#735b2b] pl-4 bg-[#fbf9f4]' : 'text-[#6b7280] pl-5'}`}><span className="material-symbols-outlined text-xl">{icon as string}</span><span className="font-body">{label as string}</span></Link>
        })}</div>
        <div className="px-6"><div className="text-sm font-body text-[#00152a] mb-1">{profile?.full_name || 'Academic Portal'}</div><div className="text-xs text-[#43474d] mb-4">{user.email}</div><button className="w-full py-3 bg-[#00152a] text-white text-sm" onClick={signOut}>Sign Out</button></div>
      </nav>
    </>
  )
}
