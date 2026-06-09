import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

type TopicRow = { topic_id: string; topics?: { id?: string | null; name?: string | null; parent_topic_id?: string | null; sort_order?: number | null } | null }

export default async function PracticeSubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: subjectParam } = await params
  const subjectName = decodeURIComponent(subjectParam)
  const supabase = await createClient()

  const { data: subject } = await supabase.from('subjects').select('id,name').eq('name', subjectName).maybeSingle()
  if (!subject) notFound()

  const [{ data: topicRows }, { data: allTopics }] = await Promise.all([
    supabase
      .from('question_topics')
      .select('topic_id,topics(id,name,parent_topic_id,sort_order),questions!inner(is_published,papers!inner(is_published,subject_id))')
      .eq('questions.is_published', true)
      .eq('questions.papers.is_published', true)
      .eq('questions.papers.subject_id', subject.id),
    supabase.from('topics').select('id,name,parent_topic_id,sort_order').eq('subject_id', subject.id).eq('is_active', true),
  ])

  const topicLookup = new Map((allTopics ?? []).map((topic) => [topic.id, topic]))
  const topicCounts = new Map<string, { id: string; name: string; count: number; sort: number }>()
  ;((topicRows ?? []) as unknown as TopicRow[]).forEach((row) => {
    const topic = row.topics
    if (!topic?.id || !topic.name) return
    const parent = topic.parent_topic_id ? topicLookup.get(topic.parent_topic_id) : null
    const group = parent ?? topic
    if (!group.id || !group.name) return
    const current = topicCounts.get(group.id) ?? { id: group.id, name: group.name, count: 0, sort: group.sort_order ?? 0 }
    current.count += 1
    topicCounts.set(group.id, current)
  })
  const topics = Array.from(topicCounts.values()).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
      <main className="tsm-shell py-12">
        <Link href="/practice" className="font-body text-sm text-[#735b2b] underline">← Subjects</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{subject.name}</h1>
        <p className="mt-3 font-body text-[#43474d]">Choose a topic group to practice.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/practice/${encodeURIComponent(subject.name)}/${topic.id}`} className="cursor-pointer rounded-md border border-[#c3c6ce66] bg-white p-6 transition hover:border-[#735b2b] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30">
              <h2 className="font-headline text-3xl text-[#00152a]">{topic.name}</h2>
              <p className="mt-2 font-body text-sm text-[#43474d]">{topic.count} question{topic.count === 1 ? '' : 's'}</p>
            </Link>
          ))}
          {!topics.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published topics yet.</p> : null}
        </div>
      </main>
    </div>
  )
}
