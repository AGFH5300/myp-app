import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminQuestionBankFilterForm } from './filter-form'
import { QuestionBankList, type QuestionBankRow } from './question-bank-list'
import { compactTopicPair, questionWarnings, relationValue, topicSummary, warningKey, type TopicRef, type WarningFilter } from '@/lib/admin/question-readiness'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function stringParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || '' : value || ''
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
      .select('id,paper_id,question_number,question_order,marks,is_published,is_reviewed,question_image_path,markscheme_image_path,image_url,markscheme_image_url,papers(id,title,year,subject_id,is_published,subjects(id,name),exam_sessions(session_month)),question_topics(is_primary,topics(id,name,parent_topic_id,subject_id,is_active)),question_assets(asset_type,storage_path,public_url)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('papers').select('id,title,year,subject_id,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('topics').select('id,name,parent_topic_id,subject_id,is_active,sort_order').eq('is_active', true).not('subject_id', 'is', null).order('sort_order').order('name'),
  ])

  const search = stringParam(params, 'q').toLowerCase()
  const subjectFilter = stringParam(params, 'subject')
  const paperFilter = stringParam(params, 'paper')
  const topicFilter = stringParam(params, 'topic')
  const statusFilter = stringParam(params, 'status')
  const warningFilter = stringParam(params, 'warning') as WarningFilter | ''
  const topicsById = new Map<string, TopicRef>((topics ?? []).map((topic) => [topic.id, topic]))
  const orderCounts = new Map<string, number>()

  ;(questions ?? []).forEach((question) => {
    if (!question.paper_id || question.question_order === null) return
    const key = `${question.paper_id}:${question.question_order}`
    orderCounts.set(key, (orderCounts.get(key) ?? 0) + 1)
  })

  const rows: QuestionBankRow[] = (questions ?? []).map((question) => {
    const paper = Array.isArray(question.papers) ? question.papers[0] : question.papers
    const questionTopics = question.question_topics ?? []
    const paperSubjectId = relationValue<string>(paper, 'subject_id')
    const summary = topicSummary(questionTopics, paperSubjectId, topicsById)
    const warnings = questionWarnings({ question, paper, topicsById, orderCounts })
    const paperTitle = relationValue<string>(paper, 'title') || 'Missing paper'
    const year = relationValue<number>(paper, 'year')
    const session = relationValue<string>(paper?.exam_sessions, 'session_month')
    const subjectName = relationValue<string>(paper?.subjects, 'name') || 'No subject'

    return {
      id: question.id,
      paperTitle,
      paperMeta: [year, session].filter(Boolean).join(' ') || 'No year/session',
      subjectName,
      questionNumber: question.question_number ? `Q${question.question_number}` : 'No question number',
      questionOrder: question.question_order,
      marks: question.marks,
      topicSummary: summary,
      isPublished: Boolean(question.is_published),
      needsReview: warnings.length > 0,
      warnings,
    }
  })

  const filteredQuestions = rows.filter((question) => {
    const rawQuestion = (questions ?? []).find((item) => item.id === question.id)
    const paper = Array.isArray(rawQuestion?.papers) ? rawQuestion?.papers[0] : rawQuestion?.papers
    const questionTopics = rawQuestion?.question_topics ?? []
    const haystack = [question.paperTitle, question.paperMeta, question.subjectName, question.questionNumber, question.topicSummary]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (search && !haystack.includes(search)) return false
    if (subjectFilter && paper?.subject_id !== subjectFilter) return false
    if (paperFilter && paper?.id !== paperFilter) return false
    if (topicFilter && !questionTopics.some((row) => relationValue<string>(row.topics, 'id') === topicFilter || relationValue<string>(row.topics, 'parent_topic_id') === topicFilter)) return false
    if (statusFilter === 'draft' && question.isPublished) return false
    if (statusFilter === 'published' && !question.isPublished) return false
    if (statusFilter === 'needs-review' && !question.needsReview) return false
    if (warningFilter && !question.warnings.some((warning) => warningKey(warning) === warningFilter)) return false
    return true
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin</p>
          <h1 className="font-headline text-4xl text-[#00152a]">Question bank</h1>
          <p className="mt-2 font-body text-[#43474d]">Manage individual past-paper questions for topic-based practice.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/admin" className="tsm-btn-secondary">Back to Admin</Link>
          <Link href="/dashboard/admin/question-bank/from-pdf" className="tsm-btn-secondary">Create from PDF</Link>
          <Link href="/dashboard/admin/question-bank/new" className="tsm-btn-primary">Add question</Link>
        </div>
      </header>

      <AdminQuestionBankFilterForm
        initial={{ q: stringParam(params, 'q'), subject: subjectFilter, paper: paperFilter, topic: topicFilter, status: statusFilter, warning: warningFilter }}
        subjects={(subjects ?? []).map((subject) => ({ value: subject.id, label: subject.name }))}
        papers={(papers ?? []).map((paper) => ({ value: paper.id, label: `${paper.title} — ${relationValue<string>(paper.exam_sessions, 'session_month')} ${paper.year}` }))}
        topics={(topics ?? []).map((topic) => ({ value: topic.id, label: compactTopicPair(topicsById.get(topic.parent_topic_id || '')?.name, topic.name) }))}
      />

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-headline text-2xl text-[#00152a]">Questions</h2>
          <p className="font-body text-sm text-[#43474d]">{filteredQuestions.length} shown</p>
        </div>
        <QuestionBankList questions={filteredQuestions} />
      </section>
    </div>
  )
}
