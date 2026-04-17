import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function saveBookmark(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const questionId = String(formData.get('question_id'))
  const paperId = String(formData.get('paper_id'))

  await supabase.from('bookmarks').upsert({
    student_id: user.id,
    question_id: questionId,
    paper_id: paperId,
  })
}

export default async function QuestionDetailPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: question } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,image_url,marks,papers(id,title,year,markscheme_text,markscheme_url),question_topics(topics(id,name))')
    .eq('id', questionId)
    .eq('is_published', true)
    .maybeSingle()

  if (!question) notFound()

  if (user) {
    await supabase.from('recent_question_views').insert({ student_id: user.id, question_id: questionId })
  }

  const topicNames = question.question_topics?.map((row) => row.topics?.name).filter(Boolean) ?? []

  return (
    <div className="space-y-8">
      <header>
        <p className="font-body text-sm text-[#43474d]">{question.papers?.title} · {question.papers?.year}</p>
        <h1 className="font-headline text-4xl text-[#00152a]">Question {question.question_number}</h1>
      </header>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <p className="font-body text-[#00152a] whitespace-pre-wrap">{question.prompt_text}</p>
        {question.image_url && <p className="font-body text-sm text-[#735b2b] mt-4">Image asset: <a href={question.image_url} className="underline" target="_blank">open image</a></p>}
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md space-y-3">
        <h2 className="font-headline text-2xl text-[#00152a]">Tags and markscheme</h2>
        <p className="font-body text-sm text-[#43474d]">Marks: {question.marks ?? '—'}</p>
        <p className="font-body text-sm text-[#43474d]">Topics: {topicNames.length ? topicNames.join(', ') : 'No topics tagged yet'}</p>
        {question.papers?.markscheme_url && <a href={question.papers.markscheme_url} target="_blank" className="font-body text-sm text-[#735b2b] underline">Open paper markscheme</a>}
        {question.papers?.markscheme_text && <p className="font-body text-sm text-[#43474d] whitespace-pre-wrap">{question.papers.markscheme_text}</p>}
      </section>

      {user && <form action={saveBookmark}><input type="hidden" name="question_id" value={question.id} /><input type="hidden" name="paper_id" value={question.papers?.id || ''} /><button className="tsm-btn-primary">Bookmark question</button></form>}

      <Link href={`/dashboard/papers/${question.papers?.id}`} className="tsm-btn-secondary inline-block">Back to paper</Link>
    </div>
  )
}
