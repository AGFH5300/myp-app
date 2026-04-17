import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: subject } = await supabase.from('subjects').select('*').eq('id', id).single()
  if (!subject) notFound()
  const { data: papers } = await supabase.from('papers').select('*, questions(count)').eq('subject_id', id).eq('is_active', true).order('year', { ascending: false })

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">{subject.name}</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">{subject.description}</p>
      <div className="space-y-4">
        {papers?.map((paper) => (
          <div key={paper.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between">
            <div><h2 className="font-headline text-2xl text-[#00152a]">{paper.title}</h2><p className="font-body text-sm text-[#43474d] mt-2">{paper.session} {paper.year} · {paper.duration_minutes} min · {paper.questions?.[0]?.count || 0} questions</p></div>
            <Link href={`/dashboard/practice/${paper.id}`} className="tsm-btn-primary">Start Practice</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
