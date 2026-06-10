import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuestionFromPdfForm } from '../from-pdf-form'

export default async function QuestionFromPdfPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: papers }, { data: subjects }, { data: topics }] = await Promise.all([
    supabase.from('papers').select('id,title,year,level,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name,subject_id,parent_topic_id,level,sort_order,is_active').order('sort_order').order('name'),
  ])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin question bank</p>
          <h1 className="font-headline text-4xl text-[#00152a]">Create question from PDF</h1>
          <p className="mt-2 max-w-3xl font-body text-[#43474d]">Crop the exact parts of the paper and mark scheme needed for one question. Add multiple crops if the question spans text, table, graph, or continuation.</p>
        </div>
        <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Back to Question Bank</Link>
      </header>
      <QuestionFromPdfForm papers={papers ?? []} subjects={subjects ?? []} topics={topics ?? []} />
    </div>
  )
}
