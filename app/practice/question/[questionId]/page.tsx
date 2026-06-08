import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'
import { resolveQuestionAssetUrl } from '@/lib/question-assets'
import { PendingSubmitButton } from '@/components/pending-submit-button'

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

async function savePracticeBookmark(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  await supabase.from('bookmarks').upsert({
    student_id: user.id,
    question_id: String(formData.get('question_id')),
    paper_id: String(formData.get('paper_id')),
  })
}

export default async function PracticeQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: question } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,papers(id,title,year,level,is_published,subjects(name),exam_sessions(session_month)),question_topics(is_primary,topics(id,name,parent_topic_id))')
    .eq('id', questionId)
    .eq('is_published', true)
    .eq('papers.is_published', true)
    .maybeSingle()

  if (!question || !question.papers) notFound()

  if (user) {
    await supabase.from('recent_question_views').insert({ student_id: user.id, question_id: question.id })
  }

  const questionImageUrl = await resolveQuestionAssetUrl(supabase, question.question_image_path || question.image_url)
  const markschemeImageUrl = await resolveQuestionAssetUrl(supabase, question.markscheme_image_path || question.markscheme_image_url)
  const paper = firstRelation(question.papers)
  if (!paper) notFound()
  const subject = firstRelation(paper.subjects)
  const subjectName = subject?.name || 'Subject'
  const primaryTopic = firstRelation(question.question_topics?.find((row) => row.is_primary)?.topics)
  const topicBackHref = primaryTopic?.id ? `/practice/${encodeURIComponent(subjectName)}${primaryTopic.parent_topic_id ? `/${primaryTopic.parent_topic_id}` : ''}/${primaryTopic.id}` : '/practice'

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell flex items-center justify-between py-6"><BrandWordmark className="text-2xl" href="/practice" /><Link href={user ? '/dashboard' : '/auth/login'} className="tsm-btn-secondary">{user ? 'Dashboard' : 'Log in'}</Link></div></header>
      <main className="tsm-shell py-12">
        <Link href={topicBackHref} className="font-body text-sm text-[#735b2b] underline">← Back to questions</Link>
        <header className="mt-6 rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-body text-sm text-[#43474d]">{subjectName} · {paper.title} · {paper.year} {firstRelation(paper.exam_sessions)?.session_month}</p>
          <h1 className="mt-2 font-headline text-5xl text-[#00152a]">Question {question.question_number}</h1>
          <p className="mt-3 font-body text-[#43474d]">{question.marks ?? '—'} marks{primaryTopic?.name ? ` · ${primaryTopic.name}` : ''}</p>
        </header>

        <section className="mt-6 rounded-md border border-[#c3c6ce66] bg-white p-6">
          <h2 className="font-headline text-2xl text-[#00152a]">Try the question</h2>
          <div className="mt-5 max-w-4xl">
            {questionImageUrl ? (
              <img src={questionImageUrl} alt={`Question ${question.question_number}`} className="h-auto max-w-full rounded-md border border-[#c3c6ce66] bg-white" />
            ) : (
              <p className="font-body whitespace-pre-wrap text-[#00152a]">{question.prompt_text}</p>
            )}
          </div>
        </section>

        <details className="mt-6 rounded-md border border-[#c3c6ce66] bg-white p-6">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Reveal mark scheme</summary>
          <div className="mt-5 max-w-4xl">
            {markschemeImageUrl ? (
              <img src={markschemeImageUrl} alt={`Question ${question.question_number} mark scheme`} className="h-auto max-w-full rounded-md border border-[#c3c6ce66] bg-white" />
            ) : question.markscheme_text ? (
              <p className="font-body whitespace-pre-wrap text-[#43474d]">{question.markscheme_text}</p>
            ) : (
              <p className="font-body text-[#43474d]">No mark scheme has been added for this question yet.</p>
            )}
          </div>
        </details>

        {user ? (
          <form action={savePracticeBookmark} className="mt-6">
            <input type="hidden" name="question_id" value={question.id} />
            <input type="hidden" name="paper_id" value={paper.id} />
            <PendingSubmitButton className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60" label="Bookmark question" pendingLabel="Bookmarking..." />
          </form>
        ) : null}
      </main>
    </div>
  )
}
