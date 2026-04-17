import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: subject } = await supabase.from('subjects').select('id,name,description').eq('id', id).maybeSingle()
  if (!subject) notFound()

  const { data: papers } = await supabase
    .from('papers')
    .select('id,title,year,is_published,exam_sessions(session_month,session_year)')
    .eq('subject_id', id)
    .eq('is_published', true)
    .order('year', { ascending: false })

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-headline text-4xl text-[#00152a]">{subject.name}</h1>
        <p className="font-body text-[#43474d] mt-2">{subject.description || 'Published papers for this subject.'}</p>
      </header>
      <div className="space-y-4">
        {!papers?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d] rounded-md">No published papers yet for this subject.</div>}
        {papers?.map((paper) => (
          <div key={paper.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4 rounded-md">
            <div><h2 className="font-headline text-2xl text-[#00152a]">{paper.title}</h2><p className="font-body text-sm text-[#43474d] mt-2">{paper.year} · {paper.exam_sessions?.session_month || ''}</p></div>
            <Link href={`/dashboard/papers/${paper.id}`} className="tsm-btn-primary">Open paper</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
