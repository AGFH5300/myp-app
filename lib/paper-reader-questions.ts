import { groupQuestionsForReader } from '@/lib/question-display-groups'
import { resolveQuestionAssetImages, type QuestionAssetRow } from '@/lib/question-assets'

type Asset = QuestionAssetRow & { question_id: string; asset_type: 'question' | 'markscheme' }

type SourceQuestion = {
  id: string
  question_number: string
  question_order: number | null
  marks: number | null
  image_url: string | null
  question_image_path: string | null
  markscheme_text: string | null
  markscheme_image_url: string | null
  markscheme_image_path: string | null
  display_with_question_id: string | null
}

export async function resolvePaperReaderQuestions(supabase: any, questions: SourceQuestion[]) {
  const ordered = questions.toSorted((a, b) => (a.question_order ?? Number.MAX_SAFE_INTEGER) - (b.question_order ?? Number.MAX_SAFE_INTEGER))
  const { data: assetRows } = ordered.length
    ? await supabase.from('question_assets').select('question_id,asset_type,storage_path,public_url,label,sort_order,created_at').in('question_id', ordered.map((question) => question.id)).in('asset_type', ['question', 'markscheme']).order('sort_order').order('created_at')
    : { data: [] }
  const assetsByQuestion = new Map<string, Asset[]>()
  ;((assetRows ?? []) as Asset[]).forEach((asset) => assetsByQuestion.set(asset.question_id, [...(assetsByQuestion.get(asset.question_id) ?? []), asset]))

  return groupQuestionsForReader(await Promise.all(ordered.map(async (question) => {
    const assets = assetsByQuestion.get(question.id) ?? []
    const questionImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'question'), question.question_image_path || question.image_url)
    const markschemeImages = await resolveQuestionAssetImages(supabase, assets.filter((asset) => asset.asset_type === 'markscheme'), question.markscheme_image_path || question.markscheme_image_url)
    return {
      id: question.id,
      questionNumber: question.question_number,
      questionOrder: question.question_order,
      marks: question.marks,
      questionImages: questionImages.map((image, index) => ({ url: image.url, alt: image.label || `Question ${question.question_number} image ${index + 1}` })),
      markschemeImages: markschemeImages.map((image, index) => ({ url: image.url, alt: image.label || `Question ${question.question_number} mark scheme image ${index + 1}` })),
      markschemeText: question.markscheme_text,
      displayWithQuestionId: question.display_with_question_id,
    }
  })))
}
