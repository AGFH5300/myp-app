import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function togglePaperPublish(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const paperId = String(formData.get('paper_id'))
  const nextState = String(formData.get('next_state')) === 'true'
  await supabase.from('papers').update({ is_published: nextState }).eq('id', paperId)
}

async function toggleQuestionPublish(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const questionId = String(formData.get('question_id'))
  const nextState = String(formData.get('next_state')) === 'true'
  await supabase.from('questions').update({ is_published: nextState }).eq('id', questionId)
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: subjects }, { data: examSessions }, { data: papers }, { data: questions }, { data: topics }] = await Promise.all([
    supabase.from('subjects').select('id,name,description').order('name').limit(30),
    supabase.from('exam_sessions').select('id,session_month,session_year,is_published').order('session_year', { ascending: false }).limit(30),
    supabase.from('papers').select('id,title,is_published,pdf_url,markscheme_url,markscheme_text,subjects(name),exam_sessions(session_month,session_year)').order('created_at', { ascending: false }).limit(30),
    supabase.from('questions').select('id,question_number,is_published,prompt_text,papers(title)').order('created_at', { ascending: false }).limit(30),
    supabase.from('topics').select('id,name').order('name').limit(50),
  ])

  return (
    <div className="space-y-8">
      <h1 className="font-headline text-4xl text-[#00152a]">Admin content management</h1>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md"><h2 className="font-headline text-2xl text-[#00152a] mb-3">Subjects</h2><div className="space-y-2">{subjects?.map((item) => <p key={item.id} className="font-body text-sm text-[#43474d]">{item.name}</p>)}</div></section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md"><h2 className="font-headline text-2xl text-[#00152a] mb-3">Exam sessions</h2><div className="space-y-2">{examSessions?.map((item) => <p key={item.id} className="font-body text-sm text-[#43474d]">{item.session_month} {item.session_year} · {item.is_published ? 'Published' : 'Draft'}</p>)}</div></section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <h2 className="font-headline text-2xl text-[#00152a] mb-3">Papers (publish/unpublish)</h2>
        <div className="space-y-3">{papers?.map((paper) => (
          <div key={paper.id} className="bg-[#f5f3ee] rounded-sm p-4 flex items-start justify-between gap-3">
            <div><p className="font-headline text-lg text-[#00152a]">{paper.title}</p><p className="font-body text-sm text-[#43474d]">{paper.subjects?.name} · {paper.exam_sessions?.session_month} {paper.exam_sessions?.session_year}</p><p className="font-body text-xs text-[#43474d] mt-1">PDF: {paper.pdf_url || 'none'} · Markscheme URL: {paper.markscheme_url || 'none'} · Markscheme text: {paper.markscheme_text ? 'yes' : 'no'}</p></div>
            <form action={togglePaperPublish}><input type="hidden" name="paper_id" value={paper.id} /><input type="hidden" name="next_state" value={String(!paper.is_published)} /><button className="tsm-btn-secondary">{paper.is_published ? 'Unpublish' : 'Publish'}</button></form>
          </div>
        ))}</div>
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <h2 className="font-headline text-2xl text-[#00152a] mb-3">Questions (publish/unpublish)</h2>
        <div className="space-y-3">{questions?.map((question) => (
          <div key={question.id} className="bg-[#f5f3ee] rounded-sm p-4 flex items-start justify-between gap-3">
            <div><p className="font-headline text-lg text-[#00152a]">{question.papers?.title} · Q{question.question_number}</p><p className="font-body text-sm text-[#43474d] line-clamp-2">{question.prompt_text}</p></div>
            <form action={toggleQuestionPublish}><input type="hidden" name="question_id" value={question.id} /><input type="hidden" name="next_state" value={String(!question.is_published)} /><button className="tsm-btn-secondary">{question.is_published ? 'Unpublish' : 'Publish'}</button></form>
          </div>
        ))}</div>
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md"><h2 className="font-headline text-2xl text-[#00152a] mb-3">Topics</h2><p className="font-body text-sm text-[#43474d]">{topics?.map((topic) => topic.name).join(', ') || 'No topics yet.'}</p></section>
    </div>
  )
}
