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

export default async function AdminPaperPreviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: paper } = await supabase
    .from('papers')
    .select('id,title,year,session,paper_code,is_published,markscheme_url,subjects(id,name),exam_sessions(session_month,session_year),questions(id,question_number,question_order,prompt_text,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,is_published,question_topics(is_primary,topics(id,name,parent_topic_id)))')
    .eq('id', paperId)
    .maybeSingle()

  if (!paper) notFound()

  const questions = (paper.questions ?? []).toSorted((a, b) => (a.question_order ?? Number.MAX_SAFE_INTEGER) - (b.question_order ?? Number.MAX_SAFE_INTEGER) || (a.question_number || '').localeCompare(b.question_number || ''))
  const { data: assetRows } = questions.length
    ? await supabase
      .from('question_assets')
      .select('question_id,asset_type,storage_path,public_url,label,sort_order,created_at')
      .in('question_id', questions.map((question) => question.id))
      .in('asset_type', ['question', 'markscheme'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    : { data: [] }

  type QuestionAssetWithType = QuestionAssetRow & { question_id: string; asset_type: 'question' | 'markscheme' }
  const assetsByQuestion = new Map<string, QuestionAssetWithType[]>()
  ;((assetRows ?? []) as QuestionAssetWithType[]).forEach((asset) => {
    assetsByQuestion.set(asset.question_id, [...(assetsByQuestion.get(asset.question_id) ?? []), asset])
  })

  const questionImagesById = new Map(
    await Promise.all(
      questions.map(async (question) => {
        const assets = assetsByQuestion.get(question.id) ?? []
        const images = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'question'), question.question_image_path || question.image_url)
        return [question.id, images] as const
      }),
    ),
  )

  const subject = firstRelation(paper.subjects)
  const session = paper.session || firstRelation(paper.exam_sessions)?.session_month

  return (
    <div className="max-w-5xl space-y-8">
      <Link href="/dashboard/admin/papers" className="tsm-btn-secondary inline-flex w-fit items-center gap-2">← Back to Paper Manager</Link>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 font-body text-sm font-semibold text-blue-900">
        Admin preview — students only see this paper when the paper is published and individual questions are published.
      </div>

      <header className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-2 py-1 font-body text-xs font-semibold ${paper.is_published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{paper.is_published ? 'Published paper' : 'Draft paper'}</span>
          {paper.paper_code ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-body text-xs font-semibold text-blue-800">{paper.paper_code}</span> : null}
        </div>
        <h1 className="mt-3 font-headline text-4xl text-[#00152a]">{paper.title}</h1>
        <p className="mt-2 font-body text-[#43474d]">{subject?.name || 'Subject'} · {[session, paper.year].filter(Boolean).join(' ')}</p>
      </header>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Questions</h2>
        <div className="mt-4 space-y-6">
          {questions.map((question) => {
            const primaryTopic = firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.find((row) => row.is_primary)?.topics) ?? firstRelation((question.question_topics as QuestionTopic[] | null | undefined)?.[0]?.topics)
            const questionImages = questionImagesById.get(question.id) ?? []
            return (
              <article key={question.id} className="rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-headline text-2xl text-[#00152a]">Question {question.question_number || '—'}</p>
                    <p className="font-body text-sm text-[#43474d]">{question.marks ?? '—'} marks{primaryTopic?.name ? ` · ${primaryTopic.name}` : ''}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 font-body text-xs font-semibold ${question.is_published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{question.is_published ? 'Published question' : 'Draft question'}</span>
                </div>
                <div className="mt-4">
                  {questionImages.length ? (
                    <QuestionImageViewer labelPrefix="Question image" images={questionImages.map((image, imageIndex) => ({ url: image.url, alt: image.label || `Question ${question.question_number} image ${imageIndex + 1}` }))} />
                  ) : (
                    <p className="font-body whitespace-pre-wrap text-[#00152a]">{question.prompt_text}</p>
                  )}
                </div>
              </article>
            )
          })}
          {!questions.length ? <p className="font-body text-sm text-[#43474d]">No questions have been added to this paper yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
