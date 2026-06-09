import { redirect } from 'next/navigation'

export default async function PracticeTopicGroupRedirectPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  redirect(`/dashboard/papers?topicGroup=${encodeURIComponent(level)}`)
}
