import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'
import { resolveQuestionAssetUrl } from '@/lib/question-assets'

type PaperRelation<T> = T | T[] | null
type QuestionRow = {
  id: string
  question_number: string
  question_order: number | null
  marks: number | null
  image_url: string | null
  question_image_path: string | null
  papers?: PaperRelation<{ title?: string | null; year?: number | null; level?: string | null; subjects?: PaperRelation<{ name?: string | null }>; exam_sessions?: PaperRelation<{ session_month?: string | null }> }>
}

type LinkRow = { questions?: QuestionRow | QuestionRow[] | null }

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

export default async function PracticeTopicPage({ params }: { params: Promise<{ subject: string; level: string; topic: string }> }) {
  const { subject: subjectParam, level: levelParam, topic } = await params
  const subjectName = decodeURIComponent(subjectParam)
  const level = decodeURIComponent(levelParam)
  const supabase = await createClient()

  const [{ data: subject }, { data: topicRow }] = await Promise.all([
    supabase.from('subjects').select('id,name').eq('name', subjectName).maybeSingle(),
    supabase.from('topics').select('id,name').eq('id', topic).maybeSingle(),
  ])
  if (!subject || !topicRow) notFound()

  const { data: links } = await supabase
    .from('question_topics')
    .select('questions!inner(id,question_number,question_order,marks,image_url,question_image_path,is_published,papers!inner(title,year,level,is_published,subject_id,subjects(name),exam_sessions(session_month)))')
    .eq('topic_id', topicRow.id)
    .eq('questions.is_published', true)
    .eq('questions.papers.is_published', true)
    .eq('questions.papers.subject_id', subject.id)
    .eq('questions.papers.level', level)

  const questions = ((links ?? []) as unknown as LinkRow[])
    .map((link) => firstRelation(link.questions))
    .filter((question): question is QuestionRow => Boolean(question))
    .sort((a, b) => (firstRelation(a.papers)?.year ?? 0) - (firstRelation(b.papers)?.year ?? 0) || (a.question_order ?? 9999) - (b.question_order ?? 9999) || a.question_number.localeCompare(b.question_number))

  const previewUrls = new Map<string, string | null>()
  for (const question of questions) {
    previewUrls.set(question.id, await resolveQuestionAssetUrl(supabase, question.question_image_path || question.image_url))
  }

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
      <main className="tsm-shell py-12">
        <Link href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}`} className="font-body text-sm text-[#735b2b] underline">← {level} topics</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{topicRow.name}</h1>
        <p className="mt-3 font-body text-[#43474d]">Open a question, try it, then reveal the mark scheme.</p>
        <div className="mt-8 space-y-4">
          {questions.map((question) => {
            const previewUrl = previewUrls.get(question.id)
            return (
              <Link key={question.id} href={`/practice/question/${question.id}`} className="flex items-center justify-between gap-4 rounded-md border border-[#c3c6ce66] bg-white p-5 hover:border-[#735b2b]">
                <div>
                  <h2 className="font-headline text-2xl text-[#00152a]">Question {question.question_number}</h2>
                  <p className="mt-1 font-body text-sm text-[#43474d]">{firstRelation(question.papers)?.title} · {firstRelation(question.papers)?.year} {firstRelation(firstRelation(question.papers)?.exam_sessions)?.session_month} · {question.marks ?? '—'} marks</p>
                </div>
                {previewUrl ? <img src={previewUrl} alt={`Question ${question.question_number} preview`} className="h-16 w-16 rounded-sm border border-[#c3c6ce66] object-cover" /> : null}
              </Link>
            )
          })}
          {!questions.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published questions for this topic yet.</p> : null}
        </div>
      </main>
    </div>
  )
}
