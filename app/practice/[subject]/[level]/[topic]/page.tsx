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
  question_topics?: { is_primary?: boolean | null; topics?: { name?: string | null; parent_topic_id?: string | null } | null }[] | null
}

type LinkRow = { topic_id: string; questions?: QuestionRow | QuestionRow[] | null }

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
    supabase.from('topics').select('id,name,parent_topic_id').eq('id', topic).maybeSingle(),
  ])
  if (!subject || !topicRow) notFound()

  const { data: childTopics } = await supabase
    .from('topics')
    .select('id,name,sort_order')
    .eq('parent_topic_id', topicRow.id)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  const topicIds = childTopics?.length ? childTopics.map((child) => child.id) : [topicRow.id]
  const { data: links } = await supabase
    .from('question_topics')
    .select('topic_id,questions!inner(id,question_number,question_order,marks,image_url,question_image_path,is_published,papers!inner(title,year,level,is_published,subject_id,subjects(name),exam_sessions(session_month)),question_topics(is_primary,topics(name,parent_topic_id)))')
    .in('topic_id', topicIds)
    .eq('questions.is_published', true)
    .eq('questions.papers.is_published', true)
    .eq('questions.papers.subject_id', subject.id)
    .eq('questions.papers.level', level)

  const rows = (links ?? []) as unknown as LinkRow[]

  if (childTopics?.length) {
    const counts = new Map(rows.map((row) => [row.topic_id, 0]))
    rows.forEach((row) => counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1))
    const visibleChildren = childTopics.filter((child) => (counts.get(child.id) ?? 0) > 0)

    return (
      <div className="min-h-screen bg-[#fbf9f4]">
        <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
        <main className="tsm-shell py-12">
          <Link href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}`} className="font-body text-sm text-[#735b2b] underline">← {level} topics</Link>
          <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{topicRow.name}</h1>
          <p className="mt-3 font-body text-[#43474d]">Choose a subtopic.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {visibleChildren.map((child) => (
              <Link key={child.id} href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}/${child.id}`} className="rounded-md border border-[#c3c6ce66] bg-white p-6 hover:border-[#735b2b]">
                <h2 className="font-headline text-3xl text-[#00152a]">{child.name}</h2>
                <p className="mt-2 font-body text-sm text-[#43474d]">{counts.get(child.id)} question{counts.get(child.id) === 1 ? '' : 's'}</p>
              </Link>
            ))}
            {!visibleChildren.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published subtopics yet.</p> : null}
          </div>
        </main>
      </div>
    )
  }

  const questions = rows
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
        <Link href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}${topicRow.parent_topic_id ? `/${topicRow.parent_topic_id}` : ''}`} className="font-body text-sm text-[#735b2b] underline">← {topicRow.parent_topic_id ? 'Subtopics' : `${level} topics`}</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{topicRow.name}</h1>
        <p className="mt-3 font-body text-[#43474d]">Open a question, try it, then reveal the mark scheme.</p>
        <div className="mt-8 space-y-4">
          {questions.map((question) => {
            const previewUrl = previewUrls.get(question.id)
            const paper = firstRelation(question.papers)
            const primary = question.question_topics?.find((row) => row.is_primary)?.topics ?? question.question_topics?.[0]?.topics
            return (
              <Link key={question.id} href={`/practice/question/${question.id}`} className="flex items-center justify-between gap-4 rounded-md border border-[#c3c6ce66] bg-white p-5 hover:border-[#735b2b]">
                <div>
                  <h2 className="font-headline text-2xl text-[#00152a]">{paper?.title} Q{question.question_number}</h2>
                  <p className="mt-1 font-body text-sm text-[#43474d]">{paper?.year} {firstRelation(paper?.exam_sessions)?.session_month} · {question.marks ?? '—'} marks · {primary?.name || topicRow.name}</p>
                  <span className="mt-3 inline-block font-body text-sm font-semibold text-[#735b2b]">Practise</span>
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
