import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { questionWarnings, seriousQuestionWarnings, type TopicRef } from '@/lib/admin/question-readiness'
import { PaperManager, type AdminPaperRow } from './paper-manager'

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function questionLabel(question: { question_number?: string | null; question_order?: number | null } | null | undefined) {
  if (!question) return 'None yet'
  const number = question.question_number ? `Q${question.question_number}` : 'Unnamed question'
  return question.question_order === null || question.question_order === undefined ? number : `${number} (order ${question.question_order})`
}

export default async function AdminPapersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: papers }, { data: subjects }, { data: topics }] = await Promise.all([
    supabase
      .from('papers')
      .select('id,title,year,session,paper_code,is_published,subject_id,subjects(id,name),exam_sessions(session_month),questions(id,paper_id,question_number,question_order,marks,is_published,is_reviewed,question_image_path,markscheme_image_path,image_url,markscheme_image_url,created_at,updated_at,question_topics(is_primary,topics(id,name,parent_topic_id,subject_id,is_active)),question_assets(asset_type,storage_path,public_url))')
      .order('year', { ascending: false })
      .order('title'),
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,name,parent_topic_id,subject_id,is_active,sort_order').eq('is_active', true).not('subject_id', 'is', null).order('sort_order').order('name'),
  ])

  const topicsById = new Map<string, TopicRef>((topics ?? []).map((topic) => [topic.id, topic]))
  const allQuestions = (papers ?? []).flatMap((paper) => paper.questions ?? [])
  const orderCounts = new Map<string, number>()
  allQuestions.forEach((question) => {
    if (!question.paper_id || question.question_order === null) return
    const key = `${question.paper_id}:${question.question_order}`
    orderCounts.set(key, (orderCounts.get(key) ?? 0) + 1)
  })

  const rows: AdminPaperRow[] = (papers ?? []).map((paper) => {
    const questions = paper.questions ?? []
    const questionsWithWarnings = questions.map((question) => {
      const warnings = questionWarnings({ question, paper, topicsById, orderCounts })
      return { question, warnings, seriousWarnings: seriousQuestionWarnings(warnings) }
    })
    const orderedQuestions = [...questions].filter((question) => question.question_order !== null).sort((a, b) => (b.question_order ?? 0) - (a.question_order ?? 0))
    const highestOrderQuestion = orderedQuestions[0] ?? null
    const lastWorkedQuestion = [...questions].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0] ?? null
    const orders = questions.map((question) => question.question_order).filter((order): order is number => Number.isFinite(order))
    const subject = firstRelation(paper.subjects)
    const examSession = firstRelation(paper.exam_sessions)

    return {
      id: paper.id,
      title: paper.title,
      subjectId: paper.subject_id,
      subjectName: subject?.name || 'No subject',
      year: paper.year,
      session: paper.session || examSession?.session_month || '',
      paperCode: paper.paper_code || '',
      isPublished: Boolean(paper.is_published),
      totalQuestions: questions.length,
      publishedQuestions: questions.filter((question) => question.is_published).length,
      draftQuestions: questions.filter((question) => !question.is_published).length,
      needsReviewQuestions: questionsWithWarnings.filter((item) => item.seriousWarnings.length > 0).length,
      missingMarkschemeCount: questionsWithWarnings.filter((item) => item.warnings.includes('Missing mark scheme')).length,
      missingTopicCount: questionsWithWarnings.filter((item) => item.warnings.includes('Missing topic')).length,
      missingSubtopicCount: questionsWithWarnings.filter((item) => item.warnings.includes('Missing subtopic')).length,
      duplicateOrderCount: questionsWithWarnings.filter((item) => item.warnings.includes('Duplicate order')).length,
      highestOrderLabel: questionLabel(highestOrderQuestion),
      suggestedNextOrder: orders.length ? Math.max(...orders) + 1 : 1,
      lastWorkedLabel: questionLabel(lastWorkedQuestion),
      lastWorkedTime: formatTime(lastWorkedQuestion?.updated_at || lastWorkedQuestion?.created_at),
    }
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin</p>
          <h1 className="font-headline text-4xl text-[#00152a]">Paper Manager</h1>
          <p className="mt-2 max-w-3xl font-body text-[#43474d]">Manage whole papers, review readiness, continue PDF entry, and control paper-level publishing.</p>
        </div>
        <Link href="/dashboard/admin" className="tsm-btn-secondary">Back to admin</Link>
      </header>
      <PaperManager papers={rows} subjects={(subjects ?? []).map((subject) => ({ value: subject.id, label: subject.name }))} />
    </div>
  )
}
