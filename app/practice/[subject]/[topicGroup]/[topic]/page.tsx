import { redirect } from 'next/navigation'

export default async function PracticeTopicRedirectPage({ params }: { params: Promise<{ topicGroup: string; topic: string }> }) {
  const { topicGroup, topic } = await params
  redirect(`/dashboard/papers?topicGroup=${encodeURIComponent(topicGroup)}&subtopic=${encodeURIComponent(topic)}`)
}
