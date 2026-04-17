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
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-12">{children}</div>
      </main>
    </div>
  )
}
