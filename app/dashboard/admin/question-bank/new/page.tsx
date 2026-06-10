import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuestionBankForm } from '../form'

export default async function NewQuestionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: papers }, { data: subjects }, { data: topics }, { data: paperQuestions }] = await Promise.all([
    supabase.from('papers').select('id,title,year,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name,subject_id,parent_topic_id,sort_order,is_active').order('sort_order').order('name'),
    supabase.from('questions').select('id,paper_id,question_number,question_order').order('question_order').order('question_number'),
  ])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin question bank</p>
          <h1 className="font-headline text-4xl text-[#00152a]">New question</h1>
        </div>
        <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Back to Question Bank</Link>
      </header>
      <QuestionBankForm mode="new" papers={papers ?? []} subjects={subjects ?? []} topics={topics ?? []} paperQuestions={paperQuestions ?? []} />
    </div>
  )
}
