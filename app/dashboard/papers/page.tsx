import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PapersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const subject = typeof params.subject === 'string' ? params.subject : ''
  const year = typeof params.year === 'string' ? params.year : ''
  const session = typeof params.session === 'string' ? params.session : ''

  const supabase = await createClient()

  let query = supabase
    .from('papers')
    .select('id,title,year,is_published,pdf_url,markscheme_url,subjects(id,name),exam_sessions(id,session_month,session_year)')
    .eq('is_published', true)
    .order('year', { ascending: false })

  if (subject) query = query.eq('subject_id', subject)
  if (year) query = query.eq('year', Number(year))

  const [{ data: fetchedPapers }, { data: subjects }] = await Promise.all([
    query,
    supabase.from('subjects').select('id,name').order('name'),
  ])

  const papers = fetchedPapers?.filter((paper) => (session ? paper.exam_sessions?.session_month === session : true))

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Past papers</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Real MYP eAssessment papers (2016–2025), with question-level access and markschemes.</p>

      <form className="grid md:grid-cols-3 gap-4 mb-8 bg-white border border-[#c3c6ce66] p-4 rounded-md">
        <select name="subject" defaultValue={subject} className="tsm-input">
          <option value="">All subjects</option>
          {subjects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="year" defaultValue={year} className="tsm-input">
          <option value="">All years</option>
          {Array.from({ length: 10 }, (_, i) => 2025 - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select name="session" defaultValue={session} className="tsm-input">
          <option value="">All sessions</option>
          <option value="May">May</option>
          <option value="November">November</option>
        </select>
        <button className="tsm-btn-primary w-fit">Apply filters</button>
      </form>

      <div className="space-y-4">
        {!papers?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d] rounded-md">No papers match these filters.</div>}
        {papers?.map((paper) => (
          <article key={paper.id} className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-headline text-2xl text-[#00152a]">{paper.title}</h2>
                <p className="font-body text-sm text-[#43474d] mt-2">{paper.subjects?.name} · {paper.year} · {paper.exam_sessions?.session_month || ''}</p>
              </div>
              <Link href={`/dashboard/papers/${paper.id}`} className="tsm-btn-secondary">Open paper</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
