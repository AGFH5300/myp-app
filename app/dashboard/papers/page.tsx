import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveQuestionAssetUrl } from '@/lib/question-assets'
import { PapersFilterForm } from '@/components/papers-filter-form'

type PaperRelation<T> = T | T[] | null

type PaperOption = {
  id: string
  title: string
  year: number | null
  subject_id: string | null
  subjects?: PaperRelation<{ id?: string | null; name?: string | null }>
  exam_sessions?: PaperRelation<{ session_month?: string | null; session_year?: number | null }>
}

type Topic = { id: string; name: string; subject_id: string | null; parent_topic_id: string | null; sort_order: number | null }
type QuestionTopic = { is_primary?: boolean | null; topics?: Topic | Topic[] | null }
type QuestionRow = {
  id: string
  paper_id: string
  question_number: string
  question_order: number | null
  marks: number | null
  image_url: string | null
  question_image_path: string | null
  papers?: PaperRelation<PaperOption>
  question_topics?: QuestionTopic[] | null
}
type PreviewAssetRow = { question_id: string; storage_path: string | null; public_url: string | null }

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

function paperLabel(paper: PaperOption) {
  const session = firstRelation(paper.exam_sessions)?.session_month
  return `${paper.title}${session ? ` — ${session}` : ''}${paper.year ? ` ${paper.year}` : ''}`
}

function topicName(topic: Topic | Topic[] | null | undefined) {
  return firstRelation(topic)?.name || ''
}

export default async function PapersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const subject = typeof params.subject === 'string' ? params.subject : ''
  const paper = typeof params.paper === 'string' ? params.paper : ''
  const topicGroup = typeof params.topicGroup === 'string' ? params.topicGroup : ''
  const subtopic = typeof params.subtopic === 'string' ? params.subtopic : ''
  const search = typeof params.q === 'string' ? params.q.trim() : ''
  const currentQuery = new URLSearchParams()
  if (subject) currentQuery.set('subject', subject)
  if (paper) currentQuery.set('paper', paper)
  if (topicGroup) currentQuery.set('topicGroup', topicGroup)
  if (subtopic) currentQuery.set('subtopic', subtopic)
  if (search) currentQuery.set('q', search)
  const currentBackHref = `/dashboard/papers${currentQuery.toString() ? `?${currentQuery.toString()}` : ''}`

  const supabase = await createClient()

  let questionsQuery = supabase
    .from('questions')
    .select('id,paper_id,question_number,question_order,marks,image_url,question_image_path,papers!inner(id,title,year,subject_id,is_published,subjects(id,name),exam_sessions(session_month,session_year)),question_topics(is_primary,topics(id,name,subject_id,parent_topic_id,sort_order))')
    .eq('is_published', true)
    .eq('papers.is_published', true)

  if (subject) questionsQuery = questionsQuery.eq('papers.subject_id', subject)
  if (paper) questionsQuery = questionsQuery.eq('paper_id', paper)

  const [{ data: questionRows }, { data: subjects }, { data: papers }, { data: topics }] = await Promise.all([
    questionsQuery,
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('papers').select('id,title,year,subject_id,subjects(id,name),exam_sessions(session_month,session_year)').eq('is_published', true).order('year', { ascending: false }).order('title'),
    supabase.from('topics').select('id,name,subject_id,parent_topic_id,sort_order').eq('is_active', true).order('sort_order').order('name'),
  ])

  const questions = ((questionRows ?? []) as unknown as QuestionRow[])
    .filter((question) => {
      const paperRow = firstRelation(question.papers)
      const haystack = `${question.question_number} ${paperRow?.title ?? ''} ${paperRow?.year ?? ''}`.toLowerCase()
      const matchesSearch = search ? haystack.includes(search.toLowerCase()) : true
      const matchesSubtopic = subtopic ? question.question_topics?.some((row) => firstRelation(row.topics)?.id === subtopic) : true
      const matchesTopicGroup = topicGroup ? question.question_topics?.some((row) => {
        const currentTopic = firstRelation(row.topics)
        return currentTopic?.id === topicGroup || currentTopic?.parent_topic_id === topicGroup
      }) : true
      return matchesSearch && matchesSubtopic && matchesTopicGroup
    })
    .sort((a, b) => {
      const aPaper = firstRelation(a.papers)
      const bPaper = firstRelation(b.papers)
      return (bPaper?.year ?? 0) - (aPaper?.year ?? 0) || (aPaper?.title ?? '').localeCompare(bPaper?.title ?? '') || (a.question_order ?? 9999) - (b.question_order ?? 9999) || a.question_number.localeCompare(b.question_number)
    })

  let previewAssets: PreviewAssetRow[] = []
  if (questions.length) {
    const { data: assetRows } = await supabase
      .from('question_assets')
      .select('question_id,storage_path,public_url,sort_order,created_at')
      .in('question_id', questions.map((question) => question.id))
      .eq('asset_type', 'question')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    previewAssets = (assetRows ?? []) as PreviewAssetRow[]
  }

  const firstPreviewAssetByQuestion = new Map<string, PreviewAssetRow>()
  previewAssets.forEach((asset) => {
    if (!firstPreviewAssetByQuestion.has(asset.question_id)) firstPreviewAssetByQuestion.set(asset.question_id, asset)
  })

  const previewUrls = new Map<string, string | null>()
  for (const question of questions) {
    const firstAsset = firstPreviewAssetByQuestion.get(question.id)
    previewUrls.set(question.id, await resolveQuestionAssetUrl(supabase, firstAsset ? firstAsset.storage_path || firstAsset.public_url : question.question_image_path || question.image_url))
  }

  const topicRows = (topics ?? []) as Topic[]
  const topicGroups = topicRows.filter((topic) => !topic.parent_topic_id)
  const subtopics = topicRows.filter((topic) => topic.parent_topic_id)

  return (
    <div className="space-y-8">
      <header className="rounded-md border border-[#c3c6ce66] bg-white p-8">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Papers & practice</p>
        <h1 className="mt-3 font-headline text-4xl text-[#00152a]">Find past paper questions.</h1>
        <p className="mt-2 font-body text-[#43474d]">Filter by subject, paper, topic group, or subtopic, then open a question without leaving your dashboard.</p>
      </header>

      <PapersFilterForm
        initial={{ subject, paper, topicGroup, subtopic, q: search }}
        subjects={(subjects ?? []).map((item) => ({ value: item.id, label: item.name }))}
        papers={((papers ?? []) as PaperOption[]).map((item) => ({ value: item.id, label: paperLabel(item), helper: firstRelation(item.subjects)?.name || undefined, subjectId: item.subject_id }))}
        topicGroups={topicGroups.map((topic) => ({ value: topic.id, label: topic.name, subjectId: topic.subject_id }))}
        subtopics={subtopics.map((topic) => ({ value: topic.id, label: topic.name, subjectId: topic.subject_id, parentTopicId: topic.parent_topic_id }))}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-headline text-2xl text-[#00152a]">Question cards</h2>
            <p className="font-body text-sm text-[#43474d]">{questions.length} published question{questions.length === 1 ? '' : 's'} match your filters.</p>
          </div>
        </div>

        {!questions.length ? (
          <div className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published questions match these filters. Try a broader subject or topic group.</div>
        ) : null}

        <div className="grid gap-4">
          {questions.map((question) => {
            const paperRow = firstRelation(question.papers)
            const subjectName = firstRelation(paperRow?.subjects)?.name
            const session = firstRelation(paperRow?.exam_sessions)?.session_month
            const primaryTopic = question.question_topics?.find((row) => row.is_primary)?.topics ?? question.question_topics?.[0]?.topics
            const secondaryTopics = (question.question_topics ?? [])
              .map((row) => firstRelation(row.topics))
              .filter((item): item is Topic => Boolean(item?.id && item.name && item.id !== firstRelation(primaryTopic)?.id))
              .slice(0, 3)
            const previewUrl = previewUrls.get(question.id)

            return (
              <article key={question.id} className="rounded-md border border-[#c3c6ce66] bg-white p-5 transition hover:border-[#735b2b] hover:shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-[#43474d]">{subjectName} · {paperRow?.title} · {session ? `${session} ` : ''}{paperRow?.year}</p>
                    <h3 className="mt-1 font-headline text-2xl text-[#00152a]">Question {question.question_number}</h3>
                    <p className="mt-1 font-body text-sm text-[#43474d]">{question.marks ?? '—'} marks{topicName(primaryTopic) ? ` · ${topicName(primaryTopic)}` : ''}</p>
                    {secondaryTopics.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {secondaryTopics.map((topic) => <span key={topic.id} className="rounded-full bg-[#f5f3ee] px-2 py-1 font-body text-xs text-[#735b2b]">{topic.name}</span>)}
                      </div>
                    ) : null}
                  </div>
                  {previewUrl ? <Image src={previewUrl} alt={`Question ${question.question_number} preview`} width={72} height={72} unoptimized className="h-16 w-16 shrink-0 rounded-sm border border-[#c3c6ce66] bg-white object-cover" /> : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href={`/dashboard/papers/question/${question.id}?back=${encodeURIComponent(currentBackHref)}`} className="tsm-btn-primary">Open question</Link>
                  {paperRow?.id ? <Link href={`/dashboard/papers/${paperRow.id}`} className="tsm-btn-secondary">Open full paper</Link> : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
