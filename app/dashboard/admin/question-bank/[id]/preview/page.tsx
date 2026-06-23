import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { QuestionImageViewer } from '@/components/question-image-viewer'
import { resolveQuestionAssetImages, type QuestionAssetRow } from '@/lib/question-assets'
import { createClient } from '@/lib/supabase/server'

type PaperRelation<T> = T | T[] | null

type Topic = { id: string; name: string; parent_topic_id: string | null }
type QuestionTopic = { is_primary?: boolean | null; topics?: PaperRelation<Topic> }

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

export default async function AdminQuestionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: question } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,is_published,papers(id,title,year,is_published,markscheme_url,subjects(id,name),exam_sessions(session_month,session_year)),question_topics(is_primary,topics(id,name,parent_topic_id))')
    .eq('id', id)
    .maybeSingle()

  if (!question) notFound()

  const { data: assetRows } = await supabase
    .from('question_assets')
    .select('asset_type,storage_path,public_url,label,sort_order,created_at')
    .eq('question_id', question.id)
    .in('asset_type', ['question', 'markscheme'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  type QuestionAssetWithType = QuestionAssetRow & { asset_type: 'question' | 'markscheme' }
  const assets = (assetRows ?? []) as QuestionAssetWithType[]
  const [questionImages, markschemeImages] = await Promise.all([
    resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'question'), question.question_image_path || question.image_url),
    resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'markscheme'), question.markscheme_image_path || question.markscheme_image_url),
  ])
  const paper = firstRelation(question.papers)
  if (!paper) notFound()

  const subject = firstRelation(paper.subjects)
  const primaryTopic = firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.find((row) => row.is_primary)?.topics) ?? firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.[0]?.topics)
  const secondaryTopics = ((question.question_topics ?? []) as QuestionTopic[])
    .map((row) => firstRelation(row.topics))
    .filter((topic): topic is Topic => Boolean(topic?.id && topic.name && topic.id !== primaryTopic?.id))

  return (
    <div className="max-w-4xl space-y-8">
      <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary inline-flex w-fit items-center gap-2">← Back to Question bank</Link>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 font-body text-sm font-semibold text-blue-900">
        Admin preview — students only see published questions.
      </div>

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
    </div>
  )
}
