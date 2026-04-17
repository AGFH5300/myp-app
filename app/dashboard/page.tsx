import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: recentBookmarks }, { data: recentViews }, { data: paperCounts }, { data: recentPapers }] = await Promise.all([
    supabase.from('profiles').select('selected_subject_ids, preferred_session, preferred_year, practice_focus').eq('id', user?.id).maybeSingle(),
    supabase.from('bookmarks').select('id, paper_id, question_id, created_at').eq('student_id', user?.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('paper_views').select('id, viewed_at, papers(id,title,year)').eq('student_id', user?.id).order('viewed_at', { ascending: false }).limit(3),
    supabase.from('papers').select('id, year, exam_sessions(session_month)').eq('is_published', true),
    supabase.from('papers').select('id,title,year,created_at,exam_sessions(session_month),subjects(name)').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
  ])

  const countByYearSession = (paperCounts ?? []).reduce<Record<string, number>>((acc, paper) => {
    const key = `${paper.year} ${paper.exam_sessions?.session_month ?? ''}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-5xl text-[#00152a]">Dashboard</h1>
        <p className="font-body text-lg text-[#43474d] mt-3">Continue with real MYP eAssessment papers, questions, and markschemes.</p>
      </header>

      <section className="grid lg:grid-cols-2 gap-6">
        <article className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
          <h2 className="font-headline text-2xl text-[#00152a]">Continue where you left off</h2>
          <p className="font-body text-sm text-[#43474d] mt-3">{recentViews?.[0]?.papers?.title ? `Last viewed: ${recentViews[0].papers.title} (${recentViews[0].papers.year})` : 'No recently viewed papers yet.'}</p>
          <Link href="/dashboard/papers" className="tsm-btn-primary inline-block mt-5">Browse papers</Link>
        </article>

        <article className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
          <h2 className="font-headline text-2xl text-[#00152a]">Your focus</h2>
          <p className="font-body text-sm text-[#43474d] mt-3">Preferred session: {profile?.preferred_session ?? 'None'} · Preferred year: {profile?.preferred_year ?? 'None'}</p>
          <p className="font-body text-sm text-[#43474d] mt-2">Practice focus: {profile?.practice_focus || 'Not set yet.'}</p>
        </article>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <article className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
          <h2 className="font-headline text-2xl text-[#00152a]">Recent bookmarks</h2>
          <p className="font-body text-sm text-[#43474d] mt-2">{recentBookmarks?.length ?? 0} saved items.</p>
          <Link href="/dashboard/bookmarks" className="font-body text-sm text-[#735b2b] inline-block mt-3">Open bookmarks →</Link>
        </article>
        <article className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
          <h2 className="font-headline text-2xl text-[#00152a]">Available papers by year/session</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 font-body text-sm">
            {Object.keys(countByYearSession).slice(0, 6).map((key) => <div key={key} className="bg-[#f5f3ee] px-3 py-2 rounded-sm flex justify-between"><span>{key}</span><span>{countByYearSession[key]}</span></div>)}
            {!Object.keys(countByYearSession).length && <p className="text-[#43474d]">No published papers yet.</p>}
          </div>
        </article>
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <h2 className="font-headline text-2xl text-[#00152a]">Latest published papers</h2>
        <div className="mt-4 space-y-3">
          {recentPapers?.map((paper) => (
            <Link key={paper.id} href={`/dashboard/papers/${paper.id}`} className="block bg-[#f5f3ee] p-4 rounded-sm">
              <p className="font-headline text-lg text-[#00152a]">{paper.title}</p>
              <p className="font-body text-sm text-[#43474d]">{paper.subjects?.name} · {paper.year} {paper.exam_sessions?.session_month}</p>
            </Link>
          ))}
          {!recentPapers?.length && <p className="font-body text-sm text-[#43474d]">No papers uploaded yet.</p>}
        </div>
      </section>
    </div>
  )
}
