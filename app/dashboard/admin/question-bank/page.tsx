import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function relationName(relation: unknown, key: 'name' | 'title' | 'session_month') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null> | null | undefined)?.[key]
}

export default async function AdminQuestionBankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: questions } = await supabase
    .from('questions')
    .select('id,question_number,question_order,marks,is_published,is_reviewed,papers(id,title,year,level,subjects(name),exam_sessions(session_month)),question_topics(is_primary,topics(name))')
    .order('created_at', { ascending: false })
    .limit(80)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin</p>
          <h1 className="font-headline text-4xl text-[#00152a]">Question bank</h1>
          <p className="mt-2 font-body text-[#43474d]">Create individual past paper questions and tag them by topic.</p>
        </div>
        <Link href="/dashboard/admin/question-bank/new" className="tsm-btn-primary">New question</Link>
      </header>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <div className="space-y-3">
          {questions?.map((question) => {
            const paper = Array.isArray(question.papers) ? question.papers[0] : question.papers
            const topics = question.question_topics?.map((row) => relationName(row.topics, 'name')).filter(Boolean) ?? []
            return (
              <article key={question.id} className="flex flex-col gap-3 rounded-sm bg-[#f5f3ee] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-headline text-xl text-[#00152a]">{relationName(question.papers, 'title')} · Q{question.question_number}</h2>
                  <p className="font-body text-sm text-[#43474d]">
                    {relationName(paper?.subjects, 'name')} · {paper?.level || 'No level'} · {paper?.year} {relationName(paper?.exam_sessions, 'session_month')} · {question.marks ?? '—'} marks
                  </p>
                  <p className="mt-1 font-body text-xs text-[#43474d]">
                    {question.is_published ? 'Published' : 'Unpublished'} · {question.is_reviewed ? 'Reviewed' : 'Needs review'} · Topics: {topics.join(', ') || 'none'}
                  </p>
                </div>
                <Link href={`/dashboard/admin/question-bank/${question.id}/edit`} className="tsm-btn-secondary w-fit">Edit</Link>
              </article>
            )
          })}
          {!questions?.length ? <p className="font-body text-sm text-[#43474d]">No questions have been created yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
