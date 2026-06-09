import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-8">
      <header className="rounded-md border border-[#c3c6ce66] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin workspace</p>
        <h1 className="mt-3 font-headline text-5xl text-[#00152a]">Admin control center</h1>
        <p className="mt-3 max-w-2xl font-body text-lg text-[#43474d]">Jump into the real admin tasks for keeping MYP Atlas useful and ready for students.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Question Bank</p>
          <h2 className="mt-3 font-headline text-3xl text-[#00152a]">Build and review questions</h2>
          <p className="mt-3 font-body text-sm text-[#43474d]">Add, edit, review, publish, and manage the questions students use for topic-based practice.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/admin/question-bank" className="tsm-btn-primary">Open question bank</Link>
            <Link href="/dashboard/admin/question-bank/new" className="tsm-btn-secondary">Add question</Link>
          </div>
        </article>

        <article className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Resource Analytics</p>
          <h2 className="mt-3 font-headline text-3xl text-[#00152a]">See resource usage</h2>
          <p className="mt-3 font-body text-sm text-[#43474d]">Review which resources are being opened or downloaded, and spot what students are using most.</p>
          <div className="mt-6">
            <Link href="/dashboard/admin/resource-analytics" className="tsm-btn-primary">View analytics</Link>
          </div>
        </article>
      </section>
    </div>
  )
}
