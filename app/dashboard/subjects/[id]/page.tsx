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
    .select('id,title,is_published,exam_sessions(exam_year,exam_month),questions(count)')
    .eq('subject_id', id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-4xl text-[#00152a]">{subject.name}</h1>
          <p className="font-body text-[#43474d] mt-2">{subject.description || 'Choose a paper to begin targeted practice.'}</p>
        </div>
        <Link href="/dashboard/progress" className="tsm-btn-secondary">Open Progress</Link>
      </header>
      <div className="space-y-4">
        {!papers?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d] rounded-md">No papers published yet for this subject.</div>}
        {papers?.map((paper) => (
          <div key={paper.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4 rounded-md">
            <div><h2 className="font-headline text-2xl text-[#00152a]">{paper.title}</h2><p className="font-body text-sm text-[#43474d] mt-2">{paper.exam_sessions?.exam_month || 'Session'} {paper.exam_sessions?.exam_year || ''} · {paper.questions?.[0]?.count || 0} questions · {paper.is_published ? 'Published' : 'Draft'}</p></div>
            <Link href={`/dashboard/practice/${paper.id}`} className="tsm-btn-primary">Start Practice</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
