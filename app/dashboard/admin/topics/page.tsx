import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicManager } from './topic-manager'

export default async function AdminTopicsPage({ searchParams }: { searchParams: Promise<{ subject?: string; group?: string; notice?: string; error?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: subjects }, { data: topics }, { data: questionTopics }] = await Promise.all([
    supabase.from('subjects').select('id,name').order('name'),
    supabase.from('topics').select('id,subject_id,parent_topic_id,name,slug,level,sort_order,is_active').order('sort_order').order('name'),
    supabase.from('question_topics').select('question_id,topic_id'),
  ])

  const subjectRows = subjects ?? []
  const topicRows = topics ?? []
  const initialSubjectId = subjectRows.some((subject) => subject.id === params.subject)
    ? params.subject!
    : subjectRows.find((subject) => subject.name === 'Mathematics Extended')?.id || subjectRows[0]?.id || ''
  const firstGroupId = topicRows.find((topic) => topic.subject_id === initialSubjectId && !topic.parent_topic_id)?.id || ''
  const initialGroupId = topicRows.some((topic) => topic.id === params.group && topic.subject_id === initialSubjectId && !topic.parent_topic_id)
    ? params.group!
    : firstGroupId

  return (
    <div className="space-y-8">
      <header className="rounded-md border border-[#c3c6ce66] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Admin workspace</p>
        <h1 className="mt-3 font-headline text-5xl text-[#00152a]">Topic Manager</h1>
        <p className="mt-3 max-w-2xl font-body text-lg text-[#43474d]">Manage official topic groups and subtopics. These control the filters students use in Papers.</p>
      </header>

      <TopicManager
        subjects={subjectRows}
        topics={topicRows}
        questionTopics={questionTopics ?? []}
        initialSubjectId={initialSubjectId}
        initialGroupId={initialGroupId}
        notice={params.notice}
        error={params.error}
      />
    </div>
  )
}
