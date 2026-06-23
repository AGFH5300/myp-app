import { notFound, redirect } from 'next/navigation'
import { FullPaperReader, type FullPaperReaderQuestion } from '@/components/full-paper-reader'
import { resolveQuestionAssetImages, type QuestionAssetRow } from '@/lib/question-assets'
import { createClient } from '@/lib/supabase/server'

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

type QuestionAssetWithType = QuestionAssetRow & { question_id: string; asset_type: 'question' | 'markscheme' }

export default async function AdminPaperPreviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: paper } = await supabase
    .from('papers')
    .select('id,title,year,session,paper_code,is_published,subjects(id,name),exam_sessions(session_month,session_year),questions(id,question_number,question_order,prompt_text,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,is_published)')
    .eq('id', paperId)
    .maybeSingle()

  if (!paper) notFound()

  const questions = (paper.questions ?? []).toSorted((a, b) => (a.question_order ?? Number.MAX_SAFE_INTEGER) - (b.question_order ?? Number.MAX_SAFE_INTEGER))
  const { data: assetRows } = questions.length
    ? await supabase
      .from('question_assets')
      .select('question_id,asset_type,storage_path,public_url,label,sort_order,created_at')
      .in('question_id', questions.map((question) => question.id))
      .in('asset_type', ['question', 'markscheme'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    : { data: [] }

  const assetsByQuestion = new Map<string, QuestionAssetWithType[]>()
  ;((assetRows ?? []) as QuestionAssetWithType[]).forEach((asset) => {
    assetsByQuestion.set(asset.question_id, [...(assetsByQuestion.get(asset.question_id) ?? []), asset])
  })

  const readerQuestions: FullPaperReaderQuestion[] = await Promise.all(questions.map(async (question) => {
    const assets = assetsByQuestion.get(question.id) ?? []
    const questionImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'question'), question.question_image_path || question.image_url)
    const markschemeImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'markscheme'), question.markscheme_image_path || question.markscheme_image_url)
    return {
      id: question.id,
      questionNumber: question.question_number || '—',
      questionOrder: question.question_order,
      marks: question.marks,
      isPublished: question.is_published,
      promptText: question.prompt_text,
      questionImages: questionImages.map((image, index) => ({ url: image.url, alt: image.label || `Question ${question.question_number} image ${index + 1}` })),
      markschemeImages: markschemeImages.map((image, index) => ({ url: image.url, alt: image.label || `Question ${question.question_number} mark scheme image ${index + 1}` })),
      markschemeText: question.markscheme_text,
    }
  }))

  return (
    <FullPaperReader
      adminPreview
      paper={{
        id: paper.id,
        title: paper.title,
        subjectName: firstRelation(paper.subjects)?.name,
        year: paper.year,
        session: paper.session || firstRelation(paper.exam_sessions)?.session_month,
        paperCode: paper.paper_code,
      }}
      questions={readerQuestions}
      backHref="/dashboard/admin/papers"
    />
  )
}
