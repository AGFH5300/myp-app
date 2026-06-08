import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

type LinkRow = { topic_id: string }

export default async function PracticeTopicGroupPage({ params }: { params: Promise<{ subject: string; level: string }> }) {
  const { subject: subjectParam, level: topicGroupId } = await params
  const subjectName = decodeURIComponent(subjectParam)
  const supabase = await createClient()

  const [{ data: subject }, { data: topicGroup }] = await Promise.all([
    supabase.from('subjects').select('id,name').eq('name', subjectName).maybeSingle(),
    supabase.from('topics').select('id,name,parent_topic_id').eq('id', topicGroupId).maybeSingle(),
  ])
  if (!subject || !topicGroup) notFound()

  const { data: childTopics } = await supabase
    .from('topics')
    .select('id,name,sort_order')
    .eq('parent_topic_id', topicGroup.id)
    .eq('subject_id', subject.id)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (!childTopics?.length) {
    return (
      <div className="min-h-screen bg-[#fbf9f4]">
        <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
        <main className="tsm-shell py-12">
          <Link href={`/practice/${encodeURIComponent(subject.name)}`} className="font-body text-sm text-[#735b2b] underline">← {subject.name}</Link>
          <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{topicGroup.name}</h1>
          <p className="mt-3 font-body text-[#43474d]">No published subtopics yet.</p>
        </main>
      </div>
    )
  }

  const { data: links } = await supabase
    .from('question_topics')
    .select('topic_id,questions!inner(is_published,papers!inner(is_published,subject_id))')
    .in('topic_id', childTopics.map((child) => child.id))
    .eq('questions.is_published', true)
    .eq('questions.papers.is_published', true)
    .eq('questions.papers.subject_id', subject.id)

  const counts = new Map(childTopics.map((child) => [child.id, 0]))
  ;((links ?? []) as unknown as LinkRow[]).forEach((row) => counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1))
  const visibleChildren = childTopics.filter((child) => (counts.get(child.id) ?? 0) > 0)

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
      <main className="tsm-shell py-12">
        <Link href={`/practice/${encodeURIComponent(subject.name)}`} className="font-body text-sm text-[#735b2b] underline">← {subject.name} topics</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{topicGroup.name}</h1>
        <p className="mt-3 font-body text-[#43474d]">Choose a subtopic.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {visibleChildren.map((child) => (
            <Link key={child.id} href={`/practice/${encodeURIComponent(subject.name)}/${topicGroup.id}/${child.id}`} className="cursor-pointer rounded-md border border-[#c3c6ce66] bg-white p-6 transition hover:border-[#735b2b] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30">
              <h2 className="font-headline text-3xl text-[#00152a]">{child.name}</h2>
              <p className="mt-2 font-body text-sm text-[#43474d]">{counts.get(child.id)} question{counts.get(child.id) === 1 ? '' : 's'}</p>
            </Link>
          ))}
          {!visibleChildren.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published subtopics yet.</p> : null}
        </div>
      </main>
    </div>
  )
}
