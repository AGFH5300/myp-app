import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveQuestionAssetUrl } from '@/lib/question-assets'
import { QuestionBankForm } from '../../form'

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: question }, { data: papers }, { data: subjects }, { data: topics }] = await Promise.all([
    supabase.from('questions').select('id,paper_id,question_number,question_order,marks,prompt_text,markscheme_text,image_url,markscheme_image_url,question_image_path,markscheme_image_path,is_published,is_reviewed,question_topics(topic_id,is_primary)').eq('id', id).maybeSingle(),
    supabase.from('papers').select('id,title,year,level,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name,subject_id,parent_topic_id,level,sort_order,is_active').order('sort_order').order('name'),
  ])

  if (!question) notFound()

  const questionPreviewUrl = await resolveQuestionAssetUrl(supabase, question.question_image_path || question.image_url)
  const markschemePreviewUrl = await resolveQuestionAssetUrl(supabase, question.markscheme_image_path || question.markscheme_image_url)

  return (
    <div className="space-y-8">
      <header>
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin question bank</p>
        <h1 className="font-headline text-4xl text-[#00152a]">Edit question {question.question_number}</h1>
      </header>
      <QuestionBankForm
        mode="edit"
        papers={papers ?? []}
        subjects={subjects ?? []}
        topics={topics ?? []}
        question={question}
        questionPreviewUrl={questionPreviewUrl}
        markschemePreviewUrl={markschemePreviewUrl}
      />
    </div>
  )
}
