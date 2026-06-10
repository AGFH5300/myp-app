import { redirect } from 'next/navigation'

export default async function PracticeTopicGroupRedirectPage({ params }: { params: Promise<{ topicGroup: string }> }) {
  const { topicGroup } = await params
  redirect(`/dashboard/papers?topicGroup=${encodeURIComponent(topicGroup)}`)
}
