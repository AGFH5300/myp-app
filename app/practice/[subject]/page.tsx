import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

type PaperRelation<T> = T | T[] | null
type QuestionRow = { papers?: PaperRelation<{ level?: string | null }> }
type LinkRow = { questions?: QuestionRow | QuestionRow[] | null }

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? relation[0] : relation
}

export default async function PracticeSubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: subjectParam } = await params
  const subjectName = decodeURIComponent(subjectParam)
  const supabase = await createClient()

  const { data: subject } = await supabase.from('subjects').select('id,name').eq('name', subjectName).maybeSingle()
  if (!subject) notFound()

  const { data: links } = await supabase
    .from('question_topics')
    .select('questions!inner(is_published,papers!inner(level,is_published,subject_id))')
    .eq('questions.is_published', true)
    .eq('questions.papers.is_published', true)
    .eq('questions.papers.subject_id', subject.id)

  const levels = Array.from(new Set(((links ?? []) as unknown as LinkRow[])
    .map((link) => firstRelation(firstRelation(link.questions)?.papers)?.level || 'General'))).sort()

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95"><div className="tsm-shell py-6"><BrandWordmark className="text-2xl" href="/practice" /></div></header>
      <main className="tsm-shell py-12">
        <Link href="/practice" className="font-body text-sm text-[#735b2b] underline">← Subjects</Link>
        <h1 className="mt-4 font-headline text-5xl text-[#00152a]">{subject.name}</h1>
        <p className="mt-3 font-body text-[#43474d]">Choose a course level.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {levels.map((level) => (
            <Link key={level} href={`/practice/${encodeURIComponent(subject.name)}/${encodeURIComponent(level)}`} className="rounded-md border border-[#c3c6ce66] bg-white p-6 hover:border-[#735b2b]">
              <h2 className="font-headline text-3xl text-[#00152a]">{level}</h2>
            </Link>
          ))}
          {!levels.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published levels yet.</p> : null}
        </div>
      </main>
    </div>
  )
}
