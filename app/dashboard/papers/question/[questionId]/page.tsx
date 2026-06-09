import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveQuestionAssetImages, type QuestionAssetRow } from '@/lib/question-assets'
import { QuestionImageViewer } from '@/components/question-image-viewer'
import { PendingSubmitButton } from '@/components/pending-submit-button'

type PaperRelation<T> = T | T[] | null

type Topic = { id: string; name: string; parent_topic_id: string | null }
type QuestionTopic = { is_primary?: boolean | null; topics?: PaperRelation<Topic> }

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

async function saveBookmark(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/papers')

  await supabase.from('bookmarks').upsert({
    student_id: user.id,
    question_id: String(formData.get('question_id')),
    paper_id: String(formData.get('paper_id')),
  })
}

export default async function DashboardPaperQuestionPage({ params, searchParams }: { params: Promise<{ questionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { questionId } = await params
  const query = await searchParams
  const backHref = typeof query.back === 'string' && query.back.startsWith('/dashboard/papers') ? query.back : '/dashboard/papers'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: question } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,papers!inner(id,title,year,level,is_published,markscheme_url,subjects(id,name),exam_sessions(session_month,session_year)),question_topics(is_primary,topics(id,name,parent_topic_id))')
    .eq('id', questionId)
    .eq('is_published', true)
    .eq('papers.is_published', true)
    .maybeSingle()

  if (!question) notFound()

  if (user) {
    await supabase.from('recent_question_views').insert({ student_id: user.id, question_id: questionId })
  }

  const { data: assetRows } = await supabase
    .from('question_assets')
    .select('asset_type,storage_path,public_url,label,sort_order,created_at')
    .eq('question_id', question.id)
    .in('asset_type', ['question', 'markscheme'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  type QuestionAssetWithType = QuestionAssetRow & { asset_type: 'question' | 'markscheme' }
  const assets = (assetRows ?? []) as QuestionAssetWithType[]
  const questionImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'question'), question.question_image_path || question.image_url)
  const markschemeImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'markscheme'), question.markscheme_image_path || question.markscheme_image_url)
  const paper = firstRelation(question.papers)
  if (!paper) notFound()

  const subject = firstRelation(paper.subjects)
  const primaryTopic = firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.find((row) => row.is_primary)?.topics) ?? firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.[0]?.topics)
  const secondaryTopics = ((question.question_topics ?? []) as QuestionTopic[])
    .map((row) => firstRelation(row.topics))
    .filter((topic): topic is Topic => Boolean(topic?.id && topic.name && topic.id !== primaryTopic?.id))

  return (
    <div className="max-w-4xl space-y-8">
      <Link href={backHref} className="font-body text-sm text-[#735b2b] underline">← Back to Papers</Link>

      <header className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <p className="font-body text-sm text-[#43474d]">{subject?.name || 'Subject'} · {paper.title} · {firstRelation(paper.exam_sessions)?.session_month} {paper.year}</p>
        <h1 className="mt-2 font-headline text-4xl text-[#00152a]">Question {question.question_number}</h1>
        <p className="mt-3 font-body text-[#43474d]">{question.marks ?? '—'} marks{primaryTopic?.name ? ` · ${primaryTopic.name}` : ''}</p>
        {secondaryTopics.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {secondaryTopics.map((topic) => <span key={topic.id} className="rounded-full bg-[#f5f3ee] px-2 py-1 font-body text-xs text-[#735b2b]">{topic.name}</span>)}
          </div>
        ) : null}
      </header>

        <div className="mt-5 max-w-4xl">
          {questionImages.length ? (
            <QuestionImageViewer labelPrefix="Question image" images={questionImages.map((image, imageIndex) => ({ url: image.url, alt: image.label || `Question ${question.question_number} image ${imageIndex + 1}` }))} />
          ) : (
            <p className="font-body whitespace-pre-wrap text-[#00152a]">{question.prompt_text}</p>
          )}
        </div>

      <details className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Show mark scheme</summary>
        <div className="mt-5 max-w-4xl">
          {markschemeImages.length ? (
            <QuestionImageViewer labelPrefix="Mark scheme image" images={markschemeImages.map((image, imageIndex) => ({ url: image.url, alt: image.label || `Question ${question.question_number} mark scheme image ${imageIndex + 1}` }))} />
          ) : question.markscheme_text ? (
            <p className="font-body whitespace-pre-wrap text-[#43474d]">{question.markscheme_text}</p>
          ) : (
            <p className="font-body text-[#43474d]">No mark scheme has been added for this question yet.</p>
          )}
        </div>
      </details>

      {user ? (
        <form action={saveBookmark}>
          <input type="hidden" name="question_id" value={question.id} />
          <input type="hidden" name="paper_id" value={paper.id} />
          <PendingSubmitButton className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60" label="Bookmark question" pendingLabel="Bookmarking..." />
        </form>
      ) : null}
    </div>
  )
}
