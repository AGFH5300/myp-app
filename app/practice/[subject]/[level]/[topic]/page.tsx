import { redirect } from 'next/navigation'

export default async function PracticeTopicRedirectPage({ params }: { params: Promise<{ level: string; topic: string }> }) {
  const { level, topic } = await params
  redirect(`/dashboard/papers?topicGroup=${encodeURIComponent(level)}&subtopic=${encodeURIComponent(topic)}`)
}
