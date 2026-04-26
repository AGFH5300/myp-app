import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PracticeSession } from '@/components/practice-session'

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

  return <PracticeSession paper={paper} questions={questions || []} studentId={user.id} bookmarkedQuestionIds={bookmarks?.map((b) => b.question_id) ?? []} />
}
