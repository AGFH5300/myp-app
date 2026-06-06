import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

type TopicRow = { topic_id: string; topics?: { name?: string | null } | null; questions?: { papers?: { level?: string | null; subjects?: { name?: string | null } | null } | null } | null }

export default async function PracticeLevelPage({ params }: { params: Promise<{ subject: string; level: string }> }) {
  const { subject: subjectParam, level: levelParam } = await params
  const subjectName = decodeURIComponent(subjectParam)
  const level = decodeURIComponent(levelParam)
  const supabase = await createClient()

  const { data: subject } = await supabase.from('subjects').select('id,name').eq('name', subjectName).maybeSingle()
  if (!subject) notFound()

  const { data: topicRows } = await supabase
    .from('question_topics')
    .select('topic_id,topics(name),questions!inner(is_published,papers!inner(is_published,level,subject_id,subjects(name)))')
    .eq('questions.is_published', true)
    .eq('questions.papers.is_published', true)
    .eq('questions.papers.subject_id', subject.id)
    .eq('questions.papers.level', level)

  const topicCounts = new Map<string, { id: string; name: string; count: number }>()
  ;((topicRows ?? []) as unknown as TopicRow[]).forEach((row) => {
    const name = row.topics?.name
    if (!name) return
    const current = topicCounts.get(row.topic_id) ?? { id: row.topic_id, name, count: 0 }
    current.count += 1
    topicCounts.set(row.topic_id, current)
  })
  const topics = Array.from(topicCounts.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
      <main className="tsm-shell py-12">
        <Link href={`/practice/${encodeURIComponent(subject.name)}`} className="font-body text-sm text-[#735b2b] underline">← {subject.name}</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{level}</h1>
        <p className="mt-3 font-body text-[#43474d]">Choose a topic to practise.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}/${topic.id}`} className="rounded-md border border-[#c3c6ce66] bg-white p-6 hover:border-[#735b2b]">
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
