import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PracticeSession } from "@/components/practice-session"

export default async function PracticePage({
  params,
}: {
  params: Promise<{ paperId: string }>
}) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: paper } = await supabase
    .from("papers")
    .select("*, subjects(name, color)")
    .eq("id", paperId)
    .single()

  if (!paper) {
    notFound()
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("paper_id", paperId)
    .order("order_index")

  // Check for existing in-progress attempt
  const { data: existingAttempt } = await supabase
    .from("attempts")
    .select("*, question_responses(*)")
    .eq("user_id", user.id)
    .eq("paper_id", paperId)
    .eq("status", "in_progress")
    .single()

  let attemptId = existingAttempt?.id

  // Create new attempt if none exists
  if (!attemptId) {
    const { data: newAttempt } = await supabase
      .from("attempts")
      .insert({
        user_id: user.id,
        paper_id: paperId,
        max_score: questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || 0,
      })
      .select()
      .single()

    attemptId = newAttempt?.id
  }

  if (!attemptId) {
    throw new Error("Failed to create attempt")
  }

  const existingResponses = existingAttempt?.question_responses || []

  return (
    <PracticeSession
      paper={paper}
      questions={questions || []}
      attemptId={attemptId}
      existingResponses={existingResponses}
    />
  )
}
