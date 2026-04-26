import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PapersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const subject = typeof params.subject === 'string' ? params.subject : ''
  const year = typeof params.year === 'string' ? params.year : ''
  const session = typeof params.session === 'string' ? params.session : ''
  const topic = typeof params.topic === 'string' ? params.topic : ''
  const topicQuery = typeof params.topic_q === 'string' ? params.topic_q : ''

  const supabase = await createClient()

  let query = supabase
    .from('papers')
    .select('id,title,year,is_published,pdf_url,markscheme_url,subjects(id,name),exam_sessions(id,session_month,session_year)')
    .eq('is_published', true)
    .order('year', { ascending: false })

  if (subject) query = query.eq('subject_id', subject)
  if (year) query = query.eq('year', Number(year))

  const [{ data: fetchedPapers }, { data: subjects }, { data: allTopics }] = await Promise.all([
    query,
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name').order('name'),
  ])

  const availableTopics = allTopics?.filter((item) => (
    topicQuery ? item.name.toLowerCase().includes(topicQuery.toLowerCase()) : true
  )) ?? []

  let filteredPaperIds: Set<string> | null = null
  if (topic) {
    const { data: topicLinks } = await supabase
      .from('question_topics')
      .select('questions!inner(paper_id)')
      .eq('topic_id', topic)

    filteredPaperIds = new Set(
      topicLinks
        ?.map((item) => item.questions?.paper_id)
        .filter((paperId): paperId is string => Boolean(paperId)),
    )
  }

  const papers = fetchedPapers?.filter((paper) => {
    if (session && paper.exam_sessions?.session_month !== session) return false
    if (filteredPaperIds && !filteredPaperIds.has(paper.id)) return false
    return true
  })

  return (
    <div className="space-y-8">
      <header className="rounded-md border border-[#c3c6ce66] bg-white p-8">
        <h1 className="font-headline text-4xl text-[#00152a]">Past paper archive</h1>
        <p className="mt-2 font-body text-[#43474d]">Browse published real MYP eAssessment papers (2016–2025) and move from paper-level browsing to question-level review.</p>
      </header>

      <form className="grid gap-4 rounded-md border border-[#c3c6ce66] bg-white p-5 md:grid-cols-3">
        <select name="subject" defaultValue={subject} className="tsm-input">
          <option value="">All subjects</option>
          {subjects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="year" defaultValue={year} className="tsm-input">
          <option value="">All years</option>
          {Array.from({ length: 10 }, (_, i) => 2025 - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select name="session" defaultValue={session} className="tsm-input">
          <option value="">All sessions</option>
          <option value="May">May</option>
          <option value="November">November</option>
        </select>
        <input
          type="search"
          name="topic_q"
          defaultValue={topicQuery}
          className="tsm-input"
          placeholder="Search topic name"
        />
        <select name="topic" defaultValue={topic} className="tsm-input">
          <option value="">All topics</option>
          {availableTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="tsm-btn-primary w-fit">Apply filters</button>
      </form>

      {availableTopics.length > 0 ? (
        <section className="rounded-md border border-[#c3c6ce66] bg-white p-5">
          <h2 className="font-headline text-xl text-[#00152a]">Browse by topic</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTopics.slice(0, 12).map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/papers?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}&session=${encodeURIComponent(session)}&topic_q=${encodeURIComponent(topicQuery)}&topic=${encodeURIComponent(item.id)}`}
                className="inline-flex items-center rounded-sm border border-[#c3c6ce66] bg-[#f5f3ee] px-2 py-0.5 font-body text-xs text-[#43474d]"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-4">
        {!papers?.length && <div className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No papers match these filters.</div>}
        {papers?.map((paper) => (
          <article key={paper.id} className="rounded-md border border-[#c3c6ce66] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-headline text-2xl text-[#00152a]">{paper.title}</h2>
                <p className="mt-2 font-body text-sm text-[#43474d]">{paper.subjects?.name} · {paper.year} · {paper.exam_sessions?.session_month || ''}</p>
              </div>
              <Link href={`/dashboard/papers/${paper.id}`} className="tsm-btn-secondary">Open paper</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
