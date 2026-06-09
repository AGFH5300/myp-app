import { redirect } from 'next/navigation'

export default async function PracticeQuestionRedirectPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params
  redirect(`/dashboard/papers/question/${questionId}`)
}
