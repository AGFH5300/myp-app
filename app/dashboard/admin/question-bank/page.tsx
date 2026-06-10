import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminQuestionBankFilterForm } from './filter-form'
import { QuestionBankList, type QuestionBankRow } from './question-bank-list'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type WarningFilter = 'missing-markscheme' | 'missing-topic' | 'missing-subtopic' | 'missing-question-image'

function relationName(relation: unknown, key: 'id' | 'name' | 'title' | 'session_month' | 'parent_topic_id') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null> | null | undefined)?.[key]
}

function relationNumber(relation: unknown, key: 'year') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, number | null> | null | undefined)?.[key]
}

function relationBoolean(relation: unknown, key: 'is_published') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, boolean | null> | null | undefined)?.[key]
}

function stringParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function hasAsset(question: { question_assets?: { asset_type: string | null; storage_path: string | null; public_url: string | null }[] | null }, type: 'question' | 'markscheme') {
  return question.question_assets?.some((asset) => asset.asset_type === type && (asset.storage_path || asset.public_url)) ?? false
}

function warningKey(warning: string): WarningFilter | null {
  if (warning === 'Missing mark scheme image') return 'missing-markscheme'
  if (warning === 'Missing topic') return 'missing-topic'
  if (warning === 'Missing subtopic') return 'missing-subtopic'
  if (warning === 'Missing question image') return 'missing-question-image'
  return null
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
      .select('id,paper_id,question_number,question_order,marks,is_published,is_reviewed,question_image_path,markscheme_image_path,image_url,markscheme_image_url,papers(id,title,year,subject_id,is_published,subjects(id,name),exam_sessions(session_month)),question_topics(is_primary,topics(id,name,parent_topic_id)),question_assets(asset_type,storage_path,public_url)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('papers').select('id,title,year,subject_id,subjects(id,name),exam_sessions(session_month)').order('year', { ascending: false }).order('title'),
    supabase.from('topics').select('id,name,parent_topic_id').order('name'),
  ])

  const search = stringParam(params, 'q').toLowerCase()
  const subjectFilter = stringParam(params, 'subject')
  const paperFilter = stringParam(params, 'paper')
  const topicFilter = stringParam(params, 'topic')
  const statusFilter = stringParam(params, 'status')
  const warningFilter = stringParam(params, 'warning') as WarningFilter | ''
  const topicNames = new Map((topics ?? []).map((topic) => [topic.id, topic.name]))
  const orderCounts = new Map<string, number>()

  ;(questions ?? []).forEach((question) => {
    if (!question.paper_id || question.question_order === null) return
    const key = `${question.paper_id}:${question.question_order}`
    orderCounts.set(key, (orderCounts.get(key) ?? 0) + 1)
  })

  const rows: QuestionBankRow[] = (questions ?? []).map((question) => {
    const paper = Array.isArray(question.papers) ? question.papers[0] : question.papers
    const questionTopics = question.question_topics ?? []
    const primary = questionTopics.find((row) => row.is_primary) ?? questionTopics[0]
    const primaryTopic = Array.isArray(primary?.topics) ? primary?.topics[0] : primary?.topics
    const hasTopicGroup = questionTopics.some((row) => Boolean(relationName(row.topics, 'id')))
    const hasSubtopic = questionTopics.some((row) => Boolean(relationName(row.topics, 'parent_topic_id')))
    const parentName = primaryTopic?.parent_topic_id ? topicNames.get(primaryTopic.parent_topic_id) : null
    const hasQuestionImage = Boolean(question.question_image_path || question.image_url || hasAsset(question, 'question'))
    const hasMarkschemeImage = Boolean(question.markscheme_image_path || question.markscheme_image_url || hasAsset(question, 'markscheme'))
    const orderKey = question.paper_id && question.question_order !== null ? `${question.paper_id}:${question.question_order}` : ''
    const warnings = [
      !hasQuestionImage ? 'Missing question image' : null,
      !hasMarkschemeImage ? 'Missing mark scheme image' : null,
      !hasTopicGroup ? 'Missing topic' : null,
      hasTopicGroup && !hasSubtopic ? 'Missing subtopic' : null,
      !question.question_number ? 'Missing question number' : null,
      question.marks === null ? 'Missing marks' : null,
      orderKey && (orderCounts.get(orderKey) ?? 0) > 1 ? 'Duplicate order' : null,
      !paper ? 'Missing paper' : null,
      paper && relationBoolean(paper, 'is_published') === false ? 'Paper not published' : null,
    ].filter((warning): warning is string => Boolean(warning))
    const paperTitle = relationName(paper, 'title') || 'Missing paper'
    const year = relationNumber(paper, 'year')
    const session = relationName(paper?.exam_sessions, 'session_month')
    const subjectName = relationName(paper?.subjects, 'name') || 'No subject'

    return {
      id: question.id,
      paperTitle,
      paperMeta: [year, session].filter(Boolean).join(' ') || 'No year/session',
      subjectName,
      questionNumber: question.question_number ? `Q${question.question_number}` : 'No question number',
      questionOrder: question.question_order,
      marks: question.marks,
      topicSummary: parentName ? `${parentName} → ${primaryTopic?.name || 'No subtopic'}` : relationName(primary?.topics, 'name') || '',
      isPublished: Boolean(question.is_published),
      needsReview: !question.is_reviewed || warnings.length > 0,
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
    if (topicFilter && !questionTopics.some((row) => relationName(row.topics, 'id') === topicFilter || (row.topics && relationName(row.topics, 'parent_topic_id') === topicFilter))) return false
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
        papers={(papers ?? []).map((paper) => ({ value: paper.id, label: `${paper.title} — ${relationName(paper.exam_sessions, 'session_month')} ${paper.year}` }))}
        topics={(topics ?? []).map((topic) => ({ value: topic.id, label: topic.name }))}
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
