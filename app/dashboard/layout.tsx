import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <DashboardNav user={user} profile={profile} />
      <main className="md:ml-64 pt-20 md:pt-0 min-h-screen pb-16">
        <div className="w-full bg-[#eae8e3] py-2 px-8 flex items-center justify-between border-b border-[#c3c6ce33] sticky top-0 z-30">
          <span className="font-body text-xs uppercase tracking-wider text-[#43474d]">Exam Readiness</span>
          <div className="w-1/3 bg-white h-1"><div className="bg-[#735b2b] h-full w-[65%]" /></div>
          <span className="font-headline italic text-sm text-[#735b2b]">65% Optimal</span>
        </div>
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-12">{children}</div>
      </main>
    </div>
  )
}
