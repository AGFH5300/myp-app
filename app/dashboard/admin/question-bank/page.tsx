import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function relationName(relation: unknown, key: 'id' | 'name' | 'title' | 'session_month' | 'parent_topic_id') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null> | null | undefined)?.[key]
}

function stringParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function statusBadge(label: string, tone: 'green' | 'blue' | 'amber' | 'grey') {
  const classes = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-100 text-slate-600'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

export default async function AdminQuestionBankPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: questions }, { data: subjects }, { data: papers }, { data: topics }] = await Promise.all([
    supabase
      .from('questions')
      .select('id,question_number,question_order,marks,is_published,is_reviewed,papers(id,title,year,level,subject_id,subjects(id,name),exam_sessions(session_month)),question_topics(is_primary,topics(id,name,parent_topic_id))')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('papers').select('id,title,year,level,subject_id,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('topics').select('id,name,parent_topic_id').order('name'),
  ])

  const search = stringParam(params, 'q').toLowerCase()
  const subjectFilter = stringParam(params, 'subject')
  const levelFilter = stringParam(params, 'level')
  const paperFilter = stringParam(params, 'paper')
  const topicFilter = stringParam(params, 'topic')
  const publishedFilter = stringParam(params, 'published')
  const reviewedFilter = stringParam(params, 'reviewed')
  const topicNames = new Map((topics ?? []).map((topic) => [topic.id, topic.name]))

  const filteredQuestions = (questions ?? []).filter((question) => {
    const paper = Array.isArray(question.papers) ? question.papers[0] : question.papers
    const questionTopics = question.question_topics ?? []
    const haystack = [paper?.title, paper?.level, paper?.year, relationName(paper?.subjects, 'name'), question.question_number, ...questionTopics.map((row) => relationName(row.topics, 'name'))]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (search && !haystack.includes(search)) return false
    if (subjectFilter && paper?.subject_id !== subjectFilter) return false
    if (levelFilter && paper?.level !== levelFilter) return false
    if (paperFilter && paper?.id !== paperFilter) return false
    if (topicFilter && !questionTopics.some((row) => relationName(row.topics, 'id') === topicFilter || (row.topics && relationName(row.topics, 'parent_topic_id') === topicFilter))) return false
    if (publishedFilter && String(question.is_published) !== publishedFilter) return false
    if (reviewedFilter && String(question.is_reviewed) !== reviewedFilter) return false
    return true
  })

  const levels = Array.from(new Set((papers ?? []).map((paper) => paper.level).filter(Boolean))).sort() as string[]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin</p>
          <h1 className="font-headline text-4xl text-[#00152a]">Question bank</h1>
          <p className="mt-2 font-body text-[#43474d]">Manage individual past-paper questions for topic-based practice.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/admin/question-bank/new" className="tsm-btn-primary">Add question</Link>
          <Link href="/dashboard/papers" className="tsm-btn-secondary">Manage papers</Link>
          <button className="tsm-btn-secondary opacity-70" type="button" disabled title="Topic management is planned next.">Manage topics</button>
        </div>
      </header>

      <form className="rounded-md border border-blue-100 bg-white p-5 shadow-sm" action="/dashboard/admin/question-bank">
        <p className="mb-4 font-body text-sm font-semibold text-[#00152a]">Filter the admin question list</p>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <label htmlFor="admin-qb-filter-search" className="md:col-span-2 font-body text-sm text-[#43474d]">Search<input id="admin-qb-filter-search" name="q" className="tsm-input mt-1 w-full" defaultValue={stringParam(params, 'q')} placeholder="Paper, topic, or Q1a" /></label>
          <label htmlFor="admin-qb-filter-subject" className="font-body text-sm text-[#43474d]">Subject<select id="admin-qb-filter-subject" name="subject" className="tsm-input mt-1 w-full" defaultValue={subjectFilter}><option value="">All subjects</option>{subjects?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label htmlFor="admin-qb-filter-level" className="font-body text-sm text-[#43474d]">Level<select id="admin-qb-filter-level" name="level" className="tsm-input mt-1 w-full" defaultValue={levelFilter}><option value="">All levels</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
          <label htmlFor="admin-qb-filter-paper" className="font-body text-sm text-[#43474d]">Paper<select id="admin-qb-filter-paper" name="paper" className="tsm-input mt-1 w-full" defaultValue={paperFilter}><option value="">All papers</option>{papers?.map((paper) => <option key={paper.id} value={paper.id}>{paper.title} — {relationName(paper.exam_sessions, 'session_month')} {paper.year}</option>)}</select></label>
          <label htmlFor="admin-qb-filter-topic" className="font-body text-sm text-[#43474d]">Topic<select id="admin-qb-filter-topic" name="topic" className="tsm-input mt-1 w-full" defaultValue={topicFilter}><option value="">All topics</option>{topics?.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label htmlFor="admin-qb-filter-published" className="font-body text-sm text-[#43474d]">Shown<select id="admin-qb-filter-published" name="published" className="tsm-input mt-1 w-full" defaultValue={publishedFilter}><option value="">Any</option><option value="true">Show to students</option><option value="false">Hidden</option></select></label>
          <label htmlFor="admin-qb-filter-reviewed" className="font-body text-sm text-[#43474d]">Checked<select id="admin-qb-filter-reviewed" name="reviewed" className="tsm-input mt-1 w-full" defaultValue={reviewedFilter}><option value="">Any</option><option value="true">Checked/ready</option><option value="false">Needs review</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="tsm-btn-primary">Apply filters</button><Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Clear</Link></div>
      </form>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-headline text-2xl text-[#00152a]">Questions</h2>
          <p className="font-body text-sm text-[#43474d]">{filteredQuestions.length} shown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left font-body text-sm">
            <thead className="border-b border-[#c3c6ce66] text-xs uppercase tracking-[.08em] text-[#735b2b]"><tr><th className="py-3 pr-4">Paper</th><th className="py-3 pr-4">Level</th><th className="py-3 pr-4">Year/session</th><th className="py-3 pr-4">Question</th><th className="py-3 pr-4">Marks</th><th className="py-3 pr-4">Primary topic</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Action</th></tr></thead>
            <tbody>
              {filteredQuestions.map((question) => {
                const paper = Array.isArray(question.papers) ? question.papers[0] : question.papers
                const primary = question.question_topics?.find((row) => row.is_primary) ?? question.question_topics?.[0]
                const primaryTopic = Array.isArray(primary?.topics) ? primary?.topics[0] : primary?.topics
                const parentName = primaryTopic?.parent_topic_id ? topicNames.get(primaryTopic.parent_topic_id) : null
                return (
                  <tr key={question.id} className="border-b border-[#f0eee9] align-top text-[#43474d]">
                    <td className="py-4 pr-4 font-semibold text-[#00152a]">{paper?.title || 'Untitled paper'}</td>
                    <td className="py-4 pr-4">{paper?.level || 'No level'}</td>
                    <td className="py-4 pr-4">{paper?.year || '—'} {relationName(paper?.exam_sessions, 'session_month')}</td>
                    <td className="py-4 pr-4">Q{question.question_number}</td>
                    <td className="py-4 pr-4">{question.marks ?? '—'}</td>
                    <td className="py-4 pr-4">{parentName ? <><span className="font-semibold text-[#00152a]">{parentName}</span> <span className="text-[#735b2b]">→</span> </> : null}{primaryTopic?.name || <span className="text-amber-800">Not tagged</span>}</td>
                    <td className="py-4 pr-4"><div className="flex flex-wrap gap-2">{question.is_published ? statusBadge('Published', 'green') : statusBadge('Draft', 'grey')}{question.is_reviewed ? statusBadge('Checked', 'blue') : statusBadge('Needs check', 'amber')}</div></td>
                    <td className="py-4 pr-4"><Link href={`/dashboard/admin/question-bank/${question.id}/edit`} className="tsm-btn-secondary w-fit">Edit</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!filteredQuestions.length ? <p className="mt-4 font-body text-sm text-[#43474d]">No questions match these filters.</p> : null}
      </section>
    </div>
  )
}
