import { notFound } from 'next/navigation'
import { FullPaperReader, type FullPaperReaderQuestion } from '@/components/full-paper-reader'
import { resolvePaperReaderQuestions } from '@/lib/paper-reader-questions'
import { createClient } from '@/lib/supabase/server'

const first = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value

type GroupedPaperReaderProps = {
  paperId: string
  backHref: string
  adminPreview?: boolean
  includeUnpublishedQuestions?: boolean
}

export async function GroupedPaperReader({ paperId, backHref, adminPreview = false, includeUnpublishedQuestions = false }: GroupedPaperReaderProps) {
  const supabase = await createClient()
  const paperQuery = supabase.from('papers').select('id,title,year,session,paper_code,subjects(name),exam_sessions(session_month,session_year)').eq('id', paperId)
  if (!adminPreview) paperQuery.eq('is_published', true)
  const { data: paper } = await paperQuery.maybeSingle()
  if (!paper) notFound()

  let questionQuery = supabase.from('questions').select('id,question_number,question_order,image_url,question_image_path,markscheme_text,markscheme_image_url,markscheme_image_path,marks,display_with_question_id').eq('paper_id', paperId).order('question_order', { ascending: true, nullsFirst: false })
  if (!includeUnpublishedQuestions) questionQuery = questionQuery.eq('is_published', true)
  const { data: questions } = await questionQuery
  const resolvedQuestions = await resolvePaperReaderQuestions(supabase, questions ?? [])
  const readerQuestions: FullPaperReaderQuestion[] = adminPreview ? resolvedQuestions : resolvedQuestions.filter((question) => question.questionImages.length > 0)

  return <FullPaperReader paper={{ id: paper.id, title: paper.title, subjectName: first(paper.subjects)?.name, year: paper.year, session: paper.session || first(paper.exam_sessions)?.session_month, paperCode: paper.paper_code }} questions={readerQuestions} backHref={backHref} adminPreview={adminPreview} />
}
