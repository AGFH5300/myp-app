import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PaperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { paperId } = await params
  const query = await searchParams
  const selectedTopic = typeof query.topic === 'string' ? query.topic : ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: paper } = await supabase
    .from('papers')
    .select('id,title,year,pdf_url,markscheme_url,markscheme_text,subjects(name),exam_sessions(session_month,session_year)')
    .eq('id', paperId)
    .eq('is_published', true)
    .maybeSingle()

  if (!paper) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('id,question_number,context_image_url,image_url,secondary_image_url,marks,is_published,question_topics(topic_id,topics(id,name))')
    .eq('paper_id', paperId)
    .eq('is_published', true)
    .order('question_number')

  if (user) {
    await supabase.from('paper_views').insert({ student_id: user.id, paper_id: paperId })
  }

  const topicMap = new Map<string, string>()
  questions?.forEach((item) => {
    item.question_topics?.forEach((row) => {
      const id = row.topics?.id
      const name = row.topics?.name
      if (id && name) topicMap.set(id, name)
    })
  })

  const paperTopics = Array.from(topicMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const filteredQuestions = selectedTopic
    ? (questions ?? []).filter((item) => item.question_topics?.some((row) => row.topics?.id === selectedTopic))
    : questions ?? []

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-4xl text-[#00152a]">{paper.title}</h1>
        <p className="font-body text-[#43474d] mt-2">{paper.subjects?.name} · {paper.year} {paper.exam_sessions?.session_month}</p>
      </header>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md space-y-3">
        <h2 className="font-headline text-2xl text-[#00152a]">Paper resources</h2>
        {paper.pdf_url && <a className="font-body text-sm text-[#735b2b] underline" href={paper.pdf_url} target="_blank">Open paper PDF</a>}
        {paper.markscheme_url && <a className="font-body text-sm text-[#735b2b] underline block" href={paper.markscheme_url} target="_blank">Open markscheme PDF</a>}
        {paper.markscheme_text && <p className="font-body text-sm text-[#43474d] whitespace-pre-wrap">{paper.markscheme_text}</p>}
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline text-2xl text-[#00152a]">Questions from this paper</h2>
          {paperTopics.length > 0 ? (
            <form>
              <select name="topic" defaultValue={selectedTopic} className="tsm-input text-sm">
                <option value="">All topics</option>
                {paperTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </select>
              <button className="sr-only">Filter</button>
            </form>
          ) : null}
        </div>
        <div className="space-y-3">
          {filteredQuestions.map((question) => {
            const previewImage = question.context_image_url || question.image_url || question.secondary_image_url
            const questionTopics = question.question_topics?.map((row) => row.topics).filter(Boolean) ?? []
            return (
              <Link key={question.id} href={`/dashboard/questions/${question.id}`} className="flex items-center justify-between gap-3 p-4 bg-[#f5f3ee] rounded-sm">
                <div className="min-w-0">
                  <p className="font-headline text-lg text-[#00152a]">Q{question.question_number} · {question.marks} marks</p>
                  {questionTopics.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {questionTopics.map((topic) => (
                        <span
                          key={topic.id}
                          className="inline-flex items-center rounded-sm border border-[#c3c6ce66] bg-white px-2 py-0.5 font-body text-xs text-[#43474d]"
                        >
                          {topic.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={`Question ${question.question_number} preview`}
                    className="h-12 w-12 rounded-sm object-cover border border-[#c3c6ce66] bg-white shrink-0"
                  />
                ) : null}
              </Link>
            )
          })}
          {!filteredQuestions.length && <p className="font-body text-sm text-[#43474d]">{selectedTopic ? 'No published questions for this topic in this paper.' : 'No published questions in this paper yet.'}</p>}
        </div>
      </section>
    </div>
  )
}
