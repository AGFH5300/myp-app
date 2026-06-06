import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PracticeSession } from '@/components/practice-session'

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

export default async function PracticePage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: paper } = await supabase
    .from('papers')
    .select('id,title,subjects(name)')
    .eq('id', paperId)
    .maybeSingle()

  if (!paper) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,context_image_url,image_url,secondary_image_url,answer_mode,options_json,marks,is_published')
    .eq('paper_id', paperId)
    .order('question_number')

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('question_id')
    .eq('student_id', user.id)

  const sessionPaper = { ...paper, subjects: firstRelation(paper.subjects) ?? null }

  return <PracticeSession paper={sessionPaper} questions={questions || []} studentId={user.id} bookmarkedQuestionIds={bookmarks?.map((b) => b.question_id) ?? []} />
}
