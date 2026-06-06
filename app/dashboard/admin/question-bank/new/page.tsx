import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuestionBankForm } from '../form'

export default async function NewQuestionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: papers }, { data: subjects }, { data: topics }] = await Promise.all([
    supabase.from('papers').select('id,title,year,level,subjects(name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name').order('name'),
  ])

  return (
    <div className="space-y-8">
      <header>
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin question bank</p>
        <h1 className="font-headline text-4xl text-[#00152a]">New question</h1>
      </header>
      <QuestionBankForm mode="new" papers={papers ?? []} subjects={subjects ?? []} topics={topics ?? []} />
    </div>
  )
}
